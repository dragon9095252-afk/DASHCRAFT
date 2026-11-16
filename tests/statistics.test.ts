import { describe, expect, it } from 'vitest'
import type { Dataset, DatasetColumn } from '@/domain/dataset.types'
import { analyzeDataset, buildNumericHistogram } from '@/services/statistics.service'

const columns: DatasetColumn[] = [
  { id: 'sales', originalName: 'Sales', displayName: 'Sales', type: 'number', nullCount: 1, distinctCount: 5, sampleValues: [10, 20, 30], inferenceConfidence: 1, typeMismatchCount: 1 },
  { id: 'cost', originalName: 'Cost', displayName: 'Cost', type: 'number', nullCount: 0, distinctCount: 5, sampleValues: [20, 40, 60], inferenceConfidence: 1, typeMismatchCount: 0 },
  { id: 'reverse', originalName: 'Reverse', displayName: 'Reverse', type: 'number', nullCount: 0, distinctCount: 5, sampleValues: [100, 90, 80], inferenceConfidence: 1, typeMismatchCount: 0 },
  { id: 'constant', originalName: 'Constant', displayName: 'Constant', type: 'number', nullCount: 0, distinctCount: 1, sampleValues: [5], inferenceConfidence: 1, typeMismatchCount: 0 },
  { id: 'region', originalName: 'Region', displayName: 'Region', type: 'text', nullCount: 0, distinctCount: 2, sampleValues: ['East', 'West'], inferenceConfidence: 1, typeMismatchCount: 0 },
]

function fixture(): Dataset {
  return {
    id: 'stats-ds',
    name: 'Sample statistics',
    sourceFileName: 'sample.csv',
    sourceFileType: 'csv',
    createdAt: '2026-11-16T00:00:00.000Z',
    updatedAt: '2026-11-16T00:00:00.000Z',
    rowCount: 7,
    columns: columns.map((column) => ({ ...column, sampleValues: [...column.sampleValues] })),
    rows: [
      { sales: 10, cost: 20, reverse: 100, constant: 5, region: 'East' },
      { sales: 20, cost: 40, reverse: 90, constant: 5, region: 'East' },
      { sales: 30, cost: 60, reverse: 80, constant: 5, region: 'West' },
      { sales: 40, cost: 80, reverse: 70, constant: 5, region: 'West' },
      { sales: 100, cost: 200, reverse: 60, constant: 5, region: 'East' },
      { sales: null, cost: 10, reverse: 50, constant: 5, region: 'West' },
      { sales: 'not-a-number', cost: 5, reverse: 40, constant: 5, region: 'East' },
    ],
    warnings: [],
  }
}

describe('statistical analysis engine', () => {
  it('calculates descriptive statistics, quartiles, and IQR outliers', () => {
    const result = analyzeDataset(fixture())
    const sales = result.columns.find((column) => column.columnId === 'sales')
    expect(result.rowCount).toBe(7)
    expect(result.numericColumnCount).toBe(4)
    expect(sales?.validCount).toBe(5)
    expect(sales?.missingCount).toBe(1)
    expect(sales?.invalidCount).toBe(1)
    expect(sales?.sum).toBe(200)
    expect(sales?.mean).toBe(40)
    expect(sales?.median).toBe(30)
    expect(sales?.q1).toBe(20)
    expect(sales?.q3).toBe(40)
    expect(sales?.interquartileRange).toBe(20)
    expect(sales?.lowerOutlierFence).toBe(-10)
    expect(sales?.upperOutlierFence).toBe(70)
    expect(sales?.outlierCount).toBe(1)
    expect(sales?.sampleVariance).toBe(1250)
    expect(sales?.sampleStandardDeviation).toBeCloseTo(Math.sqrt(1250))
  })

  it('uses pairwise-complete rows for Pearson correlations', () => {
    const result = analyzeDataset(fixture())
    const positive = result.correlations.find((item) => item.leftColumnId === 'sales' && item.rightColumnId === 'cost')
    const negative = result.correlations.find((item) => item.leftColumnId === 'sales' && item.rightColumnId === 'reverse')
    const constant = result.correlations.find((item) => item.leftColumnId === 'sales' && item.rightColumnId === 'constant')
    expect(positive?.coefficient).toBe(1)
    expect(positive?.sampleSize).toBe(5)
    expect(negative?.coefficient).toBe(-1)
    expect(constant?.coefficient).toBeNull()
  })

  it('returns null dispersion when there are fewer than two numeric observations', () => {
    const dataset = fixture()
    dataset.rows = [{ sales: 12, cost: null, reverse: null, constant: 5, region: 'East' }]
    const result = analyzeDataset(dataset)
    const sales = result.columns.find((column) => column.columnId === 'sales')
    expect(sales?.sampleVariance).toBeNull()
    expect(sales?.sampleStandardDeviation).toBeNull()
    expect(sales?.outlierCount).toBe(0)
  })

  it('builds histogram bins that include every valid value exactly once', () => {
    const dataset = fixture()
    const bins = buildNumericHistogram(dataset, 'sales')
    expect(bins.length).toBeGreaterThan(0)
    expect(bins.reduce((total, bin) => total + bin.count, 0)).toBe(5)
    expect(bins[0].start).toBe(10)
    expect(bins[bins.length - 1].end).toBe(100)
  })

  it('returns no histogram for non-numeric or unknown fields', () => {
    expect(buildNumericHistogram(fixture(), 'region')).toEqual([])
    expect(buildNumericHistogram(fixture(), 'missing')).toEqual([])
  })
})
