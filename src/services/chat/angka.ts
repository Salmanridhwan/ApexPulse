/**
 * Pemeriksaan angka pada jawaban asisten.
 *
 * ponytail: penjaga sumber (`putusanJawaban`) hanya memastikan ADA potongan
 * dokumen — bukan bahwa ANGKA di jawaban benar-benar berasal dari potongan itu.
 * Model masih bisa menulis "naik 12,5%" padahal dokumen menyebut angka lain,
 * dan pembaca menelusuri dokumen akan menemukan angka yang tidak ada di sana.
 *
 * Pendekatan di sini sengaja TIDAK memblokir jawaban: sebagian angka sah hasil
 * hitungan model (selisih, persentase, penjumlahan) sehingga tidak akan muncul
 * apa adanya di dokumen. Yang dilakukan: tandai angka yang tidak ditemukan di
 * potongan, lalu server menambahkan catatan jujur agar pembaca memeriksa ulang.
 */

/** Angka yang lolos pemeriksaan: nilai numerik + bentuk aslinya di teks. */
export interface AngkaTeks {
  nilai: number;
  teks: string;
}

/**
 * Skala kata yang diakui. `M`/`T`/`K` sengaja tidak dipakai: terlalu mudah
 * bertabrakan dengan satuan lain ("500 M" meter) dan jarang di dokumen BUMD.
 */
const SKALA: Array<{ pola: RegExp; faktor: number }> = [
  { pola: /^(juta|jt)\b/i, faktor: 1_000_000 },
  { pola: /^(miliar|milyar|miliar\b)/i, faktor: 1_000_000_000 },
  { pola: /^(triliun|trilyun)\b/i, faktor: 1_000_000_000_000 },
  { pola: /^(ribu|rb)\b/i, faktor: 1_000 },
];

/**
 * Ubah satu potongan angka menjadi nilai.
 *
 * Aturan penulisan Indonesia: titik = pemisah ribuan, koma = desimal.
 *   "1.234.567,89" -> 1234567.89
 *   "12,5"         -> 12.5
 *   "3.14"         -> 3.14  (dua digit di belakang titik: desimal)
 */
