/**
 * Pembuat CSV sederhana untuk ekspor data (mis. log audit).
 *
 * ponytail: tidak memakai pustaka CSV — aturan RFC 4180 cukup ditangani di sini
 * (bungkus tanda kutip, gandakan kutip di dalam sel, jaga koma & baris baru).
 * Ditambahkan BOM supaya Excel versi Indonesia membaca UTF-8 dengan benar.
 */

export interface KolomCsv<T> {
  kunci: keyof T & string;
  judul: string;
}

/** Ubah satu sel menjadi teks CSV yang aman. */
export function selCsv(nilai: unknown): string {
  if (nilai === null || nilai === undefined) return '';
  const teks = String(nilai);
  // Sel yang mengandung pemisah, kutip, atau baris baru harus dibungkus kutip.
  if (/[",\r\n;]/.test(teks)) return `"${teks.replace(/"/g, '""')}"`;
  return teks;
}

/** Susun seluruh CSV (judul + baris) sebagai satu teks. */
export function keCsv<T extends object>(baris: readonly T[], kolom: KolomCsv<T>[]): string {
  const judul = kolom.map((k) => selCsv(k.judul)).join(',');
  const isi = baris.map((b) =>
    kolom.map((k) => selCsv((b as Record<string, unknown>)[k.kunci])).join(',')
  );
  // BOM + CRLF: format yang paling aman dibuka di Excel (Windows).
  return `\uFEFF${[judul, ...isi].join('\r\n')}\r\n`;
}
