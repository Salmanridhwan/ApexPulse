# Kunci API untuk platform mitra

Dokumen ini untuk pengembang **platform lain** yang ingin memakai Aiones Boards
sebagai layanan: mengunggah dokumen, membaca hasil analisisnya, lalu menyusun
dashboard — tanpa login ke aplikasi ini.

Yang **tidak** termasuk: chat/asisten. Platform memakai kunci modelnya sendiri
(OpenAI, Gemini, dan sejenisnya) untuk chatbot-nya. Kunci API Aiones Boards
sengaja tidak membuka jalur chat, insight AI, maupun rekomendasi dashboard,
supaya kuota AI instansi tidak terpakai diam-diam oleh platform lain.

## 1. Membuat kunci

1. Login sebagai **Admin Aiones** (superadmin).
2. Buka **Panel Admin → Kunci API**.
3. Klik **Buat kunci**, isi:
   - **Nama platform** — mis. `Platform CSR TPCC` (minimal 3 karakter).
   - **Instansi** — kunci hanya bisa menyentuh data instansi ini.
   - **Izin** — `Dokumen & analisis` dan/atau `Dashboard`.
   - **Berlaku** — masa aktif dalam hari (`0` = tanpa batas).
4. Kunci tampil **sekali**. Salin dan simpan di secret manager platform.
   Server hanya menyimpan hash SHA-256-nya, jadi kunci tidak bisa dilihat lagi.

Kunci bisa **dicabut** (berhenti berlaku, data tetap ada) atau **dihapus**
permanen. Awalan `aio_xxxxxxxx…` dipakai untuk membedakan kunci di daftar.

## 2. Memakai kunci

Kirim header pada setiap permintaan:

