/**
 * PROBE — TIGA WAJAH CHART BARU DI TEMPLATE CHART.
 *
 * Bukti yang dikumpulkan (lewat layar + API yang sama dengan UI):
 *
 * 1. Widget bertipe peta, gantt, dan boxplot memakai wajah BARU yang terdaftar di
 *    Template Chart (`peta-wilayah`, `jadwal-gantt`, `kotak-sebaran`) — bukan
 *    entri sementara dan bukan chart di luar katalog.
 * 2. Heatmap tetap memakai wajah yang sudah ada (`peta-panas`), chart bawaan
 *    tidak diubah.
 * 3. Tipe yang belum ada di katalog (simulasi tipe masa depan) tetap dibuatkan
 *    entri Template Chart baru → aturan "selalu dari Template Chart" tidak bocor.
 * 4. Halaman Template Chart benar-benar MENGGAMBAR ketiga kartu baru itu
 *    (ada grafik, bukan kotak kosong) — dibuktikan dengan tangkapan layar.
 * 5. Kanvas dashboard menggambar semua kartu tanpa isi kosong dan tanpa galat
 *    konsol.
 *
 * Jalankan: node scripts/probe-chart-wajah-baru.mjs
 * Artefak : %TEMP%/probe-chart-wajah-baru
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const PORT = Number(process.env.PROBE_PORT || 3248);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.OUT_DIR || path.join(os.tmpdir(), 'probe-chart-wajah-baru');
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
  page.on('pageerror', (e) => galatKonsol.push('pageerror: ' + String(e.stack || e).slice(0, 900)));
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

/* ---------- contoh widget (bentuk data nyata, bukan angka karangan) ---------- */

const widgetBawaan = {
  id: 'w-bawaan', type: 'bar', chartId: 'bar-tegak-sorot', title: 'Realisasi per Unit',
  confidence: 'high', grid: { x: 0, y: 0, w: 6, h: 4 },
  chart: { xAxis: ['Unit A', 'Unit B', 'Unit C'], series: [{ name: 'Realisasi', data: [12, 9, 7] }] },
};

const widgetHeatmap = {
  id: 'w-heatmap', type: 'heatmap', title: 'Sebaran Beban Kerja',
  confidence: 'medium', grid: { x: 6, y: 0, w: 6, h: 4 },
  chart: { xAxis: ['Jan', 'Feb', 'Mar'], series: [{ name: 'Beban', data: [3, 5, 2] }] },
};

const widgetPeta = {
  id: 'w-peta', type: 'map', title: 'Pelanggan per Wilayah',
  confidence: 'high', grid: { x: 0, y: 4, w: 6, h: 4 },
  geo: {
    mapName: 'indonesia',
    unit: 'pelanggan',
    regions: [
      { name: 'DKI Jakarta', value: 208360 },
      { name: 'Jawa Barat', value: 412880 },
      { name: 'Jawa Tengah', value: 318440 },
      { name: 'Jawa Timur', value: 502110 },
      { name: 'Banten', value: 176220 },
      { name: 'Sumatera Utara', value: 289740 },
    ],
  },
};

const widgetGantt = {
  id: 'w-gantt', type: 'gantt', title: 'Jadwal Pemasangan',
  confidence: 'medium', grid: { x: 6, y: 4, w: 6, h: 4 },
  gantt: {
    tasks: [
      { name: 'Survei lokasi', start: '2026-01-06', end: '2026-01-24', progress: 100 },
      { name: 'Desain jaringan', start: '2026-01-20', end: '2026-02-18', progress: 80 },
      { name: 'Pengadaan pipa', start: '2026-02-10', end: '2026-03-20', progress: 45 },
      { name: 'Pemasangan', start: '2026-03-16', end: '2026-05-08', progress: 20 },
    ],
  },
};

