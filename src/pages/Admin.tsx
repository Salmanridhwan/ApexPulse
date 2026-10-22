import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  FolderOpen,
  Key,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';
import { AvatarTile } from '../components/BrandMark';
import { ThemeToggle } from '../components/ThemeToggle';
import { ItemCard } from '../components/ui/ItemCard';
import { ADMIN_TABS, AdminTabId } from '../components/adminTabs';
import { MENU_KINERJA } from '../components/menuKinerja';
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
 * Baris hasil yang terisi otomatis dari KB.
 * Bila `onChange` diberikan, baris berubah jadi kolom ISIAN: nilainya datang dari
 * dokumen, tetapi admin tetap boleh menimpanya secara manual — ini jalur keluar
 * ketika layanan RAG lambat/tidak tersedia sehingga field tidak terisi sendiri.
 */
const BarisOtomatis: React.FC<{
  label: string;
  nilai?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
}> = ({ label, nilai, onChange, placeholder }) => (
  <div>
    <label className="block text-ink-3 mb-0.5">{label}</label>
    {onChange ? (
      <input
        type="text"
        value={nilai || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || '— menunggu KB ID (bisa diisi manual)'}
        className="w-full px-3 py-2 border border-line rounded-control bg-surface text-ink min-h-[34px] focus:outline-none focus:ring-1 focus:ring-brand"
      />
    ) : (
      <div className="px-3 py-2 border border-line rounded-control bg-surface-2 text-ink min-h-[34px] break-words">
        {nilai ? nilai : <span className="text-ink-3">— menunggu KB ID</span>}
      </div>
    )}
  </div>
);

/**
 * Angka gaya Indonesia untuk daftar katalog KB (mis. 1.234).
 * Dipakai di panel "Perbarui RAG" agar jumlah token mudah dibaca.
 */
const angkaId = (n: unknown): string => new Intl.NumberFormat('id-ID').format(Number(n) || 0);

/**
 * Tanggal ringkas dari layanan RAG (ISO → "14 Okt 2026").
 * Mengembalikan null bila tanggalnya tidak bisa dibaca, supaya UI tidak
 * menampilkan "Invalid Date".
 */
const tanggalRingkas = (iso?: string): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Saring satu baris katalog kapan tombol "Perbarui RAG" sedang terbuka.
 *
 * Pengelompokan (terpakai/tersedia/perlu dicek) sudah dihitung server; ini hanya
 * penyaring tampilan supaya pencarian terasa langsung tanpa memanggil ulang.
 */
const cocokBarisKb = (k: any, cari: string, hanyaBelumDipakai: boolean): boolean => {
  if (hanyaBelumDipakai && k?.terpakai) return false;
  const q = String(cari || '').trim().toLowerCase();
  if (q && !String(k?.knowledgeBaseId || '').toLowerCase().includes(q)) return false;
  return true;
};

/**
 * Sidik jari pengaturan integrasi (RAG + KMS).
 *
 * Dipakai untuk memberi tahu admin apakah masih ada perubahan yang belum
 * disimpan, tanpa perlu membandingkan seluruh objek sistem.
 */
const jejakCfg = (c: any) =>
  JSON.stringify({
    p: c?.ragProvider ?? '',
    u: c?.ragApiUrl ?? '',
    k: c?.ragApiKey ?? '',
    kb: c?.ragKnowledgeBaseId ?? '',
    ku: c?.kmsApiUrl ?? '',
    kk: c?.kmsApiKey ?? '',
  });

interface AdminProps {
  currentUser: User | null;
  onLogout: () => void;
  /** Tab aktif dikendalikan App supaya menu di sidebar utama dan isi halaman sinkron. */
  activeTab: AdminTabId;
  onSelectTab: (tab: AdminTabId) => void;
  /** Buka/tutup sidebar utama aplikasi dari header halaman admin. */
  onToggleSidebar: () => void;
  /**
   * Dipanggil setelah panel admin memuat ulang daftar instansi.
   *
   * App memegang satu-satunya objek "instansi aktif" (dipakai RAG Copilot untuk
   * menentukan KB). Tanpa pemberitahuan ini, mengubah KB sebuah instansi di panel
   * tidak akan terlihat oleh copilot sampai halaman dimuat ulang.
   */
  onTenantsRefreshed?: () => void;
}

