import type { WidgetSpec } from '../../types';
import type { DashboardTemplate } from './dashboardTemplates';
import { PREFIKS_TEMPLATE_DECK } from './templateBagian';
import { alatDeck } from './deckAlat';

/**
 * TEMPLATE DECK "OUTSOURCING MANAGEMENT MEETING".
 *
 * Disusun dari deck *Outsourcing Management Meeting 2026 — PT. Sandhy Putra
 * Makmur (SPM)*. Slide sampul TIDAK dijadikan halaman: judulnya dipakai sebagai
 * nama template. Sisa 15 slide menjadi 15 halaman, satu halaman = satu slide:
 *
 *   1 Agenda Meeting             9 Quality of Service
 *   2 Executive Summary         10 Permasalahan & Risiko
 *   3 Performance Tenaga Kerja  11 Pipeline & Prospek
 *   4 Distribusi Tenaga Kerja   12 Rencana Pengadaan
 *   5 Kontrak & Penempatan      13 Action Plan
 *   6 Performance Client        14 Target & KPI 2027
 *   7 Payroll & Cost Control    15 Penutup
 *   8 Revenue & Profitability
 *
 * Gaya (Pijar, Koran, Neon, ...) dipilih terpisah di galeri — template ini hanya
 * menentukan SUSUNAN, bukan tampilan. Semua angka di sini ANGKA CONTOH yang
 * saling konsisten (1.240 tenaga kerja, revenue Rp 186,4 miliar, biaya Rp 142,3
 * miliar); dashboard nyata diisi dari dokumen instansi yang sedang login.
 */

const { kpi, sasaran, poin, teks, grafik, tabel } = alatDeck('osrc', 'Outsourcing');

const TAHUN = ['2024', '2025', 'Outlook 2026', 'RKA 2027'];
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
 * 4,3 dari 5 hanya mengisi 4,3% busur; dengan `max: 5` busurnya penuh 86%.
 */
const gaugeSkala = (
  chartId: string,
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
  const kartu = grafik('gauge', chartId, title, sub, w, h, [label], [{ name: label, data: [nilai] }], unit);
  return { ...kartu, chart: { ...kartu.chart!, min: 0, max: maks, target } } as WidgetSpec;
};

