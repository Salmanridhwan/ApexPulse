import test from 'node:test';
import assert from 'node:assert/strict';
import { buatPembatas } from '../src/services/auth/rateLimit';

test('pembatas: mengizinkan sampai batas lalu menolak', () => {
  const p = buatPembatas(3, 60_000);
  const k = 'ip:1.2.3.4';
  assert.equal(p.cek(k).boleh, true);
  p.gagal(k);
  p.gagal(k);
  assert.equal(p.cek(k).boleh, true, 'percobaan ke-3 masih boleh');
  p.gagal(k);
  const hasil = p.cek(k);
  assert.equal(hasil.boleh, false);
  assert.equal(hasil.sisa, 0);
  assert.ok(hasil.tungguDetik > 0);
});

test('pembatas: jendela waktu habis → boleh lagi', () => {
  const p = buatPembatas(1, 1000);
  const k = 'akun:a@b.id';
  const t0 = 1_000_000;
  p.gagal(k, t0);
  assert.equal(p.cek(k, t0 + 500).boleh, false);
  assert.equal(p.cek(k, t0 + 1001).boleh, true);
});

test('pembatas: login berhasil membersihkan hitungan', () => {
  const p = buatPembatas(2, 60_000);
  const k = 'akun:x@y.id';
  p.gagal(k);
  p.gagal(k);
  assert.equal(p.cek(k).boleh, false);
  p.bersihkan(k);
  assert.equal(p.cek(k).boleh, true);
});

test('pembatas: kunci berbeda tidak saling memengaruhi', () => {
  const p = buatPembatas(1, 60_000);
  p.gagal('ip:a');
  assert.equal(p.cek('ip:a').boleh, false);
  assert.equal(p.cek('ip:b').boleh, true);
});

test('pembatas: sapu membuang entri kedaluwarsa', () => {
  const p = buatPembatas(5, 1000);
  const t0 = 5_000_000;
  p.gagal('ip:a', t0);
  p.gagal('ip:b', t0);
  assert.equal(p.ukuran, 2);
  p.sapu(t0 + 1001);
  assert.equal(p.ukuran, 0);
});
