/**
 * BINGKAI KARTU TEMPLATE CHART — satu sumber untuk halaman Template Chart dan
 * kanvas dashboard.
 *
 * Dulu kanvas memakai `GAYA[desain]` mentah di atas latar kanvas, sedangkan
 * halaman Template Chart memakai `gayaMode(varian, mode)` dengan latar, kepala,
 * dan kotak kaca sendiri. Akibatnya gaya Kaca di kanvas jadi abu-abu dengan teks
 * sumbu tak terbaca (uji 3 Nov 2026). Keduanya kini memanggil fungsi yang sama.
 */

import type React from 'react';
import type { WidgetStyle } from '../../types';
import { VARIAN, cukupTerang, gayaMode, type GayaVarian, type Varian } from '../../services/chart/gayaVarian';
import { gayaKartuReplika } from './konteksGayaReplika';
import { warnaKartuValid } from './widgetCardTheme';

/** Varian dan gaya kartu katalog untuk gaya widget (desain + warna kartu pilihan Gaya Semua). */
export function gayaKatalogWidget(style: WidgetStyle | undefined, mode: 'light' | 'dark'): { varian: Varian; g: GayaVarian } {
  const desain = style?.desain;
  const varian: Varian = desain && VARIAN.includes(desain as Varian) ? (desain as Varian) : 'default';
  const dasar = gayaMode(varian, mode);
  let g = gayaKartuReplika(style, varian, dasar).gaya ?? dasar;
  // Warna kartu pilihan pengguna juga menjadi latar bingkai, supaya kartunya satu warna.
  if (warnaKartuValid(style?.kartu)) g = { ...g, latar: style!.kartu!, latarCss: undefined, padanan: undefined };
  return { varian, g };
}

export interface BingkaiKatalog {
  luar: React.CSSProperties;
  kepala: React.CSSProperties;
  judul: React.CSSProperties;
  sub: React.CSSProperties;
  /** Kotak kaca di sekeliling chart (hanya gaya bening). */
  dalam?: React.CSSProperties;
}

/** Gaya bingkai, kepala, dan kotak dalam kartu katalog untuk satu gaya varian. */
export function bingkaiKatalog(g: GayaVarian): BingkaiKatalog {
  // Kartu bening: pinggiran putih di latar terang (Kaca), pinggiran berpendar di latar gelap (Tirta).
  const bening = Boolean(g.kaca);
  const terang = cukupTerang(g.padanan ?? g.latar);
  const tepiBening = terang ? 'rgba(255,255,255,0.55)' : g.garis;
  const tepi = bening ? tepiBening : g.tepi?.warna ?? g.garis;
  return {
    luar: {
      background: g.latarCss ?? g.latar,
      borderColor: tepi,
      borderWidth: g.tepi?.tebal,
      borderStyle: 'solid',
      boxShadow: g.tepi && g.tepi.bayangan !== 'none' ? g.tepi.bayangan : undefined,
      borderRadius: g.sudutKartu,
      fontFamily: g.huruf,
    },
    kepala: {
      backgroundColor: bening ? (terang ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.05)') : g.kartu,
      borderColor: tepi,
      borderBottomWidth: g.tepi?.tebal,
      backdropFilter: bening ? 'blur(16px)' : undefined,
      WebkitBackdropFilter: bening ? 'blur(16px)' : undefined,
    },
    judul: { color: g.teks },
    sub: { color: g.teks3 },
    dalam: bening
      ? { backgroundColor: g.kartu, borderColor: tepiBening, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }
      : undefined,
  };
}
