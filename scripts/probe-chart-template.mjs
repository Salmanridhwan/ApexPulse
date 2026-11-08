/**
 * PROBE — CHART SELALU DARI TEMPLATE CHART.
 *
 * Aturan yang dibuktikan (lewat layar + API yang sama dengan yang dipakai UI):
 *
 * 1. Widget yang sudah memakai chart bawaan TIDAK diubah (tidak ada entri baru).
 * 2. Widget yang bentuk datanya tidak punya padanan bawaan (heatmap, peta, radar,
 *    …) dibuatkan ENTRI BARU di Template Chart (`kustom-…`) dan kartu memakai
 *    entri itu — bukan chart liar di luar katalog.
 * 3. Entri itu menunjuk chart bawaan penggambarnya (`chartDasar`), jadi kartu
 *    tidak kosong dan tetap digambar chart dari Template Chart.
 * 4. Bentuk data yang sama TIDAK membuat entri kedua (idempoten).
 * 5. Entri tersimpan: muncul di `GET /api/chart/kustom`, tercatat di audit, dan
 *    tampil di halaman Template Chart sebagai "Dibuat otomatis dari data".
 * 6. Kanvas dashboard benar-benar menggambar kartunya tanpa galat konsol.
 *
 * Jalankan: node scripts/probe-chart-template.mjs
 * Artefak : %TEMP%/probe-chart-template
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const PORT = Number(process.env.PROBE_PORT || 3247);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.OUT_DIR || path.join(os.tmpdir(), 'probe-chart-template');
const CHROME =
  process.env.CHROME_PATH ||
  ['C:/Program Files/Google/Chrome/Application/chrome.exe',
   'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const SANDI = 'SandiE2eKuat2026';
const EMAIL_ADMIN = 'admin@aionesboard.id';

const hasil = [];
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
function catat(nama, ok, ket = '') {
  hasil.push({ nama, ok, ket: String(ket).slice(0, 700) });
  console.log(`${ok ? 'LULUS ' : 'GAGAL '} ${nama}${ket ? ' — ' + String(ket).slice(0, 320) : ''}`);
}
async function probe(nama, fn) {
  try {
    const r = await fn();
    if (r && typeof r === 'object') catat(nama, !!r.ok, r.ket || '');
    else catat(nama, !!r, '');
  } catch (e) {
    catat(nama, false, 'ERROR: ' + e.message);
  }
}

async function api(page, method, jalur, body) {
  return page.evaluate(async (m, u, b) => {
    const opt = { method: m, credentials: 'include', headers: {} };
    if (b !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(b); }
    const r = await fetch(u, opt);
    let j = null;
    try { j = await r.json(); } catch { /* bukan JSON */ }
    return { status: r.status, json: j };
  }, method, jalur, body);
}

async function loginApi(email, sandi) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: sandi }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`login ${email} gagal HTTP ${r.status}: ${j.error || ''}`);
  const mentah = (r.headers.getSetCookie?.() ?? [r.headers.get('set-cookie') || '']).join(';');
  const cookie = mentah.split(/,\s*/).map((c) => c.split(';')[0]).filter((c) => c.includes('='));
  return { user: j.user, cookie };
}

async function siapkanHalaman(browser, sesi) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const galatKonsol = [];
  page.on('console', (x) => { if (x.type() === 'error') galatKonsol.push(x.text().slice(0, 200)); });
  page.on('pageerror', (e) => galatKonsol.push('pageerror: ' + String(e).slice(0, 200)));
  await page.evaluateOnNewDocument((u) => localStorage.setItem('aionesboard_user', u), JSON.stringify(sesi.user));
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  for (const c of sesi.cookie) {
    const i = c.indexOf('=');
    await page.setCookie({ name: c.slice(0, i), value: c.slice(i + 1), domain: '127.0.0.1', path: '/' });
  }
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60_000 });
  await tunggu(1500);
  return { page, galatKonsol };
}

/* ---------- contoh widget ---------- */

/** Sudah memakai chart bawaan: tidak boleh diubah. */
const widgetBawaan = {
  id: 'w-bawaan',
  type: 'bar',
  chartId: 'bar-tegak-sorot',
  title: 'Realisasi per Unit',
  confidence: 'high',
  grid: { x: 0, y: 0, w: 6, h: 4 },
  chart: { xAxis: ['Unit A', 'Unit B', 'Unit C'], series: [{ name: 'Realisasi', data: [12, 9, 7] }] },
};

/** Heatmap: belum ada wajah heatmap di Template Chart → entri baru. */
const widgetHeatmap = {
  id: 'w-heatmap',
  type: 'heatmap',
  title: 'Sebaran Beban Kerja',
  confidence: 'medium',
  grid: { x: 6, y: 0, w: 6, h: 4 },
  chart: { xAxis: ['Jan', 'Feb', 'Mar'], series: [{ name: 'Beban', data: [3, 5, 2] }] },
};

