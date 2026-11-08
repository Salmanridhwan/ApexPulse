# Verifikasi uji E2E + audit UX: peran `admin` (instansi) & `pengguna`

Tanggal: 2026-11-08 · Melanjutkan `docs/2026-11-08_laporan-uji-peran-pengguna-admin.md`.
Alat: `npm run test:e2e:peran` → `scripts/e2e-peran.mjs` (Puppeteer + Chrome terpasang, 64 langkah, semuanya
lewat layar: klik tombol, baca teks DOM yang benar-benar dirender, PNG per langkah) + `ux-probe` 3 viewport.

Lingkungan run final: server uji sendiri di `127.0.0.1:3222` (`E2E_PORT=3222`), direktori data `mkdtemp` yang
dihapus di akhir, stub repositori dokumen (KMS) lokal, `MYSQL_PORT=3307` + database dummy, `BACKUP_OTOMATIS=0`,
`SMTP_HOST=''`, `S3_BUCKET=''`. `data/db.json` dev tidak dibaca maupun ditulis.
Sesi disuntik (cookie HttpOnly + `localStorage.aionesboard_user`); tidak ada sandi yang diketik ke halaman.
Dua konteks browser terpisah (`createBrowserContext`) supaya login peran kedua tidak menimpa sesi peran pertama.

Di direktori data sementara disemai dua baris milik **instansi lain** (`tenant-bank`): satu permintaan data
(`RAHASIA-INSTANSI-LAIN…`) dan satu aturan ambang batas. Keduanya oracle uji isolasi — kalau muncul di layar
admin/pengguna `tenant-pdam`, berarti bocor.

## 1. Ringkasan

| Hal | Hasil |
|---|---|
| Langkah lulus | **64 / 64** |
| Temuan tersisa di layar | **0** |
| Temuan `major` yang diperbaiki lalu dibuktikan ulang | **3 dari 3** (lihat §9) |
| Klaim yang tadinya belum terbukti | **2 dari 2 terbukti** (penolakan berdalasan, riwayat chat lintas muat ulang) |
| Galat konsol / page error | **0** |
| Request 4xx–5xx tak terduga | **0** (403 uji negatif & 404 probe yang disengaja dikecualikan) |
| Temuan produk tersisa | 4 `minor`/`nit` (sengaja belum diubah, alasannya di §9.2) |
| Data uji | direktori sementara dihapus; `data/db.json` dev tidak tersentuh |

Artefak run final (setelah perbaikan): `%LOCALAPPDATA%/hermes/cache/scratch/peran-artifacts4` (57 PNG + `hasil.json`).

## 2. Cacat harness yang diperbaiki, dan buktinya

Lima cacat yang membuat laporan sebelumnya tidak bisa dipakai sebagai gerbang:

| # | Cacat | Perbaikan | Bukti hasil |
|---|---|---|---|
| 1 | `pilihPermintaan()` mencari `dataDiminta` di **kartu daftar** — kartu hanya memuat bidang + status ("Keuangan · 0 hari lalu"), jadi tidak pernah cocok | kartu diklik satu per satu, kecocokan diperiksa dari **isi panel detail** | `kartu#1` / `sudah-terbuka` di langkah 41–47 |
| 2 | Daftar milik peran lain **basi**: permintaan yang baru dibuat pengguna tidak muncul di Kotak Masuk admin yang sudah dirender | helper `muatUlangPermintaan()` (`page.reload()` lalu buka lagi daftar) sebelum memilih data baru | langkah tolak: `kartu=kartu#1 · form=true · isi=true · kirim=true` |
| 3 | Assertion status dibaca dari **seluruh halaman**, sehingga chip filter "Selesai (0)"/"Ditolak (0)" membuat uji hijau palsu | semua assertion status/alasan dibatasi ke `[data-testid="panel-detail-permintaan"]` (`teksDetail()`) | `detail: "Perlu Data"=true`, `detail: Ditolak=true alasan tampil=true` |
| 4 | Panel asisten menutupi **seluruh layar** saat probe 390 px → 3 tangkapan halaman pengguna identik byte, skornya tidak sah | panel ditutup (muat ulang) sebelum loop probe; statusnya dicatat di log | 9/9 tangkapan mobile md5 **berbeda**; skor pengguna naik (§6) |
| 5 | Probe `GET /api/chats/:id` dijalankan dari dalam halaman → 404 tercatat sebagai galat konsol & request, memerahkan dua gerbang | probe dipindah ke Node (`fetch` + cookie sesi) | "tidak ada galat konsol" bersih · "tidak ada request 4xx/5xx" bersih |