export const Admin: React.FC<AdminProps> = ({
  currentUser,
  onLogout,
  activeTab,
  onSelectTab,
  onToggleSidebar,
  onTenantsRefreshed,
}) => {

  // Admin Data State
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [systemConfig, setSystemConfig] = useState<any>(null);
  /** Sidik jari konfigurasi saat terakhir tersimpan — untuk menandai "belum disimpan". */
  const [cfgTersimpan, setCfgTersimpan] = useState('');
  /** Tampilkan API key sebagai teks (bawaan: bertopeng). */
  const [tampilKunci, setTampilKunci] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  /** Pendaftar yang menunggu persetujuan admin instansi (manual maupun Google). */
  const [permintaanGabung, setPermintaanGabung] = useState<
    { id: string; name: string; email: string; tenantId: string; tenantName: string | null; viaGoogle: boolean; emailVerified: boolean; requestedAt: string | null }[]
  >([]);
  /** Peran yang dipilih admin untuk tiap permintaan (default mengikuti permintaan). */
  const [rolePermintaan, setRolePermintaan] = useState<Record<string, UserRole>>({});
  const [memproses, setMemproses] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  /** Pesan kegagalan aksi admin (simpan config, buat/nonaktifkan pengguna).
   *  Dulu kegagalan hanya masuk console sehingga UI tetap terlihat berhasil. */
  const [galatAksi, setGalatAksi] = useState<string | null>(null);

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
  /** true saat kbInput diisi OTOMATIS dari config — menahan pemeriksaan KB otomatis. */
  const kbIsiOtomatis = useRef(false);
  const [kbLoading, setKbLoading] = useState(false);

  // Uji koneksi KMS (repositori berkas) — memakai konfigurasi yang TERSIMPAN.
  const [kmsLoading, setKmsLoading] = useState(false);
  const [kmsHasil, setKmsHasil] = useState<{ ok: boolean; jumlahProject: number; pesan: string } | null>(null);
  const [kmsOrganisasi, setKmsOrganisasi] = useState<Array<{ id: string; name: string; knowledgeBase?: string }>>([]);

  // Katalog KB dari layanan RAG (tombol "Perbarui RAG").
  const [katalogTerbuka, setKatalogTerbuka] = useState(false);
  const [katalogLoading, setKatalogLoading] = useState(false);
  const [katalogCari, setKatalogCari] = useState('');
  const [katalogHanyaBelum, setKatalogHanyaBelum] = useState(false);
  const [katalogGalat, setKatalogGalat] = useState<string | null>(null);
  const [katalog, setKatalog] = useState<{
    kbs: any[];
    kelompok: { terpakai: any[]; tersedia: any[]; perluDicek: any[] };
    ringkasan: any;
    catatan?: string;
    baseUrl?: string;
  } | null>(null);
  /** Pilihan instansi untuk tiap KB yang belum dipakai: kbId -> tenantId */
  const [kbPilihInstansi, setKbPilihInstansi] = useState<Record<string, string>>({});
  const [kbSedangPasang, setKbSedangPasang] = useState<string | null>(null);
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
  /**
   * ID instansi yang sedang DIEDIT lewat modal. Kosong = mode "tambah baru".
   * Dipakai agar admin bisa mengubah Knowledge Base instansi yang sudah ada
   * (mis. saat instansi berganti sumber dokumen) tanpa harus menghapus-buat ulang.
   */
  const [editTenantId, setEditTenantId] = useState<string>('');
  const [tenantName, setTenantName] = useState('');
  const [tenantShortName, setTenantShortName] = useState('');
  const [tenantSector, setTenantSector] = useState<BumdSector>('pdam');
  const [tenantCity, setTenantCity] = useState('');
  const [tenantCode, setTenantCode] = useState('');
  const [tenantKbId, setTenantKbId] = useState('');
  /** Project KMS instansi ini (tujuan unggah menu Manajemen Berkas). */
  const [tenantKmsOrgId, setTenantKmsOrgId] = useState('');
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
  /** True bila KB punya dokumen tetapi profil (nama/kota) gagal terisi otomatis. */
  const [tenantProfilGagal, setTenantProfilGagal] = useState(false);
  /** True bila admin memilih mengisi profil manual (melewati pembacaan KB). */
  const [tenantManual, setTenantManual] = useState(false);
  /** Pesan galat saat menyimpan instansi (mis. validasi server menolak). */
  const [tenantSaveError, setTenantSaveError] = useState('');
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
      if (configRes) {
        setSystemConfig(configRes);
        // Titik acuan "belum disimpan": setiap kali data dimuat ulang, anggap bersih.
        setCfgTersimpan(jejakCfg(configRes));
      }
      if (Array.isArray(logsRes)) setAuditLogs(logsRes);
      if (Array.isArray(alertsRes)) setAlertRules(alertsRes);
      const gabungRes = await fetch('/api/admin/join-requests').then(j);
      if (Array.isArray(gabungRes)) {
        setPermintaanGabung(gabungRes);
        setRolePermintaan((prev) => {
          const next = { ...prev };
          for (const p of gabungRes) if (!next[p.id]) next[p.id] = 'analis';
          return next;
        });
      }
      if (Array.isArray(tenantsRes) && tenantsRes.length > 0 && !userTenantId) {
        // Default kolom instansi pada form pengguna = instansi admin sendiri,
        // bukan instansi pertama pada daftar (urutannya arbitrer).
        const milikAdmin = tenantsRes.find((t: any) => t.id === currentUser?.tenantId);
        setUserTenantId(milikAdmin?.id || tenantsRes[0].id);
      }
      // Beri tahu App supaya objek instansi aktif (dipakai header copilot) ikut segar.
      onTenantsRefreshed?.();
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /** Setujui pendaftar: akun menjadi aktif pada instansi yang diminta. */
  const setujuiPermintaan = async (p: { id: string; tenantId: string }) => {
    setMemproses(p.id);
    try {
      const res = await fetch(`/api/admin/join-requests/${p.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: rolePermintaan[p.id] || 'analis', tenantId: p.tenantId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Gagal menyetujui (HTTP ${res.status}).`);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menyetujui pendaftaran.');
    } finally {
      setMemproses(null);
    }
  };

  /** Tolak pendaftar: akun tidak bisa dipakai masuk. */
  const tolakPermintaan = async (p: { id: string; name: string }) => {
    if (!window.confirm(`Tolak pendaftaran "${p.name}"? Akun ini tidak akan bisa masuk.`)) return;
    setMemproses(p.id);
    try {
      const res = await fetch(`/api/admin/join-requests/${p.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Gagal menolak (HTTP ${res.status}).`);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menolak pendaftaran.');
    } finally {
      setMemproses(null);
    }
  };

  /** Ubah satu aturan ambang batas dari panel admin (ambang / status aktif). */
  const ubahAturanAlert = async (rule: AlertRule, perubahan: Partial<AlertRule>) => {
    try {
      const res = await fetch(`/api/alerts/${rule.id}?tenantId=${encodeURIComponent(rule.tenantId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...perubahan, tenantId: rule.tenantId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Gagal menyimpan (HTTP ${res.status}).`);
      }
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menyimpan aturan ambang batas.');
    }
  };

  /** Hapus aturan ambang batas beserta notifikasinya. */
  const hapusAturanAlert = async (rule: AlertRule) => {
    const yakin = window.confirm(
      `Hapus aturan "${rule.metricName} ${rule.operator} ${rule.threshold} ${rule.unit}"? Tindakan ini tidak bisa dibatalkan.`
    );
    if (!yakin) return;
    try {
      const res = await fetch(`/api/alerts/${rule.id}?tenantId=${encodeURIComponent(rule.tenantId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Gagal menghapus (HTTP ${res.status}).`);
      }
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus aturan ambang batas.');
    }
  };

  // Isi kolom Knowledge Base dari konfigurasi tersimpan begitu config dimuat.
  useEffect(() => {
    const kb = (systemConfig as any)?.ragKnowledgeBaseId;
    if (typeof kb === 'string' && kb && !kbInput) {
      kbIsiOtomatis.current = true; // jangan picu pemeriksaan otomatis
      setKbInput(kb);
    }
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
      if (!res.ok) {
        setGalatAksi(newUser?.error || 'Pengguna gagal dibuat.');
        return;
      }
      setGalatAksi(null);
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
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setGalatAksi('Pengguna gagal dinonaktifkan.');
        return;
      }
      setGalatAksi(null);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      loadData();
    } catch (err) {
      console.error('Delete user failed:', err);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validasi TIDAK boleh gagal senyap: kalau tombol Simpan tak bereaksi,
    // admin mengira aplikasinya rusak. Selalu jelaskan apa yang kurang.
    setTenantSaveError('');
    if (!tenantName.trim() || !tenantCity.trim()) {
      setTenantSaveError(
        'Nama Resmi BUMD dan Kota/Kabupaten wajib diisi. Lengkapi field tersebut (boleh manual) lalu simpan lagi.'
      );
      return;
    }

    setTenantSaving(true);
    const modeEdit = !!editTenantId;
    try {
      const res = await fetch(
        modeEdit ? `/api/admin/tenants/${encodeURIComponent(editTenantId)}` : '/api/admin/tenants',
        {
          method: modeEdit ? 'PATCH' : 'POST',
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
            // Project KMS (repositori berkas). Dikirim eksplisit supaya admin bisa
            // MENGOSONGKAN pemetaan (string kosong -> undefined), bukan hanya mengisi.
            kmsOrganizationId: tenantKmsOrgId.trim() || undefined,
          }),
        }
      );
      const newT = await res.json();
      // Server menolak (mis. kode instansi duplikat / nama kosong): tampilkan
      // alasannya di form, jangan tutup modal seolah berhasil.
      if (!res.ok) {
        setTenantSaveError(newT?.error || `Gagal menyimpan instansi (HTTP ${res.status}).`);
        return;
      }
      // Server IKUT menyinkronkan KB saat KB berubah (menunggu RAG), jadi
      // instansi yang muncul sudah membawa jumlah dokumen terbaru.
      if (modeEdit) {
        setTenants((prev) => prev.map((t) => (t.id === newT.id ? newT : t)));
      } else {
        setTenants((prev) => [...prev, newT]);
      }
      tutupModalTenant();

      if (newT?.sinkron) {
        setSinkronHasil(
          newT.sinkron.ok
            ? {
                judul: `${newT.name}: KB ${modeEdit ? 'diperbarui' : 'langsung tersinkron'} (${newT.sinkron.jumlahDokumen ?? 0} dokumen)`,
                dokumenBaru: [],
                dokumenHilang: [],
                catatan: 'Jumlah dokumen dibaca langsung dari Knowledge Base, bukan angka contoh.',
              }
            : {
                judul: `${newT.name}: ${modeEdit ? 'perubahan disimpan' : 'instansi dibuat'}, tetapi KB belum tersinkron`,
                dokumenBaru: [],
                dokumenHilang: [],
                catatan: newT.sinkron.error,
                gagal: true,
              }
        );
      }
      loadData();
    } catch (err) {
      console.error('Simpan tenant failed:', err);
      setTenantSaveError('Tidak bisa menghubungi server saat menyimpan instansi. Coba lagi.');
    } finally {
      setTenantSaving(false);
    }
  };

  /** Kosongkan state modal instansi (dipakai saat batal, sukses, maupun tutup). */
  const tutupModalTenant = () => {
    setIsAddTenantOpen(false);
    setEditTenantId('');
    setTenantName('');
    setTenantCity('');
    setTenantShortName('');
    setTenantCode('');
    setTenantKbId('');
    setTenantKmsOrgId('');
    setTenantSector('pdam');
    setTenantKbInfo(null);
    setTenantProfilGagal(false);
    setTenantManual(false);
    setTenantSaveError('');
  };

  /** Buka modal dalam mode EDIT: isi field dari instansi yang dipilih. */
  const bukaEditTenant = (t: Tenant) => {
    setEditTenantId(t.id);
    setTenantName(t.name || '');
    setTenantCity(t.city || '');
    setTenantShortName(t.shortName || '');
    setTenantCode(t.code || '');
    setTenantSector(t.sector || 'pdam');
    setTenantKbId(t.knowledgeBaseId || '');
    setTenantKmsOrgId(t.kmsOrganizationId || '');
    setTenantKbInfo(null);
    setTenantProfilGagal(false);
    setTenantManual(false);
    setTenantSaveError('');
    setIsAddTenantOpen(true);
  };
  /** Buka modal dalam mode TAMBAH: kosongkan dulu supaya tidak ada sisa nilai. */
  const bukaTambahTenant = () => {
    tutupModalTenant();
    setIsAddTenantOpen(true);
  };

  const handleSaveConfig = async (e?: React.FormEvent) => {
    e?.preventDefault();
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(systemConfig),
      });
      const saved = await res.json();
      if (!res.ok) {
        setGalatAksi(saved?.error || 'Pengaturan gagal disimpan.');
        return;
      }
      setGalatAksi(null);
      setSystemConfig(saved);
      setCfgTersimpan(jejakCfg(saved));
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
      if (data?.konfigurasi) {
        setSystemConfig(data.konfigurasi);
        setCfgTersimpan(jejakCfg(data.konfigurasi));
      }
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
   * Simpan konfigurasi KMS lalu uji koneksinya.
   *
   * Sama seperti uji API Key RAG: simpan dulu, baru uji — supaya yang diuji
   * benar-benar key baru, bukan key lama yang masih tersimpan.
   */
  const handleSimpanUjiKms = async () => {
    setKmsLoading(true);
    setKmsHasil(null);
    try {
      const simpan = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(systemConfig),
      });
      const dataSimpan = await simpan.json().catch(() => ({}));
      if (dataSimpan?.kmsApiKey !== undefined) {
        setSystemConfig(dataSimpan);
        setCfgTersimpan(jejakCfg(dataSimpan));
      }

      const res = await fetch('/api/admin/kms-uji', { method: 'POST' });
      const hasil = await res.json().catch(() => ({}));
      setKmsHasil(hasil);
      if (hasil?.ok) await muatKmsOrganisasi();
    } catch (err: any) {
      setKmsHasil({ ok: false, jumlahProject: 0, pesan: `Gagal menghubungi server: ${err?.message || 'kesalahan jaringan'}` });
    } finally {
      setKmsLoading(false);
    }
  };

  /** Muat daftar project KMS untuk pilihan pemetaan instansi. */
  const muatKmsOrganisasi = async () => {
    try {
      const res = await fetch('/api/admin/kms-organisasi');
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data?.organisasi)) setKmsOrganisasi(data.organisasi);
    } catch {
      // Diamkan: daftar project hanya pelengkap form; galatnya tampil di uji koneksi.
    }
  };

  /**
   * Muat katalog KB dari layanan RAG (tombol "Perbarui RAG").
   *
   * Selalu dibaca ulang dari layanan — tidak ada salinan lokal yang bisa basi,
   * supaya KB yang baru ditambahkan di sumber RAG langsung terlihat di sini.
   */
  const muatKatalogKb = async () => {
    setKatalogLoading(true);
    setKatalogGalat(null);
    try {
      const res = await fetch('/api/admin/kb-tersedia');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Gagal membaca katalog KB (HTTP ${res.status}).`);
      setKatalog(data);
      if (!Array.isArray(data?.kbs) || data.kbs.length === 0) {
        setKatalogGalat(data?.catatan || 'Layanan RAG tidak melaporkan knowledge base apa pun.');
      }
    } catch (err: any) {
      setKatalog(null);
      setKatalogGalat(err?.message || 'Gagal membaca katalog KB.');
    } finally {
      setKatalogLoading(false);
    }
  };

  const bukaKatalogKb = () => {
    setKatalogTerbuka(true);
    setKbPilihInstansi({});
    void muatKatalogKb();
  };

  /**
   * Pasang sebuah KB ke instansi terpilih, lalu sinkronkan.
   *
   * Memakai PATCH instansi yang sudah ada: server otomatis membaca ulang isi KB
   * dan memperbarui jumlah dokumen, jadi tidak ada jalur tulis kedua yang perlu
   * dijaga terpisah.
   */
  const pasangKbKeInstansi = async (kbId: string) => {
    const tenantId = kbPilihInstansi[kbId];
    if (!tenantId) return;
    setKbSedangPasang(kbId);
    try {
      const res = await fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledgeBaseId: kbId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal memasang KB ke instansi.');
      const ten = tenants.find((t) => t.id === tenantId);
      const ok = data?.sinkron?.ok === true;
      setSinkronHasil({
        judul: `${ten?.name || tenantId} ⇐ KB ${kbId}`,
        dokumenBaru: [],
        dokumenHilang: [],
        catatan: ok
          ? `KB dipasang & tersinkron — ${data.sinkron.jumlahDokumen ?? 0} dokumen terbaca dari KB ${kbId}.`
          : data?.sinkron?.error || 'KB dipasang, tetapi KB belum tersinkron (baca ulang nanti).',
        gagal: !ok,
      });
      await loadData();
      await muatKatalogKb();
      setKbPilihInstansi({});
    } catch (err: any) {
      setSinkronHasil({
        judul: 'Gagal memasang KB',
        dokumenBaru: [],
        dokumenHilang: [],
        catatan: err?.message || 'Kesalahan jaringan',
        gagal: true,
      });
    } finally {
      setKbSedangPasang(null);
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

  const [menyimpanMenu, setMenyimpanMenu] = useState<string | null>(null);

  /**
   * Simpan daftar menu yang disembunyikan untuk satu instansi.
   *
   * Disimpan per instansi (Tenant.menuSembunyi) karena satu deployment melayani
   * banyak BUMD dengan kebutuhan modul berbeda. Server menyaring key yang tidak
   * dikenal, jadi payload di sini boleh apa adanya.
   */
  const simpanMenuInstansi = async (tenant: Tenant, sembunyi: string[]) => {
    setMenyimpanMenu(tenant.id);
    setGalatAksi(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuSembunyi: sembunyi }),
      });
      const hasil = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGalatAksi(hasil?.error || 'Tampilan menu instansi gagal disimpan.');
        return;
      }
      setTenants((prev) =>
        prev.map((t) => (t.id === tenant.id ? { ...t, menuSembunyi: hasil.menuSembunyi || [] } : t))
      );
      onTenantsRefreshed?.();
    } finally {
      setMenyimpanMenu(null);
    }
  };

  /** Nyalakan/matikan satu menu. */
  const ubahMenuInstansi = async (tenant: Tenant, key: string, tampil: boolean) => {
    const sembunyi = new Set(tenant.menuSembunyi || []);
    if (tampil) sembunyi.delete(key);
    else sembunyi.add(key);
    await simpanMenuInstansi(tenant, [...sembunyi]);
  };

  /** Sakelar borongan: matikan semua menu sekaligus, atau hidupkan semuanya. */
  const ubahSemuaMenu = async (tenant: Tenant, aktif: boolean) => {
    await simpanMenuInstansi(tenant, aktif ? [] : MENU_KINERJA.map((m) => m.key));
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

  // Auto-periksa saat admin MENGETIK KB ID. Isian yang terisi otomatis dari
  // konfigurasi tersimpan sengaja tidak memicu permintaan: halaman dibuka langsung
  // tenang, dan pemeriksaan berjalan saat admin memang memintanya.
  useEffect(() => {
    const kb = kbInput.trim();
    if (!kb) {
      setKbHasil(null);
      return;
    }
    if (kbIsiOtomatis.current) {
      kbIsiOtomatis.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void handleCekKb(kb);
    }, 700);
    return () => clearTimeout(timer);
  }, [kbInput]);

  /**
   * AUTO-ISI dari KB: satu-satunya isian di form ini adalah KB ID. Begitu diisi,
   * field lain (Nama, Kota, Sektor, Nama Singkat, Kode) diisi dari dokumen KB.
   *
   * Kalau pembacaan GAGAL (layanan RAG lambat/timeout) field TIDAK dikosongkan —
   * nilai yang sudah ada dibiarkan, dan admin diberi tahu lewat `tenantProfilGagal`
   * supaya bisa mengisi manual. Mengosongkan di sini dulu membuat tombol Simpan
   * mati tanpa penjelasan. Field hanya dikosongkan saat KB memang benar-benar kosong.
   */
  useEffect(() => {
    const kb = tenantKbId.trim();
    if (!kb) {
      setTenantKbInfo(null);
      setTenantProfilGagal(false);
      setTenantName('');
      setTenantCity('');
      setTenantShortName('');
      setTenantCode('');
      setTenantSector('pdam');
      return;
    }
    // Mode isi manual: lewati pembacaan KB sama sekali — admin mengisi sendiri,
    // dan fetch yang sedang berjalan dibatalkan lewat cleanup efek ini.
    if (tenantManual) {
      setTenantKbLoading(false);
      return;
    }
    let batal = false;
    setTenantKbLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/kb-profil?kb=${encodeURIComponent(kb)}`, {
          signal: AbortSignal.timeout(180000),
        });
        const data = await res.json();
        if (batal) return;
        setTenantKbInfo(data);
        const dariDokumen = !!data?.nama;
        if (dariDokumen) {
          setTenantName(data.nama);
          setTenantCity(data.kota || '');
          if (data.sektor) setTenantSector(data.sektor);
          // Nama singkat: ambil potongan nama instansi.
          setTenantShortName(String(data.nama).replace(/^Perumda\s+/i, '').slice(0, 24));
        } else if (data?.jumlahDokumen === 0) {
          // KB benar-benar kosong / ID salah — tidak ada yang bisa diisi.
          setTenantName('');
          setTenantCity('');
        }
        // Kode instansi selalu diturunkan dari KB ID (mis. kb_pam_jaya → KB_PAM_JAYA).
        setTenantCode(kb.toUpperCase());
        // Gagal terisi padahal KB punya dokumen = layanan lambat / dokumen belum
        // selesai diindeks. Tandai supaya UI menawarkan pengisian manual.
        setTenantProfilGagal(!dariDokumen && Number(data?.jumlahDokumen || 0) > 0);
      } catch {
        if (!batal) {
          setTenantKbInfo({
            kbId: kb,
            jumlahDokumen: 0,
            catatan: 'Tidak bisa menghubungi server untuk membaca KB.',
          });
          // Jangan kosongkan field: admin masih bisa mengisi manual lalu menyimpan.
          setTenantCode(kb.toUpperCase());
          setTenantProfilGagal(true);
        }
      } finally {
        if (!batal) setTenantKbLoading(false);
      }
    }, 800);
    return () => {
      batal = true;
      clearTimeout(timer);
    };
  }, [tenantKbId, tenantManual]);

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
          {galatAksi && (
            <div className="p-3 bg-neg/10 border border-neg/30 rounded-card text-neg text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-neg shrink-0 mt-0.5" />
              <span className="flex-1">{galatAksi}</span>
              <button
                onClick={() => setGalatAksi(null)}
                className="text-neg/70 hover:text-neg"
                aria-label="Tutup pesan galat"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
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
                      Instansi Terhubung
                    </h3>
                    <p className="text-xs text-ink-2">
                      Setiap instansi memiliki isolasi data dan pangkalan retrieval dokumen (KB) mandiri
                    </p>
                  </div>
                  <button
                    onClick={bukaTambahTenant}
                    className="px-3 py-1.5 bg-brand hover:brightness-95 text-on-brand rounded-control text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs"
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
                  className="px-3.5 py-2 bg-brand hover:brightness-95 text-on-brand rounded-control text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs self-start sm:self-auto"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Tambah Pengguna Baru</span>
                </button>
              </div>

              {/* Permintaan bergabung: pendaftaran manual & Google sama-sama harus
                  disetujui admin sebelum akunnya bisa dipakai masuk. */}
              {permintaanGabung.length > 0 && (
                <div className="border border-warn/40 bg-warn/5 rounded-card overflow-hidden">
                  <div className="px-3.5 py-2.5 border-b border-warn/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-warn" />
                      <span className="text-xs font-bold text-ink">
                        Permintaan Bergabung ({permintaanGabung.length})
                      </span>
                      <span className="text-[10px] text-ink-3">
                        pendaftaran manual dan Google menunggu persetujuan
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadData()}
                      className="p-1 rounded text-ink-3 hover:text-ink hover:bg-line/60 transition-colors"
                      title="Muat ulang permintaan"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="divide-y divide-warn/20">
                    {permintaanGabung.map((p) => (
                      <div key={p.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-ink">{p.name}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-chip font-semibold border ${
                                p.viaGoogle
                                  ? 'text-brand-ink bg-brand/10 border-brand/30'
                                  : 'text-ink-2 bg-surface-2 border-line'
                              }`}
                            >
                              {p.viaGoogle ? 'Google' : 'Kata sandi'}
                            </span>
                            {p.emailVerified && (
                              <span className="text-[10px] text-pos font-semibold">email terverifikasi</span>
                            )}
                          </div>
                          <p className="text-ink-2 mt-0.5 truncate">{p.email}</p>
                          <p className="text-[11px] text-ink-3">
                            {p.tenantName || p.tenantId}
                            {p.requestedAt
                              ? ` · ${new Date(p.requestedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}`
                              : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <select
                            value={rolePermintaan[p.id] || 'analis'}
                            onChange={(e) =>
                              setRolePermintaan((prev) => ({ ...prev, [p.id]: e.target.value as UserRole }))
                            }
                            className="text-[11px] px-2 py-1.5 border border-line rounded-control bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                            title="Peran saat disetujui"
                          >
                            <option value="analis">Analis</option>
                            <option value="direksi">Direksi</option>
                            <option value="admin">Administrator</option>
                          </select>
                          <button
                            type="button"
                            disabled={memproses === p.id}
                            onClick={() => void setujuiPermintaan(p)}
                            className="px-2.5 py-1.5 rounded-control bg-pos text-on-pos font-semibold text-[11px] hover:brightness-95 transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Setujui
                          </button>
                          <button
                            type="button"
                            disabled={memproses === p.id}
                            onClick={() => void tolakPermintaan(p)}
                            className="px-2.5 py-1.5 rounded-control border border-neg/40 text-neg font-semibold text-[11px] hover:bg-neg/10 transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            Tolak
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto border border-line rounded-card">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-2 text-ink-2 font-semibold border-b border-line">
                    <tr>
                      <th className="p-3">Nama Pengguna</th>
                      <th className="p-3">Email Instansi</th>
                      <th className="p-3">Peran (Role)</th>
                      <th className="p-3">Instansi</th>
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
                            {(u.status || 'active') !== 'active' && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-chip font-semibold border ${
                                  (u.status || 'active') === 'pending'
                                    ? 'text-warn bg-warn/10 border-warn/30'
                                    : 'text-neg bg-neg/10 border-neg/30'
                                }`}
                              >
                                {(u.status || 'active') === 'pending' ? 'Menunggu' : 'Ditolak'}
                              </span>
                            )}
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
                              <span className="text-ink-3">Tanpa instansi</span>
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
                    Instansi & Knowledge Base
                  </h3>
                  <p className="text-xs text-ink-2">
                    Kelola identitas instansi, kode, dan pangkalan dokumen retrieval (KB) yang dipakai
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
                  {/* Baca ulang KATALOG KB dari layanan RAG — supaya KB yang baru
                      ditambahkan di sumbernya langsung terlihat & bisa dipasang.
                      Namanya sengaja BUKAN "Perbarui RAG": tombol per-kartu instansi
                      di bawah juga bernama itu, tapi fungsinya lain (menyegarkan satu
                      instansi), jadi dua tombol berbeda nama itu wajib dipisah. */}
                  <button
                    onClick={bukaKatalogKb}
                    className="px-3.5 py-2 border border-line hover:bg-surface-2 text-ink-2 rounded-control text-xs font-medium transition-colors flex items-center gap-1.5"
                    title="Baca ulang daftar knowledge base dari layanan RAG (lihat KB yang baru muncul di sumbernya)"
                    data-testid="katalog-kb"
                  >
                    <Database className={`w-3.5 h-3.5 ${katalogLoading && katalogTerbuka ? 'animate-pulse' : ''}`} />
                    <span>Katalog KB</span>
                  </button>
                  <button
                    onClick={bukaTambahTenant}
                    className="px-3.5 py-2 bg-brand hover:brightness-95 text-on-brand rounded-control text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs"
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
                      {/* Ubah identitas & KB instansi ini — inti alur "1 akun = 1 BUMD":
                          admin menentukan instansi ini membaca dokumen dari KB mana. */}
                      <button
                        onClick={() => bukaEditTenant(t)}
                        className="px-3 py-1.5 border border-line hover:bg-surface-2 text-ink-2 rounded-control text-[11px] font-medium transition-colors flex items-center gap-1.5"
                        title="Ubah nama, kode, atau Knowledge Base instansi ini"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Ubah</span>
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
          {activeTab === 'menu' && (
            <div className="space-y-4" data-testid="tab-tampilan-menu">
              <div className="bg-surface p-5 rounded-card border border-line shadow-2xs">
                <h3 className="text-sm font-bold text-ink">Tampilan Menu Instansi</h3>
                <p className="text-xs text-ink-2 mt-1">
                  Pilih menu grup <span className="font-semibold">Kinerja &amp; Kepatuhan</span> yang tampil
                  untuk setiap instansi. Menu yang dimatikan hilang dari sidebar dan halamannya tidak bisa
                  dibuka lagi. Perubahan tersimpan begitu switch ditekan.{' '}
                  <span className="font-semibold">Instansi baru otomatis masuk dengan semua menu mati</span> —
                  nyalakan satu per satu setelah instansi itu siap dipakai.
                </p>
              </div>

              {tenants.length === 0 && (
                <div className="bg-surface p-5 rounded-card border border-line text-xs text-ink-2">
                  Belum ada instansi terdaftar.
                </div>
              )}

              {tenants.map((t) => {
                const sembunyi = t.menuSembunyi || [];
                const jumlahTampil = MENU_KINERJA.length - MENU_KINERJA.filter((m) => sembunyi.includes(m.key)).length;
                const sedangSimpan = menyimpanMenu === t.id;
                return (
                  <div
                    key={t.id}
                    className="bg-surface p-5 rounded-card border border-line shadow-2xs space-y-3"
                    data-testid={`menu-tenant-${t.id}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-ink">{t.name}</h4>
                        <p className="text-xs text-ink-2">
                          {t.code} · {t.sector.toUpperCase()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="text-[11px] px-2 py-0.5 rounded-chip border border-line text-ink-2">
                          {jumlahTampil}/{MENU_KINERJA.length} menu tampil
                        </span>
                        <button
                          type="button"
                          onClick={() => void ubahSemuaMenu(t, jumlahTampil === 0)}
                          disabled={sedangSimpan}
                          className={`px-3 py-1.5 rounded-control text-[11px] font-semibold border transition-colors disabled:opacity-60 ${
                            jumlahTampil === 0
                              ? 'border-brand/40 text-brand hover:bg-brand/10'
                              : 'border-line text-ink-2 hover:bg-surface-2'
                          }`}
                          title={
                            jumlahTampil === 0
                              ? 'Tampilkan lagi seluruh menu Kinerja & Kepatuhan'
                              : 'Sembunyikan seluruh menu Kinerja & Kepatuhan untuk instansi ini'
                          }
                        >
                          {jumlahTampil === 0 ? 'Aktifkan semua' : 'Nonaktifkan semua'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {MENU_KINERJA.map((m) => {
                        const tampil = !sembunyi.includes(m.key);
                        return (
                          <button
                            key={m.key}
                            type="button"
                            role="switch"
                            aria-checked={tampil}
                            aria-label={`${tampil ? 'Sembunyikan' : 'Tampilkan'} ${m.label}`}
                            disabled={sedangSimpan}
                            onClick={() => void ubahMenuInstansi(t, m.key, !tampil)}
                            className={`flex items-start gap-3 p-3 rounded-control border text-left transition-colors disabled:opacity-60 ${
                              tampil ? 'border-line bg-surface hover:bg-surface-2' : 'border-line bg-surface-2 hover:bg-surface'
                            }`}
                          >
                            <span
                              className={`w-9 h-5 rounded-full shrink-0 relative mt-0.5 transition-colors ${
                                tampil ? 'bg-brand' : 'bg-line'
                              }`}
                            >
                              <span
                                className="absolute top-0.5 w-4 h-4 rounded-full bg-surface transition-all"
                                style={{ left: tampil ? 18 : 2 }}
                              />
                            </span>
                            <span className="min-w-0">
                              <span className={`block text-xs font-semibold ${tampil ? 'text-ink' : 'text-ink-3'}`}>
                                {m.label}
                              </span>
                              <span className="block text-[11px] text-ink-2 leading-snug">{m.ket}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'rag' && systemConfig && (() => {
            const modeHttp = systemConfig.ragProvider === 'http';
            const berubah = jejakCfg(systemConfig) !== cfgTersimpan;
            const kunciKosong = modeHttp && !String(systemConfig.ragApiKey || '').trim();
            return (
              <div className={`space-y-4 ${berubah ? 'pb-24' : ''}`} data-testid="tab-rag">
                {/* ---------- RINGKASAN: sedang pakai apa, sehat atau tidak ---------- */}
                <div className="bg-surface p-5 rounded-card border border-line shadow-2xs space-y-3">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 min-w-0">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-chip ${
                          modeHttp ? 'bg-pos/15 text-pos' : 'bg-warn/15 text-warn'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${modeHttp ? 'bg-pos' : 'bg-warn'}`} />
                        {modeHttp ? 'MODE LAYANAN RAG' : 'MODE DEMO'}
                      </span>
                      <p className="text-sm font-bold text-ink break-all">
                        {modeHttp
                          ? systemConfig.ragApiUrl || 'Alamat layanan belum diisi'
                          : 'Data contoh lokal, tanpa panggilan ke layanan luar'}
                      </p>
                      <p className="text-xs text-ink-2">
                        KB default{' '}
                        <span className="font-semibold text-ink">
                          {systemConfig.ragKnowledgeBaseId || 'belum diset'}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleProbeRag}
                        disabled={probeLoading}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface border border-line-strong hover:bg-surface-2 text-brand-ink rounded-control font-semibold text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {probeLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        {probeLoading ? 'Menguji…' : 'Uji koneksi'}
                      </button>
                    </div>
                  </div>

                  {saveSuccess && (
                    <div className="p-3 bg-pos/15 border border-pos/30 rounded-card text-pos text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-pos shrink-0" />
                      <span>Pengaturan tersimpan dan langsung dipakai.</span>
                    </div>
                  )}

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
                            <span className="text-pos">RAG berjalan normal ({probeResult.latencyMs} ms)</span>
                          </>
                        ) : probeResult.status === 'degraded' ? (
                          <>
                            <AlertTriangle className="w-4 h-4 text-warn" />
                            <span className="text-warn">RAG merespons, tetapi terbatas ({probeResult.latencyMs} ms)</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 text-neg" />
                            <span className="text-neg">Koneksi RAG gagal</span>
                          </>
                        )}
                      </div>
                      {probeResult.peringatan && (
                        <p className="text-warn font-semibold flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>{probeResult.peringatan}</span>
                        </p>
                      )}
                      {probeResult.modeDetected && (
                        <p className="text-ink-2">
                          Mode terdeteksi: <strong>{probeResult.modeDetected}</strong>
                          {typeof probeResult.sampleChunksCount === 'number' && (
                            <> · potongan dokumen terambil: <strong>{probeResult.sampleChunksCount}</strong></>
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

                {/* ---------- LANGKAH 1 ---------- */}
                <section className="bg-surface p-5 rounded-card border border-line shadow-2xs space-y-3">
                  <header className="flex items-start gap-2.5">
                    <span className="inline-grid place-items-center w-6 h-6 rounded-full bg-brand text-on-brand text-[11px] font-black shrink-0 mt-0.5">1</span>
                    <div>
                      <h4 className="text-sm font-bold text-ink">Pilih sumber data</h4>
                      <p className="text-xs text-ink-2 mt-0.5">Menentukan dari mana angka dashboard diambil.</p>
                    </div>
                  </header>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSystemConfig({ ...systemConfig, ragProvider: 'mock' })}
                      aria-pressed={!modeHttp}
                      data-testid="mode-demo"
                      className={`text-left p-4 rounded-control border transition-colors ${
                        !modeHttp ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong bg-surface'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-ink flex items-center gap-2">
                          <Database className="w-4 h-4 text-brand-ink" /> Demo lokal
                        </span>
                        <span
                          className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                            !modeHttp ? 'border-brand bg-brand' : 'border-line-strong'
                          }`}
                        />
                      </div>
                      <p className="text-xs text-ink-2 mt-2 leading-relaxed">
                        Data contoh bawaan. Cepat, tanpa internet, cocok untuk mencoba alur aplikasi.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSystemConfig({ ...systemConfig, ragProvider: 'http' })}
                      aria-pressed={modeHttp}
                      data-testid="mode-rag"
                      className={`text-left p-4 rounded-control border transition-colors ${
                        modeHttp ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong bg-surface'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-ink flex items-center gap-2">
                          <Server className="w-4 h-4 text-brand-ink" /> Layanan RAG
                        </span>
                        <span
                          className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                            modeHttp ? 'border-brand bg-brand' : 'border-line-strong'
                          }`}
                        />
                      </div>
                      <p className="text-xs text-ink-2 mt-2 leading-relaxed">
                        Angka diambil dari dokumen instansi melalui API RAG, lengkap dengan halaman sumber.
                      </p>
                    </button>
                  </div>
                  {!modeHttp && (systemConfig.ragApiUrl || systemConfig.ragApiKey) && (
                    <p className="text-xs text-warn flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>Alamat dan kunci sudah tersimpan, tetapi tidak dipakai selama mode demo aktif.</span>
                    </p>
                  )}
                </section>

                {/* ---------- LANGKAH 2 ---------- */}
                <section
                  className={`bg-surface p-5 rounded-card border border-line shadow-2xs space-y-4 ${
                    modeHttp ? '' : 'opacity-60'
                  }`}
                >
                  <header className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="inline-grid place-items-center w-6 h-6 rounded-full bg-brand text-on-brand text-[11px] font-black shrink-0 mt-0.5">2</span>
                      <div>
                        <h4 className="text-sm font-bold text-ink">Alamat &amp; kunci layanan</h4>
                        <p className="text-xs text-ink-2 mt-0.5">Hanya dipakai pada mode layanan RAG.</p>
                      </div>
                    </div>
                    {!modeHttp && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-chip bg-surface-2 text-ink-3 shrink-0">
                        TIDAK AKTIF
                      </span>
                    )}
                  </header>

                  <div>
                    <label className="label" htmlFor="ragUrl">Base URL layanan</label>
                    <input
                      id="ragUrl"
                      type="text"
                      disabled={!modeHttp}
                      placeholder="https://rag.contoh.go.id/api/v1"
                      value={systemConfig.ragApiUrl || ''}
                      onChange={(e) => setSystemConfig({ ...systemConfig, ragApiUrl: e.target.value })}
                      className="field-lg font-mono text-xs disabled:cursor-not-allowed"
                      data-testid="input-rag-url"
                    />
                    <p className="text-xs text-ink-3 mt-1">
                      Tulis lengkap sampai <span className="font-mono">/api/v1</span>. Kalau hanya domain,
                      aplikasi menambahkan <span className="font-mono">/api/v1</span> sendiri.
                    </p>
                  </div>

                  <div>
                    <label className="label" htmlFor="ragKey">API key</label>
                    <div className="relative">
                      <input
                        id="ragKey"
                        type={tampilKunci ? 'text' : 'password'}
                        disabled={!modeHttp}
                        placeholder="tempel API key di sini"
                        value={systemConfig.ragApiKey || ''}
                        onChange={(e) => setSystemConfig({ ...systemConfig, ragApiKey: e.target.value })}
                        className="field-lg font-mono text-xs pr-11 disabled:cursor-not-allowed"
                        data-testid="input-rag-key"
                      />
                      <button
                        type="button"
                        onClick={() => setTampilKunci((v) => !v)}
                        disabled={!modeHttp}
                        aria-label={tampilKunci ? 'Sembunyikan kunci' : 'Tampilkan kunci'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-ink-3 hover:bg-surface-2 disabled:opacity-40"
                      >
                        {tampilKunci ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-ink-3 mt-1">
                      {String(systemConfig.ragApiKey || '')
                        ? 'Nilai tersimpan tampil bertopeng. Ganti hanya kalau kuncinya memang berubah.'
                        : 'Belum ada kunci tersimpan untuk layanan ini.'}
                    </p>
                    {kunciKosong && (
                      <p className="text-[11px] font-semibold text-neg mt-1">
                        Mode layanan RAG butuh API key. Isi dulu sebelum menyimpan.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSimpanUjiKey}
                      disabled={keyTestLoading || !modeHttp || kunciKosong}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-line-strong hover:bg-surface-2 text-brand-ink rounded-control font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {keyTestLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      {keyTestLoading ? 'Menguji…' : 'Uji kunci ini'}
                    </button>
                    <span className="text-xs text-ink-3 max-w-sm">
                      Menyimpan perubahan di halaman ini lebih dulu, lalu memanggil layanan untuk memastikan
                      kuncinya benar-benar diterima.
                    </span>
                  </div>

                  {keyTestHasil && (
                    <div
                      className={`p-3 rounded-card border text-[11px] flex items-start gap-2 ${
                        keyTestHasil.ok ? 'bg-pos/15 border-pos/30 text-pos' : 'bg-neg/15 border-neg/30 text-neg'
                      }`}
                    >
                      {keyTestHasil.ok ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <div className="font-semibold">{keyTestHasil.ok ? 'Kunci diterima' : 'Kunci bermasalah'}</div>
                        <div className="text-ink-2">{keyTestHasil.pesan}</div>
                        {keyTestHasil.kodeGalat && (
                          <div className="text-ink-3 font-mono">Kode: {keyTestHasil.kodeGalat}</div>
                        )}
                        {keyTestHasil.baseDipakai && (
                          <div className="text-ink-3 font-mono break-all">Diuji ke: {keyTestHasil.baseDipakai}</div>
                        )}
                      </div>
                    </div>
                  )}
                </section>

                {/* ---------- LANGKAH 3: KNOWLEDGE BASE ---------- */}
                <section className="bg-surface p-5 rounded-card border border-line shadow-2xs space-y-3">
                  <header className="flex items-start gap-2.5">
                    <span className="inline-grid place-items-center w-6 h-6 rounded-full bg-brand text-on-brand text-[11px] font-black shrink-0 mt-0.5">3</span>
                    <div>
                      <h4 className="text-sm font-bold text-ink">Knowledge Base default</h4>
                      <p className="text-xs text-ink-2 mt-0.5">
                        KB yang dipakai instansi tanpa KB sendiri. Isinya bisa diperiksa dulu sebelum dipakai.
                      </p>
                    </div>
                  </header>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <label className="label" htmlFor="kbDefault">Knowledge Base ID</label>
                      <input
                        id="kbDefault"
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
                        className="field-lg font-mono text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCekKb()}
                      disabled={kbLoading || !kbInput.trim()}
                      className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 bg-surface border border-line-strong hover:bg-surface-2 text-brand-ink rounded-control font-semibold text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`w-4 h-4 ${kbLoading ? 'animate-spin' : ''}`} />
                      {kbLoading ? 'Memeriksa…' : 'Periksa isi'}
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
                          const baru = { ...systemConfig, ragKnowledgeBaseId: kb };
                          setSystemConfig(baru);
                          setCfgTersimpan(jejakCfg(baru));
                          setSaveSuccess(true);
                          setTimeout(() => setSaveSuccess(false), 2500);
                        }
                      }}
                      disabled={!kbInput.trim()}
                      className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 bg-brand hover:brightness-95 text-on-brand rounded-control font-semibold text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      title="Simpan KB ini sebagai Knowledge Base default aplikasi"
                    >
                      <Check className="w-4 h-4" />
                      Jadikan default
                    </button>
                  </div>

                  <p className="text-xs text-ink-3">
                    KB khusus satu instansi diatur di tab <strong>Instansi &amp; KB</strong>, bukan di sini.
                  </p>

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
                                KB <span className="font-mono">{kbHasil.kbId}</span> memuat {kbHasil.jumlah} dokumen
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
                              {kbHasil.dokumen.map((d: any, i: number) => (
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
                </section>

                {/* ---------- KMS (terpisah, dilipat) ---------- */}
                <details
                  className="bg-surface rounded-card border border-line shadow-2xs overflow-hidden"
                  open={Boolean(systemConfig.kmsApiUrl)}
                  data-testid="konfigurasi-kms"
                >
                  <summary className="px-5 py-4 cursor-pointer flex items-center justify-between gap-3 select-none">
                    <span className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-brand" />
                      <span className="text-sm font-bold text-ink">Opsional · KMS repositori berkas</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-chip bg-surface-2 text-ink-3">
                      {systemConfig.kmsApiUrl ? 'TERISI' : 'BELUM DIISI'}
                    </span>
                  </summary>
                  <div className="px-5 pb-5 space-y-3 border-t border-line pt-4">
                    <p className="text-xs text-ink-2">
                      Penyimpanan berkas untuk menu <strong>Manajemen Berkas</strong>. Satu API key KMS bisa
                      mengakses banyak project, jadi tiap instansi dipetakan ke satu project di tab{' '}
                      <strong>Instansi &amp; KB</strong>.
                    </p>
                    <div>
                      <label className="label" htmlFor="kmsUrl">Base URL KMS</label>
                      <input
                        id="kmsUrl"
                        type="text"
                        placeholder="https://ragkms.aiones.app"
                        value={systemConfig.kmsApiUrl || ''}
                        onChange={(e) => setSystemConfig({ ...systemConfig, kmsApiUrl: e.target.value })}
                        className="field-lg font-mono text-xs"
                        data-testid="input-kms-url"
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="kmsKey">API key KMS</label>
                      <input
                        id="kmsKey"
                        type="password"
                        placeholder="tempel API key KMS di sini"
                        value={systemConfig.kmsApiKey || ''}
                        onChange={(e) => setSystemConfig({ ...systemConfig, kmsApiKey: e.target.value })}
                        className="field-lg font-mono text-xs"
                        data-testid="input-kms-key"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleSimpanUjiKms}
                        disabled={kmsLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-line-strong hover:bg-surface-2 text-brand-ink rounded-control font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid="uji-kms"
                      >
                        {kmsLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        {kmsLoading ? 'Menguji…' : 'Simpan & uji KMS'}
                      </button>
                      <span className="text-xs text-ink-3">
                        Menyimpan lalu membaca daftar project dari KMS, bukan sekadar menyimpan.
                      </span>
                    </div>
                    {kmsHasil && (
                      <div
                        className={`p-3 rounded-card border text-[11px] flex items-start gap-2 ${
                          kmsHasil.ok ? 'bg-pos/15 border-pos/30 text-pos' : 'bg-neg/15 border-neg/30 text-neg'
                        }`}
                        data-testid="hasil-uji-kms"
                      >
                        {kmsHasil.ok ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        )}
                        <span>{kmsHasil.pesan}</span>
                      </div>
                    )}
                  </div>
                </details>

                {/* ---------- BILAH SIMPAN: hanya muncul kalau memang ada perubahan ---------- */}
                {berubah && (
                  <div className="sticky bottom-3 z-10">
                    <div className="bg-surface px-4 py-3 rounded-card border border-line-strong flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-pop">
                      <p className="text-xs text-warn font-semibold">Ada perubahan yang belum disimpan.</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void loadData()}
                          className="px-4 py-2 btn-ghost text-xs font-semibold"
                        >
                          Muat ulang
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSaveConfig()}
                          disabled={kunciKosong}
                          className="px-4 py-2 btn-primary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                          data-testid="simpan-rag"
                        >
                          Simpan pengaturan
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

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

                      <div className="shrink-0 flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-chip border ${
                            rule.isActive
                              ? 'text-pos bg-pos/15 border-pos/30'
                              : 'text-ink-3 bg-surface border-line'
                          }`}
                        >
                          <Check className="w-3 h-3" /> {rule.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                        <button
                          type="button"
                          title={rule.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          onClick={() => void ubahAturanAlert(rule, { isActive: !rule.isActive })}
                          className="p-1.5 rounded-chip text-ink-3 hover:text-ink hover:bg-line/60 transition-colors"
                        >
                          <Radio className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Ubah ambang batas"
                          onClick={() => {
                            const nilai = window.prompt(
                              `Ambang batas baru untuk "${rule.metricName}" (saat ini ${rule.operator} ${rule.threshold} ${rule.unit}):`,
                              String(rule.threshold)
                            );
                            if (nilai === null) return;
                            const angka = Number(nilai.replace(',', '.'));
                            if (!Number.isFinite(angka)) {
                              alert('Ambang batas harus berupa angka.');
                              return;
                            }
                            void ubahAturanAlert(rule, { threshold: angka });
                          }}
                          className="p-1.5 rounded-chip text-brand hover:bg-brand/10 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Hapus aturan"
                          onClick={() => void hapusAturanAlert(rule)}
                          className="p-1.5 rounded-chip text-neg hover:bg-neg/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
          <div className="modal-layer">
            <div className="scrim" onClick={() => setIsAddUserOpen(false)} />
            <div role="dialog" aria-modal="true" aria-labelledby="add-user-title" className="relative w-full max-w-md bg-surface rounded-card shadow-2xl border border-line p-5 z-10 text-xs space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h3 id="add-user-title" className="font-bold text-sm text-ink">Tambah Pengguna BUMD Baru</h3>
                <button onClick={() => setIsAddUserOpen(false)} className="text-ink-3 hover:text-ink-2">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-3">
                <div>
                  <label className="label">Nama Lengkap</label>
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
                  <label className="label">Email Resmi</label>
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
                  <label className="label">Peran Hak Akses (Role)</label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as UserRole)}
                    className="field-lg"
                  >
                    <option value="analis">Analis Kinerja (Dapat membuat & mengedit dashboard)</option>
                    <option value="direksi">Direksi / Pengawas (Hak akses lihat & terima laporan)</option>
                    <option value="admin">Administrator Sistem (Akses penuh tata kelola)</option>
                  </select>
                </div>

                <div>
                  <label className="label">Penugasan Instansi BUMD</label>
                  <select
                    value={userTenantId}
                    onChange={(e) => setUserTenantId(e.target.value)}
                    className="field-lg"
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
                    className="px-4 py-2 bg-brand hover:brightness-95 text-on-brand rounded-control font-medium"
                  >
                    Daftarkan Pengguna
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL TAMBAH/UBAH INSTANSI ================= */}
        {isAddTenantOpen && (
          <div className="modal-layer">
            <div className="scrim" onClick={tutupModalTenant} />
            <div role="dialog" aria-modal="true" aria-labelledby="add-tenant-title" className="relative w-full max-w-md bg-surface rounded-card shadow-2xl border border-line p-5 z-10 text-xs space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h3 id="add-tenant-title" className="font-bold text-sm text-ink">
                  {editTenantId ? 'Ubah Instansi & Knowledge Base' : 'Daftarkan Instansi BUMD Baru'}
                </h3>
                <button onClick={tutupModalTenant} className="text-ink-3 hover:text-ink-2">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateTenant} className="space-y-3">
                {/* KB ID paling atas: begitu ditempel, field di bawah terisi otomatis
                    dari dokumen KB (nama, kota, sektor, jumlah dokumen). */}
                <div className="p-3 bg-surface-2 border border-line rounded-card space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <label className="block text-ink-2 font-medium">
                      Knowledge Base ID <span className="font-normal text-ink-3">(isi ini dulu — sisanya terisi otomatis)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setTenantManual((v) => !v)}
                      className="shrink-0 text-[11px] text-brand-ink hover:underline"
                      title={
                        tenantManual
                          ? 'Coba baca nama/kota dari dokumen KB lagi'
                          : 'Isi nama/kota manual tanpa menunggu layanan RAG'
                      }
                    >
                      {tenantManual ? 'Baca otomatis dari KB' : 'Isi manual'}
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Contoh: kb_pam_jaya"
                    value={tenantKbId}
                    onChange={(e) => {
                      setTenantKbId(e.target.value);
                      // KB baru = coba baca otomatis lagi (keluar dari mode manual).
                      setTenantManual(false);
                    }}
                    className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand font-mono"
                  />
                  {tenantKbLoading && !tenantManual && (
                    <p className="text-[11px] text-ink-2 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Membaca dokumen KB…
                    </p>
                  )}
                  {tenantManual && (
                    <p className="text-[11px] text-ink-3">
                      Mode isi manual aktif: field di bawah Anda isi sendiri. Klik “Baca otomatis dari KB”
                      untuk mencoba membaca dari dokumen lagi.
                    </p>
                  )}
                  {!tenantKbLoading && tenantKbInfo && (
                    <div
                      className={`text-[11px] rounded-control p-2 border ${
                        tenantKbInfo.jumlahDokumen > 0 && !tenantProfilGagal
                          ? 'bg-pos/15 border-pos/30 text-pos'
                          : 'bg-warn/15 border-warn/30 text-warn'
                      }`}
                    >
                      <span className="font-semibold">
                        {tenantKbInfo.jumlahDokumen > 0
                          ? tenantProfilGagal
                            ? `${tenantKbInfo.jumlahDokumen} dokumen ditemukan, tetapi nama/kota belum bisa dibaca otomatis — isi manual di bawah.`
                            : `${tenantKbInfo.jumlahDokumen} dokumen ditemukan — field di bawah sudah terisi otomatis.`
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

                {/* Project KMS: tujuan unggah berkas menu "Manajemen Berkas". */}
                <div className="p-3 bg-surface-2 border border-line rounded-card space-y-2" data-testid="pemetaan-kms">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-ink-2 font-medium">
                      Repositori Dokumen <span className="font-normal text-ink-3">(tujuan unggah berkas)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => void muatKmsOrganisasi()}
                      className="text-[11px] text-brand-ink hover:underline inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Muat daftar project
                    </button>
                  </div>
                  {kmsOrganisasi.length > 0 ? (
                    <select
                      value={tenantKmsOrgId}
                      onChange={(e) => setTenantKmsOrgId(e.target.value)}
                      className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand"
                      data-testid="pilih-kms-org"
                    >
                      <option value="">(belum dipetakan — berkas tidak bisa diunggah)</option>
                      {kmsOrganisasi.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} — {o.id}
                          {o.knowledgeBase ? ` (${o.knowledgeBase})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="mis. org-1791512468154 (tekan “Muat daftar project” untuk memilih)"
                      value={tenantKmsOrgId}
                      onChange={(e) => setTenantKmsOrgId(e.target.value)}
                      className="w-full px-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand font-mono"
                      data-testid="input-kms-org"
                    />
                  )}
                  <p className="text-[10px] text-ink-3">
                    Satu API key KMS melayani banyak project. Berkas yang diunggah ke project ini otomatis
                    terindeks ke RAG sehingga bisa dipakai chat &amp; dashboard instansi.
                  </p>
                </div>

                {/* Field lain terisi otomatis dari dokumen KB, TETAPI tetap bisa
                    disunting manual — ini jalan keluar saat layanan RAG lambat
                    atau dokumen belum selesai diindeks. */}
                <div className="space-y-2">
                  <p className="text-[10px] text-ink-3">
                    Nilai di bawah dibaca dari dokumen KB dan bisa Anda ubah manual bila perlu.
                  </p>
                  <BarisOtomatis
                    label="Nama Resmi BUMD"
                    nilai={tenantName}
                    onChange={setTenantName}
                    placeholder="mis. Perumda Air Minum Tirta Raharja"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <BarisOtomatis
                      label="Nama Singkat"
                      nilai={tenantShortName}
                      onChange={setTenantShortName}
                      placeholder="mis. Tirta Raharja"
                    />
                    <BarisOtomatis
                      label="Kode Instansi"
                      nilai={tenantCode}
                      onChange={setTenantCode}
                      placeholder="mis. KB_PAM_JAYA"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-ink-3 mb-0.5">Sektor</label>
                      <select
                        value={tenantSector}
                        onChange={(e) => setTenantSector(e.target.value as BumdSector)}
                        className="w-full px-3 py-2 border border-line rounded-control bg-surface text-ink min-h-[34px] focus:outline-none focus:ring-1 focus:ring-brand"
                      >
                        {(Object.keys(LABEL_SEKTOR) as BumdSector[]).map((s) => (
                          <option key={s} value={s}>
                            {LABEL_SEKTOR[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <BarisOtomatis
                      label="Kota / Kabupaten"
                      nilai={tenantCity}
                      onChange={setTenantCity}
                      placeholder="mis. Bandung"
                    />
                  </div>
                </div>

                {tenantSaveError && (
                  <div className="text-[11px] rounded-control p-2 border bg-neg/15 border-neg/30 text-neg flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{tenantSaveError}</span>
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={tutupModalTenant}
                    className="px-4 py-2 border border-line rounded-control text-ink-2 hover:bg-surface-2"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={tenantSaving || (tenantKbLoading && !tenantManual)}
                    className="px-4 py-2 bg-brand hover:brightness-95 text-on-brand rounded-control font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
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

        {/* ================= PANEL KATALOG KB (PERBARUI RAG) ================= */}
        {katalogTerbuka && (
          <div className="modal-layer">
            <div
              className="scrim"
              onClick={() => setKatalogTerbuka(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="katalog-kb-title"
              className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-surface rounded-card shadow-2xl border border-line z-10 text-xs"
              data-testid="panel-katalog-kb"
            >
              {/* Kepala */}
              <div className="flex items-start justify-between gap-3 border-b border-line p-5 pb-3">
                <div className="min-w-0">
                  <h3 id="katalog-kb-title" className="font-bold text-sm text-ink">
                    Katalog Knowledge Base — Sumber RAG
                  </h3>
                  <p className="text-[10px] text-ink-3 mt-0.5 truncate">
                    Dibaca langsung dari {katalog?.baseUrl || 'layanan RAG'} · {katalogLoading ? 'memuat…' : 'data terkini'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => void muatKatalogKb()}
                    disabled={katalogLoading}
                    className="px-3 py-1.5 border border-line hover:bg-surface-2 text-ink-2 rounded-control font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    data-testid="katalog-muat-ulang"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${katalogLoading ? 'animate-spin' : ''}`} />
                    Muat ulang
                  </button>
                  <button
                    onClick={() => setKatalogTerbuka(false)}
                    className="text-ink-3 hover:text-ink-2 p-1"
                    aria-label="Tutup"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Penyaring */}
              <div className="px-5 py-3 border-b border-line flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
                  <input
                    type="text"
                    value={katalogCari}
                    onChange={(e) => setKatalogCari(e.target.value)}
                    placeholder="Cari ID knowledge base…"
                    className="w-full pl-8 pr-3 py-1.5 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand"
                    data-testid="katalog-cari"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-ink-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={katalogHanyaBelum}
                    onChange={(e) => setKatalogHanyaBelum(e.target.checked)}
                    className="rounded border-line"
                  />
                  Hanya yang belum dipakai
                </label>
              </div>

              {/* Isi */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {katalogLoading && !katalog && (
                  <div className="py-12 text-center text-ink-3 flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Membaca daftar KB dari layanan RAG…
                  </div>
                )}

                {katalogGalat && (
                  <div
                    className="rounded-card border border-warn/40 bg-warn/10 p-3 text-warn"
                    data-testid="katalog-galat"
                  >
                    <p className="font-semibold">Daftar KB tidak bisa dibaca</p>
                    <p className="mt-1 text-[11px] leading-relaxed">{katalogGalat}</p>
                  </div>
                )}

                {katalog && (
                  <>
                    {/* Ringkasan */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {[
                        { label: 'Total KB', nilai: katalog.ringkasan?.totalKb ?? 0, tegas: false },
                        { label: 'Dokumen', nilai: katalog.ringkasan?.totalDokumen ?? 0, tegas: false },
                        { label: 'Dipakai', nilai: katalog.ringkasan?.terpakai ?? 0, tegas: false },
                        { label: 'Siap dipakai', nilai: katalog.ringkasan?.tersedia ?? 0, tegas: false },
                        { label: 'KB baru', nilai: katalog.ringkasan?.baru ?? 0, tegas: true },
                        { label: 'Perlu dicek', nilai: katalog.ringkasan?.perluDicek ?? 0, tegas: false },
                      ].map((s) => (
                        <div key={s.label} className="border border-line rounded-control px-3 py-2 bg-surface-2">
                          <div className={`font-bold text-sm ${s.tegas ? 'text-brand' : 'text-ink'}`}>
                            {angkaId(s.nilai)}
                          </div>
                          <div className="text-[10px] text-ink-3">{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {(() => {
                      const grup: Array<{ judul: string; ket: string; isi: any[]; warn: boolean }> = [
                        {
                          judul: 'Siap dipakai',
                          ket: 'KB di layanan RAG yang belum terpasang ke instansi mana pun.',
                          isi: katalog.kelompok?.tersedia || [],
                          warn: false,
                        },
                        {
                          judul: 'Sudah dipakai instansi',
                          ket: 'KB yang sedang jadi sumber data instansi.',
                          isi: katalog.kelompok?.terpakai || [],
                          warn: false,
                        },
                        {
                          judul: 'Perlu dicek dulu',
                          ket: 'Tampak seperti sisa demo/uji atau penulisan ganda dari KB yang sudah ada.',
                          isi: katalog.kelompok?.perluDicek || [],
                          warn: true,
                        },
                      ];
                      return grup.map((g) => {
                        const isi = g.isi.filter((k) => cocokBarisKb(k, katalogCari, katalogHanyaBelum));
                        if (isi.length === 0) return null;
                        return (
                          <div key={g.judul}>
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className={`font-bold ${g.warn ? 'text-warn' : 'text-ink'}`}>{g.judul}</h4>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-chip bg-surface-2 border border-line text-ink-3">
                                {isi.length}
                              </span>
                            </div>
                            <p className="text-[10px] text-ink-3 mb-2">{g.ket}</p>
                            <div className="space-y-2">
                              {isi.map((k) => {
                                const tgl = tanggalRingkas(k.updatedAt);
                                const terpilih = kbPilihInstansi[k.knowledgeBaseId] || '';
                                const sedang = kbSedangPasang === k.knowledgeBaseId;
                                return (
                                  <div
                                    key={k.knowledgeBaseId}
                                    className={`border rounded-control p-3 ${g.warn ? 'border-warn/40 bg-warn/5' : 'border-line bg-surface'}`}
                                    data-testid={`kb-${k.knowledgeBaseId}`}
                                  >
                                    <div className="flex items-start justify-between gap-2 flex-wrap">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-mono text-[11px] font-semibold text-ink break-all">
                                            {k.knowledgeBaseId}
                                          </span>
                                          {k.baru && (
                                            <span className="px-1.5 py-0.5 rounded-chip bg-brand-soft text-brand font-semibold text-[10px]">
                                              Baru
                                            </span>
                                          )}
                                          {Number(k.failed) > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-chip bg-warn/10 text-warn font-semibold text-[10px]">
                                              {angkaId(k.failed)} gagal
                                            </span>
                                          )}
                                          {Number(k.processing) > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-chip bg-surface-2 border border-line text-ink-3 text-[10px]">
                                              {angkaId(k.processing)} diproses
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-ink-3 mt-1">
                                          {angkaId(k.documents)} dokumen · {angkaId(k.chunks)} potongan ·{' '}
                                          {angkaId(k.tokens)} token
                                          {tgl ? ` · diperbarui ${tgl}` : ''}
                                        </div>
                                      </div>

                                      {k.terpakai ? (
                                        <div className="text-[10px] text-ink-2 shrink-0 text-right">
                                          <span className="text-ink-3">Dipakai oleh</span>
                                          <div className="font-medium">
                                            {k.dipakaiOleh.map((p: any) => p.nama).join(', ')}
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>

                                    {k.alasanPerluDicek?.length > 0 && (
                                      <div className="mt-2 text-[10px] text-warn">
                                        {k.alasanPerluDicek.join(' · ')}
                                      </div>
                                    )}

                                    {!k.terpakai && (
                                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                                        <select
                                          value={terpilih}
                                          onChange={(e) =>
                                            setKbPilihInstansi((s) => ({
                                              ...s,
                                              [k.knowledgeBaseId]: e.target.value,
                                            }))
                                          }
                                          className="flex-1 min-w-[180px] px-2.5 py-1.5 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand"
                                          data-testid={`pilih-instansi-${k.knowledgeBaseId}`}
                                        >
                                          <option value="">Pasang ke instansi…</option>
                                          {tenants.map((t) => (
                                            <option key={t.id} value={t.id}>
                                              {t.name}
                                              {t.knowledgeBaseId ? ` (kini: ${t.knowledgeBaseId})` : ''}
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          onClick={() => void pasangKbKeInstansi(k.knowledgeBaseId)}
                                          disabled={!terpilih || sedang}
                                          className="px-3 py-1.5 bg-brand hover:brightness-95 text-on-brand rounded-control font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                                          data-testid={`pakai-${k.knowledgeBaseId}`}
                                        >
                                          {sedang ? (
                                            <>
                                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                              Memasang…
                                            </>
                                          ) : (
                                            'Pakai'
                                          )}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()}

                    {(() => {
                      const adaIsi = [
                        ...(katalog.kelompok?.tersedia || []),
                        ...(katalog.kelompok?.terpakai || []),
                        ...(katalog.kelompok?.perluDicek || []),
                      ].some((k) => cocokBarisKb(k, katalogCari, katalogHanyaBelum));
                      if (adaIsi) return null;
                      return (
                        <div className="py-8 text-center text-ink-3">
                          Tidak ada KB yang cocok dengan penyaring ini.
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
