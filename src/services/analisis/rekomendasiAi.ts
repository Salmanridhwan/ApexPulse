/**
 * REKOMENDASI AI — perencana dashboard yang dikerjakan oleh model RAG.
 *
 * Bukan aturan tetap: modul ini menyiapkan KATALOG BUTIR (dalam beberapa bentuk
 * tampil) dan DAFTAR CHART dari Template Chart, lalu membaca jawaban model.
 * Keputusan isi — halaman apa saja, butir mana, chart apa — datang dari model.
 *
 * Tiga hal yang menjaga hasilnya tidak monoton:
 *
 * 1. SATU BUTIR, TIGA BENTUK. Butir spreadsheet menyimpan periode sebagai SERI
 *    ("Jan", "Feb", …) dengan akun di sumbu-x. Digambar apa adanya, hanya
 *    bentuk multi-seri yang sah — hampir selalu garis tren. Karena itu tiap
 *    butir ditawarkan dalam varian: `tren` (akun jadi garis, periode jadi
 *    sumbu-x), `komposisi` (periode terakhir, akun jadi potongan), dan apa
 *    adanya. Dari varian itu chart yang sah bertambah banyak.
 *
 * 2. DAFTAR CHART DIBERIKAN UTUH. Model menerima seluruh katalog Template Chart
 *    beserta kegunaannya, bukan empat id per butir.
 *
 * 3. PENJAGA KERAGAMAN. Kalau satu jenis chart dipakai lebih dari dua kali di
 *    satu halaman, kartu berikutnya diganti alternatif yang tetap sah untuk
 *    butir itu.
 *
 * Yang tetap dijaga aplikasi: id butir harus dikenal, chart harus cocok dengan
 * bentuk data, tidak ada butir kembar, dan angka selalu dari butir asli.
 */

import type { ButirData, WidgetSpec } from '../../types';
import { bentukCocok } from '../chart/bentukCocok';
import { CHART_DEFAULT } from '../chart/chartDefault';
import { butirKeWidget } from './butirKeWidget';

export interface KartuRencana {
  id: string;
  chart?: string;
}

export interface HalamanRencana {
  judul: string;
  kartu: KartuRencana[];
}

export interface RencanaDashboard {
  judul: string;
  halaman: HalamanRencana[];
}

export interface HasilSusunAi {
  halaman: Array<{ judul: string; widgets: WidgetSpec[] }>;
  dipakai: string[];
  dibuang: string[];
}

export interface VarianButir {
  /** `btr-...` (apa adanya), `btr-...#tren`, atau `btr-...#komposisi`. */
  id: string;
  butir: ButirData;
  /** Chart katalog yang sah untuk varian ini. */
  charts: string[];
  /** Keterangan bentuk, dipakai di katalog yang dibaca model. */
  bentuk: string;
}

/**
 * Layanan RAG MENOLAK permintaan di atas 8000 karakter (`query` too long) dan
 * menjawab HTTP 422 tanpa penjelasan. Batas katalog menjaga total prompt aman;
 * butir di atas batas tidak ikut dikirim (tetap tersedia di Pilih Data).
 */
export const BATAS_KATALOG = 4600;

/**
 * Rasa penyusunan yang bisa dipilih pengguna.
 *
 * - `cepat`: katalog dipangkas dan halaman dibatasi 2-3. Model menjawab sekitar
 *   setengah menit, cukup untuk melihat bentuk dashboard lebih dulu.
 * - `seimbang`: keadaan sebelumnya (4-5 halaman, satu panggilan model).
 * - `mendalam`: dua putaran. Putaran kedua menerima varian yang belum terpakai,
 *   jadi lebih banyak butir masuk dan halamannya 6-8, tetapi waktunya 2-4 menit.
 */
export type ModeReko = 'cepat' | 'seimbang' | 'mendalam' | 'ultra';

