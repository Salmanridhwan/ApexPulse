import { createPublicKey, createVerify } from 'crypto';

/**
 * VERIFIKASI LOGIN GOOGLE (Google Identity Services — ID token).
 *
 * Alur: browser memakai Google Identity Services untuk mendapatkan **ID token**
 * (JWT bertanda tangan Google), lalu mengirimnya ke server. Server memverifikasi
 * tanda tangan & klaim token DI SINI, memakai kunci publik resmi Google (JWKS) —
 * jadi tidak ada kredensial Google yang perlu dipercaya dari sisi klien, dan
 * tidak ada dependensi tambahan (hanya `crypto` bawaan Node).
 *
 * Kenapa verifikasi lokal, bukan panggilan `tokeninfo`: panggilan tokeninfo
 * menambah ketergantungan jaringan pada setiap login dan tidak memverifikasi
 * `aud`/`iss` dengan tegas. Verifikasi tanda tangan di sini memastikan token
 * benar-benar diterbitkan Google untuk aplikasi ini.
 */

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
/** Cache JWKS: kunci Google berotasi, jadi di-cache singkat lalu diambil ulang. */
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 jam

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
  use?: string;
}

let cacheJwks: { kunci: Jwk[]; diambilPada: number } | null = null;

/** Ambil JWKS Google (dengan cache). Melempar galat jujur bila tak bisa dihubungi. */
async function ambilJwks(paksa = false): Promise<Jwk[]> {
  if (!paksa && cacheJwks && Date.now() - cacheJwks.diambilPada < CACHE_TTL_MS) {
    return cacheJwks.kunci;
  }
  let res: Response;
  try {
    res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(10_000) });
  } catch (err) {
    throw new GoogleAuthError(
      'Tidak bisa menghubungi layanan Google untuk memverifikasi login.',
      err instanceof Error ? err.message : undefined
    );
  }
  if (!res.ok) {
    throw new GoogleAuthError(`Layanan kunci publik Google menjawab HTTP ${res.status}.`);
  }
  const body: any = await res.json().catch(() => null);
  const kunci = Array.isArray(body?.keys) ? (body.keys as Jwk[]) : [];
  if (kunci.length === 0) {
    throw new GoogleAuthError('Layanan Google tidak mengembalikan kunci publik yang sah.');
  }
  cacheJwks = { kunci, diambilPada: Date.now() };
  return kunci;
}

export class GoogleAuthError extends Error {
  readonly detail?: string;
  constructor(message: string, detail?: string) {
    super(message);
    this.name = 'GoogleAuthError';
    this.detail = detail;
  }
}

export interface ProfilGoogle {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
}

const b64urlKeBuffer = (s: string): Buffer => Buffer.from(s, 'base64url');
const b64urlKeJson = <T>(s: string): T => JSON.parse(b64urlKeBuffer(s).toString('utf8')) as T;

/**
 * Verifikasi ID token Google dan kembalikan profilnya.
 *
 * Yang diperiksa: (1) format JWT; (2) algoritma RS256; (3) tanda tangan cocok
 * dengan kunci publik Google ber-`kid` sama; (4) `aud` = Client ID aplikasi ini;
 * (5) `iss` = Google; (6) token belum kedaluwarsa; (7) email terverifikasi.
 */
export async function verifikasiIdTokenGoogle(
  idToken: string,
  clientId: string
): Promise<ProfilGoogle> {
  if (!clientId) {
    throw new GoogleAuthError('Login Google belum dikonfigurasi (GOOGLE_CLIENT_ID kosong).');
  }
  const bagian = String(idToken || '').split('.');
  if (bagian.length !== 3) {
    throw new GoogleAuthError('Token Google tidak berformat JWT yang sah.');
  }
  const [rawHeader, rawPayload, rawSig] = bagian;

  let header: { alg?: string; kid?: string; typ?: string };
  let payload: {
    aud?: string;
    iss?: string;
    exp?: number;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    picture?: string;
    sub?: string;
  };
  try {
    header = b64urlKeJson(rawHeader);
    payload = b64urlKeJson(rawPayload);
  } catch {
    throw new GoogleAuthError('Token Google tidak bisa dibaca.');
  }

  if (header.alg !== 'RS256') {
    throw new GoogleAuthError(`Algoritma token Google tidak didukung (${header.alg || 'kosong'}).`);
  }

  // Cari kunci publik dengan `kid` yang sama; kalau tidak ada, segarkan JWKS sekali
  // (kunci Google berotasi dan cache bisa sudah kedaluwarsa).
  let kunci = (await ambilJwks()).find((k) => k.kid === header.kid);
  if (!kunci) {
    kunci = (await ambilJwks(true)).find((k) => k.kid === header.kid);
  }
  if (!kunci) {
    throw new GoogleAuthError('Kunci publik Google untuk token ini tidak ditemukan.');
  }

  const publicKey = createPublicKey({ key: { kty: kunci.kty, n: kunci.n, e: kunci.e }, format: 'jwk' });
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${rawHeader}.${rawPayload}`);
  verifier.end();
  const tandaTanganSah = verifier.verify(publicKey, b64urlKeBuffer(rawSig));
  if (!tandaTanganSah) {
    throw new GoogleAuthError('Tanda tangan token Google tidak sah.');
  }

  if (payload.aud !== clientId) {
    throw new GoogleAuthError('Token Google diterbitkan untuk aplikasi lain (aud tidak cocok).');
  }
  if (!payload.iss || !ISSUERS.includes(payload.iss)) {
    throw new GoogleAuthError('Token Google bukan dari penerbit resmi.');
  }
  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
    throw new GoogleAuthError('Token Google sudah kedaluwarsa.');
  }
  const terverifikasi = payload.email_verified === true || payload.email_verified === 'true';
  if (!payload.email || !terverifikasi) {
    throw new GoogleAuthError('Email akun Google belum terverifikasi.');
  }

  return {
    sub: String(payload.sub || ''),
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split('@')[0],
    picture: payload.picture,
    emailVerified: terverifikasi,
  };
}
