import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { DbSnapshot, MysqlStore } from './mysqlStore';
import path from 'path';
import {
  AlertRule,
  AuditLog,
  BumdSector,
  Chat,
  ChatMessage,
  Dashboard,
  NotificationItem,
  Tenant,
  User,
  WidgetSpec,
} from '../../types';
import { hashPassword, verifyPassword } from '../auth/session';
import { getFallbackDemoDashboard } from '../builder/fallback';

/**
 * AuthPayload — data sesi yang tersimpan dalam cookie httpOnly.
 * Sengaja dipisah dari record User agar hash password tidak pernah
 * ikut ke client dan admin tidak bisa menimpa role/tenantId sendiri
 * lewat endpoint mutasi.
 */
export interface AuthPayload {
  userId: string;
  role: User['role'];
  tenantId: string;
  name: string;
}

/** Kontrak respon user yang aman dikirim ke client (tanpa passwordHash). */
export type SafeUser = Omit<User, 'passwordHash'>;

/** User bawaan aplikasi — selalu dijamin ada meski DB berisi data lama. */
const SEED_USERS: SafeUser[] = [
  {
    id: 'user-admin',
    email: 'admin@aionesboard.id',
    name: 'Budi Santoso, S.Kom, M.T.',
    role: 'admin',
    tenantId: 'tenant-pdam',
    avatar: '',
  },
  {
    id: 'user-demo',
    email: 'demo@aionesboard.id',
    name: 'Siti Rahmawati, S.E. (Analis BUMD)',
    role: 'analis',
    tenantId: 'tenant-pdam',
    avatar: '',
  },
  {
    id: 'user-direksi',
    email: 'direksi@aionesboard.id',
    name: 'Dr. Ir. Hendra Kusuma (Direktur Utama)',
    role: 'direksi',
    tenantId: 'tenant-pdam',
    avatar: '',
  },
  {
    id: 'user-admin-gmail',
    email: 'admin@gmail.com',
    name: 'Admin Umum',
    role: 'admin',
    tenantId: 'tenant-pdam',
    avatar: '',
  },
  {
    id: 'user-user-gmail',
    email: 'user@gmail.com',
    name: 'User Instansi',
    role: 'analis',
    tenantId: 'tenant-pdam',
    avatar: '',
  },
];

/** Password seed khusus per userId (selain default DEMO_PASSWORD). */
const SEED_PASSWORDS: Record<string, string> = {
  'user-admin-gmail': '123',
  'user-user-gmail': '123',
};

const DATA_DIR = process.env.AIONESBOARD_DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface PersistedState {
  dashboards?: Dashboard[];
  chats?: Chat[];
  alertRules?: AlertRule[];
  notifications?: NotificationItem[];
  auditLogs?: AuditLog[];
  shareTokens?: Record<string, string>;
  sharePins?: Record<string, string>;
  systemConfig?: typeof InMemoryDb.prototype.systemConfig;
  // Disertakan agar fallback file (saat MySQL mati) tetap lengkap —
  // bukan lagi setengah data yang hilang saat restart.
  users?: SafeUser[];
  tenants?: Tenant[];
  credentials?: Record<string, string>;
}

