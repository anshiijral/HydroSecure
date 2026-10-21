export type DataSource = 'hardware' | 'simulated'

export type FlowSample = {
  timestamp: number
  sensor1Lpm: number
  sensor2Lpm: number
}

export type LeakSeverity = 'none' | 'warning' | 'critical'

export type LeakAlert = {
  id: string
  severity: Exclude<LeakSeverity, 'none'>
  message: string
  deltaLpm: number
  detectedAt: number
  source?: DataSource
}

export type DeviceConnection = 'online' | 'degraded' | 'offline'

export type DeviceInfo = {
  id: string
  label: string
  role: string
  connection: DeviceConnection
  detail: string
}

export type SimulationState = {
  running: boolean
  samples: FlowSample[]
  sensor1Lpm: number
  sensor2Lpm: number
  totalVolumeLiters: number
  leakSeverity: LeakSeverity
  alerts: LeakAlert[]
  devices: DeviceInfo[]
  lastUpdated: number | null
}
