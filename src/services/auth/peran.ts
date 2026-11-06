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

/** Akun yang perannya `superadmin`. */
export function daftarSuperadmin<T extends { id: string; role?: string }>(semua: T[]): T[] {
  return semua.filter((u) => u.role === 'superadmin');
}

/**
 * Boleh tidaknya seorang superadmin diturunkan perannya atau dihapus.
 *
 * Admin Aiones adalah satu-satunya pihak yang bisa mengelola platform. Kalau
 * akun superadmin terakhir diturunkan atau dihapus, tidak ada lagi yang bisa
 * mengembalikannya lewat aplikasi — pemulihannya harus lewat database. Karena
 * itu aksi itu ditolak, bukan diberi peringatan yang bisa dilewati.
 */
export function bolehTurunkanSuperadmin(
  semua: Array<{ id: string; role?: string }>,
  targetId: string
): { boleh: boolean; alasan?: string } {
  const target = semua.find((u) => u.id === targetId);
  if (!target || target.role !== 'superadmin') return { boleh: true };
  const jumlah = daftarSuperadmin(semua).length;
  if (jumlah <= 1) {
    return {
      boleh: false,
      alasan:
        'Ini akun Admin Aiones terakhir. Angkat akun lain menjadi Admin Aiones dulu sebelum menurunkan atau menghapus akun ini.',
    };
  }
  return { boleh: true };
}
