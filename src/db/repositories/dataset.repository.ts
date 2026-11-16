import type { Dataset } from '@/domain/dataset.types'
import { db } from '../database'
import { toStorageError } from '../storage-errors'

export const datasetRepository = {
  async get(id: string): Promise<Dataset | undefined> {
    try {
      return await db.datasets.get(id)
    } catch (cause) {
      throw toStorageError(cause)
    }
  },

  async save(dataset: Dataset): Promise<void> {
    try {
      await db.datasets.put(dataset)
    } catch (cause) {
      throw toStorageError(cause)
    }
  },

  async count(): Promise<number> {
    try {
      return await db.datasets.count()
    } catch (cause) {
      throw toStorageError(cause)
    }
  },
}
