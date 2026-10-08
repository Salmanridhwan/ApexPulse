import { BumdSector, WidgetSpec, WidgetType } from '../../types';

/**
 * TEMPLATE DASHBOARD — dashboard siap pakai per sektor BUMD.
 *
 * Tiap template disusun seperti KANVAS PENUH: 4 kartu KPI + 11 grafik beragam
 * tipe + tabel rekap + narasi eksekutif (16-17 widget). Tujuannya supaya
 * pengguna melihat contoh dashboard yang lengkap, bukan sekadar kerangka.
 *
 * PENTING soal angka: seluruh angka di sini adalah DATA DUMMY (contoh), bukan
 * hasil pembacaan dokumen. Karena itu `confidence` sengaja diisi `'inferensi AI'`
 * dan `citations` dikosongkan — supaya tidak ada dokumen yang diklaim sebagai
 * sumber dan pengguna tahu angka ini hanya untuk memperlihatkan susunan dashboard.
 *
 * Ketika pengguna memakai template, dashboard baru dibuat dengan angka contoh ini
 * (widget tetap bisa diedit/dihapus). Untuk mengisi angka sungguhan, pengguna
 * memakai katalog preset atau chat RAG seperti biasa.
 */

export interface DashboardTemplate {
  id: string;
  nama: string;
  sektor: BumdSector;
  /** Kalimat singkat: dashboard ini untuk apa. */
  deskripsi: string;
  /** Cakupan/indikator utama yang ditonjolkan. */
  fokus: string[];
  /** Warna aksen kartu (hex) — dipakai di UI galeri. */
  aksen: string;
  /** Judul dashboard yang dibuat saat template dipakai. */
  judulDashboard: string;
  deskripsiDashboard: string;
  widgets: WidgetSpec[];
}

/** Label bulan netral untuk deret contoh. */
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const TW = ['TW1', 'TW2', 'TW3', 'TW4'];
const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

let urutan = 0;
/** Pembuat widget ringkas; id unik & citation kosong (angka contoh, bukan dokumen). */
const w = (
  type: WidgetType,
  title: string,
  subtitle: string,
  grid: { w: number; h: number },
  extra: Partial<WidgetSpec> = {}
): WidgetSpec => {
  urutan += 1;
  return {
    id: `tpl-${type}-${urutan}`,
    type,
    title,
    subtitle,
    category: 'Operasional',
    confidence: 'inferensi AI',
    grid: { x: 0, y: 0, ...grid },
    citations: [],
    lastUpdated: new Date().toISOString(),
    ...extra,
  };
};

const kpi = (
  title: string,
  subtitle: string,
  value: number | string,
  unit: string,
  delta: number,
  deltaLabel: string,
  sparkline: number[],
  target?: number,
  targetLabel?: string
): WidgetSpec =>
  w('kpi', title, subtitle, { w: 3, h: 3 }, {
    kpi: { value, unit, delta, deltaLabel, sparkline, sparklineAsal: 'turunan-nilai', target, targetLabel },
  });

/** Grafik kartesius satu seri sederhana (bulanan). */
const seri1 = (nama: string, data: number[], unit: string, extra: Record<string, unknown> = {}) => ({
  chart: { xAxis: BULAN, series: [{ name: nama, data }], unit, showLegend: false, ...extra },
});

