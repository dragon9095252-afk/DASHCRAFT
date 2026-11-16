import { useEffect, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function SheetSelectorDialog({
  open,
  fileName,
  sheets,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  fileName: string
  sheets: string[]
  onOpenChange: (open: boolean) => void
  onConfirm: (sheetName: string) => void
}) {
  const [selected, setSelected] = useState(sheets[0] ?? '')

  useEffect(() => {
    setSelected(sheets[0] ?? '')
  }, [sheets])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pilih worksheet</DialogTitle>
          <DialogDescription>
            File <span className="font-medium text-foreground">{fileName}</span> memiliki beberapa
            worksheet. Satu dashboard menggunakan satu worksheet.
          </DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Daftar worksheet" className="space-y-2">
          {sheets.map((sheet) => (
            <label
              key={sheet}
              className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-secondary/60 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
            >
              <input
                type="radio"
                name="worksheet"
                value={sheet}
                checked={selected === sheet}
                onChange={() => setSelected(sheet)}
                className="size-4 accent-[var(--brand)]"
              />
              <FileSpreadsheet className="size-4 text-muted-foreground" />
              <span className="font-medium">{sheet}</span>
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={() => onConfirm(selected)} disabled={!selected}>
            Gunakan sheet ini
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