const HALAMAN: Array<{ judul: string; sub: string; kartu: WidgetSpec[] }> = [
  {
    judul: 'Agenda Meeting',
    sub: 'Pokok bahasan rapat outsourcing 2026',
    kartu: [
      poin('Agenda — Kinerja & Kontrak', 'Bagian 1 dari 2', 6, 7,
        'Lima belas pokok bahasan, dibagi dua kolom agar terbaca satu layar.',
        [
          '1. Total tenaga kerja outsourced',
          '2. Jumlah kontrak aktif',
          '3. Distribusi tenaga kerja',
          '4. Tingkat kehadiran & absensi',
          '5. Turnover tenaga kerja',
          '6. Nilai revenue',
          '7. Payroll & cost control',
          '8. Margin outsourcing',
        ]),
      poin('Agenda — Layanan & Rencana', 'Bagian 2 dari 2', 6, 7,
        'Dilanjutkan pembahasan layanan, risiko, dan sasaran tahun depan.',
        [
          '9. Performa layanan (SLA & keluhan)',
          '10. Kepuasan client',
          '11. Pipeline & prospek',
          '12. Rencana pengadaan',
          '13. Permasalahan & risiko',
          '14. Action plan',
          '15. Target & KPI 2027',
        ]),
    ],
  },
  {
    judul: 'Executive Summary',
    sub: 'Dashboard KPI outsourcing 2026',
    kartu: [
      kpi(3, 'Total Tenaga Kerja', 'Aktif per Desember 2026', '1.240', 'orang', 'users', 4.2),
      kpi(3, 'Kontrak Aktif', 'Berjalan dengan 24 klien', '38', 'kontrak', 'file-text', 2.7),
      kpi(3, 'Nilai Revenue', 'Realisasi tahun berjalan', '186,4', 'miliar Rp', 'wallet', 8.6),
      kpi(3, 'SLA', 'Pencapaian layanan', '94,6', '%', 'shield-check', 1.2),
      grafik('donut', 'donat-tebal', 'Tenaga Kerja per Cabang', 'Orang, total 1.240', 4, 4,
        ['Jakarta', 'Bandung', 'Surabaya', 'Medan', 'Lainnya'], [
          { name: 'Tenaga kerja', data: [420, 260, 230, 180, 150] },
        ], 'orang'),
      grafik('line', 'garis-tren', 'Headcount 2026', 'Orang per bulan, naik 4,2% dari Januari', 4, 4, BULAN, [
        { name: 'Headcount', data: [1190, 1196, 1202, 1208, 1212, 1218, 1224, 1228, 1232, 1236, 1238, 1240] },
      ], 'orang'),
      teks('Headline Management', 'Pertanyaan kunci rapat', 4, 4,
        'Headcount tumbuh 4,2% dan turnover turun ke 14,2%. Yang perlu diputuskan: SLA 94,6% masih di bawah target 96% dan 27 keluhan client harus ditutup pada kuartal pertama 2027.'),
    ],
  },
  {
    judul: 'Performance Tenaga Kerja',
    sub: 'Headcount, kehadiran, absensi, produktivitas',
    kartu: [
      kpi(3, 'Headcount', 'Tenaga kerja aktif', '1.240', 'orang', 'users', 4.2),
      kpi(3, 'Kehadiran', 'Rata-rata tahun berjalan', '96,4', '%', 'calendar-check', 1.3),
      kpi(3, 'Absensi', 'Tidak hadir tanpa keterangan', '3,6', '%', 'user-x', -0.4),
      kpi(3, 'Produktivitas', 'Revenue per tenaga kerja', '150,3', 'juta Rp/orang', 'trending-up', 4.1),
      grafik('bar', 'bar-tegak-target', 'Kehadiran per Bulan', 'Persen, target 96%', 7, 4, BULAN, [
        { name: 'Kehadiran', data: [95.8, 96.1, 95.4, 96.8, 94.2, 96.3, 97.1, 96.6, 96.9, 96.2, 96.5, 96.4] },
        { name: 'Target', data: [96, 96, 96, 96, 96, 96, 96, 96, 96, 96, 96, 96], kind: 'line' },
      ], '%'),
      grafik('bar', 'bar-tegak-sorot', 'Turnover per Kuartal', 'Persen, total tahun berjalan 14,2%', 5, 4,
        ['Kuartal 1', 'Kuartal 2', 'Kuartal 3', 'Kuartal 4'], [
          { name: 'Turnover', data: [3.4, 3.6, 3.7, 3.5] },
        ], '%'),
    ],
  },
  {
    judul: 'Distribusi Tenaga Kerja',
    sub: 'Sebaran per cabang, lokasi, dan jenis pekerjaan',
    kartu: [
      grafik('donut', 'donat-tebal', 'Tenaga Kerja per Cabang', 'Orang, total 1.240', 4, 4,
        ['Jakarta', 'Bandung', 'Surabaya', 'Medan', 'Lainnya'], [
          { name: 'Tenaga kerja', data: [420, 260, 230, 180, 150] },
        ], 'orang'),
      // Tiap baris menjumlah ke total cabang di sebelah kiri dan total jenis di bawah.
      grafik('heatmap', 'peta-panas', 'Cabang vs Jenis Pekerjaan', 'Orang, total 1.240', 8, 4,
        ['Jakarta', 'Bandung', 'Surabaya', 'Medan', 'Lainnya'], [
          { name: 'Security', data: [170, 90, 70, 50, 40] },
          { name: 'Cleaning service', data: [110, 70, 60, 45, 35] },
          { name: 'Administrasi', data: [60, 40, 35, 25, 20] },
          { name: 'Driver', data: [45, 30, 25, 22, 18] },
          { name: 'Operator', data: [25, 20, 30, 33, 12] },
          { name: 'Lainnya', data: [10, 10, 10, 5, 25] },
        ], 'orang'),
      grafik('hbar', 'bar-mendatar-peringkat', 'Tenaga Kerja per Jenis Pekerjaan', 'Orang dan porsi dari 1.240', 12, 3,
        ['Security', 'Cleaning service', 'Administrasi', 'Driver', 'Operator', 'Lainnya'], [
          { name: 'Tenaga kerja', data: [420, 320, 180, 140, 120, 60] },
        ], 'orang'),
    ],
  },
  {
    judul: 'Kontrak & Penempatan',
    sub: 'Status kontrak berjalan dan penempatan baru',
    kartu: [
      kpi(3, 'Kontrak Aktif', 'Berjalan per Desember 2026', '38', 'kontrak', 'file-text', 2.7),
      kpi(3, 'Akan Berakhir', 'Habis dalam 6 bulan', '9', 'kontrak', 'clock', -10.0),
      kpi(3, 'Perpanjangan', 'Sudah disetujui klien', '6', 'kontrak', 'refresh', 20.0),
      kpi(3, 'Penempatan Baru', 'Sepanjang 2026', '128', 'orang', 'user-plus', 12.3),
      grafik('bar', 'bar-tegak', 'Kontrak Berakhir per Kuartal', 'Jumlah kontrak, 2027', 6, 4,
        ['Kuartal 1', 'Kuartal 2', 'Kuartal 3', 'Kuartal 4'], [
          { name: 'Kontrak berakhir', data: [4, 3, 2, 1] },
        ], 'kontrak'),
      // Tiga klien teratas 85,7 miliar = 46% revenue, sesuai catatan halaman Performance Client.
      grafik('hbar', 'bar-mendatar-peringkat', 'Nilai Kontrak Terbesar per Klien', 'Miliar rupiah, lima klien teratas', 6, 4,
        ['Klien A', 'Klien B', 'Klien C', 'Klien D', 'Klien E'], [
          { name: 'Nilai kontrak', data: [34.2, 28.6, 22.9, 14.8, 10.2] },
        ], 'miliar Rp'),
    ],
  },
  {
    judul: 'Performance Client',
    sub: 'Nilai kontrak, SLA, keluhan, kepuasan client',
    kartu: [
      kpi(3, 'Jumlah Client', 'Perusahaan pengguna jasa', '24', 'klien', 'building', 9.1),
      kpi(3, 'Nilai Kontrak', 'Nilai kontrak berjalan', '186,4', 'miliar Rp', 'wallet', 8.6),
      kpi(3, 'SLA', 'Pencapaian layanan', '94,6', '%', 'shield-check', 1.2),
      kpi(3, 'Keluhan', 'Kasus sepanjang 2026', '27', 'kasus', 'message-square', -18.2),
      gaugeSkala('gauge-target', 'Kepuasan Client', 'Skor 1–5, target 4,5', 3, 4, 'Kepuasan', 4.3, 5, 4.5, 'dari 5'),
      poin('Catatan Layanan', 'Ringkasan hubungan klien', 4, 4,
        'Tiga klien terbesar menyumbang 46% revenue dan semuanya memperpanjang kontrak.',
        [
          'Kepuasan 4,3 dari 5, target 4,5',
          'SLA 94,6%, target 96%',
          'Keluhan turun 18,2% dari 2025',
          'Response time rata-rata 3,4 jam',
        ]),
      grafik('line', 'garis-tren', 'SLA per Bulan', 'Persen, rata-rata tahun berjalan 94,6%', 5, 4, BULAN, [
        { name: 'SLA', data: [94.9, 94.2, 93.4, 95.1, 92.6, 94.8, 95.4, 95.0, 95.6, 94.4, 94.9, 94.6] },
      ], '%'),
    ],
  },
  {
    judul: 'Payroll & Cost Control',
    sub: 'Efisiensi biaya dan pengelolaan payroll',
    kartu: [
      kpi(3, 'Payroll', 'Realisasi tahun berjalan', '85,4', 'miliar Rp', 'wallet', 5.4),
      kpi(3, 'BPJS / Benefit', 'Kewajiban tenaga kerja', '21,3', 'miliar Rp', 'shield-check', 3.8),
      kpi(3, 'Biaya Operasional', 'Kantor cabang & proyek', '14,2', 'miliar Rp', 'receipt', -2.6),
      kpi(3, 'Margin Kotor', 'Terhadap revenue', '23,7', '%', 'trending-up', 1.8),
      grafik('donut', 'donat-tebal', 'Komposisi Biaya Outsourcing', 'Persen dari total biaya Rp 142,3 miliar', 6, 4,
        ['Payroll 60%', 'BPJS 15%', 'Operasional 10%', 'Lainnya 15%'], [
          { name: 'Porsi biaya', data: [60, 15, 10, 15] },
        ], '%'),
      // Payroll 85,4 dan BPJS 21,3 dipecah per kuartal, jumlahnya sama dengan KPI di atas.
      grafik('combo', 'bar-tumpuk', 'Payroll & BPJS per Kuartal', 'Miliar rupiah, 2026', 6, 4,
        ['Kuartal 1', 'Kuartal 2', 'Kuartal 3', 'Kuartal 4'], [
          { name: 'Payroll', data: [20.6, 21.2, 21.6, 22.0], kind: 'bar' },
          { name: 'BPJS', data: [5.1, 5.2, 5.4, 5.6], kind: 'bar' },
        ], 'miliar Rp'),
    ],
  },
  {
    judul: 'Revenue & Profitability',
    sub: 'Pertumbuhan pendapatan dan profitabilitas',
    kartu: [
      kpi(3, 'Revenue', 'Realisasi tahun berjalan', '186,4', 'miliar Rp', 'wallet', 8.6),
      kpi(3, 'Cost', 'Total biaya layanan', '142,3', 'miliar Rp', 'receipt', 6.9),
      kpi(3, 'Gross Profit', 'Revenue dikurangi biaya', '44,1', 'miliar Rp', 'trending-up', 14.2),
      kpi(3, 'EBITDA / Margin', 'Margin EBITDA', '16,2', '%', 'target', 1.4),
      grafik('combo', 'combo-batang-garis', 'Revenue vs Cost vs Profit', 'Miliar rupiah', 7, 4, TAHUN, [
        { name: 'Revenue', data: [148.2, 165.7, 186.4, 204.8], kind: 'bar' },
        { name: 'Cost', data: [116.4, 129.1, 142.3, 154.6], kind: 'bar' },
        { name: 'Gross profit', data: [31.8, 36.6, 44.1, 50.2], kind: 'line' },
      ], 'miliar Rp'),
      // Lima jenis layanan menjumlah tepat ke revenue 186,4 miliar.
      grafik('donut', 'donat-tipis', 'Revenue per Jenis Layanan', 'Miliar rupiah, total 186,4', 5, 4,
        ['Security', 'Cleaning', 'Administrasi', 'Driver', 'Operator'], [
          { name: 'Revenue', data: [72.4, 51.8, 26.2, 19.6, 16.4] },
        ], 'miliar Rp'),
    ],
  },
  {
    judul: 'Quality of Service',
    sub: 'SLA, complaint, dan respons layanan',
    kartu: [
      kpi(3, 'SLA', 'Pencapaian layanan', '94,6', '%', 'shield-check', 1.2),
      kpi(3, 'Complaint', 'Kasus sepanjang 2026', '27', 'kasus', 'message-square', -18.2),
      kpi(3, 'Replacement', 'Penggantian personel', '84', 'orang', 'refresh', -7.4),
      kpi(3, 'Response Time', 'Rata-rata penanganan', '3,4', 'jam', 'clock', -12.8),
      poin('Top Quality Issues', 'Sumber keluhan terbanyak', 7, 4,
        'Empat sumber keluhan utama yang harus ditutup lewat kontrol mutu di lapangan.',
        [
          'Spesifikasi / gambar kerja tidak sesuai permintaan klien',
          'Material dan peralatan tidak sesuai standar kontrak',
          'Hasil inspeksi belum konsisten antar cabang',
          'Rework / punch list menambah waktu penyelesaian',
        ]),
      grafik('radar', 'radar-aspek', 'Skor Mutu Layanan per Aspek', 'Skala 1–5, penilaian internal 2026', 5, 4,
        ['SLA', 'Ketepatan waktu', 'Kepatuhan SOP', 'Kebersihan', 'Respons keluhan', 'Keselamatan'], [
          { name: 'Skor 2026', data: [4.7, 4.4, 4.5, 4.3, 4.6, 4.8] },
          { name: 'Target', data: [5, 5, 5, 5, 5, 5] },
        ], 'dari 5'),
    ],
  },
  {
    judul: 'Permasalahan & Risiko',
    sub: 'Issue board dan mitigasi',
    kartu: [
      tabel('papan-isu', 'Issue Board Outsourcing', 'Enam isu utama beserta statusnya', 12, 4,
        ['Isu', 'Area', 'Prioritas', 'Mitigasi', 'Status'],
        [
          ['Turnover tinggi', 'SDM', 'High', 'Retensi & jenjang karier', 'Critical'],
          ['Keterlambatan payroll', 'Keuangan', 'High', 'Cut-off & rekonsiliasi', 'Critical'],
          ['Absensi tidak stabil', 'Operasional', 'Medium', 'Monitoring harian', 'Perlu Perhatian'],
          ['Keluhan client', 'Layanan', 'Medium', 'SLA review bulanan', 'Perlu Perhatian'],
          ['Kekurangan tenaga kerja', 'Operasional', 'Low', 'Talent pool cabang', 'Terkendali'],
          ['Keputusan kontrak', 'Komersial', 'Low', 'Jadwal negosiasi', 'Terkendali'],
        ]),
      // Jumlah isu baru per area per kuartal, total 22 isu; 14 di antaranya sudah tertutup.
      grafik('heatmap', 'peta-panas', 'Isu Baru per Area', 'Jumlah isu per kuartal, total 22', 7, 3,
        KUARTAL, [
          { name: 'SDM', data: [1, 1, 1, 1] },
          { name: 'Keuangan', data: [2, 1, 1, 0] },
          { name: 'Operasional', data: [1, 2, 2, 1] },
          { name: 'Layanan', data: [1, 1, 2, 1] },
          { name: 'Komersial', data: [1, 0, 1, 1] },
        ], 'isu'),
      grafik('gauge', 'cincin-progres', 'Isu Sudah Ditutup', 'Dari 22 isu sepanjang 2026', 5, 3,
        ['Ditutup'], [{ name: 'Ditutup', data: [64] }], '%'),
    ],
  },
  {
    judul: 'Pipeline & Prospek',
    sub: 'Prospek outsourcing dan status pengadaan',
    kartu: [
      grafik('funnel', 'alur-tahap', 'Pipeline Outsourcing 2027', 'Jumlah prospek per tahap', 7, 4,
        ['Request', 'RFQ', 'Evaluasi', 'Negosiasi', 'PO', 'Delivery', 'Payment'], [
          { name: 'Prospek', data: [7, 6, 4, 4, 3, 3, 2] },
        ], 'prospek'),
      grafik('hbar', 'bar-mendatar-peringkat', 'Nilai Pipeline per Segmen', 'Miliar rupiah, total 43,4', 5, 4,
        ['Security', 'Cleaning', 'Driver', 'Operator', 'Administrasi'], [
          { name: 'Nilai pipeline', data: [18.6, 11.4, 6.2, 4.8, 2.4] },
        ], 'miliar Rp'),
      grafik('hbar', 'daftar-progres', 'Status Pipeline Pengadaan', 'Persen penyelesaian tahapan', 12, 3,
        ['Pengadaan 01 — Security', 'Pengadaan 02 — Cleaning', 'Pengadaan 03 — Driver'], [
          { name: 'Progres', data: [72, 45, 20] },
        ], '%'),
    ],
  },
  {
    judul: 'Rencana Pengadaan',
    sub: 'Prioritas kebutuhan dan target delivery',
    kartu: [
      tabel('tabel-ringkas', 'Prioritas Kebutuhan & Target Delivery', 'RKA 2027, enam pengadaan utama', 7, 4,
        ['No', 'Kebutuhan', 'User / Dept', 'Target PO', 'Delivery', 'Status'],
        [
          [1, 'Security 120 personel', 'Operasional', 'Feb 2027', 'Apr 2027', 'Berjalan'],
          [2, 'Cleaning 80 personel', 'General Affair', 'Mar 2027', 'Mei 2027', 'Berjalan'],
          [3, 'Driver 40 personel', 'Operasional', 'Mar 2027', 'Jun 2027', 'Draft'],
          [4, 'Operator 60 personel', 'Produksi', 'Apr 2027', 'Jul 2027', 'Draft'],
          [5, 'Admin 30 personel', 'Keuangan', 'Mei 2027', 'Agu 2027', 'Draft'],
          [6, 'Perpanjangan 9 kontrak', 'Komersial', 'Jun 2027', 'Sep 2027', 'Draft'],
        ]),
      // Kebutuhan personel lima pengadaan pertama, total 330 orang.
      grafik('bar', 'bar-kapsul', 'Kebutuhan Personel per Pengadaan', 'Orang, total 330', 5, 4,
        ['Security', 'Cleaning', 'Operator', 'Driver', 'Admin'], [
          { name: 'Personel', data: [120, 80, 60, 40, 30] },
        ], 'orang'),
    ],
  },
  {
    judul: 'Action Plan',
    sub: 'Tindak lanjut hasil meeting',
    kartu: [
      tabel('tabel-status', 'Tindak Lanjut Hasil Meeting', 'PIC dan tenggat tiap aksi', 6, 4,
        ['No', 'Action', 'PIC', 'Deadline', 'Status'],
        [
          [1, 'Negosiasi vendor security', 'Komersial', '15 Feb 2027', 'Perlu Perhatian'],
          [2, 'Finalisasi spesifikasi cleaning', 'General Affair', '28 Feb 2027', 'Terkendali'],
          [3, 'Tender driver & operator', 'Pengadaan', '10 Mar 2027', 'Critical'],
          [4, 'Perbaikan cut-off payroll', 'Keuangan', '31 Jan 2027', 'Critical'],
          [5, 'Program retensi turnover', 'SDM', '31 Mar 2027', 'Perlu Perhatian'],
        ]),
      gantt('Jadwal Action Plan 2027', 'Tanggal aksi dan progres berjalan', 6, 4, [
        { name: 'Perbaikan cut-off payroll', start: '2027-01-05', end: '2027-01-31', progress: 75 },
        { name: 'Negosiasi vendor security', start: '2027-01-15', end: '2027-02-15', progress: 60 },
        { name: 'Finalisasi spesifikasi cleaning', start: '2027-02-01', end: '2027-02-28', progress: 45 },
        { name: 'Tender driver & operator', start: '2027-02-10', end: '2027-03-10', progress: 20 },
        { name: 'Program retensi turnover', start: '2027-02-01', end: '2027-03-31', progress: 30 },
      ]),
    ],
  },
  {
    judul: 'Target & KPI 2027',
    sub: 'Fokus peningkatan kinerja',
    kartu: [
      sasaran(3, 'Saving Pengadaan', 3.6, 4, 'miliar Rp', '≥', 'wallet'),
      sasaran(3, 'On-time Delivery', 92, 96, '%', '≥', 'truck'),
      sasaran(3, 'PO Cycle Time', 18, 14, 'hari', '≤', 'clock'),
      sasaran(3, 'Vendor Compliance', 95, 98, '%', '≥', 'shield-check'),
      // Enam indikator dalam persen capaian, termasuk PO tanpa revisi dan pengadaan sesuai budget.
      grafik('radar', 'radar-aspek', 'Profil Capaian 2026 vs Target 2027', 'Persen capaian terhadap sasaran', 6, 4,
        ['Saving', 'On-time', 'PO Cycle', 'Compliance', 'Tanpa Revisi', 'Sesuai Budget'], [
          { name: 'Capaian 2026', data: [90, 95.8, 77.8, 96.9, 95.7, 96.9] },
          { name: 'Target 2027', data: [100, 100, 100, 100, 100, 100] },
        ], '%'),
      grafik('hbar', 'bar-mendatar-target', 'Capaian vs Target KPI 2027', 'Enam indikator, persen capaian', 6, 4,
        ['Saving Pengadaan', 'On-time Delivery', 'PO Cycle Time', 'Vendor Compliance', 'PO Tanpa Revisi', 'Sesuai Budget'], [
          { name: 'Capaian 2026', data: [90, 95.8, 77.8, 96.9, 95.7, 96.9] },
          { name: 'Target 2027', data: [100, 100, 100, 100, 100, 100] },
        ], '%'),
    ],
  },
  {
    judul: 'Penutup',
    sub: 'People, service, productivity, cost efficiency',
    kartu: [
      teks('Terima Kasih', 'Bersama membangun layanan outsourcing yang lebih baik', 12, 3,
        'Empat pilar yang dijaga bersama sepanjang 2027: People, Service, Productivity, dan Cost Efficiency. Seluruh action plan pada rapat ini menjadi dasar penyusunan RKA 2027.'),
      kpi(3, 'People', 'Tenaga kerja terkelola', '1.240', 'orang', 'users', 4.2),
      kpi(3, 'Service', 'Pencapaian SLA', '94,6', '%', 'shield-check', 1.2),
      kpi(3, 'Productivity', 'Revenue per tenaga kerja', '150,3', 'juta Rp/orang', 'trending-up', 4.1),
      kpi(3, 'Cost Efficiency', 'Biaya per tenaga kerja', '114,8', 'juta Rp/orang', 'receipt', -2.6),
    ],
  },
];

