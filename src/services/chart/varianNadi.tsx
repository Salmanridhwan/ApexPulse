import { htmlBentuk } from './pembangunOpsi';
export interface SeriTrafik {
  nama: string;
  warna: string;
  data: number[];
}

export interface Kpi {
  label: string;
  nilai: string;
  delta: string;
  naik: boolean;
  /** Arah naik/turun ini kabar baik atau buruk (warna lencana). */
  naikBagus: boolean;
  seri: number[];
}

export interface Usia {
  label: string;
  penuh: string;
  persen: number;
  jumlah: number | null;
  warna: string;
}

export interface Halaman {
  path: string;
  persen: number;
  delta: number | null;
}

export interface Perangkat {
  nama: string;
  persen: number;
  jumlah: number | null;
  warna: string;
}

export interface Perilaku {
  nama: string;
  persen: number;
  warna: string;
}

export interface Os {
  nama: string;
  persen: number;
  delta: number | null;
  warna: string;
  seri: number[];
}

export interface Frasa {
  teks: string;
  persen: number;
}

/**
 * Seluruh angka satu tampilan, baik contoh maupun dokumen. Satu bentuk supaya
 * JSX dan pembentuk opsi grafik tidak perlu tahu asal angkanya.
 */
export interface DataTrafik {
  /** true = angka dari dokumen instansi. */
  dinamis: boolean;
  kpi: Kpi[];
  sumber: SeriTrafik[];
  hari: string[];
  hariRelevansi: string[];
  relevansi: number[];
  usia: Usia[];
  usiaTotal: string;
  usiaDelta: number | null;
  halaman: Halaman[];
  perangkat: Perangkat[];
  perangkatTotal: string;
  perilaku: Perilaku[];
  os: Os[];
  frasa: Frasa[];
}


import type { NilaiTrafik } from '../templates/nilaiTemplate';
import type { DataChart } from './pembangunOpsi';

/**
 * WAJAH NADI (template dashboard trafik).
 *
 * Seluruh konstanta, helper, dan penyusun opsi di berkas ini dipindahkan APA
 * ADANYA dari halaman `DashboardTrafik`. Katalog template chart dan dashboard
 * memakai kode yang sama, jadi hasilnya sama persis.
 */

export const WARNA = {
  latar: '#0b0d12',
  kartu: '#12151d',
  kartu2: '#171b25',
  garis: 'rgba(255,255,255,0.07)',
  teks: '#f2f5f9',
  teks2: '#9aa3b2',
  teks3: '#8792a3',
  biru: '#3b82f6',
  biruMuda: '#60a5fa',
  kuning: '#eab308',
  merah: '#ef4444',
  oranye: '#f97316',
  hijau: '#22c55e',
  cyan: '#22d3ee',
  ungu: '#a855f7',
  abu: '#94a3b8',
};

/**
 * Urutan warna kategori template. Dipakai juga untuk seri dari dokumen supaya
 * warna kartu tetap sama walau nama serinya berbeda.
 */
export const WARNA_SERI = [WARNA.biru, WARNA.kuning, WARNA.merah, WARNA.oranye, WARNA.cyan, WARNA.ungu, WARNA.hijau, WARNA.biruMuda];
export const WARNA_USIA = [WARNA.biru, WARNA.kuning, WARNA.biruMuda, WARNA.ungu, WARNA.merah, WARNA.abu];
export const WARNA_PERANGKAT = [WARNA.biru, WARNA.kuning, WARNA.merah, WARNA.oranye];
export const WARNA_PERILAKU = [WARNA.biru, WARNA.kuning, WARNA.merah, WARNA.hijau];
export const WARNA_OS = [WARNA.biru, WARNA.kuning, WARNA.ungu, WARNA.merah, WARNA.abu];

export const N_HARI = 31;
export const SEMUA_TANGGAL = Array.from({ length: N_HARI }, (_, i) => `${String(i + 1).padStart(2, '0')}.01`);

/** Kurva lonceng: trafik naik ke tengah bulan lalu menurun. */
export const lonceng = (i: number, puncak = 15, lebar = 6.5) => Math.exp(-((i - puncak) ** 2) / (2 * lebar * lebar));