Cara menjalankan (penting bila ada sesi lain di repo — port bentrok menghasilkan run palsu):

```bash
E2E_PORT=3222 OUT_DIR="<dir artefak>" npm run test:e2e:peran
```

Run pertama pada port default 3212 bertabrakan dengan run sesi lain (PID 11160 + server 20432): server uji
tidak pernah benar-benar hidup, semua langkah jadi 401/`ERR_CONNECTION_REFUSED`, dan skor UX tampak "100"
karena halaman mati. Run itu dibuang, bukan dilaporkan.

## 3. Kontrak uji dan hasil per langkah

Kontrak diturunkan dari `docs/2026-11-08_fitur-admin-instansi-pengguna.md` (peta dua peran + alur lintas
peran). Kolom bukti = nama PNG di folder artefak run final (viewport 1440×900).

### 3.1 Admin instansi — navigasi & panel (4–8)

| # | Aksi | Harapan yang bisa gagal | Hasil | Bukti |
|---|---|---|---|---|
| 4 | buka sidebar + panel admin | Kotak Masuk, Jejak Audit, **tepat 3** tab panel | ✔ | `01-admin-sidebar.png` |
| 5 | periksa tab panel | tab `rag`/`kuota`/`tenants`/`audit` **tidak ada di DOM** | ✔ | `02-admin-overview.png` |
| 6 | tab Ringkasan | kartu angka instansinya tampil | ✔ | `02-admin-overview.png` |
| 7 | tombol tambah instansi + `POST /api/admin/tenants` | tombol tidak tampil DAN endpoint 403 | ✔ (0 tombol · 403) | `02-admin-overview.png` |
| 8 | "Lihat Seluruh Log" | log audit instansi terbuka | ✔ | `03-admin-lihat-log.png` |

### 3.2 Admin instansi — kelola akun (9–15)

| # | Aksi | Harapan | Hasil | Bukti |
|---|---|---|---|---|
| 9 | tab Pengguna | tabel akun instansinya + kotak "Permintaan Bergabung" | ✔ | `04-admin-users.png` |
| 10 | modal "Tambah Pengguna Baru" | akun baru muncul di tabel | ✔ | `05-admin-tambah-pengguna.png` |
| 11 | reset sandi | banner sandi sementara muncul sekali | ✔ | `06-admin-reset-sandi.png` |
| 12 | ubah peran lewat `<select>` | nilai select berubah | ✔ | `07-admin-ubah-peran.png` |
| 13 | hapus akun uji | baris hilang | ✔ | `07-admin-ubah-peran.png` |
| 14 | register dari luar | pendaftar tampil di "Permintaan Bergabung" | ✔ | `08-admin-permintaan-gabung.png` |
| 15 | "Setujui" | akun aktif — login pendaftar HTTP 200 | ✔ | `08b-admin-setujui.png` |

### 3.3 Admin instansi — ambang batas (16–18)

| # | Aksi | Harapan | Hasil | Bukti |
|---|---|---|---|---|
| 16 | tab Ambang Batas | aturan instansinya tampil | ✔ | `09-admin-alerts.png` |
| 17 | ubah ambang lewat prompt | nilai tersimpan (25 → 30) | ✔ | `09-admin-alerts.png` |
| 18 | tambah aturan lewat form panel | aturan tersimpan & tampil | ✔ (1 → 2) | `09b-admin-tambah-aturan.png` |

### 3.4 Workspace & batas tulis (19–24)

