/**
 * UJI DATA ASLI LEWAT RAG (bukan data contoh).
 *
 * Alur yang diuji, sama seperti alur aplikasi:
 *   1. dokumen asli sudah ada di knowledge base RAG (kb_pam_jaya),
 *   2. aplikasi menganalisis dokumen itu lewat RAG (POST /api/analisis),
 *   3. butir data bersitasi tersimpan,
 *   4. halaman dibangun dari butir (POST /api/dashboards/dari-butir),
 *   5. setiap kartu memakai chart dari Template Chart,
 *   6. layar benar-benar menggambar kartunya.
 *
 * Kunci RAG dibaca dari database aplikasi dan TIDAK pernah dicetak.
 *
 * Jalankan: node scripts/probe-rag-asli.mjs
 * Artefak : C:/tmp/rag-asli
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mysql from 'mysql2/promise';
import puppeteer from 'puppeteer-core';

const PORT = Number(process.env.RAG_PORT || 3256);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.OUT_DIR || 'C:/tmp/rag-asli';
const DIR_ASLI = 'C:/Salman/PROJEK/bumd';
const SANDI = 'SandiE2eKuat2026';
const KB = process.env.KB_UJI || 'kb_pam_jaya';
const CHROME =
  process.env.CHROME_PATH ||
  ['C:/Program Files/Google/Chrome/Application/chrome.exe',
   'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
const hasil = { analisis: [], dashboard: null, layar: null };
const simpan = () => fs.writeFileSync(path.join(OUT, 'hasil.json'), JSON.stringify(hasil, null, 2));

async function ambilKunciRag() {
  const koneksi = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'aionesboard' });
  const [rows] = await koneksi.query("SELECT data FROM kv WHERE k = 'systemConfig' LIMIT 1");
  await koneksi.end();
  const cfg = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
  if (!cfg?.ragApiUrl || !cfg?.ragApiKey) throw new Error('konfigurasi RAG tidak ditemukan di database');
  return { url: String(cfg.ragApiUrl), key: String(cfg.ragApiKey) };
}

async function api(page, method, jalur, body, timeout = 240_000) {
  return page.evaluate(async (m, u, b, t) => {
    const ctl = new AbortController();
    const jam = setTimeout(() => ctl.abort(), t);
    const opt = { method: m, credentials: 'include', headers: {}, signal: ctl.signal };
    if (b !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(b); }
    try {
      const r = await fetch(u, opt);
      let j = null;
      try { j = await r.json(); } catch { /* bukan JSON */ }
      return { status: r.status, json: j };
    } finally {
      clearTimeout(jam);
    }
  }, method, jalur, body, timeout);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const rag = await ambilKunciRag();
  console.log(`[rag] basis: ${rag.url} · kunci terbaca: ${rag.key.length} karakter`);

  const dirData = fs.mkdtempSync(path.join(os.tmpdir(), 'aiones-rag-'));
  fs.writeFileSync(path.join(dirData, 'db.json'), JSON.stringify({ users: [], permintaanData: [], alertRules: [] }));
  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env, HONOR_SHELL_ENV: '1', PORT: String(PORT), NODE_ENV: 'production',
      AIONESBOARD_DATA_DIR: dirData, DEMO_PASSWORD: SANDI, BACKUP_OTOMATIS: '0', CONFIG_REFRESH_SECONDS: '0',
      MYSQL_HOST: '127.0.0.1', MYSQL_PORT: '3307', MYSQL_DATABASE: 'aiones_rag_asli', SMTP_HOST: '', S3_BUCKET: '',
      RAG_PROVIDER: 'http', RAG_API_URL: rag.url, RAG_API_KEY: rag.key, RAG_KB_ID: KB,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => (log += d));
  server.stderr.on('data', (d) => (log += d));

  let browser;
  try {
    for (let i = 0; i < 180; i++) {
      try { if ((await fetch(`${BASE}/health`)).ok) break; } catch { /* belum */ }
      await tunggu(500);
    }
    const login = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@aionesboard.id', password: SANDI }),
    });
    const jLogin = await login.json();
    if (!login.ok) throw new Error(`login gagal HTTP ${login.status} ${jLogin.error || ''}`);
    const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).filter((c) => c.includes('=')).join('; ');

    // Halaman dipakai untuk memanggil API (cookie sesi) sekaligus mengambil bukti layar.
    browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    const galat = [];
    page.on('console', (x) => { if (x.type() === 'error') galat.push(x.text().slice(0, 200)); });
    page.on('pageerror', (e) => galat.push('pageerror: ' + String(e).slice(0, 200)));
    await page.evaluateOnNewDocument((u) => localStorage.setItem('aionesboard_user', u), JSON.stringify(jLogin.user));
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    for (const c of cookie.split('; ')) {
      const i = c.indexOf('=');
      await page.setCookie({ name: c.slice(0, i), value: c.slice(i + 1), domain: '127.0.0.1', path: '/' });
    }

    // --- 1. probe RAG dulu: pastikan layanan benar-benar menjawab ---
    const probe = await api(page, 'POST', '/api/rag-probe', {});
    console.log(`[rag] probe HTTP ${probe.status} · status=${probe.json?.status} · provider=${probe.json?.providerAktif} · base=${probe.json?.baseDipakai}`);
    hasil.ragProbe = { status: probe.json?.status, provider: probe.json?.providerAktif, base: probe.json?.baseDipakai, latensi: probe.json?.latencyMs };

    // --- 2. analisis tiap berkas asli ---
    const berkas = fs.readdirSync(DIR_ASLI).filter((f) => /\.xlsx$/i.test(f));
    for (const f of berkas) {
      const ukuranKb = Math.round(fs.statSync(path.join(DIR_ASLI, f)).size / 1024);
      const berkasId = `berkas-${f.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const mulai = Date.now();
      const r = await api(page, 'POST', '/api/analisis', {
        berkasId, judulBerkas: f, tipe: 'xlsx', ukuranKb, segarkan: true,
      });
      const butir = r.json?.butir || [];
      const contoh = butir.slice(0, 4).map((b) => ({
        label: b.label, nilai: b.nilai, satuan: b.satuan, kategori: b.kategori,
        sitasi: b.sitasi ? `${b.sitasi.dokumen}: ${String(b.sitasi.kutipan || '').slice(0, 80)}` : null,
        seri: Array.isArray(b.seri) ? b.seri.length : 0,
        tabel: b.tabel ? `${b.tabel.baris?.length ?? 0} baris` : null,
      }));
      hasil.analisis.push({
        berkas: f, http: r.status, detik: Math.round((Date.now() - mulai) / 1000),
        error: r.json?.error || null, analisisId: r.json?.analisis?.id || null,
        jumlahButir: butir.length, dibuang: r.json?.dibuang ?? null,
        sisaKuota: r.json?.sisaKuota ?? null, dariCache: r.json?.dariCache ?? false,
        ringkasan: String(r.json?.analisis?.ringkasan || '').slice(0, 300), contoh,
      });
      simpan();
      console.log(`\n### ${f} -> HTTP ${r.status} · ${Math.round((Date.now() - mulai) / 1000)}s · butir=${butir.length} · dibuang=${r.json?.dibuang ?? '-'}${r.json?.error ? ' · ' + r.json.error : ''}`);
      for (const c of contoh) console.log('   -', JSON.stringify(c).slice(0, 220));
    }

    // --- 3. bangun halaman dari butir ---
    const semuaButir = [];
    for (const a of hasil.analisis) {
      if (!a.analisisId) continue;
      const r = await api(page, 'GET', `/api/analisis/${a.analisisId}/butir`);
      for (const b of r.json?.butir || r.json || []) semuaButir.push(b);
    }
    const ids = semuaButir.filter((b) => b.status !== 'ditolak').map((b) => b.id);
    const dash = await api(page, 'POST', '/api/dashboards/dari-butir', {
      judul: 'Data Asli BUMD — hasil analisis RAG',
      butirIds: ids,
    });
    const dashboard = dash.json?.dashboard || dash.json?.dashboards?.[0] || dash.json;
    const widgets = dashboard?.widgets || [];
    hasil.dashboard = {
      http: dash.status, error: dash.json?.error || null, id: dashboard?.id || null,
      butir: ids.length, widget: widgets.length,
      kartu: widgets.map((w) => ({ judul: w.title, tipe: w.type, chartId: w.chartId, dasar: w.chartDasar || null })),
    };
    simpan();
    console.log(`\n### dari-butir -> HTTP ${dash.status} · butir=${ids.length} · widget=${widgets.length}${dash.json?.error ? ' · ' + dash.json.error : ''}`);
    for (const w of hasil.dashboard.kartu) console.log('   -', `${w.tipe} → ${w.chartId}${w.dasar ? ` (dasar ${w.dasar})` : ''} · ${w.judul}`);

    // --- 4. bukti layar ---
    if (dashboard?.id) {
      await page.goto(`${BASE}/#/v/dashboards/d/${dashboard.id}`, { waitUntil: 'networkidle2', timeout: 60_000 });
      await page.reload({ waitUntil: 'networkidle2', timeout: 60_000 });
      await tunggu(4000);
      const kanvas = await page.evaluate(() => {
        const kartu = Array.from(document.querySelectorAll('[data-widget-id]'));
        const kosong = kartu.filter((k) => !k.querySelector('svg, canvas') && (k.innerText || '').trim().split('\n').filter((t) => t.trim()).length < 2).length;
        return { jumlah: kartu.length, kosong, judul: (document.querySelector('h1')?.textContent || '').trim() };
      });
      await page.screenshot({ path: path.join(OUT, 'kanvas.png'), fullPage: true });
      hasil.layar = { ...kanvas, galatKonsol: galat.length, galatContoh: galat.slice(0, 3) };
      simpan();
      console.log(`\n### layar: kartu=${kanvas.jumlah} · kosong=${kanvas.kosong} · galatKonsol=${galat.length}`);
    }
  } catch (e) {
    hasil.fatal = e.message;
    simpan();
    console.log('FATAL:', e.message, '\n', log.slice(-800));
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill();
    simpan();
    console.log(`\n[rag-asli] artefak: ${OUT}`);
  }
}

main();
