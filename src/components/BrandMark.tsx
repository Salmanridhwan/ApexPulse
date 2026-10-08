import React from 'react';

/** Dua huruf monogram: "Perumda Air Minum" -> "PA". Hanya huruf/karakter dasar. */
export function monogram(name: string): string {
  const kata = (name || '')
    .replace(/[^\p{L}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean);
  if (kata.length === 0) return 'AB';
  if (kata.length === 1) return kata[0].slice(0, 2).toUpperCase();
  return (kata[0][0] + kata[1][0]).toUpperCase();
}

const WARNA_TILE = ['#1fa6cc', '#7f80d8', '#0f7a53', '#8f5e08', '#c62f22', '#5b9bd5', '#9a6fe0'];

/**
 * Warna teks monogram yang lolos WCAG AA untuk SETIAP warna tile.
 * Tile gelap (mis. cyan #1fa6cc, periwinkle, sky) tidak lulus dengan teks putih
 * (2.84:1), jadi monogram-nya memakai near-black. Tile terang (hijau/emas/merah)
 * tetap putih. Dihitung tetap (bukan per-tema) agar warna tile stabil di 2 mode.
 */
const TEKS_TILE: Record<string, string> = {
  '#1fa6cc': '#10141d', // putih 2.84 -> gelap 6.48
  '#7f80d8': '#10141d', // putih 3.51 -> gelap 5.25
  '#0f7a53': '#ffffff', // putih 5.34
  '#8f5e08': '#ffffff', // putih 5.57
  '#c62f22': '#ffffff', // putih 5.48
  '#5b9bd5': '#10141d', // putih 2.96 -> gelap 6.22
  '#9a6fe0': '#10141d', // putih 3.67 -> gelap 5.02
};

/** Warna tile stabil per id — instansi yang sama selalu dapat warna sama. */
export function warnaTile(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return WARNA_TILE[h % WARNA_TILE.length];
}

/** Warna teks kontras untuk sebuah warna tile (default putih bila tak terdaftar). */
export function warnaTeksTile(bg: string): string {
  return TEKS_TILE[bg.toLowerCase()] ?? '#ffffff';
}

interface LogoTileProps {
  name?: string;
  id?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** Tile logo institusi: monogram dua huruf, warna flat institusional. */
export const LogoTile: React.FC<LogoTileProps> = ({ name, id, size = 'md', className = '' }) => {
  const ukuran =
    size === 'lg'
      ? 'w-10 h-10 text-base'
      : size === 'sm'
      ? 'w-6 h-6 text-[10px]'
      : 'w-8 h-8 text-xs';
  const bg = warnaTile(id || name || 'AP');
  return (
    <span
      className={`inline-flex items-center justify-center rounded-control font-bold tracking-wide select-none shrink-0 ${ukuran} ${className}`}
      style={{ backgroundColor: bg, color: warnaTeksTile(bg) }}
      title={name}
    >
      {monogram(name || 'Aiones Boards')}
    </span>
  );
};

interface AvatarTileProps {
  name?: string;
  id?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Tile avatar user: inisial nama, palet flat (tanpa emoji). */
export const AvatarTile: React.FC<AvatarTileProps> = ({ name, id, size = 'md', className = '' }) => {
  const ukuran = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';
  const bg = warnaTile(id || name || 'U');
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold select-none shrink-0 ${ukuran} ${className}`}
      style={{ backgroundColor: bg, color: warnaTeksTile(bg) }}
      title={name}
    >
      {monogram(name || 'Pengguna')}
    </span>
  );
};
