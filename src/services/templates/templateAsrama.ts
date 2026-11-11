import type { WidgetSpec } from '../../types';
import type { DashboardTemplate } from './dashboardTemplates';
import { PREFIKS_TEMPLATE_DECK } from './templateBagian';
import { alatDeck } from './deckAlat';

/**
 * TEMPLATE DECK "PENGELOLA ASRAMA MAHASISWA".
 *
 * Disusun dari deck *Pengelola Asrama Mahasiswa — Management Meeting 2026*.
 * Slide sampul TIDAK dijadikan halaman: judulnya dipakai sebagai nama template.
 * Slide "Closing" dan "Penutup" digabung, jadi 14 halaman, satu halaman = satu
 * slide:
 *
 *   1 Agenda Meeting                  8 Keamanan & Ketertiban
 *   2 Executive Summary               9 Aktivitas & Pembinaan
 *   3 Profil & Kapasitas Asrama      10 Keluhan & Service Recovery
 *   4 Data Penghuni Mahasiswa        11 Keuangan & Efisiensi
 *   5 Kualitas Pelayanan             12 Permasalahan & Risiko
 *   6 Kebersihan & Kenyamanan        13 Program Kerja & KPI 2027
 *   7 Fasilitas & Maintenance        14 Penutup
 *
 * Gaya (Pijar, Koran, Neon, ...) dipilih terpisah di galeri — template ini hanya
 * menentukan SUSUNAN, bukan tampilan. Semua angka di sini ANGKA CONTOH yang
 * saling konsisten (kapasitas 1.240 kamar, 1.486 penghuni, okupansi 92,6%,
 * pendapatan Rp 28,4 miliar); dashboard nyata diisi dari dokumen instansi.
 */

