# Fitur Role Admin Aiones (superadmin)

Tanggal: 2026-11-08
Proyek: aiones-boards (`C:\Salman\PROJEK\aiones-boards`)
Status: dokumentasi dari kode berjalan (bukan rencana)
Tujuan: dasar penyusunan uji E2E + audit UX untuk peran **Admin Aiones** ("pihak kita"),
sebelum menyentuh peran Admin Instansi dan User.

Sumber yang dibaca: `server.ts`, `src/pages/Admin.tsx`, `src/components/adminTabs.ts`,
`src/components/Sidebar.tsx`, `src/services/auth/peran.ts`, `docs/2026-11-06_plan-alur-3-role-user.md`.

---

## 1. Model tiga peran

| Peran | Label UI | Siapa | Cakupan data | Bukti |
|---|---|---|---|---|
| `superadmin` | Admin Aiones | pihak kita (pengembang/platform) | seluruh instansi + konfigurasi platform | `src/services/auth/peran.ts:16-18`, `:107-109` |
| `admin` | Admin Instansi | pihak konsumen (satu BUMD) | hanya instansinya sendiri | `peran.ts:11-13`, `server.ts:282-296` |
| `pengguna` | User | staf instansi | instansinya sendiri, tidak boleh menyusun dashboard | `server.ts:257-270` |

Tipe peran: `export type UserRole = 'superadmin' | 'admin' | 'pengguna'` (`src/types/index.ts:17`).

Catatan penting: peran lama `analis` dan `direksi` sudah dilebur menjadi `pengguna`
(`peran.ts:84-86`). Normalisasi akun yang mempertahankan `superadmin` hanya
`normalisasiPeranAkun` (`peran.ts:96-99`); `normalisasiPeran` membuangnya menjadi
`pengguna` — jangan dipakai untuk data akun.

---

## 2. Cara masuk ke panel admin

- Sidebar utama punya grup **"Sistem & Tata Kelola"** yang hanya tampil untuk peran admin
  (`src/components/Sidebar.tsx:298`).
- Di dalamnya ada tombol **Jejak Audit** (`Sidebar.tsx:302-306`) dan sub-grup **Panel Admin**
  yang dirender dari `tabUntukPeran(role)` (`Sidebar.tsx:317`).
- Setiap tombol tab punya selector stabil: `data-testid="admin-tab-<id>"` (`Sidebar.tsx:329`).
- Isi tab dirender di satu halaman `Admin.tsx` berdasarkan prop `activeTab`
  (`src/pages/Admin.tsx:1273`, `:1416`, `:1606`, `:1775`, `:2313`, `:2387`, `:2481`).

Daftar tab dan siapa yang boleh melihat (`src/components/adminTabs.ts:33-55`):

| id | Label | Judul halaman | Peran |
|---|---|---|---|
| `overview` | Ringkasan | Ringkasan Sistem | admin + superadmin |
| `users` | Pengguna & RBAC | Pengguna & RBAC | admin + superadmin |
| `tenants` | Instansi & KB | Instansi & Knowledge Base | **superadmin** |
| `rag` | Konfigurasi RAG | Konfigurasi RAG | **superadmin** |
| `kuota` | Kuota AI | Kuota Analisis AI per Instansi | **superadmin** |
| `alerts` | Ambang Batas | Ambang Batas & Alert | admin + superadmin |
| `audit` | Jejak Audit | Jejak Audit & Kepatuhan | **superadmin** |

`tabUntukPeran` mengembalikan **7 tab** untuk `superadmin` dan **3 tab** untuk `admin`
(overview, users, alerts) — `adminTabs.ts:51-55`. Tab Jejak Audit tetap bisa dibuka Admin
Instansi lewat tombol sidebar terpisah (`Sidebar.tsx:302`), dan datanya dibatasi ke
instansinya sendiri (`server.ts:5988-6010`).

---

## 3. Gerbang hak akses di server

| Gerbang | Arti | Bukti |
|---|---|---|
| `requireAuth` | wajib sesi | `server.ts:227-232` (pola umum) |
| `isAdminRole` | `admin` **atau** `superadmin` | `server.ts:231-233`, `peran.ts:11-13` |
| `requireAdmin` | 403 seragam untuk selain dua peran di atas | `server.ts:241-245` |
| `isSuperadmin` | hanya `superadmin` | `peran.ts:16-18` |
| `bolehPindahInstansi` | hanya `superadmin` boleh ganti konteks instansi | `peran.ts:107-109` |
| `effectiveTenantId` | non-superadmin selalu dipaksa ke instansinya; `?tenantId=` diabaikan | `server.ts:278-296` |
| `butuhPenulis` | gerbang tulis dashboard (tolak `pengguna`) | `server.ts:257-270` |
| `bolehTurunkanSuperadmin` | cegah Admin Aiones terakhir diturunkan/dihapus | `peran.ts:50-65`; dipakai `server.ts:6344`, `:6369` |

---

## 4. Inventaris endpoint yang dipakai panel admin

Gerbang dibaca langsung dari badan handler (bukan dari komentar).

