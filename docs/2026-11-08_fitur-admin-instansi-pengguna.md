# Fitur Admin Instansi & Pengguna (peta dua peran)

Dokumen ini memetakan fitur yang dipakai **dua peran non-superadmin**: `admin` (Admin Instansi) dan
`pengguna` (User instansi). Isinya hanya yang terbaca dari kode, dengan rujukan `file:baris`.
Belum ada perubahan kode dari dokumen ini; ia menjadi dasar penyusunan uji berikutnya.

Lawan dari dokumen ini adalah `docs/2026-11-08_fitur-admin-aiones.md` (peran `superadmin`).

---

## 1. Definisi peran dan gerbangnya

| Hal | Nilai | Rujukan |
|---|---|---|
| Tiga peran | `superadmin`, `admin`, `pengguna` | `src/types.ts` (`UserRole`) |
| "Peran pengelola" | `admin` + `superadmin` | `src/services/auth/peran.ts:9-11` |
| "Hanya Admin Aiones" | `superadmin` | `peran.ts:14-16` |
| Boleh menyusun dashboard | hanya peran pengelola | `peran.ts:34-36` |
| Label yang dilihat pengguna | "Admin Aiones" / "Admin Instansi" / "User" | `peran.ts:19-23` |
| Gerbang tulis dashboard | `butuhPenulis()` — tolak 403 dengan pesan "Menyusun dashboard hanya bisa dilakukan admin instansi. Ajukan permintaan data lewat menu Permintaan Data." | `server.ts:267-280` |
| Cakupan instansi | `effectiveTenantId()` membatasi semua query ke instansi sesi | `server.ts` (dipakai hampir semua route) |

Konsekuensi yang mudah salah dibaca: **`pengguna` bukan peran baca-saja total**. Ia tetap boleh
bertanya di chat, mengunggah dokumen, mengajukan permintaan data, menulis catatan, dan mengubah
sandi. Yang ditutup untuknya adalah menyusun/mengubah dashboard dan seluruh panel tata kelola.

---

## 2. Navigasi yang terlihat per peran

Sumber: `src/components/Sidebar.tsx` + `src/App.tsx:1263-1355`.

| Grup / menu | Admin Instansi | Pengguna | Rujukan |
|---|---|---|---|
| Pemilih instansi (dropdown semua BUMD) | tidak (hanya instansinya) | tidak | `Sidebar.tsx:153` (`bolehPindahInstansi`) |
| Workspace → Semua Dashboard | ya | ya | `Sidebar.tsx:210-220` |
| Permintaan Data | ya, berlabel **"Kotak Masuk"** | ya, berlabel **"Permintaan Data"** | `Sidebar.tsx:223-248` |
| Referensi → Template Dashboard | ya | ya | `Sidebar.tsx:251-265` |
| Referensi → Template Chart | ya | ya | `Sidebar.tsx:267-275` |
| Referensi → Repositori Dokumen | ya | ya | `Sidebar.tsx:279-291` |
| Sistem & Tata Kelola → Jejak Audit | ya | **tidak** | `Sidebar.tsx:296-306` |
| Panel Admin (tab sesuai peran) | Ringkasan, Pengguna & RBAC, Ambang Batas | **tidak ada grup** | `Sidebar.tsx:307-340`, `adminTabs.ts:49-53` |
| Panel Admin tab Instansi & KB / RAG / Kuota AI / Jejak Audit | **tidak** (khusus Admin Aiones) | tidak | `adminTabs.ts:33-41` |

Tab panel admin yang tersedia untuk Admin Instansi persis tiga: `overview`, `users`, `alerts`
(`adminTabs.ts:49-53`). Empat sisanya milik `superadmin`.

---

## 3. Fitur Admin Instansi

### 3.1 Panel admin (3 tab)