const { kpi, sasaran, poin, teks, grafik, tabel } = alatDeck('asrm', 'Asrama');

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const HALAMAN: Array<{ judul: string; sub: string; kartu: WidgetSpec[] }> = [
  {
    judul: 'Agenda Meeting',
    sub: 'Pokok bahasan rapat pengelolaan asrama 2026',
    kartu: [
      poin('Agenda — Kondisi & Layanan', 'Bagian 1 dari 2', 6, 7,
        'Empat belas pokok bahasan, dibagi dua kolom agar terbaca satu layar.',
        [
          '1. Profil dan kapasitas asrama',
          '2. Data penghuni mahasiswa',
          '3. Tingkat hunian (okupansi)',
          '4. Kualitas pelayanan',
          '5. Kebersihan dan kenyamanan',
          '6. Fasilitas dan maintenance',
          '7. Keamanan dan ketertiban',
        ]),
      poin('Agenda — Keuangan & Rencana', 'Bagian 2 dari 2', 6, 7,
        'Dilanjutkan pembinaan, keluhan, keuangan, dan sasaran tahun depan.',
        [
          '8. Aktivitas dan pembinaan mahasiswa',
          '9. Keluhan dan service recovery',
          '10. Keuangan dan efisiensi operasional',
          '11. Permasalahan dan risiko',
          '12. Program kerja',
          '13. Target & KPI 2027',
          '14. Penutup',
        ]),
    ],
  },
  {
    judul: 'Executive Summary',
    sub: 'Dashboard KPI pengelolaan asrama 2026',
    kartu: [
      kpi(4, 'Kapasitas Kamar', 'Total kamar tersedia', '1.240', 'kamar', 'building', 0),
      kpi(4, 'Penghuni Aktif', 'Mahasiswa tinggal', '1.486', 'orang', 'users', 6.8),
      kpi(4, 'Tingkat Hunian', 'Okupansi terhadap kapasitas', '92,6', '%', 'percent', 3.4),
      kpi(4, 'Kepuasan Penghuni', 'Skor layanan 1–5', '4,3', 'dari 5', 'star', 4.9),
      kpi(4, 'Keluhan Ditutup', 'Penyelesaian keluhan', '94,2', '%', 'message-square', 5.6),
      kpi(4, 'Pendapatan', 'Realisasi tahun berjalan', '28,4', 'miliar Rp', 'wallet', 7.2),
      teks('Headline Management', 'Pertanyaan kunci rapat', 12, 2,
        'Apakah pengelolaan asrama sudah memberi hunian yang aman, bersih, dan terjangkau tanpa membebani anggaran? Okupansi 92,6% dengan kepuasan 4,3 dari 5, tetapi 38 keluhan kebersihan belum tertutup dan biaya pemeliharaan naik 6,4%. Fokus 2027: perbaikan berjadwal dan digitalisasi layanan keluhan.'),
    ],
  },
  {
    judul: 'Profil & Kapasitas Asrama',
    sub: 'Gedung, kamar, dan daya tampung',
    kartu: [
      kpi(3, 'Gedung Asrama', 'Blok operasional', '6', 'gedung', 'building', 0),
      kpi(3, 'Total Kamar', 'Kamar tersedia', '1.240', 'kamar', 'door-open', 0),
      kpi(3, 'Kapasitas', 'Daya tampung maksimum', '1.604', 'orang', 'users', 0),
      kpi(3, 'Okupansi', 'Terisi per Desember 2026', '92,6', '%', 'percent', 3.4),
      grafik('donut', 'donat-tebal', 'Kamar per Gedung', 'Jumlah kamar, total 1.240', 5, 4,
        ['Gedung A', 'Gedung B', 'Gedung C', 'Gedung D', 'Gedung E', 'Gedung F'], [
          { name: 'Kamar', data: [280, 240, 220, 200, 180, 120] },
        ], 'kamar'),
      tabel('tabel-ringkas', 'Kapasitas per Tipe Kamar', 'Kamar dan daya tampung', 7, 4,
        ['Tipe kamar', 'Jumlah', 'Penghuni', 'Okupansi'],
        [
          ['Single (1 orang)', 240, 228, '95,0%'],
          ['Twin (2 orang)', 620, 1.176, '94,8%'],
          ['Triple (3 orang)', 280, 762, '90,7%'],
          ['Kamar khusus', 100, 82, '82,0%'],
        ]),
    ],
  },
  {
    judul: 'Data Penghuni Mahasiswa',
    sub: 'Sebaran penghuni per asal, jenjang, dan jenis kelamin',
    kartu: [
      kpi(3, 'Penghuni Aktif', 'Per Desember 2026', '1.486', 'orang', 'users', 6.8),
      kpi(3, 'Penghuni Baru', 'Masuk sepanjang 2026', '386', 'orang', 'user-plus', 12.4),
      kpi(3, 'Keluar', 'Mengakhiri tinggal', '292', 'orang', 'user-minus', -8.2),
      kpi(3, 'Rata-rata Tinggal', 'Lama huni per mahasiswa', '1,8', 'tahun', 'calendar-check', 5.9),
      grafik('hbar', 'bar-mendatar-peringkat', 'Penghuni per Fakultas', 'Orang, lima terbanyak', 7, 4,
        ['Teknik', 'Ekonomi', 'Ilmu Komputer', 'Kedokteran', 'Hukum'], [
          { name: 'Penghuni', data: [428, 316, 284, 246, 212] },
        ], 'orang'),
      tabel('tabel-status', 'Sebaran Penghuni', 'Jenjang dan status huni', 7, 4,
        ['Kategori', 'Jumlah', 'Porsi'],
        [
          ['Jenjang S1', '1.142', '76,9%'],
          ['Jenjang D3/D4', '248', '16,7%'],
          ['Pascasarjana', '96', '6,5%'],
          ['Penerima beasiswa', '486', '32,7%'],
          ['Mahasiswa asing', '34', '2,3%'],
        ]),
    ],
  },
  {
    judul: 'Kualitas Pelayanan',
    sub: 'Kepuasan penghuni dan mutu layanan harian',
    kartu: [
      kpi(3, 'Kepuasan', 'Skor layanan 1–5', '4,3', 'dari 5', 'star', 4.9),
      kpi(3, 'Respon Keluhan', 'Waktu tanggap awal', '2,4', 'jam', 'clock', -18.6),
      kpi(3, 'Penyelesaian', 'Keluhan tuntas', '94,2', '%', 'message-square', 5.6),
      kpi(3, 'Survey Kepuasan', 'Responden terlibat', '892', 'responden', 'clipboard-check', 14.2),
      grafik('bar', 'bar-tegak', 'Skor Layanan per Aspek', 'Skor 1–5, 2026', 12, 4,
        ['Kebersihan', 'Keamanan', 'Fasilitas', 'Kebersamaan', 'Pelayanan admin'], [
          { name: 'Skor', data: [4.1, 4.5, 4.2, 4.4, 4.3] },
        ], 'dari 5'),
    ],
  },
  {
    judul: 'Kebersihan & Kenyamanan',
    sub: 'Kebersihan area, sanitasi, dan kenyamanan hunian',
    kartu: [
      kpi(3, 'Skor Kebersihan', 'Hasil inspeksi harian', '4,1', 'dari 5', 'sparkles', 2.5),
      kpi(3, 'Inspeksi', 'Pemeriksaan bulanan', '12', 'putaran', 'clipboard-check', 0),
      kpi(3, 'Temuan Kebersihan', 'Sepanjang 2026', '168', 'temuan', 'alert-triangle', -14.8),
      kpi(3, 'Temuan Tertutup', 'Selesai ditindaklanjuti', '130', 'temuan', 'file-check', -12.4),
      grafik('bar', 'bar-tegak-target', 'Skor Kebersihan per Bulan', 'Skor 1–5, target 4,3', 12, 4, BULAN, [
        { name: 'Skor kebersihan', data: [3.9, 4.0, 3.8, 4.1, 4.0, 4.2, 4.1, 4.0, 4.2, 4.3, 4.1, 4.1] },
        { name: 'Target', data: [4.3, 4.3, 4.3, 4.3, 4.3, 4.3, 4.3, 4.3, 4.3, 4.3, 4.3, 4.3], kind: 'line' },
      ], 'dari 5'),
    ],
  },
  {
    judul: 'Fasilitas & Maintenance',
    sub: 'Kondisi fasilitas dan pekerjaan pemeliharaan',
    kartu: [
      kpi(3, 'Fasilitas', 'Item terkelola', '486', 'unit', 'tool', 3.2),
      kpi(3, 'Pemeliharaan', 'Pekerjaan sepanjang 2026', '742', 'pekerjaan', 'wrench', 8.6),
      kpi(3, 'Rata-rata Perbaikan', 'Waktu penyelesaian', '3,6', 'hari', 'clock', -12.4),
      kpi(3, 'Biaya Pemeliharaan', 'Realisasi tahun berjalan', '4,2', 'miliar Rp', 'receipt', 6.4),
      grafik('donut', 'donat-tebal', 'Pekerjaan Pemeliharaan per Jenis', 'Jumlah pekerjaan, total 742', 5, 4,
        ['Listrik', 'Air & sanitasi', 'Furnitur', 'Pendingin', 'Lainnya'], [
          { name: 'Pekerjaan', data: [246, 198, 142, 96, 60] },
        ], 'pekerjaan'),
      tabel('tabel-status', 'Status Fasilitas Utama', 'Kondisi dan tindak lanjut', 7, 4,
        ['Fasilitas', 'Kondisi', 'Status'],
        [
          ['Instalasi listrik', 'Baik', 'Aman'],
          ['Instalasi air', 'Cukup', 'Pantau'],
          ['Pendingin ruang', 'Cukup', 'Pantau'],
          ['Furnitur kamar', 'Baik', 'Aman'],
          ['Lift gedung', 'Cukup', 'Perbaikan'],
          ['Jaringan internet', 'Baik', 'Aman'],
        ]),
    ],
  },
  {
    judul: 'Keamanan & Ketertiban',
    sub: 'Insiden, patroli, dan kepatuhan aturan asrama',
    kartu: [
      kpi(3, 'Insiden Keamanan', 'Sepanjang 2026', '8', 'kejadian', 'shield-check', -42.9),
      kpi(3, 'Patroli', 'Putaran per bulan', '248', 'putaran', 'eye', 4.2),
      kpi(3, 'Pelanggaran Aturan', 'Kasus tercatat', '64', 'kasus', 'alert-triangle', -18.6),
      kpi(3, 'Kepatuhan', 'Penghuni patuh aturan', '97,4', '%', 'shield-check', 1.8),
      grafik('bar', 'bar-tegak', 'Insiden per Kategori', 'Jumlah kejadian, 2026', 12, 4,
        ['Kehilangan', 'Keributan', 'Akses keluar-malam', 'Pelanggaran tamu', 'Lainnya'], [
          { name: 'Insiden', data: [3, 2, 2, 1, 0] },
        ], 'kejadian'),
    ],
  },
  {
    judul: 'Aktivitas & Pembinaan Mahasiswa',
    sub: 'Kegiatan, partisipasi, dan pembinaan penghuni',
    kartu: [
      kpi(3, 'Kegiatan', 'Sepanjang 2026', '96', 'kegiatan', 'calendar-check', 20.0),
      kpi(3, 'Partisipasi', 'Rata-rata kehadiran', '68,4', '%', 'users', 7.8),
      kpi(3, 'Pembina', 'Pendamping asrama', '24', 'orang', 'user-check', 4.3),
      kpi(3, 'Jam Pembinaan', 'Total kegiatan terbimbing', '1.842', 'jam', 'clock', 12.6),
      grafik('hbar', 'bar-mendatar-peringkat', 'Kegiatan Terfavorit', 'Jumlah peserta, lima teratas', 7, 4,
        ['Olahraga', 'Keagamaan', 'Keterampilan', 'Akademik', 'Seni'], [
          { name: 'Peserta', data: [412, 386, 324, 286, 214] },
        ], 'peserta'),
      poin('Catatan Pembinaan', 'Ringkasan program mahasiswa', 7, 4,
        'Pembinaan berjalan rutin dengan partisipasi yang naik, tetapi kegiatan akademik masih perlu didorong.',
        [
          'Kegiatan rutin mingguan terlaksana 96 kali',
          'Partisipasi naik dari 61% ke 68,4%',
          'Penerima beasiswa ikut 82% kegiatan',
          'Pembinaan akademik perlu diperluas',
        ]),
    ],
  },
  {
    judul: 'Keluhan & Service Recovery',
    sub: 'Jenis keluhan, kecepatan tanggap, dan pemulihan layanan',
    kartu: [
      kpi(3, 'Total Keluhan', 'Sepanjang 2026', '642', 'keluhan', 'message-square', -6.4),
      kpi(3, 'Keluhan Terbuka', 'Belum ditutup', '38', 'keluhan', 'alert-triangle', -24.8),
      kpi(3, 'Waktu Tanggap', 'Rata-rata awal', '2,4', 'jam', 'clock', -18.6),
      kpi(3, 'Pemulihan Layanan', 'Keluhan tuntas', '94,2', '%', 'file-check', 5.6),
      grafik('donut', 'donat-tebal', 'Keluhan per Jenis', 'Jumlah keluhan, total 642', 5, 4,
        ['Kebersihan', 'Fasilitas', 'Keamanan', 'Administrasi', 'Lainnya'], [
          { name: 'Keluhan', data: [228, 186, 96, 84, 48] },
        ], 'keluhan'),
      tabel('tabel-status', 'Keluhan Terbuka', 'Prioritas penutupan', 7, 4,
        ['Keluhan', 'Umur', 'Status'],
        [
          ['Kebersihan kamar mandi', '4 hari', 'Ditangani'],
          ['AC tidak dingin', '3 hari', 'Ditangani'],
          ['Air panas lantai 3', '5 hari', 'Menunggu spare part'],
          ['Kunci kamar rusak', '2 hari', 'Ditangani'],
          ['Kebisingan malam', '6 hari', 'Menunggu tindakan'],
        ]),
    ],
  },
  {
    judul: 'Keuangan & Efisiensi Operasional',
    sub: 'Pendapatan, biaya, dan efisiensi pengelolaan',
    kartu: [
      kpi(3, 'Pendapatan', 'Realisasi tahun berjalan', '28,4', 'miliar Rp', 'wallet', 7.2),
      kpi(3, 'Biaya Operasional', 'Total biaya pengelolaan', '21,6', 'miliar Rp', 'receipt', 6.4),
      kpi(3, 'Margin Bersih', 'Terhadap pendapatan', '24,0', '%', 'trending-up', 0.8),
      kpi(3, 'Biaya per Penghuni', 'Rata-rata per bulan', '1,21', 'juta Rp', 'percent', 2.4),
      grafik('combo', 'combo-batang-garis', 'Pendapatan vs Biaya vs Margin', 'Miliar rupiah', 12, 4,
        ['2024', '2025', 'Outlook 2026', 'RKA 2027'], [
          { name: 'Pendapatan', data: [21.8, 24.6, 28.4, 31.2], kind: 'bar' },
          { name: 'Biaya', data: [17.4, 19.2, 21.6, 23.4], kind: 'bar' },
          { name: 'Margin bersih', data: [4.4, 5.4, 6.8, 7.8], kind: 'line' },
        ], 'miliar Rp'),
    ],
  },
  {
    judul: 'Permasalahan & Risiko',
    sub: 'Isu utama dan mitigasi pengelolaan asrama',
    kartu: [
      tabel('papan-isu', 'Permasalahan Utama', 'Dampak dan tindakan', 7, 4,
        ['Masalah', 'Dampak', 'Tindakan'],
        [
          ['Keluhan kebersihan belum tertutup', 'Kenyamanan turun', 'Jadwal kebersihan ulang'],
          ['Biaya pemeliharaan naik', 'Anggaran tertekan', 'Perbaikan berjadwal'],
          ['Fasilitas usia pakai tinggi', 'Biaya perbaikan', 'Rencana penggantian'],
          ['Okupansi kamar khusus rendah', 'Pendapatan hilang', 'Promosi internal'],
          ['Ketersediaan tenaga kebersihan', 'Mutu layanan', 'Penambahan shift'],
        ]),
      poin('Kendala Lapangan', 'Ringkasan hambatan dan statusnya', 7, 6,
        'Tiga kendala menjelaskan sebagian besar keluhan yang belum tertutup.',
        [
          'Tenaga kebersihan terbatas pada jam sibuk (11 kasus)',
          'Spare part pendingin lama datang (9 kasus)',
          'Perilaku penghuni sulit dikendalikan (8 kasus)',
          'Fasilitas berusia di atas 10 tahun (6 kasus)',
          'Kanal keluhan masih manual (4 kasus)',
        ]),
    ],
  },
  {
    judul: 'Program Kerja & KPI 2027',
    sub: 'Program prioritas dan sasaran tahun depan',
    kartu: [
      sasaran(4, 'Tingkat Hunian', 92.6, 95, '%', '≥', 'percent'),
      sasaran(4, 'Kepuasan Penghuni', 4.3, 4.6, 'dari 5', '≥', 'star'),
      sasaran(4, 'Keluhan Tertutup', 94.2, 98, '%', '≥', 'message-square'),
      sasaran(4, 'Skor Kebersihan', 4.1, 4.5, 'dari 5', '≥', 'sparkles'),
      sasaran(4, 'Insiden Keamanan', 8, 4, 'kejadian', '≤', 'shield-check'),
      sasaran(4, 'Biaya per Penghuni', 1.21, 1.15, 'juta Rp', '≤', 'receipt'),
      tabel('alur-tahap', 'Program Kerja 2027', 'Program prioritas dan jadwal', 12, 3,
        ['Program', 'Sasaran', 'Jadwal', 'Status'],
        [
          ['Digitalisasi keluhan penghuni', 'Respon keluhan < 1 jam', 'Kuartal 1', 'Berjalan'],
          ['Perbaikan berjadwal fasilitas', 'Turunkan biaya darurat 20%', 'Kuartal 1', 'Berjalan'],
          ['Standardisasi kebersihan', 'Skor 4,5', 'Kuartal 2', 'Rencana'],
          ['Penggantian pendingin lama', 'Keluhan AC turun 50%', 'Kuartal 2', 'Rencana'],
          ['Program pembinaan akademik', 'Partisipasi 80%', 'Kuartal 3', 'Rencana'],
        ]),
    ],
  },
  {
    // Dulu dua halaman ("Closing" dan "Penutup") dengan isi hampir sama.
    judul: 'Penutup',
    sub: 'Student living excellence dan keputusan rapat',
    kartu: [
      teks('Student Living Excellence', 'Empat hal yang dijaga bersama', 12, 3,
        'Asrama bukan sekadar tempat tidur, tetapi bagian dari pengalaman belajar mahasiswa. Tiga prioritas 2027: kebersihan yang konsisten, fasilitas yang terpelihara, dan layanan keluhan yang cepat. Keputusan rapat: menyetujui digitalisasi layanan keluhan, menjadwalkan penggantian fasilitas berusia di atas 10 tahun secara bertahap, dan menetapkan target kepuasan penghuni 4,6 dari 5 untuk 2027.'),
      kpi(3, 'Hunian', 'Tingkat hunian', '92,6', '%', 'percent', 3.4),
      kpi(3, 'Layanan', 'Kepuasan penghuni', '4,3', 'dari 5', 'star', 4.9),
      kpi(3, 'Kebersihan', 'Skor inspeksi', '4,1', 'dari 5', 'sparkles', 2.5),
      kpi(3, 'Keamanan', 'Insiden sepanjang tahun', '8', 'kejadian', 'shield-check', -42.9),
    ],
  },
];

