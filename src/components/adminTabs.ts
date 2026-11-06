import React from 'react';
import { Activity, Bell, Building2, Database, Gauge, LayoutGrid, ShieldCheck, Users } from 'lucide-react';

/**
 * Daftar menu Panel Admin — SATU sumber untuk sidebar utama dan halaman Admin.
 *
 * Dulu menu ini hidup di dalam `Admin.tsx` sebagai sidebar kedua di dalam halaman,
 * sehingga sidebar utama aplikasi justru disembunyikan saat mode admin dan
 * pengguna berpindah antar dua navigasi. Sekarang menu ini dirender di sidebar
 * utama (grup "Sistem & Tata Kelola"), dan halaman Admin hanya menampilkan isi
 * tab yang dipilih — tidak ada lagi sidebar kedua.
 */
export type AdminTabId = 'overview' | 'users' | 'tenants' | 'menu' | 'rag' | 'kuota' | 'alerts' | 'audit';

export interface AdminTab {
  id: AdminTabId;
  label: string;
  /** Judul halaman untuk bilah atas halaman admin. */
  judul: string;
  icon: React.ComponentType<{ className?: string }>;
  /**
   * Siapa yang boleh melihat tab ini.
   *
   * `superadmin` = lintas instansi & konfigurasi platform (Admin Aiones).
   * `admin` = urusan instansinya sendiri (Admin Instansi).
   *
   * Pemisahan ini bukan hiasan: Admin Instansi yang bisa membuka tab Instansi
   * akan melihat daftar instansi lain beserta knowledge base-nya.
   */
  peran: 'admin' | 'superadmin';
}

export const ADMIN_TABS: AdminTab[] = [
  { id: 'overview', label: 'Ringkasan', judul: 'Ringkasan Sistem', icon: Activity, peran: 'admin' },
  { id: 'users', label: 'Pengguna & RBAC', judul: 'Pengguna & RBAC', icon: Users, peran: 'admin' },
  { id: 'tenants', label: 'Instansi & KB', judul: 'Instansi & Knowledge Base', icon: Building2, peran: 'superadmin' },
  { id: 'menu', label: 'Tampilan Menu', judul: 'Tampilan Menu Instansi', icon: LayoutGrid, peran: 'admin' },
  { id: 'rag', label: 'Konfigurasi RAG', judul: 'Konfigurasi RAG', icon: Database, peran: 'superadmin' },
  { id: 'kuota', label: 'Kuota AI', judul: 'Kuota Analisis AI per Instansi', icon: Gauge, peran: 'superadmin' },
  { id: 'alerts', label: 'Ambang Batas', judul: 'Ambang Batas & Alert', icon: Bell, peran: 'admin' },
  { id: 'audit', label: 'Jejak Audit', judul: 'Jejak Audit & Kepatuhan', icon: ShieldCheck, peran: 'superadmin' },
];

/**
 * Tab yang boleh dilihat satu peran.
 *
 * Admin Instansi hanya melihat tab urusan instansinya sendiri (ringkasan, akun,
 * tampilan menu, ambang batas). Tab lintas instansi — Instansi & KB, RAG, Kuota
 * AI, jejak audit — hanya untuk Admin Aiones, karena isinya menyangkut instansi
 * lain.
 */
export function tabUntukPeran(peran: unknown): AdminTab[] {
  if (peran === 'superadmin') return ADMIN_TABS;
  if (peran === 'admin') return ADMIN_TABS.filter((t) => t.peran === 'admin');
  return [];
}
