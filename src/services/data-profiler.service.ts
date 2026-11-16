import type { ColumnType, DatasetColumn, DatasetRow } from '@/domain/dataset.types'
import { distinctKey, isBlank, matchesType, toDate, toNumber } from '@/lib/value-utils'
import type { NormalizedHeader } from './data-normalizer.service'

interface InferenceResult {
  type: ColumnType
  confidence: number
}

function classifyValue(value: unknown): Exclude<ColumnType, 'unknown'> {
  if (value instanceof Date) return 'date'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'string') {
    if (toDate(value) !== null) return 'date'
    if (toNumber(value) !== null) return 'number'
    const lowered = value.trim().toLowerCase()
    if (lowered === 'true' || lowered === 'false') return 'boolean'
    return 'text'
  }
  return 'text'
}

export function inferColumnType(values: unknown[]): InferenceResult {
  const nonBlank = values.filter((value) => !isBlank(value))
  if (nonBlank.length === 0) return { type: 'unknown', confidence: 0 }

  const counts: Record<Exclude<ColumnType, 'unknown'>, number> = {
    text: 0,
    number: 0,
    date: 0,
    boolean: 0,
  }

  for (const value of nonBlank) {
    counts[classifyValue(value)] += 1
  }

  const entries = Object.entries(counts) as Array<[Exclude<ColumnType, 'unknown'>, number]>
  entries.sort((a, b) => b[1] - a[1])
  const [bestType, bestCount] = entries[0]
  const confidence = Number((bestCount / nonBlank.length).toFixed(2))

  if (bestCount / nonBlank.length >= 0.75) {
    return { type: bestType, confidence }
  }

  return { type: 'unknown', confidence }
}

export function countTypeMismatches(values: unknown[], type: ColumnType): number {
  return values.reduce<number>((total, value) => (matchesType(value, type) ? total : total + 1), 0)
}

function collectSamples(values: unknown[], limit = 5): unknown[] {
  const samples: unknown[] = []
  const seen = new Set<string>()
  for (const value of values) {
    if (isBlank(value)) continue
    const key = distinctKey(value)
    if (seen.has(key)) continue
    seen.add(key)
    samples.push(value)
    if (samples.length >= limit) break
  }
  return samples
}

function countDistinct(values: unknown[]): number {
  const seen = new Set<string>()
  for (const value of values) {
    if (isBlank(value)) continue
    seen.add(distinctKey(value))
  }
  return seen.size
}

export function profileColumn(header: NormalizedHeader, rows: DatasetRow[]): DatasetColumn {
  const values = rows.map((row) => row[header.id])
  const inference = inferColumnType(values)
  const nullCount = values.filter((value) => isBlank(value)).length
  return {
    id: header.id,
    originalName: header.originalName,
    displayName: header.displayName,
    type: inference.type,
    nullCount,
    distinctCount: countDistinct(values),
    sampleValues: collectSamples(values),
    inferenceConfidence: inference.confidence,
    typeMismatchCount: countTypeMismatches(values, inference.type),
  }
}

export function profileColumns(headers: NormalizedHeader[], rows: DatasetRow[]): DatasetColumn[] {
  return headers.map((header) => profileColumn(header, rows))
}

export function withColumnType(
  column: DatasetColumn,
  rows: DatasetRow[],
  type: ColumnType,
): DatasetColumn {
  const values = rows.map((row) => row[column.id])
  return {
    ...column,
    type,
    typeMismatchCount: countTypeMismatches(values, type),
  }
}
