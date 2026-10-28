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
  /**
   * Kunci tema visual (kelas CSS `.tema-<kunci>` di index.css). Dashboard yang
   * dibuat dari template ini memakai tema tersebut, sehingga hasil nyatanya
   * berlatar, berwarna kartu, dan beraksen sama dengan pratinjau.
   */
  tema: string;
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
  tema: 'oranye',
  judulDashboard: 'Ringkasan Eksekutif (Contoh)',
  deskripsiDashboard:
    'Empat KPI berikon, grafik batang pendapatan, cincin rincian beban dengan total di tengah, daftar transaksi terbaru, area arus kas, tiga bar progres target, dan strip insight — seluruhnya dalam satu layar. Seluruh angka ilustrasi.',
  widgets: [
    // ── Baris 1: empat KPI berikon + sparkline (persis susunan pratinjau) ──
    { ...kpi('Total Saldo Kas', 'Saldo kas & bank', '48.750', 'juta Rp', 12.4, 'vs bulan lalu', [39.1, 40.4, 42, 43.8, 46.2, 48.75]), ikon: 'wallet' },
    { ...kpi('Pendapatan Usaha', 'Realisasi tahun berjalan', '23.685', 'juta Rp', 8.2, 'vs tahun lalu', [18.4, 19.2, 20.1, 21.4, 22.6, 23.685]), ikon: 'trending-up' },
    { ...kpi('Beban Operasional', 'Terhadap pagu', '12.347', 'juta Rp', -3.4, 'vs tahun lalu', [13.9, 13.4, 13.1, 12.9, 12.6, 12.347]), ikon: 'trending-down' },
    { ...kpi('Laba Bersih', 'Setelah beban usaha', '11.337', 'juta Rp', 6.1, 'vs tahun lalu', [8.4, 8.9, 9.6, 10.2, 10.8, 11.337]), ikon: 'coins' },

    // ── Baris 2: grafik batang pendapatan (2/3) + cincin komposisi beban (1/3) ──
    grafik('bar', 'Ikhtisar Pendapatan', 'Pendapatan usaha per bulan, satuan miliar rupiah', { w: 8, h: 4 }, BULAN,
      [{ name: 'Pendapatan', data: [14.2, 15.6, 16.1, 17.4, 19.8, 18.6, 20.2, 21.1, 20.4, 22.3, 23, 23.7] }],
      'Miliar Rp', { showLegend: false }),
    w('donut', 'Rincian Beban', 'Komposisi beban operasional', { w: 4, h: 4 }, {
      chart: {
        xAxis: ['Operasional', 'Pemeliharaan', 'Pegawai', 'Investasi', 'Lain-lain'],
        // Nilai absolut (miliar) supaya total di tengah cincin bermakna: 12,35.
        series: [{ name: 'Beban', data: [3.2, 2.85, 2.45, 2.1, 1.75] }],
        unit: 'Miliar Rp',
        showLegend: true,
      },
    }),

    // ── Baris 3: daftar transaksi, arus kas, dan progres target ──
    w('table', 'Transaksi Terbaru', 'Tiga transaksi terakhir', { w: 4, h: 5 }, {
      table: {
        columns: [
          { key: 'keterangan', label: 'Keterangan', format: 'text' },
          { key: 'jumlah', label: 'Jumlah', format: 'text' },
        ],
        rows: [
          { keterangan: 'Pembayaran pelanggan', jumlah: '+1,24 jt' },
          { keterangan: 'Pemeliharaan jaringan', jumlah: '-486 jt' },
          { keterangan: 'Setoran kas ke bank', jumlah: '+2,10 jt' },
        ],
      },
    }),
    grafik('area', 'Arus Kas', 'Arus kas bersih 29 hari terakhir', { w: 4, h: 5 },
      ['1', '4', '7', '10', '13', '16', '19', '22', '25', '29'],
      [{ name: 'Arus kas bersih', data: [3.2, 4.1, 5.4, 6.8, 7.2, 9.4, 11.2, 13.6, 16.4, 19.6] }],
      'Miliar Rp', { showLegend: false }),
    w('bullet-target', 'Progres Target', 'Capaian terhadap target periode', { w: 4, h: 5 }, {
      kpi: {
        value: 86,
        unit: '%',
        deltaLabel: 'Capaian target',
        targets: [
          { label: 'Target Pendapatan', persen: 86, status: 'mendekati' },
          { label: 'Efisiensi Beban', persen: 92, status: 'sesuai' },
          { label: 'Target Laba Bersih', persen: 57, status: 'perhatian' },
        ],
      },
    }),

    // ── Baris 4: strip insight ──
    narasi('Insight Keuangan', 'Tiga hal yang perlu diketahui pimpinan', { w: 12, h: 3 },
      'Pendapatan tumbuh 8,2% sementara beban turun 3,4% — margin bersih naik ke 32,1%. Perhatian utama pada realisasi investasi yang baru 57% dari target.',
      [
        'Pendapatan tumbuh 8,2%; beban turun 3,4%.',
        'Margin bersih naik ke 32,1%.',
        'Realisasi investasi baru 57% dari target — perlu percepatan.',
      ]),
  ],
};

