import test from 'node:test';
import assert from 'node:assert/strict';
import { statusCadangan } from '../src/services/ops/backupTerjadwal';

const JAM = 60 * 60 * 1000;
const sekarang = Date.UTC(2026, 9, 22, 12, 0, 0);

test('status cadangan: tidak ada berkas → terlambat', () => {
  assert.deepEqual(statusCadangan([], sekarang), { terakhir: null, umurJam: null, terlambat: true });
});

test('status cadangan: cadangan baru (2 jam) tidak terlambat', () => {
  const s = statusCadangan([{ nama: 'aionesboard-a.json.gz', waktu: sekarang - 2 * JAM }], sekarang);
  assert.equal(s.terakhir, 'aionesboard-a.json.gz');
  assert.equal(s.umurJam, 2);
  assert.equal(s.terlambat, false);
});

test('status cadangan: memakai berkas terbaru, bukan yang pertama di daftar', () => {
  const s = statusCadangan(
    [
      { nama: 'aionesboard-lama.json.gz', waktu: sekarang - 72 * JAM },
      { nama: 'aionesboard-baru.json.gz', waktu: sekarang - 1 * JAM },
    ],
    sekarang
  );
  assert.equal(s.terakhir, 'aionesboard-baru.json.gz');
  assert.equal(s.terlambat, false);
});

test('status cadangan: lebih dari 26 jam → terlambat (penjadwal berhenti)', () => {
  const s = statusCadangan([{ nama: 'aionesboard-x.json.gz', waktu: sekarang - 30 * JAM }], sekarang);
  assert.equal(s.umurJam, 30);
  assert.equal(s.terlambat, true);
});

test('status cadangan: berkas sha256 tidak dianggap cadangan', () => {
  const s = statusCadangan([{ nama: 'aionesboard-x.json.gz.sha256', waktu: sekarang - 1 * JAM }], sekarang);
  assert.equal(s.terakhir, null);
  assert.equal(s.terlambat, true);
});
