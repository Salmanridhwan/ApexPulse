import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Bell,
  Building2,
  CheckCircle,
  Clock,
  Download,
  EllipsisVertical,
  FileCheck,
  FileText,
  Filter,
  History,
  LayoutGrid,
  Trash2,
  LogOut,
  Maximize2,
  Menu,
  Minimize2,
  Plus,
  Printer,
  Radio,
  Search,
  Share2,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { AlertsModal } from './components/AlertsModal';
import { CatalogSidebar } from './components/CatalogSidebar';
import { ChatPanel } from './components/ChatPanel';
import { DashboardCanvas } from './components/DashboardCanvas';
import { ExportModal } from './components/ExportModal';
import { ShareModal } from './components/ShareModal';
import { Sidebar } from './components/Sidebar';
import { GlobalFiltersBar } from './components/GlobalFiltersBar';
import { ActiveChartFilterChip, ChartSelectionProvider } from './components/widgets/ChartSelection';
import { preloadEcharts } from './components/widgets/ChartEcharts';

import { WidgetEditorModal } from './components/WidgetEditorModal';
import { ThemeToggle } from './components/ThemeToggle';
import { Login } from './pages/Login';

// Halaman sekunder di-code-split: tidak membebani bundle awal.
const Admin = React.lazy(() =>
  import('./pages/Admin').then((m) => ({ default: m.Admin }))
);
const DashboardList = React.lazy(() =>
  import('./pages/DashboardList').then((m) => ({ default: m.DashboardList }))
);
const AuditLogPage = React.lazy(() =>
  import('./pages/AuditLogPage').then((m) => ({ default: m.AuditLogPage }))
);
const AlertsPage = React.lazy(() =>
  import('./pages/AlertsPage').then((m) => ({ default: m.AlertsPage }))
);
const ShareView = React.lazy(() =>
  import('./pages/ShareView').then((m) => ({ default: m.ShareView }))
);
import {
  AlertRule,
  Dashboard,
  GlobalFilters,
  NotificationItem,
  Tenant,
  User,
  WidgetSpec,
} from './types';

