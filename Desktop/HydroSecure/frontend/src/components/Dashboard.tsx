import { useMemo } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { DeviceStatus } from './DeviceStatus'
import { FlowComparisonChart } from './FlowComparisonChart'
import { FlowRateCard } from './FlowRateCard'
import { Header } from './Header'
import { LeakAlerts } from './LeakAlerts'
import { SimulationBanner } from './SimulationBanner'

export function Dashboard() {
  const data = useDashboardData()

  const trend1 = useMemo(() => {
    const prev = data.samples.at(-2)?.sensor1Lpm ?? data.sensor1Lpm
    return data.sensor1Lpm - prev
  }, [data.samples, data.sensor1Lpm])

  const trend2 = useMemo(() => {
    const prev = data.samples.at(-2)?.sensor2Lpm ?? data.sensor2Lpm
    return data.sensor2Lpm - prev
  }, [data.samples, data.sensor2Lpm])

  const delta = data.sensor1Lpm - data.sensor2Lpm

  return (
    <div className="app-shell">
      <SimulationBanner
        mode={data.mode}
        onModeChange={data.setMode}
        running={data.running}
        onToggleRunning={data.toggleRunning}
        dataLabel={data.dataLabel}
        connected={data.connected}
        backendError={data.backendError}
        serverSimRunning={data.serverSimRunning}
        onToggleServerSim={data.toggleServerSimulation}
      />
      <Header
        leakSeverity={data.leakSeverity}
        lastUpdated={data.lastUpdated}
        running={data.running}
      />
      <main className="dashboard">
        <div className="flow-cards">
          <FlowRateCard
            title="Sensor A"
            subtitle="Main supply line"
            lpm={data.sensor1Lpm}
            accent="cyan"
            trend={trend1}
          />
          <FlowRateCard
            title="Sensor B"
            subtitle="Branch / return line"
            lpm={data.sensor2Lpm}
            accent="teal"
            trend={trend2}
          />
        </div>
        <div className="dashboard__grid">
          <FlowComparisonChart samples={data.samples} running={data.running} />
          <aside className="dashboard__side">
            <LeakAlerts
              alerts={data.alerts}
              leakSeverity={data.leakSeverity}
              onDismiss={data.dismissAlert}
            />
            <DeviceStatus
              devices={data.devices}
              totalVolumeLiters={data.totalVolumeLiters}
              deltaLpm={delta}
              dataOrigin={data.dataOrigin}
              lastReadingSource={data.lastReadingSource}
            />
          </aside>
        </div>
      </main>
      <footer className="footer">
        HydroSecure · React dashboard + FastAPI backend · Arduino + ESP32 firmware pending
      </footer>
    </div>
  )
}
