/**
 * KATEGORI & UNIT KERJA PADA WIDGET.
 *
 * Filter dashboard (Periode / Unit Kerja / Kategori) membaca tiga kolom pada
 * setiap widget: `periode`, `unitKerja`, dan `category`. Sebelum ini `category`
 * diisi tetap "Keuangan" untuk semua widget, sehingga filter Kategori hanya
 * punya satu pilihan dan tidak pernah tampil. Sekarang kategorinya diturunkan
 * dari ISI widget (judul + nama seri dokumen), jadi pilihannya mengikuti
 * dokumen instansi.
 */

export type KategoriDashboard = 'Keuangan' | 'Operasional' | 'Pelayanan' | 'SDM' | 'Kinerja' | 'Umum';

/** Urutan aturan menentukan hasil: yang lebih khas diletakkan lebih dulu. */
const ATURAN: Array<[RegExp, KategoriDashboard]> = [
  [/pegawai|karyawan|sdm|gaji|tunjangan|pelatihan|kompetensi|absen|rekrut/i, 'SDM'],
  [/pendapatan|saldo|laba|kas|biaya|anggaran|beban|modal|utang|piutang|neraca|rkap|profit|revenue|cost|investasi|keuangan|finansial|transaksi|mutasi|pajak|retribusi/i, 'Keuangan'],
  [/pelanggan|pelayanan|layanan|kunjungan|pengunjung|pentalan|konversi|pesanan|situs|trafik|relevansi|frasa|perangkat|halaman/i, 'Pelayanan'],
  [/produksi|pemeliharaan|distribusi|instalasi|kebocoran|nrw|gangguan|peralatan|kendaraan|operasional|pompa/i, 'Operasional'],
  [/target|capaian|kinerja|indikator|kontrak|rkat|reviu|audit|risiko|kepatuhan/i, 'Kinerja'],
];

export function kategoriWidget(judul: unknown, namaSeri: Array<unknown> = []): KategoriDashboard {
  const isi = [judul, ...namaSeri].map((x) => String(x ?? '')).join(' ').toLowerCase();
  for (const [pola, kategori] of ATURAN) if (pola.test(isi)) return kategori;
  return 'Umum';
}

/**
 * Nama unit kerja ringkas untuk filter. Dokumen sering menulis nama panjang
 * dengan singkatan dalam kurung ("Perumda Air Minum Jaya (PAM JAYA)"), dan
 * singkatan itulah yang dipakai orang. Nilai kosong dibiarkan kosong: artinya
 * widget tidak terikat unit tertentu, jadi ikut semua pilihan.
 */
export function unitRingkas(nilai?: string | null): string | undefined {
  const teks = String(nilai ?? '').trim();
  if (!teks) return undefined;
  // "Semua Unit" bukan nama unit — artinya dokumen tidak menyebut unit, jadi
  // filter harus memperlakukannya seperti kosong (ikut semua pilihan).
  if (/^(semua|all|seluruh)(\s+unit(\s+kerja)?)?$/i.test(teks)) return undefined;
  const dalamKurung = teks.match(/\(([^)]{2,})\)/)?.[1]?.trim();
  const hasil = (dalamKurung || teks).replace(/\s+/g, ' ');
  return hasil.slice(0, 32);
}

/**
 * Kategori yang dipakai UI untuk widget LAMA.
 *
 * Widget hasil ekstraksi dokumen versi lama semuanya bertanda "Keuangan" (label
 * tetap waktu itu), jadi kategori tersimpan tidak bisa dipercaya. Aturannya:
 * kalau tersimpan "Keuangan" padahal isinya jelas bukan keuangan, pakai hasil
 * pembacaan isi. Kategori lain (mis. dari katalog, "Kepatuhan & Risiko") tetap
 * dihormati karena memang disengaja.
 */
export function kategoriEfektif(w: {
  category?: string;
  title?: string;
  chart?: { series?: Array<{ name?: string }> };
}): string {
  const tersimpan = String(w.category ?? '').trim();
  const dariIsi = kategoriWidget(w.title, (w.chart?.series || []).map((sr) => sr?.name));
  if (!tersimpan) return dariIsi;
  if (tersimpan.toLowerCase() === 'keuangan' && dariIsi !== 'Keuangan') return dariIsi;
  return tersimpan;
}
