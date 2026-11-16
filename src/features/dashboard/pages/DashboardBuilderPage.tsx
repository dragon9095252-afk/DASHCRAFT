import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Info, LayoutDashboard, LineChart } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { DashboardToolbar } from '../components/DashboardToolbar'
import { DashboardHeader } from '../components/DashboardHeader'
import { DashboardVisualGrid } from '../components/DashboardVisualGrid'
import { GlobalFilterBar } from '../components/GlobalFilterBar'
import { WidgetEditorPanel } from '../components/WidgetEditorPanel'
import { useDashboardExport } from '../hooks/useDashboardExport'
import { useDashboardWorkspace } from '../hooks/useDashboardWorkspace'

export function DashboardBuilderPage() {
  const workspace = useDashboardWorkspace()
  const exportRef = useRef<HTMLDivElement>(null)
  const exportState = useDashboardExport({
    dashboard: workspace.dashboard ?? null,
    dataset: workspace.dataset ?? null,
    filteredRows: workspace.filteredRows,
    targetRef: exportRef,
  })

  if (workspace.hydrationStatus === 'loading') {
    return (
      <PageContainer>
        <LoadingState label="Memuat dashboard…" />
      </PageContainer>
    )
  }

  if (!workspace.dashboard && workspace.hydrationStatus !== 'missing-dataset') {
    return (
      <PageContainer>
        <EmptyState
          icon={LayoutDashboard}
          title="Dashboard tidak ditemukan"
          description="Dashboard ini tidak ada di penyimpanan browser. Mungkin sudah dihapus atau dibuat di tab lain."
          action={
            <Button asChild>
              <Link to="/">Kembali ke Beranda</Link>
            </Button>
          }
        />
      </PageContainer>
    )
  }

  if (!workspace.dataset || !workspace.dashboard) {
    return (
      <PageContainer>
        <EmptyState
          icon={Info}
          title="Dataset tidak ditemukan"
          description="Dashboard tersimpan, tetapi dataset sumbernya tidak ditemukan. Unggah ulang file untuk membuat dashboard baru."
          action={
            <Button asChild>
              <Link to="/">Unggah file</Link>
            </Button>
          }
        />
      </PageContainer>
    )
  }

  const dashboard = workspace.dashboard
  const dataset = workspace.dataset
  const { editingWidget, pendingDelete } = workspace

  return (
    <PageContainer wide>
      <div ref={exportRef}>
        <DashboardHeader
          dashboardName={dashboard.name}
          datasetId={dataset.id}
          sourceFileName={dataset.sourceFileName}
          rowCount={dataset.rowCount}
          widgetCount={dashboard.widgets.length}
          filteredRowCount={workspace.filteredRows.length}
          hasActiveFilters={workspace.activeFilterCount > 0}
          isDirty={workspace.isDirty}
          isPersisted={workspace.isPersisted}
          isSaving={workspace.saving}
          onSave={() => void workspace.saveDashboard()}
          exportBusy={exportState.busy}
          canExportImage={exportState.canExportImage}
          canExportCsv={exportState.canExportCsv}
          onExport={(format) => void exportState.exportAs(format)}
        />

        <div className="mt-5" data-export-exclude>
          <DashboardToolbar
            kpiCount={workspace.kpiWidgets.length}
            chartCount={workspace.chartWidgets.length}
            onAddKpi={workspace.addKpi}
            onAddChart={workspace.addChart}
          />
        </div>

        <div className="mt-3">
          <GlobalFilterBar
            filters={dashboard.filters}
            columns={dataset.columns}
            rows={dataset.rows}
            state={workspace.filterState}
            onChange={workspace.updateFilters}
            onReset={workspace.resetFilters}
          />
        </div>

        {dashboard.widgets.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={LineChart}
              title="Belum ada visual"
              description="Tambahkan KPI atau grafik untuk mulai membangun dashboard dari data Anda."
              action={
                <div className="flex gap-2">
                  <Button onClick={workspace.addKpi}>Tambah KPI</Button>
                  <Button variant="outline" onClick={workspace.addChart}>
                    Tambah grafik
                  </Button>
                </div>
              }
            />
          </div>
        ) : (
          <DashboardVisualGrid
            kpiWidgets={workspace.kpiWidgets}
            chartWidgets={workspace.chartWidgets}
            columns={dataset.columns}
            rows={workspace.filteredRows}
            selectedWidgetId={workspace.selectedWidgetId}
            onSelect={workspace.openEditor}
            onDuplicate={workspace.duplicateWidget}
            onMove={workspace.moveWidget}
            onDelete={workspace.requestDelete}
          />
        )}
      </div>

      {editingWidget ? (
        <WidgetEditorPanel
          widget={editingWidget}
          columns={dataset.columns}
          onChange={workspace.updateWidget}
          onClose={workspace.closeEditor}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) workspace.cancelDelete()
        }}
        title="Hapus visual?"
        description={`“${pendingDelete?.title ?? 'Visual'}” akan dihapus dari dashboard ini.`}
        onConfirm={workspace.confirmDelete}
      />
    </PageContainer>
  )
}
