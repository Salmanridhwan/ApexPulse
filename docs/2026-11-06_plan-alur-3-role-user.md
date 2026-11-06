# Plan: Alur 3 Role (User, Admin Instansi, Admin Aiones)

Tanggal: 2026-11-06
Proyek: aiones-boards (ApexPulse), folder `C:\Salman\PROJEK\aiones-boards`
Repo: `Salmanridhwan/ApexPulse`, live `app-boards.aiones.app`
Status: rencana, belum ada kode yang diubah
Sumber permintaan: pesan pemilik 2026-11-06 + `C:\Salman\Vault\Jurnal\bumd.md`

---

## 1. Tujuan

Alur tiga peran yang dimaksud:

1. **User** (staf bidang di instansi) mengajukan permintaan data, mengunggah dokumen sendiri, dan menulis catatan arah dashboard.
2. **Admin Instansi** (pihak konsumen) menerima permintaan, memproses dokumen, dan menyusun halaman.
3. **Admin Aiones** (pihak kita) mengelola platform dan lintas instansi.

Koreksi penting dari pemilik (2026-11-06): **dua peran admin sudah ada**. Yang benar-benar belum ada adalah **perilaku role user**: belum ada objek permintaan, belum ada unggah dokumen yang tertaut ke permintaan, belum ada catatan arah, dan belum ada pembatasan sehingga user tidak menyusun dashboard sendiri.

Jadi inti pekerjaan ini adalah membangun alur user dari nol, lalu menyambungkannya ke alur admin yang sudah jalan. Pemisahan tegas antara Admin Aiones dan Admin Instansi di dalam kode belum ada (keduanya masih `admin` dan sama-sama bisa pindah instansi), tetapi itu bukan penghalang untuk rilis pertama.

### 1.1 Ruang lingkup rilis pertama

| Masuk rilis pertama | Ditunda |
|---|---|
| Role `user`: buat permintaan, unggah dokumen, catatan arah, lihat status | Analisis AI otomatis (Fase 2) |
| Kotak masuk admin: lihat permintaan, buka dokumen, tautkan dashboard, ubah status | Katalog data dan penyusun halaman dari butir (Fase 2 dan 3) |
| Gerbang tulis: user tidak bisa membuat atau menghapus dashboard | Pemisahan tegas Admin Aiones vs Admin Instansi (Fase 4) |
| Notifikasi dan audit untuk setiap perubahan status | Kuota AI dan meteran token (ikut Fase 2) |

Dengan lingkup ini, alur permintaan sudah bisa dipakai nyata walau AI-nya belum otomatis. Admin menyusun halaman memakai chat dan katalog yang sudah ada, lalu menautkannya ke permintaan.

---

## 2. Keadaan sekarang (fakta terukur, 2026-11-06)

| Hal | Kenyataan | Bukti |
|---|---|---|
| Role | Hanya 2: `admin` dan `pengguna` (analis/direksi dilebur) | `src/types/index.ts:11`, `src/services/laporan/alur.ts` |
| Siapa boleh bikin dashboard | **Semua yang login**. `POST/PATCH/DELETE /api/dashboards` hanya `requireAuth` + `effectiveTenantId`, tanpa gerbang role | `server.ts:1430`, `server.ts:1464`, `server.ts:2063` |
| Siapa boleh pindah instansi | Semua `admin` lewat `?tenantId` | `server.ts:287-295` |
| Endpoint admin | 22 endpoint, semua dijaga `role !== 'admin'` | `server.ts:5529-6870` |
| Unggah berkas | Semua user login boleh unggah, hapus admin saja | `server.ts:5231` |
| Kategorisasi | Sudah ada, deterministik dari judul/seri: Keuangan, Operasional, Pelayanan, SDM, Kinerja, Umum | `src/services/spec/kategoriWidget.ts` |
| Rekomendasi bentuk chart | Sudah ada 29 entri + fungsi ringkas | `src/services/spec/rekomendasiTipe.ts` |
| Daftar dokumen per KB | Sudah ada, tanpa LLM | `RagClient.daftarDokumen()` di `src/services/rag/http.ts:2062` |
| Ambil angka per indikator | Sudah ada, dengan sitasi | `ambilDataWidget()` `src/services/rag/http.ts:1675` |
| Impor Excel/CSV | Sudah ada, diurai di server, tanpa LLM | `src/services/impor/tabel.ts` + `POST /api/impor/*` |
| Penyimpanan | `data/db.json` + cermin MySQL per-baris (17 tabel). Koleksi fitur baru wajib punya tabel sendiri karena `saveAll` menulis snapshot penuh dan bisa saling menimpa antar instance | `src/services/store/mysqlStore.ts:186-430` |
| Uji | 335 lulus, `tsc` bersih | dijalankan 2026-11-06 |
| Data nyata | 6 instansi, 32 akun, 22 dashboard, fitur Kinerja & Kepatuhan 0 baris | `data/db.json` |

Kesimpulan: fondasi AI-nya sudah ada. Yang belum ada adalah **objek permintaan**, **pemisahan peran**, **katalog data hasil analisis dokumen**, dan **penyusun halaman dari butir data terpilih**.

---

## 3. Alur baru

### 3.1 User

1. Buka menu **Permintaan Data**, tekan "Permintaan Baru".
2. Isi: bidang (Keuangan, Operasional, Pelayanan, SDM, Perencanaan, Kepatuhan), judul, daftar data yang diminta (boleh beberapa baris), periode, catatan arah dashboard (tujuan, audiens, hal yang harus ditonjolkan).
3. Unggah dokumen pendukung ke permintaan itu. Bisa banyak berkas, bisa menyusul.
4. Lihat status: `baru` → `diproses` → `perlu_data` → `selesai` atau `ditolak`.
5. Kalau `selesai`, user melihat dashboard hasil dalam mode baca saja.

User tidak bisa membuat, mengubah, atau menghapus dashboard. Tidak bisa melihat katalog data. Tidak bisa menyentuh konfigurasi RAG/KMS.

### 3.2 Admin Instansi

Lima kalimat pemilik tentang peran ini dipetakan ke bagian plan seperti ini:

| Kalimat pemilik | Wujud di produk | Bagian |
|---|---|---|
| "admin akan menerima data dari user" | Kotak Masuk per instansi, notifikasi, jumlah berkas, catatan arah | 3.2.1, 6.1 |
| "AI langsung grab datanya dan menampilkan ada data apa aja" | Analisis otomatis saat unggah, panel Isi Dokumen | 3.2.2, 6.2, 7.1 |
| "dibagi langsung menjadi kategorinya masing-masing" | Katalog Data per kategori, kategori deterministik | 3.2.3, 7 |
| "di setiap template di kategorinya ada rekomendasi AI" | Kartu kategori menampilkan template dan bentuk chart yang disarankan | 3.2.4, 7.3 |
| "admin ambil data yang diinginkan dan membuatnya jadi 1 halaman" | Pilih butir, tombol Buat Halaman, angka diambil dari butir | 3.2.5, 6.3 |
| "kalau belum puas, request ke chat AI" | Chat dengan konteks halaman dan catatan arah | 3.2.6, 8.2 |

#### 3.2.1 Menerima data

1. **Kotak Masuk** menampilkan permintaan instansinya, dikelompokkan per bidang lalu per status, dengan jumlah berkas, prioritas, dan pemohon.
2. Badge jumlah permintaan `baru` muncul di menu sidebar, sama seperti pola notifikasi yang sudah ada.
3. Notifikasi masuk ke admin instansi saat permintaan dibuat, saat berkas baru diunggah, dan saat pemohon mengirim ulang setelah `perlu_data`.
4. Buka satu permintaan: tampil daftar data yang diminta, catatan arah, seluruh berkas dengan status analisisnya, dan riwayat status.

#### 3.2.2 Penyerapan otomatis oleh AI

1. Begitu berkas tertaut ke permintaan, sistem menyisipkan baris `analisisDokumen` berstatus `antri`. Unggahan tidak menunggu analisis selesai.
2. Worker mengambil antrean, membaca dokumen lewat RAG dengan `SKEMA_BUTIR`, lalu menulis butir data.
3. Panel **Isi Dokumen** menampilkan hasilnya: berapa butir ditemukan, indikator apa saja, halaman sitasi, dan tingkat keyakinan. Ini yang menjawab "menampilkan ada data apa aja".
4. Excel/CSV diurai lokal tanpa LLM, jadi hasilnya instan dan gratis.
5. Kalau dokumen gagal dibaca, admin melihat alasan yang bisa dibaca manusia, bukan kode galat, dan bisa mencoba ulang.
6. **Ringkasan permintaan**: satu panel di atas daftar dokumen yang menampilkan gabungan seluruh dokumen dalam permintaan itu, yaitu jumlah butir per kategori, daftar indikator teratas, dan dokumen mana yang menyumbang. Ini yang menjawab "menampilkan ada data apa aja" untuk satu permintaan, bukan hanya per berkas.

