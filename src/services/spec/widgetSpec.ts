import { z } from 'zod';

export const CitationSchema = z.object({
  id: z.string(),
  docName: z.string().min(1, 'Nama dokumen wajib ada'),
  page: z.number().int().nonnegative(),
  chunkSnippet: z.string().min(1, 'Snippet dokumen sumber wajib ada'),
  confidenceScore: z.number().min(0).max(1),
  date: z.string(),
  unitKerja: z.string().optional(),
  metric: z.string().optional(),
});

export const ManualCorrectionSchema = z.object({
  isCorrected: z.boolean(),
  originalValue: z.union([z.string(), z.number()]),
  correctedValue: z.union([z.string(), z.number()]),
  correctedBy: z.string(),
  correctedAt: z.string(),
  reason: z.string(),
});

export const WidgetGridSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

export const WidgetTypeEnum = z.enum([
  'kpi',
  'line',
  'area',
  'bar',
  'hbar',
  'combo',
  'pie',
  'donut',
  'treemap',
  'funnel',
  'waterfall',
  'sankey',
  'scatter',
  'bubble',
  'histogram',
  'boxplot',
  'heatmap',
  'radar',
  'map',
  'gantt',
  'trend-line',
  'forecast',
  'anomaly',
  'cluster',
  'dekomposisi',
  'skenario',
  'sensitivitas',
  'table',
  'narasi',
  'bullet-target',
  'gauge',
]);

/** Tipe yang WAJIB punya sitasi dokumen sumber (berbasis angka). */
export const TIPE_BERBASIS_DATA: string[] = [
  'kpi', 'line', 'area', 'bar', 'hbar', 'combo', 'pie', 'donut', 'treemap',
  'funnel', 'waterfall', 'sankey', 'scatter', 'bubble', 'histogram', 'boxplot',
  'heatmap', 'radar', 'map', 'gantt', 'bullet-target', 'gauge',
];

export const ConfidenceLevelEnum = z.enum(['sumber', 'inferensi AI', 'manual']);

export const KpiDataSchema = z.object({
  value: z.union([z.number(), z.string()]),
  unit: z.string().optional(),
  delta: z.number().optional(),
  deltaLabel: z.string().optional(),
  target: z.number().optional(),
  targetLabel: z.string().optional(),
  sparkline: z.array(z.number()).optional(),
  /** Asal grafik tren (jejak audit: seri dokumen / turunan delta / turunan nilai). */
  sparklineAsal: z.enum(['dokumen-seri', 'turunan-delta', 'turunan-nilai']).optional(),
});

export const ChartDataSchema = z.object({
  xAxis: z.array(z.string()),
  series: z.array(
    z.object({
      name: z.string(),
      data: z.array(z.number()),
      color: z.string().optional(),
      unit: z.string().optional(),
      kind: z.enum(['bar', 'line']).optional(),
      yAxisIndex: z.union([z.literal(0), z.literal(1)]).optional(),
    })
  ),
  unit: z.string().optional(),
  stacked: z.boolean().optional(),
  showLegend: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  points: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
        size: z.number().optional(),
        label: z.string().optional(),
        color: z.string().optional(),
      })
    )
    .optional(),
  links: z
    .array(z.object({ source: z.string(), target: z.string(), value: z.number() }))
    .optional(),
  waterfall: z.array(z.object({ name: z.string(), value: z.number() })).optional(),
  radar: z
    .object({
      indicators: z.array(z.object({ name: z.string(), max: z.number() })),
      series: z.array(
        z.object({ name: z.string(), values: z.array(z.number()), color: z.string().optional() })
      ),
    })
    .optional(),
  boxRaw: z.array(z.array(z.number())).optional(),
});

export const TreemapDataSchema = z.object({
  name: z.string(),
  value: z.number().optional(),
  children: z.array(z.object({ name: z.string(), value: z.number() })).optional(),
});

export const GeoDataSchema = z.object({
  mapName: z.string().optional(),
  regions: z.array(z.object({ name: z.string(), value: z.number() })),
  unit: z.string().optional(),
});

export const GanttDataSchema = z.object({
  tasks: z.array(
    z.object({
      name: z.string(),
      start: z.string(),
      end: z.string(),
      progress: z.number().optional(),
      color: z.string().optional(),
    })
  ),
});

export const HeatmapDataSchema = z.object({
  rows: z.array(z.string()),
  columns: z.array(z.string()),
  data: z.array(z.array(z.number())),
  unit: z.string().optional(),
});

export const TableDataSchema = z.object({
  columns: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      format: z.enum(['number', 'currency', 'percent', 'text']).optional(),
    })
  ),
  rows: z.array(z.record(z.string(), z.any())),
});

export const NarasiDataSchema = z.object({
  text: z.string(),
  bulletPoints: z.array(z.string()).optional(),
  citationsInText: z
    .array(
      z.object({
        index: z.number(),
        docName: z.string(),
        page: z.number(),
      })
    )
    .optional(),
});

export const WidgetStyleSchema = z.object({
  palette: z.enum(['default', 'brand', 'hijau', 'ungu', 'oranye', 'monokrom', 'hangat', 'sejuk']).optional(),
  warnaSeri: z.array(z.string()).optional(),
  font: z.enum(['Inter', 'JetBrains Mono']).optional(),
  fontUkuran: z.number().min(8).max(24).optional(),
  garisTebal: z.number().min(0.5).max(8).optional(),
  batangRadius: z.number().min(0).max(20).optional(),
  kartu: z.string().optional(),
});

export const WidgetSpecSchema = z.object({
  id: z.string(),
  presetId: z.string().optional(),
  type: WidgetTypeEnum,
  title: z.string().min(1, 'Judul widget wajib ada'),
  subtitle: z.string().optional(),
  category: z.string().optional(),
  confidence: ConfidenceLevelEnum,
  grid: WidgetGridSchema,
  kpi: KpiDataSchema.optional(),
  chart: ChartDataSchema.optional(),
  heatmap: HeatmapDataSchema.optional(),
  treemap: TreemapDataSchema.optional(),
  geo: GeoDataSchema.optional(),
  gantt: GanttDataSchema.optional(),
  table: TableDataSchema.optional(),
  narasi: NarasiDataSchema.optional(),
  citations: z.array(CitationSchema).default([]),
  manualCorrection: ManualCorrectionSchema.optional(),
  unitKerja: z.string().optional(),
  periode: z.string().optional(),
  lastUpdated: z.string().optional(),
  style: WidgetStyleSchema.optional(),
}).refine(
  (widget) => {
    // If it's a KPI or chart widget, it MUST have citations or be manual correction
    if (TIPE_BERBASIS_DATA.includes(widget.type)) {
      if (widget.confidence === 'manual') return true;
      return widget.citations && widget.citations.length > 0;
    }
    return true;
  },
  {
    message: 'Setiap widget berbasis data angka wajib menyertakan minimal 1 sitasi dokumen sumber.',
    path: ['citations'],
  }
);

export const DashboardSpecSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  title: z.string().min(1, 'Judul dashboard wajib diisi'),
  description: z.string().optional().default(''),
  sector: z.enum(['pdam', 'pasar', 'bank', 'rsud', 'transportasi', 'aneka_usaha']),
  widgets: z.array(WidgetSpecSchema),
  globalFilters: z.object({
    periode: z.string(),
    unitKerja: z.string(),
    kategori: z.string(),
  }),
});

export type ValidatedWidgetSpec = z.infer<typeof WidgetSpecSchema>;
export type ValidatedDashboardSpec = z.infer<typeof DashboardSpecSchema>;