// ============================================================================
// 1. PDAM — Air Minum Daerah
// ============================================================================
const TEMPLATE_PDAM: DashboardTemplate = {
  id: 'tpl-pdam',
  nama: 'Kinerja PDAM / Air Minum',
  sektor: 'pdam',
  deskripsi:
    'Kanvas lengkap kinerja air minum: pendapatan, kehilangan air (NRW), produksi, distribusi, dan pelayanan pelanggan.',
  fokus: ['Pendapatan air & penagihan', 'Kehilangan air (NRW)', 'Produksi & distribusi', 'Pelanggan'],
  aksen: '#1fa6cc',
  judulDashboard: 'Dashboard Kinerja PDAM (Contoh)',
  deskripsiDashboard:
    'Template sektor air minum lengkap (18 widget, 12 grafik): pendapatan, NRW, produksi, distribusi, dan pelayanan. Angka bersifat contoh dan dapat diganti dengan data resmi.',
  widgets: [
    kpi('Realisasi Pendapatan Air', 'Capaian vs RKAP periode berjalan', '42,9', 'Miliar Rp', 7.1, '+7,1% vs target', [36, 37.5, 39, 40.2, 41.1, 42.9], 40, 'Target RKAP'),
    kpi('Tingkat Kehilangan Air (NRW)', 'Semakin rendah semakin baik', 22.4, '%', -3.7, '-3,7% dari Desember', [26.1, 25.4, 24.8, 23.9, 23.1, 22.4], 20, 'Batas ambang'),
    kpi('Efisiensi Penagihan', 'Collection efficiency rekening air', 94.8, '%', 2.1, '+2,1% YoY', [91.2, 92, 92.8, 93.5, 94.1, 94.8], 92, 'Target'),
    kpi('Sambungan Langganan Aktif', 'Total pelanggan terlayani', '148.650', 'SL', 2.2, '+3.200 SL baru', [140200, 142100, 143900, 145800, 147200, 148650]),

    // ── Grafik 1-11 ──────────────────────────────────────────────────────────
    w('line', 'Tren Pendapatan Air Bulanan', 'Realisasi vs target sepanjang tahun', { w: 8, h: 4 }, {
      chart: {
        xAxis: BULAN,
        series: [
          { name: 'Realisasi', data: [36, 37.5, 39, 40.2, 41.1, 42.9, 44.2, 45.1, 46, 47.2, 48, 49.5] },
          { name: 'Target', data: [35, 36.5, 38, 39.5, 40, 41, 42, 43, 44, 45, 46, 47], kind: 'line' },
        ],
        unit: 'Miliar Rp',
        showLegend: true,
      },
    }),
    w('gauge', 'Capaian Target Pendapatan', 'Realisasi terhadap target RKAP', { w: 4, h: 4 }, {
      chart: { xAxis: ['Capaian'], series: [{ name: 'Capaian', data: [107.1] }], unit: '%', min: 0, max: 120, showLegend: false },
    }),
    w('donut', 'Komposisi Pelanggan per Golongan Tarif', 'Porsi SL menurut golongan', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Rumah Tangga', 'Niaga', 'Sosial', 'Industri'],
        series: [{ name: 'Porsi', data: [62, 21, 11, 6] }],
        unit: '%',
        showLegend: true,
      },
    }),
    w('bar', 'Tingkat NRW per Zona Distribusi', 'Perbandingan kehilangan air antar zona', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Zona Barat', 'Zona Timur', 'Zona Utara', 'Zona Selatan', 'Zona Pusat'],
        series: [{ name: 'NRW (%)', data: [18.2, 24.6, 21.1, 26.3, 19.8] }],
        unit: '%',
        showLegend: false,
      },
    }),
    w('combo', 'Produksi vs Air Tertagih', 'Volume produksi dan air terjual', { w: 6, h: 4 }, {
      chart: {
        xAxis: BULAN,
        series: [
          { name: 'Produksi (juta m³)', data: [1.5, 1.52, 1.55, 1.51, 1.58, 1.6, 1.62, 1.59, 1.64, 1.66, 1.63, 1.68], kind: 'bar', yAxisIndex: 0 },
          { name: 'Air Tertagih (juta m³)', data: [1.16, 1.18, 1.2, 1.17, 1.22, 1.24, 1.26, 1.23, 1.27, 1.29, 1.27, 1.31], kind: 'line', yAxisIndex: 1 },
        ],
        unit: 'juta m³',
        showLegend: true,
      },
    }),
    w('area', 'Tren Volume Air Terdistribusi', 'Volume distribusi bulanan', { w: 6, h: 4 },
      seri1('Air terdistribusi (juta m³)', [1.42, 1.45, 1.47, 1.44, 1.5, 1.52, 1.55, 1.51, 1.56, 1.58, 1.55, 1.6], 'juta m³')),
    w('heatmap', 'NRW per Zona per Triwulan', 'Pola kehilangan air per zona', { w: 6, h: 4 }, {
      heatmap: {
        rows: ['Zona Barat', 'Zona Timur', 'Zona Utara', 'Zona Selatan'],
        columns: TW,
        data: [
          [21, 19.5, 18.8, 18.2],
          [28, 26.5, 25.4, 24.6],
          [24, 22.8, 21.9, 21.1],
          [29, 27.6, 26.9, 26.3],
        ],
        unit: '%',
      },
    }),
    w('pie', 'Komposisi Biaya Operasional', 'Struktur beban usaha', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Energi & Kimia', 'Gaji Pegawai', 'Pemeliharaan', 'Penyusutan', 'Lainnya'],
        series: [{ name: 'Porsi', data: [34, 28, 18, 12, 8] }],
        unit: '%',
        showLegend: true,
      },
    }),
    w('hbar', 'Jumlah Gangguan per Kategori', 'Frekuensi gangguan layanan', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Pipa Bocor', 'Air Keruh', 'Tekanan Rendah', 'Meter Rusak', 'Aliran Mati'],
        series: [{ name: 'Jumlah kasus', data: [142, 98, 76, 54, 38] }],
        unit: 'kasus',
        showLegend: false,
      },
    }),
    w('waterfall', 'Perubahan Pelanggan Aktif', 'Dekomposisi penambahan & pengurangan SL', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Awal', 'SL Baru', 'Reaktivasi', 'Berhenti', 'Akhir'],
        series: [{ name: 'Pelanggan', data: [145800, 3200, 640, -990, 148650] }],
        waterfall: [
          { name: 'Awal', value: 145800 },
          { name: 'SL Baru', value: 3200 },
          { name: 'Reaktivasi', value: 640 },
          { name: 'Berhenti', value: -990 },
          { name: 'Akhir', value: 148650 },
        ],
        unit: 'SL',
        showLegend: false,
      },
    }),
    w('radar', 'Profil Kinerja Layanan', 'Skor indikator layanan vs standar', { w: 6, h: 4 }, {
      chart: {
        xAxis: [],
        series: [],
        radar: {
          indicators: [
            { name: 'Kualitas Air', max: 100 },
            { name: 'Kontinuitas', max: 100 },
            { name: 'Tekanan', max: 100 },
            { name: 'Respons Aduan', max: 100 },
            { name: 'Kepuasan', max: 100 },
          ],
          series: [
            { name: 'Aktual', values: [96, 88, 82, 79, 84] },
            { name: 'Standar', values: [100, 95, 90, 90, 85] },
          ],
        },
        unit: 'indeks',
        showLegend: true,
      },
    }),
    w('scatter', 'Sebaran Konsumsi per Golongan', 'Konsumsi rata-rata vs jumlah SL', { w: 6, h: 4 }, {
      chart: {
        xAxis: [],
        series: [],
        points: [
          { x: 12, y: 92, label: 'Rumah Tangga' },
          { x: 26, y: 31, label: 'Niaga' },
          { x: 34, y: 16, label: 'Sosial' },
          { x: 58, y: 9, label: 'Industri' },
          { x: 20, y: 44, label: 'Pemerintah' },
          { x: 40, y: 6, label: 'Khusus' },
        ],
        unit: 'm³/SL',
      },
    }),

    // ── Tabel & narasi ───────────────────────────────────────────────────────
    w('table', 'Rekap Kinerja Operasional', 'Indikator teknis utama', { w: 12, h: 3 }, {
      table: {
        columns: [
          { key: 'indikator', label: 'Indikator' },
          { key: 'satuan', label: 'Satuan' },
          { key: 'target', label: 'Target', format: 'number' },
          { key: 'realisasi', label: 'Realisasi', format: 'number' },
          { key: 'status', label: 'Status' },
        ],
        rows: [
          { indikator: 'Cakupan Pelayanan', satuan: '%', target: 92, realisasi: 89.4, status: 'Mendekati' },
          { indikator: 'Konsumsi Air Rata-rata', satuan: 'm³/SL', target: 18, realisasi: 16.8, status: 'Baik' },
          { indikator: 'Kualitas Air Sesuai Baku Mutu', satuan: '%', target: 100, realisasi: 98.5, status: 'Baik' },
          { indikator: 'Pengaduan Pelanggan Selesai', satuan: '%', target: 95, realisasi: 96.2, status: 'Tercapai' },
        ],
      },
    }),
    w('narasi', 'Ringkasan Eksekutif', 'Catatan singkat kondisi periode berjalan', { w: 12, h: 3 }, {
      narasi: {
        text:
          'Contoh ringkasan: kinerja PDAM pada periode ini berada pada kondisi sehat. Pendapatan air melampaui target RKAP, ' +
          'ditopang penambahan sambungan langganan baru. Program penurunan NRW berjalan sesuai rencana. ' +
          'Perhatian utama ada pada zona dengan NRW tertinggi yang perlu percepatan penggantian pipa.',
        bulletPoints: [
          'Pendapatan air mencapai 107% dari target RKAP.',
          'NRW turun ke 22,4%, namun dua zona masih di atas ambang.',
          'Efisiensi penagihan terjaga di atas 94%.',
        ],
      },
    }),
  ],
};

