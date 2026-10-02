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
    <div className="flex-1 bg-blue-50 min-h-screen flex flex-col">
      {/* Main Body */}
      <div className="max-w-7xl mx-auto w-full px-6 py-8 flex-1">
        {/* Baris aksi halaman */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <button
            onClick={onBackToWorkspace}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1.5"
          >
            ← Kembali ke Workspace
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenChat}
              className="px-4 py-2.5 text-xs font-bold text-white bg-blue-800 hover:bg-blue-900 rounded-lg transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Buat via Chat AI RAG</span>
            </button>
            <button
              onClick={onCreateDashboard}
              className="px-4 py-2.5 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-2 border border-blue-100"
            >
              <Plus className="w-4 h-4 text-blue-700" />
              <span>Dashboard Baru</span>
            </button>
          </div>
        </div>

        {/* Ringkasan angka (putih, kartu biru muda) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-blue-500 font-medium">Total Dashboard</p>
              <p className="text-lg font-bold text-blue-900">{dashboards.length}</p>
            </div>
          </div>

          <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-100 text-sky-700">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-blue-500 font-medium">Total Widget Aktif</p>
              <p className="text-lg font-bold text-blue-900">{totalWidgets}</p>
            </div>
          </div>

          <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-blue-500 font-medium">Kartu KPI / Metrik</p>
              <p className="text-lg font-bold text-blue-900">{totalKpis}</p>
            </div>
          </div>

          <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-100 text-sky-700">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-blue-500 font-medium">Sektor BUMD</p>
              <p className="text-lg font-bold text-blue-900 capitalize">
                {currentTenant?.sector || 'Multi'}
              </p>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white p-4 rounded-xl border border-blue-100 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-blue-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari dashboard berdasarkan judul atau deskripsi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-blue-50/70 border border-blue-100 rounded-lg text-xs text-blue-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs text-blue-500 font-medium flex items-center gap-1.5 shrink-0">
              <Filter className="w-3.5 h-3.5 text-blue-400" />
              <span>Sektor:</span>
            </span>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="text-xs font-medium text-blue-900 bg-blue-50/70 border border-blue-100 rounded-lg px-3 py-2 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
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
          <div className="bg-white rounded-xl border border-dashed border-blue-200 p-12 text-center max-w-lg mx-auto my-12">
            <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mx-auto mb-4">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-blue-900 mb-1">Tidak Ada Dashboard yang Sesuai</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              {searchQuery
                ? 'Tidak ditemukan dashboard dengan kata kunci pencarian tersebut. Coba periksa kembali ejaan Anda.'
                : 'Belum ada dashboard di kategori ini. Anda dapat membuat dashboard baru atau meminta bantuan AI RAG Copilot.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={onCreateDashboard}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Dashboard Baru</span>
              </button>
              <button
                onClick={onOpenChat}
                className="px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
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
                  className="bg-white rounded-xl border border-blue-100 hover:border-blue-300 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                >
                  <div className="p-5 space-y-4">
                    {/* Top Tag & Sector */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 capitalize border border-blue-100">
                        <Tag className="w-3 h-3 text-blue-500" />
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
                        className="text-base font-bold text-blue-900 group-hover:text-blue-700 cursor-pointer transition-colors line-clamp-1"
                        title={dash.title}
                      >
                        {dash.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {dash.description ||
                          'Dashboard intelijensi dan monitoring kinerja berbasis dokumen RAG BUMD.'}
                      </p>
                    </div>

                    {/* Widget Composition Badges */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] font-medium px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-700 rounded-md">
                        {dash.widgets.length} Total Widget
                      </span>
                      {kpiCount > 0 && (
                        <span className="text-[11px] font-medium px-2 py-0.5 bg-sky-50 border border-sky-100 text-sky-700 rounded-md">
                          {kpiCount} KPI
                        </span>
                      )}
                      {chartCount > 0 && (
                        <span className="text-[11px] font-medium px-2 py-0.5 bg-blue-100/60 border border-blue-100 text-blue-800 rounded-md">
                          {chartCount} Grafik
                        </span>
                      )}
                      {tableCount > 0 && (
                        <span className="text-[11px] font-medium px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-md">
                          {tableCount} Tabel
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom Action Bar */}
                  <div className="px-5 py-3.5 bg-blue-50/60 border-t border-blue-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => onSelectDashboard(dash)}
                      className="px-3.5 py-1.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Buka Kanvas</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onShareDashboard(dash)}
                        className="p-2 text-blue-500 hover:text-blue-800 hover:bg-blue-100/70 rounded-lg transition-colors"
                        title="Bagikan Tautan Read-Only"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onDuplicateDashboard(dash)}
                        className="p-2 text-blue-500 hover:text-blue-800 hover:bg-blue-100/70 rounded-lg transition-colors"
                        title="Duplikat Dashboard"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {deleteConfirmId === dash.id ? (
                        <div className="flex items-center gap-1 bg-rose-50 p-0.5 rounded-lg border border-rose-200">
                          <button
                            onClick={() => {
                              onDeleteDashboard(dash.id);
                              setDeleteConfirmId(null);
                            }}
                            className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold hover:bg-rose-700"
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
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
