import os
import csv
import io
from datetime import datetime
from threading import Thread
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, ConfigDict
from typing import List

from .monitor import NetworkMonitor

monitor: Optional[NetworkMonitor] = None
monitor_thread: Optional[Thread] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global monitor, monitor_thread
    config_path = os.environ.get("CONFIG_PATH", "/app/config.yml")
    monitor = NetworkMonitor(config_path)
    monitor_thread = Thread(target=monitor.run, daemon=True)
    monitor_thread.start()
    yield
    if monitor:
        monitor.stop()


app = FastAPI(title="Network Monitor API", version="2.0.0", lifespan=lifespan)

allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allowed_origins == "*" else allowed_origins.split(","),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TargetCreate(BaseModel):
    name: str = Field(..., min_length=1)
    host: str = Field(..., min_length=1)
    port: Optional[int] = None
    protocol: str = "tcp"
    expected_status: int = 200
    description: str = ""


class TargetUpdate(BaseModel):
    name: str = Field(..., min_length=1)
    host: str = Field(..., min_length=1)
    port: Optional[int] = None
    protocol: str = "tcp"
    expected_status: int = 200
    description: str = ""


class SettingsUpdate(BaseModel):
    check_interval: Optional[int] = Field(None, ge=5)
    timeout: Optional[int] = Field(None, ge=1)
    retries: Optional[int] = Field(None, ge=1)
    retry_delay: Optional[int] = Field(None, ge=0)
    log_file: Optional[str] = None
    report_file: Optional[str] = None
    enable_web_dashboard: Optional[bool] = None
    dashboard_port: Optional[int] = None


class EmailConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    enabled: bool = False
    smtp_server: str = ""
    smtp_port: int = 587
    username: str = ""
    password: str = ""
    from_addr: str = Field("", alias="from")
    to: List[str] = []


class WebhookConfig(BaseModel):
    enabled: bool = False
    url: str = ""


class ConsoleConfig(BaseModel):
    enabled: bool = True


class NotificationsUpdate(BaseModel):
    email: EmailConfig
    webhook: WebhookConfig
    console: ConsoleConfig


@app.get("/api/health")
def health():
    return {"status": "ok", "time": datetime.now().isoformat()}


@app.get("/api/settings")
def get_settings():
    return monitor.get_settings()


@app.get("/api/config/settings")
def get_full_settings():
    return monitor.get_full_settings()


@app.put("/api/config/settings")
def put_settings(payload: SettingsUpdate):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    return monitor.update_settings(updates)


@app.get("/api/config/notifications")
def get_notifications():
    return monitor.get_notifications()


@app.put("/api/config/notifications")
def put_notifications(payload: NotificationsUpdate):
    data = payload.model_dump(by_alias=True)
    return monitor.update_notifications(data)


@app.get("/api/status")
def api_status():
    statuses = monitor.get_all_statuses()
    total = len(statuses)
    up = sum(1 for t in statuses.values() if t.get("is_up") is True)
    down = sum(1 for t in statuses.values() if t.get("is_up") is False)
    unknown = total - up - down
    return {
        "summary": {"total": total, "up": up, "down": down, "unknown": unknown},
        "targets": statuses,
        "generated_at": datetime.now().isoformat(),
        "server_time": datetime.now().isoformat(),
        "next_check_at": (
            datetime.fromtimestamp(monitor.next_check_at).isoformat()
            if monitor.next_check_at
            else None
        ),
    }


@app.get("/api/targets")
def list_targets():
    statuses = monitor.get_all_statuses()
    return {"targets": list(statuses.values())}


@app.post("/api/targets", status_code=201)
def add_target(payload: TargetCreate):
    if payload.name in monitor.targets:
        raise HTTPException(status_code=409, detail=f"'{payload.name}' already exists")
    new_target = monitor.add_target(
        name=payload.name,
        host=payload.host,
        port=payload.port,
        protocol=payload.protocol,
        expected_status=payload.expected_status,
        description=payload.description,
    )
    return {"message": f"'{payload.name}' added", "target": new_target.to_dict()}


@app.put("/api/targets/{name}")
def edit_target(name: str, payload: TargetUpdate):
    if name not in monitor.targets:
        raise HTTPException(status_code=404, detail=f"'{name}' not found")
    if payload.name != name and payload.name in monitor.targets:
        raise HTTPException(status_code=409, detail=f"'{payload.name}' already exists")
    try:
        updated = monitor.update_target(
            name,
            new_name=payload.name,
            host=payload.host,
            port=payload.port,
            protocol=payload.protocol,
            expected_status=payload.expected_status,
            description=payload.description,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    if not updated:
        raise HTTPException(status_code=404, detail=f"'{name}' not found")
    return {"message": f"'{payload.name}' updated", "target": updated.to_dict()}


@app.delete("/api/targets/{name}")
def remove_target(name: str):
    removed = monitor.remove_target(name)
    if not removed:
        raise HTTPException(status_code=404, detail=f"'{name}' not found")
    return {"message": f"'{name}' removed"}


@app.get("/api/targets/{name}/history")
def target_history(name: str):
    detail = monitor.get_target_detail(name)
    if not detail:
        raise HTTPException(status_code=404, detail=f"'{name}' not found")
    return detail


@app.get("/api/targets/{name}/history/export")
def export_target_history(name: str):
    detail = monitor.get_target_detail(name)
    if not detail:
        raise HTTPException(status_code=404, detail=f"'{name}' not found")

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["type", "time", "status_or_event", "response_time_ms_or_message"])
    for h in detail["history"]:
        writer.writerow(["check", h["time"], h["status"], h.get("response_time_ms", "")])
    for e in detail["downtime_events"]:
        writer.writerow(["event", e["time"], e["event"], e.get("message", "")])
    buf.seek(0)

    filename = f"{name.replace(' ', '_')}_history.csv"
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/export")
def export_all_csv():
    statuses = monitor.get_all_statuses()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "name", "host", "port", "protocol", "status", "uptime_percent",
        "last_response_time_ms", "total_checks", "total_up", "total_down",
        "last_check", "last_up", "last_down",
    ])
    for t in statuses.values():
        status = "UP" if t["is_up"] is True else "DOWN" if t["is_up"] is False else "PENDING"
        writer.writerow([
            t["name"], t["host"], t["port"] or "", t["protocol"], status,
            t["uptime_percentage"], t["last_response_time_ms"] or "",
            t["total_checks"], t["total_up"], t["total_down"],
            t["last_check"] or "", t["last_up"] or "", t["last_down"] or "",
        ])
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="network_monitor_export.csv"'},
    )
