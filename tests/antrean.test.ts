/**
 * ANTREAN ANALISIS — kuota, klaim, dan percobaan ulang.
 *
 * Biaya analisis dokumen nyata (token + waktu), jadi aturannya harus diuji
 * tanpa memanggil layanan: waktu disuntikkan, tidak ada timer sungguhan.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BATAS_PARALEL,
  CACHE_MS,
  JEDA_ULANG_MS,
  KUOTA_ANALISIS_BAWAAN,
  analisisBisaDipakaiUlang,
  bolehKlaim,
  leaseBaru,
  masihAdaKuota,
  pesanKuotaHabis,
  putusanSetelahGagal,
  ringkasAntrean,
  sisaKuota,
  statusSaatKuotaHabis,
  type BarisAntrean,
} from '../src/services/analisis/antrean';

function baris(p: Partial<BarisAntrean> = {}): BarisAntrean {
  return {
    id: 'anl-1',
    tenantId: 't-1',
    berkasId: 'brk-1',
    status: 'antri',
    percobaan: 0,
    dibuatPada: '2026-11-06T10:00:00Z',
    ...p,
  };
}

test('kuota bawaan 20 dokumen per hari', () => {
  assert.equal(KUOTA_ANALISIS_BAWAAN, 20);
  assert.equal(sisaKuota(0), 20);
  assert.equal(sisaKuota(19), 1);
  assert.equal(sisaKuota(20), 0);
});

test('sisa kuota tidak pernah negatif walau pemakaian melebihi kuota', () => {
  assert.equal(sisaKuota(99), 0);
  assert.equal(sisaKuota(-5), 20);
  assert.equal(sisaKuota(Number.NaN), 20);
});

test('kuota instansi bisa diatur sendiri', () => {
  assert.equal(sisaKuota(5, 50), 45);
  assert.equal(masihAdaKuota(5, 50), true);
  assert.equal(masihAdaKuota(50, 50), false);
});

test('kuota habis menghasilkan status tertunda-kuota, bukan gagal', () => {
  assert.equal(statusSaatKuotaHabis(), 'tertunda-kuota');
  const pesan = pesanKuotaHabis();
  assert.match(pesan, /kuota/i);
  assert.match(pesan, /besok/i);
  assert.doesNotMatch(pesan, /rusak|gagal/i);
});

test('baris bisa diklaim saat belum ada yang memegang', () => {
  const putusan = bolehKlaim(baris(), 0, 1_000_000);
  assert.deepEqual(putusan, { boleh: true });
});

test('baris yang klaimnya masih hidup tidak bisa diklaim instance lain', () => {
  const putusan = bolehKlaim(baris({ status: 'proses', leaseSampai: 2_000_000 }), 1, 1_000_000);
  assert.deepEqual(putusan, { boleh: false, sebab: 'sedang-diklaim' });
});

test('klaim kedaluwarsa boleh diambil alih', () => {
  // Instance yang mati di tengah jalan tidak boleh memblokir dokumen selamanya.
  const putusan = bolehKlaim(baris({ status: 'proses', leaseSampai: 500_000 }), 1, 1_000_000);
  assert.deepEqual(putusan, { boleh: true });
});

test('batas paralel dihormati', () => {
  assert.equal(BATAS_PARALEL, 2);
  const putusan = bolehKlaim(baris(), BATAS_PARALEL, 1_000_000);
  assert.deepEqual(putusan, { boleh: false, sebab: 'batas-paralel' });
});

test('analisis yang sudah selesai tidak diklaim lagi', () => {
  const putusan = bolehKlaim(baris({ status: 'selesai' }), 0, 1_000_000);
  assert.deepEqual(putusan, { boleh: false, sebab: 'selesai' });
});

test('lease baru selalu di masa depan', () => {
  const sekarang = 1_000_000;
  assert.ok(leaseBaru(sekarang) > sekarang);
});

test('kegagalan sementara diulang dua kali dengan jeda 20 dan 60 detik', () => {
  assert.deepEqual(putusanSetelahGagal(1, true), { ulang: true, status: 'antri', jedaMs: JEDA_ULANG_MS[0] });
  assert.deepEqual(putusanSetelahGagal(2, true), { ulang: true, status: 'antri', jedaMs: JEDA_ULANG_MS[1] });
  // Percobaan ketiga: menyerah, jangan mengulang tanpa henti.
  assert.deepEqual(putusanSetelahGagal(3, true), { ulang: false, status: 'gagal' });
});

test('kegagalan tetap langsung gagal tanpa percobaan ulang', () => {
  // Dokumen rusak tidak akan berubah walau diulang.
  assert.deepEqual(putusanSetelahGagal(1, false), { ulang: false, status: 'gagal' });
});

test('analisis selesai yang masih segar dipakai ulang, tidak dianalisis lagi', () => {
  const sekarang = new Date('2026-11-06T12:00:00Z').getTime();
  const lama = new Date(sekarang - 2 * 24 * 60 * 60 * 1000).toISOString();
  const hasil = analisisBisaDipakaiUlang(
    [{ berkasId: 'brk-1', status: 'selesai', selesaiPada: lama }],
    'brk-1',
    sekarang
  );
  assert.ok(hasil);
});

test('analisis lebih tua dari 7 hari diabaikan', () => {
  const sekarang = new Date('2026-11-06T12:00:00Z').getTime();
  const tua = new Date(sekarang - CACHE_MS - 1000).toISOString();
  const hasil = analisisBisaDipakaiUlang(
    [{ berkasId: 'brk-1', status: 'selesai', selesaiPada: tua }],
    'brk-1',
    sekarang
  );
  assert.equal(hasil, undefined);
});

test('berkas lain atau analisis gagal tidak dipakai ulang', () => {
  const sekarang = Date.now();
  const baru = new Date(sekarang - 1000).toISOString();
  assert.equal(
    analisisBisaDipakaiUlang([{ berkasId: 'brk-2', status: 'selesai', selesaiPada: baru }], 'brk-1', sekarang),
    undefined
  );
  assert.equal(
    analisisBisaDipakaiUlang([{ berkasId: 'brk-1', status: 'gagal', selesaiPada: baru }], 'brk-1', sekarang),
    undefined
  );
});

test('ringkasan antrean menghitung tiap status', () => {
  const hasil = ringkasAntrean([
    baris({ id: 'a', status: 'antri' }),
    baris({ id: 'b', status: 'antri' }),
    baris({ id: 'c', status: 'proses' }),
    baris({ id: 'd', status: 'tertunda-kuota' }),
    baris({ id: 'e', status: 'gagal' }),
    baris({ id: 'f', status: 'selesai' }),
  ]);
  assert.deepEqual(hasil, { antri: 2, proses: 1, tertundaKuota: 1, gagal: 1, selesai: 1 });
});
