# Network Monitor — FastAPI + React

Rebuilt from the original Flask + Jinja app: same monitoring engine (TCP/UDP/HTTP/HTTPS/ICMP checks, retries, uptime history, console/email/webhook alerts), now split into a JSON API and a separate React SPA with a black SaaS-style dashboard.

## Stack
- **Backend:** FastAPI (Python 3.12), background thread runs the check loop, same `monitor.py`/`notifier.py`/`reporter.py` logic as before
- **Frontend:** React 18 + Vite + Tailwind CSS, polls `/api/status` every 10s
- **Deploy:** Docker Compose — nginx serves the built SPA and proxies `/api/*` to the backend container

## Run locally with Docker
```bash
docker compose up --build
```
- Dashboard: http://localhost:8080
- API directly: http://localhost:8000/api/status

## Run without Docker (dev mode)
Backend:
```bash
cd backend
pip install -r requirements.txt
CONFIG_PATH=$(pwd)/app/config.yml uvicorn app.main:app --reload --port 8000
```

Frontend:
```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
npm run dev
```

## Editing monitored targets
Add/remove targets from the dashboard UI (writes back to `backend/app/config.yml`), or edit `config.yml` directly and restart the backend.

## API endpoints
- `GET /api/status` — full summary + all target statuses
- `GET /api/settings` — check interval, timeout, retries
- `POST /api/targets` — add a target `{name, host, port, protocol, expected_status, description}`
- `DELETE /api/targets/{name}` — remove a target
- `GET /api/health` — health check
# Network-Monitoring-Tool
# Network-Monitoring-Tool
