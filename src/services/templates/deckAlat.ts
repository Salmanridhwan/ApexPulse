import type { WidgetSpec, WidgetType } from '../../types';
import { pembuat } from './templateBagian';

/**
 * ALAT PENYUSUN TEMPLATE DECK (satu halaman = satu slide).
 *
 * Semua kartu memakai chart dari menu Template Chart (`chartId`), jadi pratinjau
 * galeri, dashboard tersimpan, dan menu Template Chart tampil sama. Angka di
 * template adalah ANGKA CONTOH; dashboard nyata diisi dari dokumen instansi.
 *
 * Dipakai `templateOutsourcing.ts`. Batas satu halaman: 7 baris grid (434 px)
 * supaya semua slide sama tinggi. Halaman yang lebih tinggi dirapikan otomatis
 * oleh `pasHalaman` saat template didaftarkan.
 */
export function alatDeck(kode: string, kategori: string) {
  const k = pembuat(kode, kategori);

  /** Ubah lebar kartu (grid 12 kolom). */
  const lebar = (w: WidgetSpec, kolom: number): WidgetSpec => ({ ...w, grid: { ...w.grid, w: kolom } });

  /** Kartu KPI berikon selebar `kolom`. */
  const kpi = (
    kolom: number,
    title: string,
    sub: string,
    value: string | number,
    unit: string,
    ikon: string,
    delta?: number,
    deltaLabel?: string
  ): WidgetSpec => lebar(k.kpi(title, sub, value, unit, ikon, delta, deltaLabel), kolom);

  /** Kartu sasaran KPI tahun depan selebar `kolom`. */
  const sasaran = (
    kolom: number,
    title: string,
    value: number,
    target: number,
    unit: string,
    arah: '≥' | '≤',
    ikon: string
  ): WidgetSpec => lebar(k.sasaran(title, value, target, unit, arah, ikon), kolom);

  /** Narasi berbutir bernomor (kolom program, tata kelola, agenda). */
  const poin = (
    title: string,
    sub: string,
    kolom: number,
    tinggi: number,
    text: string,
    bulletPoints: string[]
  ): WidgetSpec => k.kartu('narasi', 'narasi-insight', title, sub, kolom, tinggi, { narasi: { text, bulletPoints } });

  /** Narasi satu paragraf tanpa butir. */
  const teks = (title: string, sub: string, kolom: number, tinggi: number, isi: string): WidgetSpec =>
    k.kartu('narasi', 'narasi-insight', title, sub, kolom, tinggi, { narasi: { text: isi } });

  /** Grafik (bar/line/area/combo/funnel/donut/gauge) dengan chart katalog. */
  const grafik = (
    type: WidgetType,
    chartId: string,
    title: string,
    sub: string,
    w: number,
    h: number,
    xAxis: string[],
    series: Array<{ name: string; data: number[]; kind?: 'bar' | 'line' }>,
    unit: string
  ): WidgetSpec => k.grafik(type, chartId, title, sub, w, h, xAxis, series, unit);

  /** Tabel teks; kolom terakhir dibaca sebagai status oleh papan isu. */
  const tabel = (
    chartId: string,
    title: string,
    sub: string,
    w: number,
    h: number,
    kolom: string[],
    baris: Array<Array<string | number>>
  ): WidgetSpec => k.tabel(chartId, title, sub, w, h, kolom, baris);

  return { k, kpi, sasaran, poin, teks, grafik, tabel };
}
