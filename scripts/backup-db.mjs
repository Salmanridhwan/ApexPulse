#!/usr/bin/env node
/**
 * Cadangan (backup) seluruh isi database ke satu berkas JSON ter-gzip.
 *
 * ponytail: tidak butuh `mysqldump` — cukup driver mysql2 yang sudah dipakai
 * aplikasi, jadi skrip ini jalan di Windows (Laragon) maupun server Linux.
 * Hasil: backups/aionesboard-<waktu>.json.gz + sidik jari SHA-256.
 *
 * Pemakaian:
 *   npm run backup              → simpan ke ./backups
 *   BACKUP_DIR=D:/cadangan npm run backup
 *
 * Pemulihan: lihat docs/operasional.md (scripts/restore-db.mjs).
 */
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { gzipSync } from 'zlib';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const cfg = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database:
    (process.env.MYSQL_DATABASE && process.env.MYSQL_DATABASE.trim()) ||
    (process.env.DB_NAME && process.env.DB_NAME.trim()) ||
    (process.env.DB_DATABASE && process.env.DB_DATABASE.trim()) ||
    'bumd_aionesboard',
};

const dir = resolve(process.env.BACKUP_DIR || 'backups');

async function main() {
  // dateStrings: kolom waktu dibaca sebagai 'YYYY-MM-DD HH:MM:SS' apa adanya,
  // sehingga berkas cadangan bisa dipulihkan langsung tanpa konversi tanggal.
  const conn = await mysql.createConnection({ ...cfg, multipleStatements: false, dateStrings: true });
  try {
    const [tabelRows] = await conn.query('SHOW TABLES');
    const tabel = tabelRows.map((r) => Object.values(r)[0]);
    if (tabel.length === 0) throw new Error('Database tidak punya tabel — periksa nama database.');

    const isi = {};
    let totalBaris = 0;
    for (const nama of tabel) {
      const [rows] = await conn.query(`SELECT * FROM \`${nama}\``);
      isi[nama] = rows;
      totalBaris += rows.length;
    }

    const waktu = new Date().toISOString().replace(/[:.]/g, '-');
    const berkas = join(dir, `aionesboard-${waktu}.json.gz`);
    mkdirSync(dir, { recursive: true });

    const mentah = JSON.stringify({ dibuat: new Date().toISOString(), database: cfg.database, tabel: isi });
    const gz = gzipSync(Buffer.from(mentah, 'utf8'), { level: 9 });
    writeFileSync(berkas, gz);

    const sha = createHash('sha256').update(gz).digest('hex');
    writeFileSync(`${berkas}.sha256`, `${sha}  ${berkas.split(/[\\/]/).pop()}\n`);

    console.log(`[backup] ${tabel.length} tabel, ${totalBaris} baris`);
    console.log(`[backup] berkas : ${berkas}`);
    console.log(`[backup] ukuran : ${(gz.length / 1024).toFixed(1)} KB`);
    console.log(`[backup] sha256 : ${sha}`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[backup] GAGAL:', err?.message || err);
  process.exit(1);
});
