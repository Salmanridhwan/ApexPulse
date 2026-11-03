import React, { useState } from 'react';
import { FileSearch } from 'lucide-react';
import type { WidgetSpec, WidgetStyle } from '../../types';
import { WidgetRenderer } from '../widgets/WidgetRenderer';
import { PanelSumber } from '../widgets/PanelSumber';
import { bingkaiKatalog, gayaKatalogWidget } from '../widgets/bingkaiKatalog';
import { useThemeMode } from '../../theme';
import { kartuBerjudulSendiri } from '../../services/chart/dataKatalogWidget';
import { templateBerdasarkanId } from '../../services/templates/dashboardTemplates';
import { halamanTemplateBagian, nomorHalamanBagian } from '../../services/templates/templateBagian';

/**
 * SATU HALAMAN TEMPLATE RAPAT BAGIAN (`tpl-bagian-x#n`).
 *
 * Meniru slide deck rapat manajemen: badge nomor miring, judul & subjudul,
 * kartu-kartu dalam grid 12 kolom, dan kaki "Meeting Bagian … · Confidential".
 * Setiap kartu digambar `WidgetRenderer` dengan desain gaya aktif (bawaan
 * Korporat), jadi bentuknya sama dengan menu Template Chart dan kanvas.
 */
interface Props {
  templateId: string;
  /** Kartu halaman ini. Kosong = kartu contoh template. */
  widgets?: WidgetSpec[];
  /** Gaya dashboard (panel Gaya Semua): desain, palet, warna kartu, font. */
  gaya?: WidgetStyle;
  /** Isi tinggi wadah (presentasi / kanvas satu layar). */
  penuh?: boolean;
  /** true = angka contoh galeri; sumber dokumen tidak ditawarkan. */
  contoh?: boolean;
}

/** Lebar kartu di layar lebar (kelas literal supaya terbaca Tailwind). */
const LEBAR_LG: Record<number, string> = {
  1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3', 4: 'lg:col-span-4', 5: 'lg:col-span-5', 6: 'lg:col-span-6',
  7: 'lg:col-span-7', 8: 'lg:col-span-8', 9: 'lg:col-span-9', 10: 'lg:col-span-10', 11: 'lg:col-span-11', 12: 'lg:col-span-12',
};

/** Tinggi satu satuan baris grid kartu, px. */
const BARIS = 50;

export const DashboardBagian: React.FC<Props> = ({ templateId, widgets, gaya, penuh = false, contoh = false }) => {
  const mode = useThemeMode();
  const dasar = templateId.split('#')[0];
  const nomor = nomorHalamanBagian(templateId);
  const template = templateBerdasarkanId(dasar);
  const halaman = template ? halamanTemplateBagian(template)[nomor - 1] : undefined;
  const isi = widgets ?? halaman?.widgets ?? [];
  // Desain halaman ikut panel Gaya Semua; tanpa pilihan = Korporat.
  const gayaKartu: WidgetStyle = { ...(gaya ?? {}), desain: gaya?.desain ?? 'korporat' };
  const { g } = gayaKatalogWidget(gayaKartu, mode);
  const gelapLatar = g.latar.startsWith('#') && parseInt(g.latar.slice(1, 3), 16) < 90;
  const tintaBadge = gelapLatar ? g.kartu2 : g.teks;

  return (
    <div
      className={`relative rounded-card overflow-hidden flex flex-col ${penuh ? 'h-full' : ''}`}
      style={{ background: g.latarCss ?? g.latar, color: g.teks, fontFamily: g.huruf }}
      data-testid="halaman-bagian"
    >
      {/* Hiasan sudut kanan atas: dua pita miring navy dan oranye seperti slide. */}
      <div className="pointer-events-none absolute -top-6 right-10 w-24 h-28 -skew-x-[28deg] opacity-90" style={{ backgroundColor: tintaBadge }} />
      <div className="pointer-events-none absolute -top-6 right-2 w-8 h-28 -skew-x-[28deg]" style={{ backgroundColor: g.aksen2 }} />

      <header className="relative flex items-center gap-3 px-4 sm:px-5 pt-4 pb-3 pr-36">
        <div className="shrink-0 -skew-x-12 px-3.5 py-1.5" style={{ backgroundColor: tintaBadge, borderBottom: `3px solid ${g.aksen2}` }}>
          <span className="block skew-x-12 text-lg font-extrabold italic text-white tabular-nums">
            {String(nomor).padStart(2, '0')}
          </span>
        </div>
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-extrabold leading-tight tracking-tight truncate">{halaman?.judul ?? template?.nama}</h2>
          {halaman?.sub && (
            <p className="text-[12px] sm:text-[13px] leading-snug truncate" style={{ color: g.teks2 }}>
              {halaman.sub}
            </p>
          )}
        </div>
      </header>

      <div
        className={`relative grid grid-cols-12 gap-3 px-4 sm:px-5 pb-3 ${penuh ? 'flex-1 min-h-0 overflow-auto gulir-tema' : ''}`}
        style={{ gridAutoRows: `${BARIS}px` }}
      >
        {isi.map((w) => (
          <KartuBagian key={w.id} widget={w} gaya={gayaKartu} contoh={contoh} />
        ))}
      </div>

      <footer
        className="relative mt-auto flex items-center justify-between gap-3 px-4 sm:px-5 py-2 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: g.teks3, borderTop: `1px solid ${g.garis}` }}
      >
        <span className="truncate">{template?.bagian?.unit ?? template?.nama} 2026</span>
        <span className="shrink-0">Confidential · {nomor}</span>
      </footer>
    </div>
  );
};

