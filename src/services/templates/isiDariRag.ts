import type { BumdSector, WidgetSpec } from '../../types';
import type { DashboardTemplate } from './dashboardTemplates';

/**
 * ISI TEMPLATE DARI RAG — memakai SUSUNAN kartu template, tetapi ANGKANYA diambil
 * dari dokumen resmi instansi lewat layanan RAG.
 *
 * Aturan yang tidak boleh dilanggar: TIDAK ADA angka contoh. Untuk setiap kartu,
 * angka diambil dari dokumen. Kalau dokumen instansi tidak memuat indikator itu,
 * kartu TIDAK diisi angka karangan — kartu ditandai `dataKosong` dan kanvas
 * menampilkan penanda "belum ada di dokumen" beserta alasannya.
 */

/** Bagian klien RAG yang dibutuhkan pengisi template (cukup satu metode). */
export interface RagPengambilData {
  ambilDataWidget(
    query: string,
    sector: BumdSector,
    tipeTarget: string,
    instansi?: string,
    kbId?: string,
    opsi?: { lemparSaatGagal?: boolean }
  ): Promise<{ data: any | null; judul?: string; deskripsi?: string; alasan?: string } | null>;
}

export interface OpsiIsiTemplate {
  sector: BumdSector;
  /** Nama instansi aktif — diteruskan agar dokumen instansi lain diabaikan. */
  instansi?: string;
  /** Knowledge base milik instansi aktif. */
  kbId?: string;
  rag: RagPengambilData;
  /** Jumlah panggilan RAG serentak (default 6). */
  konkurensi?: number;
  /** Dipanggil setiap satu kartu selesai — untuk progres di UI. */
  onProgres?: (info: { selesai: number; total: number; judul: string; terisi: boolean }) => void;
}

export interface HasilIsiTemplate {
  widgets: WidgetSpec[];
  terisi: number;
  kosong: number;
  catatan: string[];
}

/** Kueri per kartu: minta indikator persis kartu itu, jujur bila tidak ada. */
function kueriWidget(w: WidgetSpec): string {
  const jenis =
    w.type === 'kpi' || w.type === 'bullet-target' || w.type === 'gauge'
      ? 'angka indikator'
      : w.type === 'table'
        ? 'tabel data'
        : w.type === 'narasi'
          ? 'ringkasan naratif'
          : 'data deret/grafik';
  const sub = w.subtitle ? ` (${w.subtitle})` : '';
  return (
    `Ambil ${jenis} untuk indikator "${w.title}"${sub} dari dokumen resmi instansi ini. ` +
    `Gunakan angka yang BENAR-BENAR ada di dokumen beserta sumbernya (nama dokumen & halaman). ` +
    `Kalau indikator ini tidak ada di dokumen, katakan tidak ada — jangan mengarang.`
  );
}

