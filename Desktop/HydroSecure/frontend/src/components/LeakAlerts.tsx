import { AlertTriangle, ShieldCheck, X } from 'lucide-react'
import type { LeakAlert, LeakSeverity } from '../types'

type Props = {
  alerts: LeakAlert[]
  leakSeverity: LeakSeverity
  onDismiss: (id: string) => void
}

function formatWhen(ts: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(ts)
}

export function LeakAlerts({ alerts, leakSeverity, onDismiss }: Props) {
  return (
    <section className="panel alerts-panel">
      <div className="panel__head">
        <div>
          <h2>Leak alerts</h2>
          <p>Triggered when supply − branch exceeds threshold (simulated rules)</p>
        </div>
        {leakSeverity !== 'none' && (
          <span className={`badge badge--${leakSeverity}`}>Active event</span>
        )}
      </div>
      {alerts.length === 0 ? (
        <div className="alerts-empty">
          <ShieldCheck size={28} aria-hidden />
          <p>No alerts in this session. System is within normal flow balance.</p>
        </div>
      ) : (
        <ul className="alerts-list">
          {alerts.map((alert) => (
            <li key={alert.id} className={`alert-item alert-item--${alert.severity}`}>
              <AlertTriangle size={18} aria-hidden />
              <div className="alert-item__body">
                <p className="alert-item__title">
                  {alert.severity === 'critical' ? 'Critical' : 'Warning'} · Δ{' '}
                  {alert.deltaLpm.toFixed(2)} L/min
                  {alert.source ? (
                    <span className={`origin-tag origin-tag--${alert.source}`}>
                      {alert.source === 'hardware' ? 'Hardware' : 'Simulated'}
                    </span>
                  ) : null}
                </p>
                <p>{alert.message}</p>
                <time dateTime={new Date(alert.detectedAt).toISOString()}>
                  {formatWhen(alert.detectedAt)}
                </time>
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label="Dismiss alert"
                onClick={() => onDismiss(alert.id)}
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
