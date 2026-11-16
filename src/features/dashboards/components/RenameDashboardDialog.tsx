import { useEffect, useState } from 'react'
import type { StoredDashboard } from '@/db/database'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export function RenameDashboardDialog({
  dashboard,
  onOpenChange,
  onRename,
}: {
  dashboard: StoredDashboard | null
  onOpenChange: (open: boolean) => void
  onRename: (name: string) => Promise<void>
}) {
  const [name, setName] = useState('')

  useEffect(() => {
    setName(dashboard?.name ?? '')
  }, [dashboard])

  const trimmed = name.trim()

  return (
    <Dialog open={dashboard !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (trimmed) void onRename(trimmed)
          }}
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>Ganti nama dashboard</DialogTitle>
            <DialogDescription>
              Nama baru langsung tersimpan di browser ini.
            </DialogDescription>
          </DialogHeader>

          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Nama dashboard"
            placeholder="Nama dashboard"
          />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Batal
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!trimmed}>
              Simpan nama
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
