# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PMS is a mobile-first printer supply inventory and printer telemetry app, running on Supabase.

Three deployables, and the split is not negotiable — each piece is where it is for a hard reason:

| Piece | Where | Why not elsewhere |
|---|---|---|
| API (`/pms/*`) | Supabase Edge Function `pms` (Deno/Hono) — `supabase/functions/pms/` | — |
| React PWA | Cloudflare Pages, static build of `frontend/` | Supabase has **no static hosting**. Serving the bundle from an Edge Function burns a metered invocation per asset and has no SPA deep-link fallback. |
| SNMP collector | On-prem, still Python — `app/collector.py` | It speaks SNMP/**UDP to printers on the LAN**. Supabase's cloud cannot reach that network, and this is why "everything in TypeScript" is not achievable. |

Data lives in Supabase Postgres (project `vhnlvowjqkolpbcbuylr`). The old FastAPI service that served both API
and PWA is being retired; see "Retiring the FastAPI service" below for what is left to remove.

**The API and the PWA are on different origins.** That is the single fact that shapes auth: cookies would have
to be `SameSite=None`, which iOS Safari and installed PWAs routinely drop, so authentication is a bearer JWT
from Supabase Auth. A bearer token is not CSRF-able, which is why the old `Origin == Host` middleware is gone
and a CORS allowlist replaced it.

## Commands

### API (Edge Function)

```powershell
npx supabase functions serve pms                  # run locally
npx supabase functions deploy pms --no-verify-jwt  # deploy
npx supabase db push                               # apply migrations in supabase/migrations
```

`--no-verify-jwt` is **required, not a shortcut**. Two auth lanes coexist and the platform gate only understands
one: user routes carry a Supabase JWT, the collector authenticates with `X-Collector-Token` and has no user
session. Platform-level verification would reject the collector outright. Both lanes are enforced in the
middleware in `supabase/functions/pms/index.ts` — never "fix" this by turning verification back on.

Secrets the function needs: `COLLECTOR_TOKEN` (required — collector routes fail closed without it),
`ALLOWED_ORIGINS` (comma-separated CORS allowlist), optionally `TELEMETRY_STALE_MINUTES` and `PMS_EMAIL_DOMAIN`.
`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### Frontend (run from `frontend/`)

```powershell
npm install
npm run dev        # Vite dev server on :5173 (no proxy - talks to the deployed API via CORS)
npm run build       # tsc -b && vite build -> emits frontend/dist (what Cloudflare Pages publishes)
npm test             # vitest run
```

Copy `.env.example` to `.env.local` first; the build needs `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and
`VITE_API_URL`. `npm run lint` is currently broken — the `eslint .` script has never had an `eslint.config.js`
in this repo, predating the Supabase migration.

### Printer collector

Runs on-prem, on a machine with network access to the printers:

```powershell
python -m app.collector --base-url https://vhnlvowjqkolpbcbuylr.supabase.co/functions/v1 --token <COLLECTOR_TOKEN> --once
```

The base URL stops at `/functions/v1`: the collector's request paths already start with `/pms` (the function's
name), so including it in the base URL doubles the segment. Drop `--once` for continuous collection (default
interval 5 minutes, `--interval` in seconds).

### Database

Schema and seed data are Supabase migrations in `supabase/migrations/*.sql`, applied with `supabase db push` or
the `apply_migration` MCP tool. Alembic has been retired. There is no local database any more — develop against
the Supabase project, or `supabase start` for a local stack.

## Architecture

### API request flow

- **`supabase/functions/pms/index.ts` is the whole API.** One "fat" function with internal Hono routing, not a
  function per endpoint: each deployed function cold-starts independently, so splitting them would multiply cold
  starts for nothing. `Hono().basePath('/pms')` matches the function's own name in the URL
  (`/functions/v1/pms/...`), which is why frontend paths like `/pms/dashboard` still work unchanged.
- Auth middleware splits on path: `/pms/collector/*` requires `X-Collector-Token` (constant-time compare);
  everything else resolves the caller through `pms_usuario_actual()`.
- `pms_usuario_actual()` is a `SECURITY DEFINER` function called **with the end user's JWT**, so PostgREST
  verifies the signature before `auth.uid()` resolves, and the function itself filters on `activo`. This gets
  the domain profile in one round trip instead of `getUser()` plus a select. Gotcha: because it returns a
  composite type, an unauthenticated call yields a **row of nulls, not zero rows** — check `data.id === null`.
- Everything else uses the `service_role` client, which bypasses the deny-all RLS.
- Zod schemas in `supabase/functions/pms/schemas.ts` keep the `*Read` vs `*Write`/`*Create`/`*Update` split from
  the old Pydantic models — follow it for new entities.
- Errors are `{ "detail": "..." }` in Spanish, because `frontend/src/lib/api.ts` surfaces `detail` straight to
  the user. Database functions raise `PTxxx` SQLSTATEs, which `unwrap()` maps onto HTTP status codes.

### Stock movements are database functions

`crear_transaccion` / `revertir_transaccion` (see `supabase/migrations/*_pms_movimientos.sql`) own the
read-modify-write of `pms_suministro.stock`. They replace a process-wide `threading.Lock` that only ever worked
because Render ran exactly one uvicorn worker — meaningless across N Edge Function instances.

Both take the same **global** advisory lock (`pg_advisory_xact_lock`). That is deliberate: "a reversal is only
allowed on the most-recent transaction" is a claim about the entire `pms_transaccion` table, so locking one
supply row would still let a concurrent movement elsewhere invalidate a reversal between its read of "latest"
and its insert. Serializing all movements is what the Python code already did; this app has a handful of
concurrent users. Verified under 20 parallel oversubscribed `salida` requests: stock floors at 0 and the
`stock_antes`/`stock_despues` chain stays contiguous.

### Data model

Spanish domain names throughout (`pms_usuario`, `pms_impresora`, `pms_suministro`, `pms_transaccion`) — match
this naming for new tables/fields rather than introducing English names. Key relationships:

- `pms_impresora` (printer model/catalog entry) → `pms_suministro` (consumable, e.g. toner/cartridge SKU) and →
  `pms_impresora_en_sitio` (a physical printer instance at a location, with its own IP).
- `pms_impresora_en_sitio` → `pms_telemetria_impresora` (one-to-one latest-snapshot telemetry: online status,
  toner levels, notifications — overwritten each collector cycle via upsert, never appended).
- `pms_suministro` → `pms_transaccion` (stock movement log: `entrada`/`salida`/`reversion_entrada`/
  `reversion_salida`). Every transaction records `stock_antes`/`stock_despues`, giving a full audit trail.
- `pms_usuario` is the **domain profile only** — `nombre`, `activo`, and the `usuario_id` the audit trail hangs
  off. Passwords and sessions live in `auth.users`, linked by `pms_usuario.auth_user_id`. Usernames map to
  synthetic emails `<username>@pms.local` so the login form can keep asking for a username.
- All `pms_*` tables have **RLS enabled with zero policies**. Deliberate, not an oversight: Supabase auto-exposes
  every `public` table at `/rest/v1`, so deny-all keeps the anon key out while `service_role` (used by the Edge
  Function) bypasses it. Do not add policies without a reason to.
- `pms_suministro.stock_bajo` is a **stored generated column** (`stock <= stock_minimo`). PostgREST cannot
  compare two columns in a filter, and doing it in the function would break server-side pagination.
- The `install_sql_server18_*.sh` scripts are unrelated leftover tooling for an MS ODBC driver.

**Creating auth users:** always go through the Auth admin API (`db.auth.admin.createUser`), never a hand-written
`INSERT` into `auth.users`. GoTrue scans `confirmation_token` / `recovery_token` / `email_change_token_new` /
`email_change` into non-nullable Go strings, and those columns have no defaults — a manual insert leaves them
NULL and every subsequent login fails with a 500 "Database error querying schema".

### SNMP collector (`app/pms/snmp_printer_service.py`, `app/collector.py`)

Two printer-family SNMP query implementations (`XeroxBWPrinterService` / `XeroxColorPrinterService`) know how to
walk vendor-specific OIDs for toner levels, tray/cartridge info, and page counts. `app/collector.py` fetches the
device list from `/pms/collector/devices`, queries each printer over SNMP concurrently, and posts results to
`/pms/collector/telemetry`, authenticating with `X-Collector-Token` rather than a user session.

This is the **only** Python left, and it stays Python: it needs SNMP/UDP access to the printer LAN, which no
cloud runtime has. It depends on nothing else in `app/` — only external libraries — so the rest of the FastAPI
tree can be deleted around it.

### Frontend (`frontend/src`)

- React 19 + TypeScript + Vite, React Router for navigation, TanStack Query for server state, Tailwind + a small
  shadcn/ui (`new-york` style, `@/components/ui`) component set, `react-hook-form` + `zod` for forms, PWA support
  via `vite-plugin-pwa`.
- `App.tsx` gates on the **Supabase session** (`onAuthStateChange`) *and* the `GET /pms/auth/me` profile: the
  session proves who you are, the profile carries `nombre`/`activo` and is what surfaces an account deactivated
  after its token was issued. All non-login pages are lazy-loaded.
- `src/lib/supabase.ts` owns the client and the `emailFor(username)` mapping. Login/logout/password updates go
  through `supabase.auth.*` directly — there are no `/auth/login` or `/auth/logout` endpoints any more.
- `src/lib/api.ts` is the sole fetch wrapper (`api<T>(path, options)`) — prefixes `VITE_API_URL` and attaches
  `Authorization: Bearer` from the current session (`getSession()` refreshes an expired token first). Throws
  `ApiError` with the backend's `detail`. Use it for all backend calls rather than raw `fetch`.
- Path alias `@` → `frontend/src` (configured in both `vite.config.ts` and `tsconfig`).
- **No dev proxy.** The API is an absolute cross-origin URL in every environment; `http://localhost:5173` has to
  be in the function's `ALLOWED_ORIGINS` for `npm run dev` to work.
- `public/_redirects` (`/* /index.html 200`) is what makes deep links survive a refresh on Cloudflare Pages,
  before the service worker's `navigateFallback` is active. Don't drop it.
- The APK download calls the API for a short-lived signed URL and then navigates; a plain `<a href>` would reach
  the private bucket without the bearer token.

## The FastAPI service is gone

It has been deleted — `app/main.py`, the routers, `app/db/`, `app/core/`, `app/auth/`, the sqlite models, the
`tests/` suite, `dockerfile`, `render.yaml` and `seed.sql` are all in git history only. The surviving Python is
exactly four files: `app/__init__.py`, `app/collector.py`, `app/pms/__init__.py` and
`app/pms/snmp_printer_service.py`. `requirements.txt` covers only the collector's direct imports.

Consequences worth knowing before "restoring" anything:

- There is **no local database and no Python test suite**. Backend behaviour is verified against the Supabase
  project (or `supabase start`), not sqlite.
- `app/db/models.py` no longer exists; `supabase/migrations/*.sql` is the only schema definition.
- **The Render service still has to be deleted manually**, along with its 1 GB disk, once Cloudflare Pages is
  confirmed serving the PWA. Deleting the source did not take Render down — it keeps serving its last build.

## Language/locale convention

User-facing strings (HTTP error `detail` messages, seed data, UI copy) are in Spanish; code identifiers mix
Spanish domain nouns (matching the DB schema) with English for generic/infra concerns. Keep new user-facing
strings and domain models consistent with this existing convention rather than switching to English.
