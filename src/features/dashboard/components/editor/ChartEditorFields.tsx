import type { ChartWidgetConfig } from '@/domain/dashboard.types'
import type { DatasetColumn, DateGroup } from '@/domain/dataset.types'
import { requiresNumericColumn, requiresTargetColumn } from '@/services/aggregation.service'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AggregationSelect } from './AggregationSelect'
import { ColumnSelect } from './ColumnSelect'
import { EditorField } from './EditorField'
import { CHART_TYPE_OPTIONS, SORT_OPTIONS, type ChartSort } from './editor-options'

const DATE_GROUP_OPTIONS: Array<{ value: DateGroup; label: string }> = [
  { value: 'day', label: 'Hari' },
  { value: 'month', label: 'Bulan' },
  { value: 'year', label: 'Tahun' },
]

export function ChartEditorFields({
  widget,
  columns,
  onChange,
}: {
  widget: ChartWidgetConfig
  columns: DatasetColumn[]
  onChange: (widget: ChartWidgetConfig) => void
}) {
  const numericColumns = columns.filter((column) => column.type === 'number')
  const category = columns.find((column) => column.id === widget.categoryFieldId)
  const isDateCategory = category?.type === 'date'
  const needsNumeric = requiresNumericColumn(widget.aggregation)
  const needsField = requiresTargetColumn(widget.aggregation)
  const valueOptions = needsNumeric ? numericColumns : columns

  function patch(partial: Partial<ChartWidgetConfig>) {
    onChange({ ...widget, ...partial })
  }

  return (
    <>
      <EditorField label="Jenis visual">
        <Select
          value={widget.chartType}
          onValueChange={(value) => patch({ chartType: value as ChartWidgetConfig['chartType'] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHART_TYPE_OPTIONS.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </EditorField>

      <EditorField label="Kolom kategori">
        <ColumnSelect
          value={widget.categoryFieldId}
          columns={columns}
          placeholder="Pilih kolom kategori"
          noneLabel="Tanpa kategori"
          onChange={(categoryFieldId) => patch({ categoryFieldId })}
        />
      </EditorField>

      <EditorField label="Agregasi">
        <AggregationSelect
          value={widget.aggregation}
          numericColumnCount={numericColumns.length}
          onChange={(aggregation) => patch({ aggregation })}
        />
      </EditorField>

      {needsField ? (
        <EditorField label="Kolom nilai">
          <ColumnSelect
            value={widget.valueFieldId}
            columns={valueOptions}
            placeholder="Pilih kolom nilai"
            onChange={(valueFieldId) => patch({ valueFieldId })}
          />
        </EditorField>
      ) : null}

      {isDateCategory ? (
        <EditorField label="Kelompok tanggal">
          <Select
            value={widget.dateGroup}
            onValueChange={(value) => patch({ dateGroup: value as DateGroup })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_GROUP_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </EditorField>
      ) : (
        <>
          <EditorField label="Urutan">
            <Select
              value={widget.sort}
              onValueChange={(value) => patch({ sort: value as ChartSort })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EditorField>

          <EditorField
            label="Batas kategori"
            hint="Default 10 kategori agar grafik tetap mudah dibaca."
          >
            <Input
              type="number"
              min={1}
              max={200}
              value={widget.limit}
              onChange={(event) => {
                const parsed = Number(event.target.value)
                patch({
                  limit: Number.isFinite(parsed)
                    ? Math.max(1, Math.min(200, Math.trunc(parsed)))
                    : 1,
                })
              }}
            />
          </EditorField>
        </>
      )}

      {widget.chartType === 'pie' && category && category.distinctCount > 12 ? (
        <p className="rounded-lg border border-warning/20 bg-warning-soft px-3 py-2 text-xs text-muted-foreground">
          Kategori ini memiliki {category.distinctCount} nilai unik. Grafik donut dengan banyak
          kategori sulit dibaca — pertimbangkan grafik batang.
        </p>
      ) : null}
    </>
  )
}
