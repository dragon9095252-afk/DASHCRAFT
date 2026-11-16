import type { DatasetColumn } from '@/domain/dataset.types'
import type { DashboardWidget, KpiWidgetConfig } from '@/domain/dashboard.types'
import { requiresNumericColumn, requiresTargetColumn } from '@/services/aggregation.service'
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
import { NUMBER_FORMAT_OPTIONS } from './editor-options'

export function KpiEditorFields({
  widget,
  columns,
  onChange,
}: {
  widget: KpiWidgetConfig
  columns: DatasetColumn[]
  onChange: (widget: DashboardWidget) => void
}) {
  const numericColumns = columns.filter((column) => column.type === 'number')
  const needsNumeric = requiresNumericColumn(widget.metric)
  const needsField = requiresTargetColumn(widget.metric)
  const fieldOptions = needsNumeric ? numericColumns : columns

  return (
    <>
      <EditorField label="Metrik">
        <AggregationSelect
          value={widget.metric}
          numericColumnCount={numericColumns.length}
          onChange={(metric) => onChange({ ...widget, metric })}
        />
      </EditorField>

      {needsField ? (
        <EditorField
          label="Kolom"
          hint={
            needsNumeric && numericColumns.length === 0
              ? 'Dataset ini tidak memiliki kolom angka.'
              : undefined
          }
        >
          <ColumnSelect
            value={widget.fieldId}
            columns={fieldOptions}
            placeholder="Pilih kolom"
            onChange={(fieldId) => onChange({ ...widget, fieldId })}
          />
        </EditorField>
      ) : (
        <p className="rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
          Metrik “Jumlah data” menghitung seluruh baris dan tidak memerlukan kolom.
        </p>
      )}

      <EditorField label="Format angka">
        <Select
          value={widget.numberFormat}
          onValueChange={(value) =>
            onChange({ ...widget, numberFormat: value as KpiWidgetConfig['numberFormat'] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NUMBER_FORMAT_OPTIONS.map((format) => (
              <SelectItem key={format.value} value={format.value}>
                {format.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </EditorField>
    </>
  )
}
