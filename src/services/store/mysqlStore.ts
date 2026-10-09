/**
 * Mirror persistence AionesBoard ke MySQL (Laragon).
 *
 * Pola: in-memory tetap sumber baca (cepat untuk demo), setiap mutasi
 * di-mirror ke MySQL dengan mengganti koleksi terkait dalam satu transaksi
 * (volume data demo kecil — replace penuh sederhana & selalu konsisten).
 * Saat boot, state dimuat dari MySQL; kalau kosong, seed aplikasi dipakai.
 * Urutan elemen dipertahankan lewat kolom `idx` (dashboard/audit perlu urutan).
 */
import mysql from 'mysql2/promise';
import { AlertRule, AuditLog, Chat, Dashboard, KetersediaanPreset, NotificationItem, Tenant } from '../../types';
import { SafeUser } from './inMemoryDb';

export interface MysqlConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface DbSnapshot {
  dashboards: Dashboard[];
  chats: Chat[];
  alertRules: AlertRule[];
  notifications: NotificationItem[];
  auditLogs: AuditLog[];
  shareTokens: Record<string, string>;
  /** token -> hash PIN (scrypt) untuk mode edit pada tautan publik. */
  sharePins: Record<string, string>;
  systemConfig: unknown;
  users: SafeUser[];
  credentials: Record<string, string>;
  tenants: Tenant[];
  ketersediaanPreset: KetersediaanPreset[];
  /** id instansi yang sudah dihapus admin — agar user seed-nya tidak dibuat ulang. */
  deletedTenantIds: string[];
}

export interface LoadedState {
  dashboards?: Dashboard[];
  chats?: Chat[];
  alertRules?: AlertRule[];
  notifications?: NotificationItem[];
  auditLogs?: AuditLog[];
  shareTokens?: Record<string, string>;
  sharePins?: Record<string, string>;
  systemConfig?: unknown;
  users?: SafeUser[];
  credentials?: Record<string, string>;
  tenants?: Tenant[];
  ketersediaanPreset?: KetersediaanPreset[];
  deletedTenantIds?: string[];
}

export class MysqlStore {
  private pool: mysql.Pool | null = null;
  private cfg: MysqlConfig;

  constructor(cfg: MysqlConfig) {
    this.cfg = cfg;
  }

