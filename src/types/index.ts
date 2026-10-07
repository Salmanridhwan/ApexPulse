export type BumdSector = 'pdam' | 'pasar' | 'bank' | 'rsud' | 'transportasi' | 'aneka_usaha';

export type UserRole = 'admin' | 'analis' | 'direksi';

export interface Tenant {
  id: string;
  name: string;
  shortName: string;
  sector: BumdSector;
  code: string;
  city: string;
  logo: string;
  primaryColor: string;
  documentCount: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  avatar?: string;
  /** Hash scrypt (salt:hash) — hanya dipakai di server, jangan pernah dikirim ke client. */
  passwordHash?: string;
}

/**
 * Semua tipe visualisasi yang didukung. Dikelompokkan agar mudah dibaca:
 * - Kartu/teks  : kpi, bullet-target, table, narasi
 * - Kartu ukur  : gauge
 * - Kartesius   : line, area, bar (kolom), hbar (batang horizontal), combo (dual-axis)
 * - Komposisi   : pie, donut, treemap, funnel, waterfall, sankey
 * - Sebaran     : scatter, bubble, histogram, boxplot
 * - Matriks     : heatmap
 * - Geometri    : radar
 * - Peta        : map (choropleth / filled map)
 * - Jadwal      : gantt
 */
export type WidgetType =
  | 'kpi'
  | 'line'
  | 'area'
  | 'bar'
  | 'hbar'
  | 'combo'
  | 'pie'
  | 'donut'
  | 'treemap'
  | 'funnel'
  | 'waterfall'
  | 'sankey'
  | 'scatter'
  | 'bubble'
  | 'histogram'
  | 'boxplot'
  | 'heatmap'
  | 'radar'
  | 'map'
  | 'gantt'
  | 'gauge'
  | 'bullet-target'
  | 'table'
  | 'narasi';

/** Tipe yang butuh data seri (xAxis + minimal satu seri) untuk dirender. */
export const TIPE_SERI: WidgetType[] = [
  'line', 'area', 'bar', 'hbar', 'combo', 'pie', 'donut', 'treemap', 'funnel',
  'waterfall', 'sankey', 'scatter', 'bubble', 'histogram', 'boxplot', 'heatmap',
  'radar', 'map', 'gantt',
];

export type ConfidenceLevel = 'sumber' | 'inferensi AI' | 'manual';

export interface Citation {
  id: string;
  docName: string;
  page: number;
  chunkSnippet: string;
  confidenceScore: number;
  date: string;
  unitKerja?: string;
  metric?: string;
}

export interface ManualCorrection {
  isCorrected: boolean;
  originalValue: string | number;
  correctedValue: string | number;
  correctedBy: string;
  correctedAt: string;
  reason: string;
}

