import type { Dataset, DatasetColumn, DateGroup } from '@/domain/dataset.types'
import { toDate } from '@/lib/value-utils'

const NUMERIC_PRIORITY: Array<[RegExp, number]> = [
  [/(revenue|omzet|penjualan|sales|amount|total|pendapatan)/i, 0],
  [/(quantity|qty|jumlah|unit|terjual)/i, 1],
  [/(profit|laba|margin)/i, 2],
  [/(cost|biaya|expense|harga|price)/i, 3],
]

export function numericScore(column: DatasetColumn): number {
  for (const [pattern, score] of NUMERIC_PRIORITY) {
    if (pattern.test(column.displayName)) return score
  }
  return 10
}

export function dimensionScore(column: DatasetColumn): number {
  const name = column.displayName.toLowerCase()
  let score = 0
  if (/(cabang|branch|wilayah|region|area|kota|city|daerah)/.test(name)) score += 40
  if (/(kategori|category|segmen|segment|tipe|type|grup|group)/.test(name)) score += 30
  if (/(salesperson|sales|petugas|agent|karyawan|staff)/.test(name)) score += 20
  if (/(produk|product|item|barang)/.test(name)) score += 10
  if (column.distinctCount >= 2 && column.distinctCount <= 8) score += 8
  else if (column.distinctCount <= 12) score += 4
  if (/(^|\s)(id|no\.?|nomor|kode|code)(\s|$)/.test(name)) score -= 50
  return score
}

export function chooseDateGroup(
  rows: Dataset['rows'],
  column: DatasetColumn,
): DateGroup {
  let min: Date | null = null
  let max: Date | null = null
  for (const row of rows) {
    const date = toDate(row[column.id])
    if (!date) continue
    if (!min || date < min) min = date
    if (!max || date > max) max = date
  }
  if (!min || !max) return 'month'
  const spanDays = (max.getTime() - min.getTime()) / 86_400_000
  if (spanDays <= 31) return 'day'
  if (spanDays <= 730) return 'month'
  return 'year'
}
