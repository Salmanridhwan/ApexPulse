/**
 * Centralized RAG Instruction Prompts for AionesBoard
 * These prompts instruct external RAG services (Jalur A / Jalur B)
 * without using any internal LLM API keys.
 */

export const RAG_PROMPTS = {
  /**
   * Instruction for Jalur A: Instructs RAG API to synthesize structured JSON Widget Specs
   */
  BUILD_DASHBOARD_JSON: (sector: string, userQuery: string, availableCatalogPresets: string) => `
Anda adalah mesin analisis data BUMD (${sector.toUpperCase()}).
Tugas Anda adalah menelusuri pangkalan data dokumen resmi instansi dan menyusun spesifikasi dashboard otomatis.

Permintaan Pengguna: "${userQuery}"

Aturan Wajib:
1. Setiap widget angka WAJIB memiliki sitasi ke dokumen sumber (nama dokumen, halaman, kutipan teks/chunkSnippet).
2. Keluarkan HANYA JSON murni yang sesuai dengan skema Zod ApexPulse tanpa format Markdown tambahan.
3. Gunakan preset ID katalog jika cocok: ${availableCatalogPresets}.
4. Tetapkan confidence ke "sumber" jika angka langsung tertera di dokumen, atau "inferensi AI" jika melalui estimasi agregasi.
5. Susun grid tata letak (w=4,6,12 dan h=3,4,5).

Format JSON:
{
  "dashboardTitle": "Judul Dashboard",
  "description": "Ringkasan eksekutif singkat",
  "sector": "${sector}",
  "widgets": [
    {
      "id": "w-...",
      "presetId": "P-01",
      "type": "kpi|line|area|bar|donut|table|narasi",
      "title": "Nama Widget",
      "confidence": "sumber|inferensi AI",
      "grid": { "x": 0, "y": 0, "w": 4, "h": 3 },
      "kpi": { "value": 12500000, "unit": "Rp", "delta": 12.4, "deltaLabel": "vs TW lalu" },
      "citations": [
        {
          "id": "c-1",
          "docName": "Laporan_Keuangan_TW1_2026.pdf",
          "page": 14,
          "chunkSnippet": "Realisasi penerimaan mencapai...",
          "confidenceScore": 0.98,
          "date": "2026-03-31"
        }
      ]
    }
  ]
}
`.trim(),

  /**
   * Instruction for Jalur B: Query for raw document chunks and metadata
   */
  METADATA_RETRIEVAL: (query: string, sector: string) => `
Cari dokumen dan tabel data terkait sektor ${sector} untuk topik: "${query}".
Kembalikan potongan teks (chunk) beserta metadata lengkap:
- docName: nama file PDF / LRA / RKAP
- page: nomor halaman
- periode: (misal 2026-Q1, 2026-M03, 2025-FY)
- nilai: nilai numerik metrik
- unit_kerja: bidang atau cabang (misal Wilayah Utara, Divisi Transmisi)
- kategori: Keuangan / Operasional / Pelayanan
`.trim(),

  /**
   * Instruction for targeted widget modification via chat
   */
  MODIFY_WIDGET: (action: string, targetWidgetTitle: string, userInstruction: string) => `
Perintah modifikasi widget: "${userInstruction}".
Target widget: "${targetWidgetTitle}".
Aksi yang diminta: ${action}.
Kembalikan instruksi perubahan parameter spesifikasi (type, title, chart series, atau remove flag) dalam JSON.
`.trim(),

  /**
   * Probe test prompt to verify RAG API capabilities
   */
  PROBE_TEST: `TEST_PROBE: Kembalikan JSON { "ping": "pong", "canOutputJson": true, "hasMetadata": true } dari pangkalan data dokumen.`,
};
