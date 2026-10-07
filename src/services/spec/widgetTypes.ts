import { WidgetSpec, WidgetType } from '../../types';

export interface TipeVisualisasi {
  type: WidgetType;
  label: string;
  desc: string;
  /** Kelompok untuk pengelompokan di editor. */
  grup: 'Kartu' | 'Kartesius' | 'Komposisi' | 'Sebaran' | 'Matriks' | 'Lainnya';
}

/** Tipe visualisasi yang bisa dipilih pengguna, beserta label & deskripsinya. */
export const TIPE_VISUALISASI: TipeVisualisasi[] = [
  // Kartu & teks
  { type: 'kpi', label: 'KPI Card', desc: 'Angka ringkas dengan delta & target', grup: 'Kartu' },
  { type: 'bullet-target', label: 'Bullet (Aktual vs Target)', desc: 'Nilai aktual dibanding target', grup: 'Kartu' },
  { type: 'gauge', label: 'Gauge', desc: 'Progres terhadap target skala', grup: 'Kartu' },
  { type: 'table', label: 'Tabel Rekap', desc: 'Matriks tabular sortable', grup: 'Kartu' },
  { type: 'narasi', label: 'Narasi Eksekutif', desc: 'Teks sintesis temuan penting', grup: 'Kartu' },

  // Kartesius
  { type: 'line', label: 'Diagram Garis', desc: 'Tren dari waktu ke waktu', grup: 'Kartesius' },
  { type: 'area', label: 'Area Chart', desc: 'Tren + volume terakumulasi', grup: 'Kartesius' },
  { type: 'bar', label: 'Diagram Kolom', desc: 'Bandingkan nilai antar kategori', grup: 'Kartesius' },
  { type: 'hbar', label: 'Batang Horizontal', desc: 'Bandingkan kategori berlabel panjang', grup: 'Kartesius' },
  { type: 'combo', label: 'Combo (Dual Axis)', desc: 'Batang + garis, dua metrik', grup: 'Kartesius' },
  { type: 'waterfall', label: 'Waterfall', desc: 'Perubahan dari nilai awal ke akhir', grup: 'Kartesius' },

  // Komposisi
  { type: 'pie', label: 'Diagram Pai', desc: 'Komposisi proporsi (%)', grup: 'Komposisi' },
  { type: 'donut', label: 'Diagram Donat', desc: 'Struktur proporsi persentase', grup: 'Komposisi' },
  { type: 'treemap', label: 'Treemap', desc: 'Hierarki & komposisi berkotak', grup: 'Komposisi' },
  { type: 'funnel', label: 'Funnel', desc: 'Tahapan proses / konversi', grup: 'Komposisi' },
  { type: 'sankey', label: 'Sankey', desc: 'Aliran antar kategori', grup: 'Komposisi' },

  // Sebaran
  { type: 'scatter', label: 'Scatter Plot', desc: 'Hubungan dua variabel', grup: 'Sebaran' },
  { type: 'bubble', label: 'Bubble Chart', desc: 'Sebaran + ukuran tambahan', grup: 'Sebaran' },
  { type: 'histogram', label: 'Histogram', desc: 'Distribusi frekuensi data', grup: 'Sebaran' },
  { type: 'boxplot', label: 'Box Plot', desc: 'Distribusi & deteksi outlier', grup: 'Sebaran' },

  // Matriks & geometri
  { type: 'heatmap', label: 'Heatmap', desc: 'Pola berdasarkan intensitas warna', grup: 'Matriks' },
  { type: 'radar', label: 'Radar', desc: 'Profil multi-indikator', grup: 'Matriks' },
  { type: 'map', label: 'Peta (Filled Map)', desc: 'Sebaran nilai per wilayah', grup: 'Matriks' },

  // Lainnya
  { type: 'gantt', label: 'Gantt Chart', desc: 'Timeline / jadwal proyek', grup: 'Lainnya' },
];

/** Kelompok tipe visualisasi dalam urutan tampil. */
export const GRUP_VISUALISASI: Array<TipeVisualisasi['grup']> = [
  'Kartu', 'Kartesius', 'Komposisi', 'Sebaran', 'Matriks', 'Lainnya',
];

/** Widget punya data seri grafik (xAxis + minimal satu seri). */
export function punyaDataChart(widget?: WidgetSpec | null): boolean {
  return (
    !!widget?.chart &&
    (widget.chart.series?.length || 0) > 0 &&
    (widget.chart.xAxis?.length || 0) > 0
  );
}

/** Tipe seri yang bisa dipilih dari data xAxis+series generik. */
const SERI_GENERIK: WidgetType[] = [
  'line', 'area', 'bar', 'hbar', 'combo', 'pie', 'donut', 'treemap', 'funnel',
  'waterfall', 'heatmap', 'radar',
];

/**
 * Tipe visualisasi yang datanya BENAR-BENAR tersedia di widget ini.
 * Tujuannya: pengguna hanya melihat pilihan yang bisa dipakai — beralih ke tipe
 * yang datanya tak ada (mis. peta tanpa geo) menghasilkan kartu kosong.
 * Tipe yang sedang aktif selalu disertakan agar tetap terlihat terpilih.
 */
export function tipeKompatibel(widget?: WidgetSpec | null): TipeVisualisasi[] {
  if (!widget) return TIPE_VISUALISASI;

  const boleh = new Set<WidgetType>();

  // Seri generik: dari xAxis + series.
  if (punyaDataChart(widget)) {
    SERI_GENERIK.forEach((t) => boleh.add(t));
  }

  // Tipe yang butuh bentuk data khusus.
  if (widget.chart?.points?.length) {
    boleh.add('scatter');
    boleh.add('bubble');
  }
  if (widget.chart?.links?.length) {
    boleh.add('sankey');
  }
  if (widget.chart?.radar) {
    boleh.add('radar');
  }
  if (widget.chart?.boxRaw?.length || punyaDataChart(widget)) {
    boleh.add('histogram');
    boleh.add('boxplot');
  }
  if (widget.treemap?.children?.length) {
    boleh.add('treemap');
  }
  if (widget.geo?.regions?.length) {
    boleh.add('map');
  }
  if (widget.gantt?.tasks?.length) {
    boleh.add('gantt');
  }

  // Kartu & teks.
  if (widget.kpi && widget.kpi.value !== undefined && widget.kpi.value !== null) {
    boleh.add('kpi');
    boleh.add('bullet-target');
  }
  if (widget.kpi?.target !== undefined) {
    boleh.add('gauge');
  }
  if (widget.table?.columns?.length) {
    boleh.add('table');
  }
  if (widget.narasi?.text) {
    boleh.add('narasi');
  }

  // Jangan sembunyikan tipe yang sedang dipakai.
  boleh.add(widget.type);

  return TIPE_VISUALISASI.filter((t) => boleh.has(t.type));
}
