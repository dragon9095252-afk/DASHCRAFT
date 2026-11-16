import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  StorageError,
  storageErrorMessage,
  toStorageError,
} from '@/db/storage-errors'
import type { Dashboard } from '@/domain/dashboard.types'
import type { Dataset, DatasetColumn } from '@/domain/dataset.types'
import { db, type StoredDashboard } from '@/db/database'
import {
  clearAllStoredData,
  deleteStoredDashboard,
  duplicateStoredDashboard,
  getStorageCounts,
  loadDashboardWorkspace,
  renameStoredDashboard,
  saveWorkspace,
  updateStoredFilterState,
} from '@/db/persistence.service'
import { dashboardRepository } from '@/db/repositories/dashboard.repository'

function namedError(name: string, message: string): Error {
  const error = new Error(message)
  error.name = name
  return error
}

describe('storage error translation', () => {
  it('menerjemahkan QuotaExceededError menjadi saran hapus data', () => {
    const error = toStorageError(namedError('QuotaExceededError', 'quota exceeded'))
    expect(error.code).toBe('quota')
    expect(storageErrorMessage(error)).toContain('Pengaturan')
  })

  it('menerjemahkan MissingAPIError menjadi unavailable', () => {
    const error = toStorageError(namedError('MissingAPIError', 'IndexedDB API missing'))
    expect(error.code).toBe('unavailable')
    expect(storageErrorMessage(error)).toContain('selama tab ini terbuka')
  })

  it('mempertahankan StorageError yang sudah diterjemahkan', () => {
    const original = new StorageError('unknown', 'gagal')
    expect(toStorageError(original)).toBe(original)
  })

  it('jatuh ke unknown untuk error lain', () => {
    expect(toStorageError(new Error('boom')).code).toBe('unknown')
  })
})

function column(overrides: Partial<DatasetColumn> = {}): DatasetColumn {
  return {
    id: 'col_0',
    originalName: 'Cabang',
    displayName: 'Cabang',
    type: 'text',
    nullCount: 0,
    distinctCount: 2,
    sampleValues: ['Bandung'],
    inferenceConfidence: 1,
    typeMismatchCount: 0,
    ...overrides,
  }
}

function makeDataset(overrides: Partial<Dataset> = {}): Dataset {
  return {
    id: 'dataset-1',
    name: 'Penjualan',
    sourceFileName: 'penjualan.csv',
    sourceFileType: 'csv',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    rowCount: 2,
    columns: [column()],
    rows: [{ col_0: 'Bandung' }, { col_0: 'Jakarta' }],
    warnings: [],
    ...overrides,
  }
}

function makeDashboard(overrides: Partial<Dashboard> = {}): Dashboard {
  return {
    id: 'dashboard-1',
    name: 'Dashboard Penjualan',
    datasetId: 'dataset-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    widgets: [],
    filters: [],
    ...overrides,
  }
}

const FILTERS = {
  categoryValues: { col_0: ['Bandung'] },
  dateRanges: {},
}

beforeEach(async () => {
  await db.datasets.clear()
  await db.dashboards.clear()
})

