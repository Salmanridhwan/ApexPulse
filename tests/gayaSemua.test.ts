import { test } from 'node:test';
import assert from 'node:assert/strict';

import { terapkanGayaSemua } from '../src/services/dashboard/gayaSemua';
import { semuaWidget } from '../src/services/dashboard/halaman';
import type { Dashboard, WidgetSpec } from '../src/types';

const w = (id: string, type = 'bar'): WidgetSpec => ({ id, type, title: id, citations: [], grid: { x: 0, y: 0, w: 6, h: 4 } }) as any;

const dua = (): Dashboard =>
  ({
    id: 'd',
    tenantId: 't',
    title: 'Uji',
    description: '',
    sector: 'pdam',
    widgets: [w('a1'), w('a2', 'kpi')],
    halaman: [
      { id: 'hlm-1', judul: 'Ringkasan', widgets: [w('a1'), w('a2', 'kpi')] },
      { id: 'hlm-2', judul: 'Keuangan', widgets: [w('b1'), w('b2', 'line')] },
    ],
    halamanAktifId: 'hlm-1',
    globalFilters: { periode: 'Semua', unitKerja: 'Semua', kategori: 'Semua' },
    createdAt: '',
    updatedAt: '',
  }) as any;

test('Gaya Semua memasang desain ke widget di SEMUA halaman, bukan hanya halaman aktif', () => {
  const hasil = terapkanGayaSemua(dua(), { desain: 'analitik' });
  const semua = semuaWidget(hasil);
  assert.equal(semua.length, 4);
  assert.ok(semua.every((x) => x.style?.desain === 'analitik'), JSON.stringify(semua.map((x) => x.style)));
  // Proyeksi halaman aktif ikut diperbarui.
  assert.ok(hasil.widgets.every((x) => x.style?.desain === 'analitik'));
  assert.equal(hasil.gaya?.desain, 'analitik');
});

test('Palet ke satu widget di halaman lain hanya mengenai widget itu', () => {
  const hasil = terapkanGayaSemua(dua(), { palette: 'hijau', kartu: '#e0f2fe' }, 'b2');
  const per = Object.fromEntries(semuaWidget(hasil).map((x) => [x.id, x.style]));
  assert.equal(per.b2?.palette, 'hijau');
  assert.equal(per.b1?.palette, undefined);
  // Warna kartu selalu untuk semua widget.
  assert.ok(Object.values(per).every((s) => s?.kartu === '#e0f2fe'));
});

test('Dashboard lama tanpa halaman tetap bisa diberi gaya', () => {
  const d = { ...dua(), halaman: undefined, halamanAktifId: undefined } as any;
  const hasil = terapkanGayaSemua(d, { desain: 'trafik' });
  assert.ok(hasil.widgets.every((x) => x.style?.desain === 'trafik'));
});

test('Ganti beberapa saja: desain hanya untuk kartu terpilih, lintas halaman', () => {
  const hasil = terapkanGayaSemua(dua(), { desain: 'ringkasan' }, ['a1', 'b2']);
  const per = Object.fromEntries(semuaWidget(hasil).map((x) => [x.id, x.style?.desain]));
  assert.equal(per.a1, 'ringkasan');
  assert.equal(per.b2, 'ringkasan');
  assert.equal(per.b1, undefined);
});
