import sqlite3
from pathlib import Path
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recorded_at INTEGER NOT NULL,
    sensor_a_lpm REAL NOT NULL,
    sensor_b_lpm REAL NOT NULL,
    delta_lpm REAL NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('hardware', 'simulated'))
);

CREATE INDEX IF NOT EXISTS idx_readings_recorded_at ON readings(recorded_at);

CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
    message TEXT NOT NULL,
    delta_lpm REAL NOT NULL,
    detected_at INTEGER NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('hardware', 'simulated')),
    dismissed INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_alerts_detected_at ON alerts(detected_at);

CREATE TABLE IF NOT EXISTS device_state (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    role TEXT NOT NULL,
    detail TEXT NOT NULL,
    last_seen_at INTEGER,
    last_source TEXT
);
"""


def connect(db_path: str) -> sqlite3.Connection:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    conn.commit()
    _seed_devices(conn)


def _seed_devices(conn: sqlite3.Connection) -> None:
    defaults: list[tuple[Any, ...]] = [
        ("esp32", "ESP32 Gateway", "Wi‑Fi / MQTT bridge", "Awaiting hardware telemetry"),
        ("arduino", "Arduino Uno", "Pulse counting", "Awaiting hardware telemetry"),
        ("s1", "Flow Sensor A", "Main supply line", "YF-S201 · GPIO 2"),
        ("s2", "Flow Sensor B", "Branch / return", "YF-S201 · GPIO 3"),
    ]
    for row in defaults:
        conn.execute(
            """
            INSERT OR IGNORE INTO device_state (id, label, role, detail, last_seen_at, last_source)
            VALUES (?, ?, ?, ?, NULL, NULL)
            """,
            row,
        )
    conn.commit()
