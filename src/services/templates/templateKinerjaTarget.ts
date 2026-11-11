import type { WidgetSpec } from '../../types';
import type { DashboardTemplate } from './dashboardTemplates';
import { PREFIKS_TEMPLATE_DECK } from './templateBagian';
import { alatDeck } from './deckAlat';

/**
 * TEMPLATE DECK "KINERJA & TARGET".
 *
 * Deck rapat kinerja: scorecard korporat (empat perspektif), target vs realisasi,
 * kinerja keuangan/pelayanan/operasional/SDM, peringkat unit, inisiatif
 * strategis, deviasi & akar masalah, penetapan dan kaskade target 2027, action
 * plan, sampai keputusan rapat.
 *
 *   1 Agenda Meeting              9 Kinerja per Unit
 *   2 Executive Summary          10 Inisiatif Strategis
 *   3 Scorecard Korporat         11 Deviasi & Akar Masalah
 *   4 Target vs Realisasi        12 Penetapan Target 2027
 *   5 Kinerja Keuangan           13 Kaskade Target per Unit
 *   6 Kinerja Pelayanan          14 Action Plan
 *   7 Kinerja Operasional        15 Penutup
 *   8 Kinerja SDM & Budaya
 *
 * Gaya (Pijar, Koran, Neon, ...) dipilih terpisah di galeri — template ini hanya
 * menentukan SUSUNAN, bukan tampilan. Semua angka di sini ANGKA CONTOH yang
 * saling konsisten (nilai kinerja 87,4 dari 100, 42 indikator, revenue Rp 582,4
 * miliar); dashboard nyata diisi dari dokumen instansi yang sedang login.
 */

const { kpi, sasaran, poin, teks, grafik, tabel } = alatDeck('kntg', 'Kinerja & Target');

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

