import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronDown } from 'lucide-react';
import { loadEcharts } from '../widgets/echartsSetup';

/**
 * DASHBOARD TRAFIK WEB — template ketiga.
 *
 * Referensi: papan analitik web bertema gelap — 5 kartu KPI bersparkline,
 * grafik batang sumber trafik 31 hari dengan legenda di samping, garis
 * dinamika relevansi, komposisi usia, daftar halaman populer, jenis
 * perangkat, faktor perilaku, sistem operasi, dan frasa pencarian.
 *
 * INTERAKSI
 * - Chip "30 hari / 7 hari" mengganti rentang grafik batang & garis.
 * - "Lihat semua" membuka daftar penuh (dapat digulir di dalam kartu).
 *
 * Catatan: SELURUH ANGKA DI SINI CONTOH (dummy), bukan dari dokumen instansi.
 */

const WARNA = {
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

const N_HARI = 31;
const SEMUA_TANGGAL = Array.from({ length: N_HARI }, (_, i) => `${String(i + 1).padStart(2, '0')}.01`);

/** Kurva lonceng: trafik naik ke tengah bulan lalu menurun. */
const lonceng = (i: number, puncak = 15, lebar = 6.5) => Math.exp(-((i - puncak) ** 2) / (2 * lebar * lebar));

const SERI_TRAFIK = [
  { nama: 'Mesin Pencari', warna: WARNA.biru, data: Array.from({ length: N_HARI }, (_, i) => Math.round(49 * lonceng(i) + 3)) },
  { nama: 'Iklan', warna: WARNA.kuning, data: Array.from({ length: N_HARI }, (_, i) => Math.round(4.4 * lonceng(i) + 1)) },
  { nama: 'Media Sosial', warna: WARNA.merah, data: Array.from({ length: N_HARI }, (_, i) => Math.round(4.4 * lonceng(i) + 1)) },
  { nama: 'Akses Langsung', warna: WARNA.oranye, data: Array.from({ length: N_HARI }, (_, i) => Math.round(0.6 * lonceng(i))) },
];

const RELEVANSI = Array.from({ length: N_HARI }, (_, i) => {
  const dasar = 46 + 16 * lonceng(i, 14, 7);
  const acak = [0, 6, -4, 8, -3, 5, -7, 4, 9, -5, 3, 7, -6, 5, -2, 8, -4, 6, -8, 3, 7, -3, 5, -6, 4, 8, -5, 2, 6, -4, 3][i];
  return Math.max(20, Math.round(dasar + acak));
});

interface Kpi {
  label: string;
  nilai: string;
  delta: string;
  naik: boolean;
  bagus: boolean;
  seri: number[];
}

const KPI: Kpi[] = [
  { label: 'Rasio Pentalan', nilai: '57%', delta: '1%', naik: true, bagus: false, seri: [52, 54, 53, 56, 55, 58, 57, 59, 56, 57] },
  { label: 'Kedalaman Halaman', nilai: '1,45', delta: '0,05', naik: true, bagus: true, seri: [1.2, 1.25, 1.3, 1.28, 1.35, 1.4, 1.38, 1.42, 1.44, 1.45] },
  { label: 'Waktu di Situs', nilai: '4,9 mnt', delta: '1 mnt', naik: true, bagus: true, seri: [3.6, 3.9, 3.8, 4.1, 4.3, 4.2, 4.5, 4.6, 4.8, 4.9] },
  { label: 'Pengunjung', nilai: '1.120', delta: '11', naik: true, bagus: true, seri: [980, 1010, 990, 1040, 1060, 1050, 1080, 1090, 1110, 1120] },
  { label: 'Pengunjung Baru', nilai: '340', delta: '24', naik: false, bagus: false, seri: [380, 372, 366, 360, 356, 350, 348, 344, 342, 340] },
];

/** Usia pengunjung — total 2.320 kunjungan. */
const USIA = [
  { label: '25 – 34', penuh: '25 – 34 tahun', persen: 51.3, jumlah: 1190, warna: WARNA.biru },
  { label: '35 – 44', penuh: '35 – 44 tahun', persen: 24.7, jumlah: 573, warna: WARNA.kuning },
  { label: '18 – 24', penuh: '18 – 24 tahun', persen: 10.0, jumlah: 232, warna: WARNA.biruMuda },
  { label: '45 – 54', penuh: '45 – 54 tahun', persen: 9.0, jumlah: 209, warna: WARNA.ungu },
  { label: '55 +', penuh: '55 tahun ke atas', persen: 4.0, jumlah: 93, warna: WARNA.merah },
  { label: 'Tak tentu', penuh: 'Tak diketahui', persen: 1.0, jumlah: 23, warna: WARNA.abu },
];

const HALAMAN = [
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

const PERANGKAT = [
  { nama: 'PC', persen: 69.7, jumlah: 1617, warna: WARNA.biru },
  { nama: 'Ponsel', persen: 29.0, jumlah: 673, warna: WARNA.kuning },
  { nama: 'Tablet', persen: 1.3, jumlah: 30, warna: WARNA.merah },
];

const PERILAKU = [
  { nama: 'VK', persen: 75, jumlah: 75, warna: WARNA.biru },
  { nama: 'Facebook', persen: 15, jumlah: 15, warna: WARNA.kuning },
  { nama: 'Pinterest', persen: 10, jumlah: 10, warna: WARNA.merah },
];

const OS = [
  { nama: 'Windows', persen: 40, delta: 0, warna: WARNA.biru },
  { nama: 'Google Android', persen: 31, delta: 2, warna: WARNA.kuning },
  { nama: 'Mac OS', persen: 17, delta: 1, warna: WARNA.ungu },
  { nama: 'iOS', persen: 9, delta: -4, warna: WARNA.merah },
  { nama: 'Linux', persen: 3, delta: 1, warna: WARNA.abu },
];

const FRASA = [
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

/** Sparkline halus (Catmull-Rom → bezier). */
const jalurSpark = (seri: number[]) => {
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

const tooltipDasar = (s: number) => ({
  backgroundColor: 'rgba(20,24,32,0.97)',
  borderColor: 'rgba(120,150,200,0.26)',
  borderWidth: 1,
  padding: [7 * s, 11 * s],
  extraCssText: `border-radius:${8 * s}px; box-shadow:0 ${6 * s}px ${18 * s}px rgba(0,0,0,0.5); backdrop-filter:blur(6px);`,
  textStyle: { color: WARNA.teks, fontSize: 11 * s },
});

const gradasi = (warna: string, arah: 'x' | 'y' = 'x') => ({
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

const opsiTrafik = (s: number, rentang: number) => {
  const mulai = N_HARI - rentang;
  const kategori = SEMUA_TANGGAL.slice(mulai);
  return {
    animationDuration: 700,
    animationEasing: 'cubicOut' as const,
    grid: { left: 2, right: 6, top: 14 * s, bottom: 2, containLabel: true },
    tooltip: {
      ...tooltipDasar(s),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(255,255,255,0.04)' } },
      formatter: (p: any[]) =>
        `<div style="color:${WARNA.teks3};margin-bottom:${3 * s}px">${p[0]?.name} 2023</div>` +
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
      max: 80,
      interval: 20,
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.11)', type: 'dashed' } },
      axisLabel: { color: '#a3adbd', fontSize: 9 * s },
    },
    series: SERI_TRAFIK.map((seri, idx) => ({
      name: seri.nama,
      type: 'bar',
      stack: 'total',
      barWidth: '58%',
      data: seri.data.slice(mulai),
      itemStyle: {
        color: seri.warna,
        borderRadius: idx === SERI_TRAFIK.length - 1 ? [3 * s, 3 * s, 0, 0] : 0,
      },
      emphasis: { focus: 'series', itemStyle: { shadowBlur: 10 * s, shadowColor: `${seri.warna}aa` } },
      ...(idx === 0 ? { showBackground: true, backgroundStyle: { color: 'rgba(255,255,255,0.03)' } } : {}),
    })),
  };
};

const opsiRelevansi = (s: number, rentang: number) => {
  const mulai = N_HARI - rentang;
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
      data: SEMUA_TANGGAL.slice(mulai),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: WARNA.teks3,
        fontSize: 8.4 * s,
        interval: (i: number) => i === 0 || i === rentang - 1,
      },
    },
    yAxis: { type: 'value', show: false, max: 80 },
    series: [
      {
        type: 'line',
        smooth: 0.4,
        symbol: 'circle',
        symbolSize: 5 * s,
        showSymbol: false,
        data: RELEVANSI.slice(mulai),
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
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: 'rgba(255,255,255,0.28)', type: 'dashed', width: 1 },
          label: {
            formatter: (p: any) => `rata ${Math.round(p.value)}`,
            color: WARNA.teks3,
            fontSize: 8.4 * s,
            position: 'insideStartTop',
          },
          data: [
            {
              yAxis: Math.round(
                RELEVANSI.slice(N_HARI - rentang).reduce((a, b) => a + b, 0) / rentang,
              ),
            },
          ],
        },
      },
    ],
  };
};

