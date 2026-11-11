import type { WidgetSpec } from '../../types';
import type { DashboardTemplate } from './dashboardTemplates';
import { PREFIKS_TEMPLATE_DECK } from './templateBagian';
import { alatDeck } from './deckAlat';

/**
 * TEMPLATE DECK "SDM & KEPEGAWAIAN".
 *
 * Deck rapat manajemen sumber daya manusia dan kepegawaian: komposisi pegawai,
 * rekrutmen, turnover & retensi, kehadiran/cuti/lembur, payroll & benefit,
 * penilaian kinerja, kompetensi & pelatihan, karier & suksesi, kepatuhan
 * kepegawaian, isu & risiko, action plan, dan target KPI 2027.
 *
 *   1 Agenda Meeting             9 Kompetensi & Pelatihan
 *   2 Executive Summary         10 Karier, Mutasi & Suksesi
 *   3 Komposisi & Struktur      11 Kepatuhan Kepegawaian
 *   4 Rekrutmen & Formasi       12 Isu & Risiko SDM
 *   5 Turnover & Retensi        13 Action Plan
 *   6 Kehadiran, Cuti & Lembur  14 Target & KPI 2027
 *   7 Payroll & Benefit         15 Penutup
 *   8 Penilaian Kinerja
 *
 * Gaya (Pijar, Koran, Neon, ...) dipilih terpisah di galeri — template ini hanya
 * menentukan SUSUNAN, bukan tampilan. Semua angka di sini ANGKA CONTOH yang
 * saling konsisten (1.842 pegawai, biaya SDM Rp 214,8 miliar, turnover 8,4%);
 * dashboard nyata diisi dari dokumen instansi yang sedang login.
 */

const { kpi, sasaran, poin, teks, grafik, tabel } = alatDeck('sdmk', 'SDM & Kepegawaian');

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const KUARTAL = ['Kuartal 1', 'Kuartal 2', 'Kuartal 3', 'Kuartal 4'];

/** Kartu jadwal gantt: tugas bertanggal ISO, progres 0-100. */
const gantt = (
  title: string,
  sub: string,
  w: number,
  h: number,
  tugas: Array<{ name: string; start: string; end: string; progress: number }>
): WidgetSpec => {
  const kartu = grafik('gantt', 'jadwal-gantt', title, sub, w, h,
    tugas.map((t) => t.name), [{ name: 'Progres', data: tugas.map((t) => t.progress) }], '%');
  return { ...kartu, gantt: { tasks: tugas } } as WidgetSpec;
};

/**
 * Gauge dengan skala sendiri. Tanpa `max`, ECharts memakai 0-100 sehingga skor
 * 3,9 dari 5 hanya mengisi 3,9% busur; dengan `max: 5` busurnya 78%.
 */
const gaugeSkala = (
  title: string,
  sub: string,
  w: number,
  h: number,
  label: string,
  nilai: number,
  maks: number,
  target: number,
  unit: string
): WidgetSpec => {
  const kartu = grafik('gauge', 'gauge-target', title, sub, w, h, [label], [{ name: label, data: [nilai] }], unit);
  return { ...kartu, chart: { ...kartu.chart!, min: 0, max: maks, target } } as WidgetSpec;
};

