import type { Dataset, DatasetColumn } from '@/domain/dataset.types'
import type {
  ChartRecommendation,
  DashboardRecommendation,
  KpiRecommendation,
} from '@/domain/dashboard.types'
import { chooseDateGroup, dimensionScore, numericScore } from './recommendation-scoring'

function buildKpis(numericColumns: DatasetColumn[]): KpiRecommendation[] {
  const kpis: KpiRecommendation[] = [
    {
      title: 'Jumlah Baris',
      reason: 'Menghitung jumlah record pada dataset.',
      metric: 'count',
      numberFormat: 'integer',
    },
  ]

  for (const column of numericColumns.slice(0, 3)) {
    kpis.push({
      title: `Total ${column.displayName}`,
      reason: `Menjumlahkan seluruh nilai ${column.displayName}.`,
      metric: 'sum',
      fieldId: column.id,
      numberFormat: 'default',
    })
  }
  return kpis
}

export function buildRecommendation(dataset: Dataset): DashboardRecommendation {
  const { columns, rows } = dataset
  const numericColumns = columns
    .filter((column) => column.type === 'number')
    .sort((a, b) => numericScore(a) - numericScore(b))

  const primaryNumeric = numericColumns[0]
  const dateColumn = columns.find((column) => column.type === 'date')
  const dimensions = columns
    .filter(
      (column) =>
        (column.type === 'text' || column.type === 'boolean') &&
        column.distinctCount >= 2 &&
        column.distinctCount <= 20,
    )
    .sort((a, b) => dimensionScore(b) - dimensionScore(a))

  const kpis = buildKpis(numericColumns)
  const charts: ChartRecommendation[] = []
  const usedCategories = new Set<string>()

  if (dateColumn && primaryNumeric) {
    const dateGroup = chooseDateGroup(rows, dateColumn)
    charts.push({
      title: `${primaryNumeric.displayName} per ${
        dateGroup === 'day' ? 'Hari' : dateGroup === 'month' ? 'Bulan' : 'Tahun'
      }`,
      reason: 'Tanggal + angka: cocok untuk melihat tren dari waktu ke waktu.',
      chartType: 'line',
      categoryFieldId: dateColumn.id,
      valueFieldId: primaryNumeric.id,
      aggregation: 'sum',
      dateGroup,
      sort: 'ascending',
      limit: 24,
    })
    usedCategories.add(dateColumn.id)
  }

  const primaryDimension = dimensions[0]

  if (primaryDimension && primaryNumeric) {
    charts.push({
      title: `${primaryNumeric.displayName} per ${primaryDimension.displayName}`,
      reason: 'Kategori + angka: membandingkan total nilai antarkategori.',
      chartType: 'bar',
      categoryFieldId: primaryDimension.id,
      valueFieldId: primaryNumeric.id,
      aggregation: 'sum',
      dateGroup: 'month',
      sort: 'descending',
      limit: 10,
    })
    usedCategories.add(primaryDimension.id)
  }

  if (charts.length < 3 && primaryNumeric) {
    const pieCandidate = dimensions.find(
      (column) =>
        !usedCategories.has(column.id) &&
        column.distinctCount >= 2 &&
        column.distinctCount <= 6,
    )

    if (pieCandidate) {
      charts.push({
        title: `Proporsi ${primaryNumeric.displayName} per ${pieCandidate.displayName}`,
        reason: 'Kategori dengan sedikit nilai: cocok untuk melihat proporsi.',
        chartType: 'pie',
        categoryFieldId: pieCandidate.id,
        valueFieldId: primaryNumeric.id,
        aggregation: 'sum',
        dateGroup: 'month',
        sort: 'descending',
        limit: 8,
      })
      usedCategories.add(pieCandidate.id)
    } else {
      const otherDimension = dimensions.find(
        (column) => !usedCategories.has(column.id) && column.distinctCount >= 2,
      )
      if (otherDimension) {
        charts.push({
          title: `Jumlah data per ${otherDimension.displayName}`,
          reason: 'Kategori tanpa angka: menampilkan jumlah data per kategori.',
          chartType: 'bar',
          categoryFieldId: otherDimension.id,
          aggregation: 'count',
          dateGroup: 'month',
          sort: 'descending',
          limit: 10,
        })
        usedCategories.add(otherDimension.id)
      }
    }
  }

  if (charts.length === 0 && primaryDimension) {
    charts.push({
      title: `Jumlah data per ${primaryDimension.displayName}`,
      reason: 'Kategori tanpa kolom angka: menampilkan jumlah data per kategori.',
      chartType: 'bar',
      categoryFieldId: primaryDimension.id,
      aggregation: 'count',
      dateGroup: 'month',
      sort: 'descending',
      limit: 10,
    })
  }

  let note: string | undefined
  if (charts.length === 0) {
    const fallbackColumn = columns[0]
    if (fallbackColumn) {
      charts.push({
        title: 'Tabel Data',
        reason:
          'Belum ada kombinasi tanggal/angka/kategori yang ideal. Data ditampilkan sebagai tabel.',
        chartType: 'table',
        categoryFieldId: fallbackColumn.id,
        aggregation: 'count',
        dateGroup: 'month',
        sort: 'none',
        limit: 50,
      })
    }
    note = 'Sistem belum menemukan kombinasi grafik yang sesuai untuk dataset ini.'
  }

  return { kpis, charts, note }
}
