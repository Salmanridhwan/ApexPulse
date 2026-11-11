/**
 * ANGKA RINGKAS GAYA INDONESIA.
 *
 * Angka mulai 100.000 diringkas: 100.000 -> "100 rb", 3.966.100.000 -> "3,97 M",
 * 1.250.000 -> "1,25 jt", 2.000.000.000.000 -> "2 T". Di bawah itu angka tetap
 * utuh dengan pemisah ribuan (12.500 pelanggan tetap "12.500"), supaya hitungan
 * kecil tidak kehilangan ketelitian. Angka lengkap tetap tampil di tooltip.
 */
const TINGKAT: Array<[number, string]> = [
  [1e12, ' T'],
  [1e9, ' M'],
  [1e6, ' jt'],
  [1e3, ' rb'],
];

/** Batas mulai diringkas. */
export const BATAS_RINGKAS = 100_000;

export function angkaRingkas(v: number, desimal = 0): string {
  if (!Number.isFinite(v)) return String(v);
  const mutlak = Math.abs(v);
  if (mutlak >= BATAS_RINGKAS) {
    for (const [batas, akhiran] of TINGKAT) {
      if (mutlak >= batas) {
        const bagi = v / batas;
        // "4 M" untuk angka bulat, "1,3 jt" bila ada pecahan; 2 desimal bila di bawah 10.
        const d = Math.abs(bagi) < 10 ? 2 : 1;
        return `${bagi.toLocaleString('id-ID', { maximumFractionDigits: d })}${akhiran}`;
      }
    }
  }
  return v.toLocaleString('id-ID', { maximumFractionDigits: desimal });
}

/**
 * Teks angka mentah dari dokumen ("3966100000", "-125000") ikut diringkas.
 * Teks lain ("94,8%", "Rp 1,2 M", "12 bulan") dibiarkan apa adanya.
 */
export function teksAngkaRingkas(t: string): string {
  const s = String(t).trim();
  if (!/^-?\d{5,}(\.\d+)?$/.test(s)) return s;
  return angkaRingkas(Number(s));
}
