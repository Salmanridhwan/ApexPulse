import type { WidgetSpec, WidgetType } from '../../types';
import type { DashboardTemplate } from './dashboardTemplates';

/**
 * TEMPLATE RAPAT MANAJEMEN.
 *
 * Diturunkan dari deck "Management Meeting 2026 / RKA 2027". Deck aslinya per
 * bagian (General Support, Procurement, ...); di sini disatukan menjadi SATU
 * deck umum "Rapat Manajemen" yang cocok untuk instansi mana pun (nama
 * instansi sengaja tidak dipakai). Tiap halaman dashboard = satu kelompok
 * slide (Executive Summary, operasional, keuangan, isu & action plan, KPI 2027).
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
  /** Nama rapat di kaki halaman, mis. "Rapat Manajemen". */
  unit: string;
  halaman: HalamanBagian[];
  /** Kata di kalimat asisten yang memilih template ini ("dashboard rapat ..."). */
  kunci: RegExp;
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
      halaman: r.halaman.map((h) => ({ judul: h.judul, sub: h.sub, jumlah: h.kartu.length })),
    },
  };
}

// ============================================================================
// RAPAT MANAJEMEN — satu deck umum untuk instansi mana pun
// ============================================================================
const rm = pembuat('rapat', 'Manajemen');
/** Empat kartu KPI satu deret (3 kolom dari 12). */
const lebar3 = (w: WidgetSpec): WidgetSpec => ({ ...w, grid: { ...w.grid, w: 3 } });

