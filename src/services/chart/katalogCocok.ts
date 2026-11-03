/**
 * CHART KATALOG YANG COCOK UNTUK SATU WIDGET.
 *
 * Dipakai pemilih "Template Chart" di editor widget: pengguna mengganti chart
 * sebuah kartu dengan chart dari menu Template Chart. Hanya chart yang datanya
 * tersedia di widget itu yang ditawarkan, supaya tidak ada pilihan yang
 * berujung kartu kosong. Gerbangnya sama dengan katalog (`selaraskanTipe`).
 * MURNI supaya bisa diuji.
 */

import type { WidgetSpec } from '../../types';
import { selaraskanTipe } from '../spec/tipeSelaras';
import { CHART_DEFAULT, DAFTAR_CHART, type ChartId, type EntriChart } from './chartDefault';

const TIPE_ANGKA = ['kpi', 'bullet-target', 'gauge'];

/** Syarat tambahan yang tidak dicek gerbang tipe: jumlah seri dan target. */
function syaratData(e: EntriChart, w: WidgetSpec): boolean {
  const seri = w.chart?.series ?? [];
  const adaTarget = seri.some((s) => /target|rencana|rkap|anggaran/i.test(s.name || ''));
  if (e.id === 'kpi-target') return w.kpi?.target !== undefined && w.kpi?.target !== null;
  if (e.id === 'papan-isu' || e.id === 'tabel-status') return (w.table?.columns?.length ?? 0) >= 2;
  if (/(?<!atau )dua seri|seri batang, seri garis/.test(e.butuh)) return seri.length >= 2;
  if (/target/.test(e.butuh) && e.tipe !== 'gauge') return adaTarget || Boolean(w.kpi?.targets?.length);
  if (e.id === 'cincin-progres' || e.id === 'gauge-target') return TIPE_ANGKA.includes(w.type);
  // Skor kesehatan BUMD berskala 0-5; deret kecil butuh sparkline dari dokumen.
  if (e.id === 'gauge-kesehatan') return TIPE_ANGKA.includes(w.type) && Number(w.kpi?.value) >= 0 && Number(w.kpi?.value) <= 5;
  if (e.id === 'strip-os') return (w.kpi?.sparkline?.length ?? 0) > 1;
  return true;
}

export function chartKatalogCocok(w: WidgetSpec): ChartId[] {
  const angka = TIPE_ANGKA.includes(w.type);
  return DAFTAR_CHART.filter((id) => {
    const e = CHART_DEFAULT[id];
    // Kartu angka hanya berganti antar-kartu angka; grafik hanya antar-grafik.
    if (angka !== TIPE_ANGKA.includes(e.tipe) && !(angka && e.id === 'cincin-progres')) return false;
    if (e.mesin === 'html' && !angka) {
      // Tabel/narasi/peringkat: hanya untuk widget bertipe sama.
      if (e.tipe !== w.type && !(e.id === 'peringkat' && ['bar', 'hbar'].includes(w.type))) return false;
    }
    if (!syaratData(e, w)) return false;
    if (angka) return true;
    const g = selaraskanTipe({ ...w, type: e.tipe }, e.tipe);
    return g.ok && Boolean(g.widget);
  });
}

/** Widget setelah memakai chart katalog `id`: tipe ikut chart, rancangan asisten tidak lagi dipakai. */
export function pakaiChartKatalog(w: WidgetSpec, id: ChartId): WidgetSpec {
  const e = CHART_DEFAULT[id];
  const g = TIPE_ANGKA.includes(e.tipe) ? null : selaraskanTipe({ ...w, type: e.tipe }, e.tipe);
  const dasar = g?.ok && g.widget ? g.widget : w;
  return { ...dasar, type: TIPE_ANGKA.includes(w.type) && TIPE_ANGKA.includes(e.tipe) ? w.type : e.tipe, chartId: id };
}
