import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { DbSnapshot, MysqlStore } from './mysqlStore';
import path from 'path';
import {
  AlertRule,
  AlurVerifikasi,
  AksiVerifikasi,
  AksiTindakLanjut,
  AuditLog,
  BumdSector,
  Chat,
  ChatMessage,
  Dashboard,
  KetersediaanPreset,
  KewajibanLapor,
  LaporanPeriodik,
  Risiko,
  AksiMitigasi,
  Aset,
  PerjanjianKinerja,
  LKjIP,
  SnapshotKeuangan,
  StatusLaporan,
  NotificationItem,
  Tenant,
  TemuanAudit,
  User,
  WidgetSpec,
} from '../../types';
import { hashPassword, verifyPassword } from '../auth/session';
import { dekripsiNilai, enkripsiNilai, pakaiKunciLama, terenkripsi } from '../config/rahasia';
import { getFallbackDemoDashboard } from '../builder/fallback';
import { KB_SEED_TENANT } from '../rag/kbDefaults';

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
  ketersediaanPreset?: KetersediaanPreset[];
  deletedTenantIds?: string[];
  kewajibanLapor?: KewajibanLapor[];
  laporanPeriodik?: LaporanPeriodik[];
  alurVerifikasi?: AlurVerifikasi[];
  temuanAudit?: TemuanAudit[];
  snapshotKeuangan?: SnapshotKeuangan[];
  risiko?: Risiko[];
  aset?: Aset[];
  perjanjianKinerja?: PerjanjianKinerja[];
  lkjip?: LKjIP[];
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
      knowledgeBaseId: 'kb_pam_jaya',
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
      knowledgeBaseId: 'kb_bank_jatim',
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
      knowledgeBaseId: 'kb_pasar_surya',
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
      knowledgeBaseId: 'kb_sarana_jaya',
    },
  ];

  /** Record user TIDAK berisi passwordHash — hash disimpan terpisah di credentials. */
  public users: SafeUser[] = [...SEED_USERS];

  /** Kredensial terpisah: userId -> hash scrypt. Tidak pernah keluar dari server. */
  public credentials: Record<string, string> = {};

  public dashboards: Dashboard[] = [];

  /** Riwayat percakapan orkestrator — satu chat per dashboard (relasi 1:1). */
  public chats: Chat[] = [];

  /**
   * Catatan ketersediaan preset katalog per instansi (hasil pemeriksaan nyata
   * ke dokumen instansi). Dipakai agar katalog "Tambah Widget" hanya menawarkan
   * preset yang benar-benar bisa diisi.
   */
  public ketersediaanPreset: KetersediaanPreset[] = [];

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
    /**
     * Secret penandatangan cookie sesi yang dipakai BERSAMA semua instance.
     * Disimpan di database supaya dua host memakai kunci yang sama; diisi
     * otomatis saat start bila masih kosong.
     */
    sessionSecret: '',
    smtpHost: 'smtp.mailgun.org',
    smtpPort: 587,
    smtpUser: 'alert@bumd-pemda.go.id',
    smtpFrom: 'AionesBoard Alert System <alert@aionesboard.id>',
    auditRetentionDays: 90,
    /**
     * KMS (Knowledge Management System) — repositori berkas & media.
     *
     * Layanan TERPISAH dari RAG query (`ragApiUrl`): KMS yang menyimpan berkas,
     * mengindeksnya, lalu RAG query membacanya. Satu `kmsApiKey` bisa mengakses
     * BANYAK project, jadi tujuan unggah ditentukan `Tenant.kmsOrganizationId`
     * (dipetakan admin per instansi) — bukan dari key.
     */
    kmsApiUrl: 'https://ragkms.aiones.app',
    kmsApiKey: '',
    kmsTimeoutSeconds: 120,
  };

  public shareTokens: Record<string, string> = {}; // token -> dashboardId
  /** token -> hash PIN (scrypt) untuk mode edit pada tautan publik. */
  public sharePins: Record<string, string> = {};

  /**
   * Pelaporan periodik BUMD (fitur "Kepatuhan Pelaporan").
   * - `kewajibanLapor`: jenis laporan yang WAJIB disampaikan instansi.
   * - `laporanPeriodik`: realisasi per periode (hanya ada bila benar-benar dibuat).
   * Keduanya dikelola per-baris di MySQL (bukan snapshot) — lihat mysqlStore.
   */
  public kewajibanLapor: KewajibanLapor[] = [];
  public laporanPeriodik: LaporanPeriodik[] = [];
  public alurVerifikasi: AlurVerifikasi[] = [];
  public temuanAudit: TemuanAudit[] = [];
  public snapshotKeuangan: SnapshotKeuangan[] = [];
  public risiko: Risiko[] = [];
  public aset: Aset[] = [];
  public perjanjianKinerja: PerjanjianKinerja[] = [];
  public lkjip: LKjIP[] = [];

  /**
   * id instansi yang sudah dihapus admin. Dipakai agar user seed (mis.
   * admin@gmail.com) milik instansi yang DIHAPUS tidak dibuat ulang saat boot,
   * TANPA men-skip user seed milik instansi yang memang belum pernah ada.
   */
  public deletedTenantIds: string[] = [];

  constructor() {
    this.seedCredentials();
    this.loadPersisted();
    // Dashboard demo bawaan HANYA diisi kalau diminta eksplisit.
    // Aplikasi ini dipakai dengan dokumen instansi nyata (RAG), dan dashboard demo
    // berisi angka contoh. Dulu seed ini jalan tiap kali daftar dashboard kosong,
    // sehingga dashboard yang sengaja dihapus user muncul lagi setiap restart.
    // Nyalakan lagi untuk keperluan demo/QA: SEED_DEMO_DASHBOARDS=1.
    if (process.env.SEED_DEMO_DASHBOARDS === '1') this.seedInitialDashboards();
  }

  // ================= MySQL (Laragon) =================
  private mysql: MysqlStore | null = null;

  /**
   * Snapshot untuk mirror ke MySQL.
   *
   * ponytail: hanya koleksi yang BELUM punya tabel per-baris. alertRules,
   * notifications, auditLogs, shareTokens, sharePins, systemConfig, users,
   * credentials, deletedTenantIds ditulis satu-satu lewat `simpan*`/`addAuditLog`,
   * karena snapshot penuh (DELETE + insert state instance ini) menghapus data
   * yang dibuat instance backend lain.
   */
  private snapshot(): DbSnapshot {
    return {
      dashboards: this.dashboards,
      chats: this.chats,
      ketersediaanPreset: this.ketersediaanPreset,
      kewajibanLapor: this.kewajibanLapor,
      laporanPeriodik: this.laporanPeriodik,
      alurVerifikasi: this.alurVerifikasi,
      temuanAudit: this.temuanAudit,
      snapshotKeuangan: this.snapshotKeuangan,
      risiko: this.risiko,
      aset: this.aset,
      perjanjianKinerja: this.perjanjianKinerja,
      lkjip: this.lkjip,
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
  /** Latensi MySQL (ms) untuk pemeriksaan kesehatan; null bila tidak aktif. */
  public pingMysql(): Promise<number | null> {
    return this.mysql ? this.mysql.ping() : Promise.resolve(null);
  }

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
        if (Array.isArray(loaded.ketersediaanPreset)) {
          this.ketersediaanPreset = loaded.ketersediaanPreset;
        }
        if (loaded.shareTokens) this.shareTokens = loaded.shareTokens;
        if (loaded.sharePins) this.sharePins = loaded.sharePins;
        if (loaded.credentials) this.credentials = loaded.credentials;
        if (Array.isArray(loaded.deletedTenantIds)) {
          // Union: jangan sampai daftar hapus hilang karena snapshot instance lain.
          this.deletedTenantIds = Array.from(
            new Set([...this.deletedTenantIds, ...loaded.deletedTenantIds])
          );
        }
        if (Array.isArray(loaded.kewajibanLapor)) this.kewajibanLapor = loaded.kewajibanLapor;
        if (Array.isArray(loaded.laporanPeriodik)) this.laporanPeriodik = loaded.laporanPeriodik;
        if (Array.isArray(loaded.alurVerifikasi)) this.alurVerifikasi = loaded.alurVerifikasi;
        if (Array.isArray(loaded.temuanAudit)) this.temuanAudit = loaded.temuanAudit;
        if (Array.isArray(loaded.snapshotKeuangan)) this.snapshotKeuangan = loaded.snapshotKeuangan;
        if (Array.isArray(loaded.risiko)) this.risiko = loaded.risiko;
        if (Array.isArray(loaded.aset)) this.aset = loaded.aset;
        if (Array.isArray(loaded.perjanjianKinerja)) this.perjanjianKinerja = loaded.perjanjianKinerja;
        if (Array.isArray(loaded.lkjip)) this.lkjip = loaded.lkjip;
        if (loaded.systemConfig) {
          this.systemConfig = { ...this.systemConfig, ...(loaded.systemConfig as object) };
        }
        // Buang tenant yang sudah dihapus admin (kalau state lama masih memuatnya).
        if (this.deletedTenantIds.length > 0) {
          this.tenants = this.tenants.filter((t) => !this.deletedTenantIds.includes(t.id));
        }
        this.ensureSeedUsers();
        // Tenant dari MySQL bisa belum punya KB — backfill agar tidak jatuh
        // ke KB campur (lihat ensureTenantKb).
        this.ensureTenantKb();
        console.log('[AionesBoard DB] State dimuat dari MySQL (persistence aktif)');
      } else {
        await this.mysql.saveAll(this.snapshot());
        console.log('[AionesBoard DB] MySQL siap — seed awal disimpan ke database');
      }
      // Sinkronkan user/kredensial lewat tabel auth khusus (tahan multi-instance).
      await this.sinkronAuthDariMysql();
      // Migrasi tenant ke tabel khusus (per-baris) bila belum ada di sana.
      await this.sinkronTenantKeMysql();
      // Migrasi/ambil dashboard & chat dari tabel khusus (per-baris).
      await this.sinkronDashboardChatKeMysql();
      // Migrasi kewajiban & laporan pelaporan ke tabel khusus (per-baris).
      await this.sinkronPelaporanKeMysql();
      // Kunci API lama masih tersimpan polos — enkripsi sekali di sini supaya
      // deployment yang sudah berjalan ikut terlindungi tanpa langkah manual.
      const kunciPolos: Record<string, unknown> = {};
      for (const k of ['ragApiKey', 'kmsApiKey']) {
        const v = (this.systemConfig as any)?.[k];
        // Polos (deployment lama) atau masih terkunci dengan kunci enkripsi versi
        // lama — dua-duanya harus ditulis ulang dengan kunci sekarang, kalau
        // tidak host lain tidak bisa membukanya.
        if (typeof v === 'string' && v && (!terenkripsi(v) || pakaiKunciLama(v))) {
          kunciPolos[k] = terenkripsi(v) ? dekripsiNilai(v) : v;
        }
      }
      if (Object.keys(kunciPolos).length > 0) {
        this.updateSystemConfig(kunciPolos);
        console.log('[AionesBoard DB] Kunci API tersimpan polos — sudah dienkripsi ulang.');
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
   * Selaraskan user & kredensial dari tabel `auth_users` (khusus auth).
   *
   * WAJIB: produksi berjalan di beberapa instance backend yang berbagi MySQL,
   * sedangkan `persist()` menulis SNAPSHOT PENUH. Tanpa tabel terpisah, user
   * yang didaftarkan di satu instance terhapus oleh snapshot instance lain.
   * Di sini auth_users dibaca, DIGABUNG dengan user yang sudah ada (auth_users
   * menang), lalu SEMUA user ditulis ulang per-baris (upsert) agar tidak saling
   * menimpa antar instance.
   */
  private async sinkronAuthDariMysql(): Promise<void> {
    if (!this.mysql) return;
    try {
      const baris = await this.mysql.loadAuthUsers();
      if (baris.length > 0) {
        const peta = new Map(this.users.map((u) => [u.id, u]));
        for (const r of baris) peta.set(r.id, r.data);
        this.users = Array.from(peta.values());
        for (const r of baris) if (r.passHash) this.credentials[r.id] = r.passHash;
        // User seed dari kode tetap dijamin ada (mis. admin@gmail.com).
        this.ensureSeedUsers();
      }
      // Pastikan SEMUA user (seed + hasil gabung) ada di auth_users.
      for (const u of this.users) {
        await this.mysql.upsertAuthUser(u.id, u, this.credentials[u.id] || null);
      }
    } catch (err: any) {
      console.error('[AionesBoard DB] Sinkron auth_users gagal:', err?.message || err);
    }
  }

  /**
   * Selaraskan tenant ke tabel `tenants` per-baris (migrasi + jaga multi-instance).
   *
   * Kalau tabel khusus masih kosong (deployment lama), seluruh tenant yang ada di
   * memori dimasukkan satu per satu (migrasi). Kalau sudah berisi, tabel adalah
   * SUMBER KEBENARAN: daftar tenant di memori diganti isi tabel, supaya tenant yang
   * sudah dihapus instance lain tidak "bangkit lagi" dari snapshot lama.
   */
  private async sinkronTenantKeMysql(): Promise<void> {
    if (!this.mysql) return;
    try {
      const adaDiTabel = await this.mysql.loadTenants();
      if (adaDiTabel.length === 0) {
        for (const t of this.tenants) {
          if (!this.deletedTenantIds.includes(t.id)) await this.mysql.upsertTenant(t.id, t);
        }
      } else {
        this.tenants = adaDiTabel.filter((t) => !this.deletedTenantIds.includes(t.id));
      }
    } catch (err: any) {
      console.error('[AionesBoard DB] Sinkron tenants gagal:', err?.message || err);
    }
  }

  /**
   * Baca ulang daftar tenant dari tabel khusus (sumber kebenaran bersama).
   *
   * Tabel khusus OToRITATIF: begitu tabel berisi data, daftar tenant di memori
   * diganti dengan isi tabel (dibuang yang sudah dihapus). Dipakai SEBELUM operasi
   * hapus supaya instance yang belum melihat tenant (karena dibuat di instance
   * lain) tetap bisa menghapusnya — bukan malah membalas "Tenant tidak ditemukan".
   */
  async segarkanTenantDariMysql(): Promise<void> {
    if (!this.mysql) return;
    try {
      const baris = await this.mysql.loadTenants();
      if (baris.length === 0) return;
      this.tenants = baris.filter((t) => !this.deletedTenantIds.includes(t.id));
    } catch (err: any) {
      console.error('[AionesBoard DB] segarkanTenantDariMysql gagal:', err?.message || err);
    }
  }

  /** Jumlah tulis per-baris yang belum selesai — lihat `trackWrite`. */
  private pendingWrites = 0;

  /**
   * Bungkus promise tulis MySQL: refreh dari tabel DILEWATI selama masih ada tulis
   * lokal yang belum selesai, supaya tulis sendiri tidak "ditelan" segarkan.
   */
  private trackWrite(p: Promise<unknown> | undefined | void): void {
    if (!p || typeof (p as Promise<unknown>).then !== 'function') return;
    this.pendingWrites++;
    Promise.resolve(p as Promise<unknown>)
      .catch((err: any) => console.error('[AionesBoard DB] tulis baris gagal:', err?.message || err))
      .finally(() => {
        this.pendingWrites--;
      });
  }

  /**
   * Selaraskan dashboard & chat ke tabel khusus (migrasi + multi-instance).
   *
   * Tabel kosong (deployment lama) = migrasi dari memori. Tabel berisi = SUMBER
   * KEBENARAN: daftar di memori diganti isi tabel, supaya dashboard/riwayat yang
   * dibuat instance lain langsung tampil dan yang dihapus tidak "bangkit lagi".
   */
  private async sinkronDashboardChatKeMysql(): Promise<void> {
    if (!this.mysql) return;
    try {
      const dashTabel = await this.mysql.loadDashboards();
      if (dashTabel.length === 0 && this.dashboards.length > 0) {
        // seq menurun mengikuti urutan memori (terbaru dulu) supaya urutan terjaga.
        const total = this.dashboards.length;
        for (let i = 0; i < total; i++) {
          const d = this.dashboards[i];
          await this.mysql.upsertDashboard(d.id, d.tenantId, d, total - i);
        }
      } else if (dashTabel.length > 0) {
        this.dashboards = dashTabel;
      }
      const chatTabel = await this.mysql.loadChats();
      if (chatTabel.length === 0 && this.chats.length > 0) {
        for (const c of this.chats) {
          await this.mysql.upsertChat(c.id, c.tenantId, c.dashboardId ?? null, c);
        }
      } else if (chatTabel.length > 0) {
        this.chats = chatTabel;
      }
    } catch (err: any) {
      console.error('[AionesBoard DB] Sinkron dashboard/chat gagal:', err?.message || err);
    }
  }

  /**
   * Selaraskan kewajiban & laporan pelaporan ke tabel khusus (migrasi + multi-instance).
   * Tabel kosong = migrasi dari memori; tabel berisi = SUMBER KEBENARAN.
   */
  private async sinkronPelaporanKeMysql(): Promise<void> {
    if (!this.mysql) return;
    try {
      const kewTabel = await this.mysql.loadKewajiban();
      if (kewTabel.length === 0 && this.kewajibanLapor.length > 0) {
        for (const k of this.kewajibanLapor) {
          await this.mysql.upsertKewajiban(k.id, k.tenantId, k);
        }
      } else if (kewTabel.length > 0) {
        this.kewajibanLapor = kewTabel;
      }
      const lapTabel = await this.mysql.loadLaporan();
      if (lapTabel.length === 0 && this.laporanPeriodik.length > 0) {
        for (const l of this.laporanPeriodik) {
          await this.mysql.upsertLaporan(l.id, l.tenantId, l.kewajibanId, l);
        }
      } else if (lapTabel.length > 0) {
        this.laporanPeriodik = lapTabel;
      }
      const alurTabel = await this.mysql.loadAlurVerifikasi();
      if (alurTabel.length === 0 && this.alurVerifikasi.length > 0) {
        for (const a of this.alurVerifikasi) {
          await this.mysql.upsertAlurVerifikasi(a.id, a.tenantId, a);
        }
      } else if (alurTabel.length > 0) {
        this.alurVerifikasi = alurTabel;
      }
      const temuanTabel = await this.mysql.loadTemuanAudit();
      if (temuanTabel.length === 0 && this.temuanAudit.length > 0) {
        for (const t of this.temuanAudit) {
          await this.mysql.upsertTemuanAudit(t.id, t.tenantId, t);
        }
      } else if (temuanTabel.length > 0) {
        this.temuanAudit = temuanTabel;
      }
      const keuTabel = await this.mysql.loadSnapshotKeuangan();
      if (keuTabel.length === 0 && this.snapshotKeuangan.length > 0) {
        for (const k of this.snapshotKeuangan) {
          await this.mysql.upsertSnapshotKeuangan(k.id, k.tenantId, k);
        }
      } else if (keuTabel.length > 0) {
        this.snapshotKeuangan = keuTabel;
      }
      const risikoTabel = await this.mysql.loadRisiko();
      if (risikoTabel.length === 0 && this.risiko.length > 0) {
        for (const r of this.risiko) {
          await this.mysql.upsertRisiko(r.id, r.tenantId, r);
        }
      } else if (risikoTabel.length > 0) {
        this.risiko = risikoTabel;
      }
      const asetTabel = await this.mysql.loadAset();
      if (asetTabel.length === 0 && this.aset.length > 0) {
        for (const a of this.aset) {
          await this.mysql.upsertAset(a.id, a.tenantId, a);
        }
      } else if (asetTabel.length > 0) {
        this.aset = asetTabel;
      }
      const pkTabel = await this.mysql.loadPerjanjianKinerja();
      if (pkTabel.length === 0 && this.perjanjianKinerja.length > 0) {
        for (const p of this.perjanjianKinerja) {
          await this.mysql.upsertPerjanjianKinerja(p.id, p.tenantId, p);
        }
      } else if (pkTabel.length > 0) {
        this.perjanjianKinerja = pkTabel;
      }
      const lkTable = await this.mysql.loadLKjIP();
      if (lkTable.length === 0 && this.lkjip.length > 0) {
        for (const l of this.lkjip) {
          await this.mysql.upsertLKjIP(l.id, l.tenantId, l);
        }
      } else if (lkTable.length > 0) {
        this.lkjip = lkTable;
      }
    } catch (err: any) {
      console.error('[AionesBoard DB] Sinkron pelaporan gagal:', err?.message || err);
    }
  }

  /**
   * Baca ulang tenant + dashboard + chat dari tabel khusus. Dipanggil berkala
   * (middleware /api) agar instance backend mana pun melihat data yang SAMA —
   * tanpa ini, daftar dashboard/riwayat "berkedip" tergantung instance mana yang
   * melayani permintaan.
   */
  async segarkanMultiInstance(): Promise<void> {
    if (!this.mysql) return;
    if (this.pendingWrites > 0) return;
    await this.segarkanTenantDariMysql();
    try {
      const dash = await this.mysql.loadDashboards();
      if (dash.length > 0) this.dashboards = dash;
      const chat = await this.mysql.loadChats();
      if (chat.length > 0 || this.chats.length === 0) this.chats = chat;
      // Pelaporan: ikut disegarkan supaya status kepatuhan tidak "berkedip".
      const kew = await this.mysql.loadKewajiban();
      if (kew.length > 0 || this.kewajibanLapor.length === 0) this.kewajibanLapor = kew;
      const lap = await this.mysql.loadLaporan();
      if (lap.length > 0 || this.laporanPeriodik.length === 0) this.laporanPeriodik = lap;
      const alur = await this.mysql.loadAlurVerifikasi();
      if (alur.length > 0 || this.alurVerifikasi.length === 0) this.alurVerifikasi = alur;
      const temuan = await this.mysql.loadTemuanAudit();
      if (temuan.length > 0 || this.temuanAudit.length === 0) this.temuanAudit = temuan;
      const keu = await this.mysql.loadSnapshotKeuangan();
      if (keu.length > 0 || this.snapshotKeuangan.length === 0) this.snapshotKeuangan = keu;
      const rsk = await this.mysql.loadRisiko();
      if (rsk.length > 0 || this.risiko.length === 0) this.risiko = rsk;
      const ast = await this.mysql.loadAset();
      if (ast.length > 0 || this.aset.length === 0) this.aset = ast;
      const pk = await this.mysql.loadPerjanjianKinerja();
      if (pk.length > 0 || this.perjanjianKinerja.length === 0) this.perjanjianKinerja = pk;
      const lk = await this.mysql.loadLKjIP();
      if (lk.length > 0 || this.lkjip.length === 0) this.lkjip = lk;
    } catch (err: any) {
      console.error('[AionesBoard DB] segarkanMultiInstance gagal:', err?.message || err);
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
      // Jangan hidupkan kembali user seed milik instansi yang SUDAH DIHAPUS admin.
      // Dicek lewat daftar eksplisit `deletedTenantIds`, BUKAN 'tenant tidak ada
      // di this.tenants' — sebab instansinya sendiri memang dibuat dinamis lewat
      // UI dan user seed tetap valid walau tenant-nya belum/bukan seed.
      if (this.deletedTenantIds.includes(seed.tenantId)) continue;
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
   * Pastikan tenant seed punya `knowledgeBaseId` — dipanggil setelah state
   * dimuat (dari data/db.json maupun MySQL), karena tenant yang tersimpan
   * sebelum fitur KB ada tidak memuat field ini. Tanpa backfill, permintaan
   * dashboard tenant tersebut jatuh ke KB campur dan bisa menampilkan dokumen
   * instansi lain (kasus nyata: dashboard PDAM berisi laporan Bank BJB).
   */
  private ensureTenantKb() {
    let berubah = false;
    for (const t of this.tenants) {
      if (!t.knowledgeBaseId && KB_SEED_TENANT[t.id]) {
        t.knowledgeBaseId = KB_SEED_TENANT[t.id];
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
      if (Array.isArray(parsed.ketersediaanPreset)) this.ketersediaanPreset = parsed.ketersediaanPreset;
      if (Array.isArray(parsed.deletedTenantIds)) {
        this.deletedTenantIds = parsed.deletedTenantIds;
      }
      if (Array.isArray(parsed.kewajibanLapor)) this.kewajibanLapor = parsed.kewajibanLapor;
      if (Array.isArray(parsed.laporanPeriodik)) this.laporanPeriodik = parsed.laporanPeriodik;
      if (Array.isArray(parsed.alurVerifikasi)) this.alurVerifikasi = parsed.alurVerifikasi;
      if (Array.isArray(parsed.temuanAudit)) this.temuanAudit = parsed.temuanAudit;
      if (Array.isArray(parsed.snapshotKeuangan)) this.snapshotKeuangan = parsed.snapshotKeuangan;
      if (Array.isArray(parsed.risiko)) this.risiko = parsed.risiko;
      if (Array.isArray(parsed.aset)) this.aset = parsed.aset;
      if (Array.isArray(parsed.perjanjianKinerja)) this.perjanjianKinerja = parsed.perjanjianKinerja;
      if (Array.isArray(parsed.lkjip)) this.lkjip = parsed.lkjip;
      if (parsed.credentials) this.credentials = parsed.credentials;
      // Jamin user seed tetap ada walau file fallback sudah usang.
      this.ensureSeedUsers();
      // Jamin tenant seed punya KB (state lama belum menyimpan field ini).
      this.ensureTenantKb();
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
    // Kunci API disimpan dalam bentuk terenkripsi (AES-256-GCM). Tanpa ini,
    // siapa pun yang bisa membaca tabel/berkas database langsung memegang
    // kredensial RAG & KMS.
    const aman: Record<string, unknown> = { ...partial };
    for (const k of ['ragApiKey', 'kmsApiKey']) {
      if (typeof aman[k] === 'string') aman[k] = enkripsiNilai(aman[k]);
    }
    this.systemConfig = { ...this.systemConfig, ...(aman as object) };
    this.trackWrite(this.mysql?.upsertBaris('systemConfig', 'utama', this.systemConfig));
    this.persist();
    return this.systemConfig;
  }

  // ================= Ketersediaan preset katalog =================

  /** Catatan ketersediaan preset yang berlaku untuk instansi + KB ini. */
  public ketersediaanUntuk(tenantId: string, kbId: string): KetersediaanPreset[] {
    return this.ketersediaanPreset.filter((k) => k.tenantId === tenantId && k.kbId === kbId);
  }

  /**
   * Simpan/perbarui satu catatan ketersediaan preset. Kunci = tenant|preset|tipe,
   * jadi pemeriksaan ulang menggantikan catatan lama (tidak menumpuk).
   */
  public simpanKetersediaan(catatan: KetersediaanPreset): void {
    const idx = this.ketersediaanPreset.findIndex((k) => k.id === catatan.id);
    if (idx >= 0) this.ketersediaanPreset[idx] = catatan;
    else this.ketersediaanPreset.push(catatan);
  }

  /**
   * Buang catatan ketersediaan yang sudah tidak sah: KB instansi berbeda dari
   * saat pemeriksaan, atau catatan lebih tua dari `ttlHari`. Dipanggil saat boot
   * supaya instansi yang KB-nya diganti tidak mewarisi hasil pemeriksaan lama.
   */
  public bersihkanKetersediaan(kbPerTenant: Record<string, string>, ttlHari = 7): number {
    const batas = Date.now() - ttlHari * 24 * 60 * 60 * 1000;
    const sebelum = this.ketersediaanPreset.length;
    this.ketersediaanPreset = this.ketersediaanPreset.filter((k) => {
      const kbKini = kbPerTenant[k.tenantId];
      if (kbKini !== undefined && kbKini !== k.kbId) return false;
      const waktu = Date.parse(k.checkedAt);
      return Number.isFinite(waktu) ? waktu >= batas : false;
    });
    const dibuang = sebelum - this.ketersediaanPreset.length;
    if (dibuang > 0) this.persist();
    return dibuang;
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
        auditLogs: this.auditLogs.slice(0, 5000),
        shareTokens: this.shareTokens,
        sharePins: this.sharePins,
        systemConfig: this.systemConfig,
        users: this.users,
        tenants: this.tenants,
        credentials: this.credentials,
        deletedTenantIds: this.deletedTenantIds,
        kewajibanLapor: this.kewajibanLapor,
        laporanPeriodik: this.laporanPeriodik,
        alurVerifikasi: this.alurVerifikasi,
        temuanAudit: this.temuanAudit,
        snapshotKeuangan: this.snapshotKeuangan,
        risiko: this.risiko,
        aset: this.aset,
        perjanjianKinerja: this.perjanjianKinerja,
        lkjip: this.lkjip,
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
    // Tulis per-baris ke tabel dashboard khusus (tahan multi-instance).
    this.trackWrite(this.mysql?.upsertDashboard(dashboard.id, dashboard.tenantId, dashboard, Date.now()));
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
    this.trackWrite(
      this.mysql?.upsertDashboard(id, this.dashboards[idx].tenantId, this.dashboards[idx], Date.now())
    );
    this.persist();
    return this.dashboards[idx];
  }

  deleteDashboard(id: string, tenantId: string): boolean {
    const initialLen = this.dashboards.length;
    this.dashboards = this.dashboards.filter((d) => !(d.id === id && d.tenantId === tenantId));
    const deleted = this.dashboards.length < initialLen;
    // Dashboard hilang = chat-nya tidak ada gunanya lagi (relasi 1:1).
    if (deleted) {
      const chatHapus = this.chats.filter((c) => c.dashboardId === id);
      this.chats = this.chats.filter((c) => c.dashboardId !== id);
      this.trackWrite(this.mysql?.deleteDashboardRow(id));
      for (const c of chatHapus) this.trackWrite(this.mysql?.deleteChatRow(c.id));
    }
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
    this.trackWrite(this.mysql?.upsertDashboard(copy.id, copy.tenantId, copy, Date.now()));
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
    // ponytail: satu entri = satu baris di `audit_log`, jadi audit dari instance
    // lain tidak terhapus. Memori dibatasi 5.000 entri (bukan 500) dan tabel
    // dipangkas di atas 20.000 supaya tetap ringan.
    this.trackWrite(this.mysql?.upsertAuditLog(log));
    if (this.auditLogs.length > 5000) this.auditLogs.length = 5000;
    if (this.auditLogs.length % 500 === 0) this.trackWrite(this.mysql?.trimAuditLogs(20000));
    this.persist();
    return log;
  }

  // ===== Koleksi kecil: tulis per-baris (tanpa snapshot penuh) =====

  /** Simpan satu notifikasi milik instansi (dulu ikut snapshot → hilang antar instance). */
  public simpanNotifikasi(n: NotificationItem): void {
    this.trackWrite(this.mysql?.upsertBaris('notifications', n.id, n));
  }

  /** Simpan/perbarui satu aturan alert. */
  public simpanAturanAlert(r: AlertRule): void {
    this.trackWrite(this.mysql?.upsertBaris('alertRules', r.id, r));
  }

  public hapusAturanAlert(id: string): void {
    this.trackWrite(this.mysql?.deleteBaris('alertRules', id));
  }

  /** Tautan bagikan (mode lihat/edit) — satu baris per token. */
  public simpanTautanBagikan(token: string, meta: Record<string, unknown>): void {
    this.trackWrite(this.mysql?.upsertBaris('shareTokens', token, { token, ...meta }));
  }

  public hapusTautanBagikan(token: string): void {
    this.trackWrite(this.mysql?.deleteBaris('shareTokens', token));
    this.trackWrite(this.mysql?.deleteBaris('sharePins', token));
  }

  /** Hash PIN mode edit tautan publik. */
  public simpanPinBagikan(token: string, pin: string): void {
    this.trackWrite(this.mysql?.upsertBaris('sharePins', token, { token, pin }));
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
          text: 'Halo! Saya Asisten Aiones Boards, siap membantu dengan dokumen resmi instansi Anda. Tanyakan apa saja seputar dokumen (kinerja, anggaran, SOP), atau minta saya membuatkan/memperbarui dashboard BUMD.',
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    this.chats.unshift(chat);
    this.trackWrite(this.mysql?.upsertChat(chat.id, chat.tenantId, chat.dashboardId ?? null, chat));
    this.persist();
    return chat;
  }

  /** Semua chat tenant — dipakai indikator jumlah pesan di daftar dashboard. */
  getChats(tenantId: string): Chat[] {
    return this.chats.filter((c) => c.tenantId === tenantId);
  }

  /**
   * Chat "umum" (tanpa dashboard aktif). Tanpa ini, pertanyaan yang diajukan saat
   * belum ada dashboard TERBUKA tidak tersimpan sama sekali, sehingga riwayat
   * "hilang" begitu panel dibuka lagi. Id SENGAJA deterministik supaya dua instance
   * backend tidak membuat dua chat umum untuk user yang sama.
   */
  ensureGeneralChat(tenantId: string, userId: string): Chat {
    const id = `chat-umum-${tenantId}-${userId}`;
    const ada = this.getChatById(id, tenantId);
    if (ada) return ada;
    const now = new Date().toISOString();
    const chat: Chat = {
      id,
      dashboardId: 'umum',
      tenantId,
      userId,
      title: 'Percakapan Umum',
      messages: [
        {
          id: `msg-welcome-${Date.now()}`,
          sender: 'system',
          text: 'Halo! Saya Asisten Aiones Boards, siap membantu dengan dokumen resmi instansi Anda. Tanyakan apa saja seputar dokumen (kinerja, anggaran, SOP), atau minta saya membuatkan/memperbarui dashboard BUMD.',
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    this.chats.unshift(chat);
    this.trackWrite(this.mysql?.upsertChat(chat.id, chat.tenantId, chat.dashboardId, chat));
    this.persist();
    return chat;
  }

  addChatMessage(chatId: string, msg: ChatMessage, tenantId?: string): Chat | undefined {
    const chat = this.getChatById(chatId, tenantId);
    if (!chat) return undefined;
    chat.messages.push(msg);
    chat.updatedAt = new Date().toISOString();
    // Tulis per-baris: riwayat tidak boleh hilang karena ditimpa snapshot instance lain.
    this.trackWrite(this.mysql?.upsertChat(chat.id, chat.tenantId, chat.dashboardId ?? null, chat));
    this.persist();
    return chat;
  }

  updateChat(id: string, partial: Partial<Chat>, tenantId: string): Chat | undefined {
    const chat = this.getChatById(id, tenantId);
    if (!chat) return undefined;
    // Kaitan ke dashboard/tenant tidak boleh dipindah lewat PATCH.
    const { dashboardId: _d, tenantId: _t, id: _i, messages: _m, ...rest } = partial;
    Object.assign(chat, rest, { updatedAt: new Date().toISOString() });
    this.trackWrite(this.mysql?.upsertChat(chat.id, chat.tenantId, chat.dashboardId ?? null, chat));
    this.persist();
    return chat;
  }

  /** Hapus chat saja — dashboard-nya SENGAJA dibiarkan hidup. */
  deleteChat(id: string, tenantId: string): boolean {
    const len = this.chats.length;
    this.chats = this.chats.filter((c) => !(c.id === id && c.tenantId === tenantId));
    const deleted = this.chats.length < len;
    if (deleted) {
      this.trackWrite(this.mysql?.deleteChatRow(id));
      this.persist();
    }
    return deleted;
  }

  // User Management
  createUser(user: SafeUser, passwordHash?: string): SafeUser {
    this.users.push(user);
    if (passwordHash) this.credentials[user.id] = passwordHash;
    // Tulis ke tabel auth khusus (upsert per-baris) supaya instance backend lain
    // yang berbagi MySQL langsung melihat user ini — snapshot `persist()` bisa
    // menimpanya. Fire-and-forget; kegagalan cukup dicatat.
    this.mysql
      ?.upsertAuthUser(user.id, user, passwordHash || this.credentials[user.id] || null)
      .catch((err) => console.error('[AionesBoard DB] upsertAuthUser gagal:', err?.message || err));
    this.persist();
    return user;
  }

  updateUser(id: string, partial: Partial<User>): SafeUser | undefined {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    const { passwordHash: _ignored, ...rest } = partial as Partial<User> & { passwordHash?: string };
    this.users[idx] = { ...this.users[idx], ...rest };
    this.mysql
      ?.upsertAuthUser(id, this.users[idx], this.credentials[id] || null)
      .catch((err) => console.error('[AionesBoard DB] upsertAuthUser gagal:', err?.message || err));
    this.persist();
    return this.users[idx];
  }

  /**
   * Ganti kata sandi satu akun. `mustChange` = akun masih memakai sandi
   * sementara, jadi login berikutnya wajib menggantinya lagi.
   * Hash ditulis ke tabel auth per-baris (bukan snapshot) agar langsung
   * berlaku di instance backend lain.
   */
  setUserPassword(id: string, passwordHash: string, mustChange = false): SafeUser | undefined {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    this.credentials[id] = passwordHash;
    this.users[idx] = { ...this.users[idx], mustChangePassword: mustChange };
    this.mysql
      ?.upsertAuthUser(id, this.users[idx], passwordHash)
      .catch((err) => console.error('[AionesBoard DB] upsertAuthUser gagal:', err?.message || err));
    this.persist();
    return this.users[idx];
  }

  deleteUser(id: string): boolean {
    const len = this.users.length;
    this.users = this.users.filter((u) => u.id !== id);
    delete this.credentials[id];
    const deleted = this.users.length < len;
    if (deleted) {
      this.mysql
        ?.deleteAuthUser(id)
        .catch((err) => console.error('[AionesBoard DB] deleteAuthUser gagal:', err?.message || err));
      this.persist();
    }
    return deleted;
  }

  /**
   * Cari user untuk LOGIN dengan menyegarkan dulu dari tabel auth khusus.
   *
   * Di produksi, permintaan login bisa mendarat di instance backend mana pun.
   * Kalau instance ini belum pernah melihat user yang baru didaftarkan instance
   * lain, pencarian lokal akan gagal. Karena itu tabel `auth_users` dibaca ulang
   * (sumber kebenaran bersama) sebelum mencocokkan email.
   */
  async findUserForLogin(email: string): Promise<SafeUser | undefined> {
    const cari = (e: string) => this.users.find((u) => u.email.toLowerCase() === e);
    let user = cari(email);
    if (!user && this.mysql) {
      try {
        const baris = await this.mysql.loadAuthUsers();
        if (baris.length > 0) {
          const peta = new Map(this.users.map((u) => [u.id, u]));
          for (const r of baris) peta.set(r.id, r.data);
          this.users = Array.from(peta.values());
          for (const r of baris) if (r.passHash) this.credentials[r.id] = r.passHash;
          this.ensureSeedUsers();
          user = cari(email);
        }
      } catch (err: any) {
        console.error('[AionesBoard DB] findUserForLogin gagal menyegarkan:', err?.message || err);
      }
    }
    return user;
  }

  // Tenant Management
  async createTenant(tenant: Tenant): Promise<Tenant> {
    this.tenants.push(tenant);
    // Tulis per-baris ke tabel tenant khusus (tahan multi-instance). Ditunggu
    // supaya refresh instance lain langsung melihatnya.
    if (this.mysql) {
      try {
        await this.mysql.upsertTenant(tenant.id, tenant);
      } catch (err: any) {
        console.error('[AionesBoard DB] upsertTenant gagal:', err?.message || err);
      }
    }
    this.persist();
    return tenant;
  }

  async updateTenant(id: string, partial: Partial<Tenant>): Promise<Tenant | undefined> {
    const idx = this.tenants.findIndex((t) => t.id === id);
    if (idx === -1) return undefined;
    this.tenants[idx] = { ...this.tenants[idx], ...partial };
    if (this.mysql) {
      try {
        await this.mysql.upsertTenant(id, this.tenants[idx]);
      } catch (err: any) {
        console.error('[AionesBoard DB] upsertTenant gagal:', err?.message || err);
      }
    }
    this.persist();
    return this.tenants[idx];
  }

  /**
   * Hapus satu instansi BUMD BESERTA SELURUH data yang terikat padanya.
   *
   * Satu instansi = satu Knowledge Base di layanan RAG, jadi menghapus instansi
   * harus ikut membersihkan semua jejaknya: pengguna + kredensialnya (termasuk di
   * tabel auth MySQL agar tidak "hidup lagi" lewat sinkronisasi multi-instance),
   * dashboard + percakapan, tautan bagikan (token & PIN) milik dashboard itu,
   * notifikasi, aturan alert, catatan ketersediaan preset katalog, dan log audit
   * instansi tersebut. Kalau tidak, sisa data ini masih tampil/terbaca walau
   * instansinya sudah dihilangkan.
   */
  async deleteTenant(id: string): Promise<boolean> {
    // Segarkan dulu dari tabel khusus: tenant mungkin dibuat di instance backend
    // lain sehingga belum terlihat di memori instance ini.
    await this.segarkanTenantDariMysql();
    if (!this.tenants.some((t) => t.id === id)) return false;

    // Catat id instansi yang dihapus — agar user seed-nya tidak dibuat ulang
    // saat boot berikutnya (lihat ensureSeedUsers).
    if (!this.deletedTenantIds.includes(id)) {
      this.deletedTenantIds.push(id);
      // Per-baris: tombstone tidak boleh hilang karena snapshot instance lain.
      this.trackWrite(this.mysql?.upsertBaris('deletedTenantIds', id, id));
    }

    // 1) Pengguna instansi + kredensialnya. Hapus juga di tabel auth MySQL,
    //    supaya sinkronisasi multi-instance / findUserForLogin tidak
    //    mengembalikannya dari database.
    const userIds = this.users.filter((u) => u.tenantId === id).map((u) => u.id);
    this.users = this.users.filter((u) => u.tenantId !== id);
    for (const uid of userIds) {
      delete this.credentials[uid];
      if (this.mysql) {
        try {
          await this.mysql.deleteAuthUser(uid);
        } catch (err: any) {
          console.error('[AionesBoard DB] deleteAuthUser gagal:', err?.message || err);
        }
      }
    }

    // 2) Dashboard instansi + turunannya: percakapan & tautan bagikan.
    const dashIds = new Set(
      this.dashboards.filter((d) => d.tenantId === id).map((d) => d.id)
    );
    this.dashboards = this.dashboards.filter((d) => d.tenantId !== id);
    const chatHapus = this.chats.filter((c) => c.tenantId === id || dashIds.has(c.dashboardId));
    this.chats = this.chats.filter((c) => c.tenantId !== id && !dashIds.has(c.dashboardId));
    // Hapus juga baris di tabel khusus supaya instance lain ikut bersih.
    for (const did of dashIds) this.trackWrite(this.mysql?.deleteDashboardRow(did));
    for (const c of chatHapus) this.trackWrite(this.mysql?.deleteChatRow(c.id));
    for (const [token, dashId] of Object.entries(this.shareTokens)) {
      if (dashIds.has(dashId)) {
        delete this.shareTokens[token];
        delete this.sharePins[token];
        this.hapusTautanBagikan(token);
      }
    }

    // 3) Sisa data yang terikat tenantId.
    const notifHapus = this.notifications.filter((n) => n.tenantId === id);
    this.notifications = this.notifications.filter((n) => n.tenantId !== id);
    for (const n of notifHapus) this.trackWrite(this.mysql?.deleteBaris('notifications', n.id));
    const aturanHapus = this.alertRules.filter((a) => a.tenantId === id);
    this.alertRules = this.alertRules.filter((a) => a.tenantId !== id);
    for (const a of aturanHapus) this.hapusAturanAlert(a.id);
    this.auditLogs = this.auditLogs.filter((a) => a.tenantId !== id);
    this.ketersediaanPreset = this.ketersediaanPreset.filter((k) => k.tenantId !== id);

    // 3b) Pelaporan periodik instansi ini (kewajiban + laporan) beserta baris tabelnya.
    const kewHapus = this.kewajibanLapor.filter((k) => k.tenantId === id);
    this.kewajibanLapor = this.kewajibanLapor.filter((k) => k.tenantId !== id);
    const lapHapus = this.laporanPeriodik.filter((l) => l.tenantId === id);
    this.laporanPeriodik = this.laporanPeriodik.filter((l) => l.tenantId !== id);
    for (const k of kewHapus) this.trackWrite(this.mysql?.deleteKewajibanRow(k.id));
    for (const l of lapHapus) this.trackWrite(this.mysql?.deleteLaporanRow(l.id));
    // 3c) Alur verifikasi instansi ini beserta baris tabelnya.
    const alurHapus = this.alurVerifikasi.filter((a) => a.tenantId === id);
    this.alurVerifikasi = this.alurVerifikasi.filter((a) => a.tenantId !== id);
    for (const a of alurHapus) this.trackWrite(this.mysql?.deleteAlurVerifikasiRow(a.id));
    // 3d) Temuan audit instansi ini beserta baris tabelnya.
    const temuanHapus = this.temuanAudit.filter((t) => t.tenantId === id);
    this.temuanAudit = this.temuanAudit.filter((t) => t.tenantId !== id);
    for (const t of temuanHapus) this.trackWrite(this.mysql?.deleteTemuanAuditRow(t.id));
    // 3e) Snapshot kesehatan keuangan instansi ini beserta baris tabelnya.
    const keuHapus = this.snapshotKeuangan.filter((k) => k.tenantId === id);
    this.snapshotKeuangan = this.snapshotKeuangan.filter((k) => k.tenantId !== id);
    for (const k of keuHapus) this.trackWrite(this.mysql?.deleteSnapshotKeuanganRow(k.id));
    // 3f) Register risiko instansi ini beserta baris tabelnya.
    const risikoHapus = this.risiko.filter((r) => r.tenantId === id);
    this.risiko = this.risiko.filter((r) => r.tenantId !== id);
    for (const r of risikoHapus) this.trackWrite(this.mysql?.deleteRisikoRow(r.id));
    // 3g) Daftar aset instansi ini beserta baris tabelnya.
    const asetHapus = this.aset.filter((a) => a.tenantId === id);
    this.aset = this.aset.filter((a) => a.tenantId !== id);
    for (const a of asetHapus) this.trackWrite(this.mysql?.deleteAsetRow(a.id));
    // 3h) Perjanjian Kinerja instansi ini beserta baris tabelnya.
    const pkHapus = this.perjanjianKinerja.filter((p) => p.tenantId === id);
    this.perjanjianKinerja = this.perjanjianKinerja.filter((p) => p.tenantId !== id);
    for (const p of pkHapus) this.trackWrite(this.mysql?.deletePerjanjianKinerjaRow(p.id));
    // 3i) LKjIP instansi ini beserta baris tabelnya.
    const lkHapus = this.lkjip.filter((l) => l.tenantId === id);
    this.lkjip = this.lkjip.filter((l) => l.tenantId !== id);
    for (const l of lkHapus) this.trackWrite(this.mysql?.deleteLKjIPRow(l.id));

    // 4) Instansinya sendiri: dari memori + tabel khusus MySQL.
    this.tenants = this.tenants.filter((t) => t.id !== id);
    if (this.mysql) {
      try {
        await this.mysql.deleteTenantRow(id);
      } catch (err: any) {
        console.error('[AionesBoard DB] deleteTenantRow gagal:', err?.message || err);
      }
    }

    this.persist();
    return true;
  }

  /* ================= PELAPORAN PERIODIK & KEPATUHAN ================= */

  /** Daftar kewajiban lapor sebuah instansi (opsional hanya yang aktif). */
  getKewajiban(tenantId: string, hanyaAktif = false): KewajibanLapor[] {
    return this.kewajibanLapor.filter(
      (k) => k.tenantId === tenantId && (!hanyaAktif || k.isActive)
    );
  }

  createKewajiban(data: Omit<KewajibanLapor, 'id' | 'createdAt'>): KewajibanLapor {
    const baru: KewajibanLapor = {
      ...data,
      id: `kew-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    this.kewajibanLapor.push(baru);
    this.trackWrite(this.mysql?.upsertKewajiban(baru.id, baru.tenantId, baru));
    this.persist();
    return baru;
  }

  updateKewajiban(
    id: string,
    tenantId: string,
    partial: Partial<KewajibanLapor>
  ): KewajibanLapor | undefined {
    const idx = this.kewajibanLapor.findIndex((k) => k.id === id && k.tenantId === tenantId);
    if (idx === -1) return undefined;
    const digabung: KewajibanLapor = {
      ...this.kewajibanLapor[idx],
      ...partial,
      // id & tenantId tidak boleh diubah lewat partial.
      id: this.kewajibanLapor[idx].id,
      tenantId: this.kewajibanLapor[idx].tenantId,
    };
    this.kewajibanLapor[idx] = digabung;
    this.trackWrite(this.mysql?.upsertKewajiban(digabung.id, digabung.tenantId, digabung));
    this.persist();
    return digabung;
  }

  /** Hapus kewajiban + SEMUA laporan yang menunjuk padanya (cascade). */
  deleteKewajiban(id: string, tenantId: string): boolean {
    const ada = this.kewajibanLapor.some((k) => k.id === id && k.tenantId === tenantId);
    if (!ada) return false;
    this.kewajibanLapor = this.kewajibanLapor.filter((k) => k.id !== id);
    const lapHapus = this.laporanPeriodik.filter((l) => l.kewajibanId === id);
    this.laporanPeriodik = this.laporanPeriodik.filter((l) => l.kewajibanId !== id);
    this.trackWrite(this.mysql?.deleteKewajibanRow(id));
    for (const l of lapHapus) this.trackWrite(this.mysql?.deleteLaporanRow(l.id));
    this.persist();
    return true;
  }

  /** Laporan periodik sebuah instansi, opsional disaring satu periode. */
  getLaporan(tenantId: string, periode?: string): LaporanPeriodik[] {
    return this.laporanPeriodik.filter(
      (l) => l.tenantId === tenantId && (!periode || l.periode === periode)
    );
  }

  /**
   * Catat/perbarui realisasi laporan untuk (kewajiban, periode).
   *
   * Kalau sudah ada entri untuk pasangan itu, entri itulah yang diperbarui —
   * bukan dibuat duplikat. Ini yang membuat alur "isi laporan" idempoten.
   */
  catatLaporan(
    data: Omit<LaporanPeriodik, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): LaporanPeriodik {
    const now = new Date().toISOString();
    const idx = this.laporanPeriodik.findIndex(
      (l) =>
        l.tenantId === data.tenantId &&
        l.kewajibanId === data.kewajibanId &&
        l.periode === data.periode
    );
    if (idx !== -1) {
      const lama = this.laporanPeriodik[idx];
      const diperbarui: LaporanPeriodik = {
        ...lama,
        ...data,
        id: lama.id,
        createdAt: lama.createdAt,
        updatedAt: now,
      };
      this.laporanPeriodik[idx] = diperbarui;
      this.trackWrite(
        this.mysql?.upsertLaporan(diperbarui.id, diperbarui.tenantId, diperbarui.kewajibanId, diperbarui)
      );
      this.persist();
      return diperbarui;
    }
    const baru: LaporanPeriodik = {
      ...data,
      id: data.id || `lap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.laporanPeriodik.push(baru);
    this.trackWrite(this.mysql?.upsertLaporan(baru.id, baru.tenantId, baru.kewajibanId, baru));
    this.persist();
    return baru;
  }

  deleteLaporan(id: string, tenantId: string): boolean {
    const ada = this.laporanPeriodik.some((l) => l.id === id && l.tenantId === tenantId);
    if (!ada) return false;
    this.laporanPeriodik = this.laporanPeriodik.filter((l) => l.id !== id);
    this.trackWrite(this.mysql?.deleteLaporanRow(id));
    this.persist();
    return true;
  }

  /**
   * Ubah HANYA status sebuah laporan (dipakai alur verifikasi bertingkat).
   * Menjaga field lain apa adanya — tidak menyentuh tenggat, lampiran, atau riwayat.
   */
  updateLaporanStatus(
    id: string,
    tenantId: string,
    status: StatusLaporan
  ): LaporanPeriodik | undefined {
    const idx = this.laporanPeriodik.findIndex((l) => l.id === id && l.tenantId === tenantId);
    if (idx === -1) return undefined;
    const diperbarui: LaporanPeriodik = {
      ...this.laporanPeriodik[idx],
      status,
      updatedAt: new Date().toISOString(),
    };
    this.laporanPeriodik[idx] = diperbarui;
    this.trackWrite(
      this.mysql?.upsertLaporan(diperbarui.id, diperbarui.tenantId, diperbarui.kewajibanId, diperbarui)
    );
    this.persist();
    return diperbarui;
  }

  // ===== Alur verifikasi bertingkat =====

  /** Alur verifikasi sebuah instansi. */
  getAlurVerifikasi(tenantId: string): AlurVerifikasi[] {
    return this.alurVerifikasi.filter((a) => a.tenantId === tenantId);
  }

  /** Alur default instansi (yang dipakai laporan tanpa `alurId`), bila ada. */
  getAlurDefault(tenantId: string): AlurVerifikasi | undefined {
    return this.alurVerifikasi.find((a) => a.tenantId === tenantId && a.isDefault);
  }

  /**
   * Simpan alur (buat baru atau perbarui). Bila `isDefault` true, alur lain
   * milik instansi yang sama diturunkan — supaya hanya ada SATU default.
   */
  simpanAlurVerifikasi(
    data: Omit<AlurVerifikasi, 'id' | 'createdAt'> & { id?: string }
  ): AlurVerifikasi {
    if (data.isDefault) {
      for (const a of this.alurVerifikasi) {
        if (a.tenantId === data.tenantId && a.isDefault && a.id !== data.id) {
          a.isDefault = false;
          this.trackWrite(this.mysql?.upsertAlurVerifikasi(a.id, a.tenantId, a));
        }
      }
    }
    if (data.id) {
      const idx = this.alurVerifikasi.findIndex(
        (a) => a.id === data.id && a.tenantId === data.tenantId
      );
      if (idx !== -1) {
        const diperbarui: AlurVerifikasi = {
          ...this.alurVerifikasi[idx],
          ...data,
          id: this.alurVerifikasi[idx].id,
          tenantId: this.alurVerifikasi[idx].tenantId,
        };
        this.alurVerifikasi[idx] = diperbarui;
        this.trackWrite(
          this.mysql?.upsertAlurVerifikasi(diperbarui.id, diperbarui.tenantId, diperbarui)
        );
        this.persist();
        return diperbarui;
      }
    }
    const baru: AlurVerifikasi = {
      ...data,
      id: data.id || `alur-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    this.alurVerifikasi.push(baru);
    this.trackWrite(this.mysql?.upsertAlurVerifikasi(baru.id, baru.tenantId, baru));
    this.persist();
    return baru;
  }

  deleteAlurVerifikasi(id: string, tenantId: string): boolean {
    const ada = this.alurVerifikasi.some((a) => a.id === id && a.tenantId === tenantId);
    if (!ada) return false;
    this.alurVerifikasi = this.alurVerifikasi.filter((a) => a.id !== id);
    // Laporan yang memakai alur ini kembali ke alur bawaan — JANGAN hapus
    // laporannya, cukup lepaskan rujukannya supaya riwayatnya tidak hilang.
    for (const l of this.laporanPeriodik) {
      if (l.alurId === id) {
        delete l.alurId;
        this.trackWrite(this.mysql?.upsertLaporan(l.id, l.tenantId, l.kewajibanId, l));
      }
    }
    this.trackWrite(this.mysql?.deleteAlurVerifikasiRow(id));
    this.persist();
    return true;
  }

  /**
   * Tambahkan satu aksi verifikasi ke riwayat laporan (append-only).
   * Dipakai untuk `kirim`, `setujui`, dan `revisi`. Mengembalikan laporan
   * terbaru, atau `undefined` bila laporan tidak ada di instansi itu.
   */
  tambahAksiVerifikasi(
    laporanId: string,
    tenantId: string,
    aksi: AksiVerifikasi
  ): LaporanPeriodik | undefined {
    const idx = this.laporanPeriodik.findIndex(
      (l) => l.id === laporanId && l.tenantId === tenantId
    );
    if (idx === -1) return undefined;
    const lama = this.laporanPeriodik[idx];
    const riwayat = Array.isArray(lama.riwayatVerifikasi) ? lama.riwayatVerifikasi : [];
    const diperbarui: LaporanPeriodik = {
      ...lama,
      riwayatVerifikasi: [...riwayat, aksi],
      updatedAt: new Date().toISOString(),
    };
    this.laporanPeriodik[idx] = diperbarui;
    this.trackWrite(
      this.mysql?.upsertLaporan(diperbarui.id, diperbarui.tenantId, diperbarui.kewajibanId, diperbarui)
    );
    this.persist();
    return diperbarui;
  }

  /* ================= TINDAK LANJUT AUDIT ================= */

  /** Daftar temuan audit sebuah instansi (opsional disaring sumber/status). */
  getTemuanAudit(tenantId: string, filter?: { sumber?: string; status?: string }): TemuanAudit[] {
    return this.temuanAudit.filter(
      (t) =>
        t.tenantId === tenantId &&
        (!filter?.sumber || t.sumber === filter.sumber) &&
        (!filter?.status || t.status === filter.status)
    );
  }

  /** Satu temuan audit milik instansi ini, atau `undefined`. */
  getTemuanAuditById(id: string, tenantId: string): TemuanAudit | undefined {
    return this.temuanAudit.find((t) => t.id === id && t.tenantId === tenantId);
  }

  createTemuanAudit(
    data: Omit<TemuanAudit, 'id' | 'createdAt' | 'updatedAt'>
  ): TemuanAudit {
    const now = new Date().toISOString();
    const baru: TemuanAudit = {
      ...data,
      aksiTindakLanjut: Array.isArray(data.aksiTindakLanjut) ? data.aksiTindakLanjut : [],
      id: `tem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.temuanAudit.push(baru);
    this.trackWrite(this.mysql?.upsertTemuanAudit(baru.id, baru.tenantId, baru));
    this.persist();
    return baru;
  }

  updateTemuanAudit(
    id: string,
    tenantId: string,
    partial: Partial<TemuanAudit>
  ): TemuanAudit | undefined {
    const idx = this.temuanAudit.findIndex((t) => t.id === id && t.tenantId === tenantId);
    if (idx === -1) return undefined;
    const lama = this.temuanAudit[idx];
    const digabung: TemuanAudit = {
      ...lama,
      ...partial,
      // id & tenantId & riwayat tidak boleh diubah lewat partial.
      id: lama.id,
      tenantId: lama.tenantId,
      aksiTindakLanjut: lama.aksiTindakLanjut,
      createdAt: lama.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.temuanAudit[idx] = digabung;
    this.trackWrite(this.mysql?.upsertTemuanAudit(digabung.id, digabung.tenantId, digabung));
    this.persist();
    return digabung;
  }

  deleteTemuanAudit(id: string, tenantId: string): boolean {
    const ada = this.temuanAudit.some((t) => t.id === id && t.tenantId === tenantId);
    if (!ada) return false;
    this.temuanAudit = this.temuanAudit.filter((t) => t.id !== id);
    this.trackWrite(this.mysql?.deleteTemuanAuditRow(id));
    this.persist();
    return true;
  }

  /**
   * Tambahkan satu aksi tindak lanjut ke riwayat temuan (append-only) DAN
   * perbarui status temuan mengikuti `statusSesudah`. Mengembalikan temuan
   * terbaru, atau `undefined` bila temuan tidak ada di instansi itu.
   */
  tambahAksiTindakLanjut(
    temuanId: string,
    tenantId: string,
    aksi: AksiTindakLanjut,
    patchTemuan?: Partial<TemuanAudit>
  ): TemuanAudit | undefined {
    const idx = this.temuanAudit.findIndex((t) => t.id === temuanId && t.tenantId === tenantId);
    if (idx === -1) return undefined;
    const lama = this.temuanAudit[idx];
    const diperbarui: TemuanAudit = {
      ...lama,
      ...(patchTemuan || {}),
      id: lama.id,
      tenantId: lama.tenantId,
      status: aksi.statusSesudah,
      aksiTindakLanjut: [...lama.aksiTindakLanjut, aksi],
      createdAt: lama.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.temuanAudit[idx] = diperbarui;
    this.trackWrite(this.mysql?.upsertTemuanAudit(diperbarui.id, diperbarui.tenantId, diperbarui));
    this.persist();
    return diperbarui;
  }

  /* ================= MANAJEMEN RISIKO ================= */

  /** Daftar risiko sebuah instansi (opsional disaring kategori/level/status). */
  getRisiko(
    tenantId: string,
    filter?: { kategori?: string; level?: string; status?: string }
  ): Risiko[] {
    return this.risiko.filter(
      (r) =>
        r.tenantId === tenantId &&
        (!filter?.kategori || r.kategori === filter.kategori) &&
        (!filter?.level || r.level === filter.level) &&
        (!filter?.status || r.status === filter.status)
    );
  }

  getRisikoById(id: string, tenantId: string): Risiko | undefined {
    return this.risiko.find((r) => r.id === id && r.tenantId === tenantId);
  }

  createRisiko(data: Omit<Risiko, 'id' | 'createdAt' | 'updatedAt'>): Risiko {
    const now = new Date().toISOString();
    const baru: Risiko = {
      ...data,
      aksiMitigasi: Array.isArray(data.aksiMitigasi) ? data.aksiMitigasi : [],
      id: `rsk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.risiko.push(baru);
    this.trackWrite(this.mysql?.upsertRisiko(baru.id, baru.tenantId, baru));
    this.persist();
    return baru;
  }

  /**
   * Ubah risiko. `id`/`tenantId`/`createdAt`/riwayat mitigasi tidak boleh
   * berubah lewat `partial` — sama seperti `updateTemuanAudit`.
   */
  updateRisiko(id: string, tenantId: string, partial: Partial<Risiko>): Risiko | undefined {
    const idx = this.risiko.findIndex((r) => r.id === id && r.tenantId === tenantId);
    if (idx === -1) return undefined;
    const lama = this.risiko[idx];
    const digabung: Risiko = {
      ...lama,
      ...partial,
      id: lama.id,
      tenantId: lama.tenantId,
      aksiMitigasi: lama.aksiMitigasi,
      createdAt: lama.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.risiko[idx] = digabung;
    this.trackWrite(this.mysql?.upsertRisiko(digabung.id, digabung.tenantId, digabung));
    this.persist();
    return digabung;
  }

  deleteRisiko(id: string, tenantId: string): boolean {
    const ada = this.risiko.some((r) => r.id === id && r.tenantId === tenantId);
    if (!ada) return false;
    this.risiko = this.risiko.filter((r) => r.id !== id);
    this.trackWrite(this.mysql?.deleteRisikoRow(id));
    this.persist();
    return true;
  }

  /**
   * Tambahkan satu aksi mitigasi ke riwayat risiko (append-only) DAN perbarui
   * status risiko mengikuti `statusSesudah`. Mengembalikan risiko terbaru, atau
   * `undefined` bila risiko tidak ada di instansi itu.
   */
  tambahAksiMitigasi(
    risikoId: string,
    tenantId: string,
    aksi: AksiMitigasi,
    patchRisiko?: Partial<Risiko>
  ): Risiko | undefined {
    const idx = this.risiko.findIndex((r) => r.id === risikoId && r.tenantId === tenantId);
    if (idx === -1) return undefined;
    const lama = this.risiko[idx];
    const diperbarui: Risiko = {
      ...lama,
      ...(patchRisiko || {}),
      id: lama.id,
      tenantId: lama.tenantId,
      status: aksi.statusSesudah,
      levelResidual: aksi.levelResidual ?? lama.levelResidual,
      aksiMitigasi: [...lama.aksiMitigasi, aksi],
      createdAt: lama.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.risiko[idx] = diperbarui;
    this.trackWrite(this.mysql?.upsertRisiko(diperbarui.id, diperbarui.tenantId, diperbarui));
    this.persist();
    return diperbarui;
  }

  /* ================= MANAJEMEN ASET ================= */

  /** Daftar aset sebuah instansi (opsional disaring kategori/kondisi/pemanfaatan). */
  getAset(
    tenantId: string,
    filter?: { kategori?: string; kondisi?: string; pemanfaatan?: string }
  ): Aset[] {
    return this.aset.filter(
      (a) =>
        a.tenantId === tenantId &&
        (!filter?.kategori || a.kategori === filter.kategori) &&
        (!filter?.kondisi || a.kondisi === filter.kondisi) &&
        (!filter?.pemanfaatan || a.pemanfaatan === filter.pemanfaatan)
    );
  }

  getAsetById(id: string, tenantId: string): Aset | undefined {
    return this.aset.find((a) => a.id === id && a.tenantId === tenantId);
  }

  createAset(data: Omit<Aset, 'id' | 'createdAt' | 'updatedAt'>): Aset {
    const now = new Date().toISOString();
    const baru: Aset = {
      ...data,
      id: `ast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.aset.push(baru);
    this.trackWrite(this.mysql?.upsertAset(baru.id, baru.tenantId, baru));
    this.persist();
    return baru;
  }

  /**
   * Ubah aset. `id`/`tenantId`/`createdAt` tidak boleh diubah klien.
   * Nilai buku/penyusutan dihitung ulang di lapisan API dari field mentah.
   */
  updateAset(id: string, tenantId: string, partial: Partial<Aset>): Aset | undefined {
    const idx = this.aset.findIndex((a) => a.id === id && a.tenantId === tenantId);
    if (idx === -1) return undefined;
    const lama = this.aset[idx];
    const digabung: Aset = {
      ...lama,
      ...partial,
      id: lama.id,
      tenantId: lama.tenantId,
      createdAt: lama.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.aset[idx] = digabung;
    this.trackWrite(this.mysql?.upsertAset(digabung.id, digabung.tenantId, digabung));
    this.persist();
    return digabung;
  }

  deleteAset(id: string, tenantId: string): boolean {
    const ada = this.aset.some((a) => a.id === id && a.tenantId === tenantId);
    if (!ada) return false;
    this.aset = this.aset.filter((a) => a.id !== id);
    this.trackWrite(this.mysql?.deleteAsetRow(id));
    this.persist();
    return true;
  }

  /* ================= PERJANJIAN KINERJA ================= */

  /** Daftar Perjanjian Kinerja sebuah instansi (opsional disaring periode/status). */
  getPerjanjianKinerja(tenantId: string, filter?: { periode?: string; status?: string }): PerjanjianKinerja[] {
    return this.perjanjianKinerja.filter(
      (p) =>
        p.tenantId === tenantId &&
        (!filter?.periode || p.periode === filter.periode) &&
        (!filter?.status || p.status === filter.status)
    );
  }

  getPerjanjianKinerjaById(id: string, tenantId: string): PerjanjianKinerja | undefined {
    return this.perjanjianKinerja.find((p) => p.id === id && p.tenantId === tenantId);
  }

  createPerjanjianKinerja(data: Omit<PerjanjianKinerja, 'id' | 'createdAt' | 'updatedAt'>): PerjanjianKinerja {
    const now = new Date().toISOString();
    const baru: PerjanjianKinerja = {
      ...data,
      id: `pk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.perjanjianKinerja.push(baru);
    this.trackWrite(this.mysql?.upsertPerjanjianKinerja(baru.id, baru.tenantId, baru));
    this.persist();
    return baru;
  }

  /** Ubah dokumen PK. `id`/`tenantId`/`createdAt` tidak boleh diubah klien. */
  updatePerjanjianKinerja(
    id: string,
    tenantId: string,
    partial: Partial<PerjanjianKinerja>
  ): PerjanjianKinerja | undefined {
    const idx = this.perjanjianKinerja.findIndex((p) => p.id === id && p.tenantId === tenantId);
    if (idx === -1) return undefined;
    const lama = this.perjanjianKinerja[idx];
    const digabung: PerjanjianKinerja = {
      ...lama,
      ...partial,
      id: lama.id,
      tenantId: lama.tenantId,
      createdAt: lama.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.perjanjianKinerja[idx] = digabung;
    this.trackWrite(this.mysql?.upsertPerjanjianKinerja(digabung.id, digabung.tenantId, digabung));
    this.persist();
    return digabung;
  }

  deletePerjanjianKinerja(id: string, tenantId: string): boolean {
    const ada = this.perjanjianKinerja.some((p) => p.id === id && p.tenantId === tenantId);
    if (!ada) return false;
    this.perjanjianKinerja = this.perjanjianKinerja.filter((p) => p.id !== id);
    this.trackWrite(this.mysql?.deletePerjanjianKinerjaRow(id));
    this.persist();
    return true;
  }

  /* ================= LKjIP ================= */

  /** Daftar LKjIP sebuah instansi (opsional disaring periode/status). */
  getLKjIP(tenantId: string, filter?: { periode?: string; status?: string }): LKjIP[] {
    return this.lkjip.filter(
      (l) =>
        l.tenantId === tenantId &&
        (!filter?.periode || l.periode === filter.periode) &&
        (!filter?.status || l.status === filter.status)
    );
  }

  getLKjIPById(id: string, tenantId: string): LKjIP | undefined {
    return this.lkjip.find((l) => l.id === id && l.tenantId === tenantId);
  }

  createLKjIP(data: Omit<LKjIP, 'id' | 'createdAt' | 'updatedAt'>): LKjIP {
    const now = new Date().toISOString();
    const baru: LKjIP = {
      ...data,
      id: `lkjip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.lkjip.push(baru);
    this.trackWrite(this.mysql?.upsertLKjIP(baru.id, baru.tenantId, baru));
    this.persist();
    return baru;
  }

  /** Ubah LKjIP. `id`/`tenantId`/`createdAt` tidak boleh diubah klien. */
  updateLKjIP(id: string, tenantId: string, partial: Partial<LKjIP>): LKjIP | undefined {
    const idx = this.lkjip.findIndex((l) => l.id === id && l.tenantId === tenantId);
    if (idx === -1) return undefined;
    const lama = this.lkjip[idx];
    const digabung: LKjIP = {
      ...lama,
      ...partial,
      id: lama.id,
      tenantId: lama.tenantId,
      createdAt: lama.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.lkjip[idx] = digabung;
    this.trackWrite(this.mysql?.upsertLKjIP(digabung.id, digabung.tenantId, digabung));
    this.persist();
    return digabung;
  }

  deleteLKjIP(id: string, tenantId: string): boolean {
    const ada = this.lkjip.some((l) => l.id === id && l.tenantId === tenantId);
    if (!ada) return false;
    this.lkjip = this.lkjip.filter((l) => l.id !== id);
    this.trackWrite(this.mysql?.deleteLKjIPRow(id));
    this.persist();
    return true;
  }

  /* ================= KESEHATAN KEUANGAN & RASIO ================= */

  /** Snapshot kesehatan keuangan sebuah instansi (opsional satu periode). */
  getSnapshotKeuangan(tenantId: string, periode?: string): SnapshotKeuangan[] {
    return this.snapshotKeuangan.filter(
      (s) => s.tenantId === tenantId && (!periode || s.periode === periode)
    );
  }

  getSnapshotKeuanganById(id: string, tenantId: string): SnapshotKeuangan | undefined {
    return this.snapshotKeuangan.find((s) => s.id === id && s.tenantId === tenantId);
  }

  /**
   * Catat/perbarui snapshot untuk (instansi, periode).
   *
   * Idempoten seperti `catatLaporan`: periode yang sama diperbarui, bukan
   * digandakan. Rasio dihitung ulang oleh pemanggil (server) sebelum dikirim.
   */
  catatSnapshotKeuangan(
    data: Omit<SnapshotKeuangan, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): SnapshotKeuangan {
    const now = new Date().toISOString();
    const idx = this.snapshotKeuangan.findIndex(
      (s) => s.tenantId === data.tenantId && s.periode === data.periode
    );
    if (idx !== -1) {
      const lama = this.snapshotKeuangan[idx];
      const diperbarui: SnapshotKeuangan = {
        ...lama,
        ...data,
        id: lama.id,
        createdAt: lama.createdAt,
        updatedAt: now,
      };
      this.snapshotKeuangan[idx] = diperbarui;
      this.trackWrite(
        this.mysql?.upsertSnapshotKeuangan(diperbarui.id, diperbarui.tenantId, diperbarui)
      );
      this.persist();
      return diperbarui;
    }
    const baru: SnapshotKeuangan = {
      ...data,
      id: data.id || `keu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.snapshotKeuangan.push(baru);
    this.trackWrite(this.mysql?.upsertSnapshotKeuangan(baru.id, baru.tenantId, baru));
    this.persist();
    return baru;
  }

  deleteSnapshotKeuangan(id: string, tenantId: string): boolean {
    const ada = this.snapshotKeuangan.some((s) => s.id === id && s.tenantId === tenantId);
    if (!ada) return false;
    this.snapshotKeuangan = this.snapshotKeuangan.filter((s) => s.id !== id);
    this.trackWrite(this.mysql?.deleteSnapshotKeuanganRow(id));
    this.persist();
    return true;
  }
}

export const db = new InMemoryDb();
