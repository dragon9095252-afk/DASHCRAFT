import { useMemo } from 'react'
import { TriangleAlert } from 'lucide-react'
import type { DatasetColumn, DatasetRow } from '@/domain/dataset.types'
import type { ChartWidgetConfig } from '@/domain/dashboard.types'
import { aggregateSeries, getAggregationLabel } from '@/services/aggregation.service'
import { findDatasetColumn, validateChartConfig } from '@/services/widget-validation'
import { AreaChartView } from './AreaChartView'
import { BarChartView } from './BarChartView'
import { ChartTable } from './ChartTable'
import { DonutChartView } from './DonutChartView'
import { LineChartView } from './LineChartView'

export function ChartRenderer({
  config,
  columns,
  rows,
}: {
  config: ChartWidgetConfig
  columns: DatasetColumn[]
  rows: DatasetRow[]
}) {
  const categoryField = findDatasetColumn(columns, config.categoryFieldId)
  const valueField = findDatasetColumn(columns, config.valueFieldId)
  const problems = validateChartConfig(config, columns)
  const isInvalid = problems.length > 0

  const series = useMemo(() => {
    if (isInvalid || !categoryField) return null
    return aggregateSeries(rows, {
      categoryField,
      valueField,
      aggregation: config.aggregation,
      dateGroup: config.dateGroup,
      sort: config.sort,
      limit: config.limit,
    })
  }, [rows, categoryField, valueField, config.aggregation, config.dateGroup, config.sort, config.limit, isInvalid])

  if (isInvalid) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 px-6 text-center">
        <TriangleAlert className="size-5 text-warning" />
        <p className="text-sm font-medium">Konfigurasi grafik belum lengkap</p>
        <p className="max-w-sm text-xs text-muted-foreground">{problems[0]}</p>
      </div>
    )
  }

  if (!series || series.points.length === 0) {
    return (
      <div className="flex min-h-[280px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Tidak ada data untuk filter yang aktif.
      </div>
    )
  }

  const valueLabel = `${getAggregationLabel(config.aggregation)}${
    valueField ? ` ${valueField.displayName}` : ''
  }`
  const viewProps = {
    points: series.points,
    valueLabel,
    totalGroups: series.totalGroups,
    truncated: series.truncated,
  }

  switch (config.chartType) {
    case 'table':
      return (
        <ChartTable
          {...viewProps}
          categoryLabel={categoryField?.displayName ?? 'Kategori'}
        />
      )
    case 'pie':
      return <DonutChartView {...viewProps} />
    case 'bar':
      return <BarChartView {...viewProps} />
    case 'area':
      return <AreaChartView {...viewProps} />
    case 'line':
      return <LineChartView {...viewProps} />
  }
}