export const SERI_TRAFIK: SeriTrafik[] = [
  { nama: 'Mesin Pencari', warna: WARNA.biru, data: Array.from({ length: N_HARI }, (_, i) => Math.round(49 * lonceng(i) + 3)) },
  { nama: 'Iklan', warna: WARNA.kuning, data: Array.from({ length: N_HARI }, (_, i) => Math.round(4.4 * lonceng(i) + 1)) },
  { nama: 'Media Sosial', warna: WARNA.merah, data: Array.from({ length: N_HARI }, (_, i) => Math.round(4.4 * lonceng(i) + 1)) },
  { nama: 'Akses Langsung', warna: WARNA.oranye, data: Array.from({ length: N_HARI }, (_, i) => Math.round(0.6 * lonceng(i))) },
];

export const RELEVANSI = Array.from({ length: N_HARI }, (_, i) => {
  const dasar = 46 + 16 * lonceng(i, 14, 7);
  const acak = [0, 6, -4, 8, -3, 5, -7, 4, 9, -5, 3, 7, -6, 5, -2, 8, -4, 6, -8, 3, 7, -3, 5, -6, 4, 8, -5, 2, 6, -4, 3][i];
  return Math.max(20, Math.round(dasar + acak));
});

export const KPI_CONTOH: Kpi[] = [
  { label: 'Rasio Pentalan', nilai: '57%', delta: '1%', naik: true, naikBagus: false, seri: [52, 54, 53, 56, 55, 58, 57, 59, 56, 57] },
  { label: 'Kedalaman Halaman', nilai: '1,45', delta: '0,05', naik: true, naikBagus: true, seri: [1.2, 1.25, 1.3, 1.28, 1.35, 1.4, 1.38, 1.42, 1.44, 1.45] },
  { label: 'Waktu di Situs', nilai: '4,9 mnt', delta: '1 mnt', naik: true, naikBagus: true, seri: [3.6, 3.9, 3.8, 4.1, 4.3, 4.2, 4.5, 4.6, 4.8, 4.9] },
  { label: 'Pengunjung', nilai: '1.120', delta: '11', naik: true, naikBagus: true, seri: [980, 1010, 990, 1040, 1060, 1050, 1080, 1090, 1110, 1120] },
  { label: 'Pengunjung Baru', nilai: '340', delta: '24', naik: false, naikBagus: true, seri: [380, 372, 366, 360, 356, 350, 348, 344, 342, 340] },
];

/** Usia pengunjung — total 2.320 kunjungan. */
export const USIA: Usia[] = [
  { label: '25 – 34', penuh: '25 – 34 tahun', persen: 51.3, jumlah: 1190, warna: WARNA.biru },
  { label: '35 – 44', penuh: '35 – 44 tahun', persen: 24.7, jumlah: 573, warna: WARNA.kuning },
  { label: '18 – 24', penuh: '18 – 24 tahun', persen: 10.0, jumlah: 232, warna: WARNA.biruMuda },
  { label: '45 – 54', penuh: '45 – 54 tahun', persen: 9.0, jumlah: 209, warna: WARNA.ungu },
  { label: '55 +', penuh: '55 tahun ke atas', persen: 4.0, jumlah: 93, warna: WARNA.merah },
  { label: 'Tak tentu', penuh: 'Tak diketahui', persen: 1.0, jumlah: 23, warna: WARNA.abu },
];

export const HALAMAN: Halaman[] = [
  { path: '/program-federal', persen: 40.3, delta: 2 },
  { path: '/galeri', persen: 20.7, delta: 1 },
  { path: '/lima', persen: 17.0, delta: 1 },
  { path: '/lowongan', persen: 10.0, delta: 4 },
  { path: '/galeri/163454517/pertumbuhan', persen: 7.0, delta: -3 },
  { path: '/galeri/16345560', persen: 3.0, delta: -1 },
  { path: 'Lainnya', persen: 2.0, delta: 1 },
  { path: '/beranda', persen: 1.6, delta: 1 },
  { path: '/kontak', persen: 1.2, delta: 0 },
  { path: '/tentang', persen: 0.9, delta: -1 },
];

