import test from 'node:test';
import assert from 'node:assert/strict';
import { adaLagiHalaman, potongHalaman, potongUrut } from '../src/services/http/halaman';

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
test('potongUrut: urutan asli dipertahankan (daftar berkas)', () => {
  const berkas = ['a.pdf', 'b.pdf', 'c.pdf', 'd.pdf', 'e.pdf'];
  const h = potongUrut(berkas, 2, 0);
  assert.deepEqual(h.baris, ['a.pdf', 'b.pdf']);
  const lanjut = potongUrut(berkas, 2, 2);
  assert.deepEqual(lanjut.baris, ['c.pdf', 'd.pdf']);
  assert.equal(lanjut.total, 5);
});

test('potongUrut: halaman terakhir tidak mengulang baris sebelumnya', () => {
  const berkas = Array.from({ length: 7 }, (_, i) => `berkas-${i}`);
  const kumpulan: string[] = [];
  for (let offset = 0; offset < 7; offset += 3) {
    kumpulan.push(...potongUrut(berkas, 3, offset).baris);
  }
  assert.deepEqual(kumpulan, berkas, 'gabungan halaman = daftar utuh, tanpa duplikat');
});

test('adaLagiHalaman: hanya benar bila masih ada sisa', () => {
  assert.equal(adaLagiHalaman(120, 0, 50), true);
  assert.equal(adaLagiHalaman(120, 100, 50), false, 'offset+limit tepat di total');
  assert.equal(adaLagiHalaman(120, 50, 50), true);
  assert.equal(adaLagiHalaman(10, 0, 50), false, 'total lebih kecil dari satu halaman');
  assert.equal(adaLagiHalaman(0, 0, 50), false);
});
