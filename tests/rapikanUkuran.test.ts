/**
 * PENYESUAIAN CHART TERHADAP UKURAN KARTU.
 *
 * Semua chart katalog digambar lewat satu fungsi (`rapikanUntukUkuran`), jadi
 * tes ini adalah pagar agar tidak ada lagi kartu dengan legenda bertumpuk atau
 * sumbu terpotong saat layar dikecilkan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { rapikanUntukUkuran } from '../src/services/chart/rapikanUkuran';

const opsi = () =>
  ({
    textStyle: { fontSize: 12 },
    legend: { data: ['a', 'b'] },
    xAxis: { type: 'category', name: 'Bulan', axisLabel: { rotate: 45 } },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: [1, 2] }, { type: 'pie', data: [3] }],
    grid: { left: 40 },
  }) as any;

test('kartu sempit menyembunyikan legenda, kartu lebar mempertahankannya', () => {
  assert.equal((rapikanUntukUkuran(opsi(), 300, 240) as any).legend.show, false);
  assert.equal((rapikanUntukUkuran(opsi(), 900, 380) as any).legend.show, true);
});

test('huruf sumbu mengecil dan label panjang dipotong di kartu sempit', () => {
  const hasil: any = rapikanUntukUkuran(opsi(), 320, 240);
  assert.equal(hasil.xAxis.axisLabel.fontSize, 9);
  assert.equal(hasil.xAxis.axisLabel.overflow, 'truncate');
  assert.equal(hasil.xAxis.name, '');
});

test('containLabel selalu aktif supaya sumbu tidak keluar kartu', () => {
  assert.equal((rapikanUntukUkuran(opsi(), 700, 300) as any).grid.containLabel, true);
});

test('label bagian hanya tampil saat kartu cukup besar', () => {
  const sempit: any = rapikanUntukUkuran(opsi(), 300, 220);
  const lapang: any = rapikanUntukUkuran(opsi(), 700, 320);
  assert.equal(sempit.series[1].label.show, false);
  assert.equal(lapang.series[1].label.show, true);
});

test('semua seri memakai hideOverlap agar label tidak saling menimpa', () => {
  const hasil: any = rapikanUntukUkuran(opsi(), 500, 260);
  assert.ok(hasil.series.every((s: any) => s.labelLayout.hideOverlap === true));
});

test('opsi tanpa legenda/sumbu tidak dirusak', () => {
  const hasil: any = rapikanUntukUkuran({ series: [{ type: 'treemap', data: [] }] } as any, 260, 200);
  assert.equal(hasil.series[0].breadcrumb.show, false);
  assert.equal(hasil.legend, undefined);
});

test('kartu sempit tetap menggambar semua kategori, tanpa dataZoom', () => {
  const banyak = {
    xAxis: { type: 'category', data: Array.from({ length: 36 }, (_, i) => `Akun ${i}`) },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: new Array(36).fill(1) }],
  } as any;
  const hasil: any = rapikanUntukUkuran(banyak, 470, 188);
  assert.equal(hasil.dataZoom, undefined, 'tidak ada pemotongan data');
  assert.equal(hasil.xAxis.data.length, 36);
  assert.equal(hasil.xAxis.axisLabel.hideOverlap, true, 'label dijarangkan, bukan bertumpuk');
});

test('petak treemap memotong nama panjang supaya tidak keluar petak', () => {
  const petak = { series: [{ type: 'treemap', data: [{ name: 'PDTP USAHA FACILITY SERVICES', value: 1 }] }] } as any;
  const hasil: any = rapikanUntukUkuran(petak, 300, 200);
  assert.equal(hasil.series[0].label.overflow, 'truncate');
  const teks = hasil.series[0].label.formatter({ name: 'PDTP USAHA FACILITY SERVICES JAKARTA BANDUNG', value: 1 });
  assert.ok(String(teks).length < 40, 'nama dipotong');
});

test('label petak tidak boleh dicetak tebal', async () => {
  const { treemapPorsi } = await import('../src/services/chart/pembangunOpsi');
  const g: any = { aksen: '#3b82f6', latar: '#171a1f', kartu: '#171a1f', teks: '#fff', teks2: '#aaa', teks3: '#888',
    palet: ['#3b82f6', '#38bdf8'], sudut: 8, hijau: '#22c55e', merah: '#ef4444', gradasi: 'y' };
  const o: any = (treemapPorsi as any)({ kategori: ['A', 'B'], seri: [{ nama: 'Des', data: [3, 2] }], satuan: '', desimal: 0 }, g, 1);
  assert.ok(!o.series[0].label.fontWeight || Number(o.series[0].label.fontWeight) <= 400, 'bobot label petak normal');
});
