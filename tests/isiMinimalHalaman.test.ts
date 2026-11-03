import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generateDashboard } from '../src/services/builder/generate';
import { MIN_WIDGET_HALAMAN, butirCadangan } from '../src/services/builder/halamanDiminta';
import { susunDashboardBerhalaman } from '../src/services/builder/susunHalaman';

const kutip = (s: string) => [{ id: 'c', docName: 'lap.pdf', page: 2, chunkSnippet: s, confidenceScore: 1, date: '' }];
const angkaUang = /pendapatan|beban|laba|arus kas|aset|ekuitas/;

test('halaman tertulis yang isinya kurang dilengkapi butir cadangan satu topik sampai minimal 6', async () => {
  const diminta: string[] = [];
  const fake: any = {
    query: async () => ({ chunks: [], citations: [], latencyMs: 1, mode: 'tiruan', structuredJson: null }),
    ambilDataWidget: async (q: string) => {
      diminta.push(q);
      if (!angkaUang.test(q) || /komposisi|tren|realisasi|rasio/.test(q)) return null;
      const judul = q.charAt(0).toUpperCase() + q.slice(1);
      return {
        data: {
          id: 'w',
          type: 'kpi',
          title: judul,
          confidence: 'sumber',
          kpi: { value: 100 + diminta.length, unit: 'Rp miliar' },
          citations: kutip(`${judul} tahun 2025 sebesar Rp${100 + diminta.length} miliar`),
          grid: { x: 0, y: 0, w: 3, h: 2 },
        },
      };
    },
  };
  const g = await generateDashboard({
    userPrompt: 'Buat dashboard 2 halaman: 1. Halaman Keuangan – pendapatan usaha, laba bersih. 2. Halaman Wilayah – air terjual per wilayah.',
    sector: 'pdam',
    tenantId: 't',
    ragClient: fake,
    izinkanSnapshotDemo: false,
    jedaUlangMs: 1,
  } as any);
  const s = susunDashboardBerhalaman(g.dashboard.widgets, { halamanDiminta: g.halamanDiminta, halamanWidget: g.halamanWidget });
  const keuangan = s.halaman.find((h) => h.judul.includes('Keuangan'));
  assert.ok(keuangan, JSON.stringify(s.halaman.map((h) => h.judul)));
  assert.ok(keuangan.widgets.length >= MIN_WIDGET_HALAMAN, keuangan.widgets.map((w) => w.title).join(', '));
  // Cadangan tetap satu topik: halaman Keuangan hanya berisi indikator uang, bukan per wilayah.
  assert.ok(keuangan.widgets.every((w) => angkaUang.test(w.title.toLowerCase()) && !/wilayah/i.test(w.title)), keuangan.widgets.map((w) => w.title).join(', '));
  assert.ok(diminta.includes('total aset'), diminta.join(', '));
});

test('halaman tertulis meminjam cadangan dari segmen bawaan yang judulnya cocok', () => {
  const c = butirCadangan({ judul: 'Halaman Keuangan', butir: ['pendapatan usaha'] }, 'pdam');
  assert.ok(c.includes('laba bersih') && c.includes('total aset'));
  assert.ok(!c.includes('pendapatan usaha'));
  assert.deepEqual(butirCadangan({ judul: 'Program CSR', butir: ['program CSR'] }, 'pdam'), []);
});
