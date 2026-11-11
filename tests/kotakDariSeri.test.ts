/**
 * KOTAK SEBARAN UNTUK WIDGET BIASA.
 *
 * Widget dashboard tidak menyimpan sampel mentah, hanya kategori dan nilai.
 * Tanpa cadangan `kotakDariSeri`, memilih bentuk "Kotak sebaran" menghasilkan
 * kartu kosong — inilah yang dijaga tes ini.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { kotakDariSeri } from '../src/components/widgets/chartOptions';

test('tiap seri menjadi satu kotak dengan lima angka yang urut', () => {
  const kotak = kotakDariSeri([
    { name: 'Pendapatan', data: [10, 20, 30, 40, 50] },
    { name: 'Beban', data: [5, 9, 12, 20, 40] },
  ]);
  assert.equal(kotak.length, 2);
  assert.equal(kotak[0].nama, 'Pendapatan');
  const k = kotak[0];
  assert.ok(k.min <= k.q1, 'min tidak boleh melebihi Q1');
  assert.ok(k.q1 <= k.median, 'Q1 tidak boleh melebihi median');
  assert.ok(k.median <= k.q3, 'median tidak boleh melebihi Q3');
  assert.ok(k.q3 <= k.maks, 'Q3 tidak boleh melebihi maksimum');
});

test('seri tanpa angka dilewati, nama kosong diberi label kelompok', () => {
  const kotak = kotakDariSeri([
    { name: '', data: [1, 2, 3] },
    { name: 'Kosong', data: [] },
    { name: 'Bolong', data: [null, undefined, Number.NaN, 7] },
    // Seri dari kanvas memakai `nama`, bukan `name`.
    { nama: 'Realisasi', data: [4, 5, 6] },
  ]);
  assert.equal(kotak.length, 3);
  assert.equal(kotak[0].nama, 'Kelompok 1');
  assert.equal(kotak[1].nama, 'Bolong');
  // Satu angka sah tetap menghasilkan kotak pipih, bukan kartu kosong.
  assert.equal(kotak[1].min, 7);
  assert.equal(kotak[1].maks, 7);
  assert.equal(kotak[2].nama, 'Realisasi');
});