// ============================================================================
// 2. BANK DAERAH
// ============================================================================
const TEMPLATE_BANK: DashboardTemplate = {
  id: 'tpl-bank',
  nama: 'Kinerja Bank Daerah (BPD)',
  sektor: 'bank',
  deskripsi:
    'Kanvas lengkap bank daerah: kualitas kredit (NPL), pertumbuhan kredit & DPK, likuiditas, efisiensi, permodalan, dan profitabilitas.',
  fokus: ['Kualitas kredit (NPL)', 'Kredit & DPK', 'Efisiensi (BOPO)', 'Permodalan (CAR)'],
  aksen: '#0f6b85',
  judulDashboard: 'Dashboard Kinerja Bank Daerah (Contoh)',
  deskripsiDashboard:
    'Template bank daerah lengkap (18 widget, 12 grafik): rasio risiko, pertumbuhan kredit, likuiditas, dan profitabilitas. Angka bersifat contoh.',
  widgets: [
    kpi('NPL Gross', 'Rasio kredit bermasalah (batas OJK 5%)', 2.42, '%', -0.18, '-0,18% QoQ', [2.9, 2.8, 2.72, 2.65, 2.6, 2.42], 2.5, 'Batas internal'),
    kpi('Penyaluran Kredit', 'Total portofolio kredit', '18,75', 'Triliun Rp', 10.8, '+10,8% YoY', [16.2, 16.8, 17.3, 17.8, 18.2, 18.75], 18.2, 'Target'),
    kpi('DPK Terhimpun', 'Dana pihak ketiga', '22,40', 'Triliun Rp', 6.4, '+6,4% YoY', [19.8, 20.4, 21, 21.5, 22, 22.4]),
    kpi('Laba Bersih', 'Laba berjalan tahun berjalan', '248,5', 'Miliar Rp', 12.1, '+12,1% YoY', [180, 195, 208, 220, 235, 248.5]),

    // ── Grafik 1-11 ──────────────────────────────────────────────────────────
    w('line', 'Pertumbuhan Kredit & DPK', 'Perbandingan tren bulanan', { w: 8, h: 4 }, {
      chart: {
        xAxis: BULAN,
        series: [
          { name: 'Kredit (T Rp)', data: [16.2, 16.5, 16.8, 17.1, 17.4, 17.8, 18, 18.2, 18.4, 18.5, 18.6, 18.75] },
          { name: 'DPK (T Rp)', data: [19.8, 20.1, 20.4, 20.7, 21, 21.3, 21.6, 21.9, 22.1, 22.2, 22.3, 22.4] },
        ],
        unit: 'Triliun Rp',
        showLegend: true,
      },
    }),
    w('gauge', 'Rasio Kecukupan Modal (CAR)', 'Minimum regulator 8%', { w: 4, h: 4 }, {
      chart: { xAxis: ['CAR'], series: [{ name: 'CAR', data: [24.1] }], unit: '%', min: 0, max: 40, showLegend: false },
    }),
    w('bar', 'Rasio Keuangan Utama', 'Perbandingan rasio kunci', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['NPL Gross', 'NPL Net', 'LDR', 'BOPO', 'CAR'],
        series: [{ name: 'Nilai (%)', data: [2.42, 0.88, 83.7, 74.6, 24.1] }],
        unit: '%',
        showLegend: false,
      },
    }),
    w('donut', 'Komposisi DPK', 'Sumber dana pihak ketiga', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Tabungan', 'Deposito', 'Giro'],
        series: [{ name: 'Porsi', data: [48, 34, 18] }],
        unit: '%',
        showLegend: true,
      },
    }),
    w('area', 'Portofolio Kredit per Segmen', 'Tren penyaluran menurut segmen', { w: 6, h: 4 }, {
      chart: {
        xAxis: BULAN,
        series: [
          { name: 'UMKM', data: [5.8, 5.9, 6.1, 6.2, 6.4, 6.5, 6.7, 6.8, 7, 7.1, 7.2, 7.3] },
          { name: 'Ritel', data: [4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5, 5.1, 5.2, 5.3] },
          { name: 'Korporasi', data: [6.2, 6.3, 6.3, 6.4, 6.4, 6.6, 6.5, 6.5, 6.4, 6.3, 6.2, 6.15] },
        ],
        unit: 'Triliun Rp',
        stacked: true,
        showLegend: true,
      },
    }),
    w('combo', 'Laba Bersih vs BOPO', 'Profitabilitas dan efisiensi', { w: 6, h: 4 }, {
      chart: {
        xAxis: BULAN,
        series: [
          { name: 'Laba (M Rp)', data: [180, 195, 208, 220, 235, 248.5, 262, 275, 288, 300, 315, 330], kind: 'bar', yAxisIndex: 0 },
          { name: 'BOPO (%)', data: [78, 77.5, 77, 76.4, 75.8, 74.6, 74.2, 73.8, 73.5, 73.2, 72.9, 72.6], kind: 'line', yAxisIndex: 1 },
        ],
        unit: 'Miliar Rp',
        showLegend: true,
      },
    }),
    w('pie', 'Komposisi Kredit per Sektor Ekonomi', 'Sebaran portofolio kredit', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Perdagangan', 'Pertanian', 'Konstruksi', 'Jasa', 'Konsumsi'],
        series: [{ name: 'Porsi', data: [32, 22, 18, 16, 12] }],
        unit: '%',
        showLegend: true,
      },
    }),
    w('heatmap', 'NPL per Segmen per Triwulan', 'Kualitas kredit antar segmen', { w: 6, h: 4 }, {
      heatmap: {
        rows: ['UMKM', 'Ritel', 'Korporasi', 'Konsumsi'],
        columns: TW,
        data: [
          [3.4, 3.1, 2.8, 2.5],
          [2.1, 1.9, 1.7, 1.5],
          [1.6, 1.4, 1.3, 1.1],
          [2.8, 2.5, 2.2, 1.9],
        ],
        unit: '%',
      },
    }),
    w('hbar', 'Penyaluran Kredit per Cabang', 'Kontribusi cabang utama', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Cabang Kota', 'Cabang Utara', 'Cabang Selatan', 'Cabang Timur', 'Cabang Barat'],
        series: [{ name: 'Kredit (M Rp)', data: [4200, 3600, 3200, 2900, 2500] }],
        unit: 'Miliar Rp',
        showLegend: false,
      },
    }),
    w('waterfall', 'Dekomposisi Pertumbuhan Laba', 'Sumber kenaikan laba', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Laba Awal', 'Pendapatan Bunga', 'Efisiensi', 'CKPN', 'Laba Akhir'],
        series: [{ name: 'Laba (M Rp)', data: [220, 62, 34, -24, 292] }],
        waterfall: [
          { name: 'Laba Awal', value: 220 },
          { name: 'Pendapatan Bunga', value: 62 },
          { name: 'Efisiensi', value: 34 },
          { name: 'CKPN', value: -24 },
          { name: 'Laba Akhir', value: 292 },
        ],
        unit: 'Miliar Rp',
        showLegend: false,
      },
    }),
    w('radar', 'Profil Kesehatan Bank', 'Skor indikator kesehatan', { w: 6, h: 4 }, {
      chart: {
        xAxis: [],
        series: [],
        radar: {
          indicators: [
            { name: 'Permodalan', max: 100 },
            { name: 'Kualitas Aset', max: 100 },
            { name: 'Likuiditas', max: 100 },
            { name: 'Efisiensi', max: 100 },
            { name: 'Profitabilitas', max: 100 },
          ],
          series: [
            { name: 'Aktual', values: [92, 84, 88, 78, 82] },
            { name: 'Target', values: [85, 85, 85, 85, 85] },
          ],
        },
        unit: 'indeks',
        showLegend: true,
      },
    }),
    w('scatter', 'Kredit vs NPL per Cabang', 'Ukuran portofolio vs risikonya', { w: 6, h: 4 }, {
      chart: {
        xAxis: [],
        series: [],
        points: [
          { x: 4200, y: 1.8, label: 'Cabang Kota' },
          { x: 3600, y: 2.6, label: 'Cabang Utara' },
          { x: 3200, y: 3.2, label: 'Cabang Selatan' },
          { x: 2900, y: 2.1, label: 'Cabang Timur' },
          { x: 2500, y: 3.8, label: 'Cabang Barat' },
        ],
        unit: 'M Rp',
      },
    }),

    // ── Tabel & narasi ───────────────────────────────────────────────────────
    w('table', 'Rekap Rasio Kepatuhan', 'Rasio wajib & batas regulator', { w: 12, h: 3 }, {
      table: {
        columns: [
          { key: 'rasio', label: 'Rasio' },
          { key: 'nilai', label: 'Nilai', format: 'number' },
          { key: 'batas', label: 'Batas Regulator' },
          { key: 'status', label: 'Status' },
        ],
        rows: [
          { rasio: 'NPL Gross', nilai: 2.42, batas: '≤ 5,0%', status: 'Aman' },
          { rasio: 'CAR', nilai: 24.1, batas: '≥ 8,0%', status: 'Aman' },
          { rasio: 'BOPO', nilai: 74.6, batas: '≤ 85%', status: 'Efisien' },
          { rasio: 'LDR', nilai: 83.7, batas: '78% - 92%', status: 'Ideal' },
        ],
      },
    }),
    w('narasi', 'Ringkasan Eksekutif', 'Catatan kondisi keuangan periode berjalan', { w: 12, h: 3 }, {
      narasi: {
        text:
          'Contoh ringkasan: kondisi bank daerah solid dengan permodalan kuat dan likuiditas memadai. ' +
          'Kualitas kredit terjaga di bawah ambang regulator, sementara pertumbuhan kredit dua digit ' +
          'ditopang segmen UMKM. Efisiensi operasional (BOPO) berada di zona sehat.',
        bulletPoints: [
          'NPL Gross 2,42% — di bawah ambang 5%.',
          'CAR 24,1% — jauh di atas minimum 8%.',
          'Pertumbuhan kredit 10,8% YoY.',
        ],
      },
    }),
  ],
};