| Method | Path | Gerbang | Cakupan untuk superadmin | Bukti |
|---|---|---|---|---|
| GET | `/api/tenants` | `requireAuth` + `isSuperadmin` | semua instansi; peran lain hanya instansinya | `server.ts:873-889` |
| GET | `/api/admin/platform` | `isSuperadmin` | ringkasan lintas instansi | `server.ts:6091-6107` |
| GET | `/api/admin/kuota` | `isSuperadmin` | kuota + pemakaian per instansi | `server.ts:6110-6129` |
| PATCH | `/api/admin/kuota` | `isSuperadmin` | ubah kuota harian (0–1000) + audit log | `server.ts:6132-6153` |
| GET | `/api/admin/users` | `requireAdmin` | semua akun; admin instansi hanya akun sendiri | `server.ts:6155-6165` |
| GET | `/api/admin/join-requests` | `requireAdmin` | semua permintaan; admin instansi difilter | `server.ts:6171-6195` |
| POST | `/api/admin/join-requests/:id/approve` | `requireAdmin` | setujui pendaftaran + tetapkan peran/instansi | `server.ts:6197-6233` |
| POST | `/api/admin/join-requests/:id/reject` | `requireAdmin` | tolak pendaftaran | `server.ts:6237-6255` |
| POST | `/api/admin/users` | `requireAdmin` | buat akun | `server.ts:6259-6294` |
| POST | `/api/admin/users/:id/reset-password` | `requireAdmin` | sandi sementara wajib-ganti | `server.ts:6304-6320` |
| PATCH | `/api/admin/users/:id` | `requireAdmin` + cek instansi + cek superadmin terakhir | ubah nama/email/peran/instansi | `server.ts:6324-6358` |
| DELETE | `/api/admin/users/:id` | `requireAdmin` + cek superadmin terakhir | hapus akun | `server.ts:6362-6387` |
| POST | `/api/admin/tenants` | `requireAdmin` | buat instansi + sinkron KB otomatis | `server.ts:6391-6425` |
| PATCH | `/api/admin/tenants/:id` | `requireAdmin` | ubah instansi (dipakai juga oleh "Pakai" di katalog KB) | `server.ts:6427-6450` |
| DELETE | `/api/admin/tenants/:id` | `requireAdmin` | hapus instansi | `server.ts:6452-6470` |
| POST | `/api/admin/tenants/:id/sinkron-rag` | `requireAdmin` | sinkron KB instansi ke RAG | `server.ts:6581-6596` |
| POST | `/api/admin/tenants/:id/kms-hubungkan` | `requireAdmin` + `isAdminRole` | hubungkan project KMS | `server.ts:5444-5470` |
| GET | `/api/admin/config` | `requireAdmin` | konfigurasi RAG/KMS, **API key ter-mask** | `server.ts:6599-6608` |
| POST | `/api/admin/config` | `requireAdmin` | simpan konfigurasi (kunci ter-mask dipertahankan) | `server.ts:6769-6796` |
| POST | `/api/admin/config-simpan-uji` | `requireAdmin` | uji koneksi lalu simpan | `server.ts:6710-6734` |
| GET | `/api/admin/knowledge` | `requireAdmin` | daftar dokumen sebuah KB | `server.ts:6617-6631` |
| GET | `/api/admin/kb-profil` | `requireAdmin` | profil KB (isi otomatis modal instansi) | `server.ts:6640-6653` |
| GET | `/api/admin/kb-tersedia` | `requireAdmin` | katalog KB yang tersedia | `server.ts:6667-6678` |
| GET | `/api/admin/kms-organisasi` | `requireAdmin` | daftar project KMS | `server.ts:5519-5529` |
| POST | `/api/admin/kms-uji` | `requireAdmin` | uji koneksi KMS | `server.ts:5532-5538` |
| GET | `/api/admin/stats` | `requireAdmin` | statistik panel | `server.ts:6059-6085` |
| GET | `/api/audit-logs` | `isAdminRole` + lingkup instansi | filter `tenantId`/`aksi`/`pengguna`/`dari`/`sampai`, paginasi `limit`/`offset`, ekspor `format=csv`; tanpa `limit` dipotong 500 baris | `server.ts:5988-6041` |
| POST | `/api/audit-logs` | `requireAuth` saja | klien menulis log sendiri | `server.ts:6043-6054` |

---

## 5. Temuan yang perlu diketahui sebelum uji

Semua di bawah ini adalah fakta kode, bukan opini desain.

1. **Pemisahan tab ≠ pemisahan API.** Tab `tenants`, `rag`, `kuota`, `audit` disembunyikan dari
   Admin Instansi (`adminTabs.ts:51-55`), tetapi `POST/PATCH/DELETE /api/admin/tenants`,
   `/api/admin/config`, `/api/admin/knowledge`, `/api/admin/kb-tersedia` hanya dijaga
   `requireAdmin` — artinya Admin Instansi yang memanggil langsung lewat HTTP tetap dilayani
   (`server.ts:6391-6394`, `:6427`, `:6452`, `:6581`, `:6599`). Yang benar-benar dikunci
   `isSuperadmin` baru `/api/admin/platform` dan `/api/admin/kuota` (`:6091`, `:6110`, `:6132`).
