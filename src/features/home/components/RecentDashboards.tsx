import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, LayoutDashboard, TriangleAlert } from 'lucide-react'
import { LoadingState } from '@/components/common/LoadingState'
import { dashboardRepository } from '@/db/repositories/dashboard.repository'
import { useStorageStatus } from '@/db/useStorageStatus'
import { formatRelativeTime } from '@/lib/formatters'

export function RecentDashboards() {
  const status = useStorageStatus()
  const recent = useLiveQuery(
    () =>
      status === 'available'
        ? dashboardRepository.listRecent(3).catch(() => null)
        : undefined,
    [status],
  )

  if (status === 'unavailable') return null

  if (status === 'checking' || recent === undefined) {
    return <LoadingState compact label="Memuat dashboard…" />
  }

  if (recent === null) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-5 py-8 text-center">
        <TriangleAlert className="mx-auto size-5 text-warning" />
        <p className="mt-3 text-sm font-medium">Dashboard tidak dapat dibaca</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Terjadi masalah saat membaca penyimpanan browser. Coba muat ulang halaman ini.
        </p>
      </div>
    )
  }

  if (recent.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-5 py-8 text-center">
        <LayoutDashboard className="mx-auto size-5 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Belum ada dashboard</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Dashboard yang Anda simpan akan muncul di sini.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {recent.map((dashboard) => (
        <Link
          key={dashboard.id}
          to={`/builder/${dashboard.id}`}
          className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-secondary/50"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
            <LayoutDashboard className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{dashboard.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {dashboard.datasetFileName} · {formatRelativeTime(dashboard.updatedAt)}
            </p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </div>
  )
}
