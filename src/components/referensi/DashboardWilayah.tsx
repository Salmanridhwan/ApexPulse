import React, { useEffect, useMemo, useRef, useState, useContext } from 'react';
import { KonteksVarianTemplate, warnaHalamanDariGaya } from '../widgets/konteksGayaReplika';
import { gayaMode, type Varian } from '../../services/chart/gayaVarian';
import { useThemeMode } from '../../theme';
import { Users, Droplets, Gauge, MessageSquare } from 'lucide-react';
import { loadEcharts } from '../widgets/echartsSetup';
import { gayaReplika } from './gayaReplika';
import { KartuSumber, PitaSumber } from './KartuSumber';
import { WARNA_REF } from './opsiGrafikReferensi';
import { buildOpsi } from '../../services/chart/chartDefault';
import { WidgetChart } from '../widgets/WidgetChart';
import { latarGelap, temaKartu } from '../widgets/widgetCardTheme';
import type { WidgetStyle } from '../../types';
import { ringkasWilayah, type NilaiWilayah } from '../../services/templates/wilayahLayanan';

/**
 * DASHBOARD WILAYAH — HALAMAN 3 TEMPLATE RINGKASAN.
 *
 * Satu lingkup: kinerja lima wilayah layanan (Jakarta Pusat, Utara, Barat,
 * Selatan, Timur). Semua angkanya dari satu tabel dokumen, jadi tidak ada
 * campuran tema. Halaman 1 keuangan, halaman 2 operasional total, halaman 3
 * sebaran wilayah.
 */