export const MODE_REKO: Record<ModeReko, {
  nama: string;
  batasKatalog: number;
  maksVarian: number;
  halamanMin: number;
  halamanMaks: number;
  kartuMaks: number;
  putaran: number;
  perkiraan: string;
}> = {
  cepat: { nama: 'Cepat', batasKatalog: 1600, maksVarian: 40, halamanMin: 2, halamanMaks: 3, kartuMaks: 4, putaran: 1, perkiraan: '30–45 detik' },
  seimbang: { nama: 'Seimbang', batasKatalog: 4600, maksVarian: 120, halamanMin: 4, halamanMaks: 5, kartuMaks: 5, putaran: 1, perkiraan: '1–2 menit' },
  mendalam: { nama: 'Mendalam', batasKatalog: 4600, maksVarian: 120, halamanMin: 6, halamanMaks: 8, kartuMaks: 5, putaran: 2, perkiraan: '2–4 menit' },
  /**
   * Ultra: tiga putaran AI, halaman 10-14, 6 kartu per halaman.
   *
   * Batas panjang katalog tidak bisa dinaikkan lagi (layanan RAG menolak prompt
   * di atas 8000 karakter), jadi tambahan isi datang dari PUTARAN, bukan dari
   * katalog yang lebih panjang: tiap putaran hanya menerima varian yang belum
   * terpakai sehingga tidak ada halaman kembar.
   */
  ultra: { nama: 'Ultra', batasKatalog: 4600, maksVarian: 160, halamanMin: 10, halamanMaks: 14, kartuMaks: 6, putaran: 3, perkiraan: '8–12 menit' },
};

export const modeRekoSah = (x: unknown): ModeReko =>
  x === 'cepat' || x === 'mendalam' || x === 'seimbang' || x === 'ultra' ? x : 'seimbang';

const ringkasAngka = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(1)} T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)} M`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)} jt`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)} rb`;
  return String(Math.round(n));
};

/**
 * Varian tampil sebuah butir.
 *
 * - `#tren`: akun teratas (maks 5) jadi seri, periode jadi sumbu-x. Ini yang
 *   membuat garis/area/titik/bar-tumpuk benar-benar bisa dipakai.
 * - `#komposisi`: hanya periode terakhir, akun jadi kategori. Membuka donat,
 *   treemap, corong, radar, dan batang.
 */
export function varianButir(b: ButirData): VarianButir[] {
  const hasil: VarianButir[] = [
    { id: b.id, butir: b, charts: bentukCocok([b]).map((c) => String(c.id)), bentuk: 'apa adanya' },
  ];
  const seri = b.seri || [];
  const periode = b.periodeTersedia || [];
  if (seri.length < 2 || periode.length !== seri.length) return hasil;

  const akun = (seri[0]?.kategori || []).map((k) => String(k));
  if (akun.length === 0) return hasil;

  const total = akun.map((_, i) => seri.reduce((n, s) => n + Math.abs(Number(s.data?.[i]) || 0), 0));
  const teratas = akun
    .map((nama, i) => ({ nama, i, total: total[i] }))
    .filter((a) => a.total > 0)
    .sort((a, b2) => b2.total - a.total)
    .slice(0, 5);

  if (teratas.length > 0) {
    const tren: ButirData = {
      ...b,
      seri: teratas.map((a) => ({
        nama: a.nama.slice(0, 40),
        kategori: periode,
        data: seri.map((s) => Number(s.data?.[a.i]) || 0),
      })),
      periodeTersedia: undefined,
      bentukDisarankan: 'line',
    };
    hasil.push({ id: `${b.id}#tren`, butir: tren, charts: bentukCocok([tren]).map((c) => String(c.id)), bentuk: 'tren per akun' });
  }

  const akhir = seri[seri.length - 1];
  const dataAkhir = akun.map((_, i) => Number(akhir?.data?.[i]) || 0);
  /**
   * Komposisi dibatasi DELAPAN akun terbesar. Lembar anggaran bisa punya 36
   * akun; donat 36 potongan tidak terbaca, dan membatasi ke delapan membuat
   * bentuk komposisi (donat, treemap, radar, corong) tetap bisa dipakai.
   */
  /**
   * Hanya akun bernilai POSITIF yang masuk komposisi. Akun minus bukan bagian
   * dari "bagian dari total" dan membuat donat/treemap tidak sah.
   */
  const posisiKomposisi = akun
    .map((_, i) => i)
    .filter((i) => dataAkhir[i] > 0)
    .sort((a, b2) => dataAkhir[b2] - dataAkhir[a])
    .slice(0, 8);
  const bisaKomposisi = posisiKomposisi.length >= 2;
  if (bisaKomposisi) {
    const komposisi: ButirData = {
      ...b,
      seri: [{ nama: 'Nilai', kategori: posisiKomposisi.map((i) => akun[i]), data: posisiKomposisi.map((i) => dataAkhir[i]) }],
      periodeTersedia: undefined,
      bentukDisarankan: 'donut',
    };
    hasil.push({
      id: `${b.id}#komposisi`,
      butir: komposisi,
      charts: bentukCocok([komposisi]).map((c) => String(c.id)),
      bentuk: `komposisi periode ${periode[periode.length - 1] || 'terakhir'}`,
    });
  }

  return hasil;
}

