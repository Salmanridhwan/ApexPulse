import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DASHBOARD_TEMPLATES } from '../src/services/templates/dashboardTemplates';
import { GAYA, VARIAN } from '../src/services/chart/gayaVarian';
import { buildOpsi, DAFTAR_CHART } from '../src/services/chart/chartDefault';
import { contohData } from '../src/services/chart/contohData';

test('template ke-4 Kaca terdaftar dengan tema sendiri', () => {
  // Kaca tetap template ke-4; gaya Template Chart lainnya menyusul sesudahnya.
  assert.equal(DASHBOARD_TEMPLATES[3].id, 'tpl-kaca');
  const kaca = DASHBOARD_TEMPLATES.find((t) => t.id === 'tpl-kaca');
  assert.ok(kaca, 'tpl-kaca tidak ada');
  assert.equal(kaca.tema, 'kaca');
  assert.ok(kaca.widgets.length > 0);
  // Id widget tidak boleh kembar dengan template Pijar yang menjadi sumber slotnya.
  const pijar = new Set(DASHBOARD_TEMPLATES[0].widgets.map((w) => w.id));
  assert.ok(kaca.widgets.every((w) => !pijar.has(w.id)));
});

test('gaya kaca ada di katalog dan semua chart bisa digambar', () => {
  assert.ok(VARIAN.includes('kaca'));
  assert.ok(GAYA.kaca.kaca && GAYA.kaca.latarCss);
  for (const id of DAFTAR_CHART) {
    const hasil = buildOpsi(id, contohData(id), 'kaca');
    assert.equal(hasil.varian, 'kaca', `${id} jatuh ke varian lain`);
    assert.equal(hasil.cadangan, false);
  }
});

test('chart baru tersedia di semua gaya', () => {
  for (const id of ['bar-kapsul', 'area-banding', 'cincin-progres'] as const) {
    assert.ok(DAFTAR_CHART.includes(id));
    for (const v of VARIAN) {
      const hasil: any = buildOpsi(id, contohData(id), v);
      assert.ok(hasil.opsi?.series?.length > 0, `${id}/${v} tanpa seri`);
    }
  }
});

test('chart khas BUMD tersedia di semua gaya dan datanya terbaca', () => {
  const ids = ['air-terjun', 'sankey-alur', 'radar-aspek', 'gauge-kesehatan', 'peta-panas', 'treemap-porsi'] as const;
  for (const id of ids) {
    assert.ok(DAFTAR_CHART.includes(id));
    for (const v of VARIAN) {
      const hasil: any = buildOpsi(id, contohData(id), v);
      assert.equal(hasil.cadangan, false, `${id}/${v} jatuh ke cadangan`);
      assert.ok(hasil.opsi?.series?.length > 0, `${id}/${v} tanpa seri`);
    }
  }
  // Air terjun: batang dasar tak terlihat + batang nilai; total akhir = 377.
  const air: any = buildOpsi('air-terjun', contohData('air-terjun'), 'default').opsi;
  assert.equal(air.series[1].data.at(-1).value, 377);
  assert.equal(air.series[0].data[1], 512 - 96);
  // Sankey: pasangan "Asal>Tujuan" menjadi simpul dan tautan.
  const alur: any = buildOpsi('sankey-alur', contohData('sankey-alur'), 'default').opsi;
  assert.ok(alur.series[0].data.some((n: any) => n.name === 'Air hilang'));
  assert.equal(alur.series[0].links.length, 8);
  // Gauge kesehatan: 3,42 dari 5 masuk kategori Sehat.
  const skor: any = buildOpsi('gauge-kesehatan', contohData('gauge-kesehatan'), 'default').opsi;
  assert.equal(skor.series[0].data[0].name, 'Sehat');
});

test('gaya Tirta: terdaftar, punya KPI sendiri, dan ikut mode terang', async () => {
  const { gayaMode } = await import('../src/services/chart/gayaVarian');
  const { gayaDariPermintaan } = await import('../src/services/builder/susunHalaman');
  assert.ok(VARIAN.includes('tirta'));
  assert.equal((buildOpsi('kpi-kartu', contohData('kpi-kartu'), 'tirta').opsi as any).jenis, 'kpi-tirta');
  assert.notEqual(gayaMode('tirta', 'light').latar, gayaMode('tirta', 'dark').latar);
  assert.equal(gayaDariPermintaan('buatkan dashboard gaya tirta'), 'tirta');
});

test('lima gaya umum: terdaftar, punya pasangan terang/gelap, dan dikenali asisten', async () => {
  const { gayaMode } = await import('../src/services/chart/gayaVarian');
  const { gayaDariPermintaan } = await import('../src/services/builder/susunHalaman');
  for (const v of ['aurora', 'neon', 'blok', 'bento', 'koran'] as const) {
    assert.ok(VARIAN.includes(v), `${v} tidak terdaftar`);
    assert.notEqual(gayaMode(v, 'light').latar, gayaMode(v, 'dark').latar, `${v} tidak ikut mode`);
    assert.equal(gayaDariPermintaan(`buat dashboard gaya ${v}`), v);
  }
  // Blok dan Koran membawa tepi tegas sampai ke bentuk HTML.
  const kartu: any = buildOpsi('kpi-kartu', contohData('kpi-kartu'), 'blok').opsi;
  assert.equal(kartu.gaya.tepi.tebal, 2);
  assert.equal(gayaDariPermintaan('pakai gaya neubrutalism'), 'blok');
});