export const PERANGKAT: Perangkat[] = [
  { nama: 'PC', persen: 69.7, jumlah: 1617, warna: WARNA.biru },
  { nama: 'Ponsel', persen: 29.0, jumlah: 673, warna: WARNA.kuning },
  { nama: 'Tablet', persen: 1.3, jumlah: 30, warna: WARNA.merah },
];

export const PERILAKU: Perilaku[] = [
  { nama: 'VK', persen: 75, warna: WARNA.biru },
  { nama: 'Facebook', persen: 15, warna: WARNA.kuning },
  { nama: 'Pinterest', persen: 10, warna: WARNA.merah },
];

export const OS_CONTOH: Os[] = [
  { nama: 'Windows', persen: 40, delta: 0, warna: WARNA.biru, seri: [] },
  { nama: 'Google Android', persen: 31, delta: 2, warna: WARNA.kuning, seri: [] },
  { nama: 'Mac OS', persen: 17, delta: 1, warna: WARNA.ungu, seri: [] },
  { nama: 'iOS', persen: 9, delta: -4, warna: WARNA.merah, seri: [] },
  { nama: 'Linux', persen: 3, delta: 1, warna: WARNA.abu, seri: [] },
];

export const DERET_OS = (() => {
  const arah = [0, 2.4, 0.6, -2.6, 0.6];
  const mentah = Array.from({ length: 30 }, (_, i) =>
    OS_CONTOH.map((o, j) => Math.max(1, (o.persen + (arah[j] * i) / 29) * (1 + 0.05 * Math.sin((i + j * 3) / 3.6)))),
  );
  const normal = mentah.map((b) => {
    const t = b.reduce((x, y) => x + y, 0);
    return b.map((v) => Math.round((v / t) * 1000) / 10);
  });
  return OS_CONTOH.map((o, j) => {
    const seri = normal.map((b) => b[j]);
    const f = o.persen / seri[seri.length - 1];
    return seri.map((v) => Math.round(v * f * 10) / 10);
  });
})();

export const FRASA: Frasa[] = [
  { teks: '#landingpage', persen: 35 },
  { teks: '#ilustrasi kreatif', persen: 25 },
  { teks: '#ecommerce', persen: 19 },
  { teks: '#desain UI/UX', persen: 7 },
  { teks: '#logofolio', persen: 6 },
  { teks: '#desain grafis', persen: 4 },
  { teks: '#portofolio', persen: 3 },
  { teks: '#tipografi', persen: 1 },
  { teks: '#branding', persen: 0.5 },
  { teks: '#motion', persen: 0.5 },
];

/** Seluruh angka contoh dalam satu objek — dipakai saat tidak ada data dokumen. */
export const DATA_CONTOH: DataTrafik = {
  dinamis: false,
  kpi: KPI_CONTOH,
  sumber: SERI_TRAFIK,
  hari: SEMUA_TANGGAL,
  hariRelevansi: SEMUA_TANGGAL,
  relevansi: RELEVANSI,
  usia: USIA,
  usiaTotal: '2.320',
  usiaDelta: -7,
  halaman: HALAMAN,
  perangkat: PERANGKAT,
  perangkatTotal: '2.320',
  perilaku: PERILAKU,
  os: OS_CONTOH.map((o, j) => ({ ...o, seri: DERET_OS[j] })),
  frasa: FRASA,
};

export const desimal = (v: number) => String(v).replace('.', ',');

export const labelHari = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));

/** Angka total satu seri pada rentang yang sedang tampil. */
export const jumlahRentang = (seri: number[], mulai: number) => seri.slice(mulai).reduce((a, b) => a + b, 0);

/**
 * Ubah nilai dokumen menjadi bentuk yang dipakai JSX & pembentuk opsi grafik.
 * Hanya slot yang memang punya angka yang diisi; sisanya '' / null / [].
 */