/**
 * Urutan chart yang ditampilkan per bentuk.
 *
 * Tanpa ini, empat chart pertama selalu sama (batang mendatar, garis, area,
 * titik) dan donat/treemap/radar tidak pernah terlihat model — itulah sebab
 * dashboard terasa monoton walau katalognya 38 chart.
 */
const PREFERENSI: Record<'asli' | 'tren' | 'komposisi', string[]> = {
  tren: ['garis-tren', 'area-gradasi', 'area-banding', 'bar-tumpuk', 'combo-batang-garis', 'titik-bersumbu', 'bar-mendatar-peringkat'],
  komposisi: ['donat-tebal', 'donat-tipis', 'treemap-porsi', 'corong-pipeline', 'alur-tahap', 'radar-aspek', 'bar-kapsul', 'bar-mendatar-peringkat'],
  asli: ['bar-mendatar-peringkat', 'bar-tegak', 'garis-tren', 'area-gradasi', 'titik-bersumbu', 'bar-tumpuk', 'combo-batang-garis'],
};

function urutkanChart(charts: string[], bentuk: 'asli' | 'tren' | 'komposisi'): string[] {
  const prioritas = PREFERENSI[bentuk];
  return [...charts].sort((a, b) => {
    const ia = prioritas.indexOf(a);
    const ib = prioritas.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

/**
 * Baris katalog satu varian. Sengaja RAMPAT: satu baris ±100 karakter, supaya
 * puluhan varian (bukan belasan) bisa dikirim dalam batas 8000 karakter.
 * Bentuk singkat: `asli`, `tren`, `komposisi`.
 */
function barisVarian(v: VarianButir): string {
  const b = v.butir;
  const seri = b.seri || [];
  const data = seri.flatMap((s) => (s.data || []).map(Number)).filter((n) => Number.isFinite(n));
  const puncak = data.length ? Math.max(...data.map(Math.abs)) : 0;
  const bentuk = v.id.endsWith('#tren') ? 'tren' : v.id.endsWith('#komposisi') ? 'komposisi' : 'asli';
  const charts = urutkanChart(
    v.charts.filter((id) => id !== 'tabel-ringkas'),
    bentuk
  ).slice(0, 5);
  return [
    v.id,
    String(b.nama || '').slice(0, 42),
    String(b.kategori || 'umum'),
    bentuk,
    puncak ? `~${ringkasAngka(puncak)}` : b.nilai !== undefined && b.nilai !== null ? `~${ringkasAngka(Number(b.nilai))}` : '',
    charts.join(','),
  ]
    .filter(Boolean)
    .join('|');
}

/**
 * Daftar seluruh Template Chart, dikirim sekali ke model.
 *
 * Sengaja hanya id + nama: keterangan kegunaan sudah dirangkum di aturan prompt
 * (tren / komposisi / peringkat / progres / rincian), dan layanan RAG menolak
 * permintaan di atas 8000 karakter.
 */
export function daftarChart(): string {
  return Object.values(CHART_DEFAULT)
    .map((c) => `- ${c.id} = ${c.nama}`)
    .join('\n');
}

/**
 * Katalog yang dikirim ke model: butir bertitik banyak didahulukan, tiap butir
 * boleh muncul sebagai beberapa varian, dan panjangnya dijaga di bawah batas.
 */
export function katalogUntukAi(daftar: ButirData[], maks = 120, batas = BATAS_KATALOG): {
  teks: string;
  jumlah: number;
  varian: Map<string, ButirData>;
} {
  const layak = daftar.filter((b) => {
    const adaNilai = b.nilai !== undefined && b.nilai !== null && Number.isFinite(Number(b.nilai));
    const adaDeret = (b.seri || []).some((s) => (s.data || []).some((v) => Number(v) !== 0 && Number.isFinite(Number(v))));
    return adaNilai || adaDeret;
  });
  const panjang = (x: ButirData) => (x.periodeTersedia?.length || 0) * 10 + (x.seri?.[0]?.data?.length || 0);

  /**
   * Giliran antar-kategori: tanpa ini, katalog hanya berisi satu kategori yang
   * kebetulan punya deret paling panjang, dan halaman lain jadi kosong.
   */
  const perKategori = new Map<string, ButirData[]>();
  for (const b of [...layak].sort((a, b2) => panjang(b2) - panjang(a))) {
    const k = String(b.kategori || 'umum');
    perKategori.set(k, [...(perKategori.get(k) || []), b]);
  }
  const kelompok = [...perKategori.values()];
  const urut: ButirData[] = [];
  for (let i = 0; kelompok.some((g) => g.length > i); i += 1) {
    for (const g of kelompok) if (g[i]) urut.push(g[i]);
  }

  const baris: string[] = [];
  const varian = new Map<string, ButirData>();
  let total = 0;
  let jumlah = 0;

  for (const b of urut) {
    if (jumlah >= maks) break;
    /**
     * Untuk butir multi-periode, varian `#tren` dan `#komposisi` yang dibawa
     * lebih dulu: bentuk "apa adanya" hanya membuka empat chart yang sama dan
     * itulah yang membuat dashboard terasa monoton.
     */
    const semua = varianButir(b).filter((v) => v.charts.length > 0);
    const calon = [...semua.filter((v) => v.id.includes('#')), ...semua.filter((v) => !v.id.includes('#'))];
    for (const v of calon) {
      const teks = `- ${barisVarian(v)}`;
      if (total + teks.length + 1 > batas) continue;
      baris.push(teks);
      varian.set(v.id, v.butir);
      total += teks.length + 1;
      jumlah += 1;
    }
  }

  return { teks: baris.join('\n'), jumlah, varian };
}

/**
 * Skema keluaran untuk `/extract`. Bentuk ini yang membuat model menjawab
 * sebagai RENCANA (halaman + kartu), bukan sebagai angka hasil ekstraksi.
 */
export const SKEMA_RENCANA = {
  type: 'object',
  properties: {
    judul: { type: 'string' },
    halaman: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          judul: { type: 'string' },
          kartu: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'id varian dari katalog' },
                chart: { type: 'string', description: 'id chart dari daftar chart pada baris katalog' },
              },
              required: ['id', 'chart'],
            },
          },
        },
        required: ['judul', 'kartu'],
      },
    },
  },
  required: ['judul', 'halaman'],
};

