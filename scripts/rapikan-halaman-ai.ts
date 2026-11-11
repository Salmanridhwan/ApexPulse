/**
 * MERAPIKAN HALAMAN DASHBOARD HASIL REKOMENDASI AI YANG SUDAH ADA.
 *
 * Dashboard yang dibuat sebelum aturan tata letak baru masih memakai tinggi
 * empat baris grid dan kadang punya halaman berisi satu kartu. Skrip ini
 * menerapkan `tataRapiHalaman` (aturan yang sama dengan generator) ke dashboard
 * yang punya penanda `ai`, TANPA menyentuh dashboard yang disusun manual.
 *
 * Jalankan: npx tsx scripts/rapikan-halaman-ai.ts [--uji]
 *   --uji = hanya tampilkan rencana perubahan, tidak menyimpan.
 */
import { readFileSync } from 'node:fs';
import { tataRapiHalaman } from '../src/services/analisis/rekomendasiAi';

const DASAR = process.env.AIONES_BASE || 'http://localhost:3000';
const JAR = process.env.AIONES_JAR || 'scratch/jar-v.txt';
const UJI = process.argv.includes('--uji');

/** Ambil cookie dari berkas jar Netscape yang dipakai curl. */
function cookieDariJar(berkas: string): string {
  try {
    return readFileSync(berkas, 'utf8')
      .split('\n')
      .filter((b) => b && !b.startsWith('#') || b.startsWith('#HttpOnly_'))
      .map((b) => b.replace(/^#HttpOnly_/, '').split('\t'))
      .filter((k) => k.length >= 7)
      .map((k) => `${k[5]}=${k[6]}`)
      .join('; ');
  } catch {
    return '';
  }
}

const tinggi = (widgets: any[]): number =>
  Math.max(0, ...widgets.map((w) => (w.grid?.y || 0) + (w.grid?.h || 0)));

async function utama() {
  const cookie = cookieDariJar(JAR);
  const daftar = await (await fetch(`${DASAR}/api/dashboards`, { headers: { cookie } })).json();
  let diubah = 0;

  for (const d of daftar as any[]) {
    /**
     * Dashboard hasil AI versi lama tidak lagi membawa penanda `ai` (penanda itu
     * hanya hidup selama penyusunan), jadi dasar perbaikannya adalah BENTUK
     * halamannya: tinggi kurang dari enam baris (format lama) atau ada halaman
     * berisi satu kartu.
     */
    if (!Array.isArray(d.halaman)) continue;
    const halaman = d.halaman || [];
    if (halaman.length === 0) continue;
    const perlu = halaman.some((h: any) => tinggi(h.widgets || []) < 6 || (h.widgets || []).length <= 1);
    if (!perlu) continue;

    const baru = tataRapiHalaman(halaman.map((h: any) => ({ judul: h.judul, widgets: h.widgets || [] })));
    console.log(`${d.id} | ${d.title}`);
    halaman.forEach((h: any) => console.log(`  sebelum [${h.judul}] ${(h.widgets || []).length} kartu, tinggi ${tinggi(h.widgets || [])}`));
    baru.forEach((h) => console.log(`  sesudah [${h.judul}] ${h.widgets.length} kartu, tinggi ${tinggi(h.widgets)}`));

    if (UJI) continue;
    const isi = baru.map((h, i) => ({ ...halaman[i], ...h, widgets: h.widgets }));
    const r = await fetch(`${DASAR}/api/dashboards/${d.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ halaman: isi, widgets: isi[0]?.widgets || [] }),
    });
    console.log(`  simpan: HTTP ${r.status}`);
    if (r.ok) diubah += 1;
  }

  console.log(`\n${UJI ? 'RENCANA' : 'SELESAI'}: ${diubah} dashboard dirapikan.`);
}

utama().catch((e) => {
  console.error('gagal:', e?.message || e);
  process.exit(1);
});
