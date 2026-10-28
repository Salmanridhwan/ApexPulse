import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Dumbbell,
  Home,
  Monitor,
  MoreVertical,
  Package,
  RotateCcw,
  Shirt,
  ShoppingBag,
  Sparkles,
  Star,
  Target,
  Truck,
  UserPlus,
  Users,
} from 'lucide-react';
import { loadEcharts } from '../widgets/echartsSetup';

/**
 * DASHBOARD ANALITIK — replika tampilan acuan kedua (pengganti template lama).
 *
 * Referensi: dashboard analitik bisnis bertema navy gelap — 4 kartu KPI
 * (ikon berwarna + sparkline), grafik area pendapatan harian, batang pesanan
 * per status, cincin sumber kunjungan dengan legenda di samping, tabel pesanan
 * terbaru, daftar kategori teratas, kalender jadwal, umpan aktivitas, dan
 * daftar tugas berprogres.
 *
 * UKURAN RESPONSIF
 * Semua ukuran memakai `em`; huruf akar dihitung dari besar wadah (`skala`),
 * jadi di layar 1920 isi ikut membesar. Grafik ECharts memakai `skala` yang
 * sama untuk huruf sumbu, tebal garis, dan lebar batang.
 *
 * Dua mode pakai:
 * - `penuh` = false → galeri template (tinggi mengikuti isi).
 * - `penuh` = true  → MODE PRESENTASI: baris membagi tinggi layar.
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

/** 30 hari terakhir (12 Mei – 10 Jun). */
const HARI = Array.from({ length: 30 }, (_, i) => {
  const tgl = 12 + i;
  return tgl <= 31 ? `${tgl} Mei` : `${tgl - 31} Jun`;
});

const PENDAPATAN_HARIAN = [
  8200, 9100, 8700, 10200, 11800, 10900, 12400, 13200, 12600, 14100, 13800, 15200, 16400, 15900, 17300,
  18200, 17600, 19100, 20400, 19800, 21200, 22100, 21500, 23400, 22800, 24560, 23800, 25100, 24400, 25900,
];

const PESANAN_STATUS = [
  { nama: 'Selesai', singkat: 'Selesai', nilai: 820, warna: WARNA.biru },
  { nama: 'Diproses', singkat: 'Diproses', nilai: 420, warna: WARNA.teal },
  { nama: 'Dikirim', singkat: 'Dikirim', nilai: 160, warna: WARNA.ungu },
  { nama: 'Dibatalkan', singkat: 'Batal', nilai: 90, warna: WARNA.oranye },
  { nama: 'Dikembalikan', singkat: 'Kembali', nilai: 32, warna: WARNA.pink },
];

const SUMBER_KUNJUNGAN = [
  { nama: 'Langsung', nilai: 32.6, warna: WARNA.biru },
  { nama: 'Pencarian Organik', nilai: 28.4, warna: WARNA.teal },
  { nama: 'Media Sosial', nilai: 18.7, warna: WARNA.ungu },
  { nama: 'Rujukan', nilai: 12.3, warna: WARNA.oranye },
  { nama: 'Email', nilai: 8.0, warna: WARNA.pink },
];

const TOTAL_KUNJUNGAN = '12.458';

const PESANAN = [
  { id: '#ORD-10435', nama: 'Esther Howard', inisial: 'EH', tanggal: '10 Jun 2024', jumlah: 'Rp 1.249.000', status: 'Selesai', warna: WARNA.hijau },
  { id: '#ORD-10434', nama: 'Cody Fisher', inisial: 'CF', tanggal: '10 Jun 2024', jumlah: 'Rp 89.900', status: 'Diproses', warna: WARNA.biru },
  { id: '#ORD-10433', nama: 'Jane Cooper', inisial: 'JC', tanggal: '9 Jun 2024', jumlah: 'Rp 560.000', status: 'Dikirim', warna: WARNA.ungu },
  { id: '#ORD-10432', nama: 'Dianne Russell', inisial: 'DR', tanggal: '9 Jun 2024', jumlah: 'Rp 145.500', status: 'Dibatalkan', warna: WARNA.merah },
  { id: '#ORD-10431', nama: 'Devon Lane', inisial: 'DL', tanggal: '8 Jun 2024', jumlah: 'Rp 299.990', status: 'Selesai', warna: WARNA.hijau },
];

