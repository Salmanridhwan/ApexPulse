import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bacaHalamanDiminta,
  bersihkanJudulRag,
  butirTerwakili,
  halamanUntukPermintaan,
  halamanUntukWidget,
  judulUntukButir,
  labelPeriodeSumber,
  mintaBanyakHalaman,
  periodeSeragam,
  rapikanJudulButir,
  tipeButir,
  validasiDataButir,
  widgetKembar,
} from '../src/services/builder/halamanDiminta';
import { judulDariIsi, susunDashboardBerhalaman } from '../src/services/builder/susunHalaman';
import type { WidgetSpec } from '../src/types';

const PROMPT =
  'Buatkan dashboard PAM Jaya dengan beberapa halaman. Susun halaman seperti ini: ' +
  '1. Halaman Ringkasan – gambaran umum PAM Jaya: KPI warga terlayani, kapasitas produksi, cakupan layanan, lalu tren kualitas layanan. Tidak menampilkan detail per wilayah. ' +
  '2. Halaman Keuangan – hanya topik uang: pendapatan, beban, laba, arus kas, komposisi beban, dan progres target pendapatan. Semua chart wajib soal keuangan. ' +
  '3. Halaman Operasional dan Produksi – hanya soal air: produksi, air terjual, NRW (kehilangan air), dan tren produksi bulanan per bulan. ' +
  '4. Halaman Wilayah – hanya sebaran per wilayah layanan: jumlah pelanggan per wilayah, dan kontribusi tiap wilayah terhadap total.';

const kpi = (id: string, title: string, value: number): WidgetSpec =>
  ({ id, type: 'kpi', title, confidence: 'sumber', kpi: { value, unit: '' }, citations: [], grid: { x: 0, y: 0, w: 3, h: 2 } }) as any;
const grafik = (id: string, title: string, type: any, data = [1, 2, 3]): WidgetSpec =>
  ({
    id,
    type,
    title,
    confidence: 'sumber',
    chart: { xAxis: ['A', 'B', 'C'], series: [{ name: title, data }] },
    citations: [],
    grid: { x: 0, y: 0, w: 6, h: 4 },
  }) as any;

test('daftar halaman bernomor di kalimat pengguna terbaca beserta butirnya', () => {
  const h = bacaHalamanDiminta(PROMPT);
  assert.deepEqual(h.map((x) => x.judul), ['Ringkasan', 'Keuangan', 'Operasional dan Produksi', 'Wilayah']);
  assert.deepEqual(h[1].butir, ['pendapatan', 'beban', 'laba', 'arus kas', 'komposisi beban', 'progres target pendapatan']);
  assert.equal(h[0].butir[0], 'warga terlayani');
  // Kalimat larangan setelah titik tidak ikut jadi butir.
  assert.ok(!h[0].butir.some((b) => /wilayah/.test(b)));
});

test('kalimat tanpa daftar halaman tidak menghasilkan halaman diminta', () => {
  assert.deepEqual(bacaHalamanDiminta('Buat dashboard keuangan PAM Jaya 2024'), []);
  assert.deepEqual(bacaHalamanDiminta('Laba naik 1. 2 juta'), []);
});

test('bentuk chart mengikuti kalimat butir', () => {
  assert.equal(tipeButir('tren produksi bulanan'), 'line');
  assert.equal(tipeButir('komposisi beban'), 'donut');
  assert.equal(tipeButir('jumlah pelanggan per wilayah'), 'bar');
  assert.equal(tipeButir('progres target pendapatan'), 'bullet-target');
  assert.equal(tipeButir('arus kas'), 'kpi');
});

test('widget masuk halaman yang butirnya cocok', () => {
  const h = bacaHalamanDiminta(PROMPT);
  assert.equal(halamanUntukWidget(kpi('a', 'Pendapatan usaha', 1), h), 1);
  assert.equal(halamanUntukWidget(kpi('b', 'NRW (Non Revenue Water)', 40), h), 2);
  assert.equal(halamanUntukWidget(kpi('c', 'Jumlah karyawan', 900), h), -1);
  assert.ok(butirTerwakili('pendapatan', [kpi('a', 'Pendapatan usaha', 1)]));
  assert.ok(!butirTerwakili('arus kas', [kpi('a', 'Pendapatan usaha', 1)]));
});

