/**
 * Pembatas percobaan login (in-memory, tanpa dependensi).
 *
 * ponytail: cukup penghitung per kunci (IP+email) dengan jendela waktu tetap.
 * Bukan Redis, bukan sliding window — tujuannya menghentikan tebak-password
 * otomatis, bukan menyimpan statistik. Kalau nanti jalan >1 instance, batas
 * per-instance tetap memotong laju tebakan (bukan keamanan sempurna, tapi
 * jauh lebih baik daripada tanpa batas sama sekali).
 */

export interface HasilCek {
  boleh: boolean;
  /** Sisa detik sebelum boleh mencoba lagi (0 bila boleh). */
  tungguDetik: number;
  /** Sisa percobaan yang masih diizinkan pada jendela ini. */
  sisa: number;
}

export interface Pembatas {
  cek(kunci: string, sekarang?: number): HasilCek;
  /** Catat percobaan gagal. */
  gagal(kunci: string, sekarang?: number): void;
  /** Hapus hitungan setelah login berhasil. */
  bersihkan(kunci: string): void;
  /** Buang entri kedaluwarsa supaya memori tidak tumbuh tanpa batas. */
  sapu(sekarang?: number): void;
  readonly ukuran: number;
}

interface Catatan {
  jumlah: number;
  resetPada: number;
}

export function buatPembatas(batas = 10, jendelaMs = 15 * 60 * 1000): Pembatas {
  const data = new Map<string, Catatan>();

  const ambil = (kunci: string, sekarang: number): Catatan => {
    const ada = data.get(kunci);
    if (!ada || ada.resetPada <= sekarang) {
      const baru: Catatan = { jumlah: 0, resetPada: sekarang + jendelaMs };
      data.set(kunci, baru);
      return baru;
    }
    return ada;
  };

  return {
    cek(kunci, sekarang = Date.now()): HasilCek {
      const c = ambil(kunci, sekarang);
      const tungguDetik = Math.max(0, Math.ceil((c.resetPada - sekarang) / 1000));
      if (c.jumlah >= batas) return { boleh: false, tungguDetik, sisa: 0 };
      return { boleh: true, tungguDetik: 0, sisa: batas - c.jumlah };
    },
    gagal(kunci, sekarang = Date.now()) {
      const c = ambil(kunci, sekarang);
      c.jumlah += 1;
    },
    bersihkan(kunci) {
      data.delete(kunci);
    },
    sapu(sekarang = Date.now()) {
      for (const [kunci, c] of data) {
        if (c.resetPada <= sekarang) data.delete(kunci);
      }
    },
    get ukuran() {
      return data.size;
    },
  };
}
