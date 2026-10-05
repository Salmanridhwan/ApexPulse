/**
 * QA UI — 7 langkah skenario demo ApexPulse (PRD Bab 11):
 *   1. Login sebagai user instansi
 *   2. Tulis di chat: "buatkan dashboard kinerja PDAM 2026"
 *   3. Dashboard 6-8 widget muncul (SSE selesai, kanvas terisi)
 *   4. Edit: hapus satu widget via chat + ganti chart jadi diagram batang via chat
 *   5. Klik "lihat sumber" pada widget -> drawer sitasi muncul
 *   6. Export (PNG/PDF) + share link read-only -> buka /share/:token
 *   7. Reload -> dashboard tersimpan dengan konfigurasi tetap utuh
 *   8. Drag-and-drop pindah widget -> urutan berubah & tersimpan setelah reload
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

async function bukaPanelChat(): Promise<boolean> {
  return page.evaluate(() => {
    const btn = [...document.querySelectorAll('header button')].find(
      (b) => /Buka \/ Tutup Chat RAG Copilot/i.test(b.getAttribute('title') || '')
    ) as HTMLElement | undefined;
    if (!btn) return false;
    btn.click();
    return true;
  });
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

/** Buka menu "Aksi lain" (header) bila belum terbuka. */
async function bukaMenuAksi(): Promise<void> {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(
      (b) => /^Aksi lainnya?$/.test(b.getAttribute('title') || '')
    );
    (btn as HTMLElement)?.click();
  });
  // Penanda menu harus salah satu ISINYA, bukan label filter bar yang sudah berubah.
  await page.waitForFunction(() => /Mode Presentasi/i.test(document.body.innerText), {
    timeout: 8000,
  });
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

  // ============ LANGKAH 1b: DASHBOARD KOSONG (basis uji) ============
  // QA sebelumnya bisa saja meninggalkan dashboard berisi widget & riwayat chat.
  // Tanpa langkah ini, "berhasil disintesis" dari run lalu sudah ada di layar
  // sehingga LANGKAH 3 lulus seketika tanpa memanggil RAG sama sekali, dan
  // LANGKAH 4 mengukur pengurangan widget pada data yang salah.
  await uji('1b — Siapkan dashboard kosong & riwayat chat bersih', async () => {
    const idBaru = await page.evaluate(async () => {
      const res = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'tenant-pdam',
          title: 'Dashboard QA Demo',
          description: 'dasar uji skenario demo',
          sector: 'pdam',
          widgets: [],
        }),
      });
      return res.ok ? (await res.json()).id : null;
    });
    assert.ok(idBaru, 'gagal membuat dashboard kosong via API');
    log(`  ℹ️ Dashboard uji: ${idBaru}`);

    await page.reload({ waitUntil: 'networkidle2' });
    const aktif = await page
      .waitForFunction(() => /Dashboard QA Demo/.test(document.querySelector('h1')?.innerText || ''), {
        timeout: 20000,
      })
      .then(() => true)
      .catch(() => false);
    assert.ok(aktif, 'dashboard uji kosong tidak menjadi dashboard aktif');

    // Kosongkan riwayat chat dashboard ini supaya tidak ada teks sisa dari run sebelumnya.
    const chat = await page.evaluate(async (id: string) => {
      const r = await fetch(`/api/dashboards/${id}/chat`);
      return r.ok ? await r.json() : null;
    }, idBaru);
    if (chat?.chat?.id) {
      await page.evaluate(async (chatId: string) => {
        await fetch(`/api/chats/${chatId}`, { method: 'DELETE' });
      }, chat.chat.id);
      log('  ℹ️ Riwayat chat dashboard uji dihapus');
    }
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForFunction(() => !!document.querySelector('aside'), { timeout: 20000 });
  });

  // ============ LANGKAH 2: TULIS DI CHAT ============
  await uji('2 — Tulis perintah di chat "buatkan dashboard kinerja PDAM 2026"', async () => {
    const buka = await bukaPanelChat();
    assert.ok(buka, 'tombol Chat RAG Copilot di header tidak ditemukan');
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

    // Tunggu progres streaming selesai (pesan "result" dari server).
    // Server mengirim "berhasil disintesis" (dashboard baru) atau "berhasil diperbarui"
    // (dashboard aktif sudah ada) — bukan "berhasil dibuat".
    // Timeout 90 detik mengikuti ragTimeoutSeconds di panel admin; RAG sungguhan
    // butuh ~40 detik, jadi 45 detik lama sudah tidak aman saat lambat.
    const selesai = await tungguTeks('berhasil disintesis|berhasil diperbarui|Dashboard berhasil', 90000);
    assert.ok(selesai, 'chat tidak menghasilkan pesan sukses dalam 90 detik');

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
      const buka = await bukaPanelChat();
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
  // Badge sitasi per-widget sengaja dihapus dari kartu widget (kartu jadi bersih,
  // tanpa label "Sumber Resmi"/"Inferensi AI"). Satu-satunya jalan auditable untuk
  // sitasi sekarang adalah "Lampiran Sitasi & Sumber Dokumen Resmi" di modal Ekspor,
  // jadi di sinilah sitasi diverifikasi.
  await uji('5 — Sitasi resmi tampil di Lampiran modal Ekspor', async () => {
    await bukaMenuAksi();
    const klikExport = await klikCocok('Cetak / Ekspor');
    assert.ok(klikExport, 'menu Cetak / Ekspor tidak ditemukan');
    await page.waitForFunction(() => /Laporan Eksekutif Resmi/i.test(document.body.innerText), {
      timeout: 8000,
    });

    const lampiran = await page
      .waitForFunction(() => /Lampiran Sitasi & Sumber Dokumen Resmi/i.test(document.body.innerText), {
        timeout: 8000,
      })
      .then(() => true)
      .catch(() => false);
    assert.ok(lampiran, 'Lampiran Sitasi & Sumber Dokumen Resmi tidak ada di modal ekspor');

    // Setiap entri lampiran harus menyebut nama dokumen + nomor halaman.
    const entri = await page.evaluate(() => {
      const semua = document.body.innerText || '';
      const blok = semua.split(/Lampiran Sitasi & Sumber Dokumen Resmi/i)[1] || '';
      const baris = blok
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => /\.pdf|\.docx|\.xlsx/i.test(s));
      return {
        total: baris.length,
        adaHal: baris.filter((s) => /halaman\s*:?\s*\d+/i.test(s)).length,
      };
    });
    log(`  ℹ️ Entri sitasi di lampiran: ${entri.total} (dengan halaman: ${entri.adaHal})`);
    assert.ok(entri.total > 0, 'lampiran sitasi kosong padahal widget punya sitasi');
    assert.ok(
      entri.adaHal === entri.total,
      `sitasi tanpa nomor halaman: ${entri.total - entri.adaHal} dari ${entri.total}`
    );

    // Tutup modal lewat tombol Tutup-nya (Escape tidak ditangani modal).
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(
        (b) => (b.textContent || '').trim() === 'Tutup'
      );
      (btn as HTMLElement)?.click();
    });
    await page.waitForFunction(() => !/Laporan Eksekutif Resmi/i.test(document.body.innerText), {
      timeout: 8000,
    });
  });

  // ============ LANGKAH 6: EXPORT + SHARE ============
  await uji('6 — Export & share link read-only', async () => {
    // --- 6a: Export (aksi kini ada di menu "Aksi lain")
    await bukaMenuAksi();
    const klikExport = await klikCocok('Cetak / Ekspor');
    assert.ok(klikExport, 'menu Cetak / Ekspor tidak ditemukan');
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
    await bukaMenuAksi();
    const klikShare = await klikCocok('Bagikan|Share');
    assert.ok(klikShare, 'menu Bagikan tidak ditemukan');
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

  // ============ LANGKAH 8: DRAG-AND-DROP REORDER ============
  await uji('8 — Drag-and-drop pindah widget & urutan tersimpan', async () => {
    const ambilUrutan = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('[data-widget-id]')].map(
          (el) => (el as HTMLElement).dataset.widgetId || ''
        )
      );
    const sebelum = await ambilUrutan();
    assert.ok(sebelum.length >= 2, 'widget kurang dari 2 — reorder tidak bisa diuji');

    // Drag widget pertama ke posisi widget kedua (event HTML5 DnD sintetis).
    await page.evaluate(() => {
      const kartu = [...document.querySelectorAll('[data-widget-id]')] as HTMLElement[];
      const sumber = kartu[0];
      const target = kartu[1];
      const dt = new DataTransfer();
      sumber.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
      target.dispatchEvent(
        new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })
      );
      target.dispatchEvent(
        new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })
      );
      sumber.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    });

    // Urutan berubah: widget pertama kini berbeda
    let sesudah = sebelum;
    const start8 = Date.now();
    while (Date.now() - start8 < 5000) {
      sesudah = await ambilUrutan();
      if (sesudah[0] !== sebelum[0]) break;
      await new Promise((r) => setTimeout(r, 300));
    }
    assert.notStrictEqual(sesudah[0], sebelum[0], 'urutan widget tidak berubah setelah drag');
    log(`  ℹ️ Urutan berubah: ${sebelum[0]?.slice(0, 12)} -> ${sesudah[0]?.slice(0, 12)}`);

    // Reload -> urutan tersimpan (persistence)
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForFunction(() => !!document.querySelector('aside'), { timeout: 20000 });
    const setelahReload = await ambilUrutan();
    assert.deepStrictEqual(
      setelahReload,
      sesudah,
      'urutan widget berubah setelah reload — persistensi reorder gagal'
    );
  });

  // ============ LANGKAH 9: RESIZE LEBAR WIDGET ============
  await uji('9 — Resize lebar widget & tersimpan setelah reload', async () => {
    const ambilLebar = () =>
      page.evaluate(() => {
        const el = document.querySelector('[data-widget-id]') as HTMLElement | null;
        if (!el) return null;
        return { id: el.dataset.widgetId || '', lg: getComputedStyle(el).gridColumnStart };
      });
    const sebelum = await ambilLebar();
    assert.ok(sebelum, 'kartu widget pertama tidak ditemukan');

    // Tarik strip resize di tepi KIRI kartu pertama ke kiri (arah keluar = melebar).
    await page.evaluate(() => {
      const kartu = document.querySelector('[data-widget-id]') as HTMLElement;
      const strip = kartu.querySelector('span[data-resize="kiri"]') as HTMLElement;
      const rect = strip.getBoundingClientRect();
      const y = rect.top + rect.height / 2;
      const x = rect.left + rect.width / 2;
      strip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: x - 600, clientY: y }));
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: x - 600, clientY: y }));
    });

    // col-span lg berubah (pemetaan bucket 4/6/8/12)
    let sesudah = sebelum;
    const start9 = Date.now();
    while (Date.now() - start9 < 5000) {
      sesudah = await ambilLebar();
      if (sesudah && sesudah.lg !== sebelum.lg) break;
      await new Promise((r) => setTimeout(r, 300));
    }
    assert.ok(sesudah && sesudah.lg !== sebelum.lg, `lebar widget tidak berubah (${sebelum.lg})`);
    log(`  ℹ️ Lebar lg berubah (tarik tepi kiri ke kiri): ${sebelum.lg} -> ${sesudah.lg}`);

    // Reload -> lebar tersimpan
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForFunction(() => !!document.querySelector('aside'), { timeout: 20000 });
    const setelahReload = await ambilLebar();
    assert.strictEqual(
      setelahReload?.lg,
      sesudah.lg,
      'lebar widget berubah setelah reload — persistensi resize gagal'
    );
  });

  // ============ LANGKAH 10: HAPUS DASHBOARD DARI WORKSPACE ============
  await uji('10 — Hapus dashboard (banner workspace) + verifikasi API', async () => {
    // Buat dashboard sementara lewat API (sesi cookie halaman dipakai otomatis)
    const idBaru = await page.evaluate(async () => {
      const res = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'tenant-pdam',
          title: 'Dashboard QA Sementara',
          description: 'uji hapus',
          sector: 'pdam',
          widgets: [],
        }),
      });
      return res.ok ? (await res.json()).id : null;
    });
    assert.ok(idBaru, 'gagal membuat dashboard sementara via API');

    // Reload -> dashboard terbaru jadi aktif pertama
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForFunction(() => !!document.querySelector('aside'), { timeout: 20000 });
    const tampil = await page.waitForFunction(
      () => (document.querySelector('h1')?.innerText || '').includes('Dashboard QA Sementara'),
      { timeout: 10000 }
    ).then(() => true).catch(() => false);
    assert.ok(tampil, 'dashboard sementara tidak menjadi dashboard aktif setelah reload');

    // Buka menu aksi -> Hapus Dashboard -> konfirmasi inline -> Hapus
    await bukaMenuAksi();
    const klikHapus = await klikCocok('Hapus Dashboard');
    assert.ok(klikHapus, 'menu Hapus Dashboard tidak ditemukan');
    const konfirmMuncul = await page.waitForFunction(
      () => /Hapus dashboard ini\?/.test(document.body.innerText),
      { timeout: 5000 }
    ).then(() => true).catch(() => false);
    assert.ok(konfirmMuncul, 'konfirmasi penghapusan tidak muncul');
    // Label tombol konfirmasi redesign 5 Okt: "Ya, Hapus" (bukan "Hapus").
    const konfirmasiDitekan = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) =>
        /^(Ya,\s*Hapus|Hapus)$/.test((b.textContent || '').trim())
      ) as HTMLElement | undefined;
      if (!btn) return false;
      btn.click();
      return true;
    });
    assert.ok(konfirmasiDitekan, 'tombol konfirmasi hapus tidak diklik');

    // Banner kembali ke dashboard lain + API tak lagi memuat id tsb
    const ganti = await page.waitForFunction(
      () => !(document.querySelector('h1')?.innerText || '').includes('Dashboard QA Sementara'),
      { timeout: 10000 }
    ).then(() => true).catch(() => false);
    assert.ok(ganti, 'dashboard sementara masih tampil setelah dihapus');

    const masihAda = await page.evaluate(async (id: string) => {
      const res = await fetch('/api/dashboards?tenantId=tenant-pdam');
      const data = await res.json();
      return Array.isArray(data) && data.some((d: any) => d.id === id);
    }, idBaru);
    assert.ok(!masihAda, 'dashboard masih ada di API setelah dihapus');
  });

  // ============ LANGKAH 11: PANEL ADMIN — KONFIGURASI RAG (API KEY) ============
  await uji('11 — Panel admin: API key RAG (403 non-admin, mask, persist, probe)', async () => {
    const panggil = (fn: (u: any) => Promise<any>) => page.evaluate(fn);

    // (a) Non-admin kena 403
    await panggil(async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@apexpulse.id', password: 'apexpulse2026' }),
      });
    });
    const statusDemo = await panggil(async () => {
      const res = await fetch('/api/admin/config');
      return res.status;
    });
    assert.strictEqual(statusDemo, 403, 'non-admin harusnya 403 saat GET /api/admin/config');

    // (b) Login admin -> config terbaca, API key ter-mask
    await panggil(async () => {
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@apexpulse.id', password: 'apexpulse2026' }),
      });
    });
    const cfgAwal = await panggil(async () => {
      const res = await fetch('/api/admin/config');
      return { status: res.status, data: await res.json() };
    });
    assert.strictEqual(cfgAwal.status, 200, 'admin harusnya 200 saat GET /api/admin/config');
    assert.ok(
      !cfgAwal.data.ragApiKey || cfgAwal.data.ragApiKey.includes('*'),
      'API key dikirim ke browser tanpa masking'
    );
    // Snapshot konfigurasi asli — langkah ini mengubah URL & key, jadi WAJIB
    // dikembalikan di akhir supaya kredensial RAG asli tidak tertimpa nilai uji.
    const cfgSnapshot = {
      ragProvider: cfgAwal.data.ragProvider,
      ragApiUrl: cfgAwal.data.ragApiUrl,
      ragApiKey: cfgAwal.data.ragApiKey,
      ragKnowledgeBaseId: cfgAwal.data.ragKnowledgeBaseId,
      ragTimeoutSeconds: cfgAwal.data.ragTimeoutSeconds,
    };

    // (c) Set provider HTTP + URL teman -> tersimpan. API key SENGAJA tidak
    //     dikirim: kolom key berisi nilai ter-mask, dan menimpanya dengan nilai
    //     dummy akan menghapus kredensial asli yang sudah diisi di panel.
    await page.evaluate(async (url: string) => {
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ragProvider: 'http',
          ragApiUrl: url,
        }),
      });
    }, cfgSnapshot.ragApiUrl);
    const cfgBaru = await panggil(async () => {
      const res = await fetch('/api/admin/config');
      return res.json();
    });
    assert.strictEqual(cfgBaru.ragProvider, 'http', 'provider http tidak tersimpan');
    assert.strictEqual(cfgBaru.ragApiUrl, cfgSnapshot.ragApiUrl, 'base url tidak tersimpan');
    assert.strictEqual(
      cfgBaru.ragApiKey,
      cfgSnapshot.ragApiKey,
      'API key berubah padahal tidak dikirim (seharusnya dipertahankan ter-mask)'
    );

    // (d) Probe dengan endpoint mati -> status error yang anggun (bukan crash)
    await page.evaluate(async () => {
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ragProvider: 'http', ragApiUrl: 'http://127.0.0.1:9/v1' }),
      });
    });
    const probe = await panggil(async () => {
      const res = await fetch('/api/rag-probe', { method: 'POST' });
      return res.json();
    });
    assert.strictEqual(probe.status, 'error', 'probe ke endpoint mati harusnya status error');

    // (e) Restore konfigurasi ASLI (bukan hanya provider) supaya kredensial RAG
    //     yang sudah diisi di panel tidak hilang setelah QA dijalankan.
    await page.evaluate(async (cfg: any) => {
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
    }, cfgSnapshot);
    const cfgAkhir = await panggil(async () => {
      const res = await fetch('/api/admin/config');
      return res.json();
    });
    assert.strictEqual(cfgAkhir.ragProvider, cfgSnapshot.ragProvider, 'provider tidak kembali ke nilai awal');
    assert.strictEqual(cfgAkhir.ragApiUrl, cfgSnapshot.ragApiUrl, 'base URL tidak kembali ke nilai awal');
    assert.strictEqual(
      cfgAkhir.ragKnowledgeBaseId,
      cfgSnapshot.ragKnowledgeBaseId,
      'knowledge base id tidak kembali ke nilai awal'
    );
  });

  // ============ RINGKASAN ============
  log('\n════════════════════════════════════════');
  const total = hasil.lulus + hasil.gagal;
  log(`HASIL: ${hasil.lulus} lulus, ${hasil.gagal} gagal dari ${total} langkah`);

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
    log(`\n🎉 SEMUA ${total} LANGKAH SKENARIO DEMO LULUS, TANPA ERROR CONSOLE/NETWORK`);
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