Catatan penting untuk rilis pertama: langkah ini baru otomatis di Fase 2. Sebelum itu, admin masih memakai chat dan impor yang sudah ada, lalu menautkan hasilnya ke permintaan. Alurnya tidak berubah, hanya lebih manual.

#### 3.2.3 Pengelompokan per kategori

1. Kategori dihitung `kategoriWidget()` dari nama indikator dan seri, bukan ditebak LLM. Hasilnya selalu sama untuk dokumen yang sama.
2. Enam kategori yang dipakai sekarang: Keuangan, Operasional, Pelayanan, SDM, Kinerja, Umum.
3. **Katalog Data** menampilkan butir per kategori, bisa difilter per bidang, dokumen, dan periode.
4. Admin bisa menyetujui, menolak, atau memindahkan kategori satu butir. Koreksi admin disimpan dan dipakai sebagai acuan untuk butir berikutnya dengan nama mirip.
5. Butir tanpa nilai dan tanpa sitasi tidak ditampilkan sebagai siap pakai, hanya sebagai catatan.
6. Dokumen yang jelas tidak relevan bisa ditandai **tidak relevan**. Berkas tetap tersimpan, butirnya tidak masuk katalog, dan pemohon melihat catatan supaya bisa mengunggah yang benar.

#### 3.2.4 Rekomendasi per kategori dan per template

Ini bagian yang belum tergambar di plan sebelumnya, sekarang ditambahkan.

1. Setiap kategori menampilkan saran bentuk tampilan: angka tunggal, batang, garis, cincin, tabel, atau kartu capaian. Dasarnya `REKOMENDASI_TIPE` yang sudah ada 29 entri.
2. Setiap kategori juga menampilkan saran template halaman dari 5 template yang sudah ada (Pijar, Lensa, Nadi, Kaca, Rapat Manajemen), lengkap dengan alasan singkat. Dasarnya pencocokan kata kunci butir dengan `fokus` dan `deskripsi` template, bukan LLM, jadi gratis dan bisa diuji.
3. Kartu butir menampilkan label "Disarankan" pada bentuk chart yang paling cocok, dan admin boleh menggantinya.
4. Kalau satu kategori punya banyak butir, sistem menyarankan susunan halaman: mana yang jadi angka utama, mana yang jadi tren, mana yang jadi tabel.

Rincian teknis di bagian 7.3.

#### 3.2.5 Menyusun satu halaman

1. Admin mencentang butir yang dipakai, boleh lintas dokumen dan lintas kategori.
2. Tekan **Buat Halaman**, isi judul halaman dan gaya tampilan, sistem menyusun widget dari butir terpilih.
3. Setiap widget membawa sitasi dokumen dan halaman, jadi angka bisa ditelusuri.
4. Pilihannya: buat dashboard baru, atau tambahkan sebagai halaman baru ke dashboard yang sudah ada. Ini yang dimaksud "membuatnya menjadi 1 halaman".
5. Angka di widget berasal dari butir, bukan dari LLM saat menyusun, jadi tidak bisa berubah atau dikarang.

#### 3.2.6 Menyempurnakan lewat asisten chat

Penyempurnaan **bukan** tombol sekali-jalan yang menyusun ulang halaman sendiri. Yang
dipakai adalah asisten chat yang sudah ada: halaman aktif dibawa sebagai konteks, lalu
admin menulis apa yang masih kurang — tambah grafik, ganti tipe, ubah judul, hapus
kartu, susun ulang urutan — dan chat menyiapkan perubahannya.

1. Saat halaman dibuka di kanvas, asisten chat otomatis tahu konteksnya: `dashboardId`,
   `halamanAktifId`, daftar widget di halaman itu, butir data yang sudah disetujui, dan
   catatan arah dari pemohon.
2. Pintu masuknya percakapan, bukan mesin terpisah. Yang boleh ada di kanvas hanyalah
   pemintas kecil berlabel jelas ("tanya asisten tentang halaman ini") yang membuka chat
   dengan konteks halaman terpasang — bukan tombol yang diam-diam mengubah halaman.
3. Permintaan bebas: "tambahkan tren pendapatan dari dokumen yang tadi saya setujui",
   "gabungkan dua grafik ini", "angka utama dibuat lebih menonjol", "hapus kartu ini".
4. Chat mengubah **halaman yang sedang dibuka**, bukan halaman lain dan bukan dashboard
   baru. Bila perintahnya ambigu soal halaman, chat bertanya dulu — tidak menebak.
5. **Semua** perubahan ditampilkan sebagai usulan lebih dulu: pratinjau berisi daftar
   perubahan (tambah / ubah / hapus / urutkan), lalu admin menekan **Terapkan**. Tidak ada
   perubahan halaman yang terjadi hanya karena chat menjawab. Keputusan ini diambil sadar:
   chat bisa salah menafsirkan "hapus kartu ini", dan halaman yang sudah rapi tidak boleh
   rusak oleh satu kalimat yang ambigu.
6. Siapa yang boleh: hanya **Admin Instansi** dan **Admin Aiones**. Role `pengguna` tetap
   hanya mengajukan permintaan dan tidak menyusun halaman — termasuk lewat chat, karena
   menyunting halaman adalah menyusun. Server menolak usulan dari `pengguna` (403).
7. Angka tetap hanya boleh berasal dari butir yang disetujui. Chat boleh mengubah
   tampilan dan susunan; chat **tidak** boleh mengarang angka baru di luar butir.
8. Setiap usulan yang diterapkan tercatat di audit dengan asal "chat", supaya bisa
   dibandingkan dengan susunan awal.

#### 3.2.7 Menutup permintaan

1. Admin menautkan dashboard ke permintaan, lalu menandai **selesai**.
2. Server menolak status `selesai` kalau `dashboardId` tidak ada di instansi itu.
3. User menerima notifikasi dan melihat dashboard dalam mode baca saja.

### 3.3 Admin Aiones

Semua kemampuan Admin Instansi, ditambah:

- Membuat dan mengubah instansi, memetakan KB dan repositori KMS.
- Mengelola akun Admin Instansi (buat, reset sandi, nonaktifkan).
- Konfigurasi RAG, kuota analisis, jejak audit lintas instansi.
- Melihat seluruh permintaan lintas instansi dan berpindah instansi secara sadar (setiap perpindahan dicatat di audit).

---

## 4. Model peran dan matriks izin

### 4.1 Nilai role

Rilis pertama **tidak menambah nilai role**. `UserRole` tetap `'admin' | 'pengguna'`, dan `pengguna` diberi perilaku baru sebagai pemohon. Nilai `superadmin` baru ditambahkan di Fase 4:

```ts
// src/types/index.ts — Fase 4
export type UserRole = 'superadmin' | 'admin' | 'pengguna';
```

Alasan tidak mengganti nama `pengguna` menjadi `user`: 26 pemakaian di kode dan 22 akun di data. Label UI saja yang berubah menjadi "User", "Admin Instansi", "Admin Aiones".

Migrasi: `normalisasiPeranLama()` tetap memetakan `analis`/`direksi` ke `pengguna`. Akun Admin Aiones dibuat baru sebagai akun demo lewat seed (rincian di 12.1), tanpa mengubah akun admin yang sudah ada. Tidak ada sandi bawaan di repo.

### 4.2 Matriks izin (ditegakkan server, bukan hanya UI)

| Kapabilitas | pengguna | admin | superadmin |
|---|---|---|---|
| Buat permintaan data | ya | ya | ya |
| Unggah berkas ke permintaan | miliknya | instansinya | semua |
| Lihat permintaan | miliknya | instansinya | semua |
| Ubah status permintaan | tidak | ya | ya |
| Jalankan analisis dokumen | tidak | ya | ya |
| Lihat katalog butir data | tidak | ya | ya |
| Buat, ubah, hapus dashboard | tidak | ya | ya |
| Impor Excel/CSV, gaya, bagikan tautan | tidak | ya | ya |
| Chat tanya jawab | ya | ya | ya |
| Chat yang mengubah dashboard | tidak | ya | ya |
| Panel admin: pengguna instansi, tampilan menu, ambang batas | tidak | ya | ya |
| Panel admin: instansi, KB/KMS, konfigurasi RAG, audit, kuota | tidak | tidak | ya |
| Pindah instansi `?tenantId` | tidak | tidak | ya |

