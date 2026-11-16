import type { Dashboard } from '@/domain/dashboard.types'
import type { Dataset } from '@/domain/dataset.types'
import type { ActiveFilterState } from '@/domain/filter.types'
import { db, type StoredDashboard } from './database'
import { isStoredDashboardShape, toDomainDashboard } from './stored-records'
import { StorageError, toStorageError } from './storage-errors'

export interface SaveWorkspaceInput {
  dataset: Dataset
  dashboard: Dashboard
  filterState: ActiveFilterState
}

export type LoadWorkspaceResult =
  | {
      status: 'ready'
      dashboard: Dashboard
      dataset: Dataset
      filterState: ActiveFilterState
    }
  | { status: 'missing-dashboard' }
  | { status: 'missing-dataset'; dashboard: Dashboard }

export interface StorageCounts {
  dashboards: number
  datasets: number
}

function toStoredDashboard(
  dashboard: Dashboard,
  dataset: Dataset,
  filterState: ActiveFilterState,
): StoredDashboard {
  return {
    ...dashboard,
    filterState,
    datasetFileName: dataset.sourceFileName,
    rowCount: dataset.rowCount,
  }
}

export async function saveWorkspace(input: SaveWorkspaceInput): Promise<Dashboard> {
  const updatedAt = new Date().toISOString()
  const dashboard: Dashboard = { ...input.dashboard, updatedAt }
  const stored = toStoredDashboard(dashboard, input.dataset, input.filterState)

  try {
    await db.transaction('rw', db.datasets, db.dashboards, async () => {
      await db.datasets.put(input.dataset)
      await db.dashboards.put(stored)
    })
    return dashboard
  } catch (cause) {
    throw toStorageError(cause)
  }
}

export async function loadDashboardWorkspace(
  dashboardId: string,
): Promise<LoadWorkspaceResult> {
  try {
    const stored = await db.dashboards.get(dashboardId)
    if (!stored || !isStoredDashboardShape(stored)) {
      return { status: 'missing-dashboard' }
    }

    const dataset = await db.datasets.get(stored.datasetId)
    if (!dataset || !Array.isArray(dataset.columns) || !Array.isArray(dataset.rows)) {
      return { status: 'missing-dataset', dashboard: toDomainDashboard(stored) }
    }

    return {
      status: 'ready',
      dashboard: toDomainDashboard(stored),
      dataset,
      filterState: stored.filterState,
    }
  } catch (cause) {
    throw toStorageError(cause)
  }
}

export async function updateStoredFilterState(
  dashboardId: string,
  filterState: ActiveFilterState,
): Promise<void> {
  try {
    await db.dashboards.update(dashboardId, { filterState })
  } catch (cause) {
    throw toStorageError(cause)
  }
}

export async function renameStoredDashboard(
  dashboardId: string,
  name: string,
): Promise<string> {
  const updatedAt = new Date().toISOString()
  try {
    const updated = await db.dashboards.update(dashboardId, { name, updatedAt })
    if (updated === 0) {
      throw new StorageError('unknown', 'Dashboard tidak ditemukan.')
    }
    return updatedAt
  } catch (cause) {
    throw toStorageError(cause)
  }
}

export async function duplicateStoredDashboard(
  dashboardId: string,
): Promise<StoredDashboard | null> {
  try {
    return await db.transaction('rw', db.dashboards, async () => {
      const source = await db.dashboards.get(dashboardId)
      if (!source) return null

      const now = new Date().toISOString()
      const copy: StoredDashboard = {
        ...source,
        id: crypto.randomUUID(),
        name: `${source.name} (Salinan)`,
        createdAt: now,
        updatedAt: now,
      }
      await db.dashboards.put(copy)
      return copy
    })
  } catch (cause) {
    throw toStorageError(cause)
  }
}

export async function deleteStoredDashboard(dashboardId: string): Promise<void> {
  try {
    await db.transaction('rw', db.datasets, db.dashboards, async () => {
      const dashboard = await db.dashboards.get(dashboardId)
      if (!dashboard) return

      await db.dashboards.delete(dashboardId)
      const remaining = await db.dashboards
        .where('datasetId')
        .equals(dashboard.datasetId)
        .count()
      if (remaining === 0) {
        await db.datasets.delete(dashboard.datasetId)
      }
    })
  } catch (cause) {
    throw toStorageError(cause)
  }
}

export async function clearAllStoredData(): Promise<void> {
  try {
    await db.transaction('rw', db.datasets, db.dashboards, async () => {
      await db.datasets.clear()
      await db.dashboards.clear()
    })
  } catch (cause) {
    throw toStorageError(cause)
  }
}

export async function getStorageCounts(): Promise<StorageCounts> {
  try {
    const [dashboards, datasets] = await Promise.all([
      db.dashboards.count(),
      db.datasets.count(),
    ])
    return { dashboards, datasets }
  } catch (cause) {
    throw toStorageError(cause)
  }
}