const WARNA_PIJAR = {
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

const PALET_PIJAR = [WARNA_PIJAR.oranye, WARNA_PIJAR.teal, WARNA_PIJAR.ungu, WARNA_PIJAR.kuning, WARNA_PIJAR.hijau];

interface Props {
  nilai?: NilaiWilayah;
  penuh?: boolean;
  gaya?: WidgetStyle;
  warnaKartu?: string;
  /** true = angkanya contoh (galeri template), bukan dari dokumen. */
  contoh?: boolean;
  /** true = kartu bisa diklik untuk melihat dokumen asal angkanya. */
  sumberAktif?: boolean;
}

export const DashboardWilayah: React.FC<Props> = ({
  nilai,
  penuh = false,
  gaya,
  warnaKartu,
  contoh = false,
  sumberAktif = false,
}) => {
  // Template bergaya (tpl-gaya-<varian>): seluruh warna halaman & chart dari gaya
  // Template Chart yang sama. Tanpa varian = warna Pijar asli.
  const varianTpl = useContext(KonteksVarianTemplate);
  const modeTpl = useThemeMode();
  const gayaTpl = varianTpl ? gayaMode(varianTpl, modeTpl) : undefined;
  const WARNA = {
    ...WARNA_PIJAR,
    latarCss: undefined as string | undefined,
    huruf: undefined as string | undefined,
    ...(gayaTpl ? warnaHalamanDariGaya(gayaTpl) : {}),
  };
  const VARIAN_TPL: Varian = varianTpl ?? 'ringkasan';
  /** Tepi, bayangan, sudut, dan kaca kartu gaya aktif (Blok bertepi tebal, Bento bersudut besar). */
  const TEPI_KARTU: React.CSSProperties = gayaTpl
    ? {
        borderWidth: gayaTpl.tepi?.tebal ?? 1,
        borderStyle: 'solid',
        boxShadow: gayaTpl.tepi && gayaTpl.tepi.bayangan !== 'none' ? gayaTpl.tepi.bayangan : undefined,
        borderRadius: gayaTpl.sudutKartu,
        backdropFilter: gayaTpl.kaca ? 'blur(16px)' : undefined,
        WebkitBackdropFilter: gayaTpl.kaca ? 'blur(16px)' : undefined,
      }
    : {};
  /** Warna Pijar di data (legenda, progres) diganti warna setara gaya aktif. */
  const petaWarna = (c: string): string => {
    const k = (Object.keys(WARNA_PIJAR) as Array<keyof typeof WARNA_PIJAR>).find((x) => WARNA_PIJAR[x] === c);
    return k ? WARNA[k] : c;
  };
  const PALET = PALET_PIJAR.map(petaWarna);
  const n = nilai;
  const [skala, setSkala] = useState(1);
  const [kpiSumber, setKpiSumber] = useState<string | null>(null);
  const akarRef = useRef<HTMLDivElement | null>(null);

  const KARTU = warnaKartu || WARNA.kartu;
  const TEMA = warnaKartu ? temaKartu(warnaKartu, 'dark') : null;
  const KARTU2 = TEMA ? TEMA.vars['--color-surface-2'] : WARNA.kartu2;
  const TEKS = TEMA ? TEMA.vars['--color-ink'] : WARNA.teks;
  const TEKS2 = TEMA ? TEMA.vars['--color-ink-2'] : WARNA.teks2;
  const TEKS3 = TEMA ? TEMA.vars['--color-ink-3'] : WARNA.teks3;
  const GARIS = TEMA ? TEMA.vars['--color-line'] : WARNA.garis;
  const kartuTerang = Boolean(warnaKartu && !latarGelap(warnaKartu));

  const baris = n?.baris ?? [];
  const total = n?.total ?? null;

  // Skala huruf mengikuti ukuran wadah (sama seperti halaman 1 dan 2).
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
      setSkala(Math.max(0.72, Math.min(1.25, Math.min(r.width / 1500, r.height / 840))));
    };
    hitung();
    const ro = new ResizeObserver(hitung);
    ro.observe(el);
    return () => ro.disconnect();
  }, [penuh]);

  const sumbu = (ekstra?: any) => ({
    axisLine: { lineStyle: { color: GARIS } },
    axisTick: { show: false },
    axisLabel: { color: TEKS3, fontSize: 10 },
    splitLine: { lineStyle: { color: GARIS, type: 'dashed' } },
    ...ekstra,
  });

  const kpi = useMemo(
    () => [
      {
        label: 'Pelanggan',
        nilai: total?.pelanggan ?? 0,
        satuan: 'sambungan',
        Ikon: Users,
        sumber: n?.sumber ?? [],
      },
      {
        label: 'Air terjual',
        nilai: total?.airTerjual ?? 0,
        satuan: 'm³',
        Ikon: Droplets,
        sumber: n?.sumber ?? [],
      },
      {
        label: 'Kehilangan air (NRW)',
        nilai: total?.nrw ?? 0,
        satuan: '%',
        Ikon: Gauge,
        sumber: n?.sumber ?? [],
      },
      {
        label: 'Pengaduan masuk',
        nilai: total?.pengaduan ?? 0,
        satuan: 'kasus',
        Ikon: MessageSquare,
        sumber: n?.sumber ?? [],
      },
    ],
    [n]
  );

  const teratas = useMemo(() => {
    if (!baris.length) return null;
    const jual = [...baris].sort((a, b) => b.airTerjual - a.airTerjual)[0];
    const nrw = [...baris].sort((a, b) => b.nrw - a.nrw)[0];
    const adu = [...baris].sort((a, b) => (b.per1000 ?? 0) - (a.per1000 ?? 0))[0];
    return { jual, nrw, adu };
  }, [baris]);

  const kartuKelas = 'rounded-[1.1em] border overflow-hidden p-[0.95em]';
  const judulKelas = 'text-[0.72em] font-bold uppercase tracking-[0.12em]';
  const sumber = n?.sumber ?? [];

  const bingkaiKartu = {
    backgroundColor: KARTU,
    borderColor: GARIS,
    ...TEPI_KARTU,
  };

  return (
    <div
      ref={akarRef}
      className={penuh ? 'h-full w-full p-[0.85em] overflow-hidden flex flex-col gap-[0.8em]' : 'rounded-[1.4em] p-[1.2em]'}
      style={{
        background: WARNA.latarCss ?? WARNA.latar,
        color: TEKS,
        fontSize: `${(13 * skala * ((gaya?.fontUkuran ?? 13) / 13)).toFixed(2)}px`,
        fontFamily: gaya?.font ? `'${gaya.font}', 'Inter', system-ui, sans-serif` : WARNA.huruf,
      }}
    >
      {!baris.length && (
        <div className={`${kartuKelas} shrink-0`} style={bingkaiKartu}>
          <p className={judulKelas} style={{ color: TEKS3 }}>
            Kinerja per wilayah layanan
          </p>
          <p className="text-[0.78em] mt-[0.4em]" style={{ color: TEKS2 }}>
            {contoh
              ? 'Data contoh belum dimuat.'
              : 'Dokumen belum memuat tabel kinerja per wilayah layanan.'}
          </p>
        </div>
      )}

      {baris.length > 0 && (
        <>
          {/* Strip KPI: kartu pendek, sumbernya tampil sebagai pita di bawah. */}
          <div className={`grid grid-cols-2 lg:grid-cols-4 gap-[0.8em] shrink-0${penuh ? '' : ' mb-[0.8em]'}`}>
            {kpi.map((k) => (
              // Bentuk strip KPI dari katalog template chart (kpi-strip).
              <WidgetChart
                key={k.label}
                chartId="kpi-strip"
                varian={VARIAN_TPL}
            gaya={gayaTpl}
                data={{
                  kategori: [k.label],
                  seri: [{ nama: k.label, data: [Number(String(k.nilai).replace(/\./g, '').replace(',', '.'))] }],
                  satuan: k.satuan,
                  desimal: 0,
                }}
                teksAngka={ringkasWilayah(k.nilai, k.satuan)}
                ikon={k.Ikon}
                sorot={kpiSumber === k.label}
                onKlik={sumberAktif ? () => setKpiSumber((v) => (v === k.label ? null : k.label)) : undefined}
              />
            ))}
          </div>

          {kpiSumber && (
            <PitaSumber
              judul={kpiSumber}
              sumber={kpi.find((k) => k.label === kpiSumber)?.sumber ?? []}
              onTutup={() => setKpiSumber(null)}
              warnaTeks={TEKS}
              warnaTeks2={TEKS2}
              warnaTeks3={TEKS3}
              warnaPanel={KARTU}
              aksen={WARNA.oranye}
              border={`1px solid ${GARIS}`}
            />
          )}

          <div className={`grid grid-cols-1 lg:grid-cols-12 gap-[0.8em]${penuh ? ' flex-1 min-h-0' : ' mt-[0.8em]'}`}>
            <KartuSumber
              aktif={sumberAktif}
              judul="Air terjual per wilayah"
              sumber={sumber}
              className={`lg:col-span-7 ${kartuKelas} flex flex-col`}
              style={bingkaiKartu}
              warnaTeks={TEKS}
              warnaTeks2={TEKS2}
              warnaTeks3={TEKS3}
              warnaPanel={KARTU}
              aksen={WARNA.oranye}
            >
              <div className="flex items-center justify-between gap-2 mb-[0.3em]">
                <p className={judulKelas} style={{ color: TEKS3 }}>
                  Air terjual per wilayah {n?.contoh ? '· contoh' : '2024'}
                </p>
                <span className="text-[0.95em] font-extrabold whitespace-nowrap" style={{ color: TEKS }}>
                  {total ? `${ringkasWilayah(total.airTerjual, 'm³')} m³` : '—'}
                </span>
              </div>
              <WidgetChart
                chartId="bar-tegak"
                varian={VARIAN_TPL}
            gaya={gayaTpl}
                skala={skala}
                data={{
                  kategori: baris.map((b) => b.wilayah.replace('Jakarta ', '')),
                  seri: [{ nama: 'Air terjual', data: baris.map((b) => Number((b.airTerjual / 1_000_000).toFixed(2))) }],
                  satuan: 'jt m³',
                  desimal: 1,
                }}
                pembungkus={(o) => gayaReplika(o, gaya, 'wilayahTerjual', kartuTerang)}
                className={penuh ? 'w-full flex-1 min-h-0' : 'w-full'}
                tinggi={penuh ? undefined : '15em'}
              />
            </KartuSumber>

            <KartuSumber
              aktif={sumberAktif}
              judul="Kehilangan air per wilayah"
              sumber={sumber}
              className={`lg:col-span-5 ${kartuKelas} flex flex-col`}
              style={bingkaiKartu}
              warnaTeks={TEKS}
              warnaTeks2={TEKS2}
              warnaTeks3={TEKS3}
              warnaPanel={KARTU}
              aksen={WARNA.oranye}
            >
              <div className="flex items-center justify-between gap-2 mb-[0.3em]">
                <p className={judulKelas} style={{ color: TEKS3 }}>
                  Kehilangan air (NRW)
                </p>
                <span className="text-[0.95em] font-extrabold whitespace-nowrap" style={{ color: WARNA.merah }}>
                  {total ? `${total.nrw.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%` : '—'}
                </span>
              </div>
              <WidgetChart
                chartId="bar-tegak-target"
                varian={VARIAN_TPL}
            gaya={gayaTpl}
                skala={skala}
                data={{
                  kategori: baris.map((b) => b.wilayah.replace('Jakarta ', '')),
                  seri: [{ nama: 'NRW', data: baris.map((b) => b.nrw) }],
                  satuan: '%',
                  target: total?.nrw ?? (baris.length ? baris.reduce((a, b) => a + b.nrw, 0) / baris.length : 0),
                  desimal: 2,
                }}
                pembungkus={(o) => gayaReplika(o, gaya, 'wilayahNrw', kartuTerang)}
                className={penuh ? 'w-full flex-1 min-h-0' : 'w-full'}
                tinggi={penuh ? undefined : '15em'}
              />
            </KartuSumber>
          </div>

          <div className={`grid grid-cols-1 lg:grid-cols-12 gap-[0.8em]${penuh ? ' flex-1 min-h-0' : ' mt-[0.8em]'}`}>
            <KartuSumber
              aktif={sumberAktif}
              judul="Pelanggan per wilayah"
              sumber={sumber}
              className={`lg:col-span-5 ${kartuKelas} flex flex-col`}
              style={bingkaiKartu}
              warnaTeks={TEKS}
              warnaTeks2={TEKS2}
              warnaTeks3={TEKS3}
              warnaPanel={KARTU}
              aksen={WARNA.oranye}
            >
              <p className={judulKelas} style={{ color: TEKS3 }}>
                Sebaran pelanggan
              </p>
              {/* Cincin dan legendanya dirender wajah katalog (donat-tebal). */}
              <WidgetChart
                chartId="donat-tebal"
                varian={VARIAN_TPL}
            gaya={gayaTpl}
                skala={skala}
                data={{
                  kategori: baris.map((b) => b.wilayah),
                  seri: [{ nama: 'Pelanggan', data: baris.map((b) => b.pelanggan) }],
                  satuan: 'pelanggan',
                  desimal: 0,
                }}
                pembungkus={(o) => gayaReplika(o, gaya, 'wilayahPelanggan', kartuTerang)}
                className={penuh ? 'flex-1 min-h-0' : ''}
                tinggi={penuh ? '100%' : '11em'}
              />
            </KartuSumber>

            <KartuSumber
              aktif={sumberAktif}
              judul="Pengaduan per 1.000 pelanggan"
              sumber={sumber}
              className={`lg:col-span-7 ${kartuKelas} flex flex-col`}
              style={bingkaiKartu}
              warnaTeks={TEKS}
              warnaTeks2={TEKS2}
              warnaTeks3={TEKS3}
              warnaPanel={KARTU}
              aksen={WARNA.oranye}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={judulKelas} style={{ color: TEKS3 }}>
                  Pengaduan per 1.000 pelanggan
                </p>
                <span className="text-[0.66em]" style={{ color: TEKS3 }}>
                  merah = di atas 140
                </span>
              </div>
              <WidgetChart
                chartId="bar-mendatar-peringkat"
                varian={VARIAN_TPL}
            gaya={gayaTpl}
                skala={skala}
                data={{
                  kategori: [...baris]
                    .sort((a, b) => (a.per1000 ?? 0) - (b.per1000 ?? 0))
                    .map((b) => b.wilayah.replace('Jakarta ', '')),
                  seri: [
                    {
                      nama: 'Pengaduan per 1.000',
                      data: [...baris].sort((a, b) => (a.per1000 ?? 0) - (b.per1000 ?? 0)).map((b) => b.per1000 ?? 0),
                    },
                  ],
                  satuan: 'per 1.000 pelanggan',
                  desimal: 1,
                }}
                pembungkus={(o) => gayaReplika(o, gaya, 'wilayahPengaduan', kartuTerang)}
                className={penuh ? 'w-full flex-1 min-h-0' : 'w-full'}
                tinggi={penuh ? undefined : '13em'}
              />
            </KartuSumber>
          </div>

          <KartuSumber
            aktif={sumberAktif}
            judul="Catatan wilayah"
            sumber={sumber}
            className={`${kartuKelas} shrink-0 flex items-start gap-[0.6em]${penuh ? '' : ' mt-[0.8em]'}`}
            kelasIsi="flex items-start gap-[0.6em] w-full"
            tinggiBuka="9em"
            style={{ backgroundColor: KARTU2, borderColor: GARIS, ...TEPI_KARTU }}
            warnaTeks={TEKS}
            warnaTeks2={TEKS2}
            warnaTeks3={TEKS3}
            warnaPanel={KARTU2}
            aksen={WARNA.oranye}
          >
            <p className="text-[0.78em] leading-relaxed min-w-0" style={{ color: TEKS2 }}>
              {teratas ? (
                <>
                  <span style={{ color: TEKS, fontWeight: 700 }}>{teratas.jual.wilayah}</span> mencatat air
                  terjual terbesar, {ringkasWilayah(teratas.jual.airTerjual, 'm³')} m³. NRW tertinggi di{' '}
                  <span style={{ color: WARNA.merah, fontWeight: 700 }}>{teratas.nrw.wilayah}</span>{' '}
                  {teratas.nrw.nrw.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%, dan pengaduan per
                  1.000 pelanggan tertinggi juga di {teratas.adu.wilayah} sebesar{' '}
                  {(teratas.adu.per1000 ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })}. Kedua
                  wilayah menjadi prioritas penurunan kehilangan air.
                </>
              ) : (
                'Dokumen belum memuat catatan wilayah.'
              )}
            </p>
          </KartuSumber>
        </>
      )}
    </div>
  );
};
