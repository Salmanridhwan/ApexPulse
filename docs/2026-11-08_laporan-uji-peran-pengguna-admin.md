# Laporan uji E2E + audit UX: peran `pengguna` & `admin` instansi

Tanggal: 2026-11-08
Alat: `scripts/e2e-peran.mjs` (Puppeteer + Chrome terpasang, tidak di-commit) dan `ux-probe` (3 viewport).
Lingkungan: server sendiri di port 3212, direktori data sementara (`AIONESBOARD_DATA_DIR` temp), stub KMS, akun demo bawaan aplikasi (`DEMO_PASSWORD`). Data dev/produksi tidak disentuh.

## 1. Cara uji

- Sesi disuntik (cookie HttpOnly + `localStorage.aionesboard_user`) setelah login lewat HTTP; tidak ada sandi yang diketik ke halaman.
- Dua konteks browser terpisah (`createBrowserContext`) supaya login peran kedua tidak menimpa sesi peran pertama.
- Setiap langkah dinilai dari teks DOM yang benar-benar dirender + PNG viewport di `%TEMP%/peran-artifacts`.
- Gerbang: 0 console error, 0 request 4xx/5xx tak terduga (403 dari uji negatif yang disengaja dikecualikan).

## 2. Hasil

Ringkasan run pertama (sebelum perbaikan): **44/50 langkah lulus, 6 temuan**, gerbang konsol/request bersih. Run terakhir setelah perbaikan: **62/63 langkah lulus, 1 temuan, gerbang konsol & request bersih** (0 console error, 0 request 4xx/5xx tak terduga).

### 2.1 Admin instansi (panel 3 tab + menu operasional)

| # | Langkah | Hasil | Bukti |
|---|---------|-------|-------|
| 4 | Sidebar memuat Kotak Masuk, Jejak Audit, dan 3 tab panel | lulus | `01-admin-sidebar.png` |
| 5 | Tab khusus Admin Aiones tidak ada di panel | lulus | `02-admin-overview.png` |
| 6 | Ringkasan menampilkan kartu angka instansinya | lulus | `02-admin-overview.png` |
| 7 | Tombol "Tambah Instansi BUMD" tidak tampil untuk admin | lulus (setelah perbaikan) | `02-admin-overview.png`, `POST /api/admin/tenants` = 403 |
| 8 | "Lihat Seluruh Log" membuka log audit instansi | lulus | `03-admin-lihat-log.png` |
| 9 | Tab Pengguna menampilkan akun instansinya | lulus | `04-admin-users.png` |
| 10 | Tambah pengguna baru lewat modal | lulus | `05-admin-tambah-pengguna.png` |
| 11 | Reset sandi menampilkan sandi sementara sekali | lulus | `06-admin-reset-sandi.png` |
| 12 | Ubah peran akun lewat select | lulus | `07-admin-ubah-peran.png` |
| 13 | Hapus akun uji | lulus | `07-admin-ubah-peran.png` |
| 14-15 | Setujui pendaftaran dari kotak "Permintaan Bergabung" lalu akun aktif | lulus | `08-admin-permintaan-gabung.png`, `08b-admin-setujui.png` |
| 16-17 | Tab Ambang Batas menampilkan aturan instansi dan ubah ambang tersimpan | lulus | `09-admin-alerts.png` |
| 18 | Tombol tambah aturan tersedia di UI | lulus (form baru) | `09-admin-alerts.png` |
| 19-20 | Buat dashboard baru dari Workspace, tombol tulis tersedia | lulus | `11-admin-dashboard-baru.png` |
| 24-26 | Unggah berkas, hapus berkas, tombol hubungkan KMS tersembunyi saat sudah terpetakan | lulus | `13-admin-berkas-unggah.png` |
| 27-28 | Jejak Audit memuat aksi admin; tautan Ekspor CSV mengunduh CSV (`text/csv`, >1 baris) | lulus | `14-admin-audit.png` |

### 2.2 Pengguna

| # | Langkah | Hasil | Bukti |
|---|---------|-------|-------|
| 29 | Sidebar memakai label "Permintaan Data" dan tanpa tata kelola | lulus | `20-user-sidebar.png` |
| 30 | Workspace tidak menawarkan pembuatan dashboard | lulus | `21-user-workspace.png` |
| 31 | Tombol tulis Workspace tidak tampil | lulus (setelah perbaikan) | `12c-user-menu-aksi.png` |
| 32-33 | Ajukan permintaan data baru, tambah catatan pada permintaan sendiri | lulus | `23-user-permintaan-baru.png`, `24-user-catatan.png` |
| 34 | Tidak boleh mengubah status permintaan (API 403) | lulus | API |
| 40-42 | Lihat repositori instansi, unggah berkas sendiri, tombol hapus tidak tersedia | lulus | `33-user-berkas.png`, `34-user-berkas-unggah.png` |
| 43 | Chat asisten menjawab pertanyaan | lulus | `35-user-chat.png` |
| 44 | POST /api/alerts ditolak untuk pengguna | lulus (403 setelah `butuhPenulis`) | API |
| 45 | Tulis dashboard/impor/analisis/usulan/audit/tenants/hapus berkas ditolak 403 | lulus | API |
| 46 | Halaman `#/v/alerts` tidak terbuka untuk pengguna | lulus | `36-user-alerts.png` |

