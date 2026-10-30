import assert from 'node:assert/strict';
import test from 'node:test';
import { labelHarian } from '../src/services/chart/labelTanggal';

test('label harian memakai tanggal, bukan nomor urut', () => {
  const label = labelHarian(3, new Date(2026, 9, 29));
  assert.deepEqual(label, ['27 Okt', '28 Okt', '29 Okt']);
});

test('label harian melewati batas bulan', () => {
  const label = labelHarian(2, new Date(2026, 10, 1));
  assert.deepEqual(label, ['31 Okt', '1 Nov']);
});

test('label harian kosong bila tidak ada titik', () => {
  assert.deepEqual(labelHarian(0), []);
});
