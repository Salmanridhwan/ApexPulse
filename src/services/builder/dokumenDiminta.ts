/**
 * Dokumen yang disebut pengguna di kalimatnya: "buatkan dashboard dari dokumen
 * Piutang 2026" -> "Piutang 2026.xlsx".
 *
 * MURNI (tanpa I/O) supaya bisa diuji. Nama dokumen dipecah menjadi kata; kata
 * yang muncul di banyak nama dokumen (mis. "pam", "jaya", "2026") tidak
 * membedakan apa-apa dan tidak dihitung. Dokumen terpilih bila kata pembedanya
 * ada di kalimat dan kalimatnya menyebut dokumen/file/berkas, atau bila SEMUA
 * kata pembedanya disebut.
 */

const KATA_UMUM = new Set([
  'dokumen', 'document', 'file', 'berkas', 'data', 'laporan', 'report', 'rekap', 'final', 'fix', 'revisi',
  'all', 'area', 'sheet', 'xlsx', 'xls', 'csv', 'pdf', 'docx', 'doc', 'untuk', 'dari', 'dan', 'the',
]);

const kata = (teks: string): string[] =>
  String(teks || '')
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/, '')
    .split(/[^a-z0-9]+/)
    .filter((k) => k.length >= 3 && !/^\d+$/.test(k) && !KATA_UMUM.has(k));

const SEBUT_DOKUMEN = /(?:^|[^a-z])(?:dokumen|document|file|berkas|excel|spreadsheet|sheet|xlsx|pdf)(?:nya)?(?:[^a-z]|$)/i;

export function dokumenDariPermintaan(prompt: string, daftarNama: string[]): string | undefined {
  const teks = String(prompt || '').toLowerCase();
  const kataPrompt = new Set(teks.split(/[^a-z0-9]+/).filter(Boolean));
  const nama = [...new Set(daftarNama.filter(Boolean))];
  // Berapa nama dokumen yang memuat tiap kata: kata yang ada di >2 nama tidak membedakan.
  const frekuensi = new Map<string, number>();
  for (const n of nama) for (const k of new Set(kata(n))) frekuensi.set(k, (frekuensi.get(k) ?? 0) + 1);
  const sebutDokumen = SEBUT_DOKUMEN.test(teks);

  let terbaik: { nama: string; cocok: number; porsi: number } | undefined;
  let seri = false;
  for (const n of nama) {
    const pembeda = [...new Set(kata(n))].filter((k) => (frekuensi.get(k) ?? 0) <= 2);
    if (pembeda.length === 0) continue;
    const cocok = pembeda.filter((k) => kataPrompt.has(k)).length;
    if (cocok === 0) continue;
    const porsi = cocok / pembeda.length;
    if (!sebutDokumen && porsi < 1) continue;
    const lebihBaik = !terbaik || cocok > terbaik.cocok || (cocok === terbaik.cocok && porsi > terbaik.porsi);
    const sama = terbaik && cocok === terbaik.cocok && porsi === terbaik.porsi;
    if (lebihBaik) {
      terbaik = { nama: n, cocok, porsi };
      seri = false;
    } else if (sama) seri = true;
  }
  // Dua dokumen sama kuat ("dokumen 2026"): jangan menebak.
  return terbaik && !seri ? terbaik.nama : undefined;
}

/** Nama dokumen tanpa ekstensi, untuk judul dashboard ("Piutang 2026"). */
export const namaTanpaEkstensi = (nama: string): string => String(nama || '').replace(/\.[a-z0-9]{2,5}$/i, '').trim();
