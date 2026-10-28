import test from 'node:test';
import assert from 'node:assert/strict';
import { narasiInsight, susunSlide, MAKS_WIDGET_PER_SLIDE } from '../src/services/presentasi/slide';
import type { WidgetSpec } from '../src/types';

/**
 * Mode presentasi dipakai juga oleh galeri TEMPLATE (pratinjau). Di sana widget
 * belum punya narasi dari RAG, jadi narasi dihitung dari angka widget itu sendiri.
 * Dua hal yang mudah salah dan pernah terlihat di layar:
 *   1. label delta yang sudah memuat persen ditambah persen lagi
 *      → "naik 6.8% +6,8% vs target";
 *   2. slide KPI dipecah terlalu kecil sehingga presentasi jadi panjang.
 */
const kpi = (deltaLabel: string, delta = 6.8): WidgetSpec =>
  ({
    id: 'k1',
    type: 'kpi',
    title: 'Pendapatan',
    confidence: 'inferensi AI',
    grid: { x: 0, y: 0, w: 3, h: 3 },
    kpi: { value: '128,4', unit: 'Miliar Rp', delta, deltaLabel, sparkline: [1, 2] },
  }) as unknown as WidgetSpec;

test('label delta yang sudah memuat persen tidak digandakan', () => {
  const teks = narasiInsight(kpi('+6,8% vs target'));
  assert.equal(teks, 'Nilai saat ini 128,4 Miliar Rp, naik +6,8% vs target.');
  assert.equal(teks.match(/%/g)?.length, 1, 'persen hanya muncul sekali');
});

test('label delta tanpa persen tetap diberi angka delta', () => {
  const teks = narasiInsight(kpi('dibanding bulan lalu'));
  assert.equal(teks, 'Nilai saat ini 128,4 Miliar Rp, naik 6.8% dibanding bulan lalu.');
});

test('delta negatif dibaca sebagai turun', () => {
  const teks = narasiInsight(kpi('-1,4% dari pagu', -1.4));
  assert.equal(teks, 'Nilai saat ini 128,4 Miliar Rp, turun -1,4% dari pagu.');
});

test('KPI dikelompokkan di slide pertama, bukan disebar', () => {
  const widgets: WidgetSpec[] = [];
  for (let i = 0; i < 6; i += 1) {
    widgets.push({
      id: `k${i}`,
      type: 'kpi',
      title: `KPI ${i}`,
      confidence: 'inferensi AI',
      grid: { x: 0, y: 0, w: 3, h: 3 },
      kpi: { value: i, unit: 'poin' },
    } as unknown as WidgetSpec);
  }
  for (let i = 0; i < 3; i += 1) {
    widgets.push({
      id: `g${i}`,
      type: 'bar',
      title: `Grafik ${i}`,
      confidence: 'inferensi AI',
      grid: { x: 0, y: 0, w: 6, h: 4 },
      chart: { xAxis: ['A', 'B'], series: [{ name: 'S', data: [1, 2] }] },
    } as unknown as WidgetSpec);
  }

  const slides = susunSlide(widgets);
  assert.ok(slides.length >= 2, 'harus ada slide ringkasan dan slide grafik');
  assert.ok(slides[0].widgetIds.every((id) => id.startsWith('k')), 'slide pertama berisi KPI');
  assert.equal(slides[0].widgetIds.length, 6, 'enam KPI tetap satu slide');
  for (const s of slides) {
    assert.ok(s.widgetIds.length <= MAKS_WIDGET_PER_SLIDE + 2, 'slide tidak melebihi batas');
  }
});

test('widget tanpa isi tidak dipresentasikan', () => {
  const kosong = {
    id: 'x',
    type: 'kpi',
    title: 'Kosong',
    confidence: 'inferensi AI',
    grid: { x: 0, y: 0, w: 3, h: 3 },
    dataKosong: true,
  } as unknown as WidgetSpec;
  assert.deepEqual(susunSlide([kosong]), []);
});
