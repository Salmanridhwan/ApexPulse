import { WidgetSpec, WidgetType } from '../../types';

/**
 * TEMPLATE DASHBOARD — template UMUM berdasarkan TUJUAN, bukan sektor BUMD.
 *
 * Konsep: satu template = satu tujuan pemakaian + satu cara penyampaian.
 *   - `tujuan`          : untuk apa dashboard ini dipakai.
 *   - `caraPenyampaian` : bagaimana isinya disajikan (ringkasan satu layar,
 *                         papan pemantauan, laporan naratif, perbandingan tabel,
 *                         komposisi & sebaran, papan status).
 *
 * JUMLAH KARTU DIBATASI (maksimal 8 per template).
 * Dashboard tampil sebagai SATU halaman penuh tanpa scroll. Dengan 18 kartu,
 * satu layar hanya menyisakan ~35px per grafik — tidak terbaca. Karena itu tiap
 * template disusun paling banyak 8 kartu (±4 baris), sehingga grafik tetap besar
 * di layar 1080p. Kartu yang hanya mengulang informasi yang sama dibuang.
 *
 * Template tidak terikat sektor: angka selalu diambil dari dokumen instansi yang
 * sedang login (lihat `isiTemplateDariRag`), apa pun sektornya.
 *
 * PENTING soal angka: seluruh angka di sini DATA DUMMY (contoh), bukan hasil
 * pembacaan dokumen. Karena itu `confidence` sengaja diisi `'inferensi AI'` dan
 * `citations` dikosongkan — supaya tidak ada dokumen yang diklaim sebagai sumber.
 */

export interface DashboardTemplate {
  id: string;
  nama: string;
  /** Untuk apa dashboard ini dipakai (satu kalimat, bahasa pengguna). */
  tujuan: string;
  /** Bagaimana isinya disajikan: susunan, penekanan, dan cara membacanya. */
  caraPenyampaian: string;
  /** Ringkasan satu kalimat untuk kartu template. */
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
  /** `undefined` = metrik non-persen (chip delta selalu menambah "%"). */
  delta: number | undefined,
  deltaLabel: string,
  sparkline: number[],
  target?: number,
  targetLabel?: string
): WidgetSpec =>
  w('kpi', title, subtitle, { w: 3, h: 3 }, {
    kpi: { value, unit, delta, deltaLabel, sparkline, sparklineAsal: 'turunan-nilai', target, targetLabel },
  });

type Seri = { name: string; data: number[]; kind?: 'bar' | 'line'; yAxisIndex?: 0 | 1; unit?: string };

/** Grafik kartesius (bar/line/area/hbar/combo) dengan satu atau beberapa seri. */
const grafik = (
  type: WidgetType,
  title: string,
  subtitle: string,
  grid: { w: number; h: number },
  xAxis: string[],
  series: Seri[],
  unit: string,
  opsi: { stacked?: boolean; showLegend?: boolean } = {}
): WidgetSpec =>
  w(type, title, subtitle, grid, {
    chart: {
      xAxis,
      series,
      unit,
      showLegend: opsi.showLegend ?? series.length > 1,
      stacked: opsi.stacked,
    },
  });

/** Tabel rekap. */
const tabel = (
  title: string,
  subtitle: string,
  grid: { w: number; h: number },
  columns: Array<{ key: string; label: string; format?: 'number' | 'currency' | 'percent' | 'text' }>,
  rows: Array<Record<string, string | number>>
): WidgetSpec => w('table', title, subtitle, grid, { table: { columns, rows } });

/** Narasi / kesimpulan. */
const narasi = (
  title: string,
  subtitle: string,
  grid: { w: number; h: number },
  text: string,
  bulletPoints?: string[]
): WidgetSpec => w('narasi', title, subtitle, grid, { narasi: { text, bulletPoints } });

