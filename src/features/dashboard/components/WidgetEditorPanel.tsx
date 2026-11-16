import type { DatasetColumn } from '@/domain/dataset.types'
import type { DashboardWidget } from '@/domain/dashboard.types'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ChartEditorFields } from './editor/ChartEditorFields'
import { EditorField } from './editor/EditorField'
import { KpiEditorFields } from './editor/KpiEditorFields'
import { WidgetProblems } from './editor/WidgetProblems'

export function WidgetEditorPanel({
  widget,
  columns,
  onChange,
  onClose,
}: {
  widget: DashboardWidget
  columns: DatasetColumn[]
  onChange: (widget: DashboardWidget) => void
  onClose: () => void
}) {
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{widget.kind === 'kpi' ? 'Edit KPI' : 'Edit grafik'}</SheetTitle>
          <SheetDescription>Perubahan langsung diterapkan ke dashboard.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-8">
          <EditorField label="Judul">
            <Input
              value={widget.title}
              onChange={(event) => onChange({ ...widget, title: event.target.value })}
              placeholder="Judul visual"
            />
          </EditorField>

          {widget.kind === 'kpi' ? (
            <KpiEditorFields widget={widget} columns={columns} onChange={onChange} />
          ) : (
            <ChartEditorFields widget={widget} columns={columns} onChange={onChange} />
          )}

          <WidgetProblems widget={widget} columns={columns} />

          {widget.description ? (
            <div className="rounded-lg border bg-secondary/40 p-3">
              <p className="text-[11px] font-medium text-muted-foreground">
                Alasan rekomendasi
              </p>
              <p className="mt-1 text-xs leading-relaxed text-foreground">
                {widget.description}
              </p>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
