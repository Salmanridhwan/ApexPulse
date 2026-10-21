/**
 * PASANGAN WARNA UNTUK GRAFIK DUA SERI (mis. Target vs Realisasi).
 *
 * Kenapa ada berkas ini: semua grafik dua seri dulu memakai warna yang sama
 * (biru + kuning) karena warna seri ditulis mati saat data dibuat. Akibatnya
 * setiap dashboard terlihat seragam. Di sini pasangan dipilih bergiliran
 * berdasarkan posisi kartu, jadi dua grafik bersebelahan tidak pernah memakai
 * pasangan yang sama.
 *
 * Syarat tiap pasangan: dua warna yang saling kontras (beda hue jauh) dan tetap
 * terbaca di atas latar gelap maupun terang.
 */
export const PASANGAN_WARNA: ReadonlyArray<readonly [string, string]> = [
  ['#a78bfa', '#2dd4bf'], // ungu · toska
  ['#f472b6', '#60a5fa'], // merah muda · biru
  ['#4ade80', '#f97316'], // hijau · jingga
  ['#facc15', '#8b5cf6'], // kuning · violet
  ['#22d3ee', '#fb7185'], // sian muda · merah rose
  ['#38c6e2', '#f5b544'], // sian · kuning ambar (paling akhir, jangan dominan)
];

/** Pasangan warna stabil untuk satu kartu (seed = posisi kartu di kanvas). */
export function pasanganUntuk(seed: number): readonly [string, string] {
  const n = PASANGAN_WARNA.length;
  return PASANGAN_WARNA[((seed % n) + n) % n];
}
