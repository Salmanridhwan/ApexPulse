import type { WidgetSpec, WidgetType } from '../../types';
import type { DashboardTemplate } from './dashboardTemplates';

/**
 * TEMPLATE RAPAT MANAJEMEN PER BAGIAN.
 *
 * Diturunkan dari deck "Management Meeting 2026 / RKA 2027" (General Support,
 * Outsourcing, Procurement, Construction, Asrama Mahasiswa, Marketing & Sales).
 * Satu template = satu deck: tiap halaman dashboard = satu kelompok slide
 * (Executive Summary, kinerja inti, biaya, isu & action plan, Target & KPI 2027).
 * Cover, agenda, dan closing tidak dijadikan halaman.
 *
 * Semua kartu memakai chart dari menu Template Chart (`chartId`) dengan gaya
 * Korporat, jadi pratinjau, dashboard tersimpan, dan Template Chart sama persis.
 * Angka di sini ANGKA CONTOH; dashboard nyata diisi dari dokumen instansi.
 */

export const PREFIKS_TEMPLATE_BAGIAN = 'tpl-bagian-';

export interface HalamanBagian {
  judul: string;
  sub: string;
  /** Jumlah kartu halaman ini, berurutan dalam `widgets` template. */
  jumlah: number;
}

export interface InfoBagian {
  /** Nama bagian di kaki halaman, mis. "Meeting Bagian Procurement". */
  unit: string;
  halaman: HalamanBagian[];
  /** Nama bagian di kalimat asisten yang langsung memilih template ini. */
  kunci: RegExp;
  /**
   * Kata umum (mis. "penjualan", "pengadaan") yang hanya memilih template ini
   * bila kalimatnya juga menyebut rapat/meeting/bagian/divisi.
   */
  kunciLemah: RegExp;
}

type Isi = Partial<WidgetSpec>;

/** Pembuat kartu untuk satu bagian; id unik per bagian. */
function pembuat(kode: string, kategori: string) {
  let n = 0;
  const kartu = (type: WidgetType, chartId: string, title: string, subtitle: string, w: number, h: number, isi: Isi = {}): WidgetSpec => {
    n += 1;
    return {
      id: `tpl-bagian-${kode}-${n}`,
      type,
      chartId,
      title,
      subtitle,
      category: kategori,
      confidence: 'inferensi AI',
      grid: { x: 0, y: 0, w, h },
      citations: [],
      lastUpdated: new Date().toISOString(),
      ...isi,
    };
  };
  return {
    /** Kartu KPI berikon bulat. */
    kpi: (title: string, subtitle: string, value: string | number, unit: string, ikon: string, delta?: number, deltaLabel = 'vs tahun lalu') =>
      kartu('kpi', 'kpi-kartu', title, subtitle, 4, 2, {
        ikon,
        kpi: { value, unit, delta, deltaLabel: delta === undefined ? subtitle : deltaLabel },
      }),
    /** Kartu sasaran KPI tahun depan: `arah` '≥' atau '≤'. */
    sasaran: (title: string, value: number, target: number, unit: string, arah: '≥' | '≤', ikon: string) =>
      kartu('kpi', 'kpi-target', title, `Sasaran ${arah} ${target.toLocaleString('id-ID')}${unit === '%' ? '%' : ` ${unit}`}`, 4, 3, {
        ikon,
        kpi: { value: value.toLocaleString('id-ID'), unit, target, targetLabel: arah },
      }),
    grafik: (
      type: WidgetType,
      chartId: string,
      title: string,
      subtitle: string,
      w: number,
      h: number,
      xAxis: string[],
      series: Array<{ name: string; data: number[]; kind?: 'bar' | 'line' }>,
      unit: string
    ) => kartu(type, chartId, title, subtitle, w, h, { chart: { xAxis, series, unit, showLegend: series.length > 1 } }),
    /** Tabel teks: kolom terakhir dibaca sebagai status oleh papan isu dan tabel berstatus. */
    tabel: (chartId: string, title: string, subtitle: string, w: number, h: number, kolom: string[], baris: Array<Array<string | number>>) =>
      kartu('table', chartId, title, subtitle, w, h, {
        table: {
          columns: kolom.map((label, i) => ({ key: `k${i}`, label, format: 'text' as const })),
          rows: baris.map((b) => Object.fromEntries(b.map((v, i) => [`k${i}`, v]))),
        },
      }),
    narasi: (title: string, text: string, w = 12, h = 2) => kartu('narasi', 'narasi-insight', title, 'Ringkasan rapat', w, h, { narasi: { text } }),
  };
}

const TAHUN = ['2024', '2025', 'Outlook 2026', 'RKA 2027'];

interface Rancangan {
  kode: string;
  nama: string;
  judulDashboard: string;
  unit: string;
  tujuan: string;
  fokus: string[];
  kunci: RegExp;
  kunciLemah: RegExp;
  halaman: Array<{ judul: string; sub: string; kartu: WidgetSpec[] }>;
}

function jadikan(r: Rancangan): DashboardTemplate {
  const widgets = r.halaman.flatMap((h) => h.kartu);
  const jumlahHal = r.halaman.length;
  return {
    id: `${PREFIKS_TEMPLATE_BAGIAN}${r.kode}`,
    nama: r.nama,
    tujuan: r.tujuan,
    caraPenyampaian: `Gaya Korporat dari menu Template Chart, ${jumlahHal} halaman seperti deck rapat: ${r.halaman.map((h) => h.judul).join(', ')}.`,
    deskripsi: `Rapat manajemen ${r.nama}: ${r.fokus.slice(0, 3).join(', ').toLowerCase()}, isu, action plan, dan KPI 2027.`,
    fokus: r.fokus,
    aksen: '#1e6fd9',
    tema: 'korporat',
    judulDashboard: r.judulDashboard,
    deskripsiDashboard: `Dashboard rapat manajemen ${r.nama} ${jumlahHal} halaman bergaya Korporat: ${r.halaman
      .map((h) => h.judul)
      .join(', ')}. Seluruh angka ilustrasi.`,
    widgets,
    bagian: {
      unit: r.unit,
      kunci: r.kunci,
      kunciLemah: r.kunciLemah,
      halaman: r.halaman.map((h) => ({ judul: h.judul, sub: h.sub, jumlah: h.kartu.length })),
    },
  };
}

