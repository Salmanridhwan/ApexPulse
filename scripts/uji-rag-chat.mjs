/**
 * Uji asisten chat + RAG:
 *  A. Tanya 3 indikator lewat chat, bandingkan angkanya dengan jawaban RAG langsung.
 *  B. Minta dashboard baru, periksa angka widget vs dokumen & keragaman tipe grafik.
 *  C. Bersihkan dashboard uji.
 *
 * Kunci API dibaca dari data/db.json dan TIDAK PERNAH dicetak.
 */
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const db = JSON.parse(fs.readFileSync('data/db.json', 'utf8'));
const KEY = db.systemConfig.ragApiKey;
const URL_RAG = db.systemConfig.ragApiUrl.replace(/\/$/, '');
const TENANT = 'tenant-1791501310547';
const KB = 'kb_pam_jaya';

const tunda = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

/** Angka dari teks: "96,2%" / "96.2" / "1.234,5" -> [96.2] */
function angkaDi(teks) {
  const hasil = new Set();
  const pola = /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)/g;
  for (const m of teks.matchAll(pola)) {
    let s = m[1];
    if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
    const n = parseFloat(s);
    if (!Number.isNaN(n)) hasil.add(n);
  }
  return [...hasil];
}

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@gmail.com', password: '123' }),
  });
  const cookie = (r.headers.getSetCookie?.() || [])[0]?.split(';')[0];
  if (!cookie) throw new Error('login gagal: ' + r.status);
  return cookie;
}

