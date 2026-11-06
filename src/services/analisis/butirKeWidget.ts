/**
 * BUTIR DATA → WIDGET.
 *
 * Ini jembatan antara "angka yang disetujui admin" dan "kartu di halaman".
 * Aturan pokoknya: **angka tidak pernah dikarang di sini**. Semua nilai di
 * widget berasal dari `ButirData`; kalau butirnya tidak punya angka, widgetnya
 * tidak dibuat (bukan diisi angka contoh).
 *
 * Fungsi murni: tanpa jaringan, tanpa LLM, tanpa database. Semua yang bisa
 * salah di sini bisa diuji.
 */

import type { ButirData, Citation, WidgetSpec, WidgetType } from '../../types';
import { pilihChart } from '../builder/susunHalaman';

/** Batas widget per halaman — angka yang sama dengan batas kanvas. */
export const MAKS_WIDGET_PER_HALAMAN = 9;

/** Ukuran kartu pada grid 12 kolom. */
const UKURAN: Record<string, { w: number; h: number }> = {
  kpi: { w: 3, h: 2 },
  'bullet-target': { w: 3, h: 2 },
  narasi: { w: 12, h: 3 },
  table: { w: 12, h: 6 },
  lain: { w: 6, h: 5 },
};

function ukuranUntuk(tipe: WidgetType): { w: number; h: number } {
  if (tipe === 'kpi' || tipe === 'bullet-target' || tipe === 'gauge') return UKURAN.kpi;
  if (tipe === 'table') return UKURAN.table;
  if (tipe === 'narasi') return UKURAN.narasi;
  return UKURAN.lain;
}

function keyakinanKeConfidence(k: ButirData['keyakinan']): WidgetSpec['confidence'] {
  if (k === 'tinggi') return 'sumber';
  // Butir yang masih perlu diturunkan/dijumlah tetap bukan "sumber" — ia
  // inferensi, dan kanvas menampilkannya berbeda.
  return 'inferensi AI';
}

/** Sitasi butir → sitasi widget. Halaman 0 berarti tidak disebutkan. */
export function sitasiDari(butir: ButirData): Citation[] {
  const dokumen = String(butir.sitasi?.dokumen || '').trim();
  if (!dokumen || /tidak disebutkan/i.test(dokumen)) return [];
  return [
    {
      id: `${butir.id}-sitasi`,
      docName: dokumen,
      page: butir.sitasi.halaman ?? 0,
      chunkSnippet: butir.sitasi.kutipan ?? '',
      confidenceScore: butir.keyakinan === 'tinggi' ? 0.9 : butir.keyakinan === 'sedang' ? 0.6 : 0.3,
      date: butir.dibuatPada,
      ...(butir.sitasi.halaman ? {} : {}),
      metric: butir.nama,
    },
  ];
}

/** Label sumbu-X dari deret: pakai kategori bila ada, kalau tidak nomor urut. */
function labelSumbu(seri: NonNullable<ButirData['seri']>): string[] {
  const pertama = seri[0];
  if (pertama?.kategori && pertama.kategori.length === pertama.data.length) return pertama.kategori;
  return pertama?.data.map((_, i) => String(i + 1)) ?? [];
}

/**
 * Satu butir → satu widget.
 *
 * `type` mengikuti `bentukDisarankan` butir, lalu dinormalkan `pilihChart` supaya
 * sama dengan aturan katalog chart yang dipakai seluruh aplikasi (mis. donat
 * dengan lebih dari 6 potongan otomatis jadi batang mendatar).
 */
