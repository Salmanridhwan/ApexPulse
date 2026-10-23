/**
 * Pengumpulan potongan teks satu dokumen dari layanan basis dokumen.
 *
 * ponytail: pratinjau dokumen "hanya basis" dulu memanggil `/search` dengan
 * `top_k: 50` untuk dua kueri lalu menampilkan apa pun yang terambil. Karena
 * retrieval mengembalikan potongan yang PALING MIRIP dengan kueri (bukan seluruh
 * isi dokumen), dokumen 200 potongan bisa tampil hanya 40 potongan — dan
 * pengguna mengira dokumennya memang begitu isinya.
 *
 * Modul ini: beberapa kueri penjelajah (judul, "isi lengkap", bagian awal/tengah/
 * akhir) + dedupe berdasarkan `chunk_id`, lalu diurutkan menurut nomor potongan.
 * Hasilnya di-cache sebentar supaya berpindah halaman tidak memanggil RAG lagi.
 */

export interface PotonganDokumen {
  id: string;
  isi: string;
  halaman?: number;
  bagian?: string;
}

/** Urutkan potongan menurut nomor di dalam id (fallback: halaman, lalu id). */
export function urutkanPotongan(list: PotonganDokumen[]): PotonganDokumen[] {
  const nomor = (id: string): number | null => {
    const m = String(id).match(/(\d+)(?!.*\d)/);
    return m ? Number(m[1]) : null;
  };
  return [...list].sort((a, b) => {
    const na = nomor(a.id);
    const nb = nomor(b.id);
    if (na !== null && nb !== null && na !== nb) return na - nb;
    if (na !== null && nb === null) return -1;
    if (na === null && nb !== null) return 1;
    const ha = a.halaman ?? 0;
    const hb = b.halaman ?? 0;
    if (ha !== hb) return ha - hb;
    return String(a.id).localeCompare(String(b.id));
  });
}

/** Buang duplikat berdasarkan id (potongan pertama yang menang). */
export function gabungUnik(...daftar: PotonganDokumen[][]): PotonganDokumen[] {
  const peta = new Map<string, PotonganDokumen>();
  for (const kelompok of daftar) {
    for (const p of kelompok) {
      if (!p || !p.id || !p.isi) continue;
      if (!peta.has(p.id)) peta.set(p.id, p);
    }
  }
  return urutkanPotongan([...peta.values()]);
}

export interface Halaman<T> {
  isi: T[];
  total: number;
  halaman: number;
  totalHalaman: number;
  offset: number;
  perHalaman: number;
}

/** Ambil satu halaman dari daftar (halaman 1-based, dijepit ke rentang sah). */
export function ambilHalaman<T>(list: T[], halaman: number, perHalaman: number): Halaman<T> {
  const per = Math.max(1, Math.floor(perHalaman) || 20);
  const total = list.length;
  const totalHalaman = Math.max(1, Math.ceil(total / per));
  const h = Math.min(Math.max(1, Math.floor(halaman) || 1), totalHalaman);
  const offset = (h - 1) * per;
  return { isi: list.slice(offset, offset + per), total, halaman: h, totalHalaman, offset, perHalaman: per };
}

/** Kueri penjelajah: makin banyak variasi, makin banyak potongan terambil. */
export function kueriPenjelajah(nama: string): string[] {
  const bersih = String(nama || '').replace(/[_\-.]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!bersih) return [];
  return [
    bersih,
    `${bersih} isi lengkap`,
    `${bersih} bagian awal`,
    `${bersih} bagian tengah`,
    `${bersih} bagian akhir`,
    `${bersih} kesimpulan`,
  ];
}

export interface HasilKumpulan {
  potongan: PotonganDokumen[];
  /** Tautan berkas asli bila layanan menyediakannya. */
  sumberAsli: string;
  /** Jumlah potongan menurut katalog dokumen (0 = tidak dilaporkan). */
  jumlahKatalog: number;
  /** true = ada potongan yang belum bisa diambil (pratinjau tidak utuh). */
  sebagian: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { waktu: number; hasil: HasilKumpulan }>();

export function bersihkanCachePotongan(): void {
  cache.clear();
}

/**
 * Kumpulkan potongan satu dokumen.
 *
 * `panggil` disuntikkan supaya bisa diuji tanpa jaringan; produksi memakai
 * `POST {base}/search`.
 */
export async function kumpulkanPotongan(opsi: {
  kb: string;
  docId: string;
  nama: string;
  jumlahKatalog?: number;
  panggil: (kueri: string, topK: number) => Promise<any>;
  topK?: number;
  pakaiCache?: boolean;
}): Promise<HasilKumpulan> {
  const kunciCache = `${opsi.kb}|${opsi.docId}`;
  if (opsi.pakaiCache !== false) {
    const ada = cache.get(kunciCache);
    if (ada && Date.now() - ada.waktu < CACHE_TTL_MS) return ada.hasil;
  }

  const topK = opsi.topK ?? 50;
  const daftar: PotonganDokumen[][] = [];
  let sumberAsli = '';
  for (const kueri of kueriPenjelajah(opsi.nama)) {
    try {
      const j: any = await opsi.panggil(kueri, topK);
      const hasil = j?.data?.results || j?.results || [];
      const kelompok: PotonganDokumen[] = [];
      for (const x of hasil) {
        if (!x || x.document_id !== opsi.docId) continue;
        if (!sumberAsli && typeof x.source_url === 'string' && /^https?:/i.test(x.source_url)) {
          sumberAsli = x.source_url;
        }
        if (!x.content || !x.chunk_id) continue;
        kelompok.push({ id: String(x.chunk_id), isi: String(x.content), halaman: x.page, bagian: x.section });
      }
      daftar.push(kelompok);
    } catch {
      // satu kueri gagal tidak membatalkan sisanya
    }
  }

  const potongan = gabungUnik(...daftar);
  const jumlahKatalog = Math.max(0, Number(opsi.jumlahKatalog) || 0);
  const hasil: HasilKumpulan = {
    potongan,
    sumberAsli,
    jumlahKatalog,
    sebagian: jumlahKatalog > 0 && potongan.length < jumlahKatalog,
  };
  if (opsi.pakaiCache !== false) cache.set(kunciCache, { waktu: Date.now(), hasil });
  return hasil;
}
