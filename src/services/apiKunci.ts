/**
 * KUNCI API UNTUK PLATFORM MITRA.
 *
 * Platform mitra membuat dashboard tanpa login: ia memegang satu kunci, lalu
 * memanggil endpoint yang sama dengan aplikasi ini memakai header `X-API-Key`.
 * Kunci TIDAK memberi akses chat/RAG chat — itu memang domain aplikasi ini,
 * sedangkan chat milik platform memakai kunci model mereka sendiri.
 *
 * Bentuk kunci: `aio_` + 32 karakter base64url (acak 24 byte). Yang disimpan di
 * basis data hanya SHA-256-nya, jadi kunci asli tidak bisa dibaca ulang dari DB
 * maupun dari layar setelah dibuat sekali.
 */
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/** Izin yang bisa diberikan ke satu kunci. Chat sengaja tidak ada di sini. */
export type IzinKunci = 'dokumen' | 'dashboard';

export const SEMUA_IZIN: IzinKunci[] = ['dokumen', 'dashboard'];

export interface KunciApi {
  id: string;
  /** Label yang dibaca manusia, mis. "Platform CSR TPCC". */
  nama: string;
  /** Awalan yang aman ditampilkan (mis. `aio_9f3c1a2b`) untuk membedakan kunci. */
  awalan: string;
  /** SHA-256 hex dari kunci asli. */
  hash: string;
  tenantId: string;
  izin: IzinKunci[];
  dibuatPada: string;
  dibuatOleh: { userId: string; name: string };
  kedaluwarsaPada?: string;
  dicabutPada?: string;
  terakhirDipakai?: string;
  jumlahPermintaan: number;
}

/** Kunci yang dikembalikan ke klien tidak pernah memuat hash. */
export type KunciApiAman = Omit<KunciApi, 'hash'>;

export function kunciAman(k: KunciApi): KunciApiAman {
  const { hash: _hash, ...aman } = k;
  return aman;
}

/** Buat kunci baru. Kunci asli hanya hidup di sini — tidak disimpan di mana pun. */
export function buatKunciBaru(): { kunci: string; awalan: string; hash: string } {
  const kunci = `aio_${randomBytes(24).toString('base64url')}`;
  return { kunci, awalan: kunci.slice(0, 12), hash: hashKunci(kunci) };
}

export function hashKunci(kunci: string): string {
  return createHash('sha256').update(String(kunci), 'utf8').digest('hex');
}

/** Perbandingan waktu-tetap supaya hash tidak bisa ditebak lewat timing. */
export function kunciCocok(kunci: string, hash: string): boolean {
  const a = Buffer.from(hashKunci(kunci), 'hex');
  const b = Buffer.from(String(hash || ''), 'hex');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export function kunciAktif(k: KunciApi, sekarang: number = Date.now()): boolean {
  if (k.dicabutPada) return false;
  if (k.kedaluwarsaPada) {
    const t = Date.parse(k.kedaluwarsaPada);
    if (Number.isFinite(t) && t <= sekarang) return false;
  }
  return true;
}

/**
 * Peta jalur → izin.
 *
 * Daftar putih, bukan daftar hitam: jalur yang tidak dikenal ditolak. Dengan
 * begitu endpoint baru (termasuk chat) tidak otomatis terbuka untuk kunci API.
 */
/**
 * Jalur yang memakai model/AI aplikasi ini. Platform mitra memakainya dengan
 * kunci modelnya sendiri, jadi kunci API kita tidak membukanya.
 */
const JALUR_AI: RegExp[] = [
  /^\/api\/dashboards\/[^/]+\/chat$/,
  /^\/api\/dashboards\/[^/]+\/halaman\/[^/]+\/insight$/,
  /^\/api\/dashboards\/[^/]+\/widget-dari-saran$/,
  /^\/api\/dashboards\/rekomendasi$/,
  /^\/api\/dashboards\/dari-template$/,
];

export function cakupanJalur(jalur: string): IzinKunci | null {
  const p = String(jalur || '');
  if (!p.startsWith('/api/')) return null;
  // Yang tidak boleh sama sekali: sesi/akun, panel admin, chat & RAG chat.
  if (
    p.startsWith('/api/auth') ||
    p.startsWith('/api/admin') ||
    p.startsWith('/api/me') ||
    p.startsWith('/api/users') ||
    p.startsWith('/api/tenants') ||
    p.startsWith('/api/chat') ||
    p.startsWith('/api/chats') ||
    p.startsWith('/api/rag') ||
    p.startsWith('/api/permintaan')
  ) {
    return null;
  }
  // Fitur AI aplikasi ini (asisten/insight/rekomendasi) tetap milik aplikasi:
  // platform mitra memakai kunci modelnya sendiri, jadi jalur ini ditolak
  // walaupun berada di bawah awalan yang diizinkan.
  if (JALUR_AI.some((pola) => pola.test(p))) return null;
  if (p.startsWith('/api/berkas') || p.startsWith('/api/analisis') || p.startsWith('/api/butir-data')) {
    return 'dokumen';
  }
  if (
    p.startsWith('/api/dashboards') ||
    p.startsWith('/api/widgets') ||
    p.startsWith('/api/widget-catalog') ||
    p.startsWith('/api/chart')
  ) {
    return 'dashboard';
  }
  if (p.startsWith('/api/share')) return 'dashboard';
  return null;
}

/** true bila kunci punya izin untuk jalur ini. */
export function izinCukup(k: KunciApi, jalur: string): boolean {
  const butuh = cakupanJalur(jalur);
  if (!butuh) return false;
  return Array.isArray(k.izin) && k.izin.includes(butuh);
}

export function bersihkanIzin(nilai: unknown): IzinKunci[] {
  const daftar = Array.isArray(nilai) ? nilai : [];
  const hasil = SEMUA_IZIN.filter((i) => daftar.includes(i));
  return hasil;
}
