import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid, Plus, Sparkles } from 'lucide-react';
import { WidgetSpec } from '../types';
import { WidgetCard } from './widgets/WidgetCard';
import { hitungBarisKanvas, tinggiBaris } from '../services/tataLetak/satuHalaman';

interface DashboardCanvasProps {
  widgets: WidgetSpec[];
  onEditWidget: (widget: WidgetSpec) => void;
  onManualCorrection: (widget: WidgetSpec) => void;
  onDeleteWidget: (widgetId: string) => void;
  onDuplicateWidget: (widget: WidgetSpec) => void;
  onReorderWidgets: (orderedIds: string[]) => void;
  onResizeWidget: (widgetId: string, w: number) => void;
  /** Opsional: di halaman tautan publik tidak ada sesi instansi, jadi tidak ditampilkan. */
  onOpenCatalog?: () => void;
  onOpenChat?: () => void;
  /** Mode lihat-saja (mis. saat filter dashboard aktif): matikan drag & resize. */
  readOnly?: boolean;
  /**
   * Mode pratinjau (galeri template): render kartu persis seperti kanvas, tetapi
   * widget belum nyata — sembunyikan menu ⋯ dan matikan drag/resize.
   */
  preview?: boolean;
  /**
   * Tampilkan dashboard dalam SATU layar penuh tanpa scroll.
   *
   * Tinggi baris dihitung dari sisa tinggi layar, jadi seluruh widget selalu
   * terlihat sekaligus (grafik mengecil sendiri karena ECharts mengikuti ukuran
   * kartu). Hanya berlaku di layar lebar (≥1024px); di layar kecil kanvas tetap
   * bisa digeser karena kartu selebar layar tidak mungkin dipaksa muat.
   */
  satuHalaman?: boolean;
}

