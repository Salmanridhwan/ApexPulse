/**
 * ANTREAN ANALISIS OTOMATIS — dokumen dibaca sendiri begitu masuk.
 *
 * Dulu analisis hanya jalan kalau admin menekan "Analisis isi dokumen" di satu
 * permintaan. Akibatnya data yang sudah diunggah pengguna tidak terbaca sampai
 * ada yang ingat mengklik, dan angka di Katalog Data tetap kosong.
 *
 * Modul ini menaruh pekerjaan analisis di antrean latar belakang:
 *
 * - **Sekali per berkas.** Kunci `tenantId|berkasId` mencegah dokumen yang sama
 *   diantrekan dua kali (unggah + permintaan yang menautkannya, atau dua
 *   permintaan berbeda memakai berkas yang sama).
 * - **Maksimal 2 berjalan bersamaan.** Layanan RAG membalas 429 kalau dipanggil
 *   lebih dari itu, dan kegagalan 429 membakar kuota tanpa menghasilkan butir.
 * - **Antrean dibatasi.** Kalau antrean penuh, pekerjaan baru ditolak dan
 *   dihitung `dilewati` — lebih baik ditolak dengan jujur daripada menumpuk
 *   ribuan pekerjaan yang tidak akan pernah jalan.
 * - **Kuota tetap dihormati.** Modul ini tidak memutuskan kuota; `jalankan`
 *   (yang disuntikkan) memakai aturan `antrean.ts`: habis kuota = status
 *   `tertunda-kuota`, bukan gagal.
 *
 * Semua keadaan ada di memori proses: setelah server hidup ulang, dokumen yang
 * belum terbaca akan diantrekan lagi saat daftar berkas dibaca (lihat
 * `pulihkanAntrean`), karena hasil analisis yang sudah ada tetap tersimpan di DB.
 */

/** Pekerjaan analisis satu dokumen. */
export interface PekerjaanAnalisis {
  tenantId: string;
  berkasId: string;
  judulBerkas: string;
  /** Diisi bila dokumen ini terlampir pada permintaan data. */
  permintaanId?: string;
  /** `unggah` = dokumen baru masuk; `segarkan` = dokumen lama perlu dibaca ulang. */
  sebab: 'unggah' | 'segarkan';
}

/** Hasil satu pekerjaan — dipakai untuk menghitung dan mencatat log. */
export interface HasilPekerjaan {
  status: string;
  pesan?: string;
}

export interface KetergantunganAntrean {
  /** Menjalankan analisis sungguhan (RAG + simpan). */
  jalankan: (pekerjaan: PekerjaanAnalisis) => Promise<HasilPekerjaan>;
  /** Pencatat log; dipisah supaya uji tidak menulis ke konsol produksi. */
  log?: (pesan: string) => void;
}

/** Berapa analisis boleh berjalan bersamaan. Sama dengan aturan `antrean.ts`. */
export const BATAS_PARALEL = 2;

/** Batas panjang antrean; sisanya ditolak dan dihitung `dilewati`. */
export const BATAS_ANTREAN = 200;

interface Keadaan {
  antrean: PekerjaanAnalisis[];
  kunci: Set<string>;
  berjalan: number;
  selesai: number;
  gagal: number;
  dilewati: number;
  terakhir: string;
  deps: KetergantunganAntrean | null;
}

const keadaan: Keadaan = {
  antrean: [],
  kunci: new Set(),
  berjalan: 0,
  selesai: 0,
  gagal: 0,
  dilewati: 0,
  terakhir: '',
  deps: null,
};

/** Pasang cara menjalankan analisis. Dipanggil sekali saat server siap. */
export function pasangKetergantunganAntrean(deps: KetergantunganAntrean): void {
  keadaan.deps = deps;
}

const kunciPekerjaan = (p: PekerjaanAnalisis) => `${p.tenantId}|${p.berkasId}`;

/**
 * Taruh satu dokumen di antrean. `false` = tidak diantrekan (sudah ada di
 * antrean, atau antrean penuh) — bukan kegagalan, hanya tidak perlu dikerjakan.
 */
export function antreAnalisisOtomatis(pekerjaan: PekerjaanAnalisis): boolean {
  const kunci = kunciPekerjaan(pekerjaan);
  if (!pekerjaan.tenantId || !pekerjaan.berkasId || !pekerjaan.judulBerkas) return false;
  if (keadaan.kunci.has(kunci)) {
    keadaan.dilewati += 1;
    return false;
  }
  if (keadaan.antrean.length >= BATAS_ANTREAN) {
    keadaan.dilewati += 1;
    keadaan.deps?.log?.(`[analisis-otomatis] antrean penuh, ${kunci} dilewati`);
    return false;
  }
  keadaan.kunci.add(kunci);
  keadaan.antrean.push(pekerjaan);
  void kuras();
  return true;
}

/** Kuras antrean selama masih ada ruang paralel. */
async function kuras(): Promise<void> {
  const deps = keadaan.deps;
  if (!deps) return;
  while (keadaan.berjalan < BATAS_PARALEL && keadaan.antrean.length > 0) {
    const pekerjaan = keadaan.antrean.shift()!;
    keadaan.berjalan += 1;
    void (async () => {
      try {
        const hasil = await deps.jalankan(pekerjaan);
        keadaan.terakhir = `${pekerjaan.judulBerkas}: ${hasil.status}${hasil.pesan ? ` — ${hasil.pesan}` : ''}`;
        if (hasil.status === 'selesai') keadaan.selesai += 1;
        else keadaan.gagal += 1;
        deps.log?.(`[analisis-otomatis] ${keadaan.terakhir}`);
      } catch (err: any) {
        keadaan.gagal += 1;
        keadaan.terakhir = `${pekerjaan.judulBerkas}: gagal — ${err?.message || err}`;
        deps.log?.(`[analisis-otomatis] ${keadaan.terakhir}`);
      } finally {
        keadaan.kunci.delete(kunciPekerjaan(pekerjaan));
        keadaan.berjalan -= 1;
        void kuras();
      }
    })();
  }
}

/** Ringkasan untuk panel admin & skrip QA. */
export function statusAntreanOtomatis(): {
  menunggu: number;
  berjalan: number;
  selesai: number;
  gagal: number;
  dilewati: number;
  terakhir: string;
} {
  return {
    menunggu: keadaan.antrean.length,
    berjalan: keadaan.berjalan,
    selesai: keadaan.selesai,
    gagal: keadaan.gagal,
    dilewati: keadaan.dilewati,
    terakhir: keadaan.terakhir,
  };
}

/** Kosongkan antrean — dipakai uji supaya keadaan tidak bocor antar-kasus. */
export function kosongkanAntreanOtomatis(): void {
  keadaan.antrean = [];
  keadaan.kunci.clear();
  keadaan.berjalan = 0;
  keadaan.selesai = 0;
  keadaan.gagal = 0;
  keadaan.dilewati = 0;
  keadaan.terakhir = '';
}

/** Tunggu sampai antrean kosong dan tidak ada yang berjalan (untuk uji). */
export async function tungguAntreanKosong(batasMs = 5000): Promise<boolean> {
  const batas = Date.now() + batasMs;
  while (Date.now() < batas) {
    if (keadaan.antrean.length === 0 && keadaan.berjalan === 0) return true;
    await new Promise((r) => setTimeout(r, 10));
  }
  return false;
}