// ============================================================================
// 1. RINGKASAN EKSEKUTIF — satu layar, dibaca cepat (8 kartu)
// ============================================================================
const TEMPLATE_RINGKASAN: DashboardTemplate = {
  id: 'tpl-ringkasan',
  nama: 'Ringkasan Eksekutif',
  tujuan:
    'Memberi pimpinan gambaran menyeluruh dalam satu layar: capaian utama, penyimpangan, dan kesimpulan — tanpa membuka laporan.',
  caraPenyampaian:
    'Ringkasan satu halaman: 6 KPI besar di paling atas, satu grafik tren pendapatan vs beban, lalu narasi kesimpulan. Selesai dibaca di bawah dua menit.',
  deskripsi: 'Satu layar untuk pimpinan: capaian utama, penyimpangan, dan kesimpulan.',
  fokus: ['Capaian utama', 'Penyimpangan', 'Kesimpulan'],
  aksen: '#1fa6cc',
  judulDashboard: 'Ringkasan Eksekutif (Contoh)',
  deskripsiDashboard:
    'Template ringkasan satu halaman (8 kartu): 6 KPI utama, grafik tren pendapatan vs beban, dan narasi kesimpulan. Angka bersifat contoh dan dapat diganti dengan data resmi.',
  widgets: [
    kpi('Pendapatan Usaha', 'Realisasi periode berjalan', '128,4', 'Miliar Rp', 6.8, 'vs target', [110, 113, 116, 120, 124, 128.4], 120, 'Target'),
    kpi('Laba Bersih', 'Setelah seluruh beban usaha', '23,7', 'Miliar Rp', 4.2, 'YoY', [19, 20, 21, 21.8, 22.6, 23.7]),
    kpi('Beban Operasional', 'Terhadap pagu yang ditetapkan', '96,2', 'Miliar Rp', -1.4, 'dari pagu', [99, 98.4, 97.8, 97.1, 96.8, 96.2], 98, 'Pagu'),
    kpi('Realisasi Anggaran', 'Serapan belanja periode ini', 87.5, '%', 3.1, 'dari triwulan lalu', [78, 80, 82, 84, 86, 87.5], 90, 'Target'),
    kpi('Indeks Kepuasan Layanan', 'Skala 0-100', 82.4, 'poin', undefined, 'naik 1,8 poin', [78, 79, 80, 81, 81.8, 82.4], 85, 'Target'),
    kpi('Temuan Audit Terbuka', 'Belum ditindaklanjuti', 12, 'temuan', undefined, 'turun 4 dari semester lalu', [22, 20, 18, 16, 14, 12], 0, 'Target'),

    grafik('line', 'Tren Pendapatan & Beban', 'Bulanan, satuan miliar rupiah', { w: 12, h: 4 }, BULAN, [
      { name: 'Pendapatan', data: [98, 101, 104, 107, 110, 113, 116, 119, 122, 124, 126, 128.4] },
      { name: 'Beban', data: [88, 90, 91, 92, 93, 94, 94.6, 95, 95.4, 95.8, 96, 96.2], kind: 'line' },
    ], 'Miliar Rp'),

    narasi('Kesimpulan Eksekutif', 'Tiga hal yang perlu diketahui pimpinan', { w: 12, h: 3 },
      'Contoh kesimpulan: kinerja periode ini berada pada kondisi sehat. Pendapatan melampaui target, beban operasional terjaga di bawah pagu, ' +
      'dan serapan anggaran berjalan sesuai jadwal. Perhatian utama ada pada 12 temuan audit yang belum ditutup dan capaian dua unit yang masih di bawah target.',
      [
        'Pendapatan 107% dari target; laba bersih tumbuh 4,2%.',
        'Serapan anggaran 87,5% — perlu percepatan agar target 90% tercapai.',
        'Temuan audit terbuka turun dari 22 menjadi 12.',
      ]),
  ],
};

