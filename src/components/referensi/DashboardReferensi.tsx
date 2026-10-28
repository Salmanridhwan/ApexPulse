import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CreditCard,
  Droplets,
  Landmark,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { loadEcharts } from '../widgets/echartsSetup';

/**
 * DASHBOARD REFERENSI — replika tampilan acuan pemilik produk.
 *
 * Referensi: dashboard keuangan "gelap + satu aksen oranye" — 4 kartu KPI
 * (ikon bulat + sparkline), grafik batang pendapatan, cincin rincian beban
 * dengan daftar legenda, daftar transaksi, grafik area arus kas, batang progres
 * target, dan strip insight di bawah.
 *
 * UKURAN RESPONSIF
 * Semua ukuran di dalam komponen ini memakai satuan `em`, dan ukuran huruf akar
 * dihitung dari besar wadah (`skala`). Jadi di layar 1920 teks ikut membesar
 * (tidak terasa kecil), sementara di 1366 tetap terbaca. Grafik ECharts memakai
 * `skala` yang sama untuk ukuran huruf sumbu, ketebalan garis, dan lebar batang.
 *
 * Dua mode pakai:
 * - `penuh` = false → galeri template (tinggi mengikuti isi).
 * - `penuh` = true  → MODE PRESENTASI: baris membagi tinggi layar, grafik
 *   memanjang, tanpa ruang kosong.
 *
 * Catatan: SELURUH ANGKA DI SINI CONTOH (dummy), bukan dari dokumen instansi.
 */

const WARNA = {
  latar: '#0a0a0b',
  kartu: '#141518',
  kartu2: '#1b1d21',
  garis: '#26282d',
  teks: '#f5f6f7',
  teks2: '#b7bdc6',
  teks3: '#8b929c',
  oranye: '#ff8a1f',
  hijau: '#22c55e',
  merah: '#ef4444',
  teal: '#2dd4bf',
  ungu: '#a78bfa',
  kuning: '#f5a524',
};

interface Kpi {
  label: string;
  nilai: string;
  satuan?: string;
  delta: number;
  deltaTeks: string;
  naikBagus: boolean;
  seri: number[];
  Ikon: React.ComponentType<{ className?: string }>;
}

const KPI: Kpi[] = [
  {
    label: 'Total Saldo Kas',
    nilai: '48.750',
    satuan: 'juta Rp',
    delta: 12.4,
    deltaTeks: 'vs bulan lalu',
    naikBagus: true,
    seri: [30, 32, 31, 36, 38, 41, 44, 43, 46, 48.7],
    Ikon: Wallet,
  },
  {
    label: 'Pendapatan Usaha',
    nilai: '23.685',
    satuan: 'juta Rp',
    delta: 8.2,
    deltaTeks: 'vs bulan lalu',
    naikBagus: true,
    seri: [16, 17, 18.5, 18, 20, 21, 22.4, 22, 23, 23.7],
    Ikon: TrendingUp,
  },
  {
    label: 'Beban Operasional',
    nilai: '12.347',
    satuan: 'juta Rp',
    delta: -3.4,
    deltaTeks: 'vs bulan lalu',
    naikBagus: false,
    seri: [15, 14.6, 14.8, 14, 13.6, 13.9, 13.2, 12.9, 12.6, 12.35],
    Ikon: TrendingDown,
  },
  {
    label: 'Laba Bersih',
    nilai: '11.337',
    satuan: 'juta Rp',
    delta: 6.1,
    deltaTeks: 'vs bulan lalu',
    naikBagus: true,
    seri: [8, 8.4, 9, 8.8, 9.6, 10, 10.4, 10.6, 11, 11.34],
    Ikon: PiggyBank,
  },
];

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const PENDAPATAN_BULANAN = [14.2, 15.6, 16.1, 17.4, 19.8, 18.6, 20.2, 21.1, 20.4, 22.3, 23.0, 23.7];

const RINCIAN_BEBAN = [
  { nama: 'Operasional', nilai: 25.9, warna: WARNA.oranye },
  { nama: 'Pemeliharaan', nilai: 23.1, warna: WARNA.teal },
  { nama: 'Pegawai', nilai: 19.8, warna: WARNA.ungu },
  { nama: 'Investasi', nilai: 17.0, warna: WARNA.kuning },
  { nama: 'Lain-lain', nilai: 14.2, warna: WARNA.merah },
];

