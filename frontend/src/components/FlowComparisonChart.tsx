import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { FlowSample } from '../types'

type Props = {
  samples: FlowSample[]
  running: boolean
}

function formatAxisTime(ts: number) {
  return new Intl.DateTimeFormat(undefined, {
    minute: '2-digit',
    second: '2-digit',
  }).format(ts)
}

export function FlowComparisonChart({ samples, running }: Props) {
  const data = samples.map((s) => ({
    time: formatAxisTime(s.timestamp),
    supply: s.sensor1Lpm,
    branch: s.sensor2Lpm,
  }))

  return (
    <section className="panel chart-panel">
      <div className="panel__head">
        <div>
          <h2>Flow comparison</h2>
          <p>Supply vs branch — last {samples.length} seconds (simulated)</p>
        </div>
        {!running && <span className="badge badge--muted">Frozen</span>}
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={36}
              domain={[0, 'auto']}
              label={{
                value: 'L/min',
                angle: -90,
                position: 'insideLeft',
                fill: 'var(--text-muted)',
                fontSize: 11,
              }}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 13,
              }}
              labelStyle={{ color: 'var(--text-muted)' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              formatter={(value) =>
                value === 'supply' ? 'Sensor A (supply)' : 'Sensor B (branch)'
              }
            />
            <Line
              type="monotone"
              dataKey="supply"
              name="supply"
              stroke="var(--accent-cyan)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={running}
            />
            <Line
              type="monotone"
              dataKey="branch"
              name="branch"
              stroke="var(--accent-teal)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={running}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
