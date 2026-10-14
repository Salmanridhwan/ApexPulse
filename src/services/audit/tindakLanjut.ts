/**
 * Tindak lanjut rekomendasi audit (BPK / Inspektorat / BPKP).
 *
 * Fungsi di sini MURNI (tanpa I/O) supaya ringkasan, status, dan aturan
 * kelayakannya bisa diuji tanpa server — persis pola `services/laporan/alur.ts`.
 *
 * Prinsip:
 * - **Ringkasan DIHITUNG, bukan disimpan.** Yang tersimpan hanya temuan +
 *   riwayat aksi (append-only); persentase tindak lanjut selalu diturunkan dari
 *   data nyata, jadi tak bisa melenceng dari riwayatnya.
 * - **Status `selesai` butuh bukti.** Temuan tidak boleh ditandai tuntas tanpa
 *   minimal satu aksi tindak lanjut; `tidak_ditindaklanjuti` butuh alasan.
 * - **Persentase mengikuti konvensi IKU**: rekomendasi yang sudah
 *   ditindaklanjuti = `selesai` + `tidak_ditindaklanjuti` (yang terakhir tetap
 *   dihitung "sudah ditangani" karena sudah ada keputusan resmi + alasan).
 */
import type {
  AksiTindakLanjut,
  RingkasanAudit,
  SumberAudit,
  StatusTindakLanjut,
  TemuanAudit,
} from '../../types';

/** Label manusiawi tiap status tindak lanjut. */
export const LABEL_STATUS_AUDIT: Record<StatusTindakLanjut, string> = {
  belum: 'Belum Ditindaklanjuti',
  proses: 'Sedang Ditindaklanjuti',
  selesai: 'Selesai',
  tidak_ditindaklanjuti: 'Tidak Dapat Ditindaklanjuti',
};

/** Label manusiawi tiap sumber pemeriksa. */
export const LABEL_SUMBER_AUDIT: Record<SumberAudit, string> = {
  bpk: 'BPK',
  inspektorat: 'Inspektorat',
  bpkp: 'BPKP',
  kpk: 'KPK',
  lainnya: 'Lainnya',
};

/** Urutan tetap sumber supaya tampilan rekap tidak berubah-ubah. */
export const URUTAN_SUMBER: SumberAudit[] = ['bpk', 'inspektorat', 'bpkp', 'kpk', 'lainnya'];

/** Status yang dianggap "sudah ditangani" untuk perhitungan persentase IKU. */
export function sudahDitangani(status: StatusTindakLanjut): boolean {
  return status === 'selesai' || status === 'tidak_ditindaklanjuti';
}

/**
 * Normalisasi status dari input bebas (bertipe `string`) ke `StatusTindakLanjut`.
 * Nilai tak dikenal jatuh ke `'belum'` — status paling awal, supaya kesalahan
 * data tidak pernah mengklaim temuan sudah selesai.
 */
export function normalisasiStatus(nilai: unknown): StatusTindakLanjut {
  return nilai === 'proses' ||
    nilai === 'selesai' ||
    nilai === 'tidak_ditindaklanjuti' ||
    nilai === 'belum'
    ? nilai
    : 'belum';
}

/** Normalisasi sumber pemeriksa; tak dikenal → `'lainnya'`. */
export function normalisasiSumber(nilai: unknown): SumberAudit {
  return nilai === 'bpk' || nilai === 'inspektorat' || nilai === 'bpkp' || nilai === 'kpk'
    ? nilai
    : 'lainnya';
}

/** Batas waktu sudah lewat? (temuan yang belum ditangani dihitung terlambat). */
export function lewatBatas(temuan: Pick<TemuanAudit, 'batasWaktu' | 'status'>, sekarang = new Date()): boolean {
  if (!temuan.batasWaktu) return false;
  if (sudahDitangani(temuan.status)) return false;
  const t = new Date(temuan.batasWaktu).getTime();
  if (!Number.isFinite(t)) return false;
  return t < sekarang.getTime();
}

/**
 * Hitung ringkasan tindak lanjut dari daftar temuan nyata.
 * `persenTindakLanjut` = (selesai + tidak_ditindaklanjuti) / total × 100.
 * Bila tidak ada temuan sama sekali, persentase = 100 (tidak ada yang tertunggak)
 * dan `totalNilai` = 0.
 */