const widgetKotak = {
  id: 'w-kotak', type: 'boxplot', title: 'Sebaran Tekanan',
  confidence: 'medium', grid: { x: 0, y: 8, w: 6, h: 3 },
  chart: {
    xAxis: ['Zona 1', 'Zona 2', 'Zona 3'],
    unit: 'bar',
    series: [{ name: 'Tekanan', data: [1.9, 2.5, 2.1] }],
    boxRaw: [
      [1.2, 1.5, 1.8, 1.9, 2.1, 2.3, 2.6],
      [1.9, 2.2, 2.4, 2.5, 2.7, 2.8, 3.1],
      [1.4, 1.7, 1.9, 2.1, 2.3, 2.5, 2.9],
    ],
  },
};

/** Simulasi tipe yang belum ada di katalog: gerbang harus tetap menutup celah. */
const widgetMasaDepan = {
  id: 'w-masa-depan', type: 'donut-3d', title: 'Tipe Belum Ada',
  confidence: 'low', grid: { x: 6, y: 8, w: 6, h: 3 },
};

const NAMA_KARTU = {
  'peta-wilayah': 'Peta wilayah',
  'jadwal-gantt': 'Jadwal kegiatan (gantt)',
  'kotak-sebaran': 'Kotak sebaran (boxplot)',
};

