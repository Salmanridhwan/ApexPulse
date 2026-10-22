import test from 'node:test';
import assert from 'node:assert/strict';
import { potongHalaman } from '../src/services/http/halaman';

const data = Array.from({ length: 120 }, (_, i) => i + 1); // 1..120, terlama dulu

test('halaman: default 50 baris terbaru dulu', () => {
  const h = potongHalaman(data, undefined, undefined);
  assert.equal(h.limit, 50);
  assert.equal(h.offset, 0);
  assert.equal(h.total, 120);
  assert.equal(h.baris.length, 50);
  assert.equal(h.baris[0], 120, 'entri terbaru di urutan pertama');
  assert.equal(h.baris[49], 71);
});

test('halaman: offset mengambil lanjutan tanpa tumpang tindih', () => {
  const awal = potongHalaman(data, 10, 0);
  const lanjut = potongHalaman(data, 10, 10);
  assert.deepEqual(awal.baris, [120, 119, 118, 117, 116, 115, 114, 113, 112, 111]);
  assert.deepEqual(lanjut.baris, [110, 109, 108, 107, 106, 105, 104, 103, 102, 101]);
  assert.equal(awal.baris.filter((x) => lanjut.baris.includes(x)).length, 0);
});

test('halaman: limit dibatasi 1..200 dan nilai aneh diabaikan', () => {
  assert.equal(potongHalaman(data, 9999, 0).limit, 200);
  assert.equal(potongHalaman(data, 0, 0).limit, 1);
  assert.equal(potongHalaman(data, 'bukan-angka', 'x').limit, 50);
  assert.equal(potongHalaman(data, 10, -5).offset, 0);
});

test('halaman: offset melewati total menghasilkan daftar kosong', () => {
  const h = potongHalaman(data, 50, 500);
  assert.deepEqual(h.baris, []);
  assert.equal(h.total, 120);
});

test('halaman: daftar kosong tetap aman', () => {
  const h = potongHalaman([], 20, 0);
  assert.deepEqual(h.baris, []);
  assert.equal(h.total, 0);
});
