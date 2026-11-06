import type { UserRole } from '../../types';

/**
 * Peran pengelola (Admin Aiones dan Admin Instansi).
 *
 * Dipakai bersama oleh server dan UI supaya keduanya memakai definisi yang
 * sama. Sebelum ini, pengecekan peran ditulis ulang di banyak tempat sebagai
 * `role === 'admin'`, sehingga penambahan `superadmin` berisiko membuat akun
 * Admin Aiones justru kehilangan akses ke panel yang seharusnya ia kelola.
 */
export function isAdminRole(role: unknown): boolean {
  return role === 'admin' || role === 'superadmin';
}

/** Hanya Admin Aiones: lintas instansi, konfigurasi platform, akun admin. */
export function isSuperadmin(role: unknown): boolean {
  return role === 'superadmin';
}

/** Label peran untuk ditampilkan ke pengguna. */
export function labelPeran(role: unknown): string {
  if (role === 'superadmin') return 'Admin Aiones';
  if (role === 'admin') return 'Admin Instansi';
  return 'User';
}

/**
 * Apakah peran ini boleh menyusun dashboard (membuat, mengubah, menghapus).
 *
 * Kebalikannya bukan "tidak boleh apa-apa": `pengguna` tetap boleh bertanya di
 * chat, mengunggah dokumen, dan mengajukan permintaan data.
 */
export function bolehMenyusunDashboard(role: UserRole | string | undefined): boolean {
  return isAdminRole(role);
}
