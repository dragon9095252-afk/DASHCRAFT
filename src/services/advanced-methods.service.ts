import type { Dataset } from '@/domain/dataset.types'
import { isBlank, toDate, toNumber } from '@/lib/value-utils'

export interface WelchTTestResult {
  leftName: string
  rightName: string
  leftN: number
  rightN: number
  leftMean: number
  rightMean: number
  meanDifference: number
  tStatistic: number
  degreesOfFreedom: number
  pValue: number
  significantAt05: boolean
  confidenceInterval95: [number, number]
  warning: string | null
}

export interface ChiSquareResult {
  leftName: string
  rightName: string
  observations: number
  chiSquare: number
  degreesOfFreedom: number
  pValue: number
  minimumExpectedCount: number
  cellsBelowFive: number
  warning: string | null
}

export interface ForecastPoint {
  date: string
  value: number
  kind: 'actual' | 'forecast'
}

export interface TimeSeriesForecast {
  dateName: string
  targetName: string
  observations: number
  horizon: number
  cadenceDays: number
  points: ForecastPoint[]
  backtest: {
    testSize: number
    mae: number
    rmse: number
    mape: number | null
  }
  method: string
}

export interface PredictiveModelResult {
  targetName: string
  featureNames: string[]
  trainSize: number
  testSize: number
  mae: number
  rmse: number
  rSquared: number
  intercept: number
  coefficients: Array<{ name: string; coefficient: number }>
  predictions: Array<{ actual: number; predicted: number }>
  method: string
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function sampleVariance(values: number[]): number {
  const average = mean(values)
  return values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1)
}

function logGamma(value: number): number {
  const coefficients = [
    676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -0.13857109526572012,
    9.984369578019572e-6, 1.5056327351493116e-7,
  ]
  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value)
  }
  const shifted = value - 1
  let sum = 0.9999999999998099
  coefficients.forEach((coefficient, index) => { sum += coefficient / (shifted + index + 1) })
  const t = shifted + coefficients.length - 0.5
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(sum)
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const maxIterations = 200
  const epsilon = 3e-14
  const tiny = 1e-300
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - qab * x / qap
  if (Math.abs(d) < tiny) d = tiny
  d = 1 / d
  let h = d

  for (let m = 1; m <= maxIterations; m += 1) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < tiny) d = tiny
    c = 1 + aa / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    h *= d * c

    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < tiny) d = tiny
    c = 1 + aa / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < epsilon) break
  }
  return h
}

function regularizedBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) +
    a * Math.log(x) + b * Math.log1p(-x),
  )
  if (x < (a + 1) / (a + b + 2)) {
    return front * betaContinuedFraction(a, b, x) / a
  }
  return 1 - front * betaContinuedFraction(b, a, 1 - x) / b
}

function regularizedGammaQ(a: number, x: number): number {
  if (x <= 0) return 1
  if (a <= 0) return Number.NaN
  const epsilon = 3e-14
  const tiny = 1e-300
  const logScale = -x + a * Math.log(x) - logGamma(a)
  if (x < a + 1) {
    let term = 1 / a
    let sum = term
    let ap = a
    for (let index = 0; index < 1000; index += 1) {
      ap += 1
      term *= x / ap
      sum += term
      if (Math.abs(term) < Math.abs(sum) * epsilon) break
    }
    const lower = sum * Math.exp(logScale)
    return Math.max(0, Math.min(1, 1 - lower))
  }

  let b = x + 1 - a
  let c = 1 / tiny
  let d = 1 / Math.max(tiny, b)
  let h = d
  for (let index = 1; index <= 1000; index += 1) {
    const an = -index * (index - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < tiny) d = tiny
    c = b + an / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < epsilon) break
  }
  return Math.max(0, Math.min(1, Math.exp(logScale) * h))
}

function studentTwoTailedP(t: number, degrees: number): number {
  const x = degrees / (degrees + t * t)
  return regularizedBeta(x, degrees / 2, 0.5)
}

function studentCritical95(degrees: number): number {
  let low = 0
  let high = 20
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = (low + high) / 2
    if (studentTwoTailedP(middle, degrees) > 0.05) low = middle
    else high = middle
  }
  return (low + high) / 2
}

