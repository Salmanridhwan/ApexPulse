import { cukupTerang, GAYA } from '../../services/chart/gayaVarian';
import React, { useEffect, useRef, useState } from 'react';
import { CHART_DEFAULT } from '../../services/chart/chartDefault';
import { chartKatalogCocok, pakaiChartKatalog } from '../../services/chart/katalogCocok';
import { createPortal } from 'react-dom';
import {
  Activity,
  AlertTriangle,
  Banknote,
  CircleDollarSign,
  Coins,
  Copy,
  Database,
  Edit2,
  Gauge,
  MoreVertical,
  Percent,
  ShieldAlert,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { WidgetSpec } from '../../types';
import { WidgetRenderer } from './WidgetRenderer';
import { punyaDataChart } from '../../services/spec/widgetTypes';
import { temaKartu, warnaKartuValid } from './widgetCardTheme';
import { useThemeMode } from '../../theme';
import { kartuBerjudulSendiri, propsKatalogHtml } from '../../services/chart/dataKatalogWidget';



/**
 * Peta nama ikon (string di data widget) → komponen lucide.
 *
 * Disimpan sebagai NAMA, bukan komponen, karena widget diserialisasi ke database.
 * Nama tak dikenal jatuh ke `Target` supaya kartu tidak kosong.
 */
const PETA_IKON: Record<string, React.ComponentType<{ className?: string }>> = {
  wallet: Wallet,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  coins: Coins,
  target: Target,
  gauge: Gauge,
  users: Users,
  'shield-alert': ShieldAlert,
  banknote: Banknote,
  activity: Activity,
  percent: Percent,
  dollar: CircleDollarSign,
};

/** Render ikon kartu berdasarkan nama di data widget. */
function ikonKartu(nama: string) {
  const Ikon = PETA_IKON[nama] ?? Target;
  return <Ikon className="w-3.5 h-3.5" />;
}

interface WidgetCardProps {
  widget: WidgetSpec;
  onEdit: (widget: WidgetSpec) => void;
  onManualCorrection: (widget: WidgetSpec) => void;
  onDelete: (widgetId: string) => void;
  onDuplicate: (widget: WidgetSpec) => void;
  /** Mode pratinjau (mis. galeri template): sembunyikan menu ⋯ karena widget belum nyata. */
  preview?: boolean;
  /** Posisi kartu di kanvas: dipakai menggeser hue awal grafik. */
  urutan?: number;
  /**
   * Mode padat (dashboard satu halaman): kepala kartu dipadatkan dan tinggi
   * minimum badan dilepas, supaya grafik tetap terlihat saat kartu hanya ~80px.
   */
  padat?: boolean;
}

export const WidgetCard: React.FC<WidgetCardProps> = ({
  widget,
  onEdit,
  onManualCorrection,
  onDelete,
  onDuplicate,
  preview = false,
  urutan,
  padat = false,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  /**
   * Menu (⋯) digambar lewat PORTAL ke `document.body` dengan posisi `fixed`, bukan
   * `absolute` di dalam kartu. Sebabnya kartu widget memakai `overflow-hidden` (perlu
   * untuk memotong isi ke sudut membulat), sehingga menu `absolute` ikut TERPOTONG di
   * dalam kartu. Dengan portal, menu melayang DI ATAS kartu seperti seharusnya.
   */
  const tombolMenuRef = useRef<HTMLButtonElement>(null);
  const [posisiMenu, setPosisiMenu] = useState<{ top?: number; bottom?: number; right: number } | null>(null);

  const bukaMenu = () => {
    const r = tombolMenuRef.current?.getBoundingClientRect();
    if (!r) return;
    const LEBAR_MENU = 256; // w-64
    const PERKIRAAN_TINGGI = 380; // grid tipe grafik (3 baris) + 4 aksi
    const right = Math.max(8, Math.min(window.innerWidth - r.right, window.innerWidth - LEBAR_MENU - 8));
    const tidakMuatKeBawah = r.bottom + PERKIRAAN_TINGGI > window.innerHeight - 8 && r.top > PERKIRAAN_TINGGI;
    setPosisiMenu(
      tidakMuatKeBawah
        ? { bottom: window.innerHeight - r.top + 4, right }
        : { top: r.bottom + 4, right }
    );
    setShowMenu(true);
  };

  // Menu posisinya dihitung sekali saat dibuka; kalau halaman digeser/diubah ukurannya,
  // lebih baik ditutup daripada melayang di tempat yang salah.
  useEffect(() => {
    if (!showMenu) return;
    const tutup = () => setShowMenu(false);
    window.addEventListener('scroll', tutup, true);
    window.addEventListener('resize', tutup);
    return () => {
      window.removeEventListener('scroll', tutup, true);
      window.removeEventListener('resize', tutup);
    };
  }, [showMenu]);

  const isManual = widget.confidence === 'manual' || widget.manualCorrection?.isCorrected;
  const isSource = widget.confidence === 'sumber' && !isManual;

  /**
   * Warna latar kartu pilihan pengguna.
   *
   * Diterapkan dengan MENIMPA variabel CSS di elemen kartu, bukan dengan
   * menambahkan kelas ke tiap anak. Semua keturunan (judul, subtitle, border,
   * tombol ⋯, menu) otomatis ikut berubah, dan teksnya tetap terbaca karena
   * warna tinta dihitung dari kontras terhadap latar (`temaKartu`).
   * Saat pengguna tidak memilih warna, `vars` dikosongkan agar kartu memakai
   * token tema seperti biasa (tidak ada perubahan perilaku).
   */
  const mode = useThemeMode();
  // Desain katalog membawa warna kartunya sendiri bila pengguna belum memilih warna.
  // Desain bening (Kaca): warna kartunya rgba, jadi tinta dihitung dari warna
  // padanan yang terang, lalu latarnya diganti kaca buram.
  const gayaDesain = widget.style?.desain ? GAYA[widget.style.desain] : undefined;
  const kacaAktif = !widget.style?.kartu && Boolean(gayaDesain?.kaca);
  const kartuEfektif = widget.style?.kartu ?? (kacaAktif ? gayaDesain?.padanan ?? '#efe6dc' : gayaDesain?.kartu);
  const garisBening = kacaAktif && gayaDesain && !cukupTerang(gayaDesain.padanan ?? '#efe6dc') ? gayaDesain.garis : 'rgba(255,255,255,0.5)';
  const tema = temaKartu(kartuEfektif, mode);
  const pakaiWarnaKartu = warnaKartuValid(kartuEfektif);
  // Tema "Bersih & Tegas": satu aksen untuk semua kartu, warna lain hanya
  // untuk status data. Aksen tidak lagi bergantung pada jenis widget.
  const gayaKartu: React.CSSProperties = pakaiWarnaKartu
    ? ({
        ...tema.vars,
        ...(kacaAktif && gayaDesain
          ? {
              '--color-surface': gayaDesain.kartu,
              '--tegas-card': gayaDesain.kartu,
              '--color-line': garisBening,
              '--tegas-line': garisBening,
              backdropFilter: 'blur(18px) saturate(140%)',
              WebkitBackdropFilter: 'blur(18px) saturate(140%)',
              borderRadius: 20,
            }
          : {}),
        // Gaya bertepi tegas, bersudut khusus, atau berhuruf khusus (Blok, Bento, Koran, Neon).
        ...(gayaDesain && !widget.style?.kartu
          ? {
              ...(gayaDesain.tepi
                ? {
                    '--color-line': gayaDesain.tepi.warna,
                    '--tegas-line': gayaDesain.tepi.warna,
                    borderWidth: gayaDesain.tepi.tebal,
                    borderColor: gayaDesain.tepi.warna,
                    boxShadow: gayaDesain.tepi.bayangan !== 'none' ? gayaDesain.tepi.bayangan : undefined,
                  }
                : {}),
              ...(gayaDesain.sudutKartu !== undefined ? { borderRadius: gayaDesain.sudutKartu } : {}),
              ...(gayaDesain.huruf ? { fontFamily: gayaDesain.huruf } : {}),
            }
          : {}),
      } as React.CSSProperties)
    : {};

  // Kartu KPI/narasi berwajah Template Chart menggambar kotak & judulnya sendiri,
  // jadi bingkai dan kepala kartu kanvas tidak dipasang (tanpa judul dobel).
  const tanpaKepala = !widget.dataKosong && kartuBerjudulSendiri(widget) && propsKatalogHtml(widget) !== null;

  return (
    <div
      className={tanpaKepala ? 'relative flex flex-col h-full group' : 'relative card-tegas flex flex-col h-full overflow-hidden group'}
      style={tanpaKepala ? undefined : gayaKartu}
      data-kartu-warna={pakaiWarnaKartu ? kartuEfektif : undefined}
    >
      {/* Penanda aksen: blok padat 48x3px di sudut kiri atas. */}
      {!tanpaKepala && <span aria-hidden="true" className="accent-bar" />}

      {/* Widget Header — pita judul terpisah dari badan kartu oleh garis 1px,
          supaya judul tidak "berenang" bersama grafiknya. */}
      <div
        className={
          tanpaKepala
            ? 'absolute top-1.5 right-1.5 z-10 rounded-chip bg-surface/90 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity'
            : padat
              ? 'px-2.5 py-1 flex items-center justify-between gap-1.5 border-b border-line'
              : 'px-5 pt-4 pb-2.5 flex items-start justify-between gap-2 border-b border-line'
        }
      >
        {!tanpaKepala && (
        <div className="min-w-0">
          {/* Ikon kartu (khusus template): kotak kecil beraksen di atas judul,
              meniru pratinjau template agar kanvas nyata terlihat sama. */}
          {widget.ikon && (
            <span
              className={
                padat
                  ? 'inline-flex items-center justify-center w-[18px] h-[18px] rounded-[5px] mb-1'
                  : 'inline-flex items-center justify-center w-6 h-6 rounded-[7px] mb-1.5'
              }
              style={{ backgroundColor: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}
              aria-hidden="true"
            >
              {ikonKartu(widget.ikon)}
            </span>
          )}
          <h3
            className={
              padat
                ? 'text-[11px] font-bold text-ink leading-tight line-clamp-1'
                : 'text-[15px] font-bold text-ink tracking-[-0.01em] leading-snug line-clamp-2 min-h-[2.5em]'
            }
            title={widget.title}
          >
            {widget.title}
          </h3>
          {/* Subtitle disembunyikan untuk KPI yang punya target — badan kartu sudah
              menampilkan baris target di progress bar, jadi tidak dobel. */}
          {!padat && widget.subtitle && !(widget.type === 'kpi' && widget.kpi?.target !== undefined) && (
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-2 truncate mt-1" title={widget.subtitle}>
              {widget.subtitle}
            </p>
          )}
        </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Hanya penanda koreksi manual yang tersisa — tanpa label provenans AI/sumber. */}
          {isManual && (
            <span
              className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warn/15 text-warn border border-warn/30 cursor-help opacity-90 group-hover:opacity-100 transition-opacity"
              title={`Dikoreksi manual oleh ${widget.manualCorrection?.correctedBy || 'Analis'} (${widget.manualCorrection?.reason || 'Penyesuaian internal'}). Nilai asli: ${widget.manualCorrection?.originalValue}`}
            >
              <UserCheck className="w-3 h-3 text-warn" />
              <span>Koreksi Manual</span>
            </span>
          )}

          {/* Menu opsi (⋯) — satu-satunya tombol yang selalu tampak. Disembunyikan
              di mode pratinjau (widget template belum nyata, jadi tidak ada aksi). */}
          {!preview && (
          <div className="relative">
            <button
              ref={tombolMenuRef}
              onClick={() => (showMenu ? setShowMenu(false) : bukaMenu())}
              className="p-1 rounded-chip text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors"
              title="Menu Opsi Widget"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && posisiMenu && createPortal(
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div
                  className="fixed w-64 bg-surface rounded-control shadow-pop border border-line py-1 z-[45] text-xs text-ink-2"
                  style={{ top: posisiMenu.top, bottom: posisiMenu.bottom, right: posisiMenu.right }}
                >
                  {punyaDataChart(widget) && (
                    <>
                      <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-ink-3">
                        Template Chart
                      </div>
                      {/* Chart dari menu Template Chart yang datanya tersedia di kartu ini.
                          Daftar lengkap ada di editor (Ganti Template Chart). */}
                      <div className="px-3 pb-2 grid grid-cols-2 gap-1">
                        {chartKatalogCocok(widget).slice(0, 6).map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setShowMenu(false);
                              onEdit(pakaiChartKatalog(widget, id));
                            }}
                            className={`text-[11px] font-semibold px-1.5 py-1.5 rounded-chip border transition-colors truncate text-left ${
                              widget.chartId === id
                                ? 'bg-solid text-on-solid border-solid'
                                : 'bg-surface-2 text-ink-2 border-line hover:text-ink hover:border-line-strong'
                            }`}
                            title={CHART_DEFAULT[id].guna}
                          >
                            {CHART_DEFAULT[id].nama}
                          </button>
                        ))}
                      </div>
                      <div className="border-t border-line my-1" />
                    </>
                  )}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(widget);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-surface-2 flex items-center gap-2"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-brand" />
                    <span>Ganti Template Chart & Judul</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onManualCorrection(widget);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-warn/10 flex items-center gap-2 text-warn whitespace-nowrap"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-warn shrink-0" />
                    <span>Koreksi Angka Manual (F-14)</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDuplicate(widget);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-surface-2 flex items-center gap-2"
                  >
                    <Copy className="w-3.5 h-3.5 text-brand" />
                    <span>Duplikat Widget</span>
                  </button>
                  <div className="border-t border-line my-1" />
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(widget.id);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neg/10 flex items-center gap-2 text-neg"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-neg" />
                    <span>Hapus dari Dashboard</span>
                  </button>
                </div>
              </>,
              document.body
            )}
          </div>
          )}
        </div>
      </div>

      {/* Widget Content Body — tinggi minimum hanya untuk grafik/tabel; kartu KPI & narasi mengikuti isi */}
      <div
        className={`flex-1 flex flex-col ${
          tanpaKepala
            ? 'min-h-0'
            : padat
            ? 'px-2 pb-1 pt-0.5 min-h-0'
            : `px-5 pb-4 pt-3 ${
                ['line', 'bar', 'area', 'hbar', 'combo', 'pie', 'donut', 'treemap', 'funnel',
                  'waterfall', 'sankey', 'scatter', 'bubble', 'histogram', 'boxplot', 'heatmap',
                  'radar', 'map', 'gantt', 'table'].includes(widget.type) ? 'min-h-[140px]' : 'min-h-0'
              }`
        }`}
      >
        {widget.dataKosong ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-1.5 py-3">
            <Database className="w-6 h-6 text-ink-3 opacity-60" />
            <p className="text-[12px] font-semibold text-ink-2">Belum ada di dokumen</p>
            <p className="text-[10.5px] text-ink-3 leading-relaxed max-w-[34ch]">
              {widget.catatanData || 'Indikator ini tidak ditemukan di dokumen instansi.'}
            </p>
            <p className="text-[10px] text-ink-3 italic">
              Tidak ada angka contoh yang ditampilkan.
            </p>
          </div>
        ) : (
          <WidgetRenderer widget={widget} urutan={urutan} padat={padat} preview={preview} />
        )}
      </div>
    </div>
  );
};
