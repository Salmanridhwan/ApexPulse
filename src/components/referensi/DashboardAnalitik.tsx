import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, DollarSign, MoreVertical, ShoppingBag, Target, Users } from 'lucide-react';
import { loadEcharts } from '../widgets/echartsSetup';

/**
 * DASHBOARD ANALITIK — replika tampilan acuan kedua.
 *
 * Referensi: dashboard analitik bisnis bertema navy gelap — 4 kartu KPI
 * (ikon berwarna + sparkline), grafik area pendapatan, batang pesanan per
 * status, cincin sumber kunjungan dengan legenda di samping, tabel pesanan
 * terbaru, dan empat grafik pendukung: nilai pesanan per kategori, pesanan
 * per jam, metode pembayaran, serta tren konversi.
 *
 * INTERAKSI (semua tombol berfungsi)
 * - Chip "Harian/Mingguan", "Bulan Ini/Bulan Lalu", "Nilai/Unit",
 *   "Hari ini/Rata-rata" membuka menu dan benar-benar mengganti data grafik.
 * - "Lihat semua" membuka daftar penuh (dapat digulir di dalam kartu).
 * - Tombol ⋮ pada tabel membuka menu (salin ID / tandai selesai).
 *
 * Catatan: SELURUH ANGKA DI SINI CONTOH (dummy), bukan dari dokumen instansi.
 */

const WARNA = {
  latar: '#080b12',
  kartu: '#0f141d',
  kartu2: '#141b26',
  garis: '#1e2633',
  teks: '#f2f5f9',
  teks2: '#9aa3b2',
  teks3: '#7b8698',
  biru: '#3b82f6',
  biruMuda: '#60a5fa',
  teal: '#2dd4bf',
  ungu: '#8b5cf6',
  oranye: '#f59e0b',
  pink: '#ec4899',
  hijau: '#22c55e',
  merah: '#f43f5e',
};

interface Kpi {
  label: string;
  nilai: string;
  delta: string;
  deltaTeks: string;
  seri: number[];
  warna: string;
  Ikon: React.ComponentType<{ className?: string }>;
}

const KPI: Kpi[] = [
  {
    label: 'Pendapatan',
    nilai: 'Rp 128.430',
    delta: '+12,5%',
    deltaTeks: 'vs 12 Apr – 11 Mei',
    seri: [30, 34, 31, 38, 36, 42, 40, 47, 45, 52, 50, 58],
    warna: WARNA.biru,
    Ikon: DollarSign,
  },
  {
    label: 'Pesanan',
    nilai: '1.542',
    delta: '+8,3%',
    deltaTeks: 'vs 12 Apr – 11 Mei',
    seri: [20, 24, 22, 28, 26, 31, 29, 35, 33, 38, 36, 42],
    warna: WARNA.ungu,
    Ikon: ShoppingBag,
  },
  {
    label: 'Pengguna',
    nilai: '8.458',
    delta: '+15,7%',
    deltaTeks: 'vs 12 Apr – 11 Mei',
    seri: [18, 22, 21, 27, 26, 32, 31, 37, 36, 43, 42, 49],
    warna: WARNA.teal,
    Ikon: Users,
  },
  {
    label: 'Rasio Konversi',
    nilai: '3,27%',
    delta: '+5,4%',
    deltaTeks: 'vs 12 Apr – 11 Mei',
    seri: [26, 24, 28, 27, 31, 29, 33, 32, 36, 34, 38, 37],
    warna: WARNA.pink,
    Ikon: Target,
  },
];

/** Data grafik area per periode (chip "Harian" / "Mingguan"). */
const AREA_DATA: Record<string, { label: string[]; nilai: number[]; judul: string; total: string }> = {
  Harian: {
    label: Array.from({ length: 30 }, (_, i) => {
      const tgl = 12 + i;
      return tgl <= 31 ? `${tgl} Mei` : `${tgl - 31} Jun`;
    }),
    nilai: [
      8200, 9100, 8700, 10200, 11800, 10900, 12400, 13200, 12600, 14100, 13800, 15200, 16400, 15900, 17300,
      18200, 17600, 19100, 20400, 19800, 21200, 22100, 21500, 23400, 22800, 24560, 23800, 25100, 24400, 25900,
    ],
    judul: '12 Mei – 10 Jun 2024',
    total: 'Rp 386.480',
  },
  Mingguan: {
    label: ['Pekan 1', 'Pekan 2', 'Pekan 3', 'Pekan 4', 'Pekan 5', 'Pekan 6', 'Pekan 7', 'Pekan 8'],
    nilai: [48200, 51400, 49800, 56300, 60100, 58900, 64200, 67800],
    judul: '8 pekan terakhir',
    total: 'Rp 456.700',
  },
};

const PESANAN_STATUS = [
  { nama: 'Selesai', singkat: 'Selesai', warna: WARNA.biru },
  { nama: 'Diproses', singkat: 'Diproses', warna: WARNA.teal },
  { nama: 'Dikirim', singkat: 'Dikirim', warna: WARNA.ungu },
  { nama: 'Dibatalkan', singkat: 'Batal', warna: WARNA.oranye },
  { nama: 'Dikembalikan', singkat: 'Kembali', warna: WARNA.pink },
];

/** Nilai batang per periode (chip "Bulan Ini" / "Bulan Lalu"). */
const BATANG_DATA: Record<string, number[]> = {
  'Bulan Ini': [820, 420, 160, 90, 32],
  'Bulan Lalu': [610, 380, 210, 140, 58],
};

const SUMBER_NAMA = ['Langsung', 'Pencarian Organik', 'Media Sosial', 'Rujukan', 'Email'];

/** Nilai cincin per periode (chip "Bulan Ini" / "Bulan Lalu"). */
const DONAT_DATA: Record<string, { nilai: number[]; total: string }> = {
  'Bulan Ini': { nilai: [32.6, 28.4, 18.7, 12.3, 8.0], total: '12.458' },
  'Bulan Lalu': { nilai: [28.1, 31.2, 20.4, 11.6, 8.7], total: '10.902' },
};

const WARNA_SUMBER = [WARNA.biru, WARNA.teal, WARNA.ungu, WARNA.oranye, WARNA.pink];

