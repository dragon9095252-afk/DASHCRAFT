import type { Dataset, DatasetColumn, DatasetRow } from '@/domain/dataset.types'
import type {
  PivotAggregation,
  PivotAxisMember,
  PivotConfiguration,
  PivotResult,
  PivotRow,
} from '@/domain/pivot.types'
import { distinctKey, isBlank, toBoolean, toDate, toNumber } from '@/lib/value-utils'

export class PivotConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PivotConfigurationError'
  }
}

interface GroupBucket {
  key: string
  values: unknown[]
  labels: string[]
  rows: DatasetRow[]
  level: number
}

function localDateLabel(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}

function label(value: unknown): string {
  if (isBlank(value)) return '(Kosong)'
  return value instanceof Date ? localDateLabel(value) : String(value)
}

function encode(value: unknown): unknown {
  if (value instanceof Date) return { type: 'date', value: value.toISOString() }
  if (value === null || value === undefined) return { type: 'null' }
  if (typeof value === 'number') return { type: 'number', value: String(value) }
  if (typeof value === 'boolean') return { type: 'boolean', value: String(value) }
  return { type: typeof value, value: String(value) }
}

function pathKey(values: unknown[]): string {
  return JSON.stringify(values.map(encode))
}

function findColumn(columns: DatasetColumn[], id: string): DatasetColumn {
  const column = columns.find((item) => item.id === id)
  if (!column) throw new PivotConfigurationError('Kolom pivot "' + id + '" tidak ditemukan.')
  return column
}

function compareValues(left: unknown, right: unknown, column: DatasetColumn): number {
  if (column.type === 'number') {
    const a = toNumber(left)
    const b = toNumber(right)
    if (a !== null && b !== null) return a - b
  }
  if (column.type === 'date') {
    const a = toDate(left)
    const b = toDate(right)
    if (a && b) return a.getTime() - b.getTime()
  }
  if (column.type === 'boolean') {
    const a = toBoolean(left)
    const b = toBoolean(right)
    if (a !== null && b !== null) return Number(a) - Number(b)
  }
  return label(left).localeCompare(label(right), 'id-ID', {
    sensitivity: 'base',
    numeric: true,
  })
}

function aggregateRows(rows: DatasetRow[], aggregation: PivotAggregation, fieldId?: string): number | null {
  if (rows.length === 0) return null
  if (aggregation === 'count') {
    return fieldId
      ? rows.reduce((count, row) => count + (isBlank(row[fieldId]) ? 0 : 1), 0)
      : rows.length
  }
  if (!fieldId) throw new PivotConfigurationError('Agregasi ' + aggregation + ' membutuhkan kolom nilai.')

  const values = rows.map((row) => row[fieldId]).filter((value) => !isBlank(value))
  if (aggregation === 'distinctCount') return new Set(values.map(distinctKey)).size

  const numbers = values.map((value) => toNumber(value)).filter((value): value is number => value !== null)
  if (numbers.length === 0) return null
  switch (aggregation) {
    case 'sum': return numbers.reduce((sum, value) => sum + value, 0)
    case 'average': return numbers.reduce((sum, value) => sum + value, 0) / numbers.length
    case 'median': {
      const sorted = [...numbers].sort((a, b) => a - b)
      const middle = Math.floor(sorted.length / 2)
      return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle]
    }
    case 'min': return numbers.reduce((minimum, value) => Math.min(minimum, value), Number.POSITIVE_INFINITY)
    case 'max': return numbers.reduce((maximum, value) => Math.max(maximum, value), Number.NEGATIVE_INFINITY)
    default: {
      const exhaustive: never = aggregation
      return exhaustive
    }
  }
}

function filterRows(rows: DatasetRow[], dataset: Dataset, config: PivotConfiguration): DatasetRow[] {
  const filters = config.filters ?? []
  for (const filter of filters) findColumn(dataset.columns, filter.columnId)
  return rows.filter((row) => filters.every((filter) => {
    const key = distinctKey(row[filter.columnId])
    if (filter.includeValues?.length && !filter.includeValues.some((value) => distinctKey(value) === key)) return false
    if (filter.excludeValues?.some((value) => distinctKey(value) === key)) return false
    return true
  }))
}

function validate(dataset: Dataset, config: PivotConfiguration): void {
  const dimensions = [...config.rowFieldIds, ...config.columnFieldIds]
  for (const id of dimensions) findColumn(dataset.columns, id)
  if (new Set(dimensions).size !== dimensions.length) {
    throw new PivotConfigurationError('Setiap kolom hanya boleh digunakan pada satu sumbu pivot.')
  }
  if (config.measure.aggregation !== 'count' || config.measure.fieldId) {
    if (!config.measure.fieldId) {
      throw new PivotConfigurationError('Agregasi ' + config.measure.aggregation + ' membutuhkan kolom nilai.')
    }
    findColumn(dataset.columns, config.measure.fieldId)
  }
}

