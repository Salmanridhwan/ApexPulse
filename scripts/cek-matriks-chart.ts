/**
 * CETAK MATRIKS CHART DAN PERBARUI BERKAS STATUS.
 *
 * Jalankan: npx tsx scripts/cek-matriks-chart.ts
 *
 * - Mencetak jumlah sel terisi dan sel bolong per varian.
 * - Menambahkan sel baru ke `data/status-desain.json` dengan status `draf`.
 * - TIDAK menurunkan status yang sudah ada. Sel yang sudah `final` atau
 *   `menunggu oke` dibiarkan apa adanya, karena hanya user yang boleh
 *   menurunkan atau menaikkan status.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DAFTAR_CHART, varianTersedia } from '../src/services/chart/chartDefault';
import { SEL_TERISI } from '../src/services/chart/chartTemplate';
import { VARIAN, type Varian } from '../src/services/chart/gayaVarian';

const BERKAS = path.join('data', 'status-desain.json');

interface StatusSel {
  chartId: string;
  varian: Varian;
  status: 'draf' | 'menunggu oke' | 'final';
  catatan: string;
  diperbaruiPada: string;
}

const lama: Record<string, StatusSel> = (() => {
  if (!fs.existsSync(BERKAS)) return {};
  try {
    return JSON.parse(fs.readFileSync(BERKAS, 'utf8')) as Record<string, StatusSel>;
  } catch {
    return {};
  }
})();

const sekarang = new Date().toISOString();
const baru: Record<string, StatusSel> = {};

// Kunci di luar sel matriks (mis. `defaultChart` yang menandai katalog tipe
// default sudah final) WAJIB dipertahankan. Kalau dibuang, status final hilang
// setiap kali skrip ini dijalankan.
for (const [kunci, nilai] of Object.entries(lama)) {
  if (!kunci.includes('/')) baru[kunci] = nilai;
}

for (const sel of SEL_TERISI) {
  const kunci = `${sel.chartId}/${sel.varian}`;
  const sebelumnya = lama[kunci];
  baru[kunci] = sebelumnya
    ? { ...sebelumnya, chartId: sel.chartId, varian: sel.varian }
    : { chartId: sel.chartId, varian: sel.varian, status: 'draf', catatan: '', diperbaruiPada: sekarang };
}

fs.mkdirSync(path.dirname(BERKAS), { recursive: true });
fs.writeFileSync(BERKAS, `${JSON.stringify(baru, null, 2)}\n`, 'utf8');

const total = DAFTAR_CHART.length * VARIAN.length;
const terisi = SEL_TERISI.length;

console.log(`Chart default : ${DAFTAR_CHART.length}`);
console.log(`Varian        : ${VARIAN.join(', ')}`);
console.log(`Sel wajib     : ${total}`);
console.log(`Sel terisi    : ${terisi}`);
console.log(`Sel bolong    : ${total - terisi}`);
console.log('');
for (const v of VARIAN) {
  const ada = SEL_TERISI.filter((s) => s.varian === v).length;
  console.log(`  ${v.padEnd(10)} ${ada}/${DAFTAR_CHART.length}`);
}

const bolong = SEL_TERISI.length
  ? DAFTAR_CHART.flatMap((id) =>
      VARIAN.filter((v) => !varianTersedia(id).includes(v)).map((v) => `${id}/${v}`)
    )
  : [];

console.log('');
if (bolong.length) {
  console.log('Sel yang belum ada desainnya:');
  for (const b of bolong) console.log(`  - ${b}`);
} else {
  console.log('Semua sel sudah terisi.');
}

const selBaru = Object.entries(baru).filter(([k]) => k.includes('/'));
const dipertahankan = selBaru.filter(([, s]) => s.status !== 'draf').length;
console.log('');
console.log(`Status di ${BERKAS}: ${selBaru.length} sel, ${dipertahankan} di antaranya sudah bukan draf.`);