const ARUS_KAS = [3.2, 3.6, 3.4, 4.1, 4.6, 4.3, 5.0, 5.4, 5.1, 5.8, 6.2, 5.9, 6.4, 6.9, 6.6, 7.2, 7.6, 7.3, 7.9, 8.4, 8.1, 8.7, 9.1, 8.8, 9.4, 9.8, 9.5, 10.1, 10.6];

const TRANSAKSI = [
  { nama: 'Pembayaran pelanggan', ket: 'Wilayah Jakarta Selatan', nilai: '+1,24', naik: true, Ikon: Droplets },
  { nama: 'Pemeliharaan jaringan', ket: 'Zona 3 · vendor', nilai: '-486', naik: false, Ikon: CreditCard },
  { nama: 'Setoran kas ke bank', ket: 'Rekening operasional', nilai: '+2,10', naik: true, Ikon: Landmark },
  { nama: 'Gaji & tunjangan', ket: 'Periode Mei 2025', nilai: '-3,72', naik: false, Ikon: Wallet },
];

const TRANSAKSI_LAIN = [
  { nama: 'Pembelian bahan kimia', ket: 'Instalasi pengolahan', nilai: '-214', naik: false, Ikon: CreditCard },
  { nama: 'Tagihan listrik', ket: 'Pompa & IPA', nilai: '-1,08', naik: false, Ikon: Wallet },
  { nama: 'Pendapatan sambungan baru', ket: 'Wilayah Jakarta Barat', nilai: '+3,46', naik: true, Ikon: Droplets },
  { nama: 'Bagi hasil kas daerah', ket: 'Setoran triwulan I', nilai: '+1,75', naik: true, Ikon: Landmark },
];

/**
 * Progres target. Warna batang = status capaian, dan statusnya ditulis di
 * bawah tiap batang supaya tidak ada legenda yang menggantung tanpa pasangan.
 */
const TARGET = [
  { nama: 'Target Pendapatan', capai: 86, status: 'mendekati target', warna: WARNA.oranye },
  { nama: 'Efisiensi Beban', capai: 92, status: 'sesuai target', warna: WARNA.hijau },
  { nama: 'Target Laba Bersih', capai: 57, status: 'perlu perhatian', warna: WARNA.merah },
];

/** Jalur SVG sparkline (viewBox 0..100) — area + garis, seperti referensi. */
const jalurSpark = (seri: number[]) => {
  const min = Math.min(...seri);
  const max = Math.max(...seri);
  const span = max - min || 1;
  const titik = seri.map((v, i) => {
    const x = (i / (seri.length - 1)) * 100;
    const y = 100 - ((v - min) / span) * 88 - 6;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return {
    garis: `M${titik.join('L')}`,
    area: `M0,100L${titik.join('L')}L100,100Z`,
  };
};

/** Gaya dasar grafik: huruf, garis, dan padding ikut `skala` (em setara). */
const gayaDasar = (s: number) => ({
  tooltip: {
    backgroundColor: '#1f2126',
    borderColor: WARNA.garis,
    borderWidth: 1,
    padding: [6 * s, 10 * s],
    textStyle: { color: WARNA.teks, fontSize: 11 * s },
  },
  sumbu: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: WARNA.teks3, fontSize: 10 * s },
  },
});

const opsiBar = (s: number) => {
  const puncak = PENDAPATAN_BULANAN.indexOf(Math.max(...PENDAPATAN_BULANAN));
  const dasar = gayaDasar(s);
  return {
    grid: { left: 4, right: 8, top: 14 * s, bottom: 2, containLabel: true },
    tooltip: {
      ...dasar.tooltip,
      trigger: 'axis',
      formatter: (p: any) => {
        const d = p[0];
        return `<div style="font-size:${10 * s}px;color:${WARNA.teks3}">${d.name} 2025</div><b>Rp ${String(d.value).replace('.', ',')} M</b>`;
      },
    },
    xAxis: { type: 'category', data: BULAN, ...dasar.sumbu },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: WARNA.garis, type: 'dashed' } },
      axisLabel: { color: WARNA.teks3, fontSize: 10 * s, formatter: '{value} M' },
    },
    series: [
      {
        type: 'bar',
        data: PENDAPATAN_BULANAN.map((v, i) => ({
          value: v,
          itemStyle: {
            color: i === puncak ? WARNA.oranye : 'rgba(255,138,31,0.34)',
            borderRadius: [4 * s, 4 * s, 0, 0],
          },
        })),
        // Batang dibatasi lebarnya supaya tidak melebar aneh di layar ultrawide.
        barMaxWidth: 26 * s,
        barWidth: '46%',
      },
    ],
  };
};