const HALAMAN: Array<{ judul: string; sub: string; kartu: WidgetSpec[] }> = [
  {
    judul: 'Agenda Meeting',
    sub: 'Pokok bahasan rapat SDM & kepegawaian 2026',
    kartu: [
      poin('Agenda — Kinerja & Biaya', 'Bagian 1 dari 2', 6, 7,
        'Delapan pokok bahasan pertama: kondisi pegawai sampai biaya SDM.',
        [
          '1. Komposisi dan struktur pegawai',
          '2. Rekrutmen dan pengisian formasi',
          '3. Turnover dan retensi',
          '4. Kehadiran, cuti, dan lembur',
          '5. Payroll dan benefit',
          '6. Penilaian kinerja (SKP)',
          '7. Kompetensi dan pelatihan',
          '8. Karier, mutasi, dan suksesi',
        ]),
      poin('Agenda — Kepatuhan & Rencana', 'Bagian 2 dari 2', 6, 7,
        'Dilanjutkan kepatuhan kepegawaian, isu, dan sasaran tahun depan.',
        [
          '9. Kepatuhan kontrak dan dokumen pegawai',
          '10. Disiplin dan hubungan industrial',
          '11. Isu dan risiko SDM',
          '12. Action plan',
          '13. Target & KPI 2027',
          '14. Rencana penguatan kapasitas',
          '15. Keputusan rapat',
        ]),
    ],
  },
  {
    judul: 'Executive Summary',
    sub: 'Dashboard KPI SDM & kepegawaian 2026',
    kartu: [
      kpi(3, 'Total Pegawai', 'Aktif per Desember 2026', '1.842', 'orang', 'users', 3.1),
      kpi(3, 'Pegawai Tetap', 'Dari total pegawai aktif', '1.268', 'orang', 'user-check', 2.4),
      kpi(3, 'Turnover', 'Keluar dibanding headcount', '8,4', '%', 'user-minus', -1.2),
      kpi(3, 'Indeks Kepuasan', 'Survei pegawai 2026', '3,9', 'dari 5', 'smile', 4.8),
      // 1.842 = 1.268 tetap + 452 kontrak + 122 magang.
      grafik('donut', 'donat-tebal', 'Status Kepegawaian', 'Orang, total 1.842', 4, 4,
        ['Tetap', 'Kontrak', 'Magang'], [
          { name: 'Pegawai', data: [1268, 452, 122] },
        ], 'orang'),
      grafik('line', 'garis-tren', 'Headcount 2026', 'Orang per bulan, naik 3,1% dari Januari', 4, 4, BULAN, [
        { name: 'Headcount', data: [1787, 1792, 1798, 1802, 1808, 1814, 1819, 1824, 1828, 1832, 1837, 1842] },
      ], 'orang'),
      teks('Headline Management', 'Pertanyaan kunci rapat', 4, 4,
        'Pegawai tumbuh 3,1% dan turnover turun ke 8,4%, tetapi waktu isi formasi masih 42 hari (target 30) dan 96 kontrak berakhir dalam tiga bulan.'),
    ],
  },
  {
    judul: 'Komposisi & Struktur Pegawai',
    sub: 'Sebaran pegawai per unit, status, dan golongan usia',
    kartu: [
      grafik('donut', 'donat-tebal', 'Pegawai per Unit Kerja', 'Orang, total 1.842', 4, 4,
        ['Produksi', 'Distribusi', 'Pelayanan', 'Keuangan', 'SDM & Umum', 'TI'], [
          { name: 'Pegawai', data: [610, 460, 334, 200, 142, 96] },
        ], 'orang'),
      // Tiap baris menjumlah ke total unit di kiri, tiap kolom ke total status.
      grafik('heatmap', 'peta-panas', 'Unit Kerja vs Status Pegawai', 'Orang, total 1.842', 8, 4,
        ['Tetap', 'Kontrak', 'Magang'], [
          { name: 'Produksi', data: [420, 148, 42] },
          { name: 'Distribusi', data: [318, 112, 30] },
          { name: 'Pelayanan', data: [226, 84, 24] },
          { name: 'Keuangan', data: [142, 46, 12] },
          { name: 'SDM & Umum', data: [96, 38, 8] },
          { name: 'TI', data: [66, 24, 6] },
        ], 'orang'),
      grafik('bar', 'bar-tegak', 'Golongan Usia Pegawai', 'Orang, total 1.842', 12, 3,
        ['< 25 tahun', '25–34', '35–44', '45–54', '≥ 55'], [
          { name: 'Pegawai', data: [214, 486, 542, 428, 172] },
        ], 'orang'),
    ],
  },
  {
    judul: 'Rekrutmen & Formasi',
    sub: 'Pengisian formasi, sumber pelamar, dan waktu proses',
    kartu: [
      kpi(3, 'Formasi 2026', 'Kebutuhan yang dibuka', '214', 'formasi', 'clipboard-list', 8.6),
      kpi(3, 'Terisi', 'Formasi sudah diisi', '186', 'orang', 'user-plus', 6.4),
      kpi(3, 'Waktu Isi Formasi', 'Rata-rata dari buka sampai siap kerja', '42', 'hari', 'clock', -8.2,
        'Target 30 hari'),
      kpi(3, 'Pelamar', 'Sepanjang 2026', '3.284', 'orang', 'users', 12.4),
      // 3.284 pelamar menyusut sampai 186 diterima.
      grafik('funnel', 'alur-tahap', 'Pipeline Rekrutmen 2026', 'Jumlah kandidat per tahap', 7, 4,
        ['Pelamar', 'Screening', 'Wawancara', 'Offering', 'Diterima'], [
          { name: 'Kandidat', data: [3284, 1246, 642, 248, 186] },
        ], 'kandidat'),
      grafik('hbar', 'bar-mendatar-peringkat', 'Sumber Pelamar', 'Orang, total 3.284', 5, 4,
        ['Job portal', 'Referral pegawai', 'Kampus', 'Media sosial', 'Walk-in'], [
          { name: 'Pelamar', data: [1486, 642, 486, 428, 242] },
        ], 'orang'),
    ],
  },
  {
    judul: 'Turnover & Retensi',
    sub: 'Pegawai keluar, alasan, dan masa kerja',
    kartu: [
      kpi(3, 'Turnover', 'Keluar dibanding headcount', '8,4', '%', 'user-minus', -1.2),
      kpi(3, 'Pegawai Keluar', 'Sepanjang 2026', '155', 'orang', 'user-x', -12.4),
      kpi(3, 'Masa Kerja', 'Rata-rata pegawai aktif', '7,4', 'tahun', 'calendar', 2.6),
      kpi(3, 'Biaya Rekrutmen', 'Penggantian pegawai keluar', '3,4', 'miliar Rp', 'receipt', -6.8),
      grafik('bar', 'bar-tegak-sorot', 'Pegawai Keluar per Bulan', 'Orang, total 155 sepanjang 2026', 7, 4, BULAN, [
        { name: 'Keluar', data: [12, 11, 13, 10, 14, 12, 15, 11, 13, 16, 14, 14] },
      ], 'orang'),
      grafik('hbar', 'bar-mendatar-peringkat', 'Alasan Keluar', 'Orang, total 155', 5, 4,
        ['Gaji & benefit', 'Jam kerja', 'Jenjang karier', 'Lingkungan kerja', 'Lainnya'], [
          { name: 'Pegawai', data: [46, 32, 28, 22, 27] },
        ], 'orang'),
    ],
  },
  {
    judul: 'Kehadiran, Cuti & Lembur',
    sub: 'Disiplin kehadiran dan pemakaian hak pegawai',
    kartu: [
      kpi(3, 'Kehadiran', 'Rata-rata tahun berjalan', '97,2', '%', 'calendar-check', 0.8),
      kpi(3, 'Absensi', 'Tanpa keterangan', '2,8', '%', 'user-x', -0.7),
      kpi(3, 'Cuti Terpakai', 'Hari sepanjang 2026', '12.480', 'hari', 'calendar', 5.2),
      kpi(3, 'Lembur', 'Jam dibayar 2026', '38.640', 'jam', 'clock', 3.4),
      grafik('line', 'garis-tren', 'Kehadiran per Bulan', 'Persen, rata-rata 97,2%', 7, 4, BULAN, [
        { name: 'Kehadiran', data: [97.0, 96.8, 96.6, 97.4, 96.4, 97.2, 97.8, 97.6, 97.7, 97.0, 97.5, 97.4] },
      ], '%'),
      grafik('donut', 'donat-tipis', 'Cuti per Jenis', 'Hari, total 12.480', 5, 4,
        ['Cuti tahunan', 'Sakit', 'Melahirkan', 'Cuti besar', 'Lainnya'], [
          { name: 'Hari', data: [6840, 2460, 420, 1240, 1520] },
        ], 'hari'),
    ],
  },
  {
    judul: 'Payroll & Benefit',
    sub: 'Biaya pegawai dan komposisinya',
    kartu: [
      kpi(3, 'Payroll', 'Realisasi tahun berjalan', '168,4', 'miliar Rp', 'wallet', 5.6),
      kpi(3, 'Benefit', 'BPJS, tunjangan, kesejahteraan', '28,6', 'miliar Rp', 'shield-check', 4.2),
      kpi(3, 'Rasio Payroll', 'Terhadap pendapatan usaha', '28,9', '%', 'trending-down', -0.6),
      kpi(3, 'Biaya per Pegawai', 'Total biaya SDM', '116,6', 'juta Rp/orang', 'receipt', 2.4),
      grafik('bar', 'bar-kapsul', 'Payroll per Bulan', 'Miliar rupiah, total 168,4', 7, 4, BULAN, [
        { name: 'Payroll', data: [13.6, 13.8, 14.0, 13.9, 14.2, 14.4, 14.1, 14.0, 14.3, 13.9, 14.0, 14.2] },
      ], 'miliar Rp'),
      // Lima komponen menjumlah tepat ke biaya SDM 214,8 miliar.
      grafik('donut', 'donat-tebal', 'Komposisi Biaya SDM', 'Miliar rupiah, total 214,8', 5, 4,
        ['Payroll 78,4%', 'Benefit 13,3%', 'Lainnya 3,8%', 'Pelatihan 2,9%', 'Rekrutmen 1,6%'], [
          { name: 'Biaya', data: [168.4, 28.6, 8.2, 6.2, 3.4] },
        ], 'miliar Rp'),
    ],
  },
  {
    judul: 'Penilaian Kinerja',
    sub: 'Distribusi rating dan capaian sasaran kerja pegawai',
    kartu: [
      kpi(3, 'Dinilai', 'Pegawai dengan SKP 2026', '1.842', 'orang', 'clipboard-check', 2.8),
      kpi(3, 'Capaian Rata-rata', 'Nilai SKP organisasi', '96,4', '%', 'target', 1.6),
      kpi(3, 'Sangat Baik', 'Rating tertinggi', '268', 'orang', 'award', 18.2),
      kpi(3, 'Perlu Perbaikan', 'Rating terendah', '76', 'orang', 'alert-triangle', -22.4),
      // 268 + 986 + 512 + 76 = 1.842 pegawai yang dinilai.
      grafik('bar', 'bar-tumpuk', 'Distribusi Rating Kinerja', 'Orang per unit kerja', 7, 4,
        ['Produksi', 'Distribusi', 'Pelayanan', 'Keuangan', 'SDM & Umum', 'TI'], [
          { name: 'Sangat baik', data: [96, 68, 46, 28, 20, 10], kind: 'bar' },
          { name: 'Baik & cukup', data: [494, 372, 268, 160, 112, 82], kind: 'bar' },
        ], 'orang'),
      grafik('radar', 'radar-aspek', 'Profil Kompetensi Pegawai', 'Skor rata-rata per aspek, skala 1–5', 5, 4,
        ['Kualitas kerja', 'Kuantitas', 'Kedisiplinan', 'Kerja sama', 'Inisiatif', 'Kepatuhan SOP'], [
          { name: 'Skor 2026', data: [4.6, 4.3, 4.5, 4.7, 4.2, 4.6] },
          { name: 'Target 2027', data: [4.7, 4.5, 4.7, 4.8, 4.5, 4.8] },
        ], 'dari 5'),
    ],
  },
  {
    judul: 'Kompetensi & Pelatihan',
    sub: 'Jam pelatihan, peserta, dan sertifikasi',
    kartu: [
      kpi(3, 'Jam Pelatihan', 'Total 2026', '42.680', 'jam', 'graduation-cap', 9.4),
      kpi(3, 'Jam per Pegawai', 'Rata-rata 2026', '28,7', 'jam/orang', 'clock', 6.2),
      kpi(3, 'Peserta', 'Pegawai ikut pelatihan', '1.486', 'orang', 'users', 7.8),
      kpi(3, 'Sertifikasi', 'Pegawai bersertifikat', '78,6', '%', 'award', 4.2),
      grafik('bar', 'bar-tegak', 'Peserta Pelatihan per Jenis', 'Orang, 2026', 7, 4,
        ['Teknis', 'Manajerial', 'Kepatuhan & SOP', 'Digital', 'K3'], [
          { name: 'Peserta', data: [486, 212, 328, 264, 196] },
        ], 'orang'),
      gaugeSkala('Sertifikasi Kompetensi', 'Persen pegawai bersertifikat, target 90%', 5, 4,
        'Sertifikasi', 78.6, 100, 90, '%'),
    ],
  },
  {
    judul: 'Karier, Mutasi & Suksesi',
    sub: 'Perpindahan pegawai dan kesiapan posisi kunci',
    kartu: [
      kpi(3, 'Mutasi', 'Perpindahan antar unit', '126', 'orang', 'arrow-left-right', 6.4),
      kpi(3, 'Promosi', 'Naik jenjang 2026', '84', 'orang', 'trending-up', 11.2),
      kpi(3, 'Pensiun', 'Pegawai memasuki pensiun', '62', 'orang', 'user-minus', 4.8),
      kpi(3, 'Posisi Kunci Terisi', 'Sudah ada pengganti', '86', '%', 'briefcase', 3.6),
      grafik('combo', 'bar-tumpuk', 'Mutasi & Promosi per Kuartal', 'Orang, 2026', 7, 4, KUARTAL, [
        { name: 'Mutasi', data: [32, 34, 30, 30], kind: 'bar' },
        { name: 'Promosi', data: [20, 22, 21, 21], kind: 'bar' },
      ], 'orang'),
      tabel('tabel-status', 'Kesiapan Suksesi Posisi Kunci', 'Kandidat dan status kesiapan', 5, 4,
        ['Posisi', 'Kandidat', 'Status'],
        [
          ['Manajer Produksi', '3', 'Siap'],
          ['Manajer Keuangan', '2', 'Siap'],
          ['Kepala Pelayanan', '2', 'Latih'],
          ['Kepala TI', '1', 'Latih'],
          ['Manajer SDM', '2', 'Siap'],
        ]),
    ],
  },
  {
    judul: 'Kepatuhan Kepegawaian',
    sub: 'Kontrak, dokumen, dan disiplin pegawai',
    kartu: [
      kpi(3, 'Kontrak Aktif', 'Pegawai berstatus kontrak', '452', 'kontrak', 'file-text', 4.6),
      kpi(3, 'Berakhir ≤ 3 Bulan', 'Perlu diputuskan segera', '96', 'kontrak', 'clock', 12.4),
      kpi(3, 'Dokumen Lengkap', 'Berkas pegawai terverifikasi', '97,5', '%', 'file-check', 1.4),
      kpi(3, 'Kasus Disiplin', 'Sepanjang 2026', '34', 'kasus', 'alert-triangle', -18.6),
      grafik('donut', 'donat-tipis', 'Kelengkapan Dokumen Pegawai', 'Pegawai, total 1.842', 5, 4,
        ['Lengkap', 'Belum lengkap'], [
          { name: 'Pegawai', data: [1796, 46] },
        ], 'orang'),
      tabel('tabel-status', 'Kontrak Berakhir per Unit', 'Tiga bulan ke depan', 7, 4,
        ['Unit', 'Kontrak berakhir', 'Tindakan'],
        [
          ['Produksi', '34', 'Perpanjang'],
          ['Distribusi', '26', 'Perpanjang'],
          ['Pelayanan', '18', 'Evaluasi'],
          ['Keuangan', '8', 'Perpanjang'],
          ['SDM & Umum', '6', 'Angkat tetap'],
          ['TI', '4', 'Angkat tetap'],
        ]),
    ],
  },
  {
    judul: 'Isu & Risiko SDM',
    sub: 'Papan isu, sebaran, dan penyelesaiannya',
    kartu: [
      tabel('papan-isu', 'Issue Board SDM', 'Enam isu utama beserta statusnya', 12, 4,
        ['Isu', 'Area', 'Prioritas', 'Mitigasi', 'Status'],
        [
          ['Turnover pegawai muda tinggi', 'Retensi', 'High', 'Jenjang karier & benefit', 'Critical'],
          ['Waktu isi formasi 42 hari', 'Rekrutmen', 'High', 'Seleksi terpusat & talent pool', 'Critical'],
          ['Kesenjangan kompetensi digital', 'Pelatihan', 'Medium', 'Kurikulum digital', 'Perlu Perhatian'],
          ['96 kontrak berakhir 3 bulan', 'Kepatuhan', 'Medium', 'Jadwal evaluasi kontrak', 'Perlu Perhatian'],
          ['Lembur tinggi di produksi', 'Operasional', 'Medium', 'Penambahan shift', 'Perlu Perhatian'],
          ['Data kepegawaian terpisah', 'Sistem', 'Low', 'Integrasi HRIS', 'Terkendali'],
        ]),
      // Jumlah isu baru per unit per kuartal, total 19 isu; 13 di antaranya sudah tertutup.
      grafik('heatmap', 'peta-panas', 'Isu Baru per Unit', 'Jumlah isu per kuartal, total 19', 7, 3, KUARTAL, [
        { name: 'Produksi', data: [2, 1, 2, 1] },
        { name: 'Pelayanan', data: [1, 2, 1, 1] },
        { name: 'SDM', data: [1, 1, 1, 0] },
        { name: 'Keuangan', data: [1, 0, 1, 1] },
        { name: 'TI', data: [0, 1, 1, 0] },
      ], 'isu'),
      grafik('gauge', 'cincin-progres', 'Isu Sudah Ditutup', 'Dari 19 isu sepanjang 2026', 5, 3,
        ['Ditutup'], [{ name: 'Ditutup', data: [68] }], '%'),
    ],
  },
  {
    judul: 'Action Plan',
    sub: 'Tindak lanjut hasil rapat SDM',
    kartu: [
      tabel('tabel-status', 'Tindak Lanjut Hasil Meeting', 'PIC dan tenggat tiap aksi', 7, 4,
        ['No', 'Action', 'PIC', 'Deadline', 'Status'],
        [
          [1, 'Percepatan seleksi terpusat', 'Rekrutmen', '31 Jan 2027', 'Critical'],
          [2, 'Evaluasi 96 kontrak berakhir', 'Kepegawaian', '28 Feb 2027', 'Critical'],
          [3, 'Kurikulum digital & data', 'Pelatihan', '31 Mar 2027', 'Perlu Perhatian'],
          [4, 'Program retensi pegawai muda', 'SDM', '31 Mar 2027', 'Perlu Perhatian'],
          [5, 'Integrasi data HRIS', 'TI', '30 Jun 2027', 'Terkendali'],
          [6, 'Penyesuaian shift produksi', 'Operasional', '28 Feb 2027', 'Terkendali'],
        ]),
      gantt('Jadwal Tindak Lanjut 2027', 'Tanggal aksi dan progres berjalan', 5, 4, [
        { name: 'Seleksi terpusat', start: '2027-01-05', end: '2027-01-31', progress: 55 },
        { name: 'Evaluasi kontrak', start: '2027-01-15', end: '2027-02-28', progress: 40 },
        { name: 'Kurikulum digital', start: '2027-02-01', end: '2027-03-31', progress: 25 },
        { name: 'Retensi pegawai muda', start: '2027-02-01', end: '2027-03-31', progress: 30 },
        { name: 'Integrasi HRIS', start: '2027-03-01', end: '2027-06-30', progress: 10 },
        { name: 'Penyesuaian shift', start: '2027-01-10', end: '2027-02-28', progress: 45 },
      ]),
    ],
  },
  {
    judul: 'Target & KPI 2027',
    sub: 'Fokus peningkatan kinerja SDM & kepegawaian',
    kartu: [
      sasaran(3, 'Turnover', 8.4, 6, '%', '≤', 'user-minus'),
      sasaran(3, 'Kehadiran', 97.2, 98, '%', '≥', 'calendar-check'),
      sasaran(3, 'Waktu Isi Formasi', 42, 30, 'hari', '≤', 'clock'),
      sasaran(3, 'Indeks Kepuasan', 3.9, 4.2, 'dari 5', '≥', 'smile'),
      // Enam indikator dalam persen capaian, termasuk sertifikasi dan posisi kunci.
      grafik('radar', 'radar-aspek', 'Profil Capaian 2026 vs Target 2027', 'Persen capaian terhadap sasaran', 6, 4,
        ['Turnover', 'Kehadiran', 'Formasi', 'Kepuasan', 'Sertifikasi', 'Posisi Kunci'], [
          { name: 'Capaian 2026', data: [100, 99.2, 71.4, 92.9, 87.3, 86] },
          { name: 'Target 2027', data: [100, 100, 100, 100, 100, 100] },
        ], '%'),
      grafik('hbar', 'bar-mendatar-target', 'Capaian vs Target KPI 2027', 'Enam indikator, persen capaian', 6, 4,
        ['Turnover', 'Kehadiran', 'Waktu Isi Formasi', 'Indeks Kepuasan', 'Sertifikasi', 'Posisi Kunci'], [
          { name: 'Capaian 2026', data: [100, 99.2, 71.4, 92.9, 87.3, 86] },
          { name: 'Target 2027', data: [100, 100, 100, 100, 100, 100] },
        ], '%'),
    ],
  },
  {
    judul: 'Penutup',
    sub: 'Pegawai, kinerja, kepatuhan, dan keputusan rapat',
    kartu: [
      teks('Penutup Rapat', 'Empat hal yang dijaga bersama', 12, 3,
        'Pengelolaan SDM dinilai dari empat hal: pegawai cukup jumlah dan kompetensinya, kinerja terukur, biaya terkendali, dan kepatuhan kepegawaian rapi. Fokus 2027: mempercepat pengisian formasi, menurunkan turnover pegawai muda, dan merapikan 96 kontrak yang berakhir pada kuartal pertama.'),
      kpi(3, 'Pegawai', 'Total aktif', '1.842', 'orang', 'users', 3.1),
      kpi(3, 'Kinerja', 'Capaian SKP', '96,4', '%', 'target', 1.6),
      kpi(3, 'Kepatuhan', 'Dokumen lengkap', '97,5', '%', 'file-check', 1.4),
      kpi(3, 'Biaya', 'Rasio payroll', '28,9', '%', 'wallet', -0.6),
    ],
  },
];

