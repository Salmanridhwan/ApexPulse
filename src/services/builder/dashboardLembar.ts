/**
 * DASHBOARD DARI DOKUMEN SPREADSHEET (xlsx/xls/csv) YANG DISEBUT PENGGUNA.
 *
 * Layanan RAG tidak bisa merangkum tabel Excel besar: uji 4 Nov 2026,
 * "dashboard dari dokumen Piutang 2026" (869 baris transaksi) membuat /extract
 * mengambil laporan PDF lain, lalu dashboard gagal. Di sini tabelnya dibaca
 * apa adanya dan kartunya dihitung sendiri, dari dua sumber:
 *
 * 1. BERKAS ASLI di repositori (lengkap): semua baris terbaca, angka pasti.
 * 2. POTONGAN TEKS RAG (bila berkas asli tidak ada): potongan berbentuk
 *    "Lembar: X ... baris 12: A=.. | B=..". Tidak semua potongan bisa diambil,
 *    jadi kartu ringkasan memakai baris "Total" milik dokumen sendiri, dan
 *    rincian per kategori diberi catatan berapa baris yang terbaca.
 *
 * MURNI (tanpa I/O) supaya bisa diuji.
 */

import * as XLSX from 'xlsx';
import type { Citation, WidgetSpec } from '../../types';
import { keAngka, type SelNilai } from '../impor/tabel';

export interface Lembar {
  nama: string;
  /** Nomor baris (1-based seperti Excel) -> sel per indeks kolom (A = 0). */
  baris: Map<number, SelNilai[]>;
}

export interface SumberLembar {
  jenis: 'berkas' | 'potongan';
  lembar: Lembar[];
  /** true = semua baris terbaca (berkas asli). */
  lengkap: boolean;
}

// ---------------------------------------------------------------------------
// Membaca sumber
// ---------------------------------------------------------------------------

/** Semua lembar berkas xlsx/xls/csv sebagai matriks baris bernomor. */
export function lembarDariBerkas(buffer: Buffer): Lembar[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: true });
  return wb.SheetNames.map((nama) => {
    const matriks = XLSX.utils.sheet_to_json<SelNilai[]>(wb.Sheets[nama], { header: 1, defval: null, raw: true, blankrows: true });
    const baris = new Map<number, SelNilai[]>();
    matriks.forEach((r, i) => {
      if (r.some((v) => v !== null && String(v).trim() !== '')) baris.set(i + 1, r);
    });
    return { nama, baris };
  });
}

const indeksKolom = (huruf: string): number =>
  huruf.toUpperCase().split('').reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1;

/**
 * Susun lembar dari potongan teks RAG. Baris yang terpotong di dua potongan
 * digabung (sel yang sama tidak ditimpa); potongan tanpa "Lembar:" ikut lembar
 * terakhir yang dikenal.
 */
export function lembarDariPotongan(potongan: string[]): Lembar[] {
  const peta = new Map<string, Lembar>();
  let lembarTerakhir = 'Lembar 1';
  for (const teks of potongan) {
    const nama = String(teks).match(/Lembar:\s*([^\n]+)/)?.[1]?.trim();
    const namaLembar = nama || lembarTerakhir;
    lembarTerakhir = namaLembar;
    if (!peta.has(namaLembar)) peta.set(namaLembar, { nama: namaLembar, baris: new Map() });
    const lembar = peta.get(namaLembar)!;
    const pola = /baris (\d+):\s*([\s\S]*?)(?=\s*baris \d+:|$)/g;
    const semua = [...String(teks).matchAll(pola)];
    // Satu potongan bisa memuat ekor lembar sebelumnya lalu "baris 1" lembar
    // berikutnya; label "Lembar:" milik lembar yang dimulai di situ. Baris
    // sebelum nomor mengulang dibuang supaya tidak tercampur antarlembar.
    const ulang = semua.findIndex((m, i) => i > 0 && Number(m[1]) < Number(semua[i - 1][1]) - 5);
    for (const m of ulang > 0 ? semua.slice(ulang) : semua) {
      const no = Number(m[1]);
      const sel = lembar.baris.get(no) ?? [];
      for (const bagian of m[2].split('|')) {
        const s = bagian.match(/^\s*([A-Z]{1,3})=(.*)$/s);
        if (!s) continue;
        const i = indeksKolom(s[1]);
        const nilai = s[2].replace(/\s*Lembar:.*$/s, '').trim();
        if (sel[i] === undefined || sel[i] === null || sel[i] === '') sel[i] = nilai === '' ? null : nilai;
      }
      lembar.baris.set(no, sel);
    }
  }
  return [...peta.values()].filter((l) => l.baris.size > 0);
}

