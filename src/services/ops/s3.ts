/**
 * Unggah cadangan ke penyimpanan objek S3-compatible (AWS S3, Cloudflare R2,
 * MinIO, Backblaze B2 S3) — tanpa dependensi tambahan.
 *
 * ponytail: cadangan yang hanya ada di disk server yang sama bukan cadangan.
 * Kalau disk/server rusak, semua titik pulih ikut hilang. Modul ini menaruh
 * salinan di luar server memakai tanda tangan AWS Signature V4 yang dihitung
 * sendiri dengan `crypto` (tidak perlu `@aws-sdk/*` yang menambah puluhan MB).
 *
 * Konfigurasi lewat environment (jangan di-commit):
 *   S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
 *   S3_REGION (default us-east-1)
 *   S3_ENDPOINT (opsional; untuk R2/MinIO. Kosong = AWS)
 *   S3_PREFIX (default aionesboard/)
 *   S3_FORCE_PATH_STYLE (1 = gaya path, wajib untuk MinIO sebagian konfigurasi)
 */

import { createHash, createHmac } from 'crypto';
import { readFileSync } from 'fs';

export interface KonfigS3 {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  endpoint?: string;
  prefix: string;
  forcePathStyle: boolean;
}

function env(nama: string): string {
  return String(process.env[nama] || '').trim();
}

/** Baca konfigurasi S3 dari environment. `null` bila belum lengkap. */
export function konfigS3DariEnv(): KonfigS3 | null {
  const bucket = env('S3_BUCKET');
  const accessKeyId = env('S3_ACCESS_KEY_ID');
  const secretAccessKey = env('S3_SECRET_ACCESS_KEY');
  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    bucket,
    accessKeyId,
    secretAccessKey,
    region: env('S3_REGION') || 'us-east-1',
    endpoint: env('S3_ENDPOINT') || undefined,
    prefix: env('S3_PREFIX') || 'aionesboard/',
    forcePathStyle: env('S3_FORCE_PATH_STYLE') === '1' || !!env('S3_ENDPOINT'),
  };
}

const sha256Hex = (isi: Buffer | string): string => createHash('sha256').update(isi).digest('hex');
const hmac = (kunci: Buffer | string, isi: string): Buffer =>
  createHmac('sha256', kunci).update(isi).digest();