2. **Kebocoran yang sudah ditutup** (jangan "diperbaiki" lagi): `GET /api/tenants` kini
   mengembalikan satu instansi untuk non-superadmin (`server.ts:887-890`); `GET /api/admin/users`
   difilter per instansi (`:6161-6165`); `PATCH /api/admin/users/:id` menolak akun instansi lain
   dan membuang `tenantId` dari body (`:6334-6339`); `GET /api/audit-logs` mengabaikan `tenantId`
   dari non-superadmin (`:6000-6005`).
3. **API key tidak pernah dikirim utuh** ke klien — `GET /api/admin/config` mengembalikan versi
   ter-mask (`server.ts:6603-6607`).
4. **Admin Aiones terakhir tidak bisa diturunkan/dihapus** — ditolak 409 dengan kode
   `SUPERADMIN_TERAKHIR` (`server.ts:6343-6346`, `:6369`).
5. **`POST /api/audit-logs` hanya butuh login** (`server.ts:6043-6048`): pengguna mana pun bisa
   menulis entri log dengan `action`/`target` bebas. Ini memengaruhi kepercayaan isi Jejak Audit.

6. **Angka palsu saat data belum siap.** Kartu overview memakai fallback hardcode
   (`stats?.tenantsCount ?? 6`, `totalWidgets ?? 34`, `totalCitations ?? 42`) — `Admin.tsx:1312-1315`.
   Sub-label `6 Sektor Aktif`, `100% Tervalidasi`, `Sehat (Online)` juga statis, tidak dihitung.
   Untuk uji, angka ini tidak bisa dipakai sebagai oracle; pakai teks/keberadaan elemen.
7. **Payload ringkasan platform lebih kaya daripada tampilannya.** `RingkasanPlatform` menyediakan
   `dashboard`, `permintaan.selesai`, `analisis.total`, `butir.total` (`src/services/admin/platform.ts:26-38`)
   tetapi UI hanya merender 6 kartu + baris butir disetujui/draf/ditolak (`Admin.tsx:1288-1305`).
8. **Kuota punya tiga sumber nilai bawaan.** `20` muncul di `server.ts:6118`
   (`kuota ?? 20`), `Admin.tsx:161`, dan `KUOTA_ANALISIS_BAWAAN` (`src/services/analisis/antrean.ts`).
   Ubah satu, dua lainnya tetap.
9. **UI tidak memakai semua kemampuan API.** `PATCH /api/admin/users/:id` (ubah peran/instansi)
   tidak pernah dipanggil UI; penyaring audit di server menerima `pengguna`/`dari`/`sampai`/`limit`
   tetapi tab audit hanya mengirim `tenantId` + `aksi`, sehingga data dipotong 500 baris tanpa
   pemberitahuan (`src/services/admin/audit.ts:37`, `server.ts:6006-6015`).
10. **Instansi baru bisa kehilangan pemetaan KMS.** `POST /api/admin/tenants` tidak menyalin
    `kmsOrganizationId` dari body (`server.ts:6391-6413`), padahal modal menyediakan pilihan
    "Repositori Dokumen KMS". Buat instansi → buka Ubah → pilih KMS lagi.
11. **Kegagalan muat tidak terlihat.** `muatPlatform` (178–187) dan `muatAudit` (190–205) memakai
    `catch {}` kosong + `if (!res.ok) return`; tidak ada penjaga urutan permintaan, sehingga respons
    lama bisa menimpa respons baru saat tombol ditekan berulang. Untuk uji E2E: jangan andalkan
    pesan galat UI — periksa isi DOM atau jaringan.
12. **Modal "Ubah" instansi mengosongkan Nama Resmi & Kota.** Efek pembacaan KB (`Admin.tsx:1115-1154`)
    berjalan setiap `tenantKbId` berubah, termasuk saat modal dibuka dalam mode edit. Bila
    `GET /api/admin/kb-profil` menjawab `jumlahDokumen: 0` (KB kosong, ID salah, atau provider
    `mock`), cabang `else if` mengosongkan `tenantName` dan `tenantCity` (1150–1153) — padahal
    `bukaEditTenant` baru saja mengisinya (696–697). Akibatnya: membuka Ubah pada instansi
    ber-KB yang tidak terbaca menampilkan nama & kota kosong, dan menekan **Simpan BUMD**
    langsung memunculkan "Nama Resmi BUMD dan Kota/Kabupaten wajib diisi." (terverifikasi lewat uji
    UI, lihat bagian 8).
    **Sudah diperbaiki (2026-11-08):** efek kini menghitung `modeEdit = !!editTenantId` dan melewati
    semua penulisan destruktif (pengosongan nama/kota, auto-isi dari KB, penurunan kode) saat modal
    dalam mode Ubah; `editTenantId` masuk daftar dependensi efek. Uji regresi ada di
    `scripts/e2e-superadmin.mjs` (langkah "tenants: ubah nama instansi lewat modal" gagal bila nama
    atau kota saat modal dibuka kosong).
13. **Banner "Kata sandi sementara" bersifat global.** `sandiSementara` (1251–1268) dirender di atas
    konten semua tab dan tidak hilang saat pindah tab; harus ditutup manual. Saat menguji alur
    lain, tutup dulu supaya teks email/sandi tidak mengacaukan pemeriksaan isi halaman.

---

## 6. Fitur per tab (inventaris rinci)

