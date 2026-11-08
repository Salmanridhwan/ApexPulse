/**
 * Alat bantu (bukan uji): tangkap tiga kartu wajah baru di halaman Template Chart
 * supaya bisa diperiksa secara visual dengan cepat.
 *
 * Jalankan: node scripts/cek-kartu-wajah.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const PORT = Number(process.env.CEK_PORT || 3249);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.OUT_DIR || 'C:/tmp/cek-kartu';
const CHROME =
  process.env.CHROME_PATH ||
  ['C:/Program Files/Google/Chrome/Application/chrome.exe',
   'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const SANDI = 'SandiE2eKuat2026';

const JUDUL = {
  'peta-wilayah': 'Peta wilayah',
  'jadwal-gantt': 'Jadwal kegiatan (gantt)',
  'kotak-sebaran': 'Kotak sebaran (boxplot)',
};
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const dirData = fs.mkdtempSync(path.join(os.tmpdir(), 'aiones-cek-'));
  fs.writeFileSync(path.join(dirData, 'db.json'), JSON.stringify({ users: [], permintaanData: [], alertRules: [] }));
  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, HONOR_SHELL_ENV: '1', PORT: String(PORT), NODE_ENV: 'production',
      AIONESBOARD_DATA_DIR: dirData, DEMO_PASSWORD: SANDI, BACKUP_OTOMATIS: '0', CONFIG_REFRESH_SECONDS: '0',
      MYSQL_HOST: '127.0.0.1', MYSQL_PORT: '3307', MYSQL_DATABASE: 'aiones_cek', SMTP_HOST: '', S3_BUCKET: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let browser;
  try {
    for (let i = 0; i < 120; i++) {
      try { if ((await fetch(`${BASE}/health`)).ok) break; } catch { /* belum */ }
      await tunggu(500);
    }
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@aionesboard.id', password: SANDI }),
    });
    const j = await r.json();
    const cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).filter((c) => c.includes('='));

    browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.evaluateOnNewDocument((u) => localStorage.setItem('aionesboard_user', u), JSON.stringify(j.user));
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    for (const c of cookie) {
      const i = c.indexOf('=');
      await page.setCookie({ name: c.slice(0, i), value: c.slice(i + 1), domain: '127.0.0.1', path: '/' });
    }
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60_000 });
    await tunggu(2000);
    // Hash harus dipasang SETELAH sesi siap; kalau tidak, penjaga rute
    // melempar kembali ke dashboard.
    const diklik = await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll('a[href="#/v/charts"], button')).find(
        (x) => (x.getAttribute('href') === '#/v/charts') || /template chart/i.test(x.textContent || '')
      );
      if (!a) return false;
      a.click();
      return true;
    });
    if (!diklik) await page.evaluate(() => { window.location.hash = '#/v/charts'; });
    await tunggu(4500);
    await page.screenshot({ path: path.join(OUT, 'halaman.png'), fullPage: false });
    console.log('url:', page.url());
    console.log('judul:', await page.title());
    console.log('p-pertama:', await page.evaluate(() => Array.from(document.querySelectorAll('p')).slice(0, 12).map((x) => (x.textContent || '').trim()).join(' | ')));
    for (const [id, nama] of Object.entries(JUDUL)) {
      const el = await page.evaluateHandle((n) => {
        const p = Array.from(document.querySelectorAll('p')).find((x) => (x.textContent || '').trim() === n);
        return p ? p.closest('div.rounded-card') : null;
      }, nama);
      const node = el.asElement();
      if (!node) { console.log('tidak ada kartu', nama); continue; }
      await page.evaluate((x) => x?.scrollIntoView({ block: 'center' }), node);
      await tunggu(900);
      const isi = (await page.evaluate((x) => (x?.innerText || '').slice(0, 120), node)).split('\n').join(' / ');
      const kotak = await node.boundingBox();
      await page.screenshot({
        path: path.join(OUT, `${id}.png`),
        clip: { x: Math.max(0, kotak.x), y: Math.max(0, kotak.y), width: kotak.width, height: kotak.height },
      });
      console.log('isi kartu:', isi);
      console.log('tersimpan', path.join(OUT, `${id}.png`));
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill();
  }
}

main();
