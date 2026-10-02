import React from 'react';
import {
  Activity,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  History,
  Layers,
  LayoutGrid,
  LogOut,
  Plus,
  Shield,
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

/** Kelas item navigasi sidebar — putih dengan aksen biru. */
const itemClass = (aktif: boolean, collapsed: boolean) =>
  `w-full flex items-center gap-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left ${collapsed ? 'justify-center px-0' : 'px-2.5'
  } ${aktif
    ? 'bg-blue-50 text-blue-800'
    : 'text-slate-600 hover:bg-blue-50 hover:text-blue-900'
  }`;

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
      className={`bg-white border-r border-blue-100 flex flex-col justify-between transition-all duration-300 z-40 shrink-0 ${isCollapsed ? 'w-16' : 'w-60 sm:w-64'
        }`}
    >
      {/* Brand + toggle */}
      <div>
        <div className={`h-14 border-b border-blue-100 flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-800 flex items-center justify-center text-white shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-sm tracking-tight text-blue-900 block truncate">
                  ApexPulse
                </span>
                <p className="text-[10px] text-blue-500 truncate">Sistem Otomasi Data RAG</p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-blue-800 flex items-center justify-center text-white">
              <Activity className="w-4 h-4" />
            </div>
          )}

          {!isCollapsed && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-blue-400 hover:text-blue-800 hover:bg-blue-50 transition-colors shrink-0"
              title="Sembunyikan Sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tenant selector */}
        <div className={`border-b border-blue-100 ${isCollapsed ? 'py-3' : 'p-3'}`}>
          {!isCollapsed ? (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-blue-500">
                Instansi Aktif
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
                      className="w-full text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg px-3 py-2 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors appearance-none pr-8 truncate"
                    >
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-blue-400 absolute right-3 top-2.5 pointer-events-none" />
                  </>
                ) : (
                  <div
                    className="w-full text-xs font-semibold text-blue-900 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 truncate"
                    title="Hanya administrator yang dapat berpindah instansi"
                  >
                    {currentTenant?.name}
                  </div>
                )}
              </div>
              <p className="text-[10px] text-blue-400 flex items-center justify-between px-1">
                <span className="capitalize">{currentTenant?.sector}</span>
                <span>{currentTenant?.city}</span>
              </p>
            </div>
          ) : (
            <div className="flex justify-center" title={currentTenant?.name}>
              <LogoTile name={currentTenant?.name} id={currentTenant?.id} />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={`p-3 space-y-5 overflow-y-auto no-scrollbar max-h-[calc(100vh-230px)] ${isCollapsed ? 'px-2' : ''}`}>
          {/* Daftar Dashboard */}
          <div className="space-y-0.5">
            {!isCollapsed && (
              <div className="px-2 pb-1 flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-blue-500">
                <span>Daftar Dashboard</span>
                <button
                  onClick={onCreateDashboard}
                  className="text-blue-600 hover:text-blue-900 font-bold"
                  title="Buat Dashboard Baru"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              onClick={onOpenDashboardList}
              className={`${itemClass(currentView === 'dashboards', isCollapsed)} mb-1`}
              title="Galeri & Semua Dashboard"
            >
              <Layers className="w-4 h-4 shrink-0 text-blue-700" />
              {!isCollapsed && <span className="flex-1">Semua Dashboard ({dashboards.length})</span>}
            </button>

            {dashboards.map((d) => {
              const isActive = currentView === 'workspace' && activeDashboard?.id === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => onSelectDashboard(d)}
                  className={`w-full flex items-center gap-2.5 py-2 rounded-lg text-xs transition-colors text-left ${isCollapsed ? 'justify-center px-0' : 'px-2.5'
                    } ${isActive
                      ? 'bg-blue-50 text-blue-800 font-semibold'
                      : 'text-slate-600 hover:bg-blue-50 hover:text-blue-900 font-medium'
                    }`}
                  title={d.title}
                >
                  <LayoutGrid
                    className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-700' : 'text-blue-300'}`}
                  />
                  {!isCollapsed && <span className="truncate flex-1">{d.title}</span>}
                  {!isCollapsed && (
                    <span className="text-[10px] font-mono text-blue-400 shrink-0">
                      {d.widgets?.length || 0}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Alat & Sumber Data */}
          <div className="space-y-0.5">
            {!isCollapsed && (
              <div className="px-2 pb-1 text-[10px] uppercase font-bold tracking-wider text-blue-500">
                Alat & Sumber Data
              </div>
            )}
            <button
              onClick={onOpenAudit}
              className={itemClass(currentView === 'audit', isCollapsed)}
              title="Jejak Audit & Kepatuhan Regulasi"
            >
              <History className="w-4 h-4 shrink-0 text-blue-400" />
              {!isCollapsed && <span>Jejak Audit</span>}
            </button>
          </div>

          {/* Tata Kelola */}
          <div className="space-y-0.5">
            {!isCollapsed && (
              <div className="px-2 pb-1 text-[10px] uppercase font-bold tracking-wider text-blue-500">
                Tata Kelola
              </div>
            )}
            <button onClick={onOpenAlerts} className={`${itemClass(currentView === 'alerts', isCollapsed)} relative`} title="Ambang Batas & Peringatan">
              <Bell className="w-4 h-4 shrink-0 text-rose-500" />
              {!isCollapsed && <span>Ambang Batas & Alert</span>}
              {unreadAlertsCount > 0 && (
                <span className={`${isCollapsed ? 'absolute top-1 right-1' : 'ml-auto'} px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold`}>
                  {unreadAlertsCount}
                </span>
              )}
            </button>

            {currentUser?.role === 'admin' && (
              <button
                onClick={onOpenAdmin}
                className={itemClass(currentView === 'admin', isCollapsed)}
                title="Buka Panel Admin & Tata Kelola"
              >
                <Shield className="w-4 h-4 shrink-0 text-blue-500" />
                {!isCollapsed && <span>Panel Admin</span>}
              </button>
            )}
          </div>
        </nav>
      </div>

      {/* Profil & sesi */}
      <div className="p-3 border-t border-blue-100">
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <AvatarTile name={currentUser?.name} id={currentUser?.id} />
              <div className="min-w-0">
                <p className="text-xs font-bold text-blue-900 truncate max-w-[120px]">
                  {currentUser?.name || 'Pengguna'}
                </p>
                <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider block truncate">
                  {currentUser?.role || 'Analis'}
                </span>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg text-blue-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
              title="Keluar dari Sistem (Logout)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <AvatarTile name={currentUser?.name} id={currentUser?.id} />
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-lg text-blue-400 hover:text-blue-800 hover:bg-blue-50"
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
