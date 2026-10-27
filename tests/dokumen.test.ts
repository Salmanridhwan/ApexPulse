import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adalahPertanyaanDokumen, susunJawabanDokumen } from '../src/services/chat/dokumen';

test('mengenali pertanyaan tentang isi repositori', () => {
  const ya = [
    'bukannya total dokumennya ada 8?',
    'ada berapa dokumen di repositori?',
    'berapa jumlah dokumen?',
    'dokumen apa saja yang ada?',
    'tolong daftar dokumen instansi ini',
    'isi knowledge base saya apa',
    'dokumen di repositori apa saja',
  ];
  for (const t of ya) assert.equal(adalahPertanyaanDokumen(t), true, `harus dikenali: ${t}`);
});

test('tidak membelokkan pertanyaan isi dokumen', () => {
  const tidak = [
    'berapa dokumen SOP yang wajib ada?',
    'berapa jumlah laporan keuangan yang harus dibuat?',
    'apa isi Laporan Tahunan 2024?',
    'buatkan dashboard 10-20 widget',
    'rekomendasi chart untuk NRW',
    '',
  ];
  for (const t of tidak) assert.equal(adalahPertanyaanDokumen(t), false, `jangan dikenali: ${t}`);
});

test('jawaban daftar dokumen memakai angka nyata, bukan karangan', () => {
  const teks = susunJawabanDokumen(
    {
      jumlah: 2,
      dokumen: [
        { nama: 'A.pdf', halaman: 6, potongan: 3, token: 1727, status: 'completed' },
        { nama: 'B.pdf', halaman: 14, potongan: 17, token: 4928, status: 'completed' },
      ],
    },
    'Perumda Air Minum Jaya (PAM JAYA)'
  );
  assert.match(teks, /2 dokumen/);
  assert.match(teks, /A\.pdf/);
  assert.match(teks, /B\.pdf/);
  assert.match(teks, /1\.727 token/);
  assert.match(teks, /Perumda Air Minum Jaya/);
});

test('daftar kosong / gagal dibaca tidak mengarang jumlah', () => {
  const teks = susunJawabanDokumen({ jumlah: 0, dokumen: [], catatan: 'Layanan RAG menjawab HTTP 502' });
  assert.match(teks, /belum bisa membaca daftar dokumen/i);
  assert.match(teks, /502/);
  assert.doesNotMatch(teks, /\b\d+ dokumen\b/);
});
