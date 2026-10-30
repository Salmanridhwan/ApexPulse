import type { WidgetStyle } from '../../types';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronDown } from 'lucide-react';
import { BarisGeser } from './BarisGeser';
import { gayaReplika } from './gayaReplika';
import { WidgetChart } from '../widgets/WidgetChart';
import { latarGelap, temaKartu } from '../widgets/widgetCardTheme';
import type { TataLetakBaris } from '../../types';
import { loadEcharts } from '../widgets/echartsSetup';
import type { NilaiTrafik } from '../../services/templates/nilaiTemplate';
import {
  type SeriTrafik,
  type Kpi,
  type Usia,
  type Halaman,
  type Perangkat,
  type Perilaku,
  type Os,
  type Frasa,
  type DataTrafik,
  DATA_CONTOH,
  WARNA,
  dariNilai,
  desimal,
  jalurSpark,
  jumlahRentang,
  opsiPerangkat,
  opsiPerilaku,
  opsiRelevansi,
  opsiTrafik,
  opsiUsia,
} from '../../services/chart/varianNadi';


/**
 * DASHBOARD TRAFIK WEB — template ketiga (T3).
 *
 * Referensi: papan analitik web bertema gelap — 5 kartu KPI bersparkline,
 * grafik batang sumber trafik 31 hari dengan legenda di samping, garis
 * dinamika relevansi, komposisi usia, daftar halaman populer, jenis
 * perangkat, faktor perilaku, sistem operasi, dan frasa pencarian.
 *
 * DUA SUMBER ANGKA
 * - Tanpa prop `nilai` → angka CONTOH (dummy), persis seperti tampilan acuan.
 * - Dengan prop `nilai` → angka DOKUMEN mengisi slot yang sama. Susunan kartu,
 *   ukuran, dan warna TIDAK dihitung ulang: hanya angkanya yang berganti.
 *   Slot yang tidak ada angkanya di dokumen dibiarkan KOSONG (tidak memakai
 *   angka contoh), supaya pratinjau tidak menampilkan angka karangan.
 *
 * INTERAKSI
 * - Chip "30 hari / 7 hari" mengganti rentang grafik batang & garis.
 * - "Lihat semua" membuka daftar penuh (dapat digulir di dalam kartu).
 */

interface DashboardTrafikProps {
  /** Gaya global dashboard (panel Gaya): palet, font, ukuran, tebal garis, sudut batang. */
  gaya?: WidgetStyle;
  /**
   * Warna latar kartu dari panel Gaya (draft maupun tersimpan). Kosong = warna
   * bawaan template. Teks dan garis tetap memakai warna template agar kontras.
   */
  warnaKartu?: string;
  /** true = isi seluruh tinggi wadah (mode presentasi / layar penuh). */
  penuh?: boolean;
  /**
   * TATA LETAK KARTU (opsional). Kunci = grupId baris, nilainya urutan dan lebar
   * kartu. Kosong = susunan asli template.
   */
  tataLetak?: Record<string, TataLetakBaris>;
  /** Simpan perubahan tata letak. */
  onTataLetak?: (baru: Record<string, TataLetakBaris>) => void;
  /**
   * Angka dari dokumen instansi. Bila diisi, ANGKA pada template diganti dengan
   * angka dokumen — susunan kartu, geometri, dan warna tetap persis seperti
   * contoh. Slot yang tidak ada nilainya dibiarkan KOSONG (bukan angka contoh).
   */
  nilai?: NilaiTrafik;
}