/** Boxplot: belum ada wajahnya di Template Chart → entri baru. */
const widgetBoxplot = {
  id: 'w-boxplot',
  type: 'boxplot',
  title: 'Sebaran Nilai per Unit',
  confidence: 'medium',
  grid: { x: 6, y: 4, w: 6, h: 3 },
  chart: { xAxis: ['Unit A', 'Unit B'], series: [{ name: 'Sebaran', data: [4, 7] }] },
};

/** Peta tanpa data geo: tidak ada chart peta di katalog → entri baru (teks). */
const widgetPeta = {
  id: 'w-peta',
  type: 'map',
  title: 'Sebaran Wilayah',
  confidence: 'low',
  grid: { x: 0, y: 4, w: 6, h: 3 },
};

const dasarDikenal = (id) =>
  typeof id === 'string' && id.length > 0 && !id.startsWith('kustom-');

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const dirData = fs.mkdtempSync(path.join(os.tmpdir(), 'aiones-chart-'));
  fs.writeFileSync(path.join(dirData, 'db.json'), JSON.stringify({ users: [], permintaanData: [], alertRules: [] }));
  console.log('[probe] data sementara:', dirData);

  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HONOR_SHELL_ENV: '1', PORT: String(PORT), NODE_ENV: 'production',
      AIONESBOARD_DATA_DIR: dirData, DEMO_PASSWORD: SANDI,
      BACKUP_OTOMATIS: '0', CONFIG_REFRESH_SECONDS: '0',
      MYSQL_HOST: '127.0.0.1', MYSQL_PORT: '3307', MYSQL_DATABASE: 'aiones_chart',
      SMTP_HOST: '', S3_BUCKET: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => (log += d.toString()));
  server.stderr.on('data', (d) => (log += d.toString()));

  let browser;
  try {
    const batas = Date.now() + 90_000;
    let siap = false;
    while (Date.now() < batas) {
      try {
        const r = await fetch(`${BASE}/health`);
        if (r.ok && (await r.json()).status === 'ok') { siap = true; break; }
      } catch { /* belum */ }
      await tunggu(500);
    }
    if (!siap) throw new Error('server tidak sehat');

    const sesi = await loginApi(EMAIL_ADMIN, SANDI);
    browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
    const { page, galatKonsol } = await siapkanHalaman(browser, sesi);

    let idDash = null;
    let widgets = [];

    await probe('01-admin-buat-dashboard', async () => {
      const r = await api(page, 'POST', '/api/dashboards', {
        title: 'Uji Chart dari Template',
        widgets: [widgetBawaan, widgetHeatmap, widgetBoxplot, widgetPeta],
      });
      const d = r.json?.dashboard || r.json;
      idDash = d?.id || null;
      widgets = d?.widgets || [];
      return {
        ok: (r.status === 200 || r.status === 201) && !!idDash && widgets.length === 4,
        ket: `HTTP ${r.status} · dashboard=${idDash} · widget=${widgets.length}`,
      };
    });

    await probe('02-chart-bawaan-tidak-diubah', async () => {
      const w = widgets.find((x) => x.id === 'w-bawaan');
      return { ok: w?.chartId === 'bar-tegak-sorot' && !w?.chartDasar, ket: `chartId=${w?.chartId} · chartDasar=${w?.chartDasar}` };
    });

    await probe('03-heatmap-pakai-template-yang-sudah-ada', async () => {
      // Peta panas SUDAH ada di Template Chart: wajib dipakai, bukan dibuat baru.
      const w = widgets.find((x) => x.id === 'w-heatmap');
      return { ok: w?.chartId === 'peta-panas' && !w?.chartDasar, ket: `chartId=${w?.chartId} · chartDasar=${w?.chartDasar}` };
    });

    await probe('04-boxplot-dibuatkan-entri-template', async () => {
      const w = widgets.find((x) => x.id === 'w-boxplot');
      return {
        ok: String(w?.chartId || '').startsWith('kustom-') && dasarDikenal(w?.chartDasar),
        ket: `chartId=${w?.chartId} · chartDasar=${w?.chartDasar}`,
      };
    });

    await probe('05-peta-dibuatkan-entri-template', async () => {
      const w = widgets.find((x) => x.id === 'w-peta');
      return {
        ok: String(w?.chartId || '').startsWith('kustom-') && dasarDikenal(w?.chartDasar),
        ket: `chartId=${w?.chartId} · chartDasar=${w?.chartDasar}`,
      };
    });

    await probe('06-entri-muncul-di-katalog', async () => {
      const r = await api(page, 'GET', '/api/chart/kustom');
      const daftar = Array.isArray(r.json) ? r.json : [];
      const semuaDasar = daftar.every((k) => dasarDikenal(k.dasar));
      const semuaAda = [widgets.find((x) => x.id === 'w-boxplot')?.chartId, widgets.find((x) => x.id === 'w-peta')?.chartId]
        .every((id) => daftar.some((k) => k.id === id));
      return { ok: r.status === 200 && daftar.length === 2 && semuaDasar && semuaAda, ket: `HTTP ${r.status} · entri=${daftar.length} · ${daftar.map((k) => k.id).join(' , ')}` };
    });

    await probe('07-bentuk-sama-tidak-duplikat', async () => {
      const r = await api(page, 'POST', '/api/dashboards', {
        title: 'Uji Chart dari Template (2)',
        widgets: [{ ...widgetBoxplot, id: 'w-boxplot-2' }, { ...widgetPeta, id: 'w-peta-2' }],
      });
      const d = r.json?.dashboard || r.json;
      const sesudah = await api(page, 'GET', '/api/chart/kustom');
      const daftar = Array.isArray(sesudah.json) ? sesudah.json : [];
      const samaId =
        (d?.widgets || []).find((x) => x.id === 'w-boxplot-2')?.chartId === widgets.find((x) => x.id === 'w-boxplot')?.chartId;
      return { ok: daftar.length === 2 && samaId, ket: `entri=${daftar.length} · chartId sama=${samaId}` };
    });

    await probe('08-tersimpan-di-dashboard', async () => {
      const r = await api(page, 'GET', `/api/dashboards/${idDash}`);
      const d = r.json?.dashboard || r.json;
      const w = (d?.widgets || []).find((x) => x.id === 'w-boxplot');
      return { ok: r.status === 200 && String(w?.chartId || '').startsWith('kustom-'), ket: `HTTP ${r.status} · chartId=${w?.chartId}` };
    });

    await probe('09-tercatat-di-audit', async () => {
      const r = await api(page, 'GET', '/api/audit-logs');
      const daftar = Array.isArray(r.json) ? r.json : (r.json?.items || r.json?.logs || []);
      const ada = daftar.filter((l) => String(l.action || '').includes('Tambah Chart Template'));
      return { ok: ada.length >= 2, ket: `HTTP ${r.status} · baris audit=${ada.length}` };
    });

    await probe('10-layar-template-chart', async () => {
      await page.goto(`${BASE}/#/v/charts`, { waitUntil: 'networkidle2', timeout: 60_000 });
      await page.reload({ waitUntil: 'networkidle2', timeout: 60_000 });
      await tunggu(2200);
      const ada = await page.evaluate(() => {
        const s = document.querySelector('[data-testid="chart-kustom"]');
        if (!s) return { ada: false, kartu: 0, judul: '' };
        return {
          ada: true,
          kartu: s.querySelectorAll('[data-testid^="chart-kustom-kustom-"]').length,
          judul: (s.innerText || '').split('\n').slice(0, 2).join(' | '),
        };
      });
      // Bukti harus TERLIHAT: gulir bagian itu ke tengah layar sebelum memotret.
      const bagian = await page.$('[data-testid="chart-kustom"]');
      if (bagian) {
        await page.evaluate((el) => el.scrollIntoView({ block: 'center' }), bagian);
        await tunggu(700);
        await bagian.screenshot({ path: path.join(OUT, '01-template-chart-kustom.png') });
      } else {
        await page.screenshot({ path: path.join(OUT, '01-template-chart-kustom.png') });
      }
      const teks = await page.evaluate(() => (document.body.innerText || '').slice(0, 200).split(/\s+/).join(' '));
      return {
        ok: ada.ada && ada.kartu === 2,
        ket: `bagian=${ada.ada} · kartu=${ada.kartu} · ${ada.judul} · layar="${teks}" · galat=${galatKonsol.slice(-2).join(' ;; ')}`,
      };
    });

    await probe('11-kanvas-menggambar-kartu', async () => {
      await page.goto(`${BASE}/#/v/dashboards/d/${idDash}`, { waitUntil: 'networkidle2', timeout: 60_000 });
      await page.reload({ waitUntil: 'networkidle2', timeout: 60_000 });
      await tunggu(2600);
      const kanvas = await page.evaluate(() => {
        const kartu = Array.from(document.querySelectorAll('[data-widget-id]'));
        const kosong = kartu.filter((k) => (k.innerText || '').trim().length === 0).length;
        return { jumlah: kartu.length, kosong, teks: kartu.map((k) => (k.innerText || '').split('\n')[0]).slice(0, 5) };
      });
      await page.screenshot({ path: path.join(OUT, '02-kanvas-chart-kustom.png'), fullPage: false });
      return {
        ok: kanvas.jumlah >= 4 && kanvas.kosong === 0 && galatKonsol.length === 0,
        ket: `kartu=${kanvas.jumlah} · kosong=${kanvas.kosong} · galatKonsol=${galatKonsol.length} · ${kanvas.teks.join(' / ')}`,
      };
    });
  } catch (e) {
    catat('fatal', false, e.message + '\n' + log.slice(-1200));
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill();
    const lulus = hasil.filter((h) => h.ok).length;
    console.log(`\n[probe] ${lulus}/${hasil.length} lulus · artefak: ${OUT}`);
    fs.writeFileSync(path.join(OUT, 'hasil.json'), JSON.stringify({ hasil, log: log.slice(-4000) }, null, 2));
    process.exit(lulus === hasil.length ? 0 : 1);
  }
}

main();