const PESANAN_AWAL = [
  { id: '#ORD-10435', nama: 'Esther Howard', inisial: 'EH', tanggal: '10 Jun 2024', jumlah: 'Rp 1.249.000', status: 'Selesai', warna: WARNA.hijau },
  { id: '#ORD-10434', nama: 'Cody Fisher', inisial: 'CF', tanggal: '10 Jun 2024', jumlah: 'Rp 89.900', status: 'Diproses', warna: WARNA.biru },
  { id: '#ORD-10433', nama: 'Jane Cooper', inisial: 'JC', tanggal: '9 Jun 2024', jumlah: 'Rp 560.000', status: 'Dikirim', warna: WARNA.ungu },
  { id: '#ORD-10432', nama: 'Dianne Russell', inisial: 'DR', tanggal: '9 Jun 2024', jumlah: 'Rp 145.500', status: 'Dibatalkan', warna: WARNA.merah },
  { id: '#ORD-10431', nama: 'Devon Lane', inisial: 'DL', tanggal: '8 Jun 2024', jumlah: 'Rp 299.990', status: 'Selesai', warna: WARNA.hijau },
  { id: '#ORD-10430', nama: 'Wade Warren', inisial: 'WW', tanggal: '8 Jun 2024', jumlah: 'Rp 74.500', status: 'Diproses', warna: WARNA.biru },
  { id: '#ORD-10429', nama: 'Brooklyn Simmons', inisial: 'BS', tanggal: '7 Jun 2024', jumlah: 'Rp 1.980.000', status: 'Selesai', warna: WARNA.hijau },
  { id: '#ORD-10428', nama: 'Cameron Williamson', inisial: 'CW', tanggal: '7 Jun 2024', jumlah: 'Rp 320.000', status: 'Dikirim', warna: WARNA.ungu },
];

/**
 * Nilai pesanan per kategori. Mode "Nilai" memakai rupiah, mode "Unit" memakai
 * jumlah pesanan. Keduanya terhubung ke angka KPI: pendapatan Rp 128.430 dan
 * 1.542 pesanan.
 */
const KATEGORI_NILAI = [
  { nama: 'Elektronik', nilai: 48920, warna: WARNA.biru },
  { nama: 'Fesyen', nilai: 32480, warna: WARNA.ungu },
  { nama: 'Rumah & Dapur', nilai: 18760, warna: WARNA.teal },
  { nama: 'Kecantikan', nilai: 15240, warna: WARNA.oranye },
  { nama: 'Olahraga', nilai: 9030, warna: WARNA.pink },
  { nama: 'Lainnya', nilai: 4000, warna: WARNA.biruMuda },
];

const KATEGORI_UNIT = [
  { nama: 'Elektronik', nilai: 486, warna: WARNA.biru },
  { nama: 'Fesyen', nilai: 402, warna: WARNA.ungu },
  { nama: 'Rumah & Dapur', nilai: 268, warna: WARNA.teal },
  { nama: 'Kecantikan', nilai: 214, warna: WARNA.oranye },
  { nama: 'Olahraga', nilai: 112, warna: WARNA.pink },
  { nama: 'Lainnya', nilai: 60, warna: WARNA.biruMuda },
];

/** Sebaran 1.542 pesanan menurut jam (24 jam). */
const JAM_PESANAN: Record<string, number[]> = {
  'Hari ini': [12, 12, 13, 16, 21, 30, 43, 61, 81, 101, 115, 121, 117, 105, 91, 81, 76, 77, 80, 80, 73, 60, 44, 31],
  'Rata-rata': [11, 11, 12, 15, 20, 28, 40, 56, 75, 93, 106, 111, 107, 97, 84, 74, 70, 71, 74, 73, 67, 55, 41, 28],
};

/** Metode pembayaran (jumlah pesanan). */
const PEMBAYARAN: Record<string, { nama: string; nilai: number; warna: string }[]> = {
  'Bulan Ini': [
    { nama: 'Transfer Bank', nilai: 612, warna: WARNA.biru },
    { nama: 'Kartu Kredit', nilai: 385, warna: WARNA.ungu },
    { nama: 'E-Wallet', nilai: 342, warna: WARNA.teal },
    { nama: 'COD', nilai: 141, warna: WARNA.oranye },
    { nama: 'Cicilan', nilai: 62, warna: WARNA.pink },
  ],
  'Bulan Lalu': [
    { nama: 'Transfer Bank', nilai: 540, warna: WARNA.biru },
    { nama: 'Kartu Kredit', nilai: 352, warna: WARNA.ungu },
    { nama: 'E-Wallet', nilai: 300, warna: WARNA.teal },
    { nama: 'COD', nilai: 128, warna: WARNA.oranye },
    { nama: 'Cicilan', nilai: 48, warna: WARNA.pink },
  ],
};

/** Tren konversi (persen) — rata-rata 3,27% seperti KPI. */
const KONVERSI: Record<string, { label: string[]; nilai: number[] }> = {
  Harian: {
    label: Array.from({ length: 30 }, (_, i) => {
      const tgl = 12 + i;
      return tgl <= 31 ? `${tgl} Mei` : `${tgl - 31} Jun`;
    }),
    nilai: [2.9, 3.1, 2.8, 3.0, 3.2, 3.4, 3.1, 3.3, 3.5, 3.2, 3.0, 3.4, 3.6, 3.3, 3.1, 3.5, 3.7, 3.4, 3.2, 3.6, 3.8, 3.5, 3.3, 3.7, 3.9, 3.6, 3.4, 3.2, 3.3, 3.27],
  },
  Mingguan: {
    label: ['Minggu 1', 'Minggu 2', 'Minggu 3', 'Minggu 4'],
    nilai: [2.95, 3.3, 3.45, 3.27],
  },
};

