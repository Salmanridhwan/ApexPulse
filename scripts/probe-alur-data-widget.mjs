/**
 * PROBE 2 — membuktikan sisa alur yang tidak bisa diuji dengan RAG mock:
 *
 *   butir data (hasil analisis) → dipilih admin → jadi halaman berisi widget
 *   (batang/garis/KPI) → kartu bisa di-drag untuk menukar urutan → lebar kartu
 *   bisa diubah.
 *
 * Butir + analisis DISEMAI di db.json karena `/api/analisis` menolak bekerja
 * saat provider RAG = mock ("bukan dokumen instansi") — itu keputusan produk
 * yang benar, tetapi membuat jalur ini tidak bisa diuji tanpa layanan RAG nyata.
 * Yang diuji di sini adalah lapisan SESUDAH analisis: pemilihan butir, pembuatan
 * halaman, dan pengaturan layout di kanvas — semuanya lewat klik di layar.
 *
 * Jalankan: node scripts/probe-alur-data-widget.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const PORT = Number(process.env.PROBE_PORT || 3245);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.OUT_DIR || path.join(os.tmpdir(), 'probe-alur-data-widget');
const CHROME =
  process.env.CHROME_PATH ||
  ['C:/Program Files/Google/Chrome/Application/chrome.exe',
   'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const SANDI = 'SandiE2eKuat2026';

const hasil = [];
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
const catat = (nama, ok, ket = '') => {
  hasil.push({ nama, ok, ket: String(ket).slice(0, 700) });
  console.log(`${ok ? 'ADA   ' : 'BELUM '} ${nama}${ket ? ' — ' + String(ket).slice(0, 320) : ''}`);
};
async function probe(nama, fn) {
  try {
    const r = await fn();
    if (r && typeof r === 'object') catat(nama, !!r.ok, r.ket || '');
    else catat(nama, !!r, '');
  } catch (e) { catat(nama, false, 'ERROR: ' + e.message); }
}
const teksHalaman = (page) => page.evaluate(() => document.body.innerText || '');
const foto = async (page, nama) => { await page.screenshot({ path: path.join(OUT, `${nama}.png`) }); };
async function klikTestId(page, id) {
  return page.evaluate((i) => { const el = document.querySelector(`[data-testid="${i}"]`); if (!el) return false; el.click(); return true; }, id);
}
async function api(page, method, jalur, body) {
  return page.evaluate(async (m, u, b) => {
    const opt = { method: m, credentials: 'include', headers: {} };
    if (b !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(b); }
    const r = await fetch(u, opt);
    let j = null; try { j = await r.json(); } catch { /* bukan JSON */ }
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
  return { user: j.user, cookie: mentah.split(/,\s*/).map((c) => c.split(';')[0]).filter((c) => c.includes('=')) };
}
async function siapkanHalaman(browser, sesi) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument((u) => localStorage.setItem('aionesboard_user', u), JSON.stringify(sesi.user));
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  for (const c of sesi.cookie) {
    const i = c.indexOf('=');
    await page.setCookie({ name: c.slice(0, i), value: c.slice(i + 1), domain: '127.0.0.1', path: '/' });
  }
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60_000 });
  await tunggu(1500);
  return page;
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function seed(dbPath) {
  const sekarang = new Date().toISOString();
  const butir = (i, isi) => ({
    id: `butir-seed-${i}`, tenantId: 'tenant-pdam', analisisId: 'an-seed-1', berkasId: 'berkas-seed-1',
    permintaanId: 'prm-seed-probe', kategori: 'Keuangan', status: 'disetujui', keyakinan: 'tinggi',
    sitasi: { dokumen: 'laporan-pendapatan-2026.txt', halaman: 1, kutipan: 'Realisasi pendapatan usaha 2026.' },
    dibuatPada: sekarang, ...isi,
  });
  fs.writeFileSync(dbPath, JSON.stringify({
    users: [],
    permintaanData: [{
      id: 'prm-seed-probe', tenantId: 'tenant-pdam', pemohonId: 'user-demo', pemohonNama: 'Siti Rahmawati, S.E.',
      bidang: 'Keuangan', dataDiminta: 'PROBE-DATA: realisasi pendapatan usaha 2026 beserta targetnya.',
      prioritas: 'normal', status: 'baru', catatan: [],
      lampiran: [{ berkasId: 'berkas-seed-1', nama: 'laporan-pendapatan-2026.txt', ukuranKb: 12, tipe: 'text/plain' }],
      createdAt: sekarang, updatedAt: sekarang,
    }],
    analisisDokumen: [{
      id: 'an-seed-1', tenantId: 'tenant-pdam', permintaanId: 'prm-seed-probe', berkasId: 'berkas-seed-1',
      judulBerkas: 'laporan-pendapatan-2026.txt', jenisBerkas: 'TXT', status: 'selesai', metode: 'rag-extract',
      ringkasan: 'Laporan kinerja 2026 memuat realisasi dan target pendapatan usaha per bulan.',
      kategoriTerdeteksi: ['Keuangan'], jumlahButir: 3, percobaan: 1, dibuatPada: sekarang, selesaiPada: sekarang,
    }],
    butirData: [
      butir(1, {
        nama: 'Realisasi pendapatan usaha per bulan 2026', periode: '2026', satuan: 'miliar Rp',
        seri: [{ nama: 'Realisasi', data: [12.4, 13.1, 12.8, 14.2, 13.9, 14.6, 15.1, 14.8, 15.4, 15.9, 16.2, 16.8], kategori: BULAN }],
        bentukDisarankan: 'bar',
      }),
      butir(2, {
        nama: 'Realisasi pendapatan usaha Januari 2026', periode: 'Jan 2026', satuan: 'miliar Rp',
        nilai: 12.4, bentukDisarankan: 'kpi',
      }),
      butir(3, {
        nama: 'Target vs realisasi pendapatan 2026', periode: '2026', satuan: 'miliar Rp',
        seri: [
          { nama: 'Realisasi', data: [12.4, 13.1, 12.8, 14.2, 13.9, 14.6, 15.1, 14.8, 15.4, 15.9, 16.2, 16.8], kategori: BULAN },
          { nama: 'Target', data: [13, 13.5, 13.5, 14.5, 14.5, 15, 15.5, 15.5, 16, 16, 16.5, 17], kategori: BULAN },
        ],
        bentukDisarankan: 'line',
      }),
    ],
    alertRules: [],
  }));
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const dirData = fs.mkdtempSync(path.join(os.tmpdir(), 'aiones-probe2-'));
  seed(path.join(dirData, 'db.json'));
  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env, HONOR_SHELL_ENV: '1', PORT: String(PORT), NODE_ENV: 'production',
      AIONESBOARD_DATA_DIR: dirData, DEMO_PASSWORD: SANDI, BACKUP_OTOMATIS: '0',
      CONFIG_REFRESH_SECONDS: '0', MYSQL_HOST: '127.0.0.1', MYSQL_PORT: '3307',
      MYSQL_DATABASE: 'aiones_probe2', SMTP_HOST: '', S3_BUCKET: '',
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
      try { const r = await fetch(`${BASE}/health`); if (r.ok && (await r.json()).status === 'ok') { siap = true; break; } } catch { /* belum */ }
      await tunggu(500);
    }
    if (!siap) throw new Error('server tidak sehat');
    const sesiAdmin = await loginApi('admin@aionesboard.id', SANDI);
    browser = await puppeteer.launch({
      executablePath: CHROME, headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
      defaultViewport: { width: 1440, height: 900 },
    });
    const pa = await siapkanHalaman(browser, sesiAdmin);

    /* 1. Admin membuka permintaan → dokumen + hasil analisis + butir data */
    let jumlahButir = 0;
    await probe('admin: membuka permintaan → daftar dokumen + hasil analisis + butir data tampil', async () => {
      await klikTestId(pa, 'buka-permintaan');
      await tunggu(2500);
      const kartu = await pa.evaluate(() => { const el = document.querySelector('button.item-card'); if (!el) return false; el.click(); return true; });
      await tunggu(3000);
      const info = await pa.evaluate(() => {
        const panel = document.querySelector('[data-testid="panel-detail-permintaan"]');
        const katalog = document.querySelector('[data-testid="katalog-data"]');
        return {
          dokumen: /Dokumen \(1\)/i.test(panel?.innerText || ''),
          analisis: /selesai/i.test(panel?.innerText || ''),
          katalog: (katalog?.innerText || '').replace(/\n+/g, ' | ').slice(0, 300),
          butir: document.querySelectorAll('[data-testid^="katalog-butir-"]').length,
          bisaDicentang: [...document.querySelectorAll('[data-testid^="katalog-butir-"] input[type="checkbox"]')].filter((c) => !c.disabled).length,
        };
      });
      jumlahButir = info.butir;
      await foto(pa, '01-admin-butir-data');
      return { ok: kartu && info.dokumen && info.butir > 0, ket: `dokumen=${info.dokumen} · analisis selesai=${info.analisis} · butir=${info.butir} (bisa dicentang=${info.bisaDicentang}) · katalog="${info.katalog.slice(0, 160)}"` };
    });

    /* 2. Apakah admin bisa memilih tipe tampilan (batang/garis) per butir? */
    await probe('admin: ada pilihan tipe tampilan (batang/garis) per butir data', async () => {
      const info = await pa.evaluate(() => {
        const panel = document.querySelector('[data-testid="panel-detail-permintaan"]');
        return {
          select: [...(panel?.querySelectorAll('select') || [])].map((s) => [...s.options].map((o) => o.value)),
          radio: panel?.querySelectorAll('input[type="radio"]').length || 0,
          kata: ['batang', 'garis', 'bar', 'line'].filter((k) => new RegExp(k, 'i').test(panel?.innerText || '')),
        };
      });
      await foto(pa, '02-panel-tipe-tampilan');
      return { ok: info.select.length > 0 || info.radio > 0, ket: `select=${JSON.stringify(info.select).slice(0, 160)} · radio=${info.radio} · kata tipe di panel=${JSON.stringify(info.kata)}` };
    });

    /* 3. Centang butir → Buat halaman */
    let idDashboard = '';
    await probe('admin: centang butir → "Buat halaman" membuat halaman berisi widget', async () => {
      const dicentang = await pa.evaluate(() => {
        const kotak = [...document.querySelectorAll('[data-testid^="katalog-butir-"] input[type="checkbox"]')].filter((c) => !c.disabled);
        kotak.slice(0, 3).forEach((c) => c.click());
        return Math.min(kotak.length, 3);
      });
      await tunggu(1200);
      const tombol = await pa.evaluate(() => {
        const b = document.querySelector('[data-testid="katalog-buat-halaman"]');
        return b ? { ada: true, teks: (b.textContent || '').trim() } : { ada: false };
      });
      await foto(pa, '03-butir-dicentang');
      const buat = await klikTestId(pa, 'katalog-buat-halaman');
      await tunggu(7000);
      const r = await api(pa, 'GET', '/api/dashboards');
      const arr = Array.isArray(r.json) ? r.json : r.json?.dashboards || [];
      idDashboard = String(arr[0]?.id || '');
      const d = idDashboard ? await api(pa, 'GET', `/api/dashboards/${idDashboard}`) : { json: null };
      const dash = d.json?.dashboard || d.json;
      const widgets = dash?.widgets || [];
      const pesan = await pa.evaluate(() => (document.querySelector('[data-testid="katalog-pesan"]')?.textContent || '').trim());
      await foto(pa, '04-halaman-dibuat');
      return {
        ok: dicentang > 0 && tombol.ada && buat && widgets.length > 0,
        ket: `dicentang=${dicentang} · tombol="${tombol.teks}" · dashboard=${idDashboard} · widget=${widgets.length} · tipe=${JSON.stringify(widgets.map((w) => w.type))} · pesan="${pesan.slice(0, 100)}"`,
      };
    });

    /* 4. Kanvas: widget tampil */
    await probe('kanvas: halaman baru menampilkan widget di layar', async () => {
      if (!idDashboard) return { ok: false, ket: 'tidak ada dashboard' };
      // Ganti hash TANPA reload tidak me-render ulang di SPA; muat ulang supaya
      // aplikasi boot langsung di halaman dashboard itu.
      await pa.evaluate((id) => { window.location.hash = `#/v/workspace/d/${id}`; }, idDashboard);
      await pa.reload({ waitUntil: 'networkidle2', timeout: 60_000 });
      await tunggu(5000);
      const info = await pa.evaluate(() => ({
        kartu: document.querySelectorAll('[data-widget-id]').length,
        hash: location.hash,
        teks: (document.body.innerText || '').replace(/\n+/g, ' | ').slice(0, 300),
        diag: [...document.querySelectorAll('[data-widget-id]')].map((e) => ({
          id: e.getAttribute('data-widget-id'),
          draggable: e.getAttribute('draggable'),
          handle: e.querySelectorAll('[data-resize]').length,
          w: Math.round(e.getBoundingClientRect().width),
          h: Math.round(e.getBoundingClientRect().height),
        })),
        filter: !!document.querySelector('[data-testid="chart-filter-chip"]'),
      }));
      await foto(pa, '05-kanvas-widget');
      console.log('[diag]', JSON.stringify(info.diag), 'filterAktif=', info.filter);
      return { ok: info.kartu > 0, ket: `kartu=${info.kartu} · hash=${info.hash} · filter=${info.filter} · diag=${JSON.stringify(info.diag).slice(0, 220)}` };
    });

    /* 5. Drag untuk menukar urutan */
    await probe('kanvas: kartu bisa di-drag untuk menukar urutan', async () => {
      if (!idDashboard) return { ok: false, ket: 'tidak ada dashboard' };
      const sebelum = await pa.evaluate(() => [...document.querySelectorAll('[data-widget-id]')].map((e) => e.getAttribute('data-widget-id')));
      if (sebelum.length < 2) return { ok: false, ket: `kartu hanya ${sebelum.length}` };
      // HTML5 drag: dicek dulu apakah handler React benar-benar menerima
      // `dragstart` (kartu sumber diberi kelas `opacity-40`), baru `drop` dikirim.
      const diterima = await pa.evaluate((id) => {
        window.__ev = { dragstart: 0, dragover: 0, drop: 0 };
        for (const t of ['dragstart', 'dragover', 'drop']) {
          window.addEventListener(t, () => { window.__ev[t] += 1; }, true);
        }
        const el = document.querySelector(`[data-widget-id="${id}"]`);
        const dt = new DataTransfer();
        dt.setData('text/plain', id);
        window.__dt = dt;
        el.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
        return true;
      }, sebelum[0]);
      await tunggu(800);
      const adaOpacity = await pa.evaluate((id) => {
        const el = document.querySelector(`[data-widget-id="${id}"]`);
        return /opacity-40/.test(el?.className || '');
      }, sebelum[0]);
      // Drop dikirim lewat CDP (drag session nyata) supaya `dataTransfer` benar-benar
      // berisi id — pada DragEvent sintetis Chrome mengosongkan isinya, sehingga
      // `pindahkan()` menerima id kosong dan tidak melakukan apa pun.
      const koord = await pa.evaluate((id) => {
        const b = document.querySelector(`[data-widget-id="${id}"]`).getBoundingClientRect();
        return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + 40) };
      }, sebelum[1]);
      const dataDrag = { items: [{ mimeType: 'text/plain', data: sebelum[0] }], dragOperationsMask: 1 };
      const klien = await pa.createCDPSession();
      for (const t of ['dragEnter', 'dragOver']) {
        await klien.send('Input.dispatchDragEvent', { type: t, x: koord.x, y: koord.y, data: dataDrag }).catch(() => {});
        await tunggu(150);
      }
      await klien.send('Input.dispatchDragEvent', { type: 'drop', x: koord.x, y: koord.y, data: dataDrag }).catch(() => {});
      await tunggu(3500);
      const sesudah = await pa.evaluate(() => [...document.querySelectorAll('[data-widget-id]')].map((e) => e.getAttribute('data-widget-id')));
      const d = await api(pa, 'GET', `/api/dashboards/${idDashboard}`);
      const tersimpan = ((d.json?.dashboard || d.json)?.widgets || []).map((w) => w.id);
      await foto(pa, '06-setelah-drag');
      const berubah = JSON.stringify(sebelum) !== JSON.stringify(sesudah);
      const ev = await pa.evaluate(() => window.__ev);
      return { ok: berubah, ket: `dragstart diterima React=${adaOpacity} · event=${JSON.stringify(ev)} · layar ${sebelum.join(',')} → ${sesudah.join(',')} · tersimpan=${tersimpan.join(',')}` };
    });

    /* 6. Resize lebar */
    await probe('kanvas: lebar kartu bisa diubah dengan menarik pegangan', async () => {
      if (!idDashboard) return { ok: false, ket: 'tidak ada dashboard' };
      // Kartu KPI tidak punya pegangan (lebarnya dibagi rata), jadi dipilih kartu
      // chart — bukan kartu pertama.
      const d0 = await api(pa, 'GET', `/api/dashboards/${idDashboard}`);
      const widgets = (d0.json?.dashboard || d0.json)?.widgets || [];
      const target = widgets.find((w) => w.type !== 'kpi' && w.type !== 'narasi');
      if (!target) return { ok: false, ket: 'tidak ada kartu chart' };
      const diagnosa = await pa.evaluate(() => [...document.querySelectorAll('[data-widget-id]')].map((e) => ({
        id: e.getAttribute('data-widget-id'),
        drag: e.getAttribute('draggable'),
        handles: [...e.querySelectorAll('[data-resize]')].map((h) => h.getAttribute('data-resize')),
        w: Math.round(e.getBoundingClientRect().width),
      })));
      const pegangan = await pa.evaluate((id) => {
        const h = document.querySelector(`[data-widget-id="${id}"] [data-resize="kanan"]`);
        if (!h) return null;
        const b = h.getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
      }, target.id);
      if (!pegangan) return { ok: false, ket: `pegangan resize tidak ada di kartu ${target.id} (${target.type}) · diagnosa=${JSON.stringify(diagnosa).slice(0, 300)}` };
      const kotak = pegangan;
      if (!kotak) return { ok: false, ket: 'pegangan tidak terlihat' };
      const lebar = async () => {
        const d = await api(pa, 'GET', `/api/dashboards/${idDashboard}`);
        return ((d.json?.dashboard || d.json)?.widgets || []).find((w) => w.id === target.id)?.grid?.w ?? null;
      };
      const sebelum = await lebar();
      // `mulaiResize` memasang listener di `window`, jadi peristiwa dikirim ke
      // window setelah mousedown di pegangan — sama seperti tarikan pengguna.
      await pa.evaluate((id) => {
        const h = document.querySelector(`[data-widget-id="${id}"] [data-resize="kanan"]`);
        const b = h.getBoundingClientRect();
        window.__rx = b.x + b.width / 2;
        window.__ry = b.y + b.height / 2;
        h.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: window.__rx, clientY: window.__ry, button: 0 }));
      }, target.id);
      await tunggu(300);
      await pa.evaluate(() => {
        for (const dx of [40, 90, 140, 190]) {
          window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: window.__rx + dx, clientY: window.__ry }));
        }
        window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: window.__rx + 190, clientY: window.__ry }));
      });
      await tunggu(3000);
      const sesudah = await lebar();
      await foto(pa, '07-setelah-resize');
      return { ok: sebelum !== null && sesudah !== null && sebelum !== sesudah, ket: `kartu ${target.id} (${target.type}): lebar ${sebelum} → ${sesudah} kolom` };
    });

    /* 7. Galeri chart: bisa dipakai memasukkan chart ke kanvas? */
    await probe('galeri chart: ada cara memasukkan chart dari galeri ke kanvas', async () => {
      await klikTestId(pa, 'buka-galeri-chart');
      await tunggu(3000);
      const info = await pa.evaluate(() => ({
        draggable: document.querySelectorAll('[draggable="true"]').length,
        tombol: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim())
          .filter((x) => /tambah ke|pakai|gunakan|masukkan|kanvas/i.test(x)).slice(0, 8),
        teks: (document.body.innerText || '').slice(0, 200),
      }));
      await foto(pa, '08-galeri-chart');
      return { ok: info.draggable > 0 || info.tombol.length > 0, ket: `draggable=${info.draggable} · tombol aksi=${JSON.stringify(info.tombol)}` };
    });

    fs.writeFileSync(path.join(OUT, 'hasil.json'), JSON.stringify({ hasil, log: log.slice(-1500) }, null, 2));
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill();
    await tunggu(700);
    fs.rmSync(dirData, { recursive: true, force: true });
    console.log('\n[probe2] artefak:', OUT);
    console.log(`[probe2] ringkasan: ${hasil.filter((h) => h.ok).length}/${hasil.length} ada`);
  }
}

main().catch((e) => { console.error('[probe2] gagal:', e); process.exit(1); });
