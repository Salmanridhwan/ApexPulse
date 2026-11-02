/**
 * HALAMAN YANG DIMINTA PENGGUNA.
 *
 * Pengguna sering menulis susunan halaman sendiri di kalimat permintaan:
 *
 *   "1. Halaman Ringkasan – gambaran umum: KPI warga terlayani, kapasitas
 *    produksi, ... 2. Halaman Keuangan – hanya topik uang: pendapatan, beban,
 *    laba, arus kas, komposisi beban, dan progres target pendapatan. ..."
 *
 * Dulu daftar ini diabaikan: halaman dibagi otomatis per kategori sehingga
 * hasilnya "Ringkasan" dan "Ringkasan (2)" berisi KPI saja. Modul ini membaca
 * daftar itu menjadi halaman + butir indikator, menebak bentuk chart tiap
 * butir, dan mencocokkan widget ke halamannya. MURNI (tanpa I/O) supaya bisa
 * diuji.
 */

import type { WidgetSpec } from '../../types';

export interface HalamanDiminta {
  judul: string;
  /** Indikator yang disebut untuk halaman ini, mis. "arus kas", "tren produksi bulanan". */
  butir: string[];
}

/** Halaman per permintaan paling banyak; lebih dari ini tidak muat di navigasi halaman. */
const MAKS_HALAMAN = 8;
/** Butir per halaman paling banyak: satu halaman harus muat satu layar. */
export const MAKS_BUTIR = 7;

const KATA_UMUM = new Set([
  'dan', 'per', 'di', 'ke', 'dari', 'yang', 'tiap', 'setiap', 'terhadap', 'untuk', 'dengan', 'atau', 'lalu', 'serta',
  'angka', 'kpi', 'tren', 'bulanan', 'bulan', 'tahunan', 'tahun', 'utama', 'total', 'nilai', 'data', 'grafik', 'chart',
  'jumlah', 'tingkat', 'rasio', 'persentase',
]);

/**
 * Sinonim metrik BUMD disatukan ke satu kata supaya "Tingkat Kehilangan Air"
 * dan "NRW", atau "Warga terlayani" dan "Jumlah Pelanggan", dikenali sebagai
 * metrik yang sama.
 */
const FRASA_SAMA: Array<[RegExp, string]> = [
  [/non[\s-]*revenue[\s-]*water|kehilangan air|air (?:yang )?hilang|air t(?:ak|idak) berekening/g, ' nrw '],
  [/(?:warga|penduduk|jiwa) terlayani|sambungan (?:rumah|langganan)/g, ' pelanggan '],
];
const KATA_SAMA: Record<string, string> = {
  sambungan: 'pelanggan',
  keluhan: 'pengaduan',
  aduan: 'pengaduan',
  komplain: 'pengaduan',
  biaya: 'beban',
  keuntungan: 'laba',
  penerimaan: 'pendapatan',
  omzet: 'pendapatan',
  revenue: 'pendapatan',
  rkap: 'target',
  rencana: 'target',
  realisasi: 'progres',
  capaian: 'progres',
  karyawan: 'pegawai',
  // Istilah dokumen yang berbeda dari kalimat pengguna (laporan uji T3).
  komposisi: 'rincian',
  struktur: 'rincian',
  penyelesaian: 'selesai',
  diselesaikan: 'selesai',
  kategori: 'jenis',
  mutu: 'kualitas',
  kontribusi: 'porsi',
  proporsi: 'porsi',
  sebaran: 'porsi',
};

/**
 * Token bermakna: huruf kecil, sinonim disatukan, kata umum dibuang. Isi kurung
 * TIDAK dibuang: "Tingkat Kehilangan Air (NRW)" justru menyebut metriknya di
 * dalam kurung.
 */
export function tokenBermakna(teks: string): string[] {
  let t = String(teks ?? '').toLowerCase();
  for (const [pola, ganti] of FRASA_SAMA) t = t.replace(pola, ganti);
  const token = t
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((k) => KATA_SAMA[k] ?? k)
    .filter((k) => k.length >= 3 && !KATA_UMUM.has(k));
  return [...new Set(token)];
}

/** Dua kata dianggap sama bila salah satu awalan yang lain ("pelanggan" ~ "pelanggannya"). */
const kataSama = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));

