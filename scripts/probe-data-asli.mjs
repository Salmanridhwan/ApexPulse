/**
 * PROBE DATA ASLI — baca berkas Excel asli lewat jalur impor aplikasi.
 *
 * Yang dibuktikan: berkas nyata (bukan contoh) benar-benar terbaca oleh
 * `bacaTabel` di server, dan kita bisa melihat kolom apa yang dihasilkan.
 * Ini langkah diagnosis sebelum data dipetakan menjadi widget.
 *
 * Jalankan: node scripts/probe-data-asli.mjs
 * Keluaran: C:/tmp/data-asli/pratinjau.json
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.DATA_PORT || 3251);
const BASE = `http://127.0.0.1:${PORT}`;
const DIR = process.env.DIR_ASLI || 'C:/Salman/PROJEK/bumd';
const OUT = process.env.OUT_DIR || 'C:/tmp/data-asli';
const SANDI = 'SandiE2eKuat2026';
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@aionesboard.id', password: SANDI }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`login gagal HTTP ${r.status} ${j.error || ''}`);
  return (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).filter((c) => c.includes('=')).join('; ');
}

const panggil = async (cookie, jalur, body) => {
  const r = await fetch(`${BASE}${jalur}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const dirData = fs.mkdtempSync(path.join(os.tmpdir(), 'aiones-data-'));
  fs.writeFileSync(path.join(dirData, 'db.json'), JSON.stringify({ users: [], permintaanData: [], alertRules: [] }));
  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, HONOR_SHELL_ENV: '1', PORT: String(PORT), NODE_ENV: 'production',
      AIONESBOARD_DATA_DIR: dirData, DEMO_PASSWORD: SANDI, BACKUP_OTOMATIS: '0', CONFIG_REFRESH_SECONDS: '0',
      MYSQL_HOST: '127.0.0.1', MYSQL_PORT: '3307', MYSQL_DATABASE: 'aiones_data', SMTP_HOST: '', S3_BUCKET: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => (log += d));
  server.stderr.on('data', (d) => (log += d));
  try {
    for (let i = 0; i < 160; i++) {
      try { if ((await fetch(`${BASE}/health`)).ok) break; } catch { /* belum */ }
      await tunggu(500);
    }
    const cookie = await login();
    const berkas = fs.readdirSync(DIR).filter((f) => /\.xlsx$/i.test(f));
    const ringkas = [];
    for (const f of berkas) {
      const isi = fs.readFileSync(path.join(DIR, f)).toString('base64');
      // Panggil tanpa `sheet` dulu: server memakai sheet pertama + daftar sheet.
      const r = await panggil(cookie, '/api/impor/pratinjau', { isi });
      const j = r.json || {};
      ringkas.push({
        berkas: f,
        status: r.status,
        error: j.error || null,
        sheetDipakai: j.namaSheet || null,
        daftarSheet: (j.daftarSheet || []).length,
        kolom: j.kolom || [],
        baris: j.totalBaris ?? null,
        contoh: (j.baris || []).slice(0, 3),
      });
      console.log(`\n### ${f} -> HTTP ${r.status}${j.error ? ' · ' + j.error : ''}`);
      console.log(`   sheet: ${j.namaSheet} (dari ${(j.daftarSheet || []).length}) · baris: ${j.totalBaris}`);
      console.log(`   kolom: ${JSON.stringify((j.kolom || []).slice(0, 8))}`);
      for (const c of (j.baris || []).slice(0, 2)) console.log('   baris:', JSON.stringify(c).slice(0, 220));
    }
    fs.writeFileSync(path.join(OUT, 'pratinjau.json'), JSON.stringify({ ringkas, log: log.slice(-2000) }, null, 2));
    console.log(`\n[data-asli] tersimpan: ${path.join(OUT, 'pratinjau.json')}`);
  } finally {
    server.kill();
  }
}

main();