// ============================================================================
// 2. ANALITIK BISNIS HARIAN — papan analitik penjualan & kunjungan (8 kartu)
// ============================================================================
const TEMPLATE_ANALITIK: DashboardTemplate = {
  id: 'tpl-analitik',
  nama: 'Analitik Bisnis Harian',
  tujuan:
    'Memantau kinerja bisnis harian: pendapatan, jumlah pesanan, pengguna, rasio konversi, status pesanan, sumber kunjungan, pesanan terbaru, nilai pesanan per kategori, pesanan per jam, metode pembayaran, dan tren konversi.',
  caraPenyampaian:
    'Gaya navy gelap dengan lima aksen (biru, teal, ungu, oranye, pink): empat kartu KPI bersparkline di baris atas, grafik area pendapatan harian, batang pesanan per status, cincin sumber kunjungan dengan legenda di samping, tabel pesanan terbaru, batang mendatar nilai pesanan per kategori, batang pesanan per jam, cincin metode pembayaran, dan garis tren konversi dengan garis rata-rata.',
  deskripsi: 'Papan analitik: 4 KPI, tren pendapatan, status pesanan, sumber kunjungan, tabel, kategori, per jam, pembayaran, konversi.',
  fokus: ['Pendapatan harian', 'Pesanan & status', 'Sumber kunjungan', 'Nilai per kategori', 'Metode pembayaran'],
  aksen: '#3b82f6',
  tema: 'analitik',
  judulDashboard: 'Analitik Bisnis Harian (Contoh)',
  deskripsiDashboard:
    'Tampilan contoh mengikuti referensi kedua: 4 KPI bersparkline, area pendapatan harian, batang pesanan per status, cincin sumber kunjungan, tabel pesanan terbaru, batang nilai pesanan per kategori, batang pesanan per jam, cincin metode pembayaran, dan garis tren konversi. Seluruh angka ilustrasi.',
  widgets: [
    kpi('Pendapatan', 'vs 12 Apr – 11 Mei', '128.430', 'Rp', 12.5, 'vs 12 Apr – 11 Mei', [30, 34, 31, 38, 36, 42, 40, 47, 45, 52]),
    kpi('Pesanan', 'vs 12 Apr – 11 Mei', '1.542', 'pesanan', 8.3, 'vs 12 Apr – 11 Mei', [20, 24, 22, 28, 26, 31, 29, 35, 33, 38]),
    kpi('Pengguna', 'vs 12 Apr – 11 Mei', '8.458', 'pengguna', 15.7, 'vs 12 Apr – 11 Mei', [18, 22, 21, 27, 26, 32, 31, 37, 36, 43]),
    kpi('Rasio Konversi', 'vs 12 Apr – 11 Mei', 3.27, '%', 5.4, 'vs 12 Apr – 11 Mei', [26, 24, 28, 27, 31, 29, 33, 32, 36, 34]),

    grafik('line', 'Ikhtisar Pendapatan', 'Pendapatan harian, 12 Mei – 10 Jun 2024', { w: 8, h: 4 }, [
      '12 Mei', '14 Mei', '16 Mei', '18 Mei', '20 Mei', '22 Mei', '24 Mei', '26 Mei', '28 Mei', '30 Mei', '1 Jun', '3 Jun', '5 Jun', '7 Jun', '10 Jun',
    ], [{ name: 'Pendapatan', data: [8.2, 8.7, 10.2, 11.8, 12.4, 13.2, 14.1, 15.2, 16.4, 17.3, 18.2, 19.1, 20.4, 22.1, 25.9] }], 'Juta Rp'),

    grafik('bar', 'Pesanan per Status', 'Jumlah pesanan bulan ini', { w: 4, h: 4 }, ['Selesai', 'Diproses', 'Dikirim', 'Dibatalkan', 'Dikembalikan'], [
      { name: 'Pesanan', data: [820, 420, 160, 90, 32] },
    ], 'pesanan'),

    w('donut', 'Sumber Kunjungan', 'Porsi kunjungan bulan ini, persen', { w: 4, h: 4 }, {
      chart: {
        xAxis: ['Langsung', 'Pencarian Organik', 'Media Sosial', 'Rujukan', 'Email'],
        series: [{ name: 'Kunjungan', data: [32.6, 28.4, 18.7, 12.3, 8.0] }],
        unit: '%',
        showLegend: true,
      },
    }),

    grafik('bar', 'Nilai Pesanan per Kategori', 'Nilai pesanan (Rp) per kategori, bulan ini', { w: 4, h: 4 }, [
      'Elektronik', 'Fesyen', 'Rumah & Dapur', 'Kecantikan', 'Olahraga', 'Lainnya',
    ], [{ name: 'Nilai', data: [48920, 32480, 18760, 15240, 9030, 4000] }], 'Rp'),

    grafik('bar', 'Pesanan per Jam', 'Sebaran 1.542 pesanan menurut jam', { w: 4, h: 4 }, [
      '00', '03', '06', '09', '12', '15', '18', '21',
    ], [
      {
        name: 'Pesanan',
        data: [12, 16, 43, 101, 117, 81, 80, 60],
      },
    ], 'pesanan'),

    w('donut', 'Metode Pembayaran', 'Jumlah pesanan per metode, bulan ini', { w: 4, h: 4 }, {
      chart: {
        xAxis: ['Transfer Bank', 'Kartu Kredit', 'E-Wallet', 'COD', 'Cicilan'],
        series: [{ name: 'Pesanan', data: [612, 385, 342, 141, 62] }],
        unit: 'pesanan',
        showLegend: true,
      },
    }),

    grafik('line', 'Tren Konversi', 'Rasio konversi harian, 12 Mei – 10 Jun 2024', { w: 4, h: 4 }, [
      '12 Mei', '18 Mei', '24 Mei', '30 Mei', '5 Jun', '10 Jun',
    ], [{ name: 'Konversi', data: [2.9, 3.4, 3.1, 3.6, 3.4, 3.27] }], '%'),

    narasi(
      'Ringkasan',
      'Kesimpulan cepat dari angka contoh di atas',
      { w: 8, h: 3 },
      'Pendapatan naik 18,2% dibanding periode lalu dan konversi membaik 5,4%. Kanal pencarian organik menyumbang 28,4% kunjungan, sementara 820 dari 1.522 pesanan sudah selesai.',
      ['Selesaikan 90 pesanan yang dibatalkan akar penyebabnya.', 'Dorong kanal email yang baru 8% kunjungan.'],
    ),
  ],
};

