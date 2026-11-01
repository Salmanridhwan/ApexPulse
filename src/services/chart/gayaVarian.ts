/**
 * GAYA TIAP VARIAN KATALOG CHART.
 *
 * Satu chart punya enam wajah: default (netral), ringkasan (oranye), analitik
 * (biru), trafik (cyan), kaca (kartu bening di atas latar hangat), dan tirta
 * (laut dalam dengan kartu bening gelap, khas BUMD air minum), lalu lima gaya
 * umum dari tren desain: aurora (gradasi bercahaya), neon (kisi gelap, huruf
 * mono), blok (neubrutalism: garis tebal, bayangan keras), bento (pastel,
 * sudut besar), dan koran (editorial Swiss: kertas, serif, satu aksen merah). File ini
 * HANYA berisi nilai desain. Tidak ada bentuk grafik di sini, jadi menambah wajah baru cukup menambah satu entri.
 *
 * Aturan: warna, gradasi, sudut, dan ketebalan boleh berbeda. Struktur data
 * tidak boleh berbeda, karena chart yang sama harus bisa berpindah wajah tanpa
 * mengambil data ulang.
 */

export type Varian =
  | 'default'
  | 'ringkasan'
  | 'analitik'
  | 'trafik'
  | 'kaca'
  | 'tirta'
  | 'aurora'
  | 'neon'
  | 'blok'
  | 'bento'
  | 'koran';

export const VARIAN: Varian[] = ['default', 'ringkasan', 'analitik', 'trafik', 'kaca', 'tirta', 'aurora', 'neon', 'blok', 'bento', 'koran'];

export interface GayaVarian {
  /** Nama template dashboard dan katalog chart. Satu nama untuk keduanya. */
  nama: string;
  /** Sebutan lama yang menjelaskan fungsinya, ditampilkan sebagai keterangan. */
  sebutan: string;
  aksen: string;
  aksen2: string;
  latar: string;
  kartu: string;
  kartu2: string;
  garis: string;
  teks: string;
  teks2: string;
  teks3: string;
  palet: string[];
  hijau: string;
  merah: string;
  /** Arah gradasi batang: 'y' tegak, 'x' mendatar. */
  gradasi: 'x' | 'y';
  /** Kepekatan ujung gradasi, 0 sampai 1. */
  gradasiUjung: number;
  sudut: number;
  tebalGaris: number;
  /** Garis tipis menelusuri nilai batang. */
  garisTren: boolean;
  warnaTren: string;
  /** Label angka berlatar pil gelap. */
  labelPil: boolean;
  /** Nilai tertinggi disorot lebih terang. */
  sorotPuncak: boolean;
  /** Cincin donat memakai sudut membulat dan bayangan. */
  donatTebal: boolean;
  /**
   * Latar halaman untuk CSS (boleh gradasi). Kosong = `latar`. `latar` sendiri
   * harus warna polos karena dipakai ECharts sebagai warna garis tepi.
   */
  latarCss?: string;
  /** Kartu bening: latar kartu tembus pandang dan mengaburkan latar di belakangnya. */
  kaca?: boolean;
  /**
   * Warna padat yang setara dengan kartu bening, dipakai untuk menghitung warna
   * tinta (teks) karena warna rgba tidak bisa diukur kontrasnya.
   */
  padanan?: string;
  /** Garis tepi kartu yang tegas, mis. neubrutalism. Kosong = tepi tipis biasa. */
  tepi?: { tebal: number; warna: string; bayangan: string };
  /** Jari-jari sudut kartu dalam px. Kosong = bawaan aplikasi. */
  sudutKartu?: number;
  /** Keluarga huruf kartu (CSS font-family). Kosong = huruf aplikasi. */
  huruf?: string;
}