export const TEMPLATE_SDM_KEPEGAWAIAN: DashboardTemplate = {
  id: `${PREFIKS_TEMPLATE_DECK}sdm-kepegawaian`,
  nama: 'SDM & Kepegawaian',
  kategoriId: 'sdm',
  tujuan:
    'Rapat manajemen SDM dan kepegawaian: komposisi pegawai, rekrutmen dan formasi, turnover dan retensi, kehadiran cuti dan lembur, payroll dan benefit, penilaian kinerja, kompetensi dan pelatihan, karier mutasi dan suksesi, kepatuhan kepegawaian, isu dan risiko, action plan, serta target KPI 2027.',
  caraPenyampaian: `Deck ${HALAMAN.length} halaman, satu halaman satu topik: ${HALAMAN.map((h) => h.judul).join(', ')}. Gaya tampilan dipilih terpisah di galeri.`,
  deskripsi:
    'Deck rapat SDM & kepegawaian: komposisi dan struktur pegawai, rekrutmen, turnover, kehadiran, payroll, penilaian kinerja, pelatihan, suksesi, kepatuhan kontrak, isu, dan KPI 2027.',
  fokus: [
    'Komposisi & struktur pegawai',
    'Rekrutmen & formasi',
    'Turnover & retensi',
    'Kehadiran, cuti & lembur',
    'Payroll & benefit',
    'Penilaian kinerja',
    'Kompetensi & pelatihan',
    'Karier, mutasi & suksesi',
    'Kepatuhan kepegawaian',
    'Isu & risiko SDM',
    'Action plan',
    'Target & KPI 2027',
  ],
  aksen: '#0f766e',
  tema: 'korporat',
  judulDashboard: 'SDM & Kepegawaian 2026 — Rapat Manajemen Sumber Daya Manusia',
  deskripsiDashboard:
    'Rapat bagian SDM dan kepegawaian 2026: komposisi dan struktur pegawai, rekrutmen dan pengisian formasi, turnover dan retensi, kehadiran cuti dan lembur, payroll dan benefit, penilaian kinerja, kompetensi dan pelatihan, karier mutasi dan suksesi, kepatuhan kontrak dan dokumen, isu dan risiko SDM, action plan, serta target KPI 2027. Angka diambil dari dokumen instansi.',
  widgets: HALAMAN.flatMap((h) => h.kartu),
  bagian: {
    unit: 'SDM & Kepegawaian',
    halaman: HALAMAN.map((h) => ({ judul: h.judul, sub: h.sub, jumlah: h.kartu.length })),
    kunci: /sdm|sumber\s*daya\s*manusia|kepegawaian|pegawai|karyawan|hrd|human\s*capital|personalia/i,
  },
};