Aturan tambahan yang wajib:
- `superadmin` tidak boleh menghapus atau menurunkan dirinya sendiri kalau dia superadmin terakhir. Server menolak dengan 409.
- Setiap perpindahan instansi oleh superadmin dicatat di audit log dengan instansi asal dan tujuan.
- Akses lintas instansi untuk `admin` tetap 404, bukan 403, supaya keberadaan data instansi lain tidak bocor.

### 4.3 Perubahan penjagaan endpoint

Tambah satu helper di `server.ts`:

```ts
function butuhPeran(req, res, ...boleh: UserRole[]): SessionPayload | null
```

Lalu:

- `POST/PATCH/DELETE /api/dashboards*`, `/api/impor/*`, `/api/share*`, `/api/dashboards/dari-template`, `/api/templates/segarkan` → `admin`, `superadmin`.
- `/api/admin/users*`, `/api/admin/join-requests*`, `/api/admin/alerts*`, `/api/admin/stats` → `admin`, `superadmin` dengan batas instansi untuk `admin`.
- `/api/admin/tenants*`, `/api/admin/config*`, `/api/admin/kb-*`, `/api/admin/kms-*`, `/api/admin/audit*`, `/api/admin/kuota*` → `superadmin`.
- `/api/chat` tetap untuk semua, tetapi perintah yang menyentuh dashboard ditolak untuk `pengguna` dengan pesan jujur: "Pembuatan dashboard dilakukan admin instansi. Permintaan Anda sudah tercatat."

---

## 5. Model data baru

Tiga koleksi, tiga tabel MySQL per-baris, pola sama seperti `temuan_audit` (`src/services/store/mysqlStore.ts:341`).

### 5.1 `permintaanData` → tabel `permintaan_data`

```ts
interface PermintaanData {
  id: string;                 // pmt-<epoch>
  tenantId: string;
  pemohonId: string;
  pemohonNama: string;
  bidang: string;             // Keuangan | Operasional | Pelayanan | SDM | Perencanaan | Kepatuhan
  judul: string;
  dataDiminta: string[];      // daftar indikator yang diminta
  periode?: string;
  catatanArah?: string;       // arah dashboard dari user
  prioritas: 'rendah' | 'normal' | 'tinggi';
  status: 'baru' | 'diproses' | 'perlu_data' | 'selesai' | 'ditolak';
  berkas: Array<{ id: string; judul: string; jenis?: string; ukuranKb?: number; diunggahPada: string }>;
  dashboardId?: string;
  catatanAdmin?: string;
  riwayat: Array<{ pada: string; oleh: string; aksi: string; catatan?: string }>;
  dibuatPada: string;
  diperbaruiPada: string;
}
```

### 5.2 `analisisDokumen` → tabel `analisis_dokumen`

```ts
interface AnalisisDokumen {
  id: string;                 // anl-<epoch>
  tenantId: string;
  permintaanId?: string;
  berkasId: string;           // id dokumen di KMS atau id basis dokumen
  judulBerkas: string;
  jenisBerkas?: string;
  status: 'antri' | 'proses' | 'selesai' | 'gagal';
  metode: 'tabel-lokal' | 'rag-extract';
  ringkasan?: string;
  kategoriTerdeteksi: string[];      // unik, urut sesuai jumlah butir
  rekomendasiTemplate?: SaranTemplate[];  // lihat 7.3
  jumlahButir: number;
  galat?: string;
  percobaan: number;
  leaseSampai?: number;       // pengunci antar instance PM2
  dibuatPada: string;
  selesaiPada?: string;
}
```

### 5.3 `butirData` → tabel `butir_data`

```ts
interface ButirData {
  id: string;                 // btr-<epoch>-<n>
  tenantId: string;
  analisisId: string;
  berkasId: string;
  permintaanId?: string;
  nama: string;               // "Beban Operasional"
  kategori: string;           // dari kategoriWidget, bukan tebakan LLM
  periode?: string;
  satuan?: string;
  nilai?: number | null;
  seri?: Array<{ nama: string; data: number[]; kategori?: string[] }>;
  tabel?: { kolom: string[]; baris: Array<Array<string | number>> };
  bentukDisarankan: WidgetType;   // dari REKOMENDASI_TIPE
  chartIdDisarankan?: string;     // dari katalog yang cocok
  sitasi: { dokumen: string; halaman?: number; kutipan?: string };
  keyakinan: 'tinggi' | 'sedang' | 'rendah';
  status: 'draf' | 'disetujui' | 'ditolak';
  dibuatPada: string;
}
```

Aturan status butir:

- Butir dengan `keyakinan: 'tinggi'` dan sitasi lengkap langsung berstatus `disetujui` saat analisis selesai. Admin tidak perlu menyetujui satu per satu sebelum bisa memilih, cukup menolak yang keliru.
- Butir dengan `keyakinan: 'sedang'` atau `'rendah'` masuk `draf` dan menunggu keputusan admin.
- Butir tanpa sitasi selalu `draf`, walaupun angkanya terlihat masuk akal.

### 5.4 Perubahan pada tipe lama

- `UserRole` bertambah `superadmin` (Fase 4).
- `Tenant` tidak berubah.
- `NotificationItem` dipakai ulang, tetapi **harus ditambah kolom penerima**. Sekarang notifikasi hanya punya `tenantId`, sehingga semua orang di instansi melihat notifikasi yang sama dan tidak ada notifikasi pribadi untuk pemohon.

  ```ts
  interface NotificationItem {
    // ...kolom lama tetap
    untukUserId?: string;                        // pemohon atau admin tertentu
    untukRole?: 'pengguna' | 'admin';            // siaran ke satu peran
    jenis?: 'permintaan-baru' | 'permintaan-perlu-data' | 'permintaan-selesai' | 'analisis-gagal';
    permintaanId?: string;
  }
  ```

  Aturan saring di `GET /api/notifications`: kirim notifikasi yang `untukUserId` sama dengan pengguna, ditambah yang `untukRole` sama dengan perannya di instansi itu, ditambah yang tidak punya keduanya (notifikasi lama tetap tampil). Notifikasi alert yang sudah ada tidak berubah perilakunya.
- `Dashboard` tidak berubah. Tautan ke permintaan disimpan di `PermintaanData.dashboardId`, bukan di dashboard, supaya satu dashboard bisa dipakai beberapa permintaan.

### 5.5 Cascade dan migrasi

- `deleteTenant` ikut menghapus `permintaanData`, `analisisDokumen`, `butirData` (pola `inMemoryDb.ts:1558`).
- Snapshot `DbSnapshot` bertambah tiga field, dan `saveAll`/`loadAll` menanganinya seperti koleksi fitur lain.
- Tidak ada backfill. Koleksi mulai kosong.

### 5.6 Dari mana pilihan data berasal

Ini pertanyaan penting: apakah daftar data yang bisa dipilih admin muncul langsung dari RAG? **Tidak.** RAG yang ada sekarang hanya menyediakan tiga hal:

| Kemampuan RAG sekarang | Keluaran | Dipakai di |
|---|---|---|
| `daftarDokumen(kbId)` | daftar dokumen: nama, status, jumlah halaman, potongan, token | `/api/berkas`, chat "dokumen apa saja", pemilihan dokumen target di builder |
| `ambilDataWidget(query, ...)` | angka nyata satu indikator, tapi **namanya harus sudah diketahui** | katalog preset widget, fallback generasi dashboard |
| `profilInstansi(kbId)` | profil instansi | konteks builder |

Tidak ada fungsi RAG untuk "sebutkan semua indikator yang tersedia". Jadi daftar pilihan data tidak bisa langsung dipinjam dari RAG, harus dibentuk lebih dulu.

Tiga sumber butir data, dari yang paling murah:

1. **Impor Excel/CSV** (`src/services/impor/tabel.ts`). Sudah ada, tanpa LLM, hasilnya tabel utuh dengan kolom dan baris. Bisa langsung jadi butir data pada rilis pertama. Ini yang membuat menu pilihan data bisa ada sebelum AI ekstraksi dikerjakan.
2. **Ekstraksi dokumen lewat RAG** dengan `SKEMA_BUTIR` (Fase 2). Ini yang membuat PDF dan Word ikut menghasilkan butir.
3. **Ambil angka per indikator** lewat `ambilDataWidget` ketika admin mengetik nama indikator sendiri. Ini jalur cadangan kalau ekstraksi belum jalan, dan sudah punya cache 6 jam supaya angkanya tidak berubah tiap muat.

