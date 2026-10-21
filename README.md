# HydroSecure

IoT-based water-flow monitoring and leak-detection system (Arduino, ESP32, dual flow sensors, React dashboard, FastAPI backend).

## Project structure

```
HydroSecure/
├── README.md
├── backend/           # FastAPI + SQLite API
└── frontend/          # React + Vite dashboard
```

## Prerequisites

- Node.js 20+
- Python 3.11+

## Backend (FastAPI + SQLite)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: http://127.0.0.1:8000/docs

### Run backend tests

```bash
cd backend
source .venv/bin/activate
pytest
```

## Frontend (dashboard)

In a **second terminal**:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

The Vite dev server proxies `/api` and `/ws` to `http://127.0.0.1:8000`.

### Dashboard data modes

| Mode | Description |
|------|-------------|
| **Local sim** | Browser-generated demo data (default) |
| **Backend** | Live data from FastAPI via REST + WebSocket |

In **Backend** mode, use **Start API sim** to feed the API with `source: simulated` readings, or POST hardware readings:

```bash
curl -X POST http://127.0.0.1:8000/api/readings \
  -H 'Content-Type: application/json' \
  -d '{"sensor1Lpm": 4.2, "sensor2Lpm": 3.9, "source": "hardware"}'
```

Export CSV: http://127.0.0.1:8000/api/export/csv

## Leak detection

Supply (Sensor A) minus branch (Sensor B) is evaluated with:

- Configurable warning / critical thresholds
- Consecutive abnormal samples before alerting
- Hysteresis on clear

Configure via `PATCH /api/config/leak` or environment variables (`HYDROSECURE_LEAK_*`).

## Environment (optional)

| Variable | Default |
|----------|---------|
| `HYDROSECURE_DATABASE_PATH` | `hydrosecure.db` |
| `HYDROSECURE_CORS_ORIGINS` | `http://localhost:5173,...` |
| `VITE_API_BASE_URL` | `` (use Vite proxy in dev) |
