/**
 * KARTU HTML KANVAS = KARTU HTML TEMPLATE CHART.
 *
 * Kartu KPI, tabel, narasi, progres target, dan peringkat di menu Template
 * Chart digambar `WidgetChart` (bentuk HTML). Kanvas dashboard dulu memakai
 * komponennya sendiri (`KpiCard`, `DataTable`, `NarasiCard`) walaupun kartunya
 * sudah membawa `chartId`, jadi kartu hasil asisten tampil beda dari pilihan di
 * Template Chart (uji 3 Nov 2026). Modul ini menerjemahkan isi WidgetSpec ke
 * `DataChart` supaya kanvas memanggil renderer yang sama.
 *
 * Angka hanya dari widget: sparkline dipakai bila deretnya dari dokumen.
 */

import type { WidgetSpec } from '../../types';
import { CHART_DEFAULT, DAFTAR_CHART, type ChartId } from './chartDefault';
import { pakaiRancangan } from './rancanganRag';
import type { DataChart } from './pembangunOpsi';

export interface PropsKatalog {
  data: DataChart;
  judul?: string;
  teks?: string;
  /** Butir narasi (bila ada, wajah narasi menampilkan daftar bernomor). */
  butir?: string[];
  teksAngka?: string;
  deltaTeks?: string;
  spark?: number[];
}

/** Wajah yang menggambar judulnya sendiri di dalam kotak: kepala kartu kanvas disembunyikan. */
const BERJUDUL_SENDIRI: ChartId[] = ['kpi-kartu', 'kpi-strip', 'narasi-insight', 'kpi-target'];

export const kartuBerjudulSendiri = (w: Pick<WidgetSpec, 'chartId'>): boolean =>
  Boolean(w.chartId && BERJUDUL_SENDIRI.includes(w.chartId as ChartId));

const angka = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = String(v ?? '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
};

/**
 * Props `WidgetChart` untuk kartu berwajah HTML, atau `null` bila chartId-nya
 * bukan bentuk HTML atau datanya tidak cukup (kartu tetap memakai renderer lama).
 */
/** Chart bawaan yang menggambar kartu ini (entri kustom → `chartDasar`-nya). */
const idPenggambar = (w: WidgetSpec): ChartId | undefined =>
  (w.chartDasar as ChartId) || (w.chartId as ChartId);

