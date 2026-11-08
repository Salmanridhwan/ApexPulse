/**
 * TIGA WAJAH CHART BARU: peta wilayah, jadwal (gantt), kotak sebaran.
 *
 * Aturan yang dijaga:
 *  - ketiganya benar-benar terdaftar di Template Chart (`DAFTAR_CHART`);
 *  - punya wajah untuk SEMUA gaya (12 varian), bukan cuma default;
 *  - `buildOpsi` menghasilkan bentuk grafik yang sesuai (map / custom / boxplot)
 *    dengan data yang benar-benar dipakai;
 *  - semua tipe widget kini punya padanan katalog, jadi tidak ada lagi chart
 *    yang dibuat di luar Template Chart.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { CHART_DEFAULT, DAFTAR_CHART, buildOpsi, varianTersedia } from '../src/services/chart/chartDefault';
import { VARIAN } from '../src/services/chart/gayaVarian';
import { contohData } from '../src/services/chart/contohData';
import { PETA_TIPE, chartIdDariTipe } from '../src/services/chart/petaTipe';
import { NAMA_PETA } from '../src/services/chart/pembangunTambahan';

const BARU = ['peta-wilayah', 'jadwal-gantt', 'kotak-sebaran'] as const;

test('tiga wajah baru terdaftar di Template Chart', () => {
  for (const id of BARU) {
    assert.ok(DAFTAR_CHART.includes(id), `${id} harus ada di DAFTAR_CHART`);
    const entri = CHART_DEFAULT[id];
    assert.ok(entri.nama.length > 0 && entri.guna.length > 0 && entri.butuh.length > 0);
    assert.equal(entri.mesin, 'echarts');
  }
  assert.equal(DAFTAR_CHART.length, 39, 'katalog 36 + 3 wajah baru');
});

test('setiap wajah baru punya semua gaya', () => {
  for (const id of BARU) {
    const tersedia = varianTersedia(id);
    for (const v of VARIAN) {
      assert.ok(tersedia.includes(v), `${id} belum punya gaya ${v}`);
    }
  }
});

test('peta wilayah menggambar seri map dengan nilai per wilayah', () => {
  const d = contohData('peta-wilayah');
  const { opsi } = buildOpsi('peta-wilayah', d, 'default');
  const o = opsi as any;
  assert.equal(o.series[0].type, 'map');
  assert.equal(o.series[0].map, NAMA_PETA);
  assert.equal(o.series[0].data.length, d.peta?.length);
  assert.equal(o.series[0].data[0].name, 'DKI Jakarta');
  assert.equal(o.series[0].data[0].value, 208360);
  assert.ok(o.visualMap.inRange.color.length >= 2);
});

test('jadwal gantt memakai sumbu waktu dan progres', () => {
  const d = contohData('jadwal-gantt');
  const { opsi } = buildOpsi('jadwal-gantt', d, 'default');
  const o = opsi as any;
  assert.equal(o.xAxis.type, 'time');
  assert.equal(o.yAxis.type, 'category');
  // Dua seri: rencana (seluruh rentang) + progres (bagian selesai), supaya
  // legenda jujur dan bagian pekat bisa diberi label persen.
  assert.equal(o.series.length, 2);
  assert.deepEqual(o.series.map((s: any) => s.name), ['Rencana', 'Progres']);
  assert.deepEqual(o.legend.data, ['Rencana', 'Progres']);
  for (const s of o.series) {
    assert.equal(s.type, 'custom');
    assert.equal(typeof s.renderItem, 'function');
    assert.equal(s.data.length, d.jadwal?.length);
  }
  // [indeks, mulai, selesai, progres]
  const rencana = o.series[0].data[0].value;
  const progres = o.series[1].data[0].value;
  assert.equal(rencana.length, 4);
  assert.ok(rencana[2] > rencana[1], 'selesai harus setelah mulai');
  assert.equal(progres[3], 100);
  assert.ok(progres[2] <= rencana[2], 'progres tidak boleh melewati rencana');
});

test('kotak sebaran menggambar lima angka kuartil', () => {
  const d = contohData('kotak-sebaran');
  const { opsi } = buildOpsi('kotak-sebaran', d, 'default');
  const o = opsi as any;
  assert.equal(o.series[0].type, 'boxplot');
  assert.equal(o.series[0].data.length, d.kotak?.length);
  for (const baris of o.series[0].data) {
    assert.equal(baris.length, 5);
    assert.ok(baris[0] <= baris[1] && baris[1] <= baris[2] && baris[2] <= baris[3] && baris[3] <= baris[4]);
  }
});

test('setiap gaya menghasilkan opsi yang sah (tidak kosong)', () => {
  for (const id of BARU) {
    for (const v of VARIAN) {
      const { opsi } = buildOpsi(id, contohData(id), v);
      assert.ok(opsi, `${id} · ${v} tidak menghasilkan opsi`);
      assert.ok((opsi as any).series?.length > 0, `${id} · ${v} tanpa series`);
    }
  }
});

test('semua tipe widget kini punya padanan katalog', () => {
  // Tiga tipe yang dulu null sekarang punya wajah.
  assert.equal(chartIdDariTipe('map'), 'peta-wilayah');
  assert.equal(chartIdDariTipe('gantt'), 'jadwal-gantt');
  assert.equal(chartIdDariTipe('boxplot'), 'kotak-sebaran');
  // Tidak ada lagi tipe yang dibiarkan null di peta.
  for (const [tipe, id] of Object.entries(PETA_TIPE)) {
    assert.ok(id && DAFTAR_CHART.includes(id), `peta tipe ${tipe} menunjuk chart yang tidak ada`);
  }
  // Tipe yang dikenal katalog harus lengkap: 28 tipe, 28 padanan.
  assert.equal(Object.keys(PETA_TIPE).length, 28);
});
