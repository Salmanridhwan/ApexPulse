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
 * Tiga tipe yang dulu belum punya wajah (`map`, `gantt`, `boxplot`) sekarang
 * sudah punya wajah sendiri di Template Chart: `peta-wilayah`, `jadwal-gantt`,
 * `kotak-sebaran`. Jadi SEMUA tipe widget punya padanan katalog, dan tidak ada
 * lagi chart yang dibuat di luar Template Chart.
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
  // Wajah yang dulu belum ada, sekarang sudah dibuat di Template Chart.
  map: 'peta-wilayah',
  gantt: 'jadwal-gantt',
  boxplot: 'kotak-sebaran',
};

/** Wajah katalog untuk sebuah tipe widget, atau null bila belum ada. */
export const chartIdDariTipe = (tipe: WidgetType): ChartId | null => PETA_TIPE[tipe] ?? null;
