import type {
  ColumnType,
  Dataset,
  DatasetColumn,
  DatasetRow,
  DatasetWarning,
} from '@/domain/dataset.types'
import type {
  ComparisonOperator,
  TransformationExecutionResult,
  TransformationHistory,
  TransformationStep,
  TransformationStepExecution,
} from '@/domain/transformation.types'
import {
  distinctKey,
  isBlank,
  matchesType,
  toBoolean,
  toDate,
  toNumber,
} from '@/lib/value-utils'

export class TransformationError extends Error {
  readonly stepId: string

  constructor(stepId: string, message: string) {
    super(message)
    this.name = 'TransformationError'
    this.stepId = stepId
  }
}

function fail(step: TransformationStep, message: string): never {
  throw new TransformationError(step.id, message)
}

function localDateText(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}

function getColumn(dataset: Dataset, id: string, step: TransformationStep): DatasetColumn {
  const column = dataset.columns.find((item) => item.id === id)
  if (!column) fail(step, 'Kolom dengan ID "' + id + '" tidak ditemukan.')
  return column
}

function assertColumns(dataset: Dataset, ids: string[], step: TransformationStep): DatasetColumn[] {
  if (ids.length === 0) fail(step, 'Pilih setidaknya satu kolom.')
  if (new Set(ids).size !== ids.length) fail(step, 'Daftar kolom berisi ID duplikat.')
  return ids.map((id) => getColumn(dataset, id, step))
}

function profileColumn(column: DatasetColumn, rows: DatasetRow[]): DatasetColumn {
  const seen = new Set<string>()
  const samples: unknown[] = []
  let nullCount = 0
  let typeMismatchCount = 0

  for (const row of rows) {
    const value = row[column.id]
    if (isBlank(value)) {
      nullCount += 1
      continue
    }
    if (!matchesType(value, column.type)) typeMismatchCount += 1
    const key = distinctKey(value)
    if (!seen.has(key)) {
      seen.add(key)
      if (samples.length < 5) samples.push(value)
    }
  }

  return { ...column, nullCount, distinctCount: seen.size, sampleValues: samples, typeMismatchCount }
}

function nextDataset(
  dataset: Dataset,
  rows: DatasetRow[],
  columns: DatasetColumn[],
  warnings: string[] = [],
): Dataset {
  const addedWarnings: DatasetWarning[] = warnings.map((message, index) => ({
    code: 'transformation-' + Date.now() + '-' + index,
    message,
    severity: 'warning',
  }))
  return {
    ...dataset,
    updatedAt: new Date().toISOString(),
    rows,
    rowCount: rows.length,
    columns: columns.map((column) => profileColumn(column, rows)),
    warnings: [...dataset.warnings, ...addedWarnings],
  }
}

function numericValues(values: unknown[]): number[] {
  return values.map((value) => toNumber(value)).filter((value): value is number => value !== null)
}