/** Gauge dengan skala 0-100 dan target, mis. nilai kinerja 87,4 dari target 90. */
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
    sub: 'Pokok bahasan rapat kinerja & target 2026',
    kartu: [
      poin('Agenda — Evaluasi Kinerja', 'Bagian 1 dari 2', 6, 7,
        'Delapan pokok bahasan pertama: scorecard sampai peringkat unit.',
        [
          '1. Nilai kinerja korporat',
          '2. Scorecard empat perspektif',
          '3. Target vs realisasi indikator',
          '4. Kinerja keuangan',
          '5. Kinerja pelayanan',
          '6. Kinerja operasional',
          '7. Kinerja SDM & budaya',
          '8. Peringkat unit kerja',
        ]),
      poin('Agenda — Rencana & Tindak Lanjut', 'Bagian 2 dari 2', 6, 7,
        'Dilanjutkan inisiatif strategis, deviasi, penetapan target, dan action plan.',
        [
          '9. Inisiatif strategis',
          '10. Deviasi dan akar masalah',
          '11. Penetapan target 2027',
          '12. Kaskade target per unit',
          '13. Kontrak kinerja',
          '14. Action plan',
          '15. Keputusan rapat',
        ]),
    ],
  },
  {
    judul: 'Executive Summary',
    sub: 'Dashboard KPI kinerja & target 2026',
    kartu: [
      kpi(3, 'Nilai Kinerja', 'Skor korporat 2026', '87,4', 'dari 100', 'target', 2.6),
      kpi(3, 'Indikator Tercapai', 'Dari 42 indikator', '34', 'indikator', 'check-circle', 8.4),
      kpi(3, 'Revenue', 'Realisasi vs target 600', '582,4', 'miliar Rp', 'wallet', 6.2),
      kpi(3, 'Laba Bersih', 'Realisasi vs target 78', '74,6', 'miliar Rp', 'trending-up', 5.4),
      gaugeSkala('Nilai Kinerja Korporat', 'Skor 0-100, target 90', 3, 4, 'Skor', 87.4, 100, 90, 'poin'),
      // Empat perspektif dengan bobot 30/25/25/20 menghasilkan skor 87,4.
      grafik('hbar', 'bar-mendatar-target', 'Capaian per Perspektif', 'Persen capaian terhadap target perspektif', 5, 4,
        ['Keuangan', 'Pelanggan', 'Proses internal', 'Pembelajaran'], [
          { name: 'Capaian 2026', data: [84, 92, 89, 85] },
          { name: 'Target 2026', data: [100, 100, 100, 100] },
        ], '%'),
      teks('Headline Management', 'Pertanyaan kunci rapat', 4, 4,
        'Nilai kinerja 87,4 dari target 90. Tiga indikator belum tercapai semuanya di sisi keuangan: revenue 97,1% dan laba 95,6% dari target.'),
    ],
  },
  {
    judul: 'Scorecard Korporat',
    sub: 'Empat perspektif dan status 42 indikator',
    kartu: [
      grafik('radar', 'radar-aspek', 'Profil Scorecard 2026', 'Skor per perspektif terhadap target', 6, 4,
        ['Keuangan', 'Pelanggan', 'Proses Internal', 'Pembelajaran & Pertumbuhan', 'Tata kelola'], [
          { name: 'Capaian 2026', data: [84, 92, 89, 85, 88] },
          { name: 'Target 2026', data: [100, 100, 100, 100, 100] },
        ], '%'),
      grafik('bar', 'bar-tegak-target', 'Skor per Perspektif', 'Skor 0-100, garis target 90', 6, 4,
        ['Keuangan', 'Pelanggan', 'Proses internal', 'Pembelajaran'], [
          { name: 'Skor 2026', data: [84, 92, 89, 85] },
          { name: 'Target', data: [90, 90, 90, 90], kind: 'line' },
        ], 'poin'),
      // 34 tercapai + 5 mendekati + 3 belum = 42 indikator.
      grafik('donut', 'donat-tebal', 'Status 42 Indikator', 'Jumlah indikator per status', 12, 3,
        ['Tercapai', 'Mendekati', 'Belum tercapai'], [
          { name: 'Indikator', data: [34, 5, 3] },
        ], 'indikator'),
    ],
  },
  {
    judul: 'Target vs Realisasi',
    sub: 'Enam indikator utama dan selisihnya',
    kartu: [
      kpi(3, 'Capaian Revenue', 'Terhadap target 600', '97,1', '%', 'wallet', -1.6),
      kpi(3, 'Capaian Laba', 'Terhadap target 78', '95,6', '%', 'trending-up', -2.4),
      kpi(3, 'Capaian EBITDA', 'Terhadap target 120', '98,7', '%', 'target', -0.8),
      kpi(3, 'Serapan Belanja', 'Dari pagu 445,4', '96,2', '%', 'receipt', 1.2),
      grafik('hbar', 'bar-mendatar-target', 'Capaian Indikator Utama', 'Persen capaian terhadap target 2026', 6, 4,
        ['Revenue', 'Laba bersih', 'EBITDA', 'ROE', 'Serapan belanja', 'SLA layanan'], [
          { name: 'Capaian 2026', data: [97.1, 95.6, 98.7, 93.3, 96.2, 100.2] },
          { name: 'Target 2026', data: [100, 100, 100, 100, 100, 100] },
        ], '%'),
      tabel('tabel-ringkas', 'Realisasi vs Target', 'Satuan asli tiap indikator', 6, 4,
        ['Indikator', 'Target', 'Realisasi'],
        [
          ['Revenue', 'Rp 600 M', 'Rp 582,4 M'],
          ['Laba bersih', 'Rp 78 M', 'Rp 74,6 M'],
          ['EBITDA', 'Rp 120 M', 'Rp 118,4 M'],
          ['ROE', '10,5%', '9,8%'],
          ['Belanja', 'Rp 445,4 M', 'Rp 428,6 M'],
          ['SLA layanan', '96,0%', '96,2%'],
        ]),
    ],
  },
  {
    judul: 'Kinerja Keuangan',
    sub: 'Pendapatan, laba, dan margin per kuartal',
    kartu: [
      kpi(3, 'Revenue', 'Realisasi tahun berjalan', '582,4', 'miliar Rp', 'wallet', 6.2),
      kpi(3, 'Laba Bersih', 'Setelah pajak', '74,6', 'miliar Rp', 'trending-up', 5.4),
      kpi(3, 'EBITDA', 'Margin 20,3%', '118,4', 'miliar Rp', 'target', 4.8),
      kpi(3, 'ROE', 'Laba terhadap ekuitas', '9,8', '%', 'trending-up', 0.6),
      grafik('combo', 'combo-batang-garis', 'Revenue & Laba per Kuartal', 'Miliar rupiah, 2026', 7, 4, KUARTAL, [
        { name: 'Revenue', data: [138.4, 146.2, 150.6, 147.2], kind: 'bar' },
        { name: 'Laba bersih', data: [16.8, 18.4, 19.6, 19.8], kind: 'line' },
      ], 'miliar Rp'),
      grafik('line', 'garis-tren', 'Margin EBITDA', 'Persen per kuartal, rata-rata 20,3%', 5, 4, KUARTAL, [
        { name: 'Margin EBITDA', data: [19.9, 20.3, 20.5, 20.6] },
      ], '%'),
    ],
  },
  {
    judul: 'Kinerja Pelayanan',
    sub: 'SLA, keluhan, dan kepuasan pelanggan',
    kartu: [
      kpi(3, 'SLA', 'Pencapaian layanan', '96,2', '%', 'shield-check', 0.4),
      kpi(3, 'Keluhan', 'Kasus sepanjang 2026', '412', 'kasus', 'message-square', -8.4),
      kpi(3, 'Kepuasan', 'Survei pelanggan', '4,3', 'dari 5', 'smile', 2.4),
      kpi(3, 'Penyelesaian Gangguan', 'Rata-rata penanganan', '6,8', 'jam', 'clock', -12.6),
      grafik('bar', 'bar-tegak-target', 'SLA per Bulan', 'Persen, garis target 96%', 7, 4, BULAN, [
        { name: 'SLA', data: [95.4, 95.8, 96.1, 96.6, 95.2, 96.4, 96.8, 96.5, 96.1, 96.3, 96.6, 96.4] },
        { name: 'Target', data: [96, 96, 96, 96, 96, 96, 96, 96, 96, 96, 96, 96], kind: 'line' },
      ], '%'),
      gaugeSkala('Kepuasan Pelanggan', 'Skor 1-5, target 4,3', 5, 4, 'Kepuasan', 4.3, 5, 4.3, 'dari 5'),
    ],
  },
  {
    judul: 'Kinerja Operasional',
    sub: 'Capaian per unit dan produktivitas',
    kartu: [
      kpi(3, 'Produktivitas', 'Pendapatan per pegawai', '316,2', 'juta Rp/orang', 'trending-up', 4.6),
      kpi(3, 'NRW', 'Kehilangan air', '22,4', '%', 'droplet', 1.8),
      kpi(3, 'Volume Produksi', 'Realisasi 2026', '48,6', 'juta m³', 'gauge', 3.2),
      kpi(3, 'Utilisasi Aset', 'Rata-rata pemakaian', '86,4', '%', 'calendar-check', 2.8),
      // Capaian target tiap unit per kuartal, rata-rata baris mendekati skor unit.
      grafik('heatmap', 'peta-panas', 'Capaian Target per Unit', 'Persen capaian per kuartal, 2026', 7, 4, KUARTAL, [
        { name: 'Produksi', data: [89, 91, 93, 94] },
        { name: 'Distribusi', data: [86, 88, 90, 91] },
        { name: 'Pelayanan', data: [84, 87, 89, 91] },
        { name: 'Keuangan', data: [84, 86, 88, 90] },
        { name: 'TI', data: [81, 84, 86, 87] },
        { name: 'SDM', data: [80, 83, 85, 88] },
      ], '%'),
      grafik('bar', 'bar-kapsul', 'Produktivitas per Unit', 'Juta rupiah per pegawai', 5, 4,
        ['Produksi', 'Distribusi', 'Pelayanan', 'Keuangan'], [
          { name: 'Produktivitas', data: [486.2, 384.4, 214.8, 148.6] },
        ], 'juta Rp'),
    ],
  },
  {
    judul: 'Kinerja SDM & Budaya',
    sub: 'Indikator people dan budaya kerja',
    kartu: [
      kpi(3, 'Engagement', 'Survei pegawai 2026', '3,9', 'dari 5', 'users', 4.8),
      kpi(3, 'Turnover', 'Keluar dibanding headcount', '8,4', '%', 'user-minus', -1.2),
      kpi(3, 'Jam Pelatihan', 'Rata-rata per pegawai', '28,7', 'jam/orang', 'graduation-cap', 6.2),
      kpi(3, 'Sertifikasi', 'Pegawai bersertifikat', '78,6', '%', 'award', 4.2),
      grafik('radar', 'radar-aspek', 'Profil Budaya Kerja', 'Skor per dimensi, skala 1-5', 5, 4,
        ['Integritas', 'Kolaborasi', 'Orientasi hasil', 'Inovasi', 'Pelayanan', 'Kepatuhan'], [
          { name: 'Skor 2026', data: [4.6, 4.4, 4.5, 3.9, 4.6, 4.7] },
          { name: 'Target 2027', data: [4.7, 4.6, 4.7, 4.3, 4.7, 4.8] },
        ], 'dari 5'),
      grafik('bar', 'bar-tegak', 'Peserta Pelatihan per Kuartal', 'Orang, total 1.486 peserta', 7, 4, KUARTAL, [
        { name: 'Peserta', data: [318, 372, 402, 394] },
      ], 'orang'),
    ],
  },
  {
    judul: 'Kinerja per Unit',
    sub: 'Peringkat skor dan kontribusi pendapatan',
    kartu: [
      // Skor rata-rata enam unit = 87,4, sama dengan nilai kinerja korporat.
      grafik('hbar', 'bar-mendatar-peringkat', 'Peringkat Skor Unit Kerja', 'Skor 0-100, rata-rata 87,4', 6, 4,
        ['Produksi', 'Distribusi', 'Pelayanan', 'Keuangan', 'TI', 'SDM'], [
          { name: 'Skor', data: [91.6, 88.9, 87.8, 87.2, 84.6, 84.3] },
        ], 'poin'),
      // Kontribusi unit terhadap revenue 582,4 miliar.
      grafik('donut', 'donat-tebal', 'Kontribusi Revenue per Unit', 'Miliar rupiah, total 582,4', 6, 4,
        ['Produksi 302,4', 'Distribusi 176,8', 'Pelayanan 92,6', 'Lainnya 10,6'], [
          { name: 'Revenue', data: [302.4, 176.8, 92.6, 10.6] },
        ], 'miliar Rp'),
      tabel('tabel-status', 'Status Kinerja Unit', 'Skor, capaian indikator, dan status', 12, 3,
        ['Unit', 'Skor', 'Indikator tercapai', 'Status'],
        [
          ['Produksi', '91,6', '9 dari 9', 'Sangat baik'],
          ['Distribusi', '88,9', '8 dari 9', 'Baik'],
          ['Pelayanan', '87,8', '7 dari 8', 'Baik'],
          ['Keuangan', '87,2', '6 dari 7', 'Baik'],
          ['TI', '84,6', '4 dari 5', 'Cukup'],
          ['SDM', '84,3', '4 dari 5', 'Cukup'],
        ]),
    ],
  },
  {
    judul: 'Inisiatif Strategis',
    sub: 'Progres program dan serapan anggaran',
    kartu: [
      kpi(3, 'Inisiatif', 'Program strategis 2026', '12', 'program', 'briefcase', 9.1),
      kpi(3, 'Selesai', 'Tuntas tahun ini', '8', 'program', 'check-circle', 14.3),
      kpi(3, 'Anggaran', 'Total pagu program', '128,6', 'miliar Rp', 'wallet', 7.4),
      kpi(3, 'Serapan', 'Realisasi anggaran program', '92,4', '%', 'receipt', 3.8),
      tabel('tabel-status', 'Status Program Strategis', 'Progres dan kendala', 7, 4,
        ['Program', 'Progres', 'Status'],
        [
          ['Digitalisasi layanan pelanggan', '100%', 'Selesai'],
          ['Optimalisasi jaringan distribusi', '100%', 'Selesai'],
          ['Penurunan NRW zona timur', '82%', 'Berjalan'],
          ['Integrasi data pelanggan', '74%', 'Berjalan'],
          ['Penguatan SDM digital', '58%', 'Berjalan'],
          ['Revitalisasi aset produksi', '35%', 'Tertunda'],
        ]),
      grafik('hbar', 'daftar-progres', 'Progres Program', 'Persen penyelesaian', 5, 4,
        ['Digitalisasi layanan', 'Jaringan distribusi', 'NRW zona timur', 'Integrasi data', 'SDM digital', 'Revitalisasi aset'], [
          { name: 'Progres', data: [100, 100, 82, 74, 58, 35] },
        ], '%'),
    ],
  },
  {
    judul: 'Deviasi & Akar Masalah',
    sub: 'Selisih capaian dan penyebabnya',
    kartu: [
      // Selisih capaian terhadap target dalam poin persen.
      grafik('bar', 'bar-tegak-sorot', 'Deviasi Capaian per Indikator', 'Poin persen terhadap target 2026', 7, 4,
        ['Revenue', 'Laba bersih', 'EBITDA', 'ROE', 'NRW', 'SLA'], [
          { name: 'Deviasi', data: [-2.9, -4.4, -1.3, -6.7, 1.8, 0.2] },
        ], 'poin'),
      tabel('papan-isu', 'Akar Masalah', 'Tiga indikator belum tercapai', 5, 4,
        ['Indikator', 'Penyebab', 'Status'],
        [
          ['Laba bersih', 'Beban energi naik', 'Critical'],
          ['ROE', 'Ekuitas tumbuh lebih cepat', 'Perlu Perhatian'],
          ['NRW', 'Kebocoran zona timur', 'Perlu Perhatian'],
          ['Revenue', 'Volume pelanggan industri turun', 'Perlu Perhatian'],
        ]),
      poin('Tindak Lanjut Deviasi', 'Kesepakatan rapat', 12, 3,
        'Empat indikator dibahas khusus; dua di antaranya diselesaikan lewat program yang sudah berjalan.',
        [
          'Revenue: penambahan segmen industri baru (target +Rp 22 M)',
          'Laba: efisiensi beban energi 6% pada semester I 2027',
          'ROE: penundaan belanja modal non-prioritas',
          'NRW: penggantian pipa zona timur 12,4 km',
        ]),
    ],
  },
  {
    judul: 'Penetapan Target 2027',
    sub: 'Angka target dan dasar penetapannya',
    kartu: [
      sasaran(3, 'Revenue', 582.4, 640, 'miliar Rp', '≥', 'wallet'),
      sasaran(3, 'Laba Bersih', 74.6, 84, 'miliar Rp', '≥', 'trending-up'),
      sasaran(3, 'Nilai Kinerja', 87.4, 90, 'poin', '≥', 'target'),
      sasaran(3, 'NRW', 22.4, 21, '%', '≤', 'droplet'),
      grafik('bar', 'bar-tegak-sorot', 'Target 2027 vs Realisasi 2026', 'Miliar rupiah', 7, 4,
        ['Revenue', 'Laba bersih', 'EBITDA', 'Belanja'], [
          { name: 'Realisasi 2026', data: [582.4, 74.6, 118.4, 428.6] },
          { name: 'Target 2027', data: [640, 84, 132, 452.8] },
        ], 'miliar Rp'),
      // Kontribusi target revenue 2027 per unit, total 640 miliar.
      grafik('donut', 'donat-tipis', 'Komposisi Target Revenue 2027', 'Miliar rupiah, total 640', 5, 4,
        ['Produksi 336', 'Distribusi 196', 'Pelayanan 96', 'Lainnya 12'], [
          { name: 'Target', data: [336, 196, 96, 12] },
        ], 'miliar Rp'),
    ],
  },
  {
    judul: 'Kaskade Target per Unit',
    sub: 'Target revenue 2027 dipecah per kuartal',
    kartu: [
      // Tiap sel = target revenue unit per kuartal, total seluruh sel 640 miliar.
      grafik('heatmap', 'peta-panas', 'Kaskade Target Revenue 2027', 'Miliar rupiah per unit per kuartal', 7, 4, KUARTAL, [
        { name: 'Produksi', data: [78, 82, 86, 90] },
        { name: 'Distribusi', data: [46, 48, 50, 52] },
        { name: 'Pelayanan', data: [22, 24, 25, 25] },
        { name: 'Lainnya', data: [3, 3, 3, 3] },
      ], 'miliar Rp'),
      grafik('bar', 'bar-tegak', 'Target Revenue per Kuartal', 'Miliar rupiah, total 640', 5, 4, KUARTAL, [
        { name: 'Target', data: [149, 157, 164, 170] },
      ], 'miliar Rp'),
      tabel('tabel-ringkas', 'Kontrak Kinerja 2027', 'Delapan indikator yang dikontrakkan', 12, 3,
        ['Indikator', 'Target 2027', 'Baseline 2026'],
        [
          ['Revenue', 'Rp 640 M', 'Rp 582,4 M'],
          ['Laba bersih', 'Rp 84 M', 'Rp 74,6 M'],
          ['EBITDA', 'Rp 132 M', 'Rp 118,4 M'],
          ['ROE', '11,0%', '9,8%'],
          ['NRW', '≤ 21%', '22,4%'],
          ['SLA layanan', '≥ 97%', '96,2%'],
        ]),
    ],
  },
  {
    judul: 'Action Plan',
    sub: 'Tindak lanjut hasil rapat kinerja',
    kartu: [
      tabel('tabel-status', 'Tindak Lanjut Hasil Meeting', 'PIC dan tenggat tiap aksi', 7, 4,
        ['No', 'Action', 'PIC', 'Deadline', 'Status'],
        [
          [1, 'Penambahan segmen industri baru', 'Komersial', '31 Mar 2027', 'Critical'],
          [2, 'Efisiensi beban energi 6%', 'Operasional', '30 Jun 2027', 'Critical'],
          [3, 'Penggantian pipa zona timur 12,4 km', 'Teknik', '31 Agu 2027', 'Perlu Perhatian'],
          [4, 'Penundaan belanja modal non-prioritas', 'Keuangan', '31 Jan 2027', 'Perlu Perhatian'],
          [5, 'Kontrak kinerja 8 indikator per unit', 'SDM', '28 Feb 2027', 'Terkendali'],
          [6, 'Dashboard kinerja harian per unit', 'TI', '31 Mar 2027', 'Terkendali'],
        ]),
      gantt('Jadwal Tindak Lanjut 2027', 'Tanggal aksi dan progres berjalan', 5, 4, [
        { name: 'Segmen industri baru', start: '2027-01-05', end: '2027-03-31', progress: 40 },
        { name: 'Efisiensi beban energi', start: '2027-01-15', end: '2027-06-30', progress: 25 },
        { name: 'Penggantian pipa zona timur', start: '2027-02-01', end: '2027-08-31', progress: 15 },
        { name: 'Kontrak kinerja unit', start: '2027-01-10', end: '2027-02-28', progress: 60 },
        { name: 'Dashboard harian', start: '2027-02-01', end: '2027-03-31', progress: 30 },
      ]),
    ],
  },
  {
    judul: 'Penutup',
    sub: 'Kinerja, target, dan keputusan rapat',
    kartu: [
      teks('Penutup Rapat', 'Tiga hal yang dijaga sampai 2027', 12, 3,
        'Pertama, indikator yang belum tercapai dijawab dengan program, bukan dengan penyesuaian target. Kedua, target 2027 dipecah ke unit dan kuartal supaya bisa dipantau bulanan. Ketiga, kontrak kinerja ditandatangani sebelum akhir Februari 2027 agar penilaian tidak menumpuk di akhir tahun.'),
      kpi(3, 'Kinerja 2026', 'Nilai korporat', '87,4', 'poin', 'target', 2.6),
      kpi(3, 'Target 2027', 'Nilai korporat', '90', 'poin', 'target', 2.9),
      kpi(3, 'Indikator', 'Dikontrakkan 2027', '8', 'indikator', 'clipboard-check', 33.3),
      kpi(3, 'Tindak Lanjut', 'Aksi dengan PIC', '6', 'aksi', 'check-circle', 0),
    ],
  },
];

