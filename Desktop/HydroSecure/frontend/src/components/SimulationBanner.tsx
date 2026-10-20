import { Cpu, FlaskConical, Pause, Play, Radio } from 'lucide-react'
import type { DashboardMode } from '../hooks/useDashboardData'

type Props = {
  mode: DashboardMode
  onModeChange: (mode: DashboardMode) => void
  running: boolean
  onToggleRunning: () => void
  dataLabel: string
  connected: boolean
  backendError: string | null
  serverSimRunning: boolean
  onToggleServerSim: () => void
}

export function SimulationBanner({
  mode,
  onModeChange,
  running,
  onToggleRunning,
  dataLabel,
  connected,
  backendError,
  serverSimRunning,
  onToggleServerSim,
}: Props) {
  const isLocal = mode === 'local_simulation'

  return (
    <div
      className={`sim-banner ${isLocal ? '' : 'sim-banner--backend'}`}
      role="status"
    >
      <div className="sim-banner__left">
        {isLocal ? <FlaskConical size={18} aria-hidden /> : <Cpu size={18} aria-hidden />}
        <span>
          <strong>{dataLabel}</strong>
          {isLocal
            ? ' — generated in the browser for demo. Switch to Backend to use the FastAPI API.'
            : connected
              ? ' — WebSocket connected to FastAPI.'
              : ' — connecting to backend…'}
          {backendError ? ` Error: ${backendError}` : null}
        </span>
      </div>
      <div className="sim-banner__actions">
        <div className="mode-switch" role="group" aria-label="Data source mode">
          <button
            type="button"
            className={isLocal ? 'mode-switch__btn mode-switch__btn--active' : 'mode-switch__btn'}
            onClick={() => onModeChange('local_simulation')}
          >
            Local sim
          </button>
          <button
            type="button"
            className={!isLocal ? 'mode-switch__btn mode-switch__btn--active' : 'mode-switch__btn'}
            onClick={() => onModeChange('backend')}
          >
            Backend
          </button>
        </div>
        {!isLocal && (
          <button
            type="button"
            className={`sim-toggle ${serverSimRunning ? 'sim-toggle--active' : ''}`}
            onClick={onToggleServerSim}
          >
            <Radio size={16} aria-hidden />
            {serverSimRunning ? 'Stop API sim' : 'Start API sim'}
          </button>
        )}
        <button
          type="button"
          className={`sim-toggle ${running ? 'sim-toggle--active' : ''}`}
          onClick={onToggleRunning}
          aria-pressed={running}
        >
          {running ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
          {running ? 'Updates live' : 'Updates paused'}
        </button>
      </div>
    </div>
  )
}
