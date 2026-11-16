import { describe, expect, it } from 'vitest'
import type { Dataset, DatasetColumn } from '@/domain/dataset.types'
import { analyzeAdvancedDataset } from '@/services/advanced-analytics.service'

const columns: DatasetColumn[] = [
  { id: 'units', originalName: 'Units', displayName: 'Units', type: 'number', nullCount: 1, distinctCount: 7, sampleValues: [1, 2, 3], inferenceConfidence: 1, typeMismatchCount: 0 },
  { id: 'revenue', originalName: 'Revenue', displayName: 'Revenue', type: 'number', nullCount: 0, distinctCount: 8, sampleValues: [2, 4, 6], inferenceConfidence: 1, typeMismatchCount: 0 },
  { id: 'region', originalName: 'Region', displayName: 'Region', type: 'text', nullCount: 0, distinctCount: 2, sampleValues: ['East', 'West'], inferenceConfidence: 1, typeMismatchCount: 0 },
]

function fixture(): Dataset {
  return {
    id: 'advanced-ds',
    name: 'Advanced fixture',
    sourceFileName: 'sample.csv',
    sourceFileType: 'csv',
    createdAt: '2026-11-16T00:00:00.000Z',
    updatedAt: '2026-11-16T00:00:00.000Z',
    rowCount: 8,
    columns,
    rows: [
      { units: 1, revenue: 2, region: 'East' },
      { units: 2, revenue: 4, region: 'East' },
      { units: 3, revenue: 6, region: 'West' },
      { units: 4, revenue: 8, region: 'West' },
      { units: 5, revenue: 10, region: 'East' },
      { units: 6, revenue: 12, region: 'West' },
      { units: 100, revenue: 200, region: 'East' },
      { units: null, revenue: 16, region: 'West' },
    ],
    warnings: [],
  }
}

describe('advanced analytics workbench engine', () => {
  it('profiles completeness, duplicates and numeric outliers without mutating source rows', () => {
    const dataset = fixture()
    const before = JSON.stringify(dataset.rows)
    const report = analyzeAdvancedDataset(dataset)
    const units = report.columns.find((column) => column.columnId === 'units')

    expect(report.rowCount).toBe(8)
    expect(report.columnCount).toBe(3)
    expect(report.missingCells).toBe(1)
    expect(report.completenessRate).toBeCloseTo(1 - 1 / 24)
    expect(units?.missingCount).toBe(1)
    expect(units?.validCount).toBe(7)
    expect(units?.outlierCount).toBeGreaterThan(0)
    expect(JSON.stringify(dataset.rows)).toBe(before)
  })

  it('finds strong relationships and fits an exploratory linear model', () => {
    const report = analyzeAdvancedDataset(fixture())
    const relationship = report.correlations.find((item) =>
      item.leftColumnId === 'units' && item.rightColumnId === 'revenue',
    )
    const model = report.regressions.find((item) =>
      item.predictorId === 'units' && item.targetId === 'revenue',
    )

    expect(relationship?.coefficient).toBeCloseTo(1)
    expect(model?.slope).toBeCloseTo(2)
    expect(model?.intercept).toBeCloseTo(0)
    expect(model?.rSquared).toBeCloseTo(1)
  })

  it('creates deterministic clusters from complete numeric records', () => {
    const dataset = fixture()
    const first = analyzeAdvancedDataset(dataset)
    const second = analyzeAdvancedDataset(dataset)

    expect(first.clusters.length).toBeGreaterThan(0)
    expect(first.clusters.reduce((sum, cluster) => sum + cluster.count, 0)).toBe(7)
    expect(first.clusters).toEqual(second.clusters)
  })

  it('reports duplicates and type mismatches', () => {
    const dataset = fixture()
    dataset.rows[7] = { units: 'not numeric', revenue: 16, region: 'West' }
    dataset.rows.push({ units: 'not numeric', revenue: 16, region: 'West' })
    const report = analyzeAdvancedDataset(dataset)

    expect(report.duplicateRows).toBe(1)
    expect(report.columns.find((column) => column.columnId === 'units')?.invalidCount).toBe(2)
    expect(report.insights.some((item) => item.id === 'duplicates')).toBe(true)
  })

  it('skips segmentation when fewer than two numeric columns are available', () => {
    const dataset = fixture()
    dataset.columns = dataset.columns.filter((column) => column.type !== 'number' || column.id === 'units')
    const report = analyzeAdvancedDataset(dataset)
    expect(report.clusters).toEqual([])
  })
})
