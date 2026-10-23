/**
 * Unggah cadangan terbaru ke penyimpanan objek (S3-compatible) secara manual.
 *
 * Dipakai bila cadangan dibuat di luar penjadwal server (mis. `npm run backup`
 * dari cron), atau untuk menguji kredensial S3 tanpa menunggu pukul 02:00:
 *
 *   npm run backup:unggah
 *   npm run backup:unggah -- backups/aionesboard-2026-10-23T02-00-00.json.gz
 *
 * Konfigurasi: S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION,
 * S3_ENDPOINT (opsional), S3_PREFIX, S3_FORCE_PATH_STYLE.
 */

import { existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import 'dotenv/config';
import { konfigS3DariEnv, unggahCadanganDariDisk } from '../src/services/ops/s3';

const dir = process.env.BACKUP_DIR || 'backups';

function cadanganTerbaru(folder: string): string | null {
  try {
    const daftar = readdirSync(folder)
      .filter((n) => /^aionesboard-.*\.json\.gz$/.test(n))
      .map((nama) => ({ nama, waktu: statSync(join(folder, nama)).mtimeMs }))
      .sort((a, b) => b.waktu - a.waktu);
    return daftar.length > 0 ? join(folder, daftar[0].nama) : null;
  } catch {
    return null;
  }
}

async function utama() {
  const cfg = konfigS3DariEnv();
  if (!cfg) {
    console.error(
      'Penyimpanan objek belum dikonfigurasi. Isi S3_BUCKET, S3_ACCESS_KEY_ID, dan\n' +
        'S3_SECRET_ACCESS_KEY di .env (lihat docs/operasional.md bagian 5).'
    );
    process.exit(2);
  }

  const argumen = process.argv[2];
  const berkas = argumen ? resolve(argumen) : cadanganTerbaru(dir);
  if (!berkas || !existsSync(berkas)) {
    console.error(`Tidak ada berkas cadangan untuk diunggah (dicari di ${resolve(dir)}).`);
    process.exit(2);
  }

  console.log(`Mengunggah ${berkas} → s3://${cfg.bucket}/${cfg.prefix}`);
  const hasil = await unggahCadanganDariDisk(cfg, berkas);
  if (!hasil.ok) {
    console.error('Gagal mengunggah:', hasil.galat);
    process.exit(1);
  }
  console.log('Selesai. Objek:', hasil.kunci);
}

void utama();
