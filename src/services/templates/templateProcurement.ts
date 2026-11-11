import type { WidgetSpec } from '../../types';
import type { DashboardTemplate } from './dashboardTemplates';
import { PREFIKS_TEMPLATE_DECK } from './templateBagian';
import { alatDeck } from './deckAlat';

/**
 * TEMPLATE DECK "PROCUREMENT MEETING".
 *
 * Disusun dari deck *Procurement Meeting — Evaluasi & Rencana Strategis
 * Pengadaan 2026/2027 — PT. Sandy Putra Makmur*. Slide sampul TIDAK dijadikan
 * halaman: judulnya dipakai sebagai nama template. Slide "Closing" dan
 * "Penutup" digabung, jadi 14 halaman, satu halaman = satu slide:
 *
 *   1 Agenda Meeting              9 Cost Saving & Efisiensi
 *   2 Executive Summary          10 Pipeline Pengadaan
 *   3 Budget vs Realisasi        11 Rencana Pengadaan
 *   4 Analisis per Kategori      12 Action Plan
 *   5 Evaluasi Vendor            13 Target & KPI 2027
 *   6 Vendor Performance         14 Penutup
 *   7 Permasalahan Pengadaan
 *   8 Efisiensi Pengadaan
 *
 * Gaya (Pijar, Koran, Neon, ...) dipilih terpisah di galeri — template ini hanya
 * menentukan SUSUNAN, bukan tampilan. Semua angka di sini ANGKA CONTOH yang
 * saling konsisten (pagu Rp 128,4 miliar, realisasi Rp 118,7 miliar, cost saving
 * Rp 9,7 miliar); dashboard nyata diisi dari dokumen instansi yang sedang login.
 */

const { kpi, sasaran, poin, teks, grafik, tabel } = alatDeck('prcr', 'Pengadaan');

