/**
 * SUSUN DASHBOARD BERHALAMAN DARI DATA DOKUMEN.
 *
 * Alur asisten: data dokumen -> pilih chart katalog yang cocok -> buang data
 * kembar -> kelompokkan per topik -> bagi ke beberapa halaman -> beri judul
 * sesuai isi. MURNI (tanpa I/O) supaya bisa diuji.
 *
 * Aturan yang dijaga:
 * - Setiap widget grafik memakai chart dari katalog Template Chart (`chartId`).
 * - Satu data hanya muncul sekali di seluruh dashboard (tidak ada kembar
 *   antar halaman).
 * - Setiap halaman muat satu layar: maksimal 4 KPI dan 4 kartu lain.
 * - Judul dashboard dan judul halaman mengikuti isi yang benar-benar tampil.
 * - Bila pengguna menulis susunan halamannya sendiri, susunan itu yang dipakai.
 */

import type { HalamanDashboard, WidgetSpec, WidgetType } from '../../types';
import type { ChartId } from '../chart/chartDefault';
import type { Varian } from '../chart/gayaVarian';
import { kategoriWidget, type KategoriDashboard } from '../spec/kategoriWidget';
import { halamanUntukWidget, periodeWidget, skorCocok, widgetKembar, type HalamanDiminta } from './halamanDiminta';

/** Batas isi satu halaman: satu baris KPI + tiga baris kartu (permintaan produk: lebih dari 5 widget). */
export const MAKS_KPI_PER_HALAMAN = 4;
export const MAKS_KARTU_PER_HALAMAN = 6;

/** Hanya `kpi` yang duduk di baris KPI kanvas; progres target adalah kartu biasa. */
const TIPE_KPI: WidgetType[] = ['kpi'];

