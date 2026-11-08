/**
 * KATALOG CHART BUATAN SENDIRI — supaya chart SELALU dari Template Chart.
 *
 * Aturannya: kartu di kanvas tidak boleh menggambar chart yang tidak ada di
 * Template Chart. Chart bawaan (`CHART_DEFAULT`) sudah mencakup hampir semua
 * bentuk data, tetapi tidak semuanya: widget bertipe `heatmap`, `radar`,
 * `funnel`, `map`, dan sejenisnya tidak punya padanan bawaan, dan bentuk data
 * yang tidak lengkap (tanpa kategori, tanpa seri) tidak bisa dicocokkan ke
 * chart mana pun.
 *
 * Dulu kasus itu dibiarkan: `chartId` kosong, lalu renderer memakai chart
 * internalnya sendiri — chart yang tidak terdaftar di Template Chart. Sekarang
 * kasus itu membuat **entri baru di Template Chart** (`kustom-…`) yang menunjuk
 * chart bawaan yang sanggup menggambar datanya, dan widget memakai entri itu.
 *
 * Semua fungsi di sini MURNI (tanpa db, tanpa React) supaya bisa diuji.
 */

import type { WidgetSpec, WidgetType } from '../../types';
import { CHART_DEFAULT, DAFTAR_CHART, type ChartId, type EntriChart, type KelompokChart } from './chartDefault';
import { pilihChart } from '../builder/susunHalaman';
import { chartIdDariTipe } from './petaTipe';

/** Satu entri Template Chart yang dibuat otomatis dari bentuk data. */
export interface ChartKustom {
  /** `kustom-<sidik>` — stabil untuk bentuk data yang sama. */
  id: string;
  nama: string;
  /** Tipe widget yang dipakai kartu ini (mengikuti chart dasarnya). */
  tipe: WidgetType;
  /** Chart bawaan yang benar-benar menggambar. */
  dasar: ChartId;
  butuh: string;
  guna: string;
  kelompok: KelompokChart;
  /** Sidik bentuk data pemicu — mencegah entri kembar. */
  sidik: string;
  dibuatPada: string;
}

export const AWALAN_KUSTOM = 'kustom-';

/** Apakah `id` menunjuk chart bawaan Template Chart. */
export const chartBawaan = (id?: string): boolean => Boolean(id && (CHART_DEFAULT as any)[id]);

/** Entri katalog untuk sebuah id: bawaan, atau `undefined` kalau bukan keduanya. */
export const entriKatalog = (id?: string): EntriChart | undefined =>
  id ? (CHART_DEFAULT as any)[id] : undefined;

/**
 * Sidik BENTUK data sebuah widget — bukan isinya.
 *
 * Dua kartu dengan angka berbeda tetapi bentuk sama (mis. "radar, satu seri,
 * tanpa kategori") cukup memakai satu entri katalog. Yang membedakan bentuk:
 * tipe widget, jumlah seri, jumlah kategori, ada tidaknya target, dan bentuk
 * tabel/angka.
 */
export function sidikBentuk(w: WidgetSpec): string {
  const kategori = w.chart?.xAxis?.length ?? 0;
  const seri = w.chart?.series?.length ?? 0;
  const adaTarget =
    (w.kpi?.target !== undefined && w.kpi?.target !== null) ||
    (w.kpi?.targets?.length ?? 0) > 0 ||
    (w.chart?.series ?? []).some((s) => /target|rencana|rkap|anggaran/i.test(s.name || ''));
  const kolom = w.table?.columns?.length ?? 0;
  const baris = w.table?.rows?.length ?? 0;
  const punyaAngka = w.kpi?.value !== undefined && w.kpi?.value !== null;
  const punyaSpark = (w.kpi?.sparkline?.length ?? 0) > 1;
  return [
    `t=${w.type}`,
    `seri=${seri}`,
    `kat=${kategori}`,
    `target=${adaTarget ? 1 : 0}`,
    `tabel=${kolom}x${baris}`,
    `angka=${punyaAngka ? 1 : 0}`,
    `spark=${punyaSpark ? 1 : 0}`,
  ].join('|');
}

/**
 * Chart bawaan yang SANGATUP menggambar bentuk data ini, urut dari yang paling
 * tepat. Dipakai saat tidak ada chart bawaan yang cocok untuk tipe widget-nya.
 */