export const dariNilai = (n: NilaiTrafik): DataTrafik => {
  // ── KPI: label & urutan kartu template dipertahankan, angkanya dari dokumen ──
  const kpi: Kpi[] = KPI_CONTOH.map((k, i) => {
    const d = n.kpi?.[i];
    const nilai = d?.nilai?.trim() ?? '';
    if (!nilai) return { ...k, nilai: '', delta: '', seri: [] };
    const delta = typeof d?.delta === 'number' && Number.isFinite(d.delta) ? d.delta : null;
    return {
      // Label dari dokumen bila ada; kalau tidak, label template dipertahankan.
      label: d?.label?.trim() || k.label,
      nilai,
      // Tanpa angka perubahan di dokumen → lencana delta dikosongkan.
      delta: delta == null || delta === 0 ? '' : `${desimal(Math.abs(delta))}%`,
      naik: (delta ?? 0) >= 0,
      naikBagus: k.naikBagus,
      seri: d?.seri && d.seri.length >= 2 ? d.seri : [],
    };
  });

  // ── Sumber trafik: nama & angka dari dokumen, warna mengikuti urutan template ──
  const sumber: SeriTrafik[] = (n.sumber?.seri ?? [])
    .filter((s) => s.data.length > 0)
    .map((s, i) => ({
      nama: s.nama || `Seri ${i + 1}`,
      warna: WARNA_SERI[i % WARNA_SERI.length],
      data: s.data,
    }));
  const panjangSumber = sumber.length ? Math.max(...sumber.map((s) => s.data.length)) : 0;
  const hari = n.sumber?.label?.length ? n.sumber.label : labelHari(panjangSumber);

  // ── Dinamika relevansi ──
  const relevansi = n.relevansi?.data ?? [];
  const hariRelevansi = n.relevansi?.label?.length ? n.relevansi.label : labelHari(relevansi.length);

  // ── Usia ──
  const usia: Usia[] = (n.usia ?? []).map((u, i) => ({
    label: u.label,
    penuh: u.penuh || u.label,
    persen: u.persen,
    jumlah: u.jumlah ?? null,
    warna: WARNA_USIA[i % WARNA_USIA.length],
  }));
  const usiaTotal =
    n.usiaTotal?.trim() ||
    (usia.length && usia.every((u) => u.jumlah != null)
      ? new Intl.NumberFormat('id-ID').format(usia.reduce((a, b) => a + (b.jumlah ?? 0), 0))
      : '');
  const usiaDelta =
    typeof n.usiaDelta === 'number' && Number.isFinite(n.usiaDelta) && n.usiaDelta !== 0 ? n.usiaDelta : null;

  // ── Halaman populer ──
  const halaman: Halaman[] = (n.halaman ?? [])
    .filter((h) => h.path && h.persen > 0)
    .map((h) => ({ path: h.path, persen: h.persen, delta: h.delta ?? null }));

  // ── Jenis perangkat ──
  const perangkat: Perangkat[] = (n.perangkat ?? [])
    .filter((p) => p.nama && p.persen > 0)
    .map((p, i) => ({
      nama: p.nama,
      persen: p.persen,
      jumlah: p.jumlah ?? null,
      warna: WARNA_PERANGKAT[i % WARNA_PERANGKAT.length],
    }));
  const perangkatTotal = n.perangkatTotal?.trim() || '';

  // ── Faktor perilaku ──
  const perilaku: Perilaku[] = (n.perilaku ?? [])
    .filter((p) => p.nama && p.persen > 0)
    .map((p, i) => ({ nama: p.nama, persen: p.persen, warna: WARNA_PERILAKU[i % WARNA_PERILAKU.length] }));

  // ── Sistem operasi ──
  const os: Os[] = (n.os ?? [])
    .filter((o) => o.nama && o.persen > 0)
    .map((o, i) => ({
      nama: o.nama,
      persen: o.persen,
      delta: typeof o.delta === 'number' && Number.isFinite(o.delta) ? o.delta : null,
      warna: WARNA_OS[i % WARNA_OS.length],
      seri: o.seri && o.seri.length >= 2 ? o.seri : [],
    }));

  // ── Frasa pencarian ──
  const frasa: Frasa[] = (n.frasa ?? []).filter((f) => f.teks && f.persen > 0);

  return {
    dinamis: true,
    kpi,
    sumber,
    hari,
    hariRelevansi,
    relevansi,
    usia,
    usiaTotal,
    usiaDelta,
    halaman,
    perangkat,
    perangkatTotal,
    perilaku,
    os,
    frasa,
  };
};