// ============================================================================
// 3. TRAFIK WEB & PERILAKU PENGUNJUNG — papan analitik situs (8 kartu)
// ============================================================================
const TEMPLATE_TRAFIK: DashboardTemplate = {
  id: 'tpl-trafik',
  nama: 'Trafik Web & Perilaku',
  tujuan:
    'Memantau trafik situs dan perilaku pengunjung: rasio pentalan, kedalaman halaman, waktu di situs, pengunjung baru, sumber trafik, dinamika relevansi, komposisi usia, halaman populer, jenis perangkat, sistem operasi, dan frasa pencarian.',
  caraPenyampaian:
    'Gaya gelap-netral dengan lima warna kategori: lima kartu KPI bersparkline, grafik batang bertumpuk sumber trafik 31 hari dengan legenda di samping, garis dinamika relevansi, komposisi usia, daftar halaman populer, batang jenis perangkat, cincin faktor perilaku, area sistem operasi bertanda tren, dan daftar frasa pencarian.',
  deskripsi: 'Papan trafik: 5 KPI, sumber trafik, relevansi, usia, halaman, perangkat, perilaku, OS, frasa pencarian.',
  fokus: ['Sumber trafik', 'Perilaku pengunjung', 'Usia & perangkat', 'Halaman populer', 'Frasa pencarian'],
  aksen: '#22d3ee',
  tema: 'trafik',
  judulDashboard: 'Trafik Web & Perilaku (Contoh)',
  deskripsiDashboard:
    'Tampilan contoh mengikuti referensi ketiga: 5 KPI bersparkline, batang sumber trafik, garis relevansi, komposisi usia, halaman populer, cincin perangkat, alat ukur perilaku, sistem operasi, dan frasa pencarian. Seluruh angka ilustrasi.',
  widgets: [
    kpi('Rasio Pentalan', 'Persen kunjungan sekali lihat', 57, '%', 1, 'vs periode lalu', [52, 54, 53, 56, 55, 58, 57, 59, 56, 57]),
    kpi('Kedalaman Halaman', 'Halaman per kunjungan', 1.45, 'halaman', 0.05, 'vs periode lalu', [1.2, 1.25, 1.3, 1.28, 1.35, 1.4, 1.38, 1.42, 1.44, 1.45]),
    kpi('Waktu di Situs', 'Rata-rata durasi kunjungan', 4.9, 'menit', 1, 'vs periode lalu', [3.6, 3.9, 3.8, 4.1, 4.3, 4.2, 4.5, 4.6, 4.8, 4.9]),
    kpi('Pengunjung', 'Total pengunjung unik', '1.120', 'orang', 11, 'vs periode lalu', [980, 1010, 990, 1040, 1060, 1050, 1080, 1090, 1110, 1120]),
    kpi('Pengunjung Baru', 'Pengunjung pertama kali', 340, 'orang', -24, 'vs periode lalu', [380, 372, 366, 360, 356, 350, 348, 344, 342, 340]),

    grafik('bar', 'Sumber Trafik', 'Jumlah pengunjung per hari, 1–31 Januari 2023', { w: 8, h: 4 }, [
      '01.01', '05.01', '10.01', '15.01', '20.01', '25.01', '31.01',
    ], [
      { name: 'Mesin Pencari', data: [8, 20, 36, 62, 36, 14, 6] },
      { name: 'Iklan', data: [2, 3, 5, 9, 5, 2, 1] },
      { name: 'Media Sosial', data: [1, 3, 5, 8, 5, 2, 1] },
      { name: 'Akses Langsung', data: [0, 1, 1, 2, 1, 0, 0] },
    ], 'pengunjung'),

    grafik('line', 'Dinamika Relevansi', 'Poin relevansi harian', { w: 4, h: 4 }, [
      '01.01', '08.01', '15.01', '22.01', '31.01',
    ], [{ name: 'Relevansi', data: [42, 52, 62, 55, 46] }], 'poin'),

    w('donut', 'Jenis Perangkat', 'Porsi kunjungan per perangkat, persen', { w: 4, h: 4 }, {
      chart: {
        xAxis: ['PC', 'Ponsel', 'Tablet'],
        series: [{ name: 'Kunjungan', data: [69.7, 29.0, 1.3] }],
        unit: '%',
        showLegend: true,
      },
    }),

    narasi(
      'Ringkasan',
      'Kesimpulan cepat dari angka contoh di atas',
      { w: 8, h: 3 },
      'Trafik memuncak di pertengahan Januari dengan mesin pencari sebagai sumber utama. Pengunjung bertambah 11 orang, tetapi pengunjung baru turun 24 orang sehingga pemerolehan kanal baru perlu didorong.',
      ['Naikkan porsi pengunjung baru lewat kanal sosial.', 'Pertahankan halaman /program-federal yang menyumbang 40,3%.'],
    ),
  ],
};

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [TEMPLATE_RINGKASAN, TEMPLATE_ANALITIK, TEMPLATE_TRAFIK];

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
