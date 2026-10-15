# Rencana: Model Jual 1 BUMD + Isolasi Role & RAG

Tanggal: 2026-10-12
Status: **Tahap A & B SELESAI** + **Fitur "Pelaporan Periodik & Kepatuhan" SELESAI** (uji otomatis 14/14 lulus)

## 1. Keputusan Produk (dari pemilik)

| Aspek | Keputusan |
|---|---|
| Model jual | **1 akun = 1 BUMD** (satu pelanggan = satu instansi) |
| Deploy | **Satu instalasi**, isolasi **ketat per akun** (bukan subdomain terpisah) |
| Konfigurasi RAG | **Hanya role `admin`** yang boleh lihat/ubah (Base URL, API Key, KB ID) |
| Role non-admin (analis, direksi) | **DILARANG** menyentuh RAG sama sekali |
| Admin | Boleh mengonfigurasi KB **per user/instansi** |
| Multi-tenant | Dihilangkan dari alur pengguna; fokus satu BUMD |

## 2. Hasil Audit Kode (temuan nyata)

### ✅ Sudah benar
- Semua endpoint `/api/admin/*` dijaga `session.role !== 'admin'` → 403.
  Termasuk: `/api/admin/config`, `/api/admin/knowledge`, `/api/admin/kb-profil`,
  `/api/admin/config-simpan-uji`, `/api/admin/tenants/*/sinkron-rag`, users, tenants.
- Sidebar menyembunyikan menu Panel Admin untuk non-admin (`Sidebar.tsx:266`).
- `Admin.tsx` (panel RAG) hanya dirender pada `viewMode === 'admin'`.

### ❌ Celah yang ditutup (Tahap A)

| # | Lokasi | Masalah | Perbaikan |
|---|---|---|---|
| C1 | `server.ts` `effectiveTenantId()` | User bisa berpindah tenant lewat `?tenantId=` / `body.tenantId` | Non-admin **selalu** dipaksa ke `session.tenantId`; hanya admin boleh pindah |
| C2 | `server.ts` `GET /api/tenants` | Tanpa autentikasi sama sekali | **Wajib login**; non-admin hanya menerima instansinya sendiri |
| C3 | `server.ts` `POST /api/rag-probe` | Hanya `requireAuth`, bukan admin | Naik ke `role === 'admin'` |
| C4 | `Sidebar.tsx` | Dropdown "Ganti Instansi" tampil untuk semua role | Hanya admin; non-admin melihat label statis |
| C5 | `App.tsx` | Tidak ada gerbang rute admin | `viewMode === 'admin'` diblokir untuk non-admin |

**Efek samping yang ditangani:**
- `GET /api/auth/tenants` (baru): endpoint ringkas (id+nama) untuk dropdown pendaftaran; kosong saat `ALLOW_REGISTRATION=false`.
- `Login.tsx`: ambil daftar instansi dari endpoint baru.
- `GET /api/share/:token`: sertakan objek `tenant` di respons → halaman publik tak perlu `/api/tenants`.
- `ShareView.tsx`: pakai `tenant` dari respons share.

### Tahap B — Tegaskan model 1 BUMD (SELESAI)

| Perubahan | File |
|---|---|
| Label tab "BUMD & Tenant" → **"Instansi & KB"**; judul → "Instansi & Knowledge Base" | `adminTabs.ts`, `Admin.tsx` |
| "Instansi BUMD Terhubung (Multi-Tenant Isolation)" → **"Instansi Terhubung"** | `Admin.tsx` |
| Header tabel user "Penugasan BUMD" → **"Instansi"**; "Lintas Instansi" → "Tanpa instansi" | `Admin.tsx` |
| **Tombol "Ubah" per instansi** — modal kini mendukung mode EDIT (POST → PATCH), admin bisa **mengubah Knowledge Base instansi** tanpa hapus-buat ulang | `Admin.tsx` |
| Helper `tutupModalTenant`, `bukaEditTenant`, `bukaTambahTenant` | `Admin.tsx` |

> Inti permintaan pemilik: "di admin bisa konfigurasi user ini KB-nya yang mana".
> Endpoint `PATCH /api/admin/tenants/:id` sudah ada di server, tetapi **UI-nya belum** —
> sekarang ditambahkan tombol "Ubah" yang membuka modal edit berisi KB ID instansi.

### Tahap C — Verifikasi (otomatis: LULUS)

- `npx tsc --noEmit` → **0 error** di `src/` dan `server.ts`.
- Skrip uji isolasi (2 skrip, 19 pemeriksaan) → **semua lulus**: non-admin tak bisa pindah
  tenant, tak bisa baca/tanam dashboard tenant lain, semua endpoint admin & RAG → 403.
- `GET /api/share/:token` tanpa cookie → mengembalikan `tenant` + `accessMode`.
- Bundle `dist/` memuat teks baru (modal edit, label baru).

## 4. Fitur Baru: Pelaporan Periodik & Kepatuhan (SELESAI)

Menjawab pertanyaan pemilik *"bagian 3 itu menambahkan fitur baru, nah itu tambahinnya dimana"*.
Fitur P0 pertama (dari analisis pasar BUMD) sudah diimplementasikan penuh.

### 4.1 Peta titik sisip (jawaban langsung)