export function buatPrompt(
  katalog: string,
  jumlahButir: number,
  permintaan = '',
  mode: ModeReko = 'seimbang',
  lanjutan: boolean | number = false,
  putaranKe = 2,
): string {
  const m = MODE_REKO[mode];
  const aturanHalaman = lanjutan
    ? [
        `1. Ini PUTARAN LANJUTAN ${putaranKe} dari ${m.putaran}: varian di bawah BELUM terpakai. Susun ${m.halamanMin} sampai ${m.halamanMaks} halaman TAMBAHAN dari varian itu.`,
        '2. Jangan mengulang topik halaman yang sudah ada; pilih sudut pandang lain (mis. per wilayah, per vendor, per jenis belanja, capaian target).',
        `3. Tiap halaman WAJIB ${m.kartuMaks} kartu. Halaman dengan 1-2 kartu tidak dipakai.`,
      ]
    : [
        `1. Susun ${m.halamanMin} sampai ${m.halamanMaks} halaman. Halaman pertama berjudul "Ringkasan".`,
        '2. Halaman Ringkasan: 3-4 kartu angka (chart kpi-kartu atau kpi-strip), lalu 1-2 grafik terpenting.',
        `3. Halaman berikutnya per topik (mis. Keuangan, Pengadaan, Operasional, Kinerja). Tiap halaman WAJIB ${Math.min(4, m.kartuMaks)}-${m.kartuMaks} kartu; halaman dengan 1-2 kartu tidak dipakai.`,
      ];
  return [
    'Anda perancang dashboard untuk instansi pemerintah/BUMD.',
    'Anda TIDAK perlu membaca dokumen: seluruh data sudah diekstrak dan ada di KATALOG.',
    'Tugas Anda: menyusun dashboard beberapa halaman dari katalog itu.',
    permintaan ? `Permintaan pengguna: "${permintaan}"` : 'Permintaan pengguna: susun dashboard lengkap yang layak dipresentasikan.',
    '',
    'DAFTAR CHART TEMPLATE (pakai id-nya):',
    daftarChart(),
    '',
    'KATALOG BUTIR (id | nama | kategori | bentuk | isi | puncak | akhir | chart yang sah):',
    katalog,
    '',
    `Jumlah varian tersedia: ${jumlahButir}.`,
    '',
    'ATURAN:',
    ...aturanHalaman,
    '4. Satu id varian hanya boleh muncul di satu halaman.',
    '5. chart WAJIB diambil dari daftar chart pada baris katalog varian itu.',
    `6. KERAGAMAN: pakai minimal ${mode === 'cepat' ? 4 : 7} jenis chart berbeda dalam satu dashboard. Dalam satu halaman, garis-tren paling banyak SATU; sisanya pakai bentuk lain yang sah untuk butir itu.`,
    '7. Pilih bentuk sesuai isi: tren untuk deret waktu (garis-tren, area-gradasi, area-banding, bar-tumpuk, combo-batang-garis), komposisi untuk bagian dari total (donat-tebal, donat-tipis, treemap-porsi, corong-pipeline, alur-tahap, radar-aspek), peringkat untuk banyak kategori (bar-mendatar-peringkat, bar-tegak, bar-kapsul), progres untuk capaian (daftar-progres, progres-target), rincian untuk angka (tabel-ringkas, tabel-status).',
    '8. Judul halaman 1-2 kata. Judul dashboard maksimal 8 kata, tanpa tanda kutip.',
    '',
    'Balas HANYA JSON murni:',
    '{"judul":"...","halaman":[{"judul":"Ringkasan","kartu":[{"id":"btr-...#tren","chart":"garis-tren"}]}]}',
  ].join('\n');
}

