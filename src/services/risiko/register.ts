/**
 * Manajemen risiko BUMD — register risiko + heat map 5×5.
 *
 * Fungsi di sini MURNI (tanpa I/O) supaya skor, level, dan ringkasan bisa diuji
 * tanpa server — persis pola `services/audit/tindakLanjut.ts`.
 *
 * Prinsip:
 * - **Skor & level DIHITUNG, bukan diterima dari klien.** `skor = kemungkinan ×
 *   dampak`, `level` diturunkan dari skor. Nilai yang dikirim klien diabaikan
 *   supaya tingkat risiko tidak bisa dipalsukan (prinsip yang sama dengan rasio
 *   kesehatan keuangan).
 * - **Ringkasan DIHITUNG dari register nyata** (termasuk heat map 5×5), jadi
 *   angka di layar tidak bisa melenceng dari datanya.
 * - **Dasar hukum:** PP 60/2008 (SPIP) Pasal 13 mewajibkan penilaian risiko;
 *   Permendagri 37/2018 tentang pengelolaan BUMD.
 */
import type {
  AksiMitigasi,
  KategoriRisiko,
  LevelRisiko,
  RingkasanRisiko,
  Risiko,
  StatusRisiko,
} from '../../types';

/** Label manusiawi tiap level risiko. */
export const LABEL_LEVEL: Record<LevelRisiko, string> = {
  rendah: 'Rendah',
  sedang: 'Sedang',
  tinggi: 'Tinggi',
  ekstrem: 'Ekstrem',
};

/** Label manusiawi tiap kategori risiko. */
export const LABEL_KATEGORI: Record<KategoriRisiko, string> = {
  strategis: 'Strategis',
  operasional: 'Operasional',
  keuangan: 'Keuangan',
  kepatuhan: 'Kepatuhan',
  reputasi: 'Reputasi',
};

/** Label manusiawi tiap status risiko. */
export const LABEL_STATUS_RISIKO: Record<StatusRisiko, string> = {
  teridentifikasi: 'Teridentifikasi',
  dimitigasi: 'Sedang Dimitigasi',
  terkendali: 'Terkendali',
  ditutup: 'Ditutup',
};

/** Urutan tetap kategori supaya tampilan rekap tidak berubah-ubah. */
export const URUTAN_KATEGORI: KategoriRisiko[] = [
  'strategis',
  'operasional',
  'keuangan',
  'kepatuhan',
  'reputasi',
];

/** Urutan level dari terendah ke tertinggi (untuk perbandingan & rekap). */
export const URUTAN_LEVEL: LevelRisiko[] = ['rendah', 'sedang', 'tinggi', 'ekstrem'];

/**
 * Peta level risiko dari skor (kemungkinan × dampak, rentang 1-25).
 *
 * Ambang mengikuti pola matriks 5×5 yang lazim di SPIP:
 * skor 1-4 rendah, 5-9 sedang, 10-16 tinggi, 17-25 ekstrem.
 * Ini SATU-SATUNYA tempat ambang didefinisikan — UI memanggil fungsi ini,
 * jangan menyalin ambangnya.
 */
export function levelDariSkor(skor: number): LevelRisiko {
  const s = Number(skor);
  if (!Number.isFinite(s)) return 'rendah';
  if (s >= 17) return 'ekstrem';
  if (s >= 10) return 'tinggi';
  if (s >= 5) return 'sedang';
  return 'rendah';
}

/** Batasi skala 1-5 (kemungkinan/dampak) ke bilangan bulat yang sah. */
export function batasiSkala(nilai: unknown, bawaan = 1): number {
  const n = Math.round(Number(nilai));
  if (!Number.isFinite(n)) return bawaan;
  return Math.max(1, Math.min(5, n));
}

/** Hitung skor = kemungkinan × dampak dari skala yang sudah dibatasi. */
export function hitungSkor(kemungkinan: unknown, dampak: unknown): number {
  return batasiSkala(kemungkinan) * batasiSkala(dampak);
}

/** Bobot numerik level untuk perbandingan (mis. cari level tertinggi). */
export function bobotLevel(level: LevelRisiko): number {
  return URUTAN_LEVEL.indexOf(level);
}

