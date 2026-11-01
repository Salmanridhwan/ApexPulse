/**
 * HALAMAN YANG DIMINTA PENGGUNA.
 *
 * Pengguna sering menulis susunan halaman sendiri di kalimat permintaan:
 *
 *   "1. Halaman Ringkasan – gambaran umum: KPI warga terlayani, kapasitas
 *    produksi, ... 2. Halaman Keuangan – hanya topik uang: pendapatan, beban,
 *    laba, arus kas, komposisi beban, dan progres target pendapatan. ..."
 *
 * Dulu daftar ini diabaikan: halaman dibagi otomatis per kategori sehingga
 * hasilnya "Ringkasan" dan "Ringkasan (2)" berisi KPI saja. Modul ini membaca
 * daftar itu menjadi halaman + butir indikator, menebak bentuk chart tiap
 * butir, dan mencocokkan widget ke halamannya. MURNI (tanpa I/O) supaya bisa
 * diuji.
 */

import type { WidgetSpec } from '../../types';

export interface HalamanDiminta {
  judul: string;
  /** Indikator yang disebut untuk halaman ini, mis. "arus kas", "tren produksi bulanan". */
  butir: string[];
}

/** Halaman per permintaan paling banyak; lebih dari ini tidak muat di navigasi halaman. */
const MAKS_HALAMAN = 8;
/** Butir per halaman paling banyak: satu halaman harus muat satu layar. */
export const MAKS_BUTIR = 7;

const KATA_UMUM = new Set([
  'dan', 'per', 'di', 'ke', 'dari', 'yang', 'tiap', 'setiap', 'terhadap', 'untuk', 'dengan', 'atau', 'lalu', 'serta',
  'angka', 'kpi', 'tren', 'bulanan', 'bulan', 'tahunan', 'tahun', 'utama', 'total', 'nilai', 'data', 'grafik', 'chart',
]);

/** Token bermakna: huruf kecil, isi kurung dibuang, kata umum dibuang. */
export function tokenBermakna(teks: string): string[] {
  return String(teks ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 3 && !KATA_UMUM.has(t));
}

/** Dua kata dianggap sama bila salah satu awalan yang lain ("pelanggan" ~ "pelanggannya"). */
const kataSama = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));

/** Porsi token `butir` yang muncul di `teks` (0..1). */
export function skorCocok(butir: string, teks: string): number {
  const tb = tokenBermakna(butir);
  if (tb.length === 0) return 0;
  const tt = tokenBermakna(teks);
  return tb.filter((b) => tt.some((t) => kataSama(b, t))).length / tb.length;
}

/** Pecah uraian satu halaman menjadi butir indikator. */
function pecahButir(uraian: string): string[] {
  // Kalimat pertama saja: kalimat berikutnya biasanya larangan ("Tidak boleh ...").
  let inti = uraian.split(/\.\s+(?=[A-Z])|\.\s*$/)[0] ?? '';
  // "hanya topik uang: pendapatan, beban, ..." -> bagian setelah titik dua.
  const titikDua = inti.lastIndexOf(':');
  if (titikDua >= 0) inti = inti.slice(titikDua + 1);
  return inti
    .split(/\s*[,;]\s*|\s+(?:lalu|serta|dan|juga)\s+/i)
    .map((b) =>
      b
        .trim()
        .replace(/^(?:dan|serta|lalu|juga|kpi|angka)\s+/i, '')
        .replace(/[.\s]+$/, '')
        .trim()
    )
    .filter((b) => tokenBermakna(b).length > 0 && b.length <= 80)
    .slice(0, MAKS_BUTIR);
}

/**
 * Baca daftar halaman bernomor dari kalimat pengguna. Mengembalikan [] bila
 * tidak ada daftar (kurang dari dua halaman) — dashboard lalu dibagi otomatis.
 */