test('dashboard memakai halaman yang diminta, bukan Ringkasan (2)', () => {
  const diminta = bacaHalamanDiminta(PROMPT);
  const widgets = [
    kpi('k1', 'NRW (Non Revenue Water)', 43.85),
    kpi('k2', 'Pendapatan usaha', 3184),
    kpi('k3', 'Jumlah pelanggan', 951640),
    grafik('hd-2-1', 'Komposisi beban usaha', 'donut'),
    grafik('hd-2-2', 'Arus kas operasi', 'bar', [5, 6, 7]),
    grafik('hd-3-1', 'Produksi air per bulan', 'line', [9, 8, 7]),
    grafik('hd-4-1', 'Pelanggan per wilayah', 'bar', [3, 2, 1]),
  ];
  const hasil = susunDashboardBerhalaman(widgets, {
    halamanDiminta: diminta,
    halamanWidget: { 'hd-2-1': 1, 'hd-2-2': 1, 'hd-3-1': 2, 'hd-4-1': 3 },
  });
  assert.deepEqual(hasil.halaman.map((h) => h.judul), ['Ringkasan', 'Keuangan', 'Operasional dan Produksi', 'Wilayah']);
  const judul = (i: number) => hasil.halaman[i].widgets.map((w) => w.title);
  assert.ok(judul(1).includes('Pendapatan usaha') && judul(1).includes('Komposisi beban usaha'));
  assert.ok(judul(2).includes('NRW (Non Revenue Water)'));
  // KPI tanpa halaman cocok masuk halaman Ringkasan.
  assert.ok(judul(0).includes('Jumlah pelanggan'));
  assert.deepEqual(hasil.halamanKosong, []);
});

test('halaman yang diminta tanpa data tidak dibuat dan dilaporkan', () => {
  const diminta = bacaHalamanDiminta(PROMPT);
  const hasil = susunDashboardBerhalaman([kpi('k2', 'Pendapatan usaha', 3184), grafik('x', 'Arus kas operasi', 'bar')], {
    halamanDiminta: diminta,
  });
  assert.deepEqual(hasil.halaman.map((h) => h.judul), ['Keuangan']);
  assert.deepEqual(hasil.halamanKosong, ['Ringkasan', 'Operasional dan Produksi', 'Wilayah']);
});

test('KPI tidak mewakili butir grafik dengan topik sama', () => {
  const produksi = kpi('p', 'Produksi air', 500);
  assert.ok(butirTerwakili('produksi', [produksi]));
  assert.ok(!butirTerwakili('tren produksi bulanan per bulan', [produksi]));
  assert.ok(butirTerwakili('tren produksi bulanan per bulan', [grafik('g', 'Produksi air bulanan', 'line')]));
});

const TANPA_DAFTAR =
  'Buatkan dashboard tentang PAM Jaya dengan beberapa halaman sekaligus, jangan satu halaman saja. ' +
  'Setiap halaman harus fokus pada satu segmentasi yang jelas dan semua widget di dalam satu halaman harus satu topik yang sama, jangan campur topik lain.';

test('permintaan banyak halaman tanpa daftar memakai segmentasi bawaan sektor', () => {
  const { halaman, bawaan } = halamanUntukPermintaan(TANPA_DAFTAR, 'pdam');
  assert.equal(bawaan, true);
  assert.deepEqual(halaman.map((h) => h.judul), ['Ringkasan', 'Keuangan', 'Operasional & Produksi', 'Pelayanan Pelanggan', 'Wilayah']);
  // Indikator tidak berulang antarhalaman.
  const semua = halaman.flatMap((h) => h.butir);
  assert.equal(new Set(semua).size, semua.length);
});

test('jumlah halaman yang disebut membatasi segmentasi; daftar tertulis tetap menang', () => {
  assert.equal(mintaBanyakHalaman('buat dashboard 3 halaman'), 3);
  assert.equal(mintaBanyakHalaman('dashboard tiga halaman untuk direksi'), 3);
  assert.equal(halamanUntukPermintaan('buat dashboard 3 halaman', 'bank').halaman.length, 3);
  assert.equal(halamanUntukPermintaan(PROMPT, 'pdam').bawaan, false);
  assert.equal(mintaBanyakHalaman('buat dashboard keuangan PAM Jaya 2024'), false);
  assert.deepEqual(halamanUntukPermintaan('buat dashboard keuangan', 'pdam').halaman, []);
});