/**
 * Kumpulkan potongan satu dokumen lewat pencarian. /search hanya mengembalikan
 * potongan yang paling mirip kueri (±8 per dokumen), jadi kuerinya bervariasi:
 * nama dokumen, nama lembar, bulan, lalu nilai sel yang sudah terbaca (nama
 * pelanggan, cabang, ...) sampai tidak ada potongan baru atau batas tercapai.
 */
export async function kumpulkanPotonganLembar(
  cari: (kueri: string) => Promise<Array<{ docName: string; isi: string }>>,
  namaDokumen: string,
  opsi: { targetPotongan?: number; maksKueri?: number } = {}
): Promise<string[]> {
  const unik = new Map<string, string>();
  const dasar = namaDokumen.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_\-.]+/g, ' ').trim();
  const sudah = new Set<string>();
  const antre = [
    dasar,
    `${dasar} isi lengkap`,
    `Lembar ${dasar}`,
    `${dasar} baris 1 judul kolom`,
    `${dasar} total`,
    ...['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((b) => `${dasar} ${b}`),
  ];
  const maks = opsi.maksKueri ?? 45;
  let tanpaBaru = 0;
  while (antre.length > 0 && sudah.size < maks) {
    const q = antre.shift()!;
    if (sudah.has(q)) continue;
    sudah.add(q);
    const sebelum = unik.size;
    const hasil = await cari(q).catch(() => []);
    for (const p of hasil) {
      if (!p?.isi || !cocokNamaDokumen(p.docName, namaDokumen)) continue;
      unik.set(p.isi.slice(0, 160), p.isi);
    }
    if (opsi.targetPotongan && unik.size >= opsi.targetPotongan) break;
    tanpaBaru = unik.size === sebelum ? tanpaBaru + 1 : 0;
    if (tanpaBaru >= 8) break;
    // Kueri lanjutan dari isi yang sudah terbaca: nilai teks sel yang sering muncul.
    if (antre.length === 0) {
      const frek = new Map<string, number>();
      for (const isi of unik.values())
        for (const m of isi.matchAll(/[A-Z]{1,2}=([A-Za-z][^|\n]{3,60})/g)) {
          const v = m[1].trim().split(/\s+/).slice(0, 4).join(' ');
          frek.set(v, (frek.get(v) ?? 0) + 1);
        }
      [...frek.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([v]) => `${dasar} ${v}`)
        .filter((q2) => !sudah.has(q2))
        .slice(0, 20)
        .forEach((q2) => antre.push(q2));
    }
  }
  return [...unik.values()];
}

