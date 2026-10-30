import { DollarSign, ShoppingBag, Target, Users } from 'lucide-react';
import { teksNilai, type NilaiAnalitikDeret } from '../templates/nilaiTemplate';
import { htmlBentuk, type DataChart } from './pembangunOpsi';

/**
 * WAJAH LENSA (template dashboard analitik).
 *
 * Seluruh konstanta, helper, dan penyusun opsi di berkas ini dipindahkan APA
 * ADANYA dari halaman `DashboardAnalitik`. Tujuannya satu: pratinjau di katalog
 * template chart dan dashboard sungguhan memakai kode yang sama, jadi hasilnya
 * sama persis. Jangan menyederhanakan isi berkas ini tanpa mengubah halaman.
 */

export const WARNA = {
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

export interface Kpi {
  label: string;
  nilai: string;
  delta: string;
  deltaTeks: string;
  seri: number[];
  warna: string;
  Ikon: React.ComponentType<{ className?: string }>;
  /** Warna delta: hijau saat naik, merah saat turun. */
  naik?: boolean;
  /** true = kartu tetap ada tetapi dokumen tidak punya angkanya. */
  kosong?: boolean;
}

export const KPI_CONTOH: Kpi[] = [
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
export const AREA_DATA: Record<string, { label: string[]; nilai: number[]; judul: string; total: string }> = {
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

export const PESANAN_STATUS = [
  { nama: 'Selesai', singkat: 'Selesai', warna: WARNA.biru },
  { nama: 'Diproses', singkat: 'Diproses', warna: WARNA.teal },
  { nama: 'Dikirim', singkat: 'Dikirim', warna: WARNA.ungu },
  { nama: 'Dibatalkan', singkat: 'Batal', warna: WARNA.oranye },
  { nama: 'Dikembalikan', singkat: 'Kembali', warna: WARNA.pink },
];

/** Nilai batang per periode (chip "Bulan Ini" / "Bulan Lalu"). */
export const BATANG_DATA: Record<string, number[]> = {
  'Bulan Ini': [820, 420, 160, 90, 32],
  'Bulan Lalu': [610, 380, 210, 140, 58],
};

export const SUMBER_NAMA = ['Langsung', 'Pencarian Organik', 'Media Sosial', 'Rujukan', 'Email'];

/** Nilai cincin per periode (chip "Bulan Ini" / "Bulan Lalu"). */
export const DONAT_DATA: Record<string, { nilai: number[]; total: string }> = {
  'Bulan Ini': { nilai: [32.6, 28.4, 18.7, 12.3, 8.0], total: '12.458' },
  'Bulan Lalu': { nilai: [28.1, 31.2, 20.4, 11.6, 8.7], total: '10.902' },
};

export const WARNA_SUMBER = [WARNA.biru, WARNA.teal, WARNA.ungu, WARNA.oranye, WARNA.pink];

export const PESANAN_AWAL = [
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
export const KATEGORI_NILAI = [
  { nama: 'Elektronik', nilai: 48920, warna: WARNA.biru },
  { nama: 'Fesyen', nilai: 32480, warna: WARNA.ungu },
  { nama: 'Rumah & Dapur', nilai: 18760, warna: WARNA.teal },
  { nama: 'Kecantikan', nilai: 15240, warna: WARNA.oranye },
  { nama: 'Olahraga', nilai: 9030, warna: WARNA.pink },
  { nama: 'Lainnya', nilai: 4000, warna: WARNA.biruMuda },
];

export const KATEGORI_UNIT = [
  { nama: 'Elektronik', nilai: 486, warna: WARNA.biru },
  { nama: 'Fesyen', nilai: 402, warna: WARNA.ungu },
  { nama: 'Rumah & Dapur', nilai: 268, warna: WARNA.teal },
  { nama: 'Kecantikan', nilai: 214, warna: WARNA.oranye },
  { nama: 'Olahraga', nilai: 112, warna: WARNA.pink },
  { nama: 'Lainnya', nilai: 60, warna: WARNA.biruMuda },
];

/** Sebaran 1.542 pesanan menurut jam (24 jam). */
export const JAM_PESANAN: Record<string, number[]> = {
  'Hari ini': [12, 12, 13, 16, 21, 30, 43, 61, 81, 101, 115, 121, 117, 105, 91, 81, 76, 77, 80, 80, 73, 60, 44, 31],
  'Rata-rata': [11, 11, 12, 15, 20, 28, 40, 56, 75, 93, 106, 111, 107, 97, 84, 74, 70, 71, 74, 73, 67, 55, 41, 28],
};

/** Metode pembayaran (jumlah pesanan). */
export const PEMBAYARAN: Record<string, { nama: string; nilai: number; warna: string }[]> = {
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
export const KONVERSI: Record<string, { label: string[]; nilai: number[] }> = {
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
export const jalurSpark = (seri: number[]) => {
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

/** Batas atas sumbu yang "rapi": 1/2/2,5/5/10 × pangkat 10 (820 → 1000). */
export const maksRapi = (puncak: number): number => {
  if (!Number.isFinite(puncak) || puncak <= 0) return 1;
  const pangkat = 10 ** Math.floor(Math.log10(puncak));
  const n = puncak / pangkat;
  const faktor = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return faktor * pangkat;
};

/** Angka ringkas gaya Indonesia: 48920 → "48,9 rb". */
export const ringkas = (v: number): string =>
  new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

/** Warna batang kategori & metode pembayaran (sama seperti contoh). */
export const WARNA_KATEGORI = [WARNA.biru, WARNA.ungu, WARNA.teal, WARNA.oranye, WARNA.pink, WARNA.biruMuda];
export const WARNA_BAYAR = [WARNA.biru, WARNA.ungu, WARNA.teal, WARNA.oranye, WARNA.pink];

/** Warna pil status pada tabel pesanan (mengikuti contoh). */
export const WARNA_STATUS: Record<string, string> = {
  selesai: WARNA.hijau,
  diproses: WARNA.biru,
  dikirim: WARNA.ungu,
  dibatalkan: WARNA.merah,
  dikembalikan: WARNA.oranye,
};

/** Penanda slot yang dokumennya tidak memuat angka — kartu tetap, isinya kosong. */
export const Kosong: React.FC<{ teks?: string; absolut?: boolean }> = ({ teks = 'Belum ada angka di dokumen', absolut = true }) => (
  <div
    className={`${absolut ? 'absolute inset-0' : 'flex-1 min-h-0'} flex items-center justify-center px-[0.8em] pointer-events-none`}
  >
    <span className="text-[0.68em] leading-snug text-center" style={{ color: WARNA.teks3 }}>
      {teks}
    </span>
  </div>
);

/** Gaya dasar grafik: huruf, tooltip, dan sumbu mengikuti `skala`. */
export const gayaDasar = (s: number) => ({
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
export const gradasiBatang = (warna: string) => ({
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


export const opsiArea = (s: number, d: NilaiAnalitikDeret & { satuan?: string; dariDokumen: boolean }) => {
  const dasar = gayaDasar(s);
  const puncak = Math.max(...d.nilai);
  const maks = d.dariDokumen ? maksRapi(puncak * 1.08) : Math.ceil(puncak / 10000) * 10000;
  const format = (v: number) => teksNilai(v, d.satuan);
  return {
    animationDuration: 700,
    animationEasing: 'cubicOut' as const,
    grid: { left: 2, right: 12 * s, top: 18 * s, bottom: 2, containLabel: true },
    tooltip: {
      ...dasar.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: 'rgba(96,165,250,0.5)', type: 'dashed', width: 1 } },
      formatter: (p: any[]) =>
        `<div style="font-size:${10 * s}px;color:${WARNA.teks3};margin-bottom:${2 * s}px">${p[0]?.name}${d.dariDokumen ? '' : ' 2024'}</div>` +
        `<div style="display:flex;align-items:center;gap:${6 * s}px"><span style="width:${8 * s}px;height:${8 * s}px;border-radius:50%;background:${WARNA.biru};display:inline-block"></span>` +
        `<b style="font-size:${12 * s}px">${format(Number(p[0]?.value ?? 0))}</b></div>`,
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
      axisLabel: {
        color: WARNA.teks3,
        fontSize: 9 * s,
        formatter: d.dariDokumen ? (v: number) => ringkas(v) : (v: number) => `${v / 1000} rb`,
      },
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
            formatter: (p: any) => format(Number(p.value)),
          },
          data: [{ type: 'max', name: 'Tertinggi' }],
        },
      },
    ],
  };
};

export const opsiBatang = (s: number, nilai: Array<number | null>, dariDokumen: boolean) => {
  const dasar = gayaDasar(s);
  const puncak = Math.max(...nilai.map((v) => v ?? 0), 0);
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
        const status = PESANAN_STATUS[i % PESANAN_STATUS.length];
        return `<div style="color:${WARNA.teks3};margin-bottom:${2 * s}px">${status?.nama ?? p[0]?.name ?? ''}</div><b>${p[0]?.value} pesanan</b>`;
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
      max: dariDokumen ? maksRapi(puncak * 1.1) : 1000,
      ...(dariDokumen ? {} : { interval: 250 }),
      splitLine: dasar.garisBantu,
      axisLabel: {
        color: WARNA.teks3,
        fontSize: 9 * s,
        formatter: dariDokumen
          ? (v: number) => ringkas(v)
          : (v: number) => (v === 0 ? '0' : `${v / 1000}K`),
      },
    },
    series: [
      {
        type: 'bar',
        barWidth: '48%',
        showBackground: true,
        backgroundStyle: { color: 'rgba(255,255,255,0.035)', borderRadius: [5 * s, 5 * s, 0, 0] },
        // Tujuh batang sesuai tujuh status. Data yang lebih panjang dipotong,
        // supaya warna status tidak pernah dibaca dari indeks yang tidak ada.
        data: nilai.slice(0, PESANAN_STATUS.length).map((v, i) => ({
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

export const opsiDonat = (s: number, data: { nama: string; nilai: number }[]) => {
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
        data: data.map((d, i) => ({ name: d.nama, value: d.nilai, itemStyle: { color: WARNA_SUMBER[i % WARNA_SUMBER.length] } })),
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
export const opsiKategori = (
  s: number,
  data: { nama: string; nilai: number; warna?: string }[],
  mode: 'Nilai' | 'Unit',
  dariDokumen: boolean,
) => {
  const dasar = gayaDasar(s);
  const urut = [...data].reverse();
  const maks = Math.max(...data.map((d) => d.nilai), 1);
  const satuan = dariDokumen ? undefined : mode === 'Nilai' ? 'Rp' : 'pesanan';
  const labelNilai = (v: number) =>
    dariDokumen ? ringkas(v) : mode === 'Nilai' ? `${(v / 1000).toFixed(1).replace('.', ',')} rb` : `${v}`;
  return {
    animationDuration: 750,
    animationEasing: 'cubicOut' as const,
    grid: { left: 2, right: 46 * s, top: 4, bottom: 2, containLabel: true },
    tooltip: {
      ...dasar,
      trigger: 'item',
      formatter: (p: any) => `${p.marker} ${p.name}<br/><b>${teksNilai(Number(p.value), satuan)}</b>`,
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
        data: urut.map((d, i) => ({
          value: d.nilai,
          itemStyle: {
            color: gradasiBatangArah(d.warna ?? WARNA_KATEGORI[(urut.length - 1 - i) % WARNA_KATEGORI.length], s),
            borderRadius: [0, 4 * s, 4 * s, 0],
          },
        })),
        showBackground: true,
        backgroundStyle: { color: 'rgba(255,255,255,0.045)', borderRadius: [0, 4 * s, 4 * s, 0] },
        label: {
          show: true,
          position: 'right',
          distance: 6 * s,
          color: WARNA.teks2,
          fontSize: 9 * s,
          fontWeight: 'bold',
          formatter: (p: any) => labelNilai(Number(p.value)),
        },
        emphasis: { itemStyle: { shadowBlur: 12 * s, shadowColor: 'rgba(255,255,255,0.25)' } },
      },
    ],
  };
};

/** Pesanan per jam (batang). */
export const opsiJam = (s: number, d: NilaiAnalitikDeret, dariDokumen: boolean) => {
  const dasar = gayaDasar(s);
  const puncak = Math.max(...d.nilai);
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
      data: d.label,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: WARNA.teks3, fontSize: 8.4 * s, interval: dariDokumen ? 'auto' : 3 },
    },
    yAxis: { type: 'value', show: false, max: dariDokumen ? maksRapi(puncak) : Math.ceil(puncak / 20) * 20 },
    series: [
      {
        type: 'bar',
        barWidth: '62%',
        data: d.nilai.map((v) => ({
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

/** Metode pembayaran (batang mendatar berperingkat — bukan pie). */
export const opsiBayar = (s: number, data: { nama: string; nilai: number; warna?: string }[], dariDokumen: boolean) => {
  const dasar = gayaDasar(s);
  const total = data.reduce((a, b) => a + b.nilai, 0) || 1;
  const urut = [...data].reverse();
  const maks = Math.max(...data.map((d) => d.nilai), 1);
  const angka = (v: number) => (dariDokumen ? ringkas(v) : String(v));
  return {
    animationDuration: 750,
    animationEasing: 'cubicOut' as const,
    grid: { left: 2, right: 62 * s, top: 4, bottom: 2, containLabel: true },
    tooltip: {
      ...dasar,
      trigger: 'item',
      formatter: (p: any) =>
        `${p.marker} ${p.name}<br/><b>${angka(Number(p.value))} pesanan</b> · ${((Number(p.value) / total) * 100).toFixed(1).replace('.', ',')}%`,
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
        data: urut.map((d, i) => ({
          value: d.nilai,
          itemStyle: {
            color: gradasiBatangArah(d.warna ?? WARNA_BAYAR[(urut.length - 1 - i) % WARNA_BAYAR.length], s),
            borderRadius: [0, 4 * s, 4 * s, 0],
          },
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
          formatter: (p: any) =>
            `${angka(Number(p.value))} · ${((Number(p.value) / total) * 100).toFixed(1).replace('.', ',')}%`,
        },
        emphasis: { itemStyle: { shadowBlur: 12 * s, shadowColor: 'rgba(255,255,255,0.25)' } },
      },
    ],
  };
};

/** Tren konversi (garis + area). */
export const opsiKonversi = (s: number, d: NilaiAnalitikDeret & { dariDokumen: boolean }) => {
  const dasar = gayaDasar(s);
  const rata = d.nilai.reduce((a, b) => a + b, 0) / d.nilai.length;
  // Dokumen bisa memuat konversi di skala apa pun — sumbu mengikuti angkanya.
  const minY = d.dariDokumen ? Math.max(0, Math.floor(Math.min(...d.nilai) * 10) / 10 - 0.2) : 2;
  const maxY = d.dariDokumen ? Math.ceil(Math.max(...d.nilai) * 10) / 10 + 0.2 : 4.4;
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
      min: minY,
      max: maxY,
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


/** Pembungkus: DataChart katalog -> bentuk yang dipakai penyusun di atas. */
const deret = (d: DataChart): number[] => (d.seri[0]?.data ?? []).map((v) => (typeof v === 'number' ? v : 0));
const dariDokumen = (d: DataChart): boolean => d.dariDokumen !== false;

export const wajahLensa: Record<string, (d: DataChart, g: any, s: number) => any> = {
  'area-gradasi': (d, _g, s) =>
    opsiArea(s, { label: d.kategori, nilai: deret(d), satuan: d.satuan, dariDokumen: dariDokumen(d) }),
  'bar-tegak-sorot': (d, _g, s) => opsiBatang(s, deret(d), dariDokumen(d)),
  'donat-tebal': (d, _g, s) => opsiDonat(s, d.kategori.map((nama, i) => ({ nama, nilai: deret(d)[i] ?? 0 }))),
  'bar-mendatar-peringkat': (d, _g, s) =>
    opsiKategori(s, d.kategori.map((nama, i) => ({ nama, nilai: deret(d)[i] ?? 0 })), 'Nilai', dariDokumen(d)),
  'garis-tren': (d, _g, s) => opsiKonversi(s, { label: d.kategori, nilai: deret(d), dariDokumen: dariDokumen(d) }),
  'scatter-gelembung': (d, _g, s) => opsiJam(s, { label: d.kategori, nilai: deret(d) }, dariDokumen(d)),
};

/**
 * Kartu KPI versi Lensa, dipindahkan apa adanya dari halaman Analitik.
 * Halaman tidak lagi menggambar kartunya sendiri: ia memakai wajah ini.
 */
export const kpiLensa = htmlBentuk('kpi-lensa');
