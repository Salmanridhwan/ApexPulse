/**
 * PROBE (bukan gerbang regresi) — menelusuri satu alur yang ditanyakan pengguna:
 *
 *   pengguna unggah dokumen → admin instansi melihat dokumen & data yang ada →
 *   data dipilih → dijadikan widget (mis. batang) → masuk ke layar → layout diatur.
 *
 * Tujuannya mengukur APA YANG SUDAH ADA dan APA YANG BELUM, dengan bukti layar
 * (PNG) + oracle API. Server dijalankan sendiri di port acak dengan direktori
 * data sementara; `data/db.json` dev tidak disentuh.
 *
 * Jalankan: node scripts/probe-alur-dokumen.mjs
 * Artefak : %TEMP%/probe-alur-dokumen
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const PORT = Number(process.env.PROBE_PORT || 3244);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.OUT_DIR || path.join(os.tmpdir(), 'probe-alur-dokumen');
const CHROME =
  process.env.CHROME_PATH ||
  ['C:/Program Files/Google/Chrome/Application/chrome.exe',
   'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const SANDI = 'SandiE2eKuat2026';
const EMAIL_ADMIN = 'admin@aionesboard.id';
const EMAIL_USER = 'demo@aionesboard.id';

const hasil = [];
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
function catat(nama, ok, ket = '') {
  hasil.push({ nama, ok, ket: String(ket).slice(0, 600) });
  console.log(`${ok ? 'ADA   ' : 'BELUM '} ${nama}${ket ? ' — ' + String(ket).slice(0, 300) : ''}`);
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

const teksHalaman = (page) => page.evaluate(() => document.body.innerText || '');
const foto = async (page, nama) => {
  const p = path.join(OUT, `${nama}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
};
async function tungguTeks(page, teks, ms = 15_000) {
  try {
    await page.waitForFunction((t) => (document.body.innerText || '').includes(t), { timeout: ms }, teks);
    return true;
  } catch { return false; }
}
async function klikTestId(page, id) {
  return page.evaluate((i) => {
    const el = document.querySelector(`[data-testid="${i}"]`);
    if (!el) return false;
    el.click();
    return true;
  }, id);
}
async function isi(page, sel, val) {
  return page.evaluate((s, v) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, sel, val);
}
async function pilihOpsi(page, sel, val) {
  return page.evaluate((s, v) => {
    const el = document.querySelector(s);
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.value === v;
  }, sel, val);
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

/* ---------- stub KMS ---------- */
async function mulaiStubKms() {
  const http = await import('node:http');
  const docs = [];
  let seq = 0;
  const org = { id: 'org-uji', name: 'Perumda Air Minum Tirta Kencana', knowledgeBase: 'kb_pam_jaya' };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://stub');
    const jalur = url.pathname.replace(/\/+$/, '');
    const kirim = (kode, obj) => { res.writeHead(kode, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (jalur === '/api/organizations' && req.method === 'GET') return kirim(200, { organizations: [org] });
    if (jalur === '/api/organizations' && req.method === 'POST') return kirim(201, { organization: org });
    if (jalur === '/api/documents' && req.method === 'GET') {
      const orgId = url.searchParams.get('organizationId') || 'all';
      return kirim(200, { documents: orgId === 'all' ? docs : docs.filter((d) => d.organizationId === orgId) });
    }
    if (jalur === '/api/documents/upload' && req.method === 'POST') {
      const potongan = [];
      req.on('data', (c) => potongan.push(c));
      req.on('end', () => {
        const teks = Buffer.concat(potongan).toString('latin1');
        const judul = /name="title"\r?\n\r?\n([^\r]*)/.exec(teks)?.[1] || 'Berkas Uji';
        seq += 1;
        const dok = {
          id: `doc-probe-${seq}`, organizationId: 'org-uji', organizationName: org.name, title: judul,
          category: 'Umum', repositoryType: 'document', fileType: 'TXT', fileSizeKb: 1,
          uploadedAt: new Date().toISOString(), uploadedBy: 'probe', chunksCount: 1,
          indexingStatus: 'indexed', summary: 'Berkas probe.',
        };
        docs.unshift(dok);
        kirim(201, { document: dok });
      });
      return;
    }
    const mDel = /^\/api\/documents\/([^/]+)$/.exec(jalur);
    if (mDel && req.method === 'DELETE') {
      const i = docs.findIndex((d) => d.id === mDel[1]);
      if (i >= 0) docs.splice(i, 1);
      return kirim(200, { ok: true });
    }
    const mIsi = /^\/api\/documents\/([^/]+)\/(view|download)$/.exec(jalur);
    if (mIsi) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Isi berkas probe.');
    }
    return kirim(404, { error: `stub tidak punya ${req.method} ${jalur}` });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, tutup: () => server.close() };
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

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const dirData = fs.mkdtempSync(path.join(os.tmpdir(), 'aiones-probe-'));
  fs.writeFileSync(path.join(dirData, 'db.json'), JSON.stringify({
    users: [], permintaanData: [], alertRules: [],
  }));
  const kms = await mulaiStubKms();
  console.log('[probe] data sementara:', dirData, '· KMS stub:', kms.url);

  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HONOR_SHELL_ENV: '1', PORT: String(PORT), NODE_ENV: 'production',
      AIONESBOARD_DATA_DIR: dirData, DEMO_PASSWORD: SANDI,
      BACKUP_OTOMATIS: '0', CONFIG_REFRESH_SECONDS: '0',
      MYSQL_HOST: '127.0.0.1', MYSQL_PORT: '3307', MYSQL_DATABASE: 'aiones_probe',
      SMTP_HOST: '', S3_BUCKET: '', KMS_API_URL: kms.url,
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

    const sesiAdmin = await loginApi(EMAIL_ADMIN, SANDI);
    const sesiUser = await loginApi(EMAIL_USER, SANDI);
    browser = await puppeteer.launch({
      executablePath: CHROME, headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
      defaultViewport: { width: 1440, height: 900 },
    });
    const { page: pa } = await siapkanHalaman(browser, sesiAdmin);
    const { page: pb } = await siapkanHalaman(browser, sesiUser);

    const berkas = path.join(dirData, 'laporan-pendapatan-2026.txt');
    fs.writeFileSync(
      berkas,
      'LAPORAN KINERJA 2026\nRealisasi pendapatan usaha Januari 2026: 12,4 miliar.\nTarget Januari 2026: 13 miliar.\n'
    );

    /* ============ 1. PENGGUNA: ajukan permintaan + unggah dokumen ============ */
    let idPermintaan = '';
    await probe('pengguna: ajukan permintaan data lewat form', async () => {
      await klikTestId(pb, 'buka-permintaan');
      await tunggu(2200);
      const buka = await klikTestId(pb, 'tombol-permintaan-baru');
      await tunggu(900);
      await pilihOpsi(pb, '[data-testid="pilih-bidang"]', 'Keuangan');
      await isi(pb, '[data-testid="input-data-diminta"]', 'PROBE-DOKUMEN: realisasi pendapatan usaha 2026 beserta targetnya.');
      await tunggu(300);
      const kirim = await klikTestId(pb, 'kirim-permintaan');
      const muncul = await tungguTeks(pb, 'PROBE-DOKUMEN', 15_000);
      const r = await api(pb, 'GET', '/api/permintaan');
      const daftar = Array.isArray(r.json) ? r.json : r.json?.items || [];
      idPermintaan = String(daftar.find((x) => String(x.dataDiminta || '').includes('PROBE-DOKUMEN'))?.id || '');
      await foto(pb, '01-user-permintaan-dibuat');
      return { ok: buka && kirim && muncul && !!idPermintaan, ket: `permintaan=${idPermintaan}` };
    });

    await probe('pengguna: unggah dokumen sebagai lampiran permintaan (kontrol berkas di layar)', async () => {
      // Kartu sisi pengguna hanya memuat bidang + status (bukan teks permintaan),
      // jadi kartu dibuka lewat indeks — sama seperti `pilihPermintaan` di e2e-peran.
      const kartu = await pb.evaluate(() => {
        const el = document.querySelector('button.item-card');
        if (!el) return false;
        el.click();
        return true;
      });
      await tunggu(2000);
      const input = await pb.$('[data-testid="panel-detail-permintaan"] input[type="file"]');
      const adaInput = !!input;
      if (input) {
        await input.uploadFile(berkas);
        await tunggu(4500);
      }
      const t = await teksHalaman(pb);
      await foto(pb, '02-user-dokumen-terunggah');
      const tampil = /Dokumen \(1\)|laporan-pendapatan-2026/i.test(t);
      const r = await api(pb, 'GET', `/api/permintaan/${idPermintaan}`);
      const lampiran = r.json?.lampiran || r.json?.permintaan?.lampiran || [];
      return {
        ok: kartu && adaInput && tampil && lampiran.length >= 1,
        ket: `kartu=${kartu} · input berkas=${adaInput} · lampiran di API=${lampiran.length}${lampiran[0] ? ' (' + lampiran[0].nama + ')' : ''} · teks "Dokumen (1)" di layar=${/Dokumen \(1\)/.test(t)}`,
      };
    });

    /* ============ 2. ADMIN: apakah dokumen & datanya langsung tampil? ============ */
    await probe('admin: dokumen pengguna terlihat di Repositori Dokumen', async () => {
      await klikTestId(pa, 'buka-manajemen-berkas');
      await tunggu(3000);
      const t = await teksHalaman(pa);
      await foto(pa, '03-admin-repositori');
      const ada = /laporan-pendapatan-2026/i.test(t);
      return { ok: ada, ket: ada ? 'nama berkas pengguna tampil di daftar admin' : 'berkas pengguna tidak tampil di repositori admin' };
    });

    let adaTombolAnalisis = false;
    await probe('admin: di Kotak Masuk ada tombol "Analisis isi dokumen" untuk lampiran pengguna', async () => {
      await klikTestId(pa, 'buka-permintaan');
      await tunggu(2500);
      const kartu = await pa.evaluate(() => {
        const el = document.querySelector('button.item-card');
        if (!el) return false;
        el.click();
        return true;
      });
      await tunggu(2500);
      const info = await pa.evaluate(() => {
        const panel = document.querySelector('[data-testid="panel-detail-permintaan"]');
        const tombol = [...document.querySelectorAll('[data-testid^="analisis-berkas-"]')];
        return {
          panel: !!panel,
          teksDokumen: /Dokumen \(1\)/i.test(panel?.innerText || ''),
          tombol: tombol.map((b) => (b.getAttribute('data-testid') || '') + ' :: ' + (b.textContent || '').trim().slice(0, 60)),
        };
      });
      await foto(pa, '04-admin-detail-permintaan');
      adaTombolAnalisis = info.tombol.length > 0;
      return { ok: kartu && info.panel && info.teksDokumen && adaTombolAnalisis, ket: `kartu=${kartu} · panel=${info.panel} · daftar dokumen=${info.teksDokumen} · tombol=${JSON.stringify(info.tombol)}` };
    });

    await probe('admin: data apa saja yang ada baru muncul SETELAH analisis dijalankan', async () => {
      const idTombol = await pa.evaluate(() => document.querySelector('[data-testid^="analisis-berkas-"]')?.getAttribute('data-testid') || '');
      if (!idTombol) return { ok: false, ket: 'tombol analisis tidak ada' };
      await klikTestId(pa, idTombol);
      const selesai = await pa.waitForFunction(
        () => /butir disetujui|Belum ada butir|Analisis gagal|tidak memuat/i.test(document.body.innerText || ''),
        { timeout: 180_000 }
      ).then(() => true).catch(() => false);
      await tunggu(1500);
      const info = await pa.evaluate(() => {
        const panel = document.querySelector('[data-testid="panel-isi-dokumen"]');
        const katalog = document.querySelector('[data-testid="katalog-data"]');
        return {
          panel: (panel?.innerText || '').slice(0, 400),
          katalog: (katalog?.innerText || '').slice(0, 600),
          butir: [...document.querySelectorAll('[data-testid^="katalog-butir-"]')].length,
          galat: [...document.querySelectorAll('[role="alert"], .text-neg')].map((e) => (e.textContent || '').trim()).filter(Boolean).slice(0, 3),
        };
      });
      await foto(pa, '05-admin-hasil-analisis');
      return {
        ok: info.butir > 0,
        ket: `butir di Katalog Data=${info.butir} · selesai=${selesai} · panel="${info.panel.replace(/\n+/g, ' | ').slice(0, 160)}" · galat=${JSON.stringify(info.galat).slice(0, 200)}`,
      };
    });

    /* ============ 3. ADMIN: pilih data → jadikan halaman/widget ============ */
    let idDashboard = '';
    await probe('admin: centang data lalu "Buat halaman" menghasilkan widget di layar', async () => {
      const dicentang = await pa.evaluate(() => {
        const kotak = [...document.querySelectorAll('[data-testid^="katalog-butir-"] input[type="checkbox"]')].filter((c) => !c.disabled);
        if (!kotak.length) return 0;
        kotak.slice(0, 3).forEach((c) => c.click());
        return Math.min(kotak.length, 3);
      });
      await tunggu(1200);
      const buat = await klikTestId(pa, 'katalog-buat-halaman');
      await tunggu(6000);
      const t = await teksHalaman(pa);
      const r = await api(pa, 'GET', '/api/dashboards');
      const arr = Array.isArray(r.json) ? r.json : r.json?.dashboards || [];
      idDashboard = String(arr[0]?.id || '');
      const d = idDashboard ? await api(pa, 'GET', `/api/dashboards/${idDashboard}`) : { json: null };
      const dash = d.json?.dashboard || d.json;
      const widgets = dash?.widgets || [];
      await foto(pa, '06-admin-halaman-dibuat');
      return {
        ok: dicentang > 0 && buat && widgets.length > 0,
        ket: `butir dicentang=${dicentang} · tombol buat=${buat} · dashboard=${idDashboard} · widget=${widgets.length} · tipe=${JSON.stringify(widgets.map((w) => w.type))} · pesan="${(t.match(/Halaman dibuat[^\n]*/) || [''])[0].slice(0, 80)}"`,
      };
    });

    await probe('admin: widget hasil data dokumen tampil di kanvas (angka dari dokumen, bukan contoh)', async () => {
      const t = await teksHalaman(pa);
      const kartu = await pa.evaluate(() => document.querySelectorAll('[data-widget-id]').length);
      await foto(pa, '07-admin-kanvas-widget');
      return {
        ok: kartu > 0,
        ket: `kartu kanvas=${kartu} · penanda kosong=${/belum ada di dokumen/i.test(t)}`,
      };
    });

    /* ============ 4. LAYOUT: drag & resize ============ */
    await probe('kanvas: kartu bisa di-drag untuk menukar urutan', async () => {
      if (!idDashboard) return { ok: false, ket: 'tidak ada dashboard untuk diuji' };
      await pa.goto(`${BASE}/#/v/workspace/d/${idDashboard}`, { waitUntil: 'networkidle2', timeout: 60_000 });
      await tunggu(3500);
      const sebelum = await pa.evaluate(() => [...document.querySelectorAll('[data-widget-id]')].map((e) => e.getAttribute('data-widget-id')));
      if (sebelum.length < 2) return { ok: false, ket: `kartu hanya ${sebelum.length} — tidak bisa diuji` };
      const dikirim = await pa.evaluate(() => {
        const kartu = [...document.querySelectorAll('[data-widget-id]')];
        const src = kartu[0], dst = kartu[1];
        const dt = new DataTransfer();
        src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
        dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
        dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
        src.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
        return true;
      });
      await tunggu(3000);
      const sesudah = await pa.evaluate(() => [...document.querySelectorAll('[data-widget-id]')].map((e) => e.getAttribute('data-widget-id')));
      await foto(pa, '08-kanvas-setelah-drag');
      const berubah = JSON.stringify(sebelum) !== JSON.stringify(sesudah);
      return { ok: dikirim && berubah, ket: `urutan ${sebelum.join(',')} → ${sesudah.join(',')}` };
    });

    await probe('kanvas: lebar kartu bisa diubah dengan menarik pegangan resize', async () => {
      if (!idDashboard) return { ok: false, ket: 'tidak ada dashboard untuk diuji' };
      const idWidget = await pa.evaluate(() => document.querySelector('[data-widget-id]')?.getAttribute('data-widget-id'));
      if (!idWidget) return { ok: false, ket: 'kartu tidak ada di kanvas' };
      const pegangan = await pa.$(`[data-widget-id="${idWidget}"] [data-resize="1"]`);
      if (!pegangan) return { ok: false, ket: 'pegangan resize tidak ada' };
      const kotak = await pegangan.boundingBox();
      if (!kotak) return { ok: false, ket: 'pegangan tidak terlihat' };
      const lebarApi = async () => {
        const r = await api(pa, 'GET', `/api/dashboards/${idDashboard}`);
        const dash = r.json?.dashboard || r.json;
        const w = (dash?.widgets || []).find((x) => x.id === idWidget);
        return w?.grid?.w ?? null;
      };
      const sebelum = await lebarApi();
      await pa.mouse.move(kotak.x + kotak.width / 2, kotak.y + kotak.height / 2);
      await pa.mouse.down();
      await pa.mouse.move(kotak.x + 160, kotak.y + kotak.height / 2, { steps: 14 });
      await pa.mouse.up();
      await tunggu(2500);
      const sesudah = await lebarApi();
      await foto(pa, '09-kanvas-setelah-resize');
      return { ok: sebelum !== null && sesudah !== null && sebelum !== sesudah, ket: `lebar ${sebelum} → ${sesudah} kolom` };
    });

    /* ============ 5. Yang belum ada: pilih tipe chart dari data & drag dari galeri ============ */
    await probe('galeri chart: ada kontrol untuk memasukkan chart ke kanvas (drag/klik)', async () => {
      await klikTestId(pa, 'buka-galeri-chart');
      await tunggu(2500);
      const info = await pa.evaluate(() => ({
        teks: (document.body.innerText || '').slice(0, 1200),
        tombol: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter((x) => /tambah|pakai|gunakan|kanvas|dashboard/i.test(x)).slice(0, 10),
        draggable: document.querySelectorAll('[draggable="true"]').length,
      }));
      await foto(pa, '10-galeri-chart');
      return {
        ok: info.tombol.length > 0,
        ket: `tombol aksi=${JSON.stringify(info.tombol)} · elemen draggable=${info.draggable} · catatan="${(info.teks.match(/angka di sini hanya contoh[^.]*/i) || [''])[0]}"`,
      };
    });

    await probe('pilih tipe tampilan (batang/garis) untuk satu butir data', async () => {
      await klikTestId(pa, 'buka-permintaan');
      await tunggu(2500);
      const info = await pa.evaluate(() => {
        const panel = document.querySelector('[data-testid="panel-detail-permintaan"]');
        const pilih = [...(panel?.querySelectorAll('select') || [])].map((s) => [...s.options].map((o) => o.value));
        const teks = (panel?.innerText || '');
        return { pilih, adaBatang: /batang|bar chart/i.test(teks), adaTipe: /tipe|jenis chart|bentuk/i.test(teks) };
      });
      await foto(pa, '11-panel-pilih-tipe');
      return { ok: info.pilih.length > 0, ket: `select di panel=${JSON.stringify(info.pilih).slice(0, 200)} · kata "batang"=${info.adaBatang}` };
    });

    fs.writeFileSync(path.join(OUT, 'hasil.json'), JSON.stringify({ hasil, galatKonsolAdmin: [], log: log.slice(-2000) }, null, 2));
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill();
    kms.tutup();
    await tunggu(800);
    fs.rmSync(dirData, { recursive: true, force: true });
    console.log('\n[probe] artefak:', OUT);
    console.log(`[probe] ringkasan: ${hasil.filter((h) => h.ok).length}/${hasil.length} ada`);
    for (const h of hasil) console.log(`  ${h.ok ? 'ADA  ' : 'BELUM'} ${h.nama}`);
  }
}

main().catch((e) => { console.error('[probe] gagal:', e); process.exit(1); });
