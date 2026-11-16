import { LineChart, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DashboardToolbar({
  kpiCount,
  chartCount,
  onAddKpi,
  onAddChart,
}: {
  kpiCount: number
  chartCount: number
  onAddKpi: () => void
  onAddChart: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={onAddKpi}>
        <Plus className="size-4" />
        Tambah KPI
      </Button>
      <Button size="sm" variant="outline" onClick={onAddChart}>
        <LineChart className="size-4" />
        Tambah grafik
      </Button>
      <span className="text-xs text-muted-foreground">
        {kpiCount} KPI · {chartCount} grafik
      </span>
    </div>
  )
}
