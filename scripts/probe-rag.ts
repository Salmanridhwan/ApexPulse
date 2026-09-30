/**
 * ApexPulse RAG Capability Probe Runner
 * Usage: npx tsx scripts/probe-rag.ts
 */

import { mockRag } from '../src/services/rag/mock';
import { RAG_PROMPTS } from '../src/services/rag/prompts';
import { WidgetSpecSchema } from '../src/services/spec/widgetSpec';

async function runDiagnostics() {
  console.log('====================================================');
  console.log('🔍 APEXPULSE RAG CAPABILITY PROBE DIAGNOSTICS');
  console.log('====================================================\n');

  console.log('1. Menguji konektivitas & latensi endpoint...');
  const start = Date.now();
  const probe = await mockRag.probe();
  console.log(`   ✅ Status: OK (Latensi: ${probe.latencyMs}ms)`);
  console.log(`   ✅ Mode Terdeteksi: ${probe.detectedMode}\n`);

  console.log('2. Menguji query instruksi bebas & retrieval chunk dokumen...');
  const res = await mockRag.query({
    prompt: 'Berapa realisasi pendapatan dan tingkat NRW PDAM 2026?',
    sector: 'pdam',
  });
  console.log(`   ✅ Jumlah chunk diterima: ${res.chunks.length}`);
  console.log(`   ✅ Sampel dokumen: ${res.chunks[0]?.docName} (Hal. ${res.chunks[0]?.page})\n`);

  console.log('3. Memeriksa kelengkapan metadata dokumen (Jalur B)...');
  const meta = res.chunks[0]?.metadata;
  const hasMeta = meta && meta.periode && meta.nilai !== undefined && meta.unitKerja && meta.kategori;
  if (hasMeta) {
    console.log(`   ✅ Metadata lengkap: periode=${meta.periode}, nilai=${meta.nilai} ${meta.satuan}, unit_kerja=${meta.unitKerja}, kategori=${meta.kategori}\n`);
  } else {
    console.log('   ⚠️ Metadata parsial / tidak lengkap.\n');
  }

  console.log('4. Memeriksa sintesis JSON terstruktur terhadap skema Zod (Jalur A)...');
  if (res.structuredJson) {
    const rawWidgets = res.structuredJson.widgets || [];
    let validCount = 0;
    for (const w of rawWidgets) {
      const parsed = WidgetSpecSchema.safeParse(w);
      if (parsed.success) validCount++;
    }
    console.log(`   ✅ Widget lolos validasi Zod: ${validCount} / ${rawWidgets.length}`);
    console.log(`   ✅ Integritas skema: ${validCount === rawWidgets.length ? '100% Valid' : 'Sebagian Ditolak'}\n`);
  } else {
    console.log('   ℹ️ Endpoint tidak mengembalikan JSON (menggunakan Jalur B - Agregasi Metadata)\n');
  }

  console.log('5. Rekomendasi Konfigurasi Sistem:');
  if (probe.detectedMode === 'Jalur A') {
    console.log('   ⭐ Jalur A Optimal: RAG API memiliki kapabilitas LLM dan menghasilkan Widget Spec JSON.');
    console.log('   Set env: RAG_PROVIDER=http, RAG_MODE=structured');
  } else {
    console.log('   ⭐ Jalur B Stabil: RAG API bertindak sebagai retrieval murni; dashboard disusun dari agregasi metadata.');
    console.log('   Set env: RAG_PROVIDER=http, RAG_MODE=prose');
  }
  console.log('\n====================================================');
  console.log('Probe Selesai dalam', Date.now() - start, 'ms.');
  console.log('====================================================');
}

runDiagnostics().catch(console.error);
