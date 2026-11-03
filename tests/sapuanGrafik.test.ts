import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ConfigurableRagClient } from '../src/services/rag/http';
import { dashboardUmum, halamanUntukPermintaan } from '../src/services/builder/halamanDiminta';

/**
 * Uji 3 Nov 2026: sapuan 90 widget dari 10 area berakhir jadi 6 kartu KPI.
 * Kuota per area habis untuk KPI (selalu paling depan), lalu KPI dipotong 6.
 */
test('gabungan sapuan tetap membawa grafik, bukan hanya KPI', async () => {
  const klien = new ConfigurableRagClient(() => ({ provider: 'http', baseUrl: 'http://rag.test', apiKey: 'k', timeoutMs: 30 }));
  const area = (id: string) => ({
    id,
    widgets: [
      ...[1, 2, 3, 4].map((n) => ({ id: `${id}-k${n}`, type: 'kpi', title: `KPI ${id} ${n}`, citations: [{}] })),
      ...[1, 2, 3, 4].map((n) => ({ id: `${id}-g${n}`, type: 'bar', title: `Grafik ${id} ${n}`, citations: [{}] })),
    ],
  });
  const kelompok = ['kpi', 'keuangan', 'operasional', 'layanan', 'sdm', 'aset', 'risiko', 'wilayah', 'tren', 'lain'].map(area);
  const k = klien as any;
  k.ambilPayloadExtract = async () => null;
  k.sapuanMenyeluruh = async () => ({ widgets: kelompok.flatMap((g) => g.widgets), areaKosong: [], kelompok });
  const hasil = await k.cobaExtractJalurA('http://rag.test', { apiKey: 'k', timeoutMs: 30 }, { prompt: 'x', sector: 'pdam', sapuanPenuh: true });
  const ws: any[] = hasil.structuredJson.widgets;
  const grafik = ws.filter((w) => w.type === 'bar').length;
  const kpi = ws.filter((w) => w.type === 'kpi').length;
  assert.ok(grafik >= 20, `grafik ${grafik}`);
  assert.ok(kpi <= 6, `kpi ${kpi}`);
});

test('dashboard umum memakai segmentasi bawaan; satu topik tetap satu halaman', () => {
  const umum = halamanUntukPermintaan('Buatkan saya dashboard PDAM', 'pdam');
  assert.equal(umum.bawaan, true);
  assert.equal(umum.halaman.length, 5);
  assert.equal(dashboardUmum('buat dashboard keuangan PAM Jaya 2024'), false);
  assert.equal(dashboardUmum('dashboard pelayanan pelanggan'), false);
  assert.equal(dashboardUmum('buat dashboard PDAM satu halaman'), false);
  assert.equal(dashboardUmum('buatkan dashboard kinerja PAM Jaya 2024'), true);
});
