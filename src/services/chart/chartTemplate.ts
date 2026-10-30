/**
 * MATRIKS CHART TEMPLATE: chart x varian.
 *
 * Isi file ini adalah DAFTAR SEL yang sudah punya desain. Sel kosong berarti
 * wajah itu belum dibuat, dan sengaja dibiarkan terbuka supaya kelihatan, bukan
 * disembunyikan. `scripts/cek-matriks-chart.ts` mencetak sel yang masih bolong.
 *
 * Menambah wajah baru = menambah satu baris di sini. Tidak boleh ada komponen
 * halaman yang menulis opsi ECharts sendiri di luar matriks ini.
 */

import type { ChartId } from './chartDefault';
import type { Pembangun } from './pembangunOpsi';
import {
  areaGradasi,
  barPeringkat,
  barSorot,
  barTarget,
  barTargetMendatar,
  barTegak,
  barTumpuk,
  comboBatangGaris,
  donat,
  garisTren,
  gaugeTarget,
  kpiKartu,
  kpiStrip,
  narasiInsight,
  peringkat,
  progresTarget,
  scatterGelembung,
  tabelRingkas,
  titikBersumbu,
} from './pembangunOpsi';
import type { Varian } from './gayaVarian';
import { kpiLensa, wajahLensa } from './varianLensa';
import { areaRingkas } from './varianPijar';
import { kpiNadi, stripOs, wajahNadi } from './varianNadi';

export const MATRIKS: Record<ChartId, Partial<Record<Varian, Pembangun>>> = {
  // Kartu, tabel, dan teks
  'kpi-kartu': { default: kpiKartu, ringkasan: kpiKartu, analitik: kpiLensa, trafik: kpiNadi },
  'kpi-strip': { ringkasan: kpiStrip, analitik: kpiStrip, trafik: kpiStrip },
  'progres-target': { ringkasan: progresTarget, analitik: progresTarget },
  'strip-os': { trafik: stripOs },
  'tabel-ringkas': { default: tabelRingkas, ringkasan: tabelRingkas, analitik: tabelRingkas, trafik: tabelRingkas },
  'narasi-insight': { default: narasiInsight, ringkasan: narasiInsight, analitik: narasiInsight, trafik: narasiInsight },
  // `peringkat` dan `bar-tegak-target` TIDAK dipakai template Pijar (template 1).
  // Wajah Pijarnya dilepas supaya katalog sama persis dengan chart di template.
  // Pembangunnya tetap ada di pembangunOpsi.ts dan tetap dipakai Trafik.
  peringkat: { trafik: peringkat },

  // Batang
  'bar-tegak': { default: barTegak, ringkasan: barTegak },
  'bar-tegak-sorot': { ringkasan: barSorot, analitik: wajahLensa['bar-tegak-sorot'], trafik: barSorot },
  // Garis rata-rata di chart NRW per wilayah (halaman 3) memakai wajah ini.
  'bar-tegak-target': { ringkasan: barTarget, trafik: barTarget },
  'bar-mendatar-peringkat': { ringkasan: barPeringkat, analitik: wajahLensa['bar-mendatar-peringkat'], trafik: wajahNadi['bar-mendatar-peringkat'] },
  'bar-mendatar-target': { default: barTargetMendatar, ringkasan: barTargetMendatar },
  'bar-tumpuk': { trafik: wajahNadi['bar-tumpuk'] },

  // Garis dan area
  'area-gradasi': { ringkasan: areaRingkas, analitik: wajahLensa['area-gradasi'], trafik: areaGradasi },
  'garis-tren': { default: garisTren, analitik: wajahLensa['garis-tren'], trafik: wajahNadi['garis-tren'] },
  'combo-batang-garis': { trafik: wajahNadi['combo-batang-garis'] },

  // Sebaran
  'scatter-gelembung': { analitik: wajahLensa['scatter-gelembung'] },
  'titik-bersumbu': { trafik: titikBersumbu },

  // Komposisi dan skala
  'donat-tebal': { ringkasan: donat, analitik: wajahLensa['donat-tebal'], trafik: wajahNadi['donat-tebal'] },
  'donat-tipis': { default: donat },
  'gauge-target': { ringkasan: gaugeTarget },
};

/** Semua sel yang sudah terisi, dipakai tes kelengkapan dan berkas status. */
export const SEL_TERISI: Array<{ chartId: ChartId; varian: Varian }> = Object.entries(MATRIKS).flatMap(
  ([chartId, varian]) =>
    Object.entries(varian)
      .filter(([, pembangun]) => Boolean(pembangun))
      .map(([v]) => ({ chartId: chartId as ChartId, varian: v as Varian }))
);
