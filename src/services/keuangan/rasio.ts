/**
 * Perhitungan rasio kesehatan keuangan BUMD.
 *
 * Fungsi di sini MURNI (tanpa I/O) supaya setiap rasio bisa diuji tanpa server.
 * Semua rasio dihitung dari `KomponenKeuangan` yang ditarik dari dokumen resmi —
 * TIDAK PERNAH dari angka yang dikirim klien secara langsung.
 *
 * Prinsip:
 * - **Angka hilang ≠ nol.** Bila komponen pembilang/penyebut tidak ada di
 *   dokumen, rasio bernilai `null` (ditampilkan "—"), bukan 0 yang menyesatkan.
 * - **Rumus & ambang ditampilkan.** Tiap rasio membawa `rumus` dan `ambang`
 *   supaya pembaca bisa mengaudit asalnya.
 * - **Ambang mengikuti Permen EKON 2/2023** (penilaian tingkat kesehatan BUMD).
 *   Ambang di sini konservatif dan dinyatakan terbuka, bukan angka rahasia.
 */
import type {
  BumdSector,
  Citation,
  KunciKomponen,
  KomponenKeuangan,
  RasioKeuangan,
  RingkasanKeuangan,
  SnapshotKeuangan,
} from '../../types';

/** Label manusiawi tiap kategori kesehatan. */
export const LABEL_KATEGORI: Record<NonNullable<RasioKeuangan['kategori']>, string> = {
  sangat_sehat: 'Sangat Sehat',
  sehat: 'Sehat',
  cukup_sehat: 'Cukup Sehat',
  kurang_sehat: 'Kurang Sehat',
  tidak_sehat: 'Tidak Sehat',
};

/** Warna token CSS per kategori (dipakai UI). */
export const WARNA_KATEGORI: Record<NonNullable<RasioKeuangan['kategori']>, string> = {
  sangat_sehat: 'var(--color-pos)',
  sehat: 'var(--color-pos)',
  cukup_sehat: 'var(--color-warn)',
  kurang_sehat: 'var(--color-coral)',
  tidak_sehat: 'var(--color-neg)',
};

/** Label & satuan tiap komponen (untuk tabel di UI). */
export const LABEL_KOMPONEN: Record<KunciKomponen, string> = {
  totalAset: 'Total Aset',
  asetLancar: 'Aset Lancar',
  liabilitas: 'Total Liabilitas',
  liabilitasLancar: 'Liabilitas Lancar',
  ekuitas: 'Total Ekuitas',
  pendapatan: 'Pendapatan',
  labaBersih: 'Laba Bersih',
  kreditBermasalah: 'Kredit Bermasalah (NPL)',
  totalKredit: 'Total Kredit',
  nrw: 'Kehilangan Air (NRW)',
  bebanOperasional: 'Beban Operasional',
  pendapatanOperasional: 'Pendapatan Operasional',
  kas: 'Kas & Setara Kas',
};

/** Urutan tampil komponen di tabel. */
export const URUTAN_KOMPONEN: KunciKomponen[] = [
  'totalAset',
  'asetLancar',
  'kas',
  'liabilitas',
  'liabilitasLancar',
  'ekuitas',
  'pendapatan',
  'labaBersih',
  'kreditBermasalah',
  'totalKredit',
  'bebanOperasional',
  'pendapatanOperasional',
  'nrw',
];

/** Kategori berdasar ambang batas (naik = makin baik). */
function kategoriNaik(
  nilai: number,
  ambang: Array<[number, NonNullable<RasioKeuangan['kategori']>]>
): NonNullable<RasioKeuangan['kategori']> {
  for (const [batas, kat] of ambang) {
    if (nilai >= batas) return kat;
  }
  return 'tidak_sehat';
}

/** Kategori berdasar ambang batas (turun = makin baik, mis. DER/NPL/BOPO/NRW). */
function kategoriTurun(
  nilai: number,
  ambang: Array<[number, NonNullable<RasioKeuangan['kategori']>]>
): NonNullable<RasioKeuangan['kategori']> {
  for (const [batas, kat] of ambang) {
    if (nilai <= batas) return kat;
  }
  return 'tidak_sehat';
}

