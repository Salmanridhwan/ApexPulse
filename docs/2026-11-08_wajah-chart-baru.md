# Tiga wajah chart baru di Template Chart (peta, gantt, boxplot)

Tanggal: 2026-11-08

## Masalah

Aturan proyek: **chart selalu diambil dari Template Chart**, dan kalau tidak ada
yang cocok, chart barunya dibuat dulu di Template Chart lalu dipakai.

Saat memeriksa 28 tipe widget terhadap katalog, ada 3 tipe yang benar-benar tidak
punya padanan:

| Tipe widget | Wajah di katalog |
|---|---|
| `map` | tidak ada |
| `gantt` | tidak ada |
| `boxplot` | tidak ada |

Enam tipe lain (`heatmap`, `radar`, `waterfall`, `sankey`, `treemap`, `funnel`)
sebenarnya sudah punya wajah, hanya belum dipetakan — itu diperbaiki terpisah
(`petaTipe.ts`).

Akibatnya widget bertipe itu selalu jatuh ke entri sementara `kustom-…` yang
menunjuk chart lain (mis. peta digambar sebagai batang), jadi tampilannya tidak
jujur.

## Yang dibuat

Tiga wajah baru, masing-masing otomatis tersedia di 12 gaya template
(Default, Pijar, Lensa, Nadi, Kaca, Tirta, Aurora, Neon, Blok, Bento, Koran,
Korporat):

| `ChartId` | Tipe | Bentuk |
|---|---|---|
| `peta-wilayah` | `map` | Peta Indonesia (GeoJSON provinsi), warna `kartu2 → aksen`, legenda gradien mendatar dengan angka min/maks, tooltip nama wilayah + nilai |
| `jadwal-gantt` | `gantt` | Batang waktu per kegiatan; seri **Rencana** (samar) + **Progres** (pekat, berlabel persen) |
| `kotak-sebaran` | `boxplot` | Kotak Q1–Q3, garis median, ekor min–maks, tooltip lima angka |

Desain tidak memakai warna baru: semua warna, sudut, garis, dan tipografi diambil
dari `GayaVarian` (`g.aksen`, `g.aksen2`, `g.kartu2`, `g.garis`, `g.sudut`,
`g.teks3`) lewat pembantu bersama `tooltip`, `sumbuKategori`, `labelNilai`,
`format`. Jadi tiap gaya tetap terlihat seperti templatenya, bukan chart asing
yang ditempel.

## Berkas

- `src/services/chart/pembangunTambahan.ts` (baru) — tiga pembangun murni.
- `src/components/widgets/petaTerdaftar.ts` (baru) — mendaftarkan
  `/geo/indonesia.geojson` ke ECharts sekali saja (di-cache, diulang kalau gagal).
- `src/services/chart/chartDefault.ts` — 3 entri `DAFTAR_CHART` (39 total).
- `src/services/chart/chartTemplate.ts` — `MATRIKS_OPSI` untuk ketiga wajah.
- `src/services/chart/petaTipe.ts` — `map/gantt/boxplot` kini punya wajah.
- `src/services/chart/contohData.ts` — data contoh (nama provinsi mengikuti
  GeoJSON).
- `src/services/chart/pembangunOpsi.ts` — `DataChart.peta/jadwal/kotak`,
  ekspor `tooltip` & `sumbuKategori`.
- `src/components/widgets/WidgetRenderer.tsx` — menyusun `peta` dari
  `widget.geo.regions`, `jadwal` dari `widget.gantt.tasks`, `kotak` dari
  `chart.boxRaw` (`statistikBox`).
- `src/components/widgets/ChartEcharts.tsx` — memakai modul peta bersama.

## Dua bug yang ditemukan saat verifikasi layar

1. **Kartu peta kosong + `TypeError: Cannot read properties of undefined
   (reading 'regions')`.** `petaTerdaftar.ts` memakai
   `const { echarts } = await loadEcharts()`, padahal modul mengekspor namespace
   ECharts secara langsung. Peta tidak pernah terdaftar, lalu ECharts gagal
   menggambar seri `map`. Perbaikan: pilih objek yang benar-benar punya
   `registerMap`, dan logika peta dipindah dari `ChartEcharts` ke modul bersama
   supaya chart katalog juga bisa memakainya.
2. **Legenda Gantt hijau padahal batangnya biru.** Seri `custom` tidak punya
   `itemStyle`, jadi legenda memakai palet bawaan. Perbaikan: tiap seri diberi
   `itemStyle.color` yang sama dengan batangnya.

Selain itu legenda peta awalnya tergambar **vertikal menimpa peta** karena
ECharts memakai `itemHeight` sebagai panjang batang saat `orient: 'horizontal'`;
sekarang `itemWidth: 8`, `itemHeight: 88`, posisi `bottom`.

## Bukti

- `scripts/probe-chart-wajah-baru.mjs` → **11/11 LULUS** (`C:/tmp/probe-wajah5`):
  chart bawaan tidak berubah, heatmap tetap `peta-panas`, peta/gantt/boxplot
  memakai wajah barunya, tipe tanpa wajah tetap dibuatkan entri Template Chart
  tanpa duplikat, halaman Template Chart menggambar ketiga kartu, kanvas
  dashboard 6 kartu · 0 kosong · 0 galat konsol.
- Tangkapan layar kartu (`C:/tmp/cek3`): peta Indonesia + legenda mendatar
  (42.100 → 502.110), Gantt dengan legenda Rencana/Progres sewarna dan label
  100/80/45/20/0 %, boxplot dengan kotak + median + ekor.
- `tests/chartTambahan.test.ts` + `tests/katalogKustom.test.ts` → 15/15.
- Suite peran → **64/64 langkah OK**, 0 temuan, tanpa galat konsol/4xx-5xx
  (`scratch/peran-artifacts8`).
- `tsc --noEmit`, `npm run lint`, `npm run build` bersih.
