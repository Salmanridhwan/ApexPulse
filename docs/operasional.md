# Operasional Aiones Boards

Panduan singkat untuk menjalankan, mencadangkan, dan memulihkan aplikasi.
Ditulis untuk operator (bukan pengembang) — semua perintah dijalankan dari akar repo.

---

## 1. Variabel lingkungan wajib

Buat `.env` di akar repo. Nilai rahasia **tidak boleh** di-commit.

| Variabel | Wajib | Keterangan |
|---|---|---|
| `SESSION_SECRET` | disarankan | Minimal 32 karakter acak. Dipakai menandatangani cookie sesi. **Semua instance harus memakai nilai sama.** Bila kosong saat `NODE_ENV=production`, server membuat secret acak sekali dan menyimpannya di berkas `.session-secret` (mode 600, tidak masuk repo) di folder kerja — jadi dua instance yang berbagi folder tetap memakai nilai sama. Berkas itu **wajib dicadangkan**: menghapusnya membuat semua pengguna terlempar-login, dan kunci API yang tersimpan tidak bisa dibuka. Tidak pernah ada nilai cadangan yang tertulis di kode. |
| `DATA_ENCRYPTION_KEY` | disarankan | Kunci enkripsi kunci API RAG/KMS yang disimpan di database (AES-256-GCM). Bila kosong, memakai `SESSION_SECRET`. **Jangan diganti setelah dipakai** — nilai lama tidak bisa dibuka dan admin perlu memasukkan ulang kunci API. |
| `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE` | ya | Koneksi MySQL. Default: `127.0.0.1:3306`, user `root`, database `bumd_aionesboard`. |
| `PORT` | tidak | Default `3000`. |
| `NODE_ENV` | ya | `production` mengaktifkan cookie `Secure`, header HSTS, dan aset hasil build. |
| `ALLOW_REGISTRATION` | tidak | `false` menutup pendaftaran mandiri. |
| `RAG_API_URL` / `RAG_API_KEY` / `RAG_KB_ID` | tidak | Bisa juga diisi dari panel admin (Konfigurasi RAG). |
| `KMS_API_URL` / `KMS_API_KEY` | tidak | Layanan repositori dokumen. |

Cek cepat setelah menyalakan server: `GET /health` harus membalas
`{"status":"ok","db":true,"persistence":"mysql"}`.

---

## 2. Menjalankan

```bash
npm install          # sekali
npm run build        # aset produksi ke dist/
NODE_ENV=production npm start
```

Pemeriksaan sebelum rilis:

```bash
npx tsc --noEmit     # tipe
npm test             # unit test
npm run build        # build produksi
```

Ketiganya juga dijalankan otomatis oleh CI (`.github/workflows/ci.yml`) pada setiap push/PR.

---

## 3. Cadangan harian

**Otomatis (disarankan).** Di produksi server mencadangkan sendiri setiap hari
pukul 02.00 dan menyimpan 14 hari terakhir, lalu menghapus yang lebih tua.

| Variabel | Default | Keterangan |
|---|---|---|
| `BACKUP_OTOMATIS` | aktif bila `NODE_ENV=production` | `0` mematikan, `1` menyalakan walau bukan produksi |
| `BACKUP_JAM` | `2` | Jam berjalan (0–23), waktu server |
| `BACKUP_SIMPAN_HARI` | `14` | Cadangan lebih tua dari ini dihapus |
| `BACKUP_DIR` | `backups` | Folder penyimpanan |

Pastikan folder cadangan berada di disk yang berbeda dari database, atau
salinan berkala dikirim ke lokasi lain (cadangan di disk yang sama ikut hilang
bila disk rusak).

**Manual / di luar server:**

```bash
npm run backup
# atau tentukan folder lain:
BACKUP_DIR=D:/cadangan/aionesboard npm run backup
```

Hasil: `backups/aionesboard-<waktu>.json.gz` + `<berkas>.sha256`.
Isinya **seluruh tabel** (17 tabel: tenant, user, dashboard, audit, dokumen, dsb.).