const opsiDonat = (s: number) => ({
  tooltip: {
    ...gayaDasar(s).tooltip,
    trigger: 'item',
    formatter: (p: any) => `${p.name}: <b>${p.value}%</b>`,
  },
  series: [
    {
      type: 'pie',
      radius: ['62%', '92%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: false,
      label: { show: false },
      labelLine: { show: false },
      itemStyle: { borderColor: WARNA.kartu, borderWidth: 3 * s, borderRadius: 4 * s },
      data: RINCIAN_BEBAN.map((r) => ({ name: r.nama, value: r.nilai, itemStyle: { color: r.warna } })),
    },
  ],
});

const opsiArea = (s: number) => {
  const dasar = gayaDasar(s);
  return {
    grid: { left: 4, right: 6, top: 10 * s, bottom: 2, containLabel: true },
    tooltip: {
      ...dasar.tooltip,
      trigger: 'axis',
      formatter: (p: any) => `<div style="font-size:${10 * s}px;color:${WARNA.teks3}">Hari ${p[0].dataIndex + 1}</div><b>Rp ${String(p[0].value).replace('.', ',')} M</b>`,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ARUS_KAS.map((_, i) => `${i + 1}`),
      ...dasar.sumbu,
      axisLabel: { color: WARNA.teks3, fontSize: 9 * s, interval: 6 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: WARNA.garis, type: 'dashed' } },
      axisLabel: { color: WARNA.teks3, fontSize: 9 * s, formatter: '{value} M' },
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 0,
        data: ARUS_KAS,
        lineStyle: { width: 2.5 * s, color: WARNA.oranye },
        itemStyle: { color: WARNA.oranye },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(255,138,31,0.42)' },
              { offset: 1, color: 'rgba(255,138,31,0.02)' },
            ],
          },
        },
      },
    ],
  };
};

interface DashboardReferensiProps {
  /**
   * true = isi seluruh tinggi wadah (mode presentasi / layar penuh): baris
   * dibagi dengan `flex-1` dan grafik memanjang, tidak ada ruang kosong.
   */
  penuh?: boolean;
}

