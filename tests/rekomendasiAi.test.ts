/**
 * REKOMENDASI AI — yang diuji di sini adalah sisi aplikasi, bukan modelnya:
 * membaca jawaban model yang kadang dibungkus kalimat/```json, dan memeriksa
 * pilihan model sebelum dipakai (id dikenal, chart sah, tidak ada duplikat).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { ButirData } from '../src/types';
import { CHART_DEFAULT } from '../src/services/chart/chartDefault';
import {
  MODE_REKO,
  bolehPutaranLagi,
  masihPutaran,
  bolehBerhenti,
  catatDurasi,
  perkiraanNyata,
  bacaRencana,
  buatPrompt,
  daftarChart,
  katalogUntukAi,
  susunDariRencana,
  tataRapiHalaman,
  varianButir,
} from '../src/services/analisis/rekomendasiAi';

let urut = 0;
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun'];

function butir(p: Partial<ButirData> = {}): ButirData {
  urut += 1;
  return {
    id: `btr-${urut}`,
    tenantId: 't-1',
    analisisId: 'anl-1',
    berkasId: 'brk-1',
    nama: `Indikator ${urut}`,
    kategori: 'keuangan',
    bentukDisarankan: 'bar',
    keyakinan: 'tinggi',
    status: 'disetujui',
    dibuatPada: '2026-11-10T10:00:00Z',
    sitasi: { dokumen: 'Anggaran 2026 FIX', kutipan: 'lembar uji' },
    ...p,
  };
}

function deret(nama: string, isi = [10, 12, 9, 14, 20, 18]): ButirData {
  return butir({
    nama,
    seri: [{ nama: 'Total', kategori: BULAN.slice(0, isi.length), data: isi }],
    periodeTersedia: BULAN.slice(0, isi.length),
  });
}

test('varianButir membuka bentuk lain: tren dan komposisi', () => {
  const b = butir({
    nama: 'Pendapatan per akun',
    seri: BULAN.map((bulan) => ({ nama: bulan, kategori: ['Akun A', 'Akun B', 'Akun C'], data: [10, 20, 5] })),
    periodeTersedia: BULAN,
  });
  const v = varianButir(b);
  const id = v.map((x) => x.id);
  assert.ok(id.includes(b.id));
  assert.ok(id.includes(`${b.id}#tren`), 'varian tren tersedia');
  assert.ok(id.includes(`${b.id}#komposisi`), 'varian komposisi tersedia');

  const tren = v.find((x) => x.id === `${b.id}#tren`)!;
  assert.equal((tren.butir.seri || []).length, 3, 'tiap akun jadi satu seri');
  assert.deepEqual(tren.butir.seri?.[0].kategori, BULAN, 'sumbu-x jadi periode');
  assert.ok(tren.charts.includes('bar-tumpuk') || tren.charts.includes('combo-batang-garis') || tren.charts.includes('garis-tren'));

  const komposisi = v.find((x) => x.id === `${b.id}#komposisi`)!;
  assert.ok(komposisi.charts.includes('donat-tebal'), 'komposisi membuka donat');
});

test('katalogUntukAi hanya memuat butir berangka dan dibatasi', () => {
  const daftar = [deret('Pendapatan'), butir({ nama: 'Tanpa angka' }), butir({ nama: 'Nilai', nilai: 5000 }), butir({ nama: 'Nol', seri: [{ nama: 'x', data: [0, 0, 0] }] })];
  const { teks, jumlah } = katalogUntukAi(daftar, 10);
  assert.equal(jumlah, 2, 'hanya butir berisi angka');
  assert.match(teks, /Pendapatan/);
  assert.doesNotMatch(teks, /Tanpa angka/);
  assert.ok(teks.split('\n').length <= 10);
});

test('prompt menyebut aturan halaman, daftar chart, dan bentuk JSON', () => {
  const p = buatPrompt('- btr-1 | Pendapatan | keuangan', 1, 'dashboard keuangan');
  assert.match(p, /Ringkasan/);
  assert.match(p, /"halaman"/);
  assert.match(p, /dashboard keuangan/);
  assert.match(p, /DAFTAR CHART/);
  assert.ok(daftarChart().includes('donat-tebal'), 'katalog chart dikirim utuh');
});

test('prompt dengan katalog penuh tetap di bawah batas 8000 karakter', () => {
  const daftar = Array.from({ length: 60 }, (_, i) =>
    butir({
      nama: `Indikator ${i} dengan nama panjang sekali supaya katalog cepat penuh`,
      seri: BULAN.map((bulan, j) => ({ nama: bulan, kategori: Array.from({ length: 6 }, (_, k) => `Akun ${k} ${i}`), data: [10 + i, 12, 9, 14, 20, 18].map((v) => v + j) })),
      periodeTersedia: BULAN,
    })
  );
  const katalog = katalogUntukAi(daftar);
  const prompt = buatPrompt(katalog.teks, katalog.jumlah);
  assert.ok(prompt.length < 8000, `prompt ${prompt.length} karakter melebihi batas layanan RAG`);
});

test('bacaRencana menerima JSON di dalam kalimat dan pagar markdown', () => {
  const jawaban = [
    'Baik, ini susunannya:',
    '```json',
    '{"judul":"Dashboard Uji","halaman":[{"judul":"Ringkasan","kartu":[{"id":"btr-1","chart":"kpi-kartu"}]}]}',
    '```',
    'Semoga membantu.',
  ].join('\n');
  const r = bacaRencana(jawaban);
  assert.ok(r);
  assert.equal(r?.judul, 'Dashboard Uji');
  assert.equal(r?.halaman[0].kartu[0].id, 'btr-1');
});

test('bacaRencana menolak jawaban tanpa susunan', () => {
  assert.equal(bacaRencana('Maaf, saya tidak bisa menyusun dashboard.'), null);
  assert.equal(bacaRencana('{"judul":"x","halaman":[]}'), null);
  assert.equal(bacaRencana(''), null);
});

test('susunDariRencana membuang id asing, mengganti chart tak sah, dan tidak menduplikasi butir', () => {
  const a = deret('Pendapatan bulanan');
  const b = butir({ nama: 'Nilai Tunggal', nilai: 1234567 });
  const rencana = {
    judul: 'Dashboard AI',
    halaman: [
      {
        judul: 'Ringkasan',
        kartu: [
          { id: b.id, chart: 'kpi-kartu' },
          { id: a.id, chart: 'chart-yang-tidak-ada' },
          { id: 'btr-tidak-dikenal', chart: 'garis-tren' },
          { id: a.id, chart: 'garis-tren' },
        ],
      },
      { judul: 'Halaman Kosong', kartu: [{ id: 'btr-asing-lagi' }] },
    ],
  };

  const hasil = susunDariRencana(rencana, [a, b]);
  assert.equal(hasil.halaman.length, 1, 'halaman tanpa kartu sah dibuang');
  assert.deepEqual(hasil.dipakai, [b.id, a.id]);
  // Satu id asing, satu duplikat, dan satu lagi di halaman yang jadi kosong.
  assert.equal(hasil.dibuang.length, 3, 'id asing dan duplikat dicatat');
  const kartuA = hasil.halaman[0].widgets.find((w) => w.title === 'Pendapatan bulanan');
  assert.ok(kartuA?.chartId, 'chart pengganti dipilih dari katalog');
  assert.ok(Object.prototype.hasOwnProperty.call(CHART_DEFAULT, String(kartuA?.chartId)));
});

/** Kartu tiruan: hanya butuh id dan grid untuk menguji tata letak. */
function kartuUji(id: string, chartId = 'garis-tren') {
  return { id, type: 'line', title: id, chartId, grid: { x: 0, y: 0, w: 6, h: 2 } } as any;
}