/** Pembagian aman: null bila penyebut hilang/0 atau pembilang hilang. */
function bagi(a: number | undefined, b: number | undefined): number | null {
  if (!Number.isFinite(a as number) || !Number.isFinite(b as number)) return null;
  const penyebut = Number(b);
  if (penyebut === 0) return null;
  return Number(a) / penyebut;
}

/** Bulatkan ke 2 desimal. */
function bulat(n: number | null): number | null {
  return n === null ? null : Math.round(n * 100) / 100;
}

/**
 * Hitung SELURUH rasio dari komponen.
 * `sektor` menentukan rasio sektor-khusus yang ikut ditampilkan (NPL/BOPO bank,
 * NRW air). Rasio inti (ROA/ROE/DER/likuiditas) selalu dihitung.
 */
export function hitungRasio(komponen: KomponenKeuangan, sektor?: BumdSector): RasioKeuangan[] {
  const k = komponen || {};
  const hasil: RasioKeuangan[] = [];

  // ROA = laba bersih / total aset × 100
  const roa = bagi(k.labaBersih, k.totalAset);
  hasil.push({
    kunci: 'roa',
    label: 'ROA',
    nilai: roa === null ? null : bulat(roa * 100),
    satuan: '%',
    rumus: 'Laba Bersih ÷ Total Aset × 100',
    ambang: '≥3% sehat · 1–3% cukup · <1% kurang',
    kategori: roa === null ? undefined : kategoriNaik(roa * 100, [[5, 'sangat_sehat'], [3, 'sehat'], [1, 'cukup_sehat'], [0, 'kurang_sehat']]),
  });

  // ROE = laba bersih / ekuitas × 100
  const roe = bagi(k.labaBersih, k.ekuitas);
  hasil.push({
    kunci: 'roe',
    label: 'ROE',
    nilai: roe === null ? null : bulat(roe * 100),
    satuan: '%',
    rumus: 'Laba Bersih ÷ Total Ekuitas × 100',
    ambang: '≥10% sehat · 5–10% cukup · <5% kurang',
    kategori: roe === null ? undefined : kategoriNaik(roe * 100, [[15, 'sangat_sehat'], [10, 'sehat'], [5, 'cukup_sehat'], [0, 'kurang_sehat']]),
  });

  // DER = liabilitas / ekuitas (kali)
  const der = bagi(k.liabilitas, k.ekuitas);
  hasil.push({
    kunci: 'der',
    label: 'DER',
    nilai: der === null ? null : bulat(der),
    satuan: '×',
    rumus: 'Total Liabilitas ÷ Total Ekuitas',
    ambang: '≤1× sehat · 1–2× cukup · >2× kurang',
    kategori: der === null ? undefined : kategoriTurun(der, [[1, 'sangat_sehat'], [2, 'sehat'], [3, 'cukup_sehat'], [4, 'kurang_sehat']]),
  });

  // Current ratio = aset lancar / liabilitas lancar × 100
  const cr = bagi(k.asetLancar, k.liabilitasLancar);
  hasil.push({
    kunci: 'currentRatio',
    label: 'Rasio Lancar',
    nilai: cr === null ? null : bulat(cr * 100),
    satuan: '%',
    rumus: 'Aset Lancar ÷ Liabilitas Lancar × 100',
    ambang: '≥150% sehat · 100–150% cukup · <100% kurang',
    kategori: cr === null ? undefined : kategoriNaik(cr * 100, [[200, 'sangat_sehat'], [150, 'sehat'], [100, 'cukup_sehat'], [0, 'kurang_sehat']]),
  });

  // Cash ratio = kas / liabilitas lancar × 100
  const cash = bagi(k.kas, k.liabilitasLancar);
  hasil.push({
    kunci: 'cashRatio',
    label: 'Rasio Kas',
    nilai: cash === null ? null : bulat(cash * 100),
    satuan: '%',
    rumus: 'Kas & Setara Kas ÷ Liabilitas Lancar × 100',
    ambang: '≥50% sehat · 25–50% cukup · <25% kurang',
    kategori: cash === null ? undefined : kategoriNaik(cash * 100, [[100, 'sangat_sehat'], [50, 'sehat'], [25, 'cukup_sehat'], [0, 'kurang_sehat']]),
  });

  // Margin laba = laba bersih / pendapatan × 100
  const margin = bagi(k.labaBersih, k.pendapatan);
  hasil.push({
    kunci: 'marginLaba',
    label: 'Margin Laba',
    nilai: margin === null ? null : bulat(margin * 100),
    satuan: '%',
    rumus: 'Laba Bersih ÷ Pendapatan × 100',
    ambang: '≥10% sehat · 5–10% cukup · <5% kurang',
    kategori: margin === null ? undefined : kategoriNaik(margin * 100, [[15, 'sangat_sehat'], [10, 'sehat'], [5, 'cukup_sehat'], [0, 'kurang_sehat']]),
  });

  // NPL = kredit bermasalah / total kredit × 100 (bank)
  const npl = bagi(k.kreditBermasalah, k.totalKredit);
  if (sektor === undefined || sektor === 'bank' || npl !== null) {
    hasil.push({
      kunci: 'npl',
      label: 'NPL',
      nilai: npl === null ? null : bulat(npl * 100),
      satuan: '%',
      rumus: 'Kredit Bermasalah ÷ Total Kredit × 100',
      ambang: '≤2% sehat · 2–5% cukup · >5% kurang',
      sektorKhusus: ['bank'],
      kategori: npl === null ? undefined : kategoriTurun(npl * 100, [[2, 'sangat_sehat'], [5, 'sehat'], [8, 'cukup_sehat'], [10, 'kurang_sehat']]),
    });
  }

  // BOPO = beban operasional / pendapatan operasional × 100 (bank)
  const bopo = bagi(k.bebanOperasional, k.pendapatanOperasional);
  if (sektor === undefined || sektor === 'bank' || bopo !== null) {
    hasil.push({
      kunci: 'bopo',
      label: 'BOPO',
      nilai: bopo === null ? null : bulat(bopo * 100),
      satuan: '%',
      rumus: 'Beban Operasional ÷ Pendapatan Operasional × 100',
      ambang: '≤80% sehat · 80–90% cukup · >90% kurang',
      sektorKhusus: ['bank'],
      kategori: bopo === null ? undefined : kategoriTurun(bopo * 100, [[80, 'sangat_sehat'], [90, 'sehat'], [95, 'cukup_sehat'], [100, 'kurang_sehat']]),
    });
  }

  // NRW = kehilangan air (%) — langsung dari dokumen (bukan dihitung dari komponen lain)
  if (sektor === undefined || sektor === 'pdam' || Number.isFinite(k.nrw)) {
    const nrw = Number.isFinite(k.nrw) ? Number(k.nrw) : null;
    hasil.push({
      kunci: 'nrw',
      label: 'NRW',
      nilai: nrw === null ? null : bulat(nrw),
      satuan: '%',
      rumus: 'Kehilangan air (langsung dari dokumen)',
      ambang: '≤20% sehat · 20–30% cukup · >30% kurang',
      sektorKhusus: ['pdam'],
      kategori: nrw === null ? undefined : kategoriTurun(nrw, [[20, 'sangat_sehat'], [25, 'sehat'], [30, 'cukup_sehat'], [35, 'kurang_sehat']]),
    });
  }

  return hasil;
}

