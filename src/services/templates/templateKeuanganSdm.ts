import type { WidgetSpec } from '../../types';
import type { DashboardTemplate } from './dashboardTemplates';
import { PREFIKS_TEMPLATE_DECK, pembuat } from './templateBagian';

/**
 * TEMPLATE DECK "KEUANGAN & SUMBER DAYA MANUSIA".
 *
 * Disusun dari deck *Management Review & Performance 2026 — General Support
 * Keuangan & SDM*. Slide sampul TIDAK dijadikan halaman: judulnya dipakai
 * sebagai nama template, jadi isi dashboard mulai dari ringkasan eksekutif.
 * Sisa 14 slide menjadi 14 halaman, satu halaman = satu slide:
 *
 *   1 Ringkasan Eksekutif        8 Kinerja & Pengembangan
 *   2 Kinerja Keuangan           9 Tata Kelola & Kepatuhan
 *   3 Arus Kas & Piutang        10 Isu Utama
 *   4 Pengendalian Biaya        11 Program Kerja
 *   5 Human Capital             12 KPI 2027
 *   6 Rekrutmen & Talenta       13 Penutup
 *   7 Payroll & Benefit         14 Prioritas & Langkah Selanjutnya
 *
 * Semua kartu memakai chart dari menu Template Chart (`chartId`) sehingga
 * pratinjau galeri, dashboard tersimpan, dan menu Template Chart tampil sama.
 * Gaya (Pijar, Koran, Neon, ...) dipilih terpisah di galeri — template ini hanya
 * menentukan SUSUNAN, bukan tampilan.
 *
 * Seluruh angka di sini ANGKA CONTOH untuk menggambarkan bentuk dashboard;
 * dashboard nyata diisi dari dokumen instansi yang sedang login.
 */

/** Pembuat kartu deck: id unik per template, angka contoh, tanpa sitasi. */
const k = pembuat('ksdm', 'Keuangan & SDM');

