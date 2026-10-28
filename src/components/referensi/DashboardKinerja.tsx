import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  Clock,
  Coins,
  Droplets,
  Receipt,
  Tag,
  TrendingDown,
  TrendingUp,
  Users,
  Utensils,
} from 'lucide-react';
import { loadEcharts } from '../widgets/echartsSetup';

/**
 * DASHBOARD KINERJA — replika tampilan acuan KEDUA (gaya "executive dashboard"
 * biru-navy dengan aksen emas).
 *
 * Susunan mengikuti referensi:
 *   baris 1 : 6 kartu KPI (label huruf kecil, angka besar, chip delta, sparkline)
 *   baris 2 : tren harian (garis 2 seri) · komposisi segmen (cincin) · kategori teratas (batang horizontal)
 *   baris 3 : 6 kartu metrik ringkas berikon
 *   baris 4 : peta panas hari × jam · metode pembayaran (cincin) · ringkasan tahun berjalan
 *
 * Isi disesuaikan dengan domain instansi air minum (angka CONTOH), susunannya
 * tetap sama dengan referensi.
 *
 * Ukuran memakai `em` + `skala` dari besar wadah, jadi di layar besar isinya
 * ikut membesar dan grafik tidak terasa melebar (sama seperti template pertama).
 */

const W = {
  latar: '#0b1220',
  kartu: '#111c2e',
  kartu2: '#16233a',
  garis: '#22304a',
  teks: '#e6edf7',
  teks2: '#b7c3d6',
  teks3: '#8a99b0',
  emas: '#d6a54a',
  hijau: '#2ecc8f',
  biru: '#2d9cdb',
  oranye: '#f5a623',
  ungu: '#8b5cf6',
  merah: '#ef4444',
};

interface Kpi {
  label: string;
  nilai: string;
  catatan: string;
  delta: string;
  warna: string;
  seri: number[];
}

const KPI: Kpi[] = [
  { label: 'Total Pendapatan', nilai: 'Rp 245,6 jt', catatan: 'vs kemarin', delta: '+12,45%', warna: W.hijau, seri: [30, 34, 32, 38, 41, 39, 45, 48, 46, 52] },
  { label: 'Laba Kotor', nilai: 'Rp 176,5 jt', catatan: 'margin 71,93%', delta: '+9,10%', warna: W.hijau, seri: [22, 25, 24, 28, 30, 29, 33, 35, 34, 38] },
  { label: 'Laba Bersih', nilai: 'Rp 78,2 jt', catatan: 'margin 31,88%', delta: '+6,42%', warna: W.biru, seri: [12, 13, 12.5, 15, 16, 15.5, 18, 19, 18.5, 21] },
  { label: 'Transaksi', nilai: '356', catatan: 'vs kemarin', delta: '+8,21%', warna: W.oranye, seri: [40, 44, 42, 48, 51, 49, 55, 58, 56, 62] },
  { label: 'Rata-rata Tagihan', nilai: 'Rp 68.880', catatan: 'per transaksi', delta: '+3,91%', warna: W.ungu, seri: [18, 19, 18.6, 20, 21, 20.4, 22, 23, 22.6, 24] },
  { label: 'Kehilangan Air', nilai: '28,45%', catatan: 'vs kemarin', delta: '-1,03%', warna: W.merah, seri: [34, 33.4, 33.8, 32, 31.5, 31.8, 30.4, 29.6, 29.2, 28.45] },
];

const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const TREN_MINGGU_INI = [148, 162, 155, 178, 190, 212, 245.6];
const TREN_MINGGU_LALU = [132, 141, 138, 152, 160, 174, 189];

const SEGMEN = [
  { nama: 'Rumah Tangga', nilai: 40.1, nominal: 'Rp 98,5 jt', warna: W.biru },
  { nama: 'Niaga', nilai: 22.9, nominal: 'Rp 56,2 jt', warna: W.hijau },
  { nama: 'Industri', nilai: 25.8, nominal: 'Rp 63,4 jt', warna: W.oranye },
  { nama: 'Instansi', nilai: 11.2, nominal: 'Rp 27,5 jt', warna: W.merah },
];

const KATEGORI = [
  { nama: 'Rumah Tangga', nilai: 62.5, porsi: 25.5 },
  { nama: 'Niaga', nilai: 54.2, porsi: 22.1 },
  { nama: 'Industri', nilai: 43.1, porsi: 17.6 },
  { nama: 'Instansi', nilai: 32.1, porsi: 13.1 },
  { nama: 'Khusus', nilai: 21.8, porsi: 8.9 },
  { nama: 'Lain-lain', nilai: 11.9, porsi: 4.8 },
];

