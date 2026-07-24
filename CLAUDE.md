# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PMS is a mobile-first printer supply inventory and printer telemetry app. A single FastAPI service serves both
the authenticated JSON API (`/pms/...`) and the compiled React PWA (everything else, via a catch-all SPA route).
There is no separate frontend deployment — `frontend/dist` is built and mounted by FastAPI itself.

## Commands

### Backend (run from repo root)

```powershell
python -m pip install -r requirements.txt        # install deps
python -m uvicorn app.main:app --reload           # run API (+ serves built frontend if present)
python -m pytest -q                               # run all backend tests
python -m pytest tests/test_api.py -q              # run the single backend test file
python -m alembic upgrade head                     # apply DB migrations
python -m alembic revision -m "message" --autogenerate   # create a new migration
```

There is one backend test file (`tests/test_api.py`), a single end-to-end flow test that drives the API through
`TestClient` (login → dashboard → stock movement → reversal → user management → collector telemetry upload).
It points `DATABASE_URL` at a throwaway sqlite file before importing `app.main`, so env vars must be set before
the `app` import — follow this pattern for any new backend tests instead of adding fixtures/conftest.

### Frontend (run from `frontend/`)

```powershell
npm install
npm run dev        # Vite dev server on :5173, proxies /pms and /health to :8000
npm run build       # tsc -b && vite build -> emits frontend/dist (what FastAPI serves)
npm run lint         # eslint .
npm test             # vitest run
```

After changing frontend code for a non-Vite-dev-server workflow (e.g. testing the FastAPI-served build directly),
rerun `npm run build` — FastAPI serves whatever is currently in `frontend/dist`, it does not rebuild automatically.

### Printer collector

The collector is a separate on-prem script (not run by the web service) that polls printers over SNMP on the
local network and pushes telemetry to the deployed API:

```powershell
python -m app.collector --base-url http://127.0.0.1:8000 --token <COLLECTOR_TOKEN> --once
```

Drop `--once` for continuous collection (default interval 5 minutes, `--interval` in seconds).

### Local DB reset

Stop the server first, then delete `pms.db`, `pms.db-shm`, `pms.db-wal`. The catalog (`seed.sql`) and default
admin user are recreated automatically on next startup.

## Architecture

### Backend request flow

- `app/main.py` builds the FastAPI app, runs schema creation + catalog seeding + admin bootstrap in `lifespan`,
  mounts `auth_router`, `api_router`, `collector_router`, and finally a catch-all `/{full_path:path}` route that
  serves files from `frontend/dist` (SPA fallback to `index.html`).
- A same-origin middleware in `main.py` rejects mutating requests (`POST/PUT/PATCH/DELETE`) whose `Origin` header
  doesn't match `Host` — this is the app's CSRF defense, since auth uses cookies rather than bearer tokens.
- **`app/pms/api.py` is the actual, current API** — all `/pms/*` routes (dashboard, impresoras, suministros,
  impresoras-en-sitio, transacciones, usuarios, apks, collector endpoints) live in this one file. Read/modify
  this file for any endpoint work.
- **`app/pms/router.py`, `app/pms/routers/*`, and `app/pms/service.py` are legacy/dead code** left over from an
  earlier modularization (see git history: routers were split out, then re-consolidated into `api.py`). Nothing
  in `app/main.py` imports them. Don't extend them by mistake — check `app/main.py`'s imports if unsure what's
  actually wired up.
- Auth is server-side cookie sessions, not JWT: `app/core/security.py` hashes tokens with `SESSION_COOKIE`
  (`pms_session`) and stores them in the `pms_sesion` table with an expiry; `get_current_user` is a FastAPI
  dependency applied to the whole `api_router`. `require_collector` is a separate dependency (checked via
  constant-time comparison against `COLLECTOR_TOKEN`) gating `collector_router`, used only by the external
  collector script, not by logged-in users.
