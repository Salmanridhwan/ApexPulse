import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  Clock,
  Database,
  LayoutGrid,
  LayoutTemplate,
  Sparkles,
} from 'lucide-react';
import { BumdSector, Tenant } from '../types';
import { DASHBOARD_TEMPLATES, DashboardTemplate, widgetDariTemplate } from '../services/templates/dashboardTemplates';
import { DashboardCanvas } from '../components/DashboardCanvas';
import { ChartSelectionProvider, ActiveChartFilterChip } from '../components/widgets/ChartSelection';

interface DashboardTemplatesPageProps {
  currentTenant: Tenant | null;
  /** Buat dashboard baru dari template, lalu buka kanvasnya. */
  onUseTemplate: (template: DashboardTemplate) => void;
}

/** Label sektor untuk ditampilkan di tab. */
const LABEL_SEKTOR: Record<BumdSector, string> = {
  pdam: 'PDAM (Air Minum)',
  bank: 'Bank Daerah (BPD/BPR)',
  pasar: 'Pasar Rakyat',
  rsud: 'Rumah Sakit (RSUD)',
  transportasi: 'Transportasi Daerah',
  aneka_usaha: 'Aneka Usaha / Pariwisata',
};

/** Ringkas komposisi widget: "4 KPI · 11 Grafik · 1 Tabel · 1 Narasi". */
const komposisi = (t: DashboardTemplate): string => {
  const hitung = (tipe: string[]) => t.widgets.filter((w) => tipe.includes(w.type)).length;
  const bagian: string[] = [];
  const nKpi = hitung(['kpi', 'bullet-target']);
  const nGrafik = hitung([
    'line', 'area', 'bar', 'hbar', 'combo', 'pie', 'donut', 'treemap', 'funnel',
    'waterfall', 'sankey', 'scatter', 'bubble', 'histogram', 'boxplot', 'heatmap',
    'radar', 'map', 'gantt', 'gauge',
  ]);
  const nTabel = hitung(['table']);
  const nNarasi = hitung(['narasi']);
  if (nKpi) bagian.push(`${nKpi} KPI`);
  if (nGrafik) bagian.push(`${nGrafik} Grafik`);
  if (nTabel) bagian.push(`${nTabel} Tabel`);
  if (nNarasi) bagian.push(`${nNarasi} Narasi`);
  return bagian.join(' · ');
};

/**
 * Halaman "Template Dashboard": pratinjau template per sektor BUMD yang ditampilkan
 * PERSIS seperti kanvas workspace.
 *
 * Tab di bagian atas memilih template mana yang dilihat; di bawahnya kanvas penuh
 * dirender apa adanya (KPI, grafik, tabel, narasi) dengan susunan & ukuran yang sama
 * seperti dashboard sungguhan. Widget di sini belum nyata, jadi kanvas berjalan dalam
 * mode `preview` (tanpa menu ⋯ dan tanpa drag/resize).
 *
 * PENTING: seluruh angka di sini DATA DUMMY (bukan hasil pembacaan dokumen). Halaman
 * memberi label jelas agar tidak disangka berasal dari dokumen resmi.
 */