const normal = (t: unknown) =>
  String(t ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Sidik isi widget: judul ternormalisasi + angka utamanya. */
function sidik(w: WidgetSpec): { judul: string; angka: string } {
  const angka =
    w.kpi?.value !== undefined
      ? String(w.kpi.value)
      : (w.chart?.series ?? [])
          .map((s) => (s.data ?? []).join(','))
          .join('|');
  return { judul: normal(w.title), angka };
}

/**
 * Buang widget kembar: judul sama, atau angka sama persis untuk tipe yang sama
 * (data yang sama dengan judul berbeda tetap dianggap kembar).
 */
export function buangKembar(widgets: WidgetSpec[]): WidgetSpec[] {
  const judul = new Set<string>();
  const angka = new Set<string>();
  const hasil: WidgetSpec[] = [];
  for (const w of widgets) {
    const s = sidik(w);
    const kunciAngka = s.angka && s.angka.length > 2 ? `${TIPE_KPI.includes(w.type) ? 'kpi' : 'grafik'}#${s.angka}` : '';
    if ((s.judul && judul.has(s.judul)) || (kunciAngka && angka.has(kunciAngka))) continue;
    if (s.judul) judul.add(s.judul);
    if (kunciAngka) angka.add(kunciAngka);
    hasil.push(w);
  }
  return hasil;
}

const MIRIP_WAKTU = /^(jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec|q[1-4]|tw|triwulan|semester|20\d\d|19\d\d|minggu|pekan|hari|bulan)/i;

/** Apakah label sumbu berupa deret waktu (bulan, triwulan, tahun)? */
const deretWaktu = (label: string[]) => label.length >= 3 && label.filter((l) => MIRIP_WAKTU.test(String(l).trim())).length >= label.length * 0.6;

/**
 * Pilih chart katalog untuk satu widget berdasarkan bentuk datanya. Tipe yang
 * belum punya chart katalog diubah ke tipe katalog terdekat bila datanya
 * berupa kategori + angka; kalau bentuknya tidak cocok, dibiarkan.
 */
export function pilihChart(w: WidgetSpec): { type: WidgetType; chartId?: ChartId } {
  const kategori = w.chart?.xAxis ?? [];
  const seri = w.chart?.series ?? [];
  const nSeri = seri.length;
  const labelPanjang = kategori.length > 0 && kategori.reduce((a, k) => a + String(k).length, 0) / kategori.length > 11;
  const adaTarget = seri.some((s) => /target|rencana|rkap|anggaran/i.test(s.name || ''));

  switch (w.type) {
    case 'kpi':
      return { type: 'kpi', chartId: 'kpi-kartu' };
    case 'bullet-target':
      return { type: 'bullet-target', chartId: w.kpi?.targets?.length ? 'progres-target' : 'kpi-kartu' };
    case 'table':
      return { type: 'table', chartId: 'tabel-ringkas' };
    case 'narasi':
      return { type: 'narasi', chartId: 'narasi-insight' };
    case 'gauge':
      return { type: 'gauge', chartId: 'gauge-target' };
    case 'scatter':
    case 'bubble':
    case 'cluster':
      return { type: w.type, chartId: nSeri >= 2 ? 'scatter-gelembung' : 'titik-bersumbu' };
    case 'combo':
      return { type: 'combo', chartId: 'combo-batang-garis' };
    case 'pie':
    case 'donut':
      // Lebih dari 6 potongan sulit dibaca sebagai cincin: pakai peringkat.
      return kategori.length > 6 ? { type: 'hbar', chartId: 'bar-mendatar-peringkat' } : { type: 'donut', chartId: 'donat-tebal' };
    case 'line':
    case 'area':
    case 'trend-line':
    case 'forecast':
    case 'anomaly':
      if (nSeri >= 2 && adaTarget) return { type: 'combo', chartId: 'combo-batang-garis' };
      if (nSeri >= 2) return { type: 'line', chartId: 'garis-tren' };
      return { type: w.type === 'area' ? 'area' : w.type, chartId: w.type === 'area' ? 'area-gradasi' : 'garis-tren' };
    case 'hbar':
      return { type: 'hbar', chartId: adaTarget ? 'bar-mendatar-target' : 'bar-mendatar-peringkat' };
    case 'bar':
    case 'histogram':
    case 'waterfall':
      if (nSeri >= 2 && adaTarget) return { type: 'combo', chartId: 'combo-batang-garis' };
      // Bertumpuk hanya bila datanya memang bagian dari satu total.
      if (nSeri >= 2) return { type: 'bar', chartId: w.chart?.stacked ? 'bar-tumpuk' : 'bar-tegak' };
      // Deret waktu selalu tegak (kiri ke kanan = maju waktu), berapa pun jumlahnya.
      if (deretWaktu(kategori)) return { type: 'bar', chartId: 'bar-tegak' };
      // Rentang berurutan ("0–30 hari", "> 180 hari"): urutannya bermakna, jadi tegak tanpa sorotan.
      if (kategori.length >= 3 && kategori.every((k) => /^(\d+\s*[–-]\s*\d+|[<>≥≤]\s*\d+)/.test(String(k).trim()))) return { type: 'bar', chartId: 'bar-tegak' };
      if (labelPanjang || kategori.length > 8) return { type: 'hbar', chartId: 'bar-mendatar-peringkat' };
      return { type: 'bar', chartId: 'bar-tegak-sorot' };
    default:
      // heatmap, radar, treemap, funnel, sankey, map, ...: bila datanya kategori +
      // angka, tampilkan sebagai peringkat supaya tetap memakai chart katalog.
      if (kategori.length > 0 && nSeri > 0) return { type: 'hbar', chartId: 'bar-mendatar-peringkat' };
      return { type: w.type };
  }
}

const URUTAN_TOPIK: KategoriDashboard[] = ['Keuangan', 'Operasional', 'Pelayanan', 'Kinerja', 'SDM', 'Umum'];

const JUDUL_TOPIK: Record<KategoriDashboard, string> = {
  Keuangan: 'Keuangan',
  Operasional: 'Operasional',
  Pelayanan: 'Pelayanan Pelanggan',
  Kinerja: 'Capaian Kinerja',
  SDM: 'Sumber Daya Manusia',
  Umum: 'Ringkasan Lainnya',
};

const topik = (w: WidgetSpec): KategoriDashboard => {
  const c = w.category as KategoriDashboard | undefined;
  if (c && URUTAN_TOPIK.includes(c)) return c;
  return kategoriWidget(w.title, (w.chart?.series ?? []).map((s) => s.name));
};

/** Tata letak 12 kolom satu halaman: KPI satu baris, kartu lain berpasangan. */
function tataHalaman(isi: WidgetSpec[]): WidgetSpec[] {
  const kpi = isi.filter((w) => TIPE_KPI.includes(w.type));
  const lain = isi.filter((w) => !TIPE_KPI.includes(w.type));
  const hasil: WidgetSpec[] = [];
  const lebarKpi = kpi.length ? Math.max(3, Math.floor(12 / kpi.length)) : 0;
  kpi.forEach((w, i) => hasil.push({ ...w, grid: { x: (i * lebarKpi) % 12, y: 0, w: lebarKpi, h: 2 } }));
  const yAwal = kpi.length ? 2 : 0;
  lain.forEach((w, i) => {
    // Satu kartu = lebar penuh; ganjil terakhir juga lebar penuh.
    const sendiri = lain.length === 1 || (i === lain.length - 1 && lain.length % 2 === 1);
    hasil.push({ ...w, grid: { x: sendiri ? 0 : (i % 2) * 6, y: yAwal + Math.floor(i / 2) * 4, w: sendiri ? 12 : 6, h: 4 } });
  });
  return hasil;
}

/**
 * Bagi daftar menjadi potongan berukuran maksimal `n`, dibagi RATA: 9 kartu
 * dengan batas 4 menjadi 3+3+3, bukan 4+4+1 (halaman hampir kosong).
 */
const potong = <T,>(daftar: T[], n: number): T[][] => {
  if (daftar.length === 0) return [];
  const jumlah = Math.ceil(daftar.length / n);
  const ukuran = Math.ceil(daftar.length / jumlah);
  const keluar: T[][] = [];
  for (let i = 0; i < daftar.length; i += ukuran) keluar.push(daftar.slice(i, i + ukuran));
  return keluar;
};

/**
 * Bagi widget ke halaman per topik. Topik kecil (hanya KPI, atau satu kartu)
 * digabung ke halaman ringkasan supaya tidak ada halaman yang hampir kosong.
 */
export function bagiHalaman(widgets: WidgetSpec[]): Array<{ judul: string; widgets: WidgetSpec[] }> {
  const perTopik = new Map<KategoriDashboard, WidgetSpec[]>();
  for (const w of widgets) {
    const t = topik(w);
    perTopik.set(t, [...(perTopik.get(t) ?? []), w]);
  }

  const halaman: Array<{ judul: string; kpi: WidgetSpec[]; lain: WidgetSpec[] }> = [];
  const sisaKpi: WidgetSpec[] = [];
  const sisaLain: WidgetSpec[] = [];

  for (const t of URUTAN_TOPIK) {
    const isi = perTopik.get(t);
    if (!isi?.length) continue;
    const kpi = isi.filter((w) => TIPE_KPI.includes(w.type));
    const lain = isi.filter((w) => !TIPE_KPI.includes(w.type));
    if (lain.length < 2 || t === 'Umum') {
      sisaKpi.push(...kpi);
      sisaLain.push(...lain);
      continue;
    }
    const potonganLain = potong(lain, MAKS_KARTU_PER_HALAMAN);
    const potonganKpi = potong(kpi, MAKS_KPI_PER_HALAMAN);
    potonganLain.forEach((bagian, i) => {
      halaman.push({
        judul: potonganLain.length > 1 ? `${JUDUL_TOPIK[t]} (${i + 1})` : JUDUL_TOPIK[t],
        kpi: potonganKpi[i] ?? [],
        lain: bagian,
      });
    });
    // KPI yang tidak kebagian halaman topiknya masuk halaman ringkasan.
    potonganKpi.slice(potonganLain.length).forEach((k) => sisaKpi.push(...k));
  }

  // Halaman ringkasan di depan: KPI lintas topik + kartu sisa.
  if (sisaKpi.length || sisaLain.length) {
    const kpiRingkas = potong(sisaKpi, MAKS_KPI_PER_HALAMAN);
    const lainRingkas = potong(sisaLain, MAKS_KARTU_PER_HALAMAN);
    const jumlah = Math.max(kpiRingkas.length, lainRingkas.length);
    const ringkas = Array.from({ length: jumlah }, (_, i) => ({
      judul: i === 0 ? 'Ringkasan' : `Ringkasan (${i + 1})`,
      kpi: kpiRingkas[i] ?? [],
      lain: lainRingkas[i] ?? [],
    }));
    halaman.unshift(...ringkas);
  }

  return halaman.map((h) => ({ judul: h.judul, widgets: tataHalaman([...h.kpi, ...h.lain]) }));
}

/** Batas isi halaman yang diminta pengguna: satu baris KPI penuh + tiga baris kartu. */
const MAKS_KPI_DIMINTA = 6;
const MAKS_KARTU_DIMINTA = 6;

/**
 * Bagi widget ke halaman yang DITULIS pengguna. Widget yang diambil khusus
 * untuk satu halaman (`petaWidget`) masuk ke halaman itu; widget lain ke
 * halaman yang butirnya paling cocok. Widget yang tidak cocok dengan halaman
 * mana pun tidak dipaksakan masuk (pengguna meminta satu topik per halaman),
 * termasuk KPI: dulu KPI tanpa pasangan dibuang ke halaman Ringkasan sehingga
 * "Target Kegiatan Setahun" ikut tampil di sana. Widget yang topiknya adalah
 * judul halaman lain (tabel pengaduan di Ringkasan, padahal ada halaman
 * "Kualitas dan Keluhan") dipindah ke halaman itu. Halaman tanpa isi tidak dibuat.
 */
export function bagiHalamanDiminta(
  widgets: WidgetSpec[],
  diminta: HalamanDiminta[],
  petaWidget: Record<string, number> = {}
): { halaman: Array<{ judul: string; widgets: WidgetSpec[] }>; kosong: string[]; dilewati: WidgetSpec[] } {
  const isi = diminta.map(() => ({ kpi: [] as WidgetSpec[], lain: [] as WidgetSpec[] }));
  const dilewati: WidgetSpec[] = [];
  const terpasang: WidgetSpec[] = [];
  for (const w of widgets) {
    // Metrik sama dengan nama lain ("NRW" vs "Tingkat Kehilangan Air") cukup sekali.
    if (widgetKembar(w, terpasang)) {
      dilewati.push(w);
      continue;
    }
    let i = petaWidget[w.id] ?? halamanUntukWidget(w, diminta);
    const kpi = TIPE_KPI.includes(w.type);
    if (i >= 0) {
      const teks = [w.title, ...(w.chart?.series ?? []).map((s) => s.name)].join(' ');
      const skorButir = (h: HalamanDiminta) => Math.max(0, ...h.butir.map((b) => skorCocok(b, teks)));
      const sendiri = Math.max(skorButir(diminta[i]), skorCocok(diminta[i].judul, teks));
      // Pindah hanya bila cocoknya di halaman sendiri lemah dan halaman lain lebih cocok.
      const pemilik = diminta.findIndex(
        (h, j) => j !== i && skorCocok(h.judul, teks) >= 0.5 && skorButir(h) > sendiri
      );
      if (pemilik >= 0 && sendiri < 0.75) i = pemilik;
    }
    // Grafik dari sapuan dokumen yang tidak cocok dengan butir mana pun masuk ke
    // halaman yang judulnya topik grafik itu (tren beban -> "Keuangan"). Dulu
    // grafik seperti ini dibuang sehingga dashboard hanya berisi 1-2 grafik.
    // KPI tidak ikut: KPI nyasar membuat halaman campur topik.
    if (i < 0 && !kpi) {
      const t = topik(w);
      if (t !== 'Umum') i = diminta.findIndex((h) => skorCocok(JUDUL_TOPIK[t], h.judul) >= 0.5 || skorCocok(t, h.judul) >= 0.5);
    }
    const wadah = i >= 0 ? isi[i] : undefined;
    const daftar = wadah ? (kpi ? wadah.kpi : wadah.lain) : undefined;
    if (!daftar || daftar.length >= (kpi ? MAKS_KPI_DIMINTA : MAKS_KARTU_DIMINTA)) {
      dilewati.push(w);
      continue;
    }
    daftar.push(w);
    terpasang.push(w);
  }
  const halaman: Array<{ judul: string; widgets: WidgetSpec[] }> = [];
  const kosong: string[] = [];
  diminta.forEach((h, i) => {
    const { kpi, lain } = isi[i];
    if (kpi.length + lain.length === 0) kosong.push(h.judul);
    else halaman.push({ judul: h.judul, widgets: tataHalaman([...kpi, ...lain]) });
  });
  return { halaman, kosong, dilewati };
}

const NAMA_GAYA: Record<string, Varian> = { pijar: 'ringkasan', lensa: 'analitik', nadi: 'trafik', kaca: 'kaca', glassy: 'kaca', glass: 'kaca', bening: 'kaca', tirta: 'tirta', samudra: 'tirta', aurora: 'aurora', neon: 'neon', blok: 'blok', brutal: 'blok', neubrutalism: 'blok', bento: 'bento', pastel: 'bento', koran: 'koran', editorial: 'koran', korporat: 'korporat', korporasi: 'korporat', corporate: 'korporat', default: 'default', netral: 'default' };

/**
 * Apakah pengguna meminta chart dari menu Template Chart? Ya bila menyebut gaya
 * ("gaya lensa") atau template chart / katalog. Selain itu asisten merancang
 * chart-nya sendiri dari isi dokumen (lihat `services/chart/rancanganRag.ts`).
 */
export function mintaTemplateChart(prompt: string): boolean {
  const t = String(prompt ?? '').toLowerCase();
  return (
    Boolean(gayaDariPermintaan(t)) ||
    /template\s*chart|chart\s*(?:dari\s*)?(?:katalog|template)|(?:pakai|gunakan|dengan)\s+(?:template|katalog)|gaya\s+template/.test(t)
  );
}

/** Gaya yang diminta di kalimat pengguna ("pakai gaya lensa"), bila ada. */
export function gayaDariPermintaan(prompt: string): Varian | undefined {
  const m = String(prompt).toLowerCase().match(/(?:^|[^a-z])(pijar|lensa|nadi|kaca|glassy|glass|bening|tirta|samudra|aurora|neon|blok|brutal|neubrutalism|bento|pastel|koran|editorial|korporat|korporasi|corporate)(?:[^a-z]|$)/);
  return m ? NAMA_GAYA[m[1]] : undefined;
}

/**
 * Judul dashboard dari isi: topik halaman yang benar-benar ada, bukan judul
 * karangan model bahasa. Contoh: "Kinerja Keuangan & Operasional — PAM Jaya".
 */
export function judulDariIsi(halaman: Array<{ judul: string }>, instansi?: string): string {
  const topikAda = [...new Set(halaman.map((h) => h.judul.replace(/\s*\(\d+\)$/, '')).filter((j) => !/^Ringkasan/.test(j)))];
  const inti =
    topikAda.length === 0
      ? 'Ringkasan Kinerja'
      : topikAda.length <= 3
        ? `Kinerja ${topikAda.slice(0, -1).join(', ')}${topikAda.length > 1 ? ' & ' : ''}${topikAda[topikAda.length - 1]}`
        : // Banyak topik: "& Lainnya" terbaca seperti judul yang terpotong.
          'Kinerja Terpadu';
  return instansi ? `${inti} — ${instansi}` : inti;
}

export interface HasilSusun {
  title: string;
  halaman: HalamanDashboard[];
  /** Halaman yang diminta pengguna tetapi tidak ada datanya di dokumen. */
  halamanKosong: string[];
}

/**
 * Pintu utama: widget mentah hasil dokumen -> dashboard berhalaman siap simpan.
 */
export function susunDashboardBerhalaman(
  widgets: WidgetSpec[],
  opsi: {
    instansi?: string;
    desain?: Varian;
    idAwal?: string;
    /** Susunan halaman dari kalimat pengguna; kosong = dibagi otomatis per topik. */
    halamanDiminta?: HalamanDiminta[];
    /** Widget yang diambil khusus untuk satu halaman: id -> indeks halaman. */
    halamanWidget?: Record<string, number>;
    /**
     * false = grafik memakai rancangan asisten (tanpa chart katalog). Bawaan true
     * (perilaku lama): semua grafik dipetakan ke chart katalog.
     */
    chartTemplate?: boolean;
    /** Judul dashboard yang sudah pasti (mis. "Dashboard Piutang 2026"); kosong = dari isi. */
    judul?: string;
  } = {}
): HasilSusun {
  const dasar = opsi.idAwal ?? `w${Date.now()}`;
  const terpilih = buangKembar(widgets).map((w, i) => {
    // Grafik rancangan asisten tetap apa adanya (bentuk & desain dari RAG), kecuali
    // pengguna meminta chart dari menu Template Chart.
    const pilih = opsi.chartTemplate === false && w.rancangan && w.chart ? { type: w.type } : pilihChart(w);
    return {
      ...w,
      // Penjaga terakhir sebelum disimpan: elipsis tidak boleh tersimpan di judul
      // atau periode (tahunnya hilang permanen), dan periode memakai bentuk seragam.
      title: tanpaElipsis(w.title),
      ...(w.subtitle ? { subtitle: tanpaElipsis(w.subtitle) } : {}),
      ...(w.chart?.xAxis ? { chart: { ...w.chart, xAxis: w.chart.xAxis.map((l) => tanpaElipsis(String(l)) || String(l)) } } : {}),
      periode: periodeWidget(w) ?? tanpaElipsis(w.periode ?? ''),
      id: w.id || `${dasar}-${i + 1}`,
      type: pilih.type,
      ...(pilih.chartId ? { chartId: pilih.chartId } : {}),
      ...(opsi.desain ? { style: { ...(w.style ?? {}), desain: opsi.desain } } : {}),
    } as WidgetSpec;
  });

  const diminta = opsi.halamanDiminta ?? [];
  const sesuaiPermintaan = diminta.length > 0 ? bagiHalamanDiminta(terpilih, diminta, opsi.halamanWidget) : null;
  // Tidak satu pun halaman yang diminta terisi: kembali ke pembagian otomatis.
  const pakaiPermintaan = sesuaiPermintaan && sesuaiPermintaan.halaman.length > 0;
  const bagian = pakaiPermintaan ? sesuaiPermintaan.halaman : bagiHalaman(terpilih);
  const halaman: HalamanDashboard[] = bagian.map((h, i) => ({ id: `hlm-${i + 1}`, judul: h.judul, widgets: h.widgets }));
  return {
    title: opsi.judul || judulDariIsi(bagian, opsi.instansi),
    halaman,
    halamanKosong: pakaiPermintaan ? sesuaiPermintaan.kosong : diminta.map((h) => h.judul),
  };
}

/** Buang elipsis ("…" / "...") dan kurung yang tertinggal terbuka di ujung teks. */
export function tanpaElipsis(teks: string): string {
  let t = String(teks ?? '').replace(/…|\.{3}/g, '').trim();
  while ((t.match(/\(/g)?.length ?? 0) > (t.match(/\)/g)?.length ?? 0)) t = t.slice(0, t.lastIndexOf('('));
  return t.replace(/[\s,;:\-–—]+$/, '').trim();
}
