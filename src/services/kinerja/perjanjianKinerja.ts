/**
 * Perjanjian Kinerja BUMD — dokumen komitmen target kinerja + capaian.
 *
 * Fungsi di sini MURNI (tanpa I/O) supaya persentase capaian, status, dan
 * ringkasan bisa diuji tanpa server — pola sama `services/risiko/register.ts`.
 *
 * Prinsip:
 * - **Persentase capaian DIHITUNG, bukan disimpan.** Rumusnya berbeda menurut
 *   arah indikator:
 *     - `maksimal` (semakin tinggi semakin baik): capaian = realisasi / target.
 *     - `minimal`  (semakin rendah semakin baik): capaian = target / realisasi.
 *   Tanpa membedakan arah, indikator seperti "tingkat kebocoran" akan salah
 *   dinilai (kebocoran turun justru dianggap gagal).
 * - **Ringkasan DIHITUNG dari dokumen nyata**, jadi angka di layar tak melenceng.
 * - **Dasar hukum:** PermenPANRB 53/2014 (Petunjuk Teknis Perjanjian Kinerja),
 *   Permendagri 37/2018 tentang pengelolaan BUMD (SAKIP).
 */
import type {
  ArahIndikator,
  IndikatorKinerja,
  PerjanjianKinerja,
  RingkasanPerjanjianKinerja,
  StatusPerjanjianKinerja,
} from '../../types';

/** Label manusiawi tiap status Perjanjian Kinerja. */
export const LABEL_STATUS_PK: Record<StatusPerjanjianKinerja, string> = {
  draf: 'Draf',
  aktif: 'Aktif',
  ditutup: 'Ditutup',
};

/** Label manusiawi tiap arah indikator. */
export const LABEL_ARAH: Record<ArahIndikator, string> = {
  maksimal: 'Maksimal (semakin tinggi semakin baik)',
  minimal: 'Minimal (semakin rendah semakin baik)',
};

/** Urutan status untuk rekap tetap. */
export const URUTAN_STATUS_PK: StatusPerjanjianKinerja[] = ['draf', 'aktif', 'ditutup'];

/** Normalisasi status PK; tak dikenal → `'draf'` (status paling awal/aman). */
export function normalisasiStatusPK(nilai: unknown): StatusPerjanjianKinerja {
  return nilai === 'aktif' || nilai === 'ditutup' || nilai === 'draf' ? nilai : 'draf';
}

/** Normalisasi arah indikator; tak dikenal → `'maksimal'` (paling lazim). */
export function normalisasiArah(nilai: unknown): ArahIndikator {
  return nilai === 'minimal' || nilai === 'maksimal' ? nilai : 'maksimal';
}

/**
 * Persentase capaian satu indikator (dibulatkan 1 desimal), atau `null` bila
 * belum ada realisasi / target tak sah.
 *
 * - arah `maksimal`: realisasi / target × 100
 * - arah `minimal` : target / realisasi × 100 (realisasi 0 → dianggap 100%,
 *   karena "semakin rendah semakin baik" dan 0 adalah hasil terbaik)
 */
export function hitungCapaian(indikator: Pick<IndikatorKinerja, 'target' | 'arah' | 'realisasi'>): number | null {
  const target = Number(indikator.target);
  const realisasi = Number(indikator.realisasi);
  if (!Number.isFinite(target) || target <= 0) return null;
  if (indikator.realisasi === undefined || indikator.realisasi === null || !Number.isFinite(realisasi)) return null;

  if (normalisasiArah(indikator.arah) === 'minimal') {
    if (realisasi <= 0) return 100; // capaian terbaik untuk indikator "semakin rendah semakin baik"
    return Math.round((target / realisasi) * 1000) / 10;
  }
  return Math.round((realisasi / target) * 1000) / 10;
}

/** Indikator dianggap tercapai bila capaian >= 100%. */
export function indikatorTercapai(indikator: Pick<IndikatorKinerja, 'target' | 'arah' | 'realisasi'>): boolean {
  const c = hitungCapaian(indikator);
  return c !== null && c >= 100;
}

/** Status warna capaian untuk UI: hijau (tercapai), kuning (dekat), merah (jauh). */
export function kategoriCapaian(capaian: number | null): 'tercapai' | 'dekat' | 'jauh' | 'belum' {
  if (capaian === null) return 'belum';
  if (capaian >= 100) return 'tercapai';
  if (capaian >= 80) return 'dekat';
  return 'jauh';
}

