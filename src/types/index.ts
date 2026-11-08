export type BumdSector = 'pdam' | 'pasar' | 'bank' | 'rsud' | 'transportasi' | 'aneka_usaha';

/**
 * Peran pengguna aplikasi.
 *
 * Tiga peran:
 * - `superadmin` — Admin Aiones (pihak pengelola platform): lintas instansi,
 *   konfigurasi RAG/KMS, akun admin instansi, audit lintas instansi.
 * - `admin` — Admin Instansi (pihak konsumen): mengelola dashboard instansinya,
 *   menerima permintaan data dari `pengguna`, menyusun halaman.
 * - `pengguna` — User: mengajukan permintaan data, mengunggah dokumen, menulis
 *   catatan arah. TIDAK boleh membuat atau menghapus dashboard.
 *
 * Peran `analis`/`direksi` sudah dihapus; data lama dinormalkan ke `pengguna`
 * oleh `normalisasiPeran`.
 */
export type UserRole = 'superadmin' | 'admin' | 'pengguna';

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
  /**
   * Akun memakai kata sandi sementara (dibuat admin / hasil reset) sehingga
   * wajib mengganti kata sandi saat login berikutnya. Hilang setelah diganti.
   */
  mustChangePassword?: boolean;
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
  /**
   * Desain chart dari katalog Template Chart: `default`, `ringkasan` (Pijar),
   * `analitik` (Lensa), atau `trafik` (Nadi). Mengatur bentuk, warna kartu,
   * gradasi, dan label sekaligus. Kosong = ikut tema aplikasi.
   */
  desain?: 'default' | 'ringkasan' | 'analitik' | 'trafik' | 'kaca' | 'tirta' | 'aurora' | 'neon' | 'blok' | 'bento' | 'koran' | 'korporat';
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
  /**
   * Palet khusus per grafik pada desain template, mis. `{ bar: 'brand' }`.
   * Kunci mengikuti grafik di template (bar, donut, area, trafik, ...).
   * Kosong = seluruh grafik memakai `palette`.
   */
  chart?: Record<string, string>;
}

