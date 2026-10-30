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
 * Tipe yang belum punya wajah katalog (peta, radar, heatmap, sankey, gantt,
 * treemap, funnel, waterfall, boxplot) sengaja dibiarkan `null`: masih digambar
 * penyusun lama sampai wajahnya dibuat. Jangan dipaksa masuk ke wajah yang
 * mirip, karena bentuknya akan menipu.
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
};

/** Wajah katalog untuk sebuah tipe widget, atau null bila belum ada. */
export const chartIdDariTipe = (tipe: WidgetType): ChartId | null => PETA_TIPE[tipe] ?? null;
