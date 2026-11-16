import Dexie, { type EntityTable } from 'dexie'
import type { Dashboard } from '@/domain/dashboard.types'
import type { Dataset } from '@/domain/dataset.types'
import type { ActiveFilterState } from '@/domain/filter.types'

export interface StoredDashboard extends Dashboard {
  /** Filter aktif terakhir, dipulihkan saat dashboard dibuka. */
  filterState: ActiveFilterState
  /** Metadata daftar agar tidak memuat rows dataset. */
  datasetFileName: string
  rowCount: number
}

export class DashcraftDatabase extends Dexie {
  datasets!: EntityTable<Dataset, 'id'>
  dashboards!: EntityTable<StoredDashboard, 'id'>

  constructor() {
    super('dashcraft')
    this.version(1).stores({
      datasets: 'id, name, createdAt, updatedAt',
      dashboards: 'id, name, datasetId, createdAt, updatedAt',
    })
  }
}

export const db = new DashcraftDatabase()