// ============================================================================
// 3. PASAR RAKYAT
// ============================================================================
const TEMPLATE_PASAR: DashboardTemplate = {
  id: 'tpl-pasar',
  nama: 'Pengelolaan Pasar Rakyat',
  sektor: 'pasar',
  deskripsi:
    'Kanvas lengkap pengelolaan pasar: okupansi kios, retribusi harian, stabilitas harga pangan, kunjungan, dan jumlah pedagang.',
  fokus: ['Okupansi lapak & kios', 'Retribusi & pendapatan', 'Stabilitas harga pangan', 'Pedagang aktif'],
  aksen: '#0f7a53',
  judulDashboard: 'Dashboard Pengelolaan Pasar Rakyat (Contoh)',
  deskripsiDashboard:
    'Template pasar rakyat lengkap (18 widget, 12 grafik): okupansi, retribusi, harga pangan, dan pedagang. Angka bersifat contoh.',
  widgets: [
    kpi('Tingkat Okupansi Kios', 'Lapak & kios terisi dari total unit', 86.4, '%', 3.2, '+3,2% dari TW lalu', [80, 81.5, 83, 84.2, 85.4, 86.4], 85, 'Target'),
    kpi('Retribusi Harian', 'Rata-rata penerimaan harian', '48,6', 'Juta Rp', 12.5, '+12,5% pasca QRIS', [38, 40, 42, 44, 46.5, 48.6], 45, 'Target'),
    kpi('Pedagang Aktif', 'Total pedagang terdaftar aktif', '8.420', 'orang', 4.1, '+330 pedagang', [7900, 8020, 8110, 8200, 8310, 8420]),
    kpi('Indeks Stabilitas Pangan', 'Stabilitas harga komoditas pokok', 92.5, 'indeks', 1.8, '+1,8% membaik', [88, 89.2, 90.1, 91, 91.8, 92.5]),

    // ── Grafik 1-11 ──────────────────────────────────────────────────────────
    w('line', 'Tren Retribusi Bulanan', 'Penerimaan retribusi sepanjang tahun', { w: 8, h: 4 }, {
      chart: {
        xAxis: BULAN,
        series: [{ name: 'Retribusi (Juta Rp)', data: [38, 40, 42, 44, 46.5, 48.6, 50, 51.2, 52, 53.5, 54, 55.2] }],
        unit: 'Juta Rp',
        showLegend: false,
      },
    }),
    w('gauge', 'Capaian Target Retribusi', 'Realisasi terhadap target tahunan', { w: 4, h: 4 }, {
      chart: { xAxis: ['Capaian'], series: [{ name: 'Capaian', data: [103.6] }], unit: '%', min: 0, max: 120, showLegend: false },
    }),
    w('donut', 'Komposisi Pedagang per Jenis Dagangan', 'Sebaran pedagang', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Sembako', 'Sayur & Buah', 'Daging & Ikan', 'Pakaian', 'Lainnya'],
        series: [{ name: 'Porsi', data: [32, 24, 18, 14, 12] }],
        unit: '%',
        showLegend: true,
      },
    }),
    w('bar', 'Okupansi per Unit Pasar', 'Perbandingan antar pasar', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Pasar A', 'Pasar B', 'Pasar C', 'Pasar D', 'Pasar E', 'Pasar F'],
        series: [{ name: 'Okupansi (%)', data: [92, 88, 84, 79, 90, 86] }],
        unit: '%',
        showLegend: false,
      },
    }),
    w('combo', 'Harga Komoditas Pokok', 'Perbandingan harga bulan ini vs bulan lalu', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Beras', 'Cabai', 'Ayam', 'Telur', 'Bawang'],
        series: [
          { name: 'Bulan ini (Rp/kg)', data: [13500, 42000, 36500, 28000, 32000], kind: 'bar', yAxisIndex: 0 },
          { name: 'Bulan lalu (Rp/kg)', data: [13400, 45500, 36000, 27500, 33000], kind: 'line', yAxisIndex: 0 },
        ],
        unit: 'Rp/kg',
        showLegend: true,
      },
    }),
    w('area', 'Tren Kunjungan Pasar', 'Estimasi pengunjung harian', { w: 6, h: 4 }, {
      chart: {
        xAxis: HARI,
        series: [
          { name: 'Pasar Besar', data: [8200, 7600, 7400, 7800, 8900, 9800, 9400] },
          { name: 'Pasar Kecil', data: [4200, 3900, 3800, 4000, 4600, 5100, 4900] },
        ],
        unit: 'pengunjung',
        stacked: true,
        showLegend: true,
      },
    }),
    w('heatmap', 'Okupansi per Pasar per Triwulan', 'Pola keterisian kios', { w: 6, h: 4 }, {
      heatmap: {
        rows: ['Pasar A', 'Pasar B', 'Pasar C', 'Pasar D'],
        columns: TW,
        data: [
          [86, 88, 90, 92],
          [82, 84, 86, 88],
          [78, 80, 82, 84],
          [72, 74, 77, 79],
        ],
        unit: '%',
      },
    }),
    w('pie', 'Komposisi Jenis Retribusi', 'Sumber penerimaan pasar', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Sewa Lapak', 'Kebersihan', 'Keamanan', 'Parkir', 'Lainnya'],
        series: [{ name: 'Porsi', data: [42, 24, 16, 12, 6] }],
        unit: '%',
        showLegend: true,
      },
    }),
    w('hbar', 'Penerimaan per Unit Pasar', 'Kontribusi tiap pasar', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Pasar A', 'Pasar B', 'Pasar C', 'Pasar D', 'Pasar E'],
        series: [{ name: 'Penerimaan (Juta Rp)', data: [942, 810, 735, 701, 640] }],
        unit: 'Juta Rp',
        showLegend: false,
      },
    }),
    w('radar', 'Profil Kualitas Pasar', 'Skor indikator kualitas layanan pasar', { w: 6, h: 4 }, {
      chart: {
        xAxis: [],
        series: [],
        radar: {
          indicators: [
            { name: 'Kebersihan', max: 100 },
            { name: 'Keamanan', max: 100 },
            { name: 'Kenyamanan', max: 100 },
            { name: 'Fasilitas', max: 100 },
            { name: 'Pengelolaan', max: 100 },
          ],
          series: [
            { name: 'Aktual', values: [84, 88, 79, 74, 86] },
            { name: 'Standar', values: [90, 90, 85, 85, 90] },
          ],
        },
        unit: 'indeks',
        showLegend: true,
      },
    }),
    w('scatter', 'Okupansi vs Retribusi per Pasar', 'Kaitan keterisian dengan penerimaan', { w: 6, h: 4 }, {
      chart: {
        xAxis: [],
        series: [],
        points: [
          { x: 92, y: 942, label: 'Pasar A' },
          { x: 88, y: 810, label: 'Pasar B' },
          { x: 84, y: 735, label: 'Pasar C' },
          { x: 79, y: 701, label: 'Pasar D' },
          { x: 90, y: 640, label: 'Pasar E' },
        ],
        unit: 'Juta Rp',
      },
    }),
    w('donut', 'Komposisi Kunjungan per Waktu', 'Sebaran kunjungan harian', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Pagi', 'Siang', 'Sore', 'Malam'],
        series: [{ name: 'Porsi', data: [38, 24, 26, 12] }],
        unit: '%',
        showLegend: true,
      },
    }),

    // ── Tabel & narasi ───────────────────────────────────────────────────────
    w('table', 'Rekap Retribusi per Pasar', 'Penerimaan & capaian', { w: 12, h: 3 }, {
      table: {
        columns: [
          { key: 'pasar', label: 'Unit Pasar' },
          { key: 'pedagang', label: 'Pedagang', format: 'number' },
          { key: 'target', label: 'Target (Jt)', format: 'number' },
          { key: 'realisasi', label: 'Realisasi (Jt)', format: 'number' },
          { key: 'capaian', label: 'Capaian', format: 'percent' },
        ],
        rows: [
          { pasar: 'Pasar A', pedagang: 1520, target: 900, realisasi: 942, capaian: 104.7 },
          { pasar: 'Pasar B', pedagang: 1340, target: 820, realisasi: 810, capaian: 98.8 },
          { pasar: 'Pasar C', pedagang: 1180, target: 760, realisasi: 735, capaian: 96.7 },
          { pasar: 'Pasar D', pedagang: 980, target: 680, realisasi: 701, capaian: 103.1 },
        ],
      },
    }),
    w('narasi', 'Ringkasan Eksekutif', 'Catatan pengelolaan pasar periode berjalan', { w: 12, h: 3 }, {
      narasi: {
        text:
          'Contoh ringkasan: pengelolaan pasar menunjukkan perbaikan, ditandai kenaikan okupansi dan penerimaan retribusi ' +
          'setelah digitalisasi pembayaran. Stabilitas harga pangan terjaga, meski beberapa komoditas masih fluktuatif. ' +
          'Perhatian pada unit pasar dengan okupansi di bawah rata-rata.',
        bulletPoints: [
          'Okupansi rata-rata 86,4% — di atas target 85%.',
          'Retribusi harian naik setelah pembayaran QRIS.',
          'Harga pangan relatif stabil.',
        ],
      },
    }),
  ],
};

