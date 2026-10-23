import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  alamatObjek,
  encodePath,
  konfigS3DariEnv,
  kunciObjek,
  tandaTanganV4,
  waktuAmz,
} from '../src/services/ops/s3';

const KOSONG = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

test('tanda tangan cocok dengan vektor resmi AWS (SigV4 GET contoh bucket)', () => {
  // Vektor dari dokumentasi AWS "Signature Calculations for the Authorization
  // Header". Kalau fungsi ini menyimpang, seluruh unggahan off-site akan ditolak
  // S3 dengan 403 — jadi vektor ini adalah jaring pengaman utama.
  const hasil = tandaTanganV4({
    method: 'GET',
    path: '/test.txt',
    headers: {
      host: 'examplebucket.s3.amazonaws.com',
      range: 'bytes=0-9',
      'x-amz-content-sha256': KOSONG,
      'x-amz-date': '20130524T000000Z',
    },
    payloadHash: KOSONG,
    region: 'us-east-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    amzDate: '20130524T000000Z',
  });
  assert.equal(hasil.signature, 'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
  assert.ok(hasil.authorization.startsWith('AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request'));
  assert.ok(hasil.authorization.includes('SignedHeaders=host;range;x-amz-content-sha256;x-amz-date'));
});

test('tanda tangan berubah bila payload atau waktu berubah', () => {
  const dasar = {
    method: 'PUT',
    path: '/bucket/a.json.gz',
    headers: { host: 'bucket.s3.us-east-1.amazonaws.com', 'x-amz-content-sha256': KOSONG, 'x-amz-date': '20261023T010203Z' },
    payloadHash: KOSONG,
    region: 'us-east-1',
    accessKeyId: 'AK',
    secretAccessKey: 'SK',
    amzDate: '20261023T010203Z',
  };
  const a = tandaTanganV4(dasar).signature;
  const b = tandaTanganV4({ ...dasar, payloadHash: 'abc', headers: { ...dasar.headers, 'x-amz-content-sha256': 'abc' } }).signature;
  const c = tandaTanganV4({ ...dasar, amzDate: '20261023T010204Z', headers: { ...dasar.headers, 'x-amz-date': '20261023T010204Z' } }).signature;
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test('waktuAmz memakai format x-amz-date tanpa titik dua', () => {
  assert.equal(waktuAmz(new Date('2026-10-23T01:02:03.456Z')), '20261023T010203Z');
});

test('encodePath meng-encode per segmen dan mempertahankan garis miring', () => {
  assert.equal(encodePath('aionesboard/a b/c+d.json.gz'), 'aionesboard/a%20b/c%2Bd.json.gz');
  assert.equal(encodePath('/x/y'), '/x/y');
});

test('kunciObjek menambahkan awalan folder sekali saja', () => {
  assert.equal(kunciObjek('aionesboard/', 'f.json.gz'), 'aionesboard/f.json.gz');
  assert.equal(kunciObjek('aionesboard', 'f.json.gz'), 'aionesboard/f.json.gz');
  assert.equal(kunciObjek('', 'f.json.gz'), 'f.json.gz');
  assert.equal(kunciObjek('aionesboard/', '/f.json.gz'), 'aionesboard/f.json.gz');
});

test('alamatObjek: AWS virtual-host, endpoint path-style, dan virtual-host kustom', () => {
  const aws = alamatObjek(
    { bucket: 'b', accessKeyId: 'a', secretAccessKey: 's', region: 'ap-southeast-1', prefix: '', forcePathStyle: false },
    'f.json.gz'
  );
  assert.equal(aws.url, 'https://b.s3.ap-southeast-1.amazonaws.com/f.json.gz');
  assert.equal(aws.path, '/f.json.gz');
  assert.equal(aws.host, 'b.s3.ap-southeast-1.amazonaws.com');

  const minio = alamatObjek(
    {
      bucket: 'b',
      accessKeyId: 'a',
      secretAccessKey: 's',
      region: 'us-east-1',
      endpoint: 'https://s3.example.com',
      prefix: '',
      forcePathStyle: true,
    },
    'f.json.gz'
  );
  assert.equal(minio.url, 'https://s3.example.com/b/f.json.gz');
  assert.equal(minio.path, '/b/f.json.gz');

  const r2 = alamatObjek(
    {
      bucket: 'b',
      accessKeyId: 'a',
      secretAccessKey: 's',
      region: 'auto',
      endpoint: 'https://acc.r2.cloudflarestorage.com',
      prefix: '',
      forcePathStyle: true,
    },
    'x/f.json.gz'
  );
  assert.equal(r2.url, 'https://acc.r2.cloudflarestorage.com/b/x/f.json.gz');
});

test('konfigS3DariEnv: null bila belum lengkap, lengkap bila semua terisi', () => {
  const simpan = { ...process.env };
  for (const k of ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_REGION', 'S3_ENDPOINT', 'S3_PREFIX', 'S3_FORCE_PATH_STYLE']) {
    delete process.env[k];
  }
  assert.equal(konfigS3DariEnv(), null);

  process.env.S3_BUCKET = 'cadangan';
  assert.equal(konfigS3DariEnv(), null, 'tanpa kredensial tidak dianggap aktif');

  process.env.S3_ACCESS_KEY_ID = 'AK';
  process.env.S3_SECRET_ACCESS_KEY = 'SK';
  const cfg = konfigS3DariEnv();
  assert.ok(cfg);
  assert.equal(cfg!.bucket, 'cadangan');
  assert.equal(cfg!.region, 'us-east-1');
  assert.equal(cfg!.prefix, 'aionesboard/');
  assert.equal(cfg!.forcePathStyle, false);

  process.env.S3_ENDPOINT = 'https://minio.local:9000';
  const minio = konfigS3DariEnv();
  assert.equal(minio!.forcePathStyle, true, 'endpoint kustom memakai path-style');

  process.env = simpan;
});
