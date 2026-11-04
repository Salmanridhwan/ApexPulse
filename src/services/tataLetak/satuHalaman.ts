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
 * Jumlah baris grid 12 kolom untuk daftar widget ini (pemasangan murni).
 * Mengembalikan 0 kalau tidak ada widget (tidak ada yang perlu dipas-kan).
 */
export function hitungBarisGrid(widgets: Pick<WidgetSpec, 'grid'>[]): number {
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
 * Tinggi kartu dalam satuan baris grid (`grid.h`). Dulu `grid.h` tidak pernah
 * dipakai kanvas: semua kartu satu baris setinggi sama, sehingga grafik 120 px
 * terpotong di kartu 84 px. Bawaan per tipe bila `grid.h` kosong.
 */
export function spanTinggi(w: Pick<WidgetSpec, 'grid'> & { type?: string }): number {
  const bawaan = w.type === 'kpi' || w.type === 'narasi' ? 2 : 4;
  const h = Number(w.grid?.h);
  return Math.max(2, Math.min(8, Number.isFinite(h) && h > 0 ? Math.round(h) : bawaan));
}

/**
 * Susunan tinggi grid: kartu dipasang mengikuti lebar (sama dengan CSS grid),
 * lalu SEMUA kartu dalam satu deret dibentangkan setinggi kartu tertinggi di
 * deret itu — supaya tidak ada lubang dan tinggi kartu = `span` satuan baris.
 */
export function susunTinggiGrid(widgets: Array<Pick<WidgetSpec, 'grid'> & { type?: string }>): { span: number[]; satuan: number } {
  const span: number[] = [];
  let mulai = 0;
  let kolom = 0;
  let satuan = 0;
  const tutupDeret = (akhir: number) => {
    if (akhir <= mulai) return;
    const tinggi = Math.max(...widgets.slice(mulai, akhir).map(spanTinggi));
    for (let i = mulai; i < akhir; i++) span[i] = tinggi;
    satuan += tinggi;
    mulai = akhir;
  };
  widgets.forEach((w, i) => {
    const c = lebarKolom(w.grid?.w);
    if (kolom + c > KOLOM_KANVAS) {
      tutupDeret(i);
      kolom = 0;
    }
    kolom += c;
  });
  tutupDeret(widgets.length);
  return { span, satuan };
}

/** Tinggi minimum satu satuan baris (px): kartu grafik 4 satuan ≈ 250 px, label sumbu terbaca. */
export const SATUAN_MIN = 56;

/**
 * Tinggi baris KPI dan satuan baris kartu lain untuk mode satu halaman.
 *
 * Kalau satuan minimum pun tidak muat di layar, kanvas DIGULIR (`gulir`), bukan
 * diperkecil: memperkecil grid membuat isi grafik yang punya ukuran minimum
 * terpotong oleh kartunya.
 */
export function tataSatuan(
  tinggiIsi: number,
  adaKpi: boolean,
  satuan: number,
  jarak: number,
  kpiMaks: number = TINGGI_KPI_MAKS
): { kpi: number; satuan: number; gulir: boolean } {
  const kpi = adaKpi ? Math.min(kpiMaks, Math.max(96, Math.round(tinggiIsi * 0.22))) : 0;
  if (satuan <= 0) return { kpi: adaKpi ? Math.min(kpiMaks, Math.max(0, tinggiIsi)) : 0, satuan: 0, gulir: false };
  const sisa = tinggiIsi - (adaKpi ? kpi + jarak : 0);
  const t = Math.floor((sisa - jarak * (satuan - 1)) / satuan);
  if (t >= SATUAN_MIN) return { kpi, satuan: t, gulir: false };
  return { kpi, satuan: SATUAN_MIN, gulir: true };
}

/**
 * Jumlah baris SELURUH kanvas.
 *
 * ATURAN KPI: kartu KPI tidak pernah dibagi ke dua baris — berapa pun jumlahnya
 * (maksimal 6), semuanya duduk dalam SATU baris di paling atas. Karena itu baris
 * KPI dihitung 1 baris tetap, lalu sisanya (grafik/tabel/narasi) dipas-kan biasa
 * di grid 12 kolom.
 *
 * Lebar tiap kartu KPI tidak lagi memakai `grid.w`, melainkan dibagi rata oleh
 * kanvas (`repeat(jumlahKpi, 1fr)`) — lihat `DashboardCanvas`.
 */
export function hitungBarisKanvas(widgets: Array<Pick<WidgetSpec, 'grid'> & { type?: string }>): number {
  const adaKpi = widgets.some((w) => w.type === 'kpi');
  const lain = widgets.filter((w) => w.type !== 'kpi');
  return (adaKpi ? 1 : 0) + hitungBarisGrid(lain);
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

/**
 * Batas tinggi baris KPI. Kartu KPI hanya berisi angka + selisih, jadi tidak
 * perlu ikut membesar: tanpa batas ini halaman yang isinya hanya KPI membuat
 * tiga kartu setinggi layar dengan ruang kosong di tengahnya.
 */
export const TINGGI_KPI_MAKS = 190;

/**
 * Tinggi baris KPI dan baris kartu lain untuk mode satu halaman. Baris KPI
 * dibatasi `TINGGI_KPI_MAKS`; sisa tinggi diberikan ke grafik/tabel.
 */
export function tataTinggiKanvas(
  tinggiIsi: number,
  adaKpi: boolean,
  barisLain: number,
  jarak: number,
  barisMin: number,
  kpiMaks: number = TINGGI_KPI_MAKS
): { kpi: number; baris: number; skala: number } {
  if (!adaKpi) {
    const t = tinggiBaris(tinggiIsi, barisLain, jarak, barisMin);
    return { kpi: 0, baris: t.tinggi, skala: t.skala };
  }
  if (barisLain === 0) return { kpi: Math.min(kpiMaks, Math.max(0, tinggiIsi)), baris: 0, skala: 1 };
  const rata = tinggiBaris(tinggiIsi, barisLain + 1, jarak, barisMin);
  if (rata.tinggi <= kpiMaks) return { kpi: rata.tinggi, baris: rata.tinggi, skala: rata.skala };
  const sisa = tinggiBaris(tinggiIsi - kpiMaks - jarak, barisLain, jarak, barisMin);
  return { kpi: kpiMaks, baris: sisa.tinggi, skala: sisa.skala };
}