/** Welch's independent two-sample t-test with a two-sided p-value and 95% CI. */
export function runWelchTTest(
  dataset: Dataset,
  leftColumnId: string,
  rightColumnId: string,
): WelchTTestResult | null {
  if (leftColumnId === rightColumnId) return null
  const leftColumn = dataset.columns.find((column) => column.id === leftColumnId)
  const rightColumn = dataset.columns.find((column) => column.id === rightColumnId)
  if (!leftColumn || !rightColumn || leftColumn.type !== 'number' || rightColumn.type !== 'number') return null

  const left = dataset.rows.map((row) => toNumber(row[leftColumnId])).filter((value): value is number => value !== null)
  const right = dataset.rows.map((row) => toNumber(row[rightColumnId])).filter((value): value is number => value !== null)
  if (left.length < 2 || right.length < 2) return null

  const leftMean = mean(left)
  const rightMean = mean(right)
  const leftVariance = sampleVariance(left)
  const rightVariance = sampleVariance(right)
  const leftTerm = leftVariance / left.length
  const rightTerm = rightVariance / right.length
  const standardError = Math.sqrt(leftTerm + rightTerm)
  if (!standardError || !Number.isFinite(standardError)) return null
  const degrees = (leftTerm + rightTerm) ** 2 /
    (leftTerm ** 2 / (left.length - 1) + rightTerm ** 2 / (right.length - 1))
  const statistic = (leftMean - rightMean) / standardError
  const pValue = studentTwoTailedP(statistic, degrees)
  const critical = studentCritical95(degrees)
  const difference = leftMean - rightMean
  const margin = critical * standardError

  return {
    leftName: leftColumn.displayName,
    rightName: rightColumn.displayName,
    leftN: left.length,
    rightN: right.length,
    leftMean,
    rightMean,
    meanDifference: difference,
    tStatistic: statistic,
    degreesOfFreedom: degrees,
    pValue,
    significantAt05: pValue < 0.05,
    confidenceInterval95: [difference - margin, difference + margin],
    warning: 'Treat the columns as independent samples only when that matches the study design. A p-value does not measure practical importance.',
  }
}

/** Pearson chi-square test of independence for two categorical fields. */
export function runChiSquareTest(
  dataset: Dataset,
  leftColumnId: string,
  rightColumnId: string,
): ChiSquareResult | null {
  if (leftColumnId === rightColumnId) return null
  const leftColumn = dataset.columns.find((column) => column.id === leftColumnId)
  const rightColumn = dataset.columns.find((column) => column.id === rightColumnId)
  const allowed = (type: string) => type === 'text' || type === 'boolean'
  if (!leftColumn || !rightColumn || !allowed(leftColumn.type) || !allowed(rightColumn.type)) return null

  const leftLabels = new Map<string, string>()
  const rightLabels = new Map<string, string>()
  const cells = new Map<string, number>()
  let observations = 0
  for (const row of dataset.rows) {
    const left = row[leftColumnId]
    const right = row[rightColumnId]
    if (isBlank(left) || isBlank(right)) continue
    const leftKey = String(left)
    const rightKey = String(right)
    leftLabels.set(leftKey, leftKey)
    rightLabels.set(rightKey, rightKey)
    const key = JSON.stringify([leftKey, rightKey])
    cells.set(key, (cells.get(key) ?? 0) + 1)
    observations += 1
  }
  const leftKeys = [...leftLabels.keys()]
  const rightKeys = [...rightLabels.keys()]
  if (leftKeys.length < 2 || rightKeys.length < 2 || observations === 0) return null

  const rowTotals = new Map(leftKeys.map((key) => [key, 0]))
  const columnTotals = new Map(rightKeys.map((key) => [key, 0]))
  for (const [encoded, count] of cells) {
    const [left, right] = JSON.parse(encoded) as [string, string]
    rowTotals.set(left, (rowTotals.get(left) ?? 0) + count)
    columnTotals.set(right, (columnTotals.get(right) ?? 0) + count)
  }

  let chiSquare = 0
  let minimumExpected = Number.POSITIVE_INFINITY
  let cellsBelowFive = 0
  for (const left of leftKeys) {
    for (const right of rightKeys) {
      const expected = (rowTotals.get(left) ?? 0) * (columnTotals.get(right) ?? 0) / observations
      const observed = cells.get(JSON.stringify([left, right])) ?? 0
      if (expected > 0) {
        chiSquare += ((observed - expected) ** 2) / expected
        minimumExpected = Math.min(minimumExpected, expected)
        if (expected < 5) cellsBelowFive += 1
      }
    }
  }
  const degrees = (leftKeys.length - 1) * (rightKeys.length - 1)
  if (!degrees) return null
  const pValue = regularizedGammaQ(degrees / 2, chiSquare / 2)

  return {
    leftName: leftColumn.displayName,
    rightName: rightColumn.displayName,
    observations,
    chiSquare,
    degreesOfFreedom: degrees,
    pValue,
    minimumExpectedCount: minimumExpected,
    cellsBelowFive,
    warning: cellsBelowFive
      ? 'Some expected cell counts are below 5. The chi-square approximation may be unreliable; combine categories or use an exact test for small tables.'
      : null,
  }
}

