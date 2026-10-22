import test from 'node:test';
import assert from 'node:assert/strict';
import { berkasKedaluwarsa } from '../src/services/ops/backupTerjadwal';

const HARI = 24 * 60 * 60 * 1000;
const sekarang = Date.UTC(2026, 9, 22, 3, 0, 0);

test('backup terjadwal: hanya berkas cadangan yang lebih tua dari batas', () => {
  const daftar = [
    { nama: 'aionesboard-baru.json.gz', waktu: sekarang - 1 * HARI },
    { nama: 'aionesboard-lama.json.gz', waktu: sekarang - 20 * HARI },
    { nama: 'aionesboard-lama.json.gz.sha256', waktu: sekarang - 20 * HARI },
  ];
  const buang = berkasKedaluwarsa(daftar, sekarang, 14);
  assert.deepEqual(buang.sort(), ['aionesboard-lama.json.gz', 'aionesboard-lama.json.gz.sha256']);
});

test('backup terjadwal: berkas lain di folder yang sama tidak disentuh', () => {
  const daftar = [
    { nama: 'catatan.txt', waktu: sekarang - 100 * HARI },
    { nama: 'aionesboard-2020.json.gz', waktu: sekarang - 100 * HARI },
  ];
  assert.deepEqual(berkasKedaluwarsa(daftar, sekarang, 7), ['aionesboard-2020.json.gz']);
});

test('backup terjadwal: semua masih baru → tidak ada yang dihapus', () => {
  const daftar = [{ nama: 'aionesboard-x.json.gz', waktu: sekarang - 2 * HARI }];
  assert.deepEqual(berkasKedaluwarsa(daftar, sekarang, 14), []);
});
