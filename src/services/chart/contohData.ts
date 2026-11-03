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
  deretKecil: [[318, 331, 326, 344, 352, 349, 363, 377]],
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
  kategori: ['Pipa bocor', 'Air keruh', 'Meter rusak', 'Tagihan', 'Tekanan rendah'],
  seri: [{ nama: 'Pengaduan', data: [4820, 3110, 2470, 1690, 980] }],
  satuan: 'aduan',
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
  'bar-kapsul': VOLUME,
  'area-banding': {
    kategori: BULAN,
    seri: [
      { nama: 'Pendapatan', data: [128, 142, 136, 168, 155, 191] },
      { nama: 'Beban', data: [96, 101, 99, 112, 108, 117] },
    ],
    satuan: 'miliar Rp',
    desimal: 0,
  },
  'air-terjun': {
    kategori: ['Air diproduksi', 'Kebocoran pipa', 'Meter tak akurat', 'Pemakaian tak resmi', 'Air terjual'],
    seri: [{ nama: 'Volume', data: [512, -96, -24, -15, 377] }],
    satuan: 'juta m³',
    desimal: 0,
  },
  'sankey-alur': {
    kategori: [
      'Produksi>Terjual',
      'Produksi>Air hilang',
      'Terjual>Rumah tangga',
      'Terjual>Niaga',
      'Terjual>Instansi',
      'Terjual>Sosial',
      'Air hilang>Kebocoran',
      'Air hilang>Meter & ilegal',
    ],
    seri: [{ nama: 'Volume', data: [377, 135, 248, 86, 31, 12, 96, 39] }],
    satuan: 'juta m³',
    desimal: 0,
  },
  'radar-aspek': {
    kategori: ['Keuangan', 'Pelayanan', 'Operasional', 'SDM'],
    seri: [
      { nama: '2025', data: [3.4, 3.9, 3.1, 3.6] },
      { nama: '2024', data: [3.1, 3.6, 2.9, 3.4] },
    ],
    maks: 5,
    desimal: 1,
  },
  'gauge-kesehatan': { kategori: ['Skor kinerja'], seri: [{ nama: 'Skor', data: [3.42] }], maks: 5, desimal: 2 },
  'peta-panas': {
    kategori: BULAN,
    seri: [
      { nama: 'Jakarta Pusat', data: [42, 38, 51, 47, 33, 29] },
      { nama: 'Jakarta Utara', data: [65, 72, 80, 61, 58, 54] },
      { nama: 'Jakarta Barat', data: [48, 44, 39, 52, 46, 41] },
      { nama: 'Jakarta Selatan', data: [31, 29, 35, 28, 26, 24] },
      { nama: 'Jakarta Timur', data: [55, 49, 58, 63, 51, 47] },
    ],
    satuan: 'aduan',
    desimal: 0,
  },
  'treemap-porsi': {
    kategori: ['Rumah tangga', 'Niaga', 'Industri', 'Instansi', 'Sosial'],
    seri: [{ nama: 'Pendapatan', data: [612, 284, 121, 88, 34] }],
    satuan: 'miliar Rp',
    desimal: 0,
  },
  'cincin-progres': { kategori: ['Penyelesaian SLA'], seri: [{ nama: 'Capaian', data: [86] }], satuan: '%', desimal: 0 },
  'strip-os': {
    kategori: ['Rumah tangga', 'Niaga', 'Instansi', 'Sosial'],
    seri: [
      { nama: 'Porsi pelanggan', data: [48.2, 31.4, 12.6, 7.8] },
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
  'kpi-target': {
    kategori: ['On-time delivery'],
    seri: [{ nama: 'Realisasi', data: [91.4] }],
    satuan: '%',
    target: 95,
    arahBaik: 'naik',
    desimal: 1,
  },
  'papan-isu': {
    kategori: ['Permasalahan'],
    seri: [],
    tabel: {
      kepala: ['Isu', 'Status'],
      baris: [
        ['Lead time panjang', 'Critical'],
        ['Vendor tidak memenuhi SLA', 'Critical'],
        ['Harga berubah', 'Perlu perhatian'],
        ['Approval terlambat', 'Perlu perhatian'],
        ['Spesifikasi final', 'Terkendali'],
        ['Dokumen lengkap', 'Terkendali'],
      ],
    },
  },
  'tabel-status': {
    kategori: ['Action plan'],
    seri: [],
    tabel: {
      kepala: ['Aksi', 'PIC', 'Tenggat', 'Status'],
      baris: [
        ['Negosiasi vendor', 'Procurement', '15 Jan', 'Perlu perhatian'],
        ['Finalisasi spesifikasi', 'User', '22 Jan', 'Terkendali'],
        ['Tender paket 3', 'Procurement', '05 Feb', 'Critical'],
        ['Tindak lanjut delivery', 'User', '12 Feb', 'On progress'],
      ],
    },
  },
  'alur-tahap': {
    kategori: ['Request', 'RFQ', 'Evaluasi', 'Negosiasi', 'PO', 'Delivery', 'Payment'],
    seri: [{ nama: 'Paket', data: [42, 36, 31, 24, 19, 14, 11] }],
    satuan: 'paket',
    desimal: 0,
  },
  'corong-pipeline': {
    kategori: ['Prospek baru', 'Dalam negosiasi', 'Proposal', 'Closing'],
    seri: [{ nama: 'Prospek', data: [120, 45, 28, 12] }],
    satuan: 'prospek',
    desimal: 0,
  },
  'daftar-progres': {
    kategori: ['Kebersihan kamar', 'Toilet & kamar mandi', 'Area umum', 'Laundry', 'Pengelolaan sampah'],
    seri: [{ nama: 'Skor', data: [90, 85, 88, 80, 92] }],
    satuan: '%',
    target: 85,
    desimal: 0,
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
