import { TriangleAlert } from 'lucide-react'
import { useStorageStatus } from '@/db/useStorageStatus'
import { cn } from '@/lib/utils'

export function StorageUnavailableNotice({ className }: { className?: string }) {
  const status = useStorageStatus()
  if (status !== 'unavailable') return null

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2 rounded-lg border border-warning/20 bg-warning-soft px-4 py-3 text-xs leading-relaxed text-muted-foreground',
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
      <p>
        Penyimpanan browser (IndexedDB) tidak tersedia. Dataset dan dashboard hanya bertahan
        selama tab ini terbuka.
      </p>
    </div>
  )
}
