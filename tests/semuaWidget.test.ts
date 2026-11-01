import { test } from 'node:test';
import assert from 'node:assert/strict';

import { semuaWidget } from '../src/services/dashboard/halaman';

test('P0-B: hitungan widget mencakup semua halaman, halaman aktif memakai isi terbaru', () => {
  const w = (id: string) => ({ id, type: 'kpi', title: id }) as any;
  const d: any = {
    widgets: [w('a'), w('a2')],
    halamanAktifId: 'h1',
    halaman: [
      { id: 'h1', judul: 'Ringkasan', widgets: [w('a')] },
      { id: 'h2', judul: 'Keuangan', widgets: [w('b'), w('c')] },
    ],
  };
  assert.deepEqual(semuaWidget(d).map((x) => x.id), ['a', 'a2', 'b', 'c']);
  // Dashboard lama tanpa halaman.
  assert.deepEqual(semuaWidget({ widgets: [w('x')] } as any).map((x) => x.id), ['x']);
});
