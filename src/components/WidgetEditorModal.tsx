import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Check,
  Edit3,
  FileCheck,
  History,
  Layout,
  Sliders,
  Type,
  UserCheck,
  X,
} from 'lucide-react';
import { WidgetSpec, WidgetType } from '../types';
import { tipeKompatibel, GRUP_VISUALISASI } from '../services/spec/widgetTypes';

interface WidgetEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  widget: WidgetSpec | null;
  onSave: (updatedWidget: WidgetSpec) => void;
  initialTab?: 'config' | 'correction';
}

export const WidgetEditorModal: React.FC<WidgetEditorModalProps> = ({
  isOpen,
  onClose,
  widget,
  onSave,
  initialTab = 'config',
}) => {
  const [activeTab, setActiveTab] = useState<'config' | 'correction'>(initialTab);

  // Form State
  const [title, setTitle] = useState(widget?.title || '');
  const [subtitle, setSubtitle] = useState(widget?.subtitle || '');
  const [type, setType] = useState<WidgetType>(widget?.type || 'kpi');
  const [category, setCategory] = useState(widget?.category || 'Operasional');
  const [periode, setPeriode] = useState(widget?.periode || '2026-Q1');
  const [unitKerja, setUnitKerja] = useState(widget?.unitKerja || 'Semua Unit');

  // Manual Correction State (F-14)
  const currentVal =
    widget?.kpi?.value ??
    widget?.chart?.series[0]?.data[widget?.chart?.series[0]?.data.length - 1] ??
    '-';

  const [correctedValue, setCorrectedValue] = useState(
    widget?.manualCorrection?.isCorrected ? String(widget.manualCorrection.correctedValue) : String(currentVal)
  );
  const [correctedBy, setCorrectedBy] = useState(
    widget?.manualCorrection?.correctedBy || 'Siti Rahmawati, S.E. (Analis BUMD)'
  );
  const [correctionReason, setCorrectionReason] = useState(
    widget?.manualCorrection?.reason || 'Penyesuaian hasil rekonsiliasi audit internal'
  );
  const [isApplyingCorrection, setIsApplyingCorrection] = useState(
    widget?.manualCorrection?.isCorrected || false
  );

  if (!isOpen || !widget) return null;

  // Hanya tipe yang datanya tersedia di widget ini — supaya tak ada pilihan
  // yang berujung kartu kosong (mis. beralih ke Tabel pada widget garis).
  const chartTypes = tipeKompatibel(widget);

  const handleSave = () => {
    const updated: WidgetSpec = {
      ...widget,
      title,
      subtitle,
      type,
      category,
      periode,
      unitKerja,
      lastUpdated: new Date().toISOString(),
    };

    if (isApplyingCorrection) {
      updated.confidence = 'manual';
      updated.manualCorrection = {
        isCorrected: true,
        originalValue: widget.manualCorrection?.originalValue || currentVal,
        correctedValue: correctedValue,
        correctedBy,
        correctedAt: new Date().toISOString(),
        reason: correctionReason,
      };

      if (updated.kpi) {
        updated.kpi = {
          ...updated.kpi,
          value: correctedValue,
        };
      }
    }

    onSave(updated);
    onClose();
  };

  const handleResetCorrection = () => {
    setIsApplyingCorrection(false);
    if (widget.manualCorrection) {
      const updated: WidgetSpec = {
        ...widget,
        confidence: 'sumber',
        manualCorrection: undefined,
        kpi: widget.kpi
          ? {
            ...widget.kpi,
            value: widget.manualCorrection.originalValue,
          }
          : undefined,
      };
      onSave(updated);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-scrim/50 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Dialog */}
      <div role="dialog" aria-modal="true" aria-labelledby="widget-editor-title" className="relative w-full max-w-xl bg-surface rounded-card shadow-2xl border border-line overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-line flex items-center justify-between bg-surface-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-control bg-brand flex items-center justify-center text-on-brand">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 id="widget-editor-title" className="text-sm font-semibold text-ink">
                Pengaturan & Kustomisasi Widget
              </h2>
              <p className="text-xs text-ink-2 truncate max-w-xs">{widget.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-chip text-ink-3 hover:text-ink-2 hover:bg-line transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Nav */}
        <div className="flex border-b border-line bg-surface-2/50 px-4 gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('config')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'config'
                ? 'border-brand text-brand-ink font-bold'
                : 'border-transparent text-ink-2 hover:text-ink'
              }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Tipe Visualisasi & Parameter</span>
          </button>
          <button
            onClick={() => setActiveTab('correction')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'correction'
                ? 'border-brand text-brand-ink font-bold'
                : 'border-transparent text-ink-2 hover:text-ink'
              }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-warn" />
            <span>Koreksi Manual Angka (Fitur F-14)</span>
            {widget.manualCorrection?.isCorrected && (
              <span className="w-2 h-2 rounded-full bg-warn ml-1" />
            )}
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {activeTab === 'config' ? (
            <>
              {/* Judul & Subtitle */}
              <div className="space-y-3">
                <div>
                  <label className="block text-ink-2 font-medium mb-1">
                    Judul Widget
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-ink-2 font-medium mb-1">
                    Keterangan / Subtitle
                  </label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              {/* Tipe Visualisasi Grid — dikelompokkan agar mudah dipindai */}
              <div>
                <label className="block text-ink-2 font-medium mb-2">
                  Pilih Tipe Visualisasi Chart
                </label>
                {chartTypes.length === 1 && (
                  <p className="text-[11px] text-ink-2 mb-2">
                    Widget ini hanya punya data untuk tipe ini.
                  </p>
                )}
                <div className="space-y-3">
                  {GRUP_VISUALISASI.map((grup) => {
                    const tipeGrup = chartTypes.filter((ct) => ct.grup === grup);
                    if (!tipeGrup.length) return null;
                    return (
                      <div key={grup}>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-ink-3 mb-1.5">
                          {grup}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {tipeGrup.map((ct) => (
                            <button
                              key={ct.type}
                              type="button"
                              onClick={() => setType(ct.type)}
                              className={`p-2.5 rounded-card border text-left transition-all ${type === ct.type
                                  ? 'border-brand bg-surface-2/70 ring-1 ring-brand'
                                  : 'border-line bg-surface hover:bg-surface-2'
                                }`}
                            >
                              <p className="font-semibold text-ink">{ct.label}</p>
                              <p className="text-[10px] text-ink-2 mt-0.5 leading-snug">{ct.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Kategori & Periode */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-ink-2 font-medium mb-1">Kategori</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value="Keuangan">Keuangan</option>
                    <option value="Operasional">Operasional</option>
                    <option value="Pelayanan">Pelayanan</option>
                    <option value="Kepatuhan & Risiko">Kepatuhan & Risiko</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ink-2 font-medium mb-1">Periode Data</label>
                  <select
                    value={periode}
                    onChange={(e) => setPeriode(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value="2026-Q1">Triwulan I 2026 (Aktual)</option>
                    <option value="2026-Q2">Triwulan II 2026</option>
                    <option value="2026-FY">Tahun Penuh 2026 (12 Bulan)</option>
                    <option value="2025-FY">Tahun Buku 2025</option>
                  </select>
                </div>
              </div>
            </>
          ) : (
            /* TAB KOREKSI MANUAL (F-14 PRD) */
            <div className="space-y-4">
              <div className="p-3.5 bg-warn/15 border border-warn/30 rounded-card text-warn leading-relaxed">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-warn mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-xs text-warn">
                      Standar Kepatuhan Koreksi Angka BUMD
                    </h4>
                    <p className="text-[11px] text-warn mt-0.5">
                      Pengguna dapat menimpa angka jika terjadi revisi pembukuan resmi. Nilai asli tetap tersimpan di audit trail, dan kartu widget akan ditandai dengan badge "Dikoreksi Manual".
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-surface-2 border border-line rounded-control">
                <span className="text-[10px] uppercase font-semibold text-ink-2">
                  Nilai Asli dari Dokumen RAG:
                </span>
                <p className="text-base font-bold text-ink mt-0.5">
                  {String(widget.manualCorrection?.originalValue || currentVal)}
                </p>
              </div>

              <div>
                <label className="block text-ink-2 font-medium mb-1">
                  Nilai Baru Hasil Koreksi (Override)
                </label>
                <input
                  type="text"
                  value={correctedValue}
                  onChange={(e) => {
                    setCorrectedValue(e.target.value);
                    setIsApplyingCorrection(true);
                  }}
                  className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-sm"
                  placeholder="Contoh: Rp 45,20 M"
                />
              </div>

              <div>
                <label className="block text-ink-2 font-medium mb-1">
                  Nama Petugas Pengoreksi
                </label>
                <input
                  type="text"
                  value={correctedBy}
                  onChange={(e) => setCorrectedBy(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-ink-2 font-medium mb-1">
                  Alasan & Dasar Koreksi (Wajib untuk Audit)
                </label>
                <textarea
                  rows={3}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                  placeholder="Contoh: Penyesuaian saldo piutang berdasarkan Surat Keputusan Direksi No. 42/2026..."
                />
              </div>

              {widget.manualCorrection?.isCorrected && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleResetCorrection}
                    className="text-xs text-neg hover:text-neg font-medium underline"
                  >
                    Kembalikan ke Nilai Asli RAG (Batalkan Koreksi)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-surface-2 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-line rounded-control text-ink-2 hover:bg-surface-2 text-xs font-medium transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-brand hover:bg-brand-ink text-on-brand rounded-control text-xs font-medium transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Simpan Perubahan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
