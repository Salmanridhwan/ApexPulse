/**
 * Impor data tabel dari berkas Excel/CSV menjadi widget dashboard.
 *
 * Semua fungsi di berkas ini MURNI (tanpa I/O jaringan): berkas diurai menjadi
 * tabel, lalu tabel dipetakan menjadi `WidgetSpec`. Pemisahan ini membuat alur
 * impor bisa diuji tanpa server dan dipakai ulang oleh endpoint maupun skrip QA.
 *
 * Prinsip yang dijaga:
 * - Angka dari berkas BUKAN hasil dokumen RAG, jadi widget dibuat dengan
 *   `confidence: 'manual'` (tanpa sitasi) — sesuai aturan skema widget.
 * - Satuan tidak dikarang: hanya dipakai kalau pengguna mengisinya.
 * - Baris kosong / kolom tanpa nama dibuang, bukan diisi tebakan.
 */
import * as XLSX from 'xlsx';
import type { WidgetSpec, WidgetType, WidgetGrid } from '../../types';

/** Batas aman jumlah baris yang diproses dari satu berkas. */
export const MAKS_BARIS = 20000;
/** Batas baris yang dikirim balik untuk pratinjau (payload ringan). */
export const MAKS_PRATINJAU = 50;

export type SelNilai = string | number | null;
export interface BarisTabel {
  [kolom: string]: SelNilai;
}

export interface TabelTerbaca {
  /** Nama sheet yang dipakai. */
  namaSheet: string;
  /** Semua nama sheet pada berkas (untuk pemilih sheet). */
  daftarSheet: string[];
  /** Nama kolom final (sudah unik, tanpa kolom kosong). */
  kolom: string[];
  /** Seluruh baris data (maksimum MAKS_BARIS). */
  baris: BarisTabel[];
  /** Jumlah baris data asli sebelum dipotong batas. */
  totalBaris: number;
  /** true bila baris dipotong karena melewati MAKS_BARIS. */
  dipotong: boolean;
}

/**
 * Ubah nilai sel apa adanya menjadi angka, atau `null` bila bukan angka.
 *
 * Menangani format Indonesia ("1.234,56") dan internasional ("1,234.56"),
 * simbol mata uang/rupiah, spasi pemisah ribuan, tanda kurung akuntansi untuk
 * angka negatif, dan sufiks persen. Nilai yang tidak jelas TIDAK ditebak —
 * dikembalikan `null` supaya tidak mengarang angka.
 */