// ============================================================================
// 1. GENERAL SUPPORT — Keuangan & Sumber Daya Manusia
// ============================================================================
const gs = pembuat('gs', 'Keuangan');
const GENERAL_SUPPORT = jadikan({
  kode: 'general-support',
  nama: 'General Support',
  judulDashboard: 'General Support — Keuangan & SDM',
  unit: 'Meeting Bagian General Support',
  tujuan: 'Rapat bagian keuangan dan SDM: disiplin keuangan, likuiditas, pengendalian biaya, human capital, rekrutmen, dan arah KPI 2027.',
  fokus: ['Kinerja keuangan', 'Arus kas & piutang', 'Human capital', 'Rekrutmen', 'KPI 2027'],
  kunci: /general\s*support/,
  kunciLemah: /keuangan\s*(?:&|dan)\s*(?:sdm|sumber daya manusia)/,
  halaman: [
    {
      judul: 'Executive Summary',
      sub: 'Ringkasan keuangan dan SDM',
      kartu: [
        gs.kpi('Pendapatan', 'Realisasi tahun berjalan', '48,6', 'miliar Rp', 'wallet', 6.1),
        gs.kpi('Biaya Operasional', 'Realisasi tahun berjalan', '31,2', 'miliar Rp', 'receipt', -2.4),
        gs.kpi('EBITDA', 'Laba sebelum bunga & pajak', '9,8', 'miliar Rp', 'trending-up', 18.1),
        gs.kpi('Cash Flow Bersih', 'Arus kas operasi', '6,4', 'miliar Rp', 'coins', 4.2),
        gs.kpi('Jumlah SDM', 'Karyawan aktif', '1.284', 'orang', 'users'),
        gs.kpi('Produktivitas SDM', 'Pendapatan per karyawan', '37,8', 'juta Rp', 'gauge', 3.5),
      ],
    },
    {
      judul: 'Financial Performance',
      sub: 'Tren kinerja, arus kas, dan pengendalian biaya',
      kartu: [
        gs.grafik('combo', 'combo-batang-garis', 'Tren Kinerja Keuangan', 'Pendapatan dan EBITDA, miliar rupiah', 8, 4, TAHUN, [
          { name: 'Pendapatan', data: [41.2, 45.8, 48.6, 53.4], kind: 'bar' },
          { name: 'EBITDA', data: [7.1, 8.3, 9.8, 11.2], kind: 'line' },
        ], 'miliar Rp'),
        gs.grafik('hbar', 'bar-mendatar-target', 'Budget vs Actual', 'Realisasi terhadap anggaran per pos, juta rupiah', 4, 4,
          ['Payroll', 'Utilities', 'Perjalanan dinas', 'General expenses', 'Administrasi'], [
            { name: 'Realisasi', data: [1460, 312, 188, 240, 96] },
            { name: 'Anggaran', data: [1500, 290, 210, 260, 110] },
          ], 'juta Rp'),
        gs.kpi('Cash In', 'Penerimaan kas', '52,1', 'miliar Rp', 'trending-up'),
        gs.kpi('Cash Out', 'Pengeluaran kas', '45,7', 'miliar Rp', 'trending-down'),
        gs.kpi('Umur Piutang', 'Rata-rata DSO', 47, 'hari', 'calendar'),
      ],
    },
    {
      judul: 'Human Capital',
      sub: 'Komposisi, rekrutmen, dan pengembangan karyawan',
      kartu: [
        gs.grafik('donut', 'donat-tebal', 'Komposisi Karyawan', 'Porsi per fungsi, persen', 4, 4,
          ['Operasional', 'Umum', 'Teknologi', 'Keuangan', 'SDM'], [{ name: 'Porsi', data: [46, 18, 16, 12, 8] }], '%'),
        gs.grafik('funnel', 'alur-tahap', 'Recruitment & Talent', 'Jumlah kandidat per tahap', 8, 4,
          ['Manpower request', 'Recruitment', 'Interview', 'Offering', 'Hired'], [{ name: 'Kandidat', data: [64, 52, 38, 22, 18] }], 'orang'),
        gs.grafik('hbar', 'daftar-progres', 'Performance & Development', 'Capaian program pengembangan, persen', 6, 4,
          ['KPI karyawan tercapai', 'Performance review', 'Training completion', 'Sertifikasi', 'Career development'],
          [{ name: 'Capaian', data: [87, 92, 78, 64, 58] }], '%'),
        gs.kpi('Vacancy Rate', 'Posisi belum terisi', '4,2', '%', 'user-plus'),
        gs.kpi('Turnover', 'Karyawan keluar per tahun', '6,8', '%', 'activity'),
      ],
    },
    {
      judul: 'Isu & Program Kerja',
      sub: 'Issue board dan tindak lanjut',
      kartu: [
        gs.tabel('papan-isu', 'Isu Utama General Support', 'Dikelompokkan menurut prioritas', 12, 4, ['Isu', 'Area', 'Prioritas'], [
          ['Cost overrun pos perjalanan dinas', 'Keuangan', 'Critical'],
          ['Piutang di atas 60 hari', 'Keuangan', 'Critical'],
          ['Kepatuhan pelaporan pajak', 'General Support', 'Critical'],
          ['Vacancy posisi teknis', 'SDM', 'Perlu perhatian'],
          ['Akurasi payroll lembur', 'SDM', 'Perlu perhatian'],
          ['Rekonsiliasi bank bulanan', 'Keuangan', 'Terkendali'],
          ['SOP payroll & benefit', 'SDM', 'Terkendali'],
        ]),
        gs.tabel('tabel-status', 'Program Kerja & Action Plan', 'Tindak lanjut hasil rapat', 12, 4, ['Aksi', 'PIC', 'Tenggat', 'Status'], [
          ['Efisiensi biaya non-operasional', 'Keuangan', 'Mar 2027', 'On progress'],
          ['Percepatan collection piutang', 'Keuangan', 'Feb 2027', 'Perlu perhatian'],
          ['Pemenuhan manpower teknis', 'SDM', 'Apr 2027', 'Critical'],
          ['Digitalisasi administrasi HR', 'SDM', 'Jun 2027', 'Terkendali'],
          ['Penguatan financial control', 'General Support', 'Mei 2027', 'On progress'],
        ]),
      ],
    },
    {
      judul: 'KPI 2027',
      sub: 'Sasaran kinerja tahun depan',
      kartu: [
        gs.sasaran('Revenue Growth', 6.1, 10, '%', '≥', 'trending-up'),
        gs.sasaran('EBITDA Margin', 20.2, 20, '%', '≥', 'percent'),
        gs.sasaran('Budget Accuracy', 91, 95, '%', '≥', 'target'),
        gs.sasaran('Collection / DSO', 47, 45, 'hari', '≤', 'calendar'),
        gs.sasaran('Time to Fill', 36, 30, 'hari', '≤', 'clock'),
        gs.sasaran('Training Completion', 78, 90, '%', '≥', 'clipboard'),
        gs.narasi('Arah 2027', 'Keuangan sehat, SDM kuat, operasional efisien: prioritas utama adalah pengendalian biaya, percepatan collection, dan pemenuhan manpower teknis.'),
      ],
    },
  ],
});

