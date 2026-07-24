# PMS

Mobile-first printer supply inventory and printer telemetry application, running on Supabase.

## Architecture

Three deployables. The split is forced by real constraints, not preference:

| Piece | Runs on | Source |
|---|---|---|
| API | Supabase Edge Function `pms` (Deno + Hono) | `supabase/functions/pms/` |
| PWA | Cloudflare Pages (static) | `frontend/` |
| SNMP collector | On-prem, Python | `app/collector.py` |

The PWA is **not** served by an Edge Function: Supabase has no static hosting, and serving a bundle from a
function costs a metered invocation per asset with no SPA deep-link fallback.

The collector stays Python and stays on-prem because it speaks SNMP over UDP to printers on the local
network, which no cloud runtime can reach.

Data lives in Supabase Postgres. Authentication is Supabase Auth (bearer JWT) — the API and the PWA are on
different origins, so a cookie would have to be `SameSite=None`, which iOS Safari and installed PWAs
routinely drop.

## Development

```powershell
# API
npx supabase functions serve pms
npx supabase db push                 # apply supabase/migrations

# PWA  (copy frontend/.env.example to frontend/.env.local first)
cd frontend; npm install; npm run dev
```

`http://localhost:5173` must be in the Edge Function's `ALLOWED_ORIGINS` secret — there is no dev proxy.

## Deploying

```powershell
npx supabase functions deploy pms --no-verify-jwt
```

`--no-verify-jwt` is required, not a shortcut: user routes carry a Supabase JWT while the collector
authenticates with `X-Collector-Token` and has no user session, so the platform-level gate would reject it.
Both lanes are enforced in the function's own middleware.

Required function secrets: `COLLECTOR_TOKEN` (collector routes fail closed without it) and `ALLOWED_ORIGINS`.
Optional: `TELEMETRY_STALE_MINUTES`, `PMS_EMAIL_DOMAIN`.

The PWA deploys from `frontend/` with build `npm run build` and publish directory `dist`, with
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_API_URL` set as build-time variables.

## Printer collector

Run from a machine that can reach the printers:

```powershell
python -m pip install -r requirements.txt
python -m app.collector --base-url https://<project>.supabase.co/functions/v1 --token <COLLECTOR_TOKEN> --once
```

The base URL stops at `/functions/v1` — the collector's paths already begin with `/pms`, the function's name.
Drop `--once` for continuous collection (default interval five minutes).

See `CLAUDE.md` for the full architecture notes and the non-obvious constraints worth knowing before changing
anything.
