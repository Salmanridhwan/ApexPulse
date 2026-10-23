import test from 'node:test';
import assert from 'node:assert/strict';
import {
  angkaTakBersumber,
  bacaAngka,
  ekstrakAngka,
  pesanAngkaTakBersumber,
} from '../src/services/chat/angka';

test('angka: format Indonesia dibaca benar', () => {
  assert.equal(bacaAngka('1.234.567,89'), 1234567.89);
  assert.equal(bacaAngka('12,5'), 12.5);
  assert.equal(bacaAngka('3.14'), 3.14, 'dua digit di belakang titik = desimal');
  assert.equal(bacaAngka('2024'), 2024);
  assert.equal(bacaAngka('bukan angka'), null);
});

test('angka: skala kata juta/miliar/ribu ikut dihitung', () => {
  const a = ekstrakAngka('Pendapatan Rp 1,2 miliar dan biaya 350 juta, sisa 12,5%');
  const nilai = a.map((x) => x.nilai);
  assert.ok(nilai.includes(1_200_000_000), '1,2 miliar');
  assert.ok(nilai.includes(350_000_000), '350 juta');
  assert.ok(nilai.includes(12.5), '12,5%');
});

test('angka: tahun dan penanda daftar tidak dianggap klaim', () => {
  const a = ekstrakAngka('1. Ringkasan 2024\n2. Rincian 2025');
  assert.deepEqual(a, [], 'tahun dan nomor daftar diabaikan');
});

test('angka: angka kecil hanya diperiksa bila persen', () => {
  const a = ekstrakAngka('Ada 3 dokumen, capaian 7%');
  assert.deepEqual(a.map((x) => x.nilai), [7], 'hanya persen yang dinilai');
});

test('angka: angka yang ada di potongan dokumen tidak ditandai', () => {
  const lepas = angkaTakBersumber({
    jawaban: 'Realisasi 2024 sebesar Rp 1,2 miliar atau 87,5% dari target.',
    potongan: ['Realisasi pendapatan 1.200.000.000 tercapai 87,5 persen pada 2024.'],
  });
  assert.deepEqual(lepas, [], 'semua angka tertelusur ke dokumen');
});

test('angka: angka karangan ditandai', () => {
  const lepas = angkaTakBersumber({
    jawaban: 'Realisasi naik 12,5% menjadi Rp 4,7 miliar.',
    potongan: ['Realisasi pendapatan 1.200.000.000 pada periode ini.'],
  });
  assert.equal(lepas.length, 2);
  assert.deepEqual(lepas.map((x) => x.teks).sort(), ['12,5', '4,7'].sort());
});

test('angka: angka yang disebut pengguna di pertanyaan tidak ditandai', () => {
  const lepas = angkaTakBersumber({
    jawaban: 'Untuk 2023 angkanya tidak tersedia di dokumen ini.',
    potongan: ['Laporan tahunan memuat ringkasan kinerja.'],
    pertanyaan: 'Bagaimana kinerja 2023?',
  });
  assert.deepEqual(lepas, []);
});

test('angka: pembulatan kecil tetap dianggap cocok', () => {
  const lepas = angkaTakBersumber({
    jawaban: 'Tingkat layanan 92,4%.',
    potongan: ['tingkat layanan 92,41 persen'],
  });
  assert.deepEqual(lepas, [], 'selisih 0,01 masih dalam toleransi');
});

test('angka: catatan jujur menyebut angka yang perlu dicek', () => {
  const pesan = pesanAngkaTakBersumber([{ nilai: 12.5, teks: '12,5' }]);
  assert.match(pesan, /12,5/);
  assert.match(pesan, /periksa ulang/i);
  assert.equal(pesanAngkaTakBersumber([]), '', 'tanpa angka tidak ada catatan');
});
