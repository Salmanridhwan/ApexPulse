import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { DbSnapshot, MysqlStore } from './mysqlStore';
import { daftarBerubah, gabungKonfig, kunciKonfigBerubah } from './sinkronKonfig';
import path from 'path';
import {
  AlertRule,
  AuditLog,
  BumdSector,
  Chat,
  ChatMessage,
  Dashboard,
  KetersediaanPreset,
  PermintaanData,
  AnalisisDokumen,
  ButirData,
  UsulanHalaman,
  NotificationItem,
  Tenant,
  User,
  WidgetSpec,
} from '../../types';
import { hashPassword, verifyPassword } from '../auth/session';
import { SANDI_ADMIN_BAWAAN } from '../auth/password';
import { dekripsiNilai, enkripsiNilai, pakaiKunciLama, terenkripsi } from '../config/rahasia';
import { normalisasiPeran, normalisasiPeranAkun } from '../auth/peran';
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
    name: 'Siti Rahmawati, S.E. (Pengguna BUMD)',
    role: 'pengguna',
    tenantId: 'tenant-pdam',
    avatar: '',
  },
  {
    id: 'user-direksi',
    email: 'direksi@aionesboard.id',
    name: 'Dr. Ir. Hendra Kusuma (Direktur Utama)',
    role: 'pengguna',
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
    role: 'pengguna',
    tenantId: 'tenant-pdam',
    avatar: '',
  },
];

/**
 * Akun demo Admin Aiones (pihak kita).
 *
 * SENGAJA tidak dimasukkan ke `SEED_USERS`: `ensureSeedUsers` menyetel ulang
 * sandi semua akun seed ke sandi demo yang diketahui dan menghapus tanda
 * `mustChangePassword`. Untuk akun pemilik platform, sandi harus acak, hanya
 * dicetak sekali saat dibuat, dan wajib diganti saat login pertama. Karena itu
 * akun ini punya jalur sendiri: `ensureSuperadminDemo`.
 */
const SUPERADMIN_DEMO: SafeUser = {
  id: 'user-superadmin',
  email: 'admin.aiones@aionesboard.id',
  name: 'Admin Aiones (Demo)',
  role: 'superadmin',
  tenantId: 'tenant-pdam',
  avatar: '',
};

