import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, X } from 'lucide-react';
import type { Dashboard, SaranChart } from '../types';
import { DashboardCanvas } from './DashboardCanvas';
import { ChartSelectionProvider } from './widgets/ChartSelection';
import { widgetPratinjauSaran } from '../services/chat/saranChart';
import { pesanGalatRamah } from '../services/ui/pesanGalat';

interface PratinjauSaranChartProps {
  saran: SaranChart;
  /** Dashboard yang sedang dibuka — tujuan kartu baru. */
  dashboardId?: string;
  onClose: () => void;
  /** Dipanggil setelah kartu benar-benar masuk kanvas. */
  onDitambahkan: (dashboard: Dashboard) => void;
}

const LABEL_TIPE: Record<string, string> = {
  bar: 'Grafik batang',
  line: 'Grafik garis',
  area: 'Grafik area',
  donut: 'Grafik donat',
  kpi: 'Kartu angka',
  table: 'Tabel',
};

/**
 * PRATINJAU SARAN CHART — memperlihatkan bentuk kartu persis seperti di kanvas,
 * lalu menyediakan tombol "Oke, tambahkan ke kanvas".
 *
 * Angka pada pratinjau diambil dari dokumen instansi (server mengirim `saran.pratinjau`).
 * Hanya kalau dokumen belum memuat indikatornya, pratinjau memakai bentuk contoh dan
 * mengatakannya terus terang.
 */
export const PratinjauSaranChart: React.FC<PratinjauSaranChartProps> = ({
  saran,
  dashboardId,
  onClose,
  onDitambahkan,
}) => {
  const widget = useMemo(() => widgetPratinjauSaran(saran), [saran]);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [selesai, setSelesai] = useState(false);

  const tambahkan = async () => {
    if (memuat || selesai) return;
    if (!dashboardId) {
      setGalat('Buka dulu salah satu dashboard, baru kartu ini bisa ditambahkan ke kanvas.');
      return;
    }
    setMemuat(true);
    setGalat(null);
    try {
      const res = await fetch(`/api/dashboards/${dashboardId}/widget-dari-saran`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indikator: saran.indikator, tipe: saran.tipe, judul: saran.judul }),
      });
      const isi = await res.json().catch(() => null);
      if (!res.ok || !isi?.dashboard) {
        setGalat(pesanGalatRamah(isi?.error || new Error('')));
        return;
      }
      setSelesai(true);
      onDitambahkan(isi.dashboard as Dashboard);
      onClose();
    } catch (err) {
      setGalat(pesanGalatRamah(err));
    } finally {
      setMemuat(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/50 backdrop-blur-sm p-3 sm:p-6"
      data-testid="pratinjau-saran"
      role="dialog"
      aria-modal="true"
      aria-label={`Pratinjau ${saran.judul}`}
    >
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-surface rounded-card border border-line shadow-2xl overflow-hidden">
        {/* Kepala */}
        <div className="flex items-start gap-3 px-4 sm:px-5 py-3.5 border-b border-line">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-3">
              Pratinjau · {LABEL_TIPE[saran.tipe] || saran.tipe}
            </p>
            <h3 className="text-sm font-bold text-ink mt-0.5 truncate">{saran.judul}</h3>
            <p className="text-[11px] text-ink-2 mt-1 leading-relaxed">{saran.alasan}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-control text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors"
            aria-label="Tutup pratinjau"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Kanvas pratinjau */}
        <div className="flex-1 overflow-auto bg-canvas p-3 sm:p-4">
          <ChartSelectionProvider key={widget.id}>
            <DashboardCanvas
              widgets={[widget]}
              preview
              onEditWidget={() => {}}
              onManualCorrection={() => {}}
              onDeleteWidget={() => {}}
              onDuplicateWidget={() => {}}
              onReorderWidgets={() => {}}
              onResizeWidget={() => {}}
            />
          </ChartSelectionProvider>
          <p className="text-[10.5px] text-ink-3 leading-relaxed mt-3">
            {saran.pratinjau
              ? `Angka di atas diambil langsung dari dokumen instansi${saran.sumber ? ` (${saran.sumber})` : ''}. Menekan "Oke, tambahkan" memasang kartu ini ke kanvas dengan angka yang sama.`
              : 'Angka di atas hanya contoh bentuk tampilan karena dokumen instansi belum memuat indikator ini. Setelah ditambahkan, angka diambil dari dokumen resmi instansi; kalau indikatornya tidak ada, kartu ditandai kosong — bukan diisi angka karangan.'}
          </p>
        </div>

        {/* Kaki */}
        <div className="border-t border-line px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          {galat ? (
            <p className="flex-1 text-[11px] text-neg flex items-start gap-1.5 leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{galat}</span>
            </p>
          ) : (
            <p className="flex-1 text-[11px] text-ink-3 leading-relaxed">
              Sudah cocok? Kartu akan ditambahkan ke kanvas dashboard yang sedang dibuka.
            </p>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-ink-2 bg-surface-2 hover:bg-line/70 rounded-control border border-line transition-colors"
            >
              Tutup
            </button>
            <button
              onClick={tambahkan}
              disabled={memuat || selesai}
              data-testid="oke-tambah-saran"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-on-brand bg-brand hover:brightness-95 rounded-control transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {memuat ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>{memuat ? 'Mengambil angka dari dokumen…' : 'Oke, tambahkan ke kanvas'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
