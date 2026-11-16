import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import type { ColumnType, DatasetColumn } from '@/domain/dataset.types'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCellValue } from '@/lib/formatters'
import { TypeBadge } from './TypeBadge'

const TYPE_OPTIONS: Array<{ value: ColumnType; label: string }> = [
  { value: 'text', label: 'Teks' },
  { value: 'number', label: 'Angka' },
  { value: 'date', label: 'Tanggal' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'unknown', label: 'Tidak pasti' },
]

function ColumnProfileItem({
  column,
  onTypeChange,
  onDisplayNameChange,
}: {
  column: DatasetColumn
  onTypeChange: (columnId: string, type: ColumnType) => void
  onDisplayNameChange: (columnId: string, displayName: string) => void
}) {
  const [draftName, setDraftName] = useState(column.displayName)

  useEffect(() => {
    setDraftName(column.displayName)
  }, [column.displayName])

  function commitName() {
    if (draftName.trim() && draftName.trim() !== column.displayName) {
      onDisplayNameChange(column.id, draftName)
    } else {
      setDraftName(column.displayName)
    }
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-start gap-2">
        <Input
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') setDraftName(column.displayName)
          }}
          aria-label={`Nama tampilan kolom ${column.displayName}`}
          className="h-8 flex-1 text-sm font-medium"
        />
        <Select
          value={column.type}
          onValueChange={(value) => onTypeChange(column.id, value as ColumnType)}
        >
          <SelectTrigger className="h-8 w-[124px] text-xs" aria-label="Tipe data kolom">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {column.originalName && column.originalName !== column.displayName ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Header asli: “{column.originalName}”
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <TypeBadge type={column.type} />
        <span>{column.nullCount} kosong</span>
        <span aria-hidden>·</span>
        <span>{column.distinctCount} nilai unik</span>
        <span aria-hidden>·</span>
        <span>keyakinan {Math.round(column.inferenceConfidence * 100)}%</span>
      </div>

      {column.sampleValues.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {column.sampleValues.slice(0, 4).map((value, index) => (
            <span
              key={index}
              className="max-w-[140px] truncate rounded border bg-secondary/60 px-1.5 py-0.5 text-[11px] text-muted-foreground"
              title={formatCellValue(value)}
            >
              {formatCellValue(value)}
            </span>
          ))}
        </div>
      ) : null}

      {column.typeMismatchCount > 0 ? (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-warning">
          <TriangleAlert className="mt-px size-3 shrink-0" />
          {column.typeMismatchCount} nilai tidak cocok dengan tipe ini dan ditandai, bukan dihapus.
        </p>
      ) : null}
    </div>
  )
}

export function ColumnProfileList({
  columns,
  onTypeChange,
  onDisplayNameChange,
}: {
  columns: DatasetColumn[]
  onTypeChange: (columnId: string, type: ColumnType) => void
  onDisplayNameChange: (columnId: string, displayName: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Profil kolom</h2>
        <span className="text-xs text-muted-foreground">{columns.length} kolom</span>
      </div>
      <div className="max-h-[560px] divide-y overflow-auto">
        {columns.map((column) => (
          <ColumnProfileItem
            key={column.id}
            column={column}
            onTypeChange={onTypeChange}
            onDisplayNameChange={onDisplayNameChange}
          />
        ))}
      </div>
    </div>
  )
}