/** Porsi token `butir` yang muncul di `teks` (0..1). */
export function skorCocok(butir: string, teks: string): number {
  const tt = tokenBermakna(teks);
  const skor = (b: string) => {
    const tb = tokenBermakna(b);
    return tb.length === 0 ? 0 : tb.filter((x) => tt.some((t) => kataSama(x, t))).length / tb.length;
  };
  // Keterangan dalam kurung di butir ("laba (rugi) bersih") boleh diabaikan.
  return Math.max(skor(butir), skor(butir.replace(/\(.*?\)/g, ' ')));
}

/** Pecah uraian satu halaman menjadi butir indikator. */
function pecahButir(uraian: string): string[] {
  // Kalimat pertama saja: kalimat berikutnya biasanya larangan ("Tidak boleh ...").
  let inti = uraian.split(/\.\s+(?=[A-Z])|\.\s*$/)[0] ?? '';
  // "hanya topik uang: pendapatan, beban, ..." -> bagian setelah titik dua.
  const titikDua = inti.lastIndexOf(':');
  if (titikDua >= 0) inti = inti.slice(titikDua + 1);
  return inti
    .split(/\s*[,;]\s*|\s+(?:lalu|serta|dan|juga)\s+/i)
    .map((b) =>
      b
        .trim()
        .replace(/^(?:dan|serta|lalu|juga|kpi|angka)\s+/i, '')
        .replace(/[.\s]+$/, '')
        .trim()
    )
    .filter((b) => tokenBermakna(b).length > 0 && b.length <= 80)
    .slice(0, MAKS_BUTIR);
}

/**
 * Baca daftar halaman bernomor dari kalimat pengguna. Mengembalikan [] bila
 * tidak ada daftar (kurang dari dua halaman) — dashboard lalu dibagi otomatis.
 */
export function bacaHalamanDiminta(prompt: string): HalamanDiminta[] {
  const teks = String(prompt ?? '').replace(/\s+/g, ' ');
  const penanda = [...teks.matchAll(/(?:^|[\s:;])(\d{1,2})[.)]\s+/g)];
  const hasil: HalamanDiminta[] = [];
  penanda.forEach((m, i) => {
    const awal = (m.index ?? 0) + m[0].length;
    const akhir = i + 1 < penanda.length ? (penanda[i + 1].index ?? teks.length) : teks.length;
    const isi = teks.slice(awal, akhir).trim();
    const pakaiKata = /^halaman\s+/i.test(isi);
    const tanpaKata = isi.replace(/^halaman\s+/i, '');
    // Judul berakhir di tanda pisah atau titik dua pertama.
    const pisah = tanpaKata.match(/\s[–—-]\s|:\s/);
    if (!pakaiKata && (!pisah || (pisah.index ?? 99) > 60)) return;
    const judul = (pisah ? tanpaKata.slice(0, pisah.index) : tanpaKata.split(/[.,]/)[0]).trim().slice(0, 48);
    const uraian = pisah ? tanpaKata.slice((pisah.index ?? 0) + pisah[0].length) : '';
    if (!judul) return;
    hasil.push({ judul: judul.charAt(0).toUpperCase() + judul.slice(1), butir: pecahButir(uraian) });
  });
  return hasil.length >= 2 ? hasil.slice(0, MAKS_HALAMAN) : [];
}

/** Bentuk widget yang paling sesuai dengan kalimat butir. */
export function tipeButir(butir: string): 'kpi' | 'line' | 'donut' | 'bar' | 'bullet-target' | 'table' {
  const b = butir.toLowerCase();
  if (/\btren\b|bulanan|per bulan|per tahun|perkembangan|dari tahun ke tahun/.test(b)) return 'line';
  if (/komposisi|porsi|proporsi|struktur|bauran/.test(b)) return 'donut';
  if (/progres|capaian target|realisasi.*target|terhadap target/.test(b)) return 'bullet-target';
  if (/per (?:wilayah|kategori|zona|unit|cabang|kota)|\bantar|perbandingan|kontribusi|sebaran/.test(b)) return 'bar';
  if (/\bstatus\b|daftar|rincian/.test(b)) return 'table';
  return 'kpi';
}

/** Teks pembanding widget: judul + nama seri. */
const teksWidget = (w: WidgetSpec) => [w.title, ...(w.chart?.series ?? []).map((s) => s.name)].join(' ');

