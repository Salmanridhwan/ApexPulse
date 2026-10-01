import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Award,
  Bell,
  Building2,
  CheckCircle,
  ChevronDown,
  Clock,
  Download,
  FileCheck,
  FileText,
  Filter,
  History,
  Layers,
  Trash2,
  LayoutGrid,
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
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { AlertsModal } from './components/AlertsModal';
import { LogoTile } from './components/BrandMark';
import { AuditLogModal } from './components/AuditLogModal';
import { CatalogSidebar } from './components/CatalogSidebar';
import { ChatPanel } from './components/ChatPanel';
import { DashboardCanvas } from './components/DashboardCanvas';
import { ExportModal } from './components/ExportModal';
import { GlobalFiltersBar } from './components/GlobalFiltersBar';
import { RagProbeModal } from './components/RagProbeModal';
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
    return localStorage.getItem('apexpulse_user') || sessionStorage.getItem('apexpulse_user') ? 'cookie-session' : null;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('apexpulse_user') || sessionStorage.getItem('apexpulse_user');
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
  const [viewMode, setViewMode] = useState<'workspace' | 'dashboards' | 'admin'>('workspace');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<Dashboard | null>(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hapusKonfirmasi, setHapusKonfirmasi] = useState(false);

  // RAG Mode State (Jalur A vs Jalur B)
  const [activeRagMode, setActiveRagMode] = useState<'structured' | 'prose'>('structured');

  // Modals & Panels State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isProbeOpen, setIsProbeOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);

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

  const handleLoginSuccess = (user: User, token: string) => {
    setCurrentUser(user);
    setAuthToken(token);
    const assigned = tenants.find((t) => t.id === user.tenantId);
    if (assigned) {
      setCurrentTenant(assigned);
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
    localStorage.removeItem('apexpulse_user');
    sessionStorage.removeItem('apexpulse_user');
    setAuthToken(null);
    setCurrentUser(null);
    setViewMode('workspace');
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

  // Toggle RAG Mode
  const handleToggleRagMode = async (mode: 'structured' | 'prose') => {
    setActiveRagMode(mode);
    await fetch('/api/rag/set-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
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
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-row font-sans antialiased overflow-hidden h-screen">
      {/* ================= LEFT SIDEBAR (Always present across all views) ================= */}
      {!isPresentationMode && (
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
          activeRagMode={activeRagMode}
          onToggleRagMode={handleToggleRagMode}
          onOpenCatalog={() => setIsCatalogOpen(true)}
          onOpenProbe={() => setIsProbeOpen(true)}
          onOpenAudit={() => setIsAuditLogOpen(true)}
          onOpenAlerts={() => setIsAlertsOpen(true)}
          unreadAlertsCount={unreadCount}
          currentView={viewMode}
          onOpenDashboardList={() => setViewMode('dashboards')}
          onOpenAdmin={() => setViewMode('admin')}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      )}

      {/* ================= MAIN CONTENT VIEWPORT ================= */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {viewMode === 'admin' ? (
          <React.Suspense fallback={pageFallback}>
            <Admin
              onBackToWorkspace={() => setViewMode('workspace')}
              onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />
          </React.Suspense>
        ) : viewMode === 'dashboards' ? (
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
              onBackToWorkspace={() => setViewMode('workspace')}
            />
          </React.Suspense>
        ) : (
          <>
            {/* ================= CLEAN TOP HEADER ================= */}
            {!isPresentationMode && (
              <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 shadow-2xs">
                <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
                  {/* Left Zone: Sidebar Toggle & Contextual Breadcrumb */}
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                      title="Buka / Tutup Sidebar"
                    >
                      <Menu className="w-4 h-4" />
                    </button>

                    <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                    <div className="flex items-center gap-1.5 text-xs truncate">
                      <span className="font-semibold text-slate-700 truncate">{currentTenant?.name}</span>
                      <span className="text-slate-300">/</span>
                      <span className="font-bold text-slate-900 truncate">{activeDashboard?.title}</span>
                    </div>
                  </div>

                  {/* Right Zone: Primary Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Print & Export */}
                    <button
                      onClick={() => setIsExportOpen(true)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5"
                      title="Cetak & Ekspor Laporan Resmi"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span className="hidden sm:inline">Cetak / Ekspor</span>
                    </button>

                    {/* Share Link */}
                    <button
                      onClick={() => setIsShareOpen(true)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5"
                      title="Bagikan Tautan Publik (Read-Only)"
                    >
                      <Share2 className="w-3.5 h-3.5 text-slate-500" />
                      <span className="hidden sm:inline">Bagikan</span>
                    </button>

                    {/* Master Chat RAG Copilot */}
                    <button
                      onClick={() => setIsChatOpen(!isChatOpen)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Chat RAG Copilot</span>
                    </button>
                  </div>
                </div>

                {/* Global Filters Bar */}
                {activeDashboard && (
                  <GlobalFiltersBar
                    filters={activeDashboard.globalFilters}
                    onChange={handleGlobalFiltersChange}
                    totalWidgets={activeDashboard.widgets.length}
                  />
                )}
              </header>
            )}

            {/* ================= MAIN CONTENT ================= */}
            <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {/* Executive Presentation Floating Bar when Active */}
        {isPresentationMode && (
          <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-slate-900/90 text-white px-3 py-1.5 rounded-full shadow-2xl backdrop-blur-md border border-slate-700 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold">Mode Presentasi Eksekutif</span>
            <button
              onClick={() => setIsPresentationMode(false)}
              className="ml-2 px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-[11px]"
            >
              <Minimize2 className="w-3 h-3" />
              <span>Keluar</span>
            </button>
          </div>
        )}

        {/* Dashboard Title & Executive Governance Banner */}
        {activeDashboard && !isPresentationMode && (
          <div className="mb-6 bg-slate-900 text-white p-6 rounded-lg border border-slate-800 shadow-lg">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Left Identity */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold tracking-wider uppercase">
                  <span>{currentTenant?.name || 'PEMERINTAH DAERAH'}</span>
                  <span>•</span>
                  <span>{currentTenant?.city}</span>
                </div>

                <div className="flex items-center gap-3">
                  <LogoTile name={currentTenant?.name} id={currentTenant?.id} size="lg" />
                  <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                      {activeDashboard.title}
                    </h1>
                    {activeDashboard.description && (
                      <p className="text-xs text-slate-300 mt-0.5 max-w-2xl line-clamp-1">
                        {activeDashboard.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Quick Governance Accreditations */}
                <div className="pt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                    <Award className="w-3.5 h-3.5 text-emerald-400" />
                    Kinerja SEHAT · 86,4
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                    Diaudit BPKP & OJK
                  </span>
                </div>
              </div>

              {/* Right Action Tools */}
              <div className="flex flex-wrap items-center gap-2 self-start lg:self-center shrink-0">
                {hapusKonfirmasi ? (
                  <div className="flex items-center gap-1 bg-rose-950/60 border border-rose-800 p-1 rounded-lg">
                    <span className="px-2 text-[11px] text-rose-300">Hapus dashboard ini?</span>
                    <button
                      onClick={() => {
                        setHapusKonfirmasi(false);
                        handleDeleteDashboard(activeDashboard.id);
                      }}
                      className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-bold"
                    >
                      Hapus
                    </button>
                    <button
                      onClick={() => setHapusKonfirmasi(false)}
                      className="px-2 py-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-md text-[11px]"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setHapusKonfirmasi(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-rose-900/60 hover:border-rose-800 border border-slate-700 text-slate-300 hover:text-rose-200 text-xs font-semibold rounded-xl transition-colors shadow-xs"
                    title="Hapus dashboard ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                )}
                <button
                  onClick={() => setIsPresentationMode(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all shadow-xs"
                  title="Tampilan layar penuh untuk presentasi Direksi & Kepala Daerah"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
                  <span>Mode Presentasi</span>
                </button>
                <button
                  onClick={() => setIsCatalogOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-sky-400" />
                  <span>+ Tambah Widget</span>
                </button>
                <button
                  onClick={() => setIsChatOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Chat RAG Copilot</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar across bottom of banner */}
            <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Realisasi RKAP</span>
                <p className="text-base font-bold font-mono text-emerald-400 mt-0.5 tabular-nums">107,1%</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Risiko / NRW</span>
                <p className="text-base font-bold font-mono text-sky-400 mt-0.5 tabular-nums">22,4%</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Kolektibilitas</span>
                <p className="text-base font-bold font-mono text-slate-200 mt-0.5 tabular-nums">94,8%</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Verifikasi LRA</span>
                <p className="text-base font-bold font-mono text-emerald-400 mt-0.5 tabular-nums">100%</p>
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
      </>
      )}
      </div>

      {/* ================= MODALS & DRAWERS ================= */}

      {/* 1. Chat Panel with SSE Streaming */}
      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        sector={currentTenant?.sector || 'pdam'}
        tenantId={currentTenant?.id || 'tenant-pdam'}
        activeDashboardId={activeDashboard?.id}
        onDashboardUpdated={(newDash) => {
          setActiveDashboard(newDash);
          setDashboards((prev) => [
            newDash,
            ...prev.filter((d) => d.id !== newDash.id),
          ]);
        }}
        activeMode={activeRagMode}
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

      {/* 6. RAG Probe Diagnostic Runner Modal */}
      <RagProbeModal
        isOpen={isProbeOpen}
        onClose={() => setIsProbeOpen(false)}
        activeMode={activeRagMode}
        onToggleMode={handleToggleRagMode}
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

      {/* 9. Audit Log History Modal */}
      <AuditLogModal
        isOpen={isAuditLogOpen}
        onClose={() => setIsAuditLogOpen(false)}
        tenantId={currentTenant?.id || 'tenant-pdam'}
      />
    </div>
  );
}
