import { Droplets } from 'lucide-react'
import type { LeakSeverity } from '../types'

type Props = {
  leakSeverity: LeakSeverity
  lastUpdated: number | null
  running: boolean
}

function formatTime(ts: number | null) {
  if (ts === null) return '—'
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(ts)
}

export function Header({ leakSeverity, lastUpdated, running }: Props) {
  const statusLabel =
    leakSeverity === 'critical'
      ? 'Leak detected'
      : leakSeverity === 'warning'
        ? 'Monitoring — imbalance'
        : 'Normal flow'

  return (
    <header className="header">
      <div className="header__brand">
        <div className="header__logo" aria-hidden>
          <Droplets size={22} />
        </div>
        <div>
          <h1>HydroSecure</h1>
          <p className="header__tagline">Dual-sensor flow monitoring &amp; leak detection</p>
        </div>
      </div>
      <div className="header__meta">
        <div
          className={`status-pill status-pill--${leakSeverity === 'none' ? 'ok' : leakSeverity}`}
        >
          <span className="status-pill__dot" />
          {statusLabel}
        </div>
        <p className="header__updated">
          Last update:{' '}
          <time dateTime={lastUpdated ? new Date(lastUpdated).toISOString() : undefined}>
            {running ? formatTime(lastUpdated) : 'Paused'}
          </time>
        </p>
      </div>
    </header>
  )
}
