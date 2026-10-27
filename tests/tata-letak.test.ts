import test from 'node:test';
import assert from 'node:assert/strict';
import { susunUlangWidget } from '../src/services/rag/http';

const kpi = (i: number) => ({ type: 'kpi', title: `KPI ${i}`, grid: { x: 0, y: 99, w: 4, h: 3 } });
const grafik = (i: number) => ({ type: 'line', title: `Grafik ${i}`, grid: { x: 0, y: 99, w: 4, h: 3 } });
const tabel = { type: 'table', title: 'Tabel', grid: { x: 0, y: 99, w: 4, h: 3 } };
const narasi = { type: 'narasi', title: 'Narasi', grid: { x: 0, y: 99, w: 4, h: 3 } };

test('KPI dibatasi 6 kartu walau area menyumbang banyak', () => {
  const hasil = susunUlangWidget([...Array.from({ length: 9 }, (_, i) => kpi(i)), tabel]);
  const jumlahKpi = hasil.filter((w: any) => w.type === 'kpi').length;
  assert.equal(jumlahKpi, 6, 'maksimal 6 kartu KPI');
  assert.equal(hasil.length, 7, 'KPI berlebih dibuang, tabel tetap ada');
});

test('semua KPI berada di paling atas, sebelum grafik dan tabel', () => {
  const hasil = susunUlangWidget([grafik(1), kpi(1), tabel, kpi(2), narasi, kpi(3)]);
  const tipe = hasil.map((w: any) => w.type);
  const idxKpiTerakhir = tipe.lastIndexOf('kpi');
  const idxNonKpiPertama = tipe.findIndex((t: string) => t !== 'kpi');
  assert.ok(idxKpiTerakhir < idxNonKpiPertama, 'tidak boleh ada grafik/tabel yang mendahului KPI');
});

test('tata letak: KPI 3 per baris, grafik 2 per baris, tabel selebar kanvas', () => {
  const hasil = susunUlangWidget([...Array.from({ length: 6 }, (_, i) => kpi(i)), grafik(1), grafik(2), tabel, narasi]);
  const gridKpi = hasil.filter((w: any) => w.type === 'kpi').map((w: any) => w.grid);
  assert.deepEqual(gridKpi.slice(0, 3).map((g: any) => [g.x, g.y]), [[0, 0], [4, 0], [8, 0]]);
  assert.deepEqual(gridKpi.slice(3, 6).map((g: any) => [g.x, g.y]), [[0, 3], [4, 3], [8, 3]]);
  assert.equal(hasil.find((w: any) => w.type === 'table')!.grid.w, 12);
  assert.equal(hasil.find((w: any) => w.type === 'narasi')!.grid.w, 12);
  const grafikGrid = hasil.filter((w: any) => w.type === 'line').map((w: any) => w.grid);
  assert.equal(grafikGrid[0].w, 6);
  assert.equal(grafikGrid[1].x, 6, 'grafik kedua di sebelah kanan grafik pertama');
});

test('grid tidak pernah tumpang tindih ke luar 12 kolom', () => {
  const hasil = susunUlangWidget([...Array.from({ length: 6 }, (_, i) => kpi(i)), grafik(1), grafik(2), tabel]);
  for (const w of hasil) {
    assert.ok(w.grid.x + w.grid.w <= 12, `widget ${w.title} melewati 12 kolom`);
  }
});
