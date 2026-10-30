/**
 * TEMA PRATINJAU TAB DEFAULT CHART.
 *
 * Pratinjau harus ikut mode terang dan gelap. ECharts tidak bisa membaca CSS
 * variable, jadi warna kanvas ditentukan di sini, bukan di kelas Tailwind.
 * Bentuk grafiknya tetap satu, hanya warnanya yang berpindah.
 */
import { GAYA, type GayaVarian } from './gayaVarian';

export type Mode = 'light' | 'dark';

/** Wajah nilai untuk kanvas pratinjau: terang = netral, gelap = biru malam. */
export const temaPratinjau = (mode: Mode): GayaVarian => (mode === 'dark' ? GAYA.analitik : GAYA.default);

/** Warna kotak wadah pratinjau (dipakai juga oleh galeri). */
export const kontainerPratinjau = (mode: Mode): { bg: string; garis: string } =>
  mode === 'dark' ? { bg: '#0f141d', garis: '#1e2633' } : { bg: '#eef4ff', garis: '#dbe7ff' };

/** Warna latar tooltip: gelap di mode terang, lebih terang dari latar di mode gelap. */
export const latarTooltip = (mode: Mode): string => (mode === 'dark' ? '#243449' : '#1a1d1f');
