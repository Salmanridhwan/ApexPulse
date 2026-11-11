import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Check,
  Edit3,
  FileCheck,
  History,
  Layout,
  Palette,
  Sliders,
  Type,
  UserCheck,
  X,
} from 'lucide-react';
import { WidgetSpec, WidgetType, type WidgetStyle } from '../types';
import { selaraskanTipe } from '../services/spec/tipeSelaras';
import { adaGaya, bersihkanGaya } from './widgets/widgetStyle';
import { StyleControls } from './StyleControls';
import { CHART_DEFAULT, LABEL_KELOMPOK, type ChartId, type KelompokChart } from '../services/chart/chartDefault';
import { chartKatalogCocok, pakaiChartKatalog } from '../services/chart/katalogCocok';

interface WidgetEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  widget: WidgetSpec | null;
  onSave: (updatedWidget: WidgetSpec) => void;
  initialTab?: 'config' | 'tampilan' | 'correction';
}

export const WidgetEditorModal: React.FC<WidgetEditorModalProps> = ({
  isOpen,
  onClose,
  widget,
  onSave,
  initialTab = 'config',
}) => {
  const [activeTab, setActiveTab] = useState<'config' | 'tampilan' | 'correction'>(initialTab);

  // Form State
  const [title, setTitle] = useState(widget?.title || '');
  const [subtitle, setSubtitle] = useState(widget?.subtitle || '');
  const [type, setType] = useState<WidgetType>(widget?.type || 'kpi');
  /** Chart dari menu Template Chart yang dipakai kartu ini. */
  const [chartId, setChartId] = useState<ChartId | undefined>(widget?.chartId as ChartId | undefined);
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

  // ── Gaya tampilan (tab "Tampilan") ──
  // Kontrolnya ada di <StyleControls/>; di sini hanya disimpan nilai terpilih.
  const [style, setStyle] = useState<WidgetStyle>(widget?.style || {});

  /**
   * Muat ulang seluruh isian setiap kali editor dibuka untuk widget (lain).
   *
   * Tanpa ini, komponen yang SELALU ter-mount — seperti di halaman tautan publik
   * `/share/:token` — hanya mengambil nilai `widget` saat pertama kali dipasang
   * (masih null), sehingga field terbuka KOSONG lalu tersimpan kosong juga
   * (judul/subtitle widget ikut terhapus).
   */
  useEffect(() => {
    if (!isOpen || !widget) return;
    const nilaiSekarang =
      widget.kpi?.value ??
      widget.chart?.series?.[0]?.data?.[widget.chart.series[0].data.length - 1] ??
      '-';
    setActiveTab(initialTab);
    setTitle(widget.title || '');
    setSubtitle(widget.subtitle || '');
    setType(widget.type || 'kpi');
    setChartId(widget.chartId as ChartId | undefined);
    setCategory(widget.category || 'Operasional');
    setPeriode(widget.periode || '2026-Q1');
    setUnitKerja(widget.unitKerja || 'Semua Unit');
    setCorrectedValue(
      widget.manualCorrection?.isCorrected ? String(widget.manualCorrection.correctedValue) : String(nilaiSekarang)
    );
    setCorrectedBy(widget.manualCorrection?.correctedBy || 'Siti Rahmawati, S.E. (Analis BUMD)');
    setCorrectionReason(widget.manualCorrection?.reason || 'Penyesuaian hasil rekonsiliasi audit internal');
    setIsApplyingCorrection(widget.manualCorrection?.isCorrected || false);
    setStyle(widget.style || {});
    // Dipicu per widget (id), bukan per objek: supaya ketikan pengguna tidak
    // direset hanya karena induknya menggambar ulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, widget?.id]);

  if (!isOpen || !widget) return null;

  // Chart katalog (menu Template Chart) yang datanya tersedia di kartu ini.
  const chartKatalog = chartKatalogCocok(widget);
  const kelompokKatalog = (Object.keys(LABEL_KELOMPOK) as KelompokChart[])
    .map((k) => ({ k, ids: chartKatalog.filter((id) => CHART_DEFAULT[id].kelompok === k) }))
    .filter((g) => g.ids.length > 0);

  const handleSave = () => {
    // Jaring pengaman: tipe yang dipilih tetap diperiksa gerbang yang sama dengan katalog.
    // Pilihan di UI sudah disaring `chartKatalogCocok`, jadi ini hanya mencegah tipe tak sah
    // lolos kalau daftar chip berubah di kemudian hari.
    const gerbang = selaraskanTipe({ ...widget, type }, type);
    const updated: WidgetSpec = {
      ...widget,
      title,
      subtitle,
      type: gerbang.ok && gerbang.widget ? type : widget.type,
      category,
      periode,
      unitKerja,
      style: adaGaya(style) ? style : undefined,
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

    // Chart dari menu Template Chart: tipe mengikuti chart katalog yang dipilih.
    onSave(chartId && chartId !== widget.chartId ? pakaiChartKatalog(updated, chartId) : updated);
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
    <div className="modal-layer">
      {/* Backdrop */}
      <div className="scrim" onClick={onClose} />

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
            <span>Kategori & Periode</span>
          </button>
          <button
            onClick={() => setActiveTab('tampilan')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'tampilan'
                ? 'border-brand text-brand-ink font-bold'
                : 'border-transparent text-ink-2 hover:text-ink'
              }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Warna & Font</span>
            {adaGaya(style) && <span className="w-2 h-2 rounded-full bg-brand ml-1" />}
          </button>
          <button
            onClick={() => setActiveTab('correction')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'correction'
                ? 'border-brand text-brand-ink font-bold'
                : 'border-transparent text-ink-2 hover:text-ink'
              }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-warn" />
            <span>Koreksi Angka</span>
            {widget.manualCorrection?.isCorrected && (
              <span className="w-2 h-2 rounded-full bg-warn ml-1" />
            )}
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {activeTab === 'config' ? (
            <>
              {/* Judul/keterangan dan pemilih bentuk chart dipindah ke panel
                  Gaya Widget (kanan), supaya kartu diatur sambil melihat kanvas. */}
              <p className="text-[11px] text-ink-2">
                Judul, keterangan, dan bentuk chart diatur di panel{' '}
                <span className="font-semibold text-ink">Gaya Widget</span> (tombol ⋯ pada kartu).
              </p>

              {/* Kategori & Periode */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="label">Kategori</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="field-lg"
                  >
                    <option value="Keuangan">Keuangan</option>
                    <option value="Operasional">Operasional</option>
                    <option value="Pelayanan">Pelayanan</option>
                    <option value="Kepatuhan & Risiko">Kepatuhan & Risiko</option>
                  </select>
                </div>
                <div>
                  <label className="label">Periode Data</label>
                  <select
                    value={periode}
                    onChange={(e) => setPeriode(e.target.value)}
                    className="field-lg"
                  >
                    <option value="2026-Q1">Triwulan I 2026 (Aktual)</option>
                    <option value="2026-Q2">Triwulan II 2026</option>
                    <option value="2026-FY">Tahun Penuh 2026 (12 Bulan)</option>
                    <option value="2025-FY">Tahun Buku 2025</option>
                  </select>
                </div>
              </div>
            </>
          ) : activeTab === 'tampilan' ? (
            /* TAB WARNA & FONT — kontrolnya dipakai bersama dengan modal gaya global */
            <StyleControls
              style={style}
              onChange={setStyle}
              namaSeri={widget?.chart?.series?.map((s) => s.name)}
              mode="widget"
              tipeWidget={type}
              adaRancangan={Boolean(widget?.rancangan && !widget?.chartId)}
            />
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
                      Pengguna dapat menimpa angka jika terjadi revisi pembukuan resmi. Kartu widget akan ditandai dengan badge "Dikoreksi Manual".
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
                <label className="label">
                  Nilai Baru Hasil Koreksi
                </label>
                <input
                  type="text"
                  value={correctedValue}
                  onChange={(e) => {
                    setCorrectedValue(e.target.value);
                    setIsApplyingCorrection(true);
                  }}
                  className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-warn font-mono text-sm"
                  placeholder="Contoh: Rp 45,20 M"
                />
              </div>

              <div>
                <label className="label">
                  Nama Petugas Pengoreksi
                </label>
                <input
                  type="text"
                  value={correctedBy}
                  onChange={(e) => setCorrectedBy(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-warn"
                />
              </div>

              <div>
                <label className="label">
                  Alasan & Dasar Koreksi (Wajib untuk Audit)
                </label>
                <textarea
                  rows={3}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-warn text-xs"
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
            className="px-5 py-2 bg-brand hover:brightness-95 text-on-brand rounded-control text-xs font-medium transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Simpan Perubahan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
