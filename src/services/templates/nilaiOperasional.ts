import type { WidgetSpec } from '../../types';

/**
 * ANGKA HALAMAN 2 — OPERASIONAL & PELAYANAN.
 *
 * Halaman 1 template Ringkasan berisi keuangan (saldo kas, pendapatan, beban,
 * laba, arus kas, target). Halaman 2 memuat sisa data dokumen yang saling
 * berhubungan: rantai volume air (baku → terproduksi → terdistribusi → terjual),
 * target vs realisasi indikator pelayanan dan mutu, serta anggaran per program.
 *
 * Pemetaan memakai NAMA SERI di grafik, bukan judul kartu, karena judul template
 * sering tidak cocok dengan isi dokumen. Angka yang tidak ada di dokumen
 * dibiarkan kosong, tidak dikarang.
 */
export interface Bagian {
  label: string;
  nilai: number;
}

/**
 * Sumber dokumen untuk satu kartu halaman 2. Dipakai fitur "sumber data":
 * klik kartu grafik → tampilkan dokumen RAG asal angkanya.
 */
export interface SumberDok {
  dokumen: string;
  halaman: number;
  cuplikan: string;
  keyakinan: number;
}

export interface Indikator {
  nama: string;
  target: number;
  realisasi: number;
}

export interface Deret {
  label: string;
  satuan: string;
  kategori: string[];
  data: number[];
}

export interface NilaiOperasional {
  /** Rantai volume air: air baku sampai air terjual. */
  volume: Deret | null;
  /** Indikator pelayanan: target vs realisasi. */
  pelayanan: { indikator: Indikator[] } | null;
  /** Indikator mutu: realisasi 2024 vs target 2025. */
  mutu: { indikator: Indikator[] } | null;
  /** Anggaran per program kerja (miliar Rp). */
  anggaran: { label: string; satuan: string; bagian: Bagian[] } | null;
  kpi: {
    airTerjual: number;
    nrw: number;
    sla: number;
    anggaran: number;
  };
  narasi: string | null;
  /** Dokumen asal tiap kartu (fitur "sumber data"). */
  sumber: {
    volume: SumberDok[];
    nrw: SumberDok[];
    indikator: SumberDok[];
    anggaran: SumberDok[];
  };
}

const KOSONG: NilaiOperasional = {
  volume: null,
  pelayanan: null,
  mutu: null,
  anggaran: null,
  kpi: { airTerjual: 0, nrw: 0, sla: 0, anggaran: 0 },
  narasi: null,
  sumber: { volume: [], nrw: [], indikator: [], anggaran: [] },
};

/** Ambil sumber dari widget dokumen. */
function sumberDari(w: WidgetSpec): SumberDok[] {
  const daftar = ((w as any).citations || []) as Array<{
    docName?: string;
    page?: number;
    chunkSnippet?: string;
    confidenceScore?: number;
  }>;
  return daftar
    .filter((c) => c && c.docName)
    .slice(0, 3)
    .map((c) => ({
      dokumen: String(c.docName),
      halaman: Number(c.page ?? 0),
      cuplikan: String(c.chunkSnippet || '').slice(0, 260),
      keyakinan: Number(c.confidenceScore ?? 0),
    }));
}

function angka(n: unknown): number {
  const v =
    typeof n === 'number'
      ? n
      : Number(
          String(n ?? '')
            .replace(/[^\d.,-]/g, '')
            .replace(/\.(?=\d{3}\b)/g, '')
            .replace(',', '.')
        );
  return Number.isFinite(v) ? v : 0;
}

function satuanDari(nama: string): string {
  const m = /\(([^)]+)\)/.exec(nama);
  return m ? m[1].trim() : '';
}

/** Label dokumen sering dipotong dengan "…" dan terlalu panjang untuk sumbu. */
function rapikan(label: string): string {
  return String(label).replace(/…|\.\.\./g, '').trim();
}

function cariIndikator(daftar: Indikator[] | undefined, pola: RegExp): Indikator | null {
  if (!daftar) return null;
  return daftar.find((i) => pola.test(i.nama)) || null;
}

function jumlah(data: number[]): number {
  return data.reduce((a, b) => a + b, 0);
}

/**
 * Susun nilai halaman 2 dari widget dokumen. Hanya seri yang dikenali yang
 * dipakai; widget tanpa seri yang relevan diabaikan.
 */