/** Level tertinggi dari sekumpulan level (null bila kosong). */
export function levelTertinggi(levels: Array<LevelRisiko | null | undefined>): LevelRisiko | null {
  let tertinggi: LevelRisiko | null = null;
  for (const l of levels) {
    if (!l) continue;
    if (tertinggi === null || bobotLevel(l) > bobotLevel(tertinggi)) tertinggi = l;
  }
  return tertinggi;
}

/**
 * Normalisasi kategori dari input bebas. Tak dikenal → `'operasional'`
 * (kategori paling umum), bukan dibuang, supaya risiko tetap tercatat.
 */
export function normalisasiKategori(nilai: unknown): KategoriRisiko {
  return nilai === 'strategis' ||
    nilai === 'operasional' ||
    nilai === 'keuangan' ||
    nilai === 'kepatuhan' ||
    nilai === 'reputasi'
    ? nilai
    : 'operasional';
}

/**
 * Normalisasi status. Tak dikenal → `'teridentifikasi'` (status paling awal),
 * supaya kesalahan data tidak pernah mengklaim risiko sudah terkendali.
 */
export function normalisasiStatusRisiko(nilai: unknown): StatusRisiko {
  return nilai === 'dimitigasi' || nilai === 'terkendali' || nilai === 'ditutup' || nilai === 'teridentifikasi'
    ? nilai
    : 'teridentifikasi';
}

/** Normalisasi level dari input bebas; tak dikenal → `null`. */
export function normalisasiLevel(nilai: unknown): LevelRisiko | undefined {
  return nilai === 'rendah' || nilai === 'sedang' || nilai === 'tinggi' || nilai === 'ekstrem'
    ? nilai
    : undefined;
}

/** Status yang dianggap "sudah aman" (tidak lagi jadi tunggakan). */
export function sudahAman(status: StatusRisiko): boolean {
  return status === 'terkendali' || status === 'ditutup';
}

/** Batas waktu sudah lewat? (risiko yang belum aman dihitung terlambat). */
export function lewatBatas(risiko: Pick<Risiko, 'batasWaktu' | 'status'>, sekarang = new Date()): boolean {
  if (!risiko.batasWaktu) return false;
  if (sudahAman(normalisasiStatusRisiko(risiko.status))) return false;
  const t = new Date(risiko.batasWaktu).getTime();
  if (!Number.isFinite(t)) return false;
  return t < sekarang.getTime();
}

/**
 * Bangun matriks heat map 5×5.
 * `matriks[kemungkinan-1][dampak-1]` = jumlah risiko pada sel itu.
 * Baris = kemungkinan (1..5, bawah ke atas di UI), kolom = dampak (1..5).
 */
export function bangunMatriks(risiko: Risiko[]): number[][] {
  const m: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
  for (const r of risiko) {
    const k = batasiSkala(r.kemungkinan);
    const d = batasiSkala(r.dampak);
    m[k - 1][d - 1] += 1;
  }
  return m;
}

/**
 * Hitung ringkasan register risiko dari data nyata.
 * `risikoTinggi` = jumlah level `tinggi` + `ekstrem` (prioritas direksi).
 */
export function hitungRingkasanRisiko(risiko: Risiko[], sekarang = new Date()): RingkasanRisiko {
  const daftar = Array.isArray(risiko) ? risiko : [];
  const perLevel: Record<LevelRisiko, number> = { rendah: 0, sedang: 0, tinggi: 0, ekstrem: 0 };
  const perKategoriMap = new Map<KategoriRisiko, { total: number; levels: LevelRisiko[] }>();
  let lewatTenggat = 0;
  let totalSkor = 0;

  for (const r of daftar) {
    // Level dihitung ulang dari skala — tidak mempercayai field level tersimpan.
    const level = levelDariSkor(hitungSkor(r.kemungkinan, r.dampak));
    perLevel[level] += 1;
    totalSkor += hitungSkor(r.kemungkinan, r.dampak);

    const kategori = normalisasiKategori(r.kategori);
    const agg = perKategoriMap.get(kategori) || { total: 0, levels: [] };
    agg.total += 1;
    agg.levels.push(level);
    perKategoriMap.set(kategori, agg);

    if (lewatBatas(r, sekarang)) lewatTenggat += 1;
  }

  const perKategori = URUTAN_KATEGORI.filter((k) => perKategoriMap.has(k)).map((kategori) => {
    const a = perKategoriMap.get(kategori)!;
    return { kategori, total: a.total, levelTertinggi: levelTertinggi(a.levels) };
  });

  return {
    total: daftar.length,
    perLevel,
    perKategori,
    risikoTinggi: perLevel.tinggi + perLevel.ekstrem,
    lewatTenggat,
    matriks: bangunMatriks(daftar),
    rataSkor: daftar.length === 0 ? 0 : Math.round((totalSkor / daftar.length) * 10) / 10,
  };
}

