/**
 * Deteksi obrolan ringan (sapaan / terima kasih) yang TIDAK menuntut rujukan.
 *
 * ponytail: sebelumnya deteksi ini ditulis langsung di `server.ts` sebagai
 * rangkaian `lower.includes('apa ini')`, `includes('terima kasih')`, dst.
 * Karena `includes` memeriksa SELURUH pesan, pertanyaan data yang kebetulan
 * memuat frasa itu ikut dianggap sapaan — dan sapaan sengaja melewati
 * strict grounding. Contoh nyata yang lolos:
 *
 *   "berapa nilai aset dan apa ini sudah diaudit?"
 *
 * Pesan itu berisi "apa ini", jadi dianggap obrolan ringan, lalu model bebas
 * menjawab tanpa dokumen. Persis kebocoran yang ingin ditutup.
 *
 * Aturan di sini: sapaan hanya bila pesannya MEMANG pendek dan tidak memuat
 * pertanyaan. Begitu ada kata tanya atau angka, pesan dianggap pertanyaan data
 * dan wajib bersumber.
 */

/** Sapaan pembuka yang boleh berdiri sendiri. */
const SAPAAN =
  /^(?:halo|hallo|hai|hi|hii|hello|helo|hey|hei|pagi|siang|sore|malam|selamat\s+(?:pagi|siang|sore|malam)|assalamualaikum|assalamu'alaikum|salam|permisi|test|tes|tes\s+chat|cek|min|admin|kak|bos)(?:\s+(?:semua|kak|min|admin|bos|gan|bro|sis|bapak|ibu))?$/;

/** Terima kasih / penutup — boleh diikuti beberapa kata. */
const TERIMA_KASIH =
  /^(?:terima\s*kasih|terimakasih|makasih|mksh|thanks|thank\s*you|thx|tq|oke\s+terima\s*kasih|sip|mantap|ok|oke|baik)(?:\s+(?:banyak|ya|yah|sudah|kak|min|admin|semuanya|atas\s+bantuannya))*$/;

/** Pertanyaan tentang asisten itu sendiri — bukan pertanyaan data instansi. */
const TENTANG_ASISTEN =
  /^(?:siapa\s+kamu|kamu\s+siapa|anda\s+siapa|apa\s+ini|ini\s+apa|bisa\s+apa|kamu\s+bisa\s+apa|apa\s+yang\s+bisa\s+kamu\s+lakukan|cara\s+pakai|cara\s+penggunaan)$/;

/** Basa-basi singkat yang tidak menuntut dokumen. */
const BASA_BASI =
  /^(?:apa\s+kabar|apa\s+kabarmu|bagaimana\s+kabar(?:mu|nya)?|gimana\s+kabar(?:mu|nya)?|lagi\s+apa|sedang\s+apa)$/;

/** Kata tanya: kehadirannya menandakan pertanyaan data, bukan sapaan. */
const KATA_TANYA =
  /(?:^|\s)(?:apa|apakah|berapa|bagaimana|gimana|kapan|dimana|di\s*mana|siapa|mengapa|kenapa|sebutkan|tampilkan|jelaskan|bandingkan|hitung|total|jumlah|nilai|target|realisasi|persen|persentase)(?:\s|$|\?)/;

/** Batas kata pesan yang masih wajar sebagai sapaan. */
const MAKS_KATA_SAPAAN = 6;

/** Buang tanda baca tepi & rapikan spasi; huruf kecil semua. */
function rapikan(pesan: string): string {
  return String(pesan || '')
    .toLowerCase()
    .replace(/[“”"'`]/g, '')
    .replace(/[^\p{L}\p{N}\s?]/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*\?\s*$/, '?')
    .trim();
}

const TENTANG_ASISTEN2 =
  /(?:^| )(?:kamu (?:pakai |pake |gunakan )?model apa|model apa (?:yang )?kamu pakai|kamu (?:bot|ai|robot|asisten) apa|aplikasi apa ini|apa aplikasi ini|ini (?:aplikasi|chatbot) apa|kamu dari mana)(?: |$)/;

/**
 * Balasan lokal untuk sapaan / pertanyaan tentang asisten.
 *
 * Sapaan tidak butuh dokumen, jadi TIDAK dikirim ke layanan RAG: dulu "halo"
 * menunggu 30-90 dtk dan "kamu model apa" berakhir "layanan dokumen sedang
 * tidak tersedia" — jawaban ngawur untuk pesan yang tidak menyangkut dokumen.
 */
export function jawabanSapaan(pesan: unknown, instansi?: string): string {
  const teks = rapikan(String(pesan ?? '')).replace(/\?+$/, '').trim();
  if (TENTANG_ASISTEN.test(teks) || TENTANG_ASISTEN2.test(teks)) {
    return (
      'Saya **Asisten Aiones Boards**, asisten di aplikasi ini. Saya menjawab pertanyaan tentang ' +
      `dokumen resmi instansi${instansi ? ` **${instansi}**` : ''} dan bisa menyusun atau mengubah dashboard ` +
      'dari berkas yang sudah diunggah. Jawaban data saya sandarkan ke potongan dokumen di knowledge base ' +
      'instansi, bukan pengetahuan umum.'
    );
  }
  if (TERIMA_KASIH.test(teks)) {
    return 'Sama-sama. Kalau ada angka atau dokumen lain yang mau ditelusuri, sebut saja judul atau indikatornya.';
  }
  if (BASA_BASI.test(teks)) {
    return 'Baik, terima kasih. Saya siap membantu menelusuri dokumen instansi — tanya saja angkanya, atau minta saya susun dashboard dari berkas yang ada.';
  }
  return (
    'Halo! Saya **Asisten Aiones Boards**. Tanya apa saja soal dokumen instansi' +
    `${instansi ? ` **${instansi}**` : ''} — nilai pengadaan, piutang, realisasi — ` +
    'atau minta saya susun dashboard dari berkas yang sudah diunggah.'
  );
}

export function adalahSapaan(pesan: unknown): boolean {
  const teks = rapikan(String(pesan ?? ''));
  if (!teks) return false;

  const tanpaTanya = teks.replace(/\?+$/, '').trim();
  const kata = tanpaTanya.split(/\s+/).filter(Boolean);
  if (kata.length === 0 || kata.length > MAKS_KATA_SAPAAN) return false;

  // Angka hampir selalu berarti pertanyaan data ("berapa", periode, nilai).
  if (/\d/.test(tanpaTanya)) return false;

  if (SAPAAN.test(tanpaTanya)) return true;
  if (TERIMA_KASIH.test(tanpaTanya)) return true;
  if (TENTANG_ASISTEN.test(tanpaTanya)) return true;
  if (TENTANG_ASISTEN2.test(tanpaTanya)) return true;
  if (BASA_BASI.test(tanpaTanya)) return true;

  // Sapaan di awal + sisa kalimat tanpa kata tanya, mis. "halo kak" / "pagi min".
  const sisa = tanpaTanya.replace(/^(?:halo|hallo|hai|hi|hello|helo|hey|hei|selamat\s+(?:pagi|siang|sore|malam)|assalamualaikum|salam|permisi)\b/, '').trim();
  if (sisa !== tanpaTanya) {
    if (!sisa) return true;
    if (BASA_BASI.test(sisa)) return true;
    if (KATA_TANYA.test(sisa)) return false;
    return sisa.split(/\s+/).filter(Boolean).length <= 3;
  }

  return false;
}
