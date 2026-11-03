/**
 * NAMA SETARA INDIKATOR.
 *
 * Kalimat pengguna dan segmen bawaan memakai nama umum ("beban usaha"),
 * sedangkan dokumen BUMD sering memakai nama lain ("beban operasional"). Pada
 * mode ketat RAG hanya boleh mengambil indikator yang diminta persis, jadi
 * tanpa nama setara indikator yang sebenarnya ada dilaporkan "tidak ada di
 * dokumen" (uji RAG asli 3 Nov 2026: 10 dari 22 indikator). Daftar ini dikirim
 * ke RAG sebagai nama lain yang boleh dipakai, bukan sebagai indikator lain.
 */

const SETARA: Array<[RegExp, string]> = [
  [/beban usaha/, 'beban operasional'],
  [/pendapatan usaha/, 'pendapatan operasional'],
  [/arus kas operasi/, 'arus kas dari aktivitas operasi'],
  [/volume produksi air|produksi air/, 'air diproduksi'],
  [/volume produksi air|produksi air/, 'air terproduksi'],
  [/kapasitas produksi terpasang/, 'kapasitas terpasang'],
  [/jam operasi pelayanan/, 'kontinuitas pengaliran (jam per hari)'],
  [/waktu penyelesaian pengaduan/, 'rata-rata hari penyelesaian pengaduan'],
  [/jumlah pengaduan pelanggan/, 'jumlah pengaduan'],
  [/pelayanan/, 'layanan'],
  [/komposisi/, 'rincian'],
  [/nrw \(kehilangan air\)|\bnrw\b/, 'tingkat kehilangan air'],
  [/jumlah pelanggan/, 'jumlah sambungan'],
];

/** Nama lain indikator `butir` yang lazim di dokumen BUMD (tanpa nama aslinya). */
export function namaSetara(butir: string): string[] {
  const b = String(butir ?? '').toLowerCase().trim();
  const hasil = new Set<string>();
  for (const [pola, ganti] of SETARA) if (pola.test(b)) hasil.add(b.replace(pola, ganti));
  hasil.delete(b);
  return [...hasil];
}
