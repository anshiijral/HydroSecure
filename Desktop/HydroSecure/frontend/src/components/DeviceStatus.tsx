import { Cpu, Radio, Wifi } from 'lucide-react'
import type { DataSource, DeviceInfo } from '../types'

type Props = {
  devices: DeviceInfo[]
  totalVolumeLiters: number
  deltaLpm: number
  dataOrigin: 'hardware' | 'simulated' | 'mixed' | 'none' | 'local'
  lastReadingSource: DataSource | null
}

function iconFor(id: string) {
  if (id === 'esp32') return Wifi
  if (id === 'arduino') return Cpu
  return Radio
}

function originLabel(
  dataOrigin: Props['dataOrigin'],
  lastReadingSource: DataSource | null,
): string {
  if (dataOrigin === 'local') return 'Local browser simulation'
  if (dataOrigin === 'hardware') return 'Hardware (API)'
  if (dataOrigin === 'simulated') return 'API simulated stream'
  if (dataOrigin === 'mixed') return 'Mixed hardware + simulated'
  if (lastReadingSource === 'hardware') return 'Awaiting hardware · last n/a'
  return 'Awaiting telemetry'
}

export function DeviceStatus({
  devices,
  totalVolumeLiters,
  deltaLpm,
  dataOrigin,
  lastReadingSource,
}: Props) {
  return (
    <section className="panel devices-panel">
      <div className="panel__head">
        <div>
          <h2>Device status</h2>
          <p>{originLabel(dataOrigin, lastReadingSource)}</p>
        </div>
        {dataOrigin !== 'local' && dataOrigin !== 'none' && (
          <span className={`badge badge--origin badge--${dataOrigin}`}>{dataOrigin}</span>
        )}
      </div>
      <dl className="metrics-row">
        <div>
          <dt>Flow delta (A − B)</dt>
          <dd className={deltaLpm >= 1.8 ? 'warn' : ''}>{deltaLpm.toFixed(2)} L/min</dd>
        </div>
        <div>
          <dt>Integrated volume</dt>
          <dd>{totalVolumeLiters.toFixed(1)} L</dd>
        </div>
      </dl>
      <ul className="device-list">
        {devices.map((dev) => {
          const Icon = iconFor(dev.id)
          return (
            <li key={dev.id} className="device-item">
              <div className={`device-item__icon device-item__icon--${dev.connection}`}>
                <Icon size={18} aria-hidden />
              </div>
              <div className="device-item__text">
                <p className="device-item__name">{dev.label}</p>
                <p className="device-item__role">{dev.role}</p>
                <p className="device-item__detail">{dev.detail}</p>
              </div>
              <span className={`conn-badge conn-badge--${dev.connection}`}>{dev.connection}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