/**
 * Ambil JSON dari jawaban model. Model kadang membungkus dengan ```json atau
 * menulis kalimat pembuka; yang diambil blok objek pertama yang seimbang.
 */
export function bacaRencana(jawaban: unknown): RencanaDashboard | null {
  const teks = String(jawaban ?? '').trim();
  if (!teks) return null;
  const mulai = teks.indexOf('{');
  if (mulai < 0) return null;
  let dalam = 0;
  let kutip = false;
  let escape = false;
  for (let i = mulai; i < teks.length; i += 1) {
    const c = teks[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\') {
      escape = true;
      continue;
    }
    if (c === '"') kutip = !kutip;
    if (kutip) continue;
    if (c === '{') dalam += 1;
    if (c === '}') {
      dalam -= 1;
      if (dalam === 0) {
        try {
          const isi = JSON.parse(teks.slice(mulai, i + 1));
          const halamanMentah = Array.isArray(isi?.halaman) ? isi.halaman : Array.isArray(isi?.pages) ? isi.pages : [];
          const halaman: HalamanRencana[] = halamanMentah
            .map((h: any) => ({
              judul: String(h?.judul ?? h?.title ?? '').trim(),
              kartu: (Array.isArray(h?.kartu) ? h.kartu : Array.isArray(h?.widgets) ? h.widgets : [])
                .map((k: any) => ({
                  id: String(k?.id ?? k?.butirId ?? '').trim(),
                  chart: k?.chart ? String(k.chart).trim() : undefined,
                }))
                .filter((k: KartuRencana) => k.id.length > 0),
            }))
            .filter((h: HalamanRencana) => h.judul.length > 0 && h.kartu.length > 0);
          if (halaman.length === 0) return null;
          return { judul: String(isi?.judul ?? isi?.title ?? 'Dashboard Rekomendasi').trim(), halaman };
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Tata letak satu halaman: satu kartu besar, dua pendamping, lalu kartu lebar.
 * Model menentukan ISI dan urutannya; ukuran kartu ditentukan di sini supaya
 * halaman tidak terlihat seperti tabel kartu seukuran sama. Grid 12 kolom.
 */
const SLOT_KPI: Array<{ x: number; y: number; w: number; h: number }> = [
  { x: 0, y: 0, w: 3, h: 2 },
  { x: 3, y: 0, w: 3, h: 2 },
  { x: 6, y: 0, w: 3, h: 2 },
  { x: 9, y: 0, w: 3, h: 2 },
];
const SLOT_SETELAH_KPI: Array<{ x: number; y: number; w: number; h: number }> = [
  { x: 0, y: 2, w: 8, h: 4 },
  { x: 8, y: 2, w: 4, h: 2 },
  { x: 8, y: 4, w: 4, h: 2 },
];
const SLOT_HALAMAN: Array<{ x: number; y: number; w: number; h: number }> = [
  { x: 0, y: 0, w: 7, h: 4 },
  { x: 7, y: 0, w: 5, h: 2 },
  { x: 7, y: 2, w: 5, h: 2 },
  { x: 0, y: 4, w: 6, h: 2 },
  { x: 6, y: 4, w: 6, h: 2 },
  { x: 0, y: 6, w: 4, h: 2 },
  { x: 4, y: 6, w: 4, h: 2 },
  { x: 8, y: 6, w: 4, h: 2 },
];

/**
 * Pola untuk halaman yang isinya sedikit. Halaman dua kartu tetap terlihat
 * disengaja (dua kartu besar berdampingan), bukan sisa ruang kosong.
 */
const POLA_SEDIKIT: Record<number, Array<{ x: number; y: number; w: number; h: number }>> = {
  1: [{ x: 0, y: 0, w: 12, h: 6 }],
  2: [
    { x: 0, y: 0, w: 6, h: 6 },
    { x: 6, y: 0, w: 6, h: 6 },
  ],
  3: [
    { x: 0, y: 0, w: 7, h: 6 },
    { x: 7, y: 0, w: 5, h: 3 },
    { x: 7, y: 3, w: 5, h: 3 },
  ],
  4: [
    { x: 0, y: 0, w: 6, h: 3 },
    { x: 6, y: 0, w: 6, h: 3 },
    { x: 0, y: 3, w: 6, h: 3 },
    { x: 6, y: 3, w: 6, h: 3 },
  ],
  6: [
    { x: 0, y: 0, w: 7, h: 4 },
    { x: 7, y: 0, w: 5, h: 2 },
    { x: 7, y: 2, w: 5, h: 2 },
    { x: 0, y: 4, w: 4, h: 2 },
    { x: 4, y: 4, w: 4, h: 2 },
    { x: 8, y: 4, w: 4, h: 2 },
  ],
};

/**
 * Judul kartu dirapikan untuk tampilan: spasi berlebih dibuang, judul yang
 * seluruhnya huruf besar (label lembar seperti "RINCIAN") dijadikan huruf
 * kapital biasa. Nama asli butir tidak diubah, hanya tampilan kartunya.
 */
function rapiJudul(teks: string): string {
  const t = String(teks || '').replace(/\s+/g, ' ').trim();
  if (!t) return t;
  if (t === t.toUpperCase() && t.length > 3 && /[A-Z]/.test(t)) {
    return t.charAt(0) + t.slice(1).toLowerCase();
  }
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const adalahKpi = (id?: string) => !!id && /^(kpi|kpi-kartu|kpi-strip|gauge)$/.test(id);

/**
 * Keluarga bentuk. Penjaga keragaman memakai ini, bukan id satu per satu:
 * donat + treemap + corong + radar semuanya "komposisi", dan halaman berisi
 * empat komposisi terasa sama monotonnya dengan empat garis tren.
 */
function keluarga(id: string): string {
  if (/^(kpi|progres-target|kpi-target|gauge|cincin|strip-os)/.test(id)) return 'angka';
  if (/^(garis|area|bar-tumpuk|combo|titik|kotak-sebaran)/.test(id)) return 'tren';
  if (/^(donat|treemap|corong|alur|radar|sankey|bar-kapsul|air-terjun)/.test(id)) return 'komposisi';
  if (/^bar-/.test(id)) return 'peringkat';
  return 'tabel';
}

/** Batas satu keluarga bentuk dalam satu halaman. */
const BATAS_KELUARGA = 2;

/**
 * Butir deret tidak punya `nilai` tunggal, tetapi model sering memintanya sebagai
 * kartu angka. Nilainya diambil dari titik terakhir yang terisi (bukan rata-rata):
 * itulah angka yang dibaca orang saat melihat ringkasan.
 */
function jadikanKpi(b: ButirData): ButirData {
  if (b.nilai !== undefined && b.nilai !== null) return b;
  const data = (b.seri || [])[0]?.data || [];
  const terisi = data.map(Number).filter((v) => Number.isFinite(v) && v !== 0);
  if (terisi.length === 0) return b;
  const akhir = terisi[terisi.length - 1];
  const sebelum = terisi.length > 1 ? terisi[terisi.length - 2] : undefined;
  const delta = sebelum && sebelum !== 0 ? Math.round(((akhir - sebelum) / Math.abs(sebelum)) * 1000) / 10 : undefined;
  return {
    ...b,
    nilai: akhir,
    seri: [],
    periodeTersedia: undefined,
    ...(delta !== undefined ? { delta, deltaLabel: 'vs periode sebelumnya' } : {}),
  } as ButirData;
}

/**
 * Rencana model → halaman berisi kartu nyata.
 * Varian dicari lewat id (`#tren` / `#komposisi`), butir asing dibuang, chart
 * yang tidak sah diganti pilihan pertama yang sah.
 */
export function susunDariRencana(rencana: RencanaDashboard, daftar: ButirData[]): HasilSusunAi {
  const varian = new Map<string, ButirData>();
  for (const b of daftar) for (const v of varianButir(b)) varian.set(v.id, v.butir);

  const dipakai: string[] = [];
  const dibuang: string[] = [];
  const sudah = new Set<string>();
  const halaman: HasilSusunAi['halaman'] = [];

  for (const h of rencana.halaman) {
    const widgets: WidgetSpec[] = [];
    /** Keragaman isi halaman: jenis chart dan keluarga bentuk yang sudah muncul. */
    const jenis = new Map<string, number>();
    const keluargaTerpakai = new Map<string, number>();

    for (const k of h.kartu) {
      const asli = varian.get(k.id);
      const kunciButir = k.id.split('#')[0];
      if (!asli || sudah.has(kunciButir)) {
        dibuang.push(k.id);
        continue;
      }
      const mintaKpi = adalahKpi(k.chart);
      const b = mintaKpi ? jadikanKpi(asli) : asli;
      const sah = bentukCocok([b]).map((c) => String(c.id));
      let chart = mintaKpi
        ? sah.includes('kpi-kartu')
          ? 'kpi-kartu'
          : sah.includes('kpi-strip')
            ? 'kpi-strip'
            : undefined
        : k.chart && sah.includes(k.chart)
          ? k.chart
          : sah[0];

      /**
       * Penjaga keragaman: jenis chart yang sudah dipakai dua kali di halaman
       * ini diganti alternatif berikutnya yang sah untuk butir itu.
       */
      /**
       * Garis dan area paling banyak sekali per halaman; keluarga bentuk paling
       * banyak dua kali. Alternatif diambil dari keluarga yang masih lapang.
       */
      if (chart && !mintaKpi) {
        const batasJenis = chart === 'garis-tren' || chart === 'area-gradasi' ? 1 : 2;
        const penuhKarenaJenis = (jenis.get(chart) || 0) >= batasJenis;
        const penuhKarenaKeluarga = (keluargaTerpakai.get(keluarga(chart)) || 0) >= BATAS_KELUARGA;
        if (penuhKarenaJenis || penuhKarenaKeluarga) {
          const alternatif = sah.filter(
            (id) =>
              id !== 'kpi-kartu' &&
              (jenis.get(id) || 0) === 0 &&
              (keluargaTerpakai.get(keluarga(id)) || 0) < BATAS_KELUARGA
          );
          if (alternatif.length > 0) chart = alternatif[0];
        }
      }
      if (!chart) {
        dibuang.push(k.id);
        continue;
      }

      const w = butirKeWidget(b, widgets.length + 1, { chartId: chart });
      if (!w) {
        dibuang.push(k.id);
        continue;
      }
      jenis.set(chart, (jenis.get(chart) || 0) + 1);
      keluargaTerpakai.set(keluarga(chart), (keluargaTerpakai.get(keluarga(chart)) || 0) + 1);
      widgets.push({ ...w, title: rapiJudul(String(w.title || '')) });
      sudah.add(kunciButir);
      dipakai.push(k.id);
    }
    if (widgets.length > 0) halaman.push({ judul: h.judul, widgets });
  }

  return { halaman: tataRapiHalaman(halaman), dipakai, dibuang };
}

/**
 * TATA LETAK RAPI UNTUK SATU DASHBOARD.
 *
 * Dipakai dua tempat: saat menyusun dashboard baru dari rencana model, dan saat
 * merapikan dashboard lama yang halamannya masih bertinggi empat baris atau
 * berisi satu kartu. Semua halaman keluar dengan tinggi ENAM baris grid dan
 * terisi penuh 72 sel.
 *
 * Aturannya:
 * - halaman berisi satu kartu tidak berdiri sendiri; kartunya pindah ke halaman
 *   pertama yang masih lapang (maksimal enam kartu);
 * - jumlah kartu menentukan pola: 1 = `12x6`, 2 = `6x6 + 6x6`, 3 = `7x6 + 5x3 +
 *   5x3`, 4 = empat `6x3`, 5 = pola hero, 6 = hero + tiga kartu bawah;
 * - halaman dengan dua kartu KPI atau lebih memakai baris KPI `3x2` di atas,
 *   lalu hero `8x4` dan dua pendamping `4x2`.
 */
export function tataRapiHalaman(
  halaman: Array<{ judul: string; widgets: WidgetSpec[] }>
): Array<{ judul: string; widgets: WidgetSpec[] }> {
  const gabung: Array<{ judul: string; widgets: WidgetSpec[] }> = [];
  for (const h of halaman) {
    if (h.widgets.length <= 1) {
      const lapang = gabung.find((g) => g.widgets.length + h.widgets.length <= 6);
      if (lapang) {
        lapang.widgets.push(...h.widgets);
        continue;
      }
    }
    gabung.push(h);
  }

  return gabung.map((h) => {
    const banyakKpi = h.widgets.filter((w) => adalahKpi(w.chartId) || w.type === 'kpi').length >= 2;
    // Lima slot = enam baris grid; lebih dari itu halaman harus digulir.
    const pola = banyakKpi ? [...SLOT_KPI, ...SLOT_SETELAH_KPI] : POLA_SEDIKIT[h.widgets.length] || SLOT_HALAMAN.slice(0, 5);
    const urut = banyakKpi
      ? [...h.widgets].sort(
          (a, b2) => Number(!(adalahKpi(a.chartId) || a.type === 'kpi')) - Number(!(adalahKpi(b2.chartId) || b2.type === 'kpi'))
        )
      : h.widgets;
    return {
      judul: h.judul,
      widgets: urut.slice(0, pola.length).map((w, i) => ({ ...w, grid: pola[i] })),
    };
  });
}
