import { WidgetSpec, WidgetType } from '../../types';

export interface TipeVisualisasi {
  type: WidgetType;
  label: string;
  desc: string;
}

/** Tipe visualisasi yang bisa dipilih pengguna, beserta label & deskripsinya. */
export const TIPE_VISUALISASI: TipeVisualisasi[] = [
  { type: 'kpi', label: 'KPI Card', desc: 'Angka ringkas dengan delta & target' },
  { type: 'line', label: 'Diagram Garis', desc: 'Visualisasi tren waktu berkala' },
  { type: 'area', label: 'Area Chart', desc: 'Akumulasi volume dan distribusi' },
  { type: 'bar', label: 'Diagram Batang', desc: 'Komparasi kategori atau bulanan' },
  { type: 'donut', label: 'Diagram Donat', desc: 'Struktur proporsi persentase' },
  { type: 'table', label: 'Tabel Rekap', desc: 'Matriks tabular sortable' },
  { type: 'narasi', label: 'Narasi Eksekutif', desc: 'Teks sintesis temuan penting' },
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
 * yang datanya tak ada (mis. tabel pada widget garis) menghasilkan kartu kosong.
 * Tipe yang sedang aktif selalu disertakan agar tetap terlihat terpilih.
 */
export function tipeKompatibel(widget?: WidgetSpec | null): TipeVisualisasi[] {
  if (!widget) return TIPE_VISUALISASI;

  const boleh = new Set<WidgetType>();

  if (punyaDataChart(widget)) {
    boleh.add('line');
    boleh.add('area');
    boleh.add('bar');
    boleh.add('donut');
  }
  if (widget.kpi && widget.kpi.value !== undefined && widget.kpi.value !== null) {
    boleh.add('kpi');
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