Semua rujukan baris di bawah menunjuk ke `src/pages/Admin.tsx` kecuali ditulis lain.
Blok tab: `overview` 1273–1415, `users` 1416–1605, `tenants` 1606–1774, `rag` 1775–2312,
`kuota` 2313–2386, `alerts` 2387–2480, `audit` 2481–2607. Modal: tambah pengguna 2574–2655,
tambah/ubah instansi 2658–2871, katalog KB 2873–3135.

### 6.1 Tab `overview` — Ringkasan Sistem

**Isi**
1. **Ringkasan Platform** — blok khusus superadmin, hanya muncul bila `superadmin && platform`
   (1276–1307). Enam kartu: Instansi (+`N akun`), Admin Aiones (+`N admin instansi`),
   Pengguna (`akun pemohon`), Perlu Tindakan (+`dari N permintaan`), Analisis AI
   (+`N gagal · N tertunda`), Kuota Hari Ini (`terpakai/kapasitas`, +`N instansi habis`).
   Di bawahnya satu baris butir data: disetujui · draf · ditolak (1303–1305).
   Tombol **Muat ulang** di kanan judul (1283) → `GET /api/admin/platform` (181).
2. **Enam kartu statistik umum** (1310–1329): Total BUMD, Pengguna Aktif, Total Dashboard,
   Sitasi Resmi, Aturan Ambang, Provider RAG. Sumber: `GET /api/admin/stats`, `users.length`,
   `alertRules.length`.
3. **Instansi Terhubung** (1331–1370): grid kartu per instansi berisi logo, nama, kota, kode,
   sektor (nilai mentah seperti `pdam`), dan jumlah berkas terindeks. Tombol
   **Tambah Instansi BUMD** (1342–1348) membuka modal instansi (bukan modal pengguna).
4. **Aktivitas & Log Audit Terakhir** (1372–1415): 5 entri terakhir dari `auditLogs`
   (aksi · target, detail, nama pengguna, jam), tombol **Lihat Seluruh Log →** →
   `onSelectTab('audit')`.

**Data** — `loadData()` memuat 6 endpoint sekaligus (`/api/admin/stats`, `/api/admin/users`,
`/api/tenants`, `/api/admin/config`, `/api/audit-logs`, `/api/alerts`) di 392–397, plus
`/api/admin/join-requests` di 410.

**Keadaan** — tidak ada skeleton; kegagalan muat hanya `console.error` (336–338), UI tampak
seperti daftar kosong.

**Batasan** — angka fallback hardcode `?? 6`, `?? 34`, `?? 42` (1312–1315) membuat data palsu
tampak nyata saat `stats` null; sub-label `6 Sektor Aktif`, `100% Tervalidasi`, `Sehat (Online)`
statis; "Pengguna Aktif" memakai `users.length` (termasuk akun pending), bukan `stats.usersCount`;
kartu instansi dan baris log tidak bisa diklik.

**Selector** — `[data-testid="admin-tab-overview"]` (sidebar), judul halaman "Ringkasan Sistem",
teks "Ringkasan Platform" / "Instansi Terhubung" / "Aktivitas & Log Audit Terakhir". Kartu metrik
tidak punya `data-testid`; pakai teks labelnya.

### 6.2 Tab `users` — Pengguna & RBAC

**Kotak permintaan bergabung** (1420–1520) — hanya dirender bila ada akun `pending`. Per item:
nama, chip `Google`/`Kata sandi`, email + `email terverifikasi`, instansi, waktu pendaftaran,
dropdown peran saat disetujui (`Pengguna`/`Administrator`, 1493–1496), tombol **Setujui** (1501)
→ `POST /api/admin/join-requests/:id/approve` (442), **Tolak** (1510) → `POST .../reject` (462,
pakai `confirm`). Tombol refresh `title="Muat ulang permintaan"` (1452–1454).

**Tabel pengguna** (1526–1600) — kolom: Nama Pengguna (avatar + badge `Menunggu`/`Ditolak`),
Email Instansi, Peran (Role) (chip berlabel `labelPeran()`: Admin Aiones / Admin Instansi / User,
menonjol untuk dua peran admin), Instansi (logo + `shortName`, atau `Tanpa instansi`), Aksi.
Data dari `GET /api/admin/users` (393) dan `GET /api/tenants` (394).

**Aksi per baris**
- Reset sandi (1578–1584, `title="Reset kata sandi"`) → `confirm` "Pengguna wajib menggantinya saat
  login." lalu `POST /api/admin/users/:id/reset-password` (564–579); sandi sementara dari server
  ditampilkan di banner `sandiSementara` (email + sandi) supaya bisa disalin.
- Hapus (1586–1592, `title="Hapus Pengguna"`) → `confirm` "…menonaktifkan pengguna ini?" lalu
  `DELETE /api/admin/users/:id` (581–595). Tombol disembunyikan untuk id `user-admin`.
  **Catatan**: meski teks konfirmasi dan audit bilang "dinonaktifkan", `db.deleteUser()` benar-benar
  menghapus baris pengguna + kredensialnya (`src/services/store/inMemoryDb.ts:1373-1385`). Server
  juga menolak menghapus akun sendiri (400) dan Admin Aiones terakhir (409).

