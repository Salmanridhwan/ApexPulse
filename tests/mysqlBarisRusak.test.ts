import test from 'node:test';
import assert from 'node:assert/strict';
import { daftarBarisRusak, nilaiMentah, uraiData, uraiDaftar } from '../src/services/store/mysqlStore';

/**
 * Kasus nyata di produksi: satu baris tabel berisi id mentah
 * ("tenant-1792583458105") alih-alih JSON. Dulu itu menjatuhkan SELURUH
 * pemuatan state sehingga server pindah diam-diam ke data/db.json.
 */
test('baris rusak tidak menjatuhkan baris lain', () => {
  const rows = [
    { data: JSON.stringify({ id: 'a', nama: 'Instansi A' }) },
    { data: 'tenant-1792583458105' },
    { data: JSON.stringify({ id: 'b', nama: 'Instansi B' }) },
  ];
  const hasil = uraiDaftar<{ id: string; nama: string }>(rows, 'tenants');
  assert.equal(hasil.length, 2, 'dua baris sehat tetap terbaca');
  assert.deepEqual(
    hasil.map((t) => t.id),
    ['a', 'b']
  );
});

test('baris rusak tercatat untuk dilaporkan di /health', () => {
  uraiData('bukan-json-sama-sekali', 'uji-lapor');
  const catat = daftarBarisRusak().find((b) => b.tabel === 'uji-lapor');
  assert.ok(catat, 'baris rusak harus tercatat');
  assert.match(catat!.cuplikan, /bukan-json/);
  assert.ok(catat!.waktu, 'ada cap waktu');
  assert.ok(catat!.galat.length > 0, 'alasan galat disimpan');
});

test('satu baris rusak tidak dicatat berkali-kali', () => {
  uraiData('dobel', 'uji-dobel');
  uraiData('dobel', 'uji-dobel');
  const jumlah = daftarBarisRusak().filter((b) => b.tabel === 'uji-dobel').length;
  assert.equal(jumlah, 1, 'tidak membanjiri daftar');
});

test('JSON sah tetap diurai apa adanya', () => {
  assert.deepEqual(uraiData('{"a":1}', 'x'), { a: 1 });
  assert.equal(uraiData('"teks"', 'x'), 'teks');
  assert.equal(uraiData('null', 'x'), null);
});

test('nilai yang sudah berupa objek (kolom JSON mysql2) diteruskan', () => {
  const obj = { a: 1 };
  assert.equal(uraiData(obj, 'x'), obj);
});

test('teks polos dikenali sebagai nilai yang bisa dipulihkan', () => {
  // Kasus nyata: kolom `data` tabel baris berisi id tanpa tanda kutip.
  assert.equal(nilaiMentah('tenant-1792583458105'), 'tenant-1792583458105');
  assert.equal(nilaiMentah('  token-abc  '), 'token-abc');
  assert.equal(nilaiMentah('{"a":1'), null, 'sisa JSON rusak tidak ditebak');
  assert.equal(nilaiMentah('[1,2'), null);
  assert.equal(nilaiMentah('   '), null);
  assert.equal(nilaiMentah(123), null);
});
