#!/usr/bin/env node
/**
 * Uji end-to-end memakai Chrome yang SUDAH terpasang di mesin (puppeteer-core).
 *
 * ponytail: dulu item ini tertahan karena dianggap butuh unduh browser Playwright
 * ~300 MB. Padahal `puppeteer-core` sudah ada di devDependencies dan Chrome biasa
 * bisa dipakai lewat executablePath — jadi tidak ada dependensi baru sama sekali.
 *
 * Server dijalankan sendiri di port terpisah dengan direktori data SEMENTARA,
 * supaya:
 *  - data pengguna asli tidak tersentuh,
 *  - MySQL produksi tidak pernah tersambung (host diarahkan ke port kosong),
 *  - uji bisa dijalankan berulang tanpa membersihkan apa pun.
 *
 * Pakai: npm run test:e2e
 * Butuh: Chrome/Edge terpasang. Set CHROME_PATH bila lokasinya tidak standar.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const PORT = Number(process.env.E2E_PORT || 3199);
const BASE = `http://127.0.0.1:${PORT}`;
const EMAIL = 'admin@aionesboard.id';
const PASSWORD = 'E2eSandiKuat2026';
const ARTIFACT = path.join(process.cwd(), 'e2e-artifacts');

const KANDIDAT_CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

function cariChrome() {
  for (const p of KANDIDAT_CHROME) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* abaikan */
    }
  }
  throw new Error(
    'Chrome/Edge tidak ditemukan. Set CHROME_PATH ke executable browser.'
  );
}

const log = (...a) => console.log('[e2e]', ...a);
const langkah = [];

function catat(nama, ok, keterangan = '') {
  langkah.push({ nama, ok, keterangan });
  console.log(`${ok ? '  ✔' : '  ✘'} ${nama}${keterangan ? ` — ${keterangan}` : ''}`);
}

function assert(ok, pesan) {
  if (!ok) throw new Error(pesan);
}

async function tungguSehat(ms = 90_000) {
  const batas = Date.now() + ms;
  while (Date.now() < batas) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) {
        const j = await r.json();
        if (j.status === 'ok') return j;
      }
    } catch {
      /* server belum siap */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Server uji tidak pernah sehat di ' + BASE);
}