export function bacaHalamanDiminta(prompt: string): HalamanDiminta[] {
  const teks = String(prompt ?? '').replace(/\s+/g, ' ');
  const penanda = [...teks.matchAll(/(?:^|[\s:;])(\d{1,2})[.)]\s+/g)];
  const hasil: HalamanDiminta[] = [];
  penanda.forEach((m, i) => {
    const awal = (m.index ?? 0) + m[0].length;
    const akhir = i + 1 < penanda.length ? (penanda[i + 1].index ?? teks.length) : teks.length;
    const isi = teks.slice(awal, akhir).trim();
    const pakaiKata = /^halaman\s+/i.test(isi);
    const tanpaKata = isi.replace(/^halaman\s+/i, '');
    // Judul berakhir di tanda pisah atau titik dua pertama.
    const pisah = tanpaKata.match(/\s[–—-]\s|:\s/);
    if (!pakaiKata && (!pisah || (pisah.index ?? 99) > 60)) return;
    const judul = (pisah ? tanpaKata.slice(0, pisah.index) : tanpaKata.split(/[.,]/)[0]).trim().slice(0, 48);
    const uraian = pisah ? tanpaKata.slice((pisah.index ?? 0) + pisah[0].length) : '';
    if (!judul) return;
    hasil.push({ judul: judul.charAt(0).toUpperCase() + judul.slice(1), butir: pecahButir(uraian) });
  });
  return hasil.length >= 2 ? hasil.slice(0, MAKS_HALAMAN) : [];
}

/** Bentuk widget yang paling sesuai dengan kalimat butir. */
export function tipeButir(butir: string): 'kpi' | 'line' | 'donut' | 'bar' | 'bullet-target' | 'table' {
  const b = butir.toLowerCase();
  if (/\btren\b|bulanan|per bulan|per tahun|perkembangan|dari tahun ke tahun/.test(b)) return 'line';
  if (/komposisi|porsi|proporsi|struktur|bauran/.test(b)) return 'donut';
  if (/progres|capaian target|realisasi.*target|terhadap target/.test(b)) return 'bullet-target';
  if (/per (?:wilayah|kategori|zona|unit|cabang|kota)|\bantar|perbandingan|kontribusi|sebaran/.test(b)) return 'bar';
  if (/\bstatus\b|daftar|rincian/.test(b)) return 'table';
  return 'kpi';
}

/** Teks pembanding widget: judul + nama seri. */
const teksWidget = (w: WidgetSpec) => [w.title, ...(w.chart?.series ?? []).map((s) => s.name)].join(' ');

/** Ambang kecocokan widget dengan butir halaman. */
const AMBANG = 0.5;

/**
 * Halaman terbaik untuk satu widget: butir dengan kecocokan tertinggi. -1 bila
 * widget tidak cocok dengan halaman mana pun.
 */
export function halamanUntukWidget(w: WidgetSpec, halaman: HalamanDiminta[]): number {
  let terbaik = -1;
  let skorTerbaik = 0;
  // Angka tunggal (KPI) bukan rincian: "Jumlah pelanggan" total tidak masuk
  // halaman yang memintanya "per wilayah" atau sebagai tren.
  const angkaTunggal = w.type === 'kpi';
  halaman.forEach((h, i) => {
    const butir = angkaTunggal ? h.butir.filter((b) => ['kpi', 'bullet-target'].includes(tipeButir(b))) : h.butir;
    const skor = Math.max(0, ...butir.map((b) => skorCocok(b, teksWidget(w))));
    if (skor > skorTerbaik) {
      skorTerbaik = skor;
      terbaik = i;
    }
  });
  return skorTerbaik >= AMBANG ? terbaik : -1;
}

/** Butir yang sudah terwakili widget yang ada (tidak perlu diambil ulang dari dokumen). */
export function butirTerwakili(butir: string, widgets: WidgetSpec[]): boolean {
  // Butir grafik (tren, komposisi, per wilayah) tidak terwakili oleh KPI angka tunggal.
  const butuhGrafik = !['kpi', 'bullet-target'].includes(tipeButir(butir));
  return widgets.some((w) => !(butuhGrafik && w.type === 'kpi') && skorCocok(butir, teksWidget(w)) >= 0.75);
}