  /** Koneksi + buat database & tabel bila belum ada. */
  async init(): Promise<void> {
    // 1) Koneksi tanpa database untuk CREATE DATABASE
    const server = await mysql.createConnection({
      host: this.cfg.host,
      port: this.cfg.port,
      user: this.cfg.user,
      password: this.cfg.password,
    });
    await server.query(
      `CREATE DATABASE IF NOT EXISTS \`${this.cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await server.end();

    // 2) Pool dengan database
    this.pool = mysql.createPool({
      host: this.cfg.host,
      port: this.cfg.port,
      user: this.cfg.user,
      password: this.cfg.password,
      database: this.cfg.database,
      waitForConnections: true,
      connectionLimit: 5,
    });

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS collections (
        name VARCHAR(64) NOT NULL,
        idx INT NOT NULL,
        id VARCHAR(128) NOT NULL,
        data JSON NOT NULL,
        PRIMARY KEY (name, idx)
      ) ENGINE=InnoDB
    `);
    // Migrasi tabel versi lama (PK cuma 'name' — hanya muat 1 baris per koleksi).
    const [pkRows] = await this.pool.query(
      `SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'collections' AND CONSTRAINT_NAME = 'PRIMARY'
       ORDER BY ORDINAL_POSITION`,
      [this.cfg.database]
    );
    const pkCols = (pkRows as Array<{ COLUMN_NAME: string }>).map((r) => r.COLUMN_NAME);
    if (pkCols.length === 1 && pkCols[0] === 'name') {
      await this.pool.query('ALTER TABLE collections DROP PRIMARY KEY, ADD PRIMARY KEY (name, idx)');
      console.log('[AionesBoard DB] Tabel collections dimigrasikan ke PK komposit (name, idx)');
    }
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS kv (
        k VARCHAR(64) PRIMARY KEY,
        data JSON NOT NULL
      ) ENGINE=InnoDB
    `);

    /**
     * Tabel auth KHUSUS, terpisah dari `collections`.
     *
     * Latar masalah: produksi berjalan di BEBERAPA instance backend yang berbagi
     * satu MySQL, dan `saveAll` menulis SNAPSHOT PENUH (DELETE semua lalu insert
     * state instance itu). Akibatnya user yang didaftarkan di satu instance
     * terhapus oleh snapshot instance lain — login/registrasi jadi tidak konsisten
     * (berhasil/gagal bergantian).
     *
     * Karena itu user & kredensial disimpan di tabel ini dengan UPSERT per-baris
     * (tanpa DELETE), sehingga tidak pernah saling menimpa antar instance.
     */
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS auth_users (
        id VARCHAR(128) PRIMARY KEY,
        data JSON NOT NULL,
        pass_hash TEXT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    /**
     * Tabel TENANT khusus, terpisah dari `collections`.
     *
     * Alasan sama dengan `auth_users`: `saveAll` menulis SNAPSHOT PENUH, sehingga
     * tenant yang dibuat/dihapus di satu instance backend hilang/balik lagi karena
     * ditimpa snapshot instance lain ("Tenant tidak ditemukan" padahal baru dibuat
     * dari instance yang lain). Di sini tenant ditulis PER-BARIS (upsert/delete),
     * dibaca ulang sebelum operasi yang bergantung padanya.
     */
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id VARCHAR(128) PRIMARY KEY,
        data JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    /**
     * Tabel DASHBOARD khusus, per-baris. Alasan sama: `saveAll` snapshot penuh
     * membuat dashboard yang dibuat di satu instance HILANG/balik lagi karena
     * ditimpa snapshot instance lain (daftar dashboard "berkedip" 3↔1). `seq`
     * menyimpan urutan (terbaru dulu) tanpa ikut berubah saat baris di-upsert.
     */
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS dashboards (
        id VARCHAR(128) PRIMARY KEY,
        tenant_id VARCHAR(128) NOT NULL,
        seq BIGINT NOT NULL DEFAULT 0,
        data JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_dash_tenant (tenant_id)
      ) ENGINE=InnoDB
    `);

