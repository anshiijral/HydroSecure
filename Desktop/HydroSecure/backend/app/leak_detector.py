from dataclasses import dataclass
from enum import Enum
from typing import Literal


class LeakSeverity(str, Enum):
    NONE = "none"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass(frozen=True)
class LeakConfig:
    warning_threshold: float = 1.8
    critical_threshold: float = 3.2
    consecutive_samples: int = 4
    hysteresis: float = 0.5


@dataclass
class LeakEvent:
    severity: Literal["warning", "critical"]
    delta_lpm: float
    message: str


def _raw_severity(delta: float, config: LeakConfig) -> LeakSeverity:
    if delta >= config.critical_threshold:
        return LeakSeverity.CRITICAL
    if delta >= config.warning_threshold:
        return LeakSeverity.WARNING
    return LeakSeverity.NONE


class LeakDetector:
    """Supply (A) minus branch (B) imbalance with consecutive samples and clear hysteresis."""

    def __init__(self, config: LeakConfig) -> None:
        self.config = config
        self.active_severity = LeakSeverity.NONE
        self._consecutive_warning = 0
        self._consecutive_critical = 0
        self._consecutive_clear = 0

    def reset(self) -> None:
        self.active_severity = LeakSeverity.NONE
        self._consecutive_warning = 0
        self._consecutive_critical = 0
        self._consecutive_clear = 0

    def _clear_threshold(self) -> float:
        if self.active_severity == LeakSeverity.CRITICAL:
            return self.config.critical_threshold - self.config.hysteresis
        if self.active_severity == LeakSeverity.WARNING:
            return self.config.warning_threshold - self.config.hysteresis
        return 0.0

    def _make_event(self, severity: Literal["warning", "critical"], delta: float) -> LeakEvent:
        message = (
            "Critical leak signature — supply exceeds branch flow beyond safe threshold."
            if severity == "critical"
            else "Possible leak — flow imbalance detected between sensors."
        )
        return LeakEvent(severity=severity, delta_lpm=round(delta, 2), message=message)

    def process(self, delta_lpm: float) -> tuple[LeakSeverity, LeakEvent | None]:
        raw = _raw_severity(delta_lpm, self.config)
        new_event: LeakEvent | None = None
        prev_active = self.active_severity

        if raw == LeakSeverity.CRITICAL:
            self._consecutive_critical += 1
            self._consecutive_warning = 0
            self._consecutive_clear = 0
        elif raw == LeakSeverity.WARNING:
            self._consecutive_warning += 1
            self._consecutive_critical = 0
            self._consecutive_clear = 0
        else:
            self._consecutive_warning = 0
            self._consecutive_critical = 0
            if self.active_severity != LeakSeverity.NONE:
                if delta_lpm <= self._clear_threshold():
                    self._consecutive_clear += 1
                    if self._consecutive_clear >= self.config.consecutive_samples:
                        self.active_severity = LeakSeverity.NONE
                        self._consecutive_clear = 0
                else:
                    self._consecutive_clear = 0
            else:
                self._consecutive_clear = 0

        if self.active_severity != LeakSeverity.CRITICAL:
            if self._consecutive_critical >= self.config.consecutive_samples:
                self.active_severity = LeakSeverity.CRITICAL
                new_event = self._make_event("critical", delta_lpm)

        if (
            new_event is None
            and self.active_severity == LeakSeverity.NONE
            and self._consecutive_warning >= self.config.consecutive_samples
        ):
            self.active_severity = LeakSeverity.WARNING
            new_event = self._make_event("warning", delta_lpm)

        if prev_active == LeakSeverity.WARNING and self.active_severity == LeakSeverity.CRITICAL and new_event:
            pass

        return self.active_severity, new_event
