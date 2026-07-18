# PMS startup cheat sheet

Run these commands from the repository root in PowerShell.

## First-time setup

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }

python -m pip install -r requirements.txt

Set-Location frontend
npm install
npm run build
Set-Location ..
```

## Start the complete app

FastAPI serves both the API and the compiled React application:

```powershell
python -m uvicorn app.main:app --reload
```

Open:

- App: http://127.0.0.1:8000
- API documentation: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/health

Default local login:

```text
Username: admin
Password: admin12345
```

## Frontend hot-reload mode

Keep FastAPI running, then open another PowerShell terminal:

```powershell
Set-Location frontend
npm run dev
```

Open http://localhost:5173. Vite forwards `/pms` and `/health` requests to FastAPI on port `8000`.

## After changing frontend code

Rebuild the files served by FastAPI:

```powershell
Set-Location frontend
npm run build
Set-Location ..
```

## Run verification

```powershell
python -m pytest -q

Set-Location frontend
npm test
npm run build
Set-Location ..
```

## Reset the local database

Stop FastAPI first. This permanently removes local users, stock, movements, and telemetry. The catalog and default administrator are recreated on the next startup.

```powershell
Remove-Item -LiteralPath .\pms.db, .\pms.db-shm, .\pms.db-wal -Force -ErrorAction SilentlyContinue
```

## Run one collector cycle

Run this from a machine that can reach the printers:

```powershell
python -m app.collector `
  --base-url http://127.0.0.1:8000 `
  --token local-collector-secret `
  --once
```

For continuous collection, remove `--once`. The default interval is five minutes.
