import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { secretSesiAktif } from '../auth/session';

/**
 * Enkripsi nilai rahasia yang disimpan di database (kunci API RAG & KMS).
 *
 * ponytail: AES-256-GCM dari `crypto` bawaan — tanpa paket tambahan. Nilai
 * lama yang masih polos tetap terbaca (tanpa awalan `enc:v1:`), jadi tidak ada
 * migrasi yang harus dijalankan dan deployment lama tidak rusak.
 *
 * Kunci enkripsi: `DATA_ENCRYPTION_KEY` (disarankan) atau secret sesi yang
 * sedang aktif — env → database → berkas. TIDAK ada nilai cadangan yang
 * tertulis di kode: nilai tertulis di kode berarti siapa pun yang membaca repo
 * bisa membuka kunci API instansi.
 *
 * Kalau kuncinya berubah, nilai lama tidak bisa dibuka — admin perlu memasukkan
 * ulang kunci API di panel Konfigurasi. Itu disengaja: lebih baik minta isi
 * ulang daripada menyimpan rahasia dalam bentuk terbaca.
 */

const AWALAN = 'enc:v1:';

/**
 * Kunci cadangan dari versi lama (sebelum kunci enkripsi mengikuti secret sesi).
 * Hanya dipakai untuk MEMBUKA nilai lama, lalu nilainya dienkripsi ulang dengan
 * kunci sekarang — lihat `pakaiKunciLama`.
 */
const KUNCI_LAMA = 'aionesboard-kunci-lokal-jangan-dipakai-di-produksi';

function turunkan(dasar: string): Buffer {
  return createHash('sha256').update(dasar).digest();
}

function kunciEnkripsi(): Buffer {
  return turunkan(process.env.DATA_ENCRYPTION_KEY || secretSesiAktif());
}

/** true bila teks sudah dalam bentuk terenkripsi. */
export function terenkripsi(teks: unknown): boolean {
  return typeof teks === 'string' && teks.startsWith(AWALAN);
}

/** Enkripsi nilai rahasia. String kosong / sudah terenkripsi dikembalikan apa adanya. */
export function enkripsiNilai(teks: unknown): string {
  const nilai = typeof teks === 'string' ? teks : '';
  if (!nilai || terenkripsi(nilai)) return nilai;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', kunciEnkripsi(), iv);
  const isi = Buffer.concat([cipher.update(nilai, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${AWALAN}${iv.toString('base64url')}:${tag.toString('base64url')}:${isi.toString('base64url')}`;
}

/** Coba buka dengan satu kunci. `null` bila gagal (kunci salah / data rusak). */
function buka(teks: string, kunci: Buffer): string | null {
  const [ivB64, tagB64, isiB64] = teks.slice(AWALAN.length).split(':');
  if (!ivB64 || !tagB64 || !isiB64) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', kunci, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(isiB64, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Nilai ini hanya bisa dibuka dengan kunci lama?
 * Dipakai migrasi saat start: nilainya dienkripsi ulang agar host lain yang
 * memakai kunci sekarang tetap bisa membukanya.
 */
export function pakaiKunciLama(teks: unknown): boolean {
  if (!terenkripsi(teks)) return false;
  const nilai = teks as string;
  return buka(nilai, kunciEnkripsi()) === null && buka(nilai, turunkan(KUNCI_LAMA)) !== null;
}

/** Buka nilai rahasia. Nilai polos lama dikembalikan apa adanya. */
export function dekripsiNilai(teks: unknown): string {
  const nilai = typeof teks === 'string' ? teks : '';
  if (!nilai) return '';
  if (!terenkripsi(nilai)) return nilai;
  const sekarang = buka(nilai, kunciEnkripsi());
  if (sekarang !== null) return sekarang;
  const lama = buka(nilai, turunkan(KUNCI_LAMA));
  if (lama !== null) return lama;
  // Kunci enkripsi berubah / data rusak: jangan menebak, kosongkan dan catat.
  console.error('[AionesBoard] Gagal membuka nilai rahasia dari database — kunci enkripsi berubah?');
  return '';
}
