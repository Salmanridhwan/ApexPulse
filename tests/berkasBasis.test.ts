import test from 'node:test';
import assert from 'node:assert/strict';
import { adalahDokumenSambutan, gabungDokumenBasis } from '../src/services/berkas/gabungBasis';
import type { BerkasKMS } from '../src/types';

const berkasKms = (judul: string): BerkasKMS =>
  ({
    id: `doc-1-${judul}`,
    organizationId: 'org-1',
    title: judul,
    fileType: 'PDF',
    uploadedAt: '2026-10-22T00:00:00.000Z',
  }) as BerkasKMS;

test('dokumen sambutan dikenali dari awalannya', () => {
  assert.equal(adalahDokumenSambutan('Info Project - PAM JAYA.pdf'), true);
  assert.equal(adalahDokumenSambutan('  Info Project - BJB.pdf'), true);
  assert.equal(adalahDokumenSambutan('laporan-tahunan-Bank-Bjb 2025.pdf'), false);
  assert.equal(adalahDokumenSambutan(undefined), false);
  assert.equal(adalahDokumenSambutan(null), false);
});

test('kasus BJB: basis 5 dokumen, 1 sambutan, repositori kosong', () => {
  const dokumen = [
    { id: 'd1', nama: 'laporan-tahunan-Bank-Bjb 2025.pdf' },
    { id: 'd2', nama: 'laporan-tahunan-Bank-Bjb 2024.pdf' },
    { id: 'd3', nama: 'laporan-tahunan-Bank-Bjb 2023.pdf' },
    { id: 'd4', nama: 'laporan-tahunan-Bank-Bjb 2022.pdf' },
    { id: 'd5', nama: 'Info Project - Bank BJB.pdf' },
  ];
  const hasil = gabungDokumenBasis([], dokumen);
  assert.equal(hasil.berkas.length, 4, 'hanya 4 berkas instansi yang tampil');
  assert.equal(hasil.jumlahBasis, 5, 'angka basis tetap jujur: 5');
  assert.equal(hasil.jumlahSambutan, 1);
  assert.equal(hasil.jumlahDitambah, 4);
  assert.match(hasil.catatan || '', /5 dokumen/);
  assert.match(hasil.catatan || '', /dokumen sambutan/);
  assert.doesNotMatch(hasil.catatan || '', /belum tampil/, 'tidak ada yang tertahan');
  assert.equal(hasil.berkas[0].hanyaBasis, true, 'ditandai sebagai berkas dari basis');
});

test('berkas yang sudah ada di repositori tidak digandakan', () => {
  const hasil = gabungDokumenBasis([berkasKms('Laporan Tahunan 2025')], [
    { id: 'd1', nama: 'Laporan Tahunan 2025' },
    { id: 'd2', nama: 'Laporan Tahunan 2024' },
  ]);
  assert.equal(hasil.berkas.length, 2, 'satu dari repositori + satu tambahan');
  assert.equal(hasil.jumlahDitambah, 1);
  assert.doesNotMatch(hasil.catatan || '', /belum tampil/, 'dokumen yang cocok bukan "belum tampil"');
});

test('basis tak terbaca: repositori tetap tampil, dengan catatan', () => {
  const hasil = gabungDokumenBasis([berkasKms('Berkas A')], null);
  assert.equal(hasil.berkas.length, 1);
  assert.equal(hasil.jumlahBasis, 0);
  assert.match(hasil.catatan || '', /tidak bisa dibaca/);
});

test('basis kosong tanpa sambutan tidak memunculkan catatan', () => {
  const hasil = gabungDokumenBasis([berkasKms('Berkas A')], []);
  assert.equal(hasil.berkas.length, 1);
  assert.equal(hasil.catatan, undefined, 'tidak ada yang perlu dijelaskan');
});

test('dokumen yang belum masuk daftar disebut apa adanya', () => {
  // Kasus dokumen masih diproses: basis melaporkan 3, dua punya nama, satu kosong.
  const hasil = gabungDokumenBasis([], [
    { id: 'd1', nama: 'a.pdf' },
    { id: 'd2', nama: 'b.pdf' },
    { id: 'd3', nama: '' },
  ]);
  assert.equal(hasil.berkas.length, 3, 'baris kosong tetap ditampilkan sebagai entri');
  assert.equal(hasil.jumlahDitambah, 3);
});
