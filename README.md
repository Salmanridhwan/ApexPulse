# Aiones Boards

Papan pemantauan kinerja instansi (BUMD/daerah). Dashboard dibangun dari dokumen
resmi instansi lewat layanan RAG, lalu ditampilkan sebagai chart, KPI, dan tabel.
Ada asisten AI yang menjawab dari dokumen, repositori dokumen, permintaan data
antar peran, dan panel admin per instansi.

Dokumen ini ditulis supaya rekan baru bisa menyiapkan lingkungan kerja dari nol
dan langsung ikut mengembangkan.

## 1. Prasyarat

| Kebutuhan | Versi | Catatan |
|---|---|---|
| Git | terbaru | akses ke repo diminta ke pemilik |
| Node.js | 22 atau lebih baru | CI memakai 22, mesin pemilik memakai 24 |
| MySQL | 8.x | **opsional**, lihat bagian 4 |
| Chrome atau Edge | terbaru | hanya untuk uji E2E |

Di Windows, MySQL paling mudah lewat Laragon atau XAMPP. Di Linux/macOS bisa
lewat paket bawaan atau Docker (`docker run -p 3306:3306 -e MYSQL_ALLOW_EMPTY_PASSWORD=yes mysql:8`).

## 2. Ambil kode dan pasang dependensi

```bash
git clone https://github.com/Salmanridhwan/ApexPulse.git aiones-boards
cd aiones-boards
npm install
```

## 3. Berkas `.env`

```bash
cp .env.example .env
```

Semua isian opsional. Untuk pengembangan lokal cukup bagian MySQL (kalau
memakai MySQL). Jangan pernah meng-commit `.env`.

## 4. Basis data

Aplikasi punya dua mode penyimpanan dan memilih sendiri saat start:

- **MySQL tersedia**: database dibuat otomatis (`CREATE DATABASE IF NOT EXISTS`)
  beserta tabelnya. Nama bawaan `bumd_aionesboard`, host `127.0.0.1:3306`,
  user `root` tanpa sandi. Ubah lewat `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`,
  `MYSQL_PASSWORD`, `MYSQL_DATABASE` di `.env`.
- **MySQL tidak tersedia**: server tetap jalan dan menyimpan ke `data/db.json`.

Mode yang aktif terlihat di `GET /health`, field `persistence` (`mysql` atau `file`).

Data instansi tidak ada di repo (folder `data/` dan `backups/` di-gitignore).
Clone baru berarti aplikasi kosong, hanya berisi akun seed. Kalau butuh data
contoh, minta berkas cadangan `*.json.gz` ke pemilik lewat jalur pribadi
(berkas itu berisi data instansi), lalu dengan server dalam keadaan mati:

```bash
npm run restore -- backups/<berkas>.json.gz --dry-run   # periksa isi dulu
npm run restore -- backups/<berkas>.json.gz             # tulis ke MySQL
```

Restore menghapus isi tabel lalu mengisinya ulang, dan hanya bekerja di mode MySQL.

## 5. Menjalankan

```bash
npm run dev
```

Perintah ini build antarmuka (Vite) ke `dist/` lalu menjalankan `server.ts`.
Buka `http://localhost:3000`, cek kesehatan di `http://localhost:3000/health`.

**Penting:** server menyajikan antarmuka dari `dist/`, bukan langsung dari `src/`.
Tidak ada hot reload. Setiap kali kode di `src/` berubah:

```bash
npm run build        # build ulang antarmuka
```

lalu hard refresh browser (Ctrl+Shift+R). Kalau `server.ts` atau kode server
berubah, matikan dan jalankan ulang server (`npm run dev:server` untuk start
tanpa build).

## 6. Login pertama

Server membuat akun seed otomatis untuk tiap peran:

| Akun seed | Peran (`role`) | Bisa apa |
|---|---|---|
| `admin.aiones@aionesboard.id` | Admin Aiones (`superadmin`) | semua instansi, Konfigurasi RAG, paket |
| `admin@gmail.com` | Admin instansi (`admin`) | satu instansi: pengguna, dokumen, Kotak Masuk permintaan, Template Chart |
| `user@gmail.com` | Pengguna (`pengguna`) | lihat dashboard, ajukan Permintaan Data, Template Dashboard |

Sandi akun seed tidak ditulis di sini. Sandi bawaan ada di `.env.example`
(variabel `DEMO_PASSWORD`, bisa diganti lewat `.env`), dan beberapa akun uji
punya sandi khusus di `SEED_PASSWORDS` pada `src/services/store/inMemoryDb.ts`.
Akun seed hanya untuk lokal, jangan dipakai di server publik.

## 7. Layanan RAG (pembaca dokumen)