| Jenis fitur | Titik sisip |
|---|---|
| Halaman baru (menu sendiri) | `Sidebar.tsx` (tambah tombol grup) + `App.tsx` (union `viewMode` + cabang render + label header) + `src/pages/X.tsx` (file baru) |
| Tab panel admin | `src/components/adminTabs.ts` + `src/pages/Admin.tsx` (`{activeTab === 'x' && …}`) |
| Tipe widget baru | `src/services/spec/widgetTypes.ts` + `src/components/widgets/` |
| Modal/aksi | komponen baru di `src/components/` + tombol pemicu |
| Backend | `server.ts` + `src/services/store/inMemoryDb.ts` & `mysqlStore.ts` |

### 4.2 Yang dibangun

| Lapisan | Berkas | Isi |
|---|---|---|
| Tipe | `src/types/index.ts` | `JenisLaporan`, `StatusLaporan`, `KewajibanLapor`, `LaporanPeriodik`, `RingkasanKepatuhan` |
| Logika | `src/services/laporan/periode.ts` (baru) | kode periode (bulanan/triwulanan/semesteran/tahunan), akhir periode, **tenggat dihitung server**, ringkasan kepatuhan, daftar periode tersedia |
| Penyimpanan | `inMemoryDb.ts` + `mysqlStore.ts` | koleksi `kewajibanLapor` & `laporanPeriodik`; **tabel per-baris** `kewajiban_lapor` & `laporan_periodik` (multi-instance aman); CRUD + cascade saat instansi dihapus |
| API | `server.ts` | `GET/POST /api/pelaporan/kewajiban`, `PATCH/DELETE /api/pelaporan/kewajiban/:id`, `GET/POST /api/pelaporan/laporan`, `DELETE /api/pelaporan/laporan/:id` |
| UI | `src/pages/PelaporanPage.tsx` (baru) | kartu kepatuhan (total/terverifikasi/terkirim/belum/terlambat + % patuh), tab Status vs Kewajiban, modal tambah kewajiban, modal isi laporan |
| Navigasi | `Sidebar.tsx`, `App.tsx` | grup menu baru **"Kinerja & Kepatuhan"** → "Pelaporan Periodik"; rute `viewMode === 'pelaporan'` |

### 4.3 Prinsip yang dipegang

- **Semua angka dihitung dari data nyata** (`KewajibanLapor` + `LaporanPeriodik`); tidak ada status karangan.
- **Tenggat dihitung server** dari `tenggatHari` kewajiban — nilai `deadline` dari klien diabaikan (diuji).
- **Isolasi tetap ketat**: endpoint pelaporan memakai `effectiveTenantId()`, jadi non-admin hanya
  melihat/menyentuh data instansinya. PATCH/DELETE kewajiban instansi lain → **404** (bukan 403,
  agar keberadaannya pun tidak bocor).
- **Idempoten**: mencatat ulang `(kewajiban, periode)` yang sama memperbarui entri, tidak menduplikasi.
- **Cascade**: menghapus kewajiban ikut menghapus laporan yang menunjuk padanya.

### 4.4 Verifikasi

- `npx tsc --noEmit` → **0 error** di `src/` + `server.ts`.
- `npm run build` → sukses, chunk `PelaporanPage-*.js` terbentuk (~19,5 kB).
- Skrip `scripts/tmp-uji-pelaporan.sh` → **14/14 lulus** (wajib login, validasi, tenggat dihitung
  server, idempoten, ringkasan konsisten, isolasi antar-instansi, cascade, kebersihan data).
- Tabel MySQL `kewajiban_lapor` & `laporan_periodik` terkonfirmasi dibuat dengan skema benar.

## 5. Fitur Baru: Impor Excel/CSV (SELESAI)

### 5.1 Masalah yang dijawab

BUMD sudah punya data di Excel/CSV (realisasi, target, daftar aset, dsb.) tetapi dashboard
hanya bisa diisi dari dokumen RAG atau diketik manual. Impor membuka pintu masuk data yang
sudah ada tanpa ketik ulang, dan menjadi fondasi untuk fitur Target vs Realisasi.

### 5.2 Cara kerja (2 langkah)

1. **Unggah & pratinjau** — berkas dikirim sebagai base64 (tanpa middleware multipart),
   diurai **di server** (`xlsx`), dikembalikan sebagai tabel ringkas (kolom, 50 baris contoh,
   deteksi kolom numerik).
2. **Petakan kolom → widget** — pengguna memilih tipe visualisasi, kolom label, kolom nilai
   (boleh >1 seri), kolom target (opsional), satuan. Server mengembalikan `WidgetSpec` yang
   **sudah lolos skema** `WidgetSpecSchema`; klien menyimpannya lewat `PATCH /api/dashboards/:id`
   yang sudah ada (tidak ada jalur tulis baru).

### 5.3 Prinsip yang dipegang

- **Angka dari berkas ≠ dokumen RAG**: widget dibuat `confidence: 'manual'` **tanpa sitasi** —
  tidak menempelkan sumber palsu. (Skema mewajibkan sitasi untuk tipe berbasis data; `manual`
  adalah pengecualian yang sah.)
- **Tidak menebak angka**: nilai tak jelas → `null`, bukan 0. Gaya Indonesia (`1.234,56`),
  internasional (`1,234.56`), `Rp 1.500.000`, `(2.500)` akuntansi, `12,5%` semua dikenali.
- **Impor = alur dashboard yang ada**: satu endpoint baru membangun widget; penyimpanan tetap
  lewat PATCH dashboard, sehingga isolasi tenant & validasi widget otomatis berlaku.