| # | Aksi | Harapan | Hasil | Bukti |
|---|---|---|---|---|
| 19 | admin "Dashboard Baru" | dashboard 0 → 1 & editor terbuka | ✔ | `11-admin-dashboard-baru.png` |
| 20 | header workspace admin | tombol tulis (Impor Data/Bagikan) **ada** | ✔ | `10-admin-workspace.png` |
| 21 | pengguna buka workspace | dashboard buatan admin tampil | ✔ | `12b-user-workspace-dashboard.png` |
| 22 | pengguna buka dashboard | tanpa Impor Data / Gaya Semua / Bagikan / Hapus **dan** tanpa kontrol halaman (`button[title]`: tambah/pensil/hapus/geser) | ✔ | `12c-user-menu-aksi.png`, `12e-user-empty-state.png` |
| 23 | empty state kanvas untuk pengguna | teks pembaca ("Dashboard ini masih kosong" / "Tanya lewat Asisten"), tanpa ajakan menyusun | ✔ | `12e-user-empty-state.png` |
| 24 | pengguna coba hapus | tidak ada tombol hapus; `DELETE` = 403; dashboard utuh | ✔ | `12c-user-menu-aksi.png`, `12d-user-hapus-ditolak.png` |

### 3.5 Repositori dokumen (25–27, 52–54)

| # | Aksi | Harapan | Hasil | Bukti |
|---|---|---|---|---|
| 25 | admin unggah berkas | berkas muncul | ✔ | `13-admin-berkas-unggah.png` |
| 26 | admin hapus berkas | baris hilang | ✔ | `13-admin-berkas-unggah.png` |
| 27 | tombol hubungkan KMS | tersembunyi saat sudah terpetakan | ✔ | `13-admin-berkas-unggah.png` |
| 52 | pengguna buka repositori | daftar termuat | ✔ | `33-user-berkas.png` |
| 53 | pengguna unggah berkas | berkas tampil | ✔ | `34-user-berkas-unggah.png` |
| 54 | pengguna cari tombol hapus | **tidak ada** | ✔ | `34-user-berkas-unggah.png` |

### 3.6 Jejak audit (28–29)

| # | Aksi | Harapan | Hasil | Bukti |
|---|---|---|---|---|
| 28 | buka Jejak Audit | tabel audit + tombol ekspor | ✔ | `14-admin-audit.png` |
| 29 | "Ekspor CSV" | `text/csv`, >1 baris | ✔ (17 baris) | `14-admin-audit.png` |

### 3.7 Pengguna — navigasi & permintaan (30–35)

| # | Aksi | Harapan | Hasil | Bukti |
|---|---|---|---|---|
| 30 | sidebar pengguna | label "Permintaan Data", tanpa Kotak Masuk/Jejak Audit/Panel Admin, 0 tab | ✔ | `20-user-sidebar.png` |
| 31 | workspace pengguna | tidak ada tombol buat dashboard | ✔ | `21-user-workspace.png` |
| 32 | header workspace pengguna | tanpa Impor Data / Bagikan / Gaya | ✔ | `21-user-workspace.png` |
| 33 | ajukan permintaan data | tampil di daftar | ✔ | `23-user-permintaan-baru.png` |
| 34 | tulis catatan | catatan tampil di riwayat | ✔ | `24-user-catatan.png` |
| 35 | `PATCH` status sebagai pengguna | 403 "Status permintaan hanya bisa diubah admin instansi" | ✔ | API |

### 3.8 Alur lintas peran — permintaan data (36–48)

| # | Aksi | Harapan | Hasil | Bukti |
|---|---|---|---|---|
| 36 | admin buka Kotak Masuk | permintaan pengguna tampil sebagai kartu | ✔ | `30-admin-kotak-masuk.png` |
| 37 | "Ambil & proses" | status → `diproses` | ✔ | `31-admin-permintaan-diproses.png` |
| 38 | form Tolak tanpa alasan | "Kirim penolakan" **disabled** | ✔ | `31-admin-permintaan-diproses.png` |
| 39 | pengguna buka detail | status "Diproses" terbaca | ✔ | `32-user-status-diproses.png` |
| 40 | notifikasi pengguna | "…kini diproses" masuk | ✔ | API + panel |
| 41 | "Minta data tambahan" | status **Perlu Data** terbaca di panel detail | ✔ | `31b-admin-perlu-data.png` |
| 42 | "Ambil & proses" lagi | kembali **Diproses** | ✔ | `31c-admin-kembali-diproses.png` |
| 43 | "Tandai selesai" | admin **dan** pengguna melihat "Selesai" di panel detail | ✔ | `31d-admin-selesai.png`, `32b-user-selesai.png` |
| 44 | pengguna hapus permintaannya (status Baru) | kartu hilang dari daftar | ✔ | `32c-user-hapus-permintaan.png` |
| 45 | pengguna ajukan permintaan ketiga | tampil di daftar | ✔ | `32d-user-permintaan-ketiga.png` |
| 46 | admin tolak dengan alasan | "Ditolak" + alasan tersimpan di panel detail | ✔ | `31e-admin-tolak.png` |
| 47 | pengguna lihat penolakan | "Ditolak" + alasan tampil di panel detail pengguna | ✔ | `32e-user-ditolak.png` |
| 48 | admin hapus permintaan lewat kontrol di layar | tombol ada, konfirmasi dua langkah, kartu 2 → 1, hilang dari API | ✔ | `31g-admin-konfirmasi-hapus.png`, `31h-admin-hapus-permintaan.png` |

