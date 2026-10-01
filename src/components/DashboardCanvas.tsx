import React, { useState } from 'react';
import { LayoutGrid, Plus, Sparkles } from 'lucide-react';
import { Citation, WidgetSpec } from '../types';
import { WidgetCard } from './widgets/WidgetCard';

interface DashboardCanvasProps {
  widgets: WidgetSpec[];
  onEditWidget: (widget: WidgetSpec) => void;
  onManualCorrection: (widget: WidgetSpec) => void;
  onDeleteWidget: (widgetId: string) => void;
  onDuplicateWidget: (widget: WidgetSpec) => void;
  onReorderWidgets: (orderedIds: string[]) => void;
  onOpenCitation: (citation: Citation) => void;
  onOpenCatalog: () => void;
  onOpenChat: () => void;
}

export const DashboardCanvas: React.FC<DashboardCanvasProps> = ({
  widgets,
  onEditWidget,
  onManualCorrection,
  onDeleteWidget,
  onDuplicateWidget,
  onReorderWidgets,
  onOpenCitation,
  onOpenCatalog,
  onOpenChat,
}) => {
  // Drag-and-drop reorder widget (HTML5 DnD native, tanpa library).
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

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
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50 rounded-lg border-2 border-dashed border-slate-200">
        <div className="w-16 h-16 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 mb-4">
          <LayoutGrid className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-slate-800">
          Kanvas Dashboard Belum Memiliki Widget
        </h3>
        <p className="text-sm text-slate-500 max-w-md mt-1 mb-6">
          Mulai dengan membuat dashboard otomatis dari pangkalan dokumen RAG BUMD lewat chat cerdas atau pilih dari 40 preset katalog siap pakai.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenChat}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate via Chat</span>
          </button>
          <button
            onClick={onOpenCatalog}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Buka Katalog Widget</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-5 auto-rows-min pb-12">
      {widgets.map((widget) => {
        // Map grid.w to responsive Tailwind column span
        let colSpan = 'col-span-1 md:col-span-6 lg:col-span-4';
        if (widget.grid?.w >= 10 || widget.type === 'narasi') {
          colSpan = 'col-span-1 md:col-span-6 lg:col-span-12';
        } else if (widget.grid?.w >= 7) {
          colSpan = 'col-span-1 md:col-span-6 lg:col-span-8';
        } else if (widget.grid?.w >= 5) {
          colSpan = 'col-span-1 md:col-span-6 lg:col-span-6';
        }

        return (
          <div
            key={widget.id}
            data-widget-id={widget.id}
            draggable
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
            className={`${colSpan} min-h-[220px] rounded-lg transition-opacity ${
              dragId === widget.id ? 'opacity-40' : ''
            } ${overId === widget.id && dragId && dragId !== widget.id ? 'ring-2 ring-sky-400' : ''}`}
          >
            <WidgetCard
              widget={widget}
              onEdit={onEditWidget}
              onManualCorrection={onManualCorrection}
              onDelete={onDeleteWidget}
              onDuplicate={onDuplicateWidget}
              onOpenCitation={onOpenCitation}
            />
          </div>
        );
      })}
    </div>
  );
};