// ============================================================================
// 2. OUTSOURCING
// ============================================================================
const os = pembuat('os', 'SDM');
const OUTSOURCING = jadikan({
  kode: 'outsourcing',
  nama: 'Outsourcing',
  judulDashboard: 'Outsourcing Management Meeting',
  unit: 'Meeting Bagian Outsourcing',
  tujuan: 'Rapat bagian outsourcing: tenaga kerja, kontrak & penempatan, kepuasan klien, payroll & cost control, profitabilitas, dan pipeline.',
  fokus: ['Tenaga kerja', 'Kontrak & klien', 'Quality of service', 'Payroll & profit', 'Pipeline'],
  kunci: /outsourc/,
  kunciLemah: /alih\s*daya/,
  halaman: [
    {
      judul: 'Executive Summary',
      sub: 'Dashboard KPI outsourcing',
      kartu: [
        os.kpi('Total Tenaga Kerja', 'Tenaga kerja aktif', '2.416', 'orang', 'users', 3.2),
        os.kpi('Kontrak Aktif', 'Kontrak berjalan', 38, 'kontrak', 'file'),
        os.kpi('Klien / User', 'Klien aktif', 27, 'klien', 'building'),
        os.kpi('Tingkat Kehadiran', 'Rata-rata bulanan', '96,2', '%', 'user-check', 0.8),
        os.kpi('Turnover', 'Tenaga kerja keluar', '4,8', '%', 'activity', -0.6),
        os.kpi('Nilai Revenue', 'Pendapatan kontrak', '86,4', 'miliar Rp', 'wallet', 7.4),
      ],
    },
    {
      judul: 'Distribusi Tenaga Kerja',
      sub: 'Per cabang, lokasi, dan jenis pekerjaan',
      kartu: [
        os.grafik('hbar', 'bar-mendatar-peringkat', 'Per Cabang', 'Porsi tenaga kerja, persen', 4, 4,
          ['Jakarta', 'Bandung', 'Surabaya', 'Medan', 'Lainnya'], [{ name: 'Porsi', data: [35, 25, 18, 12, 10] }], '%'),
        os.grafik('donut', 'donat-tebal', 'Per Lokasi', 'Porsi tenaga kerja, persen', 4, 4,
          ['Kantor pusat', 'Proyek', 'Cabang', 'Lainnya'], [{ name: 'Porsi', data: [40, 30, 20, 10] }], '%'),
        os.grafik('donut', 'donat-tipis', 'Per Jenis Pekerjaan', 'Porsi tenaga kerja, persen', 4, 4,
          ['Admin', 'Security', 'Cleaning service', 'Driver', 'Operator', 'Lainnya'], [{ name: 'Porsi', data: [35, 20, 15, 10, 10, 10] }], '%'),
        os.kpi('Absensi', 'Rata-rata ketidakhadiran', '3,8', '%', 'calendar'),
        os.kpi('Produktivitas', 'Capaian target kerja', '92', '%', 'gauge'),
        os.kpi('Penempatan Baru', 'Tahun berjalan', 148, 'orang', 'user-plus'),
      ],
    },
    {
      judul: 'Klien & Kualitas Layanan',
      sub: 'Kontrak, kepuasan, SLA, dan keluhan',
      kartu: [
        os.kpi('Kontrak Akan Berakhir', '90 hari ke depan', 6, 'kontrak', 'calendar'),
        os.kpi('Perpanjangan', 'Kontrak diperpanjang', 9, 'kontrak', 'handshake'),
        os.kpi('SLA Tercapai', 'Rata-rata semua klien', '97,1', '%', 'shield-check'),
        os.grafik('gauge', 'cincin-progres', 'Kepuasan Klien', 'Survei kepuasan, persen', 4, 4, ['Kepuasan'], [{ name: 'Kepuasan', data: [88] }], '%'),
        os.grafik('hbar', 'daftar-progres', 'Quality of Service', 'Skor per aspek, persen', 8, 4,
          ['Spesifikasi kerja', 'Kedisiplinan', 'Hasil inspeksi', 'Respons keluhan', 'Kelengkapan laporan'],
          [{ name: 'Skor', data: [91, 86, 88, 79, 94] }], '%'),
      ],
    },
    {
      judul: 'Payroll & Profitabilitas',
      sub: 'Efisiensi biaya dan pertumbuhan pendapatan',
      kartu: [
        os.grafik('combo', 'combo-batang-garis', 'Revenue vs Profit', 'Miliar rupiah', 8, 4, TAHUN, [
          { name: 'Revenue', data: [68.2, 78.9, 86.4, 95.1], kind: 'bar' },
          { name: 'Profit', data: [7.4, 9.1, 10.7, 12.3], kind: 'line' },
        ], 'miliar Rp'),
        os.grafik('donut', 'donat-tebal', 'Komposisi Biaya', 'Porsi biaya, persen', 4, 4,
          ['Payroll', 'BPJS / benefit', 'Operasional', 'Lainnya'], [{ name: 'Porsi', data: [60, 15, 15, 10] }], '%'),
        os.kpi('Payroll', 'Total payroll tahun berjalan', '61,8', 'miliar Rp', 'banknote'),
        os.kpi('Margin Outsourcing', 'Profit terhadap revenue', '12,4', '%', 'percent', 0.9),
        os.kpi('EBITDA', 'Tahun berjalan', '13,6', 'miliar Rp', 'trending-up'),
      ],
    },
    {
      judul: 'Pipeline & Permasalahan',
      sub: 'Prospek, issue board, dan action plan',
      kartu: [
        os.grafik('funnel', 'alur-tahap', 'Pipeline Prospek Outsourcing', 'Jumlah prospek per tahap', 12, 3,
          ['Request', 'RFQ', 'Evaluasi', 'Negosiasi', 'PO', 'Delivery', 'Payment'], [{ name: 'Prospek', data: [24, 19, 15, 11, 8, 6, 5] }], 'prospek'),
        os.tabel('papan-isu', 'Permasalahan & Risiko', 'Issue board dan mitigasi', 6, 4, ['Isu', 'Status'], [
          ['Turnover tinggi di proyek', 'Critical'],
          ['Keterlambatan payroll', 'Critical'],
          ['Absensi cabang Medan', 'Perlu perhatian'],
          ['Keluhan klien', 'Perlu perhatian'],
          ['Kekurangan tenaga kerja', 'Terkendali'],
          ['Kepatuhan kontrak', 'Terkendali'],
        ]),
        os.tabel('tabel-status', 'Action Plan', 'Tindak lanjut hasil rapat', 6, 4, ['Aksi', 'PIC', 'Tenggat', 'Status'], [
          ['Program retensi tenaga kerja', 'HR', 'Feb 2027', 'Perlu perhatian'],
          ['Otomasi payroll', 'Keuangan', 'Mar 2027', 'On progress'],
          ['Audit SLA klien utama', 'Operasional', 'Jan 2027', 'Terkendali'],
          ['Rekrutmen cadangan', 'HR', 'Apr 2027', 'Critical'],
        ]),
      ],
    },
    {
      judul: 'Target & KPI 2027',
      sub: 'Fokus peningkatan kinerja',
      kartu: [
        os.sasaran('Tingkat Kehadiran', 96.2, 97, '%', '≥', 'user-check'),
        os.sasaran('Turnover', 4.8, 4, '%', '≤', 'activity'),
        os.sasaran('SLA Tercapai', 97.1, 98, '%', '≥', 'shield-check'),
        os.sasaran('Kepuasan Klien', 88, 90, '%', '≥', 'star'),
        os.sasaran('Margin Outsourcing', 12.4, 13, '%', '≥', 'percent'),
        os.sasaran('Keluhan Klien', 14, 10, 'kasus', '≤', 'alert'),
      ],
    },
  ],
});