### 3.9 Isolasi instansi (49–51)

| # | Aksi | Harapan | Hasil | Bukti |
|---|---|---|---|---|
| 49 | Kotak Masuk admin | `RAHASIA-INSTANSI-LAIN` tidak muncul; kartu instansinya ada | ✔ (2 kartu, 0 bocor) | `37-admin-isolasi-kotak-masuk.png` |
| 50 | tab Ambang Batas admin | aturan instansi lain tidak muncul | ✔ | `38-admin-isolasi-alerts.png` |
| 51 | Permintaan Data pengguna | data instansi lain tidak muncul | ✔ | `39-user-isolasi-permintaan.png` |

### 3.10 Pengguna — chat, template, uji negatif (55–61)

| # | Aksi | Harapan | Hasil | Bukti |
|---|---|---|---|---|
| 55 | chat asisten | pesan terkirim & ada balasan, tersimpan di percakapan umum | ✔ | `35-user-chat.png` |
| 56 | Template Dashboard & Galeri Chart | dua halaman terbuka & berisi (4.670 & 5.871 karakter) | ✔ | `35b-…`, `35c-…` |
| 57 | muat ulang lalu buka chat | pertanyaan sebelumnya masih tampil | ✔ | `35d-user-chat-riwayat.png` |
| 58 | `POST/PATCH/DELETE /api/alerts` sebagai pengguna | 403 semua | ✔ (403/403/403) | API |
| 59 | tulis dashboard/impor/analisis/usulan/audit/tenants/hapus berkas | 403 semua | ✔ (7×403) | API |
| 60 | buka `#/v/alerts` sebagai pengguna | halaman pengelolaan tidak terbuka | ✔ | `36-user-alerts.png` |
| 61 | jejak audit | aksi kedua peran tercatat | ✔ (26 entri; "Ubah Status Permintaan Data", "Setujui Pendaftaran") | `14-admin-audit.png` |

### 3.11 Gerbang teknis (62–64)

| # | Aksi | Harapan | Hasil |
|---|---|---|---|
| 62 | probe UX 9 halaman × 2 viewport | terukur, panel asisten tertutup | ✔ |
| 63 | galat konsol & page error | 0 | ✔ bersih |
| 64 | request ≥400 tak terduga | 0 | ✔ bersih |

## 4. Dua klaim yang tadinya belum terbukti — sekarang terbukti

**4.1 Penolakan berdalasan (langkah 46–47).** `31e-admin-tolak.png`: panel detail admin menampilkan badge
**"Ditolak"**, kotak merah **"Alasan penolakan: Data sudah tersedia di dashboard produksi."**, dan toast
"Status diubah menjadi Ditolak."; daftar memuat 2 kartu (Ditolak 1, Selesai 1). `32e-user-ditolak.png`:
pengguna melihat hal yang sama dari sisinya — badge "Ditolak" + alasan yang sama, tanpa kontrol ubah
status/hapus. Penyebab kegagalan sebelumnya murni daftar basi (§2 butir 2), bukan bug produk.

**4.2 Riwayat chat lintas muat ulang (langkah 57).** `35d-user-chat-riwayat.png`: pertanyaan
"Apa isi laporan kinerja terbaru?" masih tampil setelah `page.reload()`, dan `/api/chat/umum` menyimpan
pesannya. Sebelumnya gagal karena pertanyaannya dikirim saat **dashboard aktif** (chat per-dashboard),
sementara setelah reload konteksnya kembali ke percakapan umum. Catatan pendamping: tidak ada endpoint
`GET /api/chats/:id` untuk membaca isi pesan (404) — riwayat hanya bisa dibaca lewat `/api/chat/umum` atau
`/api/dashboards/:id/chat`. Bukan temuan UX, tapi menjelaskan mengapa probe lama tidak bisa memverifikasi.

