import type { DatasetColumn } from '@/domain/dataset.types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { NO_COLUMN } from './editor-options'

export function ColumnSelect({
  value,
  columns,
  placeholder,
  noneLabel = 'Tanpa kolom',
  onChange,
}: {
  value?: string
  columns: DatasetColumn[]
  placeholder: string
  noneLabel?: string
  onChange: (columnId?: string) => void
}) {
  return (
    <Select
      value={value ?? NO_COLUMN}
      onValueChange={(next) => onChange(next === NO_COLUMN ? undefined : next)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_COLUMN}>{noneLabel}</SelectItem>
        {columns.map((column) => (
          <SelectItem key={column.id} value={column.id}>
            {column.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