const KATEGORI = [
  { nama: 'Elektronik', nilai: 'Rp 48.920', persen: 38, warna: WARNA.biru, Ikon: Monitor },
  { nama: 'Fesyen', nilai: 'Rp 32.480', persen: 25, warna: WARNA.ungu, Ikon: Shirt },
  { nama: 'Rumah & Dapur', nilai: 'Rp 18.760', persen: 14, warna: WARNA.teal, Ikon: Home },
  { nama: 'Kecantikan', nilai: 'Rp 15.240', persen: 12, warna: WARNA.oranye, Ikon: Sparkles },
  { nama: 'Olahraga', nilai: 'Rp 9.030', persen: 7, warna: WARNA.pink, Ikon: Dumbbell },
];

const JADWAL = [
  { nama: 'Rapat Tim', waktu: '10.00 – 10.30', warna: WARNA.biru },
  { nama: 'Tinjauan Pemasaran', waktu: '11.00 – 12.00', warna: WARNA.ungu },
  { nama: 'Rapat Produk', waktu: '14.00 – 15.00', warna: WARNA.teal },
  { nama: 'Panggilan Klien', waktu: '16.00 – 17.00', warna: WARNA.oranye },
];

const AKTIVITAS = [
  { teks: 'Pesanan #ORD-10435 dibuat', waktu: '2 mnt lalu', warna: WARNA.hijau, Ikon: Package },
  { teks: 'Jane Cooper membuat akun baru', waktu: '15 mnt lalu', warna: WARNA.biru, Ikon: UserPlus },
  { teks: 'Pesanan #ORD-10433 dikirim', waktu: '1 jam lalu', warna: WARNA.ungu, Ikon: Truck },
  { teks: 'Dana #ORD-10430 dikembalikan', waktu: '2 jam lalu', warna: WARNA.oranye, Ikon: RotateCcw },
  { teks: 'Ulasan baru untuk Headphone', waktu: '3 jam lalu', warna: WARNA.pink, Ikon: Star },
];

const TUGAS = [
  { nama: 'Perbarui daftar produk', persen: 75, warna: WARNA.biru, selesai: true },
  { nama: 'Tinjau umpan balik pelanggan', persen: 60, warna: WARNA.teal, selesai: true },
  { nama: 'Siapkan laporan bulanan', persen: 40, warna: WARNA.ungu, selesai: false },
  { nama: 'Optimalkan situs web', persen: 20, warna: WARNA.oranye, selesai: false },
];

/** Jalur SVG sparkline (viewBox 0..100) — garis + area, seperti referensi. */
const jalurSpark = (seri: number[]) => {
  const min = Math.min(...seri);
  const max = Math.max(...seri);
  const span = max - min || 1;
  const titik = seri.map((v, i) => {
    const x = (i / (seri.length - 1)) * 100;
    const y = 100 - ((v - min) / span) * 82 - 8;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return { garis: `M${titik.join('L')}`, area: `M0,100L${titik.join('L')}L100,100Z` };
};

/** Gaya dasar grafik: huruf, tooltip, dan sumbu mengikuti `skala`. */
const gayaDasar = (s: number) => ({
  tooltip: {
    backgroundColor: '#151d29',
    borderColor: WARNA.garis,
    borderWidth: 1,
    padding: [6 * s, 10 * s],
    textStyle: { color: WARNA.teks, fontSize: 11 * s },
  },
  sumbu: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: WARNA.teks3, fontSize: 9.5 * s },
  },
  garisBantu: { lineStyle: { color: 'rgba(255,255,255,0.08)', type: 'dashed' as const, width: 1 } },
});

