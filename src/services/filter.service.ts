import type { DatasetColumn, DatasetRow } from '@/domain/dataset.types'
import type {
  ActiveFilterState,
  DashboardFilterConfig,
} from '@/domain/filter.types'
import { getCategoryLabel, toDate } from '@/lib/value-utils'

const MAX_CATEGORY_FILTERS = 2
const MAX_CATEGORY_OPTIONS = 100

const CATEGORY_PRIORITY: Array<[RegExp, number]> = [
  [/(cabang|branch|wilayah|region|area|kota|city|daerah)/i, 30],
  [/(kategori|category|segmen|segment|tipe|type)/i, 20],
  [/(produk|product|item|barang)/i, 10],
  [/(salesperson|sales|petugas|agent|staff)/i, 5],
]

function categoryFilterScore(column: DatasetColumn): number {
  for (const [pattern, score] of CATEGORY_PRIORITY) {
    if (pattern.test(column.displayName)) return score
  }
  return 0
}

function looksLikeIdentifier(name: string): boolean {
  return /(^|\s)(id|no\.?|nomor|kode|code)(\s|$)/i.test(name)
}

export function deriveFilterConfigs(columns: DatasetColumn[]): DashboardFilterConfig[] {
  const filters: DashboardFilterConfig[] = []

  const categoryColumns = columns
    .filter(
      (column) =>
        (column.type === 'text' || column.type === 'boolean') &&
        column.distinctCount >= 2 &&
        column.distinctCount <= 12 &&
        !looksLikeIdentifier(column.displayName),
    )
    .sort((a, b) => categoryFilterScore(b) - categoryFilterScore(a))
    .slice(0, MAX_CATEGORY_FILTERS)

  for (const column of categoryColumns) {
    filters.push({
      id: `filter_${column.id}`,
      fieldId: column.id,
      kind: 'category',
      label: column.displayName,
    })
  }

  const dateColumn = columns.find((column) => column.type === 'date')
  if (dateColumn) {
    filters.push({
      id: `filter_${dateColumn.id}`,
      fieldId: dateColumn.id,
      kind: 'dateRange',
      label: dateColumn.displayName,
    })
  }

  return filters
}

export function getCategoryOptions(rows: DatasetRow[], fieldId: string): string[] {
  const values = new Set<string>()
  for (const row of rows) {
    values.add(getCategoryLabel(row[fieldId]))
    if (values.size >= MAX_CATEGORY_OPTIONS) break
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b, 'id-ID'))
}

export function applyFilters(
  rows: DatasetRow[],
  filters: DashboardFilterConfig[],
  state: ActiveFilterState,
): DatasetRow[] {
  if (filters.length === 0) return rows

  return rows.filter((row) =>
    filters.every((filter) => {
      if (filter.kind === 'category') {
        const selected = state.categoryValues[filter.fieldId] ?? []
        if (selected.length === 0) return true
        return selected.includes(getCategoryLabel(row[filter.fieldId]))
      }

      const range = state.dateRanges[filter.fieldId]
      if (!range || (!range.start && !range.end)) return true
      const date = toDate(row[filter.fieldId])
      if (!date) return false
      if (range.start) {
        const start = new Date(`${range.start}T00:00:00`)
        if (date.getTime() < start.getTime()) return false
      }
      if (range.end) {
        const end = new Date(`${range.end}T23:59:59.999`)
        if (date.getTime() > end.getTime()) return false
      }
      return true
    }),
  )
}

export function countActiveFilters(state: ActiveFilterState): number {
  let count = 0
  for (const values of Object.values(state.categoryValues)) {
    if (values.length > 0) count += 1
  }
  for (const range of Object.values(state.dateRanges)) {
    if (range.start || range.end) count += 1
  }
  return count
}
