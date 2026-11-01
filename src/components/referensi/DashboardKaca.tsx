import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { WidgetChart } from '../widgets/WidgetChart';
import { KartuSumber } from './KartuSumber';
import { GAYA } from '../../services/chart/gayaVarian';
import type { NilaiTemplate } from '../../services/templates/nilaiTemplate';
import { CONTOH_OPERASIONAL, ringkasOperasional, type NilaiOperasional } from '../../services/templates/nilaiOperasional';
import { CONTOH_WILAYAH, ringkasWilayah, type NilaiWilayah } from '../../services/templates/wilayahLayanan';

/**
 * TEMPLATE KACA — kartu bening di atas latar hangat.
 *
 * Bahasa desainnya: kartu tembus pandang yang mengaburkan latar (glassmorphism),
 * sudut besar, teks gelap, aksen hijau tua dan jingga, tombol pil hitam.
 * Tiga halaman seperti template lain:
 *  - Halaman 1 (`KacaRingkasan`): ringkasan keuangan, data sama dengan Pijar.
 *  - Halaman 2 (`KacaOperasional`): operasional & pelayanan, cincin capaian.
 *  - Halaman 3 (`KacaWilayah`): kinerja per wilayah dan tabel laporan.
 *
 * Semua grafik diambil dari katalog Template Chart dengan varian `kaca`.
 */

const G = GAYA.kaca;

const KARTU_KACA: React.CSSProperties = {
  backgroundColor: G.kartu,
  borderColor: 'rgba(255,255,255,0.55)',
  backdropFilter: 'blur(22px) saturate(150%)',
  WebkitBackdropFilter: 'blur(22px) saturate(150%)',
  boxShadow: '0 10px 30px rgba(60,40,20,0.12), inset 0 1px 0 rgba(255,255,255,0.6)',
};
const kartuKelas = 'rounded-[1.4em] border p-[1em] flex flex-col min-h-0 min-w-0';
const judulKelas = 'text-[0.8em] font-semibold';
const warnaProp = {
  warnaTeks: G.teks,
  warnaTeks2: G.teks2,
  warnaTeks3: G.teks3,
  warnaPanel: 'rgba(250,245,238,0.97)',
  aksen: G.aksen,
};

interface DasarProps {
  penuh?: boolean;
  /** true = angka contoh (galeri template). */
  contoh?: boolean;
  sumberAktif?: boolean;
  /** Warna kartu dari panel Gaya; kosong = kaca bening. */
  warnaKartu?: string;
}

/** Skala huruf mengikuti besar wadah saat layar penuh, sama seperti template lain. */
function useSkala(penuh: boolean) {
  const akarRef = useRef<HTMLDivElement | null>(null);
  const [skala, setSkala] = useState(1);
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
  return { akarRef, skala };
}

/** Bingkai halaman: latar hangat buram dan judul besar. */
const Bingkai: React.FC<{
  penuh: boolean;
  skala: number;
  akarRef: React.RefObject<HTMLDivElement | null>;
  judul: string;
  sub: string;
  contoh?: boolean;
  children: React.ReactNode;
}> = ({ penuh, skala, akarRef, judul, sub, contoh, children }) => (
  <div
    ref={akarRef}
    className={
      penuh
        ? 'h-full w-full p-[1.1em] overflow-hidden flex flex-col gap-[0.8em]'
        : 'rounded-[1.6em] p-[1.3em] flex flex-col gap-[0.8em]'
    }
    style={{ background: G.latarCss, color: G.teks, fontSize: `${(13 * skala).toFixed(2)}px` }}
  >
    <div className="flex items-end justify-between gap-[1em] shrink-0">
      <div className="min-w-0">
        <h2 className="text-[1.75em] font-semibold tracking-[-0.02em] leading-tight truncate">{judul}</h2>
        <p className="text-[0.78em] mt-[0.15em] truncate" style={{ color: G.teks2 }}>
          {sub}
        </p>
      </div>
      {contoh && (
        <span className="shrink-0 rounded-full px-[0.9em] py-[0.35em] text-[0.7em] font-semibold bg-[#17130e] text-white">
          Angka contoh
        </span>
      )}
    </div>
    {children}
  </div>
);