export function nilaiOperasionalDariWidgets(
  widgets: WidgetSpec[] | undefined | null
): NilaiOperasional {
  if (!Array.isArray(widgets) || widgets.length === 0) return KOSONG;

  const hasil: NilaiOperasional = {
    ...KOSONG,
    kpi: { ...KOSONG.kpi },
    sumber: { volume: [], nrw: [], indikator: [], anggaran: [] },
  };

  // 1. Seri tunggal: rantai volume air dan anggaran per program.
  for (const w of widgets) {
    if (w.type === 'narasi' && !hasil.narasi) {
      const teks = w.narasi?.text || '';
      if (/air|nrw|pelayanan|anggaran|kualitas/i.test(teks)) {
        hasil.narasi = String(teks).slice(0, 400);
        continue;
      }
    }

    const seri = w.chart?.series || [];
    const kategori = (w.chart?.xAxis || []).map((x) => rapikan(String(x)));

    for (const s of seri) {
      const nama = String(s.name || '');
      const kecil = nama.toLowerCase();
      const data = (s.data || []).map((n) => angka(n));
      if (data.length === 0) continue;

      // Rantai volume air: "Air baku … Air terjual".
      if (/volume|m³|m3/.test(kecil) && !hasil.volume && data.length >= 3) {
        hasil.volume = {
          label: rapikan(nama.replace(/\([^)]*\)/g, '')) || 'Volume air',
          satuan: satuanDari(nama) || 'm³',
          kategori,
          data,
        };
        hasil.sumber.volume = sumberDari(w);
        continue;
      }

      // Anggaran per program.
      if (/anggaran/.test(kecil) && !hasil.anggaran) {
        hasil.anggaran = {
          label: rapikan(nama.replace(/\([^)]*\)/g, '')) || 'Anggaran',
          satuan: satuanDari(nama) || 'miliar Rp',
          bagian: kategori.map((k, i) => ({ label: k, nilai: data[i] ?? 0 })),
        };
        hasil.sumber.anggaran = sumberDari(w);
        continue;
      }
    }
  }

  // 2. Pasangan seri target vs realisasi: indikator pelayanan dan mutu.
  for (const w of widgets) {
    const seri = w.chart?.series || [];
    if (seri.length < 2) continue;
    const kategori = (w.chart?.xAxis || []).map((x) => rapikan(String(x)));

    // Nama seri di dokumen berhuruf besar di awal ("Target", "Realisasi"),
    // jadi pencocokan wajib case-insensitive.
    const cariSeri = (pola: RegExp) => seri.find((s) => pola.test(String(s.name || '')));
    const target = cariSeri(/target/i);
    const realisasi = cariSeri(/realisasi/i);
    if (!target || !realisasi) continue;

    const indikator: Indikator[] = kategori.map((nama, i) => ({
      nama,
      target: angka((target.data || [])[i]),
      realisasi: angka((realisasi.data || [])[i]),
    }));
    if (indikator.length === 0) continue;

    // Seri bertahun (2024/2025) = mutu; tanpa tahun = pelayanan.
    const bertahun =
      /202\d/.test(String(target.name)) || /202\d/.test(String(realisasi.name));
    if (bertahun && !hasil.mutu) {
      hasil.mutu = { indikator };
      hasil.sumber.nrw = sumberDari(w);
    } else if (!bertahun && !hasil.pelayanan) {
      hasil.pelayanan = { indikator };
    }
    // Kartu "Target vs realisasi" memakai kedua kelompok indikator.
    if (hasil.sumber.indikator.length === 0) hasil.sumber.indikator = sumberDari(w);
  }

  // 3. Angka ringkas untuk kartu KPI.
  const posTerjual = hasil.volume?.kategori.findIndex((k) => /terjual/i.test(k)) ?? -1;
  if (hasil.volume && posTerjual >= 0) hasil.kpi.airTerjual = hasil.volume.data[posTerjual] ?? 0;

  const nrw = cariIndikator(hasil.mutu?.indikator, /nrw|kehilangan/i);
  if (nrw) hasil.kpi.nrw = nrw.realisasi;

  const sla = cariIndikator(hasil.pelayanan?.indikator, /sla|penyelesaian/i);
  if (sla) hasil.kpi.sla = sla.realisasi;

  if (hasil.anggaran) hasil.kpi.anggaran = jumlah(hasil.anggaran.bagian.map((b) => b.nilai));

  const ada = hasil.volume || hasil.pelayanan || hasil.mutu || hasil.anggaran || hasil.narasi;
  return ada ? hasil : KOSONG;
}

