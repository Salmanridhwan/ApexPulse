import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bacaHalamanDiminta, butirTerwakili, halamanUntukPermintaan, halamanUntukWidget, mintaBanyakHalaman, tipeButir } from '../src/services/builder/halamanDiminta';
import { susunDashboardBerhalaman } from '../src/services/builder/susunHalaman';
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