export class InMemoryDb {
  public tenants: Tenant[] = [
    {
      id: 'tenant-pdam',
      name: 'Perumda Air Minum Tirta Kencana',
      shortName: 'PDAM Tirta',
      sector: 'pdam',
      code: 'PAM-TK',
      city: 'Kota Mandiri',
      logo: '💧',
      primaryColor: '#38c6e2',
      documentCount: 48,
    },
    {
      id: 'tenant-bank',
      name: 'Bank Pembangunan Daerah Artha Daerah',
      shortName: 'BPD Artha',
      sector: 'bank',
      code: 'BPD-AD',
      city: 'Provinsi Nusantara',
      logo: '🏦',
      primaryColor: '#8f90e4',
      documentCount: 76,
    },
    {
      id: 'tenant-pasar',
      name: 'Perumda Pasar Rakyat Sejahtera',
      shortName: 'Perumda Pasar',
      sector: 'pasar',
      code: 'PRS-01',
      city: 'Kota Mandiri',
      logo: '🏪',
      primaryColor: '#2bb8a8',
      documentCount: 34,
    },
    {
      id: 'tenant-rsud',
      name: 'RSUD Sehat Madani (BLUD)',
      shortName: 'RSUD Sehat',
      sector: 'rsud',
      code: 'RSUD-SM',
      city: 'Kabupaten Madani',
      logo: '🏥',
      primaryColor: '#f2503a',
      documentCount: 62,
    },
    {
      id: 'tenant-trans',
      name: 'Perumda Transportasi Trans Metro',
      shortName: 'Trans Metro',
      sector: 'transportasi',
      code: 'TMD-09',
      city: 'Kota Metropolitan',
      logo: '🚌',
      primaryColor: '#e0a020',
      documentCount: 29,
    },
    {
      id: 'tenant-aneka',
      name: 'Perumda Aneka Usaha Karya Mandiri',
      shortName: 'Karya Mandiri',
      sector: 'aneka_usaha',
      code: 'AUKM-03',
      city: 'Kota Mandiri',
      logo: '🏢',
      primaryColor: '#8f90e4',
      documentCount: 22,
    },
  ];

  /** Record user TIDAK berisi passwordHash — hash disimpan terpisah di credentials. */
  public users: SafeUser[] = [...SEED_USERS];

  /** Kredensial terpisah: userId -> hash scrypt. Tidak pernah keluar dari server. */
  public credentials: Record<string, string> = {};

  public dashboards: Dashboard[] = [];

  /** Riwayat percakapan orkestrator — satu chat per dashboard (relasi 1:1). */
  public chats: Chat[] = [];

  public alertRules: AlertRule[] = [
    {
      id: 'alert-1',
      tenantId: 'tenant-pdam',
      title: 'Peringatan Ambang Batas NRW Air',
      metricKey: 'nrw',
      metricName: 'Tingkat Kehilangan Air (NRW)',
      operator: '>=',
      threshold: 25.0,
      unit: '%',
      channels: ['in_app', 'email'],
      severity: 'warning',
      isActive: true,
      lastTriggered: '2026-03-31T08:00:00.000Z',
    },
    {
      id: 'alert-2',
      tenantId: 'tenant-bank',
      title: 'Peringatan Rasio NPL Kritis OJK',
      metricKey: 'npl',
      metricName: 'Rasio NPL Gross',
      operator: '>=',
      threshold: 5.0,
      unit: '%',
      channels: ['in_app', 'email'],
      severity: 'critical',
      isActive: true,
    },
    {
      id: 'alert-3',
      tenantId: 'tenant-rsud',
      title: 'Kapasitas Tempat Tidur BOR Melampaui Batas',
      metricKey: 'bor',
      metricName: 'Bed Occupancy Rate (BOR)',
      operator: '>=',
      threshold: 85.0,
      unit: '%',
      channels: ['in_app', 'email'],
      severity: 'warning',
      isActive: true,
    },
  ];

  public notifications: NotificationItem[] = [
    {
      id: 'notif-1',
      tenantId: 'tenant-pdam',
      alertRuleId: 'alert-1',
      title: 'Evaluasi NRW Zona Timur Terdeteksi 22,4%',
      message: 'Tingkat kehilangan air di DMA-04 berada dalam batas kendali aman (< 25%).',
      severity: 'info',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      isRead: false,
      metricValue: 22.4,
      threshold: 25.0,
      sentEmail: true,
    },
    {
      id: 'notif-2',
      tenantId: 'tenant-pdam',
      title: 'Laporan Triwulan I 2026 Siap Dicetak',
      message: 'Semua 6 widget telah memiliki sitasi sah dari dokumen LRA BPKP.',
      severity: 'info',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      isRead: false,
    },
  ];

  public auditLogs: AuditLog[] = [
    {
      id: 'audit-init',
      tenantId: 'tenant-pdam',
      userId: 'user-admin',
      userName: 'Budi Santoso',
      action: 'Inisialisasi Sistem',
      target: 'AionesBoard Engine',
      details: 'Sistem boot up dengan 6 tenant BUMD dan 40 preset katalog widget.',
      timestamp: new Date().toISOString(),
    },
  ];

