/**
 * RINGKASAN PLATFORM untuk Admin Aiones.
 *
 * Fungsi murni: menerima koleksi apa adanya, mengembalikan angka yang bisa
 * dibaca. Tanpa Express, tanpa database — supaya hitungannya bisa diuji dan
 * tidak "kelihatan benar" hanya karena tampil di layar.
 */

import { pemakaianHariIni } from '../analisis/jalankan';
import { KUOTA_ANALISIS_BAWAAN, sisaKuota } from '../analisis/antrean';

export interface BahanRingkasan {
  tenants: Array<{ id: string; name?: string }>;
  users: Array<{ tenantId?: string; role?: string }>;
  dashboards: Array<{ tenantId?: string }>;
  permintaan: Array<{ tenantId?: string; status?: string }>;
  analisis: Array<{ tenantId?: string; status?: string; metode?: string; dibuatPada?: string }>;
  butir: Array<{ tenantId?: string; status?: string }>;
  kuota?: number;
  sekarang?: number;
}

export interface RingkasanPlatform {
  jumlahInstansi: number;
  akun: { total: number; superadmin: number; admin: number; pengguna: number };
  dashboard: number;
  permintaan: { total: number; perluTindakan: number; selesai: number };
  analisis: { total: number; selesai: number; gagal: number; tertundaKuota: number };
  butir: { total: number; disetujui: number; draf: number; ditolak: number };
  /** Pemakaian analisis AI hari ini, dibanding kuota per instansi. */
  kuotaHariIni: { terpakai: number; kapasitas: number; instansiHabis: number };
}

function hitung<T>(daftar: T[], cocok: (x: T) => boolean): number {
  return daftar.filter(cocok).length;
}

export function ringkasPlatform(b: BahanRingkasan): RingkasanPlatform {
  const sekarang = b.sekarang ?? Date.now();
  const kuota = b.kuota ?? KUOTA_ANALISIS_BAWAAN;

  // Pemakaian dihitung per instansi: satu instansi yang boros tidak boleh
  // menghabiskan kuota instansi lain.
  let terpakai = 0;
  let instansiHabis = 0;
  for (const t of b.tenants) {
    const milik = b.analisis.filter((a) => a.tenantId === t.id) as Array<{
      metode: string;
      dibuatPada: string;
      status: string;
    }>;
    const pakai = pemakaianHariIni(
      milik.map((a) => ({ metode: String(a.metode || ''), dibuatPada: String(a.dibuatPada || ''), status: String(a.status || '') })),
      sekarang
    );
    terpakai += pakai;
    if (sisaKuota(pakai, kuota) === 0) instansiHabis += 1;
  }

  return {
    jumlahInstansi: b.tenants.length,
    akun: {
      total: b.users.length,
      superadmin: hitung(b.users, (u) => u.role === 'superadmin'),
      admin: hitung(b.users, (u) => u.role === 'admin'),
      pengguna: hitung(b.users, (u) => u.role === 'pengguna' || (!u.role ? true : false)),
    },
    dashboard: b.dashboards.length,
    permintaan: {
      total: b.permintaan.length,
      perluTindakan: hitung(b.permintaan, (p) => p.status === 'baru' || p.status === 'perlu_data'),
      selesai: hitung(b.permintaan, (p) => p.status === 'selesai'),
    },
    analisis: {
      total: b.analisis.length,
      selesai: hitung(b.analisis, (a) => a.status === 'selesai'),
      gagal: hitung(b.analisis, (a) => a.status === 'gagal'),
      tertundaKuota: hitung(b.analisis, (a) => a.status === 'tertunda-kuota'),
    },
    butir: {
      total: b.butir.length,
      disetujui: hitung(b.butir, (x) => x.status === 'disetujui'),
      draf: hitung(b.butir, (x) => x.status === 'draf'),
      ditolak: hitung(b.butir, (x) => x.status === 'ditolak'),
    },
    kuotaHariIni: { terpakai, kapasitas: kuota * b.tenants.length, instansiHabis },
  };
}

/** Pemakaian per instansi — untuk tabel kuota di panel Admin Aiones. */
export function kuotaPerInstansi(
  b: BahanRingkasan
): Array<{ tenantId: string; nama: string; terpakai: number; kuota: number; sisa: number }> {
  const sekarang = b.sekarang ?? Date.now();
  const kuota = b.kuota ?? KUOTA_ANALISIS_BAWAAN;
  return b.tenants.map((t) => {
    const milik = b.analisis
      .filter((a) => a.tenantId === t.id)
      .map((a) => ({ metode: String(a.metode || ''), dibuatPada: String(a.dibuatPada || ''), status: String(a.status || '') }));
    const pakai = pemakaianHariIni(milik, sekarang);
    return {
      tenantId: t.id,
      nama: t.name || t.id,
      terpakai: pakai,
      kuota,
      sisa: sisaKuota(pakai, kuota),
    };
  });
}