- **Batas aman**: maksimum 25 MB berkas & 20.000 baris per impor (sisanya dilaporkan jujur).

### 5.4 Titik sentuh kode

- `src/services/impor/tabel.ts` — **BARU**, murni (tanpa I/O): `bacaTabel`, `bangunWidgetImpor`,
  `keAngka`, `ringkasPratinjau`. Inilah otak pemetaan tabel → widget.
- `src/components/ImportDataModal.tsx` — **BARU**, modal 2 langkah (drag & drop, pratinjau,
  pemetaan kolom, pratinjau peringatan).
- `server.ts` — 2 endpoint `POST /api/impor/pratinjau` & `POST /api/impor/widget`
  (wajib login, `effectiveTenantId`), batas `express.json({ limit: '25mb' })`, audit log.
- `src/App.tsx` — tombol **"Impor Data"** di toolbar kanvas + state/modal.

### 5.5 Verifikasi

- `npx tsc --noEmit` → **0 error** di `src/` + `server.ts`.
- `npm run build` → sukses.
- Uji unit `scripts/tmp-uji-impor.ts` → **36/36 lulus** (format angka, CSV, XLSX multi-sheet,
  kolom kosong hantu dibuang, chart/KPI/tabel, galat & peringatan, pratinjau).
- Uji end-to-end `scripts/tmp-uji-impor.sh` → **11/11 lulus** (wajib login, pratinjau, bar &
  bullet-target, validasi 400, XLSX, simpan ke dashboard via PATCH, isolasi tenant 404,
  kebersihan data).
- Browser: konsol **0 error**; bundle klien tidak memuat `xlsx` (parsing tetap di server).

## 6. Fitur Baru: Verifikasi Bertingkat (SELESAI)

Alur persetujuan laporan berjenjang: laporan tidak langsung dianggap tuntas, tapi harus
melewati rantai tahap verifikasi yang berurutan.

### 6.1 Aturan yang ditegakkan SERVER (bukan hanya UI)

- **Tidak boleh lompat tahap** — hanya tahap AKTIF yang bisa diselesaikan. Menyetujui tahap
  yang belum gilirannya tidak menambah kemajuan (posisi tetap).
- **Peran harus cocok dengan tahap** (admin selalu boleh). Peran lain → **403**.
- **Revisi wajib pakai catatan** (alasan) → kalau kosong **400**. Tanpa alasan, penyusun tak
  tahu apa yang harus diperbaiki.
- **Sudah tuntas → 409**; belum dikirim → **409**.
- **Setujui tahap terakhir** menaikkan status menjadi `terverifikasi`; **revisi** → `revisi`;
  **kirim ulang setelah revisi** → status `terkirim` dan **reset ke tahap 1** (setujui lama
  sebelum kirim ulang TIDAK dihitung).
- **Riwayat verifikasi tidak pernah dihapus** — menjadi jejak audit permanen, termasuk setelah
  alur dihapus.

### 6.2 Alur bawaan (fallback)

Bila instansi belum punya alur sendiri, laporan memakai **alur bawaan**:
`Verifikasi (analis) → Persetujuan (direksi)`. Laporan baru otomatis memakai alur yang
ditandai `isDefault`.

### 6.3 Berkas

- `src/services/laporan/alur.ts` — **BARU** (~164 baris), murni tanpa I/O: `hitungPosisi`,
  `bolehMenyetujui`, `tahapEfektif`, `validasiAlur`, `buatAksi`, `normalisasiPeran`,
  `ALUR_BAWAAN`, `LABEL_PERAN`, `peranBerhak`.
- `src/types/index.ts` — tipe `AlurVerifikasi`, `AksiVerifikasi`, `TahapVerifikasi`.
- `src/services/store/inMemoryDb.ts` — koleksi `alurVerifikasi` + CRUD; `tambahAksiVerifikasi`;
  `updateLaporanStatus` (ubah HANYA status, tak menyentuh lampiran/tenggat/riwayat); cascade
  `deleteTenant`.
- `src/services/store/mysqlStore.ts` — tabel per-baris **`alur_verifikasi`** (id, tenant_id,
  data, updated_at) + load/upsert/delete + masuk `DbSnapshot`.
- `server.ts` — **4 endpoint `/api/pelaporan/alur`** (GET/POST/PATCH/DELETE, **admin-only**) +
  `POST /api/pelaporan/laporan/:id/verifikasi`.
- `src/pages/PelaporanPage.tsx` — tab baru **"Alur Verifikasi"** (admin kelola alur, maks 5
  tahap, tandai default), tombol **"Verifikasi"** di kartu laporan, modal Tindak Lanjut
  Verifikasi (Setujui / Minta Revisi + catatan + jejak riwayat), modal Alur.
- `src/App.tsx` — prop `peran={currentUser?.role}` ke `PelaporanPage`.

### 6.4 Verifikasi

- `npx tsc --noEmit` → **0 error** di `src/` + `server.ts`.
- `npm run build` → sukses.
- Uji unit `scripts/tmp-uji-alur.ts` → **44/44 lulus** (alur bawaan, posisi, lompat tahap
  ditolak, revisi & kirim ulang reset, hak peran, normalisasi peran, validasi alur, buatAksi).
- Uji end-to-end `scripts/tmp-uji-alur.sh` → **32/32 lulus** (wajib login 401, admin-only 403,
  validasi 400, alur default terpakai, maju tahap, analis tak boleh tahap direksi 403, tuntas →
  terverifikasi, setujui ulang 409, revisi tanpa catatan 400, isolasi tenant 404, hapus alur
  tidak menghapus riwayat).
