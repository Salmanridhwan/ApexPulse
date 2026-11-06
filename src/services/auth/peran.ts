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
/** Label peran dalam bentuk tabel (dipakai tes & UI yang butuh pemetaan). */
export const LABEL_PERAN: Record<UserRole, string> = {
  superadmin: 'Admin Aiones',
  admin: 'Admin Instansi',
  pengguna: 'User',
};

/**
 * Normalisasi peran dari sesi/data lama (bertipe `string`) menjadi `UserRole`.
 *
 * Peran lama `analis` dan `direksi` digabung menjadi `pengguna` (gabungan hak
 * keduanya). Nilai tak dikenal juga diperlakukan sebagai `pengguna` — peran
 * paling terbatas, supaya kesalahan data tidak pernah menaikkan hak akses.
 *
 * Fungsi ini dulu tinggal di `services/laporan/alur.ts` bersama alur verifikasi
 * pelaporan. Setelah fitur Kinerja & Kepatuhan dihapus, bagian yang masih
 * dipakai (normalisasi peran) dipindah ke sini supaya tidak ada modul yatim.
 */
export function normalisasiPeran(peran: unknown): UserRole {
  return peran === 'admin' ? 'admin' : 'pengguna';
}

/**
 * Normalisasi peran AKUN (bukan tahap alur).
 *
 * Berbeda dari `normalisasiPeran` yang hanya mengenal `admin`/`pengguna`:
 * `superadmin` harus dipertahankan, sebab kalau tidak, akun Admin Aiones akan
 * turun jadi `pengguna` setiap kali state dimuat ulang dari MySQL atau
 * `data/db.json`.
 */
export function normalisasiPeranAkun(peran: unknown): UserRole {
  if (peran === 'superadmin') return 'superadmin';
  return normalisasiPeran(peran);
}