/**
 * Skor kesehatan gabungan 0-100 dari rasio yang punya kategori.
 * Tiap kategori dipetakan ke poin (sangat sehat 100, sehat 80, cukup 60,
 * kurang 40, tidak sehat 20), lalu dirata-rata. `undefined` bila tak ada satu
 * pun rasio berkategori (data belum cukup) — JANGAN mengarang skor.
 */
export function hitungSkorKesehatan(rasio: RasioKeuangan[]): number | undefined {
  const poin: Record<NonNullable<RasioKeuangan['kategori']>, number> = {
    sangat_sehat: 100,
    sehat: 80,
    cukup_sehat: 60,
    kurang_sehat: 40,
    tidak_sehat: 20,
  };
  const berkategori = (rasio || []).filter((r) => r.kategori && r.nilai !== null);
  if (berkategori.length === 0) return undefined;
  const total = berkategori.reduce((s, r) => s + poin[r.kategori!], 0);
  return Math.round(total / berkategori.length);
}

/** Kategori keseluruhan dari skor (untuk badge besar). */
export function kategoriDariSkor(
  skor?: number
): NonNullable<RasioKeuangan['kategori']> | undefined {
  if (skor === undefined) return undefined;
  if (skor >= 90) return 'sangat_sehat';
  if (skor >= 70) return 'sehat';
  if (skor >= 50) return 'cukup_sehat';
  if (skor >= 30) return 'kurang_sehat';
  return 'tidak_sehat';
}

