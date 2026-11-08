/**
 * ANTREAN ANALISIS OTOMATIS — diuji tanpa RAG dan tanpa HTTP.
 *
 * Yang dijaga:
 * 1. Satu dokumen hanya diantrekan sekali, walau dipicu berkali-kali
 *    (unggah + lampiran + permintaan lain yang menautkannya).
 * 2. Analisis tidak berjalan lebih dari BATAS_PARALEL sekaligus — layanan RAG
 *    membalas 429 kalau dipanggil beruntun, dan 429 membakar kuota.
 * 3. Antrean penuh ditolak dengan jujur (dihitung `dilewati`), bukan menumpuk.
 * 4. Kegagalan satu pekerjaan tidak menghentikan pekerjaan lain, dan tidak
 *    dilaporkan sebagai selesai.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BATAS_ANTREAN,
  BATAS_PARALEL,
  antreAnalisisOtomatis,
  kosongkanAntreanOtomatis,
  pasangKetergantunganAntrean,
  statusAntreanOtomatis,
  tungguAntreanKosong,
  type PekerjaanAnalisis,
} from '../src/services/analisis/otomatis';

const kerja = (berkasId: string, tenantId = 't-1'): PekerjaanAnalisis => ({
  tenantId,
  berkasId,
  judulBerkas: `${berkasId}.pdf`,
  sebab: 'unggah',
});

test('dokumen yang sama tidak diantrekan dua kali', async () => {
  kosongkanAntreanOtomatis();
  const dipanggil: string[] = [];
  pasangKetergantunganAntrean({
    jalankan: async (p) => {
      dipanggil.push(p.berkasId);
      await new Promise((r) => setTimeout(r, 5));
      return { status: 'selesai' };
    },
  });

  assert.equal(antreAnalisisOtomatis(kerja('brk-1')), true, 'pemicu pertama harus diterima');
  assert.equal(antreAnalisisOtomatis(kerja('brk-1')), false, 'pemicu kedua harus ditolak');
  assert.equal(antreAnalisisOtomatis(kerja('brk-1', 't-2')), true, 'instansi lain tetap boleh');

  assert.equal(await tungguAntreanKosong(), true);
  assert.deepEqual(dipanggil.sort(), ['brk-1', 'brk-1']);
  assert.equal(statusAntreanOtomatis().selesai, 2);
  assert.equal(statusAntreanOtomatis().dilewati, 1);
});

test('paling banyak BATAS_PARALEL analisis berjalan bersamaan', async () => {
  kosongkanAntreanOtomatis();
  let berjalan = 0;
  let puncak = 0;
  const selesai: string[] = [];
  pasangKetergantunganAntrean({
    jalankan: async (p) => {
      berjalan += 1;
      puncak = Math.max(puncak, berjalan);
      await new Promise((r) => setTimeout(r, 20));
      berjalan -= 1;
      selesai.push(p.berkasId);
      return { status: 'selesai' };
    },
  });

  for (let i = 0; i < 7; i += 1) antreAnalisisOtomatis(kerja(`brk-${i}`));

  assert.equal(await tungguAntreanKosong(), true);
  assert.equal(selesai.length, 7, 'semua pekerjaan harus selesai');
  assert.ok(puncak <= BATAS_PARALEL, `puncak paralel ${puncak} melebihi batas ${BATAS_PARALEL}`);
});

test('antrean penuh menolak pekerjaan baru dan menghitungnya sebagai dilewati', async () => {
  kosongkanAntreanOtomatis();
  // Semua pekerjaan ditahan supaya antrean benar-benar menumpuk.
  let lepas: (() => void) | null = null;
  const tahan = new Promise<void>((r) => {
    lepas = r;
  });
  pasangKetergantunganAntrean({
    jalankan: async () => {
      await tahan;
      return { status: 'selesai' };
    },
  });

  let diterima = 0;
  for (let i = 0; i < BATAS_ANTREAN + BATAS_PARALEL + 5; i += 1) {
    if (antreAnalisisOtomatis(kerja(`brk-${i}`))) diterima += 1;
  }
  assert.ok(diterima <= BATAS_ANTREAN + BATAS_PARALEL, `diterima ${diterima} melebihi kapasitas`);
  assert.ok(statusAntreanOtomatis().dilewati >= 5, 'kelebihan harus tercatat sebagai dilewati');

  lepas?.();
  assert.equal(await tungguAntreanKosong(8000), true);
});

test('kegagalan satu dokumen tidak menghentikan dokumen lain', async () => {
  kosongkanAntreanOtomatis();
  const urutan: string[] = [];
  pasangKetergantunganAntrean({
    jalankan: async (p) => {
      urutan.push(p.berkasId);
      if (p.berkasId === 'brk-rusak') throw new Error('RAG menolak');
      if (p.berkasId === 'brk-kosong') return { status: 'gagal', pesan: 'tidak ada angka' };
      return { status: 'selesai' };
    },
  });

  antreAnalisisOtomatis(kerja('brk-rusak'));
  antreAnalisisOtomatis(kerja('brk-kosong'));
  antreAnalisisOtomatis(kerja('brk-baik'));

  assert.equal(await tungguAntreanKosong(), true);
  const status = statusAntreanOtomatis();
  assert.equal(status.selesai, 1, 'hanya yang benar-benar selesai dihitung selesai');
  assert.equal(status.gagal, 2, 'gagal & melempar sama-sama dihitung gagal');
  assert.ok(urutan.includes('brk-baik'), 'dokumen sehat tetap dikerjakan');
  assert.match(status.terakhir, /brk-baik/);
});

test('pekerjaan tanpa tenant atau berkas tidak pernah masuk antrean', async () => {
  kosongkanAntreanOtomatis();
  const dipanggil: string[] = [];
  pasangKetergantunganAntrean({
    jalankan: async (p) => {
      dipanggil.push(p.berkasId);
      return { status: 'selesai' };
    },
  });

  assert.equal(antreAnalisisOtomatis({ tenantId: '', berkasId: 'brk-1', judulBerkas: 'a.pdf', sebab: 'unggah' }), false);
  assert.equal(antreAnalisisOtomatis({ tenantId: 't-1', berkasId: '', judulBerkas: 'a.pdf', sebab: 'unggah' }), false);
  assert.equal(antreAnalisisOtomatis({ tenantId: 't-1', berkasId: 'brk-1', judulBerkas: '', sebab: 'unggah' }), false);

  assert.equal(await tungguAntreanKosong(200), true);
  assert.equal(dipanggil.length, 0);
});

test('tanpa ketergantungan terpasang, pekerjaan tidak dijalankan diam-diam', async () => {
  kosongkanAntreanOtomatis();
  pasangKetergantunganAntrean(null as any);
  antreAnalisisOtomatis(kerja('brk-1'));
  await new Promise((r) => setTimeout(r, 30));
  // Tidak ada yang berjalan: antrean tetap berisi, bukan dilaporkan selesai.
  assert.equal(statusAntreanOtomatis().selesai, 0);
});
