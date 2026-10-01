import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Copy,
  Edit2,
  FileCheck,
  GripVertical,
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

  // Confidence styling
  const isManual = widget.confidence === 'manual' || widget.manualCorrection?.isCorrected;
  const isSource = widget.confidence === 'sumber' && !isManual;

  return (
    <div className="relative bg-white rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow flex flex-col h-full overflow-hidden group">
      {/* Widget Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-2 bg-slate-50/60">
        <div className="flex items-start gap-2 min-w-0">
          <div className="mt-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-800 truncate" title={widget.title}>
                {widget.title}
              </h3>
              {widget.category && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {widget.category}
                </span>
              )}
            </div>
            {widget.subtitle && (
              <p className="text-xs text-slate-500 truncate mt-0.5" title={widget.subtitle}>
                {widget.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Confidence & Action Menu */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Chart Type Switcher for chart widgets */}
          {['line', 'bar', 'area'].includes(widget.type) && (
            <div className="hidden sm:flex items-center gap-0.5 bg-slate-100 rounded-md p-0.5">
              <button
                type="button"
                onClick={() => onEdit({ ...widget, type: 'line' })}
                className={`px-1.5 py-0.5 text-[10px] rounded font-medium transition-colors ${
                  widget.type === 'line' ? 'bg-white text-sky-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Ganti ke Diagram Garis"
              >
                Garis
              </button>
              <button
                type="button"
                onClick={() => onEdit({ ...widget, type: 'bar' })}
                className={`px-1.5 py-0.5 text-[10px] rounded font-medium transition-colors ${
                  widget.type === 'bar' ? 'bg-white text-sky-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Ganti ke Diagram Batang"
              >
                Batang
              </button>
              <button
                type="button"
                onClick={() => onEdit({ ...widget, type: 'area' })}
                className={`px-1.5 py-0.5 text-[10px] rounded font-medium transition-colors ${
                  widget.type === 'area' ? 'bg-white text-sky-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Ganti ke Diagram Area"
              >
                Area
              </button>
            </div>
          )}

          {/* Confidence Badge */}
          {isManual ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 cursor-help"
              title={`Dikoreksi manual oleh ${widget.manualCorrection?.correctedBy || 'Analis'} (${widget.manualCorrection?.reason || 'Penyesuaian internal'}). Nilai asli: ${widget.manualCorrection?.originalValue}`}
            >
              <UserCheck className="w-3 h-3 text-amber-600" />
              <span>Dikoreksi Manual</span>
            </span>
          ) : isSource ? (
            <button
              onClick={() => widget.citations[0] && onOpenCitation(widget.citations[0])}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
              title={`Sumber Resmi (${widget.citations.length} sitasi dokumen)`}
            >
              <FileCheck className="w-3 h-3 text-emerald-600" />
              <span>Sumber Resmi</span>
            </button>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-50 text-sky-700 border border-sky-200"
              title="Disintesis melalui model inferensi RAG"
            >
              <Sparkles className="w-3 h-3 text-sky-600" />
              <span>Inferensi AI</span>
            </span>
          )}

          {/* More Actions Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Menu Opsi Widget"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-30 text-xs text-slate-700">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(widget);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Ubah Visualisasi & Tipe</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onManualCorrection(widget);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-amber-700"
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
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-sky-700"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-sky-600" />
                      <span>Lihat Dokumen Sitasi ({widget.citations.length})</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDuplicate(widget);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Duplikat Widget</span>
                  </button>
                  <div className="border-t border-slate-100 my-1" />
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

      {/* Widget Content Body */}
      <div className="p-4 flex-1 flex flex-col min-h-[140px]">
        <WidgetRenderer widget={widget} onOpenCitation={onOpenCitation} />
      </div>

      {/* Footer Info / Sitasi Quick Bar */}
      {widget.citations.length > 0 && (
        <div className="px-4 py-2 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <button
            onClick={() => onOpenCitation(widget.citations[0])}
            className="flex items-center gap-1.5 hover:text-sky-700 transition-colors truncate max-w-[85%]"
          >
            <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">
              {widget.citations[0].docName} (Hal. {widget.citations[0].page})
            </span>
          </button>
          <span className="text-[10px] text-slate-400 shrink-0 font-medium">
            {widget.periode || '2026'}
          </span>
        </div>
      )}
    </div>
  );
};