interface DatedValue {
  time: number
  value: number
}

function holtForecast(values: number[], horizon: number, alpha = 0.4, beta = 0.2): number[] {
  if (!values.length) return []
  let level = values[0]
  let trend = values.length > 1 ? values[1] - values[0] : 0
  for (let index = 1; index < values.length; index += 1) {
    const previousLevel = level
    level = alpha * values[index] + (1 - alpha) * (level + trend)
    trend = beta * (level - previousLevel) + (1 - beta) * trend
  }
  return Array.from({ length: horizon }, (_, index) => level + (index + 1) * trend)
}

/** Holt's additive-trend forecast with a chronological holdout backtest. */
export function forecastTimeSeries(
  dataset: Dataset,
  dateColumnId: string,
  targetColumnId: string,
  horizon = 6,
): TimeSeriesForecast | null {
  const dateColumn = dataset.columns.find((column) => column.id === dateColumnId)
  const targetColumn = dataset.columns.find((column) => column.id === targetColumnId)
  if (!dateColumn || dateColumn.type !== 'date' || !targetColumn || targetColumn.type !== 'number') return null

  const grouped = new Map<number, { sum: number; count: number }>()
  for (const row of dataset.rows) {
    const date = toDate(row[dateColumnId])
    const value = toNumber(row[targetColumnId])
    if (!date || value === null) continue
    const time = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    const current = grouped.get(time) ?? { sum: 0, count: 0 }
    current.sum += value
    current.count += 1
    grouped.set(time, current)
  }
  const observations: DatedValue[] = [...grouped.entries()]
    .map(([time, item]) => ({ time, value: item.sum / item.count }))
    .sort((a, b) => a.time - b.time)
  if (observations.length < 8) return null

  const gaps = observations.slice(1).map((item, index) => item.time - observations[index].time)
    .filter((gap) => gap > 0).sort((a, b) => a - b)
  const cadenceMs = gaps[Math.floor(gaps.length / 2)] ?? 86_400_000
  const cadenceDays = Math.max(1, Math.round(cadenceMs / 86_400_000))
  const safeHorizon = Math.max(1, Math.min(24, Math.floor(horizon)))
  const testSize = Math.min(Math.max(2, Math.floor(observations.length * 0.2)), observations.length - 5)
  const split = observations.length - testSize
  const trainingValues = observations.slice(0, split).map((item) => item.value)
  const holdoutValues = observations.slice(split).map((item) => item.value)
  const predictions = holtForecast(trainingValues, testSize)
  const errors = holdoutValues.map((actual, index) => actual - predictions[index])
  const mae = errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length
  const rmse = Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / errors.length)
  const percentageErrors = holdoutValues.flatMap((actual, index) =>
    actual === 0 ? [] : [Math.abs(errors[index] / actual)],
  )
  const mape = percentageErrors.length
    ? percentageErrors.reduce((sum, value) => sum + value, 0) / percentageErrors.length * 100
    : null

  const fitted = holtForecast(observations.map((item) => item.value), safeHorizon)
  const points: ForecastPoint[] = observations.map((item) => ({
    date: new Date(item.time).toISOString(),
    value: item.value,
    kind: 'actual',
  }))
  fitted.forEach((value, index) => {
    points.push({
      date: new Date(observations[observations.length - 1].time + cadenceMs * (index + 1)).toISOString(),
      value,
      kind: 'forecast',
    })
  })

  return {
    dateName: dateColumn.displayName,
    targetName: targetColumn.displayName,
    observations: observations.length,
    horizon: safeHorizon,
    cadenceDays,
    points,
    backtest: { testSize, mae, rmse, mape },
    method: 'Holt linear trend (alpha 0.4, beta 0.2) with chronological holdout',
  }
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] | null {
  const size = vector.length
  const augmented = matrix.map((row, index) => [...row, vector[index]])
  for (let column = 0; column < size; column += 1) {
    let pivot = column
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row
    }
    if (Math.abs(augmented[pivot][column]) < 1e-12) return null
    ;[augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]]
    const divisor = augmented[column][column]
    for (let index = column; index <= size; index += 1) augmented[column][index] /= divisor
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue
      const factor = augmented[row][column]
      for (let index = column; index <= size; index += 1) {
        augmented[row][index] -= factor * augmented[column][index]
      }
    }
  }
  return augmented.map((row) => row[size])
}

