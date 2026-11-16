# Stage 5 — Local Persistence and Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist datasets and dashboards in IndexedDB, expose accurate Save/dirty status, add Dashboard Saya management and clear-all settings, and export the current dashboard as PNG, PDF, or filtered CSV.

**Architecture:** The existing React context store remains the session working set. A new `src/db` layer owns Dexie and repositories; a persistence service coordinates cross-table transactions. Pages hydrate lazily from Dexie on refresh, while small dashboard lists use `useLiveQuery`. Export builds CSV purely and captures the dashboard DOM with `html-to-image` + `jsPDF`.

**Tech Stack:** React 19, TypeScript 7 (strict), Vite 8, Tailwind v4, shadcn/ui, Dexie 4, dexie-react-hooks, html-to-image, jsPDF, Sonner, Vitest 5, fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-11-13-stage5-persistence-export-design.md`

## Global Constraints

- Project root is `D:\AI\dashcraft`. Run every command from that directory.
- `D:\AI\dashcraft` is **not a git repository**. Do not run `git init`, `git add`, or `git commit`; each task ends with a build/test checkpoint instead of a commit.
- TypeScript 7 is strict with `verbatimModuleSyntax`, `noUnusedLocals`, and `noUnusedParameters`. Type-only imports must use `import type`. Use the `@/` alias; there is no `baseUrl`.
- Dexie may only be imported inside `src/db`. React components and features call repositories, the persistence service, or hooks.
- No backend, login, cloud sync, external API, analytics, or dataset upload. Never log dataset rows or send dataset contents anywhere.
- All user-facing copy is Indonesian.
- Never silently modify raw row values. CSV export normalizes formatting only at output time.
- Preserve the MVP limits: 20 MB file, one file/worksheet per dashboard, 50 preview rows/page, 10 chart categories by default.
- Keep the existing 22 tests passing. Stage 6 QA work is out of scope.
- Use `npm install dexie dexie-react-hooks html-to-image jspdf` and `npm install -D fake-indexeddb`; do not upgrade unrelated dependencies.

---

## File Structure

New files:

- `src/db/database.ts` — Dexie instance and `StoredDashboard` record type.
- `src/db/storage-errors.ts` — `StorageError`, translation, Indonesian messages.
- `src/db/repositories/dataset.repository.ts` — dataset table reads/writes.
- `src/db/repositories/dashboard.repository.ts` — dashboard table reads/counts.
- `src/db/persistence.service.ts` — workspace transactions and dashboard lifecycle.
- `src/db/useStorageStatus.ts` — IndexedDB availability probe and hook.
- `src/components/common/LoadingState.tsx` — shared loading indicator.
- `src/components/common/StorageUnavailableNotice.tsx` — shared unavailable banner.
- `src/features/import/hooks/useStoredDataset.ts` — dataset hydration and autosave.
- `src/features/dashboards/components/RenameDashboardDialog.tsx` — rename dialog.
- `src/features/dashboard/hooks/useDashboardExport.ts` — export busy state and toasts.
- `src/services/export.service.ts` — CSV builder, capture, PDF, downloads, filenames.
- `tests/storage.test.ts` — storage errors, repositories, and persistence service.
- `tests/export-csv.test.ts` — pure CSV and filename behavior.

Modified files:

- `src/state/dashboard-store.tsx`
- `src/features/home/hooks/useDatasetImport.ts`
- `src/features/import/pages/DataPreviewPage.tsx`
- `src/features/dashboards/pages/DashboardsPage.tsx`
- `src/features/dashboard/hooks/useDashboardWorkspace.ts`
- `src/features/dashboard/pages/DashboardBuilderPage.tsx`
- `src/features/dashboard/components/DashboardHeader.tsx`
- `src/features/dashboard/components/WidgetMenu.tsx`
- `src/features/home/components/RecentDashboards.tsx`
- `src/features/home/pages/HomePage.tsx`
- `src/features/settings/pages/SettingsPage.tsx`
- `package.json`, `package-lock.json`, `README.md`

---

### Task 1: Dexie Foundation and Storage Error Translation

**Files:**
- Create: `src/db/database.ts`
- Create: `src/db/storage-errors.ts`
- Test: `tests/storage.test.ts`

**Interfaces:**
- Produces: `StoredDashboard`, `DashcraftDatabase`, `db`, `StorageError`, `StorageErrorCode`, `toStorageError(cause: unknown): StorageError`, `storageErrorMessage(error: StorageError): string`.

- [ ] **Step 1: Install persistence and export dependencies**

Run:

```bash
npm install dexie dexie-react-hooks html-to-image jspdf
npm install -D fake-indexeddb
```

Expected: `package.json` lists the four runtime packages and `fake-indexeddb` under devDependencies.

- [ ] **Step 2: Write the failing storage-error tests**

Create `tests/storage.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  StorageError,
  storageErrorMessage,
  toStorageError,
} from '@/db/storage-errors'

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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/storage.test.ts`

Expected: FAIL because `@/db/storage-errors` does not exist.

- [ ] **Step 4: Implement the Dexie database**

Create `src/db/database.ts`:

```ts
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
```

- [ ] **Step 5: Implement storage error translation**

Create `src/db/storage-errors.ts`:

```ts
export type StorageErrorCode = 'unavailable' | 'quota' | 'unknown'

export class StorageError extends Error {
  readonly code: StorageErrorCode

  constructor(code: StorageErrorCode, message: string) {
    super(message)
    this.name = 'StorageError'
    this.code = code
  }
}

function errorName(cause: unknown): string {
  return cause instanceof Error ? cause.name : ''
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause ?? '')
}

export function toStorageError(cause: unknown): StorageError {
  if (cause instanceof StorageError) return cause

  const name = errorName(cause)
  const message = errorMessage(cause)

  if (name === 'MissingAPIError' || /indexeddb|indexed db/i.test(message)) {
    return new StorageError('unavailable', 'IndexedDB tidak tersedia di browser ini.')
  }
  if (name === 'QuotaExceededError' || /quota|storage.*full/i.test(message)) {
    return new StorageError('quota', 'Ruang penyimpanan browser penuh.')
  }
  return new StorageError('unknown', 'Penyimpanan lokal gagal diakses.')
}

export function storageErrorMessage(error: StorageError): string {
  switch (error.code) {
    case 'unavailable':
      return 'Penyimpanan browser tidak tersedia. Data tetap bisa dipakai selama tab ini terbuka.'
    case 'quota':
      return 'Ruang penyimpanan browser penuh. Hapus data lokal di Pengaturan lalu coba lagi.'
    case 'unknown':
      return 'Data gagal disimpan. Coba lagi, atau hapus data lokal bila masalah berlanjut.'
  }
}
```

- [ ] **Step 6: Run the tests and type-check**

Run:

```bash
npx vitest run tests/storage.test.ts
npm run build
```

Expected: 4 tests PASS and the production build succeeds.

---

### Task 2: Repositories and Persistence Service

**Files:**
- Create: `src/db/repositories/dataset.repository.ts`
- Create: `src/db/repositories/dashboard.repository.ts`
- Create: `src/db/persistence.service.ts`
- Modify: `tests/storage.test.ts` (append imports and `describe` blocks)

**Interfaces:**
- Consumes: `db`, `StoredDashboard`, `toStorageError` from Task 1.
- Produces:
  - `datasetRepository.get(id): Promise<Dataset | undefined>`
  - `datasetRepository.save(dataset): Promise<void>`
  - `datasetRepository.count(): Promise<number>`
  - `dashboardRepository.list(): Promise<StoredDashboard[]>`
  - `dashboardRepository.listRecent(limit?: number): Promise<StoredDashboard[]>`
  - `dashboardRepository.count(): Promise<number>`
  - `saveWorkspace(input: SaveWorkspaceInput): Promise<Dashboard>`
  - `loadDashboardWorkspace(id): Promise<LoadWorkspaceResult>`
  - `updateStoredFilterState(id, state): Promise<void>`
  - `renameStoredDashboard(id, name): Promise<string>`
  - `duplicateStoredDashboard(id): Promise<StoredDashboard | null>`
  - `deleteStoredDashboard(id): Promise<void>`
  - `clearAllStoredData(): Promise<void>`
  - `getStorageCounts(): Promise<StorageCounts>`

- [ ] **Step 1: Add the failing repository/service tests**

Replace the first import line of `tests/storage.test.ts` with:

```ts
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Dashboard } from '@/domain/dashboard.types'
import type { Dataset, DatasetColumn } from '@/domain/dataset.types'
import { db } from '@/db/database'
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
```

Append this code to the end of `tests/storage.test.ts`:

```ts
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
        dataset: makeDataset({ rows: [{ col_0: () => 'fungsi' }] }),
        dashboard: makeDashboard(),
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/storage.test.ts`

Expected: FAIL because the repositories and persistence service do not exist.

- [ ] **Step 3: Implement the repositories**

Create `src/db/repositories/dataset.repository.ts`:

```ts
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
```

Create `src/db/repositories/dashboard.repository.ts`:

```ts
import { db, type StoredDashboard } from '../database'
import { toStorageError } from '../storage-errors'