export const DashboardReferensi: React.FC<DashboardReferensiProps> = ({ penuh = false }) => {
  // Interaksi tombol: "Lihat semua" membuka seluruh transaksi, "Lihat Laporan
  // Rinci" membuka panel rincian. Keduanya hanya mengubah tampilan.
  const [semuaTransaksi, setSemuaTransaksi] = useState(false);
  const [laporanRinci, setLaporanRinci] = useState(false);

  /**
   * `skala` = besar huruf akar (em). Dihitung dari ukuran wadah supaya seluruh
   * isi ikut membesar di layar besar, tanpa mengubah tata letak baris.
   */
  const [skala, setSkala] = useState(1);

  const akarRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const donutRef = useRef<HTMLDivElement | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
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

  // Gambar ulang grafik saat skala berubah (huruf & tebal garis ikut menyesuaikan).
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

      ambil('bar', barRef.current)?.setOption(opsiBar(skala), true);
      ambil('donut', donutRef.current)?.setOption(opsiDonat(skala), true);
      ambil('area', areaRef.current)?.setOption(opsiArea(skala), true);

      pengamat = new ResizeObserver(() => {
        Object.values(instans.current).forEach((c: any) => c?.resize?.());
      });
      [barRef, donutRef, areaRef].forEach((r) => r.current && pengamat?.observe(r.current));
    });

    return () => {
      batal = true;
      pengamat?.disconnect();
    };
  }, [skala]);

  // Bersihkan grafik saat komponen dilepas.
  useEffect(
    () => () => {
      Object.values(instans.current).forEach((c: any) => c?.dispose?.());
      instans.current = {};
    },
    [],
  );

  // Esc menutup panel rincian.
  useEffect(() => {
    if (!laporanRinci) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setLaporanRinci(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [laporanRinci]);

  /** Kartu dasar: gelap, garis tipis, sudut membulat (ikut skala). */
  const kartu = (tambahan = '') =>
    `rounded-[1.1em] p-[0.95em] ${penuh ? 'h-full flex flex-col min-h-0' : ''} ${tambahan}`;

  return (
    <div
      ref={akarRef}
      className={
        penuh
          ? 'h-full w-full flex flex-col gap-[0.8em] p-[0.85em] overflow-hidden'
          : 'rounded-[1.4em] p-[1.2em]'
      }
      style={{ backgroundColor: WARNA.latar, color: WARNA.teks, fontSize: `${(13 * skala).toFixed(2)}px` }}
    >
      {/* ===== Baris 1: 4 kartu KPI ===== */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-[0.8em] ${penuh ? 'flex-[0.95] min-h-0' : 'mb-[0.8em]'}`}>
        {KPI.map((k) => {
          const naik = k.delta >= 0;
          const bagus = naik === k.naikBagus;
          const jalur = jalurSpark(k.seri);
          const warna = bagus ? WARNA.hijau : WARNA.merah;
          const idGrad = `grad-${k.label.replace(/\s+/g, '-')}`;
          return (
            <div key={k.label} className={kartu('gap-[0.55em]')} style={{ backgroundColor: WARNA.kartu, border: `1px solid ${WARNA.garis}` }}>
              <div className="flex items-start justify-between gap-[0.5em]">
                <span className="text-[0.82em] font-medium leading-tight" style={{ color: WARNA.teks3 }}>
                  {k.label}
                </span>
                <span
                  className="shrink-0 inline-flex items-center justify-center w-[2em] h-[2em] rounded-full"
                  style={{ border: '1px solid rgba(255,138,31,0.35)', backgroundColor: 'rgba(255,138,31,0.10)', color: WARNA.oranye }}
                >
                  <k.Ikon className="w-[1em] h-[1em]" />
                </span>
              </div>

              <div className="flex items-baseline gap-[0.35em] flex-wrap">
                <span className="text-[1.55em] font-bold leading-none tabular-nums tracking-tight">{k.nilai}</span>
                {k.satuan && (
                  <span className="text-[0.72em] font-medium" style={{ color: WARNA.teks3 }}>
                    {k.satuan}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-[0.4em] text-[0.76em] font-semibold">
                <span className="inline-flex items-center gap-[0.15em]" style={{ color: warna }}>
                  {naik ? <ArrowUpRight className="w-[1em] h-[1em]" /> : <ArrowDownRight className="w-[1em] h-[1em]" />}
                  {naik ? '+' : ''}
                  {String(k.delta).replace('.', ',')}%
                </span>
                <span className="font-normal" style={{ color: WARNA.teks3 }}>
                  {k.deltaTeks}
                </span>
              </div>

              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className={penuh ? 'w-full flex-1 min-h-[1.6em] mt-[0.3em]' : 'w-full h-[2.6em] mt-[0.3em]'}
                aria-hidden
              >
                <defs>
                  <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={warna} stopOpacity="0.42" />
                    <stop offset="100%" stopColor={warna} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={jalur.area} fill={`url(#${idGrad})`} />
                <path d={jalur.garis} fill="none" stroke={warna} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          );
        })}
      </div>

      {/* ===== Baris 2: grafik batang + cincin ===== */}
      <div
        className={`grid grid-cols-1 gap-[0.8em] ${
          penuh ? 'lg:grid-cols-[1.55fr_1fr] flex-[1.3] min-h-0' : 'lg:grid-cols-3 mb-[0.8em]'
        }`}
      >
        <div className={`${penuh ? '' : 'lg:col-span-2'} ${kartu()}`} style={{ backgroundColor: WARNA.kartu, border: `1px solid ${WARNA.garis}` }}>
          <div className="flex items-start justify-between gap-[0.7em] mb-[0.3em] shrink-0">
            <div>
              <h3 className="text-[0.98em] font-semibold">Ikhtisar Pendapatan</h3>
              <p className="text-[0.8em]" style={{ color: WARNA.teks3 }}>
                Pendapatan usaha per bulan, 2025
              </p>
            </div>
            <div className="text-right">
              <div className="text-[1.15em] font-bold leading-none tabular-nums">Rp 23,69 M</div>
              <div className="text-[0.78em] mt-[0.2em] inline-flex items-center gap-[0.15em]" style={{ color: WARNA.hijau }}>
                <ArrowUpRight className="w-[0.95em] h-[0.95em]" /> 8,2% vs 2024
              </div>
            </div>
          </div>
          <div ref={barRef} className={penuh ? 'w-full flex-1 min-h-0' : 'w-full h-[10.5em]'} />
        </div>

        <div className={kartu()} style={{ backgroundColor: WARNA.kartu, border: `1px solid ${WARNA.garis}` }}>
          <div className="shrink-0">
            <h3 className="text-[0.98em] font-semibold">Rincian Beban</h3>
            <p className="text-[0.8em]" style={{ color: WARNA.teks3 }}>
              Komposisi beban operasional
            </p>
          </div>
          <div className={penuh ? 'relative flex-1 min-h-0 mt-[0.3em]' : 'relative mt-[0.3em]'}>
            <div ref={donutRef} className={penuh ? 'w-full h-full' : 'w-full h-[8.2em]'} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[1em] font-bold leading-none tabular-nums">12,35 M</span>
              <span className="text-[0.7em] mt-[0.15em]" style={{ color: WARNA.teks3 }}>
                Total
              </span>
            </div>
          </div>
          <ul className={`mt-[0.5em] space-y-[0.35em] shrink-0 ${penuh ? 'max-h-[46%] overflow-hidden' : ''}`}>
            {RINCIAN_BEBAN.map((r) => (
              <li key={r.nama} className="flex items-center gap-[0.55em] text-[0.8em]">
                <span className="w-[0.55em] h-[0.55em] rounded-full shrink-0" style={{ backgroundColor: r.warna }} />
                <span className="flex-1 truncate" style={{ color: WARNA.teks2 }}>
                  {r.nama}
                </span>
                <span className="tabular-nums font-semibold" style={{ color: WARNA.teks }}>
                  {String(r.nilai).replace('.', ',')}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ===== Baris 3: transaksi + arus kas + target ===== */}
      <div
        className={`grid grid-cols-1 gap-[0.8em] ${
          penuh ? 'lg:grid-cols-[1fr_1.05fr_0.95fr] flex-[1.05] min-h-0' : 'lg:grid-cols-3 mb-[0.8em]'
        }`}
      >
        <div className={kartu()} style={{ backgroundColor: WARNA.kartu, border: `1px solid ${WARNA.garis}` }}>
          <div className="flex items-center justify-between mb-[0.6em] shrink-0">
            <h3 className="text-[0.98em] font-semibold">Transaksi Terbaru</h3>
            <button
              type="button"
              onClick={() => setSemuaTransaksi((v) => !v)}
              aria-expanded={semuaTransaksi}
              title={semuaTransaksi ? 'Ringkas daftar transaksi' : 'Tampilkan seluruh transaksi'}
              className="text-[0.76em] inline-flex items-center gap-[0.2em] rounded px-[0.3em] -mx-[0.3em] py-[0.1em] transition-colors hover:brightness-125 focus:outline-none focus-visible:ring-1 focus-visible:ring-current"
              style={{ color: WARNA.oranye }}
            >
              {semuaTransaksi ? 'Ringkas' : 'Lihat semua'}
              <ArrowRight className={`w-[0.95em] h-[0.95em] transition-transform ${semuaTransaksi ? 'rotate-90' : ''}`} />
            </button>
          </div>
          <ul className={`space-y-[0.55em] ${penuh ? 'flex-1 min-h-0 overflow-auto gulir-tema pr-[0.2em]' : ''}`}>
            {(semuaTransaksi ? [...TRANSAKSI, ...TRANSAKSI_LAIN] : TRANSAKSI).map((t) => (
              <li key={t.nama} className="flex items-center gap-[0.6em]">
                <span
                  className="shrink-0 inline-flex items-center justify-center w-[2em] h-[2em] rounded-full"
                  style={{ backgroundColor: WARNA.kartu2, color: t.naik ? WARNA.hijau : WARNA.merah }}
                >
                  <t.Ikon className="w-[1em] h-[1em]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.84em] font-medium truncate">{t.nama}</p>
                  <p className="text-[0.74em] truncate" style={{ color: WARNA.teks3 }}>
                    {t.ket}
                  </p>
                </div>
                <span className="text-[0.8em] font-semibold tabular-nums shrink-0" style={{ color: t.naik ? WARNA.hijau : WARNA.merah }}>
                  {t.nilai} jt
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className={kartu()} style={{ backgroundColor: WARNA.kartu, border: `1px solid ${WARNA.garis}` }}>
          <div className="flex items-start justify-between gap-[0.5em] mb-[0.3em] shrink-0">
            <div>
              <h3 className="text-[0.98em] font-semibold">Arus Kas</h3>
              <p className="text-[0.8em]" style={{ color: WARNA.teks3 }}>
                29 hari terakhir
              </p>
            </div>
            <span className="text-[0.78em] font-semibold" style={{ color: WARNA.hijau }}>
              +18,4%
            </span>
          </div>
          <div ref={areaRef} className={penuh ? 'w-full flex-1 min-h-0' : 'w-full h-[8em]'} />
        </div>

        <div className={kartu()} style={{ backgroundColor: WARNA.kartu, border: `1px solid ${WARNA.garis}` }}>
          <h3 className="text-[0.98em] font-semibold mb-[0.6em] shrink-0">Progres Target</h3>
          <ul className={`space-y-[0.7em] ${penuh ? 'flex-1 min-h-0 overflow-hidden' : ''}`}>
            {TARGET.map((t) => (
              <li key={t.nama}>
                <div className="flex items-center justify-between text-[0.8em] mb-[0.3em]">
                  <span style={{ color: WARNA.teks2 }}>{t.nama}</span>
                  <span className="font-semibold tabular-nums">{t.capai}%</span>
                </div>
                <div className="h-[0.42em] rounded-full overflow-hidden" style={{ backgroundColor: WARNA.kartu2 }}>
                  <div className="h-full rounded-full" style={{ width: `${t.capai}%`, backgroundColor: t.warna }} />
                </div>
                <div className="flex items-center gap-[0.3em] mt-[0.25em] text-[0.72em]" style={{ color: t.warna }}>
                  <span className="w-[0.4em] h-[0.4em] rounded-full shrink-0" style={{ backgroundColor: t.warna }} />
                  {t.status}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ===== Strip insight ===== */}
      <div
        className="rounded-[1.1em] p-[0.95em] flex flex-wrap items-center justify-between gap-[0.7em] shrink-0"
        style={{ backgroundColor: WARNA.kartu, border: `1px solid ${WARNA.garis}` }}
      >
        <div className="min-w-0 flex items-start gap-[0.6em]">
          <span
            className="shrink-0 inline-flex items-center justify-center w-[2.2em] h-[2.2em] rounded-[0.75em]"
            style={{ background: `linear-gradient(135deg, ${WARNA.oranye}, #ffb347)`, color: '#1a1206' }}
          >
            <TrendingUp className="w-[1.05em] h-[1.05em]" />
          </span>
          <div className="min-w-0">
            <p className="text-[0.92em] font-semibold">Insight Keuangan</p>
            <p className="text-[0.8em] leading-relaxed" style={{ color: WARNA.teks3 }}>
              Pendapatan tumbuh 8,2% sementara beban turun 3,4% — margin bersih naik ke 32,1%. Perhatian pada
              realisasi investasi yang baru 57% dari target.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setLaporanRinci(true)}
          title="Buka laporan rinci (angka contoh)"
          className="inline-flex items-center gap-[0.35em] rounded-[0.75em] px-[0.9em] py-[0.4em] text-[0.82em] font-bold shrink-0 transition-transform hover:-translate-y-px hover:brightness-105 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          style={{ background: `linear-gradient(135deg, ${WARNA.oranye}, #ffa53d)`, color: '#1a1206' }}
        >
          Lihat Laporan Rinci
          <ArrowRight className="w-[0.95em] h-[0.95em]" />
        </button>
      </div>

      {/* ===== Panel Laporan Rinci ===== */}
      {laporanRinci && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-[0.8em]"
          style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}
          onClick={() => setLaporanRinci(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Laporan rinci"
        >
          <div
            className="w-full max-w-[46em] max-h-[88vh] overflow-auto gulir-tema rounded-[1.2em] p-[1.1em]"
            style={{ backgroundColor: WARNA.kartu, border: `1px solid ${WARNA.garis}`, color: WARNA.teks }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-[0.7em] mb-[0.8em]">
              <div>
                <h3 className="text-[1.05em] font-bold leading-tight">Laporan Rinci Keuangan</h3>
                <p className="text-[0.78em] mt-[0.15em]" style={{ color: WARNA.teks3 }}>
                  Periode Mei 2025 · angka contoh (bukan data dokumen)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLaporanRinci(false)}
                title="Tutup (Esc)"
                aria-label="Tutup laporan"
                className="shrink-0 inline-flex items-center justify-center w-[1.9em] h-[1.9em] rounded-full transition-colors hover:brightness-125"
                style={{ border: `1px solid ${WARNA.garis}`, color: WARNA.teks2 }}
              >
                <X className="w-[1em] h-[1em]" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-[0.5em] mb-[1em]">
              {KPI.map((k) => (
                <div key={k.label} className="rounded-[0.7em] p-[0.6em]" style={{ backgroundColor: WARNA.kartu2 }}>
                  <p className="text-[0.72em] leading-tight" style={{ color: WARNA.teks3 }}>
                    {k.label}
                  </p>
                  <p className="text-[1em] font-bold tabular-nums mt-[0.25em]">{k.nilai}</p>
                  <p className="text-[0.7em] mt-[0.15em]" style={{ color: (k.delta >= 0) === k.naikBagus ? WARNA.hijau : WARNA.merah }}>
                    {k.delta >= 0 ? '+' : ''}
                    {String(k.delta).replace('.', ',')}% {k.deltaTeks}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-[0.88em] font-semibold mb-[0.4em]">Rincian Beban Operasional</p>
            <table className="w-full text-[0.8em] mb-[1em]">
              <thead>
                <tr style={{ color: WARNA.teks3 }}>
                  <th className="text-left font-medium pb-[0.3em]">Komponen</th>
                  <th className="text-right font-medium pb-[0.3em]">Porsi</th>
                  <th className="text-right font-medium pb-[0.3em]">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {RINCIAN_BEBAN.map((r) => (
                  <tr key={r.nama} style={{ borderTop: `1px solid ${WARNA.garis}` }}>
                    <td className="py-[0.35em]">
                      <span className="inline-flex items-center gap-[0.4em]">
                        <span className="w-[0.5em] h-[0.5em] rounded-full" style={{ backgroundColor: r.warna }} />
                        {r.nama}
                      </span>
                    </td>
                    <td className="py-[0.35em] text-right tabular-nums">{String(r.nilai).replace('.', ',')}%</td>
                    <td className="py-[0.35em] text-right tabular-nums font-semibold">
                      {((12347 * r.nilai) / 100 / 1000).toFixed(2).replace('.', ',')} M
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-[0.88em] font-semibold mb-[0.4em]">Transaksi Terbaru</p>
            <ul className="space-y-[0.35em]">
              {[...TRANSAKSI, ...TRANSAKSI_LAIN].map((t) => (
                <li key={t.nama} className="flex items-center justify-between gap-[0.5em] text-[0.8em]" style={{ borderTop: `1px solid ${WARNA.garis}` }}>
                  <span className="py-[0.35em]">
                    {t.nama} <span style={{ color: WARNA.teks3 }}>· {t.ket}</span>
                  </span>
                  <span className="tabular-nums font-semibold shrink-0" style={{ color: t.naik ? WARNA.hijau : WARNA.merah }}>
                    {t.nilai} jt
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex justify-end mt-[1em]">
              <button
                type="button"
                onClick={() => setLaporanRinci(false)}
                className="rounded-[0.7em] px-[0.9em] py-[0.4em] text-[0.82em] font-bold"
                style={{ background: `linear-gradient(135deg, ${WARNA.oranye}, #ffa53d)`, color: '#1a1206' }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
