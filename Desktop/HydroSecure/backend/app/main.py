import asyncio
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from app.config import settings
from app.schemas import (
    DashboardSnapshot,
    LeakAlert,
    LeakConfigIn,
    LeakConfigOut,
    ReadingIn,
    ReadingInLegacy,
)
from app.service import HydroSecureService
from app.ws_hub import hub

service = HydroSecureService()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    service.close()


app = FastAPI(title="HydroSecure API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_service() -> HydroSecureService:
    return service


async def _broadcast_reading(sample_dict: dict[str, Any], alert: LeakAlert | None, severity: str) -> None:
    await hub.broadcast("reading", {"sample": sample_dict, "leakSeverity": severity})
    if alert is not None:
        await hub.broadcast("alert", alert.model_dump())
    await hub.broadcast("status", service.get_current().model_dump())


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/readings/current")
def current_readings(svc: HydroSecureService = Depends(get_service)):
    return svc.get_current()


@app.get("/api/readings/history")
def reading_history(
    limit: int = Query(60, ge=1, le=500),
    since: int | None = Query(None, description="Unix ms"),
    svc: HydroSecureService = Depends(get_service),
):
    return svc.get_history(limit=limit, since_ms=since)


@app.post("/api/readings")
async def post_reading(body: dict[str, Any], svc: HydroSecureService = Depends(get_service)):
    try:
        if "sensor1Lpm" in body or "sensor2Lpm" in body:
            reading = ReadingInLegacy.model_validate(body).to_standard()
        else:
            reading = ReadingIn.model_validate(body)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    sample, alert, severity = svc.ingest_reading(reading)
    await _broadcast_reading(sample.model_dump(), alert, severity.value)
    return {"sample": sample, "alert": alert, "leakSeverity": severity}


@app.get("/api/alerts")
def list_alerts(limit: int = Query(8, ge=1, le=100), svc: HydroSecureService = Depends(get_service)):
    return svc.get_alerts(limit=limit)


@app.delete("/api/alerts/{alert_id}")
def dismiss_alert(alert_id: str, svc: HydroSecureService = Depends(get_service)):
    if not svc.dismiss_alert(alert_id):
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"ok": True}


@app.get("/api/devices/status")
def device_status(svc: HydroSecureService = Depends(get_service)):
    return svc.get_devices()


@app.get("/api/dashboard")
def dashboard_snapshot(
    limit: int = Query(60, ge=1, le=500),
    svc: HydroSecureService = Depends(get_service),
) -> DashboardSnapshot:
    snap = svc.get_snapshot(history_limit=limit)
    return snap


@app.get("/api/export/csv", response_class=PlainTextResponse)
def export_csv(
    since: int | None = Query(None),
    until: int | None = Query(None),
    svc: HydroSecureService = Depends(get_service),
):
    csv_text = svc.export_csv(since_ms=since, until_ms=until)
    return PlainTextResponse(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=hydrosecure_readings.csv"},
    )


@app.get("/api/config/leak", response_model=LeakConfigOut)
def get_leak_config(svc: HydroSecureService = Depends(get_service)):
    return svc.get_leak_config()


@app.patch("/api/config/leak", response_model=LeakConfigOut)
def patch_leak_config(patch: LeakConfigIn, svc: HydroSecureService = Depends(get_service)):
    return svc.update_leak_config(patch)


@app.websocket("/ws/updates")
async def ws_updates(websocket: WebSocket):
    await hub.connect(websocket)
    try:
        snap = service.get_snapshot()
        await websocket.send_json({"type": "snapshot", "payload": snap.model_dump()})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await hub.disconnect(websocket)


# --- Optional server-side simulator (feeds API with source=simulated) ---

_sim_task: asyncio.Task[None] | None = None
_sim_running = False


def _sim_tick(prev1: float, prev2: float, tick: int) -> tuple[float, float]:
    import math
    import random

    hour = time.localtime().tm_hour
    daily = 0.85 + 0.35 * math.sin((hour / 24) * math.pi * 2)
    burst = math.sin(tick * 0.08) * 0.4
    leak_phase = math.sin(tick * 0.015)
    leak_active = leak_phase > 0.72
    target1 = 4.2 * daily + burst + (2.8 if leak_active else 0)
    target2 = 4.0 * daily + burst * 0.95
    if leak_active:
        target2 = max(1.2, target2 - 2.4 - abs(leak_phase) * 0.8)
    s1 = max(0, min(12, prev1 * 0.65 + target1 * 0.35 + (random.random() - 0.5) * 0.25))
    s2 = max(0, min(12, prev2 * 0.65 + target2 * 0.35 + (random.random() - 0.5) * 0.22))
    return round(s1, 2), round(s2, 2)


async def _sim_loop() -> None:
    global _sim_running
    tick = 0
    s1, s2 = 3.8, 3.6
    while _sim_running:
        tick += 1
        s1, s2 = _sim_tick(s1, s2, tick)
        reading = ReadingIn.model_validate(
            {"sensorALpm": s1, "sensorBLpm": s2, "source": "simulated"},
        )
        sample, alert, severity = service.ingest_reading(reading)
        await _broadcast_reading(sample.model_dump(), alert, severity.value)
        await asyncio.sleep(1)


@app.post("/api/simulation/start")
async def start_server_simulation():
    global _sim_task, _sim_running
    if _sim_running:
        return {"running": True}
    _sim_running = True
    _sim_task = asyncio.create_task(_sim_loop())
    return {"running": True}


@app.post("/api/simulation/stop")
async def stop_server_simulation():
    global _sim_task, _sim_running
    _sim_running = False
    if _sim_task is not None:
        _sim_task.cancel()
        try:
            await _sim_task
        except asyncio.CancelledError:
            pass
        _sim_task = None
    return {"running": False}


@app.get("/api/simulation/status")
def simulation_status():
    return {"running": _sim_running}
