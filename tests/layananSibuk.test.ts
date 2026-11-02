import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ConfigurableRagClient } from '../src/services/rag/http';
import { generateDashboard } from '../src/services/builder/generate';

/**
 * F-08: timeout / 429 dari /extract harus berakhir di bucket "layanan sibuk",
 * bukan "tidak ditemukan di dokumen". Diuji lewat klien HTTP sungguhan dengan
 * fetch tiruan, supaya jalur percobaan ulang ikut teruji.
 */
test('timeout dan 429 dari /extract masuk gagalLayanan, bukan tidakAda', async () => {
  const fetchAsli = globalThis.fetch;
  const jedaAsli = ConfigurableRagClient.jedaCobaUlangMs;
  ConfigurableRagClient.jedaCobaUlangMs = [0, 0];
  let panggilan = 0;
  globalThis.fetch = (async (url: any) => {
    const u = String(url);
    if (u.endsWith('/health')) return new Response('{}', { status: 200 });
    panggilan++;
    // Butir "arus kas": timeout; butir lain: 429.
    if (panggilan % 2 === 0) {
      const e = new Error('The operation was aborted due to timeout');
      e.name = 'TimeoutError';
      throw e;
    }
    return new Response('sibuk', { status: 429 });
  }) as typeof fetch;
  try {
    const http = new ConfigurableRagClient(() => ({ provider: 'http', baseUrl: 'http://rag.test', apiKey: 'kunci-uji', timeoutMs: 30 }));
    // Sapuan awal berhasil (tanpa widget); ekstraksi per butir lewat klien HTTP asli.
    const rag: any = {
      query: async () => ({ chunks: [], citations: [], latencyMs: 1, mode: 'uji', structuredJson: null }),
      ambilDataWidget: http.ambilDataWidget.bind(http),
    };
    const hasil = await generateDashboard({
      userPrompt: 'Buat dashboard: 1. Halaman Keuangan – pendapatan usaha, arus kas. 2. Halaman Operasional – produksi air.',
      sector: 'pdam',
      tenantId: 't',
      ragClient: rag,
      izinkanSnapshotDemo: false,
      jedaUlangMs: 0,
    });
    assert.deepEqual(hasil.laporanButir.tidakAda, []);
    assert.deepEqual(
      [...hasil.laporanButir.gagalLayanan].sort(),
      ['arus kas', 'pendapatan usaha', 'produksi air']
    );
    assert.ok(panggilan > 3, 'percobaan ulang benar-benar dijalankan');
  } finally {
    globalThis.fetch = fetchAsli;
    ConfigurableRagClient.jedaCobaUlangMs = jedaAsli;
  }
});