async function main() {
  const dirData = fs.mkdtempSync(path.join(os.tmpdir(), 'aiones-e2e-'));
  fs.mkdirSync(ARTIFACT, { recursive: true });
  log('data sementara:', dirData);

  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      // `server.ts` memuat `.env` dengan override kecuali flag ini diset
      // (lihat komentar di baris atas server.ts). Tanpa flag ini, PORT dan
      // direktori data dari sini diabaikan dan uji menimpa data asli.
      HONOR_SHELL_ENV: '1',
      PORT: String(PORT),
      NODE_ENV: 'production',
      AIONESBOARD_DATA_DIR: dirData,
      // Sandi demo diganti supaya akun seed tidak dipaksa ganti sandi.
      DEMO_PASSWORD: PASSWORD,
      BACKUP_OTOMATIS: '0',
      CONFIG_REFRESH_SECONDS: '0',
      // MySQL diarahkan ke port kosong: koneksi ditolak → penyimpanan berkas.
      // Ini yang mencegah uji menyentuh database produksi.
      MYSQL_HOST: '127.0.0.1',
      MYSQL_PORT: '3307',
      MYSQL_DATABASE: 'aiones_e2e_tidak_dipakai',
      SMTP_HOST: '',
      S3_BUCKET: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  let keluaranServer = '';
  server.stdout.on('data', (d) => (keluaranServer += d.toString()));
  server.stderr.on('data', (d) => (keluaranServer += d.toString()));

  let browser;
  try {
    const sehat = await tungguSehat();
    catat('server uji hidup', true, `persistence=${sehat.persistence}`);

    // ---- Bagian API: login, buat dashboard, buat tautan bagikan ----
    const judulDash = `E2E Dashboard ${Date.now()}`;
    const rLogin = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    assert(rLogin.ok, `login API gagal: HTTP ${rLogin.status}`);
    const mentahCookie = rLogin.headers.getSetCookie?.() ?? [rLogin.headers.get('set-cookie') || ''];
    const cookie = mentahCookie.map((c) => String(c).split(';')[0]).filter(Boolean).join('; ');
    assert(cookie, 'login API tidak mengembalikan cookie sesi');
    catat('login lewat API', true, `HTTP ${rLogin.status}`);

    const rDash = await fetch(`${BASE}/api/dashboards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: judulDash, sector: 'pdam', widgets: [] }),
    });
    assert(rDash.status === 201, `buat dashboard gagal: HTTP ${rDash.status}`);
    const dash = await rDash.json();
    catat('buat dashboard', true, dash.id);

    const rShare = await fetch(`${BASE}/api/dashboards/${dash.id}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ mode: 'readonly', expiresInDays: 1 }),
    });
    assert(rShare.ok, `buat tautan bagikan gagal: HTTP ${rShare.status}`);
    const tautan = await rShare.json();
    assert(tautan.shareUrl?.startsWith('/share/'), 'shareUrl tidak berbentuk /share/<token>');
    catat('buat tautan bagikan', true, tautan.shareUrl);

    // ---- Bagian browser ----
    const execPath = cariChrome();
    browser = await puppeteer.launch({
      executablePath: execPath,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900'],
    });
    catat('browser dijalankan', true, path.basename(execPath));

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    const galatHalaman = [];
    const galatKonsol = [];
    page.on('pageerror', (e) => galatHalaman.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') galatKonsol.push(m.text());
    });

    const teks = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');

    // 1. Halaman publik paket — harus bisa dibuka tanpa login.
    await page.goto(`${BASE}/paket`, { waitUntil: 'domcontentloaded' });
    const isiPaket = await teks();
    assert(isiPaket.includes('Dasar'), 'halaman /paket tidak memuat paket Dasar');
    assert(isiPaket.includes('Profesional'), 'halaman /paket tidak memuat paket Profesional');
    assert(isiPaket.includes('Instansi / Grup'), 'halaman /paket tidak memuat paket Instansi / Grup');
    assert(!/\bRp\s?\d/.test(isiPaket), 'halaman /paket memuat angka harga (seharusnya tanpa harga)');
    catat('halaman publik /paket', true, '3 paket, tanpa harga');

    // 2. Halaman masuk tampil dan menolak sandi salah.
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
    await page.type('input[type="email"]', EMAIL);
    await page.type('input[type="password"]', 'sandi-yang-salah-sekali');
    await page.click('button[type="submit"]');
    await page.waitForFunction(
      () => !!document.querySelector('[role="alert"]'),
      { timeout: 20_000 }
    );
    const pesanGalat = await page.$eval('[role="alert"]', (el) => el.innerText.trim());
    catat('sandi salah ditolak', true, pesanGalat.slice(0, 60));
    // Percobaan di atas sengaja menghasilkan HTTP 401 di konsol. Buffer
    // dibersihkan supaya gerbang "tanpa galat" hanya menilai langkah normal.
    galatKonsol.length = 0;
    galatHalaman.length = 0;

    // 3. Masuk dengan sandi benar → masuk ke aplikasi.
    //    Halaman dimuat ulang dulu: input dikendalikan React, jadi mengosongkan
    //    `value` lewat DOM tidak mengubah state dan sandi salah akan menempel.
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
    await page.type('input[type="email"]', EMAIL);
    await page.type('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !!localStorage.getItem('aionesboard_user'), { timeout: 30_000 });
    await page.waitForSelector('[data-testid="buka-manajemen-berkas"]', { timeout: 30_000 });
    const sudahMasuk = await page.evaluate(() => !!localStorage.getItem('aionesboard_user'));
    assert(sudahMasuk, 'sesi tidak tercatat di browser setelah masuk');
    catat('masuk ke aplikasi', true, 'sidebar tampil');

    // 4. Tautan bagikan terbuka untuk publik (tanpa cookie sesi).
    const halamanPublik = await browser.createBrowserContext();
    const pagePublik = await halamanPublik.newPage();
    await pagePublik.goto(`${BASE}${tautan.shareUrl}`, { waitUntil: 'networkidle2' });
    await pagePublik.waitForFunction(
      (t) => document.body.innerText.includes(t),
      { timeout: 30_000 },
      judulDash
    );
    const isiPublik = (await pagePublik.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    assert(isiPublik.includes(judulDash), 'judul dashboard tidak tampil di halaman bagikan');
    catat('halaman bagikan publik', true, judulDash);
    await halamanPublik.close();

    // 5. Tidak ada galat runtime di halaman yang diuji.
    assert(galatHalaman.length === 0, `galat runtime halaman: ${galatHalaman.join(' | ')}`);
    // Derau yang bukan cacat aplikasi: Google Sign-In menolak origin uji
    // (127.0.0.1:3199 tidak terdaftar di client ID) dan menyisipkan stylesheet
    // miliknya sendiri. Di domain produksi keduanya tidak muncul.
    const galatNyata = galatKonsol.filter(
      (t) =>
        !/favicon|Download the React DevTools|ERR_INTERNET_DISCONNECTED|net::ERR_/i.test(t) &&
        !/accounts\.google\.com|GSI_LOGGER|given origin is not allowed/i.test(t)
    );
    assert(galatNyata.length === 0, `galat konsol: ${galatNyata.slice(0, 3).join(' | ')}`);
    catat('tanpa galat runtime', true, `${galatKonsol.length} pesan konsol disaring`);
  } catch (e) {
    console.error('\n[e2e] GAGAL:', e.message);
    try {
      const halaman = (await browser?.pages())?.[0];
      if (halaman) {
        const berkas = path.join(ARTIFACT, `gagal-${Date.now()}.png`);
        await halaman.screenshot({ path: berkas, fullPage: true });
        console.error('[e2e] tangkapan layar:', berkas);
        fs.writeFileSync(
          path.join(ARTIFACT, 'gagal-terakhir.html'),
          await halaman.content(),
          'utf-8'
        );
      }
    } catch {
      /* abaikan */
    }
    console.error('[e2e] 200 baris terakhir log server:\n' + keluaranServer.split('\n').slice(-200).join('\n'));
    process.exitCode = 1;
  } finally {
    await browser?.close().catch(() => {});
    server.kill('SIGTERM');
    // Windows tidak selalu menghormati SIGTERM pada proses anak.
    setTimeout(() => {
      try {
        server.kill('SIGKILL');
      } catch {
        /* sudah mati */
      }
    }, 1500).unref?.();
    try {
      fs.rmSync(dirData, { recursive: true, force: true });
    } catch {
      /* abaikan */
    }
  }

  const gagal = langkah.filter((l) => !l.ok).length;
  console.log(`\n[e2e] ${langkah.length - gagal}/${langkah.length} langkah lulus`);
  if (process.exitCode) console.log('[e2e] hasil: GAGAL');
  else console.log('[e2e] hasil: LULUS');
}

main().catch((e) => {
  console.error('[e2e] kesalahan tak tertangani:', e);
  process.exit(1);
});