export const DashboardTrafik: React.FC<DashboardTrafikProps> = ({
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
  const [rentang, setRentang] = useState(30);
  const [semuaHalaman, setSemuaHalaman] = useState(false);
  const [semuaFrasa, setSemuaFrasa] = useState(false);
  const [menuRentang, setMenuRentang] = useState(false);

  const akarRef = useRef<HTMLDivElement | null>(null);
  const instans = useRef<Record<string, any>>({});
  const menuRef = useRef<HTMLSpanElement | null>(null);

  /**
   * Data yang dirender: angka contoh (tanpa prop) atau angka dokumen. Semua
   * bagian di bawah membaca objek ini, jadi bentuk kartu tidak pernah berubah —
   * hanya angkanya yang berbeda.
   */
  const data = useMemo<DataTrafik>(() => (nilai ? dariNilai(nilai) : DATA_CONTOH), [nilai]);

  const {
    kpi,
    sumber,
    hari,
    hariRelevansi,
    relevansi,
    dinamis,
    usia,
    usiaTotal,
    usiaDelta,
    halaman,
    perangkat,
    perangkatTotal,
    perilaku,
    os,
    frasa,
  } = data;

  // Rentang grafik tidak boleh melebihi jumlah titik data dokumen.
  const totalHari = Math.max(1, hari.length);
  const rentangAktif = Math.min(rentang, totalHari);
  const mulai = Math.max(0, hari.length - rentangAktif);
  const pilihanRentang = data.dinamis
    ? Array.from(new Set([totalHari, 7]))
        .filter((r) => r >= 2 && r <= totalHari)
        .sort((a, b) => b - a)
    : [30, 7];

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
    backgroundColor: KARTU,
    border: `1px solid ${GARIS}`,
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
        <h3 className="text-[0.88em] font-semibold leading-tight flex items-center gap-[0.35em]" style={{ color: TEKS }}>
          {warna && <span className="w-[0.4em] h-[0.4em] rounded-full shrink-0" style={{ backgroundColor: warna }} />}
          <span className="truncate">{judul}</span>
        </h3>
        {sub && (
          <p className="text-[0.62em] truncate mt-[0.12em]" style={{ color: TEKS3 }}>
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

  /** Keterangan kecil untuk kartu yang belum ada angkanya di dokumen. */
  const Kosong: React.FC<{ teks?: string }> = ({ teks = 'Belum ada angka di dokumen instansi.' }) => (
    <li className="text-[0.64em] leading-relaxed" style={{ color: TEKS3 }}>
      {teks}
    </li>
  );

  const bidang = (galeri: string) => (penuh ? 'w-full flex-1 min-h-[6em]' : `w-full ${galeri}`);
  const daftar = penuh ? 'flex-1 min-h-0 overflow-y-auto gulir-tema pr-[0.2em]' : '';

  const halamanTampil = semuaHalaman ? halaman : halaman.slice(0, 7);
  const frasaTampil = semuaFrasa ? frasa : frasa.slice(0, 8);
  const maksHalaman = halaman.length ? Math.max(...halaman.map((h) => h.persen)) : 0;
  const skorPerilaku = perilaku.length ? Math.round(perilaku.reduce((a, b) => a + b.persen, 0)) : null;

  return (
    <div
      ref={akarRef}
      className={
        penuh
          ? 'h-full w-full flex flex-col gap-[0.65em] p-[0.75em] overflow-hidden'
          : 'rounded-[1.1em] p-[1em] flex flex-col gap-[0.65em]'
      }
      style={{ backgroundColor: WARNA.latar, color: TEKS, fontSize: `${(13 * skala * ((gaya?.fontUkuran ?? 13) / 13)).toFixed(2)}px` }}
    >
      {/* ===== Baris 1: 5 KPI ===== */}
      <BarisGeser
        grupId="kpi"
        kolom={5}
        tataLetak={tataLetak?.kpi}
        onUbah={ubahBaris}
        bisaUbah={bisaUbah}
        className={`grid grid-cols-2 lg:grid-cols-5 gap-[0.6em] ${penuh ? 'baris-060' : ''}`}
      >
        {kpi.map((k) => (
          <WidgetChart
            key={k.label}
            chartId="kpi-kartu"
            varian="trafik"
            skala={skala}
            judul={k.label}
            teksAngka={k.nilai}
            spark={k.seri}
            data={{
              kategori: [k.label],
              seri: [{ nama: k.label, data: k.seri }],
              delta: k.delta ? (k.naik ? 1 : -1) : 0,
              deltaTeks: k.delta,
              arahBaik: k.naikBagus ? 'naik' : 'turun',
            }}
          />
        ))}
      </BarisGeser>

      {/* ===== Baris 2: sumber trafik · dinamika relevansi · usia ===== */}
      <BarisGeser
        grupId="grafik"
        kolom={3}
        tataLetak={tataLetak?.grafik}
        onUbah={ubahBaris}
        bisaUbah={bisaUbah}
        className={`grid grid-cols-1 lg:grid-cols-[2.1fr_1fr_1.1fr] gap-[0.65em] ${penuh ? 'baris-125' : ''}`}
      >
        {/* Sumber Trafik */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala
            judul={data.dinamis ? nilai?.sumberJudul || 'Sumber Trafik' : 'Sumber Trafik'}
            sub={data.dinamis ? `${hari.length} titik waktu · pengunjung per hari` : '1–31 Januari 2023 · pengunjung per hari'}
            warna={WARNA.biru}
            aksi={
              sumber.length > 0 ? (
                <span ref={menuRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setMenuRentang((v) => !v)}
                    className="inline-flex items-center gap-[0.25em] rounded-[0.4em] px-[0.45em] py-[0.2em] text-[0.66em] font-medium transition-colors hover:brightness-125"
                    style={{ backgroundColor: KARTU2, border: `1px solid ${menuRentang ? WARNA.biru : GARIS}`, color: TEKS2 }}
                  >
                    {rentangAktif} hari
                    <ChevronDown className={`w-[0.85em] h-[0.85em] transition-transform ${menuRentang ? 'rotate-180' : ''}`} />
                  </button>
                  {menuRentang && (
                    <div
                      className="absolute right-0 top-[calc(100%+0.3em)] z-30 rounded-[0.45em] overflow-hidden py-[0.2em] min-w-[5.4em]"
                      style={{ backgroundColor: KARTU2, border: `1px solid ${GARIS}`, boxShadow: '0 10px 24px rgba(0,0,0,0.55)' }}
                    >
                      {pilihanRentang.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            setRentang(r);
                            setMenuRentang(false);
                          }}
                          className="w-full text-left px-[0.6em] py-[0.28em] text-[0.66em] hover:bg-white/5"
                          style={{ color: rentangAktif === r ? WARNA.biruMuda : TEKS2, fontWeight: rentangAktif === r ? 700 : 400 }}
                        >
                          {r} hari
                        </button>
                      ))}
                    </div>
                  )}
                </span>
              ) : undefined
            }
          />
          <div className="flex-1 min-h-0 flex gap-[0.5em]">
            <WidgetChart
              chartId="garis-tren"
              varian="trafik"
              skala={skala}
              data={{
                kategori: hari,
                seri: sumber.map((sr) => ({ nama: sr.nama, data: sr.data })),
                dariDokumen: dinamis,
                desimal: 0,
              }}
              pembungkus={(o) => gayaReplika(o, gaya, 'trafik', kartuTerang)}
              className={penuh ? 'flex-1 min-w-0' : 'w-full h-[11em]'}
            />
            <ul className="flex flex-col justify-center gap-[0.3em] min-w-[6.4em] shrink-0">
              {sumber.map((seri) => (
                <li key={seri.nama} className="flex items-center gap-[0.3em] text-[0.65em] min-w-0">
                  <span className="w-[0.5em] h-[0.5em] rounded-full shrink-0" style={{ backgroundColor: seri.warna }} />
                  <span className="truncate" style={{ color: TEKS2 }}>
                    {seri.nama}
                  </span>
                  <span className="ml-auto tabular-nums font-semibold shrink-0" style={{ color: TEKS }}>
                    {seri.data.length ? jumlahRentang(seri.data, mulai) : ''}
                  </span>
                </li>
              ))}
              {sumber.length === 0 && <Kosong />}
            </ul>
          </div>
        </div>

        {/* Dinamika Relevansi */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala
            judul={data.dinamis ? nilai?.relevansiJudul || 'Dinamika Relevansi' : 'Dinamika Relevansi'}
            sub="Poin relevansi harian"
            warna={WARNA.cyan}
          />
          <WidgetChart
            chartId="combo-batang-garis"
            varian="trafik"
            skala={skala}
            data={{
              kategori: hariRelevansi,
              seri: [{ nama: 'Relevansi', data: relevansi }],
              dariDokumen: dinamis,
              desimal: 0,
            }}
            pembungkus={(o) => gayaReplika(o, gaya, 'relevansi', kartuTerang)}
            className={bidang('h-[9em]')}
          />
        </div>

        {/* Usia — batang berperingkat */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala
            judul="Usia"
            warna={WARNA.ungu}
            sub="Kunjungan per kelompok usia"
            aksi={
              usiaDelta != null ? (
                <span
                  className="inline-flex items-center gap-[0.08em] rounded-full px-[0.32em] py-[0.05em] text-[0.64em] font-semibold shrink-0"
                  style={{
                    color: usiaDelta > 0 ? WARNA.hijau : WARNA.merah,
                    backgroundColor: `${usiaDelta > 0 ? WARNA.hijau : WARNA.merah}1f`,
                  }}
                >
                  {usiaDelta > 0 ? (
                    <ArrowUpRight className="w-[0.85em] h-[0.85em]" />
                  ) : (
                    <ArrowDownRight className="w-[0.85em] h-[0.85em]" />
                  )}
                  {desimal(Math.abs(usiaDelta))}%
                </span>
              ) : undefined
            }
          />
          <div className="flex items-baseline gap-[0.3em] shrink-0 mb-[0.3em]">
            <span className="text-[1.15em] font-bold leading-none tabular-nums">{usiaTotal || '\u00A0'}</span>
            <span className="text-[0.65em]" style={{ color: TEKS3 }}>
              {usia.length ? `kunjungan (sesi) · ${usia.length} kelompok` : 'belum ada angka dokumen'}
            </span>
          </div>
          <div className="flex h-[0.45em] rounded-full overflow-hidden shrink-0 mb-[0.45em] gap-[0.08em]">
            {usia.map((u) => (
              <span key={u.label} style={{ width: `${u.persen}%`, backgroundColor: u.warna }} title={`${u.penuh} · ${desimal(u.persen)}%`} />
            ))}
          </div>
          <WidgetChart
            chartId="bar-tumpuk"
            varian="trafik"
            skala={skala}
            data={{
              kategori: usia.map((u) => u.label),
              seri: [{ nama: 'Pengunjung', data: usia.map((u) => u.persen) }],
              satuan: '%',
              dariDokumen: dinamis,
              desimal: 1,
            }}
            pembungkus={(o) => gayaReplika(o, gaya, 'usia', kartuTerang)}
            className={bidang('h-[9em]')}
          />
        </div>
      </BarisGeser>

      {/* ===== Baris 3: halaman · perangkat · perilaku · OS · frasa ===== */}
      <BarisGeser
        grupId="tabel"
        kolom={5}
        tataLetak={tataLetak?.tabel}
        onUbah={ubahBaris}
        bisaUbah={bisaUbah}
        className={`grid grid-cols-1 lg:grid-cols-[1.15fr_0.95fr_0.9fr_1fr_0.95fr] gap-[0.65em] ${penuh ? 'baris-145' : ''}`}
      >
        {/* Halaman Populer */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala
            judul="Halaman Populer"
            warna={WARNA.biruMuda}
            sub="Porsi kunjungan per halaman"
            aksi={
              halaman.length > 7 ? (
                <Tautan teks={semuaHalaman ? 'Ringkas' : 'Lihat semua'} onClick={() => setSemuaHalaman((v) => !v)} />
              ) : undefined
            }
          />
          <ul className={`flex-1 min-h-0 flex flex-col justify-between gap-[0.2em] ${daftar}`}>
            {halamanTampil.map((h) => (
              <li key={h.path} className="min-w-0 rounded-[0.3em] px-[0.2em] py-[0.1em] hover:bg-white/[0.04] transition-colors">
                <div className="flex items-center gap-[0.3em] text-[0.65em] min-w-0">
                  <span className="truncate" style={{ color: TEKS2 }}>
                    {h.path}
                  </span>
                  <span className="ml-auto tabular-nums font-semibold shrink-0">{desimal(h.persen)}%</span>
                  {h.delta != null && (
                    <span
                      className="inline-flex items-center gap-[0.05em] shrink-0 text-[0.92em] font-semibold"
                      style={{ color: h.delta > 0 ? WARNA.hijau : h.delta < 0 ? WARNA.merah : TEKS3 }}
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
                  )}
                </div>
                <div className="h-[0.24em] rounded-full overflow-hidden mt-[0.12em]" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${Math.min(100, (h.persen / ((maksHalaman || 1) * 1.06)) * 100)}%`,
                      background: `linear-gradient(90deg, ${WARNA.biru}66, ${WARNA.biruMuda})`,
                    }}
                  />
                </div>
              </li>
            ))}
            {halaman.length === 0 && <Kosong teks="Belum ada angka halaman di dokumen instansi." />}
          </ul>
        </div>

        {/* Jenis Perangkat — batang tegak */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala
            judul={data.dinamis ? nilai?.perangkatJudul || 'Jenis Perangkat' : 'Jenis Perangkat'}
            warna={WARNA.kuning}
            sub="Kunjungan per perangkat"
          />
          <div className="flex items-baseline gap-[0.3em] shrink-0 mb-[0.1em]">
            <span className="text-[1em] font-bold leading-none tabular-nums">{perangkatTotal || '\u00A0'}</span>
            <span className="text-[0.6em]" style={{ color: TEKS3 }}>
              kunjungan (sesi)
            </span>
          </div>
          <WidgetChart
            chartId="donat-tebal"
            varian="trafik"
            skala={skala}
            data={{
              kategori: perangkat.map((x) => x.nama),
              seri: [{ nama: 'Perangkat', data: perangkat.map((x) => x.persen) }],
              satuan: '%',
              dariDokumen: dinamis,
              desimal: 1,
            }}
            pembungkus={(o) => gayaReplika(o, gaya, 'perangkat', kartuTerang)}
            className={bidang('h-[7.6em]')}
          />
          <ul className="shrink-0 flex flex-col gap-[0.14em] mt-[0.15em]">
            {perangkat.map((p) => (
              <li key={p.nama} className="flex items-center gap-[0.3em] text-[0.63em] min-w-0">
                <span className="w-[0.45em] h-[0.45em] rounded-full shrink-0" style={{ backgroundColor: p.warna }} />
                <span className="truncate" style={{ color: TEKS2 }}>
                  {p.nama}
                </span>
                <span className="ml-auto tabular-nums font-semibold shrink-0">{desimal(p.persen)}%</span>
                <span className="tabular-nums shrink-0 w-[2.5em] text-right" style={{ color: TEKS3 }}>
                  {p.jumlah != null ? Number(p.jumlah).toLocaleString('id-ID') : ''}
                </span>
              </li>
            ))}
            {perangkat.length === 0 && <Kosong teks="Belum ada angka perangkat." />}
          </ul>
        </div>

        {/* Faktor Perilaku — komposisi 100% + rincian kanal */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala judul="Faktor Perilaku" warna={WARNA.hijau} sub="Porsi kanal · skor 100" />
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="relative flex-1 min-h-0">
              <WidgetChart
                chartId="bar-mendatar-peringkat"
                varian="trafik"
                skala={skala}
                data={{
                  kategori: perilaku.map((x) => x.nama),
                  seri: [{ nama: 'Perilaku', data: perilaku.map((x) => x.persen) }],
                  satuan: '%',
                  dariDokumen: dinamis,
                  desimal: 1,
                }}
                pembungkus={(o) => gayaReplika(o, gaya, 'perilaku', kartuTerang)}
                className="h-full w-full"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[1.45em] font-bold leading-none tabular-nums">{skorPerilaku ?? '\u00A0'}</span>
                <span className="text-[0.56em] mt-[0.1em]" style={{ color: TEKS3 }}>
                  skor
                </span>
              </div>
            </div>
            <ul className="shrink-0 flex items-center justify-between gap-[0.35em] mt-[0.35em]">
              {perilaku.map((p) => (
                <li key={p.nama} className="flex items-center gap-[0.28em] text-[0.64em] min-w-0">
                  <span className="w-[0.44em] h-[0.44em] rounded-[0.1em] shrink-0" style={{ backgroundColor: p.warna }} />
                  <span className="truncate" style={{ color: TEKS2 }}>
                    {p.nama}
                  </span>
                  <span className="tabular-nums font-semibold shrink-0">{desimal(p.persen)}%</span>
                </li>
              ))}
              {perilaku.length === 0 && <Kosong teks="Belum ada angka perilaku." />}
            </ul>
          </div>
        </div>

        {/* Sistem Operasi — satu baris per OS + sparkline 30 hari */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala
            judul="Sistem Operasi"
            warna={WARNA.oranye}
            sub={data.dinamis ? 'Porsi kunjungan' : 'Porsi kunjungan · 30 hari'}
          />
          {os.length === 0 ? (
            <Kosong teks="Belum ada angka sistem operasi." />
          ) : (
            <WidgetChart
              chartId="strip-os"
              varian="trafik"
              skala={skala}
              className="w-full flex-1 min-h-0"
              data={{
                kategori: os.map((o) => o.nama),
                seri: [
                  { nama: 'Porsi', data: os.map((o) => o.persen) },
                  { nama: 'Delta', data: os.map((o) => o.delta ?? 0) },
                ],
                deretKecil: os.map((o) => o.seri),
                satuan: '%',
                desimal: 1,
              }}
            />
          )}
        </div>

        {/* Frasa Pencarian */}
        <div className={kartu()} style={gayaKartu}>
          <Kepala
            judul="Frasa Pencarian"
            warna={WARNA.cyan}
            sub="Porsi pencarian"
            aksi={
              frasa.length > 8 ? (
                <Tautan teks={semuaFrasa ? 'Ringkas' : 'Lihat semua'} onClick={() => setSemuaFrasa((v) => !v)} />
              ) : undefined
            }
          />
          <ul className={`flex-1 min-h-0 flex flex-col justify-between gap-[0.24em] ${daftar}`}>
            {frasaTampil.map((f) => (
              <li key={f.teks} className="min-w-0 rounded-[0.3em] px-[0.2em] py-[0.08em] hover:bg-white/[0.04] transition-colors">
                <div className="flex items-center gap-[0.3em] text-[0.65em]">
                  <span className="truncate" style={{ color: TEKS2 }}>
                    {f.teks}
                  </span>
                  <span className="ml-auto tabular-nums font-semibold shrink-0">{desimal(f.persen)}%</span>
                </div>
                <div className="h-[0.22em] rounded-full overflow-hidden mt-[0.1em]" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, f.persen * 2.4)}%`, background: `linear-gradient(90deg, ${WARNA.biru}, ${WARNA.cyan})` }}
                  />
                </div>
              </li>
            ))}
            {frasa.length === 0 && <Kosong teks="Belum ada angka frasa pencarian." />}
          </ul>
        </div>
      </BarisGeser>
    </div>
  );
};
