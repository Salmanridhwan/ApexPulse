/**
 * KATALOG CHART DEFAULT.
 *
 * Berisi identitas chart yang boleh dipakai dashboard, beserta bentuk data yang
 * diterima. Bentuk gambarnya TIDAK di sini, melainkan di `chartTemplate.ts`
 * (matriks chart x varian). File ini yang dipanggil renderer:
 *
 *   const { opsi, varian, cadangan } = buildOpsi('bar-tegak-sorot', data, 'ringkasan', skala);
 *
 * Aturan yang dijaga:
 * - Chart yang sama wajib bisa tampil di semua varian yang terdaftar.
 * - Varian yang belum ada tidak boleh membuat layar kosong. Renderer memakai
 *   varian default dan mengembalikan `cadangan: true` supaya UI bisa menandai.
 */

import type { WidgetType } from '../../types';
import type { DataChart, Pembangun, SpesifikasiHtml } from './pembangunOpsi';
import { MATRIKS, MATRIKS_KHAS } from './chartTemplate';
import { GAYA, VARIAN, type GayaVarian, type Varian } from './gayaVarian';

export type ChartId =
  | 'kpi-kartu'
  | 'kpi-strip'
  | 'progres-target'
  | 'tabel-ringkas'
  | 'narasi-insight'
  | 'peringkat'
  | 'bar-tegak'
  | 'bar-tegak-sorot'
  | 'bar-tegak-target'
  | 'bar-mendatar-peringkat'
  | 'bar-mendatar-target'
  | 'bar-tumpuk'
  | 'area-gradasi'
  | 'garis-tren'
  | 'combo-batang-garis'
  | 'scatter-gelembung'
  | 'titik-bersumbu'
  | 'donat-tebal'
  | 'donat-tipis'
  | 'gauge-target'
  | 'strip-os'
  | 'bar-kapsul'
  | 'area-banding'
  | 'cincin-progres'
  | 'air-terjun'
  | 'sankey-alur'
  | 'radar-aspek'
  | 'gauge-kesehatan'
  | 'peta-panas'
  | 'treemap-porsi'
  | 'kpi-target'
  | 'papan-isu'
  | 'tabel-status'
  | 'alur-tahap'
  | 'corong-pipeline'
  | 'daftar-progres'
  | 'peta-wilayah'
  | 'jadwal-gantt'
  | 'kotak-sebaran';

export interface EntriChart {
  id: ChartId;
  /** Nama yang dibaca pengguna di katalog. */
  nama: string;
  /** Tipe widget di model data, dipakai saat widget dibuat. */
  tipe: WidgetType;
  /** `echarts` = kanvas grafik, `html` = kartu/tabel/teks. */
  mesin: 'echarts' | 'html';
  /** Bentuk data yang wajib tersedia supaya chart ini bisa digambar. */
  butuh: string;
  /** Kegunaan dalam bahasa awam, ditampilkan di katalog. */
  guna: string;
  /** Kelompok tampilan katalog. */
  kelompok: KelompokChart;
}

export type KelompokChart = 'ringkas' | 'banding' | 'tren' | 'komposisi' | 'sebaran' | 'rapat';

export const LABEL_KELOMPOK: Record<KelompokChart, string> = {
  ringkas: 'Angka ringkas, tabel, dan teks',
  banding: 'Perbandingan',
  tren: 'Perkembangan dari waktu ke waktu',
  komposisi: 'Porsi dan capaian',
  sebaran: 'Sebaran dan hubungan',
  rapat: 'Rapat manajemen: target, isu, alur, dan tindak lanjut',
};

