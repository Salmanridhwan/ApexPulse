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
    'Memberi pimpinan gambaran menyeluruh dalam satu layar: saldo kas, pendapatan, beban, laba, tren bulanan, komposisi beban, transaksi terbaru, arus kas, dan progres target — tanpa membuka laporan.',
  caraPenyampaian:
    'Satu halaman gelap dengan satu aksen oranye: 4 kartu KPI berikon + sparkline, grafik batang pendapatan, cincin rincian beban dengan total di tengah, daftar transaksi, area arus kas, batang progres target, lalu strip insight. Selesai dibaca di bawah dua menit.',
  deskripsi: 'Satu layar untuk pimpinan: KPI, tren, komposisi, transaksi, arus kas, dan progres target.',
  fokus: ['Saldo & laba', 'Tren pendapatan', 'Komposisi beban', 'Arus kas', 'Progres target'],
  aksen: '#1fa6cc',
  judulDashboard: 'Ringkasan Eksekutif (Contoh)',
  deskripsiDashboard:
    'Tampilan contoh mengikuti referensi desain: 4 KPI berikon, grafik batang pendapatan, cincin rincian beban, transaksi terbaru, area arus kas, progres target, dan strip insight. Seluruh angka ilustrasi.',
  widgets: [
    kpi('Pendapatan Usaha', 'Realisasi periode ini', '128,4', 'Miliar Rp', 6.8, 'vs target', [110, 113, 116, 120, 124, 128.4]),
    kpi('Laba Bersih', 'Setelah beban usaha', '23,7', 'Miliar Rp', 4.2, 'YoY', [19, 20, 21, 21.8, 22.6, 23.7]),
    kpi('Beban Operasional', 'Terhadap pagu', '96,2', 'Miliar Rp', -1.4, 'dari pagu', [99, 98.4, 97.8, 97.1, 96.8, 96.2]),
    kpi('Realisasi Anggaran', 'Serapan belanja', 87.5, '%', 3.1, 'dari triwulan lalu', [78, 80, 82, 84, 86, 87.5]),
    kpi('Indeks Kepuasan Layanan', 'Skala 0–100', 82.4, 'poin', undefined, 'naik 1,8 poin', [78, 79, 80, 81, 81.8, 82.4]),
    kpi('Temuan Audit Terbuka', 'Belum ditutup', 12, 'temuan', undefined, 'turun 4 dari semester lalu', [22, 20, 18, 16, 14, 12]),

    // Baris kedua mengikuti pola "grafik besar + cincin komposisi" seperti
    // dashboard keuangan pada referensi: tren di kiri (2/3), komposisi di kanan (1/3).
    grafik('line', 'Tren Pendapatan & Beban', 'Bulanan, satuan miliar rupiah', { w: 8, h: 4 }, BULAN, [
      { name: 'Pendapatan', data: [98, 101, 104, 107, 110, 113, 116, 119, 122, 124, 126, 128.4] },
      { name: 'Beban', data: [88, 90, 91, 92, 93, 94, 94.6, 95, 95.4, 95.8, 96, 96.2], kind: 'line' },
    ], 'Miliar Rp'),
    w('donut', 'Komposisi Pendapatan', 'Nilai tiap sumber, miliar rupiah', { w: 4, h: 4 }, {
      chart: {
        xAxis: ['Air minum', 'Sambungan baru', 'Non-air', 'Lain-lain'],
        // Nilai absolut (bukan persen) supaya TOTAL di tengah cincin bermakna:
        // jumlahnya sama dengan KPI "Pendapatan Usaha" (128,4 miliar).
        series: [{ name: 'Pendapatan', data: [92.4, 18, 11.6, 6.4] }],
        unit: 'Miliar Rp',
        showLegend: true,
      },
    }),

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
// 2. KINERJA OPERASIONAL HARIAN — papan pemantauan harian (8 kartu)
// ============================================================================
const TEMPLATE_KINERJA: DashboardTemplate = {
  id: 'tpl-kinerja',
  nama: 'Kinerja Operasional Harian',
  tujuan:
    'Memantau kinerja harian: pendapatan, laba kotor dan bersih, jumlah transaksi, rata-rata tagihan, kehilangan air, biaya pokok, metode pembayaran, dan capaian tahun berjalan.',
  caraPenyampaian:
    'Gaya biru-navy dengan aksen emas: enam kartu KPI bersparkline di baris atas, lalu tren harian dua seri (minggu ini vs minggu lalu), komposisi pendapatan per segmen, kategori pendapatan teratas, enam kartu metrik biaya ringkas, peta panas pemakaian per hari × jam, metode pembayaran, dan ringkasan tahun berjalan.',
  deskripsi: 'Papan pemantauan harian: 6 KPI, tren, segmen, kategori, biaya, peta panas, dan capaian tahun berjalan.',
  fokus: ['Pendapatan harian', 'Margin & laba', 'Biaya pokok', 'Kehilangan air', 'Capaian tahun berjalan'],
  aksen: '#d6a54a',
  judulDashboard: 'Kinerja Operasional Harian (Contoh)',
  deskripsiDashboard:
    'Tampilan contoh mengikuti referensi kedua: 6 KPI bersparkline, tren harian dua seri, komposisi segmen, kategori teratas, 6 metrik biaya, peta panas pemakaian, metode pembayaran, dan ringkasan tahun berjalan. Seluruh angka ilustrasi.',
  widgets: [
    kpi('Total Pendapatan', 'Dibanding kemarin', '245,6', 'juta Rp', 12.45, 'vs kemarin', [30, 34, 32, 38, 41, 39, 45, 48, 46, 52]),
    kpi('Laba Kotor', 'Margin 71,93%', '176,5', 'juta Rp', 9.1, 'vs kemarin', [22, 25, 24, 28, 30, 29, 33, 35, 34, 38]),
    kpi('Laba Bersih', 'Margin 31,88%', '78,2', 'juta Rp', 6.42, 'vs kemarin', [12, 13, 12.5, 15, 16, 15.5, 18, 19, 18.5, 21]),
    kpi('Transaksi', 'Jumlah transaksi hari ini', 356, 'transaksi', 8.21, 'vs kemarin', [40, 44, 42, 48, 51, 49, 55, 58, 56, 62]),
    kpi('Rata-rata Tagihan', 'Per transaksi', '68.880', 'Rp', 3.91, 'vs kemarin', [18, 19, 18.6, 20, 21, 20.4, 22, 23, 22.6, 24]),
    kpi('Kehilangan Air', 'Terhadap produksi', 28.45, '%', -1.03, 'vs kemarin', [34, 33.4, 33.8, 32, 31.5, 31.8, 30.4, 29.6, 29.2, 28.45]),

    grafik('line', 'Tren Pendapatan Harian', 'Minggu ini dibanding minggu lalu, juta rupiah', { w: 8, h: 4 }, ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'], [
      { name: 'Minggu ini', data: [148, 162, 155, 178, 190, 212, 245.6] },
      { name: 'Minggu lalu', data: [132, 141, 138, 152, 160, 174, 189], kind: 'line' },
    ], 'Juta Rp'),
    w('donut', 'Pendapatan per Segmen', 'Porsi tiap jenis pelanggan, persen', { w: 4, h: 4 }, {
      chart: {
        xAxis: ['Rumah Tangga', 'Niaga', 'Industri', 'Instansi'],
        series: [{ name: 'Pendapatan', data: [40.1, 22.9, 25.8, 11.2] }],
        unit: '%',
        showLegend: true,
      },
    }),
  ],
};

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [TEMPLATE_RINGKASAN, TEMPLATE_KINERJA];

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
