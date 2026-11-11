/**
 * CACHE HASIL RAG — supaya dokumen hanya dibaca sekali.
 *
 * Analisis dokumen memakan token dan waktu. Dokumen yang isinya tidak berubah
 * tidak boleh dianalisis ulang hanya karena admin membuka halaman lain atau
 * menekan tombol yang sama dua kali. Karena itu hasil analisis disimpan, dan
 * dipakai ulang selama **sidik dokumennya** masih sama.
 *
 * Sidik dibuat dari hal-hal yang berubah kalau isi dokumen berubah: id berkas,
 * ukuran, tipe, dan waktu unggah. Sidik isi (hash) tidak dipakai karena KMS
 * tidak selalu menyediakannya, dan mengunduh seluruh berkas hanya untuk
 * memeriksa perubahan justru memakan waktu lebih banyak daripada analisisnya.
 *
 * Ada DUA tingkat perubahan yang diperiksa:
 * 1. Dokumen itu sendiri (`sidikDokumen`) — diunggah ulang dengan isi baru.
 * 2. Basis dokumen instansi (`sidikKb`) — ada dokumen BARU yang masuk, yang
 *    bisa menambah indikator yang belum tertangkap analisis sebelumnya.
 *
 * Keduanya membuat cache tidak dipakai. Selain itu ada pagar umur: cache yang
 * terlalu tua dianalisis ulang walau sidiknya sama, supaya kesalahan lama tidak
 * hidup selamanya.
 */

/** Pagar umur cache. Sidik yang sama tetap dianalisis ulang setelah ini. */
export const UMUR_CACHE_MS = 30 * 24 * 60 * 60 * 1000;

export interface MetaDokumen {
  berkasId: string;
  ukuranKb?: number;
  tipe?: string;
  /** Waktu unggah — berubah bila berkas diganti. */
  diunggahPada?: string;
}

/**
 * Sidik satu dokumen. Stabil untuk dokumen yang sama, berubah bila berkasnya
 * diganti (ukuran atau waktu unggah berbeda).
 */
export function sidikDokumen(meta: MetaDokumen): string {
  const bagian = [
    String(meta.berkasId || '').trim(),
    meta.ukuranKb === undefined || meta.ukuranKb === null ? '' : String(Math.round(Number(meta.ukuranKb))),
    String(meta.tipe || '').trim().toLowerCase(),
    String(meta.diunggahPada || '').trim(),
  ];
  return bagian.join('|');
}

/**
 * Sidik basis dokumen: urutan id + waktu ubah. Disortir supaya urutan balasan
 * KMS yang berubah-ubah tidak dianggap "ada dokumen baru".
 */
export function sidikKb(daftar: Array<{ id?: string; berkasId?: string; updatedAt?: string; diunggahPada?: string }>): string {
  const bagian = daftar
    .map((d) => `${String(d.id || d.berkasId || '')}@${String(d.updatedAt || d.diunggahPada || '')}`)
    .filter((s) => s !== '@')
    .sort();
  return bagian.join(';');
}

export type SebabAnalisisUlang =
  | 'belum-ada'
  | 'dokumen-berubah'
  | 'kb-berubah'
  | 'kedaluwarsa'
  | 'dipaksa'
  | 'analisis-terakhir-gagal';

export type PutusanCache =
  | { pakai: true; analisisId: string; alasan: string }
  | { pakai: false; sebab: SebabAnalisisUlang; alasan: string };

/** Pesan yang dibaca admin — menyebut sebabnya, bukan sekadar "cache miss". */
const PESAN_SEBAB: Record<SebabAnalisisUlang, string> = {
  'belum-ada': 'Dokumen ini belum pernah dianalisis.',
  'dokumen-berubah': 'Dokumen berubah sejak analisis terakhir, jadi dibaca ulang.',
  'kb-berubah': 'Ada dokumen baru di basis instansi, jadi dibaca ulang dengan informasi terbaru.',
  kedaluwarsa: 'Hasil analisis sudah terlalu lama, jadi dibaca ulang.',
  dipaksa: 'Analisis ulang diminta manual.',
  'analisis-terakhir-gagal': 'Analisis terakhir gagal, jadi dicoba lagi.',
};

