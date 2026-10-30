import type { WidgetStyle } from '../../types';
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, DollarSign, MoreVertical, ShoppingBag, Target, Users } from 'lucide-react';
import { BarisGeser } from './BarisGeser';
import { gayaReplika } from './gayaReplika';
import { WidgetChart } from '../widgets/WidgetChart';
import { latarGelap, temaKartu } from '../widgets/widgetCardTheme';
import type { TataLetakBaris } from '../../types';
import { loadEcharts } from '../widgets/echartsSetup';
import { teksNilai, type NilaiAnalitik, type NilaiAnalitikDeret } from '../../services/templates/nilaiTemplate';
import {
  opsiArea,
  opsiBatang,
  opsiDonat,
  opsiKategori,
  opsiJam,
  opsiBayar,
  opsiKonversi,
  Kpi,
  AREA_DATA,
  BATANG_DATA,
  DONAT_DATA,
  JAM_PESANAN,
  KATEGORI_NILAI,
  KATEGORI_UNIT,
  KONVERSI,
  KPI_CONTOH,
  Kosong,
  PEMBAYARAN,
  PESANAN_AWAL,
  SUMBER_NAMA,
  WARNA,
  WARNA_STATUS,
  WARNA_SUMBER,
  PESANAN_STATUS,
} from '../../services/chart/varianLensa';

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
 *
 * PRATINJAU DATA ASLI
 * Prop `nilai` membawa angka dokumen ke slot kartu yang sama. Komponen ini tetap
 * satu-satunya pemegang desain: susunan, geometri kartu, dan warnanya tidak
 * dihitung dari data — hanya angkanya yang berganti. Slot yang tidak ada di
 * dokumen dibiarkan KOSONG (tanpa angka contoh), dan chip pembanding
 * (Harian/Bulan Lalu/Nilai…) disembunyikan karena dokumen hanya memuat satu
 * potret — memilih mode pembanding hanya akan menampilkan angka karangan.
 */

interface DashboardAnalitikProps {
  /** Gaya global dashboard (panel Gaya): palet, font, ukuran, tebal garis, sudut batang. */
  gaya?: WidgetStyle;
  /**
   * Warna latar kartu dari panel Gaya (draft maupun tersimpan). Kosong = warna
   * bawaan template. Teks dan garis tetap memakai warna template agar kontras.
   */
  warnaKartu?: string;
  /**
   * Angka dari dokumen instansi. Bila diisi, ANGKA pada kartu diganti angka
   * dokumen — susunan, geometri, dan warna kartu tetap persis seperti contoh.
   * Slot yang tidak ada di dokumen dibiarkan kosong (tanpa angka contoh).
   */
  nilai?: NilaiAnalitik;
  /** true = isi seluruh tinggi wadah (mode presentasi / layar penuh). */
  penuh?: boolean;
  /**
   * TATA LETAK KARTU (opsional). Kunci = grupId baris, nilainya urutan dan lebar
   * kartu. Kosong = susunan asli template.
   */
  tataLetak?: Record<string, TataLetakBaris>;
  /** Simpan perubahan tata letak. */
  onTataLetak?: (baru: Record<string, TataLetakBaris>) => void;
}

