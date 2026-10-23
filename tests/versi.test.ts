import test from 'node:test';
import assert from 'node:assert/strict';
import { perluMuatUlang } from '../src/services/ui/versi';

test('versi sama → tidak perlu muat ulang', () => {
  assert.equal(perluMuatUlang('mRxru9wa', 'mRxru9wa'), false);
});

test('versi berbeda → tab lama harus dimuat ulang', () => {
  assert.equal(perluMuatUlang('lama123', 'baru456'), true);
});

test('versi belum diketahui → jangan ganggu pengguna', () => {
  assert.equal(perluMuatUlang(null, 'baru456'), false);
  assert.equal(perluMuatUlang('lama123', null), false);
  assert.equal(perluMuatUlang(null, null), false);
});

test('mode dev tidak pernah memicu pemberitahuan', () => {
  assert.equal(perluMuatUlang('dev', 'mRxru9wa'), false);
  assert.equal(perluMuatUlang('mRxru9wa', 'dev'), false);
});