export function keAngka(v: SelNilai | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;

  // Angka negatif bergaya akuntansi: (1.234) => -1234
  let negatif = false;
  if (/^\(.*\)$/.test(s)) {
    negatif = true;
    s = s.slice(1, -1);
  }
  // Persen: simpan sebagai angka apa adanya (mis. "12,5%" => 12.5).
  s = s.replace(/%/g, '');
  // Buang simbol mata uang & spasi (termasuk non-breaking space).
  s = s.replace(/rp|\$|€|£|idr/gi, '').replace(/[\s\u00a0]/g, '');
  if (s.startsWith('-')) {
    negatif = true;
    s = s.slice(1);
  }

  // Tentukan pemisah desimal: yang muncul paling kanan menang.
  const titikTerakhir = s.lastIndexOf('.');
  const komaTerakhir = s.lastIndexOf(',');
  if (titikTerakhir >= 0 && komaTerakhir >= 0) {
    if (komaTerakhir > titikTerakhir) {
      // Format Indonesia: 1.234,56
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Format internasional: 1,234.56
      s = s.replace(/,/g, '');
    }
  } else if (titikTerakhir >= 0 || komaTerakhir >= 0) {
    // Hanya SATU jenis pemisah. Ambigu: "1.200" bisa 1200 (ribuan gaya
    // Indonesia) atau 1.2. Karena produk ini untuk BUMD Indonesia, pemisah
    // tunggal yang diikuti TEPAT 3 digit dianggap pemisah RIBUAN — kecuali
    // bagian depannya "0" (mis. "0.500" tetap desimal). Pola lain (mis. "1.5",
    // "12,5") tetap dibaca desimal.
    const sep = titikTerakhir >= 0 ? '.' : ',';
    const bagian = s.split(sep);
    const depan = bagian[0].replace('-', '');
    // Ribuan bila: (a) beberapa pemisah & semua grup belakang tepat 3 digit
    // (mis. "1.500.000"), atau (b) satu pemisah berpolakan ribuan.
    const semuaGrup3 = bagian.slice(1).every((g) => g.length === 3);
    const ribuan =
      depan !== '0' &&
      depan.length >= 1 &&
      semuaGrup3 &&
      (bagian.length > 2 || (bagian.length === 2 && bagian[1].length === 3));
    if (ribuan) {
      s = bagian.join('');
    } else {
      s = s.replace(sep, '.');
    }
  }

  if (!/^\d*\.?\d+$/.test(s) && !/^\d+\.?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negatif ? -n : n;
}

/** Ubah sel menjadi teks label yang rapi. */
function keLabel(v: SelNilai | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/** Susun nama kolom unik & bermakna dari baris header mentah. */
function rapikanKolom(header: SelNilai[]): string[] {
  const dipakai = new Map<string, number>();
  return header.map((h, i) => {
    let nama = keLabel(h);
    if (!nama) nama = `Kolom ${i + 1}`;
    const n = dipakai.get(nama) || 0;
    dipakai.set(nama, n + 1);
    return n === 0 ? nama : `${nama} (${n + 1})`;
  });
}

/** Apakah baris (array sel) seluruhnya kosong? */
function barisKosong(row: SelNilai[]): boolean {
  return row.every((c) => c === null || c === undefined || String(c).trim() === '');
}

/**
 * Baca berkas Excel/CSV menjadi tabel terstruktur.
 *
 * @param buffer Isi berkas mentah.
 * @param sheet  Nama sheet yang dipilih (opsional; default sheet pertama).
 */
export function bacaTabel(buffer: Buffer, sheet?: string): TabelTerbaca {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: true });
  const daftarSheet = wb.SheetNames;
  if (daftarSheet.length === 0) {
    throw new Error('Berkas tidak memiliki sheet/lembar yang bisa dibaca.');
  }
  const namaSheet = sheet && daftarSheet.includes(sheet) ? sheet : daftarSheet[0];
  const ws = wb.Sheets[namaSheet];
  if (!ws) throw new Error(`Sheet "${namaSheet}" tidak ditemukan.`);

  const matriks = XLSX.utils.sheet_to_json<SelNilai[]>(ws, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });

  // Cari baris header: baris pertama yang punya >= 1 sel berisi.
  let idxHeader = matriks.findIndex((row) => !barisKosong(row));
  if (idxHeader === -1) {
    return { namaSheet, daftarSheet, kolom: [], baris: [], totalBaris: 0, dipotong: false };
  }

  // Buang kolom yang seluruhnya kosong di area data, supaya tidak ada
  // "Kolom 7" hantu dari sel sisa Excel.
  const headerMentah = matriks[idxHeader];
  const barisDataMentah = matriks.slice(idxHeader + 1);
  const lebarMaks = Math.max(headerMentah.length, ...barisDataMentah.map((r) => r.length), 0);
  const kolomTerpakai: number[] = [];
  for (let c = 0; c < lebarMaks; c++) {
    const adaIsi = !barisKosong([headerMentah[c]]) || barisDataMentah.some((r) => !barisKosong([r[c]]));
    if (adaIsi) kolomTerpakai.push(c);
  }

  const kolom = rapikanKolom(kolomTerpakai.map((c) => headerMentah[c]));
  const baris: BarisTabel[] = [];
  let totalBaris = 0;
  for (const raw of barisDataMentah) {
    if (barisKosong(raw)) continue;
    totalBaris++;
    if (baris.length >= MAKS_BARIS) continue;
    const obj: BarisTabel = {};
    kolomTerpakai.forEach((c, i) => {
      obj[kolom[i]] = raw[c] === undefined ? null : raw[c];
    });
    baris.push(obj);
  }

  return {
    namaSheet,
    daftarSheet,
    kolom,
    baris,
    totalBaris,
    dipotong: totalBaris > baris.length,
  };
}

/** Konfigurasi pemetaan tabel → widget (dikirim dari UI). */
export interface KonfigImpor {
  tipe: WidgetType;
  judul: string;
  /** Kolom label/kategori (untuk chart). */
  kolomLabel?: string;
  /** Kolom nilai — bisa lebih dari satu (seri ganda). */
  kolomNilai: string[];
  /** Kolom target (khusus kpi / bullet-target). */
  kolomTarget?: string;
  /** Satuan yang ditampilkan (opsional, tidak dikarang). */
  satuan?: string;
  /** Cara meringkas kolom nilai untuk KPI: nilai baris pertama / jumlah / rata-rata. */
  ringkasKpi?: 'langsung' | 'jumlah' | 'rata-rata';
  unitKerja?: string;
  periode?: string;
}

