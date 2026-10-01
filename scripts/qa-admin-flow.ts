/**
 * QA alur admin via UI sungguhan:
 *   1. Login admin
 *   2. Buka Panel Admin (sidebar)
 *   3. Tab "Konfigurasi RAG & Probe"
 *   4. Isi Base URL + API key, pilih provider HTTP, Simpan
 *   5. Verifikasi tersimpan + API key ter-mask
 *   6. Jalankan probe dari sidebar (endpoint mati -> error anggun)
 *   7. Restore provider mock
 */
import assert from 'node:assert';
import puppeteer from 'puppeteer-core';

const BASE = process.env.API_BASE || 'http://localhost:3114';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let page: any;
let browser: any;

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

async function tungguTeks(pola: string, timeoutMs = 10000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ada = await page.evaluate((p: string) => {
      return new RegExp(p, 'i').test(document.body.innerText);
    }, pola);
    if (ada) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function main() {
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1600,900'],
    defaultViewport: { width: 1600, height: 900 },
  });
  page = await browser.newPage();

  const consoleErrors: string[] = [];
  page.on('console', (m: any) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource|net::ERR/i.test(m.text())) {
      consoleErrors.push(m.text());
    }
  });

  // ---- 1. Login admin ----
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.click('input[type="email"]', { count: 3 } as any);
  await page.type('input[type="email"]', 'admin@apexpulse.id');
  await page.click('input[type="password"]', { count: 3 } as any);
  await page.type('input[type="password"]', 'apexpulse2026');
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /masuk/i.test(b.textContent || ''));
    (btn as HTMLElement)?.click();
  });
  await page.waitForFunction(() => !!document.querySelector('aside'), { timeout: 20000 });
  console.log('✅ 1. Login admin berhasil');

  // ---- 2. Buka Panel Admin dari sidebar ----
  const klikAdmin = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      /Panel Admin/i.test(b.textContent || '')
    );
    if (!btn) return false;
    (btn as HTMLElement).click();
    return true;
  });
  assert.ok(klikAdmin, 'tombol Panel Admin tidak ditemukan di sidebar');
  await page.waitForFunction(() => /Admin & Governance Center/i.test(document.body.innerText), {
    timeout: 10000,
  });
  console.log('✅ 2. Panel Admin terbuka');

  // ---- 3. Tab Konfigurasi RAG & Probe ----
  const klikTab = await klikCocok('Konfigurasi RAG');
  assert.ok(klikTab, 'tab Konfigurasi RAG tidak ditemukan');
  await page.waitForFunction(() => /Konfigurasi Integrasi RAG API/i.test(document.body.innerText), {
    timeout: 8000,
  });
  console.log('✅ 3. Tab Konfigurasi RAG & Probe terbuka');

  // ---- 4. Isi Base URL + API key, pilih provider HTTP, simpan ----
  const urlUji = 'http://127.0.0.1:9/v1'; // port mati — sengaja, untuk uji probe
  const keyUji = 'rag-demo-key-123456';
  await page.evaluate((url: string) => {
    const selects = [...document.querySelectorAll('select')];
    const selProvider = selects.find((s) =>
      [...s.options].some((o) => o.value === 'http')
    ) as HTMLSelectElement;
    selProvider.value = 'http';
    selProvider.dispatchEvent(new Event('change', { bubbles: true }));
    const inputs = [...document.querySelectorAll('input[type="text"], input[type="password"]')];
    const inpUrl = inputs.find((i) => (i as HTMLInputElement).value.includes('://')) as HTMLInputElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )!.set!;
    nativeSetter.call(inpUrl, url);
    inpUrl.dispatchEvent(new Event('input', { bubbles: true }));
  }, urlUji);

  await page.evaluate((key: string) => {
    const inputs = [...document.querySelectorAll('input[type="password"]')];
    const inpKey = inputs[0] as HTMLInputElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )!.set!;
    nativeSetter.call(inpKey, key);
    inpKey.dispatchEvent(new Event('input', { bubbles: true }));
  }, keyUji);

  const klikSimpan = await klikCocok('Simpan Konfigurasi');
  assert.ok(klikSimpan, 'tombol Simpan Konfigurasi tidak ditemukan');
  await tungguTeks('berhasil disimpan', 8000);
  console.log('✅ 4. Konfigurasi disimpan (provider HTTP + URL + API key)');

  // ---- 5. Verifikasi tersimpan + key ter-mask (via API, dari sesi admin) ----
  const cfg = await page.evaluate(async () => {
    const res = await fetch('/api/admin/config');
    return res.json();
  });
  assert.strictEqual(cfg.ragProvider, 'http', 'provider tidak tersimpan');
  assert.strictEqual(cfg.ragApiUrl, urlUji, 'base URL tidak tersimpan');
  assert.ok(cfg.ragApiKey.includes('*'), 'API key tidak ter-mask di respons');
  console.log(`✅ 5. Tersimpan & ter-mask: ${cfg.ragApiUrl} | key: ${cfg.ragApiKey}`);

  // ---- 6. Jalankan probe dari sidebar -> error anggun (endpoint mati) ----
  const tutup = await klikCocok('Ke Workspace');
  assert.ok(tutup, 'tombol Ke Workspace tidak ditemukan');
  const klikProbe = await klikCocok('RAG Probe');
  assert.ok(klikProbe, 'tombol Diagnostik RAG Probe tidak ditemukan di sidebar');
  await page.waitForFunction(() => /Uji Diagnostik API RAG/i.test(document.body.innerText), {
    timeout: 8000,
  });
  await klikCocok('Jalankan Uji Probe');
  const probeSelesai = await page.waitForFunction(
    () => /tidak merespons/i.test(document.body.innerText),
    { timeout: 15000 }
  ).then(() => true).catch(() => false);
  assert.ok(probeSelesai, 'probe tidak menampilkan hasil error yang anggun');
  console.log('✅ 6. Probe endpoint mati -> pesan error anggun + arahan perbaikan');

  // ---- 7. Restore provider mock ----
  await page.evaluate(() => {
    const close = [...document.querySelectorAll('button')].find(
      (b) => (b.textContent || '').trim() === 'Selesai'
    );
    (close as HTMLElement)?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  const bukaAdmin2 = await klikCocok('Panel Admin');
  if (bukaAdmin2) {
    await page.waitForFunction(() => /Konfigurasi Integrasi RAG API/i.test(document.body.innerText) === false, {
      timeout: 8000,
    }).catch(() => {});
    await klikCocok('Konfigurasi RAG');
    await page.waitForFunction(() => /Konfigurasi Integrasi RAG API/i.test(document.body.innerText), {
      timeout: 8000,
    });
    await page.evaluate(() => {
      const selects = [...document.querySelectorAll('select')];
      const sel = selects.find((s) => [...s.options].some((o) => o.value === 'mock')) as HTMLSelectElement;
      sel.value = 'mock';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await klikCocok('Simpan Konfigurasi');
    await tungguTeks('berhasil disimpan', 8000);
  } else {
    await page.evaluate(async () => {
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ragProvider: 'mock' }),
      });
    });
  }
  const cfgAkhir = await page.evaluate(async () => {
    const res = await fetch('/api/admin/config');
    return res.json();
  });
  assert.strictEqual(cfgAkhir.ragProvider, 'mock', 'provider tidak kembali ke mock');
  console.log('✅ 7. Provider dikembalikan ke mock');

  assert.strictEqual(consoleErrors.length, 0, `console error: ${consoleErrors.join(' | ')}`);
  console.log('\n🎉 ALUR ADMIN END-TO-END LULUS (login -> panel -> isi RAG key -> simpan -> probe)');
}

main()
  .catch((e) => {
    console.error('FATAL:', e?.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
  });
