/**
 * Menggabungkan isi repositori dokumen (KMS) dengan daftar dokumen di basis RAG.
 *
 * ponytail: dua sumber ini menghitung hal yang berbeda. Repositori menyimpan
 * BERKAS yang diunggah lewat aplikasi, sedangkan basis menyimpan DOKUMEN hasil
 * pengindeksan — termasuk dokumen sambutan yang dibuat otomatis saat project
 * repositori dibuat. Akibatnya panel admin menulis "Berkas RAG: 5 berkas"
 * sementara halaman repositori menampilkan 4 baris, dan pengguna mengira ada
 * berkas yang hilang.
 *
 * Modul ini memisahkan bagian yang murni (bisa diuji) dari panggilan jaringan.
 */
import type { BerkasKMS } from '../../types';

/** Awalan nama dokumen sambutan yang dibuat otomatis oleh repositori dokumen. */
export const AWALAN_DOKUMEN_SAMBUTAN = 'Info Project - ';

/** Apakah dokumen ini dokumen sambutan repositori (bukan berkas instansi). */
export function adalahDokumenSambutan(nama: unknown): boolean {
  return String(nama || '').trim().startsWith(AWALAN_DOKUMEN_SAMBUTAN);
}

/** Bentuk minimal dokumen basis yang dipakai penggabungan. */
export interface DokumenBasis {
  id: string;
  nama: string;
  status?: string;
  halaman?: number;
  potongan?: number;
  token?: number;
  dibuat?: string;
}

/** Hasil penggabungan + angka pembanding untuk ditampilkan jujur. */
export interface HasilGabungBasis {
  berkas: BerkasKMS[];
  /** Seluruh dokumen di basis (termasuk sambutan), 0 bila basis tak terbaca. */
  jumlahBasis: number;
  /** Dokumen sambutan yang tidak dihitung sebagai berkas instansi. */
  jumlahSambutan: number;
  /** Dokumen instansi yang berhasil ditambahkan dari basis. */
  jumlahDitambah: number;
  /** Catatan jujur saat angka antarmuka tidak bisa dibuat sama. */
  catatan?: string;
}

/** Nama-nama yang dipakai untuk mengenali berkas yang sama di dua sumber. */
function namaDikenal(b: BerkasKMS): string[] {
  const dasar = String(b.fileUrl || '').split('/').pop() || '';
  return [b.title, dasar, dasar.replace(/^doc-\d+-/, '')]
    .map((x) => String(x || '').trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Gabungkan dokumen basis ke daftar berkas repositori tanpa duplikasi.
 *
 * `dokumen` boleh `null` — artinya basis tidak terbaca (lambat/timeout). Daftar
 * repositori tetap dikembalikan apa adanya, dengan catatan agar pengguna tahu
 * bahwa daftar itu belum lengkap.
 */
export function gabungDokumenBasis(
  berkas: BerkasKMS[],
  dokumen: DokumenBasis[] | null
): HasilGabungBasis {
  if (dokumen === null) {
    return {
      berkas,
      jumlahBasis: 0,
      jumlahSambutan: 0,
      jumlahDitambah: 0,
      catatan:
        'Daftar dokumen di basis sedang tidak bisa dibaca (layanan lambat atau tidak menjawab). ' +
        'Yang tampil hanya berkas yang ada di repositori — segarkan beberapa saat lagi.',
    };
  }

  const semua = Array.isArray(dokumen) ? dokumen : [];
  const sambutan = semua.filter((d) => adalahDokumenSambutan(d?.nama));
  const instansi = semua.filter((d) => !adalahDokumenSambutan(d?.nama));

  const sudahAda = new Set(berkas.flatMap(namaDikenal));
  const tercocok = instansi.filter((d) => sudahAda.has(String(d.nama || '').trim().toLowerCase()));
  const tambahan = instansi
    .filter((d) => !sudahAda.has(String(d.nama || '').trim().toLowerCase()))
    .map<BerkasKMS>((d) => ({
      id: `basis:${d.id}`,
      organizationId: '',
      title: d.nama,
      fileType: String(d.nama || '').split('.').pop()?.toUpperCase(),
      uploadedAt: d.dibuat,
      chunksCount: d.potongan,
      halaman: d.halaman,
      token: d.token,
      ragStatus: d.status === 'completed' ? 'indexed' : d.status,
      hanyaBasis: true,
    }));

  const hasil: HasilGabungBasis = {
    berkas: [...berkas, ...tambahan],
    jumlahBasis: semua.length,
    jumlahSambutan: sambutan.length,
    jumlahDitambah: tambahan.length,
  };

  // Angka di panel admin dan di halaman repositori harus bisa dijelaskan.
  // Dokumen yang sudah tampil sebagai berkas repositori BUKAN "belum tampil".
  const belumTampil = instansi.length - tercocok.length - tambahan.length;
  const bagian: string[] = [];
  if (sambutan.length > 0) {
    bagian.push(
      `${sambutan.length} di antaranya dokumen sambutan repositori (bukan berkas instansi) sehingga tidak dihitung`
    );
  }
  if (belumTampil > 0) {
    bagian.push(`${belumTampil} dokumen belum tampil di daftar — kemungkinan masih diproses`);
  }
  if (bagian.length > 0) {
    hasil.catatan = `Basis dokumen memuat ${semua.length} dokumen: ${bagian.join('; ')}.`;
  }
  return hasil;
}
