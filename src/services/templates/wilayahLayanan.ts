/**
 * KINERJA PER WILAYAH LAYANAN — bahan halaman 3 template Ringkasan.
 *
 * Sumbernya satu tabel di dokumen "Laporan Kinerja Operasional dan Pelayanan
 * PAM JAYA 2024": Tabel 3. Kinerja per wilayah layanan. Karena angkanya
 * tersusun rapi di dalam teks potongan dokumen, tabel diurai langsung (bukan
 * ditebak model bahasa) supaya angka yang tampil pasti sama dengan dokumen.
 */

export interface BarisWilayah {
  wilayah: string;
  pelanggan: number;
  airTerjual: number;
  nrw: number;
  pengaduan: number;
  per1000: number | null;
}

export interface SumberWilayah {
  dokumen: string;
  halaman: number;
  cuplikan: string;
  keyakinan: number;
}

export interface NilaiWilayah {
  baris: BarisWilayah[];
  total: BarisWilayah | null;
  catatan: Array<{ wilayah: string; teks: string }>;
  satuanAir: string;
  sumber: SumberWilayah[];
  /** true = angka contoh untuk galeri template. */
  contoh?: boolean;
}

const KOTA = ['Jakarta Pusat', 'Jakarta Utara', 'Jakarta Barat', 'Jakarta Selatan', 'Jakarta Timur'];