async function listAll(): Promise<StoredDashboard[]> {
  return db.dashboards.orderBy('updatedAt').reverse().toArray()
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
```

- [ ] **Step 4: Implement the persistence service**

Create `src/db/persistence.service.ts`:

```ts
import type { Dashboard } from '@/domain/dashboard.types'
import type { Dataset } from '@/domain/dataset.types'
import type { ActiveFilterState } from '@/domain/filter.types'
import { db, type StoredDashboard } from './database'
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

function toDomainDashboard(stored: StoredDashboard): Dashboard {
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
    if (
      !stored ||
      !Array.isArray(stored.widgets) ||
      !Array.isArray(stored.filters) ||
      !stored.filterState
    ) {
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
```

- [ ] **Step 5: Run the storage tests**

Run: `npx vitest run tests/storage.test.ts`

Expected: all storage error and persistence tests PASS.

- [ ] **Step 6: Run the full suite and build**

Run:

```bash
npm test
npm run build
```

Expected: existing 22 tests plus the new storage tests pass; type-check and production build succeed.

---

### Task 3: Store Persistence State

**Files:**
- Modify: `src/state/dashboard-store.tsx`

**Interfaces:**
- Consumes: `Dataset`, `Dashboard`, `ActiveFilterState`.
- Produces on `useDashboardStore()`:
  - `loadWorkspace(dataset, dashboard, filterState): void`
  - `markDashboardSaved(dashboardId, updatedAt): void`
  - `isDashboardDirty(dashboardId): boolean`
  - `isDashboardPersisted(dashboardId): boolean`
  - `resetSession(): void`
  - `applyDashboardRename(dashboardId, name): void`
  - `updateColumnType(...): Dataset | null`
  - `updateColumnDisplayName(...): Dataset | null`

- [ ] **Step 1: Add the persisted/dirty maps and helpers**

In `src/state/dashboard-store.tsx`, extend the interface:

```ts
interface DashboardStoreValue {
  datasets: Dataset[]
  dashboards: Dashboard[]
  getDataset: (id: string) => Dataset | undefined
  getDashboard: (id: string) => Dashboard | undefined
  addDataset: (dataset: Dataset) => void
  updateColumnType: (datasetId: string, columnId: string, type: ColumnType) => Dataset | null
  updateColumnDisplayName: (
    datasetId: string,
    columnId: string,
    displayName: string,
  ) => Dataset | null
  createDashboard: (dataset: Dataset) => Dashboard
  updateWidget: (dashboardId: string, widget: DashboardWidget) => void
  addWidget: (dashboardId: string, widget: DashboardWidget) => void
  removeWidget: (dashboardId: string, widgetId: string) => void
  duplicateWidget: (dashboardId: string, widgetId: string) => DashboardWidget | null
  moveWidget: (dashboardId: string, widgetId: string, direction: 'up' | 'down') => void
  deleteDashboard: (dashboardId: string) => void
  getFilterState: (dashboardId: string) => ActiveFilterState
  setFilterState: (dashboardId: string, state: ActiveFilterState) => void
  resetFilterState: (dashboardId: string) => void
  loadWorkspace: (
    dataset: Dataset,
    dashboard: Dashboard,
    filterState: ActiveFilterState,
  ) => void
  markDashboardSaved: (dashboardId: string, updatedAt: string) => void
  isDashboardDirty: (dashboardId: string) => boolean
  isDashboardPersisted: (dashboardId: string) => boolean
  resetSession: () => void
  applyDashboardRename: (dashboardId: string, name: string) => void
}
```

Add this module-level helper above `DashboardStoreContext`:

```ts
function withoutKey(record: Record<string, true>, key: string): Record<string, true> {
  if (!record[key]) return record
  const next = { ...record }
  delete next[key]
  return next
}
```

Inside `DashboardStoreProvider`, add state next to the existing state:

```ts
const [persistedIds, setPersistedIds] = useState<Record<string, true>>({})
const [dirtyIds, setDirtyIds] = useState<Record<string, true>>({})
```

- [ ] **Step 2: Make column updates return the updated dataset**

Replace `updateColumnType` and `updateColumnDisplayName` with:

```ts
const updateColumnType = useCallback(
  (datasetId: string, columnId: string, type: ColumnType): Dataset | null => {
    const current = datasets.find((dataset) => dataset.id === datasetId)
    if (!current) return null

    const updated: Dataset = {
      ...current,
      updatedAt: new Date().toISOString(),
      columns: current.columns.map((column) =>
        column.id === columnId ? withColumnType(column, current.rows, type) : column,
      ),
    }
    setDatasets((previous) =>
      previous.map((dataset) => (dataset.id === datasetId ? updated : dataset)),
    )
    return updated
  },
  [datasets],
)

const updateColumnDisplayName = useCallback(
  (datasetId: string, columnId: string, displayName: string): Dataset | null => {
    const current = datasets.find((dataset) => dataset.id === datasetId)
    if (!current) return null
    const trimmed = displayName.trim()
    if (!trimmed) return current

    const updated: Dataset = {
      ...current,
      updatedAt: new Date().toISOString(),
      columns: current.columns.map((column) =>
        column.id === columnId ? { ...column, displayName: trimmed } : column,
      ),
    }
    setDatasets((previous) =>
      previous.map((dataset) => (dataset.id === datasetId ? updated : dataset)),
    )
    return updated
  },
  [datasets],
)
```

- [ ] **Step 3: Mark configuration mutations dirty**

In `createDashboard`, add `setDirtyIds` after the existing state updates:

```ts
setDirtyIds((previous) => ({ ...previous, [dashboard.id]: true }))
```

In `updateWidget`, `addWidget`, `removeWidget`, and `moveWidget`, add this after the `setDashboards` call:

```ts
setDirtyIds((previous) => ({ ...previous, [dashboardId]: true }))
```

In `duplicateWidget`, add it after the `setDashboards` call only when duplication succeeded:

```ts
setDirtyIds((previous) => ({ ...previous, [dashboardId]: true }))
```

In `deleteDashboard`, also remove both tracking entries:

```ts
setPersistedIds((previous) => withoutKey(previous, dashboardId))
setDirtyIds((previous) => withoutKey(previous, dashboardId))
```

- [ ] **Step 4: Add hydration, save, reset, rename, and predicates**

Add these callbacks after `resetFilterState`:

```ts
const loadWorkspace = useCallback(
  (dataset: Dataset, dashboard: Dashboard, filterState: ActiveFilterState) => {
    addDataset(dataset)
    setDashboards((previous) => {
      const index = previous.findIndex((item) => item.id === dashboard.id)
      if (index === -1) return [dashboard, ...previous]
      const next = [...previous]
      next[index] = dashboard
      return next
    })
    setFilterStates((previous) => ({ ...previous, [dashboard.id]: filterState }))
    setPersistedIds((previous) => ({ ...previous, [dashboard.id]: true }))
    setDirtyIds((previous) => withoutKey(previous, dashboard.id))
  },
  [addDataset],
)

const markDashboardSaved = useCallback((dashboardId: string, updatedAt: string) => {
  setDashboards((previous) =>
    previous.map((dashboard) =>
      dashboard.id === dashboardId ? { ...dashboard, updatedAt } : dashboard,
    ),
  )
  setPersistedIds((previous) => ({ ...previous, [dashboardId]: true }))
  setDirtyIds((previous) => withoutKey(previous, dashboardId))
}, [])

const isDashboardDirty = useCallback(
  (dashboardId: string) => dirtyIds[dashboardId] === true,
  [dirtyIds],
)

const isDashboardPersisted = useCallback(
  (dashboardId: string) => persistedIds[dashboardId] === true,
  [persistedIds],
)

const resetSession = useCallback(() => {
  setDatasets([])
  setDashboards([])
  setFilterStates({})
  setPersistedIds({})
  setDirtyIds({})
}, [])

const applyDashboardRename = useCallback((dashboardId: string, name: string) => {
  setDashboards((previous) =>
    previous.map((dashboard) =>
      dashboard.id === dashboardId ? { ...dashboard, name } : dashboard,
    ),
  )
}, [])
```

- [ ] **Step 5: Expose the new values**

Add all new callbacks to the `useMemo` value and its dependency array. The returned object must include:

```ts
loadWorkspace,
markDashboardSaved,
isDashboardDirty,
isDashboardPersisted,
resetSession,
applyDashboardRename,
```

- [ ] **Step 6: Verify the store change**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and the build succeeds. Store behavior gets end-to-end coverage in Tasks 7 and 10.

---

### Task 4: Dataset Auto-Save and Preview Hydration

**Files:**
- Create: `src/components/common/LoadingState.tsx`
- Create: `src/features/import/hooks/useStoredDataset.ts`
- Modify: `src/features/home/hooks/useDatasetImport.ts`
- Modify: `src/features/import/pages/DataPreviewPage.tsx`

**Interfaces:**
- Consumes: `datasetRepository`, `toStorageError`, `storageErrorMessage`, `useDashboardStore`.
- Produces:
  - `LoadingState({ label?, compact?, className? })`
  - `useStoredDataset(datasetId: string | undefined): { dataset: Dataset | null; status: 'loading' | 'ready' | 'missing' }`
  - `useDatasetAutosave(dataset: Dataset | null): void`

- [ ] **Step 1: Create the shared loading component**

Create `src/components/common/LoadingState.tsx`:

```tsx
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LoadingState({
  label = 'Memuat data…',
  compact = false,
  className,
}: {
  label?: string
  compact?: boolean
  className?: string
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center justify-center gap-2 text-muted-foreground',
        compact ? 'py-6' : 'py-16',
        className,
      )}
    >
      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
```

- [ ] **Step 2: Create the dataset hydration and autosave hook**

Create `src/features/import/hooks/useStoredDataset.ts`:

```ts
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
```

- [ ] **Step 3: Save imported datasets automatically**

In `src/features/home/hooks/useDatasetImport.ts`, add imports:

```ts
import { datasetRepository } from '@/db/repositories/dataset.repository'
import { storageErrorMessage, toStorageError } from '@/db/storage-errors'
```

Inside `finalizeImport`, immediately after `addDataset(dataset)`, add:

```ts
void datasetRepository.save(dataset).catch((cause) => {
  const error = toStorageError(cause)
  toast.warning('Dataset tidak tersimpan permanen', {
    description: storageErrorMessage(error),
  })
})
```

Navigation must remain unchanged and must not wait for the save.

- [ ] **Step 4: Hydrate and autosave the preview page**

In `src/features/import/pages/DataPreviewPage.tsx`:

1. Add `import { LoadingState } from '@/components/common/LoadingState'`.
2. Replace the hook import line with:

```ts
import { useDatasetAutosave, useStoredDataset } from '../hooks/useStoredDataset'
```

3. Destructure only the store actions:

```ts
const {
  updateColumnType,
  updateColumnDisplayName,
  createDashboard,
} = useDashboardStore()
```

4. Replace the dataset lookup and guards with:

```ts
const { dataset, status } = useStoredDataset(datasetId)
useDatasetAutosave(dataset)

if (status === 'loading') {
  return (
    <PageContainer>
      <LoadingState label="Memuat dataset…" />
    </PageContainer>
  )
}

if (!dataset) {
  return (
    <PageContainer>
      <EmptyState
        icon={Info}
        title="Dataset tidak ditemukan"
        description="Dataset ini tidak ada di penyimpanan browser. Mungkin sudah dihapus atau dibuat di tab lain."
        action={
          <Button asChild>
            <Link to="/">Kembali ke Beranda</Link>
          </Button>
        }
      />
    </PageContainer>
  )
}
```

5. Remove the old `const activeDataset = dataset` alias and use `dataset` directly in `handleCreateDashboard` and both column handlers.

- [ ] **Step 5: Verify**

Run:

```bash
npm test
npm run build
```

Expected: tests pass and the build succeeds.

---

### Task 5: Storage Status UI and Dashboard Saya

**Files:**
- Create: `src/db/useStorageStatus.ts`
- Create: `src/components/common/StorageUnavailableNotice.tsx`
- Create: `src/features/dashboards/components/RenameDashboardDialog.tsx`
- Modify: `src/features/dashboards/pages/DashboardsPage.tsx`

**Interfaces:**
- Consumes: `dashboardRepository`, `deleteStoredDashboard`, `duplicateStoredDashboard`, `renameStoredDashboard`, `useDashboardStore().applyDashboardRename/deleteDashboard`, `LoadingState`.
- Produces:
  - `useStorageStatus(): 'checking' | 'available' | 'unavailable'`
  - `StorageUnavailableNotice({ className? })`
  - `RenameDashboardDialog({ dashboard, onOpenChange, onRename })`

- [ ] **Step 1: Implement the storage status hook**

Create `src/db/useStorageStatus.ts`:

```ts
import { useEffect, useState } from 'react'
import { db } from './database'

export type StorageStatus = 'checking' | 'available' | 'unavailable'

let probe: Promise<boolean> | null = null

function probeStorage(): Promise<boolean> {
  probe ??= (async () => {
    if (typeof indexedDB === 'undefined') return false
    try {
      await db.open()
      return true
    } catch {
      return false
    }
  })()
  return probe
}

export function useStorageStatus(): StorageStatus {
  const [status, setStatus] = useState<StorageStatus>('checking')

  useEffect(() => {
    let active = true
    void probeStorage().then((available) => {
      if (active) setStatus(available ? 'available' : 'unavailable')
    })
    return () => {
      active = false
    }
  }, [])

  return status
}
```

- [ ] **Step 2: Implement the shared unavailable banner**

Create `src/components/common/StorageUnavailableNotice.tsx`:

```tsx
import { TriangleAlert } from 'lucide-react'
import { useStorageStatus } from '@/db/useStorageStatus'
import { cn } from '@/lib/utils'

export function StorageUnavailableNotice({ className }: { className?: string }) {
  const status = useStorageStatus()
  if (status !== 'unavailable') return null

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2 rounded-lg border border-warning/20 bg-warning-soft px-4 py-3 text-xs leading-relaxed text-muted-foreground',
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
      <p>
        Penyimpanan browser (IndexedDB) tidak tersedia. Dataset dan dashboard hanya bertahan
        selama tab ini terbuka.
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Implement the rename dialog**

Create `src/features/dashboards/components/RenameDashboardDialog.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { StoredDashboard } from '@/db/database'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export function RenameDashboardDialog({
  dashboard,
  onOpenChange,
  onRename,
}: {
  dashboard: StoredDashboard | null
  onOpenChange: (open: boolean) => void
  onRename: (name: string) => Promise<void>
}) {
  const [name, setName] = useState('')

  useEffect(() => {
    setName(dashboard?.name ?? '')
  }, [dashboard])

  const trimmed = name.trim()

  return (
    <Dialog open={dashboard !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (trimmed) void onRename(trimmed)
          }}
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>Ganti nama dashboard</DialogTitle>
            <DialogDescription>
              Nama baru langsung tersimpan di browser ini.
            </DialogDescription>
          </DialogHeader>

          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Nama dashboard"
            placeholder="Nama dashboard"
          />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Batal
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!trimmed}>
              Simpan nama
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Replace Dashboard Saya with Dexie-backed management**

Replace `src/features/dashboards/pages/DashboardsPage.tsx` with:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, Copy, LayoutDashboard, Pencil, Trash2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { LoadingState } from '@/components/common/LoadingState'
import { StorageUnavailableNotice } from '@/components/common/StorageUnavailableNotice'
import { Button } from '@/components/ui/button'
import type { StoredDashboard } from '@/db/database'
import {
  deleteStoredDashboard,
  duplicateStoredDashboard,
  renameStoredDashboard,
} from '@/db/persistence.service'
import { dashboardRepository } from '@/db/repositories/dashboard.repository'
import { storageErrorMessage, toStorageError } from '@/db/storage-errors'
import { useStorageStatus } from '@/db/useStorageStatus'
import { formatRelativeTime } from '@/lib/formatters'
import { useDashboardStore } from '@/state/dashboard-store'
import { RenameDashboardDialog } from '../components/RenameDashboardDialog'

export function DashboardsPage() {
  const status = useStorageStatus()
  const { applyDashboardRename, deleteDashboard } = useDashboardStore()
  const dashboards = useLiveQuery(
    () => (status === 'available' ? dashboardRepository.list() : Promise.resolve([])),
    [status],
  )
  const [pendingRename, setPendingRename] = useState<StoredDashboard | null>(null)
  const [pendingDelete, setPendingDelete] = useState<StoredDashboard | null>(null)

  async function handleRename(name: string) {
    if (!pendingRename) return
    try {
      await renameStoredDashboard(pendingRename.id, name)
      applyDashboardRename(pendingRename.id, name)
      setPendingRename(null)
      toast.success('Nama dashboard diperbarui')
    } catch (cause) {
      toast.error('Nama gagal diperbarui', {
        description: storageErrorMessage(toStorageError(cause)),
      })
    }
  }

  async function handleDuplicate(dashboard: StoredDashboard) {
    try {
      await duplicateStoredDashboard(dashboard.id)
      toast.success('Dashboard diduplikasi')
    } catch (cause) {
      toast.error('Dashboard gagal diduplikasi', {
        description: storageErrorMessage(toStorageError(cause)),
      })
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return
    try {
      await deleteStoredDashboard(pendingDelete.id)
      deleteDashboard(pendingDelete.id)
      toast.success('Dashboard dihapus')
    } catch (cause) {
      toast.error('Dashboard gagal dihapus', {
        description: storageErrorMessage(toStorageError(cause)),
      })
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <PageContainer>
      <div>
        <p className="text-xs font-semibold tracking-wider text-brand uppercase">Dashboard Saya</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Dashboard tersimpan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dashboard yang tersimpan di browser ini. Buka, ganti nama, duplikat, atau hapus.
        </p>
      </div>

      <StorageUnavailableNotice className="mt-5" />

      <div className="mt-6">
        {status === 'checking' || dashboards === undefined ? (
          <LoadingState label="Memuat dashboard…" />
        ) : status === 'unavailable' ? null : dashboards.length === 0 ? (
          <EmptyState
            icon={LayoutDashboard}
            title="Belum ada dashboard tersimpan"
            description="Unggah file Excel atau CSV terlebih dahulu, lalu simpan dashboard dari halaman builder."
            action={
              <Button asChild>
                <Link to="/">
                  <UploadCloud className="size-4" />
                  Unggah file
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {dashboards.map((dashboard) => (
              <div
                key={dashboard.id}
                className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3.5 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <LayoutDashboard className="size-4.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{dashboard.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {dashboard.datasetFileName} · {dashboard.rowCount} baris ·{' '}
                      {dashboard.widgets.length} visual · diperbarui{' '}
                      {formatRelativeTime(dashboard.updatedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/builder/${dashboard.id}`}>
                      Buka
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Ganti nama ${dashboard.name}`}
                    onClick={() => setPendingRename(dashboard)}
                  >
                    <Pencil className="size-4 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Duplikat ${dashboard.name}`}
                    onClick={() => void handleDuplicate(dashboard)}
                  >
                    <Copy className="size-4 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Hapus ${dashboard.name}`}
                    onClick={() => setPendingDelete(dashboard)}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RenameDashboardDialog
        dashboard={pendingRename}
        onOpenChange={(open) => {
          if (!open) setPendingRename(null)
        }}
        onRename={handleRename}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="Hapus dashboard?"
        description={`“${pendingDelete?.name ?? 'Dashboard'}” akan dihapus, termasuk dataset yang tidak dipakai dashboard lain. Tindakan ini tidak dapat dibatalkan.`}
        onConfirm={() => void handleDelete()}
      />
    </PageContainer>
  )
}
```

- [ ] **Step 5: Verify**

Run:

```bash
npm test
npm run build
```

Expected: tests pass and the build succeeds.

---

### Task 6: Export Service and Export Hook

**Files:**
- Create: `src/services/export.service.ts`
- Create: `src/features/dashboard/hooks/useDashboardExport.ts`
- Test: `tests/export-csv.test.ts`

**Interfaces:**
- Consumes: `DatasetRow`, `DatasetColumn`, `Dashboard`, `Dataset`.
- Produces:
  - `type ExportFormat = 'png' | 'pdf' | 'csv'`
  - `buildCsv(rows: DatasetRow[], columns: DatasetColumn[]): string`
  - `formatCsvValue(value: unknown): string`
  - `sanitizeFileName(name: string): string`
  - `buildExportFileName(name, extension, date?): string`
  - `captureNodeAsPng(node: HTMLElement): Promise<string>`
  - `downloadCsv(csv: string, fileName: string): void`
  - `downloadPdfFromImage(dataUrl: string, fileName: string): Promise<void>`
  - `downloadPngDataUrl(dataUrl: string, fileName: string): void`
  - `waitForVisuals(): Promise<void>`
  - `useDashboardExport({ dashboard, dataset, filteredRows, targetRef })` returning `{ busy, canExportImage, canExportCsv, exportAs }`.

- [ ] **Step 1: Write the failing CSV tests**

Create `tests/export-csv.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { DatasetColumn } from '@/domain/dataset.types'
import {
  buildCsv,
  buildExportFileName,
  formatCsvValue,
  sanitizeFileName,
} from '@/services/export.service'