Bila ingin dijadwalkan sistem (mis. server tanpa `NODE_ENV=production`):

- **Linux (cron)** — tiap hari 02.00:
  `0 2 * * * cd /srv/aiones-boards && /usr/bin/npm run backup >> /var/log/aiones-backup.log 2>&1`
- **Windows (Task Scheduler)** — aksi: `npm.cmd`, argumen `run backup`, mulai di folder repo.

Simpan salinan di mesin/lokasi berbeda dari database. Berkas cadangan berisi data
instansi — jangan di-commit (sudah masuk `.gitignore`) dan jangan dibagikan lewat
grup pesan.

---

## 4. Memulihkan (restore)

> Restore **menghapus** isi tabel lalu mengisinya dari cadangan. Hentikan server dulu.

```bash
# 1) hentikan server
# 2) periksa isi cadangan tanpa menulis apa pun
node scripts/restore-db.mjs backups/aionesboard-2026-10-22T03-48-45-030Z.json.gz --dry-run

# 3) pulihkan
node scripts/restore-db.mjs backups/aionesboard-2026-10-22T03-48-45-030Z.json.gz

# 4) nyalakan server, lalu cek /health dan login satu akun
```

Sebelum restore, buat cadangan kondisi sekarang (`npm run backup`) supaya masih bisa
kembali bila ternyata berkas yang dipulihkan bukan versi yang dimaksud.

Uji restore **sekali sebelum go-live** di database percobaan — jangan menunggu
insiden untuk mengetahui prosedurnya bekerja.

---

## 5. Akun & kata sandi

- Akun baru dari panel admin mendapat **kata sandi sementara** yang hanya tampil
  sekali di layar. Sampaikan lewat saluran aman; pengguna **wajib** menggantinya saat
  login pertama (server menolak endpoint lain sampai diganti).
- Lupa kata sandi: admin membuka **Panel Admin → Pengguna & RBAC → ikon kunci** pada
  baris pengguna. Server membuat sandi sementara baru (tidak ada sandi bersama).
- Percobaan login dibatasi 30/15 menit per IP dan 10/15 menit per akun; pendaftaran
  5/jam per IP; unggah berkas 20/jam per akun. Batas ini berlaku per instance.

---

## 6. Tautan bagikan

- **Read-Only**: siapa pun yang memegang tautan dapat melihat.
- **Bisa Edit**: wajib PIN 6 angka yang dibuat server saat tautan dibuat. PIN hanya
  tampil sekali — kirim terpisah dari tautannya. Bila PIN hilang, buat tautan baru
  dan cabut yang lama.
- Percobaan PIN dibatasi 10 kali per 15 menit untuk setiap tautan+IP; setelah itu
  balasan 429 dengan `Retry-After` dan PIN yang benar pun ditolak sampai jendela
  berakhir. Ini yang membuat 6 angka tidak bisa ditebak paksa.
- Tautan punya masa berlaku (7/30/90/365 hari atau tanpa batas) dan dapat dicabut
  kapan saja dari panel Bagikan; tautan yang dicabut langsung tidak bisa dipakai (410).

---

## 7. Pemantauan

- Cadangan pertama dibuat otomatis ±5 menit setelah start bila folder cadangan masih
  kosong (`BACKUP_AWAL_MENIT`), jadi rilis baru langsung punya titik pulih tanpa
  menunggu jadwal harian.
- `GET /health` → status server, `dbMs` (latensi MySQL), `uptimeDetik`, `memoriMB`,
  dan `cadangan: { terakhir, umurJam, terlambat }`. Arahkan pemantauan uptime ke
  sini dan beri peringatan bila `terlambat: true` (cadangan terakhir > 26 jam)
  atau `db: false`.
- Log server mencatat satu baris per permintaan API:
  `[api] POST /api/auth/login 200 84ms user=user-123` — pakai ini untuk menelusuri
  keluhan pengguna (jam kejadian, status, durasi).
- Galat tak terduga dicatat dengan stack trace dan dibalas ke klien sebagai pesan umum
  (tanpa detail teknis).
