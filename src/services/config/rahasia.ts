import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Enkripsi nilai rahasia yang disimpan di database (kunci API RAG & KMS).
 *
 * ponytail: AES-256-GCM dari `crypto` bawaan — tanpa paket tambahan. Nilai
 * lama yang masih polos tetap terbaca (tanpa awalan `enc:v1:`), jadi tidak ada
 * migrasi yang harus dijalankan dan deployment lama tidak rusak.
 *
 * Kunci enkripsi: `DATA_ENCRYPTION_KEY` (disarankan) atau `SESSION_SECRET`.
 * Kalau keduanya berubah, nilai lama tidak bisa dibuka — admin perlu memasukkan
 * ulang kunci API di panel Konfigurasi. Itu disengaja: lebih baik minta isi
 * ulang daripada menyimpan rahasia dalam bentuk terbaca.
 */

const AWALAN = 'enc:v1:';

function kunciEnkripsi(): Buffer {
  const dasar =
    process.env.DATA_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    'aionesboard-kunci-lokal-jangan-dipakai-di-produksi';
  return createHash('sha256').update(dasar).digest();
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

/** Buka nilai rahasia. Nilai polos lama dikembalikan apa adanya. */
export function dekripsiNilai(teks: unknown): string {
  const nilai = typeof teks === 'string' ? teks : '';
  if (!nilai) return '';
  if (!terenkripsi(nilai)) return nilai;
  const [ivB64, tagB64, isiB64] = nilai.slice(AWALAN.length).split(':');
  if (!ivB64 || !tagB64 || !isiB64) return '';
  try {
    const decipher = createDecipheriv('aes-256-gcm', kunciEnkripsi(), Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(isiB64, 'base64url')), decipher.final()]).toString('utf8');
  } catch (err) {
    // Kunci enkripsi berubah / data rusak: jangan menebak, kosongkan dan catat.
    console.error('[AionesBoard] Gagal membuka nilai rahasia dari database:', err);
    return '';
  }
}
