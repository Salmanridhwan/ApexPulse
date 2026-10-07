import React, { useRef, useState } from 'react';
import { LayoutGrid, Plus, Sparkles } from 'lucide-react';
import { WidgetSpec } from '../types';
import { WidgetCard } from './widgets/WidgetCard';

interface DashboardCanvasProps {
  widgets: WidgetSpec[];
  onEditWidget: (widget: WidgetSpec) => void;
  onManualCorrection: (widget: WidgetSpec) => void;
  onDeleteWidget: (widgetId: string) => void;
  onDuplicateWidget: (widget: WidgetSpec) => void;
  onReorderWidgets: (orderedIds: string[]) => void;
  onResizeWidget: (widgetId: string, w: number) => void;
  onOpenCatalog: () => void;
  onOpenChat: () => void;
  /** Mode lihat-saja (mis. saat filter dashboard aktif): matikan drag & resize. */
  readOnly?: boolean;
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
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-surface-2/50 rounded-control border-2 border-dashed border-line">
        <div className="w-16 h-16 rounded-control bg-surface-2 flex items-center justify-center text-brand mb-4">
          <LayoutGrid className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-ink">
          Bangun dashboard pertama Anda
        </h3>
        <p className="text-sm text-ink-2 max-w-md mt-1 mb-6">
          Minta dashboard dari dokumen resmi BUMD lewat chat, atau susun sendiri dari preset yang sudah tersedia.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenChat}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-on-brand bg-brand hover:bg-brand-ink rounded-control shadow-sm transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>Buat via Chat</span>
          </button>
          <button
            onClick={onOpenCatalog}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Pilih dari Katalog</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4 auto-rows-min pb-12">
      {widgets.map((widget) => {
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
            draggable={!readOnly}
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
            className={`${colSpan} ${tinggiMin} rounded-control relative transition-opacity ${dragId === widget.id ? 'opacity-40' : ''
              } ${overId === widget.id && dragId && dragId !== widget.id ? 'ring-2 ring-brand' : ''}`}
          >
            <WidgetCard
              widget={widget}
              onEdit={onEditWidget}
              onManualCorrection={onManualCorrection}
              onDelete={onDeleteWidget}
              onDuplicate={onDuplicateWidget}
            />
            {/* Resize handle: strip tipis di tepi kiri & kanan — tarik untuk ubah lebar. */}
            {!readOnly && ([-1, 1] as const).map((arah) => (
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
  );
};
