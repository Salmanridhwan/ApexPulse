/**
 * UJI BEBAN KECIL: lima dokumen diunggah bersamaan.
 *
 * Yang dijaga: antrean tidak boleh menggandakan analisis. Dua hal buruk yang
 * mungkin terjadi tanpa uji ini:
 *
 * 1. Dokumen yang sama dianalisis dua kali karena dua permintaan masuk hampir
 *    bersamaan — kuota terbuang, hasilnya bisa berbeda, dan admin melihat dua
 *    kartu untuk satu berkas.
 * 2. Lima dokumen memicu lima panggilan RAG sekaligus — layanan membalas 429
 *    dan SEMUA permintaan ikut gagal, bukan hanya yang berlebih.
 *
 * Simulasi di sini memakai fungsi antrean yang sama dengan server (`bolehKlaim`,
 * `leaseBaru`), jadi yang diuji adalah aturannya, bukan salinannya.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BATAS_PARALEL,
  analisisBisaDipakaiUlang,
  bolehKlaim,
  leaseBaru,
  type BarisAntrean,
} from '../src/services/analisis/antrean';

/** Klaim satu baris bila diizinkan, seperti yang dilakukan server. */
function klaim(rows: BarisAntrean[], id: string, sekarang: number): string {
  const baris = rows.find((r) => r.id === id);
  if (!baris) return 'tidak-ada';
  const hidup = rows.filter((r) => r.status === 'proses' && (r.leaseSampai ?? 0) > sekarang).length;
  const putusan = bolehKlaim(baris, hidup, sekarang);
  if (!putusan.boleh) return putusan.sebab;
  baris.status = 'proses';
  baris.leaseSampai = leaseBaru(sekarang);
  baris.percobaan += 1;
  return 'diklaim';
}

function baris(id: string, berkasId: string, sekarang: number): BarisAntrean {
  return {
    id,
    tenantId: 'tenant-uji',
    berkasId,
    status: 'antri',
    percobaan: 0,
    dibuatPada: new Date(sekarang).toISOString(),
  };
}

test('lima dokumen bersamaan: hanya 2 yang berjalan, sisanya menunggu', () => {
  const sekarang = new Date('2026-11-06T09:00:00').getTime();
  const rows = [1, 2, 3, 4, 5].map((n) => baris(`a${n}`, `berkas-${n}`, sekarang));

  const hasil = rows.map((r) => klaim(rows, r.id, sekarang));

  assert.equal(hasil.filter((h) => h === 'diklaim').length, BATAS_PARALEL);
  assert.equal(hasil.filter((h) => h === 'batas-paralel').length, 5 - BATAS_PARALEL);
  assert.equal(rows.filter((r) => r.status === 'proses').length, BATAS_PARALEL);
});

test('lima permintaan untuk dokumen yang SAMA: hanya satu analisis', () => {
  const sekarang = new Date('2026-11-06T09:00:00').getTime();
  const rows = [baris('satu', 'berkas-sama', sekarang)];

  // Lima permintaan masuk berurutan dalam milidetik yang sama.
  const hasil = [0, 1, 2, 3, 4].map(() => klaim(rows, 'satu', sekarang));

  assert.equal(hasil.filter((h) => h === 'diklaim').length, 1);
  assert.equal(hasil.filter((h) => h === 'sedang-diklaim').length, 4);
  assert.equal(rows[0].percobaan, 1, 'percobaan tidak bertambah untuk permintaan yang ditolak');
});

test('setelah satu selesai, slot terpakai berikutnya boleh jalan', () => {
  const sekarang = new Date('2026-11-06T09:00:00').getTime();
  const rows = [1, 2, 3].map((n) => baris(`b${n}`, `berkas-${n}`, sekarang));

  assert.equal(klaim(rows, 'b1', sekarang), 'diklaim');
  assert.equal(klaim(rows, 'b2', sekarang), 'diklaim');
  assert.equal(klaim(rows, 'b3', sekarang), 'batas-paralel');

  // b1 selesai -> klaimnya tidak lagi dihitung sebagai berjalan.
  rows[0].status = 'selesai';
  assert.equal(klaim(rows, 'b3', sekarang), 'diklaim', 'slot yang bebas langsung dipakai');
});

test('klaim kedaluwarsa boleh diambil alih instance lain', () => {
  const mulai = new Date('2026-11-06T09:00:00').getTime();
  const rows = [baris('c1', 'berkas-1', mulai)];
  assert.equal(klaim(rows, 'c1', mulai), 'diklaim');

  // Instance pertama mati; 6 menit kemudian instance lain mencoba.
  const nanti = mulai + 6 * 60 * 1000;
  assert.equal(klaim(rows, 'c1', nanti), 'diklaim', 'tanpa ini, satu instance mati memblokir dokumen selamanya');
});

test('dokumen yang sudah selesai tidak dianalisis ulang', () => {
  const sekarang = new Date('2026-11-06T09:00:00').getTime();
  const rows = [baris('d1', 'berkas-1', sekarang)];
  rows[0].status = 'selesai';
  assert.equal(klaim(rows, 'd1', sekarang), 'selesai');
});

test('unggah ulang dokumen yang sudah dianalisis memakai hasil lama', () => {
  const selesai = new Date('2026-11-06T09:00:00').toISOString();
  const hasil = analisisBisaDipakaiUlang(
    [{ berkasId: 'berkas-1', status: 'selesai', selesaiPada: selesai }],
    'berkas-1',
    new Date('2026-11-06T12:00:00').getTime()
  );
  assert.ok(hasil, 'hasil 3 jam lalu masih boleh dipakai');
});

test('hasil lama tidak dipakai bila sudah lewat masa cache', () => {
  const selesai = new Date('2026-11-01T09:00:00').toISOString();
  const hasil = analisisBisaDipakaiUlang(
    [{ berkasId: 'berkas-1', status: 'selesai', selesaiPada: selesai }],
    'berkas-1',
    new Date('2026-11-09T12:00:00').getTime()
  );
  assert.ok(!hasil, 'lebih dari 7 hari harus dianalisis ulang');
});
