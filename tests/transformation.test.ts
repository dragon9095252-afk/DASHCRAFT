import { describe, expect, it } from 'vitest'
import type { Dataset, DatasetColumn } from '@/domain/dataset.types'
import {
  appendTransformationStep,
  applyTransformationSteps,
  createTransformationHistory,
  getActiveTransformationSteps,
  redoTransformation,
  TransformationError,
  undoTransformation,
} from '@/services/transformation.service'
import type { TransformationStep } from '@/domain/transformation.types'

const columns: DatasetColumn[] = [
  { id: 'name', originalName: 'Name', displayName: 'Name', type: 'text', nullCount: 1, distinctCount: 2, sampleValues: ['  Ada  ', 'Lin'], inferenceConfidence: 1, typeMismatchCount: 0 },
  { id: 'amount', originalName: 'Amount', displayName: 'Amount', type: 'number', nullCount: 1, distinctCount: 2, sampleValues: [10, 20], inferenceConfidence: 1, typeMismatchCount: 0 },
]

function fixture(): Dataset {
  return {
    id: 'ds-1', name: 'Sample', sourceFileName: 'sample.csv', sourceFileType: 'csv',
    createdAt: '2026-11-16T00:00:00.000Z', updatedAt: '2026-11-16T00:00:00.000Z',
    rowCount: 3, columns: columns.map((column) => ({ ...column, sampleValues: [...column.sampleValues] })),
    rows: [
      { name: '  Ada  ', amount: 10 },
      { name: null, amount: null },
      { name: 'Lin', amount: 20 },
    ],
    warnings: [],
  }
}

type StepDraft = TransformationStep extends infer Step
  ? Step extends TransformationStep ? Omit<Step, 'enabled'> : never
  : never

function step(value: StepDraft): TransformationStep {
  return { ...value, enabled: true } as TransformationStep
}

describe('transformation pipeline', () => {
  it('does not mutate the source and applies enabled steps in order', () => {
    const source = fixture()
    const result = applyTransformationSteps(source, [
      step({ id: 'trim', type: 'trim-whitespace', columnIds: ['name'] }),
      step({ id: 'fill', type: 'fill-missing', columnIds: ['amount'], strategy: 'mean' }),
      step({ id: 'rename', type: 'rename-column', columnId: 'amount', newName: 'Net Amount' }),
    ])
    expect(source.rows[0].name).toBe('  Ada  ')
    expect(source.rows[1].amount).toBeNull()
    expect(result.dataset.rows[0].name).toBe('Ada')
    expect(result.dataset.rows[1].amount).toBe(15)
    expect(result.dataset.columns.find((column) => column.id === 'amount')?.displayName).toBe('Net Amount')
    expect(result.executions.map((item) => item.stepId)).toEqual(['trim', 'fill', 'rename'])
    expect(result.executions.map((item) => item.skipped)).toEqual([false, false, false])
  })

  it('keeps invalid type values and records a warning', () => {
    const source = fixture()
    source.rows[0].amount = 'bad'
    const result = applyTransformationSteps(source, [
      step({ id: 'type', type: 'change-column-type', columnId: 'amount', targetType: 'number' }),
    ])
    expect(result.dataset.rows[0].amount).toBe('bad')
    expect(result.dataset.columns.find((column) => column.id === 'amount')?.typeMismatchCount).toBe(1)
    expect(result.warnings[0]).toContain('1 nilai tidak cocok')
  })

  it('filters, splits, merges, and removes without mutating the source', () => {
    const source = fixture()
    const result = applyTransformationSteps(source, [
      step({ id: 'trim', type: 'trim-whitespace', columnIds: ['name'] }),
      step({ id: 'filter', type: 'filter-rows', columnId: 'amount', operator: 'greater-or-equal', value: 10 }),
      step({ id: 'split', type: 'split-column', columnId: 'name', delimiter: ' ', newColumnIds: ['first', 'last'], newColumnNames: ['First', 'Last'], keepOriginal: true }),
      step({ id: 'merge', type: 'merge-columns', columnIds: ['first', 'last'], newColumnId: 'full', newColumnName: 'Full Name', separator: ' ', keepOriginal: false }),
      step({ id: 'remove', type: 'remove-columns', columnIds: ['name'] }),
    ])
    expect(result.dataset.rowCount).toBe(2)
    expect(result.dataset.columns.map((column) => column.id)).toEqual(['amount', 'full'])
    expect(source.rows).toHaveLength(3)
  })

  it('throws a typed error for an invalid step', () => {
    expect(() => applyTransformationSteps(fixture(), [
      step({ id: 'bad', type: 'rename-column', columnId: 'missing', newName: 'New' }),
    ])).toThrow(TransformationError)
  })

  it('skips disabled steps and correctly reports the row count after filtering', () => {
    const result = applyTransformationSteps(fixture(), [
      { id: 'disabled', enabled: false, type: 'remove-columns', columnIds: ['name'] },
      step({ id: 'filter', type: 'filter-rows', columnId: 'amount', operator: 'greater-than', value: 10 }),
    ])
    expect(result.executions[0].skipped).toBe(true)
    expect(result.dataset.rowCount).toBe(1)
    expect(result.dataset.rows[0].name).toBe('Lin')
  })
})

describe('transformation history', () => {
  it('supports undo, redo, and truncates the redo branch after a new step', () => {
    const one = step({ id: 'one', type: 'trim-whitespace', columnIds: ['name'] })
    const two = step({ id: 'two', type: 'remove-columns', columnIds: ['amount'] })
    const three = step({ id: 'three', type: 'rename-column', columnId: 'name', newName: 'Customer' })
    let history = createTransformationHistory()
    history = appendTransformationStep(history, one)
    history = appendTransformationStep(history, two)
    history = undoTransformation(history)
    expect(getActiveTransformationSteps(history).map((item) => item.id)).toEqual(['one'])
    history = redoTransformation(history)
    expect(getActiveTransformationSteps(history).map((item) => item.id)).toEqual(['one', 'two'])
    history = undoTransformation(history)
    history = appendTransformationStep(history, three)
    expect(history.steps.map((item) => item.id)).toEqual(['one', 'three'])
  })
})