export interface HasilBangun {
  widget: WidgetSpec;
  peringatan: string[];
}

function kolomAda(tabel: TabelTerbaca, nama: string | undefined): boolean {
  return !!nama && tabel.kolom.includes(nama);
}

/** Kumpulkan seri angka per kolom nilai, sekaligus label kategori. */
function susunSeri(tabel: TabelTerbaca, kolomLabel: string | undefined, kolomNilai: string[]) {
  const pakaiKelompok = !!kolomLabel;
  const urutanLabel: string[] = [];
  const peta = new Map<string, number[]>();
  const labelPerBaris: string[] = [];

  for (const row of tabel.baris) {
    const label = pakaiKelompok ? keLabel(row[kolomLabel as string]) : '';
    const kunci = pakaiKelompok ? label : `__baris_${labelPerBaris.length}`;
    if (!peta.has(kunci)) {
      peta.set(kunci, new Array(kolomNilai.length).fill(0));
      urutanLabel.push(pakaiKelompok ? label : '');
    }
    const akum = peta.get(kunci)!;
    kolomNilai.forEach((k, i) => {
      const n = keAngka(row[k]);
      if (n !== null) akum[i] += n;
    });
    if (!pakaiKelompok) labelPerBaris.push('');
  }

  return { urutanLabel, peta, pakaiKelompok };
}

/**
 * Bangun satu `WidgetSpec` dari tabel + konfigurasi pengguna.
 *
 * Melempar Error dengan pesan Bahasa Indonesia bila konfigurasi tidak masuk akal
 * (mis. kolom nilai tidak dipilih atau tidak ada satu pun angka terbaca).
 */
