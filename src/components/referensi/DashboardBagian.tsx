import React, { useState } from 'react';
import { FileSearch } from 'lucide-react';
import type { WidgetSpec, WidgetStyle } from '../../types';
import { WidgetRenderer } from '../widgets/WidgetRenderer';
import { PanelSumber } from '../widgets/PanelSumber';
import { bingkaiKatalog, gayaKatalogWidget } from '../widgets/bingkaiKatalog';
import { useThemeMode } from '../../theme';
import { kartuBerjudulSendiri } from '../../services/chart/dataKatalogWidget';
import { templateBerdasarkanId } from '../../services/templates/dashboardTemplates';
import { BingkaiKorporat } from './BingkaiKorporat';
import { halamanTemplateBagian, nomorHalamanBagian } from '../../services/templates/templateBagian';

/**
 * SATU HALAMAN TEMPLATE RAPAT BAGIAN (`tpl-bagian-x#n`).
 *
 * Meniru slide deck rapat manajemen: badge nomor miring, judul & subjudul,
 * kartu-kartu dalam grid 12 kolom, dan kaki "Rapat Manajemen · Confidential".
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
/**
 * Tinggi minimum isi satu halaman, px (7 baris x 50 + 6 celah x 12 + pb-3).
 * Semua halaman deck dirapikan `pasHalaman` menjadi maksimal 7 baris, jadi
 * dengan tinggi minimum ini setiap slide sama tinggi walau kartunya sedikit.
 */
const TINGGI_MIN = 434;

export const DashboardBagian: React.FC<Props> = ({ templateId, widgets, gaya, penuh = false, contoh = false }) => {
  const dasar = templateId.split('#')[0];
  const nomor = nomorHalamanBagian(templateId);
  const template = templateBerdasarkanId(dasar);
  const halaman = template ? halamanTemplateBagian(template)[nomor - 1] : undefined;
  const isi = widgets ?? halaman?.widgets ?? [];
  // Desain halaman ikut panel Gaya Semua; tanpa pilihan = Korporat.
  const gayaKartu: WidgetStyle = { ...(gaya ?? {}), desain: gaya?.desain ?? 'default' };
  return (
    <BingkaiKorporat
      nomor={nomor}
      judul={halaman?.judul ?? template?.nama ?? ''}
      sub={halaman?.sub}
      kaki={`${template?.bagian?.unit ?? template?.nama} · 2026`}
      gaya={gayaKartu}
      penuh={penuh}
    >
      {/* Basis huruf deck dinaikkan dari bawaan browser (16px) ke 18px.
          Seluruh ukuran di dalam kartu memakai `em`, jadi satu angka ini
          memperbesar judul, angka, label, dan butir sekaligus tanpa perlu
          menyentuh tiap komponen. 18px dipilih karena masih muat di kartu
          372px setelah butir naik ke 0.88em. */}
      <div
        data-testid="halaman-bagian"
        className={`grid grid-cols-12 gap-3 px-4 sm:px-5 pb-3 ${penuh ? 'h-full overflow-auto gulir-tema' : ''}`}
        // Mode presentasi (`penuh`): baris ikut melar mengisi tinggi layar, supaya
        // bagian bawah tidak kosong. Di galeri tetap 50px per baris.
        style={{ gridAutoRows: penuh ? `minmax(${BARIS}px, 1fr)` : `${BARIS}px`, minHeight: TINGGI_MIN, fontSize: '18px' }}
      >
        {isi.map((w) => (
          <KartuBagian
            key={w.id}
            widget={w}
            gaya={gayaKartu}
            contoh={contoh}
            pengganti={w.dataKosong ? kartuContoh(halaman?.widgets ?? [], w) : undefined}
          />
        ))}
      </div>
    </BingkaiKorporat>
  );
};

/**
 * KARTU KOSONG DIGAMBAR DENGAN ANGKA CONTOH TEMPLATE (permintaan pemilik
 * aplikasi: chart tampil penuh, bukan kotak kosong). Kartu template dicari lewat
 * judulnya di halaman yang sama, karena id kartu dibuat ulang saat template
 * disalin. Hasilnya tetap bertanda `angkaContoh` dan diberi lencana di kartu,
 * supaya angka contoh tidak pernah terbaca sebagai angka dokumen.
 */
function kartuContoh(contohHalaman: WidgetSpec[], w: WidgetSpec): WidgetSpec | undefined {
  const asal = contohHalaman.find((c) => c.title === w.title);
  if (!asal) return undefined;
  if (!asal.chart && !asal.table && !asal.kpi && !asal.narasi) return undefined;
  return { ...asal, id: w.id, grid: w.grid, dataKosong: false };
}

/** Satu kartu halaman bagian: bingkai Template Chart + panel sumber dokumen. */
const KartuBagian: React.FC<{ widget: WidgetSpec; gaya: WidgetStyle; contoh: boolean; pengganti?: WidgetSpec }> = ({
  widget: asli,
  gaya,
  contoh,
  pengganti,
}) => {
  const mode = useThemeMode();
  const [buka, setBuka] = useState(false);
  const { g } = gayaKatalogWidget(gaya, mode);
  const bk = bingkaiKatalog(g);
  // Angka contoh hanya dipakai di kartu yang memang kosong; label tetap jujur.
  const angkaContoh = Boolean(pengganti);
  const widget = pengganti ?? asli;
  const w: WidgetSpec = { ...widget, style: { ...(widget.style ?? {}), ...gaya } };
  const sendiri = kartuBerjudulSendiri(w);
  const bisaSumber = !contoh && !w.dataKosong && !angkaContoh;
  const lebar = Math.max(1, Math.min(12, w.grid?.w ?? 4));
  const tinggi = Math.max(2, w.grid?.h ?? 3);
  const warnaPanel = { panel: g.kartu2.startsWith('rgba') ? g.padanan ?? g.latar : g.kartu2, teks: g.teks, teks2: g.teks2, teks3: g.teks3, aksen: g.aksen, garis: g.garis };

  const isi = w.dataKosong ? (
    <div className="h-full flex flex-col items-center justify-center text-center gap-1 px-3">
      <span className="text-[0.78em] font-bold" style={{ color: g.teks3 }}>
        —
      </span>
      <span className="text-[0.66em] leading-snug" style={{ color: g.teks3 }}>
        {w.catatanData || 'Belum ada di dokumen instansi.'}
      </span>
    </div>
  ) : angkaContoh ? (
    // Dipudarkan supaya terlihat beda dari kartu yang angkanya dari dokumen.
    <div className="h-full min-h-0 flex flex-col" style={{ opacity: 0.6 }}>
      <WidgetRenderer widget={w} preview padat />
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
              <p className="text-[0.78em] font-bold leading-snug truncate" style={bk.judul}>
                {w.title}
              </p>
              {w.subtitle && (
                <p className="text-[0.66em] leading-snug truncate" style={bk.sub}>
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
      {angkaContoh && (
        <span
          data-testid="lencana-angka-contoh"
          title={asli.catatanData || 'Indikator ini belum ada di dokumen instansi.'}
          className="pointer-events-auto absolute bottom-1.5 right-2 z-10 rounded-full border px-2 py-[1px] text-[0.56em] font-semibold"
          style={{ background: g.kartu2.startsWith('rgba') ? g.padanan ?? g.latar : g.kartu2, borderColor: g.garis, color: g.teks2 }}
        >
          {asli.dataTertunda ? 'Angka contoh · sedang diisi' : 'Angka contoh · belum ada di dokumen'}
        </span>
      )}
    </div>
  );
};
