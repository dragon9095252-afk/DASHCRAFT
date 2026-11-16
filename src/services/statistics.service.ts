import type { Dataset, DatasetColumn } from '@/domain/dataset.types'
import type {
  CorrelationResult,
  DatasetStatisticalAnalysis,
  HistogramBin,
  NumericColumnStatistics,
} from '@/domain/statistics.types'
import { isBlank, toNumber } from '@/lib/value-utils'

function numericValues(dataset: Dataset, columnId: string): number[] {
  const values: number[] = []
  for (const row of dataset.rows) {
    const value = toNumber(row[columnId])
    if (value !== null) values.push(value)
  }
  return values
}

function quantile(sortedValues: number[], probability: number): number | null {
  if (sortedValues.length === 0) return null
  if (sortedValues.length === 1) return sortedValues[0]
  const position = (sortedValues.length - 1) * probability
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  if (lowerIndex === upperIndex) return sortedValues[lowerIndex]
  const fraction = position - lowerIndex
  return sortedValues[lowerIndex] + (sortedValues[upperIndex] - sortedValues[lowerIndex]) * fraction
}

function summarizeColumn(dataset: Dataset, column: DatasetColumn): NumericColumnStatistics {
  const rawValues = dataset.rows.map((row) => row[column.id])
  const values = rawValues.map(toNumber).filter((value): value is number => value !== null)
  const sorted = [...values].sort((left, right) => left - right)
  const sum = values.length ? values.reduce((total, value) => total + value, 0) : null
  const mean = sum === null ? null : sum / values.length
  const median = quantile(sorted, 0.5)
  const q1 = quantile(sorted, 0.25)
  const q3 = quantile(sorted, 0.75)
  const interquartileRange = q1 === null || q3 === null ? null : q3 - q1
  const lowerOutlierFence = q1 === null || interquartileRange === null
    ? null
    : q1 - 1.5 * interquartileRange
  const upperOutlierFence = q3 === null || interquartileRange === null
    ? null
    : q3 + 1.5 * interquartileRange
  const sampleVariance = mean === null || values.length < 2
    ? null
    : values.reduce((total, value) => total + ((value - mean) ** 2), 0) / (values.length - 1)
  const missingCount = rawValues.filter(isBlank).length
  const invalidCount = rawValues.length - missingCount - values.length

  return {
    columnId: column.id,
    columnName: column.displayName,
    rowCount: dataset.rows.length,
    validCount: values.length,
    missingCount,
    invalidCount,
    distinctCount: new Set(values).size,
    zeroCount: values.filter((value) => value === 0).length,
    sum,
    mean,
    median,
    min: sorted[0] ?? null,
    max: sorted[sorted.length - 1] ?? null,
    sampleVariance,
    sampleStandardDeviation: sampleVariance === null ? null : Math.sqrt(sampleVariance),
    q1,
    q3,
    interquartileRange,
    lowerOutlierFence,
    upperOutlierFence,
    outlierCount: lowerOutlierFence === null || upperOutlierFence === null
      ? 0
      : values.filter((value) => value < lowerOutlierFence || value > upperOutlierFence).length,
  }
}

function correlate(
  dataset: Dataset,
  leftColumnId: string,
  rightColumnId: string,
): CorrelationResult {
  const pairs: Array<{ left: number; right: number }> = []
  for (const row of dataset.rows) {
    const left = toNumber(row[leftColumnId])
    const right = toNumber(row[rightColumnId])
    if (left !== null && right !== null) pairs.push({ left, right })
  }

  if (pairs.length < 2) {
    return { leftColumnId, rightColumnId, coefficient: null, sampleSize: pairs.length }
  }

  const leftMean = pairs.reduce((total, pair) => total + pair.left, 0) / pairs.length
  const rightMean = pairs.reduce((total, pair) => total + pair.right, 0) / pairs.length
  let covariance = 0
  let leftSquares = 0
  let rightSquares = 0
  for (const pair of pairs) {
    const leftDelta = pair.left - leftMean
    const rightDelta = pair.right - rightMean
    covariance += leftDelta * rightDelta
    leftSquares += leftDelta ** 2
    rightSquares += rightDelta ** 2
  }

  const denominator = Math.sqrt(leftSquares * rightSquares)
  const coefficient = denominator === 0
    ? null
    : Math.max(-1, Math.min(1, covariance / denominator))

  return { leftColumnId, rightColumnId, coefficient, sampleSize: pairs.length }
}

/** Calculate descriptive statistics and pairwise-complete Pearson correlations. */
export function analyzeDataset(dataset: Dataset): DatasetStatisticalAnalysis {
  const numericColumns = dataset.columns.filter((column) => column.type === 'number')
  const correlations: CorrelationResult[] = []

  for (let left = 0; left < numericColumns.length; left += 1) {
    for (let right = left; right < numericColumns.length; right += 1) {
      correlations.push(correlate(dataset, numericColumns[left].id, numericColumns[right].id))
    }
  }

  return {
    rowCount: dataset.rows.length,
    numericColumnCount: numericColumns.length,
    columns: numericColumns.map((column) => summarizeColumn(dataset, column)),
    correlations,
  }
}

/** Build a Sturges-rule histogram. The final bin includes the maximum value. */
export function buildNumericHistogram(
  dataset: Dataset,
  columnId: string,
  maxBins = 20,
): HistogramBin[] {
  const column = dataset.columns.find((item) => item.id === columnId)
  if (!column || column.type !== 'number') return []

  const values = numericValues(dataset, columnId)
  if (values.length === 0) return []
  let minimum = Number.POSITIVE_INFINITY
  let maximum = Number.NEGATIVE_INFINITY
  for (const value of values) {
    minimum = Math.min(minimum, value)
    maximum = Math.max(maximum, value)
  }
  if (minimum === maximum) return [{ start: minimum, end: maximum, count: values.length, index: 0 }]

  const safeMaxBins = Number.isFinite(maxBins) ? Math.max(1, Math.floor(maxBins)) : 20
  const requestedBins = Math.ceil(1 + Math.log2(values.length))
  const binCount = Math.max(1, Math.min(safeMaxBins, requestedBins))
  const width = (maximum - minimum) / binCount
  const counts = Array.from({ length: binCount }, () => 0)

  for (const value of values) {
    const index = Math.min(binCount - 1, Math.floor((value - minimum) / width))
    counts[index] += 1
  }

  return counts.map((count, index) => ({
    start: minimum + (width * index),
    end: index === binCount - 1 ? maximum : minimum + (width * (index + 1)),
    count,
    index,
  }))
}