/** Deterministic 80/20 holdout ridge regression; missing predictors are imputed from training data only. */
export function trainPredictiveRegression(
  dataset: Dataset,
  targetColumnId: string,
  requestedFeatureIds?: string[],
): PredictiveModelResult | null {
  const targetColumn = dataset.columns.find((column) => column.id === targetColumnId)
  if (!targetColumn || targetColumn.type !== 'number') return null
  const numericColumns = dataset.columns.filter((column) =>
    column.type === 'number' && column.id !== targetColumnId &&
    (requestedFeatureIds === undefined || requestedFeatureIds.includes(column.id)),
  ).slice(0, 8)
  if (!numericColumns.length) return null

  const samples = dataset.rows.flatMap((row) => {
    const target = toNumber(row[targetColumnId])
    return target === null ? [] : [{ target, features: numericColumns.map((column) => toNumber(row[column.id])) }]
  })
  if (samples.length < 12) return null

  let seed = 1729
  const shuffled = [...samples]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    seed = (seed * 9301 + 49297) % 233280
    const swap = Math.floor((seed / 233280) * (index + 1))
    ;[shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]
  }
  const testSize = Math.max(2, Math.floor(shuffled.length * 0.2))
  const test = shuffled.slice(0, testSize)
  const train = shuffled.slice(testSize)
  if (train.length < numericColumns.length + 2) return null

  const featureMeans = numericColumns.map((_, dimension) => {
    const observed = train.flatMap((sample) =>
      sample.features[dimension] === null ? [] : [sample.features[dimension] as number],
    )
    return observed.length ? mean(observed) : 0
  })
  const impute = (sample: typeof samples[number]) =>
    sample.features.map((value, dimension) => value ?? featureMeans[dimension])
  const rawTrain = train.map(impute)
  const rawTest = test.map(impute)
  const featureMeansTrain = numericColumns.map((_, dimension) =>
    mean(rawTrain.map((row) => row[dimension])),
  )
  const featureScales = numericColumns.map((_, dimension) => {
    const values = rawTrain.map((row) => row[dimension])
    const variance = values.reduce((sum, value) => sum + (value - featureMeansTrain[dimension]) ** 2, 0) / values.length
    return Math.sqrt(variance) || 1
  })
  const transform = (rows: number[][]) => rows.map((row) =>
    row.map((value, dimension) => (value - featureMeansTrain[dimension]) / featureScales[dimension]),
  )
  const xTrain = transform(rawTrain)
  const xTest = transform(rawTest)
  const yMean = mean(train.map((sample) => sample.target))
  const design = xTrain.map((row) => [1, ...row])
  const target = train.map((sample) => sample.target - yMean)
  const dimensions = numericColumns.length + 1
  const gram = Array.from({ length: dimensions }, () => Array.from({ length: dimensions }, () => 0))
  const cross = Array.from({ length: dimensions }, () => 0)
  design.forEach((row, sampleIndex) => {
    row.forEach((left, i) => {
      cross[i] += left * target[sampleIndex]
      row.forEach((right, j) => { gram[i][j] += left * right })
    })
  })
  const lambda = 1
  for (let index = 1; index < dimensions; index += 1) gram[index][index] += lambda
  const coefficients = solveLinearSystem(gram, cross)
  if (!coefficients) return null

  const predictions = test.map((sample, index) => {
    const predicted = yMean + coefficients[0] +
      xTest[index].reduce((sum, value, dimension) => sum + value * coefficients[dimension + 1], 0)
    return { actual: sample.target, predicted }
  })
  const errors = predictions.map((item) => item.actual - item.predicted)
  const mae = errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length
  const rmse = Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / errors.length)
  const testMean = mean(predictions.map((item) => item.actual))
  const totalSquares = predictions.reduce((sum, item) => sum + (item.actual - testMean) ** 2, 0)
  const residualSquares = errors.reduce((sum, error) => sum + error * error, 0)
  const rSquared = totalSquares ? 1 - residualSquares / totalSquares : Number.NaN

  return {
    targetName: targetColumn.displayName,
    featureNames: numericColumns.map((column) => column.displayName),
    trainSize: train.length,
    testSize,
    mae,
    rmse,
    rSquared,
    intercept: yMean + coefficients[0] - numericColumns.reduce(
      (sum, _, index) => sum + (coefficients[index + 1] / featureScales[index]) * featureMeansTrain[index],
      0,
    ),
    coefficients: numericColumns.map((column, index) => ({
      name: column.displayName,
      coefficient: coefficients[index + 1] / featureScales[index],
    })).sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient)),
    predictions,
    method: 'Ridge regression (lambda 1.0), deterministic 80/20 holdout, training-only mean imputation and standardization',
  }
}
