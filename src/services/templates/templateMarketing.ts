import type { WidgetSpec } from '../../types';
import type { DashboardTemplate } from './dashboardTemplates';
import { PREFIKS_TEMPLATE_DECK } from './templateBagian';
import { alatDeck } from './deckAlat';

/**
 * TEMPLATE DECK "MARKETING & SALES MANAGEMENT MEETING".
 *
 * Disusun dari deck *Marketing & Sales Management Meeting 2026 — Evaluasi
 * Kinerja & Strategi Pemasaran dan Penjualan, Periode 2026/2027*. Slide sampul
 * TIDAK dijadikan halaman: judulnya dipakai sebagai nama template. Slide
 * "Closing" dan "Penutup" digabung, jadi 14 halaman, satu halaman = satu slide:
 *
 *   1 Agenda Meeting              9 Revenue & Profitability
 *   2 Executive Summary          10 Permasalahan & Tantangan
 *   3 Kinerja Penjualan          11 Action Plan
 *   4 Analisa Pasar & Pelanggan  12 Target & KPI 2027
 *   5 Strategi Pemasaran         13 Program Kerja 2027
 *   6 Pipeline & Prospek         14 Penutup
 *   7 Aktivitas Promosi & Event
 *   8 Kinerja Tim Marketing & Sales
 *
 * Gaya (Pijar, Koran, Neon, ...) dipilih terpisah di galeri — template ini hanya
 * menentukan SUSUNAN, bukan tampilan. Semua angka di sini ANGKA CONTOH yang
 * saling konsisten (revenue Rp 186,4 miliar, 1.486 pelanggan aktif, konversi
 * 18,4%, margin kotor 32,6%); dashboard nyata diisi dari dokumen instansi.
 */