## 5. Temuan produk

| # | Severity | Temuan | Bukti | Status / tindakan |
|---|---|---|---|---|
| 1 | **major** | `pengguna` masih melihat kontrol tulis **tingkat halaman** di kanvas: chip "Halaman 1" dengan **ikon pensil** (ganti nama) dan tombol **"+ Halaman"**. Server menolak (`butuhPenulis`), jadi tombolnya selalu gagal. Ikon hapus/geser halaman tidak tampil pada keadaan ini. | `21-user-workspace.png`; `src/App.tsx:1464-1472` meneruskan `onTambah/onGantiNama/onHapus/onGeser` tanpa cek peran | **Diperbaiki & dibuktikan (§9.1)** — handler geser dikirim hanya untuk admin; uji langkah 22 diperketat ke `button[title]` |
| 2 | **major** | Empty state kanvas untuk `pengguna` memakai bahasa penyusun: judul "Bangun dashboard pertama Anda", teks "…atau susun sendiri dari preset", CTA utama "Buat via Chat". Pengguna tidak boleh menyusun dashboard; hasil chat hanya bisa diterapkan admin. | `21-user-workspace.png` | **Diperbaiki & dibuktikan (§9.1)** — prop `bolehMenyusun`; judul/teks pembaca + CTA "Tanya lewat Asisten" |
| 3 | **major** | Admin Instansi tidak punya kontrol **hapus permintaan** di layar, padahal server mengizinkannya kapan saja (`DELETE /api/permintaan/:id` = **200**, baris hilang dari API). Kontrol itu hanya dirender untuk pemohon non-admin saat status `baru`. | `31f-admin-tanpa-hapus.png`; `PermintaanDataPage.tsx:497-505` | **Diperbaiki & dibuktikan (§9.1)** — tombol "Hapus permintaan" + konfirmasi dua langkah di panel |
| 4 | minor | Label "TOTAL BUMD" di Ringkasan admin instansi menampilkan **1** (instansinya) sementara log boot menyebut "6 tenant BUMD"; admin bisa membacanya sebagai data salah. | `02-admin-overview.png` | Untuk peran `admin`, ganti label jadi "Instansi Anda"; sub-label "dari 6 instansi platform" hanya untuk superadmin |
| 5 | minor | Target sentuh < 44 px di 390 px: 12 item di Repositori Dokumen (ikon 26×26, tombol tanpa nama 24×24), 12 di Permintaan Data (chip filter 60×27, "Segarkan" 40×28), 9 di Kotak Masuk admin. | `ux-user-berkas-390.png`, `ux-admin-permintaan-390.png` (angka probe) | Besarkan **area klik** ke 44×44 (lapisan transparan / padding + margin negatif) dan beri `aria-label` pada tombol tanpa nama |
| 6 | minor | Salah ketik "pangkalan **retrival** dokumen" di Ringkasan; nama pengguna terpotong di footer sidebar ("Admin Instansi - Perumda Air Minum Tirta…") walau ruang tersedia. | `02-admin-overview.png` | Perbaiki ejaan; beri `title` atau lebar cukup untuk baris peran |
| 7 | nit | Kartu "PROVIDER RAG" menampilkan **teks** ("Mock Lokal") seukuran angka KPI sehingga mendominasi baris; hanya muncul saat RAG belum dikonfigurasi. | `02-admin-overview.png` | Turunkan tipografi kartu non-angka; tampilkan "Belum dikonfigurasi" alih-alih nama stub |

Temuan #1–#3 sudah diperbaiki dan dibuktikan ulang (§9.1). Sudah **tidak** lagi temuan (terbukti diperbaiki di layar): tombol "Tambah Instansi BUMD" untuk admin (7),
tombol tambah aturan di tab Ambang Batas (18), kontrol tulis dashboard untuk pengguna — Impor/Gaya/Bagikan/Hapus
(22–24), `POST/PATCH/DELETE /api/alerts` untuk pengguna (58), halaman `#/v/alerts` untuk pengguna (60),
riwayat chat lintas muat ulang (57).