// ============================================================================
// 2. PEMANTAUAN OPERASIONAL — papan pemantauan harian (8 kartu)
// ============================================================================
const TEMPLATE_PEMANTAUAN: DashboardTemplate = {
  id: 'tpl-pemantauan',
  nama: 'Pemantauan Operasional',
  tujuan:
    'Memantau kegiatan harian dan menangkap penyimpangan lebih awal, sebelum menjadi masalah besar.',
  caraPenyampaian:
    'Papan pemantauan: KPI status cepat di atas, tren tujuh hari, heatmap beban per unit, lalu daftar isu yang perlu ditindak hari ini.',
  deskripsi: 'Papan harian: status cepat, tren tujuh hari, dan daftar isu.',
  fokus: ['Volume layanan', 'Ketepatan waktu', 'Beban unit', 'Isu harian'],
  aksen: '#22c55e',
  judulDashboard: 'Pemantauan Operasional (Contoh)',
  deskripsiDashboard:
    'Template pemantauan harian (8 kartu): 4 KPI status, tren tujuh hari, heatmap beban per unit, dan daftar isu. Angka bersifat contoh dan dapat diganti dengan data resmi.',
  widgets: [
    kpi('Volume Layanan Hari Ini', 'Transaksi/pelanggan dilayani', '12.480', 'transaksi', 2.4, 'vs kemarin', [11200, 11600, 11900, 12100, 12300, 12480]),
    kpi('Waktu Layanan Rata-rata', 'Semakin rendah semakin baik', 6.8, 'menit', undefined, 'turun 0,6 menit', [8.2, 7.9, 7.6, 7.3, 7.1, 6.8], 7, 'Standar'),
    kpi('Pekerjaan Selesai', 'Terhadap total pekerjaan masuk', 96.2, '%', 1.2, 'vs kemarin', [92, 93, 94, 94.8, 95.4, 96.2], 95, 'Target'),
    kpi('Gangguan Aktif', 'Laporan belum tertangani', 7, 'laporan', undefined, 'turun 3 dari kemarin', [16, 14, 12, 10, 9, 7], 0, 'Target'),

    grafik('line', 'Volume Layanan 7 Hari Terakhir', 'Pola harian untuk melihat lonjakan', { w: 6, h: 4 }, HARI,
      [{ name: 'Transaksi', data: [10800, 11400, 11900, 12100, 12300, 9600, 7200] }], 'transaksi', { showLegend: false }),
    w('heatmap', 'Beban Kerja per Unit per Hari', 'Semakin gelap semakin padat', { w: 6, h: 4 }, {
      heatmap: {
        rows: ['Unit A', 'Unit B', 'Unit C', 'Unit D'],
        columns: HARI,
        data: [
          [42, 46, 44, 48, 51, 22, 12],
          [38, 41, 40, 43, 45, 18, 9],
          [51, 55, 53, 58, 61, 26, 14],
          [29, 31, 30, 33, 35, 15, 8],
        ],
        unit: 'pekerjaan',
      },
    }),

    tabel('Isu yang Perlu Tindakan', 'Diurutkan dari yang paling mendesak', { w: 12, h: 3 }, [
      { key: 'isu', label: 'Isu' },
      { key: 'unit', label: 'Unit' },
      { key: 'dampak', label: 'Dampak' },
      { key: 'tenggat', label: 'Tenggat' },
      { key: 'status', label: 'Status' },
    ], [
      { isu: 'Antrean layanan di loket utama', unit: 'Unit C', dampak: 'Tinggi', tenggat: 'Hari ini', status: 'Ditangani' },
      { isu: 'Dua laporan gangguan belum ditutup', unit: 'Unit A', dampak: 'Sedang', tenggat: 'Besok', status: 'Berjalan' },
      { isu: 'Stok bahan habis di gudang', unit: 'Unit D', dampak: 'Sedang', tenggat: '2 hari', status: 'Menunggu' },
    ]),
    narasi('Catatan Operasional Hari Ini', 'Ringkas untuk kepala unit', { w: 12, h: 3 },
      'Contoh catatan: volume layanan naik 2,4% dibanding kemarin dan masih dalam kapasitas unit. Antrean di loket utama sudah ditangani dengan menambah satu petugas. ' +
      'Dua gangguan tersisa di Unit A ditargetkan selesai besok; pengadaan bahan di Unit D perlu persetujuan agar tidak menunda pekerjaan.',
      [
        'Volume layanan 12.480 transaksi, waktu layanan turun ke 6,8 menit.',
        'SLA penyelesaian 94,1% — masih di atas standar 90%.',
        'Tiga isu terbuka, satu di antaranya berdampak tinggi.',
      ]),
  ],
};

