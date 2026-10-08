/**
 * Tema KARTU widget: warna latar kartu + warna teks/border yang tetap terbaca.
 *
 * Kenapa warna kartu dihitung, bukan disimpan sebagai daftar pasangan tetap:
 * pengguna boleh memilih warna latar apa pun dari color picker. Kalau warna
 * teksnya ikut disimpan tetap (mis. selalu gelap), kartu berlatar gelap jadi
 * tak terbaca. Di sini tiap warna kartu diturunkan dari latarnya dengan
 * perhitungan kontras WCAG, sehingga kombinasi apa pun tetap terbaca.
 *
 * Modul ini MURNI (tanpa React/DOM) supaya bisa diuji langsung lewat `tsx`.
 */

/** Pilihan warna kartu siap pakai (label + nilai dasar). */
export const KARTU_PRESET: Record<string, { label: string; warna: string }> = {
  bawaan: { label: 'Bawaan', warna: '' },
  biru: { label: 'Biru Muda', warna: '#e6f6fb' },
  hijau: { label: 'Hijau Muda', warna: '#e7f6ef' },
  ungu: { label: 'Ungu Muda', warna: '#eeecfb' },
  oranye: { label: 'Krem', warna: '#fdf3e3' },
  kelabu: { label: 'Kelabu', warna: '#f1f3f6' },
  gelap: { label: 'Gelap', warna: '#1f2329' },
};

/** Urutan tampil di editor. */
export const URUTAN_KARTU = ['bawaan', 'biru', 'hijau', 'ungu', 'oranye', 'kelabu', 'gelap'] as const;

export type KartuId = (typeof URUTAN_KARTU)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Konversi & kontras (WCAG)
// ─────────────────────────────────────────────────────────────────────────────

function keRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const keHex = (rgb: [number, number, number]) =>
  '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