// ============================================================================
// 3. PROCUREMENT
// ============================================================================
const pg = pembuat('pg', 'Operasional');
const PROCUREMENT = jadikan({
  kode: 'procurement',
  nama: 'Procurement',
  judulDashboard: 'Procurement Meeting',
  unit: 'Procurement Meeting',
  tujuan: 'Rapat pengadaan: realisasi anggaran, kategori pengadaan, kinerja vendor, cost saving, pipeline pengadaan, dan target 2027.',
  fokus: ['Budget vs realisasi', 'Kategori pengadaan', 'Vendor scorecard', 'Cost saving', 'Pipeline'],
  kunci: /procurement/,
  kunciLemah: /pengadaan|purchasing|\bvendor\b|supplier/,
  halaman: [
    {
      judul: 'Executive Summary',
      sub: 'Dashboard KPI pengadaan',
      kartu: [
        pg.kpi('Total Nilai Pengadaan', 'Tahun berjalan', '124,8', 'miliar Rp', 'cart', 5.6),
        pg.kpi('Jumlah PO', 'Purchase order terbit', 612, 'PO', 'file'),
        pg.kpi('Vendor Aktif', 'Vendor bertransaksi', 184, 'vendor', 'handshake'),
        pg.kpi('On-time Delivery', 'Pengiriman tepat waktu', '89,6', '%', 'truck', 2.1),
        pg.kpi('Cost Saving', 'Hasil negosiasi & konsolidasi', '6,2', 'miliar Rp', 'coins'),
        pg.kpi('Realisasi Anggaran', 'Terhadap pagu pengadaan', '78,4', '%', 'percent'),
      ],
    },
    {
      judul: 'Budget vs Realisasi',
      sub: 'Anggaran, komitmen, realisasi, dan kategori',
      kartu: [
        pg.grafik('bar', 'bar-tegak-sorot', 'Budget vs Realisasi Pengadaan', 'Miliar rupiah', 8, 4,
          ['Anggaran', 'Komitmen', 'Realisasi', 'Sisa anggaran'], [{ name: 'Nilai', data: [159.2, 132.6, 124.8, 34.4] }], 'miliar Rp'),
        pg.grafik('donut', 'donat-tebal', 'Komposisi Pengadaan', 'Porsi nilai per kategori, persen', 4, 4,
          ['Material', 'Jasa', 'Peralatan', 'ATK / umum'], [{ name: 'Porsi', data: [35, 30, 20, 15] }], '%'),
        pg.tabel('tabel-ringkas', 'Analisis Pengadaan per Kategori', 'Miliar rupiah', 12, 4, ['Kategori', 'Budget', 'Komitmen', 'Realisasi', 'Capaian'], [
          ['Material', '55,7', '47,1', '43,7', '78%'],
          ['Jasa', '47,8', '40,2', '37,4', '78%'],
          ['Peralatan', '31,8', '27,4', '25,0', '79%'],
          ['ATK / umum', '23,9', '17,9', '18,7', '78%'],
        ]),
      ],
    },
    {
      judul: 'Evaluasi Vendor',
      sub: 'Kondisi dan scorecard supplier',
      kartu: [
        pg.kpi('Vendor Baru', 'Terdaftar tahun ini', 23, 'vendor', 'user-plus'),
        pg.kpi('Vendor Bermasalah', 'Masuk daftar evaluasi', 7, 'vendor', 'alert'),
        pg.kpi('Pengiriman Terlambat', 'PO melewati jadwal', 11, 'PO', 'clock'),
        pg.grafik('radar', 'radar-aspek', 'Vendor Performance', 'Rata-rata skor vendor, skala 5', 5, 4,
          ['Harga', 'Kualitas', 'Ketepatan waktu', 'Responsiveness', 'Dokumen'], [
            { name: '2026', data: [3.9, 4.1, 3.6, 3.8, 4.2] },
            { name: '2025', data: [3.7, 3.9, 3.4, 3.6, 3.9] },
          ], 'skor'),
        pg.tabel('tabel-ringkas', 'Supplier Performance Scorecard', 'Skor 1–5 per aspek', 7, 4, ['Vendor', 'Harga', 'Kualitas', 'Tepat waktu', 'Dokumen'], [
          ['Vendor A', '4,2', '4,5', '4,0', '4,6'],
          ['Vendor B', '3,8', '4,1', '3,2', '4,0'],
          ['Vendor C', '4,0', '3,7', '3,9', '3,8'],
          ['Vendor D', '3,5', '3,9', '3,1', '4,1'],
        ]),
      ],
    },
    {
      judul: 'Cost Saving & Pipeline',
      sub: 'Target saving, sumber efisiensi, dan status proses',
      kartu: [
        pg.kpi('Target Saving', 'Tahun berjalan', '8,0', 'miliar Rp', 'target'),
        pg.kpi('Realisasi Saving', 'Tahun berjalan', '6,2', 'miliar Rp', 'coins'),
        pg.kpi('Gap Saving', 'Target dikurangi realisasi', '1,8', 'miliar Rp', 'trending-down'),
        pg.grafik('bar', 'bar-tegak', 'Sumber Efisiensi', 'Saving per cara, miliar rupiah', 4, 4,
          ['Negosiasi', 'Konsolidasi', 'Optimasi spesifikasi'], [{ name: 'Saving', data: [3.1, 1.9, 1.2] }], 'miliar Rp'),
        pg.grafik('funnel', 'alur-tahap', 'Pipeline Pengadaan', 'Paket per tahap, dari request sampai payment', 8, 4,
          ['Request', 'RFQ', 'Evaluasi', 'Negosiasi', 'PO', 'Delivery', 'Payment'], [{ name: 'Paket', data: [42, 36, 31, 24, 19, 14, 11] }], 'paket'),
      ],
    },
    {
      judul: 'Permasalahan & Action Plan',
      sub: 'Issue board untuk prioritas tindak lanjut',
      kartu: [
        pg.tabel('papan-isu', 'Permasalahan Pengadaan', 'Issue board', 12, 4, ['Isu', 'Status'], [
          ['Lead time panjang', 'Critical'],
          ['Vendor tidak memenuhi SLA', 'Critical'],
          ['Harga berubah', 'Perlu perhatian'],
          ['Approval terlambat', 'Perlu perhatian'],
          ['Spesifikasi final', 'Terkendali'],
          ['Dokumen lengkap', 'Terkendali'],
        ]),
        pg.tabel('tabel-status', 'Action Plan', 'Tindak lanjut hasil meeting', 12, 4, ['Aksi', 'PIC', 'Tenggat', 'Status'], [
          ['Negosiasi vendor', 'Procurement', '15 Jan', 'Perlu perhatian'],
          ['Finalisasi spesifikasi', 'User', '22 Jan', 'Terkendali'],
          ['Tender paket 3', 'Procurement', '05 Feb', 'Critical'],
          ['Tindak lanjut delivery', 'User', '12 Feb', 'On progress'],
          ['Kelengkapan dokumen', 'User', '19 Feb', 'On progress'],
        ]),
      ],
    },
    {
      judul: 'Target & KPI 2027',
      sub: 'Fokus peningkatan kinerja pengadaan',
      kartu: [
        pg.sasaran('Saving', 6.2, 8, 'miliar Rp', '≥', 'coins'),
        pg.sasaran('On-time Delivery', 89.6, 95, '%', '≥', 'truck'),
        pg.sasaran('PO Cycle Time', 18, 14, 'hari', '≤', 'clock'),
        pg.sasaran('Vendor Compliance', 86, 90, '%', '≥', 'shield-check'),
        pg.sasaran('PO Tanpa Revisi', 88, 92, '%', '≥', 'file'),
        pg.sasaran('Pengadaan Sesuai Budget', 96, 98, '%', '≥', 'target'),
      ],
    },
  ],
});

