import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bersihkanRancangan, pakaiRancangan, terapkanRancangan } from '../src/services/chart/rancanganRag';
import { mintaTemplateChart, susunDashboardBerhalaman } from '../src/services/builder/susunHalaman';
import { payloadKeWidgetSpec } from '../src/services/rag/http';
import type { WidgetSpec } from '../src/types';

test('desain mentah RAG dibersihkan: warna sah saja, teks dipotong, nilai asing dibuang', () => {
  const r = bersihkanRancangan(
    { warna: ['#0ea5e9', 'merah', '#F97316', 'javascript:x'], judulSumbuNilai: 'Juta m³', legenda: 'miring', tumpuk: 'ya', tampilkanNilai: true },
    'line'
  );
  assert.deepEqual(r, { bentuk: 'line', warna: ['#0ea5e9', '#F97316'], judulSumbuNilai: 'Juta m³', tampilkanNilai: true });
  assert.deepEqual(bersihkanRancangan(null, 'bar'), { bentuk: 'bar' });
});

test('rancangan diterapkan ke opsi ECharts: warna, judul sumbu, tumpuk, label, legenda', () => {
  const dasar = {
    xAxis: { type: 'category', data: ['Jan', 'Feb'] },
    yAxis: { type: 'value' },
    grid: { left: 8, bottom: 8 },
    legend: { bottom: 0 },
    series: [{ type: 'bar', data: [1, 2] }, { type: 'line', data: [3, 4] }],
  };
  const o = terapkanRancangan(dasar, {
    bentuk: 'bar',
    warna: ['#111111', '#222222'],
    judulSumbuKategori: 'Bulan',
    judulSumbuNilai: 'Rp miliar',
    tumpuk: true,
    tampilkanNilai: true,
    legenda: 'tidak',
    garisHalus: true,
  });
  assert.deepEqual(o.color, ['#111111', '#222222']);
  assert.equal(o.xAxis.name, 'Bulan');
  assert.equal(o.yAxis.name, 'Rp miliar');
  assert.equal(o.series[0].stack, 'total');
  assert.equal(o.series[0].itemStyle.color, '#111111');
  assert.equal(o.series[1].smooth, true);
  assert.equal(o.series[0].label.show, true);
  assert.equal(o.legend.show, false);
  // Opsi asal tidak diubah.
  assert.equal((dasar.xAxis as any).name, undefined);
});

test('rancangan dipakai hanya selama belum memilih chart katalog atau gaya template', () => {
  const r = { bentuk: 'line' };
  assert.equal(pakaiRancangan({ rancangan: r } as any), true);
  assert.equal(pakaiRancangan({ rancangan: r, chartId: 'garis-tren' } as any), false);
  assert.equal(pakaiRancangan({ rancangan: r, style: { desain: 'analitik' } } as any), false);
  assert.equal(pakaiRancangan({} as any), false);
});

test('permintaan template chart dikenali', () => {
  assert.equal(mintaTemplateChart('buat dashboard PAM Jaya beberapa halaman'), false);
  assert.equal(mintaTemplateChart('buat dashboard pakai template chart'), true);
  assert.equal(mintaTemplateChart('dashboard keuangan gaya lensa'), true);
  assert.equal(mintaTemplateChart('chart dari katalog saja'), true);
});

test('payload grafik RAG membawa rancangan; penyusun mempertahankannya kecuali minta template', () => {
  const ws = payloadKeWidgetSpec(
    {
      dashboardTitle: 'x',
      kpi: [],
      grafik: [
        {
          judul: 'Produksi air bulanan',
          tipe: 'area',
          satuan: 'juta m³',
          kategori: ['Jan', 'Feb', 'Mar', 'Apr'],
          seri: [{ nama: 'Produksi', data: [30, 31, 33, 32] }],
          desain: { warna: ['#0ea5e9'], judulSumbuNilai: 'Juta m³', legenda: 'tidak', garisHalus: true },
          docName: 'd.md',
          chunkSnippet: 'Produksi air Januari 30 juta m3',
        },
      ],
    },
    'pdam'
  ) as WidgetSpec[];
  const g = ws.find((w) => w.chart)!;
  assert.equal(g.rancangan?.bentuk, 'area');
  assert.deepEqual(g.rancangan?.warna, ['#0ea5e9']);

  const bebas = susunDashboardBerhalaman([g], { chartTemplate: false }).halaman[0].widgets[0];
  assert.equal(bebas.chartId, undefined);
  assert.equal(bebas.type, 'area');
  assert.equal(pakaiRancangan(bebas), true);

  const templat = susunDashboardBerhalaman([g], { chartTemplate: true }).halaman[0].widgets[0];
  assert.ok(templat.chartId);
  assert.equal(pakaiRancangan(templat), false);
});