export const CHART_DEFAULT: Record<ChartId, EntriChart> = {
  'kpi-kartu': { id: 'kpi-kartu', nama: 'Kartu KPI berikon', tipe: 'kpi', mesin: 'html', butuh: 'satu angka, delta, satuan', guna: 'Satu angka penting beserta naik-turunnya', kelompok: 'ringkas' },
  'kpi-strip': { id: 'kpi-strip', nama: 'Strip KPI ringkas', tipe: 'kpi', mesin: 'html', butuh: 'satu angka dan satuan', guna: 'Beberapa angka penting berjajar dalam satu baris', kelompok: 'ringkas' },
  'progres-target': { id: 'progres-target', nama: 'Progres target', tipe: 'bullet-target', mesin: 'html', butuh: 'label, capaian, target', guna: 'Seberapa dekat capaian dengan target', kelompok: 'ringkas' },
  'tabel-ringkas': { id: 'tabel-ringkas', nama: 'Tabel ringkas', tipe: 'table', mesin: 'html', butuh: 'kolom dan baris angka', guna: 'Angka lengkap per baris untuk dibaca teliti', kelompok: 'ringkas' },
  'narasi-insight': { id: 'narasi-insight', nama: 'Strip narasi', tipe: 'narasi', mesin: 'html', butuh: 'satu paragraf', guna: 'Kesimpulan singkat dalam kalimat', kelompok: 'ringkas' },
  peringkat: { id: 'peringkat', nama: 'Daftar peringkat', tipe: 'hbar', mesin: 'html', butuh: 'label dan nilai', guna: 'Urutan teratas tanpa grafik', kelompok: 'ringkas' },
  'bar-tegak': { id: 'bar-tegak', nama: 'Batang tegak polos', tipe: 'bar', mesin: 'echarts', butuh: 'kategori dan satu seri', guna: 'Membandingkan nilai antar periode atau kategori', kelompok: 'banding' },
  'bar-tegak-sorot': { id: 'bar-tegak-sorot', nama: 'Batang tegak bersorot', tipe: 'bar', mesin: 'echarts', butuh: 'kategori dan satu seri', guna: 'Membandingkan nilai dan menyorot yang tertinggi', kelompok: 'banding' },
  'bar-tegak-target': { id: 'bar-tegak-target', nama: 'Batang tegak dengan target', tipe: 'bar', mesin: 'echarts', butuh: 'kategori, satu seri, target', guna: 'Membandingkan nilai dengan garis target', kelompok: 'banding' },
  'bar-mendatar-peringkat': { id: 'bar-mendatar-peringkat', nama: 'Batang mendatar peringkat', tipe: 'hbar', mesin: 'echarts', butuh: 'label dan nilai', guna: 'Peringkat kategori dengan nama panjang', kelompok: 'banding' },
  'bar-mendatar-target': { id: 'bar-mendatar-target', nama: 'Batang mendatar target', tipe: 'hbar', mesin: 'echarts', butuh: 'label, capaian, target', guna: 'Capaian tiap indikator terhadap targetnya', kelompok: 'banding' },
  'bar-tumpuk': { id: 'bar-tumpuk', nama: 'Batang bertumpuk', tipe: 'combo', mesin: 'echarts', butuh: 'kategori dan dua seri', guna: 'Dua ukuran dalam satu batang per kategori', kelompok: 'banding' },
  'area-gradasi': { id: 'area-gradasi', nama: 'Area bergradasi', tipe: 'area', mesin: 'echarts', butuh: 'kategori dan satu seri', guna: 'Perkembangan dari waktu ke waktu beserta volumenya', kelompok: 'tren' },
  'garis-tren': { id: 'garis-tren', nama: 'Garis tren', tipe: 'line', mesin: 'echarts', butuh: 'kategori dan satu seri', guna: 'Arah naik-turun dari waktu ke waktu', kelompok: 'tren' },
  'combo-batang-garis': { id: 'combo-batang-garis', nama: 'Batang dan garis dua sumbu', tipe: 'combo', mesin: 'echarts', butuh: 'kategori, seri batang, seri garis', guna: 'Dua ukuran berbeda satuan dalam satu grafik', kelompok: 'tren' },
  'scatter-gelembung': { id: 'scatter-gelembung', nama: 'Gelembung sebaran', tipe: 'bubble', mesin: 'echarts', butuh: 'label, dua angka, ukuran', guna: 'Hubungan dua ukuran, besar gelembung = ukuran ketiga', kelompok: 'sebaran' },
  'titik-bersumbu': { id: 'titik-bersumbu', nama: 'Titik bersumbu', tipe: 'scatter', mesin: 'echarts', butuh: 'label dan nilai', guna: 'Sebaran nilai per kategori', kelompok: 'sebaran' },
  'donat-tebal': { id: 'donat-tebal', nama: 'Cincin tebal', tipe: 'donut', mesin: 'echarts', butuh: 'kategori dan nilai', guna: 'Porsi tiap bagian dari keseluruhan', kelompok: 'komposisi' },
  'donat-tipis': { id: 'donat-tipis', nama: 'Cincin tipis', tipe: 'donut', mesin: 'echarts', butuh: 'kategori dan nilai', guna: 'Porsi tiap bagian, tampilan ringan', kelompok: 'komposisi' },
  'gauge-target': { id: 'gauge-target', nama: 'Gauge target', tipe: 'gauge', mesin: 'echarts', butuh: 'satu angka, target, batas', guna: 'Persentase capaian pada satu skala', kelompok: 'komposisi' },
  'strip-os': { id: 'strip-os', nama: 'Daftar persen bertren', tipe: 'kpi', mesin: 'html', butuh: 'label, persen, delta, deret kecil', guna: 'Porsi tiap kelompok beserta trennya', kelompok: 'ringkas' },
  'bar-kapsul': { id: 'bar-kapsul', nama: 'Batang kapsul', tipe: 'bar', mesin: 'echarts', butuh: 'kategori dan satu atau dua seri', guna: 'Membandingkan nilai per periode, puncaknya disorot', kelompok: 'banding' },
  'area-banding': { id: 'area-banding', nama: 'Dua garis dibandingkan', tipe: 'line', mesin: 'echarts', butuh: 'kategori dan dua seri', guna: 'Membandingkan dua ukuran dari waktu ke waktu, mis. pendapatan vs beban', kelompok: 'tren' },
  'cincin-progres': { id: 'cincin-progres', nama: 'Cincin capaian', tipe: 'gauge', mesin: 'echarts', butuh: 'satu persen capaian', guna: 'Persen capaian satu target dalam cincin penuh', kelompok: 'komposisi' },
  // Khas BUMD: neraca air (IWA) dan penilaian kinerja (aspek keuangan, pelayanan, operasional, SDM).
  'air-terjun': { id: 'air-terjun', nama: 'Air terjun neraca', tipe: 'waterfall', mesin: 'echarts', butuh: 'total awal, pengurang/penambah, total akhir', guna: 'Dari air diproduksi sampai air terjual: ke mana selisihnya hilang', kelompok: 'banding' },
  'sankey-alur': { id: 'sankey-alur', nama: 'Alur sankey', tipe: 'sankey', mesin: 'echarts', butuh: 'pasangan asal>tujuan dan nilai', guna: 'Aliran dari sumber ke pemakaian, mis. air produksi ke tiap golongan', kelompok: 'komposisi' },
  'radar-aspek': { id: 'radar-aspek', nama: 'Radar aspek kinerja', tipe: 'radar', mesin: 'echarts', butuh: 'aspek dan skor, boleh dua tahun', guna: 'Skor tiap aspek penilaian kinerja dibanding tahun lalu', kelompok: 'sebaran' },
  'gauge-kesehatan': { id: 'gauge-kesehatan', nama: 'Gauge kesehatan BUMD', tipe: 'gauge', mesin: 'echarts', butuh: 'satu skor 0-5', guna: 'Skor kinerja dengan pita Sakit, Kurang Sehat, Sehat', kelompok: 'komposisi' },
  'peta-panas': { id: 'peta-panas', nama: 'Peta panas', tipe: 'heatmap', mesin: 'echarts', butuh: 'baris (mis. wilayah), kolom (mis. bulan), nilai', guna: 'Di mana dan kapan angka menumpuk, mis. pengaduan per wilayah', kelompok: 'sebaran' },
  // Khas rapat manajemen bagian (deck Executive Summary, Permasalahan & Risiko, Action Plan, Pipeline, KPI 2027).
  'kpi-target': { id: 'kpi-target', nama: 'Kartu sasaran KPI', tipe: 'kpi', mesin: 'html', butuh: 'satu angka dan sasarannya (≥ atau ≤)', guna: 'Sasaran tahun depan beserta capaian saat ini', kelompok: 'rapat' },
  'papan-isu': { id: 'papan-isu', nama: 'Papan isu tiga status', tipe: 'table', mesin: 'html', butuh: 'tabel isu dengan kolom status', guna: 'Isu dikelompokkan Critical, Perlu Perhatian, dan Terkendali', kelompok: 'rapat' },
  'tabel-status': { id: 'tabel-status', nama: 'Tabel tindak lanjut berstatus', tipe: 'table', mesin: 'html', butuh: 'tabel dengan kolom status di ujung', guna: 'Action plan: aksi, PIC, tenggat, dan pil status berwarna', kelompok: 'rapat' },
  'alur-tahap': { id: 'alur-tahap', nama: 'Alur tahapan proses', tipe: 'funnel', mesin: 'html', butuh: 'urutan tahap dan jumlah per tahap', guna: 'Pipeline dari permintaan sampai pembayaran, jumlah di tiap tahap', kelompok: 'rapat' },
  'corong-pipeline': { id: 'corong-pipeline', nama: 'Corong pipeline', tipe: 'funnel', mesin: 'html', butuh: 'tahap dan jumlah yang makin mengecil', guna: 'Prospek baru sampai closing: berapa yang tersisa di tiap tahap', kelompok: 'rapat' },
  'daftar-progres': { id: 'daftar-progres', nama: 'Daftar progres persen', tipe: 'hbar', mesin: 'html', butuh: 'label dan persen', guna: 'Skor atau capaian banyak aspek, mis. kebersihan dan kualitas layanan', kelompok: 'rapat' },
  'treemap-porsi': { id: 'treemap-porsi', nama: 'Petak porsi (treemap)', tipe: 'treemap', mesin: 'echarts', butuh: 'kategori dan nilai', guna: 'Porsi banyak kategori sekaligus, mis. pendapatan per golongan', kelompok: 'komposisi' },
  // Tiga wajah yang sebelumnya tidak ada di katalog (widget bertipe peta, gantt,
  // dan boxplot dulu dibuatkan entri sementara). Sekarang punya wajah sendiri.
  'peta-wilayah': { id: 'peta-wilayah', nama: 'Peta wilayah', tipe: 'map', mesin: 'echarts', butuh: 'nama wilayah/provinsi dan nilainya', guna: 'Sebaran angka per wilayah di peta Indonesia, mis. pelanggan atau kehilangan air', kelompok: 'sebaran' },
  'jadwal-gantt': { id: 'jadwal-gantt', nama: 'Jadwal kegiatan (gantt)', tipe: 'gantt', mesin: 'echarts', butuh: 'nama kegiatan, tanggal mulai dan selesai, progres', guna: 'Jadwal proyek atau program berjalan beserta progres tiap kegiatan', kelompok: 'rapat' },
  'kotak-sebaran': { id: 'kotak-sebaran', nama: 'Kotak sebaran (boxplot)', tipe: 'boxplot', mesin: 'echarts', butuh: 'nilai minimum, kuartil 1, median, kuartil 3, maksimum', guna: 'Sebaran nilai per unit: mana yang menyimpang dan seberapa lebar sebarannya', kelompok: 'sebaran' },
};

