import { spawn } from 'child_process';
import { readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { antreEmail } from '../mailer';
import { konfigS3DariEnv, unggahCadanganDariDisk } from './s3';

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
  jamMaks = 26,
  uptimeJam = 0
): StatusCadangan {
  const cadangan = daftar
    .filter((b) => /^aionesboard-.*\.json\.gz$/.test(b.nama))
    .sort((a, b) => b.waktu - a.waktu);
  if (cadangan.length === 0) {
    // Instalasi baru belum punya cadangan — bukan tanda kegagalan. Baru
    // dianggap terlambat kalau server sudah hidup lebih lama dari `jamMaks`
    // tanpa satu pun cadangan muncul.
    return { terakhir: null, umurJam: null, terlambat: uptimeJam > jamMaks };
  }
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

/**
 * Isi email peringatan saat cadangan gagal.
 *
 * ponytail: cadangan yang diam-diam gagal sama saja dengan tidak punya cadangan.
 * Email dikirim lewat antrean mailer yang sudah ada (`SMTP_HOST` +
 * `ALERT_EMAIL_TO`); kalau SMTP belum diisi, mailer mencatatnya di log dan
 * server tetap jalan.
 */
export function pesanCadanganGagal(keluaran: string, waktu: Date) {
  const potong = (keluaran || '').trim().slice(-1200);
  const kapan = waktu.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  return {
    subject: '[Aiones Boards] Cadangan harian GAGAL',
    text:
      `Cadangan database otomatis gagal pada ${kapan}.\n\n` +
      `Periksa ruang disk, kredensial MySQL, dan izin folder cadangan.\n` +
      `Selama cadangan gagal, tidak ada titik pulih baru.\n\n` +
      `Keluaran terakhir:\n${potong || '(kosong)'}`,
    html:
      `<p>Cadangan database otomatis <b>gagal</b> pada ${kapan}.</p>` +
      `<p>Periksa ruang disk, kredensial MySQL, dan izin folder cadangan. ` +
      `Selama cadangan gagal, tidak ada titik pulih baru.</p>` +
      `<pre style="white-space:pre-wrap;font-size:12px">${(potong || '(kosong)')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</pre>`,
  };
}

/**
 * Keadaan unggahan off-site terakhir — ditampilkan di `/health` supaya operator
 * tahu salinan luar benar-benar jalan, bukan hanya dikonfigurasi.
 */
export interface StatusOffsite {
  aktif: boolean;
  terakhir: string | null;
  waktu: string | null;
  ok: boolean | null;
  galat?: string;
}

let statusOffsite: StatusOffsite = { aktif: false, terakhir: null, waktu: null, ok: null };

export function statusUnggahanOffsite(): StatusOffsite {
  return { ...statusOffsite, aktif: konfigS3DariEnv() !== null };
}

/** Isi email peringatan saat salinan off-site gagal. */
export function pesanCadanganOffsiteGagal(galat: string, namaBerkas: string, waktu: Date) {
  const kapan = waktu.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const aman = (galat || '').slice(0, 800);
  return {
    subject: '[Aiones Boards] Salinan cadangan off-site GAGAL',
    text:
      `Unggahan cadangan ${namaBerkas} ke penyimpanan objek gagal pada ${kapan}.\n\n` +
      `Cadangan LOKAL tetap ada di server, tetapi belum ada salinan di luar server — ` +
      `selama ini berlangsung, kehilangan disk/server berarti kehilangan titik pulih.\n\n` +
      `Periksa S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT, dan izin tulis bucket.\n\n` +
      `Galat: ${aman || '(kosong)'}`,
    html:
      `<p>Unggahan cadangan <code>${namaBerkas}</code> ke penyimpanan objek <b>gagal</b> pada ${kapan}.</p>` +
      `<p>Cadangan lokal tetap ada, tetapi belum ada salinan di luar server.</p>` +
      `<pre style="white-space:pre-wrap;font-size:12px">${aman
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</pre>`,
  };
}

/** Berkas cadangan terbaru di folder (null bila belum ada). */
export function cadanganTerbaru(dir: string): string | null {
  try {
    const daftar = readdirSync(dir)
      .filter((n) => /^aionesboard-.*\.json\.gz$/.test(n))
      .map((nama) => ({ nama, waktu: statSync(join(dir, nama)).mtimeMs }))
      .sort((a, b) => b.waktu - a.waktu);
    return daftar.length > 0 ? join(dir, daftar[0].nama) : null;
  } catch {
    return null;
  }
}

/**
 * Unggah cadangan terbaru ke penyimpanan objek. Tidak melempar galat: kegagalan
 * dilaporkan lewat log + email, karena cadangan lokal tetap sah.
 */
export async function unggahCadanganOffsite(dir: string): Promise<StatusOffsite> {
  const cfg = konfigS3DariEnv();
  if (!cfg) {
    statusOffsite = {
      aktif: false,
      terakhir: statusOffsite.terakhir,
      waktu: statusOffsite.waktu,
      ok: statusOffsite.ok,
    };
    return statusUnggahanOffsite();
  }
  const berkas = cadanganTerbaru(dir);
  if (!berkas) {
    console.warn('[AionesBoard Backup] Tidak ada berkas cadangan untuk diunggah ke penyimpanan objek.');
    return statusUnggahanOffsite();
  }
  const hasil = await unggahCadanganDariDisk(cfg, berkas);
  const nama = berkas.replace(/\\/g, '/').split('/').pop() || berkas;
  const waktu = new Date().toISOString();
  if (hasil.ok) {
    console.log(`[AionesBoard Backup] Cadangan disalin ke penyimpanan objek: ${hasil.kunci}`);
    statusOffsite = { aktif: true, terakhir: hasil.kunci, waktu, ok: true };
  } else {
    console.error('[AionesBoard Backup] Unggah off-site gagal:', hasil.galat);
    antreEmail(pesanCadanganOffsiteGagal(String(hasil.galat || ''), nama, new Date()));
    statusOffsite = { aktif: true, terakhir: statusOffsite.terakhir, waktu, ok: false, galat: hasil.galat };
  }
  return statusUnggahanOffsite();
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
      antreEmail(pesanCadanganGagal(String(err?.message || err), new Date()));
      resolve(false);
    });
    anak.on('close', (kode) => {
      if (kode === 0) {
        const baris = keluaran.split('\n').find((b) => b.includes('berkas')) || '';
        console.log('[AionesBoard Backup] Cadangan harian selesai.', baris.trim());
        // Salinan di luar server: tanpa ini, disk/server rusak = semua titik pulih hilang.
        void unggahCadanganOffsite(process.env.BACKUP_DIR || 'backups');
        resolve(true);
      } else {
        console.error('[AionesBoard Backup] Cadangan harian gagal (kode', kode, '):', keluaran.trim());
        antreEmail(pesanCadanganGagal(keluaran, new Date()));
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

  // ponytail: rilis baru langsung punya titik pulih tanpa menunggu pukul 02:00 —
  // kalau folder masih kosong, cadangan pertama dibuat beberapa menit setelah start.
  const adaCadangan = () => {
    try {
      return readdirSync(dir).some((n) => /^aionesboard-.*\.json\.gz$/.test(n));
    } catch {
      return false;
    }
  };
  const menitAwal = Math.max(1, parseInt(process.env.BACKUP_AWAL_MENIT || '5', 10) || 5);
  const cadanganAwal = setTimeout(async () => {
    if (berhenti || adaCadangan()) return;
    console.log('[AionesBoard Backup] Belum ada cadangan — membuat cadangan pertama.');
    await jalankanCadangan();
    bersihkanCadanganLama(dir, simpanHari);
  }, menitAwal * 60 * 1000);
  cadanganAwal.unref?.();

  return () => {
    berhenti = true;
    if (timer) clearTimeout(timer);
    clearTimeout(cadanganAwal);
  };
}