export function butirKeWidget(butir: ButirData, urut = 1): WidgetSpec | null {
  const dasar: Partial<WidgetSpec> = {
    id: `w-${butir.id || urut}`,
    type: butir.bentukDisarankan,
    title: butir.nama,
    subtitle: butir.periode,
    category: butir.kategori,
    confidence: keyakinanKeConfidence(butir.keyakinan),
    citations: sitasiDari(butir),
    ...(butir.periode ? { periode: butir.periode } : {}),
    grid: { x: 0, y: 0, ...ukuranUntuk(butir.bentukDisarankan) },
  };

  if (butir.nilai !== undefined && butir.nilai !== null) {
    dasar.kpi = { value: butir.nilai, ...(butir.satuan ? { unit: butir.satuan } : {}) };
  }

  if (butir.seri && butir.seri.length > 0) {
    const data = butir.seri.map((s) => s.data);
    if (data.some((d) => d.length === 0)) return null;
    dasar.chart = {
      xAxis: labelSumbu(butir.seri),
      series: butir.seri.map((s) => ({ name: s.nama, data: s.data })),
      ...(butir.satuan ? { unit: butir.satuan } : {}),
    };
  }

  if (butir.tabel) {
    const kolom = butir.tabel.kolom;
    dasar.table = {
      columns: kolom.map((label, i) => ({
        key: `k${i}`,
        label,
        format: i === 0 ? 'text' : 'number',
      })),
      rows: butir.tabel.baris.map((baris) => {
        const rec: Record<string, string | number> = {};
        baris.forEach((sel, i) => {
          rec[`k${i}`] = sel as string | number;
        });
        return rec;
      }),
    };
  }

  // Tidak ada angka sama sekali → jangan bikin kartu kosong yang menipu.
  if (!dasar.kpi && !dasar.chart && !dasar.table) return null;

  const pilih = pilihChart(dasar as WidgetSpec);
  const widget: WidgetSpec = {
    ...(dasar as WidgetSpec),
    type: pilih.type,
    ...(pilih.chartId ? { chartId: pilih.chartId } : {}),
  };
  // Ukuran grid mengikuti tipe FINAL (mis. donat yang jadi batang mendatar).
  widget.grid = { x: 0, y: 0, ...ukuranUntuk(widget.type) };
  return widget;
}

/** Susun kartu pada grid 12 kolom: KPI berbaris empat, grafik dua, tabel penuh. */
export function tataGrid(widgets: WidgetSpec[]): WidgetSpec[] {
  let x = 0;
  let y = 0;
  let tinggiBaris = 0;
  return widgets.map((w) => {
    const { w: lebar, h: tinggi } = w.grid;
    if (x + lebar > 12) {
      x = 0;
      y += tinggiBaris;
      tinggiBaris = 0;
    }
    const hasil: WidgetSpec = { ...w, grid: { x, y, w: lebar, h: tinggi } };
    x += lebar;
    tinggiBaris = Math.max(tinggiBaris, tinggi);
    return hasil;
  });
}

/**
 * Butir → halaman. Dikelompokkan per kategori supaya satu halaman tidak
 * mencampur keuangan dengan SDM, lalu dipecah bila lebih dari 9 widget.
 *
 * Judul halaman memakai kategori; pemecahan diberi "Bagian 1", "Bagian 2" —
 * bukan "Halaman 2", karena keduanya masih topik yang sama.
 */
export function butirKeHalaman(
  daftarButir: ButirData[],
  opsi?: { judul?: string; maks?: number }
): Array<{ judul: string; widgets: WidgetSpec[] }> {
  const maks = Math.max(1, opsi?.maks ?? MAKS_WIDGET_PER_HALAMAN);
  const perKategori = new Map<string, WidgetSpec[]>();

  for (const butir of daftarButir) {
    if (butir.status === 'ditolak') continue;
    const widget = butirKeWidget(butir, perKategori.size + 1);
    if (!widget) continue;
    const kunci = butir.kategori || 'Umum';
    perKategori.set(kunci, [...(perKategori.get(kunci) ?? []), widget]);
  }

  const halaman: Array<{ judul: string; widgets: WidgetSpec[] }> = [];
  for (const [kategori, widgets] of perKategori) {
    const potongan: WidgetSpec[][] = [];
    for (let i = 0; i < widgets.length; i += maks) potongan.push(widgets.slice(i, i + maks));
    potongan.forEach((isi, i) => {
      halaman.push({
        judul: potongan.length > 1 ? `${kategori} — Bagian ${i + 1}` : kategori,
        widgets: tataGrid(isi),
      });
    });
  }

  if (halaman.length === 0) {
    return opsi?.judul ? [{ judul: opsi.judul, widgets: [] }] : [];
  }
  if (opsi?.judul && halaman.length === 1) halaman[0].judul = opsi.judul;
  return halaman;
}

/** Ringkasan untuk pesan setelah halaman dibuat — jujur soal apa yang dibuang. */
export function ringkasHalaman(
  butir: ButirData[],
  halaman: Array<{ judul: string; widgets: WidgetSpec[] }>
): string {
  const dipakai = halaman.reduce((n, h) => n + h.widgets.length, 0);
  const ditolak = butir.filter((b) => b.status === 'ditolak').length;
  const tanpaAngka = butir.length - ditolak - dipakai;
  const bagian = [`${dipakai} kartu di ${halaman.length} halaman`];
  if (ditolak > 0) bagian.push(`${ditolak} butir ditolak admin`);
  if (tanpaAngka > 0) bagian.push(`${tanpaAngka} butir tanpa angka tidak dipakai`);
  return bagian.join(' · ');
}