/** Nama dokumen di hasil pencarian = dokumen target (tanpa ekstensi/tanda baca). */
function cocokNamaDokumen(a: unknown, b: unknown): boolean {
  const n = (x: unknown) => String(x || '').toLowerCase().replace(/\.[a-z0-9]{2,5}$/, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const x = n(a);
  const y = n(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
}

// ---------------------------------------------------------------------------
// Analisis lembar
// ---------------------------------------------------------------------------

const teksSel = (v: SelNilai | undefined) => (v === null || v === undefined ? '' : String(v).trim());
const BARIS_TOTAL = /^(grand\s*)?(total|jumlah|sub\s*total)\b/i;
const KOLOM_KODE = /^no\.?$|^no\s|nomor|kode|^id\b|npwp|telp|telepon|hp\b|rekening|akun piutang|invoice|faktur|^ref/i;
const KOLOM_TANGGAL = /tanggal|tgl|date|jatuh tempo/i;
/** Kolom lama waktu/persen: tidak bermakna bila dijumlahkan. */
const KOLOM_TAK_DIJUMLAH = /umur|aging|hari|days|lama|tenor|persen|%|rasio/i;
const KOLOM_UANG = /saldo|sisa|nilai|piutang|tagihan|harga|biaya|pendapatan|penjualan|rp|amount|ppn|pph|dpp|bayar|pembayaran|total|jumlah|outstanding|anggaran|realisasi/i;
const KOLOM_UTAMA = /saldo|sisa|outstanding|total|jumlah|nilai|piutang|tagihan|amount/i;
const KOLOM_KATEGORI = /nama|pelanggan|customer|klien|mitra|akun|cabang|wilayah|area|unit|divisi|bagian|kategori|jenis|status|proyek|vendor|umur|aging/i;

interface Kolom {
  indeks: number;
  nama: string;
  jenis: 'angka' | 'tanggal' | 'teks';
}

export interface AnalisisLembar {
  lembar: Lembar;
  noHeader: number;
  kolom: Kolom[];
  data: Array<{ no: number; sel: SelNilai[] }>;
  total?: SelNilai[];
  /** Perkiraan jumlah baris data di dokumen (dari nomor baris terakhir). */
  perkiraanBaris: number;
}

function cariHeader(lembar: Lembar): number | undefined {
  const nomor = [...lembar.baris.keys()].sort((a, b) => a - b).filter((n) => n <= 25);
  let terbaik: { no: number; skor: number } | undefined;
  for (const no of nomor) {
    const sel = lembar.baris.get(no)!;
    const teks = sel.filter((v) => teksSel(v) && keAngka(v) === null).length;
    if (teks >= 3 && (!terbaik || teks > terbaik.skor)) terbaik = { no, skor: teks };
  }
  return terbaik?.no;
}

const tanggalDari = (v: SelNilai): Date | null => {
  const t = teksSel(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const d = new Date(t.slice(0, 10));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // Nomor seri tanggal Excel (1990-2100).
  const n = typeof v === 'number' ? v : /^\d{5}(\.\d+)?$/.test(t) ? Number(t) : NaN;
  if (n >= 32874 && n <= 73051) return new Date(Math.round((n - 25569) * 86400000));
  return null;
};

export function analisisLembar(lembar: Lembar): AnalisisLembar | undefined {
  const noHeader = cariHeader(lembar);
  if (noHeader === undefined) return undefined;
  const header = lembar.baris.get(noHeader)!;
  const semua = [...lembar.baris.entries()].filter(([no]) => no > noHeader).sort((a, b) => a[0] - b[0]);
  const adalahTotal = (sel: SelNilai[]) => sel.slice(0, 4).some((v) => BARIS_TOTAL.test(teksSel(v)));
  const totalBaris = semua.find(([, sel]) => adalahTotal(sel));
  // Baris data mengisi sebagian besar kolom berjudul; baris yang hampir kosong
  // (subtotal tanpa label, judul kelompok) bukan transaksi.
  const kolomBerjudul = header.map((v, i) => (teksSel(v) ? i : -1)).filter((i) => i >= 0);
  const terisi = (sel: SelNilai[]) => kolomBerjudul.filter((i) => teksSel(sel[i]) !== '').length;
  const data = semua
    .filter(([, sel]) => !adalahTotal(sel) && terisi(sel) >= kolomBerjudul.length * 0.5)
    .map(([no, sel]) => ({ no, sel }));
  if (data.length === 0) return undefined;

  const dipakaiNama = new Set<string>();
  const kolom: Kolom[] = [];
  header.forEach((v, indeks) => {
    let nama = teksSel(v);
    if (!nama) return;
    while (dipakaiNama.has(nama)) nama = `${nama} (2)`;
    dipakaiNama.add(nama);
    const nilai = data.map((d) => d.sel[indeks]).filter((x) => teksSel(x) !== '');
    if (nilai.length < Math.max(1, data.length * 0.3)) return;
    const angka = nilai.filter((x) => keAngka(x) !== null).length;
    const tanggal = nilai.filter((x) => tanggalDari(x) !== null).length;
    const jenis: Kolom['jenis'] =
      KOLOM_TANGGAL.test(nama) && tanggal >= nilai.length * 0.6 ? 'tanggal' : angka >= nilai.length * 0.8 ? 'angka' : 'teks';
    kolom.push({ indeks, nama, jenis });
  });

  // Baris data terakhir di dokumen: sebelum baris Total, atau nomor terbesar yang terbaca.
  const akhirData = totalBaris ? totalBaris[0] - 1 : Math.max(...data.map((d) => d.no));
  return { lembar, noHeader, kolom, data, total: totalBaris?.[1], perkiraanBaris: Math.max(data.length, akhirData - noHeader) };
}

// ---------------------------------------------------------------------------
// Penyusun kartu
// ---------------------------------------------------------------------------

/** Rupiah besar -> angka singkat + satuan ("100,26" "Rp miliar"). */
export function ringkasRupiah(n: number): { nilai: string; satuan: string } {
  const abs = Math.abs(n);
  const [bagi, satuan] = abs >= 1e12 ? [1e12, 'Rp triliun'] : abs >= 1e9 ? [1e9, 'Rp miliar'] : abs >= 1e6 ? [1e6, 'Rp juta'] : [1, 'Rp'];
  const nilai = (n / bagi).toLocaleString('id-ID', { maximumFractionDigits: bagi === 1 ? 0 : 2 });
  return { nilai, satuan };
}


const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/**
 * Skala satu deret rupiah supaya terbaca: angka mentah "36.926.881.952" di
 * grafik dan tabel membuat kartu sesak. Satu skala per kartu (dari nilai
 * terbesar), dua desimal.
 */
export function skalaRupiah(nilai: number[]): { bagi: number; satuan: string } {
  const maks = Math.max(0, ...nilai.map((v) => Math.abs(v)));
  return maks >= 1e9
    ? { bagi: 1e9, satuan: 'Rp miliar' }
    : maks >= 1e6
      ? { bagi: 1e6, satuan: 'Rp juta' }
      : maks >= 1e4
        ? { bagi: 1e3, satuan: 'Rp ribu' }
        : { bagi: 1, satuan: 'Rp' };
}

const bulat = (v: number) => Math.round(v * 100) / 100;

/** Label kategori panjang dipendekkan supaya sumbu grafik tidak menumpuk. */
const pendek = (t: string, maks = 26) => (t.length <= maks ? t : `${t.slice(0, maks - 1).trimEnd()}…`);

export interface HasilLembar {
  widgets: WidgetSpec[];
  /** Catatan jujur untuk pesan asisten (mis. baris yang tidak terbaca). */
  catatan: string[];
  /** Nama lembar yang dipakai; satu lembar = satu halaman dashboard. */
  lembar: string[];
  /** id widget -> indeks lembar di `lembar`. */
  lembarWidget: Record<string, number>;
}

export function widgetDariSumber(sumber: SumberLembar, namaDokumen: string, idAwal = `lbr-${Date.now()}`): HasilLembar {
  const analisis = sumber.lembar
    .map(analisisLembar)
    .filter((a): a is AnalisisLembar => !!a && a.kolom.some((k) => k.jenis === 'angka'))
    .sort((a, b) => b.data.length - a.data.length)
    .slice(0, 3);
  const widgets: WidgetSpec[] = [];
  const catatan: string[] = [];
  const lembar: string[] = [];
  const lembarWidget: Record<string, number> = {};
  let n = 0;
  const sekarang = new Date().toISOString();

  for (const a of analisis) {
    const indeksLembar = lembar.length;
    const sitasi = (cuplikan: string): Citation[] => [
      {
        id: `cit-${idAwal}-${n}`,
        docName: namaDokumen,
        page: 0,
        chunkSnippet: `Lembar "${a.lembar.nama}": ${cuplikan}`.slice(0, 240),
        confidenceScore: sumber.lengkap ? 1 : 0.9,
        date: '',
      },
    ];
    const tambah = (w: Omit<WidgetSpec, 'id' | 'category' | 'confidence' | 'citations' | 'lastUpdated'>, cuplikan: string) => {
      const wid = `${idAwal}-${++n}`;
      lembarWidget[wid] = indeksLembar;
      widgets.push({ ...w, id: wid, category: 'Keuangan', confidence: 'sumber', citations: sitasi(cuplikan), lastUpdated: sekarang } as WidgetSpec);
    };
    // Dari potongan, jumlah baris dokumen hanya diketahui bila baris Total-nya terbaca.
    const jumlahDiketahui = sumber.lengkap || !!a.total;
    const lengkap = sumber.lengkap || (!!a.total && a.data.length >= a.perkiraanBaris);
    const ketBaris = lengkap
      ? `${a.data.length.toLocaleString('id-ID')} baris`
      : jumlahDiketahui
        ? `${a.data.length.toLocaleString('id-ID')} dari ±${a.perkiraanBaris.toLocaleString('id-ID')} baris terbaca`
        : `${a.data.length.toLocaleString('id-ID')} baris terbaca (sebagian)`;
    if (!lengkap)
      catatan.push(
        jumlahDiketahui
          ? `Lembar "${a.lembar.nama}": ${a.data.length} dari ±${a.perkiraanBaris} baris terbaca dari basis dokumen; rincian dihitung dari baris itu, total memakai baris Total dokumen.`
          : `Lembar "${a.lembar.nama}": hanya sebagian baris (${a.data.length}) yang terbaca dari basis dokumen dan baris Total-nya tidak terbaca, jadi kartu total tidak dibuat.`
      );

    // Judul kolom berupa angka ("13") = sisa judul bertingkat yang tidak terbaca; maknanya tidak jelas.
    const angka = a.kolom.filter((k) => k.jenis === 'angka' && !KOLOM_KODE.test(k.nama) && !/^\d+([.,]\d+)?$/.test(k.nama));
    const nilaiKolom = (k: Kolom) => a.data.map((d) => keAngka(d.sel[k.indeks])).filter((v): v is number => v !== null);
    const jumlahKolom = (k: Kolom) => nilaiKolom(k).reduce((s, v) => s + v, 0);
    const uang = (k: Kolom) => KOLOM_UANG.test(k.nama) && nilaiKolom(k).some((v) => Math.abs(v) >= 1000);
    // Nilai ringkasan: baris Total milik dokumen, atau jumlah semua baris bila lengkap.
    const ringkasan = (k: Kolom): number | null => {
      const t = a.total ? keAngka(a.total[k.indeks] ?? null) : null;
      if (t !== null) return t;
      return lengkap ? jumlahKolom(k) : null;
    };
    const urutAngka = [...angka].sort(
      (x, y) => Number(KOLOM_UTAMA.test(y.nama)) - Number(KOLOM_UTAMA.test(x.nama)) || Math.abs(jumlahKolom(y)) - Math.abs(jumlahKolom(x))
    );
    const utama =
      urutAngka.find((k) => uang(k) && !KOLOM_TAK_DIJUMLAH.test(k.nama)) ?? urutAngka.find((k) => !KOLOM_TAK_DIJUMLAH.test(k.nama));
    if (!utama) continue;
    lembar.push(a.lembar.nama);
    const rupiah = uang(utama);

    const kategori = a.kolom
      .filter((k) => k.jenis === 'teks' && !KOLOM_KODE.test(k.nama))
      .map((k) => ({ k, beda: new Set(a.data.map((d) => teksSel(d.sel[k.indeks])).filter(Boolean)).size }))
      .filter((x) => x.beda >= 2 && x.beda <= 120)
      .sort((x, y) => Number(KOLOM_KATEGORI.test(y.k.nama)) - Number(KOLOM_KATEGORI.test(x.k.nama)) || x.beda - y.beda);
    const kecil = kategori.find((x) => x.beda <= 6);
    const besar = kategori.find((x) => x !== kecil && x.beda > 3) ?? kategori.find((x) => x !== kecil);

    const kelompok = (k: Kolom, ambilKunci: (v: SelNilai) => string | null) => {
      const peta = new Map<string, number>();
      for (const d of a.data) {
        const kunci = ambilKunci(d.sel[k.indeks]);
        if (!kunci) continue;
        peta.set(kunci, (peta.get(kunci) ?? 0) + (keAngka(d.sel[utama.indeks]) ?? 0));
      }
      return peta;
    };
    const seri = (nilai: number[]) => {
      if (!rupiah) return { data: nilai.map(bulat), unit: '' };
      const s = skalaRupiah(nilai);
      return { data: nilai.map((v) => bulat(v / s.bagi)), unit: s.satuan };
    };

    // Deret bulanan dipakai grafik tren dan garis kecil di kartu KPI.
    const kolTanggal = a.kolom.find((k) => k.jenis === 'tanggal');
    const bulanan = kolTanggal
      ? [...kelompok(kolTanggal, (v) => {
          const d = tanggalDari(v);
          return d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}` : null;
        }).entries()]
          .sort((x, y) => x[0].localeCompare(y[0]))
          .slice(-24)
      : [];
    // Jumlah transaksi per bulan untuk garis kecil kartu Jumlah Transaksi.
    const jumlahBulanan = kolTanggal
      ? bulanan.map(([b]) => a.data.filter((d) => {
          const t = tanggalDari(d.sel[kolTanggal.indeks]);
          return !!t && `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}` === b;
        }).length)
      : [];
    const garisJumlah = jumlahBulanan.length >= 3 ? { sparkline: jumlahBulanan, sparklineAsal: 'dokumen-seri' as const } : {};
    const garisKecil = bulanan.length >= 3 ? { sparkline: seri(bulanan.map(([, v]) => v)).data, sparklineAsal: 'dokumen-seri' as const } : {};

    // 1. Baris KPI (empat kartu): jumlah transaksi, total dokumen, rata-rata, jumlah pihak.
    if (jumlahDiketahui)
      tambah(
        { title: 'Jumlah Transaksi', subtitle: 'Baris data di dokumen', type: 'kpi', ikon: 'clipboard', grid: { x: 0, y: 0, w: 3, h: 2 }, kpi: { value: a.perkiraanBaris.toLocaleString('id-ID'), unit: 'baris', ...garisJumlah } },
        `${a.perkiraanBaris} baris data`
      );
    for (const k of urutAngka.filter((k) => !KOLOM_TAK_DIJUMLAH.test(k.nama) && ringkasan(k) !== null && ringkasan(k) !== 0).slice(0, 2)) {
      const v = ringkasan(k)!;
      const r = uang(k) ? ringkasRupiah(v) : { nilai: v.toLocaleString('id-ID', { maximumFractionDigits: 2 }), satuan: '' };
      tambah(
        { title: `Total ${k.nama}`, subtitle: a.total ? 'Baris Total dokumen' : ketBaris, type: 'kpi', ikon: uang(k) ? 'wallet' : 'activity', grid: { x: 0, y: 0, w: 3, h: 2 }, kpi: { value: r.nilai, unit: r.satuan, ...(k === utama ? garisKecil : {}) } },
        `Total ${k.nama} = ${v}`
      );
    }
    const nilaiUtama = nilaiKolom(utama).filter((v) => v !== 0);
    if (nilaiUtama.length > 0) {
      const rata = nilaiUtama.reduce((s, v) => s + v, 0) / nilaiUtama.length;
      const r = rupiah ? ringkasRupiah(rata) : { nilai: rata.toLocaleString('id-ID', { maximumFractionDigits: 2 }), satuan: '' };
      tambah(
        { title: `Rata-rata ${utama.nama}`, subtitle: `Per transaksi, ${ketBaris}`, type: 'kpi', ikon: rupiah ? 'coins' : 'gauge', grid: { x: 0, y: 0, w: 3, h: 2 }, kpi: { value: r.nilai, unit: r.satuan } },
        `rata-rata ${utama.nama}`
      );
    }
    if (besar) {
      tambah(
        {
          title: `Jumlah ${besar.k.nama}`,
          subtitle: lengkap ? 'Nilai berbeda di dokumen' : `Nilai berbeda, ${ketBaris}`,
          type: 'kpi',
          ikon: 'users',
          grid: { x: 0, y: 0, w: 3, h: 2 },
          kpi: { value: besar.beda.toLocaleString('id-ID'), unit: 'pihak' },
        },
        `${besar.beda} ${besar.k.nama}`
      );
    }

    // 2. Tren per bulan (garis area: deret waktu dibaca kiri ke kanan).
    if (kolTanggal && bulanan.length >= 2) {
      {
        const urut = bulanan;
        const s = seri(urut.map(([, v]) => v));
        tambah(
          {
            title: `Tren ${utama.nama} per Bulan`,
            subtitle: `Menurut ${kolTanggal.nama}${s.unit ? `, ${s.unit}` : ''} · ${ketBaris}`,
            type: 'area',
            grid: { x: 0, y: 0, w: 12, h: 4 },
            chart: {
              xAxis: urut.map(([k]) => `${BULAN[Number(k.slice(5)) - 1]} ${k.slice(2, 4)}`),
              series: [{ name: utama.nama, data: s.data }],
              unit: s.unit,
              showLegend: false,
            },
          },
          `${kolTanggal.nama} vs ${utama.nama}`
        );
      }
    }

    // 3. Peringkat 8 terbesar per kategori utama + komposisi kategori kecil.
    if (besar) {
      const urut = [...kelompok(besar.k, (v) => teksSel(v) || null).entries()].sort((x, y) => y[1] - x[1]).slice(0, 8);
      const s = seri(urut.map(([, v]) => v));
      tambah(
        {
          title: `${besar.k.nama} dengan ${utama.nama} Terbesar`,
          subtitle: `8 teratas${s.unit ? `, ${s.unit}` : ''} · ${ketBaris}`,
          type: 'hbar',
          grid: { x: 0, y: 0, w: kecil ? 7 : 12, h: 5 },
          chart: { xAxis: urut.map(([l]) => pendek(l)), series: [{ name: utama.nama, data: s.data }], unit: s.unit, showLegend: false },
        },
        `${besar.k.nama} vs ${utama.nama}`
      );
    }
    if (kecil) {
      const urut = [...kelompok(kecil.k, (v) => teksSel(v) || null).entries()].sort((x, y) => y[1] - x[1]);
      const s = seri(urut.map(([, v]) => v));
      tambah(
        {
          title: `Komposisi per ${kecil.k.nama}`,
          subtitle: `${utama.nama}${s.unit ? `, ${s.unit}` : ''} · ${ketBaris}`,
          type: 'donut',
          grid: { x: 0, y: 0, w: besar ? 5 : 12, h: 5 },
          chart: { xAxis: urut.map(([l]) => pendek(l, 20)), series: [{ name: utama.nama, data: s.data }], unit: s.unit },
        },
        `${kecil.k.nama} vs ${utama.nama}`
      );
    }

    // 4. Grafik pengganti tabel: sebaran umur (hari) dan status pelunasan. Tabel
    // angka hanya dipakai bila dokumennya tidak punya kolom untuk keduanya.
    let grafikTambahan = 0;
    const kolUmur = a.kolom.find((k) => k.jenis === 'angka' && /umur|aging|hari|days|lama/i.test(k.nama) && !/^\d+$/.test(k.nama));
    if (kolUmur) {
      const RENTANG: Array<[string, number, number]> = [
        ['0–30 hari', 0, 30],
        ['31–60 hari', 31, 60],
        ['61–90 hari', 61, 90],
        ['91–180 hari', 91, 180],
        ['> 180 hari', 181, Infinity],
      ];
      const hitung = RENTANG.map(([, lo, hi]) => a.data.filter((d) => {
        const v = keAngka(d.sel[kolUmur.indeks]);
        return v !== null && v >= lo && v <= hi;
      }).length);
      if (hitung.filter((x) => x > 0).length >= 2) {
        grafikTambahan++;
        tambah(
          {
            title: `Sebaran ${kolUmur.nama}`,
            subtitle: `Jumlah transaksi per rentang hari · ${ketBaris}`,
            type: 'bar',
            grid: { x: 0, y: 0, w: 6, h: 4 },
            chart: { xAxis: RENTANG.map(([l]) => l), series: [{ name: 'Transaksi', data: hitung }], unit: 'transaksi', showLegend: false },
          },
          `${kolUmur.nama} dalam hari`
        );
      }
    }
    const kolSaldo = angka.find((k) => k !== utama && /saldo|sisa|outstanding|belum/i.test(k.nama));
    if (kolSaldo) {
      const lunas = a.data.filter((d) => (keAngka(d.sel[kolSaldo.indeks]) ?? 0) <= 0).length;
      const belum = a.data.length - lunas;
      if (lunas > 0 && belum > 0) {
        grafikTambahan++;
        tambah(
          {
            title: 'Status Pelunasan',
            subtitle: `${kolSaldo.nama} nol = lunas · ${ketBaris}`,
            type: 'donut',
            grid: { x: 0, y: 0, w: 6, h: 4 },
            chart: { xAxis: ['Lunas', 'Belum lunas'], series: [{ name: 'Transaksi', data: [lunas, belum] }], unit: 'transaksi' },
          },
          `${kolSaldo.nama} = 0 dihitung lunas`
        );
      }
    }
    if (grafikTambahan === 0) {
      const kolTabel = [besar?.k, kolTanggal, utama].filter((k): k is Kolom => !!k);
      const teratas = [...a.data].sort((x, y) => (keAngka(y.sel[utama.indeks]) ?? 0) - (keAngka(x.sel[utama.indeks]) ?? 0)).slice(0, 8);
      const sTabel = seri(teratas.map((d) => keAngka(d.sel[utama.indeks]) ?? 0));
      tambah(
        {
          title: `Transaksi ${utama.nama} Terbesar`,
          subtitle: `8 teratas · ${ketBaris}`,
          type: 'table',
          grid: { x: 0, y: 0, w: 12, h: 5 },
          table: {
            columns: kolTabel.map((k, i) => ({
              key: `k${i}`,
              label: k === utama && sTabel.unit ? `${k.nama} (${sTabel.unit})` : k.nama,
              format: 'text' as const,
            })),
            rows: teratas.map((d, r) =>
              Object.fromEntries(
                kolTabel.map((k, i) => {
                  const v = d.sel[k.indeks];
                  const tgl = k.jenis === 'tanggal' ? tanggalDari(v) : null;
                  const isi =
                    k === utama
                      ? sTabel.data[r].toLocaleString('id-ID', { maximumFractionDigits: 2 })
                      : tgl
                        ? tgl.toISOString().slice(0, 10)
                        : pendek(teksSel(v), 40);
                  return [`k${i}`, isi];
                })
              )
            ),
          },
        },
        `urut menurut ${utama.nama}`
      );
    }
  }
  return { widgets, catatan, lembar, lembarWidget };
}