/**
 * Apakah dua sidik dokumen menunjuk isi yang sama.
 *
 * Sidik dirakit dari beberapa bagian (`berkasId|ukuran|tipe|diunggahPada`), dan
 * tidak semua bagian selalu tersedia: analisis otomatis berjalan beberapa detik
 * setelah unggah, ketika lampirannya belum menempel sehingga ukuran/tipe/waktu
 * belum diketahui. Membandingkan string apa adanya membuat dokumen yang sama
 * dianggap "berubah" dan dibaca ulang — kuota habis tanpa isi yang berubah.
 *
 * Karena itu bagian yang kosong di salah satu sisi diabaikan. Bagian yang ada di
 * kedua sisi tetap harus sama persis, jadi berkas yang benar-benar diganti
 * (ukuran/waktu unggah berbeda) tetap memaksa analisis ulang.
 */
export function sidikCocok(a?: string, b?: string): boolean {
  if (!a || !b) return true;
  if (a === b) return true;
  const kiri = a.split('|');
  const kanan = b.split('|');
  return kiri.every((bagian, i) => !bagian || !kanan[i] || bagian === kanan[i]);
}

export interface AnalisisUntukCache {
  id: string;
  berkasId: string;
  status: string;
  dibuatPada: string;
  selesaiPada?: string;
  sidikDokumen?: string;
  sidikKb?: string;
  /** `tabel-lokal` = angka dibaca dari sel berkas, tidak bergantung indeks RAG. */
  metode?: string;
}

export interface OpsiPutusan {
  berkasId: string;
  sidikDokumen?: string;
  sidikKb?: string;
  /** Admin menekan "analisis ulang": jangan pakai cache. */
  paksa?: boolean;
  sekarang?: number;
}

/**
 * Boleh tidaknya memakai hasil analisis yang sudah ada.
 *
 * Memilih analisis TERBARU yang selesai untuk berkas ini, lalu memeriksa tiga
 * hal: sidik dokumen, sidik basis, dan umur.
 */
export function putusanCache(daftar: AnalisisUntukCache[], opsi: OpsiPutusan): PutusanCache {
  if (opsi.paksa) return { pakai: false, sebab: 'dipaksa', alasan: PESAN_SEBAB.dipaksa };

  const untukBerkas = daftar
    .filter((a) => a.berkasId === opsi.berkasId)
    .sort((a, b) => String(b.dibuatPada).localeCompare(String(a.dibuatPada)));

  if (untukBerkas.length === 0) {
    return { pakai: false, sebab: 'belum-ada', alasan: PESAN_SEBAB['belum-ada'] };
  }

  const terbaru = untukBerkas[0];
  if (terbaru.status !== 'selesai') {
    return { pakai: false, sebab: 'analisis-terakhir-gagal', alasan: PESAN_SEBAB['analisis-terakhir-gagal'] };
  }

  if (!sidikCocok(opsi.sidikDokumen, terbaru.sidikDokumen)) {
    return { pakai: false, sebab: 'dokumen-berubah', alasan: PESAN_SEBAB['dokumen-berubah'] };
  }

  /**
   * DOKUMEN BARU DI BASIS hanya membatalkan cache hasil RAG.
   *
   * Butir yang dibaca langsung dari sel berkas (`tabel-lokal`) tidak terpengaruh
   * indeks basis dokumen: isinya tetap sama selama berkasnya tidak diganti.
   * Dulu setiap unggahan baru membuat SEMUA dokumen dianalisis ulang — menit
   * demi menit menunggu tanpa satu angka pun berubah.
   */
  if (terbaru.metode !== 'tabel-lokal' && opsi.sidikKb && terbaru.sidikKb && opsi.sidikKb !== terbaru.sidikKb) {
    return { pakai: false, sebab: 'kb-berubah', alasan: PESAN_SEBAB['kb-berubah'] };
  }

  const selesai = new Date(terbaru.selesaiPada || terbaru.dibuatPada).getTime();
  const sekarang = opsi.sekarang ?? Date.now();
  if (Number.isFinite(selesai) && sekarang - selesai > UMUR_CACHE_MS) {
    return { pakai: false, sebab: 'kedaluwarsa', alasan: PESAN_SEBAB.kedaluwarsa };
  }

  return {
    pakai: true,
    analisisId: terbaru.id,
    alasan: 'Memakai hasil analisis yang tersimpan — dokumen belum berubah, jadi tidak ada pembacaan ulang ke RAG.',
  };
}

/**
 * Analisis mana yang perlu disegarkan karena basis dokumen instansinya berubah.
 * Dipakai untuk memberi tahu admin, bukan untuk menyegarkan diam-diam.
 */
export function perluSegarKarenaKb<T extends AnalisisUntukCache>(
  daftar: T[],
  sidikKbSekarang: string
): T[] {
  if (!sidikKbSekarang) return [];
  return daftar.filter((a) => a.status === 'selesai' && a.sidikKb && a.sidikKb !== sidikKbSekarang);
}