const dasarDikenal = (id) => typeof id === 'string' && id.length > 0 && !id.startsWith('kustom-');

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const dirData = fs.mkdtempSync(path.join(os.tmpdir(), 'aiones-wajah-'));
  fs.writeFileSync(path.join(dirData, 'db.json'), JSON.stringify({ users: [], permintaanData: [], alertRules: [] }));
  console.log('[probe] data sementara:', dirData);

  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HONOR_SHELL_ENV: '1', PORT: String(PORT), NODE_ENV: 'production',
      AIONESBOARD_DATA_DIR: dirData, DEMO_PASSWORD: SANDI,
      BACKUP_OTOMATIS: '0', CONFIG_REFRESH_SECONDS: '0',
      MYSQL_HOST: '127.0.0.1', MYSQL_PORT: '3307', MYSQL_DATABASE: 'aiones_wajah',
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
        title: 'Uji Wajah Chart Baru',
        widgets: [widgetBawaan, widgetHeatmap, widgetPeta, widgetGantt, widgetKotak, widgetMasaDepan],
      });
      const d = r.json?.dashboard || r.json;
      idDash = d?.id || null;
      widgets = d?.widgets || [];
      return {
        ok: (r.status === 200 || r.status === 201) && !!idDash && widgets.length === 6,
        ket: `HTTP ${r.status} · dashboard=${idDash} · widget=${widgets.length}`,
      };
    });

    const cekChart = (id, harap) => {
      const w = widgets.find((x) => x.id === id);
      return { ok: w?.chartId === harap && !w?.chartDasar, ket: `chartId=${w?.chartId} · harap=${harap} · chartDasar=${w?.chartDasar}` };
    };

    await probe('02-chart-bawaan-tidak-diubah', () => cekChart('w-bawaan', 'bar-tegak-sorot'));
    await probe('03-heatmap-pakai-peta-panas', () => cekChart('w-heatmap', 'peta-panas'));
    await probe('04-peta-pakai-peta-wilayah', () => cekChart('w-peta', 'peta-wilayah'));
    await probe('05-gantt-pakai-jadwal-gantt', () => cekChart('w-gantt', 'jadwal-gantt'));
    await probe('06-boxplot-pakai-kotak-sebaran', () => cekChart('w-kotak', 'kotak-sebaran'));

    await probe('07-tipe-tanpa-wajah-dibuatkan-entri', async () => {
      const w = widgets.find((x) => x.id === 'w-masa-depan');
      return {
        ok: String(w?.chartId || '').startsWith('kustom-') && dasarDikenal(w?.chartDasar),
        ket: `chartId=${w?.chartId} · chartDasar=${w?.chartDasar}`,
      };
    });

    await probe('08-entri-kustom-muncul-di-katalog', async () => {
      const r = await api(page, 'GET', '/api/chart/kustom');
      const daftar = Array.isArray(r.json) ? r.json : [];
      const cocok = daftar.some((k) => k.id === widgets.find((x) => x.id === 'w-masa-depan')?.chartId);
      return { ok: r.status === 200 && daftar.length === 1 && cocok, ket: `HTTP ${r.status} · entri=${daftar.length}` };
    });

    await probe('09-bentuk-sama-tidak-duplikat', async () => {
      const r = await api(page, 'POST', '/api/dashboards', {
        title: 'Uji Wajah Chart Baru (2)',
        widgets: [{ ...widgetMasaDepan, id: 'w-masa-depan-2' }],
      });
      const d = r.json?.dashboard || r.json;
      const sesudah = await api(page, 'GET', '/api/chart/kustom');
      const daftar = Array.isArray(sesudah.json) ? sesudah.json : [];
      const samaId =
        (d?.widgets || []).find((x) => x.id === 'w-masa-depan-2')?.chartId ===
        widgets.find((x) => x.id === 'w-masa-depan')?.chartId;
      return { ok: daftar.length === 1 && samaId, ket: `entri=${daftar.length} · chartId sama=${samaId}` };
    });

    await probe('10-template-chart-menggambar-tiga-kartu-baru', async () => {
      await page.goto(`${BASE}/#/v/charts`, { waitUntil: 'networkidle2', timeout: 60_000 });
      await page.reload({ waitUntil: 'networkidle2', timeout: 60_000 });
      await tunggu(3000);
      const cek = [];
      for (const id of Object.keys(NAMA_KARTU)) {
        const info = await page.evaluate((nama) => {
          const judul = Array.from(document.querySelectorAll('p')).find((p) => (p.textContent || '').trim() === nama);
          const kartu = judul ? judul.closest('div.rounded-card') : null;
          if (!kartu) return { ada: false, grafik: false };
          return { ada: true, grafik: Boolean(kartu.querySelector('svg, canvas')) };
        }, NAMA_KARTU[id]);
        cek.push({ id, ...info });
        if (info.ada) {
          const el = await page.evaluateHandle((nama) => {
            const judul = Array.from(document.querySelectorAll('p')).find((p) => (p.textContent || '').trim() === nama);
            return judul ? judul.closest('div.rounded-card') : null;
          }, NAMA_KARTU[id]);
          await page.evaluate((node) => node?.scrollIntoView({ block: 'center' }), el);
          await tunggu(600);
          await el.asElement()?.screenshot({ path: path.join(OUT, `kartu-${id}.png`) }).catch(() => undefined);
        }
      }
      const ok = cek.length === 3 && cek.every((c) => c.ada && c.grafik);
      return { ok, ket: cek.map((c) => `${c.id}: ada=${c.ada} grafik=${c.grafik}`).join(' · ') };
    });

    await probe('11-kanvas-menggambar-semua-kartu', async () => {
      await page.goto(`${BASE}/#/v/dashboards/d/${idDash}`, { waitUntil: 'networkidle2', timeout: 60_000 });
      await page.reload({ waitUntil: 'networkidle2', timeout: 60_000 });
      await tunggu(3200);
      const kanvas = await page.evaluate(() => {
        const kartu = Array.from(document.querySelectorAll('[data-widget-id]'));
        const kosong = kartu.filter((k) => {
          const adaGrafik = k.querySelector('svg, canvas');
          const teks = (k.innerText || '').trim().split('\n').filter((b) => b.trim().length > 0);
          return !adaGrafik && teks.length < 2;
        }).length;
        return { jumlah: kartu.length, kosong };
      });
      await page.screenshot({ path: path.join(OUT, 'kanvas-wajah-baru.png') });
      return {
        ok: kanvas.jumlah >= 6 && kanvas.kosong === 0 && galatKonsol.length === 0,
        ket: `kartu=${kanvas.jumlah} · kosong=${kanvas.kosong} · galatKonsol=${galatKonsol.length} ${galatKonsol.slice(0, 2).join(' ;; ')}`,
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
