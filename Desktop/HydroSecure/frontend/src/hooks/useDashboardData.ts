import { useCallback, useState } from 'react'
import type { DataSource, DeviceInfo, FlowSample, LeakAlert, LeakSeverity } from '../types'
import { useBackendDashboard } from './useBackendDashboard'
import { useSimulation } from './useSimulation'

export type DashboardMode = 'local_simulation' | 'backend'

export type DashboardData = {
  mode: DashboardMode
  setMode: (mode: DashboardMode) => void
  running: boolean
  samples: FlowSample[]
  sensor1Lpm: number
  sensor2Lpm: number
  totalVolumeLiters: number
  leakSeverity: LeakSeverity
  alerts: LeakAlert[]
  devices: DeviceInfo[]
  lastUpdated: number | null
  toggleRunning: () => void
  dismissAlert: (id: string) => void
  dataLabel: string
  connected: boolean
  backendError: string | null
  serverSimRunning: boolean
  toggleServerSimulation: () => void
  lastReadingSource: DataSource | null
  dataOrigin: 'hardware' | 'simulated' | 'mixed' | 'none' | 'local'
}

export function useDashboardData(): DashboardData {
  const [mode, setMode] = useState<DashboardMode>('local_simulation')
  const sim = useSimulation(mode === 'local_simulation')
  const backend = useBackendDashboard(mode === 'backend')

  const setModeSafe = useCallback((next: DashboardMode) => setMode(next), [])

  if (mode === 'backend') {
    const origin = backend.dataOrigin
    let dataLabel = 'Live backend — awaiting readings'
    if (origin === 'hardware') dataLabel = 'Live hardware data (API)'
    else if (origin === 'simulated') dataLabel = 'Backend simulated stream (API)'
    else if (origin === 'mixed') dataLabel = 'Mixed hardware + simulated (API)'

    return {
      mode,
      setMode: setModeSafe,
      running: backend.running,
      samples: backend.samples,
      sensor1Lpm: backend.sensor1Lpm,
      sensor2Lpm: backend.sensor2Lpm,
      totalVolumeLiters: backend.totalVolumeLiters,
      leakSeverity: backend.leakSeverity,
      alerts: backend.alerts,
      devices: backend.devices,
      lastUpdated: backend.lastUpdated,
      toggleRunning: backend.toggleRunning,
      dismissAlert: backend.dismissAlert,
      dataLabel,
      connected: backend.connected,
      backendError: backend.backendError,
      serverSimRunning: backend.serverSimRunning,
      toggleServerSimulation: backend.toggleServerSimulation,
      lastReadingSource: backend.lastReadingSource,
      dataOrigin: origin,
    }
  }

  return {
    mode,
    setMode: setModeSafe,
    running: sim.running,
    samples: sim.samples,
    sensor1Lpm: sim.sensor1Lpm,
    sensor2Lpm: sim.sensor2Lpm,
    totalVolumeLiters: sim.totalVolumeLiters,
    leakSeverity: sim.leakSeverity,
    alerts: sim.alerts,
    devices: sim.devices,
    lastUpdated: sim.lastUpdated,
    toggleRunning: sim.toggleRunning,
    dismissAlert: sim.dismissAlert,
    dataLabel: 'Local simulated data (browser)',
    connected: false,
    backendError: null,
    serverSimRunning: false,
    toggleServerSimulation: () => {},
    lastReadingSource: 'simulated',
    dataOrigin: 'local',
  }
}