Karena itu urutan kerja yang saya sarankan: pada rilis pertama, menu pilihan data sudah ada tetapi isinya dari impor tabel dan dokumen yang sudah diimpor. Setelah Fase 2, isinya bertambah otomatis dari hasil ekstraksi PDF dan Word.

### 5.7 Bidang permintaan dan kategori data

Ada dua daftar yang mirip tetapi berbeda, dan plan sebelumnya tidak menjelaskan hubungannya:

| Hal | Artinya | Contoh |
|---|---|---|
| Bidang permintaan | unit atau urusan yang mengajukan, dipilih user saat membuat permintaan | Keuangan, Operasional, Pelayanan |
| Kategori data | sifat isi satu butir, dihitung dari nama indikator | Keuangan, Pelayanan, Umum |

Kalau dibiarkan, satu permintaan berbidang Keuangan bisa menghasilkan butir berkategori Pelayanan, dan admin melihat dua pengelompokan yang saling bertabrakan.

Keputusan yang saya pakai, dan sudah disetujui pemilik pada 2026-11-06: **bidang memakai daftar yang sama dengan kategori**, yaitu Keuangan, Operasional, Pelayanan, SDM, Kinerja, Umum. Alasannya, filter dashboard yang sudah ada juga memakai enam kategori itu, jadi pengguna melihat satu istilah yang konsisten dari awal sampai akhir. Daftar ini tidak dikunci: bidang khusus per instansi (misalnya Perencanaan atau Kepatuhan) bisa ditambah kemudian lewat konfigurasi instansi tanpa mengubah struktur data, dan tambahan itu tidak membatalkan permintaan yang sudah ada.

Konsekuensi yang perlu diterima: kalau sebuah permintaan berbidang Keuangan menghasilkan butir Pelayanan, butir itu tetap muncul di bawah kategori Pelayanan pada katalog, dan diberi penanda "berasal dari permintaan Keuangan". Jadi tidak hilang, hanya dikelompokkan menurut isinya, bukan menurut siapa yang meminta.

---

### 5.8 Cache hasil RAG — dokumen dibaca sekali saja

Membaca dokumen lewat RAG memakan token dan waktu. Karena itu hasil analisis **disimpan**
dan dipakai ulang; RAG hanya dipanggil lagi kalau memang ada yang berubah.

1. Setiap analisis menyimpan **sidik dokumen** (`sidikDokumen`) dan **sidik basis**
   (`sidikKb`).
   - `sidikDokumen` = id berkas + ukuran + tipe + waktu unggah. Berubah bila berkasnya
     diganti.
   - `sidikKb` = daftar id dokumen + waktu ubah, disortir. Berubah bila **ada dokumen
     baru** masuk ke basis instansi.
2. Saat admin menekan analisis pada dokumen yang sudah pernah dianalisis:
   - sidik sama dan umur masih di bawah 30 hari → **pakai hasil tersimpan**, RAG tidak
     dipanggil, kuota tidak terpakai.
   - dokumen berubah → dibaca ulang dengan isi terbaru.
   - ada dokumen baru di basis → dibaca ulang supaya indikator baru ikut tertangkap.
   - cache lebih tua dari 30 hari → dibaca ulang walau sidik sama, supaya kesalahan lama
     tidak hidup selamanya.
3. Admin selalu bisa memaksa: tombol **Baca ulang dari RAG** (`segarkan: true`). Ini satu-
   satunya jalan yang menghabiskan kuota tanpa ada perubahan dokumen.
4. Pemberitahuan, bukan tindakan diam-diam: `GET /api/analisis/kesegaran` memberi tahu
   analisis mana yang dibuat sebelum ada dokumen baru. Analisis ulang **tidak** dijalankan
   otomatis, karena memakan kuota dan bisa mengubah angka yang sudah disetujui admin.
5. Analisis ulang mengganti butir lama, bukan menumpuknya. Persetujuan butir karena itu
   ikut direset — angka yang berubah tidak boleh tetap berstatus "disetujui" dari
   persetujuan atas angka yang berbeda.
6. Sidik bersifat lunak: bila `sidikKb` tidak bisa diambil (KMS belum dipetakan), cache
   tetap dipakai dan tidak memaksa analisis ulang. Ketiadaan data sidik bukan alasan
   membuang token.
7. Cache di memori (`cacheSapuan`, `cacheIndikator` di `rag/http.ts`, 6 jam) tetap ada
   untuk pertanyaan berulang dalam satu instance. Cache di database adalah yang bertahan
   lintas restart dan lintas instance PM2 — keduanya tidak saling menggantikan.

## 6. Endpoint baru

### 6.1 Permintaan

| Metode | Jalur | Peran | Isi |
|---|---|---|---|
| POST | `/api/permintaan` | semua | buat permintaan. `pengguna` otomatis jadi pemohon |
| GET | `/api/permintaan` | semua | `pengguna`: miliknya. `admin`: instansinya. `superadmin`: `?tenantId=` |
| GET | `/api/permintaan/:id` | semua | detail + berkas + analisis ringkas |
| PATCH | `/api/permintaan/:id` | admin | status, catatan admin, `dashboardId` |
| PATCH | `/api/permintaan/:id/pemohon` | pemohon | hanya saat status `baru` dan `perlu_data` |
| POST | `/api/permintaan/:id/berkas` | pemohon, admin | tautkan berkas yang sudah diunggah lewat `/api/berkas/unggah` |
| DELETE | `/api/permintaan/:id/berkas/:berkasId` | pemohon saat `baru`, admin | lepas tautan, berkas KMS tidak dihapus |

Aturan status yang ditegakkan server:

- `baru` → `diproses` hanya oleh admin.
- `diproses` → `perlu_data` wajib `catatanAdmin`.
- `perlu_data` → `baru` oleh pemohon setelah menambah berkas.
- `diproses` → `selesai` wajib `dashboardId` yang benar-benar ada di instansi itu.
- `ditolak` wajib alasan.
- Setiap perubahan menulis `riwayat` dan audit log.

### 6.2 Analisis dan butir data

| Metode | Jalur | Peran | Isi |
|---|---|---|---|
| POST | `/api/analisis` | admin | analisis satu berkas `{ berkasId, permintaanId? }` |
| POST | `/api/analisis/antri` | admin | analisis semua berkas baru instansi, maksimum N per panggilan |
| GET | `/api/analisis` | admin | daftar analisis + status, filter `?permintaanId=` |
| GET | `/api/butir-data` | admin | filter `?kategori=&berkasId=&permintaanId=&status=` |
| PATCH | `/api/butir-data/:id` | admin | setujui, tolak, koreksi kategori/satuan/nama |
| POST | `/api/butir-data/pilih` | admin | validasi pilihan sebelum menyusun halaman |

Pemicu otomatis: `POST /api/berkas/unggah` yang membawa `permintaanId` menyisipkan baris `analisisDokumen` berstatus `antri`, lalu worker latar mengambilnya. Unggahan tidak menunggu analisis selesai.

### 6.3 Susun halaman

| Metode | Jalur | Peran | Isi |
|---|---|---|---|
| POST | `/api/dashboards/dari-butir` | admin | `{ butirIds[], judul, gaya?, dashboardId? }` → dashboard atau halaman baru |

Aturan:

- Semua butir wajib milik instansi yang sama dan berstatus `disetujui`. Butir `draf` boleh dipilih hanya kalau admin menyetujuinya di tempat, satu klik, tanpa pindah halaman.
- Widget dibangun dari butir, bukan dari LLM, jadi angka dan sitasi tidak bisa berubah.
- Kalau `dashboardId` diisi, halaman ditambahkan ke dashboard itu. Kalau tidak, dashboard baru dibuat.
- **Batas halaman**: maksimum 9 widget per halaman, mengikuti pola template yang sudah ada (4 kartu angka, 4 grafik, 1 tabel) supaya tetap satu layar tanpa scroll. Kalau pilihan admin lebih dari 9, server memecahnya menjadi halaman lanjutan otomatis dengan nama "Bagian 1", "Bagian 2", dan seterusnya, lalu memberi tahu admin bahwa halaman dipecah.
- Kalau satu kategori mendominasi, pemecahan mengikuti kategori: halaman pertama kategori terbanyak, halaman berikutnya kategori lain. Jadi halaman tidak berisi potongan acak.
- Respons memuat `dashboardId`, `jumlahWidget`, `kategoriTerdeteksi`, `halamanDibuat`, dan daftar butir yang gagal dipetakan beserta alasannya.

