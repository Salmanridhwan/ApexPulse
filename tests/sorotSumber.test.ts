import { test } from 'node:test';
import assert from 'node:assert/strict';

import { angkaKartu, potongSorot } from '../src/services/chart/sorotSumber';
import type { WidgetSpec } from '../src/types';

const teksSorot = (teks: string, angka: string[]) => potongSorot(teks, angka).filter((b) => b.sorot).map((b) => b.teks);

test('nilai KPI disorot di kutipan dokumen', () => {
  const w = { type: 'kpi', kpi: { value: '951.640' } } as unknown as WidgetSpec;
  assert.deepEqual(teksSorot('Jumlah pelanggan 951.640 sambungan', angkaKartu(w)), ['951.640']);
});

test('titik grafik disorot dalam bentuk tulisan dokumen, tanpa memotong angka lain', () => {
  const w = { type: 'bar', chart: { xAxis: ['a', 'b'], series: [{ name: 'x', data: [1058, 873] }] } } as unknown as WidgetSpec;
  assert.deepEqual(teksSorot('Pegawai 1.058 orang, rasio 873; tahun 18730', angkaKartu(w)), ['1.058', '873']);
});

test('tanpa angka cocok, teks utuh tanpa sorotan', () => {
  assert.deepEqual(potongSorot('Tidak ada angka', ['12']), [{ teks: 'Tidak ada angka', sorot: false }]);
});
