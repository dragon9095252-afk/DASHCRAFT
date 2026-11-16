import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowRight,
  Copy,
  LayoutDashboard,
  Pencil,
  Trash2,
  TriangleAlert,
  UploadCloud,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { LoadingState } from '@/components/common/LoadingState'
import { StorageUnavailableNotice } from '@/components/common/StorageUnavailableNotice'
import { Button } from '@/components/ui/button'
import type { StoredDashboard } from '@/db/database'
import {
  deleteStoredDashboard,
  duplicateStoredDashboard,
  renameStoredDashboard,
} from '@/db/persistence.service'
import { dashboardRepository } from '@/db/repositories/dashboard.repository'
import { storageErrorMessage, toStorageError } from '@/db/storage-errors'
import { useStorageStatus } from '@/db/useStorageStatus'
import { formatRelativeTime } from '@/lib/formatters'
import { useDashboardStore } from '@/state/dashboard-store'
import { RenameDashboardDialog } from '../components/RenameDashboardDialog'

export function DashboardsPage() {
  const status = useStorageStatus()
  const { applyDashboardRename, deleteDashboard } = useDashboardStore()
  const dashboards = useLiveQuery(
    () =>
      status === 'available' ? dashboardRepository.list().catch(() => null) : undefined,
    [status],
  )
  const [pendingRename, setPendingRename] = useState<StoredDashboard | null>(null)
  const [pendingDelete, setPendingDelete] = useState<StoredDashboard | null>(null)

  async function handleRename(name: string) {
    if (!pendingRename) return
    try {
      await renameStoredDashboard(pendingRename.id, name)
      applyDashboardRename(pendingRename.id, name)
      setPendingRename(null)
      toast.success('Nama dashboard diperbarui')
    } catch (cause) {
      toast.error('Nama gagal diperbarui', {
        description: storageErrorMessage(toStorageError(cause)),
      })
    }
  }

  async function handleDuplicate(dashboard: StoredDashboard) {
    try {
      const copy = await duplicateStoredDashboard(dashboard.id)
      if (!copy) {
        toast.error('Dashboard gagal diduplikasi', {
          description: 'Dashboard sumber tidak ditemukan. Muat ulang daftar lalu coba lagi.',
        })
        return
      }
      toast.success('Dashboard diduplikasi')
    } catch (cause) {
      toast.error('Dashboard gagal diduplikasi', {
        description: storageErrorMessage(toStorageError(cause)),
      })
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return
    try {
      await deleteStoredDashboard(pendingDelete.id)
      deleteDashboard(pendingDelete.id)
      toast.success('Dashboard dihapus')
    } catch (cause) {
      toast.error('Dashboard gagal dihapus', {
        description: storageErrorMessage(toStorageError(cause)),
      })
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <PageContainer>
      <div>
        <p className="text-xs font-semibold tracking-wider text-brand uppercase">Dashboard Saya</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Dashboard tersimpan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dashboard yang tersimpan di browser ini. Buka, ganti nama, duplikat, atau hapus.
        </p>
      </div>

      <StorageUnavailableNotice className="mt-5" />

      <div className="mt-6">
        {status === 'unavailable' ? null : status === 'checking' || dashboards === undefined ? (
          <LoadingState label="Memuat dashboard…" />
        ) : dashboards === null ? (
          <EmptyState
            icon={TriangleAlert}
            title="Dashboard tidak dapat dibaca"
            description="Terjadi masalah saat membaca penyimpanan browser. Coba muat ulang halaman ini."
          />
        ) : dashboards.length === 0 ? (
          <EmptyState
            icon={LayoutDashboard}
            title="Belum ada dashboard tersimpan"
            description="Unggah file Excel atau CSV terlebih dahulu, lalu simpan dashboard dari halaman builder."
            action={
              <Button asChild>
                <Link to="/">
                  <UploadCloud className="size-4" />
                  Unggah file
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {dashboards.map((dashboard) => (
              <div
                key={dashboard.id}
                className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3.5 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <LayoutDashboard className="size-4.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{dashboard.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {dashboard.datasetFileName} · {dashboard.rowCount} baris ·{' '}
                      {dashboard.widgets.length} visual · diperbarui{' '}
                      {formatRelativeTime(dashboard.updatedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/builder/${dashboard.id}`}>
                      Buka
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Ganti nama ${dashboard.name}`}
                    onClick={() => setPendingRename(dashboard)}
                  >
                    <Pencil className="size-4 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Duplikat ${dashboard.name}`}
                    onClick={() => void handleDuplicate(dashboard)}
                  >
                    <Copy className="size-4 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Hapus ${dashboard.name}`}
                    onClick={() => setPendingDelete(dashboard)}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RenameDashboardDialog
        dashboard={pendingRename}
        onOpenChange={(open) => {
          if (!open) setPendingRename(null)
        }}
        onRename={handleRename}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="Hapus dashboard?"
        description={`“${pendingDelete?.name ?? 'Dashboard'}” akan dihapus, termasuk dataset yang tidak dipakai dashboard lain. Tindakan ini tidak dapat dibatalkan.`}
        onConfirm={() => void handleDelete()}
      />
    </PageContainer>
  )
}
