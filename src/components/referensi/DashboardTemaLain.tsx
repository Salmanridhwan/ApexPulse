import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadEcharts } from '../widgets/echartsSetup';
import { buildOpsi } from '../../services/chart/chartDefault';
import { KartuSumber, PitaSumber } from './KartuSumber';
import { WidgetChart } from '../widgets/WidgetChart';
import { ringkasOperasional, type NilaiOperasional, type SumberDok } from '../../services/templates/nilaiOperasional';
import { ringkasWilayah, type NilaiWilayah } from '../../services/templates/wilayahLayanan';

/**
 * HALAMAN 2 & 3 UNTUK TEMPLATE ANALITIK DAN TRAFIK.
 *
 * Cara kerjanya sama seperti template Ringkasan: halaman 1 = desain template,
 * halaman 2 = data operasional & pelayanan, halaman 3 = kinerja per wilayah.
 * Yang berbeda adalah BAHASA DESAINNYA mengikuti template masing-masing:
 *  - Analitik: latar #080b12, aksen biru, kartu #0f141d.
 *  - Trafik:   latar #0b0d12, aksen cyan, kartu #12151d.
 * Susunan kartunya juga berbeda antar template, bukan hanya warnanya.
 */

type Tema = 'analitik' | 'trafik';

const DESAIN: Record<
  Tema,
  {
    latar: string;
    kartu: string;
    kartu2: string;
    garis: string;
    teks: string;
    teks2: string;
    teks3: string;
    aksen: string;
    aksen2: string;
    palet: string[];
    merah: string;
    hijau: string;
    radius: string;
  }
> = {
  analitik: {
    latar: '#080b12',
    kartu: '#0f141d',
    kartu2: '#141b26',
    garis: '#1e2633',
    teks: '#f2f5f9',
    teks2: '#9aa3b2',
    teks3: '#7b8698',
    aksen: '#3b82f6',
    aksen2: '#60a5fa',
    palet: ['#3b82f6', '#2dd4bf', '#8b5cf6', '#f59e0b', '#ec4899'],
    merah: '#ef4444',
    hijau: '#22c55e',
    radius: 'rounded-[0.9em]',
  },
  trafik: {
    latar: '#0b0d12',
    kartu: '#12151d',
    kartu2: '#171b25',
    garis: 'rgba(255,255,255,0.07)',
    teks: '#f2f5f9',
    teks2: '#9aa3b2',
    teks3: '#8792a3',
    aksen: '#22d3ee',
    aksen2: '#3b82f6',
    palet: ['#22d3ee', '#3b82f6', '#eab308', '#f97316', '#a78bfa'],
    merah: '#ef4444',
    hijau: '#22c55e',
    radius: 'rounded-[1.2em]',
  },
};

interface DasarProps {
  penuh?: boolean;
  fontUkuran?: number;
  fontNama?: string;
  warnaKartu?: string;
  contoh?: boolean;
  sumberAktif?: boolean;
}

