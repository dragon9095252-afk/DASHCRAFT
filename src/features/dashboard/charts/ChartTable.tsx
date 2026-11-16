import { formatNumber } from '@/lib/formatters'
import { ChartTruncationNote } from './ChartTruncationNote'
import type { ChartTableProps } from './types'

export function ChartTable({
  points,
  valueLabel,
  categoryLabel,
  truncated,
  totalGroups,
}: ChartTableProps) {
  return (
    <div className="px-4 pb-4">
      <div className="max-h-[300px] overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-secondary/70 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{categoryLabel}</th>
              <th className="px-3 py-2 text-right font-medium">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.key} className="border-t">
                <td className="px-3 py-1.5">{point.label}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {formatNumber(point.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ChartTruncationNote
        truncated={truncated}
        pointCount={points.length}
        totalGroups={totalGroups}
      />
    </div>
  )
}
