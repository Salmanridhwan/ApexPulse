/**
 * Manajemen aset BUMD — daftar aset + penyusutan garis lurus + ringkasan.
 *
 * Fungsi di sini MURNI (tanpa I/O) supaya nilai buku, penyusutan, dan ringkasan
 * bisa diuji tanpa server — pola sama `services/risiko/register.ts`.
 *
 * Prinsip:
 * - **Nilai buku & akumulasi penyusutan DIHITUNG, bukan diterima dari klien.**
 *   Metode garis lurus: `(nilaiPerolehan - nilaiResidu) / umurEkonomis` per
 *   tahun, dibatasi sampai umur ekonomis terpakai. **Tanah tidak disusutkan**
 *   (praktik akuntansi yang lazim). Nilai buku tidak pernah negatif.
 * - **Ringkasan DIHITUNG dari daftar nyata**, jadi angka di layar tak melenceng.
 * - **Dasar hukum:** Permendagri 19/2016 (pengelolaan barang milik daerah),
 *   Permendagri 37/2018 tentang pengelolaan BUMD.
 */
import type {
  Aset,
  KategoriAset,
  KondisiAset,
  RingkasanAset,
  StatusPemanfaatan,
} from '../../types';

/** Label manusiawi tiap kategori aset. */
export const LABEL_KATEGORI_ASET: Record<KategoriAset, string> = {
  tanah: 'Tanah',
  bangunan: 'Bangunan',
  mesin: 'Mesin & Pompa',
  jaringan: 'Jaringan Distribusi',
  kendaraan: 'Kendaraan',
  peralatan: 'Peralatan & Perangkat',
  lainnya: 'Lain-lain',
};

/** Label manusiawi tiap kondisi aset. */
export const LABEL_KONDISI: Record<KondisiAset, string> = {
  baik: 'Baik',
  rusak_ringan: 'Rusak Ringan',
  rusak_berat: 'Rusak Berat',
};

/** Label manusiawi tiap status pemanfaatan. */
export const LABEL_PEMANFAATAN: Record<StatusPemanfaatan, string> = {
  digunakan: 'Digunakan Operasional',
  idle: 'Idle / Tak Termanfaatkan',
  disewakan: 'Disewakan',
  dilepas: 'Dilepas/Dihapuskan',
};

/** Urutan tetap kategori supaya tampilan rekap tidak berubah-ubah. */
export const URUTAN_KATEGORI_ASET: KategoriAset[] = [
  'tanah',
  'bangunan',
  'mesin',
  'jaringan',
  'kendaraan',
  'peralatan',
  'lainnya',
];

/** Urutan kondisi dari paling baik ke paling buruk. */
export const URUTAN_KONDISI: KondisiAset[] = ['baik', 'rusak_ringan', 'rusak_berat'];

/** Umur ekonomis maksimum yang masuk akal (tahun). */
export const UMUR_EKONOMIS_MAKS = 50;

/**
 * Apakah kategori ini disusutkan?
 * Tanah tidak disusutkan (nilainya cenderung tetap/naik) — praktik akuntansi
 * yang lazim dan konsisten dengan kebijakan penyusutan BMD.
 */
export function disusutkan(kategori: KategoriAset): boolean {
  return kategori !== 'tanah';
}

/** Normalisasi kategori aset dari input bebas; tak dikenal → `'lainnya'`. */
export function normalisasiKategoriAset(nilai: unknown): KategoriAset {
  return URUTAN_KATEGORI_ASET.includes(nilai as KategoriAset) ? (nilai as KategoriAset) : 'lainnya';
}

/** Normalisasi kondisi; tak dikenal → `'baik'` (jangan menuduh rusak tanpa data). */
export function normalisasiKondisi(nilai: unknown): KondisiAset {
  return nilai === 'rusak_ringan' || nilai === 'rusak_berat' || nilai === 'baik' ? nilai : 'baik';
}

