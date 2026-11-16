import { PageContainer } from '@/components/layout/PageContainer'
import { StorageUnavailableNotice } from '@/components/common/StorageUnavailableNotice'
import { UploadDropzone } from '../components/UploadDropzone'
import { SheetSelectorDialog } from '../components/SheetSelectorDialog'
import { RecentDashboards } from '../components/RecentDashboards'
import { useDatasetImport } from '../hooks/useDatasetImport'

const STEPS = [
  { title: 'Unggah file', description: 'CSV atau Excel, diproses langsung di browser.' },
  {
    title: 'Periksa data',
    description: 'Jalankan profiling, cek anomali, hubungan variabel, dan segmentasi otomatis.',
  },
  {
    title: 'Analisis dan sajikan',
    description: 'Gunakan Analysis Workbench untuk eksplorasi; dashboard menjadi lapisan presentasi hasil.',
  },
]

export function HomePage() {
  const { processing, error, pending, handleFile, confirmSheet, closeSheet } =
    useDatasetImport()

  return (
    <PageContainer>
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-wider text-brand uppercase">Beranda</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Advanced Data Analytics Workspace
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Impor file Excel atau CSV, jalankan analisis data tingkat lanjut, siapkan transformasi, dan gunakan dashboard untuk menyajikan hasil. Data tetap diproses di browser Anda.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.65fr_1fr]">
        <section>
          <UploadDropzone
            onFileSelected={handleFile}
            isProcessing={processing}
            error={error}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Satu dataset dapat dianalisis, dibersihkan secara terkontrol, dipivot, dan divisualisasikan. File tidak dikirim ke layanan eksternal.
          </p>
        </section>

        <aside>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Dashboard tersimpan</h2>
          </div>
          <RecentDashboards />
          <StorageUnavailableNotice className="mt-3" />
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Dataset dan dashboard tersimpan di browser ini dan tetap ada setelah halaman dimuat ulang.
          </p>
        </aside>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <div key={step.title} className="rounded-xl border bg-card p-5">
            <span className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
              {index + 1}
            </span>
            <p className="mt-3 text-sm font-semibold">{step.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </div>
        ))}
      </div>

      <SheetSelectorDialog
        open={pending !== null}
        fileName={pending?.file.name ?? ''}
        sheets={pending?.sheets ?? []}
        onOpenChange={(open) => {
          if (!open) closeSheet()
        }}
        onConfirm={confirmSheet}
      />
    </PageContainer>
  )
}
