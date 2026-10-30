import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIPE_VISUALISASI } from '../src/services/spec/widgetTypes';
import { opsiPratinjau } from '../src/services/chart/pratinjauTipe';

/**
 * Penjaga tab Default Chart: setiap tipe wajib punya pratinjau yang benar-benar
 * menghasilkan sesuatu. Kalau ada tipe baru tanpa pratinjau, tes ini gagal dan
 * halaman tidak diam-diam menampilkan kartu kosong.
 */

test('semua tipe punya pratinjau', () => {
  for (const t of TIPE_VISUALISASI) {
    const hasil = opsiPratinjau(t.type);
    assert.ok(hasil, `${t.type} tidak punya pratinjau`);
  }
});

test('pratinjau kanvas selalu punya seri', () => {
  for (const t of TIPE_VISUALISASI) {
    const hasil = opsiPratinjau(t.type);
    if (hasil.mesin !== 'echarts') continue;
    const seri = Array.isArray(hasil.opsi.series) ? hasil.opsi.series : [hasil.opsi.series];
    assert.ok(seri.length > 0, `${t.type} tidak punya seri`);
  }
});

test('pratinjau kanvas bergaya sama: legenda di bawah, tipografi 9,5', () => {
  const hasil = opsiPratinjau('bar');
  assert.equal(hasil.mesin, 'echarts');
  if (hasil.mesin !== 'echarts') return;
  assert.equal(hasil.opsi.legend.bottom, 0);
  assert.equal(hasil.opsi.textStyle.fontSize, 9.5);
  assert.equal(hasil.opsi.textStyle.fontFamily.includes('Plus Jakarta Sans'), true);
});

test('deret bantu tidak masuk legenda', () => {
  const wf = opsiPratinjau('waterfall');
  if (wf.mesin !== 'echarts') return assert.fail('waterfall harus kanvas');
  assert.deepEqual(wf.opsi.legend.data, ['Perubahan']);

  const fc = opsiPratinjau('forecast');
  if (fc.mesin !== 'echarts') return assert.fail('forecast harus kanvas');
  assert.deepEqual(fc.opsi.legend.data, ['Aktual', 'Proyeksi', 'Pita keyakinan']);
});

test('legenda menyebut komponen, bukan deret tanpa nama', () => {
  for (const t of TIPE_VISUALISASI) {
    const hasil = opsiPratinjau(t.type);
    if (hasil.mesin !== 'echarts') continue;
    const legenda = hasil.opsi.legend;
    if (!legenda || legenda.show === false) continue;
    const seri = Array.isArray(hasil.opsi.series) ? hasil.opsi.series : [hasil.opsi.series];
    const nama = seri.map((s: any) => s?.name).filter(Boolean);
    assert.ok(nama.length > 0 || (legenda.data ?? []).length > 0, `${t.type} legenda tanpa nama`);
  }
});

test('tipe bukan kanvas tetap punya jenis', () => {
  for (const tipe of ['kpi', 'bullet-target', 'table', 'narasi', 'map', 'gantt']) {
    const hasil = opsiPratinjau(tipe);
    assert.equal(hasil.mesin, 'html', `${tipe} harus html`);
    if (hasil.mesin === 'html') assert.ok(hasil.jenis, `${tipe} tanpa jenis`);
  }
});

test('legenda pai dan donat di sebelah kanan', () => {
  for (const tipe of ['pie', 'donut']) {
    const hasil = opsiPratinjau(tipe);
    if (hasil.mesin !== 'echarts') return assert.fail(`${tipe} harus kanvas`);
    const leg = hasil.opsi.legend;
    assert.equal(leg.orient, 'vertical', `${tipe} legenda harus tegak`);
    assert.ok(typeof leg.right === 'number', `${tipe} legenda harus menempel kanan`);
    // Donat/pai digeser ke kiri supaya tidak tertimpa legenda.
    const seri = Array.isArray(hasil.opsi.series) ? hasil.opsi.series[0] : hasil.opsi.series;
    const cx = Number(String(seri.center[0]).replace('%', ''));
    assert.ok(cx < 45, `${tipe} pusat lingkaran harus di kiri, bukan ${seri.center[0]}`);
  }
});

test('mode gelap memakai warna terang, bukan warna mode terang', () => {
  const terang = opsiPratinjau('bar', 'light');
  const gelap = opsiPratinjau('bar', 'dark');
  if (terang.mesin !== 'echarts' || gelap.mesin !== 'echarts') return assert.fail('bar harus kanvas');

  assert.equal(terang.opsi.textStyle.color, '#4b5563');
  assert.equal(gelap.opsi.textStyle.color, '#9aa3b2');
  assert.notEqual(gelap.opsi.textStyle.color, terang.opsi.textStyle.color);

  const gridGelap = gelap.opsi.yAxis.splitLine.lineStyle.color;
  assert.equal(gridGelap, '#1e2633');
});

test('donat mode gelap memakai warna kartu, bukan putih', () => {
  const gelap = opsiPratinjau('donut', 'dark');
  if (gelap.mesin !== 'echarts') return assert.fail('donut harus kanvas');
  const seri = Array.isArray(gelap.opsi.series) ? gelap.opsi.series[0] : gelap.opsi.series;
  assert.equal(seri.itemStyle.borderColor, '#0f141d');
});
