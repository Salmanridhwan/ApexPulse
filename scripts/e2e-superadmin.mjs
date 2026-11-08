/**
 * Uji E2E fitur Admin Aiones (superadmin) lewat UI — 7 tab panel admin.
 *
 * Menyalakan server di port 3210 dengan direktori data SEMENTARA (mkdtemp),
 * mengambil sandi acak akun demo Admin Aiones dari log server (hanya di memori
 * proses ini), menyuntik sesi ke browser (cookie + localStorage) supaya tidak
 * ada sandi yang diketik ke halaman, lalu menelusuri alur tiap tab:
 * overview, users, tenants, rag, kuota, alerts, audit, katalog KB.
 *
 * Data dev/produksi tidak disentuh: MySQL diarahkan ke port kosong dan
 * AIONESBOARD_DATA_DIR menunjuk folder sementara yang dihapus setelah uji.
 *
 * Jalankan: npm run test:e2e:admin   (atau node scripts/e2e-superadmin.mjs)
 * Artefak: %TEMP%/admin-super-artifacts (tangkapan layar + hasil.json)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const PORT = Number(process.env.E2E_PORT || 3210);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.OUT_DIR || path.join(os.tmpdir(), 'admin-super-artifacts');
const CHROME =
  process.env.CHROME_PATH ||
  ['C:/Program Files/Google/Chrome/Application/chrome.exe',
   'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));

const langkah = [];
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

function catat(nama, ok, ket = '') {
  langkah.push({ nama, ok, keterangan: String(ket).slice(0, 400) });
  console.log(`${ok ? '  OK   ' : '  GAGAL'} ${nama}${ket ? ' — ' + String(ket).slice(0, 200) : ''}`);
}

async function cek(nama, fn) {
  try {
    const r = await fn();
    if (r === true || r === undefined) catat(nama, true);
    else if (r && typeof r === 'object' && 'ok' in r) catat(nama, r.ok, r.ket || '');
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

/** Klik tombol di dalam baris tabel / kartu / dialog yang memuat teks tertentu. */
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

async function bukaTab(page, id) {
  await klikTestId(page, `admin-tab-${id}`);
  await tunggu(1200);
  return page.evaluate(() => document.querySelector('main')?.innerText?.slice(0, 120) || '');
}

async function foto(page, nama) {
  const p = path.join(OUT, `${nama}.png`);
  await page.screenshot({ path: p });
  return p;
}

/**
 * Stub layanan RAG: cukup untuk menguji alur "RAG hidup" tanpa layanan nyata.
 * Menjawab /health, /knowledge-bases, /knowledge, /search, /extract (422 =
 * endpoint ada), dan /query (jawaban profil instansi). Port acak di localhost.
 */