const TAHUN = ['2024', '2025', 'Outlook 2026', 'RKA 2027'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const HALAMAN: Array<{ judul: string; sub: string; kartu: WidgetSpec[] }> = [
  {
    judul: 'Agenda Meeting',
    sub: 'Pokok bahasan rapat pengadaan 2026',
    kartu: [
      poin('Agenda — Evaluasi 2026', 'Bagian 1 dari 2', 6, 7,
        'Enam belas pokok bahasan, dibagi dua kolom agar terbaca satu layar.',
        [
          '1. Nilai pengadaan 2026',
          '2. Pengiriman tepat waktu',
          '3. Cost saving tercapai',
          '4. Realisasi anggaran',
          '5. Anggaran vs realisasi',
          '6. Pengadaan per kategori',
          '7. Kondisi vendor',
          '8. Kinerja vendor',
        ]),
      poin('Agenda — Rencana 2027', 'Bagian 2 dari 2', 6, 7,
        'Dilanjutkan masalah pengadaan, efisiensi, dan sasaran tahun depan.',
        [
          '9. Permasalahan pengadaan',
          '10. Efisiensi & value for money',
          '11. Pipeline pengadaan',
          '12. Rencana pengadaan 2027',
          '13. Action plan',
          '14. Target & KPI 2027',
          '15. Penutup',
          '16. Lampiran pendukung',
        ]),
    ],
  },
  {
    judul: 'Executive Summary',
    sub: 'Dashboard KPI pengadaan 2026',
    kartu: [
      kpi(4, 'Nilai Pengadaan', 'Realisasi tahun berjalan', '118,7', 'miliar Rp', 'wallet', 6.4),
      kpi(4, 'Pengiriman Tepat Waktu', 'Rata-rata tahun berjalan', '92,4', '%', 'truck', 3.1),
      kpi(4, 'Cost Saving', 'Dibanding harga acuan', '9,7', 'miliar Rp', 'trending-down', 12.8),
      kpi(4, 'Realisasi Anggaran', 'Terhadap pagu 2026', '92,5', '%', 'target', 2.2),
      kpi(4, 'Jumlah Paket', 'Paket pengadaan 2026', '284', 'paket', 'file-text', 7.6),
      kpi(4, 'Vendor Aktif', 'Terdaftar dan bertransaksi', '63', 'vendor', 'building', -4.5),
      teks('Headline Management', 'Pertanyaan kunci rapat', 12, 2,
        'Apakah pengadaan 2026 berjalan efisien tanpa mengorbankan mutu dan ketepatan waktu? Nilai pengadaan Rp 118,7 miliar atau 92,5% dari pagu, dengan cost saving Rp 9,7 miliar. Yang perlu perhatian: 34 paket terlambat, 12 vendor masuk daftar evaluasi, dan 8 paket masih berstatus kritis menjelang tutup tahun.'),
    ],
  },
  {
    judul: 'Budget vs Realisasi Pengadaan',
    sub: 'Pagu, komitmen, realisasi, dan sisa anggaran',
    kartu: [
      kpi(3, 'Pagu Anggaran', 'Penetapan 2026', '128,4', 'miliar Rp', 'target', 5.1),
      kpi(3, 'Komitmen', 'Sudah dikontrakkan', '112,3', 'miliar Rp', 'file-check', 6.8),
      kpi(3, 'Realisasi', 'Sudah dibayar', '118,7', 'miliar Rp', 'wallet', 6.4),
      kpi(3, 'Sisa Anggaran', 'Belum terserap', '9,7', 'miliar Rp', 'receipt', -18.3),
      grafik('combo', 'combo-batang-garis', 'Pagu vs Realisasi per Kuartal', 'Miliar rupiah, 2026', 12, 4,
        ['Kuartal 1', 'Kuartal 2', 'Kuartal 3', 'Kuartal 4'], [
          { name: 'Pagu', data: [32.1, 32.1, 32.1, 32.1], kind: 'bar' },
          { name: 'Realisasi', data: [26.4, 31.8, 34.2, 26.3], kind: 'bar' },
          { name: 'Serapan kumulatif', data: [26.4, 58.2, 92.4, 118.7], kind: 'line' },
        ], 'miliar Rp'),
    ],
  },
  {
    judul: 'Analisis Pengadaan per Kategori',
    sub: 'Sebaran nilai dan jumlah paket per kategori',
    kartu: [
      grafik('donut', 'donat-tebal', 'Nilai Pengadaan per Kategori', 'Miliar rupiah, total 118,7', 5, 4,
        ['Barang modal', 'Jasa konsultansi', 'Konstruksi', 'ATK & umum', 'Lainnya'], [
          { name: 'Nilai pengadaan', data: [48.2, 26.4, 21.8, 14.6, 7.7] },
        ], 'miliar Rp'),
      tabel('tabel-ringkas', 'Paket per Kategori', 'Jumlah paket, total 284', 7, 4,
        ['Kategori', 'Paket', 'Nilai', 'Porsi'],
        [
          ['Barang modal', 86, 'Rp 48,2 M', '40,6%'],
          ['Jasa konsultansi', 64, 'Rp 26,4 M', '22,2%'],
          ['Konstruksi', 38, 'Rp 21,8 M', '18,4%'],
          ['ATK & umum', 72, 'Rp 14,6 M', '12,3%'],
          ['Lainnya', 24, 'Rp 7,7 M', '6,5%'],
        ]),
    ],
  },
  {
    judul: 'Evaluasi Vendor',
    sub: 'Kondisi umum dan sebaran kualitas vendor',
    kartu: [
      kpi(3, 'Vendor Aktif', 'Bertransaksi 2026', '63', 'vendor', 'building', -4.5),
      kpi(3, 'Vendor Baru', 'Terdaftar sepanjang 2026', '14', 'vendor', 'user-plus', 16.7),
      kpi(3, 'Vendor Bermasalah', 'Masuk daftar evaluasi', '12', 'vendor', 'alert-triangle', 20.0),
      kpi(3, 'Vendor Dinonaktifkan', 'Dikeluarkan dari daftar', '5', 'vendor', 'user-minus', 25.0),
      grafik('bar', 'bar-tegak', 'Sebaran Vendor per Peringkat', 'Jumlah vendor, skor 1–5', 12, 4,
        ['Skor 5', 'Skor 4', 'Skor 3', 'Skor 2', 'Skor 1'], [
          { name: 'Jumlah vendor', data: [9, 24, 18, 8, 4] },
        ], 'vendor'),
    ],
  },
  {
    judul: 'Vendor Performance Scorecard',
    sub: 'Penilaian vendor: ketepatan, mutu, harga, respons',
    kartu: [
      grafik('hbar', 'bar-mendatar-peringkat', 'Skor Vendor Tertinggi', 'Skor gabungan 1–100', 7, 4,
        ['Vendor A', 'Vendor B', 'Vendor C', 'Vendor D', 'Vendor E'], [
          { name: 'Skor', data: [94, 91, 88, 85, 82] },
        ], 'poin'),
      tabel('tabel-status', 'Rekap Penilaian Vendor', 'Skor dan status evaluasi', 7, 4,
        ['Vendor', 'Skor', 'Ketepatan', 'Status'],
        [
          ['Vendor A', 94, '98%', 'Baik'],
          ['Vendor B', 91, '95%', 'Baik'],
          ['Vendor C', 88, '92%', 'Baik'],
          ['Vendor D', 85, '88%', 'Pantau'],
          ['Vendor E', 82, '84%', 'Pantau'],
          ['Vendor F', 68, '71%', 'Evaluasi'],
        ]),
    ],
  },
  {
    judul: 'Permasalahan Pengadaan',
    sub: 'Isu utama dan dampaknya terhadap kinerja',
    kartu: [
      tabel('papan-isu', 'Permasalahan Utama', 'Dampak dan tindakan awal', 7, 4,
        ['Masalah', 'Dampak', 'Tindakan'],
        [
          ['34 paket terlambat', 'Operasional tertunda', 'Evaluasi vendor'],
          ['Spesifikasi berubah', 'Revisi PO', 'Standarisasi'],
          ['Stok kosong mendadak', 'Pembelian darurat', 'Buffer stok'],
          ['Dokumen vendor tidak lengkap', 'Proses tertahan', 'Verifikasi awal'],
          ['Harga acuan kedaluwarsa', 'Saving turun', 'Perbarui acuan'],
        ]),
      poin('Akar Masalah', 'Analisis penyebab dan mitigasi', 7, 6,
        'Tiga akar masalah menjelaskan sebagian besar keterlambatan; dua di antaranya bisa dicegah lewat perbaikan proses internal.',
        [
          'Perencanaan kebutuhan terlambat (12 kasus)',
          'Spesifikasi teknis tidak baku (9 kasus)',
          'Kapasitas vendor terbatas (7 kasus)',
          'Koordinasi antar-unit lemah (6 kasus)',
          'Dokumen pendukung tidak lengkap (5 kasus)',
        ]),
    ],
  },
  {
    judul: 'Efisiensi Pengadaan',
    sub: 'Value for money, negosiasi, dan penghematan',
    kartu: [
      kpi(3, 'Cost Saving', 'Dibanding harga acuan', '9,7', 'miliar Rp', 'trending-down', 12.8),
      kpi(3, 'Rasio Saving', 'Terhadap nilai pengadaan', '7,6', '%', 'percent', 0.8),
      kpi(3, 'Paket Tender', 'Dibanding penunjukan langsung', '94', 'paket', 'file-check', 11.9),
      kpi(3, 'Siklus PO', 'Rata-rata dari permintaan', '18', 'hari', 'clock', -8.3),
      grafik('bar', 'bar-tegak-target', 'Cost Saving per Kuartal', 'Miliar rupiah, target 2,4 per kuartal', 12, 4,
        ['Kuartal 1', 'Kuartal 2', 'Kuartal 3', 'Kuartal 4'], [
          { name: 'Saving', data: [2.1, 2.6, 2.8, 2.2] },
          { name: 'Target', data: [2.4, 2.4, 2.4, 2.4], kind: 'line' },
        ], 'miliar Rp'),
    ],
  },
  {
    judul: 'Cost Saving & Efisiensi',
    sub: 'Target, realisasi, dan sumber penghematan',
    kartu: [
      kpi(4, 'Target Saving', 'Penetapan awal 2026', '10,0', 'miliar Rp', 'target', 0),
      kpi(4, 'Realisasi Saving', 'Sampai Desember 2026', '9,7', 'miliar Rp', 'wallet', 12.8),
      kpi(4, 'Gap', 'Terhadap target', '-0,3', 'miliar Rp', 'alert-triangle', -103.0,
        'Kurang 3% dari target'),
      grafik('bar', 'bar-tegak', 'Sumber Penghematan', 'Miliar rupiah', 12, 4,
        ['Negosiasi harga', 'Konsolidasi paket', 'Perubahan spesifikasi', 'Tender ulang', 'Lainnya'], [
          { name: 'Saving', data: [4.2, 2.6, 1.4, 1.0, 0.5] },
        ], 'miliar Rp'),
    ],
  },
  {
    judul: 'Pipeline Pengadaan',
    sub: 'Tahapan proses dan status tiap paket',
    kartu: [
      grafik('hbar', 'alur-tahap', 'Tahapan Pengadaan', 'Jumlah paket berjalan per tahap', 7, 4,
        ['Permintaan', 'Review anggaran', 'Tender', 'Evaluasi', 'Kontrak', 'Pembayaran'], [
          { name: 'Paket', data: [42, 31, 26, 18, 22, 14] },
        ], 'paket'),
      tabel('daftar-progres', 'Status Paket Berjalan', 'Paket kritis dan progresnya', 7, 4,
        ['Paket', 'Progres', 'Status'],
        [
          ['Armada operasional', '85%', 'On progress'],
          ['Sistem informasi', '62%', 'On progress'],
          ['Renovasi gedung', '40%', 'Pending'],
          ['Peralatan laboratorium', '28%', 'Pending'],
          ['Jasa keamanan', '94%', 'Hampir selesai'],
        ]),
    ],
  },
  {
    judul: 'Rencana Pengadaan 2027',
    sub: 'Kebutuhan, anggaran, dan jadwal pengadaan',
    kartu: [
      kpi(4, 'Pagu 2027', 'Usulan anggaran', '142,6', 'miliar Rp', 'target', 11.1),
      kpi(4, 'Jumlah Paket', 'Rencana paket 2027', '312', 'paket', 'file-text', 9.9),
      kpi(4, 'Paket Prioritas', 'Harus selesai kuartal 1', '48', 'paket', 'alert-triangle', 14.3),
      tabel('tabel-status', 'Rencana Paket Prioritas', 'Nilai dan jadwal pengadaan 2027', 12, 4,
        ['Paket', 'Nilai', 'Jadwal', 'Status'],
        [
          ['Armada operasional', 'Rp 24,8 M', 'Kuartal 1', 'Disetujui'],
          ['Sistem informasi', 'Rp 18,2 M', 'Kuartal 1', 'Disetujui'],
          ['Renovasi gedung', 'Rp 12,4 M', 'Kuartal 2', 'Diajukan'],
          ['Peralatan laboratorium', 'Rp 9,6 M', 'Kuartal 2', 'Diajukan'],
          ['Jasa keamanan', 'Rp 6,8 M', 'Kuartal 3', 'Draft'],
        ]),
    ],
  },
  {
    judul: 'Action Plan',
    sub: 'Tindakan, penanggung jawab, dan tenggat',
    kartu: [
      tabel('alur-tahap', 'Action Plan 2027', 'Tindakan dan tenggat', 12, 4,
        ['Tindakan', 'PIC', 'Tenggat', 'Status'],
        [
          ['Standarisasi spesifikasi teknis', 'Divisi Pengadaan', 'Jan 2027', 'Berjalan'],
          ['Perbarui harga acuan', 'Divisi Keuangan', 'Feb 2027', 'Berjalan'],
          ['Buffer stok material kritis', 'Divisi Operasional', 'Mar 2027', 'Rencana'],
          ['Verifikasi dokumen vendor di awal', 'Divisi Pengadaan', 'Jan 2027', 'Berjalan'],
          ['Evaluasi 12 vendor bermasalah', 'Tim Evaluasi', 'Feb 2027', 'Rencana'],
          ['Konsolidasi paket ATK', 'Divisi Umum', 'Apr 2027', 'Rencana'],
        ]),
    ],
  },
  {
    judul: 'Target & KPI 2027',
    sub: 'Fokus peningkatan kinerja pengadaan',
    kartu: [
      sasaran(4, 'Cost Saving', 9.7, 12.0, 'miliar Rp', '≥', 'wallet'),
      sasaran(4, 'On-time Delivery', 92.4, 96, '%', '≥', 'truck'),
      sasaran(4, 'Siklus PO', 18, 14, 'hari', '≤', 'clock'),
      sasaran(4, 'Kepatuhan Vendor', 88, 95, '%', '≥', 'shield-check'),
      sasaran(4, 'Serapan Anggaran', 92.5, 97, '%', '≥', 'target'),
      sasaran(4, 'PO Tanpa Revisi', 82, 90, '%', '≥', 'file-check'),
    ],
  },
  {
    // Dulu dua halaman ("Closing" dan "Penutup") dengan isi hampir sama.
    judul: 'Penutup',
    sub: 'Efisiensi, mutu, dan ketepatan waktu',
    kartu: [
      teks('Penutup Rapat', 'Pengadaan yang efisien menopang operasional', 12, 3,
        'Pengadaan bukan sekadar membelanjakan anggaran, tetapi memastikan barang dan jasa tersedia tepat waktu dengan harga yang wajar. Tiga prioritas 2027: perbaiki perencanaan, standarkan spesifikasi, dan perkuat evaluasi vendor. Keterlambatan 2026 sebagian besar berakar pada perencanaan yang lemah, sehingga perencanaan menjadi prioritas utama. Seluruh action plan pada rapat ini menjadi dasar penyusunan RKA 2027.'),
      kpi(3, 'Nilai Pengadaan', 'Realisasi 2026', '118,7', 'miliar Rp', 'wallet', 6.4),
      kpi(3, 'Cost Saving', 'Sepanjang 2026', '9,7', 'miliar Rp', 'trending-down', 12.8),
      kpi(3, 'On-time Delivery', 'Rata-rata 2026', '92,4', '%', 'truck', 3.1),
      kpi(3, 'Paket Selesai', 'Dari 284 paket', '250', 'paket', 'file-check', 8.2),
    ],
  },
];

export const TEMPLATE_PROCUREMENT: DashboardTemplate = {
  id: `${PREFIKS_TEMPLATE_DECK}procurement`,
  nama: 'Procurement Meeting',
  kategoriId: 'pengadaan',
  tujuan:
    'Rapat manajemen pengadaan: nilai pengadaan, ketepatan pengiriman, cost saving, anggaran vs realisasi, analisis per kategori, evaluasi dan kinerja vendor, permasalahan, efisiensi, pipeline, rencana pengadaan, action plan, dan target KPI 2027.',
  caraPenyampaian: `Deck ${HALAMAN.length} halaman, satu halaman satu topik: ${HALAMAN.map((h) => h.judul).join(', ')}. Gaya tampilan dipilih terpisah di galeri.`,
  deskripsi:
    'Deck rapat pengadaan: KPI pengadaan, anggaran vs realisasi, analisis kategori, evaluasi & kinerja vendor, permasalahan, efisiensi & cost saving, pipeline, rencana 2027, action plan, dan KPI 2027.',
  fokus: [
    'Nilai & ketepatan pengadaan',
    'Anggaran vs realisasi',
    'Analisis per kategori',
    'Evaluasi & kinerja vendor',
    'Permasalahan pengadaan',
    'Efisiensi & cost saving',
    'Pipeline & rencana 2027',
    'Action plan',
    'Target & KPI 2027',
  ],
  aksen: '#1e6fd9',
  tema: 'korporat',
  judulDashboard: 'Procurement Meeting 2026 — PT. Sandy Putra Makmur',
  deskripsiDashboard:
    'Rapat bagian pengadaan 2026: nilai pengadaan dan ketepatan pengiriman, cost saving, anggaran versus realisasi, analisis pengadaan per kategori, evaluasi dan kinerja vendor, permasalahan pengadaan, efisiensi, pipeline dan rencana pengadaan 2027, action plan, serta target KPI 2027. Angka diambil dari dokumen instansi.',
  widgets: HALAMAN.flatMap((h) => h.kartu),
  bagian: {
    unit: 'Pengadaan',
    halaman: HALAMAN.map((h) => ({ judul: h.judul, sub: h.sub, jumlah: h.kartu.length })),
    kunci: /procurement|pengadaan|vendor|sandy\s*putra/i,
  },
};