**Modal Tambah Pengguna** (2574–2655, judul "Tambah Pengguna BUMD Baru") — dibuka tombol
**Tambah Pengguna Baru** (1428). Field: Nama Lengkap, Email Resmi, Peran Hak Akses (select
`pengguna`/`admin` beserta keterangan haknya, 2618–2619), Penugasan Instansi BUMD (select dari
`tenants`).
Submit **Daftarkan Pengguna** → `POST /api/admin/users` (529). Validasi klien hanya `required` +
`type="email"`; duplikat email ditolak server (409) dan pesannya masuk banner global.

Bila server mengembalikan `sandiSementara` saat pembuatan akun, banner yang sama muncul (547–553).

**Tidak ada**: pencarian, filter peran/instansi, sorting, paginasi, dan **ubah peran**
(`PATCH /api/admin/users/:id` tersedia di server tetapi tidak dipanggil UI mana pun).

**Keadaan** — tabel kosong tanpa pesan; kegagalan muat senyap; galat aksi tampil di banner
`galatAksi` (1238–1241) yang berada di atas konten tab, sehingga saat modal terbuka pesannya
tertutup overlay.

**Selector** — `[data-testid="admin-tab-users"]`, tombol teks `Tambah Pengguna Baru`,
`table thead th` (5 kolom), `button[title="Reset kata sandi"]`,
`button[title="Hapus Pengguna"]`, modal `div[role="dialog"][aria-labelledby="add-user-title"]`,
`#add-user-title`, tombol teks `Daftarkan Pengguna` / `Batal`, select peran join request
`select[title="Peran saat disetujui"]`. Input modal tidak punya `id`/`name` — pakai placeholder
(`Contoh: Ahmad Fauzi, S.E.`, `ahmad@pdam-tirta.id`). `confirm()`/`alert()` memblokir otomasi:
pasang handler dialog lebih dulu.

### 6.3 Tab `tenants` — Instansi & Knowledge Base

**Aksi massal** (1621–1645)
- **Perbarui Semua** (1620–1627) → `handleSinkronSemua` (934–990): `POST /api/admin/tenants/:id/sinkron-rag`
  untuk setiap instansi ber-KB, berurutan, hasil digabung dalam banner.
- **Katalog KB** (1638, `data-testid="katalog-kb"`) → `GET /api/admin/kb-tersedia` (834) lalu
  membuka panel katalog (lihat 6.4).
- **Daftarkan BUMD Baru** (1644) → modal instansi.

**Kartu per instansi** (1701–1771) — logo, nama, kota, kode, sektor, jumlah berkas, KB ID,
status sinkron terakhir, plus tiga aksi:
- **Perbarui RAG** (1731–1743) → `POST /api/admin/tenants/:id/sinkron-rag` (910); nonaktif bila
  instansi belum punya KB ID.
- **Ubah** (1747, `title="Ubah nama, kode, atau Knowledge Base instansi ini"`) → modal mode edit.
- **Hapus** (1755, `title="Hapus Instansi BUMD"`, ikon saja) → `DELETE /api/admin/tenants/:id`
  (958) setelah `confirm`.

**Banner hasil sinkron** (1655–1699) — judul hasil + daftar `BARU: …` / `HILANG: …` per dokumen,
catatan tambahan, warna hijau/merah sesuai `gagal`, tombol tutup `aria-label="Tutup hasil sinkronisasi"`.

**Modal tambah/ubah instansi** (2658–2871) — field: Knowledge Base ID (memicu
`GET /api/admin/kb-profil?kb=…` di 1137 untuk mengisi otomatis nama/kota/sektor/kode),
Repositori Dokumen KMS di blok `data-testid="pemetaan-kms"` — select `pilih-kms-org` (opsi kosong
berlabel "(belum dipetakan — berkas tidak bisa diunggah)") atau input `input-kms-org`, daftar dari
`GET /api/admin/kms-organisasi` di 816), Nama Resmi BUMD, Nama Singkat, Kode Instansi, Sektor
(pilihan dari daftar tetap), Kota/Kabupaten. Submit: `POST /api/admin/tenants` (mode tambah) atau
`PATCH /api/admin/tenants/:id` (mode ubah, tombol "Simpan BUMD"); server langsung menyinkronkan KB
saat instansi dibuat (`server.ts:6391-6425`).

**Batasan (terverifikasi)**
- `POST /api/admin/tenants` tidak menyalin `kmsOrganizationId` dari body (`server.ts:6391-6413`) —
  pemetaan KMS yang dipilih di modal tambah tidak tersimpan; harus dibuka lagi lewat Ubah.
- `POST`/`PATCH` instansi **tidak menulis jejak audit**; hanya hapus dan sinkron yang tercatat.
- Tidak ada empty state maupun pesan galat muat untuk daftar instansi.

**Selector** — `[data-testid="admin-tab-tenants"]`, `[data-testid="katalog-kb"]`,
`[data-testid="pilih-kms-org"]`, `[data-testid="input-kms-org"]`, `[data-testid="kb-<id>"]`,
`[data-testid="pakai-<id>"]`, `[data-testid="pilih-instansi-<id>"]`; kartu = `.item-card`
(scope dulu, karena tombol `Ubah`/`Perbarui RAG` berulang per kartu); field modal lewat
placeholder (`Contoh: kb_pam_jaya`, `mis. Tirta Raharja`, `mis. Bandung`).

