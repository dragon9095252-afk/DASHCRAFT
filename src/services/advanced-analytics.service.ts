import type { Dataset, DatasetColumn } from '@/domain/dataset.types'
import { distinctKey, isBlank, toBoolean, toDate, toNumber } from '@/lib/value-utils'

export interface AnalyticsTopValue {
  label: string
  count: number
}

export interface AnalyticsColumnProfile {
  columnId: string
  name: string
  type: string
  validCount: number
  missingCount: number
  invalidCount: number
  distinctCount: number
  uniquenessRate: number
  missingRate: number
  min: number | null
  max: number | null
  mean: number | null
  median: number | null
  standardDeviation: number | null
  q1: number | null
  q3: number | null
  outlierCount: number
  topValues: AnalyticsTopValue[]
}

export interface AnalyticsCorrelation {
  leftColumnId: string
  leftName: string
  rightColumnId: string
  rightName: string
  coefficient: number
  sampleSize: number
}

export interface AnalyticsRegression {
  predictorId: string
  predictorName: string
  targetId: string
  targetName: string
  slope: number
  intercept: number
  rSquared: number
  sampleSize: number
}

export interface AnalyticsCluster {
  id: number
  label: string
  count: number
  share: number
  centroid: Record<string, number>
}

export interface AdvancedAnalyticsReport {
  rowCount: number
  columnCount: number
  numericColumnCount: number
  categoricalColumnCount: number
  dateColumnCount: number
  missingCells: number
  duplicateRows: number
  completenessRate: number
  qualityScore: number
  columns: AnalyticsColumnProfile[]
  correlations: AnalyticsCorrelation[]
  regressions: AnalyticsRegression[]
  clusters: AnalyticsCluster[]
  clusterFeatureNames: string[]
  insights: Array<{ id: string; level: 'critical' | 'warning' | 'info'; title: string; detail: string }>
}

function quantile(sorted: number[], probability: number): number | null {
  if (!sorted.length) return null
  const position = (sorted.length - 1) * probability
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

function validValue(value: unknown, column: DatasetColumn): boolean {
  if (isBlank(value)) return false
  if (column.type === 'number') return toNumber(value) !== null
  if (column.type === 'date') return toDate(value) !== null
  if (column.type === 'boolean') return toBoolean(value) !== null
  return true
}

function profileColumn(dataset: Dataset, column: DatasetColumn): AnalyticsColumnProfile {
  const raw = dataset.rows.map((row) => row[column.id])
  const missingCount = raw.filter(isBlank).length
  const valid = raw.filter((value) => validValue(value, column))
  const invalidCount = raw.length - missingCount - valid.length
  const distinct = new Set(valid.map(distinctKey))
  const numbers = column.type === 'number'
    ? valid.map(toNumber).filter((value): value is number => value !== null)
    : []
  const sorted = [...numbers].sort((a, b) => a - b)
  const sum = numbers.reduce((total, value) => total + value, 0)
  const mean = numbers.length ? sum / numbers.length : null
  const median = quantile(sorted, 0.5)
  const q1 = quantile(sorted, 0.25)
  const q3 = quantile(sorted, 0.75)
  const iqr = q1 === null || q3 === null ? null : q3 - q1
  const lowerFence = q1 === null || iqr === null ? null : q1 - 1.5 * iqr
  const upperFence = q3 === null || iqr === null ? null : q3 + 1.5 * iqr
  const variance = mean === null || numbers.length < 2
    ? null
    : numbers.reduce((total, value) => total + (value - mean) ** 2, 0) / (numbers.length - 1)
  const frequencies = new Map<string, number>()
  for (const value of valid) {
    const label = value instanceof Date ? value.toISOString().slice(0, 10) : String(value)
    frequencies.set(label, (frequencies.get(label) ?? 0) + 1)
  }
  const topValues = [...frequencies.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'id-ID'))
    .slice(0, 5)

  return {
    columnId: column.id,
    name: column.displayName,
    type: column.type,
    validCount: valid.length,
    missingCount,
    invalidCount,
    distinctCount: distinct.size,
    uniquenessRate: valid.length ? distinct.size / valid.length : 0,
    missingRate: raw.length ? missingCount / raw.length : 0,
    min: sorted[0] ?? null,
    max: sorted[sorted.length - 1] ?? null,
    mean,
    median,
    standardDeviation: variance === null ? null : Math.sqrt(variance),
    q1,
    q3,
    outlierCount: lowerFence === null || upperFence === null
      ? 0
      : numbers.filter((value) => value < lowerFence || value > upperFence).length,
    topValues,
  }
}

