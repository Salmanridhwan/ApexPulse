import { test } from 'node:test';
import assert from 'node:assert/strict';

import { kartuBerjudulSendiri, propsKatalogHtml } from '../src/services/chart/dataKatalogWidget';
import type { WidgetSpec } from '../src/types';

const dasar = { id: 'w1', grid: { x: 0, y: 0, w: 4, h: 3 }, citations: [] } as unknown as WidgetSpec;

test('kartu KPI berwajah Template Chart: angka, satuan, delta dari widget', () => {
  const w = { ...dasar, type: 'kpi', chartId: 'kpi-kartu', title: 'Jumlah pelanggan', kpi: { value: '951.640', unit: 'sambungan', delta: 2, deltaLabel: 'vs periode sebelumnya' } } as WidgetSpec;
  const p = propsKatalogHtml(w)!;
  assert.equal(p.teksAngka, '951.640');
  assert.equal(p.data.satuan, 'sambungan');
  assert.equal(p.data.delta, 2);
  assert.equal(p.deltaTeks, 'vs periode sebelumnya');
  assert.equal(kartuBerjudulSendiri(w), true);
});

test('sparkline turunan (bukan dari dokumen) tidak digambar', () => {
  const w = { ...dasar, type: 'kpi', chartId: 'kpi-kartu', title: 'NRW', kpi: { value: '43,8', sparkline: [1, 2, 3], sparklineAsal: 'turunan-nilai' } } as WidgetSpec;
  assert.equal(propsKatalogHtml(w)!.spark, undefined);
});

test('tabel memakai kepala & baris widget; chart ECharts tidak lewat jalur HTML', () => {
  const t = {
    ...dasar,
    type: 'table',
    chartId: 'tabel-ringkas',
    title: 'Status pengaduan',
    table: { columns: [{ key: 'a', label: 'Status' }, { key: 'b', label: 'Jumlah' }], rows: [{ a: 'Selesai', b: '18.640' }] },
  } as unknown as WidgetSpec;
  assert.deepEqual(propsKatalogHtml(t)!.data.tabel, { kepala: ['Status', 'Jumlah'], baris: [['Selesai', '18.640']] });
  assert.equal(kartuBerjudulSendiri(t), false);
  const bar = { ...dasar, type: 'bar', chartId: 'bar-tegak', title: 'x', chart: { xAxis: ['a'], series: [] } } as unknown as WidgetSpec;
  assert.equal(propsKatalogHtml(bar), null);
});
