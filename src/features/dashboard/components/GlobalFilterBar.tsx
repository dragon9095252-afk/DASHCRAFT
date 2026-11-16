import { Calendar, ChevronDown, Filter, RotateCcw } from 'lucide-react'
import type { DatasetColumn, DatasetRow } from '@/domain/dataset.types'
import type { ActiveFilterState, DashboardFilterConfig } from '@/domain/filter.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { countActiveFilters, getCategoryOptions } from '@/services/filter.service'
import { formatNumber } from '@/lib/formatters'

export function GlobalFilterBar({
  filters,
  columns,
  rows,
  state,
  onChange,
  onReset,
}: {
  filters: DashboardFilterConfig[]
  columns: DatasetColumn[]
  rows: DatasetRow[]
  state: ActiveFilterState
  onChange: (state: ActiveFilterState) => void
  onReset: () => void
}) {
  if (filters.length === 0) return null

  const activeCount = countActiveFilters(state)

  function toggleCategory(fieldId: string, option: string, checked: boolean) {
    const current = state.categoryValues[fieldId] ?? []
    const next = checked ? [...current, option] : current.filter((value) => value !== option)
    onChange({
      ...state,
      categoryValues: { ...state.categoryValues, [fieldId]: next },
    })
  }

  function updateDate(fieldId: string, part: 'start' | 'end', value: string) {
    const current = state.dateRanges[fieldId] ?? {}
    onChange({
      ...state,
      dateRanges: {
        ...state.dateRanges,
        [fieldId]: { ...current, [part]: value || undefined },
      },
    })
  }

  return (
    <div className="rounded-xl border bg-card px-3 py-3">
      <div className="flex flex-wrap items-end gap-2.5">
        <div className="mb-1.5 mr-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Filter className="size-3.5" />
          Filter
        </div>

        {filters.map((filter) => {
          const column = columns.find((item) => item.id === filter.fieldId)
          if (!column) return null

          if (filter.kind === 'dateRange') {
            const range = state.dateRanges[filter.fieldId] ?? {}
            return (
              <div key={filter.id} className="flex items-center gap-1.5">
                <Calendar className="mb-2 size-3.5 text-muted-foreground" />
                <div>
                  <label
                    className="mb-1 block text-[10px] font-medium text-muted-foreground"
                    htmlFor={`date-start-${filter.id}`}
                  >
                    {filter.label} dari
                  </label>
                  <Input
                    id={`date-start-${filter.id}`}
                    type="date"
                    value={range.start ?? ''}
                    onChange={(event) => updateDate(filter.fieldId, 'start', event.target.value)}
                    className="h-8 w-[136px] text-xs"
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-[10px] font-medium text-muted-foreground"
                    htmlFor={`date-end-${filter.id}`}
                  >
                    sampai
                  </label>
                  <Input
                    id={`date-end-${filter.id}`}
                    type="date"
                    value={range.end ?? ''}
                    onChange={(event) => updateDate(filter.fieldId, 'end', event.target.value)}
                    className="h-8 w-[136px] text-xs"
                  />
                </div>
              </div>
            )
          }

          const options = getCategoryOptions(rows, filter.fieldId)
          const selected = state.categoryValues[filter.fieldId] ?? []
          const summary =
            selected.length === 0
              ? 'Semua nilai'
              : selected.length === 1
                ? selected[0]
                : `${formatNumber(selected.length, 'integer')} dipilih`

          return (
            <div key={filter.id}>
              <span className="mb-1 block text-[10px] font-medium text-muted-foreground">
                {filter.label}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 min-w-[150px] justify-between gap-2 text-xs font-normal"
                    aria-label={`Filter ${filter.label}: ${summary}`}
                  >
                    <span className="truncate">{summary}</span>
                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-auto">
                  <DropdownMenuLabel className="text-xs">Pilih nilai</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {options.length === 0 ? (
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      Tidak ada nilai
                    </DropdownMenuLabel>
                  ) : (
                    options.map((option) => (
                      <DropdownMenuCheckboxItem
                        key={option}
                        checked={selected.includes(option)}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(checked) =>
                          toggleCategory(filter.fieldId, option, checked === true)
                        }
                      >
                        <span className="truncate">{option}</span>
                      </DropdownMenuCheckboxItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}

        <div className="ml-auto flex items-center gap-2 pb-0.5">
          {activeCount > 0 ? (
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
              {activeCount} filter aktif
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={activeCount === 0}
            className="text-xs"
          >
            <RotateCcw className="size-3.5" />
            Reset filter
          </Button>
        </div>
      </div>
    </div>
  )
}
