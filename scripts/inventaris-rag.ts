import 'dotenv/config';
import fs from 'node:fs';
import { ConfigurableRagClient } from '../src/services/rag/http';
import { dekripsiNilai } from '../src/services/config/rahasia';
import { kumpulkanPotongan } from '../src/services/rag/potonganDokumen';

const db = JSON.parse(fs.readFileSync('data/db.json', 'utf8'));
const cfg = db.systemConfig || {};
const apiKey = dekripsiNilai(cfg.ragApiKey);
const base = String(cfg.ragApiUrl || '').replace(/\/+$/, '');
const klien = new ConfigurableRagClient(() => ({
  provider: cfg.ragProvider,
  baseUrl: cfg.ragApiUrl,
  apiKey,
  kbId: 'kb_pam_jaya',
  kmsUrl: cfg.kmsApiUrl,
}));

const KB = 'kb_pam_jaya';
const daftar: any = await klien.daftarDokumen(KB, 30000);
const panggil = async (kueri: string, topK: number) => {
  const res = await fetch(`${base}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ knowledge_base_id: KB, query: kueri, top_k: topK }),
    signal: AbortSignal.timeout(60000),
  });
  return res.json();
};

const keluaran: any[] = [];
for (const d of daftar.dokumen || []) {
  const h = await kumpulkanPotongan({ kb: KB, docId: d.id, nama: d.nama, jumlahKatalog: d.potongan, panggil });
  keluaran.push({ nama: d.nama, id: d.id, halaman: d.halaman, katalog: d.potongan, terambil: h.potongan.length, potongan: h.potongan.map((p) => ({ halaman: p.halaman, isi: p.isi })) });
  console.log(d.nama, '| katalog', d.potongan, '| terambil', h.potongan.length);
}
fs.writeFileSync('data/inventaris-rag.json', JSON.stringify(keluaran, null, 2));
console.log('tersimpan: data/inventaris-rag.json');