// ============================================================================
// 4. CONSTRUCTION
// ============================================================================
const ks = pembuat('ks', 'Operasional');
const CONSTRUCTION = jadikan({
  kode: 'construction',
  nama: 'Construction',
  judulDashboard: 'Construction Meeting',
  unit: 'Meeting Bagian Konstruksi',
  tujuan: 'Rapat konstruksi: portofolio proyek, progres fisik & biaya, schedule & milestone, mutu, K3, sumber daya, dan risiko proyek.',
  fokus: ['Portofolio proyek', 'Progres fisik & biaya', 'Mutu & K3', 'Sumber daya', 'Risiko'],
  kunci: /construction/,
  kunciLemah: /konstruksi|proyek/,
  halaman: [
    {
      judul: 'Executive Summary',
      sub: 'Dashboard kinerja proyek',
      kartu: [
        ks.kpi('Total Proyek', 'Proyek berjalan', 14, 'proyek', 'building'),
        ks.kpi('Progress Fisik', 'Rata-rata tertimbang', '68,4', '%', 'hard-hat', 4.6, 'vs bulan lalu'),
        ks.kpi('Progress Biaya', 'Realisasi terhadap anggaran', '61,2', '%', 'wallet'),
        ks.kpi('On Schedule', 'Proyek sesuai jadwal', 71, '%', 'calendar'),
        ks.kpi('Variance Biaya', 'Selisih terhadap rencana', '-2,4', 'miliar Rp', 'trending-down'),
        ks.kpi('Insiden K3', 'Tahun berjalan', 2, 'kejadian', 'shield-alert'),
      ],
    },
    {
      judul: 'Portfolio & Status Proyek',
      sub: 'Ringkasan proyek berjalan',
      kartu: [
        ks.tabel('tabel-status', 'Portfolio Proyek', 'Nilai kontrak, progres, dan status', 12, 5, ['Proyek / Lokasi', 'Nilai Kontrak', 'Progress', 'Target', 'Status'], [
          ['Gedung Kantor — Bandung', 'Rp 48,2 M', '82%', 'Mar 2027', 'On progress'],
          ['Gudang Logistik — Cikarang', 'Rp 31,6 M', '64%', 'Jun 2027', 'Terkendali'],
          ['Asrama Blok C — Bandung', 'Rp 22,4 M', '41%', 'Agu 2027', 'Delay'],
          ['Renovasi Kantor Cabang — Medan', 'Rp 9,8 M', '93%', 'Jan 2027', 'Terkendali'],
          ['Jalan Akses — Surabaya', 'Rp 14,1 M', '57%', 'Mei 2027', 'Perlu perhatian'],
        ]),
      ],
    },
    {
      judul: 'Progress Fisik & Biaya',
      sub: 'Rencana vs realisasi pekerjaan dan anggaran',
      kartu: [
        ks.grafik('bar', 'bar-tegak', 'Progress Fisik Proyek', 'Rencana vs realisasi, persen', 8, 4, ['M1', 'M2', 'M3', 'M4', 'M5'], [
          { name: 'Rencana', data: [15, 30, 48, 62, 70] },
          { name: 'Realisasi', data: [12, 27, 44, 60, 68] },
        ], '%'),
        ks.kpi('Deviasi Progress', 'Realisasi dikurangi rencana', '-2', '%', 'activity'),
        ks.grafik('bar', 'bar-tegak-sorot', 'Anggaran vs Realisasi', 'Miliar rupiah', 8, 4, ['Budget', 'Komitmen', 'Realisasi', 'Forecast EAC'], [
          { name: 'Nilai', data: [100, 72, 58, 85] },
        ], 'miliar Rp'),
        ks.kpi('Forecast EAC', 'Perkiraan biaya akhir', '85', 'miliar Rp', 'receipt'),
      ],
    },
    {
      judul: 'Schedule, Mutu & K3',
      sub: 'Milestone, quality control, dan safety performance',
      kartu: [
        ks.grafik('funnel', 'alur-tahap', 'Schedule & Milestone', 'Progres tiap tahap, persen', 12, 3,
          ['Mobilisasi', 'Pekerjaan struktur', 'Arsitektur', 'MEP', 'Finishing', 'Serah terima'], [{ name: 'Progres', data: [100, 86, 54, 32, 10, 0] }], '%'),
        ks.kpi('Inspeksi', 'Tahun berjalan', 46, 'inspeksi', 'clipboard'),
        ks.kpi('NCR / Temuan', 'Temuan mutu terbuka', 12, 'temuan', 'alert'),
        ks.kpi('NCR Closed', 'Temuan sudah ditutup', 83, '%', 'shield-check'),
        ks.kpi('Total Jam Kerja', 'Jam kerja aman', '412.800', 'jam', 'clock'),
        ks.kpi('Incident', 'Kecelakaan kerja', 2, 'kejadian', 'shield-alert'),
        ks.kpi('Near Miss', 'Hampir celaka dilaporkan', 9, 'laporan', 'hard-hat'),
      ],
    },
    {
      judul: 'Sumber Daya & Risiko',
      sub: 'Kesiapan material, alat, tenaga kerja, dan issue board',
      kartu: [
        ks.grafik('hbar', 'daftar-progres', 'Kesiapan Sumber Daya', 'Persen kesiapan', 4, 4,
          ['Material', 'Alat utilisasi', 'Tenaga kerja', 'Subkontraktor'], [{ name: 'Kesiapan', data: [82, 76, 91, 68] }], '%'),
        ks.tabel('papan-isu', 'Risiko & Kendala Proyek', 'Issue board dan mitigasi', 8, 4, ['Isu', 'Status'], [
          ['Keterlambatan pekerjaan struktur', 'Critical'],
          ['Perubahan pekerjaan (CCO)', 'Critical'],
          ['Pasokan material', 'Perlu perhatian'],
          ['Approval / koordinasi', 'Perlu perhatian'],
          ['Mutu pekerjaan', 'Terkendali'],
          ['K3 lapangan', 'Terkendali'],
        ]),
        ks.tabel('tabel-status', 'Action Plan', 'Tindak lanjut hasil meeting konstruksi', 12, 4, ['Aksi', 'PIC', 'Tenggat', 'Status'], [
          ['Percepatan pekerjaan struktur Blok C', 'Site manager', 'Feb 2027', 'Critical'],
          ['Finalisasi CCO gudang', 'Engineering', 'Jan 2027', 'Perlu perhatian'],
          ['Penambahan alat berat', 'Logistik', 'Jan 2027', 'On progress'],
          ['Toolbox meeting harian', 'HSE', 'Rutin', 'Terkendali'],
        ]),
      ],
    },
    {
      judul: 'Target & KPI 2027',
      sub: 'Fokus peningkatan kinerja konstruksi',
      kartu: [
        ks.sasaran('Progress Fisik', 68.4, 95, '%', '≥', 'hard-hat'),
        ks.sasaran('On Time', 71, 95, '%', '≥', 'calendar'),
        ks.sasaran('Variance Biaya', 6.2, 5, '%', '≤', 'receipt'),
        ks.sasaran('Zero Accident', 92, 100, '%', '≥', 'shield-check'),
        ks.sasaran('Mutu Pekerjaan', 91, 95, '%', '≥', 'star'),
        ks.sasaran('Efisiensi Biaya', 7.5, 10, '%', '≥', 'coins'),
      ],
    },
  ],
});