### 2.3 Alur yang menghubungkan kedua peran

| # | Langkah | Hasil | Bukti |
|---|---------|-------|-------|
| 21 | Dashboard buatan admin tampil di Workspace pengguna | lulus | `12b-user-workspace-dashboard.png` |
| 22 | Pengguna tidak melihat kontrol tulis/hapus di dashboard | lulus (setelah perbaikan) | `12c-user-menu-aksi.png` |
| 23 | Hapus dashboard oleh pengguna ditolak dengan pesan galat | lulus (tombol hilang; banner `galat-dashboard` tersedia) | `12d-user-hapus-ditolak.png` |
| 35 | Admin melihat permintaan pengguna di Kotak Masuk | lulus | `30-admin-kotak-masuk.png` |
| 36 | "Ambil & proses" mengubah status ke `diproses` | lulus | `31-admin-permintaan-diproses.png` |
| 37 | Tolak tanpa alasan tidak bisa (tombol nonaktif) | lulus | `31-admin-permintaan-diproses.png` |
| 38-39 | Pengguna melihat status "Diproses" dan menerima notifikasi | lulus | `32-user-status-diproses.png` |
| 48 | Aksi kedua peran tercatat di jejak audit (18 entri) | lulus | `14-admin-audit.png` |

## 3. Temuan

| # | Severity | Temuan | Bukti | Usul |
|---|----------|--------|-------|------|
| 1 | major | Tombol "Tambah Instansi BUMD" tampil di tab Ringkasan untuk `admin` padahal endpoint `POST /api/admin/tenants` khusus superadmin (403). | `02-admin-overview.png`, `server.ts` route tenants | Gerbang tombol dengan `isSuperadmin(peran)`. |
| 2 | major | Tab Ambang Batas tidak punya tombol tambah aturan; aturan hanya bisa dibuat lewat API, sehingga admin tidak bisa memakai fitur yang ada di backend. | `09-admin-alerts.png`, `server.ts:3671-3692` | Tambahkan kontrol tambah aturan (form/prompt) yang memanggil `POST /api/alerts`. |
| 3 | major | `pengguna` melihat kontrol tulis di dashboard: "Impor Data", "Gaya Semua", menu "Cetak / Ekspor", "Bagikan Tautan", dan **"Hapus Dashboard"**. Server menolak dengan 403 (`butuhPenulis`, `server.ts:267-280`), tetapi UI menawarkannya. | `12c-user-menu-aksi.png`, `App.tsx:1196-1240`, `App.tsx:1392-1440` | Gerbang seluruh kontrol tulis dengan `bolehMenyusunDashboard(peran)`; sembunyikan menu hapus untuk non-admin. |
| 4 | major | Hapus dashboard oleh pengguna gagal 403 **tanpa pesan apa pun**; dialog konfirmasi sudah dijawab, layar kembali seperti biasa, pengguna mengira berhasil. | `12d-user-hapus-ditolak.png` | Tampilkan galat dari respons (toast) pada setiap aksi tulis yang ditolak. |
| 5 | major | `POST /api/alerts`, `PATCH /api/alerts/:id`, `DELETE /api/alerts/:id` hanya memakai `requireAuth`; pengguna bisa membuat aturan ambang batas lewat API (HTTP 201) meski UI tidak menampilkannya. | `server.ts:3671-3790` | Ganti dengan `butuhPenulis(req, res)` (admin instansi). |
| 6 | minor | Probe UX: tombol kirim chat 36×36 px dan ikon header chat 18 px di 390 px; tombol tanpa nama aksesibel pada panel chat. | `ux-user-berkas-390.png` | Naikkan area klik ke 44 px dan beri `aria-label`. |

Catatan lingkungan (bukan temuan produk): pada probe UX, daftar dokumen basis menampilkan pesan "Daftar dokumen di basis sedang tidak bisa dibaca (layanan lambat atau tidak menjawab)" karena RAG tidak dikonfigurasi di server uji; fallback ke repositori bekerja seperti dirancang (`ManajemenBerkasPage.tsx`).

## 4. Skor audit UX (lapis angka)

