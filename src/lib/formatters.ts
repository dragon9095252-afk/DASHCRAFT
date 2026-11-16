import type { ColumnType, DateGroup } from '@/domain/dataset.types'
import type { NumberFormat } from '@/domain/dashboard.types'
import { toDate, toNumber } from '@/lib/value-utils'

const numberFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })
const integerFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
const compactFormatter = new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatNumber(value: number, format: NumberFormat = 'default'): string {
  if (!Number.isFinite(value)) return '–'
  switch (format) {
    case 'integer':
      return integerFormatter.format(value)
    case 'decimal':
      return numberFormatter.format(value)
    case 'compact':
      return compactFormatter.format(value)
    case 'default':
    default:
      return numberFormatter.format(value)
  }
}

export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return '–'
  return compactFormatter.format(value)
}

export function formatDateForGroup(date: Date, group: DateGroup): string {
  if (group === 'year') {
    return new Intl.DateTimeFormat('id-ID', { year: 'numeric' }).format(date)
  }
  if (group === 'month') {
    return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(date)
  }
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatDateValue(value: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value)
}

export function formatCellValue(value: unknown, type?: ColumnType): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return formatDateValue(value)
  if (typeof value === 'number') return numberFormatter.format(value)
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak'
  if (typeof value === 'string') {
    if (type === 'number') {
      const parsed = toNumber(value)
      if (parsed !== null) return numberFormatter.format(parsed)
    }
    if (type === 'date') {
      const parsed = toDate(value)
      if (parsed) return formatDateValue(parsed)
    }
  }
  return String(value)
}

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return '–'
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export type { NumberFormat }