// ============================================================================
// 5. ASRAMA MAHASISWA
// ============================================================================
const am = pembuat('as', 'Pelayanan');
const ASRAMA = jadikan({
  kode: 'asrama',
  nama: 'Asrama Mahasiswa',
  judulDashboard: 'Pengelola Asrama Mahasiswa',
  unit: 'Meeting Pengelola Asrama',
  tujuan: 'Rapat pengelola asrama: kapasitas & hunian, kualitas pelayanan, kebersihan, fasilitas, keamanan, keluhan, dan efisiensi biaya.',
  fokus: ['Kapasitas & hunian', 'Kualitas pelayanan', 'Kebersihan & fasilitas', 'Keamanan', 'Keuangan'],
  kunci: /asrama/,
  kunciLemah: /dormitory|penghuni/,
  halaman: [
    {
      judul: 'Executive Summary',
      sub: 'KPI dashboard pengelolaan asrama',
      kartu: [
        am.kpi('Total Kapasitas', 'Tempat tidur', '1.200', 'tempat tidur', 'bed'),
        am.kpi('Mahasiswa Penghuni', 'Penghuni aktif', '1.089', 'orang', 'users', 2.4),
        am.kpi('Occupancy Rate', 'Tingkat hunian', '90,8', '%', 'building', 1.9),
        am.kpi('Kepuasan Mahasiswa', 'Survei semester', '88,5', '%', 'star'),
        am.kpi('Jumlah Keluhan', 'Semester berjalan', 32, 'kasus', 'alert', -40, 'dari periode lalu'),
        am.kpi('Biaya Operasional', 'Per bulan', '1,8', 'miliar Rp', 'receipt'),
      ],
    },
    {
      judul: 'Profil & Penghuni',
      sub: 'Kapasitas, komposisi, dan perputaran penghuni',
      kartu: [
        am.kpi('Jumlah Gedung', 'Gedung asrama', 3, 'gedung', 'building'),
        am.kpi('Jumlah Kamar', 'Kamar tersedia', 400, 'kamar', 'bed'),
        am.kpi('Check-in / Check-out', 'Bulan berjalan', '52 / 48', 'orang', 'user-check'),
        am.grafik('donut', 'donat-tebal', 'Distribusi Penghuni', 'Putra dan putri, persen', 4, 4, ['Putra', 'Putri'], [{ name: 'Porsi', data: [52, 48] }], '%'),
        am.grafik('bar', 'bar-tegak-sorot', 'Penghuni per Gedung', 'Orang', 4, 4, ['Gedung A', 'Gedung B', 'Gedung C'], [{ name: 'Penghuni', data: [384, 362, 343] }], 'orang'),
        am.kpi('Tingkat Turnover', 'Penghuni keluar per semester', '4,8', '%', 'activity'),
      ],
    },
    {
      judul: 'Pelayanan & Kebersihan',
      sub: 'Kualitas layanan, kebersihan, dan fasilitas',
      kartu: [
        am.grafik('hbar', 'daftar-progres', 'Kualitas Pelayanan', 'Skor layanan, persen', 4, 5,
          ['Administrasi penghuni', 'Informasi & front office', 'Response time', 'Service request', 'Kepuasan penghuni'],
          [{ name: 'Skor', data: [95, 92, 85, 86, 88] }], '%'),
        am.grafik('hbar', 'daftar-progres', 'Kebersihan & Kenyamanan', 'Skor kebersihan, persen', 4, 5,
          ['Kebersihan kamar', 'Toilet & kamar mandi', 'Area umum', 'Laundry', 'Pengelolaan sampah', 'Housekeeping checklist'],
          [{ name: 'Skor', data: [90, 85, 88, 80, 92, 89] }], '%'),
        am.tabel('tabel-status', 'Fasilitas & Maintenance', 'Kondisi fasilitas', 4, 5, ['Fasilitas', 'Kondisi'], [
          ['Kondisi bangunan', 'Baik'],
          ['Listrik & air', 'Baik'],
          ['Furniture', 'Cukup'],
          ['Internet / Wi-Fi', 'Baik'],
          ['Fasilitas belajar', 'Baik'],
          ['Preventive maintenance', 'Berjalan'],
        ]),
      ],
    },
    {
      judul: 'Keamanan & Keluhan',
      sub: 'Ketertiban, keluhan, dan service recovery',
      kartu: [
        am.tabel('tabel-status', 'Keamanan & Ketertiban', 'Status pengamanan', 4, 5, ['Aspek', 'Keterangan', 'Status'], [
          ['Security', '24 jam', 'Berfungsi'],
          ['CCTV', '64 titik', 'Berfungsi'],
          ['Kontrol akses', 'Kartu penghuni', 'Berfungsi'],
          ['Tamu / pengunjung', 'Buku tamu digital', 'Terkelola'],
          ['Pelanggaran tata tertib', '12 kasus', 'Perlu perhatian'],
          ['Emergency response', 'Tim siaga', 'Siap'],
        ]),
        am.grafik('donut', 'donat-tebal', 'Jenis Keluhan', 'Porsi keluhan, persen', 4, 5,
          ['Fasilitas', 'Kebersihan', 'Layanan', 'Lainnya'], [{ name: 'Porsi', data: [35, 22, 18, 25] }], '%'),
        am.kpi('Jumlah Complaint', 'Semester berjalan', 32, 'kasus', 'alert'),
        am.kpi('Response Time', 'Rata-rata tanggapan', 2, 'jam', 'clock'),
        am.kpi('Penyelesaian Keluhan', 'Keluhan ditutup', 100, '%', 'shield-check'),
        am.kpi('Keluhan Berulang', 'Kasus yang sama', 3, 'kasus', 'activity'),
      ],
    },
    {
      judul: 'Keuangan & Risiko',
      sub: 'Efisiensi operasional dan permasalahan',
      kartu: [
        am.kpi('Pendapatan Sewa', 'Per bulan', '1,5', 'miliar Rp', 'wallet'),
        am.kpi('Cost per Penghuni', 'Per bulan', '1.650.000', 'Rp', 'receipt'),
        am.kpi('Efisiensi Biaya', 'Dibanding tahun lalu', 12, '%', 'trending-up'),
        am.grafik('donut', 'donat-tipis', 'Rincian Biaya', 'Porsi biaya operasional, persen', 4, 4,
          ['Maintenance', 'Utilities', 'SDM', 'Lainnya'], [{ name: 'Porsi', data: [25, 20, 30, 25] }], '%'),
        am.tabel('papan-isu', 'Permasalahan & Risiko', 'Issue board', 8, 4, ['Isu', 'Status'], [
          ['Hunian tidak optimal', 'Critical'],
          ['Keamanan malam hari', 'Critical'],
          ['Kedisiplinan penghuni', 'Critical'],
          ['Fasilitas rusak', 'Perlu perhatian'],
          ['Kebersihan area umum', 'Perlu perhatian'],
          ['Keterbatasan SDM', 'Perlu perhatian'],
          ['Risiko operasional', 'Terkendali'],
        ]),
      ],
    },
    {
      judul: 'Program Kerja & KPI 2027',
      sub: 'Student living excellence',
      kartu: [
        am.sasaran('Occupancy Rate', 90.8, 95, '%', '≥', 'building'),
        am.sasaran('Kepuasan Penghuni', 88.5, 92, '%', '≥', 'star'),
        am.sasaran('Jumlah Complaint', 32, 15, 'kasus', '≤', 'alert'),
        am.sasaran('Facility Availability', 93, 95, '%', '≥', 'wrench'),
        am.sasaran('Keamanan', 97, 100, '%', '≥', 'shield-check'),
        am.sasaran('Efisiensi Biaya', 12, 10, '%', '≥', 'coins'),
      ],
    },
  ],
});

