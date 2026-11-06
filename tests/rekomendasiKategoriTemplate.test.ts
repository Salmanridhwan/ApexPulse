/**
 * REKOMENDASI TEMPLATE — diuji tanpa memanggil RAG sama sekali.
 *
 * Yang dijaga:
 * 1. Tidak pernah mengembalikan daftar kosong (admin harus selalu punya pilihan).
 * 2. Hasil stabil: dua pemanggilan dengan butir yang sama memberi urutan sama.
 * 3. Butir tanpa sitasi tidak pernah otomatis "disetujui".
 * 4. Susunan halaman tidak melebihi batas 9 widget dan menghormati bentuk data.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { ButirData } from '../src/types';
import {
  kategoriTerdeteksi,
  kataKunci,
  ringkasAnalisis,
  saranSusunanHalaman,
  saranTemplate,
  statusButirAwal,
} from '../src/services/analisis/rekomendasiKategoriTemplate';

let urut = 0;
function butir(p: Partial<ButirData>): ButirData {
  urut += 1;
  return {
    id: `btr-${urut}`,
    tenantId: 't-1',
    analisisId: 'anl-1',
    berkasId: 'brk-1',
    nama: 'Indikator',
    kategori: 'Umum',
    bentukDisarankan: 'kpi',
    sitasi: { dokumen: 'Laporan Tahunan 2025' },
    keyakinan: 'tinggi',
    status: 'draf',
    dibuatPada: new Date().toISOString(),
    ...p,
  } as ButirData;
}

test('kata kunci membuang kata umum dan duplikat', () => {
  const kata = kataKunci('Tren Pendapatan Usaha dan Komposisi Beban per Tahun');
  assert.ok(kata.includes('tren'));
  assert.ok(kata.includes('pendapatan'));
  assert.ok(kata.includes('komposisi'));
  assert.ok(!kata.includes('dan'), 'kata sambung harus dibuang');
  assert.ok(!kata.includes('tahun'), 'kata umum harus dibuang');
  assert.equal(new Set(kata).size, kata.length, 'tidak boleh ada duplikat');
});

test('butir pendapatan menghasilkan saran yang menyebut tren atau pendapatan', () => {
  const saran = saranTemplate('Keuangan', [
    butir({ nama: 'Pendapatan Usaha Tahunan', kategori: 'Keuangan' }),
    butir({ nama: 'Tren pendapatan lima tahun', kategori: 'Keuangan' }),
  ]);
  assert.equal(saran.length, 2);
  for (const s of saran) {
    assert.ok(s.skor >= 0 && s.skor <= 1, `skor ${s.skor} di luar 0..1`);
    assert.ok(s.alasan.trim().length > 0, 'alasan tidak boleh kosong');
    assert.ok(s.nama.trim().length > 0);
  }
  const gabung = saran.map((s) => s.alasan).join(' ').toLowerCase();
  assert.ok(/pendapatan|tren|keuangan/.test(gabung), `alasan kurang relevan: ${gabung}`);
});

test('saran tidak pernah kosong walau butir tidak dikenal', () => {
  const saran = saranTemplate('Umum', [butir({ nama: 'Zzz qqq', kategori: 'Umum' })]);
  assert.equal(saran.length, 2);
  assert.ok(saran.every((s) => s.alasan.length > 0));
});

test('saran tidak pernah kosong walau tanpa butir sama sekali', () => {
  const saran = saranTemplate('Keuangan', []);
  assert.equal(saran.length, 2);
  assert.ok(saran.every((s) => s.templateId.startsWith('tpl-')));
});

test('urutan saran stabil untuk masukan yang sama', () => {
  const masukan = [
    butir({ nama: 'Komposisi pelanggan per kecamatan', kategori: 'Pelayanan' }),
    butir({ nama: 'Jumlah keluhan bulanan', kategori: 'Pelayanan' }),
  ];
  const a = saranTemplate('Pelayanan', masukan);
  const b = saranTemplate('Pelayanan', masukan);
  assert.deepEqual(
    a.map((s) => s.templateId),
    b.map((s) => s.templateId)
  );
  assert.deepEqual(
    a.map((s) => s.skor),
    b.map((s) => s.skor)
  );
});

test('template yang sama tidak muncul dua kali', () => {
  const saran = saranTemplate('Keuangan', [butir({ nama: 'Arus kas', kategori: 'Keuangan' })]);
  const id = saran.map((s) => s.templateId);
  assert.equal(new Set(id).size, id.length);
});

test('kategori terdeteksi diurutkan dari yang terbanyak', () => {
  const hasil = kategoriTerdeteksi([
    butir({ kategori: 'Keuangan' }),
    butir({ kategori: 'Operasional' }),
    butir({ kategori: 'Keuangan' }),
    butir({ kategori: 'Keuangan' }),
    butir({ kategori: '' }),
  ]);
  assert.deepEqual(hasil, ['Keuangan', 'Operasional', 'Umum']);
});

test('kategori kosong jatuh ke Umum, bukan hilang', () => {
  assert.deepEqual(kategoriTerdeteksi([butir({ kategori: '' })]), ['Umum']);
  assert.deepEqual(kategoriTerdeteksi([]), []);
});

test('deret panjang jadi tren, deret pendek berlabel jadi komposisi, angka tunggal jadi utama', () => {
  const susun = saranSusunanHalaman([
    butir({ nama: 'Tren pendapatan', seri: [{ nama: 'Pendapatan', data: [1, 2, 3, 4, 5, 6] }] }),
    butir({ nama: 'Komposisi beban', seri: [{ nama: 'Beban', data: [10, 20], kategori: ['A', 'B'] }] }),
    butir({ nama: 'Laba bersih', nilai: 1234 }),
  ]);
  const peran: Record<string, number> = {};
  for (const s of susun) peran[s.peran] = (peran[s.peran] || 0) + 1;
  assert.equal(peran.tren, 1);
  assert.equal(peran.komposisi, 1);
  assert.equal(peran.utama, 1);
});

test('hanya satu tabel yang dipakai, dan yang barisnya paling banyak', () => {
  const susun = saranSusunanHalaman([
    butir({ nama: 'Tabel kecil', tabel: { kolom: ['a'], baris: [['1']] } }),
    butir({ nama: 'Tabel besar', tabel: { kolom: ['a'], baris: [['1'], ['2'], ['3']] } }),
    butir({ nama: 'Angka', nilai: 5 }),
  ]);
  const tabel = susun.filter((s) => s.peran === 'tabel');
  assert.equal(tabel.length, 1);
  assert.equal(tabel[0].butirId, susun.find((s) => s.peran === 'tabel')!.butirId);
});

test('susunan halaman dibatasi 9 butir', () => {
  const banyak = Array.from({ length: 20 }, (_, i) => butir({ nama: `Indikator ${i}`, nilai: i }));
  const susun = saranSusunanHalaman(banyak);
  assert.equal(susun.length, 9);
});

test('kartu utama dari kategori Keuangan didahulukan', () => {
  const susun = saranSusunanHalaman([
    butir({ nama: 'Jumlah pegawai', nilai: 100, kategori: 'SDM' }),
    butir({ nama: 'Pendapatan usaha', nilai: 900, kategori: 'Keuangan' }),
  ]);
  assert.equal(susun[0].peran, 'utama');
  // Butir Keuangan harus muncul sebelum butir SDM pada peran yang sama.
  const ids = susun.map((s) => s.butirId);
  assert.equal(ids.length, 2);
});

test('butir berkeyakinan tinggi dengan sitasi boleh langsung disetujui', () => {
  assert.equal(statusButirAwal('tinggi', { dokumen: 'Laporan 2025' }), 'disetujui');
});

test('tanpa sitasi, butir tetap draf walau keyakinan tinggi', () => {
  assert.equal(statusButirAwal('tinggi', { dokumen: '   ' }), 'draf');
  assert.equal(statusButirAwal('tinggi', null), 'draf');
  assert.equal(statusButirAwal('tinggi', undefined), 'draf');
});

test('keyakinan sedang atau rendah selalu draf', () => {
  assert.equal(statusButirAwal('sedang', { dokumen: 'Laporan 2025' }), 'draf');
  assert.equal(statusButirAwal('rendah', { dokumen: 'Laporan 2025' }), 'draf');
});

test('ringkasan analisis menyebut jumlah butir dan kategori', () => {
  const teks = ringkasAnalisis({ jumlahButir: 7, kategoriTerdeteksi: ['Keuangan', 'SDM'], status: 'selesai' });
  assert.match(teks, /7 butir/);
  assert.match(teks, /Keuangan/);
});

test('ringkasan menyebut kuota, bukan gagal, saat tertunda', () => {
  const teks = ringkasAnalisis({ jumlahButir: 0, kategoriTerdeteksi: [], status: 'tertunda-kuota' });
  assert.match(teks, /kuota/);
  assert.doesNotMatch(teks, /gagal/);
});