Analisis dokumen, Rekomendasi AI, pratinjau template, dan Asisten membutuhkan
layanan RAG eksternal. URL dan API Key **tidak ada di repo**. Minta ke pemilik,
lalu login sebagai Admin Aiones dan isi di **Panel Admin → Konfigurasi RAG**
(kunci disimpan terenkripsi di database).

Tanpa RAG, bagian lain tetap bisa dikerjakan: UI, dashboard manual, chart,
pengguna, berkas. Fitur yang butuh RAG akan menampilkan pesan galat.

Hal yang perlu diingat saat menyentuh RAG: field `query` maksimal 8000 karakter.
Lebih dari itu dijawab HTTP 422 tanpa penjelasan.

## 8. Perintah penting

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | build antarmuka lalu jalankan server |
| `npm run dev:server` | jalankan server saja, tanpa build |
| `npm run build` | build antarmuka ke `dist/` |
| `npm test` | seluruh uji unit (`node --test`, ratusan tes, sekitar 15 detik) |
| `npm run lint` | pemeriksaan tipe (`tsc --noEmit`) |
| `npm run test:e2e` | uji E2E di browser nyata (`CHROME_PATH` bila Chrome tidak di lokasi standar) |
| `npm run backup` | cadangkan database ke `backups/*.json.gz` |
| `npm run restore -- <berkas> [--dry-run]` | pulihkan dari cadangan |

CI (GitHub Actions) menjalankan `tsc`, `npm test`, dan `npm run build` di setiap push.

## 9. Alur kerja kontribusi

1. Ambil perubahan terbaru: `git pull origin main`.
2. Buat branch sendiri: `git checkout -b nama/fitur-singkat`.
3. Kerjakan, lalu sebelum commit jalankan `npm run lint`, `npm test`, `npm run build`.
4. Cek di browser setelah `npm run build` dan hard refresh.
5. Commit hanya berkas yang memang diubah (hindari `git add -A`). Jangan
   commit `.env`, `data/`, `backups/`, log, atau folder `scratch/`.
6. Push branch dan buka Pull Request ke `main`.

Konvensi:

- Bahasa Indonesia untuk teks UI, komentar, nama fungsi domain, dan pesan commit.
- Berkas sumber memakai akhir baris CRLF. Biarkan Git yang mengurus (`core.autocrlf`).
- Angka di chart memakai `angkaRingkas` (rb, jt, M), jangan format sendiri.
- Fungsi murni diberi tes di `tests/<nama>.test.ts`.

## 10. Peta kode

```
server.ts                       seluruh API Express + penyajian dist/
src/App.tsx                     kerangka aplikasi, routing hash #/v/<halaman>
src/pages/                      halaman (Dashboard, Pilih Data, Template, Admin, Berkas, ...)
src/components/                 komponen UI (Sidebar, ChatPanel, DashboardCanvas, ...)
src/components/widgets/         kartu KPI, chart ECharts, tabel
src/services/analisis/          ekstrak butir data dari dokumen, aturan dashboard, rekomendasi AI, usulan Asisten
src/services/chart/             pembangun opsi chart, gaya, angka ringkas
src/services/templates/         Template Dashboard dan pratinjaunya
src/services/rag/               klien layanan RAG
src/services/store/             penyimpanan (in-memory + MySQL per baris, fallback data/db.json)
src/services/auth/              sesi, sandi, peran (peran.ts)
src/services/chat/              saran pertanyaan Asisten
src/types/index.ts              tipe bersama
scripts/                        backup, restore, uji E2E, alat bantu
tests/                          uji unit
docs/                           api.md, operasional.md, catatan rencana
```

## 11. Masalah umum

| Gejala | Penyebab dan solusi |
|---|---|
| Perubahan UI tidak muncul | `dist/` lama. Jalankan `npm run build` lalu hard refresh. |
| `EADDRINUSE :3000` | Server lama masih jalan. Matikan prosesnya atau set `PORT` lain di `.env`. |
| `/health` menunjukkan `persistence: "file"` | MySQL tidak terhubung. Cek layanan MySQL dan isian `MYSQL_*`. |
| Asisten atau analisis gagal 502/422 | RAG belum diisi, sedang lambat, atau prompt melewati 8000 karakter. Lihat log server. |
| Pratinjau Template "Menyiapkan" lama | Normal setelah restart, kartu terisi bertahap dari RAG. |

## Lisensi

**Proprietary, all rights reserved.** Kode ini milik Aiones dan tidak boleh
dipakai, disalin, dimodifikasi, atau didistribusikan tanpa izin tertulis.
Lihat [`LICENSE`](LICENSE) untuk teks lengkap, termasuk pengecualian untuk
paket pihak ketiga (open source) yang tetap tunduk pada lisensi masing-masing.
