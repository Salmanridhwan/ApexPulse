/**
 * MATRIKS CHART TEMPLATE: chart x varian.
 *
 * Aturan utama: SATU chart = SEMUA gaya. Setiap chart di katalog wajib punya
 * pembangun untuk default, Pijar (ringkasan), Lensa (analitik), Nadi
 * (trafik), dan Kaca. Pembangun di sini generik: bentuknya sama, warnanya, gradasinya,
 * sudutnya, dan labelnya diatur `GayaVarian`. Karena itu chart yang sama bisa
 * berpindah gaya tanpa mengambil data ulang, dan angka dokumen (satuan apa pun)
 * selalu tampil benar.
 *
 * `MATRIKS_KHAS` berisi wajah khas yang ditulis khusus untuk replika halaman 1
 * template Lensa dan Nadi. Wajah itu mengandaikan bentuk data tertentu (mis.
 * persen trafik), jadi HANYA dipakai bila pemanggil meminta `khas`. Dashboard
 * biasa, halaman 2-3 template, dan hasil asisten selalu memakai `MATRIKS`.
 *
 * Tidak boleh ada komponen halaman yang menulis opsi ECharts sendiri di luar
 * file ini.
 */

import type { ChartId } from './chartDefault';
import type { Pembangun } from './pembangunOpsi';
import {
  airTerjun,
  gaugeKesehatan,
  petaPanas,
  radarAspek,
  sankeyAlur,
  treemapPorsi,
  areaBanding,
  areaGradasi,
  barKapsul,
  barPeringkat,
  barSorot,
  barTarget,
  barTargetMendatar,
  barTegak,
  barTumpuk,
  cincinProgres,
  comboBatangGaris,
  donatTebal,
  donatTipis,
  garisTren,
  gaugeTarget,
  kpiKartu,
  kpiKorporat,
  kpiTarget,
  papanIsu,
  tabelStatus,
  alurTahap,
  corongPipeline,
  daftarProgres,
  kpiKaca,
  kpiNetral,
  kpiPijar,
  kpiTirta,
  kpiStrip,
  narasiInsight,
  peringkat,
  progresTarget,
  scatterGelembung,
  tabelRingkas,
  titikBersumbu,
} from './pembangunOpsi';
import type { Varian } from './gayaVarian';
import { jadwalGantt, kotakSebaran, petaWilayah } from './pembangunTambahan';
import { kpiLensa, wajahLensa } from './varianLensa';
import { areaRingkas } from './varianPijar';
import { kpiNadi, stripOs, wajahNadi } from './varianNadi';

/** Pembangun yang sama untuk semua gaya; gaya membedakan tampilannya. */
const semua = (p: Pembangun, ganti: Partial<Record<Varian, Pembangun>> = {}): Record<Varian, Pembangun> => ({
  default: p,
  ringkasan: p,
  analitik: p,
  trafik: p,
  kaca: p,
  tirta: p,
  aurora: p,
  neon: p,
  blok: p,
  bento: p,
  koran: p,
  korporat: p,
  ...ganti,
});

export const MATRIKS: Record<ChartId, Record<Varian, Pembangun>> = {
  // Kartu, tabel, dan teks
  'kpi-kartu': semua(kpiNetral, { ringkasan: kpiPijar, analitik: kpiLensa, trafik: kpiNadi, kaca: kpiKaca, tirta: kpiTirta, aurora: kpiPijar, neon: kpiPijar, korporat: kpiKorporat }),
  'kpi-strip': semua(kpiStrip),
  'progres-target': semua(progresTarget),
  'strip-os': semua(stripOs),
  'tabel-ringkas': semua(tabelRingkas),
  'narasi-insight': semua(narasiInsight),
  peringkat: semua(peringkat),

  // Batang
  'bar-tegak': semua(barTegak),
  'bar-tegak-sorot': semua(barSorot),
  'bar-tegak-target': semua(barTarget),
  'bar-mendatar-peringkat': semua(barPeringkat),
  'bar-mendatar-target': semua(barTargetMendatar),
  'bar-tumpuk': semua(barTumpuk),
  'bar-kapsul': semua(barKapsul),

  // Garis dan area
  'area-gradasi': semua(areaGradasi, { ringkasan: areaRingkas }),
  'garis-tren': semua(garisTren),
  'combo-batang-garis': semua(comboBatangGaris),
  'area-banding': semua(areaBanding),

  // Sebaran
  'scatter-gelembung': semua(scatterGelembung),
  'titik-bersumbu': semua(titikBersumbu),

  // Komposisi dan skala
  'donat-tebal': semua(donatTebal),
  'donat-tipis': semua(donatTipis),
  'gauge-target': semua(gaugeTarget),
  'cincin-progres': semua(cincinProgres),

  // Khas BUMD
  'air-terjun': semua(airTerjun),
  'sankey-alur': semua(sankeyAlur),
  'radar-aspek': semua(radarAspek),
  'gauge-kesehatan': semua(gaugeKesehatan),
  'peta-panas': semua(petaPanas),
  'treemap-porsi': semua(treemapPorsi),
  // Wajah baru: peta geografis, jadwal (gantt), dan kotak sebaran (boxplot).
  'peta-wilayah': semua(petaWilayah),
  'jadwal-gantt': semua(jadwalGantt),
  'kotak-sebaran': semua(kotakSebaran),

  // Rapat manajemen bagian
  'kpi-target': semua(kpiTarget),
  'papan-isu': semua(papanIsu),
  'tabel-status': semua(tabelStatus),
  'alur-tahap': semua(alurTahap),
  'corong-pipeline': semua(corongPipeline),
  'daftar-progres': semua(daftarProgres),
};

/**
 * Wajah khas replika halaman 1 Lensa dan Nadi. Dipakai hanya bila `khas`
 * diminta; bila tidak ada entri, `MATRIKS` yang dipakai.
 */
export const MATRIKS_KHAS: Partial<Record<ChartId, Partial<Record<Varian, Pembangun>>>> = {
  // Replika halaman 1 Pijar tetap memakai kartu KPI acuannya.
  'kpi-kartu': { ringkasan: kpiKartu },
  'area-gradasi': { analitik: wajahLensa['area-gradasi'] },
  'bar-tegak-sorot': { analitik: wajahLensa['bar-tegak-sorot'] },
  'donat-tebal': { analitik: wajahLensa['donat-tebal'], trafik: wajahNadi['donat-tebal'] },
  'bar-mendatar-peringkat': { analitik: wajahLensa['bar-mendatar-peringkat'], trafik: wajahNadi['bar-mendatar-peringkat'] },
  'garis-tren': { analitik: wajahLensa['garis-tren'], trafik: wajahNadi['garis-tren'] },
  'scatter-gelembung': { analitik: wajahLensa['scatter-gelembung'] },
  'combo-batang-garis': { trafik: wajahNadi['combo-batang-garis'] },
  'bar-tumpuk': { trafik: wajahNadi['bar-tumpuk'] },
};

/** Semua sel yang sudah terisi, dipakai tes kelengkapan dan berkas status. */
export const SEL_TERISI: Array<{ chartId: ChartId; varian: Varian }> = Object.entries(MATRIKS).flatMap(
  ([chartId, varian]) =>
    Object.entries(varian)
      .filter(([, pembangun]) => Boolean(pembangun))
      .map(([v]) => ({ chartId: chartId as ChartId, varian: v as Varian }))
);