/** Jalur SVG sparkline halus (kurva Catmull-Rom → bezier). */
const jalurSpark = (seri: number[]) => {
  const min = Math.min(...seri);
  const max = Math.max(...seri);
  const span = max - min || 1;
  const titik = seri.map((v, i) => ({
    x: (i / (seri.length - 1)) * 100,
    y: 100 - ((v - min) / span) * 78 - 10,
  }));
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

/** Gaya dasar grafik: huruf, tooltip, dan sumbu mengikuti `skala`. */
const gayaDasar = (s: number) => ({
  tooltip: {
    backgroundColor: 'rgba(18,26,38,0.96)',
    borderColor: 'rgba(120,150,200,0.28)',
    borderWidth: 1,
    padding: [7 * s, 11 * s],
    extraCssText: `border-radius:${8 * s}px; box-shadow:0 ${6 * s}px ${18 * s}px rgba(0,0,0,0.45); backdrop-filter:blur(6px);`,
    textStyle: { color: WARNA.teks, fontSize: 11 * s },
  },
  sumbu: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: WARNA.teks3, fontSize: 9.5 * s },
  },
  garisBantu: { lineStyle: { color: 'rgba(255,255,255,0.07)', type: 'dashed' as const, width: 1 } },
});

/** Gradasi vertikal untuk batang (lebih hidup dari warna rata). */
const gradasiBatang = (warna: string) => ({
  type: 'linear' as const,
  x: 0,
  y: 0,
  x2: 0,
  y2: 1,
  colorStops: [
    { offset: 0, color: warna },
    { offset: 1, color: `${warna}55` },
  ],
});

const opsiArea = (s: number, mode: string) => {
  const dasar = gayaDasar(s);
  const d = AREA_DATA[mode] ?? AREA_DATA.Harian;
  const maks = Math.ceil(Math.max(...d.nilai) / 10000) * 10000;
  return {
    animationDuration: 700,
    animationEasing: 'cubicOut' as const,
    grid: { left: 2, right: 12 * s, top: 18 * s, bottom: 2, containLabel: true },
    tooltip: {
      ...dasar.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: 'rgba(96,165,250,0.5)', type: 'dashed', width: 1 } },
      formatter: (p: any[]) =>
        `<div style="font-size:${10 * s}px;color:${WARNA.teks3};margin-bottom:${2 * s}px">${p[0]?.name} 2024</div>` +
        `<div style="display:flex;align-items:center;gap:${6 * s}px"><span style="width:${8 * s}px;height:${8 * s}px;border-radius:50%;background:${WARNA.biru};display:inline-block"></span>` +
        `<b style="font-size:${12 * s}px">Rp ${Number(p[0]?.value ?? 0).toLocaleString('id-ID')}</b></div>`,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: d.label,
      ...dasar.sumbu,
      axisLabel: { color: WARNA.teks3, fontSize: 9 * s, interval: Math.max(0, Math.floor(d.label.length / 6) - 1) },
    },
    yAxis: {
      type: 'value',
      max: maks,
      splitNumber: 4,
      splitLine: dasar.garisBantu,
      axisLabel: { color: WARNA.teks3, fontSize: 9 * s, formatter: (v: number) => `${v / 1000} rb` },
    },
    series: [
      {
        type: 'line',
        smooth: 0.35,
        symbol: 'circle',
        symbolSize: 7 * s,
        showSymbol: false,
        data: d.nilai,
        lineStyle: { width: 2.6 * s, color: WARNA.biru, shadowColor: 'rgba(59,130,246,0.55)', shadowBlur: 14 * s, shadowOffsetY: 4 * s },
        itemStyle: { color: WARNA.biru, borderColor: '#0f141d', borderWidth: 2 * s },
        emphasis: { scale: 1.6, itemStyle: { shadowBlur: 12 * s, shadowColor: 'rgba(59,130,246,0.8)' } },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59,130,246,0.46)' },
              { offset: 0.55, color: 'rgba(59,130,246,0.16)' },
              { offset: 1, color: 'rgba(59,130,246,0.01)' },
            ],
          },
        },
        markPoint: {
          symbol: 'circle',
          symbolSize: 9 * s,
          itemStyle: { color: '#fff', borderColor: WARNA.biru, borderWidth: 3 * s, shadowBlur: 10 * s, shadowColor: 'rgba(59,130,246,0.9)' },
          label: {
            show: true,
            position: 'top',
            distance: 8 * s,
            color: WARNA.teks,
            fontSize: 9 * s,
            fontWeight: 'bold',
            backgroundColor: 'rgba(18,26,38,0.9)',
            borderRadius: 4 * s,
            padding: [2 * s, 5 * s],
            formatter: (p: any) => `Rp ${Number(p.value).toLocaleString('id-ID')}`,
          },
          data: [{ type: 'max', name: 'Tertinggi' }],
        },
      },
    ],
  };
};

const opsiBatang = (s: number, mode: string) => {
  const dasar = gayaDasar(s);
  const nilai = BATANG_DATA[mode] ?? BATANG_DATA['Bulan Ini'];
  return {
    animationDuration: 700,
    animationEasing: 'cubicOut' as const,
    grid: { left: 2, right: 6, top: 20 * s, bottom: 2, containLabel: true },
    tooltip: {
      ...dasar.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(255,255,255,0.04)' } },
      formatter: (p: any[]) => {
        const i = p[0]?.dataIndex ?? 0;
        return `<div style="color:${WARNA.teks3};margin-bottom:${2 * s}px">${PESANAN_STATUS[i]?.nama}</div><b>${p[0]?.value} pesanan</b>`;
      },
    },
    xAxis: {
      type: 'category',
      data: PESANAN_STATUS.map((x) => x.singkat),
      ...dasar.sumbu,
      axisLabel: { color: WARNA.teks3, fontSize: 8.6 * s, interval: 0 },
    },
    yAxis: {
      type: 'value',
      max: 1000,
      interval: 250,
      splitLine: dasar.garisBantu,
      axisLabel: { color: WARNA.teks3, fontSize: 9 * s, formatter: (v: number) => (v === 0 ? '0' : `${v / 1000}K`) },
    },
    series: [
      {
        type: 'bar',
        barWidth: '48%',
        showBackground: true,
        backgroundStyle: { color: 'rgba(255,255,255,0.035)', borderRadius: [5 * s, 5 * s, 0, 0] },
        data: nilai.map((v, i) => ({
          value: v,
          itemStyle: {
            color: gradasiBatang(PESANAN_STATUS[i].warna),
            borderRadius: [5 * s, 5 * s, 0, 0],
            shadowColor: `${PESANAN_STATUS[i].warna}66`,
            shadowBlur: 10 * s,
            shadowOffsetY: 3 * s,
          },
        })),
        emphasis: { itemStyle: { shadowBlur: 18 * s, shadowColor: 'rgba(255,255,255,0.35)' } },
        label: {
          show: true,
          position: 'top',
          distance: 4 * s,
          color: WARNA.teks,
          fontSize: 8.8 * s,
          fontWeight: 'bold',
        },
      },
    ],
  };
};

