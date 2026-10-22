import test from 'node:test';
import assert from 'node:assert/strict';
import { keCsv, selCsv } from '../src/services/http/csv';

const kolom = [
  { kunci: 'waktu' as const, judul: 'Waktu' },
  { kunci: 'aksi' as const, judul: 'Aksi' },
];

test('csv: sel biasa tidak dibungkus kutip', () => {
  assert.equal(selCsv('Halo'), 'Halo');
  assert.equal(selCsv(12), '12');
  assert.equal(selCsv(null), '');
  assert.equal(selCsv(undefined), '');
});

test('csv: sel berisi koma/kutip/baris baru dibungkus & kutip digandakan', () => {
  assert.equal(selCsv('Jakarta, Indonesia'), '"Jakarta, Indonesia"');
  assert.equal(selCsv('kata "penting"'), '"kata ""penting"""');
  assert.equal(selCsv('baris1\nbaris2'), '"baris1\nbaris2"');
  assert.equal(selCsv('a;b'), '"a;b"');
});

test('csv: judul + baris tersusun dengan CRLF dan BOM', () => {
  const csv = keCsv([{ waktu: '2026-01-02', aksi: 'Ubah, widget' }], kolom);
  assert.ok(csv.startsWith('\uFEFF'), 'diawali BOM agar Excel membaca UTF-8');
  assert.equal(csv, '\uFEFFWaktu,Aksi\r\n2026-01-02,"Ubah, widget"\r\n');
});

test('csv: daftar kosong tetap menghasilkan baris judul', () => {
  assert.equal(keCsv([], kolom), '\uFEFFWaktu,Aksi\r\n');
});

test('csv: nilai kosong tidak menggeser kolom', () => {
  const csv = keCsv([{ waktu: '2026-01-02', aksi: '' }], kolom);
  assert.equal(csv.split('\r\n')[1], '2026-01-02,');
});
