/**
 * ANTREAN ANALISIS DOKUMEN — aturan biaya, kunci antar-instance, dan kuota.
 *
 * Semua fungsi di sini murni (waktu disuntikkan), supaya bisa diuji tanpa
 * menunggu 20 detik atau menyalakan dua instance PM2. Yang diatur:
 *
 * - Maksimum 2 analisis berjalan bersamaan per instance. Lebih dari itu membuat
 *   layanan RAG membalas 429 dan semua permintaan ikut gagal.
 * - Satu klaim per berkas lewat `leaseSampai`, karena dua instance PM2 berbagi
 *   satu MySQL: tanpa kunci, dokumen yang sama dianalisis dua kali dan kuota
 *   terbuang.
 * - Kuota harian per instansi (bawaan 20 dokumen). Habis kuota BUKAN gagal:
 *   statusnya `tertunda-kuota`, supaya admin tahu harus menunggu besok, bukan
 *   mengira dokumennya rusak.
 * - Gagal sementara (429/timeout) diulang 2 kali dengan jeda 20 dan 60 detik.
 */

export const KUOTA_ANALISIS_BAWAAN = 20;

/** Analisis yang boleh berjalan bersamaan per instance. */
export const BATAS_PARALEL = 2;

/** Lama klaim sebelum dianggap kedaluwarsa (instance lain boleh mengambil). */
export const LEASE_MS = 5 * 60 * 1000;

/** Jeda percobaan ulang setelah gagal sementara. */
export const JEDA_ULANG_MS = [20_000, 60_000];

/** Berkas yang sama tidak dianalisis ulang selama ini. */
export const CACHE_MS = 7 * 24 * 60 * 60 * 1000;

/** Sisa kuota hari ini. Tidak pernah negatif. */
export function sisaKuota(terpakaiHariIni: number, kuota: number = KUOTA_ANALISIS_BAWAAN): number {
  const batas = Number.isFinite(kuota) && kuota >= 0 ? Math.floor(kuota) : KUOTA_ANALISIS_BAWAAN;
  const pakai = Number.isFinite(terpakaiHariIni) && terpakaiHariIni > 0 ? Math.floor(terpakaiHariIni) : 0;
  return Math.max(0, batas - pakai);
}

/** true bila kuota masih tersisa. */
export function masihAdaKuota(terpakaiHariIni: number, kuota?: number): boolean {
  return sisaKuota(terpakaiHariIni, kuota) > 0;
}

export interface BarisAntrean {
  id: string;
  tenantId: string;
  berkasId: string;
  status: 'antri' | 'proses' | 'selesai' | 'gagal' | 'tertunda-kuota';
  percobaan: number;
  /** Epoch ms — batas klaim oleh satu instance. */
  leaseSampai?: number;
  dibuatPada: string;
}

export type PutusanKlaim =
  | { boleh: true }
  | { boleh: false; sebab: 'selesai' | 'sedang-diklaim' | 'batas-paralel' };

/**
 * Boleh tidaknya satu baris diklaim sekarang.
 *
 * `sedangBerjalan` adalah jumlah analisis berstatus `proses` yang klaimnya masih
 * hidup. Baris yang klaimnya kedaluwarsa boleh diambil alih — kalau tidak, satu
 * instance yang mati di tengah jalan akan memblokir dokumen selamanya.
 */
export function bolehKlaim(
  baris: BarisAntrean,
  sedangBerjalan: number,
  sekarang: number = Date.now()
): PutusanKlaim {
  if (baris.status === 'selesai') return { boleh: false, sebab: 'selesai' };
  const klaimHidup = typeof baris.leaseSampai === 'number' && baris.leaseSampai > sekarang;
  if (klaimHidup) return { boleh: false, sebab: 'sedang-diklaim' };
  if (sedangBerjalan >= BATAS_PARALEL) return { boleh: false, sebab: 'batas-paralel' };
  return { boleh: true };
}

/** Waktu klaim baru untuk satu baris. */
export function leaseBaru(sekarang: number = Date.now()): number {
  return sekarang + LEASE_MS;
}

/**
 * Apa yang harus dilakukan setelah satu percobaan gagal.
 *
 * Hanya kegagalan SEMENTARA yang diulang. Galat seperti "dokumen tidak bisa
 * dibaca" tidak akan berubah walau diulang, jadi langsung `gagal`.
 */
export function putusanSetelahGagal(
  percobaan: number,
  sementara: boolean
): { ulang: false; status: 'gagal' } | { ulang: true; status: 'antri'; jedaMs: number } {
  if (!sementara) return { ulang: false, status: 'gagal' };
  const indeks = Math.max(0, percobaan - 1);
  if (indeks >= JEDA_ULANG_MS.length) return { ulang: false, status: 'gagal' };
  return { ulang: true, status: 'antri', jedaMs: JEDA_ULANG_MS[indeks] };
}

/** Status yang dipakai saat kuota habis — bukan `gagal`. */
export function statusSaatKuotaHabis(): 'tertunda-kuota' {
  return 'tertunda-kuota';
}

/**
 * Analisis lama yang masih bisa dipakai ulang untuk berkas yang sama.
 * Mengembalikan baris yang paling baru selesai, atau undefined.
 */
export function analisisBisaDipakaiUlang<T extends { berkasId: string; status: string; selesaiPada?: string }>(
  daftar: T[],
  berkasId: string,
  sekarang: number = Date.now()
): T | undefined {
  const kandidat = daftar
    .filter((a) => a.berkasId === berkasId && a.status === 'selesai' && a.selesaiPada)
    .filter((a) => {
      const t = new Date(a.selesaiPada as string).getTime();
      return Number.isFinite(t) && sekarang - t < CACHE_MS;
    })
    .sort((a, b) => String(b.selesaiPada).localeCompare(String(a.selesaiPada)));
  return kandidat[0];
}

/**
 * Pesan jujur saat kuota habis. Menyebut sisa dan kapan bisa dicoba lagi,
 * supaya admin tidak mengira dokumennya rusak.
 */
export function pesanKuotaHabis(kuota: number = KUOTA_ANALISIS_BAWAAN): string {
  return `Kuota analisis dokumen hari ini habis (${kuota} dokumen). Dokumen tetap tersimpan dan akan dianalisis otomatis setelah kuota direset besok.`;
}

/** Ringkasan antrean untuk ditampilkan di kotak masuk admin. */
export function ringkasAntrean(daftar: BarisAntrean[]): {
  antri: number;
  proses: number;
  tertundaKuota: number;
  gagal: number;
  selesai: number;
} {
  const hitung = { antri: 0, proses: 0, tertundaKuota: 0, gagal: 0, selesai: 0 };
  for (const b of daftar) {
    if (b.status === 'antri') hitung.antri += 1;
    else if (b.status === 'proses') hitung.proses += 1;
    else if (b.status === 'tertunda-kuota') hitung.tertundaKuota += 1;
    else if (b.status === 'gagal') hitung.gagal += 1;
    else if (b.status === 'selesai') hitung.selesai += 1;
  }
  return hitung;
}