/** Luminansi relatif WCAG (linearisasi sRGB) — bukan rata-rata kanal. */
export function luminansi(hex: string): number {
  const lin = (n: number) => {
    const s = n / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = keRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Rasio kontras WCAG antara dua warna (1..21). */
export function kontras(a: string, b: string): number {
  const la = luminansi(a);
  const lb = luminansi(b);
  const terang = Math.max(la, lb);
  const gelap = Math.min(la, lb);
  return (terang + 0.05) / (gelap + 0.05);
}

/** Apakah latar ini gelap? Dipakai memilih arah turunan warna. */
export function latarGelap(hex: string): boolean {
  return luminansi(hex) < 0.18;
}

/** Campur warna `a` ke arah `b` sebesar `t` (0..1). */
function campur(a: string, b: string, t: number): string {
  const [r1, g1, b1] = keRgb(a);
  const [r2, g2, b2] = keRgb(b);
  return keHex([r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t]);
}

/**
 * Pilih warna teks dengan kontras terbaik terhadap latar.
 *
 * Dua kandidat (tinta gelap & tinta terang) diuji, lalu dipilih yang rasionya
 * lebih tinggi. Kalau keduanya di bawah ambang nyaman, yang terbaik tetap
 * dipakai dan dilaporkan `peringatan` supaya UI bisa memperingatkan pengguna
 * (warna latar terlalu "menengah" — mis. abu tengah — memang sulit dibaca).
 */
function pilihTinta(latar: string, kandidat: string[], minKontras: number) {
  let terbaik = kandidat[0];
  let rasioTerbaik = 0;
  for (const k of kandidat) {
    const r = kontras(latar, k);
    if (r > rasioTerbaik) {
      rasioTerbaik = r;
      terbaik = k;
    }
  }
  return { warna: terbaik, rasio: rasioTerbaik, peringatan: rasioTerbaik < minKontras };
}

/** Warna teks standar untuk mode terang & gelap (sama dengan token tema). */
const TINTA_TERANG = '#1a1d1f'; // --color-ink mode terang
const TINTA_GELAP = '#f2f4f7'; // --color-ink mode gelap

/** Variabel CSS yang ditimpa di dalam kartu supaya SEMUA anaknya ikut berubah. */
export interface KartuVars {
  '--color-surface': string;
  '--color-surface-2': string;
  '--color-line': string;
  '--color-line-strong': string;
  '--color-ink': string;
  '--color-ink-2': string;
  '--color-ink-3': string;
  /** Warna teks chart (sumbu, legenda, label) — dipakai chartTheme. */
  '--chart-ink': string;
  '--chart-muted': string;
  '--chart-grid': string;
}

export interface KartuTema {
  /** Warna latar kartu (hex). */
  latar: string;
  /** Variabel CSS untuk ditempel sebagai `style` pada elemen kartu. */
  vars: KartuVars;
  /** Apakah latar gelap (chart perlu warna teks terang). */
  gelap: boolean;
  /** Peringatan bila kontras teks di bawah ambang nyaman. */
  peringatanKontras?: string;
}

/**
 * Apakah string ini warna kartu yang sah (hex)?
 *
 * Dipakai bersama oleh `temaKartu`, `chartTheme`, dan `WidgetCard` supaya
 * "tidak memilih warna" dan "warna tidak sah" diperlakukan SAMA: pakai tema
 * bawaan. Tanpa pemeriksaan bersama, nilai sampah masih mengubah warna teks
 * chart padahal latarnya tidak berubah.
 */
export function warnaKartuValid(warna?: string): boolean {
  return Boolean(warna && /^#[0-9a-f]{3,8}$/i.test(warna.trim()));
}

/** Warna latar kartu bawaan per mode tema (dipakai saat pengguna tidak memilih). */
export function latarBawaan(mode: 'light' | 'dark'): string {
  return mode === 'dark' ? '#171a1f' : '#ffffff';
}

/**
 * Hitung tema kartu dari warna latar pilihan pengguna.
 *
 * Semua warna turunan (border, teks sekunder, grid chart) dihitung dari latar
 * sehingga satu warna pilihan menghasilkan kartu yang konsisten — dan tetap
 * terbaca, karena teksnya dipilih berdasarkan rasio kontras, bukan asumsi.
 */
export function temaKartu(warna?: string, mode: 'light' | 'dark' = 'light'): KartuTema {
  const dipakai = warnaKartuValid(warna);
  const latar = dipakai ? (warna as string).trim() : latarBawaan(mode);
  const gelap = latarGelap(latar);

  // Arah campuran: latar terang digelapkan, latar gelap diterangkan.
  const ujung = gelap ? '#ffffff' : '#000000';

  const tinta = pilihTinta(latar, gelap ? [TINTA_GELAP, TINTA_TERANG] : [TINTA_TERANG, TINTA_GELAP], 4.5);
  // Teks sekunder: tinta yang sama, dicampur ke arah latar supaya tetap lembut
  // tapi TIDAK turun di bawah ambang kontras 4.5:1 (batas aman teks kecil).
  const campurKe = gelap ? 0.22 : 0.32;
  const tinta2 = campur(tinta.warna, latar, campurKe);
  const tinta3 = campur(tinta.warna, latar, gelap ? 0.34 : 0.46);

  const vars: KartuVars = {
    '--color-surface': latar,
    '--color-surface-2': campur(latar, ujung, gelap ? 0.08 : 0.045),
    '--color-line': campur(latar, ujung, gelap ? 0.16 : 0.1),
    '--color-line-strong': campur(latar, ujung, gelap ? 0.26 : 0.18),
    '--color-ink': tinta.warna,
    '--color-ink-2': tinta2,
    '--color-ink-3': tinta3,
    '--chart-ink': tinta.warna,
    '--chart-muted': tinta2,
    '--chart-grid': campur(latar, ujung, gelap ? 0.16 : 0.1),
  };

  return {
    latar,
    vars,
    gelap,
    peringatanKontras: tinta.peringatan
      ? `Kontras teks hanya ${tinta.rasio.toFixed(1)}:1 — pilih warna latar yang lebih terang atau lebih gelap.`
      : undefined,
  };
}
