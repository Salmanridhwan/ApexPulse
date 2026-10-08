import { BumdSector } from '../../types';

/**
 * Knowledge base default per sektor.
 *
 * Satu layanan RAG memuat BANYAK knowledge base (umumnya satu per instansi).
 * Kalau instansi belum punya `knowledgeBaseId` sendiri, pakai KB sektor ini.
 *
 * JANGAN jatuh ke KB global (`kb_chat`) kalau bisa dihindari: isinya dokumen
 * lintas instansi. Itu akar bug "dashboard PDAM Tirta Kencana justru berisi
 * laporan Bank BJB" — permintaan PDAM dijawab dokumen Bank BJB dari KB campur.
 */
export const KB_DEFAULT_PER_SEKTOR: Partial<Record<BumdSector, string>> = {
  // CATATAN (per 2026-10-08): layanan RAG sudah diisi ULANG dengan dokumen asli.
  // `kb_pam_jaya`, `kb_tirta_moedal`, dan `kb_tirta_pakuan` masing-masing memuat
  // 3 PDF nyata (profil, RKAP 2026, SOP; ±24 ribu token). `kb_prj_pamjaya_demo`
  // yang lama hanya 899 token dan WAJIB dianggap data dummy — jangan dipakai lagi.
  // Satu instansi = satu KB; instansi air yang belum punya KB sendiri tidak boleh
  // diam-diam memakai dokumen instansi air lain, jadi hanya PAM JAYA yang jadi
  // default sektor (instansi lain selalu diatur lewat `knowledgeBaseId` sendiri).
  pdam: 'kb_pam_jaya',
};

/**
 * Knowledge base milik tiap instansi seed (tenant bawaan aplikasi).
 *
 * Dipakai untuk mem-backfill `Tenant.knowledgeBaseId` saat boot, termasuk
 * ketika state dimuat dari MySQL — tanpa ini tenant dari MySQL tidak punya KB
 * dan permintaan jatuh ke KB campur. Instansi yang belum punya KB (mis. RSUD
 * dan Transportasi) sengaja TIDAK didaftarkan di sini: lebih baik gagal dengan
 * pesan jelas daripada menyajikan dokumen instansi lain.
 */
export const KB_SEED_TENANT: Record<string, string> = {
  'tenant-pdam': 'kb_pam_jaya',
  // Dua instansi air tambahan (dibuat 2026-10-08) supaya tiga BUMD air nyata
  // punya KB sendiri-sendiri: satu instansi = satu dokumen instansi.
  'tenant-1791429954407': 'kb_tirta_moedal',
  'tenant-1791429954419': 'kb_tirta_pakuan',
};

/**
 * Knowledge base "campur": satu KB berisi dokumen banyak instansi. Retrieval
 * tidak bisa menjamin isolasi di dalam KB seperti ini, jadi jangan pernah
 * dipakai sebagai default — permintaan instansi apa pun bisa dijawab dokumen
 * instansi lain (kasus nyata: `kb_chat` berisi laporan Bank BJB).
 */
export const KB_CAMPUR = new Set(['kb_chat']);

/**
 * KB yang dipakai untuk sebuah instansi, dengan urutan prioritas:
 * 1. `knowledgeBaseId` milik instansi (diatur admin) — paling dipercaya.
 * 2. Default per sektor (lihat `KB_DEFAULT_PER_SEKTOR`).
 * 3. KB global dari konfigurasi sistem — hanya kalau bukan KB campur.
 *
 * Mengembalikan `undefined` kalau tidak ada KB yang layak. Pemanggil HARUS
 * memperlakukan ini sebagai "tidak ada sumber" (tolak dengan pesan jelas),
 * bukan diam-diam memakai KB campur.
 */
export function kbUntukInstansi(
  tenant: { sector?: BumdSector; knowledgeBaseId?: string } | undefined,
  kbGlobal?: string
): string | undefined {
  const eksplisit = tenant?.knowledgeBaseId?.trim();
  if (eksplisit && !KB_CAMPUR.has(eksplisit)) return eksplisit;
  const perSektor = tenant?.sector ? KB_DEFAULT_PER_SEKTOR[tenant.sector] : undefined;
  if (perSektor) return perSektor;
  const global = kbGlobal?.trim();
  if (global && !KB_CAMPUR.has(global)) return global;
  return undefined;
}
