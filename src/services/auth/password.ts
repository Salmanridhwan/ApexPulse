import { randomBytes } from 'crypto';

/**
 * Aturan kata sandi pengguna + pembuat kata sandi sementara.
 *
 * ponytail: satu fungsi murni `masalahKataSandi` dipakai server & (nanti) form,
 * supaya aturan tidak ditulis dua kali dan bisa diuji tanpa menjalankan server.
 */

export const PANJANG_MINIMAL = 10;

/**
 * Kata sandi bawaan yang dulu dipakai bersama (seed demo, dokumentasi, sandi
 * awal akun baru). Semua ini dianggap TIDAK sah sebagai sandi akhir: pengguna
 * yang masih memakainya wajib mengganti saat login.
 */
export const SANDI_BAWAAN_LAMA = ['apexpulse2026', 'aionesboard2026', 'demo123', 'password', '12345678'];

/**
 * Sandi bawaan akun admin yang berlaku sekarang.
 *
 * Sebelumnya aplikasi memaksa pengguna mengganti sandi saat login karena sandi
 * bawaan dipakai bersama. Atas permintaan pemilik aplikasi kewajiban itu
 * dihapus: akun admin memakai sandi tetap ini dan langsung bisa dipakai.
 */
export const SANDI_ADMIN_BAWAAN = 'Jagoai5758';

/** true bila kata sandi termasuk sandi bawaan/umum (termasuk DEMO_PASSWORD di env). */
export function adalahSandiBawaan(sandi: string): boolean {
  const daftar = [...SANDI_BAWAAN_LAMA];
  if (process.env.DEMO_PASSWORD) daftar.push(process.env.DEMO_PASSWORD);
  return daftar.includes(String(sandi || '').toLowerCase());
}

/**
 * Kembalikan alasan penolakan, atau null bila kata sandi layak.
 * Aturan sengaja sederhana dan bisa dijelaskan ke pengguna:
 * minimal 10 karakter, ada huruf dan angka, bukan sandi bawaan/umum.
 */
export function masalahKataSandi(sandi: string, email?: string): string | null {
  if (typeof sandi !== 'string' || sandi.length < PANJANG_MINIMAL) {
    return `Kata sandi minimal ${PANJANG_MINIMAL} karakter.`;
  }
  if (!/[a-zA-Z]/.test(sandi) || !/[0-9]/.test(sandi)) {
    return 'Kata sandi harus memuat huruf dan angka.';
  }
  if (SANDI_BAWAAN_LAMA.includes(sandi.toLowerCase())) {
    return 'Kata sandi itu dipakai banyak orang. Pilih yang lain.';
  }
  if (email) {
    const nama = email.split('@')[0]?.toLowerCase();
    if (nama && nama.length >= 3 && sandi.toLowerCase().includes(nama)) {
      return 'Kata sandi tidak boleh memuat bagian dari email Anda.';
    }
  }
  return null;
}

/**
 * Kata sandi sementara untuk akun baru / reset admin.
 * Format `Xxxxx-####` (10 karakter) — mudah dibacakan lewat telepon, tetap acak,
 * dan sudah memenuhi aturan panjang minimal.
 */
export function kataSandiSementara(): string {
  const huruf = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const angka = '23456789';
  const acak = (set: string, n: number) =>
    Array.from(randomBytes(n))
      .map((b) => set[b % set.length])
      .join('');
  return `${acak(huruf, 5)}-${acak(angka, 4)}`;
}
