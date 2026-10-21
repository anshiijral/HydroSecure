from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class DataSource(str, Enum):
    HARDWARE = "hardware"
    SIMULATED = "simulated"


class LeakSeverity(str, Enum):
    NONE = "none"
    WARNING = "warning"
    CRITICAL = "critical"


class DeviceConnection(str, Enum):
    ONLINE = "online"
    DEGRADED = "degraded"
    OFFLINE = "offline"


class ReadingIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    sensor_a_lpm: float = Field(alias="sensorALpm", ge=0, le=50)
    sensor_b_lpm: float = Field(alias="sensorBLpm", ge=0, le=50)
    source: DataSource = DataSource.HARDWARE
    timestamp_ms: int | None = Field(default=None, alias="timestamp")


class ReadingInLegacy(BaseModel):
    """Accept sensor1Lpm / sensor2Lpm from firmware-style payloads."""

    model_config = ConfigDict(populate_by_name=True)

    sensor1_lpm: float = Field(alias="sensor1Lpm", ge=0, le=50)
    sensor2_lpm: float = Field(alias="sensor2Lpm", ge=0, le=50)
    source: DataSource = DataSource.HARDWARE
    timestamp_ms: int | None = Field(default=None, alias="timestamp")

    def to_standard(self) -> ReadingIn:
        return ReadingIn(
            sensorALpm=self.sensor1_lpm,
            sensorBLpm=self.sensor2_lpm,
            source=self.source,
            timestamp=self.timestamp_ms,
        )


class FlowSample(BaseModel):
    timestamp: int
    sensor1Lpm: float
    sensor2Lpm: float
    source: DataSource
    deltaLpm: float


class LeakAlert(BaseModel):
    id: str
    severity: Literal["warning", "critical"]
    message: str
    deltaLpm: float
    detectedAt: int
    source: DataSource


class DeviceInfo(BaseModel):
    id: str
    label: str
    role: str
    connection: DeviceConnection
    detail: str
    lastSeenAt: int | None = None


class CurrentReadings(BaseModel):
    sensor1Lpm: float
    sensor2Lpm: float
    deltaLpm: float
    leakSeverity: LeakSeverity
    source: DataSource | None
    lastUpdated: int | None
    totalVolumeLiters: float
    dataOrigin: Literal["hardware", "simulated", "mixed", "none"]


class DashboardSnapshot(BaseModel):
    current: CurrentReadings
    samples: list[FlowSample]
    alerts: list[LeakAlert]
    devices: list[DeviceInfo]


class LeakConfigOut(BaseModel):
    warningThreshold: float
    criticalThreshold: float
    consecutiveSamples: int
    hysteresis: float


class LeakConfigIn(BaseModel):
    warningThreshold: float | None = None
    criticalThreshold: float | None = None
    consecutiveSamples: int | None = Field(default=None, ge=1, le=60)
    hysteresis: float | None = Field(default=None, ge=0, le=5)


class WsMessage(BaseModel):
    type: Literal["reading", "alert", "status"]
    payload: dict
