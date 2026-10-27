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
  /(?:^|[^a-z])(?:mem(?:buat|bikin|rancang|susun|sediakan|desain|hasilkan|perbarui|perbaharui)|di(?:buat|bikin|rancang|susun|sediakan|desain|hasilkan|perbarui|perbaharui)|buat|buatkan|bikin|bikinkan|generate|hasilkan|susun|rancang|ciptakan|sediakan|desain|tampilkan|perbarui|perbaharui|update|refresh|isi|lengkapi|penuhi|tambah(?:kan)?)(?:kan|lah|nya|in)?(?:[^a-z]|$)/i;

/**
 * Objek dashboard, termasuk bentuk berimbuhan/klitik: "dashboardnya",
 * "dashboards", "kanvasnya", "kpi", "laporan".
 */
const OBJEK = /(?:^|[^a-z])(?:dashboard|dashboards|dashboardnya|kanvas|canvas|kpi|laporan)(?:nya|ku|mu)?(?:[^a-z]|$)/i;

/** Kata tanya: kalau ada, pesan cenderung pertanyaan, bukan perintah. */
const TANYA = /(?:^|[^a-z])(?:apa|apakah|bagaimana|gimana|cara|kenapa|mengapa|berapa|siapa|kapan|dimana|mana)(?:[^a-z]|$)/i;

/**
 * Jawaban SINGKAT yang menyetujui tawaran sebelumnya: "oke buatkan",
 * "ya silakan buatkan", "sip gas bikin".
 *
 * Dulu pesan seperti ini TIDAK dianggap perintah dashboard (tidak menyebut kata
 * "dashboard"), sehingga jatuh ke jalur tanya-jawab, kena batas waktu RAG, dan
 * dashboard tidak pernah dibuat — pengguna melihat balasan "berhenti".
 */
const KONFIRMASI_BUAT =
  /^\s*(?:oke|ok|okey|okay|ya|yah|yup|sip|siap|boleh|silakan|silahkan|gas|lanjut|ayo|mangga|monggo|setuju|betul|benar|baik|good)[\s,.:!-]*(?:\S+\s+){0,3}?(?:buat(?:kan|in)?|bikin(?:kan)?|generate|kerjakan|eksekusi|lanjutkan)\b/i;

/** Pesan yang HANYA berisi kata perintah: "buatkan", "gas", "lanjut". */
const HANYA_PERINTAH =
  /^\s*(?:oke\s+|ya\s+|sip\s+)?(?:buat(?:kan|in)?|bikin(?:kan)?|gas|lanjut(?:kan)?|kerjakan|eksekusi)(?:\s+(?:saja|aja|dong|ya|deh))?\s*[.!]*\s*$/i;

/**
 * Apakah pesan meminta dashboard dibuat/diperbarui?
 *
 * Perintah + objek, dan BUKAN pertanyaan. Contoh yang HARUS true:
 *   "buatkan dashboard", "oke buatkan saya dashboardnya",
 *   "saya ingin kamu membuatkan saya dashboard ... 15-20 widget",
 *   "perbarui dashboard", "bikin kanvas baru",
 *   "oke buatkan" (menyetujui tawaran asisten sebelumnya), "buatkan".
 * Contoh yang HARUS false (pertanyaan):
 *   "bagaimana cara buat dashboard?", "apa itu dashboard?".
 */
export function niatBuatDashboard(prompt: unknown): boolean {
  const teks = String(prompt || '').toLowerCase();
  if (!teks.trim()) return false;
  // Konfirmasi singkat diperiksa lebih dulu: kalimatnya tidak menyebut objek
  // ("dashboard") karena objeknya ada di pesan asisten sebelumnya.
  if (KONFIRMASI_BUAT.test(teks) || HANYA_PERINTAH.test(teks)) return true;
  if (TANYA.test(teks)) return false;
  return PERINTAH.test(teks) && OBJEK.test(teks);
}

/**
 * Kata perintah MENAMBAH widget, termasuk bentuk berimbuhan.
 *
 * Sengaja mencakup `buat(?:kan)?` juga: pengguna sering menulis "buatkan
 * widgetnya" — dulu kata ini tidak dikenali sehingga permintaan jatuh ke jalur
 * chatbot dan dijawab prosa (bahkan kode HTML mentah), bukan menambah widget.
 */
const PERINTAH_WIDGET =
  /(?:^|[^a-z])(?:tambah(?:kan)?|tambahin|buat(?:kan)?|bikin(?:kan)?|masukkan|sematkan|sisipkan|pasang)(?:kan|lah|in)?(?:[^a-z]|$)/i;

