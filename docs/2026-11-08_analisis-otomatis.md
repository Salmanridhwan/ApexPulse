# Analisis Dokumen Otomatis + Cache yang Ikut Ter-update

**Tanggal:** 2026-11-08
**Lingkup:** dokumen yang masuk ke instansi dibaca sendiri, hasilnya disimpan, dan cache-nya diperbarui saat ada dokumen baru.

---

## 1. Masalah yang diselesaikan

Sebelum ini, unggahan hanya menyimpan berkas. Tidak ada yang membaca isinya sampai
seorang admin membuka satu permintaan lalu menekan **"Analisis isi dokumen"** —
satu klik per berkas, per permintaan. Akibatnya:

- Katalog Data tetap kosong padahal dokumennya sudah ada di repositori;
- admin yang tidak tahu tombolnya akan menyimpulkan "dokumen ini tidak berisi data";
- dokumen yang diunggah lewat Repositori (bukan lewat permintaan) tidak pernah dibaca
  sama sekali, karena panel analisis hanya ada di halaman permintaan.

## 2. Perilaku sekarang

| Kejadian | Yang terjadi otomatis |
|---|---|
| Pengguna mengunggah berkas (`POST /api/berkas/unggah`) | Berkas masuk antrean analisis; hasilnya tersimpan tanpa satu klik |
| Impor data ke kanvas (berkas ikut disimpan ke repositori) | Berkas yang sama ikut dianalisis |
| Berkas dilampirkan ke permintaan (baru / ubah / catatan) | Hasil yang sudah ada ditautkan ke permintaan itu; kalau belum pernah dibaca, diantrekan |
| Dokumen baru masuk ke basis instansi | Analisis lama yang jadi basi ikut dibaca ulang (dibatasi, lihat §4) |
| Foto (`tipeRepositori: 'photo'`) | **Tidak** dianalisis — tidak ada angka untuk dibaca |

Panel **Isi Dokumen** menampilkan kartu *"Dokumen dibaca otomatis. Hasilnya muncul di
sini tanpa perlu diklik."* selama hasilnya belum ada, lalu menyegarkan diri setiap 5
detik (maksimal 24 kali) sampai hasilnya muncul. Tautan kecil **"Baca sekarang"**
tetap ada untuk mendahului antrean.

## 3. Antrean

`src/services/analisis/otomatis.ts`

- **Sekali per berkas.** Kunci `tenantId|berkasId` mencegah dokumen yang sama
  diantrekan dua kali (unggah + lampiran + permintaan lain yang menautkannya).
- **Maksimal 2 berjalan bersamaan.** Layanan RAG membalas 429 bila dipanggil
  beruntun, dan 429 membakar kuota tanpa menghasilkan butir.
- **Antrean dibatasi 200.** Kelebihan ditolak dan dihitung `dilewati` — ditolak
  dengan jujur lebih baik daripada menumpuk pekerjaan yang tak akan pernah jalan.
- **Kuota dihormati.** Habis kuota = status `tertunda-kuota`, bukan gagal.
- Keadaan antrean ada di memori proses. Setelah server hidup ulang, hasil yang sudah
  selesai tetap tersimpan dan tidak dibaca ulang (cache-nya sah); dokumen yang belum
  pernah dibaca akan diantrekan lagi saat berkasnya masuk.

Keadaan antrean bisa diperiksa admin lewat `GET /api/analisis/otomatis`:
`menunggu`, `berjalan`, `selesai`, `gagal`, `dilewati`, `terakhir`.

## 4. Cache

Cache memakai tiga tingkat pemeriksaan yang sudah ada (`putusanCache`): sidik
dokumen, sidik basis instansi, dan pagar umur 30 hari. Tiga perbaikan ditambahkan
karena alur otomatis memunculkan celah yang sebelumnya tidak terasa:

1. **`sidikCocok()` — sidik dibandingkan per bagian, bukan sebagai string utuh.**
   Analisis otomatis berjalan beberapa detik setelah unggah, ketika lampirannya belum
   menempel sehingga ukuran/tipe/waktu belum diketahui. Perbandingan string membuat
   dokumen yang sama dianggap "berubah" dan dibaca ulang. Sekarang bagian yang kosong
   di salah satu sisi diabaikan; bagian yang ada di kedua sisi tetap harus sama, jadi
   berkas yang benar-benar diganti tetap memaksa analisis ulang.
2. **Lampiran dicari di seluruh permintaan instansi**, bukan hanya permintaan yang
   sedang dibuka — supaya sidik dihitung dari sumber yang sama di kedua jalur.
