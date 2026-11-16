import type { Dashboard } from '@/domain/dashboard.types'
import type { StoredDashboard } from './database'

function isNonEmptyRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Guard bentuk record dashboard yang dibaca dari IndexedDB.
 * Record rusak diperlakukan seperti dashboard yang tidak ada, bukan crash render.
 */
export function isStoredDashboardShape(value: unknown): value is StoredDashboard {
  if (!isNonEmptyRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.datasetId === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    typeof value.datasetFileName === 'string' &&
    typeof value.rowCount === 'number' &&
    Array.isArray(value.widgets) &&
    Array.isArray(value.filters) &&
    isNonEmptyRecord(value.filterState)
  )
}

export function toDomainDashboard(stored: StoredDashboard): Dashboard {
  return {
    id: stored.id,
    name: stored.name,
    datasetId: stored.datasetId,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    widgets: stored.widgets,
    filters: stored.filters,
  }
}