function column(overrides: Partial<DatasetColumn>): DatasetColumn {
  return {
    id: 'col_0',
    originalName: 'Kolom',
    displayName: 'Kolom',
    type: 'text',
    nullCount: 0,
    distinctCount: 1,
    sampleValues: [],
    inferenceConfidence: 1,
    typeMismatchCount: 0,
    ...overrides,
  }
}

const columns: DatasetColumn[] = [
  column({ id: 'col_0', originalName: 'Cabang', displayName: 'Cabang' }),
  column({
    id: 'col_1',
    originalName: 'Rev',
    displayName: 'Pendapatan',
    type: 'number',
  }),
]

describe('CSV export', () => {
  it('memakai displayName, BOM, dan CRLF', () => {
    const csv = buildCsv([{ col_0: 'Bandung', col_1: 1250000.5 }], columns)
    expect(csv).toBe('\uFEFFCabang,Pendapatan\r\nBandung,1250000.5\r\n')
  })

  it('meng-escape koma dan kutip sesuai RFC 4180', () => {
    const csv = buildCsv([{ col_0: 'Bandung, Kota', col_1: 'Kata "penting"' }], columns)
    expect(csv).toContain('"Bandung, Kota","Kata ""penting"""')
  })

  it('meng-escape newline', () => {
    const csv = buildCsv([{ col_0: 'Baris 1\nBaris 2', col_1: null }], columns)
    expect(csv).toContain('"Baris 1\nBaris 2",')
  })

  it('memformat nilai kosong, tanggal, dan boolean', () => {
    expect(formatCsvValue(null)).toBe('')
    expect(formatCsvValue(undefined)).toBe('')
    expect(formatCsvValue('')).toBe('')
    expect(formatCsvValue(new Date(2026, 0, 3))).toBe('2026-01-03')
    expect(formatCsvValue(true)).toBe('true')
    expect(formatCsvValue(false)).toBe('false')
    expect(formatCsvValue('2026-01-03')).toBe('2026-01-03')
  })

  it('tidak menambahkan pemisah ribuan pada angka', () => {
    const csv = buildCsv([{ col_0: 'A', col_1: 1234.56 }], columns)
    expect(csv).toContain(',1234.56')
    expect(csv).not.toContain('1.234,56')
  })
})

