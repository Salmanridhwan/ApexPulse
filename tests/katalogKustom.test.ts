/**
 * ATURAN: chart di kanvas selalu diambil dari Template Chart.
 *
 * Yang diuji di sini:
 *  - widget yang sudah memakai chart bawaan tidak diubah (tidak ada entri baru);
 *  - bentuk data yang TIDAK punya padanan bawaan dibuatkan entri Template Chart
 *    baru (`kustom-…`) yang menunjuk chart bawaan penggambarnya;
 *  - entri tidak dibuat dua kali untuk bentuk yang sama, dan gerbangnya idempoten;
 *  - hasil akhir selalu punya `chartId` yang terdaftar (bawaan atau kustom).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AWALAN_KUSTOM,
  chartPenggambar,
  dasarUntuk,
  idKatalogSah,
  pastikanChartKatalog,
  putusanChart,
  sidikBentuk,
} from '../src/services/chart/katalogKustom';
import { DAFTAR_CHART, type ChartId } from '../src/services/chart/chartDefault';
import type { WidgetSpec } from '../src/types';

const widget = (p: Partial<WidgetSpec> & { id: string }): WidgetSpec =>
  ({
    title: 'Kartu uji',
    type: 'bar',
    confidence: 'medium',
    grid: { x: 0, y: 0, w: 4, h: 3 },
    ...p,
  }) as WidgetSpec;

test('chart bawaan yang sah dibiarkan apa adanya', () => {
  const w = widget({ id: 'w1', type: 'bar', chartId: 'bar-tegak-sorot' });
  const hasil = pastikanChartKatalog([w], { ada: [] });
  assert.equal(hasil.baru.length, 0);
  assert.equal(hasil.widgets[0].chartId, 'bar-tegak-sorot');
  assert.equal(hasil.widgets[0].chartDasar, undefined);
});

test('bentuk data tanpa padanan bawaan → entri Template Chart baru', () => {
  // Peta tanpa geo: tidak ada chart bawaan bertipe peta yang bisa menggambar.
  const w = widget({ id: 'w2', type: 'map' });
  const hasil = pastikanChartKatalog([w], { ada: [], sekarang: '2026-11-08T00:00:00.000Z' });
  assert.equal(hasil.baru.length, 1);
  const entri = hasil.baru[0];
  assert.ok(entri.id.startsWith(AWALAN_KUSTOM), 'id entri harus berawalan kustom-');
  assert.ok(DAFTAR_CHART.includes(entri.dasar), 'dasar harus chart bawaan');
  assert.equal(hasil.widgets[0].chartId, entri.id);
  assert.equal(hasil.widgets[0].chartDasar, entri.dasar);
  assert.equal(hasil.widgets[0].type, entri.tipe);
  assert.equal(entri.dibuatPada, '2026-11-08T00:00:00.000Z');
});

test('bentuk data yang sama tidak membuat entri kedua', () => {
  const a = widget({ id: 'a', type: 'map' });
  const b = widget({ id: 'b', type: 'map', title: 'Peta lain' });
  const hasil = pastikanChartKatalog([a, b], { ada: [] });
  assert.equal(hasil.baru.length, 1, 'dua kartu sebentuk cukup satu entri');
  assert.equal(hasil.widgets[0].chartId, hasil.widgets[1].chartId);
});

test('gerbang idempoten: dijalankan ulang tidak menambah entri', () => {
  const w = widget({ id: 'w3', type: 'map' });
  const satu = pastikanChartKatalog([w], { ada: [] });
  assert.equal(satu.baru.length, 1);
  const dua = pastikanChartKatalog(satu.widgets, { ada: satu.baru });
  assert.equal(dua.baru.length, 0);
  assert.equal(dua.widgets[0].chartId, satu.widgets[0].chartId);
});

test('hasil gerbang SELALU punya chartId terdaftar di Template Chart', () => {
  const semua: WidgetSpec[] = [
    widget({ id: 'k', type: 'kpi', kpi: { label: 'X', value: 10 } as any }),
    widget({ id: 't', type: 'table', table: { columns: ['a', 'b'], rows: [[1, 2]] } as any }),
    widget({ id: 's', type: 'bar', chart: { series: [{ name: 'S', data: [1] }], xAxis: ['q'] } as any }),
    widget({ id: 'm', type: 'map' }),
    widget({ id: 'h', type: 'heatmap', chart: { series: [{ name: 'S', data: [1, 2] }], xAxis: ['a', 'b'] } as any }),
    widget({ id: 'b', type: 'boxplot', chart: { series: [{ name: 'S', data: [1, 2] }], xAxis: ['a', 'b'] } as any }),
    widget({ id: 'n', type: 'narasi' }),
  ];
  const hasil = pastikanChartKatalog(semua, { ada: [] });
  const sah = idKatalogSah(hasil.baru);
  for (const w of hasil.widgets) {
    assert.ok(w.chartId, `widget ${w.id} wajib punya chartId`);
    assert.ok(sah.includes(w.chartId as string), `chartId ${w.chartId} harus terdaftar`);
  }
  // Tipe yang punya wajah katalog memakai chart bawaan — bukan semuanya kustom.
  assert.equal(hasil.widgets.find((w) => w.id === 'k')?.chartId, 'kpi-kartu');
  assert.equal(hasil.widgets.find((w) => w.id === 't')?.chartId, 'tabel-ringkas');
  assert.equal(hasil.widgets.find((w) => w.id === 's')?.chartId, 'bar-tegak-sorot');
  // Heatmap SUDAH punya wajah di Template Chart (peta-panas) → wajah itu dipakai.
  assert.equal(hasil.widgets.find((w) => w.id === 'h')?.chartId, 'peta-panas');
  // Boxplot belum punya wajah → entri baru, bukan dipaksa jadi bar.
  const b = hasil.widgets.find((w) => w.id === 'b');
  assert.ok(String(b?.chartId).startsWith(AWALAN_KUSTOM));
  assert.equal(b?.chartDasar, 'bar-tegak');
  assert.ok(hasil.baru.some((k) => k.id === b?.chartId));
});

test('dasar dipilih sesuai bentuk data yang bisa digambar', () => {
  // `dasarUntuk` adalah jaring terakhir: dipakai hanya kalau `pilihChart` tidak
  // menemukan chart bawaan sama sekali.
  assert.equal(dasarUntuk(widget({ id: 't', type: 'map', table: { columns: ['a', 'b'], rows: [[1, 2]] } as any })), 'tabel-ringkas');
  assert.equal(dasarUntuk(widget({ id: 'k', type: 'map', kpi: { label: 'X', value: 5 } as any })), 'kpi-kartu');
  assert.equal(
    dasarUntuk(
      widget({
        id: 'c',
        type: 'map',
        chart: { series: [{ name: 'Realisasi', data: [1] }, { name: 'Target', data: [2] }], xAxis: ['a'] } as any,
      })
    ),
    'combo-batang-garis'
  );
  assert.equal(dasarUntuk(widget({ id: 'n', type: 'map' })), 'narasi-insight');

  // Lewat gerbang: peta tanpa data → entri kustom, dasarnya narasi (bukan kartu kosong).
  const peta = putusanChart(widget({ id: 'p', type: 'map' }), { ada: [] });
  assert.equal(peta.pakai === 'kustom' && peta.entri.dasar, 'narasi-insight');
});

test('chart penggambar entri kustom = chart dasarnya', () => {
  const w = widget({ id: 'w4', type: 'map' });
  const hasil = pastikanChartKatalog([w], { ada: [] });
  const entri = hasil.baru[0];
  const gambar = chartPenggambar(hasil.widgets[0], hasil.baru);
  assert.equal(gambar, entri.dasar as ChartId);
  // Tanpa daftar kustom pun, `chartDasar` di widget sudah cukup untuk menggambar.
  assert.equal(chartPenggambar(hasil.widgets[0], []), entri.dasar as ChartId);
});

test('sidik bentuk memisahkan bentuk yang berbeda', () => {
  const satu = widget({ id: 'a', type: 'bar', chart: { series: [{ name: 'S', data: [1] }], xAxis: ['x'] } as any });
  const dua = widget({ id: 'b', type: 'bar', chart: { series: [{ name: 'S', data: [1, 2] }], xAxis: ['x', 'y'] } as any });
  assert.notEqual(sidikBentuk(satu), sidikBentuk(dua));
  assert.equal(sidikBentuk(satu), sidikBentuk({ ...satu, id: 'lain', title: 'lain' }));
});