function correlation(
  rows: Dataset['rows'],
  left: DatasetColumn,
  right: DatasetColumn,
): AnalyticsCorrelation | null {
  const pairs: Array<[number, number]> = []
  for (const row of rows) {
    const x = toNumber(row[left.id])
    const y = toNumber(row[right.id])
    if (x !== null && y !== null) pairs.push([x, y])
  }
  if (pairs.length < 3) return null
  const meanX = pairs.reduce((sum, pair) => sum + pair[0], 0) / pairs.length
  const meanY = pairs.reduce((sum, pair) => sum + pair[1], 0) / pairs.length
  let covariance = 0
  let varianceX = 0
  let varianceY = 0
  for (const [x, y] of pairs) {
    const dx = x - meanX
    const dy = y - meanY
    covariance += dx * dy
    varianceX += dx * dx
    varianceY += dy * dy
  }
  const denominator = Math.sqrt(varianceX * varianceY)
  if (!denominator) return null
  return {
    leftColumnId: left.id,
    leftName: left.displayName,
    rightColumnId: right.id,
    rightName: right.displayName,
    coefficient: Math.max(-1, Math.min(1, covariance / denominator)),
    sampleSize: pairs.length,
  }
}

function regression(
  rows: Dataset['rows'],
  predictor: DatasetColumn,
  target: DatasetColumn,
): AnalyticsRegression | null {
  const pairs: Array<[number, number]> = []
  for (const row of rows) {
    const x = toNumber(row[predictor.id])
    const y = toNumber(row[target.id])
    if (x !== null && y !== null) pairs.push([x, y])
  }
  if (pairs.length < 3) return null
  const meanX = pairs.reduce((sum, pair) => sum + pair[0], 0) / pairs.length
  const meanY = pairs.reduce((sum, pair) => sum + pair[1], 0) / pairs.length
  let xx = 0
  let xy = 0
  let yy = 0
  for (const [x, y] of pairs) {
    xx += (x - meanX) ** 2
    xy += (x - meanX) * (y - meanY)
    yy += (y - meanY) ** 2
  }
  if (!xx || !yy) return null
  const slope = xy / xx
  const intercept = meanY - slope * meanX
  const rSquared = Math.max(0, Math.min(1, (xy * xy) / (xx * yy)))
  return {
    predictorId: predictor.id,
    predictorName: predictor.displayName,
    targetId: target.id,
    targetName: target.displayName,
    slope,
    intercept,
    rSquared,
    sampleSize: pairs.length,
  }
}