/** Satu kartu halaman bagian: bingkai Template Chart + panel sumber dokumen. */
const KartuBagian: React.FC<{ widget: WidgetSpec; gaya: WidgetStyle; contoh: boolean }> = ({ widget, gaya, contoh }) => {
  const mode = useThemeMode();
  const [buka, setBuka] = useState(false);
  const { g } = gayaKatalogWidget(gaya, mode);
  const bk = bingkaiKatalog(g);
  const w: WidgetSpec = { ...widget, style: { ...(widget.style ?? {}), ...gaya } };
  const sendiri = kartuBerjudulSendiri(w);
  const bisaSumber = !contoh && !w.dataKosong;
  const lebar = Math.max(1, Math.min(12, w.grid?.w ?? 4));
  const tinggi = Math.max(2, w.grid?.h ?? 3);
  const warnaPanel = { panel: g.kartu2.startsWith('rgba') ? g.padanan ?? g.latar : g.kartu2, teks: g.teks, teks2: g.teks2, teks3: g.teks3, aksen: g.aksen, garis: g.garis };

  const isi = w.dataKosong ? (
    <div className="h-full flex flex-col items-center justify-center text-center gap-1 px-3">
      <span className="text-[13px] font-bold" style={{ color: g.teks3 }}>
        —
      </span>
      <span className="text-[11px] leading-snug" style={{ color: g.teks3 }}>
        {w.catatanData || 'Belum ada di dokumen instansi.'}
      </span>
    </div>
  ) : (
    <WidgetRenderer widget={w} preview={contoh} padat onKlikKosong={bisaSumber ? () => setBuka(true) : undefined} />
  );

  return (
    <div
      className={`relative min-w-0 col-span-12 ${lebar <= 6 ? 'md:col-span-6' : ''} ${LEBAR_LG[lebar]} group kartu-sumber-kotak`}
      style={{ gridRow: `span ${tinggi}` }}
    >
      {sendiri ? (
        <div className="h-full kartu-sumber-depan" onClick={bisaSumber ? () => setBuka(true) : undefined} style={{ cursor: bisaSumber ? 'pointer' : undefined }}>
          {w.dataKosong ? <div className="h-full rounded-[12px] border" style={{ ...bk.luar, background: g.kartu }}>{isi}</div> : isi}
        </div>
      ) : (
        <div className="h-full border overflow-hidden flex flex-col kartu-sumber-depan" style={{ ...bk.luar, background: g.kartu, borderRadius: g.sudutKartu ?? 12 }}>
          <div className="px-3 pt-2.5 pb-1.5 flex items-start gap-2 shrink-0">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold leading-snug truncate" style={bk.judul}>
                {w.title}
              </p>
              {w.subtitle && (
                <p className="text-[11px] leading-snug truncate" style={bk.sub}>
                  {w.subtitle}
                </p>
              )}
            </div>
            {bisaSumber && (
              <button
                type="button"
                onClick={() => setBuka(true)}
                className="shrink-0 p-1 rounded-full opacity-60 group-hover:opacity-100 transition-opacity"
                style={{ color: g.teks2 }}
                aria-label="Lihat sumber dokumen"
                data-testid="tombol-sumber"
              >
                <FileSearch className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex-1 min-h-0 px-2.5 pb-2.5 flex flex-col">{isi}</div>
        </div>
      )}
      {bisaSumber && <PanelSumber widget={w} buka={buka} onTutup={() => setBuka(false)} warna={warnaPanel} />}
    </div>
  );
};
