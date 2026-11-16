import { describe, expect, it } from 'vitest'
import type { Dataset, DatasetColumn } from '@/domain/dataset.types'
import {
  forecastTimeSeries,
  runChiSquareTest,
  runWelchTTest,
  trainPredictiveRegression,
} from '@/services/advanced-methods.service'

const columns: DatasetColumn[] = [
  { id: 'a', originalName: 'A', displayName: 'A', type: 'number', nullCount: 0, distinctCount: 32, sampleValues: [1, 2, 3], inferenceConfidence: 1, typeMismatchCount: 0 },
  { id: 'b', originalName: 'B', displayName: 'B', type: 'number', nullCount: 0, distinctCount: 32, sampleValues: [2, 4, 6], inferenceConfidence: 1, typeMismatchCount: 0 },
  { id: 'date', originalName: 'Date', displayName: 'Date', type: 'date', nullCount: 0, distinctCount: 32, sampleValues: [], inferenceConfidence: 1, typeMismatchCount: 0 },
  { id: 'region', originalName: 'Region', displayName: 'Region', type: 'text', nullCount: 0, distinctCount: 2, sampleValues: ['North', 'South'], inferenceConfidence: 1, typeMismatchCount: 0 },
  { id: 'channel', originalName: 'Channel', displayName: 'Channel', type: 'text', nullCount: 0, distinctCount: 2, sampleValues: ['Online', 'Retail'], inferenceConfidence: 1, typeMismatchCount: 0 },
]

function fixture(): Dataset {
  return {
    id: 'methods-ds',
    name: 'Methods fixture',
    sourceFileName: 'methods.csv',
    sourceFileType: 'csv',
    createdAt: '2026-11-16T00:00:00.000Z',
    updatedAt: '2026-11-16T00:00:00.000Z',
    rowCount: 32,
    columns,
    rows: Array.from({ length: 32 }, (_, index) => {
      const x = index + 1
      const date = new Date(Date.UTC(2026, 0, 1 + index * 7))
      return {
        a: x,
        b: 2 * x,
        date,
        region: index < 16 ? 'North' : 'South',
        channel: index < 16 ? 'Online' : 'Retail',
      }
    }),
    warnings: [],
  }
}

describe('advanced statistical and predictive methods', () => {
  it('runs Welch two-sample t-test and returns a confidence interval', () => {
    const result = runWelchTTest(fixture(), 'a', 'b')
    expect(result).not.toBeNull()
    expect(result?.leftN).toBe(32)
    expect(result?.rightN).toBe(32)
    expect(result?.pValue).toBeLessThan(0.05)
    expect(result?.significantAt05).toBe(true)
    expect(result?.confidenceInterval95[0]).toBeLessThan(result?.confidenceInterval95[1] ?? 0)
  })

  it('runs chi-square independence test for associated categories', () => {
    const result = runChiSquareTest(fixture(), 'region', 'channel')
    expect(result).not.toBeNull()
    expect(result?.observations).toBe(32)
    expect(result?.degreesOfFreedom).toBe(1)
    expect(result?.chiSquare).toBeCloseTo(32)
    expect(result?.pValue).toBeLessThan(0.001)
    expect(result?.cellsBelowFive).toBe(0)
  })

  it('forecasts a date series and evaluates a chronological holdout', () => {
    const result = forecastTimeSeries(fixture(), 'date', 'b', 6)
    expect(result).not.toBeNull()
    expect(result?.observations).toBe(32)
    expect(result?.cadenceDays).toBe(7)
    expect(result?.horizon).toBe(6)
    expect(result?.points.filter((point) => point.kind === 'forecast')).toHaveLength(6)
    expect(result?.backtest.rmse).toBeLessThan(1e-8)
    expect(result?.points.at(-1)?.value).toBeGreaterThan(result?.points.at(-7)?.value ?? 0)
  })

  it('trains deterministic ridge regression and evaluates unseen rows', () => {
    const result = trainPredictiveRegression(fixture(), 'b', ['a'])
    expect(result).not.toBeNull()
    expect(result?.trainSize).toBe(26)
    expect(result?.testSize).toBe(6)
    expect(result?.rSquared).toBeGreaterThan(0.98)
    expect(result?.predictions).toHaveLength(6)
    expect(result?.coefficients[0].name).toBe('A')
  })

  it('returns no predictive model when there are too few observations', () => {
    const dataset = fixture()
    dataset.rows = dataset.rows.slice(0, 8)
    expect(trainPredictiveRegression(dataset, 'b', ['a'])).toBeNull()
  })

  it('does not mutate the source dataset during analysis', () => {
    const dataset = fixture()
    const before = JSON.stringify(dataset.rows)
    runWelchTTest(dataset, 'a', 'b')
    runChiSquareTest(dataset, 'region', 'channel')
    forecastTimeSeries(dataset, 'date', 'b', 4)
    trainPredictiveRegression(dataset, 'b', ['a'])
    expect(JSON.stringify(dataset.rows)).toBe(before)
  })
})
