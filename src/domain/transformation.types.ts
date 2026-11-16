import type { ColumnType, Dataset } from './dataset.types'

export type ComparisonOperator =
  | 'equals'
  | 'not-equals'
  | 'contains'
  | 'not-contains'
  | 'greater-than'
  | 'greater-or-equal'
  | 'less-than'
  | 'less-or-equal'
  | 'is-empty'
  | 'is-not-empty'

export type FillStrategy = 'value' | 'mean' | 'median' | 'mode' | 'forward' | 'backward'

interface StepBase {
  id: string
  enabled: boolean
}

export type TransformationStep =
  | (StepBase & { type: 'rename-column'; columnId: string; newName: string })
  | (StepBase & { type: 'remove-columns'; columnIds: string[] })
  | (StepBase & { type: 'trim-whitespace'; columnIds: string[]; collapseInternalWhitespace?: boolean })
  | (StepBase & { type: 'fill-missing'; columnIds: string[]; strategy: FillStrategy; value?: unknown })
  | (StepBase & { type: 'change-column-type'; columnId: string; targetType: Exclude<ColumnType, 'unknown'> })
  | (StepBase & { type: 'filter-rows'; columnId: string; operator: ComparisonOperator; value?: unknown })
  | (StepBase & {
      type: 'split-column'
      columnId: string
      delimiter: string
      newColumnIds: [string, string]
      newColumnNames: [string, string]
      keepOriginal: boolean
    })
  | (StepBase & {
      type: 'merge-columns'
      columnIds: string[]
      newColumnId: string
      newColumnName: string
      separator: string
      keepOriginal: boolean
    })

export interface TransformationStepExecution {
  stepId: string
  type: TransformationStep['type']
  skipped: boolean
  rowsBefore: number
  rowsAfter: number
  changedCells: number
  warnings: string[]
}

export interface TransformationExecutionResult {
  dataset: Dataset
  executions: TransformationStepExecution[]
  warnings: string[]
}

export interface TransformationHistory {
  steps: TransformationStep[]
  cursor: number
}
