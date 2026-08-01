import socket
import subprocess
import time
import yaml
import logging
import os
import sys
from datetime import datetime
from threading import Thread, Lock

import requests
from .notifier import Notifier
from .reporter import Reporter
from .database import init_db, get_db, Target, CheckHistory, DowntimeEvent


class TargetStatus:
    def __init__(self, name, host, port=None, protocol="tcp"):
        self.name = name
        self.host = host
        self.port = port
        self.protocol = protocol
        self.is_up = None
        self.last_check = None
        self.last_up = None
        self.last_down = None
        self.last_response_time = None
        self.consecutive_failures = 0
        self.total_checks = 0
        self.total_up = 0
        self.total_down = 0
        self.downtime_events = []
        self.history = []
        self.extra_config = {}

    @property
    def uptime_percentage(self):
        if self.total_checks == 0:
            return 0.0
        return (self.total_up / self.total_checks) * 100

    def to_dict(self):
        return {
            "name": self.name,
            "host": self.host,
            "port": self.port,
            "protocol": self.protocol,
            "description": (self.extra_config or {}).get("description", ""),
            "is_up": self.is_up,
            "last_check": self.last_check.isoformat() if self.last_check else None,
            "last_up": self.last_up.isoformat() if self.last_up else None,
            "last_down": self.last_down.isoformat() if self.last_down else None,
            "last_response_time_ms": self.last_response_time,
            "consecutive_failures": self.consecutive_failures,
            "total_checks": self.total_checks,
            "total_up": self.total_up,
            "total_down": self.total_down,
            "uptime_percentage": round(self.uptime_percentage, 2),
            "recent_history": self.history[-20:],
            "downtime_events": self.downtime_events[-10:],
        }


