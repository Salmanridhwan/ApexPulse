import type { DataChart } from './pembangunOpsi';
import type { ChartId } from './chartDefault';

/**
 * ANGKA CONTOH UNTUK PRATINJAU KATALOG.
 *
 * Angka di sini HANYA untuk memperlihatkan bentuk chart di halaman Template
 * Chart. Dashboard sungguhan selalu memakai angka dokumen instansi.
 *
 * Bentuk data sengaja berbeda per keluarga chart supaya label dan sumbu terlihat
 * wajar, bukan sekadar 1, 2, 3.
 */

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun'];
const WILAYAH = ['Jakarta Pusat', 'Jakarta Utara', 'Jakarta Barat', 'Jakarta Selatan', 'Jakarta Timur'];
const BEBAN = ['Pegawai', 'Operasional', 'Administrasi', 'Pemeliharaan', 'Lainnya'];

const VOLUME: DataChart = {
  kategori: BULAN,
  seri: [{ nama: 'Volume', data: [612, 658, 631, 704, 689, 727] }],
  satuan: 'juta m³',
  desimal: 0,
};

const PENJUALAN: DataChart = {
  kategori: BULAN,
  seri: [
    { nama: 'Pendapatan', data: [128, 142, 136, 168, 155, 191] },
    { nama: 'Target', data: [140, 140, 145, 150, 160, 165] },
  ],
  satuan: 'miliar Rp',
  target: 152,
  total: 920,
  maks: 200,
  desimal: 0,
};

const PELANGGAN: DataChart = {
  kategori: WILAYAH,
  seri: [
    { nama: 'Pelanggan', data: [186420, 172880, 208360, 196240, 187740] },
    { nama: 'Pengaduan', data: [24180, 27640, 29320, 25410, 21910] },
  ],
  satuan: 'sambungan',
  target: 190000,
  total: 951640,
  desimal: 0,
};

const NRW: DataChart = {
  kategori: WILAYAH,
  seri: [{ nama: 'NRW', data: [41.2, 46.8, 45.1, 42.6, 43.9] }],
  satuan: '%',
  target: 43.85,
  total: 43.85,
  maks: 60,
  desimal: 1,
};

const BEBAN_DONAT: DataChart = {
  kategori: BEBAN,
  seri: [{ nama: 'Porsi', data: [42, 27, 14, 11, 6] }],
  satuan: '%',
  total: 100,
  desimal: 0,
};

const KARTU: DataChart = {
  kategori: ['Air terjual'],
  seri: [{ nama: 'Air terjual', data: [377] }],
  satuan: 'juta m³',
  total: 377,
  maks: 500,
  desimal: 0,
  delta: 4.2,
};

const INDIKATOR: DataChart = {
  kategori: ['Ketepatan waktu', 'SLA', 'Kepuasan', 'Pengisian meter', 'Cakupan'],
  seri: [
    { nama: 'Realisasi', data: [96.2, 93.5, 87.1, 98.7, 69.1] },
    { nama: 'Target', data: [95, 92, 85, 100, 71.5] },
  ],
  satuan: '%',
  target: 90,
  total: 88.9,
  maks: 100,
  desimal: 1,
};

const PERINGKAT: DataChart = {
  kategori: ['Halaman depan', 'Katalog', 'Berita', 'Profil', 'Kontak'],
  seri: [{ nama: 'Kunjungan', data: [4820, 3110, 2470, 1690, 980] }],
  satuan: 'kunjungan',
  total: 13070,
  desimal: 0,
};

const TABEL: DataChart = {
  kategori: ['Jan', 'Feb', 'Mar'],
  seri: [
    { nama: 'Realisasi', data: [128, 142, 136] },
    { nama: 'Target', data: [140, 140, 145] },
  ],
  satuan: 'miliar Rp',
  desimal: 0,
};

const GABUNGAN: DataChart = {
  kategori: BULAN,
  seri: [
    { nama: 'Pendapatan', data: [128, 142, 136, 168, 155, 191] },
    { nama: 'Margin', data: [18, 21, 19, 24, 22, 27] },
  ],
  satuan: 'miliar Rp',
  target: 26,
  total: 920,
  maks: 200,
  desimal: 0,
};

const SEBARAN: DataChart = {
  kategori: WILAYAH,
  seri: [
    { nama: 'Pelanggan', data: [186420, 172880, 208360, 196240, 187740] },
    { nama: 'Air terjual', data: [74.3, 68.4, 82.1, 77.9, 74.1] },
  ],
  satuan: 'sambungan',
  total: 951640,
  maks: 250000,
  desimal: 0,
};

const NARASI: DataChart = {
  kategori: ['Ringkasan'],
  seri: [{ nama: 'Teks', data: [1] }],
  satuan: '',
  desimal: 0,
};

const PETA: Record<ChartId, DataChart> = {
  'kpi-kartu': KARTU,
  'kpi-strip': KARTU,
  'progres-target': INDIKATOR,
  'tabel-ringkas': TABEL,
  'narasi-insight': NARASI,
  peringkat: PERINGKAT,
  'bar-tegak': PENJUALAN,
  'bar-tegak-sorot': PENJUALAN,
  'bar-tegak-target': NRW,
  'bar-mendatar-peringkat': PERINGKAT,
  'bar-mendatar-target': INDIKATOR,
  'bar-tumpuk': GABUNGAN,
  'area-gradasi': VOLUME,
  'garis-tren': VOLUME,
  'combo-batang-garis': GABUNGAN,
  'scatter-gelembung': SEBARAN,
  'titik-bersumbu': PELANGGAN,
  'donat-tebal': BEBAN_DONAT,
  'donat-tipis': BEBAN_DONAT,
  'gauge-target': NRW,
  'strip-os': {
    kategori: ['Android', 'iOS', 'Windows', 'macOS'],
    seri: [
      { nama: 'Pangsa', data: [48.2, 31.4, 12.6, 7.8] },
      { nama: 'Delta', data: [2.4, -1.2, 0.8, 0.3] },
    ],
    satuan: '%',
    desimal: 1,
    deretKecil: [
      [40, 42, 43, 45, 48.2],
      [33, 32, 32, 31.8, 31.4],
      [12, 12.2, 12.4, 12.5, 12.6],
      [7.5, 7.6, 7.7, 7.7, 7.8],
    ],
  },
};

export const contohData = (id: ChartId): DataChart => PETA[id] ?? VOLUME;

/** Label contoh untuk chart HTML, supaya kartunya tidak kosong. */
export const contohKartu = {
  judul: 'Air terjual',
  angka: '377',
  satuan: 'juta m³',
  delta: '4,2%',
  naik: true,
  baris: [
    { label: 'Ketepatan waktu tanggap', nilai: 96.2, target: 95 },
    { label: 'Penyelesaian SLA', nilai: 93.5, target: 92 },
    { label: 'Kepuasan pengguna', nilai: 87.1, target: 85 },
  ],
  kolom: ['Wilayah', 'Pelanggan', 'NRW'],
  isi: [
    ['Jakarta Pusat', '186.420', '41,2%'],
    ['Jakarta Barat', '208.360', '45,1%'],
    ['Jakarta Utara', '172.880', '46,8%'],
  ],
  narasi: 'Kehilangan air tertinggi ada di Jakarta Utara, sementara air terjual terbesar di Jakarta Barat.',
  peringkat: [
    { label: 'Halaman depan', nilai: 4820 },
    { label: 'Katalog', nilai: 3110 },
    { label: 'Berita', nilai: 2470 },
    { label: 'Profil', nilai: 1690 },
  ],
};