export const TEMPLATE_KINERJA_TARGET: DashboardTemplate = {
  id: `${PREFIKS_TEMPLATE_DECK}kinerja-target`,
  nama: 'Kinerja & Target',
  kategoriId: 'kinerja',
  tujuan:
    'Rapat kinerja dan penetapan target: nilai kinerja korporat, scorecard empat perspektif, target vs realisasi, kinerja keuangan pelayanan operasional dan SDM, peringkat unit, inisiatif strategis, deviasi dan akar masalah, penetapan serta kaskade target 2027, dan action plan.',
  caraPenyampaian: `Deck ${HALAMAN.length} halaman, satu halaman satu topik: ${HALAMAN.map((h) => h.judul).join(', ')}. Gaya tampilan dipilih terpisah di galeri.`,
  deskripsi:
    'Deck rapat kinerja & target: scorecard korporat, target vs realisasi, kinerja keuangan pelayanan operasional dan SDM, peringkat unit, inisiatif strategis, deviasi, penetapan dan kaskade target 2027, action plan.',
  fokus: [
    'Nilai kinerja & scorecard',
    'Target vs realisasi',
    'Kinerja keuangan',
    'Kinerja pelayanan',
    'Kinerja operasional',
    'Kinerja SDM & budaya',
    'Peringkat unit',
    'Inisiatif strategis',
    'Deviasi & akar masalah',
    'Penetapan target 2027',
    'Kaskade target & kontrak kinerja',
    'Action plan',
  ],
  aksen: '#b45309',
  tema: 'korporat',
  judulDashboard: 'Kinerja & Target 2026 — Evaluasi Kinerja dan Penetapan Target 2027',
  deskripsiDashboard:
    'Rapat kinerja dan penetapan target: nilai kinerja korporat dan scorecard empat perspektif, target dibanding realisasi per indikator, kinerja keuangan pelayanan operasional dan SDM, peringkat unit kerja, inisiatif strategis, deviasi dan akar masalah, penetapan dan kaskade target 2027, kontrak kinerja, serta action plan. Angka diambil dari dokumen instansi.',
  widgets: HALAMAN.flatMap((h) => h.kartu),
  bagian: {
    unit: 'Kinerja & Target',
    halaman: HALAMAN.map((h) => ({ judul: h.judul, sub: h.sub, jumlah: h.kartu.length })),
    kunci: /kinerja|target|scorecard|kpi|kontrak\s*kinerja|realisasi\s*target|penilaian\s*kinerja/i,
  },
};
