const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export function wsUpdatesUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/updates`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  return res.json() as Promise<T>
}

export type DataSource = 'hardware' | 'simulated'

export type BackendFlowSample = {
  timestamp: number
  sensor1Lpm: number
  sensor2Lpm: number
  source: DataSource
  deltaLpm: number
}

export type BackendLeakAlert = {
  id: string
  severity: 'warning' | 'critical'
  message: string
  deltaLpm: number
  detectedAt: number
  source: DataSource
}

export type BackendDeviceInfo = {
  id: string
  label: string
  role: string
  connection: 'online' | 'degraded' | 'offline'
  detail: string
  lastSeenAt: number | null
}

export type BackendCurrent = {
  sensor1Lpm: number
  sensor2Lpm: number
  deltaLpm: number
  leakSeverity: 'none' | 'warning' | 'critical'
  source: DataSource | null
  lastUpdated: number | null
  totalVolumeLiters: number
  dataOrigin: 'hardware' | 'simulated' | 'mixed' | 'none'
}

export type DashboardSnapshot = {
  current: BackendCurrent
  samples: BackendFlowSample[]
  alerts: BackendLeakAlert[]
  devices: BackendDeviceInfo[]
}

export const api = {
  health: () => request<{ status: string }>('/api/health'),
  dashboard: (limit = 60) => request<DashboardSnapshot>(`/api/dashboard?limit=${limit}`),
  dismissAlert: (id: string) =>
    fetch(`${API_BASE}/api/alerts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  startServerSimulation: () => request<{ running: boolean }>('/api/simulation/start', { method: 'POST' }),
  stopServerSimulation: () => request<{ running: boolean }>('/api/simulation/stop', { method: 'POST' }),
  simulationStatus: () => request<{ running: boolean }>('/api/simulation/status'),
}

export type WsEnvelope =
  | { type: 'snapshot'; payload: DashboardSnapshot }
  | {
      type: 'reading'
      payload: { sample: BackendFlowSample; leakSeverity: 'none' | 'warning' | 'critical' }
    }
  | { type: 'alert'; payload: BackendLeakAlert }
  | { type: 'status'; payload: BackendCurrent }
