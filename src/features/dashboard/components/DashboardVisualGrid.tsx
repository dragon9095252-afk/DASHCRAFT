import type { DatasetColumn, DatasetRow } from '@/domain/dataset.types'
import type { ChartWidgetConfig, KpiWidgetConfig } from '@/domain/dashboard.types'
import { ChartCard } from './ChartCard'
import { KpiCard } from './KpiCard'

interface DashboardVisualGridProps {
  kpiWidgets: KpiWidgetConfig[]
  chartWidgets: ChartWidgetConfig[]
  columns: DatasetColumn[]
  rows: DatasetRow[]
  totalRowCount: number
  selectedWidgetId: string | null
  onSelect: (widgetId: string) => void
  onDuplicate: (widgetId: string) => void
  onMove: (widgetId: string, direction: 'up' | 'down') => void
  onDelete: (widget: KpiWidgetConfig | ChartWidgetConfig) => void
}

export function DashboardVisualGrid({
  kpiWidgets,
  chartWidgets,
  columns,
  rows,
  totalRowCount,
  selectedWidgetId,
  onSelect,
  onDuplicate,
  onMove,
  onDelete,
}: DashboardVisualGridProps) {
  return (
    <>
      {kpiWidgets.length > 0 ? (
        <section aria-label="KPI" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpiWidgets.map((widget, index) => (
            <KpiCard
              key={widget.id}
              widget={widget}
              rows={rows}
              totalRowCount={totalRowCount}
              columns={columns}
              selected={selectedWidgetId === widget.id}
              onSelect={() => onSelect(widget.id)}
              onEdit={() => onSelect(widget.id)}
              onDuplicate={() => onDuplicate(widget.id)}
              onMoveUp={() => onMove(widget.id, 'up')}
              onMoveDown={() => onMove(widget.id, 'down')}
              onDelete={() => onDelete(widget)}
              canMoveUp={index > 0}
              canMoveDown={index < kpiWidgets.length - 1}
            />
          ))}
        </section>
      ) : null}

      {chartWidgets.length > 0 ? (
        <section aria-label="Grafik" className="mt-4 grid gap-4 lg:grid-cols-2">
          {chartWidgets.map((widget, index) => (
            <ChartCard
              key={widget.id}
              widget={widget}
              rows={rows}
              columns={columns}
              selected={selectedWidgetId === widget.id}
              onSelect={() => onSelect(widget.id)}
              onEdit={() => onSelect(widget.id)}
              onDuplicate={() => onDuplicate(widget.id)}
              onMoveUp={() => onMove(widget.id, 'up')}
              onMoveDown={() => onMove(widget.id, 'down')}
              onDelete={() => onDelete(widget)}
              canMoveUp={index > 0}
              canMoveDown={index < chartWidgets.length - 1}
            />
          ))}
        </section>
      ) : null}
    </>
  )
}
