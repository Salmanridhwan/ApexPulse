/**
 * Gaya tampilan widget: palet warna, font, ketebalan garis, radius batang.
 *
 * Kenapa post-processing, bukan mengedit tiap tipe chart:
 * `chartOptions.ts` punya puluhan tipe dengan 60+ `fontSize` dan puluhan warna
 * yang tersebar. Mengubahnya satu per satu berarti setiap tipe baru wajib ingat
 * menambahkan gaya — pasti ada yang terlewat. Di sini gaya diterapkan SEKALI
 * pada hasil akhir `EChartsOption`, jadi SEMUA tipe (termasuk yang ditambah nanti)
 * otomatis ikut, dan tidak ada tipe yang perlu tahu soal fitur ini.
 *
 * Semua fungsi murni dan tidak mengubah objek masukan (dibuat salinan dangkal
 * per simpul), supaya opsi yang sudah di-cache ECharts tidak tercemar.
 */
import type { EChartsOption } from 'echarts';
import type { WidgetStyle } from '../../types';

/** Font yang benar-benar dimuat aplikasi (lihat index.html). */
export const FONT_TERSEDIA = ['Inter', 'JetBrains Mono'] as const;
export type FontTersedia = (typeof FONT_TERSEDIA)[number];

/** Font bawaan untuk chart (sebelumnya 'Plus Jakarta Sans' yang TIDAK dimuat). */
export const FONT_BAWAAN: FontTersedia = 'Inter';

/**
 * Palet siap pakai. Dipilih agar tetap terbaca di mode terang maupun gelap dan
 * tetap bisa dibedakan oleh pengguna dengan buta warna (bukan hanya beda rona,
 * tapi juga beda terang).
 */
