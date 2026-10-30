const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/**
 * Label tanggal ringkas untuk deret harian: "1 Okt", "2 Okt", dan seterusnya,
 * berakhir di `akhir` (bawaan: hari ini).
 *
 * Dipakai saat dokumen hanya menyebut angka tanpa label tanggal. Tanpa ini,
 * sumbu X jatuh ke nomor urut 1, 2, 3 yang tidak berarti apa-apa bagi pembaca.
 */
export const labelHarian = (jumlah: number, akhir: Date = new Date()): string[] => {
  const hasil: string[] = [];
  for (let i = jumlah - 1; i >= 0; i -= 1) {
    const t = new Date(akhir.getFullYear(), akhir.getMonth(), akhir.getDate() - i);
    hasil.push(`${t.getDate()} ${BULAN_SINGKAT[t.getMonth()]}`);
  }
  return hasil;
};