async function mulaiStubRag() {
  const http = await import('node:http');
  const daftarKb = [
    { knowledge_base_id: 'kb_pam_jaya', documents: 3, chunks: 120, tokens: 45_000, completed: 3, processing: 0, failed: 0, updated_at: '2026-11-01T02:00:00Z' },
    { knowledge_base_id: 'kb_bjb', documents: 2, chunks: 60, tokens: 21_000, completed: 2, processing: 0, failed: 0, updated_at: '2026-11-02T03:00:00Z' },
    { knowledge_base_id: 'kb_demo_baru', documents: 1, chunks: 12, tokens: 4_000, completed: 1, processing: 0, failed: 0, updated_at: '2026-11-03T04:00:00Z' },
  ];
  const daftarDokumen = [
    { document_id: 'doc-1', document_name: 'Laporan Tahunan 2025.pdf', status: 'completed', pages: 42, chunks: 88, tokens: 30_000 },
    { document_id: 'doc-2', document_name: 'Profil Perusahaan.pdf', status: 'completed', pages: 12, chunks: 24, tokens: 9_000 },
    { document_id: 'doc-3', document_name: 'Renja 2026.docx', status: 'completed', pages: 8, chunks: 8, tokens: 6_000 },
  ];
  const sumber = daftarDokumen.map((d) => ({
    document_name: d.document_name,
    page: 3,
    chunk_text: 'contoh potongan dokumen untuk uji',
    score: 0.91,
  }));
  const server = http.createServer((req, res) => {
    const jalur = new URL(req.url, 'http://stub').pathname.replace(/\/+$/, '');
    const kirim = (kode, obj) => {
      res.writeHead(kode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    if (jalur === '/health') return kirim(200, { status: 'ok', service: 'stub-rag' });
    if (jalur === '/knowledge-bases') return kirim(200, { data: { knowledge_bases: daftarKb } });
    if (jalur === '/knowledge') return kirim(200, { data: { documents: daftarDokumen } });
    if (jalur === '/search') return kirim(200, { success: true, data: { sources: sumber } });
    // 422 = endpoint /extract ada tetapi body kosong ditolak (dipakai probe).
    if (jalur === '/extract') return kirim(422, { error: 'body kosong' });
    if (jalur === '/query')
      return kirim(200, {
        success: true,
        data: {
          answer: 'NAMA: Perumda Air Minum Tirta Raharja\nKOTA: Kabupaten Bandung\nSEKTOR: air',
          sources: sumber,
        },
      });
    return kirim(404, { error: `stub tidak punya ${req.method} ${jalur}` });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, tutup: () => server.close() };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const dirData = fs.mkdtempSync(path.join(os.tmpdir(), 'aiones-super-'));
  // Seed minimal supaya jalur "muat state" aktif — di situ `ensureSeedUsers`
  // membuat akun demo Admin Aiones beserta sandi acaknya (dicetak sekali).
  fs.writeFileSync(path.join(dirData, 'db.json'), JSON.stringify({ users: [] }));
  console.log('[super] data sementara:', dirData);

  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HONOR_SHELL_ENV: '1',
      PORT: String(PORT),
      NODE_ENV: 'production',
      AIONESBOARD_DATA_DIR: dirData,
      DEMO_PASSWORD: 'SandiE2eKuat2026',
      BACKUP_OTOMATIS: '0',
      CONFIG_REFRESH_SECONDS: '0',
      MYSQL_HOST: '127.0.0.1',
      MYSQL_PORT: '3307',
      MYSQL_DATABASE: 'aiones_uji_tidak_dipakai',
      SMTP_HOST: '',
      S3_BUCKET: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logServer = '';
  server.stdout.on('data', (d) => (logServer += d.toString()));
  server.stderr.on('data', (d) => (logServer += d.toString()));

  let browser;
  let stub = null;
  try {
    const batas = Date.now() + 90_000;
    let siap = false;
    while (Date.now() < batas) {
      try {
        const r = await fetch(`${BASE}/health`);
        if (r.ok && (await r.json()).status === 'ok') { siap = true; break; }
      } catch { /* belum siap */ }
      await tunggu(500);
    }
    if (!siap) throw new Error('server uji tidak pernah sehat');
    catat('server uji hidup', true, `${BASE} · data sementara`);

    const m = logServer.match(/sandi\s*:\s*(\S+)/);
    if (!m) throw new Error('sandi akun demo Admin Aiones tidak ditemukan di log server');
    const emailSuper = 'admin.aiones@aionesboard.id';

    const rLogin = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailSuper, password: m[1] }),
    });
    if (!rLogin.ok) throw new Error(`login superadmin gagal HTTP ${rLogin.status}`);
    const isiLogin = await rLogin.json();
    const setCookie = (rLogin.headers.getSetCookie?.() ?? [rLogin.headers.get('set-cookie') || '']).join(';');
    const pasangan = setCookie.split(/,\s*/).map((c) => c.split(';')[0]).filter((c) => c.includes('='));
    catat('login API sebagai superadmin', isiLogin.user?.role === 'superadmin', `role=${isiLogin.user?.role}`);

    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
      defaultViewport: { width: 1440, height: 900 },
    });
    const page = await browser.newPage();
    const galatKonsol = [];
    const gagalJaringan = [];
    let abaikanKonsol = false;
    const galatDisengaja = [];
    page.on('console', (x) => {
      if (x.type() !== 'error') return;
      const t = x.text().slice(0, 200);
      // Kegagalan yang memang sengaja dipicu (mis. KMS diarahkan ke port mati)
      // dicatat terpisah supaya gerbang "0 galat konsol" tetap bermakna.
      if (abaikanKonsol) galatDisengaja.push(t);
      else galatKonsol.push(t);
    });
    page.on('pageerror', (e) => galatKonsol.push('pageerror: ' + String(e).slice(0, 200)));
    page.on('requestfailed', (r) => gagalJaringan.push(`${r.method()} ${r.url().replace(BASE, '')} → ${r.failure()?.errorText}`));
    // Respons >=400 dicatat dengan URL-nya: pesan konsol hanya menyebut kode,
    // jadi tanpa ini asal 403/502 tidak bisa dilacak.
    const responsGalat = [];
    page.on('response', (r) => {
      if (r.status() >= 400) responsGalat.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, '')}`);
    });

    let jawabDialog = null;
    const jejakDialog = [];
    page.on('dialog', (d) => {
      jejakDialog.push({ tipe: d.type(), pesan: d.message().slice(0, 160) });
      const j = jawabDialog; jawabDialog = null;
      if (d.type() === 'prompt') d.accept(j ?? ''); else d.accept();
    });

    // Sesi: cookie HttpOnly + localStorage `aionesboard_user` (tanpa mengetik sandi).
    await page.evaluateOnNewDocument((u) => localStorage.setItem('aionesboard_user', u), JSON.stringify(isiLogin.user));
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    for (const c of pasangan) {
      const i = c.indexOf('=');
      await page.setCookie({ name: c.slice(0, i), value: c.slice(i + 1), domain: '127.0.0.1', path: '/' });
    }
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60_000 });
    await tunggu(2000);

    const tabs = await page.$$eval('[data-testid^="admin-tab-"]', (els) =>
      els.map((e) => ({ id: e.getAttribute('data-testid'), teks: (e.textContent || '').trim() }))
    );
    catat('7 tab admin tampil untuk superadmin', tabs.length === 7, tabs.map((t) => t.id).join(', '));

    /* ---------------- 1. overview ---------------- */
    await cek('tab overview: panel utama & angka ringkasan', async () => {
      await bukaTab(page, 'overview');
      await tunggu(1200);
      const t = (await teksHalaman(page)).toUpperCase();
      await foto(page, '01-overview');
      const wajib = ['RINGKASAN PLATFORM', 'INSTANSI TERHUBUNG', 'AKTIVITAS & LOG AUDIT TERAKHIR', 'KUOTA HARI INI'];
      const hilang = wajib.filter((w) => !t.includes(w));
      return { ok: hilang.length === 0, ket: hilang.length ? 'tidak ada: ' + hilang.join(', ') : 'semua panel ada' };
    });

    await cek('overview: tombol "Muat ulang" ringkasan platform', async () => {
      const klik = await page.evaluate(() => {
        const judul = [...document.querySelectorAll('h1,h2,h3')].find((h) => (h.textContent || '').trim() === 'Ringkasan Platform');
        const panel = judul?.parentElement?.parentElement;
        const b = [...(panel?.querySelectorAll('button') || [])].find((x) => (x.textContent || '').includes('Muat ulang'));
        if (!b) return false;
        b.click();
        return true;
      });
      await tunggu(1800);
      const t = (await teksHalaman(page)).toUpperCase();
      return { ok: klik && t.includes('RINGKASAN PLATFORM'), ket: klik ? 'panel tetap tampil setelah muat ulang' : 'tombol tidak ditemukan' };
    });

    await cek('overview: "Lihat Seluruh Log" pindah ke tab audit', async () => {
      await bukaTab(page, 'overview');
      const klik = await klikTeks(page, 'Lihat Seluruh Log');
      await tunggu(1800);
      const t = (await teksHalaman(page)).toUpperCase();
      await foto(page, '01-overview-ke-audit');
      return { ok: klik && t.includes('JEJAK AUDIT & KEPATUHAN'), ket: klik ? (t.includes('JEJAK AUDIT & KEPATUHAN') ? 'tab audit terbuka' : 'tetap di overview') : 'tombol tidak ditemukan' };
    });

    /* ---------------- 2. users ---------------- */
    // Buat satu pendaftaran mandiri supaya kotak "Permintaan Bergabung" terisi.
    const emailPending = `pending.uji.${Date.now()}@contoh.id`;
    const rDaftar = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Calon Anggota Uji', email: emailPending, password: 'UjiPending2026kuat', tenantId: 'tenant-pdam' }),
    });
    catat('siapkan pendaftaran mandiri (pending)', rDaftar.ok || rDaftar.status === 409, `HTTP ${rDaftar.status}`);

    const emailUji = `uji.super.${Date.now()}@contoh.id`;
    await cek('tab users: tabel 5 kolom & tombol tambah', async () => {
      await bukaTab(page, 'users');
      const info = await page.evaluate(() => ({
        kolom: [...document.querySelectorAll('table thead th')].map((e) => (e.textContent || '').trim()),
        baris: document.querySelectorAll('table tbody tr').length,
        adaTambah: [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('Tambah Pengguna')),
      }));
      await foto(page, '02-users');
      return {
        ok: info.kolom.length === 5 && info.adaTambah,
        ket: `kolom=[${info.kolom.join(' | ')}] baris=${info.baris}`,
      };
    });

    await cek('users: tambah pengguna lewat modal', async () => {
      await klikTeks(page, 'Tambah Pengguna Baru');
      await tungguTeks(page, 'Tambah Pengguna BUMD Baru', 5000);
      await isi(page, 'div[role="dialog"] input[type="text"]', 'Pengguna Uji Superadmin');
      await isi(page, 'div[role="dialog"] input[type="email"]', emailUji);
      await pilihOpsi(page, 'div[role="dialog"] select', 'pengguna');
      await klikTeks(page, 'Daftarkan Pengguna');
      const muncul = await tungguTeks(page, emailUji, 10_000);
      const t = await teksHalaman(page);
      await foto(page, '02-users-setelah-tambah');
      return {
        ok: muncul,
        ket: muncul ? 'baris baru tampil' : 'baris tidak muncul' + (t.includes('gagal') ? ' · ada pesan gagal' : ''),
      };
    });

    await cek('users: reset sandi menampilkan sandi sementara', async () => {
      jawabDialog = null;
      const klik = await klikDalam(page, emailUji, 'button[title="Reset kata sandi"]');
      const tampil = await tungguTeks(page, 'Kata sandi sementara untuk', 10_000);
      await foto(page, '02-users-reset-sandi');
      return { ok: klik && tampil, ket: klik ? (tampil ? 'banner sandi tampil' : 'banner tidak muncul') : 'tombol tidak ditemukan' };
    });

    await cek('users: setujui permintaan bergabung', async () => {
      await bukaTab(page, 'users');
      await tunggu(1500);
      const ada = (await teksHalaman(page)).toUpperCase().includes('PERMINTAAN BERGABUNG');
      if (!ada) return { ok: false, ket: 'kotak permintaan bergabung tidak muncul' };
      const setuju = await page.evaluate((email) => {
        const box = [...document.querySelectorAll('div')].find((d) =>
          (d.textContent || '').includes(email) && [...d.querySelectorAll('button')].some((b) => (b.textContent || '').includes('Setujui')));
        const b = [...(box?.querySelectorAll('button') || [])].find((x) => (x.textContent || '').includes('Setujui'));
        if (!b) return false;
        b.click();
        return true;
      }, emailPending);
      await tunggu(2500);
      const t = await teksHalaman(page);
      await foto(page, '02-users-setujui');
      return { ok: setuju, ket: setuju ? 'tombol Setujui diklik' : 'tombol Setujui tidak ditemukan' };
    });

    await cek('users: hapus pengguna uji', async () => {
      jawabDialog = null;
      const klik = await klikDalam(page, emailUji, 'button[title="Hapus Pengguna"]');
      await tunggu(2000);
      // Periksa baris tabel saja: banner "sandi sementara" juga memuat email.
      const masih = await page.evaluate((email) =>
        [...document.querySelectorAll('table tbody tr')].some((r) => (r.textContent || '').includes(email)), emailUji);
      return { ok: klik && !masih, ket: klik ? (masih ? 'baris masih ada' : 'baris hilang') : 'tombol tidak ditemukan' };
    });

    /* ---------------- 3. tenants ---------------- */
    const namaInstansi = `BUMD Uji ${Date.now().toString().slice(-5)}`;
    await cek('tab tenants: aksi massal & kartu instansi', async () => {
      await bukaTab(page, 'tenants');
      await tunggu(1200);
      const info = await page.evaluate(() => ({
        tombol: [...document.querySelectorAll('main button')].map((b) => (b.textContent || '').trim()).filter(Boolean),
        kartu: document.querySelectorAll('main .item-card').length,
        judul: document.querySelector('main h1, main h2')?.textContent?.trim(),
      }));
      await foto(page, '03-tenants');
      const ada = ['Perbarui Semua', 'Katalog KB', 'Daftarkan BUMD Baru'].every((x) => info.tombol.some((b) => b.includes(x)));
      return { ok: ada && info.kartu > 0, ket: `judul="${info.judul}" kartu=${info.kartu} tombol=[${info.tombol.slice(0, 5).join(', ')}]` };
    });

    await cek('tenants: daftarkan instansi baru (KB ID manual)', async () => {
      await klikTeks(page, 'Daftarkan BUMD Baru');
      await tungguTeks(page, 'Knowledge Base', 5000);
      await isi(page, 'div[role="dialog"] input[placeholder="Contoh: kb_pam_jaya"]', 'kb_uji_superadmin');
      await tunggu(1000);
      // Isi per placeholder (persis): urutan kolom modal ini tidak boleh ditebak.
      await isi(page, 'div[role="dialog"] input[placeholder="mis. Perumda Air Minum Tirta Raharja"]', namaInstansi);
      await isi(page, 'div[role="dialog"] input[placeholder="mis. Tirta Raharja"]', 'Uji Super');
      await isi(page, 'div[role="dialog"] input[placeholder="mis. KB_PAM_JAYA"]', 'UJI-SUPER');
      await isi(page, 'div[role="dialog"] input[placeholder="mis. Bandung"]', 'Kota Uji');
      await tunggu(400);
      await klikTeks(page, 'Simpan BUMD');
      const muncul = await tungguTeks(page, namaInstansi, 20_000);
      await foto(page, '03-tenants-setelah-tambah');
      const t = await teksHalaman(page);
      const galat = t.split('\n').find((l) => /wajib diisi|gagal|tidak valid/i.test(l));
      return { ok: muncul, ket: muncul ? 'kartu instansi tampil' : 'kartu tidak muncul' + (galat ? ` · "${galat.slice(0, 120)}"` : '') };
    });

    await cek('tenants: ubah nama instansi lewat modal', async () => {
      const buka = await klikDalam(page, namaInstansi, 'button[title*="Ubah"]');
      await tungguTeks(page, 'Nama Resmi BUMD', 5000);
      await tunggu(2500); // beri waktu efek pembacaan KB selesai
      // Regresi temuan 12: modal Ubah HARUS membuka dengan isian lama, bukan kosong.
      const saatDibuka = await page.evaluate(() => {
        const ambil = (ph) => [...document.querySelectorAll('div[role="dialog"] input[type="text"]')]
          .find((i) => i.getAttribute('placeholder') === ph)?.value;
        return { nama: ambil('mis. Perumda Air Minum Tirta Raharja'), kota: ambil('mis. Bandung') };
      });
      await isi(page, 'div[role="dialog"] input[placeholder="mis. Perumda Air Minum Tirta Raharja"]', namaInstansi + ' (diubah)');
      await tunggu(400);
      await klikTeks(page, 'Simpan BUMD');
      const muncul = await tungguTeks(page, '(diubah)', 20_000);
      await foto(page, '03-tenants-setelah-ubah');
      const praIsi = saatDibuka.nama === namaInstansi && (saatDibuka.kota || '').length > 0;
      return {
        ok: buka && praIsi && muncul,
        ket: `buka=${buka} namaSaatDibuka="${saatDibuka.nama}" kotaSaatDibuka="${saatDibuka.kota}" berubah=${muncul}`,
      };
    });

    await cek('tenants: hapus instansi uji', async () => {
      jawabDialog = null;
      const klik = await klikDalam(page, '(diubah)', 'button[title*="Hapus"]');
      await tunggu(2500);
      const masih = (await teksHalaman(page)).includes('(diubah)');
      return { ok: klik && !masih, ket: klik ? (masih ? 'kartu masih ada' : 'kartu hilang') : 'tombol hapus tidak ditemukan' };
    });

    /* ---------------- 4. rag ---------------- */
    await cek('tab rag: bagian konfigurasi tampil', async () => {
      await bukaTab(page, 'rag');
      const t = await teksHalaman(page);
      await foto(page, '04-rag');
      const wajib = ['Pilih sumber data', 'Demo lokal', 'Layanan RAG', 'Knowledge Base'];
      const hilang = wajib.filter((w) => !t.includes(w));
      return { ok: hilang.length === 0, ket: hilang.length ? 'tidak ada: ' + hilang.join(', ') : 'semua bagian ada' };
    });

    await cek('rag: ganti mode & bilah "belum disimpan" muncul', async () => {
      const awal = await page.evaluate(() => document.querySelector('[data-testid="mode-demo"]')?.getAttribute('aria-pressed'));
      // Tinggalkan perubahan (demo → layanan RAG) supaya bilah "belum disimpan" muncul.
      await klikTestId(page, 'mode-rag');
      await tunggu(1500);
      const t = await teksHalaman(page);
      const bilah = t.includes('belum disimpan');
      await foto(page, '04-rag-berubah');
      return { ok: bilah, ket: `aria-pressed awal=${awal} · bilah=${bilah}` };
    });

    await cek('rag: simpan pengaturan', async () => {
      const klik = await klikTestId(page, 'simpan-rag');
      const sukses = await tungguTeks(page, 'Pengaturan tersimpan', 15_000);
      await foto(page, '04-rag-tersimpan');
      return { ok: klik && sukses, ket: klik ? (sukses ? 'banner sukses tampil' : 'banner sukses tidak muncul') : 'tombol simpan tidak ada' };
    });

    await cek('rag: tombol "Uji koneksi" memberi hasil', async () => {
      await klikTeks(page, 'Uji koneksi');
      await tunggu(5000);
      const t = await teksHalaman(page);
      await foto(page, '04-rag-uji-koneksi');
      const hasil = ['Sehat', 'Terhubung', 'Gagal', 'gagal', 'mock', 'Demo', 'tidak'].some((k) => t.includes(k));
      return { ok: hasil, ket: 'lihat 04-rag-uji-koneksi.png' };
    });

    await cek('rag: kembalikan ke mode demo', async () => {
      await klikTestId(page, 'mode-demo');
      await tunggu(900);
      await klikTestId(page, 'simpan-rag');
      const sukses = await tungguTeks(page, 'Pengaturan tersimpan', 15_000);
      return { ok: sukses, ket: sukses ? 'mode demo tersimpan lagi' : 'gagal menyimpan ulang' };
    });

    /* ---------------- 5. kuota ---------------- */
    await cek('tab kuota: tabel pemakaian & simpan nilai baru', async () => {
      await bukaTab(page, 'kuota');
      await tunggu(1800);
      const t0 = await teksHalaman(page);
      const adaTabel = t0.includes('Pemakaian hari ini');
      await isi(page, '[data-testid="input-kuota-ai"]', '25');
      await tunggu(400);
      await klikTestId(page, 'simpan-kuota-ai');
      const sukses = await tungguTeks(page, 'Kuota tersimpan', 15_000);
      await foto(page, '05-kuota');
      return { ok: adaTabel && sukses, ket: `tabel=${adaTabel} sukses=${sukses}` };
    });

    /* ---------------- 6. alerts ---------------- */
    await cek('tab alerts: daftar aturan tampil', async () => {
      await bukaTab(page, 'alerts');
      await tunggu(1500);
      const info = await page.evaluate(() => ({
        judul: document.querySelector('main h3')?.textContent?.trim(),
        aturan: document.querySelectorAll('main button[title="Nonaktifkan"], main button[title="Aktifkan"]').length,
      }));
      await foto(page, '06-alerts');
      return { ok: info.aturan > 0, ket: `judul="${info.judul}" · aturan=${info.aturan}` };
    });

    await cek('alerts: aktif/nonaktif satu aturan', async () => {
      const sebelum = await page.evaluate(() => {
        const b = document.querySelector('main button[title="Nonaktifkan"]') || document.querySelector('main button[title="Aktifkan"]');
        if (!b) return null;
        const t = b.getAttribute('title');
        b.click();
        return t;
      });
      await tunggu(3000);
      const sesudah = await page.evaluate(() => {
        const b = document.querySelector('main button[title="Nonaktifkan"]') || document.querySelector('main button[title="Aktifkan"]');
        return b?.getAttribute('title');
      });
      return { ok: !!sebelum && sebelum !== sesudah, ket: `sebelum=${sebelum} sesudah=${sesudah}` };
    });

    await cek('alerts: ubah ambang batas lewat prompt', async () => {
      jawabDialog = '37';
      const klik = await page.evaluate(() => {
        const b = document.querySelector('main button[title="Ubah ambang batas"]');
        if (!b) return false;
        b.click();
        return true;
      });
      await tunggu(3000);
      const t = await teksHalaman(page);
      await foto(page, '06-alerts-ambang');
      return { ok: klik && /37/.test(t), ket: klik ? 'nilai 37 dicari di halaman' : 'tombol tidak ada' };
    });

    /* ---------------- 7. audit ---------------- */
    await cek('tab audit: tabel & penyaring', async () => {
      await bukaTab(page, 'audit');
      await tunggu(1800);
      const info = await page.evaluate(() => ({
        kolom: [...document.querySelectorAll('table thead th')].map((e) => (e.textContent || '').trim()),
        baris: document.querySelectorAll('table tbody tr').length,
        adaFilter: !!document.querySelector('[data-testid="filter-audit-instansi"]'),
        adaCari: !!document.querySelector('[data-testid="filter-audit-aksi"]'),
      }));
      await foto(page, '07-audit');
      return { ok: info.kolom.length === 5 && info.adaFilter && info.adaCari && info.baris > 0, ket: `kolom=${info.kolom.length} baris=${info.baris}` };
    });

    await cek('audit: cari aksi "Login" memfilter baris', async () => {
      const sebelum = await page.evaluate(() => document.querySelectorAll('table tbody tr').length);
      await isi(page, '[data-testid="filter-audit-aksi"]', 'Login');
      await klikTestId(page, 'muat-audit');
      await tunggu(3000);
      const info = await page.evaluate(() => ({
        baris: document.querySelectorAll('table tbody tr').length,
        contoh: document.querySelector('table tbody tr')?.textContent?.slice(0, 80) || '',
      }));
      await foto(page, '07-audit-filter');
      return { ok: info.baris > 0 && info.baris <= sebelum, ket: `sebelum=${sebelum} sesudah=${info.baris} · ${info.contoh}` };
    });

    /* ---------------- 8. katalog KB ---------------- */
    await cek('katalog KB: panel terbuka dari tab tenants', async () => {
      await bukaTab(page, 'tenants');
      await klikTestId(page, 'katalog-kb');
      const terbuka = await page.waitForSelector('[data-testid="panel-katalog-kb"]', { timeout: 8000 }).then(() => true).catch(() => false);
      await tunggu(3500);
      const t = await teksHalaman(page);
      await foto(page, '08-katalog-kb');
      const galat = /Gagal membaca katalog|tidak melaporkan knowledge base|tidak ada KB yang cocok/i.test(t);
      return {
        ok: terbuka,
        ket: terbuka ? (galat ? 'panel terbuka · katalog kosong/galat (RAG tidak hidup)' : 'panel terbuka dengan data') : 'panel tidak terbuka',
      };
    });

    /* ============ BAGIAN 2: RAG hidup (stub) & sisa fitur ============ */
    stub = await mulaiStubRag();
    catat('stub layanan RAG hidup', true, stub.url);

    await cek('rag: isi Base URL + API Key, lalu "Uji kunci ini"', async () => {
      await bukaTab(page, 'rag');
      await tunggu(1200);
      await klikTestId(page, 'mode-rag');
      await tunggu(700);
      const isiUrl = await isi(page, '[data-testid="input-rag-url"]', stub.url);
      const isiKey = await isi(page, '[data-testid="input-rag-key"]', 'kunci-stub-uji');
      await tunggu(500);
      const klik = await klikTeks(page, 'Uji kunci ini');
      const ok = await tungguTeks(page, 'Kunci diterima', 30_000);
      await foto(page, '09-rag-kunci');
      const t = await teksHalaman(page);
      return {
        ok: isiUrl && isiKey && klik && ok,
        ket: `url=${isiUrl} key=${isiKey} klik=${klik} diterima=${ok}${ok ? '' : ' · ' + t.slice(0, 140)}`,
      };
    });

    await cek('rag: "Uji koneksi" ke layanan hidup → berjalan normal', async () => {
      await klikTeks(page, 'Uji koneksi');
      const sehat = await tungguTeks(page, 'RAG berjalan normal', 30_000);
      const t = await teksHalaman(page);
      await foto(page, '09-rag-uji-koneksi-hidup');
      const mode = (t.match(/Mode terdeteksi:\s*([^\n]+)/) || [])[1] || '';
      const potongan = (t.match(/potongan dokumen terambil:\s*(\d+)/) || [])[1] || '';
      return { ok: sehat, ket: `normal=${sehat} mode="${mode.trim()}" potongan=${potongan}` };
    });

    await cek('rag: "Periksa isi" KB default membaca daftar dokumen', async () => {
      await isi(page, '#kbDefault', 'kb_pam_jaya');
      await tunggu(600);
      await klikTeks(page, 'Periksa isi');
      const ok = await tungguTeks(page, 'memuat 3 dokumen', 30_000);
      const t = await teksHalaman(page);
      await foto(page, '09-rag-periksa-isi');
      const adaDoc = t.includes('Laporan Tahunan 2025.pdf');
      return { ok: ok && adaDoc, ket: `3dokumen=${ok} namaDokumen=${adaDoc}` };
    });

    await cek('rag: "Jadikan default" menyimpan KB default', async () => {
      const klik = await klikTeks(page, 'Jadikan default');
      const ok = await tungguTeks(page, 'Pengaturan tersimpan', 15_000);
      await tunggu(900);
      const t = await teksHalaman(page);
      return { ok: klik && ok, ket: `klik=${klik} banner=${ok} headerKB=${t.includes('kb_pam_jaya')}` };
    });

    await cek('rag: "Simpan & uji KMS" memberi hasil yang bisa dibaca', async () => {
      await page.evaluate(() => {
        const d = document.querySelector('[data-testid="konfigurasi-kms"]');
        if (d && !d.open) d.open = true;
      });
      await tunggu(600);
      await isi(page, '[data-testid="input-kms-url"]', 'http://127.0.0.1:9');
      await isi(page, '[data-testid="input-kms-key"]', 'kunci-kms-uji');
      await tunggu(500);
      abaikanKonsol = true; // KMS sengaja diarahkan ke port mati
      await klikTestId(page, 'uji-kms');
      await page.waitForSelector('[data-testid="hasil-uji-kms"]', { timeout: 30_000 }).catch(() => {});
      await tunggu(1200);
      abaikanKonsol = false;
      const teks = await page.evaluate(
        () => document.querySelector('[data-testid="hasil-uji-kms"]')?.innerText?.slice(0, 200) || ''
      );
      await foto(page, '14-rag-kms');
      // Temuan 4: pesan gagal KMS harus menyebut tujuan yang dicoba, bukan
      // hanya "Gagal menghubungi repositori dokumen."
      const sebutTujuan = /127\.0\.0\.1:9|Tujuan:/.test(teks);
      return {
        ok: teks.length > 0 && sebutTujuan,
        ket: `${teks.replace(/\n/g, ' | ').slice(0, 150)}${sebutTujuan ? '' : ' · TANPA tujuan'}`,
      };
    });

    await cek('tenants: identitas instansi terisi otomatis dari KB', async () => {
      await bukaTab(page, 'tenants');
      await tunggu(1200);
      await klikTeks(page, 'Daftarkan BUMD Baru');
      await tunggu(900);
      await isi(page, 'div[role="dialog"] input[placeholder="Contoh: kb_pam_jaya"]', 'kb_pam_jaya');
      await page
        .waitForFunction(
          () =>
            [...document.querySelectorAll('div[role="dialog"] input[type="text"]')].some((i) =>
              i.value.includes('Tirta Raharja')
            ),
          { timeout: 30_000 }
        )
        .catch(() => {});
      const nilai = await page.evaluate(() => {
        const ambil = (ph) =>
          [...document.querySelectorAll('div[role="dialog"] input[type="text"]')].find(
            (i) => i.getAttribute('placeholder') === ph
          )?.value || '';
        return {
          nama: ambil('mis. Perumda Air Minum Tirta Raharja'),
          kota: ambil('mis. Bandung'),
          kode: ambil('mis. KB_PAM_JAYA'),
        };
      });
      await foto(page, '10-tenants-autoisi-kb');
      await klikTeks(page, 'Batal');
      await tunggu(700);
      const ok = nilai.nama.includes('Tirta Raharja') && nilai.kota.length > 0;
      return { ok, ket: `nama="${nilai.nama}" kota="${nilai.kota}" kode="${nilai.kode}"` };
    });

    await cek('tenants: "Perbarui RAG" satu instansi membaca ulang KB', async () => {
      const klik = await page.evaluate(() => {
        const kartu = [...document.querySelectorAll('.item-card')].find((e) =>
          /KB:\s*kb_/.test(e.textContent || '')
        );
        const b = kartu?.querySelector('button[title^="Baca ulang isi KB"]');
        if (!b) return false;
        b.click();
        return true;
      });
      await tunggu(4000);
      const t = await teksHalaman(page);
      await foto(page, '10-tenants-sinkron');
      const tersinkron = t.includes('Terakhir disinkronkan');
      const banner = /dokumen baru|dokumen hilang|tersinkron|tidak ada perubahan/i.test(t);
      return { ok: klik && (tersinkron || banner), ket: `klik=${klik} terakhirDisinkronkan=${tersinkron} banner=${banner}` };
    });

    await cek('katalog KB: daftar hidup, saring, lalu "Pakai" ke instansi', async () => {
      await bukaTab(page, 'tenants');
      await klikTestId(page, 'katalog-kb');
      const daftar = await page
        .waitForSelector('[data-testid="kb-kb_bjb"]', { timeout: 25_000 })
        .then(() => true)
        .catch(() => false);
      const ringkasKatalog = await page.evaluate(
        () => document.querySelector('[data-testid="panel-katalog-kb"]')?.innerText?.slice(0, 260) || ''
      );
      await foto(page, '11-katalog-hidup');
      await isi(page, '[data-testid="katalog-cari"]', 'bjb');
      await tunggu(900);
      const sesudahCari = await page.evaluate(
        () => document.querySelectorAll('[data-testid="panel-katalog-kb"] [data-testid^="kb-"]').length
      );
      await isi(page, '[data-testid="katalog-cari"]', '');
      await tunggu(700);
      const pilih = await pilihOpsi(page, '[data-testid="pilih-instansi-kb_bjb"]', 'tenant-rsud');
      await tunggu(500);
      const pasang = await klikTestId(page, 'pakai-kb_bjb');
      const banner = await tungguTeks(page, 'kb_bjb', 25_000);
      await tunggu(1500);
      await foto(page, '11-katalog-pakai');
      const tutup = await page.evaluate(() => {
        const b = document.querySelector('[data-testid="panel-katalog-kb"] [aria-label="Tutup"]');
        if (!b) return false;
        b.click();
        return true;
      });
      return {
        ok: daftar && sesudahCari === 1 && pilih && pasang && banner && tutup,
        ket: `daftar=${daftar} saring(bjb)=${sesudahCari} pilih=${pilih} pakai=${pasang} banner=${banner} · ${ringkasKatalog
          .replace(/\n/g, ' | ')
          .slice(0, 130)}`,
      };
    });

    await cek('users: "Tolak" permintaan bergabung menghapus baris', async () => {
      const reg = await fetch(`${BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'E2E Tolak',
          email: `e2e.tolak.${Date.now()}@contoh.id`,
          password: 'RahasiaUji123!',
          tenantId: 'tenant-pdam',
        }),
      });
      // Kotak "Permintaan Bergabung" hanya dirender kalau sudah ada isinya,
      // jadi tombol "Muat ulang permintaan" belum ada saat daftar kosong.
      // Muat ulang halaman = jalur yang dipakai admin (loadData saat mount).
      await page.reload({ waitUntil: 'networkidle2' });
      await tunggu(2500);
      await bukaTab(page, 'users');
      await tunggu(2000);
      const adaBaris = (await teksHalaman(page)).includes('E2E Tolak');
      const tolak = await page.evaluate(() => {
        const tombol = [...document.querySelectorAll('main button')].filter(
          (x) => (x.textContent || '').trim() === 'Tolak'
        );
        const target = tombol.find((x) => {
          let p = x;
          for (let i = 0; i < 4 && p; i++) {
            if ((p.textContent || '').includes('E2E Tolak')) return true;
            p = p.parentElement;
          }
          return false;
        });
        if (!target) return false;
        target.click();
        return true;
      });
      await tunggu(3500);
      // Akun yang ditolak tetap ada di tabel pengguna (status nonaktif/ditolak),
      // jadi yang harus hilang adalah barisnya di kotak "Permintaan Bergabung".
      const sisaTolak = await page.evaluate(
        () => [...document.querySelectorAll('main button')].filter((x) => (x.textContent || '').trim() === 'Tolak').length
      );
      const masihPending = await page.evaluate(() =>
        [...document.querySelectorAll('main div')].some((e) => {
          const t = e.textContent || '';
          return t.includes('Permintaan Bergabung') && t.includes('E2E Tolak');
        })
      );
      await foto(page, '12-users-tolak');
      return {
        ok: reg.ok && adaBaris && tolak && sisaTolak === 0,
        ket: `daftar=${reg.ok} barisTampil=${adaBaris} klik=${tolak} tombolTolakSisa=${sisaTolak} masihDiKotak=${masihPending}`,
      };
    });

    await cek('audit: penyaring instansi mengubah jumlah baris', async () => {
      await bukaTab(page, 'audit');
      await tunggu(1800);
      await isi(page, '[data-testid="filter-audit-aksi"]', '');
      await klikTestId(page, 'muat-audit');
      await tunggu(3000);
      const semua = await page.evaluate(() => document.querySelectorAll('table tbody tr').length);
      const pilih = await pilihOpsi(page, '[data-testid="filter-audit-instansi"]', 'tenant-pdam');
      await tunggu(3500);
      const satu = await page.evaluate(() => document.querySelectorAll('table tbody tr').length);
      await foto(page, '12-audit-filter-instansi');
      return {
        ok: pilih && semua > 0 && satu > 0 && satu <= semua,
        ket: `semua=${semua} tenant-pdam=${satu}`,
      };
    });

    await cek('audit: tombol "Ekspor CSV" mengunduh berkas CSV', async () => {
      await bukaTab(page, 'audit');
      await tunggu(1800);
      // Tombol harus benar-benar ada di layar, bukan hanya endpoint yang siap.
      const href = await page.evaluate(() => {
        const a = document.querySelector('[data-testid="ekspor-audit-csv"]');
        return a ? a.getAttribute('href') : null;
      });
      const hasil = await page.evaluate(async (url) => {
        if (!url) return null;
        const r = await fetch(url);
        return {
          status: r.status,
          tipe: r.headers.get('content-type') || '',
          baris: (await r.text()).split('\n').filter(Boolean).length,
        };
      }, href);
      await foto(page, '12-audit-ekspor-csv');
      return {
        ok: !!href && /format=csv/.test(href) && hasil?.status === 200 && /csv/.test(hasil?.tipe || '') && hasil.baris > 1,
        ket: href ? `href=${href.slice(0, 70)}… status=${hasil?.status} tipe=${hasil?.tipe} baris=${hasil?.baris}` : 'tombol ekspor tidak ada',
      };
    });

    await cek('audit: paginasi UI menampilkan total & membatasi satu halaman', async () => {
      await bukaTab(page, 'audit');
      await tunggu(2200);
      const info = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="info-audit"]');
        return {
          teks: el ? el.textContent.trim() : '',
          baris: document.querySelectorAll('table tbody tr').length,
          adaSebelum: !!document.querySelector('[data-testid="audit-sebelumnya"]'),
          adaBerikut: !!document.querySelector('[data-testid="audit-berikutnya"]'),
        };
      });
      // "Berikutnya" hanya aktif kalau total > 50; kalau data uji lebih sedikit,
      // yang penting tombolnya ada dan halaman pertama tidak melebihi 50 baris.
      const berikutAktif = await page.evaluate(() => {
        const b = document.querySelector('[data-testid="audit-berikutnya"]');
        return !!b && !b.disabled;
      });
      await foto(page, '12-audit-paginasi');
      return {
        ok: info.adaSebelum && info.adaBerikut && info.baris <= 50 && /baris/.test(info.teks),
        ket: `info="${info.teks}" baris=${info.baris} berikutAktif=${berikutAktif}`,
      };
    });

    await cek('alerts: "Hapus aturan" menghilangkan aturan', async () => {
      await bukaTab(page, 'alerts');
      await tunggu(1800);
      const sebelum = await page.evaluate(() => document.querySelectorAll('main button[title="Hapus aturan"]').length);
      const klik = await page.evaluate(() => {
        const b = document.querySelector('main button[title="Hapus aturan"]');
        if (!b) return false;
        b.click();
        return true;
      });
      await tunggu(3500);
      const sesudah = await page.evaluate(() => document.querySelectorAll('main button[title="Hapus aturan"]').length);
      await foto(page, '13-alerts-hapus');
      return { ok: klik && sesudah === sebelum - 1, ket: `sebelum=${sebelum} sesudah=${sesudah}` };
    });

    await cek('kuota: "Muat ulang" mempertahankan nilai tersimpan', async () => {
      await bukaTab(page, 'kuota');
      await tunggu(1500);
      await klikTeks(page, 'Muat ulang');
      await tunggu(2500);
      const nilai = await page.evaluate(() => document.querySelector('[data-testid="input-kuota-ai"]')?.value);
      return { ok: String(nilai) === '25', ket: `nilai=${nilai}` };
    });

    await cek('negatif: admin instansi tanpa tab kuota & API kuota ditolak', async () => {
      const r = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@aionesboard.id', password: 'SandiE2eKuat2026' }),
      });
      if (!r.ok) return { ok: false, ket: `login admin instansi gagal HTTP ${r.status}` };
      const j = await r.json();
      const sc = (r.headers.getSetCookie?.() ?? [r.headers.get('set-cookie') || '']).join(';');
      // Konteks browser terpisah: cookie sesi disimpan per konteks, jadi login
      // admin instansi di sini TIDAK menimpa sesi superadmin di halaman utama.
      const ctx2 = await browser.createBrowserContext();
      const p2 = await ctx2.newPage();
      await p2.evaluateOnNewDocument((u) => localStorage.setItem('aionesboard_user', u), JSON.stringify(j.user));
      await p2.goto(BASE, { waitUntil: 'domcontentloaded' });
      for (const c of sc.split(/,\s*/).map((x) => x.split(';')[0]).filter((x) => x.includes('='))) {
        const i = c.indexOf('=');
        await p2.setCookie({ name: c.slice(0, i), value: c.slice(i + 1), domain: '127.0.0.1', path: '/' });
      }
      await p2.goto(BASE, { waitUntil: 'networkidle2' });
      await tunggu(2500);
      const info = await p2.evaluate(async () => ({
        tab: [...document.querySelectorAll('[data-testid^="admin-tab-"]')].map((e) => e.getAttribute('data-testid')),
        kuota: await fetch('/api/admin/kuota').then((x) => x.status).catch(() => 0),
        // Admin instansi mencoba menarik log instansi lain lewat URL — harus
        // tetap dibatasi ke instansinya sendiri (bukan 200 berisi data orang lain).
        audit: await fetch('/api/audit-logs?tenantId=tenant-bank')
          .then(async (r) => {
            if (!r.ok) return `HTTP ${r.status}`;
            const j = await r.json().catch(() => []);
            const arr = Array.isArray(j) ? j : j?.logs || [];
            return arr.length > 0 && arr.every((x) => x.tenantId === 'tenant-pdam')
              ? 'hanya-instansi-sendiri'
              : 'BOCOR';
          })
          .catch(() => 'galat'),
        // Temuan 1: tab Instansi/RAG disembunyikan, jadi endpoint-nya juga harus
        // menolak Admin Instansi yang memanggil langsung.
        tenantsBuat: await fetch('/api/admin/tenants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'BUMD Selundupan' }),
        }).then((r) => r.status).catch(() => 0),
        configSimpan: await fetch('/api/admin/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ragProvider: 'mock' }),
        }).then((r) => r.status).catch(() => 0),
        katalogKb: await fetch('/api/admin/kb-tersedia').then((r) => r.status).catch(() => 0),
        // Temuan 5: pengguna biasa tidak boleh menulis entri audit bebas.
        tulisAudit: await fetch('/api/audit-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'Palsu', target: 'Palsu', details: 'dipalsukan' }),
        }).then((r) => r.status).catch(() => 0),
      }));
      await p2.screenshot({ path: path.join(OUT, '15-peran-admin.png') });
      await ctx2.close();
      const tanpaKuota = !info.tab.includes('admin-tab-kuota');
      const terkunci =
        info.tenantsBuat === 403 && info.configSimpan === 403 && info.katalogKb === 403 && info.tulisAudit === 403;
      return {
        ok: tanpaKuota && info.kuota === 403 && info.audit === 'hanya-instansi-sendiri' && terkunci,
        ket: `role=${j.user?.role} tab=[${info.tab.join(',')}] apiKuota=${info.kuota} audit=${info.audit} · tenants=${info.tenantsBuat} config=${info.configSimpan} kbTersedia=${info.katalogKb} tulisAudit=${info.tulisAudit}`,
      };
    });

    await cek('tenants: instansi baru menyimpan pemetaan KMS (bukan dibuang)', async () => {
      const hasil = await page.evaluate(async () => {
        const buat = await fetch('/api/admin/tenants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'BUMD KMS Uji', kmsOrganizationId: 'org-uji-kms-1' }),
        });
        const baru = await buat.json().catch(() => ({}));
        const daftar = await fetch('/api/tenants').then((r) => r.json()).catch(() => []);
        const arr = Array.isArray(daftar) ? daftar : daftar?.tenants || [];
        const tersimpan = arr.find((t) => t.id === baru.id);
        if (baru.id) await fetch(`/api/admin/tenants/${baru.id}`, { method: 'DELETE' }).catch(() => {});
        return { status: buat.status, kms: tersimpan?.kmsOrganizationId ?? null };
      });
      return {
        ok: hasil.status === 201 && hasil.kms === 'org-uji-kms-1',
        ket: `status=${hasil.status} kmsOrganizationId=${hasil.kms}`,
      };
    });

    await cek('users: ubah peran lewat pilihan di tabel (PATCH /api/admin/users/:id)', async () => {
      await bukaTab(page, 'users');
      await tunggu(1500);
      const sebelum = await page.evaluate(() => {
        const sel = [...document.querySelectorAll('main select[aria-label^="Peran "]')].find((s) => !s.disabled);
        if (!sel) return null;
        const tr = sel.closest('tr');
        return {
          label: sel.getAttribute('aria-label'),
          role: sel.value,
          email: tr?.children[1]?.textContent?.trim() || '',
        };
      });
      if (!sebelum) return { ok: false, ket: 'tidak ada pilihan peran yang bisa diubah' };
      const tujuan = sebelum.role === 'pengguna' ? 'admin' : 'pengguna';
      await page.evaluate(
        (label, nilai) => {
          const sel = [...document.querySelectorAll('main select[aria-label^="Peran "]')].find(
            (s) => s.getAttribute('aria-label') === label
          );
          if (!sel) return false;
          const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
          setter.call(sel, nilai);
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        },
        sebelum.label,
        tujuan
      );
      await tunggu(2500);
      // Cocokkan lewat nama (diambil dari aria-label select) — kolom email bisa
      // berisi teks lain, dan kecocokan string email pernah membuat langkah ini
      // melaporkan "server=null" padahal PATCH-nya berhasil.
      const nama = sebelum.label.replace(/^Peran\s+/, '');
      const tersimpan = await page.evaluate(async (n) => {
        const r = await fetch('/api/admin/users');
        const j = await r.json().catch(() => null);
        const arr = Array.isArray(j) ? j : j?.users || [];
        return arr.find((x) => x.name === n)?.role || null;
      }, nama);
      await foto(page, '16-users-ubah-peran');
      // Kembalikan peran semula supaya langkah berikutnya tidak terpengaruh.
      await page.evaluate(
        (label, nilai) => {
          const sel = [...document.querySelectorAll('main select[aria-label^="Peran "]')].find(
            (s) => s.getAttribute('aria-label') === label
          );
          if (!sel) return false;
          const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
          setter.call(sel, nilai);
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        },
        sebelum.label,
        sebelum.role
      );
      await tunggu(1800);
      return {
        ok: tersimpan === tujuan,
        ket: `${nama}: ${sebelum.role} → ${tujuan} · server=${tersimpan}`,
      };
    });

    await cek('users: kotak permintaan kosong tetap punya tombol muat ulang', async () => {
      await bukaTab(page, 'users');
      await tunggu(1500);
      const info = await page.evaluate(() => {
        const tombol = [...document.querySelectorAll('main button')].find(
          (b) => (b.getAttribute('title') || '') === 'Muat ulang permintaan'
        );
        const kotak = [...document.querySelectorAll('main div')].find((d) =>
          (d.textContent || '').includes('Tidak ada pendaftaran yang menunggu persetujuan.')
        );
        return { adaTombol: !!tombol && tombol.offsetParent !== null, adaKosong: !!kotak };
      });
      const klik = await page.evaluate(() => {
        const b = [...document.querySelectorAll('main button')].find(
          (x) => (x.getAttribute('title') || '') === 'Muat ulang permintaan'
        );
        if (!b) return false;
        b.click();
        return true;
      });
      await tunggu(2000);
      return { ok: info.adaTombol && info.adaKosong && klik, ket: `tombol=${info.adaTombol} teksKosong=${info.adaKosong} klik=${klik}` };
    });

    await cek('aksesibilitas: area klik tombol ikon minimal 44 px', async () => {
      await bukaTab(page, 'users');
      await tunggu(1200);
      const ukuran = await page.evaluate(() => {
        const ukur = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height) };
        };
        return {
          reset: ukur(document.querySelector('main button[aria-label^="Reset kata sandi"]')),
          hapus: ukur(document.querySelector('main button[aria-label^="Hapus "]')),
          sidebar: ukur(document.querySelector('button[aria-label="Buka atau tutup sidebar"]')),
        };
      });
      const cukup = (u) => !!u && u.w >= 44 && u.h >= 44;
      return {
        ok: cukup(ukuran.reset) && cukup(ukuran.hapus) && cukup(ukuran.sidebar),
        ket: `reset=${ukuran.reset?.w}×${ukuran.reset?.h} hapus=${ukuran.hapus?.w}×${ukuran.hapus?.h} sidebar=${ukuran.sidebar?.w}×${ukuran.sidebar?.h}`,
      };
    });

    await cek('mobile 390 px: tabel Pengguna & Audit jadi kartu, tanpa scroll horizontal', async () => {
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await bukaTab(page, 'users');
      await tunggu(1500);
      const users = await page.evaluate(() => {
        const kartu = document.querySelector('[data-testid="pengguna-kartu"]');
        const tabel = document.querySelector('main table');
        const main = document.querySelector('main');
        return {
          kartu: !!kartu && kartu.offsetParent !== null,
          tabelTersembunyi: !tabel || tabel.offsetParent === null,
          lebih: main ? main.scrollWidth - main.clientWidth : 999,
        };
      });
      await foto(page, '17-users-390');
      await bukaTab(page, 'audit');
      await tunggu(1800);
      const audit = await page.evaluate(() => {
        const kartu = document.querySelector('[data-testid="audit-kartu"]');
        const tabel = document.querySelector('main table');
        const main = document.querySelector('main');
        return {
          kartu: !!kartu && kartu.offsetParent !== null,
          tabelTersembunyi: !tabel || tabel.offsetParent === null,
          lebih: main ? main.scrollWidth - main.clientWidth : 999,
        };
      });
      await foto(page, '18-audit-390');
      await page.setViewport({ width: 1440, height: 900 });
      await page.reload({ waitUntil: 'networkidle2' });
      await tunggu(1500);
      return {
        ok:
          users.kartu && users.tabelTersembunyi && users.lebih <= 1 &&
          audit.kartu && audit.tabelTersembunyi && audit.lebih <= 1,
        ket: `users kartu=${users.kartu} tabelSembunyi=${users.tabelTersembunyi} overflow=${users.lebih} · audit kartu=${audit.kartu} tabelSembunyi=${audit.tabelTersembunyi} overflow=${audit.lebih}`,
      };
    });

    await cek('bersih: kembalikan provider RAG ke mode demo', async () => {
      await bukaTab(page, 'rag');
      await tunggu(1200);
      await klikTestId(page, 'mode-demo');
      await tunggu(900);
      await klikTestId(page, 'simpan-rag');
      const ok = await tungguTeks(page, 'Pengaturan tersimpan', 15_000);
      return { ok, ket: ok ? 'mode demo tersimpan lagi' : 'gagal menyimpan ulang' };
    });

    /* ============ BAGIAN 3: audit UX (lapis angka) ============ */
    const berkasProbe = path.join('scripts', 'ux-probe.page.js');
    const uxSrc = fs.existsSync(berkasProbe) ? fs.readFileSync(berkasProbe, 'utf8') : '';
    const auditUx = {};
    if (uxSrc) {
      for (const tab of ['overview', 'users', 'tenants', 'rag', 'kuota', 'alerts', 'audit']) {
        await bukaTab(page, tab);
        await tunggu(1600);
        for (const [label, vp] of [
          ['desktop', { width: 1440, height: 900 }],
          ['mobile', { width: 390, height: 844 }],
        ]) {
          await page.setViewport(vp);
          await tunggu(900);
          await page.addScriptTag({ content: uxSrc });
          const r = await page
            .evaluate((mob) => (typeof uxProbe === 'function' ? uxProbe({ mobile: mob }) : null), label === 'mobile')
            .catch(() => null);
          if (label === 'mobile') await page.screenshot({ path: path.join(OUT, `ux-${tab}-390.png`) });
          auditUx[`${tab}-${label}`] = r
            ? {
                skor: r.score,
                nilai: r.grade,
                terburuk: r.worst,
                potongan: (r.deductions || []).slice(0, 8).map((d) => JSON.parse(JSON.stringify(d))),
              }
            : null;
          await page.setViewport({ width: 1440, height: 900 });
          await tunggu(400);
        }
      }
      const daftar = Object.entries(auditUx)
        .map(([k, v]) => `${k}=${v ? v.skor : '-'}`)
        .join(' ');
      const terendah = Object.entries(auditUx)
        .filter(([, v]) => v)
        .sort((a, b) => a[1].skor - b[1].skor)[0];
      catat('audit UX 7 tab (desktop + mobile) terukur', !!terendah, `${daftar} · terendah=${terendah?.[0]}:${terendah?.[1]?.skor}`);
    } else {
      catat('audit UX dilewati', false, 'scripts/ux-probe.page.js tidak ada');
    }

    const ringkas = {
      waktu: new Date().toISOString(),
      base: BASE,
      tabs,
      langkah,
      jejakDialog,
      galatKonsol: galatKonsol.slice(0, 25),
      galatKonsolDisengaja: galatDisengaja.slice(0, 10),
      responsGalat: responsGalat.slice(0, 20),
      auditUx,
      gagalJaringan: gagalJaringan.slice(0, 25),
      lulus: langkah.filter((l) => l.ok).length,
      total: langkah.length,
    };
    fs.writeFileSync(path.join(OUT, 'hasil.json'), JSON.stringify(ringkas, null, 2));
    console.log(`[super] artefak: ${OUT}`);
    console.log(
      `[super] galat konsol: ${galatKonsol.length} · disengaja: ${galatDisengaja.length} · request gagal: ${gagalJaringan.length}`
    );
  } finally {
    try { await browser?.close(); } catch { /* abaikan */ }
    try { stub?.tutup(); } catch { /* abaikan */ }
    try { server.kill('SIGTERM'); } catch { /* abaikan */ }
    await tunggu(600);
    try { fs.rmSync(dirData, { recursive: true, force: true }); } catch { /* abaikan */ }
    const gagal = langkah.filter((l) => !l.ok);
    console.log(`[super] ringkasan: ${langkah.length - gagal.length}/${langkah.length} langkah OK`);
    if (gagal.length) console.log('[super] gagal:', gagal.map((g) => `${g.nama} (${g.keterangan})`).join(' | '));
  }
}

main().catch((e) => { console.error('[super] BERHENTI:', e.message); process.exitCode = 1; });