### 6.4 Tab `rag` — Konfigurasi RAG

**Isi** — satu objek `systemConfig` global (bukan per instansi), dibagi tiga langkah:
1. **Pilih sumber data** (1881–1960): kartu **Demo lokal** (`data-testid="mode-demo"`,
   `ragProvider='mock'`) vs **Layanan RAG** (`data-testid="mode-rag"`, `ragProvider='http'`).
   Kartu memakai `aria-pressed` sebagai penanda terpilih. Ringkasan di atasnya menampilkan chip
   `MODE DEMO`/`MODE LAYANAN RAG`, Base URL aktif, dan KB default.
2. **Alamat & kunci layanan** (1962–2069): `#ragUrl` / `input-rag-url`, `#ragKey` /
   `input-rag-key` (bertopeng, tombol mata `aria-label="Tampilkan kunci"`), dan `<details>`
   opsional KMS (`konfigurasi-kms`, `input-kms-url`, `input-kms-key`).
3. **Knowledge Base default** (2071–2130): `#kbDefault`, tombol **Periksa isi** →
   `GET /api/admin/knowledge?kb=…` (1072) menampilkan tabel dokumen (nama, status, halaman,
   potongan, token), dan **Jadikan default** → `POST /api/admin/config` (2101).

**Tombol uji**
- **Uji koneksi** (1808–1814) → `POST /api/rag-probe` (1042). Menguji **konfigurasi tersimpan**,
  bukan isi form; hasil `healthy`/`degraded`/gagal beserta `details`.
- **Uji kunci ini** (2016–2025) → `POST /api/admin/config-simpan-uji` (748) — menyimpan dulu,
  lalu menguji `GET {base}/knowledge`.
- **Simpan & uji KMS** (`data-testid="uji-kms"`) → `POST /api/admin/config` (791) +
  `POST /api/admin/kms-uji` (802); hasil di `data-testid="hasil-uji-kms"`.

**Perubahan belum disimpan** — sidik jari `jejakCfg` (112–120) atas 6 field; bila berbeda muncul
bilah lengket "Ada perubahan yang belum disimpan." dengan **Muat ulang** (memuat ulang seluruh data
admin) dan **Simpan pengaturan** (`data-testid="simpan-rag"`) → `POST /api/admin/config` (718).

**Keamanan kunci** — server mengirim API key dalam bentuk ter-mask (`server.ts:6603-6607`); nilai
asli tidak pernah kembali ke klien.

**Keadaan** — tab hanya dirender bila `systemConfig` sudah ada (1775); bila `GET /api/admin/config`
gagal, area konten kosong tanpa pesan.

**Selector** — `[data-testid="admin-tab-rag"]`, `[data-testid="tab-rag"]`,
`mode-demo`/`mode-rag` (+`aria-pressed`), `input-rag-url`, `input-rag-key`, `#kbDefault`,
`konfigurasi-kms`, `input-kms-url`, `input-kms-key`, `uji-kms`, `hasil-uji-kms`, `simpan-rag`.
Tombol "Uji koneksi", "Uji kunci ini", "Periksa isi", "Jadikan default" tanpa `data-testid` —
pilih lewat teks tombol.

**Modal Katalog Knowledge Base** (2873–3135, `data-testid="panel-katalog-kb"`) — dibuka dari tab tenants. Sumber
`GET /api/admin/kb-tersedia`: kartu per KB (`kb-<id>`) berisi ID, jumlah dokumen/potongan/token,
waktu perbarui, badge `Baru`, `N gagal`, `N diproses`, dan "Dipakai oleh <instansi>". Enam kartu
ringkasan (total KB, dokumen, dipakai, siap dipakai, KB baru, perlu dicek). Dikelompokkan menjadi
*Siap dipakai* / *Sudah dipakai instansi* / *Perlu dicek dulu*. Pencarian `katalog-cari` (hanya
mencocokkan ID KB) + checkbox "Hanya yang belum dipakai", keduanya client-side. Aksi: `katalog-muat-ulang`,
`pilih-instansi-<id>` + `pakai-<id>` → `PATCH /api/admin/tenants/:id` (867), tutup via X/scrim.
Kartu yang sudah terpakai tidak punya aksi; tidak ada hapus KB. Bila penyaring tidak menemukan
apa pun, muncul teks "Tidak ada KB yang cocok dengan penyaring ini." (3125–3126).

### 6.5 Tab `kuota` — Kuota Analisis AI per Instansi

- Input angka `data-testid="input-kuota-ai"` (2335), atribut `min=0 max=1000`, label
  "Dokumen / instansi / hari"; nilai awal dari `GET /api/admin/kuota` (215).
- Tombol `data-testid="simpan-kuota-ai"` (2342) → `PATCH /api/admin/kuota` (229); server memvalidasi
  0–1000 (`server.ts:6138-6141`) dan menulis audit log "Ubah Kuota Analisis AI".
- Tabel "Pemakaian hari ini" 4 kolom: Instansi, Terpakai, Kuota, Sisa (hijau, merah bila 0);
  baris kosong "Belum ada data kuota."; tombol **Muat ulang** memanggil `muatKuota` (215).
