import type { WidgetSpec } from '../../types';

/**
 * TATA LETAK "SATU HALAMAN" — hitungan murni (tanpa DOM) supaya bisa diuji.
 *
 * Dashboard harus tampil penuh dalam satu layar tanpa scroll. Untuk itu tinggi
 * tiap baris dihitung dari sisa tinggi layar dibagi jumlah baris. Jumlah baris
 * ditentukan dari lebar kartu — dan harus SAMA dengan cara CSS grid menempatkan
 * kartu (kalau sisa kolom tidak cukup, kartu pindah ke baris berikutnya).
 */

/** Lebar kanvas pada layar lebar, dalam kolom. */
export const KOLOM_KANVAS = 12;

/**
 * Lebar kartu dalam kolom (12 = selebar kanvas). Ambangnya mengikuti kelas
 * `col-span` di DashboardCanvas: ≥10 → 12, ≥7 → 8, ≥5 → 6, ≥4 → 4, ≥3 → 3, lain 2.
 */
export function lebarKolom(w: number | undefined): number {
  const lebar = w ?? 6;
  if (lebar >= 10) return 12;
  if (lebar >= 7) return 8;
  if (lebar >= 5) return 6;
  if (lebar >= 4) return 4;
  if (lebar >= 3) return 3;
  return 2;
}

/**
 * Jumlah baris yang dipakai grid 12 kolom untuk daftar widget ini.
 * Mengembalikan 0 kalau tidak ada widget (tidak ada yang perlu dipas-kan).
 */
export function hitungBarisKanvas(widgets: Pick<WidgetSpec, 'grid'>[]): number {
  if (widgets.length === 0) return 0;
  let baris = 1;
  let kolom = 0;
  for (const w of widgets) {
    const c = lebarKolom(w.grid?.w);
    if (kolom + c > KOLOM_KANVAS) {
      baris += 1;
      kolom = 0;
    }
    kolom += c;
  }
  return baris;
}

/**
 * Tinggi tiap baris supaya `baris` baris + jarak antar baris muat di `tinggiIsi`.
 * Minimal `barisMin` supaya grafik masih terbaca; kalau tidak cukup, pemanggil
 * memperkecil seluruh grid dengan `skala`.
 */
export function tinggiBaris(
  tinggiIsi: number,
  baris: number,
  jarak: number,
  barisMin: number
): { tinggi: number; skala: number } {
  if (baris <= 0 || tinggiIsi <= 0) return { tinggi: 0, skala: 1 };
  const ruangBaris = tinggiIsi - jarak * (baris - 1);
  const ideal = Math.floor(ruangBaris / baris);
  if (ideal >= barisMin) return { tinggi: ideal, skala: 1 };
  // Baris minimum pun tidak cukup → perkecil seluruh grid agar tetap satu layar.
  const tinggiGrid = baris * barisMin + jarak * (baris - 1);
  return { tinggi: barisMin, skala: Math.min(1, tinggiIsi / tinggiGrid) };
}