function clusterRows(dataset: Dataset, numericColumns: DatasetColumn[]): {
  clusters: AnalyticsCluster[]
  featureNames: string[]
} {
  if (numericColumns.length < 2 || dataset.rows.length < 6) return { clusters: [], featureNames: [] }
  const complete = dataset.rows.map((row, index) => ({
    index,
    values: numericColumns.map((column) => toNumber(row[column.id])),
  })).filter((item): item is { index: number; values: number[] } =>
    item.values.every((value): value is number => value !== null),
  )
  if (complete.length < 6) return { clusters: [], featureNames: [] }

  const dimensions = numericColumns.length
  const means = Array.from({ length: dimensions }, (_, d) =>
    complete.reduce((sum, item) => sum + item.values[d], 0) / complete.length,
  )
  const deviations = Array.from({ length: dimensions }, (_, d) => {
    const variance = complete.reduce((sum, item) => sum + (item.values[d] - means[d]) ** 2, 0) / complete.length
    return Math.sqrt(variance)
  })
  const vectors = complete.map((item) => item.values.map((value, d) =>
    deviations[d] ? (value - means[d]) / deviations[d] : 0,
  ))
  const distance = (left: number[], right: number[]) =>
    left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0)

  const k = Math.min(3, Math.max(2, Math.floor(Math.sqrt(vectors.length / 2))))
  const centers = [vectors[0].slice()]
  while (centers.length < k) {
    let farthestIndex = 0
    let farthestDistance = -1
    vectors.forEach((vector, index) => {
      const nearest = Math.min(...centers.map((center) => distance(vector, center)))
      if (nearest > farthestDistance) {
        farthestDistance = nearest
        farthestIndex = index
      }
    })
    centers.push(vectors[farthestIndex].slice())
  }

  let assignments = Array.from({ length: vectors.length }, () => -1)
  for (let iteration = 0; iteration < 40; iteration += 1) {
    let changed = false
    const nextAssignments = vectors.map((vector) => {
      let nearestIndex = 0
      let nearestDistance = Number.POSITIVE_INFINITY
      centers.forEach((center, index) => {
        const currentDistance = distance(vector, center)
        if (currentDistance < nearestDistance) {
          nearestDistance = currentDistance
          nearestIndex = index
        }
      })
      return nearestIndex
    })
    nextAssignments.forEach((value, index) => {
      if (value !== assignments[index]) changed = true
    })
    assignments = nextAssignments
    const sums = Array.from({ length: k }, () => Array.from({ length: dimensions }, () => 0))
    const counts = Array.from({ length: k }, () => 0)
    vectors.forEach((vector, index) => {
      const cluster = assignments[index]
      counts[cluster] += 1
      vector.forEach((value, d) => { sums[cluster][d] += value })
    })
    centers.forEach((center, index) => {
      if (!counts[index]) return
      center.forEach((_, d) => { center[d] = sums[index][d] / counts[index] })
    })
    if (!changed) break
  }

  const counts = Array.from({ length: k }, () => 0)
  const centroidSums = Array.from({ length: k }, () => Array.from({ length: dimensions }, () => 0))
  vectors.forEach((vector, index) => {
    const cluster = assignments[index]
    counts[cluster] += 1
    vector.forEach((value, d) => { centroidSums[cluster][d] += value })
  })
  const clusters = counts.map((count, id) => {
    const centroid: Record<string, number> = {}
    numericColumns.forEach((column, d) => {
      const standardized = count ? centroidSums[id][d] / count : centers[id][d]
      centroid[column.displayName] = means[d] + standardized * deviations[d]
    })
    return {
      id: id + 1,
      label: 'Cluster ' + (id + 1),
      count,
      share: count / complete.length,
      centroid,
    }
  }).filter((cluster) => cluster.count > 0)

  return { clusters, featureNames: numericColumns.map((column) => column.displayName) }
}