  public systemConfig = {
    ragProvider: 'mock' as 'mock' | 'http',
    ragApiUrl: 'https://api-rag-bumd.pemda.go.id/v1',
    ragApiKey: 'rag_live_sec_*********',
    ragModel: 'gpt-4o-mini',
    ragKnowledgeBaseId: '',
    ragTimeoutSeconds: 60,
    /** Jalur A via endpoint /extract (angka nyata + halaman sumber) — default aktif. */
    ragUseExtract: true,
    smtpHost: 'smtp.mailgun.org',
    smtpPort: 587,
    smtpUser: 'alert@bumd-pemda.go.id',
    smtpFrom: 'AionesBoard Alert System <alert@aionesboard.id>',
    auditRetentionDays: 90,
  };

  public shareTokens: Record<string, string> = {}; // token -> dashboardId
  /** token -> hash PIN (scrypt) untuk mode edit pada tautan publik. */
  public sharePins: Record<string, string> = {};

  constructor() {
    this.seedCredentials();
    this.loadPersisted();
    this.seedInitialDashboards();
  }

  // ================= MySQL (Laragon) =================
  private mysql: MysqlStore | null = null;

  /** Snapshot state penuh untuk mirror ke MySQL. */
  private snapshot(): DbSnapshot {
    return {
      dashboards: this.dashboards,
      chats: this.chats,
      alertRules: this.alertRules,
      notifications: this.notifications,
      auditLogs: this.auditLogs.slice(0, 500),
      shareTokens: this.shareTokens,
      sharePins: this.sharePins,
      systemConfig: this.systemConfig,
      users: this.users,
      credentials: this.credentials,
      tenants: this.tenants,
    };
  }

  /** true bila mirror MySQL aktif — dipakai endpoint /health agar tidak hardcode. */
  public get persistenceActive(): boolean {
    return this.mysql !== null;
  }

  /**
   * Sambungkan MySQL (Laragon) & muat state dari sana. Dipanggil server
   * sebelum listen. Kalau MySQL mati, aplikasi tetap jalan — persistence
   * fallback ke data/db.json (sudah ditulis sejak awal).
   */
  public async initMysql(): Promise<void> {
    try {
      this.mysql = new MysqlStore({
        host: process.env.MYSQL_HOST || '127.0.0.1',
        port: parseInt(process.env.MYSQL_PORT || '3306', 10),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database:
          (process.env.MYSQL_DATABASE && process.env.MYSQL_DATABASE.trim()) ||
          (process.env.DB_NAME && process.env.DB_NAME.trim()) ||
          (process.env.DB_DATABASE && process.env.DB_DATABASE.trim()) ||
          'bumd_aionesboard',
      });
      await this.mysql.init();
      const loaded = await this.mysql.loadAll();
      if (loaded) {
        if (Array.isArray(loaded.dashboards)) this.dashboards = loaded.dashboards;
        if (Array.isArray(loaded.chats)) this.chats = loaded.chats;
        if (Array.isArray(loaded.alertRules) && loaded.alertRules.length > 0) {
          this.alertRules = loaded.alertRules;
        }
        if (Array.isArray(loaded.notifications)) this.notifications = loaded.notifications;
        if (Array.isArray(loaded.auditLogs)) this.auditLogs = loaded.auditLogs;
        if (Array.isArray(loaded.users)) this.users = loaded.users;
        if (Array.isArray(loaded.tenants)) this.tenants = loaded.tenants;
        if (loaded.shareTokens) this.shareTokens = loaded.shareTokens;
        if (loaded.sharePins) this.sharePins = loaded.sharePins;
        if (loaded.credentials) this.credentials = loaded.credentials;
        if (loaded.systemConfig) {
          this.systemConfig = { ...this.systemConfig, ...(loaded.systemConfig as object) };
        }
        this.ensureSeedUsers();
        console.log('[AionesBoard DB] State dimuat dari MySQL — persistence aktif');
      } else {
        await this.mysql.saveAll(this.snapshot());
        console.log('[AionesBoard DB] MySQL siap — seed awal disimpan ke database');
      }
    } catch (err: any) {
      console.error(
        '[AionesBoard DB] MySQL tidak tersedia — persistence fallback ke data/db.json:',
        err?.message || err
      );
      this.mysql = null;
    }
  }