/** Ambang kecocokan widget dengan butir halaman. */
const AMBANG = 0.5;

/**
 * Halaman terbaik untuk satu widget: butir dengan kecocokan tertinggi. -1 bila
 * widget tidak cocok dengan halaman mana pun.
 */
export function halamanUntukWidget(w: WidgetSpec, halaman: HalamanDiminta[]): number {
  let terbaik = -1;
  let skorTerbaik = 0;
  // Angka tunggal (KPI) bukan rincian: "Jumlah pelanggan" total tidak masuk
  // halaman yang memintanya "per wilayah" atau sebagai tren.
  const angkaTunggal = w.type === 'kpi';
  halaman.forEach((h, i) => {
    const butir = angkaTunggal ? h.butir.filter((b) => ['kpi', 'bullet-target'].includes(tipeButir(b))) : h.butir;
    const skor = Math.max(0, ...butir.map((b) => skorCocok(b, teksWidget(w))));
    if (skor > skorTerbaik) {
      skorTerbaik = skor;
      terbaik = i;
    }
  });
  return skorTerbaik >= AMBANG ? terbaik : -1;
}

/** Butir yang sudah terwakili widget yang ada (tidak perlu diambil ulang dari dokumen). */
export function butirTerwakili(butir: string, widgets: WidgetSpec[]): boolean {
  // Butir grafik (tren, komposisi, per wilayah) tidak terwakili oleh KPI angka tunggal.
  const butuhGrafik = !['kpi', 'bullet-target'].includes(tipeButir(butir));
  return widgets.some((w) => !(butuhGrafik && w.type === 'kpi') && skorCocok(butir, teksWidget(w)) >= 0.75);
}

/**
 * Apakah pengguna meminta dashboard berhalaman banyak tanpa menulis daftarnya
 * ("beberapa halaman sekaligus", "satu topik per halaman", "3 halaman")?
 * Mengembalikan jumlah halaman yang disebut, `true` bila tanpa angka, atau
 * `false` bila tidak meminta.
 */
export function mintaBanyakHalaman(prompt: string): number | boolean {
  const t = String(prompt ?? '').toLowerCase();
  const ANGKA: Record<string, number> = { dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8 };
  const m = t.match(/(\d{1,2}|dua|tiga|empat|lima|enam|tujuh|delapan)\s+halaman/);
  if (m) {
    const n = ANGKA[m[1]] ?? parseInt(m[1], 10);
    if (n >= 2) return n;
  }
  return /beberapa halaman|banyak halaman|multi ?halaman|halaman terpisah|jangan satu halaman|(?:setiap|tiap|per) halaman|satu topik|per (?:topik|segmen)/.test(t);
}

/**
 * Segmentasi bawaan bila pengguna meminta banyak halaman tanpa daftarnya.
 * Setiap halaman satu topik dengan indikator khas sektornya; indikator tidak
 * berulang antarhalaman supaya data tidak kembar.
 */
const SEGMEN_PDAM: HalamanDiminta[] = [
  // Tiap halaman minimal dua butir grafik supaya dashboard tidak hanya berisi KPI.
  { judul: 'Ringkasan', butir: ['jumlah pelanggan', 'cakupan pelayanan', 'kapasitas produksi terpasang', 'tren jumlah pelanggan per tahun', 'komposisi pelanggan per golongan'] },
  { judul: 'Keuangan', butir: ['pendapatan usaha', 'beban usaha', 'laba bersih', 'arus kas operasi', 'komposisi beban usaha', 'tren pendapatan per tahun'] },
  { judul: 'Operasional & Produksi', butir: ['volume produksi air', 'volume air terjual', 'NRW (kehilangan air)', 'jam operasi pelayanan', 'tren produksi air per bulan', 'tren NRW per bulan'] },
  { judul: 'Pelayanan Pelanggan', butir: ['jumlah pengaduan pelanggan', 'waktu penyelesaian pengaduan', 'kepatuhan mutu air', 'pengaduan per kategori', 'tren pengaduan per bulan'] },
  { judul: 'Wilayah', butir: ['sambungan pelanggan per wilayah', 'cakupan pelayanan per wilayah', 'air terjual per wilayah'] },
];

