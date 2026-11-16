# Dashcraft

Aplikasi client-side untuk mengubah file Excel/CSV menjadi dashboard interaktif. File diproses sepenuhnya di browser — tidak ada backend, akun, atau upload data ke server.

## Menjalankan

```bash
npm install
npm run dev
```

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Server pengembangan Vite |
| `npm run build` | Type-check (`tsc -b`) lalu build produksi |
| `npm run test` | Menjalankan tes Vitest |
| `npm run lint` | Lint dengan Oxlint |

## Alur penggunaan

1. Unggah `.xlsx`, `.xls`, atau `.csv` (maks. 20 MB) di Beranda.
2. Pilih worksheet bila file memiliki lebih dari satu sheet.
3. Periksa preview (50 baris/halaman) dan profil kolom; tipe kolom dan nama tampilan bisa diubah.
4. Klik **Buat Dashboard** — KPI, grafik, dan filter awal dibuat otomatis.
5. Edit visual lewat panel kanan, tambah/duplikat/hapus visual, dan gunakan filter global.
6. Klik **Simpan** untuk menyimpan dashboard ke IndexedDB browser.
7. Kelola dashboard di **Dashboard Saya**: buka, ganti nama, duplikat, atau hapus.
8. Ekspor dashboard sebagai PNG, PDF, atau CSV (hanya baris terfilter).

## Penyimpanan dan ekspor

- Dataset disimpan otomatis saat impor dan saat tipe/nama kolom diubah.
- Dashboard disimpan hanya saat tombol **Simpan** diklik; badge menunjukkan “Belum disimpan” atau “Tersimpan”.
- Filter terakhir ikut tersimpan dan dipulihkan saat dashboard dibuka kembali.
- **Pengaturan → Hapus seluruh data lokal** menghapus semua dataset dan dashboard di browser ini.
- PNG/PDF menangkap area judul, filter, dan visual; kontrol editor tidak ikut.
- CSV memakai nama tampilan kolom, seluruh kolom, nilai ternormalisasi, dan hanya baris yang lolos filter.

## Batasan tahap ini

- Penyimpanan bersifat lokal per browser; tidak ada login, cloud sync, atau share link.
- Satu dashboard = satu file + satu worksheet.
- Nilai formula tidak dihitung ulang; nilai yang tersimpan di file yang ditampilkan.
- Maksimal 10 kategori per grafik secara default (dapat diubah di editor, maks. 200).

## Verifikasi data contoh

`public/sample-data/sales_sample.csv` (36 baris, 9 kolom) dipakai oleh `tests/sample-data.test.ts` untuk memverifikasi total Revenue 433.065.000, Quantity 170, Cost 298.540.000, Revenue per cabang, dan Revenue per bulan.

## Tumpukan

React 19 + TypeScript + Vite, Tailwind CSS v4, shadcn/ui, Recharts, SheetJS (`xlsx`), react-router-dom, Sonner, Vitest.
