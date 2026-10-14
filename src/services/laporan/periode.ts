/**
 * Logika pelaporan periodik BUMD — perhitungan periode, tenggat, dan kepatuhan.
 *
 * Prinsip: SEMUA angka dihitung dari data nyata (`KewajibanLapor` + `LaporanPeriodik`).
 * Periode yang belum punya kewajiban aktif tidak dihitung, dan laporan yang belum
 * ada entri-nya dilaporkan sebagai "belum" — bukan status karangan.
 */
import {
  JenisLaporan,
  KewajibanLapor,
  LaporanPeriodik,
  RingkasanKepatuhan,
  StatusLaporan,
} from '../../types';

/** Label manusiawi untuk tiap jenis laporan. */
export const LABEL_JENIS: Record<JenisLaporan, string> = {
  bulanan: 'Bulanan',
  triwulanan: 'Triwulanan',
  semesteran: 'Semesteran',
  tahunan: 'Tahunan',
};

/** Label status laporan (dipakai UI agar seragam). */
export const LABEL_STATUS: Record<StatusLaporan, string> = {
  belum: 'Belum Lapor',
  draf: 'Draf',
  terkirim: 'Terkirim',
  terverifikasi: 'Terverifikasi',
  revisi: 'Perlu Revisi',
};

/** Status yang dianggap SUDAH memenuhi kewajiban. */
export const STATUS_MEMENUHI: StatusLaporan[] = ['terkirim', 'terverifikasi'];

/**
 * Kode periode dari sebuah tanggal untuk jenis laporan tertentu.
 * - bulanan    → `2026-03`
 * - triwulanan → `2026-Q1`
 * - semesteran → `2026-S1`
 * - tahunan    → `2026`
 */
export function kodePeriode(jenis: JenisLaporan, tanggal: Date): string {
  const th = tanggal.getFullYear();
  const bl = tanggal.getMonth() + 1; // 1-12
  switch (jenis) {
    case 'bulanan':
      return `${th}-${String(bl).padStart(2, '0')}`;
    case 'triwulanan':
      return `${th}-Q${Math.ceil(bl / 3)}`;
    case 'semesteran':
      return `${th}-S${bl <= 6 ? 1 : 2}`;
    case 'tahunan':
      return `${th}`;
  }
}

/** Daftar kode periode terakhir (termasuk periode berjalan), terbaru dulu. */
export function periodeTerakhir(jenis: JenisLaporan, jumlah: number, acuan = new Date()): string[] {
  const hasil: string[] = [];
  const d = new Date(acuan.getTime());
  for (let i = 0; i < jumlah; i++) {
    hasil.push(kodePeriode(jenis, d));
    // Mundur satu periode.
    if (jenis === 'bulanan') d.setMonth(d.getMonth() - 1);
    else if (jenis === 'triwulanan') d.setMonth(d.getMonth() - 3);
    else if (jenis === 'semesteran') d.setMonth(d.getMonth() - 6);
    else d.setFullYear(d.getFullYear() - 1);
  }
  return hasil;
}

/**
 * Tanggal akhir sebuah periode.
 * - `2026-03`  → 31 Mar 2026
 * - `2026-Q1`  → 31 Mar 2026
 * - `2026-S1`  → 30 Jun 2026
 * - `2026`     → 31 Des 2026
 */
export function akhirPeriode(kode: string): Date | null {
  const bulanan = /^(\d{4})-(\d{2})$/.exec(kode);
  if (bulanan) {
    const th = Number(bulanan[1]);
    const bl = Number(bulanan[2]);
    if (bl < 1 || bl > 12) return null;
    return new Date(th, bl, 0); // hari 0 bulan berikutnya = hari terakhir bulan ini
  }
  const tri = /^(\d{4})-Q([1-4])$/i.exec(kode);
  if (tri) {
    const th = Number(tri[1]);
    const q = Number(tri[2]);
    return new Date(th, q * 3, 0);
  }
  const sem = /^(\d{4})-S([12])$/i.exec(kode);
  if (sem) {
    const th = Number(sem[1]);
    const s = Number(sem[2]);
    return new Date(th, s * 6, 0);
  }
  const tahunan = /^(\d{4})$/.exec(kode);
  if (tahunan) {
    return new Date(Number(tahunan[1]), 12, 0);
  }
  return null;
}

/**
 * Tenggat efektif = akhir periode + `tenggatHari` hari.
 * Mengembalikan `null` kalau kode periode tidak dikenali (jangan mengarang tanggal).
 */