const { kpi, sasaran, poin, teks, grafik, tabel } = alatDeck('mktg', 'Pemasaran');

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const HALAMAN: Array<{ judul: string; sub: string; kartu: WidgetSpec[] }> = [
  {
    judul: 'Agenda Meeting',
    sub: 'Pokok bahasan rapat pemasaran & penjualan 2026',
    kartu: [
      poin('Agenda — Kinerja & Pasar', 'Bagian 1 dari 2', 6, 7,
        'Lima belas pokok bahasan, dibagi dua kolom agar terbaca satu layar.',
        [
          '1. Kinerja penjualan 2026',
          '2. Pertumbuhan revenue',
          '3. Analisa pasar dan pelanggan',
          '4. Segmentasi pelanggan',
          '5. Strategi pemasaran',
          '6. Bauran promosi',
          '7. Pipeline dan prospek',
          '8. Aktivitas promosi dan event',
        ]),
      poin('Agenda — Tim & Rencana', 'Bagian 2 dari 2', 6, 7,
        'Dilanjutkan kinerja tim, profitabilitas, tantangan, dan sasaran 2027.',
        [
          '9. Kinerja tim marketing & sales',
          '10. Revenue dan profitabilitas',
          '11. Permasalahan dan tantangan',
          '12. Action plan',
          '13. Target & KPI 2027',
          '14. Program kerja 2027',
          '15. Penutup',
        ]),
    ],
  },
  {
    judul: 'Executive Summary',
    sub: 'Dashboard KPI pemasaran & penjualan 2026',
    kartu: [
      kpi(4, 'Revenue', 'Realisasi tahun berjalan', '186,4', 'miliar Rp', 'wallet', 11.2),
      kpi(4, 'Pelanggan Aktif', 'Per Desember 2026', '1.486', 'pelanggan', 'users', 8.6),
      kpi(4, 'Konversi Prospek', 'Prospek menjadi pelanggan', '18,4', '%', 'target', 2.4),
      kpi(4, 'Margin Kotor', 'Terhadap revenue', '32,6', '%', 'trending-up', 1.8),
      kpi(4, 'Nilai Pipeline', 'Prospek berjalan', '42,8', 'miliar Rp', 'trending-up', 14.6),
      kpi(4, 'CAC', 'Biaya akuisisi per pelanggan', '1,24', 'juta Rp', 'receipt', -6.2),
      teks('Headline Management', 'Pertanyaan kunci rapat', 12, 2,
        'Apakah strategi pemasaran 2026 menghasilkan pertumbuhan yang sehat, bukan sekadar revenue naik? Revenue tumbuh 11,2% dengan 1.486 pelanggan aktif dan CAC turun 6,2%, tetapi konversi prospek masih 18,4% dari target 22% dan 3 kanal promosi menyumbang 71% pipeline. Fokus 2027: perluasan kanal dan perbaikan mutu prospek.'),
    ],
  },
  {
    judul: 'Kinerja Penjualan',
    sub: 'Realisasi penjualan bulanan dan pencapaian target',
    kartu: [
      kpi(4, 'Target Penjualan', 'Penetapan 2026', '180,0', 'miliar Rp', 'target', 0),
      kpi(4, 'Realisasi', 'Sampai Desember 2026', '186,4', 'miliar Rp', 'wallet', 11.2),
      kpi(4, 'Pencapaian Target', 'Realisasi terhadap target', '103,6', '%', 'trending-up', 3.6),
      kpi(4, 'Transaksi', 'Jumlah transaksi 2026', '8.426', 'transaksi', 'file-text', 9.4),
      grafik('combo', 'combo-batang-garis', 'Penjualan per Bulan vs Target', 'Miliar rupiah, 2026', 12, 4, BULAN, [
        { name: 'Realisasi', data: [12.4, 13.8, 14.2, 15.6, 14.8, 16.2, 15.4, 16.8, 15.2, 16.4, 17.2, 18.4] },
        { name: 'Target bulanan', data: [15.0, 15.0, 15.0, 15.0, 15.0, 15.0, 15.0, 15.0, 15.0, 15.0, 15.0, 15.0], kind: 'line' },
      ], 'miliar Rp'),
    ],
  },
  {
    judul: 'Analisa Pasar & Pelanggan',
    sub: 'Segmentasi pelanggan dan kontribusinya',
    kartu: [
      kpi(3, 'Pelanggan Aktif', 'Per Desember 2026', '1.486', 'pelanggan', 'users', 8.6),
      kpi(3, 'Pelanggan Baru', 'Sepanjang 2026', '486', 'pelanggan', 'user-plus', 16.2),
      kpi(3, 'Retensi', 'Pelanggan bertahan', '88,4', '%', 'refresh', 2.8),
      kpi(3, 'Nilai per Pelanggan', 'Rata-rata belanja tahunan', '125,4', 'juta Rp', 'wallet', 2.4),
      grafik('donut', 'donat-tebal', 'Revenue per Segmen', 'Miliar rupiah, total 186,4', 5, 4,
        ['Korporat', 'UKM', 'Ritel', 'Pemerintah', 'Lainnya'], [
          { name: 'Revenue', data: [84.2, 46.8, 32.4, 18.6, 4.4] },
        ], 'miliar Rp'),
      tabel('tabel-ringkas', 'Profil Pelanggan per Segmen', 'Jumlah dan kontribusi', 7, 4,
        ['Segmen', 'Pelanggan', 'Revenue', 'Porsi'],
        [
          ['Korporat', 186, 'Rp 84,2 M', '45,2%'],
          ['UKM', 624, 'Rp 46,8 M', '25,1%'],
          ['Ritel', 542, 'Rp 32,4 M', '17,4%'],
          ['Pemerintah', 84, 'Rp 18,6 M', '10,0%'],
          ['Lainnya', 50, 'Rp 4,4 M', '2,3%'],
        ]),
    ],
  },
  {
    judul: 'Strategi Pemasaran',
    sub: 'Bauran promosi dan efektivitas kanal',
    kartu: [
      kpi(3, 'Kanal Aktif', 'Kanal promosi berjalan', '8', 'kanal', 'target', 14.3),
      kpi(3, 'Biaya Promosi', 'Realisasi tahun berjalan', '9,6', 'miliar Rp', 'receipt', 7.8),
      kpi(3, 'ROAS', 'Revenue per biaya promosi', '19,4', 'kali', 'trending-up', 3.2),
      kpi(3, 'CAC', 'Biaya akuisisi per pelanggan', '1,24', 'juta Rp', 'percent', -6.2),
      grafik('hbar', 'bar-mendatar-peringkat', 'Efektivitas Kanal Promosi', 'Revenue per biaya, kali', 7, 4,
        ['Referensi', 'Digital ads', 'Media sosial', 'Event', 'Direct sales'], [
          { name: 'ROAS', data: [26.4, 21.8, 18.6, 12.4, 9.8] },
        ], 'kali'),
      poin('Catatan Strategi', 'Ringkasan arah pemasaran', 7, 4,
        'Tiga kanal menyumbang sebagian besar pipeline, sehingga ketergantungan perlu dikurangi.',
        [
          'Referensi memberi ROAS tertinggi 26,4x',
          'Tiga kanal teratas = 71% pipeline',
          'Event berbiaya tinggi, ROAS 12,4x',
          'Direct sales efektif untuk korporat',
        ]),
    ],
  },
  {
    judul: 'Pipeline & Prospek',
    sub: 'Tahapan prospek dan peluang yang berjalan',
    kartu: [
      kpi(3, 'Total Prospek', 'Sepanjang 2026', '2.642', 'prospek', 'users', 12.4),
      kpi(3, 'Nilai Pipeline', 'Peluang berjalan', '42,8', 'miliar Rp', 'trending-up', 14.6),
      kpi(3, 'Konversi', 'Prospek menjadi pelanggan', '18,4', '%', 'target', 2.4),
      kpi(3, 'Siklus Penjualan', 'Rata-rata sampai deal', '46', 'hari', 'clock', -8.6),
      grafik('hbar', 'alur-tahap', 'Pipeline per Tahap', 'Jumlah prospek per tahap', 7, 4,
        ['Lead masuk', 'Kualifikasi', 'Presentasi', 'Negosiasi', 'Menang'], [
          { name: 'Prospek', data: [2642, 1486, 842, 486, 486] },
        ], 'prospek'),
      tabel('daftar-progres', 'Prospek Bernilai Besar', 'Peluang kritis dan progresnya', 7, 4,
        ['Prospek', 'Nilai', 'Status'],
        [
          ['Klien korporat A', 'Rp 8,4 M', 'Negosiasi'],
          ['Klien korporat B', 'Rp 6,2 M', 'Presentasi'],
          ['Instansi pemerintah', 'Rp 4,8 M', 'Kualifikasi'],
          ['Klien UKM jaringan', 'Rp 3,6 M', 'Negosiasi'],
          ['Klien ritel besar', 'Rp 2,4 M', 'Presentasi'],
        ]),
    ],
  },
  {
    judul: 'Aktivitas Promosi & Event',
    sub: 'Kegiatan promosi, peserta, dan hasilnya',
    kartu: [
      kpi(3, 'Event', 'Sepanjang 2026', '42', 'event', 'calendar-check', 20.0),
      kpi(3, 'Peserta', 'Total kehadiran', '18.640', 'peserta', 'users', 16.8),
      kpi(3, 'Leads dari Event', 'Prospek masuk', '1.142', 'leads', 'trending-up', 11.4),
      kpi(3, 'Biaya per Lead', 'Efisiensi event', '148', 'ribu Rp', 'receipt', -9.2),
      grafik('bar', 'bar-tegak', 'Leads per Jenis Event', 'Jumlah leads, 2026', 12, 4,
        ['Webinar', 'Pameran', 'Workshop', 'Seminar', 'Lainnya'], [
          { name: 'Leads', data: [428, 326, 214, 124, 50] },
        ], 'leads'),
    ],
  },
  {
    judul: 'Kinerja Tim Marketing & Sales',
    sub: 'Produktivitas tim dan pencapaian per anggota',
    kartu: [
      kpi(3, 'Tim Marketing', 'Personel aktif', '24', 'orang', 'users', 9.1),
      kpi(3, 'Tim Sales', 'Personel aktif', '38', 'orang', 'user-check', 8.6),
      kpi(3, 'Revenue per Sales', 'Rata-rata tahunan', '4,9', 'miliar Rp', 'trending-up', 5.4),
      kpi(3, 'Produktivitas', 'Closing per sales per bulan', '18,4', 'deal', 'target', 6.2),
      grafik('hbar', 'bar-mendatar-peringkat', 'Sales Terbaik', 'Revenue, lima teratas', 7, 4,
        ['Sales 1', 'Sales 2', 'Sales 3', 'Sales 4', 'Sales 5'], [
          { name: 'Revenue', data: [12.4, 10.8, 9.6, 8.4, 7.2] },
        ], 'miliar Rp'),
      tabel('tabel-status', 'Pencapaian Tim', 'Target dan realisasi', 7, 4,
        ['Unit', 'Target', 'Realisasi', 'Status'],
        [
          ['Sales korporat', 'Rp 84 M', 'Rp 88,6 M', 'Tercapai'],
          ['Sales UKM', 'Rp 48 M', 'Rp 46,8 M', 'Mendekati'],
          ['Sales ritel', 'Rp 32 M', 'Rp 32,4 M', 'Tercapai'],
          ['Sales pemerintah', 'Rp 16 M', 'Rp 18,6 M', 'Tercapai'],
        ]),
    ],
  },
  {
    judul: 'Revenue & Profitability',
    sub: 'Pertumbuhan pendapatan dan profitabilitas',
    kartu: [
      kpi(3, 'Revenue', 'Realisasi tahun berjalan', '186,4', 'miliar Rp', 'wallet', 11.2),
      kpi(3, 'Biaya Penjualan', 'Termasuk promosi', '125,6', 'miliar Rp', 'receipt', 9.8),
      kpi(3, 'Gross Profit', 'Revenue dikurangi biaya', '60,8', 'miliar Rp', 'trending-up', 13.4),
      kpi(3, 'Margin Kotor', 'Terhadap revenue', '32,6', '%', 'percent', 1.8),
      grafik('combo', 'combo-batang-garis', 'Revenue vs Biaya vs Profit', 'Miliar rupiah', 12, 4,
        ['2024', '2025', 'Outlook 2026', 'RKA 2027'], [
          { name: 'Revenue', data: [142.8, 167.6, 186.4, 212.4], kind: 'bar' },
          { name: 'Biaya', data: [98.4, 114.4, 125.6, 141.2], kind: 'bar' },
          { name: 'Gross profit', data: [44.4, 53.2, 60.8, 71.2], kind: 'line' },
        ], 'miliar Rp'),
    ],
  },
  {
    judul: 'Permasalahan & Tantangan',
    sub: 'Isu utama pemasaran dan penjualan',
    kartu: [
      tabel('papan-isu', 'Permasalahan Utama', 'Dampak dan tindakan', 7, 4,
        ['Masalah', 'Dampak', 'Tindakan'],
        [
          ['Konversi prospek rendah', 'Pipeline menumpuk', 'Perbaiki kualifikasi'],
          ['Ketergantungan 3 kanal', 'Risiko tunggal', 'Buka kanal baru'],
          ['Kualitas leads event', 'CAC naik', 'Saring peserta'],
          ['Siklus penjualan panjang', 'Cash flow', 'Template penawaran'],
          ['Kapasitas sales terbatas', 'Prospek terlewat', 'Tambah personel'],
        ]),
      poin('Tantangan Pasar', 'Ringkasan hambatan eksternal', 7, 6,
        'Tekanan harga dan kompetisi menekan margin, sementara perilaku pembeli bergeser ke kanal digital.',
        [
          'Kompetitor menurunkan harga (11 kasus)',
          'Anggaran pelanggan dipangkas (9 kasus)',
          'Keputusan pembelian lebih panjang (8 kasus)',
          'Persaingan digital ads naik (7 kasus)',
          'Permintaan musiman (5 kasus)',
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
          ['Perbaiki skoring kualifikasi prospek', 'Tim Marketing', 'Jan 2027', 'Berjalan'],
          ['Buka dua kanal pemasaran baru', 'Tim Marketing', 'Feb 2027', 'Rencana'],
          ['Standardisasi template penawaran', 'Tim Sales', 'Jan 2027', 'Berjalan'],
          ['Saring peserta event berbayar', 'Tim Event', 'Mar 2027', 'Rencana'],
          ['Tambah tiga sales korporat', 'Divisi SDM', 'Kuartal 2', 'Rencana'],
          ['Dashboard pipeline mingguan', 'Divisi TI', 'Feb 2027', 'Rencana'],
        ]),
    ],
  },
  {
    judul: 'Target & KPI 2027',
    sub: 'Fokus pertumbuhan pemasaran dan penjualan',
    kartu: [
      sasaran(4, 'Revenue', 186.4, 212.4, 'miliar Rp', '≥', 'wallet'),
      sasaran(4, 'Pelanggan Aktif', 1486, 1720, 'pelanggan', '≥', 'users'),
      sasaran(4, 'Konversi Prospek', 18.4, 22, '%', '≥', 'target'),
      sasaran(4, 'Margin Kotor', 32.6, 34, '%', '≥', 'trending-up'),
      sasaran(4, 'CAC', 1.24, 1.10, 'juta Rp', '≤', 'receipt'),
      sasaran(4, 'Retensi Pelanggan', 88.4, 92, '%', '≥', 'refresh'),
    ],
  },
  {
    judul: 'Program Kerja 2027',
    sub: 'Program prioritas dan jadwal pelaksanaan',
    kartu: [
      tabel('daftar-progres', 'Program Kerja 2027', 'Program prioritas dan progresnya', 12, 4,
        ['Program', 'Sasaran', 'Jadwal', 'Status'],
        [
          ['Perluasan kanal digital', 'Pipeline +25%', 'Kuartal 1', 'Berjalan'],
          ['Program referral pelanggan', 'CAC turun 10%', 'Kuartal 1', 'Berjalan'],
          ['Akademi sales internal', 'Closing +20%', 'Kuartal 2', 'Rencana'],
          ['Otomasi tindak lanjut prospek', 'Siklus -15 hari', 'Kuartal 2', 'Rencana'],
          ['Ekspansi segmen pemerintah', 'Revenue +Rp 8 M', 'Kuartal 3', 'Rencana'],
          ['Riset kepuasan pelanggan', 'Retensi 92%', 'Kuartal 3', 'Rencana'],
        ]),
    ],
  },
  {
    // Dulu dua halaman ("Closing" dan "Penutup") dengan isi hampir sama.
    judul: 'Penutup',
    sub: 'Pertumbuhan yang sehat dan keputusan rapat',
    kartu: [
      teks('Penutup Rapat', 'Tumbuh tanpa mengorbankan margin', 12, 3,
        'Pertumbuhan yang sehat berarti revenue naik bersama margin dan basis pelanggan yang bertahan. Tiga prioritas 2027: perluas kanal agar tidak bergantung pada tiga sumber, perbaiki mutu prospek agar konversi naik, dan jaga CAC tetap turun. Keputusan rapat: membuka dua kanal pemasaran baru, menetapkan target konversi prospek 22%, dan menambah tiga personel sales korporat pada kuartal kedua 2027.'),
      kpi(3, 'Revenue', 'Realisasi 2026', '186,4', 'miliar Rp', 'wallet', 11.2),
      kpi(3, 'Pelanggan', 'Aktif per Desember', '1.486', 'pelanggan', 'users', 8.6),
      kpi(3, 'Konversi', 'Prospek menjadi pelanggan', '18,4', '%', 'target', 2.4),
      kpi(3, 'Margin Kotor', 'Terhadap revenue', '32,6', '%', 'trending-up', 1.8),
    ],
  },
];

