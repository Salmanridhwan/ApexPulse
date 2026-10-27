import React, { useState } from 'react';
import {
  BarChart3,
  ClipboardCheck,
  Gauge,
  ClipboardList,
  History,
  Layers,
  LayoutTemplate,
  LogOut,
  Plus,
  Shield,
  ShieldAlert,
  Boxes,
  FileSignature,
  BookOpen,
  FolderOpen,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { LogoTile, AvatarTile } from './BrandMark';
import { Dashboard, Tenant, User } from '../types';
import { TIPE_VISUALISASI } from '../services/spec/widgetTypes';
import { ADMIN_TABS, AdminTabId } from './adminTabs';

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
  currentView?: 'workspace' | 'dashboards' | 'audit' | 'alerts' | 'charts' | 'templates' | 'pelaporan' | 'auditTl' | 'keuangan' | 'risiko' | 'aset' | 'pk' | 'lkjip' | 'berkas' | 'admin';
  onOpenAdmin: () => void;
  /** Tab Panel Admin yang sedang aktif (dipakai saat currentView === 'admin'). */
  adminTab?: AdminTabId;
  /** Pindah tab Panel Admin; juga membuka mode admin. */
  onSelectAdminTab?: (tab: AdminTabId) => void;
  /** Buka galeri Template Chart (semua tipe visualisasi + rekomendasi pemakaian). */
  onOpenChartGallery?: () => void;
  /** Buka galeri Template Dashboard (dashboard siap pakai per sektor BUMD). */
  onOpenDashboardTemplates?: () => void;
  /** Buka halaman Pelaporan Periodik & Kepatuhan (kewajiban lapor instansi). */
  onOpenPelaporan?: () => void;
  /** Buka halaman Tindak Lanjut Audit (temuan BPK/Inspektorat/BPKP). */
  onOpenTindakLanjutAudit?: () => void;
  onOpenKesehatanKeuangan?: () => void;
  /** Buka halaman Manajemen Risiko (register risiko + heat map 5×5). */
  onOpenManajemenRisiko?: () => void;
  /** Buka halaman Manajemen Aset (daftar aset + nilai buku & penyusutan). */
  onOpenManajemenAset?: () => void;
  /** Buka halaman Perjanjian Kinerja (komitmen target + capaian). */
  onOpenPerjanjianKinerja?: () => void;
  /** Buka halaman LKjIP (laporan kinerja tahunan). */
  onOpenLKjIP?: () => void;
  /** Buka halaman Manajemen Berkas (unggah & daftar berkas di knowledge base). */
  onOpenManajemenBerkas?: () => void;
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
  onOpenPelaporan,
  onOpenTindakLanjutAudit,
  onOpenKesehatanKeuangan,
  onOpenManajemenRisiko,
  onOpenManajemenAset,
  onOpenPerjanjianKinerja,
  onOpenLKjIP,
  onOpenManajemenBerkas,
  currentUser,
  onLogout,
}) => {
  /**
   * Menu Workspace tetap tersorot saat pengguna membuka salah satu dashboard,
   * sebab dashboard sekarang dibuka dari dalam halaman Workspace — bukan dari
   * daftar tersendiri di sidebar.
   */
  const diWorkspace = currentView === 'dashboards' || currentView === 'workspace';

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
            {/* Sidebar selalu berlatar navy, jadi dipakai lockup versi putih. */}
            <img
              src="/brand/logo-lockup-terang.png"
              alt="Aiones Boards"
              width={140}
              height={36}
              className="h-6 w-auto shrink-0"
            />
            <div className="min-w-0">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-chip text-[9px] font-semibold bg-brand/25 text-brand-ink">Studio</span>
            </div>
          </div>
        ) : (
          <img
            src="/brand/logo-mark-terang.png"
            alt="Aiones Boards Studio"
            width={32}
            height={32}
            className="w-8 h-8"
            title="Aiones Boards Studio"
          />
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
            {/* Kunci ketat 1 akun = 1 BUMD: hanya admin yang boleh berpindah
                instansi. Non-admin melihat instansinya sebagai label statis,
                bukan dropdown — supaya tidak ada jalan pindah konteks. */}
            {currentUser?.role === 'admin' ? (
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
                      {t.name}{t.documentCount ? ` · ${t.documentCount} dokumen` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-shell-ink-2 pointer-events-none" />
              </div>
            ) : (
              <div
                className="w-full text-xs font-semibold text-shell-ink bg-shell border border-shell-line rounded-control px-2.5 py-1.5 truncate"
                title={currentTenant?.name || 'Instansi Anda'}
              >
                {currentTenant?.name || 'Instansi Anda'}
              </div>
            )}
            <div className="flex items-center justify-between text-[10px] px-0.5">
              <span className="capitalize font-medium text-shell-ink-2 truncate max-w-[140px]">{currentTenant?.sector || 'Sektor Publik'}</span>
              <span className="text-[9px] text-pos bg-pos/15 px-1 rounded-chip font-medium" title="Jumlah dokumen instansi ini">
                {currentTenant?.documentCount ? `${currentTenant.documentCount} dokumen` : 'Aktif'}
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
        {/* GRUP 1: Workspace — satu pintu ke semua dashboard.
            Permintaan pemilik aplikasi: sidebar tidak lagi mendaftar tiap
            dashboard satu per satu; daftarnya ada di dalam halaman Workspace. */}
        <div>
          {!isCollapsed && (
            <div className="px-2 pb-1.5 flex items-center justify-between text-[11px] font-semibold text-shell-ink-2 tracking-wider uppercase">
              <span>Workspace</span>
              <button onClick={onCreateDashboard} className="p-0.5 text-shell-ink-2 hover:text-shell-ink hover:bg-shell-hover rounded-chip transition-colors" title="Buat Dashboard Baru">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <button
            onClick={onOpenDashboardList}
            className={`w-full flex items-center gap-2.5 py-2 px-2.5 rounded-control text-xs transition-colors text-left group relative overflow-hidden ${isCollapsed ? 'justify-center px-0' : ''} ${diWorkspace ? 'bg-shell-active text-shell-ink font-bold shadow-inset' : 'text-shell-ink-2 hover:bg-shell-hover hover:text-shell-ink font-medium'}`}
            title={`Workspace — ${dashboards.length} dashboard`}
            data-testid="buka-workspace"
          >
            {diWorkspace && <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-brand" />}
            <Layers className={`w-4 h-4 shrink-0 transition-colors ${diWorkspace ? 'text-brand' : 'text-shell-ink-2 group-hover:text-shell-ink'}`} />
            {!isCollapsed && (
              <>
                <span className="flex-1 truncate">Semua Dashboard</span>
                <span className={`text-[10px] font-mono px-1.5 rounded-chip shrink-0 ${diWorkspace ? 'bg-brand/20 text-brand' : 'bg-shell-hover text-shell-ink-2'}`}>{dashboards.length}</span>
              </>
            )}
          </button>
        </div>

        {/* GRUP 2: Referensi */} 
        {(onOpenChartGallery || onOpenDashboardTemplates || onOpenManajemenBerkas) && (
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
              {onOpenManajemenBerkas && (
                <button
                  onClick={onOpenManajemenBerkas}
                  className={`w-full flex items-center gap-2.5 py-1.5 px-2.5 rounded-control text-xs transition-colors text-left group relative overflow-hidden ${isCollapsed ? 'justify-center px-0' : ''} ${currentView === 'berkas' ? 'bg-shell-active text-shell-ink font-bold shadow-inset' : 'text-shell-ink-2 hover:bg-shell-hover hover:text-shell-ink font-medium'}`}
                  title="Repositori Dokumen — unggah & kelola dokumen instansi"
                  data-testid="buka-manajemen-berkas"
                >
                  {currentView === 'berkas' && <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-brand" />}
                  <FolderOpen className={`w-4 h-4 shrink-0 transition-colors ${currentView === 'berkas' ? 'text-brand' : 'text-shell-ink-2 group-hover:text-shell-ink'}`} />
                  {!isCollapsed && <span className="flex-1 truncate">Repositori Dokumen</span>}
                </button>
              )}
            </div>
          </div>
        )}

        {/* GRUP 2.5: Kinerja & Kepatuhan (operasional BUMD) */}
        {(onOpenPelaporan || onOpenTindakLanjutAudit || onOpenKesehatanKeuangan || onOpenManajemenRisiko || onOpenManajemenAset || onOpenPerjanjianKinerja || onOpenLKjIP) && (
          <div>
            {!isCollapsed && <div className="px-2 pb-1.5 mt-4 text-[11px] font-semibold text-shell-ink-2 tracking-wider uppercase">Kinerja & Kepatuhan</div>}
            <div className="space-y-0.5">
              {onOpenPelaporan && (
                <button
                  onClick={onOpenPelaporan}
                  className={`w-full flex items-center gap-2.5 py-1.5 px-2.5 rounded-control text-xs transition-colors text-left group relative overflow-hidden ${isCollapsed ? 'justify-center px-0' : ''} ${currentView === 'pelaporan' ? 'bg-shell-active text-shell-ink font-bold shadow-inset' : 'text-shell-ink-2 hover:bg-shell-hover hover:text-shell-ink font-medium'}`}
                  title="Pelaporan Periodik & Kepatuhan — pantau kewajiban lapor instansi per periode"
                  data-testid="buka-pelaporan"
                >
                  {currentView === 'pelaporan' && <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-brand" />}
                  <ClipboardList className={`w-4 h-4 shrink-0 transition-colors ${currentView === 'pelaporan' ? 'text-brand' : 'text-shell-ink-2 group-hover:text-shell-ink'}`} />
                  {!isCollapsed && <span className="flex-1 truncate">Pelaporan Periodik</span>}
                </button>
              )}
              {onOpenTindakLanjutAudit && (
                <button
                  onClick={onOpenTindakLanjutAudit}
                  className={`w-full flex items-center gap-2.5 py-1.5 px-2.5 rounded-control text-xs transition-colors text-left group relative overflow-hidden ${isCollapsed ? 'justify-center px-0' : ''} ${currentView === 'auditTl' ? 'bg-shell-active text-shell-ink font-bold shadow-inset' : 'text-shell-ink-2 hover:bg-shell-hover hover:text-shell-ink font-medium'}`}
                  title="Tindak Lanjut Audit — pantau temuan BPK/Inspektorat/BPKP dan rekomendasinya"
                  data-testid="buka-tindak-lanjut-audit"
                >
                  {currentView === 'auditTl' && <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-brand" />}
                  <ClipboardCheck className={`w-4 h-4 shrink-0 transition-colors ${currentView === 'auditTl' ? 'text-brand' : 'text-shell-ink-2 group-hover:text-shell-ink'}`} />
                  {!isCollapsed && <span className="flex-1 truncate">Tindak Lanjut Audit</span>}
                </button>
              )}
              {onOpenKesehatanKeuangan && (
                <button
                  onClick={onOpenKesehatanKeuangan}
                  className={`w-full flex items-center gap-2.5 py-1.5 px-2.5 rounded-control text-xs transition-colors text-left group relative overflow-hidden ${isCollapsed ? 'justify-center px-0' : ''} ${currentView === 'keuangan' ? 'bg-shell-active text-shell-ink font-bold shadow-inset' : 'text-shell-ink-2 hover:bg-shell-hover hover:text-shell-ink font-medium'}`}
                  title="Kesehatan Keuangan — rasio ROA/ROE/DER/likuiditas dari neraca & laba rugi"
                  data-testid="buka-kesehatan-keuangan"
                >
                  {currentView === 'keuangan' && <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-brand" />}
                  <Gauge className={`w-4 h-4 shrink-0 transition-colors ${currentView === 'keuangan' ? 'text-brand' : 'text-shell-ink-2 group-hover:text-shell-ink'}`} />
                  {!isCollapsed && <span className="flex-1 truncate">Kesehatan Keuangan</span>}
                </button>
              )}
              {onOpenManajemenRisiko && (
                <button
                  onClick={onOpenManajemenRisiko}
                  className={`w-full flex items-center gap-2.5 py-1.5 px-2.5 rounded-control text-xs transition-colors text-left group relative overflow-hidden ${isCollapsed ? 'justify-center px-0' : ''} ${currentView === 'risiko' ? 'bg-shell-active text-shell-ink font-bold shadow-inset' : 'text-shell-ink-2 hover:bg-shell-hover hover:text-shell-ink font-medium'}`}
                  title="Manajemen Risiko — register risiko & heat map 5×5 (PP 60/2008 SPIP)"
                  data-testid="buka-manajemen-risiko"
                >
                  {currentView === 'risiko' && <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-brand" />}
                  <ShieldAlert className={`w-4 h-4 shrink-0 transition-colors ${currentView === 'risiko' ? 'text-brand' : 'text-shell-ink-2 group-hover:text-shell-ink'}`} />
                  {!isCollapsed && <span className="flex-1 truncate">Manajemen Risiko</span>}
                </button>
              )}
              {onOpenManajemenAset && (
                <button
                  onClick={onOpenManajemenAset}
                  className={`w-full flex items-center gap-2.5 py-1.5 px-2.5 rounded-control text-xs transition-colors text-left group relative overflow-hidden ${isCollapsed ? 'justify-center px-0' : ''} ${currentView === 'aset' ? 'bg-shell-active text-shell-ink font-bold shadow-inset' : 'text-shell-ink-2 hover:bg-shell-hover hover:text-shell-ink font-medium'}`}
                  title="Manajemen Aset — daftar aset, nilai buku & penyusutan (Permendagri 19/2016)"
                  data-testid="buka-manajemen-aset"
                >
                  {currentView === 'aset' && <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-brand" />}
                  <Boxes className={`w-4 h-4 shrink-0 transition-colors ${currentView === 'aset' ? 'text-brand' : 'text-shell-ink-2 group-hover:text-shell-ink'}`} />
                  {!isCollapsed && <span className="flex-1 truncate">Manajemen Aset</span>}
                </button>
              )}
              {onOpenPerjanjianKinerja && (
                <button
                  onClick={onOpenPerjanjianKinerja}
                  className={`w-full flex items-center gap-2.5 py-1.5 px-2.5 rounded-control text-xs transition-colors text-left group relative overflow-hidden ${isCollapsed ? 'justify-center px-0' : ''} ${currentView === 'pk' ? 'bg-shell-active text-shell-ink font-bold shadow-inset' : 'text-shell-ink-2 hover:bg-shell-hover hover:text-shell-ink font-medium'}`}
                  title="Perjanjian Kinerja — komitmen target kinerja & capaian (PermenPANRB 53/2014)"
                  data-testid="buka-perjanjian-kinerja"
                >
                  {currentView === 'pk' && <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-brand" />}
                  <FileSignature className={`w-4 h-4 shrink-0 transition-colors ${currentView === 'pk' ? 'text-brand' : 'text-shell-ink-2 group-hover:text-shell-ink'}`} />
                  {!isCollapsed && <span className="flex-1 truncate">Perjanjian Kinerja</span>}
                </button>
              )}
              {onOpenLKjIP && (
                <button
                  onClick={onOpenLKjIP}
                  className={`w-full flex items-center gap-2.5 py-1.5 px-2.5 rounded-control text-xs transition-colors text-left group relative overflow-hidden ${isCollapsed ? 'justify-center px-0' : ''} ${currentView === 'lkjip' ? 'bg-shell-active text-shell-ink font-bold shadow-inset' : 'text-shell-ink-2 hover:bg-shell-hover hover:text-shell-ink font-medium'}`}
                  title="LKjIP — Laporan Kinerja Instansi Pemerintah (Perpres 29/2014 SAKIP)"
                  data-testid="buka-lkjip"
                >
                  {currentView === 'lkjip' && <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-brand" />}
                  <BookOpen className={`w-4 h-4 shrink-0 transition-colors ${currentView === 'lkjip' ? 'text-brand' : 'text-shell-ink-2 group-hover:text-shell-ink'}`} />
                  {!isCollapsed && <span className="flex-1 truncate">LKjIP</span>}
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
                  <span className="text-[9px] font-semibold text-shell-ink-2 uppercase tracking-wider block">{currentUser?.role === 'admin' ? 'Admin' : 'Pengguna'}</span>
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
