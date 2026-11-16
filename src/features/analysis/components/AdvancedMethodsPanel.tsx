import { useMemo, useState } from 'react'
import {
  Activity, BarChart3, BrainCircuit, CalendarClock, FlaskConical,
  Info, LineChart, Target,
} from 'lucide-react'
import type { Dataset } from '@/domain/dataset.types'
import {
  forecastTimeSeries,
  runChiSquareTest,
  runWelchTTest,
  trainPredictiveRegression,
} from '@/services/advanced-methods.service'

function format(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(value)
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
  emptyLabel = 'Select field',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ id: string; name: string }>
  emptyLabel?: string
}) {
  return (
    <label className="grid gap-1.5 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <select
        className="h-9 min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  )
}

function Metric({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description?: string
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {description ? <p className="mt-1 text-[10px] text-muted-foreground">{description}</p> : null}
    </div>
  )
}

export function AdvancedMethodsPanel({ dataset }: { dataset: Dataset }) {
  const numeric = dataset.columns.filter((column) => column.type === 'number')
  const categorical = dataset.columns.filter((column) => column.type === 'text' || column.type === 'boolean')
  const dates = dataset.columns.filter((column) => column.type === 'date')
  const numericOptions = numeric.map((column) => ({ id: column.id, name: column.displayName }))
  const categoryOptions = categorical.map((column) => ({ id: column.id, name: column.displayName }))
  const dateOptions = dates.map((column) => ({ id: column.id, name: column.displayName }))

  const [welchLeft, setWelchLeft] = useState(numeric[0]?.id ?? '')
  const [welchRight, setWelchRight] = useState(numeric[1]?.id ?? '')
  const [chiLeft, setChiLeft] = useState(categorical[0]?.id ?? '')
  const [chiRight, setChiRight] = useState(categorical[1]?.id ?? '')
  const [dateId, setDateId] = useState(dates[0]?.id ?? '')
  const [forecastTargetId, setForecastTargetId] = useState(numeric[0]?.id ?? '')
  const [horizon, setHorizon] = useState('6')
  const [modelTargetId, setModelTargetId] = useState(numeric[0]?.id ?? '')
  const [featureIds, setFeatureIds] = useState<string[]>(numeric.slice(1, 5).map((column) => column.id))

  const welch = useMemo(
    () => welchLeft && welchRight ? runWelchTTest(dataset, welchLeft, welchRight) : null,
    [dataset, welchLeft, welchRight],
  )
  const chiSquare = useMemo(
    () => chiLeft && chiRight ? runChiSquareTest(dataset, chiLeft, chiRight) : null,
    [dataset, chiLeft, chiRight],
  )
  const forecast = useMemo(
    () => dateId && forecastTargetId
      ? forecastTimeSeries(dataset, dateId, forecastTargetId, Number(horizon))
      : null,
    [dataset, dateId, forecastTargetId, horizon],
  )
  const selectedFeatures = featureIds.filter((id) => id !== modelTargetId)
  const model = useMemo(
    () => modelTargetId
      ? trainPredictiveRegression(dataset, modelTargetId, selectedFeatures)
      : null,
    [dataset, modelTargetId, featureIds],
  )

  const toggleFeature = (id: string, checked: boolean) => {
    setFeatureIds((current) => checked
      ? [...current, id]
      : current.filter((item) => item !== id))
  }

  const forecastRows = forecast?.points.slice(-Math.min(10, forecast.points.length)) ?? []

  return (
    <div className="mt-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-brand" />
          <h2 className="text-base font-semibold">Statistical inference</h2>
          <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">Interactive</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Test a defined statistical question rather than treating descriptive patterns as proof.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Activity className="size-4 text-brand" />
            <div><h3 className="text-sm font-semibold">Welch two-sample t-test</h3><p className="text-[11px] text-muted-foreground">Compares means while allowing unequal variances</p></div>
          </div>
          <div className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldSelect label="Sample / numeric field A" value={welchLeft} onChange={setWelchLeft} options={numericOptions} />
              <FieldSelect label="Sample / numeric field B" value={welchRight} onChange={setWelchRight} options={numericOptions} />
            </div>
            {welch ? (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Metric label="Mean A" value={format(welch.leftMean)} />
                  <Metric label="Mean B" value={format(welch.rightMean)} />
                  <Metric label="t statistic" value={format(welch.tStatistic)} />
                  <Metric label="p-value" value={format(welch.pValue, 5)} />
                </div>
                <div className="rounded-lg border p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">95% confidence interval for mean difference</span>
                    <span className={welch.significantAt05 ? 'font-semibold text-brand' : 'font-semibold text-muted-foreground'}>
                      {welch.significantAt05 ? 'Statistically significant at 5%' : 'Not significant at 5%'}
                    </span>
                  </div>
                  <p className="mt-1 font-mono tabular-nums">[{format(welch.confidenceInterval95[0])}, {format(welch.confidenceInterval95[1])}]</p>
                  <p className="mt-1 text-muted-foreground">nA={welch.leftN} · nB={welch.rightN} · df={format(welch.degreesOfFreedom)}</p>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{welch.warning}</p>
              </>
            ) : <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">Choose two distinct numeric columns, each with at least two valid observations and non-zero variance.</p>}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <BarChart3 className="size-4 text-brand" />
            <div><h3 className="text-sm font-semibold">Chi-square independence test</h3><p className="text-[11px] text-muted-foreground">Checks association between categorical fields</p></div>
          </div>
          <div className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldSelect label="Category field A" value={chiLeft} onChange={setChiLeft} options={categoryOptions} />
              <FieldSelect label="Category field B" value={chiRight} onChange={setChiRight} options={categoryOptions} />
            </div>
            {chiSquare ? (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Metric label="Chi-square" value={format(chiSquare.chiSquare)} />
                  <Metric label="Degrees of freedom" value={String(chiSquare.degreesOfFreedom)} />
                  <Metric label="p-value" value={format(chiSquare.pValue, 5)} />
                  <Metric label="Valid pairs" value={String(chiSquare.observations)} />
                </div>
                <p className="text-xs">
                  {chiSquare.pValue < 0.05
                    ? 'Evidence of association at the 5% significance level.'
                    : 'Insufficient evidence of association at the 5% significance level.'}
                </p>
                <p className="text-[11px] text-muted-foreground">Minimum expected count: {format(chiSquare.minimumExpectedCount)} · cells below 5: {chiSquare.cellsBelowFive}</p>
                {chiSquare.warning ? <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-[11px] leading-relaxed text-warning">{chiSquare.warning}</p> : null}
              </>
            ) : <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">Choose two different text or boolean fields with at least two categories each.</p>}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <CalendarClock className="size-4 text-brand" />
          <div><h3 className="text-sm font-semibold">Time-series forecasting</h3><p className="text-[11px] text-muted-foreground">Holt linear trend with a chronological holdout backtest</p></div>
        </div>
        <div className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <FieldSelect label="Date field" value={dateId} onChange={setDateId} options={dateOptions} />
            <FieldSelect label="Measure to forecast" value={forecastTargetId} onChange={setForecastTargetId} options={numericOptions} />
            <label className="grid gap-1.5 text-xs"><span className="font-medium text-muted-foreground">Forecast horizon</span>
              <select className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm" value={horizon} onChange={(event) => setHorizon(event.target.value)}>
                {[3, 6, 9, 12, 18, 24].map((value) => <option key={value} value={value}>{value} future periods</option>)}
              </select>
            </label>
          </div>
          {forecast ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                <Metric label="Observations" value={String(forecast.observations)} />
                <Metric label="Cadence" value={forecast.cadenceDays + ' days'} />
                <Metric label="Backtest MAE" value={format(forecast.backtest.mae)} />
                <Metric label="Backtest RMSE" value={format(forecast.backtest.rmse)} />
                <Metric label="Backtest MAPE" value={forecast.backtest.mape === null ? '—' : format(forecast.backtest.mape, 1) + '%'} />
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[420px] text-xs">
                  <thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-3 py-2 text-left font-medium">Period</th><th className="px-3 py-2 text-right font-medium">Value</th><th className="px-3 py-2 text-right font-medium">Type</th></tr></thead>
                  <tbody>{forecastRows.map((point) => <tr key={point.date} className="border-t"><td className="px-3 py-2">{new Date(point.date).toLocaleDateString('id-ID')}</td><td className="px-3 py-2 text-right font-medium tabular-nums">{format(point.value)}</td><td className="px-3 py-2 text-right"><span className={point.kind === 'forecast' ? 'font-semibold text-brand' : 'text-muted-foreground'}>{point.kind === 'forecast' ? 'Forecast' : 'Actual'}</span></td></tr>)}</tbody>
                </table>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{forecast.method}. Dates are advanced using the median observed interval ({forecast.cadenceDays} days); multiple records on the same date are averaged. Backtest errors are in target units.</p>
            </>
          ) : <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">Select a date column and numeric measure with at least eight distinct valid dates and values.</p>}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <BrainCircuit className="size-4 text-brand" />
          <div><h3 className="text-sm font-semibold">Predictive machine learning</h3><p className="text-[11px] text-muted-foreground">Ridge regression with a deterministic holdout evaluation</p></div>
        </div>
        <div className="space-y-4 p-4">
          <FieldSelect label="Target variable to predict" value={modelTargetId} onChange={setModelTargetId} options={numericOptions} />
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Predictor features (up to 8 are used)</p>
            <div className="flex flex-wrap gap-2">
              {numeric.filter((column) => column.id !== modelTargetId).map((column) => (
                <label key={column.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                  <input type="checkbox" checked={selectedFeatures.includes(column.id)} onChange={(event) => toggleFeature(column.id, event.target.checked)} />
                  {column.displayName}
                </label>
              ))}
              {!numeric.some((column) => column.id !== modelTargetId) ? <p className="text-xs text-muted-foreground">A second numeric column is required as a feature.</p> : null}
            </div>
          </div>
          {model ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Training rows" value={String(model.trainSize)} />
                <Metric label="Test rows" value={String(model.testSize)} />
                <Metric label="Test MAE" value={format(model.mae)} />
                <Metric label="Test R²" value={format(model.rSquared)} description="May be negative when predictions underperform the test mean" />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <h4 className="text-xs font-semibold">Model coefficients</h4>
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">Intercept</span><span className="font-mono tabular-nums">{format(model.intercept)}</span></div>
                    {model.coefficients.map((item) => <div key={item.name} className="flex justify-between gap-3 text-xs"><span>{item.name}</span><span className="font-mono tabular-nums">{format(item.coefficient)}</span></div>)}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <h4 className="text-xs font-semibold">Holdout predictions</h4>
                  <div className="mt-2 max-h-48 space-y-2 overflow-auto">
                    {model.predictions.slice(0, 12).map((item, index) => <div key={index} className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">Actual {format(item.actual)}</span><span className="font-mono tabular-nums">Predicted {format(item.predicted)}</span></div>)}
                  </div>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{model.method}. Only numeric predictors are supported in this initial supervised model. Train/test split is deterministic and random, not time-aware; use chronological validation for time-dependent targets.</p>
            </>
          ) : <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">Choose a numeric target and at least one numeric feature. The model needs at least 12 valid target observations and sufficient training rows.</p>}
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-xl border border-dashed p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-brand" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Inference assumes observations meet the selected test's sampling design. Forecasts extrapolate a smooth trend and do not model seasonality. Predictive regression reports held-out error, but a single split is not a substitute for cross-validation or monitoring. These methods are exploratory decision support, not guarantees.
        </p>
      </div>
    </div>
  )
}