/** Sparkline halus (Catmull-Rom → bezier). */
export const jalurSpark = (seri: number[]) => {
  const min = Math.min(...seri);
  const max = Math.max(...seri);
  const span = max - min || 1;
  const titik = seri.map((v, i) => ({ x: (i / (seri.length - 1)) * 100, y: 100 - ((v - min) / span) * 76 - 12 }));
  let d = `M${titik[0].x.toFixed(1)},${titik[0].y.toFixed(1)}`;
  for (let i = 0; i < titik.length - 1; i += 1) {
    const p0 = titik[i - 1] ?? titik[i];
    const p1 = titik[i];
    const p2 = titik[i + 1];
    const p3 = titik[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return { garis: d, area: `${d}L100,100L0,100Z` };
};

export const tooltipDasar = (s: number) => ({
  backgroundColor: 'rgba(20,24,32,0.97)',
  borderColor: 'rgba(120,150,200,0.26)',
  borderWidth: 1,
  padding: [7 * s, 11 * s],
  extraCssText: `border-radius:${8 * s}px; box-shadow:0 ${6 * s}px ${18 * s}px rgba(0,0,0,0.5); backdrop-filter:blur(6px);`,
  textStyle: { color: WARNA.teks, fontSize: 11 * s },
});

export const gradasi = (warna: string, arah: 'x' | 'y' = 'x') => ({
  type: 'linear',
  x: 0,
  y: 0,
  x2: arah === 'x' ? 1 : 0,
  y2: arah === 'x' ? 0 : 1,
  colorStops: [
    { offset: 0, color: `${warna}66` },
    { offset: 1, color: warna },
  ],
});

export const opsiTrafik = (s: number, rentang: number, d: DataTrafik) => {
  const mulai = Math.max(0, d.hari.length - rentang);
  const kategori = d.hari.slice(mulai);
  // Skala sumbu Y mengikuti angka dokumen supaya batang tidak terpotong; pada
  // tampilan contoh nilainya tetap 0–80 seperti acuan.
  const tumpuk = kategori.map((_, i) => d.sumber.reduce((a, seri) => a + (seri.data[mulai + i] ?? 0), 0));
  const puncak = tumpuk.length ? Math.max(...tumpuk) : 0;
  const batas = d.dinamis ? (puncak > 0 ? Math.ceil((puncak * 1.18) / 10) * 10 : 10) : 80;
  const langkah = d.dinamis ? batas / 4 : 20;
  return {
    animationDuration: 700,
    animationEasing: 'cubicOut' as const,
    grid: { left: 2, right: 6, top: 14 * s, bottom: 2, containLabel: true },
    tooltip: {
      ...tooltipDasar(s),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(255,255,255,0.04)' } },
      formatter: (p: any[]) =>
        `<div style="color:${WARNA.teks3};margin-bottom:${3 * s}px">${p[0]?.name}${d.dinamis ? '' : ' 2023'}</div>` +
        p
          .filter((x) => x.value > 0)
          .map(
            (x) =>
              `<div style="display:flex;align-items:center;gap:${6 * s}px">${x.marker}<span style="flex:1">${x.seriesName}</span><b>${x.value}</b></div>`,
          )
          .join('') +
        `<div style="margin-top:${3 * s}px;border-top:1px solid rgba(255,255,255,0.12);padding-top:${3 * s}px">Total: <b>${p.reduce((a, b) => a + (b.value || 0), 0)}</b></div>`,
    },
    xAxis: {
      type: 'category',
      data: kategori,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#a3adbd', fontSize: 8.8 * s, interval: Math.max(0, Math.floor(rentang / 6) - 1) },
    },
    yAxis: {
      type: 'value',
      max: batas,
      interval: langkah,
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.11)', type: 'dashed' } },
      axisLabel: { color: '#a3adbd', fontSize: 9 * s },
    },
    series: d.sumber.map((seri, idx) => ({
      name: seri.nama,
      type: 'bar',
      stack: 'total',
      barWidth: '58%',
      data: seri.data.slice(mulai),
      itemStyle: {
        color: seri.warna,
        borderRadius: idx === d.sumber.length - 1 ? [3 * s, 3 * s, 0, 0] : 0,
      },
      emphasis: { focus: 'series', itemStyle: { shadowBlur: 10 * s, shadowColor: `${seri.warna}aa` } },
      ...(idx === 0 ? { showBackground: true, backgroundStyle: { color: 'rgba(255,255,255,0.03)' } } : {}),
    })),
  };
};

export const opsiRelevansi = (s: number, rentang: number, d: DataTrafik) => {
  const mulai = Math.max(0, d.hariRelevansi.length - rentang);
  const kategori = d.hariRelevansi.slice(mulai);
  const nilai = d.relevansi.slice(mulai);
  const rata = nilai.length ? Math.round(nilai.reduce((a, b) => a + b, 0) / nilai.length) : 0;
  const puncak = nilai.length ? Math.max(...nilai) : 0;
  const batas = d.dinamis ? Math.max(10, Math.ceil(puncak * 1.15)) : 80;
  return {
    animationDuration: 700,
    animationEasing: 'cubicOut' as const,
    grid: { left: 4, right: 6, top: 10 * s, bottom: 2, containLabel: true },
    tooltip: {
      ...tooltipDasar(s),
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: 'rgba(34,211,238,0.5)', type: 'dashed' } },
      formatter: (p: any[]) => `<div style="color:${WARNA.teks3}">${p[0]?.name}</div><b>${p[0]?.value} poin</b>`,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: kategori,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: WARNA.teks3,
        fontSize: 8.4 * s,
        interval: (i: number) => i === 0 || i === kategori.length - 1,
      },
    },
    yAxis: { type: 'value', show: false, max: batas },
    series: [
      {
        type: 'line',
        smooth: 0.4,
        symbol: 'circle',
        symbolSize: 5 * s,
        showSymbol: false,
        data: nilai,
        lineStyle: { width: 2 * s, color: WARNA.cyan, shadowColor: 'rgba(34,211,238,0.55)', shadowBlur: 12 * s, shadowOffsetY: 3 * s },
        itemStyle: { color: WARNA.cyan, borderColor: '#12151d', borderWidth: 2 * s },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(34,211,238,0.42)' },
              { offset: 1, color: 'rgba(34,211,238,0.01)' },
            ],
          },
        },
        // Garis rata-rata hanya digambar bila memang ada deret dokumen.
        markLine: nilai.length
          ? {
              silent: true,
              symbol: 'none',
              lineStyle: { color: 'rgba(255,255,255,0.28)', type: 'dashed', width: 1 },
              label: {
                formatter: (p: any) => `rata ${Math.round(p.value)}`,
                color: WARNA.teks3,
                fontSize: 8.4 * s,
                position: 'insideStartTop',
              },
              data: [{ yAxis: rata }],
            }
          : { show: false },
      },
    ],
  };
};

