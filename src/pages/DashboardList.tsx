import React, { useState } from 'react';
import {
  Activity,
  Building2,
  Calendar,
  CheckCircle,
  Copy,
  ExternalLink,
  Eye,
  Filter,
  Layers,
  LayoutGrid,
  Plus,
  Search,
  Share2,
  Sparkles,
  Tag,
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
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter dashboards
  const filteredDashboards = dashboards.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSector =
      selectedSector === 'all' || d.sector === selectedSector;
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
    <div className="flex-1 bg-slate-50 min-h-screen flex flex-col">
      {/* Top Banner / Hero Header */}
      <div className="bg-slate-900 border-b border-slate-800 text-white px-6 py-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold tracking-wider uppercase">
                <span>{currentTenant?.name || 'PEMERINTAH DAERAH'}</span>
                <span>•</span>
                <span>{currentTenant?.city}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-3xl p-2 bg-white/10 rounded-xl border border-white/10 backdrop-blur-xs">
                  {currentTenant?.logo || '🏛️'}
                </span>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
                    Galeri Dashboard BUMD
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 font-semibold">
                      {dashboards.length} Tersedia
                    </span>
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    Kelola dan pantau seluruh dashboard indikator kinerja resmi instansi {currentTenant?.shortName || 'BUMD'} berbasis data RAG terintegrasi.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                onClick={onOpenChat}
                className="px-4 py-2.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md transition-all flex items-center gap-2 border border-sky-400/30"
              >
                <Sparkles className="w-4 h-4" />
                <span>Buat via Chat AI RAG</span>
              </button>
              <button
                onClick={onCreateDashboard}
                className="px-4 py-2.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-xl shadow-xs transition-all flex items-center gap-2 border border-slate-700"
              >
                <Plus className="w-4 h-4 text-sky-400" />
                <span>Dashboard Baru</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800/80">
            <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Total Dashboard</p>
                <p className="text-lg font-bold text-white">{dashboards.length}</p>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Total Widget Aktif</p>
                <p className="text-lg font-bold text-white">{totalWidgets}</p>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Kartu KPI / Metrik</p>
                <p className="text-lg font-bold text-white">{totalKpis}</p>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Sektor BUMD</p>
                <p className="text-lg font-bold text-white capitalize">{currentTenant?.sector || 'Multi'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="max-w-7xl mx-auto w-full px-6 py-8 flex-1">
        {/* Search & Filter Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari dashboard berdasarkan judul atau deskripsi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Sektor:</span>
            </span>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
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
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center max-w-lg mx-auto my-12">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-4">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">
              Tidak Ada Dashboard yang Sesuai
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              {searchQuery
                ? 'Tidak ditemukan dashboard dengan kata kunci pencarian tersebut. Coba periksa kembali ejaan Anda.'
                : 'Belum ada dashboard di kategori ini. Anda dapat membuat dashboard baru atau meminta bantuan AI RAG Copilot.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={onCreateDashboard}
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Dashboard Baru</span>
              </button>
              <button
                onClick={onOpenChat}
                className="px-4 py-2 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                <span>Gunakan AI RAG</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDashboards.map((dash) => {
              const kpiCount = dash.widgets.filter((w) => w.type === 'kpi').length;
              const chartCount = dash.widgets.filter((w) =>
                ['line', 'bar', 'donut', 'radar'].includes(w.type)
              ).length;
              const tableCount = dash.widgets.filter((w) => w.type === 'table').length;

              return (
                <div
                  key={dash.id}
                  className="bg-white rounded-2xl border border-slate-200/90 hover:border-sky-300 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                >
                  <div className="p-5 space-y-4">
                    {/* Top Tag & Sector */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 capitalize border border-slate-200/60">
                        <Tag className="w-3 h-3 text-slate-400" />
                        {dash.sector || currentTenant?.sector || 'BUMD'}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
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
                        className="text-base font-bold text-slate-900 group-hover:text-sky-600 cursor-pointer transition-colors line-clamp-1"
                        title={dash.title}
                      >
                        {dash.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {dash.description || 'Dashboard intelijensi dan monitoring kinerja berbasis dokumen RAG BUMD.'}
                      </p>
                    </div>

                    {/* Widget Composition Badges */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] font-medium px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-md">
                        {dash.widgets.length} Total Widget
                      </span>
                      {kpiCount > 0 && (
                        <span className="text-[11px] font-medium px-2 py-0.5 bg-sky-50 border border-sky-100 text-sky-700 rounded-md">
                          {kpiCount} KPI
                        </span>
                      )}
                      {chartCount > 0 && (
                        <span className="text-[11px] font-medium px-2 py-0.5 bg-purple-50 border border-purple-100 text-purple-700 rounded-md">
                          {chartCount} Grafik
                        </span>
                      )}
                      {tableCount > 0 && (
                        <span className="text-[11px] font-medium px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-md">
                          {tableCount} Tabel
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom Action Bar */}
                  <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => onSelectDashboard(dash)}
                      className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Buka Kanvas</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onShareDashboard(dash)}
                        className="p-2 text-slate-500 hover:text-sky-600 hover:bg-slate-200/60 rounded-lg transition-colors"
                        title="Bagikan Tautan Read-Only"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onDuplicateDashboard(dash)}
                        className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
                        title="Duplikat Dashboard"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {deleteConfirmId === dash.id ? (
                        <div className="flex items-center gap-1 bg-red-50 p-0.5 rounded-lg border border-red-200">
                          <button
                            onClick={() => {
                              onDeleteDashboard(dash.id);
                              setDeleteConfirmId(null);
                            }}
                            className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold hover:bg-red-700"
                          >
                            Hapus
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-1.5 py-1 text-slate-600 text-[10px] hover:bg-slate-200 rounded"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(dash.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus Dashboard"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
