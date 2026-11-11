/**
 * PERTANYAAN TENTANG DASHBOARD ITU SENDIRI.
 *
 * "Ada berapa halaman dan apa namanya?" dan "apa sumber data kartu Aging 0-30
 * HARI?" jawabannya ada di metadata dashboard (daftar halaman, sitasi kartu),
 * bukan di dokumen. Dulu dua pertanyaan ini dikirim ke RAG dan dijawab "konteks
 * yang tersedia tidak memuat". Fungsi murni: tanpa jaringan, bisa diuji.
 */

import type { Dashboard, WidgetSpec } from '../../types';

const TANYA_HALAMAN =
  /\b(?:berapa|jumlah)\s+halaman\b|\bhalaman(?:nya)?\s+(?:apa\s+saja|ada\s+berapa|berapa)\b|\bnama(?:-nama)?\s+halaman(?:nya)?\b|\bdaftar\s+halaman\b/i;
const TANYA_SUMBER = /\b(?:sumber|asal)(?:\s+data)?(?:nya)?\b|\bdari\s+mana\b|\bdiambil\s+dari\b/i;
const KATA_KARTU = /\b(?:kartu|widget|chart|grafik|diagram|tabel)\b/i;
/** Halaman di dokumen ("halaman berapa di PDF-nya") bukan halaman dashboard. */
const KONTEKS_DOKUMEN = /\b(?:dokumen|pdf|berkas|file|laporan)\b/i;

function normal(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function daftarHalaman(d: Dashboard): Array<{ judul: string; widgets: WidgetSpec[] }> {
  return d.halaman && d.halaman.length > 0 ? d.halaman : [{ judul: 'Ringkasan', widgets: d.widgets || [] }];
}

/** Kartu yang judulnya disebut di kalimat — judul terpanjang yang cocok menang. */
export function cariKartuDisebut(prompt: string, d: Dashboard): { widget: WidgetSpec; halaman: string } | null {
  const t = ` ${normal(prompt)} `;
  let terbaik: { widget: WidgetSpec; halaman: string; panjang: number } | null = null;
  for (const h of daftarHalaman(d)) {
    for (const w of h.widgets || []) {
      const judul = normal(String(w.title || ''));
      if (judul.length < 3) continue;
      if (t.includes(` ${judul} `) && (!terbaik || judul.length > terbaik.panjang)) {
        terbaik = { widget: w, halaman: h.judul, panjang: judul.length };
      }
    }
  }
  return terbaik ? { widget: terbaik.widget, halaman: terbaik.halaman } : null;
}

/**
 * Jawaban dari metadata dashboard, atau `null` bila pertanyaannya bukan soal
 * dashboard (biar diteruskan ke RAG seperti biasa).
 */
export function jawabMetaDashboard(prompt: unknown, d: Dashboard | undefined): string | null {
  const t = String(prompt || '').trim();
  if (!t || !d || t.length > 240) return null;

  if (TANYA_SUMBER.test(t) && KATA_KARTU.test(t)) {
    const ketemu = cariKartuDisebut(t, d);
    if (ketemu) {
      const { widget: w, halaman } = ketemu;
      const sitasi = (w.citations || []).filter((c) => String(c?.docName || '').trim());
      const kepala = `Kartu **${w.title}** ada di halaman **${halaman}** (tipe ${w.type}).`;
      if (sitasi.length === 0) {
        return `${kepala}\n\nKartu ini tidak menyimpan rujukan dokumen, jadi sumbernya tidak bisa saya pastikan.`;
      }
      const unik = new Map<string, (typeof sitasi)[number]>();
      for (const c of sitasi) {
        const kunci = `${c.docName}|${c.page || ''}`;
        if (!unik.has(kunci)) unik.set(kunci, c);
      }
      const baris = [...unik.values()].slice(0, 5).map((c) => {
        const hlm = c.page && c.page > 0 ? `, hlm ${c.page}` : '';
        const kutip = String(c.chunkSnippet || '').replace(/\s+/g, ' ').trim().slice(0, 160);
        return `- ${c.docName}${hlm}${kutip ? `: "${kutip}${kutip.length >= 160 ? '…' : ''}"` : ''}`;
      });
      return `${kepala}\n\nSumber datanya:\n${baris.join('\n')}`;
    }
  }

  if (TANYA_HALAMAN.test(t) && !KONTEKS_DOKUMEN.test(t)) {
    const hal = daftarHalaman(d);
    const baris = hal.map((h, i) => `${i + 1}. ${h.judul} (${(h.widgets || []).length} kartu)`);
    return `Dashboard **${d.title}** punya **${hal.length} halaman**:\n\n${baris.join('\n')}`;
  }

  return null;
}
