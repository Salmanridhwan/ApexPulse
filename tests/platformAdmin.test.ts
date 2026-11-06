/**
 * PANEL ADMIN AIONES — aturan murni.
 *
 * Dua hal yang diuji: siapa melihat tab apa, dan penjagaan agar akun Admin
 * Aiones terakhir tidak bisa dihapus/diturunkan (kalau itu terjadi, tidak ada
 * lagi yang bisa mengelola platform lewat aplikasi).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ADMIN_TABS, tabUntukPeran } from '../src/components/adminTabs';
import { bolehTurunkanSuperadmin, daftarSuperadmin } from '../src/services/auth/peran';
import { kuotaPerInstansi, ringkasPlatform } from '../src/services/admin/platform';

const semuaTab = ADMIN_TABS.map((t) => t.id);

test('Admin Aiones melihat semua tab', () => {
  assert.deepEqual(
    tabUntukPeran('superadmin').map((t) => t.id),
    semuaTab
  );
});

test('Admin Instansi tidak melihat tab lintas instansi', () => {
  const id = tabUntukPeran('admin').map((t) => t.id);
  assert.ok(!id.includes('tenants'), 'daftar instansi lain tidak boleh terlihat');
  assert.ok(!id.includes('rag'), 'konfigurasi RAG platform tidak boleh terlihat');
  assert.ok(!id.includes('kuota'), 'kuota AI semua instansi tidak boleh terlihat');
  assert.ok(!id.includes('audit'), 'audit lintas instansi tidak boleh terlihat');
});

test('Admin Instansi tetap punya tab untuk urusan instansinya', () => {
  const id = tabUntukPeran('admin').map((t) => t.id);
  assert.ok(id.includes('overview'));
  assert.ok(id.includes('users'));
});

test('User tidak melihat tab panel admin sama sekali', () => {
  assert.deepEqual(tabUntukPeran('pengguna'), []);
  assert.deepEqual(tabUntukPeran(undefined), []);
});

test('setiap tab punya penanda peran yang sah', () => {
  for (const t of ADMIN_TABS) {
    assert.ok(t.peran === 'admin' || t.peran === 'superadmin', `tab ${t.id} tanpa peran`);
  }
});

test('superadmin terakhir tidak boleh diturunkan', () => {
  const hasil = bolehTurunkanSuperadmin(
    [
      { id: 'u1', role: 'superadmin' },
      { id: 'u2', role: 'admin' },
    ],
    'u1'
  );
  assert.equal(hasil.boleh, false);
  assert.match(String(hasil.alasan), /terakhir/i);
});

test('superadmin boleh diturunkan bila masih ada yang lain', () => {
  const hasil = bolehTurunkanSuperadmin(
    [
      { id: 'u1', role: 'superadmin' },
      { id: 'u2', role: 'superadmin' },
    ],
    'u1'
  );
  assert.equal(hasil.boleh, true);
});

test('akun biasa tidak terpengaruh penjagaan ini', () => {
  const hasil = bolehTurunkanSuperadmin(
    [
      { id: 'u1', role: 'superadmin' },
      { id: 'u2', role: 'admin' },
    ],
    'u2'
  );
  assert.equal(hasil.boleh, true);
});

test('daftarSuperadmin hanya mengembalikan superadmin', () => {
  assert.deepEqual(
    daftarSuperadmin([
      { id: 'a', role: 'superadmin' },
      { id: 'b', role: 'admin' },
      { id: 'c' },
    ]).map((u) => u.id),
    ['a']
  );
});

const bahan = {
  tenants: [{ id: 't1', name: 'Tirta Moedal' }, { id: 't2', name: 'PAM JAYA' }],
  users: [
    { tenantId: 't1', role: 'superadmin' },
    { tenantId: 't1', role: 'admin' },
    { tenantId: 't1', role: 'pengguna' },
    { tenantId: 't2', role: 'pengguna' },
    { tenantId: 't2' },
  ],
  dashboards: [{ tenantId: 't1' }, { tenantId: 't2' }, { tenantId: 't2' }],
  permintaan: [
    { tenantId: 't1', status: 'baru' },
    { tenantId: 't1', status: 'selesai' },
    { tenantId: 't2', status: 'perlu_data' },
    { tenantId: 't2', status: 'ditolak' },
  ],
  analisis: [
    { tenantId: 't1', status: 'selesai', metode: 'rag-extract', dibuatPada: '2026-11-06T02:00:00' },
    { tenantId: 't1', status: 'gagal', metode: 'rag-extract', dibuatPada: '2026-11-06T03:00:00' },
    { tenantId: 't2', status: 'tertunda-kuota', metode: 'rag-extract', dibuatPada: '2026-11-06T04:00:00' },
    { tenantId: 't2', status: 'selesai', metode: 'tabel-lokal', dibuatPada: '2026-11-06T05:00:00' },
  ],
  butir: [
    { tenantId: 't1', status: 'disetujui' },
    { tenantId: 't1', status: 'draf' },
    { tenantId: 't2', status: 'ditolak' },
  ],
  sekarang: new Date('2026-11-06T10:00:00').getTime(),
};

test('ringkasan menghitung akun per peran, termasuk akun tanpa peran', () => {
  const r = ringkasPlatform(bahan);
  assert.equal(r.jumlahInstansi, 2);
  assert.equal(r.akun.total, 5);
  assert.equal(r.akun.superadmin, 1);
  assert.equal(r.akun.admin, 1);
  assert.equal(r.akun.pengguna, 3, 'akun tanpa peran dihitung pengguna');
});

test('ringkasan memisahkan permintaan yang perlu ditindaklanjuti', () => {
  const r = ringkasPlatform(bahan);
  assert.equal(r.permintaan.total, 4);
  assert.equal(r.permintaan.perluTindakan, 2);
  assert.equal(r.permintaan.selesai, 1);
});

test('ringkasan menghitung analisis per status dan butir per persetujuan', () => {
  const r = ringkasPlatform(bahan);
  assert.equal(r.analisis.total, 4);
  assert.equal(r.analisis.selesai, 2);
  assert.equal(r.analisis.gagal, 1);
  assert.equal(r.analisis.tertundaKuota, 1);
  assert.equal(r.butir.total, 3);
  assert.equal(r.butir.disetujui, 1);
});

test('kuota harian hanya menghitung analisis RAG yang berhasil atau berjalan', () => {
  const r = ringkasPlatform(bahan);
  // t1: satu rag-extract selesai; yang gagal TIDAK dihitung (gangguan layanan
  // bukan kesalahan instansi). t2: tertunda-kuota & tabel-lokal tidak dihitung.
  assert.equal(r.kuotaHariIni.terpakai, 1);
  assert.equal(r.kuotaHariIni.kapasitas, 40);
});

test('kuotaPerInstansi memisahkan pemakaian antar instansi', () => {
  const per = kuotaPerInstansi(bahan);
  const t1 = per.find((x) => x.tenantId === 't1')!;
  const t2 = per.find((x) => x.tenantId === 't2')!;
  assert.equal(t1.terpakai, 1, 'analisis gagal tidak memakai kuota');
  assert.equal(t2.terpakai, 0, 'instansi dengan analisis tertunda kuota tidak memakai kuota');
  assert.equal(t1.sisa, 19);
});

test('instansi tanpa analisis tetap muncul dengan sisa penuh', () => {
  const per = kuotaPerInstansi({ ...bahan, tenants: [{ id: 't9', name: 'Baru' }] });
  assert.equal(per[0].terpakai, 0);
  assert.equal(per[0].sisa, 20);
});
