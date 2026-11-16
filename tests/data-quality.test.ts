import { describe, expect, it } from 'vitest'
import { matchesType, toDate, toNumber } from '@/lib/value-utils'

describe('Indonesian spreadsheet value parsing', () => {
  it.each([
    ['1.234', 1234],
    ['1.234.567', 1234567],
    ['1.234,56', 1234.56],
    ['12.345,6', 12345.6],
    ['Rp 1.500.000', 1500000],
    ['IDR 1.500.000,75', 1500000.75],
    ['(Rp 1.250,50)', -1250.5],
    ['1,234.56', 1234.56],
    ['1,234,567.89', 1234567.89],
    ['  -250,75  ', -250.75],
  ])('parses %s as %s', (input, expected) => {
    expect(toNumber(input)).toBe(expected)
  })

  it.each(['', 'Rp', '1.23.4', '12,34,56', '1.234,56abc', 'NaN'])(
    'rejects invalid numeric input %s',
    (input) => {
      expect(toNumber(input)).toBeNull()
    },
  )

  it.each([
    ['16/11/2026', 2026, 10, 16],
    ['16-11-2026', 2026, 10, 16],
    ['2026-11-16', 2026, 10, 16],
    ['16 Nov 2026', 2026, 10, 16],
    ['16 November 2026', 2026, 10, 16],
    ['Nov 16, 2026', 2026, 10, 16],
  ])('parses %s as a valid date', (input, year, month, day) => {
    const result = toDate(input)
    expect(result).not.toBeNull()
    expect(result?.getFullYear()).toBe(year)
    expect(result?.getMonth()).toBe(month)
    expect(result?.getDate()).toBe(day)
  })

  it.each(['31/02/2026', '2026-02-30', 'not a date', '32/13/2026'])(
    'rejects invalid date %s',
    (input) => {
      expect(toDate(input)).toBeNull()
    },
  )

  it('uses the same parsing rules for column mismatch checks', () => {
    expect(matchesType('Rp 10.000,50', 'number')).toBe(true)
    expect(matchesType('16/11/2026', 'date')).toBe(true)
    expect(matchesType('not a date', 'date')).toBe(false)
  })
})
