import type { DatasetRow, DatasetWarning } from '@/domain/dataset.types'
import { isBlank } from '@/lib/value-utils'

export interface NormalizedHeader {
  id: string
  originalName: string
  displayName: string
}

export interface NormalizeResult {
  headers: NormalizedHeader[]
  rows: DatasetRow[]
  warnings: DatasetWarning[]
}

function sanitizeHeader(raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  if (raw instanceof Date) return raw.toISOString()
  return String(raw).replace(/^\uFEFF/, '').trim()
}

function normalizeCell(value: unknown): unknown {
  if (isBlank(value)) return null
  return value
}

function isBlankRow(row: unknown[]): boolean {
  return row.every((cell) => isBlank(cell))
}

export function normalizeSheet(rawRows: unknown[][]): NormalizeResult {
  const warnings: DatasetWarning[] = []
  const nonBlankRows = rawRows.filter((row) => Array.isArray(row) && !isBlankRow(row))

  if (nonBlankRows.length === 0) {
    return {
      headers: [],
      rows: [],
      warnings: [
        {
          code: 'empty-sheet',
          message: 'Worksheet tidak berisi data yang dapat dibaca.',
          severity: 'error',
        },
      ],
    }
  }

  const headerRow = nonBlankRows[0]
  const dataRows = nonBlankRows.slice(1)
  let width = headerRow.length
  for (const row of dataRows) {
    if (row.length > width) width = row.length
  }

  const usedNames = new Map<string, number>()
  const headers: NormalizedHeader[] = []
  let blankHeaderCount = 0
  let duplicateHeaderCount = 0

  for (let index = 0; index < width; index += 1) {
    const headerText = sanitizeHeader(headerRow[index])
    if (!headerText) blankHeaderCount += 1
    const baseName = headerText || `Kolom ${index + 1}`
    const key = baseName.toLowerCase()
    const occurrence = (usedNames.get(key) ?? 0) + 1
    usedNames.set(key, occurrence)
    if (occurrence > 1) duplicateHeaderCount += 1
    headers.push({
      id: `col_${index}`,
      originalName: headerText,
      displayName: occurrence > 1 ? `${baseName} (${occurrence})` : baseName,
    })
  }

  const rows: DatasetRow[] = dataRows.map((row) => {
    const record: DatasetRow = {}
    headers.forEach((header, index) => {
      record[header.id] = normalizeCell(row[index])
    })
    return record
  })

  if (blankHeaderCount > 0) {
    warnings.push({
      code: 'blank-header',
      message: `${blankHeaderCount} kolom tidak memiliki nama header. Nama sementara "Kolom N" digunakan.`,
      affectedCount: blankHeaderCount,
      severity: 'warning',
    })
  }

  if (duplicateHeaderCount > 0) {
    warnings.push({
      code: 'duplicate-header',
      message: `${duplicateHeaderCount} nama kolom duplikat ditemukan dan dibedakan dengan nomor urut.`,
      affectedCount: duplicateHeaderCount,
      severity: 'warning',
    })
  }

  if (rows.length === 0) {
    warnings.push({
      code: 'header-only',
      message: 'File hanya berisi baris header tanpa data.',
      severity: 'error',
    })
  }

  return { headers, rows, warnings }
}
