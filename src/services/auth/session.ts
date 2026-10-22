import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Autentikasi AionesBoard — memakai crypto bawaan Node (scrypt + HMAC),
 * tanpa dependensi eksternal. Token sesi dikirim via cookie HttpOnly.
 */

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

/**
 * Secret sesi.
 *
 * ponytail: di produksi TIDAK BOLEH ada nilai cadangan yang tertulis di kode —
 * siapa pun yang membaca repo bisa memalsukan token admin. Produksi juga
 * berjalan di lebih dari satu instance: secret acak per-proses membuat cookie
 * dari instance A ditolak instance B (pengguna terlempar-login acak). Karena
 * itu produksi WAJIB mengisi `SESSION_SECRET`; kalau kosong server menolak
 * start dengan pesan yang jelas, bukan diam-diam memakai secret lemah.
 */
function secretSesi(): string {
  const dariEnv = (process.env.SESSION_SECRET || '').trim();
  if (dariEnv.length >= 32) return dariEnv;
  if (process.env.NODE_ENV !== 'production') {
    // Lingkungan pengembangan: boleh memakai nilai tetap agar sesi tidak
    // putus setiap restart.
    return dariEnv || 'aionesboard-dev-secret-ganti-di-produksi';
  }
  throw new Error(
    'SESSION_SECRET wajib diisi (minimal 32 karakter acak) saat NODE_ENV=production. ' +
      'Contoh membuat nilai: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))". ' +
      'Pakai nilai yang SAMA di semua instance, lalu restart server.'
  );
}

const SESSION_SECRET = secretSesi();

export interface SessionPayload {
  userId: string;
  role: string;
  tenantId: string;
  name: string;
  /**
   * Akun masih memakai kata sandi sementara/bawaan → wajib ganti dulu.
   * Dibawa di token supaya pemeriksaannya tidak perlu query DB tiap request;
   * setelah ganti sandi, token ditandatangani ulang tanpa flag ini.
   */
  mustChange?: boolean;
  exp: number;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function sign(data: string): string {
  return createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
}

export function signSession(payload: Omit<SessionPayload, 'exp'>): string {
  const body: SessionPayload = { ...payload, exp: Date.now() + SESSION_TTL_MS };
  const data = Buffer.from(JSON.stringify(body)).toString('base64url');
  return `${data}.${sign(data)}`;
}

export function verifySession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(data));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as SessionPayload;
    if (!payload.userId || typeof payload.exp !== 'number' || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = 'aionesboard_session';

/**
 * ponytail: `Secure` ditambahkan di produksi supaya cookie sesi tidak pernah
 * ikut terkirim lewat HTTP polos. Di lokal (http://127.0.0.1) tetap tanpa
 * `Secure`, kalau tidak browser menolak menyimpan cookie-nya.
 */
function flagSecure(): string {
  return process.env.NODE_ENV === 'production' ? '; Secure' : '';
}

export function sessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
    SESSION_TTL_MS / 1000
  )}${flagSecure()}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${flagSecure()}`;
}

export function parseSessionCookie(req: { headers: { cookie?: string } }): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === SESSION_COOKIE) return rest.join('=');
  }
  return undefined;
}
