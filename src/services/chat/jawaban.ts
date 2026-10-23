/**
 * Keputusan apakah jawaban asisten boleh ditampilkan.
 *
 * ponytail: masalahnya bukan "LLM menjawab salah", tapi "LLM tetap menjawab
 * ketika dokumen tidak memuat apa pun". Layanan RAG bisa membalas `answer`
 * berisi kalimat umum (atau pengetahuan umum model) dengan `sources: []`.
 * Selama jawaban itu ditampilkan, pengguna mengira angka/fakta instansi berasal
 * dari dokumen resmi — padahal tidak ada rujukan sama sekali.
 *
 * Aturan di sini: jawaban TANPA sumber tidak ditampilkan untuk pertanyaan data.
 * Pengecualian hanya obrolan ringan (sapaan/terima kasih) yang memang tidak
 * menuntut rujukan.
 */

export interface MasukanPutusan {
  /** Jumlah sitasi yang benar-benar dikembalikan layanan dokumen. */
  citationsCount: number;
  /** Jumlah potongan dokumen yang ikut dikembalikan (0 = tidak ada dokumen terambil). */
  jumlahPotongan: number;
  /**
   * Penanda grounding dari layanan dokumen.
   * `false` = layanan sendiri menyatakan jawaban tidak bersandar dokumen.
   * `undefined` = layanan tidak melaporkan (jangan dianggap gagal).
   */
  grounded?: boolean;
  /** Obrolan ringan (sapaan, terima kasih) — tidak menuntut rujukan. */
  sapaan: boolean;
  /** Nama instansi aktif, dipakai di pesan jujur. */
  instansi?: string;
}

export interface Putusan {
  /** true = teks jawaban boleh ditampilkan apa adanya. */
  tampilkan: boolean;
  alasan: 'bersumber' | 'sapaan' | 'tanpa-sumber';
  /** Pesan pengganti saat `tampilkan === false`. */
  pesan?: string;
}

/** Pesan jujur saat dokumen tidak memuat jawabannya. */
export function pesanTanpaSumber(instansi?: string): string {
  const untuk = instansi ? ` untuk **${instansi}**` : '';
  return (
    `Saya tidak menemukan jawaban itu di dokumen resmi${untuk}. ` +
    `Supaya tidak menyesatkan, saya tidak menampilkan jawaban tanpa rujukan dokumen.\n\n` +
    `Coba sebutkan indikator, periode, atau nama dokumen yang lebih spesifik. ` +
    `Kalau dokumennya memang belum ada, unggah dulu lewat **Manajemen Berkas** — ` +
    `setelah terindeks, saya bisa menjawab dari dokumen itu.`
  );
}

export function putusanJawaban(m: MasukanPutusan): Putusan {
  // Obrolan ringan tidak butuh rujukan; persona boleh membalas natural.
  if (m.sapaan) return { tampilkan: true, alasan: 'sapaan' };

  // Layanan menyatakan sendiri jawabannya tidak bersandar dokumen.
  if (m.grounded === false) {
    return { tampilkan: false, alasan: 'tanpa-sumber', pesan: pesanTanpaSumber(m.instansi) };
  }

  // Ada sitasi atau potongan dokumen → jawaban punya dasar.
  if (m.citationsCount > 0 || m.jumlahPotongan > 0) {
    return { tampilkan: true, alasan: 'bersumber' };
  }

  // Tidak ada sitasi DAN tidak ada potongan: jawaban tidak punya dasar apa pun.
  return { tampilkan: false, alasan: 'tanpa-sumber', pesan: pesanTanpaSumber(m.instansi) };
}
