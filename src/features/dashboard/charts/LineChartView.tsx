import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CHART_AXIS_TICK_PROPS,
  CHART_GRID_STROKE,
  CHART_TOOLTIP_STYLE,
  chartColor,
  formatAxisTick,
  formatTooltipValue,
} from './chart-theme'
import { ChartTruncationNote } from './ChartTruncationNote'
import type { ChartViewProps } from './types'

export function LineChartView({ points, valueLabel, truncated, totalGroups }: ChartViewProps) {
  return (
    <div className="px-2 pb-3">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID_STROKE} />
          <XAxis
            dataKey="label"
            tick={CHART_AXIS_TICK_PROPS}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatAxisTick}
            tick={CHART_AXIS_TICK_PROPS}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={formatTooltipValue} />
          <Line
            type="monotone"
            dataKey="value"
            name={valueLabel}
            stroke={chartColor(0)}
            strokeWidth={2.2}
            dot={{ r: 3, strokeWidth: 0, fill: chartColor(0) }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <ChartTruncationNote
        truncated={truncated}
        pointCount={points.length}
        totalGroups={totalGroups}
      />
    </div>
  )
}
