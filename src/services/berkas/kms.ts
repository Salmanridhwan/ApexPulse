/**
 * Manajemen Berkas — integrasi KMS BUMD (`ragkms.aiones.app`).
 *
 * KMS adalah repositori berkas terpisah dari layanan RAG query: berkas diunggah
 * ke KMS, KMS mengindeksnya ke vector store, lalu aplikasi RAG membacanya.
 * Satu API key KMS dapat mengakses BANYAK project, jadi tujuan unggah selalu
 * ditentukan `organizationId` (dipetakan admin per instansi) — bukan dari key.
 *
 * Bagian ini MURNI (tanpa I/O) supaya ringkasan, validasi, dan pemetaan bisa
 * diuji tanpa server maupun tanpa memanggil KMS.
 */
import type { BerkasKMS, OrganisasiKMS, RingkasanBerkas } from '../../types';

/** Bentuk-normal id: buang spasi/titik/garis bawah/garis hubung, huruf kecil. */
function bentukNormal(id: unknown): string {
  return String(id || '')
    .toLowerCase()
    .replace(/[\s._-]+/g, '');
}

/**
 * Cari project KMS yang `knowledgeBase`-nya SAMA dengan KB instansi.
 *
 * Dipakai sebagai pemetaan OTOMATIS saat admin belum mengisi `Project KMS`.
 * Dicocokkan bentuk-normal (bukan kemiripan teks) supaya `kb_pam_jaya` ==
 * `kb_pamjaya`.
 *
 * PENTING: pemanggil TIDAK boleh memakai `knowledgeBaseId` mentah sebagai
 * `organizationId`. KMS diam-diam mengalihkan organizationId yang tidak
 * dikenal ke project DEFAULT (berkas bisa mendarat di instansi lain). Karena
 * itu fungsi ini HANYA mengembalikan `id` project yang benar-benar ada di
 * daftar KMS.
 */
export function cariProjectKmsDariKb(
  daftarProject: OrganisasiKMS[],
  knowledgeBaseId: unknown
): OrganisasiKMS | null {
  const kb = bentukNormal(knowledgeBaseId);
  if (!kb) return null;
  const daftar = Array.isArray(daftarProject) ? daftarProject : [];
  // Persis dulu: `kb_pam_jaya` dan `kb_pamjaya` bisa project BERBEDA di KMS.
  const persis = String(knowledgeBaseId).trim().toLowerCase();
  return (
    daftar.find((o) => String(o?.knowledgeBase || '').trim().toLowerCase() === persis) ||
    daftar.find((o) => bentukNormal(o?.knowledgeBase) === kb) ||
    null
  );
}

/**
 * Cari project KMS dari NAMA instansi (cadangan saat KB belum tertaut di KMS).
 *
 * Dicocokkan bentuk-normal dan hanya bila salah satu nama MEMUAT yang lain dengan
 * panjang minimal 6 karakter — supaya "pam jaya" tidak menyerempet "pam jaya barat"
 * milik instansi lain, tetapi "Perumda Air Minum Jaya" tetap cocok dengan
 * "Perumda Air Minum Jaya (PAM JAYA)".
 */
export function cariProjectKmsDariNama(
  daftarProject: OrganisasiKMS[],
  namaInstansi: unknown
): OrganisasiKMS | null {
  const nama = bentukNormal(namaInstansi);
  if (nama.length < 6) return null;
  const kandidat = (Array.isArray(daftarProject) ? daftarProject : [])
    .map((o) => ({ o, n: bentukNormal(o?.name) }))
    .filter(({ n }) => n.length >= 6 && (n.includes(nama) || nama.includes(n)))
    .sort((a, b) => Math.abs(a.n.length - nama.length) - Math.abs(b.n.length - nama.length));
  return kandidat[0]?.o || null;
}

/** Jenis berkas yang diterima KMS (maks 50 MB per berkas). */
export const EKSTENSI_DIIZINKAN = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'csv', 'md', 'rtf', 'odt', 'ods', 'odp',
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tif', 'tiff',
] as const;

/** Batas ukuran berkas KMS (byte). 50 MB menurut dokumentasi layanan. */
export const BATAS_UKURAN_BYTE = 50 * 1024 * 1024;

/** Batas ukuran yang kita kirim (base64 membengkak ~33%) — pakai batas KMS apa adanya. */
export function ekstensiDari(namaBerkas: unknown): string {
  const n = String(namaBerkas || '').trim().toLowerCase();
  const i = n.lastIndexOf('.');
  return i > 0 ? n.slice(i + 1) : '';
}

/**
 * Validasi berkas sebelum dikirim ke KMS.
 * Mengembalikan pesan galat, atau `null` bila sah.
 */
export function validasiBerkas(input: {
  nama?: unknown;
  ukuran?: unknown;
  tipe?: unknown;
}): string | null {
  const nama = String(input?.nama || '').trim();
  if (!nama) return 'Nama berkas tidak terbaca.';
  const ekst = ekstensiDari(nama);
  if (!ekst) return 'Berkas harus punya ekstensi (mis. .pdf, .docx).';
  if (!(EKSTENSI_DIIZINKAN as readonly string[]).includes(ekst)) {
    return `Jenis berkas ".${ekst}" belum didukung. Yang didukung: ${EKSTENSI_DIIZINKAN.join(', ')}.`;
  }
  const ukuran = Number(input?.ukuran);
  if (Number.isFinite(ukuran) && ukuran > BATAS_UKURAN_BYTE) {
    const mb = (ukuran / 1024 / 1024).toFixed(1);
    return `Berkas ${mb} MB melebihi batas ${BATAS_UKURAN_BYTE / 1024 / 1024} MB.`;
  }
  return null;
}

