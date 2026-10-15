/**
 * Katalog knowledge base — logika murni untuk tombol "Perbarui RAG".
 *
 * Layanan RAG memuat SELURUH KB pada instalasinya (di sini 47 KB), sementara
 * aplikasi hanya memakai beberapa. Bagian ini mengubah daftar mentah itu jadi
 * baris siap-tampil: siapa pemakainya, mana yang belum dipakai, dan mana yang
 * perlu dicek dulu (sisa demo, atau penulisan ganda dari KB yang sama).
 *
 * TANPA I/O supaya bisa diuji tanpa server maupun jaringan.
 */

/** Satu KB mentah dari `GET /knowledge-bases` layanan RAG. */
export interface KbMentah {
  knowledgeBaseId: string;
  documents: number;
  chunks: number;
  tokens: number;
  completed: number;
  processing: number;
  failed: number;
  updatedAt?: string;
}

/** Instansi yang memakai sebuah KB. */
export interface PemakaiKb {
  id: string;
  nama: string;
}

/** Baris katalog siap tampil. */
export interface BarisKb extends KbMentah {
  /** Instansi yang memakai KB ini (kosong = belum dipakai siapa pun). */
  dipakaiOleh: PemakaiKb[];
  terpakai: boolean;
  /**
   * KB ini punya dokumen tetapi belum dipakai instansi mana pun — kandidat yang
   * paling mungkin dimaksud admin saat bilang "ada KB baru".
   */
  baru: boolean;
  /** Alasan KB masuk kelompok "perlu dicek". Kosong = aman dipakai. */
  alasanPerluDicek: string[];
}

export interface RingkasanKatalog {
  totalKb: number;
  totalDokumen: number;
  terpakai: number;
  tersedia: number;
  perluDicek: number;
  belumDipakai: number;
  /** Jumlah KB yang belum dipakai tetapi sudah punya dokumen. */
  baru: number;
  /** Waktu kebaruan terakhir di antara seluruh KB (ISO), null bila tak ada. */
  terbaruPada: string | null;
}

/** Bekas penulisan yang tampak seperti sisa demo/uji, bukan KB instansi nyata. */
const POLAH_PERLU_DICEK: Array<{ pola: RegExp; alasan: string }> = [
  { pola: /^dm[-_]/i, alasan: 'Pola sisa demo (dm-…)' },
  { pola: /^kb[-_]?vibecontent/i, alasan: 'Pola sisa uji panel (kb-vibecontent…)' },
  { pola: /^gammi[-_]/i, alasan: 'Pola sisa uji (gammi-…)' },
  { pola: /^kb[-_]prj[-_]/i, alasan: 'Pola sisa demo proyek (kb_prj_…_demo)' },
  { pola: /[-_]demo$/i, alasan: 'Berakhiran "-demo"' },
  { pola: /^smoke/i, alasan: 'Pola uji asap (smoke)' },
];

/**
 * Bentuk pembanding ID: huruf kecil, tanpa pemisah.
 *
 * Dipakai menemukan penulisan ganda, mis. `kb_tirtamoedal` vs `kb_tirta_moedal`
 * dan `kb_pamjaya` vs `kb_pam_jaya` — keduanya menunjuk KB yang sama tetapi
 * terdaftar sebagai dua entri berbeda di layanan RAG.
 */
export function normalisasiKbId(id: unknown): string {
  return String(id || '')
    .toLowerCase()
    .replace(/[\s._-]+/g, '');
}

/** Alasan berbasis pola nama (tanpa melihat KB lain). */
export function alasanPolaSampah(id: unknown): string[] {
  const s = String(id || '').trim();
  if (!s) return [];
  const alasan: string[] = [];
  for (const p of POLAH_PERLU_DICEK) if (p.pola.test(s)) alasan.push(p.alasan);
  // ID HURUF BESAR semua (mis. PRJ-PAMJAYA) — tidak lazim untuk KB instansi.
  if (/[A-Z]/.test(s) && s === s.toUpperCase()) alasan.push('ID huruf besar semua (tidak lazim)');
  // Tanpa huruf sama sekali (mis. angka/tanda) — kemungkinan sisa uji.
  if (!/[a-z]/i.test(s)) alasan.push('ID tanpa huruf');
  return alasan;
}

/**
 * Bangun baris katalog: lengkapi dengan pemakai, tandai KB baru, dan kumpulkan
 * alasan "perlu dicek" (pola nama ATAU penulisan ganda dengan KB lain).
 *
 * `petaPakai` memetakan knowledgeBaseId → instansi yang memakainya.
 */
