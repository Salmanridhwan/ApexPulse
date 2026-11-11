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
    // Delapan KPI dirapatkan ke 8 kolom kiri (4 x 2), chart tren di 4 kolom kanan
    // setinggi dua baris KPI. Halaman tetap 6 baris grid, sama dengan halaman lain.
    // Urutan penting: chart ditaruh setelah KPI ke-4 supaya grid menaruhnya di
    // kanan atas dan KPI ke-5 s.d. 8 mengisi baris kedua di kiri.
    kartu: [
      kpi(2, 'Pendapatan', 'Realisasi s.d. Desember 2026', '48,6', 'miliar Rp', 'wallet', 6.1),
      kpi(2, 'Biaya Operasional', 'Realisasi s.d. Desember 2026', '31,2', 'miliar Rp', 'receipt', -2.4),
      kpi(2, 'EBITDA', 'Laba sebelum bunga, pajak & amortisasi', '14,2', 'miliar Rp', 'trending-up', 8.4),
      kpi(2, 'Arus Kas Operasi', 'Kas bersih dari kegiatan operasi', '6,4', 'miliar Rp', 'banknote', 4.2),
      // Angka contoh per bulan menjumlah ke KPI: pendapatan 48,6 dan biaya 31,2.
      k.grafik('area', 'area-banding', 'Pendapatan vs Biaya Operasional', 'Miliar rupiah per bulan, 2026', 4, 6, BULAN, [
        { name: 'Pendapatan', data: [3.6, 3.7, 3.9, 4.0, 4.0, 4.1, 4.1, 4.2, 4.1, 4.2, 4.3, 4.4] },
        { name: 'Biaya Operasional', data: [2.5, 2.5, 2.6, 2.6, 2.6, 2.6, 2.6, 2.6, 2.6, 2.6, 2.7, 2.7] },
      ], 'miliar Rp'),
      kpi(2, 'Jumlah SDM', 'Pegawai aktif per Desember 2026', '320', 'orang', 'users', 2.9),
      kpi(2, 'Biaya SDM', 'Payroll, tunjangan & BPJS', '18,4', 'miliar Rp', 'coins', 3.1),
      kpi(2, 'Turnover', 'Sepanjang tahun berjalan', '6,8', '%', 'activity', -0.9),
      kpi(2, 'Produktivitas SDM', 'Pendapatan per pegawai', '152', 'juta Rp', 'gauge', 5.6),
      // Baris bawah: tiga bentuk berbeda yang belum dipakai di deck ini. Angka
      // contoh tetap nyambung: 48,6 - 18,4 - 12,8 = 17,4 (laba kotor halaman 2),
      // dikurangi 3,2 = EBITDA 14,2; lini usaha menjumlah ke pendapatan 48,6;
      // realisasi anggaran 96,4% sama dengan tabel halaman 2.
      k.grafik('waterfall', 'air-terjun', 'Dari Pendapatan ke EBITDA', 'Miliar rupiah, 2026', 4, 4,
        ['Pendapatan', 'Biaya SDM', 'Biaya non-SDM', 'Beban lain', 'EBITDA'],
        [{ name: 'Nilai', data: [48.6, -18.4, -12.8, -3.2, 14.2] }], 'miliar Rp'),
      k.grafik('treemap', 'treemap-porsi', 'Pendapatan per Lini Usaha', 'Miliar rupiah, 2026', 4, 4,
        ['Facility Services', 'Building & Konstruksi', 'Jasa Lainnya', 'Sewa Aset'],
        [{ name: 'Pendapatan', data: [18.2, 12.4, 9.4, 8.6] }], 'miliar Rp'),
      k.grafik('gauge', 'cincin-progres', 'Realisasi Anggaran', 'Realisasi terhadap anggaran 2026', 4, 4,
        ['Realisasi'], [{ name: 'Realisasi', data: [96.4] }], '%'),
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
      // Baris bawah: tiga bentuk yang belum dipakai di deck. Angka contoh nyambung:
      // margin EBITDA = EBITDA / pendapatan (11,8/41,2 = 28,6% ... 16,0/53,4 = 30,0%),
      // margin laba bersih 2025-2026 = 8,3/45,8 dan 9,8/48,6 (tabel di atas),
      // beban usaha 2025 = 30,4 dan 2026 = 31,2 (SDM 18,4 + non-SDM 12,8, halaman 1).
      // Realisasi anggaran sengaja tidak diulang: sudah ada di halaman 1.
      k.grafik('line', 'garis-tren', 'Tren Margin', 'Persen terhadap pendapatan', 4, 4, TAHUN, [
        { name: 'Margin EBITDA', data: [28.6, 28.6, 29.2, 30.0] },
        { name: 'Margin laba bersih', data: [17.0, 18.1, 20.2, 21.0] },
      ], '%'),
      k.grafik('bar', 'bar-tumpuk', 'Struktur Beban Usaha', 'Miliar rupiah per tahun', 4, 4, TAHUN, [
        { name: 'Beban SDM', data: [16.9, 17.8, 18.4, 19.6] },
        { name: 'Beban non-SDM', data: [12.0, 12.6, 12.8, 13.8] },
      ], 'miliar Rp'),
      // Laba bersih per triwulan menjumlah ke 9,8 miliar (tabel di atas).
      k.grafik('bar', 'bar-kapsul', 'Laba Bersih per Triwulan', 'Miliar rupiah, 2026', 4, 4,
        ['TW I', 'TW II', 'TW III', 'TW IV'], [{ name: 'Laba bersih', data: [2.1, 2.4, 2.5, 2.8] }], 'miliar Rp'),
    ],
  },

  // 3 -----------------------------------------------------------------------
  {
    judul: 'Arus Kas & Piutang',
    sub: 'Likuiditas dan kecepatan penagihan',
    kartu: [
      // Enam KPI satu baris (lebar 2), lalu baris chart, lalu narasi: 9 baris grid.
      kpi(2, 'Kas Masuk', 'Penerimaan kas tahun berjalan', '52,1', 'miliar Rp', 'trending-up', 7.3),
      kpi(2, 'Kas Keluar', 'Pengeluaran kas tahun berjalan', '45,7', 'miliar Rp', 'trending-down', 3.1),
      kpi(2, 'Arus Kas Bersih', 'Kas masuk dikurangi kas keluar', '6,4', 'miliar Rp', 'banknote', 4.2),
      kpi(2, 'Piutang Usaha', 'Saldo akhir Desember 2026', '7,8', 'miliar Rp', 'receipt', -5.4),
      kpi(2, 'Umur Piutang', 'Rata-rata hari sejak tagihan terbit', 47, 'hari', 'calendar', -6),
      kpi(2, 'Collection Rate', 'Tagihan tertagih dari yang jatuh tempo', '92', '%', 'percent', 3.5),
      // Tiga bentuk yang belum dipakai di deck. Angka contoh nyambung dengan KPI:
      // arus kas bersih bulanan menjumlah 6,4; umur piutang dan piutang per lini
      // usaha masing-masing menjumlah ke saldo piutang 7,8 miliar.
      k.grafik('area', 'area-gradasi', 'Arus Kas Bersih per Bulan', 'Miliar rupiah, 2026', 5, 4, BULAN, [
        { name: 'Arus kas bersih', data: [0.3, 0.4, 0.5, 0.5, 0.6, 0.5, 0.6, 0.6, 0.5, 0.6, 0.6, 0.7] },
      ], 'miliar Rp'),
      k.grafik('donut', 'donat-tipis', 'Umur Piutang', 'Saldo piutang per kelompok umur, miliar Rp', 3, 4,
        ['0-30 hari', '31-60 hari', '61-90 hari', '> 90 hari'],
        [{ name: 'Piutang', data: [3.9, 2.0, 1.1, 0.8] }], 'miliar Rp'),
      k.grafik('hbar', 'bar-mendatar-peringkat', 'Piutang per Lini Usaha', 'Miliar rupiah, saldo akhir 2026', 4, 4,
        ['Facility Services', 'Building & Konstruksi', 'Jasa Lainnya', 'Sewa Aset'],
        [{ name: 'Piutang', data: [3.1, 2.4, 1.3, 1.0] }], 'miliar Rp'),
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
      // Baris bawah: tiga bentuk yang belum dipakai di deck, angka dari tabel di atas.
      // Serapan = realisasi / anggaran (Payroll 18.400/18.900 = 97,4% dst).
      k.grafik('hbar', 'bar-mendatar-target', 'Serapan Anggaran per Pos', 'Persen realisasi terhadap anggaran', 4, 4,
        ['Payroll', 'Utilitas', 'Perjalanan dinas', 'General expenses', 'Administrasi', 'Lainnya'], [
          { name: 'Serapan', data: [97.4, 89.6, 78.7, 95.0, 94.0, 93.6] },
          { name: 'Batas anggaran', data: [100, 100, 100, 100, 100, 100] },
        ], '%'),
      // Per triwulan menjumlah ke kolom Realisasi tabel (mis. utilitas 520+540+530+560 = 2.150).
      // Payroll tidak dimasukkan: angkanya 4 kali pos lain sehingga warna pos lain jadi seragam.
      k.grafik('heatmap', 'peta-panas', 'Biaya Non-Payroll per Triwulan', 'Juta rupiah, 2026', 4, 4,
        ['TW I', 'TW II', 'TW III', 'TW IV'], [
          { name: 'Utilitas', data: [520, 540, 530, 560] },
          { name: 'Perjalanan dinas', data: [250, 310, 330, 290] },
          { name: 'General expenses', data: [820, 860, 850, 890] },
          { name: 'Administrasi', data: [220, 230, 240, 250] },
          { name: 'Lainnya', data: [300, 320, 340, 350] },
        ], 'juta Rp'),
      k.grafik('radar', 'radar-aspek', 'Skor Kendali Biaya', 'Penilaian internal, skala 1-5', 4, 4,
        ['Kepatuhan anggaran', 'Efisiensi', 'Ketepatan bayar', 'Kelengkapan dokumen', 'Kendali perjalanan'], [
          { name: 'Skor 2026', data: [4.6, 4.1, 4.3, 4.0, 3.2] },
        ], 'skor'),
    ],
  },

  // 5 -----------------------------------------------------------------------
  {
    judul: 'Human Capital',
    sub: 'Jumlah, komposisi, dan produktivitas pegawai',
    kartu: [
      // Susunan seperti halaman 1: KPI 4 x 2 di kiri, chart tinggi di kanan,
      // lalu baris chart di bawah. Semua jenis chart belum dipakai di deck.
      // Angka contoh per unit menjumlah ke KPI: pegawai 320, formasi 358
      // (320 + kebutuhan 38), biaya SDM 18,4 miliar, turnover tertimbang 6,8%.
      kpi(2, 'Total Karyawan', 'Pegawai aktif Desember 2026', '320', 'orang', 'users', 2.9),
      kpi(2, 'Struktur Organisasi', 'Unit kerja terisi dari rencana', '5', 'unit', 'building'),
      kpi(2, 'Kebutuhan Manpower', 'Formasi yang masih dibutuhkan', '38', 'orang', 'user-plus'),
      kpi(2, 'Vacancy Rate', 'Posisi kosong dari total formasi', '7,4', '%', 'briefcase', -1.2),
      k.grafik('bar', 'bar-tegak-sorot', 'Pegawai per Unit Kerja', 'Orang, Desember 2026', 4, 6,
        ['Operasional', 'Pemasaran', 'Keuangan', 'Umum', 'SDM'],
        [{ name: 'Pegawai', data: [142, 52, 46, 42, 38] }], 'orang'),
      kpi(2, 'Komposisi Jabatan', 'Porsi jabatan fungsional', '46', '%', 'clipboard', 1.8),
      kpi(2, 'Produktivitas', 'Pendapatan per pegawai', '152', 'juta Rp', 'gauge', 5.6),
      kpi(2, 'Turnover', 'Sepanjang tahun berjalan', '6,8', '%', 'activity', -0.9),
      kpi(2, 'Rasio Biaya SDM', 'Terhadap biaya operasional', '37,8', '%', 'percent', -0.6),
      // Pemenuhan = pegawai / formasi unit (142/160, 52/58, 46/50, 42/50, 38/40).
      k.grafik('hbar', 'daftar-progres', 'Pemenuhan Formasi per Unit', 'Persen formasi terisi', 4, 4,
        ['Operasional', 'Pemasaran', 'Keuangan', 'Umum', 'SDM'],
        [{ name: 'Terisi', data: [88.8, 89.7, 92.0, 84.0, 95.0] }], '%'),
      // X = jumlah pegawai, Y = turnover, ukuran = biaya SDM (miliar Rp).
      k.grafik('bubble', 'scatter-gelembung', 'Turnover vs Jumlah Pegawai', 'Per unit kerja, ukuran = biaya SDM', 5, 4,
        ['Operasional', 'Pemasaran', 'Keuangan', 'Umum', 'SDM'], [
          { name: 'Jumlah pegawai', data: [142, 52, 46, 42, 38] },
          { name: 'Turnover (%)', data: [8.3, 7.7, 4.3, 4.8, 5.3] },
          { name: 'Biaya SDM (miliar Rp)', data: [7.9, 3.0, 3.0, 2.2, 2.3] },
        ], ''),
      k.grafik('gauge', 'gauge-kesehatan', 'Indeks Engagement', 'Survei pegawai 2026, skala 1-5', 3, 4,
        ['Engagement'], [{ name: 'Engagement', data: [4.1] }], 'skor'),
    ],
  },

  // 6 -----------------------------------------------------------------------
  {
    judul: 'Rekrutmen & Talenta',
    sub: 'Alur pemenuhan manpower dan mutu perekrutan',
    kartu: [
      // Alur dipersempit ke 7 kolom supaya sankey sumber kandidat muat di sampingnya.
      k.grafik('funnel', 'alur-tahap', 'Alur Rekrutmen 2026', 'Kandidat per tahap', 7, 4,
        ['Manpower Request', 'Recruitment', 'Interview', 'Offering', 'Hired'],
        [{ name: 'Kandidat', data: [38, 34, 26, 19, 16] }], 'orang'),
      // Format sankey: kategori "asal > tujuan". Angka nyambung dengan alur:
      // 26 kandidat interview (11 + 7 + 6 + 2), 16 hired + 10 tidak lolos.
      k.grafik('sankey', 'sankey-alur', 'Sumber Kandidat ke Hasil', 'Orang, kandidat tahap interview 2026', 5, 4,
        ['Job portal > Interview', 'Referral > Interview', 'Kampus > Interview', 'Headhunter > Interview', 'Interview > Hired', 'Interview > Tidak lolos'],
        [{ name: 'Kandidat', data: [11, 7, 6, 2, 16, 10] }], 'orang'),
      kpi(3, 'Time to Fill', 'Rata-rata hari sampai posisi terisi', 42, 'hari', 'clock', -5),
      kpi(3, 'Vacancy Rate', 'Posisi kosong dari total formasi', '7,4', '%', 'briefcase', -1.2),
      kpi(3, 'Quality of Hire', 'Kandidat lolos masa percobaan', '84', '%', 'user-check', 3.4),
      kpi(3, 'Retention', 'Pegawai bertahan 12 bulan', '93', '%', 'shield-check', 1.6),
      // Rata-rata tertimbang jumlah hired (5, 5, 3, 2, 1) = 41,8 hari, dibulatkan 42 (KPI).
      k.grafik('scatter', 'titik-bersumbu', 'Time to Fill per Jabatan', 'Rata-rata hari sampai terisi, 2026', 6, 4,
        ['Staf administrasi', 'Teknisi', 'Analis keuangan', 'Supervisor', 'Manajer'],
        [{ name: 'Time to fill', data: [28, 48, 38, 52, 70] }], 'hari'),
      // Succession: 6 dari 10 posisi kunci sudah ada calon; retensi sama dengan KPI.
      k.kartu('kpi', 'progres-target', 'Kesiapan Suksesi Posisi Kunci', '6 dari 10 posisi kunci sudah ada calon', 6, 4, {
        ikon: 'users',
        kpi: {
          value: '60',
          unit: '%',
          targets: [
            { label: 'Posisi kunci bercalon', persen: 60, status: 'perhatian' },
            { label: 'Calon siap kurang dari 1 tahun', persen: 40, status: 'perhatian' },
            { label: 'Calon punya rencana pengembangan', persen: 83, status: 'mendekati' },
            { label: 'Retensi talenta inti', persen: 93, status: 'sesuai' },
          ],
        },
      }),
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
      // Baris bawah: tiga jenis chart yang belum dipakai di deck.
      // Benefit sama dengan kolom Realisasi tabel (tunjangan, BPJS, overtime).
      k.grafik('bar', 'bar-tegak', 'Realisasi Benefit per Komponen', 'Juta rupiah, tahun berjalan', 4, 4,
        ['Tunjangan', 'BPJS', 'Overtime'],
        [{ name: 'Realisasi', data: [2340, 1180, 620] }], 'juta Rp'),
      // Kotak sebaran digambar dari sampel mentah (`boxRaw`), satu larik per golongan.
      (() => {
        const kartu = k.grafik('boxplot', 'kotak-sebaran', 'Sebaran Gaji per Golongan', 'Gaji pokok per bulan, juta rupiah', 5, 4,
          ['Gol I', 'Gol II', 'Gol III', 'Gol IV'], [{ name: 'Median', data: [3.3, 3.9, 5.0, 8.0] }], 'juta Rp');
        return {
          ...kartu,
          chart: {
            ...kartu.chart!,
            boxRaw: [
              [3.0, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6],
              [3.5, 3.7, 3.8, 3.9, 4.0, 4.1, 4.3],
              [4.4, 4.7, 5.0, 5.0, 5.3, 5.6, 6.0],
              [6.5, 7.2, 8.0, 8.8, 9.5],
            ],
          },
        };
      })(),
      k.grafik('gauge', 'gauge-target', 'Akurasi Payroll', 'Slip gaji tanpa koreksi, persen', 3, 4,
        ['Akurasi'], [{ name: 'Akurasi', data: [99.2] }], '%'),
    ],
  },

  // 8 -----------------------------------------------------------------------
  {
    judul: 'Kinerja & Pengembangan',
    sub: 'Penilaian kinerja, pelatihan, dan kaderisasi',
    kartu: [
      // 6 KPI dirapatkan satu baris, lalu dua baris chart. Gantt dan corong
      // belum dipakai di deck. Combo dan donat dipakai ulang, tapi tidak ada
      // di halaman tetangga (7 dan 9).
      kpi(2, 'KPI Karyawan', 'Pegawai mencapai target kinerja', '88', '%', 'target', 2.4),
      kpi(2, 'Performance Review', 'Penilaian selesai tepat waktu', '96', '%', 'clipboard', 4.1),
      kpi(2, 'Jam Pelatihan', 'Rata-rata per pegawai per tahun', 24, 'jam', 'clock', 12),
      kpi(2, 'Sertifikasi', 'Pegawai bersertifikat kompetensi', 74, 'orang', 'shield-check', 9),
      kpi(2, 'Career Development', 'Pegawai ikut jalur pengembangan', '58', '%', 'trending-up', 6.5),
      kpi(2, 'Leadership Development', 'Peserta program kepemimpinan', 36, 'orang', 'users', 5),
      // Jadwal digambar dari `gantt.tasks` (tanggal ISO, progres 0-100).
      (() => {
        const kartu = k.grafik('gantt', 'jadwal-gantt', 'Jadwal Program Pengembangan 2026', 'Progres per program, persen', 7, 4,
          ['Performance review', 'Pelatihan teknis', 'Sertifikasi kompetensi', 'Leadership program', 'Asesmen talenta'],
          [{ name: 'Progres', data: [96, 75, 70, 55, 30] }], '%');
        return {
          ...kartu,
          gantt: {
            tasks: [
              { name: 'Performance review', start: '2026-01-05', end: '2026-02-27', progress: 96 },
              { name: 'Pelatihan teknis', start: '2026-02-02', end: '2026-11-27', progress: 75 },
              { name: 'Sertifikasi kompetensi', start: '2026-03-02', end: '2026-10-30', progress: 70 },
              { name: 'Leadership program', start: '2026-04-06', end: '2026-12-11', progress: 55 },
              { name: 'Asesmen talenta', start: '2026-09-07', end: '2026-12-18', progress: 30 },
            ],
          },
        };
      })(),
      // Peserta program 36 (KPI Leadership), siap menjabat 6 (sama dengan
      // suksesi halaman 6: 6 dari 10 posisi kunci sudah ada calon).
      k.grafik('funnel', 'corong-pipeline', 'Pipeline Kaderisasi Pemimpin', 'Orang, siklus 2026', 5, 4,
        ['Dinominasikan', 'Lolos asesmen', 'Ikut program', 'Lulus program', 'Siap menjabat'],
        [{ name: 'Kandidat', data: [90, 62, 36, 22, 6] }], 'orang'),
      // Per triwulan menjumlah ke KPI: jam 5 + 6 + 7 + 6 = 24, sertifikasi kumulatif 74.
      k.grafik('combo', 'combo-batang-garis', 'Pelatihan & Sertifikasi per Triwulan', 'Jam per pegawai dan pegawai bersertifikat', 6, 4,
        ['TW I', 'TW II', 'TW III', 'TW IV'], [
          { name: 'Jam pelatihan', data: [5, 6, 7, 6] },
          { name: 'Bersertifikat (kumulatif)', data: [52, 60, 68, 74], kind: 'line' },
        ], ''),
      // Istimewa + Baik + Cukup = 88% (KPI Karyawan mencapai target).
      k.grafik('donut', 'donat-tebal', 'Sebaran Nilai Kinerja', 'Persen pegawai, penilaian 2026', 6, 4,
        ['Istimewa', 'Baik', 'Cukup', 'Perlu perbaikan', 'Kurang'],
        [{ name: 'Porsi', data: [12, 46, 30, 10, 2] }], '%'),
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
      // Satu chart di bawah tiap kartu poin, temanya sejalan per kolom. Jenisnya
      // tidak ada di halaman tetangga (8: gantt, corong, combo, donat; 10: tabel).
      k.grafik('bar', 'bar-tumpuk', 'Tindak Lanjut Temuan Audit', 'Jumlah temuan per triwulan, 2026', 4, 4,
        ['TW I', 'TW II', 'TW III', 'TW IV'], [
          { name: 'Selesai', data: [6, 5, 7, 4] },
          { name: 'Dalam proses', data: [2, 3, 2, 3] },
          { name: 'Terbuka', data: [1, 1, 0, 2] },
        ], 'temuan'),
      // Aspek sama dengan butir kartu HR Compliance di atasnya.
      k.grafik('radar', 'radar-aspek', 'Skor Kepatuhan SDM', 'Hasil pemeriksaan internal, skala 1-5', 4, 4,
        ['Administrasi', 'Kebijakan', 'Payroll', 'SOP', 'Pelaporan BPJS'], [
          { name: 'Skor 2026', data: [4.3, 3.8, 4.7, 3.9, 4.5] },
        ], 'skor'),
      // Peta risiko: X kemungkinan, Y dampak (1-5), ukuran = eksposur.
      // Piutang 800 juta = umur piutang > 90 hari di halaman 3 (0,8 miliar).
      k.grafik('bubble', 'scatter-gelembung', 'Peta Risiko Keuangan & SDM', 'Kemungkinan x dampak, ukuran = eksposur', 4, 4,
        ['Piutang macet', 'Cost overrun perjalanan', 'Kebocoran data pegawai', 'Turnover talenta inti', 'Kesalahan payroll'], [
          { name: 'Kemungkinan (1-5)', data: [3, 4, 2, 3, 1] },
          { name: 'Dampak (1-5)', data: [4, 3, 5, 3, 4] },
          { name: 'Eksposur (juta Rp)', data: [800, 320, 400, 250, 120] },
        ], ''),
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
      // Baris bawah. Tetangga: halaman 9 (bar tumpuk, radar, gelembung) dan
      // 11 (kartu poin), jadi tidak ada jenis yang bersebelahan sama.
      // Papan isu: isu High = Critical, Medium = Perlu perhatian, plus dua isu
      // yang sudah terkendali.
      k.tabel('papan-isu', 'Status Isu', 'Dikelompokkan menurut prioritas', 5, 4, ['Isu', 'Area', 'Prioritas'], [
        ['Cost overrun perjalanan dinas', 'Keuangan', 'Critical'],
        ['Piutang di atas 90 hari', 'Keuangan', 'Critical'],
        ['Kepatuhan administrasi', 'General Support', 'Critical'],
        ['Vacancy jabatan teknis', 'SDM', 'Perlu perhatian'],
        ['Akurasi data payroll', 'SDM', 'Perlu perhatian'],
        ['Rekonsiliasi bank bulanan', 'Keuangan', 'Terkendali'],
        ['Pelaporan BPJS', 'SDM', 'Terkendali'],
      ]),
      k.grafik('hbar', 'daftar-progres', 'Progres Tindak Lanjut', 'Persen action selesai per isu', 4, 4,
        ['Cost overrun', 'Piutang > 90 hari', 'Vacancy teknis', 'Akurasi payroll', 'Kepatuhan administrasi'],
        [{ name: 'Progres', data: [65, 40, 55, 80, 50] }], '%'),
      // Berakhir di 5 = jumlah isu terbuka di Issue Board.
      k.grafik('line', 'garis-tren', 'Isu Terbuka per Bulan', 'Jumlah isu, Jul-Des 2026', 3, 4,
        ['Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
        [{ name: 'Isu terbuka', data: [9, 8, 8, 7, 6, 5] }], 'isu'),
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
      // Satu chart di bawah tiap program. Tetangga halaman 10 (tabel, papan isu,
      // daftar progres, garis tren) dan 12 (KPI) tidak memakai jenis ini.
      // Air terjun: awal = arus kas bersih 2026 (halaman 3, 6,4 miliar),
      // 6,4 + 1,2 + 1,6 - 0,8 = 8,4.
      k.grafik('waterfall', 'air-terjun', 'Dampak Program ke Arus Kas 2027', 'Miliar rupiah', 6, 4,
        ['Arus kas 2026', 'Efisiensi biaya', 'Collection piutang', 'Investasi digital HR', 'Target 2027'],
        [{ name: 'Arus kas', data: [6.4, 1.2, 1.6, -0.8, 8.4] }], 'miliar Rp'),
      // Capaian 2026 dari halaman lain: formasi 320/358 = 89,4%, review 96%,
      // suksesi 6 dari 10, pegawai capai target 88%.
      k.grafik('hbar', 'bar-mendatar-target', 'Sasaran Program SDM 2027', 'Capaian 2026 terhadap target 2027, persen', 6, 4,
        ['Pemenuhan formasi', 'Proses HR digital', 'Review tepat waktu', 'Posisi kunci bercalon', 'Pegawai capai target'], [
          { name: 'Capaian 2026', data: [89.4, 35, 96, 60, 88] },
          { name: 'Target 2027', data: [95, 70, 100, 80, 90] },
        ], '%'),
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
      // Baris bawah. Tetangga halaman 11 (air terjun, bar target) dan 13
      // (narasi, KPI) tidak memakai jenis ini.
      // Capaian = posisi 2026 terhadap target 2027. Untuk sasaran "≤" dibalik:
      // DSO 40/47 = 85,1, turnover 5/6,8 = 73,5, time to fill 35/42 = 83,3.
      k.grafik('hbar', 'bar-mendatar-peringkat', 'Jarak ke Target 2027', 'Posisi 2026 sebagai persen target', 5, 4,
        ['Akurasi Anggaran', 'Margin EBITDA', 'Produktivitas SDM', 'Training Completion', 'Collection / DSO', 'Time to Fill', 'Turnover', 'Pertumbuhan Pendapatan'],
        [{ name: 'Capaian', data: [98.4, 97.3, 92.1, 86.7, 85.1, 83.3, 73.5, 61.0] }], '%'),
      // 2026 menjumlah 48,6 (pendapatan halaman 1), target 2027 = 53,5 (naik 10%).
      k.grafik('area', 'area-banding', 'Pendapatan per Triwulan', 'Miliar rupiah, 2026 vs target 2027', 4, 4,
        ['TW I', 'TW II', 'TW III', 'TW IV'], [
          { name: 'Target 2027', data: [12.5, 13.2, 13.6, 14.2] },
          { name: 'Realisasi 2026', data: [11.4, 12.0, 12.3, 12.9] },
        ], 'miliar Rp'),
      k.grafik('gauge', 'gauge-target', 'Training Completion', 'Posisi 2026, target 2027 90%', 3, 4,
        ['Selesai'], [{ name: 'Selesai', data: [78] }], '%'),
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
      // Satu chart di bawah tiap pilar. Tetangga halaman 12 (peringkat, area
      // banding, gauge target) dan 14 (kartu poin) tidak memakai jenis ini.
      k.grafik('gauge', 'gauge-kesehatan', 'Skor Kesehatan Keuangan', 'Penilaian internal 2026, skala 1-5', 4, 4,
        ['Kesehatan'], [{ name: 'Skor', data: [4.2] }], 'skor'),
      // Unit sama dengan halaman 5 (total 320 pegawai), sudut pandang porsi.
      k.grafik('treemap', 'treemap-porsi', 'Komposisi Pegawai per Unit', 'Orang, Desember 2026', 4, 4,
        ['Operasional', 'Pemasaran', 'Keuangan', 'Umum', 'SDM'],
        [{ name: 'Pegawai', data: [142, 52, 46, 42, 38] }], 'orang'),
      // Kegiatan selesai 18 + 26 + 22 = 66 dari 75 = 88% (KPI Operasional Efisien).
      k.grafik('bar', 'bar-tumpuk', 'Status Kegiatan Program Kerja', 'Jumlah kegiatan per bidang, 2026', 4, 4,
        ['Keuangan', 'SDM', 'General Support'], [
          { name: 'Selesai', data: [18, 26, 22] },
          { name: 'Berjalan', data: [2, 3, 2] },
          { name: 'Tertunda', data: [1, 1, 0] },
        ], 'kegiatan'),
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