const kartuGaya = (warnaKartu?: string): React.CSSProperties =>
  warnaKartu ? { ...KARTU_KACA, backgroundColor: warnaKartu } : KARTU_KACA;

const tinggiChart = (penuh: boolean, em: number) => ({
  className: penuh ? 'w-full flex-1 min-h-0' : 'w-full',
  tinggi: penuh ? '100%' : `${em}em`,
});

/* ------------------------------------------------------------------ */
/* HALAMAN 1 — RINGKASAN KEUANGAN                                      */
/* ------------------------------------------------------------------ */

const CONTOH_RINGKASAN: Required<Pick<NilaiTemplate, 'kpi' | 'batang' | 'cincin' | 'transaksi' | 'area' | 'target' | 'insight'>> = {
  kpi: [
    { label: 'Total Saldo Kas', nilai: '48.750', satuan: 'juta Rp', delta: 12.4, deltaTeks: 'vs bulan lalu', naikBagus: true, seri: [30, 32, 31, 36, 38, 41, 44, 43, 46, 48.7] },
    { label: 'Pendapatan Usaha', nilai: '23.685', satuan: 'juta Rp', delta: 8.2, deltaTeks: 'vs bulan lalu', naikBagus: true, seri: [16, 17, 18.5, 18, 20, 21, 22.4, 22, 23, 23.7] },
    { label: 'Beban Operasional', nilai: '12.347', satuan: 'juta Rp', delta: -3.4, deltaTeks: 'vs bulan lalu', naikBagus: false, seri: [15, 14.6, 14.8, 14, 13.6, 13.9, 13.2, 12.9, 12.6, 12.35] },
    { label: 'Laba Bersih', nilai: '11.337', satuan: 'juta Rp', delta: 6.1, deltaTeks: 'vs bulan lalu', naikBagus: true, seri: [8, 8.4, 9, 8.8, 9.6, 10, 10.4, 10.6, 11, 11.34] },
  ],
  batang: {
    label: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
    nilai: [14.2, 15.6, 16.1, 17.4, 19.8, 18.6, 20.2, 21.1, 20.4, 22.3, 23.0, 23.7],
  },
  cincin: [
    { nama: 'Operasional', nilai: 25.9, warna: G.palet[0] },
    { nama: 'Pemeliharaan', nilai: 23.1, warna: G.palet[1] },
    { nama: 'Pegawai', nilai: 19.8, warna: G.palet[2] },
    { nama: 'Investasi', nilai: 17.0, warna: G.palet[3] },
    { nama: 'Lain-lain', nilai: 14.2, warna: G.palet[4] },
  ],
  transaksi: [
    { nama: 'Pembayaran pelanggan', ket: 'Wilayah Jakarta Selatan', nilai: '+1,24 M', naik: true, Ikon: ArrowUpRight },
    { nama: 'Pemeliharaan jaringan', ket: 'Zona 3 · vendor', nilai: '-486 jt', naik: false, Ikon: ArrowDownRight },
    { nama: 'Setoran kas ke bank', ket: 'Rekening operasional', nilai: '+2,10 M', naik: true, Ikon: ArrowUpRight },
    { nama: 'Gaji & tunjangan', ket: 'Periode Mei', nilai: '-3,72 M', naik: false, Ikon: ArrowDownRight },
    { nama: 'Tagihan listrik', ket: 'Pompa & IPA', nilai: '-1,08 M', naik: false, Ikon: ArrowDownRight },
  ],
  area: [3.2, 3.6, 3.4, 4.1, 4.6, 4.3, 5.0, 5.4, 5.1, 5.8, 6.2, 5.9, 6.4, 6.9, 6.6, 7.2, 7.6, 7.3, 7.9, 8.4],
  target: [
    { nama: 'Target Pendapatan', capai: 86, status: 'mendekati target', warna: G.aksen2 },
    { nama: 'Efisiensi Beban', capai: 92, status: 'sesuai target', warna: G.hijau },
    { nama: 'Target Laba Bersih', capai: 57, status: 'perlu perhatian', warna: G.merah },
  ],
  insight:
    'Pendapatan tumbuh 8,2% sementara beban turun 3,4%. Perhatian pada realisasi investasi yang baru 57% dari target.',
};