const opsiDonat = (s: number, mode: string) => {
  const d = DONAT_DATA[mode] ?? DONAT_DATA['Bulan Ini'];
  return {
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
    tooltip: {
      backgroundColor: 'rgba(18,26,38,0.96)',
      borderColor: 'rgba(120,150,200,0.28)',
      borderWidth: 1,
      padding: [7 * s, 11 * s],
      extraCssText: `border-radius:${8 * s}px; box-shadow:0 ${6 * s}px ${18 * s}px rgba(0,0,0,0.45);`,
      textStyle: { color: WARNA.teks, fontSize: 11 * s },
      formatter: (p: any) => `${p.marker} ${p.name}<br/><b>${String(p.value).replace('.', ',')}%</b>`,
    },
    series: [
      {
        type: 'pie',
        radius: ['64%', '93%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: {
          borderColor: WARNA.kartu,
          borderWidth: 3 * s,
          borderRadius: 6 * s,
          shadowColor: 'rgba(0,0,0,0.55)',
          shadowBlur: 8 * s,
        },
        emphasis: { scale: true, scaleSize: 6 * s, itemStyle: { shadowBlur: 18 * s, shadowColor: 'rgba(0,0,0,0.7)' } },
        data: d.nilai.map((v, i) => ({ name: SUMBER_NAMA[i], value: v, itemStyle: { color: WARNA_SUMBER[i] } })),
      },
    ],
  };
};

const gradasiBatangArah = (warna: string, s: number) => ({
  type: 'linear',
  x: 0,
  y: 0,
  x2: 1,
  y2: 0,
  colorStops: [
    { offset: 0, color: `${warna}77` },
    { offset: 1, color: warna },
  ],
});

/** Nilai pesanan per kategori (batang mendatar). */
const opsiKategori = (s: number, mode: 'Nilai' | 'Unit') => {
  const dasar = gayaDasar(s);
  const data = mode === 'Nilai' ? KATEGORI_NILAI : KATEGORI_UNIT;
  const urut = [...data].reverse();
  const maks = Math.max(...data.map((d) => d.nilai));
  return {
    animationDuration: 750,
    animationEasing: 'cubicOut' as const,
    grid: { left: 2, right: 46 * s, top: 4, bottom: 2, containLabel: true },
    tooltip: {
      ...dasar,
      trigger: 'item',
      formatter: (p: any) =>
        `${p.marker} ${p.name}<br/><b>${mode === 'Nilai' ? `Rp ${Number(p.value).toLocaleString('id-ID')}` : `${p.value} pesanan`}</b>`,
    },
    xAxis: { type: 'value', max: maks, show: false },
    yAxis: {
      type: 'category',
      data: urut.map((d) => d.nama),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: WARNA.teks2, fontSize: 9.4 * s, margin: 6 * s },
    },
    series: [
      {
        type: 'bar',
        barWidth: '54%',
        data: urut.map((d) => ({ value: d.nilai, itemStyle: { color: gradasiBatangArah(d.warna, s), borderRadius: [0, 4 * s, 4 * s, 0] } })),
        showBackground: true,
        backgroundStyle: { color: 'rgba(255,255,255,0.045)', borderRadius: [0, 4 * s, 4 * s, 0] },
        label: {
          show: true,
          position: 'right',
          distance: 6 * s,
          color: WARNA.teks2,
          fontSize: 9 * s,
          fontWeight: 'bold',
          formatter: (p: any) =>
            mode === 'Nilai' ? `${(Number(p.value) / 1000).toFixed(1).replace('.', ',')} rb` : `${p.value}`,
        },
        emphasis: { itemStyle: { shadowBlur: 12 * s, shadowColor: 'rgba(255,255,255,0.25)' } },
      },
    ],
  };
};