| Tab | Yang bisa dilakukan | Endpoint | Rujukan |
|---|---|---|---|
| `overview` | angka instansinya sendiri (jumlah dashboard, widget, sitasi, aturan alert, akun), tombol "Lihat Seluruh Log" yang memanggil `onSelectTab('audit')` (tab audit tidak ada untuk admin — lihat bagian 8) | `GET /api/admin/stats` (cakupan per peran), `GET /api/admin/platform` (khusus superadmin) | `server.ts:6075-6105`, `Admin.tsx:1462-1478` |
| `users` | daftar akun instansinya, tambah akun, reset sandi (sandi sementara sekali tampil), ubah peran (`PATCH`), hapus akun, setujui/tolak pendaftaran bergabung | `GET/POST /api/admin/users`, `PATCH /api/admin/users/:id`, `DELETE /api/admin/users/:id`, `POST /api/admin/users/:id/reset-password`, `GET /api/admin/join-requests`, `POST .../approve`, `POST .../reject` | `server.ts:6171-6392`, `Admin.tsx:1536-1770` |
| `alerts` | daftar aturan ambang batas instansinya, aktif/nonaktif, ubah ambang (`prompt`), hapus aturan | `GET/POST /api/alerts`, `PATCH/DELETE /api/alerts/:id`, `POST /api/alerts/evaluate` | `server.ts:3664-3790`, `Admin.tsx:2397-2500` |

Batas peran pada tab `users`: Admin Instansi hanya melihat akun `tenantId`-nya
(`server.ts:6171-6185`), tidak bisa memindahkan akun ke instansi lain (`tenantId` dibuang dari body,
`server.ts:6340-6356`), dan tidak bisa menurunkan/menghapus Admin Aiones terakhir (409
`SUPERADMIN_TERAKHIR`, `server.ts:6359-6362`). Peran yang boleh ia berikan saat menyetujui
pendaftaran: `admin` atau `pengguna` saja (`server.ts:6222-6226`).

### 3.2 Workspace: menyusun dashboard

| Fitur | Endpoint | Rujukan |
|---|---|---|
| Buat / ubah / hapus dashboard | `POST /api/dashboards`, `PATCH /api/dashboards/:id`, `DELETE /api/dashboards/:id` (semua `butuhPenulis`) | `server.ts:1444-1476`, `:1478-1503`, `:2077-2105` |
| Tambah halaman, duplikat, widget dari saran AI | `POST /api/dashboards/:id/halaman`, `POST /api/dashboards/:id/duplicate`, `POST /api/dashboards/:id/widget-dari-saran` | `server.ts:2106-2200`, `:1988-2076` |
| Impor Excel/CSV jadi widget | `POST /api/impor/pratinjau`, `POST /api/impor/widget` (`butuhPenulis`) | `server.ts:5559-5730` |
| Template dashboard & template chart | `POST /api/dashboards/dari-template`, `GET /api/templates/*` | `server.ts:1654-1960`, `App.tsx:1333-1339` |
| Gaya global (warna/font semua widget) | komponen `GlobalStyleModal` | `App.tsx:1410-1426` |
| Bagikan tautan (publik/PIN) | `POST /api/dashboards/:id/share`, `GET/DELETE /api/share/:token`, `POST /api/share/:token/verifikasi-pin` | `server.ts:5730-5900` |
| Mode presentasi | `POST /api/dashboards/:id/presentasi` (`butuhPenulis`) | `server.ts:1504-1560`, `App.tsx:1212-1220` |
| Cetak / ekspor | komponen `ExportModal` | `App.tsx:1221-1227` |
| Chat asisten per dashboard | `POST /api/chat`, `GET /api/chat/umum`, `GET /api/chats` | `server.ts:2389-2600`, `:2200-2250` |

### 3.3 Kotak masuk permintaan data

Halaman yang sama dengan "Permintaan Data" milik pengguna; yang membedakan hanya `peran`
(`PermintaanDataPage.tsx:106`).