- **Round-trip restart MySQL TERBUKTI**: alur `ALUR-RESTART-UJI` dibuat → server dimatikan →
  server dinyalakan ulang → alur **ter-load kembali** dari MySQL.
- Browser: konsol **0 error**; string UI baru ada di bundle; `xlsx` tetap tak masuk bundle klien.

## 7. Fitur Baru: Tindak Lanjut Audit BPK/Inspektorat/BPKP (SELESAI)

Pantau temuan hasil pemeriksaan dan tindak lanjut rekomendasinya. `persenTindakLanjut`
adalah **indikator kinerja resmi daerah** (persentase tindak lanjut rekomendasi hasil
pemeriksaan). Dasar: UU 15/2004 & 15/2006, PP 60/2008 (SPIP), Permendagri 37/2018.

### 7.1 Aturan yang ditegakkan SERVER (bukan hanya UI)

- **Mutasi temuan (tambah/ubah/hapus) hanya `admin`** → non-admin **403**.
- **Catat tindak lanjut boleh `analis`** (pekerjaan operasional) — bukan hanya admin.
- **Uraian tindak lanjut wajib** → **400** bila kosong.
- **`tidak_ditindaklanjuti` wajib alasan** → **400** bila kosong. Tanpa alasan, temuan
  tidak boleh "dihilangkan" dari tunggakan secara diam-diam.
- **Isolasi tenant**: temuan instansi lain → **404** (termasuk untuk tindak lanjut & hapus).
- **Persentase = (selesai + tidak_ditindaklanjuti) / total × 100** — mengikuti konvensi IKU
  (rekomendasi yang sudah ada keputusan resmi tetap dihitung "ditangani").

### 7.2 Berkas

- `src/services/audit/tindakLanjut.ts` — **BARU** (~240 baris), murni tanpa I/O:
  `hitungRingkasan`, `validasiTemuan`, `validasiAksi`, `buatAksiTindakLanjut`,
  `normalisasiStatus`, `normalisasiSumber`, `lewatBatas`, `sudahDitangani`, label.
- `src/types/index.ts` — tipe `SumberAudit`, `StatusTindakLanjut`, `AksiTindakLanjut`,
  `TemuanAudit`, `RingkasanAudit`.
- `src/services/store/inMemoryDb.ts` — koleksi `temuanAudit` + CRUD
  (`getTemuanAudit`, `getTemuanAuditById`, `createTemuanAudit`, `updateTemuanAudit`,
  `deleteTemuanAudit`, `tambahAksiTindakLanjut`) + cascade `deleteTenant` + persist/snapshot.
- `src/services/store/mysqlStore.ts` — tabel per-baris **`temuan_audit`** (id, tenant_id,
  data, updated_at) + load/upsert/delete + masuk `DbSnapshot`.
- `server.ts` — **6 endpoint `/api/audit/*`**: `GET /temuan` (+ringkasan, filter
  `?sumber=`&`?status=`), `GET /ringkasan`, `POST /temuan`, `PATCH /temuan/:id`,
  `DELETE /temuan/:id`, `POST /temuan/:id/tindak-lanjut`.
- `src/pages/TindakLanjutAuditPage.tsx` — **BARU** (~1.100 baris): kartu ringkasan (5),
  kartu nilai temuan + progres, tab **Temuan** (filter sumber/status, kartu per temuan
  dengan jejak tindak lanjut) & **Rekap per Sumber**, modal tambah/ubah temuan, modal
  catat tindak lanjut (dengan bukti).
- `src/App.tsx` — lazy import + `viewMode 'auditTl'` + label breadcrumb/judul.
- `src/components/Sidebar.tsx` — entri **"Tindak Lanjut Audit"** di grup **Kinerja & Kepatuhan**
  (`data-testid="buka-tindak-lanjut-audit"`), ikon `ClipboardCheck`.

### 7.3 Verifikasi

- `npx tsc --noEmit` → **0 error** di `src/` + `server.ts`.
- `npm run build` → sukses.
- Uji unit `scripts/tmp-uji-audit.ts` → **55/55 lulus** (normalisasi, `lewatBatas`,
  ringkasan kosong & campuran, pembulatan persen, validasi temuan/aksi, buat aksi).
- Uji end-to-end `scripts/tmp-uji-audit.sh` → **40/40 lulus** (wajib login 401, validasi 400,
  admin-only 403, analis boleh tindak lanjut, `tidak_ditindaklanjuti` wajib alasan, ringkasan
  66.7%, filter, ubah temuan, isolasi tenant 404, hapus).
- **Round-trip restart MySQL TERBUKTI**: temuan dibuat → server dimatikan → dinyalakan ulang →
  temuan **ter-load kembali** dari MySQL.
- Browser: konsol **0 error**; string UI baru ada di bundle.

## 8. Fitur Baru: Kesehatan Keuangan & Rasio (SELESAI)

Bahasa universal penilaian BUMD: rasio dari neraca & laba rugi. Angka ditarik dari
dokumen resmi lewat RAG (atau diisi manual), lalu **rasio dihitung server**.

