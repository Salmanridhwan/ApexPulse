/**
 * KATALOG CHART DEFAULT.
 *
 * Berisi identitas chart yang boleh dipakai dashboard, beserta bentuk data yang
 * diterima. Bentuk gambarnya TIDAK di sini, melainkan di `chartTemplate.ts`
 * (matriks chart x varian). File ini yang dipanggil renderer:
 *
 *   const { opsi, varian, cadangan } = buildOpsi('bar-tegak-sorot', data, 'ringkasan', skala);
 *
 * Aturan yang dijaga:
 * - Chart yang sama wajib bisa tampil di semua varian yang terdaftar.
 * - Varian yang belum ada tidak boleh membuat layar kosong. Renderer memakai
 *   varian default dan mengembalikan `cadangan: true` supaya UI bisa menandai.
 */

import type { WidgetType } from '../../types';
import type { DataChart, Pembangun, SpesifikasiHtml } from './pembangunOpsi';
import { MATRIKS } from './chartTemplate';
import { GAYA, VARIAN, type GayaVarian, type Varian } from './gayaVarian';

export type ChartId =
  | 'kpi-kartu'
  | 'kpi-strip'
  | 'progres-target'
  | 'tabel-ringkas'
  | 'narasi-insight'
  | 'peringkat'
  | 'bar-tegak'
  | 'bar-tegak-sorot'
  | 'bar-tegak-target'
  | 'bar-mendatar-peringkat'
  | 'bar-mendatar-target'
  | 'bar-tumpuk'
  | 'area-gradasi'
  | 'garis-tren'
  | 'combo-batang-garis'
  | 'scatter-gelembung'
  | 'titik-bersumbu'
  | 'donat-tebal'
  | 'donat-tipis'
  | 'gauge-target'
  | 'strip-os';

export interface EntriChart {
  id: ChartId;
  /** Nama yang dibaca pengguna di katalog. */
  nama: string;
  /** Tipe widget di model data, dipakai saat widget dibuat. */
  tipe: WidgetType;
  /** `echarts` = kanvas grafik, `html` = kartu/tabel/teks. */
  mesin: 'echarts' | 'html';
  /** Bentuk data yang wajib tersedia supaya chart ini bisa digambar. */
  butuh: string;
}

export const CHART_DEFAULT: Record<ChartId, EntriChart> = {
  'kpi-kartu': { id: 'kpi-kartu', nama: 'Kartu KPI berikon', tipe: 'kpi', mesin: 'html', butuh: 'satu angka, delta, satuan' },
  'kpi-strip': { id: 'kpi-strip', nama: 'Strip KPI ringkas', tipe: 'kpi', mesin: 'html', butuh: 'satu angka dan satuan' },
  'progres-target': { id: 'progres-target', nama: 'Progres target', tipe: 'bullet-target', mesin: 'html', butuh: 'label, capaian, target' },
  'tabel-ringkas': { id: 'tabel-ringkas', nama: 'Tabel ringkas', tipe: 'table', mesin: 'html', butuh: 'kolom dan baris angka' },
  'narasi-insight': { id: 'narasi-insight', nama: 'Strip narasi', tipe: 'narasi', mesin: 'html', butuh: 'satu paragraf' },
  peringkat: { id: 'peringkat', nama: 'Daftar peringkat', tipe: 'hbar', mesin: 'html', butuh: 'label dan nilai' },
  'bar-tegak': { id: 'bar-tegak', nama: 'Batang tegak polos', tipe: 'bar', mesin: 'echarts', butuh: 'kategori dan satu seri' },
  'bar-tegak-sorot': { id: 'bar-tegak-sorot', nama: 'Batang tegak bersorot', tipe: 'bar', mesin: 'echarts', butuh: 'kategori dan satu seri' },
  'bar-tegak-target': { id: 'bar-tegak-target', nama: 'Batang tegak dengan target', tipe: 'bar', mesin: 'echarts', butuh: 'kategori, satu seri, target' },
  'bar-mendatar-peringkat': { id: 'bar-mendatar-peringkat', nama: 'Batang mendatar peringkat', tipe: 'hbar', mesin: 'echarts', butuh: 'label dan nilai' },
  'bar-mendatar-target': { id: 'bar-mendatar-target', nama: 'Batang mendatar target', tipe: 'hbar', mesin: 'echarts', butuh: 'label, capaian, target' },
  'bar-tumpuk': { id: 'bar-tumpuk', nama: 'Batang bertumpuk', tipe: 'combo', mesin: 'echarts', butuh: 'kategori dan dua seri' },
  'area-gradasi': { id: 'area-gradasi', nama: 'Area bergradasi', tipe: 'area', mesin: 'echarts', butuh: 'kategori dan satu seri' },
  'garis-tren': { id: 'garis-tren', nama: 'Garis tren', tipe: 'line', mesin: 'echarts', butuh: 'kategori dan satu seri' },
  'combo-batang-garis': { id: 'combo-batang-garis', nama: 'Batang dan garis dua sumbu', tipe: 'combo', mesin: 'echarts', butuh: 'kategori, seri batang, seri garis' },
  'scatter-gelembung': { id: 'scatter-gelembung', nama: 'Gelembung sebaran', tipe: 'bubble', mesin: 'echarts', butuh: 'label, dua angka, ukuran' },
  'titik-bersumbu': { id: 'titik-bersumbu', nama: 'Titik bersumbu', tipe: 'scatter', mesin: 'echarts', butuh: 'label dan nilai' },
  'donat-tebal': { id: 'donat-tebal', nama: 'Cincin tebal', tipe: 'donut', mesin: 'echarts', butuh: 'kategori dan nilai' },
  'donat-tipis': { id: 'donat-tipis', nama: 'Cincin tipis', tipe: 'donut', mesin: 'echarts', butuh: 'kategori dan nilai' },
  'gauge-target': { id: 'gauge-target', nama: 'Gauge target', tipe: 'gauge', mesin: 'echarts', butuh: 'satu angka, target, batas' },
  'strip-os': { id: 'strip-os', nama: 'Strip sistem operasi', tipe: 'kpi', mesin: 'html', butuh: 'label, persen, delta, deret kecil' },
};