// ============================================================================
// 3. LAPORAN KINERJA BERKALA — laporan naratif siap cetak (8 kartu)
// ============================================================================
const TEMPLATE_LAPORAN: DashboardTemplate = {
  id: 'tpl-laporan',
  nama: 'Laporan Kinerja Berkala',
  tujuan:
    'Menyusun laporan kinerja bulanan/triwulanan yang siap dibaca dan dicetak, lengkap dengan capaian terhadap target.',
  caraPenyampaian:
    'Laporan naratif: KPI capaian di atas, tabel rekap indikator yang dominan, dua grafik tren triwulanan, lalu uraian capaian tertulis.',
  deskripsi: 'Laporan bulanan/triwulanan: tabel rekap, tren, dan uraian capaian.',
  fokus: ['Capaian vs target', 'Tren triwulanan', 'Uraian program', 'Kesimpulan'],
  aksen: '#6366f1',
  judulDashboard: 'Laporan Kinerja Berkala (Contoh)',
  deskripsiDashboard:
    'Template laporan berkala (8 kartu): 4 KPI capaian, tabel rekap indikator, dua grafik tren, dan uraian capaian. Angka bersifat contoh dan dapat diganti dengan data resmi.',
  widgets: [
    kpi('Capaian Target Kinerja', 'Rata-rata seluruh indikator', 97.3, '%', 2.4, 'dari periode lalu', [88, 90, 92, 94, 96, 97.3], 100, 'Target'),
    kpi('Nilai Evaluasi Kinerja', 'Skala 0-100', 86.5, 'poin', undefined, 'naik 3,2 poin', [78, 80, 82, 83.5, 85, 86.5], 85, 'Target'),
    kpi('Program Tercapai', 'Dari total program kerja', 14, 'program', undefined, 'bertambah 2 program', [9, 10, 11, 12, 13, 14], 15, 'Target'),
    kpi('Sisa Target Periode', 'Yang harus dikejar', 5, 'indikator', undefined, 'berkurang 2 indikator', [11, 10, 9, 8, 6, 5], 0, 'Target'),

    tabel('Rekap Kinerja per Indikator', 'Periode berjalan, dibandingkan target', { w: 12, h: 3 }, [
      { key: 'indikator', label: 'Indikator' },
      { key: 'satuan', label: 'Satuan' },
      { key: 'target', label: 'Target', format: 'number' },
      { key: 'realisasi', label: 'Realisasi', format: 'number' },
      { key: 'capaian', label: 'Capaian (%)', format: 'percent' },
      { key: 'status', label: 'Status' },
    ], [
      { indikator: 'Pendapatan usaha', satuan: 'Miliar Rp', target: 120, realisasi: 128.4, capaian: 107, status: 'Tercapai' },
      { indikator: 'Laba bersih', satuan: 'Miliar Rp', target: 22, realisasi: 23.7, capaian: 107.7, status: 'Tercapai' },
      { indikator: 'Serapan anggaran', satuan: '%', target: 90, realisasi: 87.5, capaian: 97.2, status: 'Mendekati' },
      { indikator: 'Kepuasan layanan', satuan: 'poin', target: 85, realisasi: 82.4, capaian: 96.9, status: 'Mendekati' },
      { indikator: 'Temuan audit tertutup', satuan: '%', target: 90, realisasi: 78.5, capaian: 87.2, status: 'Perlu tindakan' },
    ]),
    grafik('line', 'Tren Capaian Triwulanan', 'Perbandingan target dan realisasi', { w: 6, h: 4 },
      ['TW1', 'TW2', 'TW3', 'TW4'],
      [
        { name: 'Target', data: [95, 97, 99, 100] },
        { name: 'Realisasi', data: [91, 94, 96.5, 97.3], kind: 'line' },
      ], '%'),
    grafik('combo', 'Realisasi Anggaran & Capaian Fisik', 'Bulanan: rupiah dan persen', { w: 6, h: 4 }, BULAN,
      [
        { name: 'Realisasi (Miliar Rp)', data: [18, 20, 22, 23, 24, 25, 24, 26, 27, 28, 27, 29], kind: 'bar', yAxisIndex: 0 },
        { name: 'Capaian fisik (%)', data: [12, 18, 26, 33, 41, 48, 56, 63, 71, 78, 84, 87.5], kind: 'line', yAxisIndex: 1 },
      ], 'campuran'),

    narasi('Uraian Capaian & Kendala', 'Bahan narasi laporan tertulis', { w: 12, h: 3 },
      'Contoh uraian: capaian kinerja periode ini 97,3% dari target, naik 2,4% dibanding periode sebelumnya. Pendapatan dan laba bersih melampaui target, ' +
      'sedangkan serapan anggaran dan kepuasan layanan masih sedikit di bawah. Kendala utama adalah keterlambatan pengadaan pada Program D dan ' +
      'tindak lanjut temuan audit yang baru selesai 78,5%.',
      [
        'Tiga dari lima indikator utama tercapai; dua indikator mendekati target.',
        'Program D tertinggal karena pengadaan terlambat dua bulan.',
        'Rencana perbaikan: percepatan pengadaan dan pendampingan tindak lanjut audit.',
      ]),
  ],
};

