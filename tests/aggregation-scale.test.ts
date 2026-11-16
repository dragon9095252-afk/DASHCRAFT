import { describe, expect, it } from 'vitest'
import type { DatasetColumn, DatasetRow, DateGroup } from '@/domain/dataset.types'
import { aggregateSeries, computeMetric, getRowCountScopeLabel } from '@/services/aggregation.service'

function column(overrides: Partial<DatasetColumn>): DatasetColumn {
  return {
    id: 'col_0',
    originalName: 'Kolom',
    displayName: 'Kolom',
    type: 'text',
    nullCount: 0,
    distinctCount: 3,
    sampleValues: [],
    inferenceConfidence: 1,
    typeMismatchCount: 0,
    ...overrides,
  }
}

const valueColumn = column({ id: 'col_0', displayName: 'Nilai', type: 'number' })
const categoryColumn = column({ id: 'col_1', displayName: 'Kategori', type: 'text' })

function rows(count: number, make: (index: number) => DatasetRow): DatasetRow[] {
  return Array.from({ length: count }, (_, index) => make(index))
}

// A 20 MB CSV can hold well over 200k rows, which is past the argument limit
// Math.min(...values) can survive.
const LARGE = 200_000

describe('aggregation on large and imperfect datasets', () => {
  it('computes min and max without exhausting the call stack', () => {
    const data = rows(LARGE, (index) => ({
      col_0: index === 12_345 ? -50 : index,
      col_1: 'A',
    }))

    expect(computeMetric(data, 'min', valueColumn)).toBe(-50)
    expect(computeMetric(data, 'max', valueColumn)).toBe(LARGE - 1)
  })

  it('sums and averages every parsed value', () => {
    const data = rows(LARGE, () => ({ col_0: 2, col_1: 'A' }))

    expect(computeMetric(data, 'sum', valueColumn)).toBe(LARGE * 2)
    expect(computeMetric(data, 'average', valueColumn)).toBe(2)
  })

  it('counts blank rows but excludes them from the average', () => {
    const data = rows(1000, (index) => ({
      col_0: index % 2 === 0 ? null : 10,
      col_1: 'A',
    }))

    expect(computeMetric(data, 'count')).toBe(1000)
    expect(computeMetric(data, 'sum', valueColumn)).toBe(5000)
    expect(computeMetric(data, 'average', valueColumn)).toBe(10)
  })

  it('returns zero instead of dividing by zero when nothing parses', () => {
    const data = rows(10, () => ({ col_0: 'bukan angka', col_1: 'A' }))

    expect(computeMetric(data, 'sum', valueColumn)).toBe(0)
    expect(computeMetric(data, 'average', valueColumn)).toBe(0)
    expect(computeMetric(data, 'min', valueColumn)).toBe(0)
    expect(computeMetric(data, 'max', valueColumn)).toBe(0)
  })

  it('keeps unparseable values out of the numeric result without dropping rows', () => {
    const data = rows(4, (index) => ({
      col_0: [10, 'rusak', 20, null][index],
      col_1: 'A',
    }))

    expect(computeMetric(data, 'count')).toBe(4)
    expect(computeMetric(data, 'sum', valueColumn)).toBe(30)
    expect(computeMetric(data, 'average', valueColumn)).toBe(15)
  })

  it('treats whitespace-only cells as blank when counting distinct values', () => {
    const data = ['A', '   ', 'A', 'B'].map((label) => ({ col_0: 1, col_1: label }))

    expect(computeMetric(data, 'distinctCount', categoryColumn)).toBe(2)
  })

  it('truncates high-cardinality categories but reports the full group count', () => {
    const data = rows(5000, (index) => ({ col_0: 1, col_1: `Kategori ${index}` }))

    const result = aggregateSeries(data, {
      categoryField: categoryColumn,
      valueField: valueColumn,
      aggregation: 'sum',
      dateGroup: 'month',
      sort: 'descending',
      limit: 20,
    })

    expect(result.points).toHaveLength(20)
    expect(result.totalGroups).toBe(5000)
    expect(result.truncated).toBe(true)
  })
})

describe('date group labels', () => {
  const dateColumn = column({ id: 'col_2', displayName: 'Tanggal', type: 'date' })
  const data: DatasetRow[] = [
    { col_0: 10, col_2: new Date(2026, 0, 3) },
    { col_0: 20, col_2: new Date(2026, 0, 15) },
    { col_0: 5, col_2: new Date(2026, 10, 16) },
  ]

  it.each<[DateGroup, string[]]>([
    ['day', ['3 Jan 2026', '15 Jan 2026', '16 Nov 2026']],
    ['month', ['Jan 2026', 'Nov 2026']],
    ['year', ['2026']],
  ])('labels %s groups in Indonesian', (dateGroup, expected) => {
    const result = aggregateSeries(data, {
      categoryField: dateColumn,
      valueField: valueColumn,
      aggregation: 'sum',
      dateGroup,
      sort: 'ascending',
    })

    expect(result.points.map((point) => point.label)).toEqual(expected)
  })

  it('sums each date bucket once', () => {
    const result = aggregateSeries(data, {
      categoryField: dateColumn,
      valueField: valueColumn,
      aggregation: 'sum',
      dateGroup: 'month',
      sort: 'ascending',
    })

    expect(result.points.map((point) => point.value)).toEqual([30, 5])
    expect(result.totalGroups).toBe(2)
  })

  it('skips rows whose date cannot be parsed without dropping the rest', () => {
    const mixed: DatasetRow[] = [...data, { col_0: 99, col_2: 'bukan tanggal' }]
    const result = aggregateSeries(mixed, {
      categoryField: dateColumn,
      valueField: valueColumn,
      aggregation: 'sum',
      dateGroup: 'year',
      sort: 'ascending',
    })

    expect(result.points).toHaveLength(1)
    expect(result.points[0].value).toBe(35)
  })
})

describe('count KPI scope label', () => {
  it('says semua baris only when nothing is filtered out', () => {
    expect(getRowCountScopeLabel(5, 5)).toBe('semua baris')
  })

  it('reports the filtered share instead of claiming all rows', () => {
    expect(getRowCountScopeLabel(1, 5)).toBe('1 dari 5 baris')
    expect(getRowCountScopeLabel(0, 5)).toBe('0 dari 5 baris')
  })
})