/**
 * Sinkronisasi konfigurasi antar-instance.
 *
 * ponytail: produksi berjalan di dua host dengan database yang sama, tetapi
 * `systemConfig` & daftar instansi hanya dibaca SEKALI saat start. Akibatnya
 * perubahan yang disimpan admin di host A (base URL RAG, API key, KB default,
 * SMTP, instansi baru) tidak terlihat di host B sampai host itu di-restart —
 * pengguna yang terlempar ke host B melihat perilaku lama dan mengira
 * penyimpanannya gagal.
 *
 * Fungsi di sini murni (tanpa I/O) supaya bisa diuji: yang menentukan adalah
 * perbandingan nilai, bukan "selalu timpa" — menimpa terus-menerus akan
 * menghapus perubahan yang belum tersimpan di instance ini.
 */

/** Urutkan kunci objek supaya perbandingan JSON stabil antar-instance. */
function stabil(nilai: unknown): string {
  if (nilai === null || typeof nilai !== 'object') return JSON.stringify(nilai) ?? 'undefined';
  if (Array.isArray(nilai)) return `[${nilai.map(stabil).join(',')}]`;
  const obj = nilai as Record<string, unknown>;
  const kunci = Object.keys(obj).sort();
  return `{${kunci.map((k) => `${JSON.stringify(k)}:${stabil(obj[k])}`).join(',')}}`;
}

/** Daftar kunci yang nilainya berbeda antara konfigurasi lama dan baru. */
export function kunciKonfigBerubah(
  lama: Record<string, unknown> | undefined,
  baru: Record<string, unknown> | undefined
): string[] {
  if (!baru || typeof baru !== 'object') return [];
  const lamaAman = lama && typeof lama === 'object' ? lama : {};
  const berubah: string[] = [];
  for (const k of Object.keys(baru)) {
    if (stabil(lamaAman[k]) !== stabil(baru[k])) berubah.push(k);
  }
  return berubah;
}

/**
 * Gabungkan konfigurasi dari database ke konfigurasi di memori.
 * Kunci yang tidak ada di database dibiarkan (mis. nilai default kode).
 */
export function gabungKonfig(
  lama: Record<string, unknown> | undefined,
  baru: Record<string, unknown> | undefined
): Record<string, unknown> {
  const dasar = lama && typeof lama === 'object' ? lama : {};
  if (!baru || typeof baru !== 'object') return { ...dasar };
  return { ...dasar, ...baru };
}

/**
 * Apakah daftar instansi berubah? Dibandingkan per-id dengan isi stabil,
 * sehingga urutan baris dari database tidak memicu "perubahan" palsu.
 */
export function daftarBerubah<T extends { id: string }>(lama: T[], baru: T[]): boolean {
  if (lama.length !== baru.length) return true;
  const petaLama = new Map(lama.map((x) => [x.id, stabil(x)]));
  for (const x of baru) {
    if (petaLama.get(x.id) !== stabil(x)) return true;
  }
  return false;
}