const SEGMEN_UMUM: HalamanDiminta[] = [
  { judul: 'Ringkasan', butir: ['jumlah pelanggan', 'total aset', 'tren total aset per tahun'] },
  { judul: 'Keuangan', butir: ['pendapatan usaha', 'beban usaha', 'laba bersih', 'arus kas operasi', 'komposisi beban usaha', 'tren pendapatan per tahun'] },
  { judul: 'Operasional', butir: ['volume layanan', 'capaian target operasional', 'tren volume layanan per bulan', 'perbandingan kinerja per unit'] },
  { judul: 'Pelayanan', butir: ['jumlah pengaduan', 'waktu penyelesaian pengaduan', 'tren pengaduan per kategori'] },
  { judul: 'Sumber Daya Manusia', butir: ['jumlah pegawai', 'komposisi pegawai per pendidikan'] },
];

export function segmenBawaan(sector: string): HalamanDiminta[] {
  return (sector === 'pdam' ? SEGMEN_PDAM : SEGMEN_UMUM).map((h) => ({ ...h, butir: [...h.butir] }));
}

/**
 * Halaman untuk satu permintaan: daftar yang ditulis pengguna bila ada; bila
 * pengguna hanya meminta "beberapa halaman", segmentasi bawaan sektornya
 * (dipotong sesuai jumlah yang disebut); selain itu kosong (dibagi otomatis).
 */
export function halamanUntukPermintaan(prompt: string, sector: string): { halaman: HalamanDiminta[]; bawaan: boolean } {
  const tertulis = bacaHalamanDiminta(prompt);
  if (tertulis.length > 0) return { halaman: tertulis, bawaan: false };
  const minta = mintaBanyakHalaman(prompt);
  if (!minta) return { halaman: [], bawaan: false };
  const segmen = segmenBawaan(sector);
  return { halaman: typeof minta === 'number' ? segmen.slice(0, minta) : segmen, bawaan: true };
}

/** Kelompok bentuk: angka tunggal vs grafik/tabel. Kartu kembar hanya dalam kelompok yang sama. */
const angkaTunggal = (tipe: string) => ['kpi', 'bullet-target', 'gauge'].includes(tipe);

const kapital = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/**
 * Bersihkan judul balikan RAG: buang keterangan "— dasar: …", nama halaman
 * dalam kurung yang ikut terbawa dari pertanyaan, dan kurung yang terpotong.
 */
