import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Dataset, DatasetColumn } from '@/domain/dataset.types'
import type { ActiveFilterState } from '@/domain/filter.types'
import { aggregateSeries, computeMetric } from '@/services/aggregation.service'
import { normalizeSheet } from '@/services/data-normalizer.service'
import { buildDataset, parseWorkbook } from '@/services/file-import.service'
import {
  applyFilters,
  countActiveFilters,
  deriveFilterConfigs,
} from '@/services/filter.service'
import { buildRecommendation } from '@/services/recommendation.service'

const CSV_PATH = path.resolve(import.meta.dirname, '../public/sample-data/sales_sample.csv')

let dataset: Dataset

function column(name: string): DatasetColumn {
  const found = dataset.columns.find((item) => item.displayName === name)
  if (!found) throw new Error(`Kolom "${name}" tidak ditemukan`)
  return found
}

function toMap(points: Array<{ key: string; label: string; value: number }>) {
  return Object.fromEntries(points.map((point) => [point.key, point.value])) as Record<
    string,
    number
  >
}

beforeAll(async () => {
  const buffer = await readFile(CSV_PATH)
  const file = new File([buffer], 'sales_sample.csv', { type: 'text/csv' })
  const workbook = await parseWorkbook(file)
  dataset = buildDataset({
    workbook,
    fileName: file.name,
    fileType: 'csv',
    datasetId: 'sample-dataset',
  })
})

describe('impor dan profiling data contoh', () => {
  it('membaca 36 baris dan 9 kolom tanpa mengubah nilai', () => {
    expect(dataset.rowCount).toBe(36)
    expect(dataset.columns).toHaveLength(9)
    expect(dataset.warnings).toHaveLength(0)
    expect(dataset.sourceFileName).toBe('sales_sample.csv')
  })

  it('mendeteksi tipe kolom dengan benar', () => {
    expect(column('Tanggal').type).toBe('date')
    expect(column('Quantity').type).toBe('number')
    expect(column('Revenue').type).toBe('number')
    expect(column('Cost').type).toBe('number')
    expect(column('Cabang').type).toBe('text')
    expect(column('No Transaksi').type).toBe('text')
    expect(dataset.rows[0][column('Tanggal').id]).toBeInstanceOf(Date)
  })

  it('menghitung nilai unik kategori sesuai referensi', () => {
    expect(column('Cabang').distinctCount).toBe(4)
    expect(column('Produk').distinctCount).toBe(6)
  })
})

describe('akurasi agregasi', () => {
  it('menghitung total KPI sesuai referensi', () => {
    expect(computeMetric(dataset.rows, 'sum', column('Quantity'))).toBe(170)
    expect(computeMetric(dataset.rows, 'sum', column('Revenue'))).toBe(433_065_000)
    expect(computeMetric(dataset.rows, 'sum', column('Cost'))).toBe(298_540_000)
    expect(computeMetric(dataset.rows, 'count')).toBe(36)
    expect(computeMetric(dataset.rows, 'average', column('Revenue'))).toBeCloseTo(12_029_583.33, 2)
  })

  it('menghitung Revenue per Cabang sesuai referensi', () => {
    const result = aggregateSeries(dataset.rows, {
      categoryField: column('Cabang'),
      valueField: column('Revenue'),
      aggregation: 'sum',
      dateGroup: 'month',
      sort: 'descending',
      limit: 10,
    })

    expect(toMap(result.points)).toEqual({
      Yogyakarta: 261_800_000,
      Bandung: 85_800_000,
      Jakarta: 54_450_000,
      Surabaya: 31_015_000,
    })
    expect(result.points[0].label).toBe('Yogyakarta')
    expect(result.truncated).toBe(false)
  })

  it('menghitung Revenue per Bulan secara kronologis', () => {
    const result = aggregateSeries(dataset.rows, {
      categoryField: column('Tanggal'),
      valueField: column('Revenue'),
      aggregation: 'sum',
      dateGroup: 'month',
      sort: 'ascending',
    })

    expect(result.points.map((point) => point.key)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
    ])
    expect(result.points.map((point) => point.value)).toEqual([
      66_190_000,
      55_805_000,
      54_260_000,
      68_815_000,
      88_120_000,
      99_875_000,
    ])
  })

  it('memotong kategori sesuai batas dan menandai truncation', () => {
    const result = aggregateSeries(dataset.rows, {
      categoryField: column('Produk'),
      valueField: column('Revenue'),
      aggregation: 'sum',
      dateGroup: 'month',
      sort: 'descending',
      limit: 3,
    })

    expect(result.points).toHaveLength(3)
    expect(result.totalGroups).toBe(6)
    expect(result.truncated).toBe(true)
  })
})

