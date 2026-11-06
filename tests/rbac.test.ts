/**
 * GERBANG PERAN — matriks izin tiga peran.
 *
 * Latar: aplikasi ini semula hanya punya `admin` dan `pengguna`, dan seluruh
 * endpoint tulis dashboard hanya memeriksa "sudah login". Akibatnya `pengguna`
 * bisa membuat dan menghapus dashboard. Alur baru memisahkan peran:
 *
 * - `superadmin` (Admin Aiones) — lintas instansi, konfigurasi platform.
 * - `admin` (Admin Instansi) — menyusun dashboard instansinya.
 * - `pengguna` (User) — mengajukan permintaan data, mengunggah dokumen, chat
 *   tanya jawab. TIDAK menyusun dashboard.
 *
 * Tes ini menjaga dua hal yang mudah rusak tanpa disadari:
 * 1. `superadmin` tidak boleh diperlakukan sebagai `pengguna` (pernah terjadi
 *    pada `normalisasiPeran` yang hanya mengenal `admin`).
 * 2. Setiap peran wajib punya label, supaya penambahan peran berikutnya tidak
 *    diam-diam menampilkan label kosong di UI.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { bolehMenyusunDashboard, isAdminRole, isSuperadmin, labelPeran } from '../src/services/auth/peran';
import { LABEL_PERAN, normalisasiPeran, normalisasiPeranAkun } from '../src/services/laporan/alur';
import type { UserRole } from '../src/types';

const SEMUA_PERAN: UserRole[] = ['superadmin', 'admin', 'pengguna'];

test('hanya admin dan superadmin yang dianggap pengelola', () => {
  assert.equal(isAdminRole('superadmin'), true);
  assert.equal(isAdminRole('admin'), true);
  assert.equal(isAdminRole('pengguna'), false);
});

test('nilai peran tak dikenal tidak pernah menaikkan hak akses', () => {
  for (const aneh of [undefined, null, '', 'Admin', 'SUPERADMIN', 'analis', 'direksi', 1, {}]) {
    assert.equal(isAdminRole(aneh), false, `nilai ${String(aneh)} tidak boleh lolos sebagai admin`);
    assert.equal(bolehMenyusunDashboard(aneh as any), false);
  }
});

test('hanya superadmin yang dianggap Admin Aiones', () => {
  assert.equal(isSuperadmin('superadmin'), true);
  assert.equal(isSuperadmin('admin'), false);
  assert.equal(isSuperadmin('pengguna'), false);
});

test('user tidak boleh menyusun dashboard, admin instansi dan admin aiones boleh', () => {
  assert.equal(bolehMenyusunDashboard('pengguna'), false);
  assert.equal(bolehMenyusunDashboard('admin'), true);
  assert.equal(bolehMenyusunDashboard('superadmin'), true);
});

test('label peran memakai istilah yang dipakai pemilik', () => {
  assert.equal(labelPeran('superadmin'), 'Admin Aiones');
  assert.equal(labelPeran('admin'), 'Admin Instansi');
  assert.equal(labelPeran('pengguna'), 'User');
  assert.equal(labelPeran(undefined), 'User');
});

test('setiap peran punya label, tidak ada yang kosong', () => {
  for (const peran of SEMUA_PERAN) {
    const label = LABEL_PERAN[peran];
    assert.equal(typeof label, 'string');
    assert.ok(label.trim().length > 0, `label untuk ${peran} tidak boleh kosong`);
  }
});

test('normalisasiPeranAkun mempertahankan superadmin', () => {
  assert.equal(normalisasiPeranAkun('superadmin'), 'superadmin');
  assert.equal(normalisasiPeranAkun('admin'), 'admin');
  assert.equal(normalisasiPeranAkun('pengguna'), 'pengguna');
});

test('peran lama tetap turun ke pengguna, bukan naik', () => {
  for (const lama of ['analis', 'direksi', 'unknown', '', null, undefined]) {
    assert.equal(normalisasiPeranAkun(lama), 'pengguna');
    assert.equal(normalisasiPeran(lama), 'pengguna');
  }
});

test('tahap alur laporan tidak pernah memakai superadmin', () => {
  // Alur verifikasi laporan hanya mengenal admin/pengguna. Kalau suatu saat ada
  // data alur bertahap `superadmin`, tahap itu tidak boleh dianggap sah karena
  // tidak ada peran yang mencocokinya saat pemeriksaan.
  assert.equal(normalisasiPeran('superadmin'), 'pengguna');
});