export function hitungDeadline(kode: string, tenggatHari: number): string | null {
  const akhir = akhirPeriode(kode);
  if (!akhir) return null;
  const d = new Date(akhir.getTime());
  d.setDate(d.getDate() + Math.max(0, tenggatHari));
  return d.toISOString();
}

/** Label periode yang enak dibaca, mis. `2026-03` → `Maret 2026`. */
export function labelPeriode(jenis: JenisLaporan, kode: string): string {
  const NAMA_BULAN = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  if (jenis === 'bulanan') {
    const m = /^(\d{4})-(\d{2})$/.exec(kode);
    if (m) return `${NAMA_BULAN[Number(m[2]) - 1] || m[2]} ${m[1]}`;
  }
  if (jenis === 'triwulanan') {
    const m = /^(\d{4})-Q([1-4])$/i.exec(kode);
    if (m) return `Triwulan ${m[2]} ${m[1]}`;
  }
  if (jenis === 'semesteran') {
    const m = /^(\d{4})-S([12])$/i.exec(kode);
    if (m) return `Semester ${m[2]} ${m[1]}`;
  }
  if (jenis === 'tahunan') return `Tahun ${kode}`;
  return kode;
}

/**
 * Hitung ringkasan kepatuhan untuk satu periode.
 *
 * Untuk tiap kewajiban aktif:
 * - cari laporan yang cocok (kewajibanId + periode);
 * - tidak ada entri            → `belumLapor`;
 * - ada tapi status `belum`    → `belumLapor` (entri eksplisit belum disusun);
 * - ada & `draf`/`revisi`/`terkirim`/`terverifikasi` → dihitung sesuai status.
 *
 * `terlambat` = sudah lewat deadline tetapi belum `terkirim`/`terverifikasi`.
 */
export function hitungKepatuhan(
  kewajiban: KewajibanLapor[],
  laporan: LaporanPeriodik[],
  periode: string,
  sekarang = new Date()
): RingkasanKepatuhan {
  const aktif = kewajiban.filter((k) => k.isActive);
  let sudahTerverifikasi = 0;
  let sudahTerkirim = 0;
  let draf = 0;
  let perluRevisi = 0;
  let belumLapor = 0;
  let terlambat = 0;

  for (const k of aktif) {
    const lap = laporan.find((l) => l.kewajibanId === k.id && l.periode === periode);
    const status: StatusLaporan = lap ? lap.status : 'belum';

    switch (status) {
      case 'terverifikasi':
        sudahTerverifikasi++;
        break;
      case 'terkirim':
        sudahTerkirim++;
        break;
      case 'draf':
        draf++;
        break;
      case 'revisi':
        perluRevisi++;
        break;
      default:
        belumLapor++;
    }

    // Terlambat: lewat deadline & belum memenuhi.
    if (!STATUS_MEMENUHI.includes(status)) {
      const dl = lap?.deadline || hitungDeadline(periode, k.tenggatHari) || undefined;
      if (dl && new Date(dl).getTime() < sekarang.getTime()) terlambat++;
    }
  }

  const total = aktif.length;
  const memenuhi = sudahTerverifikasi + sudahTerkirim;
  const persenKepatuhan = total > 0 ? Math.round((memenuhi / total) * 100) : 0;

  return {
    periode,
    totalKewajiban: total,
    sudahTerverifikasi,
    sudahTerkirim,
    draf,
    perluRevisi,
    belumLapor,
    persenKepatuhan,
    terlambat,
  };
}

/**
 * Daftar periode terakhir yang punya kewajiban aktif — untuk pemilih periode di UI.
 * Kalau tidak ada kewajiban sama sekali, kembalikan periode berjalan saja.
 */
export function periodeTersedia(
  kewajiban: KewajibanLapor[],
  jumlahPerJenis = 6,
  acuan = new Date()
): string[] {
  const aktif = kewajiban.filter((k) => k.isActive);
  const set = new Set<string>();
  if (aktif.length === 0) {
    set.add(kodePeriode('bulanan', acuan));
  }
  for (const k of aktif) {
    for (const p of periodeTerakhir(k.jenis, jumlahPerJenis, acuan)) set.add(p);
  }
  // Urutkan menurun (terbaru dulu) — string kode periode sudah urut secara leksikografis
  // untuk format yang sama, jadi bandingkan berdasarkan akhir periodenya.
  return [...set].sort((a, b) => {
    const da = akhirPeriode(a)?.getTime() ?? 0;
    const db = akhirPeriode(b)?.getTime() ?? 0;
    return db - da;
  });
}
