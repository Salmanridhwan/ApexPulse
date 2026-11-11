import type { WidgetSpec } from '../../types';
import type { DashboardTemplate } from './dashboardTemplates';
import { PREFIKS_TEMPLATE_DECK } from './templateBagian';
import { alatDeck } from './deckAlat';

/**
 * TEMPLATE DECK "CONSTRUCTION MEETING".
 *
 * Disusun dari deck *Construction Meeting — Evaluasi Proyek & Rencana Strategis
 * Konstruksi, Periode 2026 / RKA 2027*. Slide sampul TIDAK dijadikan halaman:
 * judulnya dipakai sebagai nama template. Slide "Closing" dan "Penutup"
 * digabung, jadi 14 halaman, satu halaman = satu slide:
 *
 *   1 Agenda Meeting              9 Material, Alat & Tenaga Kerja
 *   2 Executive Summary          10 Risiko & Kendala Proyek
 *   3 Portfolio & Status Proyek  11 Subkontraktor & Pengadaan
 *   4 Progress Fisik Proyek      12 Action Plan
 *   5 Progress Biaya & Cash Flow 13 Target & KPI 2027
 *   6 Schedule & Milestone       14 Penutup
 *   7 Quality Control
 *   8 K3 & Keselamatan Kerja
 *
 * Gaya (Pijar, Koran, Neon, ...) dipilih terpisah di galeri — template ini hanya
 * menentukan SUSUNAN, bukan tampilan. Semua angka di sini ANGKA CONTOH yang
 * saling konsisten (12 proyek, nilai kontrak Rp 248,6 miliar, realisasi fisik
 * 78,4%, deviasi biaya -1,6%); dashboard nyata diisi dari dokumen instansi.
 */

const { kpi, sasaran, poin, teks, grafik, tabel } = alatDeck('cnst', 'Konstruksi');

