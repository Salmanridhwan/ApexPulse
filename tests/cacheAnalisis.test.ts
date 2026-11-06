/**
 * CACHE RAG — diuji tanpa jaringan.
 *
 * Yang dijaga: dokumen yang tidak berubah tidak dibaca ulang, dokumen yang
 * berubah TIDAK memakai cache lama, dan cache yang terlalu tua tidak dipakai
 * selamanya.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  UMUR_CACHE_MS,
  perluSegarKarenaKb,
  putusanCache,
  sidikDokumen,
  sidikKb,
  type AnalisisUntukCache,
} from '../src/services/analisis/cache';

function analisis(p: Partial<AnalisisUntukCache> = {}): AnalisisUntukCache {
  return {
    id: 'anl-1',
    berkasId: 'brk-1',
    status: 'selesai',
    dibuatPada: '2026-11-01T10:00:00Z',
    selesaiPada: '2026-11-01T10:01:00Z',
    sidikDokumen: 'brk-1|120|application/pdf|2026-11-01T09:00:00Z',
    sidikKb: 'd1@2026-10-01;d2@2026-10-02',
    ...p,
  };
}

test('sidik dokumen berubah bila berkasnya diganti', () => {
  const lama = sidikDokumen({ berkasId: 'brk-1', ukuranKb: 120, tipe: 'application/pdf', diunggahPada: '2026-11-01' });
  const baru = sidikDokumen({ berkasId: 'brk-1', ukuranKb: 180, tipe: 'application/pdf', diunggahPada: '2026-11-05' });
  assert.notEqual(lama, baru);
});

test('sidik dokumen stabil untuk dokumen yang sama', () => {
  const a = sidikDokumen({ berkasId: 'brk-1', ukuranKb: 120, tipe: 'PDF', diunggahPada: '2026-11-01' });
  const b = sidikDokumen({ berkasId: 'brk-1', ukuranKb: 120, tipe: 'pdf', diunggahPada: '2026-11-01' });
  assert.equal(a, b, 'tipe berkas tidak boleh peka huruf besar/kecil');
});

test('sidik KB tidak terpengaruh urutan balasan KMS', () => {
  const a = sidikKb([{ id: 'd1', updatedAt: '2026-10-01' }, { id: 'd2', updatedAt: '2026-10-02' }]);
  const b = sidikKb([{ id: 'd2', updatedAt: '2026-10-02' }, { id: 'd1', updatedAt: '2026-10-01' }]);
  assert.equal(a, b);
});

test('sidik KB berubah saat ada dokumen baru', () => {
  const a = sidikKb([{ id: 'd1', updatedAt: '2026-10-01' }]);
  const b = sidikKb([{ id: 'd1', updatedAt: '2026-10-01' }, { id: 'd3', updatedAt: '2026-11-06' }]);
  assert.notEqual(a, b);
});

test('dokumen yang belum pernah dianalisis tidak memakai cache', () => {
  const putusan = putusanCache([], { berkasId: 'brk-1' });
  assert.equal(putusan.pakai, false);
  if (!putusan.pakai) assert.equal(putusan.sebab, 'belum-ada');
});

test('dokumen tidak berubah: cache dipakai, RAG tidak dipanggil', () => {
  const putusan = putusanCache([analisis()], {
    berkasId: 'brk-1',
    sidikDokumen: 'brk-1|120|application/pdf|2026-11-01T09:00:00Z',
    sidikKb: 'd1@2026-10-01;d2@2026-10-02',
    sekarang: new Date('2026-11-06T10:00:00Z').getTime(),
  });
  assert.equal(putusan.pakai, true);
  if (putusan.pakai) {
    assert.equal(putusan.analisisId, 'anl-1');
    assert.match(putusan.alasan, /belum berubah/i);
  }
});

test('dokumen berubah: analisis ulang dengan informasi terbaru', () => {
  const putusan = putusanCache([analisis()], {
    berkasId: 'brk-1',
    sidikDokumen: 'brk-1|180|application/pdf|2026-11-05T09:00:00Z',
    sekarang: new Date('2026-11-06T10:00:00Z').getTime(),
  });
  assert.equal(putusan.pakai, false);
  if (!putusan.pakai) {
    assert.equal(putusan.sebab, 'dokumen-berubah');
    assert.match(putusan.alasan, /dibaca ulang/i);
  }
});

test('ada dokumen baru di basis instansi: cache tidak dipakai', () => {
  const putusan = putusanCache([analisis()], {
    berkasId: 'brk-1',
    sidikDokumen: 'brk-1|120|application/pdf|2026-11-01T09:00:00Z',
    sidikKb: 'd1@2026-10-01;d2@2026-10-02;d3@2026-11-06',
    sekarang: new Date('2026-11-06T10:00:00Z').getTime(),
  });
  assert.equal(putusan.pakai, false);
  if (!putusan.pakai) {
    assert.equal(putusan.sebab, 'kb-berubah');
    assert.match(putusan.alasan, /dokumen baru/i);
  }
});

test('analisis ulang manual selalu jalan walau cache masih sah', () => {
  const putusan = putusanCache([analisis()], {
    berkasId: 'brk-1',
    sidikDokumen: 'brk-1|120|application/pdf|2026-11-01T09:00:00Z',
    paksa: true,
    sekarang: new Date('2026-11-06T10:00:00Z').getTime(),
  });
  assert.equal(putusan.pakai, false);
  if (!putusan.pakai) assert.equal(putusan.sebab, 'dipaksa');
});

test('cache terlalu tua tidak dipakai walau sidik sama', () => {
  const sekarang = new Date('2026-11-01T10:01:00Z').getTime() + UMUR_CACHE_MS + 1000;
  const putusan = putusanCache([analisis()], {
    berkasId: 'brk-1',
    sidikDokumen: 'brk-1|120|application/pdf|2026-11-01T09:00:00Z',
    sekarang,
  });
  assert.equal(putusan.pakai, false);
  if (!putusan.pakai) assert.equal(putusan.sebab, 'kedaluwarsa');
});

test('analisis terakhir gagal tidak pernah dipakai sebagai cache', () => {
  const putusan = putusanCache([analisis({ status: 'gagal' })], {
    berkasId: 'brk-1',
    sidikDokumen: 'brk-1|120|application/pdf|2026-11-01T09:00:00Z',
    sekarang: new Date('2026-11-06T10:00:00Z').getTime(),
  });
  assert.equal(putusan.pakai, false);
  if (!putusan.pakai) assert.equal(putusan.sebab, 'analisis-terakhir-gagal');
});

test('yang dipakai adalah analisis terbaru, bukan yang pertama ketemu', () => {
  const putusan = putusanCache(
    [
      analisis({ id: 'anl-lama', dibuatPada: '2026-10-01T10:00:00Z', selesaiPada: '2026-10-01T10:00:00Z' }),
      analisis({ id: 'anl-baru', dibuatPada: '2026-11-05T10:00:00Z', selesaiPada: '2026-11-05T10:00:00Z' }),
    ],
    {
      berkasId: 'brk-1',
      sidikDokumen: 'brk-1|120|application/pdf|2026-11-01T09:00:00Z',
      sekarang: new Date('2026-11-06T10:00:00Z').getTime(),
    }
  );
  assert.equal(putusan.pakai, true);
  if (putusan.pakai) assert.equal(putusan.analisisId, 'anl-baru');
});

test('tanpa sidik dari pemanggil, cache tetap dipakai (jangan paksa analisis ulang)', () => {
  // Sidik boleh tidak dikirim; memaksa analisis ulang hanya karena data sidik
  // tidak lengkap akan membuang token tanpa alasan.
  const putusan = putusanCache([analisis()], {
    berkasId: 'brk-1',
    sekarang: new Date('2026-11-06T10:00:00Z').getTime(),
  });
  assert.equal(putusan.pakai, true);
});

test('perluSegarKarenaKb menandai analisis yang basisnya berubah', () => {
  const hasil = perluSegarKarenaKb(
    [
      analisis({ id: 'a1', sidikKb: 'lama' }),
      analisis({ id: 'a2', sidikKb: 'baru' }),
      analisis({ id: 'a3', sidikKb: 'lama', status: 'gagal' }),
      analisis({ id: 'a4', sidikKb: undefined }),
    ],
    'baru'
  );
  assert.deepEqual(
    hasil.map((a) => a.id),
    ['a1']
  );
});