// ============================================================================
// 4. ANGGARAN & REALISASI — perbandingan pagu vs serapan (8 kartu)
// ============================================================================
const TEMPLATE_ANGGARAN: DashboardTemplate = {
  id: 'tpl-anggaran',
  nama: 'Anggaran & Realisasi',
  tujuan:
    'Membandingkan pagu anggaran dengan realisasi sehingga sisa dan kecepatan serapan terlihat jelas per program.',
  caraPenyampaian:
    'Perbandingan: KPI pagu/serapan di atas, tabel rinci per program, bar pagu vs realisasi, lalu catatan keputusan.',
  deskripsi: 'Pagu vs realisasi: tabel per program, selisih, dan progres serapan.',
  fokus: ['Pagu & realisasi', 'Sisa anggaran', 'Serapan per program', 'Progres bulanan'],
  aksen: '#f59e0b',
  judulDashboard: 'Anggaran & Realisasi (Contoh)',
  deskripsiDashboard:
    'Template anggaran (8 kartu): 4 KPI pagu/serapan, tabel rinci per program, bar perbandingan, dan catatan anggaran. Angka bersifat contoh dan dapat diganti dengan data resmi.',
  widgets: [
    kpi('Pagu Anggaran', 'Total alokasi periode ini', '320,0', 'Miliar Rp', 0, 'tetap', [320, 320, 320, 320, 320, 320]),
    kpi('Realisasi Anggaran', 'Belanja sudah terealisasi', '268,4', 'Miliar Rp', 5.6, 'dari bulan lalu', [190, 205, 220, 236, 252, 268.4], 288, 'Target'),
    kpi('Sisa Anggaran', 'Belum terserap', '51,6', 'Miliar Rp', -5.6, 'dari bulan lalu', [130, 115, 100, 84, 68, 51.6]),
    kpi('Serapan Anggaran', 'Realisasi terhadap pagu', 83.9, '%', 3.4, 'dari bulan lalu', [59, 64, 69, 74, 79, 83.9], 90, 'Target'),

    tabel('Realisasi per Program', 'Pagu, realisasi, dan sisa tiap program', { w: 12, h: 3 }, [
      { key: 'program', label: 'Program' },
      { key: 'pagu', label: 'Pagu (Miliar Rp)', format: 'number' },
      { key: 'realisasi', label: 'Realisasi (Miliar Rp)', format: 'number' },
      { key: 'serapan', label: 'Serapan (%)', format: 'percent' },
      { key: 'status', label: 'Status' },
    ], [
      { program: 'Operasional layanan', pagu: 140, realisasi: 126.4, serapan: 90.3, status: 'Sesuai jadwal' },
      { program: 'Pemeliharaan aset', pagu: 80, realisasi: 61.2, serapan: 76.5, status: 'Perlu percepatan' },
      { program: 'Pengembangan layanan', pagu: 60, realisasi: 45.8, serapan: 76.3, status: 'Perlu percepatan' },
      { program: 'Peningkatan SDM', pagu: 40, realisasi: 35, serapan: 87.5, status: 'Sesuai jadwal' },
    ]),
    grafik('bar', 'Pagu vs Realisasi per Program', 'Satuan miliar rupiah', { w: 6, h: 4 },
      ['Operasional', 'Pemeliharaan', 'Pengembangan', 'SDM'],
      [
        { name: 'Pagu', data: [140, 80, 60, 40], kind: 'bar' },
        { name: 'Realisasi', data: [126.4, 61.2, 45.8, 35], kind: 'bar' },
      ], 'Miliar Rp'),
    w('gauge', 'Serapan Anggaran Keseluruhan', 'Terhadap pagu 320 miliar', { w: 5, h: 4 }, {
      chart: { xAxis: ['Serapan'], series: [{ name: 'Serapan', data: [83.9] }], unit: '%', min: 0, max: 100, showLegend: false },
    }),

    narasi('Catatan Anggaran', 'Yang perlu diputuskan pimpinan', { w: 12, h: 3 },
      'Contoh catatan: serapan 83,9% masih di bawah target 90%. Dua program (pemeliharaan aset dan pengembangan layanan) tertinggal karena pengadaan belum selesai. ' +
      'Bila tidak dipercepat, sisa anggaran 51,6 miliar berisiko tidak terserap pada akhir tahun.',
      [
        'Serapan 83,9%; target 90% — selisih 6,1 poin.',
        'Dua program perlu percepatan pengadaan.',
        'Sisa anggaran 51,6 miliar, tersebar di empat program.',
      ]),
  ],
};

