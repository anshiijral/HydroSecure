import csv
import io
import time
import uuid
from typing import Any

from app.config import settings
from app.database import init_db
from app.leak_detector import LeakConfig, LeakDetector
from app.schemas import (
    CurrentReadings,
    DashboardSnapshot,
    DataSource,
    DeviceConnection,
    DeviceInfo,
    FlowSample,
    LeakAlert,
    LeakConfigIn,
    LeakConfigOut,
    LeakSeverity,
    ReadingIn,
)


class HydroSecureService:
    def __init__(self, db_path: str | None = None) -> None:
        import sqlite3

        from app.database import connect

        self.db_path = db_path or settings.database_path
        self.conn = connect(self.db_path)
        init_db(self.conn)
        self.leak_config = LeakConfig(
            warning_threshold=settings.leak_warning_threshold,
            critical_threshold=settings.leak_critical_threshold,
            consecutive_samples=settings.leak_consecutive_samples,
            hysteresis=settings.leak_hysteresis,
        )
        self.detector = LeakDetector(self.leak_config)

    def close(self) -> None:
        self.conn.close()

    def update_leak_config(self, patch: LeakConfigIn) -> LeakConfigOut:
        if patch.warningThreshold is not None:
            self.leak_config = LeakConfig(
                warning_threshold=patch.warningThreshold,
                critical_threshold=self.leak_config.critical_threshold,
                consecutive_samples=self.leak_config.consecutive_samples,
                hysteresis=self.leak_config.hysteresis,
            )
        if patch.criticalThreshold is not None:
            self.leak_config = LeakConfig(
                warning_threshold=self.leak_config.warning_threshold,
                critical_threshold=patch.criticalThreshold,
                consecutive_samples=self.leak_config.consecutive_samples,
                hysteresis=self.leak_config.hysteresis,
            )
        if patch.consecutiveSamples is not None:
            self.leak_config = LeakConfig(
                warning_threshold=self.leak_config.warning_threshold,
                critical_threshold=self.leak_config.critical_threshold,
                consecutive_samples=patch.consecutiveSamples,
                hysteresis=self.leak_config.hysteresis,
            )
        if patch.hysteresis is not None:
            self.leak_config = LeakConfig(
                warning_threshold=self.leak_config.warning_threshold,
                critical_threshold=self.leak_config.critical_threshold,
                consecutive_samples=self.leak_config.consecutive_samples,
                hysteresis=patch.hysteresis,
            )
        self.detector = LeakDetector(self.leak_config)
        return self.get_leak_config()

    def get_leak_config(self) -> LeakConfigOut:
        return LeakConfigOut(
            warningThreshold=self.leak_config.warning_threshold,
            criticalThreshold=self.leak_config.critical_threshold,
            consecutiveSamples=self.leak_config.consecutive_samples,
            hysteresis=self.leak_config.hysteresis,
        )

    def ingest_reading(self, reading: ReadingIn) -> tuple[FlowSample, LeakAlert | None, LeakSeverity]:
        ts = reading.timestamp_ms or int(time.time() * 1000)
        delta = round(reading.sensor_a_lpm - reading.sensor_b_lpm, 2)
        source = reading.source.value

        self.conn.execute(
            """
            INSERT INTO readings (recorded_at, sensor_a_lpm, sensor_b_lpm, delta_lpm, source)
            VALUES (?, ?, ?, ?, ?)
            """,
            (ts, reading.sensor_a_lpm, reading.sensor_b_lpm, delta, source),
        )

        severity, event = self.detector.process(delta)
        alert: LeakAlert | None = None
        if event is not None:
            alert_id = f"{ts}-{event.severity}-{uuid.uuid4().hex[:8]}"
            self.conn.execute(
                """
                INSERT INTO alerts (id, severity, message, delta_lpm, detected_at, source, dismissed)
                VALUES (?, ?, ?, ?, ?, ?, 0)
                """,
                (alert_id, event.severity, event.message, event.delta_lpm, ts, source),
            )
            alert = LeakAlert(
                id=alert_id,
                severity=event.severity,
                message=event.message,
                deltaLpm=event.delta_lpm,
                detectedAt=ts,
                source=reading.source,
            )

        self._touch_devices(reading.source, ts)
        self.conn.commit()

        sample = FlowSample(
            timestamp=ts,
            sensor1Lpm=round(reading.sensor_a_lpm, 2),
            sensor2Lpm=round(reading.sensor_b_lpm, 2),
            source=reading.source,
            deltaLpm=delta,
        )
        return sample, alert, LeakSeverity(severity.value)

    def _touch_devices(self, source: DataSource, ts: int) -> None:
        detail_hw = "Live hardware telemetry"
        detail_sim = "Server-side simulated stream"
        detail = detail_hw if source == DataSource.HARDWARE else detail_sim
        for dev_id in ("esp32", "arduino", "s1", "s2"):
            self.conn.execute(
                """
                UPDATE device_state
                SET last_seen_at = ?, last_source = ?, detail = ?
                WHERE id = ?
                """,
                (ts, source.value, detail if dev_id in ("s1", "s2") else detail, dev_id),
            )

    def get_history(self, limit: int = 60, since_ms: int | None = None) -> list[FlowSample]:
        query = """
            SELECT recorded_at, sensor_a_lpm, sensor_b_lpm, delta_lpm, source
            FROM readings
        """
        params: list[Any] = []
        if since_ms is not None:
            query += " WHERE recorded_at >= ?"
            params.append(since_ms)
        query += " ORDER BY recorded_at DESC LIMIT ?"
        params.append(limit)
        rows = self.conn.execute(query, params).fetchall()
        samples = [
            FlowSample(
                timestamp=row["recorded_at"],
                sensor1Lpm=row["sensor_a_lpm"],
                sensor2Lpm=row["sensor_b_lpm"],
                deltaLpm=row["delta_lpm"],
                source=DataSource(row["source"]),
            )
            for row in rows
        ]
        samples.reverse()
        return samples

    def get_alerts(self, limit: int = 8, include_dismissed: bool = False) -> list[LeakAlert]:
        query = """
            SELECT id, severity, message, delta_lpm, detected_at, source
            FROM alerts
        """
        if not include_dismissed:
            query += " WHERE dismissed = 0"
        query += " ORDER BY detected_at DESC LIMIT ?"
        rows = self.conn.execute(query, (limit,)).fetchall()
        return [
            LeakAlert(
                id=row["id"],
                severity=row["severity"],
                message=row["message"],
                deltaLpm=row["delta_lpm"],
                detectedAt=row["detected_at"],
                source=DataSource(row["source"]),
            )
            for row in rows
        ]

    def dismiss_alert(self, alert_id: str) -> bool:
        cur = self.conn.execute(
            "UPDATE alerts SET dismissed = 1 WHERE id = ? AND dismissed = 0",
            (alert_id,),
        )
        self.conn.commit()
        return cur.rowcount > 0

    def _connection_for(self, last_seen: int | None, last_source: str | None) -> DeviceConnection:
        if last_seen is None:
            return DeviceConnection.OFFLINE
        age_s = (time.time() * 1000 - last_seen) / 1000
        if age_s > settings.hardware_offline_seconds:
            return DeviceConnection.OFFLINE
        if last_source == DataSource.SIMULATED.value:
            return DeviceConnection.DEGRADED
        return DeviceConnection.ONLINE

    def get_devices(self) -> list[DeviceInfo]:
        rows = self.conn.execute(
            "SELECT id, label, role, detail, last_seen_at, last_source FROM device_state ORDER BY id"
        ).fetchall()
        devices: list[DeviceInfo] = []
        for row in rows:
            conn = self._connection_for(row["last_seen_at"], row["last_source"])
            devices.append(
                DeviceInfo(
                    id=row["id"],
                    label=row["label"],
                    role=row["role"],
                    connection=conn,
                    detail=row["detail"],
                    lastSeenAt=row["last_seen_at"],
                )
            )
        return devices

    def _total_volume_liters(self) -> float:
        rows = self.conn.execute(
            "SELECT sensor_a_lpm, sensor_b_lpm, recorded_at FROM readings ORDER BY recorded_at ASC"
        ).fetchall()
        if len(rows) < 2:
            if len(rows) == 1:
                return 0.0
            return 0.0
        total = 0.0
        for i in range(1, len(rows)):
            prev = rows[i - 1]
            curr = rows[i]
            dt_s = max(0, (curr["recorded_at"] - prev["recorded_at"]) / 1000)
            avg_lpm = (prev["sensor_a_lpm"] + prev["sensor_b_lpm"] + curr["sensor_a_lpm"] + curr["sensor_b_lpm"]) / 4
            total += (avg_lpm / 60.0) * dt_s
        return round(total, 1)

    def _data_origin(self) -> str:
        row = self.conn.execute(
            """
            SELECT
              SUM(CASE WHEN source = 'hardware' THEN 1 ELSE 0 END) AS hw,
              SUM(CASE WHEN source = 'simulated' THEN 1 ELSE 0 END) AS sim
            FROM readings
            """
        ).fetchone()
        if not row or (row["hw"] or 0) + (row["sim"] or 0) == 0:
            return "none"
        if row["hw"] and row["sim"]:
            return "mixed"
        return "hardware" if row["hw"] else "simulated"

    def get_current(self) -> CurrentReadings:
        row = self.conn.execute(
            """
            SELECT recorded_at, sensor_a_lpm, sensor_b_lpm, delta_lpm, source
            FROM readings ORDER BY recorded_at DESC LIMIT 1
            """
        ).fetchone()
        if row is None:
            return CurrentReadings(
                sensor1Lpm=0.0,
                sensor2Lpm=0.0,
                deltaLpm=0.0,
                leakSeverity=LeakSeverity.NONE,
                source=None,
                lastUpdated=None,
                totalVolumeLiters=0.0,
                dataOrigin="none",
            )
        return CurrentReadings(
            sensor1Lpm=row["sensor_a_lpm"],
            sensor2Lpm=row["sensor_b_lpm"],
            deltaLpm=row["delta_lpm"],
            leakSeverity=LeakSeverity(self.detector.active_severity.value),
            source=DataSource(row["source"]),
            lastUpdated=row["recorded_at"],
            totalVolumeLiters=self._total_volume_liters(),
            dataOrigin=self._data_origin(),  # type: ignore[arg-type]
        )

    def get_snapshot(self, history_limit: int = 60) -> DashboardSnapshot:
        return DashboardSnapshot(
            current=self.get_current(),
            samples=self.get_history(limit=history_limit),
            alerts=self.get_alerts(limit=8),
            devices=self.get_devices(),
        )

    def export_csv(self, since_ms: int | None = None, until_ms: int | None = None) -> str:
        query = """
            SELECT recorded_at, sensor_a_lpm, sensor_b_lpm, delta_lpm, source
            FROM readings WHERE 1=1
        """
        params: list[Any] = []
        if since_ms is not None:
            query += " AND recorded_at >= ?"
            params.append(since_ms)
        if until_ms is not None:
            query += " AND recorded_at <= ?"
            params.append(until_ms)
        query += " ORDER BY recorded_at ASC"
        rows = self.conn.execute(query, params).fetchall()

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            ["recorded_at_ms", "sensor_a_lpm", "sensor_b_lpm", "delta_lpm", "source"],
        )
        for row in rows:
            writer.writerow(
                [
                    row["recorded_at"],
                    row["sensor_a_lpm"],
                    row["sensor_b_lpm"],
                    row["delta_lpm"],
                    row["source"],
                ],
            )
        return buf.getvalue()