/** Normalisasi status pemanfaatan; tak dikenal → `'digunakan'`. */
export function normalisasiPemanfaatan(nilai: unknown): StatusPemanfaatan {
  return nilai === 'idle' || nilai === 'disewakan' || nilai === 'dilepas' || nilai === 'digunakan'
    ? nilai
    : 'digunakan';
}

/** Angka Rupiah yang sah (>= 0), selain itu 0. */
function rupiahSah(nilai: unknown): number {
  const n = Number(nilai);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Umur ekonomis yang sah (1..UMUR_EKONOMIS_MAKS). */
export function umurEkonomisSah(nilai: unknown): number {
  const n = Math.round(Number(nilai));
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(UMUR_EKONOMIS_MAKS, n));
}

/**
 * Penyusutan per tahun (garis lurus) = (perolehan - residu) / umur ekonomis.
 * Tanah → 0. Residu yang melebihi perolehan diabaikan (dasar penyusutan 0).
 */
export function penyusutanTahunan(aset: Pick<Aset, 'kategori' | 'nilaiPerolehan' | 'nilaiResidu' | 'umurEkonomis'>): number {
  const kategori = normalisasiKategoriAset(aset.kategori);
  if (!disusutkan(kategori)) return 0;
  const perolehan = rupiahSah(aset.nilaiPerolehan);
  const residu = Math.min(rupiahSah(aset.nilaiResidu), perolehan);
  const umur = umurEkonomisSah(aset.umurEkonomis);
  return Math.round(((perolehan - residu) / umur) * 100) / 100;
}

/** Umur berjalan (tahun) sejak perolehan sampai tahun perhitungan, minimum 0. */
export function umurBerjalan(
  aset: Pick<Aset, 'tahunPerolehan'>,
  tahun: number = new Date().getFullYear()
): number {
  const mulai = Number(aset.tahunPerolehan);
  const kini = Number(tahun);
  if (!Number.isFinite(mulai) || !Number.isFinite(kini)) return 0;
  return Math.max(0, kini - mulai);
}

/**
 * Akumulasi penyusutan sampai tahun perhitungan.
 * Dibatasi umur ekonomis: setelah habis, akumulasi = perolehan - residu.
 */
export function akumulasiPenyusutan(
  aset: Pick<Aset, 'kategori' | 'nilaiPerolehan' | 'nilaiResidu' | 'umurEkonomis' | 'tahunPerolehan'>,
  tahun: number = new Date().getFullYear()
): number {
  const perTahun = penyusutanTahunan(aset);
  if (perTahun === 0) return 0;
  const umur = umurEkonomisSah(aset.umurEkonomis);
  const terpakai = Math.min(umurBerjalan(aset, tahun), umur);
  return Math.round(perTahun * terpakai * 100) / 100;
}

/**
 * Nilai buku = perolehan - akumulasi penyusutan, tidak pernah di bawah residu
 * dan tidak pernah negatif.
 */
export function nilaiBuku(
  aset: Pick<Aset, 'kategori' | 'nilaiPerolehan' | 'nilaiResidu' | 'umurEkonomis' | 'tahunPerolehan'>,
  tahun: number = new Date().getFullYear()
): number {
  const perolehan = rupiahSah(aset.nilaiPerolehan);
  const buku = perolehan - akumulasiPenyusutan(aset, tahun);
  return Math.max(0, Math.round(buku * 100) / 100);
}

/**
 * Hitung ringkasan aset dari daftar nyata pada tahun tertentu.
 * Aset yang sudah `dilepas` tetap dihitung di daftar (jejak historis), tetapi
 * UI dapat menyaringnya; di sini semuanya dijumlahkan apa adanya.
 */
