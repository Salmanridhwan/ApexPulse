import { BumdSector, CatalogPreset, WidgetSpec } from '../../types';

/**
 * Permintaan JUMLAH widget dari pengguna, mis. "buatkan dashboard dengan 15-20
 * widget". Disimpan sebagai rentang karena pengguna hampir selalu menyebut
 * rentang, bukan angka pasti.
 */
export interface PermintaanJumlahWidget {
  min: number;
  max: number;
}

/** Batas atas wajar — melindungi dari angka salah tulis (mis. "1000 widget"). */
export const BATAS_ATAS_WAJAR = 40;

const SATUAN = '(?:widget|kartu|card|chart|grafik|panel|komponen)';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Bandingkan judul widget tanpa peduli besar-kecil huruf dan spasi berlebih. */
export const normJudul = (teks: string): string =>
  String(teks || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Baca permintaan jumlah widget dari kalimat pengguna.
 *
 * Mengembalikan `null` kalau pengguna TIDAK menyebut jumlah — pemanggil tidak
 * boleh mengarang target sendiri (dashboard biasa tetap dibuat apa adanya).
 * Frasa kualitatif seperti "beberapa widget" sengaja TIDAK dipetakan ke angka,
 * karena menebaknya justru membuat janji yang tidak bisa ditepati.
 *
 * Contoh yang dikenali:
 *   "dashboard dengan 15-20 widget"      → { min: 15, max: 20 }
 *   "buat 12 kartu"                      → { min: 12, max: 12 }
 *   "minimal 8 grafik dong"              → { min: 8,  max: 8  }
 *   "20 sampai 25 komponen"              → { min: 20, max: 25 }
 */
export function parsePermintaanJumlahWidget(prompt: string): PermintaanJumlahWidget | null {
  const teks = String(prompt || '').toLowerCase();
  if (!teks.trim()) return null;

  // Rentang dulu: "15-20 widget", "15 sampai 20 kartu", "15 s/d 20 grafik".
  // Pemisah `-` boleh tanpa spasi; kata sambung wajib berspasi agar "2020-2021"
  // tidak salah dibaca saat diikuti satuan.
  const polaRentang = new RegExp(
    `(\\d{1,4})\\s*(?:-|–|—|sampai|hingga|s/d|sd|to)\\s*(\\d{1,4})\\s*${SATUAN}`,
    'i'
  );
  const rentang = teks.match(polaRentang);
  if (rentang) {
    let a = parseInt(rentang[1], 10);
    let b = parseInt(rentang[2], 10);
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) {
      if (a > b) [a, b] = [b, a];
      return { min: clamp(a, 1, BATAS_ATAS_WAJAR), max: clamp(b, 1, BATAS_ATAS_WAJAR) };
    }
  }

  // Angka tunggal: "10 widget", "minimal 20 kartu", "tambah 6 grafik".
  const tunggal = teks.match(new RegExp(`(\\d{1,4})\\s*${SATUAN}`, 'i'));
  if (tunggal) {
    const n = parseInt(tunggal[1], 10);
    if (Number.isFinite(n) && n > 0) {
      const v = clamp(n, 1, BATAS_ATAS_WAJAR);
      return { min: v, max: v };
    }
  }

  return null;
}

/** Teks rentang untuk ditampilkan ke pengguna ("15–20" atau "12"). */
export function labelJumlahWidget(p: PermintaanJumlahWidget): string {
  return p.min === p.max ? String(p.min) : `${p.min}\u2013${p.max}`;
}

/**
 * Pilih preset katalog untuk MELENGKAPI dashboard sampai jumlah yang diminta.
 *
 * Hanya preset yang relevan dengan sektor instansi (atau `universal`) dan yang
 * judulnya belum ada di dashboard. Preset yang dipilih belum tentu berisi data
 * di dokumen — pengambilan datanya dilakukan pemanggil dan hasil kosong dibuang.
 */
export function pilihPresetPelengkap(
  katalog: CatalogPreset[],
  sector: BumdSector | string,
  judulTerpakai: string[],
  butuh: number
): CatalogPreset[] {
  if (butuh <= 0) return [];
  const sudah = new Set(judulTerpakai.map(normJudul));
  const hasil: CatalogPreset[] = [];
  for (const p of katalog) {
    if (hasil.length >= butuh) break;
    if (!p.sektor.includes(sector as any) && !p.sektor.includes('universal')) continue;
    const n = normJudul(p.nama);
    if (!n || sudah.has(n)) continue;
    sudah.add(n); // sekaligus mencegah preset kembar terpilih dua kali
    hasil.push(p);
  }
  return hasil;
}

export interface OpsiLengkapiWidget {
  /** Widget yang sudah ada (dari jalur utama). */
  widgets: WidgetSpec[];
  katalog: CatalogPreset[];
  sector: BumdSector;
  target: PermintaanJumlahWidget;
  /**
   * Ambil satu widget untuk sebuah preset. Kembalikan `null` kalau dokumen
   * tidak memuat datanya — JANGAN mengarang widget kosong.
   */
  ambil: (preset: CatalogPreset) => Promise<WidgetSpec | null>;
  /** Catatan progres (untuk log jawaban/audit). */
  onCatatan?: (teks: string) => void;
  /** Jumlah preset yang diambil serentak (jaga beban layanan RAG). */
  concurrency?: number;
  /** Batas waktu keseluruhan melengkapi; sisanya dilewati dengan jujur. */
  batasWaktuMs?: number;
  /** Sumber waktu (bisa diganti di uji). */
  sekarang?: () => number;
}