/** Usia: batang mendatar berperingkat (bukan sekadar daftar). */
const opsiUsia = (s: number) => {
  const urut = [...USIA].reverse();
  const maks = Math.max(...USIA.map((u) => u.persen));
  const batas = Math.ceil(maks * 1.18);
  return {
    animationDuration: 750,
    animationEasing: 'cubicOut' as const,
    grid: { left: 2, right: 62 * s, top: 2, bottom: 2, containLabel: true },
    tooltip: {
      ...tooltipDasar(s),
      trigger: 'item',
      formatter: (p: any) =>
        `${p.marker} ${p.name}<br/><b>${String(p.value).replace('.', ',')}%</b> · ${p.data.jumlah.toLocaleString('id-ID')} kunjungan`,
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
          formatter: (p: any) => `${String(p.value).replace('.', ',')}%`,
        },
        emphasis: { itemStyle: { shadowBlur: 12 * s, shadowColor: 'rgba(255,255,255,0.22)' } },
      },
    ],
  };
};

/** Jenis perangkat: batang tegak dengan label jumlah. */
const opsiPerangkat = (s: number) => {
  const maks = Math.max(...PERANGKAT.map((p) => p.jumlah));
  return {
    animationDuration: 750,
    animationEasing: 'cubicOut' as const,
    grid: { left: 2, right: 2, top: 20 * s, bottom: 2, containLabel: true },
    tooltip: {
      ...tooltipDasar(s),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(255,255,255,0.05)' } },
      formatter: (p: any[]) =>
        `<div style="color:${WARNA.teks3}">${p[0]?.name}</div><b>${Number(p[0]?.value).toLocaleString('id-ID')} kunjungan</b> · ${p[0]?.data.persen}%`,
    },
    xAxis: {
      type: 'category',
      data: PERANGKAT.map((p) => p.nama),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: WARNA.teks2, fontSize: 9.2 * s, margin: 5 * s },
    },
    yAxis: { type: 'value', show: false, max: maks * 1.18 },
    series: [
      {
        type: 'bar',
        barWidth: '46%',
        data: PERANGKAT.map((p) => ({
          value: p.jumlah,
          persen: p.persen,
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
          formatter: (p: any) => Number(p.value).toLocaleString('id-ID'),
        },
        emphasis: { itemStyle: { shadowBlur: 14 * s, shadowColor: 'rgba(255,255,255,0.25)' } },
      },
    ],
  };
};

/** Faktor perilaku: cincin (gaya donat yang sudah dipakai di template). */
const opsiPerilaku = (s: number) => ({
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
      data: PERILAKU.map((p) => ({ name: p.nama, value: p.persen, itemStyle: { color: p.warna } })),
    },
  ],
});