---

## 7. Alur AI yang dipakai (hemat token, hasil konsisten)

Pembagian tugas yang saya sarankan:

| Langkah | Dikerjakan oleh | Alasan |
|---|---|---|
| Baca isi dokumen, temukan indikator + angka + halaman | RAG `/extract` dengan skema baru `SKEMA_BUTIR` (satu panggilan per dokumen) | Hanya bagian ini yang butuh LLM |
| Kategori tiap butir | `kategoriWidget()` deterministik | Hasil sama tiap kali, gratis, sudah teruji |
| Bentuk chart yang disarankan | `REKOMENDASI_TIPE` + katalog `chartId` | Konsisten, gratis |
| Excel/CSV | `src/services/impor/tabel.ts`, tanpa LLM | Nol token untuk data tabel |
| Menyusun widget | `butirKeWidget()` murni | Angka tidak bisa dikarang |
| Penyempurnaan halaman | Chat AI yang sudah ada | Sudah terbukti |

### 7.1 Skema baru

`SKEMA_BUTIR` di `src/services/rag/http.ts`:

```json
{
  "butir": [{
    "nama": "string",
    "periode": "string|null",
    "satuan": "string|null",
    "nilai": "number|null",
    "seri": [{ "nama": "string", "data": ["number"], "kategori": ["string"] }],
    "tabel": { "kolom": ["string"], "baris": [["string|number"]] },
    "halaman": "number|null",
    "kutipan": "string|null"
  }]
}
```

Aturan prompt: dilarang mengarang angka. Kalau dokumen tidak memuat nilai, butir tidak dikirim. Sitasi wajib nama dokumen + halaman.

### 7.2 Antrean dan biaya

- Maksimum 2 analisis berjalan bersamaan per instance, satu klaim per berkas lewat `leaseSampai` supaya dua instance PM2 tidak menganalisis dokumen yang sama.
- Cache: berkas yang sama dengan `berkasId` dan ukuran sama tidak dianalisis ulang dalam 7 hari.
- Kuota: `systemConfig.kuotaAnalisisHarian` per instansi, bawaan 20 dokumen per hari. Lewat kuota, server membalas 429 dengan pesan jujur dan sisa kuota, dan baris analisis berstatus `tertunda-kuota` bukan `gagal`. Admin melihat "menunggu kuota besok" dan bisa meminta kenaikan kuota, bukan mengira dokumennya rusak. Saat kuota harian direset, antrean `tertunda-kuota` jalan sendiri.
- Gagal 429/timeout: ulang maksimum 2 kali dengan jeda 20 dan 60 detik, lalu status `gagal` dengan alasan yang terlihat admin.
- Meteran: jumlah analisis dan token per instansi ditampilkan di panel superadmin.

### 7.3 Rekomendasi kategori, bentuk tampilan, dan template

Tiga lapis rekomendasi, semuanya deterministik dan tanpa token:

| Lapis | Masukan | Keluaran | Sumber |
|---|---|---|---|
| Bentuk tampilan per butir | nama indikator, satuan, bentuk data | `WidgetType` + `chartId` | `REKOMENDASI_TIPE` yang sudah ada |
| Template halaman per kategori | kategori, kata kunci butir, jumlah butir | 2 template teratas + alasan | `fokus` dan `deskripsi` 5 template |
| Susunan halaman | daftar butir terpilih | peran tiap widget: angka utama, tren, komposisi, tabel | aturan tetap per kategori |

Berkas baru `src/services/data/rekomendasiKategoriTemplate.ts`:

```ts
export interface SaranTemplate {
  templateId: string;   // tpl-ringkasan | tpl-analitik | tpl-trafik | tpl-kaca | tpl-rapat
  nama: string;         // Pijar | Lensa | Nadi | Kaca | Rapat Manajemen
  skor: number;         // 0..1
  alasan: string;       // "cocok untuk tren pendapatan dan komposisi beban"
}

export function saranTemplate(kategori: string, butir: ButirData[]): SaranTemplate[];
export function saranSusunanHalaman(butir: ButirData[]): Array<{ butirId: string; peran: 'utama' | 'tren' | 'komposisi' | 'tabel' }>;
```

Cara menilai, tanpa LLM:

1. Kata kunci diambil dari nama butir dan kategori, lalu dicocokkan dengan `fokus` dan `deskripsi` tiap template. Contoh: butir "Pendapatan Usaha Tahunan" cocok dengan fokus "Tren pendapatan" di Pijar dan Lensa.
2. Skor = jumlah kata kunci yang cocok dibagi jumlah kata kunci template, ditambah bonus kecil kalau kategori butir memang ada di `fokus` template.
3. Kalau tidak ada yang cocok, tampil dua template umum (Pijar dan Lensa) dengan alasan "paling umum untuk ringkasan pimpinan", bukan alasan kosong.
4. Aturan susunan halaman: nilai tunggal terbanyak jadi kartu angka utama, deret waktu jadi grafik garis, komposisi jadi cincin atau batang, tabel panjang jadi tabel. Kalau kategori Keuangan, kartu utama didahulukan.

Biaya: nol token, hasil sama tiap kali, dan bisa diuji unit tanpa memanggil RAG. Ini penting karena rekomendasi yang berubah-ubah tiap muat halaman akan membingungkan admin.

Uji `tests/rekomendasiKategoriTemplate.test.ts`: setiap template bisa muncul untuk butir yang tepat, tidak ada hasil kosong, urutan stabil, dan butir tanpa kategori jatuh ke "Umum".

### 7.4 Yang disimpan setelah analisis

`AnalisisDokumen` menyimpan hasil rekomendasi supaya tidak dihitung ulang tiap buka halaman:

```ts
rekomendasiTemplate?: SaranTemplate[];
kategoriTerdeteksi: string[];   // unik, urut sesuai jumlah butir
```

Kalau admin mengoreksi kategori satu butir, rekomendasi dihitung ulang untuk analisis itu saja.

### 7.5 Mengisi slot template dari butir

Template yang ada (Pijar, Lensa, Nadi, Kaca, Rapat Manajemen) bukan sekadar gambar. Tiap template punya daftar slot dengan jenis dan ukuran sendiri, misalnya empat slot `kpi` di baris pertama, satu slot `bar` lebar 8, satu slot `donut` lebar 4, satu `table`, dan beberapa `progress`.

Ada dua cara mengisi slot, dan keduanya sudah berbeda biaya:

| Cara | Bahan | Biaya | Kelemahan |
|---|---|---|---|
| `isiTemplateDariRag` (sudah ada, dipakai di `server.ts:413`) | RAG ditanya per slot | satu panggilan per slot, token besar | angka bisa berbeda antar pemuatan, tidak ada jaminan sitasi |
| `butirKeSlotTemplate` (baru) | butir data yang sudah diekstrak | nol token | hanya bisa dipakai kalau butir sudah ada |

Rancangan `butirKeSlotTemplate`:

```ts
export function butirKeSlotTemplate(
  template: DashboardTemplate,
  butir: ButirData[]
): { widget: WidgetSpec[]; kosong: Array<{ slotId: string; alasan: string }> };
```

Cara mencocokkan:

1. Tiap slot punya jenis. Slot `kpi` hanya menerima butir nilai tunggal. Slot `bar`, `line`, dan `area` menerima butir dengan seri. Slot `donut` menerima butir komposisi. Slot `table` menerima butir bertabel.
2. Di antara butir yang bentuknya cocok, skor dihitung dari kecocokan kategori dengan tema slot, kemiripan nama dengan judul slot, dan kelengkapan data.
3. Slot yang tidak mendapat butir dibiarkan kosong dengan label "belum ada data" beserta alasannya. Tidak diisi angka contoh, karena angka contoh di dashboard resmi adalah kesalahan serius.
4. Hasilnya dikembalikan sebagai `WidgetSpec` siap pakai, lengkap dengan sitasi, sehingga langsung bisa disimpan sebagai halaman.

Dengan ini, kalimat "di setiap template di kategorinya ada rekomendasi AI" punya wujud konkret: admin memilih template yang disarankan, slotnya terisi otomatis dari butir yang relevan, dan slot yang belum ada datanya terlihat jujur.

---

## 8. UI dan navigasi

### 8.1 Halaman baru

