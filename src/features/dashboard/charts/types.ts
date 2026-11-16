import type { AggregatedPoint } from '@/services/aggregation.service'

export interface ChartViewProps {
  points: AggregatedPoint[]
  valueLabel: string
  totalGroups: number
  truncated: boolean
}

export interface ChartTableProps extends ChartViewProps {
  categoryLabel: string
}
