import type { WidgetStyle } from '../../types';
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
import { BarisGeser } from './BarisGeser';
import { gayaReplika } from './gayaReplika';
import { buildOpsi } from '../../services/chart/chartDefault';
import { WidgetChart } from '../widgets/WidgetChart';
import { labelHarian } from '../../services/chart/labelTanggal';
import { KartuSumber, PitaSumber } from './KartuSumber';
import type { SumberDok } from '../../services/templates/nilaiOperasional';
import { latarGelap, temaKartu } from '../widgets/widgetCardTheme';
import type { NilaiBeban, NilaiTemplate, NilaiTransaksi, NilaiTarget } from '../../services/templates/nilaiTemplate';
import type { TataLetakBaris } from '../../types';

/**
 * DASHBOARD REFERENSI — replika tampilan acuan pemilik produk.
 *
 * Referensi: dashboard keuangan "gelap + satu aksen oranye" — 4 kartu KPI_CONTOH
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

const INSIGHT_CONTOH =
  'Pendapatan tumbuh 8,2% sementara beban turun 3,4% — margin bersih naik ke 32,1%. Perhatian pada realisasi investasi yang baru 57% dari target.';
let INSIGHT = INSIGHT_CONTOH;

/** Ikon cadangan bila nilai dari dokumen tidak menyebut ikon. */
const IKON_KPI = [Wallet, TrendingUp, TrendingDown, PiggyBank];

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