/**
 * Hitung ringkasan dari daftar Perjanjian Kinerja.
 * Rata-rata capaian hanya dari indikator yang SUDAH direalisasikan (supaya
 * dokumen yang belum dilaporkan tidak menekan angka rata-rata).
 */
export function hitungRingkasanPK(daftar: PerjanjianKinerja[]): RingkasanPerjanjianKinerja {
  const list = Array.isArray(daftar) ? daftar : [];
  const perStatus: Record<StatusPerjanjianKinerja, number> = { draf: 0, aktif: 0, ditutup: 0 };
  let jumlahIndikator = 0;
  let indikatorTerealisasi = 0;
  let indikatorTercapaiJumlah = 0;
  let totalCapaian = 0;

  for (const pk of list) {
    perStatus[normalisasiStatusPK(pk.status)] += 1;
    for (const ind of pk.indikator || []) {
      jumlahIndikator += 1;
      const c = hitungCapaian(ind);
      if (c === null) continue;
      indikatorTerealisasi += 1;
      totalCapaian += c;
      if (c >= 100) indikatorTercapaiJumlah += 1;
    }
  }

  const periodeTerbaru = list
    .map((p) => String(p.periode || ''))
    .filter(Boolean)
    .sort()
    .slice(-1)[0] || null;

  return {
    total: list.length,
    perStatus,
    jumlahIndikator,
    indikatorTerealisasi,
    indikatorTercapai: indikatorTercapaiJumlah,
    capaianRataRata: indikatorTerealisasi === 0 ? null : Math.round((totalCapaian / indikatorTerealisasi) * 10) / 10,
    periodeTerbaru,
  };
}

/** Validasi dokumen Perjanjian Kinerja (tanpa indikator). */
export function validasiPerjanjianKinerja(input: any): string | null {
  if (!input || typeof input !== 'object') return 'Data Perjanjian Kinerja tidak valid.';
  const nomor = String(input.nomor || '').trim();
  if (!nomor) return 'Nomor Perjanjian Kinerja wajib diisi.';
  if (nomor.length > 80) return 'Nomor terlalu panjang (maks 80 karakter).';
  const periode = String(input.periode || '').trim();
  if (!periode) return 'Periode wajib diisi.';
  if (periode.length > 40) return 'Periode terlalu panjang (maks 40 karakter).';
  const pihakKedua = String(input.pihakKedua || '').trim();
  if (!pihakKedua) return 'Pihak kedua (yang berjanji kinerja) wajib diisi.';
  if (pihakKedua.length > 120) return 'Nama pihak kedua terlalu panjang (maks 120 karakter).';
  if (input.status !== undefined && normalisasiStatusPK(input.status) !== input.status) {
    return `Status "${input.status}" tidak dikenal.`;
  }
  return null;
}

/** Validasi satu indikator kinerja. */
export function validasiIndikator(input: any): string | null {
  if (!input || typeof input !== 'object') return 'Data indikator tidak valid.';
  const sasaran = String(input.sasaran || '').trim();
  if (!sasaran) return 'Sasaran wajib diisi.';
  if (sasaran.length > 300) return 'Sasaran terlalu panjang (maks 300 karakter).';
  const indikator = String(input.indikator || '').trim();
  if (!indikator) return 'Rumusan indikator wajib diisi.';
  if (indikator.length > 300) return 'Indikator terlalu panjang (maks 300 karakter).';
  const satuan = String(input.satuan || '').trim();
  if (!satuan) return 'Satuan wajib diisi.';
  const target = Number(input.target);
  if (!Number.isFinite(target) || target < 0) return 'Target harus angka tidak negatif.';
  if (input.arah !== undefined && normalisasiArah(input.arah) !== input.arah) {
    return `Arah indikator "${input.arah}" tidak dikenal.`;
  }
  if (input.realisasi !== undefined && input.realisasi !== null && input.realisasi !== '') {
    const r = Number(input.realisasi);
    if (!Number.isFinite(r) || r < 0) return 'Realisasi harus angka tidak negatif.';
  }
  return null;
}

/** Buat satu indikator kinerja (dipakai server saat menyimpan). */
export function buatIndikator(input: any): IndikatorKinerja {
  const realisasi =
    input.realisasi === undefined || input.realisasi === null || input.realisasi === ''
      ? undefined
      : Number(input.realisasi);
  return {
    id: `ind-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sasaran: String(input.sasaran).trim(),
    indikator: String(input.indikator).trim(),
    satuan: String(input.satuan).trim(),
    target: Number(input.target),
    arah: normalisasiArah(input.arah),
    realisasi,
    catatanRealisasi: input.catatanRealisasi ? String(input.catatanRealisasi).trim() : undefined,
  };
}
