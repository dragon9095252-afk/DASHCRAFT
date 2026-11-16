import { db, type StoredDashboard } from '../database'
import { isStoredDashboardShape } from '../stored-records'
import { toStorageError } from '../storage-errors'

async function listAll(): Promise<StoredDashboard[]> {
  const rows = await db.dashboards.orderBy('updatedAt').reverse().toArray()
  return rows.filter(isStoredDashboardShape)
}

export const dashboardRepository = {
  async list(): Promise<StoredDashboard[]> {
    try {
      return await listAll()
    } catch (cause) {
      throw toStorageError(cause)
    }
  },

  async listRecent(limit = 3): Promise<StoredDashboard[]> {
    try {
      return (await listAll()).slice(0, limit)
    } catch (cause) {
      throw toStorageError(cause)
    }
  },

  async count(): Promise<number> {
    try {
      return await db.dashboards.count()
    } catch (cause) {
      throw toStorageError(cause)
    }
  },
}
