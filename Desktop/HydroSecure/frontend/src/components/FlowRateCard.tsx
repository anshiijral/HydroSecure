import { Activity, TrendingDown, TrendingUp } from 'lucide-react'

type Props = {
  title: string
  subtitle: string
  lpm: number
  accent: 'cyan' | 'teal'
  trend: number
}

export function FlowRateCard({ title, subtitle, lpm, accent, trend }: Props) {
  const TrendIcon = trend >= 0 ? TrendingUp : TrendingDown
  const trendLabel = `${trend >= 0 ? '+' : ''}${trend.toFixed(2)} L/min vs prior`

  return (
    <article className={`flow-card flow-card--${accent}`}>
      <div className="flow-card__head">
        <Activity size={18} aria-hidden />
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="flow-card__value">
        <span className="flow-card__number">{lpm.toFixed(2)}</span>
        <span className="flow-card__unit">L/min</span>
      </div>
      <p className={`flow-card__trend ${trend >= 0 ? 'up' : 'down'}`}>
        <TrendIcon size={14} aria-hidden />
        {trendLabel}
      </p>
    </article>
  )
}