| Berkas | Untuk | Isi |
|---|---|---|
| `src/pages/PermintaanDataPage.tsx` | pengguna | daftar permintaan saya, form baru, unggah berkas, catatan arah, status |
| `src/pages/KotakMasukPage.tsx` | admin | daftar permintaan instansi, detail, panel Isi Dokumen, tombol analisis, ubah status, tautkan dashboard |
| `src/pages/KatalogDataPage.tsx` | admin | butir per kategori, kartu rekomendasi template dan bentuk tampilan, filter, sitasi, setujui/tolak, pilihan lalu "Buat Halaman" |
| `src/components/IsiDokumenPanel.tsx` | admin | ringkasan hasil analisis satu dokumen: jumlah butir, indikator, halaman sitasi, keyakinan, tombol analisis ulang |

### 8.2 Perubahan berkas yang ada

- `src/components/Sidebar.tsx`: grup baru **"Permintaan Data"**. Untuk `pengguna` hanya "Permintaan Saya". Untuk `admin` dan `superadmin` ada "Kotak Masuk" dan "Katalog Data". Grup "Sistem & Tata Kelola" disaring per role.
- `src/App.tsx`: `viewMode` baru `'permintaan' | 'kotakMasuk' | 'katalogData'`, lazy import, label breadcrumb, dan gerbang rute per role.
- `src/pages/DashboardList.tsx` dan `App.tsx`: tombol buat, impor, gaya, bagikan, hapus disembunyikan untuk `pengguna`, dan server tetap menolak kalau dipaksa.
- `src/components/adminTabs.ts` + `src/pages/Admin.tsx`: tab diberi penanda `peran: 'admin' | 'superadmin'`. Tab instansi, KB/KMS, RAG, audit, kuota hanya muncul untuk superadmin.
- `src/pages/ManajemenBerkasPage.tsx`: form unggah menerima `permintaanId`, dan setelah unggah menampilkan status "sedang dianalisis".
- `src/components/ChatPanel.tsx`: untuk `pengguna`, kolom kirim tetap ada tetapi perintah pembuatan dashboard dijawab dengan arahan ke admin. Untuk admin, chat membawa `dashboardId` **dan** `halamanAktifId` beserta daftar widget halaman itu, sehingga "sempurnakan halaman ini" berarti halaman yang sedang dibuka — bukan halaman mana pun yang dipilih model.

### 8.3 Preferensi tampilan yang sudah ada wajib dipertahankan

- Tema Midnight Indigo, tanpa warna mentah di JSX, kartu flat tanpa shadow.
- Tampilan awal selalu daftar Workspace.
- Dashboard tampil satu halaman penuh, tanpa scroll.
- Teks penjelasan halaman pendek.
- Sidebar hanya satu menu Workspace untuk pengguna biasa.

---

## 9. Fase pekerjaan

Setiap fase berakhir dengan `npm test` dan `npx tsc --noEmit` hijau, plus ringkasan perubahan. Commit hanya atas persetujuan, dan hanya berkas fase itu.

### Fase 0: Gerbang role untuk user (tanpa fitur baru)

1. Helper `butuhPeran()` di `server.ts` dan penjagaan ulang endpoint tulis sesuai matriks 4.2. Untuk rilis pertama cukup dua tingkat: `pengguna` dan `admin`.
2. Sembunyikan aksi tulis untuk `pengguna` di UI: buat dashboard, impor, gaya, bagikan, hapus.
3. Panel admin tetap hanya untuk `admin`.
4. Uji: `tests/rbac.test.ts` (matriks murni) + skrip curl 401/403 per role.

Berkas: `server.ts`, `src/services/auth/session.ts`, `src/components/Sidebar.tsx`, `src/pages/DashboardList.tsx`, `src/App.tsx`.

Risiko utama fase ini: akun `pengguna` yang selama ini bisa membuat dashboard akan kehilangan hak itu. Ini memang yang diminta, tetapi harus diumumkan sebelum rilis.

### Fase 1: Permintaan data (tanpa AI)

1. Tipe + koleksi + tabel `permintaan_data` + CRUD + cascade.
2. Endpoint 6.1 lengkap dengan aturan status.
3. Notifikasi berperan: tambah `untukUserId`, `untukRole`, `jenis`, `permintaanId` pada `NotificationItem`, saring di `/api/notifications`, plus audit untuk setiap perubahan status.
4. UI: `PermintaanDataPage` dan `KotakMasukPage`, unggah berkas tertaut.
5. **Katalog data versi awal** dari impor Excel/CSV: butir dibentuk dari tabel yang sudah diimpor, tanpa LLM (bagian 5.6). Menu pilihan data sudah bisa dipakai sebelum ekstraksi AI ada.
6. Uji: `tests/permintaan.test.ts` (transisi status, validasi, isolasi tenant, hak pemohon) + e2e curl dua role.

Berkas: `src/types/index.ts`, `src/services/store/inMemoryDb.ts`, `src/services/store/mysqlStore.ts`, `server.ts`, dua halaman baru, `Sidebar.tsx`, `App.tsx`, `ManajemenBerkasPage.tsx`.

### Fase 2: Analisis dokumen dan katalog data

1. `src/services/data/analisis.ts` murni: normalisasi keluaran RAG menjadi butir, kategori, bentuk chart, dedupe, buang angka tanpa sitasi.
2. `src/services/data/rekomendasiKategoriTemplate.ts`: saran template per kategori dan saran susunan halaman (bagian 7.3).
3. `src/services/data/antrean.ts`: klaim lease, concurrency 2, retry, kuota.
4. `SKEMA_BUTIR` di `src/services/rag/http.ts` + metode `ekstrakButir()`.
5. Koleksi + tabel `analisis_dokumen` dan `butir_data`.
6. Endpoint 6.2 + pemicu otomatis dari unggah.
7. UI `KatalogDataPage` + panel Isi Dokumen + kartu rekomendasi per kategori di detail permintaan.
8. Uji: `tests/analisisButir.test.ts` (pemetaan, kategori, dedupe, sitasi wajib), `tests/rekomendasiKategoriTemplate.test.ts` (saran template, urutan stabil, tidak pernah kosong), `tests/antreanAnalisis.test.ts` (lease, retry, kuota), e2e dengan satu PDF dan satu XLSX.

Berkas: `src/services/data/*` baru, `src/services/rag/http.ts`, `src/services/store/*`, `server.ts`, `KatalogDataPage.tsx`, `KotakMasukPage.tsx`.

### Fase 3: Susun halaman dan penyempurnaan chat

1. `src/services/analisis/butirKeWidget.ts` murni: butir → `WidgetSpec` lengkap dengan `chartId`, kategori, periode, sitasi. (Bukan `src/services/data/` — `.gitignore` memuat pola `data/` yang menelan folder bernama data di kedalaman mana pun.)
2. `src/services/analisis/butirKeSlotTemplate.ts`: isi slot template yang disarankan dari butir, slot kosong diberi label jujur (bagian 7.5).
3. Endpoint `POST /api/dashboards/dari-butir`, termasuk batas 9 widget per halaman dan pemecahan halaman otomatis.
4. UI: bilah pilihan butir, modal "Buat Halaman", pilih template yang disarankan, tautkan ke permintaan, notifikasi selesai.
5. Chat sebagai penyunting halaman: kirim `dashboardId` + `halamanAktifId` + daftar widget halaman + butir yang disetujui. Tanpa `halamanAktifId`, chat saat ini hanya tahu dashboard dan bisa mengubah halaman yang salah — itu yang harus diperbaiki lebih dulu. Perintah yang harus dikenali: tambah widget, ubah tipe/judul, hapus widget, susun ulang urutan. Yang merusak data (hapus/timpa) ditawarkan sebagai usulan yang bisa dibatalkan.
6. Uji: `tests/butirKeWidget.test.ts` (validasi `WidgetSpecSchema`, sitasi, pengelompokan halaman), `tests/butirKeSlotTemplate.test.ts` (slot terisi sesuai jenis, slot kosong tidak diisi angka contoh, batas 9 widget), e2e satu permintaan penuh dari user sampai selesai.

Berkas: `src/services/analisis/butirKeWidget.ts`, `src/services/analisis/butirKeSlotTemplate.ts`, `server.ts`, `KatalogDataPage.tsx`, `App.tsx`, `ChatPanel.tsx`.

**Status 2026-11-06 (commit Fase 3):**

