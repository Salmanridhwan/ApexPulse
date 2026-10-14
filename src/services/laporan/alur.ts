/**
 * Alur verifikasi bertingkat untuk pelaporan periodik.
 *
 * Fungsi di sini MURNI (tanpa I/O) supaya rantai persetujuan bisa diuji tanpa
 * server: siapa yang berhak menyetujui, tahap mana yang sedang aktif, dan
 * kapan sebuah laporan dianggap tuntas.
 *
 * Prinsip:
 * - **Posisi dihitung, bukan disimpan.** Yang tersimpan hanya riwayat aksi
 *   (append-only), jadi tidak ada "status tahap" yang bisa melenceng dari
 *   riwayatnya.
 * - **Tahap diselesaikan berurutan.** Menyetujui tahap 2 sebelum tahap 1
 *   ditolak, bukan diterima diam-diam.
 * - **Satu peran boleh menangani beberapa tahap.** Bila dua tahap berturut-turut
 *   diperuntukkan bagi peran yang sama, keduanya boleh diselesaikan berurutan
 *   oleh orang yang sama — tidak ada tahap yang tersangkut selamanya.
 * - **Admin selalu boleh** (pengelola instalasi), tapi tanpa peran yang cocok
 *   pun tahap tidak bisa dilewati oleh orang sembarangan.
 */
import type {
  AksiVerifikasi,
  AlurVerifikasi,
  LaporanPeriodik,
  PosisiVerifikasi,
  TahapAlur,
  UserRole,
} from '../../types';

/** Alur bawaan bila instansi belum mendefinisikan alurnya sendiri. */
export const ALUR_BAWAAN: TahapAlur[] = [
  { urutan: 1, nama: 'Verifikasi', peran: 'analis' },
  { urutan: 2, nama: 'Persetujuan', peran: 'direksi' },
];

/** Label manusiawi peran. */
export const LABEL_PERAN: Record<UserRole, string> = {
  admin: 'Admin',
  analis: 'Analis',
  direksi: 'Direksi',
};

/**
 * Normalisasi peran dari sesi (bertipe `string`) menjadi `UserRole`.
 * Nilai tak dikenal diperlakukan sebagai `analis` — peran paling terbatas,
 * supaya kesalahan data tidak pernah menaikkan hak akses.
 */
export function normalisasiPeran(peran: unknown): UserRole {
  return peran === 'admin' || peran === 'direksi' || peran === 'analis' ? peran : 'analis';
}

/**
 * Tahap efektif sebuah laporan: pakai alur instansi bila ada & valid,
 * kalau tidak jatuh ke `ALUR_BAWAAN`. Selalu mengembalikan daftar yang sudah
 * terurut dan hanya memuat tahap yang masuk akal (nama non-kosong).
 */
export function tahapEfektif(
  laporan: Pick<LaporanPeriodik, 'alurId'>,
  daftarAlur: AlurVerifikasi[]
): TahapAlur[] {
  const alur = laporan.alurId ? daftarAlur.find((a) => a.id === laporan.alurId) : undefined;
  const sumber = alur?.tahap?.length ? alur.tahap : ALUR_BAWAAN;
  return sumber
    .filter((t) => t && typeof t.nama === 'string' && t.nama.trim())
    .map((t) => ({ urutan: Number(t.urutan) || 0, nama: String(t.nama).trim(), peran: t.peran }))
    .sort((a, b) => a.urutan - b.urutan);
}

/**
 * Hitung posisi sebuah laporan di rantai verifikasinya.
 *
 * `riwayat` boleh tidak ada (laporan lama) — diperlakukan sebagai belum ada
 * tahap yang disetujui, jadi tidak ada kesimpulan palsu "sudah disetujui".
 */
