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
 * Dua mode pakai:
 * - `penuh` = false → dipakai di galeri template (tinggi mengikuti isi, ada jarak
 *   antar baris). Dipakai sebagai pratinjau di halaman.
 * - `penuh` = true  → dipakai MODE PRESENTASI: seluruh baris membagi tinggi layar
 *   (`flex-1`), grafik ikut memanjang, jadi tidak ada ruang kosong di bawah.
 *
 * Catatan penting: SELURUH ANGKA DI SINI CONTOH (dummy), bukan dari dokumen
 * instansi. Komponen ini hanya untuk pratinjau tampilan, tidak dipakai untuk
 * dashboard berisi data dokumen.
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

const TARGET = [
  { nama: 'Target Pendapatan', capai: 86, warna: WARNA.oranye },
  { nama: 'Efisiensi Beban', capai: 92, warna: WARNA.hijau },
  { nama: 'Target Laba Bersih', capai: 57, warna: WARNA.ungu },
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

interface DashboardReferensiProps {
  /**
   * true = isi seluruh tinggi wadah (mode presentasi / layar penuh): baris
   * dibagi dengan `flex-1` dan grafik memanjang, tidak ada ruang kosong.
   */
  penuh?: boolean;
}

export const DashboardReferensi: React.FC<DashboardReferensiProps> = ({ penuh = false }) => {
  // Interaksi tombol (dipakai juga oleh dashboard nyata nanti):
  // "Lihat semua" membuka seluruh transaksi, "Lihat Laporan Rinci" membuka
  // panel rincian. Keduanya hanya mengubah tampilan, tidak memanggil RAG.
  const [semuaTransaksi, setSemuaTransaksi] = useState(false);
  const [laporanRinci, setLaporanRinci] = useState(false);

  const barRef = useRef<HTMLDivElement | null>(null);
  const donutRef = useRef<HTMLDivElement | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    let batal = false;
    const dibuat: Array<{ dispose: () => void; resize: () => void }> = [];
    let pengamat: ResizeObserver | null = null;

    void loadEcharts().then((ec) => {
      if (batal) return;

      // ── Grafik batang pendapatan bulanan ──────────────────────────────────
      if (barRef.current) {
        const c = ec.init(barRef.current);
        const puncak = PENDAPATAN_BULANAN.indexOf(Math.max(...PENDAPATAN_BULANAN));
        c.setOption({
          grid: { left: 4, right: 8, top: 16, bottom: 2, containLabel: true },
          tooltip: {
            trigger: 'axis',
            backgroundColor: '#1f2126',
            borderColor: WARNA.garis,
            borderWidth: 1,
            padding: [6, 10],
            textStyle: { color: WARNA.teks, fontSize: 11 },
            formatter: (p: any) => {
              const d = p[0];
              return `<div style="font-size:10px;color:${WARNA.teks3}">${d.name} 2025</div><b>Rp ${String(d.value).replace('.', ',')} M</b>`;
            },
          },
          xAxis: {
            type: 'category',
            data: BULAN,
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: WARNA.teks3, fontSize: 10 },
          },
          yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: WARNA.garis, type: 'dashed' } },
            axisLabel: { color: WARNA.teks3, fontSize: 10, formatter: '{value} M' },
          },
          series: [
            {
              type: 'bar',
              data: PENDAPATAN_BULANAN.map((v, i) => ({
                value: v,
                itemStyle: {
                  color: i === puncak ? WARNA.oranye : 'rgba(255,138,31,0.34)',
                  borderRadius: [4, 4, 0, 0],
                },
              })),
              barWidth: '52%',
            },
          ],
        });
        dibuat.push(c);
      }

      // ── Cincin rincian beban ──────────────────────────────────────────────
      if (donutRef.current) {
        const c = ec.init(donutRef.current);
        c.setOption({
          tooltip: {
            trigger: 'item',
            backgroundColor: '#1f2126',
            borderColor: WARNA.garis,
            borderWidth: 1,
            textStyle: { color: WARNA.teks, fontSize: 11 },
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
              itemStyle: { borderColor: WARNA.kartu, borderWidth: 3, borderRadius: 4 },
              data: RINCIAN_BEBAN.map((r) => ({ name: r.nama, value: r.nilai, itemStyle: { color: r.warna } })),
            },
          ],
        });
        dibuat.push(c);
      }

      // ── Area arus kas ─────────────────────────────────────────────────────
      if (areaRef.current) {
        const c = ec.init(areaRef.current);
        c.setOption({
          grid: { left: 4, right: 6, top: 10, bottom: 2, containLabel: true },
          tooltip: {
            trigger: 'axis',
            backgroundColor: '#1f2126',
            borderColor: WARNA.garis,
            borderWidth: 1,
            textStyle: { color: WARNA.teks, fontSize: 11 },
            formatter: (p: any) => `<div style="font-size:10px;color:${WARNA.teks3}">Hari ${p[0].dataIndex + 1}</div><b>Rp ${String(p[0].value).replace('.', ',')} M</b>`,
          },
          xAxis: {
            type: 'category',
            boundaryGap: false,
            data: ARUS_KAS.map((_, i) => `${i + 1}`),
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: WARNA.teks3, fontSize: 9, interval: 6 },
          },
          yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: WARNA.garis, type: 'dashed' } },
            axisLabel: { color: WARNA.teks3, fontSize: 9, formatter: '{value} M' },
          },
          series: [
            {
              type: 'line',
              smooth: true,
              symbol: 'circle',
              symbolSize: 0,
              data: ARUS_KAS,
              lineStyle: { width: 2.5, color: WARNA.oranye },
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
        });
        dibuat.push(c);
      }

      pengamat = new ResizeObserver(() => dibuat.forEach((c) => c.resize()));
      [barRef, donutRef, areaRef].forEach((r) => r.current && pengamat?.observe(r.current));
    });

    return () => {
      batal = true;
      pengamat?.disconnect();
      dibuat.forEach((c) => c.dispose());
    };
  }, []);

  /** Kartu dasar: gelap, garis tipis, sudut 14px. `penuh` → mengisi tinggi baris. */
  const kartu = (tambahan = '') =>
    `rounded-[14px] p-3.5 ${penuh ? 'h-full flex flex-col min-h-0' : ''} ${tambahan}`;

  return (
    <div
      className={penuh ? 'h-full w-full flex flex-col gap-3 p-3 sm:p-4 overflow-hidden' : 'rounded-[18px] p-4 sm:p-6'}
      style={{ backgroundColor: WARNA.latar, color: WARNA.teks }}
    >
      {/* ===== Baris 1: 4 kartu KPI ===== */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${penuh ? 'flex-[0.95] min-h-0' : 'mb-3'}`}>
        {KPI.map((k) => {
          const naik = k.delta >= 0;
          const bagus = naik === k.naikBagus;
          const jalur = jalurSpark(k.seri);
          const warna = bagus ? WARNA.hijau : WARNA.merah;
          const idGrad = `grad-${k.label.replace(/\s+/g, '-')}`;
          return (
            <div key={k.label} className={kartu('gap-2')} style={{ backgroundColor: WARNA.kartu, border: `1px solid ${WARNA.garis}` }}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-medium leading-tight" style={{ color: WARNA.teks3 }}>
                  {k.label}
                </span>
                <span
                  className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full"
                  style={{ border: '1px solid rgba(255,138,31,0.35)', backgroundColor: 'rgba(255,138,31,0.10)', color: WARNA.oranye }}
                >
                  <k.Ikon className="w-3.5 h-3.5" />
                </span>
              </div>

              <div className="flex items-baseline gap-1 flex-wrap">
                <span className="text-[19px] font-bold leading-none tabular-nums tracking-tight">{k.nilai}</span>
                {k.satuan && (
                  <span className="text-[10px] font-medium" style={{ color: WARNA.teks3 }}>
                    {k.satuan}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                <span className="inline-flex items-center gap-0.5" style={{ color: warna }}>
                  {naik ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
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
                className={penuh ? 'w-full flex-1 min-h-[22px] mt-0.5' : 'w-full h-9 mt-0.5'}
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
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-3 ${penuh ? 'flex-[1.3] min-h-0' : 'mb-3'}`}>
        <div className={`lg:col-span-2 ${kartu()}`} style={{ backgroundColor: WARNA.kartu, border: `1px solid ${WARNA.garis}` }}>
          <div className="flex items-start justify-between gap-3 mb-1 shrink-0">
            <div>
              <h3 className="text-[12.5px] font-semibold">Ikhtisar Pendapatan</h3>
              <p className="text-[10.5px]" style={{ color: WARNA.teks3 }}>
                Pendapatan usaha per bulan, 2025
              </p>
            </div>
            <div className="text-right">
              <div className="text-[15px] font-bold leading-none tabular-nums">Rp 23,69 M</div>
              <div className="text-[10px] mt-0.5 inline-flex items-center gap-0.5" style={{ color: WARNA.hijau }}>
                <ArrowUpRight className="w-3 h-3" /> 8,2% vs 2024
              </div>
            </div>
          </div>
          <div ref={barRef} className={penuh ? 'w-full flex-1 min-h-0' : 'w-full h-[168px]'} />
        </div>

        <div className={kartu()} style={{ backgroundColor: WARNA.kartu, border: `1px solid ${WARNA.garis}` }}>
          <div className="shrink-0">
            <h3 className="text-[12.5px] font-semibold">Rincian Beban</h3>
            <p className="text-[10.5px]" style={{ color: WARNA.teks3 }}>
              Komposisi beban operasional
            </p>
          </div>
          <div className={penuh ? 'relative flex-1 min-h-0 mt-1' : 'relative mt-1'}>
            <div ref={donutRef} className={penuh ? 'w-full h-full' : 'w-full h-[132px]'} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[13px] font-bold leading-none tabular-nums">12,35 M</span>
              <span className="text-[9px] mt-0.5" style={{ color: WARNA.teks3 }}>
                Total
              </span>
            </div>
          </div>
          <ul className={`mt-1.5 space-y-1 shrink-0 ${penuh ? 'max-h-[46%] overflow-hidden' : ''}`}>
            {RINCIAN_BEBAN.map((r) => (
              <li key={r.nama} className="flex items-center gap-2 text-[10.5px]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.warna }} />
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
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-3 ${penuh ? 'flex-[1.05] min-h-0' : 'mb-3'}`}>
        <div className={kartu()} style={{ backgroundColor: WARNA.kartu, border: `1px solid ${WARNA.garis}` }}>
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h3 className="text-[12.5px] font-semibold">Transaksi Terbaru</h3>
            <button
              type="button"
              onClick={() => setSemuaTransaksi((v) => !v)}
              aria-expanded={semuaTransaksi}
              title={semuaTransaksi ? 'Ringkas daftar transaksi' : 'Tampilkan seluruh transaksi'}
              className="text-[10px] inline-flex items-center gap-0.5 rounded px-1 -mx-1 py-0.5 transition-colors hover:brightness-125 focus:outline-none focus-visible:ring-1 focus-visible:ring-current"
              style={{ color: WARNA.oranye }}
            >
              {semuaTransaksi ? 'Ringkas' : 'Lihat semua'} <ArrowRight className={`w-3 h-3 transition-transform ${semuaTransaksi ? 'rotate-90' : ''}`} />
            </button>
          </div>
          <ul className={`space-y-2 ${penuh ? 'flex-1 min-h-0 overflow-auto' : ''}`}>
            {(semuaTransaksi ? [...TRANSAKSI, ...TRANSAKSI_LAIN] : TRANSAKSI).map((t) => (
              <li key={t.nama} className="flex items-center gap-2.5">
                <span
                  className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full"
                  style={{ backgroundColor: WARNA.kartu2, color: t.naik ? WARNA.hijau : WARNA.merah }}
                >
                  <t.Ikon className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium truncate">{t.nama}</p>
                  <p className="text-[9.5px] truncate" style={{ color: WARNA.teks3 }}>
                    {t.ket}
                  </p>
                </div>
                <span className="text-[10.5px] font-semibold tabular-nums shrink-0" style={{ color: t.naik ? WARNA.hijau : WARNA.merah }}>
                  {t.nilai} jt
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className={kartu()} style={{ backgroundColor: WARNA.kartu, border: `1px solid ${WARNA.garis}` }}>
          <div className="flex items-start justify-between gap-2 mb-1 shrink-0">
            <div>
              <h3 className="text-[12.5px] font-semibold">Arus Kas</h3>
              <p className="text-[10.5px]" style={{ color: WARNA.teks3 }}>
                29 hari terakhir
              </p>
            </div>
            <span className="text-[10px] font-semibold" style={{ color: WARNA.hijau }}>
              +18,4%
            </span>
          </div>
          <div ref={areaRef} className={penuh ? 'w-full flex-1 min-h-0' : 'w-full h-[126px]'} />
        </div>

        <div className={kartu()} style={{ backgroundColor: WARNA.kartu, border: `1px solid ${WARNA.garis}` }}>
          <h3 className="text-[12.5px] font-semibold mb-2 shrink-0">Progres Target</h3>
          <ul className={`space-y-2.5 ${penuh ? 'flex-1 min-h-0 overflow-hidden' : ''}`}>
            {TARGET.map((t) => (
              <li key={t.nama}>
                <div className="flex items-center justify-between text-[10.5px] mb-1">
                  <span style={{ color: WARNA.teks2 }}>{t.nama}</span>
                  <span className="font-semibold tabular-nums">{t.capai}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: WARNA.kartu2 }}>
                  <div className="h-full rounded-full" style={{ width: `${t.capai}%`, backgroundColor: t.warna }} />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-2 text-[10px] shrink-0" style={{ color: WARNA.teks3 }}>
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: WARNA.hijau }} /> di atas target
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: WARNA.merah }} /> perlu perhatian
            </span>
          </div>
        </div>
      </div>

      {/* ===== Strip insight ===== */}
      <div
        className="rounded-[14px] p-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0"
        style={{ backgroundColor: WARNA.kartu, border: `1px solid ${WARNA.garis}` }}
      >
        <div className="min-w-0 flex items-start gap-2.5">
          <span
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-[10px]"
            style={{ background: `linear-gradient(135deg, ${WARNA.oranye}, #ffb347)`, color: '#1a1206' }}
          >
            <TrendingUp className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold">Insight Keuangan</p>
            <p className="text-[10.5px] leading-relaxed" style={{ color: WARNA.teks3 }}>
              Pendapatan tumbuh 8,2% sementara beban turun 3,4% — margin bersih naik ke 32,1%. Perhatian pada
              realisasi investasi yang baru 57% dari target.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setLaporanRinci(true)}
          title="Buka laporan rinci (angka contoh)"
          className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[11px] font-bold shrink-0 transition-transform hover:-translate-y-px hover:brightness-105 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          style={{ background: `linear-gradient(135deg, ${WARNA.oranye}, #ffa53d)`, color: '#1a1206' }}
        >
          Lihat Laporan Rinci
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ===== Panel Laporan Rinci (dibuka tombol di atas) ===== */}
      {laporanRinci && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}
          onClick={() => setLaporanRinci(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Laporan rinci"
        >
          <div
            className="w-full max-w-[760px] max-h-[88vh] overflow-auto rounded-[16px] p-4 sm:p-5"
            style={{ backgroundColor: WARNA.kartu, border: `1px solid ${WARNA.garis}`, color: WARNA.teks }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-[14px] font-bold leading-tight">Laporan Rinci Keuangan</h3>
                <p className="text-[10.5px] mt-0.5" style={{ color: WARNA.teks3 }}>
                  Periode Mei 2025 · angka contoh (bukan data dokumen)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLaporanRinci(false)}
                title="Tutup (Esc)"
                aria-label="Tutup laporan"
                className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors hover:brightness-125"
                style={{ border: `1px solid ${WARNA.garis}`, color: WARNA.teks2 }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Ringkasan KPI */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {KPI.map((k) => (
                <div key={k.label} className="rounded-[10px] p-2.5" style={{ backgroundColor: WARNA.kartu2 }}>
                  <p className="text-[9.5px] leading-tight" style={{ color: WARNA.teks3 }}>
                    {k.label}
                  </p>
                  <p className="text-[13px] font-bold tabular-nums mt-1">{k.nilai}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: k.delta >= 0 === k.naikBagus ? WARNA.hijau : WARNA.merah }}>
                    {k.delta >= 0 ? '+' : ''}
                    {String(k.delta).replace('.', ',')}% {k.deltaTeks}
                  </p>
                </div>
              ))}
            </div>

            {/* Rincian beban */}
            <p className="text-[11.5px] font-semibold mb-1.5">Rincian Beban Operasional</p>
            <table className="w-full text-[10.5px] mb-4">
              <thead>
                <tr style={{ color: WARNA.teks3 }}>
                  <th className="text-left font-medium pb-1">Komponen</th>
                  <th className="text-right font-medium pb-1">Porsi</th>
                  <th className="text-right font-medium pb-1">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {RINCIAN_BEBAN.map((r) => (
                  <tr key={r.nama} style={{ borderTop: `1px solid ${WARNA.garis}` }}>
                    <td className="py-1.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.warna }} />
                        {r.nama}
                      </span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{String(r.nilai).replace('.', ',')}%</td>
                    <td className="py-1.5 text-right tabular-nums font-semibold">
                      {((12347 * r.nilai) / 100 / 1000).toFixed(2).replace('.', ',')} M
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Transaksi lengkap */}
            <p className="text-[11.5px] font-semibold mb-1.5">Transaksi Terbaru</p>
            <ul className="space-y-1.5">
              {[...TRANSAKSI, ...TRANSAKSI_LAIN].map((t) => (
                <li key={t.nama} className="flex items-center justify-between gap-2 text-[10.5px]" style={{ borderTop: `1px solid ${WARNA.garis}` }}>
                  <span className="py-1.5">
                    {t.nama} <span style={{ color: WARNA.teks3 }}>· {t.ket}</span>
                  </span>
                  <span className="tabular-nums font-semibold shrink-0" style={{ color: t.naik ? WARNA.hijau : WARNA.merah }}>
                    {t.nilai} jt
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => setLaporanRinci(false)}
                className="rounded-[10px] px-3 py-1.5 text-[11px] font-bold"
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
