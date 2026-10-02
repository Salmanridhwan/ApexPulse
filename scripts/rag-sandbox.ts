/**
 * Sandbox uji koneksi RAG — TIDAK menyentuh konfigurasi aplikasi.
 *
 * Pakai:
 *   RAG_BASE_URL="https://host/api/v1" RAG_API_KEY="rag_..." [RAG_KB_ID="kb-..."] npx tsx scripts/rag-sandbox.ts
 *
 * Yang diperiksa (kontrak ragjev):
 *   1. GET  {base}/health  (opsional — kalau 404 dianggap tidak tersedia)
 *   2. POST {base}/query   body { query, knowledge_base_id?, options }
 *      lalu laporkan: status, latensi, answer, sources, grounded.
 *   3. Cocokkan bentuk respons dengan kontrak ConfigurableRagClient (Jalur A/B).
 */

const BASE_URL = (process.env.RAG_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.RAG_API_KEY || '';
const KB_ID = process.env.RAG_KB_ID || '';

if (!BASE_URL || !API_KEY) {
  console.error('Pemakaian: RAG_BASE_URL="..." RAG_API_KEY="..." npx tsx scripts/rag-sandbox.ts');
  process.exit(1);
}

const mask = (k: string) => `${k.slice(0, 8)}${'*'.repeat(Math.max(0, k.length - 12))}${k.slice(-4)}`;

console.log('Target :', BASE_URL);
console.log('API key:', mask(API_KEY));
console.log('');

async function cekHealth() {
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      signal: AbortSignal.timeout(15000),
    });
    const teks = (await res.text()).slice(0, 300);
    console.log(`[1] GET /health  -> ${res.status} ${res.ok ? 'OK' : '(endpoint mungkin tidak tersedia — tidak fatal)'}`);
    if (res.ok) console.log('    body:', teks.replace(/\s+/g, ' ').slice(0, 200));
  } catch (e: any) {
    console.log(`[1] GET /health  -> gagal dihubungi (${e?.message || e}) — tidak fatal`);
  }
}

async function cekQuery() {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        query: 'Berapa realisasi pendapatan dan tingkat NRW PDAM triwulan ini?',
        ...(KB_ID ? { knowledge_base_id: KB_ID } : {}),
        options: { top_k: 8, include_sources: true },
      }),
      signal: AbortSignal.timeout(60000),
    });
    const latensi = Date.now() - start;
    console.log(`\n[2] POST /query  -> ${res.status} ${res.ok ? 'OK' : 'GAGAL'} (${latensi}ms)`);

    const teks = await res.text();
    if (!res.ok) {
      console.log('    body:', teks.slice(0, 500));
      return;
    }

    let data: any;
    try {
      data = JSON.parse(teks);
    } catch {
      console.log('    ⚠️ Respons BUKAN JSON murni (mungkin dibungkus markdown?). Cuplikan:');
      console.log('   ', teks.slice(0, 400).replace(/\s+/g, ' '));
      return;
    }

    const payload = data?.data && data.success !== undefined ? data.data : data;
    const sources: any[] = Array.isArray(payload?.sources) ? payload.sources : [];
    const chunks: any[] = Array.isArray(payload?.chunks) ? payload.chunks : sources;
    const structured = payload?.structuredJson ?? payload?.structured ?? null;

    console.log('    structuredJson :', structured ? 'ADA (Jalur A)' : 'tidak ada');
    console.log('    answer         :', payload?.answer ? `"${String(payload.answer).slice(0, 120)}"` : 'tidak ada');
    console.log('    grounded       :', payload?.grounded);
    console.log('    sumber/chunks  :', chunks.length);
    if (chunks.length > 0) {
      const c = chunks[0];
      console.log('    contoh sumber  :', JSON.stringify({
        document_name: c.document_name || c.docName,
        page: c.page,
        score: c.score,
        chunk_id: c.chunk_id,
      }));
    }

    const jalur = structured ? 'Jalur A (LLM JSON)' : chunks.length > 0 ? 'Jalur B (Agregasi Metadata)' : '⚠️ Tidak ada keduanya — generate akan jatuh ke Fallback Template';
    console.log('\n    Kesimpulan     :', jalur);
    if (!structured && chunks.length > 0) {
      console.log('    ➜ Pastikan metadata chunk berisi unitKerja/metric/periode supaya agregasi Jalur B kaya.');
    }
  } catch (e: any) {
    const msg = e?.name === 'TimeoutError' ? 'timeout 60 dtk' : e?.message || String(e);
    console.log(`\n[2] POST /query  -> GAGAL: ${msg}`);
    console.log('    Cek: Base URL benar? /query ada? Bearer key valid? Jaringan/firewall?');
    process.exitCode = 1;
  }
}

await cekHealth();
await cekQuery();
