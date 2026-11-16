export type PivotAggregation =
  | 'count'
  | 'sum'
  | 'average'
  | 'median'
  | 'min'
  | 'max'
  | 'distinctCount'

export interface PivotFilter {
  columnId: string
  includeValues?: unknown[]
  excludeValues?: unknown[]
}

export interface PivotMeasure {
  aggregation: PivotAggregation
  fieldId?: string
  label?: string
}

export interface PivotConfiguration {
  rowFieldIds: string[]
  columnFieldIds: string[]
  measure: PivotMeasure
  filters?: PivotFilter[]
  showSubtotals?: boolean
  sortAscending?: boolean
}

export interface PivotAxisMember {
  key: string
  values: unknown[]
  labels: string[]
  label: string
}

export interface PivotRow {
  key: string
  path: unknown[]
  labels: string[]
  label: string
  level: number
  kind: 'detail' | 'subtotal' | 'grand-total'
  cells: Record<string, number | null>
  total: number | null
}

export interface PivotResult {
  rowFields: string[]
  columnFields: string[]
  measure: PivotMeasure
  columns: PivotAxisMember[]
  rows: PivotRow[]
  columnTotals: Record<string, number | null>
  grandTotal: number | null
  filteredRowCount: number
}