export const TEMPLATE_OUTSOURCING: DashboardTemplate = {
  id: `${PREFIKS_TEMPLATE_DECK}outsourcing`,
  nama: 'Outsourcing Management Meeting',
  kategoriId: 'operasional',
  tujuan:
    'Rapat manajemen layanan outsourcing: jumlah tenaga kerja, kontrak & penempatan, kinerja client, payroll & cost control, revenue, mutu layanan, risiko, pipeline, rencana pengadaan, action plan, dan target KPI 2027.',
  caraPenyampaian: `Deck ${HALAMAN.length} halaman, satu halaman satu topik: ${HALAMAN.map((h) => h.judul).join(', ')}. Gaya tampilan dipilih terpisah di galeri.`,
  deskripsi:
    'Deck rapat outsourcing: headcount & distribusi, kontrak, kinerja client, payroll, revenue & profitabilitas, mutu layanan, isu & risiko, pipeline, pengadaan, action plan, dan KPI 2027.',
  fokus: [
    'Tenaga kerja & kontrak',
    'Kinerja client & SLA',
    'Payroll & cost control',
    'Revenue & profitabilitas',
    'Mutu layanan',
    'Isu & risiko',
    'Pipeline & pengadaan',
    'Action plan',
    'Target & KPI 2027',
  ],
  aksen: '#e2601c',
  tema: 'korporat',
  judulDashboard: 'Outsourcing Management Meeting 2026 — PT. Sandhy Putra Makmur',
  deskripsiDashboard:
    'Rapat bagian outsourcing 2026: total tenaga kerja dan distribusinya, kontrak & penempatan, kinerja client dan SLA, payroll & cost control, revenue & profitabilitas, mutu layanan, permasalahan & risiko, pipeline dan rencana pengadaan, action plan, serta target KPI 2027. Angka diambil dari dokumen instansi.',
  widgets: HALAMAN.flatMap((h) => h.kartu),
  bagian: {
    unit: 'Outsourcing',
    halaman: HALAMAN.map((h) => ({ judul: h.judul, sub: h.sub, jumlah: h.kartu.length })),
    kunci: /outsourc|tenaga\s*kerja\s*(outsourc|kontrak)|sandhy\s*putra/i,
  },
};
