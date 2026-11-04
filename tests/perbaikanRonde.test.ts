import { test } from 'node:test';
import assert from 'node:assert/strict';

import { niatBuatDashboard, niatTambahWidget } from '../src/services/chat/niat';
import { widgetKembar } from '../src/services/builder/halamanDiminta';
import { susunDashboardBerhalaman } from '../src/services/builder/susunHalaman';
import type { WidgetSpec } from '../src/types';

const kartu = (title: string, extra: Partial<WidgetSpec> = {}): WidgetSpec =>
  ({ id: title, type: 'line', title, category: 'Operasional', confidence: 'sumber', grid: { x: 0, y: 0, w: 6, h: 4 }, citations: [], lastUpdated: '', chart: { xAxis: ['a', 'b', 'c'], series: [{ name: 's', data: [1, 2, 3] }] }, ...extra }) as WidgetSpec;

test('beberapa chart sekaligus diserahkan ke pembuat dashboard, satu chart tetap jalur widget', () => {
  const tiga = 'Buat 3 chart kinerja keuangan PAM JAYA dalam satu halaman';
  assert.equal(niatTambahWidget(tiga), false);
  assert.equal(niatBuatDashboard(tiga), true);
  const satu = 'Buat 1 chart pendapatan usaha PAM JAYA per tahun';
  assert.equal(niatTambahWidget(satu), true);
  // Ditujukan ke kanvas terbuka: tetap jalur tambah widget.
  assert.equal(niatTambahWidget('tambahkan 2 grafik ke dashboard ini'), true);
  assert.equal(niatBuatDashboard('bagaimana cara buat 3 chart?'), false);
});

test('kartu per bulan dan per tahun tidak dianggap kembar', () => {
  const bulan = kartu('Tren produksi air per bulan');
  const tahun = kartu('Tren produksi air per tahun');
  assert.equal(widgetKembar(tahun, [bulan]), false);
  assert.equal(widgetKembar(kartu('Tren produksi air per bulan 2024'), [bulan]), true);
});

test('elipsis dibersihkan dari subjudul dan label sumbu sebelum disimpan', () => {
  const w = kartu('Anggaran vs Realisasi', {
    type: 'hbar',
    subtitle: 'Per program…',
    chart: { xAxis: ['Penggantian pipa', 'Ketepatan layanan…', 'Digitalisasi meter'], series: [{ name: 'Anggaran', data: [1, 2, 3] }] },
  });
  const hasil = susunDashboardBerhalaman([w]);
  const k = hasil.halaman[0].widgets[0];
  assert.equal(k.subtitle, 'Per program');
  assert.deepEqual(k.chart!.xAxis, ['Penggantian pipa', 'Ketepatan layanan', 'Digitalisasi meter']);
});
