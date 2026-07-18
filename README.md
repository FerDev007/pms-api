# PMS

Mobile-first inventory and printer telemetry application. FastAPI serves both the authenticated API and the compiled React PWA.

## Local development

1. Copy `.env.example` to `.env` and change the secrets.
2. Install Python packages with `pip install -r requirements.txt`.
3. Install the frontend with `cd frontend && npm install`.
4. Start FastAPI with `uvicorn app.main:app --reload`.
5. Start Vite with `cd frontend && npm run dev`.

The default first account is configured by `BOOTSTRAP_USERNAME` and `BOOTSTRAP_PASSWORD` and is created only when the user table is empty.

## Printer collector

Run this command from a machine that can reach the printers:

```powershell
python -m app.collector --base-url https://YOUR-SERVICE.onrender.com --token YOUR_COLLECTOR_TOKEN
```

Use `--once` for a single collection cycle. The default interval is five minutes.

## Render

`render.yaml` provisions the Docker web service and a 1 GB persistent disk. Set `BOOTSTRAP_PASSWORD` during initial setup, then use the generated `COLLECTOR_TOKEN` for the local collector. SQLite is stored at `/var/data/pms.db`; keep the service at one instance.
