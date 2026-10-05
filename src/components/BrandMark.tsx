import React from 'react';

/** Dua huruf monogram: "Perumda Air Minum" -> "PA". Hanya huruf/karakter dasar. */
export function monogram(name: string): string {
  const kata = (name || '')
    .replace(/[^\p{L}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean);
  if (kata.length === 0) return 'AP';
  if (kata.length === 1) return kata[0].slice(0, 2).toUpperCase();
  return (kata[0][0] + kata[1][0]).toUpperCase();
}

const WARNA_TILE = ['#3730c4', '#4f46e5', '#047857', '#b91c1c', '#c2410c', '#4d7c0f', '#6d28d9'];

/** Warna tile stabil per id — instansi yang sama selalu dapat warna sama. */
export function warnaTile(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return WARNA_TILE[h % WARNA_TILE.length];
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
  return (
    <span
      className={`inline-flex items-center justify-center rounded-control font-bold tracking-wide text-white select-none shrink-0 ${ukuran} ${className}`}
      style={{ backgroundColor: warnaTile(id || name || 'AP') }}
      title={name}
    >
      {monogram(name || 'ApexPulse')}
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
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold text-white select-none shrink-0 ${ukuran} ${className}`}
      style={{ backgroundColor: warnaTile(id || name || 'U') }}
      title={name}
    >
      {monogram(name || 'Pengguna')}
    </span>
  );
};
