import test from 'node:test';
import assert from 'node:assert/strict';
import { hitungBarisKanvas, lebarKolom, tinggiBaris, KOLOM_KANVAS } from '../src/services/tataLetak/satuHalaman';

/**
 * Dashboard harus tampil penuh dalam SATU layar tanpa scroll. Yang mudah salah:
 * jumlah baris tidak sama dengan cara CSS grid menempatkan kartu (sehingga tinggi
 * yang dihitung kurang dan halaman tetap bisa digeser), dan pembagian tinggi yang
 * menyisakan celah/gulir 1-2 piksel.
 */
const g = (w: number) => ({ grid: { x: 0, y: 0, w, h: 3 } });
/** Kartu KPI: berapa pun jumlahnya, semua duduk di satu baris. */
const kpi = (w = 3) => ({ type: 'kpi', grid: { x: 0, y: 0, w, h: 3 } });
const grafik = (w: number) => ({ type: 'line', grid: { x: 0, y: 0, w, h: 4 } });

test('lebar kartu dipetakan ke kolom 12 seperti kelas col-span', () => {
  assert.equal(lebarKolom(12), 12);
  assert.equal(lebarKolom(10), 12);
  assert.equal(lebarKolom(8), 8);
  assert.equal(lebarKolom(7), 8);
  assert.equal(lebarKolom(6), 6);
  assert.equal(lebarKolom(5), 6);
  assert.equal(lebarKolom(4), 4);
  assert.equal(lebarKolom(3), 3);
  assert.equal(lebarKolom(2), 2);
  assert.equal(lebarKolom(undefined), 6);
});

test('tanpa widget tidak butuh baris', () => {
  assert.equal(hitungBarisKanvas([]), 0);
});

test('empat KPI selebar 3 kolom muat dalam satu baris', () => {
  assert.equal(hitungBarisKanvas([g(3), g(3), g(3), g(3)]), 1);
  assert.equal(4 * lebarKolom(3), KOLOM_KANVAS);
});

test('kartu yang tidak cukup kolom pindah ke baris berikutnya', () => {
  // 8 + 6 = 14 > 12 → dua baris.
  assert.equal(hitungBarisKanvas([g(8), g(6)]), 2);
  // 6 + 6 = 12 → satu baris.
  assert.equal(hitungBarisKanvas([g(6), g(6)]), 1);
});

test('tabel selebar kanvas selalu memakai baris sendiri', () => {
  assert.equal(hitungBarisKanvas([g(6), g(12)]), 2);
});

test('enam KPI tetap satu baris (tidak pecah 4 + 2)', () => {
  // Lebar grid.w KPI diabaikan kanvas: 6 kartu KPI = 1 baris.
  assert.equal(hitungBarisKanvas([kpi(), kpi(), kpi(), kpi(), kpi(), kpi()]), 1);
  // Berapa pun lebar yang tercatat, KPI tidak pernah menambah baris.
  assert.equal(hitungBarisKanvas([kpi(12), kpi(12), kpi(12)]), 1);
});

test('baris KPI dihitung sekali, sisanya memasang grid seperti biasa', () => {
  // 6 KPI (1 baris) + 2 grafik selebar 6 (1 baris) + narasi 12 (1 baris) = 3.
  assert.equal(hitungBarisKanvas([kpi(), kpi(), kpi(), kpi(), kpi(), kpi(), grafik(6), grafik(6), grafik(12)]), 3);
  // Tanpa KPI, hitungan murni grid.
  assert.equal(hitungBarisKanvas([grafik(6), grafik(6)]), 1);
});

test('dashboard 18 kartu tidak dianggap muat satu baris', () => {
  const widget = [
    ...Array.from({ length: 6 }, () => g(4)), // KPI: 3 per baris → 2 baris
    ...Array.from({ length: 10 }, () => g(6)), // grafik: 2 per baris → 5 baris
    g(12), // tabel
    g(12), // narasi
  ];
  assert.equal(hitungBarisKanvas(widget), 9);
});

test('tinggi baris dibagi rata tanpa menyisakan ruang (tidak ada gulir)', () => {
  const jarak = 10;
  const { tinggi, skala } = tinggiBaris(800, 5, jarak, 84);
  assert.equal(skala, 1);
  assert.equal(tinggi, Math.floor((800 - jarak * 4) / 5));
  assert.ok(5 * tinggi + jarak * 4 <= 800, 'total tidak melebihi ruang');
});

test('kalau baris minimum tidak cukup, grid diperkecil agar tetap satu layar', () => {
  const jarak = 10;
  const baris = 9;
  const { tinggi, skala } = tinggiBaris(400, baris, jarak, 84);
  assert.equal(tinggi, 84, 'baris memakai tinggi minimum');
  assert.ok(skala < 1, 'grid diperkecil');
  const totalSetelahSkala = (baris * 84 + jarak * (baris - 1)) * skala;
  assert.ok(totalSetelahSkala <= 400 + 0.001, 'setelah diskalakan tetap muat satu layar');
});

test('ruang kosong / tanpa baris tidak menghasilkan skala aneh', () => {
  assert.deepEqual(tinggiBaris(0, 5, 10, 84), { tinggi: 0, skala: 1 });
  assert.deepEqual(tinggiBaris(800, 0, 10, 84), { tinggi: 0, skala: 1 });
});