export interface HasilLengkapiWidget {
  widgets: WidgetSpec[];
  /** Berapa widget baru yang berhasil ditambahkan. */
  ditambahkan: number;
  /** Berapa preset dicoba. */
  dicoba: number;
  /** true bila berhenti karena batas waktu (bukan karena kandidat habis). */
  kehabisanWaktu: boolean;
  catatan: string[];
}

/**
 * Fokus dasar untuk sebuah preset saat MELENGKAPI dashboard.
 *
 * PENTING (perbaikan 2026-10-15): fungsi ini DULU selalu mengembalikan `bar`
 * untuk semua keluarga grafik, sehingga dashboard hasil lengkapan katalog
 * hampir selalu berisi deretan diagram batang — "chartnya itu-itu aja" padahal
 * repo punya puluhan tipe (donut, radar, heatmap, gauge, waterfall, funnel, …).
 * Sekarang tipe yang DIMINTAKAN preset dipertahankan apa adanya; kalau bentuk
 * datanya tidak mendukung, `ambilDataWidget` menurunkan ke tipe cadangan yang
 * aman (`tipeCadangan`) — jadi variasi didapat tanpa menampilkan bentuk palsu.
 */
export function tipeDasarPreset(preset: { tipeChart?: string[] }): string {
  const t = String(preset.tipeChart?.[0] || 'kpi');
  // 'grafik' bukan tipe konkret; peta ke batang supaya tetap punya bentuk default.
  if (t === 'grafik') return 'bar';
  return t;
}

/**
 * Tipe cadangan (berurutan) bila tipe utama tidak bisa dihormati data dokumen.
 * Dipakai `ambilDataWidget` pada data yang SAMA (tanpa panggilan RAG tambahan),
 * sehingga widget tetap muncul dengan bentuk paling setia yang bisa digambar.
 */
export function tipeCadanganPreset(preset: { tipeChart?: string[] }): string[] {
  const utama = tipeDasarPreset(preset);
  const daftar = (preset.tipeChart || []).filter((t) => t && t !== 'grafik' && t !== utama);
  // Selalu sertakan batang & garis sebagai jaring terakhir: keduanya bisa digambar
  // dari hampir semua bentuk data {xAxis, series}.
  for (const aman of ['bar', 'line']) if (!daftar.includes(aman) && aman !== utama) daftar.push(aman);
  return daftar;
}

/**
 * Lengkapi dashboard sampai `target.max` (atau sampai kandidat habis) dengan
 * menarik widget nyata dari katalog preset. Best-effort: widget yang datanya
 * tidak ada di dokumen dibuang, dan hasil akhirnya dilaporkan apa adanya —
 * pemanggil yang memutuskan cara menyampaikan selisihnya ke pengguna.
 */
export async function lengkapiWidgetDariKatalog(
  opsi: OpsiLengkapiWidget
): Promise<HasilLengkapiWidget> {
  const {
    katalog,
    sector,
    target,
    ambil,
    onCatatan,
    concurrency = 3,
    batasWaktuMs = 75_000,
    sekarang = Date.now,
  } = opsi;

  const widgets = [...opsi.widgets];
  const catatan: string[] = [];
  const mulai = sekarang();

  if (widgets.length >= target.max) {
    return { widgets, ditambahkan: 0, dicoba: 0, kehabisanWaktu: false, catatan };
  }

  const butuh = target.max - widgets.length;
  // Ambil kandidat LEBIH BANYAK dari yang dibutuhkan: sebagian preset bisa
  // gagal/tidak ada datanya di dokumen, dan kita ingin yang berikutnya dicoba
  // agar target tetap bisa terpenuhi. Loop di bawah berhenti begitu target
  // tercapai, jadi kelebihan kandidat tidak menambah panggilan yang sia-sia
  // (paling banyak satu batch terakhir).
  const kandidat = pilihPresetPelengkap(
    katalog,
    sector,
    widgets.map((w) => w.title),
    butuh + Math.max(butuh, 5)
  );

  let dicoba = 0;
  let kehabisanWaktu = false;

  for (let i = 0; i < kandidat.length; i += concurrency) {
    if (widgets.length >= target.max) break;
    if (sekarang() - mulai > batasWaktuMs) {
      kehabisanWaktu = true;
      catatan.push(`Pelengkapan dihentikan: melewati batas waktu ${batasWaktuMs} ms.`);
      break;
    }
    const bagian = kandidat.slice(i, i + concurrency);
    dicoba += bagian.length;
    const hasil = await Promise.all(
      bagian.map(async (p) => {
        try {
          return await ambil(p);
        } catch {
          // Galat satu preset tidak boleh menggagalkan seluruh pelengkapan.
          return null;
        }
      })
    );
    for (const w of hasil) {
      if (!w || widgets.length >= target.max) continue;
      if (widgets.some((x) => normJudul(x.title) === normJudul(w.title))) continue;
      widgets.push(w);
    }
  }

  return {
    widgets,
    ditambahkan: widgets.length - opsi.widgets.length,
    dicoba,
    kehabisanWaktu,
    catatan,
  };
}