/**
 * Bangun rasio + skor untuk sebuah snapshot (dipakai server sebelum menyimpan).
 * Rasio SELALU dihitung ulang di sini — nilai rasio dari klien diabaikan.
 */
export function lengkapiSnapshot(
  snapshot: Omit<SnapshotKeuangan, 'rasio' | 'skorKesehatan' | 'id' | 'createdAt' | 'updatedAt'> & {
    rasio?: RasioKeuangan[];
    id?: string;
    createdAt?: string;
    updatedAt?: string;
  },
  sektor?: BumdSector
): SnapshotKeuangan {
  const rasio = hitungRasio(snapshot.komponen || {}, sektor);
  const now = new Date().toISOString();
  return {
    ...snapshot,
    id: snapshot.id || `keu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: snapshot.createdAt || now,
    updatedAt: snapshot.updatedAt || now,
    rasio,
    skorKesehatan: hitungSkorKesehatan(rasio),
  };
}

/** Urutkan periode kode (mis. 2026-Q1, 2025) dari terbaru ke terlama. */
export function urutPeriodeTerbaru(periode: string[]): string[] {
  return [...new Set(periode)].sort((a, b) => {
    const tA = Date.parse(periodeKeTanggal(a)) || 0;
    const tB = Date.parse(periodeKeTanggal(b)) || 0;
    if (tA !== tB) return tB - tA;
    return b.localeCompare(a);
  });
}

/** Ubah kode periode jadi tanggal untuk pengurutan (`2026-Q1` → `2026-03-31`). */
export function periodeKeTanggal(periode: string): string {
  const q = /^(\d{4})-Q([1-4])$/i.exec(periode);
  if (q) {
    const bulan = Number(q[2]) * 3;
    return `${q[1]}-${String(bulan).padStart(2, '0')}-28`;
  }
  const s = /^(\d{4})-S([12])$/i.exec(periode);
  if (s) {
    const bulan = Number(s[2]) === 1 ? 6 : 12;
    return `${s[1]}-${String(bulan).padStart(2, '0')}-28`;
  }
  const m = /^(\d{4})-(\d{2})$/.exec(periode);
  if (m) return `${m[1]}-${m[2]}-28`;
  if (/^\d{4}$/.test(periode)) return `${periode}-12-31`;
  return periode;
}

/** Label manusiawi periode (`2026-Q1` → "Triwulan I 2026"). */
export function labelPeriodeKeuangan(periode: string): string {
  const q = /^(\d{4})-Q([1-4])$/i.exec(periode);
  if (q) return `Triwulan ${['I', 'II', 'III', 'IV'][Number(q[2]) - 1]} ${q[1]}`;
  const s = /^(\d{4})-S([12])$/i.exec(periode);
  if (s) return `Semester ${s[2]} ${s[1]}`;
  const m = /^(\d{4})-(\d{2})$/.exec(periode);
  if (m) {
    const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${namaBulan[Number(m[2]) - 1] || m[2]} ${m[1]}`;
  }
  if (/^\d{4}$/.test(periode)) return `Tahun ${periode}`;
  return periode;
}

/**
 * Susun ringkasan: snapshot terbaru + sebelumnya + delta rasio.
 * Snapshot kosong → `terbaru: null` (UI menampilkan ajakan mengisi, bukan 0).
 */