3. **`perluSegarTerbaru()` — satu baris per berkas.** Tanpa ini, baris lama yang sudah
   digantikan membuat dokumen yang sama "basi selamanya", sehingga setiap unggahan
   berikutnya membaca ulang dokumen yang sama.

Selain itu, analisis yang selesai **sebelum** lampirannya menempel tetap ditautkan ke
permintaan saat pekerjaannya berakhir, dan `GET /api/analisis?permintaanId=` juga
menampilkan analisis yang berkasnya termasuk lampiran permintaan itu — jadi panel tidak
pernah menampilkan "belum dianalisis" untuk dokumen yang sebenarnya sudah dibaca.

Panel menampilkan **hanya hasil terbaru per dokumen**, bukan seluruh riwayat.

## 5. Kuota

Kuota harian bawaan tetap 20 analisis per instansi. Satu unggahan bisa memicu lebih
dari satu analisis (dokumen baru + penyegaran analisis lama), jadi penyegaran dibatasi:

| Variabel | Bawaan | Arti |
|---|---|---|
| `AUTO_SEGARKAN_MAKS` | `2` | Berapa analisis lama yang boleh dibaca ulang per kejadian dokumen baru. `0` = matikan penyegaran otomatis (dokumen baru tetap dibaca). |

Sisa kuota terlihat di panel (`Sisa kuota hari ini: 19/20`) dan di `GET /api/analisis/kuota`.

## 6. Bukti

| Uji | Hasil | Artefak |
|---|---|---|
| Uji unit antrean (`tests/analisisOtomatis.test.ts`) | **6/6 lulus** | dedupe, puncak paralel ≤ 2, antrean penuh ditolak, kegagalan tidak menghentikan yang lain, masukan tak lengkap ditolak, tanpa ketergantungan tidak jalan diam-diam |
| Uji cache (`tests/cacheAnalisis.test.ts` + baru) | **20/20 lulus** | `sidikCocok`, `putusanCache`, `perluSegarKarenaKb` |
| Probe alur nyata (`scripts/probe-analisis-otomatis.mjs`) | **10/10 lulus** | `peran-artifacts`… lihat di bawah |
| Suite peran (`scripts/e2e-peran.mjs`) | **64/64 lulus, 0 temuan, 0 galat konsol** | `peran-artifacts5` |

Probe menjalankan server sendiri (port 3246, direktori data sementara) dengan **stub
RAG** yang menjawab kontrak `/query` + `structuredJson {kpi, grafik}`. Yang diukur:

1. Pengguna mengunggah dokumen lewat kontrol berkas di layar.
2. Dokumen dibaca **tanpa satu pun klik "Analisis"** — baris analisis muncul dengan
   status `selesai`, 3 butir, dan RAG dipanggil 1× (`/query`) sejak sebelum unggah.
3. Admin membuka permintaan dan **langsung melihat 3 butir** berangka + sitasi
   (`03-admin-butir-otomatis.png`).
4. Permintaan analisis berikutnya **tidak memanggil RAG**: `dariCache: true`,
   panggilan RAG tetap 254 → 254.
5. Dokumen kedua diunggah → langsung dibaca juga.
6. Dokumen pertama **otomatis dibaca ulang** karena basis instansi berubah
   (baris baru, `perluDibacaUlang` = 0 setelahnya).
7. Dalam 9 detik diam tidak ada pembacaan ulang berulang (baris 3 → 3, `/query` 3 → 3).

Artefak PNG: `%LOCALAPPDATA%/hermes/cache/scratch/probe-auto3/`
(`02-user-dokumen-terunggah.png`, `03-admin-butir-otomatis.png`,
`04-admin-setelah-dokumen-baru.png`, `05-admin-dua-dokumen.png`, `hasil.json`).

## 7. Batas yang masih ada

- **RAG nyata masih wajib.** Selama `ragProvider` = `mock`, server menolak analisis
  ("bukan dokumen instansi"). Setel `RAG_PROVIDER=http`, `RAG_API_URL`, `RAG_API_KEY`
  (atau lewat panel Admin → Konfigurasi RAG). Ini disengaja: angka contoh tidak boleh
  tampil sebagai data instansi.
- **Instansi harus sudah dipetakan ke project KMS** (`organizationId`). Tanpa itu
  tidak ada dokumen untuk dibaca.
- **Biaya.** Satu analisis memanggil `/extract` beberapa kali (ekstraksi per area)
  sebelum jatuh ke `/query`. Pada provider nyata ini memakan waktu & token; kuota
  harian tetap penjaganya.
- **Antrean tidak bertahan setelah restart** (keadaan di memori). Hasil yang sudah
  selesai tetap tersimpan.