**Model data** (`src/types/index.ts`): `KomponenKeuangan` (13 field, semua opsional —
`totalAset`, `asetLancar`, `kas`, `liabilitas`, `liabilitasLancar`, `ekuitas`,
`pendapatan`, `labaBersih`, + sektor khusus `kreditBermasalah`/`totalKredit`/`bebanOperasional`/
`pendapatanOperasional`/`nrw`), `RasioKeuangan`, `SnapshotKeuangan`, `RingkasanKeuangan`.

**Service murni** (`src/services/keuangan/rasio.ts`, pola `periode.ts`/`alur.ts`/`tindakLanjut.ts`):
`hitungRasio` (ROA/ROE/DER/current/cash/margin + NPL/BOPO/NRW sektor khusus, tiap rasio
membawa `rumus` + `ambang`), `hitungSkorKesehatan` (0–100), `kategoriDariSkor`,
`lengkapiSnapshot`, `ringkasKeuangan`, `validasiSnapshot`, `normalisasiKomponen/Sitasi`,
`labelPeriodeKeuangan`, `urutPeriodeTerbaru`.

**Ekstraksi RAG** (`src/services/rag/http.ts`): `ekstrakKomponenKeuangan` + `SKEMA_KEUANGAN`
(tiap field wajib bawa `docName`/`page`/`chunkSnippet`) + helper `angkaKeuangan` (format ID
`1.234,56`, "Rp 1.500.000", kurung negatif `(2.500)`, satuan juta/miliar/triliun).
Mode mock sengaja mengembalikan `null` — angka contoh akan jadi rasio kesehatan **palsu**.

**Backend** (`server.ts`): 4 endpoint `/api/keuangan/*` — `GET /ringkasan`,
`GET /snapshot`, `POST /ekstrak` (**admin-only**, 503 bila RAG mati), `POST /snapshot`
(idempoten per periode, analis & admin), `DELETE /snapshot/:id` (**admin-only**).
Penyimpanan: tabel per-baris MySQL **`snapshot_keuangan`** (pola `temuan_audit`).

**UI** (`src/pages/KesehatanKeuanganPage.tsx`): 4 kartu rasio utama + badge kategori &
delta tren, tab **Rasio** (rumus + ambang) & **Komponen** (nilai + sitasi dokumen),
tabel perbandingan periode, modal input + tombol **"Tarik dari Dokumen"** (admin).
Menu di grup **Kinerja & Kepatuhan**.

**Prinsip yang ditegakkan server:**
- **Rasio SELALU dihitung ulang dari komponen** — angka rasio dari klien diabaikan
  (terbukti e2e: rasio palsu `999` → server tetap 3,05%).
- **Angka hilang ≠ nol**: komponen kosong → rasio `null` ("—"), bukan 0 menyesatkan.
- **Idempoten per periode**: periode sama diperbarui, bukan digandakan.
- Isolasi tenant → **404**; ekstrak RAG & hapus snapshot **admin-only → 403**.

**Bukti uji:**
- Unit `scripts/tmp-uji-rasio.ts`: **70/70 lulus** (termasuk parser angka: `1.234.567`→1234567,
  `Rp 1.500.000`→1500000 — 2 bug nyata ditemukan & diperbaiki).
- E2e `scripts/tmp-uji-keuangan.sh`: **31/31 lulus** (validasi, isolasi, idempoten, rasio
  palsu diabaikan, komponen hilang → null).
- Regresi impor/alur/audit: **36+44+55 = semua lulus** (tidak ada yang rusak).
- `tsc --noEmit` **0 error**; `npm run build` sukses; browser konsol **0 error**.
- **Round-trip restart MySQL TERBUKTI**: snapshot 2026-Q3 dibuat → server dimatikan →
  dinyalakan ulang → snapshot **ter-load kembali** lengkap (id, catatan, skor 70, 9 rasio).

## 9. Catatan / Sisa

- **Uji visual panel admin (login admin di browser)** belum dilakukan — password hanya boleh
  diisi via vault, dan situs ini belum terdaftar di vault. Verifikasi di level API + isi bundle.
- **Data user demo — SELESAI 2026-10-14.** Sebelumnya 8 user (termasuk akun demo
  `admin@gmail.com`/`user@gmail.com`) terikat `tenantId: "tenant-pdam"` yang **tidak ada di tabel
  `tenants`** (MySQL memuat 3 instansi nyata). Dampak terbukti: `GET /api/tenants` untuk non-admin
  mengembalikan `[]` sehingga analis melihat dropdown instansi kosong. Diperbaiki dengan memetakan
  ulang kedelapan user ke instansi nyata **PAM Jaya** (`tenant-1791501310547`) lewat
  `PATCH /api/admin/users/:id` — satu-satunya jalur tulis yang menyinkronkan `collections.users`
  DAN tabel `auth_users` sekaligus. Diverifikasi: **0 sisa `tenant-pdam`** di `db.json`,
  `collections.users`, dan `auth_users`; analis kini melihat instansinya (PAM Jaya). Backup
  `data/db.json.bak-tenantpdam-*` dibuat sebelum perubahan.