| Aksi admin | Aturan server | Rujukan |
|---|---|---|
| Lihat semua permintaan instansinya | filter `tenantId` sesi | `server.ts:3904-3920` |
| Ubah status (`baru` → `diproses`/`perlu_data`/`ditolak`; `perlu_data`/`diproses` → `diproses`; `diproses` → `selesai`/`ditolak`) | transisi dibatasi `TRANSISI_STATUS`; `selesai`/`ditolak` final; hanya admin | `src/services/permintaan/aturan.ts:24-30`, `server.ts:4018-4034` |
| Tolak dengan alasan | alasan wajib diisi (tidak boleh kosong; disimpan maks 500 karakter) | `server.ts:4028-4033` |
| Tulis catatan pada permintaan | pengguna dan admin sama-sama boleh; `olehRole` dicatat | `server.ts:4068-4110` |
| Buka isi dokumen & jalankan analisis AI | `POST /api/analisis` (kuota harian), `GET /api/analisis/:id/butir` | `server.ts:4242-4360`, `IsiDokumenPanel.tsx:154-390` |
| Terapkan butir analisis jadi dashboard | `POST /api/dashboards/dari-butir` (`butuhPenulis`) | `server.ts:4518-4560`, `KatalogDataPanel.tsx:61-68`, `:131` |
| Hapus permintaan | admin boleh kapan saja; pengguna hanya saat `baru` | `server.ts:4124-4140` |

### 3.4 Ambang batas & alert

`AlertsPage.tsx` (halaman penuh) dan tab `alerts` di panel admin memakai API yang sama.
Evaluasi aturan (`POST /api/alerts/evaluate`) membuat notifikasi in-app bila indikator melanggar
ambang (`server.ts:3771-3810`, `src/services/alerts.ts`).

### 3.5 Repositori dokumen

| Aksi | Admin Instansi | Pengguna | Rujukan |
|---|---|---|---|
| Daftar berkas instansi | ya | ya | `server.ts:5048-5130` |
| Unggah berkas | ya | ya | `server.ts:5157-5235` |
| Lihat / unduh | ya | ya | `server.ts:5444-5448` |
| Hapus berkas | ya (`requireAdmin`) | tidak | `server.ts:5238-5260` |
| Hubungkan instansi ke project KMS | ya (tombol muncul hanya untuk `admin`) | tidak (tombol ikut tersembunyi bersama `bisaHapus`) | `server.ts:5455-5462`, `ManajemenBerkasPage.tsx:160-167`, `:385-393` |

### 3.6 Jejak audit instansinya

`GET /api/audit-logs` untuk Admin Instansi selalu dibatasi ke `tenantId` sesi, parameter
`tenantId` dari URL diabaikan (`server.ts:5999-6010`). Ekspor CSV dan paginasi tersedia
(`server.ts:6034-6057`). Halaman `AuditLogPage.tsx` hanya dirender untuk peran pengelola
(`App.tsx:1315`).

---

## 4. Fitur Pengguna

| Fitur | Yang bisa | Batas | Rujukan |
|---|---|---|---|
| Workspace | melihat semua dashboard instansinya, membuka dashboard, chat dengan asisten, riwayat chat | tidak ada tombol buat/duplikat/hapus/bagikan di daftar dashboard (`bolehMenulis=false`) | `DashboardList.tsx:35-54`, `:125-300`, `App.tsx:1312` |
| Chat asisten | tanya jawab berbasis KB instansi | jawaban selalu dari KB instansinya, bukan KB campur | `server.ts:2389-2402` |
| Permintaan Data | ajukan permintaan (bidang, prioritas, tanggal target, lampiran), ubah selama `baru`, hapus selama `baru`, tulis catatan, lihat riwayat status | tidak boleh mengubah status; isi terkunci setelah admin mengerjakan | `server.ts:3922-3960`, `:3983-3990`, `:4133-4140`, `PermintaanDataPage.tsx:106`, `:190`, `:320` |
| Repositori Dokumen | lihat, unggah, unduh, ringkasan | tidak bisa menghapus | `server.ts:5048-5260`, `ManajemenBerkasPage.tsx:88` |
| Notifikasi | daftar + tandai terbaca | hanya miliknya (`untukUserId`/`untukRole`) | `server.ts:4867-4890` |
| Akun | ganti sandi (termasuk paksa ganti setelah reset admin), logout | — | `server.ts:1339-1400`, `GantiPasswordWajib.tsx` |
| Template & chart gallery | melihat dan memakai template (pemakaian template membuat dashboard → ditolak server untuk pengguna) | `POST /api/dashboards/dari-template` memakai `butuhPenulis` | `server.ts:1808-1960` |