  /**
   * Tutup pool MySQL dengan rapi (dipakai graceful shutdown server).
   * Aman dipanggil walau MySQL tidak pernah tersambung.
   */
  public async closeMysql(): Promise<void> {
    if (!this.mysql) return;
    try {
      await this.mysql.close();
    } finally {
      this.mysql = null;
    }
  }

  /** Password seed dari env DEMO_PASSWORD (default untuk demo lokal). */
  private seedCredentials() {
    const demoPassword = process.env.DEMO_PASSWORD || 'aionesboard2026';
    for (const u of SEED_USERS) {
      this.credentials[u.id] = hashPassword(SEED_PASSWORDS[u.id] || demoPassword);
    }
  }

  /**
   * Pastikan user seed (dari kode) selalu ada — dipanggil setelah state
   * dimuat dari MySQL, karena koleksi users di DB bisa berisi data lama
   * yang belum memuat user seed baru.
   */
  private ensureSeedUsers() {
    let berubah = false;
    for (const seed of SEED_USERS) {
      if (!this.users.some((u) => u.id === seed.id)) {
        this.users.push({ ...seed });
        berubah = true;
      }
      if (SEED_PASSWORDS[seed.id]) {
        if (!this.credentials[seed.id] || !verifyPassword(SEED_PASSWORDS[seed.id], this.credentials[seed.id])) {
          this.credentials[seed.id] = hashPassword(SEED_PASSWORDS[seed.id]);
          berubah = true;
        }
      } else if (!this.credentials[seed.id]) {
        this.credentials[seed.id] = hashPassword(
          process.env.DEMO_PASSWORD || 'aionesboard2026'
        );
        berubah = true;
      }
    }
    if (berubah) this.persist();
  }

  /**
   * Muat state yang dipersistenkan ke data/db.json supaya dashboard
   * yang dibuat audiens demo tidak hilang saat server restart/PM2 reload.
   * Tenants, users, dan alertRules bawaan tetap di-seed dari kode.
   */
  private loadPersisted() {
    try {
      if (!existsSync(DB_FILE)) return;
      const parsed = JSON.parse(readFileSync(DB_FILE, 'utf-8')) as PersistedState;
      if (Array.isArray(parsed.dashboards)) this.dashboards = parsed.dashboards;
      if (Array.isArray(parsed.chats)) this.chats = parsed.chats;
      if (Array.isArray(parsed.alertRules) && parsed.alertRules.length > 0) {
        this.alertRules = parsed.alertRules;
      }
      if (Array.isArray(parsed.notifications)) this.notifications = parsed.notifications;
      if (Array.isArray(parsed.auditLogs)) this.auditLogs = [...parsed.auditLogs, ...this.auditLogs];
      if (parsed.shareTokens) this.shareTokens = parsed.shareTokens;
      if (parsed.sharePins) this.sharePins = parsed.sharePins;
      // Konfigurasi sistem (termasuk RAG provider/url/key dari panel admin)
      if (parsed.systemConfig) {
        this.systemConfig = { ...this.systemConfig, ...parsed.systemConfig };
      }
      if (Array.isArray(parsed.users) && parsed.users.length > 0) this.users = parsed.users;
      if (Array.isArray(parsed.tenants) && parsed.tenants.length > 0) this.tenants = parsed.tenants;
      if (parsed.credentials) this.credentials = parsed.credentials;
      // Jamin user seed tetap ada walau file fallback sudah usang.
      this.ensureSeedUsers();
    } catch (err) {
      console.error('[AionesBoard DB] Gagal memuat data/db.json — memakai state seed:', err);
    }
  }

  /**
   * Simpan perubahan systemConfig (provider RAG, base URL, API key, SMTP, dll).
   * WAJIB lewat sini — bukan `db.systemConfig = {...}` langsung dari route —
   * supaya perubahan benar-benar ditulis ke MySQL & data/db.json, bukan hanya
   * hidup di memori sampai server di-restart.
   */
  public updateSystemConfig(partial: Record<string, unknown>) {
    this.systemConfig = { ...this.systemConfig, ...(partial as object) };
    this.persist();
    return this.systemConfig;
  }

