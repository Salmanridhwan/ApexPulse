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
import { CHART_DEFAULT, type ChartId } from '../chart/chartDefault';

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
export function butirKeWidget(
  butir: ButirData,
  urut = 1,
  /**
   * Bentuk pilihan pengguna. Hanya dipakai bila pengguna memang memilih; tanpa
   * pilihan, bentuk tetap mengikuti saran analisis (`bentukDisarankan`).
   */
  opsi?: { bentuk?: WidgetType; chartId?: string }
): WidgetSpec | null {
  /**
   * Chart pilihan pengguna dari katalog Template Chart. Bila ada, tipenya
   * mengikuti katalog (bukan `bentukDisarankan`), dan `pilihChart` tidak boleh
   * menggantinya karena pengguna sudah memilih sendiri.
   */
  const katalog = opsi?.chartId ? CHART_DEFAULT[opsi.chartId as ChartId] : undefined;
  const bentuk = (katalog?.tipe as WidgetType | undefined) ?? opsi?.bentuk ?? butir.bentukDisarankan;
  const dasar: Partial<WidgetSpec> = {
    id: `w-${butir.id || urut}`,
    type: bentuk,
    title: butir.nama,
    subtitle: butir.periode,
    category: butir.kategori,
    confidence: keyakinanKeConfidence(butir.keyakinan),
    citations: sitasiDari(butir),
    ...(butir.periode ? { periode: butir.periode } : {}),
    grid: { x: 0, y: 0, ...ukuranUntuk(bentuk) },
  };

  if (butir.nilai !== undefined && butir.nilai !== null) {
    dasar.kpi = { value: butir.nilai, ...(butir.satuan ? { unit: butir.satuan } : {}) };
  }

  if (butir.seri && butir.seri.length > 0) {
    /**
     * Data dibersihkan sebelum digambar: hanya titik yang angkanya benar-benar
     * ada di semua deret yang dipakai, supaya sumbu-X dan deretnya tetap
     * sejajar. Titik yang angkanya hilang dibuang, bukan diisi nol — nol akan
     * terbaca sebagai angka sungguhan.
     */
    const label = labelSumbu(butir.seri);
    const panjang = Math.min(...butir.seri.map((s) => s.data.length), label.length || Infinity);
    const titik: number[] = [];
    for (let i = 0; i < panjang; i++) {
      const semuaAda = butir.seri.every((s) => Number.isFinite(Number(s.data[i])));
      if (semuaAda) titik.push(i);
    }
    if (titik.length === 0) return null;
    dasar.chart = {
      xAxis: titik.map((i) => String(label[i] ?? i + 1)),
      series: butir.seri.map((s, j) => ({
        name: String(s.nama || '').trim() || `Seri ${j + 1}`,
        data: titik.map((i) => Number(s.data[i])),
      })),
      ...(butir.satuan ? { unit: butir.satuan } : {}),
    };

    /**
     * SATU KARTU, BANYAK PERIODE.
     *
     * Butir gabungan menyimpan satu deret per periode. Supaya kartunya tidak
     * penuh garis yang saling menimpa, tiap periode disimpan terpisah di
     * `periodeData` dan kepala kartu memberi pemilih periode. `chart` di atas
     * tetap terisi (semua deret) untuk pemakaian yang butuh keseluruhan.
     */
    const periode = butir.periodeTersedia || [];
    if (periode.length > 1 && periode.length === butir.seri.length) {
      dasar.periodeData = butir.seri.map((s, i) => ({
        periode: periode[i],
        xAxis: (s.kategori && s.kategori.length === s.data.length ? s.kategori : s.data.map((_, k) => String(k + 1))).map(String),
        series: [
          {
            name: String(s.nama || '').trim() || `Seri ${i + 1}`,
            data: s.data.map((v) => Number(v)),
          },
        ],
      }));
    }
  }

  /**
   * Tabel dari deret. Kalau pengguna memilih bentuk "Tabel" padahal butirnya
   * hanya punya deret angka, tabelnya disusun dari angka itu sendiri — bukan
   * tabel kosong yang membuat kartunya terlihat tidak muncul.
   */
  if (bentuk === 'table' && !butir.tabel && butir.seri && butir.seri.length > 0) {
    const label = labelSumbu(butir.seri);
    dasar.table = {
      columns: [
        { key: 'k0', label: 'Kategori', format: 'text' },
        ...butir.seri.map((s, i) => ({ key: `k${i + 1}`, label: s.nama || `Seri ${i + 1}`, format: 'number' as const })),
      ],
      rows: label.map((kat, i) => {
        const rec: Record<string, string | number> = { k0: kat };
        butir.seri!.forEach((s, j) => {
          rec[`k${j + 1}`] = s.data[i] ?? '';
        });
        return rec;
      }),
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

  const pilih = katalog ? { type: bentuk, chartId: katalog.id } : pilihChart(dasar as WidgetSpec);
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
  const tersusun = widgets.map((w) => {
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

  /**
   * Baris yang tidak penuh (mis. satu grafik selebar 6, atau tiga KPI) dulu
   * menyisakan ruang kosong di kanan. Lebar kartu di baris itu dibagi rata
   * supaya baris selalu terisi 12 kolom; sisa pembagian jatuh ke kartu terakhir.
   */
  const perBaris = new Map<number, WidgetSpec[]>();
  for (const w of tersusun) perBaris.set(w.grid.y, [...(perBaris.get(w.grid.y) ?? []), w]);
  for (const baris of perBaris.values()) {
    // Tinggi kartu dalam satu baris disamakan: kartu pendek di samping kartu
    // tinggi dulu meninggalkan lubang di bawahnya.
    const tinggi = Math.max(...baris.map((w) => w.grid.h));
    for (const w of baris) w.grid = { ...w.grid, h: tinggi };
    const terisi = baris.reduce((n, w) => n + w.grid.w, 0);
    if (terisi >= 12) continue;
    const dasar = Math.floor(12 / baris.length);
    let kiri = 0;
    baris.forEach((w, i) => {
      const lebar = i === baris.length - 1 ? 12 - kiri : dasar;
      w.grid = { ...w.grid, x: kiri, w: lebar };
      kiri += lebar;
    });
  }
  return tersusun;
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
  opsi?: { judul?: string; maks?: number; bentuk?: WidgetType; chartId?: string }
): Array<{ judul: string; widgets: WidgetSpec[] }> {
  const maks = Math.max(1, opsi?.maks ?? MAKS_WIDGET_PER_HALAMAN);
  const perKategori = new Map<string, WidgetSpec[]>();

  for (const butir of daftarButir) {
    if (butir.status === 'ditolak') continue;
    const widget = butirKeWidget(butir, perKategori.size + 1, {
      bentuk: opsi?.bentuk,
      chartId: opsi?.chartId,
    });
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
