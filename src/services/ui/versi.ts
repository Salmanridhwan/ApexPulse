/**
 * Deteksi tab yang masih menjalankan bundel lama.
 *
 * ponytail: pembaruan aplikasi tidak otomatis masuk ke tab yang sudah terbuka —
 * JavaScript-nya sudah dimuat di memori. Akibatnya fitur baru (mis. tombol
 * Pratinjau pada saran chart) tidak muncul dan pengguna menyimpulkan fiturnya
 * tidak ada. Server menyebut versi bundel yang sedang dilayani; kalau berbeda
 * dengan versi saat halaman dimuat, tab itu perlu dimuat ulang.
 */

/** true hanya kalau kedua versi diketahui DAN berbeda (versi 'dev' diabaikan). */
export function perluMuatUlang(versiSaatMuat: string | null, versiServer: string | null): boolean {
  if (!versiSaatMuat || !versiServer) return false;
  if (versiSaatMuat === 'dev' || versiServer === 'dev') return false;
  return versiSaatMuat !== versiServer;
}
