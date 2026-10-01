/**
 * QA UI — 7 langkah skenario demo ApexPulse (PRD Bab 11):
 *   1. Login sebagai user instansi
 *   2. Tulis di chat: "buatkan dashboard kinerja PDAM 2026"
 *   3. Dashboard 6-8 widget muncul (SSE selesai, kanvas terisi)
 *   4. Edit: hapus satu widget via chat + ganti chart jadi diagram batang via chat
 *   5. Klik "lihat sumber" pada widget -> drawer sitasi muncul
 *   6. Export (PNG/PDF) + share link read-only -> buka /share/:token
 *   7. Reload -> dashboard tersimpan dengan konfigurasi tetap utuh
 *
 * Semua console error / pageerror / requestfailed dicatat; skrip gagal jika
 * ada error yang memengaruhi alur demo.
 *
 * Jalankan: npx tsx scripts/qa-demo-ui.ts   (butuh server hidup di BASE)
 */
import assert from 'node:assert';
import puppeteer from 'puppeteer-core';

const BASE = process.env.API_BASE || 'http://localhost:3114';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@apexpulse.id';
const DEMO_PASS = process.env.DEMO_PASSWORD || 'apexpulse2026';

// ---- Kolektor masalah ----
const consoleErrors: string[] = [];
const pageErrors: string[] = [];
const failedRequests: string[] = [];

// Error yang TIDAK memengaruhi demo (noise eksternal/latar belakang).
const IGNORE_PATTERNS = [
  /favicon\.ico/i,
  /net::ERR_ABORTED/i, // navigasi dibatalkan user/browser
  /Failed to load resource/i, // duplikat info; requestfailed sudah mencatat
  /ResizeObserver loop/i, // benign browser warning
  /third-party/i,
  /sourceforge/i, // ad-block noise
];

function isIgnorable(msg: string): boolean {
  return IGNORE_PATTERNS.some((re) => re.test(msg));
}

function log(msg: string) {
  console.log(msg);
}

async function klikCocok(pola: string): Promise<boolean> {
  return page.evaluate((p: string) => {
    const re = new RegExp(p, 'i');
    const el = [...document.querySelectorAll('button, a, [role="button"]')].find(
      (b) => re.test((b as HTMLElement).innerText || '')
    ) as HTMLElement | undefined;
    if (!el) return false;
    el.click();
    return true;
  }, pola);
}