export function hitungPosisi(
  laporan: Pick<LaporanPeriodik, 'alurId' | 'status' | 'riwayatVerifikasi'>,
  daftarAlur: AlurVerifikasi[]
): PosisiVerifikasi {
  const tahap = tahapEfektif(laporan, daftarAlur);
  const riwayat = Array.isArray(laporan.riwayatVerifikasi) ? laporan.riwayatVerifikasi : [];

  // Bila ada aksi revisi yang belum diikuti pengiriman ulang, rantai berhenti.
  const kiriman = riwayat.filter((a) => a.aksi === 'kirim');
  const kirimanTerakhir = kiriman.length > 0 ? kiriman[kiriman.length - 1] : undefined;
  const revisiSetelahKirim = kirimanTerakhir
    ? riwayat.some(
        (a) =>
          a.aksi === 'revisi' &&
          new Date(a.pada).getTime() >= new Date(kirimanTerakhir.pada).getTime()
      )
    : laporan.status === 'revisi';

  // Setujui yang terjadi SETELAH pengiriman terakhir (percobaan saat ini saja).
  const batas = kirimanTerakhir ? new Date(kirimanTerakhir.pada).getTime() : -Infinity;
  const disetujui = new Set<number>(
    riwayat
      .filter((a) => a.aksi === 'setujui' && new Date(a.pada).getTime() >= batas)
      .map((a) => a.urutan)
  );

  let selesai = 0;
  for (const t of tahap) {
    if (disetujui.has(t.urutan)) selesai++;
    else break;
  }

  const tuntas = tahap.length > 0 && selesai >= tahap.length;
  const perluRevisi = revisiSetelahKirim && !tuntas;
  const tahapAktif = perluRevisi || tuntas ? null : tahap[selesai] || null;

  return { selesai, total: tahap.length, tahapAktif, tuntas, perluRevisi };
}

/** Apakah peran ini berhak menyelesaikan tahap tertentu? Admin selalu boleh. */
export function bolehMenyetujui(peran: UserRole, tahap: TahapAlur): boolean {
  if (peran === 'admin') return true;
  return tahap.peran === peran;
}

/**
 * Peran apa saja yang bisa menyelesaikan tahap aktif sekarang.
 * Dipakai UI untuk memutuskan tombol Setujui/Revisi tampil atau tidak.
 */
export function peranBerhak(tahap: TahapAlur | null): UserRole[] {
  if (!tahap) return [];
  const set = new Set<UserRole>([tahap.peran, 'admin']);
  return [...set];
}

/**
 * Validasi definisi alur yang dikirim admin.
 * Mengembalikan pesan galat (Bahasa Indonesia) atau `null` bila sah.
 */
export function validasiAlur(tahap: unknown): string | null {
  if (!Array.isArray(tahap) || tahap.length === 0) {
    return 'Alur verifikasi wajib punya minimal satu tahap.';
  }
  if (tahap.length > 5) return 'Alur verifikasi maksimal 5 tahap.';
  const urutan = new Set<number>();
  for (const t of tahap) {
    if (!t || typeof t !== 'object') return 'Ada tahap yang tidak valid.';
    const nama = String((t as any).nama || '').trim();
    if (!nama) return 'Setiap tahap wajib punya nama.';
    if (nama.length > 60) return `Nama tahap "${nama.slice(0, 20)}…" terlalu panjang (maks 60).`;
    const peran = (t as any).peran;
    if (!['admin', 'analis', 'direksi'].includes(peran)) {
      return `Peran tahap "${nama}" tidak dikenal.`;
    }
    const u = Number((t as any).urutan);
    if (!Number.isFinite(u) || u < 1) return `Urutan tahap "${nama}" tidak valid.`;
    if (urutan.has(u)) return `Urutan tahap ${u} dipakai dua kali.`;
    urutan.add(u);
  }
  return null;
}

/** Buat satu aksi verifikasi baru (dipakai server saat menyimpan). */
export function buatAksi(
  aksi: AksiVerifikasi['aksi'],
  urutan: number,
  oleh: { userId: string; name: string; role: UserRole },
  catatan?: string
): AksiVerifikasi {
  return {
    urutan,
    aksi,
    oleh: oleh.name,
    olehId: oleh.userId,
    peran: oleh.role,
    catatan: catatan && catatan.trim() ? catatan.trim() : undefined,
    pada: new Date().toISOString(),
  };
}
