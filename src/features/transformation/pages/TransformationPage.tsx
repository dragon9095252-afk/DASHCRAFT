import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowDown, ArrowUp, CircleAlert,
  Clock3, Eye, ListChecks, Plus, Redo2, RotateCcw, Save, SlidersHorizontal, Undo2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ColumnType } from '@/domain/dataset.types'
import type { TransformationStep, FillStrategy, ComparisonOperator } from '@/domain/transformation.types'
import { PageContainer } from '@/components/layout/PageContainer'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCellValue } from '@/lib/formatters'
import { toBoolean, toDate, toNumber } from '@/lib/value-utils'
import { datasetRepository } from '@/db/repositories/dataset.repository'
import { useDashboardStore } from '@/state/dashboard-store'
import { useStoredDataset } from '@/features/import/hooks/useStoredDataset'
import {
  appendTransformationStep, applyTransformationSteps, createTransformationHistory,
  getActiveTransformationSteps, redoTransformation, undoTransformation,
} from '@/services/transformation.service'
import type { TransformationHistory } from '@/domain/transformation.types'

type OperationKind =
  | 'trim-whitespace'
  | 'rename-column'
  | 'change-column-type'
  | 'fill-missing'
  | 'remove-columns'
  | 'filter-rows'

const OPERATION_LABELS: Record<OperationKind, string> = {
  'trim-whitespace': 'Trim whitespace',
  'rename-column': 'Rename column',
  'change-column-type': 'Change data type',
  'fill-missing': 'Fill missing values',
  'remove-columns': 'Remove column',
  'filter-rows': 'Filter rows',
}

const COLUMN_TYPES: Array<{ value: Exclude<ColumnType, 'unknown'>; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
]