// ============================================================================
// 6. MARKETING & SALES
// ============================================================================
const ms = pembuat('ms', 'Keuangan');
const MARKETING = jadikan({
  kode: 'marketing-sales',
  nama: 'Marketing & Sales',
  judulDashboard: 'Marketing & Sales Management Meeting',
  unit: 'Meeting Marketing & Sales',
  tujuan: 'Rapat pemasaran dan penjualan: kinerja penjualan, pasar & pelanggan, pipeline prospek, profitabilitas, tantangan, dan target 2027.',
  fokus: ['Kinerja penjualan', 'Segmentasi pelanggan', 'Pipeline prospek', 'Profitabilitas', 'Target 2027'],
  kunci: /marketing/,
  kunciLemah: /pemasaran|penjualan|\bsales\b/,
  halaman: [
    {
      judul: 'Executive Summary',
      sub: 'Dashboard kinerja marketing & sales',
      kartu: [
        ms.kpi('Total Revenue Penjualan', 'Tahun berjalan', '212,6', 'miliar Rp', 'wallet', 9.6),
        ms.kpi('Jumlah Customer', 'Customer aktif', '1.846', 'customer', 'users', 5.1),
        ms.kpi('Jumlah Sales Order', 'Tahun berjalan', '3.420', 'SO', 'file'),
        ms.kpi('Pencapaian Target', 'Realisasi terhadap target', '87,4', '%', 'target'),
        ms.kpi('Pipeline Prospek', 'Prospek berjalan', 205, 'prospek', 'briefcase'),
        ms.kpi('Growth Penjualan', 'Dibanding tahun lalu', '9,6', '%', 'trending-up'),
      ],
    },
    {
      judul: 'Kinerja Penjualan',
      sub: 'Tren penjualan dan profitabilitas',
      kartu: [
        ms.grafik('bar', 'bar-tegak', 'Tren Penjualan', 'Target vs realisasi, miliar rupiah', 6, 4, ['2023', '2024', '2025', 'Outlook 2026'], [
          { name: 'Target', data: [165, 180, 205, 243] },
          { name: 'Realisasi', data: [158, 171, 194, 212.6] },
        ], 'miliar Rp'),
        ms.grafik('combo', 'combo-batang-garis', 'Revenue & Profit', 'Miliar rupiah', 6, 4, TAHUN, [
          { name: 'Revenue', data: [171, 194, 212.6, 240] },
          { name: 'Profit', data: [22.4, 26.1, 30.2, 36.5], kind: 'line' },
        ], 'miliar Rp'),
        ms.kpi('Growth YoY', 'Pertumbuhan penjualan', '9,6', '%', 'trending-up'),
        ms.kpi('Gross Profit Margin', 'Tahun berjalan', '24,6', '%', 'percent'),
        ms.kpi('EBITDA Margin', 'Tahun berjalan', '14,2', '%', 'coins'),
      ],
    },
    {
      judul: 'Analisa Pasar & Pelanggan',
      sub: 'Segmentasi dan pelanggan utama',
      kartu: [
        ms.grafik('donut', 'donat-tebal', 'Segmentasi Pelanggan', 'Porsi revenue, persen', 4, 4,
          ['Industri', 'Komersial', 'Pemerintahan', 'Lainnya'], [{ name: 'Porsi', data: [35, 25, 20, 20] }], '%'),
        ms.grafik('hbar', 'bar-mendatar-peringkat', 'Top 5 Pelanggan', 'Kontribusi revenue, persen', 4, 4,
          ['Pelanggan A', 'Pelanggan B', 'Pelanggan C', 'Pelanggan D', 'Pelanggan E'], [{ name: 'Kontribusi', data: [18, 15, 12, 10, 8] }], '%'),
        ms.grafik('hbar', 'daftar-progres', 'Kinerja Tim Marketing & Sales', 'Capaian individu terhadap target, persen', 4, 4,
          ['Tim Industri', 'Tim Komersial', 'Tim Pemerintahan', 'Tim Ritel'], [{ name: 'Capaian', data: [94, 88, 79, 83] }], '%'),
        ms.narasi('Peluang Pasar', 'Peluang pasar masih besar di sektor industri dan komersial; tingkat loyalitas pelanggan perlu ditingkatkan lewat program after sales service.'),
      ],
    },
    {
      judul: 'Pipeline & Prospek',
      sub: 'Corong prospek dan sebaran sektor',
      kartu: [
        ms.grafik('funnel', 'corong-pipeline', 'Pipeline & Prospek', 'Jumlah prospek per tahap', 6, 5,
          ['Prospek baru', 'Dalam negosiasi', 'Proposal', 'Closing'], [{ name: 'Prospek', data: [120, 45, 28, 12] }], 'prospek'),
        ms.grafik('hbar', 'bar-mendatar-peringkat', 'Prospek per Sektor', 'Porsi prospek, persen', 6, 5,
          ['Industri', 'Komersial', 'Pemerintahan', 'Lainnya'], [{ name: 'Porsi', data: [40, 25, 20, 15] }], '%'),
        ms.kpi('Event & Pameran', 'Tahun berjalan', 9, 'kegiatan', 'megaphone'),
        ms.kpi('Lead Baru', 'Dari promosi & event', 64, 'lead', 'user-plus'),
        ms.kpi('Potensi Revenue Pipeline', 'Nilai prospek', '58,4', 'miliar Rp', 'briefcase'),
      ],
    },
    {
      judul: 'Permasalahan & Action Plan',
      sub: 'Tantangan dan tindak lanjut',
      kartu: [
        ms.tabel('papan-isu', 'Permasalahan & Tantangan', 'Issue board', 12, 4, ['Isu', 'Status'], [
          ['Sales target belum tercapai', 'Critical'],
          ['Persaingan harga', 'Critical'],
          ['Lead time pelanggan', 'Critical'],
          ['Pipeline stagnan', 'Perlu perhatian'],
          ['Konversi rendah', 'Perlu perhatian'],
          ['Keterbatasan SDM', 'Perlu perhatian'],
          ['Permintaan musiman', 'Terkendali'],
          ['Perubahan regulasi', 'Terkendali'],
        ]),
        ms.tabel('tabel-status', 'Action Plan', 'Tindak lanjut hasil meeting', 12, 4, ['Aksi', 'PIC', 'Tenggat', 'Status'], [
          ['Optimalisasi kampanye digital', 'Marketing', 'Feb 2027', 'Perlu perhatian'],
          ['Follow up prospek industri', 'Sales', 'Jan 2027', 'Terkendali'],
          ['Negosiasi harga pelanggan utama', 'Sales', 'Mar 2027', 'Critical'],
          ['Pengembangan produk baru', 'Product dev', 'Jun 2027', 'On progress'],
          ['Peningkatan kompetensi tim', 'HRD', 'Apr 2027', 'On progress'],
        ]),
      ],
    },
    {
      judul: 'Target & KPI 2027',
      sub: 'Bersama kita capai target lebih tinggi',
      kartu: [
        ms.sasaran('Target Revenue', 212.6, 240, 'miliar Rp', '≥', 'wallet'),
        ms.sasaran('Jumlah Customer Baru', 142, 180, 'customer', '≥', 'user-plus'),
        ms.sasaran('Sales Order', 3420, 3800, 'SO', '≥', 'file'),
        ms.sasaran('Growth Penjualan', 9.6, 12, '%', '≥', 'trending-up'),
        ms.sasaran('Margin Profit', 14.2, 16, '%', '≥', 'percent'),
        ms.sasaran('Kepuasan Pelanggan', 86, 90, '%', '≥', 'star'),
      ],
    },
  ],
});

