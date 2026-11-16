import type { ColumnType } from '@/domain/dataset.types'

export const BLANK_CATEGORY_LABEL = '(Kosong)'

const MONTHS: Record<string, number> = {
  jan: 0, januari: 0, january: 0,
  feb: 1, februari: 1, february: 1,
  mar: 2, maret: 2, march: 2,
  apr: 3, april: 3,
  mei: 4, may: 4,
  jun: 5, juni: 5, june: 5,
  jul: 6, juli: 6, july: 6,
  agu: 7, agustus: 7, aug: 7, august: 7,
  sep: 8, september: 8,
  okt: 9, oktober: 9, oct: 9, october: 9,
  nov: 10, november: 10,
  des: 11, desember: 11, dec: 11, december: 11,
}

export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  return false
}

/**
 * Parses plain and common Indonesian/international numeric strings.
 * A single separator followed by exactly three digits is treated as a
 * thousands separator (e.g. "1.234" -> 1234), which is the safer default
 * for Indonesian business spreadsheets.
 */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value !== 'string') return null

  let text = value.trim()
  if (!text) return null

  let negativeByParentheses = false
  if (text.startsWith('(') && text.endsWith(')')) {
    negativeByParentheses = true
    text = text.slice(1, -1).trim()
  } else if (text.includes('(') || text.includes(')')) {
    return null
  }

  text = text
    .replace(/^(?:US\$|Rp\.?|IDR|USD|EUR|SGD|AUD|CAD|[$€£¥])\s*/i, '')
    .replace(/\s*(?:IDR|USD|EUR|SGD|AUD|CAD)$/i, '')
    .replace(/[\s\u00a0\u202f]/g, '')

  let sign = ''
  if (text.startsWith('-') || text.startsWith('+')) {
    sign = text[0] === '-' ? '-' : ''
    text = text.slice(1)
  }
  if (!text || !/^[\d.,]+$/.test(text)) return null

  const lastDot = text.lastIndexOf('.')
  const lastComma = text.lastIndexOf(',')
  let integerPart = text
  let fractionPart = ''

  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSeparator = lastDot > lastComma ? '.' : ','
    const groupingSeparator = decimalSeparator === '.' ? ',' : '.'
    const decimalIndex = text.lastIndexOf(decimalSeparator)
    integerPart = text.slice(0, decimalIndex)
    fractionPart = text.slice(decimalIndex + 1)
    if (!fractionPart || !/^\d+$/.test(fractionPart)) return null
    const groups = integerPart.split(groupingSeparator)
    if (
      groups.some((group) => !/^\d+$/.test(group)) ||
      (groups.length > 1 &&
        (!/^\d{1,3}$/.test(groups[0]) || groups.slice(1).some((group) => group.length !== 3))) ||
      integerPart.includes(decimalSeparator)
    ) return null
    integerPart = groups.join('')
  } else if (lastDot >= 0 || lastComma >= 0) {
    const separator = lastDot >= 0 ? '.' : ','
    const groups = text.split(separator)
    if (groups.some((group) => group.length === 0 || !/^\d+$/.test(group))) return null

    if (groups.length === 2) {
      const [whole, tail] = groups
      if (tail.length === 3 && whole.length >= 1 && whole.length <= 3) {
        integerPart = whole + tail
      } else {
        integerPart = whole
        fractionPart = tail
      }
    } else if (
      /^\d{1,3}$/.test(groups[0]) &&
      groups.slice(1).every((group) => group.length === 3)
    ) {
      integerPart = groups.join('')
    } else {
      return null
    }
  }

  if (!/^\d+$/.test(integerPart)) return null
  const normalized = sign + integerPart + (fractionPart ? '.' + fractionPart : '')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return negativeByParentheses ? -Math.abs(parsed) : parsed
}

function makeLocalDate(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  const date = new Date(0)
  date.setHours(0, 0, 0, 0)
  date.setFullYear(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return null
  return date
}

export function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/)
  if (iso) {
    const [, year, month, day] = iso
    const dateOnly = makeLocalDate(Number(year), Number(month), Number(day))
    if (!dateOnly) return null
    if (trimmed.length === 10) return dateOnly
    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  // Indonesian day-first formats: 16/11/2026 and 16-11-2026.
  const numeric = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (numeric) {
    const [, day, month, year] = numeric
    return makeLocalDate(Number(year), Number(month), Number(day))
  }

  // Indonesian and English month names: 16 Nov 2026, 16 November 2026.
  const dayFirstMonth = trimmed.match(/^(\d{1,2})[\s/-]+([a-zA-Z]+)\.?[\s,-]+(\d{4})$/)
  if (dayFirstMonth) {
    const [, day, monthName, year] = dayFirstMonth
    const month = MONTHS[monthName.toLowerCase()]
    return month === undefined ? null : makeLocalDate(Number(year), month + 1, Number(day))
  }

  // English month-first format: Nov 16, 2026.
  const monthFirst = trimmed.match(/^([a-zA-Z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/)
  if (monthFirst) {
    const [, monthName, day, year] = monthFirst
    const month = MONTHS[monthName.toLowerCase()]
    return month === undefined ? null : makeLocalDate(Number(year), month + 1, Number(day))
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
  if (value instanceof Date) return 'date:' + value.toISOString()
  if (value === null || value === undefined) return 'null'
  return typeof value + ':' + String(value)
}

export function getDateBucket(date: Date, group: 'day' | 'month' | 'year'): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  if (group === 'year') return String(year)
  if (group === 'month') return String(year) + '-' + month
  return String(year) + '-' + month + '-' + day
}
