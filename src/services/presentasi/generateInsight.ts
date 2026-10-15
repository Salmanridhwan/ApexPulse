/**
 * GENERATE INSIGHT PRESENTASI — meminta layanan RAG menulis narasi insight untuk
 * tiap widget dashboard, lalu menyusun rencana slide.
 *
 * Dipanggil SEKALI saat pengguna menyiapkan presentasi; hasilnya disimpan ke
 * dashboard supaya tidak digenerate ulang tiap kali membuka mode presentasi.
 *
 * Prinsip yang tidak dilanggar: TIDAK mengarang angka. Kalau layanan RAG tidak
 * tersedia atau tidak menjawab, narasi cadangan dihitung dari data yang SUDAH ada
 * di widget (`narasiInsight`) — bukan teks baru yang mengklaim hal tak berdasar.
 */
import type { BumdSector, SlidePresentasi, WidgetSpec } from '../../types';
import type { RagClient } from '../rag/types';
import { narasiInsight, susunSlide } from './slide';

/** Ringkas satu widget jadi konteks teks untuk model (tanpa memanggil dokumen lagi). */
export function konteksWidget(w: WidgetSpec): string {
  const baris: string[] = [`- Judul: ${w.title}`];
  if (w.subtitle) baris.push(`  Subjudul: ${w.subtitle}`);
  baris.push(`  Jenis: ${w.type}`);
  if (w.kpi) {
    baris.push(`  Nilai: ${w.kpi.value}${w.kpi.unit ? ` ${w.kpi.unit}` : ''}`);
    if (typeof w.kpi.delta === 'number') baris.push(`  Perubahan: ${w.kpi.delta}% ${w.kpi.deltaLabel || ''}`.trim());
    if (typeof w.kpi.target === 'number') baris.push(`  Target: ${w.kpi.target}${w.kpi.unit ? ` ${w.kpi.unit}` : ''}`);
  }
  if (w.chart) {
    const u = w.chart.unit ? ` ${w.chart.unit}` : '';
    baris.push(`  Satuan: ${w.chart.unit || '-'}`);
    w.chart.series.forEach((s) => {
      baris.push(`  Seri "${s.name}": [${w.chart!.xAxis.map((k, i) => `${k}=${s.data[i]}${u}`).join(', ')}]`);
    });
  }
  if (w.table) baris.push(`  Tabel ${w.table.columns.length} kolom × ${w.table.rows.length} baris`);
  if (w.narasi?.text) baris.push(`  Catatan: ${w.narasi.text}`);
  if (w.citations.length) baris.push(`  Sumber: ${w.citations[0].docName}${w.citations[0].page ? ` hal. ${w.citations[0].page}` : ''}`);
  return baris.join('\n');
}

/** Jalankan tugas dengan batas serentak, mempertahankan urutan hasil. */
async function kumpulan<T, R>(item: T[], batas: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
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

export interface OpsiGenerateInsight {
  sector: BumdSector;
  instansi?: string;
  kbId?: string;
  rag: RagClient;
  /** Jumlah panggilan RAG serentak (default 3 — jaga beban layanan). */
  konkurensi?: number;
  /** Dipanggil tiap satu widget selesai — untuk progres di UI. */
  onProgres?: (info: { selesai: number; total: number; judul: string; dari: 'rag' | 'otomatis' }) => void;
}

export interface HasilGenerateInsight {
  widgets: WidgetSpec[];
  slides: SlidePresentasi[];
  dariRag: number;
  dariData: number;
  catatan: string[];
}

/**
 * Isi `insight` tiap widget dari RAG (dengan cadangan dari data), lalu susun
 * slide presentasi. Widget yang sudah punya insight 'manual' TIDAK ditimpa.
 */
export async function generateInsightPresentasi(
  widgets: WidgetSpec[],
  opsi: OpsiGenerateInsight
): Promise<HasilGenerateInsight> {
  const { sector, instansi, kbId, rag, konkurensi = 3, onProgres } = opsi;
  const catatan: string[] = [];
  let selesai = 0;
  let dariRag = 0;
  let dariData = 0;

  const bisaRag = typeof rag.insightWidget === 'function';

  const hasilWidgets = await kumpulan(widgets, konkurensi, async (w) => {
    // Sudah punya insight (hasil generate sebelumnya ATAU editan manual user) →
    // pakai apa adanya, TIDAK memanggil RAG lagi. Saat user menekan "Susun Ulang",
    // server mengosongkan insight lebih dulu sehingga semuanya ditulis ulang.
    if (w.insight && w.insight.trim()) {
      selesai += 1;
      if (w.insightAsal === 'rag') dariRag += 1;
      else dariData += 1;
      onProgres?.({ selesai, total: widgets.length, judul: w.title, dari: w.insightAsal === 'rag' ? 'rag' : 'otomatis' });
      return w;
    }
    // Widget kosong tidak perlu insight.
    if (w.dataKosong) {
      selesai += 1;
      onProgres?.({ selesai, total: widgets.length, judul: w.title, dari: 'otomatis' });
      dariData += 1;
      return w;
    }

    let insight: string | null = null;
    if (bisaRag) {
      try {
        const r = await rag.insightWidget!(konteksWidget(w), sector, instansi, kbId);
        insight = r?.insight?.trim() || null;
        if (!insight && r?.catatan) catatan.push(`"${w.title}": ${r.catatan}`);
      } catch (err) {
        catatan.push(`"${w.title}": ${err instanceof Error ? err.message : 'gagal mengambil insight'}`);
      }
    }

    selesai += 1;
    if (insight) {
      dariRag += 1;
      onProgres?.({ selesai, total: widgets.length, judul: w.title, dari: 'rag' });
      return { ...w, insight, insightAsal: 'rag' as const };
    }
    // Cadangan: hitung dari data yang ada (jujur, tanpa angka baru).
    const fallback = narasiInsight(w);
    dariData += 1;
    onProgres?.({ selesai, total: widgets.length, judul: w.title, dari: 'otomatis' });
    return { ...w, insight: fallback || w.insight, insightAsal: fallback ? ('otomatis' as const) : w.insightAsal };
  });

  const slides = susunSlide(hasilWidgets);

  // Narasi pengantar tiap slide: HANYA untuk slide yang memuat LEBIH DARI SATU
  // widget (untuk slide 1 widget, kotak insight widget sudah jadi narasinya —
  // menambah narasi slide akan menduplikasi teks yang sama). Dibatasi 2 kalimat
  // pertama supaya kotak pengantar tidak jadi blok teks padat.
  const peta = new Map(hasilWidgets.map((w) => [w.id, w]));
  const kalimatPertama = (t: string): string => {
    const m = /^(.+?[.!?])(\s|$)/.exec(t.trim());
    return (m ? m[1] : t).trim();
  };
  const slidesFinal = slides.map((s) => {
    if (s.narasi) return s;
    // Hanya slide berisi 2–4 widget: slide 1 widget (kotak insight widget sudah
    // jadi narasinya) dan slide kartu padat (6 KPI, sudah punya insight masing-
    // masing) tidak perlu kotak pengantar tambahan.
    if (s.widgetIds.length < 2 || s.widgetIds.length > 4) return s;
    const narasi = s.widgetIds
      .map((id) => peta.get(id)?.insight)
      .filter((t): t is string => !!t)
      .slice(0, 2)
      .map(kalimatPertama)
      .join(' ');
    return narasi ? { ...s, narasi, narasiAsal: 'rag' as const } : s;
  });

  return { widgets: hasilWidgets, slides: slidesFinal, dariRag, dariData, catatan };
}