export function dasarUntuk(w: WidgetSpec): ChartId {
  const kategori = w.chart?.xAxis?.length ?? 0;
  const seri = w.chart?.series?.length ?? 0;
  const adaTarget =
    (w.kpi?.target !== undefined && w.kpi?.target !== null) ||
    (w.kpi?.targets?.length ?? 0) > 0 ||
    (w.chart?.series ?? []).some((s) => /target|rencana|rkap|anggaran/i.test(s.name || ''));

  if ((w.table?.columns?.length ?? 0) >= 2 && (w.table?.rows?.length ?? 0) > 0) return 'tabel-ringkas';
  if (w.kpi?.value !== undefined && w.kpi?.value !== null) return 'kpi-kartu';
  if (seri >= 2 && adaTarget) return 'combo-batang-garis';
  if (seri >= 2) return 'garis-tren';
  if (seri === 1 && kategori > 0) return 'bar-tegak';
  if (seri === 1) return 'garis-tren';
  if ((w.kpi?.sparkline?.length ?? 0) > 1) return 'strip-os';
  // Tidak ada angka yang bisa digambar: tampilkan sebagai teks, bukan kartu kosong.
  return 'narasi-insight';
}

/** Nama entri baru, dibaca admin di Template Chart. */
function namaKustom(w: WidgetSpec, dasar: EntriChart): string {
  const jenis = String(w.type || 'kartu');
  const seri = w.chart?.series?.length ?? 0;
  const kategori = w.chart?.xAxis?.length ?? 0;
  const rincian = [
    seri > 0 ? `${seri} seri` : '',
    kategori > 0 ? `${kategori} kategori` : '',
    (w.table?.columns?.length ?? 0) > 0 ? `tabel ${w.table?.columns?.length} kolom` : '',
    w.kpi?.value !== undefined && w.kpi?.value !== null ? 'satu angka' : '',
  ].filter(Boolean);
  const akhiran = rincian.length > 0 ? ` — ${rincian.join(', ')}` : '';
  // Nama harus terbaca manusia: "Radar (dasar: Batang tegak polos) — 1 seri, 4 kategori".
  return `${jenis.charAt(0).toUpperCase()}${jenis.slice(1)} (dasar: ${dasar.nama})${akhiran}`;
}

/**
 * Entri katalog yang dipakai sebuah widget.
 *
 * `ada` = daftar entri kustom yang sudah dibuat (dari penyimpanan).
 * Kembalian: `{ pakai: 'bawaan', id }` bila chart bawaan cocok,
 * `{ pakai: 'kustom', entri, baru }` bila harus/sudah memakai entri kustom.
 */
export type PutusanChart =
  | { pakai: 'bawaan'; id: ChartId; tipe?: WidgetType }
  | { pakai: 'kustom'; entri: ChartKustom; baru: boolean };