/** Deterministic, browser-local exploratory analysis. Correlation and clusters are descriptive, not causal. */
export function analyzeAdvancedDataset(dataset: Dataset): AdvancedAnalyticsReport {
  const columns = dataset.columns.map((column) => profileColumn(dataset, column))
  const numericColumns = dataset.columns.filter((column) => column.type === 'number')
  const categoricalColumnCount = dataset.columns.filter((column) => column.type === 'text' || column.type === 'boolean').length
  const dateColumnCount = dataset.columns.filter((column) => column.type === 'date').length
  const missingCells = columns.reduce((sum, column) => sum + column.missingCount, 0)
  const totalCells = dataset.rows.length * dataset.columns.length
  const completenessRate = totalCells ? 1 - missingCells / totalCells : 1

  const seenRows = new Set<string>()
  let duplicateRows = 0
  for (const row of dataset.rows) {
    const key = JSON.stringify(dataset.columns.map((column) => {
      const value = row[column.id]
      return value instanceof Date ? value.toISOString() : value ?? null
    }))
    if (seenRows.has(key)) duplicateRows += 1
    else seenRows.add(key)
  }

  const correlations: AnalyticsCorrelation[] = []
  const regressions: AnalyticsRegression[] = []
  for (let left = 0; left < numericColumns.length; left += 1) {
    for (let right = left + 1; right < numericColumns.length; right += 1) {
      const result = correlation(dataset.rows, numericColumns[left], numericColumns[right])
      if (result) {
        correlations.push(result)
        const model = regression(dataset.rows, numericColumns[left], numericColumns[right])
        if (model) regressions.push(model)
      }
    }
  }
  correlations.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient))
  regressions.sort((a, b) => b.rSquared - a.rSquared)
  const segmentation = clusterRows(dataset, numericColumns)

  const invalidCells = columns.reduce((sum, column) => sum + column.invalidCount, 0)
  const qualityScore = Math.max(0, Math.round(100
    - (totalCells ? missingCells / totalCells : 0) * 50
    - (dataset.rows.length ? duplicateRows / dataset.rows.length : 0) * 30
    - (totalCells ? invalidCells / totalCells : 0) * 20,
  ))
  const insights: AdvancedAnalyticsReport['insights'] = []
  if (duplicateRows) insights.push({
    id: 'duplicates', level: 'warning', title: 'Duplicate records detected',
    detail: duplicateRows + ' rows repeat an earlier record. Review them before aggregating totals.',
  })
  if (missingCells) insights.push({
    id: 'missing', level: completenessRate < 0.9 ? 'critical' : 'warning', title: 'Missing values found',
    detail: missingCells.toLocaleString('id-ID') + ' cells are empty (' + ((1 - completenessRate) * 100).toFixed(1) + '% of the dataset).',
  })
  for (const column of columns) {
    if (column.invalidCount) insights.push({
      id: 'invalid-' + column.columnId, level: 'warning', title: 'Type mismatch in ' + column.name,
      detail: column.invalidCount + ' non-empty values do not match the detected ' + column.type + ' type.',
    })
    if (column.missingRate >= 0.2) insights.push({
      id: 'sparse-' + column.columnId, level: 'warning', title: column.name + ' is sparsely populated',
      detail: (column.missingRate * 100).toFixed(1) + '% of values are missing. Consider whether to impute, exclude, or preserve this field.',
    })
    if (column.type === 'number' && column.outlierCount) insights.push({
      id: 'outlier-' + column.columnId, level: 'info', title: 'Potential outliers in ' + column.name,
      detail: column.outlierCount + ' values fall outside the 1.5×IQR fences. These are candidates for review, not automatic errors.',
    })
    if (column.validCount > 0 && column.distinctCount === 1) insights.push({
      id: 'constant-' + column.columnId, level: 'info', title: column.name + ' has a single distinct value',
      detail: 'This field does not distinguish records in the current dataset.',
    })
  }
  for (const pair of correlations.filter((item) => Math.abs(item.coefficient) >= 0.7).slice(0, 5)) {
    insights.push({
      id: 'correlation-' + pair.leftColumnId + '-' + pair.rightColumnId,
      level: 'info',
      title: (pair.coefficient > 0 ? 'Positive' : 'Negative') + ' relationship: ' + pair.leftName + ' / ' + pair.rightName,
      detail: 'Pearson r = ' + pair.coefficient.toFixed(3) + ' across ' + pair.sampleSize + ' complete pairs. Association does not establish causation.',
    })
  }
  if (!insights.length) insights.push({
    id: 'clean', level: 'info', title: 'No high-priority data issues detected',
    detail: 'The automated checks did not find missing values, duplicate rows, or strong numeric relationships requiring review.',
  })

  return {
    rowCount: dataset.rows.length,
    columnCount: dataset.columns.length,
    numericColumnCount: numericColumns.length,
    categoricalColumnCount,
    dateColumnCount,
    missingCells,
    duplicateRows,
    completenessRate,
    qualityScore,
    columns,
    correlations,
    regressions,
    clusters: segmentation.clusters,
    clusterFeatureNames: segmentation.featureNames,
    insights,
  }
}
