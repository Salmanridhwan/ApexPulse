import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Autentikasi AionesBoard — memakai crypto bawaan Node (scrypt + HMAC),
 * tanpa dependensi eksternal. Token sesi dikirim via cookie HttpOnly.
 */

const SESSION_SECRET = process.env.SESSION_SECRET || 'aionesboard-dev-secret-ganti-di-produksi';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

// Di produksi, secret default berarti siapa pun yang tahu kode bisa memalsukan
// token sesi. Peringatkan dengan keras (jangan diam-diam aman-palsu).
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.warn(
    '[AionesBoard Auth] SESSION_SECRET belum diisi — memakai secret default. ' +
      'Set SESSION_SECRET di .env sebelum dipakai produksi!'
  );
}

export interface SessionPayload {
  userId: string;
  role: string;
  tenantId: string;
  name: string;
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

export function sessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
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