const TAHUN = ['2024', '2025', 'Outlook 2026', 'RKA 2027'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const HALAMAN: Array<{ judul: string; sub: string; kartu: WidgetSpec[] }> = [
  {
    judul: 'Agenda Meeting',
    sub: 'Pokok bahasan rapat konstruksi 2026',
    kartu: [
      poin('Agenda — Evaluasi Proyek', 'Bagian 1 dari 2', 6, 7,
        'Lima belas pokok bahasan, dibagi dua kolom agar terbaca satu layar.',
        [
          '1. Portofolio dan status proyek',
          '2. Jumlah proyek berjalan',
          '3. Progress fisik kumulatif',
          '4. Progress biaya & cash flow',
          '5. Schedule dan milestone',
          '6. Deviasi jadwal',
          '7. Mutu pekerjaan (QC)',
          '8. K3 dan keselamatan kerja',
        ]),
      poin('Agenda — Rencana 2027', 'Bagian 2 dari 2', 6, 7,
        'Dilanjutkan sumber daya, risiko, dan sasaran tahun depan.',
        [
          '9. Material, alat & tenaga kerja',
          '10. Risiko dan kendala proyek',
          '11. Subkontraktor dan pengadaan',
          '12. Action plan',
          '13. Target & KPI 2027',
          '14. Rencana penambahan kapasitas',
          '15. Penutup dan keputusan rapat',
        ]),
    ],
  },
  {
    judul: 'Executive Summary',
    sub: 'Dashboard KPI konstruksi 2026',
    kartu: [
      kpi(4, 'Proyek Berjalan', 'Aktif per Desember 2026', '12', 'proyek', 'building', 9.1),
      kpi(4, 'Nilai Kontrak', 'Total kontrak berjalan', '248,6', 'miliar Rp', 'wallet', 11.4),
      kpi(4, 'Realisasi Fisik', 'Kumulatif tahun berjalan', '78,4', '%', 'trending-up', 4.6),
      kpi(4, 'Deviasi Jadwal', 'Terlambat dari rencana', '-2,8', '%', 'clock', -1.2,
        'Terlambat 2,8% dari rencana'),
      kpi(4, 'Deviasi Biaya', 'Terhadap anggaran proyek', '-1,6', '%', 'receipt', -0.4,
        'Lebih hemat 1,6% dari anggaran'),
      kpi(4, 'Nilai Terbayar', 'Termin sudah dibayar', '186,2', 'miliar Rp', 'file-check', 10.8),
      teks('Headline Management', 'Pertanyaan kunci rapat', 12, 2,
        'Apakah proyek konstruksi 2026 berjalan sesuai jadwal, biaya, dan mutu? Realisasi fisik 78,4% dengan biaya 1,6% di bawah anggaran, tetapi deviasi jadwal -2,8% pada empat proyek menandakan keterlambatan pasokan material dan cuaca. Fokus 2027: percepatan pengadaan material kritis dan penguatan pengendalian mutu.'),
    ],
  },
  {
    judul: 'Portfolio & Status Proyek',
    sub: 'Sebaran proyek per status dan nilai kontrak',
    kartu: [
      kpi(3, 'Selesai', 'Proyek tuntas 2026', '5', 'proyek', 'file-check', 25.0),
      kpi(3, 'Berjalan', 'Dalam pelaksanaan', '7', 'proyek', 'trending-up', 16.7),
      kpi(3, 'Terlambat', 'Deviasi jadwal negatif', '4', 'proyek', 'alert-triangle', 33.3),
      kpi(3, 'Nilai Kontrak', 'Total portofolio', '248,6', 'miliar Rp', 'wallet', 11.4),
      grafik('donut', 'donat-tebal', 'Nilai Kontrak per Jenis Proyek', 'Miliar rupiah, total 248,6', 5, 4,
        ['Gedung', 'Jalan & jembatan', 'Irigasi', 'Fasilitas umum', 'Lainnya'], [
          { name: 'Nilai kontrak', data: [112.4, 68.2, 38.6, 21.4, 8.0] },
        ], 'miliar Rp'),
      tabel('tabel-status', 'Status Proyek Berjalan', 'Progres fisik dan status', 7, 4,
        ['Proyek', 'Fisik', 'Status'],
        [
          ['Gedung kantor cabang', '92%', 'Hampir selesai'],
          ['Jembatan penghubung', '84%', 'Berjalan'],
          ['Irigasi tersier', '76%', 'Berjalan'],
          ['Renovasi gudang', '68%', 'Terlambat'],
          ['Fasilitas parkir', '54%', 'Terlambat'],
          ['Gedung serbaguna', '41%', 'Berjalan'],
        ]),
    ],
  },
  {
    judul: 'Progress Fisik Proyek',
    sub: 'Realisasi fisik bulanan dibanding rencana',
    kartu: [
      kpi(4, 'Rencana Fisik', 'Kumulatif per Desember', '81,2', '%', 'target', 0),
      kpi(4, 'Realisasi Fisik', 'Kumulatif per Desember', '78,4', '%', 'trending-up', 4.6),
      kpi(4, 'Deviasi', 'Realisasi minus rencana', '-2,8', '%', 'alert-triangle', -1.2,
        'Kurang 2,8 poin dari rencana'),
      kpi(4, 'Progres Bulanan', 'Desember dibanding November', '6,2', '%', 'calendar-check', 8.8),
      grafik('combo', 'combo-batang-garis', 'Realisasi vs Rencana Fisik', 'Persen kumulatif, 2026', 12, 4, BULAN, [
        { name: 'Rencana', data: [6.4, 13.2, 20.8, 28.6, 36.4, 44.2, 52.1, 59.8, 67.4, 74.2, 78.6, 81.2], kind: 'line' },
        { name: 'Realisasi', data: [6.1, 12.8, 19.9, 27.4, 35.2, 42.8, 50.6, 58.1, 65.4, 71.6, 72.2, 78.4] },
      ], '%'),
    ],
  },
  {
    judul: 'Progress Biaya & Cash Flow',
    sub: 'Realisasi biaya dan arus kas proyek',
    kartu: [
      kpi(3, 'Anggaran Proyek', 'Total RAB berjalan', '248,6', 'miliar Rp', 'wallet', 11.4),
      kpi(3, 'Biaya Terpakai', 'Realisasi biaya', '191,4', 'miliar Rp', 'receipt', 12.1),
      kpi(3, 'Nilai Terbayar', 'Termin dibayar pemilik', '186,2', 'miliar Rp', 'file-check', 10.8),
      kpi(3, 'Deviasi Biaya', 'Terhadap anggaran', '-1,6', '%', 'trending-down', 0.4,
        'Hemat 1,6% dari anggaran'),
      grafik('combo', 'combo-batang-garis', 'Cash Flow per Kuartal', 'Miliar rupiah, biaya vs pembayaran', 12, 4,
        ['Kuartal 1', 'Kuartal 2', 'Kuartal 3', 'Kuartal 4'], [
          { name: 'Biaya keluar', data: [38.6, 48.4, 56.2, 48.2], kind: 'bar' },
          { name: 'Termin masuk', data: [36.2, 46.8, 54.4, 48.8], kind: 'bar' },
          { name: 'Arus kas bersih', data: [-2.4, -1.6, -1.8, 0.6], kind: 'line' },
        ], 'miliar Rp'),
    ],
  },
  {
    judul: 'Schedule & Milestone',
    sub: 'Tonggak penting dan deviasi jadwal',
    kartu: [
      grafik('hbar', 'alur-tahap', 'Milestone Proyek Utama', 'Progres tiap tonggak, persen', 7, 4,
        ['Perencanaan', 'Pondasi', 'Struktur', 'Finishing', 'Serah terima'], [
          { name: 'Progres', data: [100, 100, 86, 54, 22] },
        ], '%'),
      tabel('tabel-status', 'Deviasi Jadwal per Proyek', 'Selisih terhadap rencana', 7, 4,
        ['Proyek', 'Deviasi', 'Status'],
        [
          ['Gedung kantor cabang', '-0,4 minggu', 'Baik'],
          ['Jembatan penghubung', '-1,2 minggu', 'Pantau'],
          ['Irigasi tersier', '-2,6 minggu', 'Pantau'],
          ['Renovasi gudang', '-4,8 minggu', 'Terlambat'],
          ['Fasilitas parkir', '-6,2 minggu', 'Terlambat'],
          ['Gedung serbaguna', '-3,4 minggu', 'Terlambat'],
        ]),
    ],
  },
  {
    judul: 'Quality Control',
    sub: 'Mutu pekerjaan, temuan, dan perbaikannya',
    kartu: [
      kpi(3, 'Temuan QC', 'Sepanjang 2026', '146', 'temuan', 'clipboard-check', -12.4),
      kpi(3, 'Temuan Terbuka', 'Belum ditutup', '18', 'temuan', 'alert-triangle', -31.8),
      kpi(3, 'Waktu Perbaikan', 'Rata-rata penutupan', '4,2', 'hari', 'clock', -14.3),
      kpi(3, 'Nilai Rework', 'Biaya perbaikan ulang', '1,8', 'miliar Rp', 'receipt', -22.6),
      grafik('bar', 'bar-tegak', 'Temuan QC per Kategori', 'Jumlah temuan, 2026', 12, 4,
        ['Struktur', 'Arsitektur', 'MEP', 'Finishing', 'Lainnya'], [
          { name: 'Temuan', data: [42, 38, 34, 24, 8] },
        ], 'temuan'),
    ],
  },
  {
    judul: 'K3 & Keselamatan Kerja',
    sub: 'Kecelakaan kerja, kepatuhan, dan pelatihan',
    kartu: [
      kpi(3, 'Zero Accident', 'Proyek tanpa kecelakaan', '10', 'proyek', 'shield-check', 25.0),
      kpi(3, 'Insiden Ringan', 'Sepanjang 2026', '6', 'kejadian', 'alert-triangle', -40.0),
      kpi(3, 'Jam Kerja Aman', 'Tanpa lost time injury', '1,84', 'juta jam', 'clock', 12.6),
      kpi(3, 'Kepatuhan APD', 'Hasil pemeriksaan lapangan', '96,8', '%', 'shield-check', 2.4),
      grafik('gauge', 'gauge-target', 'Skor K3', 'Skor 1–100, target 95', 6, 4, ['Skor K3'], [
        { name: 'Skor K3', data: [93.4] },
      ], 'poin'),
      poin('Catatan K3', 'Ringkasan keselamatan kerja', 6, 5,
        'Tidak ada kecelakaan berat sepanjang 2026, dan semua insiden ringan tertangani di hari yang sama.',
        [
          'Zero accident di 10 dari 12 proyek',
          '6 insiden ringan, 0 lost time injury',
          'Pelatihan K3 diikuti 428 pekerja',
          'Toolbox meeting 96% terlaksana',
        ]),
    ],
  },
  {
    judul: 'Material, Alat & Tenaga Kerja',
    sub: 'Ketersediaan sumber daya proyek',
    kartu: [
      kpi(3, 'Tenaga Kerja', 'Pekerja aktif per Desember', '1.486', 'orang', 'users', 7.2),
      kpi(3, 'Alat Berat', 'Unit dalam pemakaian', '38', 'unit', 'truck', 5.6),
      kpi(3, 'Utilitas Alat', 'Rata-rata pemakaian alat', '84,6', '%', 'calendar-check', 3.2),
      kpi(3, 'Keterlambatan Material', 'Pengiriman melewati jadwal', '24', 'pengiriman', 'clock', -18.6),
      grafik('donut', 'donat-tebal', 'Komposisi Tenaga Kerja', 'Orang, total 1.486', 5, 4,
        ['Tukang', 'Mandor', 'Operator alat', 'Staf teknis', 'Lainnya'], [
          { name: 'Tenaga kerja', data: [682, 186, 142, 324, 152] },
        ], 'orang'),
      tabel('tabel-ringkas', 'Material Kritis', 'Status pasokan material utama', 7, 4,
        ['Material', 'Volume', 'Status'],
        [
          ['Beton readymix', '8.420 m³', 'Aman'],
          ['Besi beton', '1.246 ton', 'Aman'],
          ['Batu split', '12.840 m³', 'Pantau'],
          ['Semen', '48.600 sak', 'Aman'],
          ['Pipa HDPE', '6.240 m', 'Terlambat'],
          ['Baja profil', '982 ton', 'Terlambat'],
        ]),
    ],
  },
  {
    judul: 'Risiko & Kendala Proyek',
    sub: 'Risiko utama, dampak, dan mitigasinya',
    kartu: [
      tabel('papan-isu', 'Risiko Utama', 'Dampak dan mitigasi', 7, 4,
        ['Risiko', 'Dampak', 'Mitigasi'],
        [
          ['Cuaca ekstrem', 'Keterlambatan', 'Perpanjangan jam kerja'],
          ['Pasokan material terlambat', 'Deviasi jadwal', 'Vendor cadangan'],
          ['Kenaikan harga baja', 'Biaya membengkak', 'Kontrak indeks'],
          ['Akses lahan terbatas', 'Pekerjaan tertahan', 'Koordinasi pemilik'],
          ['Tenaga kerja terampil kurang', 'Mutu turun', 'Pelatihan dan rekrut'],
        ]),
      poin('Kendala Lapangan', 'Ringkasan hambatan dan statusnya', 7, 6,
        'Tiga kendala menjelaskan sebagian besar deviasi jadwal; dua di antaranya bisa ditekan lewat pengadaan.',
        [
          'Pasokan material terlambat (9 proyek)',
          'Cuaca ekstrem (7 proyek)',
          'Perubahan desain dari pemilik (5 proyek)',
          'Akses lahan terbatas (3 proyek)',
          'Ketersediaan alat berat (2 proyek)',
        ]),
    ],
  },
  {
    judul: 'Subkontraktor & Pengadaan Proyek',
    sub: 'Kinerja subkontraktor dan nilai pengadaan',
    kartu: [
      kpi(3, 'Subkontraktor', 'Terdaftar aktif', '42', 'perusahaan', 'building', 10.5),
      kpi(3, 'Nilai Pengadaan', 'Kontrak subkontraktor', '86,4', 'miliar Rp', 'wallet', 9.2),
      kpi(3, 'Ketepatan Serah', 'Subkontraktor tepat waktu', '88,2', '%', 'truck', 3.8),
      kpi(3, 'Subkontraktor Bermasalah', 'Masuk evaluasi', '6', 'perusahaan', 'alert-triangle', 20.0),
      tabel('tabel-status', 'Kinerja Subkontraktor', 'Skor dan status evaluasi', 12, 4,
        ['Subkontraktor', 'Lingkup', 'Skor', 'Status'],
        [
          ['Subkon A', 'Struktur & pondasi', '94', 'Baik'],
          ['Subkon B', 'MEP', '91', 'Baik'],
          ['Subkon C', 'Finishing', '86', 'Baik'],
          ['Subkon D', 'Lansekap', '78', 'Pantau'],
          ['Subkon E', 'Pagar & jalan', '71', 'Evaluasi'],
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
          ['Kontrak pasokan material jangka panjang', 'Divisi Pengadaan', 'Jan 2027', 'Berjalan'],
          ['Daftar vendor material cadangan', 'Divisi Pengadaan', 'Feb 2027', 'Rencana'],
          ['Percepatan proyek deviasi > 4 minggu', 'Manajemen Proyek', 'Mar 2027', 'Berjalan'],
          ['Standarisasi metode kerja K3', 'Divisi K3', 'Jan 2027', 'Berjalan'],
          ['Evaluasi 6 subkontraktor bermasalah', 'Tim Evaluasi', 'Feb 2027', 'Rencana'],
          ['Digitalisasi laporan harian proyek', 'Divisi TI', 'Apr 2027', 'Rencana'],
        ]),
    ],
  },
  {
    judul: 'Target & KPI 2027',
    sub: 'Fokus peningkatan kinerja konstruksi',
    kartu: [
      sasaran(4, 'Realisasi Fisik', 78.4, 95, '%', '≥', 'trending-up'),
      sasaran(4, 'Deviasi Jadwal', -2.8, 0, '%', '≥', 'clock'),
      sasaran(4, 'Deviasi Biaya', -1.6, 0, '%', '≤', 'receipt'),
      sasaran(4, 'Zero Accident', 10, 12, 'proyek', '≥', 'shield-check'),
      sasaran(4, 'Temuan QC Tertutup', 87.7, 100, '%', '≥', 'clipboard-check'),
      sasaran(4, 'Ketepatan Subkon', 88.2, 95, '%', '≥', 'truck'),
    ],
  },
  {
    // Dulu dua halaman ("Closing" dan "Penutup") dengan isi hampir sama.
    judul: 'Penutup',
    sub: 'Jadwal, biaya, mutu, keselamatan, dan keputusan rapat',
    kartu: [
      teks('Penutup Rapat', 'Empat hal yang tidak boleh dikorbankan', 12, 3,
        'Proyek konstruksi dinilai dari empat hal sekaligus: selesai tepat waktu, biaya sesuai anggaran, mutu sesuai spesifikasi, dan tidak ada pekerja yang terluka. Deviasi 2026 berasal dari pasokan material dan cuaca, bukan dari kemampuan pelaksana. Keputusan rapat: menyetujui penguatan pengadaan material, memperpanjang kontrak vendor utama, dan menetapkan target zero accident untuk seluruh proyek 2027.'),
      kpi(3, 'Jadwal', 'Proyek tepat waktu', '8', 'proyek', 'clock', 0.0),
      kpi(3, 'Biaya', 'Deviasi anggaran', '-1,6', '%', 'receipt', -0.4,
        'Hemat 1,6% dari anggaran'),
      kpi(3, 'Mutu', 'Temuan QC tertutup', '87,7', '%', 'clipboard-check', 4.2),
      kpi(3, 'Keselamatan', 'Proyek zero accident', '10', 'proyek', 'shield-check', 25.0),
    ],
  },
];

export const TEMPLATE_CONSTRUCTION: DashboardTemplate = {
  id: `${PREFIKS_TEMPLATE_DECK}construction`,
  nama: 'Construction Meeting',
  kategoriId: 'operasional',
  tujuan:
    'Rapat manajemen konstruksi: portofolio dan status proyek, progress fisik dan biaya, cash flow, schedule & milestone, quality control, K3, material alat dan tenaga kerja, risiko, subkontraktor & pengadaan, action plan, dan target KPI 2027.',
  caraPenyampaian: `Deck ${HALAMAN.length} halaman, satu halaman satu topik: ${HALAMAN.map((h) => h.judul).join(', ')}. Gaya tampilan dipilih terpisah di galeri.`,
  deskripsi:
    'Deck rapat konstruksi: portofolio proyek, progress fisik & biaya, cash flow, milestone, mutu pekerjaan, K3, sumber daya, risiko & kendala, subkontraktor, action plan, dan KPI 2027.',
  fokus: [
    'Portofolio & status proyek',
    'Progress fisik & deviasi',
    'Biaya & cash flow',
    'Schedule & milestone',
    'Mutu pekerjaan',
    'K3 & keselamatan kerja',
    'Material, alat & tenaga kerja',
    'Risiko & kendala',
    'Subkontraktor',
    'Action plan',
    'Target & KPI 2027',
  ],
  aksen: '#1e6fd9',
  tema: 'korporat',
  judulDashboard: 'Construction Meeting 2026 — Evaluasi Proyek & Rencana Strategis Konstruksi',
  deskripsiDashboard:
    'Rapat bagian konstruksi 2026: portofolio dan status proyek, progress fisik dan biaya, arus kas, schedule dan milestone, pengendalian mutu, K3 dan keselamatan kerja, ketersediaan material alat dan tenaga kerja, risiko dan kendala proyek, subkontraktor dan pengadaan, action plan, serta target KPI 2027. Angka diambil dari dokumen instansi.',
  widgets: HALAMAN.flatMap((h) => h.kartu),
  bagian: {
    unit: 'Konstruksi',
    halaman: HALAMAN.map((h) => ({ judul: h.judul, sub: h.sub, jumlah: h.kartu.length })),
    kunci: /construction|konstruksi|proyek\s*(konstruksi|fisik)|kontraktor|milestone/i,
  },
};