const opsiArea = (s: number) => {
  const dasar = gayaDasar(s);
  return {
    grid: { left: 2, right: 8 * s, top: 10 * s, bottom: 2, containLabel: true },
    tooltip: {
      ...dasar.tooltip,
      trigger: 'axis',
      formatter: (p: any[]) =>
        `<div style="font-size:${10 * s}px;color:${WARNA.teks3}">${p[0]?.name} 2024</div>` +
        `<b>Rp ${Number(p[0]?.value ?? 0).toLocaleString('id-ID')}</b>`,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: HARI,
      ...dasar.sumbu,
      axisLabel: { color: WARNA.teks3, fontSize: 9 * s, interval: 5 },
    },
    yAxis: {
      type: 'value',
      max: 40000,
      interval: 10000,
      splitLine: dasar.garisBantu,
      axisLabel: { color: WARNA.teks3, fontSize: 9 * s, formatter: (v: number) => `${v / 1000} rb` },
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 0,
        showSymbol: false,
        data: PENDAPATAN_HARIAN,
        lineStyle: { width: 2.2 * s, color: WARNA.biru },
        itemStyle: { color: WARNA.biru },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59,130,246,0.42)' },
              { offset: 1, color: 'rgba(59,130,246,0.02)' },
            ],
          },
        },
      },
    ],
  };
};

const opsiBatang = (s: number) => {
  const dasar = gayaDasar(s);
  return {
    grid: { left: 2, right: 4, top: 18 * s, bottom: 2, containLabel: true },
    tooltip: {
      ...dasar.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (p: any[]) => `<div style="color:${WARNA.teks3}">${p[0]?.name}</div><b>${p[0]?.value} pesanan</b>`,
    },
    xAxis: {
      type: 'category',
      data: PESANAN_STATUS.map((x) => x.singkat),
      ...dasar.sumbu,
      axisLabel: { color: WARNA.teks3, fontSize: 8.4 * s, interval: 0 },
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
        barWidth: '46%',
        data: PESANAN_STATUS.map((x) => ({
          value: x.nilai,
          itemStyle: { color: x.warna, borderRadius: [4 * s, 4 * s, 0, 0] },
        })),
        label: {
          show: true,
          position: 'top',
          distance: 3 * s,
          color: WARNA.teks2,
          fontSize: 8.6 * s,
          fontWeight: 'bold',
        },
      },
    ],
  };
};

