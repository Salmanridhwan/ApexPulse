/**
 * PERMINTAAN DATA — aturan yang harus tetap benar walau UI berubah.
 *
 * Yang dijaga di sini bukan tampilan, melainkan janji alur:
 * 1. Permintaan tanpa keterangan data tidak boleh lolos (admin tidak boleh
 *    menerima permintaan kosong lalu harus bertanya balik).
 * 2. Status tidak bisa melompat (baru → selesai) dan status akhir tidak bisa
 *    dibuka lagi.
 * 3. Pemohon hanya boleh menyunting miliknya sendiri, dan hanya selama admin
 *    belum mengerjakannya.
 * 4. Bidang kosong tidak menghasilkan kartu tanpa kolom.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BIDANG_BAWAAN,
  LABEL_STATUS,
  SEMUA_STATUS,
  TRANSISI_STATUS,
  bolehMelihat,
  bolehSuntingIsi,
  bolehUbahStatus,
  normalisasiBidang,
  normalisasiPrioritas,
  normalisasiTanggal,
  perluTindakanAdmin,
  ringkasPermintaan,
  statusFinal,
  umurHari,
  validasiPermintaanBaru,
} from '../src/services/permintaan/aturan';

test('permintaan tanpa uraian data ditolak', () => {
  const hasil = validasiPermintaanBaru({ bidang: 'Keuangan', dataDiminta: '   ' });
  assert.ok(hasil.galat);
  assert.equal(hasil.nilai, undefined);
});

test('uraian yang terlalu pendek ditolak', () => {
  const hasil = validasiPermintaanBaru({ dataDiminta: 'data dong' });
  assert.ok(hasil.galat);
});

test('permintaan yang wajar diterima dan dirapikan', () => {
  const hasil = validasiPermintaanBaru({
    bidang: 'keuangan',
    dataDiminta: '  Realisasi pendapatan usaha per bulan 2026  ',
    arahDashboard: '  Fokus ke tren dan perbandingan target  ',
    prioritas: 'TINGGI',
    targetSelesai: '2026-12-31',
  });
  assert.equal(hasil.galat, undefined);
  assert.equal(hasil.nilai?.bidang, 'Keuangan');
  assert.equal(hasil.nilai?.dataDiminta, 'Realisasi pendapatan usaha per bulan 2026');
  assert.equal(hasil.nilai?.arahDashboard, 'Fokus ke tren dan perbandingan target');
  assert.equal(hasil.nilai?.prioritas, 'tinggi');
  assert.equal(hasil.nilai?.targetSelesai, '2026-12-31');
});

test('catatan arah dashboard boleh kosong', () => {
  const hasil = validasiPermintaanBaru({ dataDiminta: 'Jumlah pelanggan aktif per kecamatan' });
  assert.equal(hasil.galat, undefined);
  assert.equal(hasil.nilai?.arahDashboard, undefined);
});

test('bidang kosong jatuh ke Umum, bidang asing dipertahankan', () => {
  assert.equal(normalisasiBidang(''), 'Umum');
  assert.equal(normalisasiBidang(undefined), 'Umum');
  assert.equal(normalisasiBidang('   '), 'Umum');
  assert.equal(normalisasiBidang('pelayanan'), 'Pelayanan');
  assert.equal(normalisasiBidang('Hukum'), 'Hukum');
  // Bidang tambahan tetap disimpan, tetapi dipotong supaya tidak jadi paragraf.
  assert.equal(normalisasiBidang('x'.repeat(100)).length, 40);
});

test('enam bidang bawaan tidak berubah tanpa sengaja', () => {
  assert.deepEqual([...BIDANG_BAWAAN], ['Keuangan', 'Operasional', 'Pelayanan', 'SDM', 'Kinerja', 'Umum']);
});

test('prioritas asing jatuh ke normal', () => {
  assert.equal(normalisasiPrioritas('urgent'), 'normal');
  assert.equal(normalisasiPrioritas(undefined), 'normal');
  assert.equal(normalisasiPrioritas('rendah'), 'rendah');
  assert.equal(normalisasiPrioritas('tinggi'), 'tinggi');
});

test('tanggal target hanya menerima format YYYY-MM-DD', () => {
  assert.equal(normalisasiTanggal('2026-12-31'), '2026-12-31');
  assert.equal(normalisasiTanggal('31-12-2026'), undefined);
  assert.equal(normalisasiTanggal('besok'), undefined);
  assert.equal(normalisasiTanggal(''), undefined);
  assert.equal(normalisasiTanggal(20261231 as unknown), undefined);
});

test('status hanya boleh berpindah sesuai alur', () => {
  assert.equal(bolehUbahStatus('baru', 'diproses'), true);
  assert.equal(bolehUbahStatus('baru', 'perlu_data'), true);
  assert.equal(bolehUbahStatus('baru', 'ditolak'), true);
  assert.equal(bolehUbahStatus('baru', 'selesai'), false);
  assert.equal(bolehUbahStatus('perlu_data', 'diproses'), true);
  assert.equal(bolehUbahStatus('perlu_data', 'selesai'), false);
  assert.equal(bolehUbahStatus('diproses', 'selesai'), true);
  assert.equal(bolehUbahStatus('diproses', 'perlu_data'), true);
  assert.equal(bolehUbahStatus('diproses', 'baru'), false);
});

test('status yang sama tidak dianggap pelanggaran', () => {
  for (const s of SEMUA_STATUS) assert.equal(bolehUbahStatus(s, s), true);
});

test('status akhir tidak bisa dibuka lagi', () => {
  for (const akhir of ['selesai', 'ditolak'] as const) {
    assert.equal(statusFinal(akhir), true);
    for (const tujuan of SEMUA_STATUS) {
      if (tujuan === akhir) continue;
      assert.equal(bolehUbahStatus(akhir, tujuan), false, `${akhir} tidak boleh ke ${tujuan}`);
    }
  }
});

test('setiap status punya label, dan hanya dua yang menuntut admin', () => {
  for (const s of SEMUA_STATUS) {
    assert.ok(LABEL_STATUS[s] && LABEL_STATUS[s].trim().length > 0, `label ${s} kosong`);
  }
  const menuntut = SEMUA_STATUS.filter((s) => perluTindakanAdmin(s));
  assert.deepEqual(menuntut.sort(), ['baru', 'perlu_data']);
});

test('setiap status punya daftar transisi (tidak ada yang lupa didaftarkan)', () => {
  for (const s of SEMUA_STATUS) {
    assert.ok(Array.isArray(TRANSISI_STATUS[s]), `transisi ${s} tidak ada`);
  }
});

test('pemohon hanya boleh menyunting saat baru atau saat bola di dia', () => {
  const milik = { pemohonId: 'u-1', status: 'baru' as const };
  assert.equal(bolehSuntingIsi(milik, 'u-1'), true);
  assert.equal(bolehSuntingIsi({ ...milik, status: 'perlu_data' }, 'u-1'), true);
  assert.equal(bolehSuntingIsi({ ...milik, status: 'diproses' }, 'u-1'), false);
  assert.equal(bolehSuntingIsi({ ...milik, status: 'selesai' }, 'u-1'), false);
  assert.equal(bolehSuntingIsi(milik, 'u-2'), false);
});

test('admin instansi melihat semua, user hanya miliknya', () => {
  const p = { pemohonId: 'u-1' };
  assert.equal(bolehMelihat(p, 'u-1', false), true);
  assert.equal(bolehMelihat(p, 'u-2', false), false);
  assert.equal(bolehMelihat(p, 'u-2', true), true);
});

test('umur hari tidak pernah negatif walau jam server bergeser', () => {
  const sekarang = new Date('2026-11-06T12:00:00Z');
  assert.equal(umurHari('2026-11-01T12:00:00Z', sekarang), 5);
  assert.equal(umurHari('2026-11-06T18:00:00Z', sekarang), 0);
  assert.equal(umurHari('bukan tanggal', sekarang), 0);
});

test('ringkasan menyebut bidang, jumlah lampiran, dan umur', () => {
  const teks = ringkasPermintaan({
    bidang: 'Keuangan',
    lampiran: [{ berkasId: 'b1' }, { berkasId: 'b2' }],
    createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    status: 'baru',
  });
  assert.match(teks, /^Keuangan/);
  assert.match(teks, /2 lampiran/);
  assert.match(teks, /3 hari lalu/);
  // Status yang belum final tidak perlu disebut ulang di ringkasan.
  assert.doesNotMatch(teks, /baru/i);
});

test('ringkasan menyebut status akhir supaya pemohon tahu sudah ditutup', () => {
  const teks = ringkasPermintaan({
    bidang: 'SDM',
    createdAt: new Date().toISOString(),
    status: 'selesai',
  });
  assert.match(teks, /selesai/);
  assert.doesNotMatch(teks, /lampiran/);
});