export interface WidgetGrid {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetSpec {
  id: string;
  presetId?: string;
  type: WidgetType;
  title: string;
  subtitle?: string;
  category?: string;
  confidence: ConfidenceLevel;
  grid: WidgetGrid;
  kpi?: {
    value: number | string;
    unit?: string;
    delta?: number;
    deltaLabel?: string;
    target?: number;
    targetLabel?: string;
    sparkline?: number[];
  };
  chart?: {
    xAxis: string[];
    series: Array<{
      name: string;
      data: number[];
      color?: string;
      /** Satuan per-seri (opsional) untuk normalisasi antar satuan. */
      unit?: string;
      /** Tipe seri pada combo/dual-axis: 'bar' | 'line'. */
      kind?: 'bar' | 'line';
      /** Sumbu mana yang dipakai pada combo/dual-axis: 0 = kiri, 1 = kanan. */
      yAxisIndex?: 0 | 1;
    }>;
    unit?: string;
    stacked?: boolean;
    showLegend?: boolean;
    /** Khusus gauge: nilai minimal & maksimal skala (default 0-100). */
    min?: number;
    max?: number;
    /** Khusus scatter/bubble: titik (x, y) dengan ukuran opsional. */
    points?: Array<{ x: number; y: number; size?: number; label?: string; color?: string }>;
    /** Khusus sankey: aliran antar node. */
    links?: Array<{ source: string; target: string; value: number }>;
    /** Khusus waterfall: nilai bertahap (positif/negatif). */
    waterfall?: Array<{ name: string; value: number }>;
    /** Khusus radar: indikator + nilai per seri. */
    radar?: {
      indicators: Array<{ name: string; max: number }>;
      series: Array<{ name: string; values: number[]; color?: string }>;
    };
    /** Khusus boxplot: nilai mentah per kategori. */
    boxRaw?: number[][];
  };
  /** Khusus treemap: hierarki nilai (nama + nilai, boleh punya anak). */
  treemap?: {
    name: string;
    value?: number;
    children?: Array<{ name: string; value: number }>;
  };
  /** Khusus peta (choropleth/filled map): nilai per wilayah. */
  geo?: {
    mapName?: string;
    regions: Array<{ name: string; value: number }>;
    unit?: string;
  };
  /** Khusus Gantt: daftar tugas dengan rentang waktu. */
  gantt?: {
    tasks: Array<{
      name: string;
      start: string;
      end: string;
      progress?: number;
      color?: string;
    }>;
  };
  /** Khusus heatmap: matriks nilai [baris][kolom] + label sumbunya. */
  heatmap?: {
    rows: string[];
    columns: string[];
    data: number[][];
    unit?: string;
  };
  table?: {
    columns: Array<{
      key: string;
      label: string;
      format?: 'number' | 'currency' | 'percent' | 'text';
    }>;
    rows: Array<Record<string, any>>;
  };
  narasi?: {
    text: string;
    bulletPoints?: string[];
    citationsInText?: Array<{
      index: number;
      docName: string;
      page: number;
    }>;
  };
  citations: Citation[];
  manualCorrection?: ManualCorrection;
  unitKerja?: string;
  periode?: string;
  lastUpdated?: string;
}

export interface GlobalFilters {
  periode: string; // '2026-Q1' | '2026-Q2' | '2026-Q3' | '2026-FY' | '2025-FY'
  unitKerja: string; // 'Semua' | 'Pusat' | 'Wilayah Barat' | etc
  kategori: string; // 'Semua' | 'Keuangan' | 'Operasional' | 'Pelayanan'
}

export interface Dashboard {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  sector: BumdSector;
  widgets: WidgetSpec[];
  globalFilters: GlobalFilters;
  createdAt: string;
  updatedAt: string;
  isShared?: boolean;
  shareToken?: string;
}

export type PresetSector = BumdSector | 'universal';

export interface CatalogPreset {
  id: string;
  nama: string;
  sektor: PresetSector[];
  tipeChart: WidgetType[];
  kategori: 'Keuangan' | 'Operasional' | 'Pelayanan' | 'Kepatuhan & Risiko';
  satuan: string;
  queryRagContoh: string;
  deskripsi: string;
  defaultLayout: { w: number; h: number };
}

export interface AlertRule {
  id: string;
  tenantId: string;
  title: string;
  metricKey: string;
  metricName: string;
  operator: '>' | '<' | '>=' | '<=';
  threshold: number;
  unit: string;
  channels: ('in_app' | 'email')[];
  severity: 'info' | 'warning' | 'critical';
  isActive: boolean;
  lastTriggered?: string;
}

export interface NotificationItem {
  id: string;
  tenantId: string;
  alertRuleId?: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  isRead: boolean;
  metricValue?: number;
  threshold?: number;
  sentEmail?: boolean;
}

export interface ProgressStep {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface ChatRecommendation {
  id: string;       // WIDGET_CATALOG id, e.g. 'W-01'
  name: string;
  category: string;
  chartTypes: string[];
  description: string;
  prompt: string;   // suggested follow-up prompt to send
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'system';
  text: string;
  timestamp: string;
  actionTaken?: 'create_dashboard' | 'update_widget' | 'remove_widget' | 'add_widget' | 'filter' | 'none' | 'recommend';
  affectedWidgetId?: string;
  modeUsed?: 'Jalur A (LLM JSON)' | 'Jalur B (Agregasi Metadata)' | 'Fallback (Template Snapshot)';
  citationsCount?: number;
  progressSteps?: ProgressStep[];
  recommendations?: ChatRecommendation[];
}

/**
 * Satu percakapan orkestrator, terikat pada SATU dashboard.
 * `dashboardId` unik: satu dashboard tidak boleh punya dua chat.
 */
export interface Chat {
  id: string;
  dashboardId: string;
  tenantId: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface RAGProbeResult {
  timestamp: string;
  status: 'healthy' | 'degraded' | 'error';
  latencyMs: number;
  modeDetected: 'Jalur A' | 'Jalur B' | 'Fallback';
  hasLlmStructuredJson: boolean;
  hasDocumentMetadata: boolean;
  sampleChunksCount: number;
  zodValidationPassed: boolean;
  details: string[];
}

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  userName: string;
  action: string;
  target: string;
  details: string;
  timestamp: string;
}