export default function App() {
  // Public Share / Embed Route Handling (No Login Required)
  // `/share/:token` = halaman hasil untuk klien; `/embed/:token` = kanvas telanjang untuk iframe website klien.
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const shareMatch = pathname.match(/^\/share\/([^/]+)/);
  const embedMatch = pathname.match(/^\/embed\/([^/]+)/);
  const shareToken = shareMatch ? shareMatch[1] : embedMatch ? embedMatch[1] : null;
  const isEmbed = !shareMatch && !!embedMatch;

  if (shareToken) {
    return (
      <React.Suspense fallback={<div className="min-h-screen bg-surface-2" />}>
        <ShareView token={shareToken} embed={isEmbed} />
      </React.Suspense>
    );
  }

  // Authentication State
  // Sesi tercatat di cookie HttpOnly (dari server); token tak lagi disimpan di storage browser.
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('aionesboard_user') || sessionStorage.getItem('aionesboard_user') ? 'cookie-session' : null;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('aionesboard_user') || sessionStorage.getItem('aionesboard_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // App Core State
  // Admin langsung diarahkan ke panel admin (tanpa lewat workspace).
  const [viewMode, setViewMode] = useState<'workspace' | 'dashboards' | 'audit' | 'alerts' | 'admin'>(() => {
    const saved = localStorage.getItem('aionesboard_user') || sessionStorage.getItem('aionesboard_user');
    if (saved) {
      try {
        if (JSON.parse(saved)?.role === 'admin') return 'admin';
      } catch (e) {
        // ignore
      }
    }
    return 'workspace';
  });
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<Dashboard | null>(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // Drawer navigasi mobile: sidebar disembunyikan di <md, dibuka sebagai overlay.
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [hapusKonfirmasi, setHapusKonfirmasi] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  // Jumlah pesan riwayat per dashboardId — indikator di kartu DashboardList.
  const [chatCounts, setChatCounts] = useState<Record<string, number>>({});

  // Filter tampilan kanvas internal (view-only, gaya Tableau) — tidak mengubah data tersimpan.
  const [viewFilters, setViewFilters] = useState<GlobalFilters>({
    periode: 'Semua',
    unitKerja: 'Semua',
    kategori: 'Semua',
  });

  // Modals & Panels State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Active Selection for Drawer & Editor
  
  const [editingWidget, setEditingWidget] = useState<WidgetSpec | null>(null);
  const [editorTab, setEditorTab] = useState<'config' | 'correction'>('config');

  // Notifications & Alerts
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);

  // Initial Fetch
  useEffect(() => {
    // Fetch Tenants
    fetch('/api/tenants')
      .then((res) => res.json())
      .then((data: Tenant[]) => {
        setTenants(data);
        if (data.length > 0 && !currentTenant) {
          setCurrentTenant(data[0]);
        }
      })
      .catch((err) => console.error('Fetch tenants error:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-warm chunk echarts paralel dengan fetch data dashboard, agar chart
  // pertama di workspace tidak menunggu unduhan ~1 MB (lihat ChartEcharts).
  useEffect(() => {
    if (currentUser && authToken && activeDashboard) {
      preloadEcharts();
    }
  }, [currentUser, authToken, activeDashboard]);

  // Auto Fullscreen saat Mode Presentasi diaktifkan / dinonaktifkan
  useEffect(() => {
    if (isPresentationMode) {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn('Auto fullscreen error:', err);
        });
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [isPresentationMode]);

  // Sync state ketika pengguna menekan tombol ESC browser
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isPresentationMode) {
        setIsPresentationMode(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isPresentationMode]);

  const handleLoginSuccess = (user: User, token: string) => {
    setCurrentUser(user);
    setAuthToken(token);
    const assigned = tenants.find((t) => t.id === user.tenantId);
    if (assigned) {
      setCurrentTenant(assigned);
    }
    // Role admin langsung masuk panel admin, tidak lewat workspace.
    if (user.role === 'admin') {
      setViewMode('admin');
    }
  };

  const handleLogout = async () => {
    if (currentUser) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id }),
        });
      } catch (e) {
        // ignore
      }
    }
    localStorage.removeItem('aionesboard_user');
    sessionStorage.removeItem('aionesboard_user');
    setAuthToken(null);
    setCurrentUser(null);
    setViewMode('workspace');
  };

  /** Muat ringkasan riwayat chat tenant (jumlah pesan per dashboard). */
  const muatChatCounts = async (tenantId: string) => {
    try {
      const res = await fetch(`/api/chats?tenantId=${tenantId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;
      setChatCounts(
        Object.fromEntries(
          data.map((c: { dashboardId: string; messageCount: number }) => [
            c.dashboardId,
            c.messageCount,
          ])
        )
      );
    } catch (err) {
      console.error('Fetch chat counts error:', err);
    }
  };

  // Fetch Dashboards and Alerts when Tenant changes OR user just logged in.
  // (Tanpa authToken di dependency, fetch pertama saat boot kena 401 dan
  // dashboards tidak pernah dimuat ulang setelah login sukses.)
  useEffect(() => {
    if (!currentTenant || !authToken) return;

    // Fetch Dashboards
    // Endpoint kini butuh sesi — kalau belum login (401) response berupa objek
    // error, bukan array. Selalu lindungi dengan res.ok + Array.isArray agar
    // state tidak pernah diisi objek dan merusak .filter() di render.
    fetch(`/api/dashboards?tenantId=${currentTenant.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Dashboard[]) => {
        if (!Array.isArray(data)) return;
        setDashboards(data);
        if (data.length > 0) {
          setActiveDashboard(data[0]);
        } else {
          setActiveDashboard(null);
        }
      })
      .catch((err) => console.error('Fetch dashboards error:', err));

    // Indikator riwayat di kartu dashboard.
    muatChatCounts(currentTenant.id);

    // Fetch Alerts & Notifications
    fetch(`/api/alerts?tenantId=${currentTenant.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setAlertRules(data);
      })
      .catch((err) => console.error('Fetch alerts error:', err));

    fetch(`/api/notifications?tenantId=${currentTenant.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setNotifications(data);
      })
      .catch((err) => console.error('Fetch notifications error:', err));
  }, [currentTenant, authToken]);

  // Handlers for Tenant Switcher
  const handleSelectTenant = (tenant: Tenant) => {
    // Isolasi tenant: hanya admin yang boleh pindah konteks instansi.
    if (currentUser?.role !== 'admin') return;
    setCurrentTenant(tenant);
  };

  // Handlers for Dashboard Selection
  const handleSelectDashboard = (dash: Dashboard) => {
    setActiveDashboard(dash);
  };

  // Handler for New Blank Dashboard
  const handleCreateDashboard = async () => {
    if (!currentTenant) return;
    const res = await fetch('/api/dashboards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: currentTenant.id,
        title: `Dashboard Baru ${currentTenant.shortName} ${dashboards.length + 1}`,
        description: 'Dashboard kustom indikator kinerja',
        sector: currentTenant.sector,
        widgets: [],
      }),
    });
    if (!res.ok) return;
    const newDash = await res.json();
    setDashboards((prev) => [newDash, ...prev]);
    setActiveDashboard(newDash);
  };

  const handleDeleteDashboard = async (dashboardId: string) => {
    if (!currentTenant) return;
    try {
      const res = await fetch(`/api/dashboards/${dashboardId}?tenantId=${currentTenant.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDashboards((prev) => prev.filter((d) => d.id !== dashboardId));
        if (activeDashboard?.id === dashboardId) {
          const remaining = dashboards.filter((d) => d.id !== dashboardId);
          setActiveDashboard(remaining[0] || null);
        }
      }
    } catch (err) {
      console.error('Delete dashboard error:', err);
    }
  };

  const handleDuplicateDashboard = async (dashboard: Dashboard) => {
    if (!currentTenant) return;
    try {
      const res = await fetch(`/api/dashboards/${dashboard.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: currentTenant.id }),
      });
      if (res.ok) {
        const duplicated: Dashboard = await res.json();
        setDashboards((prev) => [duplicated, ...prev]);
        setActiveDashboard(duplicated);
        setViewMode('workspace');
      }
    } catch (err) {
      console.error('Duplicate dashboard error:', err);
    }
  };

  // Handlers for Widget Management
  const handleEditWidget = (widget: WidgetSpec) => {
    setEditingWidget(widget);
    setEditorTab('config');
  };

  const handleManualCorrection = (widget: WidgetSpec) => {
    setEditingWidget(widget);
    setEditorTab('correction');
  };

  const handleSaveWidget = async (updatedWidget: WidgetSpec) => {
    if (!activeDashboard || !currentTenant) return;
    const updatedWidgets = activeDashboard.widgets.map((w) =>
      w.id === updatedWidget.id ? updatedWidget : w
    );
    const updatedDashboard = { ...activeDashboard, widgets: updatedWidgets };

    setActiveDashboard(updatedDashboard);
    setDashboards((prev) =>
      prev.map((d) => (d.id === updatedDashboard.id ? updatedDashboard : d))
    );

    await fetch(`/api/dashboards/${activeDashboard.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        widgets: updatedWidgets,
        tenantId: currentTenant.id,
      }),
    });
  };

  const handleDeleteWidget = async (widgetId: string) => {
    if (!activeDashboard || !currentTenant) return;
    const updatedWidgets = activeDashboard.widgets.filter((w) => w.id !== widgetId);
    const updatedDashboard = { ...activeDashboard, widgets: updatedWidgets };

    setActiveDashboard(updatedDashboard);
    setDashboards((prev) =>
      prev.map((d) => (d.id === updatedDashboard.id ? updatedDashboard : d))
    );

    await fetch(`/api/dashboards/${activeDashboard.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        widgets: updatedWidgets,
        tenantId: currentTenant.id,
      }),
    });
  };

  const handleDuplicateWidget = async (widget: WidgetSpec) => {
    if (!activeDashboard || !currentTenant) return;
    const newWidget: WidgetSpec = {
      ...widget,
      id: `w-dup-${Date.now()}`,
      title: `${widget.title} (Salinan)`,
      grid: { ...widget.grid, x: 0, y: 0 },
    };
    const updatedWidgets = [newWidget, ...activeDashboard.widgets];
    const updatedDashboard = { ...activeDashboard, widgets: updatedWidgets };

    setActiveDashboard(updatedDashboard);
    setDashboards((prev) =>
      prev.map((d) => (d.id === updatedDashboard.id ? updatedDashboard : d))
    );

    await fetch(`/api/dashboards/${activeDashboard.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        widgets: updatedWidgets,
        tenantId: currentTenant.id,
      }),
    });
  };

  // Reorder widget via drag-and-drop: simpan urutan baru lalu persist.
  const handleReorderWidgets = async (orderedIds: string[]) => {
    if (!activeDashboard || !currentTenant) return;
    const peta = new Map(activeDashboard.widgets.map((w) => [w.id, w]));
    const ordered = orderedIds.map((id) => peta.get(id)).filter((w): w is WidgetSpec => !!w);
    if (ordered.length !== activeDashboard.widgets.length) return; // ada id tak dikenal — abaikan
    const updatedDashboard = { ...activeDashboard, widgets: ordered };

    setActiveDashboard(updatedDashboard);
    setDashboards((prev) =>
      prev.map((d) => (d.id === updatedDashboard.id ? updatedDashboard : d))
    );

    await fetch(`/api/dashboards/${activeDashboard.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        widgets: ordered,
        tenantId: currentTenant.id,
      }),
    });
  };

  // Resize lebar widget: grid.w diubah (bucket 4/6/8/12) lalu persist.
  const handleResizeWidget = async (widgetId: string, w: number) => {
    if (!activeDashboard || !currentTenant) return;
    const updatedWidgets = activeDashboard.widgets.map((wg) =>
      wg.id === widgetId ? { ...wg, grid: { ...(wg.grid || { x: 0, y: 0, h: 2 }), w } } : wg
    );
    const updatedDashboard = { ...activeDashboard, widgets: updatedWidgets };

    setActiveDashboard(updatedDashboard);
    setDashboards((prev) =>
      prev.map((d) => (d.id === updatedDashboard.id ? updatedDashboard : d))
    );

    await fetch(`/api/dashboards/${activeDashboard.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        widgets: updatedWidgets,
        tenantId: currentTenant.id,
      }),
    });
  };

  const handleAddWidgetFromCatalog = async (widget: WidgetSpec) => {
    if (!activeDashboard || !currentTenant) return;
    const updatedWidgets = [widget, ...activeDashboard.widgets];
    const updatedDashboard = { ...activeDashboard, widgets: updatedWidgets };

    setActiveDashboard(updatedDashboard);
    setDashboards((prev) =>
      prev.map((d) => (d.id === updatedDashboard.id ? updatedDashboard : d))
    );

    await fetch(`/api/dashboards/${activeDashboard.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        widgets: updatedWidgets,
        tenantId: currentTenant.id,
      }),
    });
  };

  // Handler for Global Filters
  const handleGlobalFiltersChange = async (filters: GlobalFilters) => {
    if (!activeDashboard || !currentTenant) return;
    const updatedDashboard = { ...activeDashboard, globalFilters: filters };
    setActiveDashboard(updatedDashboard);
    setDashboards((prev) =>
      prev.map((d) => (d.id === updatedDashboard.id ? updatedDashboard : d))
    );

    await fetch(`/api/dashboards/${activeDashboard.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        globalFilters: filters,
        tenantId: currentTenant.id,
      }),
    });
  };

  // Trigger Live Alert Evaluation
  const handleTriggerAlertEvaluation = async () => {
    if (!currentTenant) return;
    const res = await fetch('/api/alerts/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: currentTenant.id }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.notifications)) {
      setNotifications((prev) => [...data.notifications, ...prev]);
    }
  };

  const handleAddAlertRule = async (rule: Partial<AlertRule>) => {
    if (!currentTenant) return;
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    if (!res.ok) return;
    const newRule = await res.json();
    setAlertRules((prev) => [newRule, ...prev]);
  };

  const unreadCount = Array.isArray(notifications) ? notifications.filter((n) => !n.isRead).length : 0;

  // Widget yang benar-benar tampil di kanvas internal setelah filter view-only diterapkan.
  const widgetsTampilInternal = (activeDashboard?.widgets || []).filter(
    (w) =>
      (viewFilters.kategori === 'Semua' || w.category === viewFilters.kategori) &&
      (viewFilters.unitKerja === 'Semua' || w.unitKerja === viewFilters.unitKerja) &&
      (viewFilters.periode === 'Semua' || w.periode === viewFilters.periode)
  );
  const filterAktif =
    viewFilters.periode !== 'Semua' ||
    viewFilters.unitKerja !== 'Semua' ||
    viewFilters.kategori !== 'Semua';

  if (!currentUser || !authToken) {
    return <Login onLoginSuccess={handleLoginSuccess} tenants={tenants} />;
  }

  // Fallback untuk halaman yang di-lazy-load di bawah.
  const pageFallback = (
    <div className="flex-1 flex items-center justify-center h-screen text-sm text-ink-2">
      Memuat modul...
    </div>
  );

  return (
    <div className="fixed inset-0 text-ink flex flex-row font-sans antialiased overflow-hidden">
      {/* ================= LEFT SIDEBAR ================= */}
      {!isPresentationMode && viewMode !== 'admin' && (
        <>
          {isMobileNavOpen && (
            <div
              className="fixed inset-0 z-40 bg-ink/40 md:hidden"
              onClick={() => setIsMobileNavOpen(false)}
              aria-hidden="true"
            />
          )}
          <div
            className={`fixed inset-y-0 left-0 z-50 md:static md:z-40 md:inset-auto md:self-stretch shrink-0 flex flex-col min-h-0 transition-transform duration-200 ${
              isMobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
            }`}
          >
            <Sidebar
              isCollapsed={isMobileNavOpen ? false : isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              tenants={tenants}
              currentTenant={currentTenant}
              onSelectTenant={handleSelectTenant}
              dashboards={dashboards}
              activeDashboard={activeDashboard}
              onSelectDashboard={(d) => {
                setViewMode('workspace');
                handleSelectDashboard(d);
                setIsMobileNavOpen(false);
              }}
              onCreateDashboard={() => {
                setViewMode('workspace');
                handleCreateDashboard();
                setIsMobileNavOpen(false);
              }}
              onOpenDashboardList={() => {
                setViewMode('dashboards');
                setIsMobileNavOpen(false);
              }}
              onOpenAudit={() => {
                setViewMode('audit');
                setIsMobileNavOpen(false);
              }}
              onOpenAlerts={() => {
                setViewMode('alerts');
                setIsMobileNavOpen(false);
              }}
              unreadAlertsCount={unreadCount}
              currentView={viewMode}
              onOpenAdmin={() => {
                setViewMode('admin');
                setIsMobileNavOpen(false);
              }}
              currentUser={currentUser}
              onLogout={handleLogout}
            />
          </div>
        </>
      )}

      {/* ================= MAIN COLUMN (HEADER & CONTENT) ================= */}
      <div className="flex flex-col flex-1 min-w-0 w-full overflow-hidden">
      {/* ================= TOP HEADER (full width 100vw di bagian paling atas) ================= */}
      {!isPresentationMode && viewMode !== 'admin' && (
        <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-line shrink-0 w-full">
          <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

            {/* ── Kiri: toggle sidebar + judul halaman ── */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => {
                  // Mobile (<768px): buka drawer overlay. Desktop: collapse sidebar.
                  if (window.matchMedia('(max-width: 767px)').matches) {
                    setIsMobileNavOpen(true);
                  } else {
                    setIsSidebarCollapsed(!isSidebarCollapsed);
                  }
                }}
                className="p-1.5 rounded-control text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors shrink-0"
                title="Buka / Tutup Sidebar"
                aria-label="Buka atau tutup sidebar"
                aria-expanded={isMobileNavOpen}
              >
                <Menu className="w-4 h-4" />
              </button>

              <div className="h-5 w-px bg-line shrink-0 hidden sm:block" />

              <div className="min-w-0">
                {/* Breadcrumb: nama tenant → halaman aktif */}
                <div className="flex items-center gap-1.5 text-[10px] text-ink-3 font-medium uppercase tracking-wider truncate">
                  <Building2 className="w-3 h-3 shrink-0 text-ink-3" />
                  <span className="truncate max-w-[18vw]">{currentTenant?.name || 'BUMD'}</span>
                  <span className="text-ink-3">/</span>
                  <span className="text-brand">
                    {viewMode === 'dashboards' ? 'Galeri'
                      : viewMode === 'audit' ? 'Audit'
                      : viewMode === 'alerts' ? 'Alert'
                      : 'Workspace'}
                  </span>
                </div>
                <h1 className="truncate max-w-[42vw] sm:max-w-[28rem] text-sm font-bold text-ink leading-tight mt-0.5">
                  {viewMode === 'dashboards'
                    ? 'Galeri Dashboard'
                    : viewMode === 'audit'
                      ? 'Jejak Audit & Kepatuhan'
                      : viewMode === 'alerts'
                        ? 'Ambang Batas & Alert'
                        : activeDashboard?.title || 'Belum ada dashboard'}
                </h1>
              </div>

              {/* Widget count badge — hanya di workspace */}
              {viewMode === 'workspace' && activeDashboard && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-chip bg-surface-2 border border-line text-[10px] font-mono text-ink-3 shrink-0">
                  <LayoutGrid className="w-2.5 h-2.5" />
                  {activeDashboard.widgets?.length || 0} widget
                </span>
              )}
            </div>

            {/* ── Kanan: aksi utama ── */}
            <div className="flex items-center gap-1.5 shrink-0">

              {/* Tombol Chat RAG */}
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-control transition-colors border ${
                  isChatOpen
                    ? 'bg-brand text-white border-brand'
                    : 'bg-surface hover:bg-surface-2 text-ink-2 border-line'
                }`}
                title="Buka / Tutup Chat RAG Copilot"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">RAG Copilot</span>
              </button>

              <ThemeToggle />

              <div className="h-5 w-px bg-line shrink-0" />

              {/* Tambah dashboard baru (hanya di galeri) */}
              {viewMode === 'dashboards' && (
                <button
                  onClick={() => { setViewMode('workspace'); handleCreateDashboard(); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors"
                  title="Buat dashboard baru"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Baru</span>
                </button>
              )}

              {/* Katalog preset (hanya di workspace) */}
              {viewMode === 'workspace' && activeDashboard && (
                <button
                  onClick={() => setIsCatalogOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors"
                  title="Tambah widget dari katalog preset"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Katalog</span>
                </button>
              )}

              {/* More menu (hanya di workspace) */}
              {viewMode === 'workspace' && (
                <div className="relative">
                  <button
                    onClick={() => setIsMoreMenuOpen((v) => !v)}
                    className="p-1.5 rounded-control border border-line text-ink-2 hover:bg-surface-2 transition-colors"
                    title="Aksi lainnya"
                  >
                    <EllipsisVertical className="w-4 h-4" />
                  </button>

                  {isMoreMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsMoreMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1.5 w-56 bg-surface border border-line rounded-card shadow-pop z-50 p-1 text-xs overflow-hidden">

                        <div className="px-2.5 py-1.5 text-[10px] font-semibold text-ink-3 uppercase tracking-wider">
                          Tampilan
                        </div>
                        <button
                          onClick={() => { setIsMoreMenuOpen(false); setIsPresentationMode(true); }}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
                        >
                          <Maximize2 className="w-3.5 h-3.5 shrink-0 text-ink-3" />
                          <span>Mode Presentasi</span>
                        </button>

                        <div className="px-2.5 py-1.5 text-[10px] font-semibold text-ink-3 uppercase tracking-wider mt-0.5">
                          Ekspor & Bagikan
                        </div>
                        <button
                          onClick={() => { setIsMoreMenuOpen(false); setIsExportOpen(true); }}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5 shrink-0 text-ink-3" />
                          <span>Cetak / Ekspor</span>
                        </button>
                        <button
                          onClick={() => { setIsMoreMenuOpen(false); setIsShareOpen(true); }}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
                        >
                          <Share2 className="w-3.5 h-3.5 shrink-0 text-ink-3" />
                          <span>Bagikan Tautan</span>
                        </button>

                        {activeDashboard && (
                          <div className="mt-1 pt-1 border-t border-line">
                            {hapusKonfirmasi ? (
                              <div className="mx-1 my-1 p-2.5 rounded-control bg-neg/15 border border-neg/30">
                                <p className="text-[11px] text-neg font-medium mb-2">Hapus dashboard ini?</p>
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => { setHapusKonfirmasi(false); setIsMoreMenuOpen(false); handleDeleteDashboard(activeDashboard.id); }}
                                    className="flex-1 px-2 py-1.5 bg-neg hover:bg-neg text-white rounded-control text-[11px] font-bold transition-colors"
                                  >
                                    Ya, Hapus
                                  </button>
                                  <button
                                    onClick={() => setHapusKonfirmasi(false)}
                                    className="flex-1 px-2 py-1.5 bg-surface text-ink-2 hover:bg-surface-2 border border-line rounded-control text-[11px] transition-colors"
                                  >
                                    Batal
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setHapusKonfirmasi(true)}
                                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-neg hover:bg-neg/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Hapus Dashboard</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      {/* ================= BODY CONTAINER (MAIN CONTENT) ================= */}

        {/* ================= MAIN CONTENT VIEWPORT ================= */}
        <div className={`flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto transition-[padding] duration-200 ${isChatOpen ? 'lg:pr-[440px]' : ''}`}>
          {viewMode === 'admin' ? (
            <React.Suspense fallback={pageFallback}>
              <Admin
                currentUser={currentUser}
                onLogout={handleLogout}
              />
            </React.Suspense>
          ) : (
            <>
              {viewMode === 'dashboards' ? (
                <React.Suspense fallback={pageFallback}>
                  <DashboardList
                    dashboards={dashboards}
                    currentTenant={currentTenant}
                    onSelectDashboard={(d) => {
                      setActiveDashboard(d);
                      setViewMode('workspace');
                    }}
                    onCreateDashboard={() => {
                      handleCreateDashboard();
                      setViewMode('workspace');
                    }}
                    onOpenChat={() => {
                      setViewMode('workspace');
                      setIsChatOpen(true);
                    }}
                    onDuplicateDashboard={handleDuplicateDashboard}
                    onDeleteDashboard={handleDeleteDashboard}
                    onShareDashboard={(d) => {
                      setActiveDashboard(d);
                      setIsShareOpen(true);
                    }}
                    chatCounts={chatCounts}
                    onOpenChatHistory={(d) => {
                      setActiveDashboard(d);
                      setViewMode('workspace');
                      setIsChatOpen(true);
                    }}
                    onBackToWorkspace={() => setViewMode('workspace')}
                  />
                </React.Suspense>
              ) : viewMode === 'audit' ? (
                <React.Suspense fallback={pageFallback}>
                  <AuditLogPage
                    tenantId={currentTenant?.id || 'tenant-pdam'}
                    onBackToWorkspace={() => setViewMode('workspace')}
                  />
                </React.Suspense>
              ) : viewMode === 'alerts' ? (
                <React.Suspense fallback={pageFallback}>
                  <AlertsPage
                    tenantId={currentTenant?.id || 'tenant-pdam'}
                    onBackToWorkspace={() => setViewMode('workspace')}
                  />
                </React.Suspense>
              ) : (
                <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
                  {/* Executive Presentation Top Header with Title when Active */}
                  {isPresentationMode && activeDashboard && (
                    <div className="mb-6 bg-surface text-ink rounded-card p-5 border border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-300">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-pos animate-pulse" />
                          <span className="text-xs uppercase font-bold tracking-wider text-brand">
                            {currentTenant?.name || 'Laporan Eksekutif'} • Mode Presentasi
                          </span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-extrabold text-ink tracking-tight">
                          {activeDashboard.title}
                        </h1>
                        {activeDashboard.description && (
                          <p className="text-xs sm:text-sm text-ink-2 mt-1 max-w-3xl leading-relaxed font-medium">
                            {activeDashboard.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        <span className="text-xs text-ink-2 font-semibold px-2.5 py-1 bg-surface-2 rounded-control border border-line hidden sm:inline-block">
                          {activeDashboard.widgets.length} Widget
                        </span>
                        <button
                          onClick={() => setIsPresentationMode(false)}
                          className="px-3.5 py-1.5 rounded-control bg-surface-2 hover:bg-line/50 text-ink-2 hover:text-ink border border-line transition-all flex items-center gap-1.5 text-xs font-bold active:scale-[0.98]"
                        >
                          <Minimize2 className="w-4 h-4 text-ink-2" />
                          <span>Keluar Presentasi</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Visual Header & Toolbar Card */}
                  {activeDashboard && !isPresentationMode && (
                    <div className="mb-5 card">
                      {/* Baris atas: info dashboard */}
                      <div className="px-4 sm:px-5 pt-4 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          {/* Label sektor */}
                          {currentTenant?.sector && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-ink-3 mb-1.5">
                              <Building2 className="w-3 h-3" />
                              {currentTenant.sector}
                              {currentTenant.city && <> · {currentTenant.city}</>}
                            </span>
                          )}
                          {/* Deskripsi / sub judul */}
                          <h2 className="text-sm sm:text-[15px] font-bold text-ink leading-snug truncate max-w-2xl">
                            {activeDashboard.description ||
                              `${currentTenant?.name || ''} — Dashboard Kinerja`}
                          </h2>
                          {/* Metadata baris bawah */}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-2 bg-surface-2 border border-line px-2 py-0.5 rounded-chip">
                              <LayoutGrid className="w-3 h-3 text-ink-3" />
                              {activeDashboard.widgets.length} widget
                            </span>
                            <span className="text-line-strong text-xs">·</span>
                            <span className="inline-flex items-center gap-1 text-[11px] text-ink-3">
                              <Clock className="w-3 h-3" />
                              {new Date(activeDashboard.updatedAt).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            <span className="text-line-strong text-xs">·</span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-pos bg-pos/15 border border-pos/30/70 px-2 py-0.5 rounded-chip">
                              <Radio className="w-2.5 h-2.5" />
                              RAG Aktif
                            </span>
                          </div>
                        </div>

                        {/* Tombol Mode Presentasi */}
                        <button
                          onClick={() => setIsPresentationMode(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors shrink-0 self-start sm:self-center"
                        >
                          <Maximize2 className="w-3.5 h-3.5 text-ink-3" />
                          <span>Presentasi</span>
                        </button>
                      </div>

                      {/* Divider + Toolbar bawah */}
                      <div className="border-t border-line px-4 sm:px-5 py-2.5 flex items-center justify-between gap-2 bg-surface-2 rounded-b-card">
                        {/* Kiri: status filter aktif (placeholder) */}
                        <div className="flex items-center gap-1.5">
                          <FileCheck className="w-3.5 h-3.5 text-ink-3" />
                          <span className="text-[11px] text-ink-3 font-medium">
                            {currentTenant?.name || 'Dashboard aktif'}
                          </span>
                        </div>

                        {/* Kanan: tombol aksi */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setIsCatalogOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors"
                          >
                            <Plus className="w-3 h-3 text-ink-3" />
                            Tambah Widget
                          </button>
                          <button
                            onClick={() => setIsExportOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors"
                          >
                            <Download className="w-3 h-3 text-ink-3" />
                            Ekspor
                          </button>
                          <button
                            onClick={() => setIsShareOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white bg-brand hover:bg-brand-ink rounded-control transition-colors"
                          >
                            <Share2 className="w-3 h-3" />
                            Bagikan
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Filter dashboard internal (view-only, ala Tableau) */}
                  {activeDashboard && (activeDashboard.widgets?.length || 0) > 0 && (
                    <div className="mb-4">
                      <GlobalFiltersBar
                        filters={viewFilters}
                        onChange={setViewFilters}
                        widgets={activeDashboard.widgets}
                        shownCount={widgetsTampilInternal.length}
                      />
                    </div>
                  )}

                  <ActiveChartFilterChip />

                  {/* Dashboard Canvas Grid */}
                  <ChartSelectionProvider>
                  <DashboardCanvas
                    widgets={widgetsTampilInternal}
                    readOnly={filterAktif}
                    onEditWidget={handleEditWidget}
                    onManualCorrection={handleManualCorrection}
                    onDeleteWidget={handleDeleteWidget}
                    onDuplicateWidget={handleDuplicateWidget}
                    onReorderWidgets={handleReorderWidgets}
                    onResizeWidget={handleResizeWidget}
                    onOpenCatalog={() => setIsCatalogOpen(true)}
                    onOpenChat={() => setIsChatOpen(true)}
                  />
                  </ChartSelectionProvider>
                </main>
              )}
            </>
          )}
        </div>
      </div>

      {/* ================= MODALS & DRAWERS ================= */}

      {/* 1. Chat Panel with SSE Streaming */}
      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => {
          setIsChatOpen(false);
          // Pesan baru mungkin saja bertambah — segarkan indikator.
          if (currentTenant) muatChatCounts(currentTenant.id);
        }}
        sector={currentTenant?.sector || 'pdam'}
        tenantId={currentTenant?.id || 'tenant-pdam'}
        dashboardId={activeDashboard?.id}
        onDashboardUpdated={(newDash) => {
          setActiveDashboard(newDash);
          setDashboards((prev) => [
            newDash,
            ...prev.filter((d) => d.id !== newDash.id),
          ]);
        }}
      />

      {/* 2. 40 Widget Catalog Preset Sidebar */}
      <CatalogSidebar
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        sector={currentTenant?.sector || 'pdam'}
        onAddWidget={handleAddWidgetFromCatalog}
      />

      {/* 3. Widget Editor & F-14 Manual Correction Modal */}
      <WidgetEditorModal
        isOpen={!!editingWidget}
        onClose={() => setEditingWidget(null)}
        widget={editingWidget}
        onSave={handleSaveWidget}
        initialTab={editorTab}
      />

      {/* 5. Alerts & Notification Center Modal */}
      <AlertsModal
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        tenantId={currentTenant?.id || 'tenant-pdam'}
        alertRules={alertRules}
        notifications={notifications}
        onTriggerEvaluate={handleTriggerAlertEvaluation}
        onAddRule={handleAddAlertRule}
      />

      {/* 7. Share Read-Only Link Modal */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        dashboard={activeDashboard}
      />

      {/* 8. Export Printable Executive Report Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        dashboard={activeDashboard}
        tenant={currentTenant}
      />

    </div>
  );
}