async function ragTanya(query) {
  const r = await fetch(`${URL_RAG}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      query,
      knowledge_base_id: KB,
      options: { top_k: 8, include_sources: true },
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) return { ok: false, status: r.status, answer: '', sumber: [] };
  const j = await r.json();
  const d = j.data || j;
  const answer = d.answer || j.answer || '';
  const sumber = (d.sources || []).map((s) => `${s.document_name}${s.page ? ' (hal. ' + s.page + ')' : ''}`);
  return { ok: true, status: r.status, answer, sumber };
}

/** Kirim prompt ke /api/chat dan baca seluruh SSE sampai selesai. */
async function chat(cookie, prompt, { dashboardId } = {}) {
  const r = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ prompt, sector: 'pdam', tenantId: TENANT, dashboardId }),
    signal: AbortSignal.timeout(180000),
  });
  if (!r.ok || !r.body) return { ok: false, status: r.status, pesan: '', langkah: [], dashboardId: null };

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let ev = '';
  const langkah = [];
  let pesan = '';
  let dashId = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const baris = buf.split('\n');
    buf = baris.pop() || '';
    for (const b of baris) {
      if (b.startsWith('event:')) ev = b.slice(6).trim();
      else if (b.startsWith('data:')) {
        const data = b.slice(5).trim();
        try {
          const j = JSON.parse(data);
          if (ev === 'step' && j.title) langkah.push(`${j.title}${j.status ? ' [' + j.status + ']' : ''}`);
          if (ev === 'result') {
            if (j.message) pesan = j.message;
            if (j.dashboardId) dashId = j.dashboardId;
            if (j.dashboard?.id) dashId = j.dashboard.id;
            if (j.actionTaken) langkah.push(`[aksi: ${j.actionTaken}]`);
          }
        } catch {
          /* data bukan JSON: abaikan */
        }
      }
    }
  }
  return { ok: true, status: r.status, pesan, langkah, dashboardId: dashId };
}

const cookie = await login();
log('login: ok');

// ---------- A. FIDELITAS TANYA-JAWAB ----------
const pertanyaan = [
  'Berapa persentase ketepatan waktu tanggap PAM JAYA tahun 2026?',
  'Berapa persentase penyelesaian pekerjaan dalam SLA PAM JAYA tahun 2026?',
  'Berapa persentase kepuasan pengguna atas penanganan PAM JAYA tahun 2026?',
];

const hasilA = [];
for (const q of pertanyaan) {
  log(`\n=== TANYA: ${q}`);
  const app = await chat(cookie, q);
  const gt = await ragTanya(q);
  const angkaApp = angkaDi(app.pesan || '');
  const angkaGt = angkaDi(gt.answer || '');
  const cocok = angkaApp.filter((n) => angkaGt.some((g) => Math.abs(g - n) < 0.05));
  const beda = angkaApp.filter((n) => !angkaGt.some((g) => Math.abs(g - n) < 0.05));
  hasilA.push({ q, jawabanApp: (app.pesan || '').slice(0, 240), jawabanRag: (gt.answer || '').slice(0, 240), cocok, beda });
  log('  app :', (app.pesan || '(kosong)').replace(/\n+/g, ' ').slice(0, 200));
  log('  rag :', (gt.answer || '(kosong)').replace(/\n+/g, ' ').slice(0, 200));
  log('  angka cocok:', JSON.stringify(cocok), '| hanya di app:', JSON.stringify(beda));
  await tunda(1500);
}

// ---------- B. DASHBOARD BARU ----------
const sebelum = (await (await fetch(`${BASE}/api/dashboards`, { headers: { Cookie: cookie } })).json());
const daftarSebelum = new Set(((sebelum.dashboards || sebelum) || []).map((d) => d.id));

log('\n=== MINTA DASHBOARD BARU (angka + grafik beragam) ===');
const build = await chat(
  cookie,
  'Buatkan dashboard baru untuk PAM JAYA tahun 2026 berisi indikator kinerja utama beserta grafik tren dan perbandingan kategori. Gunakan jenis grafik yang beragam (garis, batang, donat, area), jangan hanya kartu angka.'
);
log('  langkah:', build.langkah.join(' -> ').slice(0, 400));
log('  pesan :', (build.pesan || '(kosong)').replace(/\n+/g, ' ').slice(0, 300));

const sesudah = (await (await fetch(`${BASE}/api/dashboards`, { headers: { Cookie: cookie } })).json());
const daftarBaru = ((sesudah.dashboards || sesudah) || []).filter((d) => !daftarSebelum.has(d.id));
log('  dashboard baru:', daftarBaru.map((d) => `${d.id} "${d.title}"`).join(', ') || '(tidak ada)');

let laporan = { tipe: {}, widget: [], angkaWidget: [], dashboardId: null };
if (daftarBaru.length) {
  const id = build.dashboardId && daftarBaru.some((d) => d.id === build.dashboardId) ? build.dashboardId : daftarBaru[0].id;
  laporan.dashboardId = id;
  const det = await (await fetch(`${BASE}/api/dashboards/${id}`, { headers: { Cookie: cookie } })).json();
  const ws = det.dashboard?.widgets || det.widgets || [];
  for (const w of ws) {
    laporan.tipe[w.type] = (laporan.tipe[w.type] || 0) + 1;
    const nilai = [];
    if (w.data?.series) for (const s of w.data.series) for (const v of s.data || []) if (typeof v === 'number') nilai.push(v);
    if (typeof w.kpi?.value === 'number') nilai.push(w.kpi.value);
    if (Array.isArray(w.data?.rows)) for (const row of w.data.rows) for (const c of Object.values(row)) if (typeof c === 'number') nilai.push(c);
    laporan.widget.push({ judul: w.title, tipe: w.type, nilai: nilai.slice(0, 8) });
    laporan.angkaWidget.push(...nilai);
  }
  log('  tipe widget:', JSON.stringify(laporan.tipe));
  for (const w of laporan.widget) log(`   - [${w.tipe}] ${w.judul} :: ${JSON.stringify(w.nilai)}`);
}

// ---------- C. ANGKA WIDGET vs DOKUMEN ----------
if (laporan.angkaWidget.length) {
  log('\n=== COCOKKAN ANGKA WIDGET DENGAN DOKUMEN ===');
  const gt = await ragTanya(
    'Sebutkan seluruh angka indikator kinerja PAM JAYA tahun 2026 beserta nama indikatornya (ketepatan waktu tanggap, penyelesaian SLA, kepuasan pengguna, capaian pekerjaan, dan indikator lain di dokumen).'
  );
  const angkaDok = angkaDi(gt.answer || '');
  const unik = [...new Set(laporan.angkaWidget)].filter((n) => Math.abs(n) > 0.001);
  const ada = unik.filter((n) => angkaDok.some((g) => Math.abs(g - n) < 0.05));
  const tidak = unik.filter((n) => !angkaDok.some((g) => Math.abs(g - n) < 0.05));
  log('  jawaban dokumen:', (gt.answer || '').replace(/\n+/g, ' ').slice(0, 400));
  log(`  angka widget: ${unik.length} | ada di dokumen: ${ada.length} | tidak ketemu: ${tidak.length}`);
  if (tidak.length) log('  tidak ketemu:', JSON.stringify(tidak.slice(0, 12)));
  laporan.cekAngka = { total: unik.length, ada: ada.length, tidak: tidak.slice(0, 12) };
}

// ---------- D. BERSIHKAN ----------
if (laporan.dashboardId) {
  const del = await fetch(`${BASE}/api/dashboards/${laporan.dashboardId}`, { method: 'DELETE', headers: { Cookie: cookie } });
  log('\nbersihkan dashboard uji:', del.status);
}

fs.writeFileSync('scripts/hasil-uji-rag.json', JSON.stringify({ hasilA, laporan }, null, 2));
log('\n=== RINGKASAN ===');
log('A. tanya-jawab cocok:', hasilA.map((h) => `${h.cocok.length}/${h.cocok.length + h.beda.length}`).join(' | '));
log('B. tipe grafik:', JSON.stringify(laporan.tipe));
log('C. angka cocok dengan dokumen:', laporan.cekAngka ? `${laporan.cekAngka.ada}/${laporan.cekAngka.total}` : 'tidak diuji');
