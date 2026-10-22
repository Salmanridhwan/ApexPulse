# Referensi API Aiones Boards

Dokumen ini untuk keperluan integrasi internal (skrip, alat bantu, atau tim
front-end). Semua jalur diawali `/api` dan mengirim/menerima JSON kecuali
disebut lain.

## Autentikasi

Sesi dikirim lewat cookie `aionesboard_session` (HttpOnly, `SameSite=Lax`,
`Secure` saat produksi). Cookie dibuat oleh endpoint login — tidak ada token
Bearer.

| Metode | Jalur | Keterangan |
|---|---|---|
| `POST` | `/api/auth/login` | Body `{ email, password }`. Balasan 200 berisi data pengguna + cookie sesi. Bila kata sandi masih sementara, balasan memuat `mustChangePassword: true` dan semua endpoint lain menolak dengan **403 `MUST_CHANGE_PASSWORD`** sampai diganti. |
| `POST` | `/api/auth/logout` | Menghapus cookie sesi. |
| `POST` | `/api/auth/ganti-password` | Body `{ lama, baru }`. Wajib memakai sesi aktif. Kata sandi baru minimal 10 karakter, harus ada huruf & angka, dan berbeda dari yang lama. |
| `POST` | `/api/auth/register` | Pendaftaran mandiri (bisa ditutup lewat `ALLOW_REGISTRATION=false`). |

Pembatas percobaan (per instance, jendela 15 menit kecuali disebut lain):

| Aksi | Batas |
|---|---|
| Login per IP | 30 percobaan / 15 menit |
| Login per akun | 10 percobaan / 15 menit |
| Pendaftaran | 5 / jam per IP |
| Unggah berkas | 20 / jam per akun |

Saat batas terlampaui, balasan **429** dengan header `Retry-After` (detik).

Alamat `/api/...` yang tidak dikenal dibalas `404` JSON
`{ error, kode: 'TIDAK_DITEMUKAN' }` — tidak pernah HTML halaman aplikasi.

Format galat:

```json
{ "error": "Pesan yang aman ditampilkan ke pengguna", "kode": "2d99da77" }
```

`kode` sama dengan header `X-Request-Id` permintaan tersebut dan tercetak di log
server (`req=2d99da77`) — sebutkan kode ini saat melapor agar operator bisa
menemukan baris log yang tepat. Galat 5xx tidak pernah menyertakan detail
teknis ke klien.

## Log audit

| Metode | Jalur | Keterangan |
|---|---|---|
| `GET` | `/api/audit-logs` | Tanpa parameter: seluruh entri instansi (array) — dipertahankan untuk klien lama. |
| `GET` | `/api/audit-logs?limit=50&offset=0` | Berhalaman: `{ logs, total, limit, offset }`, urutan **terbaru dulu**. `limit` 1–200 (default 50). |
| `GET` | `/api/audit-logs?format=csv` | Unduh CSV seluruh entri instansi (`text/csv`, UTF-8 + BOM, siap dibuka di Excel). |
| `POST` | `/api/audit-logs` | Body `{ action, target, details }` → `201 { id }`. |

Contoh:

```bash
curl -s -b cookie.txt 'http://127.0.0.1:3000/api/audit-logs?limit=2&offset=0'
```

## Dashboard

| Metode | Jalur | Keterangan |
|---|---|---|
| `GET` | `/api/dashboards` | Daftar dashboard milik instansi pada sesi. |
| `GET` | `/api/dashboards/:id` | Satu dashboard beserta widget-nya. |
| `PUT` / `PATCH` | `/api/dashboards/:id` | Ubah judul/deskripsi/widget. |
| `POST` | `/api/dashboards/:id/share` | Body `{ mode: 'readonly' \| 'editable', expiresInDays }`. Untuk mode `editable`, balasan memuat `pin` (6 angka) **satu kali saja** — server hanya menyimpan hash-nya. |

## Tautan bagikan (publik, tanpa sesi)

| Metode | Jalur | Keterangan |
|---|---|---|
| `GET` | `/api/share/:token` | Data dashboard untuk tautan. Token kedaluwarsa/dicabut → **410**. |
| `POST` | `/api/share/:token/verifikasi-pin` | Body `{ pin }` → 200 bila cocok, 401 bila salah. Maksimal **10 percobaan / 15 menit** per tautan+IP; setelah itu **429** dengan `Retry-After`. |
| `PATCH` | `/api/share/:token` | Menyimpan perubahan widget. Tautan `editable` **wajib** menyertakan header `x-share-pin`; tanpa itu 401 `PIN_SALAH`. |

## Berkas

| Metode | Jalur | Keterangan |
|---|---|---|
| `GET` | `/api/berkas` | Daftar berkas instansi. |
| `GET` | `/api/berkas/ringkasan` | Ringkasan jumlah dokumen. |
| `POST` | `/api/berkas/unggah` | Unggah berkas (base64). Batas body 70 MB **hanya** di jalur ini; endpoint lain 2 MB. |

## Admin

Semua jalur ini memerlukan peran `admin`.

| Metode | Jalur | Keterangan |
|---|---|---|
| `GET` | `/api/admin/stats` | Angka ringkas (instansi, pengguna, dashboard, widget). |
| `GET` | `/api/admin/users` | Daftar pengguna. |
| `POST` | `/api/admin/users` | Tambah pengguna → `201` memuat `sandiSementara` **satu kali**; pengguna wajib menggantinya saat login pertama. |
| `POST` | `/api/admin/users/:id/reset-password` | Membuat sandi sementara baru untuk pengguna tersebut. |
| `GET` / `PUT` | `/api/admin/config` | Konfigurasi sistem. Kunci API yang dikembalikan selalu **disamarkan**; mengirim balik nilai tersamar akan mempertahankan kunci lama. |

## Kesehatan

| Metode | Jalur | Keterangan |
|---|---|---|
| `GET` | `/health` | Status server + `uptimeDetik`, `memoriMB`, `dbMs` (latensi MySQL), dan `cadangan: { terakhir, umurJam, terlambat }`. `terlambat: true` berarti cadangan terakhir lebih dari 26 jam — penjadwal berhenti atau disk bermasalah. Dipakai pemantauan luar. |

## Catatan umum

- Semua respons API diberi `Cache-Control: no-store` (data instansi tidak boleh
  tersimpan di cache bersama) dan `X-Request-Id`.
- Isolasi instansi ditegakkan dari sesi: parameter `tenantId` pada kueri hanya
  berpengaruh untuk peran yang berhak, bukan cara berpindah instansi.
- Batas ukuran body: 2 MB untuk semua endpoint, 70 MB khusus unggah berkas.
