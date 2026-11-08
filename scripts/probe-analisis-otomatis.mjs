/**
 * PROBE — ANALISIS OTOMATIS + CACHE.
 *
 * Yang dibuktikan (semua lewat layar, bukan lewat kode):
 *
 * 1. Pengguna mengunggah dokumen sebagai lampiran permintaan.
 * 2. Dokumen itu DIBACA SENDIRI oleh server — tidak ada satu pun klik "Analisis"
 *    dari siapa pun. Diukur dari: baris analisis muncul di API, dan RAG dipanggil
 *    tanpa ada POST /api/analisis dari skrip.
 * 3. Admin membuka permintaan dan langsung melihat butir datanya.
 * 4. Permintaan analisis berikutnya dilayani dari cache: RAG tidak dipanggil lagi.
 * 5. Dokumen kedua masuk → dokumen pertama otomatis dibaca ulang karena basis
 *    instansi berubah (cache tidak dibiarkan basi).
 * 6. Setelah semua segar, tidak ada pembacaan ulang yang berulang-ulang.
 *
 * Layanan RAG-nya tiruan (stub) yang menjawab dengan kontrak `/query` +
 * `structuredJson {kpi, grafik}` — bentuk yang dipakai `petakanKeluaranRag`.
 * Tujuannya menguji ALUR aplikasi, bukan kualitas model.
 *
 * Jalankan: node scripts/probe-analisis-otomatis.mjs
 * Artefak : %TEMP%/probe-analisis-otomatis
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const PORT = Number(process.env.PROBE_PORT || 3246);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.OUT_DIR || path.join(os.tmpdir(), 'probe-analisis-otomatis');
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

const teksHalaman = (page) => page.evaluate(() => document.body.innerText || '');
const foto = async (page, nama) => {
  const p = path.join(OUT, `${nama}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
};
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
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    dokumen: () => docs.map((d) => d.title),
    tutup: () => server.close(),
  };
}

/* ---------- stub RAG (kontrak /query + structuredJson) ---------- */
async function mulaiStubRag() {
  const http = await import('node:http');
  const hitung = { query: 0, extract: 0, lain: 0 };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://stub');
    const jalur = url.pathname.replace(/\/+$/, '');
    const kirim = (kode, obj) => { res.writeHead(kode, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (jalur === '/__stats') return kirim(200, hitung);
    if (jalur === '/health') return kirim(200, { status: 'ok' });
    let badan = '';
    req.on('data', (c) => (badan += c));
    req.on('end', () => {
      let isi = {};
      try { isi = JSON.parse(badan || '{}'); } catch { /* biarkan kosong */ }
      if (jalur === '/extract') {
        hitung.extract += 1;
        // Jalur A dibiarkan kosong supaya aplikasi jatuh ke /query (kontrak
        // structuredJson) — bentuk yang dipakai analisis butir.
        return kirim(200, { success: true, data: { items: [] } });
      }
      if (jalur === '/query') {
        hitung.query += 1;
        const prompt = String(isi.query || '');
        const judul = /Baca dokumen "([^"]+)"/.exec(prompt)?.[1] || /"([^"]+\.(?:pdf|txt|docx|xlsx))"/i.exec(prompt)?.[1] || 'Dokumen Uji';
        return kirim(200, {
          success: true,
          data: {
            answer: `Angka dari ${judul}.`,
            grounded: true,
            sources: [{ document_name: judul, page: 2, text: 'Realisasi pendapatan usaha 12,4 miliar.' }],
            structuredJson: {
              kpi: [
                {
                  label: 'Realisasi Pendapatan Usaha',
                  nilai: '12400000000',
                  satuan: 'Rp',
                  periode: '2026',
                  docName: judul,
                  page: 2,
                  chunkSnippet: 'Realisasi pendapatan usaha 12,4 miliar.',
                },
                {
                  label: 'Target Pendapatan Usaha',
                  nilai: '13000000000',
                  satuan: 'Rp',
                  periode: '2026',
                  docName: judul,
                  page: 2,
                  chunkSnippet: 'Target pendapatan usaha 13 miliar.',
                },
              ],
              grafik: [
                {
                  title: 'Pendapatan Usaha Bulanan 2026',
                  type: 'bar',
                  categories: ['Jan', 'Feb', 'Mar', 'Apr'],
                  series: [{ name: 'Realisasi', data: [12400, 13100, 12800, 13600] }],
                  docName: judul,
                  page: 3,
                },
              ],
            },
          },
        });
      }
      hitung.lain += 1;
      return kirim(404, { error: `stub tidak punya ${req.method} ${jalur}` });
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, hitung, tutup: () => server.close() };
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
  const dirData = fs.mkdtempSync(path.join(os.tmpdir(), 'aiones-auto-'));
  fs.writeFileSync(path.join(dirData, 'db.json'), JSON.stringify({ users: [], permintaanData: [], alertRules: [] }));
  const kms = await mulaiStubKms();
  const rag = await mulaiStubRag();
  console.log('[probe] data sementara:', dirData);
  console.log('[probe] KMS stub:', kms.url, '· RAG stub:', rag.url);

  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HONOR_SHELL_ENV: '1', PORT: String(PORT), NODE_ENV: 'production',
      AIONESBOARD_DATA_DIR: dirData, DEMO_PASSWORD: SANDI,
      BACKUP_OTOMATIS: '0', CONFIG_REFRESH_SECONDS: '0',
      MYSQL_HOST: '127.0.0.1', MYSQL_PORT: '3307', MYSQL_DATABASE: 'aiones_auto',
      SMTP_HOST: '', S3_BUCKET: '', KMS_API_URL: kms.url,
      RAG_PROVIDER: 'http', RAG_API_URL: rag.url, RAG_API_KEY: 'kunci-uji-probe',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => (log += d.toString()));
  server.stderr.on('data', (d) => (log += d.toString()));

  let browser;
  const statsRag = async () => (await fetch(`${rag.url}/__stats`)).json();
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

    const berkas1 = path.join(dirData, 'laporan-pendapatan-2026.txt');
    fs.writeFileSync(berkas1, 'LAPORAN KINERJA 2026\nRealisasi pendapatan usaha Januari 2026: 12,4 miliar.\nTarget 2026: 13 miliar.\n');
    const berkas2 = path.join(dirData, 'laporan-nrw-2026.txt');
    fs.writeFileSync(berkas2, 'LAPORAN NRW 2026\nNRW Januari 2026: 24,8 persen.\nTarget NRW 2026: 22 persen.\n');

    let idPermintaan = '';
    // Dicatat SEBELUM unggah: analisis otomatis bisa selesai dalam hitungan detik,
    // jadi selisih panggilan RAG harus dihitung dari titik sebelum dokumen masuk.
    const statsAwal = await statsRag();

    /* ---------- 1. pengguna membuat permintaan ---------- */
    await probe('pengguna: ajukan permintaan data lewat form', async () => {
      await klikTestId(pb, 'buka-permintaan');
      await tunggu(2200);
      const buka = await klikTestId(pb, 'tombol-permintaan-baru');
      await tunggu(900);
      await pilihOpsi(pb, '[data-testid="pilih-bidang"]', 'Keuangan');
      await isi(pb, '[data-testid="input-data-diminta"]', 'PROBE-OTOMATIS: realisasi pendapatan usaha 2026 beserta targetnya.');
      await tunggu(300);
      const kirim = await klikTestId(pb, 'kirim-permintaan');
      await tunggu(2500);
      const r = await api(pb, 'GET', '/api/permintaan');
      const daftar = Array.isArray(r.json) ? r.json : r.json?.items || [];
      idPermintaan = String(daftar.find((x) => String(x.dataDiminta || '').includes('PROBE-OTOMATIS'))?.id || '');
      await foto(pb, '01-user-permintaan-dibuat');
      return { ok: buka && kirim && !!idPermintaan, ket: `permintaan=${idPermintaan}` };
    });

    /* ---------- 2. pengguna mengunggah dokumen ---------- */
    await probe('pengguna: unggah dokumen sebagai lampiran (kontrol berkas di layar)', async () => {
      const kartu = await pb.evaluate(() => {
        const el = document.querySelector('button.item-card');
        if (!el) return false;
        el.click();
        return true;
      });
      await tunggu(2000);
      const input = await pb.$('[data-testid="panel-detail-permintaan"] input[type="file"]');
      if (!input) return { ok: false, ket: 'kontrol unggah berkas tidak ada di panel' };
      await input.uploadFile(berkas1);
      await tunggu(5000);
      const r = await api(pb, 'GET', `/api/permintaan/${idPermintaan}`);
      const lampiran = r.json?.lampiran || [];
      await foto(pb, '02-user-dokumen-terunggah');
      return {
        ok: kartu && lampiran.length >= 1,
        ket: `lampiran di API=${lampiran.length}${lampiran[0] ? ` (${lampiran[0].nama} · ${lampiran[0].berkasId})` : ''}`,
      };
    });

    /* ---------- 3. INTI: analisis jalan sendiri tanpa klik ---------- */
    const berkasId1 = await (async () => {
      const r = await api(pb, 'GET', `/api/permintaan/${idPermintaan}`);
      return String((r.json?.lampiran || [])[0]?.berkasId || '');
    })();

    const tungguAnalisis = async (idBerkas, batasMs = 120_000) => {
      const batas2 = Date.now() + batasMs;
      let terakhir = null;
      while (Date.now() < batas2) {
        const r = await api(pa, 'GET', `/api/analisis?permintaanId=${encodeURIComponent(idPermintaan)}`);
        const daftar = Array.isArray(r.json) ? r.json : [];
        const milik = daftar.filter((a) => a.berkasId === idBerkas);
        if (milik.length > 0) {
          terakhir = milik.sort((a, b) => String(b.dibuatPada).localeCompare(String(a.dibuatPada)))[0];
          if (terakhir.status === 'selesai' || terakhir.status === 'gagal') return terakhir;
        }
        await tunggu(2000);
      }
      return terakhir;
    };

    let analisis1 = null;
    await probe('dokumen dibaca OTOMATIS setelah diunggah (tanpa satu klik "Analisis")', async () => {
      analisis1 = await tungguAnalisis(berkasId1);
      const statsKini = await statsRag();
      const dipanggil = statsKini.query - statsAwal.query;
      return {
        ok: !!analisis1 && analisis1.status === 'selesai' && (analisis1.jumlahButir || 0) > 0 && dipanggil > 0,
        ket: `status=${analisis1?.status || 'tidak ada baris analisis'} · butir=${analisis1?.jumlahButir ?? '-'} · panggilan /query sejak sebelum unggah=${dipanggil} · skrip tidak pernah memanggil POST /api/analisis`,
      };
    });

    /* ---------- 4. admin melihat butir tanpa menekan tombol ---------- */
    await probe('admin: butir data langsung tampil di panel permintaan (tanpa klik)', async () => {
      await klikTestId(pa, 'buka-permintaan');
      await tunggu(2500);
      await pa.evaluate(() => {
        const el = document.querySelector('button.item-card');
        if (el) el.click();
      });
      await tunggu(4000);
      // Kartu analisis tertutup secara bawaan; butir baru terbaca setelah dibuka —
      // admin pun harus membukanya, jadi probe melakukan hal yang sama.
      await pa.evaluate(() => {
        const kartu = document.querySelector('[data-testid^="analisis-"] button');
        if (kartu) kartu.click();
      });
      await tunggu(2500);
      const info = await pa.evaluate(() => {
        const panel = document.querySelector('[data-testid="panel-isi-dokumen"]');
        const katalog = document.querySelector('[data-testid="katalog-data"]');
        return {
          panel: (panel?.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
          butirPanel: document.querySelectorAll('[data-testid^="butir-"]').length,
          butirKatalog: document.querySelectorAll('[data-testid^="katalog-butir-"]').length,
          menunggu: document.querySelectorAll('[data-testid^="menunggu-analisis-"]').length,
          katalog: (katalog?.innerText || '').replace(/\s+/g, ' ').slice(0, 240),
        };
      });
      await foto(pa, '03-admin-butir-otomatis');
      return {
        ok: info.butirPanel > 0 && info.menunggu === 0,
        ket: `butir di panel=${info.butirPanel} · butir di katalog=${info.butirKatalog} · kartu "menunggu"=${info.menunggu} · panel="${info.panel.slice(0, 180)}"`,
      };
    });

    /* ---------- 5. cache: RAG tidak dipanggil lagi ---------- */
    await probe('cache: permintaan analisis berikutnya dilayani tanpa memanggil RAG', async () => {
      const sebelum = await statsRag();
      const r = await api(pa, 'POST', '/api/analisis', { berkasId: berkasId1, judulBerkas: 'laporan-pendapatan-2026.txt', permintaanId: idPermintaan });
      const sesudah = await statsRag();
      const total = (x) => x.query + x.extract + x.lain;
      return {
        ok: r.status === 200 && r.json?.dariCache === true && total(sesudah) === total(sebelum),
        ket: `HTTP ${r.status} · dariCache=${r.json?.dariCache} · panggilan RAG ${total(sebelum)} → ${total(sesudah)} · catatan="${String(r.json?.catatanCache || '').slice(0, 120)}"`,
      };
    });

    /* ---------- 6. dokumen baru: dibaca otomatis + cache lama diperbarui ---------- */
    let analisis2 = null;
    await probe('dokumen baru: unggahan kedua langsung dibaca otomatis juga', async () => {
      await pb.evaluate(() => {
        const el = document.querySelector('button.item-card');
        if (el) el.click();
      });
      await tunggu(1800);
      const input = await pb.$('[data-testid="panel-detail-permintaan"] input[type="file"]');
      if (!input) return { ok: false, ket: 'kontrol unggah berkas tidak ada' };
      await input.uploadFile(berkas2);
      await tunggu(5000);
      const r = await api(pb, 'GET', `/api/permintaan/${idPermintaan}`);
      const lampiran = r.json?.lampiran || [];
      const berkasId2 = String(lampiran.find((l) => /nrw/i.test(l.nama))?.berkasId || '');
      if (!berkasId2) return { ok: false, ket: `lampiran kedua tidak ditemukan (${lampiran.map((l) => l.nama).join(', ')})` };
      analisis2 = await tungguAnalisis(berkasId2);
      return {
        ok: !!analisis2 && analisis2.status === 'selesai',
        ket: `berkas=${berkasId2} · status=${analisis2?.status} · butir=${analisis2?.jumlahButir ?? '-'} · lampiran total=${lampiran.length}`,
      };
    });

    await probe('cache ikut diperbarui: dokumen lama dibaca ulang otomatis karena basis berubah', async () => {
      const batas3 = Date.now() + 90_000;
      let terbaru1 = null;
      let jumlahBaris1 = 0;
      while (Date.now() < batas3) {
        const r = await api(pa, 'GET', `/api/analisis?permintaanId=${encodeURIComponent(idPermintaan)}`);
        const daftar = Array.isArray(r.json) ? r.json : [];
        const milik1 = daftar.filter((a) => a.berkasId === berkasId1);
        jumlahBaris1 = milik1.length;
        terbaru1 = milik1.sort((a, b) => String(b.dibuatPada).localeCompare(String(a.dibuatPada)))[0];
        if (milik1.length >= 2 && terbaru1?.status === 'selesai' && String(terbaru1.id) !== String(analisis1?.id)) break;
        await tunggu(2000);
      }
      const segar = await api(pa, 'GET', '/api/analisis/kesegaran');
      await foto(pa, '04-admin-setelah-dokumen-baru');
      return {
        ok: jumlahBaris1 >= 2 && String(terbaru1?.id) !== String(analisis1?.id) && (segar.json?.perluDibacaUlang || []).length === 0,
        ket: `baris analisis dokumen-1=${jumlahBaris1} (id baru=${terbaru1?.id}) · perlu dibaca ulang=${(segar.json?.perluDibacaUlang || []).length} · catatan="${String(segar.json?.catatan || '').slice(0, 90)}"`,
      };
    });

    /* ---------- 7. tidak ada pembacaan ulang berulang ---------- */
    await probe('tidak ada pembacaan ulang berulang setelah semua segar', async () => {
      const a = await api(pa, 'GET', '/api/analisis');
      const jumlahA = (Array.isArray(a.json) ? a.json : []).length;
      const statsA = await statsRag();
      await tunggu(9000);
      const b = await api(pa, 'GET', '/api/analisis');
      const jumlahB = (Array.isArray(b.json) ? b.json : []).length;
      const statsB = await statsRag();
      return {
        ok: jumlahA === jumlahB && statsA.query === statsB.query,
        ket: `baris analisis ${jumlahA} → ${jumlahB} · /query ${statsA.query} → ${statsB.query} dalam 9 detik diam`,
      };
    });

    /* ---------- 8. keadaan antrean terbaca dari API ---------- */
    await probe('antrean otomatis bisa diperiksa (status untuk admin)', async () => {
      const r = await api(pa, 'GET', '/api/analisis/otomatis');
      const s = r.json || {};
      return {
        ok: r.status === 200 && typeof s.selesai === 'number',
        ket: `HTTP ${r.status} · ${JSON.stringify(s).slice(0, 220)}`,
      };
    });

    await probe('admin: layar akhir setelah dua dokumen dibaca otomatis', async () => {
      await pa.reload({ waitUntil: 'networkidle2', timeout: 60_000 });
      await tunggu(2500);
      await pa.evaluate(() => {
        const el = document.querySelector('button.item-card');
        if (el) el.click();
      });
      await tunggu(4000);
      await pa.evaluate(() => {
        const kartu = document.querySelector('[data-testid^="analisis-"] button');
        if (kartu) kartu.click();
      });
      await tunggu(2500);
      const t = await teksHalaman(pa);
      const info = await pa.evaluate(() => ({
        butir: document.querySelectorAll('[data-testid^="butir-"]').length,
        kartu: [...document.querySelectorAll('[data-testid^="analisis-"]')].map((e) => (e.textContent || '').trim().slice(0, 70)),
      }));
      await foto(pa, '05-admin-dua-dokumen');
      return {
        ok: info.butir > 0 && info.kartu.length === 2,
        ket: `butir=${info.butir} · kartu=${info.kartu.length} (harus 2: satu per dokumen, bukan riwayat) ${JSON.stringify(info.kartu).slice(0, 200)} · ada kata "Gagal"=${/Gagal/.test(t)}`,
      };
    });

    fs.writeFileSync(
      path.join(OUT, 'hasil.json'),
      JSON.stringify({ hasil, statsRag: await statsRag(), dokumenKms: kms.dokumen(), log: log.slice(-3000) }, null, 2)
    );
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill();
    kms.tutup();
    rag.tutup();
    await tunggu(800);
    fs.rmSync(dirData, { recursive: true, force: true });
    console.log('\n[probe] artefak:', OUT);
    const lulus = hasil.filter((h) => h.ok).length;
    console.log(`[probe] ringkasan: ${lulus}/${hasil.length} lulus`);
    for (const h of hasil) console.log(`  ${h.ok ? 'LULUS' : 'GAGAL'} ${h.nama}`);
  }
}

main().catch((e) => { console.error('[probe] gagal:', e); process.exit(1); });
