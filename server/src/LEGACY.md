# Legacy Node.js Express backend

The active API is Python FastAPI under `app/`.

This `src/` folder is retained only as temporary reference during migration.
Do not run `npm run dev` for the API.

Run the Python API instead:

```powershell
cd D:\cable\server
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 5000
```
