import { TataLetakBaris } from '../types';

/**
 * URUTAN KARTU PADA SATU BARIS DESAIN TEMPLATE.
 *
 * Id yang sudah tercatat dipakai lebih dulu sesuai urutan simpanan, sisanya
 * (kartu baru atau id yang tidak dikenal) mengikuti urutan asli di komponen.
 * Dengan begitu tata letak lama tanpa simpanan tetap tampil seperti desain asli.
 */
export const urutkanKartu = (ids: string[], urut?: string[]): string[] => {
  if (!urut?.length) return ids;
  const dikenal = urut.filter((id) => ids.includes(id));
  const sisa = ids.filter((id) => !dikenal.includes(id));
  return [...dikenal, ...sisa];
};

/** Lebar kartu dalam satuan kolom grid, dibatasi 1..jumlahKolom. */
export const lebarKartu = (id: string, kolom: number, tataLetak?: TataLetakBaris): number => {
  const nilai = tataLetak?.lebar?.[id];
  if (!nilai || !Number.isFinite(nilai)) return 1;
  return Math.min(Math.max(Math.round(nilai), 1), Math.max(kolom, 1));
};

/** Susun tata letak baru setelah satu kartu digeser ke posisi kartu lain. */
export const geserKartu = (
  ids: string[],
  idDiseret: string,
  idTujuan: string,
  tataLetak?: TataLetakBaris
): TataLetakBaris => {
  const urut = urutkanKartu(ids, tataLetak?.urut).filter((id) => id !== idDiseret);
  const posisi = urut.indexOf(idTujuan);
  const baru = [...urut];
  baru.splice(posisi < 0 ? baru.length : posisi, 0, idDiseret);
  return { ...tataLetak, urut: baru };
};

/** Susun tata letak baru setelah lebar satu kartu diubah. */
export const ubahLebarKartu = (
  id: string,
  lebarBaru: number,
  kolom: number,
  tataLetak?: TataLetakBaris
): TataLetakBaris => ({
  ...tataLetak,
  lebar: { ...(tataLetak?.lebar || {}), [id]: Math.min(Math.max(lebarBaru, 1), Math.max(kolom, 1)) },
});

/** Susun tata letak baru setelah tinggi satu kartu diubah (piksel, 56..900). */
export const ubahTinggiKartu = (
  id: string,
  tinggiBaru: number,
  tataLetak?: TataLetakBaris
): TataLetakBaris => ({
  ...tataLetak,
  tinggi: {
    ...(tataLetak?.tinggi || {}),
    [id]: Math.min(Math.max(Math.round(tinggiBaru), 56), 900),
  },
});