- Umpan balik: satu paragraf hijau/merah di bawah kartu (`pesanKuota`).
- **Kuota bersifat global** — satu angka untuk semua instansi, kolom "Kuota" bernilai sama di setiap
  baris; tidak ada override per instansi.
- Tidak ada indikator memuat untuk GET (kosong dan memuat tak bisa dibedakan); pesan galat lama
  tidak dibersihkan saat muat ulang berhasil.
- Selector: `admin-tab-kuota`, `input-kuota-ai`, `simpan-kuota-ai`, teks "Pemakaian hari ini",
  teks "Belum ada data kuota.".

### 6.6 Tab `alerts` — Ambang Batas & Alert

**Isi** (2387–2478) — judul "Daftar Aturan Ambang Batas & Peringatan Otomatis (Global)" dengan
subjudul "Peringatan dini bagi Direksi dan Pengawas saat indikator melanggar batasan regulasi".
Satu kartu per aturan berisi:
- judul aturan + badge tingkat keparahan (`CRITICAL` merah / `WARNING` kuning, 2409–2416);
- `Kondisi: <metricName> <operator> <threshold> <unit>` (2419);
- `Instansi: <nama> / Semua BUMD • Kanal: <channels>` (2421–2423);
- badge status `Aktif`/`Nonaktif` (2427–2435).

**Aksi per kartu**
- **Aktif/nonaktif** (2436–2443, `title="Nonaktifkan"`/`"Aktifkan"`) → `PATCH /api/alerts/:id?tenantId=…`
  (480–484) lalu `loadData()`.
- **Ubah ambang** (2444–2463, `title="Ubah ambang batas"`) → `window.prompt` berisi nilai sekarang;
  koma diterima sebagai desimal (`replace(',', '.')`), nilai non-angka ditolak dengan `alert`;
  sukses → `PATCH` yang sama.
- **Hapus** (2464–2471, `title="Hapus aturan"`) → `window.confirm` (497–500) lalu
  `DELETE /api/alerts/:id?tenantId=…` (502–504); server menulis audit "Hapus Ambang Batas"
  (`server.ts:3746-3753`).

**Batasan (terverifikasi)**
- Judul menyebut "(Global)", tetapi `GET /api/alerts` memfilter `r.tenantId === effectiveTenantId(...)`
  (`server.ts:3653-3658`) dan UI memanggilnya tanpa `tenantId` (397). Artinya tab ini **hanya
  menampilkan aturan milik instansi akun yang login** — untuk Admin Aiones, aturan instansi lain
  tidak muncul.
- Tidak ada pembuatan aturan baru dari UI (`POST /api/alerts` ada di server, `server.ts:3660`),
  tidak ada riwayat pemicu, tidak ada pratinjau notifikasi.
- Daftar kosong tidak punya empty state.
- Semua umpan balik memakai `alert()` browser — otomasi harus memasang handler dialog.

**Selector** — `[data-testid="admin-tab-alerts"]`, teks judul kartu, `span` berisi `Aktif`/`Nonaktif`,
`button[title="Nonaktifkan"]`/`[title="Aktifkan"]`/`[title="Ubah ambang batas"]`/`[title="Hapus aturan"]`.

### 6.7 Tab `audit` — Jejak Audit & Kepatuhan

- Tabel 5 kolom: Waktu, Aksi, Target / Entitas, Pengguna, Detail Keterangan (dipotong `truncate`,
  teks penuh di `title`). Penghitung "N baris" di atas tabel (panjang array, bukan total server).
- Penyaring: `data-testid="filter-audit-instansi"` (2504; "Semua instansi" + daftar instansi,
  langsung memuat saat diganti) dan `data-testid="filter-audit-aksi"` (2521; substring, terpicu
  Enter atau tombol **Terapkan** `data-testid="muat-audit"`).
- Server mendukung `pengguna`, `dari`, `sampai`, `limit`/`offset`, dan `format=csv`
  (`server.ts:5988-6041`), tetapi **UI hanya memakai `tenantId` + `aksi`**; tanpa `limit`, server
  memotong 500 baris terbaru dan UI tidak memberi tahu bahwa data terpotong.
- Ekspor CSV tidak ada di tab ini (tombolnya ada di halaman `AuditLogPage`).
- Kolom Instansi tidak ada di tabel, padahal superadmin bisa memilih "Semua instansi".
- Galat muat senyap (`if (!res.ok) return`), tanpa empty state.
- Selector: `admin-tab-audit`, `filter-audit-instansi`, `filter-audit-aksi`, `muat-audit`,
  `table thead th`, regex `^\d+ baris$`.

---

## 7. Ringkasan untuk penyusunan uji E2E

Prasyarat: satu akun `superadmin` (Admin Aiones) di data uji, plus minimal dua instansi dan
beberapa akun untuk menguji penyaring lintas instansi.

Alur minimum yang layak diuji (semua lewat UI, bukan API):

1. Login sebagai Admin Aiones → sidebar menampilkan **7 tab**; login sebagai Admin Instansi →
   hanya **3 tab** (overview, users, alerts) — uji negatif: `admin-tab-tenants`, `admin-tab-rag`,
   `admin-tab-kuota`, `admin-tab-audit` tidak ada di DOM.