const FILTER_OPERATORS: Array<{ value: ComparisonOperator; label: string }> = [
  { value: 'equals', label: 'Equals' },
  { value: 'not-equals', label: 'Does not equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'not-contains', label: 'Does not contain' },
  { value: 'greater-than', label: 'Greater than' },
  { value: 'greater-or-equal', label: 'Greater or equal' },
  { value: 'less-than', label: 'Less than' },
  { value: 'less-or-equal', label: 'Less or equal' },
  { value: 'is-empty', label: 'Is empty' },
  { value: 'is-not-empty', label: 'Is not empty' },
]

export function TransformationPage() {
  const { datasetId } = useParams<{ datasetId: string }>()
  const navigate = useNavigate()
  const { addDataset } = useDashboardStore()
  const { dataset, status } = useStoredDataset(datasetId)
  const [history, setHistory] = useState<TransformationHistory>(() => createTransformationHistory())
  const [operation, setOperation] = useState<OperationKind>('trim-whitespace')
  const [columnId, setColumnId] = useState('')
  const [targetType, setTargetType] = useState<Exclude<ColumnType, 'unknown'>>('text')
  const [fillStrategy, setFillStrategy] = useState<FillStrategy>('mode')
  const [fillValue, setFillValue] = useState('')
  const [newName, setNewName] = useState('')
  const [filterOperator, setFilterOperator] = useState<ComparisonOperator>('equals')
  const [filterValue, setFilterValue] = useState('')

  const activeSteps = useMemo(() => getActiveTransformationSteps(history), [history])
  const preview = useMemo(() => {
    if (!dataset) return null
    try {
      return { result: applyTransformationSteps(dataset, activeSteps), error: null as string | null }
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : 'Transformation failed.',
      }
    }
  }, [dataset, activeSteps])

  if (status === 'loading') {
    return <PageContainer><LoadingState label="Memuat dataset…" /></PageContainer>
  }
  if (!dataset) {
    return (
      <PageContainer>
        <EmptyState icon={SlidersHorizontal} title="Dataset tidak ditemukan" description="Impor dataset terlebih dahulu untuk memulai transformasi." />
      </PageContainer>
    )
  }

  const selectedColumn = dataset.columns.find((column) => column.id === columnId) ?? dataset.columns[0]
  const canUndo = history.cursor > 0
  const canRedo = history.cursor < history.steps.length

  const addStep = () => {
    if (!selectedColumn) {
      toast.error('Dataset tidak memiliki kolom.')
      return
    }
    const base = { id: crypto.randomUUID(), enabled: true }
    let step: TransformationStep
    switch (operation) {
      case 'trim-whitespace':
        step = { ...base, type: 'trim-whitespace', columnIds: [selectedColumn.id] }
        break
      case 'rename-column':
        step = { ...base, type: 'rename-column', columnId: selectedColumn.id, newName }
        break
      case 'change-column-type':
        step = { ...base, type: 'change-column-type', columnId: selectedColumn.id, targetType }
        break
      case 'fill-missing': {
        let replacement: unknown = fillValue
        if (selectedColumn.type === 'number') replacement = toNumber(fillValue) ?? fillValue
        if (selectedColumn.type === 'date') replacement = toDate(fillValue) ?? fillValue
        if (selectedColumn.type === 'boolean') replacement = toBoolean(fillValue) ?? fillValue
        step = {
          ...base,
          type: 'fill-missing',
          columnIds: [selectedColumn.id],
          strategy: fillStrategy,
          ...(fillStrategy === 'value' ? { value: replacement } : {}),
        }
        break
      }
      case 'remove-columns':
        step = { ...base, type: 'remove-columns', columnIds: [selectedColumn.id] }
        break
      case 'filter-rows':
        step = {
          ...base,
          type: 'filter-rows',
          columnId: selectedColumn.id,
          operator: filterOperator,
          ...(['is-empty', 'is-not-empty'].includes(filterOperator) ? {} : { value: filterValue }),
        }
        break
      default: {
        const exhaustive: never = operation
        return exhaustive
      }
    }

    setHistory((previous) => appendTransformationStep(previous, step))
    toast.success('Transformation step added', { description: OPERATION_LABELS[operation] })
  }

  const toggleStep = (stepId: string, enabled: boolean) => {
    setHistory((previous) => ({
      ...previous,
      steps: previous.steps.map((step) => step.id === stepId ? { ...step, enabled } : step),
    }))
  }

  const moveStep = (stepId: string, direction: -1 | 1) => {
    setHistory((previous) => {
      const active = previous.steps.slice(0, previous.cursor)
      const index = active.findIndex((step) => step.id === stepId)
      const destination = index + direction
      if (index < 0 || destination < 0 || destination >= active.length) return previous
      const next = [...previous.steps]
      ;[next[index], next[destination]] = [next[destination], next[index]]
      return { ...previous, steps: next }
    })
  }

  const saveAsNewDataset = async () => {
    if (!preview?.result || preview.error) return
    const now = new Date().toISOString()
    const transformed = {
      ...preview.result.dataset,
      id: crypto.randomUUID(),
      name: dataset.name + ' — cleaned',
      createdAt: now,
      updatedAt: now,
      sourceFileName: dataset.sourceFileName,
      warnings: [...preview.result.dataset.warnings],
    }
    try {
      await datasetRepository.save(transformed)
      addDataset(transformed)
      toast.success('Cleaned dataset saved locally')
      navigate(`/data-preview/${transformed.id}`)
    } catch {
      toast.error('Could not save the transformed dataset in this browser.')
    }
  }

  const displaySteps = history.steps
  const activeResult = preview?.result
  const outputDataset = activeResult?.dataset

  return (
    <PageContainer wide>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to={`/data-preview/${dataset.id}`}><ArrowLeft className="size-4" /> Dataset</Link>
          </Button>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand">Power Query-style workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Data transformation</h1>
          <p className="mt-1 text-sm text-muted-foreground">Clean, reshape and validate your data. The imported dataset stays unchanged.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5"><span className="size-1.5 rounded-full bg-success" /> Local processing</Badge>
          <Button onClick={saveAsNewDataset} disabled={!activeSteps.length || !outputDataset || Boolean(preview?.error)}>
            <Save className="size-4" /> Save as new dataset
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Source dataset</p>
                <h2 className="mt-1 truncate text-sm font-semibold" title={dataset.name}>{dataset.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{dataset.columns.length} columns · {dataset.rowCount.toLocaleString('id-ID')} rows</p>
              </div>
              <div className="rounded-lg bg-brand-soft p-2 text-brand"><SlidersHorizontal className="size-4" /></div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 text-xs">
              <span>Source health</span><strong>{dataset.warnings.length ? `${dataset.warnings.length} warnings` : 'No warnings'}</strong>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2"><ListChecks className="size-4 text-brand" /><h2 className="text-sm font-semibold">Applied steps</h2></div>
              <Badge variant="secondary">{activeSteps.length}</Badge>
            </div>
            <div className="space-y-1 p-2">
              {displaySteps.length === 0 ? (
                <p className="px-2 py-5 text-center text-xs leading-relaxed text-muted-foreground">Your transformation history will appear here.</p>
              ) : displaySteps.map((step, index) => (
                <div key={step.id} className={`rounded-lg border p-2.5 ${index >= history.cursor ? 'opacity-45' : ''} ${step.enabled ? 'bg-card' : 'bg-secondary/50'}`}>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{OPERATION_LABELS[step.type as OperationKind] ?? step.type}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {'columnId' in step ? dataset.columns.find((column) => column.id === step.columnId)?.displayName ?? step.columnId : 'columnIds' in step ? step.columnIds.map((id) => dataset.columns.find((column) => column.id === id)?.displayName ?? id).join(', ') : 'Row filter'}
                      </p>
                    </div>
                    <input
                      aria-label="Enable step"
                      type="checkbox"
                      checked={step.enabled}
                      onChange={(event) => toggleStep(step.id, event.target.checked)}
                      className="mt-0.5 size-3.5 accent-[var(--brand)]"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{index < history.cursor ? 'In preview' : 'Redo queue'}</span>
                    <div className="flex gap-1">
                      <Button size="icon-xs" variant="ghost" aria-label="Move step up" disabled={index === 0 || index >= history.cursor} onClick={() => moveStep(step.id, -1)}><ArrowUp /></Button>
                      <Button size="icon-xs" variant="ghost" aria-label="Move step down" disabled={index >= history.cursor - 1} onClick={() => moveStep(step.id, 1)}><ArrowDown /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1 border-t p-2">
              <Button size="sm" variant="ghost" className="flex-1" disabled={!canUndo} onClick={() => setHistory(undoTransformation)}><Undo2 /> Undo</Button>
              <Button size="sm" variant="ghost" className="flex-1" disabled={!canRedo} onClick={() => setHistory(redoTransformation)}><Redo2 /> Redo</Button>
              <Button size="icon" variant="ghost" aria-label="Reset steps" onClick={() => setHistory(createTransformationHistory())}><RotateCcw /></Button>
            </div>
          </section>
        </aside>

        <div className="min-w-0 space-y-4">
          <section className="rounded-xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
              <div><h2 className="text-sm font-semibold">Add a transformation</h2><p className="mt-0.5 text-xs text-muted-foreground">Choose an operation and preview it before saving.</p></div>
              <Badge variant="outline">Step-based pipeline</Badge>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_auto] xl:items-end">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Operation</label>
                <Select value={operation} onValueChange={(value) => setOperation(value as OperationKind)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(OPERATION_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Target column</label>
                <Select value={selectedColumn?.id ?? ''} onValueChange={setColumnId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Choose column" /></SelectTrigger>
                  <SelectContent>{dataset.columns.map((column) => <SelectItem key={column.id} value={column.id}>{column.displayName}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {operation === 'change-column-type' ? (
                <div className="space-y-1.5"><label className="text-xs font-medium">New data type</label>
                  <Select value={targetType} onValueChange={(value) => setTargetType(value as typeof targetType)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{COLUMN_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : operation === 'fill-missing' ? (
                <div className="space-y-1.5"><label className="text-xs font-medium">Fill strategy</label>
                  <Select value={fillStrategy} onValueChange={(value) => setFillStrategy(value as FillStrategy)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mode">Most frequent value</SelectItem>
                      <SelectItem value="value">Constant value</SelectItem>
                      <SelectItem value="forward">Forward fill</SelectItem>
                      <SelectItem value="backward">Backward fill</SelectItem>
                      {selectedColumn?.type === 'number' ? <><SelectItem value="mean">Mean</SelectItem><SelectItem value="median">Median</SelectItem></> : null}
                    </SelectContent>
                  </Select>
                  {fillStrategy === 'value' ? <Input value={fillValue} onChange={(event) => setFillValue(event.target.value)} placeholder="Replacement value" /> : null}
                </div>
              ) : operation === 'rename-column' ? (
                <div className="space-y-1.5"><label className="text-xs font-medium">New column name</label><Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Enter a name" /></div>
              ) : operation === 'filter-rows' ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5"><label className="text-xs font-medium">Condition</label>
                    <Select value={filterOperator} onValueChange={(value) => setFilterOperator(value as ComparisonOperator)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{FILTER_OPERATORS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><label className="text-xs font-medium">Value</label><Input value={filterValue} onChange={(event) => setFilterValue(event.target.value)} disabled={['is-empty', 'is-not-empty'].includes(filterOperator)} placeholder="Filter value" /></div>
                </div>
              ) : (
                <div className="rounded-lg bg-secondary/50 px-3 py-2.5 text-xs text-muted-foreground">
                  {operation === 'trim-whitespace' ? 'Remove leading and trailing spaces from text values.' : 'Remove this column from the transformed result.'}
                </div>
              )}

              <Button onClick={addStep} disabled={!selectedColumn}><Plus className="size-4" /> Add step</Button>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div className="flex items-center gap-2"><Eye className="size-4 text-brand" /><h2 className="text-sm font-semibold">Live data preview</h2></div>
              {outputDataset ? <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{outputDataset.rowCount.toLocaleString('id-ID')} rows</span><span>·</span><span>{outputDataset.columns.length} columns</span></div> : null}
            </div>
            {preview?.error ? (
              <div className="m-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0" /> {preview.error}</div>
            ) : null}
            {outputDataset ? (
              <>
                <div className="max-h-[440px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card"><TableRow><TableHead className="w-12 text-right">#</TableHead>{outputDataset.columns.map((column) => <TableHead key={column.id} className="min-w-32 whitespace-nowrap">{column.displayName}<span className="ml-1.5 text-[10px] font-normal text-muted-foreground">{column.type}</span></TableHead>)}</TableRow></TableHeader>
                    <TableBody>
                      {outputDataset.rows.slice(0, 12).map((row, index) => <TableRow key={index}><TableCell className="text-right text-xs text-muted-foreground">{index + 1}</TableCell>{outputDataset.columns.map((column) => <TableCell key={column.id} className="max-w-48 truncate text-xs" title={formatCellValue(row[column.id], column.type)}>{formatCellValue(row[column.id], column.type) || <span className="text-muted-foreground">—</span>}</TableCell>)}</TableRow>)}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground"><span>Showing {Math.min(12, outputDataset.rows.length)} of {outputDataset.rows.length.toLocaleString('id-ID')} rows</span><span className="flex items-center gap-1"><Clock3 className="size-3" /> {activeResult?.executions.filter((item) => !item.skipped).length ?? 0} active steps</span></div>
              </>
            ) : null}
          </section>

          {activeResult?.warnings.length ? (
            <section className="rounded-xl border border-warning/30 bg-warning-soft/40 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-warning"><CircleAlert className="size-4" /> Transformation warnings</div>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{activeResult.warnings.map((warning, index) => <li key={index}>• {warning}</li>)}</ul>
            </section>
          ) : null}
        </div>
      </div>
    </PageContainer>
  )
}