/** Pesanan per jam (batang 24 jam). */
const opsiJam = (s: number, mode: string) => {
  const dasar = gayaDasar(s);
  const nilai = JAM_PESANAN[mode] ?? JAM_PESANAN['Hari ini'];
  const puncak = Math.max(...nilai);
  return {
    animationDuration: 750,
    animationEasing: 'cubicOut' as const,
    grid: { left: 2, right: 4, top: 12 * s, bottom: 2, containLabel: true },
    tooltip: {
      ...dasar,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(255,255,255,0.05)' } },
      formatter: (p: any[]) => `<div style="color:${WARNA.teks3}">Pukul ${p[0]?.name}</div><b>${p[0]?.value} pesanan</b>`,
    },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}`),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: WARNA.teks3, fontSize: 8.4 * s, interval: 3 },
    },
    yAxis: { type: 'value', show: false, max: Math.ceil(puncak / 20) * 20 },
    series: [
      {
        type: 'bar',
        barWidth: '62%',
        data: nilai.map((v) => ({
          value: v,
          itemStyle: {
            color:
              v >= puncak * 0.85
                ? { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: WARNA.biruMuda }, { offset: 1, color: `${WARNA.biru}66` }] }
                : { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: `${WARNA.biru}cc` }, { offset: 1, color: `${WARNA.biru}22` }] },
            borderRadius: [3 * s, 3 * s, 0, 0],
          },
        })),
        showBackground: true,
        backgroundStyle: { color: 'rgba(255,255,255,0.035)' },
      },
    ],
  };
};

/** Metode pembayaran (cincin). */
const opsiBayar = (s: number, mode: string) => {
  const dasar = gayaDasar(s);
  const data = PEMBAYARAN[mode] ?? PEMBAYARAN['Bulan Ini'];
  return {
    animationDuration: 800,
    tooltip: {
      ...dasar,
      trigger: 'item',
      formatter: (p: any) => `${p.marker} ${p.name}<br/><b>${p.value} pesanan</b> (${p.percent}%)`,
    },
    series: [
      {
        type: 'pie',
        radius: ['62%', '92%'],
        center: ['50%', '50%'],
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderColor: WARNA.kartu, borderWidth: 3 * s, borderRadius: 5 * s, shadowColor: 'rgba(0,0,0,0.5)', shadowBlur: 8 * s },
        emphasis: { scale: true, scaleSize: 5 * s, itemStyle: { shadowBlur: 16 * s, shadowColor: 'rgba(0,0,0,0.7)' } },
        data: data.map((d) => ({ name: d.nama, value: d.nilai, itemStyle: { color: d.warna } })),
      },
    ],
  };
};

/** Tren konversi (garis + area). */
const opsiKonversi = (s: number, mode: string) => {
  const dasar = gayaDasar(s);
  const d = KONVERSI[mode] ?? KONVERSI.Harian;
  const rata = d.nilai.reduce((a, b) => a + b, 0) / d.nilai.length;
  return {
    animationDuration: 750,
    animationEasing: 'cubicOut' as const,
    grid: { left: 2, right: 8, top: 12 * s, bottom: 2, containLabel: true },
    tooltip: {
      ...dasar,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: 'rgba(34,197,94,0.45)', type: 'dashed' } },
      formatter: (p: any[]) => `<div style="color:${WARNA.teks3}">${p[0]?.name}</div><b>${String(p[0]?.value).replace('.', ',')}%</b>`,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: d.label,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: WARNA.teks3,
        fontSize: 8.2 * s,
        interval: (i: number) => i === 0 || i === d.label.length - 1,
        align: 'center',
        margin: 5 * s,
        hideOverlap: false,
      },
    },
    yAxis: {
      type: 'value',
      min: 2,
      max: 4.4,
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)', type: 'dashed' } },
      axisLabel: { color: WARNA.teks3, fontSize: 8.4 * s, formatter: (v: number) => `${String(v).replace('.', ',')}%` },
    },
    series: [
      {
        type: 'line',
        smooth: 0.42,
        symbol: 'circle',
        symbolSize: 6 * s,
        showSymbol: false,
        data: d.nilai,
        lineStyle: { width: 2.2 * s, color: WARNA.hijau, shadowColor: 'rgba(34,197,94,0.5)', shadowBlur: 10 * s, shadowOffsetY: 3 * s },
        itemStyle: { color: WARNA.hijau, borderColor: WARNA.kartu, borderWidth: 2 * s },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(34,197,94,0.38)' },
              { offset: 1, color: 'rgba(34,197,94,0.01)' },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: 'rgba(255,255,255,0.35)', type: 'dashed', width: 1 },
          label: {
            formatter: `rata ${String(rata.toFixed(2)).replace('.', ',')}%`,
            color: WARNA.teks2,
            fontSize: 8.6 * s,
            position: 'insideEndTop',
          },
          data: [{ yAxis: Number(rata.toFixed(2)) }],
        },
      },
    ],
  };
};

interface DashboardAnalitikProps {
  /** true = isi seluruh tinggi wadah (mode presentasi / layar penuh). */
  penuh?: boolean;
}

export const DashboardAnalitik: React.FC<DashboardAnalitikProps> = ({ penuh = false }) => {
  const [skala, setSkala] = useState(1);

  // ---- state interaksi (semua tombol mengubah tampilan/data) ----
  const [modeArea, setModeArea] = useState<'Harian' | 'Mingguan'>('Harian');
  const [modeBatang, setModeBatang] = useState<'Bulan Ini' | 'Bulan Lalu'>('Bulan Ini');
  const [modeDonat, setModeDonat] = useState<'Bulan Ini' | 'Bulan Lalu'>('Bulan Ini');
  const [modeKategori, setModeKategori] = useState<'Nilai' | 'Unit'>('Nilai');
  const [modeJam, setModeJam] = useState<'Hari ini' | 'Rata-rata'>('Hari ini');
  const [modeBayar, setModeBayar] = useState<'Bulan Ini' | 'Bulan Lalu'>('Bulan Ini');
  const [modeKonversi, setModeKonversi] = useState<'Harian' | 'Mingguan'>('Harian');
  const [semuaPesanan, setSemuaPesanan] = useState(false);
  const [menuBaris, setMenuBaris] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [pesanan, setPesanan] = useState(PESANAN_AWAL);

  const akarRef = useRef<HTMLDivElement | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const batangRef = useRef<HTMLDivElement | null>(null);
  const donatRef = useRef<HTMLDivElement | null>(null);
  const kategoriRef = useRef<HTMLDivElement | null>(null);
  const jamRef = useRef<HTMLDivElement | null>(null);
  const bayarRef = useRef<HTMLDivElement | null>(null);
  const konversiRef = useRef<HTMLDivElement | null>(null);
  const instans = useRef<Record<string, any>>({});

  // Ukur wadah → tentukan skala huruf.
  useEffect(() => {
    if (!penuh) {
      setSkala(1);
      return;
    }
    const el = akarRef.current;
    if (!el) return;
    const hitung = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const s = Math.min(r.width / 1500, r.height / 840);
      setSkala(Math.min(2.2, Math.max(0.95, Number(s.toFixed(3)))));
    };
    hitung();
    const ro = new ResizeObserver(hitung);
    ro.observe(el);
    return () => ro.disconnect();
  }, [penuh]);

  // Gambar & perbarui grafik (ikut mode chip).
  useEffect(() => {
    let batal = false;
    let pengamat: ResizeObserver | null = null;

    void loadEcharts().then((ec) => {
      if (batal) return;

      const ambil = (kunci: string, el: HTMLDivElement | null) => {
        if (!el) return null;
        const lama = instans.current[kunci];
        if (lama && !lama.isDisposed?.()) return lama;
        const c = ec.init(el);
        instans.current[kunci] = c;
        return c;
      };

      ambil('area', areaRef.current)?.setOption(opsiArea(skala, modeArea), true);
      ambil('batang', batangRef.current)?.setOption(opsiBatang(skala, modeBatang), true);
      ambil('donat', donatRef.current)?.setOption(opsiDonat(skala, modeDonat), true);
      ambil('kategori', kategoriRef.current)?.setOption(opsiKategori(skala, modeKategori), true);
      ambil('jam', jamRef.current)?.setOption(opsiJam(skala, modeJam), true);
      ambil('bayar', bayarRef.current)?.setOption(opsiBayar(skala, modeBayar), true);
      ambil('konversi', konversiRef.current)?.setOption(opsiKonversi(skala, modeKonversi), true);

      pengamat = new ResizeObserver(() => {
        Object.values(instans.current).forEach((c: any) => c?.resize?.());
      });
      [areaRef, batangRef, donatRef, kategoriRef, jamRef, bayarRef, konversiRef].forEach(
        (r) => r.current && pengamat?.observe(r.current),
      );
    });

    return () => {
      batal = true;
      pengamat?.disconnect();
    };
  }, [skala, modeArea, modeBatang, modeDonat, modeKategori, modeJam, modeBayar, modeKonversi]);

  useEffect(
    () => () => {
      Object.values(instans.current).forEach((c: any) => c?.dispose?.());
      instans.current = {};
    },
    [],
  );

  // Pesan singkat (mis. "ID disalin") hilang sendiri.
  useEffect(() => {
    if (!pesan) return;
    const t = setTimeout(() => setPesan(null), 1800);
    return () => clearTimeout(t);
  }, [pesan]);

  const kartu = (tambahan = '') =>
    `rounded-[0.85em] p-[0.85em] h-full flex flex-col min-h-0 ${tambahan}`;

  const gayaKartu = { backgroundColor: WARNA.kartu, border: `1px solid ${WARNA.garis}` };

  /** Kepala kartu: judul di kiri, aksi (chip/tombol) di kanan. */
  const Kepala: React.FC<{ judul: string; aksi?: React.ReactNode }> = ({ judul, aksi }) => (
    <div className="flex items-center justify-between gap-[0.6em] shrink-0 mb-[0.5em]">
      <h3 className="text-[0.9em] font-semibold leading-tight truncate min-w-0" style={{ color: WARNA.teks }}>
        {judul}
      </h3>
      {aksi}
    </div>
  );

  /** Chip berfungsi: membuka menu pilihan dan mengganti data. */
  const Pilih: React.FC<{ nilai: string; opsi: string[]; onPilih: (v: string) => void }> = ({ nilai, opsi, onPilih }) => {
    const [buka, setBuka] = useState(false);
    const ref = useRef<HTMLSpanElement | null>(null);

    useEffect(() => {
      if (!buka) return;
      const tutup = (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) setBuka(false);
      };
      document.addEventListener('mousedown', tutup);
      return () => document.removeEventListener('mousedown', tutup);
    }, [buka]);

    return (
      <span ref={ref} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setBuka((v) => !v)}
          className="inline-flex items-center gap-[0.25em] rounded-[0.4em] px-[0.45em] py-[0.2em] text-[0.68em] font-medium transition-colors"
          style={{ backgroundColor: WARNA.kartu2, border: `1px solid ${buka ? WARNA.biru : WARNA.garis}`, color: WARNA.teks2 }}
        >
          {nilai}
          <ChevronDown className={`w-[0.9em] h-[0.9em] transition-transform ${buka ? 'rotate-180' : ''}`} />
        </button>
        {buka && (
          <div
            className="absolute right-0 top-[calc(100%+0.3em)] z-30 rounded-[0.45em] overflow-hidden py-[0.2em] min-w-[6em]"
            style={{ backgroundColor: WARNA.kartu2, border: `1px solid ${WARNA.garis}`, boxShadow: '0 10px 24px rgba(0,0,0,0.55)' }}
          >
            {opsi.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => {
                  onPilih(o);
                  setBuka(false);
                }}
                className="w-full text-left px-[0.6em] py-[0.3em] text-[0.68em] hover:bg-white/5"
                style={{ color: o === nilai ? WARNA.biruMuda : WARNA.teks2, fontWeight: o === nilai ? 700 : 400 }}
              >
                {o}
              </button>
            ))}
          </div>
        )}
      </span>
    );
  };

  const Tautan: React.FC<{ teks: string; onClick?: () => void }> = ({ teks, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className="text-[0.68em] font-semibold shrink-0 whitespace-nowrap transition-opacity hover:opacity-70"
      style={{ color: WARNA.biruMuda }}
    >
      {teks}
    </button>
  );

  /** Tinggi bidang grafik: memanjang di presentasi, tetap di galeri. */
  const bidang = (tinggiGaleri: string) => (penuh ? 'w-full flex-1 min-h-[6.5em]' : `w-full ${tinggiGaleri}`);

  /** Daftar yang bisa digulir di dalam kartu saat "Lihat semua" dibuka. */
  const daftar = penuh ? 'flex-1 min-h-0 overflow-y-auto gulir-tema pr-[0.2em]' : '';

  const dataArea = AREA_DATA[modeArea];
  const dataDonat = DONAT_DATA[modeDonat];
  const pesananTampil = semuaPesanan ? pesanan : pesanan.slice(0, 5);
  const dataBayar = PEMBAYARAN[modeBayar] ?? PEMBAYARAN['Bulan Ini'];
  const totalBayar = dataBayar.reduce((a, b) => a + b.nilai, 0);

  return (
    <div
      ref={akarRef}
      className={
        penuh
          ? 'h-full w-full flex flex-col gap-[0.7em] p-[0.8em] overflow-hidden'
          : 'rounded-[1.1em] p-[1em] flex flex-col gap-[0.7em]'
      }
      style={{ backgroundColor: WARNA.latar, color: WARNA.teks, fontSize: `${(13 * skala).toFixed(2)}px` }}
    >
      {/* ===== Baris 1: 4 kartu KPI ===== */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-[0.7em] ${penuh ? 'baris-062' : ''}`}>
        {KPI.map((k) => {
          const jalur = jalurSpark(k.seri);
          const idGrad = `grad-${k.label.replace(/\s+/g, '-')}`;
          return (
            <div key={k.label} className={kartu('gap-[0.35em]')} style={gayaKartu}>
              <div className="flex items-start justify-between gap-[0.5em]">
                <span className="text-[0.76em] font-medium leading-tight" style={{ color: WARNA.teks3 }}>
                  {k.label}
                </span>
                <span
                  className="shrink-0 inline-flex items-center justify-center w-[1.75em] h-[1.75em] rounded-[0.45em]"
                  style={{ backgroundColor: `${k.warna}22`, color: k.warna }}
                >
                  <k.Ikon className="w-[1em] h-[1em]" />
                </span>
              </div>

              <span className="text-[1.5em] font-bold leading-none tabular-nums tracking-tight">{k.nilai}</span>

              <div className="flex items-center gap-[0.35em] text-[0.72em] font-semibold">
                <span style={{ color: WARNA.hijau }}>{k.delta}</span>
                <span className="font-normal truncate" style={{ color: WARNA.teks3 }}>
                  {k.deltaTeks}
                </span>
              </div>

              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className={penuh ? 'w-full flex-1 min-h-[1.6em] mt-[0.1em]' : 'w-full h-[2.4em] mt-[0.15em]'}
              >
                <defs>
                  <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={k.warna} stopOpacity="0.38" />
                    <stop offset="100%" stopColor={k.warna} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={jalur.area} fill={`url(#${idGrad})`} />
                <path d={jalur.garis} fill="none" stroke={k.warna} strokeWidth="2.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
          );
        })}
      </div>

      {/* ===== Baris 2: pendapatan · pesanan per status · sumber kunjungan ===== */}
      <div className={`grid grid-cols-1 lg:grid-cols-[2.05fr_1fr_1.05fr] gap-[0.7em] ${penuh ? 'baris-118' : ''}`}>
        {/* Ikhtisar Pendapatan */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala judul="Ikhtisar Pendapatan" aksi={<Pilih nilai={modeArea} opsi={['Harian', 'Mingguan']} onPilih={(v) => setModeArea(v as 'Harian' | 'Mingguan')} />} />
          <div className="flex items-end justify-between gap-[0.6em] shrink-0">
            <div>
              <div className="text-[1.15em] font-bold leading-none tabular-nums">{dataArea.total}</div>
              <div className="text-[0.68em] mt-[0.25em]" style={{ color: WARNA.teks3 }}>
                {dataArea.judul}
              </div>
            </div>
            <span className="text-[0.7em] font-semibold" style={{ color: WARNA.hijau }}>
              +18,2% vs periode lalu
            </span>
          </div>
          <div ref={areaRef} className={bidang('h-[10.5em]')} />
        </div>

        {/* Pesanan per Status */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala judul="Pesanan per Status" aksi={<Pilih nilai={modeBatang} opsi={['Bulan Ini', 'Bulan Lalu']} onPilih={(v) => setModeBatang(v as 'Bulan Ini' | 'Bulan Lalu')} />} />
          <div ref={batangRef} className={bidang('h-[10.5em]')} />
        </div>

        {/* Sumber Kunjungan */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala judul="Sumber Kunjungan" aksi={<Pilih nilai={modeDonat} opsi={['Bulan Ini', 'Bulan Lalu']} onPilih={(v) => setModeDonat(v as 'Bulan Ini' | 'Bulan Lalu')} />} />
          <div className="flex-1 min-h-0 grid grid-cols-[minmax(5.2em,1fr)_minmax(6.2em,1.05fr)] gap-[0.5em] items-center">
            <div className="relative w-full h-full min-h-[6.5em]">
              <div ref={donatRef} className="absolute inset-0" />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[1.02em] font-bold leading-none tabular-nums">{dataDonat.total}</span>
                <span className="text-[0.6em] mt-[0.2em]" style={{ color: WARNA.teks3 }}>
                  Total Kunjungan
                </span>
              </div>
            </div>
            <ul className="flex flex-col gap-[0.32em] min-w-0">
              {SUMBER_NAMA.map((nama, i) => (
                <li key={nama} className="flex items-center gap-[0.35em] text-[0.68em] min-w-0">
                  <span className="w-[0.55em] h-[0.55em] rounded-full shrink-0" style={{ backgroundColor: WARNA_SUMBER[i] }} />
                  <span className="truncate" style={{ color: WARNA.teks2 }}>
                    {nama}
                  </span>
                  <span className="ml-auto tabular-nums font-semibold shrink-0" style={{ color: WARNA.teks }}>
                    {String(dataDonat.nilai[i]).replace('.', ',')}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ===== Baris 3: pesanan terbaru · kategori & jadwal · aktivitas & tugas ===== */}
      <div className={`grid grid-cols-1 lg:grid-cols-[1.95fr_1fr_1fr] gap-[0.7em] ${penuh ? 'baris-150' : ''}`}>
        {/* Pesanan Terbaru */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala
            judul="Pesanan Terbaru"
            aksi={<Tautan teks={semuaPesanan ? 'Ringkas' : 'Lihat semua'} onClick={() => setSemuaPesanan((v) => !v)} />}
          />
          <div className="flex-1 min-h-0 flex flex-col">
            <div
              className="grid grid-cols-[1.05fr_1.45fr_0.95fr_0.95fr_0.85fr_0.25fr] gap-[0.4em] pb-[0.35em] mb-[0.2em] text-[0.64em] font-semibold shrink-0 overflow-hidden"
              style={{ color: WARNA.teks3, borderBottom: `1px solid ${WARNA.garis}` }}
            >
              <span>ID Pesanan</span>
              <span>Pelanggan</span>
              <span>Tanggal</span>
              <span className="text-right">Jumlah</span>
              <span>Status</span>
              <span />
            </div>
            <div className={`flex-1 min-h-0 flex flex-col ${daftar}`}>
              {pesananTampil.map((p, i) => (
                <div
                  key={`${p.id}-${i}`}
                  className="grid grid-cols-[1.05fr_1.45fr_0.95fr_0.95fr_0.85fr_0.25fr] gap-[0.4em] items-center text-[0.68em] flex-1 min-h-[1.9em] overflow-hidden"
                  style={{ borderBottom: `1px solid rgba(255,255,255,0.045)` }}
                >
                  <span className="tabular-nums truncate" style={{ color: WARNA.teks2 }}>
                    {p.id}
                  </span>
                  <span className="flex items-center gap-[0.35em] min-w-0">
                    <span
                      className="w-[1.35em] h-[1.35em] rounded-full inline-flex items-center justify-center text-[0.62em] font-bold shrink-0"
                      style={{ backgroundColor: `${p.warna}26`, color: p.warna }}
                    >
                      {p.inisial}
                    </span>
                    <span className="truncate font-medium">{p.nama}</span>
                  </span>
                  <span className="truncate" style={{ color: WARNA.teks3 }}>
                    {p.tanggal}
                  </span>
                  <span className="text-right tabular-nums font-semibold">{p.jumlah}</span>
                  <span>
                    <span
                      className="inline-flex items-center rounded-full px-[0.5em] py-[0.12em] text-[0.9em] font-semibold"
                      style={{ backgroundColor: `${p.warna}22`, color: p.warna }}
                    >
                      {p.status}
                    </span>
                  </span>
                  <span className="relative flex justify-end">
                    <button
                      type="button"
                      onClick={() => setMenuBaris((v) => (v === p.id ? null : p.id))}
                      className="inline-flex items-center justify-center w-[1.2em] h-[1.2em] rounded hover:bg-white/10"
                      aria-label={`Aksi untuk ${p.id}`}
                    >
                      <MoreVertical className="w-[0.95em] h-[0.95em]" style={{ color: WARNA.teks3 }} />
                    </button>
                    {menuBaris === p.id && (
                      <span
                        className="absolute right-0 top-[1.4em] z-30 rounded-[0.4em] overflow-hidden py-[0.15em] min-w-[7.2em] text-left"
                        style={{ backgroundColor: WARNA.kartu2, border: `1px solid ${WARNA.garis}`, boxShadow: '0 10px 24px rgba(0,0,0,0.6)' }}
                      >
                        <button
                          type="button"
                          className="block w-full text-left px-[0.6em] py-[0.28em] text-[0.66em] hover:bg-white/5"
                          style={{ color: WARNA.teks2 }}
                          onClick={() => {
                            void navigator.clipboard?.writeText(p.id);
                            setPesan(`ID ${p.id} disalin`);
                            setMenuBaris(null);
                          }}
                        >
                          Salin ID
                        </button>
                        <button
                          type="button"
                          className="block w-full text-left px-[0.6em] py-[0.28em] text-[0.66em] hover:bg-white/5"
                          style={{ color: WARNA.teks2 }}
                          onClick={() => {
                            setPesanan((lama) => lama.map((x) => (x.id === p.id ? { ...x, status: 'Selesai', warna: WARNA.hijau } : x)));
                            setPesan(`${p.id} ditandai selesai`);
                            setMenuBaris(null);
                          }}
                        >
                          Tandai selesai
                        </button>
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Kolom tengah: nilai per kategori + pesanan per jam */}
        <div className="flex flex-col gap-[0.7em] min-h-0">
          <div className={`${kartu()} ${penuh ? 'baris-100' : ''}`} style={gayaKartu}>
            <Kepala
              judul="Nilai Pesanan per Kategori"
              aksi={
                <Pilih
                  nilai={modeKategori}
                  opsi={['Nilai', 'Unit']}
                  onPilih={(v) => setModeKategori(v as 'Nilai' | 'Unit')}
                />
              }
            />
            <div ref={kategoriRef} className={bidang('h-[9.6em]')} />
          </div>

          <div className={`${kartu()} ${penuh ? 'baris-130' : ''}`} style={gayaKartu}>
            <Kepala
              judul="Pesanan per Jam"
              aksi={
                <Pilih
                  nilai={modeJam}
                  opsi={['Hari ini', 'Rata-rata']}
                  onPilih={(v) => setModeJam(v as 'Hari ini' | 'Rata-rata')}
                />
              }
            />
            <div ref={jamRef} className={bidang('h-[8.6em]')} />
          </div>
        </div>

        {/* Kolom kanan: metode pembayaran + tren konversi */}
        <div className="flex flex-col gap-[0.7em] min-h-0">
          <div className={`${kartu()} ${penuh ? 'baris-115' : ''}`} style={gayaKartu}>
            <Kepala
              judul="Metode Pembayaran"
              aksi={
                <Pilih
                  nilai={modeBayar}
                  opsi={['Bulan Ini', 'Bulan Lalu']}
                  onPilih={(v) => setModeBayar(v as 'Bulan Ini' | 'Bulan Lalu')}
                />
              }
            />
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="relative w-full flex-1 min-h-[5em]">
                <div ref={bayarRef} className="absolute inset-0" />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[1.05em] font-bold leading-none tabular-nums">
                    {totalBayar.toLocaleString('id-ID')}
                  </span>
                  <span className="text-[0.58em] mt-[0.15em]" style={{ color: WARNA.teks3 }}>
                    pesanan
                  </span>
                </div>
              </div>
              <ul className="w-full shrink-0 flex flex-col gap-[0.16em] mt-[0.25em]">
                {dataBayar.map((d) => (
                  <li key={d.nama} className="flex items-center gap-[0.3em] text-[0.62em] min-w-0">
                    <span className="w-[0.45em] h-[0.45em] rounded-full shrink-0" style={{ backgroundColor: d.warna }} />
                    <span className="truncate" style={{ color: WARNA.teks2 }}>
                      {d.nama}
                    </span>
                    <span className="ml-auto tabular-nums shrink-0" style={{ color: WARNA.teks3 }}>
                      {Math.round((d.nilai / totalBayar) * 1000) / 10}%
                    </span>
                    <span className="tabular-nums font-semibold shrink-0 w-[2.2em] text-right">{d.nilai}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={`${kartu()} ${penuh ? 'baris-100' : ''}`} style={gayaKartu}>
            <Kepala
              judul="Tren Konversi"
              aksi={
                <Pilih
                  nilai={modeKonversi}
                  opsi={['Harian', 'Mingguan']}
                  onPilih={(v) => setModeKonversi(v as 'Harian' | 'Mingguan')}
                />
              }
            />
            <div ref={konversiRef} className={bidang('h-[8.6em]')} />
          </div>
        </div>
      </div>

      {/* Pesan singkat aksi tabel */}
      {pesan && (
        <div
          className="fixed bottom-[1.2em] left-1/2 -translate-x-1/2 z-[70] rounded-[0.5em] px-[0.9em] py-[0.45em] text-[0.72em] font-medium shadow-lg"
          style={{ backgroundColor: WARNA.kartu2, border: `1px solid ${WARNA.garis}`, color: WARNA.teks }}
        >
          {pesan}
        </div>
      )}
    </div>
  );
};
