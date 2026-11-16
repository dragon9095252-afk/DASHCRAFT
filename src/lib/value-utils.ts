import type { ColumnType } from '@/domain/dataset.types'

export const BLANK_CATEGORY_LABEL = '(Kosong)'

export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  return false
}

export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    // Hanya angka polos. Format lokal ambigu seperti "1.234,56" dibiarkan sebagai teks.
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!/^\d{4}-\d{2}-\d{2}([T ].*)?$/.test(trimmed)) return null
    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed
  }
  return null
}

export function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return null
}

export function matchesType(value: unknown, type: ColumnType): boolean {
  if (isBlank(value)) return true
  switch (type) {
    case 'number':
      return toNumber(value) !== null
    case 'date':
      return toDate(value) !== null
    case 'boolean':
      return toBoolean(value) !== null
    case 'text':
      return true
    case 'unknown':
      return true
    default:
      return true
  }
}

export function getCategoryLabel(value: unknown): string {
  if (isBlank(value)) return BLANK_CATEGORY_LABEL
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  return String(value)
}

export function distinctKey(value: unknown): string {
  if (value instanceof Date) return `date:${value.toISOString()}`
  if (value === null || value === undefined) return 'null'
  return `${typeof value}:${String(value)}`
}

export function getDateBucket(date: Date, group: 'day' | 'month' | 'year'): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  if (group === 'year') return String(year)
  if (group === 'month') return `${year}-${month}`
  return `${year}-${month}-${day}`
}