// ============================================================================
// 5. PELANGGAN & LAYANAN — komposisi dan sebaran (8 kartu)
// ============================================================================
const TEMPLATE_PELANGGAN: DashboardTemplate = {
  id: 'tpl-pelanggan',
  nama: 'Pelanggan & Layanan',
  tujuan:
    'Memahami siapa yang dilayani, bagaimana sebarannya, dan seberapa baik mutu layanan yang dirasakan.',
  caraPenyampaian:
    'Komposisi & sebaran: KPI pelanggan di atas, donut segmen, peta wilayah, tabel keluhan, lalu catatan layanan — cocok untuk presentasi.',
  deskripsi: 'Komposisi pelanggan, sebaran wilayah, dan mutu layanan.',
  fokus: ['Jumlah pelanggan', 'Segmen', 'Sebaran wilayah', 'Keluhan'],
  aksen: '#ec4899',
  judulDashboard: 'Pelanggan & Layanan (Contoh)',
  deskripsiDashboard:
    'Template pelanggan & layanan (8 kartu): 4 KPI, komposisi segmen, sebaran wilayah, rincian keluhan, dan catatan layanan. Angka bersifat contoh dan dapat diganti dengan data resmi.',
  widgets: [
    kpi('Jumlah Pelanggan', 'Pelanggan aktif terlayani', '148.650', 'pelanggan', 2.2, '3.200 pelanggan baru', [140200, 142100, 143900, 145800, 147200, 148650]),
    kpi('Pelanggan Baru', 'Penambahan periode ini', '3.200', 'pelanggan', 8.4, 'dari periode lalu', [2100, 2300, 2500, 2700, 2950, 3200], 3000, 'Target'),
    kpi('Keluhan Selesai', 'Terhadap keluhan masuk', 96.2, '%', 1.4, 'dari periode lalu', [92, 93, 94, 94.8, 95.4, 96.2], 95, 'Target'),
    kpi('Indeks Kepuasan', 'Skala 0-100', 82.4, 'poin', 1.8, '+1,8 poin', [78, 79, 80, 81, 81.8, 82.4], 85, 'Target'),

    w('donut', 'Komposisi Pelanggan per Segmen', 'Porsi tiap segmen', { w: 6, h: 4 }, {
      chart: {
        xAxis: ['Rumah Tangga', 'Usaha Kecil', 'Usaha Besar', 'Instansi'],
        series: [{ name: 'Porsi', data: [68, 19, 8, 5] }],
        unit: '%',
        showLegend: true,
      },
    }),
    w('map', 'Sebaran Pelanggan per Wilayah', 'Jumlah pelanggan tiap wilayah', { w: 6, h: 4 }, {
      geo: {
        mapName: 'indonesia',
        regions: [
          { name: 'Wilayah 1', value: 38240 },
          { name: 'Wilayah 2', value: 34120 },
          { name: 'Wilayah 3', value: 29680 },
          { name: 'Wilayah 4', value: 25410 },
          { name: 'Wilayah 5', value: 21200 },
        ],
      },
    }),

    tabel('Rincian Keluhan & Penyelesaian', 'Per jenis keluhan', { w: 12, h: 3 }, [
      { key: 'jenis', label: 'Jenis keluhan' },
      { key: 'masuk', label: 'Masuk', format: 'number' },
      { key: 'selesai', label: 'Selesai', format: 'number' },
      { key: 'rataHari', label: 'Rata-rata (hari)', format: 'number' },
      { key: 'status', label: 'Status' },
    ], [
      { jenis: 'Aliran terganggu', masuk: 142, selesai: 139, rataHari: 1.2, status: 'Baik' },
      { jenis: 'Tekanan rendah', masuk: 98, selesai: 92, rataHari: 1.8, status: 'Baik' },
      { jenis: 'Meter bermasalah', masuk: 76, selesai: 70, rataHari: 2.4, status: 'Perlu perhatian' },
      { jenis: 'Tagihan tidak sesuai', masuk: 54, selesai: 51, rataHari: 3.1, status: 'Perlu perhatian' },
    ]),
    narasi('Catatan Layanan', 'Ringkas untuk manajemen', { w: 12, h: 3 },
      'Contoh catatan: pelanggan tumbuh 2,2% dengan tambahan 3.200 pelanggan baru. Kepuasan naik ke 82,4 poin, masih dua setengah poin di bawah target. ' +
      'Keluhan terbanyak tetap soal aliran dan tekanan; penyelesaian rata-rata 1-2 hari, sementara keluhan tagihan butuh waktu lebih lama.',
      [
        'Pelanggan aktif 148.650; 68% rumah tangga.',
        '96,2% keluhan selesai, rata-rata 1-3 hari.',
        'Kepuasan 82,4 poin dari target 85.',
      ]),
  ],
};

