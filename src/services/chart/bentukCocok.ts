/**
 * BENTUK CHART YANG COCOK UNTUK SEBUAH BUTIR.
 *
 * Daftar bentuk diambil dari katalog Template Chart (`CHART_DEFAULT`), bukan
 * dari daftar pendek buatan sendiri. Yang ditawarkan hanya chart yang datanya
 * benar-benar tersedia di butir: kategori + deret angka (`seri`), satu nilai
 * tunggal (`nilai`), atau tabel.
 *
 * Chart yang butuh data yang tidak kita punya TIDAK ditawarkan walaupun ada di
 * katalog — mis. peta wilayah (butuh nama provinsi), jadwal gantt (butuh
 * tanggal), kotak sebaran (butuh kuartil), heatmap (butuh dua dimensi),
 * sankey (butuh pasangan alur), dan semua gauge/cincin (butuh target).
 */

import type { ButirData } from '../../types';
import { CHART_DEFAULT, type ChartId } from './chartDefault';

export interface BentukChart {
  /** Id chart katalog, mis. `bar-tegak-sorot`. */
  id: ChartId;
  /** Nama yang ditampilkan ke pengguna, sama dengan nama di Template Chart. */
  label: string;
}

/** Profil angka sebuah butir, dipakai untuk menyaring katalog. */
interface Profil {
  punyaNilai: boolean;
  jumlahTitik: number;
  jumlahSeri: number;
  semuaPositif: boolean;
  adaNegatif: boolean;
  total: number;
  /** Nilai 0–100, dipakai chart persen (daftar-progres). */
  persen: boolean;
  /** Rata-rata panjang label, dipakai memilih batang tegak atau mendatar. */
  rataLabel: number;
}

function profilDari(butir: ButirData): Profil {
  const seri = butir.seri || [];
  const utama = seri[0];
  const data = utama?.data || [];
  const semua = seri.flatMap((s) => s.data || []);
  const kat = utama?.kategori || [];
  const rataLabel = kat.length ? kat.reduce((n, k) => n + String(k).length, 0) / kat.length : 0;
  return {
    punyaNilai: butir.nilai !== undefined && butir.nilai !== null,
    jumlahTitik: data.length,
    jumlahSeri: seri.length,
    semuaPositif: semua.length > 0 && semua.every((v) => v >= 0),
    adaNegatif: semua.some((v) => v < 0),
    total: data.reduce((n, v) => n + (Number(v) || 0), 0),
    persen: data.length > 0 && data.every((v) => v >= 0 && v <= 100),
    rataLabel,
  };
}

/** Id chart yang boleh ditawarkan, urut seperti di Template Chart. */
const KANDIDAT: ChartId[] = [
  'kpi-kartu',
  'kpi-strip',
  'bar-tegak',
  'bar-tegak-sorot',
  'bar-kapsul',
  'bar-mendatar-peringkat',
  'daftar-progres',
  'bar-tumpuk',
  'combo-batang-garis',
  'garis-tren',
  'area-gradasi',
  'area-banding',
  'donat-tebal',
  'donat-tipis',
  'treemap-porsi',
  'alur-tahap',
  'corong-pipeline',
  'radar-aspek',
  'air-terjun',
  'titik-bersumbu',
  'tabel-ringkas',
];

/** Boleh atau tidaknya satu chart dipakai untuk profil data ini. */
function cocok(id: ChartId, p: Profil): boolean {
  const titik = p.jumlahTitik;
  const seri = p.jumlahSeri;
  switch (id) {
    // ── satu angka ──────────────────────────────────────────────────────────
    case 'kpi-kartu':
    case 'kpi-strip':
      return p.punyaNilai && titik === 0;

    // ── batang tegak ────────────────────────────────────────────────────────
    case 'bar-tegak':
    case 'bar-tegak-sorot':
      return titik >= 2 && titik <= 8 && p.rataLabel <= 11;
    case 'bar-kapsul':
      return titik >= 2 && seri <= 2 && titik <= 12;

    // ── batang mendatar ─────────────────────────────────────────────────────
    case 'bar-mendatar-peringkat':
      return titik >= 2;
    case 'daftar-progres':
      return titik >= 2 && p.persen;

    // ── dua seri ────────────────────────────────────────────────────────────
    case 'bar-tumpuk':
    case 'combo-batang-garis':
    case 'area-banding':
      return seri === 2 && titik >= 2;

    // ── tren ────────────────────────────────────────────────────────────────
    case 'garis-tren':
    case 'area-gradasi':
      return titik >= 3;

    // ── komposisi ───────────────────────────────────────────────────────────
    case 'donat-tebal':
    case 'donat-tipis':
      return seri === 1 && titik >= 2 && titik <= 8 && p.semuaPositif && p.total > 0;
    case 'treemap-porsi':
      return seri === 1 && titik >= 2 && titik <= 24 && p.semuaPositif && p.total > 0;
    case 'alur-tahap':
    case 'corong-pipeline':
      return seri === 1 && titik >= 3 && titik <= 12 && p.semuaPositif && p.total > 0;

    // ── lain-lain ───────────────────────────────────────────────────────────
    case 'radar-aspek':
      return seri === 1 && titik >= 3 && titik <= 12;
    case 'air-terjun':
      // Air terjun butuh penambah dan pengurang dalam satu deret.
      return seri === 1 && titik >= 3 && p.adaNegatif;
    case 'titik-bersumbu':
      return titik >= 2 && titik <= 40;

    // ── tabel ───────────────────────────────────────────────────────────────
    case 'tabel-ringkas':
      return titik > 0;

    default:
      return false;
  }
}

/**
 * Bentuk yang cocok untuk SATU butir.
 *
 * `terpilih` boleh berisi banyak butir: hasilnya irisan, karena satu pilihan
 * bentuk harus bisa dipakai semua butir yang dicentang.
 */
export function bentukCocok(terpilih: ButirData[]): BentukChart[] {
  if (terpilih.length === 0) return [];
  const profil = terpilih.map(profilDari);
  return KANDIDAT.filter((id) => profil.every((p) => cocok(id, p))).map((id) => ({
    id,
    label: CHART_DEFAULT[id]?.nama || id,
  }));
}

/** Nama chart katalog untuk pesan/ringkasan. */
export function namaBentuk(id: string): string {
  return CHART_DEFAULT[id as ChartId]?.nama || id;
}
