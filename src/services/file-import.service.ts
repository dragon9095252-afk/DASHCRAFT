import type { WorkBook } from 'xlsx'
import type { Dataset, SourceFileType } from '@/domain/dataset.types'
import { normalizeSheet } from './data-normalizer.service'
import { profileColumns } from './data-profiler.service'

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024
export const MAX_FILE_SIZE_LABEL = '20 MB'
export const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'] as const

type SpreadsheetEngine = typeof import('xlsx')

let enginePromise: Promise<SpreadsheetEngine> | null = null

// SheetJS is ~430 kB and only needed once a file is actually parsed. Keeping it
// out of the static graph leaves the landing page free of spreadsheet code.
function loadEngine(): Promise<SpreadsheetEngine> {
  enginePromise ??= import('xlsx')
  return enginePromise
}

export type ImportErrorCode =
  | 'unsupported-type'
  | 'file-too-large'
  | 'empty-file'
  | 'corrupted-file'
  | 'no-sheets'
  | 'empty-sheet'
  | 'no-rows'

export class ImportError extends Error {
  readonly code: ImportErrorCode

  constructor(code: ImportErrorCode, message: string) {
    super(message)
    this.name = 'ImportError'
    this.code = code
  }
}

function getFileType(fileName: string): SourceFileType | null {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.xlsx')) return 'xlsx'
  if (lower.endsWith('.xls')) return 'xls'
  if (lower.endsWith('.csv')) return 'csv'
  return null
}

export function validateFile(file: File): SourceFileType {
  const fileType = getFileType(file.name)
  if (!fileType) {
    throw new ImportError(
      'unsupported-type',
      'Format file tidak didukung. Gunakan file .xlsx, .xls, atau .csv.',
    )
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ImportError(
      'file-too-large',
      `File terlalu besar. Batas ukuran saat ini ${MAX_FILE_SIZE_LABEL}.`,
    )
  }
  if (file.size === 0) {
    throw new ImportError('empty-file', 'File kosong atau tidak dapat dibaca.')
  }
  return fileType
}

export async function parseWorkbook(file: File): Promise<WorkBook> {
  const buffer = await file.arrayBuffer()
  if (buffer.byteLength === 0) {
    throw new ImportError('empty-file', 'File kosong atau tidak dapat dibaca.')
  }

  const XLSX = await loadEngine()
  let workbook: WorkBook
  try {
    // SheetJS guesses CSV cell types with US locale and Excel formula rules, which
    // turns "1.234" into 1.234, "03/01/2026" into 1 March, and "=1+1" into a
    // valueless formula. Keep CSV cells as text so the Indonesian-aware profiler
    // decides the type. XLSX/XLS already carry real cell types and ignore this.
    workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: true,
      raw: getFileType(file.name) === 'csv',
    })
  } catch {
    throw new ImportError(
      'corrupted-file',
      'File tidak dapat dibaca. Pastikan file tidak rusak dan formatnya benar.',
    )
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new ImportError('no-sheets', 'Workbook tidak memiliki worksheet.')
  }
  return workbook
}

export function listSheets(workbook: WorkBook): string[] {
  return [...workbook.SheetNames]
}

export async function readSheetRows(workbook: WorkBook, sheetName: string): Promise<unknown[][]> {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new ImportError('empty-sheet', `Worksheet "${sheetName}" tidak ditemukan.`)
  }
  const XLSX = await loadEngine()
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  })
  return rows as unknown[][]
}

export interface BuildDatasetInput {
  workbook: WorkBook
  fileName: string
  fileType: SourceFileType
  sheetName?: string
  datasetId?: string
  datasetName?: string
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}

export async function buildDataset(input: BuildDatasetInput): Promise<Dataset> {
  const activeSheetName = input.sheetName ?? input.workbook.SheetNames[0]
  if (!activeSheetName) {
    throw new ImportError('no-sheets', 'Workbook tidak memiliki worksheet.')
  }

  const rawRows = await readSheetRows(input.workbook, activeSheetName)
  const normalized = normalizeSheet(rawRows)

  if (normalized.rows.length === 0) {
    throw new ImportError(
      'no-rows',
      `Worksheet "${activeSheetName}" tidak memiliki baris data yang dapat diolah.`,
    )
  }

  const columns = profileColumns(normalized.headers, normalized.rows)
  const now = new Date().toISOString()
  const sheetLabel = input.fileType === 'csv' ? null : activeSheetName
  const datasetName =
    input.datasetName ??
    (sheetLabel ? `${baseName(input.fileName)} — ${sheetLabel}` : baseName(input.fileName))

  return {
    id: input.datasetId ?? crypto.randomUUID(),
    name: datasetName,
    sourceFileName: input.fileName,
    sourceFileType: input.fileType,
    sourceSheetName: sheetLabel ?? undefined,
    createdAt: now,
    updatedAt: now,
    rowCount: normalized.rows.length,
    columns,
    rows: normalized.rows,
    warnings: normalized.warnings,
  }
}
