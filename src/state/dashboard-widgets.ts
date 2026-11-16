import type { Dataset, DatasetColumn } from '@/domain/dataset.types'
import type {
  ChartWidgetConfig,
  Dashboard,
  DashboardWidget,
  KpiWidgetConfig,
} from '@/domain/dashboard.types'
import { deriveFilterConfigs } from '@/services/filter.service'
import { buildRecommendation } from '@/services/recommendation.service'

export function reindexWidgets(widgets: DashboardWidget[]): DashboardWidget[] {
  return widgets.map((widget, index) => ({ ...widget, order: index }))
}

export function createDefaultKpiWidget(
  columns: DatasetColumn[],
  order: number,
): KpiWidgetConfig {
  const numericColumn = columns.find((column) => column.type === 'number')
  return {
    id: crypto.randomUUID(),
    kind: 'kpi',
    title: 'KPI Baru',
    visible: true,
    order,
    metric: numericColumn ? 'sum' : 'count',
    fieldId: numericColumn?.id,
    numberFormat: numericColumn ? 'default' : 'integer',
  }
}

export function createDefaultChartWidget(
  columns: DatasetColumn[],
  order: number,
): ChartWidgetConfig {
  const numericColumn = columns.find((column) => column.type === 'number')
  const categoryColumn =
    columns.find((column) => column.type === 'text') ?? columns[0]

  return {
    id: crypto.randomUUID(),
    kind: 'chart',
    title: 'Grafik Baru',
    visible: true,
    order,
    chartType: 'bar',
    categoryFieldId: categoryColumn?.id,
    valueFieldId: numericColumn?.id,
    aggregation: numericColumn ? 'sum' : 'count',
    dateGroup: 'month',
    sort: 'descending',
    limit: 10,
  }
}

export function createDashboardFromDataset(dataset: Dataset): Dashboard {
  const recommendation = buildRecommendation(dataset)
  const now = new Date().toISOString()

  const kpiWidgets: DashboardWidget[] = recommendation.kpis.map((kpi, index) => ({
    id: crypto.randomUUID(),
    kind: 'kpi',
    title: kpi.title,
    description: kpi.reason,
    visible: true,
    order: index,
    metric: kpi.metric,
    fieldId: kpi.fieldId,
    numberFormat: kpi.numberFormat,
  }))

  const chartWidgets: DashboardWidget[] = recommendation.charts.map((chart, index) => ({
    id: crypto.randomUUID(),
    kind: 'chart',
    title: chart.title,
    description: chart.reason,
    visible: true,
    order: kpiWidgets.length + index,
    chartType: chart.chartType,
    categoryFieldId: chart.categoryFieldId,
    valueFieldId: chart.valueFieldId,
    aggregation: chart.aggregation,
    dateGroup: chart.dateGroup,
    sort: chart.sort,
    limit: chart.limit,
  }))

  return {
    id: crypto.randomUUID(),
    name: `Dashboard ${dataset.name}`,
    datasetId: dataset.id,
    createdAt: now,
    updatedAt: now,
    widgets: [...kpiWidgets, ...chartWidgets],
    filters: deriveFilterConfigs(dataset.columns),
  }
}

export interface DuplicateWidgetResult {
  widgets: DashboardWidget[]
  duplicated: DashboardWidget
}

export function duplicateDashboardWidget(
  widgets: DashboardWidget[],
  widgetId: string,
): DuplicateWidgetResult | null {
  const source = widgets.find((widget) => widget.id === widgetId)
  if (!source) return null

  const duplicated: DashboardWidget = {
    ...source,
    id: crypto.randomUUID(),
    title: `${source.title} (Salinan)`,
  }

  return { widgets: reindexWidgets([...widgets, duplicated]), duplicated }
}

export function moveDashboardWidget(
  widgets: DashboardWidget[],
  widgetId: string,
  direction: 'up' | 'down',
): DashboardWidget[] {
  const source = widgets.find((widget) => widget.id === widgetId)
  if (!source) return widgets

  const siblings = widgets
    .filter((widget) => widget.kind === source.kind)
    .sort((a, b) => a.order - b.order)
  const index = siblings.findIndex((widget) => widget.id === widgetId)
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || targetIndex < 0 || targetIndex >= siblings.length) return widgets

  const target = siblings[targetIndex]
  return widgets.map((widget) => {
    if (widget.id === source.id) return { ...widget, order: target.order }
    if (widget.id === target.id) return { ...widget, order: source.order }
    return widget
  })
}
