/**
 * UJI DETEKSI NIAT UBAH HALAMAN.
 *
 * Yang dijaga: pertanyaan biasa tidak boleh diperlakukan sebagai perintah ubah
 * halaman, dan permintaan yang jelas tidak boleh lolos jadi pertanyaan.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { niatUbahHalaman, ringkasNiat } from '../src/services/analisis/niatUbahHalaman';

test('permintaan menambah kartu dikenali', () => {
  assert.equal(niatUbahHalaman('Tambah kartu tren pendapatan dari dokumen tadi'), true);
  assert.equal(niatUbahHalaman('tolong tambahkan grafik pendapatan'), true);
  assert.equal(niatUbahHalaman('tambahi tabel rincian biaya'), true);
});

test('permintaan mengubah dan menghapus dikenali', () => {
  assert.equal(niatUbahHalaman('Ubah grafik ke diagram garis'), true);
  assert.equal(niatUbahHalaman('ganti judul kartu jadi Pendapatan Usaha'), true);
  assert.equal(niatUbahHalaman('hapus kartu yang kosong'), true);
  assert.equal(niatUbahHalaman('hilangkan tabel ini'), true);
});

test('permintaan menata ulang dikenali', () => {
  assert.equal(niatUbahHalaman('urutkan kartu dari yang paling penting'), true);
  assert.equal(niatUbahHalaman('susun ulang halaman ini'), true);
  assert.equal(niatUbahHalaman('pindahkan grafik ke atas'), true);
});

test('pertanyaan biasa tidak dikenali sebagai perintah', () => {
  assert.equal(niatUbahHalaman('Berapa total aset PDAM tahun 2025?'), false);
  assert.equal(niatUbahHalaman('Apa saja indikator kinerja utama?'), false);
  assert.equal(niatUbahHalaman('Bagaimana pertumbuhan laba bersih tahun ini?'), false);
  assert.equal(niatUbahHalaman('Siapa yang menyusun laporan ini?'), false);
});

test('kalimat tanya di awal menang atas kata kerja', () => {
  assert.equal(niatUbahHalaman('berapa kartu yang perlu ditambah?'), false);
});

test('tetapi kalimat menyuruh tetap dianggap perintah walau memuat kata tanya', () => {
  assert.equal(niatUbahHalaman('tolong tambahkan grafik, berapa lama prosesnya?'), true);
  assert.equal(niatUbahHalaman('bisakah ubah grafik ini jadi batang?'), true);
});

test('membuat dashboard baru bukan urusan halaman ini', () => {
  assert.equal(niatUbahHalaman('buat dashboard baru untuk keuangan'), false);
  assert.equal(niatUbahHalaman('buatkan dashboard kinerja 2026'), false);
  assert.equal(niatUbahHalaman('saya mau halaman baru'), false);
});

test('kata "tambahan" bukan perintah menambah', () => {
  assert.equal(niatUbahHalaman('data tambahan apa yang masih kurang?'), false);
  assert.equal(niatUbahHalaman('saya butuh tambahan data'), false);
});

test('pesan kosong bukan perintah', () => {
  assert.equal(niatUbahHalaman(''), false);
  assert.equal(niatUbahHalaman('   '), false);
});

test('huruf besar/kecil tidak berpengaruh', () => {
  assert.equal(niatUbahHalaman('TAMBAH KARTU BARU'), true);
  assert.equal(niatUbahHalaman('Hapus Tabel Ini'), true);
});

test('ringkasan niat memberi keterangan sesuai keputusan', () => {
  assert.match(ringkasNiat('tambah kartu tren'), /usulan/i);
  assert.match(ringkasNiat('berapa total aset?'), /pertanyaan/i);
});
