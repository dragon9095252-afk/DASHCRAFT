import type { Aggregation, ChartType } from '@/domain/dataset.types'
import type { NumberFormat } from '@/domain/dashboard.types'

export const NO_COLUMN = '__none__'

export const AGGREGATION_OPTIONS: Aggregation[] = [
  'count',
  'sum',
  'average',
  'min',
  'max',
  'distinctCount',
]

export const CHART_TYPE_OPTIONS: Array<{ value: ChartType; label: string }> = [
  { value: 'bar', label: 'Batang' },
  { value: 'line', label: 'Garis' },
  { value: 'area', label: 'Area' },
  { value: 'pie', label: 'Donut' },
  { value: 'table', label: 'Tabel' },
]

export const NUMBER_FORMAT_OPTIONS: Array<{ value: NumberFormat; label: string }> = [
  { value: 'default', label: 'Default (1.234,56)' },
  { value: 'integer', label: 'Bilangan bulat' },
  { value: 'decimal', label: 'Desimal' },
  { value: 'compact', label: 'Ringkas (1,2 rb)' },
]

export type ChartSort = 'ascending' | 'descending' | 'none'

export const SORT_OPTIONS: Array<{ value: ChartSort; label: string }> = [
  { value: 'descending', label: 'Nilai tertinggi' },
  { value: 'ascending', label: 'Nilai terendah' },
  { value: 'none', label: 'Urutan data' },
]
