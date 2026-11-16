import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import type { Dataset } from '@/domain/dataset.types'
import { getDateBucket, toDate, toNumber } from '@/lib/value-utils'
import { formatCellValue } from '@/lib/formatters'
import { aggregateSeries, computeMetric } from '@/services/aggregation.service'
import { buildDataset, parseWorkbook } from '@/services/file-import.service'

async function importCsv(text: string, fileName = 'probe.csv'): Promise<Dataset> {
  const file = new File([text], fileName, { type: 'text/csv' })
  const workbook = await parseWorkbook(file)
  return buildDataset({ workbook, fileName, fileType: 'csv' })
}

describe('CSV import keeps formula-like text', () => {
  it('does not drop cells that start with an equals sign', async () => {
    const dataset = await importCsv('Nama,Nilai\n=1+1,10\n+SUM(A1:A2),20\n@import("x"),30\n')

    expect(dataset.rows.map((row) => row.col_0)).toEqual(['=1+1', '+SUM(A1:A2)', '@import("x")'])
    expect(dataset.columns[0].nullCount).toBe(0)
  })

  it('keeps leading whitespace and embedded newlines intact', async () => {
    const dataset = await importCsv('Nama\n"  =cmd|\' /C calc\'!A0"\n"baris\ndua"\n')

    expect(dataset.rows[0].col_0).toBe("  =cmd|' /C calc'!A0")
    expect(dataset.rows[1].col_0).toBe('baris\ndua')
  })
})

describe('CSV import recognises Indonesian numbers', () => {
  const CSV = [
    'Item,Amount',
    'A,1.234',
    'B,2.500',
    'C,10.000',
    'D,37.500.000',
    'E,"1,234,567.89"',
    'F,Rp 1.500.000',
    'G,(2.500)',
    '',
  ].join('\n')

  it('infers the amount column as numeric', async () => {
    const dataset = await importCsv(CSV)
    expect(dataset.columns[1].type).toBe('number')
  })

  it('parses single-dot thousands separators as thousands, not decimals', async () => {
    const dataset = await importCsv(CSV)
    const parsed = dataset.rows.map((row) => toNumber(row.col_1))

    expect(parsed).toEqual([1234, 2500, 10000, 37500000, 1234567.89, 1500000, -2500])
  })

  it('sums the column without thousand-fold scaling errors', async () => {
    const dataset = await importCsv(CSV)
    const total = computeMetric(dataset.rows, 'sum', dataset.columns[1])

    expect(total).toBe(1234 + 2500 + 10000 + 37500000 + 1234567.89 + 1500000 - 2500)
  })

  it('still reads Indonesian day-first dates', async () => {
    const dataset = await importCsv('Tanggal,Amount\n16/11/2026,1.234\n03/01/2026,2.500\n')

    expect(dataset.columns[0].type).toBe('date')
    const parsed = toDate(dataset.rows[0].col_0)
    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(10)
    expect(parsed?.getDate()).toBe(16)
  })

  it('groups a monthly series from Indonesian dates and amounts', async () => {
    const dataset = await importCsv('Tanggal,Amount\n03/01/2026,1.234\n15/01/2026,2.500\n')
    const result = aggregateSeries(dataset.rows, {
      categoryField: dataset.columns[0],
      valueField: dataset.columns[1],
      aggregation: 'sum',
      dateGroup: 'month',
      sort: 'ascending',
    })

    expect(result.points).toHaveLength(1)
    expect(result.points[0].value).toBe(3734)
  })
})

describe('preview formatting follows the inferred column type', () => {
  it('renders Indonesian source text as a readable number and date', () => {
    expect(formatCellValue('37500000', 'number')).toBe('37.500.000')
    expect(formatCellValue('1.234', 'number')).toBe('1.234')
    expect(formatCellValue('2026-01-03', 'date')).toBe('03/01/2026')
    expect(formatCellValue('16/11/2026', 'date')).toBe('16/11/2026')
  })

  it('leaves text columns as the original source text', () => {
    expect(formatCellValue('1.234', 'text')).toBe('1.234')
    expect(formatCellValue('=1+1', 'text')).toBe('=1+1')
  })
})

describe('XLSX import keeps native cell types', () => {
  it('leaves real numbers and dates typed by Excel untouched', async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Amount', 'Tanggal', 'Kode'],
      [1234.5, new Date(2026, 10, 16), '00123'],
      [0.25, new Date(2026, 0, 3), '00456'],
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Data')
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx', cellDates: true })
    const file = new File([buffer], 'native.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const parsed = await parseWorkbook(file)
    const dataset = await buildDataset({ workbook: parsed, fileName: file.name, fileType: 'xlsx' })

    expect(dataset.rows[0].col_0).toBe(1234.5)
    expect(dataset.rows[1].col_0).toBe(0.25)
    expect(dataset.rows[0].col_1).toBeInstanceOf(Date)
    expect(dataset.rows[0].col_2).toBe('00123')
    expect(dataset.columns[0].type).toBe('number')
    expect(dataset.columns[1].type).toBe('date')
  })

  it('preserves the exact instant of Excel date cells across timezones', async () => {
    const source = [new Date(2026, 10, 16), new Date(2026, 0, 1), new Date(2026, 11, 31)]
    const sheet = XLSX.utils.aoa_to_sheet([['Tanggal'], ...source.map((date) => [date])])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Data')
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx', cellDates: true })
    const file = new File([buffer], 'dates.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const parsed = await parseWorkbook(file)
    const dataset = await buildDataset({ workbook: parsed, fileName: file.name, fileType: 'xlsx' })

    // SheetJS >=0.20 stores date cells as UTC and relies on sheet_to_json to map
    // them back to local wall-clock time. Losing that step shifts the day by the
    // runner's offset, so compare instants rather than calendar fields.
    const imported = dataset.rows.map((row) => row.col_0 as Date)
    expect(imported.map((date) => date.getTime())).toEqual(source.map((date) => date.getTime()))
    expect(imported.map((date) => getDateBucket(date, 'day'))).toEqual([
      '2026-11-16',
      '2026-01-01',
      '2026-12-31',
    ])
  })
})