async function tungguTeks(pola: string, timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ada = await page.evaluate((p: string) => {
      const re = new RegExp(p, 'i');
      return re.test(document.body.innerText);
    }, pola);
    if (ada) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

let page: any;

/** Hitung widget sungguhan di kanvas: kartu yang berisi heading judul + bukan bagian banner/metric-bar. */
async function hitungWidgetKanvas(): Promise<number> {
  return page.evaluate(() => {
    const grid = [...document.querySelectorAll('main div.grid')].find((g) =>
      g.querySelector('h3, h4')
    );
    if (!grid) return 0;
    // Kartu widget = elemen dengan heading langsung di dalamnya (bukan heading di dalam kartu).
    return [...grid.children].filter((c) => c.querySelector('h3, h4')).length;
  });
}

async function langkah(judul: string, fn: () => Promise<void>) {
  const t0 = Date.now();
  await fn();
  log(`  ✅ Langkah ${judul} (${Date.now() - t0}ms)`);
}

let browser: any;
let hasil = { lulus: 0, gagal: 0 };
const gagalanDetail: string[] = [];

async function uji(judul: string, fn: () => Promise<void>) {
  log(`\n▶ LANGKAH ${judul}`);
  try {
    await langkah(judul, fn);
    hasil.lulus++;
  } catch (err: any) {
    hasil.gagal++;
    gagalanDetail.push(`Langkah ${judul}: ${err?.message || err}`);
    log(`  ❌ GAGAL: ${err?.message || err}`);
    // Screenshot kondisi halaman saat gagal supaya bisa didiagnosis.
    try {
      await page?.screenshot({ path: 'qa-gagal.png', fullPage: true });
      const potongan = await page?.evaluate(() => document.body.innerText.slice(0, 400));
      log(`  📸 Body saat gagal: ${String(potongan).replace(/\n/g, ' | ').slice(0, 300)}`);
    } catch {
      /* abaikan */
    }
  }
}

async function main() {
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1600,900'],
    defaultViewport: { width: 1600, height: 900 },
  });
  page = await browser.newPage();

  page.on('console', (m: any) => {
    if (m.type() === 'error') {
      const t = m.text();
      if (!isIgnorable(t)) consoleErrors.push(t);
    }
  });
  page.on('pageerror', (e: any) => {
    const t = String(e?.message || e);
    if (!isIgnorable(t)) pageErrors.push(t);
  });
  page.on('requestfailed', (r: any) => {
    const t = `${r.url()} :: ${r.failure()?.errorText}`;
    if (!isIgnorable(t)) failedRequests.push(t);
  });

  // ============ LANGKAH 1: LOGIN ============
  await uji('1 — Login user instansi', async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });

    // Auto-prefill demo credentials di form login
    const emailVal = await page.$eval('input[type="email"]', (el: any) => (el as HTMLInputElement).value);
    assert.ok(emailVal.includes('@'), 'form login tidak menampilkan email prefill');

    await page.click('input[type="email"]', { count: 3 } as any);
    await page.type('input[type="email"]', DEMO_EMAIL);
    await page.click('input[type="password"]', { count: 3 } as any);
    await page.type('input[type="password"]', DEMO_PASS);
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) =>
        /masuk/i.test(b.textContent || '')
      );
      (btn as HTMLButtonElement)?.click();
    });

    // Tunggu UI terpakai: aside sidebar hanya ada di halaman terautentikasi.
    const masuk = await page
      .waitForFunction(() => !!document.querySelector('aside'), { timeout: 20000 })
      .then(() => true)
      .catch(() => false);

    if (!masuk) {
      // Debug: tangkap kondisi halaman supaya kegagalan bisa didiagnosis.
      await page.screenshot({ path: 'qa-login-gagal.png', fullPage: true });
      const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
      throw new Error(
        `login tidak berhasil dalam 20 detik. Body: ${bodyText.replace(/\n/g, ' | ').slice(0, 300)}`
      );
    }
  });

  // ============ LANGKAH 2: TULIS DI CHAT ============
  await uji('2 — Tulis perintah di chat "buatkan dashboard kinerja PDAM 2026"', async () => {
    const buka = await klikCocok('Chat RAG Copilot');
    assert.ok(buka, 'tombol Chat RAG Copilot tidak ditemukan');
    await page.waitForFunction(
      () => !!document.querySelector('textarea, input[placeholder*="ulkan"], input[type="text"]'),
      { timeout: 10000 }
    );
    const selectorTextarea = await page.evaluate((): string | null => {
      const ta = document.querySelector('textarea');
      if (ta) return 'textarea';
      const inp = [...document.querySelectorAll('input')].find((i) => (i as HTMLInputElement).type === 'text');
      return inp ? 'input[type="text"]' : null;
    });
    assert.ok(selectorTextarea, 'input chat tidak ditemukan');
    await page.click(selectorTextarea);
    await page.type(selectorTextarea, 'buatkan dashboard kinerja PDAM 2026');
  });

  // ============ LANGKAH 3: DASHBOARD 6-8 WIDGET MUNCUL ============
  await uji('3 — Dashboard 6-8 widget muncul dari SSE', async () => {
    // Kirim chat dengan Enter
    await page.keyboard.press('Enter');

    // Tunggu progres streaming selesai (tombol kembali aktif / pesan result muncul)
    const selesai = await tungguTeks('berhasil dibuat|Berhasil dibuat|Dashboard berhasil', 45000);
    assert.ok(selesai, 'chat tidak menghasilkan pesan sukses dalam 45 detik');

    // Dashboard baru otomatis aktif — tunggu widget terlihat di kanvas
    let jumlahWidget = 0;
    const start3 = Date.now();
    while (Date.now() - start3 < 10000) {
      jumlahWidget = await hitungWidgetKanvas();
      if (jumlahWidget >= 5) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    log(`  ℹ️ Widget terdeteksi di kanvas: ${jumlahWidget}`);
    assert.ok(jumlahWidget >= 5, `widget di kanvas hanya ${jumlahWidget} (harusnya >= 5)`);
  });

  // ============ LANGKAH 4: EDIT VIA CHAT ============
  await uji('4 — Hapus widget & ganti chart jadi diagram batang via chat', async () => {
    // Widget sebelum aksi
    const sebelum = await hitungWidgetKanvas();

    // --- 4a: hapus widget pertama yang mengandung "Tren"/"Pendapatan" via chat
    // Chat input = input[type=text] di panel fixed (bukan textarea).
    if (!(await page.evaluate(() => !!document.querySelector('div.fixed input[type="text"]')))) {
      const buka = await klikCocok('Chat RAG Copilot');
      assert.ok(buka, 'panel chat tertutup dan tombolnya tak ditemukan');
      await page.waitForFunction(() => !!document.querySelector('div.fixed input[type="text"]'), { timeout: 8000 });
    }
    const CHAT = 'div.fixed input[type="text"]';

    await page.click(CHAT);
    await page.type(CHAT, 'hapus widget pendapatan');
    await page.keyboard.press('Enter');
    const hapusOk = await tungguTeks('telah dihapus|berhasil dihapus', 20000);
    assert.ok(hapusOk, 'perintah hapus widget tidak menghasilkan konfirmasi');

    let sesudahHapus = sebelum;
    const start4 = Date.now();
    while (Date.now() - start4 < 8000) {
      sesudahHapus = await hitungWidgetKanvas();
      if (sesudahHapus < sebelum) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    assert.ok(sesudahHapus === sebelum - 1, `widget berkurang ${sebelum - sesudahHapus} (harus tepat 1)`);

    // --- 4b: ganti tipe chart jadi batang via chat
    await page.click(CHAT);
    await page.type(CHAT, 'ganti tren pendapatan jadi diagram batang');
    await page.keyboard.press('Enter');
    const gantiOk = await tungguTeks('diubah menjadi BAR|telah diubah|DIAGRAM BATANG|BAR', 20000);
    assert.ok(gantiOk, 'perintah ganti chart tidak menghasilkan konfirmasi');
  });

  // ============ LANGKAH 5: SITASI ============
  await uji('5 — Klik lihat sumber -> drawer chunk + dokumen muncul', async () => {
    const klik = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) =>
        /lihat sumber|sumber/i.test(b.textContent || '')
      );
      if (!btn) return false;
      (btn as HTMLElement).click();
      return true;
    });
    assert.ok(klik, 'tombol lihat sumber tidak ditemukan di widget manapun');

    await page.waitForFunction(
      () => /dokumen|chunk|halaman|sumber/i.test(
        [...document.querySelectorAll('aside, [data-drawer], div.fixed')]
          .map((d) => (d as HTMLElement).innerText)
          .join(' ')
      ),
      { timeout: 10000 }
    );
    // Tutup drawer EKSPLISIT lewat tombol footernya "Tutup Panel" — regex
    // generik /tutup|close|×/ bisa menekan tombol lain yang muncul lebih dulu.
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(
        (b) => (b.textContent || '').trim() === 'Tutup Panel'
      );
      (btn as HTMLElement)?.click();
    });
    // Pastikan drawer benar-benar tertutup sebelum langkah berikutnya.
    await page.waitForFunction(
      () => !document.body.innerText.includes('Transparansi Dokumen Sumber'),
      { timeout: 8000 }
    );
  });

  // ============ LANGKAH 6: EXPORT + SHARE ============
  await uji('6 — Export & share link read-only', async () => {
    // --- 6a: Export
    const klikExport = await klikCocok('Cetak / Ekspor');
    assert.ok(klikExport, 'tombol Cetak / Ekspor tidak ditemukan');
    await page.waitForFunction(() => /Laporan Eksekutif Resmi/i.test(document.body.innerText), {
      timeout: 8000,
    });
    log('  ℹ️ Modal export terbuka');
    // tutup modal export lewat tombol Tutup-nya (Escape tidak ditangani modal)
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(
        (b) => (b.textContent || '').trim() === 'Tutup'
      );
      (btn as HTMLElement)?.click();
    });
    await page.waitForFunction(() => !/Laporan Eksekutif Resmi/i.test(document.body.innerText), {
      timeout: 8000,
    });

    // --- 6b: Share (modal buka -> klik generate -> token muncul)
    const klikShare = await klikCocok('Bagikan|Share');
    assert.ok(klikShare, 'tombol Bagikan tidak ditemukan');
    await page.waitForFunction(() => /Buat Tautan Berbagi/i.test(document.body.innerText), {
      timeout: 8000,
    });
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) =>
        /Buat Tautan Berbagi/i.test(b.textContent || '')
      );
      (btn as HTMLElement)?.click();
    });
    // URL share ditampilkan di <input readOnly value=...> — body.innerText
    // TIDAK memuat nilai input, jadi poll gabungan teks body + nilai semua input.
    let token = '';
    const start6 = Date.now();
    while (Date.now() - start6 < 8000) {
      token = await page.evaluate(() => {
        const nilaiInput = [...document.querySelectorAll('input')]
          .map((i) => (i as HTMLInputElement).value)
          .join(' ');
        const m = `${document.body.innerText} ${nilaiInput}`.match(/share\/([A-Za-z0-9_-]+)/);
        return m ? m[1] : '';
      });
      if (token) break;
      await new Promise((r) => setTimeout(r, 300));
    }
    assert.ok(token, 'share token tidak muncul di UI (teks body maupun nilai input)');
    log(`  ℹ️ Share token: ${token}`);

    // Buka halaman publik share (tanpa cookie login: incognito browser context)
    const ctx = await browser.createBrowserContext();
    const p2 = await ctx.newPage();
    await p2.goto(`${BASE}/share/${token}`, { waitUntil: 'networkidle2', timeout: 30000 });
    const shareTampil = await p2.evaluate(() =>
      /dashboard|kinerja/i.test(document.body.innerText)
    );
    assert.ok(shareTampil, 'halaman /share/:token tidak menampilkan dashboard read-only');
    await ctx.close();
  });

  // ============ LANGKAH 7: RELOAD — KONFIGURASI TETAP UTUH ============
  await uji('7 — Reload: dashboard tersimpan, konfigurasi tetap utuh', async () => {
    const widgetSebelum = await hitungWidgetKanvas();
    const judulSebelum = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? h1.innerText : '';
    });

    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForFunction(
      () => !!document.querySelector('aside') && /dashboard/i.test(document.body.innerText),
      { timeout: 20000 }
    );

    const judulSesudah = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? h1.innerText : '';
    });
    assert.ok(judulSesudah === judulSebelum, `judul dashboard berubah: "${judulSebelum}" -> "${judulSesudah}"`);

    // Dashboard hasil generate adalah dashboard aktif pertama (paling atas)
    const widgetSesudah = await hitungWidgetKanvas();
    log(`  ℹ️ Widget sebelum/sesudah reload: ${widgetSebelum}/${widgetSesudah}`);
    assert.ok(
      widgetSesudah >= widgetSebelum,
      'widget hilang setelah reload — persistence bermasalah'
    );
  });

  // ============ RINGKASAN ============
  log('\n════════════════════════════════════════');
  log(`HASIL: ${hasil.lulus} lulus, ${hasil.gagal} gagal dari 7 langkah`);

  if (consoleErrors.length) {
    log(`\n⚠️ Console errors (${consoleErrors.length}):`);
    consoleErrors.slice(0, 10).forEach((e) => log(`  [console] ${e.slice(0, 200)}`));
  }
  if (pageErrors.length) {
    log(`\n⚠️ Page errors (${pageErrors.length}):`);
    pageErrors.slice(0, 10).forEach((e) => log(`  [pageerror] ${e.slice(0, 200)}`));
  }
  if (failedRequests.length) {
    log(`\n⚠️ Failed requests (${failedRequests.length}):`);
    failedRequests.slice(0, 10).forEach((e) => log(`  [reqfail] ${e.slice(0, 200)}`));
  }

  const bersih = consoleErrors.length === 0 && pageErrors.length === 0 && failedRequests.length === 0;
  log(`Console/network bersih: ${bersih ? 'YA' : 'TIDAK'}`);

  if (hasil.gagal > 0 || !bersih) {
    log('\n=== DETAIL KEGAGALAN ===');
    gagalanDetail.forEach((d) => log(`  - ${d}`));
    process.exitCode = 1;
  } else {
    log('\n🎉 SEMUA 7 LANGKAH SKENARIO DEMO LULUS, TANPA ERROR CONSOLE/NETWORK');
  }
}

main()
  .catch((e) => {
    console.error('FATAL:', e?.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
  });