const TAHUN = ['2024', '2025', 'Outlook 2026', 'RKA 2027'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Ubah lebar kartu (grid 12 kolom). */
const lebar = (w: WidgetSpec, kolom: number): WidgetSpec => ({ ...w, grid: { ...w.grid, w: kolom } });

/** Kartu KPI berikon selebar `kolom`. */
const kpi = (
  kolom: number,
  title: string,
  sub: string,
  value: string | number,
  unit: string,
  ikon: string,
  delta?: number,
  deltaLabel?: string
): WidgetSpec => lebar(k.kpi(title, sub, value, unit, ikon, delta, deltaLabel), kolom);

/** Kartu sasaran KPI tahun depan selebar `kolom`. */
const sasaran = (
  kolom: number,
  title: string,
  value: number,
  target: number,
  unit: string,
  arah: '≥' | '≤',
  ikon: string
): WidgetSpec => lebar(k.sasaran(title, value, target, unit, arah, ikon), kolom);

/** Kartu narasi dengan butir-butir (dipakai untuk kolom program & tata kelola). */
const poin = (
  title: string,
  sub: string,
  kolom: number,
  tinggi: number,
  text: string,
  bulletPoints: string[]
): WidgetSpec =>
  k.kartu('narasi', 'narasi-insight', title, sub, kolom, tinggi, {
    narasi: { text, bulletPoints },
  });

const HALAMAN: Array<{ judul: string; sub: string; kartu: WidgetSpec[] }> = [
  // 1 -----------------------------------------------------------------------
  {
    judul: 'Ringkasan Eksekutif',
    sub: 'Kinerja keuangan & SDM tahun berjalan',
    kartu: [
      kpi(3, 'Pendapatan', 'Realisasi s.d. Desember 2026', '48,6', 'miliar Rp', 'wallet', 6.1),
      kpi(3, 'Biaya Operasional', 'Realisasi s.d. Desember 2026', '31,2', 'miliar Rp', 'receipt', -2.4),
      kpi(3, 'EBITDA', 'Laba sebelum bunga, pajak & amortisasi', '14,2', 'miliar Rp', 'trending-up', 8.4),
      kpi(3, 'Arus Kas Operasi', 'Kas bersih dari kegiatan operasi', '6,4', 'miliar Rp', 'banknote', 4.2),
      kpi(3, 'Jumlah SDM', 'Pegawai aktif per Desember 2026', '320', 'orang', 'users', 2.9),
      kpi(3, 'Biaya SDM', 'Payroll, tunjangan & BPJS', '18,4', 'miliar Rp', 'coins', 3.1),
      kpi(3, 'Turnover', 'Sepanjang tahun berjalan', '6,8', '%', 'activity', -0.9),
      kpi(3, 'Produktivitas SDM', 'Pendapatan per pegawai', '152', 'juta Rp', 'gauge', 5.6),
    ],
  },

  // 2 -----------------------------------------------------------------------
  {
    judul: 'Kinerja Keuangan',
    sub: 'Pendapatan, beban, laba, dan realisasi anggaran',
    kartu: [
      k.tabel('tabel-ringkas', 'Angka Kunci Keuangan', 'Miliar rupiah, kecuali bertanda %', 5, 4, ['Indikator', '2025', '2026', 'Perubahan'], [
        ['Pendapatan', '45,8', '48,6', '+6,1%'],
        ['Beban usaha', '30,4', '31,2', '+2,6%'],
        ['Laba kotor', '15,4', '17,4', '+13,0%'],
        ['EBITDA', '13,1', '14,2', '+8,4%'],
        ['Laba bersih', '8,3', '9,8', '+18,1%'],
        ['Margin EBITDA', '28,6%', '29,2%', '+0,6 poin'],
        ['Realisasi anggaran', '94,1%', '96,4%', '+2,3 poin'],
      ]),
      k.grafik('combo', 'combo-batang-garis', 'Tren Kinerja Keuangan', 'Miliar rupiah per tahun', 7, 4, TAHUN, [
        { name: 'Pendapatan', data: [41.2, 45.8, 48.6, 53.4], kind: 'bar' },
        { name: 'EBITDA', data: [11.8, 13.1, 14.2, 16.0], kind: 'line' },
      ], 'miliar Rp'),
    ],
  },

  // 3 -----------------------------------------------------------------------
  {
    judul: 'Arus Kas & Piutang',
    sub: 'Likuiditas dan kecepatan penagihan',
    kartu: [
      kpi(3, 'Kas Masuk', 'Penerimaan kas tahun berjalan', '52,1', 'miliar Rp', 'trending-up', 7.3),
      kpi(3, 'Kas Keluar', 'Pengeluaran kas tahun berjalan', '45,7', 'miliar Rp', 'trending-down', 3.1),
      kpi(3, 'Arus Kas Bersih', 'Kas masuk dikurangi kas keluar', '6,4', 'miliar Rp', 'banknote', 4.2),
      kpi(3, 'Piutang Usaha', 'Saldo akhir Desember 2026', '7,8', 'miliar Rp', 'receipt', -5.4),
      kpi(6, 'Umur Piutang', 'Rata-rata hari sejak tagihan terbit', 47, 'hari', 'calendar', -6),
      kpi(6, 'Collection Rate', 'Tagihan tertagih dari yang jatuh tempo', '92', '%', 'percent', 3.5),
      k.narasi('Fokus Arus Kas', 'Menjaga likuiditas dan mempercepat collection: penagihan menyasar piutang di atas 60 hari, sementara belanja non-prioritas ditahan sampai kas aman.', 12, 2),
    ],
  },

  // 4 -----------------------------------------------------------------------
  {
    judul: 'Pengendalian Biaya',
    sub: 'Anggaran, realisasi, selisih, dan tindakan',
    kartu: [
      k.tabel('tabel-status', 'Kendali Biaya per Pos', 'Juta rupiah, tahun berjalan', 8, 4, ['Pos biaya', 'Anggaran', 'Realisasi', 'Selisih', 'Tindakan'], [
        ['Payroll', '18.900', '18.400', '-500', 'Terkendali'],
        ['Utilitas', '2.400', '2.150', '-250', 'Terkendali'],
        ['Perjalanan dinas', '1.500', '1.180', '-320', 'Perlu perhatian'],
        ['General expenses', '3.600', '3.420', '-180', 'Terkendali'],
        ['Biaya administrasi', '1.000', '940', '-60', 'Terkendali'],
        ['Biaya lainnya', '1.400', '1.310', '-90', 'Terkendali'],
      ]),
      k.grafik('donut', 'donat-tebal', 'Komposisi Biaya', 'Porsi per pos, persen', 4, 4,
        ['Payroll', 'General expenses', 'Utilitas', 'Perjalanan dinas', 'Administrasi', 'Lainnya'],
        [{ name: 'Porsi', data: [59, 11, 7, 4, 3, 16] }], '%'),
    ],
  },

  // 5 -----------------------------------------------------------------------
  {
    judul: 'Human Capital',
    sub: 'Jumlah, komposisi, dan produktivitas pegawai',
    kartu: [
      kpi(3, 'Total Karyawan', 'Pegawai aktif Desember 2026', '320', 'orang', 'users', 2.9),
      kpi(3, 'Struktur Organisasi', 'Unit kerja terisi dari rencana', '5', 'unit', 'building'),
      kpi(3, 'Kebutuhan Manpower', 'Formasi yang masih dibutuhkan', '38', 'orang', 'user-plus'),
      kpi(3, 'Vacancy Rate', 'Posisi kosong dari total formasi', '7,4', '%', 'briefcase', -1.2),
      kpi(3, 'Komposisi Jabatan', 'Porsi jabatan fungsional', '46', '%', 'clipboard', 1.8),
      kpi(3, 'Produktivitas', 'Pendapatan per pegawai', '152', 'juta Rp', 'gauge', 5.6),
      kpi(3, 'Turnover', 'Sepanjang tahun berjalan', '6,8', '%', 'activity', -0.9),
      kpi(3, 'Rasio Biaya SDM', 'Terhadap biaya operasional', '37,8', '%', 'percent', -0.6),
    ],
  },

  // 6 -----------------------------------------------------------------------
  {
    judul: 'Rekrutmen & Talenta',
    sub: 'Alur pemenuhan manpower dan mutu perekrutan',
    kartu: [
      k.grafik('funnel', 'alur-tahap', 'Alur Rekrutmen 2026', 'Kandidat per tahap · succession: 6 dari 10 posisi kunci sudah ada calon', 12, 4,
        ['Manpower Request', 'Recruitment', 'Interview', 'Offering', 'Hired'],
        [{ name: 'Kandidat', data: [38, 34, 26, 19, 16] }], 'orang'),
      kpi(3, 'Time to Fill', 'Rata-rata hari sampai posisi terisi', 42, 'hari', 'clock', -5),
      kpi(3, 'Vacancy Rate', 'Posisi kosong dari total formasi', '7,4', '%', 'briefcase', -1.2),
      kpi(3, 'Quality of Hire', 'Kandidat lolos masa percobaan', '84', '%', 'user-check', 3.4),
      kpi(3, 'Retention', 'Pegawai bertahan 12 bulan', '93', '%', 'shield-check', 1.6),
    ],
  },

  // 7 -----------------------------------------------------------------------
  {
    judul: 'Payroll & Benefit',
    sub: 'Belanja pegawai dan kendalinya terhadap anggaran',
    kartu: [
      k.tabel('tabel-ringkas', 'Rincian Belanja Pegawai', 'Juta rupiah, tahun berjalan', 6, 4, ['Komponen', 'Realisasi', 'Anggaran', 'Selisih'], [
        ['Total payroll', '14.800', '15.000', '-200'],
        ['Overtime', '620', '700', '-80'],
        ['Tunjangan', '2.340', '2.400', '-60'],
        ['BPJS', '1.180', '1.200', '-20'],
        ['Biaya per karyawan', '46,3', '47,5', '-1,2'],
        ['Payroll vs anggaran', '97,9%', '100%', '-2,1 poin'],
      ]),
      k.grafik('bar', 'bar-tegak-target', 'Payroll per Bulan', 'Miliar rupiah · fokus: akurasi payroll & kendali employee cost', 6, 4, BULAN, [
        { name: 'Realisasi', data: [1.18, 1.2, 1.22, 1.24, 1.21, 1.26, 1.23, 1.25, 1.22, 1.27, 1.24, 1.28] },
        { name: 'Anggaran', data: [1.25, 1.25, 1.25, 1.25, 1.25, 1.25, 1.25, 1.25, 1.25, 1.25, 1.25, 1.25], kind: 'line' },
      ], 'miliar Rp'),
    ],
  },

  // 8 -----------------------------------------------------------------------
  {
    judul: 'Kinerja & Pengembangan',
    sub: 'Penilaian kinerja, pelatihan, dan kaderisasi',
    kartu: [
      kpi(4, 'KPI Karyawan', 'Pegawai mencapai target kinerja', '88', '%', 'target', 2.4),
      kpi(4, 'Performance Review', 'Penilaian selesai tepat waktu', '96', '%', 'clipboard', 4.1),
      kpi(4, 'Jam Pelatihan', 'Rata-rata per pegawai per tahun', 24, 'jam', 'clock', 12),
      kpi(4, 'Sertifikasi', 'Pegawai bersertifikat kompetensi', 74, 'orang', 'shield-check', 9),
      kpi(4, 'Career Development', 'Pegawai ikut jalur pengembangan', '58', '%', 'trending-up', 6.5),
      kpi(4, 'Leadership Development', 'Peserta program kepemimpinan', 36, 'orang', 'users', 5),
    ],
  },

  // 9 -----------------------------------------------------------------------
  {
    judul: 'Tata Kelola & Kepatuhan',
    sub: 'Kendali keuangan, kepatuhan SDM, dan manajemen risiko',
    kartu: [
      poin('Financial Control', 'Kendali atas proses keuangan', 4, 6,
        'Setiap pengeluaran melewati persetujuan berjenjang dan rekonsiliasi bulanan sebelum tutup buku.',
        ['Approval berjenjang sesuai nilai transaksi', 'Rekonsiliasi bank tiap akhir bulan', 'Budget control: realisasi dicek terhadap anggaran', 'Dokumen pendukung lengkap sebelum bayar']),
      poin('HR Compliance', 'Kepatuhan administrasi kepegawaian', 4, 6,
        'Administrasi pegawai, kebijakan, payroll, dan SOP diperiksa berkala agar tidak menimbulkan temuan.',
        ['Administrasi karyawan tertib dan terarsip', 'Policy: kebijakan diperbarui sesuai aturan', 'Payroll: verifikasi dua lapis sebelum bayar', 'SOP: kepatuhan diperiksa tiap kuartal']),
      poin('Risk Management', 'Identifikasi dan pemantauan risiko', 4, 6,
        'Risiko keuangan dan SDM dipetakan, dimitigasi, lalu dipantau lewat papan isu manajemen.',
        ['Risk identification: daftar risiko per unit', 'Mitigasi: rencana aksi dan penanggung jawab', 'Monitoring: tinjauan bulanan di rapat manajemen']),
    ],
  },

  // 10 ----------------------------------------------------------------------
  {
    judul: 'Isu Utama',
    sub: 'Papan isu General Support dan tindak lanjutnya',
    kartu: [
      k.tabel('tabel-ringkas', 'Issue Board', 'Isu, prioritas, tindakan, dan penanggung jawab', 12, 4,
        ['Isu', 'Area', 'Prioritas', 'Action', 'PIC', 'Deadline'], [
          ['Cost overrun pada pos perjalanan dinas', 'Keuangan', 'High', 'Cost control', 'Manajer Keuangan', '31 Mar 2026'],
          ['Piutang di atas 90 hari', 'Keuangan', 'High', 'Collection', 'Manajer Akuntansi', '30 Apr 2026'],
          ['Vacancy jabatan teknis', 'SDM', 'Medium', 'Recruitment', 'Manajer SDM', '30 Jun 2026'],
          ['Akurasi data payroll', 'SDM', 'Medium', 'Review proses', 'Manajer Payroll', '31 Mei 2026'],
          ['Kepatuhan administrasi', 'General Support', 'High', 'Perbaikan SOP', 'Kepala General Support', '31 Mei 2026'],
        ]),
    ],
  },

  // 11 ----------------------------------------------------------------------
  {
    judul: 'Program Kerja',
    sub: 'Rencana keuangan dan rencana SDM',
    kartu: [
      poin('Program Keuangan', 'Fokus tahun 2027', 6, 6,
        'Empat program menjaga keuangan tetap sehat tanpa menekan layanan.',
        ['Efisiensi biaya pada pos yang bisa dikendalikan', 'Optimalisasi cash flow dan proyeksi kas bulanan', 'Percepatan collection piutang jatuh tempo', 'Penguatan financial control dan rekonsiliasi']),
      poin('Program SDM', 'Fokus tahun 2027', 6, 6,
        'Lima program menyiapkan orang yang tepat pada posisi yang tepat.',
        ['Pemenuhan manpower sesuai formasi', 'Peningkatan kompetensi lewat pelatihan terarah', 'Digitalisasi proses HR', 'Performance management yang terukur', 'Talent & succession untuk posisi kunci']),
    ],
  },

  // 12 ----------------------------------------------------------------------
  {
    judul: 'KPI 2027',
    sub: 'Sasaran kinerja tahun depan',
    kartu: [
      sasaran(3, 'Pertumbuhan Pendapatan', 6.1, 10, '%', '≥', 'trending-up'),
      sasaran(3, 'Margin EBITDA', 29.2, 30, '%', '≥', 'gauge'),
      sasaran(3, 'Akurasi Anggaran', 96.4, 98, '%', '≥', 'target'),
      sasaran(3, 'Collection / DSO', 47, 40, 'hari', '≤', 'calendar'),
      sasaran(3, 'Produktivitas SDM', 152, 165, 'juta Rp', '≥', 'users'),
      sasaran(3, 'Turnover', 6.8, 5, '%', '≤', 'activity'),
      sasaran(3, 'Time to Fill', 42, 35, 'hari', '≤', 'clock'),
      sasaran(3, 'Training Completion', 78, 90, '%', '≥', 'clipboard'),
    ],
  },

  // 13 ----------------------------------------------------------------------
  {
    judul: 'Penutup',
    sub: 'Arah umum General Support',
    kartu: [
      k.narasi('Keuangan Sehat, SDM Kuat, Operasional Efisien', 'Tiga hal itu yang dijaga bersama: keuangan yang sehat menjaga kepercayaan, SDM yang kuat menjaga layanan berjalan, dan operasional yang efisien menjaga keduanya bertahan.', 12, 3),
      kpi(4, 'Keuangan Sehat', 'Kas aman, biaya terkendali', '96,4', '%', 'wallet', 2.3),
      kpi(4, 'SDM Kuat', 'Formasi terisi dari kebutuhan', '92,6', '%', 'users', 1.4),
      kpi(4, 'Operasional Efisien', 'Realisasi program kerja', '88', '%', 'activity', 5.2),
    ],
  },

  // 14 ----------------------------------------------------------------------
  {
    judul: 'Prioritas & Langkah Selanjutnya',
    sub: 'Lima prioritas utama dan tindak lanjutnya',
    kartu: [
      poin('Prioritas Utama', 'Urutan pengerjaan tahun 2027', 6, 6,
        'Lima prioritas dikerjakan berurutan, bukan bersamaan, agar sumber daya cukup.',
        ['1. Cost control & efisiensi biaya', '2. Percepatan collection piutang', '3. Penguatan manpower & rekrutmen', '4. Akurasi payroll & employee cost', '5. Penguatan compliance']),
      poin('Langkah Selanjutnya', 'Tindak lanjut setelah rapat', 6, 6,
        'Rencana diselesaikan, penanggung jawab ditetapkan, lalu dipantau berkala.',
        ['Finalisasi rencana aksi per prioritas', 'Penetapan PIC dan timeline', 'Monitoring berkala tiap bulan', 'Evaluasi dan reporting ke manajemen']),
    ],
  },
];

export const TEMPLATE_KEUANGAN_SDM: DashboardTemplate = {
  id: `${PREFIKS_TEMPLATE_DECK}keuangan-sdm`,
  nama: 'Keuangan & Sumber Daya Manusia',
  kategoriId: 'keuangan',
  tujuan:
    'Management review fungsi General Support: kinerja keuangan, arus kas, kendali biaya, kondisi SDM, rekrutmen, payroll, tata kelola, isu utama, program kerja, dan sasaran KPI tahun depan.',
  caraPenyampaian: `Deck ${HALAMAN.length} halaman, satu halaman satu topik: ${HALAMAN.map((h) => h.judul).join(', ')}. Gaya tampilan dipilih terpisah di galeri.`,
  deskripsi: 'Deck management review keuangan & SDM: ringkasan, arus kas, kendali biaya, human capital, rekrutmen, payroll, tata kelola, isu, program, dan KPI 2027.',
  fokus: [
    'Ringkasan eksekutif',
    'Kinerja keuangan',
    'Arus kas & piutang',
    'Kendali biaya',
    'Human capital',
    'Rekrutmen & talenta',
    'Payroll & benefit',
    'Tata kelola & kepatuhan',
    'Isu & program kerja',
    'KPI 2027',
  ],
  aksen: '#0f4c81',
  tema: 'korporat',
  judulDashboard: 'Keuangan & Sumber Daya Manusia — Management Review 2026',
  deskripsiDashboard:
    'Management review General Support Keuangan & SDM 2026: kinerja keuangan, arus kas & piutang, kendali biaya, human capital, rekrutmen, payroll, kinerja & pengembangan, tata kelola, isu utama, program kerja, KPI 2027, dan langkah selanjutnya. Angka diambil dari dokumen instansi.',
  widgets: HALAMAN.flatMap((h) => h.kartu),
  bagian: {
    unit: 'Keuangan & SDM',
    halaman: HALAMAN.map((h) => ({ judul: h.judul, sub: h.sub, jumlah: h.kartu.length })),
    kunci: /general\s*support|keuangan\s*(&|dan)\s*sdm/i,
  },
};