export const PALET: Record<NonNullable<WidgetStyle['palette']>, { label: string; warna: string[] }> = {
  default: { label: 'Bawaan', warna: [] }, // kosong = pakai palet tema
  brand: { label: 'Biru (Brand)', warna: ['#1fa6cc', '#0f6b85', '#7f80d8', '#38c6e2', '#5b9bd5', '#0e7490'] },
  hijau: { label: 'Hijau', warna: ['#0f7a53', '#3fd29a', '#12805c', '#6ee7b7', '#065f46', '#34d399'] },
  ungu: { label: 'Ungu', warna: ['#7f80d8', '#9a9be8', '#6d28d9', '#c4b5fd', '#4c1d95', '#a78bfa'] },
  oranye: { label: 'Oranye', warna: ['#8f5e08', '#f59e0b', '#ea580c', '#fbbf24', '#b45309', '#fb923c'] },
  hangat: { label: 'Hangat', warna: ['#c62f22', '#ee4b32', '#8f5e08', '#f59e0b', '#9a3412', '#fca5a5'] },
  sejuk: { label: 'Sejuk', warna: ['#0f6b85', '#1fa6cc', '#0e7490', '#38c6e2', '#155e75', '#7fdcf0'] },
  monokrom: { label: 'Monokrom', warna: ['#1a1d1f', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db', '#374151'] },
};

/** Urutan palet untuk ditampilkan di editor. */
export const URUTAN_PALET: Array<NonNullable<WidgetStyle['palette']>> = [
  'default', 'brand', 'hijau', 'ungu', 'oranye', 'hangat', 'sejuk', 'monokrom',
];

/**
 * Buang field gaya yang kosong/tidak berarti.
 *
 * Dipakai bersama oleh editor per-widget dan modal gaya global supaya aturannya
 * satu: field kosong dihapus (bukan disimpan sebagai undefined) agar widget
 * kembali memakai bawaan tema, dan hasil simpan tidak menyimpan sampah.
 */
export function bersihkanGaya(style: WidgetStyle): WidgetStyle {
  const keluar: WidgetStyle = { ...style };
  for (const k of Object.keys(keluar) as Array<keyof WidgetStyle>) {
    const v = keluar[k];
    if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) delete keluar[k];
  }
  return keluar;
}

/**
 * Tipe widget yang BENAR-BENAR merender gaya.
 *
 * Tabel dan narasi tidak menggambar warna/font, jadi gaya sengaja TIDAK
 * diterapkan ke keduanya: menyimpan gaya di sana hanya menambah data mati dan
 * membuat pesan "menimpa N widget" jadi tidak jujur.
 */
export function tipePunyaGaya(type: string): boolean {
  return !['table', 'narasi'].includes(type);
}

/** Ukuran font bawaan yang jadi acuan penskalaan (nilai `fontSize` paling umum). */
const FONT_ACUAN = 10;

/** Ambil daftar warna untuk sebuah palet; kosong berarti pakai bawaan tema. */
export function warnaPalet(palette?: WidgetStyle['palette']): string[] {
  if (!palette || palette === 'default') return [];
  return PALET[palette]?.warna ?? [];
}

/**
 * Apakah gaya ini benar-benar mengubah apa pun?
 * Dipakai supaya widget tanpa gaya tidak menjalani post-processing (hemat).
 */
export function adaGaya(style?: WidgetStyle): boolean {
  if (!style) return false;
  return Boolean(
    (style.palette && style.palette !== 'default') ||
      style.warnaSeri?.length ||
      style.font ||
      style.fontUkuran ||
      style.garisTebal ||
      style.batangRadius ||
      style.kartu
  );
}

/**
 * Salinan DALAM untuk pohon opsi ECharts.
 *
 * Harus dalam, bukan dangkal: `remapWarna`/`terapkanFont` mengubah objek
 * bersarang (mis. `series[0].itemStyle.color`). Dengan salinan dangkal, objek
 * bersarang itu masih dipakai bersama opsi asli — opsi asli ikut berubah, dan
 * karena ECharts meng-cache opsi, hasilnya warna/font bisa "menempel" ke
 * widget lain yang memakai opsi asli.
 *
 * Fungsi (formatter tooltip) dan instance non-biasa (Date, kelas ECharts)
 * dibiarkan apa adanya — disalin referensinya, bukan diduplikasi.
 */
function salinDalam<T>(nilai: T): T {
  if (Array.isArray(nilai)) return nilai.map((n) => salinDalam(n)) as unknown as T;
  if (nilai && typeof nilai === 'object') {
    const proto = Object.getPrototypeOf(nilai);
    // Hanya objek biasa yang diduplikasi; sisanya (Date, kelas, dsb) dibiarkan.
    if (proto === Object.prototype || proto === null) {
      const keluar: Record<string, unknown> = {};
      for (const k of Object.keys(nilai as object)) {
        keluar[k] = salinDalam((nilai as Record<string, unknown>)[k]);
      }
      return keluar as unknown as T;
    }
  }
  return nilai;
}

/**
 * Terapkan font + ukuran font ke SELURUH pohon opsi ECharts.
 *
 * Dijalankan rekursif karena `textStyle` muncul di banyak tempat: tooltip,
 * sumbu, legenda, label seri, judul, dan subjudul tiap tipe chart.
 *
 * Heuristik "punya fontSize = ini objek gaya teks" dipakai supaya font ikut
 * terpasang pada objek teks yang belum menyebut fontFamily sama sekali —
 * kalau hanya menimpa fontFamily yang sudah ada, sebagian besar label akan
 * tetap memakai font bawaan browser.
 */
function terapkanFont(simpul: any, font: string, rasio: number): void {
  if (!simpul || typeof simpul !== 'object') return;

  if (Array.isArray(simpul)) {
    for (const item of simpul) terapkanFont(item, font, rasio);
    return;
  }

  const punyaFontSize = typeof simpul.fontSize === 'number';
  const punyaFontFamily = typeof simpul.fontFamily === 'string';

  if (punyaFontFamily || punyaFontSize) {
    simpul.fontFamily = font;
  }
  // Skalakan fontSize relatif terhadap acuan; nilai >30 (mis. angka besar di
  // kartu) dibiarkan agar tidak meledak.
  if (punyaFontSize && simpul.fontSize <= 30) {
    const baru = Math.round(simpul.fontSize * rasio * 10) / 10;
    simpul.fontSize = Math.max(7, Math.min(40, baru));
  }

  for (const kunci of Object.keys(simpul)) {
    const nilai = simpul[kunci];
    if (nilai && typeof nilai === 'object') terapkanFont(nilai, font, rasio);
  }
}

/**
 * Ganti SEMUA warna tema menjadi warna palet pilihan.
 *
 * Ini perlu karena `chartOptions.ts` memasang warna secara eksplisit pada
 * banyak seri (`itemStyle.color = T.series[n]`). Tanpa remap, mengubah
 * `option.color` saja tidak berpengaruh — seri tetap memakai warna tema.
 * Warna dicocokkan berdasarkan INDEKS di palet tema, jadi seri ke-n memakai
 * warna ke-n dari palet pilihan.
 */
function remapWarna(simpul: any, peta: Map<string, string>): void {
  if (!simpul || typeof simpul !== 'object') return;

  if (Array.isArray(simpul)) {
    for (const item of simpul) remapWarna(item, peta);
    return;
  }

  for (const kunci of Object.keys(simpul)) {
    const nilai = simpul[kunci];
    if (typeof nilai === 'string') {
      const ganti = peta.get(nilai.toLowerCase());
      if (ganti) simpul[kunci] = ganti;
    } else if (nilai && typeof nilai === 'object') {
      remapWarna(nilai, peta);
    }
  }
}

/** Buat peta warna tema -> warna palet berdasarkan indeks. */
function petaWarna(temaSeries: string[], palet: string[]): Map<string, string> {
  const peta = new Map<string, string>();
  temaSeries.forEach((warnaTema, i) => {
    peta.set(warnaTema.toLowerCase(), palet[i % palet.length]);
  });
  return peta;
}

/**
 * Sesuaikan ketebalan garis seri dan radius batang.
 *
 * Ketebalan hanya menyentuh `lineStyle.width` pada seri garis/area — sengaja
 * TIDAK menyentuh garis sumbu/grid, karena itu bagian kerangka, bukan data.
 */
function terapkanBentuk(option: any, style: WidgetStyle): void {
  const seri = option.series;
  const daftar = Array.isArray(seri) ? seri : seri ? [seri] : [];

  for (const s of daftar) {
    if (!s || typeof s !== 'object') continue;

    const tipe = String(s.type || '');
    const garis = tipe === 'line' || tipe === 'scatter' || tipe === 'effectScatter';

    if (garis && typeof style.garisTebal === 'number') {
      if (!s.lineStyle) s.lineStyle = {};
      s.lineStyle.width = style.garisTebal;
      // Titik data ikut menyesuaikan supaya tidak tenggelam di garis tebal.
      if (!s.symbolSize) s.symbolSize = Math.max(4, style.garisTebal + 4);
    }

    if ((tipe === 'bar' || tipe === 'pictorialBar') && typeof style.batangRadius === 'number') {
      if (!s.itemStyle) s.itemStyle = {};
      s.itemStyle.borderRadius = style.batangRadius;
    }
  }
}

/**
 * Terapkan gaya pengguna ke opsi ECharts. Mengembalikan opsi BARU; masukan tidak diubah.
 *
 * Urutan penting: warna dipasang lebih dulu, lalu font/ukuran, lalu bentuk.
 */
export function terapkanGaya(
  option: EChartsOption,
  style?: WidgetStyle,
  temaSeries?: string[]
): EChartsOption {
  if (!adaGaya(style)) return option;
  const s = style as WidgetStyle;

  const hasil: any = salinDalam(option);

  // 1. WARNA
  const dariPalet = warnaPalet(s.palette);
  if (dariPalet.length > 0) {
    // Palet bawaan ECharts (untuk seri yang tidak menyebut warna sendiri)…
    hasil.color = dariPalet;
    // …DAN remap warna tema yang sudah dipasang eksplisit di tiap seri.
    if (temaSeries?.length) {
      remapWarna(hasil, petaWarna(temaSeries, dariPalet));
    }
  }

  // Warna kustom per-seri menimpa palet. Berlaku untuk seri mana pun yang punya itemStyle.
  if (Array.isArray(s.warnaSeri) && s.warnaSeri.length > 0) {
    const seri = hasil.series;
    const daftar = Array.isArray(seri) ? seri : seri ? [seri] : [];
    daftar.forEach((ser: any, i: number) => {
      const warna = s.warnaSeri?.[i];
      if (!warna || !ser || typeof ser !== 'object') return;
      if (!ser.itemStyle) ser.itemStyle = {};
      ser.itemStyle.color = warna;
      // Garis tren/area memakai lineStyle terpisah.
      if (ser.type === 'line' || ser.type === 'scatter') {
        if (!ser.lineStyle) ser.lineStyle = {};
        ser.lineStyle.color = warna;
      }
    });
  }

  // 2. FONT & UKURAN — satu lintasan rekursif untuk seluruh pohon opsi.
  const font = s.font || FONT_BAWAAN;
  const rasio = s.fontUkuran ? s.fontUkuran / FONT_ACUAN : 1;
  // Font selalu diterapkan (agar 'Plus Jakarta Sans' yang tak dimuat diganti Inter).
  terapkanFont(hasil, font, rasio);

  // 3. BENTUK — ketebalan garis & radius batang.
  terapkanBentuk(hasil, s);

  return hasil as EChartsOption;
}
