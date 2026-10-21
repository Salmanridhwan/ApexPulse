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
  /**
   * ID project/organisasi instansi ini di layanan KMS (`ragkms.aiones.app`).
   *
   * KMS memisahkan berkas per project, dan SATU API key dapat mengakses banyak
   * project. Karena itu unggah berkas WAJIB menyertakan `organizationId` yang
   * benar — kalau kosong, berkas tidak bisa diunggah (jangan menebak project).
   * Dipetakan manual admin di panel admin (satu API key, banyak KB).
   */
  kmsOrganizationId?: string;
  /**
   * Knowledge base KMS yang terhubung ke project di atas (mis.
   * `kb_aoc_budi_motor_8nx3`). Hanya untuk tampilan/diagnostik — penentuan
   * tujuan unggah memakai `kmsOrganizationId`.
   */
  kmsKnowledgeBase?: string;
  /**
   * Menu grup "Kinerja & Kepatuhan" yang DISEMBUNYIKAN admin untuk instansi ini.
   *
   * Isinya key menu (lihat `src/components/menuKinerja.ts`), mis. ['risiko','aset'].
   * Kosong/tidak ada = semua menu tampil. Opt-out, bukan opt-in, supaya instansi
   * lama otomatis tetap lengkap tanpa migrasi data.
   */
  menuSembunyi?: string[];
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
  /**
   * Status keanggotaan akun. Kosong = `active` (akun lama sebelum fitur persetujuan).
   *
   * Pendaftaran mandiri (email + kata sandi maupun Google) TIDAK langsung memberi
   * akses: akun berstatus `pending` sampai admin instansi menyetujui. Tanpa status
   * eksplisit, siapa pun yang tahu daftar instansi bisa langsung membaca dashboard
   * instansi tersebut.
   */
  status?: 'pending' | 'active' | 'rejected';
  /** Instansi yang diminta saat mendaftar (dipakai saat admin menyetujui). */
  requestedTenantId?: string;
  /** Waktu permintaan dibuat (ISO), untuk urutan & tampilan di panel admin. */
  requestedAt?: string;
  /** Identitas email sudah diverifikasi Google (klaim `email_verified`). */
  emailVerified?: boolean;
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
  /**
   * NARASI INSIGHT untuk mode presentasi: 1-3 kalimat yang menjelaskan APA
   * ARTINYA chart ini (bukan mengulang angka). Digenerate lewat RAG dari data
   * dokumen, lalu DISIMPAN ke dashboard supaya tidak perlu digenerate ulang tiap
   * presentasi. Bisa diedit manual seperti field widget lain.
   *
   * PENTING: teks ini TIDAK boleh memuat angka baru — angkanya sudah ada di
   * chart; insight hanya menafsirkan. Kalau kosong, slide memakai `narasi`/
   * ringkasan otomatis dari data (lihat `narasiInsight`).
   */
  insight?: string;
  /** Asal insight: 'rag' (dari layanan) | 'otomatis' (dihitung dari data) | 'manual' (diedit user). */
  insightAsal?: 'rag' | 'otomatis' | 'manual';
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
  /**
   * Rencana slide mode presentasi yang DISIMPAN (urutan & pengelompokan widget
   * per slide). Kalau kosong, slide disusun otomatis dari widget saat masuk mode
   * presentasi (lihat `susunSlide`). Menyimpannya membuat urutan presentasi
   * awet dan bisa disunting.
   */
  presentasi?: {
    slides: SlidePresentasi[];
    /** Kapan terakhir disusun/digenerate. */
    disusunAt?: string;
    /** Versi skema slide saat disusun (lihat VERSI_PRESENTASI). */
    versi?: number;
  };
}

/**
 * Satu slide mode presentasi: sekelompok widget yang ditampilkan bersamaan
 * (tanpa scroll) beserta narasi insight-nya.
 */
