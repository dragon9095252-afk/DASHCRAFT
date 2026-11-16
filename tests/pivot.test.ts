import { describe, expect, it } from 'vitest'
import type { Dataset, DatasetColumn } from '@/domain/dataset.types'
import { buildPivotTable, PivotConfigurationError } from '@/services/pivot.service'

const columns: DatasetColumn[] = [
  { id: 'region', originalName: 'Region', displayName: 'Region', type: 'text', nullCount: 0, distinctCount: 2, sampleValues: ['East', 'West'], inferenceConfidence: 1, typeMismatchCount: 0 },
  { id: 'category', originalName: 'Category', displayName: 'Category', type: 'text', nullCount: 0, distinctCount: 2, sampleValues: ['Hardware', 'Software'], inferenceConfidence: 1, typeMismatchCount: 0 },
  { id: 'sales', originalName: 'Sales', displayName: 'Sales', type: 'number', nullCount: 0, distinctCount: 4, sampleValues: [10, 20, 30, 40], inferenceConfidence: 1, typeMismatchCount: 0 },
]

function fixture(): Dataset {
  return {
    id: 'pivot-ds', name: 'Sales', sourceFileName: 'sales.csv', sourceFileType: 'csv',
    createdAt: '2026-11-16T00:00:00.000Z', updatedAt: '2026-11-16T00:00:00.000Z',
    rowCount: 4, columns, rows: [
      { region: 'East', category: 'Hardware', sales: 10 },
      { region: 'East', category: 'Software', sales: 20 },
      { region: 'West', category: 'Hardware', sales: 30 },
      { region: 'West', category: 'Software', sales: 40 },
    ], warnings: [],
  }
}

describe('pivot table engine', () => {
  it('builds a cross-tab with correct row, column, and grand totals', () => {
    const result = buildPivotTable(fixture(), {
      rowFieldIds: ['category'], columnFieldIds: ['region'],
      measure: { fieldId: 'sales', aggregation: 'sum' },
    })
    const hardware = result.rows.find((row) => row.label === 'Hardware')
    const software = result.rows.find((row) => row.label === 'Software')
    expect(result.columns.map((column) => column.label)).toEqual(['East', 'West'])
    expect(hardware?.cells[result.columns[0].key]).toBe(10)
    expect(hardware?.cells[result.columns[1].key]).toBe(30)
    expect(software?.total).toBe(60)
    expect(result.grandTotal).toBe(100)
    expect(result.rows.at(-1)?.kind).toBe('grand-total')
  })

  it('builds nested row subtotals', () => {
    const result = buildPivotTable(fixture(), {
      rowFieldIds: ['region', 'category'], columnFieldIds: [],
      measure: { fieldId: 'sales', aggregation: 'sum' }, showSubtotals: true,
    })
    expect(result.rows.find((row) => row.kind === 'subtotal' && row.label === 'East')?.total).toBe(30)
    expect(result.rows.find((row) => row.kind === 'subtotal' && row.label === 'West')?.total).toBe(70)
    expect(result.rows.filter((row) => row.kind === 'detail')).toHaveLength(4)
    expect(result.grandTotal).toBe(100)
  })

  it('recomputes average and median totals from source rows', () => {
    const dataset = fixture()
    dataset.rows.push({ region: 'East', category: 'Hardware', sales: 100 })
    dataset.rowCount = dataset.rows.length
    const average = buildPivotTable(dataset, {
      rowFieldIds: ['region'], columnFieldIds: [],
      measure: { fieldId: 'sales', aggregation: 'average' },
    })
    expect(average.rows.find((row) => row.label === 'East')?.total).toBe(130 / 3)
    expect(average.grandTotal).toBe(40)
    const median = buildPivotTable(fixture(), {
      rowFieldIds: ['region'], columnFieldIds: [],
      measure: { fieldId: 'sales', aggregation: 'median' },
    })
    expect(median.grandTotal).toBe(25)
  })

  it('supports distinct count and include/exclude filters', () => {
    const result = buildPivotTable(fixture(), {
      rowFieldIds: ['region'], columnFieldIds: [],
      measure: { fieldId: 'category', aggregation: 'distinctCount' },
      filters: [{ columnId: 'region', includeValues: ['East'] }],
    })
    expect(result.filteredRowCount).toBe(2)
    expect(result.grandTotal).toBe(2)
  })

  it('sorts boolean dimensions by boolean value rather than string truthiness', () => {
    const dataset = fixture()
    dataset.columns.push({ id: 'active', originalName: 'Active', displayName: 'Active', type: 'boolean', nullCount: 0, distinctCount: 2, sampleValues: ['false', 'true'], inferenceConfidence: 1, typeMismatchCount: 0 })
    dataset.rows[0].active = 'true'
    dataset.rows[1].active = 'false'
    dataset.rows[2].active = true
    dataset.rows[3].active = false
    const result = buildPivotTable(dataset, {
      rowFieldIds: ['active'], columnFieldIds: [],
      measure: { fieldId: 'sales', aggregation: 'sum' },
    })
    expect(result.rows.map((row) => row.label)).toEqual(['false', 'true', 'Grand Total'])
  })

  it('rejects a field used on both pivot axes', () => {
    expect(() => buildPivotTable(fixture(), {
      rowFieldIds: ['region'], columnFieldIds: ['region'],
      measure: { fieldId: 'sales', aggregation: 'sum' },
    })).toThrow(PivotConfigurationError)
  })
})
