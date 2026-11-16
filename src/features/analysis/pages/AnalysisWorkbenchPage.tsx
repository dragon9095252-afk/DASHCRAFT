import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Activity, AlertTriangle, ArrowLeft, BrainCircuit, CheckCircle2, Download,
  Gauge, GitBranch, Layers3, Network, RefreshCw, ShieldCheck, Sparkles,
} from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useStoredDataset } from '@/features/import/hooks/useStoredDataset'
import { analyzeAdvancedDataset } from '@/services/advanced-analytics.service'

function number(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(value)
}

function csv(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  const safe = /^[\s\uFEFF]*[=+@-]/.test(text) ? "'" + text : text
  return /[",\\n\\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
}

const severityStyle = {
  critical: 'border-destructive/30 bg-destructive/5 text-destructive',
  warning: 'border-warning/30 bg-warning/5 text-warning',
  info: 'border-border bg-card text-foreground',
}

export function AnalysisWorkbenchPage() {
  const { datasetId } = useParams<{ datasetId: string }>()
  const { dataset, status } = useStoredDataset(datasetId)
  const [revision, setRevision] = useState(0)
  const report = useMemo(
    () => dataset ? analyzeAdvancedDataset(dataset) : null,
    [dataset, revision],
  )

  if (status === 'loading') {
    return <PageContainer><LoadingState label="Preparing analysis workspace…" /></PageContainer>
  }
  if (!dataset || !report) {
    return (
      <PageContainer>
        <EmptyState
          icon={Activity}
          title="Dataset not found"
          description="Import a CSV or Excel file first, then open its analysis workspace."
          action={<Button asChild><Link to="/">Back to import</Link></Button>}
        />
      </PageContainer>
    )
  }

  const exportReport = () => {
    const headers = [
      'Column', 'Type', 'Valid', 'Missing', 'Invalid', 'Distinct', 'Missing rate',
      'Min', 'Max', 'Mean', 'Median', 'Std dev', 'Q1', 'Q3', 'IQR outliers',
    ]
    const lines = [
      headers.map(csv).join(','),
      ...report.columns.map((column) => [
        column.name, column.type, column.validCount, column.missingCount,
        column.invalidCount, column.distinctCount, column.missingRate,
        column.min, column.max, column.mean, column.median,
        column.standardDeviation, column.q1, column.q3, column.outlierCount,
      ].map(csv).join(',')),
    ]
    const blob = new Blob(['\\uFEFF' + lines.join('\\r\\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'analysis-' + dataset.name.replace(/[^a-z0-9-_]+/gi, '-') + '.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const criticalCount = report.insights.filter((item) => item.level === 'critical').length
  const warningCount = report.insights.filter((item) => item.level === 'warning').length

  return (
    <PageContainer wide>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link to={'/data-preview/' + dataset.id}><ArrowLeft className="size-4" /> Dataset</Link>
          </Button>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5"><ShieldCheck className="size-3" /> Local analysis</Badge>
            <Badge variant="secondary">Deterministic engine</Badge>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Advanced Analysis Workbench</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Automated exploratory analysis for <span className="font-medium text-foreground">{dataset.name}</span>.
            Profile data quality, inspect relationships, fit simple models and segment complete numeric records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setRevision((value) => value + 1)}>
            <RefreshCw className="size-4" /> Run again
          </Button>
          <Button onClick={exportReport}><Download className="size-4" /> Export profile CSV</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Data quality indicator</span><Gauge className="size-4" /></div>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{report.qualityScore}<span className="ml-1 text-sm font-normal text-muted-foreground">/ 100</span></p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-brand" style={{ width: report.qualityScore + '%' }} /></div>
          <p className="mt-2 text-xs text-muted-foreground">Heuristic score, not a certification</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Records & fields</span><DatabaseIcon /></div>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{report.rowCount.toLocaleString('id-ID')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{report.columnCount} columns · {report.numericColumnCount} numeric · {report.dateColumnCount} date</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Completeness</span><CheckCircle2 className="size-4" /></div>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{number(report.completenessRate * 100, 1)}<span className="ml-1 text-sm font-normal text-muted-foreground">%</span></p>
          <p className="mt-1 text-xs text-muted-foreground">{report.missingCells.toLocaleString('id-ID')} missing cells detected</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Review queue</span><AlertTriangle className="size-4" /></div>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{report.insights.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">{criticalCount} critical · {warningCount} warning · {report.duplicateRows} duplicate rows</p>
        </div>
      </div>

      <section className="mt-6 rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex items-center gap-2"><Sparkles className="size-4 text-brand" /><h2 className="text-sm font-semibold">Automated findings</h2></div>
          <Badge variant="outline">{report.insights.length} findings</Badge>
        </div>
        <div className="grid gap-2 p-3 md:grid-cols-2">
          {report.insights.map((item) => (
            <article key={item.id} className={'rounded-lg border p-3 ' + severityStyle[item.level]}>
              <div className="flex items-start gap-2">
                {item.level === 'critical' ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : item.level === 'warning' ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <Activity className="mt-0.5 size-4 shrink-0" />}
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed opacity-80">{item.detail}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2"><Layers3 className="size-4 text-brand" /><h2 className="text-sm font-semibold">Column profiling & data quality</h2></div>
          <p className="mt-1 text-xs text-muted-foreground">Validation uses each column’s detected type. Missing and invalid values remain in the source dataset.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Field</th>
                <th className="px-3 py-3 text-right font-medium">Valid</th>
                <th className="px-3 py-3 text-right font-medium">Missing</th>
                <th className="px-3 py-3 text-right font-medium">Invalid</th>
                <th className="px-3 py-3 text-right font-medium">Distinct</th>
                <th className="px-3 py-3 text-right font-medium">Mean</th>
                <th className="px-3 py-3 text-right font-medium">Median</th>
                <th className="px-3 py-3 text-right font-medium">Min / Max</th>
                <th className="px-4 py-3 text-left font-medium">Most frequent values</th>
              </tr>
            </thead>
            <tbody>
              {report.columns.map((column) => (
                <tr key={column.columnId} className="border-t align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{column.name}</p>
                    <Badge variant="outline" className="mt-1">{column.type}</Badge>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{column.validCount}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{column.missingCount}<p className="text-[10px] text-muted-foreground">{number(column.missingRate * 100, 1)}%</p></td>
                  <td className="px-3 py-3 text-right tabular-nums">{column.invalidCount}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{column.distinctCount}<p className="text-[10px] text-muted-foreground">{number(column.uniquenessRate * 100, 1)}% unique</p></td>
                  <td className="px-3 py-3 text-right tabular-nums">{number(column.mean)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{number(column.median)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{number(column.min)} / {number(column.max)}{column.outlierCount > 0 ? <p className="text-[10px] text-warning">{column.outlierCount} IQR outliers</p> : null}</td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-[260px] flex-wrap gap-1">
                      {column.topValues.slice(0, 4).map((item) => <Badge key={item.label} variant="secondary" title={item.label}>{item.label.length > 18 ? item.label.slice(0, 18) + '…' : item.label} · {item.count}</Badge>)}
                      {!column.topValues.length ? <span className="text-xs text-muted-foreground">No values</span> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <div className="flex items-center gap-2"><Network className="size-4 text-brand" /><h2 className="text-sm font-semibold">Variable relationships</h2></div>
            <p className="mt-1 text-xs text-muted-foreground">Pearson correlation uses pairwise complete observations. Association is not causation.</p>
          </div>
          <div className="space-y-3 p-4">
            {report.correlations.slice(0, 8).map((item) => (
              <div key={item.leftColumnId + item.rightColumnId}>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-medium">{item.leftName} ↔ {item.rightName}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{number(item.coefficient, 3)}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                  <div className={'h-full rounded-full ' + (item.coefficient >= 0 ? 'bg-brand' : 'bg-orange-500')} style={{ width: Math.abs(item.coefficient) * 100 + '%' }} />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">{item.sampleSize} paired rows · {item.coefficient >= 0 ? 'positive' : 'negative'} association</p>
              </div>
            ))}
            {!report.correlations.length ? <p className="text-sm text-muted-foreground">At least two numeric fields with three valid paired rows are required.</p> : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <div className="flex items-center gap-2"><GitBranch className="size-4 text-brand" /><h2 className="text-sm font-semibold">Simple linear models</h2></div>
            <p className="mt-1 text-xs text-muted-foreground">Exploratory one-predictor OLS models ranked by R². Not causal or validated forecasts.</p>
          </div>
          <div className="space-y-3 p-4">
            {report.regressions.slice(0, 5).map((model) => (
              <article key={model.predictorId + model.targetId} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold">{model.targetName} from {model.predictorName}</p>
                  <Badge variant="secondary">R² {number(model.rSquared, 3)}</Badge>
                </div>
                <p className="mt-2 break-all font-mono text-xs text-muted-foreground">y = {number(model.slope, 4)}x {model.intercept < 0 ? '−' : '+'} {number(Math.abs(model.intercept), 4)}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{model.sampleSize} complete observations</p>
              </article>
            ))}
            {!report.regressions.length ? <p className="text-sm text-muted-foreground">No eligible pair of numeric fields with variation was found.</p> : null}
          </div>
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2"><BrainCircuit className="size-4 text-brand" /><h2 className="text-sm font-semibold">Unsupervised segmentation</h2></div>
          <p className="mt-1 text-xs text-muted-foreground">K-means groups complete numeric records after standardization. Centroids are shown in original units.</p>
        </div>
        {report.clusters.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr><th className="px-4 py-3 text-left font-medium">Segment</th><th className="px-3 py-3 text-right font-medium">Records</th><th className="px-3 py-3 text-right font-medium">Share</th>{report.clusterFeatureNames.map((name) => <th key={name} className="px-3 py-3 text-right font-medium">{name} centroid</th>)}</tr>
              </thead>
              <tbody>
                {report.clusters.map((cluster) => (
                  <tr key={cluster.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{cluster.label}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{cluster.count}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{number(cluster.share * 100, 1)}%</td>
                    {report.clusterFeatureNames.map((name) => <td key={name} className="px-3 py-3 text-right tabular-nums">{number(cluster.centroid[name])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-3 text-xs text-muted-foreground">Only {report.clusters.reduce((sum, cluster) => sum + cluster.count, 0)} complete records were clustered. Rows with missing or invalid numeric features are excluded from this step only.</p>
          </div>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">Segmentation needs at least two numeric fields and six complete records. No source rows are removed.</div>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-dashed p-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-brand" /> What runs automatically—and what does not</div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Column profiling, missing/invalid checks, duplicate detection, IQR outlier screening, Pearson correlation,
          simple linear regression and K-means segmentation run automatically in this browser. The engine does not
          change or delete the source data, choose a business objective, prove causality, or know whether an outlier is
          actually an error. You decide which findings matter and approve any cleaning or modeling decisions.
        </p>
      </section>
    </PageContainer>
  )
}

function DatabaseIcon() {
  return <Layers3 className="size-4" />
}
