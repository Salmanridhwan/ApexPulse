/**
 * Pembacaan perintah chat yang menyentuh widget di kanvas: HAPUS dan UBAH TIPE.
 *
 * MURNI (tanpa I/O) supaya bisa diuji tanpa server.
 *
 * Kenapa dipisah: dua bug nyata muncul saat uji asisten.
 *  1. Hapus hanya dikenali kalau kalimatnya DIAWALI "hapus widget", sehingga
 *     "tolong hapus widget X" lolos ke jalur tanya-jawab dan dijawab
 *     "informasi tidak ditemukan".
 *  2. Perintah ubah tipe selalu menyasar grafik PERTAMA dan membaca jenis kata
 *     apa pun sebagai TUJUAN, sehingga "ubah grafik donat menjadi batang"
 *     justru mengubah grafik garis menjadi donat (kebalikan maksud pengguna).
 */

/** Tipe widget yang bisa disebut pengguna, urut dari yang paling spesifik. */
const TIPE_KATA: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(?:batang|bar|kolom)\b/, 'bar'],
  [/\b(?:garis|line)\b/, 'line'],
  [/\barea\b/, 'area'],
  [/\b(?:donat|donut|pie|lingkaran)\b/, 'donut'],
  [/\b(?:tabel|table)\b/, 'table'],
  [/\b(?:kpi|kartu angka)\b/, 'kpi'],
  [/\b(?:narasi|ringkasan teks)\b/, 'narasi'],
];

/** Tipe widget pertama yang disebut dalam teks, atau null. */
export function tipeGrafikDariTeks(teks: unknown): string | null {
  const t = String(teks || '').toLowerCase();
  for (const [pola, tipe] of TIPE_KATA) if (pola.test(t)) return tipe;
  return null;
}

/** Kata yang memisahkan "apa yang diubah" dari "jadi apa". */
const PEMISAH_TUJUAN = /\b(?:menjadi|jadikan|jadi|diubah ke|ubah ke|ganti ke|menuju|ke)\b/;

/** Bagian kalimat SEBELUM kata "menjadi/jadi/ke" — berisi sasaran widget. */
export function bagianSumber(prompt: unknown): string {
  return String(prompt || '')
    .toLowerCase()
    .split(PEMISAH_TUJUAN)[0];
}

/** Bagian kalimat SESUDAH kata "menjadi/jadi/ke" — berisi tipe tujuan. */
export function bagianTujuan(prompt: unknown): string {
  const bagian = String(prompt || '')
    .toLowerCase()
    .split(PEMISAH_TUJUAN);
  return bagian.length > 1 ? bagian[bagian.length - 1] : '';
}

/**
 * Teks sasaran perintah HAPUS widget, atau null kalau bukan perintah hapus.
 * Menerima kata pengantar ("tolong", "coba", "sekarang") dan sinonim.
 */
export function perintahHapusWidget(prompt: unknown): string | null {
  const t = String(prompt || '').toLowerCase();
  const m = t.match(
    /(?:^|[^a-z])(?:hapus|hapuskan|hilangkan|buang|remove|delete)(?:kan|lah)?\s+(?:widget|kartu|grafik|chart|panel)(?:nya|ku|mu)?\b(.*)$/
  );
  if (!m) return null;
  return m[1].replace(/^[\s,:.\-–—]+/, '').trim();
}

/** Kata penting judul (dibuang kata sambung & satuan umum). */
const KATA_ABAIKAN = new Set(['dan', 'atau', 'yang', 'di', 'ke', 'dari', 'untuk', 'pada', 'atas', 'dalam', 'per', 'the']);
const kataJudul = (teks: unknown): string[] =>
  String(teks || '')
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, ' ')
    .split(' ')
    .filter((k) => k.length > 1 && !KATA_ABAIKAN.has(k));

/**
 * Apakah dua judul widget menunjuk hal yang sama?
 *
 * Dipakai mencegah kartu kembar saat menambah widget: "Kepuasan Pengguna
 * Penanganan" dan "Kepuasan pengguna atas penanganan" adalah indikator yang
 * sama walau salah satunya menyisipkan kata "atas".
 */
export function judulWidgetMirip(a: unknown, b: unknown): boolean {
  const ka = new Set(kataJudul(a));
  const kb = new Set(kataJudul(b));
  if (ka.size === 0 || kb.size === 0) return false;
  let sama = 0;
  for (const k of ka) if (kb.has(k)) sama += 1;
  const terkecil = Math.min(ka.size, kb.size);
  return sama >= 2 && sama / terkecil >= 0.75;
}
