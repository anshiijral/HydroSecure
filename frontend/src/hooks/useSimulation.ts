import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  DeviceInfo,
  FlowSample,
  LeakAlert,
  LeakSeverity,
  SimulationState,
} from '../types'

const HISTORY_LENGTH = 60
const TICK_MS = 1000
const LEAK_DELTA_WARNING = 1.8
const LEAK_DELTA_CRITICAL = 3.2
const LEAK_PERSIST_MS = 4000

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function noise(scale: number) {
  return (Math.random() - 0.5) * scale
}

/** Simulates dual flow meters: supply (S1) vs branch (S2); leak = sustained S1 − S2 gap. */
function nextFlowRates(
  tick: number,
  prev1: number,
  prev2: number,
): { s1: number; s2: number } {
  const hour = new Date().getHours()
  const daily = 0.85 + 0.35 * Math.sin((hour / 24) * Math.PI * 2)
  const burst = Math.sin(tick * 0.08) * 0.4

  const leakPhase = Math.sin(tick * 0.015)
  const leakActive = leakPhase > 0.72

  let target1 = 4.2 * daily + burst + (leakActive ? 2.8 : 0)
  let target2 = 4.0 * daily + burst * 0.95

  if (leakActive) {
    target2 = Math.max(1.2, target2 - 2.4 - Math.abs(leakPhase) * 0.8)
  }

  const s1 = clamp(prev1 * 0.65 + target1 * 0.35 + noise(0.25), 0, 12)
  const s2 = clamp(prev2 * 0.65 + target2 * 0.35 + noise(0.22), 0, 12)

  return { s1: Math.round(s1 * 100) / 100, s2: Math.round(s2 * 100) / 100 }
}

function severityFromDelta(delta: number): LeakSeverity {
  if (delta >= LEAK_DELTA_CRITICAL) return 'critical'
  if (delta >= LEAK_DELTA_WARNING) return 'warning'
  return 'none'
}

const INITIAL_DEVICES: DeviceInfo[] = [
  {
    id: 'esp32',
    label: 'ESP32 Gateway',
    role: 'Wi‑Fi / MQTT bridge',
    connection: 'online',
    detail: '192.168.1.42 · −58 dBm',
  },
  {
    id: 'arduino',
    label: 'Arduino Uno',
    role: 'Pulse counting',
    connection: 'online',
    detail: 'I²C link · 9600 baud',
  },
  {
    id: 's1',
    label: 'Flow Sensor A',
    role: 'Main supply line',
    connection: 'online',
    detail: 'YF-S201 · GPIO 2',
  },
  {
    id: 's2',
    label: 'Flow Sensor B',
    role: 'Branch / return',
    connection: 'online',
    detail: 'YF-S201 · GPIO 3',
  },
]

function buildInitialHistory(): FlowSample[] {
  const now = Date.now()
  const samples: FlowSample[] = []
  let s1 = 3.8
  let s2 = 3.6
  for (let i = HISTORY_LENGTH - 1; i >= 0; i--) {
    const rates = nextFlowRates(HISTORY_LENGTH - i, s1, s2)
    s1 = rates.s1
    s2 = rates.s2
    samples.push({
      timestamp: now - i * TICK_MS,
      sensor1Lpm: s1,
      sensor2Lpm: s2,
    })
  }
  return samples
}

function makeAlert(severity: 'warning' | 'critical', delta: number): LeakAlert {
  return {
    id: `${Date.now()}-${severity}`,
    severity,
    deltaLpm: Math.round(delta * 100) / 100,
    detectedAt: Date.now(),
    message:
      severity === 'critical'
        ? 'Critical leak signature — supply exceeds branch flow beyond safe threshold.'
        : 'Possible leak — flow imbalance detected between sensors.',
  }
}

export function useSimulation(enabled = true): SimulationState & {
  toggleRunning: () => void
  dismissAlert: (id: string) => void
} {
  const initial = buildInitialHistory()
  const [running, setRunning] = useState(true)
  const [samples, setSamples] = useState<FlowSample[]>(initial)
  const [sensor1Lpm, setSensor1Lpm] = useState(initial.at(-1)!.sensor1Lpm)
  const [sensor2Lpm, setSensor2Lpm] = useState(initial.at(-1)!.sensor2Lpm)
  const [totalVolumeLiters, setTotalVolumeLiters] = useState(142.6)
  const [leakSeverity, setLeakSeverity] = useState<LeakSeverity>('none')
  const [alerts, setAlerts] = useState<LeakAlert[]>([])
  const [devices, setDevices] = useState<DeviceInfo[]>(INITIAL_DEVICES)
  const [lastUpdated, setLastUpdated] = useState<number | null>(() => Date.now())

  const tickRef = useRef(HISTORY_LENGTH)
  const ratesRef = useRef({ s1: sensor1Lpm, s2: sensor2Lpm })
  const leakSinceRef = useRef<number | null>(null)
  const lastSeverityRef = useRef<LeakSeverity>('none')

  const toggleRunning = useCallback(() => {
    setRunning((r) => !r)
  }, [])

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }, [])

  useEffect(() => {
    ratesRef.current = { s1: sensor1Lpm, s2: sensor2Lpm }
  }, [sensor1Lpm, sensor2Lpm])

  useEffect(() => {
    if (!enabled) return

    if (!running) {
      setDevices((d) =>
        d.map((dev) =>
          dev.id === 'esp32'
            ? { ...dev, connection: 'degraded', detail: 'Simulation paused · last sync cached' }
            : dev,
        ),
      )
      return
    }

    setDevices(INITIAL_DEVICES)

    const id = window.setInterval(() => {
      tickRef.current += 1
      const { s1: prev1, s2: prev2 } = ratesRef.current
      const { s1, s2 } = nextFlowRates(tickRef.current, prev1, prev2)
      ratesRef.current = { s1, s2 }

      const delta = s1 - s2
      const now = Date.now()
      const sev = severityFromDelta(delta)

      if (sev !== 'none') {
        if (leakSinceRef.current === null) leakSinceRef.current = now
      } else {
        leakSinceRef.current = null
      }

      const persisted =
        leakSinceRef.current !== null && now - leakSinceRef.current >= LEAK_PERSIST_MS

      const effectiveSev: LeakSeverity = persisted ? sev : 'none'
      setLeakSeverity(effectiveSev)

      if (persisted && effectiveSev !== lastSeverityRef.current) {
        lastSeverityRef.current = effectiveSev
        if (effectiveSev === 'warning' || effectiveSev === 'critical') {
          setAlerts((prev) => [makeAlert(effectiveSev, delta), ...prev].slice(0, 8))
        }
      }
      if (!persisted) {
        lastSeverityRef.current = 'none'
      }

      setSensor1Lpm(s1)
      setSensor2Lpm(s2)
      setSamples((hist) => {
        const next: FlowSample = { timestamp: now, sensor1Lpm: s1, sensor2Lpm: s2 }
        return [...hist.slice(-(HISTORY_LENGTH - 1)), next]
      })

      const litersPerTick = ((s1 + s2) / 2 / 60) * (TICK_MS / 1000)
      setTotalVolumeLiters((v) => Math.round((v + litersPerTick) * 10) / 10)
      setLastUpdated(now)
    }, TICK_MS)

    return () => window.clearInterval(id)
  }, [running, enabled])

  return {
    running,
    samples,
    sensor1Lpm,
    sensor2Lpm,
    totalVolumeLiters,
    leakSeverity,
    alerts,
    devices,
    lastUpdated,
    toggleRunning,
    dismissAlert,
  }
}
