export type ColumnType = 'text' | 'number' | 'date' | 'boolean' | 'unknown'

export type Aggregation =
  | 'count'
  | 'sum'
  | 'average'
  | 'min'
  | 'max'
  | 'distinctCount'

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'table'

export type DateGroup = 'day' | 'month' | 'year'

export type SourceFileType = 'xlsx' | 'xls' | 'csv'

export interface DatasetColumn {
  id: string
  originalName: string
  displayName: string
  type: ColumnType
  nullCount: number
  distinctCount: number
  sampleValues: unknown[]
  inferenceConfidence: number
  /** Values that do not match the currently selected type. Never removed from the dataset. */
  typeMismatchCount: number
}

export type DatasetRow = Record<string, unknown>

export interface DatasetWarning {
  code: string
  message: string
  affectedCount?: number
  severity: 'info' | 'warning' | 'error'
}

export interface Dataset {
  id: string
  name: string
  sourceFileName: string
  sourceFileType: SourceFileType
  sourceSheetName?: string
  createdAt: string
  updatedAt: string
  rowCount: number
  columns: DatasetColumn[]
  rows: DatasetRow[]
  warnings: DatasetWarning[]
}