- Stock-affecting endpoints (`create_transaction`, `revert_transaction`) hold a process-wide `threading.Lock`
  (`movement_lock`) around the read-modify-write of `Suministro.stock` — SQLite + a single web worker means this
  is the concurrency guard; a reversal is only allowed on the single most-recent transaction.
- Pydantic schemas (`app/pms/schemes.py`) are split `*Read` (ORM-backed via `ORMModel`/`from_attributes`) vs
  `*Write`/`*Create`/`*Update` (input validation) per entity — follow this naming split for new entities.

### Data model (`app/db/models.py`)

Spanish domain names throughout (`Usuario`, `Impresora`, `Suministro`, `Transaccion`, table prefix `pms_`) —
match this naming for new tables/fields rather than introducing English names. Key relationships:

- `Impresora` (printer model/catalog entry) → `Suministro` (consumable, e.g. toner/cartridge SKU) and →
  `ImpresoraEnSitio` (a physical printer instance at a location, with its own IP).
- `ImpresoraEnSitio` → `TelemetriaImpresora` (one-to-one latest-snapshot telemetry: online status, toner levels,
  notifications — overwritten each collector cycle, not appended).
- `Suministro` → `Transaccion` (stock movement log: `entrada`/`salida`/`reversion_entrada`/`reversion_salida`,
  see `TipoTransaccion` enum). Every transaction records `stock_antes`/`stock_despues`, giving a full audit trail.
- DB defaults to local SQLite (`sqlite:///./pms.db`) with WAL mode + FK enforcement configured on connect
  (`app/db/engine.py`). Production (Render) also uses SQLite, on a mounted persistent disk — see `render.yaml`
  and `dockerfile` (`DATABASE_URL=sqlite:////var/data/pms.db`). The `install_sql_server18_*.sh` scripts are
  unrelated leftover tooling for an MS ODBC driver, not part of the current DB story.
- Initial schema is a single Alembic migration (`migrations/versions/0001_sqlite_initial.py`); catalog seed data
  ships as raw SQL (`seed.sql`, executed via `executescript` in `app/db/seed.py`) plus a hardcoded Python list of
  site printers — seeding only runs when the `pms_impresora` table is empty.

### SNMP collector (`app/pms/snmp_printer_service.py`, `app/collector.py`)

Two printer-family SNMP query implementations (`XeroxBWPrinterService` / `XeroxColorPrinterService`) know how to
walk vendor-specific OIDs for toner levels, tray/cartridge info, and page counts. `app/collector.py` is a
standalone script (run outside the main app, on a machine with network access to the printers) that: fetches the
device list from `/pms/collector/devices`, queries each printer over SNMP concurrently, and posts results to
`/pms/collector/telemetry`. It authenticates with the `X-Collector-Token` header, not a user session.

### Frontend (`frontend/src`)

- React 19 + TypeScript + Vite, React Router for navigation, TanStack Query for server state, Tailwind + a small
  shadcn/ui (`new-york` style, `@/components/ui`) component set, `react-hook-form` + `zod` for forms, PWA support
  via `vite-plugin-pwa`.
- `App.tsx` gates the whole app on `GET /pms/auth/me` (via TanStack Query): unauthenticated renders `LoginPage`,
  authenticated renders the route tree inside `AppLayout`. All non-login pages are lazy-loaded.
- `src/lib/api.ts` is the sole fetch wrapper (`api<T>(path, options)`) — cookie-based (`credentials: 'include'`),
  throws `ApiError` with the backend's `detail` message on non-2xx. Use this for all backend calls rather than
  raw `fetch`.
- Path alias `@` → `frontend/src` (configured in both `vite.config.ts` and `tsconfig`).
- In dev, Vite proxies `/pms` and `/health` to `http://localhost:8000` — the FastAPI server must be running
  separately for `npm run dev` to work end-to-end.

## Language/locale convention

User-facing strings (HTTP error `detail` messages, seed data, UI copy) are in Spanish; code identifiers mix
Spanish domain nouns (matching the DB schema) with English for generic/infra concerns. Keep new user-facing
strings and domain models consistent with this existing convention rather than switching to English.
