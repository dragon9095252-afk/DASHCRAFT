import type { DatasetColumn } from '@/domain/dataset.types'
import type {
  ChartWidgetConfig,
  KpiWidgetConfig,
} from '@/domain/dashboard.types'
import { requiresNumericColumn } from './aggregation.service'

function findColumn(columns: DatasetColumn[], id?: string): DatasetColumn | undefined {
  if (!id) return undefined
  return columns.find((column) => column.id === id)
}

export function validateChartConfig(
  config: ChartWidgetConfig,
  columns: DatasetColumn[],
): string[] {
  const problems: string[] = []
  const category = findColumn(columns, config.categoryFieldId)
  const value = findColumn(columns, config.valueFieldId)

  if (!category) {
    problems.push('Pilih kolom kategori yang valid.')
  }

  if (requiresNumericColumn(config.aggregation)) {
    if (!value) {
      problems.push('Pilih kolom nilai untuk agregasi ini.')
    } else if (value.type !== 'number') {
      problems.push(`Kolom "${value.displayName}" bukan kolom angka.`)
    }
  }

  if (config.aggregation === 'distinctCount' && !value) {
    problems.push('Pilih kolom untuk menghitung nilai unik.')
  }

  if (category?.type === 'date' && !config.dateGroup) {
    problems.push('Pilih pengelompokan tanggal.')
  }

  if (!Number.isFinite(config.limit) || config.limit < 1 || config.limit > 200) {
    problems.push('Batas kategori harus antara 1 dan 200.')
  }

  return problems
}

export function validateKpiConfig(
  config: KpiWidgetConfig,
  columns: DatasetColumn[],
): string[] {
  const problems: string[] = []
  const field = findColumn(columns, config.fieldId)

  if (requiresNumericColumn(config.metric)) {
    if (!field) {
      problems.push('Pilih kolom angka untuk metrik ini.')
    } else if (field.type !== 'number') {
      problems.push(`Kolom "${field.displayName}" bukan kolom angka.`)
    }
  }

  if (config.metric === 'distinctCount' && !field) {
    problems.push('Pilih kolom untuk menghitung nilai unik.')
  }

  return problems
}

export function findDatasetColumn(
  columns: DatasetColumn[],
  id?: string,
): DatasetColumn | undefined {
  return findColumn(columns, id)
}
