import { Tilt } from '../components/Tilt';
import React, { useState } from 'react';
import {
  Activity,
  Building2,
  Calendar,
  Copy,
  Eye,
  Filter,
  Layers,
  LayoutGrid,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { BumdSector, Dashboard, Tenant } from '../types';

interface DashboardListProps {
  dashboards: Dashboard[];
  currentTenant: Tenant | null;
  onSelectDashboard: (dashboard: Dashboard) => void;
  onCreateDashboard: () => void;
  onOpenChat: () => void;
  onDuplicateDashboard: (dashboard: Dashboard) => void;
  onDeleteDashboard: (dashboardId: string) => void;
  onShareDashboard: (dashboard: Dashboard) => void;
  onBackToWorkspace: () => void;
  /** Buka dashboard + panel riwayat chat-nya. */
  onOpenChatHistory?: (dashboard: Dashboard) => void;
  /** Jumlah pesan riwayat per dashboardId. */
  chatCounts?: Record<string, number>;
}

export const DashboardList: React.FC<DashboardListProps> = ({
  dashboards,
  currentTenant,
  onSelectDashboard,
  onCreateDashboard,
  onOpenChat,
  onDuplicateDashboard,
  onDeleteDashboard,
  onShareDashboard,
  onBackToWorkspace,
  onOpenChatHistory,
  chatCounts,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter dashboards
  const filteredDashboards = dashboards.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSector = selectedSector === 'all' || d.sector === selectedSector;
    return matchesSearch && matchesSector;
  });

  // Calculate statistics
  const totalWidgets = dashboards.reduce((acc, d) => acc + (d.widgets?.length || 0), 0);
  const totalCharts = dashboards.reduce(
    (acc, d) =>
      acc + (d.widgets?.filter((w) => ['line', 'bar', 'donut', 'radar'].includes(w.type)).length || 0),
    0
  );
  const totalKpis = dashboards.reduce(
    (acc, d) => acc + (d.widgets?.filter((w) => w.type === 'kpi').length || 0),
    0
  );

  return (
    <div className="flex-1 bg-canvas min-h-screen flex flex-col">
      {/* Main Body */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1 space-y-6">


        {/* Ringkasan Angka Metrik (Cards Grid) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
          {[
            { icon: <LayoutGrid className="w-5 h-5" />, label: 'Total Dashboard', nilai: String(dashboards.length), accent: 'var(--color-brand)' },
            { icon: <Layers className="w-5 h-5" />, label: 'Total Widget Aktif', nilai: String(totalWidgets), accent: 'var(--color-brand)' },
            { icon: <Activity className="w-5 h-5" />, label: 'Kartu KPI / Metrik', nilai: String(totalKpis), accent: 'var(--color-violet)' },
            { icon: <Building2 className="w-5 h-5" />, label: 'Sektor BUMD', nilai: currentTenant?.sector || 'Multi', accent: 'var(--color-pos)' },
          ].map((m, i) => (
            <div
              key={i}
              className="relative overflow-hidden bg-surface/95 backdrop-blur-md border border-line/80 rounded-card p-4 pl-5 shadow-2xs hover:shadow-xs transition-all flex items-center gap-3.5"
            >
              <span className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ background: m.accent }} aria-hidden="true" />
              <div className="item-tile shrink-0" style={{ ['--item-accent' as any]: m.accent }}>
                {m.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-ink-2 font-semibold">{m.label}</p>
                <p className="text-xl font-extrabold text-ink mt-0.5 capitalize truncate">{m.nilai}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-surface/95 backdrop-blur-md p-3.5 sm:p-4 rounded-card border border-line/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3.5">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-ink-3 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari dashboard berdasarkan judul atau deskripsi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-2 hover:bg-surface-2/80 border border-line rounded-card text-xs font-medium text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            <span className="text-xs text-ink-2 font-semibold flex items-center gap-1.5 shrink-0">
              <Filter className="w-3.5 h-3.5 text-brand" />
              <span>Sektor:</span>
            </span>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="text-xs font-bold text-ink bg-surface-2 hover:bg-surface-2/80 border border-line rounded-card px-3 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
            >
              <option value="all">Semua Sektor BUMD</option>
              <option value="pdam">Air Minum (PDAM)</option>
              <option value="bank">Bank / Keuangan Daerah</option>
              <option value="pasar">Pasar Rakyat & Retribusi</option>
              <option value="rsud">Kesehatan / RSUD</option>
              <option value="transportasi">Transportasi Umum</option>
              <option value="aneka_usaha">Aneka Usaha Daerah</option>
            </select>
          </div>
        </div>

        {/* Dashboard Grid */}
        {filteredDashboards.length === 0 ? (
          <div className="bg-surface rounded-card border border-dashed border-line-strong p-12 text-center max-w-lg mx-auto my-8 shadow-2xs">
            <div className="w-12 h-12 rounded-card bg-surface-2 text-brand-ink flex items-center justify-center mx-auto mb-4 border border-line">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-ink mb-1">Tidak Ada Dashboard yang Sesuai</h3>
            <p className="text-xs text-ink-2 mb-6 leading-relaxed">
              {searchQuery
                ? 'Tidak ditemukan dashboard dengan kata kunci pencarian tersebut. Coba periksa kembali ejaan Anda.'
                : 'Belum ada dashboard di kategori ini. Anda dapat membuat dashboard baru atau meminta bantuan AI RAG Copilot.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={onCreateDashboard}
                className="px-4 py-2 text-xs font-bold text-surface bg-ink hover:bg-ink rounded-card transition-all shadow-xs"
              >
                + Dashboard Baru
              </button>
              <button
                onClick={onOpenChat}
                className="px-4 py-2 text-xs font-bold text-ink-2 bg-surface-2 hover:bg-line/80 rounded-card transition-all border border-line"
              >
                Gunakan AI RAG
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDashboards.map((dash) => {
              const kpiCount = dash.widgets.filter((w) => w.type === 'kpi').length;
              const chartCount = dash.widgets.filter((w) =>
                ['line', 'bar', 'donut', 'radar'].includes(w.type)
              ).length;
              const tableCount = dash.widgets.filter((w) => w.type === 'table').length;

              return (
                <Tilt key={dash.id} className="h-full">
                <div
                  className="card relative flex flex-col justify-between overflow-hidden group h-full pl-1.5"
                >
                  <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-brand" />
                  <div className="p-5 space-y-3.5">
                    {/* Top Tag & Sector */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand-ink capitalize">
                        <span className="item-tile !w-7 !h-7">
                          <LayoutGrid className="w-3.5 h-3.5" />
                        </span>
                        {dash.sector || currentTenant?.sector || 'BUMD'}
                      </span>
                      <span className="text-[11px] font-medium text-ink-3 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-ink-3" />
                        {new Date(dash.updatedAt || Date.now()).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3
                        onClick={() => onSelectDashboard(dash)}
                        className="text-base font-bold text-ink group-hover:text-brand-ink cursor-pointer transition-colors line-clamp-1 tracking-tight"
                        title={dash.title}
                      >
                        {dash.title}
                      </h3>
                      <p className="text-xs text-ink-2 mt-1 line-clamp-2 leading-relaxed font-medium">
                        {dash.description ||
                          'Dashboard intelijensi dan monitoring kinerja berbasis dokumen RAG BUMD.'}
                      </p>
                    </div>

                    {/* Widget Composition Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-surface-2 border border-line/80 text-ink-2 rounded-control">
                        {dash.widgets.length} Total Widget
                      </span>
                      {kpiCount > 0 && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 bg-surface-2 border border-line/60 text-brand-ink rounded-control">
                          {kpiCount} KPI
                        </span>
                      )}
                      {chartCount > 0 && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 bg-surface-2 border border-line/60 text-ink rounded-control">
                          {chartCount} Grafik
                        </span>
                      )}
                      {tableCount > 0 && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 bg-surface-2 border border-line text-ink-2 rounded-control">
                          {tableCount} Tabel
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom Action Bar */}
                  <div className="px-4 py-3 bg-surface-2/70 border-t border-line flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onSelectDashboard(dash)}
                        className="btn-primary px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Buka Kanvas</span>
                      </button>

                      {onOpenChatHistory && (
                        <button
                          onClick={() => onOpenChatHistory(dash)}
                          title="Buka riwayat percakapan dashboard ini"
                          className="px-3 py-1.5 bg-surface hover:bg-surface-2 text-ink-2 border border-line rounded-card text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs active:scale-[0.98]"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-brand" />
                          <span>
                            Riwayat
                            {chatCounts && chatCounts[dash.id]
                              ? ` (${chatCounts[dash.id]})`
                              : ''}
                          </span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onShareDashboard(dash)}
                        className="p-1.5 text-ink-2 hover:text-brand-ink hover:bg-surface-2 rounded-control transition-colors"
                        title="Bagikan Tautan"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onDuplicateDashboard(dash)}
                        className="p-1.5 text-ink-2 hover:text-brand-ink hover:bg-surface-2 rounded-control transition-colors"
                        title="Duplikat Dashboard"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {deleteConfirmId === dash.id ? (
                        <div className="flex items-center gap-1 bg-neg/15 p-0.5 rounded-control border border-neg/30">
                          <button
                            onClick={() => {
                              onDeleteDashboard(dash.id);
                              setDeleteConfirmId(null);
                            }}
                            className="px-2 py-1 bg-neg text-on-neg rounded-chip text-[10px] font-bold hover:bg-neg"
                          >
                            Hapus
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-1.5 py-1 text-ink-2 text-[10px] hover:bg-line rounded-chip"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(dash.id)}
                          className="p-1.5 text-ink-3 hover:text-neg hover:bg-neg/10 rounded-control transition-colors"
                          title="Hapus Dashboard"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                </Tilt>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