/**
 * Validasi input risiko yang dikirim klien.
 * Mengembalikan pesan galat (Bahasa Indonesia) atau `null` bila sah.
 */
export function validasiRisiko(input: any): string | null {
  if (!input || typeof input !== 'object') return 'Data risiko tidak valid.';
  const kode = String(input.kode || '').trim();
  if (!kode) return 'Kode risiko wajib diisi.';
  if (kode.length > 40) return 'Kode risiko terlalu panjang (maks 40 karakter).';
  const pernyataan = String(input.pernyataan || '').trim();
  if (!pernyataan) return 'Pernyataan risiko wajib diisi.';
  if (pernyataan.length > 500) return 'Pernyataan risiko terlalu panjang (maks 500 karakter).';
  const kategori = normalisasiKategori(input.kategori);
  if (
    input.kategori !== undefined &&
    input.kategori !== null &&
    String(input.kategori).trim() &&
    kategori === 'operasional' &&
    input.kategori !== 'operasional'
  ) {
    return `Kategori risiko "${input.kategori}" tidak dikenal.`;
  }
  for (const [nama, nilai] of [
    ['Kemungkinan', input.kemungkinan],
    ['Dampak', input.dampak],
  ] as const) {
    const n = Number(nilai);
    if (!Number.isFinite(n) || n < 1 || n > 5) return `${nama} harus angka 1 sampai 5.`;
  }
  return null;
}

/**
 * Validasi aksi mitigasi.
 * `ditutup` WAJIB punya alasan (tanpa itu risiko tak boleh dihilangkan dari
 * register secara diam-diam) — pola sama dengan `tidak_ditindaklanjuti` pada audit.
 */
export function validasiAksiMitigasi(input: any): string | null {
  if (!input || typeof input !== 'object') return 'Data mitigasi tidak valid.';
  const uraian = String(input.uraian || '').trim();
  if (!uraian) return 'Uraian mitigasi wajib diisi.';
  if (uraian.length > 2000) return 'Uraian terlalu panjang (maks 2000 karakter).';
  const status = normalisasiStatusRisiko(input.statusSesudah);
  if (status === 'ditutup' && !String(input.alasan || '').trim()) {
    return 'Alasan wajib diisi bila risiko ditutup.';
  }
  return null;
}

/** Buat satu entri aksi mitigasi (dipakai server saat menyimpan). */
export function buatAksiMitigasi(
  input: { uraian: string; tanggal?: string; bukti?: Array<{ nama: string; ukuran?: number; catatan?: string }> },
  oleh: { userId: string; name: string },
  statusSesudah: StatusRisiko,
  levelResidual?: LevelRisiko
): AksiMitigasi {
  const now = new Date();
  return {
    id: `mit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tanggal: input.tanggal ? new Date(input.tanggal).toISOString() : now.toISOString(),
    uraian: String(input.uraian).trim(),
    oleh: oleh.name,
    olehId: oleh.userId,
    bukti: Array.isArray(input.bukti)
      ? input.bukti
          .filter((b) => b && typeof b.nama === 'string' && b.nama.trim())
          .map((b) => ({
            nama: String(b.nama).trim(),
            ukuran: Number.isFinite(Number(b.ukuran)) ? Number(b.ukuran) : undefined,
            catatan: b.catatan ? String(b.catatan).trim() : undefined,
          }))
      : [],
    statusSesudah,
    levelResidual,
    pada: now.toISOString(),
  };
}
