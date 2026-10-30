import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Droplets, Gauge, Target, Wallet } from 'lucide-react';
import { loadEcharts } from '../widgets/echartsSetup';
import { gayaReplika } from './gayaReplika';
import { KartuSumber, PitaSumber } from './KartuSumber';
import { WARNA_REF } from './opsiGrafikReferensi';
import { buildOpsi } from '../../services/chart/chartDefault';
import { WidgetChart } from '../widgets/WidgetChart';
import { latarGelap, temaKartu } from '../widgets/widgetCardTheme';
import type { WidgetStyle } from '../../types';
import {
  ringkasOperasional,
  type NilaiOperasional,
  type SumberDok,
} from '../../services/templates/nilaiOperasional';

/**
 * DASHBOARD OPERASIONAL — HALAMAN 2 TEMPLATE RINGKASAN.
 *
 * Satu keluarga dengan halaman 1 (gelap, aksen oranye), tetapi susunannya
 * BERBEDA: rantai volume air sebagai batang tegak, gauge NRW, strip KPI di
 * tengah, lalu target vs realisasi pelayanan dan cincin anggaran di bawah.
 *
 * Isinya data dokumen yang belum masuk halaman 1: volume air baku sampai
 * terjual, indikator pelayanan, indikator mutu, dan anggaran per program.
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

const PALET = [WARNA.oranye, WARNA.teal, WARNA.ungu, WARNA.kuning, WARNA.hijau, WARNA.merah];

interface Props {
  nilai?: NilaiOperasional;
  penuh?: boolean;
  gaya?: WidgetStyle;
  warnaKartu?: string;
  /** true = angkanya contoh (galeri template), bukan dari dokumen. */
  contoh?: boolean;
  /** true = kartu bisa diklik untuk melihat dokumen RAG asal angkanya. */
  sumberAktif?: boolean;
}

