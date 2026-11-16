import { TriangleAlert } from 'lucide-react'
import type { DatasetColumn, DatasetRow } from '@/domain/dataset.types'
import type { KpiWidgetConfig } from '@/domain/dashboard.types'
import { Card } from '@/components/ui/card'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { computeMetric, getAggregationLabel } from '@/services/aggregation.service'
import { findDatasetColumn, validateKpiConfig } from '@/services/widget-validation'
import { WidgetMenu } from './WidgetMenu'

export function KpiCard({
  widget,
  rows,
  columns,
  selected,
  onSelect,
  onEdit,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp,
  canMoveDown,
}: {
  widget: KpiWidgetConfig
  rows: DatasetRow[]
  columns: DatasetColumn[]
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  const field = findDatasetColumn(columns, widget.fieldId)
  const problems = validateKpiConfig(widget, columns)
  const value = problems.length === 0 ? computeMetric(rows, widget.metric, field) : 0
  const metricLabel = getAggregationLabel(widget.metric)
  const subtitle = field ? `${metricLabel} · ${field.displayName}` : `${metricLabel} · semua baris`

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'cursor-pointer gap-0 py-0 transition-all outline-none hover:border-brand/40 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/40',
        selected && 'border-brand/60 ring-2 ring-brand/20',
      )}
    >
      <div className="flex items-start justify-between gap-2 px-4 pt-3.5">
        <p className="text-xs font-medium text-muted-foreground">{widget.title}</p>
        <div className="-mt-1 -mr-2">
          <WidgetMenu
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onDelete={onDelete}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
          />
        </div>
      </div>

      <div className="px-4 pb-3.5">
        {problems.length === 0 ? (
          <p className="mt-1 text-[26px] leading-tight font-semibold tracking-tight tabular-nums">
            {formatNumber(value, widget.numberFormat)}
          </p>
        ) : (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
            <TriangleAlert className="mt-px size-3.5 shrink-0" />
            {problems[0]}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        {widget.description ? (
          <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
            {widget.description}
          </p>
        ) : null}
      </div>
    </Card>
  )
}