/** `2026-10-23T01:02:03.000Z` → `20261023T010203Z` (format x-amz-date). */
export function waktuAmz(waktu: Date): string {
  return waktu.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Encode path objek per segmen (spasi → %20, garis miring dibiarkan). */
export function encodePath(path: string): string {
  return path
    .split('/')
    .map((seg) =>
      encodeURIComponent(seg).replace(
        /[!'()*]/g,
        (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
      )
    )
    .join('/');
}

export interface MasukanTandaTangan {
  method: string;
  /** Path kanonik, sudah ter-encode (mis. `/bucket/a%20b.json.gz`). */
  path: string;
  /** Query kanonik tanpa `?` (kosong untuk PUT objek biasa). */
  query?: string;
  /** Header yang ikut ditandatangani (nama huruf kecil, nilai sudah dirapikan). */
  headers: Record<string, string>;
  payloadHash: string;
  region: string;
  service?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Waktu dalam format x-amz-date. */
  amzDate: string;
}

/**
 * Hitung header `Authorization` AWS Signature V4.
 *
 * Dipisah dari I/O supaya bisa diuji dengan vektor resmi AWS.
 */
export function tandaTanganV4(m: MasukanTandaTangan): {
  authorization: string;
  canonicalRequest: string;
  stringToSign: string;
  signature: string;
} {
  const service = m.service || 's3';
  const tanggal = m.amzDate.slice(0, 8);
  const namaHeader = Object.keys(m.headers)
    .map((h) => h.toLowerCase())
    .sort();
  const canonicalHeaders = namaHeader
    .map((h) => `${h}:${String(m.headers[h] ?? m.headers[h.toLowerCase()] ?? '').trim().replace(/\s+/g, ' ')}\n`)
    .join('');
  const signedHeaders = namaHeader.join(';');

  const canonicalRequest = [
    m.method.toUpperCase(),
    m.path,
    m.query || '',
    canonicalHeaders,
    signedHeaders,
    m.payloadHash,
  ].join('\n');

  const scope = `${tanggal}/${m.region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    m.amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kTanggal = hmac(`AWS4${m.secretAccessKey}`, tanggal);
  const kRegion = hmac(kTanggal, m.region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${m.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { authorization, canonicalRequest, stringToSign, signature };
}

/** Susun URL & path kanonik untuk satu objek. */
export function alamatObjek(cfg: KonfigS3, kunci: string): { url: string; path: string; host: string } {
  const kunciAman = encodePath(kunci.replace(/^\/+/, ''));
  if (cfg.endpoint) {
    const u = new URL(cfg.endpoint);
    const dasar = u.pathname.replace(/\/+$/, '');
    if (cfg.forcePathStyle) {
      return {
        url: `${u.origin}${dasar}/${cfg.bucket}/${kunciAman}`,
        path: `${dasar}/${cfg.bucket}/${kunciAman}` || `/${cfg.bucket}/${kunciAman}`,
        host: u.host,
      };
    }
    return {
      url: `${u.protocol}//${cfg.bucket}.${u.host}${dasar}/${kunciAman}`,
      path: `${dasar}/${kunciAman}`,
      host: `${cfg.bucket}.${u.host}`,
    };
  }
  const host = `${cfg.bucket}.s3.${cfg.region}.amazonaws.com`;
  return { url: `https://${host}/${kunciAman}`, path: `/${kunciAman}`, host };
}

/** Nama objek di bucket: `<prefix><nama berkas>`. */
export function kunciObjek(prefix: string, namaBerkas: string): string {
  const p = prefix && !prefix.endsWith('/') ? `${prefix}/` : prefix || '';
  return `${p}${namaBerkas.replace(/^\/+/, '')}`;
}

/**
 * Unggah satu berkas ke bucket. Melempar galat berisi status & badan respons
 * bila gagal, supaya pemanggil bisa melaporkannya (bukan diam-diam).
 */
export async function unggahBerkasKeS3(
  cfg: KonfigS3,
  namaBerkas: string,
  isi: Buffer,
  opsi: { waktu?: Date; contentType?: string } = {}
): Promise<{ ok: true; kunci: string; etag?: string } | { ok: false; kunci: string; galat: string }> {
  const kunci = kunciObjek(cfg.prefix, namaBerkas);
  const { url, path, host } = alamatObjek(cfg, kunci);
  const waktu = opsi.waktu || new Date();
  const amzDate = waktuAmz(waktu);
  const payloadHash = sha256Hex(isi);

  const headers: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  const { authorization } = tandaTanganV4({
    method: 'PUT',
    path,
    headers,
    payloadHash,
    region: cfg.region,
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    amzDate,
  });

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        ...headers,
        Authorization: authorization,
        'Content-Type': opsi.contentType || 'application/gzip',
        'Content-Length': String(isi.length),
      },
      body: new Uint8Array(isi),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const teks = await res.text().catch(() => '');
      return {
        ok: false,
        kunci,
        galat: `HTTP ${res.status} ${res.statusText}${teks ? ` — ${teks.slice(0, 300)}` : ''}`,
      };
    }
    return { ok: true, kunci, etag: res.headers.get('etag') || undefined };
  } catch (err: any) {
    return { ok: false, kunci, galat: err?.message || String(err) };
  }
}

/** Unggah berkas dari disk (dipakai penjadwal cadangan). */
export async function unggahCadanganDariDisk(
  cfg: KonfigS3,
  lokasiBerkas: string
): Promise<{ ok: boolean; kunci: string; galat?: string }> {
  const nama = lokasiBerkas.replace(/\\/g, '/').split('/').pop() || 'cadangan.json.gz';
  const isi = readFileSync(lokasiBerkas);
  const hasil = await unggahBerkasKeS3(cfg, nama, isi);
  if (hasil.ok) return { ok: true, kunci: hasil.kunci };
  return { ok: false, kunci: hasil.kunci, galat: hasil.galat };
}