export const DashboardCanvas: React.FC<DashboardCanvasProps> = ({
  widgets,
  onEditWidget,
  onManualCorrection,
  onDeleteWidget,
  onDuplicateWidget,
  onReorderWidgets,
  onResizeWidget,
  onOpenCatalog,
  onOpenChat,
  readOnly = false,
  preview = false,
  satuHalaman = false,
}) => {
  // Drag-and-drop reorder widget (HTML5 DnD native, tanpa library).
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Resize lebar widget: tarik strip di tepi kanan kartu (mouse event native).
  const [resizeId, setResizeId] = useState<string | null>(null);
  const [previewW, setPreviewW] = useState<number | null>(null);
  const resizeInfo = useRef<{ id: string; startX: number; startW: number; pxPerCol: number; arah: 1 | -1 } | null>(null);
  const previewWRef = useRef<number | null>(null);

  /** Panjang kolom lg (dari 12) yang dipakai kartu, konsisten dengan pemetaan colSpan. */
  const lgCols = (w: number): number => (w >= 10 ? 12 : w >= 7 ? 8 : w >= 5 ? 6 : w >= 4 ? 4 : w >= 3 ? 3 : 2);

  // ===== Mode satu halaman =====
  /** Wadah kanvas — dipakai mengukur sisa tinggi layar. */
  const wadahRef = useRef<HTMLDivElement | null>(null);
  const [tinggiTersedia, setTinggiTersedia] = useState(0);
  const [layarLebar, setLayarLebar] = useState(false);

  /**
   * Ukur dari tepi atas kanvas sampai dasar layar. Dipakai `useLayoutEffect` supaya
   * tinggi sudah benar sebelum layar digambar (tidak ada kedipan/gulir sesaat).
   * Diukur ulang saat jendela berubah ukuran dan sekali lagi setelah 350 ms —
   * baris alat di atas kanvas (filter, tombol) kadang muncul belakangan.
   */
  useLayoutEffect(() => {
    if (!satuHalaman) return;
    const ukur = () => {
      const el = wadahRef.current;
      if (!el) return;
      setLayarLebar(window.innerWidth >= 1024);
      const atas = el.getBoundingClientRect().top;
      setTinggiTersedia(Math.max(0, Math.round(window.innerHeight - atas - 12)));
    };
    ukur();
    const tunda = window.setTimeout(ukur, 350);
    window.addEventListener('resize', ukur);
    /**
     * Tinggi di atas kanvas bisa berubah tanpa jendela diubah ukurannya (mis.
     * baris filter muncul, atau tombol alat bertambah). Pantau tinggi halaman;
     * `setState` dengan nilai sama tidak memicu render, jadi tidak ada loop.
     */
    const pengamat = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => ukur()) : null;
    pengamat?.observe(document.body);
    return () => {
      window.clearTimeout(tunda);
      window.removeEventListener('resize', ukur);
      pengamat?.disconnect();
    };
  }, [satuHalaman, widgets.length]);

  /**
   * Jumlah baris yang dibutuhkan grid 12 kolom (sama dengan cara CSS grid
   * menempatkan kartu: kalau sisa kolom tidak cukup, kartu pindah baris).
   */
  const barisKanvas = useMemo(() => hitungBarisKanvas(widgets), [widgets]);

  /** Prasyarat mode satu halaman (dipakai juga untuk memilih jarak/padding). */
  const pasSatuHalamanAwal = satuHalaman && layarLebar && tinggiTersedia > 0 && barisKanvas > 0;

  /**
   * Mode satu halaman memakai jarak & padding lebih rapat (10px / 12px) supaya
   * ruang yang tersisa benar-benar dipakai kartu, bukan celah.
   */
  const JARAK = pasSatuHalamanAwal ? 10 : 16;
  const PADDING = pasSatuHalamanAwal ? 12 : 20;
  /** Baris lebih pendek dari ini membuat grafik tak terbaca → pakai skala turun. */
  const BARIS_MIN = 84;

  const pasSatuHalaman = pasSatuHalamanAwal;
  const tinggiIsi = Math.max(0, tinggiTersedia - PADDING * 2);
  /**
   * Tinggi baris & skala dihitung murni di `satuHalaman.ts` (ada tesnya): kalau
   * baris minimum pun tidak cukup, seluruh grid diperkecil dengan `scale`
   * supaya TETAP muat satu layar tanpa scroll.
   */
  const tata = pasSatuHalaman ? tinggiBaris(tinggiIsi, barisKanvas, JARAK, BARIS_MIN) : { tinggi: 0, skala: 1 };
  const tinggiBarisFinal = tata.tinggi;
  const skala = tata.skala;
  const tinggiGrid = barisKanvas * tinggiBarisFinal + JARAK * Math.max(0, barisKanvas - 1);
  /** Diskritkan lebar mentah ke bucket yang dikenali pemetaan colSpan. */
  const bucket = (w: number): number => (w >= 10 ? 12 : w >= 7 ? 8 : w >= 5 ? 6 : w >= 4 ? 4 : w >= 3 ? 3 : 2);

  /** arah: 1 = tepi kanan (geser kanan = melebar), -1 = tepi kiri (geser kiri = melebar). */
  const mulaiResize = (e: React.MouseEvent, widget: WidgetSpec, arah: 1 | -1) => {
    e.preventDefault();
    e.stopPropagation();
    const kartu = (e.currentTarget as HTMLElement).closest('[data-widget-id]') as HTMLElement | null;
    const startW = widget.grid?.w ?? 6;
    const pxPerCol = kartu ? kartu.getBoundingClientRect().width / lgCols(startW) : 100;
    resizeInfo.current = { id: widget.id, startX: e.clientX, startW, pxPerCol, arah };
    setResizeId(widget.id);
    setPreviewW(startW);
    previewWRef.current = startW;

    const pindah = (ev: MouseEvent) => {
      if (!resizeInfo.current) return;
      const delta = ((ev.clientX - resizeInfo.current.startX) / resizeInfo.current.pxPerCol) * resizeInfo.current.arah;
      const w = bucket(Math.round(resizeInfo.current.startW + delta));
      previewWRef.current = w;
      setPreviewW(w);
    };
    const selesai = () => {
      window.removeEventListener('mousemove', pindah);
      window.removeEventListener('mouseup', selesai);
      if (resizeInfo.current && previewWRef.current !== resizeInfo.current.startW) {
        onResizeWidget(resizeInfo.current.id, previewWRef.current ?? resizeInfo.current.startW);
      }
      resizeInfo.current = null;
      previewWRef.current = null;
      setResizeId(null);
      setPreviewW(null);
    };
    window.addEventListener('mousemove', pindah);
    window.addEventListener('mouseup', selesai);
  };

  const pindahkan = (srcId: string, dstId: string) => {
    if (!srcId || srcId === dstId) return;
    const ids = widgets.map((w) => w.id);
    const dari = ids.indexOf(srcId);
    const ke = ids.indexOf(dstId);
    if (dari === -1 || ke === -1) return;
    ids.splice(ke, 0, ids.splice(dari, 1)[0]);
    onReorderWidgets(ids);
  };
  if (widgets.length === 0) {
    return (
      <div className="canvas-tegas flex-1 flex flex-col items-center justify-center p-12 text-center">
        <div className="w-14 h-14 rounded-[6px] flex items-center justify-center mb-4"
          style={{ backgroundColor: 'var(--tegas-accent)', boxShadow: '3px 3px 0 0 var(--tegas-ink)' }}>
          <LayoutGrid className="w-7 h-7 text-on-brand" />
        </div>
        <h3 className="text-base font-semibold text-ink">
          Bangun dashboard pertama Anda
        </h3>
        <p className="text-sm text-ink-2 max-w-md mt-1 mb-6">
          {onOpenChat || onOpenCatalog
            ? 'Minta dashboard dari dokumen resmi BUMD lewat chat, atau susun sendiri dari preset yang sudah tersedia.'
            : 'Dashboard ini belum memiliki widget. Tambahkan widget dari workspace Aiones Boards — halaman ini hanya mengubah widget yang sudah ada.'}
        </p>
        <div className="flex items-center gap-3">
          {onOpenChat && (
            <button
              onClick={onOpenChat}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-on-brand bg-brand hover:brightness-95 rounded-control shadow-sm transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>Buat via Chat</span>
            </button>
          )}
          {onOpenCatalog && (
            <button
              onClick={onOpenCatalog}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Pilih dari Katalog</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wadahRef}
      className={`canvas-tegas ${pasSatuHalaman ? 'overflow-hidden' : 'p-4 sm:p-5'}`}
      style={pasSatuHalaman ? { height: tinggiTersedia, padding: PADDING } : undefined}
    >
      <div
        className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4 auto-rows-min pb-4"
        style={
          pasSatuHalaman
            ? {
                gridTemplateRows: `repeat(${barisKanvas}, minmax(0, ${tinggiBarisFinal}px))`,
                height: tinggiGrid,
                rowGap: JARAK,
                columnGap: JARAK,
                paddingBottom: 0,
                transform: skala < 1 ? `scale(${skala})` : undefined,
                transformOrigin: 'top left',
                width: skala < 1 ? `${100 / skala}%` : undefined,
              }
            : undefined
        }
      >
      {widgets.map((widget, urutan) => {
        // Map grid.w to responsive Tailwind column span
        // Saat resize aktif, pakai lebar preview agar perubahan terlihat live.
        const wAktif = resizeId === widget.id && previewW !== null ? previewW : widget.grid?.w;
        let colSpan = 'col-span-1 md:col-span-4 lg:col-span-2';
        if (wAktif >= 10) {
          colSpan = 'col-span-1 md:col-span-12 lg:col-span-12';
        } else if (wAktif >= 7) {
          colSpan = 'col-span-1 md:col-span-12 lg:col-span-8';
        } else if (wAktif >= 5) {
          colSpan = 'col-span-1 md:col-span-6 lg:col-span-6';
        } else if (wAktif >= 4) {
          colSpan = 'col-span-1 md:col-span-6 lg:col-span-4';
        } else if (wAktif >= 3) {
          colSpan = 'col-span-1 md:col-span-4 lg:col-span-3';
        }
        
        // Tinggi minimum mengikuti isi: kartu KPI/narasi ringkas, grafik & tabel butuh ruang.
        const tinggiMin = ['line', 'bar', 'area', 'hbar', 'combo', 'pie', 'donut', 'treemap',
          'funnel', 'waterfall', 'sankey', 'scatter', 'bubble', 'histogram', 'boxplot',
          'heatmap', 'radar', 'map', 'gantt', 'table'].includes(widget.type)
          ? 'min-h-[248px]'
          : 'min-h-[110px]';

        return (
          <div
            key={widget.id}
            data-widget-id={widget.id}
            draggable={!readOnly && !preview}
            onDragStart={(e) => {
              setDragId(widget.id);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', widget.id);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setOverId(widget.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              pindahkan(dragId || e.dataTransfer.getData('text/plain'), widget.id);
              setDragId(null);
              setOverId(null);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            className={`${colSpan} ${pasSatuHalaman ? 'min-h-0 overflow-hidden' : tinggiMin} rounded-control relative transition-opacity ${dragId === widget.id ? 'opacity-40' : ''
              } ${overId === widget.id && dragId && dragId !== widget.id ? 'ring-2 ring-brand' : ''}`}
          >
            <WidgetCard
              widget={widget}
              urutan={urutan}
              preview={preview}
              padat={pasSatuHalaman}
              onEdit={onEditWidget}
              onManualCorrection={onManualCorrection}
              onDelete={onDeleteWidget}
              onDuplicate={onDuplicateWidget}
            />
            {/* Resize handle: strip tipis di tepi kiri & kanan — tarik untuk ubah lebar. */}
            {!readOnly && !preview && ([-1, 1] as const).map((arah) => (
              <span
                key={arah}
                data-resize={arah === -1 ? 'kiri' : 'kanan'}
                onMouseDown={(e) => mulaiResize(e, widget, arah)}
                className={`absolute top-0 h-full w-1.5 cursor-ew-resize transition-colors z-10 ${arah === -1 ? 'left-0' : 'right-0'
                  } ${resizeId === widget.id ? 'bg-brand/70' : 'bg-transparent hover:bg-brand/40'
                  }`}
                title="Tarik untuk ubah lebar widget"
              />
            ))}
          </div>
        );
      })}
      </div>
    </div>
  );
};