/** Validasi metadata unggah (judul & kategori wajib menurut KMS). */
export function validasiMetadata(input: { judul?: unknown; kategori?: unknown; organizationId?: unknown }): string | null {
  if (!String(input?.judul || '').trim()) return 'Judul berkas wajib diisi.';
  if (String(input.judul).trim().length > 300) return 'Judul terlalu panjang (maks 300 karakter).';
  if (!String(input?.kategori || '').trim()) return 'Kategori wajib diisi.';
  if (String(input.kategori).trim().length > 120) return 'Kategori terlalu panjang (maks 120 karakter).';
  if (!String(input?.organizationId || '').trim()) {
    return 'Instansi ini belum dipetakan ke project KMS. Atur di panel admin (Instansi & KB → project KMS).';
  }
  return null;
}

/** Normalisasi status indeks RAG dari layanan menjadi label Indonesia. */
export function labelStatusRag(status: unknown): string {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'indexed' || s === 'completed' || s === 'success') return 'Terindeks';
  if (s === 'pending' || s === 'processing' || s === 'queued') return 'Sedang diproses';
  if (s === 'failed' || s === 'error') return 'Gagal terindeks';
  return s ? s : 'Tidak diketahui';
}

/** `true` bila berkas sudah terindeks ke RAG (siap dipakai chat/dashboard). */
export function sudahTerindeks(status: unknown): boolean {
  const s = String(status || '').trim().toLowerCase();
  return s === 'indexed' || s === 'completed' || s === 'success';
}

/** Format ukuran KB → teks manusiawi (B/KB/MB). */
export function formatUkuran(kb: unknown): string {
  const n = Number(kb);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 1) return `${Math.round(n * 1024)} B`;
  if (n < 1024) return `${n < 10 ? n.toFixed(1) : Math.round(n)} KB`;
  return `${(n / 1024).toFixed(1)} MB`;
}

/**
 * Ringkas daftar berkas. DIHITUNG server dari data KMS — bukan dari input klien.
 * `perTipe` diurutkan menurun agar tampilan stabil.
 */
export function hitungRingkasanBerkas(daftar: BerkasKMS[]): RingkasanBerkas {
  const list = Array.isArray(daftar) ? daftar : [];
  const perTipePeta = new Map<string, number>();
  let totalKb = 0;
  let terindeks = 0;
  let terbesarKb = 0;
  let terbaruPada: string | null = null;

  for (const b of list) {
    const kb = Number(b?.fileSizeKb);
    if (Number.isFinite(kb) && kb > 0) {
      totalKb += kb;
      if (kb > terbesarKb) terbesarKb = kb;
    }
    if (sudahTerindeks(b?.ragStatus)) terindeks += 1;
    const tipe = String(b?.fileType || 'LAIN').trim().toUpperCase() || 'LAIN';
    perTipePeta.set(tipe, (perTipePeta.get(tipe) || 0) + 1);
    const waktu = b?.uploadedAt ? new Date(b.uploadedAt).getTime() : NaN;
    if (Number.isFinite(waktu)) {
      if (terbaruPada === null || waktu > new Date(terbaruPada).getTime()) {
        terbaruPada = new Date(waktu).toISOString();
      }
    }
  }

  const perTipe = Array.from(perTipePeta.entries())
    .map(([tipe, jumlah]) => ({ tipe, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah || a.tipe.localeCompare(b.tipe));

  return {
    total: list.length,
    totalKb: Math.round(totalKb * 10) / 10,
    terindeks,
    belumTerindeks: list.length - terindeks,
    perTipe,
    terbesarKb: Math.round(terbesarKb * 10) / 10,
    terbaruPada,
  };
}

/** Saring berkas berdasarkan pencarian judul & tipe (untuk UI). */
export function saringBerkas(
  daftar: BerkasKMS[],
  opsi: { cari?: string; tipe?: string } = {}
): BerkasKMS[] {
  const cari = String(opsi.cari || '').trim().toLowerCase();
  const tipe = String(opsi.tipe || '').trim().toUpperCase();
  return (Array.isArray(daftar) ? daftar : []).filter((b) => {
    if (tipe && String(b?.fileType || '').toUpperCase() !== tipe) return false;
    if (cari) {
      const teks = `${b?.title || ''} ${b?.category || ''} ${b?.department || ''}`.toLowerCase();
      if (!teks.includes(cari)) return false;
    }
    return true;
  });
}

/** Ambil daftar tipe berkas unik (untuk dropdown filter). */
export function daftarTipeBerkas(daftar: BerkasKMS[]): string[] {
  const set = new Set<string>();
  for (const b of Array.isArray(daftar) ? daftar : []) {
    const t = String(b?.fileType || '').trim().toUpperCase();
    if (t) set.add(t);
  }
  return Array.from(set).sort();
}

/**
 * Bentuk balasan KMS bisa berbeda antar versi — coba beberapa wadah yang lazim.
 * Mengembalikan array kosong bila tidak ada yang cocok (jangan menebak isi).
 */
export function ambilDaftarDokumen(balasan: any): BerkasKMS[] {
  const kandidat = [balasan?.documents, balasan?.data?.documents, balasan?.data, balasan?.items];
  for (const k of kandidat) if (Array.isArray(k)) return k as BerkasKMS[];
  return [];
}

/** Sama seperti di atas, untuk daftar project/organisasi. */
export function ambilDaftarOrganisasi(balasan: any): OrganisasiKMS[] {
  const kandidat = [balasan?.organizations, balasan?.data?.organizations, balasan?.data, balasan?.items];
  for (const k of kandidat) if (Array.isArray(k)) return k as OrganisasiKMS[];
  return [];
}