## 6. Skor audit UX (lapis angka)

| Layar | Desktop | Mobile 390 px |
|---|---|---|
| admin-overview | 93 | 93 |
| admin-users | 97 | 95 |
| admin-alerts | 96 | 92 |
| admin-permintaan | 94 | 86 |
| admin-berkas | 92 | 83 |
| admin-audit | 93 | 90 |
| user-workspace | 95 | 90 |
| user-permintaan | 94 | 86 |
| user-berkas | 92 | 83 |

Skor mobile halaman pengguna **kini sah**: panel asisten ditutup sebelum probe, dan 9/9 tangkapan 390 px punya
md5 berbeda (sebelumnya 3 di antaranya identik byte). Penyebab skor mobile rendah konsisten: target sentuh
< 44 px (chip filter, ikon aksi baris tabel, "Segarkan") dan tabel yang belum berubah jadi kartu di lebar kecil.
Kontras: 0 pelanggaran di semua layar. Font < 11 px: 10–12 elemen per layar (label sidebar & sub-label KPI).

## 7. Yang tidak diuji

- **CTA "Buat via Chat" untuk pengguna** — apakah menghasilkan usulan yang bisa diterapkan admin atau jalan
  buntu. Kandidat temuan lanjutan dari temuan #2.
- **Analisis AI dokumen & kuota harian** (`POST /api/analisis`, `GET /api/analisis/kuota`) — butuh RAG/AI
  nyata; di server uji hanya stub.
- **KMS/RAG produksi**: seluruh uji memakai stub lokal; pesan "Daftar dokumen di basis sedang tidak bisa
  dibaca" berasal dari ketiadaan RAG di server uji, bukan bug.
- **Login Google** (`accounts.google.com/gsi/button` 403 — origin belum terdaftar).
- **Peran `superadmin`** — punya suite sendiri (`npm run test:e2e:admin`).
- Notifikasi email/WhatsApp (kanal eksternal tidak dikonfigurasi).
- Perilaku lintas **instansi** untuk pengguna yang terdaftar di dua instansi (hanya 1 akun per instansi diuji).

## 8. Vonis

Alur kedua peran **lulus di layar**: navigasi & batas panel per peran, kelola akun + persetujuan pendaftaran,
ambang batas (termasuk tambah aturan lewat form), repositori dokumen, jejak audit + ekspor CSV, permintaan data
penuh (ajukan → catat → proses → perlu data → selesai → tolak berdalasan → hapus oleh admin, dari kedua sisi),
chat + riwayat, serta isolasi instansi (0 kebocoran pada 3 pemeriksaan). Gerbang teknis bersih: 0 galat konsol,
0 request tak terduga. Suite kini bisa dipakai sebagai gerbang regresi (`E2E_PORT` untuk isolasi).

**Siap dirilis untuk lingkup yang diuji.** Tiga temuan `major` sudah diperbaiki di kode produk dan dibuktikan
ulang lewat run baru yang mengklik layar (§9). Empat temuan `minor`/`nit` sengaja dibiarkan pada putaran ini;
tidak satu pun memblokir peran, dan alasannya dicatat di §9.2 supaya tidak terlihat seperti kelalaian.

## 9. Perbaikan temuan `major` dan bukti ulang

Run pembuktian: `E2E_PORT=3222 OUT_DIR=…/peran-artifacts4 npm run test:e2e:peran` → **64/64 langkah OK, 0 temuan**,
0 galat konsol, 0 request tak terduga. `npm run lint` (tsc) bersih, `npm run build` sukses.

### 9.1 Tiga perbaikan

