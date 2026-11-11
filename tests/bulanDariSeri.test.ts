import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bulanDariSeri } from '../src/services/analisis/tanggalSerial';

// Judul kolom "Dec-01" di Excel tersimpan sebagai 37226 (1 Des 2001).
test('bulanDariSeri: judul tanggal Excel dibaca sebagai nama bulan', () => {
  assert.equal(bulanDariSeri(37226), 'Des');
  assert.equal(bulanDariSeri(46093), 'Mar');
});

test('bulanDariSeri: teks, pecahan, dan angka di luar rentang tanggal ditolak', () => {
  assert.equal(bulanDariSeri('Desember'), null);
  assert.equal(bulanDariSeri(37226.5), null);
  assert.equal(bulanDariSeri(12502047106), null);
  assert.equal(bulanDariSeri(2026), null);
  assert.equal(bulanDariSeri(null), null);
});