/** Usia: batang mendatar berperingkat (bukan sekadar daftar). */
export const opsiUsia = (s: number, d: DataTrafik) => {
  const urut = [...d.usia].reverse();
  const maks = urut.length ? Math.max(...urut.map((u) => u.persen)) : 0;
  const batas = maks > 0 ? Math.ceil(maks * 1.18) : 100;
  return {
    animationDuration: 750,
    animationEasing: 'cubicOut' as const,
    grid: { left: 2, right: 62 * s, top: 2, bottom: 2, containLabel: true },
    tooltip: {
      ...tooltipDasar(s),
      trigger: 'item',
      formatter: (p: any) =>
        `${p.marker} ${p.name}<br/><b>${desimal(p.value)}%</b>${
          p.data.jumlah != null ? ` · ${Number(p.data.jumlah).toLocaleString('id-ID')} kunjungan` : ''
        }`,
    },
    xAxis: { type: 'value', max: batas, show: false },
    yAxis: {
      type: 'category',
      data: urut.map((u) => u.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: WARNA.teks2, fontSize: 9.2 * s, margin: 5 * s },
    },
    series: [
      {
        type: 'bar',
        barWidth: '56%',
        data: urut.map((u) => ({
          value: u.persen,
          jumlah: u.jumlah,
          itemStyle: { color: gradasi(u.warna), borderRadius: [0, 4 * s, 4 * s, 0] },
        })),
        showBackground: true,
        backgroundStyle: { color: 'rgba(255,255,255,0.045)', borderRadius: [0, 4 * s, 4 * s, 0] },
        label: {
          show: true,
          position: 'right',
          distance: 6 * s,
          color: WARNA.teks2,
          fontSize: 8.8 * s,
          fontWeight: 'bold',
          formatter: (p: any) => `${desimal(p.value)}%`,
        },
        emphasis: { itemStyle: { shadowBlur: 12 * s, shadowColor: 'rgba(255,255,255,0.22)' } },
      },
    ],
  };
};