  /** Tulis state ke disk (jaring pengaman) + mirror ke MySQL bila tersedia. */
  public persist() {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const state: PersistedState = {
        dashboards: this.dashboards,
        chats: this.chats,
        alertRules: this.alertRules,
        notifications: this.notifications,
        auditLogs: this.auditLogs.slice(0, 500),
        shareTokens: this.shareTokens,
        sharePins: this.sharePins,
        systemConfig: this.systemConfig,
        users: this.users,
        tenants: this.tenants,
        credentials: this.credentials,
      };
      writeFileSync(DB_FILE, JSON.stringify(state));
    } catch (err) {
      console.error('[AionesBoard DB] Gagal menyimpan data/db.json:', err);
    }
    if (this.mysql) {
      // Fire-and-forget: jangan blok respons request; error cukup dicatat.
      this.mysql
        .saveAll(this.snapshot())
        .catch((err) => console.error('[AionesBoard DB] Mirror MySQL gagal:', err?.message || err));
    }
  }

  private seedInitialDashboards() {
    // Kalau state persisted sudah berisi dashboard, jangan dobel seed.
    if (this.dashboards.length > 0) return;

    const sectors: Array<{ sector: BumdSector; tenantId: string }> = [
      { sector: 'pdam', tenantId: 'tenant-pdam' },
      { sector: 'bank', tenantId: 'tenant-bank' },
      { sector: 'pasar', tenantId: 'tenant-pasar' },
      { sector: 'rsud', tenantId: 'tenant-rsud' },
      { sector: 'transportasi', tenantId: 'tenant-trans' },
      { sector: 'aneka_usaha', tenantId: 'tenant-aneka' },
    ];

    sectors.forEach(({ sector, tenantId }) => {
      const demo = getFallbackDemoDashboard(sector, tenantId);
      this.dashboards.push(demo);
    });
  }

  // Tenant-isolated getters and mutations
  getDashboards(tenantId: string): Dashboard[] {
    return this.dashboards.filter((d) => d.tenantId === tenantId);
  }

  getDashboardById(id: string, tenantId?: string): Dashboard | undefined {
    const d = this.dashboards.find((item) => item.id === id);
    if (!d) return undefined;
    if (tenantId && d.tenantId !== tenantId) return undefined; // Isolation guarantee!
    return d;
  }

  createDashboard(dashboard: Dashboard): Dashboard {
    this.dashboards.unshift(dashboard);
    this.persist();
    return dashboard;
  }

  updateDashboard(id: string, partial: Partial<Dashboard>, tenantId: string): Dashboard | undefined {
    const idx = this.dashboards.findIndex((d) => d.id === id && d.tenantId === tenantId);
    if (idx === -1) return undefined;
    this.dashboards[idx] = {
      ...this.dashboards[idx],
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    this.persist();
    return this.dashboards[idx];
  }

  deleteDashboard(id: string, tenantId: string): boolean {
    const initialLen = this.dashboards.length;
    this.dashboards = this.dashboards.filter((d) => !(d.id === id && d.tenantId === tenantId));
    const deleted = this.dashboards.length < initialLen;
    // Dashboard hilang = chat-nya tidak ada gunanya lagi (relasi 1:1).
    if (deleted) this.chats = this.chats.filter((c) => c.dashboardId !== id);
    if (deleted) this.persist();
    return deleted;
  }

  duplicateDashboard(id: string, tenantId: string): Dashboard | undefined {
    const orig = this.getDashboardById(id, tenantId);
    if (!orig) return undefined;
    const copy: Dashboard = {
      ...orig,
      id: `dash-dup-${Date.now()}`,
      title: `${orig.title} (Salinan)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.dashboards.unshift(copy);
    this.persist();
    return copy;
  }

  addAuditLog(entry: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const log: AuditLog = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.unshift(log);
    this.persist();
    return log;
  }

  // ================= Chat (riwayat per dashboard) =================

  /** Chat milik satu dashboard. `dashboardId` unik — dijaga di sini, bukan di UI. */
  getChatByDashboardId(dashboardId: string, tenantId?: string): Chat | undefined {
    const c = this.chats.find((item) => item.dashboardId === dashboardId);
    if (!c) return undefined;
    if (tenantId && c.tenantId !== tenantId) return undefined; // Isolation guarantee!
    return c;
  }

  getChatById(id: string, tenantId?: string): Chat | undefined {
    const c = this.chats.find((item) => item.id === id);
    if (!c) return undefined;
    if (tenantId && c.tenantId !== tenantId) return undefined;
    return c;
  }

  /**
   * Ambil chat dashboard ini; buat kalau belum ada.
   * Idempoten dan sengaja malas (lazy) supaya dashboard lama tidak perlu migrasi.
   */
  ensureChatForDashboard(
    dashboardId: string,
    tenantId: string,
    userId: string,
    title: string
  ): Chat {
    const ada = this.getChatByDashboardId(dashboardId, tenantId);
    if (ada) return ada;
    const now = new Date().toISOString();
    const chat: Chat = {
      id: `chat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      dashboardId,
      tenantId,
      userId,
      title: title || 'Percakapan Dashboard',
      messages: [
        {
          id: `msg-welcome-${Date.now()}`,
          sender: 'system',
          text: 'Halo! Saya asisten orkestrator ApexPulse. Tuliskan kebutuhan dashboard BUMD Anda, dan saya akan mengekstraksi data dokumen RAG instansi secara langsung tanpa ketergantungan model LLM eksternal.',
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    this.chats.unshift(chat);
    this.persist();
    return chat;
  }

  /** Semua chat tenant — dipakai indikator jumlah pesan di daftar dashboard. */
  getChats(tenantId: string): Chat[] {
    return this.chats.filter((c) => c.tenantId === tenantId);
  }

  addChatMessage(chatId: string, msg: ChatMessage, tenantId?: string): Chat | undefined {
    const chat = this.getChatById(chatId, tenantId);
    if (!chat) return undefined;
    chat.messages.push(msg);
    chat.updatedAt = new Date().toISOString();
    this.persist();
    return chat;
  }

  updateChat(id: string, partial: Partial<Chat>, tenantId: string): Chat | undefined {
    const chat = this.getChatById(id, tenantId);
    if (!chat) return undefined;
    // Kaitan ke dashboard/tenant tidak boleh dipindah lewat PATCH.
    const { dashboardId: _d, tenantId: _t, id: _i, messages: _m, ...rest } = partial;
    Object.assign(chat, rest, { updatedAt: new Date().toISOString() });
    this.persist();
    return chat;
  }

  /** Hapus chat saja — dashboard-nya SENGAJA dibiarkan hidup. */
  deleteChat(id: string, tenantId: string): boolean {
    const len = this.chats.length;
    this.chats = this.chats.filter((c) => !(c.id === id && c.tenantId === tenantId));
    const deleted = this.chats.length < len;
    if (deleted) this.persist();
    return deleted;
  }

  // User Management
  createUser(user: SafeUser, passwordHash?: string): SafeUser {
    this.users.push(user);
    if (passwordHash) this.credentials[user.id] = passwordHash;
    this.persist();
    return user;
  }

  updateUser(id: string, partial: Partial<User>): SafeUser | undefined {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    const { passwordHash: _ignored, ...rest } = partial as Partial<User> & { passwordHash?: string };
    this.users[idx] = { ...this.users[idx], ...rest };
    this.persist();
    return this.users[idx];
  }

  deleteUser(id: string): boolean {
    const len = this.users.length;
    this.users = this.users.filter((u) => u.id !== id);
    delete this.credentials[id];
    const deleted = this.users.length < len;
    if (deleted) this.persist();
    return deleted;
  }

  // Tenant Management
  createTenant(tenant: Tenant): Tenant {
    this.tenants.push(tenant);
    this.persist();
    return tenant;
  }

  updateTenant(id: string, partial: Partial<Tenant>): Tenant | undefined {
    const idx = this.tenants.findIndex((t) => t.id === id);
    if (idx === -1) return undefined;
    this.tenants[idx] = { ...this.tenants[idx], ...partial };
    this.persist();
    return this.tenants[idx];
  }
}

export const db = new InMemoryDb();
