import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saranPertanyaan, kalimatSaran, SARAN_UMUM } from '../src/services/chat/saranPertanyaan';

const b = (nama: string, kategori: string, extra: Record<string, unknown> = {}) => ({ nama, kategori, ...extra }) as any;

test('tanpa butir memakai saran umum tanpa istilah laba bersih', () => {
  const hasil = saranPertanyaan([]);
  assert.deepEqual(hasil, SARAN_UMUM);
  assert.ok(hasil.every((s) => !/laba bersih|total aset/i.test(s)));
});

test('kalimat menyesuaikan bentuk data', () => {
  assert.equal(kalimatSaran(b('Pendapatan', 'Keuangan', { nilai: 10, periode: 'Sept 2026' })), 'Berapa Pendapatan Sept 2026?');
  assert.equal(kalimatSaran(b('laba rugi jan-Sept', 'Keuangan', { seri: [{ nama: 'x', data: [1] }] })), 'Bagaimana tren laba rugi jan-Sept?');
  assert.equal(kalimatSaran(b('Daftar Piutang', 'Piutang', { tabel: { kolom: [], baris: [] } })), 'Tampilkan rincian Daftar Piutang');
});

test('bergiliran per kategori dan dibatasi maks', () => {
  const hasil = saranPertanyaan(
    [
      b('Pendapatan', 'Keuangan', { nilai: 1 }),
      b('Beban', 'Keuangan', { nilai: 2 }),
      b('Piutang Usaha', 'Piutang', { nilai: 3 }),
      b('Jumlah Pelanggan', 'Operasional', { nilai: 4 }),
      b('Biaya Pemasaran', 'Keuangan', { nilai: 5 }),
    ],
    3
  );
  assert.deepEqual(hasil, ['Berapa Pendapatan?', 'Berapa Piutang Usaha?', 'Berapa Jumlah Pelanggan?']);
});

test('nama total nol, duplikat, dan terlalu panjang dilewati', () => {
  const hasil = saranPertanyaan([
    b('laba rugi · Jumlah, total 0', 'Keuangan', { nilai: 0 }),
    b('Pendapatan', 'Keuangan', { nilai: 1 }),
    b('pendapatan', 'Keuangan', { nilai: 2 }),
    b('x'.repeat(80), 'Keuangan', { nilai: 3 }),
  ]);
  assert.deepEqual(hasil, ['Berapa Pendapatan?']);
});
