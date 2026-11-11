import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ModalKonfirmasiDashboard } from './components/ModalKonfirmasiDashboard';
import {
  Activity,
  AlertCircle,
  Building2,
  CheckCircle,
  Clock,
  EllipsisVertical,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  LayoutGrid,
  Trash2,
  LogOut,
  Maximize2,
  Menu,
  Palette,
  Presentation,
  Printer,
  Search,
  Share2,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { ChatPanel } from './components/ChatPanel';
import { PemberitahuanVersi } from './components/PemberitahuanVersi';
import { DashboardCanvas } from './components/DashboardCanvas';
import { PanelAiMenyusun } from './components/PanelAiMenyusun';
import { KursorAi } from './components/KursorAi';
import { AKSEN_TEMA, KanvasTemaContext, MODE_TEMA } from './theme';
import { ExportModal } from './components/ExportModal';
import { ImportDataModal } from './components/ImportDataModal';
import { ShareModal } from './components/ShareModal';
import { Sidebar } from './components/Sidebar';
import { isAdminRole } from './services/auth/peran';
import { ADMIN_TABS, AdminTabId } from './components/adminTabs';
import {
  nilaiDariWidgets,
  nilaiAnalitikDariWidgets,
  nilaiTrafikDariWidgets,
} from './services/templates/nilaiTemplate';
import { GlobalFiltersBar, cocokFilter } from './components/GlobalFiltersBar';
import { HalamanTabs } from './components/HalamanTabs';
import {
  daftarHalaman,
  halamanBaru as buatHalamanBaru,
  halamanAktif as ambilHalamanAktif,
  proyeksi,
  semuaWidget,
  tulisProyeksi,
} from './services/dashboard/halaman';
import type { HalamanDashboard, TataLetakBaris } from './types';
import { terapkanGayaSemua } from './services/dashboard/gayaSemua';
import { PresentationMode } from './components/PresentationMode';
import { ActiveChartFilterChip, ChartSelectionProvider } from './components/widgets/ChartSelection';
import { preloadEcharts } from './components/widgets/ChartEcharts';

import { WidgetEditorModal } from './components/WidgetEditorModal';
import { GlobalStyleModal } from './components/GlobalStyleModal';
import { ThemeToggle } from './components/ThemeToggle';
import { PasLayar, ReplikaHalaman } from './components/referensi/ReplikaHalaman';
import { BingkaiKorporat } from './components/referensi/BingkaiKorporat';
import { templateBagianId } from './services/templates/templateBagian';
import { tokenTemaDariGaya } from './services/chart/gayaVarian';
import { pakaiChartKatalog } from './services/chart/katalogCocok';
import type { ChartId } from './services/chart/chartDefault';
import { Login } from './pages/Login';
import { GantiPasswordWajib } from './components/GantiPasswordWajib';

// Halaman sekunder di-code-split: tidak membebani bundle awal.
const Admin = lazyAman(() =>
  import('./pages/Admin').then((m) => ({ default: m.Admin }))
);
/**
 * HALAMAN AKTIF DISIMPAN DI URL (#/v/<halaman>[/d/<id dashboard>]).
 *
 * Tanpa ini, menekan refresh mengembalikan pengguna ke daftar Workspace walau
 * ia sedang membuka dashboard tertentu. Hash dipakai (bukan path) supaya server
 * statis tidak perlu aturan tambahan, dan tautannya tetap bisa dibagikan.
 */
const HALAMAN_SAH = [
  'dashboards',
  'workspace',
  'alerts',
  'charts',
  'templates',
  'data',
  'berkas',
  'permintaan',
  'admin',
] as const;

type Halaman = (typeof HALAMAN_SAH)[number];

const bacaHash = (): { halaman: Halaman | null; dashboard: string | null } => {
  const m = window.location.hash.match(/^#\/v\/([A-Za-z]+)(?:\/d\/([\w-]+))?/);
  const kandidat = m?.[1] as Halaman | undefined;
  return {
    halaman: kandidat && HALAMAN_SAH.includes(kandidat) ? kandidat : null,
    dashboard: m?.[2] || null,
  };
};

/**
 * `React.lazy` dengan satu percobaan ulang.
 *
 * Setelah aplikasi diperbarui, berkas potongan bundel lama sudah tidak ada.
 * Kalau tab yang masih terbuka memuatnya, impor gagal dan halaman jadi kosong.
 * Percobaan kedua biasanya berhasil lewat nama berkas baru dari `index.html`
 * yang sudah diperbarui; kalau tetap gagal, `PenjagaGalat` yang menangani.
 */
function lazyAman<T extends React.ComponentType<any>>(
  muat: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy<T>(() =>
    muat().catch(async (e) => {
      await new Promise((r) => setTimeout(r, 400));
      try {
        return await muat();
      } catch {
        throw e;
      }
    })
  );
}

const DashboardList = lazyAman(() =>
  import('./pages/DashboardList').then((m) => ({ default: m.DashboardList }))
);
const AlertsPage = lazyAman(() =>
  import('./pages/AlertsPage').then((m) => ({ default: m.AlertsPage }))
);
const PermintaanDataPage = lazyAman(() =>
  import('./pages/PermintaanDataPage').then((m) => ({ default: m.default }))
);
const ManajemenBerkasPage = lazyAman(() =>
  import('./pages/ManajemenBerkasPage').then((m) => ({ default: m.ManajemenBerkasPage }))
);
const ChartGalleryPage = lazyAman(() =>
  import('./pages/ChartGalleryPage').then((m) => ({ default: m.ChartGalleryPage }))
);
const DashboardTemplatesPage = lazyAman(() =>
  import('./pages/DashboardTemplatesPage').then((m) => ({ default: m.DashboardTemplatesPage }))
);
const PilihDataPage = lazyAman(() =>
  import('./pages/PilihDataPage').then((m) => ({ default: m.PilihDataPage }))
);
const ShareView = lazyAman(() =>
  import('./pages/ShareView').then((m) => ({ default: m.ShareView }))
);
import {
  Dashboard,
  GlobalFilters,
  NotificationItem,
  Tenant,
  User,
  WidgetSpec,
  WidgetStyle,
} from './types';
import { DashboardTemplate, varianTemplate } from './services/templates/dashboardTemplates';

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

  // Tab Panel Admin yang sedang aktif. Menu-nya kini berada di sidebar utama,
  // jadi tab aktif harus hidup di App (bukan di dalam halaman Admin).
  const [adminTab, setAdminTab] = useState<AdminTabId>('overview');

  // App Core State
  // Tampilan awal SELALU daftar Workspace ("Semua Dashboard"), bukan salah satu
  // dashboard: pengguna memilih sendiri kanvas yang mau dibuka.
  const hashAwal = useRef(bacaHash());
  const [viewMode, setViewMode] = useState<Halaman>(hashAwal.current.halaman ?? 'dashboards');
  /** Dashboard yang harus dibuka lagi setelah daftar selesai dimuat (dari URL). */
  const dashPulihkan = useRef<string | null>(hashAwal.current.dashboard);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);

  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<Dashboard | null>(null);

  /** Perbarui dashboard aktif di dua tempat sekaligus: state aktif + daftar.
   *  Dulu lima baris ini disalin 14x; satu tempat supaya keduanya tidak pernah
   *  berbeda isi. */
  const terapkanDashboard = (d: Dashboard) => {
    setActiveDashboard(d);
    setDashboards((prev) => prev.map((x) => (x.id === d.id ? d : x)));
  };

  /** Simpan daftar widget ke server (UI sudah diperbarui optimistis lebih dulu).
   *  Satu tempat untuk PATCH + cek gagal; sebelumnya disalin 7x tanpa cek respons,
   *  jadi penyimpanan yang ditolak server tidak pernah terlihat. */
  const simpanWidget = async (widgets: WidgetSpec[]): Promise<boolean> => {
    if (!activeDashboard || !currentTenant) return false;
    const res = await fetch(`/api/dashboards/${activeDashboard.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        widgets,
        gaya: activeDashboard.gaya,
        // Widget yang baru disimpan ikut tertulis di halaman aktif: `activeDashboard`
        // di sini masih versi sebelum perubahan, dan `halaman` adalah sumber kebenaran
        // saat dashboard dibuka ulang (dulu perubahan editor hilang setelah muat ulang).
        halaman: tulisProyeksi({ ...activeDashboard, widgets }),
        halamanAktifId: activeDashboard.halamanAktifId || daftarHalaman(activeDashboard)[0]?.id,
        tenantId: currentTenant.id,
      }),
    });
    if (!res.ok) console.error('Gagal menyimpan widget:', res.status);
    return res.ok;
  };
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  /**
   * Dashboard hasil template dibuka dengan desain template (replika yang sama
   * dengan pratinjau data asli). `tampilWidget` membukanya sebagai kanvas widget
   * supaya tata letaknya bisa diubah — kanvas widget tidak memakai tata letak
   * template, jadi desainnya memang berbeda saat mode ini aktif.
   */
  const [tampilWidget, setTampilWidget] = useState(false);
  /** Draft tata letak kartu desain template; null = belum ada perubahan. */
  const [drafTataLetak, setDrafTataLetak] = useState<Record<string, TataLetakBaris> | null>(null);
  /**
   * Semua halaman SEBELUM perubahan yang belum disimpan. Selama tidak null, kanvas
   * berisi perubahan (mis. widget baru dari katalog, Gaya Semua) yang menunggu
   * tombol Simpan. Sengaja per dashboard, bukan per halaman: gaya berlaku ke semua
   * halaman, dan pindah halaman tidak boleh membuang perubahan yang belum disimpan.
   */
  const [drafHalamanAwal, setDrafHalamanAwal] = useState<HalamanDashboard[] | null>(null);
  /** Gaya dashboard sebelum diubah dari panel Gaya; null = belum ada perubahan. */
  const [drafGaya, setDrafGaya] = useState<{ nilai?: WidgetStyle } | null>(null);
  /**
   * SELAMA AI MENYUSUN: kanvas menyegarkan dashboard setiap 1,5 detik.
   *
   * Endpoint rekomendasi membalas lebih dulu dengan dashboard kosong berstatus
   * `menyusun`, lalu pekerjaan model menulis kemajuannya ke dashboard yang sama.
   * Tanpa penyegaran ini kanvas hanya menampilkan keadaan awal sampai pengguna
   * memuat ulang halaman.
   */
  useEffect(() => {
    if (!activeDashboard || activeDashboard.status !== 'menyusun') return;
    let hidup = true;
    const segarkan = async () => {
      try {
        const res = await fetch(`/api/dashboards/${activeDashboard.id}`, { credentials: 'include' });
        if (!res.ok || !hidup) return;
        const data = (await res.json()) as Dashboard;
        if (!hidup || !data?.id) return;
        setActiveDashboard(data);
        // Daftar Workspace ikut diperbarui. Tanpa ini kartunya tetap berjudul
        // "AI menyusun dashboard…" sampai halaman dimuat ulang.
        setDashboards((prev) => prev.map((x) => (x.id === data.id ? data : x)));
      } catch {
        /* jaringan putus sesaat: percobaan berikutnya tetap berjalan */
      }
    };
    // 700 ms: kursor AI dan kartu yang ditaruh satu per satu terlihat bergerak.
    const t = setInterval(segarkan, 700);
    void segarkan();
    return () => {
      hidup = false;
      clearInterval(t);
    };
  }, [activeDashboard?.id, activeDashboard?.status]);

  /* Template Chart khusus admin: pengguna yang membuka #/v/charts
     dikembalikan ke workspace. Template Dashboard tetap untuk semua peran. */
  useEffect(() => {
    if (viewMode === 'charts' && !isAdminRole(currentUser?.role)) {
      setViewMode('workspace');
    }
  }, [viewMode, currentUser?.role]);

  useEffect(() => {
    setTampilWidget(false);
    // Draft tata letak dan draft widget tidak boleh terbawa ke dashboard lain.
    setDrafTataLetak(null);
    setDrafHalamanAwal(null);
    setDrafGaya(null);
  }, [activeDashboard?.id]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // Drawer navigasi mobile: sidebar disembunyikan di <md, dibuka sebagai overlay.
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [hapusKonfirmasi, setHapusKonfirmasi] = useState(false);

  /** Galat aksi dashboard (mis. 403 karena peran tidak berwenang) — dulu gagal senyap. */

  const [galatDashboard, setGalatDashboard] = useState('');
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
  const [isGlobalStyleOpen, setIsGlobalStyleOpen] = useState(false);
  /** Kartu yang judul/chart-nya diatur di panel Gaya (dibuka dari menu ⋯ kartu). */
  const [kartuPanelId, setKartuPanelId] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Active Selection for Drawer & Editor
  
  const [editingWidget, setEditingWidget] = useState<WidgetSpec | null>(null);
  const [editorTab, setEditorTab] = useState<'config' | 'correction'>('config');

  // Notifikasi
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Initial Fetch
  useEffect(() => {
    // Daftar instansi kini WAJIB login (dulu terbuka untuk umum). Jadi jangan
    // memanggilnya saat belum ada sesi — kalau dipanggil, server membalas 401.
    if (!currentUser || !authToken) return;
    fetch('/api/tenants')
      .then((res) => {
        // Sesi browser (localStorage) bisa tertinggal lebih lama daripada cookie
        // HttpOnly di server (kedaluwarsa/ganti origin). Saat itu terjadi app
        // TAMPAK login padahal setiap permintaan dibalas 401 — fitur seperti
        // "Bagikan" lalu mati tanpa penjelasan. Di sini sesi basi dibersihkan
        // supaya pengguna diminta login ulang, bukan menebak-nebak.
        if (res.status === 401) {
          localStorage.removeItem('aionesboard_user');
          sessionStorage.removeItem('aionesboard_user');
          setAuthToken(null);
          setCurrentUser(null);
          setCurrentTenant(null);
          return [];
        }
        return res.ok ? res.json() : [];
      })
      .then((data: Tenant[]) => {
        setTenants(data);
        if (data.length > 0 && !currentTenant) {
          // Instansi aktif HARUS instansi milik pengguna yang login, bukan instansi
          // pertama pada daftar. Dulu di sini `data[0]`: saat admin login, instansi
          // aktif jadi instansi lain (urutannya arbitrer), sehingga RAG Copilot
          // menjawab dari KB instansi yang tidak sedang dibuka admin.
          const milikSendiri = data.find((t) => t.id === currentUser?.tenantId);
          setCurrentTenant(milikSendiri || data[0]);
        }
      })
      .catch((err) => console.error('Fetch tenants error:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, authToken]);

  /**
   * Jaga objek instansi aktif tetap sinkron dengan daftar instansi terbaru.
   *
   * Panel admin bisa mengubah KB sebuah instansi; kalau objek lama dibiarkan,
   * header copilot menampilkan KB lama walau server sudah memakai yang baru.
   */
  useEffect(() => {
    if (!currentTenant) return;
    const terbaru = tenants.find((t) => t.id === currentTenant.id);
    if (terbaru && terbaru !== currentTenant) setCurrentTenant(terbaru);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenants]);

  /** Muat ulang daftar instansi (dipakai panel admin setelah mengubah instansi/KB). */
  const segarkanTenants = () => {
    if (!currentUser || !authToken) return;
    fetch('/api/tenants')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Tenant[]) => {
        if (Array.isArray(data) && data.length > 0) setTenants(data);
      })
      .catch((err) => console.error('Segarkan tenants error:', err));
  };

  // Pre-warm chunk echarts paralel dengan fetch data dashboard, agar chart
  // pertama di workspace tidak menunggu unduhan ~1 MB (lihat ChartEcharts).
  useEffect(() => {
    if (currentUser && authToken && activeDashboard) {
      preloadEcharts();
    }
  }, [currentUser, authToken, activeDashboard]);

  // Catatan: fullscreen & tombol ESC mode presentasi kini ditangani DI DALAM
  // komponen `PresentationMode` (yang juga mengunci scroll body), jadi efek
  // fullscreen lama di sini dihapus agar tidak saling bertabrakan.

  const handleLoginSuccess = (user: User, token: string) => {
    setCurrentUser(user);
    setAuthToken(token);
    const assigned = tenants.find((t) => t.id === user.tenantId);
    if (assigned) {
      setCurrentTenant(assigned);
    }
    // Role admin langsung masuk panel admin, tidak lewat workspace.
    if (isAdminRole(user.role)) {
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
    // Buang juga instansi aktif: kalau tidak, pengguna berikutnya mewarisi konteks
    // instansi milik pengguna sebelumnya (dan copilot ikut menjawab dari KB itu).
    setCurrentTenant(null);
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
        // Jangan membuka dashboard mana pun secara otomatis: pertahankan pilihan
        // pengguna bila masih ada, selain itu biarkan kosong (tetap di daftar).
        setActiveDashboard((sebelumnya) =>
          sebelumnya ? data.find((d) => d.id === sebelumnya.id) || null : null
        );
        // Kembali ke dashboard yang sedang dibuka sebelum halaman di-refresh.
        const idPulih = dashPulihkan.current;
        if (idPulih) {
          const d = data.find((x) => x.id === idPulih);
          if (d) {
            dashPulihkan.current = null;
            setActiveDashboard(d);
            setViewMode('workspace');
          }
        }
      })
      .catch((err) => console.error('Fetch dashboards error:', err));

    // Indikator riwayat di kartu dashboard.
    muatChatCounts(currentTenant.id);

    // Notifikasi
    fetch(`/api/notifications?tenantId=${currentTenant.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setNotifications(data);
      })
      .catch((err) => console.error('Fetch notifications error:', err));
  }, [currentTenant, authToken]);

  // Handlers for Tenant Switcher
  const handleSelectTenant = (tenant: Tenant) => {
    // Ganti konteks instansi: semua peran boleh berpindah agar bisa melihat
    // dokumen RAG & dashboard milik instansi lain.
    setCurrentTenant(tenant);
  };

  // Handlers for Dashboard Selection
  const handleSelectDashboard = (dash: Dashboard) => {
    setActiveDashboard(dash);
  };

  // Handler for New Blank Dashboard
  // Kegagalan tidak boleh diam (temuan uji E2E): dulu `if (!res.ok) return;`
  // membuat pengguna mendarat di workspace kosong tanpa pesan apa pun.
  const handleCreateDashboard = async () => {
    if (!currentTenant) return;
    const gagal = (pesan: string) => {
      setGalatDashboard(pesan);
      setActiveDashboard(null);
      setViewMode('dashboards');
    };
    try {
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
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        gagal(data?.error || `Dashboard gagal dibuat (HTTP ${res.status}). Coba lagi.`);
        return;
      }
      const newDash = await res.json();
      setGalatDashboard('');
      setDashboards((prev) => [newDash, ...prev]);
      setActiveDashboard(newDash);
    } catch (err) {
      console.error('Create dashboard error:', err);
      gagal('Dashboard gagal dibuat: jaringan atau server tidak menjawab. Coba lagi.');
    }
  };

  /**
   * Buat dashboard baru dari TEMPLATE dengan ANGKA DARI DOKUMEN.
   *
   * Angka template sudah disiapkan server lebih dulu (gudang pratinjau), jadi
   * permintaan ini hanya menyalin hasil yang sudah siap — seketika. Kalau ternyata
   * belum siap, server menjawab 409 dan UI memberi tahu bahwa datanya masih loading
   * (bukan menahan pengguna 5–15 menit seperti alur lama).
   */
  const handleUseTemplate = async (
    template: DashboardTemplate,
    /** Gaya Template Chart pilihan pengguna — disimpan bersama dashboard baru. */
    gaya?: string
  ): Promise<{ terisi: number; kosong: number; total: number }> => {
    if (!currentTenant) throw new Error('Pilih instansi terlebih dahulu.');
    const res = await fetch('/api/dashboards/dari-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: currentTenant.id, templateId: template.id, gaya }),
    });
    const isi = await res.json().catch(() => null);
    /**
     * 409 punya dua arti: data masih disiapkan (`status` belum/proses) ATAU
     * dokumen instansi tidak memuat angka apa pun untuk template ini
     * (`status: 'kosong'`). Pesannya diambil dari server supaya pengguna tahu
     * mana yang sedang terjadi, bukan selalu "masih disiapkan".
     */
    if (res.status === 409) {
      throw new Error(
        isi?.error ||
          'Data template masih disiapkan dari dokumen instansi. Tunggu sampai selesai, lalu tekan Simpan lagi.'
      );
    }
    if (!res.ok || !isi?.dashboard) {
      throw new Error(isi?.error || 'Dashboard belum bisa dibuat. Coba lagi beberapa saat lagi.');
    }
    const newDash: Dashboard = isi.dashboard;
    setDashboards((prev) => [newDash, ...prev]);
    setActiveDashboard(newDash);
    setViewMode('workspace');
    return { terisi: isi.terisi ?? 0, kosong: isi.kosong ?? 0, total: isi.total ?? 0 };
  };

  const handleDeleteDashboard = async (dashboardId: string) => {
    if (!currentTenant) return;
    try {
      const res = await fetch(`/api/dashboards/${dashboardId}?tenantId=${currentTenant.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setGalatDashboard('');
        setDashboards((prev) => prev.filter((d) => d.id !== dashboardId));
        if (activeDashboard?.id === dashboardId) {
          // Setelah menghapus, jangan langsung membuka dashboard lain —
          // kembalikan pengguna ke daftar Workspace.
          setActiveDashboard(null);
          setViewMode('dashboards');
        }
        return;
      }
      // Server menolak (mis. 403 untuk peran pengguna): tampilkan alasannya,
      // jangan menutup dialog seolah dashboard sudah terhapus.
      const data = await res.json().catch(() => null);
      setGalatDashboard(
        data?.error || `Dashboard gagal dihapus (HTTP ${res.status}). Coba lagi atau hubungi admin instansi.`
      );
    } catch (err) {
      console.error('Delete dashboard error:', err);
      setGalatDashboard('Dashboard gagal dihapus: jaringan atau server tidak menjawab.');
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
  /**
   * Atur satu kartu: judul, keterangan, dan bentuk chart-nya.
   *
   * Dulu ini membuka modal di tengah layar. Sekarang panel Gaya Widget di kanan
   * dipakai bersama gaya dashboard, jadi pengguna mengatur kartu sambil melihat
   * kanvas yang ikut berubah.
   */
  const handleEditWidget = (widget: WidgetSpec) => {
    setIsChatOpen(false);
    setKartuPanelId(widget.id);
    setIsGlobalStyleOpen(true);
    setEditingWidget(null);
  };

  const handleManualCorrection = (widget: WidgetSpec) => {
    setEditingWidget(widget);
    setEditorTab('correction');
  };

  /**
   * Ubah judul/keterangan satu kartu dari panel Gaya.
   *
   * Sama seperti ganti chart: kartu berubah di layar lebih dulu, lalu disimpan.
   * Kalau penyimpanan gagal, tampilan dikembalikan ke nilai lama.
   */
  const handleUbahJudul = async (widget: WidgetSpec, patch: { title?: string; subtitle?: string }) => {
    if (!activeDashboard || !currentTenant) return;
    const lama = activeDashboard.widgets;
    const baru = lama.map((w) => (w.id === widget.id ? { ...w, ...patch } : w));
    setGalatDashboard('');
    terapkanDashboard({ ...activeDashboard, widgets: baru });
    const tersimpan = await simpanWidget(baru);
    if (!tersimpan) {
      terapkanDashboard({ ...activeDashboard, widgets: lama });
      setGalatDashboard('Judul kartu gagal disimpan. Coba lagi.');
    }
  };

  const handleSaveWidget = async (updatedWidget: WidgetSpec) => {
    if (!activeDashboard || !currentTenant) return;
    const updatedWidgets = activeDashboard.widgets.map((w) =>
      w.id === updatedWidget.id ? updatedWidget : w
    );
    terapkanDashboard({ ...activeDashboard, widgets: updatedWidgets });
    // Editor punya tombol "Simpan Perubahan" sendiri: langsung tersimpan ke server.
    await simpanWidget(updatedWidgets);
  };

  /**
   * Terapkan gaya satu widget ke SELURUH widget di dashboard aktif.
   *
   * Dipakai tombol "Terapkan ke Semua Widget" di editor: supaya pengguna tidak
   * perlu mengatur warna/font satu per satu. Disimpan sekali lewat PATCH yang
   * sama dengan penyimpanan widget biasa.
   */
  /**
   * Terapkan gaya dari panel Gaya.
   *
   * `target` adalah sasaran PALET WARNA: `'semua'`, id widget, atau kunci grafik
   * template. Warna kartu, font, dan ukuran font SELALU berlaku untuk semua
   * widget — hanya palet yang bisa dibatasi ke satu grafik.
   */
  const handleApplyStyleToAll = (style: WidgetStyle | undefined, target: string | string[] = 'semua') => {
    if (!activeDashboard || !currentTenant) return;
    // Seperti tambah widget: masuk kanvas dulu, penyimpanan lewat tombol Simpan.
    setDrafHalamanAwal((awal) => awal ?? tulisProyeksi(activeDashboard));
    setDrafGaya((awal) => awal ?? { nilai: activeDashboard.gaya });
    // Semua halaman, bukan hanya halaman yang sedang dibuka.
    terapkanDashboard(terapkanGayaSemua(activeDashboard, style, target));
  };

  /**
   * Ganti chart satu kartu langsung dari menu ⋯, tanpa membuka editor.
   *
   * Kartu diganti di layar lebih dulu supaya terasa langsung, lalu disimpan ke
   * server lewat jalur yang sama dengan penyimpanan widget lain. Kalau server
   * menolak, tampilan dikembalikan ke bentuk lama supaya layar tidak berbeda
   * dari data tersimpan.
   */
  const handleGantiChart = async (widget: WidgetSpec, chartId: string) => {
    if (!activeDashboard || !currentTenant) return;
    const diubah = pakaiChartKatalog(widget, chartId as ChartId);
    const lama = activeDashboard.widgets;
    const baru = lama.map((w) => (w.id === diubah.id ? diubah : w));
    setGalatDashboard('');
    terapkanDashboard({ ...activeDashboard, widgets: baru });
    const tersimpan = await simpanWidget(baru);
    if (!tersimpan) {
      terapkanDashboard({ ...activeDashboard, widgets: lama });
      setGalatDashboard('Bentuk chart gagal disimpan. Coba lagi.');
    }
  };

  const handleDeleteWidget = async (widgetId: string) => {
    if (!activeDashboard || !currentTenant) return;
    const updatedWidgets = activeDashboard.widgets.filter((w) => w.id !== widgetId);
    const updatedDashboard = { ...activeDashboard, widgets: updatedWidgets };

    terapkanDashboard(updatedDashboard);

    await simpanWidget(updatedWidgets);
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

    terapkanDashboard(updatedDashboard);

    await simpanWidget(updatedWidgets);
  };

  // Reorder widget via drag-and-drop: simpan urutan baru lalu persist.
  const handleReorderWidgets = async (orderedIds: string[]) => {
    if (!activeDashboard || !currentTenant) return;
    const peta = new Map(activeDashboard.widgets.map((w) => [w.id, w]));
    const ordered = orderedIds.map((id) => peta.get(id)).filter((w): w is WidgetSpec => !!w);
    if (ordered.length !== activeDashboard.widgets.length) return; // ada id tak dikenal — abaikan
    const updatedDashboard = { ...activeDashboard, widgets: ordered };

    terapkanDashboard(updatedDashboard);

    await simpanWidget(ordered);
  };

  // Resize lebar widget: grid.w diubah (bucket 4/6/8/12) lalu persist.
  const handleResizeWidget = async (widgetId: string, w: number, h?: number) => {
    if (!activeDashboard || !currentTenant) return;
    const updatedWidgets = activeDashboard.widgets.map((wg) =>
      wg.id === widgetId ? { ...wg, grid: { ...(wg.grid || { x: 0, y: 0, h: 2 }), w, ...(h ? { h } : {}) } } : wg
    );
    const updatedDashboard = { ...activeDashboard, widgets: updatedWidgets };

    terapkanDashboard(updatedDashboard);

    await simpanWidget(updatedWidgets);
  };

  /** Gaya kartu yang dipakai dashboard aktif (widget pertama yang punya gaya). */
    /** Grafik yang bisa dipilih sebagai sasaran palet pada desain template. */
  const GRAFIK_TEMPLATE: Record<string, Array<{ id: string; label: string }>> = {
    'tpl-ringkasan': [
      { id: 'bar', label: 'Pendapatan & Beban' },
      { id: 'donut', label: 'Rincian Beban' },
      { id: 'area', label: 'Arus Kas' },
    ],
    'tpl-analitik': [
      { id: 'area', label: 'Grafik area' },
      { id: 'batang', label: 'Grafik batang' },
      { id: 'donat', label: 'Grafik donat' },
      { id: 'kategori', label: 'Kategori' },
      { id: 'jam', label: 'Per jam' },
      { id: 'bayar', label: 'Metode bayar' },
      { id: 'konversi', label: 'Konversi' },
    ],
    'tpl-trafik': [
      { id: 'trafik', label: 'Sumber trafik' },
      { id: 'relevansi', label: 'Dinamika relevansi' },
      { id: 'usia', label: 'Usia pengunjung' },
      { id: 'perangkat', label: 'Jenis perangkat' },
      { id: 'perilaku', label: 'Perilaku' },
    ],
  };

  const targetPalet = useMemo(() => {
    // Template rapat bagian berisi kartu widget biasa: sasarannya daftar kartu.
    if (activeDashboard?.replika && !templateBagianId(activeDashboard.replika.templateId)) {
      const tid = activeDashboard.replika.templateId;
      // Template bergaya memakai susunan Pijar, jadi grafiknya sama.
      return GRAFIK_TEMPLATE[tid] || (varianTemplate(tid) ? GRAFIK_TEMPLATE['tpl-ringkasan'] : []);
    }
    // Kartu di SEMUA halaman, diberi nama halamannya, supaya "ganti beberapa saja" bisa lintas halaman.
    if (!activeDashboard) return [];
    const semua = tulisProyeksi(activeDashboard);
    return semua.flatMap((h) =>
      (h.widgets || []).map((w) => ({ id: w.id, label: semua.length > 1 ? `${h.judul} · ${w.title}` : w.title }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDashboard?.replika?.templateId, activeDashboard?.widgets, activeDashboard?.halaman]);

  const gayaDashboardAktif = useMemo(
    () => activeDashboard?.gaya ?? activeDashboard?.widgets?.find((w) => w.style)?.style,
    [activeDashboard?.gaya, activeDashboard?.widgets]
  );

  /** Font panel Gaya berlaku untuk SELURUH teks di kanvas, bukan hanya grafik. */
  const fontKanvas = gayaDashboardAktif?.font
    ? `'${gayaDashboardAktif.font}', 'Inter', system-ui, sans-serif`
    : undefined;

  /**
   * HALAMAN DASHBOARD — pindah, tambah, ganti nama, hapus, geser.
   *
   * Isi halaman sekarang ditulis balik ke `halaman[]` sebelum berpindah, lalu
   * halaman tujuan diproyeksikan ke field lama (`widgets`, `replika`, ...) supaya
   * seluruh kanvas dan presentasi tetap bekerja tanpa perubahan.
   */
  // Halaman aktif diambil dari field proyeksi (`widgets`, `tataLetak`, ...) yang
  // selalu terbaru. Dulu `d.halaman` dipakai mentah, sehingga ukuran widget yang
  // baru diubah tidak tampil di mode presentasi sampai halaman dimuat ulang.
  const halamanDashboard = useMemo(
    () => (activeDashboard ? tulisProyeksi(activeDashboard) : daftarHalaman(activeDashboard)),
    [activeDashboard]
  );
  const halamanSekarang = useMemo(() => ambilHalamanAktif(activeDashboard), [activeDashboard]);

  /**
   * ISI PRESENTASI PER HALAMAN.
   *
   * Mode presentasi multi-halaman: satu halaman = satu slide besar. Tiap halaman
   * dihitung angkanya sendiri dari widget-nya (desain template tetap sama), dan
   * halaman kanvas widget memakai `widgets` halaman itu.
   */
  const halamanPresentasi = useMemo(() => {
    if (!activeDashboard) return undefined;
    const semua = halamanDashboard;
    if (semua.length < 2) return undefined;
    const filterDashboard = activeDashboard.globalFilters;
    return semua.map((h) => {
      const widgetsH = (h.widgets || []).filter((w) => cocokFilter(w, h.globalFilters ?? filterDashboard));
      const tid = h.replika?.templateId;
      if (!tid) return { id: h.id, judul: h.judul, widgets: h.widgets || [] };
      // Halaman 2 dan 3 menyimpan angkanya sendiri; halaman 1 dihitung dari widget.
      // Template rapat bagian menggambar kartu halaman itu apa adanya.
      const nilai = templateBagianId(tid)
        ? { widgets: widgetsH }
        : tid.includes('#')
        ? h.replika?.nilai
        : tid === 'tpl-analitik'
          ? nilaiAnalitikDariWidgets(widgetsH)
          : tid === 'tpl-trafik'
            ? nilaiTrafikDariWidgets(widgetsH)
            : nilaiDariWidgets(widgetsH);
      const konten = (
        <ReplikaHalaman
          penuh
          replika={{ templateId: tid, nilai }}
          gaya={gayaDashboardAktif}
          tataLetak={h.tataLetak?.[tid]}
        />
      );
      return { id: h.id, judul: h.judul, konten };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDashboard, halamanDashboard, gayaDashboardAktif]);


  const pindahHalaman = (id: string) => {
    const d = activeDashboard;
    if (!d || id === (d.halamanAktifId || halamanSekarang?.id)) return;
    const semua = tulisProyeksi(d);
    const tujuan = semua.find((h) => h.id === id);
    if (!tujuan) return;
    // Perubahan yang belum disimpan ikut tertulis di halaman dan draftnya tetap ada,
    // supaya tombol Simpan/Reset tidak hilang. Tata letak template per halaman.
    setDrafTataLetak(null);
    terapkanDashboard({ ...d, ...proyeksi(tujuan, d), halaman: semua, halamanAktifId: id });
  };

  /** Simpan struktur halaman (tambah/ganti nama/hapus/geser) ke server. */
  const simpanStrukturHalaman = (semua: ReturnType<typeof tulisProyeksi>, aktifId: string) => {
    const d = activeDashboard;
    if (!d) return;
    const tujuan = semua.find((h) => h.id === aktifId) || semua[0];
    terapkanDashboard({ ...d, ...proyeksi(tujuan, d), halaman: semua, halamanAktifId: tujuan.id });
    void fetch(`/api/dashboards/${d.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ halaman: semua, halamanAktifId: tujuan.id, tenantId: currentTenant?.id }),
    }).catch(() => undefined);
  };

  /**
   * Tambah halaman. Dashboard hasil template diisi server dengan angka dokumen
   * yang belum dipakai halaman lain (desain tetap sama). Bila server belum punya
   * angka lain, halaman tetap dibuat kosong dan pengguna diberi tahu.
   */
  const tambahHalaman = () => {
    const d = activeDashboard;
    if (!d) return;
    const semua = tulisProyeksi(d);
    const nomor = semua.length + 1;

    if (d.replika && currentTenant) {
      void (async () => {
        try {
          const res = await fetch(`/api/dashboards/${d.id}/halaman`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId: currentTenant.id, judul: `Halaman ${nomor}` }),
          });
          if (res.ok) {
            const data = await res.json();
            const baru = data.halaman;
            simpanStrukturHalaman([...semua, baru], baru.id);
            if (data.peringatan) window.alert(data.peringatan);
            return;
          }
        } catch {
          /* jaringan gagal: buat halaman kosong di bawah */
        }
        const cadangan = buatHalamanBaru(nomor, halamanSekarang);
        simpanStrukturHalaman([...semua, cadangan], cadangan.id);
      })();
      return;
    }

    const baru = buatHalamanBaru(nomor, halamanSekarang);
    simpanStrukturHalaman([...semua, baru], baru.id);
  };

  const gantiNamaHalaman = (id: string, judul: string) => {
    const d = activeDashboard;
    if (!d) return;
    const semua = tulisProyeksi(d).map((h) => (h.id === id ? { ...h, judul } : h));
    simpanStrukturHalaman(semua, d.halamanAktifId || semua[0].id);
  };

  const hapusHalaman = (id: string) => {
    const d = activeDashboard;
    if (!d) return;
    const semua = tulisProyeksi(d).filter((h) => h.id !== id);
    if (semua.length === 0) return;
    const aktifBaru = semua[0].id;
    simpanStrukturHalaman(semua, aktifBaru);
  };

  const geserHalaman = (dari: number, ke: number) => {
    const d = activeDashboard;
    if (!d) return;
    const semua = [...tulisProyeksi(d)];
    if (ke < 0 || ke >= semua.length) return;
    const [pindah] = semua.splice(dari, 1);
    semua.splice(ke, 0, pindah);
    simpanStrukturHalaman(semua, d.halamanAktifId || semua[0].id);
  };

  /**
   * Widget baru (dari Impor Data) masuk KANVAS DAHULU, belum disimpan.
   * Pemilik dashboard masih bisa Reset atau Simpan seperti menggeser kartu.
   */
  const handleAddWidgetFromCatalog = (widget: WidgetSpec) => {
    if (!activeDashboard || !currentTenant) return;
    setDrafHalamanAwal((awal) => awal ?? tulisProyeksi(activeDashboard));
    const updatedWidgets = [widget, ...activeDashboard.widgets];
    terapkanDashboard({ ...activeDashboard, widgets: updatedWidgets });
  };

  // Handler for Global Filters
  const handleGlobalFiltersChange = async (filters: GlobalFilters) => {
    if (!activeDashboard || !currentTenant) return;
    const updatedDashboard = { ...activeDashboard, globalFilters: filters };
    terapkanDashboard(updatedDashboard);

    await fetch(`/api/dashboards/${activeDashboard.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        globalFilters: filters,
        tenantId: currentTenant.id,
      }),
    });
  };

  const unreadCount = Array.isArray(notifications) ? notifications.filter((n) => !n.isRead).length : 0;

  /**
   * Jumlah widget SEMUA halaman. `activeDashboard.widgets` hanya cermin halaman
   * aktif: dipakai sebagai total, kop menulis "2 widget" untuk dashboard 13
   * widget, dan menu Presentasi/Gaya hilang bila halaman aktif kosong.
   */
  const jumlahWidgetSemua = activeDashboard ? semuaWidget(activeDashboard).length : 0;
  /** Kartu yang sedang diatur di panel Gaya Widget (null = panel gaya global). */
  const kartuPanel = activeDashboard && kartuPanelId
    ? semuaWidget(activeDashboard).find((w) => w.id === kartuPanelId) ?? null
    : null;

  // Widget yang benar-benar tampil di kanvas internal setelah filter view-only diterapkan.
  const widgetsTampilInternal = (activeDashboard?.widgets || []).filter((w) => cocokFilter(w, viewFilters));

  /**
   * Tautan `#/v/...` yang dibuka saat aplikasi SUDAH terbuka (tautan internal,
   * tombol back, ketik ulang URL) dulu diabaikan karena hash hanya dibaca saat
   * mount. `replaceState` di efek bawah tidak memicu `hashchange`, jadi tidak berulang.
   */
  useEffect(() => {
    const ikutiHash = () => {
      const { halaman, dashboard } = bacaHash();
      if (!halaman) return;
      if (halaman === 'workspace' && dashboard) {
        const d = dashboards.find((x) => x.id === dashboard);
        if (d) setActiveDashboard(d);
      }
      setViewMode(halaman);
    };
    window.addEventListener('hashchange', ikutiHash);
    return () => window.removeEventListener('hashchange', ikutiHash);
  }, [dashboards]);

  // Simpan halaman aktif ke URL supaya refresh tidak melempar pengguna ke daftar.
  useEffect(() => {
    if (!currentUser) return;
    const tujuan = `#/v/${viewMode}${viewMode === 'workspace' && activeDashboard ? `/d/${activeDashboard.id}` : ''}`;
    if (window.location.hash !== tujuan) window.history.replaceState(null, '', tujuan);
  }, [viewMode, activeDashboard?.id, currentUser]);
  /**
   * Angka untuk dashboard hasil template. Dihitung ULANG dari widget yang lolos
   * filter, bukan dari nilai yang tersimpan saat dashboard dibuat — tanpa ini
   * memilih kategori atau periode tidak mengubah apa pun di tampilan template.
   */
  const nilaiReplika = useMemo(() => {
    const tid = activeDashboard?.replika?.templateId;
    if (!tid) return null;
    if (templateBagianId(tid)) return { widgets: widgetsTampilInternal };
    // Halaman 2 dan 3 template menyimpan angkanya sendiri (bukan turunan widget).
    if (tid.includes('#')) return activeDashboard?.replika?.nilai ?? null;
    if (tid === 'tpl-analitik') return nilaiAnalitikDariWidgets(widgetsTampilInternal);
    if (tid === 'tpl-trafik') return nilaiTrafikDariWidgets(widgetsTampilInternal);
    return nilaiDariWidgets(widgetsTampilInternal);
  }, [activeDashboard?.replika?.templateId, widgetsTampilInternal]);

  /**
   * TATA LETAK KARTU DESAIN TEMPLATE — DRAFT, BUKAN LANGSUNG DISIMPAN.
   *
   * Selama pemilik dashboard menggeser atau mengubah ukuran kartu, hasilnya hanya
   * disimpan di `drafTataLetak`. Baru dikirim ke server saat menekan Simpan di
   * ujung kanan baris filter, dan bisa dibatalkan dengan Reset.
   */
  const templateAktif = activeDashboard?.replika?.templateId;
  const tataLetakTersimpan = templateAktif ? activeDashboard?.tataLetak?.[templateAktif] : undefined;
  const tataLetakAktif = drafTataLetak ?? tataLetakTersimpan ?? {};
  const tataLetakBerubah = useMemo(() => {
    if (drafHalamanAwal || drafGaya) return true;
    if (!drafTataLetak) return false;
    return JSON.stringify(drafTataLetak) !== JSON.stringify(tataLetakTersimpan ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafTataLetak, drafHalamanAwal, drafGaya, activeDashboard?.tataLetak, templateAktif]);

  /**
   * Geser atau ubah ukuran kartu template langsung tersimpan (permintaan pemilik
   * aplikasi), tanpa menunggu tombol Simpan. BarisGeser hanya melapor saat kartu
   * dilepas, jadi satu gerakan = satu PATCH. Pengecualian: bila masih ada draft
   * widget atau gaya, perubahan ikut draft supaya draft itu tidak ikut tersimpan.
   */
  const ubahTataLetak = (baru: Record<string, TataLetakBaris>) => {
    const d = activeDashboard;
    if (!d || !templateAktif || drafHalamanAwal || drafGaya) {
      setDrafTataLetak(baru);
      return;
    }
    const dBaru: Dashboard = { ...d, tataLetak: { ...(d.tataLetak || {}), [templateAktif]: baru } };
    const halamanBaru = tulisProyeksi(dBaru);
    terapkanDashboard({ ...dBaru, ...(Array.isArray(d.halaman) && d.halaman.length ? { halaman: halamanBaru } : {}) });
    setDrafTataLetak(null);
    void fetch(`/api/dashboards/${d.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tataLetak: dBaru.tataLetak,
        halaman: halamanBaru,
        halamanAktifId: d.halamanAktifId || halamanBaru[0]?.id,
        tenantId: currentTenant?.id,
      }),
    })
      .then((res) => {
        if (!res.ok) console.error('Gagal menyimpan tata letak:', res.status);
      })
      .catch(() => undefined);
  };

  /** Simpan draft ke server, lalu jadikan patokan baru. */
  const simpanTataLetak = () => {
    const d = activeDashboard;
    if (!d) return;

    // Widget baru yang masih draft ikut disimpan di sini.
    if (drafHalamanAwal || drafGaya) {
      void simpanWidget(d.widgets);
      setDrafHalamanAwal(null);
      setDrafGaya(null);
    }

    if (!templateAktif || !drafTataLetak) return;
    const tataLetakBaru = { ...(d.tataLetak || {}), [templateAktif]: drafTataLetak };
    setActiveDashboard({ ...d, tataLetak: tataLetakBaru });
    setDashboards((daftar) => daftar.map((x) => (x.id === d.id ? { ...x, tataLetak: tataLetakBaru } : x)));
    setDrafTataLetak(null);
    void fetch(`/api/dashboards/${d.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tataLetak: tataLetakBaru }),
    }).catch(() => undefined);
  };

  /** Buang draft, kembali ke kondisi yang tersimpan. */
  const resetTataLetak = () => {
    setDrafTataLetak(null);
    if (activeDashboard && (drafHalamanAwal || drafGaya)) {
      const kembali: Dashboard = {
        ...activeDashboard,
        ...(drafHalamanAwal ? { halaman: drafHalamanAwal } : {}),
        gaya: drafGaya ? drafGaya.nilai : activeDashboard.gaya,
      };
      const aktif = ambilHalamanAktif(kembali);
      terapkanDashboard(aktif ? { ...kembali, ...proyeksi(aktif, kembali) } : kembali);
      setDrafHalamanAwal(null);
      setDrafGaya(null);
    }
  };

  const filterAktif =
    viewFilters.periode !== 'Semua' ||
    viewFilters.unitKerja !== 'Semua' ||
    viewFilters.kategori !== 'Semua';

  if (!currentUser || !authToken) {
    return <Login onLoginSuccess={handleLoginSuccess} tenants={tenants} />;
  }

  // Akun dengan kata sandi sementara/bawaan wajib menggantinya dulu. Server juga
  // menolak endpoint lain (403 MUST_CHANGE_PASSWORD), ini hanya tampilannya.
  if (currentUser.mustChangePassword) {
    return (
      <GantiPasswordWajib
        namaPengguna={currentUser.name}
        onSelesai={() => setCurrentUser({ ...currentUser, mustChangePassword: false })}
        onKeluar={() => {
          void handleLogout();
        }}
      />
    );
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
      {/* Sidebar utama juga tampil di mode admin: menu Panel Admin kini ada di sini,
          bukan lagi sebagai sidebar kedua di dalam halaman Admin. */}
      {!isPresentationMode && (
        <>
          {isMobileNavOpen && (
            <div
              className="fixed inset-0 z-40 bg-scrim/40 md:hidden"
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
              /* Template Chart khusus admin. Template Dashboard untuk semua peran. */
              onOpenChartGallery={isAdminRole(currentUser?.role) ? () => {
                setViewMode('charts');
                setIsMobileNavOpen(false);
              } : undefined}
              onOpenDashboardTemplates={() => {
                setViewMode('templates');
                setIsMobileNavOpen(false);
              }}
              onOpenManajemenBerkas={() => {
                setViewMode('berkas');
                setIsMobileNavOpen(false);
              }}
              onOpenPermintaan={() => {
                setViewMode('permintaan');
                setIsMobileNavOpen(false);
              }}
              /* Pilih Data khusus admin: role User tidak lagi melihat tab menu ini
                 (penyusunan dashboard dari data dokumen hanya untuk admin). */
              onOpenPilihData={isAdminRole(currentUser?.role) ? () => {
                setViewMode('data');
                setIsMobileNavOpen(false);
              } : undefined}
              onOpenAlerts={() => {
                setViewMode('alerts');
                setIsMobileNavOpen(false);
              }}
              unreadAlertsCount={unreadCount}
              currentView={viewMode}
              adminTab={adminTab}
              onSelectAdminTab={(tab) => {
                setAdminTab(tab);
                setViewMode('admin');
                setIsMobileNavOpen(false);
              }}
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
                    {viewMode === 'dashboards' ? 'Workspace'
                      : viewMode === 'alerts' ? 'Notifikasi'
                      : viewMode === 'charts' ? 'Chart'
                      : viewMode === 'templates' ? 'Template Dashboard'
                      : viewMode === 'data' ? 'Pilih Data'
                      : viewMode === 'berkas' ? 'Referensi'
                      : viewMode === 'permintaan' ? (isAdminRole(currentUser?.role) ? 'Kotak Masuk' : 'Permintaan Data')
                      : 'Workspace'}
                  </span>
                </div>
                {/* Judul halaman (baris bawah navbar). Di mode workspace baris ini TIDAK
                    ditampilkan karena hanya mengulang kata "Workspace" padahal judul
                    dashboard sudah ada di kartu header di bawahnya (permintaan user).
                    Mode Pilih Data juga tanpa judul: halamannya langsung menampilkan
                    pencarian dan data, tanpa teks pengantar. */}
                {viewMode !== 'workspace' && viewMode !== 'data' && (
                  <h1 className="truncate max-w-[42vw] sm:max-w-[28rem] text-sm font-bold text-ink leading-tight mt-0.5">
                    {viewMode === 'dashboards'
                      ? 'Workspace'
                      : viewMode === 'alerts'
                          ? 'Notifikasi'
                          : viewMode === 'templates'
                            ? 'Template Dashboard'
                            : viewMode === 'berkas'
                              ? 'Repositori Dokumen'
                              : viewMode === 'permintaan'
                                ? (isAdminRole(currentUser?.role) ? 'Kotak Masuk Permintaan' : 'Permintaan Data')
                                : 'Template Chart'}
                  </h1>
                )}
              </div>
            </div>

            {/* ── Kanan: aksi utama ── */}
            <div className="flex items-center gap-1.5 shrink-0">

              <ThemeToggle />

              <div className="h-5 w-px bg-line shrink-0" />



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
                          Ekspor & Bagikan
                        </div>
                        {activeDashboard && jumlahWidgetSemua > 0 && (
                          <button
                            onClick={() => { setIsMoreMenuOpen(false); setIsPresentationMode(true); }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
                          >
                            <Presentation className="w-3.5 h-3.5 shrink-0 text-ink-3" />
                            <span>Mode Presentasi</span>
                          </button>
                        )}
                        <button
                          onClick={() => { setIsMoreMenuOpen(false); setIsExportOpen(true); }}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5 shrink-0 text-ink-3" />
                          <span>Cetak / Ekspor</span>
                        </button>
                        {/* Bagikan tautan & hapus dashboard = aksi tulis. Untuk peran
                            pengguna keduanya dulu tetap tampil lalu ditolak 403 tanpa pesan. */}
                        {isAdminRole(currentUser?.role) && (
                          <>
                            <button
                              onClick={() => { setIsMoreMenuOpen(false); setIsShareOpen(true); }}
                              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
                            >
                              <Share2 className="w-3.5 h-3.5 shrink-0 text-ink-3" />
                              <span>Bagikan Tautan</span>
                            </button>

                            {activeDashboard && (
                              <div className="mt-1 pt-1 border-t border-line">
                                <button
                                  onClick={() => { setIsMoreMenuOpen(false); setHapusKonfirmasi(true); }}
                                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-neg hover:bg-neg/10 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>Hapus Dashboard</span>
                                </button>
                              </div>
                            )}
                          </>
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
        <div className={`flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto transition-[padding] duration-200 ${
          isChatOpen || isGlobalStyleOpen ? 'lg:pr-[440px]' : ''
        }`}>
          {viewMode === 'admin' && isAdminRole(currentUser?.role) ? (
            <React.Suspense fallback={pageFallback}>
              <Admin
                currentUser={currentUser}
                onLogout={handleLogout}
                activeTab={adminTab}
                onSelectTab={setAdminTab}
                onToggleSidebar={() => {
                  if (window.matchMedia('(max-width: 767px)').matches) {
                    setIsMobileNavOpen(true);
                  } else {
                    setIsSidebarCollapsed(!isSidebarCollapsed);
                  }
                }}
                onTenantsRefreshed={segarkanTenants}
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
                    onBukaTemplate={() => setViewMode('templates')}
                    onPilihData={() => setViewMode('data')}
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
                    bolehMenulis={isAdminRole(currentUser?.role)}
                  />
                </React.Suspense>
              ) : viewMode === 'alerts' ? (
                <React.Suspense fallback={pageFallback}>
                  <AlertsPage
                    tenantId={currentTenant?.id || 'tenant-pdam'}
                    onBackToWorkspace={() => setViewMode('workspace')}
                  />
                </React.Suspense>
              ) : viewMode === 'charts' ? (
                <React.Suspense fallback={pageFallback}>
                  <ChartGalleryPage />
                </React.Suspense>
              ) : viewMode === 'templates' ? (
                <React.Suspense fallback={pageFallback}>
                  <DashboardTemplatesPage
                    currentTenant={currentTenant}
                    onUseTemplate={handleUseTemplate}
                  />
                </React.Suspense>
              ) : viewMode === 'data' ? (
                <React.Suspense fallback={pageFallback}>
                  <PilihDataPage
                    namaInstansi={currentTenant?.name}
                    onKembali={() => setViewMode('dashboards')}
                    onBukaPermintaan={() => setViewMode('permintaan')}
                    onSelesai={(dash) => {
                      setActiveDashboard(dash);
                      setDashboards((prev) => [dash, ...prev.filter((x) => x.id !== dash.id)]);
                      setViewMode('workspace');
                      if (currentTenant) muatChatCounts(currentTenant.id);
                    }}
                  />
                </React.Suspense>
              ) : viewMode === 'permintaan' ? (
                <React.Suspense fallback={pageFallback}>
                  <PermintaanDataPage
                    tenantId={currentTenant?.id || 'tenant-pdam'}
                    peran={currentUser?.role}
                    onBackToWorkspace={() => setViewMode('workspace')}
                  />
                </React.Suspense>
              ) : viewMode === 'berkas' ? (
                <React.Suspense fallback={pageFallback}>
                  <ManajemenBerkasPage
                    tenantId={currentTenant?.id || 'tenant-pdam'}
                    peran={currentUser?.role}
                    onBackToWorkspace={() => setViewMode('workspace')}
                  />
                </React.Suspense>
              ) : (
                <main
                  className={`flex-1 w-full ${
                    activeDashboard?.tema ? `tema-${activeDashboard.tema} bg-canvas` : ''
                  }`}
                  style={{
                    // Gaya Template Chart pilihan pengguna menimpa token tema
                    // template, supaya dashboard tersimpan tampil sama dengan
                    // pratinjau galeri (kartu, garis, aksen ikut berganti).
                    ...(activeDashboard?.gaya?.desain
                      ? (tokenTemaDariGaya(activeDashboard.gaya.desain) as React.CSSProperties)
                      : {}),
                    ...(fontKanvas ? { fontFamily: fontKanvas } : {}),
                  }}
                >
                  {/* Tema template (bila ada) membungkus seluruh isi kanvas supaya
                      latar, kartu, dan aksen sama dengan pratinjau template. */}
                  <KanvasTemaContext.Provider
                    value={
                      activeDashboard?.tema
                        ? { mode: MODE_TEMA[activeDashboard.tema] ?? 'dark', aksen: AKSEN_TEMA[activeDashboard.tema] }
                        : null
                    }
                  >
                  <div className="max-w-7xl w-full mx-auto p-4 sm:p-6">
                  {/* Kepala ringkas ala template: judul + chip + aksi dalam satu baris */}
                  {activeDashboard && !isPresentationMode && (
                    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                      <div className="min-w-0 flex items-center gap-2.5">
                        <span
                          className="w-[6px] h-[6px] rounded-full shrink-0"
                          style={{ backgroundColor: 'var(--tegas-accent)' }}
                          aria-hidden="true"
                        />
                        <h1
                          className="text-[15px] sm:text-base font-bold text-ink tracking-[-0.01em] truncate"
                          title={activeDashboard.title}
                        >
                          {activeDashboard.title || 'Dashboard'}
                        </h1>
                        <span className="hidden sm:inline-flex items-center gap-1 text-[10.5px] font-semibold text-ink-2 bg-surface-2 border border-line px-1.5 py-[1px] rounded-chip whitespace-nowrap">
                          <LayoutGrid className="w-3 h-3 text-ink-3" />
                          {jumlahWidgetSemua} widget
                        </span>
                        <span className="hidden md:inline text-[10.5px] text-ink-3 whitespace-nowrap">
                          {new Date(activeDashboard.updatedAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      <div className="ml-auto flex items-center gap-1.5">
                        {/* Mode presentasi langsung di kepala kanvas (dulu hanya di menu ⋮,
                            sehingga pengguna tidak menemukannya). Untuk semua peran. */}
                        {jumlahWidgetSemua > 0 && (
                          <button
                            onClick={() => setIsPresentationMode(true)}
                            data-testid="presentasi-dashboard"
                            title="Buka mode presentasi layar penuh (Esc untuk keluar)"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors"
                          >
                            <Presentation className="w-3 h-3 text-ink-3" />
                            <span className="hidden sm:inline">Mode Presentasi</span>
                          </button>
                        )}
                        {/* Menyusun dashboard hanya untuk admin instansi
                            (`bolehMenyusunDashboard`), jadi tombolnya ikut disembunyikan. */}
                        {isAdminRole(currentUser?.role) && (
                        <>
                        <button
                          onClick={() => setIsImportOpen(true)}
                          title="Ubah berkas Excel/CSV menjadi widget dashboard"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors"
                        >
                          <FileSpreadsheet className="w-3 h-3 text-ink-3" />
                          <span className="hidden sm:inline">Impor Data</span>
                        </button>
                        <button
                          onClick={() => {
                            // Hanya satu panel kanan yang boleh terbuka.
                            setIsChatOpen(false);
                            setKartuPanelId(null);
                            setIsGlobalStyleOpen(true);
                          }}
                          disabled={!jumlahWidgetSemua}
                          title={
                            jumlahWidgetSemua
                              ? 'Atur warna & font untuk seluruh widget dashboard'
                              : 'Belum ada widget di dashboard ini'
                          }
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Palette className="w-3 h-3 text-ink-3" />
                          <span className="hidden sm:inline">Gaya Semua</span>
                        </button>
                        <button
                          onClick={() => setIsShareOpen(true)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-on-brand bg-brand hover:brightness-95 rounded-control transition-colors"
                        >
                          <Share2 className="w-3 h-3" />
                          <span className="hidden sm:inline">Bagikan</span>
                        </button>
                        </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Strip halaman dashboard (1 halaman atau lebih).
                      Aksi tulis halaman hanya untuk admin instansi: HalamanTabs
                      menyembunyikan kontrol saat handler tidak diberikan. */}
                  {activeDashboard && (
                    <HalamanTabs
                      halaman={halamanDashboard}
                      aktifId={activeDashboard.halamanAktifId}
                      onPilih={pindahHalaman}
                      onTambah={isAdminRole(currentUser?.role) ? tambahHalaman : undefined}
                      onGantiNama={isAdminRole(currentUser?.role) ? gantiNamaHalaman : undefined}
                      onHapus={isAdminRole(currentUser?.role) ? hapusHalaman : undefined}
                      onGeser={isAdminRole(currentUser?.role) ? geserHalaman : undefined}
                    />
                  )}

                  {/* Filter dashboard internal (view-only, ala Tableau) */}
                  {activeDashboard && jumlahWidgetSemua > 0 && (
                    <div className="mb-2.5">
                      <GlobalFiltersBar
                        filters={viewFilters}
                        onChange={setViewFilters}
                        // Opsi filter (periode, kategori) dari SEMUA halaman, bukan halaman aktif saja.
                        widgets={semuaWidget(activeDashboard)}
                        shownCount={widgetsTampilInternal.length}
                        tataLetakBerubah={tataLetakBerubah}
                        onSimpanTataLetak={simpanTataLetak}
                        onResetTataLetak={resetTataLetak}
                      />
                    </div>
                  )}

                  <ActiveChartFilterChip />

                  {/* Dashboard dari template: komponen replika yang sama dengan
                      pratinjau data asli, jadi desainnya tidak berubah. */}
                  {activeDashboard?.replika && !tampilWidget ? (
                    <PasLayar>
                      {(penuh) => (
                        <ReplikaHalaman
                          penuh={penuh}
                          replika={{ templateId: activeDashboard.replika!.templateId, nilai: nilaiReplika }}
                          gaya={gayaDashboardAktif}
                          tataLetak={tataLetakAktif}
                          onTataLetak={ubahTataLetak}
                        />
                      )}
                    </PasLayar>
                  ) : (
                  /* Dashboard Canvas Grid */
                  <>
                  {(activeDashboard?.status === 'menyusun' || activeDashboard?.status === 'gagal') && (
                    <PanelAiMenyusun dashboard={activeDashboard} />
                  )}
                  {activeDashboard?.status === 'menyusun' && activeDashboard.ai?.kartuAktif && (
                    <KursorAi kartuId={activeDashboard.ai.kartuAktif} pesan={activeDashboard.ai.pesan} />
                  )}
                  <ChartSelectionProvider>
                  {(() => {
                  // Gaya Semua Korporat: kanvas dibingkai seperti slide template Rapat
                  // Manajemen (badge nomor, judul halaman, pita, kaki), KPI ringkas.
                  const korporat = gayaDashboardAktif?.desain === 'korporat';
                  const kanvas = (
                  <DashboardCanvas
                    widgets={widgetsTampilInternal}
                    readOnly={filterAktif}
                    satuHalaman
                    tinggiKpiMaks={korporat ? 112 : undefined}
                    cadanganBawah={korporat ? 40 : 0}
                    polos={korporat}
                    onEditWidget={handleEditWidget}
                    onGantiChart={handleGantiChart}
                    onManualCorrection={handleManualCorrection}
                    onDeleteWidget={handleDeleteWidget}
                    onDuplicateWidget={handleDuplicateWidget}
                    onReorderWidgets={handleReorderWidgets}
                    onResizeWidget={handleResizeWidget}
                    bolehMenyusun={isAdminRole(currentUser?.role)}
                    tanpaDashboard={!activeDashboard}
                    onLihatSemua={() => setViewMode('dashboards')}
                    onOpenChat={() => {
                      setIsGlobalStyleOpen(false);
                      setIsChatOpen(true);
                    }}
                  />
                  );
                  if (!korporat) return kanvas;
                  const nomor = Math.max(1, halamanDashboard.findIndex((h) => h.id === halamanSekarang?.id) + 1);
                  return (
                    <BingkaiKorporat
                      nomor={nomor}
                      judul={halamanSekarang?.judul || activeDashboard?.title || ''}
                      sub={halamanDashboard.length > 1 ? activeDashboard?.title : undefined}
                      kaki={`${activeDashboard?.title ?? ''} · ${new Date(activeDashboard?.updatedAt ?? Date.now()).getFullYear()}`}
                      gaya={gayaDashboardAktif}
                    >
                      {kanvas}
                    </BingkaiKorporat>
                  );
                  })()}
                  </ChartSelectionProvider>
                  </>
                  )}
                  </div>
                  </KanvasTemaContext.Provider>
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
        tenantName={currentTenant?.name}
        tenantKbId={currentTenant?.knowledgeBaseId}
        dashboardId={activeDashboard?.id}
        halamanId={activeDashboard?.halamanAktifId || halamanDashboard[0]?.id}
        halamanJudul={
          halamanDashboard.find((h) => h.id === activeDashboard?.halamanAktifId)?.judul || halamanDashboard[0]?.judul
        }
        onDashboardUpdated={(newDash) => {
          setActiveDashboard(newDash);
          // Dashboard dari asisten langsung dibuka di kanvas, dari menu mana pun.
          setViewMode('workspace');
          setDashboards((prev) => [
            newDash,
            ...prev.filter((d) => d.id !== newDash.id),
          ]);
        }}
      />

      {/* ================= MODE PRESENTASI (overlay penuh, tanpa scroll) ================= */}
      {isPresentationMode && activeDashboard && (
        <PresentationMode
          dashboard={activeDashboard}
          halaman={halamanPresentasi}
          tenantName={currentTenant?.name}
          tenantId={currentTenant?.id}
          onExit={() => setIsPresentationMode(false)}
          konten={
            activeDashboard.replika && !tampilWidget ? (
              <ReplikaHalaman
                penuh
                replika={{ templateId: activeDashboard.replika.templateId, nilai: nilaiReplika }}
                gaya={gayaDashboardAktif}
                tataLetak={tataLetakAktif}
              />
            ) : undefined
          }
          onUpdate={(d) => {
            setActiveDashboard(d);
            setDashboards((prev) => [d, ...prev.filter((x) => x.id !== d.id)]);
          }}
        />
      )}

      {/* Tab yang masih menjalankan versi lama diberi tahu agar memuat ulang,
          supaya fitur baru tidak terlihat "hilang". */}
      <PemberitahuanVersi />

      {/* Tombol buka asisten — HANYA di kanvas. Dashboard dari data/template
          diubah lewat asisten setelah kanvasnya terbuka, bukan dari daftar atau
          galeri, supaya percakapan selalu punya halaman yang jelas. */}
      {viewMode === 'workspace' && activeDashboard && !isPresentationMode && !isChatOpen && !isGlobalStyleOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          data-testid="buka-asisten"
          className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-40 flex items-center justify-center gap-2.5 px-3 sm:px-4 py-3 min-h-[44px] min-w-[44px] rounded-full font-semibold text-xs text-on-brand bg-brand hover:brightness-95 shadow-pop shadow-brand/25 transition-all duration-200 hover:scale-105 active:scale-95"
          title="Buka asisten"
        >
          <Sparkles className="w-4 h-4 animate-pulse" />
          {/* Di layar kecil label disembunyikan supaya tombol tidak menutupi kartu. */}
          <span className="hidden sm:inline">Asisten</span>
        </button>
      )}

      {/* 3. Widget Editor & F-14 Manual Correction Modal */}
      <WidgetEditorModal
        isOpen={!!editingWidget}
        onClose={() => setEditingWidget(null)}
        widget={editingWidget}
        onSave={handleSaveWidget}
        initialTab={editorTab}
      />

      {/* 4. Panel Gaya Widget — tombolnya ada di toolbar kanvas */}
      <GlobalStyleModal
        isOpen={isGlobalStyleOpen}
        onClose={() => {
          setIsGlobalStyleOpen(false);
          setKartuPanelId(null);
        }}
        jumlahWidget={jumlahWidgetSemua}
        styleAwal={gayaDashboardAktif}
        targetPalet={targetPalet}
        onApply={handleApplyStyleToAll}
        kartu={kartuPanel}
        onGantiChart={handleGantiChart}
        onUbahJudul={handleUbahJudul}
      />

      {/* 7. Share Read-Only Link Modal */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        dashboard={activeDashboard}
        tenantId={currentTenant?.id}
      />

      {galatDashboard && (
        <div
          role="alert"
          data-testid="galat-dashboard"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] max-w-[92vw] sm:max-w-md flex items-start gap-2 rounded-card border border-neg/40 bg-surface px-3 py-2 text-xs text-ink shadow-pop"
        >
          <span className="flex-1">{galatDashboard}</span>
          <button
            type="button"
            aria-label="Tutup pesan galat"
            onClick={() => setGalatDashboard('')}
            className="p-1 -m-1 rounded-control text-ink-3 hover:text-ink"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {hapusKonfirmasi && activeDashboard && (
        <ModalKonfirmasiDashboard
          dashboard={activeDashboard}
          onBatal={() => setHapusKonfirmasi(false)}
          onKonfirmasi={() => { setHapusKonfirmasi(false); handleDeleteDashboard(activeDashboard.id); }}
        />
      )}

      {/* 8. Export Printable Executive Report Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        dashboard={activeDashboard}
        tenant={currentTenant}
      />

      {/* 9. Import Excel/CSV → Widget Modal */}
      <ImportDataModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onAddWidget={handleAddWidgetFromCatalog}
      />

    </div>
  );
}
