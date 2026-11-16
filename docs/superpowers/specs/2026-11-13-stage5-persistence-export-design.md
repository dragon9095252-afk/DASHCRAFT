# Stage 5 — Local Persistence and Export: Design

Tanggal: 2026-11-13
Status: Menunggu review
Project: Dashcraft (`D:\AI\dashcraft`)
Sumber kebutuhan: `05_STORAGE_AND_EXPORT.md`, `DATA_MODEL.md`, `TECHNICAL_ARCHITECTURE.md`, `ACCEPTANCE_TESTS.md`

## 1. Latar belakang

MVP tahap 1–4 sudah selesai: impor CSV/Excel, preview dan profiling kolom, dashboard otomatis dengan agregasi, editor visual, dan filter global. Seluruh state masih hidup di memori sehingga refresh menghapus dataset dan dashboard, dan tombol Simpan/Ekspor sengaja dinonaktifkan.

Stage 5 menambahkan penyimpanan lokal IndexedDB dan ekspor PNG/PDF/CSV. Pendekatan yang disetujui adalah **session store + repository**: store tetap menjadi working set sesi, sedangkan Dexie menjadi lapisan persistensi yang diakses lewat repository dan hook.

## 2. Tujuan

- Dataset dan dashboard dapat disimpan di browser yang sama dan dibuka kembali setelah refresh.
- Tombol Simpan memiliki status tersimpan/belum tersimpan yang akurat.
- Dashboard Saya mendukung buka, ganti nama, duplikat, dan hapus dengan konfirmasi.
- Pengaturan dapat menghapus seluruh data lokal setelah konfirmasi.
- Dashboard dapat diekspor sebagai PNG, PDF, dan CSV; CSV hanya berisi baris terfilter.
- Error IndexedDB/quota/export ditangani dengan pesan yang dapat ditindaklanjuti.

## 3. Di luar cakupan

Login, cloud sync, share link, template, undo/redo, multi-dataset/join, AI insight, dan Stage 6 QA lanjutan tidak dikerjakan pada tahap ini.

## 4. Keputusan yang disetujui

1. **Scope:** Stage 5 penuh (persistence + export).
2. **Save model:** dataset disimpan otomatis saat impor dan saat tipe/nama kolom diubah; dashboard disimpan eksplisit lewat tombol Simpan.
3. **Format CSV:** header `displayName`, seluruh kolom, nilai ternormalisasi, hanya baris terfilter.
4. **Filter state:** filter terakhir dipulihkan saat dashboard tersimpan dibuka kembali.
5. **Arsitektur:** session store + repository, Dexie sebagai lapisan persistensi, bukan sumber tunggal real-time.

## 5. Arsitektur

```text
UI (pages/hooks)
  ├─ useLiveQuery ──────────────► db.dashboards (daftar kecil, reaktif)
  ├─ useDashboardWorkspace ─────► state/dashboard-store (working set sesi)
  └─ useDatasetImport ──────────► dataset.repository ──► Dexie
                                        ▲
state/dashboard-store ◄── loadWorkspace │ saveWorkspace (transaksi)
                                        │
                              persistence.service
                                        ▲
                              dashboard.repository
```

- `src/db/database.ts` — satu instance Dexie dan tipe record.
- `src/db/repositories/dataset.repository.ts` — operasi tabel `datasets`.
- `src/db/repositories/dashboard.repository.ts` — operasi tabel `dashboards`.
- `src/db/persistence.service.ts` — koordinasi transaksi lintas repository (simpan workspace, hapus dashboard + dataset yatim, hapus semua).
- `src/db/storage-errors.ts` — `StorageError` dan penerjemahan pesan.
- `src/services/export.service.ts` — CSV murni, capture PNG, PDF, util unduhan.
- `src/features/dashboard/hooks/useDashboardExport.ts` — status sibuk/toast.

Lapisan `db/` adalah satu-satunya tempat akses Dexie. Komponen React tidak memanggil `db` langsung.

