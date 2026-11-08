/**
 * Uji E2E dua peran: Admin Instansi (`admin`) dan Pengguna langsung (`pengguna`),
 * termasuk alur yang menghubungkan keduanya (permintaan data, persetujuan
 * pendaftaran, notifikasi, audit) — dasar kontraknya `docs/2026-11-08_fitur-admin-instansi-pengguna.md`.
 *
 * Server dijalankan sendiri di port 3212 dengan direktori data SEMENTARA, akun
 * demo bawaan aplikasi (sandi dari DEMO_PASSWORD), dan stub repositori dokumen
 * (KMS) supaya jalur unggah/lihat/hapus berkas benar-benar teruji tanpa layanan
 * nyata. Sesi disuntik ke browser (cookie + localStorage) — tidak ada sandi yang
 * diketik ke halaman.
 *
 * Isolasi data: `AIONESBOARD_DATA_DIR` = direktori mkdtemp yang dihapus di akhir;
 * `data/db.json` dev tidak dibaca maupun ditulis. Di dalamnya sengaja disemai
 * satu permintaan data + satu aturan ambang batas milik **instansi lain**
 * (`tenant-bank`) sebagai bahan uji isolasi lintas instansi.
 *
 * Jalankan: npm run test:e2e:peran   (atau node scripts/e2e-peran.mjs)
 * Artefak : %TEMP%/peran-artifacts (PNG per langkah + hasil.json)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const PORT = Number(process.env.E2E_PORT || 3212);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.OUT_DIR || path.join(os.tmpdir(), 'peran-artifacts');
const CHROME =
  process.env.CHROME_PATH ||
  ['C:/Program Files/Google/Chrome/Application/chrome.exe',
   'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const SANDI = 'SandiE2eKuat2026';
const EMAIL_ADMIN = 'admin@aionesboard.id';
const EMAIL_USER = 'demo@aionesboard.id';

const langkah = [];
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

function catat(nama, ok, ket = '', temuan = false) {
  langkah.push({ nama, ok, keterangan: String(ket).slice(0, 500), temuan });
  console.log(`${ok ? '  OK   ' : (temuan ? '  TEMUAN' : '  GAGAL')} ${nama}${ket ? ' — ' + String(ket).slice(0, 220) : ''}`);
}

async function cek(nama, fn) {
  try {
    const r = await fn();
    if (r === true || r === undefined) catat(nama, true);
    else if (r && typeof r === 'object' && 'ok' in r) catat(nama, r.ok, r.ket || '', !!r.temuan);
    else catat(nama, !!r, String(r));
  } catch (e) {
    catat(nama, false, e.message);
  }
}

/* ---------- helper halaman ---------- */
const teksHalaman = (page) => page.evaluate(() => document.body.innerText || '');

async function tungguTeks(page, teks, ms = 10_000) {
  try {
    await page.waitForFunction((t) => (document.body.innerText || '').includes(t), { timeout: ms }, teks);
    return true;
  } catch { return false; }
}

async function tungguTestid(page, id, ms = 10_000) {
  try {
    await page.waitForSelector(`[data-testid="${id}"]`, { timeout: ms, visible: true });
    return true;
  } catch { return false; }
}

async function klikTeks(page, teks, tag = 'button') {
  return page.evaluate((t, sel) => {
    const els = [...document.querySelectorAll(sel)];
    const el = els.find((e) => (e.textContent || '').trim().includes(t) && e.offsetParent !== null);
    if (!el) return false;
    el.click();
    return true;
  }, teks, tag);
}

async function klikTestId(page, id) {
  return page.evaluate((i) => {
    const el = document.querySelector(`[data-testid="${i}"]`);
    if (!el) return false;
    el.click();
    return true;
  }, id);
}

async function isi(page, selector, nilai) {
  return page.evaluate((sel, val) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, selector, nilai);
}

async function pilihOpsi(page, selector, nilai) {
  return page.evaluate((sel, val) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(el, val);
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.value === val;
  }, selector, nilai);
}

async function klikDalam(page, teksWadah, selector, wadah = 'tr, .item-card, [role="dialog"]') {
  return page.evaluate((t, sel, wrap) => {
    const box = [...document.querySelectorAll(wrap)].find(
      (e) => (e.textContent || '').includes(t) && e.offsetParent !== null
    );
    if (!box) return false;
    const b = box.querySelector(sel);
    if (!b) return false;
    b.click();
    return true;
  }, teksWadah, selector, wadah);
}

async function foto(page, nama) {
  const p = path.join(OUT, `${nama}.png`);
  await page.screenshot({ path: p });
  return p;
}

/** Buka satu kartu permintaan dari daftar (kartu = `button.item-card`). */
async function pilihPermintaan(page, teks) {
  // Kartu daftar TIDAK memuat `dataDiminta` (PermintaanDataPage.tsx:700-725):
  // sisi pengguna hanya menampilkan bidang + status ("Keuangan · 0 hari lalu"),
  // jadi pencocokan lewat teks kartu selalu gagal. Yang sah adalah isi PANEL
  // DETAIL, jadi kartu diklik satu per satu sampai panelnya memuat teks utuh.
  const cekPanel = () =>
    page.evaluate((t) => {
      const panel = document.querySelector('[data-testid="panel-detail-permintaan"]');
      return !!panel && (panel.textContent || '').includes(t);
    }, teks);

  if (await cekPanel()) return 'sudah-terbuka';

  // Daftar diambil lewat API setelah halaman tampil: tunggu kartu pertama muncul,
  // kalau tidak, loop di bawah berjalan atas daftar kosong dan hasilnya ''.
  await page.waitForSelector('button.item-card', { timeout: 12_000 }).catch(() => {});
  const jumlah = await page.evaluate(() => document.querySelectorAll('button.item-card').length);
  for (let i = 0; i < jumlah; i++) {
    const diklik = await page.evaluate((idx) => {
      const k = document.querySelectorAll('button.item-card')[idx];
      if (!k) return false;
      k.click();
      return true;
    }, i);
    if (!diklik) continue;
    await tunggu(1400);
    if (await cekPanel()) return `kartu#${i + 1}`;
  }
  return '';
}

/**
 * Muat ulang halaman lalu buka lagi daftar permintaan. Dipakai sebelum memilih
 * data yang BARU dibuat peran lain: daftar yang sudah dirender tidak memuatnya,
 * dan tombol "muat ulang" di dalam wadah bisa ikut hilang saat wadah kosong.
 */
async function muatUlangPermintaan(page) {
  await page.reload({ waitUntil: 'networkidle2', timeout: 60_000 }).catch(() => {});
  await tunggu(2200);
  const ada = () => page.evaluate(() => !!document.querySelector('[data-testid="halaman-permintaan"]'));
  if (await ada()) return true;
  await klikTestId(page, 'buka-permintaan');
  await tunggu(2400);
  if (await ada()) return true;
  // Sidebar bisa tertutup di viewport kecil atau klik jatuh saat render ulang:
  // pakai rute hash yang dipakai aplikasi (App.tsx: viewMode 'permintaan').
  await page.evaluate(() => {
    window.location.hash = '#/v/permintaan';
  });
  await tunggu(2600);
  return ada();
}

/** Teks panel detail permintaan — assertion status WAJIB dibatasi ke sini. */
const teksDetail = (page) =>
  page.evaluate(() => document.querySelector('[data-testid="panel-detail-permintaan"]')?.innerText || '');

/** Baris permintaan dari API (oracle status & alasan), dicari lewat teks permintaannya. */
async function cariPermintaan(page, teks) {
  const r = await api(page, 'GET', '/api/permintaan');
  const daftar = Array.isArray(r.json) ? r.json : r.json?.items || [];
  return daftar.find((x) => String(x.dataDiminta || '').includes(teks));
}

async function tungguDaftarBerkas(page, teks, ms = 25_000) {
  try {
    await page.waitForFunction(
      (t) => {
        const baris = [...document.querySelectorAll('[data-testid="baris-berkas"]')];
        const memuat = (document.body.innerText || '').includes('Memuat…');
        return !memuat && baris.some((b) => (b.textContent || '').includes(t));
      },
      { timeout: ms },
      teks
    );
    return true;
  } catch { return false; }
}

/** fetch dari dalam halaman — memakai cookie sesi yang sudah disuntik. */
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

/* ---------- stub repositori dokumen (KMS) ---------- */
async function mulaiStubKms() {
  const http = await import('node:http');
  const docs = [];
  let seq = 0;
  const org = { id: 'org-uji', name: 'Perumda Air Minum Tirta Kencana', knowledgeBase: 'kb_pam_jaya' };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://stub');
    const jalur = url.pathname.replace(/\/+$/, '');
    const kirim = (kode, obj, tipe = 'application/json') => {
      res.writeHead(kode, { 'Content-Type': tipe });
      res.end(tipe === 'application/json' ? JSON.stringify(obj) : obj);
    };
    if (jalur === '/api/organizations' && req.method === 'GET') return kirim(200, { organizations: [org] });
    if (jalur === '/api/organizations' && req.method === 'POST') return kirim(201, { organization: org });
    if (jalur === '/api/documents' && req.method === 'GET') {
      const orgId = url.searchParams.get('organizationId') || 'all';
      const isi = orgId === 'all' ? docs : docs.filter((d) => d.organizationId === orgId);
      return kirim(200, { documents: isi });
    }
    if (jalur === '/api/documents/upload' && req.method === 'POST') {
      const potongan = [];
      req.on('data', (c) => potongan.push(c));
      req.on('end', () => {
        const teks = Buffer.concat(potongan).toString('latin1');
        const judul = /name="title"\r?\n\r?\n([^\r]*)/.exec(teks)?.[1] || 'Berkas Uji';
        const kategori = /name="category"\r?\n\r?\n([^\r]*)/.exec(teks)?.[1] || 'Umum';
        seq += 1;
        const dok = {
          id: `doc-uji-${seq}`,
          organizationId: 'org-uji',
          organizationName: org.name,
          title: judul,
          category: kategori,
          repositoryType: 'document',
          fileType: 'TXT',
          fileSizeKb: 1,
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'uji',
          chunksCount: 1,
          indexingStatus: 'indexed',
          summary: 'Berkas uji E2E.',
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
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `inline; filename="${mIsi[1]}.txt"`,
      });
      return res.end('Isi berkas uji E2E.\nBaris kedua.');
    }
    return kirim(404, { error: `stub tidak punya ${req.method} ${jalur}` });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, tutup: () => server.close() };
}