- **Empat fitur Kinerja & Kepatuhan — SELESAI 2026-10-14.** Ditambahkan berurutan
  (Risiko → Aset → Perjanjian Kinerja → LKjIP), mengikuti pola 3 fitur sebelumnya:
  logika murni di `src/services/` (bisa diuji tanpa server), tabel MySQL per-baris
  (aman multi-instance) + cascade saat instansi dihapus, endpoint API berjaga role,
  halaman baru di grup menu **Kinerja & Kepatuhan**, dan dasar hukum ditampilkan di aplikasi.
  - **Manajemen Risiko** (`src/services/risiko/register.ts`): skor = kemungkinan × dampak,
    heat map 5×5, level rendah/sedang/tinggi/ekstrem. Dasar: PP 60/2008 SPIP, Permendagri 37/2018.
    Uji unit **70/70**, e2e **32/32**.
  - **Manajemen Aset** (`src/services/aset/daftarAset.ts`): penyusutan garis lurus, **tanah tidak
    disusutkan**, nilai buku dihitung server dari field mentah. Dasar: Permendagri 19/2016, 37/2018.
    Uji unit **57/57**, e2e **26/26**.
  - **Perjanjian Kinerja** (`src/services/kinerja/perjanjianKinerja.ts`): capaian dihitung server,
    mendukung **arah maksimal vs minimal** (indikator "semakin rendah semakin baik"). Dasar:
    PermenPANRB 53/2014. Uji unit **65/65**, e2e **32/32**.
  - **LKjIP** (`src/services/kinerja/lkjip.ts`): laporan menautkan Perjanjian Kinerja; capaian
    **ditarik dari indikator PK tertaut**, bukan diketik ulang; tenggat penyampaian akhir Februari
    tahun berikutnya (2 bulan setelah tahun anggaran berakhir). Dasar: Perpres 29/2014 SAKIP,
    PermenPANRB 53/2014. Uji unit **52/52**, e2e **40/40**.
  - Semua fitur: `tsc --noEmit` **0 error**, `npm run build` sukses, browser konsol **0 error**,
    **round-trip restart MySQL TERBUKTI** (data per-baris termuat kembali + angka turunan dihitung
    ulang), dan data uji dibersihkan (tabel `risiko`/`aset`/`perjanjian_kinerja`/`lkjip` = 0 baris).
  - Bug nyata yang ditemukan & diperbaiki saat pengujian: tenggat LKjIP salah bulan
    (`Date.UTC(y+1, 1, 1)` = 31 Jan, seharusnya akhir Feb → `Date.UTC(y+1, 2, 1) - 1`); PATCH
    menerima status tak dikenal (PK & LKjIP) yang seharusnya 400.
- **Manajemen Berkas (KMS) — SELESAI 2026-10-14.** Menu baru di grup **Kinerja & Kepatuhan**
  untuk mengunggah & mengelola berkas instansi di **KMS BUMD** (`https://ragkms.aiones.app`,
  layanan *berbeda* dari RAG query `rag.aiones.app` — tetapi **berbagi vector store yang sama**,
  jadi berkas yang diunggah lewat KMS langsung terbaca chat & dashboard).
  - **Model izin**: SATU API key KMS dapat mengakses **banyak** project, jadi tujuan unggah
    ditentukan `Tenant.kmsOrganizationId` yang **dipetakan manual admin** (panel admin → tab
    Konfigurasi, bagian *KMS — Repositori Berkas*, dan tab Instansi & KB). Instansi yang belum
    dipetakan menjawab `terpetakan: false` + cara perbaikannya — **bukan** "0 berkas" palsu.
  - **Berkas**: logika murni `src/services/berkas/kms.ts` (validasi ekstensi/ukuran, ringkasan,
    filter, format ukuran), klien HTTP `src/services/berkas/kmsClient.ts`
    (`GET /api/organizations`, `GET /api/documents`, `POST /api/documents/upload`,
    `DELETE /api/documents/{id}`, `GET /api/documents/{id}/{view,download}`).
  - **Endpoint**: `GET /api/berkas` (+`?cakupan=all` untuk admin), `GET /api/berkas/ringkasan`,
    `POST /api/berkas/unggah` (base64 JSON — server yang menyusun multipart ke KMS),
    `DELETE /api/berkas/:id` (**admin saja**), `GET /api/berkas/:id/lihat|unduh`
    (**diteruskan server** supaya API key tidak pernah sampai ke browser),
    `GET /api/admin/kms-organisasi`, `POST /api/admin/kms-uji`.
  - **Semua jenis berkas** diterima (PDF, Word, Excel, PowerPoint, teks, gambar), maks **50 MB**;
    batas `express.json` dinaikkan 25 → **70 MB** agar base64 50 MB tetap lolos.
  - **Keamanan kredensial**: `kmsApiKey` selalu keluar **tertopeng** (`kms_*********6b2f`) dari
    `GET/POST /api/admin/config` dan `POST /api/admin/config-simpan-uji`; helper `lindungiKunci()`
    mencegah nilai bertopeng tersimpan sebagai kredensial asli. Uji e2e **54/54**.
  - **Bug nyata yang ditemukan & diperbaiki saat pengujian**: `POST /api/admin/config` semula
    mengembalikan `kmsApiKey` **apa adanya** (bocor ke klien) — masking hanya dipasang di `GET`.
  - Diverifikasi: `tsc --noEmit` **0 error**, `npm run build` sukses (chunk
    `ManajemenBerkasPage-YL0AWt2B.js` 18,85 kB), unggah/daftar/unduh/hapus **sungguhan ke KMS**,
    penjagaan peran (analis 403), dan konfigurasi tersimpan di **db.json + MySQL `kv`**.
    Data uji dibersihkan: **0 sisa berkas uji di KMS** (hanya 2 dokumen Telkom University yang asli),
    4 entri audit artefak uji dihapus, tabel fitur lain tetap 0 baris.
