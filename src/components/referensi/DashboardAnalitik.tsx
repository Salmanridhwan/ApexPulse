import React, { useEffect, useRef, useState } from 'react';
import {
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
 * DASHBOARD ANALITIK — replika tampilan acuan kedua.
 *
 * Referensi: dashboard analitik bisnis bertema navy gelap — 4 kartu KPI
 * (ikon berwarna + sparkline), grafik area pendapatan, batang pesanan per
 * status, cincin sumber kunjungan dengan legenda di samping, tabel pesanan
 * terbaru, kategori teratas, kalender jadwal, umpan aktivitas, dan tugas.
 *
 * INTERAKSI (semua tombol berfungsi)
 * - Chip "Harian/Mingguan" & "Bulan Ini/Bulan Lalu" membuka menu dan benar-benar
 *   mengganti data grafik.
 * - "Lihat semua" membuka daftar penuh (dapat digulir di dalam kartu).
 * - Panah kalender berpindah bulan; tanggal rapat disorot.
 * - Kotak centang tugas dapat dicentang/dilepas.
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

const KATEGORI = [
  { nama: 'Elektronik', nilai: 'Rp 48.920', persen: 38, warna: WARNA.biru, Ikon: Monitor },
  { nama: 'Fesyen', nilai: 'Rp 32.480', persen: 25, warna: WARNA.ungu, Ikon: Shirt },
  { nama: 'Rumah & Dapur', nilai: 'Rp 18.760', persen: 14, warna: WARNA.teal, Ikon: Home },
  { nama: 'Kecantikan', nilai: 'Rp 15.240', persen: 12, warna: WARNA.oranye, Ikon: Sparkles },
  { nama: 'Olahraga', nilai: 'Rp 9.030', persen: 7, warna: WARNA.pink, Ikon: Dumbbell },
  { nama: 'Mainan & Hobi', nilai: 'Rp 6.410', persen: 5, warna: WARNA.biruMuda, Ikon: Sparkles },
  { nama: 'Otomotif', nilai: 'Rp 4.870', persen: 4, warna: WARNA.hijau, Ikon: Truck },
  { nama: 'Buku & Alat Tulis', nilai: 'Rp 3.220', persen: 3, warna: WARNA.merah, Ikon: Package },
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
  { teks: 'Stok Elektronik diperbarui', waktu: '4 jam lalu', warna: WARNA.teal, Ikon: Monitor },
  { teks: 'Pesanan #ORD-10426 selesai', waktu: '5 jam lalu', warna: WARNA.hijau, Ikon: Check },
];

const TUGAS = [
  { nama: 'Perbarui daftar produk', persen: 75, warna: WARNA.biru, selesai: true },
  { nama: 'Tinjau umpan balik pelanggan', persen: 60, warna: WARNA.teal, selesai: true },
  { nama: 'Siapkan laporan bulanan', persen: 40, warna: WARNA.ungu, selesai: false },
  { nama: 'Optimalkan situs web', persen: 20, warna: WARNA.oranye, selesai: false },
  { nama: 'Audit harga pesaing', persen: 10, warna: WARNA.pink, selesai: false },
];

/** Kalender: jumlah hari & indeks hari pertama tiap bulan (0 = Minggu). */
const BULAN_KALENDER = [
  { nama: 'Mei 2024', hari: 31, mulai: 3, sorot: 12 },
  { nama: 'Juni 2024', hari: 30, mulai: 6, sorot: 17 },
  { nama: 'Juli 2024', hari: 31, mulai: 1, sorot: 4 },
];

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
  const [semuaPesanan, setSemuaPesanan] = useState(false);
  const [semuaKategori, setSemuaKategori] = useState(false);
  const [semuaAktivitas, setSemuaAktivitas] = useState(false);
  const [semuaTugas, setSemuaTugas] = useState(false);
  const [bulan, setBulan] = useState(1); // 0 = Mei, 1 = Juni, 2 = Juli 2024
  const [tugasSelesai, setTugasSelesai] = useState<Record<string, boolean>>(
    Object.fromEntries(TUGAS.map((t) => [t.nama, t.selesai])),
  );
  const [menuBaris, setMenuBaris] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [pesanan, setPesanan] = useState(PESANAN_AWAL);

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

      pengamat = new ResizeObserver(() => {
        Object.values(instans.current).forEach((c: any) => c?.resize?.());
      });
      [areaRef, batangRef, donatRef].forEach((r) => r.current && pengamat?.observe(r.current));
    });

    return () => {
      batal = true;
      pengamat?.disconnect();
    };
  }, [skala, modeArea, modeBatang, modeDonat]);

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
  const kategoriTampil = semuaKategori ? KATEGORI : KATEGORI.slice(0, 5);
  const aktivitasTampil = semuaAktivitas ? AKTIVITAS : AKTIVITAS.slice(0, 5);
  const tugasTampil = semuaTugas ? TUGAS : TUGAS.slice(0, 4);
  const pesananTampil = semuaPesanan ? pesanan : pesanan.slice(0, 5);

  const bulanAktif = BULAN_KALENDER[bulan];
  const selKalender: Array<number | null> = [
    ...Array.from({ length: bulanAktif.mulai }, () => null),
    ...Array.from({ length: bulanAktif.hari }, (_, i) => i + 1),
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

        {/* Kolom tengah: kategori + jadwal */}
        <div className="flex flex-col gap-[0.7em] min-h-0">
          <div className={`${kartu()} ${penuh ? 'baris-100' : ''}`} style={gayaKartu}>
            <Kepala
              judul="Kategori Teratas"
              aksi={<Tautan teks={semuaKategori ? 'Ringkas' : 'Lihat semua'} onClick={() => setSemuaKategori((v) => !v)} />}
            />
            <ul className={`flex-1 min-h-0 flex flex-col gap-[0.3em] ${daftar}`}>
              {kategoriTampil.map((k) => (
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
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${k.persen}%`, background: `linear-gradient(90deg, ${k.warna}, ${k.warna}99)` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className={`${kartu()} ${penuh ? 'baris-130' : ''}`} style={gayaKartu}>
            <Kepala judul="Jadwal Mendatang" aksi={<Tautan teks="Hari ini" onClick={() => setBulan(1)} />} />
            <div className={penuh ? 'flex-1 min-h-0 flex gap-[0.6em]' : 'flex gap-[0.6em]'}>
              <div className={penuh ? 'flex-1 min-w-0 flex flex-col' : 'flex-1 min-w-0'}>
                <div className="flex items-center justify-between shrink-0 mb-[0.2em]">
                  <button
                    type="button"
                    onClick={() => setBulan((b) => (b + BULAN_KALENDER.length - 1) % BULAN_KALENDER.length)}
                    className="inline-flex items-center justify-center w-[1.1em] h-[1.1em] rounded hover:bg-white/10"
                    aria-label="Bulan sebelumnya"
                  >
                    <ChevronLeft className="w-[0.85em] h-[0.85em]" style={{ color: WARNA.teks2 }} />
                  </button>
                  <span className="text-[0.68em] font-semibold">{bulanAktif.nama}</span>
                  <button
                    type="button"
                    onClick={() => setBulan((b) => (b + 1) % BULAN_KALENDER.length)}
                    className="inline-flex items-center justify-center w-[1.1em] h-[1.1em] rounded hover:bg-white/10"
                    aria-label="Bulan berikutnya"
                  >
                    <ChevronRight className="w-[0.85em] h-[0.85em]" style={{ color: WARNA.teks2 }} />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-[0.06em] text-center text-[0.55em] shrink-0" style={{ color: WARNA.teks3 }}>
                  {['M', 'S', 'S', 'R', 'K', 'J', 'S'].map((h, i) => (
                    <span key={`${h}-${i}`}>{h}</span>
                  ))}
                </div>
                <div
                  className={
                    penuh
                      ? 'grid grid-cols-7 gap-[0.06em] flex-1 min-h-0 content-start text-center text-[0.56em]'
                      : 'grid grid-cols-7 gap-[0.06em] content-start text-center text-[0.56em]'
                  }
                >
                  {selKalender.map((d, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center justify-center rounded-full h-[1.5em]"
                      style={
                        d === bulanAktif.sorot
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
            <Kepala
              judul="Aktivitas Terbaru"
              aksi={<Tautan teks={semuaAktivitas ? 'Ringkas' : 'Lihat semua'} onClick={() => setSemuaAktivitas((v) => !v)} />}
            />
            <ul className={`flex-1 min-h-0 flex flex-col gap-[0.25em] ${daftar}`}>
              {aktivitasTampil.map((a) => (
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
            <Kepala
              judul="Tugas"
              aksi={<Tautan teks={semuaTugas ? 'Ringkas' : 'Lihat semua'} onClick={() => setSemuaTugas((v) => !v)} />}
            />
            <ul className={`flex-1 min-h-0 flex flex-col gap-[0.3em] ${daftar}`}>
              {tugasTampil.map((t) => {
                const cek = tugasSelesai[t.nama];
                return (
                  <li key={t.nama} className="min-w-0">
                    <div className="flex items-center gap-[0.35em] text-[0.66em] mb-[0.18em]">
                      <button
                        type="button"
                        onClick={() => setTugasSelesai((m) => ({ ...m, [t.nama]: !m[t.nama] }))}
                        className="shrink-0 inline-flex items-center justify-center w-[1.05em] h-[1.05em] rounded-[0.25em] transition-colors"
                        style={cek ? { backgroundColor: WARNA.biru, color: '#fff' } : { border: `1px solid ${WARNA.teks3}` }}
                        aria-label={`Tandai ${t.nama}`}
                      >
                        {cek ? <Check className="w-[0.72em] h-[0.72em]" /> : null}
                      </button>
                      <span
                        className="truncate"
                        style={{ color: cek ? WARNA.teks3 : WARNA.teks2, textDecoration: cek ? 'line-through' : 'none' }}
                      >
                        {t.nama}
                      </span>
                      <span className="ml-auto tabular-nums font-semibold shrink-0">{t.persen}%</span>
                    </div>
                    <div className="h-[0.3em] rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{ width: `${t.persen}%`, background: `linear-gradient(90deg, ${t.warna}, ${t.warna}99)`, opacity: cek ? 0.5 : 1 }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
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