test('segmentasi bawaan: KPI hasil ekstraksi masuk halaman topiknya, tidak campur', () => {
  const { halaman } = halamanUntukPermintaan(TANPA_DAFTAR, 'pdam');
  const hasil = susunDashboardBerhalaman(
    [kpi('k1', 'NRW (Non Revenue Water)', 43.85), kpi('k2', 'Pendapatan usaha', 3184), kpi('k3', 'Jumlah pelanggan', 951640)],
    { halamanDiminta: halaman }
  );
  const peta = Object.fromEntries(hasil.halaman.map((h) => [h.judul, h.widgets.map((w) => w.title)]));
  assert.deepEqual(peta, {
    Ringkasan: ['Jumlah pelanggan'],
    Keuangan: ['Pendapatan usaha'],
    'Operasional & Produksi': ['NRW (Non Revenue Water)'],
  });
  assert.deepEqual(hasil.halamanKosong, ['Pelayanan Pelanggan', 'Wilayah']);
});

test('bug: NRW dengan nama lain dikenali sebagai kartu yang sama', () => {
  const ada = [kpi('a', 'Tingkat Kehilangan Air (NRW)', 43.85)];
  assert.ok(butirTerwakili('NRW (kehilangan air)', ada));
  assert.ok(butirTerwakili('NRW (kehilangan air)', [kpi('b', 'NRW (Non Revenue Water)', 41.2)]));
});

test('bug: sinonim pelanggan dikenali (warga terlayani = jumlah pelanggan)', () => {
  assert.ok(butirTerwakili('warga terlayani', [kpi('a', 'Jumlah Pelanggan', 951640)]));
  assert.ok(widgetKembar(kpi('x', 'Warga terlayani', 936480), [kpi('a', 'Jumlah Pelanggan', 951640)]));
  assert.ok(widgetKembar(kpi('x', 'Keluhan pelanggan', 120), [kpi('a', 'Jumlah pengaduan pelanggan', 118)]));
  assert.ok(!widgetKembar(kpi('x', 'Pendapatan usaha', 1), [kpi('a', 'Laba bersih', 2)]));
});

test('bug: judul balikan RAG dibersihkan dari "— dasar: …" dan kurung terpotong', () => {
  assert.equal(bersihkanJudulRag('Warga terlayani (Ringkasan) — dasar: laporan tahunan 2024', 'Ringkasan'), 'Warga terlayani');
  assert.equal(bersihkanJudulRag('Keluhan (jumlah pengaduan, dasar: status pengaduan'), 'Keluhan');
  assert.equal(bersihkanJudulRag('Status Pengaduan Oktober — dasar: tabel status pengaduan'), 'Status Pengaduan Oktober');
  assert.equal(bersihkanJudulRag('Tingkat Kehilangan Air (NRW)'), 'Tingkat Kehilangan Air (NRW)');
});

test('bug: judul kartu dari butir; data tetangga dibuang', () => {
  const kartu = (title: string, type = 'kpi') => (type === 'kpi' ? kpi('r', title, 1) : grafik('r', title, type));
  assert.equal(judulUntukButir('arus kas', kartu('Arus kas operasi — dasar: laporan arus kas')), 'Arus kas');
  // Diminta tren kualitas layanan, RAG memberi air terjual bulanan: dibuang.
  assert.equal(judulUntukButir('tren kualitas layanan', kartu('Air terjual bulanan — dasar: laporan produksi', 'line')), null);
  // Diminta tren, RAG hanya punya satu angka: judul mengikuti isi, bukan "Tren …".
  assert.equal(judulUntukButir('tren pengaduan per kategori', kartu('Jumlah pengaduan 2024 — dasar: tabel')), 'Jumlah pengaduan 2024');
});

// ===== Laporan uji 5 skenario: angka tetangga, judul, KPI nyasar =====

const kpiSumber = (title: string, value: number, unit: string, snippet: string): WidgetSpec =>
  ({ ...kpi('s', title, value), kpi: { value, unit }, citations: [{ id: 'c', docName: 'd.md', page: 1, chunkSnippet: snippet, confidenceScore: 1, date: '' }] }) as any;

