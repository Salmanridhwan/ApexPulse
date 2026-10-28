import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Clock,
  Database,
  LayoutGrid,
  LayoutTemplate,
  Loader2,
  Presentation,
  Sparkles,
  Target,
} from 'lucide-react';
import { BumdSector, Dashboard, ProgresIsiTemplate, Tenant } from '../types';
import { DASHBOARD_TEMPLATES, DashboardTemplate, widgetDariTemplate } from '../services/templates/dashboardTemplates';
import { DashboardCanvas } from '../components/DashboardCanvas';
import { ChartSelectionProvider, ActiveChartFilterChip } from '../components/widgets/ChartSelection';
import { pesanGalatRamah } from '../services/ui/pesanGalat';
import { PresentationMode } from '../components/PresentationMode';
import { narasiInsight, susunSlide, VERSI_PRESENTASI } from '../services/presentasi/slide';

interface DashboardTemplatesPageProps {
  currentTenant: Tenant | null;
  /**
   * Progres pengisian angka dari dokumen. Pengisian bisa 5–15 menit karena kartu
   * yang gagal (layanan sibuk) diulang sampai terisi — pengguna perlu melihat
   * sudah berapa kartu yang berisi angka.
   */
  progres?: ProgresIsiTemplate | null;
  /**
   * Buat dashboard baru dari template DENGAN ANGKA DARI DOKUMEN RAG, lalu buka
   * kanvasnya. Mengembalikan ringkasan berapa kartu terisi dari dokumen dan
   * berapa yang belum ada di dokumen; melempar galat bila layanan RAG gagal.
   */
  onUseTemplate: (
    template: DashboardTemplate
  ) => Promise<{ terisi: number; kosong: number; total: number }>;
}

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
 * Halaman "Template Dashboard": galeri template UMUM.
 *
 * Template tidak dipisahkan per sektor BUMD. Tiap template adalah satu KONSEP
 * penyajian yang ditentukan oleh tujuannya: untuk apa dashboard dipakai, dan
 * bagaimana isinya disampaikan (ringkasan satu layar, papan pemantauan, laporan
 * naratif, perbandingan, komposisi & sebaran, papan status). Susunan widget tiap
 * template mengikuti cara penyampaiannya, jadi template berbeda terasa berbeda.
 *
 * Instansi apa pun boleh memakai template mana pun; angka selalu diambil dari
 * dokumen instansi yang sedang login.
 *
 * PENTING: seluruh angka di pratinjau DATA DUMMY (bukan hasil pembacaan dokumen).
 * Halaman memberi label jelas agar tidak disangka berasal dari dokumen resmi.
 */
