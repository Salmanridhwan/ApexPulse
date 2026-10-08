import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Copy,
  Edit2,
  MoreVertical,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { WidgetSpec } from '../../types';
import { WidgetRenderer } from './WidgetRenderer';
import { punyaDataChart } from '../../services/spec/widgetTypes';
import { temaKartu, warnaKartuValid } from './widgetCardTheme';
import { useThemeMode } from '../../theme';

/** Label pendek untuk tombol ganti tipe cepat di menu widget. */
const LABEL_TIPE: Record<string, string> = {
  line: 'Garis', bar: 'Batang', area: 'Area', pie: 'Pai', donut: 'Donat',
  hbar: 'Horiz.', scatter: 'Sebar', bubble: 'Gelembung', funnel: 'Funnel',
  treemap: 'Treemap', waterfall: 'Waterfall', sankey: 'Sankey', radar: 'Radar',
  histogram: 'Histogram', boxplot: 'Box', combo: 'Combo', map: 'Peta',
  gantt: 'Gantt', heatmap: 'Heatmap', gauge: 'Gauge', kpi: 'KPI',
};

interface WidgetCardProps {
  widget: WidgetSpec;
  onEdit: (widget: WidgetSpec) => void;
  onManualCorrection: (widget: WidgetSpec) => void;
  onDelete: (widgetId: string) => void;
  onDuplicate: (widget: WidgetSpec) => void;
  /** Mode pratinjau (mis. galeri template): sembunyikan menu ⋯ karena widget belum nyata. */
  preview?: boolean;
}

export const WidgetCard: React.FC<WidgetCardProps> = ({
  widget,
  onEdit,
  onManualCorrection,
  onDelete,
  onDuplicate,
  preview = false,
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
  const tema = temaKartu(widget.style?.kartu, mode);
  const pakaiWarnaKartu = warnaKartuValid(widget.style?.kartu);
  const gayaKartu = pakaiWarnaKartu ? (tema.vars as React.CSSProperties) : undefined;

  return (
    <div
      className="relative card card-lift flex flex-col h-full overflow-hidden group"
      style={gayaKartu}
      data-kartu-warna={pakaiWarnaKartu ? widget.style?.kartu : undefined}
    >
      {/* Widget Header — minimal: judul + titik tiga (ala referensi) */}
      <div className="px-5 pt-4 pb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold text-ink truncate" title={widget.title}>
            {widget.title}
          </h3>
          {/* Subtitle disembunyikan untuk KPI yang punya target — badan kartu sudah
              menampilkan baris target di progress bar, jadi tidak dobel. */}
          {widget.subtitle && !(widget.type === 'kpi' && widget.kpi?.target !== undefined) && (
            <p className="text-xs text-ink-2 truncate mt-0.5" title={widget.subtitle}>
              {widget.subtitle}
            </p>
          )}
        </div>

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
                        Tipe Grafik
                      </div>
                      {/* Grid 3 kolom: 7 pilihan tetap terbaca tanpa terpotong,
                          berbeda dari deretan pil satu baris yang bikin sesak. */}
                      <div className="px-3 pb-2 grid grid-cols-3 gap-1">
                        {(['line', 'bar', 'area', 'pie', 'hbar', 'scatter', 'funnel'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => onEdit({ ...widget, type: t })}
                            className={`text-[11px] font-semibold px-1.5 py-1.5 rounded-chip border transition-colors truncate ${
                              widget.type === t
                                ? 'bg-ink text-surface border-ink'
                                : 'bg-surface-2 text-ink-2 border-line hover:text-ink hover:border-line-strong'
                            }`}
                            title={LABEL_TIPE[t]}
                          >
                            {LABEL_TIPE[t]}
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
                    <span>Ubah Visualisasi & Tipe</span>
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
        className={`px-5 pb-4 pt-1 flex-1 flex flex-col ${
          ['line', 'bar', 'area', 'hbar', 'combo', 'pie', 'donut', 'treemap', 'funnel',
            'waterfall', 'sankey', 'scatter', 'bubble', 'histogram', 'boxplot', 'heatmap',
            'radar', 'map', 'gantt', 'table'].includes(widget.type) ? 'min-h-[140px]' : 'min-h-0'
        }`}
      >
        <WidgetRenderer widget={widget} />
      </div>
    </div>
  );
};