/** Kait kecil: muat ECharts, simpan instans, dan jaga ukuran grafik. */
function useGrafik(penuh: boolean, deps: unknown[]) {
  const ecRef = useRef<any>(null);
  const instans = useRef<Record<string, any>>({});
  const akarRef = useRef<HTMLDivElement | null>(null);
  const pengamatRef = useRef<ResizeObserver | null>(null);
  const [skala, setSkala] = useState(1);
  const [siap, setSiap] = useState(0);

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

  useEffect(() => {
    let batal = false;
    void loadEcharts().then((ec) => {
      ecRef.current = ec;
      if (batal) return;
      pengamatRef.current?.disconnect();
      const pengamat = new ResizeObserver(() => {
        Object.values(instans.current).forEach((c: any) => c?.resize?.());
      });
      if (akarRef.current) pengamat.observe(akarRef.current);
      pengamatRef.current = pengamat;
      setSiap((v) => v + 1);
    });
    return () => {
      batal = true;
      pengamatRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const ambil = (kunci: string, el: HTMLDivElement | null) => {
    if (!el || !ecRef.current) return null;
    const lama = instans.current[kunci];
    if (lama && !lama.isDisposed?.()) return lama;
    const c = ecRef.current.init(el);
    instans.current[kunci] = c;
    return c;
  };

  return { akarRef, ambil, skala, siap };
}

/* ------------------------------------------------------------------ */
/* HALAMAN 2 — OPERASIONAL & PELAYANAN                                 */
/* ------------------------------------------------------------------ */

export const OperasionalTema: React.FC<DasarProps & { tema: Tema; nilai?: NilaiOperasional }> = ({
  tema,
  nilai,
  penuh = false,
  fontUkuran = 13,
  fontNama,
  warnaKartu,
  contoh = false,
  sumberAktif = false,
}) => {
  const d = DESAIN[tema];
  const n = nilai;
  const KARTU = warnaKartu || d.kartu;
  const { akarRef, skala } = useGrafik(penuh, [nilai, tema]);
  const [kpiSumber, setKpiSumber] = useState<string | null>(null);

  const volume = n?.volume;
  const indikator = [...(n?.pelayanan?.indikator ?? []), ...(n?.mutu?.indikator ?? [])];
  const anggaran = n?.anggaran;

  const sumbu = (ekstra?: any) => ({
    axisLine: { lineStyle: { color: d.garis } },
    axisTick: { show: false },
    axisLabel: { color: d.teks3, fontSize: 10 },
    splitLine: { lineStyle: { color: d.garis, type: 'dashed' } },
    ...ekstra,
  });

  const kpi = useMemo(
    () => [
      { label: 'Air terjual', nilai: n?.kpi.airTerjual ?? 0, satuan: volume?.satuan ?? 'm³' },
      { label: 'NRW', nilai: n?.kpi.nrw ?? 0, satuan: '%' },
      { label: 'Penyelesaian SLA', nilai: n?.kpi.sla ?? 0, satuan: '%' },
      { label: anggaran?.label || 'Anggaran', nilai: n?.kpi.anggaran ?? 0, satuan: anggaran?.satuan ?? 'miliar Rp' },
    ],
    [n, volume, anggaran]
  );

  // Varian katalog mengikuti tema kartu: Lensa = analitik, Nadi = trafik.
  const varianKartu = tema === 'analitik' ? 'analitik' : 'trafik';
  const idUtama = varianKartu === 'analitik' ? 'scatter-gelembung' : 'bar-tumpuk';
  const kartuKelas = `${d.radius} border overflow-hidden p-[0.95em]`;
  const judulKelas = 'text-[0.7em] font-bold uppercase tracking-[0.12em]';
  const bingkai = { backgroundColor: KARTU, borderColor: d.garis };
  const warnaProp = {
    warnaTeks: d.teks,
    warnaTeks2: d.teks2,
    warnaTeks3: d.teks3,
    warnaPanel: KARTU,
    aksen: d.aksen,
  };

  const stripKpi = (
    <WidgetChart
      chartId="kpi-strip"
      varian={varianKartu}
      skala={skala}
      className="w-full shrink-0"
      data={{
        kategori: kpi.map((k) => k.label),
        seri: [{ nama: 'Total', data: kpi.map((k) => k.nilai) }],
        catatan: kpi.map((k) => k.satuan),
      }}
      onKlikItem={
        sumberAktif ? (i) => setKpiSumber((v) => (v === kpi[i].label ? null : kpi[i].label)) : undefined
      }
    />
  );

  return (
    <div
      ref={akarRef}
      className={penuh ? 'h-full w-full p-[0.85em] overflow-hidden flex flex-col gap-[0.8em]' : `${d.radius} p-[1.2em]`}
      style={{
        backgroundColor: d.latar,
        color: d.teks,
        fontSize: `${(13 * skala * (fontUkuran / 13)).toFixed(2)}px`,
        fontFamily: fontNama ? `'${fontNama}', 'Inter', system-ui, sans-serif` : undefined,
      }}
    >
      {tema === 'analitik' ? (
        <>
          {/* Analitik: garis volume (8) + cincin anggaran (4), lalu strip KPI, lalu daftar indikator. */}
          <div className={`grid grid-cols-1 lg:grid-cols-12 gap-[0.8em]${penuh ? ' flex-1 min-h-0' : ''}`}>
            <KartuSumber
              aktif={sumberAktif}
              judul="Rantai volume air"
              sumber={n?.sumber.volume ?? []}
              className={`lg:col-span-8 ${kartuKelas} flex flex-col`}
              style={bingkai}
              {...warnaProp}
            >
              <p className={judulKelas} style={{ color: d.teks3 }}>
                {volume?.label || 'Rantai volume air'}
              </p>
              <WidgetChart
                chartId={'garis-tren'}
                varian={'analitik'}
                skala={skala}
                data={{    kategori: volume?.kategori ?? [],
    seri: [{ nama: volume?.label || 'Volume', data: volume?.data ?? [] }],
    satuan: volume?.satuan,
    desimal: 1,}}
                className={penuh ? 'w-full flex-1 min-h-0' : 'w-full'}
                tinggi={penuh ? '100%' : '14em'}
              />
            </KartuSumber>

            <KartuSumber
              aktif={sumberAktif}
              judul="Anggaran per program"
              sumber={n?.sumber.anggaran ?? []}
              className={`lg:col-span-4 ${kartuKelas} flex flex-col`}
              style={bingkai}
              {...warnaProp}
            >
              <p className={judulKelas} style={{ color: d.teks3 }}>
                {anggaran?.label || 'Anggaran'}
              </p>
              <WidgetChart
                chartId={'donat-tebal'}
                varian={'analitik'}
                skala={skala}
                data={{    kategori: (anggaran?.bagian ?? []).map((b) => b.label),
    seri: [{ nama: 'Anggaran', data: (anggaran?.bagian ?? []).map((b) => b.nilai) }],
    satuan: anggaran?.satuan,
    desimal: 1,}}
                className={penuh ? 'w-full flex-1 min-h-0' : 'w-full'}
                tinggi={penuh ? '100%' : '14em'}
              />
            </KartuSumber>
          </div>

          {stripKpi}

          <KartuSumber
            aktif={sumberAktif}
            judul="Indikator pelayanan & mutu"
            sumber={n?.sumber.indikator ?? []}
            className={`${kartuKelas} shrink-0 flex flex-col`}
            style={bingkai}
            {...warnaProp}
          >
            <p className={judulKelas} style={{ color: d.teks3 }}>
              Target vs realisasi
            </p>
            <div className="mt-[0.4em] grid grid-cols-1 md:grid-cols-2 gap-x-[1.2em] gap-y-[0.35em]">
              {indikator.slice(0, 8).map((i) => {
                const capai = i.target ? (i.realisasi / i.target) * 100 : 0;
                return (
                  <div key={i.nama} className="flex items-center gap-[0.5em] text-[0.72em] min-w-0">
                    <span className="truncate w-[45%]" style={{ color: d.teks2 }}>
                      {i.nama}
                    </span>
                    <span className="flex-1 h-[0.42em] rounded-full overflow-hidden" style={{ backgroundColor: d.kartu2 }}>
                      <span
                        className="block h-full"
                        style={{ width: `${Math.min(100, capai)}%`, backgroundColor: capai >= 100 ? d.hijau : d.aksen }}
                      />
                    </span>
                    <span className="tabular-nums font-bold shrink-0" style={{ color: d.teks }}>
                      {i.realisasi.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })}
              {!indikator.length && (
                <p className="text-[0.74em]" style={{ color: d.teks3 }}>
                  Dokumen belum memuat indikator pelayanan.
                </p>
              )}
            </div>
          </KartuSumber>
        </>
      ) : (
        <>
          {/* Trafik: satu area lebar, lalu tiga kartu setara, strip KPI di bawah. */}
          <KartuSumber
            aktif={sumberAktif}
            judul="Volume air"
            sumber={n?.sumber.volume ?? []}
            className={`${kartuKelas} flex flex-col${penuh ? ' flex-1 min-h-0' : ''}`}
            style={bingkai}
            {...warnaProp}
          >
            <div className="flex items-center justify-between gap-2">
              <p className={judulKelas} style={{ color: d.teks3 }}>
                {volume?.label || 'Volume air'}
              </p>
              <span className="text-[0.9em] font-extrabold" style={{ color: d.teks }}>
                {n ? `${ringkasOperasional(n.kpi.airTerjual, volume?.satuan ?? 'm³')} ${volume?.satuan ?? 'm³'}` : '—'}
              </span>
            </div>
            <WidgetChart
              chartId={'bar-tumpuk'}
              varian={'trafik'}
              skala={skala}
              data={{    kategori: volume?.kategori ?? [],
    seri: [{ nama: volume?.label || 'Volume', data: volume?.data ?? [] }],
    satuan: volume?.satuan,
    desimal: 1,}}
              className={penuh ? 'w-full flex-1 min-h-0' : 'w-full'}
              tinggi={penuh ? '100%' : '12em'}
            />
          </KartuSumber>

          <div className={`grid grid-cols-1 lg:grid-cols-3 gap-[0.8em]${penuh ? ' flex-1 min-h-0' : ' mt-[0.8em]'}`}>
            <KartuSumber
              aktif={sumberAktif}
              judul="Indikator pelayanan"
              sumber={n?.sumber.indikator ?? []}
              className={`${kartuKelas} flex flex-col`}
              style={bingkai}
              {...warnaProp}
            >
              <p className={judulKelas} style={{ color: d.teks3 }}>
                Realisasi indikator
              </p>
              <WidgetChart
                chartId={'bar-tegak'}
                varian={'trafik'}
                skala={skala}
                data={{    kategori: indikator.slice(0, 6).map((i) => i.nama),
    seri: [{ nama: 'Realisasi', data: indikator.slice(0, 6).map((i) => i.realisasi) }],
    satuan: '%',
    desimal: 1,}}
                className={penuh ? 'w-full flex-1 min-h-0' : 'w-full'}
                tinggi={penuh ? '100%' : '10em'}
              />
            </KartuSumber>

            <KartuSumber
              aktif={sumberAktif}
              judul="Anggaran per program"
              sumber={n?.sumber.anggaran ?? []}
              className={`${kartuKelas} flex flex-col`}
              style={bingkai}
              {...warnaProp}
            >
              <p className={judulKelas} style={{ color: d.teks3 }}>
                {anggaran?.label || 'Anggaran'}
              </p>
              <WidgetChart
                chartId={'donat-tebal'}
                varian={'trafik'}
                skala={skala}
                data={{    kategori: (anggaran?.bagian ?? []).map((b) => b.label),
    seri: [{ nama: 'Anggaran', data: (anggaran?.bagian ?? []).map((b) => b.nilai) }],
    satuan: anggaran?.satuan,
    desimal: 1,}}
                className={penuh ? 'w-full flex-1 min-h-0' : 'w-full'}
                tinggi={penuh ? '100%' : '10em'}
              />
            </KartuSumber>

            <KartuSumber
              aktif={sumberAktif}
              judul="Rincian indikator"
              sumber={n?.sumber.indikator ?? []}
              className={`${kartuKelas} flex flex-col`}
              style={bingkai}
              {...warnaProp}
            >
              <p className={judulKelas} style={{ color: d.teks3 }}>
                Target dan realisasi
              </p>
              <ul className="mt-[0.3em] space-y-[0.25em] overflow-auto">
                {indikator.slice(0, 6).map((i) => (
                  <li key={i.nama} className="flex items-center gap-[0.4em] text-[0.7em] min-w-0">
                    <span className="truncate" style={{ color: d.teks2 }}>
                      {i.nama}
                    </span>
                    <span className="ml-auto tabular-nums" style={{ color: d.teks }}>
                      {i.realisasi.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
                    </span>
                    <span className="tabular-nums text-[0.9em]" style={{ color: d.teks3 }}>
                      / {i.target.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
                    </span>
                  </li>
                ))}
                {!indikator.length && (
                  <li className="text-[0.74em]" style={{ color: d.teks3 }}>
                    Dokumen belum memuat indikator.
                  </li>
                )}
              </ul>
            </KartuSumber>
          </div>

          {stripKpi}
        </>
      )}

      {kpiSumber && (
        <PitaSumber
          judul={kpiSumber}
          sumber={
            // Sumber dipilih menurut kartu KPI yang dibuka, bukan selalu volume.
            kpiSumber === 'NRW'
              ? n?.sumber.nrw ?? []
              : kpiSumber === 'Penyelesaian SLA'
                ? n?.sumber.indikator ?? []
                : kpiSumber && /anggaran/i.test(kpiSumber)
                  ? n?.sumber.anggaran ?? []
                  : n?.sumber.volume ?? []
          }
          onTutup={() => setKpiSumber(null)}
          warnaTeks={d.teks}
          warnaTeks2={d.teks2}
          warnaTeks3={d.teks3}
          warnaPanel={KARTU}
          aksen={d.aksen}
          border={`1px solid ${d.garis}`}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* HALAMAN 3 — KINERJA PER WILAYAH                                     */
/* ------------------------------------------------------------------ */

export const WilayahTema: React.FC<DasarProps & { tema: Tema; nilai?: NilaiWilayah }> = ({
  tema,
  nilai,
  penuh = false,
  fontUkuran = 13,
  fontNama,
  warnaKartu,
  contoh = false,
  sumberAktif = false,
}) => {
  const d = DESAIN[tema];
  const n = nilai;
  const KARTU = warnaKartu || d.kartu;
  const { akarRef, skala } = useGrafik(penuh, [nilai, tema]);
  const [kpiSumber, setKpiSumber] = useState<string | null>(null);

  const baris = n?.baris ?? [];
  const urutWilayah = [...baris].sort((a, b) => (a.per1000 ?? 0) - (b.per1000 ?? 0));
  const total = n?.total ?? null;
  const sumber = n?.sumber ?? [];

  const sumbu = (ekstra?: any) => ({
    axisLine: { lineStyle: { color: d.garis } },
    axisTick: { show: false },
    axisLabel: { color: d.teks3, fontSize: 10 },
    splitLine: { lineStyle: { color: d.garis, type: 'dashed' } },
    ...ekstra,
  });

  const kpi = useMemo(
    () => [
      { label: 'Pelanggan', nilai: total?.pelanggan ?? 0, satuan: 'sambungan' },
      { label: 'Air terjual', nilai: total?.airTerjual ?? 0, satuan: 'm³' },
      { label: 'NRW', nilai: total?.nrw ?? 0, satuan: '%' },
      { label: 'Pengaduan', nilai: total?.pengaduan ?? 0, satuan: 'kasus' },
    ],
    [total]
  );

  // Varian katalog mengikuti tema kartu: Lensa = analitik, Nadi = trafik.
  const varianKartu = tema === 'analitik' ? 'analitik' : 'trafik';
  const idUtama = varianKartu === 'analitik' ? 'scatter-gelembung' : 'bar-tumpuk';
  const kartuKelas = `${d.radius} border overflow-hidden p-[0.95em]`;
  const judulKelas = 'text-[0.7em] font-bold uppercase tracking-[0.12em]';
  const bingkai = { backgroundColor: KARTU, borderColor: d.garis };
  const warnaProp = { warnaTeks: d.teks, warnaTeks2: d.teks2, warnaTeks3: d.teks3, warnaPanel: KARTU, aksen: d.aksen };

  const stripKpi = (
    <WidgetChart
      chartId="kpi-strip"
      varian={varianKartu}
      skala={skala}
      className="w-full shrink-0"
      data={{
        kategori: kpi.map((k) => k.label),
        seri: [{ nama: 'Total', data: kpi.map((k) => k.nilai) }],
        // Satuan tiap petak dititipkan di catatan; wajah katalog yang membaca.
        catatan: kpi.map((k) => k.satuan),
      }}
      onKlikItem={
        sumberAktif ? (i) => setKpiSumber((v) => (v === kpi[i].label ? null : kpi[i].label)) : undefined
      }
    />
  );

  const tabel = (
    <KartuSumber
      aktif={sumberAktif}
      judul="Tabel wilayah"
      sumber={sumber}
      className={`${kartuKelas} shrink-0 flex flex-col`}
      style={bingkai}
      {...warnaProp}
    >
      <WidgetChart
        chartId="tabel-ringkas"
        varian={varianKartu}
        skala={skala}
        className="w-full"
        data={{
          kategori: ['Tabel wilayah'],
          seri: [{ nama: 'Wilayah', data: [] }],
          tabel: {
            kepala: ['Wilayah', 'Pelanggan', 'Air terjual (m³)', 'NRW', 'Pengaduan'],
            baris: baris.map((b) => [
              b.wilayah,
              b.pelanggan.toLocaleString('id-ID'),
              b.airTerjual.toLocaleString('id-ID'),
              `${b.nrw.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`,
              b.pengaduan.toLocaleString('id-ID'),
            ]),
            kolomSorot: 3,
            ambang: total?.nrw ?? 0,
          },
        }}
      />
    </KartuSumber>
  );

  return (
    <div
      ref={akarRef}
      className={penuh ? 'h-full w-full p-[0.85em] overflow-hidden flex flex-col gap-[0.8em]' : `${d.radius} p-[1.2em]`}
      style={{
        backgroundColor: d.latar,
        color: d.teks,
        fontSize: `${(13 * skala * (fontUkuran / 13)).toFixed(2)}px`,
        fontFamily: fontNama ? `'${fontNama}', 'Inter', system-ui, sans-serif` : undefined,
      }}
    >
      {!baris.length && (
        <div className={`${kartuKelas} shrink-0`} style={bingkai}>
          <p className={judulKelas} style={{ color: d.teks3 }}>
            Kinerja per wilayah
          </p>
          <p className="text-[0.78em] mt-[0.4em]" style={{ color: d.teks2 }}>
            {contoh ? 'Data contoh belum dimuat.' : 'Dokumen belum memuat tabel kinerja per wilayah.'}
          </p>
        </div>
      )}

      {baris.length > 0 && tema === 'analitik' && (
        <>
          <div className={`grid grid-cols-1 lg:grid-cols-12 gap-[0.8em]${penuh ? ' flex-1 min-h-0' : ''}`}>
            <KartuSumber
              aktif={sumberAktif}
              judul="Peta wilayah"
              sumber={sumber}
              className={`lg:col-span-8 ${kartuKelas} flex flex-col`}
              style={bingkai}
              {...warnaProp}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={judulKelas} style={{ color: d.teks3 }}>
                  Pelanggan vs air terjual
                </p>
                <span className="text-[0.62em]" style={{ color: d.teks3 }}>
                  besar gelembung = pengaduan
                </span>
              </div>
            <WidgetChart
              chartId={idUtama}
              varian={varianKartu}
              skala={skala}
              data={{    kategori: baris.map((b) => b.wilayah.replace('Jakarta ', '')),
    seri: [{ nama: 'Air terjual', data: baris.map((b) => Number((b.airTerjual / 1_000_000).toFixed(2))) }],
    satuan: 'jt m³',
    desimal: 1,}}
              className={penuh ? 'w-full flex-1 min-h-0' : 'w-full'}
              tinggi={penuh ? '100%' : '14em'}
            />
            </KartuSumber>

            <KartuSumber
              aktif={sumberAktif}
              judul="NRW per wilayah"
              sumber={sumber}
              className={`lg:col-span-4 ${kartuKelas} flex flex-col`}
              style={bingkai}
              {...warnaProp}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={judulKelas} style={{ color: d.teks3 }}>
                  Kehilangan air
                </p>
                <span className="text-[0.9em] font-extrabold" style={{ color: d.merah }}>
                  {total ? `${total.nrw.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%` : '—'}
                </span>
              </div>
              {/* Bilah HTML, bukan grafik polar: grafik polar butuh modul ECharts
                  tambahan dan pernah membuat kanvas kosong. */}
              <ul className="mt-[0.4em] space-y-[0.4em] overflow-auto">
                {[...baris]
                  .sort((a, b) => b.nrw - a.nrw)
                  .map((b) => {
                    const lebar = Math.min(100, (b.nrw / Math.max(50, (total?.nrw ?? 40) + 8)) * 100);
                    return (
                      <li key={b.wilayah} className="text-[0.7em]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate" style={{ color: d.teks2 }}>
                            {b.wilayah.replace('Jakarta ', '')}
                          </span>
                          <span className="tabular-nums font-bold" style={{ color: b.nrw > (total?.nrw ?? 0) ? d.merah : d.hijau }}>
                            {b.nrw.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%
                          </span>
                        </div>
                        <span className="block h-[0.4em] rounded-full overflow-hidden mt-[0.15em]" style={{ backgroundColor: d.kartu2 }}>
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${lebar}%`, backgroundColor: b.nrw > (total?.nrw ?? 0) ? d.merah : d.aksen }}
                          />
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </KartuSumber>
          </div>

          {stripKpi}
          {tabel}
        </>
      )}

      {baris.length > 0 && tema === 'trafik' && (
        <>
          <KartuSumber
            aktif={sumberAktif}
            judul="Air terjual & NRW per wilayah"
            sumber={sumber}
            className={`${kartuKelas} flex flex-col${penuh ? ' flex-1 min-h-0' : ''}`}
            style={bingkai}
            {...warnaProp}
          >
            <p className={judulKelas} style={{ color: d.teks3 }}>
              Air terjual dan kehilangan air
            </p>
            <WidgetChart
              chartId="bar-tumpuk"
              varian={varianKartu}
              skala={skala}
              data={{
                kategori: baris.map((b) => b.wilayah.replace('Jakarta ', '')),
                seri: [
                  { nama: 'Air terjual', data: baris.map((b) => Number((b.airTerjual / 1_000_000).toFixed(2))) },
                  {
                    nama: 'Kehilangan',
                    data: baris.map((b) => Number(((b.airTerjual * (b.nrw / 100)) / 1_000_000).toFixed(2))),
                  },
                ],
                satuan: 'jt m³',
                desimal: 1,
              }}
              className={penuh ? 'w-full flex-1 min-h-0' : 'w-full'}
              tinggi={penuh ? '100%' : '12em'}
            />
          </KartuSumber>

          {stripKpi}

          <div className={`grid grid-cols-1 lg:grid-cols-12 gap-[0.8em]${penuh ? ' flex-1 min-h-0' : ' mt-[0.8em]'}`}>
            <KartuSumber
              aktif={sumberAktif}
              judul="Pengaduan per 1.000"
              sumber={sumber}
              className={`lg:col-span-7 ${kartuKelas} flex flex-col`}
              style={bingkai}
              {...warnaProp}
            >
              <p className={judulKelas} style={{ color: d.teks3 }}>
                Pengaduan per 1.000 pelanggan
              </p>
              <WidgetChart
                chartId={'bar-mendatar-peringkat'}
                varian={varianKartu}
                skala={skala}
                data={{    kategori: urutWilayah.map((b) => b.wilayah.replace('Jakarta ', '')),
    seri: [{ nama: 'Pengaduan per 1.000', data: urutWilayah.map((b) => b.per1000 ?? 0) }],
    satuan: 'per 1.000 pelanggan',
    desimal: 1,}}
                className={penuh ? 'w-full flex-1 min-h-0' : 'w-full'}
                tinggi={penuh ? '100%' : '10em'}
              />
            </KartuSumber>

            <KartuSumber
              aktif={sumberAktif}
              judul="Sebaran pelanggan"
              sumber={sumber}
              className={`lg:col-span-5 ${kartuKelas} flex flex-col`}
              style={bingkai}
              {...warnaProp}
            >
              <p className={judulKelas} style={{ color: d.teks3 }}>
                Sebaran pelanggan
              </p>
              <WidgetChart
                chartId={'donat-tebal'}
                varian={varianKartu}
                skala={skala}
                data={{    kategori: baris.map((b) => b.wilayah),
    seri: [{ nama: 'Pelanggan', data: baris.map((b) => b.pelanggan) }],
    satuan: 'pelanggan',
    desimal: 0,}}
                className={penuh ? 'w-full flex-1 min-h-0' : 'w-full'}
                tinggi={penuh ? '100%' : '10em'}
              />
            </KartuSumber>
          </div>
        </>
      )}

      {kpiSumber && (
        <PitaSumber
          judul={kpiSumber}
          sumber={sumber}
          onTutup={() => setKpiSumber(null)}
          warnaTeks={d.teks}
          warnaTeks2={d.teks2}
          warnaTeks3={d.teks3}
          warnaPanel={KARTU}
          aksen={d.aksen}
          border={`1px solid ${d.garis}`}
        />
      )}
    </div>
  );
};
