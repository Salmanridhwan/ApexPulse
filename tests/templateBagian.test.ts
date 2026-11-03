import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DASHBOARD_TEMPLATES } from '../src/services/templates/dashboardTemplates';
import {
  TEMPLATE_BAGIAN,
  bagianDariPermintaan,
  halamanTemplateBagian,
  nomorHalamanBagian,
  templateBagianId,
  templateUntukInstansi,
} from '../src/services/templates/templateBagian';
import { buildOpsi, CHART_DEFAULT, DAFTAR_CHART, type ChartId } from '../src/services/chart/chartDefault';
import { contohData } from '../src/services/chart/contohData';
import { VARIAN } from '../src/services/chart/gayaVarian';
import { grafikKatalog, propsKatalogHtml } from '../src/services/chart/dataKatalogWidget';
import { chartKatalogCocok } from '../src/services/chart/katalogCocok';
import { halamanUntukPermintaan } from '../src/services/builder/halamanDiminta';
import { gayaDariPermintaan } from '../src/services/builder/susunHalaman';

const CHART_RAPAT: ChartId[] = ['kpi-target', 'papan-isu', 'tabel-status', 'alur-tahap', 'corong-pipeline', 'daftar-progres'];

test('satu template rapat manajemen terdaftar dengan gaya Korporat', () => {
  assert.equal(TEMPLATE_BAGIAN.length, 1);
  for (const t of TEMPLATE_BAGIAN) {
    assert.ok(DASHBOARD_TEMPLATES.includes(t), `${t.id} tidak ada di galeri`);
    assert.equal(t.tema, 'korporat');
    assert.ok(templateBagianId(t.id));
    const jumlah = t.bagian!.halaman.reduce((a, h) => a + h.jumlah, 0);
    assert.equal(jumlah, t.widgets.length, `${t.id}: jumlah kartu halaman tidak cocok`);
    assert.ok(t.bagian!.halaman.length >= 5, `${t.id}: halaman terlalu sedikit`);
  }
  const id = DASHBOARD_TEMPLATES.flatMap((t) => t.widgets.map((w) => w.id));
  assert.equal(new Set(id).size, id.length, 'id kartu kembar antar-template');
});

test('setiap kartu template bagian digambar wajah Template Chart', () => {
  for (const t of TEMPLATE_BAGIAN) {
    for (const w of t.widgets) {
      assert.ok(DAFTAR_CHART.includes(w.chartId as ChartId), `${w.title}: chartId ${w.chartId} tidak dikenal`);
      assert.ok(propsKatalogHtml(w) !== null || grafikKatalog(w), `${t.id} / ${w.title}: tidak memakai renderer katalog`);
    }
  }
});

test('chart rapat ada di semua gaya dan berbentuk HTML', () => {
  for (const id of CHART_RAPAT) {
    assert.equal(CHART_DEFAULT[id].kelompok, 'rapat');
    for (const v of VARIAN) {
      const hasil: any = buildOpsi(id, contohData(id), v);
      assert.equal(hasil.cadangan, false, `${id}/${v} jatuh ke cadangan`);
      assert.equal(hasil.opsi?.mesin, 'html');
      assert.equal(hasil.opsi?.jenis, id);
    }
  }
  // Kartu KPI gaya Korporat punya wajah sendiri.
  assert.equal((buildOpsi('kpi-kartu', contohData('kpi-kartu'), 'korporat').opsi as any).jenis, 'kpi-korporat');
});

test('halaman bagian dipotong sesuai urutan kartu', () => {
  const t = TEMPLATE_BAGIAN[0];
  const hal = halamanTemplateBagian(t);
  assert.equal(hal[0].judul, 'Executive Summary');
  assert.equal(hal[0].widgets[0].title, 'Pendapatan');
  assert.equal(hal.at(-1)!.judul, 'Target & KPI 2027');
  assert.ok(hal.at(-1)!.widgets.filter((w) => w.type !== 'narasi').every((w) => w.chartId === 'kpi-target'));
  assert.equal(nomorHalamanBagian('tpl-bagian-rapat#4'), 4);
  assert.equal(nomorHalamanBagian('tpl-bagian-rapat'), 1);
});

test('kartu sasaran dan tabel status memetakan isi widget', () => {
  const t = TEMPLATE_BAGIAN[0];
  const sasaran = t.widgets.find((w) => w.chartId === 'kpi-target' && w.title === 'Umur Piutang')!;
  const p = propsKatalogHtml(sasaran)!;
  assert.equal(p.data.target, 40);
  assert.equal(p.data.arahBaik, 'turun');
  assert.ok(chartKatalogCocok(sasaran).includes('kpi-target'));
  const isu = t.widgets.find((w) => w.chartId === 'papan-isu')!;
  assert.equal(propsKatalogHtml(isu)!.data.tabel!.kepala.at(-1), 'Prioritas');
});

test('asisten memakai susunan deck untuk rapat, bukan untuk kata umum', () => {
  assert.equal(bagianDariPermintaan('buatkan dashboard rapat procurement')?.id, 'tpl-bagian-rapat');
  assert.equal(bagianDariPermintaan('meeting bagian penjualan 2026')?.id, 'tpl-bagian-rapat');
  assert.equal(bagianDariPermintaan('dashboard penjualan air PDAM'), undefined);
  const { halaman, bawaan } = halamanUntukPermintaan('dashboard rapat manajemen', 'aneka_usaha');
  assert.equal(bawaan, true);
  assert.equal(halaman[0].judul, 'Executive Summary');
  assert.ok(halaman[0].butir.includes('Laba Bersih'));
  assert.equal(gayaDariPermintaan('pakai gaya korporat'), 'korporat');
});

test('nama template rapat mengikuti instansi yang login', () => {
  const t = templateUntukInstansi(TEMPLATE_BAGIAN[0], 'Perumda Tirta Kencana');
  assert.equal(t.nama, 'Rapat Perumda Tirta Kencana');
  assert.match(t.judulDashboard, /Perumda Tirta Kencana/);
  assert.equal(t.bagian!.unit, 'Rapat Manajemen Perumda Tirta Kencana');
  assert.equal(templateUntukInstansi(TEMPLATE_BAGIAN[0], undefined), TEMPLATE_BAGIAN[0]);
  const lain = DASHBOARD_TEMPLATES.find((x) => !x.bagian)!;
  assert.equal(templateUntukInstansi(lain, 'X'), lain);
});
