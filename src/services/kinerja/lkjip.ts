/**
 * LKjIP — Laporan Kinerja Instansi Pemerintah (BUMD), disusun dari Perjanjian Kinerja.
 *
 * Fungsi di sini MURNI (tanpa I/O) supaya ringkasan, tenggat, dan validasi bisa
 * diuji tanpa server — pola sama `services/kinerja/perjanjianKinerja.ts`.
 *
 * Prinsip:
 * - **LKjIP menautkan Perjanjian Kinerja** (`perjanjianKinerjaIds`). Rata-rata
 *   capaian & jumlah indikator tercapai DIHITUNG dari indikator PK yang
 *   ditautkan — bukan diketik ulang — supaya laporan tidak bisa berbeda dari
 *   komitmennya (prinsip yang sama dengan capaian PK itu sendiri).
 * - **Tenggat 2 bulan** setelah tahun anggaran berakhir (Perpres 29/2014 tentang
 *   SAKIP). LKjIP yang belum `final` setelah tenggat dihitung terlambat.
 * - **Dasar hukum:** Perpres 29/2014 (SAKIP), PermenPANRB 53/2014 (Juknis
 *   Laporan Kinerja), Permendagri 37/2018 tentang pengelolaan BUMD.
 */
import type { BagianLKjIP, LKjIP, PerjanjianKinerja, RingkasanLKjIP, StatusLKjIP } from '../../types';
import { hitungCapaian } from './perjanjianKinerja';

/** Label manusiawi tiap status LKjIP. */
export const LABEL_STATUS_LKJIP: Record<StatusLKjIP, string> = {
  draf: 'Draf',
  final: 'Final',
};

/** Urutan status untuk rekap tetap. */
export const URUTAN_STATUS_LKJIP: StatusLKjIP[] = ['draf', 'final'];

/** Bulan jatuh tempo penyampaian setelah tahun anggaran berakhir (Februari). */
export const BULAN_TENGGAT = 2;

/** Normalisasi status LKjIP; tak dikenal → `'draf'` (status paling awal/aman). */
export function normalisasiStatusLKjIP(nilai: unknown): StatusLKjIP {
  return nilai === 'final' || nilai === 'draf' ? nilai : 'draf';
}

/** Tahun anggaran dari periode ("2026" → 2026), atau null bila tak sah. */
export function tahunPeriode(periode: unknown): number | null {
  const m = String(periode || '').match(/(\d{4})/);
  if (!m) return null;
  const t = Number(m[1]);
  return Number.isFinite(t) ? t : null;
}

/**
 * Tenggat penyampaian LKjIP = 31 Maret? Tidak: Perpres 29/2014 menetapkan
 * laporan disampaikan **paling lambat 2 bulan** setelah tahun anggaran berakhir,
 * jadi batas akhir = akhir bulan ke-2 tahun berikutnya (28/29 Februari).
 */
export function tenggatPenyampaian(periode: unknown): Date | null {
  const tahun = tahunPeriode(periode);
  if (tahun === null) return null;
  // Akhir bulan Februari tahun berikutnya. Bulan ber-index 0, jadi 1 Maret
  // tahun berikutnya dikurangi 1 ms = 23:59:59.999 tanggal terakhir Februari
  // (28 atau 29 saat kabisat).
  return new Date(Date.UTC(tahun + 1, 2, 1, 0, 0, 0) - 1);
}

/**
 * LKjIP sudah lewat tenggat? `true` bila tanggal sekarang sudah melewati
 * tenggat DAN status belum `final`. LKjIP yang sudah final dianggap selesai.
 */
export function lewatTenggat(lkjip: Pick<LKjIP, 'periode' | 'status'>, sekarang = new Date()): boolean {
  if (normalisasiStatusLKjIP(lkjip.status) === 'final') return false;
  const tenggat = tenggatPenyampaian(lkjip.periode);
  if (!tenggat) return false;
  return sekarang.getTime() > tenggat.getTime();
}

/**
 * Ringkas indikator dari Perjanjian Kinerja yang ditautkan sebuah LKjIP.
 * Mengembalikan { terealisasi, tercapai, rataCapaian } — `rataCapaian` null
 * bila tak ada indikator yang direalisasikan.
 */