/**
 * Apakah pengguna meminta dashboard berhalaman banyak tanpa menulis daftarnya
 * ("beberapa halaman sekaligus", "satu topik per halaman", "3 halaman")?
 * Mengembalikan jumlah halaman yang disebut, `true` bila tanpa angka, atau
 * `false` bila tidak meminta.
 */
export function mintaBanyakHalaman(prompt: string): number | boolean {
  const t = String(prompt ?? '').toLowerCase();
  const ANGKA: Record<string, number> = { dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8 };
  const m = t.match(/(\d{1,2}|dua|tiga|empat|lima|enam|tujuh|delapan)\s+halaman/);
  if (m) {
    const n = ANGKA[m[1]] ?? parseInt(m[1], 10);
    if (n >= 2) return n;
  }
  return /beberapa halaman|banyak halaman|multi ?halaman|halaman terpisah|jangan satu halaman|(?:setiap|tiap|per) halaman|satu topik|per (?:topik|segmen)/.test(t);
}

/**
 * Segmentasi bawaan bila pengguna meminta banyak halaman tanpa daftarnya.
 * Setiap halaman satu topik dengan indikator khas sektornya; indikator tidak
 * berulang antarhalaman supaya data tidak kembar.
 */
const SEGMEN_PDAM: HalamanDiminta[] = [
  { judul: 'Ringkasan', butir: ['jumlah pelanggan', 'cakupan pelayanan', 'kapasitas produksi terpasang', 'tren jumlah pelanggan per tahun'] },
  { judul: 'Keuangan', butir: ['pendapatan usaha', 'beban usaha', 'laba bersih', 'arus kas operasi', 'komposisi beban usaha', 'tren pendapatan per tahun'] },
  { judul: 'Operasional & Produksi', butir: ['volume produksi air', 'volume air terjual', 'NRW (kehilangan air)', 'jam operasi pelayanan', 'tren produksi air per bulan'] },
  { judul: 'Pelayanan Pelanggan', butir: ['jumlah pengaduan pelanggan', 'waktu penyelesaian pengaduan', 'kepatuhan mutu air', 'tren pengaduan per kategori'] },
  { judul: 'Wilayah', butir: ['sambungan pelanggan per wilayah', 'cakupan pelayanan per wilayah', 'air terjual per wilayah'] },
];

const SEGMEN_UMUM: HalamanDiminta[] = [
  { judul: 'Ringkasan', butir: ['jumlah pelanggan', 'total aset', 'tren total aset per tahun'] },
  { judul: 'Keuangan', butir: ['pendapatan usaha', 'beban usaha', 'laba bersih', 'arus kas operasi', 'komposisi beban usaha', 'tren pendapatan per tahun'] },
  { judul: 'Operasional', butir: ['volume layanan', 'capaian target operasional', 'tren volume layanan per bulan', 'perbandingan kinerja per unit'] },
  { judul: 'Pelayanan', butir: ['jumlah pengaduan', 'waktu penyelesaian pengaduan', 'tren pengaduan per kategori'] },
  { judul: 'Sumber Daya Manusia', butir: ['jumlah pegawai', 'komposisi pegawai per pendidikan'] },
];

export function segmenBawaan(sector: string): HalamanDiminta[] {
  return (sector === 'pdam' ? SEGMEN_PDAM : SEGMEN_UMUM).map((h) => ({ ...h, butir: [...h.butir] }));
}

/**
 * Halaman untuk satu permintaan: daftar yang ditulis pengguna bila ada; bila
 * pengguna hanya meminta "beberapa halaman", segmentasi bawaan sektornya
 * (dipotong sesuai jumlah yang disebut); selain itu kosong (dibagi otomatis).
 */
export function halamanUntukPermintaan(prompt: string, sector: string): { halaman: HalamanDiminta[]; bawaan: boolean } {
  const tertulis = bacaHalamanDiminta(prompt);
  if (tertulis.length > 0) return { halaman: tertulis, bawaan: false };
  const minta = mintaBanyakHalaman(prompt);
  if (!minta) return { halaman: [], bawaan: false };
  const segmen = segmenBawaan(sector);
  return { halaman: typeof minta === 'number' ? segmen.slice(0, minta) : segmen, bawaan: true };
}
