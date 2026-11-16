import { CircleAlert, Info, TriangleAlert } from 'lucide-react'
import type { DatasetWarning } from '@/domain/dataset.types'

export function DatasetWarnings({ warnings }: { warnings: DatasetWarning[] }) {
  if (warnings.length === 0) return null

  return (
    <section className="mt-4 space-y-2" aria-label="Peringatan kualitas data">
      {warnings.map((warning) => {
        const isError = warning.severity === 'error'
        const Icon = isError
          ? CircleAlert
          : warning.severity === 'warning'
            ? TriangleAlert
            : Info

        return (
          <div
            key={warning.code}
            className={
              isError
                ? 'flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm'
                : 'flex items-start gap-2 rounded-lg border border-warning/20 bg-warning-soft px-3 py-2.5 text-sm'
            }
          >
            <Icon
              className={
                isError
                  ? 'mt-0.5 size-4 shrink-0 text-destructive'
                  : 'mt-0.5 size-4 shrink-0 text-warning'
              }
            />
            <p className="text-muted-foreground">{warning.message}</p>
          </div>
        )
      })}
    </section>
  )
}
