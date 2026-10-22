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
import { AlertRule, AlurVerifikasi, Aset, AuditLog, Chat, Dashboard, KetersediaanPreset, KewajibanLapor, LaporanPeriodik, LKjIP, NotificationItem, PerjanjianKinerja, Risiko, SnapshotKeuangan, Tenant, TemuanAudit } from '../../types';
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
  /**
   * ponytail: alertRules/notifications/auditLogs/shareTokens/sharePins/systemConfig/
   * users/credentials/deletedTenantIds TIDAK lagi ikut snapshot. Dulu snapshot
   * penuh (DELETE semua + insert state instance ini) menghapus notifikasi, aturan
   * alert, tautan bagikan, dan audit log yang dibuat instance lain. Sekarang
   * masing-masing ditulis per-baris (tabel `baris` / `audit_log` / `auth_users`).
   * Field di bawah ini hanya sisa tipe untuk membaca data deployment lama.
   */
  alertRules?: AlertRule[];
  notifications?: NotificationItem[];
  auditLogs?: AuditLog[];
  shareTokens?: Record<string, string>;
  /** token -> hash PIN (scrypt) untuk mode edit pada tautan publik. */
  sharePins?: Record<string, string>;
  systemConfig?: unknown;
  users?: SafeUser[];
  credentials?: Record<string, string>;
  tenants?: Tenant[];
  ketersediaanPreset: KetersediaanPreset[];
  /** id instansi yang sudah dihapus admin — agar user seed-nya tidak dibuat ulang. */
  deletedTenantIds?: string[];
  kewajibanLapor: KewajibanLapor[];
  laporanPeriodik: LaporanPeriodik[];
  alurVerifikasi: AlurVerifikasi[];
  temuanAudit: TemuanAudit[];
  snapshotKeuangan: SnapshotKeuangan[];
  risiko: Risiko[];
  aset: Aset[];
  perjanjianKinerja: PerjanjianKinerja[];
  lkjip: LKjIP[];
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

    /**
     * Tabel KEWAJIBAN LAPOR khusus, per-baris. Sama alasannya dengan `tenants`:
     * `saveAll` menulis snapshot penuh, jadi kewajiban lapor yang dibuat di satu
     * instance backend akan hilang/balik lagi bila ikut snapshot.
     */
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS kewajiban_lapor (
        id VARCHAR(128) PRIMARY KEY,
        tenant_id VARCHAR(128) NOT NULL,
        data JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_kewajiban_tenant (tenant_id)
      ) ENGINE=InnoDB
    `);

    /**
     * Tabel LAPORAN PERIODIK khusus, per-baris. Laporan yang dikirim/diverifikasi
     * di satu instance tidak boleh hilang karena ditimpa snapshot instance lain.
     */
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS laporan_periodik (
        id VARCHAR(128) PRIMARY KEY,
        tenant_id VARCHAR(128) NOT NULL,
        kewajiban_id VARCHAR(128) NOT NULL,
        data JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_laporan_tenant (tenant_id),
        INDEX idx_laporan_kewajiban (kewajiban_id)
      ) ENGINE=InnoDB
    `);

    /**
     * Tabel ALUR VERIFIKASI khusus, per-baris. Definisi alur persetujuan
     * milik instansi tidak boleh hilang karena ditimpa snapshot instance lain.
     */
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS alur_verifikasi (
        id VARCHAR(128) PRIMARY KEY,
        tenant_id VARCHAR(128) NOT NULL,
        data JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_alur_tenant (tenant_id)
      ) ENGINE=InnoDB
    `);

    /**
     * Tabel TEMUAN AUDIT khusus, per-baris. Temuan + tindak lanjutnya tidak
     * boleh hilang karena ditimpa snapshot instance backend lain.
     */
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS temuan_audit (
        id VARCHAR(128) PRIMARY KEY,
        tenant_id VARCHAR(128) NOT NULL,
        data JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_temuan_tenant (tenant_id)
      ) ENGINE=InnoDB
    `);

    /**
     * Tabel SNAPSHOT KESEHATAN KEUANGAN, per-baris. Angka neraca/laba-rugi dan
     * rasio turunannya tidak boleh hilang karena ditimpa snapshot instance lain.
     */
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS snapshot_keuangan (
        id VARCHAR(128) PRIMARY KEY,
        tenant_id VARCHAR(128) NOT NULL,
        periode VARCHAR(32) NOT NULL,
        data JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_keu_tenant (tenant_id),
        INDEX idx_keu_periode (tenant_id, periode)
      ) ENGINE=InnoDB
    `);

    /**
     * Tabel REGISTER RISIKO, per-baris. Risiko + jejak mitigasinya tidak boleh
     * hilang karena ditimpa snapshot instance backend lain.
     */
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS risiko (
        id VARCHAR(128) PRIMARY KEY,
        tenant_id VARCHAR(128) NOT NULL,
        data JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_risiko_tenant (tenant_id)
      ) ENGINE=InnoDB
    `);

    /**
     * Tabel DAFTAR ASET, per-baris. Nilai buku/penyusutan dihitung di aplikasi
     * dari field mentah; tabel ini hanya menyimpan entri aset apa adanya.
     */
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS aset (
        id VARCHAR(128) PRIMARY KEY,
        tenant_id VARCHAR(128) NOT NULL,
        data JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_aset_tenant (tenant_id)
      ) ENGINE=InnoDB
    `);

    /**
     * Tabel PERJANJIAN KINERJA, per-baris. Dokumen + indikatornya disimpan
     * sebagai JSON di kolom `data`.
     */
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS perjanjian_kinerja (
        id VARCHAR(128) PRIMARY KEY,
        tenant_id VARCHAR(128) NOT NULL,
        data JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pk_tenant (tenant_id)
      ) ENGINE=InnoDB
    `);

    /**
     * Tabel LKjIP, per-baris. Dokumen laporan + bagiannya disimpan sebagai JSON.
     */
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS lkjip (
        id VARCHAR(128) PRIMARY KEY,
        tenant_id VARCHAR(128) NOT NULL,
        data JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_lkjip_tenant (tenant_id)
      ) ENGINE=InnoDB
    `);

    /**
     * Tabel SERBA-GUNA per-baris untuk koleksi kecil yang dulu ikut snapshot:
     * alertRules, notifications, shareTokens, sharePins, systemConfig,
     * deletedTenantIds. `coll` = nama koleksi, `id` = kunci barisnya.
     *
     * Tanpa ini, `saveAll` (snapshot penuh) menghapus notifikasi/aturan/tautan
     * yang dibuat instance backend lain — sudah pernah terjadi di produksi.
     */
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS baris (
        coll VARCHAR(32) NOT NULL,
        id VARCHAR(160) NOT NULL,
        data JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (coll, id)
      ) ENGINE=InnoDB
    `);

    /**
     * Tabel AUDIT LOG, append-only. Dulu audit log ikut snapshot dan dipotong
     * `slice(0, 500)` → jejak audit hilang. Sekarang satu entri = satu baris,
     * tidak pernah ditimpa instance lain; pemangkasan hanya lewat `trimAuditLogs`
     * dengan batas atas yang jauh lebih besar (default 20.000 entri).
     */
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id VARCHAR(128) PRIMARY KEY,
        tenant_id VARCHAR(128) NOT NULL,
        waktu BIGINT NOT NULL,
        data JSON NOT NULL,
        INDEX idx_audit_waktu (waktu)
      ) ENGINE=InnoDB
    `);
  }

  /** Tambah/perbarui SATU kewajiban lapor (upsert per-baris). */
  async upsertKewajiban(id: string, tenantId: string, data: unknown): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO kewajiban_lapor (id, tenant_id, data) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id), data = VALUES(data)`,
      [id, tenantId, JSON.stringify(data)]
    );
  }

  async loadKewajiban(): Promise<KewajibanLapor[]> {
    if (!this.pool) return [];
    const [rows] = await this.pool.query('SELECT data FROM kewajiban_lapor');
    return (rows as Array<{ data: any }>).map((r) =>
      typeof r.data === 'string' ? JSON.parse(r.data) : r.data
    );
  }

  async deleteKewajibanRow(id: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM kewajiban_lapor WHERE id = ?', [id]);
  }

  /** Tambah/perbarui SATU laporan periodik (upsert per-baris). */
  async upsertLaporan(id: string, tenantId: string, kewajibanId: string, data: unknown): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO laporan_periodik (id, tenant_id, kewajiban_id, data) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id), kewajiban_id = VALUES(kewajiban_id), data = VALUES(data)`,
      [id, tenantId, kewajibanId, JSON.stringify(data)]
    );
  }

  async loadLaporan(): Promise<LaporanPeriodik[]> {
    if (!this.pool) return [];
    const [rows] = await this.pool.query('SELECT data FROM laporan_periodik');
    return (rows as Array<{ data: any }>).map((r) =>
      typeof r.data === 'string' ? JSON.parse(r.data) : r.data
    );
  }

  async deleteLaporanRow(id: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM laporan_periodik WHERE id = ?', [id]);
  }

  /** Hapus semua laporan milik satu kewajiban (dipakai saat kewajiban dihapus). */
  async deleteLaporanByKewajiban(kewajibanId: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM laporan_periodik WHERE kewajiban_id = ?', [kewajibanId]);
  }

  /** Tambah/perbarui SATU alur verifikasi (upsert per-baris). */
  async upsertAlurVerifikasi(id: string, tenantId: string, data: unknown): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO alur_verifikasi (id, tenant_id, data) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id), data = VALUES(data)`,
      [id, tenantId, JSON.stringify(data)]
    );
  }

  async loadAlurVerifikasi(): Promise<AlurVerifikasi[]> {
    if (!this.pool) return [];
    const [rows] = await this.pool.query('SELECT data FROM alur_verifikasi');
    return (rows as Array<{ data: any }>).map((r) =>
      typeof r.data === 'string' ? JSON.parse(r.data) : r.data
    );
  }

  async deleteAlurVerifikasiRow(id: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM alur_verifikasi WHERE id = ?', [id]);
  }

  /** Tambah/perbarui SATU temuan audit (upsert per-baris). */
  async upsertTemuanAudit(id: string, tenantId: string, data: unknown): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO temuan_audit (id, tenant_id, data) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id), data = VALUES(data)`,
      [id, tenantId, JSON.stringify(data)]
    );
  }

  async loadTemuanAudit(): Promise<TemuanAudit[]> {
    if (!this.pool) return [];
    const [rows] = await this.pool.query('SELECT data FROM temuan_audit');
    return (rows as Array<{ data: any }>).map((r) =>
      typeof r.data === 'string' ? JSON.parse(r.data) : r.data
    );
  }

  async deleteTemuanAuditRow(id: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM temuan_audit WHERE id = ?', [id]);
  }

  /** Tambah/perbarui SATU risiko (upsert per-baris). */
  async upsertRisiko(id: string, tenantId: string, data: unknown): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO risiko (id, tenant_id, data) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id), data = VALUES(data)`,
      [id, tenantId, JSON.stringify(data)]
    );
  }

  async loadRisiko(): Promise<Risiko[]> {
    if (!this.pool) return [];
    const [rows] = await this.pool.query('SELECT data FROM risiko');
    return (rows as Array<{ data: any }>).map((r) =>
      typeof r.data === 'string' ? JSON.parse(r.data) : r.data
    );
  }

  async deleteRisikoRow(id: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM risiko WHERE id = ?', [id]);
  }

  /** Tambah/perbarui SATU aset (upsert per-baris). */
  async upsertAset(id: string, tenantId: string, data: unknown): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO aset (id, tenant_id, data) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id), data = VALUES(data)`,
      [id, tenantId, JSON.stringify(data)]
    );
  }

  async loadAset(): Promise<Aset[]> {
    if (!this.pool) return [];
    const [rows] = await this.pool.query('SELECT data FROM aset');
    return (rows as Array<{ data: any }>).map((r) =>
      typeof r.data === 'string' ? JSON.parse(r.data) : r.data
    );
  }

  async deleteAsetRow(id: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM aset WHERE id = ?', [id]);
  }

  /** Tambah/perbarui SATU Perjanjian Kinerja (upsert per-baris). */
  async upsertPerjanjianKinerja(id: string, tenantId: string, data: unknown): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO perjanjian_kinerja (id, tenant_id, data) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id), data = VALUES(data)`,
      [id, tenantId, JSON.stringify(data)]
    );
  }

  async loadPerjanjianKinerja(): Promise<PerjanjianKinerja[]> {
    if (!this.pool) return [];
    const [rows] = await this.pool.query('SELECT data FROM perjanjian_kinerja');
    return (rows as Array<{ data: any }>).map((r) =>
      typeof r.data === 'string' ? JSON.parse(r.data) : r.data
    );
  }

  async deletePerjanjianKinerjaRow(id: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM perjanjian_kinerja WHERE id = ?', [id]);
  }

  /** Tambah/perbarui SATU LKjIP (upsert per-baris). */
  async upsertLKjIP(id: string, tenantId: string, data: unknown): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO lkjip (id, tenant_id, data) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id), data = VALUES(data)`,
      [id, tenantId, JSON.stringify(data)]
    );
  }

  async loadLKjIP(): Promise<LKjIP[]> {
    if (!this.pool) return [];
    const [rows] = await this.pool.query('SELECT data FROM lkjip');
    return (rows as Array<{ data: any }>).map((r) =>
      typeof r.data === 'string' ? JSON.parse(r.data) : r.data
    );
  }

  async deleteLKjIPRow(id: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM lkjip WHERE id = ?', [id]);
  }

  // ===== Koleksi kecil per-baris (tabel `baris`) =====

  /** Tulis satu baris koleksi kecil (alertRules, notifications, share*, systemConfig). */
  async upsertBaris(coll: string, id: string, data: unknown): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO baris (coll, id, data) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data)`,
      [coll, id, JSON.stringify(data)]
    );
  }

  async deleteBaris(coll: string, id: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM baris WHERE coll = ? AND id = ?', [coll, id]);
  }

  async loadBaris(coll: string): Promise<unknown[]> {
    if (!this.pool) return [];
    const [rows] = await this.pool.query('SELECT data FROM baris WHERE coll = ?', [coll]);
    return (rows as Array<{ data: any }>).map((r) =>
      typeof r.data === 'string' ? JSON.parse(r.data) : r.data
    );
  }

  // ===== Audit log (append-only) =====

  async upsertAuditLog(log: AuditLog): Promise<void> {
    if (!this.pool) return;
    const waktu = Date.parse(log.timestamp) || Date.now();
    await this.pool.query(
      `INSERT INTO audit_log (id, tenant_id, waktu, data) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data)`,
      [log.id, log.tenantId || '', waktu, JSON.stringify(log)]
    );
  }

  /** Audit log terbaru dulu. `batas` mencegah memori membengkak saat boot. */
  async loadAuditLogs(batas = 5000): Promise<AuditLog[]> {
    if (!this.pool) return [];
    const [rows] = await this.pool.query(
      'SELECT data FROM audit_log ORDER BY waktu DESC LIMIT ?',
      [batas]
    );
    return (rows as Array<{ data: any }>).map((r) =>
      typeof r.data === 'string' ? JSON.parse(r.data) : r.data
    );
  }

  /** Pangkas audit log paling lama di atas `simpan` entri (batas atas, bukan 500). */
  async trimAuditLogs(simpan = 20000): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `DELETE FROM audit_log WHERE id NOT IN (
         SELECT id FROM (SELECT id FROM audit_log ORDER BY waktu DESC LIMIT ?) t
       )`,
      [simpan]
    );
  }


  /** Tambah/perbarui SATU snapshot kesehatan keuangan (upsert per-baris). */
  async upsertSnapshotKeuangan(id: string, tenantId: string, data: unknown): Promise<void> {
    if (!this.pool) return;
    const periode = String((data as any)?.periode || '');
    await this.pool.query(
      `INSERT INTO snapshot_keuangan (id, tenant_id, periode, data) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id), periode = VALUES(periode), data = VALUES(data)`,
      [id, tenantId, periode, JSON.stringify(data)]
    );
  }

  async loadSnapshotKeuangan(): Promise<SnapshotKeuangan[]> {
    if (!this.pool) return [];
    const [rows] = await this.pool.query('SELECT data FROM snapshot_keuangan');
    return (rows as Array<{ data: any }>).map((r) =>
      typeof r.data === 'string' ? JSON.parse(r.data) : r.data
    );
  }

  async deleteSnapshotKeuanganRow(id: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM snapshot_keuangan WHERE id = ?', [id]);
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

    // Pelaporan periodik juga dari tabel khusus (alasan sama: tahan multi-instance).
    const kewajibanKhusus = await this.loadKewajiban();
    if (kewajibanKhusus.length > 0) hasil.kewajibanLapor = kewajibanKhusus;
    else if (arrays.kewajibanLapor) hasil.kewajibanLapor = arrays.kewajibanLapor as KewajibanLapor[];

    const laporanKhusus = await this.loadLaporan();
    if (laporanKhusus.length > 0) hasil.laporanPeriodik = laporanKhusus;
    else if (arrays.laporanPeriodik) hasil.laporanPeriodik = arrays.laporanPeriodik as LaporanPeriodik[];
    const alurKhusus = await this.loadAlurVerifikasi();
    if (alurKhusus.length > 0) hasil.alurVerifikasi = alurKhusus;
    else if (arrays.alurVerifikasi) hasil.alurVerifikasi = arrays.alurVerifikasi as AlurVerifikasi[];

    const temuanKhusus = await this.loadTemuanAudit();
    if (temuanKhusus.length > 0) hasil.temuanAudit = temuanKhusus;
    else if (arrays.temuanAudit) hasil.temuanAudit = arrays.temuanAudit as TemuanAudit[];

    const keuKhusus = await this.loadSnapshotKeuangan();
    if (keuKhusus.length > 0) hasil.snapshotKeuangan = keuKhusus;
    else if (arrays.snapshotKeuangan) hasil.snapshotKeuangan = arrays.snapshotKeuangan as SnapshotKeuangan[];

    const risikoKhusus = await this.loadRisiko();
    if (risikoKhusus.length > 0) hasil.risiko = risikoKhusus;
    else if (arrays.risiko) hasil.risiko = arrays.risiko as Risiko[];

    const asetKhusus = await this.loadAset();
    if (asetKhusus.length > 0) hasil.aset = asetKhusus;
    else if (arrays.aset) hasil.aset = arrays.aset as Aset[];

    const pkKhusus = await this.loadPerjanjianKinerja();
    if (pkKhusus.length > 0) hasil.perjanjianKinerja = pkKhusus;
    else if (arrays.perjanjianKinerja) hasil.perjanjianKinerja = arrays.perjanjianKinerja as PerjanjianKinerja[];

    const lkKhusus = await this.loadLKjIP();
    if (lkKhusus.length > 0) hasil.lkjip = lkKhusus;
    else if (arrays.lkjip) hasil.lkjip = arrays.lkjip as LKjIP[];

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

    // Koleksi kecil: tabel `baris` menang atas sisa snapshot/kv (migrasi deployment
    // lama). Tanpa ini notifikasi/aturan/tautan yang dibuat instance lain hilang.
    const aturanBaris = await this.loadBaris('alertRules');
    if (aturanBaris.length > 0) hasil.alertRules = aturanBaris as AlertRule[];
    const notifBaris = await this.loadBaris('notifications');
    if (notifBaris.length > 0) hasil.notifications = notifBaris as NotificationItem[];
    const tautanBaris = await this.loadBaris('shareTokens');
    if (tautanBaris.length > 0) {
      hasil.shareTokens = Object.fromEntries(
        (tautanBaris as Array<{ token: string }>).map((t) => [t.token, t as any])
      );
    }
    const pinBaris = await this.loadBaris('sharePins');
    if (pinBaris.length > 0) {
      hasil.sharePins = Object.fromEntries(
        (pinBaris as Array<{ token: string; pin: string }>).map((t) => [t.token, t.pin])
      );
    }
    const konfigBaris = await this.loadBaris('systemConfig');
    if (konfigBaris.length > 0) hasil.systemConfig = konfigBaris[0];
    const hapusBaris = await this.loadBaris('deletedTenantIds');
    if (hapusBaris.length > 0) hasil.deletedTenantIds = hapusBaris as string[];

    // Audit log dari tabel khusus (append-only). Fallback ke snapshot lama hanya
    // kalau tabelnya masih kosong.
    const auditKhusus = await this.loadAuditLogs();
    if (auditKhusus.length > 0) hasil.auditLogs = auditKhusus;

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

      // Koleksi kecil (alertRules, notifications, auditLogs, shareTokens,
      // sharePins, systemConfig, users, deletedTenantIds) TIDAK lagi ditulis di
      // sini: masing-masing punya tabel per-baris sendiri. Snapshot penuh di sini
      // dulu menghapus data instance lain.
      await masukkan(
        'ketersediaanPreset',
        (s.ketersediaanPreset || []).map((k) => ({ id: k.id, data: k }))
      );

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