| Bagian | Keadaan |
|---|---|
| `butirKeWidget.ts` | selesai — angka dari butir apa adanya, butir tanpa angka tidak dibuatkan kartu, sitasi ikut, batas 9 per halaman |
| `POST /api/dashboards/dari-butir` | selesai — buat dashboard baru atau tambah halaman, tautkan ke permintaan, audit |
| `usulan.ts` + `/api/usulan/*` | selesai — validasi (wajib sitasi), pratinjau, Terapkan/Batalkan, transaksi batal utuh bila gagal |
| Chat mode "sempurnakan halaman" | selesai — `halamanId` + daftar kartu + butir disetujui jadi konteks; hasilnya usulan, bukan perubahan langsung |
| `butirKeSlotTemplate.ts` | selesai — slot template diisi butir; slot tanpa butir dibiarkan KOSONG dengan alasan (tidak diisi angka contoh); batas 9 kartu; 15 tes |
| UI pemilihan butir ("Katalog Data") | selesai — `KatalogDataPanel` di detail permintaan: centang butir disetujui, pilih template yang disarankan, pratinjau jujur (terisi vs kosong) sebelum halaman dibuat |
| Endpoint menerima `templateId` | selesai — `POST /api/dashboards/dari-butir` memakai susunan template bila `templateId` dikirim, dan mengembalikan `ringkasan` + `slotKosong` |



**Status Fase 5 (2026-11-06):**

| Bagian | Keadaan |
|---|---|
| Uji tiga role di browser | selesai — tapi memakai instansi yang sudah ada (Tirta Moedal/PAM JAYA), bukan instansi uji khusus seperti di rencana |
| Uji beban kecil (5 dokumen) | selesai lewat simulasi antrean, 7 kasus (`tests/antreanBersamaan.test.ts`). Unggah 5 berkas sungguhan belum bisa diuji karena KMS |
| `npm test` / `tsc` / `build` | lulus — 518 tes, tsc bersih, build bersih |
| Redeploy ke panel | BELUM — menunggu izin pemilik. Produksi masih `e583358` |
| Vault | selesai — `Alur 3 Role.md`, `Laporan Verifikasi 2026-11-06.md`, `Aiones Boards.md` diperbarui |

**Koreksi 2026-11-06 (setelah uji coba di browser):** tombol "Sempurnakan halaman" DIHAPUS.

Tombol itu membuat dua pintu ke asisten yang sama, dan admin harus ingat sedang di pintu mana.
Yang benar: asisten selalu membaca konteks halaman (judul, daftar kartu, butir disetujui), lalu
membedakan sendiri kalimat pertanyaan dari permintaan mengubah halaman.

- `niatUbahHalaman(pesan)` — deteksi deterministik tanpa model (`src/services/analisis/niatUbahHalaman.ts`).
  Kata tanya di awal kalimat menang atas kata kerja ("berapa kartu yang perlu ditambah?" = pertanyaan),
  kecuali kalimatnya menyuruh ("tolong tambahkan grafik, berapa lama?" = perintah).
  "buat dashboard baru" dan "tambahan data" dikecualikan.
- Permintaan perubahan → `POST /api/usulan/dari-chat` → kartu usulan + Terapkan.
- Pertanyaan → `POST /api/chat` seperti biasa.
- Pagar "usulan dulu, baru Terapkan" TETAP: yang dibuang tombol modenya, bukan pengamannya.

**Status Fase 4 (commit):**

| Bagian | Keadaan |
|---|---|
| Pembagian tab per peran | selesai — `AdminTab.peran`; Admin Instansi hanya melihat Ringkasan, Pengguna, Ambang Batas (tab Tampilan Menu dihapus 2026-11-06 atas permintaan pemilik) |
| Tab Kuota AI | selesai — tabel pemakaian per instansi + ubah batas harian (0–1000) |
| `GET /api/admin/platform` | selesai — ringkasan lintas instansi (akun per peran, permintaan, analisis, butir, kuota) |
| Penjagaan Admin Aiones terakhir | selesai — turunkan/hapus akun superadmin terakhir ditolak 409 `SUPERADMIN_TERAKHIR` |
| Ringkasan platform di layar | selesai — enam kartu lintas instansi di tab Ringkasan (hanya Admin Aiones), dihitung ulang saat tab dibuka |
| Jejak audit lintas instansi berfilter | selesai — `tenantId` + `aksi` + `pengguna` + rentang waktu; Admin Instansi dipaksa ke instansinya sendiri; CSV lintas instansi menyertakan kolom Instansi |



### Fase 4: Panel Admin Aiones

Tidak lagi ditunda: pemilik memutuskan akun demo baru dibuat (12.1).

1. Tab baru: Ringkasan platform, Instansi, KB/KMS, Akun Admin Instansi, Kuota AI, Audit lintas instansi.
2. Pemisahan tab per role.
3. Penjagaan superadmin terakhir.
4. Uji: matriks 403, perpindahan instansi tercatat.

Berkas: `src/pages/Admin.tsx`, `src/components/adminTabs.ts`, `server.ts`.

### Fase 5: Uji menyeluruh dan rilis

1. Uji tiga role di browser nyata dengan data uji di instansi uji, bukan PAM JAYA.
2. Uji beban kecil: 5 dokumen diunggah bersamaan, pastikan antrean tidak menggandakan analisis.
3. `npm test`, `tsc`, `npm run build`.
4. Redeploy ke panel setelah lulus. Produksi sekarang masih `e583358` (12 commit di belakang HEAD), jadi rilis ini sekaligus menutup jarak itu.
5. Catatan vault: perbarui `Aiones Boards.md`, buat `Alur 3 Role.md`, dan tulis laporan verifikasi.

---


### Fase 6: Rilis terkendali dan verifikasi dengan AI sungguhan

Fase 0–5 mengubah kode. Fase 6 memindahkan kode itu ke tangan pengguna, dan menguji satu hal yang tidak bisa diuji di mesin pengembangan: **apakah jalur AI benar-benar bekerja**. Semua uji sampai Fase 5 memakai data tanam karena RAG membalas 502 di lingkungan lokal.

Urutannya tidak boleh ditukar:

1. **Cadangan dulu.** Backup situs + database produksi, berlabel commit yang sedang berjalan (`e583358`). Tanpa ini, rollback hanya mengandalkan release lama yang tidak menyertakan data.
2. **Deploy.** Produksi sekarang `e583358`, tertinggal 19 commit. Rilis membawa perubahan perilaku: 21 akun `pengguna` kehilangan hak menyusun dashboard.
3. **Asap uji (5 menit), dalam urutan ini:**
   - Halaman masuk terbuka, tidak ada galat konsol.
   - Login Admin Instansi → Panel Admin hanya 4 tab.
   - Login Admin Aiones → 8 tab, kartu Ringkasan Platform berisi angka.
   - Login `pengguna` → tidak ada tombol dashboard, menu "Permintaan Data" ada.
   - `POST /api/chat` sebagai `pengguna` → 403 dengan pesan yang benar.
4. **Uji AI sungguhan dengan satu dokumen kecil** di satu instansi, bukan seluruh instansi sekaligus:
   - Unggah satu PDF → analisis berjalan → butir muncul dengan sitasi.
   - Setujui satu butir → Katalog Data → Buat halaman → angka di kartu cocok dengan dokumen.
   - Buka asisten, minta satu perubahan → usulan muncul → Terapkan.
   Kalau langkah ini gagal, yang salah adalah konfigurasi RAG/API key produksi, bukan kode — dan itu bisa diperbaiki tanpa rollback.
5. **Kriteria rollback.** Rollback bila: halaman masuk tidak terbuka, login gagal, atau data instansi tidak terbaca. Jangan rollback hanya karena analisis AI gagal — itu jalur eksternal, dan status `gagal` sudah tidak memakai kuota.

Yang masih belum bisa diverifikasi dari sini dan tetap menjadi risiko: unggah berkas lewat KMS, dan perilaku RAG di bawah beban nyata.

**Status 2026-11-06:** belum dijalankan. Panel Kroombox membalas "temporarily unavailable" saat backup hendak dibuat, jadi langkah 1 pun belum bisa dimulai.

## 10. Risiko dan jebakan