const METRIK = [
  { label: 'Biaya Air', nilai: 'Rp 69,8 jt', porsi: '28,45%', warna: W.merah, Ikon: Droplets },
  { label: 'Biaya Pegawai', nilai: 'Rp 43,2 jt', porsi: '17,61%', warna: W.merah, Ikon: Users },
  { label: 'Prime Cost', nilai: 'Rp 113,0 jt', porsi: '46,06%', warna: W.ungu, Ikon: Clock },
  { label: 'Keringanan', nilai: 'Rp 8,5 jt', porsi: '3,46%', warna: W.hijau, Ikon: Tag },
  { label: 'Tunggakan Baru', nilai: 'Rp 3,2 jt', porsi: '1,30%', warna: W.merah, Ikon: AlertTriangle },
  { label: 'Selisih Kas', nilai: 'Rp 1,8 jt', porsi: '0,73%', warna: W.teks3, Ikon: Coins },
];

const PEMBAYARAN = [
  { nama: 'Tunai', nilai: 34.4, nominal: 'Rp 84,5 jt', warna: W.hijau },
  { nama: 'Transfer', nilai: 45.8, nominal: 'Rp 112,5 jt', warna: W.biru },
  { nama: 'Online', nilai: 19.8, nominal: 'Rp 48,6 jt', warna: W.oranye },
];

const JAM = ['00', '02', '04', '06', '08', '10', '12', '14', '16', '18', '20', '22', '24'];

/** Peta panas contoh: pemakaian per hari × jam (nilai 0–100, deterministik). */
const dataPanas = () => {
  const baris: number[][] = [];
  for (let d = 0; d < HARI.length; d += 1) {
    const isi: number[] = [];
    for (let j = 0; j < JAM.length; j += 1) {
      const puncakPagi = Math.max(0, 92 - Math.abs(j - 3) * 16);
      const puncakSore = Math.max(0, 78 - Math.abs(j - 8) * 13);
      const geser = ((d * 7 + j * 5) % 11) - 5;
      isi.push(Math.max(6, Math.min(100, Math.round(puncakPagi * 0.7 + puncakSore * 0.6 + geser))));
    }
    baris.push(isi);
  }
  return baris;
};

/** Jalur SVG area untuk kartu ringkasan tahun berjalan. */
const jalurArea = (seri: number[]) => {
  const min = Math.min(...seri);
  const max = Math.max(...seri);
  const span = max - min || 1;
  const titik = seri.map((v, i) => `${((i / (seri.length - 1)) * 100).toFixed(1)},${(100 - ((v - min) / span) * 82 - 8).toFixed(1)}`);
  return { garis: `M${titik.join('L')}`, area: `M0,100L${titik.join('L')}L100,100Z` };
};

const dasar = (s: number) => ({
  tooltip: {
    backgroundColor: '#16233a',
    borderColor: W.garis,
    borderWidth: 1,
    padding: [6 * s, 10 * s],
    textStyle: { color: W.teks, fontSize: 11 * s },
  },
  sumbu: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: W.teks3, fontSize: 10 * s },
  },
});

const opsiTren = (s: number) => {
  const d = dasar(s);
  return {
    grid: { left: 4, right: 10, top: 26 * s, bottom: 2, containLabel: true },
    legend: {
      show: true,
      top: 0,
      right: 0,
      itemWidth: 10 * s,
      itemHeight: 4 * s,
      textStyle: { color: W.teks3, fontSize: 10 * s },
      data: ['Minggu ini', 'Minggu lalu'],
    },
    tooltip: {
      ...d.tooltip,
      trigger: 'axis',
      formatter: (p: any[]) =>
        `<div style="font-size:${10 * s}px;color:${W.teks3}">${p[0].name}</div>` +
        p.map((x) => `<div>${x.marker} ${x.seriesName}: <b>Rp ${String(x.value).replace('.', ',')} jt</b></div>`).join(''),
    },
    xAxis: { type: 'category', data: HARI, ...d.sumbu },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: W.garis, type: 'dashed' } },
      axisLabel: { color: W.teks3, fontSize: 10 * s, formatter: 'Rp {value}' },
    },
    series: [
      {
        name: 'Minggu ini',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4 * s,
        data: TREN_MINGGU_INI,
        lineStyle: { width: 2.4 * s, color: W.biru },
        itemStyle: { color: W.biru },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(45,156,219,0.30)' },
              { offset: 1, color: 'rgba(45,156,219,0.01)' },
            ],
          },
        },
        markPoint: {
          symbol: 'circle',
          symbolSize: 6 * s,
          itemStyle: { color: W.biru, borderColor: '#fff', borderWidth: 1.5 * s },
          label: {
            show: true,
            position: 'top',
            distance: 6 * s,
            color: W.teks,
            fontSize: 10 * s,
            fontWeight: 'bold',
            backgroundColor: 'rgba(22,35,58,0.95)',
            borderColor: W.garis,
            borderWidth: 1,
            padding: [3 * s, 5 * s],
            borderRadius: 4 * s,
            formatter: () => 'Rp 245,6 jt',
          },
          data: [{ coord: [6, 245.6] }],
        },
      },
      {
        name: 'Minggu lalu',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: TREN_MINGGU_LALU,
        lineStyle: { width: 1.8 * s, color: '#64748b', type: 'dashed' },
      },
    ],
  };
};