export const DAFTAR_CHART: ChartId[] = Object.keys(CHART_DEFAULT) as ChartId[];

export const entriChart = (id: ChartId): EntriChart => CHART_DEFAULT[id];

/** Varian yang sudah punya desain untuk chart ini. */
export const varianTersedia = (id: ChartId): Varian[] =>
  VARIAN.filter((v) => Boolean(MATRIKS[id]?.[v]));

export interface HasilOpsi {
  /** Opsi ECharts, atau spesifikasi HTML untuk chart non-kanvas. */
  opsi: Record<string, unknown> | SpesifikasiHtml | null;
  /** Varian yang benar-benar dipakai. */
  varian: Varian;
  /** true bila varian yang diminta belum ada dan dipakai varian lain. */
  cadangan: boolean;
  /** Gaya yang dipakai, supaya renderer bisa mewarnai bingkai kartu. */
  gaya: GayaVarian;
}

/**
 * Susun opsi grafik untuk satu chart.
 *
 * @param id      identitas chart
 * @param data    data dengan bentuk yang sama untuk semua varian
 * @param varian  wajah yang diminta
 * @param skala   skala huruf (1 = ukuran dasar)
 * @param khas    true = pakai wajah khas replika halaman 1 Lensa/Nadi bila ada
 * @param gantiGaya gaya pengganti (mis. tema terang kanvas dashboard). Bila
 *                  kosong, dipakai gaya bawaan varian. Bentuk grafiknya tetap
 *                  milik wajah katalog; hanya warnanya yang mengikuti tema.
 */
export function buildOpsi(
  id: ChartId,
  data: DataChart,
  varian: Varian,
  skala = 1,
  gantiGaya?: typeof GAYA[Varian],
  khas = false,
): HasilOpsi {
  const sel: Partial<Record<Varian, Pembangun>> | undefined = khas
    ? { ...MATRIKS[id], ...MATRIKS_KHAS[id] }
    : MATRIKS[id];
  if (!sel) {
    return { opsi: null, varian, cadangan: true, gaya: GAYA[varian] ?? GAYA.default };
  }

  const urutan: Varian[] = [varian, 'default', ...VARIAN];
  const dipakai = urutan.find((v) => sel[v]);
  if (!dipakai) {
    return { opsi: null, varian, cadangan: true, gaya: GAYA[varian] ?? GAYA.default };
  }

  const pembangun: Pembangun = sel[dipakai] as Pembangun;
  const gaya = gantiGaya ?? GAYA[dipakai];
  return {
    opsi: pembangun(data, gaya, skala),
    varian: dipakai,
    cadangan: dipakai !== varian,
    gaya,
  };
}