- **Tombol "Perbarui RAG" — SELESAI 2026-10-14.** Di sebelah "Perbarui Semua" (tab Instansi & KB).
  Membaca ulang **katalog knowledge base** langsung dari layanan RAG (`GET {base}/knowledge-bases`)
  sehingga KB baru yang ditambahkan di sumbernya langsung terlihat tanpa menebak ID-nya.
  Panel menampilkan 47 KB dalam tiga kelompok: **Siap dipakai** (rapi & belum terpasang),
  **Sudah dipakai instansi** (menyebut instansi pemakainya), dan **Perlu dicek dulu**
  (pola sisa demo `dm-*`, `kb-vibecontent-*`, `kb_prj_*`, ID huruf besar semua, atau
  **penulisan ganda** yang terdeteksi dari bentuk-normal ID — mis. `kb_pamjaya` vs `kb_pam_jaya`
  dan `kb_tirtamoedal` vs `kb_tirta_moedal`). Dari panel itu admin bisa langsung **"Pakai"**:
  memasang sebuah KB ke instansi terpilih, yang memakai `PATCH /api/admin/tenants/:id` yang
  sudah ada sehingga isi KB langsung tersinkron. Logika murni di `src/services/rag/kbKatalog.ts`;
  endpoint `GET /api/admin/kb-tersedia` (khusus admin, read-only terhadap layanan RAG).
  Uji: unit `scripts/tmp-uji-katalog-kb.ts` (**61 pemeriksaan**).
- **RAG Copilot mengikuti instansi aktif — DIPERBAIKI 2026-10-14.** Keluhan: saat login sebagai
  admin, copilot "ngacak" mengambil KB, bukan KB instansi yang sedang dibuka. Dua bug nyata:
  (1) `App.tsx` mengisi instansi aktif dengan **`data[0]`** — instansi pertama pada daftar,
  bukan instansi milik pengguna yang login. Saat admin login, `handleLoginSuccess` gagal
  menemukan instansinya karena `tenants` masih kosong, lalu efek pemuatan instansi menimpanya
  dengan instansi lain (urutannya arbitrer) → copilot menjawab dari KB instansi yang tidak
  sedang dibuka. Sekarang instansi aktif dicari lewat `currentUser.tenantId`, `handleLogout`
  mengosongkan instansi aktif, dan objek instansi aktif disinkronkan ulang tiap daftar instansi
  dimuat (lewat `onTenantsRefreshed` dari panel admin).
  (2) `ChatPanel` memuat riwayat ke **`/api/chat/umum` tanpa `tenantId`**, sehingga server
  menjawab dengan instansi milik akun admin sendiri sementara jawaban copilot datang dari
  instansi aktif — riwayat dan jawaban berasal dari dua instansi berbeda. Sekarang `tenantId`
  ikut dikirim di setiap permintaan riwayat, `tenantId` masuk daftar dependensi efek, dan
  pesan dikosongkan saat instansi berganti. Ditambah label **"Menjawab untuk <instansi> · <KB>"**
  di header copilot agar sumber jawaban selalu terlihat. Default kolom instansi pada form
  pengguna di panel admin juga tidak lagi `tenantsRes[0]`.
  Bukti: `/api/chat/umum` tanpa `tenantId` → `tenant-1791501310547` (PAM JAYA, 5 pesan);
  dengan `?tenantId=tenant-1791429954407` → chat Tirta Moedal (3 pesan), terpisah.
  Suite isolasi tetap lulus (isolasi-kuat 6/6, isolasi-tenant 13/13).