const opsiDonat = (s: number, data: { nama: string; nilai: number; warna: string }[]) => ({
  tooltip: {
    ...dasar(s).tooltip,
    trigger: 'item',
    formatter: (p: any) => `${p.name}: <b>${p.value}%</b>`,
  },
  series: [
    {
      type: 'pie',
      radius: ['70%', '98%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: false,
      label: { show: false },
      labelLine: { show: false },
      itemStyle: { borderColor: W.kartu, borderWidth: 3 * s, borderRadius: 3 * s },
      data: data.map((x) => ({ name: x.nama, value: x.nilai, itemStyle: { color: x.warna } })),
    },
  ],
});

const opsiKategori = (s: number) => {
  const d = dasar(s);
  return {
    grid: { left: 4, right: 46 * s, top: 4, bottom: 2, containLabel: true },
    tooltip: {
      ...d.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (p: any[]) => `${p[0].name}: <b>Rp ${String(p[0].value).replace('.', ',')} jt</b>`,
    },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      inverse: true,
      data: KATEGORI.map((k) => k.nama),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: W.teks2, fontSize: 10 * s },
    },
    series: [
      {
        type: 'bar',
        data: KATEGORI.map((k) => k.nilai),
        barWidth: '52%',
        itemStyle: { color: W.emas, borderRadius: [0, 3 * s, 3 * s, 0] },
        label: {
          show: true,
          position: 'right',
          color: W.teks2,
          fontSize: 9.5 * s,
          formatter: (p: any) => `Rp ${String(p.value).replace('.', ',')} jt · ${String(KATEGORI[p.dataIndex].porsi).replace('.', ',')}%`,
        },
      },
    ],
  };
};

const opsiPanas = (s: number) => {
  const data: Array<[number, number, number]> = [];
  const isi = dataPanas();
  isi.forEach((baris, y) => baris.forEach((v, x) => data.push([x, y, v])));
  return {
    grid: { left: 2, right: 6, top: 4, bottom: 26 * s, containLabel: true },
    tooltip: {
      ...dasar(s).tooltip,
      formatter: (p: any) => `${HARI[p.value[1]]} ${JAM[p.value[0]]}:00 — indeks <b>${p.value[2]}</b>`,
    },
    xAxis: {
      type: 'category',
      data: JAM,
      splitArea: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: W.teks3, fontSize: 9 * s },
    },
    yAxis: {
      type: 'category',
      data: HARI,
      inverse: true,
      splitArea: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: W.teks3, fontSize: 9.5 * s },
    },
    visualMap: {
      min: 0,
      max: 100,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 10 * s,
      itemHeight: 60 * s,
      text: ['Tinggi', 'Rendah'],
      textStyle: { color: W.teks3, fontSize: 9 * s },
      inRange: { color: ['#12233a', '#1d4ed8', '#60a5fa'] },
    },
    series: [
      {
        type: 'heatmap',
        data,
        itemStyle: { borderColor: W.kartu, borderWidth: 1.5 * s, borderRadius: 2 * s },
        emphasis: { itemStyle: { borderColor: W.emas, borderWidth: 1 * s } },
      },
    ],
  };
};

interface Props {
  penuh?: boolean;
}

