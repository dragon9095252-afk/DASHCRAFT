import type { Dataset } from '@/domain/dataset.types'
import { formatNumber } from '@/lib/formatters'

export function DatasetSummary({ dataset }: { dataset: Dataset }) {
  const blankCells = dataset.columns.reduce((total, column) => total + column.nullCount, 0)
  const stats = [
    { label: 'Baris', value: formatNumber(dataset.rowCount, 'integer') },
    { label: 'Kolom', value: formatNumber(dataset.columns.length, 'integer') },
    { label: 'Sel kosong', value: formatNumber(blankCells, 'integer') },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">{stat.label}</p>
          <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{stat.value}</p>
        </div>
      ))}
    </div>
  )
}
