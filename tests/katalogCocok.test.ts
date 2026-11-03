import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chartKatalogCocok, pakaiChartKatalog } from '../src/services/chart/katalogCocok';

const g = (type: string, cats: string[], ser: Array<{ name: string; data: number[] }>) =>
  ({ id: 'x', type, title: 't', chart: { xAxis: cats, series: ser }, citations: [], grid: { x: 0, y: 0, w: 6, h: 4 } }) as any;

test('pemilih Template Chart hanya menawarkan chart yang datanya tersedia', () => {
  const satu = chartKatalogCocok(g('bar', ['A', 'B', 'C'], [{ name: 'Beban', data: [1, 2, 3] }]));
  assert.ok(satu.includes('bar-tegak-sorot') && satu.includes('donat-tebal') && satu.includes('bar-kapsul'));
  // Butuh dua seri / target: tidak ditawarkan untuk satu seri.
  assert.ok(!satu.includes('bar-tumpuk') && !satu.includes('area-banding') && !satu.includes('bar-tegak-target'));
  // Kartu angka hanya antar-kartu angka.
  const kpi = chartKatalogCocok({ id: 'k', type: 'kpi', title: 'k', kpi: { value: 951640 }, citations: [] } as any);
  assert.ok(kpi.includes('kpi-kartu') && !kpi.includes('bar-tegak') && !kpi.includes('gauge-kesehatan'));
});

test('memakai chart katalog mengisi chartId dan tipe chart itu', () => {
  const w = pakaiChartKatalog(g('bar', ['A', 'B', 'C'], [{ name: 'Beban', data: [1, 2, 3] }]), 'donat-tebal');
  assert.equal(w.chartId, 'donat-tebal');
  assert.equal(w.type, 'donut');
});
