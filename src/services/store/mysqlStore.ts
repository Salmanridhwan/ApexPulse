/**
 * Mirror persistence ApexPulse ke MySQL (Laragon).
 *
 * Pola: in-memory tetap sumber baca (cepat untuk demo), setiap mutasi
 * di-mirror ke MySQL dengan mengganti koleksi terkait dalam satu transaksi
 * (volume data demo kecil — replace penuh sederhana & selalu konsisten).
 * Saat boot, state dimuat dari MySQL; kalau kosong, seed aplikasi dipakai.
 * Urutan elemen dipertahankan lewat kolom `idx` (dashboard/audit perlu urutan).
 */
import mysql from 'mysql2/promise';
import { AlertRule, AuditLog, Dashboard, NotificationItem, Tenant } from '../../types';
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
  notifications: NotificationItem[];
  auditLogs: AuditLog[];
  shareTokens: Record<string, string>;
  systemConfig: unknown;
  users: SafeUser[];
  credentials: Record<string, string>;
  tenants: Tenant[];
}

export interface LoadedState {
  dashboards?: Dashboard[];
  notifications?: NotificationItem[];
  auditLogs?: AuditLog[];
  shareTokens?: Record<string, string>;
  systemConfig?: unknown;
  users?: SafeUser[];
  credentials?: Record<string, string>;
  tenants?: Tenant[];
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
      console.log('[ApexPulse DB] Tabel collections dimigrasikan ke PK komposit (name, idx)');
    }
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS kv (
        k VARCHAR(64) PRIMARY KEY,
        data JSON NOT NULL
      ) ENGINE=InnoDB
    `);
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
    if (arrays.notifications) hasil.notifications = arrays.notifications as NotificationItem[];
    if (arrays.auditLogs) hasil.auditLogs = arrays.auditLogs as AuditLog[];
    if (arrays.users) hasil.users = arrays.users as SafeUser[];
    if (arrays.tenants) hasil.tenants = arrays.tenants as Tenant[];

    const [kvRows] = await this.pool.query('SELECT k, data FROM kv');
    for (const row of kvRows as Array<{ k: string; data: any }>) {
      ada = true;
      const val = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      if (row.k === 'shareTokens') hasil.shareTokens = val;
      if (row.k === 'systemConfig') hasil.systemConfig = val;
      if (row.k === 'credentials') hasil.credentials = val;
    }
    return ada ? hasil : null;
  }

  /** Simpan snapshot penuh dalam satu transaksi. */
  async saveAll(s: DbSnapshot): Promise<void> {
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
        'dashboards',
        s.dashboards.map((d) => ({ id: d.id, data: d }))
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
      await masukkan(
        'tenants',
        s.tenants.map((t) => ({ id: t.id, data: t }))
      );

      const kv: Array<[string, string]> = [
        ['shareTokens', JSON.stringify(s.shareTokens)],
        ['systemConfig', JSON.stringify(s.systemConfig)],
        ['credentials', JSON.stringify(s.credentials)],
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