export const DashboardAnalitik: React.FC<DashboardAnalitikProps> = ({
  penuh = false,
  gaya,
  warnaKartu,
  nilai,
  tataLetak,
  onTataLetak,
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
  const instans = useRef<Record<string, any>>({});

  /**
   * ── Sumber angka tiap slot ────────────────────────────────────────────────
   * Tanpa prop `nilai`: kartu memakai angka contoh (tampilan galeri).
   * Dengan `nilai`: HANYA angka dokumen yang dipakai. Slot yang dokumennya tidak
   * memuat angka menjadi `null` → kartu tetap dirender dengan geometri yang sama,
   * tetapi isinya kosong (tidak ada angka contoh yang menyelinap).
   */
  const pakaiData = !!nilai;

  // 4 kartu KPI: jumlah kartu selalu 4 supaya barisnya sama tinggi dengan contoh.
  const KPI: Kpi[] = pakaiData
    ? KPI_CONTOH.map((contoh, i) => {
        const d = nilai?.kpi?.[i];
        if (!d) return { ...contoh, nilai: '', delta: '', deltaTeks: '', seri: [], kosong: true };
        return {
          ...contoh,
          label: d.label || contoh.label,
          nilai: d.nilai,
          delta: d.delta,
          deltaTeks: d.deltaTeks,
          naik: d.naik,
          seri: d.seri,
        };
      })
    : KPI_CONTOH;

  // Grafik area "Ikhtisar Pendapatan".
  const dataArea: NilaiAnalitikDeret | null = pakaiData ? nilai?.pendapatan ?? null : AREA_DATA[modeArea];
  const satuanArea = pakaiData ? nilai?.pendapatanSatuan : 'Rp';
  const totalArea = dataArea ? dataArea.nilai.reduce((a, b) => a + b, 0) : null;
  const teksTotalArea = totalArea == null ? '—' : teksNilai(totalArea, satuanArea);
  const rentangArea = dataArea
    ? (pakaiData ? nilai?.pendapatanRentang : undefined) ??
      `${dataArea.label[0] ?? ''} – ${dataArea.label[dataArea.label.length - 1] ?? ''}`
    : 'belum ada di dokumen';
  // Pertumbuhan dihitung dari dua titik terakhir deret dokumen (bukan angka tetap).
  const tumbuhArea = pakaiData
    ? (() => {
        const seri = dataArea?.nilai ?? [];
        if (seri.length < 2) return null;
        const awal = seri[seri.length - 2];
        if (!awal) return null;
        return Math.round(((seri[seri.length - 1] - awal) / Math.abs(awal)) * 1000) / 10;
      })()
    : 18.2;

  const dataBatang: Array<number | null> | null = pakaiData ? nilai?.status ?? null : BATANG_DATA[modeBatang];

  const sumberContoh = DONAT_DATA[modeDonat];
  const dataSumber: { nama: string; nilai: number }[] | null = pakaiData
    ? nilai?.sumber ?? null
    : SUMBER_NAMA.map((nama, i) => ({ nama, nilai: sumberContoh.nilai[i] }));
  const totalSumber = pakaiData ? nilai?.sumberTotal ?? '—' : sumberContoh.total;

  const dataKategori: { nama: string; nilai: number; warna?: string }[] | null = pakaiData
    ? nilai?.kategori ?? null
    : modeKategori === 'Nilai'
      ? KATEGORI_NILAI
      : KATEGORI_UNIT;

  const dataJam: NilaiAnalitikDeret | null = pakaiData
    ? nilai?.jam ?? null
    : {
        label: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}`),
        nilai: JAM_PESANAN[modeJam],
      };

  const dataBayar: { nama: string; nilai: number; warna?: string }[] | null = pakaiData
    ? nilai?.bayar ?? null
    : PEMBAYARAN[modeBayar];
  const totalBayar = dataBayar ? dataBayar.reduce((a, b) => a + b.nilai, 0) : null;

  const dataKonversi: NilaiAnalitikDeret | null = pakaiData ? nilai?.konversi ?? null : KONVERSI[modeKonversi];

  // Tabel pesanan: baris dokumen bila ada; tanpa baris → badan tabel kosong.
  const pesananTampil = pakaiData ? nilai?.pesanan ?? [] : semuaPesanan ? pesanan : pesanan.slice(0, 5);
  const barisPesanan = pesananTampil.map((p) => ({
    id: p.id,
    nama: p.nama,
    inisial: p.inisial,
    tanggal: p.tanggal,
    jumlah: p.jumlah,
    status: p.status,
    warna: (p as { warna?: string }).warna ?? WARNA_STATUS[String(p.status).toLowerCase()] ?? WARNA.biruMuda,
  }));

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



  // Pesan singkat (mis. "ID disalin") hilang sendiri.
  useEffect(() => {
    if (!pesan) return;
    const t = setTimeout(() => setPesan(null), 1800);
    return () => clearTimeout(t);
  }, [pesan]);

  const kartu = (tambahan = '') =>
    `rounded-[0.85em] p-[0.85em] h-full flex flex-col min-h-0 ${tambahan}`;

  const gayaKartu = { backgroundColor: KARTU, border: `1px solid ${GARIS}` };

  /** Kepala kartu: judul di kiri, aksi (chip/tombol) di kanan. */
  const Kepala: React.FC<{ judul: string; aksi?: React.ReactNode }> = ({ judul, aksi }) => (
    <div className="flex items-center justify-between gap-[0.6em] shrink-0 mb-[0.5em]">
      <h3 className="text-[0.9em] font-semibold leading-tight truncate min-w-0" style={{ color: TEKS }}>
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
          style={{ backgroundColor: KARTU2, border: `1px solid ${buka ? WARNA.biru : GARIS}`, color: TEKS2 }}
        >
          {nilai}
          <ChevronDown className={`w-[0.9em] h-[0.9em] transition-transform ${buka ? 'rotate-180' : ''}`} />
        </button>
        {buka && (
          <div
            className="absolute right-0 top-[calc(100%+0.3em)] z-30 rounded-[0.45em] overflow-hidden py-[0.2em] min-w-[6em]"
            style={{ backgroundColor: KARTU2, border: `1px solid ${GARIS}`, boxShadow: '0 10px 24px rgba(0,0,0,0.55)' }}
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
                style={{ color: o === nilai ? WARNA.biruMuda : TEKS2, fontWeight: o === nilai ? 700 : 400 }}
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

  /**
   * Chip pembanding (Harian/Bulan Lalu/Nilai…) hanya bermakna untuk tampilan
   * contoh. Dokumen hanya memuat satu potret, jadi saat memakai angka dokumen
   * chip disembunyikan — bukan dibiarkan menampilkan mode yang isinya kosong.
   */
  const chip = (elemen: React.ReactNode) => (pakaiData ? undefined : elemen);

  return (
    <div
      ref={akarRef}
      className={
        penuh
          ? 'h-full w-full flex flex-col gap-[0.7em] p-[0.8em] overflow-hidden'
          : 'rounded-[1.1em] p-[1em] flex flex-col gap-[0.7em]'
      }
      style={{ backgroundColor: WARNA.latar, color: TEKS, fontSize: `${(13 * skala * ((gaya?.fontUkuran ?? 13) / 13)).toFixed(2)}px` }}
    >
      {/* ===== Baris 1: 4 kartu KPI ===== */}
      <BarisGeser
        grupId="kpi"
        kolom={4}
        tataLetak={tataLetak?.kpi}
        onUbah={ubahBaris}
        bisaUbah={bisaUbah}
        className={`grid grid-cols-2 lg:grid-cols-4 gap-[0.7em] ${penuh ? 'baris-062' : ''}`}
      >
        {KPI.map((k) => (
          <WidgetChart
            key={k.label}
            chartId="kpi-kartu"
            varian="analitik"
            skala={skala}
            judul={k.label}
            ikon={k.Ikon}
            teksAngka={k.nilai}
            deltaTeks={k.deltaTeks}
            spark={k.seri}
            data={{
              kategori: [k.label],
              seri: [{ nama: k.label, data: k.seri }],
              // Hanya arah yang dipakai wajah katalog; angkanya sudah berbentuk teks.
              delta: k.delta ? (k.naik === false ? -1 : 1) : 0,
              deltaTeks: k.delta,
              kosong: k.kosong,
              warnaIkon: k.warna,
            }}
          />
        ))}
      </BarisGeser>

      {/* ===== Baris 2: pendapatan · pesanan per status · sumber kunjungan ===== */}
      <BarisGeser
        grupId="grafik"
        kolom={3}
        tataLetak={tataLetak?.grafik}
        onUbah={ubahBaris}
        bisaUbah={bisaUbah}
        className={`grid grid-cols-1 lg:grid-cols-[2.05fr_1fr_1.05fr] gap-[0.7em] ${penuh ? 'baris-118' : ''}`}
      >
        {/* Ikhtisar Pendapatan */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala
            judul="Ikhtisar Pendapatan"
            aksi={chip(<Pilih nilai={modeArea} opsi={['Harian', 'Mingguan']} onPilih={(v) => setModeArea(v as 'Harian' | 'Mingguan')} />)}
          />
          <div className="flex items-end justify-between gap-[0.6em] shrink-0">
            <div className="min-w-0">
              <div className="text-[1.15em] font-bold leading-none tabular-nums truncate">{teksTotalArea}</div>
              <div className="text-[0.68em] mt-[0.25em] truncate" style={{ color: TEKS3 }}>
                {rentangArea}
              </div>
            </div>
            {tumbuhArea != null && (
              <span
                className="text-[0.7em] font-semibold shrink-0"
                style={{ color: tumbuhArea >= 0 ? WARNA.hijau : WARNA.merah }}
              >
                {tumbuhArea >= 0 ? '+' : ''}
                {String(tumbuhArea).replace('.', ',')}% vs periode lalu
              </span>
            )}
          </div>
          <div className={`relative ${bidang('h-[10.5em]')}`}>
            {dataArea ? (
              <WidgetChart
                chartId="area-gradasi"
                varian="analitik"
                skala={skala}
                data={{
                  kategori: dataArea.label,
                  seri: [{ nama: 'Pendapatan', data: dataArea.nilai }],
                  satuan: satuanArea,
                  dariDokumen: pakaiData,
                  desimal: 1,
                }}
                pembungkus={(o) => gayaReplika(o, gaya, 'area', kartuTerang)}
                className="absolute inset-0"
              />
            ) : (
              <Kosong />
            )}
          </div>
        </div>

        {/* Pesanan per Status */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala
            judul="Pesanan per Status"
            aksi={chip(
              <Pilih nilai={modeBatang} opsi={['Bulan Ini', 'Bulan Lalu']} onPilih={(v) => setModeBatang(v as 'Bulan Ini' | 'Bulan Lalu')} />,
            )}
          />
          <div className={`relative ${bidang('h-[10.5em]')}`}>
            {dataBatang ? (
              <WidgetChart
                chartId="bar-tegak-sorot"
                varian="analitik"
                skala={skala}
                data={{
                  kategori: PESANAN_STATUS.map((st) => st.nama),
                  seri: [{ nama: 'Pesanan', data: dataBatang }],
                  dariDokumen: pakaiData,
                  desimal: 0,
                }}
                pembungkus={(o) => gayaReplika(o, gaya, 'batang', kartuTerang)}
                className="absolute inset-0"
              />
            ) : (
              <Kosong />
            )}
          </div>
        </div>

        {/* Sumber Kunjungan */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala
            judul={pakaiData ? nilai?.sumberJudul || 'Komposisi' : 'Sumber Kunjungan'}
            aksi={chip(
              <Pilih nilai={modeDonat} opsi={['Bulan Ini', 'Bulan Lalu']} onPilih={(v) => setModeDonat(v as 'Bulan Ini' | 'Bulan Lalu')} />,
            )}
          />
          <WidgetChart
            chartId="donat-tebal"
            varian="analitik"
            skala={skala}
            data={{
              kategori: (dataSumber ?? []).map((d) => d.nama),
              seri: [{ nama: 'Sumber', data: (dataSumber ?? []).map((d) => d.nilai) }],
              satuan: '%',
              desimal: 1,
            }}
            pembungkus={(o) => gayaReplika(o, gaya, 'donat', kartuTerang)}
            className="flex-1 min-h-[6.5em]"
          />
        </div>
      </BarisGeser>

      {/* ===== Baris 3: pesanan terbaru · kategori & jadwal · aktivitas & tugas ===== */}
      <BarisGeser
        grupId="tabel"
        kolom={3}
        tataLetak={tataLetak?.tabel}
        onUbah={ubahBaris}
        bisaUbah={bisaUbah}
        className={`grid grid-cols-1 lg:grid-cols-[1.95fr_1fr_1fr] gap-[0.7em] ${penuh ? 'baris-150' : ''}`}
      >
        {/* Pesanan Terbaru */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala
            judul="Pesanan Terbaru"
            aksi={<Tautan teks={semuaPesanan ? 'Ringkas' : 'Lihat semua'} onClick={() => setSemuaPesanan((v) => !v)} />}
          />
          <div className="flex-1 min-h-0 flex flex-col">
            <div
              className="grid grid-cols-[1.05fr_1.45fr_0.95fr_0.95fr_0.85fr_0.25fr] gap-[0.4em] pb-[0.35em] mb-[0.2em] text-[0.64em] font-semibold shrink-0 overflow-hidden"
              style={{ color: TEKS3, borderBottom: `1px solid ${GARIS}` }}
            >
              <span>ID Pesanan</span>
              <span>Pelanggan</span>
              <span>Tanggal</span>
              <span className="text-right">Jumlah</span>
              <span>Status</span>
              <span />
            </div>
            <div className={`flex-1 min-h-0 flex flex-col ${daftar}`}>
              {pesananTampil.length === 0 && (
                <p className="text-[0.68em] py-[0.6em]" style={{ color: TEKS3 }}>
                  Belum ada daftar pesanan di dokumen instansi.
                </p>
              )}
              {pesananTampil.map((p, i) => (
                <div
                  key={`${p.id}-${i}`}
                  className="grid grid-cols-[1.05fr_1.45fr_0.95fr_0.95fr_0.85fr_0.25fr] gap-[0.4em] items-center text-[0.68em] flex-1 min-h-[1.9em] overflow-hidden"
                  style={{ borderBottom: `1px solid rgba(255,255,255,0.045)` }}
                >
                  <span className="tabular-nums truncate" style={{ color: TEKS2 }}>
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
                  <span className="truncate" style={{ color: TEKS3 }}>
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
                      <MoreVertical className="w-[0.95em] h-[0.95em]" style={{ color: TEKS3 }} />
                    </button>
                    {menuBaris === p.id && (
                      <span
                        className="absolute right-0 top-[1.4em] z-30 rounded-[0.4em] overflow-hidden py-[0.15em] min-w-[7.2em] text-left"
                        style={{ backgroundColor: KARTU2, border: `1px solid ${GARIS}`, boxShadow: '0 10px 24px rgba(0,0,0,0.6)' }}
                      >
                        <button
                          type="button"
                          className="block w-full text-left px-[0.6em] py-[0.28em] text-[0.66em] hover:bg-white/5"
                          style={{ color: TEKS2 }}
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
                          style={{ color: TEKS2 }}
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
              judul={pakaiData ? nilai?.kategoriJudul || 'Nilai Pesanan per Kategori' : 'Nilai Pesanan per Kategori'}
              aksi={
                <Pilih
                  nilai={modeKategori}
                  opsi={['Nilai', 'Unit']}
                  onPilih={(v) => setModeKategori(v as 'Nilai' | 'Unit')}
                />
              }
            />
            <WidgetChart
              chartId="bar-mendatar-peringkat"
              varian="analitik"
              skala={skala}
              data={{
                kategori: (dataKategori ?? []).map((d) => d.nama),
                seri: [{ nama: modeKategori, data: (dataKategori ?? []).map((d) => d.nilai) }],
                dariDokumen: pakaiData,
                desimal: 1,
              }}
              pembungkus={(o) => gayaReplika(o, gaya, 'kategori', kartuTerang)}
              className={bidang('h-[9.6em]')}
            />
            {!dataKategori && <Kosong />}
          </div>

          <div className={`${kartu()} ${penuh ? 'baris-130' : ''}`} style={gayaKartu}>
            <Kepala
              judul={pakaiData ? nilai?.jamJudul || 'Pesanan per Jam' : 'Pesanan per Jam'}
              aksi={
                <Pilih
                  nilai={modeJam}
                  opsi={['Hari ini', 'Rata-rata']}
                  onPilih={(v) => setModeJam(v as 'Hari ini' | 'Rata-rata')}
                />
              }
            />
            <WidgetChart
              chartId="scatter-gelembung"
              varian="analitik"
              skala={skala}
              data={{
                kategori: (dataJam ?? { label: [], nilai: [] }).label,
                seri: [{ nama: 'Pesanan', data: (dataJam ?? { label: [], nilai: [] }).nilai }],
                dariDokumen: pakaiData,
                desimal: 0,
              }}
              pembungkus={(o) => gayaReplika(o, gaya, 'jam', kartuTerang)}
              className={bidang('h-[8.6em]')}
            />
            {!dataJam && <Kosong />}
          </div>
        </div>

        {/* Kolom kanan: metode pembayaran + tren konversi */}
        <div className="flex flex-col gap-[0.7em] min-h-0">
          <div className={`${kartu()} ${penuh ? 'baris-115' : ''}`} style={gayaKartu}>
            <Kepala
              judul={pakaiData ? nilai?.bayarJudul || 'Komposisi' : 'Metode Pembayaran'}
              aksi={
                <Pilih
                  nilai={modeBayar}
                  opsi={['Bulan Ini', 'Bulan Lalu']}
                  onPilih={(v) => setModeBayar(v as 'Bulan Ini' | 'Bulan Lalu')}
                />
              }
            />
            <div className="flex items-baseline gap-[0.3em] shrink-0 mb-[0.3em]">
              <span className="text-[1.1em] font-bold leading-none tabular-nums">
                {pakaiData ? nilai?.bayarTotal || '—' : (totalBayar ?? 0).toLocaleString('id-ID')}
              </span>
              <span className="text-[0.62em]" style={{ color: TEKS3 }}>
                {pakaiData ? nilai?.bayarLabel || 'komposisi' : `pesanan · ${dataBayar?.length ?? 0} metode`}
              </span>
            </div>
            <WidgetChart
              chartId="bar-mendatar-peringkat"
              varian="analitik"
              skala={skala}
              data={{
                kategori: (dataBayar ?? []).map((d) => d.nama),
                seri: [{ nama: 'Pesanan', data: (dataBayar ?? []).map((d) => d.nilai) }],
                dariDokumen: pakaiData,
                desimal: 0,
              }}
              pembungkus={(o) => gayaReplika(o, gaya, 'bayar', kartuTerang)}
              className={bidang('h-[9.4em]')}
            />
            {!dataBayar && <Kosong />}
          </div>

          <div className={`${kartu()} ${penuh ? 'baris-100' : ''}`} style={gayaKartu}>
            <Kepala
              judul={pakaiData ? nilai?.konversiJudul || 'Tren Konversi' : 'Tren Konversi'}
              aksi={
                <Pilih
                  nilai={modeKonversi}
                  opsi={['Harian', 'Mingguan']}
                  onPilih={(v) => setModeKonversi(v as 'Harian' | 'Mingguan')}
                />
              }
            />
            <WidgetChart
              chartId="garis-tren"
              varian="analitik"
              skala={skala}
              data={{
                kategori: (dataKonversi ?? { label: [], nilai: [] }).label,
                seri: [{ nama: 'Konversi', data: (dataKonversi ?? { label: [], nilai: [] }).nilai }],
                dariDokumen: pakaiData,
                desimal: 1,
              }}
              pembungkus={(o) => gayaReplika(o, gaya, 'konversi', kartuTerang)}
              className={bidang('h-[8.6em]')}
            />
            {!dataKonversi && <Kosong />}
          </div>
        </div>
      </BarisGeser>

      {/* Pesan singkat aksi tabel */}
      {pesan && (
        <div
          className="fixed bottom-[1.2em] left-1/2 -translate-x-1/2 z-[70] rounded-[0.5em] px-[0.9em] py-[0.45em] text-[0.72em] font-medium shadow-lg"
          style={{ backgroundColor: KARTU2, border: `1px solid ${GARIS}`, color: TEKS }}
        >
          {pesan}
        </div>
      )}
    </div>
  );
};