const opsiDonat = (s: number) => ({
  tooltip: {
    backgroundColor: '#151d29',
    borderColor: WARNA.garis,
    borderWidth: 1,
    padding: [6 * s, 10 * s],
    textStyle: { color: WARNA.teks, fontSize: 11 * s },
    formatter: (p: any) => `${p.marker} ${p.name}<br/><b>${String(p.value).replace('.', ',')}%</b>`,
  },
  series: [
    {
      type: 'pie',
      radius: ['66%', '94%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: false,
      label: { show: false },
      labelLine: { show: false },
      itemStyle: { borderColor: WARNA.kartu, borderWidth: 2.5 * s, borderRadius: 3 * s },
      data: SUMBER_KUNJUNGAN.map((x) => ({ name: x.nama, value: x.nilai, itemStyle: { color: x.warna } })),
    },
  ],
});

interface DashboardAnalitikProps {
  /** true = isi seluruh tinggi wadah (mode presentasi / layar penuh). */
  penuh?: boolean;
}

export const DashboardAnalitik: React.FC<DashboardAnalitikProps> = ({ penuh = false }) => {
  const [skala, setSkala] = useState(1);
  const [semuaPesanan, setSemuaPesanan] = useState(false);

  const akarRef = useRef<HTMLDivElement | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const batangRef = useRef<HTMLDivElement | null>(null);
  const donatRef = useRef<HTMLDivElement | null>(null);
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

  // Gambar & perbarui grafik.
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

      ambil('area', areaRef.current)?.setOption(opsiArea(skala), true);
      ambil('batang', batangRef.current)?.setOption(opsiBatang(skala), true);
      ambil('donat', donatRef.current)?.setOption(opsiDonat(skala), true);

      pengamat = new ResizeObserver(() => {
        Object.values(instans.current).forEach((c: any) => c?.resize?.());
      });
      [areaRef, batangRef, donatRef].forEach((r) => r.current && pengamat?.observe(r.current));
    });

    return () => {
      batal = true;
      pengamat?.disconnect();
    };
  }, [skala]);

  useEffect(
    () => () => {
      Object.values(instans.current).forEach((c: any) => c?.dispose?.());
      instans.current = {};
    },
    [],
  );

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

  const Chip: React.FC<{ teks: string }> = ({ teks }) => (
    <span
      className="inline-flex items-center gap-[0.25em] rounded-[0.4em] px-[0.45em] py-[0.2em] text-[0.68em] font-medium shrink-0"
      style={{ backgroundColor: WARNA.kartu2, border: `1px solid ${WARNA.garis}`, color: WARNA.teks2 }}
    >
      {teks}
      <ChevronDown className="w-[0.9em] h-[0.9em]" />
    </span>
  );

  const Tautan: React.FC<{ teks: string; onClick?: () => void }> = ({ teks, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className="text-[0.68em] font-semibold shrink-0 whitespace-nowrap hover:underline"
      style={{ color: WARNA.biruMuda }}
    >
      {teks}
    </button>
  );

  /** Tinggi bidang grafik: memanjang di presentasi, tetap di galeri. */
  const bidang = (tinggiGaleri: string) => (penuh ? 'w-full flex-1 min-h-[6.5em]' : `w-full ${tinggiGaleri}`);

  // Kalender Juni 2024 — 1 Juni jatuh pada hari Sabtu (minggu diawali Minggu).
  const selKalender: Array<number | null> = [
    ...Array.from({ length: 6 }, () => null),
    ...Array.from({ length: 30 }, (_, i) => i + 1),
  ];

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
                    <stop offset="0%" stopColor={k.warna} stopOpacity="0.35" />
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

      {/* ===== Baris 2: pendapatan harian · pesanan per status · sumber kunjungan ===== */}
      <div className={`grid grid-cols-1 lg:grid-cols-[2.05fr_1fr_1.05fr] gap-[0.7em] ${penuh ? 'baris-118' : ''}`}>
        {/* Ikhtisar Pendapatan */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala judul="Ikhtisar Pendapatan" aksi={<Chip teks="Harian" />} />
          <div className="flex items-end justify-between gap-[0.6em] shrink-0">
            <div>
              <div className="text-[1.15em] font-bold leading-none tabular-nums">Rp 386.480</div>
              <div className="text-[0.68em] mt-[0.25em]" style={{ color: WARNA.teks3 }}>
                12 Mei – 10 Jun 2024
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
          <Kepala judul="Pesanan per Status" aksi={<Chip teks="Bulan Ini" />} />
          <div ref={batangRef} className={bidang('h-[10.5em]')} />
        </div>

        {/* Sumber Kunjungan */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala judul="Sumber Kunjungan" aksi={<Chip teks="Bulan Ini" />} />
          <div className="flex-1 min-h-0 grid grid-cols-[minmax(5.2em,1fr)_minmax(6.2em,1.05fr)] gap-[0.5em] items-center">
            <div className="relative w-full h-full min-h-[6.5em]">
              <div ref={donatRef} className="absolute inset-0" />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[1.02em] font-bold leading-none tabular-nums">{TOTAL_KUNJUNGAN}</span>
                <span className="text-[0.6em] mt-[0.2em]" style={{ color: WARNA.teks3 }}>
                  Total Kunjungan
                </span>
              </div>
            </div>
            <ul className="flex flex-col gap-[0.32em] min-w-0">
              {SUMBER_KUNJUNGAN.map((x) => (
                <li key={x.nama} className="flex items-center gap-[0.35em] text-[0.68em] min-w-0">
                  <span className="w-[0.55em] h-[0.55em] rounded-full shrink-0" style={{ backgroundColor: x.warna }} />
                  <span className="truncate" style={{ color: WARNA.teks2 }}>
                    {x.nama}
                  </span>
                  <span className="ml-auto tabular-nums font-semibold shrink-0" style={{ color: WARNA.teks }}>
                    {String(x.nilai).replace('.', ',')}%
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
          <Kepala judul="Pesanan Terbaru" aksi={<Tautan teks="Lihat semua" onClick={() => setSemuaPesanan((v) => !v)} />} />
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
            <div className="flex-1 min-h-0 flex flex-col">
              {(semuaPesanan ? [...PESANAN, ...PESANAN.map((p, i) => ({ ...p, id: `#ORD-104${30 - i}`, nama: ['Wade Warren', 'Brooklyn Simmons', 'Cameron Williamson', 'Jenny Wilson', 'Guy Hawkins'][i], inisial: ['WW', 'BS', 'CW', 'JW', 'GH'][i] }))] : PESANAN).map((p, i) => (
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
                  <span className="flex justify-end">
                    <MoreVertical className="w-[0.95em] h-[0.95em]" style={{ color: WARNA.teks3 }} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Kolom tengah: kategori + jadwal */}
        <div className="flex flex-col gap-[0.7em] min-h-0">
          <div className={`${kartu()} ${penuh ? 'baris-100' : ''}`} style={gayaKartu}>
            <Kepala judul="Kategori Teratas" aksi={<Tautan teks="Lihat semua" />} />
            <ul className="flex-1 min-h-0 flex flex-col justify-between gap-[0.3em]">
              {KATEGORI.map((k) => (
                <li key={k.nama} className="min-w-0">
                  <div className="flex items-center gap-[0.35em] text-[0.68em] mb-[0.18em]">
                    <span
                      className="shrink-0 inline-flex items-center justify-center w-[1.25em] h-[1.25em] rounded-[0.3em]"
                      style={{ backgroundColor: `${k.warna}22`, color: k.warna }}
                    >
                      <k.Ikon className="w-[0.8em] h-[0.8em]" />
                    </span>
                    <span className="truncate font-medium">{k.nama}</span>
                    <span className="ml-auto tabular-nums shrink-0" style={{ color: WARNA.teks2 }}>
                      {k.nilai}
                    </span>
                    <span className="tabular-nums font-semibold shrink-0 w-[2.1em] text-right">{k.persen}%</span>
                  </div>
                  <div className="h-[0.32em] rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                    <div className="h-full rounded-full" style={{ width: `${k.persen}%`, backgroundColor: k.warna }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className={`${kartu()} ${penuh ? 'baris-130' : ''}`} style={gayaKartu}>
            <Kepala
              judul="Jadwal Mendatang"
              aksi={<Tautan teks="Lihat kalender" />}
            />
            <div className={penuh ? 'flex-1 min-h-0 flex gap-[0.6em]' : 'flex gap-[0.6em]'}>
              <div className={penuh ? 'flex-1 min-w-0 flex flex-col' : 'flex-1 min-w-0'}>
                <div className="flex items-center justify-between shrink-0 mb-[0.2em]">
                  <ChevronLeft className="w-[0.85em] h-[0.85em]" style={{ color: WARNA.teks3 }} />
                  <span className="text-[0.68em] font-semibold">Juni 2024</span>
                  <ChevronRight className="w-[0.85em] h-[0.85em]" style={{ color: WARNA.teks3 }} />
                </div>
                <div className="grid grid-cols-7 gap-[0.1em] text-center text-[0.55em] shrink-0" style={{ color: WARNA.teks3 }}>
                  {['M', 'S', 'S', 'R', 'K', 'J', 'S'].map((h, i) => (
                    <span key={`${h}-${i}`}>{h}</span>
                  ))}
                </div>
                <div className={penuh ? 'grid grid-cols-7 gap-[0.06em] flex-1 min-h-0 content-start text-center text-[0.56em]' : 'grid grid-cols-7 gap-[0.06em] content-start text-center text-[0.56em]'}>
                  {selKalender.map((d, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center justify-center rounded-full h-[1.5em]"
                      style={
                        d === 17
                          ? { backgroundColor: WARNA.biru, color: '#fff', fontWeight: 700 }
                          : { color: d ? WARNA.teks2 : 'transparent' }
                      }
                    >
                      {d ?? '·'}
                    </span>
                  ))}
                </div>
              </div>
              <ul className="flex-1 min-w-0 flex flex-col justify-center gap-[0.3em]">
                {JADWAL.map((j) => (
                  <li key={j.nama} className="flex items-start gap-[0.35em] text-[0.64em] min-w-0">
                    <span className="w-[0.45em] h-[0.45em] rounded-full shrink-0 mt-[0.35em]" style={{ backgroundColor: j.warna }} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{j.nama}</span>
                      <span className="block truncate" style={{ color: WARNA.teks3 }}>
                        {j.waktu}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Kolom kanan: aktivitas + tugas */}
        <div className="flex flex-col gap-[0.7em] min-h-0">
          <div className={`${kartu()} ${penuh ? 'baris-115' : ''}`} style={gayaKartu}>
            <Kepala judul="Aktivitas Terbaru" aksi={<Tautan teks="Lihat semua" />} />
            <ul className="flex-1 min-h-0 flex flex-col justify-between gap-[0.25em]">
              {AKTIVITAS.map((a) => (
                <li key={a.teks} className="flex items-center gap-[0.4em] text-[0.64em] min-w-0">
                  <span
                    className="shrink-0 inline-flex items-center justify-center w-[1.3em] h-[1.3em] rounded-[0.3em]"
                    style={{ backgroundColor: `${a.warna}22`, color: a.warna }}
                  >
                    <a.Ikon className="w-[0.8em] h-[0.8em]" />
                  </span>
                  <span className="truncate" style={{ color: WARNA.teks2 }}>
                    {a.teks}
                  </span>
                  <span className="ml-auto shrink-0 text-[0.92em]" style={{ color: WARNA.teks3 }}>
                    {a.waktu}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className={`${kartu()} ${penuh ? 'baris-100' : ''}`} style={gayaKartu}>
            <Kepala judul="Tugas" aksi={<Tautan teks="Lihat semua" />} />
            <ul className="flex-1 min-h-0 flex flex-col justify-between gap-[0.3em]">
              {TUGAS.map((t) => (
                <li key={t.nama} className="min-w-0">
                  <div className="flex items-center gap-[0.35em] text-[0.66em] mb-[0.18em]">
                    <span
                      className="shrink-0 inline-flex items-center justify-center w-[1.05em] h-[1.05em] rounded-[0.25em]"
                      style={
                        t.selesai
                          ? { backgroundColor: WARNA.biru, color: '#fff' }
                          : { border: `1px solid ${WARNA.teks3}` }
                      }
                    >
                      {t.selesai ? <Check className="w-[0.72em] h-[0.72em]" /> : null}
                    </span>
                    <span className="truncate" style={{ color: WARNA.teks2 }}>
                      {t.nama}
                    </span>
                    <span className="ml-auto tabular-nums font-semibold shrink-0">{t.persen}%</span>
                  </div>
                  <div className="h-[0.3em] rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                    <div className="h-full rounded-full" style={{ width: `${t.persen}%`, backgroundColor: t.warna }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Ikon kalender dipakai di kepala kartu jadwal (impor agar tidak dianggap tak terpakai). */
export const IkonJadwal = Calendar;
