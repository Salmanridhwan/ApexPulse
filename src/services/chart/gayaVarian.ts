/**
 * GAYA TIAP VARIAN KATALOG CHART.
 *
 * Satu chart punya empat wajah: default (netral), ringkasan (oranye), analitik
 * (biru), dan trafik (cyan). File ini HANYA berisi nilai desain. Tidak ada
 * bentuk grafik di sini, jadi menambah wajah baru cukup menambah satu entri.
 *
 * Aturan: warna, gradasi, sudut, dan ketebalan boleh berbeda. Struktur data
 * tidak boleh berbeda, karena chart yang sama harus bisa berpindah wajah tanpa
 * mengambil data ulang.
 */

export type Varian = 'default' | 'ringkasan' | 'analitik' | 'trafik';

export const VARIAN: Varian[] = ['default', 'ringkasan', 'analitik', 'trafik'];

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
};