export const DashboardTemplatesPage: React.FC<DashboardTemplatesPageProps> = ({
  currentTenant,
  onUseTemplate,
  progres,
}) => {
  // Template aktif untuk dipratinjau. Default: template pertama.
  const [aktifId, setAktifId] = useState<string>(() => DASHBOARD_TEMPLATES[0].id);

  /** Status pengambilan angka dari dokumen saat tombol "Pakai Template Ini" ditekan. */
  const [memuat, setMemuat] = useState(false);
  /**
   * Detik berjalan selama pengisian. Pengisian belasan kartu bisa beberapa menit;
   * tanpa penghitung, halaman terlihat menggantung dan pengguna menutupnya di
   * tengah jalan (kartu jadi kosong).
   */
  const [detik, setDetik] = useState(0);
  useEffect(() => {
    if (!memuat) {
      setDetik(0);
      return;
    }
    const t = setInterval(() => setDetik((d) => d + 1), 1000);
    return () => clearInterval(t);
  }, [memuat]);
  /**
   * Pesan galat untuk pengguna. Bahasa awam: tanpa istilah teknis (RAG, HTTP,
   * timeout) — pengguna hanya perlu tahu apa yang terjadi dan apa yang bisa
   * dilakukan.
   */
  const [galat, setGalat] = useState<string | null>(null);
  /** Mode presentasi pratinjau (layar penuh, satu slide per layar). */
  const [presentasi, setPresentasi] = useState(false);

  const aktif = useMemo(
    () => DASHBOARD_TEMPLATES.find((t) => t.id === aktifId) ?? DASHBOARD_TEMPLATES[0],
    [aktifId]
  );

  // Salin widget dengan id unik & segar supaya React key stabil dan penyuntingan
  // (saat template benar-benar dipakai) tidak menyentuh definisi template.
  const widgetPratinjau = useMemo(() => widgetDariTemplate(aktif, 0), [aktif]);

  /**
   * Dashboard BAYANGAN untuk mode presentasi pratinjau.
   *
   * Slide disusun dari widget template (bukan dari server) dan tiap widget diberi
   * narasi ringkas yang dihitung dari angkanya sendiri — bukan dari dokumen. Karena
   * itu `PresentationMode` dipanggil dengan `pratinjau` supaya tidak memanggil RAG.
   */
  const dashPratinjau = useMemo<Dashboard>(() => {
    const widgets = widgetPratinjau.map((w) => ({ ...w, insight: w.insight || narasiInsight(w) }));
    return {
      id: `tpl-pratinjau-${aktif.id}`,
      tenantId: currentTenant?.id ?? '',
      title: aktif.judulDashboard,
      description: aktif.deskripsiDashboard,
      sector: (currentTenant?.sector ?? 'aneka_usaha') as BumdSector,
      widgets,
      globalFilters: { periode: 'Contoh', unitKerja: 'Semua', kategori: 'Semua' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      presentasi: {
        slides: susunSlide(widgets),
        disusunAt: new Date().toISOString(),
        versi: VERSI_PRESENTASI,
      },
    };
  }, [aktif, widgetPratinjau, currentTenant]);

  const pakai = async () => {
    if (memuat) return;
    setMemuat(true);
    setGalat(null);
    try {
      await onUseTemplate(aktif);
    } catch (err) {
      setGalat(pesanGalatRamah(err));
    } finally {
      setMemuat(false);
    }
  };

  return (
    <div className="flex-1 bg-canvas min-h-screen flex flex-col">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1">
        {/* Kepala halaman */}
        <div className="bg-surface p-5 rounded-card border border-line mb-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-control bg-solid flex items-center justify-center text-on-solid shrink-0">
            <LayoutTemplate className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-ink flex items-center gap-2 flex-wrap">
              <span>Template Dashboard</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-line text-ink-2 font-semibold">
                {DASHBOARD_TEMPLATES.length} template
              </span>
            </h2>
            <p className="text-xs text-ink-2 mt-1 leading-relaxed max-w-3xl">
              Tiap template punya tujuan dan cara penyampaian sendiri. Pilih yang sesuai, tekan{' '}
              <strong>Pakai Template Ini</strong>, angkanya diambil dari dokumen instansi Anda.
            </p>
            <p className="text-[10.5px] text-brand-ink mt-2 flex items-start gap-1.5 leading-relaxed max-w-3xl">
              <Database className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                Pratinjau memakai <strong>angka contoh</strong>. Setelah dipakai, indikator yang
                tidak ada di dokumen ditandai <strong>kosong</strong>.
              </span>
            </p>
          </div>
        </div>

        {/* Tab pilihan template — satu tab per template (bukan per sektor) */}
        <div
          role="tablist"
          aria-label="Pilih template dashboard"
          className="flex items-center gap-2 overflow-x-auto pb-2 mb-5 border-b border-line"
        >
          {DASHBOARD_TEMPLATES.map((t) => {
            const terpilih = t.id === aktif.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={terpilih}
                data-testid={`tab-template-${t.id}`}
                onClick={() => setAktifId(t.id)}
                className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-t-control text-xs font-semibold border-b-2 transition-colors ${
                  terpilih
                    ? 'border-brand text-brand-ink bg-brand/10'
                    : 'border-transparent text-ink-2 hover:text-ink hover:bg-surface-2'
                }`}
                style={terpilih ? { borderBottomColor: t.aksen } : undefined}
                title={`${t.nama} — ${t.tujuan}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: t.aksen }}
                  aria-hidden="true"
                />
                <span className="whitespace-nowrap">{t.nama}</span>
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
                <LayoutTemplate className="w-3 h-3" />
                {aktif.nama}
              </span>
              <h1 className="text-lg sm:text-xl font-extrabold text-ink tracking-tight mb-1">
                {aktif.judulDashboard}
              </h1>
              <p className="text-xs text-ink-2 leading-relaxed max-w-3xl">{aktif.deskripsiDashboard}</p>
              <p className="text-[11px] text-ink-2 leading-relaxed max-w-3xl mt-2 flex items-start gap-1.5">
                <Target className="w-3 h-3 mt-0.5 shrink-0 text-ink-3" />
                <span>
                  <span className="font-semibold text-ink-3">Tujuan: </span>
                  {aktif.tujuan}
                </span>
              </p>
              <p className="text-[11px] text-ink-2 leading-relaxed max-w-3xl mt-1 flex items-start gap-1.5">
                <BarChart3 className="w-3 h-3 mt-0.5 shrink-0 text-ink-3" />
                <span>
                  <span className="font-semibold text-ink-3">Cara penyampaian: </span>
                  {aktif.caraPenyampaian}
                </span>
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {aktif.fokus.map((f) => (
                  <span
                    key={f}
                    className="text-[9.5px] font-semibold text-ink-2 bg-surface-2 border border-line px-1.5 py-0.5 rounded-chip"
                  >
                    {f}
                  </span>
                ))}
              </div>
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
                {memuat
                  ? progres && progres.total > 0
                    ? `${progres.terisi}/${progres.total} kartu terisi · ${detik} dtk · ${progres.judul || 'mengambil angka…'}`
                    : `Mengambil angka dari dokumen instansi… ${detik} dtk`
                  : 'Angka setiap kartu diambil dari dokumen resmi instansi'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setPresentasi(true)}
                disabled={memuat || widgetPratinjau.length === 0}
                data-testid="presentasi-template"
                title="Buka mode presentasi: satu slide per layar, bisa pakai tombol panah"
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Presentation className="w-4 h-4" />
                <span>Mode Presentasi</span>
              </button>
              <button
                onClick={pakai}
                disabled={memuat || !currentTenant}
                data-testid={`pakai-template-${aktif.id}`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-on-brand bg-brand hover:brightness-95 rounded-control transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {memuat ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutTemplate className="w-4 h-4" />}
                <span>{memuat ? 'Mengambil dari dokumen…' : 'Pakai Template Ini'}</span>
                {!memuat && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Galat tetap ditampilkan, tetapi dengan bahasa awam — tanpa istilah
              teknis yang tidak dipahami pengguna. */}
          {galat && (
            <div className="border-t border-neg/30 bg-neg/10 px-4 sm:px-5 py-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-neg shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11.5px] font-semibold text-neg">Dashboard belum bisa dibuat</p>
                <p className="text-[11px] text-ink-2 mt-0.5 leading-relaxed">{galat}</p>
              </div>
            </div>
          )}
        </div>

        {/* Kanvas — dirender PERSIS seperti workspace (mode pratinjau).
            `key` di provider mereset seleksi lintas-chart saat template berganti. */}
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

      {/* Mode presentasi pratinjau — layar penuh, satu slide per layar.
          `pratinjau` membuat komponen ini TIDAK memanggil RAG (angka contoh). */}
      {presentasi && (
        <PresentationMode
          dashboard={dashPratinjau}
          tenantName={currentTenant?.name}
          onExit={() => setPresentasi(false)}
          onUpdate={() => {}}
          pratinjau
        />
      )}
    </div>
  );
};