function getMedian(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function getMode(values: unknown[]): unknown {
  const counts = new Map<string, { value: unknown; count: number }>()
  for (const value of values) {
    if (isBlank(value)) continue
    const key = distinctKey(value)
    const current = counts.get(key)
    if (current) current.count += 1
    else counts.set(key, { value, count: 1 })
  }
  let best: { value: unknown; count: number } | undefined
  for (const item of counts.values()) {
    if (!best || item.count > best.count) best = item
  }
  return best?.value
}

function fillColumn(
  rows: DatasetRow[],
  column: DatasetColumn,
  step: Extract<TransformationStep, { type: 'fill-missing' }>,
): { rows: DatasetRow[]; changedCells: number } {
  if (step.strategy === 'forward' || step.strategy === 'backward') {
    const nextRows = rows.map((row) => ({ ...row }))
    let carry: unknown = undefined
    let changedCells = 0
    const indexes = rows.map((_, index) => index)
    if (step.strategy === 'backward') indexes.reverse()
    for (const index of indexes) {
      const value = nextRows[index][column.id]
      if (isBlank(value)) {
        if (carry !== undefined) {
          nextRows[index][column.id] = carry
          changedCells += 1
        }
      } else {
        carry = value
      }
    }
    return { rows: nextRows, changedCells }
  }

  let replacement: unknown
  switch (step.strategy) {
    case 'value':
      if (isBlank(step.value)) fail(step, 'Nilai pengganti tidak boleh kosong.')
      replacement = step.value
      break
    case 'mean': {
      const numbers = numericValues(rows.map((row) => row[column.id]))
      if (numbers.length === 0) fail(step, 'Kolom "' + column.displayName + '" tidak memiliki nilai numerik.')
      replacement = numbers.reduce((sum, value) => sum + value, 0) / numbers.length
      break
    }
    case 'median': {
      const value = getMedian(numericValues(rows.map((row) => row[column.id])))
      if (value === null) fail(step, 'Kolom "' + column.displayName + '" tidak memiliki nilai numerik.')
      replacement = value
      break
    }
    case 'mode':
      replacement = getMode(rows.map((row) => row[column.id]))
      if (replacement === undefined) fail(step, 'Kolom "' + column.displayName + '" tidak memiliki nilai untuk menentukan modus.')
      break
    default: {
      const exhaustive: never = step.strategy
      return exhaustive
    }
  }

  let changedCells = 0
  const nextRows = rows.map((row) => {
    if (!isBlank(row[column.id])) return row
    changedCells += 1
    return { ...row, [column.id]: replacement }
  })
  return { rows: nextRows, changedCells }
}

function compareValues(left: unknown, right: unknown, type: ColumnType): number | null {
  if (type === 'number') {
    const a = toNumber(left)
    const b = toNumber(right)
    return a === null || b === null ? null : a < b ? -1 : a > b ? 1 : 0
  }
  if (type === 'date') {
    const a = toDate(left)
    const b = toDate(right)
    return !a || !b ? null : a.getTime() - b.getTime()
  }
  if (type === 'boolean') {
    const a = toBoolean(left)
    const b = toBoolean(right)
    return a === null || b === null ? null : Number(a) - Number(b)
  }
  return String(left).localeCompare(String(right), 'id-ID', { sensitivity: 'base', numeric: true })
}

function matchesFilter(
  value: unknown,
  operator: ComparisonOperator,
  target: unknown,
  type: ColumnType,
): boolean {
  if (operator === 'is-empty') return isBlank(value)
  if (operator === 'is-not-empty') return !isBlank(value)
  if (operator === 'contains' || operator === 'not-contains') {
    const contains = !isBlank(value) &&
      String(value).toLocaleLowerCase().includes(String(target ?? '').toLocaleLowerCase())
    return operator === 'contains' ? contains : !contains
  }
  if (isBlank(value) || target === undefined) return false
  const comparison = compareValues(value, target, type)
  if (comparison === null) return false
  switch (operator) {
    case 'equals': return comparison === 0
    case 'not-equals': return comparison !== 0
    case 'greater-than': return comparison > 0
    case 'greater-or-equal': return comparison >= 0
    case 'less-than': return comparison < 0
    case 'less-or-equal': return comparison <= 0
    default: return false
  }
}

function ensureFreshColumnIds(dataset: Dataset, ids: string[], step: TransformationStep): void {
  if (new Set(ids).size !== ids.length) fail(step, 'ID kolom baru harus unik.')
  for (const id of ids) {
    if (dataset.columns.some((column) => column.id === id)) fail(step, 'ID kolom "' + id + '" sudah digunakan.')
  }
}

function makeTextColumn(id: string, name: string, rows: DatasetRow[]): DatasetColumn {
  const distinct = new Set<string>()
  const samples: unknown[] = []
  let nullCount = 0
  for (const row of rows) {
    const value = row[id]
    if (isBlank(value)) {
      nullCount += 1
      continue
    }
    const key = distinctKey(value)
    if (!distinct.has(key)) {
      distinct.add(key)
      if (samples.length < 5) samples.push(value)
    }
  }
  return {
    id,
    originalName: name,
    displayName: name,
    type: 'text',
    nullCount,
    distinctCount: distinct.size,
    sampleValues: samples,
    inferenceConfidence: 1,
    typeMismatchCount: 0,
  }
}

function applyStep(dataset: Dataset, step: TransformationStep): {
  dataset: Dataset
  changedCells: number
  warnings: string[]
} {
  const warnings: string[] = []

  switch (step.type) {
    case 'rename-column': {
      const column = getColumn(dataset, step.columnId, step)
      const name = step.newName.trim()
      if (!name) fail(step, 'Nama kolom tidak boleh kosong.')
      if (dataset.columns.some((item) =>
        item.id !== column.id && item.displayName.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
      )) fail(step, 'Nama kolom "' + name + '" sudah digunakan.')
      const columns = dataset.columns.map((item) => item.id === column.id ? { ...item, displayName: name } : item)
      return { dataset: nextDataset(dataset, dataset.rows, columns), changedCells: 0, warnings }
    }
    case 'remove-columns': {
      const selected = assertColumns(dataset, step.columnIds, step)
      if (selected.length >= dataset.columns.length) fail(step, 'Tidak dapat menghapus semua kolom dataset.')
      const ids = new Set(step.columnIds)
      const columns = dataset.columns.filter((column) => !ids.has(column.id))
      const rows = dataset.rows.map((row) => {
        const next = { ...row }
        for (const id of ids) delete next[id]
        return next
      })
      return { dataset: nextDataset(dataset, rows, columns), changedCells: rows.length * ids.size, warnings }
    }
    case 'trim-whitespace': {
      const selected = assertColumns(dataset, step.columnIds, step)
      let changedCells = 0
      const rows = dataset.rows.map((row) => {
        let next = row
        for (const column of selected) {
          const value = row[column.id]
          if (typeof value !== 'string') continue
          const result = step.collapseInternalWhitespace ? value.trim().replace(/\s+/g, ' ') : value.trim()
          if (result !== value) {
            if (next === row) next = { ...row }
            next[column.id] = result
            changedCells += 1
          }
        }
        return next
      })
      return { dataset: nextDataset(dataset, rows, dataset.columns), changedCells, warnings }
    }
    case 'fill-missing': {
      const selected = assertColumns(dataset, step.columnIds, step)
      let rows = dataset.rows
      let changedCells = 0
      for (const column of selected) {
        const result = fillColumn(rows, column, step)
        rows = result.rows
        changedCells += result.changedCells
      }
      return { dataset: nextDataset(dataset, rows, dataset.columns), changedCells, warnings }
    }
    case 'change-column-type': {
      const column = getColumn(dataset, step.columnId, step)
      let changedCells = 0
      let mismatches = 0
      const rows = dataset.rows.map((row) => {
        const value = row[column.id]
        if (isBlank(value)) return row
        let converted: unknown = value
        switch (step.targetType) {
          case 'text': converted = value instanceof Date ? localDateText(value) : String(value); break
          case 'number': converted = toNumber(value) ?? value; break
          case 'date': converted = toDate(value) ?? value; break
          case 'boolean': converted = toBoolean(value) ?? value; break
          default: {
            const exhaustive: never = step.targetType
            return exhaustive
          }
        }
        if (!matchesType(converted, step.targetType)) mismatches += 1
        if (Object.is(converted, value)) return row
        changedCells += 1
        return { ...row, [column.id]: converted }
      })
      if (mismatches > 0) warnings.push(
        mismatches + ' nilai tidak cocok dengan tipe ' + step.targetType + ' dan dipertahankan tanpa diubah.',
      )
      const columns = dataset.columns.map((item) =>
        item.id === column.id ? { ...item, type: step.targetType } : item,
      )
      return { dataset: nextDataset(dataset, rows, columns, warnings), changedCells, warnings }
    }
    case 'filter-rows': {
      const column = getColumn(dataset, step.columnId, step)
      if (!['is-empty', 'is-not-empty'].includes(step.operator) && step.value === undefined) {
        fail(step, 'Nilai filter wajib diisi.')
      }
      if (['contains', 'not-contains'].includes(step.operator) && isBlank(step.value)) {
        fail(step, 'Teks pencarian tidak boleh kosong.')
      }
      const rows = dataset.rows.filter((row) => matchesFilter(row[column.id], step.operator, step.value, column.type))
      return { dataset: nextDataset(dataset, rows, dataset.columns), changedCells: 0, warnings }
    }
    case 'split-column': {
      const column = getColumn(dataset, step.columnId, step)
      if (!step.delimiter) fail(step, 'Delimiter tidak boleh kosong.')
      ensureFreshColumnIds(dataset, step.newColumnIds, step)
      const names = step.newColumnNames.map((name) => name.trim()) as [string, string]
      if (!names[0] || !names[1]) fail(step, 'Nama kedua kolom hasil pemisahan wajib diisi.')
      const rows = dataset.rows.map((row) => {
        const value = row[column.id]
        const text = isBlank(value) ? '' : value instanceof Date ? localDateText(value) : String(value)
        const index = text.indexOf(step.delimiter)
        const left = index < 0 ? text : text.slice(0, index)
        const right = index < 0 ? null : text.slice(index + step.delimiter.length)
        const next: DatasetRow = { ...row, [step.newColumnIds[0]]: left || null, [step.newColumnIds[1]]: right }
        if (!step.keepOriginal) delete next[column.id]
        return next
      })
      const retained = step.keepOriginal ? dataset.columns : dataset.columns.filter((item) => item.id !== column.id)
      const columns = [...retained, makeTextColumn(step.newColumnIds[0], names[0], rows), makeTextColumn(step.newColumnIds[1], names[1], rows)]
      return { dataset: nextDataset(dataset, rows, columns), changedCells: rows.length * (step.keepOriginal ? 2 : 3), warnings }
    }
    case 'merge-columns': {
      const selected = assertColumns(dataset, step.columnIds, step)
      if (selected.length < 2) fail(step, 'Pilih setidaknya dua kolom untuk digabungkan.')
      ensureFreshColumnIds(dataset, [step.newColumnId], step)
      const name = step.newColumnName.trim()
      if (!name) fail(step, 'Nama kolom hasil penggabungan wajib diisi.')
      const rows = dataset.rows.map((row) => {
        const parts = selected.map((column) => row[column.id])
          .filter((value) => !isBlank(value))
          .map((value) => value instanceof Date ? localDateText(value) : String(value))
        const next: DatasetRow = { ...row, [step.newColumnId]: parts.length ? parts.join(step.separator) : null }
        if (!step.keepOriginal) for (const column of selected) delete next[column.id]
        return next
      })
      const ids = new Set(selected.map((column) => column.id))
      const retained = step.keepOriginal ? dataset.columns : dataset.columns.filter((column) => !ids.has(column.id))
      const columns = [...retained, makeTextColumn(step.newColumnId, name, rows)]
      return { dataset: nextDataset(dataset, rows, columns), changedCells: rows.length * (step.keepOriginal ? 1 : selected.length + 1), warnings }
    }
    default: {
      const exhaustive: never = step
      return exhaustive
    }
  }
}

export function applyTransformationSteps(
  source: Dataset,
  steps: TransformationStep[],
): TransformationExecutionResult {
  if (new Set(steps.map((step) => step.id)).size !== steps.length) {
    throw new TransformationError('pipeline', 'ID langkah transformasi harus unik.')
  }
  if (steps.some((step) => !step.id.trim())) {
    throw new TransformationError('pipeline', 'Setiap langkah transformasi harus memiliki ID.')
  }

  let dataset: Dataset = {
    ...source,
    columns: source.columns.map((column) => ({ ...column, sampleValues: [...column.sampleValues] })),
    rows: source.rows.map((row) => ({ ...row })),
    warnings: [...source.warnings],
  }
  const executions: TransformationStepExecution[] = []
  const warnings: string[] = []

  for (const step of steps) {
    const rowsBefore = dataset.rowCount
    if (!step.enabled) {
      executions.push({
        stepId: step.id, type: step.type, skipped: true,
        rowsBefore, rowsAfter: rowsBefore, changedCells: 0, warnings: [],
      })
      continue
    }
    try {
      const result = applyStep(dataset, step)
      dataset = result.dataset
      warnings.push(...result.warnings)
      executions.push({
        stepId: step.id, type: step.type, skipped: false,
        rowsBefore, rowsAfter: dataset.rowCount,
        changedCells: result.changedCells, warnings: result.warnings,
      })
    } catch (error) {
      if (error instanceof TransformationError) throw error
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan transformasi.'
      throw new TransformationError(step.id, message)
    }
  }
  return { dataset, executions, warnings }
}

export function createTransformationHistory(): TransformationHistory {
  return { steps: [], cursor: 0 }
}

export function appendTransformationStep(
  history: TransformationHistory,
  step: TransformationStep,
): TransformationHistory {
  return { steps: [...history.steps.slice(0, history.cursor), step], cursor: history.cursor + 1 }
}

export function undoTransformation(history: TransformationHistory): TransformationHistory {
  return { ...history, cursor: Math.max(0, history.cursor - 1) }
}

export function redoTransformation(history: TransformationHistory): TransformationHistory {
  return { ...history, cursor: Math.min(history.steps.length, history.cursor + 1) }
}

export function getActiveTransformationSteps(history: TransformationHistory): TransformationStep[] {
  return history.steps.slice(0, history.cursor)
}
