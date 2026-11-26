/**
 * Kapan riwayat percakapan ikut dikirim sebagai teks pencarian ke layanan RAG.
 *
 * MASALAH NYATA (uji 26 Nov 2026): `query()` menempelkan persona + 6 giliran
 * riwayat + pertanyaan menjadi SATU teks pencarian. Akibatnya retrieval bergeser
 * mengikuti topik lama: pertanyaan yang sama dijawab benar di percakapan baru
 * ("piutang Rp31.590.429.300") tetapi dijawab `no_source` setelah percakapan
 * berisi soal pengadaan. Pertanyaan mandiri tidak butuh riwayat untuk mencari
 * dokumen; riwayat hanya perlu saat pengguna memakai rujukan ("itu", "tadi",
 * "tersebut") atau pertanyaannya sangat pendek sehingga konteksnya hilang.
 *
 * MURNI supaya bisa diuji tanpa server.
 */

/** Rujukan ke giliran sebelumnya — di sini riwayat WAJIB ikut. */
const RUJUKAN =
  /(?:^|[^a-z])(?:itu|tadi|tersebut|sebelumnya|tsb|sama|sama dengan|lanjut|lanjutkan|gimana kalau|bagaimana kalau|kalau yang|yang tadi|di atas)(?:[^a-z]|$)/i;

/** Pertanyaan panjang yang berdiri sendiri: maksudnya sudah jelas tanpa riwayat. */
const MAKS_KATA_MANDIRI = 4;

/**
 * Apakah riwayat perlu disertakan ke teks pencarian?
 *
 * @param prompt pertanyaan pengguna saat ini
 * @param adaRiwayat apakah ada riwayat yang bisa dikirim
 */
export function perluRiwayat(prompt: unknown, adaRiwayat = true): boolean {
  if (!adaRiwayat) return false;
  const t = String(prompt ?? '').trim();
  if (!t) return false;
  if (RUJUKAN.test(t)) return true;
  const kata = t.split(/\s+/).filter(Boolean);
  return kata.length <= MAKS_KATA_MANDIRI;
}
