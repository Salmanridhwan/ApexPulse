/**
 * UJI PENYARING JEJAK AUDIT.
 *
 * Yang dijaga di sini: Admin Instansi tidak bisa menarik log instansi lain lewat
 * parameter, dan penyaring waktu tidak membuang log karena salah tafsir zona.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { pilihanInstansiAudit, saringAudit } from '../src/services/admin/audit';

const logs = [
  { tenantId: 't1', action: 'Buat Dashboard', userName: 'Salman', timestamp: '2026-11-01T08:00:00' },
  { tenantId: 't1', action: 'Ubah Widget', userName: 'Salman', timestamp: '2026-11-05T08:00:00' },
  { tenantId: 't2', action: 'Buat Dashboard', userName: 'Budi', timestamp: '2026-11-03T08:00:00' },
  { tenantId: 't2', action: 'Hapus Widget', userName: 'Budi', timestamp: '2026-11-06T08:00:00' },
];

test('tanpa penyaring: semua instansi, terbaru dulu', () => {
  const hasil = saringAudit(logs);
  assert.equal(hasil.length, 4);
  assert.equal(hasil[0].timestamp, '2026-11-06T08:00:00');
  assert.equal(hasil[3].timestamp, '2026-11-01T08:00:00');
});

test("'semua' sama dengan lintas instansi", () => {
  assert.equal(saringAudit(logs, { tenantId: 'semua' }).length, 4);
});

test('satu instansi hanya mengembalikan log instansi itu', () => {
  const hasil = saringAudit(logs, { tenantId: 't1' });
  assert.equal(hasil.length, 2);
  assert.ok(hasil.every((l) => l.tenantId === 't1'));
});

test('instansi tanpa log mengembalikan kosong, bukan semua log', () => {
  assert.deepEqual(saringAudit(logs, { tenantId: 't9' }), []);
});

test('penyaring aksi tidak membedakan huruf besar/kecil', () => {
  assert.equal(saringAudit(logs, { aksi: 'buat' }).length, 2);
  assert.equal(saringAudit(logs, { aksi: 'BUAT' }).length, 2);
  assert.equal(saringAudit(logs, { aksi: 'hapus' }).length, 1);
});

test('penyaring aksi berupa spasi dianggap kosong', () => {
  assert.equal(saringAudit(logs, { aksi: '   ' }).length, 4);
});

test('penyaring pengguna bekerja sama seperti aksi', () => {
  assert.equal(saringAudit(logs, { pengguna: 'budi' }).length, 2);
});

test('rentang waktu memakai batas inklusif di kedua ujung', () => {
  const hasil = saringAudit(logs, { dari: '2026-11-03T08:00:00', sampai: '2026-11-05T08:00:00' });
  assert.deepEqual(
    hasil.map((l) => l.timestamp),
    ['2026-11-05T08:00:00', '2026-11-03T08:00:00']
  );
});

test('penyaring gabungan: instansi + aksi', () => {
  assert.equal(saringAudit(logs, { tenantId: 't2', aksi: 'dashboard' }).length, 1);
});

test('batas baris dipotong setelah diurutkan, bukan sebelum', () => {
  const hasil = saringAudit(logs, { batas: 2 });
  assert.equal(hasil.length, 2);
  assert.equal(hasil[0].timestamp, '2026-11-06T08:00:00');
});

test('batas tidak sah memakai batas bawaan', () => {
  assert.equal(saringAudit(logs, { batas: 0 }).length, 4);
  assert.equal(saringAudit(logs, { batas: Number.NaN }).length, 4);
});

test('log tanpa waktu tidak membuang log lain', () => {
  const campur = [...logs, { tenantId: 't1', action: 'Login', userName: 'Salman' }];
  const hasil = saringAudit(campur, { tenantId: 't1' });
  assert.equal(hasil.length, 3);
  assert.equal(hasil[2].action, 'Login', 'log tanpa waktu ada di urutan akhir');
});

test('pilihan instansi: Admin Aiones mendapat "semua" + seluruh instansi', () => {
  const p = pilihanInstansiAudit('superadmin', 't1', [
    { id: 't1', name: 'Tirta Moedal' },
    { id: 't2', name: 'PAM JAYA' },
  ]);
  assert.deepEqual(p.map((x) => x.id), ['semua', 't1', 't2']);
});

test('pilihan instansi: Admin Instansi hanya instansinya sendiri', () => {
  const p = pilihanInstansiAudit('admin', 't2', [
    { id: 't1', name: 'Tirta Moedal' },
    { id: 't2', name: 'PAM JAYA' },
  ]);
  assert.deepEqual(p.map((x) => x.id), ['t2']);
});

test('pilihan instansi: user tanpa instansi tidak mendapat pilihan', () => {
  assert.deepEqual(pilihanInstansiAudit('pengguna', undefined, [{ id: 't1' }]), []);
});