export const DashboardOperasional: React.FC<Props> = ({
  nilai,
  penuh = false,
  gaya,
  warnaKartu,
  contoh = false,
  sumberAktif = false,
}) => {
  const n = nilai;
  const [skala, setSkala] = useState(1);
  /** Label kartu KPI yang sumbernya sedang dibuka (null = tertutup). */
  const [kpiSumber, setKpiSumber] = useState<string | null>(null);
  const akarRef = useRef<HTMLDivElement | null>(null);
  const volumeRef = useRef<HTMLDivElement | null>(null);
  const gaugeRef = useRef<HTMLDivElement | null>(null);
  const indikatorRef = useRef<HTMLDivElement | null>(null);
  const donatRef = useRef<HTMLDivElement | null>(null);
  const instans = useRef<Record<string, any>>({});
  /** Modul ECharts yang sudah dimuat (bukan `window.echarts`). */
  const ecRef = useRef<any>(null);
  const pengamatRef = useRef<ResizeObserver | null>(null);

  const KARTU = warnaKartu || WARNA.kartu;
  const TEMA = warnaKartu ? temaKartu(warnaKartu, 'dark') : null;
  const KARTU2 = TEMA ? TEMA.vars['--color-surface-2'] : WARNA.kartu2;
  const TEKS = TEMA ? TEMA.vars['--color-ink'] : WARNA.teks;
  const TEKS2 = TEMA ? TEMA.vars['--color-ink-2'] : WARNA.teks2;
  const TEKS3 = TEMA ? TEMA.vars['--color-ink-3'] : WARNA.teks3;
  const GARIS = TEMA ? TEMA.vars['--color-line'] : WARNA.garis;
  const kartuTerang = Boolean(warnaKartu && !latarGelap(warnaKartu));

  // Skala huruf mengikuti ukuran wadah (sama seperti replika lain).
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

  // Data empat grafik. Bentuknya dari katalog, jadi halaman tidak menyusun opsi.
  const dataVolume = useMemo(() => {
    const d = n?.volume;
    if (!d) return null;
    return {
      kategori: d.kategori,
      seri: [{ nama: d.label, data: d.data }],
      satuan: d.satuan,
      desimal: 1,
    };
  }, [n?.volume]);

  const dataNrw = useMemo(() => {
    const nrw = n?.mutu?.indikator.find((i) => /nrw|kehilangan/i.test(i.nama));
    if (!nrw) return null;
    return {
      kategori: [nrw.nama],
      seri: [{ nama: 'NRW', data: [nrw.realisasi] }],
      satuan: '%',
      target: nrw.target,
      maks: 60,
      desimal: 2,
    };
  }, [n?.mutu]);

  const dataIndikator = useMemo(() => {
    const daftar = [...(n?.pelayanan?.indikator || []), ...(n?.mutu?.indikator || [])];
    if (daftar.length === 0) return null;
    return {
      kategori: daftar.map((it) => it.nama),
      seri: [
        { nama: 'Realisasi', data: daftar.map((it) => it.realisasi) },
        { nama: 'Target', data: daftar.map((it) => it.target) },
      ],
      satuan: '%',
      maks: 100,
      desimal: 1,
    };
  }, [n?.pelayanan, n?.mutu]);

  const dataAnggaran = useMemo(() => {
    const d = n?.anggaran;
    if (!d) return null;
    return {
      kategori: d.bagian.map((b) => b.label),
      seri: [{ nama: 'Anggaran', data: d.bagian.map((b) => b.nilai) }],
      satuan: d.satuan,
      desimal: 1,
    };
  }, [n?.anggaran]);

  const kpi = useMemo(
    () => [
      {
        label: 'Air terjual',
        nilai: n?.kpi.airTerjual ?? 0,
        satuan: n?.volume?.satuan ?? 'm³',
        Ikon: Droplets,
        kunci: 'volume' as const,
      },
      { label: 'NRW', nilai: n?.kpi.nrw ?? 0, satuan: '%', Ikon: Gauge, kunci: 'nrw' as const },
      {
        label: 'Penyelesaian SLA',
        nilai: n?.kpi.sla ?? 0,
        satuan: '%',
        Ikon: Target,
        kunci: 'indikator' as const,
      },
      {
        label: n?.anggaran?.label || 'Anggaran',
        nilai: n?.kpi.anggaran ?? 0,
        satuan: n?.anggaran?.satuan ?? 'miliar Rp',
        Ikon: Wallet,
        kunci: 'anggaran' as const,
      },
    ],
    [n]
  );

  // Sama dengan halaman 1: sudut 1.1em, padding 0.95em.
  const kartuKelas = 'rounded-[1.1em] border overflow-hidden p-[0.95em]';
  const judulKelas = 'text-[0.72em] font-bold uppercase tracking-[0.12em]';

  return (
    <div
      ref={akarRef}
      className={
        penuh
          ? 'h-full w-full p-[0.85em] overflow-hidden flex flex-col gap-[0.8em]'
          : 'rounded-[1.4em] p-[1.2em]'
      }
      style={{
        backgroundColor: WARNA.latar,
        color: TEKS,
        fontSize: `${(13 * skala * ((gaya?.fontUkuran ?? 13) / 13)).toFixed(2)}px`,
        fontFamily: gaya?.font ? `'${gaya.font}', 'Inter', system-ui, sans-serif` : undefined,
      }}
    >
      {/* Tanpa judul di kanvas: judul halaman diurus panel luar. */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-12 gap-[0.8em]${penuh ? ' flex-1 min-h-0' : ''}`}
      >
        <KartuSumber
          aktif={sumberAktif}
          judul="Volume air"
          sumber={n?.sumber.volume ?? []}
          className={`lg:col-span-8 ${kartuKelas} flex flex-col`}
          style={{ backgroundColor: KARTU, borderColor: GARIS }}
          warnaTeks={TEKS}
          warnaTeks2={TEKS2}
          warnaTeks3={TEKS3}
          warnaPanel={KARTU}
          aksen={WARNA.oranye}
        >
          <div className="flex items-center justify-between gap-2 mb-[0.3em]">
            <p className={judulKelas} style={{ color: TEKS3 }}>
              {n?.volume?.label || 'Volume air'} per tahap
            </p>
            <span className="text-[0.95em] font-extrabold whitespace-nowrap" style={{ color: TEKS }}>
              {n?.volume
                ? `${ringkasOperasional(n.kpi.airTerjual, n.volume.satuan)} ${n.volume.satuan} terjual`
                : '—'}
            </span>
          </div>
          {dataVolume && (
            <WidgetChart
              chartId="bar-tegak-sorot"
              varian="ringkasan"
              skala={skala}
              data={dataVolume}
              pembungkus={(o) => gayaReplika(o, gaya, 'volume', kartuTerang)}
              className={penuh ? 'w-full flex-1 min-h-0' : 'w-full'}
              tinggi={penuh ? undefined : '15em'}
            />
          )}
          {!n?.volume && (
            <p className="text-[0.75em] py-[1em]" style={{ color: TEKS3 }}>
              Dokumen belum memuat rantai volume air.
            </p>
          )}
        </KartuSumber>

        <KartuSumber
          aktif={sumberAktif}
          judul="Kehilangan air (NRW)"
          sumber={n?.sumber.nrw ?? []}
          className={`lg:col-span-4 ${kartuKelas} flex flex-col`}
          style={{ backgroundColor: KARTU, borderColor: GARIS }}
          warnaTeks={TEKS}
          warnaTeks2={TEKS2}
          warnaTeks3={TEKS3}
          warnaPanel={KARTU}
          aksen={WARNA.oranye}
        >
          <p className={judulKelas} style={{ color: TEKS3 }}>
            Kehilangan air (NRW)
          </p>
          {dataNrw && (
            <WidgetChart
              chartId="gauge-target"
              varian="ringkasan"
              skala={skala}
              data={dataNrw}
              pembungkus={(o) => gayaReplika(o, gaya, 'nrw', kartuTerang)}
              className="w-full flex-1 min-h-0"
              tinggi={penuh ? undefined : '12em'}
            />
          )}
          {n?.mutu?.indikator.find((i) => /nrw/i.test(i.nama)) && (
            <p className="text-[0.72em] text-center" style={{ color: TEKS3 }}>
              target{' '}
              {(n!.mutu!.indikator.find((i) => /nrw/i.test(i.nama))?.target ?? 0).toLocaleString(
                'id-ID',
                { maximumFractionDigits: 1 }
              )}
              %
            </p>
          )}
          {!n?.mutu && (
            <p className="text-[0.75em]" style={{ color: TEKS3 }}>
              Dokumen belum memuat angka NRW.
            </p>
          )}
        </KartuSumber>
      </div>

      {/* Strip KPI */}
      <div
        className={`grid grid-cols-2 lg:grid-cols-4 gap-[0.8em] shrink-0${penuh ? '' : ' mt-[0.8em]'}`}
      >
        {kpi.map((k) => (
          // Bentuk strip KPI dari katalog template chart (kpi-strip).
          <WidgetChart
            key={k.label}
            chartId="kpi-strip"
            varian="ringkasan"
            data={{
              kategori: [k.label],
              seri: [{ nama: k.label, data: [Number(String(k.nilai).replace(/\./g, '').replace(',', '.'))] }],
              satuan: k.satuan,
              desimal: 0,
            }}
            teksAngka={ringkasOperasional(k.nilai, k.satuan)}
            ikon={k.Ikon}
            sorot={kpiSumber === k.label}
            onKlik={sumberAktif ? () => setKpiSumber((v) => (v === k.label ? null : k.label)) : undefined}
          />
        ))}
      </div>

      {/* Pita sumber untuk kartu KPI: selebar baris, di dalam halaman. */}
      {kpiSumber && (
        <PitaSumber
          judul={kpiSumber}
          sumber={n?.sumber[kpi.find((k) => k.label === kpiSumber)?.kunci ?? 'volume'] ?? []}
          onTutup={() => setKpiSumber(null)}
          warnaTeks={TEKS}
          warnaTeks2={TEKS2}
          warnaTeks3={TEKS3}
          warnaPanel={KARTU}
          aksen={WARNA.oranye}
          border={`1px solid ${GARIS}`}
        />
      )}

      {/* Target vs realisasi + cincin anggaran */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-12 gap-[0.8em]${penuh ? ' flex-1 min-h-0' : ' mt-[0.8em]'}`}
      >
        <KartuSumber
          aktif={sumberAktif}
          judul="Target vs realisasi"
          sumber={n?.sumber.indikator ?? []}
          className={`lg:col-span-7 ${kartuKelas} flex flex-col`}
          style={{ backgroundColor: KARTU, borderColor: GARIS }}
          warnaTeks={TEKS}
          warnaTeks2={TEKS2}
          warnaTeks3={TEKS3}
          warnaPanel={KARTU}
          aksen={WARNA.oranye}
        >
          <div className="flex items-center justify-between gap-2">
            <p className={judulKelas} style={{ color: TEKS3 }}>
              Target vs realisasi indikator
            </p>
            <div className="flex items-center gap-[0.8em] text-[0.66em]" style={{ color: TEKS3 }}>
              <span className="flex items-center gap-[0.3em]">
                <span className="w-[0.5em] h-[0.5em] rounded-sm" style={{ backgroundColor: WARNA.teal }} />
                Realisasi
              </span>
              <span className="flex items-center gap-[0.3em]">
                <span className="w-[0.5em] h-[0.5em] rounded-sm" style={{ backgroundColor: GARIS }} />
                Target
              </span>
            </div>
          </div>
          {dataIndikator && (
            <WidgetChart
              chartId="bar-mendatar-target"
              varian="ringkasan"
              skala={skala}
              data={dataIndikator}
              pembungkus={(o) => gayaReplika(o, gaya, 'indikator', kartuTerang)}
              className={penuh ? 'w-full mt-[0.3em] flex-1 min-h-0' : 'w-full mt-[0.3em]'}
              tinggi={penuh ? undefined : '14em'}
            />
          )}
          {!(n?.pelayanan || n?.mutu) && (
            <p className="text-[0.75em]" style={{ color: TEKS3 }}>
              Dokumen belum memuat indikator pelayanan.
            </p>
          )}
        </KartuSumber>

        <KartuSumber
          aktif={sumberAktif}
          judul="Anggaran"
          sumber={n?.sumber.anggaran ?? []}
          className={`lg:col-span-5 ${kartuKelas} flex flex-col`}
          style={{ backgroundColor: KARTU, borderColor: GARIS }}
          warnaTeks={TEKS}
          warnaTeks2={TEKS2}
          warnaTeks3={TEKS3}
          warnaPanel={KARTU}
          aksen={WARNA.oranye}
        >
          <p className={judulKelas} style={{ color: TEKS3 }}>
            {n?.anggaran?.label || 'Anggaran per program'}
          </p>
          {/* Cincin dan legendanya dirender wajah katalog (donat-tebal). */}
          {dataAnggaran && (
            <WidgetChart
              chartId="donat-tebal"
              varian="ringkasan"
              skala={skala}
              data={dataAnggaran}
              pembungkus={(o) => gayaReplika(o, gaya, 'anggaran', kartuTerang)}
              className={penuh ? 'flex-1 min-h-0' : ''}
              tinggi={penuh ? '100%' : '11em'}
            />
          )}
          {!n?.anggaran && (
            <p className="text-[0.75em]" style={{ color: TEKS3 }}>
              Dokumen belum memuat anggaran per program.
            </p>
          )}
        </KartuSumber>
      </div>


      {/* Insight */}
      <KartuSumber
        aktif={sumberAktif}
        judul="Ringkasan halaman"
        sumber={[
          ...(n?.sumber.volume ?? []),
          ...(n?.sumber.nrw ?? []),
          ...(n?.sumber.indikator ?? []),
          ...(n?.sumber.anggaran ?? []),
        ]}
        className={`${kartuKelas} shrink-0 flex items-start gap-[0.6em]${penuh ? '' : ' mt-[0.8em]'}`}
        kelasIsi="flex items-start gap-[0.6em]"
        tinggiBuka="9em"
        style={{ backgroundColor: KARTU2, borderColor: GARIS }}
        warnaTeks={TEKS}
        warnaTeks2={TEKS2}
        warnaTeks3={TEKS3}
        warnaPanel={KARTU2}
        aksen={WARNA.oranye}
      >
        <span
          className="w-[0.45em] h-[0.45em] rounded-full mt-[0.5em] shrink-0"
          style={{ backgroundColor: WARNA.oranye }}
        />
        <p className="text-[0.8em] leading-relaxed line-clamp-2" style={{ color: TEKS2 }}>
          {n?.narasi ||
            'Halaman ini memuat volume air baku sampai air terjual, indikator pelayanan dan mutu, serta anggaran per program kerja.'}
        </p>
      </KartuSumber>
    </div>
  );
};