test('tataRapiHalaman mengisi enam baris dan menggabung halaman satu kartu', () => {
  const asal = [
    { judul: 'Ringkasan', widgets: [kartuUji('a'), kartuUji('b'), kartuUji('c')] },
    { judul: 'Tipis', widgets: [kartuUji('d')] },
    { judul: 'Empat', widgets: [kartuUji('e'), kartuUji('f'), kartuUji('g'), kartuUji('h')] },
  ];
  const hasil = tataRapiHalaman(asal);
  assert.equal(hasil.length, 2, 'halaman satu kartu digabung');
  const total = hasil.reduce((n, h) => n + h.widgets.length, 0);
  assert.equal(total, 8, 'tidak ada kartu yang hilang');
  for (const h of hasil) {
    const tinggi = Math.max(...h.widgets.map((w) => w.grid.y + w.grid.h));
    assert.equal(tinggi, 6, `halaman ${h.judul} setinggi enam baris`);
    const luas = h.widgets.reduce((n, w) => n + w.grid.w * w.grid.h, 0);
    assert.equal(luas, 72, `halaman ${h.judul} terisi penuh`);
  }
});

test('mode cepat memakai katalog lebih kecil daripada mendalam', () => {
  assert.ok(MODE_REKO.cepat.batasKatalog < MODE_REKO.seimbang.batasKatalog);
  assert.ok(MODE_REKO.cepat.maksVarian < MODE_REKO.mendalam.maksVarian);
  assert.ok(MODE_REKO.mendalam.putaran > MODE_REKO.seimbang.putaran, 'mendalam memakai beberapa putaran');
  assert.equal(MODE_REKO.mendalam.batasDetik, 480, 'mendalam paling lama 8 menit');
  assert.equal(MODE_REKO.mendalam.perkiraan, '4–8 menit');
  assert.ok(MODE_REKO.mendalam.halamanMaks > MODE_REKO.seimbang.halamanMaks);
});

