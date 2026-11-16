export interface NumericColumnStatistics {
  columnId: string
  columnName: string
  rowCount: number
  validCount: number
  missingCount: number
  invalidCount: number
  distinctCount: number
  zeroCount: number
  sum: number | null
  mean: number | null
  median: number | null
  min: number | null
  max: number | null
  sampleVariance: number | null
  sampleStandardDeviation: number | null
  q1: number | null
  q3: number | null
  interquartileRange: number | null
  lowerOutlierFence: number | null
  upperOutlierFence: number | null
  outlierCount: number
}

export interface CorrelationResult {
  leftColumnId: string
  rightColumnId: string
  coefficient: number | null
  sampleSize: number
}

export interface DatasetStatisticalAnalysis {
  rowCount: number
  numericColumnCount: number
  columns: NumericColumnStatistics[]
  correlations: CorrelationResult[]
}

export interface HistogramBin {
  start: number
  end: number
  count: number
  index: number
}
