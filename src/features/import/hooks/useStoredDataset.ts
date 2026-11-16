import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Dataset } from '@/domain/dataset.types'
import { datasetRepository } from '@/db/repositories/dataset.repository'
import { storageErrorMessage, toStorageError } from '@/db/storage-errors'
import { useDashboardStore } from '@/state/dashboard-store'

export type StoredDatasetStatus = 'loading' | 'ready' | 'missing'

export function useStoredDataset(datasetId: string | undefined): {
  dataset: Dataset | null
  status: StoredDatasetStatus
} {
  const { getDataset, addDataset } = useDashboardStore()
  const storeDataset = datasetId ? getDataset(datasetId) : undefined
  const [loadedDataset, setLoadedDataset] = useState<Dataset | null>(null)
  const [status, setStatus] = useState<StoredDatasetStatus>(
    storeDataset ? 'ready' : datasetId ? 'loading' : 'missing',
  )

  useEffect(() => {
    if (!datasetId) {
      setLoadedDataset(null)
      setStatus('missing')
      return
    }
    if (storeDataset) {
      setStatus('ready')
      return
    }

    let active = true
    setLoadedDataset(null)
    setStatus('loading')
    datasetRepository
      .get(datasetId)
      .then((dataset) => {
        if (!active) return
        if (!dataset) {
          setStatus('missing')
          return
        }
        addDataset(dataset)
        setLoadedDataset(dataset)
        setStatus('ready')
      })
      .catch(() => {
        if (active) setStatus('missing')
      })

    return () => {
      active = false
    }
  }, [datasetId, storeDataset, addDataset])

  return { dataset: storeDataset ?? loadedDataset, status }
}

export function useDatasetAutosave(dataset: Dataset | null): void {
  const failedRef = useRef(false)
  const latestRef = useRef<Dataset | null>(dataset)
  latestRef.current = dataset

  useEffect(() => {
    if (!dataset) return

    const timer = setTimeout(() => {
      datasetRepository.save(dataset).catch((cause) => {
        if (failedRef.current) return
        failedRef.current = true
        const error = toStorageError(cause)
        toast.warning('Perubahan kolom tidak tersimpan', {
          description: storageErrorMessage(error),
        })
      })
    }, 400)

    return () => clearTimeout(timer)
  }, [dataset])

  useEffect(() => {
    return () => {
      const snapshot = latestRef.current
      if (snapshot) {
        void datasetRepository.save(snapshot).catch(() => undefined)
      }
    }
  }, [])
}
