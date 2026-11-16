import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Database, Info, Palette, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { PageContainer } from '@/components/layout/PageContainer'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { StorageUnavailableNotice } from '@/components/common/StorageUnavailableNotice'
import { Button } from '@/components/ui/button'
import {
  clearAllStoredData,
  getStorageCounts,
} from '@/db/persistence.service'
import { storageErrorMessage, toStorageError } from '@/db/storage-errors'
import { useStorageStatus } from '@/db/useStorageStatus'
import { useDashboardStore } from '@/state/dashboard-store'

export function SettingsPage() {
  const status = useStorageStatus()
  const { resetSession } = useDashboardStore()
  const counts = useLiveQuery(
    () =>
      status === 'available'
        ? getStorageCounts().catch(() => null)
        : undefined,
    [status],
  )
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleClearAll() {
    try {
      await clearAllStoredData()
      resetSession()
      toast.success('Seluruh data lokal dihapus')
    } catch (cause) {
      toast.error('Data gagal dihapus', {
        description: storageErrorMessage(toStorageError(cause)),
      })
    }
  }

  const countLabel =
    status === 'unavailable'
      ? 'Penyimpanan browser tidak tersedia'
      : status === 'checking' || counts === undefined
        ? 'Menghitung data…'
        : counts === null
          ? 'Data lokal tidak dapat dibaca'
          : `${counts.dashboards} dashboard · ${counts.datasets} dataset`

  return (
    <PageContainer>
      <div>
        <p className="text-xs font-semibold tracking-wider text-brand uppercase">Pengaturan</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Preferensi aplikasi</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pengaturan dasar untuk tampilan dan penyimpanan data.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <section className="rounded-xl border bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <Database className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Penyimpanan data</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Dataset dan dashboard disimpan di IndexedDB browser ini. Data tetap tersedia
                setelah halaman dimuat ulang dan tidak dikirim ke server.
              </p>
              <p className="mt-2 text-sm font-medium">{countLabel}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={status !== 'available'}
                onClick={() => setConfirmOpen(true)}
              >
                Hapus seluruh data lokal
              </Button>
            </div>
          </div>
          <StorageUnavailableNotice className="mt-4" />
        </section>

        <section className="rounded-xl border bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <Palette className="size-4 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Tampilan & format</h2>
              <dl className="mt-2 space-y-1.5 text-sm">
                <div className="flex gap-2">
                  <dt className="w-28 text-muted-foreground">Tema</dt>
                  <dd>Terang</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-28 text-muted-foreground">Format angka</dt>
                  <dd>Indonesia (1.234.567,89)</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-28 text-muted-foreground">Bahasa</dt>
                  <dd>Indonesia</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <ShieldCheck className="size-4 text-brand" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Privasi</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                File dan isi data tidak dikirim ke server, analytics, atau API eksternal. Semua
                parsing, agregasi, penyimpanan, dan rendering berjalan di browser Anda.
              </p>
            </div>
          </div>
        </section>

        <div className="flex items-start gap-2 rounded-lg border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Batasan MVP: satu file dan satu worksheet per dashboard, maksimal 20 MB, preview 50
          baris per halaman, dan maksimal 10 kategori per grafik secara default.
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Hapus seluruh data lokal?"
        description="Seluruh dataset dan dashboard di browser ini akan dihapus. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus semua"
        onConfirm={() => void handleClearAll()}
      />
    </PageContainer>
  )
}
