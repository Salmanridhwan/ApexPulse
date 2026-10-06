/**
 * ECharts tree-shaken: hanya modul yang dipakai ApexPulse yang di-register.
 *
 * Kenapa: `import('echarts')` menarik SELURUH pustaka (~1.12 MB) ke satu chunk.
 * Dengan mengimpor dari `echarts/core` + register manual, bundel menyusut ke
 * komponen yang benar-benar dirender (line/bar/pie/gauge/heatmap + grid, tooltip,
 * legend, visualMap, renderer canvas).
 *
 * Pemakaian:
 *   const { init, graphic } = await loadEcharts();
 *   const chart = init(el);
 */
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart, GaugeChart, HeatmapChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  TitleComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ECharts, EChartsOption } from 'echarts';

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GaugeChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  TitleComponent,
  CanvasRenderer,
]);

export { echarts };
export type { ECharts, EChartsOption };

// Promise di-cache supaya registrasi & import hanya sekali.
let echartsPromise: Promise<typeof echarts> | null = null;
export const loadEcharts = () => (echartsPromise ??= Promise.resolve(echarts));
