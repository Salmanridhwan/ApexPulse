/**
 * PERTANYAAN TENTANG ISI REPOSITORI — "ada berapa dokumen?", "dokumen apa saja?".
 *
 * Model bahasa hanya melihat potongan teks yang terambil (top-k), bukan daftar
 * isi knowledge base. Kalau ditanya jumlah dokumen, ia menjawab dari potongan
 * yang kebetulan terambil — pernah menjawab "5 dokumen" padahal basis berisi 8.
 * Untuk pertanyaan seperti ini jawabannya harus diambil dari DAFTAR NYATA
 * (`ragClient.daftarDokumen`), bukan dari ingatan model.
 */

const POLA: RegExp[] = [
  /\b(?:berapa|jumlah|total)\b[^.?!]{0,40}\bdokumen(?:nya)?\b/i,
  /\bdokumen(?:nya)?\b[^.?!]{0,30}\b(?:berapa|jumlahnya|totalnya|ada\s+berapa)\b/i,
  /\b(?:daftar|list)\b[^.?!]{0,30}\bdokumen(?:nya)?\b/i,
  /\bdokumen(?:nya)?\s+(?:apa|apa saja|yang mana|apa sajakah)\b/i,
  /\b(?:repositori|basis\s*dokumen|basis\s*data|knowledge\s*base|kb)\b[^.?!]{0,30}\b(?:dokumen|isi|berkas|berisi)\b/i,
  /\b(?:dokumen|berkas|file)\b[^.?!]{0,25}\b(?:di|pada)\s+(?:repositori|basis|knowledge\s*base)\b/i,
  /\b(?:isi|isinya|daftar|jumlah|total)\b[^.?!]{0,25}\b(?:repositori|basis\s*dokumen|basis\s*data|knowledge\s*base)\b/i,
];

/**
 * Pertanyaan tentang JENIS dokumen tertentu ("berapa dokumen SOP yang wajib
 * ada?") adalah pertanyaan ISI, bukan pertanyaan isi repositori. Jangan
 * dibelokkan ke daftar berkas.
 */
const BUKAN_INVENTARIS = /\bdokumen\s+(?:sop|rkap|lra|rba|laporan|kontrak|keuangan|anggaran|kinerja|audit|perjanjian|studi)\b/i;

/** Apakah pengguna menanyakan ISI repositori (bukan isi salah satu dokumen)? */
export function adalahPertanyaanDokumen(prompt: unknown): boolean {
  const t = String(prompt || '').trim();
  if (!t || t.length > 240) return false;
  if (BUKAN_INVENTARIS.test(t)) return false;
  return POLA.some((p) => p.test(t));
}

export interface DokumenBasis {
  id?: string;
  nama: string;
  status?: string;
  halaman?: number;
  potongan?: number;
  token?: number;
}

const angkaID = (n?: number): string =>
  typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('id-ID') : '—';

/**
 * Susun jawaban dari daftar dokumen yang BENAR-BENAR ada di basis instansi.
 * Tidak mengarang: kalau daftar tidak bisa dibaca, katakan apa adanya.
 */
export function susunJawabanDokumen(
  hasil: { jumlah: number; dokumen: DokumenBasis[]; catatan?: string } | null | undefined,
  namaInstansi?: string
): string {
  const instansi = namaInstansi ? `**${namaInstansi}**` : 'instansi ini';
  if (!hasil || hasil.jumlah === 0) {
    return (
      `Saya belum bisa membaca daftar dokumen ${instansi}.` +
      (hasil?.catatan ? `\n\nCatatan teknis: ${hasil.catatan}` : '') +
      `\n\nSilakan buka halaman **Repositori Dokumen** untuk melihat isinya, atau coba lagi sebentar lagi.`
    );
  }

  const baris = hasil.dokumen.map((d, i) => {
    const bagian = [
      d.halaman ? `${d.halaman} hlm` : '',
      d.potongan ? `${d.potongan} potongan` : '',
      d.token ? `${angkaID(d.token)} token` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const status = d.status && d.status !== 'completed' ? ` (status: ${d.status})` : '';
    return `${i + 1}. ${d.nama}${bagian ? ` — ${bagian}` : ''}${status}`;
  });

  const semuaSiap = hasil.dokumen.every((d) => !d.status || d.status === 'completed');
  return (
    `Di basis dokumen ${instansi} ada **${hasil.jumlah} dokumen**${semuaSiap ? ', semuanya sudah terindeks' : ''}:\n\n` +
    baris.join('\n') +
    `\n\nDaftar ini saya baca langsung dari basis dokumen instansi (bukan perkiraan dari potongan teks yang terambil), ` +
    `jadi jumlahnya sama dengan yang tampil di halaman Repositori Dokumen.`
  );
}
