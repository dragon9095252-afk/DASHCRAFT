import type {
  Aggregation,
  DatasetColumn,
  DatasetRow,
  DateGroup,
} from '@/domain/dataset.types'
import { formatDateForGroup } from '@/lib/formatters'
import { getCategoryLabel, getDateBucket, toDate, toNumber } from '@/lib/value-utils'

export interface AggregatedPoint {
  key: string
  label: string
  value: number
}

export interface AggregateSeriesOptions {
  categoryField: DatasetColumn
  valueField?: DatasetColumn
  aggregation: Aggregation
  dateGroup: DateGroup
  sort: 'ascending' | 'descending' | 'none'
  limit?: number
}

export interface AggregateSeriesResult {
  points: AggregatedPoint[]
  totalGroups: number
  truncated: boolean
}

export function computeMetric(
  rows: DatasetRow[],
  aggregation: Aggregation,
  field?: DatasetColumn,
): number {
  if (aggregation === 'count') return rows.length
  if (!field) return 0

  if (aggregation === 'distinctCount') {
    const seen = new Set<string>()
    for (const row of rows) {
      const value = row[field.id]
      if (value === null || value === undefined || value === '') continue
      seen.add(value instanceof Date ? value.toISOString() : String(value))
    }
    return seen.size
  }

  const numbers: number[] = []
  for (const row of rows) {
    const parsed = toNumber(row[field.id])
    if (parsed !== null) numbers.push(parsed)
  }
  if (numbers.length === 0) return 0

  switch (aggregation) {
    case 'sum':
      return numbers.reduce((total, value) => total + value, 0)
    case 'average':
      return numbers.reduce((total, value) => total + value, 0) / numbers.length
    case 'min':
      return Math.min(...numbers)
    case 'max':
      return Math.max(...numbers)
    default:
      return 0
  }
}

export function aggregateSeries(
  rows: DatasetRow[],
  options: AggregateSeriesOptions,
): AggregateSeriesResult {
  const { categoryField, valueField, aggregation, dateGroup, sort, limit } = options
  const groups = new Map<string, { label: string; rows: DatasetRow[] }>()

  for (const row of rows) {
    const rawValue = row[categoryField.id]
    let key: string
    let label: string

    if (categoryField.type === 'date') {
      const date = toDate(rawValue)
      if (!date) continue
      key = getDateBucket(date, dateGroup)
      label = formatDateForGroup(date, dateGroup)
    } else {
      label = getCategoryLabel(rawValue)
      key = label
    }

    const group = groups.get(key)
    if (group) {
      group.rows.push(row)
    } else {
      groups.set(key, { label, rows: [row] })
    }
  }

  let points: AggregatedPoint[] = Array.from(groups.entries()).map(([key, group]) => ({
    key,
    label: group.label,
    value: computeMetric(group.rows, aggregation, valueField),
  }))

  const totalGroups = points.length
  const isDateSeries = categoryField.type === 'date'

  if (isDateSeries) {
    points.sort((a, b) => (sort === 'descending' ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key)))
  } else if (sort !== 'none') {
    points.sort((a, b) =>
      sort === 'descending' ? b.value - a.value : a.value - b.value,
    )
  }

  let truncated = false
  if (!isDateSeries && limit && limit > 0 && points.length > limit) {
    points = points.slice(0, limit)
    truncated = true
  }

  return { points, totalGroups, truncated }
}

const NUMERIC_AGGREGATIONS: Aggregation[] = ['sum', 'average', 'min', 'max']

export function requiresNumericColumn(aggregation: Aggregation): boolean {
  return NUMERIC_AGGREGATIONS.includes(aggregation)
}

export function requiresTargetColumn(aggregation: Aggregation): boolean {
  return requiresNumericColumn(aggregation) || aggregation === 'distinctCount'
}

export function getAggregationLabel(aggregation: Aggregation): string {
  switch (aggregation) {
    case 'count':
      return 'Jumlah data'
    case 'sum':
      return 'Total'
    case 'average':
      return 'Rata-rata'
    case 'min':
      return 'Nilai minimum'
    case 'max':
      return 'Nilai maksimum'
    case 'distinctCount':
      return 'Nilai unik'
    default:
      return aggregation
  }
}
