import 'dotenv/config';
import fs from 'node:fs';
import { ConfigurableRagClient } from '../src/services/rag/http';
import { dekripsiNilai } from '../src/services/config/rahasia';
import { uraiTabelWilayah, uraiCatatanWilayah } from '../src/services/templates/wilayahLayanan';

const db = JSON.parse(fs.readFileSync('data/db.json', 'utf8'));
const cfg = db.systemConfig || {};
const klien = new ConfigurableRagClient(() => ({
  provider: cfg.ragProvider,
  baseUrl: cfg.ragApiUrl,
  apiKey: dekripsiNilai(cfg.ragApiKey),
  kbId: 'kb_pam_jaya',
}));

const cari = await klien.cariPotongan(
  'kb_pam_jaya',
  'kinerja per wilayah layanan pelanggan air terjual NRW pengaduan Jakarta Pusat Utara Barat Selatan Timur',
  20
);
console.log('potongan kembali:', cari.potongan.length);
const p = cari.potongan.find((x) => /Kinerja per wilayah layanan/i.test(x.isi));
if (!p) { console.log('TIDAK ADA tabel wilayah'); process.exit(0); }
console.log('dokumen:', p.docName, '| halaman:', p.halaman);
const { baris, total } = uraiTabelWilayah(p.isi);
for (const b of baris) console.log(' ', b.wilayah, b.pelanggan, b.airTerjual, b.nrw, b.pengaduan, b.per1000);
console.log(' total:', total?.pelanggan, total?.airTerjual, total?.nrw, total?.pengaduan);
console.log(' catatan:', uraiCatatanWilayah(p.isi).length, 'wilayah');