export const DashboardKinerja: React.FC<Props> = ({ penuh = false }) => {
  const [skala, setSkala] = useState(1);
  const akarRef = useRef<HTMLDivElement | null>(null);
  const trenRef = useRef<HTMLDivElement | null>(null);
  const segmenRef = useRef<HTMLDivElement | null>(null);
  const kategoriRef = useRef<HTMLDivElement | null>(null);
  const panasRef = useRef<HTMLDivElement | null>(null);
  const bayarRef = useRef<HTMLDivElement | null>(null);
  const instans = useRef<Record<string, any>>({});

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
      const s = Math.min(r.width / 1500, r.height / 860);
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

      ambil('tren', trenRef.current)?.setOption(opsiTren(skala), true);
      ambil('segmen', segmenRef.current)?.setOption(opsiDonat(skala, SEGMEN), true);
      ambil('kategori', kategoriRef.current)?.setOption(opsiKategori(skala), true);
      ambil('panas', panasRef.current)?.setOption(opsiPanas(skala), true);
      ambil('bayar', bayarRef.current)?.setOption(opsiDonat(skala, PEMBAYARAN), true);

      pengamat = new ResizeObserver(() => {
        Object.values(instans.current).forEach((c: any) => c?.resize?.());
      });
      [trenRef, segmenRef, kategoriRef, panasRef, bayarRef].forEach((r) => r.current && pengamat?.observe(r.current));
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

  // Kartu SELALU mengisi tinggi barisnya (galeri maupun presentasi). Dengan
  // begitu cincin ikut memanjang dan tidak menyisakan ruang kosong di bawah.
  const kartu = (tambahan = '') => `rounded-[0.9em] p-[0.85em] h-full flex flex-col min-h-0 ${tambahan}`;

  const gayaKartu = { backgroundColor: W.kartu, border: `1px solid ${W.garis}` };

  return (
    <div
      ref={akarRef}
      className={penuh ? 'h-full w-full flex flex-col gap-[0.7em] p-[0.8em] overflow-hidden' : 'rounded-[1.2em] p-[1em]'}
      style={{ backgroundColor: W.latar, color: W.teks, fontSize: `${(13 * skala).toFixed(2)}px` }}
    >
      {/* ===== Baris 1: 6 KPI ===== */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-[0.7em] ${penuh ? 'flex-[0.82] min-h-0' : 'mb-[0.7em]'}`}>
        {KPI.map((k) => {
          const naik = k.delta.startsWith('+');
          const jalur = jalurArea(k.seri);
          const idGrad = `kj-${k.label.replace(/\s+/g, '-')}`;
          return (
            <div key={k.label} className={kartu('gap-[0.35em]')} style={gayaKartu}>
              <span className="text-[0.68em] font-semibold uppercase tracking-wide leading-tight" style={{ color: W.teks3 }}>
                {k.label}
              </span>
              <span className="text-[1.05em] font-bold leading-none tabular-nums whitespace-nowrap">{k.nilai}</span>
              <span className="text-[0.68em] flex flex-wrap items-center gap-x-[0.3em] gap-y-[0.1em]" style={{ color: naik ? W.hijau : W.merah }}>
                {naik ? <TrendingUp className="w-[0.9em] h-[0.9em]" /> : <TrendingDown className="w-[0.9em] h-[0.9em]" />}
                <span className="font-semibold">{k.delta}</span>
                <span className="truncate" style={{ color: W.teks3 }}>{k.catatan}</span>
              </span>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className={penuh ? 'w-full flex-1 min-h-[1.2em] mt-[0.15em]' : 'w-full h-[1.9em] mt-[0.15em]'}
                aria-hidden
              >
                <defs>
                  <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={k.warna} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={k.warna} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={jalur.area} fill={`url(#${idGrad})`} />
                <path d={jalur.garis} fill="none" stroke={k.warna} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          );
        })}
      </div>

      {/* ===== Baris 2: tren · segmen · kategori ===== */}
      <div
        className={`grid grid-cols-1 gap-[0.7em] ${
          penuh ? 'lg:grid-cols-[1.25fr_0.9fr_1fr] flex-[1.3] min-h-0' : 'lg:grid-cols-3 mb-[0.7em]'
        }`}
      >
        <div className={kartu()} style={gayaKartu}>
          <div className="flex items-start justify-between gap-[0.6em] shrink-0">
            <div>
              <h3 className="text-[0.92em] font-semibold">Tren Pendapatan Harian</h3>
              <p className="text-[0.75em]" style={{ color: W.teks3 }}>
                Minggu ini dibanding minggu lalu
              </p>
            </div>
            <span className="text-[0.75em] font-semibold" style={{ color: W.hijau }}>
              +29,9%
            </span>
          </div>
          <div ref={trenRef} className={penuh ? 'w-full flex-1 min-h-0' : 'w-full h-[9.5em]'} />
        </div>

        <div className={kartu()} style={gayaKartu}>
          <h3 className="text-[0.92em] font-semibold shrink-0">Pendapatan per Segmen</h3>
          <p className="text-[0.75em] shrink-0" style={{ color: W.teks3 }}>
            Porsi tiap jenis pelanggan
          </p>
          {/* Legenda di SAMPING cincin (bukan di bawah) supaya cincin dapat ruang
              penuh dan tampil lebih besar, seperti referensi. */}
          {/* Blok grafik mengisi SELURUH sisa tinggi kartu (absolute inset-0) supaya
              cincin benar-benar memakai ruang yang tersedia — tidak menyisakan
              ruang kosong di bawah. */}
          <div className="relative flex-1 min-h-[8.5em] mt-[0.2em]">
            <div className="absolute inset-0 flex items-stretch gap-[0.4em]">
              <div className="relative flex-[1.45] min-w-0">
                <div ref={segmenRef} className="w-full h-full" />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[0.9em] font-bold leading-none tabular-nums">Rp 245,6 jt</span>
                  <span className="text-[0.62em] mt-[0.1em]" style={{ color: W.teks3 }}>
                    Total
                  </span>
                </div>
              </div>
              <ul className="flex-1 min-w-0 self-center space-y-[0.5em]">
              {SEGMEN.map((r) => (
                <li key={r.nama} className="flex items-start gap-[0.35em] text-[0.7em]">
                  <span className="w-[0.5em] h-[0.5em] rounded-full shrink-0 mt-[0.3em]" style={{ backgroundColor: r.warna }} />
                  <div className="min-w-0">
                    <p className="truncate leading-tight" style={{ color: W.teks2 }}>
                      {r.nama}
                    </p>
                    <p className="tabular-nums leading-tight" style={{ color: W.teks3 }}>
                      {r.nominal} · {String(r.nilai).replace('.', ',')}%
                    </p>
                  </div>
                </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className={kartu()} style={gayaKartu}>
          <div className="flex items-start justify-between gap-[0.6em] shrink-0">
            <div>
              <h3 className="text-[0.92em] font-semibold">Kategori Pendapatan Teratas</h3>
              <p className="text-[0.75em]" style={{ color: W.teks3 }}>
                Nilai dan porsinya, satuan juta rupiah
              </p>
            </div>
            <Receipt className="w-[1.1em] h-[1.1em] shrink-0" style={{ color: W.emas }} />
          </div>
          <div ref={kategoriRef} className={penuh ? 'w-full flex-1 min-h-0' : 'w-full h-[9.5em]'} />
        </div>
      </div>

      {/* ===== Baris 3: 6 metrik ringkas ===== */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-[0.7em] ${penuh ? 'flex-[0.6] min-h-0' : 'mb-[0.7em]'}`}>
        {METRIK.map((m) => (
          <div key={m.label} className={`${kartu('justify-center gap-[0.3em] py-[0.75em]')}`} style={gayaKartu}>
            <div className="flex items-center gap-[0.3em] min-w-0">
              <m.Ikon className="w-[0.9em] h-[0.9em] shrink-0" style={{ color: m.warna }} />
              <span className="text-[0.64em] font-semibold uppercase tracking-wide truncate" style={{ color: W.teks3 }}>
                {m.label}
              </span>
            </div>
            <span className="text-[0.88em] font-bold leading-tight tabular-nums whitespace-nowrap">{m.nilai}</span>
            <span className="text-[0.66em] font-semibold leading-none" style={{ color: m.warna }}>
              {m.porsi}
            </span>
          </div>
        ))}
      </div>

      {/* ===== Baris 4: peta panas · metode bayar · tahun berjalan ===== */}
      <div
        className={`grid grid-cols-1 gap-[0.7em] ${
          penuh ? 'lg:grid-cols-[1.2fr_0.85fr_1fr] flex-[1.15] min-h-0' : 'lg:grid-cols-3'
        }`}
      >
        <div className={kartu()} style={gayaKartu}>
          <div className="flex items-start justify-between gap-[0.6em] shrink-0">
            <div>
              <h3 className="text-[0.92em] font-semibold">Peta Panas Pemakaian</h3>
              <p className="text-[0.75em]" style={{ color: W.teks3 }}>
                Hari × jam, indeks 0–100
              </p>
            </div>
            <CalendarDays className="w-[1.1em] h-[1.1em] shrink-0" style={{ color: W.teks3 }} />
          </div>
          <div ref={panasRef} className={penuh ? 'w-full flex-1 min-h-[7em]' : 'w-full h-[12.5em]'} />
        </div>

        <div className={kartu()} style={gayaKartu}>
          <h3 className="text-[0.92em] font-semibold shrink-0">Metode Pembayaran</h3>
          <p className="text-[0.75em] shrink-0" style={{ color: W.teks3 }}>
            Porsi nilai transaksi
          </p>
          <div className="relative flex-1 min-h-[7.5em] mt-[0.2em]">
            <div className="absolute inset-0 flex items-stretch gap-[0.4em]">
              <div className="relative flex-[1.35] min-w-0">
                <div ref={bayarRef} className="w-full h-full" />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[0.82em] font-bold leading-none tabular-nums">Rp 245,6 jt</span>
                  <span className="text-[0.6em] mt-[0.1em]" style={{ color: W.teks3 }}>
                    Total
                  </span>
                </div>
              </div>
              <ul className="flex-1 min-w-0 self-center space-y-[0.55em]">
                {PEMBAYARAN.map((r) => (
                  <li key={r.nama} className="flex items-start gap-[0.35em] text-[0.7em]">
                    <span className="w-[0.5em] h-[0.5em] rounded-full shrink-0 mt-[0.3em]" style={{ backgroundColor: r.warna }} />
                    <div className="min-w-0">
                      <p className="truncate leading-tight" style={{ color: W.teks2 }}>
                        {r.nama}
                      </p>
                      <p className="tabular-nums leading-tight" style={{ color: W.teks3 }}>
                        {r.nominal} · {String(r.nilai).replace('.', ',')}%
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className={kartu('gap-[0.4em]')} style={gayaKartu}>
          <div className="flex items-center justify-between shrink-0">
            <h3 className="text-[0.92em] font-semibold">Ringkasan Tahun Berjalan</h3>
            <span className="text-[0.68em]" style={{ color: W.teks3 }}>
              Jan–Mei 2025
            </span>
          </div>

          <div className="space-y-[0.45em]">
            {[
              { label: 'Pendapatan YTD', nilai: 'Rp 1.245,68 M', ket: 'naik 15,32% vs tahun lalu', warna: W.hijau },
              { label: 'Laba Kotor YTD', nilai: 'Rp 892,35 M', ket: 'margin 71,67%', warna: W.biru },
              { label: 'Laba Bersih YTD', nilai: 'Rp 356,78 M', ket: 'margin 28,67%', warna: W.ungu },
            ].map((b) => (
              <div key={b.label} className="flex items-center justify-between gap-[0.5em]">
                <div className="min-w-0">
                  <p className="text-[0.68em] uppercase tracking-wide truncate" style={{ color: W.teks3 }}>
                    {b.label}
                  </p>
                  <p className="text-[0.8em] tabular-nums" style={{ color: b.warna }}>
                    {b.ket}
                  </p>
                </div>
                <span className="text-[0.9em] font-bold tabular-nums shrink-0">{b.nilai}</span>
              </div>
            ))}
          </div>

          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={penuh ? 'w-full flex-1 min-h-[1.5em] mt-[0.2em]' : 'w-full h-[3em] mt-[0.2em]'} aria-hidden>
            <defs>
              <linearGradient id="kj-ytd" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={W.hijau} stopOpacity="0.38" />
                <stop offset="100%" stopColor={W.hijau} stopOpacity="0" />
              </linearGradient>
            </defs>
            {(() => {
              const j = jalurArea([42, 48, 45, 55, 58, 62, 60, 68, 72, 70, 78, 84]);
              return (
                <>
                  <path d={j.area} fill="url(#kj-ytd)" />
                  <path d={j.garis} fill="none" stroke={W.hijau} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                </>
              );
            })()}
          </svg>

          <div className="flex items-center justify-between text-[0.66em] shrink-0" style={{ color: W.teks3 }}>
            <span className="inline-flex items-center gap-[0.3em]">
              <Banknote className="w-[0.95em] h-[0.95em]" /> angka dihitung otomatis
            </span>
            <span className="inline-flex items-center gap-[0.3em]">
              <CircleDollarSign className="w-[0.95em] h-[0.95em]" /> contoh
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
