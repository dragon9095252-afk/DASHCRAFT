import { describe, expect, it } from 'vitest'
import type { DatasetColumn, DatasetRow } from '@/domain/dataset.types'
import { aggregateSeries, computeMetric } from '@/services/aggregation.service'
import { normalizeSheet } from '@/services/data-normalizer.service'
import {
  detectLabelInconsistencies,
  profileColumns,
  refreshLabelWarnings,
} from '@/services/data-profiler.service'
import { buildDataset, parseWorkbook } from '@/services/file-import.service'

function profile(rawRows: unknown[][]) {
  const normalized = normalizeSheet(rawRows)
  const columns = profileColumns(normalized.headers, normalized.rows)
  return { normalized, columns }
}

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

describe('inconsistent category labels', () => {
  const rawRows = [
    ['Cabang', 'Revenue'],
    ['Jakarta', 100],
    ['jakarta', 200],
    ['JAKARTA ', 300],
    ['Bandung', 400],
  ]

  it('warns when one category is split by case or whitespace', () => {
    const { normalized, columns } = profile(rawRows)
    const warnings = detectLabelInconsistencies(columns, normalized.rows)

    expect(warnings).toHaveLength(1)
    expect(warnings[0].code).toBe(`inconsistent-label-${columns[0].id}`)
    expect(warnings[0].severity).toBe('warning')
    expect(warnings[0].affectedCount).toBe(1)
    expect(warnings[0].message).toContain('Cabang')
    expect(warnings[0].message).toContain('jakarta')
  })

  it('never rewrites the source labels', () => {
    const { normalized, columns } = profile(rawRows)
    detectLabelInconsistencies(columns, normalized.rows)

    expect(normalized.rows.map((row) => row.col_0)).toEqual([
      'Jakarta',
      'jakarta',
      'JAKARTA ',
      'Bandung',
    ])
    expect(normalized.rows).toHaveLength(4)
  })

  it('reports the split that the chart actually shows', () => {
    const { normalized, columns } = profile(rawRows)
    const result = aggregateSeries(normalized.rows, {
      categoryField: columns[0],
      valueField: columns[1],
      aggregation: 'sum',
      dateGroup: 'month',
      sort: 'none',
    })

    expect(result.totalGroups).toBe(4)
    expect(result.points.map((point) => point.label)).toEqual([
      'Jakarta',
      'jakarta',
      'JAKARTA ',
      'Bandung',
    ])
  })

  it('stays silent when labels are already consistent', () => {
    const { normalized, columns } = profile([
      ['Cabang', 'Revenue'],
      ['Jakarta', 100],
      ['Jakarta', 200],
      ['Bandung', 300],
    ])

    expect(detectLabelInconsistencies(columns, normalized.rows)).toEqual([])
  })

  it('ignores blank cells and numeric columns', () => {
    const { normalized, columns } = profile([
      ['Cabang', 'Revenue'],
      ['Jakarta', 100],
      [null, 200],
      ['  ', 300],
      ['Bandung', 400],
    ])

    expect(detectLabelInconsistencies(columns, normalized.rows)).toEqual([])
  })

  it('skips high-cardinality identifier columns', () => {
    const rows: DatasetRow[] = Array.from({ length: 5000 }, (_, index) => ({
      col_0: `TRX-${index}`,
      col_1: index,
    }))
    const columns = [
      column({ id: 'col_0', displayName: 'No Transaksi', distinctCount: 5000 }),
      column({ id: 'col_1', displayName: 'Revenue', type: 'number', distinctCount: 5000 }),
    ]

    expect(detectLabelInconsistencies(columns, rows)).toEqual([])
  })

  it('gives each column its own warning code', () => {
    const { normalized, columns } = profile([
      ['Cabang', 'Produk'],
      ['Jakarta', 'Kopi'],
      ['jakarta', 'kopi'],
    ])
    const warnings = detectLabelInconsistencies(columns, normalized.rows)

    expect(warnings.map((warning) => warning.code)).toEqual([
      `inconsistent-label-${columns[0].id}`,
      `inconsistent-label-${columns[1].id}`,
    ])
  })
})

describe('rows are never dropped or clipped', () => {
  it('keeps exact duplicate rows so totals are not silently reduced', () => {
    const { normalized, columns } = profile([
      ['Tanggal', 'Cabang', 'Revenue'],
      ['2026-11-16', 'Jakarta', 100],
      ['2026-11-16', 'Jakarta', 100],
      ['2026-11-16', 'Jakarta', 100],
    ])

    expect(normalized.rows).toHaveLength(3)
    expect(computeMetric(normalized.rows, 'count')).toBe(3)
    expect(computeMetric(normalized.rows, 'sum', columns[2])).toBe(300)
  })

  it('keeps an outlier in every aggregation', () => {
    const rows: DatasetRow[] = [
      { col_0: 10 },
      { col_0: 12 },
      { col_0: 11 },
      { col_0: 9_000_000 },
    ]
    const valueColumn = column({ displayName: 'Revenue', type: 'number', distinctCount: 4 })

    expect(computeMetric(rows, 'sum', valueColumn)).toBe(9_000_033)
    expect(computeMetric(rows, 'average', valueColumn)).toBe(2_250_008.25)
    expect(computeMetric(rows, 'min', valueColumn)).toBe(10)
    expect(computeMetric(rows, 'max', valueColumn)).toBe(9_000_000)
    expect(rows).toHaveLength(4)
  })
})

describe('label warnings follow the column profile', () => {
  const rawRows = [
    ['Cabang', 'Revenue'],
    ['Jakarta', 100],
    ['jakarta', 200],
  ]

  it('keeps structural warnings and replaces the label ones', () => {
    const { normalized, columns } = profile(rawRows)
    const structural = [{ code: 'blank-header', message: 'x', severity: 'warning' as const }]
    const first = refreshLabelWarnings(structural, columns, normalized.rows)

    expect(first.map((warning) => warning.code)).toEqual([
      'blank-header',
      `inconsistent-label-${columns[0].id}`,
    ])

    const numeric = columns.map((item) =>
      item.id === columns[0].id ? { ...item, type: 'number' as const } : item,
    )
    const second = refreshLabelWarnings(first, numeric, normalized.rows)

    expect(second.map((warning) => warning.code)).toEqual(['blank-header'])
  })

  it('names the column as the user renamed it', () => {
    const { normalized, columns } = profile(rawRows)
    const renamed = columns.map((item) =>
      item.id === columns[0].id ? { ...item, displayName: 'Branch' } : item,
    )

    const warnings = refreshLabelWarnings([], renamed, normalized.rows)

    expect(warnings[0].message).toContain('Branch')
    expect(warnings[0].message).not.toContain('Cabang')
  })
})

describe('the warning reaches the imported dataset', () => {
  it('is attached to dataset.warnings without touching the rows', async () => {
    const csv = 'Cabang,Revenue\nJakarta,100\njakarta,200\nBandung,300\n'
    const file = new File([csv], 'cabang.csv', { type: 'text/csv' })
    const workbook = await parseWorkbook(file)
    const dataset = await buildDataset({ workbook, fileName: file.name, fileType: 'csv' })

    expect(dataset.warnings.map((warning) => warning.code)).toEqual([
      `inconsistent-label-${dataset.columns[0].id}`,
    ])
    expect(dataset.rows.map((row) => row.col_0)).toEqual(['Jakarta', 'jakarta', 'Bandung'])
    expect(dataset.rowCount).toBe(3)
  })
})