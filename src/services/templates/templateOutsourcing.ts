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
      kpi(4, 'Total Tenaga Kerja', 'Aktif per Desember 2026', '1.240', 'orang', 'users', 4.2),
      kpi(4, 'Kontrak Aktif', 'Berjalan dengan 24 klien', '38', 'kontrak', 'file-text', 2.7),
      kpi(4, 'Klien / User', 'Perusahaan pengguna jasa', '24', 'klien', 'building', 9.1),
      kpi(4, 'Tingkat Kehadiran', 'Rata-rata tahun berjalan', '96,4', '%', 'calendar-check', 1.3),
      kpi(4, 'Turnover', 'Keluar dibanding headcount', '14,2', '%', 'user-minus', -2.1),
      kpi(4, 'Nilai Revenue', 'Realisasi tahun berjalan', '186,4', 'miliar Rp', 'wallet', 8.6),
      teks('Headline Management', 'Pertanyaan kunci rapat', 12, 2,
        'Apakah kinerja outsourcing sudah sesuai target jumlah tenaga kerja, kualitas layanan, dan efisiensi biaya? Headcount tumbuh 4,2% dengan turnover turun ke 14,2%, tetapi SLA 94,6% masih di bawah target 96% dan 27 keluhan client perlu ditutup pada kuartal pertama 2027.'),
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
      grafik('bar', 'bar-tegak-target', 'Kehadiran per Bulan', 'Persen, target 96%', 12, 4, BULAN, [
        { name: 'Kehadiran', data: [95.8, 96.1, 95.4, 96.8, 94.2, 96.3, 97.1, 96.6, 96.9, 96.2, 96.5, 96.4] },
        { name: 'Target', data: [96, 96, 96, 96, 96, 96, 96, 96, 96, 96, 96, 96], kind: 'line' },
      ], '%'),
    ],
  },
  {
    judul: 'Distribusi Tenaga Kerja',
    sub: 'Sebaran per cabang, lokasi, dan jenis pekerjaan',
    kartu: [
      grafik('donut', 'donat-tebal', 'Tenaga Kerja per Cabang', 'Orang, total 1.240', 5, 4,
        ['Jakarta', 'Bandung', 'Surabaya', 'Medan', 'Lainnya'], [
          { name: 'Tenaga kerja', data: [420, 260, 230, 180, 150] },
        ], 'orang'),
      tabel('tabel-ringkas', 'Tenaga Kerja per Jenis Pekerjaan', 'Orang, total 1.240', 7, 4,
        ['Jenis pekerjaan', 'Jumlah', 'Porsi'],
        [
          ['Security', 420, '33,9%'],
          ['Cleaning service', 320, '25,8%'],
          ['Administrasi', 180, '14,5%'],
          ['Driver', 140, '11,3%'],
          ['Operator', 120, '9,7%'],
          ['Lainnya', 60, '4,8%'],
        ]),
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
      grafik('bar', 'bar-tegak', 'Kontrak Berakhir per Kuartal', 'Jumlah kontrak, 2027', 12, 4,
        ['Kuartal 1', 'Kuartal 2', 'Kuartal 3', 'Kuartal 4'], [
          { name: 'Kontrak berakhir', data: [4, 3, 2, 1] },
        ], 'kontrak'),
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
      grafik('gauge', 'gauge-target', 'Kepuasan Client', 'Skor 1–5, target 4,5', 6, 4, ['Kepuasan'], [
        { name: 'Kepuasan client', data: [4.3] },
      ], 'dari 5'),
      poin('Catatan Layanan', 'Ringkasan hubungan klien', 6, 5,
        'Tiga klien terbesar menyumbang 46% revenue dan semuanya memperpanjang kontrak.',
        [
          'Kepuasan 4,3 dari 5, target 4,5',
          'SLA 94,6%, target 96%',
          'Keluhan turun 18,2% dari 2025',
          'Response time rata-rata 3,4 jam',
        ]),
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
      grafik('donut', 'donat-tebal', 'Komposisi Biaya Outsourcing', 'Persen dari total biaya Rp 142,3 miliar', 12, 4,
        ['Payroll 60%', 'BPJS 15%', 'Operasional 10%', 'Lainnya 15%'], [
          { name: 'Porsi biaya', data: [60, 15, 10, 15] },
        ], '%'),
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
      grafik('combo', 'combo-batang-garis', 'Revenue vs Cost vs Profit', 'Miliar rupiah', 12, 4, TAHUN, [
        { name: 'Revenue', data: [148.2, 165.7, 186.4, 204.8], kind: 'bar' },
        { name: 'Cost', data: [116.4, 129.1, 142.3, 154.6], kind: 'bar' },
        { name: 'Gross profit', data: [31.8, 36.6, 44.1, 50.2], kind: 'line' },
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
      poin('Top Quality Issues', 'Sumber keluhan terbanyak', 12, 5,
        'Empat sumber keluhan utama yang harus ditutup lewat kontrol mutu di lapangan.',
        [
          'Spesifikasi / gambar kerja tidak sesuai permintaan klien',
          'Material dan peralatan tidak sesuai standar kontrak',
          'Hasil inspeksi belum konsisten antar cabang',
          'Rework / punch list menambah waktu penyelesaian',
        ]),
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
    ],
  },
  {
    judul: 'Pipeline & Prospek',
    sub: 'Prospek outsourcing dan status pengadaan',
    kartu: [
      grafik('funnel', 'alur-tahap', 'Pipeline Outsourcing 2027', 'Jumlah prospek per tahap', 12, 3,
        ['Request', 'RFQ', 'Evaluasi', 'Negosiasi', 'PO', 'Delivery', 'Payment'], [
          { name: 'Prospek', data: [7, 6, 4, 4, 3, 3, 2] },
        ], 'prospek'),
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
      tabel('tabel-ringkas', 'Prioritas Kebutuhan & Target Delivery', 'RKA 2027, enam pengadaan utama', 12, 4,
        ['No', 'Kebutuhan', 'User / Dept', 'Target PO', 'Delivery', 'Status'],
        [
          [1, 'Security 120 personel', 'Operasional', 'Feb 2027', 'Apr 2027', 'Berjalan'],
          [2, 'Cleaning 80 personel', 'General Affair', 'Mar 2027', 'Mei 2027', 'Berjalan'],
          [3, 'Driver 40 personel', 'Operasional', 'Mar 2027', 'Jun 2027', 'Draft'],
          [4, 'Operator 60 personel', 'Produksi', 'Apr 2027', 'Jul 2027', 'Draft'],
          [5, 'Admin 30 personel', 'Keuangan', 'Mei 2027', 'Agu 2027', 'Draft'],
          [6, 'Perpanjangan 9 kontrak', 'Komersial', 'Jun 2027', 'Sep 2027', 'Draft'],
        ]),
    ],
  },
  {
    judul: 'Action Plan',
    sub: 'Tindak lanjut hasil meeting',
    kartu: [
      tabel('tabel-status', 'Tindak Lanjut Hasil Meeting', 'PIC dan tenggat tiap aksi', 12, 4,
        ['No', 'Action', 'PIC', 'Deadline', 'Status'],
        [
          [1, 'Negosiasi vendor security', 'Komersial', '15 Feb 2027', 'Perlu Perhatian'],
          [2, 'Finalisasi spesifikasi cleaning', 'General Affair', '28 Feb 2027', 'Terkendali'],
          [3, 'Tender driver & operator', 'Pengadaan', '10 Mar 2027', 'Critical'],
          [4, 'Perbaikan cut-off payroll', 'Keuangan', '31 Jan 2027', 'Critical'],
          [5, 'Program retensi turnover', 'SDM', '31 Mar 2027', 'Perlu Perhatian'],
        ]),
    ],
  },
  {
    judul: 'Target & KPI 2027',
    sub: 'Fokus peningkatan kinerja',
    kartu: [
      sasaran(4, 'Saving Pengadaan', 3.6, 4, 'miliar Rp', '≥', 'wallet'),
      sasaran(4, 'On-time Delivery', 92, 96, '%', '≥', 'truck'),
      sasaran(4, 'PO Cycle Time', 18, 14, 'hari', '≤', 'clock'),
      sasaran(4, 'Vendor Compliance', 95, 98, '%', '≥', 'shield-check'),
      sasaran(4, 'PO Tanpa Revisi', 88, 92, '%', '≥', 'file-check'),
      sasaran(4, 'Pengadaan Sesuai Budget', 95, 98, '%', '≥', 'target'),
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
