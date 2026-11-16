import type { Aggregation, ChartType, DateGroup } from './dataset.types'
import type { DashboardFilterConfig } from './filter.types'

export interface BaseWidgetConfig {
  id: string
  title: string
  visible: boolean
  order: number
  description?: string
}

export type NumberFormat = 'default' | 'integer' | 'decimal' | 'compact'

export interface KpiWidgetConfig extends BaseWidgetConfig {
  kind: 'kpi'
  metric: Aggregation
  fieldId?: string
  numberFormat: NumberFormat
}

export interface ChartWidgetConfig extends BaseWidgetConfig {
  kind: 'chart'
  chartType: ChartType
  categoryFieldId?: string
  valueFieldId?: string
  aggregation: Aggregation
  dateGroup: DateGroup
  sort: 'ascending' | 'descending' | 'none'
  limit: number
}

export type DashboardWidget = KpiWidgetConfig | ChartWidgetConfig

export interface Dashboard {
  id: string
  name: string
  datasetId: string
  createdAt: string
  updatedAt: string
  widgets: DashboardWidget[]
  filters: DashboardFilterConfig[]
}

export interface ChartRecommendation {
  title: string
  reason: string
  chartType: ChartType
  categoryFieldId?: string
  valueFieldId?: string
  aggregation: Aggregation
  dateGroup: DateGroup
  sort: 'ascending' | 'descending' | 'none'
  limit: number
}

export interface KpiRecommendation {
  title: string
  reason: string
  metric: Aggregation
  fieldId?: string
  numberFormat: NumberFormat
}

export interface DashboardRecommendation {
  kpis: KpiRecommendation[]
  charts: ChartRecommendation[]
  note?: string
}