## 6. Model data persistensi

Domain `Dataset` dan `Dashboard` tidak berubah. Tambahan hanya pada record dashboard yang disimpan:

```ts
export interface StoredDashboard extends Dashboard {
  /** Filter aktif terakhir, dipulihkan saat dashboard dibuka. */
  filterState: ActiveFilterState
  /** Metadata tampilan agar daftar tidak memuat rows dataset. */
  datasetFileName: string
  rowCount: number
}
```

Schema Dexie v1:

```ts
db.version(1).stores({
  datasets: 'id, name, createdAt, updatedAt',
  dashboards: 'id, name, datasetId, createdAt, updatedAt',
})
```

`rows`, `columns`, `widgets`, dan `filterState` disimpan sebagai objek terstruktur (structured clone). `Date` didukung IndexedDB. Tidak ada `File` yang disimpan.

Aturan integritas:

- `datasetId` pada dashboard harus menunjuk dataset yang tersimpan.
- Simpan workspace menulis dataset dan dashboard dalam satu transaksi.
- Hapus dashboard juga menghapus dataset bila tidak ada dashboard lain yang mereferensikannya.
- Hapus semua data berjalan dalam satu transaksi dan juga mereset state sesi.

## 7. Perubahan store

`src/state/dashboard-store.tsx` tetap menyimpan dataset/dashboard sesi dan ditambah:

- `persistedIds: Record<string, true>` — dashboard yang sudah ada di Dexie.
- `dirtyIds: Record<string, true>` — dashboard dengan perubahan belum disimpan.
- `loadWorkspace(dataset, dashboard, filterState)` — hidrasi dari Dexie; menandai persisted dan clean.
- `markDashboardSaved(id, updatedAt)` — update timestamp dan hapus dirty.
- `isDashboardDirty(id)`, `isDashboardPersisted(id)`.
- `resetSession()` — dipakai setelah hapus semua data.
- `applyDashboardRename(id, name)` — menyinkronkan salinan sesi bila dashboard yang sama di-rename dari Dashboard Saya.
- `updateColumnType` dan `updateColumnDisplayName` mengembalikan `Dataset` hasil update agar pemanggil dapat menyimpannya.

Mutasi yang menandai dirty: pembuatan dashboard, tambah/edit/hapus/duplikat/pindah widget. Perubahan filter **tidak** menandai dirty. Dashboard hasil `createDashboard` mulai dalam keadaan dirty.

## 8. Alur utama

### 8.1 Impor dataset

1. `useDatasetImport` membangun dataset dan memanggil `addDataset`.
2. Dataset disimpan dengan `datasetRepository.save`.
3. Bila penyimpanan gagal, sesi tetap berjalan dan toast menjelaskan penyebab serta tindakan; import tidak dibatalkan.
4. Navigasi ke `/data-preview/:id` tetap dilakukan.

### 8.2 Preview setelah refresh

- `DataPreviewPage` memakai hook `useStoredDataset(datasetId)`.
- Bila dataset ada di store, langsung dipakai.
- Bila tidak, hook memuat dari Dexie dengan state `loading | ready | missing`; setelah berhasil dimuat, dataset dimasukkan ke store lewat `addDataset` agar aksi store (ubah tipe/nama) tetap bekerja.
- Perubahan tipe/nama kolom disimpan otomatis (debounce 400 ms) memakai dataset hasil update dari store. Kegagalan menghasilkan satu toast peringatan.

### 8.3 Membuat dan menyimpan dashboard

1. “Buat Dashboard” membuat dashboard di memori dengan status dirty.
2. Tombol Simpan aktif hanya saat dirty.
3. Simpan menjalankan `saveWorkspace(dataset, dashboard, filterState)` dalam transaksi.
4. Setelah sukses: `markDashboardSaved` dengan `updatedAt` baru, badge berubah menjadi “Tersimpan”, toast sukses.
5. Bila gagal: status tetap dirty dan pesan error ditampilkan.

