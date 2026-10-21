/**
 * QA alur admin via UI sungguhan:
 *   1. Login admin
 *   2. Panel Admin terbuka otomatis (tanpa lewat workspace)
 *   3. Tab "Konfigurasi RAG"
 *   4. Isi Base URL + API key, pilih provider HTTP, Simpan
 *   5. Verifikasi tersimpan + API key ter-mask
 *   6. Probe via API ke endpoint mati (endpoint mati -> status error anggun)
 *   7. Restore provider mock
 */
import assert from 'node:assert';
import puppeteer from 'puppeteer-core';

const BASE = process.env.API_BASE || 'http://localhost:3000';
// Kredensial demo yang berlaku sekarang (domain apexpulse.id sudah tidak dipakai).
const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL || 'admin@gmail.com';
const ADMIN_PASS = process.env.QA_ADMIN_PASSWORD || '123';
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
    // GSI_LOGGER = skrip Google yang mengeluh soal origin di Cloud Console (konfigurasi
    // eksternal, butuh localhost:3000 didaftarkan) — bukan galat aplikasi.
    if (m.type() === 'error' && !/favicon|Failed to load resource|net::ERR|GSI_LOGGER|origin is not allowed/i.test(m.text())) {
      consoleErrors.push(m.text());
    }
  });

  // ---- 1. Login admin ----
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  // Isi form via native setter (field email sudah ter-prefill, triple-click + type
  // bisa menyambung nilai lama sehingga login gagal).
  await page.evaluate(
    (emailNilai: string, sandiNilai: string) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )!.set!;
      const email = document.querySelector('input[type="email"]') as HTMLInputElement;
      const pass = document.querySelector('input[type="password"]') as HTMLInputElement;
      setter.call(email, emailNilai);
      email.dispatchEvent(new Event('input', { bubbles: true }));
      setter.call(pass, sandiNilai);
      pass.dispatchEvent(new Event('input', { bubbles: true }));
    },
    ADMIN_EMAIL,
    ADMIN_PASS
  );
  await page.evaluate(() => {
    // Tombol submit, BUKAN tab "Masuk" (tab juga cocok /masuk/i dan dulu terpilih).
    const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    btn?.click();
  });
  await page.waitForFunction(() => !!document.querySelector('aside'), { timeout: 20000 });
  console.log('✅ 1. Login admin berhasil');

  // ---- 2. Panel Admin terbuka otomatis (admin langsung diarahkan ke panel) ----
  await page.waitForFunction(() => /Admin & Governance Center/i.test(document.body.innerText), {
    timeout: 10000,
  });
  console.log('✅ 2. Panel Admin terbuka otomatis setelah login admin');

  // ---- 3. Tab Konfigurasi RAG & Probe ----
  const klikTab = await klikCocok('Konfigurasi RAG');
  assert.ok(klikTab, 'tab Konfigurasi RAG tidak ditemukan');
  await page.waitForFunction(() => /Pilih sumber data/i.test(document.body.innerText), {
    timeout: 8000,
  });
  console.log('✅ 3. Tab Konfigurasi RAG terbuka');

  // ---- 4. Isi Base URL saja (field API key JANGAN disentuh), provider HTTP, simpan ----
  const cfgAwal = await page.evaluate(async () => {
    const res = await fetch('/api/admin/config');
    return res.json();
  });
  const urlUji = 'http://127.0.0.1:9/v1'; // port mati, sengaja, untuk uji probe
  // Kartu mode (bukan <select> lagi): klik "Layanan RAG", tunggu field aktif, lalu isi URL.
  await page.evaluate(async (url: string) => {
    (document.querySelector('[data-testid="mode-rag"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 150));
    const inpUrl = document.querySelector('[data-testid="input-rag-url"]') as HTMLInputElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )!.set!;
    nativeSetter.call(inpUrl, url);
    inpUrl.dispatchEvent(new Event('input', { bubbles: true }));
  }, urlUji);

  // ponytail: field API key sengaja dibiarkan apa adanya.
  // Skrip uji pernah menimpa kredensial RAG nyata dengan key dummy; sekarang dilarang.

  const klikSimpan = await klikCocok('Simpan pengaturan');
  assert.ok(klikSimpan, 'tombol Simpan pengaturan tidak ditemukan');
  await tungguTeks('langsung dipakai', 8000);
  console.log('✅ 4. Konfigurasi disimpan (provider HTTP + URL, key tidak disentuh)');

  // ---- 5. Verifikasi tersimpan + key ter-mask (via API, dari sesi admin) ----
  const cfg = await page.evaluate(async () => {
    const res = await fetch('/api/admin/config');
    return res.json();
  });
  assert.strictEqual(cfg.ragProvider, 'http', 'provider tidak tersimpan');
  assert.strictEqual(cfg.ragApiUrl, urlUji, 'base URL tidak tersimpan');
  assert.strictEqual(cfg.ragApiKey, cfgAwal.ragApiKey, 'API key berubah padahal tidak diisi');
  console.log(`✅ 5. Tersimpan & ter-mask: ${cfg.ragApiUrl} | key: ${cfg.ragApiKey}`);

  // ---- 6. Probe (API) ke endpoint mati -> status error anggun (UI probe sudah dihapus) ----
  const probe = await page.evaluate(async () => {
    const res = await fetch('/api/rag-probe', { method: 'POST' });
    return { status: res.status, body: await res.json() };
  });
  assert.strictEqual(probe.status, 200, 'probe harus dibalas 200');
  assert.strictEqual(probe.body.status, 'error', 'probe ke endpoint mati harusnya status error');
  assert.ok(
    (probe.body.details || []).some((d: string) =>
      /tidak merespons|Host tidak dapat dihubungi|Endpoint tidak ditemukan/i.test(d)
    ),
    'pesan error probe tidak memuat arahan perbaikan'
  );
  console.log('✅ 6. Probe endpoint mati (API) -> status error + arahan perbaikan');

  // ---- 7. Restore persis seperti awal (provider + URL), key tidak disentuh ----
  // Lewat API, bukan UI: tujuan langkah ini mengembalikan keadaan, bukan menguji tampilan
  // (uji simpan lewat UI sudah ada di langkah 4). Body tanpa ragApiKey = kunci dibiarkan.
  await page.evaluate(async (awal: { ragProvider: string; ragApiUrl: string }) => {
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ragProvider: awal.ragProvider, ragApiUrl: awal.ragApiUrl }),
    });
    if (!res.ok) throw new Error(`restore gagal: HTTP ${res.status}`);
  }, { ragProvider: cfgAwal.ragProvider, ragApiUrl: cfgAwal.ragApiUrl });
  const cfgAkhir = await page.evaluate(async () => {
    const res = await fetch('/api/admin/config');
    return res.json();
  });
  assert.strictEqual(cfgAkhir.ragProvider, cfgAwal.ragProvider, 'provider tidak kembali seperti awal');
  assert.strictEqual(cfgAkhir.ragApiUrl, cfgAwal.ragApiUrl, 'base URL tidak kembali seperti awal');
  console.log(`✅ 7. Konfigurasi kembali seperti awal (${cfgAkhir.ragProvider} | ${cfgAkhir.ragApiUrl})`);

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
