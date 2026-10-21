import { useCallback, useEffect, useRef, useState } from 'react'
import {
  api,
  type BackendCurrent,
  type BackendDeviceInfo,
  type BackendFlowSample,
  type BackendLeakAlert,
  type WsEnvelope,
  wsUpdatesUrl,
} from '../api/client'
import type { DeviceInfo, FlowSample, LeakAlert, LeakSeverity } from '../types'

const HISTORY_LENGTH = 60

function mapSample(s: BackendFlowSample): FlowSample {
  return {
    timestamp: s.timestamp,
    sensor1Lpm: s.sensor1Lpm,
    sensor2Lpm: s.sensor2Lpm,
  }
}

function mapAlert(a: BackendLeakAlert): LeakAlert {
  return {
    id: a.id,
    severity: a.severity,
    message: a.message,
    deltaLpm: a.deltaLpm,
    detectedAt: a.detectedAt,
    source: a.source,
  }
}

function mapDevices(devices: BackendDeviceInfo[]): DeviceInfo[] {
  return devices.map((d) => ({
    id: d.id,
    label: d.label,
    role: d.role,
    connection: d.connection,
    detail: d.detail,
  }))
}

export type BackendDashboardState = {
  connected: boolean
  backendError: string | null
  running: boolean
  dataOrigin: BackendCurrent['dataOrigin']
  lastReadingSource: BackendCurrent['source']
  samples: FlowSample[]
  sensor1Lpm: number
  sensor2Lpm: number
  totalVolumeLiters: number
  leakSeverity: LeakSeverity
  alerts: LeakAlert[]
  devices: DeviceInfo[]
  lastUpdated: number | null
  serverSimRunning: boolean
}

export function useBackendDashboard(enabled: boolean) {
  const [connected, setConnected] = useState(false)
  const [backendError, setBackendError] = useState<string | null>(null)
  const [running, setRunning] = useState(true)
  const [dataOrigin, setDataOrigin] = useState<BackendCurrent['dataOrigin']>('none')
  const [lastReadingSource, setLastReadingSource] = useState<BackendCurrent['source']>(null)
  const [samples, setSamples] = useState<FlowSample[]>([])
  const [sensor1Lpm, setSensor1Lpm] = useState(0)
  const [sensor2Lpm, setSensor2Lpm] = useState(0)
  const [totalVolumeLiters, setTotalVolumeLiters] = useState(0)
  const [leakSeverity, setLeakSeverity] = useState<LeakSeverity>('none')
  const [alerts, setAlerts] = useState<LeakAlert[]>([])
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [serverSimRunning, setServerSimRunning] = useState(false)

  const runningRef = useRef(running)
  runningRef.current = running

  const applySnapshot = useCallback((snap: Awaited<ReturnType<typeof api.dashboard>>) => {
    setDataOrigin(snap.current.dataOrigin)
    setLastReadingSource(snap.current.source)
    setSensor1Lpm(snap.current.sensor1Lpm)
    setSensor2Lpm(snap.current.sensor2Lpm)
    setTotalVolumeLiters(snap.current.totalVolumeLiters)
    setLeakSeverity(snap.current.leakSeverity)
    setLastUpdated(snap.current.lastUpdated)
    setSamples(snap.samples.slice(-HISTORY_LENGTH).map(mapSample))
    setAlerts(snap.alerts.map(mapAlert))
    setDevices(mapDevices(snap.devices))
  }, [])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let ws: WebSocket | null = null
    let retryTimer: number | undefined

    const bootstrap = async () => {
      try {
        await api.health()
        const snap = await api.dashboard(HISTORY_LENGTH)
        if (cancelled) return
        applySnapshot(snap)
        setBackendError(null)
        const sim = await api.simulationStatus()
        if (!cancelled) setServerSimRunning(sim.running)
      } catch (err) {
        if (!cancelled) {
          setBackendError(err instanceof Error ? err.message : 'Backend unavailable')
        }
      }
    }

    const connect = () => {
      ws = new WebSocket(wsUpdatesUrl())
      ws.onopen = () => {
        if (!cancelled) {
          setConnected(true)
          setBackendError(null)
        }
      }
      ws.onclose = () => {
        if (!cancelled) {
          setConnected(false)
          retryTimer = window.setTimeout(connect, 2000)
        }
      }
      ws.onerror = () => {
        if (!cancelled) setConnected(false)
      }
      ws.onmessage = (event) => {
        if (!runningRef.current) return
        try {
          const msg = JSON.parse(event.data as string) as WsEnvelope
          if (msg.type === 'snapshot') {
            applySnapshot(msg.payload)
            return
          }
          if (msg.type === 'reading') {
            const { sample, leakSeverity: sev } = msg.payload
            setLeakSeverity(sev)
            setSensor1Lpm(sample.sensor1Lpm)
            setSensor2Lpm(sample.sensor2Lpm)
            setLastReadingSource(sample.source)
            setLastUpdated(sample.timestamp)
            setSamples((prev) => [...prev.slice(-(HISTORY_LENGTH - 1)), mapSample(sample)])
            return
          }
          if (msg.type === 'alert') {
            setAlerts((prev) => [mapAlert(msg.payload), ...prev].slice(0, 8))
            return
          }
          if (msg.type === 'status') {
            setDataOrigin(msg.payload.dataOrigin)
            setTotalVolumeLiters(msg.payload.totalVolumeLiters)
            setLeakSeverity(msg.payload.leakSeverity)
            setLastReadingSource(msg.payload.source)
            setLastUpdated(msg.payload.lastUpdated)
          }
        } catch {
          /* ignore malformed frames */
        }
      }
    }

    void bootstrap()
    connect()

    return () => {
      cancelled = true
      if (retryTimer) window.clearTimeout(retryTimer)
      ws?.close()
    }
  }, [enabled, applySnapshot])

  const toggleRunning = useCallback(() => {
    setRunning((r) => !r)
  }, [])

  const dismissAlert = useCallback(async (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
    try {
      await api.dismissAlert(id)
    } catch {
      /* optimistic UI */
    }
  }, [])

  const toggleServerSimulation = useCallback(async () => {
    try {
      if (serverSimRunning) {
        await api.stopServerSimulation()
        setServerSimRunning(false)
      } else {
        await api.startServerSimulation()
        setServerSimRunning(true)
      }
      setBackendError(null)
    } catch (err) {
      setBackendError(err instanceof Error ? err.message : 'Simulation request failed')
    }
  }, [serverSimRunning])

  return {
    connected,
    backendError,
    running,
    dataOrigin,
    lastReadingSource,
    samples,
    sensor1Lpm,
    sensor2Lpm,
    totalVolumeLiters,
    leakSeverity,
    alerts,
    devices,
    lastUpdated,
    serverSimRunning,
    toggleRunning,
    dismissAlert,
    toggleServerSimulation,
  }
}