export function bersihkanJudulRag(judul: string, judulHalaman = ''): string {
  let t = String(judul ?? '').replace(/\s+/g, ' ');
  t = t.replace(/\s*[—–-]+\s*(?:dasar|sumber|berdasarkan)\b.*$/i, '');
  t = t.replace(/\s*[,;(]\s*(?:dasar|sumber|berdasarkan)\b.*$/i, '');
  if (judulHalaman) t = t.split(`(${judulHalaman})`).join(' ');
  // Kurung yang dibuka tapi tidak ditutup (judul terpotong): buang dari kurung itu.
  while ((t.match(/\(/g)?.length ?? 0) > (t.match(/\)/g)?.length ?? 0)) t = t.slice(0, t.lastIndexOf('('));
  t = t.replace(/\s{2,}/g, ' ').replace(/[\s,;:—–-]+$/, '').trim();
  if (t.length > 60) t = t.slice(0, 60).replace(/\s+\S*$/, '');
  return kapital(t);
}

/**
 * Judul kartu untuk widget yang diambil demi satu butir. Mengembalikan `null`
 * bila datanya bukan tentang butir itu: RAG kadang memberi data tetangga
 * (diminta "tren kualitas layanan", dibalas air terjual bulanan), dan kartu
 * seperti itu menyesatkan bila diberi judul butir.
 *
 * - Cocok kuat dan bentuknya sesuai (tren -> grafik, angka -> KPI): judul butir.
 * - Cocok sebagian, atau bentuknya diturunkan: judul RAG yang sudah dibersihkan,
 *   karena judul itu yang menggambarkan isi kartunya.
 */
export function judulUntukButir(butir: string, w: WidgetSpec, judulHalaman = ''): string | null {
  const bersih = bersihkanJudulRag(w.title, judulHalaman);
  const skor = skorCocok(butir, [bersih, ...(w.chart?.series ?? []).map((s) => s.name)].join(' '));
  if (skor < AMBANG) return null;
  const bentukSesuai = angkaTunggal(tipeButir(butir)) === angkaTunggal(w.type);
  if (skor >= 0.75 && bentukSesuai) return rapikanJudulButir(butir);
  return bersih || null;
}

/** Widget ini metrik yang sama dengan salah satu kartu di `daftar` (sinonim ikut dikenali)? */
export function widgetKembar(w: WidgetSpec, daftar: WidgetSpec[]): boolean {
  return daftar.some(
    (x) =>
      angkaTunggal(x.type) === angkaTunggal(w.type) &&
      (skorCocok(w.title, teksWidget(x)) >= 0.75 || skorCocok(x.title, teksWidget(w)) >= 0.75)
  );
}

type KelasSatuan = 'uang' | 'persen' | 'orang' | 'volume' | 'waktu' | 'jumlah';

/** Kelas satuan dari teks satuan kartu ("Rp miliar", "%", "juta m³", "sambungan"). */
export function kelasSatuan(unit: string | undefined): KelasSatuan | null {
  const u = String(unit ?? '').toLowerCase();
  if (!u.trim()) return null;
  if (/m3|m³|meter kubik|liter|l\/d|lps/.test(u)) return 'volume';
  if (/\brp\b|rupiah|miliar|juta|triliun|ribu/.test(u)) return 'uang';
  if (/%|persen/.test(u)) return 'persen';
  if (/orang|pegawai|karyawan|jiwa/.test(u)) return 'orang';
  if (/\b(?:jam|hari|menit)\b/.test(u)) return 'waktu';
  if (/unit|sambungan|\bsr\b|tiket|kasus|pelanggan|kali|buah|program|kegiatan/.test(u)) return 'jumlah';
  return null;
}

/**
 * Satuan yang masuk akal untuk satu butir. `null` = tidak bisa ditebak (semua boleh).
 * Contoh: "jumlah pegawai" harus orang, bukan Rp (beban pegawai); "cakupan
 * pelayanan" harus persen, bukan jumlah sambungan.
 */
export function satuanUntukButir(butir: string): KelasSatuan[] | null {
  const b = butir.toLowerCase();
  const uang = /pendapatan|penerimaan|beban|biaya|laba|rugi|arus kas|\bkas\b|aset|modal|utang|ekuitas|belanja|ongkos|dividen|investasi|gaji/.test(b);
  if (/komposisi|porsi|proporsi|struktur|bauran|status|daftar|rincian/.test(b)) return null;
  if (/waktu|durasi|\blama\b|jam operasi/.test(b)) return ['waktu', 'persen'];
  if (/progres|capaian|realisasi|terhadap target/.test(b)) return uang ? ['persen', 'uang'] : ['persen', 'jumlah'];
  // Batas kata wajib: tanpa itu "operasional" terbaca "ope-rasio-nal" dan
  // "beban operasional" (Rp) dipaksa persen lalu ditolak.
  if (/\b(?:nrw|kehilangan air|cakupan|kepatuhan|rasio|persentase|tingkat|margin)\b/.test(b)) return ['persen'];
  if (uang) return ['uang'];
  if (/pegawai|karyawan|sdm|pekerja|pelatihan/.test(b)) return ['orang', 'jumlah', 'waktu'];
  if (/\bair\b|produksi|kapasitas|volume/.test(b)) return ['volume'];
  if (/pelanggan|sambungan|pengaduan|keluhan|tiket/.test(b)) return ['jumlah', 'orang'];
  return null;
}

/**
 * Apakah data balikan RAG benar-benar tentang butir ini? Ekstraksi kadang
 * memilih angka terdekat: "Jumlah pegawai" diisi beban pegawai Rp386,2 M,
 * "Program CSR" diisi beban lain-lain. Dua penjaga:
 * 1. Satuan kartu harus sesuai jenis butirnya.
 * 2. Potongan dokumen (sitasi) harus menyebut sebagian besar kata kunci butir.
 * Lebih baik kartu kosong daripada angka indikator lain berjudul butir.
 */
export function validasiDataButir(butir: string, w: WidgetSpec): { ok: boolean; alasan?: string } {
  const unit = w.kpi?.unit ?? w.chart?.unit ?? w.chart?.series?.[0]?.unit;
  const kelas = kelasSatuan(unit);
  const boleh = satuanUntukButir(butir);
  if (kelas && boleh && !boleh.includes(kelas)) return { ok: false, alasan: `satuan "${unit}" bukan satuan ${butir}` };
  const potongan = (w.citations ?? []).map((c) => c?.chunkSnippet ?? '').join(' ');
  if (potongan.trim().length >= 15) {
    const kunci = tokenBermakna(butir.replace(/\(.*?\)/g, ' ')).filter((t) => t !== 'progres');
    const ada = tokenBermakna(potongan);
    const kena = kunci.filter((k) => ada.some((t) => kataSama(k, t))).length;
    // Butir panjang (3+ kata kunci) cukup separuh: dokumen jarang memakai semua katanya.
    const ambang = kunci.length >= 3 ? 0.5 : 0.6;
    if (kunci.length > 0 && kena / kunci.length < ambang) return { ok: false, alasan: `sumber tidak menyebut ${butir}` };
  }
  return { ok: true };
}

/** Rapikan judul dari butir: "tren produksi bulanan per bulan" -> "Tren produksi bulanan". */
export function rapikanJudulButir(butir: string): string {
  const t = butir
    .replace(/bulanan\s+per\s+bulan\b|per\s+bulan\s+bulanan/i, 'bulanan')
    .replace(/tahunan\s+per\s+tahun\b|per\s+tahun\s+tahunan/i, 'tahunan')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return kapital(t);
}

/**
 * Label periode + sumber untuk kartu ("Okt 2026 · keuangan-kpi-bulanan-okt-2026.md").
 * Judul kartu memakai kata butir sehingga periode di judul RAG hilang; tanpa
 * label ini angka 2026 dan 2024 tampak setara.
 */
export function labelPeriodeSumber(w: WidgetSpec): string | undefined {
  const sumber = w.citations?.[0]?.docName;
  const periode = periodeWidget(w);
  const bagian = [periode ?? '', sumber ?? ''].filter(Boolean);
  return bagian.length ? bagian.join(' · ') : undefined;
}

/**
 * Periode satu widget dalam bentuk seragam. Satu sumber untuk field `periode`
 * DAN label subtitle, supaya keduanya tidak pernah berbeda. Urutan: judul RAG
 * (biasanya menyebut periode angkanya), field periode dari RAG, lalu potongan sumber.
 */
export function periodeWidget(w: Pick<WidgetSpec, 'title' | 'citations'> & { periode?: string }): string | undefined {
  return (
    periodeSeragam(w.title) ??
    periodeSeragam(w.periode ?? '') ??
    periodeSeragam(w.citations?.[0]?.chunkSnippet ?? '')
  );
}

const BULAN = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];
const POLA_BULAN = '(jan|feb|mar|apr|mei|may|jun|jul|agu|agt|aug|sep|okt|oct|nov|des|dec)[a-z]*';