/** Angka pertama pada teks gaya Indonesia; null bila tidak ada angka. */
function angkaDari(teks: unknown): number | null {
  if (typeof teks === 'number') return Number.isFinite(teks) ? teks : null;
  const m = String(teks ?? '').match(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Apakah data hasil RAG benar-benar berisi angka/isi (bukan cuma "tidak ada")?
 * Model kadang mengembalikan teks "tidak ada" sebagai nilai; itu BUKAN data dan
 * tidak boleh tampil sebagai kartu berangka.
 */
function punyaDataValid(w: WidgetSpec): boolean {
  if (w.kpi) {
    const v = w.kpi.value;
    if (v === null || v === undefined) return false;
    if (typeof v === 'string' && /^\s*(tidak ada|n\/?a|none|unknown|-+|–+)\s*$/i.test(v)) return false;
    return angkaDari(v) !== null;
  }
  if (w.chart) {
    const seri = w.chart.series || [];
    return seri.some((s) => Array.isArray(s.data) && s.data.some((n) => typeof n === 'number' && Number.isFinite(n)));
  }
  if (w.heatmap) {
    return Array.isArray(w.heatmap.data) && w.heatmap.data.some((r) => Array.isArray(r) && r.length > 0);
  }
  if (w.table) {
    return Array.isArray(w.table.rows) && w.table.rows.length > 0;
  }
  if (w.narasi) {
    const t = (w.narasi.text || '').trim();
    return t.length >= 10 && !/^\s*(tidak ada|n\/?a|none)\s*$/i.test(t);
  }
  if (w.treemap) {
    return Array.isArray(w.treemap.children) && w.treemap.children.length > 0;
  }
  return false;
}

/** Buang SELURUH muatan angka contoh dari kartu template (sisakan kerangka: id, judul, grid, tipe). */
function kerangka(w: WidgetSpec): WidgetSpec {
  const sisa: WidgetSpec = { ...w };
  delete sisa.kpi;
  delete sisa.chart;
  delete sisa.table;
  delete sisa.narasi;
  delete sisa.heatmap;
  delete sisa.geo;
  delete sisa.gantt;
  delete sisa.treemap;
  delete sisa.dataKosong;
  delete sisa.catatanData;
  return sisa;
}

/** Kosongkan data angka sebuah kartu (tanpa menghapus susunan/id/grid template). */
function kosongkan(w: WidgetSpec, alasan: string): WidgetSpec {
  return { ...kerangka(w), dataKosong: true, catatanData: alasan, citations: [] };
}

/** Jalankan tugas secara terbatas serentak, mempertahankan urutan hasil. */
async function kumpulan<T, R>(
  item: T[],
  batas: number,
  fn: (t: T, i: number) => Promise<R>
): Promise<R[]> {
  const hasil: R[] = new Array(item.length);
  let berikut = 0;
  const pekerja = Array.from({ length: Math.max(1, Math.min(batas, item.length)) }, async () => {
    for (;;) {
      const i = berikut++;
      if (i >= item.length) return;
      hasil[i] = await fn(item[i], i);
    }
  });
  await Promise.all(pekerja);
  return hasil;
}

/**
 * Isi seluruh kartu template dari dokumen RAG.
 *
 * Kartu yang berhasil diisi memakai JUDUL INDIKATOR NYATA dari dokumen (supaya
 * tidak ada kartu berlabel lain padahal isinya metrik berbeda); judul kartu
 * template asli dicatat di subjudul sebagai penanda asal.
 */
export async function isiTemplateDariRag(
  template: DashboardTemplate,
  opsi: OpsiIsiTemplate
): Promise<HasilIsiTemplate> {
  const { sector, instansi, kbId, rag, konkurensi = 8, onProgres } = opsi;
  const total = template.widgets.length;
  let selesai = 0;
  const catatan: string[] = [];

  const widgets = await kumpulan(template.widgets, konkurensi, async (w) => {
    let hasil: Awaited<ReturnType<RagPengambilData['ambilDataWidget']>> = null;
    try {
      hasil = await rag.ambilDataWidget(kueriWidget(w), sector, w.type, instansi, kbId);
    } catch (err) {
      catatan.push(`"${w.title}": ${err instanceof Error ? err.message : 'gagal mengambil data'}`);
    }

    selesai += 1;
    let keluar: WidgetSpec;
    const valid = !!hasil?.data && punyaDataValid(hasil.data as WidgetSpec);

    if (valid) {
      const d: any = hasil!.data;
      const judulDokumen: string = d.title || w.title;
      const kpi: any = d.kpi ? { ...d.kpi } : undefined;
      // Buang angka turunan yang TIDAK bersandar dokumen: sparkline sintetis
      // (`turunan-nilai`) membuat delta jadi konstanta yang sama untuk semua kartu
      // (mis. selalu "+6,4%") — itu angka karangan, bukan dari dokumen.
      if (kpi && kpi.sparklineAsal === 'turunan-nilai') {
        delete kpi.delta;
        delete kpi.deltaLabel;
        delete kpi.sparkline;
        delete kpi.sparklineAsal;
      }
      keluar = {
        ...kerangka(w),
        ...d,
        id: w.id,
        grid: w.grid,
        type: (d.type as WidgetSpec['type']) || w.type,
        title: judulDokumen,
        kpi,
        // Judul kartu template asli dipertahankan sebagai penanda asal bila beda.
        subtitle:
          judulDokumen && judulDokumen !== w.title
            ? `Dari template: ${w.title}`
            : d.subtitle || w.subtitle,
        confidence: 'sumber',
        citations: Array.isArray(d.citations) ? d.citations : [],
        dataKosong: false,
      };
    } else {
      const alasan =
        hasil?.alasan || 'Indikator ini tidak ditemukan di dokumen instansi.';
      keluar = kosongkan(w, alasan);
    }

    onProgres?.({ selesai, total, judul: w.title, terisi: valid });
    return keluar;
  });

  const terisi = widgets.filter((w) => !w.dataKosong).length;
  return { widgets, terisi, kosong: total - terisi, catatan };
}
