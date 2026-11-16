import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { CHART_TOOLTIP_STYLE, chartColor, formatTooltipValue } from './chart-theme'
import { ChartTruncationNote } from './ChartTruncationNote'
import type { ChartViewProps } from './types'

export function DonutChartView({ points, truncated, totalGroups }: ChartViewProps) {
  return (
    <div className="px-2 pb-3">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={points}
            dataKey="value"
            nameKey="label"
            innerRadius={58}
            outerRadius={92}
            paddingAngle={2}
            stroke="#ffffff"
            strokeWidth={2}
          >
            {points.map((point, index) => (
              <Cell key={point.key} fill={chartColor(index)} />
            ))}
          </Pie>
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={formatTooltipValue} />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: '#64748b' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <ChartTruncationNote
        truncated={truncated}
        pointCount={points.length}
        totalGroups={totalGroups}
      />
    </div>
  )
}