    /**
     * Tabel CHAT khusus, per-baris (riwayat percakapan per dashboard).
     * Kalau chat ikut snapshot penuh, riwayat yang ditulis di satu instance
     * terhapus oleh snapshot instance lain — "history tidak ada".
     */
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id VARCHAR(128) PRIMARY KEY,
        tenant_id VARCHAR(128) NOT NULL,
        dashboard_id VARCHAR(128) NULL,
        data JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_chat_tenant (tenant_id),
        INDEX idx_chat_dash (dashboard_id)
      ) ENGINE=InnoDB
    `);
  }

  /** Tambah/perbarui SATU dashboard (upsert per-baris, aman multi-instance). */
  async upsertDashboard(id: string, tenantId: string, data: unknown, seq: number): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO dashboards (id, tenant_id, seq, data) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id), data = VALUES(data)`,
      [id, tenantId, seq, JSON.stringify(data)]
    );
  }

  /** Muat SEMUA dashboard dari tabel khusus (terbaru dulu). */
  async loadDashboards(): Promise<Dashboard[]> {
    if (!this.pool) return [];
    const [rows] = await this.pool.query('SELECT data FROM dashboards ORDER BY seq DESC');
    return (rows as Array<{ data: any }>).map((r) =>
      typeof r.data === 'string' ? JSON.parse(r.data) : r.data
    );
  }

  async deleteDashboardRow(id: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM dashboards WHERE id = ?', [id]);
  }

  /** Tambah/perbarui SATU chat (upsert per-baris, aman multi-instance). */
  async upsertChat(id: string, tenantId: string, dashboardId: string | null, data: unknown): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO chats (id, tenant_id, dashboard_id, data) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id),
         dashboard_id = VALUES(dashboard_id), data = VALUES(data)`,
      [id, tenantId, dashboardId, JSON.stringify(data)]
    );
  }

  /** Muat SEMUA chat dari tabel khusus. */
  async loadChats(): Promise<Chat[]> {
    if (!this.pool) return [];
    const [rows] = await this.pool.query('SELECT data FROM chats ORDER BY updated_at DESC');
    return (rows as Array<{ data: any }>).map((r) =>
      typeof r.data === 'string' ? JSON.parse(r.data) : r.data
    );
  }

  async deleteChatRow(id: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM chats WHERE id = ?', [id]);
  }

  /** Tambah/perbarui SATU tenant (upsert per-baris, aman multi-instance). */
  async upsertTenant(id: string, data: unknown): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO tenants (id, data) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data)`,
      [id, JSON.stringify(data)]
    );
  }

  /** Muat SEMUA tenant dari tabel tenant khusus. */
  async loadTenants(): Promise<Tenant[]> {
    if (!this.pool) return [];
    const [rows] = await this.pool.query('SELECT data FROM tenants');
    return (rows as Array<{ data: any }>).map((r) =>
      typeof r.data === 'string' ? JSON.parse(r.data) : r.data
    );
  }

  /** Hapus satu tenant dari tabel tenant khusus. */
  async deleteTenantRow(id: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM tenants WHERE id = ?', [id]);
  }

  /** Tambah/perbarui SATU user + kredensialnya (upsert per-baris, aman multi-instance). */
  async upsertAuthUser(id: string, data: unknown, passHash?: string | null): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO auth_users (id, data, pass_hash) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         data = VALUES(data),
         pass_hash = COALESCE(VALUES(pass_hash), pass_hash)`,
      [id, JSON.stringify(data), passHash ?? null]
    );
  }

  /** Muat SEMUA user & kredensial dari tabel auth khusus. */
  async loadAuthUsers(): Promise<Array<{ id: string; data: SafeUser; passHash: string | null }>> {
    if (!this.pool) return [];
    const [rows] = await this.pool.query('SELECT id, data, pass_hash FROM auth_users');
    return (rows as Array<{ id: string; data: any; pass_hash: string | null }>).map((r) => ({
      id: r.id,
      data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data,
      passHash: r.pass_hash ?? null,
    }));
  }

  /** Hapus satu user dari tabel auth khusus. */
  async deleteAuthUser(id: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM auth_users WHERE id = ?', [id]);
  }

  /** Muat seluruh state dari MySQL (null kalau masih kosong). */
  async loadAll(): Promise<LoadedState | null> {
    if (!this.pool) return null;
    const [rows] = await this.pool.query(
      'SELECT name, idx, data FROM collections ORDER BY name, idx ASC'
    );
    const hasil: LoadedState = {};
    let ada = false;
    const arrays: Record<string, unknown[]> = {};
    for (const row of rows as Array<{ name: string; idx: number; data: any }>) {
      ada = true;
      (arrays[row.name] ||= []).push(
        typeof row.data === 'string' ? JSON.parse(row.data) : row.data
      );
    }
    if (arrays.dashboards) hasil.dashboards = arrays.dashboards as Dashboard[];
    if (arrays.chats) hasil.chats = arrays.chats as Chat[];
    if (arrays.alertRules) hasil.alertRules = arrays.alertRules as AlertRule[];
    if (arrays.notifications) hasil.notifications = arrays.notifications as NotificationItem[];
    if (arrays.auditLogs) hasil.auditLogs = arrays.auditLogs as AuditLog[];
    if (arrays.users) hasil.users = arrays.users as SafeUser[];
    if (arrays.ketersediaanPreset) {
      hasil.ketersediaanPreset = arrays.ketersediaanPreset as KetersediaanPreset[];
    }

    // Tenant dibaca dari TABEL KHUSUS (bukan snapshot `collections`) supaya tahan
    // multi-instance. Kalau tabel khusus masih kosong (deployment lama), pakai
    // sisa baris `collections` sebagai migrasi awal.
    const tenantsKhusus = await this.loadTenants();
    if (tenantsKhusus.length > 0) hasil.tenants = tenantsKhusus;
    else if (arrays.tenants) hasil.tenants = arrays.tenants as Tenant[];

    // Dashboard & chat juga dari tabel khusus (alasan sama). Fallback ke snapshot
    // `collections` hanya untuk migrasi deployment lama.
    const dashKhusus = await this.loadDashboards();
    if (dashKhusus.length > 0) hasil.dashboards = dashKhusus;
    else if (arrays.dashboards) hasil.dashboards = arrays.dashboards as Dashboard[];

    const chatKhusus = await this.loadChats();
    if (chatKhusus.length > 0) hasil.chats = chatKhusus;
    else if (arrays.chats) hasil.chats = arrays.chats as Chat[];

    const [kvRows] = await this.pool.query('SELECT k, data FROM kv');
    for (const row of kvRows as Array<{ k: string; data: any }>) {
      ada = true;
      const val = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      if (row.k === 'shareTokens') hasil.shareTokens = val;
      if (row.k === 'sharePins') hasil.sharePins = val;
      if (row.k === 'systemConfig') hasil.systemConfig = val;
      if (row.k === 'credentials') hasil.credentials = val;
      if (row.k === 'deletedTenantIds') hasil.deletedTenantIds = val;
    }
    return ada ? hasil : null;
  }

  /** Simpan snapshot penuh dalam satu transaksi. */
  async saveAll(s: DbSnapshot): Promise<void> {
    // Retry singkat: dua instance backend bisa menulis bersamaan → MySQL
    // melempar 'Deadlock found'. Cukup ulang beberapa kali.
    for (let attempt = 1; ; attempt++) {
      try {
        await this.saveAllOnce(s);
        return;
      } catch (err: any) {
        const pesan = String(err?.message || err);
        const deadlock = err?.code === 'ER_LOCK_DEADLOCK' || /deadlock/i.test(pesan);
        if (deadlock && attempt < 4) {
          await new Promise((r) => setTimeout(r, 120 * attempt));
          continue;
        }
        throw err;
      }
    }
  }

  private async saveAllOnce(s: DbSnapshot): Promise<void> {
    if (!this.pool) return;
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM collections');
      await conn.query('DELETE FROM kv');

      const masukkan = async (name: string, items: Array<{ id: string; data: unknown }>) => {
        if (items.length === 0) return;
        const values = items.map((it, idx) => [name, idx, it.id, JSON.stringify(it.data)]);
        await conn.query(
          'INSERT INTO collections (name, idx, id, data) VALUES ?',
          [values]
        );
      };

      await masukkan(
        'alertRules',
        s.alertRules.map((a) => ({ id: a.id, data: a }))
      );
      await masukkan(
        'notifications',
        s.notifications.map((n) => ({ id: n.id, data: n }))
      );
      await masukkan(
        'auditLogs',
        s.auditLogs.map((a) => ({ id: a.id, data: a }))
      );
      await masukkan(
        'users',
        s.users.map((u) => ({ id: u.id, data: u }))
      );
      // CATATAN: tenant TIDAK ditulis ke snapshot `collections` — tenant dikelola
      // per-baris di tabel `tenants` (upsertTenant/deleteTenantRow). Kalau ikut
      // snapshot, tenant yang baru dihapus bisa "balik lagi" karena ditimpa
      // snapshot instance lain.
      await masukkan(
        'ketersediaanPreset',
        (s.ketersediaanPreset || []).map((k) => ({ id: k.id, data: k }))
      );

      const kv: Array<[string, string]> = [
        ['shareTokens', JSON.stringify(s.shareTokens)],
        ['sharePins', JSON.stringify(s.sharePins)],
        ['systemConfig', JSON.stringify(s.systemConfig)],
        ['credentials', JSON.stringify(s.credentials)],
        ['deletedTenantIds', JSON.stringify(s.deletedTenantIds || [])],
      ];
      await conn.query('INSERT INTO kv (k, data) VALUES ?', [kv]);

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async close(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }
}