describe('export file names', () => {
  it('mengganti karakter tidak aman dan menambah tanggal', () => {
    expect(
      buildExportFileName('Penjualan/Q1: "A"', 'png', new Date(2026, 0, 3)),
    ).toBe('Penjualan-Q1-A-20260103.png')
  })

  it('memakai fallback dashboard untuk nama kosong', () => {
    expect(sanitizeFileName('   ')).toBe('dashboard')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/export-csv.test.ts`

Expected: FAIL because `@/services/export.service` does not exist.

- [ ] **Step 3: Implement the export service**

Create `src/services/export.service.ts`:

```ts
import type { DatasetColumn, DatasetRow } from '@/domain/dataset.types'

export type ExportFormat = 'png' | 'pdf' | 'csv'

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (value instanceof Date) return formatLocalDate(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildCsv(rows: DatasetRow[], columns: DatasetColumn[]): string {
  const header = columns.map((column) => csvEscape(column.displayName)).join(',')
  const body = rows.map((row) =>
    columns.map((column) => csvEscape(formatCsvValue(row[column.id]))).join(','),
  )
  return `\uFEFF${[header, ...body].join('\r\n')}\r\n`
}

export function sanitizeFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-. ]+|[-. ]+$/g, '')
  return cleaned || 'dashboard'
}

export function buildExportFileName(
  dashboardName: string,
  extension: ExportFormat,
  date = new Date(),
): string {
  const stamp = `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`
  return `${sanitizeFileName(dashboardName)}-${stamp}.${extension}`
}

export function downloadCsv(csv: string, fileName: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function captureNodeAsPng(node: HTMLElement): Promise<string> {
  const { toPng } = await import('html-to-image')
  return toPng(node, {
    pixelRatio: 2,
    backgroundColor: '#f8fafc',
    cacheBust: true,
    filter: (child) =>
      !(child instanceof HTMLElement && child.dataset.exportExclude !== undefined),
  })
}

function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function loadImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('Gambar dashboard gagal dimuat.'))
    image.src = src
  })
}

