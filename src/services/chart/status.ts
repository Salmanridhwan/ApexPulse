import berkas from '../../../data/status-desain.json';
import type { ChartId } from './chartDefault';
import type { Varian } from './gayaVarian';

/**
 * STATUS DESAIN TIAP SEL MATRIKS.
 *
 * Sumber tunggalnya `data/status-desain.json`, ditulis oleh
 * `scripts/cek-matriks-chart.ts`. Agent tidak boleh menyebut sebuah varian final
 * sebelum user bilang oke, dan skrip itu tidak pernah menurunkan status.
 */

export type StatusSel = 'draf' | 'menunggu oke' | 'final';

type Isi = { chartId: string; varian: string; status: StatusSel; catatan?: string; diperbaruiPada?: string };

const peta = berkas as unknown as Record<string, Isi>;

export const statusSel = (chartId: ChartId, varian: Varian): StatusSel | null =>
  peta[`${chartId}/${varian}`]?.status ?? null;

export const catatanSel = (chartId: ChartId, varian: Varian): string =>
  peta[`${chartId}/${varian}`]?.catatan ?? '';

/**
 * Status katalog chart default (31 tipe di tab Default Chart). Dinyatakan final
 * oleh pemilik proyek 2026-10-29.
 */
export const statusDefaultChart = (): StatusSel | null =>
  (peta as unknown as Record<string, { status?: StatusSel }>).defaultChart?.status ?? null;

export const LABEL_STATUS: Record<StatusSel, string> = {
  draf: 'Draf',
  'menunggu oke': 'Menunggu oke',
  final: 'Final',
};