```
X-API-Key: aio_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`Authorization: Bearer aio_…` juga diterima. Jangan taruh kunci di kode
frontend/browser — panggil dari server platform.

Batas: **300 permintaan per menit per kunci**. Kelebihan dibalas `429` dengan
header `Retry-After` (detik).

## 3. Izin dan endpoint

| Izin | Endpoint |
| --- | --- |
| `dokumen` | `GET /api/berkas`, `GET /api/berkas/ringkasan`, `POST /api/berkas/unggah`, `DELETE /api/berkas/:id`, `GET /api/berkas/:id/lihat`, `GET /api/berkas/:id/unduh`, `GET /api/analisis`, `GET /api/analisis/:id`, `GET /api/analisis/:id/butir`, `GET /api/butir-data`, `POST /api/analisis/butir/setujui-semua`, `PATCH /api/analisis/butir/:id`, `POST /api/analisis/:id/ulang`, `DELETE /api/analisis/:id`, `GET /api/analisis/kuota`, `GET /api/analisis/kesegaran` |
| `dashboard` | `GET /api/dashboards`, `GET /api/dashboards/:id`, `POST /api/dashboards`, `PATCH /api/dashboards/:id`, `DELETE /api/dashboards/:id`, `POST /api/dashboards/:id/duplicate`, `POST /api/dashboards/:id/halaman`, `POST /api/dashboards/dari-butir`, `GET /api/dashboards/:id/shares`, `POST /api/dashboards/:id/share`, `DELETE /api/share/:token`, `GET /api/widgets/data-katalog`, `GET /api/widgets/ketersediaan`, `POST /api/widgets/ambil-data` |

Selalu ditolak untuk kunci API (balasan `403`, kode `API_KEY_FORBIDDEN`):
`/api/auth/*`, `/api/admin/*`, `/api/me`, `/api/users`, `/api/tenants`,
`/api/permintaan*`, `/api/chat*`, `/api/rag*`, serta sub-jalur AI di bawah
`/api/dashboards` (`/chat`, `/halaman/:id/insight`, `/widget-dari-saran`,
`/rekomendasi`, `/dari-template`). Jalur lain di luar daftar putih juga ditolak
— endpoint baru tidak otomatis terbuka.

Instansi ditentukan oleh kunci, bukan oleh parameter: `?tenantId=` diabaikan,
jadi satu kunci tidak bisa membaca data instansi lain.

## 4. Alur: unggah dokumen → analisis → dashboard

### a. Unggah dokumen

`POST /api/berkas/unggah`, JSON, batas 50 MB berkas (body 70 MB).

```bash
curl -X POST https://aiones.example.com/api/berkas/unggah \
  -H "X-API-Key: $AIONES_KEY" -H 'Content-Type: application/json' \
  -d '{
    "nama": "laporan-2026.pdf",
    "judul": "Laporan Kinerja 2026",
    "kategori": "Dokumen Instansi",
    "tipe": "application/pdf",
    "ukuran": 532144,
    "isiBase64": "..."
  }'
```

Balasan `201`: `{ "success": true, "berkas": { "id": "doc-…", … } }`.
Ekstensi yang diterima: pdf, doc(x), xls(x), ppt(x), txt, csv, md, rtf, odt/ods/odp, jpg/jpeg/png/webp/gif/bmp/tif(f).

Dokumen otomatis masuk antrean analisis. Cek hasilnya:

```
GET /api/analisis?berkasId=doc-…
GET /api/analisis/:id/butir
```

Butir data harus berstatus `disetujui` agar bisa dipakai menyusun dashboard.
`POST /api/analisis/butir/setujui-semua` menyetujui **semua butir berstatus
draf di instansi kunci itu** (tanpa parameter):

```bash
curl -X POST https://aiones.example.com/api/analisis/butir/setujui-semua \
  -H "X-API-Key: $AIONES_KEY"
```

Satu butir bisa diubah statusnya lewat `PATCH /api/analisis/butir/:id`
body `{ "status": "disetujui" }`.

### b. Baca butir yang siap dipakai

```bash
curl "https://aiones.example.com/api/butir-data" -H "X-API-Key: $AIONES_KEY"
```

### c. Susun dashboard dari butir

`POST /api/dashboards/dari-butir` — widget dipilih otomatis dari bentuk data
(deret waktu → garis, perbandingan → batang, dst.).

```bash
curl -X POST https://aiones.example.com/api/dashboards/dari-butir \
  -H "X-API-Key: $AIONES_KEY" -H 'Content-Type: application/json' \
  -d '{
    "butirIds": ["btr-anl-…-82", "btr-anl-…-83"],
    "judul": "Dashboard Kinerja 2026"
  }'
```

Balasan `201`: `{ "dashboard": { "id": "dash-…", "widgets": [ … ] } }`.

Dashboard kosong lalu diisi lewat API juga bisa:

```bash
curl -X POST https://aiones.example.com/api/dashboards \
  -H "X-API-Key: $AIONES_KEY" -H 'Content-Type: application/json' \
  -d '{"title":"Dashboard Mitra","sector":"pendidikan"}'
```

### d. Bagikan ke pengguna platform

```bash
curl -X POST https://aiones.example.com/api/dashboards/dash-…/share \
  -H "X-API-Key: $AIONES_KEY" -H 'Content-Type: application/json' \
  -d '{"mode":"readonly","expiresInDays":30}'
```

`mode: "editable"` menghasilkan PIN 6 angka yang dibuat server (dikirim sekali di
balasan; hanya hash-nya disimpan). Token dibuka di `GET /api/share/:token` tanpa
kunci; tautan editable meminta PIN lewat `POST /api/share/:token/verifikasi-pin`.

## 5. Kode galat

| HTTP | `kode` | Arti |
| --- | --- | --- |
| 401 | `API_KEY_TIDAK_SAH` | Kunci tidak dikenal, sudah dicabut, atau kedaluwarsa |
| 403 | `API_KEY_FORBIDDEN` | Jalur tidak diizinkan untuk kunci ini |
| 429 | `TERLALU_BANYAK_PERCOBAAN` | Lewat 300 permintaan/menit — tunggu `Retry-After` |
| 400 | — | Payload tidak sah (mis. `isiBase64` kosong, ekstensi ditolak) |
| 404 | — | Objek tidak ada / milik instansi lain |

## 6. Catatan operasional

- Pemakaian tercatat: jumlah permintaan dan waktu terakhir dipakai tampil di
  tab **Kunci API** (diperbarui tiap ≤15 detik).
- Rotasi: buat kunci baru, pindahkan platform, lalu cabut yang lama.
- Kunci terikat satu instansi. Kebutuhan lintas instansi = beberapa kunci.
- `curl` tanpa header `Origin` tetap diterima; permintaan browser lintas domain
  ditolak oleh perlindungan CSRF yang sudah ada.