| # | Akar masalah | Perbaikan | Bukti di layar |
|---|---|---|---|
| 1 | `src/App.tsx` meneruskan `onGeser={geserHalaman}` ke `HalamanTabs` tanpa cek peran, jadi panah geser halaman dirender untuk `pengguna` (dan `onTambah/onGantiNama/onHapus` hanya kebetulan tertutup oleh gerbang lain). | Handler geser dikirim bergantung peran: `onGeser={isAdminRole(currentUser?.role) ? geserHalaman : undefined}`. Komponen sudah menerima handler opsional, jadi tidak ada tombol yang dirender tanpa aksi. | `12e-user-empty-state.png` — strip halaman hanya berisi tab "Halaman 1" + indikator `1/1`; tidak ada "+ Halaman", pensil, hapus, maupun panah geser. Langkah uji "pengguna: dashboard tanpa kontrol tulis/hapus" kini memeriksa `button[title=…]`, bukan teks tombol. |
| 2 | Empty state `DashboardCanvas` memakai satu bahasa untuk semua peran: judul "Bangun dashboard pertama Anda", teks "…susun sendiri dari preset", CTA "Buat via Chat" — ajakan yang tidak bisa diselesaikan `pengguna` (hasil chat hanya bisa diterapkan admin). | Prop baru `bolehMenyusun` (default `true`) diisi `isAdminRole(currentUser?.role)` dari `App.tsx`. Untuk pembaca: judul "Dashboard ini masih kosong", penjelasan "Belum ada widget yang dibagikan di sini. Widget ditambahkan oleh Admin Instansi…", CTA "Tanya lewat Asisten" (tetap membuka panel chat, tetapi sebagai jalur bertanya, bukan menyusun). | `12e-user-empty-state.png` — teks pembaca tampil, tidak ada satu pun frasa penyusun. Dijaga langkah uji baru "empty state kanvas memakai bahasa pembaca". |
| 3 | `PermintaanDataPage` hanya merender tombol hapus untuk pemohon non-admin berstatus `baru`, padahal `DELETE /api/permintaan/:id` menjawab 200 untuk admin kapan saja — satu-satunya jalan adalah menembak API. | Tombol "Hapus permintaan" (merah, ikon tempat sampah) untuk admin, dengan **konfirmasi dua langkah di dalam panel**: kotak peringatan "Hapus permanen permintaan ini? Riwayat tanggapan dan lampirannya ikut hilang." + tombol "Ya, hapus permanen" dan "Batal". Sengaja bukan `window.confirm` agar akibatnya terbaca dan alurnya tidak diblokir dialog browser. | `31g-admin-konfirmasi-hapus.png` (kotak konfirmasi + dua tombol), `31h-admin-hapus-permintaan.png` (banner "Permintaan dihapus.", kartu 2 → 1, panel detail kembali kosong). Langkah uji "admin: hapus permintaan lewat kontrol di layar" memeriksa kartu berkurang satu **dan** permintaan hilang dari API. |

### 9.2 Yang sengaja belum diubah

| # | Temuan | Alasan tidak diubah pada putaran ini |
|---|---|---|
| 4 | "TOTAL BUMD" = 1 vs 6 tenant di log | Perlu keputusan produk: apakah kartu itu menghitung instansi pengguna atau seluruh platform. Mengubah label tanpa keputusan berisiko menyesatkan ke arah sebaliknya. |
| 5 | Target sentuh < 44 px di 390 px (9–12 item/halaman) | Perbaikan menyentuh banyak komponen bersama (chip filter, ikon tabel, tombol tanpa nama) dan berisiko menggeser tata letak yang sudah lulus; layak dikerjakan sebagai perubahan tersendiri dengan tangkapan sebelum/sesudah. |
| 6 | Typo "retrival", nama peran terpotong di footer | Kosmetik, tidak menghalangi alur; aman digabung ke putaran pemolesan teks. |
| 7 | Kartu "PROVIDER RAG" teks seukuran angka | Hanya tampil saat RAG belum dikonfigurasi (lingkungan uji); perlu keputusan apakah akan tampil di produksi. |

### 9.3 Catatan harness yang ikut berubah

- Langkah 22 dulu memeriksa tombol "+ Halaman" lewat **teks** (`/^\+\s*Halaman/`), padahal tombol itu dirender
  sebagai ikon + kata "Halaman" — pemeriksaan selalu meleset dan uji jadi **hijau palsu**. Kini dicari lewat
  `button[title="Tambah halaman"]` (begitu pula pensil/hapus/geser), sehingga temuan #1 benar-benar tertangkap.
- Langkah `TEMUAN` (dulu selalu non-OK) diganti menjadi uji regresi fungsional hapus permintaan oleh admin,
  sehingga suite tidak lagi menyimpan langkah yang dirancang gagal.
- Jumlah langkah naik 63 → 64 karena bertambahnya uji empty state pembaca.