class NetworkMonitor:
    def __init__(self, config_path="/app/config.yml"):
        self.config_path = config_path
        self.config = self._load_config(config_path)
        self.settings = self.config.get("settings", {})
        self.targets = {}
        self.lock = Lock()
        self.running = False
        self.next_check_at = None
        self._setup_logging()
        try:
            init_db()
        except Exception as e:
            self.logger.error(f"Failed to initialize database: {e}")
        self._init_targets()
        self.notifier = Notifier(self.config.get("notifications", {}), self.logger)
        self.reporter = Reporter(
            self.settings.get("report_file", "/app/reports/report.json"),
            self.logger,
        )

    def _load_config(self, config_path):
        with open(config_path, "r") as f:
            return yaml.safe_load(f)

    def _setup_logging(self):
        log_file = self.settings.get("log_file", "/app/logs/monitor.log")
        os.makedirs(os.path.dirname(log_file), exist_ok=True)
        self.logger = logging.getLogger("NetworkMonitor")
        self.logger.setLevel(logging.INFO)
        if not self.logger.handlers:
            fh = logging.FileHandler(log_file)
            fh.setLevel(logging.INFO)
            ch = logging.StreamHandler()
            ch.setLevel(logging.INFO)
            formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
            fh.setFormatter(formatter)
            ch.setFormatter(formatter)
            self.logger.addHandler(fh)
            self.logger.addHandler(ch)

    def _init_targets(self):
        try:
            with get_db() as db:
                db_targets = db.query(Target).all()
                if not db_targets:
                    self.logger.info("Database is empty. Seeding targets from config.yml...")
                    for target_conf in self.config.get("targets", []):
                        name = target_conf["name"]
                        t = Target(
                            name=name,
                            host=target_conf["host"],
                            port=target_conf.get("port"),
                            protocol=target_conf.get("protocol", "tcp"),
                            expected_status=target_conf.get("expected_status", 200),
                            description=target_conf.get("description", "")
                        )
                        db.add(t)
                    db.commit()
                    db_targets = db.query(Target).all()

                for t in db_targets:
                    status = TargetStatus(
                        name=t.name,
                        host=t.host,
                        port=t.port,
                        protocol=t.protocol
                    )
                    status.is_up = t.is_up
                    status.last_check = t.last_check
                    status.last_up = t.last_up
                    status.last_down = t.last_down
                    status.last_response_time = t.last_response_time
                    status.consecutive_failures = t.consecutive_failures
                    status.total_checks = t.total_checks
                    status.total_up = t.total_up
                    status.total_down = t.total_down

                    # Prepopulate in-memory history and downtime events
                    recent_history = db.query(CheckHistory).filter(CheckHistory.target_id == t.id).order_by(CheckHistory.time.asc()).all()
                    status.history = [
                        {"time": h.time.isoformat(), "status": h.status, "response_time_ms": h.response_time_ms}
                        for h in recent_history[-200:]
                    ]

                    recent_events = db.query(DowntimeEvent).filter(DowntimeEvent.target_id == t.id).order_by(DowntimeEvent.time.asc()).all()
                    status.downtime_events = [
                        {"event": e.event, "time": e.time.isoformat(), "message": e.message}
                        for e in recent_events[-500:]
                    ]

                    status.extra_config = {
                        "name": t.name,
                        "host": t.host,
                        "port": t.port,
                        "protocol": t.protocol,
                        "expected_status": t.expected_status,
                        "description": t.description or ""
                    }
                    self.targets[t.name] = status
            self.logger.info(f"Loaded {len(self.targets)} targets from database.")
        except Exception as e:
            self.logger.error(f"Failed to load targets from database: {e}")
            # Fallback to config file in case DB fails, to keep app resilient
            self.logger.warning("Falling back to loading targets from config.yml")
            for target_conf in self.config.get("targets", []):
                name = target_conf["name"]
                self.targets[name] = TargetStatus(
                    name=name,
                    host=target_conf["host"],
                    port=target_conf.get("port"),
                    protocol=target_conf.get("protocol", "tcp"),
                )
                self.targets[name].extra_config = target_conf

    def stop(self):
        self.logger.info("Shutting down network monitor...")
        self.running = False
        self._save_report()

    def check_tcp(self, host, port, timeout):
        start = time.time()
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((host, int(port)))
            elapsed = (time.time() - start) * 1000
            sock.close()
            return result == 0, round(elapsed, 2)
        except Exception:
            elapsed = (time.time() - start) * 1000
            return False, round(elapsed, 2)

    def check_udp(self, host, port, timeout):
        start = time.time()
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(timeout)
            sock.sendto(b"\x00", (host, int(port)))
            try:
                sock.recvfrom(1024)
            except socket.timeout:
                pass
            elapsed = (time.time() - start) * 1000
            sock.close()
            return True, round(elapsed, 2)
        except Exception:
            elapsed = (time.time() - start) * 1000
            return False, round(elapsed, 2)

    def check_http(self, host, port, timeout, use_ssl=False, expected_status=200):
        scheme = "https" if use_ssl else "http"
        url = f"{scheme}://{host}:{port}" if port else f"{scheme}://{host}"
        start = time.time()
        try:
            import urllib3
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            response = requests.get(url, timeout=timeout, verify=False, allow_redirects=True)
            elapsed = (time.time() - start) * 1000
            return response.status_code == expected_status, round(elapsed, 2)
        except Exception:
            elapsed = (time.time() - start) * 1000
            return False, round(elapsed, 2)

    def check_icmp(self, host, timeout):
        start = time.time()
        try:
            cmd = ["ping", "-c", "1", "-W", str(int(timeout)), host]
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=timeout + 2,
            )
            elapsed = (time.time() - start) * 1000
            return result.returncode == 0, round(elapsed, 2)
        except Exception:
            elapsed = (time.time() - start) * 1000
            return False, round(elapsed, 2)

    def check_target(self, target_status):
        config = target_status.extra_config
        protocol = config.get("protocol", "tcp")
        host = config["host"]
        port = config.get("port")
        timeout = self.settings.get("timeout", 5)
        retries = self.settings.get("retries", 3)
        retry_delay = self.settings.get("retry_delay", 5)
        expected_status = config.get("expected_status", 200)

        is_up = False
        response_time = 0

        for attempt in range(retries):
            if protocol == "tcp":
                is_up, response_time = self.check_tcp(host, port, timeout)
            elif protocol == "udp":
                is_up, response_time = self.check_udp(host, port, timeout)
            elif protocol == "http":
                is_up, response_time = self.check_http(host, port, timeout, use_ssl=False, expected_status=expected_status)
            elif protocol == "https":
                is_up, response_time = self.check_http(host, port, timeout, use_ssl=True, expected_status=expected_status)
            elif protocol == "icmp":
                is_up, response_time = self.check_icmp(host, timeout)
            else:
                self.logger.warning(f"Unknown protocol '{protocol}' for {target_status.name}")
                return

            if is_up:
                break
            elif attempt < retries - 1:
                time.sleep(retry_delay)

        now = datetime.now()
        pending_alert = None  # (target_snapshot, alert_type) — sent after releasing the lock
        with self.lock:
            previous_state = target_status.is_up
            target_status.last_check = now
            target_status.last_response_time = response_time
            target_status.total_checks += 1

            if is_up:
                target_status.is_up = True
                target_status.last_up = now
                target_status.consecutive_failures = 0
                target_status.total_up += 1
                target_status.history.append({"time": now.isoformat(), "status": "UP", "response_time_ms": response_time})
            else:
                target_status.is_up = False
                target_status.last_down = now
                target_status.consecutive_failures += 1
                target_status.total_down += 1
                target_status.history.append({"time": now.isoformat(), "status": "DOWN", "response_time_ms": response_time})

            if len(target_status.history) > 200:
                target_status.history = target_status.history[-200:]

            host_port = f"{host}:{port}" if port else host

            # DB persistence logic
            try:
                with get_db() as db:
                    db_target = db.query(Target).filter(Target.name == target_status.name).first()
                    if db_target:
                        db_target.is_up = target_status.is_up
                        db_target.last_check = target_status.last_check
                        db_target.last_response_time = target_status.last_response_time
                        db_target.total_checks = target_status.total_checks
                        db_target.total_up = target_status.total_up
                        db_target.total_down = target_status.total_down
                        db_target.last_up = target_status.last_up
                        db_target.last_down = target_status.last_down
                        db_target.consecutive_failures = target_status.consecutive_failures

                        # Write check history
                        ch_record = CheckHistory(
                            target_id=db_target.id,
                            time=now,
                            status="UP" if is_up else "DOWN",
                            response_time_ms=response_time
                        )
                        db.add(ch_record)

                        # Write downtime event if transition occurred
                        if previous_state is not None and previous_state != is_up:
                            event_type = "UP" if is_up else "DOWN"
                            event_msg = f"{target_status.name} is back UP" if is_up else f"{target_status.name} is DOWN"
                            de_record = DowntimeEvent(
                                target_id=db_target.id,
                                event=event_type,
                                time=now,
                                message=event_msg
                            )
                            db.add(de_record)
                        
                        db.commit()
            except Exception as e:
                self.logger.error(f"Failed to persist check results to database for {target_status.name}: {e}")

            if previous_state is not None and previous_state != is_up:
                if not is_up:
                    event = {"event": "DOWN", "time": now.isoformat(), "message": f"{target_status.name} is DOWN"}
                    target_status.downtime_events.append(event)
                    self.logger.warning(f"DOWN: {target_status.name} ({host_port} via {protocol})")
                    pending_alert = (target_status.to_dict(), "DOWN")
                else:
                    event = {"event": "UP", "time": now.isoformat(), "message": f"{target_status.name} is back UP"}
                    target_status.downtime_events.append(event)
                    self.logger.info(f"RECOVERED: {target_status.name} ({host_port} via {protocol})")
                    pending_alert = (target_status.to_dict(), "RECOVERED")
            elif previous_state is None:
                status_str = "UP" if is_up else "DOWN"
                self.logger.info(f"Initial: {target_status.name} ({host_port} via {protocol}) is {status_str}")
                if not is_up:
                    pending_alert = (target_status.to_dict(), "DOWN")

            if len(target_status.downtime_events) > 500:
                target_status.downtime_events = target_status.downtime_events[-500:]

        # Send alerts (email/webhook can be slow network calls) *after* releasing
        # self.lock, so a slow SMTP/webhook response never blocks status reads or
        # config/target edits made through the API.
        if pending_alert is not None:
            target_snapshot, alert_type = pending_alert
            self.notifier.send_alert(target_snapshot, alert_type)

    def _save_report(self):
        with self.lock:
            data = {name: t.to_dict() for name, t in self.targets.items()}
        self.reporter.generate_report(data)

    def get_all_statuses(self):
        with self.lock:
            return {name: t.to_dict() for name, t in self.targets.items()}

    def get_target_detail(self, name):
        with self.lock:
            target = self.targets.get(name)
            if not target:
                return None
            base = target.to_dict()
            is_up = target.is_up

        try:
            with get_db() as db:
                db_target = db.query(Target).filter(Target.name == name).first()
                if not db_target:
                    full_history = list(target.history)
                    full_events = list(target.downtime_events)
                else:
                    db_history = db.query(CheckHistory).filter(CheckHistory.target_id == db_target.id).order_by(CheckHistory.time.asc()).all()
                    db_events = db.query(DowntimeEvent).filter(DowntimeEvent.target_id == db_target.id).order_by(DowntimeEvent.time.asc()).all()
                    
                    full_history = [
                        {"time": h.time.isoformat(), "status": h.status, "response_time_ms": h.response_time_ms}
                        for h in db_history
                    ]
                    full_events = [
                        {"event": e.event, "time": e.time.isoformat(), "message": e.message}
                        for e in db_events
                    ]
        except Exception as e:
            self.logger.error(f"Failed to query history from database for {name}: {e}")
            full_history = list(target.history)
            full_events = list(target.downtime_events)

        now = datetime.now()
        day_ago = now.timestamp() - 86400
        week_ago = now.timestamp() - 7 * 86400

        def ts(iso):
            return datetime.fromisoformat(iso).timestamp()

        down_events = [e for e in full_events if e["event"] == "DOWN"]
        incidents_24h = sum(1 for e in down_events if ts(e["time"]) >= day_ago)
        incidents_7d = sum(1 for e in down_events if ts(e["time"]) >= week_ago)

        # Pair each DOWN with the next UP to compute downtime duration.
        total_downtime_seconds = 0.0
        pending_down_ts = None
        for e in full_events:
            if e["event"] == "DOWN":
                pending_down_ts = ts(e["time"])
            elif e["event"] == "UP" and pending_down_ts is not None:
                total_downtime_seconds += max(0.0, ts(e["time"]) - pending_down_ts)
                pending_down_ts = None
        if pending_down_ts is not None and is_up is False:
            total_downtime_seconds += max(0.0, now.timestamp() - pending_down_ts)

        base.update({
            "history": full_history,
            "downtime_events": full_events,
            "incidents_24h": incidents_24h,
            "incidents_7d": incidents_7d,
            "total_downtime_seconds": round(total_downtime_seconds, 1),
        })
        return base

    def get_settings(self):
        return {
            "check_interval": self.settings.get("check_interval", 30),
            "timeout": self.settings.get("timeout", 5),
            "retries": self.settings.get("retries", 3),
        }

    def get_full_settings(self):
        """Every field under the top-level `settings:` key in config.yml."""
        defaults = {
            "check_interval": 30,
            "timeout": 5,
            "retries": 3,
            "retry_delay": 5,
            "log_file": "/app/logs/monitor.log",
            "report_file": "/app/reports/report.json",
            "enable_web_dashboard": True,
            "dashboard_port": 8080,
        }
        merged = {**defaults, **self.settings}
        return merged

    def update_settings(self, updates: dict):
        """Merge `updates` into settings, apply live where possible, and persist to config.yml."""
        with self.lock:
            self.settings.update(updates)
        self._persist_settings_and_notifications()
        return self.get_full_settings()

    def get_notifications(self):
        """Every field under the top-level `notifications:` key in config.yml."""
        current = self.config.get("notifications", {}) or {}
        defaults = {
            "email": {
                "enabled": False,
                "smtp_server": "",
                "smtp_port": 587,
                "username": "",
                "password": "",
                "from": "",
                "to": [],
            },
            "webhook": {"enabled": False, "url": ""},
            "console": {"enabled": True},
        }
        return {
            "email": {**defaults["email"], **current.get("email", {})},
            "webhook": {**defaults["webhook"], **current.get("webhook", {})},
            "console": {**defaults["console"], **current.get("console", {})},
        }

    def update_notifications(self, data: dict):
        """Replace the notifications config, apply live to the running notifier, and persist."""
        with self.lock:
            self.config["notifications"] = data
            self.notifier.config = data
        self._persist_settings_and_notifications()
        return data

    def _persist_settings_and_notifications(self):
        """Read the config file fresh (so we don't clobber target changes made
        concurrently via add/remove/update), overlay current settings and
        notifications, write it back, and refresh our in-memory copy."""
        try:
            with open(self.config_path, "r") as f:
                config_on_disk = yaml.safe_load(f) or {}
            config_on_disk["settings"] = self.settings
            config_on_disk["notifications"] = self.config.get("notifications", {})
            with open(self.config_path, "w") as f:
                yaml.dump(config_on_disk, f, default_flow_style=False, sort_keys=False)
            self.config = config_on_disk
        except Exception as e:
            self.logger.error(f"Config save failed: {e}")

    def add_target(self, name, host, port=None, protocol="tcp", expected_status=200, description=""):
        new_target = TargetStatus(name=name, host=host, port=port, protocol=protocol)
        new_target.extra_config = {
            "name": name,
            "host": host,
            "port": port,
            "protocol": protocol,
            "expected_status": expected_status,
            "description": description,
        }
        with self.lock:
            self.targets[name] = new_target
            
        try:
            with get_db() as db:
                db_target = Target(
                    name=name,
                    host=host,
                    port=port,
                    protocol=protocol,
                    expected_status=expected_status,
                    description=description
                )
                db.add(db_target)
                db.commit()
        except Exception as e:
            self.logger.error(f"Failed to add target to database: {e}")

        self._persist_add(new_target.extra_config)
        return new_target

    def update_target(self, name, new_name=None, host=None, port=None, protocol=None,
                       expected_status=None, description=None):
        """Edit an existing target in place. Preserves history/stats (keyed by
        the DB row id, not the name), and supports renaming."""
        new_name = (new_name or name).strip()
        with self.lock:
            target = self.targets.get(name)
            if not target:
                return None
            if new_name != name and new_name in self.targets:
                raise ValueError(f"'{new_name}' already exists")

            old_config = dict(target.extra_config or {})
            target.name = new_name
            target.host = host if host is not None else target.host
            target.port = port
            target.protocol = protocol if protocol is not None else target.protocol
            target.extra_config = {
                "name": new_name,
                "host": target.host,
                "port": target.port,
                "protocol": target.protocol,
                "expected_status": expected_status if expected_status is not None else old_config.get("expected_status", 200),
                "description": description if description is not None else old_config.get("description", ""),
            }

            if new_name != name:
                del self.targets[name]
            self.targets[new_name] = target

        try:
            with get_db() as db:
                db_target = db.query(Target).filter(Target.name == name).first()
                if db_target:
                    db_target.name = new_name
                    db_target.host = target.host
                    db_target.port = target.port
                    db_target.protocol = target.protocol
                    if expected_status is not None:
                        db_target.expected_status = expected_status
                    if description is not None:
                        db_target.description = description
                    db.commit()
        except Exception as e:
            self.logger.error(f"Failed to update target in database: {e}")

        self._persist_update(name, target.extra_config)
        return target

    def remove_target(self, name):
        with self.lock:
            if name not in self.targets:
                return False
            del self.targets[name]
            
        try:
            with get_db() as db:
                db_target = db.query(Target).filter(Target.name == name).first()
                if db_target:
                    db.delete(db_target)
                    db.commit()
        except Exception as e:
            self.logger.error(f"Failed to remove target from database: {e}")

        self._persist_remove(name)
        return True

    def _persist_add(self, target_data):
        try:
            with open(self.config_path, "r") as f:
                config = yaml.safe_load(f)
            entry = {"name": target_data["name"], "host": target_data["host"]}
            if target_data.get("port"):
                entry["port"] = int(target_data["port"])
            if target_data.get("protocol"):
                entry["protocol"] = target_data["protocol"]
            if target_data.get("description"):
                entry["description"] = target_data["description"]
            config.setdefault("targets", []).append(entry)
            with open(self.config_path, "w") as f:
                yaml.dump(config, f, default_flow_style=False, sort_keys=False)
        except Exception as e:
            self.logger.error(f"Config save failed: {e}")

    def _persist_update(self, old_name, target_data):
        try:
            with open(self.config_path, "r") as f:
                config = yaml.safe_load(f)
            entry = {"name": target_data["name"], "host": target_data["host"]}
            if target_data.get("port"):
                entry["port"] = int(target_data["port"])
            if target_data.get("protocol"):
                entry["protocol"] = target_data["protocol"]
            if target_data.get("description"):
                entry["description"] = target_data["description"]
            targets_list = config.get("targets", [])
            for i, t in enumerate(targets_list):
                if t.get("name") == old_name:
                    targets_list[i] = entry
                    break
            else:
                targets_list.append(entry)
            config["targets"] = targets_list
            with open(self.config_path, "w") as f:
                yaml.dump(config, f, default_flow_style=False, sort_keys=False)
        except Exception as e:
            self.logger.error(f"Config save failed: {e}")

    def _persist_remove(self, name):
        try:
            with open(self.config_path, "r") as f:
                config = yaml.safe_load(f)
            config["targets"] = [t for t in config.get("targets", []) if t.get("name") != name]
            with open(self.config_path, "w") as f:
                yaml.dump(config, f, default_flow_style=False, sort_keys=False)
        except Exception as e:
            self.logger.error(f"Config save failed: {e}")

    def _print_summary(self):
        self.logger.info("-" * 85)
        with self.lock:
            for name, t in self.targets.items():
                host_port = f"{t.host}:{t.port}" if t.port else t.host
                status = "UP" if t.is_up else ("DOWN" if t.is_up is not None else "???")
                resp = f"{t.last_response_time}ms" if t.last_response_time else "N/A"
                uptime = f"{t.uptime_percentage:.1f}%"
                self.logger.info(f"{name:<28} {host_port:<25} {status:<8} {resp:<12} {uptime:<8}")
        self.logger.info("-" * 85)

    def run(self):
        """Blocking check loop — run this in a background thread."""
        self.running = True
        interval = self.settings.get("check_interval", 30)
        self.logger.info("=" * 60)
        self.logger.info("  Network Monitor Started")
        self.logger.info(f"  Monitoring {len(self.targets)} targets")
        self.logger.info(f"  Check interval: {interval}s")
        self.logger.info("=" * 60)
        self.next_check_at = datetime.now().timestamp() + interval

        while self.running:
            threads = []
            for name, target_status in list(self.targets.items()):
                t = Thread(target=self.check_target, args=(target_status,))
                t.start()
                threads.append(t)
            for t in threads:
                t.join()
            self._print_summary()
            self._save_report()
            # Re-read interval each cycle so a live settings update (via the API)
            # takes effect on the very next cycle without requiring a restart.
            interval = self.settings.get("check_interval", 30)
            self.next_check_at = datetime.now().timestamp() + interval
            for _ in range(interval):
                if not self.running:
                    break
                time.sleep(1)


if __name__ == "__main__":
    config_path = os.environ.get("CONFIG_PATH", "/app/config.yml")
    monitor = NetworkMonitor(config_path)
    monitor.run()
