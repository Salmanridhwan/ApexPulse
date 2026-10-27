import test from 'node:test';
import assert from 'node:assert/strict';
import { turunkanTipeAman } from '../src/services/rag/http';

/**
 * Keluhan produksi: dashboard dari template penuh "Belum ada di dokumen".
 *
 * Sebagian kartu sebenarnya berisi angka nyata, tetapi bentuk tampilannya
 * (donut, heatmap, waterfall, gauge) tidak cocok dengan bentuk data dokumen —
 * mis. donut untuk dua seri. Dulu kartu dibiarkan kosong; sekarang diturunkan
 * ke bentuk terdekat supaya angkanya tetap terlihat.
 */

const duaSeri = {
  id: 'w1',
  type: 'donut',
  title: 'Komposisi Pelanggan per Golongan Tarif',
  confidence: 'sumber' as const,
  grid: { x: 0, y: 0, w: 6, h: 4 },
  chart: {
    xAxis: ['Rumah Tangga', 'Niaga', 'Industri'],
    series: [
      { name: '2023', data: [700, 200, 100] },
      { name: '2024', data: [720, 210, 110] },
    ],
  },
};

const satuAngka = {
  id: 'w2',
  type: 'gauge',
  title: 'Capaian Target Pendapatan',
  confidence: 'sumber' as const,
  grid: { x: 0, y: 0, w: 4, h: 3 },
  kpi: { value: '104,2', unit: '%' },
};

test('donut dengan dua seri diturunkan ke batang, bukan dikosongkan', () => {
  const hasil = turunkanTipeAman(duaSeri, 'donut');
  assert.ok(hasil, 'harus ada bentuk pengganti');
  assert.equal(hasil.type, 'bar');
  assert.deepEqual(hasil.chart.xAxis, duaSeri.chart.xAxis, 'kategori tidak berubah');
  assert.equal(hasil.chart.series.length, 2, 'kedua seri tetap ada');
});

test('gauge tanpa seri diturunkan ke kartu angka', () => {
  const hasil = turunkanTipeAman(satuAngka, 'gauge');
  assert.ok(hasil, 'kartu angka adalah bentuk sah untuk satu nilai');
  assert.equal(hasil.type, 'kpi');
  assert.equal(hasil.kpi.value, '104,2');
});

test('data grafik tanpa blok waterfall diturunkan ke batang/garis/tabel', () => {
  const hasil = turunkanTipeAman(duaSeri, 'waterfall');
  assert.ok(hasil);
  assert.ok(['bar', 'line', 'table'].includes(hasil.type), `tipe turunan: ${hasil.type}`);
});

test('tanpa data sama sekali tetap kosong (tidak mengarang)', () => {
  const kosong = { id: 'w3', type: 'pie', title: 'Komposisi Biaya', confidence: 'sumber' as const, grid: { x: 0, y: 0, w: 4, h: 3 } };
  assert.equal(turunkanTipeAman(kosong, 'pie'), null);
});