export async function downloadPdfFromImage(
  dataUrl: string,
  fileName: string,
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const { width, height } = await loadImageSize(dataUrl)
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const contentWidth = pageWidth - margin * 2
  const contentHeight = pageHeight - margin * 2
  const imageHeight = contentWidth * (height / width)
  const pageCount = Math.max(1, Math.ceil(imageHeight / contentHeight))

  for (let page = 0; page < pageCount; page += 1) {
    if (page > 0) pdf.addPage()
    pdf.addImage(
      dataUrl,
      'PNG',
      margin,
      margin - page * contentHeight,
      contentWidth,
      imageHeight,
    )
  }

  pdf.save(fileName)
}

export function downloadPngDataUrl(dataUrl: string, fileName: string): void {
  downloadDataUrl(dataUrl, fileName)
}

export async function waitForVisuals(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await new Promise((resolve) => setTimeout(resolve, 300))
}
```

- [ ] **Step 4: Run the CSV tests**

Run: `npx vitest run tests/export-csv.test.ts`

Expected: all CSV and filename tests PASS.

- [ ] **Step 5: Implement the export hook**

Create `src/features/dashboard/hooks/useDashboardExport.ts`:

```ts
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
      downloadCsv(
        buildCsv(filteredRows, dataset.columns),
        buildExportFileName(dashboard.name, 'csv'),
      )
      toast.success('CSV diunduh')
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
```

- [ ] **Step 6: Verify**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and the build succeeds.

---

### Task 7: Builder Hydration, Save, and Filter Persistence

**Files:**
- Modify: `src/features/dashboard/hooks/useDashboardWorkspace.ts`
- Modify: `src/features/dashboard/pages/DashboardBuilderPage.tsx`

**Interfaces:**
- Consumes: `saveWorkspace`, `loadDashboardWorkspace`, `updateStoredFilterState`, `toStorageError`, `storageErrorMessage`, store persistence actions, `LoadingState`.
- Produces on `useDashboardWorkspace()`:
  - `hydrationStatus: 'loading' | 'ready' | 'missing'`
  - `isDirty: boolean`, `isPersisted: boolean`, `saving: boolean`
  - `saveDashboard(): Promise<boolean>`

- [ ] **Step 1: Replace the workspace hook**

Replace `src/features/dashboard/hooks/useDashboardWorkspace.ts` with:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import type {
  ChartWidgetConfig,
  DashboardWidget,
  KpiWidgetConfig,
} from '@/domain/dashboard.types'
import { EMPTY_FILTER_STATE, type ActiveFilterState } from '@/domain/filter.types'
import {
  loadDashboardWorkspace,
  saveWorkspace,
  updateStoredFilterState,
} from '@/db/persistence.service'
import { storageErrorMessage, toStorageError } from '@/db/storage-errors'
import { applyFilters, countActiveFilters } from '@/services/filter.service'
import { useDashboardStore } from '@/state/dashboard-store'
import {
  createDefaultChartWidget,
  createDefaultKpiWidget,
} from '@/state/dashboard-widgets'

type HydrationStatus = 'loading' | 'ready' | 'missing'

export function useDashboardWorkspace() {
  const { dashboardId } = useParams<{ dashboardId: string }>()
  const store = useDashboardStore()
  const {
    getDashboard,
    getDataset,
    getFilterState,
    loadWorkspace,
    markDashboardSaved,
    isDashboardDirty,
    isDashboardPersisted,
    addWidget,
    updateWidget: updateStoredWidget,
    removeWidget,
    duplicateWidget: duplicateStoredWidget,
    moveWidget: moveStoredWidget,
    setFilterState,
    resetFilterState,
  } = store

  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null)
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DashboardWidget | null>(null)
  const [saving, setSaving] = useState(false)
  const filterSaveFailedRef = useRef(false)

  const [hydrationStatus, setHydrationStatus] = useState<HydrationStatus>(() => {
    if (!dashboardId) return 'missing'
    const existing = getDashboard(dashboardId)
    return existing && getDataset(existing.datasetId) ? 'ready' : 'loading'
  })

  const dashboard = dashboardId ? getDashboard(dashboardId) : undefined
  const dataset = dashboard ? getDataset(dashboard.datasetId) : undefined
  const filterState = dashboard ? getFilterState(dashboard.id) : EMPTY_FILTER_STATE
  const isDirty = dashboard ? isDashboardDirty(dashboard.id) : false
  const isPersisted = dashboard ? isDashboardPersisted(dashboard.id) : false

  useEffect(() => {
    if (!dashboardId) {
      setHydrationStatus('missing')
      return
    }
    if (dashboard && dataset) {
      setHydrationStatus('ready')
      return
    }

    let active = true
    loadDashboardWorkspace(dashboardId)
      .then((result) => {
        if (!active) return
        if (result.status === 'ready') {
          loadWorkspace(result.dataset, result.dashboard, result.filterState)
          setHydrationStatus('ready')
        } else {
          setHydrationStatus('missing')
        }
      })
      .catch(() => {
        if (active) setHydrationStatus('missing')
      })

    return () => {
      active = false
    }
  }, [dashboardId, dashboard, dataset, loadWorkspace])

  useEffect(() => {
    if (!dashboard || !isPersisted) return

    const dashboardIdForFilter = dashboard.id
    const timer = setTimeout(() => {
      updateStoredFilterState(dashboardIdForFilter, filterState).catch((cause) => {
        if (filterSaveFailedRef.current) return
        filterSaveFailedRef.current = true
        toast.warning('Filter tidak tersimpan', {
          description: storageErrorMessage(toStorageError(cause)),
        })
      })
    }, 400)

    return () => clearTimeout(timer)
  }, [dashboard, filterState, isPersisted])

  useEffect(() => {
    if (!isDirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const filteredRows = useMemo(() => {
    if (!dashboard || !dataset) return []
    return applyFilters(dataset.rows, dashboard.filters, filterState)
  }, [dashboard, dataset, filterState])

  const kpiWidgets = useMemo(
    () =>
      [...(dashboard?.widgets ?? [])]
        .sort((a, b) => a.order - b.order)
        .filter((widget): widget is KpiWidgetConfig => widget.kind === 'kpi'),
    [dashboard],
  )

  const chartWidgets = useMemo(
    () =>
      [...(dashboard?.widgets ?? [])]
        .sort((a, b) => a.order - b.order)
        .filter((widget): widget is ChartWidgetConfig => widget.kind === 'chart'),
    [dashboard],
  )

  const editingWidget = dashboard?.widgets.find((widget) => widget.id === editingWidgetId)

  const saveDashboard = useCallback(async (): Promise<boolean> => {
    if (!dashboard || !dataset) return false

    setSaving(true)
    try {
      const saved = await saveWorkspace({ dataset, dashboard, filterState })
      markDashboardSaved(saved.id, saved.updatedAt)
      toast.success('Dashboard tersimpan')
      return true
    } catch (cause) {
      toast.error('Dashboard gagal disimpan', {
        description: storageErrorMessage(toStorageError(cause)),
      })
      return false
    } finally {
      setSaving(false)
    }
  }, [dashboard, dataset, filterState, markDashboardSaved])

  function openEditor(widgetId: string) {
    setSelectedWidgetId(widgetId)
    setEditingWidgetId(widgetId)
  }

  function closeEditor() {
    setEditingWidgetId(null)
  }

  function addKpi() {
    if (!dashboard || !dataset) return
    const widget = createDefaultKpiWidget(dataset.columns, dashboard.widgets.length)
    addWidget(dashboard.id, widget)
    openEditor(widget.id)
    toast.success('KPI ditambahkan')
  }

  function addChart() {
    if (!dashboard || !dataset) return
    const widget = createDefaultChartWidget(dataset.columns, dashboard.widgets.length)
    addWidget(dashboard.id, widget)
    openEditor(widget.id)
    toast.success('Grafik ditambahkan')
  }

  function duplicateWidget(widgetId: string) {
    if (!dashboard) return
    const duplicated = duplicateStoredWidget(dashboard.id, widgetId)
    if (!duplicated) return
    setSelectedWidgetId(duplicated.id)
    toast.success('Visual diduplikasi')
  }

  function updateWidget(widget: DashboardWidget) {
    if (!dashboard) return
    updateStoredWidget(dashboard.id, widget)
  }

  function moveWidget(widgetId: string, direction: 'up' | 'down') {
    if (!dashboard) return
    moveStoredWidget(dashboard.id, widgetId, direction)
  }

  function updateFilters(state: ActiveFilterState) {
    if (!dashboard) return
    setFilterState(dashboard.id, state)
  }

  function resetFilters() {
    if (!dashboard) return
    resetFilterState(dashboard.id)
    toast.success('Filter direset')
  }

  function confirmDelete() {
    if (!dashboard || !pendingDelete) return
    removeWidget(dashboard.id, pendingDelete.id)
    if (editingWidgetId === pendingDelete.id) setEditingWidgetId(null)
    if (selectedWidgetId === pendingDelete.id) setSelectedWidgetId(null)
    setPendingDelete(null)
    toast.success('Visual dihapus')
  }

  return {
    dashboard,
    dataset,
    filterState,
    filteredRows,
    kpiWidgets,
    chartWidgets,
    editingWidget,
    selectedWidgetId,
    pendingDelete,
    hydrationStatus,
    isDirty,
    isPersisted,
    saving,
    activeFilterCount: countActiveFilters(filterState),
    saveDashboard,
    openEditor,
    closeEditor,
    addKpi,
    addChart,
    duplicateWidget,
    updateWidget,
    moveWidget,
    updateFilters,
    resetFilters,
    requestDelete: setPendingDelete,
    cancelDelete: () => setPendingDelete(null),
    confirmDelete,
  }
}
```