// ============================================================================
// 6. RISIKO, KEPATUHAN & AUDIT — papan status (8 kartu)
// ============================================================================
const TEMPLATE_RISIKO: DashboardTemplate = {
  id: 'tpl-risiko',
  nama: 'Risiko, Kepatuhan & Audit',
  tujuan:
    'Memantau risiko, temuan audit, dan tindak lanjutnya agar masalah yang sama tidak berulang.',
  caraPenyampaian:
    'Papan status: KPI temuan di atas, matriks risiko, status tindak lanjut, daftar temuan bertenggat, lalu catatan kepatuhan.',
  deskripsi: 'Matriks risiko, daftar temuan audit, dan progres tindak lanjut.',
  fokus: ['Temuan audit', 'Tindak lanjut', 'Risiko tinggi', 'Kepatuhan'],
  aksen: '#ef4444',
  judulDashboard: 'Risiko, Kepatuhan & Audit (Contoh)',
  deskripsiDashboard:
    'Template risiko & audit (8 kartu): 4 KPI, matriks risiko, status tindak lanjut, daftar temuan, dan catatan kepatuhan. Angka bersifat contoh dan dapat diganti dengan data resmi.',
  widgets: [
    kpi('Temuan Audit Terbuka', 'Belum ditindaklanjuti', 12, 'temuan', -4, '-4 dari periode lalu', [22, 20, 18, 16, 14, 12], 0, 'Target'),
    kpi('Tindak Lanjut Selesai', 'Terhadap total rekomendasi', 78.5, '%', 6.2, 'dari periode lalu', [58, 62, 66, 70, 74, 78.5], 90, 'Target'),
    kpi('Risiko Tinggi', 'Terdaftar pada matriks risiko', 4, 'risiko', undefined, 'turun 1 dari periode lalu', [7, 7, 6, 5, 5, 4], 2, 'Target'),
    kpi('Indeks Kepatuhan', 'Kepatuhan prosedur & regulasi', 92.3, '%', 1.5, 'dari periode lalu', [88, 89, 90, 90.8, 91.6, 92.3], 95, 'Target'),

    w('heatmap', 'Matriks Risiko (Dampak x Kemungkinan)', 'Jumlah risiko per sel', { w: 6, h: 4 }, {
      heatmap: {
        rows: ['Dampak Tinggi', 'Dampak Sedang', 'Dampak Rendah'],
        columns: ['Jarang', 'Mungkin', 'Sering'],
        data: [
          [1, 2, 4],
          [2, 3, 5],
          [4, 3, 2],
        ],
        unit: 'risiko',
      },
    }),
    grafik('bar', 'Status Tindak Lanjut', 'Rekomendasi audit per status', { w: 6, h: 4 },
      ['Selesai', 'Berjalan', 'Belum mulai', 'Lewat tenggat'],
      [{ name: 'Rekomendasi', data: [94, 18, 8, 4] }], 'rekomendasi', { showLegend: false }),

    tabel('Daftar Temuan Audit', 'Diurutkan dari tenggat terdekat', { w: 12, h: 3 }, [
      { key: 'temuan', label: 'Temuan' },
      { key: 'kategori', label: 'Kategori' },
      { key: 'nilai', label: 'Nilai (Juta Rp)', format: 'number' },
      { key: 'tenggat', label: 'Tenggat' },
      { key: 'status', label: 'Status' },
    ], [
      { temuan: 'Dokumen pengadaan tidak lengkap', kategori: 'Kepatuhan', nilai: 1250, tenggat: '30 hari', status: 'Berjalan' },
      { temuan: 'Pencatatan aset belum mutakhir', kategori: 'Administrasi', nilai: 860, tenggat: '45 hari', status: 'Berjalan' },
      { temuan: 'Rekonsiliasi piutang terlambat', kategori: 'Keuangan', nilai: 420, tenggat: 'Lewat 10 hari', status: 'Lewat tenggat' },
    ]),
    narasi('Catatan Kepatuhan', 'Ringkas untuk pimpinan', { w: 12, h: 3 },
      'Contoh catatan: temuan terbuka turun menjadi 12 dan tindak lanjut selesai naik ke 78,5%. Satu temuan sudah lewat tenggat dan perlu keputusan pimpinan. ' +
      'Risiko tinggi tersisa 4, seluruhnya terkait pengadaan dan pencatatan aset.',
      [
        'Temuan terbuka 12; 4 di antaranya lewat tenggat.',
        'Tindak lanjut selesai 78,5% dari target 90%.',
        'Risiko tinggi 4, terkait pengadaan dan aset.',
      ]),
  ],
};

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  TEMPLATE_RINGKASAN,
  TEMPLATE_PEMANTAUAN,
  TEMPLATE_LAPORAN,
  TEMPLATE_ANGGARAN,
  TEMPLATE_PELANGGAN,
  TEMPLATE_RISIKO,
];

/** Cari template berdasarkan id (dipakai halaman galeri). */
export function templateBerdasarkanId(id: string): DashboardTemplate | undefined {
  return DASHBOARD_TEMPLATES.find((t) => t.id === id);
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
    id: `tpl-${template.id}-${seed}-${i + 1}`,
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
