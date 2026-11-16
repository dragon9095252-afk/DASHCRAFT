import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  Save,
} from 'lucide-react'
import type { ExportFormat } from '@/services/export.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface DashboardHeaderProps {
  dashboardName: string
  datasetId: string
  sourceFileName: string
  rowCount: number
  widgetCount: number
  filteredRowCount: number
  hasActiveFilters: boolean
  isDirty: boolean
  isPersisted: boolean
  isSaving: boolean
  onSave: () => void
  exportBusy: ExportFormat | null
  canExportImage: boolean
  canExportCsv: boolean
  onExport: (format: ExportFormat) => void
}

export function DashboardHeader({
  dashboardName,
  datasetId,
  sourceFileName,
  rowCount,
  widgetCount,
  filteredRowCount,
  hasActiveFilters,
  isDirty,
  isPersisted,
  isSaving,
  onSave,
  exportBusy,
  canExportImage,
  canExportCsv,
  onExport,
}: DashboardHeaderProps) {
  const badgeLabel = isDirty ? 'Belum disimpan' : isPersisted ? 'Tersimpan' : 'Sesi ini'
  const badgeClass = isDirty
    ? 'border-warning/30 bg-warning-soft text-warning'
    : 'border-brand/20 bg-brand-soft text-brand'

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="-ml-2"
        data-export-exclude
      >
        <Link to={`/data-preview/${datasetId}`}>
          <ArrowLeft className="size-4" />
          Data & preview
        </Link>
      </Button>

      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {dashboardName}
            </h1>
            <Badge variant="outline" className={badgeClass}>
              {badgeLabel}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {sourceFileName} · {rowCount} baris ·{' '}
            {hasActiveFilters
              ? `${filteredRowCount} baris setelah filter`
              : `${widgetCount} visual`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2" data-export-exclude>
          <Button variant="outline" onClick={onSave} disabled={!isDirty || isSaving}>
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {isSaving ? 'Menyimpan…' : 'Simpan'}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={exportBusy !== null}>
                {exportBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {exportBusy ? 'Mengekspor…' : 'Ekspor'}
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                disabled={!canExportImage || exportBusy !== null}
                onSelect={() => onExport('png')}
              >
                <ImageIcon className="size-3.5" />
                Ekspor PNG
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canExportImage || exportBusy !== null}
                onSelect={() => onExport('pdf')}
              >
                <FileText className="size-3.5" />
                Ekspor PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!canExportCsv || exportBusy !== null}
                onSelect={() => onExport('csv')}
              >
                <FileSpreadsheet className="size-3.5" />
                Unduh CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  )
}