/** Bulan apa pun ditulis tiga huruf baku: "Oktober"/"Oct" -> "Okt". */
const bulanBaku = (b: string) => {
  const k = b.toLowerCase().slice(0, 3);
  const baku = ({ may: 'mei', agt: 'agu', aug: 'agu', oct: 'okt', dec: 'des' } as Record<string, string>)[k] ?? k;
  return BULAN.includes(baku) ? kapital(baku) : kapital(k);
};

/**
 * Periode dalam satu bentuk seragam: "2024" (setahun penuh, termasuk
 * "Januari–Desember 2024"), "s.d. Okt 2026" (kumulatif), atau "Okt 2026".
 */
export function periodeSeragam(teks: string): string | undefined {
  const t = String(teks ?? '').toLowerCase();
  const setahun = new RegExp(`jan[a-z]*\\s*(?:[–—-]|s\\.?\\s?d\\.?|sampai|hingga)\\s*des[a-z]*\\s+(20\\d\\d)`).exec(t);
  if (setahun) return setahun[1];
  const kumulatif = new RegExp(`(?:s\\.?\\s?d\\.?|sampai(?: dengan)?|hingga)\\s+${POLA_BULAN}\\s+(20\\d\\d)`).exec(t);
  if (kumulatif) return `s.d. ${bulanBaku(kumulatif[1])} ${kumulatif[2]}`;
  const bulanan = new RegExp(`\\b${POLA_BULAN}\\s+(20\\d\\d)`).exec(t);
  if (bulanan) return `${bulanBaku(bulanan[1])} ${bulanan[2]}`;
  return /\b(20\d\d)\b/.exec(t)?.[1];
}