const RAPAT_MANAJEMEN = jadikan({
  kode: 'rapat',
  nama: 'Rapat Manajemen',
  judulDashboard: 'Rapat Manajemen — Kinerja & RKA 2027',
  unit: 'Rapat Manajemen',
  tujuan: 'Rapat manajemen instansi: ringkasan kinerja, operasional, keuangan & biaya, isu dan action plan, serta sasaran KPI tahun depan.',
  fokus: ['Kinerja utama', 'Operasional & layanan', 'Keuangan & biaya', 'Isu & action plan', 'KPI 2027'],
  kunci: /\brapat\b|\bmeeting\b|management\s*review|\brka\b/,
  halaman: [
    {
      judul: 'Executive Summary',
      sub: 'Ringkasan kinerja tahun berjalan',
      kartu: [
        lebar3(rm.kpi('Pendapatan', 'Realisasi tahun berjalan', '48,6', 'miliar Rp', 'wallet', 6.1)),
        lebar3(rm.kpi('Biaya Operasional', 'Realisasi tahun berjalan', '31,2', 'miliar Rp', 'receipt', -2.4)),
        lebar3(rm.kpi('Laba Bersih', 'Setelah pajak', '9,8', 'miliar Rp', 'trending-up', 18.1)),
        lebar3(rm.kpi('Realisasi Anggaran', 'Terhadap RKA tahun berjalan', '91,4', '%', 'target')),
        rm.grafik('combo', 'combo-batang-garis', 'Pendapatan vs Biaya Operasional', 'Miliar rupiah', 8, 4, TAHUN, [
          { name: 'Pendapatan', data: [41.2, 45.8, 48.6, 53.4], kind: 'bar' },
          { name: 'Biaya Operasional', data: [28.9, 30.4, 31.2, 33.1], kind: 'line' },
        ], 'miliar Rp'),
        rm.grafik('hbar', 'bar-mendatar-target', 'Capaian vs Target Indikator', 'Persen, tahun berjalan', 4, 4,
          ['Pendapatan', 'Laba bersih', 'Pelanggan baru', 'Kepuasan'], [
            { name: 'Capaian', data: [96, 104, 88, 97] },
            { name: 'Target', data: [100, 100, 100, 100] },
          ], '%'),
      ],
    },
    {
      judul: 'Kinerja Operasional',
      sub: 'Tren kinerja, capaian program, dan layanan',
      kartu: [
        rm.grafik('combo', 'combo-batang-garis', 'Tren Pendapatan & Laba', 'Miliar rupiah', 8, 4, TAHUN, [
          { name: 'Pendapatan', data: [41.2, 45.8, 48.6, 53.4], kind: 'bar' },
          { name: 'Laba Bersih', data: [7.1, 8.3, 9.8, 11.2], kind: 'line' },
        ], 'miliar Rp'),
        rm.grafik('hbar', 'daftar-progres', 'Capaian Program Kerja', 'Persen terhadap target tahun berjalan', 4, 4,
          ['Program layanan', 'Program investasi', 'Program SDM', 'Program digitalisasi', 'Program efisiensi'],
          [{ name: 'Capaian', data: [92, 74, 86, 61, 88] }], '%'),
        rm.grafik('funnel', 'alur-tahap', 'Alur Penanganan Keluhan', 'Jumlah keluhan per tahap', 8, 4,
          ['Diterima', 'Diverifikasi', 'Ditindaklanjuti', 'Selesai', 'Dikonfirmasi'], [{ name: 'Keluhan', data: [420, 396, 371, 352, 318] }], 'keluhan'),
        rm.kpi('Kepuasan Pelanggan', 'Indeks survei', '82,5', '%', 'star', 1.8),
        rm.kpi('Keluhan Selesai', 'Dalam tenggat layanan', '94', '%', 'shield-check'),
      ],
    },
    {
      judul: 'Keuangan & Biaya',
      sub: 'Anggaran, arus kas, dan pengendalian biaya',
      kartu: [
        rm.grafik('hbar', 'bar-mendatar-target', 'Anggaran vs Realisasi', 'Per pos biaya, juta rupiah', 7, 4,
          ['Pegawai', 'Operasional', 'Pemeliharaan', 'Administrasi & umum', 'Pemasaran'], [
            { name: 'Realisasi', data: [14600, 9120, 3880, 2400, 960] },
            { name: 'Anggaran', data: [15000, 8900, 4100, 2600, 1100] },
          ], 'juta Rp'),
        rm.grafik('donut', 'donat-tebal', 'Komposisi Biaya', 'Porsi per pos, persen', 5, 4,
          ['Pegawai', 'Operasional', 'Pemeliharaan', 'Administrasi & umum', 'Pemasaran'], [{ name: 'Porsi', data: [47, 29, 12, 8, 4] }], '%'),
        rm.kpi('Kas Masuk', 'Penerimaan kas', '52,1', 'miliar Rp', 'trending-up'),
        rm.kpi('Kas Keluar', 'Pengeluaran kas', '45,7', 'miliar Rp', 'trending-down'),
        rm.kpi('Umur Piutang', 'Rata-rata hari tagih', 47, 'hari', 'calendar'),
      ],
    },
    {
      judul: 'Isu & Action Plan',
      sub: 'Issue board dan tindak lanjut rapat',
      kartu: [
        rm.tabel('papan-isu', 'Isu Utama', 'Dikelompokkan menurut prioritas', 8, 4, ['Isu', 'Area', 'Prioritas'], [
          ['Realisasi investasi di bawah rencana', 'Investasi', 'Critical'],
          ['Piutang di atas 90 hari', 'Keuangan', 'Critical'],
          ['Biaya pemeliharaan melampaui anggaran', 'Operasional', 'Perlu perhatian'],
          ['Formasi pegawai teknis belum terisi', 'SDM', 'Perlu perhatian'],
          ['Waktu tanggap keluhan pelanggan', 'Layanan', 'Perlu perhatian'],
          ['Pelaporan keuangan bulanan', 'Keuangan', 'Terkendali'],
          ['Kepatuhan SOP layanan', 'Layanan', 'Terkendali'],
        ]),
        rm.grafik('hbar', 'daftar-progres', 'Progres Action Plan', 'Persen selesai per aksi', 4, 4,
          ['Realisasi investasi', 'Penagihan piutang', 'Biaya pemeliharaan', 'Rekrutmen teknis', 'Digitalisasi layanan'],
          [{ name: 'Progres', data: [55, 40, 65, 25, 80] }], '%'),
        rm.tabel('tabel-status', 'Action Plan', 'Tindak lanjut hasil rapat', 12, 4, ['Aksi', 'PIC', 'Tenggat', 'Status'], [
          ['Percepatan realisasi investasi', 'Perencanaan', 'Mar 2027', 'On progress'],
          ['Penagihan piutang macet', 'Keuangan', 'Feb 2027', 'Perlu perhatian'],
          ['Pengendalian biaya pemeliharaan', 'Operasional', 'Apr 2027', 'On progress'],
          ['Rekrutmen pegawai teknis', 'SDM', 'Jun 2027', 'Critical'],
          ['Digitalisasi layanan pelanggan', 'Layanan', 'Mei 2027', 'Terkendali'],
        ]),
      ],
    },
    {
      judul: 'Target & KPI 2027',
      sub: 'Sasaran kinerja tahun depan',
      kartu: [
        lebar3(rm.sasaran('Pertumbuhan Pendapatan', 6.1, 10, '%', '≥', 'trending-up')),
        lebar3(rm.sasaran('Realisasi Anggaran', 91, 95, '%', '≥', 'target')),
        lebar3(rm.sasaran('Kepuasan Pelanggan', 82.5, 85, '%', '≥', 'star')),
        lebar3(rm.sasaran('Umur Piutang', 47, 40, 'hari', '≤', 'calendar')),
        rm.grafik('hbar', 'bar-mendatar-target', 'Realisasi 2026 vs Sasaran 2027', 'Persen', 8, 4,
          ['Rasio biaya operasional', 'Capaian program kerja', 'Realisasi investasi', 'Cakupan layanan'], [
            { name: 'Realisasi 2026', data: [64, 80, 57, 69] },
            { name: 'Sasaran 2027', data: [60, 90, 85, 75] },
          ], '%'),
        rm.narasi('Arah 2027', 'Prioritas tahun depan: menjaga pertumbuhan pendapatan, mempercepat penagihan piutang, mengendalikan biaya operasional, dan meningkatkan kualitas layanan.', 4, 4),
      ],
    },
  ],
});

export const TEMPLATE_BAGIAN: DashboardTemplate[] = [RAPAT_MANAJEMEN];

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

/** Template rapat yang diminta kalimat asisten ("dashboard rapat procurement"), bila ada. */
export function bagianDariPermintaan(prompt: string): DashboardTemplate | undefined {
  const t = String(prompt ?? '').toLowerCase();
  return TEMPLATE_BAGIAN.find((x) => x.bagian?.kunci.test(t));
}