/**
 * Objek widget, termasuk klitik: "widgetnya", "chartnya", "grafiknya".
 * `\b` TIDAK dipakai karena gagal pada imbuhan Indonesia (mis. `\bwidget\b`
 * tidak cocok dengan "widgetnya") — itu akar bug "chart tidak masuk dashboard".
 */
const OBJEK_WIDGET =
  /(?:^|[^a-z])(?:widget|chart|grafik|kartu|panel|diagram)(?:nya|ku|mu)?(?:[^a-z]|$)/i;

/**
 * Apakah pesan meminta widget/chart DITAMBAHKAN ke kanvas?
 * Contoh yang HARUS true: "tambahkan widget jumlah pelanggan",
 *   "buatkan widgetnya untuk kurun waktu 2021-2024 saja", "bikin chart laba".
 * Contoh yang HARUS false: "buatkan dashboard", "apa itu widget?".
 */
export function niatTambahWidget(prompt: unknown): boolean {
  const teks = String(prompt || '').toLowerCase();
  if (!teks.trim()) return false;
  if (!PERINTAH_WIDGET.test(teks) || !OBJEK_WIDGET.test(teks)) return false;
  // "buatkan dashboard berisi grafik garis" menyebut grafik, tetapi yang diminta
  // adalah DASHBOARD. Dulu kalimat ini dibajak jalur tambah-widget dan mentok
  // di "Buka dulu salah satu dashboard". Kata kerja menambah ("tambahkan
  // grafik ke dashboard") tetap masuk jalur widget.
  const buatDashboard =
    /(?:^|[^a-z])(?:buat(?:kan)?|bikin(?:kan)?|susun|rancang|desain|ciptakan|sediakan|generate|hasilkan|mem(?:buat|bikin|rancang|susun|sediakan|desain|hasilkan))(?:kan|lah|nya|in)?(?:[^a-z]|$)/i;
  const objekDashboard = /(?:^|[^a-z])(?:dashboard|kanvas|canvas)(?:nya|ku|mu)?(?:[^a-z]|$)/i;
  if (buatDashboard.test(teks) && objekDashboard.test(teks)) return false;
  return true;
}

/**
 * Ambil indikator dari perintah "tambah widget <indikator>".
 *
 * Membuang kata perintah + objek widget di depan, embel-embel tujuan
 * ("ke dashboard"), dan kata sambung pengantar ("untuk", "dengan", ...).
 * Mengembalikan string kosong bila tidak ada sisa indikator.
 */
export function indikatorTambahWidget(prompt: unknown): string {
  return String(prompt || '')
    .replace(
      /^.*?(?:tambah(?:kan)?|tambahin|buat(?:kan)?|bikin(?:kan)?|masukkan|sematkan|sisipkan|pasang)(?:kan|lah|in)?\s+(?:widget|chart|grafik|kartu|panel|diagram)(?:nya|ku|mu)?/i,
      ''
    )
    .replace(/\b(?:ke|kedalam|ke dalam|pada|dalam)\s+(?:dashboard|kanvas|canvas)\b.*$/i, '')
    .replace(/^\s*(?:untuk|buat|dengan|mengenai|tentang|soal|berisi|menampilkan|yang)\s+/i, '')
    .replace(/["'“”]/g, '')
    .trim();
}

/**
 * Apakah teks hanya KETERANGAN PERIODE tanpa subjek?
 *
 * Contoh true: "kurun waktu 2021-2024 saja", "tahun 2023", "periode 2021-2024".
 * Contoh false: "laba bersih 2021-2024", "jumlah pelanggan", "NPL".
 *
 * Dipakai untuk menyelamatkan perintah lanjutan seperti "buatkan widgetnya
 * untuk kurun waktu 2021-2024 saja" — subjeknya ada di pesan sebelumnya, bukan
 * di kalimat ini. Tanpa ini, RAG ditanya "kurun waktu 2021-2024 saja" dan
 * tidak menemukan indikator apa pun, sehingga widget tak pernah muncul.
 */
export function hanyaKeteranganPeriode(teks: unknown): boolean {
  const t = String(teks || '').toLowerCase();
  if (!t.trim()) return true;
  const sisa = t
    .replace(
      /\b(?:kurun|waktu|periode|rentang|tahun|thn|tahunan|bulan|bulanan|triwulan|kuartal|semester|saja|aja|dong|ya|sih|dari|sampai|hingga|sd|s\.d|s\/d)\b/g,
      ' '
    )
    .replace(/\bq[1-4]\b/g, ' ')
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .replace(/[0-9\-/–—.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return sisa.length < 3;
}