describe('persistence service', () => {
  it('menyimpan dataset, dashboard, filter, dan metadata daftar', async () => {
    const saved = await saveWorkspace({
      dataset: makeDataset(),
      dashboard: makeDashboard(),
      filterState: FILTERS,
    })

    expect(saved.updatedAt).not.toBe('2026-01-01T00:00:00.000Z')
    expect(await db.datasets.count()).toBe(1)
    const stored = await db.dashboards.get('dashboard-1')
    expect(stored?.filterState).toEqual(FILTERS)
    expect(stored?.datasetFileName).toBe('penjualan.csv')
    expect(stored?.rowCount).toBe(2)

    const loaded = await loadDashboardWorkspace('dashboard-1')
    expect(loaded).not.toBeNull()
    if (!loaded || loaded.status !== 'ready') throw new Error('expected ready')
    expect(loaded.dataset.id).toBe('dataset-1')
    expect(loaded.dashboard.name).toBe('Dashboard Penjualan')
    expect(loaded.filterState).toEqual(FILTERS)
  })

  it('membatalkan transaksi bila data gagal dikloning', async () => {
    await expect(
      saveWorkspace({
        dataset: makeDataset(),
        dashboard: {
          ...makeDashboard(),
          widgets: [
            {
              id: 'widget-1',
              title: 'Rusak',
              visible: true,
              order: 0,
              kind: 'kpi',
              metric: 'count',
              numberFormat: 'default',
              gagal: () => 'fungsi',
            },
          ],
        } as unknown as Dashboard,
        filterState: FILTERS,
      }),
    ).rejects.toMatchObject({ name: 'StorageError' })

    expect(await db.datasets.count()).toBe(0)
    expect(await db.dashboards.count()).toBe(0)
  })

  it('menyimpan filter tanpa mengubah updatedAt dashboard', async () => {
    await saveWorkspace({
      dataset: makeDataset(),
      dashboard: makeDashboard(),
      filterState: FILTERS,
    })
    const before = await db.dashboards.get('dashboard-1')

    await updateStoredFilterState('dashboard-1', {
      categoryValues: { col_0: ['Jakarta'] },
      dateRanges: {},
    })

    const after = await db.dashboards.get('dashboard-1')
    expect(after?.updatedAt).toBe(before?.updatedAt)
    expect(after?.filterState.categoryValues.col_0).toEqual(['Jakarta'])
  })

  it('mengganti nama dan memperbarui updatedAt', async () => {
    await saveWorkspace({
      dataset: makeDataset(),
      dashboard: makeDashboard(),
      filterState: FILTERS,
    })

    const updatedAt = await renameStoredDashboard('dashboard-1', 'Nama Baru')
    const stored = await db.dashboards.get('dashboard-1')
    expect(stored?.name).toBe('Nama Baru')
    expect(stored?.updatedAt).toBe(updatedAt)
  })

  it('menduplikasi dashboard dengan id baru dan filter tersalin', async () => {
    await saveWorkspace({
      dataset: makeDataset(),
      dashboard: makeDashboard(),
      filterState: FILTERS,
    })

    const copy = await duplicateStoredDashboard('dashboard-1')
    expect(copy).not.toBeNull()
    expect(copy?.id).not.toBe('dashboard-1')
    expect(copy?.name).toBe('Dashboard Penjualan (Salinan)')
    expect(copy?.datasetId).toBe('dataset-1')
    expect(copy?.filterState).toEqual(FILTERS)
  })

  it('menghapus dataset yatim saat dashboard terakhir dihapus', async () => {
    await saveWorkspace({
      dataset: makeDataset(),
      dashboard: makeDashboard(),
      filterState: FILTERS,
    })

    await deleteStoredDashboard('dashboard-1')
    expect(await db.dashboards.count()).toBe(0)
    expect(await db.datasets.count()).toBe(0)
  })

  it('mempertahankan dataset yang masih dipakai dashboard lain', async () => {
    await saveWorkspace({
      dataset: makeDataset(),
      dashboard: makeDashboard(),
      filterState: FILTERS,
    })
    await saveWorkspace({
      dataset: makeDataset(),
      dashboard: makeDashboard({ id: 'dashboard-2', name: 'Dashboard Kedua' }),
      filterState: FILTERS,
    })

    await deleteStoredDashboard('dashboard-1')
    expect(await db.dashboards.count()).toBe(1)
    expect(await db.datasets.count()).toBe(1)
  })

  it('mengurutkan daftar berdasarkan updatedAt terbaru', async () => {
    await saveWorkspace({
      dataset: makeDataset(),
      dashboard: makeDashboard(),
      filterState: FILTERS,
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    await saveWorkspace({
      dataset: makeDataset(),
      dashboard: makeDashboard({ id: 'dashboard-2', name: 'Dashboard Kedua' }),
      filterState: FILTERS,
    })

    const list = await dashboardRepository.list()
    expect(list.map((item) => item.id)).toEqual(['dashboard-2', 'dashboard-1'])
    expect((await dashboardRepository.listRecent(1)).map((item) => item.id)).toEqual([
      'dashboard-2',
    ])
  })

  it('melaporkan dataset yang hilang tanpa menghapus dashboard', async () => {
    await saveWorkspace({
      dataset: makeDataset(),
      dashboard: makeDashboard(),
      filterState: FILTERS,
    })
    await db.datasets.delete('dataset-1')

    const loaded = await loadDashboardWorkspace('dashboard-1')
    expect(loaded?.status).toBe('missing-dataset')
    expect(await db.dashboards.count()).toBe(1)
  })

  it('mengosongkan kedua tabel dan menghitung isi', async () => {
    await saveWorkspace({
      dataset: makeDataset(),
      dashboard: makeDashboard(),
      filterState: FILTERS,
    })
    expect(await getStorageCounts()).toEqual({ dashboards: 1, datasets: 1 })

    await clearAllStoredData()
    expect(await getStorageCounts()).toEqual({ dashboards: 0, datasets: 0 })
  })
})

describe('stored record guard', () => {
  async function seedWithCorruptRow(): Promise<void> {
    await saveWorkspace({
      dataset: makeDataset(),
      dashboard: makeDashboard(),
      filterState: FILTERS,
    })
    const validStored = await db.dashboards.get('dashboard-1')
    if (!validStored) throw new Error('expected stored dashboard')
    await db.dashboards.put({
      ...validStored,
      id: 'rusak',
      widgets: undefined,
    } as unknown as StoredDashboard)
  }

  it('menyaring record rusak dari daftar dan daftar terbaru', async () => {
    await seedWithCorruptRow()

    expect(await db.dashboards.count()).toBe(2)
    expect((await dashboardRepository.list()).map((item) => item.id)).toEqual([
      'dashboard-1',
    ])
    expect((await dashboardRepository.listRecent(10)).map((item) => item.id)).toEqual([
      'dashboard-1',
    ])
    expect((await dashboardRepository.listRecent(1)).map((item) => item.id)).toEqual([
      'dashboard-1',
    ])
  })

  it('menganggap record tanpa widgets sebagai dashboard hilang', async () => {
    await seedWithCorruptRow()

    expect(await loadDashboardWorkspace('rusak')).toEqual({
      status: 'missing-dashboard',
    })
  })
})
