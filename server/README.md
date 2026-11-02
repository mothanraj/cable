# Cable Customer Management API (Python / FastAPI)

## Stack
- Python 3.13+
- FastAPI + Uvicorn
- PostgreSQL (shared `database/` migrations)

## Setup

```powershell
cd D:\cable\server
python -m virtualenv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Copy the root `D:\cable\.env.example` to `D:\cable\.env` and set DB + JWT secrets. Both the API and the database scripts read this single file.

## Run

```powershell
cd D:\cable\server
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 5000
```

## Admin user

```powershell
cd D:\cable\server
.\.venv\Scripts\python.exe scripts\create_admin.py
.\.venv\Scripts\python.exe scripts\reset_admin_password.py

# Alternative (explicit module path):
# $env:PYTHONPATH = "D:\cable\server"
# .\.venv\Scripts\python.exe scripts\create_admin.py
```

## Database

Migrations remain in `D:\cable\database` (Node-based migrator is fine; SQL is language-agnostic). The scripts read `D:\cable\.env`:

```powershell
cd D:\cable\database
npm run migrate
npm run seed
```

## Supabase (hosted Postgres)

The API can run against Supabase using the Session pooler:

```env
DB_HOST=aws-0-<region>.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.<project-ref>
DB_PASSWORD=<supabase-db-password>
DB_SSLMODE=require
```

The database name on Supabase is `postgres`, not `customer_management`.
Apply migrations from `database/` after setting the root `D:\cable\.env` to the Supabase values.

After the initial migration, apply the Supabase-only security script:

```powershell
psql "<supabase-session-pooler-connection-string>" -f D:\cable\database\supabase\010_supabase_security.sql
```

This enables RLS and revokes access from the `anon`/`authenticated` roles.
The API connects as the `postgres` role, which bypasses RLS.

## Deploy (Render, single service)

The root `Dockerfile` builds the React client and serves it from FastAPI, so the
API and UI share one origin (`https://<service>.onrender.com`). This keeps the
refresh cookie same-origin and avoids CORS.

- Render service type: **Web Service**, runtime **Docker**.
- Root Directory: blank. Dockerfile Path: `./Dockerfile`.
- Health Check Path: `/api/v1/health`.
- Environment: `APP_ENV=production`, all `DB_*` values, `JWT_*` secrets, and
  `CLIENT_URL=https://<service>.onrender.com`. Do not set `PORT` or
  `VITE_API_URL` (the image builds the client against `/api/v1`).
- The client build is copied to `server/static` inside the image. FastAPI mounts
  it only when that directory exists, so local development is unchanged.

## Notes
- React client (`client/`): `VITE_API_URL=http://localhost:5000/api/v1` for local dev
- Legacy Node Express code (if present) is not used; Python is the API runtime
