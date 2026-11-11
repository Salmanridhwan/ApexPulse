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
 *
 * Setiap halaman diisi chart supaya slide dan mode presentasi tidak kosong.
 * Jenis chart yang sama tidak dipakai di dua halaman bersebelahan, dan tiap
 * halaman disusun pas 7 baris grid (batas `pasHalaman`).
 */

const { k, kpi, sasaran, poin, teks, grafik, tabel } = alatDeck('prcr', 'Pengadaan');

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const KUARTAL = ['Kuartal 1', 'Kuartal 2', 'Kuartal 3', 'Kuartal 4'];
const KATEGORI = ['Barang modal', 'Jasa konsultansi', 'Konstruksi', 'ATK & umum', 'Lainnya'];

/** Kartu jadwal gantt: tugas bertanggal ISO, progres 0-100. */
const gantt = (
  title: string,
  sub: string,
  w: number,
  h: number,
  tasks: Array<{ name: string; start: string; end: string; progress: number }>
): WidgetSpec => {
  const kartu = grafik('gantt', 'jadwal-gantt', title, sub, w, h,
    tasks.map((t) => t.name), [{ name: 'Progres', data: tasks.map((t) => t.progress) }], '%');
  return { ...kartu, gantt: { tasks } } as WidgetSpec;
};

