import { formatCompactNumber, formatNumber } from '@/lib/formatters'

export const CHART_COLORS = [
  '#16a36a',
  '#2563eb',
  '#d97706',
  '#7c3aed',
  '#0e7490',
  '#dc2626',
  '#0891b2',
  '#65a30d',
  '#c026d3',
  '#475569',
]

export const CHART_GRID_STROKE = '#e2e8f0'
export const CHART_AXIS_TICK = '#64748b'

export const CHART_TOOLTIP_STYLE = {
  borderRadius: 10,
  borderColor: '#e2e8f0',
  fontSize: 12,
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
}

export const CHART_AXIS_TICK_PROPS = { fontSize: 11, fill: CHART_AXIS_TICK }

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}

export function formatTooltipValue(value: unknown): string {
  return formatNumber(Number(Array.isArray(value) ? value[0] : value))
}

export function formatAxisTick(value: unknown): string {
  return formatCompactNumber(Number(value))
}
