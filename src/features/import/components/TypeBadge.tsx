import type { ColumnType } from '@/domain/dataset.types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const TYPE_META: Record<ColumnType, { label: string; className: string }> = {
  text: { label: 'Teks', className: 'border-slate-200 bg-slate-50 text-slate-600' },
  number: { label: 'Angka', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  date: { label: 'Tanggal', className: 'border-violet-200 bg-violet-50 text-violet-700' },
  boolean: { label: 'Boolean', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  unknown: { label: 'Tidak pasti', className: 'border-border bg-secondary text-muted-foreground' },
}

export function TypeBadge({ type, className }: { type: ColumnType; className?: string }) {
  const meta = TYPE_META[type]
  return (
    <Badge variant="outline" className={cn('font-medium', meta.className, className)}>
      {meta.label}
    </Badge>
  )
}
