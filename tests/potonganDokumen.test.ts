import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ambilHalaman,
  bersihkanCachePotongan,
  gabungUnik,
  kueriPenjelajah,
  kumpulkanPotongan,
  urutkanPotongan,
} from '../src/services/rag/potonganDokumen';

const pot = (id: string, isi = `isi ${id}`, halaman?: number) => ({ id, isi, halaman });

test('urutkanPotongan: urut menurut nomor potongan, bukan abjad', () => {
  const hasil = urutkanPotongan([pot('doc_1_chunk_10'), pot('doc_1_chunk_2'), pot('doc_1_chunk_1')]);
  assert.deepEqual(hasil.map((p) => p.id), ['doc_1_chunk_1', 'doc_1_chunk_2', 'doc_1_chunk_10']);
});

test('urutkanPotongan: id tanpa nomor ditaruh di akhir, urut halaman', () => {
  const hasil = urutkanPotongan([
    { id: 'z', isi: 'z', halaman: 2 },
    pot('doc_1_chunk_1'),
    { id: 'a', isi: 'a', halaman: 1 },
  ]);
  assert.equal(hasil[0].id, 'doc_1_chunk_1');
  assert.deepEqual(hasil.slice(1).map((p) => p.id), ['a', 'z']);
});

test('gabungUnik: duplikat dari beberapa kueri hanya muncul sekali', () => {
  const hasil = gabungUnik([pot('c1'), pot('c2')], [pot('c2'), pot('c3')], [pot('c1')]);
  assert.deepEqual(hasil.map((p) => p.id), ['c1', 'c2', 'c3']);
});

test('gabungUnik: potongan tanpa id/isi dibuang', () => {
  const hasil = gabungUnik([{ id: '', isi: 'x' }, { id: 'c1', isi: '' }, pot('c2')]);
  assert.deepEqual(hasil.map((p) => p.id), ['c2']);
});

test('ambilHalaman: pembagian halaman & penjepitan nomor halaman', () => {
  const list = Array.from({ length: 45 }, (_, i) => pot(`c${i + 1}`));
  const h1 = ambilHalaman(list, 1, 20);
  assert.equal(h1.isi.length, 20);
  assert.equal(h1.totalHalaman, 3);
  assert.equal(h1.offset, 0);

  const h3 = ambilHalaman(list, 3, 20);
  assert.equal(h3.isi.length, 5);
  assert.equal(h3.offset, 40);

  const terlaluBesar = ambilHalaman(list, 99, 20);
  assert.equal(terlaluBesar.halaman, 3, 'halaman dijepit ke halaman terakhir');

  const terlaluKecil = ambilHalaman(list, 0, 20);
  assert.equal(terlaluKecil.halaman, 1);
});

test('ambilHalaman: daftar kosong tetap menghasilkan satu halaman', () => {
  const h = ambilHalaman([], 2, 20);
  assert.equal(h.total, 0);
  assert.equal(h.totalHalaman, 1);
  assert.equal(h.halaman, 1);
  assert.deepEqual(h.isi, []);
});

test('kueriPenjelajah: beberapa variasi, bersih dari pemisah nama berkas', () => {
  const kueri = kueriPenjelajah('Laporan_Tahunan-2025.pdf');
  assert.ok(kueri.length >= 4);
  assert.ok(kueri[0].includes('Laporan Tahunan 2025'));
  assert.ok(!kueri.some((k) => k.includes('_')));
  assert.deepEqual(kueriPenjelajah('   '), []);
});

test('kumpulkanPotongan: hanya potongan dokumen yang diminta, dedupe, urut', async () => {
  bersihkanCachePotongan();
  const jawaban: Record<string, any> = {
    'laporan tahunan': { data: { results: [
      { document_id: 'd1', chunk_id: 'd1_2', content: 'dua', page: 2 },
      { document_id: 'lain', chunk_id: 'x_1', content: 'bukan kita' },
    ] } },
  };
  const panggil = async (kueri: string) => jawaban[kueri] || { data: { results: [
    { document_id: 'd1', chunk_id: 'd1_1', content: 'satu', page: 1, source_url: 'https://kms/asli.pdf' },
    { document_id: 'd1', chunk_id: 'd1_2', content: 'dua', page: 2 },
  ] } };

  const hasil = await kumpulkanPotongan({ kb: 'kb1', docId: 'd1', nama: 'Laporan Tahunan', jumlahKatalog: 5, panggil });
  assert.deepEqual(hasil.potongan.map((p) => p.id), ['d1_1', 'd1_2']);
  assert.equal(hasil.sumberAsli, 'https://kms/asli.pdf');
  assert.equal(hasil.jumlahKatalog, 5);
  assert.equal(hasil.sebagian, true, '2 dari 5 potongan → pratinjau tidak utuh');
});

test('kumpulkanPotongan: kueri gagal tidak membatalkan hasil kueri lain', async () => {
  bersihkanCachePotongan();
  let n = 0;
  const panggil = async () => {
    n += 1;
    if (n === 1) throw new Error('timeout');
    return { data: { results: [{ document_id: 'd2', chunk_id: 'd2_1', content: 'isi' }] } };
  };
  const hasil = await kumpulkanPotongan({ kb: 'kb2', docId: 'd2', nama: 'Dok', panggil });
  assert.equal(hasil.potongan.length, 1);
});

test('kumpulkanPotongan: hasil di-cache (berpindah halaman tidak memanggil ulang)', async () => {
  bersihkanCachePotongan();
  let panggilan = 0;
  const panggil = async () => {
    panggilan += 1;
    return { data: { results: [{ document_id: 'd3', chunk_id: 'd3_1', content: 'isi' }] } };
  };
  await kumpulkanPotongan({ kb: 'kb3', docId: 'd3', nama: 'Dok', panggil });
  const pertama = panggilan;
  await kumpulkanPotongan({ kb: 'kb3', docId: 'd3', nama: 'Dok', panggil });
  assert.equal(panggilan, pertama, 'panggilan kedua harus memakai cache');
  await kumpulkanPotongan({ kb: 'kb3', docId: 'd3', nama: 'Dok', panggil, pakaiCache: false });
  assert.ok(panggilan > pertama);
});

test('kumpulkanPotongan: tanpa jumlah katalog tidak diklaim sebagian', async () => {
  bersihkanCachePotongan();
  const hasil = await kumpulkanPotongan({
    kb: 'kb4',
    docId: 'd4',
    nama: 'Dok',
    panggil: async () => ({ data: { results: [{ document_id: 'd4', chunk_id: 'd4_1', content: 'x' }] } }),
  });
  assert.equal(hasil.jumlahKatalog, 0);
  assert.equal(hasil.sebagian, false);
});
