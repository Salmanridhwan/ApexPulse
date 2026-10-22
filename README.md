# Aiones Boards

Papan pemantauan kinerja & kepatuhan untuk instansi (BUMD/daerah): dashboard
interaktif, asisten AI yang menjawab dari dokumen resmi instansi, manajemen
berkas, pelaporan, dan pengelolaan pengguna per instansi.

## Ringkasan teknologi

| Bagian | Teknologi |
|---|---|
| Antarmuka | React + TypeScript + Vite, Tailwind, ECharts, ikon Lucide |
| Server | Node.js + Express (`server.ts`), satu proses melayani API & aset |
| Basis data | MySQL (produksi) atau `data/db.json` (cadangan lokal) |
| Autentikasi | Cookie sesi HttpOnly bertanda tangan HMAC, scrypt untuk kata sandi |
| Pencarian dokumen | Layanan RAG & repositori dokumen (KMS) yang dapat diatur dari panel admin |
| Uji & CI | `node --test` (24 test) + GitHub Actions: tsc, test, build |

## Menjalankan di lokal

```bash
npm install
cp .env.example .env      # isi koneksi MySQL (lihat docs/operasional.md)
npm run dev               # antarmuka (Vite) + server API
```

Alamat default: `http://127.0.0.1:3000`. Cek kesehatan: `GET /health`.

Build & jalankan seperti produksi:

```bash
npm run build
NODE_ENV=production npm start
```

## Perintah penting

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Mode pengembangan |
| `npm run build` | Build aset produksi ke `dist/` |
| `npm test` | Uji unit (aturan sandi, pembatas percobaan, enkripsi, menu, backup) |
| `npx tsc --noEmit` | Pemeriksaan tipe |
| `npm run backup` | Cadangan seluruh database ke `backups/*.json.gz` + SHA-256 |
| `npm run restore -- <berkas> [--dry-run]` | Pulihkan dari berkas cadangan |

Cadangan juga berjalan otomatis tiap hari di produksi (jam & lama simpan diatur
lewat `BACKUP_JAM` dan `BACKUP_SIMPAN_HARI`). Prosedur lengkap, jadwal, dan
langkah pemulihan ada di [`docs/operasional.md`](docs/operasional.md).

## Keamanan yang sudah diterapkan

- Kata sandi per akun (scrypt); akun baru & reset mendapat **kata sandi sementara**
  yang wajib diganti saat login pertama — tidak ada kata sandi bersama.
- Pembatas percobaan login (per IP dan per akun), pendaftaran, dan unggahan.
- Sesi: cookie HttpOnly + `SameSite`, `Secure` di produksi, `SESSION_SECRET` wajib
  di produksi (server menolak start bila kosong).
- Header keamanan: CSP, `nosniff`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, HSTS di produksi; `x-powered-by` dimatikan.
- Batas ukuran body 2 MB (umum) dan 70 MB khusus unggah berkas.
- Kunci API RAG/KMS disimpan terenkripsi (AES-256-GCM) di database.
- Isolasi data per instansi (tenant) di setiap endpoint.
- Tautan bagikan: mode lihat-saja atau bisa-edit dengan PIN 6 angka yang
  diverifikasi server (hanya hash yang disimpan).

## Struktur singkat

```
server.ts                     API + penyajian aset
src/pages/                    Halaman aplikasi (Dashboard, Admin, Berkas, …)
src/components/               Komponen UI
src/services/store/           Penyimpanan (in-memory + MySQL per-baris)
src/services/auth/            Sesi, kata sandi, pembatas percobaan
src/services/rag/             Klien layanan pencarian dokumen
src/services/config/rahasia.ts Enkripsi nilai rahasia di database
src/services/ops/             Cadangan harian otomatis
scripts/                      backup-db.mjs, restore-db.mjs, alat bantu
tests/                        Uji unit (node --test)
docs/operasional.md           Panduan operator
```

## Lisensi

Belum ditetapkan — hubungi pemilik repositori sebelum menggunakan atau
mendistribusikan kode ini.
