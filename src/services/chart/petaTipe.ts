import type { WidgetType } from '../../types';
import type { ChartId } from './chartDefault';

/**
 * PETA TIPE WIDGET KANVAS -> WAJAH KATALOG.
 *
 * Dashboard biasa (hasil dokumen atau asisten) menyimpan tipe widget lama
 * seperti `bar`, `line`, `donut`. Katalog template chart memakai `chartId`.
 * Peta ini yang menghubungkan keduanya supaya dashboard baru memakai desain
 * dari template chart, bukan penyusun opsi lama.
 *
 * Tiga tipe BELUM punya wajah di Template Chart dan sengaja dibiarkan `null`:
 * `map` (peta geografis), `gantt` (jadwal bertanggal), `boxplot` (kuartil).
 * Ketiganya dibuatkan entri Template Chart baru saat dipakai (lihat
 * `katalogKustom.ts`), bukan dipaksa masuk ke wajah yang mirip — bentuknya akan
 * menipu.
 */
export const PETA_TIPE: Partial<Record<WidgetType, ChartId>> = {
  kpi: 'kpi-kartu',
  table: 'tabel-ringkas',
  narasi: 'narasi-insight',
  line: 'garis-tren',
  'trend-line': 'garis-tren',
  forecast: 'garis-tren',
  area: 'area-gradasi',
  bar: 'bar-tegak',
  histogram: 'bar-tegak',
  hbar: 'bar-mendatar-peringkat',
  'bullet-target': 'bar-mendatar-target',
  combo: 'combo-batang-garis',
  donut: 'donat-tebal',
  pie: 'donat-tipis',
  scatter: 'titik-bersumbu',
  anomaly: 'titik-bersumbu',
  bubble: 'scatter-gelembung',
  cluster: 'scatter-gelembung',
  gauge: 'gauge-target',
  // Enam tipe di bawah SEBELUMNYA dibiarkan null padahal wajahnya sudah ada di
  // Template Chart (`peta-panas`, `radar-aspek`, `air-terjun`, `sankey-alur`,
  // `treemap-porsi`, `corong-pipeline`). Akibatnya widget bertipe itu jatuh ke
  // penyusun lama / dibuatkan entri kustom padahal template-nya tersedia.
  heatmap: 'peta-panas',
  radar: 'radar-aspek',
  waterfall: 'air-terjun',
  sankey: 'sankey-alur',
  treemap: 'treemap-porsi',
  funnel: 'corong-pipeline',
};

/** Wajah katalog untuk sebuah tipe widget, atau null bila belum ada. */
export const chartIdDariTipe = (tipe: WidgetType): ChartId | null => PETA_TIPE[tipe] ?? null;
