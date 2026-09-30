import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Award,
  Building2,
  Calendar,
  CheckCircle,
  ExternalLink,
  FileText,
  Globe,
  Lock,
  Printer,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { SourceDrawer } from '../components/SourceDrawer';
import { WidgetCard } from '../components/widgets/WidgetCard';
import { WidgetRenderer } from '../components/widgets/WidgetRenderer';
import { Citation, Dashboard, Tenant, WidgetSpec } from '../types';

interface ShareViewProps {
  token: string;
}

export const ShareView: React.FC<ShareViewProps> = ({ token }) => {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Citation Drawer State
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    async function loadSharedDashboard() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/share/${token}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Tautan berbagi ini tidak ditemukan, telah kedaluwarsa, atau dicabut oleh pemilik instansi.');
          }
          throw new Error(`Gagal memuat dashboard (Status: ${res.status})`);
        }
        const dashData: Dashboard = await res.json();
        setDashboard(dashData);

        // Fetch tenant details if tenantId exists
        if (dashData.tenantId) {
          const tenantRes = await fetch('/api/tenants');
          if (tenantRes.ok) {
            const tenants: Tenant[] = await tenantRes.json();
            const foundTenant = tenants.find((t) => t.id === dashData.tenantId);
            if (foundTenant) setTenant(foundTenant);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan saat memuat dashboard berbagi.');
      } finally {
        setIsLoading(false);
      }
    }

    if (token) {
      loadSharedDashboard();
    }
  }, [token]);

  const handleOpenCitation = (citation: Citation) => {
    setSelectedCitation(citation);
    setIsDrawerOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center animate-spin mb-4">
          <Activity className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-white tracking-wide">
          Memuat Tampilan Publik ApexPulse...
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Mengambil spesifikasi visualisasi dan memverifikasi integritas sitasi dokumen BUMD.
        </p>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200/60 shadow-xs">
            <Lock className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              Akses Ditolak / Tidak Ditemukan
            </span>
            <h1 className="text-lg font-extrabold text-slate-900">
              Tautan Berbagi Tidak Valid
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              {error || 'Dashboard publik yang Anda cari tidak tersedia.'}
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-left text-[11px] text-slate-600 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Shield className="w-3.5 h-3.5 text-sky-600" />
              <span>Protokol Keamanan Data BUMD</span>
            </div>
            <p className="text-slate-500 leading-normal">
              ApexPulse menerapkan isolasi tenant multi-instansi. Tautan read-only dapat dibatasi durasi berlakunya atau dicabut sewaktu-waktu oleh administrator instansi.
            </p>
          </div>

          <div className="pt-2">
            <a
              href="/"
              className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              Kembali ke Beranda ApexPulse
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Read-Only Banner */}
      <div className="bg-slate-900 border-b border-slate-800 text-white px-4 sm:px-6 py-2 flex items-center justify-between text-xs sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-slate-200">Portal Tinjauan Eksekutif BUMD</span>
          <span className="hidden sm:inline text-slate-500">•</span>
          <span className="hidden sm:inline text-slate-400 text-[11px]">
            Mode Publik Read-Only (Terotentikasi Tautan Aman)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors flex items-center gap-1.5 text-[11px]"
            title="Cetak Tampilan Dashboard"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cetak Dokumen</span>
          </button>
          <a
            href="/"
            className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium transition-colors text-[11px] flex items-center gap-1"
          >
            <span>Masuk Portal</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Official Header */}
      <header className="bg-white border-b border-slate-200/90 shadow-2xs px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <span className="text-4xl p-3 bg-slate-50 border border-slate-200 rounded-2xl shadow-2xs shrink-0">
              {tenant?.logo || '🏛️'}
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                <span>{tenant?.name || 'PEMERINTAH DAERAH / BUMD'}</span>
                <span>•</span>
                <span>{tenant?.city || 'Indonesia'}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {dashboard.title}
              </h1>
              <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
                {dashboard.description || 'Dashboard intelijensi dan monitoring kinerja berbasis dokumen resmi instansi BUMD.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 self-start md:self-center shrink-0">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-3.5 py-2 text-xs space-y-0.5">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Terverifikasi RAG BUMD</span>
              </div>
              <p className="text-[10px] text-emerald-700">
                Setiap metrik terikat sitasi dokumen resmi
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Canvas Area */}
      <main className="max-w-7xl mx-auto w-full p-6 flex-1">
        {dashboard.widgets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-xs">
            Dashboard ini belum memiliki widget yang dikonfigurasi.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboard.widgets.map((widget) => {
              // Calculate col-span based on widget type or grid width
              const isWide =
                widget.grid.w >= 8 ||
                widget.type === 'line' ||
                widget.type === 'bar' ||
                widget.type === 'table' ||
                widget.type === 'narasi';

              return (
                <div
                  key={widget.id}
                  className={`bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between ${
                    isWide ? 'md:col-span-2' : ''
                  }`}
                >
                  <div className="p-4 sm:p-5 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-3 mb-3 border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-snug">
                          {widget.title}
                        </h3>
                        {widget.subtitle && (
                          <p className="text-xs text-slate-500 mt-0.5">{widget.subtitle}</p>
                        )}
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase shrink-0 font-medium">
                        {widget.type}
                      </span>
                    </div>

                    <div className="flex-1 min-h-[160px]">
                      <WidgetRenderer widget={widget} />
                    </div>
                  </div>

                  {/* Widget Citations Footer */}
                  {widget.citations && widget.citations.length > 0 && (
                    <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>Sumber Resmi:</span>
                      </span>
                      <button
                        onClick={() => handleOpenCitation(widget.citations![0])}
                        className="text-sky-600 hover:text-sky-700 font-semibold hover:underline flex items-center gap-1 truncate max-w-[220px]"
                        title={widget.citations[0].docName}
                      >
                        <span className="truncate">{widget.citations[0].docName}</span>
                        {widget.citations[0].page && (
                          <span className="text-slate-400 text-[10px]">
                            (Hal {widget.citations[0].page})
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Official Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <p className="font-semibold text-slate-700">
          ApexPulse — Sistem Otomasi Visualisasi & Intelijensi Data BUMD
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          Dihasilkan secara aman dari repositori dokumen RAG terenkripsi • Standar Tata Kelola Pemerintahan Daerah
        </p>
      </footer>

      {/* Source Citation Drawer */}
      <SourceDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        citation={selectedCitation}
      />
    </div>
  );
};
