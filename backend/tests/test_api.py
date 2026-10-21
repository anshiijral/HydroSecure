def test_health(client):
    c, _ = client
    res = c.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_ingest_and_current(client):
    c, _ = client
    res = c.post(
        "/api/readings",
        json={"sensor1Lpm": 4.0, "sensor2Lpm": 3.8, "source": "hardware"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["sample"]["sensor1Lpm"] == 4.0
    assert body["sample"]["source"] == "hardware"

    cur = c.get("/api/readings/current").json()
    assert cur["sensor1Lpm"] == 4.0
    assert cur["dataOrigin"] == "hardware"


def test_simulated_vs_hardware_origin(client):
    c, _ = client
    c.post("/api/readings", json={"sensorALpm": 3.0, "sensorBLpm": 3.0, "source": "simulated"})
    c.post("/api/readings", json={"sensorALpm": 3.1, "sensorBLpm": 3.0, "source": "hardware"})
    cur = c.get("/api/readings/current").json()
    assert cur["dataOrigin"] == "mixed"


def test_history_and_csv_export(client):
    c, _ = client
    for i in range(3):
        c.post(
            "/api/readings",
            json={"sensorALpm": 3.0 + i * 0.1, "sensorBLpm": 2.9, "source": "simulated"},
        )
    hist = c.get("/api/readings/history", params={"limit": 10}).json()
    assert len(hist) == 3
    csv_res = c.get("/api/export/csv")
    assert csv_res.status_code == 200
    assert "sensor_a_lpm" in csv_res.text
    assert csv_res.headers["content-type"].startswith("text/csv")


def test_leak_alert_on_imbalance(client):
    c, _ = client
    for _ in range(4):
        res = c.post(
            "/api/readings",
            json={"sensorALpm": 6.0, "sensorBLpm": 2.0, "source": "hardware"},
        )
    assert res.status_code == 200
    alerts = c.get("/api/alerts").json()
    assert len(alerts) >= 1
    assert alerts[0]["severity"] in ("warning", "critical")
    assert alerts[0]["source"] == "hardware"


def test_dismiss_alert(client):
    c, _ = client
    for _ in range(4):
        c.post("/api/readings", json={"sensorALpm": 6.0, "sensorBLpm": 2.0, "source": "hardware"})
    alert_id = c.get("/api/alerts").json()[0]["id"]
    assert c.delete(f"/api/alerts/{alert_id}").status_code == 200
    assert c.get("/api/alerts").json() == []


def test_devices_status(client):
    c, _ = client
    c.post("/api/readings", json={"sensorALpm": 3.5, "sensorBLpm": 3.4, "source": "hardware"})
    devices = c.get("/api/devices/status").json()
    assert len(devices) == 4
    assert any(d["id"] == "esp32" for d in devices)


def test_dashboard_snapshot(client):
    c, _ = client
    c.post("/api/readings", json={"sensorALpm": 3.2, "sensorBLpm": 3.1, "source": "simulated"})
    snap = c.get("/api/dashboard").json()
    assert "current" in snap
    assert "samples" in snap
    assert snap["current"]["source"] == "simulated"
