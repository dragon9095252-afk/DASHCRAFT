import {
  Bar,
  BarChart,
  CartesianGrid,
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

export function BarChartView({ points, valueLabel, truncated, totalGroups }: ChartViewProps) {
  return (
    <div className="px-2 pb-3">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={points}
          layout="vertical"
          margin={{ top: 8, right: 20, bottom: 8, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_GRID_STROKE} />
          <XAxis
            type="number"
            tickFormatter={formatAxisTick}
            tick={CHART_AXIS_TICK_PROPS}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            tick={CHART_AXIS_TICK_PROPS}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={formatTooltipValue}
            cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
          />
          <Bar dataKey="value" name={valueLabel} fill={chartColor(0)} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <ChartTruncationNote
        truncated={truncated}
        pointCount={points.length}
        totalGroups={totalGroups}
      />
    </div>
  )
}
