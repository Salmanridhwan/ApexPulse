import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adalahSapaan } from '../src/services/chat/sapaan';
import { putusanJawaban } from '../src/services/chat/jawaban';

/**
 * Sapaan menentukan apakah sebuah pesan WAJIB bersumber dokumen atau tidak.
 * Salah menilai "pertanyaan data" sebagai "sapaan" = penjaga sumber dilewati,
 * dan model bebas menjawab tanpa rujukan. Itu akar keluhan "asisten menjawab
 * di luar dokumen", jadi batasnya dikunci di sini.
 */

test('sapaan & basa-basi dikenali', () => {
  const ya = [
    'halo',
    'Hai!',
    'selamat pagi',
    'assalamualaikum',
    'pagi min',
    'halo kak',
    'halo apa kabar',
    'apa kabar?',
    'terima kasih',
    'makasih banyak ya',
    'oke terima kasih',
    'thanks',
    'siapa kamu?',
    'kamu bisa apa',
    'apa ini',
    'test',
    'tes chat',
  ];
  for (const p of ya) assert.equal(adalahSapaan(p), true, `harus dianggap sapaan: "${p}"`);
});

test('pertanyaan data TIDAK dianggap sapaan', () => {
  const tidak = [
    'berapa nilai aset dan apa ini sudah diaudit?',
    'halo, berapa jumlah pelanggan 2024?',
    'terima kasih, sekarang tampilkan realisasi investasi',
    'apa ini yang dimaksud target pendapatan?',
    'siapa kamu dan berapa gaji direksi',
    'jelaskan laporan keuangan 2025',
    'bagaimana cara buat dashboard?',
    'apa itu dashboard?',
    'tampilkan laba bersih',
    'berapa persen capaian target pendapatan',
    '',
    '   ',
  ];
  for (const p of tidak) assert.equal(adalahSapaan(p), false, `TIDAK boleh dianggap sapaan: "${p}"`);
});

test('pesan panjang dengan kata sapaan di awal tetap pertanyaan', () => {
  const pesan = 'halo selamat pagi saya ingin tahu bagaimana realisasi pendapatan tahun lalu dan apa penyebab penurunannya';
  assert.equal(adalahSapaan(pesan), false);
});

test('angka selalu menandakan pertanyaan data', () => {
  assert.equal(adalahSapaan('halo 2024'), false);
  assert.equal(adalahSapaan('pagi, 15%'), false);
});

test('sapaan + pertanyaan tetap ditolak walau pendek', () => {
  assert.equal(adalahSapaan('halo berapa pelanggan'), false);
  assert.equal(adalahSapaan('hai, apa target kita'), false);
});

test('rantai penjaga: sapaan boleh, pertanyaan tanpa sumber tidak', () => {
  // Sapaan: boleh tampil walau tanpa sitasi.
  assert.equal(
    putusanJawaban({ citationsCount: 0, jumlahPotongan: 0, sapaan: adalahSapaan('halo'), instansi: 'PAM JAYA' }).alasan,
    'sapaan'
  );
  // Pertanyaan data tanpa sitasi: ditahan, dan pesannya jujur menyebut instansi.
  const tanya = 'berapa nilai aset dan apa ini sudah diaudit?';
  const putusan = putusanJawaban({
    citationsCount: 0,
    jumlahPotongan: 0,
    sapaan: adalahSapaan(tanya),
    instansi: 'PAM JAYA',
  });
  assert.equal(putusan.tampilkan, false);
  assert.equal(putusan.alasan, 'tanpa-sumber');
  assert.ok(putusan.pesan?.includes('PAM JAYA'));
  assert.ok(putusan.pesan?.includes('tidak menemukan jawaban'));
});

test('layanan menyatakan tidak grounded → jawaban ditahan', () => {
  // Walau ada potongan dokumen, `grounded: false` tetap menang.
  const putusan = putusanJawaban({
    citationsCount: 3,
    jumlahPotongan: 3,
    grounded: false,
    sapaan: false,
  });
  assert.equal(putusan.tampilkan, false);
});
