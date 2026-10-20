from app.leak_detector import LeakConfig, LeakDetector, LeakSeverity


def test_consecutive_samples_required_before_warning():
    det = LeakDetector(LeakConfig(warning_threshold=1.8, consecutive_samples=3, hysteresis=0.5))
    sev, event = det.process(2.0)
    assert sev == LeakSeverity.NONE
    assert event is None
    sev, event = det.process(2.0)
    assert sev == LeakSeverity.NONE
    sev, event = det.process(2.0)
    assert sev == LeakSeverity.WARNING
    assert event is not None
    assert event.severity == "warning"


def test_critical_escalation():
    det = LeakDetector(LeakConfig(critical_threshold=3.2, consecutive_samples=2, hysteresis=0.5))
    det.process(3.5)
    sev, event = det.process(3.5)
    assert sev == LeakSeverity.CRITICAL
    assert event is not None
    assert event.severity == "critical"


def test_hysteresis_clears_active_warning():
    det = LeakDetector(
        LeakConfig(warning_threshold=2.0, consecutive_samples=2, hysteresis=0.5),
    )
    det.process(2.5)
    det.process(2.5)
    assert det.active_severity == LeakSeverity.WARNING
    det.process(1.0)
    det.process(1.0)
    assert det.active_severity == LeakSeverity.NONE