export const TEMPLATE_MARKETING: DashboardTemplate = {
  id: `${PREFIKS_TEMPLATE_DECK}marketing`,
  nama: 'Marketing & Sales Management Meeting',
  kategoriId: 'pelayanan',
  tujuan:
    'Rapat manajemen pemasaran dan penjualan: kinerja penjualan, analisa pasar dan pelanggan, strategi dan bauran promosi, pipeline dan prospek, aktivitas promosi, kinerja tim, revenue dan profitabilitas, permasalahan, action plan, serta target KPI dan program kerja 2027.',
  caraPenyampaian: `Deck ${HALAMAN.length} halaman, satu halaman satu topik: ${HALAMAN.map((h) => h.judul).join(', ')}. Gaya tampilan dipilih terpisah di galeri.`,
  deskripsi:
    'Deck rapat pemasaran & penjualan: KPI penjualan, analisa pasar & segmen pelanggan, strategi dan efektivitas kanal, pipeline, promosi & event, kinerja tim sales, revenue & profitabilitas, tantangan, action plan, dan KPI 2027.',
  fokus: [
    'Kinerja penjualan',
    'Analisa pasar & pelanggan',
    'Strategi & bauran promosi',
    'Pipeline & prospek',
    'Aktivitas promosi & event',
    'Kinerja tim marketing & sales',
    'Revenue & profitabilitas',
    'Permasalahan & tantangan',
    'Action plan',
    'Target & KPI 2027',
    'Program kerja 2027',
  ],
  aksen: '#e2601c',
  tema: 'korporat',
  judulDashboard: 'Marketing & Sales Management Meeting 2026 — Evaluasi Kinerja & Strategi 2026/2027',
  deskripsiDashboard:
    'Rapat manajemen pemasaran dan penjualan 2026: kinerja penjualan bulanan, analisa pasar dan segmentasi pelanggan, strategi pemasaran dan efektivitas kanal, pipeline dan prospek, aktivitas promosi dan event, kinerja tim marketing dan sales, revenue dan profitabilitas, permasalahan dan tantangan, action plan, serta target KPI dan program kerja 2027. Angka diambil dari dokumen instansi.',
  widgets: HALAMAN.flatMap((h) => h.kartu),
  bagian: {
    unit: 'Pemasaran',
    halaman: HALAMAN.map((h) => ({ judul: h.judul, sub: h.sub, jumlah: h.kartu.length })),
    kunci: /marketing|sales|pemasaran|penjualan|prospek|pipeline\s*(penjualan|prospek)/i,
  },
};
