import { TriangleAlert } from 'lucide-react'
import type { DatasetColumn } from '@/domain/dataset.types'
import type { DashboardWidget } from '@/domain/dashboard.types'
import { validateChartConfig, validateKpiConfig } from '@/services/widget-validation'

export function WidgetProblems({
  widget,
  columns,
}: {
  widget: DashboardWidget
  columns: DatasetColumn[]
}) {
  const problems =
    widget.kind === 'kpi'
      ? validateKpiConfig(widget, columns)
      : validateChartConfig(widget, columns)

  if (problems.length === 0) {
    return (
      <p className="rounded-lg bg-success-soft px-3 py-2 text-xs text-success">
        Konfigurasi valid.
      </p>
    )
  }

  return (
    <div className="rounded-lg border border-warning/20 bg-warning-soft px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
        <TriangleAlert className="size-3.5" />
        Perlu diperbaiki
      </p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
        {problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
    </div>
  )
}
