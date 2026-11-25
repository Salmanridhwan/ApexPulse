import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buatKunciBaru,
  bersihkanIzin,
  cakupanJalur,
  hashKunci,
  izinCukup,
  kunciAktif,
  kunciCocok,
  kunciAman,
  type KunciApi,
} from '../src/services/apiKunci';

/**
 * Kunci API adalah gerbang data antar-instansi: satu kesalahan di sini berarti
 * platform mitra bisa membaca/menulis instansi lain, atau chat/panel admin
 * terbuka tanpa login. Yang diuji: bentuk kunci, pencocokan hash, kedaluwarsa,
 * dan peta jalur (daftar putih).
 */

const kunciUji = (ubah: Partial<KunciApi> = {}): KunciApi => ({
  id: 'key-1',
  nama: 'Platform Uji',
  awalan: 'aio_abcdefgh',
  hash: hashKunci('aio_rahasia'),
  tenantId: 'tenant-a',
  izin: ['dokumen', 'dashboard'],
  dibuatPada: new Date().toISOString(),
  dibuatOleh: { userId: 'user-1', name: 'Admin' },
  jumlahPermintaan: 0,
  ...ubah,
});

test('kunci baru berbentuk aio_<base64url> dan hash-nya cocok', () => {
  const { kunci, awalan, hash } = buatKunciBaru();
  assert.match(kunci, /^aio_[A-Za-z0-9_-]{32}$/);
  assert.equal(awalan, kunci.slice(0, 12));
  assert.equal(hash, hashKunci(kunci));
  assert.ok(kunciCocok(kunci, hash));
  assert.equal(kunciCocok(`${kunci}x`, hash), false);
  assert.equal(kunciCocok('', hash), false);
  assert.equal(kunciCocok(kunci, ''), false);
});

test('kunci yang dikembalikan ke klien tidak memuat hash', () => {
  const aman = kunciAman(kunciUji());
  assert.equal('hash' in aman, false);
  assert.equal(aman.awalan, 'aio_abcdefgh');
});

test('kunci dicabut atau kedaluwarsa dianggap tidak aktif', () => {
  assert.equal(kunciAktif(kunciUji()), true);
  assert.equal(kunciAktif(kunciUji({ dicabutPada: new Date().toISOString() })), false);
  const kemarin = new Date(Date.now() - 86_400_000).toISOString();
  assert.equal(kunciAktif(kunciUji({ kedaluwarsaPada: kemarin })), false);
  const besok = new Date(Date.now() + 86_400_000).toISOString();
  assert.equal(kunciAktif(kunciUji({ kedaluwarsaPada: besok })), true);
});

test('jalur chat, auth, dan panel admin TIDAK pernah terbuka untuk kunci API', () => {
  const k = kunciUji({ izin: ['dokumen', 'dashboard'] });
  for (const jalur of [
    '/api/chat',
    '/api/chats',
    '/api/auth/login',
    '/api/admin/users',
    '/api/admin/api-keys',
    '/api/me',
    '/api/permintaan',
    '/api/rag-probe',
    '/health',
    '/api/tidak-dikenal',
  ]) {
    assert.equal(cakupanJalur(jalur), null, jalur);
    assert.equal(izinCukup(k, jalur), false, jalur);
  }
});

test('jalur AI aplikasi (chat dashboard, insight, rekomendasi) tetap tertutup', () => {
  const k = kunciUji({ izin: ['dokumen', 'dashboard'] });
  for (const jalur of [
    '/api/dashboards/dash-1/chat',
    '/api/dashboards/dash-1/halaman/h1/insight',
    '/api/dashboards/dash-1/widget-dari-saran',
    '/api/dashboards/rekomendasi',
    '/api/dashboards/dari-template',
  ]) {
    assert.equal(cakupanJalur(jalur), null, jalur);
    assert.equal(izinCukup(k, jalur), false, jalur);
  }
});

test('izin dokumen hanya membuka jalur dokumen, bukan dashboard', () => {
  const k = kunciUji({ izin: ['dokumen'] });
  assert.equal(izinCukup(k, '/api/berkas/unggah'), true);
  assert.equal(izinCukup(k, '/api/berkas'), true);
  assert.equal(izinCukup(k, '/api/analisis'), true);
  assert.equal(izinCukup(k, '/api/butir-data'), true);
  assert.equal(izinCukup(k, '/api/dashboards/dari-butir'), false);
});

test('izin dashboard membuka jalur dashboard dan tautan bagikan', () => {
  const k = kunciUji({ izin: ['dashboard'] });
  assert.equal(izinCukup(k, '/api/dashboards'), true);
  assert.equal(izinCukup(k, '/api/dashboards/dari-butir'), true);
  assert.equal(izinCukup(k, '/api/dashboards/abc/share'), true);
  assert.equal(izinCukup(k, '/api/widgets/ambil-data'), true);
  assert.equal(izinCukup(k, '/api/berkas/unggah'), false);
});

test('izin disaring: hanya nilai dikenal, duplikat dibuang', () => {
  assert.deepEqual(bersihkanIzin(['dashboard', 'chat', 'dashboard', 'admin']), ['dashboard']);
  assert.deepEqual(bersihkanIzin(['dokumen', 'dashboard']), ['dokumen', 'dashboard']);
  assert.deepEqual(bersihkanIzin(undefined), []);
  assert.deepEqual(bersihkanIzin('dokumen'), []);
});
