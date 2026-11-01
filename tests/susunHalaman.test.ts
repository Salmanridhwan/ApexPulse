import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAKS_KARTU_PER_HALAMAN,
  MAKS_KPI_PER_HALAMAN,
  buangKembar,
  gayaDariPermintaan,
  pilihChart,
  susunDashboardBerhalaman,
} from '../src/services/builder/susunHalaman';
import { DAFTAR_CHART } from '../src/services/chart/chartDefault';
import type { WidgetSpec } from '../src/types';

const kpi = (title: string, value: number, category = 'Keuangan'): WidgetSpec =>
  ({ id: '', type: 'kpi', title, category, confidence: 'sumber', kpi: { value, unit: 'Rp' }, citations: [], grid: { x: 0, y: 0, w: 3, h: 2 } }) as any;

const grafik = (title: string, type: any, category: string, data = [1, 2, 3, 4], xAxis = ['2021', '2022', '2023', '2024']): WidgetSpec =>
  ({
    id: '',
    type,
    title,
    category,
    confidence: 'sumber',
    chart: { xAxis, series: [{ name: title, data }] },
    citations: [],
    grid: { x: 0, y: 0, w: 6, h: 4 },
  }) as any;

const contoh = (): WidgetSpec[] => [
  kpi('Pendapatan usaha', 120),
  kpi('Laba bersih', 30),
  kpi('Pelanggan aktif', 1000, 'Pelayanan'),
  kpi('NRW', 34, 'Operasional'),
  grafik('Pendapatan per tahun', 'bar', 'Keuangan'),
  grafik('Beban usaha', 'line', 'Keuangan', [5, 6, 7, 8]),
  grafik('Komposisi beban', 'donut', 'Keuangan', [10, 20, 30], ['Gaji', 'Listrik', 'Bahan']),
  grafik('Produksi air', 'area', 'Operasional', [9, 8, 7, 6]),
  grafik('Kebocoran per zona', 'bar', 'Operasional', [3, 4, 5], ['Zona Utara Kota Lama', 'Zona Selatan Kota Baru', 'Zona Tengah']),
  grafik('Pengaduan per jenis', 'pie', 'Pelayanan', [1, 2, 3, 4, 5, 6, 7, 8], ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']),
  grafik('Pengaduan per bulan', 'bar', 'Pelayanan', [11, 12, 13, 14]),
  // Kembar: judul sama dengan yang di atas.
  grafik('Pendapatan per tahun', 'line', 'Keuangan', [99, 98, 97, 96]),
];

test('widget kembar dibuang (judul sama atau angka sama)', () => {
  const hasil = buangKembar(contoh());
  assert.equal(hasil.filter((w) => w.title === 'Pendapatan per tahun').length, 1);
  const angkaSama = buangKembar([grafik('A', 'bar', 'Keuangan'), grafik('B', 'bar', 'Keuangan')]);
  assert.equal(angkaSama.length, 1);
});

test('setiap grafik memakai chart dari katalog Template Chart', () => {
  const { halaman } = susunDashboardBerhalaman(contoh());
  for (const h of halaman) {
    for (const w of h.widgets) {
      assert.ok(w.chartId, `${w.title} tanpa chartId`);
      assert.ok(DAFTAR_CHART.includes(w.chartId as any), `${w.chartId} bukan chart katalog`);
    }
  }
});

test('dashboard dibagi ke beberapa halaman, tanpa data kembar antar halaman', () => {
  const { halaman } = susunDashboardBerhalaman(contoh());
  assert.ok(halaman.length >= 2, `hanya ${halaman.length} halaman`);
  const judul = halaman.flatMap((h) => h.widgets.map((w) => w.title));
  assert.equal(new Set(judul).size, judul.length, 'ada judul kembar antar halaman');
});

test('setiap halaman muat satu layar', () => {
  const banyak = Array.from({ length: 20 }, (_, i) => grafik(`Grafik ${i}`, 'bar', 'Keuangan', [i, i + 1, i + 2]));
  const { halaman } = susunDashboardBerhalaman([...banyak, ...Array.from({ length: 9 }, (_, i) => kpi(`KPI ${i}`, i + 100))]);
  for (const h of halaman) {
    const nKpi = h.widgets.filter((w) => w.type === 'kpi').length;
    assert.ok(nKpi <= MAKS_KPI_PER_HALAMAN, `${h.judul}: ${nKpi} KPI`);
    assert.ok(h.widgets.length - nKpi <= MAKS_KARTU_PER_HALAMAN, `${h.judul}: terlalu banyak kartu`);
  }
});

test('judul dashboard mengikuti isi halaman', () => {
  const { title, halaman } = susunDashboardBerhalaman(contoh(), { instansi: 'PAM Jaya' });
  assert.match(title, /PAM Jaya$/);
  const topik = halaman.map((h) => h.judul).filter((j) => !j.startsWith('Ringkasan'));
  assert.ok(topik.some((t) => title.includes(t.replace(/\s*\(\d+\)$/, ''))), `${title} tidak menyebut topik ${topik}`);
});

test('pemilihan chart sesuai bentuk data', () => {
  assert.equal(pilihChart(grafik('x', 'pie', 'Umum', [1, 2, 3, 4, 5, 6, 7], ['a', 'b', 'c', 'd', 'e', 'f', 'g'])).chartId, 'bar-mendatar-peringkat');
  assert.equal(pilihChart(grafik('x', 'donut', 'Umum', [1, 2], ['a', 'b'])).chartId, 'donat-tebal');
  assert.equal(pilihChart(grafik('x', 'bar', 'Umum', [1, 2, 3], ['Nama kategori sangat panjang', 'Kategori kedua panjang', 'Kategori ketiga'])).chartId, 'bar-mendatar-peringkat');
  assert.equal(pilihChart(grafik('x', 'bar', 'Umum', [1, 2, 3, 4], ['Jan', 'Feb', 'Mar', 'Apr'])).chartId, 'bar-tegak');
  assert.equal(pilihChart(grafik('x', 'heatmap', 'Umum')).chartId, 'bar-mendatar-peringkat');
});

test('gaya bisa diminta lewat kalimat', () => {
  assert.equal(gayaDariPermintaan('buatkan dashboard keuangan gaya lensa'), 'analitik');
  assert.equal(gayaDariPermintaan('buatkan dashboard pakai nadi'), 'trafik');
  assert.equal(gayaDariPermintaan('buatkan dashboard'), undefined);
  const { halaman } = susunDashboardBerhalaman(contoh(), { desain: 'ringkasan' });
  assert.ok(halaman.every((h) => h.widgets.every((w) => w.style?.desain === 'ringkasan')));
});

test('deret waktu panjang tetap batang tegak, dua seri tidak hilang', () => {
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const w = grafik('Pendapatan bulanan', 'bar', 'Keuangan', bulan.map((_, i) => i), bulan);
  (w as any).chart.series.push({ name: 'Beban', data: bulan.map((_, i) => i / 2) });
  assert.equal(pilihChart(w).chartId, 'bar-tegak');
});

test('gaya kaca bisa diminta lewat kalimat', () => {
  assert.equal(gayaDariPermintaan('buatkan dashboard keuangan gaya kaca'), 'kaca');
  assert.equal(gayaDariPermintaan('buat dashboard glassy'), 'kaca');
});
