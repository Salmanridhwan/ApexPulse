/**
 * Pembatas percobaan lintas-instance.
 *
 * ponytail: `buatPembatas` (rateLimit.ts) menyimpan hitungan di memori proses.
 * Di produksi ada dua host berbagi satu domain, jadi penyerang yang diarahkan
 * bergantian ke host A dan host B mendapat dua kali jatah percobaan — batas
 * 10 percobaan/15 menit menjadi 20, dan dengan N host menjadi N×batas.
 *
 * Modul ini memakai penyimpan bersama (tabel MySQL) sebagai sumber hitungan,
 * dengan pembatas memori sebagai CADANGAN: kalau database sesaat tidak bisa
 * dihubungi, login tetap dibatasi (tidak terbuka bebas).
 */

import { HasilCek, Pembatas } from './rateLimit';

export interface CatatanPercobaan {
  jumlah: number;
  /** Epoch ms kapan jendela hitungan berakhir. */
  resetPada: number;
}

/** Penyimpan bersama (mis. tabel MySQL). Semua fungsi boleh melempar galat. */
export interface PenyimpanPercobaan {
  baca(kunci: string): Promise<CatatanPercobaan | null>;
  /** Tambah satu percobaan gagal secara atomik, kembalikan hitungan terbaru. */
  naikkan(kunci: string, jendelaMs: number): Promise<CatatanPercobaan>;
  hapus(kunci: string): Promise<void>;
}

export interface PembatasLintas extends Pembatas {
  cek(kunci: string, sekarang?: number): HasilCek;
  /** Versi asinkron yang benar-benar membaca penyimpan bersama. */
  cekLintas(kunci: string): Promise<HasilCek>;
  gagalLintas(kunci: string): Promise<void>;
  bersihkanLintas(kunci: string): Promise<void>;
}

export function buatPembatasLintas(opsi: {
  batas: number;
  jendelaMs: number;
  simpan: PenyimpanPercobaan;
  /** Pembatas memori yang dipakai bila penyimpan bersama gagal. */
  cadangan: Pembatas;
  /** Pencatat galat (default console.warn). */
  catat?: (pesan: string) => void;
}): PembatasLintas {
  const { batas, jendelaMs, simpan, cadangan } = opsi;
  const catat = opsi.catat || ((p: string) => console.warn(p));

  const hasilDari = (c: CatatanPercobaan | null, sekarang: number): HasilCek => {
    if (!c || c.resetPada <= sekarang) return { boleh: true, tungguDetik: 0, sisa: batas };
    const tungguDetik = Math.max(0, Math.ceil((c.resetPada - sekarang) / 1000));
    if (c.jumlah >= batas) return { boleh: false, tungguDetik, sisa: 0 };
    return { boleh: true, tungguDetik: 0, sisa: batas - c.jumlah };
  };

  return {
    // Bagian sinkron hanya melihat memori: dipakai bila pemanggil tidak bisa await.
    cek: (kunci, sekarang = Date.now()) => cadangan.cek(kunci, sekarang),
    gagal: (kunci, sekarang = Date.now()) => cadangan.gagal(kunci, sekarang),
    bersihkan: (kunci) => cadangan.bersihkan(kunci),
    sapu: (sekarang = Date.now()) => cadangan.sapu(sekarang),
    get ukuran() {
      return cadangan.ukuran;
    },

    async cekLintas(kunci) {
      const sekarang = Date.now();
      try {
        const c = await simpan.baca(kunci);
        return hasilDari(c, sekarang);
      } catch (err: any) {
        catat(`[batas] gagal membaca hitungan bersama (${err?.message || err}) — memakai hitungan lokal.`);
        return cadangan.cek(kunci, sekarang);
      }
    },

    async gagalLintas(kunci) {
      try {
        await simpan.naikkan(kunci, jendelaMs);
      } catch (err: any) {
        catat(`[batas] gagal mencatat percobaan ke database (${err?.message || err}) — dicatat lokal.`);
        cadangan.gagal(kunci);
      }
    },

    async bersihkanLintas(kunci) {
      try {
        await simpan.hapus(kunci);
      } catch (err: any) {
        catat(`[batas] gagal menghapus hitungan di database (${err?.message || err}).`);
      }
      // Hitungan lokal juga dibersihkan supaya tidak "tersisa" saat DB kembali.
      cadangan.bersihkan(kunci);
    },
  };
}