test('P0-1: angka tetangga ditolak lewat satuan dan sumber', () => {
  // Beban pegawai (Rp) bukan jumlah pegawai.
  assert.equal(validasiDataButir('jumlah pegawai', kpiSumber('Jumlah pegawai', 386.2, 'Rp miliar', 'Rincian beban: Pegawai | 386,2')).ok, false);
  // Beban lain-lain bukan program CSR.
  assert.equal(validasiDataButir('program CSR', kpiSumber('Program CSR', 52.4, 'Rp miliar', 'Rincian Beban usaha Lain-lain 52,4')).ok, false);
  // Jumlah sambungan bukan cakupan pelayanan (%).
  assert.equal(validasiDataButir('cakupan pelayanan', kpiSumber('Cakupan pelayanan', 936480, 'unit', 'Pelanggan aktif 936.480 sambungan')).ok, false);
  // Penerimaan bulanan bukan progres target.
  assert.equal(validasiDataButir('progres target pendapatan', kpiSumber('Progres', 162.9, 'Rp miliar', 'Penerimaan Oktober Rp 162,9 miliar')).ok, false);
  // Grafik air terjual (juta m³) bukan pelatihan pegawai.
  const air = { ...grafik('g', 'Tren pelatihan pegawai', 'line'), chart: { xAxis: ['Jan', 'Feb', 'Mar'], unit: 'juta m³', series: [{ name: 'Air terjual', data: [1, 2, 3] }] } } as any;
  assert.equal(validasiDataButir('tren pelatihan pegawai', air).ok, false);
  // Data yang benar tetap lolos.
  assert.equal(validasiDataButir('jumlah pegawai', kpiSumber('Jumlah pegawai', 1820, 'orang', 'Jumlah pegawai tetap per Oktober 2026: 1.820 orang')).ok, true);
  assert.equal(validasiDataButir('NRW (kehilangan air)', kpiSumber('NRW', 43.85, '%', 'Tingkat kehilangan air (NRW) 43,85%')).ok, true);
  assert.equal(
    validasiDataButir('progres target pendapatan', kpiSumber('Progres', 85, '%', 'Realisasi pendapatan Rp1.244,7 M atau 85% dari RKAP')).ok,
    true
  );
});

test('P2-7: judul butir dirapikan', () => {
  assert.equal(rapikanJudulButir('tren produksi bulanan per bulan'), 'Tren produksi bulanan');
  assert.equal(rapikanJudulButir('arus kas'), 'Arus kas');
});

test('P2-6: judul dashboard tanpa "& Lainnya"', () => {
  assert.equal(judulDariIsi([{ judul: 'Kepegawaian' }, { judul: 'Keuangan' }, { judul: 'CSR' }]), 'Kinerja Kepegawaian, Keuangan & CSR');
  assert.equal(judulDariIsi([{ judul: 'Keuangan' }]), 'Kinerja Keuangan');
  assert.ok(!/Lainnya/.test(judulDariIsi([{ judul: 'A' }, { judul: 'B' }, { judul: 'C' }, { judul: 'D' }])));
});

test('P2-9: KPI tanpa halaman cocok tidak dibuang ke Ringkasan', () => {
  const diminta = bacaHalamanDiminta(PROMPT);
  const hasil = susunDashboardBerhalaman([kpi('k', 'Target Kegiatan Setahun 2026', 40), kpi('p', 'Pendapatan usaha', 3184)], {
    halamanDiminta: diminta,
  });
  const semua = hasil.halaman.flatMap((h) => h.widgets.map((w) => w.title));
  assert.deepEqual(semua, ['Pendapatan usaha']);
});

test('P2-8: kartu bertopik halaman lain dipindah ke halaman itu', () => {
  const diminta = [
    { judul: 'Ringkasan', butir: ['status sistem utama', 'jumlah pelanggan'] },
    { judul: 'Kualitas dan Keluhan', butir: ['jumlah pengaduan', 'tren pengaduan per kategori'] },
  ];
  const tabel = { ...grafik('t', 'Status Pengaduan Oktober 2026', 'table'), type: 'table' } as any;
  const hasil = susunDashboardBerhalaman([kpi('p', 'Jumlah pelanggan', 1), tabel], { halamanDiminta: diminta, halamanWidget: { t: 0 } });
  const peta = Object.fromEntries(hasil.halaman.map((h) => [h.judul, h.widgets.map((w) => w.title)]));
  assert.deepEqual(peta['Ringkasan'], ['Jumlah pelanggan']);
  assert.ok(peta['Kualitas dan Keluhan'].includes('Status Pengaduan Oktober 2026'));
});

