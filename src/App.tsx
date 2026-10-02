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
import { preloadEcharts } from './components/widgets/ChartEcharts';
import { SourceDrawer } from './components/SourceDrawer';
import { WidgetEditorModal } from './components/WidgetEditorModal';
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
  Citation,
  Dashboard,
  GlobalFilters,
  NotificationItem,
  Tenant,
  User,
  WidgetSpec,
} from './types';

export default function App() {
  // Public Share Route Handling (No Login Required)
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const shareMatch = pathname.match(/^\/share\/([^/]+)/);
  const shareToken = shareMatch ? shareMatch[1] : null;

  if (shareToken) {
    return (
      <React.Suspense fallback={<div className="min-h-screen bg-slate-100" />}>
        <ShareView token={shareToken} />
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
  const [hapusKonfirmasi, setHapusKonfirmasi] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  // Jumlah pesan riwayat per dashboardId — indikator di kartu DashboardList.
  const [chatCounts, setChatCounts] = useState<Record<string, number>>({});

  // Modals & Panels State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Active Selection for Drawer & Editor
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [isSourceDrawerOpen, setIsSourceDrawerOpen] = useState(false);
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

  // Open Citation Drawer
  const handleOpenCitation = (citation: Citation) => {
    setSelectedCitation(citation);
    setIsSourceDrawerOpen(true);
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

  if (!currentUser || !authToken) {
    return <Login onLoginSuccess={handleLoginSuccess} tenants={tenants} />;
  }

  // Fallback untuk halaman yang di-lazy-load di bawah.
  const pageFallback = (
    <div className="flex-1 flex items-center justify-center h-screen text-sm text-slate-500">
      Memuat modul...
    </div>
  );

  return (
    <div className="min-h-screen bg-blue-50 text-slate-800 flex flex-row font-sans antialiased overflow-hidden h-screen">
      {/* ================= LEFT SIDEBAR (disembunyikan di mode presentasi & admin) ================= */}
      {!isPresentationMode && viewMode !== 'admin' && (
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          tenants={tenants}
          currentTenant={currentTenant}
          onSelectTenant={handleSelectTenant}
          dashboards={dashboards}
          activeDashboard={activeDashboard}
          onSelectDashboard={(d) => {
            setViewMode('workspace');
            handleSelectDashboard(d);
          }}
          onCreateDashboard={() => {
            setViewMode('workspace');
            handleCreateDashboard();
          }}
          onOpenDashboardList={() => setViewMode('dashboards')}
          onOpenAudit={() => setViewMode('audit')}
          onOpenAlerts={() => setViewMode('alerts')}
          unreadAlertsCount={unreadCount}
          currentView={viewMode}
          onOpenAdmin={() => setViewMode('admin')}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      )}

      {/* ================= MAIN CONTENT VIEWPORT ================= */}
      <div className={`flex-1 flex flex-col min-w-0 h-screen overflow-y-auto transition-[padding] duration-200 ${isChatOpen ? 'lg:pr-[440px]' : ''}`}>
        {viewMode === 'admin' ? (
          <React.Suspense fallback={pageFallback}>
            <Admin
              currentUser={currentUser}
              onLogout={handleLogout}
            />
          </React.Suspense>
        ) : (
          <>
            {/* ================= TOP HEADER (ringkas, seragam seluruh halaman) ================= */}
            {!isPresentationMode && (
              <header className="sticky top-0 z-30 bg-white border-b border-blue-100">
                <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
                  {/* Kiri: toggle sidebar + pemilih dashboard */}
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                      className="p-1.5 rounded-lg text-blue-500 hover:text-blue-900 hover:bg-blue-50 transition-colors shrink-0"
                      title="Buka / Tutup Sidebar"
                    >
                      <Menu className="w-4 h-4" />
                    </button>

                    <div className="h-4 w-px bg-blue-100 hidden sm:block" />

                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wide text-blue-500 truncate max-w-[40vw]">
                        {currentTenant?.name}
                      </div>
                      <h1 className="truncate max-w-[46vw] sm:max-w-[26rem] text-sm font-bold text-blue-900">
                        {viewMode === 'dashboards'
                          ? 'Galeri Dashboard'
                          : viewMode === 'audit'
                            ? 'Jejak Audit'
                            : viewMode === 'alerts'
                              ? 'Ambang Batas & Alert'
                              : activeDashboard?.title || 'Belum ada dashboard'}
                      </h1>
                    </div>
                  </div>

                  {/* Kanan: aksi utama + menu ringkas */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setIsChatOpen(!isChatOpen)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-800 hover:bg-blue-900 rounded-lg transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Chat RAG Copilot</span>
                    </button>

                    {viewMode === 'dashboards' && (
                      <button
                        onClick={() => {
                          setViewMode('workspace');
                          handleCreateDashboard();
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 text-blue-700" />
                        <span className="hidden sm:inline">Dashboard Baru</span>
                      </button>
                    )}

                    {viewMode === 'workspace' && activeDashboard && (
                      <button
                        onClick={() => setIsCatalogOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg transition-colors"
                        title="Tambah widget dari katalog preset"
                      >
                        <LayoutGrid className="w-3.5 h-3.5 text-blue-700" />
                        <span className="hidden sm:inline">Katalog Preset</span>
                      </button>
                    )}

                    {viewMode === 'workspace' && (
                      <div className="relative">
                        <button
                          onClick={() => setIsMoreMenuOpen((v) => !v)}
                          className="p-1.5 rounded-lg border border-blue-100 text-blue-700 hover:bg-blue-50 transition-colors"
                          title="Aksi lain"
                        >
                          <EllipsisVertical className="w-4 h-4" />
                        </button>

                        {isMoreMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsMoreMenuOpen(false)} />
                            <div className="absolute right-0 mt-1 w-64 bg-white border border-blue-100 rounded-xl shadow-lg z-50 p-1.5 text-xs">
                              <button
                                onClick={() => {
                                  setIsMoreMenuOpen(false);
                                  setIsPresentationMode(true);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-600 hover:bg-blue-50"
                              >
                                <Maximize2 className="w-4 h-4 shrink-0" />
                                <span>Mode Presentasi</span>
                              </button>
                              <button
                                onClick={() => {
                                  setIsMoreMenuOpen(false);
                                  setIsExportOpen(true);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-600 hover:bg-blue-50"
                              >
                                <Printer className="w-4 h-4 shrink-0" />
                                <span>Cetak / Ekspor</span>
                              </button>
                              <button
                                onClick={() => {
                                  setIsMoreMenuOpen(false);
                                  setIsShareOpen(true);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-600 hover:bg-blue-50"
                              >
                                <Share2 className="w-4 h-4 shrink-0" />
                                <span>Bagikan Tautan</span>
                              </button>



                              {activeDashboard && (
                                <div className="mt-1 pt-1.5 border-t border-blue-100">
                                  {hapusKonfirmasi ? (
                                    <div className="mx-1.5 my-1 p-2 rounded-lg bg-rose-50 border border-rose-200">
                                      <p className="text-[11px] text-rose-700 mb-1.5">Hapus dashboard ini?</p>
                                      <div className="flex gap-1.5">
                                        <button
                                          onClick={() => {
                                            setHapusKonfirmasi(false);
                                            setIsMoreMenuOpen(false);
                                            handleDeleteDashboard(activeDashboard.id);
                                          }}
                                          className="flex-1 px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-bold"
                                        >
                                          Hapus
                                        </button>
                                        <button
                                          onClick={() => setHapusKonfirmasi(false)}
                                          className="flex-1 px-2 py-1 bg-white text-slate-600 hover:bg-blue-50 border border-blue-100 rounded-md text-[11px]"
                                        >
                                          Batal
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setHapusKonfirmasi(true)}
                                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-rose-600 hover:bg-rose-50"
                                    >
                                      <Trash2 className="w-4 h-4 shrink-0" />
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
                  <div className="mb-6 bg-white/95 backdrop-blur-md text-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-300">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-xs shadow-emerald-500/50" />
                        <span className="text-xs uppercase font-bold tracking-wider text-blue-600">
                          {currentTenant?.name || 'Laporan Eksekutif'} • Mode Presentasi
                        </span>
                      </div>
                      <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                        {activeDashboard.title}
                      </h1>
                      {activeDashboard.description && (
                        <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed font-medium">
                          {activeDashboard.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <span className="text-xs text-slate-600 font-semibold px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200/80 hidden sm:inline-block">
                        {activeDashboard.widgets.length} Widget
                      </span>
                      <button
                        onClick={() => setIsPresentationMode(false)}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 border border-slate-200/90 transition-all flex items-center gap-1.5 text-xs font-bold shadow-2xs active:scale-[0.98]"
                      >
                        <Minimize2 className="w-4 h-4 text-slate-600" />
                        <span>Keluar Presentasi</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Visual Header & Toolbar Card */}
                {activeDashboard && !isPresentationMode && (
                  <div className="mb-6 bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-300 rounded-2xl p-4 sm:p-5">
                    {/* Ringkasan & Deskripsi Header */}
                    <div className="pb-4 mb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-relaxed">
                          {activeDashboard.description ||
                            `${currentTenant?.name || ''} — ${currentTenant?.city || ''}`}
                        </h2>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                            {activeDashboard.widgets.length} widget
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Diperbarui{' '}
                            {new Date(activeDashboard.updatedAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Mode Presentasi Button (di atas 3 tombol aksi) */}
                      <button
                        onClick={() => setIsPresentationMode(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-blue-50/80 hover:text-blue-700 border border-slate-200/90 hover:border-blue-200 rounded-xl shadow-2xs hover:shadow-xs transition-all duration-150 active:scale-[0.98] self-start sm:self-center shrink-0"
                      >
                        <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Mode Presentasi</span>
                      </button>
                    </div>

                    {/* Controls Toolbar (Widget Counter & Action Buttons) */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {/* Sub-group Kiri: Status & Counter */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Widget Counter Pill */}
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100/90 border border-slate-200/80 rounded-xl shadow-2xs">
                          <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
                          {activeDashboard.widgets.length} Widget
                        </span>
                      </div>

                      {/* Sub-group Kanan: Aksi Utama */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setIsCatalogOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl shadow-2xs hover:shadow-xs transition-all duration-150 active:scale-[0.98]"
                        >
                          <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
                          <span>Tambah Chart</span>
                        </button>

                        <button
                          onClick={() => setIsExportOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl shadow-2xs hover:shadow-xs transition-all duration-150 active:scale-[0.98]"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-600" />
                          <span>Ekspor</span>
                        </button>

                        <button
                          onClick={() => setIsShareOpen(true)}
                          className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 rounded-xl shadow-md shadow-blue-800/20 hover:shadow-lg hover:shadow-blue-800/30 transition-all duration-150 active:scale-[0.98]"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Bagikan</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dashboard Canvas Grid */}
                <DashboardCanvas
                  widgets={activeDashboard?.widgets || []}
                  onEditWidget={handleEditWidget}
                  onManualCorrection={handleManualCorrection}
                  onDeleteWidget={handleDeleteWidget}
                  onDuplicateWidget={handleDuplicateWidget}
                  onReorderWidgets={handleReorderWidgets}
                  onResizeWidget={handleResizeWidget}
                  onOpenCitation={handleOpenCitation}
                  onOpenCatalog={() => setIsCatalogOpen(true)}
                  onOpenChat={() => setIsChatOpen(true)}
                />
              </main>
            )}
          </>
        )}
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

      {/* 3. Source Document Citation Drawer */}
      <SourceDrawer
        isOpen={isSourceDrawerOpen}
        onClose={() => setIsSourceDrawerOpen(false)}
        citation={selectedCitation}
      />

      {/* 4. Widget Editor & F-14 Manual Correction Modal */}
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