export function propsKatalogHtml(w: WidgetSpec): PropsKatalog | null {
  const id = idPenggambar(w);
  if (!id || CHART_DEFAULT[id]?.mesin !== 'html') return null;
  const judul = w.title;

  switch (id) {
    case 'kpi-kartu':
    case 'kpi-strip': {
      if (!w.kpi) return null;
      const nilai = String(w.kpi.value ?? '').trim();
      const kosong = nilai === '' || nilai === '-';
      // Sparkline estimasi (turunan) tidak digambar: garisnya bukan dari dokumen.
      const spark =
        w.kpi.sparklineAsal === 'dokumen-seri' && (w.kpi.sparkline?.length ?? 0) > 1 ? w.kpi.sparkline : undefined;
      const tampilDelta = w.kpi.deltaLabel !== 'tren indikatif';
      return {
        judul,
        teksAngka: kosong ? undefined : nilai,
        deltaTeks: tampilDelta ? w.kpi.deltaLabel : undefined,
        spark,
        data: {
          kategori: [judul],
          seri: [{ nama: judul, data: spark ?? [angka(nilai)] }],
          satuan: w.kpi.unit,
          delta: tampilDelta ? w.kpi.delta : undefined,
          dariDokumen: true,
          kosong,
        },
      };
    }
    case 'kpi-target': {
      if (!w.kpi) return null;
      const nilai = String(w.kpi.value ?? '').trim();
      const kosong = nilai === '' || nilai === '-';
      const target = angka(w.kpi.target);
      return {
        judul,
        teksAngka: kosong ? undefined : nilai,
        data: {
          kategori: [judul],
          seri: [{ nama: judul, data: [angka(nilai)] }],
          satuan: w.kpi.unit,
          target: target ?? undefined,
          // "≤ 5 hari", "≤ target": sasaran yang baik bila angkanya turun.
          arahBaik: /≤|<=|maks|turun|kurang/i.test(w.kpi.targetLabel ?? '') ? 'turun' : 'naik',
          dariDokumen: true,
          kosong,
        },
      };
    }
    case 'papan-isu':
    case 'tabel-status': {
      const kolom = w.table?.columns ?? [];
      const baris = w.table?.rows ?? [];
      if (kolom.length < 2 || baris.length === 0) return null;
      return {
        data: {
          kategori: [judul],
          seri: [],
          dariDokumen: true,
          tabel: { kepala: kolom.map((c) => c.label), baris: baris.map((r) => kolom.map((c) => r[c.key] ?? '-')) },
        },
      };
    }
    case 'narasi-insight': {
      const teks = w.narasi?.text?.trim();
      const butir = w.narasi?.bulletPoints?.filter((b) => b.trim().length > 0);
      if (!teks && !butir?.length) return null;
      return {
        judul,
        teks: teks || undefined,
        butir: butir?.length ? butir : undefined,
        data: { kategori: [judul], seri: [], dariDokumen: true },
      };
    }
    case 'tabel-ringkas': {
      const kolom = w.table?.columns ?? [];
      const baris = w.table?.rows ?? [];
      if (kolom.length < 2 || baris.length === 0) return null;
      return {
        data: {
          kategori: [judul],
          seri: [],
          dariDokumen: true,
          tabel: { kepala: kolom.map((c) => c.label), baris: baris.map((r) => kolom.map((c) => r[c.key] ?? '-')) },
        },
      };
    }
    case 'progres-target': {
      const target = w.kpi?.targets ?? [];
      if (target.length === 0) return null;
      return {
        data: {
          kategori: target.map((t) => t.label),
          seri: [{ nama: judul, data: target.map((t) => t.persen) }],
          satuan: '%',
          dariDokumen: true,
        },
      };
    }
    default: {
      // peringkat, strip-os, alur-tahap, corong-pipeline, daftar-progres: label + satu deret angka.
      const kategori = w.chart?.xAxis ?? [];
      const seri = w.chart?.series?.[0];
      if (kategori.length === 0 || !seri?.data?.length) return null;
      return {
        data: {
          kategori,
          seri: [{ nama: seri.name || judul, data: seri.data.map((v) => angka(v)) }],
          satuan: w.chart?.unit,
          dariDokumen: true,
        },
      };
    }
  }
}

/** Grafik berwajah ECharts dari Template Chart yang datanya cukup untuk digambar. */
export const grafikKatalog = (w: WidgetSpec): boolean =>
  Boolean(
    idPenggambar(w) &&
      DAFTAR_CHART.includes(idPenggambar(w) as ChartId) &&
      CHART_DEFAULT[idPenggambar(w) as ChartId].mesin === 'echarts' &&
      !pakaiRancangan(w) &&
      // Cukup salah satu bentuk data: sumbu+seri (chart biasa), wilayah (peta),
      // jadwal (gantt), atau sampel mentah (kotak sebaran).
      ((w.chart?.xAxis?.length ?? 0) > 0 && (w.chart?.series?.length ?? 0) > 0 ||
        (w.geo?.regions?.length ?? 0) > 0 ||
        (w.gantt?.tasks?.length ?? 0) > 0 ||
        (w.chart?.boxRaw?.length ?? 0) > 0)
  );

/** Kartu digambar wajah Template Chart (HTML atau ECharts), lengkap dengan bingkainya. */
export const pakaiWajahKatalog = (w: WidgetSpec): boolean =>
  !w.dataKosong && (propsKatalogHtml(w) !== null || grafikKatalog(w));