### 8.4 Membuka dashboard tersimpan

- `useDashboardWorkspace` memeriksa store lebih dulu.
- Bila tidak ada, hook memuat dashboard + dataset + filter state dari Dexie, lalu memanggil `loadWorkspace`.
- Selama memuat tampil loading state; bila record/dataset tidak ditemukan tampil empty state yang informatif.
- Filter state yang tersimpan langsung diterapkan.

### 8.5 Filter pada dashboard tersimpan

- Setiap perubahan filter pada dashboard yang sudah persisted ditulis dengan debounce 400 ms melalui `updateFilterState`.
- Penulisan ini tidak mengubah `updatedAt` dashboard dan tidak menandai dirty.
- Bila dashboard belum pernah disimpan, filter hanya hidup di memori.
- Saat Simpan, filter state ikut ditulis bersama snapshot dashboard.

### 8.6 Dashboard Saya

- Daftar berasal dari `useLiveQuery(() => dashboardRepository.list())` dengan loading/empty state.
- Aksi:
  - **Buka** → `/builder/:id`.
  - **Ganti nama** → dialog input; validasi nama tidak kosong; tulis langsung ke Dexie; bila salinan sesi ada, panggil `applyDashboardRename` agar Simpan berikutnya tidak menimpa nama baru. Rename tidak menambah status dirty; status dirty salinan sesi hanya berasal dari perubahan konfigurasi.
  - **Duplikat** → record baru dengan ID baru, nama `“(Salinan)”`, `datasetId` sama, `filterState` disalin, timestamp baru. Duplikat tidak mengubah salinan sesi.
  - **Hapus** → konfirmasi; hapus record dan dataset yatim; hapus salinan sesi.
- Daftar hanya menampilkan dashboard yang sudah disimpan.

### 8.7 Beranda dan Pengaturan

- `RecentDashboards` membaca 3 dashboard terbaru dari Dexie dengan loading state.
- `SettingsPage` menampilkan jumlah dashboard/dataset, status “Data tersimpan di browser ini”, dan tombol hapus semua dengan konfirmasi.
- Bila IndexedDB tidak tersedia, tampil banner peringatan dan tombol hapus dinonaktifkan.

## 9. Export

### 9.1 Area capture

- Satu `ref` membungkus blok judul dashboard, filter bar, dan grid visual.
- Elemen yang tidak boleh ikut: sidebar (di luar layout utama), editor (portal Sheet), tombol kembali, aksi Simpan/Ekspor, toolbar tambah visual, dan menu kartu.
- Elemen kontrol diberi atribut `data-export-exclude`; `html-to-image` memakai `filter` untuk membuang node tersebut.
- Filter yang sedang aktif terlihat di hasil capture karena filter bar berada di dalam area.
- Nama file dasar `<nama-dashboard>-<YYYYMMDD>` dipakai oleh ketiga format; karakter non-aman diganti `-`.

### 9.2 PNG

- `toPng(node, { pixelRatio: 2, backgroundColor: '#f8fafc', cacheBust: true })`.
- Tunggu satu `requestAnimationFrame` + 300 ms agar animasi Recharts selesai.
- Unduh sebagai `<nama-dashboard>-<YYYYMMDD>.png`.

### 9.3 PDF

- Capture node yang sama, lalu masukkan ke jsPDF A4 landscape dengan margin 10 mm.
- Bila tinggi konten melebihi satu halaman, gambar dipenggal menjadi beberapa halaman memakai offset vertikal; tidak ada konten yang dipotong.
- Unduh sebagai `<nama-dashboard>-<YYYYMMDD>.pdf`.

### 9.4 CSV

