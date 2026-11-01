import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CHART_DEFAULT, DAFTAR_CHART, buildOpsi, varianTersedia } from '../src/services/chart/chartDefault';
import { chartIdDariTipe } from '../src/services/chart/petaTipe';
import { SEL_TERISI } from '../src/services/chart/chartTemplate';
import { GAYA, VARIAN } from '../src/services/chart/gayaVarian';
import { statusDefaultChart } from '../src/services/chart/status';
import { ringkasSumbu, type DataChart } from '../src/services/chart/pembangunOpsi';

const dataContoh = (): DataChart => ({
  kategori: ['A', 'B', 'C', 'D'],
  seri: [
    { nama: 'Nilai', data: [12, 30, 21, 45] },
    { nama: 'Target', data: [20, 35, 30, 50] },
  ],
  satuan: 'unit',
  target: 30,
  total: 108,
  maks: 100,
  desimal: 0,
});

test('setiap chart default punya identitas yang cocok dengan kuncinya', () => {
  for (const id of DAFTAR_CHART) {
    assert.equal(CHART_DEFAULT[id].id, id);
    assert.ok(CHART_DEFAULT[id].nama.length > 0);
    assert.ok(['echarts', 'html'].includes(CHART_DEFAULT[id].mesin));
  }
});

test('matriks hanya berisi varian resmi', () => {
  for (const sel of SEL_TERISI) {
    assert.ok(VARIAN.includes(sel.varian), `varian tidak dikenal: ${sel.varian}`);
    assert.ok(DAFTAR_CHART.includes(sel.chartId), `chart tidak dikenal: ${sel.chartId}`);
  }
});

test('setiap sel matriks menghasilkan opsi tanpa galat', () => {
  for (const sel of SEL_TERISI) {
    const hasil = buildOpsi(sel.chartId, dataContoh(), sel.varian, 1);
    assert.equal(hasil.varian, sel.varian, `${sel.chartId}/${sel.varian} jatuh ke varian lain`);
    assert.equal(hasil.cadangan, false);
    assert.ok(hasil.opsi, `${sel.chartId}/${sel.varian} tidak menghasilkan opsi`);
  }
});

test('chart kanvas punya seri, chart html punya mesin html', () => {
  for (const sel of SEL_TERISI) {
    const hasil = buildOpsi(sel.chartId, dataContoh(), sel.varian, 1) as any;
    if (CHART_DEFAULT[sel.chartId].mesin === 'echarts') {
      assert.ok(Array.isArray(hasil.opsi.series), `${sel.chartId}/${sel.varian} tanpa series`);
      assert.ok(hasil.opsi.series.length > 0);
    } else {
      assert.equal(hasil.opsi.mesin, 'html');
      assert.ok(typeof hasil.opsi.jenis === 'string');
    }
  }
});

test('angka yang masuk sama dengan angka yang keluar', () => {
  const d = dataContoh();
  const hasil = buildOpsi('bar-tegak-sorot', d, 'ringkasan', 1) as any;
  const nilai = hasil.opsi.series[0].data.map((x: any) => (typeof x === 'object' ? x.value : x));
  assert.deepEqual(nilai, d.seri[0].data);
});

test('satu chart = empat gaya: setiap chart punya keempat varian', () => {
  for (const id of DAFTAR_CHART) {
    assert.deepEqual(varianTersedia(id), [...VARIAN], `${id} belum lengkap di keempat gaya`);
  }
});

test('jumlah chart sama di keempat gaya', () => {
  const per = VARIAN.map((v) => SEL_TERISI.filter((s) => s.varian === v).length);
  assert.ok(per.every((n) => n === DAFTAR_CHART.length), `jumlah per gaya: ${per.join('/')}`);
});

test('tidak ada chart yang jatuh ke gaya cadangan', () => {
  for (const id of DAFTAR_CHART) {
    for (const v of VARIAN) {
      assert.equal(buildOpsi(id, dataContoh(), v, 1).cadangan, false, `${id}/${v}`);
    }
  }
});

test('wajah khas hanya dipakai bila diminta', () => {
  const biasa = buildOpsi('bar-mendatar-peringkat', dataContoh(), 'trafik', 1) as any;
  const khas = buildOpsi('bar-mendatar-peringkat', dataContoh(), 'trafik', 1, undefined, true) as any;
  assert.notEqual(biasa.opsi.series[0].type, 'pie', 'dashboard biasa tidak boleh memakai wajah persen trafik');
  assert.equal(khas.opsi.series[0].type, 'pie');
});

test('label sumbu angka besar diringkas', () => {
  assert.equal(ringkasSumbu(612400000), '612,4 jt');
  assert.equal(ringkasSumbu(2059000000000), '2,1 T');
  assert.equal(ringkasSumbu(950), '950');
});

test('data kosong tidak membuat pembangun gagal', () => {
  const kosong: DataChart = { kategori: [], seri: [{ nama: 'Nilai', data: [] }] };
  for (const sel of SEL_TERISI) {
    assert.doesNotThrow(() => buildOpsi(sel.chartId, kosong, sel.varian, 1), `${sel.chartId}/${sel.varian}`);
  }
});

test('empat varian resmi selalu bisa diminta tanpa galat', () => {
  for (const id of DAFTAR_CHART) {
    for (const v of VARIAN) {
      assert.doesNotThrow(() => buildOpsi(id, dataContoh(), v, 1), `${id}/${v}`);
    }
  }
});

test('tiap template chart punya nama panggilan', () => {
  for (const v of ['ringkasan', 'analitik', 'trafik'] as const) {
    assert.ok(GAYA[v].nama && GAYA[v].nama.length > 3, `${v} tanpa nama template`);
    assert.ok(GAYA[v].sebutan && GAYA[v].sebutan.length > 3, `${v} tanpa sebutan`);
  }
});

test('katalog default chart berstatus final', () => {
  assert.equal(statusDefaultChart(), 'final');
});


test('tipe widget kanvas memakai wajah katalog bila sudah ada', () => {
  // Dashboard biasa harus memakai desain template chart, bukan penyusun lama.
  assert.equal(chartIdDariTipe('bar'), 'bar-tegak');
  assert.equal(chartIdDariTipe('line'), 'garis-tren');
  assert.equal(chartIdDariTipe('donut'), 'donat-tebal');
  assert.equal(chartIdDariTipe('kpi'), 'kpi-kartu');
  assert.equal(chartIdDariTipe('table'), 'tabel-ringkas');
  // Tipe yang belum punya wajah dibiarkan memakai penyusun lama.
  assert.equal(chartIdDariTipe('radar'), null);
  assert.equal(chartIdDariTipe('sankey'), null);
});

test('batang tegak dan garis tren menggambar semua seri', () => {
  for (const id of ['bar-tegak', 'garis-tren'] as const) {
    const hasil = buildOpsi(id, dataContoh(), 'default', 1) as any;
    assert.equal(hasil.opsi.series.length, 2, `${id} membuang seri kedua`);
  }
});