---

## 5. Fitur yang benar-benar dipakai bersama

| Kapabilitas | Admin Instansi | Pengguna | Pembedanya |
|---|---|---|---|
| Halaman `/permintaan` | Kotak Masuk (semua permintaan instansi) | Permintaan saya | `isAdminRole(peran)` di `PermintaanDataPage.tsx:106` |
| Chat asisten | ya | ya | tidak ada pembeda |
| Repositori dokumen | ya + hapus | ya | `requireAdmin` pada DELETE berkas |
| Notifikasi | ya | ya | filter penerima |
| Dashboard (baca) | ya | ya | tulis hanya admin (`butuhPenulis`) |
| Ganti sandi | ya | ya | sama |
| Pencarian/ekspor audit | ya (instansinya) | tidak (403) | `isAdminRole` di `server.ts:5999-6005` |

---

## 6. Alur yang saling terhubung (bagian terpenting)

### A. Pendaftaran → persetujuan admin

1. Pendaftaran mandiri (`POST /api/auth/register`, `server.ts:1120-1200`) atau Google
   (`POST /api/auth/google`, `:1201-1338`) membuat akun `status: 'pending'` dengan
   `requestedTenantId` — belum bisa login (`server.ts:1161-1174`).
2. Admin Instansi melihatnya di kotak "Permintaan Bergabung" (tab `users`,
   `Admin.tsx:1524-1600`) dan memutuskan:
   - setujui → `POST /api/admin/join-requests/:id/approve`: status `active`, `tenantId` dipaksa
     instansi admin (kecuali superadmin), peran `admin`/`pengguna`, lalu menulis audit
     "Setujui Pendaftaran" (`server.ts:6213-6251`);
   - tolak → `POST .../reject` (status `ditolak`, akun tetap ada di tabel) (`server.ts:6253-6275`).
3. Setelah `active`, pengguna bisa login dan seluruh endpoint ber-cakupan instansi terbuka.

### B. Permintaan data → analisis AI → butir → dashboard

Rantai lintas peran yang paling panjang:

1. **Pengguna** mengajukan permintaan + lampiran (`POST /api/permintaan`, `server.ts:3922-3956`).
   Status awal `baru` (`src/services/permintaan/aturan.ts:12`).
2. **Admin** memindahkan ke `diproses`/`perlu_data`, boleh meminta data tambahan
   (`server.ts:3979-4030`); pengguna melihat alasan pada panel detail
   (`PermintaanDataPage.tsx:320`).
3. **Admin** membuka isi dokumen dan menjalankan **analisis AI** (`POST /api/analisis`) — memakai
   kuota harian instansi (`server.ts:4242-4360`), hasilnya butir data yang bisa dikoreksi
   (`PATCH /api/analisis/butir/:id`, `server.ts:4392-4415`).
4. **Admin** mengubah butir menjadi dashboard (`POST /api/dashboards/dari-butir`,
   `server.ts:4518-4560`).
5. **Pengguna** melihat dashboard hasilnya di Workspace (baca saja) dan bisa bertanya lewat chat.
6. Status permintaan ditutup `selesai` oleh admin; notifikasi in-app dikirim ke pemohon
   (`server.ts:4046-4055`, pembentuknya `:3850-3866`).

### C. Chat → usulan penyempurnaan halaman

Pengguna dan admin sama-sama bisa chat. **Hanya admin** yang bisa mengubah percakapan menjadi
usulan perubahan halaman (`POST /api/usulan/dari-chat`, `server.ts:4665-4670`), menerapkannya
(`POST /api/usulan/:id/terapkan`), atau membatalkannya (`server.ts:4801-4866`). Usulan yang
diterapkan mengubah dashboard instansi — jadi hasil kerja pengguna (pertanyaan/konteks) berujung
pada perubahan yang hanya boleh dieksekusi admin.

