import React, { useState, useMemo } from 'react';
import {
  Activity,
  BarChart3,
  History,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  LogOut,
  Plus,
  Search,
  Shield,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { LogoTile, AvatarTile } from './BrandMark';
import { Dashboard, Tenant, User } from '../types';
import { TIPE_VISUALISASI } from '../services/spec/widgetTypes';
import { ADMIN_TABS, AdminTabId } from './adminTabs';

function waktuRelatif(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const selisih = Date.now() - t;
  if (selisih < 0) return 'baru saja';
  const menit = Math.floor(selisih / 60000);
  if (menit < 1) return 'baru saja';
  if (menit < 60) return `${menit} mnt lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.floor(jam / 24);
  if (hari === 1) return 'kemarin';
  if (hari < 7) return `${hari} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export interface SidebarProps {
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
  currentView?: 'workspace' | 'dashboards' | 'audit' | 'alerts' | 'charts' | 'templates' | 'admin';
  onOpenAdmin: () => void;
  /** Tab Panel Admin yang sedang aktif (dipakai saat currentView === 'admin'). */
  adminTab?: AdminTabId;
  /** Pindah tab Panel Admin; juga membuka mode admin. */
  onSelectAdminTab?: (tab: AdminTabId) => void;
  /** Buka galeri Template Chart (semua tipe visualisasi + rekomendasi pemakaian). */
  onOpenChartGallery?: () => void;
  /** Buka galeri Template Dashboard (dashboard siap pakai per sektor BUMD). */
  onOpenDashboardTemplates?: () => void;
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
  adminTab = 'overview',
  onSelectAdminTab,
  onOpenChartGallery,
  onOpenDashboardTemplates,
  currentUser,
  onLogout,
}) => {
  const [kueri, setKueri] = useState('');

  const dashboardsTersaring = useMemo(() => {
    const q = kueri.trim().toLowerCase();
    if (!q) return dashboards;
    return dashboards.filter(
      (d) => d.title.toLowerCase().includes(q) || (d.sector || '').toLowerCase().includes(q)
    );
  }, [dashboards, kueri]);

  const judulDuplikat = useMemo(() => {
    const hitung = new Map<string, number>();
    dashboards.forEach((d) => hitung.set(d.title, (hitung.get(d.title) || 0) + 1));
    return new Set(Array.from(hitung.entries()).filter(([, n]) => n > 1).map(([t]) => t));
  }, [dashboards]);

  return (
    <aside
      className={`bg-shell border-r border-shell-line shadow-[6px_0_24px_-12px_rgb(40_50_110/0.35)] flex flex-col h-full max-h-full overflow-hidden transition-[width] duration-200 shrink-0 select-none ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* 1. Header Brand (Shrink-0 / Fixed height) */}
      <div className={`h-14 border-b border-shell-line flex items-center shrink-0 ${isCollapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-control bg-brand text-on-brand flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-shell-ink leading-none">Aiones Boards</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-chip text-[9px] font-semibold bg-brand/25 text-brand-ink">Studio</span>
              </div>
              <p className="text-[10px] text-shell-ink-2 font-medium truncate mt-0.5">Dashboard Generator BUMD</p>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-control bg-brand text-on-brand flex items-center justify-center" title="Aiones Boards Studio">
            <Activity className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* 2. Tenant Selector (Shrink-0 / Fixed height) */}
      <div className={`border-b border-shell-line bg-shell-2 shrink-0 ${isCollapsed ? 'py-3 flex justify-center' : 'p-3'}`}>
        {!isCollapsed ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-semibold text-shell-ink-2 tracking-wider uppercase">
              <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> Klien / Instansi</span>
              <span className="text-[9px] font-normal lowercase tracking-normal">{currentTenant?.city || 'BUMD'}</span>
            </div>
            <div className="relative">
              <select
                value={currentTenant?.id || ''}
                onChange={(e) => {
                  const found = tenants.find((t) => t.id === e.target.value);
                  if (found) onSelectTenant(found);
                }}
                className="w-full text-xs font-semibold text-shell-ink bg-shell border border-shell-line rounded-control pl-2.5 pr-7 py-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand transition-all appearance-none truncate"
                title="Pilih instansi aktif (klien / instansi lain)"
                aria-label="Pilih instansi aktif"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id} className="bg-shell-2 text-shell-ink">
                    {t.name}{t.documentCount ? ` · ${t.documentCount} dok RAG` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-shell-ink-2 pointer-events-none" />
            </div>
            <div className="flex items-center justify-between text-[10px] px-0.5">
              <span className="capitalize font-medium text-shell-ink-2 truncate max-w-[140px]">{currentTenant?.sector || 'Sektor Publik'}</span>
              <span className="text-[9px] text-pos bg-pos/15 px-1 rounded-chip font-medium" title="Basis dokumen RAG instansi ini">
                RAG{currentTenant?.documentCount ? ` · ${currentTenant.documentCount} dok` : ' Aktif'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center cursor-pointer" title={`Instansi Aktif: ${currentTenant?.name} (${currentTenant?.sector || 'BUMD'})`} onClick={onToggleCollapse}>
            <LogoTile name={currentTenant?.name} id={currentTenant?.id} size="sm" />
          </div>
        )}
      </div>

      {/* 3. SCROLLABLE NAVIGATION (flex-1 overflow-y-auto min-h-0) */}
      <nav className={`flex-1 min-h-0 overflow-y-auto px-2.5 py-3 space-y-4 no-scrollbar ${isCollapsed ? 'px-2' : ''}`}>
        {/* GRUP 1: Workspace & Dashboard */}
        <div>
          {!isCollapsed && (
            <div className="px-2 pb-1.5 flex items-center justify-between text-[11px] font-semibold text-shell-ink-2 tracking-wider uppercase">
              <span>Dashboard</span>
              <button onClick={onCreateDashboard} className="p-0.5 text-shell-ink-2 hover:text-shell-ink hover:bg-shell-hover rounded-chip transition-colors" title="Buat Dashboard Baru">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {!isCollapsed && dashboards.length > 4 && (
            <div className="relative mb-1.5">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-shell-ink-2 pointer-events-none" />
              <input type="search" value={kueri} onChange={(e) => setKueri(e.target.value)} placeholder="Cari dashboard..." className="w-full text-[11px] text-shell-ink bg-shell-2 border border-shell-line rounded-control pl-7 pr-2 py-1.5 placeholder:text-shell-ink-2 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-colors [&::-webkit-search-cancel-button]:hidden" aria-label="Cari dashboard" />
            </div>
          )}
          <button onClick={onOpenDashboardList} className={`w-full flex items-center gap-2.5 py-2 px-2.5 rounded-control text-xs transition-colors text-left mb-1 group relative overflow-hidden ${isCollapsed ? 'justify-center px-0' : ''} ${currentView === 'dashboards' ? 'bg-shell-active text-shell-ink font-bold shadow-inset' : 'text-shell-ink-2 hover:bg-shell-hover hover:text-shell-ink font-medium'}`} title={`Semua Dashboard (${dashboards.length})`}>
            {currentView === 'dashboards' && <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-brand" />}
            <Layers className={`w-4 h-4 shrink-0 transition-colors ${currentView === 'dashboards' ? 'text-brand' : 'text-shell-ink-2 group-hover:text-shell-ink'}`} />
            {!isCollapsed && (
              <>
                <span className="flex-1 truncate">Galeri Semua</span>
                <span className={`text-[10px] font-mono px-1.5 rounded-chip shrink-0 ${currentView === 'dashboards' ? 'bg-brand/20 text-brand' : 'bg-shell-hover text-shell-ink-2'}`}>{dashboards.length}</span>
              </>
            )}
          </button>
          <div className="space-y-0.5">
            {dashboardsTersaring.map((d) => {
              const isActive = currentView === 'workspace' && activeDashboard?.id === d.id;
              const perluPembeda = judulDuplikat.has(d.title);
              return (
                <button key={d.id} onClick={() => onSelectDashboard(d)} className={`w-full flex items-center gap-2.5 py-1.5 px-2.5 rounded-control text-xs transition-colors text-left group relative overflow-hidden ${isCollapsed ? 'justify-center px-0' : ''} ${isActive ? 'bg-shell-active text-shell-ink font-bold shadow-inset' : 'text-shell-ink-2 hover:bg-shell-hover hover:text-shell-ink font-medium'}`} title={`${d.title} · ${d.widgets?.length || 0} widget · diperbarui ${waktuRelatif(d.updatedAt)}`}>
                  {isActive && <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-brand" />}
                  <LayoutGrid className={`w-3.5 h-3.5 shrink-0 transition-colors ${isActive ? 'text-brand' : 'text-shell-ink-2 group-hover:text-shell-ink'}`} />
                  {!isCollapsed && (
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-[12px] leading-tight">{d.title}</span>
                      <span className={`block text-[9px] leading-tight mt-0.5 truncate ${isActive ? 'text-shell-ink-2' : 'text-shell-ink-2/80'}`}>{d.widgets?.length || 0} widget{perluPembeda && <> · {waktuRelatif(d.updatedAt)}</>}</span>
                    </span>
                  )}
                </button>
              );
            })}
            {dashboardsTersaring.length === 0 && !isCollapsed && dashboards.length > 0 && <div className="px-3 py-3 text-[11px] text-shell-ink-2 italic">Tidak ada dashboard cocok dengan "{kueri}".</div>}
            {dashboards.length === 0 && !isCollapsed && <div className="px-3 py-2 text-[11px] text-shell-ink-2 italic">Belum ada dashboard tersimpan.</div>}
          </div>
        </div>

        {/* GRUP 2: Referensi */} 
        {(onOpenChartGallery || onOpenDashboardTemplates) && (
          <div>
            {!isCollapsed && <div className="px-2 pb-1.5 mt-4 text-[11px] font-semibold text-shell-ink-2 tracking-wider uppercase">Referensi</div>}
            <div className="space-y-0.5">
              {onOpenDashboardTemplates && (
                <button
                  onClick={onOpenDashboardTemplates}
                  className={`w-full flex items-center gap-2.5 py-1.5 px-2.5 rounded-control text-xs transition-colors text-left group relative overflow-hidden ${isCollapsed ? 'justify-center px-0' : ''} ${currentView === 'templates' ? 'bg-shell-active text-shell-ink font-bold shadow-inset' : 'text-shell-ink-2 hover:bg-shell-hover hover:text-shell-ink font-medium'}`}
                  title="Template Dashboard — dashboard siap pakai per sektor BUMD (angka contoh)"
                  data-testid="buka-template-dashboard"
                >
                  {currentView === 'templates' && <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-brand" />}
                  <LayoutTemplate className={`w-4 h-4 shrink-0 transition-colors ${currentView === 'templates' ? 'text-brand' : 'text-shell-ink-2 group-hover:text-shell-ink'}`} />
                  {!isCollapsed && <span className="flex-1 truncate">Template Dashboard</span>}
                </button>
              )}
              {onOpenChartGallery && (
                <button
                  onClick={onOpenChartGallery}
                  className={`w-full flex items-center gap-2.5 py-1.5 px-2.5 rounded-control text-xs transition-colors text-left group relative overflow-hidden ${isCollapsed ? 'justify-center px-0' : ''} ${currentView === 'charts' ? 'bg-shell-active text-shell-ink font-bold shadow-inset' : 'text-shell-ink-2 hover:bg-shell-hover hover:text-shell-ink font-medium'}`}
                  title={`Template Chart — ${TIPE_VISUALISASI.length} tipe chart beserta rekomendasi pemakaiannya`}
                  data-testid="buka-galeri-chart"
                >
                  {currentView === 'charts' && <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-brand" />}
                  <BarChart3 className={`w-4 h-4 shrink-0 transition-colors ${currentView === 'charts' ? 'text-brand' : 'text-shell-ink-2 group-hover:text-shell-ink'}`} />
                  {!isCollapsed && <span className="flex-1 truncate">Template Chart</span>}
                </button>
              )}
            </div>
          </div>
        )}

        {/* GRUP 3: Tata Kelola & Sistem */}
        <div>
          {!isCollapsed && <div className="px-2 pb-1.5 mt-4 text-[11px] font-semibold text-shell-ink-2 tracking-wider uppercase">Sistem & Tata Kelola</div>}
          <div className="space-y-0.5">
            <button onClick={onOpenAudit} className={`w-full flex items-center gap-2.5 py-1.5 px-2.5 rounded-control text-xs transition-colors text-left group relative overflow-hidden ${isCollapsed ? 'justify-center px-0' : ''} ${currentView === 'audit' ? 'bg-shell-active text-shell-ink font-bold shadow-inset' : 'text-shell-ink-2 hover:bg-shell-hover hover:text-shell-ink font-medium'}`} title="Jejak Audit & Kepatuhan Regulasi">
              {currentView === 'audit' && <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-brand" />}
              <History className={`w-4 h-4 shrink-0 transition-colors ${currentView === 'audit' ? 'text-brand' : 'text-shell-ink-2 group-hover:text-shell-ink'}`} />
              {!isCollapsed && <span className="flex-1 truncate">Jejak Audit</span>}
            </button>
            {currentUser?.role === 'admin' && (
              <div>
                {!isCollapsed && (
                  <div className="px-2 pb-1.5 mt-3 flex items-center justify-between text-[11px] font-semibold text-shell-ink-2 tracking-wider uppercase">
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-3 h-3" /> Panel Admin
                    </span>
                  </div>
                )}
                <div className="space-y-0.5">
                  {ADMIN_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const aktif = currentView === 'admin' && adminTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          if (onSelectAdminTab) onSelectAdminTab(tab.id);
                          else onOpenAdmin();
                        }}
                        className={`w-full flex items-center gap-2.5 py-1.5 px-2.5 rounded-control text-xs transition-colors text-left group relative overflow-hidden ${isCollapsed ? 'justify-center px-0' : ''} ${aktif ? 'bg-shell-active text-shell-ink font-bold shadow-inset' : 'text-shell-ink-2 hover:bg-shell-hover hover:text-shell-ink font-medium'}`}
                        title={`Panel Admin · ${tab.label}`}
                        data-testid={`admin-tab-${tab.id}`}
                      >
                        {aktif && <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-brand" />}
                        <Icon className={`w-4 h-4 shrink-0 transition-colors ${aktif ? 'text-brand' : 'text-shell-ink-2 group-hover:text-shell-ink'}`} />
                        {!isCollapsed && <span className="flex-1 truncate">{tab.label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* 4. FOOTER: Profil (Shrink-0 / Fixed height) */}
      <div className="p-3 border-t border-shell-line bg-shell-2 shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <AvatarTile name={currentUser?.name} id={currentUser?.id} size="sm" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-pos ring-2 ring-shell-2" title="Sesi Pengguna Aktif" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-shell-ink truncate" title={currentUser?.name}>{currentUser?.name || 'Pengguna'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] font-semibold text-shell-ink-2 uppercase tracking-wider block">{currentUser?.role || 'Analis'}</span>
                  <span className="w-1 h-1 rounded-full bg-shell-ink-2" />
                  <span className="text-[9px] text-pos font-medium">Online</span>
                </div>
              </div>
            </div>
            <button onClick={onLogout} className="p-1.5 rounded-control text-shell-ink-2 hover:text-neg hover:bg-shell-hover transition-colors shrink-0" title="Keluar dari Sistem (Logout)" aria-label="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2.5">
            <div className="relative" title={`${currentUser?.name} (${currentUser?.role})`}>
              <AvatarTile name={currentUser?.name} id={currentUser?.id} size="sm" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-pos ring-2 ring-shell-2" />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