function buildAxisBuckets(
  rows: DatasetRow[],
  fieldIds: string[],
  columns: DatasetColumn[],
  ascending: boolean,
): Map<string, GroupBucket> {
  const buckets = new Map<string, GroupBucket>()
  if (fieldIds.length === 0) {
    buckets.set('[]', { key: '[]', values: [], labels: [], rows: [...rows], level: 0 })
    return buckets
  }

  for (const row of rows) {
    const values = fieldIds.map((id) => row[id])
    const key = pathKey(values)
    const existing = buckets.get(key)
    if (existing) existing.rows.push(row)
    else buckets.set(key, { key, values, labels: values.map(label), rows: [row], level: values.length })
  }

  const fields = fieldIds.map((id) => findColumn(columns, id))
  return new Map([...buckets.entries()].sort(([, left], [, right]) => {
    for (let index = 0; index < fields.length; index += 1) {
      const result = compareValues(left.values[index], right.values[index], fields[index])
      if (result !== 0) return ascending ? result : -result
    }
    return 0
  }))
}

function buildRowBuckets(
  rows: DatasetRow[],
  fieldIds: string[],
  columns: DatasetColumn[],
  subtotals: boolean,
  ascending: boolean,
): Map<string, GroupBucket> {
  if (fieldIds.length === 0) {
    return new Map([['[]', { key: '[]', values: [], labels: [], rows: [...rows], level: 0 }]])
  }

  const buckets = new Map<string, GroupBucket>()
  for (const row of rows) {
    const values = fieldIds.map((id) => row[id])
    const firstDepth = subtotals ? 1 : values.length
    for (let depth = firstDepth; depth <= values.length; depth += 1) {
      const path = values.slice(0, depth)
      const key = pathKey(path)
      const existing = buckets.get(key)
      if (existing) existing.rows.push(row)
      else buckets.set(key, { key, values: path, labels: path.map(label), rows: [row], level: depth })
    }
  }

  const fields = fieldIds.map((id) => findColumn(columns, id))
  return new Map([...buckets.entries()].sort(([, left], [, right]) => {
    const sharedLength = Math.min(left.values.length, right.values.length)
    for (let index = 0; index < sharedLength; index += 1) {
      const result = compareValues(left.values[index], right.values[index], fields[index])
      if (result !== 0) return ascending ? result : -result
    }
    return left.level - right.level
  }))
}

function axisMember(bucket: GroupBucket, hasFields: boolean): PivotAxisMember {
  return {
    key: bucket.key,
    values: bucket.values,
    labels: bucket.labels,
    label: hasFields ? bucket.labels.join(' / ') : 'Total',
  }
}

/** Build a typed cross-tab. All totals are recomputed from source rows. */
export function buildPivotTable(dataset: Dataset, config: PivotConfiguration): PivotResult {
  validate(dataset, config)
  const rows = filterRows(dataset.rows, dataset, config)
  const rowBuckets = buildRowBuckets(
    rows, config.rowFieldIds, dataset.columns,
    config.showSubtotals ?? false, config.sortAscending ?? true,
  )
  const columnBuckets = buildAxisBuckets(
    rows, config.columnFieldIds, dataset.columns, config.sortAscending ?? true,
  )
  const columnRows = new Map<string, DatasetRow[]>()
  const columnKeyForRow = new Map<DatasetRow, string>()

  for (const [key, bucket] of columnBuckets) {
    columnRows.set(key, bucket.rows)
    for (const row of bucket.rows) columnKeyForRow.set(row, key)
  }

  const columns = [...columnBuckets.values()].map((bucket) =>
    axisMember(bucket, config.columnFieldIds.length > 0),
  )

  const pivotRows: PivotRow[] = [...rowBuckets.values()].map((bucket) => {
    const rowsByColumn = new Map<string, DatasetRow[]>()
    for (const row of bucket.rows) {
      const key = columnKeyForRow.get(row)
      if (key === undefined) continue
      const current = rowsByColumn.get(key)
      if (current) current.push(row)
      else rowsByColumn.set(key, [row])
    }

    const cells: Record<string, number | null> = {}
    for (const key of columnRows.keys()) {
      cells[key] = aggregateRows(rowsByColumn.get(key) ?? [], config.measure.aggregation, config.measure.fieldId)
    }
    const kind = config.rowFieldIds.length === 0
      ? 'grand-total'
      : bucket.level < config.rowFieldIds.length
        ? 'subtotal'
        : 'detail'
    return {
      key: bucket.key,
      path: bucket.values,
      labels: bucket.labels,
      label: bucket.labels[bucket.labels.length - 1] ?? 'Total',
      level: bucket.level,
      kind,
      cells,
      total: aggregateRows(bucket.rows, config.measure.aggregation, config.measure.fieldId),
    }
  })

  const columnTotals: Record<string, number | null> = {}
  for (const [key, values] of columnRows) {
    columnTotals[key] = aggregateRows(values, config.measure.aggregation, config.measure.fieldId)
  }
  const grandTotal = aggregateRows(rows, config.measure.aggregation, config.measure.fieldId)

  if (config.rowFieldIds.length > 0) {
    pivotRows.push({
      key: '__grand_total__',
      path: [],
      labels: [],
      label: 'Grand Total',
      level: 0,
      kind: 'grand-total',
      cells: { ...columnTotals },
      total: grandTotal,
    })
  }

  return {
    rowFields: [...config.rowFieldIds],
    columnFields: [...config.columnFieldIds],
    measure: { ...config.measure },
    columns,
    rows: pivotRows,
    columnTotals,
    grandTotal,
    filteredRowCount: rows.length,
  }
}