- [ ] **Step 2: Add builder loading and missing states**

In `src/features/dashboard/pages/DashboardBuilderPage.tsx`:

1. Add `import { LoadingState } from '@/components/common/LoadingState'`.
2. Immediately after `const workspace = useDashboardWorkspace()`, add:

```tsx
if (workspace.hydrationStatus === 'loading') {
  return (
    <PageContainer>
      <LoadingState label="Memuat dashboard…" />
    </PageContainer>
  )
}
```

3. Replace the two empty-state descriptions:

```tsx
description="Dashboard ini tidak ada di penyimpanan browser. Mungkin sudah dihapus atau dibuat di tab lain."
```

```tsx
description="Dashboard tersimpan, tetapi dataset sumbernya tidak ditemukan. Unggah ulang file untuk membuat dashboard baru."
```

4. Change the dataset-missing action label from `Unggah ulang file` to `Unggah file`.

- [ ] **Step 3: Verify hydration, build, and existing behavior**

Run:

```bash
npm test
npm run build
```

Expected: tests pass and the build succeeds. Manual hydration checks happen in Task 10.

---

### Task 8: Save and Export UI Wiring

**Files:**
- Replace: `src/features/dashboard/components/DashboardHeader.tsx`
- Replace: `src/features/dashboard/pages/DashboardBuilderPage.tsx`
- Modify: `src/features/dashboard/components/WidgetMenu.tsx`

**Interfaces:**
- Consumes: workspace save/dirty state from Task 7, `useDashboardExport` and `ExportFormat` from Task 6.
- Produces: Save button, saved/dirty badge, export dropdown, and the `data-export-exclude` capture contract.

- [ ] **Step 1: Replace the dashboard header**

Replace `src/features/dashboard/components/DashboardHeader.tsx` with:

```tsx
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  Save,
} from 'lucide-react'
import type { ExportFormat } from '@/services/export.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface DashboardHeaderProps {
  dashboardName: string
  datasetId: string
  sourceFileName: string
  rowCount: number
  widgetCount: number
  filteredRowCount: number
  hasActiveFilters: boolean
  isDirty: boolean
  isPersisted: boolean
  isSaving: boolean
  onSave: () => void
  exportBusy: ExportFormat | null
  canExportImage: boolean
  canExportCsv: boolean
  onExport: (format: ExportFormat) => void
}

export function DashboardHeader({
  dashboardName,
  datasetId,
  sourceFileName,
  rowCount,
  widgetCount,
  filteredRowCount,
  hasActiveFilters,
  isDirty,
  isPersisted,
  isSaving,
  onSave,
  exportBusy,
  canExportImage,
  canExportCsv,
  onExport,
}: DashboardHeaderProps) {
  const badgeLabel = isDirty ? 'Belum disimpan' : isPersisted ? 'Tersimpan' : 'Sesi ini'
  const badgeClass = isDirty
    ? 'border-warning/30 bg-warning-soft text-warning'
    : 'border-brand/20 bg-brand-soft text-brand'

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="-ml-2"
        data-export-exclude
      >
        <Link to={`/data-preview/${datasetId}`}>
          <ArrowLeft className="size-4" />
          Data & preview
        </Link>
      </Button>

      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {dashboardName}
            </h1>
            <Badge variant="outline" className={badgeClass}>
              {badgeLabel}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {sourceFileName} · {rowCount} baris ·{' '}
            {hasActiveFilters
              ? `${filteredRowCount} baris setelah filter`
              : `${widgetCount} visual`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2" data-export-exclude>
          <Button variant="outline" onClick={onSave} disabled={!isDirty || isSaving}>
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {isSaving ? 'Menyimpan…' : 'Simpan'}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={exportBusy !== null}>
                {exportBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {exportBusy ? 'Mengekspor…' : 'Ekspor'}
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                disabled={!canExportImage || exportBusy !== null}
                onSelect={() => onExport('png')}
              >
                <ImageIcon className="size-3.5" />
                Ekspor PNG
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canExportImage || exportBusy !== null}
                onSelect={() => onExport('pdf')}
              >
                <FileText className="size-3.5" />
                Ekspor PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!canExportCsv || exportBusy !== null}
                onSelect={() => onExport('csv')}
              >
                <FileSpreadsheet className="size-3.5" />
                Unduh CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Wire the builder page**

Replace `src/features/dashboard/pages/DashboardBuilderPage.tsx` with:

```tsx
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Info, LayoutDashboard, LineChart } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { LoadingState } from '@/components/common/LoadingState'
import { Button } from '@/components/ui/button'
import { DashboardToolbar } from '../components/DashboardToolbar'
import { DashboardHeader } from '../components/DashboardHeader'
import { DashboardVisualGrid } from '../components/DashboardVisualGrid'
import { GlobalFilterBar } from '../components/GlobalFilterBar'
import { WidgetEditorPanel } from '../components/WidgetEditorPanel'
import { useDashboardExport } from '../hooks/useDashboardExport'
import { useDashboardWorkspace } from '../hooks/useDashboardWorkspace'

export function DashboardBuilderPage() {
  const workspace = useDashboardWorkspace()
  const exportRef = useRef<HTMLDivElement>(null)
  const exportState = useDashboardExport({
    dashboard: workspace.dashboard ?? null,
    dataset: workspace.dataset ?? null,
    filteredRows: workspace.filteredRows,
    targetRef: exportRef,
  })

  if (workspace.hydrationStatus === 'loading') {
    return (
      <PageContainer>
        <LoadingState label="Memuat dashboard…" />
      </PageContainer>
    )
  }

  if (!workspace.dashboard) {
    return (
      <PageContainer>
        <EmptyState
          icon={LayoutDashboard}
          title="Dashboard tidak ditemukan"
          description="Dashboard ini tidak ada di penyimpanan browser. Mungkin sudah dihapus atau dibuat di tab lain."
          action={
            <Button asChild>
              <Link to="/">Kembali ke Beranda</Link>
            </Button>
          }
        />
      </PageContainer>
    )
  }

  if (!workspace.dataset) {
    return (
      <PageContainer>
        <EmptyState
          icon={Info}
          title="Dataset tidak ditemukan"
          description="Dashboard tersimpan, tetapi dataset sumbernya tidak ditemukan. Unggah ulang file untuk membuat dashboard baru."
          action={
            <Button asChild>
              <Link to="/">Unggah file</Link>
            </Button>
          }
        />
      </PageContainer>
    )
  }

  const dashboard = workspace.dashboard
  const dataset = workspace.dataset
  const { editingWidget, pendingDelete } = workspace

  return (
    <PageContainer wide>
      <div ref={exportRef}>
        <DashboardHeader
          dashboardName={dashboard.name}
          datasetId={dataset.id}
          sourceFileName={dataset.sourceFileName}
          rowCount={dataset.rowCount}
          widgetCount={dashboard.widgets.length}
          filteredRowCount={workspace.filteredRows.length}
          hasActiveFilters={workspace.activeFilterCount > 0}
          isDirty={workspace.isDirty}
          isPersisted={workspace.isPersisted}
          isSaving={workspace.saving}
          onSave={() => void workspace.saveDashboard()}
          exportBusy={exportState.busy}
          canExportImage={exportState.canExportImage}
          canExportCsv={exportState.canExportCsv}
          onExport={(format) => void exportState.exportAs(format)}
        />

        <div className="mt-5" data-export-exclude>
          <DashboardToolbar
            kpiCount={workspace.kpiWidgets.length}
            chartCount={workspace.chartWidgets.length}
            onAddKpi={workspace.addKpi}
            onAddChart={workspace.addChart}
          />
        </div>

        <div className="mt-3">
          <GlobalFilterBar
            filters={dashboard.filters}
            columns={dataset.columns}
            rows={dataset.rows}
            state={workspace.filterState}
            onChange={workspace.updateFilters}
            onReset={workspace.resetFilters}
          />
        </div>

        {dashboard.widgets.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={LineChart}
              title="Belum ada visual"
              description="Tambahkan KPI atau grafik untuk mulai membangun dashboard dari data Anda."
              action={
                <div className="flex gap-2">
                  <Button onClick={workspace.addKpi}>Tambah KPI</Button>
                  <Button variant="outline" onClick={workspace.addChart}>
                    Tambah grafik
                  </Button>
                </div>
              }
            />
          </div>
        ) : (
          <DashboardVisualGrid
            kpiWidgets={workspace.kpiWidgets}
            chartWidgets={workspace.chartWidgets}
            columns={dataset.columns}
            rows={workspace.filteredRows}
            selectedWidgetId={workspace.selectedWidgetId}
            onSelect={workspace.openEditor}
            onDuplicate={workspace.duplicateWidget}
            onMove={workspace.moveWidget}
            onDelete={workspace.requestDelete}
          />
        )}
      </div>

      {editingWidget ? (
        <WidgetEditorPanel
          widget={editingWidget}
          columns={dataset.columns}
          onChange={workspace.updateWidget}
          onClose={workspace.closeEditor}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) workspace.cancelDelete()
        }}
        title="Hapus visual?"
        description={`“${pendingDelete?.title ?? 'Visual'}” akan dihapus dari dashboard ini.`}
        onConfirm={workspace.confirmDelete}
      />
    </PageContainer>
  )
}
```

- [ ] **Step 3: Exclude widget menu controls from capture**

In `src/features/dashboard/components/WidgetMenu.tsx`, replace the existing `DropdownMenuTrigger` button with:

```tsx
<DropdownMenuTrigger asChild>
  <Button
    variant="ghost"
    size="icon-sm"
    aria-label="Menu visual"
    data-export-exclude
    onClick={(event) => event.stopPropagation()}
  >
    <MoreHorizontal className="size-4" />
  </Button>
</DropdownMenuTrigger>
```

- [ ] **Step 4: Verify**

Run:

```bash
npm test
npm run build
```

Expected: tests pass and the build succeeds.

---

### Task 9: Home and Settings

**Files:**
- Replace: `src/features/home/components/RecentDashboards.tsx`
- Modify: `src/features/home/pages/HomePage.tsx`
- Replace: `src/features/settings/pages/SettingsPage.tsx`

**Interfaces:**
- Consumes: `dashboardRepository`, `getStorageCounts`, `clearAllStoredData`, `useStorageStatus`, `StorageUnavailableNotice`, `LoadingState`, `useDashboardStore().resetSession`.

- [ ] **Step 1: Replace the recent dashboard list**

Replace `src/features/home/components/RecentDashboards.tsx` with:

```tsx
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, LayoutDashboard } from 'lucide-react'
import { LoadingState } from '@/components/common/LoadingState'
import { dashboardRepository } from '@/db/repositories/dashboard.repository'
import { useStorageStatus } from '@/db/useStorageStatus'
import { formatRelativeTime } from '@/lib/formatters'