/** Sistem operasi: area bertumpuk 30 hari (gaya area yang sudah dipakai di template). */
const opsiOS = (s: number) => {
  const hari = Array.from({ length: 30 }, (_, i) => `${i + 1}`);
  const dasar = OS.map((o) => o.persen);
  const arah = [0, 2.4, 0.6, -2.6, 0.6];
  const mentah = hari.map((_, i) =>
    dasar.map((b, j) => Math.max(1, (b + (arah[j] * i) / 29) * (1 + 0.05 * Math.sin((i + j * 3) / 3.6)))),
  );
  const deret = dasar.map((_, j) =>
    mentah.map((baris) => {
      const total = baris.reduce((a, b) => a + b, 0);
      return Math.round((baris[j] / total) * 1000) / 10;
    }),
  );
  return {
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
    grid: { left: 0, right: 2, top: 6, bottom: 16 * s, containLabel: true },
    tooltip: {
      ...tooltipDasar(s),
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: 'rgba(255,255,255,0.28)', type: 'dashed' } },
      formatter: (ps: any[]) => {
        const isi = [...ps].reverse().map((p) => `${p.marker} ${p.seriesName} <b>${String(p.value).replace('.', ',')}%</b>`);
        return `Hari ${ps[0].axisValue}<br/>${isi.join('<br/>')}`;
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: hari,
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisTick: { show: false },
      axisLabel: { color: WARNA.teks3, fontSize: 8.4 * s, interval: 5, margin: 5 * s },
    },
    yAxis: {
      type: 'value',
      max: 100,
      show: false,
      splitLine: { show: false },
    },
    series: OS.map((o, j) => ({
      name: o.nama,
      type: 'line',
      stack: 'os',
      smooth: 0.35,
      symbol: 'none',
      lineStyle: { width: 1.2 * s, color: o.warna },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: `${o.warna}88` },
            { offset: 1, color: `${o.warna}33` },
          ],
        },
      },
      emphasis: { focus: 'series' },
      data: deret[j],
    })),
  };
};

