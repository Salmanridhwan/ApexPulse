#!/usr/bin/env node
/**
 * Pemulihan (restore) dari berkas cadangan JSON ter-gzip hasil `npm run backup`.
 *
 * PENTING: skrip ini MENGHAPUS isi tabel yang ada lalu mengisinya ulang dari
 * cadangan. Jalankan hanya saat benar-benar memulihkan, dan hentikan server
 * lebih dulu supaya tidak ada tulisan baru yang tertimpa.
 *
 * Pemakaian:
 *   node scripts/restore-db.mjs backups/aionesboard-2026-01-31T02-00-00-000Z.json.gz
 *   node scripts/restore-db.mjs <berkas> --dry-run     → hanya memeriksa isi berkas
 */
import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const berkas = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!berkas) {
  console.error('Pakai: node scripts/restore-db.mjs <berkas.json.gz> [--dry-run]');
  process.exit(1);
}

const cfg = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database:
    (process.env.MYSQL_DATABASE && process.env.MYSQL_DATABASE.trim()) ||
    (process.env.DB_NAME && process.env.DB_NAME.trim()) ||
    'bumd_aionesboard',
};

/** Susun INSERT multi-baris agar pemulihan tidak mengirim satu query per baris. */
function potong(arr, n) {
  const hasil = [];
  for (let i = 0; i < arr.length; i += n) hasil.push(arr.slice(i, i + n));
  return hasil;
}

async function main() {
  const isi = JSON.parse(gunzipSync(readFileSync(berkas)).toString('utf8'));
  const tabel = Object.keys(isi.tabel || {});
  const total = tabel.reduce((n, t) => n + isi.tabel[t].length, 0);
  console.log(`[restore] cadangan dibuat : ${isi.dibuat}`);
  console.log(`[restore] tabel           : ${tabel.length}, baris: ${total}`);
  if (dryRun) {
    for (const t of tabel) console.log(`  - ${t}: ${isi.tabel[t].length} baris`);
    console.log('[restore] --dry-run: tidak ada yang ditulis.');
    return;
  }

  const conn = await mysql.createConnection(cfg);
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of tabel) {
      const rows = isi.tabel[t];
      await conn.query(`DELETE FROM \`${t}\``);
      if (rows.length === 0) continue;
      const kolom = Object.keys(rows[0]);
      const daftarKolom = kolom.map((k) => `\`${k}\``).join(', ');
      for (const bagian of potong(rows, 200)) {
        // Kolom JSON terbaca sebagai objek; driver akan salah mengubahnya kalau
        // dikirim apa adanya — ubah dulu ke teks JSON.
        const nilai = bagian.map((r) =>
          kolom.map((k) => {
            const v = r[k];
            if (v === null || v === undefined) return null;
            if (typeof v === 'object' && !Buffer.isBuffer(v) && !(v instanceof Date)) {
              return JSON.stringify(v);
            }
            return v;
          })
        );
        await conn.query(`INSERT INTO \`${t}\` (${daftarKolom}) VALUES ?`, [nilai]);
      }
      console.log(`[restore] ${t}: ${rows.length} baris`);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('[restore] selesai. Nyalakan ulang server.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[restore] GAGAL:', err?.message || err);
  process.exit(1);
});
