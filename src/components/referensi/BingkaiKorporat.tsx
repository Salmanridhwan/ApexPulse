import React from 'react';
import type { WidgetStyle } from '../../types';
import { gayaKatalogWidget } from '../widgets/bingkaiKatalog';
import { useThemeMode } from '../../theme';

/**
 * BINGKAI HALAMAN GAYA KORPORAT — meniru slide deck rapat manajemen: badge
 * nomor miring, judul & subjudul, pita navy-oranye di pojok, latar gaya, dan
 * kaki "… · Confidential · n".
 *
 * Dipakai template Rapat Manajemen (`DashboardBagian`) DAN kanvas dashboard
 * biasa yang Gaya Semua-nya Korporat, supaya keduanya tampil sama.
 */
interface Props {
  nomor: number;
  judul: string;
  sub?: string;
  /** Teks kiri kaki halaman, mis. "Rapat Manajemen · 2026". */
  kaki: string;
  /** Gaya dashboard (warna kartu, font, palet) untuk warna bingkai. */
  gaya?: WidgetStyle;
  /** Isi tinggi wadah: isi halaman meregang mengisi sisa tinggi. */
  penuh?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const BingkaiKorporat: React.FC<Props> = ({ nomor, judul, sub, kaki, gaya, penuh = false, className = '', children }) => {
  const mode = useThemeMode();
  const { g } = gayaKatalogWidget({ ...(gaya ?? {}), desain: 'korporat' }, mode);
  const gelapLatar = g.latar.startsWith('#') && parseInt(g.latar.slice(1, 3), 16) < 90;
  const tintaBadge = gelapLatar ? g.kartu2 : g.teks;

  return (
    <div
      className={`relative rounded-card overflow-hidden flex flex-col ${penuh ? 'h-full' : ''} ${className}`}
      style={{ background: g.latarCss ?? g.latar, color: g.teks, fontFamily: g.huruf }}
      data-testid="bingkai-korporat"
    >
      {/* Hiasan sudut kanan atas: dua pita miring navy dan oranye seperti slide. */}
      <div className="pointer-events-none absolute -top-6 right-10 w-24 h-28 -skew-x-[28deg] opacity-90" style={{ backgroundColor: tintaBadge }} />
      <div className="pointer-events-none absolute -top-6 right-2 w-8 h-28 -skew-x-[28deg]" style={{ backgroundColor: g.aksen2 }} />

      <header className="relative shrink-0 flex items-center gap-3 px-4 sm:px-5 pt-4 pb-3 pr-36">
        <div className="shrink-0 -skew-x-12 px-3.5 py-1.5" style={{ backgroundColor: tintaBadge, borderBottom: `3px solid ${g.aksen2}` }}>
          <span className="block skew-x-12 text-lg font-extrabold italic text-white tabular-nums">{String(nomor).padStart(2, '0')}</span>
        </div>
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-extrabold leading-tight tracking-tight truncate">{judul}</h2>
          {sub && (
            <p className="text-[12px] sm:text-[13px] leading-snug truncate" style={{ color: g.teks2 }}>
              {sub}
            </p>
          )}
        </div>
      </header>

      <div className={`relative ${penuh ? 'flex-1 min-h-0' : ''}`}>{children}</div>

      <footer
        className="relative shrink-0 mt-auto flex items-center justify-between gap-3 px-4 sm:px-5 py-2 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: g.teks3, borderTop: `1px solid ${g.garis}` }}
      >
        <span className="truncate">{kaki}</span>
        <span className="shrink-0">Confidential · {nomor}</span>
      </footer>
    </div>
  );
};