export function tandaiKatalog(
  kbs: KbMentah[],
  petaPakai: Record<string, PemakaiKb[]> = {}
): BarisKb[] {
  const daftar = Array.isArray(kbs) ? kbs : [];

  // Hitung berapa kali setiap bentuk-normal muncul, untuk deteksi penulisan ganda.
  const hitungNormal = new Map<string, number>();
  for (const k of daftar) {
    const n = normalisasiKbId(k?.knowledgeBaseId);
    if (n) hitungNormal.set(n, (hitungNormal.get(n) || 0) + 1);
  }
  // Bentuk-normal milik KB yang MEMANG dipakai instansi.
  const normalTerpakai = new Set<string>();
  for (const id of Object.keys(petaPakai)) {
    const pemakai = petaPakai[id];
    if (Array.isArray(pemakai) && pemakai.length > 0) normalTerpakai.add(normalisasiKbId(id));
  }

  return daftar.map((k) => {
    const id = String(k?.knowledgeBaseId || '').trim();
    const n = normalisasiKbId(id);
    const dipakaiOleh = Array.isArray(petaPakai[id]) ? petaPakai[id] : [];
    const terpakai = dipakaiOleh.length > 0;

    const alasan: string[] = [];
    // Alasan hanya dihitung untuk KB yang BELUM dipakai. Baris yang sudah dipakai
    // tidak pernah masuk kelompok "perlu dicek", jadi menempelkan peringatan di
    // sana hanya jadi kebisingan — kembarannya sendiri tetap terlihat mencurigakan.
    if (!terpakai) {
      alasan.push(...alasanPolaSampah(id));
      // Penulisan ganda: ada entri lain dengan bentuk-normal sama.
      if (n && (hitungNormal.get(n) || 0) > 1) {
        alasan.push('Penulisan ganda dengan KB lain (nama sama setelah tanda pemisah dibuang)');
      }
      // KB yang tidak dipakai tetapi menyerupai KB yang sedang dipakai.
      if (n && normalTerpakai.has(n)) alasan.push('Menyerupai KB yang sudah dipakai instansi');
    }
    const daftarAlasan = Array.from(new Set(alasan));

    return {
      ...k,
      knowledgeBaseId: id,
      dipakaiOleh,
      terpakai,
      // "Baru" = KB siap pakai yang belum terpasang: berisi dokumen DAN tidak
      // tertandai perlu-dicek. Kalau tidak, KB sampah berisi dokumen ikut terhitung
      // sebagai "KB baru" dan angkanya jadi menyesatkan.
      baru: !terpakai && Number(k?.documents) > 0 && daftarAlasan.length === 0,
      alasanPerluDicek: daftarAlasan,
    };
  });
}

/**
 * Ambil daftar alasan dengan aman.
 *
 * `kelompokkanKatalog`/`hitungRingkasanKatalog` juga menerima baris yang dibuat
 * tangan (tanpa lewat `tandaiKatalog`) — di situ `alasanPerluDicek` tidak ada, dan
 * membacanya langsung akan melempar TypeError.
 */
function alasanDari(b: BarisKb): string[] {
  return Array.isArray(b?.alasanPerluDicek) ? b.alasanPerluDicek : [];
}

/**
 * Pisahkan katalog menjadi tiga kelompok tampilan.
 * Urutan di dalam kelompok: dokumen terbanyak dulu, lalu ID alfabetis (stabil).
 */
export function kelompokkanKatalog(baris: BarisKb[]): {
  terpakai: BarisKb[];
  tersedia: BarisKb[];
  perluDicek: BarisKb[];
} {
  const urut = (a: BarisKb, b: BarisKb) =>
    Number(b?.documents || 0) - Number(a?.documents || 0) ||
    String(a?.knowledgeBaseId || '').localeCompare(String(b?.knowledgeBaseId || ''));

  const list = Array.isArray(baris) ? baris : [];
  return {
    terpakai: list.filter((b) => b.terpakai).sort(urut),
    tersedia: list.filter((b) => !b.terpakai && alasanDari(b).length === 0).sort(urut),
    perluDicek: list.filter((b) => !b.terpakai && alasanDari(b).length > 0).sort(urut),
  };
}

/** Ringkasan katalog untuk kartu atas panel. */
export function hitungRingkasanKatalog(baris: BarisKb[]): RingkasanKatalog {
  const list = Array.isArray(baris) ? baris : [];
  let totalDokumen = 0;
  let terpakai = 0;
  let baru = 0;
  let perluDicek = 0;
  let terbaruPada: string | null = null;

  for (const b of list) {
    const doc = Number(b?.documents);
    if (Number.isFinite(doc) && doc > 0) totalDokumen += doc;
    if (b.terpakai) terpakai += 1;
    else {
      if (alasanDari(b).length > 0) perluDicek += 1;
      if (b.baru) baru += 1;
    }
    const w = b.updatedAt ? new Date(b.updatedAt).getTime() : NaN;
    if (Number.isFinite(w)) {
      if (terbaruPada === null || w > new Date(terbaruPada).getTime()) terbaruPada = new Date(w).toISOString();
    }
  }

  return {
    totalKb: list.length,
    totalDokumen,
    terpakai,
    tersedia: list.filter((b) => !b.terpakai && alasanDari(b).length === 0).length,
    perluDicek,
    belumDipakai: list.length - terpakai,
    baru,
    terbaruPada,
  };
}

/** Cari berdasarkan ID KB saja (ID panjang & teknis, bukan judul). */
export function saringKatalog(baris: BarisKb[], opsi: { cari?: string; hanyaBelumDipakai?: boolean } = {}): BarisKb[] {
  const q = String(opsi.cari || '').trim().toLowerCase();
  return (Array.isArray(baris) ? baris : []).filter((b) => {
    if (opsi.hanyaBelumDipakai && b.terpakai) return false;
    if (q && !String(b?.knowledgeBaseId || '').toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Label alasan "perlu dicek" untuk ditampilkan (dipisah koma). */
export function ringkasAlasan(b: BarisKb): string {
  return (b?.alasanPerluDicek || []).join(' · ');
}
