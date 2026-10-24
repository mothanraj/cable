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

Copy `.env.example` to `.env` and set DB + JWT secrets.

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

Migrations remain in `D:\cable\database` (Node-based migrator is fine; SQL is language-agnostic):

```powershell
cd D:\cable\database
npm run migrate
npm run seed
```

## Notes
- React client (`client/`) is unchanged; `VITE_API_URL=http://localhost:5000/api/v1`
- Legacy Node Express code (if present) is not used; Python is the API runtime