export function ringkasKeuangan(snapshots: SnapshotKeuangan[]): RingkasanKeuangan {
  const daftar = Array.isArray(snapshots) ? snapshots : [];
  if (daftar.length === 0) {
    return { terbaru: null, sebelumnya: null, delta: {}, periodeTersedia: [] };
  }
  const periodeTersedia = urutPeriodeTerbaru(daftar.map((s) => s.periode));
  const terbaru = daftar.find((s) => s.periode === periodeTersedia[0]) || null;
  const sebelumnya = periodeTersedia.length > 1 ? daftar.find((s) => s.periode === periodeTersedia[1]) || null : null;

  const delta: Record<string, number | null> = {};
  for (const r of terbaru?.rasio || []) {
    const lama = sebelumnya?.rasio?.find((x) => x.kunci === r.kunci);
    delta[r.kunci] =
      r.nilai !== null && lama && lama.nilai !== null ? Math.round((r.nilai - lama.nilai) * 100) / 100 : null;
  }
  return { terbaru, sebelumnya, delta, periodeTersedia };
}

/**
 * Validasi input snapshot dari klien.
 * Hanya memeriksa periode & bentuk komponen; angka non-finite ditolak agar
 * rasio tidak dihitung dari nilai sampah.
 */
export function validasiSnapshot(input: any): string | null {
  if (!input || typeof input !== 'object') return 'Data snapshot tidak valid.';
  const periode = String(input.periode || '').trim();
  if (!periode) return 'Periode wajib diisi.';
  if (!/^\d{4}(-(Q[1-4]|S[12]|\d{2}))?$/i.test(periode)) {
    return 'Format periode tidak dikenal (contoh: 2026, 2026-Q1, 2026-06).';
  }
  const komponen = input.komponen;
  if (!komponen || typeof komponen !== 'object') return 'Komponen keuangan wajib diisi.';
  for (const [kunci, nilai] of Object.entries(komponen)) {
    if (nilai === null || nilai === undefined || nilai === '') continue;
    const n = Number(nilai);
    if (!Number.isFinite(n)) return `Nilai komponen "${kunci}" bukan angka yang sah.`;
    if (n < 0) return `Nilai komponen "${kunci}" tidak boleh negatif.`;
  }
  const adaIsi = Object.values(komponen).some((v) => v !== null && v !== undefined && v !== '');
  if (!adaIsi) return 'Isi minimal satu komponen keuangan.';
  return null;
}

/** Normalisasi komponen: kosong → undefined, string angka → number. */
export function normalisasiKomponen(input: any): KomponenKeuangan {
  const keluar: KomponenKeuangan = {};
  if (!input || typeof input !== 'object') return keluar;
  for (const kunci of URUTAN_KOMPONEN) {
    const nilai = (input as any)[kunci];
    if (nilai === null || nilai === undefined || nilai === '') continue;
    const n = Number(nilai);
    if (Number.isFinite(n)) keluar[kunci] = n;
  }
  return keluar;
}

/** Normalisasi sitasi per field (buang yang tidak punya nama dokumen). */
export function normalisasiSitasi(input: any): Partial<Record<KunciKomponen, Citation>> {
  const keluar: Partial<Record<KunciKomponen, Citation>> = {};
  if (!input || typeof input !== 'object') return keluar;
  for (const kunci of URUTAN_KOMPONEN) {
    const c = (input as any)[kunci];
    if (!c || typeof c !== 'object') continue;
    const docName = String(c.docName || '').trim();
    if (!docName) continue;
    keluar[kunci] = {
      id: String(c.id || `cit-keu-${kunci}`),
      docName,
      page: Number.isFinite(Number(c.page)) ? Number(c.page) : 0,
      chunkSnippet: String(c.chunkSnippet || '').slice(0, 600),
      confidenceScore: Number.isFinite(Number(c.confidenceScore)) ? Number(c.confidenceScore) : 0.9,
      date: c.date ? String(c.date) : new Date().toISOString(),
      metric: LABEL_KOMPONEN[kunci],
    };
  }
  return keluar;
}
