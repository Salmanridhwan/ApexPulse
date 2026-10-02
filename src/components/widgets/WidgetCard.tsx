import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Copy,
  Edit2,
  FileCheck,
  MoreVertical,
  Sparkles,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { Citation, WidgetSpec } from '../../types';
import { WidgetRenderer } from './WidgetRenderer';

interface WidgetCardProps {
  widget: WidgetSpec;
  onEdit: (widget: WidgetSpec) => void;
  onManualCorrection: (widget: WidgetSpec) => void;
  onDelete: (widgetId: string) => void;
  onDuplicate: (widget: WidgetSpec) => void;
  onOpenCitation: (citation: Citation) => void;
}

export const WidgetCard: React.FC<WidgetCardProps> = ({
  widget,
  onEdit,
  onManualCorrection,
  onDelete,
  onDuplicate,
  onOpenCitation,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const isManual = widget.confidence === 'manual' || widget.manualCorrection?.isCorrected;
  const isSource = widget.confidence === 'sumber' && !isManual;

  return (
    <div className="relative bg-white rounded-xl border border-blue-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex flex-col h-full overflow-hidden group">
      {/* Widget Header — minimal: judul + titik tiga (ala referensi) */}
      <div className="px-5 pt-4 pb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold text-slate-900 truncate" title={widget.title}>
            {widget.title}
          </h3>
          {/* Subtitle disembunyikan untuk KPI yang punya target — badan kartu sudah
              menampilkan baris target di progress bar, jadi tidak dobel. */}
          {widget.subtitle && !(widget.type === 'kpi' && widget.kpi?.target !== undefined) && (
            <p className="text-xs text-slate-500 truncate mt-0.5" title={widget.subtitle}>
              {widget.subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Status sumber data — hanya tampil saat hover agar kartu bersih */}
          {isManual ? (
            <span
              className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 cursor-help opacity-90 group-hover:opacity-100 transition-opacity"
              title={`Dikoreksi manual oleh ${widget.manualCorrection?.correctedBy || 'Analis'} (${widget.manualCorrection?.reason || 'Penyesuaian internal'}). Nilai asli: ${widget.manualCorrection?.originalValue}`}
            >
              <UserCheck className="w-3 h-3 text-amber-600" />
              <span>Koreksi Manual</span>
            </span>
          ) : isSource ? (
            <button
              onClick={() => widget.citations[0] && onOpenCitation(widget.citations[0])}
              className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all opacity-90 group-hover:opacity-100"
              title={`Sumber Resmi (${widget.citations.length} sitasi dokumen) — klik untuk lihat`}
            >
              <FileCheck className="w-3 h-3 text-emerald-600" />
              <span>Sumber Resmi</span>
            </button>
          ) : (
            <span
              className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 opacity-90 group-hover:opacity-100 transition-opacity"
              title="Disintesis melalui model inferensi RAG"
            >
              <Sparkles className="w-3 h-3 text-sky-600" />
              <span>Inferensi AI</span>
            </span>
          )}

          {/* Menu opsi (⋯) — satu-satunya tombol yang selalu tampak */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded-md text-slate-400 hover:text-blue-800 hover:bg-blue-50 transition-colors"
              title="Menu Opsi Widget"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-blue-100 py-1 z-30 text-xs text-slate-700">
                  {['line', 'bar', 'area'].includes(widget.type) && (
                    <>
                      <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        Tipe Grafik
                      </div>
                      <div className="px-3 pb-1.5 flex gap-1">
                        {(['line', 'bar', 'area'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => onEdit({ ...widget, type: t })}
                            className={`flex-1 px-1.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                              widget.type === t
                                ? 'bg-blue-800 text-white'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                          >
                            {t === 'line' ? 'Garis' : t === 'bar' ? 'Batang' : 'Area'}
                          </button>
                        ))}
                      </div>
                      <div className="border-t border-blue-50 my-1" />
                    </>
                  )}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(widget);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 flex items-center gap-2"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                    <span>Ubah Visualisasi & Tipe</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onManualCorrection(widget);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-amber-50 flex items-center gap-2 text-amber-700"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Koreksi Angka Manual (F-14)</span>
                  </button>
                  {widget.citations.length > 0 && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onOpenCitation(widget.citations[0]);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-blue-50 flex items-center gap-2 text-blue-700"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      <span>Lihat Dokumen Sitasi ({widget.citations.length})</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDuplicate(widget);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 flex items-center gap-2"
                  >
                    <Copy className="w-3.5 h-3.5 text-blue-500" />
                    <span>Duplikat Widget</span>
                  </button>
                  <div className="border-t border-blue-50 my-1" />
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(widget.id);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-rose-50 flex items-center gap-2 text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Hapus dari Dashboard</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Widget Content Body — tinggi minimum hanya untuk grafik/tabel; kartu KPI & narasi mengikuti isi */}
      <div
        className={`px-5 pb-4 pt-1 flex-1 flex flex-col ${
          ['line', 'bar', 'area', 'donut', 'table', 'heatmap'].includes(widget.type) ? 'min-h-[140px]' : 'min-h-0'
        }`}
      >
        <WidgetRenderer widget={widget} onOpenCitation={onOpenCitation} />
      </div>

      {/* Footer sitasi — tampil saat hover saja */}
      {widget.citations.length > 0 && (
        <div className="px-5 py-2 border-t border-blue-50 flex items-center justify-between text-[11px] text-slate-500 transition-opacity">
          <button
            onClick={() => onOpenCitation(widget.citations[0])}
            className="flex items-center gap-1.5 hover:text-blue-800 transition-colors truncate max-w-[85%]"
          >
            <BookOpen className="w-3 h-3 text-blue-400 shrink-0" />
            <span className="truncate">
              {widget.citations[0].docName} (Hal. {widget.citations[0].page})
            </span>
          </button>
          <span className="text-[10px] text-blue-600 shrink-0 font-semibold">
            {widget.periode || '2026'}
          </span>
        </div>
      )}
    </div>
  );
};
