/**
 * ATURAN PERMINTAAN DATA — bagian yang murni (tanpa DB, tanpa Express).
 *
 * Dipisahkan supaya bisa diuji tanpa menyalakan server, dan supaya satu-satunya
 * tempat aturan status berada adalah berkas ini. Server hanya memanggilnya;
 * UI memakai daftar status yang sama untuk menampilkan pilihan.
 */

import type { StatusPermintaan } from '../../types';

/** Enam bidang bawaan. Instansi boleh menambah bidang lain (disimpan apa adanya). */
export const BIDANG_BAWAAN = ['Keuangan', 'Operasional', 'Pelayanan', 'SDM', 'Kinerja', 'Umum'] as const;

export const SEMUA_STATUS: StatusPermintaan[] = ['baru', 'diproses', 'perlu_data', 'selesai', 'ditolak'];

export const LABEL_STATUS: Record<StatusPermintaan, string> = {
  baru: 'Baru',
  diproses: 'Diproses',
  perlu_data: 'Perlu Data',
  selesai: 'Selesai',
  ditolak: 'Ditolak',
};

/**
 * Perpindahan status yang sah. `selesai` dan `ditolak` sengaja tidak punya
 * tujuan keluar: permintaan yang sudah ditutup harus diajukan ulang, bukan
 * dibuka kembali diam-diam — supaya jejak siapa menutup dan kapan tetap jelas.
 */
export const TRANSISI_STATUS: Record<StatusPermintaan, StatusPermintaan[]> = {
  baru: ['diproses', 'perlu_data', 'ditolak'],
  perlu_data: ['diproses', 'ditolak'],
  diproses: ['perlu_data', 'selesai', 'ditolak'],
  selesai: [],
  ditolak: [],
};

/** true bila status `dari` boleh berpindah ke `ke`. Status sama dianggap sah. */
export function bolehUbahStatus(dari: StatusPermintaan, ke: StatusPermintaan): boolean {
  if (dari === ke) return true;
  return (TRANSISI_STATUS[dari] || []).includes(ke);
}

/** Status akhir: tidak bisa diubah lagi. */
export function statusFinal(status: StatusPermintaan): boolean {
  return (TRANSISI_STATUS[status] || []).length === 0;
}

/** Status yang masih butuh tindakan admin (dipakai untuk lencana kotak masuk). */
export function perluTindakanAdmin(status: StatusPermintaan): boolean {
  return status === 'baru' || status === 'perlu_data';
}

/** Bidang dirapikan; kosong jatuh ke 'Umum' supaya tidak ada kartu tanpa kolom. */
export function normalisasiBidang(bidang: unknown): string {
  const teks = typeof bidang === 'string' ? bidang.trim() : '';
  if (!teks) return 'Umum';
  // Samakan huruf besar/kecil ke bidang bawaan bila isinya sama.
  const cocok = BIDANG_BAWAAN.find((b) => b.toLowerCase() === teks.toLowerCase());
  return cocok || teks.slice(0, 40);
}

const PRIORITAS_SAH = ['rendah', 'normal', 'tinggi'] as const;

export function normalisasiPrioritas(nilai: unknown): 'rendah' | 'normal' | 'tinggi' {
  const teks = typeof nilai === 'string' ? nilai.trim().toLowerCase() : '';
  return (PRIORITAS_SAH as readonly string[]).includes(teks)
    ? (teks as 'rendah' | 'normal' | 'tinggi')
    : 'normal';
}

/** Tanggal target: terima YYYY-MM-DD saja; selain itu diabaikan (undefined). */
export function normalisasiTanggal(nilai: unknown): string | undefined {
  if (typeof nilai !== 'string') return undefined;
  const teks = nilai.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(teks)) return undefined;
  const d = new Date(`${teks}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return teks;
}

export interface MasukanPermintaanBaru {
  bidang?: unknown;
  dataDiminta?: unknown;
  arahDashboard?: unknown;
  prioritas?: unknown;
  targetSelesai?: unknown;
}

export interface HasilValidasi {
  galat?: string;
  nilai?: {
    bidang: string;
    dataDiminta: string;
    arahDashboard?: string;
    prioritas: 'rendah' | 'normal' | 'tinggi';
    targetSelesai?: string;
  };
}

/**
 * Validasi permintaan baru. `dataDiminta` wajib karena inilah satu-satunya
 * keterangan yang dibaca admin; tanpa itu admin hanya menerima bidang kosong
 * dan harus bertanya balik — persis yang ingin dihindari alur ini.
 */
export function validasiPermintaanBaru(masukan: MasukanPermintaanBaru): HasilValidasi {
  const dataDiminta = typeof masukan.dataDiminta === 'string' ? masukan.dataDiminta.trim() : '';
  if (dataDiminta.length < 10) {
    return { galat: 'Tuliskan data yang diminta minimal 10 karakter supaya admin paham maksudnya.' };
  }
  if (dataDiminta.length > 2000) {
    return { galat: 'Uraian data terlalu panjang (maksimal 2000 karakter).' };
  }
  const arah = typeof masukan.arahDashboard === 'string' ? masukan.arahDashboard.trim() : '';
  if (arah.length > 2000) {
    return { galat: 'Catatan arah dashboard terlalu panjang (maksimal 2000 karakter).' };
  }
  return {
    nilai: {
      bidang: normalisasiBidang(masukan.bidang),
      dataDiminta,
      arahDashboard: arah || undefined,
      prioritas: normalisasiPrioritas(masukan.prioritas),
      targetSelesai: normalisasiTanggal(masukan.targetSelesai),
    },
  };
}

/**
 * Satu baris ringkas untuk daftar kotak masuk: "Keuangan · 3 lampiran · 2 hari lalu".
 * Dihitung di server supaya UI tidak perlu tahu aturan penulisan tanggal.
 */
export function ringkasPermintaan(p: {
  bidang: string;
  lampiran?: unknown[];
  createdAt: string;
  status: StatusPermintaan;
}): string {
  const bagian = [p.bidang || 'Umum'];
  const jumlahLampiran = Array.isArray(p.lampiran) ? p.lampiran.length : 0;
  if (jumlahLampiran > 0) bagian.push(`${jumlahLampiran} lampiran`);
  bagian.push(`${umurHari(p.createdAt)} hari lalu`);
  if (statusFinal(p.status)) bagian.push(LABEL_STATUS[p.status].toLowerCase());
  return bagian.join(' · ');
}

/** Umur dalam hari (dibulatkan ke bawah, minimal 0). */
export function umurHari(iso: string, sekarang: Date = new Date()): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  const selisih = sekarang.getTime() - t;
  if (selisih <= 0) return 0;
  return Math.floor(selisih / 86_400_000);
}

/**
 * Apakah `pengguna` boleh menyunting isi permintaan? Hanya pemohonnya sendiri,
 * dan hanya selama belum dikerjakan admin (`baru` atau saat bola di pemohon
 * karena `perlu_data`).
 */
export function bolehSuntingIsi(
  permintaan: { pemohonId: string; status: StatusPermintaan },
  userId: string
): boolean {
  if (permintaan.pemohonId !== userId) return false;
  return permintaan.status === 'baru' || permintaan.status === 'perlu_data';
}

/** Apakah `userId` boleh melihat permintaan ini? Pemohon atau admin instansi. */
export function bolehMelihat(
  permintaan: { pemohonId: string },
  userId: string,
  admin: boolean
): boolean {
  return admin || permintaan.pemohonId === userId;
}
