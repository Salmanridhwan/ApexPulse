import test from 'node:test';
import assert from 'node:assert/strict';
import { isiTemplateDariRag, type RagPengambilData } from '../src/services/templates/isiDariRag';
import type { DashboardTemplate } from '../src/services/templates/dashboardTemplates';

/**
 * Permintaan pengguna: "ketika user memakai template, yang jadi realnya juga harus
 * sesuai dengan template". Jadi dokumen hanya boleh menyumbang ANGKA — judul,
 * subjudul, urutan, ukuran (grid), dan bentuk tampilan tetap milik template.
 */
const template = {
  id: 'tpl-identitas',
  nama: 'Identitas',
  tujuan: '',
  caraPenyampaian: '',
  deskripsi: '',
  fokus: [],
  aksen: '#123456',
  judulDashboard: 'Dashboard Uji',
  deskripsiDashboard: '',
  widgets: [
    {
      id: 'w1',
      type: 'bar',
      title: 'Sumber Trafik',
      subtitle: 'Kanal kunjungan',
      confidence: 'contoh',
      grid: { x: 0, y: 0, w: 8, h: 5 },
    },
    {
      id: 'w2',
      type: 'donut',
      title: 'Jenis Perangkat',
      subtitle: 'Porsi perangkat',
      confidence: 'contoh',
      grid: { x: 8, y: 0, w: 4, h: 5 },
    },
  ],
} as unknown as DashboardTemplate;

const dasar = { sector: 'pdam' as const, instansi: 'Perumda Uji', kbId: 'kb_uji' };

test('bentuk & judul kartu tetap milik template walau dokumen menjawab bentuk lain', async () => {
  const rag: RagPengambilData = {
    ambilDataWidget: async (_q, _s, tipe) => ({
      data: {
        id: 'x',
        // Dokumen menjawab dengan bentuk berbeda (garis untuk kartu batang).
        type: tipe === 'bar' ? 'line' : 'pie',
        title: 'Judul dari Dokumen',
        confidence: 'sumber',
        grid: { x: 0, y: 0, w: 12, h: 9 },
        chart: { xAxis: ['A', 'B'], series: [{ name: 'S', data: [1, 2] }] },
      },
    }),
  };
  const hasil = await isiTemplateDariRag(template, { ...dasar, rag, batasMs: 5000 });
  assert.equal(hasil.terisi, 2);

  const [sumber, perangkat] = hasil.widgets;
  // Bentuk tampilan mengikuti template (batang & donat), bukan jawaban dokumen.
  assert.equal(sumber.type, 'bar', 'kartu batang tetap batang');
  assert.equal(perangkat.type, 'donut', 'kartu donat tetap donat');
  // Judul & subjudul template dipertahankan.
  assert.equal(sumber.title, 'Sumber Trafik');
  assert.equal(sumber.subtitle, 'Kanal kunjungan');
  assert.equal(perangkat.title, 'Jenis Perangkat');
  // Ukuran & urutan mengikuti template.
  assert.deepEqual(sumber.grid, { x: 0, y: 0, w: 8, h: 5 });
  assert.deepEqual(perangkat.grid, { x: 8, y: 0, w: 4, h: 5 });
  // Angka tetap dari dokumen.
  assert.deepEqual(sumber.chart?.series?.[0]?.data, [1, 2]);
  assert.equal(sumber.dataKosong, false);
});

test('bentuk dokumen dipakai bila keluarganya memang berbeda (tabel vs grafik)', async () => {
  const rag: RagPengambilData = {
    ambilDataWidget: async () => ({
      data: {
        id: 'x',
        type: 'table',
        title: 'Rekap',
        confidence: 'sumber',
        grid: { x: 0, y: 0, w: 12, h: 4 },
        table: { columns: ['A'], rows: [['1']] },
      },
    }),
  };
  const hasil = await isiTemplateDariRag(template, { ...dasar, rag, batasMs: 5000 });
  const sumber = hasil.widgets[0];
  assert.equal(sumber.type, 'table', 'bentuk jauh berbeda tetap dipakai agar kartu tidak kosong');
  assert.equal(sumber.title, 'Sumber Trafik', 'judul tetap milik template');
});
