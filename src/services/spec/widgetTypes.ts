import type { WidgetSpec, WidgetType } from '../../types';
import { selaraskanTipe } from './tipeSelaras';

export interface TipeVisualisasi {
  type: WidgetType;
  label: string;
  desc: string;
  /** Kelompok untuk pengelompokan di editor. */
  grup: 'Kartu' | 'Kartesius' | 'Komposisi' | 'Sebaran' | 'Matriks' | 'Prediktif' | 'Preskriptif' | 'Lainnya';
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
  // Analitik prediktif — "apa yang mungkin terjadi?" (hasil hitungan dari angka dokumen)
  { type: 'trend-line', label: 'Garis Tren + Regresi', desc: 'Kecenderungan data dengan R² dan persamaan garis', grup: 'Prediktif' },
  { type: 'forecast', label: 'Forecast + Pita Prediksi', desc: 'Proyeksi periode berikutnya beserta rentang kemungkinannya', grup: 'Prediktif' },
  { type: 'anomaly', label: 'Deteksi Anomali', desc: 'Menandai nilai yang menyimpang (z-score)', grup: 'Prediktif' },
  { type: 'cluster', label: 'Clustering (k-means)', desc: 'Mengelompokkan nilai yang serupa', grup: 'Prediktif' },

  // Analitik preskriptif — "apa yang sebaiknya dilakukan?"
  { type: 'dekomposisi', label: 'Dekomposisi Kontribusi', desc: 'Porsi tiap kategori & andilnya pada perubahan', grup: 'Preskriptif' },
  { type: 'skenario', label: 'Analisis Skenario', desc: 'Pesimis / dasar / optimis — simulasi dari laju dokumen', grup: 'Preskriptif' },
  { type: 'sensitivitas', label: 'Sensitivitas (What-if)', desc: 'Dampak perubahan nilai terhadap hasil', grup: 'Preskriptif' },
];

/** Kelompok tipe visualisasi dalam urutan tampil. */
export const GRUP_VISUALISASI: Array<TipeVisualisasi['grup']> = [
  'Kartu', 'Kartesius', 'Komposisi', 'Sebaran', 'Matriks', 'Prediktif', 'Preskriptif', 'Lainnya',
];

/** Widget punya data seri grafik (xAxis + minimal satu seri). */
export function punyaDataChart(widget?: WidgetSpec | null): boolean {
  return (
    !!widget?.chart &&
    (widget.chart.series?.length || 0) > 0 &&
    (widget.chart.xAxis?.length || 0) > 0
  );
}

/**
 * Tipe visualisasi yang datanya BENAR-BENAR tersedia di widget ini.
 * Tujuannya: pengguna hanya melihat pilihan yang bisa dipakai — beralih ke tipe
 * yang datanya tak ada (mis. peta tanpa geo) menghasilkan kartu kosong.
 *
 * SATU SUMBER KEBENARAN: daftar ini disaring oleh gerbang yang sama dengan katalog
 * "Tambah Widget" dan jalur copilot (`selaraskanTipe`). Sebelumnya fungsi ini punya
 * aturan sendiri, dan aturan itu menyimpang: editor menawarkan `combo` pada data satu
 * seri, padahal combo butuh dua seri sehingga bentuknya di kanvas berbeda dari
 * pratinjau combo di Template Chart.
 */
export function tipeKompatibel(widget?: WidgetSpec | null): TipeVisualisasi[] {
  if (!widget) return TIPE_VISUALISASI;
  return TIPE_VISUALISASI.filter((t) => {
    // Tipe yang sedang dipakai selalu terlihat supaya tetap tampak terpilih.
    if (t.type === widget.type) return true;
    return selaraskanTipe(widget, t.type).ok;
  });
}
