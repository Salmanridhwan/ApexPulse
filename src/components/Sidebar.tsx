import React from 'react';
import {
  Activity,
  Bell,
  ChevronDown,
  History,
  Layers,
  LayoutGrid,
  LogOut,
  Plus,
  Shield,
  Building2,
  Sparkles,
} from 'lucide-react';
import { LogoTile, AvatarTile } from './BrandMark';
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
  onOpenDashboardList: () => void;
  onOpenAudit: () => void;
  onOpenAlerts: () => void;
  unreadAlertsCount: number;
  currentView?: 'workspace' | 'dashboards' | 'audit' | 'alerts' | 'admin';
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
  onOpenDashboardList,
  onOpenAudit,
  onOpenAlerts,
  unreadAlertsCount,
  currentView = 'workspace',
  onOpenAdmin,
  currentUser,
  onLogout,
}) => {
  return (
    <aside
      className={`bg-white border-r border-slate-200/90 flex flex-col justify-between transition-all duration-200 z-40 shrink-0 select-none shadow-[1px_0_3px_rgba(0,0,0,0.02)] ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* ================= BAGIAN ATAS (Brand, Tenant, Navigasi) ================= */}
      <div className="flex flex-col min-h-0 flex-1">
        {/* Header / Brand */}
        <div
          className={`h-14 border-b border-slate-200/80 flex items-center shrink-0 ${
            isCollapsed ? 'justify-center px-0' : 'justify-between px-4'
          }`}
        >
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0 ring-1 ring-slate-800">
                <Activity className="w-4 h-4 text-sky-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight text-slate-900 leading-none">
                    ApexPulse
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/70">
                    Studio
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                  Dashboard Generator BUMD
                </p>
              </div>
            </div>
          ) : (
            <div
              className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs ring-1 ring-slate-800"
              title="ApexPulse Studio"
            >
              <Activity className="w-4 h-4 text-sky-400" />
            </div>
          )}


        </div>

        {/* Tenant Selector (Instansi BUMD) */}
        <div
          className={`border-b border-slate-200/80 bg-slate-50/50 shrink-0 ${
            isCollapsed ? 'py-3 flex justify-center' : 'p-3'
          }`}
        >
          {!isCollapsed ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 tracking-wider uppercase">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-slate-400" />
                  Klien / Instansi
                </span>
                <span className="text-[9px] text-slate-400 font-normal lowercase tracking-normal">
                  {currentTenant?.city || 'BUMD'}
                </span>
              </div>

              <div className="relative">
                {currentUser?.role === 'admin' ? (
                  <>
                    <select
                      value={currentTenant?.id || ''}
                      onChange={(e) => {
                        const found = tenants.find((t) => t.id === e.target.value);
                        if (found) onSelectTenant(found);
                      }}
                      className="w-full text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50/80 border border-slate-200/90 rounded-lg px-2.5 py-1.5 cursor-pointer focus:outline-none focus:ring-1.5 focus:ring-sky-500 transition-all appearance-none pr-7 truncate shadow-2xs"
                      title="Pilih instansi aktif"
                    >
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                  </>
                ) : (
                  <div
                    className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 truncate shadow-2xs"
                    title="Instansi Anda saat ini"
                  >
                    {currentTenant?.name}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 px-0.5">
                <span className="capitalize font-medium text-slate-600 truncate max-w-[140px]">
                  {currentTenant?.sector || 'Sektor Publik'}
                </span>
                <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1 rounded font-medium">
                  RAG Aktif
                </span>
              </div>
            </div>
          ) : (
            <div
              className="flex justify-center cursor-pointer"
              title={`Instansi Aktif: ${currentTenant?.name} (${currentTenant?.sector || 'BUMD'})`}
              onClick={onToggleCollapse}
            >
              <LogoTile name={currentTenant?.name} id={currentTenant?.id} size="sm" />
            </div>
          )}
        </div>

        {/* Scrollable Navigasi */}
        <nav
          className={`flex-1 overflow-y-auto px-2.5 py-3 space-y-4 no-scrollbar ${
            isCollapsed ? 'px-2' : ''
          }`}
        >
          {/* GRUP 1: Workspace & Dashboard */}
          <div>
            {!isCollapsed && (
              <div className="px-2 pb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
                <span>Dashboard</span>
                <button
                  onClick={onCreateDashboard}
                  className="p-0.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                  title="Buat Dashboard Baru"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Menu: Galeri / Semua Dashboard */}
            <button
              onClick={onOpenDashboardList}
              className={`w-full flex items-center gap-2.5 py-2 px-2.5 rounded-lg text-xs font-medium transition-colors text-left mb-1 group ${
                isCollapsed ? 'justify-center px-0' : ''
              } ${
                currentView === 'dashboards'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title={`Semua Dashboard (${dashboards.length})`}
            >
              <Layers
                className={`w-4 h-4 shrink-0 transition-colors ${
                  currentView === 'dashboards'
                    ? 'text-sky-600'
                    : 'text-slate-400 group-hover:text-slate-700'
                }`}
              />
              {!isCollapsed && (
                <>
                  <span className="flex-1 truncate">Galeri Semua</span>
                  <span className="text-[10px] font-mono text-slate-500 bg-slate-100 border border-slate-200/60 px-1.5 py-0.2 rounded shrink-0">
                    {dashboards.length}
                  </span>
                </>
              )}
            </button>

            {/* List Dashboard Tersimpan */}
            <div className="space-y-0.5">
              {dashboards.map((d) => {
                const isActive = currentView === 'workspace' && activeDashboard?.id === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => onSelectDashboard(d)}
                    className={`w-full flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg text-xs transition-colors text-left group relative ${
                      isCollapsed ? 'justify-center px-0' : ''
                    } ${
                      isActive
                        ? 'bg-sky-50/70 text-sky-950 font-semibold border border-sky-100'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                    }`}
                    title={`${d.title} (${d.widgets?.length || 0} widget)`}
                  >
                    {/* Aksen strip vertikal untuk item aktif */}
                    {isActive && (
                      <span className="absolute left-0 top-1 bottom-1 w-1 bg-sky-600 rounded-r-full" />
                    )}

                    <LayoutGrid
                      className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                        isActive ? 'text-sky-600' : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                    />
                    {!isCollapsed && (
                      <>
                        <span className="truncate flex-1 text-[12px]">{d.title}</span>
                        <span
                          className={`text-[10px] font-mono shrink-0 px-1 rounded ${
                            isActive
                              ? 'text-sky-700 bg-sky-100/70'
                              : 'text-slate-400 group-hover:text-slate-500'
                          }`}
                        >
                          {d.widgets?.length || 0}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}

              {dashboards.length === 0 && !isCollapsed && (
                <div className="px-3 py-2 text-[11px] text-slate-400 italic">
                  Belum ada dashboard tersimpan.
                </div>
              )}
            </div>
          </div>

          {/* GRUP 2: Tata Kelola & Sistem */}
          <div>
            {!isCollapsed && (
              <div className="px-2 pb-1.5 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
                Sistem & Tata Kelola
              </div>
            )}

            <div className="space-y-0.5">
              {/* Jejak Audit */}
              <button
                onClick={onOpenAudit}
                className={`w-full flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors text-left group ${
                  isCollapsed ? 'justify-center px-0' : ''
                } ${
                  currentView === 'audit'
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
                title="Jejak Audit & Kepatuhan Regulasi"
              >
                <History
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    currentView === 'audit'
                      ? 'text-sky-600'
                      : 'text-slate-400 group-hover:text-slate-700'
                  }`}
                />
                {!isCollapsed && <span className="flex-1 truncate">Jejak Audit</span>}
              </button>

              {/* Ambang Batas & Alert */}
              <button
                onClick={onOpenAlerts}
                className={`w-full flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors text-left group relative ${
                  isCollapsed ? 'justify-center px-0' : ''
                } ${
                  currentView === 'alerts'
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
                title={`Ambang Batas & Alert (${unreadAlertsCount} peringatan baru)`}
              >
                <Bell
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    unreadAlertsCount > 0
                      ? 'text-rose-500'
                      : currentView === 'alerts'
                      ? 'text-sky-600'
                      : 'text-slate-400 group-hover:text-slate-700'
                  }`}
                />
                {!isCollapsed && <span className="flex-1 truncate">Ambang Batas & Alert</span>}
                {unreadAlertsCount > 0 && (
                  <span
                    className={`${
                      isCollapsed ? 'absolute top-1 right-1' : 'ml-auto'
                    } px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold shadow-2xs animate-pulse`}
                  >
                    {unreadAlertsCount}
                  </span>
                )}
              </button>

              {/* Panel Admin */}
              {currentUser?.role === 'admin' && (
                <button
                  onClick={onOpenAdmin}
                  className={`w-full flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors text-left group ${
                    isCollapsed ? 'justify-center px-0' : ''
                  } ${
                    currentView === 'admin'
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  title="Panel Admin & Pengaturan Studio"
                >
                  <Shield
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      currentView === 'admin'
                        ? 'text-sky-600'
                        : 'text-slate-400 group-hover:text-slate-700'
                    }`}
                  />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 truncate">Panel Admin</span>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase bg-slate-100 px-1 py-0.5 rounded">
                        Admin
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </nav>
      </div>

      {/* ================= BAGIAN BAWAH (Profil, Status & Logout) ================= */}
      <div className="p-3 border-t border-slate-200/80 bg-slate-50/40 shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <AvatarTile name={currentUser?.name} id={currentUser?.id} size="sm" />
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"
                  title="Sesi Pengguna Aktif"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate" title={currentUser?.name}>
                  {currentUser?.name || 'Pengguna'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider block">
                    {currentUser?.role || 'Analis'}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  <span className="text-[9px] text-emerald-600 font-medium">Online</span>
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
              title="Keluar dari Sistem (Logout)"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2.5">
            <div className="relative" title={`${currentUser?.name} (${currentUser?.role})`}>
              <AvatarTile name={currentUser?.name} id={currentUser?.id} size="sm" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
