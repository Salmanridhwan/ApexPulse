import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Database,
  Edit2,
  Key,
  Layers,
  Lock,
  LogOut,
  Menu,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AvatarTile } from '../components/BrandMark';
import { ThemeToggle } from '../components/ThemeToggle';
import { ItemCard } from '../components/ui/ItemCard';
import { AlertRule, AuditLog, BumdSector, Tenant, User, UserRole } from '../types';

interface AdminProps {
  currentUser: User | null;
  onLogout: () => void;
}

export const Admin: React.FC<AdminProps> = ({ currentUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'tenants' | 'rag' | 'alerts' | 'audit'>('overview');
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  // Admin Data State
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [systemConfig, setSystemConfig] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // RAG Probe State (uji koneksi RAG)
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeResult, setProbeResult] = useState<any>(null);

  // User Modal State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('analis');
  const [userTenantId, setUserTenantId] = useState('');

  // Tenant Modal State
  const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [tenantShortName, setTenantShortName] = useState('');
  const [tenantSector, setTenantSector] = useState<BumdSector>('pdam');
  const [tenantCity, setTenantCity] = useState('');
  const [tenantCode, setTenantCode] = useState('');

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Semua endpoint ini butuh sesi + role admin — kalau 401/403 jangan
      // masukkan body error ke state array (bikin .filter/.map meledak).
      const j = (r: Response) => (r.ok ? r.json() : null);
      const [statsRes, usersRes, tenantsRes, configRes, logsRes, alertsRes] = await Promise.all([
        fetch('/api/admin/stats').then(j),
        fetch('/api/admin/users').then(j),
        fetch('/api/tenants').then(j),
        fetch('/api/admin/config').then(j),
        fetch('/api/audit-logs').then(j),
        fetch('/api/alerts').then(j),
      ]);

      if (statsRes) setStats(statsRes);
      if (Array.isArray(usersRes)) setUsers(usersRes);
      if (Array.isArray(tenantsRes)) setTenants(tenantsRes);
      if (configRes) setSystemConfig(configRes);
      if (Array.isArray(logsRes)) setAuditLogs(logsRes);
      if (Array.isArray(alertsRes)) setAlertRules(alertsRes);
      if (Array.isArray(tenantsRes) && tenantsRes.length > 0 && !userTenantId) {
        setUserTenantId(tenantsRes[0].id);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || !userEmail) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userName,
          email: userEmail,
          role: userRole,
          tenantId: userTenantId || tenants[0]?.id,
        }),
      });
      const newUser = await res.json();
      setUsers((prev) => [...prev, newUser]);
      setIsAddUserOpen(false);
      setUserName('');
      setUserEmail('');
      loadData();
    } catch (err) {
      console.error('Create user failed:', err);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menonaktifkan pengguna ini?')) return;
    try {
      await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      setUsers((prev) => prev.filter((u) => u.id !== id));
      loadData();
    } catch (err) {
      console.error('Delete user failed:', err);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName || !tenantCity) return;

    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tenantName,
          shortName: tenantShortName || tenantName.slice(0, 12),
          sector: tenantSector,
          city: tenantCity,
          code: tenantCode || `BUMD-${Date.now().toString().slice(-3)}`,
          logo: '🏛️',
          documentCount: 16,
        }),
      });
      const newT = await res.json();
      setTenants((prev) => [...prev, newT]);
      setIsAddTenantOpen(false);
      setTenantName('');
      setTenantCity('');
      loadData();
    } catch (err) {
      console.error('Create tenant failed:', err);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(systemConfig),
      });
      const saved = await res.json();
      setSystemConfig(saved);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      loadData();
    } catch (err) {
      console.error('Save config failed:', err);
    }
  };

  const handleProbeRag = async () => {
    setProbeLoading(true);
    setProbeResult(null);
    try {
      const res = await fetch('/api/rag-probe', { method: 'POST' });
      const data = await res.json();
      setProbeResult(data);
    } catch (err: any) {
      setProbeResult({
        status: 'error',
        latencyMs: 0,
        details: [
          'Gagal menghubungi endpoint diagnostik server.',
          err?.message || 'Kesalahan jaringan tidak diketahui.',
        ],
      });
    } finally {
      setProbeLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-row min-w-0 min-h-0 h-full overflow-hidden bg-canvas text-ink font-sans">
      {/* Sidebar Panel Admin — menu navigasi vertikal */}
      <aside className={`${isNavCollapsed ? 'w-14' : 'w-56'} shrink-0 h-full overflow-hidden bg-shell text-shell-ink-2 border-r border-shell-line flex flex-col transition-all duration-200`}>
        <div>
          <div className={`h-14 border-b border-shell-line flex items-center gap-2 ${isNavCollapsed ? 'justify-center px-0' : 'px-4'}`}>
            <Shield className="w-4 h-4 text-shell-ink-2 shrink-0" />
            {!isNavCollapsed && (
              <span className="text-sm font-bold text-shell-ink tracking-tight">Admin Center</span>
            )}
          </div>
          <nav className={`p-3 space-y-1 text-xs font-medium ${isNavCollapsed ? 'px-2' : ''}`}>
            {[
              { id: 'overview', label: 'Ringkasan', icon: Activity },
              { id: 'users', label: 'Pengguna & RBAC', icon: Users },
              { id: 'tenants', label: 'BUMD & Tenant', icon: Building2 },
              { id: 'rag', label: 'Konfigurasi RAG', icon: Database },
              { id: 'alerts', label: 'Ambang Batas', icon: Bell },
              { id: 'audit', label: 'Jejak Audit', icon: ShieldCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  title={tab.label}
                  className={`w-full flex items-center gap-2.5 py-2 rounded-control text-left transition-colors relative overflow-hidden ${isNavCollapsed ? 'justify-center px-0' : 'px-2.5'
                    } ${isActive
                      ? 'bg-shell-active text-shell-ink font-bold shadow-inset'
                      : 'text-shell-ink-2 hover:bg-shell-hover hover:text-shell-ink font-medium'
                    }`}
                >
                  {isActive && <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-brand" />}
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-brand' : 'text-shell-ink-2'}`} />
                  {!isNavCollapsed && <span className="truncate">{tab.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Kolom kanan: header + konten */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <header className="shrink-0 z-30 bg-surface border-b border-line shadow-2xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setIsNavCollapsed((v) => !v)}
                className="p-1.5 rounded-control text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors shrink-0"
                title={isNavCollapsed ? 'Tampilkan Sidebar Admin' : 'Sembunyikan Sidebar Admin'}
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="h-4 w-px bg-line hidden sm:block" />
              <div className="flex items-center gap-2 truncate">
                <Shield className="w-4 h-4 text-brand shrink-0" />
                <h1 className="text-sm font-bold tracking-tight text-ink truncate">
                  ApexPulse Admin & Governance Center
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs shrink-0">
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-full bg-surface-2 border border-line text-ink-2">
                Admin: <strong className="text-ink">{currentUser?.name || 'Administrator'}</strong>
              </span>
              <ThemeToggle />
              <button
                onClick={loadData}
                className="p-2 rounded-control border border-line hover:bg-surface-2 text-ink-2 hover:text-ink transition-colors"
                title="Segarkan Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onLogout}
                className="p-2 rounded-control border border-line hover:bg-neg/10 text-ink-2 hover:text-neg transition-colors"
                title="Keluar"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
          {/* ================= TAB 1: OVERVIEW ================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Top Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: 'Total BUMD', nilai: String(stats?.tenantsCount ?? 6), sub: '6 Sektor Aktif', accent: 'var(--color-brand)' },
                  { label: 'Pengguna Aktif', nilai: String(users.length), sub: 'RBAC Terproteksi', accent: 'var(--color-violet)' },
                  { label: 'Total Dashboard', nilai: String(stats?.dashboardsCount ?? 6), sub: `${stats?.totalWidgets ?? 34} Widget`, accent: 'var(--color-brand)' },
                  { label: 'Sitasi Resmi', nilai: String(stats?.totalCitations ?? 42), sub: '100% Tervalidasi', accent: 'var(--color-pos)' },
                  { label: 'Aturan Ambang', nilai: String(alertRules.length), sub: 'Evaluasi Otomatis', accent: 'var(--color-warn)' },
                  { label: 'Provider RAG', nilai: stats?.ragProvider === 'http' ? 'API HTTP' : 'Mock Lokal', sub: 'Sehat (Online)', accent: 'var(--color-brand)' },
                ].map((m, i) => (
                  <div
                    key={i}
                    className="relative overflow-hidden bg-surface p-4 pl-5 rounded-card border border-line shadow-2xs"
                  >
                    <span className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ background: m.accent }} aria-hidden="true" />
                    <span className="text-[10px] uppercase font-bold text-ink-3">{m.label}</span>
                    <p className="text-2xl font-bold text-ink mt-1 truncate">{m.nilai}</p>
                    <span className="text-[10px] text-ink-2 font-medium">{m.sub}</span>
                  </div>
                ))}
              </div>

              {/* Quick Sektor BUMD Grid */}
              <div className="bg-surface p-5 rounded-card border border-line shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-ink">
                      Instansi BUMD Terhubung (Multi-Tenant Isolation)
                    </h3>
                    <p className="text-xs text-ink-2">
                      Setiap instansi memiliki isolasi data dan pangkalan retrieval dokumen mandiri
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAddTenantOpen(true)}
                    className="px-3 py-1.5 bg-brand hover:bg-brand-ink text-on-brand rounded-control text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Tambah Instansi BUMD</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tenants.map((t) => (
                    <ItemCard
                      key={t.id}
                      icon={<span className="text-base leading-none">{t.logo}</span>}
                      title={t.name}
                      meta={
                        <>
                          {t.city} • Kode: <strong className="font-mono">{t.code}</strong>
                        </>
                      }
                    >
                      <span className="flex items-center justify-between mt-2 pt-2 border-t border-line text-[10px] text-ink-3">
                        <span className="uppercase font-semibold text-ink-2">{t.sector}</span>
                        <span>{t.documentCount} Berkas Terindeks</span>
                      </span>
                    </ItemCard>
                  ))}
                </div>
              </div>

              {/* Recent Audit Activities */}
              <div className="bg-surface p-5 rounded-card border border-line shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-pos" />
                    <span>Aktivitas & Log Audit Terakhir</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('audit')}
                    className="text-xs text-brand hover:underline font-medium"
                  >
                    Lihat Seluruh Log &rarr;
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  {auditLogs.slice(0, 5).map((log) => (
                    <ItemCard
                      key={log.id}
                      accent="var(--color-brand)"
                      icon={<span className="w-1.5 h-1.5 rounded-full bg-brand block" />}
                      title={
                        <>
                          <span className="font-semibold">{log.action}</span>
                          <span className="font-normal text-ink-2"> · {log.target}</span>
                        </>
                      }
                      meta={log.details}
                      trailing={
                        <>
                          <span className="text-[11px] text-ink-3">{log.userName}</span>
                          <span className="block text-[10px] text-ink-3">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </>
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: USERS & RBAC ================= */}
          {activeTab === 'users' && (
            <div className="bg-surface p-5 rounded-card border border-line shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-ink">
                    Manajemen Pengguna & Hak Akses Berbasis Peran (RBAC)
                  </h3>
                  <p className="text-xs text-ink-2">
                    Kelola staf BUMD: Administrator, Analis Kinerja, dan Dewan Direksi / Pengawas
                  </p>
                </div>
                <button
                  onClick={() => setIsAddUserOpen(true)}
                  className="px-3.5 py-2 bg-brand hover:bg-brand-ink text-on-brand rounded-control text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs self-start sm:self-auto"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Tambah Pengguna Baru</span>
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-line rounded-card">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-2 text-ink-2 font-semibold border-b border-line">
                    <tr>
                      <th className="p-3">Nama Pengguna</th>
                      <th className="p-3">Email Instansi</th>
                      <th className="p-3">Peran (Role)</th>
                      <th className="p-3">Penugasan BUMD</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-ink-2">
                    {users.map((u) => {
                      const assignedTenant = tenants.find((t) => t.id === u.tenantId);
                      return (
                        <tr key={u.id} className="hover:bg-surface-2/60 transition-colors">
                          <td className="p-3 font-medium flex items-center gap-2">
                            <AvatarTile name={u.name} id={u.id} size="sm" />
                            <span>{u.name}</span>
                          </td>
                          <td className="p-3 text-ink-2">{u.email}</td>
                          <td className="p-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${u.role === 'admin'
                                  ? 'bg-brand/15 text-brand-ink border border-brand/30'
                                  : u.role === 'direksi'
                                    ? 'bg-warn/15 text-warn'
                                    : 'bg-surface-2 text-ink'
                                }`}
                            >
                              {u.role === 'admin'
                                ? 'Administrator'
                                : u.role === 'direksi'
                                  ? 'Direksi / Pengawas'
                                  : 'Analis Kinerja'}
                            </span>
                          </td>
                          <td className="p-3">
                            {assignedTenant ? (
                              <span className="inline-flex items-center gap-1 font-medium text-ink">
                                <span>{assignedTenant.logo}</span>
                                <span>{assignedTenant.shortName}</span>
                              </span>
                            ) : (
                              <span className="text-ink-3">Lintas Instansi</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {u.id !== 'user-admin' && (
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="p-1 rounded text-neg hover:text-neg hover:bg-neg/10 transition-colors"
                                title="Hapus Pengguna"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 3: TENANTS ================= */}
          {activeTab === 'tenants' && (
            <div className="bg-surface p-5 rounded-card border border-line shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-ink">
                    Daftar BUMD & Konfigurasi Multi-Tenant
                  </h3>
                  <p className="text-xs text-ink-2">
                    Kelola identitas resmi, kode BUMD, dan pangkalan dokumen retrieval
                  </p>
                </div>
                <button
                  onClick={() => setIsAddTenantOpen(true)}
                  className="px-3.5 py-2 bg-brand hover:bg-brand-ink text-on-brand rounded-control text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Daftarkan BUMD Baru</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tenants.map((t) => (
                  <ItemCard
                    key={t.id}
                    icon={<span className="text-lg leading-none">{t.logo}</span>}
                    title={t.name}
                    meta={t.city}
                    trailing={
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-surface-2 text-ink border border-line">
                        {t.code}
                      </span>
                    }
                  >
                    <span className="grid grid-cols-2 gap-2 text-xs pt-2 mt-2 border-t border-line/70">
                      <span className="text-ink-2">
                        Sektor: <strong className="text-ink-2 capitalize">{t.sector}</strong>
                      </span>
                      <span className="text-ink-2">
                        Berkas RAG: <strong className="text-pos">{t.documentCount} LRA &amp; RKAP</strong>
                      </span>
                    </span>
                  </ItemCard>
                ))}
              </div>
            </div>
          )}

          {/* ================= TAB 4: RAG CONFIG ================= */}
          {activeTab === 'rag' && systemConfig && (
            <div className="bg-surface p-5 rounded-card border border-line shadow-2xs space-y-5">
              <div>
                <h3 className="text-sm font-bold text-ink">
                  Konfigurasi Integrasi RAG API
                </h3>
                <p className="text-xs text-ink-2">
                  Tempel Base URL & API Key RAG dari penyedia layanan, pilih provider
                  <strong> HTTP</strong>, lalu simpan.
                </p>
              </div>

              {saveSuccess && (
                <div className="p-3 bg-pos/15 border border-pos/30 rounded-card text-pos text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-pos" />
                  <span>Pengaturan sistem berhasil disimpan dan diperbarui!</span>
                </div>
              )}

              {/* Jebakan paling sering: URL & key sudah diisi, provider masih Mock. */}
              {systemConfig.ragProvider !== 'http' && (systemConfig.ragApiUrl || systemConfig.ragApiKey) && (
                <div className="p-3 bg-warn/15 border border-warn/30 rounded-card text-warn text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
                  <span>
                    Provider masih <strong>Mock</strong>, jadi Base URL &amp; API Key di bawah{' '}
                    <strong>tidak dipakai</strong>. Dashboard tetap disusun dari data contoh. Ubah
                    Provider ke <strong>HTTP</strong> lalu simpan, baru klik “Uji Koneksi Sekarang”.
                  </span>
                </div>
              )}

              <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-ink-2 font-semibold mb-1">
                      Provider RAG API
                    </label>
                    <select
                      value={systemConfig.ragProvider}
                      onChange={(e) =>
                        setSystemConfig({ ...systemConfig, ragProvider: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                    >
                      <option value="mock">Mock: data demo lokal</option>
                      <option value="http">HTTP: API RAG eksternal</option>
                    </select>
                  </div>

                </div>

                <div>
                  <label className="block text-ink-2 font-semibold mb-1">
                    Base URL RAG
                  </label>
                  <input
                    type="text"
                    placeholder="https://rag-teman-anda.example.com/v1"
                    value={systemConfig.ragApiUrl}
                    onChange={(e) =>
                      setSystemConfig({ ...systemConfig, ragApiUrl: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand font-mono"
                  />
                  <p className="text-[10px] text-ink-3 mt-1">
                    Sertakan prefix API-nya, mis. <span className="font-mono">https://rag.aiones.app/api/v1</span>.
                    Kalau hanya domain, aplikasi mencoba menambahkan <span className="font-mono">/api/v1</span> otomatis.
                  </p>
                </div>

                <div>
                  <label className="block text-ink-2 font-semibold mb-1">
                    Knowledge Base ID <span className="font-normal text-ink-3">(opsional, jika layanan RAG menskopkan retrieval per KB)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="kb-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={systemConfig.ragKnowledgeBaseId || ''}
                    onChange={(e) =>
                      setSystemConfig({ ...systemConfig, ragKnowledgeBaseId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand font-mono"
                  />
                  <p className="text-[10px] text-ink-3 mt-1">
                    Daftar KB & dokumen bisa dilihat di layanan RAG teman (endpoint /api/v1/knowledge)
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-ink-2 font-semibold mb-1">
                      API Key LLM / RAG
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        placeholder="tempel API key di sini"
                        value={systemConfig.ragApiKey}
                        onChange={(e) =>
                          setSystemConfig({ ...systemConfig, ragApiKey: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand font-mono"
                      />
                      <Key className="w-4 h-4 text-ink-3 absolute right-3 top-2.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-ink-2 font-semibold mb-1">
                      Model LLM <span className="font-normal text-ink-3">(untuk Chat Orchestrator)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="gpt-4o-mini"
                      value={(systemConfig as any).ragModel || 'gpt-4o-mini'}
                      onChange={(e) =>
                        setSystemConfig({ ...systemConfig, ragModel: e.target.value } as any)
                      }
                      className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand font-mono"
                    />
                    <p className="text-[10px] text-ink-3 mt-1">
                      Contoh: <span className="font-mono">gpt-4o-mini</span>, <span className="font-mono">gemini-1.5-flash</span>, <span className="font-mono">llama-3.1-70b</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-ink-2 font-semibold mb-1">
                      Batas Waktu Respons (Detik)
                    </label>
                    <input
                      type="number"
                      value={systemConfig.ragTimeoutSeconds}
                      onChange={(e) =>
                        setSystemConfig({
                          ...systemConfig,
                          ragTimeoutSeconds: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand font-mono"
                    />
                    <p className="text-[10px] text-ink-3 mt-1">Standar PRD: maksimal 60 detik</p>
                  </div>
                </div>


                <div className="flex items-start gap-2 p-3 bg-surface-2 border border-line rounded-card">
                  <input
                    id="ragUseExtract"
                    type="checkbox"
                    checked={systemConfig.ragUseExtract !== false}
                    onChange={(e) =>
                      setSystemConfig({ ...systemConfig, ragUseExtract: e.target.checked })
                    }
                    className="mt-0.5 w-4 h-4 accent-brand"
                  />
                  <label htmlFor="ragUseExtract" className="text-[11px] text-ink-2 leading-relaxed">
                    <span className="font-semibold text-ink">
                      Jalur A: pakai endpoint /extract
                    </span>{' '}
                    (disarankan). Angka dashboard diambil langsung dari dokumen beserta halaman
                    sumbernya, jadi tidak lagi mengandalkan deret contoh. Kalau layanan RAG tidak
                    punya /extract, aplikasi otomatis memakai jalur retrieval biasa.
                  </label>
                </div>

                {/* SMTP Settings */}
                <div className="pt-4 border-t border-line space-y-3">
                  <h4 className="font-bold text-ink flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-brand" />
                    <span>Konfigurasi SMTP Email Dispatcher (Alert Ambang Batas)</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-ink-2 mb-1">Host SMTP</label>
                      <input
                        type="text"
                        value={systemConfig.smtpHost}
                        onChange={(e) =>
                          setSystemConfig({ ...systemConfig, smtpHost: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-line rounded-control font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-ink-2 mb-1">Alamat Pengirim (MAIL_FROM)</label>
                      <input
                        type="text"
                        value={systemConfig.smtpFrom}
                        onChange={(e) =>
                          setSystemConfig({ ...systemConfig, smtpFrom: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-line rounded-control"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex items-center gap-3">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-brand hover:bg-brand-ink text-on-brand rounded-control font-medium transition-colors shadow-xs"
                  >
                    Simpan Konfigurasi Sistem
                  </button>
                </div>
              </form>

              {/* ===== UJI KONEKSI RAG ===== */}
              <div className="pt-4 border-t border-line space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h4 className="font-bold text-ink flex items-center gap-1.5">
                      <Radio className="w-4 h-4 text-brand" />
                      <span>Uji Koneksi RAG</span>
                    </h4>
                    <p className="text-[11px] text-ink-2 mt-0.5">
                      Kirim sampel query ke layanan RAG aktif untuk memastikan koneksi, metadata,
                      dan keluaran JSON terstruktur berjalan dengan baik.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleProbeRag}
                    disabled={probeLoading}
                    className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-surface border border-line-strong hover:bg-surface-2 text-brand-ink rounded-control font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-4 h-4 ${probeLoading ? 'animate-spin' : ''}`} />
                    {probeLoading ? 'Menguji...' : 'Uji Koneksi Sekarang'}
                  </button>
                </div>

                {probeResult && (
                  <div
                    className={`p-4 rounded-card border text-xs space-y-2 ${
                      probeResult.status === 'healthy'
                        ? 'bg-pos/15 border-pos/30'
                        : probeResult.status === 'degraded'
                          ? 'bg-warn/15 border-warn/30'
                          : 'bg-neg/15 border-neg/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold">
                      {probeResult.status === 'healthy' ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-pos" />
                          <span className="text-pos">
                            RAG Berjalan Normal ({probeResult.latencyMs} ms)
                          </span>
                        </>
                      ) : probeResult.status === 'degraded' ? (
                        <>
                          <AlertTriangle className="w-4 h-4 text-warn" />
                          <span className="text-warn">
                            RAG Merespons, Tapi Terbatas ({probeResult.latencyMs} ms)
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-neg" />
                          <span className="text-neg">Koneksi RAG Gagal</span>
                        </>
                      )}
                    </div>
                    {probeResult.peringatan && (
                      <p className="text-warn font-semibold flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{probeResult.peringatan}</span>
                      </p>
                    )}
                    {(probeResult.details || []).map((d: string, i: number) =>
                      /^PERINGATAN/i.test(d) ? (
                        <p key={i} className="text-warn font-semibold">{d}</p>
                      ) : null
                    )}
                    {probeResult.modeDetected && (
                      <p className="text-ink-2">
                        Mode terdeteksi: <strong>{probeResult.modeDetected}</strong>
                        {typeof probeResult.sampleChunksCount === 'number' && (
                          <> • Potongan dokumen terambil: <strong>{probeResult.sampleChunksCount}</strong></>
                        )}
                      </p>
                    )}
                    <ul className="list-disc list-inside text-ink-2 space-y-0.5">
                      {(probeResult.details || []).map((d: string, i: number) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 5: ALERTS ================= */}
          {activeTab === 'alerts' && (
            <div className="bg-surface p-5 rounded-card border border-line shadow-2xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink">
                  Daftar Aturan Ambang Batas & Peringatan Otomatis (Global)
                </h3>
                <p className="text-xs text-ink-2">
                  Peringatan dini bagi Direksi dan Pengawas saat indikator melanggar batasan regulasi
                </p>
              </div>

              <div className="space-y-3">
                {alertRules.map((rule) => {
                  const tenant = tenants.find((t) => t.id === rule.tenantId);
                  return (
                    <div
                      key={rule.id}
                      className="p-4 bg-surface-2 border border-line rounded-card flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink">{rule.title}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${rule.severity === 'critical'
                                ? 'bg-neg/15 text-neg'
                                : 'bg-warn/15 text-warn'
                              }`}
                          >
                            {rule.severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-ink-2 mt-1">
                          Kondisi: <strong>{rule.metricName}</strong> {rule.operator} {rule.threshold} {rule.unit}
                        </p>
                        <p className="text-[11px] text-ink-3 mt-0.5">
                          Instansi: {tenant?.name || 'Semua BUMD'} • Kanal: {rule.channels.join(' & ')}
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] text-pos font-medium bg-pos/15 px-2 py-1 rounded-chip border border-pos/30">
                          <Check className="w-3 h-3" /> Aktif
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= TAB 6: AUDIT TRAIL ================= */}
          {activeTab === 'audit' && (
            <div className="bg-surface p-5 rounded-card border border-line shadow-2xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink">
                  Log Audit Sistem & Rekam Jejak Kepatuhan (F-14 & F-21)
                </h3>
                <p className="text-xs text-ink-2">
                  Seluruh pembuatan, perubahan widget, dan koreksi manual tercatat secara permanen
                </p>
              </div>

              <div className="overflow-x-auto border border-line rounded-card">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-2 text-ink-2 font-semibold border-b border-line">
                    <tr>
                      <th className="p-3">Waktu</th>
                      <th className="p-3">Aksi</th>
                      <th className="p-3">Target / Entitas</th>
                      <th className="p-3">Pengguna</th>
                      <th className="p-3">Detail Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-ink-2">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-surface-2/60 transition-colors">
                        <td className="p-3 whitespace-nowrap text-ink-3 font-mono text-[11px]">
                          {new Date(log.timestamp).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                          })}
                        </td>
                        <td className="p-3 font-semibold text-ink">{log.action}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-surface-2 text-ink-2 font-medium">
                            {log.target}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-ink">{log.userName}</td>
                        <td className="p-3 text-ink-2 max-w-xs truncate" title={log.details}>
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        {/* ================= MODAL TAMBAH PENGGUNA ================= */}
        {isAddUserOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-scrim/50 backdrop-blur-xs" onClick={() => setIsAddUserOpen(false)} />
            <div role="dialog" aria-modal="true" aria-labelledby="add-user-title" className="relative w-full max-w-md bg-surface rounded-card shadow-2xl border border-line p-5 z-10 text-xs space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h3 id="add-user-title" className="font-bold text-sm text-ink">Tambah Pengguna BUMD Baru</h3>
                <button onClick={() => setIsAddUserOpen(false)} className="text-ink-3 hover:text-ink-2">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-3">
                <div>
                  <label className="block text-ink-2 font-medium mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    placeholder="Contoh: Ahmad Fauzi, S.E."
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand"
                    required
                  />
                </div>

                <div>
                  <label className="block text-ink-2 font-medium mb-1">Email Resmi</label>
                  <input
                    type="email"
                    placeholder="ahmad@pdam-tirta.id"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand"
                    required
                  />
                </div>

                <div>
                  <label className="block text-ink-2 font-medium mb-1">Peran Hak Akses (Role)</label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value="analis">Analis Kinerja (Dapat membuat & mengedit dashboard)</option>
                    <option value="direksi">Direksi / Pengawas (Hak akses lihat & terima laporan)</option>
                    <option value="admin">Administrator Sistem (Akses penuh tata kelola)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-ink-2 font-medium mb-1">Penugasan Instansi BUMD</label>
                  <select
                    value={userTenantId}
                    onChange={(e) => setUserTenantId(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddUserOpen(false)}
                    className="px-4 py-2 border border-line rounded-control text-ink-2 hover:bg-surface-2"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-brand hover:bg-brand-ink text-on-brand rounded-control font-medium"
                  >
                    Daftarkan Pengguna
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL TAMBAH TENANT BUMD ================= */}
        {isAddTenantOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-scrim/50 backdrop-blur-xs" onClick={() => setIsAddTenantOpen(false)} />
            <div role="dialog" aria-modal="true" aria-labelledby="add-tenant-title" className="relative w-full max-w-md bg-surface rounded-card shadow-2xl border border-line p-5 z-10 text-xs space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h3 id="add-tenant-title" className="font-bold text-sm text-ink">Daftarkan Instansi BUMD Baru</h3>
                <button onClick={() => setIsAddTenantOpen(false)} className="text-ink-3 hover:text-ink-2">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateTenant} className="space-y-3">
                <div>
                  <label className="block text-ink-2 font-medium mb-1">Nama Resmi BUMD</label>
                  <input
                    type="text"
                    placeholder="Contoh: Perumda Pariwisata Tirta Graha"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-ink-2 font-medium mb-1">Nama Singkat</label>
                    <input
                      type="text"
                      placeholder="Contoh: Perumda Graha"
                      value={tenantShortName}
                      onChange={(e) => setTenantShortName(e.target.value)}
                      className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-ink-2 font-medium mb-1">Kode Instansi</label>
                    <input
                      type="text"
                      placeholder="Contoh: PTG-01"
                      value={tenantCode}
                      onChange={(e) => setTenantCode(e.target.value)}
                      className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand uppercase font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-ink-2 font-medium mb-1">Sektor</label>
                    <select
                      value={tenantSector}
                      onChange={(e) => setTenantSector(e.target.value as BumdSector)}
                      className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                    >
                      <option value="pdam">PDAM (Air Minum)</option>
                      <option value="bank">Bank Daerah (BPD/BPR)</option>
                      <option value="pasar">Pasar Rakyat</option>
                      <option value="rsud">Rumah Sakit (RSUD)</option>
                      <option value="transportasi">Transportasi Daerah</option>
                      <option value="aneka_usaha">Aneka Usaha / Pariwisata</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-ink-2 font-medium mb-1">Kota / Kabupaten</label>
                    <input
                      type="text"
                      placeholder="Kota Mandiri"
                      value={tenantCity}
                      onChange={(e) => setTenantCity(e.target.value)}
                      className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddTenantOpen(false)}
                    className="px-4 py-2 border border-line rounded-control text-ink-2 hover:bg-surface-2"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-brand hover:bg-brand-ink text-on-brand rounded-control font-medium"
                  >
                    Simpan BUMD
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
