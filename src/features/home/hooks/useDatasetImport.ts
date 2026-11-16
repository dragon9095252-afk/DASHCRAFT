import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { WorkBook } from 'xlsx'
import { useDashboardStore } from '@/state/dashboard-store'
import { datasetRepository } from '@/db/repositories/dataset.repository'
import { storageErrorMessage, toStorageError } from '@/db/storage-errors'
import type { SourceFileType } from '@/domain/dataset.types'
import {
  ImportError,
  buildDataset,
  listSheets,
  parseWorkbook,
  validateFile,
} from '@/services/file-import.service'

export interface PendingImport {
  file: File
  workbook: WorkBook
  sheets: string[]
  fileType: SourceFileType
}

export function useDatasetImport() {
  const navigate = useNavigate()
  const { addDataset } = useDashboardStore()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingImport | null>(null)

  function finalizeImport(
    file: File,
    workbook: WorkBook,
    fileType: SourceFileType,
    sheetName: string | undefined,
  ) {
    const dataset = buildDataset({
      workbook,
      fileName: file.name,
      fileType,
      sheetName: fileType === 'csv' ? undefined : sheetName,
    })
    addDataset(dataset)
    void datasetRepository.save(dataset).catch((cause) => {
      const error = toStorageError(cause)
      toast.warning('Dataset tidak tersimpan permanen', {
        description: storageErrorMessage(error),
      })
    })
    setError(null)
    toast.success('File berhasil dibaca', {
      description: `${dataset.rowCount} baris · ${dataset.columns.length} kolom.`,
    })
    navigate(`/data-preview/${dataset.id}`)
  }

  async function handleFile(file: File) {
    setError(null)
    setProcessing(true)
    try {
      const fileType = validateFile(file)
      const workbook = await parseWorkbook(file)
      const sheets = listSheets(workbook)

      if (fileType !== 'csv' && sheets.length > 1) {
        setPending({ file, workbook, sheets, fileType })
        return
      }

      finalizeImport(file, workbook, fileType, sheets[0])
    } catch (caught) {
      const message =
        caught instanceof ImportError
          ? caught.message
          : 'Terjadi kesalahan saat membaca file. Coba file lain.'
      setError(message)
      toast.error('File gagal dibaca', { description: message })
    } finally {
      setProcessing(false)
    }
  }

  function confirmSheet(sheetName: string) {
    if (!pending) return
    const { file, workbook, fileType } = pending
    setPending(null)
    try {
      finalizeImport(file, workbook, fileType, sheetName)
    } catch (caught) {
      const message =
        caught instanceof ImportError
          ? caught.message
          : 'Worksheet tidak dapat diproses. Coba sheet lain.'
      setError(message)
      toast.error('Worksheet gagal diproses', { description: message })
    }
  }

  return {
    processing,
    error,
    pending,
    handleFile,
    confirmSheet,
    closeSheet: () => setPending(null),
  }
}