let KPI: Kpi[];
const KPI_CONTOH: Kpi[] = [
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

let BULAN: string[];
const BULAN_CONTOH = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
let PENDAPATAN_BULANAN: number[];
const PENDAPATAN_CONTOH = [14.2, 15.6, 16.1, 17.4, 19.8, 18.6, 20.2, 21.1, 20.4, 22.3, 23.0, 23.7];

/**
 * Garis pada grafik batang memakai NILAI YANG SAMA dengan batangnya — garis
 * hanya menelusuri puncak tiap batang (bukan angka karangan), seperti pada
 * referensi. Titiknya digeser sedikit ke atas lewat `symbolOffset` supaya tidak
 * tertutup batang.
 */
let garis: number[];

/** Total setahun — dipakai sebagai detail di legenda grafik batang. */
let TOTAL_PENDAPATAN = 0;

/** Indeks bulan dengan pendapatan tertinggi (Desember). */
let PUNCAK = 0;

let RINCIAN_BEBAN: NilaiBeban[];
const BEBAN_CONTOH = [
  { nama: 'Operasional', nilai: 25.9, warna: WARNA.oranye },
  { nama: 'Pemeliharaan', nilai: 23.1, warna: WARNA.teal },
  { nama: 'Pegawai', nilai: 19.8, warna: WARNA.ungu },
  { nama: 'Investasi', nilai: 17.0, warna: WARNA.kuning },
  { nama: 'Lain-lain', nilai: 14.2, warna: WARNA.merah },
];

let ARUS_KAS: number[];
const ARUS_CONTOH = [3.2, 3.6, 3.4, 4.1, 4.6, 4.3, 5.0, 5.4, 5.1, 5.8, 6.2, 5.9, 6.4, 6.9, 6.6, 7.2, 7.6, 7.3, 7.9, 8.4, 8.1, 8.7, 9.1, 8.8, 9.4, 9.8, 9.5, 10.1, 10.6];

let TRANSAKSI: NilaiTransaksi[];
const TRANSAKSI_CONTOH = [
  { nama: 'Pembayaran pelanggan', ket: 'Wilayah Jakarta Selatan', nilai: '+1,24', naik: true, Ikon: Droplets },
  { nama: 'Pemeliharaan jaringan', ket: 'Zona 3 · vendor', nilai: '-486', naik: false, Ikon: CreditCard },
  { nama: 'Setoran kas ke bank', ket: 'Rekening operasional', nilai: '+2,10', naik: true, Ikon: Landmark },
  { nama: 'Gaji & tunjangan', ket: 'Periode Mei 2025', nilai: '-3,72', naik: false, Ikon: Wallet },
];

const TRANSAKSI_LAIN_CONTOH = [
  { nama: 'Pembelian bahan kimia', ket: 'Instalasi pengolahan', nilai: '-214', naik: false, Ikon: CreditCard },
  { nama: 'Tagihan listrik', ket: 'Pompa & IPA', nilai: '-1,08', naik: false, Ikon: Wallet },
  { nama: 'Pendapatan sambungan baru', ket: 'Wilayah Jakarta Barat', nilai: '+3,46', naik: true, Ikon: Droplets },
  { nama: 'Bagi hasil kas daerah', ket: 'Setoran triwulan I', nilai: '+1,75', naik: true, Ikon: Landmark },
];

/**
 * Progres target. Warna batang = status capaian, dan statusnya ditulis di
 * bawah tiap batang supaya tidak ada legenda yang menggantung tanpa pasangan.
 */
let TARGET: NilaiTarget[];
const TARGET_CONTOH = [
  { nama: 'Target Pendapatan', capai: 86, status: 'mendekati target', warna: WARNA.oranye },
  { nama: 'Efisiensi Beban', capai: 92, status: 'sesuai target', warna: WARNA.hijau },
  { nama: 'Target Laba Bersih', capai: 57, status: 'perlu perhatian', warna: WARNA.merah },
];

interface DashboardReferensiProps {
  /** Gaya global dashboard (panel Gaya): palet, font, ukuran, tebal garis, sudut batang. */
  gaya?: WidgetStyle;
  /**
   * Warna latar kartu dari panel Gaya (draft maupun tersimpan). Kosong = warna
   * bawaan template. Teks dan garis tetap memakai warna template agar kontras.
   */
  warnaKartu?: string;
  /**
   * Nilai dari dokumen instansi. Bila diisi, ANGKA pada template diganti dengan
   * angka dokumen — susunan, warna, dan bentuk kartu tetap persis seperti contoh.
   * Slot yang tidak ada nilainya memakai angka contoh supaya tampilan utuh.
   */
  nilai?: NilaiTemplate;
  /**
   * true = isi seluruh tinggi wadah (mode presentasi / layar penuh): baris
   * dibagi dengan `flex-1` dan grafik memanjang, tidak ada ruang kosong.
   */
  penuh?: boolean;
  /**
   * TATA LETAK KARTU (opsional). Kunci = grupId baris (`kpi`, `grafik`, `tabel`),
   * nilainya urutan dan lebar kartu. Kosong = susunan asli template.
   */
  tataLetak?: Record<string, TataLetakBaris>;
  /** Simpan perubahan tata letak. */
  onTataLetak?: (baru: Record<string, TataLetakBaris>) => void;
  /** true = kartu grafik bisa diklik dan berputar menampilkan sumber dokumen. */
  sumberAktif?: boolean;
  /** Sumber per judul widget (huruf kecil), dari `sumberPerJudul`. */
  sumberJudul?: Record<string, SumberDok[]>;
}

export const DashboardReferensi: React.FC<DashboardReferensiProps> = ({
  penuh = false,
  gaya,
  warnaKartu,
  nilai,
  tataLetak,
  onTataLetak,
  sumberAktif = false,
  sumberJudul,
}) => {
  /** Kartu memakai warna dari panel Gaya bila ada. */
  const KARTU = warnaKartu || WARNA.kartu;
  /**
   * Isi kartu mengikuti warna kartu pilihan: kartu terang memakai teks gelap,
   * kartu gelap memakai teks terang. Dihitung dengan kontras WCAG, bukan ditebak.
   */
  const TEMA_KARTU = warnaKartu ? temaKartu(warnaKartu, 'dark') : null;
  const KARTU2 = TEMA_KARTU ? TEMA_KARTU.vars['--color-surface-2'] : WARNA.kartu2;
  const TEKS = TEMA_KARTU ? TEMA_KARTU.vars['--color-ink'] : WARNA.teks;
  const TEKS2 = TEMA_KARTU ? TEMA_KARTU.vars['--color-ink-2'] : WARNA.teks2;
  const TEKS3 = TEMA_KARTU ? TEMA_KARTU.vars['--color-ink-3'] : WARNA.teks3;
  const GARIS = TEMA_KARTU ? TEMA_KARTU.vars['--color-line'] : WARNA.garis;
  /** Grafik ikut tema terang bila kartu terang. */
  const kartuTerang = Boolean(warnaKartu && !latarGelap(warnaKartu));
  /** Mode presentasi tidak boleh diubah tata letaknya. */
  /** Hanya bisa diubah bila pemanggil menyediakan penyimpan tata letak (bukan galeri/pratinjau). */
  const bisaUbah = !penuh && !!onTataLetak;
  const ubahBaris = (grupId: string, baru: TataLetakBaris) =>
    onTataLetak?.({ ...(tataLetak || {}), [grupId]: baru });
  // Terapkan nilai dokumen ke slot template SEBELUM render/opsi grafik dibuat.
  // (Konstanta di atas bersifat modul karena dipakai juga oleh pembentuk opsi
  // grafik di luar komponen; jadi nilai aktif ditulis di sini.)
  const pakaiData = !!nilai;
  // Ikon tidak tersimpan di basis data (fungsi tidak ikut JSON), jadi nilai
  // dokumen bisa datang tanpa `Ikon` — pakai ikon cadangan agar tidak gagal render.
  const ikonAman = (Ikon: unknown, cadangan: React.ComponentType<{ className?: string }>) => {
    // Setelah melewati JSON, komponen React menjadi objek kosong `{}` — bukan
    // komponen yang bisa dirender. Hanya terima fungsi atau objek ber-$$typeof.
    const valid =
      typeof Ikon === 'function' ||
      (typeof Ikon === 'object' && Ikon !== null && '$$typeof' in (Ikon as Record<string, unknown>));
    return valid ? (Ikon as React.ComponentType<{ className?: string }>) : cadangan;
  };
  const KPI: Kpi[] = (nilai?.kpi?.length ? nilai.kpi : KPI_CONTOH).map(
    (k, i) => ({ ...k, Ikon: ikonAman(k.Ikon, IKON_KPI[i % IKON_KPI.length]) }) as Kpi
  );
  const BULAN: string[] = nilai?.batang?.label?.length ? nilai.batang.label : pakaiData ? [] : BULAN_CONTOH;
  const PENDAPATAN_BULANAN: number[] = nilai?.batang?.nilai?.length
    ? nilai.batang.nilai
    : pakaiData
      ? []
      : PENDAPATAN_CONTOH;
  const garis = PENDAPATAN_BULANAN;
  const TOTAL_PENDAPATAN = PENDAPATAN_BULANAN.reduce((a, b) => a + b, 0);
  const PUNCAK = PENDAPATAN_BULANAN.indexOf(Math.max(...PENDAPATAN_BULANAN));
  const RINCIAN_BEBAN: NilaiBeban[] = nilai?.cincin?.length ? nilai.cincin : pakaiData ? [] : BEBAN_CONTOH;
  const ARUS_KAS: number[] = nilai?.area?.length ? nilai.area : pakaiData ? [] : ARUS_CONTOH;
  const TRANSAKSI: NilaiTransaksi[] = nilai?.transaksi?.length ? nilai.transaksi : pakaiData ? [] : TRANSAKSI_CONTOH;
  const TARGET: NilaiTarget[] = nilai?.target?.length ? nilai.target : pakaiData ? [] : TARGET_CONTOH;
  const INSIGHT = nilai?.insight?.trim() ? nilai.insight : pakaiData ? '' : INSIGHT_CONTOH;
  // Total di lubang cincin & label puncak ikut nilai dokumen.
  const CINCIN_TOTAL = nilai?.cincinTotal?.trim() || '12,35 M';
  const PUNCAK_NILAI = PENDAPATAN_BULANAN[PUNCAK] ?? 0;
  const PUNCAK_LABEL = BULAN.length
    ? `${BULAN[PENDAPATAN_BULANAN.indexOf(Math.max(...PENDAPATAN_BULANAN))] || ''} (tertinggi)`
    : 'Nilai tertinggi';
  // Angka turunan dihitung dari data (bukan ditulis tetap), supaya saat memakai
  // data dokumen tidak ada angka contoh yang tertinggal.
  const PERTUMBUHAN = (() => {
    const n = PENDAPATAN_BULANAN.length;
    if (n < 2) return 0;
    const a = PENDAPATAN_BULANAN[n - 2] || 0;
    const b = PENDAPATAN_BULANAN[n - 1] || 0;
    return a ? Math.round(((b - a) / Math.abs(a)) * 1000) / 10 : 0;
  })();
  const ARUS_AWAL = ARUS_KAS[0] ?? 0;
  const ARUS_AKHIR = ARUS_KAS[ARUS_KAS.length - 1] ?? 0;
  const ARUS_TUMBUH = ARUS_AWAL
    ? Math.round(((ARUS_AKHIR - ARUS_AWAL) / Math.abs(ARUS_AWAL)) * 1000) / 10
    : 0;

  // Interaksi tombol: "Lihat semua" membuka seluruh transaksi, "Lihat Laporan
  // Rinci" membuka panel rincian. Keduanya hanya mengubah tampilan.
  const [semuaTransaksi, setSemuaTransaksi] = useState(false);
  const [laporanRinci, setLaporanRinci] = useState(false);

  /**
   * `skala` = besar huruf akar (em). Dihitung dari ukuran wadah supaya seluruh
   * isi ikut membesar di layar besar, tanpa mengubah tata letak baris.
   */
  const [skala, setSkala] = useState(1);
  /** Label kartu KPI yang sumbernya sedang dibuka (null = tertutup). */
  const [kpiSumber, setKpiSumber] = useState<string | null>(null);

  const akarRef = useRef<HTMLDivElement | null>(null);

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
  }, [penuh, gaya]);

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
  // Kartu selalu mengisi tinggi barisnya (galeri & presentasi) agar cincin ikut
  // memanjang dan tidak menyisakan ruang kosong di bawah.
  const kartu = (tambahan = '') => `rounded-[1.1em] p-[0.95em] h-full flex flex-col min-h-0 ${tambahan}`;

  return (
    <div
      ref={akarRef}
      className={
        penuh
          ? 'h-full w-full flex flex-col gap-[0.8em] p-[0.85em] overflow-hidden'
          : 'rounded-[1.4em] p-[1.2em]'
      }
      style={{ backgroundColor: WARNA.latar, color: TEKS, fontSize: `${(13 * skala * ((gaya?.fontUkuran ?? 13) / 13)).toFixed(2)}px` }}
    >
      {/* ===== Baris 1: 4 kartu KPI_CONTOH ===== */}
      <BarisGeser
        grupId="kpi"
        kolom={4}
        tataLetak={tataLetak?.kpi}
        onUbah={ubahBaris}
        bisaUbah={bisaUbah}
        className={`grid grid-cols-2 lg:grid-cols-4 gap-[0.8em] ${penuh ? 'baris-095' : 'mb-[0.8em]'}`}
      >
        {KPI.map((k) => (
          // Bentuk kartu KPI berasal dari katalog template chart (kpi-kartu),
          // bukan markup halaman. Halaman hanya menyiapkan datanya.
          <WidgetChart
            key={k.label}
            chartId="kpi-kartu"
            varian="ringkasan"
            data={{
              kategori: [k.label],
              seri: [{ nama: k.label, data: [Number(String(k.nilai).replace(/\./g, '').replace(',', '.'))] }],
              satuan: k.satuan,
              delta: k.delta,
              dariDokumen: pakaiData,
              desimal: 0,
            }}
            teksAngka={k.nilai}
            ikon={k.Ikon}
            deltaTeks={k.deltaTeks}
            spark={k.seri}
            sorot={kpiSumber === k.label}
            onKlik={sumberAktif ? () => setKpiSumber((v) => (v === k.label ? null : k.label)) : undefined}
          />
        ))}
      </BarisGeser>

      {/* Pita sumber untuk kartu KPI: selebar baris, di dalam halaman. */}
      {kpiSumber && (
        <PitaSumber
          judul={kpiSumber}
          sumber={sumberJudul?.[kpiSumber.trim().toLowerCase()] ?? []}
          onTutup={() => setKpiSumber(null)}
          warnaTeks={TEKS}
          warnaTeks2={TEKS2}
          warnaTeks3={TEKS3}
          warnaPanel={KARTU}
          aksen={WARNA.oranye}
          border={`1px solid ${GARIS}`}
        />
      )}

      {/* ===== Baris 2: grafik batang + cincin ===== */}
      <BarisGeser
        grupId="grafik"
        kolom={3}
        tataLetak={tataLetak?.grafik}
        onUbah={ubahBaris}
        bisaUbah={bisaUbah}
        className={`grid grid-cols-1 gap-[0.8em] ${
          penuh ? 'lg:grid-cols-[1.55fr_1fr] baris-130' : 'lg:grid-cols-3 mb-[0.8em]'
        }`}
      >
        <KartuSumber
          aktif={sumberAktif}
          judul="Ikhtisar Pendapatan"
          sumber={sumberJudul?.['ikhtisar pendapatan'] ?? []}
          className={`${penuh ? '' : 'lg:col-span-2'} ${kartu()}`}
          style={{ backgroundColor: KARTU, border: `1px solid ${GARIS}` }}
          warnaTeks={TEKS}
          warnaTeks2={TEKS2}
          warnaTeks3={TEKS3}
          warnaPanel={KARTU}
          aksen={WARNA.oranye}
        >
          <div className="flex items-start justify-between gap-[0.7em] mb-[0.3em] shrink-0">
            <div>
              <h3 className="text-[0.98em] font-semibold">Ikhtisar Pendapatan</h3>
              <p className="text-[0.8em]" style={{ color: TEKS3 }}>
                {nilai?.batangSub || 'Pendapatan usaha per bulan, 2025'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-[1.15em] font-bold leading-none tabular-nums">Rp {String(PUNCAK_NILAI).replace('.', ',')} M</div>
              <div className="text-[0.78em] mt-[0.2em] inline-flex items-center gap-[0.15em]" style={{ color: WARNA.hijau }}>
                <ArrowUpRight className="w-[0.95em] h-[0.95em]" /> {String(PERTUMBUHAN).replace('.', ',')}% {BULAN.length > 1 ? `vs ${BULAN[BULAN.length - 2]}` : 'vs periode lalu'}
              </div>
            </div>
          </div>
          <WidgetChart
            chartId="bar-tegak-sorot"
            varian="ringkasan"
            skala={skala}
            data={{
              kategori: BULAN,
              seri: [{ nama: 'Pendapatan', data: PENDAPATAN_BULANAN }],
              satuan: 'Miliar Rp',
              desimal: 1,
            }}
            legendaItem={[
              {
                warna: WARNA.oranye,
                label: BULAN.length ? `Pendapatan ${BULAN[0]}-${BULAN[BULAN.length - 1]}` : 'Pendapatan',
                redup: true,
                nilai: `Rp ${String(TOTAL_PENDAPATAN.toFixed(1)).replace('.', ',')} M`,
              },
              { warna: WARNA.oranye, label: PUNCAK_LABEL, nilai: `Rp ${String(PUNCAK_NILAI).replace('.', ',')} M` },
            ]}
            pembungkus={(o) => gayaReplika(o, gaya, 'bar', kartuTerang)}
            className={penuh ? 'w-full flex-1 min-h-[8.5em]' : 'w-full h-[10.5em]'}
          />
        </KartuSumber>

        <KartuSumber
          aktif={sumberAktif}
          judul="Rincian Beban"
          sumber={sumberJudul?.['rincian beban'] ?? []}
          className={kartu()}
          style={{ backgroundColor: KARTU, border: `1px solid ${GARIS}` }}
          warnaTeks={TEKS}
          warnaTeks2={TEKS2}
          warnaTeks3={TEKS3}
          warnaPanel={KARTU}
          aksen={WARNA.oranye}
        >
          <div className="shrink-0">
            <h3 className="text-[0.98em] font-semibold">{nilai?.cincinJudul || 'Rincian Beban'}</h3>
            <p className="text-[0.8em]" style={{ color: TEKS3 }}>
              {nilai?.cincinSub || 'Komposisi beban operasional'}
            </p>
          </div>
          {/* Legenda di SAMPING cincin supaya cincin dapat ruang penuh (lebih besar),
              mengikuti referensi — bukan ditumpuk di bawah. */}
          {/* Blok grafik mengisi seluruh sisa tinggi kartu supaya cincin besar dan
              tidak menyisakan ruang kosong di bawah. */}
          <WidgetChart
            chartId="donat-tebal"
            varian="ringkasan"
            skala={skala}
            data={{
              kategori: RINCIAN_BEBAN.map((b) => b.nama),
              seri: [{ nama: 'Beban', data: RINCIAN_BEBAN.map((b) => b.nilai) }],
              satuan: '%',
              desimal: 1,
            }}
            pembungkus={(o) => gayaReplika(o, gaya, 'donut', kartuTerang)}
            className="flex-1 min-h-[7.5em] mt-[0.2em]"
          />
        </KartuSumber>
      </BarisGeser>

      {/* ===== Baris 3: transaksi + arus kas + target ===== */}
      <BarisGeser
        grupId="tabel"
        kolom={3}
        tataLetak={tataLetak?.tabel}
        onUbah={ubahBaris}
        bisaUbah={bisaUbah}
        className={`grid grid-cols-1 gap-[0.8em] ${
          penuh ? 'lg:grid-cols-[1fr_1.05fr_0.95fr] baris-105' : 'lg:grid-cols-3 mb-[0.8em]'
        }`}
      >
        <KartuSumber
          aktif={sumberAktif}
          judul={nilai?.tabelJudul || 'Transaksi Terbaru'}
          sumber={sumberJudul?.[(nilai?.tabelJudul || 'Transaksi Terbaru').trim().toLowerCase()] ?? []}
          className={kartu()}
          style={{ backgroundColor: KARTU, border: `1px solid ${GARIS}` }}
          warnaTeks={TEKS}
          warnaTeks2={TEKS2}
          warnaTeks3={TEKS3}
          warnaPanel={KARTU}
          aksen={WARNA.oranye}
        >
          <WidgetChart
            chartId="tabel-ringkas"
            varian="ringkasan"
            data={{
              kategori: [nilai?.tabelJudul || 'Transaksi Terbaru'],
              seri: [{ nama: 'Nilai', data: [] }],
              satuan: 'jt',
            }}
            baris={(semuaTransaksi ? [...TRANSAKSI, ...(pakaiData ? [] : TRANSAKSI_LAIN_CONTOH)] : TRANSAKSI).map(
              (t) => ({
                // Ikon tidak ikut tersimpan di basis data, jadi ada ikon cadangan.
                ikon: ikonAman(t.Ikon, t.naik ? Droplets : CreditCard),
                judul: t.nama,
                catatan: t.ket,
                nilai: `${t.nilai} jt`,
                arah: t.naik,
              })
            )}
            tautan={{
              label: semuaTransaksi ? 'Ringkas' : 'Lihat semua',
              onClick: () => setSemuaTransaksi((v) => !v),
              terbuka: semuaTransaksi,
            }}
          />
        </KartuSumber>

        <KartuSumber
          aktif={sumberAktif}
          judul="Arus Kas"
          sumber={sumberJudul?.['arus kas'] ?? []}
          className={kartu()}
          style={{ backgroundColor: KARTU, border: `1px solid ${GARIS}` }}
          warnaTeks={TEKS}
          warnaTeks2={TEKS2}
          warnaTeks3={TEKS3}
          warnaPanel={KARTU}
          aksen={WARNA.oranye}
        >
          <div className="flex items-start justify-between gap-[0.5em] mb-[0.3em] shrink-0">
            <div>
              <h3 className="text-[0.98em] font-semibold">Arus Kas</h3>
              <p className="text-[0.8em]" style={{ color: TEKS3 }}>
                {nilai?.areaSub || '29 hari terakhir'}
              </p>
            </div>
            <span className="text-[0.78em] font-semibold" style={{ color: ARUS_TUMBUH >= 0 ? WARNA.hijau : WARNA.merah }}>
              {ARUS_TUMBUH >= 0 ? '+' : ''}{String(ARUS_TUMBUH).replace('.', ',')}%
            </span>
          </div>
          <WidgetChart
            chartId="area-gradasi"
            varian="ringkasan"
            skala={skala}
            data={{
              // Label tanggal dari dokumen bila panjangnya cocok. Kalau tidak,
              // susun sendiri: deret harian berakhir hari ini, bukan nomor urut.
              kategori:
                nilai?.areaLabel && nilai.areaLabel.length === ARUS_KAS.length
                  ? nilai.areaLabel
                  : labelHarian(ARUS_KAS.length),
              seri: [{ nama: 'Arus kas bersih', data: ARUS_KAS }],
              satuan: 'Miliar Rp',
              desimal: 1,
            }}
            pembungkus={(o) => gayaReplika(o, gaya, 'area', kartuTerang)}
            className={penuh ? 'w-full flex-1 min-h-0' : 'w-full h-[8em]'}
          />
        </KartuSumber>

        <KartuSumber
          aktif={sumberAktif}
          judul="Progres Target"
          sumber={sumberJudul?.['progres target'] ?? []}
          className={kartu()}
          style={{ backgroundColor: KARTU, border: `1px solid ${GARIS}` }}
          warnaTeks={TEKS}
          warnaTeks2={TEKS2}
          warnaTeks3={TEKS3}
          warnaPanel={KARTU}
          aksen={WARNA.oranye}
        >
          <h3 className="text-[0.98em] font-semibold mb-[0.6em] shrink-0">Progres Target</h3>
          <WidgetChart
            chartId="progres-target"
            varian="ringkasan"
            data={{
              kategori: TARGET.map((t) => t.nama),
              seri: [{ nama: 'Capaian', data: TARGET.map((t) => t.capai) }],
              satuan: '%',
              desimal: 1,
            }}
          />
        </KartuSumber>
      </BarisGeser>

      {/* ===== Strip insight ===== */}
      <KartuSumber
        aktif={sumberAktif}
        judul="Insight Keuangan"
        sumber={sumberJudul?.['insight keuangan'] ?? []}
        className="rounded-[1.1em] p-[0.95em] flex items-center justify-between gap-[0.7em] shrink-0"
        kelasIsi="flex items-center justify-between gap-[0.7em] w-full"
        tinggiBuka="9em"
        style={{ backgroundColor: KARTU, border: `1px solid ${GARIS}` }}
        warnaTeks={TEKS}
        warnaTeks2={TEKS2}
        warnaTeks3={TEKS3}
        warnaPanel={KARTU}
        aksen={WARNA.oranye}
      >
        {/* Isi strip insight juga dari katalog (narasi-insight). */}
        <WidgetChart
          chartId="narasi-insight"
          varian="ringkasan"
          judul="Insight Keuangan"
          ikon={TrendingUp}
          teks={INSIGHT || 'Belum ada insight keuangan di dokumen instansi.'}
          data={{ kategori: ['Insight Keuangan'], seri: [{ nama: 'Insight', data: [1] }] }}
          className="flex-1 min-w-0"
        />
        <button
          type="button"
          onClick={() => setLaporanRinci(true)}
          title={pakaiData ? 'Buka laporan rinci berisi angka dokumen' : 'Buka laporan rinci (angka contoh)'}
          className="ml-auto inline-flex items-center gap-[0.35em] rounded-[0.75em] px-[0.9em] py-[0.4em] text-[0.82em] font-bold shrink-0 whitespace-nowrap transition-transform hover:-translate-y-px hover:brightness-105 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          style={{ background: `linear-gradient(135deg, ${WARNA.oranye}, #ffa53d)`, color: '#1a1206' }}
        >
          Lihat Laporan Rinci
          <ArrowRight className="w-[0.95em] h-[0.95em]" />
        </button>
      </KartuSumber>

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
            style={{ backgroundColor: KARTU, border: `1px solid ${GARIS}`, color: TEKS }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-[0.7em] mb-[0.8em]">
              <div>
                <h3 className="text-[1.05em] font-bold leading-tight">Laporan Rinci Keuangan</h3>
                <p className="text-[0.78em] mt-[0.15em]" style={{ color: TEKS3 }}>
                  Periode Mei 2025 · angka contoh (bukan data dokumen)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLaporanRinci(false)}
                title="Tutup (Esc)"
                aria-label="Tutup laporan"
                className="shrink-0 inline-flex items-center justify-center w-[1.9em] h-[1.9em] rounded-full transition-colors hover:brightness-125"
                style={{ border: `1px solid ${GARIS}`, color: TEKS2 }}
              >
                <X className="w-[1em] h-[1em]" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-[0.5em] mb-[1em]">
              {KPI.map((k) => (
                <WidgetChart
                  key={k.label}
                  chartId="kpi-strip"
                  varian="ringkasan"
                  data={{
                    kategori: [k.label],
                    seri: [{ nama: k.label, data: [0] }],
                    satuan: '',
                  }}
                  teksAngka={k.nilai}
                  className="rounded-[0.7em]"
                />
              ))}
            </div>

            <p className="text-[0.88em] font-semibold mb-[0.4em]">Rincian Beban Operasional</p>
            <WidgetChart
              chartId="tabel-ringkas"
              varian="ringkasan"
              data={{
                kategori: ['Rincian Beban Operasional', ...RINCIAN_BEBAN.map((r) => r.nama)],
                seri: [
                  { nama: 'Porsi (%)', data: RINCIAN_BEBAN.map((r) => r.nilai) },
                  { nama: 'Nominal (M)', data: RINCIAN_BEBAN.map((r) => (12347 * r.nilai) / 100 / 1000) },
                ],
                desimal: 2,
              }}
              className="mb-[1em]"
            />

            <p className="text-[0.88em] font-semibold mb-[0.4em]">Transaksi Terbaru</p>
            <WidgetChart
              chartId="tabel-ringkas"
              varian="ringkasan"
              data={{
                kategori: ['Transaksi Terbaru'],
                seri: [{ nama: 'Nilai', data: [] }],
              }}
              baris={[...TRANSAKSI_CONTOH, ...TRANSAKSI_LAIN_CONTOH].map((t) => ({
                judul: t.nama,
                catatan: t.ket,
                nilai: `${t.nilai} jt`,
                arah: t.naik,
              }))}
            />

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