test('mode ultra: tiga putaran, halaman terbanyak, masih di bawah batas prompt', () => {
  assert.ok(MODE_REKO.ultra.putaran > MODE_REKO.mendalam.putaran, 'ultra putarannya paling banyak');
  assert.ok(MODE_REKO.ultra.batasDetik > MODE_REKO.mendalam.batasDetik);
  assert.ok(MODE_REKO.ultra.halamanMin >= 10, 'ultra minimal sepuluh halaman');
  assert.ok(MODE_REKO.ultra.halamanMaks > MODE_REKO.mendalam.halamanMaks);
  assert.ok(MODE_REKO.ultra.kartuMaks >= MODE_REKO.mendalam.kartuMaks);
  // Batas panjang katalog tidak boleh melewati batas layanan RAG (8000 karakter
  // untuk seluruh prompt), jadi ultra menambah isi lewat putaran, bukan katalog.
  assert.ok(MODE_REKO.ultra.batasKatalog <= MODE_REKO.mendalam.batasKatalog);
  const prompt = buatPrompt('- btr-1 | x | y', 1, '', 'ultra', true, 3);
  assert.match(prompt, /PUTARAN LANJUTAN 3 dari 5/);
  assert.match(prompt, /Susun 3 sampai 5 halaman TAMBAHAN/);
});

test('anggaran waktu: putaran berikutnya hanya bila sisa waktu cukup', () => {
  assert.equal(bolehPutaranLagi(300, 90, 480), true);
  assert.equal(bolehPutaranLagi(420, 90, 480), false, '420 + 90 melewati 8 menit');
});

test('waktu minimal: ultra terus menambah putaran sampai 8 menit', () => {
  assert.equal(masihPutaran(5, 100, 'ultra'), true, 'sampai target profil selalu jalan');
  assert.equal(masihPutaran(6, 300, 'ultra'), true, 'belum 8 menit: putaran ekstra');
  assert.equal(masihPutaran(6, 500, 'ultra'), false, 'sudah 8 menit: cukup');
  assert.equal(masihPutaran(10, 300, 'ultra'), false, 'putaran ekstra dibatasi');
  assert.equal(masihPutaran(2, 10, 'cepat'), false, 'cepat tetap satu putaran');
  assert.equal(bolehBerhenti(300, 'ultra'), false);
  assert.equal(bolehBerhenti(480, 'ultra'), true);
  assert.equal(bolehBerhenti(0, 'seimbang'), true);
});

test('durasi nyata: riwayat 10 terakhir dan teks rentang', () => {
  let r = catatDurasi(undefined, 'mendalam', 290);
  for (let i = 0; i < 12; i += 1) r = catatDurasi(r, 'mendalam', 300 + i);
  assert.equal(r.mendalam!.length, 10);
  assert.deepEqual(perkiraanNyata({ mendalam: [270, 410] }, 'mendalam'), { teks: '5–7 menit', sampel: 2 });
  assert.deepEqual(perkiraanNyata({ cepat: [40, 40] }, 'cepat'), { teks: '± 40 detik', sampel: 2 });
  assert.deepEqual(perkiraanNyata({ seimbang: [50, 130] }, 'seimbang'), { teks: '50 detik–2 menit', sampel: 2 });
  assert.equal(perkiraanNyata(undefined, 'mendalam').teks, '4–8 menit');
});

test('prompt mengikuti mode yang dipilih', () => {
  const cepat = buatPrompt('- btr-1 | x | y', 1, '', 'cepat');
  assert.match(cepat, /Susun 2 sampai 3 halaman/);
  assert.doesNotMatch(cepat, /7 jenis chart/);

  const seimbang = buatPrompt('- btr-1 | x | y', 1, '', 'seimbang');
  assert.match(seimbang, /Susun 4 sampai 5 halaman/);

  const lanjutan = buatPrompt('- btr-1 | x | y', 1, '', 'mendalam', true);
  assert.match(lanjutan, /PUTARAN LANJUTAN/);
  assert.match(lanjutan, /halaman TAMBAHAN/);
});

test('katalog menghormati batas yang diberikan', () => {
  const butir: ButirData[] = Array.from({ length: 30 }, (_, i) => ({
    id: `btr-${i}`,
    tenantId: 't',
    docId: 'd',
    docName: 'Dokumen Contoh Panjang',
    sheet: 'UMUM',
    cell: `B${i + 2}`,
    title: `Pendapatan Golongan ${i}`,
    nilai: 1000 + i,
    satuan: 'Rp',
    kategori: 'keuangan',
    status: 'disetujui',
    seri: [{ name: 'Jan', data: [1000 + i] }],
  })) as ButirData[];
  const kecil = katalogUntukAi(butir, 120, 400);
  const besar = katalogUntukAi(butir, 120, 4600);
  assert.ok(kecil.teks.length <= 400, 'katalog kecil di bawah batas');
  assert.ok(besar.jumlah > kecil.jumlah, 'batas besar memuat lebih banyak varian');
});