export function hitungRingkasanAset(daftarAset: Aset[], tahun: number = new Date().getFullYear()): RingkasanAset {
  const daftar = Array.isArray(daftarAset) ? daftarAset : [];
  const perKondisi: Record<KondisiAset, number> = { baik: 0, rusak_ringan: 0, rusak_berat: 0 };
  const perKategoriMap = new Map<KategoriAset, { total: number; nilaiBuku: number }>();
  let nilaiPerolehanTotal = 0;
  let nilaiBukuTotal = 0;
  let akumulasiPenyusutanTotal = 0;
  let jumlahIdle = 0;

  for (const a of daftar) {
    const perolehan = rupiahSah(a.nilaiPerolehan);
    const buku = nilaiBuku(a, tahun);
    nilaiPerolehanTotal += perolehan;
    nilaiBukuTotal += buku;
    akumulasiPenyusutanTotal += akumulasiPenyusutan(a, tahun);

    perKondisi[normalisasiKondisi(a.kondisi)] += 1;
    if (normalisasiPemanfaatan(a.pemanfaatan) === 'idle') jumlahIdle += 1;

    const kategori = normalisasiKategoriAset(a.kategori);
    const agg = perKategoriMap.get(kategori) || { total: 0, nilaiBuku: 0 };
    agg.total += 1;
    agg.nilaiBuku += buku;
    perKategoriMap.set(kategori, agg);
  }

  const perKategori = URUTAN_KATEGORI_ASET.filter((k) => perKategoriMap.has(k)).map((kategori) => {
    const a = perKategoriMap.get(kategori)!;
    return { kategori, total: a.total, nilaiBuku: Math.round(a.nilaiBuku * 100) / 100 };
  });

  return {
    total: daftar.length,
    nilaiPerolehanTotal: Math.round(nilaiPerolehanTotal * 100) / 100,
    nilaiBukuTotal: Math.round(nilaiBukuTotal * 100) / 100,
    akumulasiPenyusutanTotal: Math.round(akumulasiPenyusutanTotal * 100) / 100,
    perKategori,
    perKondisi,
    jumlahRusakBerat: perKondisi.rusak_berat,
    jumlahIdle,
    tahunPerhitungan: tahun,
  };
}

/**
 * Validasi input aset dari klien.
 * Mengembalikan pesan galat (Bahasa Indonesia) atau `null` bila sah.
 */
export function validasiAset(input: any): string | null {
  if (!input || typeof input !== 'object') return 'Data aset tidak valid.';
  const kode = String(input.kode || '').trim();
  if (!kode) return 'Kode aset wajib diisi.';
  if (kode.length > 40) return 'Kode aset terlalu panjang (maks 40 karakter).';
  const nama = String(input.nama || '').trim();
  if (!nama) return 'Nama aset wajib diisi.';
  if (nama.length > 200) return 'Nama aset terlalu panjang (maks 200 karakter).';

  const tahun = Number(input.tahunPerolehan);
  if (!Number.isFinite(tahun) || tahun < 1900 || tahun > 2200) {
    return 'Tahun perolehan tidak valid.';
  }
  const perolehan = Number(input.nilaiPerolehan);
  if (!Number.isFinite(perolehan) || perolehan < 0) {
    return 'Nilai perolehan harus angka tidak negatif.';
  }
  const residu = Number(input.nilaiResidu ?? 0);
  if (!Number.isFinite(residu) || residu < 0) {
    return 'Nilai residu harus angka tidak negatif.';
  }
  if (residu > perolehan) return 'Nilai residu tidak boleh melebihi nilai perolehan.';
  const umur = Number(input.umurEkonomis);
  if (!Number.isFinite(umur) || umur < 1 || umur > UMUR_EKONOMIS_MAKS) {
    return `Umur ekonomis harus 1 sampai ${UMUR_EKONOMIS_MAKS} tahun.`;
  }

  const kategori = normalisasiKategoriAset(input.kategori);
  if (
    input.kategori !== undefined &&
    input.kategori !== null &&
    String(input.kategori).trim() &&
    kategori === 'lainnya' &&
    input.kategori !== 'lainnya'
  ) {
    return `Kategori aset "${input.kategori}" tidak dikenal.`;
  }
  return null;
}