// ============================================================================
// 4. RSUD / KESEHATAN
// ============================================================================
const TEMPLATE_RSUD: DashboardTemplate = {
  id: 'tpl-rsud',
  nama: 'Kinerja RSUD / Kesehatan',
  sektor: 'rsud',
  deskripsi:
    'Kanvas lengkap rumah sakit daerah: mutu layanan (BOR, ALOS), pendapatan BLUD, waktu tunggu, kunjungan, dan kepuasan pasien.',
  fokus: ['Mutu layanan (BOR, ALOS)', 'Pendapatan BLUD', 'Waktu tunggu layanan', 'Kepuasan pasien'],
  aksen: '#7f80d8',
  judulDashboard: 'Dashboard Kinerja RSUD (Contoh)',
  deskripsiDashboard:
    'Template rumah sakit daerah lengkap (18 widget, 12 grafik): mutu layanan, keuangan BLUD, dan kepuasan pasien. Angka bersifat contoh.',
  widgets: [
    kpi('Bed Occupancy Rate (BOR)', 'Keterisian tempat tidur rawat inap', 78.5, '%', 2.3, '+2,3% dari bulan lalu', [72, 73.5, 75, 76.2, 77.1, 78.5], 75, 'Standar ideal 60-85%'),
    kpi('Pendapatan BLUD', 'Realisasi pendapatan fungsional', '54,2', 'Miliar Rp', 8.4, '+8,4% vs target', [45, 47, 49, 50.5, 52.4, 54.2], 50, 'Target RKAP'),
    kpi('Kepuasan Pasien', 'Indeks kepuasan rawat jalan', 88.1, 'poin', 3.1, '+3,1% YoY', [82, 83.5, 85, 86.2, 87.3, 88.1], 85, 'Target'),
    kpi('Waktu Tunggu Obat Racikan', 'Rata-rata menit (standar < 60)', 38, 'menit', -6.5, '-6,5 menit membaik', [48, 45, 43, 41, 39, 38], 60, 'Batas standar'),

    // ── Grafik 1-11 ──────────────────────────────────────────────────────────
    w('line', 'Tren Kunjungan & BOR', 'Volume layanan bulanan', { w: 8, h: 4 }, {
      chart: {
        xAxis: BULAN,
        series: [
          { name: 'BOR (%)', data: [72, 73.5, 75, 76.2, 77.1, 78.5, 79.2, 80, 79.5, 78.8, 79.1, 80.2] },
          { name: 'Kunjungan (ribu)', data: [8.2, 8.5, 8.8, 9.1, 9.4, 9.6, 9.8, 10, 9.9, 9.7, 10.1, 10.3] },
        ],
        unit: 'kunjungan',
        showLegend: true,
      },
    }),
    w('gauge', 'BOR vs Standar Ideal', 'Rentang ideal 60-85%', { w: 4, h: 4 }, {
      chart: { xAxis: ['BOR'], series: [{ name: 'BOR', data: [78.5] }], unit: '%', min: 0, max: 100, showLegend: false },
    }),
    w('donut', 'Komposisi Penjamin Pasien', 'Sumber pembayaran layanan', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['BPJS Kesehatan', 'Umum Mandiri', 'Asuransi'],
        series: [{ name: 'Porsi', data: [82.4, 13.8, 3.8] }],
        unit: '%',
        showLegend: true,
      },
    }),
    w('bar', 'Waktu Tunggu Layanan', 'Perbandingan vs standar (menit)', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Pendaftaran', 'Poli Spesialis', 'Farmasi Non-Racik', 'Farmasi Racikan', 'Laboratorium'],
        series: [
          { name: 'Aktual (menit)', data: [12, 42, 18, 38, 25] },
          { name: 'Standar (menit)', data: [15, 60, 30, 60, 30] },
        ],
        unit: 'menit',
        showLegend: true,
      },
    }),
    w('area', 'Tren Pendapatan BLUD', 'Realisasi pendapatan fungsional', { w: 6, h: 4 },
      seri1('Pendapatan (M Rp)', [45, 47, 49, 50.5, 52.4, 54.2, 55.5, 56.8, 58, 59.2, 60.5, 62], 'Miliar Rp')),
    w('combo', 'Kunjungan vs Pendapatan', 'Volume layanan dan penerimaan', { w: 6, h: 4 }, {
      chart: {
        xAxis: BULAN,
        series: [
          { name: 'Kunjungan (ribu)', data: [8.2, 8.5, 8.8, 9.1, 9.4, 9.6, 9.8, 10, 9.9, 9.7, 10.1, 10.3], kind: 'bar', yAxisIndex: 0 },
          { name: 'Pendapatan (M Rp)', data: [45, 47, 49, 50.5, 52.4, 54.2, 55.5, 56.8, 58, 59.2, 60.5, 62], kind: 'line', yAxisIndex: 1 },
        ],
        unit: 'kunjungan',
        showLegend: true,
      },
    }),
    w('pie', 'Komposisi Jenis Layanan', 'Porsi layanan per unit', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Rawat Inap', 'Rawat Jalan', 'IGD', 'Penunjang', 'Rawat Intensif'],
        series: [{ name: 'Porsi', data: [34, 30, 18, 12, 6] }],
        unit: '%',
        showLegend: true,
      },
    }),
    w('heatmap', 'BOR per Ruang per Triwulan', 'Keterisian antar ruang rawat', { w: 6, h: 4 }, {
      heatmap: {
        rows: ['Interna', 'Bedah', 'Anak', 'Obgyn'],
        columns: TW,
        data: [
          [78, 80, 82, 84],
          [72, 74, 76, 79],
          [68, 70, 73, 75],
          [64, 66, 69, 71],
        ],
        unit: '%',
      },
    }),
    w('hbar', '10 Penyakit Terbanyak', 'Frekuensi diagnosis rawat jalan', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Hipertensi', 'ISPA', 'Diabetes', 'Dispepsia', 'Artritis', 'Gastritis'],
        series: [{ name: 'Jumlah kasus', data: [1240, 980, 860, 720, 610, 540] }],
        unit: 'kasus',
        showLegend: false,
      },
    }),
    w('funnel', 'Alur Pasien IGD ke Rawat', 'Tahapan pelayanan pasien', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Kunjungan IGD', 'Observasi', 'Rawat Inap', 'Rawat Intensif'],
        series: [{ name: 'Jumlah pasien', data: [4200, 3100, 1850, 420] }],
        unit: 'pasien',
        showLegend: false,
      },
    }),
    w('radar', 'Profil Mutu Layanan', 'Skor indikator mutu vs standar', { w: 6, h: 4 }, {
      chart: {
        xAxis: [],
        series: [],
        radar: {
          indicators: [
            { name: 'Keselamatan', max: 100 },
            { name: 'Efektivitas', max: 100 },
            { name: 'Efisiensi', max: 100 },
            { name: 'Kenyamanan', max: 100 },
            { name: 'Kepuasan', max: 100 },
          ],
          series: [
            { name: 'Aktual', values: [88, 84, 79, 82, 88] },
            { name: 'Standar', values: [90, 88, 85, 85, 85] },
          ],
        },
        unit: 'indeks',
        showLegend: true,
      },
    }),
    w('scatter', 'Kunjungan vs Kepuasan per Poli', 'Kaitan volume layanan dengan kepuasan', { w: 6, h: 4 }, {
      chart: {
        xAxis: [],
        series: [],
        points: [
          { x: 1240, y: 88, label: 'Poli Interna' },
          { x: 980, y: 86, label: 'Poli Anak' },
          { x: 860, y: 90, label: 'Poli Bedah' },
          { x: 720, y: 84, label: 'Poli Obgyn' },
          { x: 610, y: 89, label: 'Poli Mata' },
        ],
        unit: 'kunjungan',
      },
    }),

    // ── Tabel & narasi ───────────────────────────────────────────────────────
    w('table', 'Rekap Indikator Mutu', 'Indikator mutu kunci vs standar', { w: 12, h: 3 }, {
      table: {
        columns: [
          { key: 'indikator', label: 'Indikator Mutu' },
          { key: 'satuan', label: 'Satuan' },
          { key: 'standar', label: 'Standar' },
          { key: 'realisasi', label: 'Realisasi', format: 'number' },
          { key: 'status', label: 'Status' },
        ],
        rows: [
          { indikator: 'BOR', satuan: '%', standar: '60 - 85', realisasi: 78.5, status: 'Sesuai' },
          { indikator: 'ALOS', satuan: 'hari', standar: '6 - 9', realisasi: 4.2, status: 'Di bawah' },
          { indikator: 'Kepuasan Pasien', satuan: '%', standar: '≥ 85', realisasi: 88.1, status: 'Tercapai' },
          { indikator: 'Waktu Tunggu Racikan', satuan: 'menit', standar: '< 60', realisasi: 38, status: 'Tercapai' },
        ],
      },
    }),
    w('narasi', 'Ringkasan Eksekutif', 'Catatan mutu & keuangan layanan', { w: 12, h: 3 }, {
      narasi: {
        text:
          'Contoh ringkasan: mutu layanan RSUD berada dalam kondisi baik. Tingkat keterisian tempat tidur berada dalam ' +
          'rentang ideal, waktu tunggu layanan memenuhi standar, dan pendapatan BLUD melampaui target. ' +
          'Perhatian pada efisiensi klaim BPJS dan pemerataan beban antar ruang rawat.',
        bulletPoints: [
          'BOR 78,5% — dalam rentang ideal 60-85%.',
          'Pendapatan BLUD melampaui target RKAP.',
          'Kepuasan pasien 88,1 poin.',
        ],
      },
    }),
  ],
};

