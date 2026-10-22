import { spawn } from 'child_process';
import { readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

/**
 * Cadangan harian otomatis.
 *
 * ponytail: tidak menambah penjadwal pihak ketiga — satu `setTimeout` yang
 * dihitung ulang setiap kali selesai sudah cukup untuk satu tugas harian.
 * Pekerjaan beratnya tetap dijalankan sebagai proses terpisah
 * (`scripts/backup-db.mjs`) supaya kegagalan cadangan tidak menyentuh server.
 *
 * Aktif bila `NODE_ENV=production` atau `BACKUP_OTOMATIS=1`.
 * Matikan dengan `BACKUP_OTOMATIS=0`.
 * Atur jam (0–23) lewat `BACKUP_JAM`, lama simpan (hari) lewat `BACKUP_SIMPAN_HARI`.
 */

const POLA = /^aionesboard-.*\.json\.gz(\.sha256)?$/;

/** Daftar berkas cadangan yang lebih tua dari `hari` hari (untuk dibersihkan). */
export function berkasKedaluwarsa(
  daftar: { nama: string; waktu: number }[],
  sekarang: number,
  hari: number
): string[] {
  const batas = sekarang - hari * 24 * 60 * 60 * 1000;
  return daftar.filter((b) => POLA.test(b.nama) && b.waktu < batas).map((b) => b.nama);
}

export interface StatusCadangan {
  terakhir: string | null;
  umurJam: number | null;
  terlambat: boolean;
}

/**
 * Ringkas keadaan cadangan untuk /health.
 *
 * `terlambat` dipakai pemantauan luar: cadangan harian yang tidak muncul lebih
 * dari `jamMaks` jam berarti penjadwal berhenti atau disk bermasalah — itu
 * kondisi yang harus diketahui sebelum ada insiden kehilangan data.
 */
export function statusCadangan(
  daftar: { nama: string; waktu: number }[],
  sekarang: number,
  jamMaks = 26
): StatusCadangan {
  const cadangan = daftar
    .filter((b) => /^aionesboard-.*\.json\.gz$/.test(b.nama))
    .sort((a, b) => b.waktu - a.waktu);
  if (cadangan.length === 0) return { terakhir: null, umurJam: null, terlambat: true };
  const umurJam = Math.round(((sekarang - cadangan[0].waktu) / (60 * 60 * 1000)) * 10) / 10;
  return { terakhir: cadangan[0].nama, umurJam, terlambat: umurJam > jamMaks };
}

export function bersihkanCadanganLama(dir: string, hari: number): number {
  let daftar: { nama: string; waktu: number }[] = [];
  try {
    daftar = readdirSync(dir).map((nama) => ({ nama, waktu: statSync(join(dir, nama)).mtimeMs }));
  } catch {
    return 0; // folder belum ada — belum pernah mencadangkan
  }
  const buang = berkasKedaluwarsa(daftar, Date.now(), hari);
  for (const nama of buang) {
    try {
      unlinkSync(join(dir, nama));
    } catch (err) {
      console.error('[AionesBoard Backup] Gagal menghapus cadangan lama:', nama, err);
    }
  }
  return buang.length;
}

function jalankanCadangan(): Promise<boolean> {
  return new Promise((resolve) => {
    const anak = spawn(process.execPath, ['scripts/backup-db.mjs'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let keluaran = '';
    anak.stdout.on('data', (d) => (keluaran += String(d)));
    anak.stderr.on('data', (d) => (keluaran += String(d)));
    anak.on('error', (err) => {
      console.error('[AionesBoard Backup] Gagal menjalankan cadangan:', err?.message || err);
      resolve(false);
    });
    anak.on('close', (kode) => {
      if (kode === 0) {
        const baris = keluaran.split('\n').find((b) => b.includes('berkas')) || '';
        console.log('[AionesBoard Backup] Cadangan harian selesai.', baris.trim());
        resolve(true);
      } else {
        console.error('[AionesBoard Backup] Cadangan harian gagal (kode', kode, '):', keluaran.trim());
        resolve(false);
      }
    });
  });
}

/** Mulai penjadwal harian. Mengembalikan fungsi untuk menghentikannya. */
export function mulaiBackupTerjadwal(): () => void {
  const mati = process.env.BACKUP_OTOMATIS === '0';
  const aktif = !mati && (process.env.BACKUP_OTOMATIS === '1' || process.env.NODE_ENV === 'production');
  if (!aktif) return () => {};

  const jam = Math.min(23, Math.max(0, parseInt(process.env.BACKUP_JAM || '2', 10) || 2));
  const simpanHari = Math.max(1, parseInt(process.env.BACKUP_SIMPAN_HARI || '14', 10) || 14);
  const dir = process.env.BACKUP_DIR || 'backups';
  let timer: NodeJS.Timeout | null = null;
  let berhenti = false;

  const jadwalkan = () => {
    if (berhenti) return;
    const sekarang = new Date();
    const berikut = new Date(sekarang);
    berikut.setHours(jam, 0, 0, 0);
    if (berikut.getTime() <= sekarang.getTime()) berikut.setDate(berikut.getDate() + 1);
    timer = setTimeout(async () => {
      await jalankanCadangan();
      const dibuang = bersihkanCadanganLama(dir, simpanHari);
      if (dibuang > 0) console.log(`[AionesBoard Backup] ${dibuang} berkas cadangan lama dihapus.`);
      jadwalkan();
    }, berikut.getTime() - sekarang.getTime());
    timer.unref?.();
  };

  console.log(
    `[AionesBoard Backup] Cadangan otomatis aktif — setiap hari pukul ${String(jam).padStart(2, '0')}:00, ` +
      `disimpan ${simpanHari} hari di ${dir}.`
  );
  jadwalkan();
  return () => {
    berhenti = true;
    if (timer) clearTimeout(timer);
  };
}