const HALAMAN: Array<{ judul: string; sub: string; kartu: WidgetSpec[] }> = [
  // 1 -----------------------------------------------------------------------
  {
    judul: 'Agenda Meeting',
    sub: 'Pokok bahasan rapat pengadaan 2026',
    kartu: [
      poin('Agenda — Evaluasi 2026', 'Bagian 1 dari 2', 4, 7,
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
      poin('Agenda — Rencana 2027', 'Bagian 2 dari 2', 4, 7,
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
      // Per bulan menjumlah ke realisasi per kuartal halaman 3 (26,4, 31,8, 34,2, 26,3 = 118,7).
      grafik('area', 'area-gradasi', 'Nilai Pengadaan per Bulan', 'Miliar rupiah, 2026', 4, 4, BULAN, [
        { name: 'Realisasi', data: [7.8, 8.6, 10.0, 9.8, 10.6, 11.4, 11.0, 11.6, 11.6, 9.2, 8.4, 8.7] },
      ], 'miliar Rp'),
      // 250 selesai (halaman 14) + 26 berjalan + 8 kritis = 284 paket.
      grafik('donut', 'donat-tipis', 'Status Paket 2026', 'Paket, total 284', 4, 3,
        ['Selesai', 'Berjalan', 'Kritis'], [{ name: 'Paket', data: [250, 26, 8] }], 'paket'),
    ],
  },

  // 2 -----------------------------------------------------------------------
  {
    judul: 'Executive Summary',
    sub: 'Dashboard KPI pengadaan 2026',
    kartu: [
      kpi(2, 'Nilai Pengadaan', 'Realisasi tahun berjalan', '118,7', 'miliar Rp', 'wallet', 6.4),
      kpi(2, 'Pengiriman Tepat Waktu', 'Rata-rata tahun berjalan', '92,4', '%', 'truck', 3.1),
      kpi(2, 'Cost Saving', 'Dibanding harga acuan', '9,7', 'miliar Rp', 'trending-down', 12.8),
      kpi(2, 'Realisasi Anggaran', 'Terhadap pagu 2026', '92,5', '%', 'target', 2.2),
      kpi(2, 'Jumlah Paket', 'Paket pengadaan 2026', '284', 'paket', 'file-text', 7.6),
      kpi(2, 'Vendor Aktif', 'Terdaftar dan bertransaksi', '63', 'vendor', 'building', -4.5),
      // Rata-rata 12 bulan = 92,4% (sama dengan KPI).
      grafik('line', 'garis-tren', 'Pengiriman Tepat Waktu', 'Persen per bulan, 2026', 4, 4, BULAN, [
        { name: 'On-time delivery', data: [90.1, 90.8, 91.5, 92.0, 92.6, 93.0, 93.4, 93.1, 92.8, 93.5, 93.2, 92.8] },
      ], '%'),
      grafik('gauge', 'gauge-target', 'Realisasi Anggaran', 'Terhadap pagu Rp 128,4 miliar', 3, 4,
        ['Realisasi'], [{ name: 'Realisasi', data: [92.5] }], '%'),
      teks('Headline Management', 'Pertanyaan kunci rapat', 5, 4,
        'Apakah pengadaan 2026 berjalan efisien tanpa mengorbankan mutu dan ketepatan waktu? Nilai pengadaan Rp 118,7 miliar atau 92,5% dari pagu, dengan cost saving Rp 9,7 miliar. Yang perlu perhatian: 34 paket terlambat, 12 vendor masuk daftar evaluasi, dan 8 paket masih berstatus kritis menjelang tutup tahun.'),
    ],
  },

  // 3 -----------------------------------------------------------------------
  {
    judul: 'Budget vs Realisasi Pengadaan',
    sub: 'Pagu, komitmen, realisasi, dan sisa anggaran',
    kartu: [
      kpi(3, 'Pagu Anggaran', 'Penetapan 2026', '128,4', 'miliar Rp', 'target', 5.1),
      kpi(3, 'Komitmen', 'Sudah dikontrakkan', '112,3', 'miliar Rp', 'file-check', 6.8),
      kpi(3, 'Realisasi', 'Sudah dibayar', '118,7', 'miliar Rp', 'wallet', 6.4),
      kpi(3, 'Sisa Anggaran', 'Belum terserap', '9,7', 'miliar Rp', 'receipt', -18.3),
      grafik('combo', 'combo-batang-garis', 'Pagu vs Realisasi per Kuartal', 'Miliar rupiah, 2026', 8, 4,
        KUARTAL, [
          { name: 'Pagu', data: [32.1, 32.1, 32.1, 32.1], kind: 'bar' },
          { name: 'Realisasi', data: [26.4, 31.8, 34.2, 26.3], kind: 'bar' },
          { name: 'Serapan kumulatif', data: [26.4, 58.2, 92.4, 118.7], kind: 'line' },
        ], 'miliar Rp'),
      // Nilai pertama dan terakhir total: 128,4 - realisasi 4 kuartal = sisa 9,7.
      grafik('waterfall', 'air-terjun', 'Dari Pagu ke Sisa Anggaran', 'Miliar rupiah, 2026', 4, 4,
        ['Pagu', 'Kuartal 1', 'Kuartal 2', 'Kuartal 3', 'Kuartal 4', 'Sisa'],
        [{ name: 'Anggaran', data: [128.4, -26.4, -31.8, -34.2, -26.3, 9.7] }], 'miliar Rp'),
    ],
  },

  // 4 -----------------------------------------------------------------------
  {
    judul: 'Analisis Pengadaan per Kategori',
    sub: 'Sebaran nilai dan jumlah paket per kategori',
    kartu: [
      grafik('donut', 'donat-tebal', 'Nilai Pengadaan per Kategori', 'Miliar rupiah, total 118,7', 4, 4,
        KATEGORI, [
          { name: 'Nilai pengadaan', data: [48.2, 26.4, 21.8, 14.6, 7.7] },
        ], 'miliar Rp'),
      tabel('tabel-ringkas', 'Paket per Kategori', 'Jumlah paket, total 284', 8, 4,
        ['Kategori', 'Paket', 'Nilai', 'Porsi'],
        [
          ['Barang modal', 86, 'Rp 48,2 M', '40,6%'],
          ['Jasa konsultansi', 64, 'Rp 26,4 M', '22,2%'],
          ['Konstruksi', 38, 'Rp 21,8 M', '18,4%'],
          ['ATK & umum', 72, 'Rp 14,6 M', '12,3%'],
          ['Lainnya', 24, 'Rp 7,7 M', '6,5%'],
        ]),
      // X = paket, Y = nilai (sama dengan tabel), ukuran = saving per kategori
      // (3,9 + 2,0 + 1,9 + 1,3 + 0,6 = 9,7, dipakai lagi di treemap halaman 9).
      grafik('bubble', 'scatter-gelembung', 'Paket vs Nilai per Kategori', 'Ukuran gelembung = cost saving', 6, 3,
        KATEGORI, [
          { name: 'Jumlah paket', data: [86, 64, 38, 72, 24] },
          { name: 'Nilai (miliar Rp)', data: [48.2, 26.4, 21.8, 14.6, 7.7] },
          { name: 'Saving (miliar Rp)', data: [3.9, 2.0, 1.9, 1.3, 0.6] },
        ], ''),
      // Nilai dibagi jumlah paket, misalnya 48,2 miliar / 86 paket = 560 juta.
      grafik('bar', 'bar-tegak-sorot', 'Nilai Rata-rata per Paket', 'Juta rupiah per paket', 6, 3,
        KATEGORI, [{ name: 'Rata-rata', data: [560, 413, 574, 203, 321] }], 'juta Rp'),
    ],
  },

  // 5 -----------------------------------------------------------------------
  {
    judul: 'Evaluasi Vendor',
    sub: 'Kondisi umum dan sebaran kualitas vendor',
    kartu: [
      kpi(3, 'Vendor Aktif', 'Bertransaksi 2026', '63', 'vendor', 'building', -4.5),
      kpi(3, 'Vendor Baru', 'Terdaftar sepanjang 2026', '14', 'vendor', 'user-plus', 16.7),
      kpi(3, 'Vendor Bermasalah', 'Masuk daftar evaluasi', '12', 'vendor', 'alert-triangle', 20.0),
      kpi(3, 'Vendor Dinonaktifkan', 'Dikeluarkan dari daftar', '5', 'vendor', 'user-minus', 25.0),
      grafik('bar', 'bar-tegak', 'Sebaran Vendor per Peringkat', 'Jumlah vendor, skor 1–5', 5, 4,
        ['Skor 5', 'Skor 4', 'Skor 3', 'Skor 2', 'Skor 1'], [
          { name: 'Jumlah vendor', data: [9, 24, 18, 8, 4] },
        ], 'vendor'),
      // Vendor aktif 2025 = 66 (turun 4,5% jadi 63): 49 bertahan + 12 tidak
      // bertransaksi + 5 dinonaktifkan. 2026: 49 bertahan + 14 baru = 63.
      grafik('sankey', 'sankey-alur', 'Arus Vendor 2025 ke 2026', 'Jumlah vendor', 4, 4,
        ['Vendor 2025 > Bertahan', 'Vendor 2025 > Tidak bertransaksi', 'Vendor 2025 > Dinonaktifkan',
          'Bertahan > Aktif 2026', 'Vendor baru > Aktif 2026'],
        [{ name: 'Vendor', data: [49, 12, 5, 49, 14] }], 'vendor'),
      // Rata-rata tertimbang sebaran peringkat: 215 / 63 = 3,4.
      grafik('gauge', 'gauge-kesehatan', 'Skor Rata-rata Vendor', 'Skala 1-5, 63 vendor aktif', 3, 4,
        ['Skor'], [{ name: 'Skor', data: [3.4] }], 'skor'),
    ],
  },

  // 6 -----------------------------------------------------------------------
  {
    judul: 'Vendor Performance Scorecard',
    sub: 'Penilaian vendor: ketepatan, mutu, harga, respons',
    kartu: [
      grafik('hbar', 'bar-mendatar-peringkat', 'Skor Vendor Tertinggi', 'Skor gabungan 1–100', 5, 4,
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
      // Ketepatan sama dengan tabel (98% dan 71%).
      grafik('radar', 'radar-aspek', 'Vendor Terbaik vs Terendah', 'Skor per aspek, 1–100', 6, 3,
        ['Ketepatan', 'Mutu', 'Harga', 'Respons', 'Dokumen'], [
          { name: 'Vendor A', data: [98, 95, 90, 94, 92] },
          { name: 'Vendor F', data: [71, 70, 65, 68, 66] },
        ], 'poin'),
      // Kotak sebaran digambar dari sampel mentah (`boxRaw`), satu larik per kategori.
      (() => {
        const kartu = grafik('boxplot', 'kotak-sebaran', 'Sebaran Skor Vendor per Kategori', 'Skor gabungan 1–100', 6, 3,
          ['Barang modal', 'Jasa konsultansi', 'Konstruksi', 'ATK & umum'],
          [{ name: 'Median', data: [84, 86, 76, 80] }], 'poin');
        return {
          ...kartu,
          chart: {
            ...kartu.chart!,
            boxRaw: [
              [70, 78, 82, 84, 88, 91, 94],
              [74, 80, 85, 86, 89, 92],
              [62, 68, 72, 76, 80, 85],
              [66, 74, 78, 80, 83, 88, 90],
            ],
          },
        } as WidgetSpec;
      })(),
    ],
  },

  // 7 -----------------------------------------------------------------------
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
      poin('Akar Masalah', 'Analisis penyebab dan mitigasi', 5, 7,
        'Tiga akar masalah menjelaskan sebagian besar keterlambatan; dua di antaranya bisa dicegah lewat perbaikan proses internal.',
        [
          'Perencanaan kebutuhan terlambat (12 kasus)',
          'Spesifikasi teknis tidak baku (9 kasus)',
          'Kapasitas vendor terbatas (7 kasus)',
          'Koordinasi antar-unit lemah (6 kasus)',
          'Dokumen pendukung tidak lengkap (5 kasus)',
        ]),
      // Jumlah sel = 34 paket terlambat (14 + 6 + 8 + 4 + 2).
      grafik('heatmap', 'peta-panas', 'Paket Terlambat per Kategori', 'Jumlah paket per kuartal, 2026', 7, 3,
        KUARTAL, [
          { name: 'Barang modal', data: [3, 4, 5, 2] },
          { name: 'Jasa konsultansi', data: [1, 2, 2, 1] },
          { name: 'Konstruksi', data: [1, 2, 3, 2] },
          { name: 'ATK & umum', data: [0, 1, 1, 2] },
          { name: 'Lainnya', data: [0, 1, 0, 1] },
        ], 'paket'),
    ],
  },

  // 8 -----------------------------------------------------------------------
  {
    judul: 'Efisiensi Pengadaan',
    sub: 'Value for money, negosiasi, dan penghematan',
    kartu: [
      kpi(3, 'Cost Saving', 'Dibanding harga acuan', '9,7', 'miliar Rp', 'trending-down', 12.8),
      kpi(3, 'Rasio Saving', 'Terhadap harga acuan', '7,6', '%', 'percent', 0.8),
      kpi(3, 'Paket Tender', 'Dibanding penunjukan langsung', '94', 'paket', 'file-check', 11.9),
      kpi(3, 'Siklus PO', 'Rata-rata dari permintaan', '18', 'hari', 'clock', -8.3),
      grafik('bar', 'bar-tegak-target', 'Cost Saving per Kuartal', 'Miliar rupiah, target 2,4 per kuartal', 4, 4,
        KUARTAL, [
          { name: 'Saving', data: [2.1, 2.6, 2.8, 2.2] },
          { name: 'Target', data: [2.4, 2.4, 2.4, 2.4], kind: 'line' },
        ], 'miliar Rp'),
      // Harga acuan = nilai kontrak + saving per kuartal. Total acuan 128,4,
      // jadi rasio saving 9,7 / 128,4 = 7,6% (sama dengan KPI).
      grafik('area', 'area-banding', 'Harga Acuan vs Nilai Kontrak', 'Miliar rupiah per kuartal', 4, 4,
        KUARTAL, [
          { name: 'Harga acuan', data: [28.5, 34.4, 37.0, 28.5] },
          { name: 'Nilai kontrak', data: [26.4, 31.8, 34.2, 26.3] },
        ], 'miliar Rp'),
      // Rata-rata tertimbang jumlah paket (86, 64, 38, 72, 24) = 17,7, dibulatkan 18 hari.
      grafik('scatter', 'titik-bersumbu', 'Siklus PO per Kategori', 'Rata-rata hari dari permintaan', 4, 4,
        KATEGORI, [{ name: 'Siklus PO', data: [19, 21, 27, 10, 13] }], 'hari'),
    ],
  },

  // 9 -----------------------------------------------------------------------
  {
    judul: 'Cost Saving & Efisiensi',
    sub: 'Target, realisasi, dan sumber penghematan',
    kartu: [
      kpi(4, 'Target Saving', 'Penetapan awal 2026', '10,0', 'miliar Rp', 'target', 0),
      kpi(4, 'Realisasi Saving', 'Sampai Desember 2026', '9,7', 'miliar Rp', 'wallet', 12.8),
      kpi(4, 'Gap', 'Terhadap target', '-0,3', 'miliar Rp', 'alert-triangle', -103.0,
        'Kurang 3% dari target'),
      grafik('bar', 'bar-tegak', 'Sumber Penghematan', 'Miliar rupiah', 5, 4,
        ['Negosiasi harga', 'Konsolidasi paket', 'Perubahan spesifikasi', 'Tender ulang', 'Lainnya'], [
          { name: 'Saving', data: [4.2, 2.6, 1.4, 1.0, 0.5] },
        ], 'miliar Rp'),
      // Sama dengan ukuran gelembung halaman 4, total 9,7.
      grafik('treemap', 'treemap-porsi', 'Saving per Kategori', 'Miliar rupiah, 2026', 4, 4,
        KATEGORI, [{ name: 'Saving', data: [3.9, 2.0, 1.9, 1.3, 0.6] }], 'miliar Rp'),
      // 9,7 / 10,0 = 97%.
      grafik('gauge', 'cincin-progres', 'Capaian Target Saving', 'Realisasi terhadap target 2026', 3, 4,
        ['Capaian'], [{ name: 'Capaian', data: [97] }], '%'),
    ],
  },

  // 10 ----------------------------------------------------------------------
  {
    judul: 'Pipeline Pengadaan',
    sub: 'Tahapan proses dan status tiap paket',
    kartu: [
      grafik('hbar', 'alur-tahap', 'Tahapan Pengadaan', 'Jumlah paket berjalan per tahap', 6, 4,
        ['Permintaan', 'Review anggaran', 'Tender', 'Evaluasi', 'Kontrak', 'Pembayaran'], [
          { name: 'Paket', data: [42, 31, 26, 18, 22, 14] },
        ], 'paket'),
      tabel('daftar-progres', 'Status Paket Berjalan', 'Paket kritis dan progresnya', 6, 4,
        ['Paket', 'Progres', 'Status'],
        [
          ['Armada operasional', '85%', 'On progress'],
          ['Sistem informasi', '62%', 'On progress'],
          ['Renovasi gedung', '40%', 'Pending'],
          ['Peralatan laboratorium', '28%', 'Pending'],
          ['Jasa keamanan', '94%', 'Hampir selesai'],
        ]),
      // Progres sama dengan tabel status di sampingnya.
      gantt('Jadwal Paket Berjalan', 'Progres per paket, persen', 8, 3, [
        { name: 'Armada operasional', start: '2026-03-02', end: '2026-12-18', progress: 85 },
        { name: 'Sistem informasi', start: '2026-05-04', end: '2027-02-26', progress: 62 },
        { name: 'Renovasi gedung', start: '2026-07-06', end: '2027-03-31', progress: 40 },
        { name: 'Peralatan laboratorium', start: '2026-08-03', end: '2027-04-30', progress: 28 },
        { name: 'Jasa keamanan', start: '2026-01-05', end: '2026-12-31', progress: 94 },
      ]),
      // Total 8 = paket kritis di Executive Summary.
      grafik('bar', 'bar-kapsul', 'Paket Melewati SLA', 'Paket kritis per tahap', 4, 3,
        ['Permintaan', 'Review', 'Tender', 'Evaluasi', 'Kontrak', 'Bayar'],
        [{ name: 'Paket', data: [1, 1, 3, 1, 2, 0] }], 'paket'),
    ],
  },

  // 11 ----------------------------------------------------------------------
  {
    judul: 'Rencana Pengadaan 2027',
    sub: 'Kebutuhan, anggaran, dan jadwal pengadaan',
    kartu: [
      kpi(4, 'Pagu 2027', 'Usulan anggaran', '142,6', 'miliar Rp', 'target', 11.1),
      kpi(4, 'Jumlah Paket', 'Rencana paket 2027', '312', 'paket', 'file-text', 9.9),
      kpi(4, 'Paket Prioritas', 'Harus selesai kuartal 1', '48', 'paket', 'alert-triangle', 14.3),
      tabel('tabel-status', 'Rencana Paket Prioritas', 'Nilai dan jadwal pengadaan 2027', 6, 4,
        ['Paket', 'Nilai', 'Jadwal', 'Status'],
        [
          ['Armada operasional', 'Rp 24,8 M', 'Kuartal 1', 'Disetujui'],
          ['Sistem informasi', 'Rp 18,2 M', 'Kuartal 1', 'Disetujui'],
          ['Renovasi gedung', 'Rp 12,4 M', 'Kuartal 2', 'Diajukan'],
          ['Peralatan laboratorium', 'Rp 9,6 M', 'Kuartal 2', 'Diajukan'],
          ['Jasa keamanan', 'Rp 6,8 M', 'Kuartal 3', 'Draft'],
        ]),
      // Total 142,6 = pagu 2027.
      grafik('donut', 'donat-tebal', 'Pagu 2027 per Kategori', 'Miliar rupiah, total 142,6', 3, 4,
        KATEGORI, [{ name: 'Pagu', data: [54.2, 30.8, 26.4, 19.6, 11.6] }], 'miliar Rp'),
      k.kartu('kpi', 'progres-target', 'Kesiapan Paket Prioritas', '48 paket yang harus selesai kuartal 1', 3, 4, {
        ikon: 'clipboard',
        kpi: {
          value: '65',
          unit: '%',
          targets: [
            { label: 'Spesifikasi final', persen: 81, status: 'mendekati' },
            { label: 'HPS tersusun', persen: 69, status: 'mendekati' },
            { label: 'Dokumen tender siap', persen: 46, status: 'perhatian' },
          ],
        },
      }),
    ],
  },

  // 12 ----------------------------------------------------------------------
  {
    judul: 'Action Plan',
    sub: 'Tindakan, penanggung jawab, dan tenggat',
    kartu: [
      tabel('alur-tahap', 'Action Plan 2027', 'Tindakan dan tenggat', 8, 4,
        ['Tindakan', 'PIC', 'Tenggat', 'Status'],
        [
          ['Standarisasi spesifikasi teknis', 'Divisi Pengadaan', 'Jan 2027', 'Berjalan'],
          ['Perbarui harga acuan', 'Divisi Keuangan', 'Feb 2027', 'Berjalan'],
          ['Buffer stok material kritis', 'Divisi Operasional', 'Mar 2027', 'Rencana'],
          ['Verifikasi dokumen vendor di awal', 'Divisi Pengadaan', 'Jan 2027', 'Berjalan'],
          ['Evaluasi 12 vendor bermasalah', 'Tim Evaluasi', 'Feb 2027', 'Rencana'],
          ['Konsolidasi paket ATK', 'Divisi Umum', 'Apr 2027', 'Rencana'],
        ]),
      // Rata-rata progres enam tindakan di gantt: (60 + 45 + 10 + 70 + 25 + 0) / 6 = 35.
      grafik('gauge', 'cincin-progres', 'Progres Action Plan', 'Rata-rata enam tindakan', 4, 4,
        ['Progres'], [{ name: 'Progres', data: [35] }], '%'),
      gantt('Jadwal Action Plan', 'Progres per tindakan, persen', 12, 3, [
        { name: 'Standarisasi spesifikasi', start: '2026-11-02', end: '2027-01-29', progress: 60 },
        { name: 'Perbarui harga acuan', start: '2026-11-16', end: '2027-02-26', progress: 45 },
        { name: 'Buffer stok kritis', start: '2027-01-04', end: '2027-03-31', progress: 10 },
        { name: 'Verifikasi dokumen vendor', start: '2026-11-02', end: '2027-01-29', progress: 70 },
        { name: 'Evaluasi 12 vendor', start: '2026-12-01', end: '2027-02-26', progress: 25 },
        { name: 'Konsolidasi paket ATK', start: '2027-02-01', end: '2027-04-30', progress: 0 },
      ]),
    ],
  },

  // 13 ----------------------------------------------------------------------
  {
    judul: 'Target & KPI 2027',
    sub: 'Fokus peningkatan kinerja pengadaan',
    kartu: [
      sasaran(2, 'Cost Saving', 9.7, 12.0, 'miliar Rp', '≥', 'wallet'),
      sasaran(2, 'On-time Delivery', 92.4, 96, '%', '≥', 'truck'),
      sasaran(2, 'Siklus PO', 18, 14, 'hari', '≤', 'clock'),
      sasaran(2, 'Kepatuhan Vendor', 88, 95, '%', '≥', 'shield-check'),
      sasaran(2, 'Serapan Anggaran', 92.5, 97, '%', '≥', 'target'),
      sasaran(2, 'PO Tanpa Revisi', 82, 90, '%', '≥', 'file-check'),
      // Posisi 2026 terhadap target 2027 (siklus PO dibalik: 14 / 18 = 78%).
      grafik('hbar', 'bar-mendatar-target', 'Posisi 2026 terhadap Target 2027', 'Persen capaian', 6, 4,
        ['Cost saving', 'On-time delivery', 'Siklus PO', 'Kepatuhan vendor', 'Serapan anggaran', 'PO tanpa revisi'], [
          { name: 'Capaian', data: [81, 96, 78, 93, 95, 91] },
          { name: 'Target', data: [100, 100, 100, 100, 100, 100] },
        ], '%'),
      // 2026 sama dengan sumber penghematan halaman 9 (9,7), 2027 menjumlah ke target 12,0.
      grafik('bar', 'bar-tumpuk', 'Cost Saving 2026 vs Target 2027', 'Miliar rupiah per sumber', 6, 4,
        ['Realisasi 2026', 'Target 2027'], [
          { name: 'Negosiasi harga', data: [4.2, 5.0] },
          { name: 'Konsolidasi paket', data: [2.6, 3.4] },
          { name: 'Perubahan spesifikasi', data: [1.4, 1.8] },
          { name: 'Tender ulang', data: [1.0, 1.2] },
          { name: 'Lainnya', data: [0.5, 0.6] },
        ], 'miliar Rp'),
    ],
  },

  // 14 ----------------------------------------------------------------------
  {
    // Dulu dua halaman ("Closing" dan "Penutup") dengan isi hampir sama.
    judul: 'Penutup',
    sub: 'Efisiensi, mutu, dan ketepatan waktu',
    kartu: [
      kpi(3, 'Nilai Pengadaan', 'Realisasi 2026', '118,7', 'miliar Rp', 'wallet', 6.4),
      kpi(3, 'Cost Saving', 'Sepanjang 2026', '9,7', 'miliar Rp', 'trending-down', 12.8),
      kpi(3, 'On-time Delivery', 'Rata-rata 2026', '92,4', '%', 'truck', 3.1),
      kpi(3, 'Paket Selesai', 'Dari 284 paket', '250', 'paket', 'file-check', 8.2),
      teks('Penutup Rapat', 'Pengadaan yang efisien menopang operasional', 5, 4,
        'Pengadaan bukan sekadar membelanjakan anggaran, tetapi memastikan barang dan jasa tersedia tepat waktu dengan harga yang wajar. Tiga prioritas 2027: perbaiki perencanaan, standarkan spesifikasi, dan perkuat evaluasi vendor. Keterlambatan 2026 sebagian besar berakar pada perencanaan yang lemah, sehingga perencanaan menjadi prioritas utama. Seluruh action plan pada rapat ini menjadi dasar penyusunan RKA 2027.'),
      // 284 paket, 268 dikontrakkan, 250 selesai, 205 tanpa revisi (82% PO tanpa revisi).
      grafik('funnel', 'corong-pipeline', 'Perjalanan Paket 2026', 'Jumlah paket', 4, 4,
        ['Direncanakan', 'Dikontrakkan', 'Selesai', 'Tanpa revisi'],
        [{ name: 'Paket', data: [284, 268, 250, 205] }], 'paket'),
      grafik('gauge', 'gauge-kesehatan', 'Skor Kinerja Pengadaan', 'Penilaian internal 2026, skala 1-5', 3, 4,
        ['Skor'], [{ name: 'Skor', data: [3.9] }], 'skor'),
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