interface DashboardTrafikProps {
  /** true = isi seluruh tinggi wadah (mode presentasi / layar penuh). */
  penuh?: boolean;
}

export const DashboardTrafik: React.FC<DashboardTrafikProps> = ({ penuh = false }) => {
  const [skala, setSkala] = useState(1);
  const [rentang, setRentang] = useState<30 | 7>(30);
  const [semuaHalaman, setSemuaHalaman] = useState(false);
  const [semuaFrasa, setSemuaFrasa] = useState(false);
  const [menuRentang, setMenuRentang] = useState(false);

  const akarRef = useRef<HTMLDivElement | null>(null);
  const trafikRef = useRef<HTMLDivElement | null>(null);
  const relevansiRef = useRef<HTMLDivElement | null>(null);
  const usiaRef = useRef<HTMLDivElement | null>(null);
  const perangkatRef = useRef<HTMLDivElement | null>(null);
  const perilakuRef = useRef<HTMLDivElement | null>(null);
  const osRef = useRef<HTMLDivElement | null>(null);
  const instans = useRef<Record<string, any>>({});
  const menuRef = useRef<HTMLSpanElement | null>(null);

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

      ambil('trafik', trafikRef.current)?.setOption(opsiTrafik(skala, rentang), true);
      ambil('relevansi', relevansiRef.current)?.setOption(opsiRelevansi(skala, rentang), true);
      ambil('usia', usiaRef.current)?.setOption(opsiUsia(skala), true);
      ambil('perangkat', perangkatRef.current)?.setOption(opsiPerangkat(skala), true);
      ambil('perilaku', perilakuRef.current)?.setOption(opsiPerilaku(skala), true);
      ambil('os', osRef.current)?.setOption(opsiOS(skala), true);

      pengamat = new ResizeObserver(() => {
        Object.values(instans.current).forEach((c: any) => c?.resize?.());
      });
      [trafikRef, relevansiRef, usiaRef, perangkatRef, perilakuRef, osRef].forEach(
        (r) => r.current && pengamat?.observe(r.current),
      );
    });

    return () => {
      batal = true;
      pengamat?.disconnect();
    };
  }, [skala, rentang]);

  useEffect(
    () => () => {
      Object.values(instans.current).forEach((c: any) => c?.dispose?.());
      instans.current = {};
    },
    [],
  );

  // Tutup menu rentang bila klik di luar.
  useEffect(() => {
    if (!menuRentang) return;
    const tutup = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuRentang(false);
    };
    document.addEventListener('mousedown', tutup);
    return () => document.removeEventListener('mousedown', tutup);
  }, [menuRentang]);

  const kartu = (tambahan = '') =>
    `rounded-[0.9em] p-[0.8em] h-full flex flex-col min-h-0 transition-colors ${tambahan}`;
  const gayaKartu = {
    backgroundColor: WARNA.kartu,
    border: `1px solid ${WARNA.garis}`,
    boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px -18px rgba(0,0,0,0.9)',
  };

  const Kepala: React.FC<{ judul: string; aksi?: React.ReactNode; sub?: string; warna?: string }> = ({
    judul,
    aksi,
    sub,
    warna,
  }) => (
    <div className="flex items-start justify-between gap-[0.6em] shrink-0 mb-[0.45em]">
      <div className="min-w-0">
        <h3 className="text-[0.88em] font-semibold leading-tight flex items-center gap-[0.35em]" style={{ color: WARNA.teks }}>
          {warna && <span className="w-[0.4em] h-[0.4em] rounded-full shrink-0" style={{ backgroundColor: warna }} />}
          <span className="truncate">{judul}</span>
        </h3>
        {sub && (
          <p className="text-[0.62em] truncate mt-[0.12em]" style={{ color: WARNA.teks3 }}>
            {sub}
          </p>
        )}
      </div>
      {aksi}
    </div>
  );

  const Tautan: React.FC<{ teks: string; onClick?: () => void }> = ({ teks, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className="text-[0.66em] font-semibold shrink-0 whitespace-nowrap rounded-[0.35em] px-[0.35em] py-[0.1em] hover:bg-white/[0.06] transition-colors"
      style={{ color: WARNA.biruMuda }}
    >
      {teks}
    </button>
  );

  const bidang = (galeri: string) => (penuh ? 'w-full flex-1 min-h-[6em]' : `w-full ${galeri}`);
  const daftar = penuh ? 'flex-1 min-h-0 overflow-y-auto gulir-tema pr-[0.2em]' : '';

  const halamanTampil = semuaHalaman ? HALAMAN : HALAMAN.slice(0, 7);
  const frasaTampil = semuaFrasa ? FRASA : FRASA.slice(0, 8);
  const maksHalaman = Math.max(...HALAMAN.map((h) => h.persen));

  return (
    <div
      ref={akarRef}
      className={
        penuh
          ? 'h-full w-full flex flex-col gap-[0.65em] p-[0.75em] overflow-hidden'
          : 'rounded-[1.1em] p-[1em] flex flex-col gap-[0.65em]'
      }
      style={{ backgroundColor: WARNA.latar, color: WARNA.teks, fontSize: `${(13 * skala).toFixed(2)}px` }}
    >
      {/* ===== Baris 1: 5 KPI ===== */}
      <div className={`grid grid-cols-2 lg:grid-cols-5 gap-[0.6em] ${penuh ? 'baris-060' : ''}`}>
        {KPI.map((k) => {
          const jalur = jalurSpark(k.seri);
          const warnaDelta = k.bagus ? WARNA.hijau : WARNA.merah;
          const idGrad = `tg-${k.label.replace(/\s+/g, '-')}`;
          return (
            <div key={k.label} className={kartu('gap-[0.3em]')} style={gayaKartu}>
              <span className="text-[0.7em] font-medium leading-tight truncate" style={{ color: WARNA.teks3 }}>
                {k.label}
              </span>
              <div className="flex items-baseline gap-[0.35em] min-w-0">
                <span className="text-[1.35em] font-bold leading-none tabular-nums tracking-tight truncate">{k.nilai}</span>
                <span
                  className="inline-flex items-center gap-[0.1em] text-[0.66em] font-semibold shrink-0 rounded-full px-[0.3em] py-[0.05em]"
                  style={{ color: warnaDelta, backgroundColor: `${warnaDelta}1f` }}
                >
                  {k.naik ? <ArrowUpRight className="w-[0.95em] h-[0.95em]" /> : <ArrowDownRight className="w-[0.95em] h-[0.95em]" />}
                  {k.naik ? '+' : '−'}
                  {k.delta}
                </span>
              </div>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className={penuh ? 'w-full flex-1 min-h-[1.5em]' : 'w-full h-[2.2em]'}
              >
                <defs>
                  <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={warnaDelta} stopOpacity="0.34" />
                    <stop offset="100%" stopColor={warnaDelta} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={jalur.area} fill={`url(#${idGrad})`} />
                <path d={jalur.garis} fill="none" stroke={warnaDelta} strokeWidth="2.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
          );
        })}
      </div>

      {/* ===== Baris 2: sumber trafik · dinamika relevansi · usia ===== */}
      <div className={`grid grid-cols-1 lg:grid-cols-[2.1fr_1fr_1.1fr] gap-[0.65em] ${penuh ? 'baris-125' : ''}`}>
        {/* Sumber Trafik */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala
            judul="Sumber Trafik"
            sub="1–31 Januari 2023 · pengunjung per hari"
            warna={WARNA.biru}
            aksi={
              <span ref={menuRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setMenuRentang((v) => !v)}
                  className="inline-flex items-center gap-[0.25em] rounded-[0.4em] px-[0.45em] py-[0.2em] text-[0.66em] font-medium transition-colors hover:brightness-125"
                  style={{ backgroundColor: WARNA.kartu2, border: `1px solid ${menuRentang ? WARNA.biru : WARNA.garis}`, color: WARNA.teks2 }}
                >
                  {rentang === 30 ? '30 hari' : '7 hari'}
                  <ChevronDown className={`w-[0.85em] h-[0.85em] transition-transform ${menuRentang ? 'rotate-180' : ''}`} />
                </button>
                {menuRentang && (
                  <div
                    className="absolute right-0 top-[calc(100%+0.3em)] z-30 rounded-[0.45em] overflow-hidden py-[0.2em] min-w-[5.4em]"
                    style={{ backgroundColor: WARNA.kartu2, border: `1px solid ${WARNA.garis}`, boxShadow: '0 10px 24px rgba(0,0,0,0.55)' }}
                  >
                    {[30, 7].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setRentang(r as 30 | 7);
                          setMenuRentang(false);
                        }}
                        className="w-full text-left px-[0.6em] py-[0.28em] text-[0.66em] hover:bg-white/5"
                        style={{ color: rentang === r ? WARNA.biruMuda : WARNA.teks2, fontWeight: rentang === r ? 700 : 400 }}
                      >
                        {r} hari
                      </button>
                    ))}
                  </div>
                )}
              </span>
            }
          />
          <div className="flex-1 min-h-0 flex gap-[0.5em]">
            <div ref={trafikRef} className={penuh ? 'flex-1 min-w-0' : 'w-full h-[11em]'} />
            <ul className="flex flex-col justify-center gap-[0.3em] min-w-[6.4em] shrink-0">
              {SERI_TRAFIK.map((seri) => {
                const total = seri.data.slice(N_HARI - rentang).reduce((a, b) => a + b, 0);
                return (
                  <li key={seri.nama} className="flex items-center gap-[0.3em] text-[0.65em] min-w-0">
                    <span className="w-[0.5em] h-[0.5em] rounded-full shrink-0" style={{ backgroundColor: seri.warna }} />
                    <span className="truncate" style={{ color: WARNA.teks2 }}>
                      {seri.nama}
                    </span>
                    <span className="ml-auto tabular-nums font-semibold shrink-0" style={{ color: WARNA.teks }}>
                      {total}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Dinamika Relevansi */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala judul="Dinamika Relevansi" sub="Poin relevansi harian" warna={WARNA.cyan} />
          <div ref={relevansiRef} className={bidang('h-[9em]')} />
        </div>

        {/* Usia — batang berperingkat */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala
            judul="Usia"
            warna={WARNA.ungu}
            sub="Kunjungan per kelompok usia"
            aksi={
              <span
                className="inline-flex items-center gap-[0.08em] rounded-full px-[0.32em] py-[0.05em] text-[0.64em] font-semibold shrink-0"
                style={{ color: WARNA.merah, backgroundColor: `${WARNA.merah}1f` }}
              >
                <ArrowDownRight className="w-[0.85em] h-[0.85em]" />
                7%
              </span>
            }
          />
          <div className="flex items-baseline gap-[0.3em] shrink-0 mb-[0.3em]">
            <span className="text-[1.15em] font-bold leading-none tabular-nums">2.320</span>
            <span className="text-[0.65em]" style={{ color: WARNA.teks3 }}>
              kunjungan (sesi) · 6 kelompok
            </span>
          </div>
          <div className="flex h-[0.45em] rounded-full overflow-hidden shrink-0 mb-[0.45em] gap-[0.08em]">
            {USIA.map((u) => (
              <span key={u.label} style={{ width: `${u.persen}%`, backgroundColor: u.warna }} title={`${u.penuh} · ${u.persen}%`} />
            ))}
          </div>
          <div ref={usiaRef} className={bidang('h-[9em]')} />
        </div>
      </div>

      {/* ===== Baris 3: halaman · perangkat · perilaku · OS · frasa ===== */}
      <div className={`grid grid-cols-1 lg:grid-cols-[1.15fr_0.95fr_0.9fr_1fr_0.95fr] gap-[0.65em] ${penuh ? 'baris-145' : ''}`}>
        {/* Halaman Populer */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala
            judul="Halaman Populer"
            warna={WARNA.biruMuda}
            sub="Porsi kunjungan per halaman"
            aksi={<Tautan teks={semuaHalaman ? 'Ringkas' : 'Lihat semua'} onClick={() => setSemuaHalaman((v) => !v)} />}
          />
          <ul className={`flex-1 min-h-0 flex flex-col justify-between gap-[0.2em] ${daftar}`}>
            {halamanTampil.map((h) => (
              <li key={h.path} className="min-w-0 rounded-[0.3em] px-[0.2em] py-[0.1em] hover:bg-white/[0.04] transition-colors">
                <div className="flex items-center gap-[0.3em] text-[0.65em] min-w-0">
                  <span className="truncate" style={{ color: WARNA.teks2 }}>
                    {h.path}
                  </span>
                  <span className="ml-auto tabular-nums font-semibold shrink-0">{String(h.persen).replace('.', ',')}%</span>
                  <span
                    className="inline-flex items-center gap-[0.05em] shrink-0 text-[0.92em] font-semibold"
                    style={{ color: h.delta > 0 ? WARNA.hijau : h.delta < 0 ? WARNA.merah : WARNA.teks3 }}
                  >
                    {h.delta > 0 ? (
                      <ArrowUpRight className="w-[0.85em] h-[0.85em]" />
                    ) : h.delta < 0 ? (
                      <ArrowDownRight className="w-[0.85em] h-[0.85em]" />
                    ) : (
                      <span className="w-[0.85em] text-center">–</span>
                    )}
                    {Math.abs(h.delta)}%
                  </span>
                </div>
                <div className="h-[0.24em] rounded-full overflow-hidden mt-[0.12em]" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${Math.min(100, (h.persen / (maksHalaman * 1.06)) * 100)}%`,
                      background: `linear-gradient(90deg, ${WARNA.biru}66, ${WARNA.biruMuda})`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Jenis Perangkat — batang tegak */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala judul="Jenis Perangkat" warna={WARNA.kuning} sub="Kunjungan per perangkat" />
          <div className="flex items-baseline gap-[0.3em] shrink-0 mb-[0.1em]">
            <span className="text-[1em] font-bold leading-none tabular-nums">2.320</span>
            <span className="text-[0.6em]" style={{ color: WARNA.teks3 }}>
              kunjungan (sesi)
            </span>
          </div>
          <div ref={perangkatRef} className={bidang('h-[7.6em]')} />
          <ul className="shrink-0 flex flex-col gap-[0.14em] mt-[0.15em]">
            {PERANGKAT.map((p) => (
              <li key={p.nama} className="flex items-center gap-[0.3em] text-[0.63em] min-w-0">
                <span className="w-[0.45em] h-[0.45em] rounded-full shrink-0" style={{ backgroundColor: p.warna }} />
                <span className="truncate" style={{ color: WARNA.teks2 }}>
                  {p.nama}
                </span>
                <span className="ml-auto tabular-nums font-semibold shrink-0">{String(p.persen).replace('.', ',')}%</span>
                <span className="tabular-nums shrink-0 w-[2.5em] text-right" style={{ color: WARNA.teks3 }}>
                  {p.jumlah.toLocaleString('id-ID')}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Faktor Perilaku — komposisi 100% + rincian kanal */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala
            judul="Faktor Perilaku"
            warna={WARNA.hijau}
            sub="Porsi kanal · skor 100"
          />
          <div className="flex-1 min-h-0 flex gap-[0.6em]">
            <div className="relative h-full w-[46%] shrink-0">
              <div ref={perilakuRef} className="h-full w-full" />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[1.35em] font-bold leading-none tabular-nums">100</span>
                <span className="text-[0.55em] mt-[0.1em]" style={{ color: WARNA.teks3 }}>
                  skor
                </span>
              </div>
            </div>
            <ul className="flex-1 min-w-0 flex flex-col justify-center gap-[0.42em]">
              {PERILAKU.map((p) => (
                <li key={p.nama} className="min-w-0 flex items-center gap-[0.3em] text-[0.68em]">
                  <span className="w-[0.46em] h-[0.46em] rounded-[0.12em] shrink-0" style={{ backgroundColor: p.warna }} />
                  <span className="truncate" style={{ color: WARNA.teks2 }}>
                    {p.nama}
                  </span>
                  <span className="ml-auto tabular-nums font-semibold shrink-0">{p.persen}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Sistem Operasi — area bertumpuk + legenda chip */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala judul="Sistem Operasi" warna={WARNA.oranye} sub="Porsi kunjungan 30 hari" />
          <div ref={osRef} className="w-full flex-1 min-h-[6.4em]" />
          <ul className="shrink-0 flex flex-wrap items-center gap-x-[0.7em] gap-y-[0.15em] mt-[0.35em]">
            {OS.map((o) => (
              <li key={o.nama} className="flex items-center gap-[0.25em] text-[0.6em] min-w-0">
                <span className="w-[0.4em] h-[0.4em] rounded-full shrink-0" style={{ backgroundColor: o.warna }} />
                <span className="truncate" style={{ color: WARNA.teks2 }}>
                  {o.nama}
                </span>
                <span className="tabular-nums font-semibold shrink-0">{o.persen}%</span>
                {o.delta !== 0 && (
                  <span
                    className="tabular-nums shrink-0 font-semibold"
                    style={{ color: o.delta > 0 ? WARNA.hijau : WARNA.merah }}
                  >
                    {o.delta > 0 ? '▲' : '▼'}
                    {Math.abs(o.delta)}%
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Frasa Pencarian */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala
            judul="Frasa Pencarian"
            warna={WARNA.cyan}
            sub="Porsi pencarian"
            aksi={<Tautan teks={semuaFrasa ? 'Ringkas' : 'Lihat semua'} onClick={() => setSemuaFrasa((v) => !v)} />}
          />
          <ul className={`flex-1 min-h-0 flex flex-col justify-between gap-[0.24em] ${daftar}`}>
            {frasaTampil.map((f) => (
              <li key={f.teks} className="min-w-0 rounded-[0.3em] px-[0.2em] py-[0.08em] hover:bg-white/[0.04] transition-colors">
                <div className="flex items-center gap-[0.3em] text-[0.65em]">
                  <span className="truncate" style={{ color: WARNA.teks2 }}>
                    {f.teks}
                  </span>
                  <span className="ml-auto tabular-nums font-semibold shrink-0">{String(f.persen).replace('.', ',')}%</span>
                </div>
                <div className="h-[0.22em] rounded-full overflow-hidden mt-[0.1em]" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, f.persen * 2.4)}%`, background: `linear-gradient(90deg, ${WARNA.biru}, ${WARNA.cyan})` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
