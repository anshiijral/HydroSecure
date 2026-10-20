# HydroSecure — Continuous Water Monitoring & Early Leak Detection

An IoT-inspired water monitoring and early leak detection system that simulates upstream and downstream flow sensors to identify abnormal flow imbalances, generate leak alerts, and visualize water-flow data in real time.

## Overview

HydroSecure demonstrates how an IoT-based pipeline monitoring system can detect potential water leakage by comparing flow measurements at two points in a pipeline. The application combines a real-time monitoring dashboard, a backend API, simulated sensor readings, and a configurable leak-detection algorithm.

**Note:** This is a software-only prototype. The Arduino, ESP32, and flow sensors are simulated; no physical hardware is required.

## Key Features

- **Real-Time Flow Monitoring:** Simulates two flow sensors and visualizes upstream and downstream flow rates.
- **Flow-Imbalance Analysis:** Calculates the difference between the two flow measurements to identify potential leaks.
- **Leak Detection:** Supports configurable thresholds, sustained-abnormal-reading checks, and alert recovery logic.
- **Interactive Dashboard:** Displays flow measurements, flow differences, system status, and leak alerts.
- **Device Simulation:** Represents the Arduino, ESP32 gateway, and flow sensors through simulated device-status indicators.
- **Backend API:** Uses FastAPI to process readings and provide application endpoints.
- **Data Persistence:** Uses SQLite for storing flow readings and alert events, where implemented.
- **Historical Analysis:** Supports reviewing monitoring data and exporting readings as CSV, where implemented.
- **Automated Testing:** Supports testing leak-detection rules and application behavior.

## System Architecture

```text
        Simulated Flow Sensor A
                   |
                   v
          Upstream Flow Rate
                   |
                   |
          Flow Imbalance Engine
                   |
                   |
          Downstream Flow Rate
                   ^
                   |
        Simulated Flow Sensor B
                   |
                   v
          Simulated ESP32 Gateway
                   |
                   v
             FastAPI Backend
                   |
            +------+------+
            |             |
            v             v
       SQLite DB      REST / WebSocket
                          |
                          v
                  React Dashboard
                          |
                          v
                Alerts and Analytics
```

The simulated sensor layer generates flow readings. The application processes these readings, evaluates flow imbalance, and presents monitoring results through the dashboard.

## Technology Stack

| Component | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Data Visualization | Recharts |
| Backend | Python, FastAPI |
| Database | SQLite |
| Communication | REST API, WebSocket (if enabled) |
| Simulation | Software-generated sensor readings |
| Testing | Pytest, frontend build checks |

## Leak Detection Logic

HydroSecure compares the flow rates measured at two points in a simulated pipeline.

Let:

- \(Q_A\) = upstream flow rate
- \(Q_B\) = downstream flow rate

The absolute flow difference is:

\[
\Delta Q = |Q_A-Q_B|
\]

When the upstream flow exceeds downstream flow, the system evaluates the imbalance against configurable thresholds.

The detection process can incorporate:

1. **Threshold evaluation:** Identifies flow differences that exceed acceptable limits.
2. **Persistence checking:** Requires abnormal readings to continue for a configured number of samples or duration.
3. **Moving averages:** Helps reduce sensitivity to short-lived fluctuations.
4. **Hysteresis:** Uses separate alert and recovery conditions to prevent repeated status changes near a threshold.
5. **Alert classification:** Distinguishes normal operation, warnings, critical imbalances, and sensor faults where supported.

A flow imbalance indicates a *potential leak*, not definitive proof of one. Sensor inaccuracies, legitimate water consumption, pipeline branches, and transient flow changes can also cause differences.

## Simulation Scenarios

The software can be evaluated against the following scenarios, subject to the implemented simulator:

| Scenario | Expected behavior |
|---|---|
| Normal flow | Both sensors report approximately matching flow rates. |
| Gradual leak | A persistent downstream flow reduction triggers an alert. |
| Sudden imbalance | A sharp flow difference is evaluated against alert thresholds. |
| Brief disturbance | A short-lived imbalance should not trigger a persistent-leak alert. |
| Sensor failure | Invalid or missing sensor data is identified where supported. |
| Low flow | The system avoids unreliable percentage calculations near zero flow. |
| Network interruption | Connectivity issues are represented and recovery behavior is tested where implemented. |

## Getting Started

### Prerequisites

- Node.js and npm
- Python 3.10 or a compatible version supported by the project dependencies
- Git

### 1. Clone the repository

```bash
git clone https://github.com/YOUR-USERNAME/HydroSecure.git
cd HydroSecure
```

Replace `YOUR-USERNAME` with your GitHub username.

### 2. Start the frontend

From the project root, navigate to the frontend directory:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed in the terminal, typically:

`http://localhost:5173`

### 3. Start the backend

Open a second terminal at the project root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Start the API using the application's FastAPI entry point. For example, if the entry point is `app.main`:

```bash
uvicorn app.main:app --reload --port 8000
```

If your project uses a different module or application variable, use the entry point specified in its README or source code.

The API documentation is typically available at:

`http://127.0.0.1:8000/docs`

**Important:** The frontend and backend startup commands depend on the actual repository structure and configuration. Confirm that the backend entry point, dependency file, and API settings match the commands above.

## Testing

Run the backend tests from the backend directory:

```bash
pytest
```

Build the frontend to check for compilation errors:

```bash
cd frontend
npm run build
```

Test the simulator with normal flow, sustained flow imbalance, brief disturbances, and sensor-failure scenarios. Confirm that alerts, stored records, and exported data match the expected behavior.

## Project Structure

```text
HydroSecure/
├── frontend/
│   ├── src/
│   ├── index.html
│   └── package.json
├── backend/
│   ├── app/
│   ├── tests/
│   └── requirements.txt
├── README.md
└── .gitignore
```

The exact structure may vary with the current implementation.

## Limitations

- Sensor measurements are simulated rather than collected from physical devices.
- The application does not establish that an actual pipeline leak exists.
- Detection accuracy depends on the simulation model, thresholds, and implemented validation logic.
- Real-world deployment would require hardware integration, sensor calibration, field testing, and additional fault-handling measures.

## Future Enhancements

- Integration with physical flow sensors and ESP32 devices.
- MQTT-based telemetry and device communication.
- Adaptive thresholds based on historical flow patterns.
- Anomaly detection using machine learning.
- Improved alert notifications and monitoring reports.
- Deployment using Docker and a cloud-hosted backend.

## Objective

HydroSecure explores how embedded-systems concepts, simulated IoT telemetry, backend services, data visualization, and rule-based anomaly detection can be combined into a practical water-monitoring application.

## Author

Developed as a software-based IoT and anomaly-detection project.


