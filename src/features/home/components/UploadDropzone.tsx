import { useRef, useState } from 'react'
import { FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ACCEPTED_EXTENSIONS, MAX_FILE_SIZE_LABEL } from '@/services/file-import.service'

export function UploadDropzone({
  onFileSelected,
  isProcessing,
  error,
}: {
  onFileSelected: (file: File) => void
  isProcessing: boolean
  error: string | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    onFileSelected(files[0])
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Unggah file Excel atau CSV"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) return
          setDragOver(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          if (!isProcessing) handleFiles(event.dataTransfer.files)
        }}
        className={cn(
          'group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-12 text-center transition-colors outline-none',
          'focus-visible:ring-3 focus-visible:ring-ring/40',
          dragOver ? 'border-brand bg-brand-soft' : 'hover:border-brand/60 hover:bg-secondary/40',
          isProcessing && 'pointer-events-none opacity-70',
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-full border bg-background">
          {isProcessing ? (
            <Loader2 className="size-5 animate-spin text-brand" />
          ) : (
            <UploadCloud className="size-5 text-brand" />
          )}
        </div>
        <p className="mt-4 text-base font-semibold">
          {isProcessing ? 'Menganalisis data…' : 'Tarik & lepas file di sini'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isProcessing
            ? 'File dibaca langsung di browser Anda.'
            : 'atau pilih file dari komputer Anda.'}
        </p>
        {!isProcessing ? (
          <Button
            type="button"
            className="mt-5"
            onClick={(event) => {
              event.stopPropagation()
              inputRef.current?.click()
            }}
          >
            <FileSpreadsheet className="size-4" />
            Pilih file
          </Button>
        ) : null}
        <p className="mt-4 text-xs text-muted-foreground">
          {ACCEPTED_EXTENSIONS.join(', ')} · Maksimal {MAX_FILE_SIZE_LABEL}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="sr-only"
          onChange={(event) => {
            handleFiles(event.target.files)
            event.target.value = ''
          }}
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
