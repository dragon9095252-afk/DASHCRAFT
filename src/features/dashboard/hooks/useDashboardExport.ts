import { useState, type RefObject } from 'react'
import { toast } from 'sonner'
import type { Dashboard } from '@/domain/dashboard.types'
import type { Dataset, DatasetRow } from '@/domain/dataset.types'
import {
  buildCsv,
  buildExportFileName,
  captureNodeAsPng,
  downloadCsv,
  downloadPdfFromImage,
  downloadPngDataUrl,
  waitForVisuals,
  type ExportFormat,
} from '@/services/export.service'

export function useDashboardExport({
  dashboard,
  dataset,
  filteredRows,
  targetRef,
}: {
  dashboard: Dashboard | null
  dataset: Dataset | null
  filteredRows: DatasetRow[]
  targetRef: RefObject<HTMLDivElement | null>
}) {
  const [busy, setBusy] = useState<ExportFormat | null>(null)
  const canExportImage = dashboard?.widgets.some((widget) => widget.visible) ?? false
  const canExportCsv = dataset !== null && filteredRows.length > 0

  async function exportAs(format: ExportFormat): Promise<void> {
    if (!dashboard || !dataset || busy) return

    if (format === 'csv') {
      if (filteredRows.length === 0) {
        toast.info('Tidak ada baris untuk diekspor', {
          description: 'Ubah atau reset filter terlebih dahulu.',
        })
        return
      }
      try {
        downloadCsv(
          buildCsv(filteredRows, dataset.columns),
          buildExportFileName(dashboard.name, 'csv'),
        )
        toast.success('CSV diunduh')
      } catch {
        toast.error('Ekspor CSV gagal', {
          description: 'Coba lagi setelah filter diterapkan ulang.',
        })
      }
      return
    }

    const node = targetRef.current
    if (!node || !canExportImage) {
      toast.info('Belum ada visual untuk diekspor')
      return
    }

    setBusy(format)
    try {
      await waitForVisuals()
      const dataUrl = await captureNodeAsPng(node)
      const fileName = buildExportFileName(dashboard.name, format)
      if (format === 'png') {
        downloadPngDataUrl(dataUrl, fileName)
      } else {
        await downloadPdfFromImage(dataUrl, fileName)
      }
      toast.success(format === 'png' ? 'PNG diunduh' : 'PDF diunduh')
    } catch {
      toast.error('Ekspor gagal', {
        description: 'Coba lagi setelah dashboard selesai dimuat.',
      })
    } finally {
      setBusy(null)
    }
  }

  return { busy, canExportImage, canExportCsv, exportAs }
}
