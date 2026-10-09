import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Database,
  Key,
  LogOut,
  Menu,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { AvatarTile } from '../components/BrandMark';
import { ThemeToggle } from '../components/ThemeToggle';
import { ItemCard } from '../components/ui/ItemCard';
import { ADMIN_TABS, AdminTabId } from '../components/adminTabs';
import { AlertRule, AuditLog, BumdSector, Tenant, User, UserRole } from '../types';

/** Label sektor untuk ditampilkan (sektor tetap dipetakan dari dokumen KB). */
const LABEL_SEKTOR: Record<BumdSector, string> = {
  pdam: 'PDAM (Air Minum)',
  bank: 'Bank Daerah (BPD/BPR)',
  pasar: 'Pasar Rakyat',
  rsud: 'Rumah Sakit (RSUD)',
  transportasi: 'Transportasi Daerah',
  aneka_usaha: 'Aneka Usaha / Pariwisata',
};

/**
 * Baris hasil yang terisi otomatis dari KB — BUKAN kolom isian.
 * Dipakai form "BUMD & Tenant" supaya admin hanya perlu mengisi KB ID.
 */
const BarisOtomatis: React.FC<{ label: string; nilai?: string }> = ({ label, nilai }) => (
  <div>
    <label className="block text-ink-3 mb-0.5">{label}</label>
    <div className="px-3 py-2 border border-line rounded-control bg-surface-2 text-ink min-h-[34px] break-words">
      {nilai ? nilai : <span className="text-ink-3">— menunggu KB ID</span>}
    </div>
  </div>
);

interface AdminProps {
  currentUser: User | null;
  onLogout: () => void;
  /** Tab aktif dikendalikan App supaya menu di sidebar utama dan isi halaman sinkron. */
  activeTab: AdminTabId;
  onSelectTab: (tab: AdminTabId) => void;
  /** Buka/tutup sidebar utama aplikasi dari header halaman admin. */
  onToggleSidebar: () => void;
}

