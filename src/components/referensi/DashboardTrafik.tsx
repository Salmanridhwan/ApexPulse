import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronDown, Monitor } from 'lucide-react';
import { loadEcharts } from '../widgets/echartsSetup';

/**
 * DASHBOARD TRAFIK WEB — template ketiga (replika tampilan acuan ketiga).
 *
 * Referensi: panel analitik web bertema gelap — 5 kartu KPI bersparkline,
 * grafik batang sumber trafik 31 hari dengan legenda di samping, grafik garis
 * dinamika relevansi, komposisi usia, daftar halaman populer, cincin jenis
 * perangkat, alat ukur faktor perilaku, komposisi sistem operasi, dan daftar
 * frasa pencarian.
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
  garis: '#232936',
  teks: '#f2f5f9',
  teks2: '#9aa3b2',
  teks3: '#6f7a8c',
  biru: '#3b82f6',
  biruMuda: '#60a5fa',
  kuning: '#eab308',
  merah: '#ef4444',
  oranye: '#f97316',
  hijau: '#22c55e',
  cyan: '#22d3ee',
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

const USIA = [
  { label: '25 – 34 tahun', persen: 51.3, warna: WARNA.biru },
  { label: '35 – 44 tahun', persen: 24.7, warna: WARNA.kuning },
  { label: '18 – 24 tahun', persen: 10.0, warna: WARNA.biruMuda },
  { label: '45 – 54 tahun', persen: 9.0, warna: '#2563eb' },
  { label: '55 tahun ke atas', persen: 3.0, warna: WARNA.merah },
  { label: 'Tak diketahui', persen: 1.0, warna: WARNA.abu },
];

const HALAMAN = [
  { path: '/program-federal', persen: 40.3, delta: 2 },
  { path: '/galeri', persen: 20.7, delta: 1 },
  { path: '/lima', persen: 17.0, delta: 1 },
  { path: '/lowongan', persen: 10.0, delta: 4 },
  { path: '/galeri/163454517/pertumbuhan', persen: 7.0, delta: 3 },
  { path: '/galeri/16345560', persen: 3.0, delta: 1 },
  { path: 'Lainnya', persen: 3.0, delta: 1 },
  { path: '/beranda', persen: 2.4, delta: 1 },
  { path: '/kontak', persen: 1.9, delta: 2 },
  { path: '/tentang', persen: 1.4, delta: 0 },
];

const PERANGKAT = [
  { nama: 'PC', persen: 69.7, jumlah: '1.200', warna: WARNA.biru },
  { nama: 'Ponsel', persen: 29.0, jumlah: '1.000', warna: WARNA.kuning },
  { nama: 'Tablet', persen: 1.3, jumlah: '120', warna: WARNA.merah },
];

const PERILAKU = [
  { nama: 'VK', persen: 75, warna: WARNA.biru },
  { nama: 'Facebook', persen: 15, warna: WARNA.kuning },
  { nama: 'Pinterest', persen: 10, warna: WARNA.merah },
];

const OS = [
  { nama: 'Windows', persen: 40, delta: 0, warna: WARNA.biru },
  { nama: 'Google Android', persen: 31, delta: 2, warna: WARNA.kuning },
  { nama: 'Mac OS', persen: 17, delta: 1, warna: WARNA.oranye },
  { nama: 'iOS', persen: 9, delta: 4, warna: WARNA.merah },
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
  { teks: 'Lainnya', persen: 1 },
  { teks: '#tipografi', persen: 1 },
  { teks: '#branding', persen: 1 },
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
      },
    ],
  };
};

const opsiPerangkat = (s: number) => ({
  animationDuration: 800,
  tooltip: {
    ...tooltipDasar(s),
    trigger: 'item',
    formatter: (p: any) => `${p.marker} ${p.name}<br/><b>${String(p.value).replace('.', ',')}%</b>`,
  },
  series: [
    {
      type: 'pie',
      radius: ['64%', '93%'],
      center: ['50%', '50%'],
      label: { show: false },
      labelLine: { show: false },
      itemStyle: { borderColor: WARNA.kartu, borderWidth: 3 * s, borderRadius: 6 * s, shadowColor: 'rgba(0,0,0,0.5)', shadowBlur: 8 * s },
      emphasis: { scale: true, scaleSize: 6 * s, itemStyle: { shadowBlur: 16 * s, shadowColor: 'rgba(0,0,0,0.7)' } },
      data: PERANGKAT.map((p) => ({ name: p.nama, value: p.persen, itemStyle: { color: p.warna } })),
    },
  ],
});

const opsiGauge = (s: number) => ({
  animationDuration: 900,
  series: [
    {
      type: 'gauge',
      startAngle: 220,
      endAngle: -40,
      min: 0,
      max: 100,
      radius: '92%',
      center: ['50%', '58%'],
      progress: { show: true, width: 11 * s, roundCap: true, itemStyle: { color: WARNA.biru, shadowColor: 'rgba(59,130,246,0.7)', shadowBlur: 12 * s } },
      axisLine: { lineStyle: { width: 11 * s, color: [[1, 'rgba(255,255,255,0.08)']] } },
      pointer: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      anchor: { show: false },
      detail: {
        valueAnimation: true,
        fontSize: 20 * s,
        fontWeight: 'bold',
        color: WARNA.teks,
        offsetCenter: [0, '-2%'],
        formatter: '{value}',
      },
      data: [{ value: 100 }],
    },
  ],
});

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
  const perangkatRef = useRef<HTMLDivElement | null>(null);
  const gaugeRef = useRef<HTMLDivElement | null>(null);
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
      ambil('perangkat', perangkatRef.current)?.setOption(opsiPerangkat(skala), true);
      ambil('gauge', gaugeRef.current)?.setOption(opsiGauge(skala), true);

      pengamat = new ResizeObserver(() => {
        Object.values(instans.current).forEach((c: any) => c?.resize?.());
      });
      [trafikRef, relevansiRef, perangkatRef, gaugeRef].forEach((r) => r.current && pengamat?.observe(r.current));
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

  const kartu = (tambahan = '') => `rounded-[0.85em] p-[0.8em] h-full flex flex-col min-h-0 ${tambahan}`;
  const gayaKartu = { backgroundColor: WARNA.kartu, border: `1px solid ${WARNA.garis}` };

  const Kepala: React.FC<{ judul: string; aksi?: React.ReactNode; sub?: string }> = ({ judul, aksi, sub }) => (
    <div className="flex items-start justify-between gap-[0.6em] shrink-0 mb-[0.45em]">
      <div className="min-w-0">
        <h3 className="text-[0.88em] font-semibold leading-tight truncate" style={{ color: WARNA.teks }}>
          {judul}
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
      className="text-[0.66em] font-semibold shrink-0 whitespace-nowrap hover:opacity-70 transition-opacity"
      style={{ color: WARNA.biruMuda }}
    >
      {teks}
    </button>
  );

  const bidang = (galeri: string) => (penuh ? 'w-full flex-1 min-h-[6em]' : `w-full ${galeri}`);
  const daftar = penuh ? 'flex-1 min-h-0 overflow-y-auto gulir-tema pr-[0.2em]' : '';

  const halamanTampil = semuaHalaman ? HALAMAN : HALAMAN.slice(0, 7);
  const frasaTampil = semuaFrasa ? FRASA : FRASA.slice(0, 8);
  const totalPerangkat = PERANGKAT.reduce((a, b) => a + b.persen, 0);

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
                <span className="inline-flex items-center gap-[0.1em] text-[0.68em] font-semibold shrink-0" style={{ color: warnaDelta }}>
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
                    <stop offset="0%" stopColor={warnaDelta} stopOpacity="0.32" />
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
      <div className={`grid grid-cols-1 lg:grid-cols-[2.1fr_1fr_1.05fr] gap-[0.65em] ${penuh ? 'baris-125' : ''}`}>
        {/* Sumber Trafik */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala
            judul="Sumber Trafik"
            sub="1–31 Januari 2023 · pengunjung per hari"
            aksi={
              <span ref={menuRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setMenuRentang((v) => !v)}
                  className="inline-flex items-center gap-[0.25em] rounded-[0.4em] px-[0.45em] py-[0.2em] text-[0.66em] font-medium"
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
            <ul className="flex flex-col justify-center gap-[0.3em] min-w-[6.2em] shrink-0">
              {SERI_TRAFIK.map((seri) => {
                const total = seri.data.slice(N_HARI - rentang).reduce((a, b) => a + b, 0);
                return (
                  <li key={seri.nama} className="flex items-center gap-[0.3em] text-[0.62em] min-w-0">
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
          <Kepala judul="Dinamika Relevansi" sub="Poin relevansi harian" />
          <div ref={relevansiRef} className={bidang('h-[9em]')} />
        </div>

        {/* Usia */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala judul="Usia" aksi={<span className="text-[0.62em] font-semibold" style={{ color: WARNA.merah }}>−7%</span>} />
          <div className="flex items-baseline gap-[0.3em] shrink-0 mb-[0.35em]">
            <span className="text-[1.1em] font-bold leading-none tabular-nums">2.320</span>
            <span className="text-[0.62em]" style={{ color: WARNA.teks3 }}>
              kunjungan
            </span>
          </div>
          <div className="flex h-[0.5em] rounded-full overflow-hidden shrink-0 mb-[0.4em]" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
            {USIA.map((u) => (
              <span key={u.label} style={{ width: `${u.persen}%`, backgroundColor: u.warna }} />
            ))}
          </div>
          <ul className={`flex-1 min-h-0 flex flex-col justify-between gap-[0.22em] ${daftar}`}>
            {USIA.map((u) => (
              <li key={u.label} className="flex items-center gap-[0.3em] text-[0.62em] min-w-0">
                <span className="w-[0.45em] h-[0.45em] rounded-[0.1em] shrink-0" style={{ backgroundColor: u.warna }} />
                <span className="truncate" style={{ color: WARNA.teks2 }}>
                  {u.label}
                </span>
                <span className="ml-auto tabular-nums font-semibold shrink-0">
                  {String(u.persen).replace('.', ',')}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ===== Baris 3: halaman · perangkat · perilaku · OS · frasa ===== */}
      <div className={`grid grid-cols-1 lg:grid-cols-[1.15fr_1fr_0.85fr_1fr_0.95fr] gap-[0.65em] ${penuh ? 'baris-145' : ''}`}>
        {/* Halaman Populer */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala
            judul="Halaman Populer"
            aksi={<Tautan teks={semuaHalaman ? 'Ringkas' : 'Lihat semua'} onClick={() => setSemuaHalaman((v) => !v)} />}
          />
          <ul className={`flex-1 min-h-0 flex flex-col justify-between gap-[0.22em] ${daftar}`}>
            {halamanTampil.map((h) => (
              <li key={h.path} className="flex items-center gap-[0.3em] text-[0.62em] min-w-0">
                <span className="truncate" style={{ color: WARNA.teks2 }}>
                  {h.path}
                </span>
                <span className="ml-auto tabular-nums font-semibold shrink-0">{String(h.persen).replace('.', ',')}%</span>
                <span className="inline-flex items-center gap-[0.05em] shrink-0 text-[0.95em] font-semibold" style={{ color: WARNA.hijau }}>
                  <ArrowUpRight className="w-[0.85em] h-[0.85em]" />
                  {h.delta}%
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Jenis Perangkat */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala judul="Jenis Perangkat" sub="Kunjungan & perangkat" />
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center">
            <div className="relative w-full flex-1 min-h-[5.5em]">
              <div ref={perangkatRef} className="absolute inset-0" />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[1.1em] font-bold leading-none tabular-nums">2.320</span>
                <span className="text-[0.55em] mt-[0.15em]" style={{ color: WARNA.teks3 }}>
                  kunjungan
                </span>
              </div>
            </div>
            <ul className="w-full shrink-0 flex flex-col gap-[0.18em] mt-[0.25em]">
              {PERANGKAT.map((p) => (
                <li key={p.nama} className="flex items-center gap-[0.3em] text-[0.6em] min-w-0">
                  <span className="w-[0.45em] h-[0.45em] rounded-full shrink-0" style={{ backgroundColor: p.warna }} />
                  <span className="truncate" style={{ color: WARNA.teks2 }}>
                    {p.nama}
                  </span>
                  <span className="ml-auto tabular-nums font-semibold shrink-0">{String(p.persen).replace('.', ',')}%</span>
                  <span className="tabular-nums shrink-0 w-[2.4em] text-right" style={{ color: WARNA.teks3 }}>
                    {p.jumlah}
                  </span>
                </li>
              ))}
              <li className="text-[0.55em] text-right" style={{ color: WARNA.teks3 }}>
                total {String(totalPerangkat.toFixed(1)).replace('.', ',')}%
              </li>
            </ul>
          </div>
        </div>

        {/* Faktor Perilaku */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala judul="Faktor Perilaku" sub="Skor keseluruhan" />
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="relative w-full flex-1 min-h-[4.6em]">
              <div ref={gaugeRef} className="absolute inset-0" />
            </div>
            <ul className="shrink-0 flex flex-col gap-[0.2em] mt-[0.2em]">
              {PERILAKU.map((p) => (
                <li key={p.nama} className="flex items-center gap-[0.3em] text-[0.6em] min-w-0">
                  <span className="w-[0.45em] h-[0.45em] rounded-full shrink-0" style={{ backgroundColor: p.warna }} />
                  <span className="truncate" style={{ color: WARNA.teks2 }}>
                    {p.nama}
                  </span>
                  <span className="ml-auto tabular-nums font-semibold shrink-0">{p.persen}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Sistem Operasi */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala judul="Sistem Operasi" sub="Porsi kunjungan" />
          <div className="flex h-[0.5em] rounded-full overflow-hidden shrink-0 mb-[0.45em]" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
            {OS.map((o) => (
              <span key={o.nama} style={{ width: `${o.persen}%`, backgroundColor: o.warna }} />
            ))}
          </div>
          <ul className={`flex-1 min-h-0 flex flex-col justify-between gap-[0.28em] ${daftar}`}>
            {OS.map((o) => (
              <li key={o.nama} className="flex items-center gap-[0.3em] text-[0.62em] min-w-0">
                <span className="w-[0.45em] h-[0.45em] rounded-full shrink-0" style={{ backgroundColor: o.warna }} />
                <span className="truncate" style={{ color: WARNA.teks2 }}>
                  {o.nama}
                </span>
                <span className="ml-auto tabular-nums font-semibold shrink-0">{o.persen}%</span>
                {o.delta > 0 && (
                  <span className="inline-flex items-center shrink-0 text-[0.95em] font-semibold" style={{ color: WARNA.hijau }}>
                    <ArrowUpRight className="w-[0.8em] h-[0.8em]" />
                    {o.delta}%
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
            aksi={<Tautan teks={semuaFrasa ? 'Ringkas' : 'Lihat semua'} onClick={() => setSemuaFrasa((v) => !v)} />}
          />
          <ul className={`flex-1 min-h-0 flex flex-col justify-between gap-[0.26em] ${daftar}`}>
            {frasaTampil.map((f) => (
              <li key={f.teks} className="min-w-0">
                <div className="flex items-center gap-[0.3em] text-[0.62em]">
                  <span className="truncate" style={{ color: WARNA.teks2 }}>
                    {f.teks}
                  </span>
                  <span className="ml-auto tabular-nums font-semibold shrink-0">{f.persen}%</span>
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

      {/* Penanda kecil sumber angka (konsisten dengan template lain) */}
      <div className="hidden" aria-hidden="true">
        <Monitor />
      </div>
    </div>
  );
};
