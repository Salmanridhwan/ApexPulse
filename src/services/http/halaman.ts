/**
 * Pemotongan halaman untuk endpoint daftar.
 *
 * ponytail: satu fungsi kecil dipakai bersama, bukan pustaka paginasi. Tujuan
 * utamanya bukan "fitur paginasi", tapi menjaga agar satu instansi dengan
 * ribuan entri log audit tidak mengirim seluruh riwayat dalam satu respons
 * (respons besar = halaman lambat + memori server naik).
 */

export interface HasilHalaman<T> {
  baris: T[];
  total: number;
  limit: number;
  offset: number;
}

const MAKS_LIMIT = 200;

function keAngka(nilai: unknown, bawaan: number): number {
  const n = typeof nilai === 'string' ? parseInt(nilai, 10) : typeof nilai === 'number' ? nilai : NaN;
  return Number.isFinite(n) ? n : bawaan;
}

/**
 * Ambil satu halaman dari `semua` dengan urutan TERBARU dulu.
 *
 * `semua` dianggap tersusun dari yang paling lama ke paling baru (urutan
 * penambahan), sehingga hasilnya dibalik lebih dulu. `limit` dibatasi 1..200
 * supaya klien tidak bisa meminta seluruh isi tabel sekaligus.
 */
export function potongHalaman<T>(
  semua: readonly T[],
  limitMentah: unknown,
  offsetMentah: unknown
): HasilHalaman<T> {
  const limit = Math.min(MAKS_LIMIT, Math.max(1, keAngka(limitMentah, 50)));
  const offset = Math.max(0, keAngka(offsetMentah, 0));
  const terbaruDulu = [...semua].reverse();
  return {
    baris: terbaruDulu.slice(offset, offset + limit),
    total: semua.length,
    limit,
    offset,
  };
}