export const Admin: React.FC<AdminProps> = ({
  currentUser,
  onLogout,
  activeTab,
  onSelectTab,
  onToggleSidebar,
}) => {

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

  // Uji API Key: menyimpan konfigurasi lalu benar-benar mengecek key ke layanan RAG.
  const [keyTestLoading, setKeyTestLoading] = useState(false);
  const [keyTestHasil, setKeyTestHasil] = useState<{
    ok: boolean;
    status: string;
    pesan: string;
    latencyMs?: number;
    httpStatus?: number;
    baseDipakai?: string;
    kodeGalat?: string;
  } | null>(null);

  // Panel Knowledge Base: daftar dokumen sebuah KB (dipisah dari form umum).
  const [kbInput, setKbInput] = useState('');
  const [kbLoading, setKbLoading] = useState(false);
  const [kbHasil, setKbHasil] = useState<{
    kbId: string;
    jumlah: number;
    dokumen: Array<{
      id: string;
      nama: string;
      status?: string;
      halaman?: number;
      potongan?: number;
      token?: number;
      dibuat?: string;
      ringkasan?: string;
    }>;
    catatan?: string;
    provider?: string;
  } | null>(null);

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
  const [tenantKbId, setTenantKbId] = useState('');
  /** Hasil pembacaan profil instansi dari KB (nama/kota/sektor/jumlah dokumen). */
  const [tenantKbInfo, setTenantKbInfo] = useState<{
    kbId: string;
    nama?: string;
    kota?: string;
    sektor?: BumdSector;
    jumlahDokumen: number;
    ringkasan?: string;
    catatan?: string;
  } | null>(null);
  const [tenantKbLoading, setTenantKbLoading] = useState(false);
  /** Sedang menyimpan instansi + menyinkronkan KB-nya (menunggu layanan RAG). */
  const [tenantSaving, setTenantSaving] = useState(false);

  // Sinkronisasi RAG (tab BUMD & Tenant): null = tidak sedang jalan.
  const [sinkronLoading, setSinkronLoading] = useState<string | null>(null);
  const [sinkronHasil, setSinkronHasil] = useState<{
    judul: string;
    dokumenBaru: string[];
    dokumenHilang: string[];
    catatan?: string;
    gagal?: boolean;
  } | null>(null);

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

  // Isi kolom Knowledge Base dari konfigurasi tersimpan begitu config dimuat.
  useEffect(() => {
    const kb = (systemConfig as any)?.ragKnowledgeBaseId;
    if (typeof kb === 'string' && kb && !kbInput) setKbInput(kb);
  }, [systemConfig]);

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

    setTenantSaving(true);
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
          // Jumlah dokumen TIDAK dikirim dari sini — server membacanya dari KB
          // nyata saat sinkron, jadi tidak ada angka karangan.
          knowledgeBaseId: tenantKbId.trim() || undefined,
        }),
      });
      const newT = await res.json();
      // Server kini IKUT menyinkronkan KB saat instansi dibuat (menunggu RAG),
      // jadi instansi yang muncul sudah membawa jumlah dokumen terbaru.
      setTenants((prev) => [...prev, newT]);
      setIsAddTenantOpen(false);
      setTenantName('');
      setTenantCity('');
      setTenantKbId('');
      setTenantKbInfo(null);

      if (newT?.sinkron) {
        setSinkronHasil(
          newT.sinkron.ok
            ? {
                judul: `${newT.name}: KB langsung tersinkron (${newT.sinkron.jumlahDokumen ?? 0} dokumen)`,
                dokumenBaru: [],
                dokumenHilang: [],
                catatan: 'Jumlah dokumen dibaca langsung dari Knowledge Base, bukan angka contoh.',
              }
            : {
                judul: `${newT.name}: instansi dibuat, tetapi KB belum tersinkron`,
                dokumenBaru: [],
                dokumenHilang: [],
                catatan: newT.sinkron.error,
                gagal: true,
              }
        );
      }
      loadData();
    } catch (err) {
      console.error('Create tenant failed:', err);
    } finally {
      setTenantSaving(false);
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

  /**
   * Simpan konfigurasi + uji API Key dalam satu klik.
   * Server menyimpan dulu, baru menguji key yang BARU tersimpan — supaya yang diuji
   * benar-benar key yang baru ditempel, bukan key lama.
   */
  const handleSimpanUjiKey = async () => {
    setKeyTestLoading(true);
    setKeyTestHasil(null);
    try {
      const res = await fetch('/api/admin/config-simpan-uji', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(systemConfig),
      });
      const data = await res.json();
      if (data?.konfigurasi) setSystemConfig(data.konfigurasi);
      if (data?.tersimpan) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
      setKeyTestHasil(
        data?.hasil || {
          ok: false,
          status: 'galat-layanan',
          pesan: data?.error || 'Server tidak mengembalikan hasil uji.',
        }
      );
      loadData();
    } catch (err: any) {
      setKeyTestHasil({
        ok: false,
        status: 'tidak-terhubung',
        pesan: `Gagal menghubungi server: ${err?.message || 'kesalahan jaringan'}`,
      });
    } finally {
      setKeyTestLoading(false);
    }
  };

  /**
   * Perbarui data RAG SATU instansi: baca ulang isi KB-nya dari layanan RAG,
   * lalu perbarui jumlah dokumen + catat dokumen baru/hilang.
   */
  const handleSinkronTenant = async (tenantId: string) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    setSinkronLoading(tenantId);
    setSinkronHasil(null);
    try {
      const res = await fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}/sinkron-rag`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setSinkronHasil({
          judul: `Gagal memperbarui ${tenant?.name || 'instansi'}`,
          dokumenBaru: [],
          dokumenHilang: [],
          catatan: data?.error || `Server menjawab HTTP ${res.status}.`,
          gagal: true,
        });
        return;
      }

      // Perbarui kartu di layar tanpa perlu muat ulang seluruh halaman.
      if (data?.tenant) {
        setTenants((prev) => prev.map((t) => (t.id === data.tenant.id ? data.tenant : t)));
      }

      const baru: string[] = Array.isArray(data?.dokumenBaru) ? data.dokumenBaru : [];
      const hilang: string[] = Array.isArray(data?.dokumenHilang) ? data.dokumenHilang : [];
      const judul = data?.belumPernahSinkron
        ? `${tenant?.name || 'Instansi'}: ${data?.jumlahDokumen ?? 0} dokumen tersinkron (sinkron pertama)`
        : baru.length > 0
          ? `${tenant?.name || 'Instansi'}: ${baru.length} dokumen BARU terdeteksi (total ${data?.jumlahDokumen ?? 0})`
          : `${tenant?.name || 'Instansi'}: tidak ada dokumen baru (total ${data?.jumlahDokumen ?? 0})`;

      setSinkronHasil({ judul, dokumenBaru: baru, dokumenHilang: hilang, catatan: data?.catatan });
    } catch (err: any) {
      setSinkronHasil({
        judul: `Gagal memperbarui ${tenant?.name || 'instansi'}`,
        dokumenBaru: [],
        dokumenHilang: [],
        catatan: `Tidak bisa menghubungi server: ${err?.message || 'kesalahan jaringan'}`,
        gagal: true,
      });
    } finally {
      setSinkronLoading(null);
    }
  };

  /** Hapus Instansi BUMD beserta data terkait */
  const handleDeleteTenant = async (tenant: Tenant) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus instansi "${tenant.name}"?\nSeluruh data terkait instansi ini (pengguna, dashboard, tautan bagikan, notifikasi, aturan alert, riwayat audit) akan dihapus.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/tenants/${encodeURIComponent(tenant.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Gagal menghapus instansi: ${err.error || 'Terjadi kesalahan'}`);
        return;
      }
      // Buang instansi + penggunanya dari state lokal, lalu muat ulang agar
      // daftar pengguna/log audit/dashboard benar-benar sinkron dengan server.
      setTenants((prev) => prev.filter((t) => t.id !== tenant.id));
      setUsers((prev) => prev.filter((u) => u.tenantId !== tenant.id));
      void loadData();
    } catch (err: any) {
      alert(`Gagal menghapus instansi: ${err?.message || 'Kesalahan jaringan'}`);
    }
  };

  /**
   * Perbarui SEMUA instansi berurutan (sengaja tidak paralel supaya layanan RAG
   * tidak dihujani permintaan sekaligus), lalu rangkum hasilnya.
   */
  const handleSinkronSemua = async () => {
    const berKb = tenants.filter((t) => t.knowledgeBaseId);
    if (berKb.length === 0) {
      setSinkronHasil({
        judul: 'Tidak ada instansi yang punya Knowledge Base ID',
        dokumenBaru: [],
        dokumenHilang: [],
        catatan: 'Isi KB ID instansi lebih dulu, baru sinkronkan.',
        gagal: true,
      });
      return;
    }
    setSinkronLoading('semua');
    setSinkronHasil(null);

    const semuaBaru: string[] = [];
    const semuaHilang: string[] = [];
    let berhasil = 0;
    const gagal: string[] = [];

    for (const t of tenants) {
      const kb = (t as any).knowledgeBaseId;
      if (!kb) continue;
      try {
        const res = await fetch(`/api/admin/tenants/${encodeURIComponent(t.id)}/sinkron-rag`, {
          method: 'POST',
        });
        const data = await res.json();
        if (!res.ok) {
          gagal.push(`${t.name}: ${data?.error || `HTTP ${res.status}`}`);
          continue;
        }
        if (data?.tenant) {
          setTenants((prev) => prev.map((x) => (x.id === data.tenant.id ? data.tenant : x)));
        }
        for (const n of data?.dokumenBaru || []) semuaBaru.push(`${t.name} → ${n}`);
        for (const n of data?.dokumenHilang || []) semuaHilang.push(`${t.name} → ${n}`);
        berhasil++;
      } catch (err: any) {
        gagal.push(`${t.name}: ${err?.message || 'kesalahan jaringan'}`);
      }
    }

    setSinkronHasil({
      judul:
        gagal.length > 0
          ? `Selesai dengan masalah: ${berhasil} berhasil, ${gagal.length} gagal`
          : semuaBaru.length > 0
            ? `Selesai: ${berhasil} instansi diperbarui, ${semuaBaru.length} dokumen BARU terdeteksi`
            : `Selesai: ${berhasil} instansi diperbarui, tidak ada dokumen baru`,
      dokumenBaru: semuaBaru,
      dokumenHilang: semuaHilang,
      catatan: gagal.length > 0 ? `Gagal: ${gagal.join(' | ')}` : undefined,
      gagal: gagal.length > 0,
    });
    setSinkronLoading(null);
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

  /**
   * Periksa sebuah Knowledge Base ID: tampilkan ADA BERAPA dokumen dan dokumen APA SAJA.
   * Tidak menyimpan apa pun — murni pemeriksaan supaya admin tahu isi KB sebelum dipakai.
   */
  const handleCekKb = async (kbId?: string) => {
    const kb = (kbId ?? kbInput ?? '').trim();
    if (!kb) {
      setKbHasil(null);
      return;
    }
    setKbLoading(true);
    setKbHasil(null);
    try {
      const res = await fetch(`/api/admin/knowledge?kb=${encodeURIComponent(kb)}`);
      const data = await res.json();
      setKbHasil(data);
    } catch (err: any) {
      setKbHasil({
        kbId: kb,
        jumlah: 0,
        dokumen: [],
        catatan: `Gagal menghubungi server: ${err?.message || 'kesalahan jaringan'}`,
      });
    } finally {
      setKbLoading(false);
    }
  };

  // Auto-isi: cukup mengetik/tempel KB ID, daftar dokumen langsung diperiksa sendiri
  // (tanpa klik tombol). Diberi jeda 700 ms supaya tidak memanggil server tiap ketukan.
  useEffect(() => {
    const kb = kbInput.trim();
    if (!kb) {
      setKbHasil(null);
      return;
    }
    const timer = setTimeout(() => {
      void handleCekKb(kb);
    }, 700);
    return () => clearTimeout(timer);
  }, [kbInput]);

  /**
   * AUTO-ISI dari KB: satu-satunya isian di form ini adalah KB ID. Begitu diisi,
   * semua field lain (Nama, Kota, Sektor, Nama Singkat, Kode) TERISI dari dokumen KB.
   * Kalau KB kosong/ID salah, field dikosongkan lagi supaya tidak ada sisa nilai lama
   * yang tertinggal dan tampak seolah-olah masih berlaku.
   */
  useEffect(() => {
    const kb = tenantKbId.trim();
    if (!kb) {
      setTenantKbInfo(null);
      setTenantName('');
      setTenantCity('');
      setTenantShortName('');
      setTenantCode('');
      setTenantSector('pdam');
      return;
    }
    let batal = false;
    setTenantKbLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/kb-profil?kb=${encodeURIComponent(kb)}`);
        const data = await res.json();
        if (batal) return;
        setTenantKbInfo(data);
        // Field ini bukan isian lagi, jadi diisi apa adanya dari dokumen.
        setTenantName(data?.nama || '');
        setTenantCity(data?.kota || '');
        if (data?.sektor) setTenantSector(data.sektor);
        // Nama singkat: ambil potongan nama instansi; kalau tidak ada, dari KB ID.
        setTenantShortName(
          data?.nama ? String(data.nama).replace(/^Perumda\s+/i, '').slice(0, 24) : ''
        );
        // Kode instansi diturunkan dari KB ID (mis. kb_pam_jaya → KB_PAM_JAYA).
        setTenantCode(kb.toUpperCase());
      } catch {
        if (!batal) {
          setTenantKbInfo({
            kbId: kb,
            jumlahDokumen: 0,
            catatan: 'Tidak bisa menghubungi server untuk membaca KB.',
          });
          setTenantName('');
          setTenantCity('');
        }
      } finally {
        if (!batal) setTenantKbLoading(false);
      }
    }, 800);
    return () => {
      batal = true;
      clearTimeout(timer);
    };
  }, [tenantKbId]);

  return (
    <div className="flex-1 flex flex-row min-w-0 min-h-0 h-full overflow-hidden bg-canvas text-ink font-sans">
      {/* Menu Panel Admin kini berada di SIDEBAR UTAMA aplikasi (lihat `components/adminTabs.ts`),
          jadi halaman ini tidak lagi merender sidebar kedua. Tab aktif datang dari App
          supaya penanda aktif di sidebar utama dan isi halaman selalu sinkron. */}

      {/* Kolom kanan: header + konten */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <header className="shrink-0 z-30 bg-surface border-b border-line shadow-2xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={onToggleSidebar}
                className="p-1.5 rounded-control text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors shrink-0"
                title="Buka / Tutup Sidebar"
                aria-label="Buka atau tutup sidebar"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="h-4 w-px bg-line hidden sm:block" />
              <div className="flex items-center gap-2 truncate">
                <Shield className="w-4 h-4 text-brand shrink-0" />
                <h1 className="text-sm font-bold tracking-tight text-ink truncate">
                  {ADMIN_TABS.find((t) => t.id === activeTab)?.judul || 'Admin Center'}
                </h1>
              </div>
              <div className="h-4 w-px bg-line hidden sm:block" />
              <span className="hidden md:inline text-[10px] text-ink-3 font-medium uppercase tracking-wider truncate">
                Aiones Boards Admin &amp; Governance Center
              </span>
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
                    <span>Tambah Instansi BUMD</span>
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
                    onClick={() => onSelectTab('audit')}
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
                  <span>Tambah Pengguna Baru</span>
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
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {/* Sinkronkan semua instansi sekaligus — untuk kasus admin mengunggah
                      dokumen baru ke beberapa KB lalu ingin semua angka diperbarui. */}
                  <button
                    onClick={handleSinkronSemua}
                    disabled={sinkronLoading !== null}
                    className="px-3.5 py-2 border border-line hover:bg-surface-2 text-ink-2 rounded-control text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Baca ulang jumlah dokumen semua instansi dari layanan RAG"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${sinkronLoading === 'semua' ? 'animate-spin' : ''}`} />
                    <span>Perbarui Semua</span>
                  </button>
                  <button
                    onClick={() => setIsAddTenantOpen(true)}
                    className="px-3.5 py-2 bg-brand hover:bg-brand-ink text-on-brand rounded-control text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Daftarkan BUMD Baru</span>
                  </button>
                </div>
              </div>

              {/* Hasil sinkronisasi terakhir (dokumen baru disebutkan namanya). */}
              {sinkronHasil && (
                <div
                  className={`p-3 rounded-card border text-xs flex items-start gap-2 ${
                    sinkronHasil.gagal
                      ? 'bg-neg/15 border-neg/30 text-neg'
                      : sinkronHasil.dokumenBaru.length > 0
                        ? 'bg-pos/15 border-pos/30 text-pos'
                        : 'bg-surface-2 border-line text-ink-2'
                  }`}
                >
                  {sinkronHasil.gagal ? (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 min-w-0">
                    <div className="font-semibold">{sinkronHasil.judul}</div>
                    {!!sinkronHasil.dokumenBaru.length && (
                      <ul className="list-disc pl-4 space-y-0.5">
                        {sinkronHasil.dokumenBaru.map((n) => (
                          <li key={n} className="break-all">
                            <span className="font-semibold">BARU:</span> {n}
                          </li>
                        ))}
                      </ul>
                    )}
                    {!!sinkronHasil.dokumenHilang?.length && (
                      <ul className="list-disc pl-4 space-y-0.5 text-warn">
                        {sinkronHasil.dokumenHilang.map((n) => (
                          <li key={n} className="break-all">
                            <span className="font-semibold">HILANG:</span> {n}
                          </li>
                        ))}
                      </ul>
                    )}
                    {!!sinkronHasil.catatan && <div className="text-ink-3">{sinkronHasil.catatan}</div>}
                  </div>
                  <button
                    onClick={() => setSinkronHasil(null)}
                    className="ml-auto text-ink-3 hover:text-ink-2 shrink-0"
                    aria-label="Tutup hasil sinkronisasi"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

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
                        Berkas RAG: <strong className="text-pos">{t.documentCount} berkas</strong>
                      </span>
                      <span className="text-ink-2 col-span-2">
                        KB: <strong className="font-mono text-ink-2">{t.knowledgeBaseId || '(belum diisi)'}</strong>
                      </span>
                      <span className="text-ink-3 col-span-2">
                        {t.kbTersinkronPada
                          ? `Terakhir disinkronkan: ${new Date(t.kbTersinkronPada).toLocaleString('id-ID')}`
                          : 'Belum pernah disinkronkan dari panel ini'}
                      </span>
                    </span>
                    <div className="pt-2 mt-2 border-t border-line/70 flex items-center gap-2">
                      <button
                        onClick={() => handleSinkronTenant(t.id)}
                        disabled={sinkronLoading !== null || !t.knowledgeBaseId}
                        className="flex-1 px-3 py-1.5 border border-line hover:bg-surface-2 text-ink-2 rounded-control text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={
                          t.knowledgeBaseId
                            ? `Baca ulang isi KB ${t.knowledgeBaseId} dari layanan RAG`
                            : 'Instansi ini belum punya Knowledge Base ID'
                        }
                      >
                        <RefreshCw className={`w-3 h-3 ${sinkronLoading === t.id ? 'animate-spin' : ''}`} />
                        <span>{sinkronLoading === t.id ? 'Memperbarui…' : 'Perbarui RAG'}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteTenant(t)}
                        className="p-1.5 border border-line hover:bg-neg/10 text-ink-3 hover:text-neg rounded-control transition-colors"
                        title="Hapus Instansi BUMD"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </ItemCard>
                ))}
              </div>

              <p className="text-[11px] text-ink-3 border-t border-line pt-3">
                Tombol <strong>Perbarui RAG</strong> membaca ulang isi Knowledge Base instansi dari
                layanan RAG, lalu memperbarui jumlah dokumen. Kalau ada dokumen baru yang kamu unggah,
                namanya akan disebutkan di atas. Layanan RAG tidak diubah — hanya dibaca.
              </p>
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

                {/* API Key + tombol uji. Tombolnya menyimpan konfigurasi dulu, baru
                    mengecek key-nya ke layanan RAG — jadi yang diuji benar-benar key
                    yang baru ditempel, bukan key lama yang masih tersimpan. */}
                <div>
                  <label className="block text-ink-2 font-semibold mb-1">
                    API Key LLM / RAG
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <input
                        type="password"
                        placeholder="tempel API key di sini"
                        value={systemConfig.ragApiKey}
                        onChange={(e) =>
                          setSystemConfig({ ...systemConfig, ragApiKey: e.target.value })
                        }
                        className="w-full px-3 py-2 pr-9 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand font-mono"
                      />
                      <Key className="w-4 h-4 text-ink-3 absolute right-3 top-2.5" />
                    </div>
                    <button
                      type="button"
                      onClick={handleSimpanUjiKey}
                      disabled={keyTestLoading || !String(systemConfig.ragApiKey || '').trim()}
                      className="shrink-0 px-4 py-2 bg-brand hover:bg-brand-ink text-on-brand rounded-control font-medium transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {keyTestLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menguji…
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" /> Simpan &amp; Uji API Key
                        </>
                      )}
                    </button>
                  </div>

                  {/* Hasil uji API Key — dibedakan jujur: valid / ditolak / tidak terhubung. */}
                  {keyTestHasil && (
                    <div
                      className={`mt-2 p-3 rounded-card border text-[11px] flex items-start gap-2 ${
                        keyTestHasil.ok
                          ? 'bg-pos/15 border-pos/30 text-pos'
                          : 'bg-neg/15 border-neg/30 text-neg'
                      }`}
                    >
                      {keyTestHasil.ok ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <div className="font-semibold">
                          {keyTestHasil.ok ? 'API Key Berjalan' : 'API Key Bermasalah'}
                        </div>
                        <div className="text-ink-2">{keyTestHasil.pesan}</div>
                        {keyTestHasil.kodeGalat && (
                          <div className="text-ink-3 font-mono">Kode: {keyTestHasil.kodeGalat}</div>
                        )}
                        {keyTestHasil.baseDipakai && (
                          <div className="text-ink-3 font-mono break-all">
                            Diuji ke: {keyTestHasil.baseDipakai}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-ink-3 mt-1">
                    Tombol ini menyimpan konfigurasi lalu benar-benar memanggil layanan RAG untuk
                    memastikan key-nya diterima (bukan sekadar tersimpan).
                  </p>
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

              {/* ===== KNOWLEDGE BASE (DIPISAH DARI FORM UMUM) ===== */}
              <div className="pt-4 border-t border-line space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h4 className="font-bold text-ink flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-brand" />
                      <span>Knowledge Base</span>
                    </h4>
                    <p className="text-[11px] text-ink-2 mt-0.5">
                      Tempel Knowledge Base ID lalu periksa isinya: aplikasi akan menampilkan{' '}
                      <strong>ada berapa dokumen</strong> dan <strong>dokumen apa saja</strong> di KB itu.
                    </p>
                  </div>
                </div>

                <div className="flex items-end gap-2 flex-wrap">
                  <div className="flex-1 min-w-[240px]">
                    <label className="block text-ink-2 font-semibold mb-1 text-xs">Knowledge Base ID</label>
                    <input
                      type="text"
                      placeholder="kb_pam_jaya"
                      value={kbInput}
                      onChange={(e) => setKbInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleCekKb();
                        }
                      }}
                      className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand font-mono text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCekKb()}
                    disabled={kbLoading || !kbInput.trim()}
                    className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-surface border border-line-strong hover:bg-surface-2 text-brand-ink rounded-control font-semibold text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-4 h-4 ${kbLoading ? 'animate-spin' : ''}`} />
                    {kbLoading ? 'Memeriksa...' : 'Periksa Dokumen'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const kb = kbInput.trim();
                      if (!kb || !systemConfig) return;
                      const res = await fetch('/api/admin/config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ragKnowledgeBaseId: kb }),
                      });
                      if (res.ok) {
                        setSystemConfig({ ...systemConfig, ragKnowledgeBaseId: kb });
                        setSaveSuccess(true);
                        setTimeout(() => setSaveSuccess(false), 2500);
                      }
                    }}
                    disabled={!kbInput.trim()}
                    className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-ink text-on-brand rounded-control font-semibold text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    title="Simpan KB ini sebagai Knowledge Base default aplikasi"
                  >
                    <Check className="w-4 h-4" />
                    Jadikan KB Default
                  </button>
                </div>

                {kbHasil && (
                  <div className="space-y-3">
                    <div
                      className={`p-3 rounded-card border text-xs ${
                        kbHasil.jumlah > 0 ? 'bg-pos/15 border-pos/30' : 'bg-warn/15 border-warn/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold">
                        {kbHasil.jumlah > 0 ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-pos" />
                            <span className="text-pos">
                              KB <span className="font-mono">{kbHasil.kbId}</span> memuat{' '}
                              {kbHasil.jumlah} dokumen
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 text-warn" />
                            <span className="text-warn">
                              KB <span className="font-mono">{kbHasil.kbId || '(kosong)'}</span> tidak memuat dokumen
                            </span>
                          </>
                        )}
                      </div>
                      {kbHasil.catatan && <p className="text-ink-2 mt-1.5">{kbHasil.catatan}</p>}
                      {kbHasil.provider && (
                        <p className="text-ink-3 mt-1">
                          Provider RAG aktif: <span className="font-mono">{kbHasil.provider}</span>
                        </p>
                      )}
                    </div>

                    {kbHasil.jumlah > 0 && (
                      <div className="overflow-x-auto border border-line rounded-card">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-surface-2 text-ink-2 font-semibold border-b border-line">
                            <tr>
                              <th className="p-3 w-8">#</th>
                              <th className="p-3">Nama Dokumen</th>
                              <th className="p-3">Status</th>
                              <th className="p-3 text-right">Halaman</th>
                              <th className="p-3 text-right">Potongan</th>
                              <th className="p-3 text-right">Token</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line text-ink-2">
                            {kbHasil.dokumen.map((d, i) => (
                              <tr key={d.id || i} className="hover:bg-surface-2/60 transition-colors align-top">
                                <td className="p-3 font-mono text-ink-3">{i + 1}</td>
                                <td className="p-3">
                                  <span className="text-ink font-medium break-all">{d.nama}</span>
                                  {d.id && <span className="block text-[10px] text-ink-3 font-mono mt-0.5">{d.id}</span>}
                                </td>
                                <td className="p-3">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                      !d.status || /complete|done|ready|selesai/i.test(d.status)
                                        ? 'bg-pos/15 text-pos'
                                        : 'bg-warn/15 text-warn'
                                    }`}
                                  >
                                    {d.status || 'siap'}
                                  </span>
                                </td>
                                <td className="p-3 text-right font-mono">{d.halaman ?? '—'}</td>
                                <td className="p-3 text-right font-mono">{d.potongan ?? '—'}</td>
                                <td className="p-3 text-right font-mono">{d.token ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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
                {/* KB ID paling atas: begitu ditempel, field di bawah terisi otomatis
                    dari dokumen KB (nama, kota, sektor, jumlah dokumen). */}
                <div className="p-3 bg-surface-2 border border-line rounded-card space-y-2">
                  <label className="block text-ink-2 font-medium mb-1">
                    Knowledge Base ID <span className="font-normal text-ink-3">(isi ini dulu — sisanya terisi otomatis)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: kb_pam_jaya"
                    value={tenantKbId}
                    onChange={(e) => setTenantKbId(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand font-mono"
                  />
                  {tenantKbLoading && (
                    <p className="text-[11px] text-ink-2 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Membaca dokumen KB…
                    </p>
                  )}
                  {!tenantKbLoading && tenantKbInfo && (
                    <div
                      className={`text-[11px] rounded-control p-2 border ${
                        tenantKbInfo.jumlahDokumen > 0
                          ? 'bg-pos/15 border-pos/30 text-pos'
                          : 'bg-warn/15 border-warn/30 text-warn'
                      }`}
                    >
                      <span className="font-semibold">
                        {tenantKbInfo.jumlahDokumen > 0
                          ? `${tenantKbInfo.jumlahDokumen} dokumen ditemukan — field di bawah sudah terisi otomatis.`
                          : 'KB ini tidak memuat dokumen.'}
                      </span>
                      {tenantKbInfo.catatan && <span className="block text-ink-2 mt-0.5">{tenantKbInfo.catatan}</span>}
                      {!!tenantKbInfo.ringkasan && (
                        <span className="block text-ink-3 mt-1 break-all">Isi: {tenantKbInfo.ringkasan}</span>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-ink-3">
                    Kosongkan hanya kalau instansi belum punya KB. Tanpa KB, chat instansi ini
                    menolak menjawab daripada menampilkan dokumen instansi lain.
                  </p>
                </div>

                {/* Field lain BUKAN isian: hanya menampilkan hasil yang dibaca dari
                    dokumen KB. Admin cukup mengisi KB ID di atas. */}
                <div className="space-y-2">
                  <BarisOtomatis label="Nama Resmi BUMD" nilai={tenantName} />
                  <div className="grid grid-cols-2 gap-2">
                    <BarisOtomatis label="Nama Singkat" nilai={tenantShortName} />
                    <BarisOtomatis label="Kode Instansi" nilai={tenantCode} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <BarisOtomatis label="Sektor" nilai={LABEL_SEKTOR[tenantSector]} />
                    <BarisOtomatis label="Kota / Kabupaten" nilai={tenantCity} />
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
                    disabled={tenantSaving || tenantKbLoading || !tenantName || !tenantCity}
                    className="px-4 py-2 bg-brand hover:bg-brand-ink text-on-brand rounded-control font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    {tenantSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Menyimpan &amp; menyinkronkan KB…
                      </>
                    ) : (
                      'Simpan BUMD'
                    )}
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
