import { describe, expect, it } from 'vitest'
import type { Dataset, DatasetColumn } from '@/domain/dataset.types'
import type { ChartWidgetConfig, DashboardWidget, KpiWidgetConfig } from '@/domain/dashboard.types'
import {
  createDashboardFromDataset,
  createDefaultChartWidget,
  createDefaultKpiWidget,
  duplicateDashboardWidget,
  moveDashboardWidget,
  reindexWidgets,
} from '@/state/dashboard-widgets'

function column(overrides: Partial<DatasetColumn>): DatasetColumn {
  return {
    id: 'col_0',
    originalName: 'Kolom',
    displayName: 'Kolom',
    type: 'text',
    nullCount: 0,
    distinctCount: 3,
    sampleValues: [],
    inferenceConfidence: 1,
    typeMismatchCount: 0,
    ...overrides,
  }
}

const branchColumn = column({ id: 'col_1', displayName: 'Cabang', type: 'text' })
const revenueColumn = column({
  id: 'col_2',
  displayName: 'Revenue',
  type: 'number',
  distinctCount: 3,
})

function kpi(id: string, order: number, title: string): KpiWidgetConfig {
  return {
    id,
    kind: 'kpi',
    title,
    visible: true,
    order,
    metric: 'count',
    numberFormat: 'integer',
  }
}

function chart(id: string, order: number, title: string): ChartWidgetConfig {
  return {
    id,
    kind: 'chart',
    title,
    visible: true,
    order,
    chartType: 'bar',
    aggregation: 'count',
    dateGroup: 'month',
    sort: 'descending',
    limit: 10,
  }
}

function dataset(): Dataset {
  return {
    id: 'dataset-1',
    name: 'Penjualan',
    sourceFileName: 'penjualan.csv',
    sourceFileType: 'csv',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    rowCount: 3,
    columns: [branchColumn, revenueColumn],
    rows: [
      { col_1: 'Bandung', col_2: 10 },
      { col_1: 'Jakarta', col_2: 20 },
      { col_1: 'Bandung', col_2: 30 },
    ],
    warnings: [],
  }
}

describe('default widget builders', () => {
  it('memilih kolom angka untuk KPI baru', () => {
    const widget = createDefaultKpiWidget([branchColumn, revenueColumn], 4)
    expect(widget.metric).toBe('sum')
    expect(widget.fieldId).toBe(revenueColumn.id)
    expect(widget.numberFormat).toBe('default')
    expect(widget.order).toBe(4)
  })

  it('jatuh ke metrik count bila tidak ada kolom angka', () => {
    const widget = createDefaultKpiWidget([branchColumn], 0)
    expect(widget.metric).toBe('count')
    expect(widget.fieldId).toBeUndefined()
    expect(widget.numberFormat).toBe('integer')
  })

  it('menyusun grafik batang awal dari kolom teks dan angka', () => {
    const widget = createDefaultChartWidget([branchColumn, revenueColumn], 5)
    expect(widget.chartType).toBe('bar')
    expect(widget.categoryFieldId).toBe(branchColumn.id)
    expect(widget.valueFieldId).toBe(revenueColumn.id)
    expect(widget.aggregation).toBe('sum')
    expect(widget.limit).toBe(10)
  })
})

describe('dashboard helpers', () => {
  it('membuat dashboard lengkap dari rekomendasi', () => {
    const dashboard = createDashboardFromDataset(dataset())

    expect(dashboard.datasetId).toBe('dataset-1')
    expect(dashboard.name).toBe('Dashboard Penjualan')
    expect(dashboard.widgets).toHaveLength(3)
    expect(dashboard.widgets.map((widget) => widget.order)).toEqual([0, 1, 2])
    expect(dashboard.filters).toHaveLength(1)
    expect(dashboard.filters[0].label).toBe('Cabang')
  })

  it('menomori ulang widget secara berurutan', () => {
    const widgets = reindexWidgets([kpi('a', 9, 'A'), chart('b', 4, 'B')])
    expect(widgets.map((widget) => widget.order)).toEqual([0, 1])
  })

  it('memindahkan widget hanya di antara jenis yang sama', () => {
    const widgets: DashboardWidget[] = [
      kpi('k1', 0, 'KPI 1'),
      kpi('k2', 1, 'KPI 2'),
      chart('c1', 2, 'Grafik 1'),
      chart('c2', 3, 'Grafik 2'),
    ]

    const movedUp = moveDashboardWidget(widgets, 'k2', 'up')
    expect(movedUp.map((widget) => [widget.id, widget.order])).toEqual([
      ['k1', 1],
      ['k2', 0],
      ['c1', 2],
      ['c2', 3],
    ])

    const movedChartDown = moveDashboardWidget(widgets, 'c1', 'down')
    expect(movedChartDown.map((widget) => [widget.id, widget.order])).toEqual([
      ['k1', 0],
      ['k2', 1],
      ['c1', 3],
      ['c2', 2],
    ])
  })

  it('tidak mengubah apa pun saat bergerak melewati batas', () => {
    const widgets: DashboardWidget[] = [kpi('k1', 0, 'KPI 1'), kpi('k2', 1, 'KPI 2')]
    expect(moveDashboardWidget(widgets, 'k1', 'up')).toBe(widgets)
    expect(moveDashboardWidget(widgets, 'k2', 'down')).toBe(widgets)
    expect(moveDashboardWidget(widgets, 'missing', 'up')).toBe(widgets)
  })

  it('menduplikasi widget dengan judul salinan dan id baru', () => {
    const widgets: DashboardWidget[] = [kpi('k1', 0, 'KPI 1')]
    const result = duplicateDashboardWidget(widgets, 'k1')

    expect(result).not.toBeNull()
    expect(result?.duplicated.id).not.toBe('k1')
    expect(result?.duplicated.title).toBe('KPI 1 (Salinan)')
    expect(result?.widgets).toHaveLength(2)
    expect(result?.widgets.map((widget) => widget.order)).toEqual([0, 1])
    expect(widgets).toHaveLength(1)
  })

  it('mengembalikan null saat widget duplikat tidak ditemukan', () => {
    expect(duplicateDashboardWidget([], 'missing')).toBeNull()
  })
})
