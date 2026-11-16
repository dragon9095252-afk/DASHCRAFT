import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Grid2X2, SlidersHorizontal, Table2 } from 'lucide-react'
import { toast } from 'sonner'
import type { PivotAggregation, PivotConfiguration, PivotFilter } from '@/domain/pivot.types'
import { PageContainer } from '@/components/layout/PageContainer'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatNumber } from '@/lib/formatters'
import { distinctKey, getCategoryLabel } from '@/lib/value-utils'
import { useStoredDataset } from '@/features/import/hooks/useStoredDataset'
import { buildPivotTable } from '@/services/pivot.service'

const AGGREGATIONS: Array<{ value: PivotAggregation; label: string }> = [
  { value: 'sum', label: 'Sum' },
  { value: 'count', label: 'Count' },
  { value: 'average', label: 'Average' },
  { value: 'median', label: 'Median' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'distinctCount', label: 'Distinct count' },
]

export function PivotPage() {
  const { datasetId } = useParams<{ datasetId: string }>()
  const { dataset, status } = useStoredDataset(datasetId)
  const [rowFieldIds, setRowFieldIds] = useState<string[]>([])
  const [columnFieldIds, setColumnFieldIds] = useState<string[]>([])
  const [measureFieldId, setMeasureFieldId] = useState('')
  const [aggregation, setAggregation] = useState<PivotAggregation>('sum')
  const [showSubtotals, setShowSubtotals] = useState(true)
  const [sortAscending, setSortAscending] = useState(true)
  const [filterColumnId, setFilterColumnId] = useState('')
  const [filterValueIndex, setFilterValueIndex] = useState('')

  useEffect(() => {
    if (!dataset) return
    const dimensions = dataset.columns.filter((column) => column.type === 'text' || column.type === 'boolean' || column.type === 'date')
    const measures = dataset.columns.filter((column) => column.type === 'number')
    setRowFieldIds((current) => current.length ? current : dimensions.slice(0, 1).map((column) => column.id))
    setColumnFieldIds((current) => current.length ? current : dimensions.slice(1, 2).map((column) => column.id))
    setMeasureFieldId((current) => current || measures[0]?.id || '')
    if (measures.length === 0) setAggregation('count')
    setFilterColumnId((current) => current || dimensions[0]?.id || '')
  }, [dataset])

  const filterValues = useMemo(() => {
    if (!dataset || !filterColumnId) return []
    const values = new Map<string, unknown>()
    for (const row of dataset.rows) {
      const value = row[filterColumnId]
      if (value === null || value === undefined || value === '') continue
      const key = distinctKey(value)
      if (!values.has(key)) values.set(key, value)
      if (values.size >= 80) break
    }
    return [...values.values()].sort((a, b) => getCategoryLabel(a).localeCompare(getCategoryLabel(b), 'id-ID'))
  }, [dataset, filterColumnId])

  const selectedFilterValue = filterValueIndex === '' ? undefined : filterValues[Number(filterValueIndex)]
  const filters = useMemo<PivotFilter[]>(() =>
    selectedFilterValue === undefined || !filterColumnId
      ? []
      : [{ columnId: filterColumnId, includeValues: [selectedFilterValue] }],
    [selectedFilterValue, filterColumnId],
  )

  const configuration = useMemo<PivotConfiguration>(() => ({
    rowFieldIds,
    columnFieldIds,
    measure: { aggregation, ...(measureFieldId ? { fieldId: measureFieldId } : {}) },
    filters,
    showSubtotals,
    sortAscending,
  }), [rowFieldIds, columnFieldIds, aggregation, measureFieldId, filters, showSubtotals, sortAscending])

  const pivot = useMemo(() => {
    if (!dataset) return { result: null, error: null }
    try {
      return { result: buildPivotTable(dataset, configuration), error: null }
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : 'Could not build pivot table.' }
    }
  }, [dataset, configuration])

  if (status === 'loading') return <PageContainer><LoadingState label="Memuat dataset…" /></PageContainer>
  if (!dataset) return <PageContainer><EmptyState title="Dataset tidak ditemukan" description="Impor dataset terlebih dahulu untuk membuat pivot table." /></PageContainer>

  const updateDimension = (axis: 'row' | 'column', fieldId: string, checked: boolean) => {
    if (axis === 'row') {
      setRowFieldIds((current) => checked ? [...current, fieldId] : current.filter((id) => id !== fieldId))
      if (checked) setColumnFieldIds((current) => current.filter((id) => id !== fieldId))
    } else {
      setColumnFieldIds((current) => checked ? [...current, fieldId] : current.filter((id) => id !== fieldId))
      if (checked) setRowFieldIds((current) => current.filter((id) => id !== fieldId))
    }
  }

  const exportCsv = () => {
    if (!pivot.result) return
    const headers = [
      ...pivot.result.rowFields.map((id) => dataset.columns.find((column) => column.id === id)?.displayName ?? id),
      ...pivot.result.columns.map((column) => column.label),
      'Total',
    ]
    const escape = (value: string, forceText = false) => {
      const safeValue = forceText && /^[\s\uFEFF]*[=+\-@]/.test(value) ? "'" + value : value
      return /[",\n\r]/.test(safeValue)
        ? '"' + safeValue.replace(/"/g, '""') + '"'
        : safeValue
    }
    const lines = [headers.map((value) => escape(String(value), true)).join(',')]
    for (const row of pivot.result.rows) {
      const rowLabels = row.kind === 'grand-total' && rowFieldIds.length
        ? [row.label, ...Array.from({ length: rowFieldIds.length - 1 }, () => '')]
        : row.labels
      const values = [
        ...rowLabels.map((value) => escape(String(value), true)),
        ...pivot.result.columns.map((column) => {
          const value = row.cells[column.key]
          return escape(value === null || value === undefined ? '' : String(value))
        }),
        escape(row.total === null ? '' : String(row.total)),
      ]
      lines.push(values.join(','))
    }
    const csv = '\uFEFF' + lines.join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'pivot-' + dataset.name.replace(/[^a-z0-9-_]+/gi, '-') + '.csv'
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    toast.success('Pivot table exported')
  }

  const dimensionColumns = dataset.columns.filter((column) => column.type === 'text' || column.type === 'boolean' || column.type === 'date')
  const numericColumns = dataset.columns.filter((column) => column.type === 'number')
  const valueColumns = aggregation === 'count' || aggregation === 'distinctCount' ? dataset.columns : numericColumns

  return (
    <PageContainer wide>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to={`/data-preview/${dataset.id}`}><ArrowLeft className="size-4" /> Dataset</Link>
          </Button>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand">Advanced analytics</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Pivot table builder</h1>
          <p className="mt-1 text-sm text-muted-foreground">Summarize {dataset.name} with row dimensions, column dimensions and measures.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5"><span className="size-1.5 rounded-full bg-success" /> Browser only</Badge>
          <Button onClick={exportCsv} disabled={!pivot.result}><Download className="size-4" /> Export CSV</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-3"><Grid2X2 className="size-4 text-brand" /><h2 className="text-sm font-semibold">Available fields</h2></div>
            <div className="space-y-2 p-3">
              {dataset.columns.map((column) => {
                const rowSelected = rowFieldIds.includes(column.id)
                const columnSelected = columnFieldIds.includes(column.id)
                const eligible = column.type === 'text' || column.type === 'boolean' || column.type === 'date'
                return (
                  <div key={column.id} className="rounded-lg border px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium">{column.displayName}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{column.type}</span>
                    </div>
                    <div className="mt-2 flex gap-4">
                      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><input type="checkbox" className="accent-[var(--brand)]" checked={rowSelected} onChange={(event) => updateDimension('row', column.id, event.target.checked)} disabled={!eligible} /> Rows</label>
                      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><input type="checkbox" className="accent-[var(--brand)]" checked={columnSelected} onChange={(event) => updateDimension('column', column.id, event.target.checked)} disabled={!eligible} /> Columns</label>
                    </div>
                  </div>
                )
              })}
              {!dimensionColumns.length ? <p className="p-2 text-xs text-muted-foreground">No text, date or boolean dimensions were detected.</p> : null}
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center gap-2"><SlidersHorizontal className="size-4 text-brand" /><h2 className="text-sm font-semibold">Values & filters</h2></div>
            <div className="space-y-3">
              <div className="space-y-1.5"><label className="text-xs font-medium">Aggregation</label>
                <Select value={aggregation} onValueChange={(value) => {
                  const next = value as PivotAggregation
                  setAggregation(next)
                  if (next === 'count') setMeasureFieldId('')
                }}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{AGGREGATIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {aggregation !== 'count' || valueColumns.length ? (
                <div className="space-y-1.5"><label className="text-xs font-medium">Value field</label>
                  <Select value={aggregation === 'count' && !measureFieldId ? '__all_rows__' : measureFieldId} onValueChange={(value) => setMeasureFieldId(value === '__all_rows__' ? '' : value)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Choose value field" /></SelectTrigger>
                    <SelectContent>
                      {aggregation === 'count' ? <SelectItem value="__all_rows__">All rows</SelectItem> : null}
                      {valueColumns.map((column) => <SelectItem key={column.id} value={column.id}>{column.displayName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="space-y-1.5"><label className="text-xs font-medium">Filter field</label>
                <Select value={filterColumnId} onValueChange={(value) => { setFilterColumnId(value); setFilterValueIndex('') }}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Choose filter field" /></SelectTrigger>
                  <SelectContent>{dataset.columns.map((column) => <SelectItem key={column.id} value={column.id}>{column.displayName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><label className="text-xs font-medium">Keep value</label>
                <Select value={filterValueIndex} onValueChange={setFilterValueIndex}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="All values" /></SelectTrigger>
                  <SelectContent>{filterValues.map((value, index) => <SelectItem key={distinctKey(value)} value={String(index)}>{getCategoryLabel(value)}</SelectItem>)}</SelectContent>
                </Select>
                {filterValueIndex !== '' ? <Button size="sm" variant="ghost" onClick={() => setFilterValueIndex('')}>Clear filter</Button> : null}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={showSubtotals} onChange={(event) => setShowSubtotals(event.target.checked)} className="accent-[var(--brand)]" /> Show row subtotals</label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={sortAscending} onChange={(event) => setSortAscending(event.target.checked)} className="accent-[var(--brand)]" /> Sort ascending</label>
            </div>
          </section>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div><h2 className="text-sm font-semibold">Pivot preview</h2><p className="mt-0.5 text-xs text-muted-foreground">{pivot.result?.filteredRowCount.toLocaleString('id-ID') ?? 0} records included</p></div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">Rows {rowFieldIds.length}</Badge>
              <Badge variant="secondary">Columns {columnFieldIds.length}</Badge>
              <Badge variant="secondary">{AGGREGATIONS.find((item) => item.value === aggregation)?.label}</Badge>
            </div>
          </div>

          {pivot.error ? <div className="m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{pivot.error}</div> : null}
          {!pivot.error && pivot.result ? (
            <>
              <div className="max-h-[650px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card"><TableRow>
                    {rowFieldIds.length ? rowFieldIds.map((id) => <TableHead key={id} className="min-w-32 bg-card">{dataset.columns.find((column) => column.id === id)?.displayName}</TableHead>) : <TableHead className="bg-card">Total</TableHead>}
                    {pivot.result.columns.map((column) => <TableHead key={column.key} className="min-w-28 bg-card text-right">{column.label}</TableHead>)}
                    <TableHead className="min-w-28 bg-card text-right">Grand total</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {pivot.result.rows.map((row) => (
                      <TableRow key={row.key} className={row.kind === 'grand-total' ? 'bg-secondary/70 font-semibold' : row.kind === 'subtotal' ? 'bg-secondary/30 font-medium' : ''}>
                        {row.kind === 'grand-total' ? <TableCell colSpan={Math.max(1, rowFieldIds.length)}>{row.label}</TableCell> : rowFieldIds.length ? rowFieldIds.map((id, index) => <TableCell key={id} className={index === row.level - 1 ? 'font-medium' : 'text-muted-foreground'}>{row.labels[index] ?? ''}</TableCell>) : <TableCell>{row.label}</TableCell>}
                        {pivot.result.columns.map((column) => <TableCell key={column.key} className="text-right tabular-nums">{row.cells[column.key] === null || row.cells[column.key] === undefined ? '—' : formatNumber(row.cells[column.key] as number)}</TableCell>)}
                        <TableCell className="text-right font-semibold tabular-nums">{row.total === null ? '—' : formatNumber(row.total)}</TableCell>
                      </TableRow>
                    ))}
                    {!pivot.result.rows.length ? <TableRow><TableCell colSpan={Math.max(2, rowFieldIds.length + pivot.result.columns.length + 1)} className="py-10 text-center text-muted-foreground">No matching rows.</TableCell></TableRow> : null}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
                <span>{pivot.result.rows.length.toLocaleString('id-ID')} pivot rows · {pivot.result.columns.length} pivot columns</span>
                <span>Grand total: <strong className="text-foreground">{pivot.result.grandTotal === null ? '—' : formatNumber(pivot.result.grandTotal)}</strong></span>
              </div>
            </>
          ) : null}
          {!pivot.error && !pivot.result ? <div className="p-10 text-center text-sm text-muted-foreground"><Table2 className="mx-auto mb-2 size-6" />Configure fields to build your pivot table.</div> : null}
        </section>
      </div>
    </PageContainer>
  )
}