export const KacaRingkasan: React.FC<DasarProps & { nilai?: NilaiTemplate }> = ({ nilai, penuh = false, warnaKartu }) => {
  const { akarRef, skala } = useSkala(penuh);
  const contoh = !nilai;
  const kpi = nilai?.kpi?.length ? nilai.kpi : CONTOH_RINGKASAN.kpi;
  const batang = nilai?.batang?.label?.length ? nilai.batang : CONTOH_RINGKASAN.batang;
  const cincin = nilai?.cincin?.length ? nilai.cincin : CONTOH_RINGKASAN.cincin;
  const transaksi = nilai?.transaksi?.length ? nilai.transaksi : CONTOH_RINGKASAN.transaksi;
  const area = nilai?.area?.length ? nilai.area : CONTOH_RINGKASAN.area;
  const areaLabel = nilai?.areaLabel?.length ? nilai.areaLabel : area.map((_, i) => `H${i + 1}`);
  const target = nilai?.target?.length ? nilai.target : CONTOH_RINGKASAN.target;
  const insight = nilai?.insight || CONTOH_RINGKASAN.insight;
  const gaya = kartuGaya(warnaKartu);
  const [utama, ...lain] = kpi;
  // Petak kanan: tiga KPI berikutnya, lalu capaian target pertama.
  const petak = [
    ...lain.slice(0, 3).map((k) => ({ label: k.label, nilai: k.nilai, satuan: k.satuan, delta: k.delta, naikBagus: k.naikBagus })),
    ...(target[0] ? [{ label: target[0].nama, nilai: `${target[0].capai}%`, satuan: '', delta: undefined as number | undefined, naikBagus: true }] : []),
  ].slice(0, 4);

  return (
    <Bingkai
      penuh={penuh}
      skala={skala}
      akarRef={akarRef}
      judul="Ringkasan keuangan"
      sub="Saldo, pendapatan, beban, dan aktivitas kas terbaru"
      contoh={contoh}
    >
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-[0.8em]${penuh ? ' flex-1 min-h-0' : ''}`}>
        {/* Angka utama + arus kas */}
        <div className={`lg:col-span-3 ${kartuKelas}`} style={gaya}>
          <p className={judulKelas} style={{ color: G.teks2 }}>
            {utama?.label}
          </p>
          <p className="text-[2em] font-semibold tracking-[-0.02em] leading-tight mt-[0.2em] tabular-nums">
            {utama?.nilai}
            <span className="text-[0.4em] font-medium ml-[0.35em]" style={{ color: G.teks3 }}>
              {utama?.satuan}
            </span>
          </p>
          {utama && <ChipDelta delta={utama.delta} naikBagus={utama.naikBagus} teks={utama.deltaTeks} />}
          <p className="text-[0.7em] mt-[0.8em]" style={{ color: G.teks3 }}>
            {nilai?.areaSub || 'Arus kas harian'}
          </p>
          <WidgetChart
            chartId="area-gradasi"
            varian="kaca"
            skala={skala}
            data={{ kategori: areaLabel, seri: [{ nama: 'Arus kas', data: area }], desimal: 1 }}
            {...tinggiChart(penuh, 9)}
          />
        </div>

        {/* Petak 2x2 */}
        <div className="lg:col-span-4 grid grid-cols-2 gap-[0.8em] min-h-0">
          {petak.map((p, i) => (
            <div
              key={p.label}
              className={`${kartuKelas} justify-between`}
              style={i === 0 ? { ...gaya, backgroundColor: 'rgba(47,143,125,0.82)', color: '#fff' } : gaya}
            >
              <p className="text-[0.74em] font-semibold leading-tight" style={{ color: i === 0 ? 'rgba(255,255,255,0.85)' : G.teks2 }}>
                {p.label}
              </p>
              <div>
                <p className="text-[1.55em] font-semibold tracking-[-0.02em] leading-tight tabular-nums">{p.nilai}</p>
                <p className="text-[0.66em] mt-[0.15em]" style={{ color: i === 0 ? 'rgba(255,255,255,0.75)' : G.teks3 }}>
                  {p.satuan || 'capaian target'}
                  {typeof p.delta === 'number' && (
                    <span className="ml-[0.4em] font-semibold" style={{ color: i === 0 ? '#fff' : warnaDelta(p.delta, p.naikBagus) }}>
                      {p.delta > 0 ? '+' : ''}
                      {String(p.delta).replace('.', ',')}%
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Batang kapsul pendapatan */}
        <div className={`lg:col-span-5 ${kartuKelas}`} style={gaya}>
          <div className="flex items-center justify-between gap-[0.5em]">
            <p className={judulKelas}>Pendapatan</p>
            <span className="text-[0.66em] rounded-full px-[0.7em] py-[0.2em] bg-white/60" style={{ color: G.teks2 }}>
              {nilai?.batangSub || 'per bulan'}
            </span>
          </div>
          <WidgetChart
            chartId="bar-kapsul"
            varian="kaca"
            skala={skala}
            data={{ kategori: batang.label, seri: [{ nama: 'Pendapatan', data: batang.nilai }], desimal: 1 }}
            {...tinggiChart(penuh, 13)}
          />
        </div>
      </div>

      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-[0.8em]${penuh ? ' flex-1 min-h-0' : ''}`}>
        <div className={`lg:col-span-4 ${kartuKelas}`} style={gaya}>
          <p className={judulKelas}>{nilai?.cincinJudul || 'Rincian beban'}</p>
          <WidgetChart
            chartId="donat-tebal"
            varian="kaca"
            skala={skala}
            data={{ kategori: cincin.map((c) => c.nama), seri: [{ nama: 'Beban', data: cincin.map((c) => c.nilai) }], desimal: 1 }}
            {...tinggiChart(penuh, 12)}
          />
        </div>

        {/* Aktivitas kas terbaru */}
        <div className={`lg:col-span-8 ${kartuKelas}`} style={gaya}>
          <p className={judulKelas}>{nilai?.tabelJudul || 'Aktivitas kas terbaru'}</p>
          <div className="mt-[0.5em] flex-1 min-h-0 overflow-hidden">
            <table className="w-full text-[0.74em]">
              <thead>
                <tr style={{ color: G.teks3 }}>
                  <th className="text-left font-medium pb-[0.4em]">Kegiatan</th>
                  <th className="text-left font-medium pb-[0.4em]">Keterangan</th>
                  <th className="text-right font-medium pb-[0.4em]">Nilai</th>
                  <th className="text-right font-medium pb-[0.4em]">Arah</th>
                </tr>
              </thead>
              <tbody>
                {transaksi.slice(0, 5).map((t) => (
                  <tr key={`${t.nama}-${t.ket}`} className="border-t" style={{ borderColor: 'rgba(40,30,20,0.1)' }}>
                    <td className="py-[0.45em] font-medium truncate max-w-0 w-[34%]">{t.nama}</td>
                    <td className="py-[0.45em] truncate max-w-0 w-[34%]" style={{ color: G.teks2 }}>
                      {t.ket}
                    </td>
                    <td className="py-[0.45em] text-right tabular-nums font-semibold">{t.nilai}</td>
                    <td className="py-[0.45em] text-right">
                      <span
                        className="inline-flex items-center gap-[0.25em] rounded-full px-[0.6em] py-[0.1em] text-[0.9em] font-semibold"
                        style={{ backgroundColor: t.naik ? 'rgba(31,138,91,0.14)' : 'rgba(217,71,43,0.14)', color: t.naik ? G.hijau : G.merah }}
                      >
                        <span className="w-[0.45em] h-[0.45em] rounded-full" style={{ backgroundColor: 'currentColor' }} />
                        {t.naik ? 'Masuk' : 'Keluar'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Insight + progres target */}
      <div className={`${kartuKelas} shrink-0 lg:flex-row lg:items-center gap-[1em]`} style={gaya}>
        <p className="text-[0.76em] leading-relaxed flex-1 min-w-0" style={{ color: G.teks2 }}>
          {insight}
        </p>
        <div className="flex flex-wrap gap-[0.6em] shrink-0">
          {target.slice(0, 3).map((t) => (
            <div key={t.nama} className="rounded-full bg-white/55 px-[0.8em] py-[0.35em] flex items-center gap-[0.5em] text-[0.7em]">
              <span className="font-medium">{t.nama}</span>
              <span className="w-[4.5em] h-[0.4em] rounded-full overflow-hidden bg-black/10">
                <span className="block h-full rounded-full" style={{ width: `${Math.min(100, t.capai)}%`, backgroundColor: warnaCapai(t.capai) }} />
              </span>
              <span className="font-bold tabular-nums">{t.capai}%</span>
            </div>
          ))}
        </div>
      </div>
    </Bingkai>
  );
};

const warnaDelta = (delta: number, naikBagus: boolean) => ((delta >= 0) === naikBagus ? G.hijau : G.merah);
const warnaCapai = (capai: number) => (capai >= 90 ? G.hijau : capai >= 70 ? G.aksen2 : G.merah);

const ChipDelta: React.FC<{ delta: number; naikBagus: boolean; teks?: string }> = ({ delta, naikBagus, teks }) => {
  const warna = warnaDelta(delta, naikBagus);
  return (
    <div className="flex items-center gap-[0.4em] mt-[0.4em] text-[0.7em]">
      <span
        className="inline-flex items-center gap-[0.15em] rounded-full px-[0.55em] py-[0.1em] font-semibold"
        style={{ color: warna, backgroundColor: `${warna}1f` }}
      >
        {delta >= 0 ? <ArrowUpRight className="w-[1em] h-[1em]" /> : <ArrowDownRight className="w-[1em] h-[1em]" />}
        {delta > 0 ? '+' : ''}
        {String(delta).replace('.', ',')}%
      </span>
      {teks && <span style={{ color: G.teks3 }}>{teks}</span>}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* HALAMAN 2 — OPERASIONAL & PELAYANAN                                 */
/* ------------------------------------------------------------------ */

export const KacaOperasional: React.FC<DasarProps & { nilai?: NilaiOperasional }> = ({
  nilai,
  penuh = false,
  contoh = false,
  sumberAktif = false,
  warnaKartu,
}) => {
  const { akarRef, skala } = useSkala(penuh);
  const n = nilai ?? CONTOH_OPERASIONAL;
  const gaya = kartuGaya(warnaKartu);
  const volume = n.volume;
  const anggaran = n.anggaran;
  const indikator = [...(n.pelayanan?.indikator ?? []), ...(n.mutu?.indikator ?? [])].slice(0, 5);
  const airBaku = volume?.data?.[0];

  return (
    <Bingkai
      penuh={penuh}
      skala={skala}
      akarRef={akarRef}
      judul="Operasional & pelayanan"
      sub="Rantai volume air, capaian indikator layanan, dan anggaran program"
      contoh={contoh}
    >
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-[0.8em]${penuh ? ' flex-1 min-h-0' : ''}`}>
        <KartuSumber
          aktif={sumberAktif}
          judul="Volume air"
          sumber={n.sumber.volume}
          className={`lg:col-span-8 ${kartuKelas}`}
          style={gaya}
          kelasIsi="flex flex-col lg:flex-row gap-[1em] flex-1 min-h-0"
          {...warnaProp}
        >
          <div className="lg:w-[30%] shrink-0 flex flex-col">
            <p className={judulKelas} style={{ color: G.teks2 }}>
              Air terjual
            </p>
            <p className="text-[2em] font-semibold tracking-[-0.02em] leading-tight tabular-nums mt-[0.2em]">
              {ringkasOperasional(n.kpi.airTerjual)}
              <span className="text-[0.4em] font-medium ml-[0.3em]" style={{ color: G.teks3 }}>
                {volume?.satuan ?? 'm³'}
              </span>
            </p>
            {typeof airBaku === 'number' && airBaku > 0 && (
              <>
                <p className="text-[0.7em] mt-[0.3em]" style={{ color: G.teks3 }}>
                  {Math.round((n.kpi.airTerjual / airBaku) * 100)}% dari air baku {ringkasOperasional(airBaku)}
                </p>
                <span className="mt-[0.6em] h-[0.5em] rounded-full overflow-hidden bg-black/10">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${Math.min(100, (n.kpi.airTerjual / airBaku) * 100)}%`, backgroundColor: G.aksen2 }}
                  />
                </span>
              </>
            )}
            <div className="mt-auto pt-[0.8em] flex flex-wrap gap-[0.4em]">
              <span className="rounded-full bg-[#17130e] text-white px-[0.8em] py-[0.3em] text-[0.68em] font-semibold">
                NRW {String(n.kpi.nrw).replace('.', ',')}%
              </span>
              <span className="rounded-full bg-white/60 px-[0.8em] py-[0.3em] text-[0.68em] font-semibold">
                SLA {String(n.kpi.sla).replace('.', ',')}%
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            <p className="text-[0.66em] mb-[0.2em]" style={{ color: G.teks3 }}>
              {volume?.label || 'Rantai volume air'}
            </p>
            <WidgetChart
              chartId="bar-kapsul"
              varian="kaca"
              skala={skala}
              data={{ kategori: volume?.kategori ?? [], seri: [{ nama: volume?.label || 'Volume', data: volume?.data ?? [] }], satuan: volume?.satuan, desimal: 1 }}
              {...tinggiChart(penuh, 13)}
            />
          </div>
        </KartuSumber>

        <KartuSumber
          aktif={sumberAktif}
          judul="Anggaran per program"
          sumber={n.sumber.anggaran}
          className={`lg:col-span-4 ${kartuKelas}`}
          style={gaya}
          {...warnaProp}
        >
          <div className="flex items-center justify-between gap-[0.5em]">
            <p className={judulKelas}>{anggaran?.label || 'Anggaran'}</p>
            <span className="text-[0.7em] font-bold tabular-nums">
              {ringkasOperasional(n.kpi.anggaran)} {anggaran?.satuan ?? ''}
            </span>
          </div>
          <WidgetChart
            chartId="bar-mendatar-peringkat"
            varian="kaca"
            skala={skala}
            data={{
              kategori: (anggaran?.bagian ?? []).map((b) => b.label),
              seri: [{ nama: 'Anggaran', data: (anggaran?.bagian ?? []).map((b) => b.nilai) }],
              satuan: anggaran?.satuan,
              desimal: 0,
            }}
            {...tinggiChart(penuh, 13)}
          />
        </KartuSumber>
      </div>

      {/* Cincin capaian per indikator */}
      <div
        className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-[0.8em]${penuh ? ' flex-1 min-h-0' : ''}`}
      >
        {indikator.map((ind) => {
          const tercapai = ind.nama.toLowerCase().includes('nrw') ? ind.realisasi <= ind.target : ind.realisasi >= ind.target;
          return (
            <KartuSumber
              key={ind.nama}
              aktif={sumberAktif}
              judul={ind.nama}
              sumber={n.sumber.indikator}
              className={`${kartuKelas} items-center text-center`}
              style={gaya}
              kelasIsi="flex flex-col items-center flex-1 min-h-0 w-full"
              {...warnaProp}
            >
              <span className="self-end rounded-full bg-white/60 px-[0.6em] py-[0.15em] text-[0.62em] font-semibold" style={{ color: G.teks2 }}>
                Target {String(ind.target).replace('.', ',')}%
              </span>
              <WidgetChart
                chartId="cincin-progres"
                varian="kaca"
                skala={skala}
                data={{ kategori: [ind.nama], seri: [{ nama: ind.nama, data: [ind.realisasi] }], satuan: '%', desimal: 1 }}
                {...tinggiChart(penuh, 8)}
              />
              <p className="text-[0.76em] font-semibold leading-tight mt-[0.3em] line-clamp-2">{ind.nama}</p>
              <span
                className="mt-[0.45em] rounded-full px-[0.8em] py-[0.25em] text-[0.64em] font-semibold"
                style={{ backgroundColor: tercapai ? '#17130e' : 'rgba(217,71,43,0.16)', color: tercapai ? '#fff' : G.merah }}
              >
                {tercapai ? 'Sesuai target' : 'Belum sesuai target'}
              </span>
            </KartuSumber>
          );
        })}
        {!indikator.length && (
          <p className="text-[0.76em]" style={{ color: G.teks3 }}>
            Dokumen belum memuat indikator pelayanan.
          </p>
        )}
      </div>

      {n.narasi && (
        <div className={`${kartuKelas} shrink-0`} style={gaya}>
          <p className="text-[0.76em] leading-relaxed line-clamp-2" style={{ color: G.teks2 }}>
            {n.narasi}
          </p>
        </div>
      )}
    </Bingkai>
  );
};

/* ------------------------------------------------------------------ */
/* HALAMAN 3 — KINERJA PER WILAYAH                                     */
/* ------------------------------------------------------------------ */

export const KacaWilayah: React.FC<DasarProps & { nilai?: NilaiWilayah }> = ({
  nilai,
  penuh = false,
  contoh = false,
  sumberAktif = false,
  warnaKartu,
}) => {
  const { akarRef, skala } = useSkala(penuh);
  const n = nilai?.baris?.length ? nilai : CONTOH_WILAYAH;
  const gaya = kartuGaya(warnaKartu);
  const baris = n.baris;
  const satuanAir = n.satuanAir || 'm³';
  const sumber = n.sumber ?? [];

  const total = useMemo(() => {
    if (n.total) return n.total;
    const jumlah = (f: (b: (typeof baris)[number]) => number) => baris.reduce((a, b) => a + (f(b) || 0), 0);
    return {
      wilayah: 'Total',
      pelanggan: jumlah((b) => b.pelanggan),
      airTerjual: jumlah((b) => b.airTerjual),
      nrw: baris.length ? jumlah((b) => b.nrw) / baris.length : 0,
      pengaduan: jumlah((b) => b.pengaduan),
      per1000: null,
    };
  }, [n.total, baris]);

  const kpi = [
    { label: 'Pelanggan', nilai: ringkasWilayah(total.pelanggan, 'sambungan'), satuan: 'sambungan' },
    { label: 'Air terjual', nilai: ringkasWilayah(total.airTerjual, satuanAir), satuan: satuanAir },
    { label: 'NRW rata-rata', nilai: `${total.nrw.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`, satuan: '' },
    { label: 'Pengaduan', nilai: ringkasWilayah(total.pengaduan, 'kasus'), satuan: 'kasus' },
  ];

  return (
    <Bingkai
      penuh={penuh}
      skala={skala}
      akarRef={akarRef}
      judul="Kinerja per wilayah"
      sub="Pelanggan, air terjual, kehilangan air, dan pengaduan tiap wilayah layanan"
      contoh={contoh}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[0.8em] shrink-0">
        {kpi.map((k, i) => (
          <div key={k.label} className={kartuKelas} style={gaya}>
            <div className="flex items-center gap-[0.5em]">
              <span
                className="w-[1.7em] h-[1.7em] rounded-full flex items-center justify-center text-[0.7em] font-bold text-white"
                style={{ backgroundColor: G.palet[i % G.palet.length] }}
              >
                {k.label.charAt(0)}
              </span>
              <p className="text-[0.74em] font-semibold" style={{ color: G.teks2 }}>
                {k.label}
              </p>
            </div>
            <p className="text-[1.6em] font-semibold tracking-[-0.02em] leading-tight tabular-nums mt-[0.4em]">
              {k.nilai}
              {k.satuan && (
                <span className="text-[0.42em] font-medium ml-[0.3em]" style={{ color: G.teks3 }}>
                  {k.satuan}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-[0.8em]${penuh ? ' flex-1 min-h-0' : ''}`}>
        <KartuSumber
          aktif={sumberAktif}
          judul="Air terjual & NRW per wilayah"
          sumber={sumber}
          className={`lg:col-span-8 ${kartuKelas}`}
          style={gaya}
          {...warnaProp}
        >
          <p className={judulKelas}>Air terjual & kehilangan air</p>
          <p className="text-[0.66em]" style={{ color: G.teks3 }}>
            Batang = air terjual ({satuanAir}), garis = NRW (%)
          </p>
          <WidgetChart
            chartId="combo-batang-garis"
            varian="kaca"
            skala={skala}
            data={{
              kategori: baris.map((b) => b.wilayah.replace(/^Jakarta\s+/i, '')),
              seri: [
                { nama: 'Air terjual', data: baris.map((b) => b.airTerjual) },
                { nama: 'NRW', data: baris.map((b) => b.nrw) },
              ],
              desimal: 1,
            }}
            {...tinggiChart(penuh, 13)}
          />
        </KartuSumber>

        <KartuSumber
          aktif={sumberAktif}
          judul="Sebaran pelanggan"
          sumber={sumber}
          className={`lg:col-span-4 ${kartuKelas}`}
          style={gaya}
          {...warnaProp}
        >
          <p className={judulKelas}>Sebaran pelanggan</p>
          <WidgetChart
            chartId="donat-tebal"
            varian="kaca"
            skala={skala}
            data={{
              kategori: baris.map((b) => b.wilayah.replace(/^Jakarta\s+/i, '')),
              seri: [{ nama: 'Pelanggan', data: baris.map((b) => b.pelanggan) }],
              desimal: 0,
            }}
            {...tinggiChart(penuh, 13)}
          />
        </KartuSumber>
      </div>

      <div className={`${kartuKelas} shrink-0`} style={gaya}>
        <div className="flex items-center justify-between mb-[0.4em]">
          <p className={judulKelas}>Laporan per wilayah</p>
          <span className="text-[0.66em]" style={{ color: G.teks3 }}>
            {baris.length} wilayah layanan
          </span>
        </div>
        <WidgetChart
          chartId="tabel-ringkas"
          varian="kaca"
          skala={skala}
          data={{
            kategori: [],
            seri: [],
            tabel: {
              kepala: ['Wilayah', 'Pelanggan', `Air terjual (${satuanAir})`, 'NRW', 'Pengaduan'],
              baris: baris.map((b) => [
                b.wilayah,
                b.pelanggan.toLocaleString('id-ID'),
                ringkasWilayah(b.airTerjual, satuanAir),
                `${b.nrw.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`,
                b.pengaduan.toLocaleString('id-ID'),
              ]),
              kolomSorot: 3,
              ambang: total.nrw,
            },
          }}
        />
      </div>
    </Bingkai>
  );
};