### D. Dokumen → KMS/KB → jawaban chat & analisis

Berkas yang diunggah (`POST /api/berkas/unggah`) masuk ke project KMS instansi
(`kms-hubungkan`, `server.ts:5455`). Chat memakai `kbUntukInstansi()` sehingga jawaban tidak
pernah diambil dari KB instansi lain (`server.ts:2397-2402`, khususnya `:2402`). Analisis AI membaca berkas yang sama.

### E. Ambang batas → evaluasi → notifikasi

Aturan dibuat admin (tab `alerts`; lihat celah 8.1), dievaluasi terhadap nilai indikator dari dokumen
(`POST /api/alerts/evaluate`), dan bila terlampaui menghasilkan notifikasi in-app
(`server.ts:3771-3810`). Notifikasi dibaca semua peran sesuai penerimanya.

### F. Jejak audit lintas peran

Aksi kedua peran tercatat: pengguna (ajukan permintaan, catatan) dan admin (setujui pendaftaran,
ubah status, buat/hapus dashboard, hapus berkas, ubah ambang, reset sandi). Admin Instansi hanya
bisa membaca log instansinya; pengguna tidak bisa membaca log sama sekali.

---

## 7. Matriks endpoint (ringkas)

| Endpoint | Admin Instansi | Pengguna | Bukti |
|---|---|---|---|
| `GET/POST/PATCH/DELETE /api/permintaan*` | ya (seluruh permintaan instansinya) | ya (miliknya) | `server.ts:3888-4140` |
| `POST /api/analisis*`, `/api/usulan*` | ya | tidak (403) | `server.ts:4191-4415`, `:4665-4866` |
| `POST/PATCH/DELETE /api/dashboards*`, `/api/impor/*`, `/api/share/*` | ya | tidak (403 dari `butuhPenulis`) | `server.ts:267-280` + route |
| `GET /api/dashboards*`, `/api/chat*`, `/api/notifications`, `/api/berkas` | ya | ya | login saja |
| `DELETE /api/berkas/:id` | ya | tidak | `server.ts:5238` |
| `GET /api/audit-logs` | ya (instansinya) | tidak (403) | `server.ts:5999-6005` |
| `GET/POST/PATCH/DELETE /api/alerts*` | ya | **ya** (tidak ada cek peran) | `server.ts:3664-3790` |
| `GET /api/admin/stats`, `/api/admin/users*`, `/api/admin/join-requests*` | ya | tidak | `server.ts:6075-6392` |
| `/api/admin/tenants*`, `/api/admin/config*`, `/api/admin/kb-*`, `/api/admin/kuota`, `/api/admin/platform` | tidak (403) | tidak | `requireSuperadmin` |

---

## 8. Celah yang terlihat dari kode (belum diperbaiki)

Diurutkan dari yang paling berdampak pada dua peran ini.

1. **Aturan ambang batas bisa diubah pengguna lewat API.** `GET/POST/PATCH/DELETE /api/alerts*`
   hanya `requireAuth` (`server.ts:3664-3790`), padahal UI tidak memberi pengguna menu apa pun.
   Halaman `AlertsPage` juga dirender tanpa cek peran (`App.tsx:1322`), jadi `#/v/alerts` tetap
   terbuka. Akibatnya pengguna bisa mematikan atau menaikkan ambang instansinya sendiri, dan
   `POST /api/alerts/evaluate` bisa dipicu siapa pun untuk memunculkan notifikasi.
2. **Tombol tulis di Workspace tidak mengikuti aturan server.** `bolehMenulis` hanya dipakai di
   `DashboardList`; header workspace tetap menampilkan "Impor Data", "Gaya Semua", "Bagikan
   Tautan", dan menu "Hapus Dashboard"/"Mode Presentasi" untuk pengguna
   (`App.tsx:1402-1445`, `:1212-1246`). Server menolak dengan 403 + pesan "Menyusun dashboard
   hanya bisa dilakukan admin instansi", jadi yang dilihat pengguna adalah tombol yang selalu gagal.