| Risiko | Dampak | Penanganan |
|---|---|---|
| `server.ts` sudah 7.100 baris | Sulit dirawat, konflik besar | Semua logika baru di `src/services/data/*` murni, endpoint hanya tipis |
| Dua instance PM2 | Analisis ganda, biaya token dobel | Klaim lease di DB, bukan flag di memori |
| RAG 429/timeout | Analisis gagal, admin bingung | Retry berjenjang, status `gagal` dengan alasan, kuota, cache |
| Biaya token | Tagihan membengkak | Excel/CSV tanpa LLM, satu panggilan per dokumen, cache 7 hari, kuota harian |
| Akun `pengguna` kehilangan hak tulis | Keluhan pengguna lama | Umumkan sebelum rilis, sediakan pesan yang jelas, sediakan jalur permintaan |
| Superadmin terkunci | Tidak ada yang bisa mengelola platform | `SUPERADMIN_EMAILS` saat boot, larangan menurunkan superadmin terakhir |
| Data lama `tenant-pdam` | Permintaan baru bisa menunjuk tenant yang tidak ada | Validasi `tenantId` wajib ada di tabel `tenants` saat membuat permintaan |
| `menuSembunyi` per instansi | Menu baru tidak muncul | Menu baru tidak masuk daftar sembunyi bawaan |
| Uji lama menganggap `pengguna` boleh menulis | Tes gagal setelah Fase 0 | Perbarui tes yang memang menguji perilaku lama, catat di ringkasan fase |

---

## 11. Yang TIDAK diubah

- Remote git tetap `Salmanridhwan/ApexPulse`, branch `main`.
- Nama database `bumd_aionesboard`, kunci tema `apexpulse-theme`.
- Tema Midnight Indigo dan token warna.
- Fitur Kinerja & Kepatuhan (pelaporan, audit, keuangan, risiko, aset, PK, LKjIP) tidak disentuh, kecuali gerbang role-nya ikut matriks.
- Struktur `halaman[]` pada dashboard dan aturan proyeksi halaman aktif.
- Alur bagikan tautan yang sudah ada.

---

## 12. Default yang saya pakai (koreksi kalau salah)

Karena dua peran admin sudah ada, rilis pertama tidak menunggu keputusan soal akun. Yang tersisa saya putuskan dengan default paling sederhana, dan semuanya bisa diubah tanpa membongkar model data.

| Hal | Default | Alasan |
|---|---|---|
| Email Admin Aiones | **akun demo baru** `admin.aiones@aionesboard.id`, dibuat lewat seed, sandi acak dicetak sekali di log server, wajib ganti saat login pertama | keputusan pemilik 2026-11-06: buat baru untuk demo |
| Nasib 9 akun `admin` | tetap `admin` (Admin Instansi) | perilaku sekarang tidak berubah |
| User melihat hasil | read-only di portal user, tanpa tombol ubah | paling dekat dengan permintaan "user tidak membuat halaman" |
| Analisis AI | otomatis saat unggah, dengan kuota harian | sesuai kalimat "AI langsung grab datanya", kuota menjaga tagihan |
| Bidang per permintaan | **6 kategori yang sama** (Keuangan, Operasional, Pelayanan, SDM, Kinerja, Umum), bisa ditambah menyusul | keputusan pemilik 2026-11-06: disesuaikan lagi kalau ada tambahan |

### 12.1 Rincian akun demo Admin Aiones

- `id: 'user-superadmin'`, email `admin.aiones@aionesboard.id`, nama "Admin Aiones (Demo)", `role: 'superadmin'`.
- `tenantId` diisi instansi pertama sebagai tampilan awal, dan superadmin boleh berpindah instansi.
- Sandi tidak ditulis di repo dan tidak dikirim ke chat. Saat boot pertama, server membuat sandi acak 20 karakter, menyimpan hash scrypt-nya, dan mencetak sandi itu **satu kali** ke log server. `mustChangePassword: true` memaksa penggantian sandi saat login pertama, memakai komponen `GantiPasswordWajib` yang sudah ada.
- Kalau entri ini sudah ada, boot berikutnya tidak membuat ulang dan tidak mencetak apa pun.

Dengan begitu, tidak ada kredensial yang tersimpan di dokumen, di git, atau di percakapan.

---

## 13. Definisi selesai

- User bisa membuat permintaan, mengunggah dokumen, dan melihat status tanpa bisa menyentuh dashboard.
- Admin Instansi melihat permintaan, menjalankan analisis, melihat butir per kategori dengan sitasi, menyusun halaman, dan menandai selesai.
- Admin Aiones bisa mengelola instansi dan akun admin instansi, dan setiap perpindahan instansi tercatat.
- Semua angka di halaman hasil berasal dari butir dokumen, bukan dari LLM saat menyusun.
- `npm test` hijau, `tsc` bersih, build sukses, dan produksi memakai bundel baru.
- Vault diperbarui dengan alur baru dan laporan verifikasi.

---

## 14. Audit kebutuhan Admin Instansi (2026-11-06)

Pemeriksaan kalimat per kalimat terhadap kode dan plan. **Terpenuhi** berarti plan sudah menjawab dan bahannya ada di kode. **Sebagian** berarti alurnya ada tetapi ada syarat yang belum ditulis. **Belum** berarti plan sebelumnya tidak menjawab. **Ditambal** berarti sebelumnya belum atau kurang, dan sudah ditulis ke plan sekarang.

| No | Kebutuhan | Status awal | Sekarang | Letak |
|---|---|---|---|---|
| 1 | Admin menerima data dari user | Terpenuhi | Terpenuhi | 3.2.1, 6.1 |
| 2 | Admin tahu ada data masuk | Sebagian | Ditambal | 5.4, Fase 1 item 3 |
| 3 | AI langsung grab data | Sebagian | Sebagian, disengaja | 3.2.2, 7.2. Otomatis, tapi tunduk kuota dan baru ada di Fase 2 |
| 4 | AI menampilkan ada data apa saja | Terpenuhi | Terpenuhi | 3.2.2, 8.1 |
| 5 | Tampilan data apa saja untuk satu permintaan | Belum | Ditambal | 3.2.2 butir 6, panel Ringkasan Permintaan |
| 6 | Data dibagi ke kategori masing-masing | Terpenuhi | Terpenuhi | 3.2.3 |
| 7 | Bidang permintaan dan kategori data | Belum | Ditambal | 5.7, satu taksonomi 6 kategori |
| 8 | Rekomendasi AI di setiap template per kategori | Sebagian | Ditambal | 3.2.4, 7.3, 7.5 |
| 9 | Admin ambil data yang diinginkan dari semua data | Sebagian | Ditambal | 6.3, butir draf bisa disetujui di tempat |
| 10 | Menjadi 1 halaman | Sebagian | Ditambal | 6.3, batas 9 widget dan pemecahan halaman |
| 11 | Belum puas, minta chat AI menyempurnakan | Terpenuhi | Terpenuhi | 3.2.6, 8.2. `/api/chat` sudah menerima `dashboardId` |
| 12 | Admin bisa minta data tambahan atau menolak | Terpenuhi | Terpenuhi | 3.2.7, 6.1 |
| 13 | Dokumen tidak relevan | Belum | Ditambal | 3.2.3 butir 6 |
| 14 | Biaya dan kegagalan AI | Terpenuhi | Ditambal | 7.2, tambah status `tertunda-kuota` |

Ringkasnya: 7 kebutuhan sudah terpenuhi di plan sebelumnya, 6 ditambal sekarang, 1 tetap sebagian karena memang disengaja (analisis otomatis baru di Fase 2).

### 14.1 Tambalan yang sudah ditulis ke plan

| Kode | Tambalan | Letak |
|---|---|---|
| T1 | Notifikasi per pengguna: `untukUserId`, `untukRole`, `jenis`, `permintaanId`, dan aturan saring di `/api/notifications` | 5.4, Fase 1 |
| T2 | Panel Ringkasan Permintaan: jumlah butir per kategori dari semua dokumen dalam satu permintaan | 3.2.2 butir 6 |
| T3 | Satu taksonomi: bidang memakai 6 kategori yang sama, bidang khusus instansi menyusul | 5.7 |
| T4 | `butirKeSlotTemplate()`: mengisi slot template dari butir, slot kosong diberi label jujur | 7.5, Fase 3 |
| T5 | Butir berkeyakinan tinggi dengan sitasi otomatis `disetujui`, butir tanpa sitasi selalu `draf` | 5.3 |
| T6 | Batas 9 widget per halaman, lebih dari itu dipecah otomatis dan diberitahukan | 6.3 |
| T7 | Tanda "tidak relevan" pada dokumen tanpa menghapus berkas | 3.2.3 butir 6 |
| T8 | Status `tertunda-kuota` saat kuota habis, antrean jalan sendiri setelah reset | 7.2 |

Kedua keputusan yang tadinya menggantung sudah dijawab pemilik pada 2026-11-06:

1. Akun Admin Aiones: dibuat baru sebagai akun demo (12.1).
2. Bidang: memakai 6 kategori yang sama, bisa ditambah menyusul (5.7).

Plan tidak punya pertanyaan terbuka lagi. Langkah berikutnya Fase 0.