/** Jenis perangkat: batang tegak dengan label jumlah. */
export const opsiPerangkat = (s: number, d: DataTrafik) => {
  const nilai = d.perangkat.map((p) => p.jumlah ?? p.persen);
  const maks = nilai.length ? Math.max(...nilai) : 0;
  return {
    animationDuration: 750,
    animationEasing: 'cubicOut' as const,
    grid: { left: 2, right: 2, top: 20 * s, bottom: 2, containLabel: true },
    tooltip: {
      ...tooltipDasar(s),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(255,255,255,0.05)' } },
      formatter: (p: any[]) => {
        const titik = p[0]?.data ?? {};
        // Dokumen kadang hanya menyebut porsi (%) tanpa jumlah kunjungan.
        const isi =
          titik.jumlah != null
            ? `${Number(p[0]?.value).toLocaleString('id-ID')} kunjungan`
            : `${desimal(Number(p[0]?.value))}%`;
        return `<div style="color:${WARNA.teks3}">${p[0]?.name}</div><b>${isi}</b>${
          titik.jumlah != null ? ` · ${desimal(titik.persen)}%` : ''
        }`;
      },
    },
    xAxis: {
      type: 'category',
      data: d.perangkat.map((p) => p.nama),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: WARNA.teks2, fontSize: 9.2 * s, margin: 5 * s },
    },
    yAxis: { type: 'value', show: false, max: maks > 0 ? maks * 1.18 : 100 },
    series: [
      {
        type: 'bar',
        barWidth: '46%',
        data: d.perangkat.map((p) => ({
          value: p.jumlah ?? p.persen,
          persen: p.persen,
          jumlah: p.jumlah,
          itemStyle: { color: gradasi(p.warna, 'y'), borderRadius: [5 * s, 5 * s, 0, 0] },
        })),
        showBackground: true,
        backgroundStyle: { color: 'rgba(255,255,255,0.04)', borderRadius: [5 * s, 5 * s, 0, 0] },
        label: {
          show: true,
          position: 'top',
          distance: 4 * s,
          color: WARNA.teks,
          fontSize: 9.4 * s,
          fontWeight: 'bold',
          formatter: (p: any) =>
            p.data.jumlah != null ? Number(p.value).toLocaleString('id-ID') : `${desimal(Number(p.value))}%`,
        },
        emphasis: { itemStyle: { shadowBlur: 14 * s, shadowColor: 'rgba(255,255,255,0.25)' } },
      },
    ],
  };
};