export const GAYA: Record<Varian, GayaVarian> = {
  default: {
    nama: 'Default',
    sebutan: 'Netral',
    aksen: '#2563eb',
    aksen2: '#3b82f6',
    latar: '#ffffff',
    kartu: '#ffffff',
    kartu2: '#f1f5f9',
    garis: '#e2e8f0',
    teks: '#1a1d1f',
    teks2: '#4b5563',
    teks3: '#6b7280',
    palet: ['#2563eb', '#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981'],
    hijau: '#16a34a',
    merah: '#dc2626',
    gradasi: 'y',
    gradasiUjung: 0.55,
    sudut: 3,
    tebalGaris: 2,
    garisTren: false,
    warnaTren: '#64748b',
    labelPil: false,
    sorotPuncak: false,
    donatTebal: false,
  },
  ringkasan: {
    nama: 'Pijar',
    sebutan: 'Ringkasan Eksekutif',
    aksen: '#ff8a1f',
    aksen2: '#ffb066',
    latar: '#0a0a0b',
    kartu: '#141518',
    kartu2: '#1b1d21',
    garis: '#26282d',
    teks: '#f5f6f7',
    teks2: '#b7bdc6',
    teks3: '#8b929c',
    palet: ['#ff8a1f', '#2dd4bf', '#a78bfa', '#f5a524', '#f472b6'],
    hijau: '#22c55e',
    merah: '#ef4444',
    gradasi: 'y',
    gradasiUjung: 0.16,
    sudut: 4,
    tebalGaris: 2.2,
    garisTren: true,
    warnaTren: '#38bdf8',
    labelPil: true,
    sorotPuncak: true,
    donatTebal: true,
  },
  analitik: {
    nama: 'Lensa',
    sebutan: 'Analitik',
    aksen: '#3b82f6',
    aksen2: '#60a5fa',
    latar: '#080b12',
    kartu: '#0f141d',
    kartu2: '#141b26',
    garis: '#1e2633',
    teks: '#f2f5f9',
    teks2: '#9aa3b2',
    teks3: '#7b8698',
    palet: ['#3b82f6', '#2dd4bf', '#8b5cf6', '#f59e0b', '#ec4899'],
    hijau: '#22c55e',
    merah: '#ef4444',
    gradasi: 'y',
    gradasiUjung: 0.14,
    sudut: 4,
    tebalGaris: 2.5,
    garisTren: true,
    warnaTren: '#60a5fa',
    labelPil: true,
    sorotPuncak: true,
    donatTebal: true,
  },
  trafik: {
    nama: 'Nadi',
    sebutan: 'Trafik',
    aksen: '#22d3ee',
    aksen2: '#3b82f6',
    latar: '#0b0d12',
    kartu: '#12151d',
    kartu2: '#171b25',
    garis: 'rgba(255,255,255,0.07)',
    teks: '#f2f5f9',
    teks2: '#9aa3b2',
    teks3: '#8792a3',
    palet: ['#22d3ee', '#3b82f6', '#eab308', '#f97316', '#a78bfa'],
    hijau: '#22c55e',
    merah: '#ef4444',
    gradasi: 'x',
    gradasiUjung: 0.18,
    sudut: 5,
    tebalGaris: 2,
    garisTren: true,
    warnaTren: '#3b82f6',
    labelPil: false,
    sorotPuncak: true,
    donatTebal: true,
  },
  kaca: {
    nama: 'Kaca',
    sebutan: 'Bening',
    aksen: '#2f8f7d',
    aksen2: '#e8603c',
    latar: '#b79f88',
    kartu: 'rgba(255,255,255,0.34)',
    kartu2: 'rgba(255,255,255,0.55)',
    garis: 'rgba(40,30,20,0.12)',
    teks: '#17130e',
    teks2: '#3d362e',
    teks3: '#5f554b',
    palet: ['#2f8f7d', '#e8603c', '#1f1b17', '#e0a63a', '#6b8fb5'],
    hijau: '#1f8a5b',
    merah: '#d9472b',
    gradasi: 'y',
    gradasiUjung: 0.55,
    sudut: 8,
    tebalGaris: 2.4,
    garisTren: false,
    warnaTren: '#1f1b17',
    labelPil: false,
    sorotPuncak: true,
    donatTebal: true,
    latarCss:
      'radial-gradient(circle at 12% 18%, #e9d8c2 0%, transparent 42%), radial-gradient(circle at 85% 12%, #8c6d52 0%, transparent 45%), radial-gradient(circle at 70% 88%, #d7bfa3 0%, transparent 50%), radial-gradient(circle at 20% 90%, #6f5643 0%, transparent 45%), linear-gradient(135deg, #cbb39a 0%, #a8896d 55%, #d9c6b0 100%)',
    kaca: true,
    padanan: '#efe6dc',
  },
  tirta: {
    nama: 'Tirta',
    sebutan: 'Air',
    aksen: '#2ee6d6',
    aksen2: '#9bf26b',
    latar: '#05384f',
    kartu: 'rgba(6,42,60,0.62)',
    kartu2: 'rgba(16,74,96,0.62)',
    garis: 'rgba(120,220,235,0.16)',
    teks: '#e9fbff',
    teks2: '#a9d6df',
    teks3: '#7fb2be',
    palet: ['#2ee6d6', '#3aa0ff', '#9bf26b', '#ffd166', '#ff7a8a'],
    hijau: '#5ee08a',
    merah: '#ff6b7a',
    gradasi: 'y',
    gradasiUjung: 0.12,
    sudut: 10,
    tebalGaris: 2.4,
    garisTren: true,
    warnaTren: '#9bf26b',
    labelPil: false,
    sorotPuncak: true,
    donatTebal: true,
    latarCss:
      'radial-gradient(circle at 15% 10%, rgba(46,230,214,0.28) 0%, transparent 40%), radial-gradient(circle at 90% 85%, rgba(58,160,255,0.26) 0%, transparent 45%), linear-gradient(160deg, #03213a 0%, #05384f 48%, #08566a 100%)',
    kaca: true,
    padanan: '#0b3a4e',
  },
  aurora: {
    nama: 'Aurora',
    sebutan: 'Gradasi bercahaya',
    aksen: '#a78bfa',
    aksen2: '#f472b6',
    latar: '#0b0820',
    kartu: 'rgba(22,17,52,0.66)',
    kartu2: 'rgba(44,33,88,0.6)',
    garis: 'rgba(167,139,250,0.2)',
    teks: '#f4f1ff',
    teks2: '#c4b8f0',
    teks3: '#9a8fc6',
    palet: ['#a78bfa', '#f472b6', '#60a5fa', '#34d399', '#fbbf24'],
    hijau: '#34d399',
    merah: '#fb7185',
    gradasi: 'y',
    gradasiUjung: 0.14,
    sudut: 8,
    tebalGaris: 2.4,
    garisTren: true,
    warnaTren: '#f472b6',
    labelPil: true,
    sorotPuncak: true,
    donatTebal: true,
    latarCss:
      'radial-gradient(ellipse at 10% 0%, rgba(167,139,250,0.45) 0%, transparent 50%), radial-gradient(ellipse at 95% 30%, rgba(244,114,182,0.35) 0%, transparent 45%), radial-gradient(ellipse at 40% 110%, rgba(96,165,250,0.35) 0%, transparent 50%), #0b0820',
    kaca: true,
    padanan: '#1a1438',
    sudutKartu: 18,
  },
  neon: {
    nama: 'Neon',
    sebutan: 'Kisi gelap',
    aksen: '#39ff14',
    aksen2: '#ff2bd6',
    latar: '#05060a',
    kartu: '#0a0d12',
    kartu2: '#11161d',
    garis: 'rgba(57,255,20,0.2)',
    teks: '#eafff0',
    teks2: '#9fd8b0',
    teks3: '#6fa583',
    palet: ['#39ff14', '#ff2bd6', '#00e5ff', '#ffe600', '#ff6b00'],
    hijau: '#39ff14',
    merah: '#ff3b6b',
    gradasi: 'y',
    gradasiUjung: 0.05,
    sudut: 1,
    tebalGaris: 2,
    garisTren: true,
    warnaTren: '#00e5ff',
    labelPil: false,
    sorotPuncak: true,
    donatTebal: false,
    latarCss:
      'linear-gradient(rgba(57,255,20,0.05) 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, rgba(57,255,20,0.05) 1px, transparent 1px) 0 0 / 22px 22px, #05060a',
    sudutKartu: 4,
    huruf: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  blok: {
    nama: 'Blok',
    sebutan: 'Neubrutalism',
    aksen: '#ff5c8a',
    aksen2: '#3d5afe',
    latar: '#fff4d6',
    kartu: '#ffffff',
    kartu2: '#fff9e8',
    garis: '#111111',
    teks: '#111111',
    teks2: '#2b2b2b',
    teks3: '#555555',
    palet: ['#ff5c8a', '#3d5afe', '#ffc928', '#00c49a', '#ff8a00'],
    hijau: '#00a86b',
    merah: '#e5383b',
    gradasi: 'y',
    gradasiUjung: 1,
    sudut: 3,
    tebalGaris: 3,
    garisTren: false,
    warnaTren: '#111111',
    labelPil: false,
    sorotPuncak: false,
    donatTebal: false,
    tepi: { tebal: 2, warna: '#111111', bayangan: '4px 4px 0 #111111' },
    sudutKartu: 8,
  },
  bento: {
    nama: 'Bento',
    sebutan: 'Pastel',
    aksen: '#8b7cf6',
    aksen2: '#f6a5c0',
    latar: '#f6f4fb',
    kartu: '#ffffff',
    kartu2: '#f3effa',
    garis: '#ebe6f3',
    teks: '#2b2540',
    teks2: '#5d5675',
    teks3: '#8c86a3',
    palet: ['#8b7cf6', '#5cc8b0', '#f28fb0', '#f5c451', '#7fb2f5'],
    hijau: '#22a06b',
    merah: '#e5484d',
    gradasi: 'y',
    gradasiUjung: 0.5,
    sudut: 12,
    tebalGaris: 3,
    garisTren: false,
    warnaTren: '#8b7cf6',
    labelPil: false,
    sorotPuncak: true,
    donatTebal: true,
    latarCss:
      'radial-gradient(circle at 0% 0%, #efe9ff 0%, transparent 45%), radial-gradient(circle at 100% 100%, #ffe9f1 0%, transparent 45%), #f6f4fb',
    sudutKartu: 24,
  },
  koran: {
    nama: 'Koran',
    sebutan: 'Editorial',
    aksen: '#c8102e',
    aksen2: '#151515',
    latar: '#f4efe4',
    kartu: '#fbf8f1',
    kartu2: '#efe8d9',
    garis: '#d6ccb8',
    teks: '#151515',
    teks2: '#3d3a33',
    teks3: '#6e695d',
    palet: ['#c8102e', '#151515', '#8a8372', '#c9a227', '#2f5d8a'],
    hijau: '#2e7d32',
    merah: '#c8102e',
    gradasi: 'y',
    gradasiUjung: 1,
    sudut: 0,
    tebalGaris: 1.6,
    garisTren: false,
    warnaTren: '#151515',
    labelPil: false,
    sorotPuncak: true,
    donatTebal: false,
    tepi: { tebal: 1, warna: '#151515', bayangan: 'none' },
    sudutKartu: 0,
    huruf: "Georgia, 'Times New Roman', serif",
  },
};

/**
 * Default versi gelap. Default adalah gaya netral yang mengikuti tema aplikasi:
 * terang di mode terang, gelap di mode gelap. Gaya lain punya latar sendiri.
 */
export const GAYA_DEFAULT_GELAP: GayaVarian = {
  ...GAYA.default,
  aksen: '#3b82f6',
  aksen2: '#60a5fa',
  latar: '#111317',
  kartu: '#171a1f',
  kartu2: '#20242b',
  garis: '#2a2f37',
  teks: '#f2f4f7',
  teks2: '#b4bcc8',
  teks3: '#8a93a1',
  palet: ['#3b82f6', '#38bdf8', '#a78bfa', '#fbbf24', '#34d399'],
  hijau: '#22c55e',
  merah: '#f87171',
  gradasiUjung: 0.2,
  warnaTren: '#94a3b8',
};

/**
 * Versi terang Pijar, Lensa, dan Nadi. Aksen dan karakter tetap (oranye, biru,
 * cyan), hanya latar, kartu, dan teks yang dibalik supaya selaras dengan mode
 * terang aplikasi. Aksen sedikit dipekatkan agar tetap kontras di atas putih.
 */
export const GAYA_TERANG: Partial<Record<Varian, GayaVarian>> = {
  ringkasan: {
    ...GAYA.ringkasan,
    aksen: '#ef7a0c',
    aksen2: '#f59a3c',
    latar: '#f7f4f0',
    kartu: '#ffffff',
    kartu2: '#fbf1e6',
    garis: '#ece4da',
    teks: '#1c1712',
    teks2: '#5b5147',
    teks3: '#857a6f',
    palet: ['#ef7a0c', '#0d9488', '#7c3aed', '#d39200', '#db2777'],
    hijau: '#16a34a',
    merah: '#dc2626',
    gradasiUjung: 0.28,
    warnaTren: '#0284c7',
  },
  analitik: {
    ...GAYA.analitik,
    aksen: '#2563eb',
    aksen2: '#3b82f6',
    latar: '#f3f6fb',
    kartu: '#ffffff',
    kartu2: '#edf2fb',
    garis: '#dde5f0',
    teks: '#0f172a',
    teks2: '#475569',
    teks3: '#64748b',
    palet: ['#2563eb', '#0d9488', '#7c3aed', '#d97706', '#db2777'],
    hijau: '#16a34a',
    merah: '#dc2626',
    gradasiUjung: 0.26,
    warnaTren: '#3b82f6',
  },
  trafik: {
    ...GAYA.trafik,
    aksen: '#0891b2',
    aksen2: '#2563eb',
    latar: '#f1f7f9',
    kartu: '#ffffff',
    kartu2: '#e9f5f8',
    garis: 'rgba(15,40,60,0.1)',
    teks: '#0b1720',
    teks2: '#44556a',
    teks3: '#64768a',
    palet: ['#0891b2', '#2563eb', '#ca8a04', '#ea580c', '#7c3aed'],
    hijau: '#16a34a',
    merah: '#dc2626',
    gradasiUjung: 0.28,
    warnaTren: '#2563eb',
  },
  tirta: {
    ...GAYA.tirta,
    aksen: '#089e9a',
    aksen2: '#4c9a1f',
    latar: '#d3eff4',
    kartu: 'rgba(255,255,255,0.66)',
    kartu2: 'rgba(225,246,250,0.9)',
    garis: 'rgba(10,80,100,0.13)',
    teks: '#06303d',
    teks2: '#2f5d69',
    teks3: '#5a8590',
    palet: ['#089e9a', '#1d7fe0', '#4c9a1f', '#d39200', '#e0566a'],
    hijau: '#15803d',
    merah: '#dc2626',
    gradasiUjung: 0.3,
    warnaTren: '#4c9a1f',
    latarCss:
      'radial-gradient(circle at 15% 10%, rgba(8,158,154,0.22) 0%, transparent 42%), radial-gradient(circle at 88% 88%, rgba(29,127,224,0.2) 0%, transparent 46%), linear-gradient(160deg, #eefafc 0%, #d8f1f5 50%, #c4e7ef 100%)',
    padanan: '#e8f7fa',
  },
  aurora: {
    ...GAYA.aurora,
    aksen: '#7c3aed',
    aksen2: '#db2777',
    latar: '#f3f0ff',
    kartu: 'rgba(255,255,255,0.7)',
    kartu2: 'rgba(243,238,255,0.92)',
    garis: 'rgba(91,60,190,0.13)',
    teks: '#1e1538',
    teks2: '#4b3f78',
    teks3: '#7a6fa6',
    palet: ['#7c3aed', '#db2777', '#2563eb', '#059669', '#d97706'],
    hijau: '#059669',
    merah: '#e11d48',
    gradasiUjung: 0.3,
    warnaTren: '#db2777',
    latarCss:
      'radial-gradient(ellipse at 10% 0%, rgba(167,139,250,0.4) 0%, transparent 50%), radial-gradient(ellipse at 95% 30%, rgba(244,114,182,0.28) 0%, transparent 45%), radial-gradient(ellipse at 40% 110%, rgba(96,165,250,0.3) 0%, transparent 50%), #f6f3ff',
    padanan: '#f5f2ff',
  },
  neon: {
    ...GAYA.neon,
    aksen: '#0d9f35',
    aksen2: '#c2189f',
    latar: '#f4fff6',
    kartu: '#ffffff',
    kartu2: '#effcf2',
    garis: 'rgba(10,120,40,0.18)',
    teks: '#04210d',
    teks2: '#2c5a3a',
    teks3: '#5a8468',
    palet: ['#0d9f35', '#c2189f', '#0891b2', '#ca8a04', '#ea580c'],
    hijau: '#0d9f35',
    merah: '#e11d48',
    gradasiUjung: 0.2,
    warnaTren: '#0891b2',
    latarCss:
      'linear-gradient(rgba(13,159,53,0.07) 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, rgba(13,159,53,0.07) 1px, transparent 1px) 0 0 / 22px 22px, #f4fff6',
  },
};

/**
 * Versi gelap dari gaya yang aslinya terang. Karakter tetap: Blok tetap bertepi
 * tebal, Bento tetap pastel, Koran tetap serif dengan satu aksen merah.
 */
export const GAYA_GELAP: Partial<Record<Varian, GayaVarian>> = {
  blok: {
    ...GAYA.blok,
    latar: '#16161a',
    kartu: '#1f1f25',
    kartu2: '#2a2a32',
    garis: '#f5f5f5',
    teks: '#fafafa',
    teks2: '#d4d4d8',
    teks3: '#a1a1aa',
    warnaTren: '#f5f5f5',
    tepi: { tebal: 2, warna: '#f5f5f5', bayangan: '4px 4px 0 #ff5c8a' },
  },
  bento: {
    ...GAYA.bento,
    aksen: '#a99bff',
    latar: '#1b1925',
    kartu: '#24212f',
    kartu2: '#2d2a3a',
    garis: '#38344a',
    teks: '#f3f0fb',
    teks2: '#c4bed8',
    teks3: '#958fac',
    palet: ['#a99bff', '#6fd8c0', '#f7a3bf', '#f7cf6b', '#94c1fb'],
    gradasiUjung: 0.35,
    latarCss:
      'radial-gradient(circle at 0% 0%, rgba(169,155,255,0.18) 0%, transparent 45%), radial-gradient(circle at 100% 100%, rgba(247,163,191,0.14) 0%, transparent 45%), #1b1925',
  },
  koran: {
    ...GAYA.koran,
    aksen: '#ff4a3d',
    aksen2: '#f2ede1',
    latar: '#151412',
    kartu: '#1c1b18',
    kartu2: '#25231f',
    garis: '#3a372f',
    teks: '#f2ede1',
    teks2: '#cbc4b3',
    teks3: '#958e7d',
    palet: ['#ff4a3d', '#f2ede1', '#a39c8a', '#e0b84a', '#6b9bd1'],
    merah: '#ff4a3d',
    warnaTren: '#f2ede1',
    tepi: { tebal: 1, warna: '#f2ede1', bayangan: 'none' },
  },
};

/**
 * Gaya yang dipakai untuk mode tema tertentu: Default gelap di mode gelap;
 * Pijar, Lensa, Nadi, Tirta, Aurora, Neon terang di mode terang; Blok, Bento,
 * Koran gelap di mode gelap. Kaca selalu bening hangat.
 */
export const gayaMode = (v: Varian, mode: 'light' | 'dark'): GayaVarian => {
  if (mode === 'dark') return v === 'default' ? GAYA_DEFAULT_GELAP : GAYA_GELAP[v] ?? GAYA[v];
  return GAYA_TERANG[v] ?? GAYA[v];
};

/** Buang warna nyaris hitam (mis. tinta Kaca) yang hilang di latar gelap. */
export const cukupTerang = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 60;
};