export const TEMPLATE_ASRAMA: DashboardTemplate = {
  id: `${PREFIKS_TEMPLATE_DECK}asrama`,
  nama: 'Pengelola Asrama Mahasiswa',
  kategoriId: 'operasional',
  tujuan:
    'Rapat pengelolaan asrama mahasiswa: kapasitas dan okupansi, data penghuni, kualitas pelayanan, kebersihan, fasilitas & maintenance, keamanan & ketertiban, aktivitas dan pembinaan, keluhan & service recovery, keuangan, permasalahan & risiko, serta program kerja dan KPI 2027.',
  caraPenyampaian: `Deck ${HALAMAN.length} halaman, satu halaman satu topik: ${HALAMAN.map((h) => h.judul).join(', ')}. Gaya tampilan dipilih terpisah di galeri.`,
  deskripsi:
    'Deck rapat pengelola asrama mahasiswa: profil & kapasitas, data penghuni, mutu layanan, kebersihan, fasilitas, keamanan, pembinaan, keluhan, keuangan, risiko, dan program kerja 2027.',
  fokus: [
    'Profil & kapasitas asrama',
    'Data penghuni & okupansi',
    'Kualitas pelayanan',
    'Kebersihan & kenyamanan',
    'Fasilitas & maintenance',
    'Keamanan & ketertiban',
    'Aktivitas & pembinaan',
    'Keluhan & service recovery',
    'Keuangan & efisiensi',
    'Permasalahan & risiko',
    'Program kerja & KPI 2027',
  ],
  aksen: '#1e6fd9',
  tema: 'korporat',
  judulDashboard: 'Pengelola Asrama Mahasiswa — Management Meeting 2026',
  deskripsiDashboard:
    'Rapat pengelolaan asrama mahasiswa 2026: profil dan kapasitas asrama, data penghuni dan tingkat hunian, kualitas pelayanan, kebersihan dan kenyamanan, fasilitas dan pemeliharaan, keamanan dan ketertiban, aktivitas dan pembinaan mahasiswa, keluhan dan service recovery, keuangan dan efisiensi operasional, permasalahan dan risiko, serta program kerja dan KPI 2027. Angka diambil dari dokumen instansi.',
  widgets: HALAMAN.flatMap((h) => h.kartu),
  bagian: {
    unit: 'Asrama',
    halaman: HALAMAN.map((h) => ({ judul: h.judul, sub: h.sub, jumlah: h.kartu.length })),
    kunci: /asrama|student\s*living|penghuni\s*(asrama|mahasiswa)|okupansi\s*kamar/i,
  },
};