describe('rekomendasi dashboard otomatis', () => {
  it('menyusun KPI dan grafik yang dapat dijelaskan', () => {
    const recommendation = buildRecommendation(dataset)

    expect(recommendation.kpis).toHaveLength(4)
    expect(recommendation.kpis[0].metric).toBe('count')
    expect(recommendation.kpis.map((kpi) => kpi.title)).toContain('Total Revenue')
    expect(recommendation.charts).toHaveLength(3)

    const [trend, comparison, proportion] = recommendation.charts
    expect(trend.chartType).toBe('line')
    expect(trend.categoryFieldId).toBe(column('Tanggal').id)
    expect(trend.dateGroup).toBe('month')
    expect(trend.valueFieldId).toBe(column('Revenue').id)

    expect(comparison.chartType).toBe('bar')
    expect(comparison.categoryFieldId).toBe(column('Cabang').id)

    expect(proportion.chartType).toBe('pie')
    expect(proportion.categoryFieldId).toBe(column('Kategori').id)
  })

  it('menurunkan filter kategori yang relevan dan filter tanggal', () => {
    const filters = deriveFilterConfigs(dataset.columns)

    expect(filters.map((filter) => filter.label)).toEqual(['Cabang', 'Kategori', 'Tanggal'])
    expect(filters[2].kind).toBe('dateRange')
  })
})

describe('filter global', () => {
  it('memfilter baris berdasarkan kategori', () => {
    const filters = deriveFilterConfigs(dataset.columns)
    const state: ActiveFilterState = {
      categoryValues: { [column('Cabang').id]: ['Bandung'] },
      dateRanges: {},
    }

    const filtered = applyFilters(dataset.rows, filters, state)

    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.length).toBeLessThan(dataset.rows.length)
    expect(computeMetric(filtered, 'sum', column('Revenue'))).toBe(85_800_000)
    expect(countActiveFilters(state)).toBe(1)
  })

  it('memfilter baris berdasarkan rentang tanggal inklusif', () => {
    const filters = deriveFilterConfigs(dataset.columns)
    const state: ActiveFilterState = {
      categoryValues: {},
      dateRanges: { [column('Tanggal').id]: { start: '2026-05-01', end: '2026-05-31' } },
    }

    const filtered = applyFilters(dataset.rows, filters, state)

    expect(computeMetric(filtered, 'sum', column('Revenue'))).toBe(88_120_000)
    expect(countActiveFilters(state)).toBe(1)
  })

  it('menggabungkan filter kategori dan tanggal', () => {
    const filters = deriveFilterConfigs(dataset.columns)
    const state: ActiveFilterState = {
      categoryValues: { [column('Cabang').id]: ['Bandung'] },
      dateRanges: { [column('Tanggal').id]: { start: '2026-06-01', end: '2026-06-30' } },
    }

    const filtered = applyFilters(dataset.rows, filters, state)

    expect(countActiveFilters(state)).toBe(2)
    expect(filtered.every((row) => row[column('Cabang').id] === 'Bandung')).toBe(true)
    expect(computeMetric(filtered, 'sum', column('Revenue'))).toBe(3_600_000)
  })
})

describe('normalisasi sheet', () => {
  it('membersihkan BOM, header kosong, dan header duplikat', () => {
    const result = normalizeSheet([
      ['\uFEFFNama', 'Nama', ''],
      ['Andi', 'Budi', 'Citra'],
      [null, null, null],
    ])

    expect(result.headers.map((header) => header.displayName)).toEqual([
      'Nama',
      'Nama (2)',
      'Kolom 3',
    ])
    expect(result.rows).toHaveLength(1)
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      'blank-header',
      'duplicate-header',
    ])
  })
})