- Service murni `buildCsv(rows, columns)`:
  - Header memakai `displayName`.
  - Semua kolom, urutan sesuai dataset.
  - Baris yang dipakai adalah `filteredRows`.
  - Nilai (memakai nilai baris yang sudah ternormalisasi; tidak ada parsing ulang saat export):
    - `null`/`undefined`/string kosong → sel kosong.
    - `number` → desimal polos tanpa pemisah ribuan.
    - `Date` → `YYYY-MM-DD` waktu lokal.
    - string → dipertahankan apa adanya (tidak menebak format tanggal/angka).
    - boolean → `true`/`false`.
    - lainnya → `String(value)`.
  - Escaping RFC 4180: bungkus dengan kutip bila mengandung koma, kutip, `\n`, atau `\r`; kutip di dalam digandakan.
  - Tambahkan BOM UTF-8 agar aman dibuka di Excel.
- Bila tidak ada baris terfilter, tampilkan info dan jangan mengunduh file kosong.
- Nama file CSV mengikuti pola nama file dasar di §9.1.

### 9.5 Status export

- `useDashboardExport` menyimpan format yang sedang diproses, menonaktifkan pilihan lain, dan menampilkan toast sukses/gagal.
- PNG/PDF dinonaktifkan bila tidak ada widget yang `visible`; CSV tetap tersedia selama ada baris terfilter.
- Error capture/unduh menampilkan pesan dengan saran mencoba lagi; aplikasi tidak crash.

## 10. Error handling

| Kondisi | Perilaku |
| --- | --- |
| IndexedDB tidak tersedia | Sesi in-memory tetap berjalan; banner di Beranda/Dashboard Saya/Pengaturan; Simpan menampilkan error dengan saran. |
| Quota exceeded | Pesan menyebut hapus data lokal di Pengaturan; dashboard tetap di memori dan dirty. |
| Dataset dashboard hilang | Empty state dengan tautan unggah ulang; record dashboard tidak dihapus diam-diam. |
| Gagal simpan filter (debounce) | Toast peringatan sekali; UI tetap berjalan. |
| Gagal export | Toast deskriptif; opsi mencoba lagi; tidak ada state parsial. |
| Record rusak/tidak kompatibel | Diperlakukan sebagai tidak ditemukan; pengguna dapat menghapus data lokal. |
| Multi-tab | Daftar dashboard reaktif; builder yang sedang terbuka tidak disinkronkan real-time. |

Tidak ada isi dataset yang ditulis ke console log.

## 11. Perubahan file utama

Baru:

- `src/db/database.ts`
- `src/db/storage-errors.ts`
- `src/db/persistence.service.ts`
- `src/db/repositories/dataset.repository.ts`
- `src/db/repositories/dashboard.repository.ts`
- `src/features/dashboard/hooks/useDashboardExport.ts`
- `src/features/import/hooks/useStoredDataset.ts`
- `src/features/dashboards/components/RenameDashboardDialog.tsx`
- `src/services/export.service.ts`
- `tests/storage.test.ts`
- `tests/export-csv.test.ts`

Diubah:

- `src/state/dashboard-store.tsx` — status persisted/dirty, hidrasi, reset, update kolom mengembalikan dataset.
- `src/features/dashboard/hooks/useDashboardWorkspace.ts` — hidrasi lazy, simpan, filter debounce, status loading.
- `src/features/dashboard/pages/DashboardBuilderPage.tsx` — loading state, ref export, beforeunload saat dirty.
- `src/features/dashboard/components/DashboardHeader.tsx` — Simpan aktif, status, dropdown ekspor.
- `src/features/dashboard/components/DashboardToolbar.tsx`, `WidgetMenu.tsx` — atribut `data-export-exclude`.
- `src/features/home/hooks/useDatasetImport.ts` — simpan dataset otomatis.
- `src/features/home/components/RecentDashboards.tsx` — Dexie + loading.
- `src/features/import/pages/DataPreviewPage.tsx` — hidrasi dari Dexie, simpan perubahan kolom.
- `src/features/dashboards/pages/DashboardsPage.tsx` — Dexie, rename/duplikat/hapus.
- `src/features/settings/pages/SettingsPage.tsx` — info storage, jumlah data, hapus semua.
- `src/components/common/LoadingState.tsx` — komponen baru (spinner + label) untuk daftar dan builder.
- `package.json` — dependensi baru.
- `README.md` — cara pakai persistence/export.