export interface SlidePresentasi {
  id: string;
  /** Judul slide (mis. "Kinerja Utama" atau judul widget pertama). */
  judul: string;
  /** Id widget yang tampil di slide ini (urut). */
  widgetIds: string[];
  /**
   * Narasi insight slide (mengantar kelompok widget ini). Narasi per-widget ada
   * di `WidgetSpec.insight`.
   */
  narasi?: string;
  /** Asal narasi slide: dari RAG, disusun otomatis, atau diedit manual. */
  narasiAsal?: 'rag' | 'otomatis' | 'manual';
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

export interface ChatMessage {
  id: string;
  sender: 'user' | 'system';
  text: string;
  timestamp: string;
  actionTaken?: 'create_dashboard' | 'update_widget' | 'remove_widget' | 'add_widget' | 'filter' | 'none' | 'qa_answer' | 'no_kb' | 'rag_error';
  affectedWidgetId?: string;
  modeUsed?: 'Jalur A (LLM JSON)' | 'Chatbot RAG' | 'Fallback (Template Snapshot)' | 'Gagal (Layanan RAG)' | 'Gagal (Dokumen Tidak Memadai)';
  citationsCount?: number;
  progressSteps?: ProgressStep[];
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

/* ================= PELAPORAN PERIODIK & KEPATUHAN ================= */

/** Jenis periode pelaporan BUMD. */
export type JenisLaporan = 'bulanan' | 'triwulanan' | 'semesteran' | 'tahunan';

/**
 * Status satu laporan periodik.
 * `belum` = belum disusun, `draf` = masih dikerjakan, `terkirim` = sudah
 * disampaikan, `terverifikasi` = sudah diperiksa & diterima, `revisi` = perlu
 * diperbaiki sebelum diterima.
 */
export type StatusLaporan = 'belum' | 'draf' | 'terkirim' | 'terverifikasi' | 'revisi';

/**
 * Kewajiban lapor — SATU jenis laporan yang wajib disampaikan instansi
 * (mis. "Laporan Kinerja Triwulanan", "Laporan Keuangan Bulanan").
 *
 * Dipisah dari `LaporanPeriodik` supaya admin mendefinisikan kewajiban SEKALI,
 * lalu sistem menghitung sendiri periode mana yang belum dilaporkan — tanpa
 * perlu membuat entri baru tiap bulan.
 */
export interface KewajibanLapor {
  id: string;
  tenantId: string;
  nama: string;
  jenis: JenisLaporan;
  /** Dasar hukum / dasar permintaan laporan (opsional, ditampilkan sebagai konteks). */
  dasar?: string;
  /** Pihak yang menerima laporan (mis. "Pemda", "BPKP", "Dewan Pengawas"). */
  penerima?: string;
  /** Tenggat dalam HARI setelah periode berakhir (mis. 10 = tanggal 10 bulan berikutnya). */
  tenggatHari: number;
  isActive: boolean;
  createdAt: string;
}

/** Satu berkas lampiran laporan (metadata saja — file disimpan di luar aplikasi). */
export interface LampiranLaporan {
  nama: string;
  /** Ukuran dalam byte bila diketahui. */
  ukuran?: number;
  /** Catatan singkat tentang berkas. */
  catatan?: string;
}

/**
 * Satu tahap dalam rantai persetujuan laporan.
 *
 * Contoh: `{ urutan: 1, nama: 'Verifikasi Kabag Keuangan', peran: 'analis' }`.
 * `peran` menentukan siapa yang berhak MENYELESAIKAN tahap ini (admin selalu boleh).
 */
export interface TahapAlur {
  urutan: number;
  nama: string;
  peran: UserRole;
}

/**
 * Alur verifikasi — rantai persetujuan laporan milik satu instansi.
 *
 * Dipisah dari laporan supaya instansi mendefinisikan alurnya SEKALI, lalu
 * setiap laporan cukup menunjuk `alurId`. Bila laporan tidak menunjuk alur
 * apa pun, sistem memakai `ALUR_BAWAAN` (lihat `services/laporan/alur.ts`).
 */
export interface AlurVerifikasi {
  id: string;
  tenantId: string;
  nama: string;
  tahap: TahapAlur[];
  /** Alur yang dipakai otomatis saat laporan baru dibuat tanpa alur eksplisit. */
  isDefault: boolean;
  createdAt: string;
}

/**
 * Satu aksi yang SUDAH terjadi pada rantai verifikasi (append-only, jadi
 * riwayatnya bisa diaudit: siapa, kapan, dengan catatan apa).
 */
export interface AksiVerifikasi {
  /** Tahap yang diselesaikan. 0 = aksi pengiriman oleh penyusun. */
  urutan: number;
  aksi: 'kirim' | 'setujui' | 'revisi';
  oleh: string;
  olehId: string;
  peran: UserRole;
  catatan?: string;
  pada: string;
}

/** Posisi sebuah laporan di dalam rantai verifikasinya (dihitung, bukan disimpan). */
export interface PosisiVerifikasi {
  /** Jumlah tahap yang sudah disetujui. */
  selesai: number;
  total: number;
  /** Tahap yang sedang menunggu; `null` bila rantai sudah selesai / perlu revisi. */
  tahapAktif: TahapAlur | null;
  /** true bila seluruh tahap sudah disetujui. */
  tuntas: boolean;
  /** true bila laporan sedang berstatus revisi. */
  perluRevisi: boolean;
}

/**
 * LaporanPeriodik — REALISASI pelaporan untuk satu periode tertentu.
 *
 * Hanya dibuat saat instansi benar-benar menyusun/mengirim laporan. Ketiadaan
 * entri = belum lapor (sistem menghitungnya sebagai "belum"), jadi tidak ada
 * status yang dikarang.
 */
export interface LaporanPeriodik {
  id: string;
  tenantId: string;
  /** Menunjuk `KewajibanLapor.id` yang dipenuhi laporan ini. */
  kewajibanId: string;
  /** Salinan nama kewajiban agar riwayat tetap terbaca walau kewajiban diubah. */
  nama: string;
  jenis: JenisLaporan;
  /** Kode periode, mis. `2026-01` (bulanan), `2026-Q1` (triwulanan), `2026`. */
  periode: string;
  status: StatusLaporan;
  /** Tenggat efektif (ISO). Dihitung saat entri dibuat dari kewajiban. */
  deadline?: string;
  /** Waktu laporan disampaikan (ISO) — diisi saat status menjadi terkirim. */
  tanggalKirim?: string;
  /** Nama penyusun laporan. */
  disusunOleh?: string;
  /** Catatan / ringkasan isi laporan. */
  catatan?: string;
  /** Berkas yang menyertai laporan. */
  lampiran: LampiranLaporan[];
  /** Alur verifikasi yang dipakai laporan ini (kosong = alur bawaan). */
  alurId?: string;
  /** Jejak persetujuan bertingkat (append-only). Kosong untuk laporan lama. */
  riwayatVerifikasi?: AksiVerifikasi[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Ringkasan kepatuhan pelaporan satu periode — DIHITUNG server dari kewajiban
 * aktif vs laporan yang ada. Semua angka berasal dari data nyata; periode yang
 * belum punya kewajiban tidak dihitung agar tidak menyesatkan.
 */
export interface RingkasanKepatuhan {
  periode: string;
  totalKewajiban: number;
  sudahTerverifikasi: number;
  sudahTerkirim: number;
  draf: number;
  perluRevisi: number;
  belumLapor: number;
  /** Persentase kepatuhan = (terverifikasi + terkirim) / totalKewajiban × 100. */
  persenKepatuhan: number;
  /** Jumlah yang sudah lewat tenggat tetapi belum terkirim/terverifikasi. */
  terlambat: number;
}

/* ================= TINDAK LANJUT AUDIT (BPK / Inspektorat / BPKP) ================= */

/** Lembaga pemeriksa yang menerbitkan temuan. */
export type SumberAudit = 'bpk' | 'inspektorat' | 'bpkp' | 'kpk' | 'lainnya';

/**
 * Status tindak lanjut sebuah temuan.
 * `belum` = belum ada aksi, `proses` = sedang ditindaklanjuti,
 * `selesai` = tuntas (wajib punya minimal satu aksi), `tidak_ditindaklanjuti`
 * = dinyatakan tidak dapat ditindaklanjuti (wajib alasan, mis. objek sudah tidak ada).
 */
export type StatusTindakLanjut = 'belum' | 'proses' | 'selesai' | 'tidak_ditindaklanjuti';

/** Satu aksi tindak lanjut yang SUDAH dilakukan (append-only, bisa diaudit). */
export interface AksiTindakLanjut {
  id: string;
  tanggal: string;
  uraian: string;
  oleh: string;
  olehId: string;
  /** Nama berkas bukti (metadata saja — berkas disimpan di luar aplikasi). */
  bukti: LampiranLaporan[];
  /** Status temuan SETELAH aksi ini dicatat. */
  statusSesudah: StatusTindakLanjut;
  pada: string;
}

/**
 * TemuanAudit — SATU temuan hasil pemeriksaan beserta rekomendasinya.
 *
 * Dipisah dari aksi tindak lanjut supaya temuan didefinisikan SEKALI (dari LHP),
 * lalu setiap langkah tindak lanjut dicatat sebagai entri append-only — persis
 * pola `KewajibanLapor` + `LaporanPeriodik`.
 */
export interface TemuanAudit {
  id: string;
  tenantId: string;
  sumber: SumberAudit;
  /** Nomor Laporan Hasil Pemeriksaan, mis. "05/LHP/XX/2025". */
  nomorLHP: string;
  /** Tanggal LHP terbit (ISO). */
  tanggalLHP: string;
  /** Periode yang diperiksa, mis. "2024" atau "2024-2025". */
  periodePemeriksaan?: string;
  /** Judul temuan singkat. */
  judul: string;
  /** Uraian temuan (kondisi, kriteria, sebab, akibat). */
  uraian?: string;
  /** Nilai temuan / kerugian (Rp) bila disebutkan di LHP. */
  nilaiTemuan?: number;
  /** Rekomendasi dari pemeriksa — inti yang harus ditindaklanjuti. */
  rekomendasi: string;
  status: StatusTindakLanjut;
  /** Batas waktu tindak lanjut (ISO) — dari LHP atau ditetapkan sendiri. */
  batasWaktu?: string;
  /** Pejabat/unit penanggung jawab tindak lanjut. */
  penanggungJawab?: string;
  /** Alasan bila status `tidak_ditindaklanjuti`. */
  alasanTidakLanjut?: string;
  /** Jejak tindak lanjut (append-only). Kosong = belum ada aksi. */
  aksiTindakLanjut: AksiTindakLanjut[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Ringkasan tindak lanjut audit — DIHITUNG server dari temuan nyata.
 * `persenTindakLanjut` adalah indikator kinerja resmi daerah
 * (persentase tindak lanjut rekomendasi hasil pemeriksaan).
 */
export interface RingkasanAudit {
  total: number;
  belum: number;
  proses: number;
  selesai: number;
  tidakDitindaklanjuti: number;
  /** Jumlah temuan yang lewat `batasWaktu` dan belum `selesai`. */
  lewatTenggat: number;
  /** (selesai + tidak_ditindaklanjuti) / total × 100 — sesuai konvensi IKU. */
  persenTindakLanjut: number;
  /** Total nilai temuan (Rp) dari temuan yang nilainya diketahui. */
  totalNilai: number;
  /** Rincian per sumber pemeriksa. */
  perSumber: Array<{
    sumber: SumberAudit;
    total: number;
    selesai: number;
    persenTindakLanjut: number;
  }>;
}

/* ================= KESEHATAN KEUANGAN & RASIO ================= */

/**
 * Komponen neraca/laba-rugi yang ditarik dari dokumen resmi.
 *
 * Semua field OPSIONAL: dokumen BUMD tidak selalu memuat semuanya. Nilai yang
 * tidak ada di dokumen dibiarkan `undefined` (BUKAN 0) — rasio yang bergantung
 * padanya lalu dihitung sebagai `null`, bukan angka palsu.
 */
export interface KomponenKeuangan {
  totalAset?: number;
  asetLancar?: number;
  liabilitas?: number;
  liabilitasLancar?: number;
  ekuitas?: number;
  pendapatan?: number;
  labaBersih?: number;
  /** Untuk sektor perbankan: kredit bermasalah (NPL) & kredit total. */
  kreditBermasalah?: number;
  totalKredit?: number;
  /** Untuk sektor air: angka kehilangan air (NRW) dalam %. */
  nrw?: number;
  /** Untuk sektor perbankan: beban operasional & pendapatan operasional (BOPO). */
  bebanOperasional?: number;
  pendapatanOperasional?: number;
  /** Kas & setara kas (untuk cash ratio). */
  kas?: number;
}

/** Nama akun yang bisa dikoreksi/dikonfirmasi pengguna per field. */
export type KunciKomponen = keyof KomponenKeuangan;

/**
 * Satu rasio keuangan yang DIHITUNG server dari `komponen`.
 * `nilai` = null bila komponen pembilang/penyebut tidak tersedia di dokumen.
 */
export interface RasioKeuangan {
  kunci: string;
  label: string;
  /** Nilai rasio dalam persen (mis. 3.05 berarti 3,05%) atau kali (DER). */
  nilai: number | null;
  /** Satuan tampil: '%' atau '×'. */
  satuan: '%' | '×';
  /** Kategori kesehatan menurut ambang Permen EKON 2/2023 (bila berlaku). */
  kategori?: 'sangat_sehat' | 'sehat' | 'cukup_sehat' | 'kurang_sehat' | 'tidak_sehat';
  /** Ambang yang dipakai, untuk ditampilkan (transparansi). */
  ambang?: string;
  /** Rumus singkat, ditampilkan agar bisa diaudit. */
  rumus: string;
  /** true bila hanya berlaku untuk sektor tertentu (mis. NPL/BOPO untuk bank). */
  sektorKhusus?: BumdSector[];
}

/**
 * Snapshot kesehatan keuangan satu periode.
 *
 * `komponen` = angka mentah dari dokumen (dengan sitasi), `rasio` = hasil
 * hitungan server. Rasio TIDAK PERNAH diterima dari klien — selalu dihitung
 * ulang dari `komponen` supaya tidak bisa dipalsukan.
 */
export interface SnapshotKeuangan {
  id: string;
  tenantId: string;
  /** Kode periode, mis. `2026-Q1` atau `2025`. */
  periode: string;
  /** Label periode untuk tampilan, mis. "Triwulan I 2026". */
  periodeLabel: string;
  komponen: KomponenKeuangan;
  /** Sitasi per field komponen — angka bisa dilacak ke dokumen. */
  sitasi: Partial<Record<KunciKomponen, Citation>>;
  /** Rasio terhitung (diisi server). */
  rasio: RasioKeuangan[];
  /** Skor kesehatan gabungan 0-100 (bila cukup data). */
  skorKesehatan?: number;
  catatan?: string;
  disusunOleh?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Ringkasan kesehatan keuangan: snapshot periode terbaru + perbandingan dengan
 * periode sebelumnya (delta tiap rasio). Dihitung server dari data nyata.
 */
export interface RingkasanKeuangan {
  /** Snapshot periode terbaru (null bila belum ada). */
  terbaru: SnapshotKeuangan | null;
  /** Snapshot periode sebelumnya (untuk delta), bila ada. */
  sebelumnya: SnapshotKeuangan | null;
  /** Delta nilai rasio (terbaru − sebelumnya) per kunci rasio. */
  delta: Record<string, number | null>;
  /** Daftar periode yang tersedia (terbaru lebih dulu). */
  periodeTersedia: string[];
}

/* ================= MANAJEMEN RISIKO ================= */

/** Kategori risiko mengikuti taksonomi lazim SPIP/manajemen risiko BUMD. */
export type KategoriRisiko =
  | 'strategis'
  | 'operasional'
  | 'keuangan'
  | 'kepatuhan'
  | 'reputasi';

/**
 * Level risiko = hasil pemetaan skor (kemungkinan × dampak) ke pita.
 * Dipakai untuk warna heat map dan penentuan prioritas mitigasi.
 */
export type LevelRisiko = 'rendah' | 'sedang' | 'tinggi' | 'ekstrem';

/**
 * Status siklus hidup risiko:
 * `teridentifikasi` = baru terdaftar, belum ada mitigasi;
 * `dimitigasi` = mitigasi sedang dijalankan;
 * `terkendali` = risiko sudah turun ke level yang dapat diterima;
 * `ditutup` = risiko tidak lagi relevan (wajib alasan).
 */
export type StatusRisiko = 'teridentifikasi' | 'dimitigasi' | 'terkendali' | 'ditutup';

/** Satu langkah mitigasi yang SUDAH dilakukan (append-only, bisa diaudit). */
export interface AksiMitigasi {
  id: string;
  tanggal: string;
  uraian: string;
  oleh: string;
  olehId: string;
  /** Nama berkas bukti (metadata saja — berkas disimpan di luar aplikasi). */
  bukti: LampiranLaporan[];
  /** Status risiko SETELAH aksi ini dicatat. */
  statusSesudah: StatusRisiko;
  /** Level risiko residual yang dinilai setelah mitigasi (opsional). */
  levelResidual?: LevelRisiko;
  pada: string;
}

/**
 * Risiko — SATU entri register risiko instansi.
 *
 * `skor` dan `level` DIHITUNG server dari `kemungkinan` × `dampak`; nilai yang
 * dikirim klien diabaikan supaya tingkat risiko tidak bisa dipalsukan (prinsip
 * yang sama dengan rasio kesehatan keuangan).
 */
export interface Risiko {
  id: string;
  tenantId: string;
  /** Kode unik risiko, mis. "R-01". */
  kode: string;
  kategori: KategoriRisiko;
  /** Pernyataan risiko: "Kemungkinan ... yang menyebabkan ...". */
  pernyataan: string;
  /** Penyebab risiko. */
  penyebab?: string;
  /** Uraian dampak bila risiko terjadi. */
  dampakUraian?: string;
  /** Sasaran/tujuan yang terancam (tautan ke kinerja). */
  sasaran?: string;
  /** Skala 1-5: kemungkinan (likelihood). */
  kemungkinan: number;
  /** Skala 1-5: dampak (impact). */
  dampak: number;
  /** kemungkinan × dampak (dihitung server). */
  skor: number;
  /** Level dari skor (dihitung server). */
  level: LevelRisiko;
  status: StatusRisiko;
  /** Unit/pemilik risiko. */
  pemilikRisiko?: string;
  /** Rencana mitigasi (uraian rencana yang akan dijalankan). */
  rencanaMitigasi?: string;
  /** Batas waktu mitigasi (ISO). */
  batasWaktu?: string;
  /** Level risiko residual terakhir yang dinilai (dari aksi mitigasi terbaru). */
  levelResidual?: LevelRisiko;
  /** Jejak mitigasi (append-only). Kosong = belum ada aksi. */
  aksiMitigasi: AksiMitigasi[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Ringkasan risiko — DIHITUNG server dari register nyata.
 * `risikoTinggi` (level tinggi + ekstrem) adalah angka yang dicari direksi;
 * `matriks` 5×5 adalah heat map standar (baris = kemungkinan, kolom = dampak).
 */
export interface RingkasanRisiko {
  total: number;
  perLevel: Record<LevelRisiko, number>;
  perKategori: Array<{
    kategori: KategoriRisiko;
    total: number;
    levelTertinggi: LevelRisiko | null;
  }>;
  /** Jumlah risiko level tinggi + ekstrem (prioritas perhatian direksi). */
  risikoTinggi: number;
  /** Jumlah risiko yang lewat `batasWaktu` dan belum terkendali/ditutup. */
  lewatTenggat: number;
  /** Matriks 5×5: `matriks[kemungkinan-1][dampak-1]` = jumlah risiko. */
  matriks: number[][];
  /** Rata-rata skor risiko (0 bila kosong). */
  rataSkor: number;
}

/* ================= MANAJEMEN ASET ================= */

/**
 * Kategori aset BUMD mengikuti penggolongan barang milik daerah / aset
 * operasional (Permendagri 19/2016 tentang pengelolaan BMD).
 */
export type KategoriAset =
  | 'tanah'
  | 'bangunan'
  | 'mesin'
  | 'jaringan'
  | 'kendaraan'
  | 'peralatan'
  | 'lainnya';

/**
 * Kondisi fisik aset — dasar prioritas pemeliharaan/penggantian.
 * `rusak_berat` adalah angka yang dicari direksi (aset berisiko mangkrak).
 */
export type KondisiAset = 'baik' | 'rusak_ringan' | 'rusak_berat';

/**
 * Status pemanfaatan aset:
 * `digunakan` = dipakai operasional; `idle` = menganggur (potensi pemborosan);
 * `disewakan` = sumber pendapatan lain; `dilepas` = sudah dihapuskan/dijual.
 */
export type StatusPemanfaatan = 'digunakan' | 'idle' | 'disewakan' | 'dilepas';

/**
 * Aset — SATU entri daftar aset instansi.
 *
 * `nilaiBuku` dan `akumulasiPenyusutan` TIDAK disimpan sebagai input: keduanya
 * DIHITUNG server dari `nilaiPerolehan`, `nilaiResidu`, `umurEkonomis`, dan
 * tahun berjalan (metode garis lurus). Tanah tidak disusutkan. Prinsip yang
 * sama dengan risiko & rasio keuangan: angka turunan dihitung, bukan diterima.
 */
export interface Aset {
  id: string;
  tenantId: string;
  /** Kode aset, mis. "AST-01" atau nomor register barang. */
  kode: string;
  nama: string;
  kategori: KategoriAset;
  /** Lokasi/unit pemakai aset. */
  lokasi?: string;
  /** Tahun perolehan (dipakai menghitung umur berjalan). */
  tahunPerolehan: number;
  /** Harga perolehan (Rupiah). */
  nilaiPerolehan: number;
  /** Umur ekonomis dalam tahun (1-50). */
  umurEkonomis: number;
  /** Nilai residu/sisa (Rupiah) — dasar penyusutan. */
  nilaiResidu: number;
  kondisi: KondisiAset;
  pemanfaatan: StatusPemanfaatan;
  catatan?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Ringkasan aset — DIHITUNG server dari daftar nyata.
 * `nilaiBukuTotal` = nilai aset saat ini setelah penyusutan; `jumlahRusakBerat`
 * dan `jumlahIdle` adalah angka pengawasan direksi/inspektorat.
 */
export interface RingkasanAset {
  total: number;
  nilaiPerolehanTotal: number;
  nilaiBukuTotal: number;
  akumulasiPenyusutanTotal: number;
  perKategori: Array<{
    kategori: KategoriAset;
    total: number;
    nilaiBuku: number;
  }>;
  perKondisi: Record<KondisiAset, number>;
  /** Jumlah aset kondisi rusak berat. */
  jumlahRusakBerat: number;
  /** Jumlah aset yang idle/tidak termanfaatkan (indikasi pemborosan). */
  jumlahIdle: number;
  /** Tahun perhitungan (dipakai UI untuk menandai "per tahun X"). */
  tahunPerhitungan: number;
}

/* ================= PERJANJIAN KINERJA ================= */

/**
 * Status siklus hidup Perjanjian Kinerja:
 * `draf` = masih disusun, belum ditandatangani;
 * `aktif` = sudah disepakati & berjalan (target menjadi komitmen);
 * `ditutup` = periode selesai / dievaluasi.
 */
export type StatusPerjanjianKinerja = 'draf' | 'aktif' | 'ditutup';

/**
 * Arah capaian indikator:
 * `maksimal` = semakin tinggi semakin baik (mis. produksi air, pendapatan);
 * `minimal` = semakin rendah semakin baik (mis. kebocoran, keluhan pelanggan).
 * Dipakai agar persentase capaian benar untuk kedua jenis indikator.
 */
export type ArahIndikator = 'maksimal' | 'minimal';

/**
 * Satu indikator kinerja dalam Perjanjian Kinerja: sasaran → indikator →
 * target, beserta realisasi (capaian) yang dicatat terpisah.
 */
export interface IndikatorKinerja {
  id: string;
  /** Sasaran strategis yang diukur. */
  sasaran: string;
  /** Rumusan indikator kinerja. */
  indikator: string;
  /** Satuan target (mis. "%", "Rp juta", "unit"). */
  satuan: string;
  /** Target yang dijanjikan. */
  target: number;
  /** Arah capaian (menentukan cara menghitung persentase). */
  arah: ArahIndikator;
  /** Realisasi/capaian aktual — diisi saat pelaporan (opsional). */
  realisasi?: number;
  /** Catatan penjelasan capaian. */
  catatanRealisasi?: string;
}

/**
 * Perjanjian Kinerja — dokumen komitmen target kinerja antara pejabat penilai
 * (pihak pertama) dan pejabat yang dinilai (pihak kedua).
 *
 * Prinsip: `target` adalah komitmen; `realisasi` dicatat belakangan. Persentase
 * capaian DIHITUNG (bukan disimpan) agar tidak bisa dipalsukan.
 */
export interface PerjanjianKinerja {
  id: string;
  tenantId: string;
  /** Nomor dokumen, mis. "PK-01/DIR/2026". */
  nomor: string;
  /** Periode/tahun anggaran, mis. "2026". */
  periode: string;
  /** Pihak pertama (pejabat penilai), mis. Direktur Utama. */
  pihakPertama: string;
  jabatanPertama: string;
  /** Pihak kedua (yang berjanji kinerja). */
  pihakKedua: string;
  jabatanKedua: string;
  /** Tanggal penetapan (ISO). */
  tanggal: string;
  status: StatusPerjanjianKinerja;
  indikator: IndikatorKinerja[];
  catatan?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Ringkasan Perjanjian Kinerja — DIHITUNG server dari dokumen nyata.
 * `capaianRataRata` = rata-rata persentase capaian indikator yang sudah
 * direalisasikan (null bila belum ada realisasi sama sekali).
 */
export interface RingkasanPerjanjianKinerja {
  total: number;
  perStatus: Record<StatusPerjanjianKinerja, number>;
  jumlahIndikator: number;
  /** Jumlah indikator yang sudah punya realisasi. */
  indikatorTerealisasi: number;
  /** Jumlah indikator capaian >= 100%. */
  indikatorTercapai: number;
  /** Rata-rata capaian (%) dari indikator yang sudah direalisasikan, atau null. */
  capaianRataRata: number | null;
  /** Periode (tahun) terbaru yang tercatat. */
  periodeTerbaru: string | null;
}

/* ================= LKjIP (LAPORAN KINERJA INSTANSI PEMERINTAH) ================= */

/**
 * Status penyusunan LKjIP:
 * `draf` = masih disusun; `final` = sudah ditandatangani & siap disampaikan.
 */
export type StatusLKjIP = 'draf' | 'final';

/** Satu bab/bagian bebas dalam LKjIP (analisis, kendala, tindak lanjut, dst.). */
export interface BagianLKjIP {
  id: string;
  /** Judul bab, mis. "Analisis Capaian Kinerja". */
  judul: string;
  /** Isi naratif bab. */
  isi: string;
}

/**
 * LKjIP — laporan kinerja tahunan instansi, disusun dari Perjanjian Kinerja
 * periode tersebut.
 *
 * Prinsip: LKjIP **menautkan** Perjanjian Kinerja (`perjanjianKinerjaIds`);
 * ringkasan capaiannya DIHITUNG dari indikator PK yang ditautkan, bukan
 * diketik ulang — supaya laporan tidak bisa berbeda dari komitmennya.
 * Tenggat penyampaian: 2 bulan setelah tahun anggaran berakhir.
 */
export interface LKjIP {
  id: string;
  tenantId: string;
  /** Periode/tahun anggaran yang dilaporkan, mis. "2026". */
  periode: string;
  nomor: string;
  judul: string;
  status: StatusLKjIP;
  /** Tanggal penyusunan/penetapan (ISO). */
  tanggal: string;
  ringkasanEksekutif: string;
  bagian: BagianLKjIP[];
  /** Id Perjanjian Kinerja yang menjadi dasar laporan ini. */
  perjanjianKinerjaIds: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Ringkasan LKjIP — DIHITUNG server. `rataCapaian` ditarik dari indikator
 * Perjanjian Kinerja yang ditautkan (null bila belum ada realisasi).
 */
export interface RingkasanLKjIP {
  total: number;
  perStatus: Record<StatusLKjIP, number>;
  /** Jumlah indikator (dari PK tertaut) yang sudah direalisasikan. */
  indikatorTerealisasi: number;
  /** Jumlah indikator (dari PK tertaut) capaian >= 100%. */
  indikatorTercapai: number;
  /** Rata-rata capaian (%) dari indikator PK tertaut, atau null. */
  rataCapaian: number | null;
  /** Jumlah LKjIP yang lewat tenggat dan belum final. */
  lewatTenggat: number;
  /** Periode terbaru yang tercatat. */
  periodeTerbaru: string | null;
}

/* ================= MANAJEMEN BERKAS (KMS) ================= */

/**
 * Satu berkas di repositori KMS (`ragkms.aiones.app`).
 *
 * Bentuknya mengikuti balasan `GET /api/documents` layanan KMS; field yang
 * tidak dikirim layanan dibiarkan `undefined` (jangan diisi tebakan).
 */
export interface BerkasKMS {
  id: string;
  organizationId: string;
  organizationName?: string;
  title: string;
  category?: string;
  /** 'document' | 'photo' */
  repositoryType?: string;
  /** PDF, DOCX, XLSX, TXT, JPG, … (huruf besar dari layanan). */
  fileType?: string;
  fileSizeKb?: number;
  fileUrl?: string;
  year?: number | null;
  department?: string | null;
  notes?: string | null;
  summary?: string | null;
  tags?: string[];
  uploadedBy?: string;
  uploadedAt?: string;
  chunksCount?: number;
  /** 'indexed' | 'pending' | 'failed' | … (status indeks ke RAG). */
  ragStatus?: string;
  cdnFileId?: string | null;
  /** Jumlah halaman (dari basis dokumen, bukan repositori). */
  halaman?: number;
  /** true = dokumen sudah ada di basis dokumen instansi tetapi belum pernah
   *  masuk repositori, jadi belum ada salinan berkas untuk pratinjau/unduh. */
  hanyaBasis?: boolean;
}

/** Project/organisasi di layanan KMS (satu project = satu knowledge base). */
export interface OrganisasiKMS {
  id: string;
  name: string;
  code?: string;
  /** KB yang otomatis dibuat KMS untuk project ini (mis. `kb_aoc_budi_motor_8nx3`). */
  knowledgeBase?: string;
  type?: string;
  status?: string;
  documentsCount?: number;
  chunksCount?: number;
  storageUsedMb?: number;
  createdAt?: string;
}

/** Ringkasan repositori berkas instansi — DIHITUNG server dari data KMS. */
export interface RingkasanBerkas {
  total: number;
  /** Total ukuran berkas (KB) dari field `fileSizeKb`. */
  totalKb: number;
  /** Jumlah berkas yang sudah terindeks ke RAG. */
  terindeks: number;
  /** Jumlah berkas yang belum/gagal terindeks. */
  belumTerindeks: number;
  /** Jumlah per jenis berkas (PDF, DOCX, …), urut menurun. */
  perTipe: Array<{ tipe: string; jumlah: number }>;
  /** Ukuran berkas terbesar (KB), 0 bila kosong. */
  terbesarKb: number;
  /** Waktu unggah terbaru (ISO), null bila kosong. */
  terbaruPada: string | null;
}