3. **Tombol hapus berkas tidak muncul untuk Admin Aiones.** `bisaHapus = peran === 'admin'`
   (`ManajemenBerkasPage.tsx:88`) — `superadmin` justru kehilangan tombol, padahal server
   mengizinkannya (`requireAdmin`).
4. **Tombol "Lihat Seluruh Log" di tab overview mengarah ke tab yang tidak ada** untuk Admin
   Instansi (tab `audit` khusus superadmin, `adminTabs.ts:33-41`), sehingga klik berujung pada
   tampilan kosong/`activeTab` tak valid (`Admin.tsx:1345-1430`).
5. **Hapus akun oleh Admin Instansi hanya berlaku untuk akun instansinya** (`server.ts:6389-6391`)
   dan akun `user-admin` disembunyikan tombolnya di UI (`Admin.tsx:1672`, `:1763`); belum ada aturan
   eksplisit di UI tentang siapa yang boleh menghapus siapa — perlu keputusan produk sebelum diuji.
6. **Kuota AI hanya terlihat admin.** `GET /api/analisis/kuota` terbuka untuk semua peran
   (`server.ts:4177-4189`) tetapi tidak ada indikator kuota di UI pengguna; pengguna hanya menemui
   kegagalan saat kuota habis (analisis dijalankan admin, jadi dampaknya tidak langsung).
7. **`POST /api/admin/tenants/:id/kms-hubungkan` tidak memeriksa instansi.** Gerbangnya hanya
   `isAdminRole` (`server.ts:5458`), lalu tenant diambil dari `req.params.id` tanpa
   `bolehPindahInstansi` (`server.ts:5461`). Admin Instansi A bisa memicu pembuatan project KMS
   untuk instansi B. Tombolnya sendiri hanya tampil untuk `admin` (`ManajemenBerkasPage.tsx:385`),
   jadi celah ini tidak akan terlihat dari UI.
8. **Chat tidak memakai kuota.** Kuota harian hanya memotong `POST /api/analisis`
   (`server.ts:4289-4300`), bukan `POST /api/chat`; kalau biaya model jadi perhatian, ini titik
   yang perlu diputuskan.

---

## 9. Bahan untuk uji berikutnya

Kelompok langkah yang layak disusun dari peta ini (belum dibuat skripnya). Nomor 7 di bawah
sengaja menunggu keputusan: kalau celah 8.1 dianggap bug, uji ini yang membuktikannya.

1. **Navigasi per peran** — admin melihat 3 tab panel + Jejak Audit; pengguna tidak melihat grup
   "Sistem & Tata Kelola" sama sekali.
2. **Batas tulis** — pengguna: `POST /api/dashboards` 403, `POST /api/impor/widget` 403,
   `POST /api/analisis` 403, `POST /api/usulan/dari-chat` 403; admin: semuanya 2xx.
3. **Alur permintaan penuh** — pengguna ajukan → admin `diproses` → `perlu_data` → `selesai`;
   tolak tanpa alasan harus 400; pengguna tidak bisa mengubah status (403).
4. **Pendaftaran** — register → `pending` (login ditolak) → admin setujui dengan peran `admin` →
   login berhasil dan tab panel admin bertambah; tolak → login tetap ditolak.
5. **Isolasi instansi** — admin instansi A tidak bisa `GET /api/permintaan/:id` milik instansi B
   (403) dan `tenantId` di URL audit diabaikan.
6. **Berkas** — pengguna unggah + unduh berhasil, hapus 403; admin hapus 200.
7. **Alert** — admin buat/ubah/hapus (200); pengguna: catat hasil sebenarnya untuk
   `POST/PATCH/DELETE /api/alerts` dan akses `#/v/alerts`. Bila pengguna berhasil, itu bukti celah 8.1
   dan perlu diputuskan: kunci endpoint ke `isAdminRole` atau sembunyikan halaman untuk pengguna.
8. **KMS lintas instansi** — admin A memanggil `POST /api/admin/tenants/<instansi B>/kms-hubungkan`;
   saat ini diharapkan 200 (celah 8.7).
