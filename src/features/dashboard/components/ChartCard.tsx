import type { DatasetColumn, DatasetRow } from '@/domain/dataset.types'
import type { ChartWidgetConfig } from '@/domain/dashboard.types'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ChartRenderer } from '@/features/dashboard/charts/ChartRenderer'
import { WidgetMenu } from './WidgetMenu'

export function ChartCard({
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
  widget: ChartWidgetConfig
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
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{widget.title}</p>
          <p className="text-[11px] text-muted-foreground">
            {widget.chartType === 'pie'
              ? 'Donut'
              : widget.chartType.charAt(0).toUpperCase() + widget.chartType.slice(1)}
          </p>
        </div>
        <div onClick={(event) => event.stopPropagation()}>
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

      <ChartRenderer config={widget} columns={columns} rows={rows} />

      {widget.description ? (
        <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
          {widget.description}
        </p>
      ) : null}
    </Card>
  )
}
