/**
 * SUSUN SLIDE MODE PRESENTASI — mengubah daftar widget dashboard menjadi
 * rangkaian slide yang tiap slide-nya muat di SATU layar (tanpa scroll).
 *
 * MURNI (tanpa I/O) supaya bisa diuji tanpa browser.
 *
 * Aturan pengelompokan (pilihan user 2026-10-15):
 *  - Kartu KPI/bullet-target/gauge dikelompokkan bersama (satu slide "ringkasan").
 *  - Grafik sejenis dikelompokkan bersama (tren, komposisi, perbandingan).
 *  - Slide paling banyak memuat `MAKS_WIDGET_PER_SLIDE` widget supaya tidak
 *    sesak; sisanya dipecah ke slide berikutnya.
 *  - Tabel & narasi menutup (slide tersendiri / berpasangan).
 *
 * Jumlah slide menyesuaikan isi dashboard — bukan dipatok.
 */
import type { SlidePresentasi, WidgetSpec, WidgetType } from '../../types';

/** Maksimal widget dalam satu slide supaya tiap chart masih terbaca. */
export const MAKS_WIDGET_PER_SLIDE = 4;

/**
 * Versi skema slide. Naikkan angka ini bila aturan pengelompokan/narasi berubah:
 * slide lama yang tersimpan di dashboard akan dianggap basi dan disusun ulang
 * otomatis (lihat `PresentationMode`), supaya pengguna tidak melihat tata letak
 * versi lama setelah aplikasi diperbarui.
 */
export const VERSI_PRESENTASI = 2;

/** Kategori visual: menentukan pengelompokan slide. */
type Kelompok = 'kartu' | 'tren' | 'komposisi' | 'perbandingan' | 'tabel' | 'narasi';

function kelompok(type: WidgetType): Kelompok {
  if (['kpi', 'bullet-target', 'gauge'].includes(type)) return 'kartu';
  if (['line', 'area', 'trend-line', 'forecast', 'anomaly', 'dekomposisi', 'skenario', 'sensitivitas'].includes(type)) return 'tren';
  if (['donut', 'pie', 'treemap', 'funnel', 'waterfall', 'sankey', 'radar', 'heatmap'].includes(type)) return 'komposisi';
  if (type === 'table') return 'tabel';
  if (type === 'narasi') return 'narasi';
  return 'perbandingan'; // bar, hbar, combo, scatter, bubble, histogram, boxplot, cluster, map, gantt
}

/** Urutan kelompok di presentasi: ringkasan → tren → perbandingan → komposisi → tabel → narasi. */
const URUTAN: Kelompok[] = ['kartu', 'tren', 'perbandingan', 'komposisi', 'tabel', 'narasi'];

/** Judul manusiawi untuk slide tiap kelompok. */
const JUDUL: Record<Kelompok, string> = {
  kartu: 'Ringkasan Kinerja Utama',
  tren: 'Tren & Perkembangan',
  perbandingan: 'Perbandingan Kinerja',
  komposisi: 'Komposisi & Kontribusi',
  tabel: 'Rincian Angka',
  narasi: 'Kesimpulan & Catatan',
};

/** Pecah daftar jadi potongan berukuran `ukuran` (terakhir boleh lebih kecil). */
function potong<T>(daftar: T[], ukuran: number): T[][] {
  const hasil: T[][] = [];
  for (let i = 0; i < daftar.length; i += ukuran) hasil.push(daftar.slice(i, i + ukuran));
  return hasil;
}

/**
 * Susun slide dari widget. `judulDashboard` dipakai untuk slide pembuka opsional.
 * Mengembalikan array slide berurutan; tiap slide punya id stabil (`slide-N`).
 */
export function susunSlide(widgets: WidgetSpec[]): SlidePresentasi[] {
  const hidup = widgets.filter((w) => !w.dataKosong);
  if (hidup.length === 0) return [];

  // Kelompokkan sambil mempertahankan urutan asli di dalam kelompok.
  const peta = new Map<Kelompok, WidgetSpec[]>();
  for (const w of hidup) {
    const k = kelompok(w.type);
    peta.set(k, [...(peta.get(k) ?? []), w]);
  }

  const slides: SlidePresentasi[] = [];
  let no = 1;

  for (const k of URUTAN) {
    const anggota = peta.get(k);
    if (!anggota || anggota.length === 0) continue;

    // Kartu KPI boleh lebih banyak per slide (ringkas); grafik maksimal 4.
    const ukuran = k === 'kartu' ? Math.min(6, MAKS_WIDGET_PER_SLIDE + 2) : MAKS_WIDGET_PER_SLIDE;
    const bagian = potong(anggota, ukuran);

    bagian.forEach((isi, i) => {
      const jamak = bagian.length > 1;
      slides.push({
        id: `slide-${no++}`,
        judul: jamak ? `${JUDUL[k]} (${i + 1}/${bagian.length})` : JUDUL[k],
        widgetIds: isi.map((w) => w.id),
      });
    });
  }

  return slides;
}

/**
 * Narasi insight CADANGAN (dihitung dari data) saat RAG tidak tersedia atau
 * belum digenerate. TIDAK mengarang angka: hanya memakai angka yang sudah ada di
 * widget. Dipakai sebagai `insight` sementara supaya slide tidak pernah kosong.
 */
export function narasiInsight(w: WidgetSpec): string {
  if (w.dataKosong) return w.catatanData || 'Indikator ini belum ada di dokumen instansi.';

  if (w.kpi) {
    const v = w.kpi.value;
    const u = w.kpi.unit ? ` ${w.kpi.unit}` : '';
    const bagian: string[] = [`Nilai saat ini ${v}${u}`];
    if (typeof w.kpi.delta === 'number') {
      const arah = w.kpi.delta >= 0 ? 'naik' : 'turun';
      bagian.push(`${arah} ${Math.abs(w.kpi.delta)}% ${w.kpi.deltaLabel || 'dibanding periode sebelumnya'}`);
    }
    if (typeof w.kpi.target === 'number') {
      bagian.push(`target ${w.kpi.target}${u}`);
    }
    return bagian.join(', ') + '.';
  }

  const seri = w.chart?.series?.[0]?.data;
  const kat = w.chart?.xAxis;
  if (seri && seri.length > 0 && kat && kat.length === seri.length) {
    let iMax = 0;
    let iMin = 0;
    seri.forEach((n, i) => {
      if (n > seri[iMax]) iMax = i;
      if (n < seri[iMin]) iMin = i;
    });
    const u = w.chart?.unit ? ` ${w.chart.unit}` : '';
    if (seri[iMax] === seri[iMin]) {
      return `Nilai relatif merata di seluruh ${kat.length} titik data (${seri[iMax]}${u}).`;
    }
    return `Tertinggi di ${kat[iMax]} (${seri[iMax]}${u}), terendah di ${kat[iMin]} (${seri[iMin]}${u}).`;
  }

  if (w.table) return `Rincian ${w.table.rows.length} baris data pendukung.`;
  if (w.narasi?.text) return w.narasi.text;
  return '';
}