// ============================================================================
// 5. TRANSPORTASI
// ============================================================================
const TEMPLATE_TRANSPORTASI: DashboardTemplate = {
  id: 'tpl-transportasi',
  nama: 'Transportasi Umum Daerah',
  sektor: 'transportasi',
  deskripsi:
    'Kanvas lengkap transportasi: load factor, ketepatan waktu (OTP), keterangkutan penumpang, subsidi PSO, dan pendapatan tiket.',
  fokus: ['Load factor armada', 'Ketepatan waktu (OTP)', 'Keterangkutan penumpang', 'Subsidi & pendapatan'],
  aksen: '#8f5e08',
  judulDashboard: 'Dashboard Transportasi Umum Daerah (Contoh)',
  deskripsiDashboard:
    'Template transportasi lengkap (16 widget, 10 grafik): operasional armada, layanan, dan keuangan. Angka bersifat contoh.',
  widgets: [
    kpi('Load Factor Armada', 'Rata-rata keterisian penumpang koridor utama', 74.2, '%', 4.2, '+4,2% dari TW lalu', [66, 68, 70, 71.5, 72.8, 74.2], 70, 'Target'),
    kpi('On-Time Performance (OTP)', 'Ketepatan waktu keberangkatan', 92.6, '%', 1.4, '+1,4% YoY', [89, 90, 90.8, 91.5, 92, 92.6], 90, 'Target'),
    kpi('Penumpang Terangkut', 'Total penumpang kuartal ini', '2,84', 'juta', 6.8, '+6,8% YoY', [2.4, 2.5, 2.6, 2.7, 2.78, 2.84]),
    kpi('Pendapatan Tiket', 'Farebox non-tunai', '8,52', 'Miliar Rp', 9.1, '+9,1% YoY', [7.2, 7.5, 7.8, 8, 8.3, 8.52], 8.2, 'Target'),

    // ── Grafik 1-11 ──────────────────────────────────────────────────────────
    w('line', 'Tren Penumpang Bulanan', 'Keterangkutan sepanjang tahun', { w: 8, h: 4 }, {
      chart: {
        xAxis: BULAN,
        series: [{ name: 'Penumpang (ribu)', data: [210, 220, 228, 235, 242, 248, 252, 258, 255, 260, 265, 270] }],
        unit: 'ribu penumpang',
        showLegend: false,
      },
    }),
    w('gauge', 'On-Time Performance', 'Standar minimal 90%', { w: 4, h: 4 }, {
      chart: { xAxis: ['OTP'], series: [{ name: 'OTP', data: [92.6] }], unit: '%', min: 0, max: 100, showLegend: false },
    }),
    w('hbar', 'Load Factor per Koridor', 'Perbandingan antar koridor', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Koridor 1', 'Koridor 2', 'Koridor 3', 'Koridor 4', 'Koridor 5'],
        series: [{ name: 'Load Factor (%)', data: [82, 76, 71, 68, 74] }],
        unit: '%',
        showLegend: false,
      },
    }),
    w('bar', 'Penumpang per Koridor', 'Keterangkutan antar koridor', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Koridor 1', 'Koridor 2', 'Koridor 3', 'Koridor 4', 'Koridor 5'],
        series: [{ name: 'Penumpang (ribu)', data: [860, 720, 540, 420, 300] }],
        unit: 'ribu penumpang',
        showLegend: false,
      },
    }),
    w('area', 'Subsidi PSO vs Farebox', 'Perbandingan bulanan', { w: 6, h: 4 }, {
      chart: {
        xAxis: BULAN,
        series: [
          { name: 'Subsidi PSO (M Rp)', data: [1.1, 1.15, 1.2, 1.22, 1.25, 1.28, 1.3, 1.32, 1.35, 1.38, 1.4, 1.42] },
          { name: 'Farebox (M Rp)', data: [0.6, 0.62, 0.65, 0.68, 0.7, 0.72, 0.74, 0.76, 0.78, 0.8, 0.82, 0.84] },
        ],
        unit: 'Miliar Rp',
        stacked: true,
        showLegend: true,
      },
    }),
    w('combo', 'Pendapatan vs Biaya Operasional', 'Kelayakan operasional bulanan', { w: 6, h: 4 }, {
      chart: {
        xAxis: BULAN,
        series: [
          { name: 'Pendapatan (M Rp)', data: [0.6, 0.62, 0.65, 0.68, 0.7, 0.72, 0.74, 0.76, 0.78, 0.8, 0.82, 0.84], kind: 'bar', yAxisIndex: 0 },
          { name: 'Biaya (M Rp)', data: [1.5, 1.52, 1.55, 1.56, 1.58, 1.6, 1.62, 1.63, 1.65, 1.67, 1.68, 1.7], kind: 'line', yAxisIndex: 1 },
        ],
        unit: 'Miliar Rp',
        showLegend: true,
      },
    }),
    w('pie', 'Komposisi Penumpang per Jenis Tiket', 'Sebaran jenis pembayaran', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Kartu Uang Elektronik', 'QRIS', 'Tunai', 'Langganan'],
        series: [{ name: 'Porsi', data: [46, 28, 16, 10] }],
        unit: '%',
        showLegend: true,
      },
    }),
    w('heatmap', 'Kepadatan Penumpang per Koridor per Jam', 'Pola jam sibuk', { w: 6, h: 4 }, {
      heatmap: {
        rows: ['Koridor 1', 'Koridor 2', 'Koridor 3'],
        columns: ['06-08', '08-10', '12-14', '16-18', '18-20'],
        data: [
          [88, 72, 45, 92, 76],
          [76, 62, 40, 84, 68],
          [62, 52, 34, 70, 56],
        ],
        unit: 'indeks',
      },
    }),
    w('scatter', 'OTP vs Load Factor per Koridor', 'Kaitan ketepatan waktu dengan keterisian', { w: 6, h: 4 }, {
      chart: {
        xAxis: [],
        series: [],
        points: [
          { x: 94, y: 82, label: 'Koridor 1' },
          { x: 92, y: 76, label: 'Koridor 2' },
          { x: 91, y: 71, label: 'Koridor 3' },
          { x: 89, y: 68, label: 'Koridor 4' },
          { x: 93, y: 74, label: 'Koridor 5' },
        ],
        unit: '%',
      },
    }),
    w('radar', 'Profil Kinerja Armada', 'Skor indikator operasional vs target', { w: 6, h: 4 }, {
      chart: {
        xAxis: [],
        series: [],
        radar: {
          indicators: [
            { name: 'Ketepatan', max: 100 },
            { name: 'Keterisian', max: 100 },
            { name: 'Ketersediaan', max: 100 },
            { name: 'Keselamatan', max: 100 },
            { name: 'Kenyamanan', max: 100 },
          ],
          series: [
            { name: 'Aktual', values: [93, 74, 88, 96, 82] },
            { name: 'Target', values: [90, 70, 95, 100, 85] },
          ],
        },
        unit: 'indeks',
        showLegend: true,
      },
    }),

    // ── Tabel & narasi ───────────────────────────────────────────────────────
    w('table', 'Rekap Kinerja Armada', 'Indikator operasional kunci', { w: 12, h: 3 }, {
      table: {
        columns: [
          { key: 'indikator', label: 'Indikator' },
          { key: 'satuan', label: 'Satuan' },
          { key: 'target', label: 'Target', format: 'number' },
          { key: 'realisasi', label: 'Realisasi', format: 'number' },
          { key: 'status', label: 'Status' },
        ],
        rows: [
          { indikator: 'Load Factor', satuan: '%', target: 70, realisasi: 74.2, status: 'Tercapai' },
          { indikator: 'On-Time Performance', satuan: '%', target: 90, realisasi: 92.6, status: 'Tercapai' },
          { indikator: 'Ketersediaan Armada', satuan: '%', target: 95, realisasi: 93.4, status: 'Mendekati' },
          { indikator: 'Kecelakaan Lalu Lintas', satuan: 'kasus', target: 0, realisasi: 2, status: 'Perhatian' },
        ],
      },
    }),
    w('narasi', 'Ringkasan Eksekutif', 'Catatan operasional & layanan', { w: 12, h: 3 }, {
      narasi: {
        text:
          'Contoh ringkasan: layanan transportasi umum daerah menunjukkan perbaikan pada keterangkutan penumpang dan ' +
          'ketepatan waktu. Load factor di atas target menandakan permintaan yang sehat. ' +
          'Perhatian pada ketersediaan armada dan penekanan angka kecelakaan.',
        bulletPoints: [
          'Load factor 74,2% — di atas target 70%.',
          'OTP 92,6% — memenuhi standar.',
          'Perlu peningkatan ketersediaan armada.',
        ],
      },
    }),
  ],
};