/** Password seed khusus per userId (selain default DEMO_PASSWORD). */
const SEED_PASSWORDS: Record<string, string> = {
  // Akun admin memakai sandi bawaan yang berlaku sekarang.
  'user-admin-gmail': SANDI_ADMIN_BAWAAN,
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
  permintaanData?: PermintaanData[];
  analisisDokumen?: AnalisisDokumen[];
  butirData?: ButirData[];
  usulanHalaman?: UsulanHalaman[];
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
     * Batas analisis dokumen (RAG) per instansi per hari. Analisis memanggil
     * model dan memakan token, jadi harus ada pagar — 20 dokumen/hari cukup
     * untuk unggahan rutin, dan habisnya kuota tidak menghilangkan dokumen
     * (statusnya `tertunda-kuota`, bukan gagal).
     */
    kuotaAnalisisHarian: 20,
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

  /** Permintaan data dari User ke Admin Instansi (dikelola per-baris di MySQL). */
  public permintaanData: PermintaanData[] = [];
  /** Hasil analisis dokumen (Fase 2) — satu baris per berkas, per-baris di MySQL. */
  public analisisDokumen: AnalisisDokumen[] = [];
  /** Butir data hasil analisis — bahan menyusun widget. */
  public butirData: ButirData[] = [];
  /** Usulan perubahan halaman dari asisten — belum menyentuh dashboard sampai diterapkan. */
  public usulanHalaman: UsulanHalaman[] = [];

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

  /** Alasan MySQL tidak dipakai saat boot — ditampilkan di /health. */
  private galatMuat: string | null = null;

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
      permintaanData: this.permintaanData,
      analisisDokumen: this.analisisDokumen,
      butirData: this.butirData,
      usulanHalaman: this.usulanHalaman,
    };
  }

  /** true bila mirror MySQL aktif — dipakai endpoint /health agar tidak hardcode. */
  public get persistenceActive(): boolean {
    return this.mysql !== null;
  }

  /** Pesan galat saat memuat state dari MySQL (null bila tidak ada masalah). */
  public get galatPersistence(): string | null {
    return this.galatMuat;
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
        if (Array.isArray(loaded.permintaanData)) this.permintaanData = loaded.permintaanData;
        if (Array.isArray(loaded.analisisDokumen)) this.analisisDokumen = loaded.analisisDokumen;
        if (Array.isArray(loaded.butirData)) this.butirData = loaded.butirData;
        if (Array.isArray(loaded.usulanHalaman)) this.usulanHalaman = loaded.usulanHalaman;
        if (loaded.systemConfig) {
          this.systemConfig = { ...this.systemConfig, ...(loaded.systemConfig as object) };
        }
        // Buang tenant yang sudah dihapus admin (kalau state lama masih memuatnya).
        if (this.deletedTenantIds.length > 0) {
          this.tenants = this.tenants.filter((t) => !this.deletedTenantIds.includes(t.id));
        }
        this.normalisasiPeranLama();
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
      await this.sinkronPermintaanKeMysql();
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
      // Disimpan supaya /health menyebut alasannya, bukan cuma "file".
      this.galatMuat = String(err?.message || err);
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
        // Peran lama di tabel auth_users (analis/direksi) → pengguna. Dilakukan
        // SEBELUM loop upsert di bawah supaya baris di database ikut terkoreksi.
        this.normalisasiPeranLama();
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
        // Jangan ganti daftar di memori selama masih ada tulisan menggantung.
        // Hasil baca tabel bisa lebih tua daripada pesan yang baru saja
        // ditambahkan; menimpanya membuat balasan asisten lenyap dari riwayat
        // padahal sudah tampil di layar (dan `addChatMessage` berikutnya bisa
        // kehilangan chat-nya sama sekali).
        if (this.pendingWrites === 0) this.chats = chatTabel;
      }
    } catch (err: any) {
      console.error('[AionesBoard DB] Sinkron dashboard/chat gagal:', err?.message || err);
    }
  }

  /**
   * Selaraskan permintaan data, analisis dokumen, dan butir data ke tabel khusus
   * (migrasi + multi-instance). Tabel kosong = migrasi dari memori; tabel berisi
   * = SUMBER KEBENARAN.
   */
  private async sinkronPermintaanKeMysql(): Promise<void> {
    if (!this.mysql) return;
    try {
      const permintaanTabel = await this.mysql.loadPermintaanData();
      if (permintaanTabel.length === 0 && this.permintaanData.length > 0) {
        for (const p of this.permintaanData) {
          await this.mysql.upsertPermintaanData(p.id, p.tenantId, p);
        }
      } else if (permintaanTabel.length > 0) {
        this.permintaanData = permintaanTabel;
      }
      const analisisTabel = await this.mysql.loadAnalisisDokumen();
      if (analisisTabel.length === 0 && this.analisisDokumen.length > 0) {
        for (const a of this.analisisDokumen) {
          await this.mysql.upsertAnalisisDokumen(a.id, a.tenantId, a);
        }
      } else if (analisisTabel.length > 0) {
        this.analisisDokumen = analisisTabel;
      }
      const butirTabel = await this.mysql.loadButirData();
      if (butirTabel.length === 0 && this.butirData.length > 0) {
        for (const b of this.butirData) {
          await this.mysql.upsertButirData(b.id, b.tenantId, b);
        }
      } else if (butirTabel.length > 0) {
        this.butirData = butirTabel;
      }
    } catch (err: any) {
      console.error('[AionesBoard DB] Sinkron permintaan gagal:', err?.message || err);
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
      const permintaan = await this.mysql.loadPermintaanData();
      if (permintaan.length > 0 || this.permintaanData.length === 0) this.permintaanData = permintaan;
      const analisis = await this.mysql.loadAnalisisDokumen();
      if (analisis.length > 0 || this.analisisDokumen.length === 0) this.analisisDokumen = analisis;
      const butir = await this.mysql.loadButirData();
      if (butir.length > 0 || this.butirData.length === 0) this.butirData = butir;
      const usulan = await this.mysql.loadUsulanHalaman();
      if (usulan.length > 0 || this.usulanHalaman.length === 0) this.usulanHalaman = usulan;
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
    const demoPassword = process.env.DEMO_PASSWORD || SANDI_ADMIN_BAWAAN;
    for (const u of SEED_USERS) {
      this.credentials[u.id] = hashPassword(SEED_PASSWORDS[u.id] || demoPassword);
    }
  }

  /**
   * Normalkan peran lama (`analis`, `direksi`) menjadi `pengguna`.
   *
   * Data dari MySQL maupun `data/db.json` cadangan lama masih memakai dua
   * peran yang sudah digabung. Tanpa normalisasi, akun itu tidak cocok dengan
   * gerbang izin mana pun (bukan admin, bukan pengguna) sehingga UI
   * menampilkan hak akses yang salah. Idempoten — aman dipanggil tiap start.
   */
  private normalisasiPeranLama(): void {
    let berubah = false;
    for (const u of this.users) {
      // `normalisasiPeranAkun`, bukan `normalisasiPeran`: peran `superadmin`
      // harus bertahan saat state dimuat ulang (lihat catatan di auth/peran.ts).
      const peran = normalisasiPeranAkun(u.role);
      if (u.role !== peran) {
        u.role = peran;
        berubah = true;
      }
    }
    if (berubah) this.persist();
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
      const sandiTarget =
        SEED_PASSWORDS[seed.id] || process.env.DEMO_PASSWORD || SANDI_ADMIN_BAWAAN;
      const hashLama = this.credentials[seed.id];
      // Akun seed yang masih memakai sandi bawaan lama ("123", sandi demo lama)
      // dipindahkan ke sandi yang berlaku sekarang, supaya satu sandi admin
      // benar-benar bisa dipakai dan tidak ada akun yang tertinggal.
      const masihSandiLama = hashLama
        ? ['123', 'aionesboard2026', 'apexpulse2026'].some((lama) => verifyPassword(lama, hashLama))
        : false;
      if (!hashLama || masihSandiLama || !verifyPassword(sandiTarget, hashLama)) {
        this.credentials[seed.id] = hashPassword(sandiTarget);
        berubah = true;
      }
    }
    // Tanda "wajib ganti sandi" hanya dibersihkan untuk akun seed lama.
    // Akun Admin Aiones justru WAJIB mengganti sandi saat login pertama, jadi
    // tandanya tidak boleh ikut dibersihkan di sini.
    const idSeed = new Set(SEED_USERS.map((u) => u.id));
    for (const u of this.users) {
      if (u.mustChangePassword && idSeed.has(u.id)) {
        u.mustChangePassword = false;
        berubah = true;
      }
    }
    if (this.ensureSuperadminDemo()) berubah = true;
    if (berubah) this.persist();
  }

  /**
   * Pastikan akun demo Admin Aiones ada.
   *
   * Dibuat SEKALI: sandi acak 20 karakter, hash scrypt, dicetak sekali ke log
   * server, dan `mustChangePassword` menyala. Kalau akun sudah ada, sandi tidak
   * pernah disetel ulang — supaya sandi yang sudah diganti pemilik tidak
   * kembali menjadi nilai acak setiap restart.
   *
   * @returns true bila state berubah sehingga perlu disimpan.
   */
  private ensureSuperadminDemo(): boolean {
    if (this.deletedTenantIds.includes(SUPERADMIN_DEMO.tenantId)) return false;
    const ada = this.users.find((u) => u.id === SUPERADMIN_DEMO.id);
    if (ada) {
      // Jaga peran tetap superadmin walau ada data lama yang menurunkannya.
      if (ada.role !== 'superadmin') {
        ada.role = 'superadmin';
        return true;
      }
      return false;
    }
    const sandi = randomBytes(15).toString('base64url');
    this.users.push({ ...SUPERADMIN_DEMO, mustChangePassword: true });
    this.credentials[SUPERADMIN_DEMO.id] = hashPassword(sandi);
    console.log(
      [
        '',
        '='.repeat(64),
        'AKUN DEMO ADMIN AIONES DIBUAT (ditampilkan sekali saja)',
        `  email : ${SUPERADMIN_DEMO.email}`,
        `  sandi : ${sandi}`,
        '  Wajib diganti saat login pertama.',
        '  Sandi ini tidak disimpan di repo, dokumen, atau percakapan.',
        '  Kalau hilang, pakai menu lupa sandi.',
        '='.repeat(64),
        '',
      ].join('\n')
    );
    return true;
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
      if (Array.isArray(parsed.permintaanData)) this.permintaanData = parsed.permintaanData;
      if (Array.isArray(parsed.analisisDokumen)) this.analisisDokumen = parsed.analisisDokumen;
      if (Array.isArray(parsed.butirData)) this.butirData = parsed.butirData;
      if (Array.isArray(parsed.usulanHalaman)) this.usulanHalaman = parsed.usulanHalaman;
      if (parsed.credentials) this.credentials = parsed.credentials;
      // Peran lama di berkas cadangan (analis/direksi) → pengguna.
      this.normalisasiPeranLama();
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

  /**
   * Muat ulang konfigurasi & daftar instansi dari MySQL.
   *
   * Dipanggil berkala oleh server (lihat CONFIG_REFRESH_SECONDS) supaya
   * perubahan yang disimpan di instance lain langsung terpakai di sini, tanpa
   * restart. Mengembalikan daftar bagian yang berubah agar bisa dicatat di log;
   * array kosong berarti tidak ada perubahan (atau MySQL tidak aktif).
   */
  /** Hitungan percobaan bersama (null bila MySQL tidak aktif → pemanggil pakai memori). */
  public async percobaanBaca(kunci: string) {
    return this.mysql ? this.mysql.bacaPercobaan(kunci) : null;
  }

  public async percobaanNaikkan(kunci: string, jendelaMs: number) {
    if (!this.mysql) return null;
    return this.mysql.naikkanPercobaan(kunci, jendelaMs);
  }

  public async percobaanHapus(kunci: string) {
    if (this.mysql) await this.mysql.hapusPercobaan(kunci);
  }

  public async percobaanBersihkanKedaluwarsa() {
    if (this.mysql) await this.mysql.bersihkanPercobaanKedaluwarsa();
  }

  public async muatUlangDariDatabase(): Promise<string[]> {
    if (!this.mysql) return [];
    const berubah: string[] = [];
    try {
      const konfigBaris = await this.mysql.loadBaris('systemConfig');
      const konfigBaru = konfigBaris[0];
      if (konfigBaru && typeof konfigBaru === 'object') {
        const beda = kunciKonfigBerubah(
          this.systemConfig as unknown as Record<string, unknown>,
          konfigBaru as Record<string, unknown>
        );
        if (beda.length > 0) {
          this.systemConfig = gabungKonfig(
            this.systemConfig as unknown as Record<string, unknown>,
            konfigBaru as Record<string, unknown>
          ) as unknown as typeof this.systemConfig;
          berubah.push(...beda.map((k) => `config.${k}`));
        }
      }

      const tenantBaru = await this.mysql.loadTenants();
      if (tenantBaru.length > 0) {
        const bersih = this.deletedTenantIds.length
          ? tenantBaru.filter((t) => !this.deletedTenantIds.includes(t.id))
          : tenantBaru;
        if (daftarBerubah(this.tenants, bersih)) {
          this.tenants = bersih;
          berubah.push('tenants');
        }
      }
    } catch (err: any) {
      // Database sesaat tidak bisa dibaca bukan alasan mematikan server.
      console.warn('[AionesBoard DB] gagal memuat ulang konfigurasi:', err?.message || err);
    }
    return berubah;
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
        permintaanData: this.permintaanData,
        analisisDokumen: this.analisisDokumen,
        butirData: this.butirData,
        usulanHalaman: this.usulanHalaman,
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

  /** Hapus satu notifikasi (dipakai saat permintaan data yang memicunya dihapus). */
  public hapusNotifikasi(id: string): void {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.trackWrite(this.mysql?.deleteBaris('notifications', id));
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

    // 3j) Permintaan data instansi ini. Lampirannya menunjuk berkas KMS milik
    // instansi yang sama, jadi tidak ada yang perlu dihapus di sisi KMS di sini.
    const permintaanHapus = this.permintaanData.filter((p) => p.tenantId === id);
    this.permintaanData = this.permintaanData.filter((p) => p.tenantId !== id);
    for (const p of permintaanHapus) this.trackWrite(this.mysql?.deletePermintaanDataRow(p.id));
    // 3k) Analisis dokumen & butir data instansi ini.
    const analisisHapus = this.analisisDokumen.filter((a) => a.tenantId === id);
    this.analisisDokumen = this.analisisDokumen.filter((a) => a.tenantId !== id);
    for (const a of analisisHapus) this.trackWrite(this.mysql?.deleteAnalisisDokumenRow(a.id));
    const butirHapus = this.butirData.filter((b) => b.tenantId === id);
    this.butirData = this.butirData.filter((b) => b.tenantId !== id);
    for (const b of butirHapus) this.trackWrite(this.mysql?.deleteButirDataRow(b.id));
    // 3l) Usulan perubahan halaman instansi ini.
    const usulanHapus = this.usulanHalaman.filter((u) => u.tenantId === id);
    this.usulanHalaman = this.usulanHalaman.filter((u) => u.tenantId !== id);
    for (const u of usulanHapus) this.trackWrite(this.mysql?.deleteUsulanHalamanRow(u.id));

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

  /* ================= PERMINTAAN DATA ================= */

  /**
   * Daftar permintaan data sebuah instansi. `pemohonId` dipakai server untuk
   * memaksa User hanya melihat miliknya sendiri; admin tidak mengisinya.
   */
  getPermintaanData(
    tenantId: string,
    filter?: { status?: string; bidang?: string; pemohonId?: string }
  ): PermintaanData[] {
    return this.permintaanData
      .filter(
        (p) =>
          p.tenantId === tenantId &&
          (!filter?.status || p.status === filter.status) &&
          (!filter?.bidang || p.bidang === filter.bidang) &&
          (!filter?.pemohonId || p.pemohonId === filter.pemohonId)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getPermintaanDataById(id: string, tenantId: string): PermintaanData | undefined {
    return this.permintaanData.find((p) => p.id === id && p.tenantId === tenantId);
  }

  createPermintaanData(
    data: Omit<PermintaanData, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'lampiran' | 'catatan'> & {
      status?: PermintaanData['status'];
      lampiran?: PermintaanData['lampiran'];
      catatan?: PermintaanData['catatan'];
    }
  ): PermintaanData {
    const now = new Date().toISOString();
    const baru: PermintaanData = {
      ...data,
      status: data.status || 'baru',
      lampiran: Array.isArray(data.lampiran) ? data.lampiran : [],
      catatan: Array.isArray(data.catatan) ? data.catatan : [],
      id: `prm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.permintaanData.push(baru);
    this.trackWrite(this.mysql?.upsertPermintaanData(baru.id, baru.tenantId, baru));
    this.persist();
    return baru;
  }

  /**
   * Perbarui permintaan. `catatan` sengaja tidak bisa ditimpa lewat sini —
   * riwayat tanggapan hanya bertambah lewat `tambahCatatanPermintaan` supaya
   * tidak ada percakapan yang hilang karena satu PATCH.
   */
  updatePermintaanData(
    id: string,
    tenantId: string,
    partial: Partial<PermintaanData>
  ): PermintaanData | undefined {
    const idx = this.permintaanData.findIndex((p) => p.id === id && p.tenantId === tenantId);
    if (idx === -1) return undefined;
    const lama = this.permintaanData[idx];
    const digabung: PermintaanData = {
      ...lama,
      ...partial,
      id: lama.id,
      tenantId: lama.tenantId,
      pemohonId: lama.pemohonId,
      catatan: lama.catatan,
      createdAt: lama.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.permintaanData[idx] = digabung;
    this.trackWrite(this.mysql?.upsertPermintaanData(digabung.id, digabung.tenantId, digabung));
    this.persist();
    return digabung;
  }

  /** Tambah satu tanggapan (append-only) dan kembalikan permintaan terbaru. */
  tambahCatatanPermintaan(
    id: string,
    tenantId: string,
    catatan: PermintaanData['catatan'][number],
    patch?: Partial<PermintaanData>
  ): PermintaanData | undefined {
    const idx = this.permintaanData.findIndex((p) => p.id === id && p.tenantId === tenantId);
    if (idx === -1) return undefined;
    const lama = this.permintaanData[idx];
    const digabung: PermintaanData = {
      ...lama,
      ...(patch || {}),
      id: lama.id,
      tenantId: lama.tenantId,
      pemohonId: lama.pemohonId,
      catatan: [...lama.catatan, catatan],
      createdAt: lama.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.permintaanData[idx] = digabung;
    this.trackWrite(this.mysql?.upsertPermintaanData(digabung.id, digabung.tenantId, digabung));
    this.persist();
    return digabung;
  }

  deletePermintaanData(id: string, tenantId: string): boolean {
    const ada = this.permintaanData.some((p) => p.id === id && p.tenantId === tenantId);
    if (!ada) return false;
    this.permintaanData = this.permintaanData.filter((p) => p.id !== id);
    this.trackWrite(this.mysql?.deletePermintaanDataRow(id));
    this.persist();
    return true;
  }

  /* ================= ANALISIS DOKUMEN & BUTIR DATA ================= */

  getAnalisisDokumen(
    tenantId: string,
    filter?: { permintaanId?: string; status?: string; berkasId?: string }
  ): AnalisisDokumen[] {
    return this.analisisDokumen
      .filter(
        (a) =>
          a.tenantId === tenantId &&
          (!filter?.permintaanId || a.permintaanId === filter.permintaanId) &&
          (!filter?.status || a.status === filter.status) &&
          (!filter?.berkasId || a.berkasId === filter.berkasId)
      )
      .sort((a, b) => b.dibuatPada.localeCompare(a.dibuatPada));
  }

  getAnalisisDokumenById(id: string, tenantId: string): AnalisisDokumen | undefined {
    return this.analisisDokumen.find((a) => a.id === id && a.tenantId === tenantId);
  }

  createAnalisisDokumen(
    data: Omit<AnalisisDokumen, 'id' | 'dibuatPada' | 'jumlahButir' | 'kategoriTerdeteksi'> & {
      jumlahButir?: number;
      kategoriTerdeteksi?: string[];
    }
  ): AnalisisDokumen {
    const baru: AnalisisDokumen = {
      ...data,
      jumlahButir: data.jumlahButir ?? 0,
      kategoriTerdeteksi: data.kategoriTerdeteksi ?? [],
      id: `anl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      dibuatPada: new Date().toISOString(),
    };
    this.analisisDokumen.push(baru);
    this.trackWrite(this.mysql?.upsertAnalisisDokumen(baru.id, baru.tenantId, baru));
    this.persist();
    return baru;
  }

  updateAnalisisDokumen(
    id: string,
    tenantId: string,
    partial: Partial<AnalisisDokumen>
  ): AnalisisDokumen | undefined {
    const idx = this.analisisDokumen.findIndex((a) => a.id === id && a.tenantId === tenantId);
    if (idx === -1) return undefined;
    const lama = this.analisisDokumen[idx];
    const digabung: AnalisisDokumen = {
      ...lama,
      ...partial,
      id: lama.id,
      tenantId: lama.tenantId,
      dibuatPada: lama.dibuatPada,
    };
    this.analisisDokumen[idx] = digabung;
    this.trackWrite(this.mysql?.upsertAnalisisDokumen(digabung.id, digabung.tenantId, digabung));
    this.persist();
    return digabung;
  }

  getButirData(
    tenantId: string,
    filter?: { analisisId?: string; permintaanId?: string; status?: string; kategori?: string }
  ): ButirData[] {
    return this.butirData.filter(
      (b) =>
        b.tenantId === tenantId &&
        (!filter?.analisisId || b.analisisId === filter.analisisId) &&
        (!filter?.permintaanId || b.permintaanId === filter.permintaanId) &&
        (!filter?.status || b.status === filter.status) &&
        (!filter?.kategori || b.kategori === filter.kategori)
    );
  }

  /** Simpan sekumpulan butir sekaligus (hasil satu analisis). */
  simpanButirData(daftar: ButirData[]): ButirData[] {
    for (const b of daftar) {
      const idx = this.butirData.findIndex((x) => x.id === b.id);
      if (idx === -1) this.butirData.push(b);
      else this.butirData[idx] = b;
      this.trackWrite(this.mysql?.upsertButirData(b.id, b.tenantId, b));
    }
    this.persist();
    return daftar;
  }

  updateButirData(
    id: string,
    tenantId: string,
    partial: Partial<ButirData>
  ): ButirData | undefined {
    const idx = this.butirData.findIndex((b) => b.id === id && b.tenantId === tenantId);
    if (idx === -1) return undefined;
    const lama = this.butirData[idx];
    const digabung: ButirData = {
      ...lama,
      ...partial,
      id: lama.id,
      tenantId: lama.tenantId,
      analisisId: lama.analisisId,
      berkasId: lama.berkasId,
      dibuatPada: lama.dibuatPada,
    };
    this.butirData[idx] = digabung;
    this.trackWrite(this.mysql?.upsertButirData(digabung.id, digabung.tenantId, digabung));
    this.persist();
    return digabung;
  }

  /** Hapus semua butir satu analisis (dipakai saat analisis diulang). */
  hapusButirAnalisis(analisisId: string, tenantId: string): number {
    const hapus = this.butirData.filter((b) => b.analisisId === analisisId && b.tenantId === tenantId);
    if (hapus.length === 0) return 0;
    this.butirData = this.butirData.filter((b) => !(b.analisisId === analisisId && b.tenantId === tenantId));
    for (const b of hapus) this.trackWrite(this.mysql?.deleteButirDataRow(b.id));
    this.persist();
    return hapus.length;
  }


  /* ================= USULAN PERUBAHAN HALAMAN ================= */

  getUsulanHalaman(
    tenantId: string,
    filter?: { dashboardId?: string; halamanId?: string; status?: string }
  ): UsulanHalaman[] {
    return this.usulanHalaman
      .filter(
        (u) =>
          u.tenantId === tenantId &&
          (!filter?.dashboardId || u.dashboardId === filter.dashboardId) &&
          (!filter?.halamanId || u.halamanId === filter.halamanId) &&
          (!filter?.status || u.status === filter.status)
      )
      .sort((a, b) => b.dibuatPada.localeCompare(a.dibuatPada));
  }

  getUsulanHalamanById(id: string, tenantId: string): UsulanHalaman | undefined {
    return this.usulanHalaman.find((u) => u.id === id && u.tenantId === tenantId);
  }

  createUsulanHalaman(
    data: Omit<UsulanHalaman, 'id' | 'dibuatPada' | 'status'> & { status?: UsulanHalaman['status'] }
  ): UsulanHalaman {
    const baru: UsulanHalaman = {
      ...data,
      status: data.status ?? 'menunggu',
      id: `usl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      dibuatPada: new Date().toISOString(),
    };
    this.usulanHalaman.unshift(baru);
    this.trackWrite(this.mysql?.upsertUsulanHalaman(baru.id, baru.tenantId, baru));
    this.persist();
    return baru;
  }

  updateUsulanHalaman(id: string, tenantId: string, partial: Partial<UsulanHalaman>): UsulanHalaman | undefined {
    const idx = this.usulanHalaman.findIndex((u) => u.id === id && u.tenantId === tenantId);
    if (idx === -1) return undefined;
    const lama = this.usulanHalaman[idx];
    const digabung: UsulanHalaman = {
      ...lama,
      ...partial,
      id: lama.id,
      tenantId: lama.tenantId,
      dibuatPada: lama.dibuatPada,
    };
    this.usulanHalaman[idx] = digabung;
    this.trackWrite(this.mysql?.upsertUsulanHalaman(digabung.id, digabung.tenantId, digabung));
    this.persist();
    return digabung;
  }

  deleteAnalisisDokumen(id: string, tenantId: string): boolean {
    const ada = this.analisisDokumen.some((a) => a.id === id && a.tenantId === tenantId);
    if (!ada) return false;
    this.analisisDokumen = this.analisisDokumen.filter((a) => !(a.id === id && a.tenantId === tenantId));
    this.trackWrite(this.mysql?.deleteAnalisisDokumenRow(id));
    this.hapusButirAnalisis(id, tenantId);
    this.persist();
    return true;
  }
}

export const db = new InMemoryDb();