test('P1-5: kartu diberi label periode + sumber', () => {
  const w = kpiSumber('Pendapatan usaha Okt 2026', 1244.7, 'Rp miliar', 'Pendapatan usaha s.d. Oktober 2026');
  assert.equal(labelPeriodeSumber({ ...w, citations: [{ ...w.citations[0], docName: 'kpi-okt-2026.md' }] } as any), 'Okt 2026 · kpi-okt-2026.md');
});

// ===== Uji ulang T3/T4: penolakan berlebihan, label periode =====

test('P0-A: sinonim istilah dokumen menyelamatkan butir yang benar', () => {
  assert.equal(validasiDataButir('komposisi beban', kpiSumber('Rincian beban', 1, 'Rp miliar', 'Rincian Beban usaha 2024: pegawai, kimia, listrik')).ok, true);
  assert.equal(validasiDataButir('waktu penyelesaian', kpiSumber('Tepat waktu', 92, '%', 'Pengaduan selesai tepat waktu 92%')).ok, true);
  const jenis = { ...grafik('g', 'Keluhan per jenis', 'bar'), citations: [{ id: 'c', docName: 'd', page: 1, chunkSnippet: 'Jenis keluhan: air keruh, air mati, tagihan', confidenceScore: 1, date: '' }] } as any;
  assert.equal(validasiDataButir('tren keluhan per kategori', jenis).ok, true);
  assert.equal(validasiDataButir('kepatuhan mutu air', kpiSumber('Kualitas air', 98, '%', 'Kualitas Air memenuhi baku mutu 98%')).ok, true);
  // Penolakan yang benar tetap.
  assert.equal(validasiDataButir('jumlah pegawai', kpiSumber('Jumlah pegawai', 386.2, 'Rp miliar', 'Rincian beban: Pegawai | 386,2')).ok, false);
});

test('P2-D: periode ditulis seragam', () => {
  assert.equal(periodeSeragam('Air terdistribusi Januari–Desember 2024 (total tahunan)'), '2024');
  assert.equal(periodeSeragam('Pendapatan s.d. Oktober 2026'), 's.d. Okt 2026');
  assert.equal(periodeSeragam('Penerimaan Oktober 2026'), 'Okt 2026');
  assert.equal(periodeSeragam('Laporan Tahunan 2024'), '2024');
  assert.equal(periodeSeragam('tanpa periode'), undefined);
});

test('grafik sapuan tanpa butir cocok masuk halaman topiknya, KPI nyasar tetap dibuang', () => {
  const diminta = [
    { judul: 'Ringkasan', butir: ['jumlah pelanggan'] },
    { judul: 'Keuangan', butir: ['pendapatan usaha'] },
    { judul: 'Operasional & Produksi', butir: ['volume produksi air'] },
  ];
  const hasil = susunDashboardBerhalaman(
    [
      kpi('k1', 'Jumlah pelanggan', 951640),
      kpi('k2', 'Pendapatan usaha', 3184),
      grafik('g1', 'Tren beban operasional per bulan', 'line', [5, 7, 9]),
      grafik('g2', 'Debit air distribusi per instalasi', 'bar', [40, 25, 35]),
      kpi('k3', 'Target kegiatan setahun', 18000),
    ],
    { halamanDiminta: diminta, chartTemplate: false }
  );
  const di = (judul: string) => hasil.halaman.find((h) => h.judul === judul)?.widgets.map((w) => w.title) ?? [];
  assert.ok(di('Keuangan').includes('Tren beban operasional per bulan'));
  assert.ok(di('Operasional & Produksi').includes('Debit air distribusi per instalasi'));
  assert.ok(hasil.halaman.flatMap((h) => h.widgets).every((w) => w.title !== 'Target kegiatan setahun'));
});

test('segmen bawaan PDAM: tiap halaman punya minimal dua butir grafik', () => {
  for (const h of halamanUntukPermintaan('dashboard PAM Jaya beberapa halaman', 'pdam').halaman) {
    const grafikButir = h.butir.filter((b) => !['kpi', 'bullet-target'].includes(tipeButir(b)));
    assert.ok(grafikButir.length >= 2, `${h.judul}: ${grafikButir.join(', ')}`);
  }
});