export const DashboardTemplatesPage: React.FC<DashboardTemplatesPageProps> = ({
  currentTenant,
  onUseTemplate,
}) => {
  // Tab aktif. Default: template sektor instansi aktif (kalau ada), jika tidak template pertama.
  const [aktifId, setAktifId] = useState<string>(() => {
    const relevan = currentTenant
      ? DASHBOARD_TEMPLATES.find((t) => t.sektor === currentTenant.sector)
      : undefined;
    return (relevan ?? DASHBOARD_TEMPLATES[0]).id;
  });

  const aktif = useMemo(
    () => DASHBOARD_TEMPLATES.find((t) => t.id === aktifId) ?? DASHBOARD_TEMPLATES[0],
    [aktifId]
  );

  // Salin widget dengan id unik & segar supaya React key stabil dan penyuntingan
  // (saat template benar-benar dipakai) tidak menyentuh definisi template.
  const widgetPratinjau = useMemo(() => widgetDariTemplate(aktif, 0), [aktif]);

  const relevan = currentTenant?.sector === aktif.sektor;

  return (
    <div className="flex-1 bg-canvas min-h-screen flex flex-col">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1">
        {/* Kepala halaman */}
        <div className="bg-surface p-5 rounded-card border border-line mb-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-control bg-ink flex items-center justify-center text-surface shrink-0">
            <LayoutTemplate className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-ink flex items-center gap-2 flex-wrap">
              <span>Template Dashboard</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-line text-ink-2 font-semibold">
                {DASHBOARD_TEMPLATES.length} sektor
              </span>
            </h2>
            <p className="text-xs text-ink-2 mt-1 leading-relaxed max-w-3xl">
              Pratinjau dashboard siap pakai per sektor BUMD, ditampilkan seperti kanvas aslinya.
              Pilih tab sektor di bawah, lalu tekan <strong>Pakai Template Ini</strong> untuk membuat
              dashboard baru berisi widget yang sama.
            </p>
            <p className="text-[10.5px] text-warn mt-2 flex items-start gap-1.5 leading-relaxed max-w-3xl">
              <Database className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                Semua angka pada template adalah <strong>data contoh</strong> (bukan dari dokumen instansi).
                Untuk mengisi angka resmi, gunakan katalog preset atau chat RAG setelah dashboard dibuat.
              </span>
            </p>
          </div>
        </div>

        {/* Tab pilihan template — satu tab per sektor BUMD */}
        <div
          role="tablist"
          aria-label="Pilih template dashboard"
          className="flex items-center gap-2 overflow-x-auto pb-2 mb-5 border-b border-line"
        >
          {DASHBOARD_TEMPLATES.map((t) => {
            const terpilih = t.id === aktif.id;
            const iniSektorAnda = currentTenant?.sector === t.sektor;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={terpilih}
                data-testid={`tab-template-${t.sektor}`}
                onClick={() => setAktifId(t.id)}
                className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-t-control text-xs font-semibold border-b-2 transition-colors ${
                  terpilih
                    ? 'border-brand text-brand-ink bg-brand/10'
                    : 'border-transparent text-ink-2 hover:text-ink hover:bg-surface-2'
                }`}
                style={terpilih ? { borderBottomColor: t.aksen } : undefined}
                title={t.nama}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: t.aksen }}
                  aria-hidden="true"
                />
                <span className="whitespace-nowrap">{LABEL_SEKTOR[t.sektor]}</span>
                {iniSektorAnda && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-chip bg-brand/15 text-brand-ink border border-brand/30">
                    <Check className="w-2.5 h-2.5" />
                    Sektor Anda
                  </span>
                )}
                <span className="text-[9.5px] font-medium text-ink-3">{t.widgets.length}</span>
              </button>
            );
          })}
        </div>

        {/* Kartu info template aktif — meniru kepala dashboard di workspace */}
        <div className="card mb-4">
          <div className="px-4 sm:px-5 pt-4 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-chip text-on-brand mb-1.5"
                style={{ background: aktif.aksen }}
              >
                <Building2 className="w-3 h-3" />
                {LABEL_SEKTOR[aktif.sektor]}
              </span>
              {relevan && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-chip bg-brand/15 text-brand-ink border border-brand/30 mb-1.5 ml-1.5">
                  <Check className="w-3 h-3" />
                  Sesuai sektor instansi Anda
                </span>
              )}
              <h1 className="text-lg sm:text-xl font-extrabold text-ink tracking-tight mb-1">
                {aktif.judulDashboard}
              </h1>
              <p className="text-xs text-ink-2 leading-relaxed max-w-3xl">{aktif.deskripsi}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-2 bg-surface-2 border border-line px-2 py-0.5 rounded-chip">
                  <LayoutGrid className="w-3 h-3 text-ink-3" />
                  {aktif.widgets.length} widget
                </span>
                <span className="text-line-strong text-xs">·</span>
                <span className="text-[11px] text-ink-3">{komposisi(aktif)}</span>
                <span className="text-line-strong text-xs">·</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-warn font-medium">
                  <Sparkles className="w-3 h-3" />
                  Angka contoh
                </span>
              </div>
            </div>
          </div>

          {/* Toolbar bawah — tombol pakai template */}
          <div className="border-t border-line px-4 sm:px-5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-2 rounded-b-card">
            <div className="flex items-center gap-1.5 min-w-0">
              <Clock className="w-3.5 h-3.5 text-ink-3 shrink-0" />
              <span className="text-[11px] text-ink-3 font-medium truncate">
                Pratinjau template · widget belum dibuat sampai Anda menekan tombol
              </span>
            </div>
            <button
              onClick={() => onUseTemplate(aktif)}
              data-testid={`pakai-template-${aktif.sektor}`}
              className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-on-brand bg-brand hover:bg-brand-ink rounded-control transition-colors"
            >
              <LayoutTemplate className="w-4 h-4" />
              <span>Pakai Template Ini</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Kanvas — dirender PERSIS seperti workspace (mode pratinjau).
            `key` di provider mereset seleksi lintas-chart saat tab berpindah. */}
        <ChartSelectionProvider key={aktif.id}>
          <ActiveChartFilterChip />
          <DashboardCanvas
            widgets={widgetPratinjau}
            preview
            onEditWidget={() => {}}
            onManualCorrection={() => {}}
            onDeleteWidget={() => {}}
            onDuplicateWidget={() => {}}
            onReorderWidgets={() => {}}
            onResizeWidget={() => {}}
          />
        </ChartSelectionProvider>

        <p className="text-[10.5px] text-ink-3 leading-relaxed border-t border-line pt-4 mt-2 flex items-start gap-1.5">
          <BarChart3 className="w-3 h-3 mt-0.5 shrink-0" />
          <span>
            Template hanya menyusun kerangka dashboard. Setelah dipakai, setiap widget dapat diubah tipenya,
            diganti angkanya lewat koreksi manual, atau dihapus — persis seperti dashboard biasa.
          </span>
        </p>
      </div>
    </div>
  );
};
