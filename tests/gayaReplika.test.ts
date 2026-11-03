import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gayaKartuReplika } from '../src/components/widgets/konteksGayaReplika';
import { GAYA } from '../src/services/chart/gayaVarian';

test('Gaya Semua di replika template: desain chart dipakai, panel tetap milik template', () => {
  const { varian, gaya } = gayaKartuReplika({ desain: 'analitik' }, 'ringkasan', undefined);
  assert.equal(varian, 'analitik');
  assert.equal(gaya?.kartu, GAYA.ringkasan.kartu);
  assert.deepEqual(gaya?.palet, GAYA.analitik.palet);
});

test('Gaya Semua di replika template: warna kartu sampai ke kartu KPI dan tabel', () => {
  const { gaya } = gayaKartuReplika({ kartu: '#e0f2fe' }, 'ringkasan', undefined);
  assert.equal(gaya?.kartu, '#e0f2fe');
  assert.notEqual(gaya?.teks, GAYA.ringkasan.teks, 'teks harus menyesuaikan kartu terang');
});

test('tanpa gaya dashboard, replika tidak berubah', () => {
  const r = gayaKartuReplika(undefined, 'kaca', undefined);
  assert.equal(r.varian, 'kaca');
  assert.equal(r.gaya, undefined);
});