2. `overview`: kartu Ringkasan Platform tampil dengan angka, `Muat ulang` bekerja, tombol
   "Lihat Seluruh Log →" berpindah ke tab audit.
3. `users`: buat pengguna baru lewat modal, reset sandi, setujui satu permintaan bergabung,
   hapus pengguna; verifikasi tombol hapus tidak ada untuk `user-admin`.
4. `tenants`: buat instansi baru dengan KB ID, lihat banner hasil sinkron, `Perbarui RAG`
   per kartu, `Perbarui Semua`, ubah instansi, hapus instansi.
5. `rag`: ganti mode demo ↔ layanan, uji koneksi, uji kunci, periksa isi KB, simpan pengaturan,
   verifikasi bilah "belum disimpan" muncul dan hilang.
6. `kuota`: ubah angka, simpan, verifikasi pesan sukses dan baris tabel ikut berubah.
7. `audit`: ganti penyaring instansi, cari aksi, Terapkan; verifikasi jumlah baris berubah.
8. Katalog KB: buka dari tab tenants, cari ID, pasang KB ke instansi lewat `Pakai`.

Yang belum bisa diuji otomatis tanpa penyesuaian: dialog `confirm()`/`alert()` bawaan browser
(perlu handler dialog), dan semua aksi yang memanggil layanan RAG eksternal (uji koneksi,
sinkron, katalog) — perlu layanan RAG hidup atau diarahkan ke mode demo.

---

## 8. Hasil uji UI superadmin (2026-11-08)

Perintah: `npm run test:e2e:admin` (`scripts/e2e-superadmin.mjs`).

Cara kerja: skrip menyalakan server sendiri di port 3210 dengan `AIONESBOARD_DATA_DIR` sementara
dan MySQL diarahkan ke port kosong, mengambil sandi acak akun demo Admin Aiones dari log server,
lalu menyuntik sesi ke browser (cookie HttpOnly + `localStorage.aionesboard_user`) sehingga tidak
ada sandi yang diketik ke halaman. Folder sementara dihapus setelah uji; `data/db.json` dan MySQL
dev tidak tersentuh.

Hasil: **28/28 langkah lulus**, 0 error konsol, 0 request gagal. Artefak (18 tangkapan layar +
`hasil.json`) di `%TEMP%\admin-super-artifacts`.

| Tab | Langkah yang diuji | Hasil |
|---|---|---|
| — | login superadmin lewat API + sesi dipulihkan di browser | lulus |
| — | 7 tombol tab admin tampil (`admin-tab-*`) | lulus |
| overview | panel Ringkasan Platform, Instansi Terhubung, Log Audit Terakhir, Kuota Hari Ini | lulus |
| overview | tombol **Muat ulang** ringkasan platform | lulus |
| overview | **Lihat Seluruh Log** berpindah ke tab audit | lulus |
| users | tabel 5 kolom + tombol **Tambah Pengguna Baru** | lulus |
| users | tambah pengguna lewat modal → baris muncul | lulus |
| users | reset sandi → banner "Kata sandi sementara untuk …" | lulus |
| users | setujui permintaan bergabung (akun `pending` dari `/api/auth/register`) | lulus |
| users | hapus pengguna → baris hilang | lulus |
| tenants | tombol Perbarui Semua / Katalog KB / Daftarkan BUMD Baru + 6 kartu seed | lulus |
| tenants | daftarkan instansi baru dengan KB ID manual → kartu muncul | lulus |
| tenants | ubah instansi → modal terbuka berisi nama & kota lama, simpan tanpa mengetik ulang (regresi temuan 12) | lulus |
| tenants | hapus instansi → kartu hilang | lulus |
| rag | bagian sumber data, alamat & kunci, KB default tampil | lulus |
| rag | ganti mode → bilah "Ada perubahan yang belum disimpan" muncul | lulus |
| rag | **Simpan pengaturan** → "Pengaturan tersimpan dan langsung dipakai." | lulus |
| rag | **Uji koneksi** → "Koneksi RAG gagal … mode fallback, potongan 0" (RAG tidak hidup) | lulus |
| rag | kembalikan ke mode demo + simpan | lulus |
| kuota | tabel "Pemakaian hari ini" + simpan nilai 25 → "Kuota tersimpan." | lulus |
| alerts | daftar aturan tampil (1 aturan seed, judul "(Global)") | lulus |
| alerts | aktif/nonaktif aturan (title tombol berubah) | lulus |
| alerts | ubah ambang lewat `prompt` → nilai baru tampil | lulus |
| audit | tabel 5 kolom + dua penyaring + 13 baris | lulus |
| audit | cari aksi "Login" → 1 baris | lulus |
| katalog KB | panel `panel-katalog-kb` terbuka; mock → banner "Daftar KB tidak bisa dibaca" + empty state | lulus |

Temuan yang lahir dari uji ini: **temuan 12** (modal Ubah mengosongkan Nama Resmi & Kota) dan
**temuan 13** (banner sandi sementara global). Keduanya terverifikasi langsung di UI, bukan dari
pembacaan kode saja.

Belum tercakup: RAG nyata (uji koneksi/sinkron/katalog dengan layanan hidup), login Google,
ekspor CSV audit, paginasi audit, serta seluruh alur peran Admin Instansi dan User.

