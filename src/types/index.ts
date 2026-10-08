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
  /**
   * Knowledge base milik instansi ini di layanan RAG.
   *
   * WAJIB diisi: satu layanan RAG memuat banyak knowledge base (satu per
   * instansi). Kalau dibiarkan kosong, permintaan jatuh ke knowledge base
   * global yang isinya dokumen lintas instansi — pernah terjadi dashboard
   * PDAM Tirta Kencana justru berisi laporan Bank BJB.
   */
  knowledgeBaseId?: string;
  /**
   * Nama dokumen yang terakhir terbaca dari KB instansi ini.
   *
   * Dipakai untuk mendeteksi dokumen BARU: saat admin menekan "Perbarui RAG",
   * daftar terbaru dibandingkan dengan daftar ini sehingga aplikasi bisa
   * menyebutkan dokumen mana yang baru diunggah (bukan sekadar jumlah).
   * Kosong = belum pernah disinkronkan, jadi jangan mengaku ada dokumen baru.
   */
  dokumenTerakhir?: string[];
  /** Waktu sinkronisasi KB terakhir (ISO). Ditampilkan di kartu instansi. */
  kbTersinkronPada?: string;
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
  /**
   * ID akun Google (`sub`) bila user terhubung dengan login Google.
   * Kosong = akun lokal (email + kata sandi).
   */
  googleSub?: string;
  /** Akun ini masuk lewat Google (bukan kata sandi lokal). */
  viaGoogle?: boolean;
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
  | 'narasi'
  // Analitik prediktif (menghitung proyeksi/pola dari angka dokumen)
  | 'trend-line'
  | 'forecast'
  | 'anomaly'
  | 'cluster'
  // Analitik preskriptif (membantu keputusan; hasilnya simulasi/uraian kontribusi)
  | 'dekomposisi'
  | 'skenario'
  | 'sensitivitas';

/** Tipe yang butuh data seri (xAxis + minimal satu seri) untuk dirender. */
export const TIPE_SERI: WidgetType[] = [
  'line', 'area', 'bar', 'hbar', 'combo', 'pie', 'donut', 'treemap', 'funnel',
  'waterfall', 'sankey', 'scatter', 'bubble', 'histogram', 'boxplot', 'heatmap',
  'radar', 'map', 'gantt',
  'trend-line', 'forecast', 'anomaly', 'cluster', 'dekomposisi', 'skenario', 'sensitivitas',
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

/**
 * Gaya tampilan widget yang bisa diatur pengguna.
 *
 * Semua opsional: field yang kosong berarti "pakai bawaan tema", sehingga widget
 * lama (yang belum punya `style`) tampil persis seperti sebelumnya.
 */
export interface WidgetStyle {
  /** Palet siap pakai. Menimpa warna seri bawaan tema. */
  palette?: 'default' | 'brand' | 'hijau' | 'ungu' | 'oranye' | 'monokrom' | 'hangat' | 'sejuk';
  /** Warna kustom per-seri (menimpa palet). Indeks 0 = seri pertama. */
  warnaSeri?: string[];
  /** Font untuk label/sumbu/legenda. */
  font?: 'Inter' | 'JetBrains Mono';
  /** Ukuran dasar font chart (px). Label kecil ikut menyesuaikan. */
  fontUkuran?: number;
  /** Ketebalan garis (px) untuk tipe garis/area. */
  garisTebal?: number;
  /** Sudut lengkung batang (px) untuk tipe batang. */
  batangRadius?: number;
  /**
   * Warna latar KARTU widget (hex). Kosong = pakai bawaan tema.
   *
   * Teks, border, dan label chart diturunkan otomatis dari warna ini dengan
   * perhitungan kontras WCAG (lihat `widgetCardTheme.ts`) supaya tetap terbaca.
   */
  kartu?: string;
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
  /**
   * true = kartu ini SENGAJA dikosongkan karena indikatornya tidak ada di
   * dokumen instansi (dipakai saat "Pakai Template Ini" mengisi angka dari RAG).
   * Kanvas menampilkan penanda "belum ada di dokumen" — TIDAK ada angka contoh.
   */
  dataKosong?: boolean;
  /** Alasan singkat kenapa kartu dikosongkan (ditampilkan di kanvas). */
  catatanData?: string;
  kpi?: {
    value: number | string;
    unit?: string;
    delta?: number;
    deltaLabel?: string;
    target?: number;
    targetLabel?: string;
    sparkline?: number[];
    /** Asal grafik tren: seri dokumen, turunan dari delta, atau turunan dari nilai saja. */
    sparklineAsal?: 'dokumen-seri' | 'turunan-delta' | 'turunan-nilai';
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
  /**
   * Gaya tampilan pilihan pengguna (warna, font, ketebalan garis).
   * Semua field opsional: kalau kosong, widget memakai tampilan bawaan tema.
   */
  style?: WidgetStyle;
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
  kategori: 'Keuangan' | 'Operasional' | 'Pelayanan' | 'Kepatuhan & Risiko' | 'Analitik';
  satuan: string;
  queryRagContoh: string;
  deskripsi: string;
  defaultLayout: { w: number; h: number };
}

/**
 * Catatan "preset ini benar-benar bisa ditambahkan untuk instansi ini".
 *
 * Diisi hasil pemeriksaan yang memakai panggilan SAMA dengan tombol Tambah
 * (`ambilDataWidget` dengan KB instansi), lalu di-cache supaya katalog tidak
 * menawarkan preset yang mustahil diisi. Terikat ke `kbId`: begitu KB instansi
 * berubah, catatan lama tidak dipakai lagi.
 */
export interface KetersediaanPreset {
  /** `${tenantId}|${presetId}|${tipe}` — kunci unik cache. */
  id: string;
  tenantId: string;
  kbId: string;
  presetId: string;
  tipe: WidgetType;
  tersedia: boolean;
  /** Alasan singkat saat tidak tersedia (untuk tombol "tampilkan juga"). */
  alasan?: string;
  /**
   * Pemeriksaan tidak bisa disimpulkan (mis. layanan RAG membalas 502). Dibedakan
   * dari "dokumen tidak memuat" supaya galat sesaat tidak menyembunyikan preset
   * dan tidak dilaporkan sebagai kesimpulan dokumen.
   */
  tidakDiketahui?: boolean;
  /** Payload hasil dokumen — hanya disimpan kalau tersedia. */
  widget?: WidgetSpec;
  judul?: string;
  deskripsi?: string;
  checkedAt: string;
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
  actionTaken?: 'create_dashboard' | 'update_widget' | 'remove_widget' | 'add_widget' | 'filter' | 'none' | 'recommend' | 'qa_answer' | 'no_kb' | 'rag_error';
  affectedWidgetId?: string;
  modeUsed?: 'Jalur A (LLM JSON)' | 'Jalur B (Agregasi Metadata)' | 'Chatbot RAG' | 'Fallback (Template Snapshot)' | 'Gagal (Layanan RAG)' | 'Gagal (Dokumen Tidak Memadai)';
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
