import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, Download, Sigma } from 'lucide-react'
import { toast } from 'sonner'
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
import { useStoredDataset } from '@/features/import/hooks/useStoredDataset'
import { analyzeDataset, buildNumericHistogram } from '@/services/statistics.service'

function display(value: number | null): string {
  return value === null ? '—' : formatNumber(value)
}

function safeCsv(value: unknown, forceText = false): string {
  const text = value === null || value === undefined ? '' : String(value)
  const safe = forceText && /^[\s\uFEFF]*[=+\-@]/.test(text) ? "'" + text : text
  return /[",\n\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
}

export function StatisticsPage() {
  const { datasetId } = useParams<{ datasetId: string }>()
  const { dataset, status } = useStoredDataset(datasetId)
  const [selectedColumnId, setSelectedColumnId] = useState('')

  const analysis = useMemo(() => dataset ? analyzeDataset(dataset) : null, [dataset])

  useEffect(() => {
    if (!analysis) return
    setSelectedColumnId((current) =>
      analysis.columns.some((column) => column.columnId === current)
        ? current
        : analysis.columns[0]?.columnId ?? '',
    )
  }, [analysis])

  const histogram = useMemo(
    () => dataset && selectedColumnId ? buildNumericHistogram(dataset, selectedColumnId) : [],
    [dataset, selectedColumnId],
  )

  if (status === 'loading') {
    return <PageContainer><LoadingState label="Memuat dataset…" /></PageContainer>
  }
  if (!dataset || !analysis) {
    return (
      <PageContainer>
        <EmptyState icon={Activity} title="Dataset tidak ditemukan" description="Impor dataset terlebih dahulu untuk menjalankan analisis statistik." />
      </PageContainer>
    )
  }

  const numericFields = analysis.columns
  const selectedStats = numericFields.find((column) => column.columnId === selectedColumnId)
  const maxBinCount = Math.max(1, ...histogram.map((bin) => bin.count))

  const exportCsv = () => {
    if (!numericFields.length) return
    const headers = [
      'Column', 'Rows', 'Valid', 'Missing', 'Invalid', 'Distinct', 'Zero',
      'Sum', 'Mean', 'Median', 'Min', 'Q1', 'Q3', 'Max',
      'Sample variance', 'Sample standard deviation', 'IQR', 'Lower fence', 'Upper fence', 'Outliers',
    ]
    const lines = [
      headers.map((value) => safeCsv(value, true)).join(','),
      ...numericFields.map((column) => [
        column.columnName, column.rowCount, column.validCount, column.missingCount,
        column.invalidCount, column.distinctCount, column.zeroCount, column.sum,
        column.mean, column.median, column.min, column.q1, column.q3, column.max,
        column.sampleVariance, column.sampleStandardDeviation, column.interquartileRange,
        column.lowerOutlierFence, column.upperOutlierFence, column.outlierCount,
      ].map((value, index) => safeCsv(value, index === 0)).join(',')),
    ]
    const csv = '\uFEFF' + lines.join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'statistics-' + dataset.name.replace(/[^a-z0-9-_]+/gi, '-') + '.csv'
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    toast.success('Statistical summary exported')
  }

  const correlationFor = (leftId: string, rightId: string) =>
    analysis.correlations.find((item) =>
      (item.leftColumnId === leftId && item.rightColumnId === rightId) ||
      (item.leftColumnId === rightId && item.rightColumnId === leftId),
    )

  return (
    <PageContainer wide>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to={'/data-preview/' + dataset.id}><ArrowLeft className="size-4" /> Dataset</Link>
          </Button>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand">Advanced analytics</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Statistical analysis</h1>
          <p className="mt-1 text-sm text-muted-foreground">Explore distributions, outliers and relationships in {dataset.name}.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5"><span className="size-1.5 rounded-full bg-success" /> Browser only</Badge>
          <Button onClick={exportCsv} disabled={!numericFields.length}><Download className="size-4" /> Export summary</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Records analyzed</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{analysis.rowCount.toLocaleString('id-ID')}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Numeric fields</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{analysis.numericColumnCount.toLocaleString('id-ID')}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Correlation pairs</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{analysis.correlations.length.toLocaleString('id-ID')}</p>
        </div>
      </div>

      {!numericFields.length ? (
        <div className="mt-6 rounded-xl border border-dashed p-10 text-center">
          <Sigma className="mx-auto mb-3 size-7 text-muted-foreground" />
          <h2 className="font-semibold">No numeric fields detected</h2>
          <p className="mt-1 text-sm text-muted-foreground">Set a column's data type to Number in the dataset preview or transformation workspace.</p>
        </div>
      ) : (
        <>
          <section className="mt-6 overflow-hidden rounded-xl border bg-card">
            <div className="border-b px-4 py-3">
              <div className="flex items-center gap-2"><Activity className="size-4 text-brand" /><h2 className="text-sm font-semibold">Descriptive statistics</h2></div>
              <p className="mt-1 text-xs text-muted-foreground">Quartiles use linear interpolation. Variance and standard deviation are sample estimates (n − 1).</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numeric field</TableHead>
                    <TableHead className="text-right">Valid</TableHead>
                    <TableHead className="text-right">Missing</TableHead>
                    <TableHead className="text-right">Invalid</TableHead>
                    <TableHead className="text-right">Mean</TableHead>
                    <TableHead className="text-right">Median</TableHead>
                    <TableHead className="text-right">Std. dev.</TableHead>
                    <TableHead className="text-right">Min</TableHead>
                    <TableHead className="text-right">Q1</TableHead>
                    <TableHead className="text-right">Q3</TableHead>
                    <TableHead className="text-right">Max</TableHead>
                    <TableHead className="text-right">Outliers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {numericFields.map((column) => (
                    <TableRow key={column.columnId} className={column.columnId === selectedColumnId ? 'bg-secondary/40' : ''}>
                      <TableCell className="font-medium">{column.columnName}</TableCell>
                      <TableCell className="text-right tabular-nums">{column.validCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{column.missingCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{column.invalidCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{display(column.mean)}</TableCell>
                      <TableCell className="text-right tabular-nums">{display(column.median)}</TableCell>
                      <TableCell className="text-right tabular-nums">{display(column.sampleStandardDeviation)}</TableCell>
                      <TableCell className="text-right tabular-nums">{display(column.min)}</TableCell>
                      <TableCell className="text-right tabular-nums">{display(column.q1)}</TableCell>
                      <TableCell className="text-right tabular-nums">{display(column.q3)}</TableCell>
                      <TableCell className="text-right tabular-nums">{display(column.max)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Badge variant={column.outlierCount ? 'destructive' : 'secondary'}>{column.outlierCount}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 border-t px-4 py-3 text-xs text-muted-foreground">
              {numericFields.map((column) => (
                <span key={column.columnId}>{column.columnName}: {column.zeroCount.toLocaleString('id-ID')} zeros · {display(column.interquartileRange)} IQR</span>
              ))}
            </div>
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
            <section className="min-w-0 rounded-xl border bg-card">
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold">Correlation matrix</h2>
                <p className="mt-1 text-xs text-muted-foreground">Pearson correlation, from −1 (inverse) to +1 (direct). Each pair uses rows with valid values in both fields.</p>
              </div>
              <div className="max-w-full overflow-auto p-3">
                <table className="min-w-full border-separate border-spacing-1 text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-card px-2 py-2 text-left">Field</th>
                      {numericFields.map((column) => <th key={column.columnId} className="max-w-24 px-2 py-2 text-right font-medium">{column.columnName}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {numericFields.map((rowColumn) => (
                      <tr key={rowColumn.columnId}>
                        <th className="sticky left-0 bg-card px-2 py-2 text-left font-medium">{rowColumn.columnName}</th>
                        {numericFields.map((column) => {
                          const pair = correlationFor(rowColumn.columnId, column.columnId)
                          const value = pair?.coefficient ?? null
                          return (
                            <td key={column.columnId} title={pair ? 'Pairwise observations: ' + pair.sampleSize : undefined} className="min-w-16 rounded-md bg-secondary/60 px-2 py-2 text-right tabular-nums">
                              {value === null ? '—' : value.toFixed(2)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="min-w-0 rounded-xl border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                <div><h2 className="text-sm font-semibold">Distribution & outliers</h2><p className="mt-1 text-xs text-muted-foreground">A compact histogram for the selected numeric field.</p></div>
                <Select value={selectedColumnId} onValueChange={setSelectedColumnId}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Choose field" /></SelectTrigger>
                  <SelectContent>{numericFields.map((column) => <SelectItem key={column.columnId} value={column.columnId}>{column.columnName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {selectedStats ? (
                <div className="space-y-4 p-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">IQR lower fence</p><p className="font-medium tabular-nums">{display(selectedStats.lowerOutlierFence)}</p></div>
                    <div><p className="text-xs text-muted-foreground">IQR upper fence</p><p className="font-medium tabular-nums">{display(selectedStats.upperOutlierFence)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Sample variance</p><p className="font-medium tabular-nums">{display(selectedStats.sampleVariance)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Distinct values</p><p className="font-medium tabular-nums">{selectedStats.distinctCount.toLocaleString('id-ID')}</p></div>
                  </div>
                  <div className="space-y-3">
                    {histogram.map((bin) => (
                      <div key={bin.index} className="grid grid-cols-[104px_minmax(0,1fr)_36px] items-center gap-2 text-xs">
                        <span className="truncate text-muted-foreground">{formatNumber(bin.start)}–{formatNumber(bin.end)}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-brand" style={{ width: (bin.count / maxBinCount * 100) + '%' }} />
                        </div>
                        <span className="text-right tabular-nums">{bin.count}</span>
                      </div>
                    ))}
                    {!histogram.length ? <p className="text-sm text-muted-foreground">No valid numeric values for this field.</p> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">Outlier rule: values below Q1 − 1.5 × IQR or above Q3 + 1.5 × IQR. Flagged values are identified, not removed.</p>
                </div>
              ) : null}
            </section>
          </div>
        </>
      )}
    </PageContainer>
  )
}