export function hitungRingkasan(
  temuan: TemuanAudit[],
  sekarang = new Date()
): RingkasanAudit {
  const daftar = Array.isArray(temuan) ? temuan : [];
  const total = daftar.length;
  let belum = 0;
  let proses = 0;
  let selesai = 0;
  let tidakDitindaklanjuti = 0;
  let lewatTenggat = 0;
  let totalNilai = 0;

  const perSumberMap = new Map<SumberAudit, { total: number; selesai: number }>();

  for (const t of daftar) {
    const status = normalisasiStatus(t.status);
    if (status === 'belum') belum++;
    else if (status === 'proses') proses++;
    else if (status === 'selesai') selesai++;
    else if (status === 'tidak_ditindaklanjuti') tidakDitindaklanjuti++;

    if (lewatBatas(t, sekarang)) lewatTenggat++;
    if (Number.isFinite(t.nilaiTemuan)) totalNilai += Number(t.nilaiTemuan);

    const sumber = normalisasiSumber(t.sumber);
    const agg = perSumberMap.get(sumber) || { total: 0, selesai: 0 };
    agg.total++;
    if (sudahDitangani(status)) agg.selesai++;
    perSumberMap.set(sumber, agg);
  }

  const ditangani = selesai + tidakDitindaklanjuti;
  const persenTindakLanjut = total === 0 ? 100 : Math.round((ditangani / total) * 1000) / 10;

  const perSumber = URUTAN_SUMBER.filter((s) => perSumberMap.has(s)).map((sumber) => {
    const a = perSumberMap.get(sumber)!;
    return {
      sumber,
      total: a.total,
      selesai: a.selesai,
      persenTindakLanjut: a.total === 0 ? 100 : Math.round((a.selesai / a.total) * 1000) / 10,
    };
  });

  return {
    total,
    belum,
    proses,
    selesai,
    tidakDitindaklanjuti,
    lewatTenggat,
    persenTindakLanjut,
    totalNilai,
    perSumber,
  };
}

/**
 * Validasi input temuan yang dikirim klien.
 * Mengembalikan pesan galat (Bahasa Indonesia) atau `null` bila sah.
 * Hanya memeriksa field WAJIB; field opsional dinormalisasi pemanggil.
 */
export function validasiTemuan(input: any): string | null {
  if (!input || typeof input !== 'object') return 'Data temuan tidak valid.';
  const judul = String(input.judul || '').trim();
  if (!judul) return 'Judul temuan wajib diisi.';
  if (judul.length > 200) return 'Judul temuan terlalu panjang (maks 200 karakter).';
  const rekomendasi = String(input.rekomendasi || '').trim();
  if (!rekomendasi) return 'Rekomendasi wajib diisi.';
  if (rekomendasi.length > 2000) return 'Rekomendasi terlalu panjang (maks 2000 karakter).';
  const nomorLHP = String(input.nomorLHP || '').trim();
  if (!nomorLHP) return 'Nomor LHP wajib diisi.';
  const sumber = normalisasiSumber(input.sumber);
  if (input.sumber !== undefined && input.sumber !== null && String(input.sumber).trim() && sumber === 'lainnya' && input.sumber !== 'lainnya') {
    return `Sumber pemeriksa "${input.sumber}" tidak dikenal.`;
  }
  if (input.nilaiTemuan !== undefined && input.nilaiTemuan !== null && input.nilaiTemuan !== '') {
    const n = Number(input.nilaiTemuan);
    if (!Number.isFinite(n) || n < 0) return 'Nilai temuan harus angka ≥ 0.';
  }
  return null;
}

/**
 * Validasi aksi tindak lanjut.
 * `selesai` WAJIB punya uraian (bukti tertulis apa yang dikerjakan);
 * `tidak_ditindaklanjuti` WAJIB punya alasan.
 */
export function validasiAksi(input: any): string | null {
  if (!input || typeof input !== 'object') return 'Data tindak lanjut tidak valid.';
  const uraian = String(input.uraian || '').trim();
  if (!uraian) return 'Uraian tindak lanjut wajib diisi.';
  if (uraian.length > 2000) return 'Uraian terlalu panjang (maks 2000 karakter).';
  const status = normalisasiStatus(input.statusSesudah);
  if (status === 'tidak_ditindaklanjuti' && !String(input.alasan || '').trim()) {
    return 'Alasan wajib diisi bila temuan dinyatakan tidak dapat ditindaklanjuti.';
  }
  return null;
}

/** Buat satu entri aksi tindak lanjut (dipakai server saat menyimpan). */
export function buatAksiTindakLanjut(
  input: { uraian: string; tanggal?: string; bukti?: Array<{ nama: string; ukuran?: number; catatan?: string }> },
  oleh: { userId: string; name: string },
  statusSesudah: StatusTindakLanjut
): AksiTindakLanjut {
  const now = new Date();
  return {
    id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
    pada: now.toISOString(),
  };
}
