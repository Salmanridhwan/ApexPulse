import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
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
import { AlertRule, AuditLog, BumdSector, Tenant, User, UserRole } from '../types';

interface AdminProps {
  currentUser: User | null;
  onBackToWorkspace: () => void;
  onToggleSidebar?: () => void;
}

export const Admin: React.FC<AdminProps> = ({ currentUser, onBackToWorkspace, onToggleSidebar }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'tenants' | 'rag' | 'alerts' | 'audit'>('overview');

  // Admin Data State
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [systemConfig, setSystemConfig] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-100/70 text-slate-800 font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Buka / Tutup Sidebar"
              >
                <Menu className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onBackToWorkspace}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Ke Workspace</span>
            </button>
            <div className="h-4 w-px bg-slate-700 hidden sm:block" />
            <div className="flex items-center gap-2 truncate">
              <Shield className="w-4 h-4 text-sky-400 shrink-0" />
              <h1 className="text-sm font-bold tracking-tight text-white truncate">
                ApexPulse Admin & Governance Center
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs shrink-0">
            <span className="hidden sm:inline-block px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
              Admin: <strong>{currentUser?.name || 'Administrator'}</strong>
            </span>
            <button
              onClick={loadData}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Segarkan Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-6 overflow-x-auto no-scrollbar border-t border-slate-800/80 text-xs font-medium">
          {[
            { id: 'overview', label: 'Ringkasan Eksekutif', icon: Activity },
            { id: 'users', label: 'Manajemen Pengguna & RBAC', icon: Users },
            { id: 'tenants', label: 'Daftar BUMD & Multi-Tenant', icon: Building2 },
            { id: 'rag', label: 'Konfigurasi RAG & Probe', icon: Database },
            { id: 'alerts', label: 'Aturan Ambang Batas', icon: Bell },
            { id: 'audit', label: 'Jejak Audit & Kepatuhan', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-sky-400 text-sky-400 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* ================= TAB 1: OVERVIEW ================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total BUMD</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stats?.tenantsCount ?? 6}</p>
                <span className="text-[10px] text-emerald-600 font-medium">6 Sektor Aktif</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400">Pengguna Aktif</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{users.length}</p>
                <span className="text-[10px] text-sky-600 font-medium">RBAC Terproteksi</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Dashboard</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stats?.dashboardsCount ?? 6}</p>
                <span className="text-[10px] text-slate-500 font-medium">{stats?.totalWidgets ?? 34} Widget</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400">Sitasi Resmi</span>
                <p className="text-2xl font-bold text-emerald-700 mt-1">{stats?.totalCitations ?? 42}</p>
                <span className="text-[10px] text-emerald-600 font-medium">100% Tervalidasi</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400">Aturan Ambang</span>
                <p className="text-2xl font-bold text-amber-700 mt-1">{alertRules.length}</p>
                <span className="text-[10px] text-amber-600 font-medium">Evaluasi Otomatis</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400">Status RAG</span>
                <p className="text-base font-bold text-sky-700 mt-2 truncate">
                  {stats?.activeRagMode === 'structured' ? 'Jalur A' : 'Jalur B'}
                </p>
                <span className="text-[10px] text-emerald-600 font-medium">Sehat (Online)</span>
              </div>
            </div>

            {/* Quick Sektor BUMD Grid */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Instansi BUMD Terhubung (Multi-Tenant Isolation)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Setiap instansi memiliki isolasi data dan pangkalan retrieval dokumen mandiri
                  </p>
                </div>
                <button
                  onClick={() => setIsAddTenantOpen(true)}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Tambah Instansi BUMD</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {tenants.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 border border-slate-200 rounded-xl hover:border-sky-300 transition-all bg-slate-50/50 flex items-start gap-3"
                  >
                    <span className="text-2xl p-2 bg-white rounded-lg border border-slate-200 shrink-0">
                      {t.logo}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{t.name}</h4>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {t.city} • Kode: <strong className="font-mono text-slate-700">{t.code}</strong>
                      </p>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60 text-[10px] text-slate-400">
                        <span className="uppercase font-semibold text-slate-600">{t.sector}</span>
                        <span>{t.documentCount} Berkas Terindeks</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Audit Activities */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Aktivitas & Log Audit Terakhir</span>
                </h3>
                <button
                  onClick={() => setActiveTab('audit')}
                  className="text-xs text-sky-600 hover:underline font-medium"
                >
                  Lihat Seluruh Log &rarr;
                </button>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {auditLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-800">{log.action}: </span>
                        <span className="text-slate-600">{log.target}</span>
                        <span className="text-slate-400 block text-[11px] mt-0.5">{log.details}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 text-[11px] text-slate-400">
                      <span>{log.userName}</span>
                      <span className="block text-[10px]">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: USERS & RBAC ================= */}
        {activeTab === 'users' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Manajemen Pengguna & Hak Akses Berbasis Peran (RBAC)
                </h3>
                <p className="text-xs text-slate-500">
                  Kelola staf BUMD: Administrator, Analis Kinerja, dan Dewan Direksi / Pengawas
                </p>
              </div>
              <button
                onClick={() => setIsAddUserOpen(true)}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs self-start sm:self-auto"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Tambah Pengguna Baru</span>
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Nama Pengguna</th>
                    <th className="p-3">Email Instansi</th>
                    <th className="p-3">Peran (Role)</th>
                    <th className="p-3">Penugasan BUMD</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {users.map((u) => {
                    const assignedTenant = tenants.find((t) => t.id === u.tenantId);
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 font-medium flex items-center gap-2">
                          <AvatarTile name={u.name} id={u.id} size="sm" />
                          <span>{u.name}</span>
                        </td>
                        <td className="p-3 text-slate-500">{u.email}</td>
                        <td className="p-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              u.role === 'admin'
                                ? 'bg-slate-800 text-white'
                                : u.role === 'direksi'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-sky-100 text-sky-800'
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
                            <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                              <span>{assignedTenant.logo}</span>
                              <span>{assignedTenant.shortName}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">Lintas Instansi</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {u.id !== 'user-admin' && (
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
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
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Daftar BUMD & Konfigurasi Multi-Tenant
                </h3>
                <p className="text-xs text-slate-500">
                  Kelola identitas resmi, kode BUMD, dan pangkalan dokumen retrieval
                </p>
              </div>
              <button
                onClick={() => setIsAddTenantOpen(true)}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Daftarkan BUMD Baru</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tenants.map((t) => (
                <div
                  key={t.id}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-3xl p-1.5 bg-white rounded-lg border border-slate-200">
                        {t.logo}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{t.name}</h4>
                        <p className="text-xs text-slate-500">{t.city}</p>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                      {t.code}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/70">
                    <div className="text-slate-500">
                      Sektor: <strong className="text-slate-700 capitalize">{t.sector}</strong>
                    </div>
                    <div className="text-slate-500">
                      Berkas RAG: <strong className="text-emerald-700">{t.documentCount} LRA & RKAP</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 4: RAG CONFIG ================= */}
        {activeTab === 'rag' && systemConfig && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Konfigurasi Integrasi RAG API
              </h3>
              <p className="text-xs text-slate-500">
                Tempel Base URL & API Key RAG dari penyedia layanan, pilih provider
                <strong> HTTP</strong>, lalu simpan. Uji koneksi lewat sidebar → Diagnostik RAG Probe.
              </p>
            </div>

            {saveSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Pengaturan sistem berhasil disimpan dan diperbarui!</span>
              </div>
            )}

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Provider RAG API
                  </label>
                  <select
                    value={systemConfig.ragProvider}
                    onChange={(e) =>
                      setSystemConfig({ ...systemConfig, ragProvider: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="mock">Mock — data demo lokal</option>
                    <option value="http">HTTP — API RAG eksternal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Mode Dual Jalur Default
                  </label>
                  <select
                    value={systemConfig.defaultRagMode}
                    onChange={(e) =>
                      setSystemConfig({ ...systemConfig, defaultRagMode: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="structured">Jalur A (LLM JSON Terstruktur)</option>
                    <option value="prose">Jalur B (Agregasi Metadata Murni - Tanpa AI)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Base URL RAG
                </label>
                <input
                  type="text"
                  placeholder="https://rag-teman-anda.example.com/v1"
                  value={systemConfig.ragApiUrl}
                  onChange={(e) =>
                    setSystemConfig({ ...systemConfig, ragApiUrl: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    API Key RAG
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="tempel API key di sini"
                      value={systemConfig.ragApiKey}
                      onChange={(e) =>
                        setSystemConfig({ ...systemConfig, ragApiKey: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                    />
                    <Key className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Batas Waktu Respons RAG (Detik)
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Standar PRD: maksimal 60 detik</p>
                </div>
              </div>

              {/* SMTP Settings */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-sky-600" />
                  <span>Konfigurasi SMTP Email Dispatcher (Alert Ambang Batas)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Host SMTP</label>
                    <input
                      type="text"
                      value={systemConfig.smtpHost}
                      onChange={(e) =>
                        setSystemConfig({ ...systemConfig, smtpHost: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Alamat Pengirim (MAIL_FROM)</label>
                    <input
                      type="text"
                      value={systemConfig.smtpFrom}
                      onChange={(e) =>
                        setSystemConfig({ ...systemConfig, smtpFrom: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors shadow-xs"
                >
                  Simpan Konfigurasi Sistem
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= TAB 5: ALERTS ================= */}
        {activeTab === 'alerts' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Daftar Aturan Ambang Batas & Peringatan Otomatis (Global)
              </h3>
              <p className="text-xs text-slate-500">
                Peringatan dini bagi Direksi dan Pengawas saat indikator melanggar batasan regulasi
              </p>
            </div>

            <div className="space-y-3">
              {alertRules.map((rule) => {
                const tenant = tenants.find((t) => t.id === rule.tenantId);
                return (
                  <div
                    key={rule.id}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{rule.title}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            rule.severity === 'critical'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {rule.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1">
                        Kondisi: <strong>{rule.metricName}</strong> {rule.operator} {rule.threshold} {rule.unit}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Instansi: {tenant?.name || 'Semua BUMD'} • Kanal: {rule.channels.join(' & ')}
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
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
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Log Audit Sistem & Rekam Jejak Kepatuhan (F-14 & F-21)
              </h3>
              <p className="text-xs text-slate-500">
                Seluruh pembuatan, perubahan widget, dan koreksi manual tercatat secara permanen
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Aksi</th>
                    <th className="p-3">Target / Entitas</th>
                    <th className="p-3">Pengguna</th>
                    <th className="p-3">Detail Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                        {new Date(log.timestamp).toLocaleString('id-ID', {
                          dateStyle: 'short',
                          timeStyle: 'medium',
                        })}
                      </td>
                      <td className="p-3 font-semibold text-slate-900">{log.action}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                          {log.target}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-800">{log.userName}</td>
                      <td className="p-3 text-slate-600 max-w-xs truncate" title={log.details}>
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
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setIsAddUserOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 z-10 text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-800">Tambah Pengguna BUMD Baru</h3>
              <button onClick={() => setIsAddUserOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  placeholder="Contoh: Ahmad Fauzi, S.E."
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Email Resmi</label>
                <input
                  type="email"
                  placeholder="ahmad@pdam-tirta.id"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Peran Hak Akses (Role)</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="analis">Analis Kinerja (Dapat membuat & mengedit dashboard)</option>
                  <option value="direksi">Direksi / Pengawas (Hak akses lihat & terima laporan)</option>
                  <option value="admin">Administrator Sistem (Akses penuh tata kelola)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Penugasan Instansi BUMD</label>
                <select
                  value={userTenantId}
                  onChange={(e) => setUserTenantId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium"
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
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setIsAddTenantOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 z-10 text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-800">Daftarkan Instansi BUMD Baru</h3>
              <button onClick={() => setIsAddTenantOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Nama Resmi BUMD</label>
                <input
                  type="text"
                  placeholder="Contoh: Perumda Pariwisata Tirta Graha"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nama Singkat</label>
                  <input
                    type="text"
                    placeholder="Contoh: Perumda Graha"
                    value={tenantShortName}
                    onChange={(e) => setTenantShortName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Kode Instansi</label>
                  <input
                    type="text"
                    placeholder="Contoh: PTG-01"
                    value={tenantCode}
                    onChange={(e) => setTenantCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 uppercase font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Sektor</label>
                  <select
                    value={tenantSector}
                    onChange={(e) => setTenantSector(e.target.value as BumdSector)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                  <label className="block text-slate-700 font-medium mb-1">Kota / Kabupaten</label>
                  <input
                    type="text"
                    placeholder="Kota Mandiri"
                    value={tenantCity}
                    onChange={(e) => setTenantCity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddTenantOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium"
                >
                  Simpan BUMD
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