export function ringkasIndikatorTertaut(
  lkjip: Pick<LKjIP, 'perjanjianKinerjaIds'>,
  semuaPK: PerjanjianKinerja[]
): { terealisasi: number; tercapai: number; rataCapaian: number | null } {
  const ids = new Set(Array.isArray(lkjip.perjanjianKinerjaIds) ? lkjip.perjanjianKinerjaIds : []);
  let terealisasi = 0;
  let tercapai = 0;
  let total = 0;
  for (const pk of semuaPK) {
    if (!ids.has(pk.id)) continue;
    for (const ind of pk.indikator || []) {
      const c = hitungCapaian(ind);
      if (c === null) continue;
      terealisasi += 1;
      total += c;
      if (c >= 100) tercapai += 1;
    }
  }
  return {
    terealisasi,
    tercapai,
    rataCapaian: terealisasi === 0 ? null : Math.round((total / terealisasi) * 10) / 10,
  };
}

/**
 * Hitung ringkasan LKjIP. Capaian ditarik dari PK tertaut; `perStatus` &
 * `lewatTenggat` dihitung dari dokumen LKjIP sendiri.
 */
export function hitungRingkasanLKjIP(
  daftarLKjIP: LKjIP[],
  semuaPK: PerjanjianKinerja[],
  sekarang = new Date()
): RingkasanLKjIP {
  const list = Array.isArray(daftarLKjIP) ? daftarLKjIP : [];
  const perStatus: Record<StatusLKjIP, number> = { draf: 0, final: 0 };
  let indikatorTerealisasi = 0;
  let indikatorTercapai = 0;
  let totalCapaian = 0;
  let adaCapaian = false;
  let lewat = 0;

  for (const l of list) {
    perStatus[normalisasiStatusLKjIP(l.status)] += 1;
    if (lewatTenggat(l, sekarang)) lewat += 1;
    const r = ringkasIndikatorTertaut(l, semuaPK);
    indikatorTerealisasi += r.terealisasi;
    indikatorTercapai += r.tercapai;
    if (r.rataCapaian !== null) {
      // Gabungkan rata-rata secara tertimbang memakai jumlah indikatornya.
      totalCapaian += r.rataCapaian * r.terealisasi;
      adaCapaian = true;
    }
  }

  const periodeTerbaru =
    list
      .map((l) => String(l.periode || ''))
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || null;

  return {
    total: list.length,
    perStatus,
    indikatorTerealisasi,
    indikatorTercapai,
    rataCapaian: !adaCapaian || indikatorTerealisasi === 0 ? null : Math.round((totalCapaian / indikatorTerealisasi) * 10) / 10,
    lewatTenggat: lewat,
    periodeTerbaru,
  };
}

/** Validasi dokumen LKjIP. */
export function validasiLKjIP(input: any): string | null {
  if (!input || typeof input !== 'object') return 'Data LKjIP tidak valid.';
  const periode = String(input.periode || '').trim();
  if (!periode) return 'Periode wajib diisi.';
  if (periode.length > 40) return 'Periode terlalu panjang (maks 40 karakter).';
  const nomor = String(input.nomor || '').trim();
  if (!nomor) return 'Nomor LKjIP wajib diisi.';
  if (nomor.length > 80) return 'Nomor terlalu panjang (maks 80 karakter).';
  const judul = String(input.judul || '').trim();
  if (!judul) return 'Judul laporan wajib diisi.';
  if (judul.length > 300) return 'Judul terlalu panjang (maks 300 karakter).';
  if (input.status !== undefined && normalisasiStatusLKjIP(input.status) !== input.status) {
    return `Status "${input.status}" tidak dikenal.`;
  }
  return null;
}

/** Validasi satu bagian/bab LKjIP. */
export function validasiBagian(input: any): string | null {
  if (!input || typeof input !== 'object') return 'Data bagian tidak valid.';
  const judul = String(input.judul || '').trim();
  if (!judul) return 'Judul bagian wajib diisi.';
  if (judul.length > 200) return 'Judul bagian terlalu panjang (maks 200 karakter).';
  const isi = String(input.isi || '').trim();
  if (!isi) return 'Isi bagian wajib diisi.';
  if (isi.length > 20000) return 'Isi bagian terlalu panjang (maks 20.000 karakter).';
  return null;
}

/** Buat satu bagian LKjIP (dipakai server saat menyimpan). */
export function buatBagian(input: any): BagianLKjIP {
  return {
    id: `bab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    judul: String(input.judul).trim(),
    isi: String(input.isi).trim(),
  };
}