// ============================================================================
// 6. ANEKA USAHA
// ============================================================================
const TEMPLATE_ANEKA: DashboardTemplate = {
  id: 'tpl-aneka-usaha',
  nama: 'Aneka Usaha Daerah',
  sektor: 'aneka_usaha',
  deskripsi:
    'Kanvas lengkap multi unit bisnis: pendapatan konsolidasi, margin laba, kontribusi per unit, dan setoran PAD.',
  fokus: ['Pendapatan konsolidasi', 'Margin & profitabilitas', 'Kontribusi unit bisnis', 'Setoran ke daerah'],
  aksen: '#c62f22',
  judulDashboard: 'Dashboard Aneka Usaha Daerah (Contoh)',
  deskripsiDashboard:
    'Template aneka usaha lengkap (17 widget, 11 grafik): pendapatan multi unit, margin, dan kontribusi PAD. Angka bersifat contoh.',
  widgets: [
    kpi('Pendapatan Konsolidasi', 'Total pendapatan seluruh unit usaha', '18,20', 'Miliar Rp', 5.7, '+5,7% vs target', [15.2, 15.8, 16.3, 16.9, 17.5, 18.2], 17.5, 'Target RKAP'),
    kpi('Margin Laba Kotor', 'Rata-rata margin konsolidasi', 22.4, '%', 1.2, '+1,2% YoY', [20.1, 20.6, 21.2, 21.6, 22, 22.4], 22, 'Target'),
    kpi('Setoran PAD', 'Kontribusi ke pendapatan asli daerah', '4,86', 'Miliar Rp', 7.9, '+7,9% YoY', [4.1, 4.3, 4.4, 4.6, 4.72, 4.86], 4.5, 'Target'),
    kpi('Unit Bisnis Aktif', 'Jumlah unit usaha beroperasi', 4, 'unit', 0, 'stabil', [4, 4, 4, 4, 4, 4]),

    // ── Grafik 1-11 ──────────────────────────────────────────────────────────
    w('bar', 'Pendapatan per Unit Bisnis', 'Kontribusi tiap unit', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Percetakan', 'Perhotelan', 'Pengolahan Aspal', 'Cold Storage'],
        series: [{ name: 'Pendapatan (M Rp)', data: [4.2, 6.8, 3.9, 3.3] }],
        unit: 'Miliar Rp',
        showLegend: false,
      },
    }),
    w('donut', 'Porsi Kontribusi Unit', 'Sebaran pendapatan antar unit', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Percetakan', 'Perhotelan', 'Pengolahan Aspal', 'Cold Storage'],
        series: [{ name: 'Porsi', data: [23, 37, 22, 18] }],
        unit: '%',
        showLegend: true,
      },
    }),
    w('line', 'Tren Pendapatan & Margin', 'Pertumbuhan bulanan', { w: 12, h: 4 }, {
      chart: {
        xAxis: BULAN,
        series: [
          { name: 'Pendapatan (M Rp)', data: [15.2, 15.5, 15.8, 16, 16.3, 16.6, 16.9, 17.2, 17.5, 17.7, 17.9, 18.2] },
          { name: 'Margin (%)', data: [20.1, 20.3, 20.6, 20.9, 21.2, 21.4, 21.6, 21.8, 22, 22.1, 22.2, 22.4] },
        ],
        unit: 'Miliar Rp',
        showLegend: true,
      },
    }),
    w('area', 'Tren Laba per Unit Bisnis', 'Kontribusi laba bulanan', { w: 6, h: 4 }, {
      chart: {
        xAxis: BULAN,
        series: [
          { name: 'Perhotelan', data: [1.4, 1.45, 1.5, 1.55, 1.6, 1.65, 1.68, 1.7, 1.72, 1.75, 1.78, 1.8] },
          { name: 'Percetakan', data: [0.7, 0.72, 0.75, 0.78, 0.8, 0.82, 0.84, 0.85, 0.87, 0.88, 0.89, 0.9] },
          { name: 'Pengolahan Aspal', data: [0.5, 0.52, 0.54, 0.56, 0.58, 0.6, 0.62, 0.63, 0.65, 0.66, 0.68, 0.7] },
          { name: 'Cold Storage', data: [0.4, 0.42, 0.44, 0.46, 0.48, 0.5, 0.52, 0.53, 0.55, 0.56, 0.58, 0.6] },
        ],
        unit: 'Miliar Rp',
        stacked: true,
        showLegend: true,
      },
    }),
    w('combo', 'Pendapatan vs Laba Bersih', 'Marjin profitabilitas', { w: 6, h: 4 }, {
      chart: {
        xAxis: BULAN,
        series: [
          { name: 'Pendapatan (M Rp)', data: [15.2, 15.5, 15.8, 16, 16.3, 16.6, 16.9, 17.2, 17.5, 17.7, 17.9, 18.2], kind: 'bar', yAxisIndex: 0 },
          { name: 'Laba (M Rp)', data: [3.0, 3.1, 3.25, 3.35, 3.45, 3.55, 3.65, 3.75, 3.85, 3.9, 3.95, 4.0], kind: 'line', yAxisIndex: 1 },
        ],
        unit: 'Miliar Rp',
        showLegend: true,
      },
    }),
    w('hbar', 'Margin Laba per Unit', 'Perbandingan margin antar unit', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Perhotelan', 'Percetakan', 'Cold Storage', 'Pengolahan Aspal'],
        series: [{ name: 'Margin (%)', data: [26.5, 21.4, 18.2, 17.9] }],
        unit: '%',
        showLegend: false,
      },
    }),
    w('pie', 'Komposisi Jenis Usaha', 'Sebaran bidang usaha daerah', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Jasa & Perhotelan', 'Industri', 'Perdagangan', 'Percetakan', 'Logistik'],
        series: [{ name: 'Porsi', data: [37, 22, 18, 13, 10] }],
        unit: '%',
        showLegend: true,
      },
    }),
    w('treemap', 'Kontribusi Unit terhadap Pendapatan', 'Hierarki kontribusi pendapatan', { w: 6, h: 4 }, {
      treemap: {
        name: 'Pendapatan Konsolidasi',
        children: [
          { name: 'Perhotelan Graha', value: 6.8 },
          { name: 'Percetakan Daerah', value: 4.2 },
          { name: 'Pengolahan Aspal', value: 3.9 },
          { name: 'Cold Storage', value: 3.3 },
        ],
      },
    }),
    w('waterfall', 'Dekomposisi Pertumbuhan Pendapatan', 'Sumber kenaikan pendapatan', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Awal', 'Perhotelan', 'Percetakan', 'Aspal', 'Cold Storage', 'Akhir'],
        series: [{ name: 'Pendapatan (M Rp)', data: [15.2, 1.1, 0.6, 0.4, 0.9, 18.2] }],
        waterfall: [
          { name: 'Awal', value: 15.2 },
          { name: 'Perhotelan', value: 1.1 },
          { name: 'Percetakan', value: 0.6 },
          { name: 'Aspal', value: 0.4 },
          { name: 'Cold Storage', value: 0.9 },
          { name: 'Akhir', value: 18.2 },
        ],
        unit: 'Miliar Rp',
        showLegend: false,
      },
    }),
    w('gauge', 'Capaian Target Setoran PAD', 'Realisasi terhadap target tahunan', { w: 6, h: 4 }, {
      chart: { xAxis: ['PAD'], series: [{ name: 'PAD', data: [108] }], unit: '%', min: 0, max: 120, showLegend: false },
    }),
    w('radar', 'Profil Kinerja Unit Usaha', 'Skor indikator vs target', { w: 6, h: 4 }, {
      chart: {
        xAxis: [],
        series: [],
        radar: {
          indicators: [
            { name: 'Pendapatan', max: 100 },
            { name: 'Margin', max: 100 },
            { name: 'Efisiensi', max: 100 },
            { name: 'Kontribusi PAD', max: 100 },
            { name: 'Pertumbuhan', max: 100 },
          ],
          series: [
            { name: 'Aktual', values: [88, 82, 79, 86, 84] },
            { name: 'Target', values: [90, 85, 85, 85, 85] },
          ],
        },
        unit: 'indeks',
        showLegend: true,
      },
    }),

    // ── Tabel & narasi ───────────────────────────────────────────────────────
    w('table', 'Rekap Kinerja per Unit Usaha', 'Pendapatan, laba, & capaian', { w: 12, h: 3 }, {
      table: {
        columns: [
          { key: 'unit', label: 'Unit Usaha' },
          { key: 'pendapatan', label: 'Pendapatan (M Rp)', format: 'number' },
          { key: 'laba', label: 'Laba (M Rp)', format: 'number' },
          { key: 'margin', label: 'Margin', format: 'percent' },
          { key: 'status', label: 'Status' },
        ],
        rows: [
          { unit: 'Percetakan Daerah', pendapatan: 4.2, laba: 0.9, margin: 21.4, status: 'Sehat' },
          { unit: 'Perhotelan Graha', pendapatan: 6.8, laba: 1.8, margin: 26.5, status: 'Sehat' },
          { unit: 'Pengolahan Aspal', pendapatan: 3.9, laba: 0.7, margin: 17.9, status: 'Cukup' },
          { unit: 'Cold Storage', pendapatan: 3.3, laba: 0.6, margin: 18.2, status: 'Cukup' },
        ],
      },
    }),
    w('narasi', 'Ringkasan Eksekutif', 'Catatan kinerja multi unit bisnis', { w: 12, h: 3 }, {
      narasi: {
        text:
          'Contoh ringkasan: kinerja aneka usaha daerah tumbuh sehat dengan pendapatan konsolidasi melampaui target. ' +
          'Unit perhotelan menjadi kontributor terbesar, sementara unit pengolahan aspal dan cold storage masih ' +
          'berpeluang menaikkan margin. Setoran PAD ke daerah berjalan sesuai rencana.',
        bulletPoints: [
          'Pendapatan konsolidasi melampaui target RKAP.',
          'Margin laba kotor 22,4%.',
          'Perhotelan kontributor terbesar.',
        ],
      },
    }),
  ],
};

