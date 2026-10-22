import test from 'node:test';
import assert from 'node:assert/strict';
import { dekripsiNilai, enkripsiNilai, terenkripsi } from '../src/services/config/rahasia';

test('rahasia: enkripsi lalu buka mengembalikan nilai asli', () => {
  const asli = 'kunci-rahasia-uji-1234567890';
  const sandi = enkripsiNilai(asli);
  assert.ok(terenkripsi(sandi));
  assert.ok(!sandi.includes(asli), 'nilai asli tidak boleh terlihat');
  assert.equal(dekripsiNilai(sandi), asli);
});

test('rahasia: dua enkripsi nilai sama menghasilkan teks berbeda (IV acak)', () => {
  const a = enkripsiNilai('sama-sama');
  const b = enkripsiNilai('sama-sama');
  assert.notEqual(a, b);
  assert.equal(dekripsiNilai(a), 'sama-sama');
  assert.equal(dekripsiNilai(b), 'sama-sama');
});

test('rahasia: nilai polos lama tetap terbaca (tanpa migrasi)', () => {
  assert.equal(terenkripsi('kunci-lama-polos'), false);
  assert.equal(dekripsiNilai('kunci-lama-polos'), 'kunci-lama-polos');
});

test('rahasia: nilai kosong & enkripsi ganda tidak merusak', () => {
  assert.equal(enkripsiNilai(''), '');
  assert.equal(dekripsiNilai(''), '');
  const sekali = enkripsiNilai('sekali');
  assert.equal(enkripsiNilai(sekali), sekali, 'sudah terenkripsi tidak dienkripsi ulang');
  assert.equal(dekripsiNilai(sekali), 'sekali');
});

test('rahasia: kunci enkripsi berbeda → gagal dibuka, bukan menebak', () => {
  const lama = process.env.DATA_ENCRYPTION_KEY;
  try {
    process.env.DATA_ENCRYPTION_KEY = 'kunci-pertama';
    const sandi = enkripsiNilai('rahasia-instansi');
    process.env.DATA_ENCRYPTION_KEY = 'kunci-kedua';
    assert.equal(dekripsiNilai(sandi), '');
  } finally {
    if (lama === undefined) delete process.env.DATA_ENCRYPTION_KEY;
    else process.env.DATA_ENCRYPTION_KEY = lama;
  }
});
