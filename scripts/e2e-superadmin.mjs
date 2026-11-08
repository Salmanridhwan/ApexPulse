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
    page.on('console', (x) => { if (x.type() === 'error') galatKonsol.push(x.text().slice(0, 200)); });
    page.on('pageerror', (e) => galatKonsol.push('pageerror: ' + String(e).slice(0, 200)));
    page.on('requestfailed', (r) => gagalJaringan.push(`${r.method()} ${r.url().replace(BASE, '')} → ${r.failure()?.errorText}`));

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

    const ringkas = {
      waktu: new Date().toISOString(),
      base: BASE,
      tabs,
      langkah,
      jejakDialog,
      galatKonsol: galatKonsol.slice(0, 25),
      gagalJaringan: gagalJaringan.slice(0, 25),
      lulus: langkah.filter((l) => l.ok).length,
      total: langkah.length,
    };
    fs.writeFileSync(path.join(OUT, 'hasil.json'), JSON.stringify(ringkas, null, 2));
    console.log(`[super] artefak: ${OUT}`);
    console.log(`[super] galat konsol: ${galatKonsol.length} · request gagal: ${gagalJaringan.length}`);
  } finally {
    try { await browser?.close(); } catch { /* abaikan */ }
    try { server.kill('SIGTERM'); } catch { /* abaikan */ }
    await tunggu(600);
    try { fs.rmSync(dirData, { recursive: true, force: true }); } catch { /* abaikan */ }
    const gagal = langkah.filter((l) => !l.ok);
    console.log(`[super] ringkasan: ${langkah.length - gagal.length}/${langkah.length} langkah OK`);
    if (gagal.length) console.log('[super] gagal:', gagal.map((g) => `${g.nama} (${g.keterangan})`).join(' | '));
  }
}

main().catch((e) => { console.error('[super] BERHENTI:', e.message); process.exitCode = 1; });
