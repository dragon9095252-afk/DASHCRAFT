import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getCategoryLabel, getDateBucket } from '@/lib/value-utils'

const ORIGINAL_TZ = process.env.TZ

// The bug only appears east of UTC, where toISOString() rolls a local midnight
// back to the previous day. A test run in UTC would pass either way.
describe('date category labels follow the local calendar day', () => {
  beforeEach(() => {
    process.env.TZ = 'Asia/Jakarta'
  })

  afterEach(() => {
    if (ORIGINAL_TZ === undefined) delete process.env.TZ
    else process.env.TZ = ORIGINAL_TZ
  })

  it('does not shift the day behind the local calendar', () => {
    const date = new Date(2026, 10, 16)
    expect(date.getTimezoneOffset()).not.toBe(0)
    expect(getCategoryLabel(date)).toBe('2026-11-16')
  })

  it('agrees with the bucket used for date grouping', () => {
    const date = new Date(2026, 0, 1)
    expect(getCategoryLabel(date)).toBe(getDateBucket(date, 'day'))
    expect(getCategoryLabel(date)).toBe('2026-01-01')
  })

  it('handles the last day of the year', () => {
    expect(getCategoryLabel(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('still labels blank categories', () => {
    expect(getCategoryLabel(null)).toBe('(Kosong)')
    expect(getCategoryLabel('   ')).toBe('(Kosong)')
  })
})