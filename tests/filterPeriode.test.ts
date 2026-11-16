/**
 * FILTER PERIODE — aturan yang membuat "pindah periode" benar-benar mengubah
 * halaman. Diuji tanpa React karena logikanya ada di `services/filter/periode`.
 *
 * Keadaan nyata yang melatari tes ini: dari 81 kartu satu dashboard hanya 4 yang
 * punya `periodeData` bulanan (Jan–Sep 2026), sisanya tanpa dimensi waktu sama
 * sekali. Jadi aturannya harus (a) mengubah isi kartu yang punya periode, dan
 * (b) tidak mengosongkan papan.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { WidgetSpec } from '../src/types';
import {
  cocokPeriode,
  indeksBulan,
  periodeTersedia,
  potongSumbuPeriode,
  tahunDari,
  terapkanPeriode,
  urutPeriode,
} from '../src/services/filter/periode';

const kartu = (isi: Partial<WidgetSpec>): WidgetSpec =>
  ({ id: 'w', title: 'kartu', type: 'kpi', confidence: 'tinggi', grid: { x: 0, y: 0, w: 3, h: 2 }, citations: [], ...isi }) as WidgetSpec;

const bulanan = (periode: string[]) =>
  kartu({
    id: 'w-bulanan',
    type: 'line',
    chartId: 'garis-tren',
    chart: { xAxis: ['A', 'B'], series: [{ name: 'S', data: [1, 2] }] },
    periodeData: periode.map((p) => ({ periode: p, xAxis: ['A', 'B'], series: [{ name: 'S', data: [1, 2] }] })),
  });

test('pilihan periode memuat bulan dari periodeData, bukan hanya kolom periode', () => {
  const daftar = periodeTersedia([
    kartu({ periode: '2026' }),
    kartu({ periode: 'Okt 2026' }),
    bulanan(['Jan 2026', 'Feb 2026', 'Mar 2026']),
  ]);
  assert.deepEqual(daftar, ['2026', 'Jan 2026', 'Feb 2026', 'Mar 2026', 'Okt 2026']);
  assert.ok(daftar.includes('Feb 2026'), 'bulan dari periodeData ikut menjadi pilihan');
});

test('urutan periode kronologis: tahun dulu, lalu bulan', () => {
  assert.deepEqual(urutPeriode(['Okt 2026', 'Jan 2026', 'Des 2025', '2026']), ['Des 2025', '2026', 'Jan 2026', 'Okt 2026']);
  assert.equal(tahunDari('Okt 2026'), '2026');
  assert.equal(indeksBulan('Okt 2026'), 9);
  assert.equal(indeksBulan('catatan'), -1);
});

test('kartu tanpa dimensi waktu tetap tampil, papan tidak kosong', () => {
  const polos = kartu({});
  assert.equal(cocokPeriode(polos, 'Mei 2026'), true);
  assert.equal(cocokPeriode(polos, 'Semua'), true);
});

test('kartu bulanan cocok bila memuat periode itu', () => {
  const k = bulanan(['Jan 2026', 'Feb 2026', 'Mar 2026']);
  assert.equal(cocokPeriode(k, 'Feb 2026'), true);
  assert.equal(cocokPeriode(k, 'Jun 2026'), false, 'bulan yang tidak ada di kartu menyembunyikan kartunya');
  assert.equal(cocokPeriode(k, '2026'), true, 'pilih tahun saja: kartu bulanan tahun itu tetap tampil');
  assert.equal(cocokPeriode(k, '2027'), false);
});

test('kartu satu periode: tahun dan bulan harus sejalan, tahun saja tetap cocok', () => {
  assert.equal(cocokPeriode(kartu({ periode: 'Okt 2026' }), 'Okt 2026'), true);
  assert.equal(cocokPeriode(kartu({ periode: 'Okt 2026' }), 'Mei 2026'), false);
  assert.equal(cocokPeriode(kartu({ periode: 'Okt 2026' }), '2026'), true, 'pilih tahun 2026: kartu Oktober tetap tampil');
  assert.equal(cocokPeriode(kartu({ periode: '2027' }), 'Mei 2026'), false, 'beda tahun: disembunyikan');
  assert.equal(cocokPeriode(kartu({ periode: 'Jan' }), 'Jan 2026'), true, 'periode tanpa tahun dicocokkan lewat nama bulan');
});

test('grafik ber-sumbu bulan dipotong s.d. periode terpilih', () => {
  const sumbu = ['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'Mei 2026', 'Jun 2026', 'Jul 2026', 'Agu 2026', 'Sep 2026'];
  const potong = potongSumbuPeriode(sumbu, 'Mei 2026');
  assert.equal(potong.dipotong, true);
  assert.deepEqual(potong.xAxis, ['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'Mei 2026'], 'Jan–Mei, berakhir di periode terpilih');

  assert.equal(potongSumbuPeriode(sumbu, 'Semua').dipotong, false, 'tanpa filter sumbu utuh');
  assert.equal(potongSumbuPeriode(sumbu, '2026').dipotong, false, 'pilih setahun: semua bulan 2026 tetap tampil');
  assert.equal(potongSumbuPeriode(sumbu, 'Des 2025').dipotong, false, 'tidak ada titik sebelum periode itu: jangan dikosongkan');
  assert.equal(potongSumbuPeriode(sumbu, 'Feb 2027').dipotong, false, 'semua titik sudah lewat: utuh');
});

test('sumbu bulan tanpa tahun ikut dipotong lewat nama bulan', () => {
  const sumbu = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  assert.deepEqual(potongSumbuPeriode(sumbu, 'Mei 2026').xAxis, ['Jan', 'Feb', 'Mar', 'Apr', 'Mei']);
  assert.deepEqual(potongSumbuPeriode(sumbu, 'Agu').xAxis, ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu']);
});

test('sumbu bukan periode (nama akun) tidak pernah dipotong', () => {
  const sumbu = ['GAJI KARYAWAN', 'THR', 'JAMSOSTEK'];
  assert.equal(potongSumbuPeriode(sumbu, 'Mei 2026').dipotong, false);
});

test('terapkanPeriode memotong grafik biasa, membiarkan kartu ber-periodeData', () => {
  const biasa = kartu({
    id: 'w-biasa',
    type: 'line',
    chart: {
      unit: 'Rp',
      xAxis: ['Jan 2026', 'Feb 2026', 'Mar 2026'],
      series: [
        { name: 'A', data: [1, 2, 3] },
        { name: 'B', data: [4, 5, 6] },
      ],
    },
  });
  const Mei = terapkanPeriode(biasa, 'Feb 2026');
  assert.deepEqual(Mei.chart!.xAxis, ['Jan 2026', 'Feb 2026']);
  assert.deepEqual(Mei.chart!.series[0].data, [1, 2], 'data seri ikut dipotong sepanjang sumbu');
  assert.deepEqual(Mei.chart!.series[1].data, [4, 5]);

  const multi = kartu({ ...bulanan(['Jan 2026', 'Feb 2026', 'Mar 2026']) });
  assert.equal(terapkanPeriode(multi, 'Feb 2026'), multi, 'kartu ber-periodeData diurus WidgetCard, bukan di sini');
});
