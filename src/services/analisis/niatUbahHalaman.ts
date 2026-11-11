/**
 * MENDETEKSI NIAT MENGUBAH HALAMAN DARI KALIMAT BIASA.
 *
 * Asisten hanya punya satu pintu: admin mengetik apa saja, tanpa menekan tombol
 * mode. Karena itu asisten harus bisa membedakan "berapa pendapatan 2025?"
 * (pertanyaan, dijawab) dari "tambahkan kartu tren pendapatan" (permintaan ubah
 * halaman, dibuatkan usulan).
 *
 * Pendeteksian ini SENGAJA deterministik dan konservatif: tanpa model, supaya
 * hasilnya bisa diuji dan tidak berubah-ubah. Salah tebak ke arah "pertanyaan"
 * hanya membuat admin perlu menulis ulang; salah tebak ke arah "usulan" membuat
 * pertanyaan biasa diperlakukan sebagai perintah ubah halaman — itu lebih
 * mengganggu, jadi kata tanya menang atas kata kerja.
 */

/** Kata kerja yang menandakan permintaan mengubah halaman. */
const KATA_UBAH = [
  'tambah',
  'tambahkan',
  'tambahi',
  'sisipkan',
  'buatkan',
  'bikinkan',
  'ubah',
  'ubahkan',
  'rubah',
  'ganti',
  'gantikan',
  'hapus',
  'hapuskan',
  'buang',
  'hilangkan',
  'pindah',
  'pindahkan',
  'geser',
  'urutkan',
  'susun ulang',
  'rapikan',
  'sederhanakan',
  'kecilkan',
  'besarkan',
  'perbesar',
  'perkecil',
  'perlebar',
  'jadikan',
  'pisahkan',
  'gabungkan',
  'seragamkan',
];

/** Kata tanya: kalau ada, kalimat dianggap pertanyaan walau memuat kata kerja. */
const KATA_TANYA = ['berapa', 'apa', 'apakah', 'siapa', 'kapan', 'mengapa', 'kenapa', 'bagaimana', 'dimana', 'mana'];

/** Frasa yang jelas bukan permintaan ubah halaman yang sedang dibuka. */
const PENGECUALIAN = ['buat dashboard', 'bikin dashboard', 'buatkan dashboard', 'dashboard baru', 'halaman baru'];

function normalisasi(teks: string): string {
  return teks.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Apakah kalimat ini permintaan mengubah halaman yang sedang dibuka?
 *
 * Aturan:
 * 1. Kalimat yang memuat kata tanya dan TIDAK memuat kata kerja ubah → pertanyaan.
 * 2. Kalimat yang memuat kata tanya DAN kata kerja ubah → tetap usulan
 *    ("tolong tambahkan grafik, berapa lama?" tetap permintaan).
 * 3. Permintaan membuat dashboard/halaman baru bukan urusan halaman ini.
 */
export function niatUbahHalaman(pesan: string): boolean {
  const t = normalisasi(pesan || '');
  if (!t) return false;

  // "buatkan halaman kedua/baru/lanjutan" juga lewat jalur usulan, tetapi
  // usulannya membuat halaman BARU (lihat `niatHalamanBaru`).
  if (niatHalamanBaru(t)) return true;

  if (PENGECUALIAN.some((p) => t.includes(p))) return false;

  const adaKataUbah = KATA_UBAH.some((k) => t.includes(k));
  if (!adaKataUbah) return false;

  // "tambah" juga muncul di "tambahan data" — bukan perintah.
  if (/\btambahan\b/.test(t) && !/\btambah(kan|i)?\b/.test(t)) return false;

  // Kata tanya di awal kalimat menandakan pertanyaan, kecuali ada kata kerja
  // ubah yang jelas menyuruh ("bisakah tambahkan...").
  const mulaiTanya = KATA_TANYA.some((k) => t.startsWith(k + ' ') || t.startsWith(k + ','));
  const menyuruh = /^(tolong|mohon|coba|silakan|bisa|bisakah|dapat|harap)\b/.test(t);
  if (mulaiTanya && !menyuruh) return false;

  return true;
}

/**
 * Apakah admin meminta HALAMAN BARU di dashboard ini?
 *
 * "buatkan saya halaman keduanya yang masih menyambung" dulu diperlakukan
 * sebagai ubah halaman aktif, sehingga empat kartu ditumpuk ke halaman
 * Ringkasan (5 → 9 kartu) alih-alih membuat halaman kedua. Wajib ada kata
 * kerja: "saya mau halaman baru" tetap bukan perintah.
 */
export function niatHalamanBaru(pesan: string): boolean {
  const t = normalisasi(pesan || '');
  if (!t) return false;
  const kerja = /\b(?:buat|buatkan|bikin|bikinkan|tambah|tambahkan|tambahi|susun|susunkan|siapkan|sediakan)\b/.test(t);
  if (!kerja) return false;
  if (/\bdashboard (?:baru|lain)\b/.test(t)) return false;
  return /\bhalaman(?:nya)?\s+(?:yang\s+)?(?:ke-?\s*)?(?:baru|kedua|ketiga|keempat|kelima|lanjutan|berikut(?:nya)?|selanjutnya|tambahan|lain|lagi|\d+)(?:nya)?\b/.test(t)
    || /\b(?:tambah|tambahkan|tambahi)\s+(?:satu\s+|1\s+)?halaman\b/.test(t)
    || /\b(?:satu|1)\s+halaman\s+lagi\b/.test(t);
}

/** Ringkasan singkat untuk pesan sistem — supaya admin tahu apa yang terjadi. */
export function ringkasNiat(pesan: string): string {
  return niatUbahHalaman(pesan)
    ? 'Permintaan perubahan halaman dikenali — hasilnya akan tampil sebagai usulan.'
    : 'Dianggap pertanyaan — dijawab dari dokumen tanpa mengubah halaman.';
}