export function bangunWidgetImpor(
  tabel: TabelTerbaca,
  konfig: KonfigImpor,
  idWidget: string,
  grid: WidgetGrid
): HasilBangun {
  const peringatan: string[] = [];
  const kolomNilai = (konfig.kolomNilai || []).filter((k) => kolomAda(tabel, k));
  if (kolomNilai.length === 0) {
    throw new Error('Pilih minimal satu kolom nilai yang berisi angka.');
  }
  if (tabel.baris.length === 0) {
    throw new Error('Berkas tidak memuat baris data yang bisa diimpor.');
  }

  const dasar: Pick<
    WidgetSpec,
    'id' | 'type' | 'title' | 'confidence' | 'grid' | 'citations' | 'unitKerja' | 'periode'
  > = {
    id: idWidget,
    type: konfig.tipe,
    title: (konfig.judul || 'Data Impor').trim() || 'Data Impor',
    // Data dari berkas = masukan manual, bukan hasil dokumen RAG.
    confidence: 'manual',
    grid,
    citations: [],
    unitKerja: konfig.unitKerja || undefined,
    periode: konfig.periode || undefined,
  };

  const tipe = konfig.tipe;

  // ---- Tabel rekap ----
  if (tipe === 'table') {
    const kolomTabel = tabel.kolom.map((k) => {
      const semuaAngka = tabel.baris.every((r) => keAngka(r[k]) !== null || r[k] === null || r[k] === '');
      const adaAngka = tabel.baris.some((r) => keAngka(r[k]) !== null);
      let format: 'number' | 'currency' | 'percent' | 'text' = 'text';
      if (semuaAngka && adaAngka) format = 'number';
      return { key: k, label: k, format };
    });
    const barisTabel = tabel.baris.map((r) => {
      const out: Record<string, any> = {};
      for (const k of tabel.kolom) {
        const n = keAngka(r[k]);
        out[k] = n !== null ? n : r[k];
      }
      return out;
    });
    return {
      widget: { ...dasar, table: { columns: kolomTabel, rows: barisTabel } },
      peringatan,
    };
  }

  // ---- KPI / Bullet (aktual vs target) ----
  if (tipe === 'kpi' || tipe === 'bullet-target') {
    const kolomUtama = kolomNilai[0];
    const nilaiSemua = tabel.baris
      .map((r) => keAngka(r[kolomUtama]))
      .filter((n): n is number => n !== null);
    if (nilaiSemua.length === 0) {
      throw new Error(`Kolom "${kolomUtama}" tidak memuat angka yang bisa dibaca.`);
    }
    const mode = konfig.ringkasKpi || 'langsung';
    let nilai: number;
    if (mode === 'jumlah') nilai = nilaiSemua.reduce((a, b) => a + b, 0);
    else if (mode === 'rata-rata') nilai = nilaiSemua.reduce((a, b) => a + b, 0) / nilaiSemua.length;
    else nilai = nilaiSemua[0];

    const kpi: NonNullable<WidgetSpec['kpi']> = {
      value: nilai,
      unit: konfig.satuan || undefined,
    };
    if (kolomAda(tabel, konfig.kolomTarget)) {
      const target = keAngka(tabel.baris[0][konfig.kolomTarget as string]);
      if (target !== null) {
        kpi.target = target;
        kpi.targetLabel = 'Target';
      } else {
        peringatan.push(`Kolom target "${konfig.kolomTarget}" tidak memuat angka; target diabaikan.`);
      }
    }
    return { widget: { ...dasar, kpi }, peringatan };
  }

  // ---- Chart berbasis kategori (baris/kelompok) ----
  const { urutanLabel, peta } = susunSeri(tabel, konfig.kolomLabel, kolomNilai);
  const seri = kolomNilai.map((k, i) => ({
    name: k,
    data: urutanLabel.map((lbl, idx) => {
      if (konfig.kolomLabel) return peta.get(lbl)![i];
      return peta.get(`__baris_${idx}`)![i];
    }),
  }));

  const totalAngka = seri.reduce((acc, s) => acc + s.data.filter((n) => Number.isFinite(n)).length, 0);
  if (totalAngka === 0) {
    throw new Error('Tidak ada angka yang bisa dibaca dari kolom nilai yang dipilih.');
  }

  const xAxis = konfig.kolomLabel
    ? urutanLabel
    : tabel.baris.map((_, i) => `Baris ${i + 1}`);

  // Khusus pie/donut/treemap/funnel: label wajib, dan nilai negatif diabaikan
  // (proporsi tak bisa negatif) dengan peringatan jujur.
  if (['pie', 'donut', 'treemap', 'funnel'].includes(tipe) && !konfig.kolomLabel) {
    throw new Error(`Tipe "${tipe}" memerlukan kolom label/kategori.`);
  }

  const chart: NonNullable<WidgetSpec['chart']> = {
    xAxis,
    series: seri,
    unit: konfig.satuan || undefined,
    showLegend: seri.length > 1,
  };

  const widget: WidgetSpec = { ...dasar, chart };

  if (['pie', 'donut', 'treemap'].includes(tipe) && konfig.kolomLabel) {
    const negatif = seri[0].data.some((n) => n < 0);
    if (negatif) {
      peringatan.push('Ada nilai negatif; proporsi pie/donut/treemap hanya bermakna untuk nilai positif.');
    }
  }
  if (['line', 'area', 'trend-line', 'forecast'].includes(tipe) && !konfig.kolomLabel) {
    peringatan.push('Tanpa kolom label, sumbu-x memakai nomor baris. Sebaiknya pilih kolom periode/label.');
  }

  return { widget, peringatan };
}

/** Ringkas tabel untuk dikirim ke UI (pratinjau ringan). */
export function ringkasPratinjau(tabel: TabelTerbaca) {
  const barisPreview = tabel.baris.slice(0, MAKS_PRATINJAU).map((r) => {
    const out: Record<string, SelNilai> = {};
    for (const k of tabel.kolom) out[k] = r[k];
    return out;
  });
  // Deteksi kolom yang mayoritas isinya angka terbaca (membantu UI menandai kolom nilai).
  const kolomNumerik = tabel.kolom.filter((k) => {
    const sampel = tabel.baris.slice(0, 200);
    const berisi = sampel.filter((r) => r[k] !== null && String(r[k]).trim() !== '');
    if (berisi.length === 0) return false;
    const angka = berisi.filter((r) => keAngka(r[k]) !== null).length;
    return angka >= Math.ceil(berisi.length * 0.6);
  });
  return {
    namaSheet: tabel.namaSheet,
    daftarSheet: tabel.daftarSheet,
    kolom: tabel.kolom,
    kolomNumerik,
    barisPreview,
    totalBaris: tabel.totalBaris,
    dipotong: tabel.dipotong,
  };
}