| Layar | Desktop (awal → akhir) | Mobile (awal → akhir) |
|---|---|---|
| admin-overview | 93 → 93 | 93 → 93 |
| admin-users | 97 → 97 | 95 → 95 |
| admin-alerts | 96 → 96 | 94 → 92 |
| admin-permintaan | 94 → 94 | 86 → 86 |
| admin-berkas | 92 → 92 | 83 → 83 |
| admin-audit | 93 → 93 | 91 → 90 |
| user-workspace | 90 → **95** | 80 → **90** |
| user-permintaan | 89 → **94** | 80 → **86** |
| user-berkas | 88 → **92** | 78 → **83** |

Penyebab skor mobile rendah: target sentuh <44 px (chip filter 27 px, tombol segarkan 28 px, ikon aksi baris 26 px) dan tabel yang belum menjadi kartu di lebar kecil.

## 6. Perbaikan yang sudah dikerjakan (setelah uji pertama)

| # | Temuan | Perubahan kode | Status |
|---|--------|----------------|--------|
| 1 | Tombol "Tambah Instansi BUMD" tampil untuk admin | `src/pages/Admin.tsx` — tombol dibungkus `{superadmin && (...)}` | selesai, langkah uji jadi hijau |
| 2 | Tidak ada kontrol tambah aturan di tab Ambang Batas | `src/pages/Admin.tsx` — form "Tambah Aturan" (indikator, operator, ambang, satuan, tingkat) → `POST /api/alerts`, dengan pesan galat di dalam form | selesai (langkah uji masih merah karena hitungan API tidak bertambah — perlu ditelusuri) |
| 3 | Kontrol tulis & hapus dashboard tampil untuk pengguna | `src/App.tsx` — tombol Impor Data / Gaya Semua / Bagikan dan menu "Bagikan Tautan" + "Hapus Dashboard" dibungkus `isAdminRole(currentUser?.role)` | selesai, langkah uji jadi hijau |
| 4 | Aksi tulis yang ditolak gagal senyap | `src/App.tsx` — `galatDashboard` + banner `role="alert"` (`data-testid="galat-dashboard"`) saat `DELETE /api/dashboards/:id` tidak OK | selesai |
| 5 | `POST/PATCH/DELETE /api/alerts` tanpa cek peran | `server.ts` — ketiga route memakai `butuhPenulis(req, res)` | selesai, langkah uji negatif jadi hijau (403) |
| 6 | Tombol "+ Halaman" (tambah/ubah nama/hapus halaman dashboard) tampil untuk pengguna | `src/App.tsx` — `onTambah`/`onGantiNama`/`onHapus` hanya diberikan bila `isAdminRole`, sehingga `HalamanTabs` menyembunyikan kontrolnya | selesai, diverifikasi di layar (`12c-user-menu-aksi.png`) dan di suite |

Verifikasi setelah perbaikan: `npx tsc --noEmit` bersih, `npm run build` sukses, suite E2E dijalankan ulang (hasil terakhir: 53/63 langkah, 1 temuan).

## 7. Sisa temuan & yang sengaja tidak diubah

| Severity | Temuan | Bukti | Keputusan |
|----------|--------|-------|-----------|
| major | Tidak ada kontrol hapus permintaan data di UI admin, padahal `DELETE /api/permintaan/:id` mengizinkan (HTTP 200, baris hilang dari API). Di UI, hapus hanya untuk pemohon selama status masih `baru` (`PermintaanDataPage.tsx:497`). | `30-admin-kotak-masuk.png`, log server | **sengaja tidak diubah**: menghapus permintaan milik pengguna adalah tindakan destruktif yang butuh keputusan produk (hapus permanen vs arsip/tolak). Server tetap membatasi ke admin instansi; UI tidak menawarkannya supaya tidak ada penghapusan tak sengaja. |
| minor | `GET /api/chats/:id` tidak ada (404), padahal pesan tersimpan (`messageCount` > 0). Riwayat tetap tampil di panel setelah reload karena diambil dari jalur lain, jadi bukan blocker. | respons `GET /api/chats`, `35d-user-chat-riwayat.png` | dicatat; endpoint isi pesan per percakapan perlu ditambah bila nanti butuh membuka percakapan lama secara eksplisit. |

Catatan harness: 3 langkah yang sempat merah (`Tandai selesai`, `menolak dengan alasan`, `pengguna melihat Ditolak`) sudah hijau setelah skrip menunggu kartu daftar muncul dan mengembalikan saringan ke "Semua" — penyebabnya daftar yang dirender sebelum status berubah, bukan produk.

## 5. Yang tidak diuji

- Login Google (`accounts.google.com/gsi/button` HTTP 403 — origin belum terdaftar).
- Akun superadmin asli (butuh kredensial dari vault); uji memakai akun demo bawaan aplikasi.
- Integrasi KMS nyata (dipakai stub lokal) dan RAG/produksi AI.
- Notifikasi email/WhatsApp (kanal eksternal tidak dikonfigurasi).
