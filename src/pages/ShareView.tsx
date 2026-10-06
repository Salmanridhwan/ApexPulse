import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Lock, Printer, Shield, ShieldCheck } from 'lucide-react';
import { LogoTile } from '../components/BrandMark';
import { ThemeToggle } from '../components/ThemeToggle';
import { GlobalFiltersBar } from '../components/GlobalFiltersBar';
import { ActiveChartFilterChip, ChartSelectionProvider } from '../components/widgets/ChartSelection';
import { WidgetRenderer } from '../components/widgets/WidgetRenderer';
import { Dashboard, GlobalFilters, Tenant, WidgetSpec } from '../types';

interface ShareViewProps {
  token: string;
  /** Mode embed: hanya kanvas + filter (tanpa banner/header/footer) untuk di-iframe ke website klien. */
  embed?: boolean;
}

const FILTER_DEFAULT: GlobalFilters = { periode: 'Semua', unitKerja: 'Semua', kategori: 'Semua' };

export const ShareView: React.FC<ShareViewProps> = ({ token, embed = false }) => {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter interaktif sisi klien (K4). Menyaring widget yang tampil — tidak mengarang angka baru.
  const [filters, setFilters] = useState<GlobalFilters>(FILTER_DEFAULT);

  useEffect(() => {
    async function loadSharedDashboard() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/share/${token}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Tautan ini tidak ditemukan, telah kedaluwarsa, atau dicabut.');
          }
          throw new Error(`Gagal memuat dashboard (Status: ${res.status})`);
        }
        const dashData: Dashboard = await res.json();
        setDashboard(dashData);

        if (dashData.tenantId) {
          const tenantRes = await fetch('/api/tenants');
          if (tenantRes.ok) {
            const tenants: Tenant[] = await tenantRes.json();
            const foundTenant = tenants.find((t) => t.id === dashData.tenantId);
            if (foundTenant) setTenant(foundTenant);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan saat memuat dashboard.');
      } finally {
        setIsLoading(false);
      }
    }

    if (token) {
      loadSharedDashboard();
    }
  }, [token]);

  const widgets: WidgetSpec[] = dashboard?.widgets ?? [];

  const widgetsTampil = useMemo(
    () =>
      widgets.filter(
        (w) =>
          (filters.kategori === 'Semua' || w.category === filters.kategori) &&
          (filters.unitKerja === 'Semua' || w.unitKerja === filters.unitKerja) &&
          (filters.periode === 'Semua' || w.periode === filters.periode)
      ),
    [widgets, filters]
  );

  const adaFilter =
    new Set(widgets.map((w) => w.periode).filter(Boolean)).size > 1 ||
    new Set(widgets.map((w) => w.unitKerja).filter(Boolean)).size > 1 ||
    new Set(widgets.map((w) => w.category).filter(Boolean)).size > 1;

  const handlePrint = () => {
    window.print();
  };

  const namaInstansi = tenant?.name || 'Instansi';

  const filterBar = adaFilter ? (
    <GlobalFiltersBar
      filters={filters}
      onChange={setFilters}
      widgets={widgets}
      shownCount={widgetsTampil.length}
    />
  ) : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 text-ink text-center">
        <div className="w-12 h-12 rounded-card bg-brand/20 text-brand flex items-center justify-center animate-spin mb-4">
          <Activity className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-ink tracking-wide">Memuat Tampilan Dashboard...</h2>
        <p className="text-xs text-ink-3 mt-1 max-w-sm">
          Mengambil spesifikasi visualisasi dan memverifikasi sitasi dokumen resmi instansi.
        </p>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div
        className={`${
          embed ? 'bg-surface-2 p-4' : 'min-h-screen bg-surface-2 p-6'
        } flex flex-col items-center justify-center text-ink`}
      >
        <div className="w-full max-w-md bg-surface rounded-3xl shadow-xl border border-line/80 p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-card bg-warn/15 text-warn flex items-center justify-center mx-auto border border-warn/30/60">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-surface-2 text-ink-2 border border-line">
              Akses Ditolak / Tidak Ditemukan
            </span>
            <h1 className="text-lg font-extrabold text-ink">Tautan Dashboard Tidak Valid</h1>
            <p className="text-xs text-ink-2 leading-relaxed">
              {error || 'Dashboard yang Anda cari tidak tersedia.'}
            </p>
          </div>
          <div className="p-3.5 bg-surface-2 rounded-card border border-line text-left text-[11px] text-ink-2 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-ink">
              <Shield className="w-3.5 h-3.5 text-brand" />
              <span>Protokol Keamanan Data</span>
            </div>
            <p className="text-ink-2 leading-normal">
              Setiap instansi diisolasi. Tautan read-only dapat dibatasi durasi berlakunya atau dicabut sewaktu-waktu.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------- MODE EMBED (untuk iframe website klien) ----------
  if (embed) {
    return (
      <ChartSelectionProvider>
        <div className="min-h-screen bg-surface-2 flex flex-col">
          {filterBar && (
            <div className="bg-surface/95 border-b border-line/80 px-4 py-3 sticky top-0 z-20">
              {filterBar}
            </div>
          )}
          <main className="w-full p-4 flex-1">
            <ActiveChartFilterChip />
            {widgetsTampil.length === 0 ? (
              <div className="bg-surface rounded-card border border-line p-12 text-center text-ink-2 text-xs">
                Tidak ada widget yang cocok dengan filter ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {widgetsTampil.map((widget) => (
                  <ShareWidgetCard key={widget.id} widget={widget} />
                ))}
              </div>
            )}
          </main>
          <div className="px-4 pb-4 text-center">
            <span className="text-[10px] text-ink-3">Dibuat dengan ApexPulse</span>
          </div>
        </div>
      </ChartSelectionProvider>
    );
  }

  // ---------- MODE HALAMAN PENUH (link share untuk klien) ----------
  return (
    <ChartSelectionProvider>
      <div className="min-h-screen bg-surface-2 flex flex-col">
        {/* Top Read-Only Banner */}
        <div className="bg-shell border-b border-shell-line text-shell-ink px-4 sm:px-6 py-2 flex items-center justify-between text-xs sticky top-0 z-30 shadow-md">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-pos animate-pulse" />
            <span className="font-semibold text-shell-ink">Portal Tinjauan Eksekutif</span>
            <span className="hidden sm:inline text-shell-ink-2">•</span>
            <span className="hidden sm:inline text-shell-ink-2 text-[11px]">Mode Publik Read-Only</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={handlePrint}
              className="px-3 py-1 rounded-control bg-shell-hover hover:bg-shell-active text-shell-ink border border-shell-line transition-colors flex items-center gap-1.5 text-[11px]"
              title="Cetak / Simpan PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cetak / PDF</span>
            </button>
          </div>
        </div>

        {/* Official Header — white-label instansi klien (K3) */}
        <header className="bg-surface border-b border-line/90 shadow-2xs px-6 py-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <LogoTile name={tenant?.name} id={tenant?.id} size="lg" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[11px] text-ink-2 font-semibold uppercase tracking-wider">
                  <span>{namaInstansi}</span>
                  {tenant?.city && (
                    <>
                      <span>•</span>
                      <span>{tenant.city}</span>
                    </>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-ink tracking-tight">
                  {dashboard.title}
                </h1>
                <p className="text-xs text-ink-2 max-w-3xl leading-relaxed">
                  {dashboard.description ||
                    'Dashboard intelijensi dan monitoring kinerja berbasis dokumen resmi instansi.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 self-start md:self-center shrink-0">
              <div className="bg-pos/15 border border-pos/30 text-pos rounded-card px-3.5 py-2 text-xs space-y-0.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-4 h-4 text-pos" />
                  <span>Terverifikasi Sumber Resmi</span>
                </div>
                <p className="text-[10px] text-pos">Setiap metrik terikat sitasi dokumen resmi</p>
              </div>
            </div>
          </div>
        </header>

        {filterBar && (
          <div className="bg-surface border-b border-line/80 px-6 py-3">
            <div className="max-w-7xl mx-auto">{filterBar}</div>
          </div>
        )}

        {/* Canvas Area */}
        <main className="max-w-7xl mx-auto w-full p-6 flex-1">
          <ActiveChartFilterChip />
          {widgetsTampil.length === 0 ? (
            <div className="bg-surface rounded-card border border-line p-12 text-center text-ink-2 text-xs">
              {widgets.length === 0
                ? 'Dashboard ini belum memiliki widget yang dikonfigurasi.'
                : 'Tidak ada widget yang cocok dengan filter ini.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {widgetsTampil.map((widget) => (
                <ShareWidgetCard key={widget.id} widget={widget} />
              ))}
            </div>
          )}
        </main>

        {/* Official Footer — powered by (K3) */}
        <footer className="bg-surface border-t border-line py-6 text-center text-xs text-ink-2">
          <p className="font-semibold text-ink-2">{namaInstansi}</p>
          <p className="text-[11px] text-ink-3 mt-1">
            Setiap angka terikat sitasi dokumen resmi. Dibuat &amp; dikelola dengan{' '}
            <span className="text-ink-3 font-medium">ApexPulse</span>.
          </p>
        </footer>

      </div>
    </ChartSelectionProvider>
  );
};

interface ShareWidgetCardProps {
  widget: WidgetSpec;
}

/** Kartu widget read-only untuk tampilan publik/embed. */
const ShareWidgetCard: React.FC<ShareWidgetCardProps> = ({ widget }) => {
  const isWide =
    widget.grid.w >= 8 ||
    widget.type === 'line' ||
    widget.type === 'bar' ||
    widget.type === 'table' ||
    widget.type === 'narasi';

  return (
    <div
      data-widget-id={widget.id}
      className={`bg-surface rounded-card border border-line/90 shadow-2xs overflow-hidden flex flex-col justify-between ${
        isWide ? 'md:col-span-2' : ''
      }`}
    >
      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3 border-b border-line pb-3">
          <div>
            <h3 className="text-sm font-bold text-ink leading-snug">{widget.title}</h3>
            {widget.subtitle && <p className="text-xs text-ink-2 mt-0.5">{widget.subtitle}</p>}
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-2 text-ink-2 uppercase shrink-0 font-medium">
            {widget.type}
          </span>
        </div>

        <div className="flex-1 min-h-[160px]">
          <WidgetRenderer widget={widget} />
        </div>
      </div>

    </div>
  );
};
