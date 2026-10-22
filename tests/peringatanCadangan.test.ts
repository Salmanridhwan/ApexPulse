import test from 'node:test';
import assert from 'node:assert/strict';
import { pesanCadanganGagal } from '../src/services/ops/backupTerjadwal';

const waktu = new Date('2026-10-22T07:00:00.000Z');

test('pesan cadangan gagal: judul jelas & menyebut akibatnya', () => {
  const p = pesanCadanganGagal('Error: ENOSPC', waktu);
  assert.match(p.subject, /GAGAL/);
  assert.match(p.text, /tidak ada titik pulih baru/);
  assert.match(p.text, /2026-10-22 07:00:00 UTC/);
});

test('pesan cadangan gagal: keluaran panjang dipotong, bukan dikirim utuh', () => {
  const p = pesanCadanganGagal('x'.repeat(5000), waktu);
  assert.ok(p.text.length < 2000, 'teks email harus dipotong');
  assert.ok(p.text.endsWith('x'.repeat(50)), 'yang diambil bagian akhir keluaran');
});

test('pesan cadangan gagal: keluaran kosong tetap punya isi', () => {
  const p = pesanCadanganGagal('', waktu);
  assert.match(p.text, /\(kosong\)/);
});

test('pesan cadangan gagal: html meng-escape karakter berbahaya', () => {
  const p = pesanCadanganGagal('<script>alert(1)</script>', waktu);
  assert.ok(!p.html.includes('<script>'));
  assert.ok(p.html.includes('&lt;script&gt;'));
});