/** "74.318.640" → 74318640, "43,85" → 43.85 */
function keAngka(teks: string): number | null {
  const bersih = String(teks || '').replace(/[^\d,.-]/g, '').trim();
  if (!bersih) return null;
  // Titik = pemisah ribuan, koma = desimal (gaya Indonesia).
  const n = Number(bersih.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Urai tabel wilayah dari satu potongan dokumen.
 *
 * Toleran terhadap pemisah: potongan asli memakai tanda "|", tetapi bisa juga
 * datang sebagai spasi saja setelah pembersihan. Baris yang tidak lengkap
 * dilewati, bukan diisi nol.
 */
export function uraiTabelWilayah(teks: string): { baris: BarisWilayah[]; total: BarisWilayah | null } {
  const datar = String(teks || '').replace(/\|/g, ' ').replace(/\s+/g, ' ');
  const baris: BarisWilayah[] = [];
  for (const kota of KOTA) {
    // Contoh: "Jakarta Pusat 186.420 74.318.640 41,20 24.180 129,7"
    const pola = new RegExp(
      `${kota}\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d,.]+)\\s+([\\d.]+)\\s+([\\d,.]+)`,
      'i'
    );
    const m = datar.match(pola);
    if (!m) continue;
    const pelanggan = keAngka(m[1]);
    const airTerjual = keAngka(m[2]);
    const nrw = keAngka(m[3]);
    const pengaduan = keAngka(m[4]);
    if (pelanggan === null || airTerjual === null || nrw === null || pengaduan === null) continue;
    baris.push({
      wilayah: kota,
      pelanggan,
      airTerjual,
      nrw,
      pengaduan,
      per1000: keAngka(m[5]),
    });
  }

  /**
   * Baris "Jumlah" muncul lebih dari sekali di potongan dokumen (ada jumlah
   * bulanan dan jumlah wilayah). Kandidat yang benar adalah yang jumlah
   * pelanggannya sama dengan penjumlahan baris kota di atasnya.
   */
  const jumlahPelanggan = baris.reduce((a, b) => a + b.pelanggan, 0);
  const kandidat: BarisWilayah[] = [];
  const polaJumlah = /Jumlah\s+([\d.]+)\s+([\d.]+)\s+([\d,.]+)\s+([\d.]+)/gi;
  let mj: RegExpExecArray | null;
  while ((mj = polaJumlah.exec(datar))) {
    const pelanggan = keAngka(mj[1]);
    const airTerjual = keAngka(mj[2]);
    const nrw = keAngka(mj[3]);
    const pengaduan = keAngka(mj[4]);
    if (pelanggan === null || airTerjual === null || nrw === null || pengaduan === null) continue;
    kandidat.push({ wilayah: 'Jumlah', pelanggan, airTerjual, nrw, pengaduan, per1000: null });
  }
  const total =
    kandidat.find((k) => Math.abs(k.pelanggan - jumlahPelanggan) <= 1) ?? null;
  return { baris, total };
}

/**
 * Catatan naratif per wilayah, misalnya "Jakarta Utara. Wilayah dengan tekanan
 * paling rendah ...". Diambil apa adanya dari dokumen, bukan dikarang.
 */
export function uraiCatatanWilayah(teks: string): Array<{ wilayah: string; teks: string }> {
  const datar = String(teks || '').replace(/\|/g, ' ').replace(/\s+/g, ' ');
  const hasil: Array<{ wilayah: string; teks: string }> = [];
  for (const kota of KOTA) {
    const pola = new RegExp(`${kota}\\s*\\.\\s*([^.]{15,320}\\.)`, 'i');
    const m = datar.match(pola);
    if (m) hasil.push({ wilayah: kota, teks: m[1].trim() });
  }
  return hasil;
}

/**
 * ANGKA CONTOH untuk galeri template (mode template, bukan data dokumen).
 * Sengaja berbeda dari angka dokumen supaya perbedaannya terlihat jelas.
 */
export const CONTOH_WILAYAH: NilaiWilayah = {
  satuanAir: 'm³',
  contoh: true,
  baris: [
    { wilayah: 'Jakarta Pusat', pelanggan: 214800, airTerjual: 91240000, nrw: 33.4, pengaduan: 18240, per1000: 84.9 },
    { wilayah: 'Jakarta Utara', pelanggan: 196300, airTerjual: 80120000, nrw: 37.8, pengaduan: 21680, per1000: 110.4 },
    { wilayah: 'Jakarta Barat', pelanggan: 233100, airTerjual: 98460000, nrw: 35.6, pengaduan: 22940, per1000: 98.4 },
    { wilayah: 'Jakarta Selatan', pelanggan: 218500, airTerjual: 94680000, nrw: 31.2, pengaduan: 19120, per1000: 87.5 },
    { wilayah: 'Jakarta Timur', pelanggan: 209700, airTerjual: 88340000, nrw: 34.1, pengaduan: 16480, per1000: 78.6 },
  ],
  total: { wilayah: 'Jumlah', pelanggan: 1072400, airTerjual: 452840000, nrw: 34.4, pengaduan: 98460, per1000: null },
  catatan: [
    { wilayah: 'Jakarta Pusat', teks: 'Jaringan paling baru, kehilangan air terendah, pelanggan niaga besar dengan meter terpantau.' },
    { wilayah: 'Jakarta Utara', teks: 'Ujung sistem distribusi, tekanan paling rendah, pipa berumur tua dan terdampak rob.' },
    { wilayah: 'Jakarta Barat', teks: 'Beban pelanggan terbesar, pengaduan didominasi tekanan rendah pada jam puncak.' },
    { wilayah: 'Jakarta Selatan', teks: 'Mutu air paling stabil, gangguan umumnya akibat pekerjaan pihak ketiga.' },
    { wilayah: 'Jakarta Timur', teks: 'Pengaduan per pelanggan terendah, perluasan jaringan masih menjadi prioritas.' },
  ],
  sumber: [],
};

export function ringkasWilayah(nilai: number, satuan: string): string {
  const n = Number(nilai) || 0;
  if (satuan === '%') return `${n.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`;
  if (satuan === 'm³' || satuan === 'm3') {
    if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
    if (n >= 1_000) return `${(n / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} rb`;
    return n.toLocaleString('id-ID');
  }
  return n.toLocaleString('id-ID', { maximumFractionDigits: 1 });
}
