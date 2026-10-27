import test from 'node:test';
import assert from 'node:assert/strict';
import {
  masalahKataSandi,
  kataSandiSementara,
  adalahSandiBawaan,
  PANJANG_MINIMAL,
  SANDI_ADMIN_BAWAAN,
} from '../src/services/auth/password';
import { hashPassword, verifyPassword, signSession, verifySession, sessionCookieHeader } from '../src/services/auth/session';

test('kata sandi: menolak terlalu pendek', () => {
  assert.match(String(masalahKataSandi('a1b2')), /minimal/i);
});

test('kata sandi: wajib huruf dan angka', () => {
  assert.match(String(masalahKataSandi('hanyahurufsaja')), /huruf dan angka/i);
  assert.match(String(masalahKataSandi('1234567890')), /huruf dan angka/i);
});

test('kata sandi: menolak sandi bawaan/umum', () => {
  assert.match(String(masalahKataSandi('apexpulse2026')), /dipakai banyak orang/i);
  assert.match(String(masalahKataSandi('aionesboard2026')), /dipakai banyak orang/i);
  assert.equal(adalahSandiBawaan('AionesBoard2026'), true);
  assert.equal(adalahSandiBawaan('KucingOren92'), false);

  // Sandi bawaan admin yang berlaku sekarang harus lolos aturan sandi, supaya
  // akun admin bisa dipakai langsung tanpa dipaksa mengganti.
  assert.equal(SANDI_ADMIN_BAWAAN, 'Jagoai5758');
  assert.equal(masalahKataSandi(SANDI_ADMIN_BAWAAN), null, 'sandi admin sah menurut aturan');
  assert.equal(adalahSandiBawaan(SANDI_ADMIN_BAWAAN), false, 'bukan sandi bawaan lama');
});

test('kata sandi: tidak boleh memuat bagian email', () => {
  assert.match(String(masalahKataSandi('budi12345678', 'budi@bumd.id')), /bagian dari email/i);
  assert.equal(masalahKataSandi('KucingOren92', 'budi@bumd.id'), null);
});

test('kata sandi: panjang minimal sesuai konstanta', () => {
  const pas = 'a1'.repeat(PANJANG_MINIMAL);
  assert.equal(masalahKataSandi(pas), null);
});

test('kata sandi sementara: format acak & layak pakai', () => {
  const s = kataSandiSementara();
  assert.match(s, /^[A-Za-z]{5}-\d{4}$/);
  assert.equal(masalahKataSandi(s), null);
  assert.notEqual(kataSandiSementara(), s);
});

test('scrypt: hash tidak menyimpan sandi asli dan bisa diverifikasi', () => {
  const hash = hashPassword('KucingOren92');
  assert.ok(!hash.includes('KucingOren92'));
  assert.equal(verifyPassword('KucingOren92', hash), true);
  assert.equal(verifyPassword('KucingOren93', hash), false);
});

test('sesi: tanda tangan sah, rusak ditolak', () => {
  const token = signSession({ userId: 'u1', role: 'admin', tenantId: 't1', name: 'Uji' });
  const isi = verifySession(token);
  assert.equal(isi?.userId, 'u1');
  assert.equal(isi?.role, 'admin');

  const [data] = token.split('.');
  assert.equal(verifySession(`${data}.palsu`), null);
  assert.equal(verifySession(undefined), null);
});

test('sesi: penanda wajib ganti sandi ikut di token', () => {
  const token = signSession({ userId: 'u2', role: 'pengguna', tenantId: 't1', name: 'Uji', mustChange: true });
  assert.equal(verifySession(token)?.mustChange, true);
});

test('cookie sesi: HttpOnly + SameSite, Secure hanya di produksi', () => {
  const lama = process.env.NODE_ENV;
  try {
    delete process.env.NODE_ENV;
    const lokal = sessionCookieHeader('abc');
    assert.match(lokal, /HttpOnly/);
    assert.match(lokal, /SameSite=Lax/);
    assert.doesNotMatch(lokal, /Secure/);

    process.env.NODE_ENV = 'production';
    assert.match(sessionCookieHeader('abc'), /Secure/);
  } finally {
    if (lama === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = lama;
  }
});
