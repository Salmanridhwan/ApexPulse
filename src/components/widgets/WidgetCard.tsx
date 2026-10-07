import React, { useState } from 'react';
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
}

export const WidgetCard: React.FC<WidgetCardProps> = ({
  widget,
  onEdit,
  onManualCorrection,
  onDelete,
  onDuplicate,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const isManual = widget.confidence === 'manual' || widget.manualCorrection?.isCorrected;
  const isSource = widget.confidence === 'sumber' && !isManual;

  return (
    <div className="relative card card-lift flex flex-col h-full overflow-hidden group">
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

          {/* Menu opsi (⋯) — satu-satunya tombol yang selalu tampak */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded-chip text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors"
              title="Menu Opsi Widget"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-52 bg-surface rounded-control shadow-pop border border-line py-1 z-30 text-xs text-ink-2">
                  {punyaDataChart(widget) && (
                    <>
                      <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-ink-3">
                        Tipe Grafik
                      </div>
                      <div className="px-3 pb-1.5">
                        <div className="segmented w-full">
                          {(['line', 'bar', 'area', 'pie', 'hbar', 'scatter', 'funnel'] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => onEdit({ ...widget, type: t })}
                              className={`segmented-item flex-1 ${
                                widget.type === t ? 'segmented-item-active' : ''
                              }`}
                              title={LABEL_TIPE[t]}
                            >
                              {LABEL_TIPE[t]}
                            </button>
                          ))}
                        </div>
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
                    className="w-full text-left px-3 py-1.5 hover:bg-warn/10 flex items-center gap-2 text-warn"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-warn" />
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
              </>
            )}
          </div>
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
