import { describe, expect, it } from 'vitest'
import type { DatasetColumn } from '@/domain/dataset.types'
import {
  buildCsv,
  buildExportFileName,
  formatCsvValue,
  sanitizeFileName,
} from '@/services/export.service'

function column(overrides: Partial<DatasetColumn>): DatasetColumn {
  return {
    id: 'col_0',
    originalName: 'Kolom',
    displayName: 'Kolom',
    type: 'text',
    nullCount: 0,
    distinctCount: 1,
    sampleValues: [],
    inferenceConfidence: 1,
    typeMismatchCount: 0,
    ...overrides,
  }
}

const columns: DatasetColumn[] = [
  column({ id: 'col_0', originalName: 'Cabang', displayName: 'Cabang' }),
  column({
    id: 'col_1',
    originalName: 'Rev',
    displayName: 'Pendapatan',
    type: 'number',
  }),
]

describe('CSV export', () => {
  it('memakai displayName, BOM, dan CRLF', () => {
    const csv = buildCsv([{ col_0: 'Bandung', col_1: 1250000.5 }], columns)
    expect(csv).toBe('\\uFEFFCabang,Pendapatan\\r\\nBandung,1250000.5\\r\\n')
  })

  it('meng-escape koma dan kutip sesuai RFC 4180', () => {
    const csv = buildCsv([{ col_0: 'Bandung, Kota', col_1: 'Kata "penting"' }], columns)
    expect(csv).toContain('"Bandung, Kota","Kata ""penting"""')
  })

  it('meng-escape newline', () => {
    const csv = buildCsv([{ col_0: 'Baris 1\\nBaris 2', col_1: null }], columns)
    expect(csv).toContain('"Baris 1\\nBaris 2",')
  })

  it('memformat nilai kosong, tanggal, dan boolean', () => {
    expect(formatCsvValue(null)).toBe('')
    expect(formatCsvValue(undefined)).toBe('')
    expect(formatCsvValue('')).toBe('')
    expect(formatCsvValue(new Date(2026, 0, 3))).toBe('2026-01-03')
    expect(formatCsvValue(true)).toBe('true')
    expect(formatCsvValue(false)).toBe('false')
    expect(formatCsvValue('2026-01-03')).toBe('2026-01-03')
  })

  it('tidak menambahkan pemisah ribuan pada angka', () => {
    const csv = buildCsv([{ col_0: 'A', col_1: 1234.56 }], columns)
    expect(csv).toContain(',1234.56')
    expect(csv).not.toContain('1.234,56')
  })

  it('menetralisir formula spreadsheet dalam nilai teks', () => {
    const csv = buildCsv(
      [{ col_0: '=1+1', col_1: '@SUM(A1:A2)' }],
      columns,
    )
    expect(csv).toContain("'=1+1")
    expect(csv).toContain("'@SUM(A1:A2)")
  })

  it('melindungi formula yang didahului spasi atau tab', () => {
    const csv = buildCsv([{ col_0: '\t=HYPERLINK(\"https://example.com\")', col_1: null }], columns)
    expect(csv).toContain(\"'\t=HYPERLINK\")
  })

  it('tetap mengekspor angka negatif sebagai angka, bukan formula teks', () => {
    const csv = buildCsv([{ col_0: 'A', col_1: -123.45 }], columns)
    expect(csv).toContain(',-123.45')
  })

  it('melindungi header yang diawali karakter formula', () => {
    const formulaHeader = [column({ id: 'formula', displayName: '=1+1' })]
    expect(buildCsv([{ formula: 'safe' }], formulaHeader)).toContain("'=1+1")
  })
})

describe('export file names', () => {
  it('mengganti karakter tidak aman dan menambah tanggal', () => {
    expect(
      buildExportFileName('Penjualan/Q1: "A"', 'png', new Date(2026, 0, 3)),
    ).toBe('Penjualan-Q1-A-20260103.png')
  })

  it('memakai fallback dashboard untuk nama kosong', () => {
    expect(sanitizeFileName('   ')).toBe('dashboard')
  })
})