export function RecentDashboards() {
  const status = useStorageStatus()
  const recent = useLiveQuery(
    () => (status === 'available' ? dashboardRepository.listRecent(3) : Promise.resolve([])),
    [status],
  )

  if (status === 'checking' || recent === undefined) {
    return <LoadingState compact label="Memuat dashboard…" />
  }

  if (recent.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-5 py-8 text-center">
        <LayoutDashboard className="mx-auto size-5 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Belum ada dashboard</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Dashboard yang Anda simpan akan muncul di sini.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {recent.map((dashboard) => (
        <Link
          key={dashboard.id}
          to={`/builder/${dashboard.id}`}
          className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-secondary/50"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
            <LayoutDashboard className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{dashboard.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {dashboard.datasetFileName} · {formatRelativeTime(dashboard.updatedAt)}
            </p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Update the home page copy**

In `src/features/home/pages/HomePage.tsx`:

1. Add `import { StorageUnavailableNotice } from '@/components/common/StorageUnavailableNotice'`.
2. Replace this existing block immediately after `<RecentDashboards />`:

```tsx
<div className="mt-3 rounded-lg border border-warning/20 bg-warning-soft px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
  Versi ini menyimpan dashboard hanya selama tab terbuka. Penyimpanan permanen di
  browser belum aktif.
</div>
```

with:

```tsx
<StorageUnavailableNotice className="mt-3" />
<p className="mt-3 text-xs leading-relaxed text-muted-foreground">
  Dashboard tersimpan di browser ini dan tetap ada setelah halaman dimuat ulang.
</p>
```

- [ ] **Step 3: Replace the settings page**

Replace `src/features/settings/pages/SettingsPage.tsx` with:

```tsx
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
        ? getStorageCounts()
        : Promise.resolve({ dashboards: 0, datasets: 0 }),
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
    status === 'checking' || counts === undefined
      ? 'Menghitung data…'
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
```

- [ ] **Step 4: Verify**

Run:

```bash
npm test
npm run build
```

Expected: tests pass and the build succeeds.

---

### Task 10: Documentation and End-to-End Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README**

Replace the “Alur penggunaan” and “Batasan tahap ini” sections with:

```markdown
## Alur penggunaan

1. Unggah `.xlsx`, `.xls`, atau `.csv` (maks. 20 MB) di Beranda.
2. Pilih worksheet bila file memiliki lebih dari satu sheet.
3. Periksa preview (50 baris/halaman) dan profil kolom; tipe kolom dan nama tampilan bisa diubah.
4. Klik **Buat Dashboard** — KPI, grafik, dan filter awal dibuat otomatis.
5. Edit visual lewat panel kanan, tambah/duplikat/hapus visual, dan gunakan filter global.
6. Klik **Simpan** untuk menyimpan dashboard ke IndexedDB browser.
7. Kelola dashboard di **Dashboard Saya**: buka, ganti nama, duplikat, atau hapus.
8. Ekspor dashboard sebagai PNG, PDF, atau CSV (hanya baris terfilter).

## Penyimpanan dan ekspor

- Dataset disimpan otomatis saat impor dan saat tipe/nama kolom diubah.
- Dashboard disimpan hanya saat tombol **Simpan** diklik; badge menunjukkan “Belum disimpan” atau “Tersimpan”.
- Filter terakhir ikut tersimpan dan dipulihkan saat dashboard dibuka kembali.
- **Pengaturan → Hapus seluruh data lokal** menghapus semua dataset dan dashboard di browser ini.
- PNG/PDF menangkap area judul, filter, dan visual; kontrol editor tidak ikut.
- CSV memakai nama tampilan kolom, seluruh kolom, nilai ternormalisasi, dan hanya baris yang lolos filter.

## Batasan tahap ini

- Penyimpanan bersifat lokal per browser; tidak ada login, cloud sync, atau share link.
- Satu dashboard = satu file + satu worksheet.
- Nilai formula tidak dihitung ulang; nilai yang tersimpan di file yang ditampilkan.
- Maksimal 10 kategori per grafik secara default (dapat diubah di editor, maks. 200).
```

- [ ] **Step 2: Run the automated gate**

Run:

```bash
npm test
npm run build
npm run lint
```

Expected:

- All tests pass, including the new storage and CSV tests.
- Production build succeeds.
- Lint reports 0 errors. The 6 existing warnings in shadcn/ui and effect-driven components may remain.

- [ ] **Step 3: Browser QA**

Start the dev server:

```bash
npm run dev
```

Verify in Chrome DevTools MCP or Playwright:

1. Import `public/sample-data/sales_sample.csv`; refresh `/data-preview/<id>`; dataset, columns, and preview return.
2. Change a column type and display name; refresh; both changes return.
3. Create a dashboard; badge says “Belum disimpan”; Save is enabled.
4. Click Save; badge changes to “Tersimpan” and Save disables.
5. Set a category filter; refresh `/builder/<id>`; the filter and filtered KPI values return.
6. Change a widget title; badge returns to “Belum disimpan”; Save; refresh; title persists.
7. Open `/dashboards`: rename, duplicate, and delete. Confirm that deleting the last dashboard removes its dataset (Settings count drops).
8. Open `/settings`: counts match, then “Hapus seluruh data lokal” empties both lists.
9. Export checks:
   - PNG downloads with a name like `Dashboard Penjualan-20261113.png`, size greater than 10 KB, and no sidebar/buttons.
   - PDF downloads and its first bytes are `%PDF`.
   - CSV downloads, starts with UTF-8 BOM, uses display-name headers, includes all columns, and contains only filtered rows.
10. Resize to a mobile viewport and confirm builder/list layouts remain usable.
11. Confirm the console has no dataset row logs and no uncaught errors.

- [ ] **Step 4: Final checkpoint**

Record in the task notes: test/build/lint results, downloaded file checks, and any residual warnings. Do not start Stage 6.

---

## Self-Review Notes

Spec coverage by section:

- §5–§6: architecture, record model, transactions, orphan cleanup → Tasks 1–2.
- §7: persisted/dirty store state, hydration, reset, rename sync → Task 3.
- §8.1–§8.2: import auto-save, preview hydration, column autosave → Task 4.
- §8.6 and the unavailable-storage rows of §10: list management, rename/duplicate/delete, banner → Task 5.
- §9.1–§9.5: capture area, exclusions, PNG/PDF/CSV behavior, export status → Tasks 6 and 8.
- §8.3–§8.5: builder hydration, explicit save, beforeunload, filter debounce → Task 7.
- §8.7: recent dashboards, Home copy, Settings counts and clear-all → Task 9.
- §12–§13: unit tests, regression gate, browser QA → Tasks 1, 2, 6, and 10.

Consistency checks performed against the codebase:

- Names and signatures match existing code: `withColumnType(column, rows, type)`, `PageContainer wide`, `ConfirmDialog confirmLabel`, `formatRelativeTime`, widget `visible`, `ActiveFilterState.categoryValues/dateRanges`.
- `loadDashboardWorkspace` validates the stored shape so corrupt records are treated as missing (§10) instead of crashing the builder.
- Task 8 assigns `workspace.dashboard` and `workspace.dataset` to new consts after the guards; destructuring would drop strict-null narrowing.
- `downloadPngDataUrl` is listed in Task 6's produced interfaces and used by the export hook.
- No `TBD`/`TODO` placeholders remain.
- The plan intentionally omits git commit steps because the project is not a git repository.
