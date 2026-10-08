import React from 'react';
import { Activity, Bell, Building2, Database, ShieldCheck, Users } from 'lucide-react';

/**
 * Daftar menu Panel Admin — SATU sumber untuk sidebar utama dan halaman Admin.
 *
 * Dulu menu ini hidup di dalam `Admin.tsx` sebagai sidebar kedua di dalam halaman,
 * sehingga sidebar utama aplikasi justru disembunyikan saat mode admin dan
 * pengguna berpindah antar dua navigasi. Sekarang menu ini dirender di sidebar
 * utama (grup "Sistem & Tata Kelola"), dan halaman Admin hanya menampilkan isi
 * tab yang dipilih — tidak ada lagi sidebar kedua.
 */
export type AdminTabId = 'overview' | 'users' | 'tenants' | 'rag' | 'alerts' | 'audit';

export interface AdminTab {
  id: AdminTabId;
  label: string;
  /** Judul halaman untuk bilah atas halaman admin. */
  judul: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ADMIN_TABS: AdminTab[] = [
  { id: 'overview', label: 'Ringkasan', judul: 'Ringkasan Sistem', icon: Activity },
  { id: 'users', label: 'Pengguna & RBAC', judul: 'Pengguna & RBAC', icon: Users },
  { id: 'tenants', label: 'BUMD & Tenant', judul: 'BUMD & Tenant', icon: Building2 },
  { id: 'rag', label: 'Konfigurasi RAG', judul: 'Konfigurasi RAG', icon: Database },
  { id: 'alerts', label: 'Ambang Batas', judul: 'Ambang Batas & Alert', icon: Bell },
  { id: 'audit', label: 'Jejak Audit', judul: 'Jejak Audit & Kepatuhan', icon: ShieldCheck },
];
