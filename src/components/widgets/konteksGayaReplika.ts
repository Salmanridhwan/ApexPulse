/**
 * GAYA SEMUA UNTUK DASHBOARD DARI TEMPLATE DASHBOARD.
 *
 * Halaman replika template (Pijar, Lensa, Nadi, Kaca; halaman 1-3) menggambar
 * semua kartunya lewat `WidgetChart` dengan chart katalog (`chartId`). Dulu
 * pilihan di panel Gaya hanya sampai ke sebagian halaman: desain chart tidak
 * pernah dibaca, kartu KPI dan panel tabel tetap gelap, dan halaman 2-3 Lensa,
 * Nadi, serta Kaca tidak menerima palet atau font sama sekali.
 *
 * `ReplikaHalaman` memasang gaya dashboard di konteks ini; `WidgetChart` membaca
 * konteksnya, jadi setiap kartu di setiap halaman template ikut tanpa perlu
 * meneruskan prop satu per satu. Di luar replika konteksnya kosong.
 */

import React from 'react';
import type { WidgetStyle } from '../../types';
import { GAYA, VARIAN, type GayaVarian, type Varian } from '../../services/chart/gayaVarian';
import { temaKartu, warnaKartuValid } from './widgetCardTheme';

export const KonteksGayaReplika = React.createContext<WidgetStyle | undefined>(undefined);

/** Kunci warna panel kartu: tetap milik template supaya teks terbaca di kartunya. */
const KUNCI_PANEL = ['latar', 'latarCss', 'kartu', 'kartu2', 'garis', 'teks', 'teks2', 'teks3', 'kaca', 'kartuPadat'] as const;

/**
 * Varian dan gaya pengganti untuk satu kartu replika.
 * - Desain chart dipilih: bentuk, aksen, dan palet milik desain itu; warna panel
 *   tetap milik template (atau warna kartu pilihan pengguna).
 * - Warna kartu dipilih: panel, teks, dan garis mengikuti warna itu, termasuk
 *   kartu KPI dan tabel (bentuk HTML) yang dulu tetap gelap.
 */
export function gayaKartuReplika(
  gayaHalaman: WidgetStyle | undefined,
  varian: Varian,
  gantiGaya: GayaVarian | undefined
): { varian: Varian; gaya: GayaVarian | undefined } {
  if (!gayaHalaman) return { varian, gaya: gantiGaya };
  const desain = VARIAN.includes(gayaHalaman.desain as Varian) ? (gayaHalaman.desain as Varian) : undefined;
  const asal: GayaVarian = gantiGaya ?? GAYA[varian];
  let hasil: GayaVarian | undefined = gantiGaya;
  if (desain) {
    hasil = { ...GAYA[desain] };
    for (const k of KUNCI_PANEL) (hasil as any)[k] = (asal as any)[k];
  }
  if (warnaKartuValid(gayaHalaman.kartu)) {
    const t = temaKartu(gayaHalaman.kartu, 'dark').vars;
    hasil = {
      ...(hasil ?? asal),
      kartu: gayaHalaman.kartu!,
      kartu2: t['--color-surface-2'],
      teks: t['--color-ink'],
      teks2: t['--color-ink-2'],
      teks3: t['--color-ink-3'],
      garis: t['--color-line'],
      kaca: false,
    };
  }
  return { varian: desain ?? varian, gaya: hasil };
}