export const TEMPLATE_BAGIAN: DashboardTemplate[] = [GENERAL_SUPPORT, OUTSOURCING, PROCUREMENT, CONSTRUCTION, ASRAMA, MARKETING];

/** true bila id (boleh bernomor halaman, `tpl-bagian-x#3`) milik template bagian. */
export const templateBagianId = (id: string | undefined): boolean => Boolean(id && id.startsWith(PREFIKS_TEMPLATE_BAGIAN));

/** Nomor halaman dari id replika `tpl-bagian-x#n` (bawaan 1). */
export const nomorHalamanBagian = (id: string): number => {
  const n = Number(id.split('#')[1]);
  return Number.isInteger(n) && n >= 1 ? n : 1;
};

/**
 * Pecah daftar kartu (urutan template) menjadi halaman deck. Kartu hasil isi
 * dokumen memakai urutan yang sama dengan template, jadi potongannya cocok.
 */
export function halamanTemplateBagian(
  t: DashboardTemplate,
  widgets: WidgetSpec[] = t.widgets
): Array<HalamanBagian & { widgets: WidgetSpec[] }> {
  const daftar = t.bagian?.halaman ?? [];
  let awal = 0;
  return daftar.map((h) => {
    const potong = widgets.slice(awal, awal + h.jumlah);
    awal += h.jumlah;
    return { ...h, widgets: potong };
  });
}

/** Template bagian yang diminta kalimat asisten ("dashboard rapat procurement"), bila ada. */
export function bagianDariPermintaan(prompt: string): DashboardTemplate | undefined {
  const t = String(prompt ?? '').toLowerCase();
  const langsung = TEMPLATE_BAGIAN.find((x) => x.bagian?.kunci.test(t));
  if (langsung) return langsung;
  if (!/rapat|meeting|bagian|divisi|departemen|management\s*review|\brka\b/.test(t)) return undefined;
  return TEMPLATE_BAGIAN.find((x) => x.bagian?.kunciLemah.test(t));
}