export function putusanChart(
  w: WidgetSpec,
  opsi: { chartIdBawaan?: string; ada: ChartKustom[]; sekarang?: string }
): PutusanChart {
  // 1. Pemanggil sudah menentukan chart bawaan yang sah → hormati.
  const diminta = opsi.chartIdBawaan || w.chartId;
  if (chartBawaan(diminta)) return { pakai: 'bawaan', id: diminta as ChartId };

  // 2. Sudah memakai entri kustom yang masih ada → pakai lagi (id stabil).
  const kustomAda = diminta ? opsi.ada.find((k) => k.id === diminta) : undefined;
  if (kustomAda) return { pakai: 'kustom', entri: kustomAda, baru: false };

  // 3. Tipe yang MEMANG punya wajah di Template Chart (bar, garis, donat, KPI,
  //    tabel, ...) dicocokkan dengan aturan penyusun halaman (`pilihChart`) —
  //    satu sumber kebenaran, bukan tebakan baru.
  //
  //    Tipe yang belum punya wajah (peta, radar, heatmap, sankey, gantt, treemap,
  //    funnel, waterfall, boxplot) TIDAK dipaksa jadi bar/garis: itu akan
  //    menipu bentuk datanya. Tipe seperti itu langsung dibuatkan entri Template
  //    Chart sendiri di langkah 5.
  const wajah = chartIdDariTipe(w.type);
  if (wajah) {
    // `pilihChart` hanya dipakai kalau ia memilih chart yang MEMANG dibuat untuk
    // tipe ini (mis. bar → `bar-tegak-sorot`). Kalau ia jatuh ke cabang umum
    // (`bar-mendatar-peringkat` untuk apa pun yang punya kategori+seri), wajah
    // khusus tipe yang dipakai — heatmap tetap peta panas, bukan bar peringkat.
    const cocok = pilihChart(w);
    const khusus = cocok.chartId && chartBawaan(cocok.chartId) && CHART_DEFAULT[cocok.chartId as ChartId].tipe === w.type;
    return khusus
      ? { pakai: 'bawaan', id: cocok.chartId as ChartId, tipe: cocok.type }
      : { pakai: 'bawaan', id: wajah, tipe: w.type };
  }

  // 4. Belum ada keputusan: cari entri kustom dengan bentuk data yang sama.
  const sidik = sidikBentuk(w);
  const sebentuk = opsi.ada.find((k) => k.sidik === sidik);
  if (sebentuk) return { pakai: 'kustom', entri: sebentuk, baru: false };

  // 5. Bentuk baru → buat entri Template Chart baru dari chart bawaan terdekat.
  const dasarId = dasarUntuk(w);
  const dasar = CHART_DEFAULT[dasarId];
  const entri: ChartKustom = {
    id: `${AWALAN_KUSTOM}${sidik.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    nama: namaKustom(w, dasar),
    tipe: dasar.tipe,
    dasar: dasarId,
    butuh: dasar.butuh,
    guna: `Dibuat otomatis karena tidak ada chart bawaan untuk bentuk data ini. ${dasar.guna}.`,
    kelompok: dasar.kelompok,
    sidik,
    dibuatPada: opsi.sekarang || new Date().toISOString(),
  };
  return { pakai: 'kustom', entri, baru: true };
}

/** Widget setelah memakai entri katalog hasil `putusanChart`. */
export function terapkanChart(w: WidgetSpec, putusan: PutusanChart): WidgetSpec {
  if (putusan.pakai === 'bawaan') {
    return { ...w, chartId: putusan.id, chartDasar: undefined, ...(putusan.tipe ? { type: putusan.tipe } : {}) };
  }
  return { ...w, chartId: putusan.entri.id, chartDasar: putusan.entri.dasar, type: putusan.entri.tipe };
}

/**
 * Pastikan SETIAP widget memakai chart dari Template Chart.
 *
 * Mengembalikan widget yang sudah dipastikan `chartId`-nya, plus entri kustom
 * baru yang perlu disimpan pemanggil (server). Fungsi ini idempoten: widget yang
 * sudah benar tidak diubah, dan entri kustom yang sama tidak dibuat dua kali.
 */
export function pastikanChartKatalog(
  widgets: WidgetSpec[],
  opsi: { ada: ChartKustom[]; sekarang?: string }
): { widgets: WidgetSpec[]; baru: ChartKustom[] } {
  const ada = [...opsi.ada];
  const baru: ChartKustom[] = [];
  const hasil = widgets.map((w) => {
    const putusan = putusanChart(w, { ada, sekarang: opsi.sekarang });
    if (putusan.pakai === 'kustom' && putusan.baru) {
      ada.push(putusan.entri);
      baru.push(putusan.entri);
    }
    return terapkanChart(w, putusan);
  });
  return { widgets: hasil, baru };
}

/** Daftar id yang sah dipakai widget: seluruh chart bawaan + entri kustom. */
export function idKatalogSah(kustom: ChartKustom[] = []): string[] {
  return [...DAFTAR_CHART, ...kustom.map((k) => k.id)];
}

/** Chart bawaan yang menggambar sebuah widget (entri kustom → dasarnya). */
export function chartPenggambar(w: Pick<WidgetSpec, 'chartId' | 'chartDasar'>, kustom: ChartKustom[] = []): ChartId | undefined {
  if (chartBawaan(w.chartId)) return w.chartId as ChartId;
  if (chartBawaan(w.chartDasar)) return w.chartDasar as ChartId;
  const entri = w.chartId ? kustom.find((k) => k.id === w.chartId) : undefined;
  return entri?.dasar;
}