export const DAFTAR_CHART: ChartId[] = Object.keys(CHART_DEFAULT) as ChartId[];

export const entriChart = (id: ChartId): EntriChart => CHART_DEFAULT[id];

/** Varian yang sudah punya desain untuk chart ini. */
export const varianTersedia = (id: ChartId): Varian[] =>
  VARIAN.filter((v) => Boolean(MATRIKS[id]?.[v]));

export interface HasilOpsi {
  /** Opsi ECharts, atau spesifikasi HTML untuk chart non-kanvas. */
  opsi: Record<string, unknown> | SpesifikasiHtml | null;
  /** Varian yang benar-benar dipakai. */
  varian: Varian;
  /** true bila varian yang diminta belum ada dan dipakai varian lain. */
  cadangan: boolean;
  /** Gaya yang dipakai, supaya renderer bisa mewarnai bingkai kartu. */
  gaya: GayaVarian;
}

/**
 * Susun opsi grafik untuk satu chart.
 *
 * @param id      identitas chart
 * @param data    data dengan bentuk yang sama untuk semua varian
 * @param varian  wajah yang diminta
 * @param skala   skala huruf (1 = ukuran dasar)
 * @param gantiGaya gaya pengganti (mis. tema terang kanvas dashboard). Bila
 *                  kosong, dipakai gaya bawaan varian. Bentuk grafiknya tetap
 *                  milik wajah katalog; hanya warnanya yang mengikuti tema.
 */
export function buildOpsi(
  id: ChartId,
  data: DataChart,
  varian: Varian,
  skala = 1,
  gantiGaya?: typeof GAYA[Varian],
): HasilOpsi {
  const sel = MATRIKS[id];
  if (!sel) {
    return { opsi: null, varian, cadangan: true, gaya: GAYA[varian] ?? GAYA.default };
  }

  const urutan: Varian[] = [varian, 'default', ...VARIAN];
  const dipakai = urutan.find((v) => sel[v]);
  if (!dipakai) {
    return { opsi: null, varian, cadangan: true, gaya: GAYA[varian] ?? GAYA.default };
  }

  const pembangun: Pembangun = sel[dipakai] as Pembangun;
  const gaya = gantiGaya ?? GAYA[dipakai];
  return {
    opsi: pembangun(data, gaya, skala),
    varian: dipakai,
    cadangan: dipakai !== varian,
    gaya,
  };
}