Dependensi:

```bash
npm install dexie dexie-react-hooks html-to-image jspdf
npm install -D fake-indexeddb
```

`xlsx` tetap tanpa perbaikan versi dari npm audit; risiko yang sudah diketahui tidak berubah pada tahap ini.

## 12. Pengujian

Unit (Vitest, `environment: node`; test storage mengimpor `fake-indexeddb/auto` sebelum modul database):

- Simpan dan baca dataset/dashboard; daftar dashboard terurut.
- `saveWorkspace` atomik; filter state tersimpan.
- Simpan filter tanpa mengubah `updatedAt`.
- Rename, duplikat (ID baru, filter state tersalin, dataset sama), hapus dashboard + dataset yatim.
- Hapus semua data mengosongkan kedua tabel.
- `buildCsv`: escaping koma/kutip/newline, tanggal, boolean, nilai kosong, header displayName, BOM, nama file.
- Terjemahan error storage (quota/unavailable/unknown).

Regresi dan gate:

- 22 tes lama tetap lolos.
- `npm run build`, `npm test`, `npm run lint`.

Browser QA (Chrome DevTools/Playwright):

1. Impor sampel → refresh route preview.
2. Buat dashboard → Simpan → refresh builder; dashboard dan filter terpulihkan.
3. Ubah filter → refresh → filter terakhir kembali.
4. Ubah widget → badge “Belum disimpan” → Simpan → “Tersimpan”.
5. Dashboard Saya: rename, duplikat, hapus; dataset yatim ikut terhapus.
6. Pengaturan: jumlah data benar; hapus semua mengosongkan daftar.
7. Unduh PNG/PDF/CSV: nama file benar, PNG non-kosong, CSV hanya baris terfilter dan header displayName, PDF diawali `%PDF`.
8. Mobile layout, console bersih, tidak ada baris dataset di log.

## 13. Pemetaan acceptance criteria

| Kriteria | Pemenuhan |
| --- | --- |
| Save membuat record yang dapat dibuka kembali | `saveWorkspace` + hidrasi builder |
| Refresh tidak menghilangkan dashboard tersimpan | Dexie + `useLiveQuery` + lazy load |
| Dashboard Saya menampilkan data benar | `dashboardRepository.list` + `useLiveQuery` |
| Rename/duplikat/hapus bekerja | Repository + dialog/konfirmasi |
| PNG/PDF/CSV terunduh | `export.service` + `useDashboardExport` |
| Export tidak memuat sidebar/editor | Root ref + `data-export-exclude` |
| Filter tercermin di export | `filteredRows` + filter bar di area capture |
| Error storage/export tidak crash | `StorageError` + toast/empty state |
| Build/typecheck lolos | Gate akhir |

## 14. Risiko dan mitigasi

- **Capture gagal karena font/CORS** → `cacheBust`, background eksplisit, pesan error dengan retry, verifikasi browser.
- **Dataset besar memicu quota** → tangkap quota error, arahkan ke hapus data, jangan menghapus data diam-diam.
- **Daftar memuat rows besar** → metadata `datasetFileName`/`rowCount` didenormalisasi; dataset hanya dimuat saat dibuka.
- **Save menimpa rename dari daftar** → sinkronkan nama baru ke salinan sesi; Simpan berikutnya memakai nama tersebut.
- **Filter debounce menulis ke snapshot lama** → hanya untuk record yang sudah persisted; snapshot konfigurasi terbaru tetap ditulis saat Simpan.
- **Capture PDF sangat tinggi** → batasi tinggi gambar per halaman dengan pemenggalan offset; verifikasi di browser dengan dashboard berisi banyak widget.