- **Permintaan JUMLAH widget dihormati + balasan jujur — DIPERBAIKI 2026-10-14.** Keluhan:
  "bisa buatkan saya dashboard dengan 15-20 widget" dijawab "Tentu!" tetapi kanvas hanya
  berisi 2 widget. Dua bug nyata: (1) jumlah widget yang diminta **tidak pernah dibaca**
  dari kalimat pengguna, dan (2) balasan chat mengklaim sukses tanpa menyebut berapa yang
  benar-benar dibuat.
  - **Logika murni baru** `src/services/builder/permintaanWidget.ts`:
    `parsePermintaanJumlahWidget` (rentang "15-20", "20 sampai 25", "8 s/d 10", angka
    tunggal "12 widget"/"6 kartu"/"10 grafik"; batas wajar 40; frasa kualitatif "beberapa
    widget" sengaja TIDAK dipetakan ke angka), `labelJumlahWidget`, `pilihPresetPelengkap`,
    `tipeDasarPreset`, dan `lengkapiWidgetDariKatalog` (best-effort: ambil widget nyata dari
    katalog preset sampai target, buang yang datanya tidak ada di dokumen, batas waktu 75 detik,
    concurrency 3, kandidat di-overshoot supaya kegagalan satu preset tertutup).
  - `generate.ts` membaca permintaan di awal, menambah **Step 3b** pelengkapan dari katalog
    (hanya bila pengguna menyebut jumlah DAN masih kurang DAN klien punya `ambilDataWidget`),
    lalu mengembalikan `permintaanJumlah`, `jumlahWidget`, `jumlahKurang`.
  - `server.ts` menyampaikan apa adanya: kalau kurang → "Anda meminta **15–20 widget**, tetapi
    dokumen baru memuat data untuk **N widget**"; kalau cukup → "Dashboard berisi **N widget**
    sesuai permintaan Anda". Tidak ada lagi klaim jumlah yang tidak ada di kanvas.
  - `ChatPanel.tsx` **menghapus** label teknis internal "Jalur A (LLM JSON)" dan pill
    "N Sitasi" (detail mesin, bukan informasi pengguna), **tetapi mempertahankan** peringatan
    jujur: "DATA CONTOH — bukan dokumen instansi", "Layanan RAG tidak terhubung", dan
    "Dashboard tidak dibuat". (Sisa kata "Sitasi" di bundle hanya di ExportModal & kartu
    statistik Admin — memang bukan pill yang dihapus.)
  - Uji: unit `scripts/tmp-uji-permintaan-widget.ts` (**47 pemeriksaan**, murni) dan
    verifikasi alur `scripts/tmp-verif-jumlah-widget.ts` (**14 pemeriksaan**, klien RAG
    tiruan): minta "15-20 widget" → tepat 20 widget; tanpa menyebut jumlah → tetap 3 widget
    (tidak dipaksa); minta "2 widget" yang sudah terpenuhi → tidak menambah.
  - Verifikasi: `tsc --noEmit` 0 error (src+server), `npm run build` hijau, konsol browser
    0 error, regresi unit lulus (lkjip 52, pk 65, risiko 70, aset 57, katalog-kb 61).
- **Chatbot HANYA meneruskan ke RAG + Jalur B dihapus — DIUBAH 2026-10-14.** Permintaan user:
  "chatbot hanya akan mengirimkan pertanyaan ke RAG, jangan menjawabnya dari project saya" dan
  "untuk katalog widget juga, widgetnya dibuat oleh RAG langsung".
  - **Balasan lokal DIHAPUS dari `/api/chat`.** Dulu "rekomendasi chart"/"widget apa"/"tambah
    widget" dijawab aplikasi sendiri dari `WIDGET_CATALOG` (tanpa menyentuh RAG). Case itu
    dibuang; permintaan semacam itu kini diteruskan ke RAG lewat `/query` (persona + riwayat)
    dan dijawab `qa_answer`/`Chatbot RAG`. Terbukti e2e: `rekomendasi chart apa yang bagus?`
    → `actionTaken: qa_answer` (dulu `recommend`).
  - **"tambahkan widget <indikator>" kini WIDGETNYA DIBUAT RAG.** Case baru di `/api/chat`
    (`mintaTambahWidget`) memanggil `ragClient.ambilDataWidget(indikator, …)` — panggilan yang
    sama dengan tombol Tambah — lalu memasang kartu dari data yang RAG kembalikan. Kalau dokumen
    tidak memuat indikatornya → pesan jujur, TANPA angka contoh. Katalog `WIDGET_CATALOG` tidak
    lagi dipakai untuk menjawab chat.
  - **Jalur B DIHAPUS TOTAL.** `src/services/builder/fromMetadata.ts` dihapus dari repo. Dulu
    jalur itu menyusun widget dari metadata chunk dengan **angka tren & sparkline yang
    di-HARDCODE di kode kita** (`data: [20.2, 21.0, …]`, `sparkline` sintetis, `delta: 5.0`),
    sehingga kanvas bisa menampilkan grafik yang tidak berasal dari RAG. Sekarang angka hanya
    dari RAG lewat Jalur A (`/extract` JSON terstruktur); kalau tidak ada → `Gagal (Dokumen
    Tidak Memadai)` + pesan jujur, dashboard TIDAK dibuat.
  - Tipe `GenerateMode` & `ChatMessage.modeUsed` dibersihkan dari varian `'Jalur B (Agregasi
    Metadata)'`; kartu rekomendasi lokal di `ChatPanel.tsx` (beserta state `sematkan`,
    `handleSematkan`, `RecommendationCards`, helper `ChartIcon`/`getCategoryClass`, prop
    `onAddWidget`) dihapus karena tak ada lagi yang mengirimnya.
  - Bukti e2e terhadap layanan RAG nyata (admin@gmail.com): (1) pertanyaan data → `qa_answer`
    / `Chatbot RAG`, jawaban bersumber dokumen; (2) `rekomendasi chart…` → `qa_answer` (bukan
    `recommend`); (3) `buatkan dashboard kinerja` → `create_dashboard` via `Jalur A (LLM JSON)`,
    8 widget, TIDAK ada satupun widget "Tren Agregasi … (12 Bulan)" atau "Kompilasi Temuan
    Dokumen Resmi (Jalur B - Tanpa AI)".
  - Uji: `scripts/tmp-verif-rag-saja.ts` (**9 pemeriksaan**, klien RAG tiruan — membuktikan
    tanpa `structuredJson` dashboard TIDAK dibuat walau `chunks` ada) dan
    `scripts/tmp-uji-chat-rag-saja.ts` / `tmp-uji-dash-rag-saja.ts` (e2e ke layanan nyata).
  - Verifikasi: `tsc --noEmit` 0 error (src+server), `npm run build` hijau, regresi unit lulus
    (permintaan-widget 47, lkjip 52, pk 65, risiko 70, aset 57).
- Skrip uji `scripts/tmp-uji-*.sh` / `*.ts` sudah tercakup `.gitignore` (`tmp-*`).

## 10. Yang TIDAK diubah
- Remote git tetap `Salmanridhwan/ApexPulse`.
- Key tema `apexpulse-theme`, password demo, nama DB `bumd_aionesboard`.
- Struktur multi-tenant di data (tetap ada sebagai wadah isolasi), hanya alur penggunanya dibatasi.