/** Semua template dashboard yang tersedia (satu per sektor BUMD). */
export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  TEMPLATE_PDAM,
  TEMPLATE_BANK,
  TEMPLATE_PASAR,
  TEMPLATE_RSUD,
  TEMPLATE_TRANSPORTASI,
  TEMPLATE_ANEKA,
];

/**
 * Ambil template berdasarkan sektor.
 * Dipakai untuk menyorot template yang paling relevan dengan instansi aktif.
 */
export function templateUntukSektor(sektor?: BumdSector): DashboardTemplate | undefined {
  if (!sektor) return undefined;
  return DASHBOARD_TEMPLATES.find((t) => t.sektor === sektor);
}

/**
 * Salin widget template dengan id BARU yang unik per dashboard.
 *
 * Wajib: id widget dipakai sebagai kunci React & target edit/hapus. Kalau id
 * template dipakai apa adanya, dua dashboard dari template yang sama akan punya
 * id widget kembar dan operasi pada satu dashboard bisa mengenai yang lain.
 *
 * Semua objek bersarang disalin (deep copy) supaya penyuntingan di kanvas tidak
 * diam-diam mengubah definisi template yang dipakai ulang.
 */
export function widgetDariTemplate(template: DashboardTemplate, seed: number): WidgetSpec[] {
  return template.widgets.map((widget, i) => ({
    ...widget,
    id: `tpl-${template.sektor}-${seed}-${i + 1}`,
    grid: { ...widget.grid },
    chart: widget.chart
      ? {
          ...widget.chart,
          xAxis: [...widget.chart.xAxis],
          series: widget.chart.series.map((s) => ({ ...s, data: [...s.data] })),
          points: widget.chart.points?.map((p) => ({ ...p })),
          links: widget.chart.links?.map((l) => ({ ...l })),
          waterfall: widget.chart.waterfall?.map((x) => ({ ...x })),
          radar: widget.chart.radar
            ? {
                indicators: widget.chart.radar.indicators.map((x) => ({ ...x })),
                series: widget.chart.radar.series.map((s) => ({ ...s, values: [...s.values] })),
              }
            : undefined,
          boxRaw: widget.chart.boxRaw?.map((g) => [...g]),
        }
      : undefined,
    kpi: widget.kpi ? { ...widget.kpi, sparkline: widget.kpi.sparkline ? [...widget.kpi.sparkline] : undefined } : undefined,
    heatmap: widget.heatmap
      ? { ...widget.heatmap, rows: [...widget.heatmap.rows], columns: [...widget.heatmap.columns], data: widget.heatmap.data.map((r) => [...r]) }
      : undefined,
    geo: widget.geo ? { ...widget.geo, regions: widget.geo.regions.map((r) => ({ ...r })) } : undefined,
    gantt: widget.gantt ? { ...widget.gantt, tasks: widget.gantt.tasks.map((t) => ({ ...t })) } : undefined,
    treemap: widget.treemap
      ? { ...widget.treemap, children: widget.treemap.children?.map((c) => ({ ...c })) }
      : undefined,
    table: widget.table ? { ...widget.table, rows: widget.table.rows.map((r) => ({ ...r })) } : undefined,
    narasi: widget.narasi ? { ...widget.narasi, bulletPoints: widget.narasi.bulletPoints ? [...widget.narasi.bulletPoints] : undefined } : undefined,
    citations: [],
  }));
}