/**
 * Peta sumber per judul widget (huruf kecil). Dipakai halaman 1: kartu "Ikhtisar
 * Pendapatan", "Rincian Beban", "Arus Kas", dan "Progres Target" mengambil
 * sumber dari widget dokumen dengan judul yang sama.
 */
export function sumberPerJudul(
  widgets: WidgetSpec[] | null | undefined
): Record<string, SumberDok[]> {
  const hasil: Record<string, SumberDok[]> = {};
  for (const w of widgets || []) {
    const judul = String(w.title || '').trim().toLowerCase();
    if (!judul) continue;
    const daftar = sumberDari(w);
    if (daftar.length > 0 && !hasil[judul]) hasil[judul] = daftar;
  }
  return hasil;
}

/**
 * ANGKA CONTOH HALAMAN 2 — sengaja BERBEDA JELAS dari angka dokumen PAM JAYA.
 * Mode template memakai angka ini, mode pratinjau data asli memakai angka
 * dokumen. Jangan menyalin angka dokumen ke sini: tujuannya supaya perbedaan
 * kedua mode langsung terlihat.
 */
export const CONTOH_OPERASIONAL: NilaiOperasional = {
  volume: {
    label: 'Volume air 2026',
    satuan: 'm³',
    kategori: ['Air baku', 'Air terproduksi', 'Air curah olahan', 'Air terdistribusi', 'Air terjual'],
    data: [812400000, 698700000, 122400000, 745900000, 402600000],
  },
  pelayanan: {
    indikator: [
      { nama: 'Ketepatan waktu tanggap', target: 96, realisasi: 97.4 },
      { nama: 'Penyelesaian dalam SLA', target: 94, realisasi: 95.8 },
      { nama: 'Kepuasan pengguna', target: 88, realisasi: 90.2 },
      { nama: 'Ketepatan pengisian meter', target: 99, realisasi: 99.1 },
    ],
  },
  mutu: {
    indikator: [
      { nama: 'NRW', target: 36, realisasi: 38.4 },
      { nama: 'Cakupan layanan', target: 74, realisasi: 72.6 },
      { nama: 'Kualitas air baku mutu', target: 100, realisasi: 99.8 },
    ],
  },
  anggaran: {
    label: 'Anggaran 2026',
    satuan: 'miliar Rp',
    bagian: [
      { label: 'Perluasan jaringan', nilai: 640 },
      { label: 'Rehabilitasi reservoir', nilai: 505 },
      { label: 'Penggantian meter', nilai: 388 },
      { label: 'Peningkatan tekanan', nilai: 276 },
      { label: 'Kendaraan operasional', nilai: 154 },
      { label: 'Dana cadangan', nilai: 96 },
    ],
  },
  kpi: { airTerjual: 402600000, nrw: 38.4, sla: 95.8, anggaran: 2059 },
  sumber: { volume: [], nrw: [], indikator: [], anggaran: [] },
  narasi:
    'Dari 812,4 juta m³ air baku, 402,6 juta m³ sampai ke pelanggan. Penyelesaian dalam SLA 95,8% melampaui target 94%, NRW 38,4% masih di atas target 36%, dan anggaran 2026 terbesar untuk perluasan jaringan 640 miliar rupiah.',
};

/** Angka ringkas gaya Indonesia: 402.600.000 → "403 jt". */
export function ringkasOperasional(n: number, satuan = ''): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  const abs = Math.abs(n);
  const tulis = (v: number) =>
    v.toLocaleString('id-ID', { maximumFractionDigits: v >= 100 ? 0 : 2 });
  if (satuan === '%') return `${tulis(Math.round(n * 100) / 100)}%`;
  // Satuan uang (miliar/triliun Rp) ditulis apa adanya: "1.800", bukan "1,8 rb".
  if (/rp|miliar|triliun|juta/i.test(satuan)) return tulis(Math.round(n * 10) / 10);
  if (abs >= 1e12) return `${tulis(Math.round(n / 1e10) / 100)} T`;
  if (abs >= 1e9) return `${tulis(Math.round(n / 1e7) / 100)} M`;
  if (abs >= 1e6) return `${tulis(Math.round(n / 1e4) / 100)} jt`;
  if (abs >= 1e3) return `${tulis(Math.round(n / 10) / 100)} rb`;
  return tulis(n);
}