/** Faktor perilaku: cincin (gaya donat yang sudah dipakai di template). */
export const opsiPerilaku = (s: number, d: DataTrafik) => ({
  animationDuration: 800,
  animationEasing: 'cubicOut' as const,
  tooltip: {
    ...tooltipDasar(s),
    trigger: 'item',
    formatter: (p: any) => `${p.marker} ${p.name}<br/><b>${p.value}%</b> dari skor 100`,
  },
  series: [
    {
      type: 'pie',
      radius: ['63%', '96%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: false,
      label: { show: false },
      labelLine: { show: false },
      itemStyle: {
        borderColor: WARNA.kartu,
        borderWidth: 3 * s,
        borderRadius: 6 * s,
        shadowColor: 'rgba(0,0,0,0.5)',
        shadowBlur: 8 * s,
      },
      emphasis: { scale: true, scaleSize: 6 * s, itemStyle: { shadowBlur: 18 * s, shadowColor: 'rgba(0,0,0,0.7)' } },
      data: d.perilaku.map((p) => ({ name: p.nama, value: p.persen, itemStyle: { color: p.warna } })),
    },
  ],
});


/**
 * Pembungkus: DataChart katalog -> bentuk DataTrafik yang dipakai penyusun.
 * Angka dan labelnya tetap dari `data`, jadi tidak ada angka contoh yang
 * menyelinap ke dashboard.
 */
const deret = (d: DataChart): number[] => (d.seri[0]?.data ?? []).map((v) => (typeof v === 'number' ? v : 0));

const sebagaiTrafik = (d: DataChart): DataTrafik => {
  const nilai = deret(d);
  const total = nilai.reduce((a, b) => a + b, 0) || 1;
  const palet = WARNA_SERI;
  return {
    dinamis: d.dariDokumen !== false,
    kpi: [],
    sumber: d.seri.map((sr, i) => ({
      nama: sr.nama,
      warna: palet[i % palet.length],
      data: sr.data.map((v) => (typeof v === 'number' ? v : 0)),
    })),
    hari: d.kategori,
    hariRelevansi: d.kategori,
    relevansi: nilai,
    usia: d.kategori.map((label, i) => ({
      label,
      penuh: label,
      persen: nilai[i] ?? 0,
      jumlah: nilai[i] ?? null,
      warna: palet[i % palet.length],
    })),
    usiaTotal: String(total),
    usiaDelta: null,
    halaman: d.kategori.map((path, i) => ({ path, persen: nilai[i] ?? 0, delta: null })),
    perangkat: d.kategori.map((nama, i) => ({
      nama,
      persen: nilai[i] ?? 0,
      jumlah: nilai[i] ?? null,
      warna: palet[i % palet.length],
    })),
    perangkatTotal: String(total),
    perilaku: d.kategori.map((nama, i) => ({ nama, persen: nilai[i] ?? 0, warna: palet[i % palet.length] })),
    os: d.kategori.map((nama, i) => ({
      nama,
      persen: nilai[i] ?? 0,
      delta: null,
      warna: palet[i % palet.length],
      seri: [nilai[i] ?? 0],
    })),
    frasa: d.kategori.map((teks, i) => ({ teks, persen: nilai[i] ?? 0 })),
  };
};

export const wajahNadi: Record<string, (d: DataChart, g: any, s: number) => any> = {
  'garis-tren': (d, _g, s) => opsiTrafik(s, d.kategori.length || 31, sebagaiTrafik(d)),
  'combo-batang-garis': (d, _g, s) => opsiRelevansi(s, d.kategori.length || 31, sebagaiTrafik(d)),
  'bar-tumpuk': (d, _g, s) => opsiUsia(s, sebagaiTrafik(d)),
  'donat-tebal': (d, _g, s) => opsiPerangkat(s, sebagaiTrafik(d)),
  'bar-mendatar-peringkat': (d, _g, s) => opsiPerilaku(s, sebagaiTrafik(d)),
};

/**
 * Kartu KPI versi Nadi, dipindahkan apa adanya dari halaman Trafik.
 */
export const kpiNadi = htmlBentuk('kpi-nadi');

/**
 * Strip sistem operasi: daftar baris berisi penanda warna, nama, persentase,
 * delta, dan sparkline kecil. Dipindahkan apa adanya dari halaman Trafik.
 */
export const stripOs = htmlBentuk('strip-os');