export interface WidgetSpec {
  id: string;
  presetId?: string;
  type: WidgetType;
  /**
   * Chart katalog Template Chart yang dipakai widget ini (mis. `bar-tegak-sorot`).
   * Kosong = dipilih otomatis dari `type`. Semua dashboard baru mengisinya.
   */
  chartId?: string;
  /**
   * Chart katalog BAWAAN yang benar-benar menggambar kartu ini.
   *
   * Diisi hanya kalau `chartId` menunjuk entri katalog buatan sendiri
   * (`kustom-…`, dibuat otomatis saat tidak ada chart bawaan yang cocok dengan
   * bentuk datanya). Renderer menggambar dari sini, jadi kartu tidak pernah
   * kosong dan tetap memakai chart dari Template Chart.
   */
  chartDasar?: string;
  title: string;
  subtitle?: string;
  category?: string;
  /**
   * Nama ikon (lucide) yang ditampilkan di kepala kartu — dipakai template supaya
   * kartu KPI punya penanda visual seperti pratinjaunya (mis. `wallet`, `trending-up`).
   */
  ikon?: string;
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
  /**
   * Rancangan chart dari asisten (RAG): bentuk, warna, judul sumbu, dll. dipilih
   * sendiri dari isi dokumen. Selama widget tidak memakai chart katalog
   * (`chartId`) atau gaya template (`style.desain`), kanvas menggambar chart
   * persis seperti rancangan ini. Lihat `services/chart/rancanganRag.ts`.
   */
  rancangan?: RancanganChart;
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
    /**
     * Beberapa target sekaligus (kartu "Progres Target" pada template): tiap baris
     * punya label, capaian persen, dan status warna. Dipakai tipe `bullet-target`
     * agar satu kartu bisa memuat tiga progres seperti pratinjau template.
     */
    targets?: Array<{
      label: string;
      persen: number;
      status: 'sesuai' | 'mendekati' | 'perhatian';
    }>;
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

/**
 * TATA LETAK KARTU PADA DESAIN TEMPLATE.
 *
 * Komponen replika (`DashboardReferensi`, `DashboardAnalitik`, `DashboardTrafik`)
 * menyusun kartu dalam beberapa baris grid. Pemilik aplikasi ingin susunan itu
 * bisa diubah langsung di kanvas tanpa mematikan desain template, jadi urutan
 * dan lebar tiap kartu disimpan per baris (`grupId`).
 */
export interface TataLetakBaris {
  /** Urutan id kartu. Id yang tidak tercatat ditaruh di belakang, urutan aslinya. */
  urut?: string[];
  /** Lebar kartu dalam satuan kolom grid (1..jumlah kolom baris). */
  lebar?: Record<string, number>;
  /** Tinggi kartu dalam piksel, bila pemilik dashboard menarik sisi atas/bawah. */
  tinggi?: Record<string, number>;
}

export interface Dashboard {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  sector: BumdSector;
  /**
   * TEMA VISUAL dashboard (opsional).
   *
   * Dashboard yang dibuat dari template membawa tema template-nya — `oranye`,
   * `analitik`, atau `trafik` — sehingga hasil nyatanya tampil dengan latar, warna
   * kartu, dan aksen yang sama seperti pratinjau template (permintaan pengguna:
   * "desain dan warnanya sama persis"). Kosong = ikut tema aplikasi.
   */
  tema?: string;
  /**
   * Gaya global dashboard (panel Gaya Widget). Dipakai juga oleh desain template,
   * yang tidak membaca `widget.style`, supaya warna kartu tetap bisa diubah.
   */
  gaya?: WidgetStyle;
  /**
   * TATA LETAK KARTU DESAIN TEMPLATE (opsional).
   *
   * Kunci luar = id template (`tpl-ringkasan`, `tpl-analitik`, `tpl-trafik`),
   * nilainya peta `grupId` → urutan dan lebar kartu. Kosong = susunan asli.
   */
  tataLetak?: Record<string, Record<string, TataLetakBaris>>;
  /**
   * JEJAK TEMPLATE (opsional).
   *
   * Dashboard yang lahir dari template menyimpan templateId dan angka dokumen
   * yang sudah dipetakan ke slot template. Dipakai supaya tampilan dashboard
   * nyata bisa langsung memakai komponen replika — hasilnya sama persis dengan
   * pratinjau data asli, bukan kanvas widget generik.
   */
  replika?: { templateId: string; nilai: unknown };
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
  /**
   * HALAMAN DASHBOARD (2-10 halaman atau lebih).
   *
   * Sumber kebenaran isi dashboard: tiap halaman punya widget, desain template,
   * tata letak, dan filter sendiri. Field lama di atas (widgets, replika,
   * tataLetak, globalFilters, presentasi) hanya cermin halaman yang sedang
   * dibuka. Dashboard lama tanpa `halaman` dianggap satu halaman.
   */
  halaman?: HalamanDashboard[];
  /** Id halaman yang sedang dibuka. */
  halamanAktifId?: string;
}

/**
 * Satu halaman dashboard. Isinya terpisah dari halaman lain: kartu, angka,
 * tata letak, dan filternya sendiri.
 */
export interface HalamanDashboard {
  id: string;
  judul: string;
  widgets: WidgetSpec[];
  /** Tata letak kartu desain template, kunci = id template. */
  tataLetak?: Record<string, Record<string, TataLetakBaris>>;
  /** Jejak template halaman ini: desain sama, angka berbeda. */
  replika?: { templateId: string; nilai: unknown };
  /** Filter khusus halaman; kosong = ikut filter dashboard. */
  globalFilters?: GlobalFilters;
  /** Rencana slide halaman ini. */
  presentasi?: {
    slides: SlidePresentasi[];
    disusunAt?: string;
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
  /**
   * Penerima. Bila keduanya kosong, notifikasi berlaku untuk seluruh instansi
   * (perilaku lama notifikasi alert). Notifikasi alur permintaan data WAJIB
   * mengisi salah satunya supaya tidak bocor ke semua orang satu instansi.
   */
  untukUserId?: string;
  untukRole?: UserRole;
  /** Asal notifikasi: 'alert' (bawaan) atau 'permintaan'. */
  jenis?: 'alert' | 'permintaan';
  /** Permintaan data yang memicu notifikasi ini, bila ada. */
  permintaanId?: string;
}

/* ================= PERMINTAAN DATA (alur User → Admin Instansi) ================= */

/**
 * Status permintaan data. Alurnya sengaja sempit supaya tiap perpindahan bisa
 * dipertanggungjawabkan:
 *
 * - `baru`      — pemohon mengirim; admin belum menyentuh.
 * - `diproses`  — admin mengambil alih (atau pemohon melengkapi data yang diminta).
 * - `perlu_data`— admin menahan karena dokumen/angka kurang; bola di pemohon.
 * - `selesai`   — halaman dashboard sudah dibuat; status akhir.
 * - `ditolak`   — tidak dikerjakan, wajib beralasan; status akhir.
 */
export type StatusPermintaan = 'baru' | 'diproses' | 'perlu_data' | 'selesai' | 'ditolak';

/** Bidang permintaan. Enam bidang bawaan; instansi boleh menambah sendiri. */
export type BidangPermintaan = 'Keuangan' | 'Operasional' | 'Pelayanan' | 'SDM' | 'Kinerja' | 'Umum';

/** Berkas yang menempel pada permintaan (rujukan ke KMS, bukan salinan isi). */
export interface LampiranPermintaan {
  /** id berkas di KMS — sumber yang sama dengan menu Referensi. */
  berkasId: string;
  nama: string;
  ukuranKb?: number;
  tipe?: string;
  diunggahPada: string;
}

/** Satu tanggapan pada percakapan permintaan (pemohon maupun admin). */
export interface CatatanPermintaan {
  id: string;
  olehUserId: string;
  olehNama: string;
  olehRole: UserRole;
  pesan: string;
  pada: string;
  /** true bila catatan ini yang memindahkan status (mis. melengkapi data). */
  mengubahStatus?: boolean;
}

export interface PermintaanData {
  id: string;
  tenantId: string;
  /** Pemohon — selalu User, tetapi disimpan apa adanya bila admin mengajukan. */
  pemohonId: string;
  pemohonNama: string;
  /** Salah satu `BidangPermintaan` atau bidang tambahan buatan instansi. */
  bidang: string;
  /** Uraian data yang diminta, bahasa pemohon sendiri. */
  dataDiminta: string;
  /** Catatan arah dashboard: mau dibentuk ke arah mana. */
  arahDashboard?: string;
  prioritas: 'rendah' | 'normal' | 'tinggi';
  /** Perkiraan tanggal dibutuhkan (YYYY-MM-DD), bila pemohon mengisi. */
  targetSelesai?: string;
  status: StatusPermintaan;
  lampiran: LampiranPermintaan[];
  catatan: CatatanPermintaan[];
  /** Alasan penolakan — wajib saat status `ditolak`. */
  alasanPenolakan?: string;
  /** Admin instansi yang menangani. */
  ditanganiOleh?: string;
  /** Dashboard hasil, bila sudah dibuat dari permintaan ini. */
  dashboardId?: string;
  createdAt: string;
  updatedAt: string;
  selesaiPada?: string;
}


/* ================= ANALISIS DOKUMEN & BUTIR DATA (Fase 2) ================= */

/** Saran template halaman — hasil hitungan deterministik, bukan tebakan model. */
export interface SaranTemplate {
  templateId: string;
  nama: string;
  /** 0..1 — makin tinggi makin cocok dengan butir yang ada. */
  skor: number;
  /** Alasan dalam bahasa manusia, menyebut fokus template yang cocok. */
  alasan: string;
}

export type StatusAnalisis = 'antri' | 'proses' | 'selesai' | 'gagal' | 'tertunda-kuota';

export interface AnalisisDokumen {
  id: string;
  tenantId: string;
  permintaanId?: string;
  /** id dokumen di KMS (atau id basis dokumen lokal untuk impor tabel). */
  berkasId: string;
  judulBerkas: string;
  jenisBerkas?: string;
  status: StatusAnalisis;
  /** `tabel-lokal` = impor Excel/CSV tanpa LLM; `rag-extract` = ekstraksi dokumen. */
  metode: 'tabel-lokal' | 'rag-extract';
  ringkasan?: string;
  /** Kategori yang benar-benar muncul pada butir, urut dari yang terbanyak. */
  kategoriTerdeteksi: string[];
  rekomendasiTemplate?: SaranTemplate[];
  jumlahButir: number;
  galat?: string;
  percobaan: number;
  /**
   * Sidik isi dokumen saat dianalisis (id + ukuran + tipe + waktu unggah).
   * Selama sidik ini sama, hasil analisis dipakai ulang tanpa memanggil RAG.
   */
  sidikDokumen?: string;
  /** Sidik basis dokumen instansi — berubah bila ada dokumen baru masuk. */
  sidikKb?: string;
  /** Pengunci antar-instance PM2: instance lain tidak boleh mengklaim baris ini. */
  leaseSampai?: number;
  dibuatPada: string;
  selesaiPada?: string;
}

export type KeyakinanButir = 'tinggi' | 'sedang' | 'rendah';

export interface SeriButir {
  nama: string;
  data: number[];
  kategori?: string[];
}

export interface TabelButir {
  kolom: string[];
  baris: Array<Array<string | number>>;
}

/**
 * Satu butir data yang sudah bisa dipakai menyusun widget. Angka di sini harus
 * berasal dari dokumen — `sitasi` adalah buktinya, dan butir tanpa sitasi tidak
 * pernah dianggap disetujui.
 */
export interface ButirData {
  id: string;
  tenantId: string;
  analisisId: string;
  berkasId: string;
  permintaanId?: string;
  nama: string;
  /** Diisi `kategoriWidget()` deterministik, bukan tebakan model. */
  kategori: string;
  periode?: string;
  satuan?: string;
  nilai?: number | null;
  seri?: SeriButir[];
  tabel?: TabelButir;
  bentukDisarankan: WidgetType;
  chartIdDisarankan?: string;
  sitasi: { dokumen: string; halaman?: number; kutipan?: string };
  keyakinan: KeyakinanButir;
  status: 'draf' | 'disetujui' | 'ditolak';
  dibuatPada: string;
}

/* ================= USULAN PERUBAHAN HALAMAN (Fase 3) ================= */

/**
 * Satu perubahan yang diusulkan asisten terhadap sebuah halaman.
 *
 * Usulan TIDAK langsung mengubah dashboard. Admin melihat pratinjaunya lalu
 * menekan Terapkan. Ini disengaja: satu kalimat ambigu ("hapus kartu ini") tidak
 * boleh merusak halaman yang sudah rapi.
 */
export interface PerubahanHalaman {
  aksi: 'tambah' | 'ubah' | 'hapus' | 'urutkan';
  /** Untuk `ubah` dan `hapus`. */
  widgetId?: string;
  /** Untuk `tambah` dan `ubah`. */
  widget?: WidgetSpec;
  /** Untuk `urutkan` — urutan id widget yang baru. */
  urutan?: string[];
  /** Alasan singkat yang dibaca admin, bukan istilah mesin. */
  alasan?: string;
}

export type StatusUsulan = 'menunggu' | 'diterapkan' | 'dibatalkan';

export interface UsulanHalaman {
  id: string;
  tenantId: string;
  dashboardId: string;
  halamanId: string;
  /** Judul halaman saat usulan dibuat — supaya pratinjau tetap terbaca walau halaman diubah. */
  judulHalaman: string;
  ringkasan: string;
  perubahan: PerubahanHalaman[];
  status: StatusUsulan;
  /** `chat` bila berasal dari percakapan, `manual` bila disusun lewat panel. */
  asal: 'chat' | 'manual';
  dibuatOleh: string;
  dibuatOlehNama: string;
  dibuatPada: string;
  diterapkanPada?: string;
  /** Catatan penolakan/penyebab usulan tidak bisa diterapkan. */
  catatan?: string;
}

export interface ProgressStep {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  /**
   * Perkiraan lama proses ini (detik) — ditampilkan ke pengguna supaya ia tahu
   * harus menunggu berapa lama. Diisi server: sapuan penuh tanpa cache bisa
   * 8 menit, sedangkan hasil cache selesai di bawah satu menit.
   */
  estimasiDetik?: number;
}

/** Satu pilihan tampilan chart yang ditawarkan asisten di percakapan. */
export interface SaranChart {
  id: string;
  tipe: WidgetType;
  judul: string;
  /** Kenapa tipe ini cocok untuk indikator tersebut. */
  alasan: string;
  /** Kapan sebaiknya dipakai — membantu pengguna memilih. */
  kapan: string;
  /** Indikator yang diminta pengguna; dipakai saat mengambil angka dari dokumen. */
  indikator: string;
  /**
   * Pratinjau berisi ANGKA NYATA dari dokumen instansi. Diisi server setelah
   * mengambil data lewat RAG; bila kosong, klien memakai bentuk contoh dan
   * wajib mengatakannya terus terang.
   */
  pratinjau?: WidgetSpec;
  /** Sumber angka pratinjau, mis. "Laporan Tahunan PAM JAYA 2024 hlm. 12". */
  sumber?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'system';
  text: string;
  timestamp: string;
  actionTaken?: 'create_dashboard' | 'update_widget' | 'remove_widget' | 'add_widget' | 'filter' | 'none' | 'qa_answer' | 'no_source' | 'no_kb' | 'rag_error' | 'saran_chart' | 'daftar_dokumen' | 'arahan_permintaan';
  /**
   * Pilihan tampilan chart yang ditawarkan asisten. Pengguna melihat pratinjau
   * bentuknya, lalu menekan Oke untuk menambahkannya ke kanvas (angkanya baru
   * diambil dari dokumen saat ditambahkan).
   */
  saran?: SaranChart[];
  affectedWidgetId?: string;
  modeUsed?: 'Jalur A (LLM JSON)' | 'Tabel Dokumen' | 'Chatbot RAG' | 'Fallback (Template Snapshot)' | 'Gagal (Layanan RAG)' | 'Gagal (Dokumen Tidak Memadai)';
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
  /** Jumlah token teks yang terindeks di basis dokumen. */
  token?: number;
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


/**
 * Progres pengisian angka template dari dokumen.
 *
 * Ditampilkan saat "Pakai Template Ini" berjalan: pengisian bisa 5–15 menit
 * karena kartu yang gagal (layanan sibuk) diulang sampai terisi.
 */
export interface ProgresIsiTemplate {
  /** Kartu yang sudah berisi angka. */
  terisi: number;
  total: number;
  /** Kartu yang sudah selesai diproses (terisi maupun dinyatakan tidak ada). */
  selesai: number;
  /** Judul kartu yang sedang diproses. */
  judul: string;
  /** Detik berjalan sejak pengisian dimulai. */
  detik: number;
}

/** Rancangan chart yang dipilih asisten (RAG) sendiri untuk satu widget. */
export interface RancanganChart {
  /** Bentuk chart pilihan asisten (line, bar, donut, ...). Sama dengan `type` widget. */
  bentuk: string;
  /** Warna seri / potongan, heksadesimal (#rrggbb), berurutan. */
  warna?: string[];
  /** Judul sumbu kategori (mis. "Bulan") dan sumbu nilai (mis. "Juta m³"). */
  judulSumbuKategori?: string;
  judulSumbuNilai?: string;
  /** Seri ditumpuk (bagian dari satu total). */
  tumpuk?: boolean;
  /** Tampilkan angka di atas batang / titik / potongan. */
  tampilkanNilai?: boolean;
  /** Letak legenda. */
  legenda?: 'atas' | 'bawah' | 'kanan' | 'tidak';
  /** Garis dilengkungkan (khusus line/area). */
  garisHalus?: boolean;
  /** Alasan singkat asisten memilih bentuk ini (ditampilkan sebagai keterangan). */
  alasan?: string;
}
