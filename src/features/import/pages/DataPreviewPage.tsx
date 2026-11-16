import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChartNoAxesCombined, Info, LayoutDashboard, SlidersHorizontal, Table2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useDashboardStore } from '@/state/dashboard-store'
import type { ColumnType } from '@/domain/dataset.types'
import { formatRelativeTime } from '@/lib/formatters'
import { DatasetSummary } from '../components/DatasetSummary'
import { DatasetWarnings } from '../components/DatasetWarnings'
import { DataPreviewTable } from '../components/DataPreviewTable'
import { ColumnProfileList } from '../components/ColumnProfileList'
import { useDatasetAutosave, useStoredDataset } from '../hooks/useStoredDataset'

export function DataPreviewPage() {
  const { datasetId } = useParams<{ datasetId: string }>()
  const navigate = useNavigate()
  const {
    updateColumnType,
    updateColumnDisplayName,
    createDashboard,
  } = useDashboardStore()

  const { dataset, status } = useStoredDataset(datasetId)
  useDatasetAutosave(dataset)

  if (status === 'loading') {
    return (
      <PageContainer>
        <LoadingState label="Memuat dataset…" />
      </PageContainer>
    )
  }

  if (!dataset) {
    return (
      <PageContainer>
        <EmptyState
          icon={Info}
          title="Dataset tidak ditemukan"
          description="Dataset ini tidak ada di penyimpanan browser. Mungkin sudah dihapus atau dibuat di tab lain."
          action={
            <Button asChild>
              <Link to="/">Kembali ke Beranda</Link>
            </Button>
          }
        />
      </PageContainer>
    )
  }

  const handleCreateDashboard = () => {
    const dashboard = createDashboard(dataset)
    toast.success('Dashboard dibuat', {
      description: 'KPI dan grafik awal sudah disiapkan dari data Anda.',
    })
    navigate('/builder/' + dashboard.id)
  }

  const handleTypeChange = (columnId: string, type: ColumnType) => {
    updateColumnType(dataset.id, columnId, type)
  }

  const handleDisplayNameChange = (columnId: string, displayName: string) => {
    updateColumnDisplayName(dataset.id, columnId, displayName)
    toast.success('Nama kolom diperbarui')
  }

  return (
    <PageContainer wide>
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/">
          <ArrowLeft className="size-4" />
          Beranda
        </Link>
      </Button>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{dataset.name}</h1>
            <Badge variant="outline">{dataset.sourceFileType.toUpperCase()}</Badge>
            {dataset.sourceSheetName ? (
              <Badge variant="outline">Sheet: {dataset.sourceSheetName}</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {dataset.sourceFileName} · diperbarui {formatRelativeTime(dataset.updatedAt)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to={'/transform/' + dataset.id}>
              <SlidersHorizontal className="size-4" />
              Transformasi
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={'/pivot/' + dataset.id}>
              <Table2 className="size-4" />
              Pivot table
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={'/statistics/' + dataset.id}>
              <ChartNoAxesCombined className="size-4" />
              Statistical analysis
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">Ganti file</Link>
          </Button>
          <Button onClick={handleCreateDashboard}>
            <LayoutDashboard className="size-4" />
            Buat Dashboard
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <DatasetSummary dataset={dataset} />
      </div>

      <DatasetWarnings warnings={dataset.warnings} />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Preview data</h2>
            <span className="text-xs text-muted-foreground">Nilai sumber tidak diubah</span>
          </div>
          <DataPreviewTable dataset={dataset} />
        </section>

        <section className="min-w-0">
          <ColumnProfileList
            columns={dataset.columns}
            onTypeChange={handleTypeChange}
            onDisplayNameChange={handleDisplayNameChange}
          />
        </section>
      </div>
    </PageContainer>
  )
}
