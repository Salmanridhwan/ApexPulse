import React from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  History,
  Layers,
  LayoutGrid,
  LogOut,
  Plus,
  Radio,
  Shield,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { Dashboard, Tenant, User } from '../types';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  tenants: Tenant[];
  currentTenant: Tenant | null;
  onSelectTenant: (tenant: Tenant) => void;
  dashboards: Dashboard[];
  activeDashboard: Dashboard | null;
  onSelectDashboard: (dashboard: Dashboard) => void;
  onCreateDashboard: () => void;
  activeRagMode: 'structured' | 'prose';
  onToggleRagMode: (mode: 'structured' | 'prose') => void;
  onOpenCatalog: () => void;
  onOpenProbe: () => void;
  onOpenAudit: () => void;
  onOpenAlerts: () => void;
  unreadAlertsCount: number;
  currentView?: 'workspace' | 'dashboards' | 'admin';
  onOpenDashboardList?: () => void;
  onOpenAdmin: () => void;
  currentUser: User | null;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  tenants,
  currentTenant,
  onSelectTenant,
  dashboards,
  activeDashboard,
  onSelectDashboard,
  onCreateDashboard,
  activeRagMode,
  onToggleRagMode,
  onOpenCatalog,
  onOpenProbe,
  onOpenAudit,
  onOpenAlerts,
  unreadAlertsCount,
  currentView = 'workspace',
  onOpenDashboardList,
  onOpenAdmin,
  currentUser,
  onLogout,
}) => {
  return (
    <aside
      className={`bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col justify-between transition-all duration-300 z-40 shrink-0 ${
        isCollapsed ? 'w-16' : 'w-64 sm:w-72'
      }`}
    >
      {/* Top Header & Brand */}
      <div>
        <div className="h-14 border-b border-slate-800 px-4 flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md ring-2 ring-sky-400/20 shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5 truncate">
                  ApexPulse
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30 uppercase tracking-wider shrink-0">
                    BUMD
                  </span>
                </span>
                <p className="text-[10px] text-slate-400 truncate">Sistem Otomasi Data RAG</p>
              </div>
            </div>
          )}

          {isCollapsed && (
            <div className="w-8 h-8 mx-auto rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md">
              <Activity className="w-4 h-4" />
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${
              isCollapsed ? 'hidden' : 'block'
            }`}
            title="Sembunyikan Sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Tenant Selector Box */}
        <div className="p-3 border-b border-slate-800/80">
          {!isCollapsed ? (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Instansi BUMD Aktif
              </span>
              <div className="relative">
                {currentUser?.role === 'admin' ? (
                  <>
                    <select
                      value={currentTenant?.id || ''}
                      onChange={(e) => {
                        const found = tenants.find((t) => t.id === e.target.value);
                        if (found) onSelectTenant(found);
                      }}
                      className="w-full text-xs font-semibold text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl px-3 py-2 cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500 transition-colors appearance-none pr-8 truncate"
                    >
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                          {t.logo} {t.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                  </>
                ) : (
                  <div
                    className="w-full text-xs font-semibold text-white bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 truncate"
                    title="Hanya administrator yang dapat berpindah instansi"
                  >
                    {currentTenant?.logo} {currentTenant?.name}
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-400 flex items-center justify-between px-1">
                <span className="capitalize">{currentTenant?.sector}</span>
                <span>{currentTenant?.city}</span>
              </p>
            </div>
          ) : (
            <div className="text-center" title={currentTenant?.name}>
              <span className="text-2xl">{currentTenant?.logo || '🏛️'}</span>
            </div>
          )}
        </div>

        {/* Navigation Sections */}
        <div className="p-3 space-y-5 overflow-y-auto no-scrollbar max-h-[calc(100vh-270px)]">
          {/* Section 1: Dashboards */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-2 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                <span>Daftar Dashboard</span>
                <button
                  onClick={onCreateDashboard}
                  className="text-sky-400 hover:text-sky-300 font-bold p-0.5"
                  title="Buat Dashboard Baru"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Gallery link */}
            {onOpenDashboardList && (
              <button
                onClick={onOpenDashboardList}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all text-left mb-1.5 ${
                  currentView === 'dashboards'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
                title="Galeri & Semua Dashboard"
              >
                <Layers className={`w-4 h-4 shrink-0 ${currentView === 'dashboards' ? 'text-white' : 'text-sky-400'}`} />
                {!isCollapsed && <span className="flex-1">Semua Dashboard ({dashboards.length})</span>}
              </button>
            )}

            <div className="space-y-0.5">
              {dashboards.map((d) => {
                const isActive = currentView === 'workspace' && activeDashboard?.id === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => onSelectDashboard(d)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all text-left truncate ${
                      isActive
                        ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                    title={d.title}
                  >
                    <LayoutGrid
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-sky-400' : 'text-slate-400'
                      }`}
                    />
                    {!isCollapsed && (
                      <span className="truncate flex-1">{d.title}</span>
                    )}
                    {!isCollapsed && (
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {d.widgets?.length || 0}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Data Tools & RAG Engine */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-2 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Alat & Sumber Data
              </div>
            )}

            <div className="space-y-0.5">
              {/* Catalog 40 Preset */}
              <button
                onClick={onOpenCatalog}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all text-left"
                title="Katalog 40 Preset Widget BUMD"
              >
                <Layers className="w-4 h-4 text-sky-400 shrink-0" />
                {!isCollapsed && <span>Katalog Preset (40)</span>}
              </button>

              {/* RAG Probe Diagnostik */}
              <button
                onClick={onOpenProbe}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all text-left"
                title="Diagnostik Koneksi & Evaluator RAG"
              >
                <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
                {!isCollapsed && <span>Diagnostik RAG Probe</span>}
              </button>

              {/* RAG Mode Switcher */}
              {!isCollapsed && (
                <div className="px-2.5 py-2 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Mode RAG Aktif:</span>
                    <button
                      onClick={() =>
                        onToggleRagMode(activeRagMode === 'structured' ? 'prose' : 'structured')
                      }
                      className="text-sky-400 hover:underline font-semibold"
                    >
                      Ubah
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-200">
                    <Radio className="w-3 h-3 text-sky-400 animate-pulse" />
                    <span>{activeRagMode === 'structured' ? 'Jalur A (JSON)' : 'Jalur B (Metadata)'}</span>
                  </div>
                </div>
              )}

              {/* Audit Logs */}
              <button
                onClick={onOpenAudit}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all text-left"
                title="Jejak Audit & Kepatuhan Regulasi"
              >
                <History className="w-4 h-4 text-amber-400 shrink-0" />
                {!isCollapsed && <span>Jejak Audit & F-14</span>}
              </button>
            </div>
          </div>

          {/* Section 3: Governance & Alerts */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-2 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Tata Kelola & Kontrol
              </div>
            )}

            <div className="space-y-0.5">
              {/* Alerts Button */}
              <button
                onClick={onOpenAlerts}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all text-left relative"
                title="Aturan Ambang Batas & Peringatan"
              >
                <Bell className="w-4 h-4 text-rose-400 shrink-0" />
                {!isCollapsed && <span>Ambang Batas & Alert</span>}
                {unreadAlertsCount > 0 && (
                  <span className="ml-auto px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                    {unreadAlertsCount}
                  </span>
                )}
              </button>

              {/* Admin Panel Button */}
              <button
                onClick={onOpenAdmin}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all text-left ${
                  currentView === 'admin'
                    ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
                title="Buka Panel Admin & Tata Kelola"
              >
                <Shield className="w-4 h-4 text-purple-400 shrink-0" />
                {!isCollapsed && <span>Panel Admin BUMD</span>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Profile & Session */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/90">
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl p-1 bg-slate-800 rounded-lg shrink-0">
                {currentUser?.avatar || '👤'}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate max-w-[130px]">
                  {currentUser?.name || 'Pengguna'}
                </p>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block truncate">
                  {currentUser?.role || 'Analis'}
                </span>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors shrink-0"
              title="Keluar dari Sistem (Logout)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <span className="text-xl">{currentUser?.avatar || '👤'}</span>
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              title="Buka Sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
