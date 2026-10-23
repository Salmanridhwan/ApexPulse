/**
 * PESAN GALAT UNTUK PENGGUNA — bahasa awam, tanpa istilah teknis.
 *
 * Pengguna BUMD tidak perlu (dan tidak akan) memahami "RAG", "HTTP 502",
 * "timeout", atau "Failed to fetch". Yang mereka butuhkan: apa yang terjadi
 * dan apa yang bisa dilakukan. Rincian teknis tetap masuk log server.
 */

interface PolaRamah {
  pola: RegExp;
  pesan: string;
}

/** Kalimat yang memang sudah jelas bagi pengguna — diteruskan apa adanya. */
const POLA_RAMAH: PolaRamah[] = [
  { pola: /instansi (tidak ditemukan|belum dipilih)/i, pesan: 'Instansi belum dipilih atau tidak ditemukan.' },
  { pola: /template tidak dikenal/i, pesan: 'Template tidak dikenali. Silakan pilih template lain.' },
  { pola: /tidak berhak|tanpa akses|forbidden/i, pesan: 'Anda tidak punya akses untuk tindakan ini.' },
];

/** Kata yang menandakan pesan berasal dari lapisan teknis, bukan untuk pengguna. */
const TEKNIS =
  /\b(rag|http[s]?|api|timeout|timed out|abort|aborted|fetch|network|econn\w*|socket|json|undefined|null|502|503|504|500|401|403|enotfound|etimedout)\b/i;

const UMUM = 'Terjadi gangguan saat membuat dashboard. Coba lagi beberapa saat lagi.';

/**
 * Ubah galat apa pun menjadi satu kalimat yang bisa dipahami pengguna awam.
 * Tidak pernah mengembalikan istilah teknis.
 */
export function pesanGalatRamah(err: unknown): string {
  const mentah =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : String((err as { message?: unknown })?.message ?? '');
  const teks = mentah.trim();
  if (!teks) return UMUM;

  // Gagal di tingkat jaringan: browser tidak pernah menerima jawaban server.
  if (/failed to fetch|networkerror|load failed|fetch failed|network request failed/i.test(teks)) {
    return 'Koneksi ke server terputus. Periksa jaringan Anda, lalu coba lagi.';
  }

  // Sesi habis: pengguna cukup diminta masuk lagi.
  if (/\b(sesi|session|login|masuk)\b/i.test(teks) && /\b(habis|berakhir|expired|401|403)\b/i.test(teks)) {
    return 'Sesi Anda sudah berakhir. Silakan masuk kembali.';
  }

  for (const { pola, pesan } of POLA_RAMAH) {
    if (pola.test(teks)) return pesan;
  }

  if (TEKNIS.test(teks)) return UMUM;
  return teks.length <= 140 ? teks : UMUM;
}
