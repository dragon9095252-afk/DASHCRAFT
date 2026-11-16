# Dashcraft

Dashcraft adalah browser-based data analytics workspace untuk mengimpor, memeriksa, menyiapkan, menganalisis, dan menyajikan data Excel/CSV. Dataset tetap berada di browser; tidak ada upload data ke server.

## Menjalankan

\`\`\`bash
npm install
npm run dev
\`\`\`

| Perintah | Fungsi |
| --- | --- |
| \`npm run dev\` | Server pengembangan Vite |
| \`npm run build\` | Type-check (\`tsc -b\`) lalu build produksi |
| \`npm run test\` | Menjalankan tes Vitest |
| \`npm run lint\` | Lint dengan Oxlint |
| \`vercel --prod\` | Deploy produksi (setelah project Vercel terhubung) |

## Alur penggunaan

1. Unggah file `.xlsx`, `.xls`, atau `.csv` (maks. 20 MB) di Beranda.
2. Pilih worksheet bila file memiliki lebih dari satu sheet.
3. Periksa preview data dan profil kolom; tipe data serta nama tampilan bisa dikoreksi.
4. Buka **Analysis Workbench** untuk profiling, quality checks, inferensi statistik, forecasting, dan predictive modeling.
5. Gunakan **Transformasi** untuk menyiapkan dataset turunan secara non-destruktif atau **Pivot table** untuk agregasi dan perbandingan.
6. Buat dashboard hanya ketika Anda ingin menyajikan KPI dan visual hasil analisis.
7. Edit visual, filter global, lalu simpan dashboard ke IndexedDB browser.
8. Ekspor ringkasan analisis atau dashboard sesuai kebutuhan.

## Mesin analitik otomatis

- Profiling per kolom: nilai valid, kosong, tidak valid, distinct, frekuensi kategori, statistik numerik, dan outlier berbasis IQR.
- Deteksi baris duplikat dan ringkasan kualitas data berbasis heuristik.
- Korelasi Pearson, regresi linear eksploratif, dan segmentasi K-means.
- Inferensi statistik: Welch two-sample t-test dengan p-value dua sisi dan confidence interval 95%, serta chi-square independence untuk dua field kategorikal.
- Forecast deret waktu dengan Holt linear trend, holdout kronologis, MAE, RMSE, dan MAPE.
- Predictive ridge regression dengan pemisahan train/test deterministik, imputasi mean berbasis training data, standardisasi, MAE/RMSE/R², dan koefisien.
- Semua hasil bersifat eksploratif dan tidak mengubah sumber. Korelasi bukan sebab-akibat; model tidak menjamin prediksi; asumsi uji statistik perlu diperiksa manusia.

## Penyimpanan dan ekspor

- Dataset disimpan otomatis saat impor dan saat tipe/nama kolom diubah.
- Dashboard disimpan hanya saat tombol **Simpan** diklik; badge menunjukkan “Belum disimpan” atau “Tersimpan”.
- Filter terakhir ikut tersimpan dan dipulihkan saat dashboard dibuka kembali.
- **Pengaturan → Hapus seluruh data lokal** menghapus semua dataset dan dashboard di browser ini.
- PNG/PDF menangkap area judul, filter, dan visual; kontrol editor tidak ikut.
- CSV memakai nama tampilan kolom, seluruh kolom, nilai ternormalisasi, dan hanya baris yang lolos filter.
- Teks CSV yang diawali karakter formula spreadsheet (\`=\`, \`+\`, \`-\`, atau \`@\`) diberi awalan teks agar tidak langsung dieksekusi ketika dibuka di aplikasi spreadsheet.

## Dukungan format data

- Angka polos, pemisah ribuan desimal Indonesia (\`1.234.567,89\`) dan internasional (\`1,234,567.89\`), serta nilai mata uang umum seperti \`Rp 1.500.000\` dapat dikenali.
- Tanggal ISO (\`2026-11-16\`), tanggal Indonesia (\`16/11/2026\` atau \`16-11-2026\`), dan nama bulan Indonesia/Inggris (\`16 Nov 2026\`) dapat dikenali.
- Untuk tanggal dengan format ambigu seperti \`01/02/2026\`, aplikasi menggunakan urutan hari/bulan/tahun yang lazim di Indonesia.
- Nilai yang tidak cocok dengan tipe kolom tetap dipertahankan dan ditandai; aplikasi tidak menghapus baris secara otomatis.

## Batasan tahap ini

- Forecasting awal menggunakan Holt linear trend dan tidak memodelkan seasonality secara eksplisit.
- Inferensi bergantung pada asumsi desain sampel; ridge regression saat ini hanya mendukung target dan fitur numerik dengan satu random holdout, bukan time-aware cross-validation.
- Insight bersifat berbasis aturan/algoritma deterministik; integrasi AI Analyst/LLM eksternal belum tersedia.
- Penyimpanan bersifat lokal per browser; tidak ada login, cloud sync, atau share link.
- Satu dashboard = satu file + satu worksheet.
- Nilai formula tidak dihitung ulang; nilai yang tersimpan di file yang ditampilkan.
- Maksimal 10 kategori per grafik secara default (dapat diubah di editor, maks. 200).

## Deployment Vercel

Repository ini memakai Vite dan menghasilkan aset statis di \`dist/\`. Konfigurasi \`vercel.json\` menetapkan build command, output directory, fallback untuk client-side routes, dan security headers. Hubungkan repository GitHub ke project Vercel dan pilih \`main\` sebagai Production Branch agar setiap push ke \`main\` memicu production deployment. File spreadsheet pengguna tetap diproses di browser dan tidak dikirim ke Vercel.

## Verifikasi data contoh

\`public/sample-data/sales_sample.csv\` (36 baris, 9 kolom) dipakai oleh \`tests/sample-data.test.ts\` untuk memverifikasi total Revenue 433.065.000, Quantity 170, Cost 298.540.000, Revenue per cabang, dan Revenue per bulan.

## Tumpukan

React 19 + TypeScript + Vite, Tailwind CSS v4, shadcn/ui, Recharts, SheetJS (\`xlsx\`), react-router-dom, Sonner, Vitest.
