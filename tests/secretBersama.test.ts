import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { dekripsiNilai, enkripsiNilai, pakaiKunciLama } from '../src/services/config/rahasia';
import { setSecretSesi, signSession, verifySession } from '../src/services/auth/session';

const KUNCI_LAMA = 'aionesboard-kunci-lokal-jangan-dipakai-di-produksi';

/** Tiru nilai lama: dienkripsi dengan kunci cadangan versi sebelumnya. */
function enkripsiKunciLama(teks: string): string {
  const kunci = createHash('sha256').update(KUNCI_LAMA).digest();
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', kunci, iv);
  const isi = Buffer.concat([c.update(teks, 'utf8'), c.final()]);
  return `enc:v1:${iv.toString('base64url')}:${c.getAuthTag().toString('base64url')}:${isi.toString('base64url')}`;
}

test('nilai berkunci lama tetap bisa dibuka', () => {
  const lama = enkripsiKunciLama('kunci-rahasia-instansi');
  assert.equal(dekripsiNilai(lama), 'kunci-rahasia-instansi');
});

test('pakaiKunciLama menandai nilai lama, bukan nilai kunci sekarang', () => {
  assert.equal(pakaiKunciLama(enkripsiKunciLama('x')), true);
  assert.equal(pakaiKunciLama(enkripsiNilai('x')), false);
  assert.equal(pakaiKunciLama('masih-polos'), false);
});

test('nilai baru tidak bisa dibuka dengan kunci lama', () => {
  const baru = enkripsiNilai('rahasia-baru');
  const [iv, tag, isi] = baru.slice('enc:v1:'.length).split(':');
  const dec = createDecipheriv('aes-256-gcm', createHash('sha256').update(KUNCI_LAMA).digest(), Buffer.from(iv, 'base64url'));
  dec.setAuthTag(Buffer.from(tag, 'base64url'));
  assert.throws(() => {
    dec.update(Buffer.from(isi, 'base64url'));
    dec.final();
  });
});

test('secret sesi bersama menggantikan secret sebelumnya', () => {
  const token = signSession({ userId: 'u1', role: 'admin', tenantId: 't1', name: 'Uji' });
  assert.ok(verifySession(token));
  setSecretSesi('f'.repeat(64));
  assert.equal(verifySession(token), null, 'token lama harus ditolak setelah secret berganti');
  const baru = signSession({ userId: 'u1', role: 'admin', tenantId: 't1', name: 'Uji' });
  assert.ok(verifySession(baru));
});
