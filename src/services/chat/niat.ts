/**
 * Routing niat pesan chat: "buat/perbarui dashboard" vs "tanya jawab biasa".
 *
 * MURNI (tanpa I/O) supaya bisa diuji tanpa server.
 *
 * Kenapa dipisah: regex lama memakai `\b` yang GAGAL pada imbuhan bahasa
 * Indonesia — `\bdashboard\b` tidak cocok dengan "dashboardnya", dan
 * `\bbuatkan\b` tidak cocok dengan "membuatkan". Akibatnya permintaan wajar
 * seperti "oke buatkan saya dashboardnya" salah dirutekan ke chatbot dan
 * dijawab prosa (bukan widget). Di sini imbuhan diakomodasi eksplisit.
 */

/** Kata perintah membuat/memperbarui, termasuk bentuk berimbuhan (mem-/di-/ter-). */
const PERINTAH =
  /(?:^|[^a-z])(?:mem(?:buat|bikin|rancang|susun|sediakan|desain|hasilkan|perbarui|perbaharui)|di(?:buat|bikin|rancang|susun|sediakan|desain|hasilkan|perbarui|perbaharui)|buat|buatkan|bikin|bikinkan|generate|hasilkan|susun|rancang|ciptakan|sediakan|desain|tampilkan|perbarui|perbaharui|update|refresh|tambah(?:kan)?)(?:kan|lah|nya|in)?(?:[^a-z]|$)/i;

/**
 * Objek dashboard, termasuk bentuk berimbuhan/klitik: "dashboardnya",
 * "dashboards", "kanvasnya", "kpi", "laporan".
 */
const OBJEK = /(?:^|[^a-z])(?:dashboard|dashboards|dashboardnya|kanvas|canvas|kpi|laporan)(?:nya|ku|mu)?(?:[^a-z]|$)/i;

/** Kata tanya: kalau ada, pesan cenderung pertanyaan, bukan perintah. */
const TANYA = /(?:^|[^a-z])(?:apa|apakah|bagaimana|gimana|cara|kenapa|mengapa|berapa|siapa|kapan|dimana|mana)(?:[^a-z]|$)/i;

/**
 * Apakah pesan meminta dashboard dibuat/diperbarui?
 *
 * Perintah + objek, dan BUKAN pertanyaan. Contoh yang HARUS true:
 *   "buatkan dashboard", "oke buatkan saya dashboardnya",
 *   "saya ingin kamu membuatkan saya dashboard ... 15-20 widget",
 *   "perbarui dashboard", "bikin kanvas baru".
 * Contoh yang HARUS false (pertanyaan):
 *   "bagaimana cara buat dashboard?", "apa itu dashboard?".
 */
export function niatBuatDashboard(prompt: unknown): boolean {
  const teks = String(prompt || '').toLowerCase();
  if (!teks.trim()) return false;
  if (TANYA.test(teks)) return false;
  return PERINTAH.test(teks) && OBJEK.test(teks);
}