/* ---------- sesi ---------- */
async function loginApi(email, sandi) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: sandi }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`login ${email} gagal HTTP ${r.status}: ${j.error || ''}`);
  const mentah = (r.headers.getSetCookie?.() ?? [r.headers.get('set-cookie') || '']).join(';');
  const cookie = mentah.split(/,\s*/).map((c) => c.split(';')[0]).filter((c) => c.includes('='));
  return { user: j.user, cookie };
}

async function siapkanHalaman(browser, sesi, label) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const galatKonsol = [];
  const responsGalat = [];
  const jejakDialog = [];
  let abaikan = false;
  page.on('console', (x) => { if (x.type() === 'error' && !abaikan) galatKonsol.push(x.text().slice(0, 200)); });
  page.on('pageerror', (e) => { if (!abaikan) galatKonsol.push('pageerror: ' + String(e).slice(0, 200)); });
  page.on('response', (r) => { if (r.status() >= 400 && !abaikan) responsGalat.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, '')}`); });
  page.on('dialog', (d) => { jejakDialog.push({ tipe: d.type(), pesan: d.message().slice(0, 140) }); d.accept(d.type() === 'prompt' ? '30' : undefined); });
  await page.evaluateOnNewDocument((u) => localStorage.setItem('aionesboard_user', u), JSON.stringify(sesi.user));
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  for (const c of sesi.cookie) {
    const i = c.indexOf('=');
    await page.setCookie({ name: c.slice(0, i), value: c.slice(i + 1), domain: '127.0.0.1', path: '/' });
  }
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60_000 });
  await tunggu(1500);
  return {
    ctx, page, label, galatKonsol, responsGalat, jejakDialog,
    abaikanSementara: (v) => { abaikan = v; },
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const dirData = fs.mkdtempSync(path.join(os.tmpdir(), 'aiones-peran-'));
  // Berkas state minimal wajib ada: tanpa ini seeder akun demo tidak berjalan.
  // Ditambah dua baris milik instansi LAIN sebagai oracle uji isolasi — kalau
  // baris ini muncul di layar admin/pengguna tenant-pdam, berarti kebocoran.
  const sekarang = new Date().toISOString();
  fs.writeFileSync(
    path.join(dirData, 'db.json'),
    JSON.stringify({
      users: [],
      permintaanData: [
        {
          id: 'permintaan-bank-uji',
          tenantId: 'tenant-bank',
          pemohonId: 'user-bank-uji',
          pemohonNama: 'Pemohon Instansi Lain',
          bidang: 'Keuangan',
          dataDiminta: 'RAHASIA-INSTANSI-LAIN: proyeksi likuiditas BPD Artha 2027.',
          prioritas: 'normal',
          status: 'baru',
          lampiran: [],
          catatan: [],
          createdAt: sekarang,
          updatedAt: sekarang,
        },
      ],
      alertRules: [
        // Aturan milik instansi yang diuji: store menimpa daftar bawaan kode
        // dengan isi berkas ini (inMemoryDb.ts:878), jadi aturan tenant-pdam
        // harus ikut ditulis di sini — bukan diandalkan dari seed kode.
        {
          id: 'alert-pdam-uji',
          tenantId: 'tenant-pdam',
          title: 'NRW di atas ambang',
          metricKey: 'nrw',
          metricName: 'NRW',
          operator: '>=',
          threshold: 25,
          unit: '%',
          channels: ['in_app'],
          severity: 'warning',
          isActive: true,
        },
        {
          id: 'alert-bank-uji',
          tenantId: 'tenant-bank',
          title: 'ATURAN-INSTANSI-LAIN: LDR BPD',
          metricKey: 'ldr',
          metricName: 'LDR',
          operator: '>=',
          threshold: 92,
          unit: '%',
          channels: ['in_app'],
          severity: 'warning',
          isActive: true,
        },
      ],
    })
  );
  console.log('[peran] data sementara:', dirData);

  const kms = await mulaiStubKms();
  console.log('[peran] stub KMS:', kms.url);

  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HONOR_SHELL_ENV: '1',
      PORT: String(PORT),
      NODE_ENV: 'production',
      AIONESBOARD_DATA_DIR: dirData,
      DEMO_PASSWORD: SANDI,
      BACKUP_OTOMATIS: '0',
      CONFIG_REFRESH_SECONDS: '0',
      MYSQL_HOST: '127.0.0.1',
      MYSQL_PORT: '3307',
      MYSQL_DATABASE: 'aiones_uji_tidak_dipakai',
      SMTP_HOST: '',
      S3_BUCKET: '',
      KMS_API_URL: kms.url,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logServer = '';
  let kodeKeluarServer = null;
  server.stdout.on('data', (d) => (logServer += d.toString()));
  server.stderr.on('data', (d) => (logServer += d.toString()));
  server.on('exit', (code, signal) => {
    kodeKeluarServer = signal || code;
    logServer += `\n[peran] server keluar: code=${code} signal=${signal}\n`;
  });

  let browser;
  let A;
  let B;
  const berkasUji = path.join(dirData, 'berkas-uji.txt');
  fs.writeFileSync(berkasUji, 'Realisasi pendapatan usaha Januari 2026: 12,4 miliar.\nTarget: 13 miliar.');

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
    if (!siap) throw new Error('server uji tidak pernah sehat');
    catat('server uji hidup', true, `${BASE} · data sementara · KMS stub`);

    const sesiAdmin = await loginApi(EMAIL_ADMIN, SANDI);
    catat('login API admin instansi', sesiAdmin.user?.role === 'admin', `role=${sesiAdmin.user?.role} · tenant=${sesiAdmin.user?.tenantId}`);
    const sesiUser = await loginApi(EMAIL_USER, SANDI);
    catat('login API pengguna', sesiUser.user?.role === 'pengguna', `role=${sesiUser.user?.role}`);

    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
      defaultViewport: { width: 1440, height: 900 },
    });

    A = await siapkanHalaman(browser, sesiAdmin, 'admin');
    B = await siapkanHalaman(browser, sesiUser, 'pengguna');
    const pa = A.page;
    const pb = B.page;

    /* ================= 1. ADMIN INSTANSI: navigasi & panel ================= */
    await cek('admin: sidebar memuat Kotak Masuk, Jejak Audit, dan 3 tab panel', async () => {
      const d = await pa.evaluate(() => ({
        sidebar: (document.querySelector('aside')?.innerText || '').replace(/\n+/g, ' | '),
        tabs: [...document.querySelectorAll('[data-testid^="admin-tab-"]')].map((e) => e.getAttribute('data-testid')),
      }));
      await foto(pa, '01-admin-sidebar');
      const tabSah = ['admin-tab-overview', 'admin-tab-users', 'admin-tab-alerts'];
      const ok = d.sidebar.includes('Kotak Masuk') && d.sidebar.includes('Jejak Audit')
        && tabSah.every((t) => d.tabs.includes(t)) && d.tabs.length === 3;
      return { ok, ket: `tab=${d.tabs.join(',')}` };
    });

    await cek('admin: tab khusus Admin Aiones TIDAK ada di panel', async () => {
      const ada = await pa.evaluate(() => ['rag', 'kuota', 'tenants', 'audit']
        .filter((t) => document.querySelector(`[data-testid="admin-tab-${t}"]`)));
      return { ok: ada.length === 0, ket: ada.length ? 'muncul: ' + ada.join(',') : 'tidak ada tab rag/kuota/tenants/audit' };
    });

    await cek('admin: ringkasan menampilkan kartu angka instansinya', async () => {
      await klikTestId(pa, 'admin-tab-overview');
      await tunggu(1200);
      const t = (await teksHalaman(pa)).toUpperCase();
      await foto(pa, '02-admin-overview');
      const wajib = ['TOTAL BUMD', 'PENGGUNA AKTIF', 'TOTAL DASHBOARD', 'ATURAN AMBANG', 'AKTIVITAS & LOG AUDIT TERAKHIR'];
      const hilang = wajib.filter((w) => !t.includes(w));
      return { ok: hilang.length === 0, ket: hilang.length ? 'tidak ada: ' + hilang.join(', ') : 'semua kartu ada' };
    });

    await cek('admin: tombol "Tambah Instansi BUMD" tidak tampil (khusus Admin Aiones)', async () => {
      const tombol = await pa.evaluate(() =>
        [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter((t) => /Tambah Instansi BUMD/.test(t))
      );
      const r = await api(pa, 'POST', '/api/admin/tenants', { name: 'Uji Ditolak', city: 'Uji' });
      return { ok: tombol.length === 0 && r.status === 403, ket: `tombol=${tombol.length} · POST /api/admin/tenants=${r.status}` };
    });

    await cek('admin: "Lihat Seluruh Log" membuka log audit instansinya', async () => {
      const diklik = await klikTeks(pa, 'Lihat Seluruh Log');
      await tunggu(2500);
      const t = await teksHalaman(pa);
      await foto(pa, '03-admin-lihat-log');
      const ok = diklik && /Log Audit Sistem/i.test(t) && /Ekspor CSV/i.test(t);
      return { ok, ket: ok ? 'halaman log audit instansi terbuka (tab audit tidak perlu ada di daftar tab)' : 'log audit tidak terbuka' };
    });

    await cek('admin: tab Pengguna menampilkan akun instansinya', async () => {
      await klikTestId(pa, 'admin-tab-users');
      await tunggu(1500);
      const t = await teksHalaman(pa);
      await foto(pa, '04-admin-users');
      const ok = t.includes('Manajemen Pengguna') && t.includes('demo@aionesboard.id') && t.includes('Permintaan Bergabung');
      return { ok, ket: ok ? 'tabel + kotak permintaan bergabung tampil' : 'bagian penting tidak tampil' };
    });

    /* ================= 2. ADMIN: kelola akun ================= */
    const emailBaru = `e2e.peran.${Date.now()}@aionesboard.id`;
    await cek('admin: tambah pengguna baru lewat modal', async () => {
      const buka = await klikTeks(pa, 'Tambah Pengguna Baru');
      if (!buka) return { ok: false, ket: 'tombol tidak ditemukan' };
      await tunggu(600);
      await isi(pa, '[role="dialog"] input[type="text"]', 'Pengguna Uji Peran');
      await isi(pa, '[role="dialog"] input[type="email"]', emailBaru);
      await tunggu(200);
      const kirim = await klikTeks(pa, 'Daftarkan Pengguna');
      const muncul = await tungguTeks(pa, 'Pengguna Uji Peran', 12_000);
      await foto(pa, '05-admin-tambah-pengguna');
      return { ok: kirim && muncul, ket: muncul ? 'akun muncul di tabel' : 'akun tidak muncul' };
    });

    await cek('admin: reset sandi menampilkan sandi sementara sekali', async () => {
      const klik = await klikDalam(pa, 'Pengguna Uji Peran', 'button[aria-label^="Reset kata sandi"]', 'tr');
      await tunggu(2500);
      const t = await teksHalaman(pa);
      await foto(pa, '06-admin-reset-sandi');
      const ada = /kata sandi sementara/i.test(t);
      return { ok: klik && ada, ket: ada ? 'banner sandi sementara tampil' : 'banner tidak muncul' };
    });

    await cek('admin: ubah peran akun uji lewat select', async () => {
      // Daftar dimuat ulang: id baris bisa basi setelah modal tambah/hapus akun,
      // dan PATCH dengan id basi berakhir 404 yang bukan salah produk.
      await pa.reload({ waitUntil: 'networkidle2', timeout: 60_000 });
      await tunggu(2500);
      await klikTestId(pa, 'admin-tab-users');
      await tunggu(1500);
      const pilih = await pa.evaluate((nama) => {
        const sel = document.querySelector(`select[aria-label="Peran ${nama}"]`);
        if (!sel) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        setter.call(sel, 'admin');
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }, 'Pengguna Uji Peran');
      await tunggu(1800);
      const sesudah = await pa.evaluate((nama) => {
        const sel = document.querySelector(`select[aria-label="Peran ${nama}"]`);
        return sel ? sel.value : null;
      }, 'Pengguna Uji Peran');
      await foto(pa, '07-admin-ubah-peran');
      return { ok: pilih && sesudah === 'admin', ket: `nilai select=${sesudah}` };
    });

    await cek('admin: hapus akun uji', async () => {
      const klik = await klikDalam(pa, 'Pengguna Uji Peran', 'button[aria-label^="Hapus "]', 'tr');
      await tunggu(2200);
      const masih = (await teksHalaman(pa)).includes('Pengguna Uji Peran');
      return { ok: klik && !masih, ket: masih ? 'akun masih tampil' : 'akun hilang dari tabel' };
    });

    const emailGabung = `e2e.gabung.${Date.now()}@aionesboard.id`;
    await cek('admin: setujui pendaftaran baru dari kotak "Permintaan Bergabung"', async () => {
      const daftar = await fetch(`${BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Pendaftar Uji', email: emailGabung, password: 'RahasiaUji2026!', tenantId: 'tenant-pdam' }),
      });
      if (!daftar.ok) return { ok: false, ket: `register HTTP ${daftar.status}` };
      await klikTestId(pa, 'admin-tab-users');
      await tunggu(800);
      const muat = await pa.evaluate(() => {
        const b = document.querySelector('button[aria-label="Muat ulang daftar permintaan bergabung"]');
        if (!b) return false;
        b.click();
        return true;
      });
      const tampil = await tungguTeks(pa, 'Pendaftar Uji', 12_000);
      await foto(pa, '08-admin-permintaan-gabung');
      return { ok: muat && tampil, ket: tampil ? 'pendaftar tampil di kotak' : 'pendaftar tidak tampil' };
    });

    await cek('admin: klik Setujui mengaktifkan akun pendaftar', async () => {
      const setuju = await pa.evaluate(() => {
        const wadah = [...document.querySelectorAll('div')].find(
          (e) => (e.textContent || '').includes('Pendaftar Uji') && [...e.querySelectorAll('button')].some((b) => /Setujui/.test(b.textContent || ''))
        );
        if (!wadah) return false;
        const b = [...wadah.querySelectorAll('button')].find((x) => /Setujui/.test(x.textContent || ''));
        if (!b) return false;
        b.click();
        return true;
      });
      await tunggu(2500);
      // Login pendaftar HARUS dari Node, bukan dari halaman admin: fetch login di dalam
      // halaman akan menimpa cookie sesi admin (jebakan "newPage berbagi cookie").
      const r = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailGabung, password: 'RahasiaUji2026!' }),
      });
      await foto(pa, '08b-admin-setujui');
      return { ok: setuju && r.status === 200, ket: `login pendaftar setelah setujui = HTTP ${r.status}` };
    });

    /* ================= 3. ADMIN: ambang batas ================= */
    await cek('admin: tab Ambang Batas menampilkan aturan instansinya', async () => {
      await klikTestId(pa, 'admin-tab-alerts');
      await tunggu(1500);
      const t = await teksHalaman(pa);
      await foto(pa, '09-admin-alerts');
      const ok = t.includes('Daftar Aturan Ambang Batas') && t.includes('NRW');
      return { ok, ket: ok ? 'aturan NRW tampil' : 'daftar aturan tidak tampil' };
    });

    await cek('admin: ubah ambang batas lewat prompt tersimpan', async () => {
      const r = await pa.evaluate(async () => {
        const tombol = [...document.querySelectorAll('button[title="Ubah ambang batas"]')][0];
        if (!tombol) return { ok: false, ket: 'tombol tidak ada' };
        const sebelum = await (await fetch('/api/alerts', { credentials: 'include' })).json();
        tombol.click();
        return { ok: true, sebelum: sebelum[0]?.threshold };
      });
      await tunggu(2000);
      const sesudah = await pa.evaluate(async () => (await (await fetch('/api/alerts', { credentials: 'include' })).json())[0]?.threshold);
      return { ok: r.ok && sesudah === 30, ket: `threshold ${r.sebelum} → ${sesudah} (prompt dijawab 30)` };
    });

    await cek('admin: tambah aturan ambang batas lewat form panel', async () => {
      const sebelum = (await api(pa, 'GET', '/api/alerts')).json;
      const jumlahAwal = Array.isArray(sebelum) ? sebelum.length : 0;
      await klikTestId(pa, 'tambah-aturan');
      await tunggu(600);
      await isi(pa, '[data-testid="aturan-indikator"]', 'Kepatuhan Uji');
      await isi(pa, '[data-testid="aturan-ambang"]', '87');
      await klikTestId(pa, 'simpan-aturan');
      await tunggu(2500);
      const sesudah = (await api(pa, 'GET', '/api/alerts')).json;
      const daftar = Array.isArray(sesudah) ? sesudah : [];
      const dibuat = daftar.find((r) => /Kepatuhan Uji/.test(r.metricName || ''));
      const t = await teksHalaman(pa);
      await foto(pa, '09b-admin-tambah-aturan');
      if (dibuat) await api(pa, 'DELETE', `/api/alerts/${dibuat.id}?tenantId=${encodeURIComponent(dibuat.tenantId)}`);
      return {
        ok: !!dibuat && /Kepatuhan Uji/.test(t),
        ket: `aturan awal=${jumlahAwal} · sesudah=${daftar.length} · aturan baru tampil di layar=${/Kepatuhan Uji/.test(t)}`,
      };
    });

    await cek('admin: buat dashboard baru dari Workspace', async () => {
      await klikTestId(pa, 'buka-workspace');
      await tunggu(2000);
      await foto(pa, '10-admin-workspace');
      const sebelum = await api(pa, 'GET', '/api/dashboards');
      const jumlahSebelum = (Array.isArray(sebelum.json) ? sebelum.json : sebelum.json?.dashboards || []).length;
      const buka = await klikTeks(pa, 'Dashboard Baru');
      if (!buka) return { ok: false, ket: 'tombol Dashboard Baru tidak ada' };
      await tunggu(900);
      const konfirmasi = await pa.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        if (!d) return false;
        const b = [...d.querySelectorAll('button')].find((x) => /buat|konfirmasi|ya|lanjut/i.test((x.textContent || '').trim()));
        if (!b) return false;
        b.click();
        return true;
      });
      await tunggu(3000);
      const sesudah = await api(pa, 'GET', '/api/dashboards');
      const jumlahSesudah = (Array.isArray(sesudah.json) ? sesudah.json : sesudah.json?.dashboards || []).length;
      await foto(pa, '11-admin-dashboard-baru');
      const masukEditor = await pa.evaluate(() => !!document.querySelector('[data-testid="tambah-halaman"]'));
      return {
        ok: konfirmasi && jumlahSesudah === jumlahSebelum + 1,
        ket: `dashboard ${jumlahSebelum} → ${jumlahSesudah} · editor terbuka=${masukEditor}`,
      };
    });

    await cek('admin: tombol tulis workspace tersedia (Impor Data / Bagikan)', async () => {
      const t = await teksHalaman(pa);
      const ada = t.includes('Impor Data') || t.includes('Bagikan');
      return { ok: ada, ket: ada ? 'tombol tulis ada untuk admin' : 'tidak ditemukan' };
    });

    await cek('interaksi: dashboard buatan admin tampil di Workspace pengguna', async () => {
      await pb.reload({ waitUntil: 'networkidle2', timeout: 60_000 });
      await tunggu(2500);
      await klikTestId(pb, 'buka-workspace');
      await tunggu(2000);
      const t = await teksHalaman(pb);
      const r = await api(pb, 'GET', '/api/dashboards');
      const jumlah = (Array.isArray(r.json) ? r.json : r.json?.dashboards || []).length;
      await foto(pb, '12b-user-workspace-dashboard');
      return { ok: jumlah >= 1 && /Dashboard Baru/i.test(t), ket: `API ${jumlah} dashboard · judul tampil=${/Dashboard Baru/i.test(t)}` };
    });

    await cek('pengguna: dashboard tanpa kontrol tulis/hapus', async () => {
      const buka = await pb.evaluate(() => {
        const h = [...document.querySelectorAll('h3')].find((x) => /Dashboard Baru/i.test(x.textContent || ''));
        if (!h) return false;
        h.click();
        return true;
      });
      await tunggu(3000);
      await pb.evaluate(() => document.querySelector('button[title="Aksi lainnya"]')?.click());
      await tunggu(900);
      const t = await teksHalaman(pb);
      await foto(pb, '12c-user-menu-aksi');
      const terlihat = ['Impor Data', 'Gaya Semua', 'Bagikan Tautan', 'Hapus Dashboard'].filter((k) => t.includes(k));
      // Kontrol tulis tingkat halaman: dicari lewat `title`, bukan teks tombol —
      // tombol "+ Halaman" dirender sebagai ikon + kata "Halaman" sehingga regex
      // teks (yang dipakai sebelumnya) selalu meleset dan uji jadi hijau palsu.
      const kontrolHalaman = await pb.evaluate(() => {
        const strip = document.querySelector('[data-testid="strip-halaman"]');
        const cari = (judul) => !!document.querySelector(`button[title="${judul}"]`);
        return {
          adaStrip: !!strip,
          tambah: cari('Tambah halaman'),
          gantiNama: cari('Ganti nama halaman'),
          hapus: cari('Hapus halaman'),
          geser: cari('Geser ke kiri') || cari('Geser ke kanan'),
        };
      });
      const tambahHalaman = kontrolHalaman.tambah;
      const bocor = [
        kontrolHalaman.tambah && '+ Halaman',
        kontrolHalaman.gantiNama && 'pensil',
        kontrolHalaman.hapus && 'hapus halaman',
        kontrolHalaman.geser && 'geser halaman',
      ].filter(Boolean);
      return {
        ok: buka && terlihat.length === 0 && bocor.length === 0,
        ket: `dashboard terbuka=${buka} · kontrol tulis: ${terlihat.join(', ') || 'tidak ada'} · kontrol halaman: ${bocor.join(', ') || 'tidak ada'} (strip=${kontrolHalaman.adaStrip})`,
      };
    });

    await cek('pengguna: empty state kanvas memakai bahasa pembaca, bukan ajakan menyusun', async () => {
      // Kanvas dashboard ini kosong (0 widget), jadi empty state-nya tampil.
      const t = await teksHalaman(pb);
      const salah = ['Bangun dashboard pertama Anda', 'Buat via Chat', 'susun sendiri dari preset'].filter((k) =>
        t.includes(k)
      );
      const benar = ['Dashboard ini masih kosong', 'Tanya lewat Asisten'].filter((k) => t.includes(k));
      await foto(pb, '12e-user-empty-state');
      return {
        ok: salah.length === 0 && benar.length === 2,
        ket: `teks penyusun yang muncul: ${salah.join(', ') || 'tidak ada'} · teks pembaca: ${benar.join(', ') || 'tidak ada'}`,
      };
    });

    await cek('pengguna: tidak ada tombol Hapus Dashboard di menu aksi', async () => {
      const ada = await pb.evaluate(() =>
        [...document.querySelectorAll('button')].some((b) => (b.textContent || '').trim() === 'Hapus Dashboard')
      );
      const daftar = (await api(pb, 'GET', '/api/dashboards')).json;
      const arr = Array.isArray(daftar) ? daftar : daftar?.dashboards || [];
      const jumlah = arr.length;
      const satu = arr[0];
      const r = satu
        ? await api(pb, 'DELETE', `/api/dashboards/${satu.id}?tenantId=${encodeURIComponent(satu.tenantId)}`)
        : { status: 0 };
      await foto(pb, '12d-user-hapus-ditolak');
      return { ok: !ada && r.status === 403 && jumlah >= 1, ket: `tombol hapus=${ada} · DELETE API=${r.status} · dashboard masih ada=${jumlah}` };
    });

    await cek('admin: unggah berkas ke repositori dokumen', async () => {
      await klikTestId(pa, 'buka-manajemen-berkas');
      await tunggu(2500);
      const terpetakan = !(await teksHalaman(pa)).includes('belum terhubung ke repositori');
      await foto(pa, '12-admin-berkas');
      if (!terpetakan) return { ok: false, ket: 'halaman masih "belum terpetakan" padahal stub KMS aktif' };
      const buka = await klikTestId(pa, 'buka-panel-unggah');
      await tunggu(900);
      let input = await pa.$('[data-testid="input-berkas"]');
      if (!input) {
        // Panel bisa terlambat dirender setelah daftar selesai dimuat.
        await tunggu(1500);
        await klikTestId(pa, 'buka-panel-unggah');
        await pa.waitForSelector('[data-testid="input-berkas"]', { timeout: 10_000 }).catch(() => {});
        input = await pa.$('[data-testid="input-berkas"]');
      }
      if (!input) return { ok: false, ket: 'input berkas tidak ada' };
      await input.uploadFile(berkasUji);
      await tunggu(500);
      await isi(pa, '[data-testid="input-judul"]', 'Berkas Uji Peran');
      await isi(pa, '[data-testid="input-kategori"]', 'Keuangan');
      await tunggu(300);
      const kirim = await klikTestId(pa, 'kirim-unggah');
      const muncul = await tungguDaftarBerkas(pa, 'Berkas Uji Peran');
      const pesan = await pa.evaluate(() => document.querySelector('[data-testid="pesan-berkas"]')?.textContent?.trim() || '');
      await foto(pa, '13-admin-berkas-unggah');
      return { ok: buka && kirim && muncul, ket: muncul ? 'berkas muncul di daftar' : `tidak muncul · pesan="${pesan.slice(0, 160)}"` };
    });

    await cek('admin: tombol hapus berkas tersedia dan menghapus', async () => {
      const ada = await pa.evaluate(() => {
        const baris = [...document.querySelectorAll('[data-testid="baris-berkas"]')]
          .find((b) => (b.textContent || '').includes('Berkas Uji Peran'));
        const tombol = baris?.querySelector('[data-testid="hapus-berkas"]');
        if (!tombol) return false;
        tombol.click();
        return true;
      });
      if (!ada) return { ok: false, ket: 'tombol hapus tidak ada pada baris berkas admin' };
      await tunggu(3000);
      const masih = await pa.evaluate(() =>
        [...document.querySelectorAll('[data-testid="baris-berkas"]')].some((b) => (b.textContent || '').includes('Berkas Uji Peran'))
      );
      return { ok: !masih, ket: masih ? 'baris berkas masih tampil' : 'baris berkas hilang setelah hapus' };
    });

    await cek('admin: tombol hubungkan KMS tersembunyi saat sudah terpetakan', async () => {
      const ada = await pa.evaluate(() => !!document.querySelector('[data-testid="hubungkan-kms"]'));
      return { ok: !ada, ket: ada ? 'tombol masih tampil' : 'tidak tampil (sudah terpetakan)' };
    });

    /* ================= 6. ADMIN: audit ================= */
    await cek('admin: halaman Jejak Audit memuat aksi admin', async () => {
      await klikTestId(pa, 'buka-workspace');
      await tunggu(1200);
      const t0 = await teksHalaman(pa);
      const tombolAudit = await pa.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /jejak audit/i.test(x.textContent || ''));
        if (!b) return false;
        b.click();
        return true;
      });
      await tunggu(2500);
      const t = await teksHalaman(pa);
      await foto(pa, '14-admin-audit');
      const ok = tombolAudit && /Jejak Audit/i.test(t) && (t.includes('Ekspor CSV') || t.includes('Ekspor'));
      return { ok, ket: ok ? 'tabel audit + tombol ekspor tampil' : 'halaman audit tidak lengkap' };
    });

    await cek('admin: tautan Ekspor CSV mengunduh berkas CSV', async () => {
      const tautan = await pa.evaluate(() => {
        const a = [...document.querySelectorAll('a')].find((x) => /Ekspor CSV/i.test(x.textContent || ''));
        return a ? { href: a.getAttribute('href'), teks: a.textContent.trim() } : null;
      });
      const r = tautan?.href
        ? await pa.evaluate(async (u) => {
            const res = await fetch(u, { credentials: 'include' });
            const teks = await res.text();
            return { status: res.status, tipe: res.headers.get('content-type') || '', teks };
          }, tautan.href)
        : { status: 0, tipe: '', teks: '' };
      const ok = !!tautan && r.status === 200 && /csv/i.test(r.tipe) && r.teks.split('\n').length > 1;
      return { ok, ket: `href=${tautan?.href || '-'} · HTTP ${r.status} · ${r.tipe} · ${r.teks.split('\n').length} baris` };
    });

    /* ================= 7. PENGGUNA: navigasi ================= */
    await cek('pengguna: sidebar memakai label "Permintaan Data" & tanpa tata kelola', async () => {
      const d = await pb.evaluate(() => ({
        sidebar: (document.querySelector('aside')?.innerText || '').replace(/\n+/g, ' | '),
        tabs: [...document.querySelectorAll('[data-testid^="admin-tab-"]')].length,
      }));
      await foto(pb, '20-user-sidebar');
      const ok = d.sidebar.includes('Permintaan Data') && !d.sidebar.includes('Kotak Masuk')
        && !d.sidebar.includes('Jejak Audit') && !d.sidebar.includes('Panel Admin') && d.tabs === 0;
      return { ok, ket: `tabAdmin=${d.tabs} · sidebar="${d.sidebar.slice(0, 120)}"` };
    });

    await cek('pengguna: workspace tidak menawarkan pembuatan dashboard', async () => {
      await tunggu(1500);
      await foto(pb, '21-user-workspace');
      const tombolBuat = await pb.evaluate(() =>
        [...document.querySelectorAll('button')]
          .map((b) => (b.textContent || '').trim())
          .filter((t) => t === 'Dashboard Baru' || t === '+ Dashboard Baru')
      );
      return { ok: tombolBuat.length === 0, ket: tombolBuat.length ? 'tombol buat: ' + tombolBuat.join(' / ') : 'tidak ada tombol buat dashboard' };
    });

    await cek('pengguna: workspace tanpa tombol tulis (Impor Data/Bagikan/Gaya)', async () => {
      const t = await teksHalaman(pb);
      const ada = ['Impor Data', 'Bagikan', 'Gaya'].filter((k) => t.includes(k));
      return { ok: ada.length === 0, temuan: ada.length > 0, ket: ada.length ? 'tampil: ' + ada.join(', ') + ' (server menolak 403)' : 'tidak ada' };
    });

    /* ================= 8. PENGGUNA: permintaan data ================= */
    await cek('pengguna: ajukan permintaan data baru', async () => {
      await klikTestId(pb, 'buka-permintaan');
      await tunggu(2200);
      await foto(pb, '22-user-permintaan');
      const buka = await klikTestId(pb, 'tombol-permintaan-baru');
      await tunggu(900);
      await pilihOpsi(pb, '[data-testid="pilih-bidang"]', 'Keuangan');
      await tunggu(200);
      await isi(pb, '[data-testid="input-data-diminta"]', 'Realisasi pendapatan usaha per bulan 2026 beserta targetnya untuk uji peran.');
      await tunggu(300);
      const kirim = await klikTestId(pb, 'kirim-permintaan');
      const muncul = await tungguTeks(pb, 'Realisasi pendapatan usaha per bulan 2026', 15_000);
      await foto(pb, '23-user-permintaan-baru');
      return { ok: buka && kirim && muncul, ket: muncul ? 'permintaan tampil di daftar' : 'permintaan tidak tampil' };
    });

    await cek('pengguna: tambah catatan pada permintaan sendiri', async () => {
      const isiCatatan = await pb.evaluate(() => {
        const ta = [...document.querySelectorAll('textarea')].find((e) => /Tambahkan keterangan/i.test(e.placeholder || ''));
        if (!ta) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        setter.call(ta, 'Data susulan: mohon sertakan realisasi per unit.');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      });
      await tunggu(300);
      const kirim = await pb.evaluate(() => {
        const ta = [...document.querySelectorAll('textarea')].find((e) => /Tambahkan keterangan/i.test(e.placeholder || ''));
        const b = ta?.parentElement?.querySelector('button');
        if (!b) return false;
        b.click();
        return true;
      });
      const tampil = await tungguTeks(pb, 'Data susulan: mohon sertakan realisasi per unit.', 12_000);
      await foto(pb, '24-user-catatan');
      return { ok: isiCatatan && kirim && tampil, ket: tampil ? 'catatan tampil di riwayat' : 'catatan tidak tampil' };
    });

    await cek('pengguna: tidak boleh mengubah status permintaan (API 403)', async () => {
      B.abaikanSementara(true);
      const daftar = await api(pb, 'GET', '/api/permintaan');
      const satu = daftar.json?.[0];
      const r = await api(pb, 'PATCH', `/api/permintaan/${satu?.id}`, { status: 'diproses' });
      B.abaikanSementara(false);
      return { ok: r.status === 403, ket: `HTTP ${r.status} ${r.json?.error || ''}` };
    });

    /* ================= 9. INTERAKSI: admin memproses permintaan pengguna ================= */
    await cek('interaksi: admin melihat permintaan pengguna di Kotak Masuk', async () => {
      const daftarApi = await api(pa, 'GET', '/api/permintaan');
      const jumlah = (Array.isArray(daftarApi.json) ? daftarApi.json : daftarApi.json?.items || []).length;
      await klikTestId(pa, 'buka-permintaan');
      await tunggu(2500);
      let tampil = await tungguTeks(pa, 'perlu ditindaklanjuti', 8_000);
      if (!tampil) {
        await pa.reload({ waitUntil: 'networkidle2', timeout: 60_000 });
        await tunggu(2500);
        await klikTestId(pa, 'buka-permintaan');
        await tunggu(2500);
        tampil = await tungguTeks(pa, 'perlu ditindaklanjuti', 10_000);
      }
      const kartu = await pa.evaluate(() =>
        [...document.querySelectorAll('button, li, [role="button"]')]
          .map((e) => (e.textContent || '').trim())
          .filter((t) => /^Keuangan/.test(t) || /Keuangan\s*Baru/.test(t)).slice(0, 3)
      );
      await foto(pa, '30-admin-kotak-masuk');
      return { ok: tampil && kartu.length > 0, ket: `API ${jumlah} permintaan · kartu=${kartu[0]?.slice(0, 60) || 'tidak ada'}` };
    });

    await cek('interaksi: admin "Ambil & proses" mengubah status ke diproses', async () => {
      const klik = await pa.evaluate(() => {
        // Kartu daftar adalah <button class="item-card"> (lihat src/components/ui/ItemCard.tsx:44).
        const kartu = [...document.querySelectorAll('button.item-card')]
          .find((c) => /Keuangan/.test(c.textContent || ''));
        if (!kartu) return false;
        kartu.click();
        return true;
      });
      await tunggu(2000);
      const ambil = await klikTeks(pa, 'Ambil & proses');
      await tunggu(2800);
      const status = await api(pa, 'GET', '/api/permintaan');
      const satu = (Array.isArray(status.json) ? status.json : status.json?.items || [])
        .find((x) => /Realisasi pendapatan usaha per bulan 2026/.test(x.dataDiminta || ''));
      await foto(pa, '31-admin-permintaan-diproses');
      return { ok: klik && ambil && satu?.status === 'diproses', ket: `klik kartu=${klik} · tombol=${ambil} · status API=${satu?.status}` };
    });

    await cek('interaksi: admin tidak bisa menolak tanpa alasan (tombol nonaktif)', async () => {
      await pa.evaluate(() => {
        const kartu = [...document.querySelectorAll('button.item-card')].find((c) => /Keuangan/.test(c.textContent || ''));
        kartu?.click();
      });
      await tunggu(1500);
      const buka = await klikTeks(pa, 'Tolak');
      await tunggu(700);
      const nonaktif = await pa.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /Kirim penolakan/i.test(x.textContent || ''));
        return b ? b.disabled : null;
      });
      const tutup = await klikTeks(pa, 'Tolak');
      return { ok: nonaktif === true, ket: `tombol kirim penolakan disabled=${nonaktif}` };
    });

    await cek('interaksi: pengguna melihat status Diproses pada permintaannya', async () => {
      await klikTestId(pb, 'buka-permintaan');
      await tunggu(2200);
      const r = await api(pb, 'GET', '/api/permintaan');
      const satu = (Array.isArray(r.json) ? r.json : r.json?.items || [])
        .find((x) => /Realisasi pendapatan usaha per bulan 2026/.test(x.dataDiminta || ''));
      const t = await teksHalaman(pb);
      await foto(pb, '32-user-status-diproses');
      return { ok: satu?.status === 'diproses' && /Diproses/i.test(t), ket: `status API=${satu?.status} · teks "Diproses" di UI=${/Diproses/i.test(t)}` };
    });

    await cek('interaksi: notifikasi pengguna bertambah setelah status berubah', async () => {
      const r = await api(pb, 'GET', '/api/notifications');
      const daftar = Array.isArray(r.json) ? r.json : (r.json?.notifications || []);
      const ada = daftar.some((n) => /diproses/i.test(`${n.title || ''} ${n.message || ''}`) || (n.jenis === 'permintaan'));
      return { ok: ada, ket: ada ? `notifikasi terbaru: "${daftar[0]?.title}"` : `${daftar.length} notifikasi: ${daftar.map((n) => n.title).slice(0, 3).join(' / ')}` };
    });

    /* ====== 9b. INTERAKSI: transisi status lewat tombol di layar ====== */
    const teksPermintaan = 'Realisasi pendapatan usaha per bulan 2026';

    await cek('interaksi: admin "Minta data tambahan" → status Perlu Data terbaca di layar', async () => {
      const pilih = await pilihPermintaan(pa, teksPermintaan);
      const klik = await klikTeks(pa, 'Minta data tambahan');
      await tunggu(2500);
      // Badge status yang sah hanya yang ada DI PANEL DETAIL: chip filter daftar
      // ("Selesai (0)", "Ditolak (0)") memuat kata yang sama dan bikin hijau palsu.
      await pilihPermintaan(pa, teksPermintaan);
      const detail = await teksDetail(pa);
      await foto(pa, '31b-admin-perlu-data');
      return {
        ok: !!pilih && klik && /Perlu Data/i.test(detail),
        ket: `kartu=${pilih} · tombol=${klik} · detail: "Perlu Data"=${/Perlu Data/i.test(detail)}`,
      };
    });

    await cek('interaksi: admin "Ambil & proses" mengembalikan status ke Diproses', async () => {
      const klik = await klikTeks(pa, 'Ambil & proses');
      await tunggu(2500);
      await pilihPermintaan(pa, teksPermintaan);
      const detail = await teksDetail(pa);
      await foto(pa, '31c-admin-kembali-diproses');
      return { ok: klik && /Diproses/i.test(detail), ket: `tombol=${klik} · detail: "Diproses"=${/Diproses/i.test(detail)}` };
    });

    await cek('interaksi: admin "Tandai selesai" & pengguna melihat Selesai', async () => {
      const klik = await klikTeks(pa, 'Tandai selesai');
      await tunggu(2800);
      await pilihPermintaan(pa, teksPermintaan);
      const detailAdmin = await teksDetail(pa);
      await foto(pa, '31d-admin-selesai');
      // Status diubah admin → daftar pengguna yang sudah dirender masih basi.
      await muatUlangPermintaan(pb);
      const pilih = await pilihPermintaan(pb, teksPermintaan);
      const detailUser = await teksDetail(pb);
      await foto(pb, '32b-user-selesai');
      const ok = klik && /Selesai/i.test(detailAdmin) && !!pilih && /Selesai/i.test(detailUser);
      return {
        ok,
        ket: `admin detail: Selesai=${/Selesai/i.test(detailAdmin)} · pengguna kartu=${pilih} · detail: Selesai=${/Selesai/i.test(detailUser)}`,
      };
    });

    const teksPermintaan2 = 'Permintaan kedua: uji hapus oleh pemohon';
    await cek('pengguna: ajukan permintaan lalu hapus sendiri selama status Baru', async () => {
      await klikTestId(pb, 'buka-permintaan');
      await tunggu(1500);
      const sebelum = await pb.evaluate(() => document.querySelectorAll('button.item-card').length);
      await klikTestId(pb, 'tombol-permintaan-baru');
      await tunggu(900);
      await pilihOpsi(pb, '[data-testid="pilih-bidang"]', 'Umum');
      await isi(pb, '[data-testid="input-data-diminta"]', teksPermintaan2);
      await tunggu(300);
      const kirim = await klikTestId(pb, 'kirim-permintaan');
      const muncul = await tungguTeks(pb, teksPermintaan2, 15_000);
      const pilih = await pilihPermintaan(pb, teksPermintaan2);
      const hapus = await klikTeks(pb, 'Hapus permintaan ini');
      await tunggu(2600);
      // Hitung kartu, jangan cari teks di seluruh halaman: banner "Permintaan dihapus."
      // tetap memuat kata "permintaan" dan membuat assertion teks menipu.
      const sesudah = await pb.evaluate(() => document.querySelectorAll('button.item-card').length);
      const masihKartu = await pb.evaluate((t) =>
        [...document.querySelectorAll('button.item-card')].some((c) => (c.textContent || '').includes(t)), teksPermintaan2);
      await foto(pb, '32c-user-hapus-permintaan');
      return {
        ok: kirim && muncul && hapus && !masihKartu, // `pilih` tidak wajib: kartunya memang sudah hilang
        ket: `kirim=${kirim} muncul=${muncul} hapus=${hapus} · kartu ${sebelum} → ${sesudah} · masih ada=${masihKartu}`,
      };
    });

    const teksPermintaan3 = 'Permintaan ketiga: uji penolakan oleh admin';
    await cek('pengguna: ajukan permintaan ketiga (bahan uji penolakan)', async () => {
      await klikTestId(pb, 'tombol-permintaan-baru');
      await tunggu(900);
      await pilihOpsi(pb, '[data-testid="pilih-bidang"]', 'Keuangan');
      await isi(pb, '[data-testid="input-data-diminta"]', teksPermintaan3);
      await tunggu(300);
      const kirim = await klikTestId(pb, 'kirim-permintaan');
      const muncul = await tungguTeks(pb, teksPermintaan3, 15_000);
      await foto(pb, '32d-user-permintaan-ketiga');
      return { ok: kirim && muncul, ket: muncul ? 'permintaan ketiga tampil di daftar' : 'tidak tampil' };
    });

    await cek('interaksi: admin menolak dengan alasan (form di layar) → Ditolak', async () => {
      // Permintaan ketiga BARU dibuat pengguna; daftar admin yang sudah dirender
      // tidak memuatnya (inilah sebab kegagalan run sebelumnya).
      await muatUlangPermintaan(pa);
      const pilih = await pilihPermintaan(pa, teksPermintaan3);
      const buka = await klikTeks(pa, 'Tolak');
      await tunggu(800);
      const isiAlasan = await pa.evaluate(() => {
        const ta = [...document.querySelectorAll('textarea')].find((t) => /Contoh: data yang diminta/i.test(t.placeholder || ''));
        if (!ta) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        setter.call(ta, 'Data sudah tersedia di dashboard produksi.');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      });
      await tunggu(400);
      const kirim = await klikTeks(pa, 'Kirim penolakan');
      await tunggu(2800);
      // Alasan penolakan hanya dirender di panel detail (PermintaanDataPage.tsx:320),
      // jadi kartunya dibuka lagi sebelum membaca layar.
      await pilihPermintaan(pa, teksPermintaan3);
      const detail = await teksDetail(pa);
      await foto(pa, '31e-admin-tolak');
      return {
        ok: !!pilih && buka && isiAlasan && kirim && /Ditolak/i.test(detail) && /Data sudah tersedia di dashboard produksi/i.test(detail),
        ket: `kartu=${pilih} · form=${buka} · isi=${isiAlasan} · kirim=${kirim} · detail: Ditolak=${/Ditolak/i.test(detail)} alasan tampil=${/Data sudah tersedia di dashboard produksi/i.test(detail)}`,
      };
    });

    await cek('interaksi: pengguna melihat Ditolak + alasan penolakan di layar', async () => {
      await muatUlangPermintaan(pb);
      const pilih = await pilihPermintaan(pb, teksPermintaan3);
      const detail = await teksDetail(pb);
      await foto(pb, '32e-user-ditolak');
      const ok = !!pilih && /Ditolak/i.test(detail) && /Data sudah tersedia di dashboard produksi/i.test(detail);
      return { ok, ket: `kartu=${pilih} · detail: Ditolak=${/Ditolak/i.test(detail)} · alasan tampil=${/Data sudah tersedia di dashboard produksi/i.test(detail)}` };
    });

    await cek('admin: hapus permintaan lewat kontrol di layar (konfirmasi dua langkah)', async () => {
      // Regresi temuan #3: dulu kontrol hapus tidak ada di layar untuk admin
      // walaupun `DELETE /api/permintaan/:id` menjawab 200.
      const sebelum = await pa.evaluate(() => document.querySelectorAll('button.item-card').length);
      const buka = await klikTestId(pa, 'hapus-permintaan-admin');
      await tunggu(700);
      const panelKonfirmasi = await pa.evaluate(() => {
        const b = document.querySelector('[data-testid="konfirmasi-hapus-permintaan"]');
        return b ? (b.closest('div')?.parentElement?.textContent || '').slice(0, 120) : '';
      });
      await foto(pa, '31g-admin-konfirmasi-hapus');
      const batalAda = await pa.evaluate(() => !!document.querySelector('[data-testid="batal-hapus-permintaan"]'));
      const konfirmasi = await klikTestId(pa, 'konfirmasi-hapus-permintaan');
      await tunggu(2600);
      const sesudah = await pa.evaluate(() => document.querySelectorAll('button.item-card').length);
      const masihDiApi = !!(await cariPermintaan(pa, teksPermintaan3));
      await foto(pa, '31h-admin-hapus-permintaan');
      const ok = buka && batalAda && konfirmasi && sesudah === sebelum - 1 && !masihDiApi;
      return {
        ok,
        ket: `tombol hapus=${buka} · panel konfirmasi=${batalAda} ("${panelKonfirmasi.trim().slice(0, 70)}…") · konfirmasi=${konfirmasi} · kartu ${sebelum} → ${sesudah} · masih ada di API=${masihDiApi}`,
      };
    });

    /* ====== 9c. ISOLASI INSTANSI (baris milik tenant-bank disemai di db.json) ====== */
    await cek('isolasi: Kotak Masuk admin tidak memuat permintaan instansi lain', async () => {
      await klikTestId(pa, 'buka-permintaan');
      await tunggu(2400);
      const kartu = await pa.evaluate(() => document.querySelectorAll('button.item-card').length);
      const bocor = await pa.evaluate(() =>
        (document.body.innerText || '').includes('RAHASIA-INSTANSI-LAIN')
      );
      await foto(pa, '37-admin-isolasi-kotak-masuk');
      return { ok: !bocor && kartu > 0, ket: `${kartu} kartu · penanda instansi lain tampil=${bocor}` };
    });

    await cek('isolasi: tab Ambang Batas admin tidak memuat aturan instansi lain', async () => {
      await klikTestId(pa, 'admin-tab-alerts');
      await tunggu(2000);
      const bocor = await pa.evaluate(() => (document.body.innerText || '').includes('ATURAN-INSTANSI-LAIN'));
      const ada = await pa.evaluate(() => /Daftar Aturan Ambang Batas/i.test(document.body.innerText || ''));
      await foto(pa, '38-admin-isolasi-alerts');
      return { ok: ada && !bocor, ket: `daftar aturan tampil=${ada} · aturan instansi lain tampil=${bocor}` };
    });

    await cek('isolasi: halaman Permintaan Data pengguna tidak memuat data instansi lain', async () => {
      await klikTestId(pb, 'buka-permintaan');
      await tunggu(2200);
      const bocor = await pb.evaluate(() => (document.body.innerText || '').includes('RAHASIA-INSTANSI-LAIN'));
      await foto(pb, '39-user-isolasi-permintaan');
      return { ok: !bocor, ket: `penanda instansi lain tampil=${bocor}` };
    });

    /* ================= 10. PENGGUNA: berkas ================= */
    await cek('pengguna: melihat repositori dokumen instansi', async () => {
      await klikTestId(pb, 'buka-manajemen-berkas');
      await tunggu(2500);
      const t = await teksHalaman(pb);
      await foto(pb, '33-user-berkas');
      return { ok: !t.includes('belum terhubung ke repositori'), ket: t.includes('belum terhubung') ? 'halaman belum terpetakan' : 'repositori termuat' };
    });

    await cek('pengguna: unggah berkas sendiri berhasil', async () => {
      const buka = await klikTestId(pb, 'buka-panel-unggah');
      await tunggu(900);
      await pb.waitForSelector('[data-testid="input-berkas"]', { timeout: 10_000 }).catch(() => {});
      const input = await pb.$('[data-testid="input-berkas"]');
      if (!input) return { ok: false, ket: 'input berkas tidak ada untuk pengguna' };
      await input.uploadFile(berkasUji);
      await tunggu(500);
      await isi(pb, '[data-testid="input-judul"]', 'Berkas Unggahan Pengguna');
      await isi(pb, '[data-testid="input-kategori"]', 'Keuangan');
      await tunggu(300);
      const kirim = await klikTestId(pb, 'kirim-unggah');
      const muncul = await tungguDaftarBerkas(pb, 'Berkas Unggahan Pengguna');
      const pesan = await pb.evaluate(() => document.querySelector('[data-testid="pesan-berkas"]')?.textContent?.trim() || '');
      await foto(pb, '34-user-berkas-unggah');
      return { ok: buka && kirim && muncul, ket: muncul ? 'berkas pengguna tampil' : `tidak tampil · pesan="${pesan.slice(0, 160)}"` };
    });

    await cek('pengguna: tombol hapus berkas TIDAK tersedia', async () => {
      const ada = await pb.evaluate(() => !!document.querySelector('[data-testid="hapus-berkas"]'));
      return { ok: !ada, ket: ada ? 'tombol hapus tampil untuk pengguna' : 'tidak ada tombol hapus' };
    });

    /* ================= 11. CHAT ================= */
    await cek('pengguna: chat asisten menjawab pertanyaan', async () => {
      // Muat ulang dulu supaya TIDAK ada dashboard aktif: pertanyaan masuk ke
      // "percakapan umum" (konteks yang bertahan lintas muat ulang). Tanpa ini,
      // pesan tersimpan di chat dashboard dan langkah riwayat di bawah gagal
      // karena sebab yang salah.
      await pb.reload({ waitUntil: 'networkidle2', timeout: 60_000 }).catch(() => {});
      await tunggu(2600);
      await klikTestId(pb, 'buka-asisten');
      await tunggu(1500);
      const isiChat = await isi(pb, '[data-testid="input-asisten"]', 'Apa isi laporan kinerja terbaru?');
      await tunggu(300);
      const kirim = await pb.evaluate(() => {
        const i = document.querySelector('[data-testid="input-asisten"]');
        i?.form?.requestSubmit();
        return !!i;
      });
      await tunggu(9000);
      const t = await teksHalaman(pb);
      const umum = await api(pb, 'GET', '/api/chat/umum');
      const pesanUmum = (umum.json?.chat?.messages || []).some((m) =>
        /Apa isi laporan kinerja terbaru/i.test(String(m.content ?? m.text ?? ''))
      );
      await foto(pb, '35-user-chat');
      return {
        ok: isiChat && kirim && /Apa isi laporan kinerja terbaru/i.test(t),
        ket: /Apa isi laporan/i.test(t)
          ? `pesan terkirim · tersimpan di percakapan umum=${pesanUmum} · balasan: ${/maaf|tidak menemukan|belum ada/i.test(t) ? 'ada' : 'menunggu'}`
          : 'pesan tidak muncul',
      };
    });

    await cek('pengguna: Template Dashboard & Galeri Chart terbuka dari sidebar', async () => {
      const t1 = await klikTestId(pb, 'buka-template-dashboard');
      await tunggu(2500);
      const teksTemplate = await teksHalaman(pb);
      await foto(pb, '35b-user-template-dashboard');
      const kartu = await pb.evaluate(() => document.querySelectorAll('button.item-card, [data-testid^="kartu-"]').length);
      const t2 = await klikTestId(pb, 'buka-galeri-chart');
      await tunggu(2500);
      const teksChart = await teksHalaman(pb);
      await foto(pb, '35c-user-galeri-chart');
      const ok = t1 && t2 && /template/i.test(teksTemplate) && teksTemplate.length > 400 && /chart|grafik/i.test(teksChart);
      return { ok, ket: `template terbuka=${t1} (${teksTemplate.length} karakter, ${kartu} kartu) · chart terbuka=${t2} (${teksChart.length} karakter)` };
    });

    await cek('TEMUAN pengguna: riwayat chat tidak bisa dimuat ulang (tidak ada endpoint isi pesan)', async () => {
      const ringkas = await api(pb, 'GET', '/api/chats');
      const daftar = Array.isArray(ringkas.json) ? ringkas.json : ringkas.json?.chats || [];
      const adaPesan = daftar.some((c) => Number(c.messageCount || 0) > 0);
      const idChat = daftar[0]?.id;
      // Probe sengaja memanggil endpoint isi pesan: 404-nya adalah BUKTI temuan.
      // Dijalankan dari Node (bukan dari dalam halaman) supaya tidak muncul sebagai
      // "Failed to load resource: 404" di konsol browser — probe yang mencemari
      // gerbang "0 galat konsol" membuat gerbangnya tidak bisa dipakai.
      const isi = idChat
        ? await fetch(`${BASE}/api/chats/${idChat}`, { headers: { cookie: sesiUser.cookie.join('; ') } }).then(
            (r) => ({ status: r.status }),
            () => ({ status: 0 })
          )
        : { status: 0 };
      await pb.reload({ waitUntil: 'networkidle2', timeout: 60_000 });
      await tunggu(3000);
      await klikTestId(pb, 'buka-asisten');
      await tunggu(3500);
      const t = await teksHalaman(pb);
      await foto(pb, '35d-user-chat-riwayat');
      const tampil = /Apa isi laporan kinerja terbaru/i.test(t);
      return {
        ok: adaPesan && tampil,
        temuan: adaPesan && !tampil,
        ket: `pesan tersimpan=${adaPesan} (messageCount) · GET /api/chats/:id = HTTP ${isi.status} · riwayat tampil setelah reload=${tampil}`,
      };
    });

    await cek('negatif pengguna: POST/PATCH/DELETE /api/alerts ditolak 403', async () => {
      B.abaikanSementara(true);
      const buat = await api(pb, 'POST', '/api/alerts', {
        title: 'Aturan Uji Pengguna',
        metricKey: 'nrw',
        metricName: 'NRW',
        operator: '>=',
        threshold: 99,
        unit: '%',
      });
      const aturan = (await api(pb, 'GET', '/api/alerts')).json;
      const satu = Array.isArray(aturan) ? aturan[0] : null;
      const ubah = satu ? await api(pb, 'PATCH', `/api/alerts/${satu.id}`, { threshold: 11 }) : { status: 0 };
      const hapus = satu ? await api(pb, 'DELETE', `/api/alerts/${satu.id}`) : { status: 0 };
      B.abaikanSementara(false);
      const semua = [buat.status, ubah.status, hapus.status];
      return {
        ok: semua.every((s) => s === 401 || s === 403),
        temuan: semua.some((s) => s < 300),
        ket: `POST=${buat.status} · PATCH=${ubah.status} · DELETE=${hapus.status}`,
      };
    });

    /* ================= 12. UJI NEGATIF & CELAH ================= */
    await cek('negatif pengguna: tulis dashboard/impor/analisis/usulan ditolak 403', async () => {
      B.abaikanSementara(true);
      const hasil = {};
      hasil.dash = (await api(pb, 'POST', '/api/dashboards', { title: 'X', sector: 'pdam' })).status;
      hasil.impor = (await api(pb, 'POST', '/api/impor/widget', { isi: 'x' })).status;
      hasil.analisis = (await api(pb, 'POST', '/api/analisis', { permintaanId: 'x' })).status;
      hasil.usulan = (await api(pb, 'POST', '/api/usulan/dari-chat', { chatId: 'x' })).status;
      hasil.audit = (await api(pb, 'GET', '/api/audit-logs')).status;
      hasil.tenants = (await api(pb, 'POST', '/api/admin/tenants', { name: 'X' })).status;
      hasil.berkasHapus = (await api(pb, 'DELETE', '/api/berkas/doc-uji-1')).status;
      B.abaikanSementara(false);
      const ok = Object.values(hasil).every((s) => s === 403 || s === 400);
      return { ok, ket: JSON.stringify(hasil) };
    });

    await cek('TEMUAN pengguna: #/v/alerts membuka pengelolaan ambang batas yang selalu ditolak 403', async () => {
      await pb.goto(`${BASE}/#/v/alerts`, { waitUntil: 'networkidle2', timeout: 30_000 }).catch(() => {});
      await tunggu(2500);
      const judul = await teksHalaman(pb);
      const bukaAturan = await klikTeks(pb, 'Aturan Ambang Batas');
      await tunggu(1200);
      // Kontrol yang tampil untuk pengguna: tombol ubah status/hapus aturan.
      const adaKontrol = await pb.evaluate(() => !!document.querySelector('button[title="Nonaktifkan aturan"], button[title="Aktifkan aturan"]'));
      await pb.evaluate(() => document.querySelector('button[title="Nonaktifkan aturan"], button[title="Aktifkan aturan"]')?.click());
      await tunggu(2200);
      const pesanGalat = await pb.evaluate(() => {
        const teks = document.body.innerText || '';
        const baris = teks.split('\n').map((x) => x.trim()).filter((x) => /hanya bisa dilakukan admin|Gagal mengubah status|403/i.test(x));
        return baris.slice(0, 2);
      });
      await foto(pb, '36-user-alerts');
      const terbuka = /Ambang Batas/i.test(judul);
      return {
        ok: !terbuka,
        temuan: terbuka,
        ket: terbuka
          ? `halaman pengelolaan terbuka untuk pengguna · kontrol ubah/hapus aturan tampil=${adaKontrol} · galat saat diklik="${pesanGalat.join(' | ') || 'tidak ada'}"`
          : 'halaman tidak terbuka untuk pengguna',
      };
    });

    await cek('audit: aksi kedua peran tercatat', async () => {
      const r = await api(pa, 'GET', '/api/audit-logs');
      const daftar = r.json?.logs || r.json?.items || (Array.isArray(r.json) ? r.json : []);
      const aksi = daftar.map((l) => l.action);
      const wajib = ['Ubah Status Permintaan Data', 'Setujui Pendaftaran'];
      const hilang = wajib.filter((w) => !aksi.some((a) => String(a).includes(w)));
      return { ok: hilang.length === 0, ket: hilang.length ? 'tidak tercatat: ' + hilang.join(', ') : `${daftar.length} entri audit, aksi kunci ada` };
    });

    /* ================= 13. AUDIT UX (lapis angka) ================= */
    const berkasProbe = path.join('scripts', 'ux-probe.page.js');
    const uxSrc = fs.existsSync(berkasProbe) ? fs.readFileSync(berkasProbe, 'utf8') : '';
    const auditUx = {};

    /**
     * Tutup panel asisten bila masih terbuka. Panelnya menutupi SELURUH layar di
     * 390 px, jadi tanpa ini semua tangkapan mobile halaman pengguna identik dan
     * skornya tidak sah. Muat ulang = jalur pengguna sungguhan (tombol X tidak
     * punya nama aksesibel sehingga tidak bisa dipilih dengan andal).
     */
    const pastikanTanpaPanel = async (page, nama) => {
      const terbuka = await page.evaluate(() => !!document.querySelector('[data-testid="input-asisten"]'));
      if (!terbuka) return 'tertutup';
      await page.reload({ waitUntil: 'networkidle2', timeout: 60_000 }).catch(() => {});
      await tunggu(2600);
      const masih = await page.evaluate(() => !!document.querySelector('[data-testid="input-asisten"]'));
      return masih ? `MASIH TERBUKA (${nama})` : 'ditutup-reload';
    };
    const statusPanel = [await pastikanTanpaPanel(pa, 'admin'), await pastikanTanpaPanel(pb, 'pengguna')];

    const halaman = [
      ['admin', pa, 'admin-overview', async () => { await klikTestId(pa, 'admin-tab-overview'); }],
      ['admin', pa, 'admin-users', async () => { await klikTestId(pa, 'admin-tab-users'); }],
      ['admin', pa, 'admin-alerts', async () => { await klikTestId(pa, 'admin-tab-alerts'); }],
      ['admin', pa, 'admin-permintaan', async () => { await klikTestId(pa, 'buka-permintaan'); }],
      ['admin', pa, 'admin-berkas', async () => { await klikTestId(pa, 'buka-manajemen-berkas'); }],
      ['admin', pa, 'admin-audit', async () => {
        await klikTestId(pa, 'buka-workspace');
        await tunggu(800);
        await pa.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find((x) => /jejak audit/i.test(x.textContent || ''));
          b?.click();
        });
      }],
      ['pengguna', pb, 'user-workspace', async () => { await klikTestId(pb, 'buka-workspace'); }],
      ['pengguna', pb, 'user-permintaan', async () => { await klikTestId(pb, 'buka-permintaan'); }],
      ['pengguna', pb, 'user-berkas', async () => { await klikTestId(pb, 'buka-manajemen-berkas'); }],
    ];
    if (uxSrc) {
      for (const [, page, nama, buka] of halaman) {
        await buka();
        await tunggu(1800);
        for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
          await page.setViewport(vp);
          await tunggu(900);
          await page.addScriptTag({ content: uxSrc });
          const r = await page
            .evaluate((mob) => (typeof uxProbe === 'function' ? uxProbe({ mobile: mob }) : null), label === 'mobile')
            .catch(() => null);
          if (label === 'mobile') await page.screenshot({ path: path.join(OUT, `ux-${nama}-390.png`) });
          auditUx[`${nama}-${label}`] = r ? {
            skor: r.score, nilai: r.grade, terburuk: r.worst,
            potongan: (r.deductions || []).slice(0, 8).map((d) => JSON.parse(JSON.stringify(d))),
          } : null;
          await page.setViewport({ width: 1440, height: 900 });
          await tunggu(300);
        }
      }
      const daftar = Object.entries(auditUx).map(([k, v]) => `${k}=${v ? v.skor : '-'}`).join(' ');
      const terendah = Object.entries(auditUx).filter(([, v]) => v).sort((a, b) => a[1].skor - b[1].skor)[0];
      catat('audit UX 9 halaman (desktop + mobile) terukur', !!terendah, `${daftar} · terendah=${terendah?.[0]}:${terendah?.[1]?.skor} · panel asisten: admin=${statusPanel[0]} pengguna=${statusPanel[1]}`);
    } else {
      catat('audit UX dilewati', false, 'scripts/ux-probe.page.js tidak ada');
    }

    // Uji negatif memang memicu 403/4xx: itu bukti gerbang peran bekerja, bukan galat aplikasi.
    const sengaja = /403 (DELETE \/api\/dashboards|POST \/api\/alerts|PATCH \/api\/permintaan)|403 .*\/api\/(dashboards|impor|analisis|usulan|audit-logs|admin\/tenants)/;
    // Kalau server uji sudah mati, browser wajar gagal memuat chunk/aset. Itu
    // infrastruktur uji, bukan galat aplikasi — dicatat terpisah, bukan disembunyikan.
    const galatServerMati = (t) =>
      kodeKeluarServer !== null &&
      /Failed to load (module script|resource)|dynamically imported module|ERR_CONNECTION_REFUSED|MIME type of "text\/html"/i.test(t);
    const gagalKonsol = [...A.galatKonsol, ...B.galatKonsol].filter(
      (t) => !/Failed to load resource: the server responded with a status of (403|401)/i.test(t) && !galatServerMati(t)
    );
    const respons4xx = [...A.responsGalat, ...B.responsGalat].filter((t) => !sengaja.test(t));
    catat('tidak ada galat konsol tak terduga', gagalKonsol.length === 0, gagalKonsol.slice(0, 3).join(' | ') || 'bersih');
    catat('tidak ada request 4xx/5xx tak terduga', respons4xx.length === 0, respons4xx.slice(0, 4).join(' | ') || 'bersih');

    const ringkas = {
      waktu: new Date().toISOString(),
      base: BASE,
      langkah,
      dialog: [...A.jejakDialog, ...B.jejakDialog],
      galatKonsol: gagalKonsol.slice(0, 25),
      responsGalat: respons4xx.slice(0, 25),
      auditUx,
      serverKeluar: kodeKeluarServer,
      lulus: langkah.filter((l) => l.ok).length,
      total: langkah.length,
      temuan: langkah.filter((l) => l.temuan).length,
    };
    fs.writeFileSync(path.join(OUT, 'hasil.json'), JSON.stringify(ringkas, null, 2));
    // Log server ikut disimpan: tanpa ini, "Failed to fetch" tidak bisa dibedakan
    // antara server mati, port tertahan, atau request yang menggantung.
    fs.writeFileSync(path.join(OUT, 'server.log'), logServer.slice(-200_000));
    console.log(`[peran] artefak: ${OUT}`);
  } finally {
    try { await browser?.close(); } catch { /* abaikan */ }
    try { kms.tutup(); } catch { /* abaikan */ }
    try { server.kill('SIGTERM'); } catch { /* abaikan */ }
    await tunggu(600);
    try { fs.rmSync(dirData, { recursive: true, force: true }); } catch { /* abaikan */ }
    const gagal = langkah.filter((l) => !l.ok);
    console.log(`[peran] ringkasan: ${langkah.length - gagal.length}/${langkah.length} langkah OK · temuan: ${langkah.filter((l) => l.temuan).length}`);
    if (gagal.length) console.log('[peran] gagal:', gagal.map((g) => `${g.nama} (${g.keterangan})`).join(' | '));
  }
}

main().catch((e) => { console.error('[peran] BERHENTI:', e.message); process.exitCode = 1; });