export function bacaAngka(mentah: string): number | null {
  const t = mentah.trim();
  if (!t) return null;

  // Ribuan bertitik, boleh diikuti koma desimal.
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) {
    const n = Number(t.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  // Desimal berkoma.
  if (/^\d+,\d+$/.test(t)) {
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  // Desimal bertitik (bukan pemisah ribuan karena digit di belakang bukan 3).
  if (/^\d+\.\d+$/.test(t)) {
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  // Bilangan bulat.
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Apakah angka ini tampak sebagai penanda daftar ("1." / "2)" di awal baris). */
function penandaDaftar(teks: string, mulai: number, akhir: number): boolean {
  const sebelum = teks.slice(0, mulai);
  const awalBaris = sebelum.length === 0 || /\n[ \t]*$/.test(sebelum);
  if (!awalBaris) return false;
  const sesudah = teks.slice(akhir, akhir + 1);
  return sesudah === '.' || sesudah === ')';
}

/**
 * Ambil semua angka bermakna dari sebuah teks.
 *
 * Yang diabaikan:
 * - penanda daftar ("1." di awal baris);
 * - tahun 1900–2099 (konteks waktu, bukan besaran yang diklaim);
 * - angka < 10 tanpa satuan persen (terlalu sering muncul sebagai kata biasa:
 *   "3 dokumen", "2 periode"), kecuali angka persen tetap diperiksa.
 */
export function ekstrakAngka(teks: string): AngkaTeks[] {
  const hasil: AngkaTeks[] = [];
  if (!teks) return hasil;

  const pola = /\d+(?:[.,]\d+)*/g;
  let m: RegExpExecArray | null;
  while ((m = pola.exec(teks)) !== null) {
    const mentah = m[0];
    const mulai = m.index;
    const akhir = mulai + mentah.length;
    if (penandaDaftar(teks, mulai, akhir)) continue;

    const dasar = bacaAngka(mentah);
    if (dasar === null) continue;

    // Skala kata setelah angka: "1,2 miliar", "3 juta", "5 ribu".
    const sesudah = teks.slice(akhir, akhir + 16);
    let nilai = dasar;
    for (const s of SKALA) {
      if (s.pola.test(sesudah.replace(/^[ \t]+/, ''))) {
        nilai = dasar * s.faktor;
        break;
      }
    }

    const persen = /^[ \t]*%/.test(sesudah) || /^[ \t]*(persen|prosen)\b/i.test(sesudah.replace(/^[ \t]+/, ''));
    const tahun = Number.isInteger(dasar) && dasar >= 1900 && dasar <= 2099;

    if (tahun) continue;
    // Angka kecil diabaikan HANYA bila berdiri sendiri: "4,7 miliar" bernilai
    // miliaran walau digitnya kecil, jadi tetap diperiksa.
    if (dasar < 10 && !persen && nilai === dasar) continue;

    hasil.push({ nilai, teks: mentah });
  }
  return hasil;
}

/** Apakah `nilai` sudah ada di salah satu kumpulan angka (toleransi pembulatan). */
function sudahAda(nilai: number, kumpulan: number[]): boolean {
  const toleransi = Math.max(0.01, Math.abs(nilai) * 0.005);
  return kumpulan.some((k) => Math.abs(k - nilai) <= toleransi);
}

export interface MasukanAngka {
  /** Teks jawaban yang akan ditampilkan. */
  jawaban: string;
  /** Potongan dokumen yang benar-benar dikirim layanan dokumen. */
  potongan: string[];
  /** Teks pertanyaan pengguna — angka yang disebut pengguna bukan karangan. */
  pertanyaan?: string;
  /** Angka lain yang boleh dianggap sah (mis. dari metadata jawaban). */
  izin?: string[];
}

/**
 * Angka di jawaban yang TIDAK ditemukan di potongan dokumen.
 *
 * Kosong berarti semua angka jawaban bisa ditelusuri ke dokumen.
 */
export function angkaTakBersumber(m: MasukanAngka): AngkaTeks[] {
  const jawaban = ekstrakAngka(m.jawaban || '');
  if (jawaban.length === 0) return [];

  const sumber: number[] = [];
  for (const p of m.potongan || []) {
    for (const a of ekstrakAngka(p)) sumber.push(a.nilai);
  }
  for (const a of ekstrakAngka(m.pertanyaan || '')) sumber.push(a.nilai);
  for (const izin of m.izin || []) {
    for (const a of ekstrakAngka(izin)) sumber.push(a.nilai);
  }

  // Dokumen tidak memuat angka apa pun: semua angka jawaban tanpa dasar.
  // Tetap laporkan, tetapi jangan sampai seluruh jawaban dianggap karangan
  // hanya karena dokumennya berupa narasi.
  const terlihat: AngkaTeks[] = [];
  const nilaiTerpakai = new Set<number>();
  for (const a of jawaban) {
    if (nilaiTerpakai.has(a.nilai)) continue;
    nilaiTerpakai.add(a.nilai);
    if (!sudahAda(a.nilai, sumber)) terlihat.push(a);
  }
  return terlihat;
}

/** Catatan jujur yang ditempel ke bawah jawaban saat ada angka tak tertelusur. */
export function pesanAngkaTakBersumber(angka: AngkaTeks[]): string {
  if (angka.length === 0) return '';
  const tampil = angka.slice(0, 5).map((a) => `**${a.teks}**`);
  const lain = angka.length > tampil.length ? ` dan ${angka.length - tampil.length} angka lain` : '';
  return (
    `\n\n---\n` +
    `Catatan: angka ${tampil.join(', ')}${lain} tidak saya temukan langsung di potongan dokumen yang saya baca — ` +
    `bisa jadi hasil hitungan saya sendiri. Mohon periksa ulang ke dokumen aslinya sebelum dipakai.`
  );
}
