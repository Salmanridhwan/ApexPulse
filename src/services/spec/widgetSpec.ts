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
  'donut',
  'table',
  'narasi',
  'bullet-target',
  'gauge',
  'heatmap',
]);

export const ConfidenceLevelEnum = z.enum(['sumber', 'inferensi AI', 'manual']);

export const KpiDataSchema = z.object({
  value: z.union([z.number(), z.string()]),
  unit: z.string().optional(),
  delta: z.number().optional(),
  deltaLabel: z.string().optional(),
  target: z.number().optional(),
  targetLabel: z.string().optional(),
  sparkline: z.array(z.number()).optional(),
});

export const ChartDataSchema = z.object({
  xAxis: z.array(z.string()),
  series: z.array(
    z.object({
      name: z.string(),
      data: z.array(z.number()),
      color: z.string().optional(),
    })
  ),
  unit: z.string().optional(),
  stacked: z.boolean().optional(),
  showLegend: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
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
  table: TableDataSchema.optional(),
  narasi: NarasiDataSchema.optional(),
  citations: z.array(CitationSchema).default([]),
  manualCorrection: ManualCorrectionSchema.optional(),
  unitKerja: z.string().optional(),
  periode: z.string().optional(),
  lastUpdated: z.string().optional(),
}).refine(
  (widget) => {
    // If it's a KPI or chart widget, it MUST have citations or be manual correction
    if (['kpi', 'line', 'area', 'bar', 'donut', 'bullet-target', 'gauge', 'heatmap'].includes(widget.type)) {
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
