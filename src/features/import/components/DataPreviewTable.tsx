import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Dataset } from '@/domain/dataset.types'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCellValue } from '@/lib/formatters'

const PAGE_SIZE = 50

export function DataPreviewTable({ dataset }: { dataset: Dataset }) {
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(dataset.rows.length / PAGE_SIZE))

  useEffect(() => {
    setPage(0)
  }, [dataset.id])

  const currentPage = Math.min(page, totalPages - 1)
  const pageRows = useMemo(
    () => dataset.rows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE),
    [dataset.rows, currentPage],
  )

  const start = dataset.rows.length === 0 ? 0 : currentPage * PAGE_SIZE + 1
  const end = Math.min((currentPage + 1) * PAGE_SIZE, dataset.rows.length)

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="max-h-[560px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead className="w-12 text-right text-xs">#</TableHead>
              {dataset.columns.map((column) => (
                <TableHead key={column.id} className="whitespace-nowrap text-xs">
                  {column.displayName}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row, rowIndex) => (
              <TableRow key={`${currentPage}-${rowIndex}`}>
                <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                  {currentPage * PAGE_SIZE + rowIndex + 1}
                </TableCell>
                {dataset.columns.map((column) => {
                  const value = row[column.id]
                  const text = formatCellValue(value)
                  return (
                    <TableCell
                      key={column.id}
                      className="max-w-[240px] truncate whitespace-nowrap text-sm"
                      title={text}
                    >
                      {text === '' ? (
                        <span className="text-muted-foreground/60">–</span>
                      ) : (
                        text
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Menampilkan {start}–{end} dari {dataset.rows.length} baris · {PAGE_SIZE} baris/halaman
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="size-3.5" />
            Sebelumnya
          </Button>
          <span className="px-1 text-xs text-muted-foreground tabular-nums">
            {currentPage + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
            disabled={currentPage >= totalPages - 1}
          >
            Berikutnya
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
