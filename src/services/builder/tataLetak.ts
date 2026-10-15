/**
 * TATA LETAK KANVAS — menyusun URUTAN dan LEBAR widget supaya kanvas rapi
 * (tidak ada baris bercelah) dan enak dibaca: kartu ringkas di atas, grafik di
 * tengah, tabel/narasi menutup.
 *
 * MURNI (tanpa I/O) supaya bisa diuji tanpa server.
 *
 * Latar masalah: Jalur A menerima `grid` dari beberapa sumber yang saling
 * bertabrakan — `fromJson` memakai koordinat `x/y` dari model apa adanya (model
 * hampir selalu mengirim `x:0, y:0`), sementara widget pelengkap katalog selalu
 * `{x:0, y:0}`. Akibatnya widget menumpuk/bercelah. Kanvas sendiri mengabaikan
 * `x/y` dan menentukan tata letak dari URUTAN array + LEBAR (`grid.w` → colSpan
 * 12 kolom), jadi di sinilah tempat memperbaikinya: susun ulang urutan dan
 * tetapkan lebar yang benar-benar mengemas 12 kolom.
 */
import type { WidgetSpec, WidgetType } from '../../types';

/** Kartu ringkas: selalu di baris teratas. */
const KARTU: WidgetType[] = ['kpi', 'bullet-target', 'gauge'];

/** Komposisi/distribusi: cukup setengah lebar, bisa berpasangan. */
const SETENGAH: WidgetType[] = [
  'donut', 'pie', 'funnel', 'treemap', 'radar', 'histogram', 'boxplot',
  'trend-line', 'forecast', 'anomaly', 'cluster', 'dekomposisi', 'skenario', 'sensitivitas',
];

/** Lebar kolom (dari 12) yang paling pas untuk tiap keluarga tipe. */
function lebarKeluarga(type: WidgetType): number {
  if (KARTU.includes(type)) return 4; // 3 kartu per baris
  if (type === 'table' || type === 'narasi') return 6; // bisa berpasangan
  if (SETENGAH.includes(type)) return 6;
  return 12; // tren/perbandingan deret, matriks, peta, gantt → lebar penuh
}

/** Urutan zona: kartu (0) → grafik (1) → tabel (2) → narasi (3). */
function zona(type: WidgetType): number {
  if (KARTU.includes(type)) return 0;
  if (type === 'table') return 2;
  if (type === 'narasi') return 3;
  return 1;
}

/** Bagi 12 kolom rata ke `n` item, jumlahnya TEPAT 12. */
function lebarRata(n: number): number[] {
  if (n <= 0) return [];
  const dasar = Math.floor(12 / n);
  const sisa = 12 - dasar * n;
  return Array.from({ length: n }, (_, i) => dasar + (i < sisa ? 1 : 0));
}

/** Bagi sejumlah kartu jadi baris-baris yang masing-masing mengisi 12 kolom rata. */
function ukuranBarisKartu(jumlah: number): number[] {
  const ukuran: number[] = [];
  let sisa = jumlah;
  while (sisa > 0) {
    let k: number;
    if (sisa <= 4) k = sisa;          // 1–4 kartu → satu baris
    else if (sisa - 4 === 1) k = 3;   // hindari menyisakan 1 kartu sendirian
    else k = 4;                        // 4 kartu per baris
    ukuran.push(k);
    sisa -= k;
  }
  return ukuran;
}

/** Kemas daftar NON-kartu jadi baris yang menjumlah tepat 12 kolom. */
function kemasBaris(daftar: WidgetSpec[]): { isi: WidgetSpec[]; lebar: number[] }[] {
  const baris: { isi: WidgetSpec[]; lebar: number[] }[] = [];
  let cur: WidgetSpec[] = [];
  let sisa = 12;

  const tutup = () => {
    if (cur.length === 0) return;
    // Baris belum penuh → lebarkan rata supaya tidak ada celah (termasuk baris
    // berisi satu widget, yang menjadi lebar penuh).
    const lebar =
      sisa > 0
        ? lebarRata(cur.length)
        : cur.map((w) => Math.min(12, Math.max(2, lebarKeluarga(w.type))));
    baris.push({ isi: cur, lebar });
    cur = [];
    sisa = 12;
  };

  for (const w of daftar) {
    const lebar = Math.min(12, Math.max(2, lebarKeluarga(w.type)));
    if (lebar > sisa && cur.length > 0) tutup();
    cur.push(w);
    sisa -= lebar;
    if (sisa <= 0) tutup();
  }
  tutup();
  return baris;
}

/** Susun satu baris jadi WidgetSpec dengan y & tinggi seragam. */
function rakitBaris(
  isi: WidgetSpec[],
  lebar: number[],
  y: number
): { widgets: WidgetSpec[]; tinggi: number } {
  // Tinggi baris = tinggi TERTINGGI anggotanya, lalu SEMUA disamakan. Kalau tidak
  // disamakan, widget yang lebih tinggi menimpa baris berikutnya (tumpang tindih).
  const tinggi = Math.max(...isi.map((w) => w.grid?.h || (KARTU.includes(w.type) ? 3 : 4)));
  let x = 0;
  const widgets = isi.map((w, i) => {
    const ww = Math.min(12, Math.max(2, lebar[i] ?? 12));
    const kotak = { x, y, w: ww, h: tinggi };
    x += ww;
    return { ...w, grid: kotak };
  });
  return { widgets, tinggi };
}

/**
 * Rapikan tata letak: kembalikan daftar widget baru dengan URUTAN zonal dan
 * `grid` yang mengemas 12 kolom tanpa celah horizontal. Urutan relatif dalam
 * satu zona dipertahankan (stabil) supaya isi dashboard tidak teracak.
 */
export function rapikanTataLetak(widgets: WidgetSpec[]): WidgetSpec[] {
  if (widgets.length === 0) return widgets;

  // Urut stabil menurut zona.
  const urut = widgets
    .map((w, i) => ({ w, i }))
    .sort((a, b) => zona(a.w.type) - zona(b.w.type) || a.i - b.i)
    .map((x) => x.w);

  const kartu = urut.filter((w) => KARTU.includes(w.type));
  const lain = urut.filter((w) => !KARTU.includes(w.type));

  // Dalam zona grafik, taruh yang LEBAR PENUH lebih dulu, baru yang setengah
  // lebar. Dengan begitu widget setengah-lebar (donut, radar, pie, …) kebagian
  // baris yang sama dan berpasangan — bukan melebar sendirian karena didahului
  // grafik lebar penuh.
  const grafik = lain.filter((w) => zona(w.type) === 1);
  const sisanya = lain.filter((w) => zona(w.type) !== 1);
  grafik.sort((a, b) => lebarKeluarga(b.type) - lebarKeluarga(a.type));
  const lain2 = [...grafik, ...sisanya];

  const hasil: WidgetSpec[] = [];
  let y = 0;

  // ── Zona kartu: bagi rata (3 atau 4 per baris) ─────────────────────────────
  let posKartu = 0;
  for (const n of ukuranBarisKartu(kartu.length)) {
    const isi = kartu.slice(posKartu, posKartu + n);
    posKartu += n;
    const { widgets: rakit, tinggi } = rakitBaris(isi, lebarRata(n), y);
    hasil.push(...rakit);
    y += tinggi;
  }

  // ── Zona lain: kemas per baris 12 kolom ────────────────────────────────────
  for (const { isi, lebar } of kemasBaris(lain2)) {
    const { widgets: rakit, tinggi } = rakitBaris(isi, lebar, y);
    hasil.push(...rakit);
    y += tinggi;
  }

  return hasil;
}
