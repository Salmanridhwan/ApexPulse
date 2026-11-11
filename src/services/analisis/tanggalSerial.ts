/**
 * KOLOM TANGGAL DARI SPREADSHEET.
 *
 * Excel menyimpan tanggal sebagai nomor seri (46093 = 12 Mar 2026). Tanpa
 * penanganan khusus, kolom seperti "TGL SPK" atau "Deadline" terbaca sebagai
 * besaran dan digrafikkan sebagai batang setinggi 46 ribu. Kolom seperti itu
 * diubah menjadi jumlah baris per bulan, sehingga bisa dipakai sebagai sumbu
 * waktu tanpa membuang barisnya.
 */

const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Rentang nomor seri yang dianggap tanggal: 1 Jan 2000 sampai 31 Des 2100. */
const SERI_MIN = 36526;
const SERI_MAKS = 73415;

const JUDUL_TANGGAL = /\b(tgl|tanggal|deadline|date|jatuh\s*tempo|tenggat|batas\s*waktu)\b/i;

/** Nomor seri Excel ke Date (UTC). */
export function dariSeri(n: number): Date {
  return new Date(Math.round((n - 25569) * 86400000));
}

/**
 * Judul kolom yang tersimpan sebagai TANGGAL, bukan teks bulan. Excel mengubah
 * ketikan "Des 1" menjadi tanggal 1 Des 2001 (tampil "Dec-01"), sehingga kolom
 * bulan itu tidak dikenali pola teks. Mengembalikan nama bulan ("Des") bila
 * nilainya bilangan bulat dalam rentang nomor seri, selain itu null.
 */
export function bulanDariSeri(v: unknown): string | null {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < SERI_MIN || v > SERI_MAKS) return null;
  return NAMA_BULAN[dariSeri(v).getUTCMonth()];
}

/** "12 Mar 2026". */
export function teksTanggal(d: Date): string {
  return `${d.getUTCDate()} ${NAMA_BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Kolom ini berisi tanggal bila judulnya menyebut tanggal dan sedikitnya 80%
 * nilainya bilangan dalam rentang nomor seri. Judul wajib ikut menentukan,
 * karena angka 40.000-an juga lazim sebagai nilai rupiah atau volume.
 */
export function kolomTanggal(judul: string, nilai: number[]): boolean {
  if (!JUDUL_TANGGAL.test(String(judul || ''))) return false;
  if (nilai.length === 0) return false;
  const cocok = nilai.filter((v) => Number.isFinite(v) && v >= SERI_MIN && v <= SERI_MAKS).length;
  return cocok / nilai.length >= 0.8;
}

/**
 * Jumlah baris per bulan, urut waktu. Nilai di luar rentang seri dilewati.
 * `rentang` berisi tanggal pertama dan terakhir untuk sitasi.
 */
export function jumlahPerBulan(nilai: number[]): {
  kategori: string[];
  data: number[];
  rentang: string | null;
} {
  const perBulan = new Map<number, number>();
  const tanggal: Date[] = [];
  for (const v of nilai) {
    if (!Number.isFinite(v) || v < SERI_MIN || v > SERI_MAKS) continue;
    const d = dariSeri(v);
    tanggal.push(d);
    const kunci = d.getUTCFullYear() * 12 + d.getUTCMonth();
    perBulan.set(kunci, (perBulan.get(kunci) ?? 0) + 1);
  }
  const kunci = [...perBulan.keys()].sort((a, b) => a - b);
  tanggal.sort((a, b) => a.getTime() - b.getTime());
  return {
    kategori: kunci.map((k) => `${NAMA_BULAN[k % 12]} ${Math.floor(k / 12)}`),
    data: kunci.map((k) => perBulan.get(k)!),
    rentang: tanggal.length ? `${teksTanggal(tanggal[0])} s.d. ${teksTanggal(tanggal[tanggal.length - 1])}` : null,
  };
}
