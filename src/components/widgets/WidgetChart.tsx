import React, { useEffect, useMemo, useRef } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { loadEcharts } from './echartsSetup';
import { buildOpsi, type ChartId } from '../../services/chart/chartDefault';
import { contohKartu } from '../../services/chart/contohData';
import { ringkasWilayah } from '../../services/templates/wilayahLayanan';
import type { DataChart, SpesifikasiHtml } from '../../services/chart/pembangunOpsi';
import type { Varian } from '../../services/chart/gayaVarian';

/**
 * RENDERER TUNGGAL WIDGET.
 *
 * Satu-satunya komponen yang boleh memanggil `buildOpsi` dan satu-satunya
 * tempat bentuk widget digambar, baik kanvas grafik maupun bentuk HTML (kartu
 * KPI, tabel, narasi, progres, peringkat). Halaman template dashboard tidak
 * boleh lagi menulis bentuk widget sendiri: cukup kirim `chartId`, `varian`,
 * dan `data`, lalu tampilan mengikuti katalog template chart.
 */
export interface WidgetChartProps {
  chartId: ChartId;
  varian: Varian;
  data: DataChart;
  /** Skala huruf/garis. 1 = ukuran dasar kartu dashboard. */
  skala?: number;
  /** Tinggi kotak gambar. Bila kosong, kotak mengikuti tinggi induk. */
  tinggi?: number | string;
  /** Teks narasi untuk bentuk yang bukan kanvas. */
  teks?: string;
  /** Judul di dalam kartu, mis. "Insight Keuangan". */
  judul?: string;
  /** Ikon kecil di kepala kartu (kartu KPI). */
  ikon?: React.ComponentType<{ className?: string }>;
  /** Keterangan di samping angka delta, mis. "vs bulan lalu". */
  deltaTeks?: string;
  /** Angka yang sudah diformat pemanggil. Bila ada, dipakai apa adanya. */
  teksAngka?: string;
  /** Deret angka untuk sparkline. Bila kosong dipakai `data.seri[0].data`. */
  spark?: Array<number | null>;
  /** Tautan kecil di kepala kartu, mis. "Lihat semua". */
  tautan?: { label: string; onClick: () => void; terbuka?: boolean };
  /** Klik pada satu butir di dalam widget (mis. satu petak strip KPI). */
  onKlikItem?: (indeks: number) => void;
  /** Kartu bisa diklik (mis. membuka sumber dokumen). */
  onKlik?: () => void;
  /**
   * Penyunting opsi terakhir, dipakai halaman untuk menerapkan panel Gaya
   * (`gayaReplika`). Bentuk grafik tetap milik katalog.
   */
  pembungkus?: (opsi: any) => any;
  /**
   * Letak legenda. Bila kosong, dipakai letak bawaan varian: batang dan area
   * di atas grafik, cincin di sebelah kanan. Isi legenda selalu berasal dari
   * `data`, jadi halaman tidak lagi menulis daftar legenda sendiri.
   */
  legenda?: 'atas' | 'kanan' | 'tidak';
  /**
   * Baris tabel siap pakai (ikon, judul, catatan, nilai). Dipakai wajah
   * `tabel-ringkas` bila barisnya bukan sekadar angka, supaya tampilannya sama
   * persis dengan template dashboard.
   */
  baris?: Array<{
    ikon?: React.ComponentType<{ className?: string }>;
    judul: string;
    catatan?: string;
    nilai: string;
    arah?: boolean;
  }>;
  /** Isi legenda bila halaman punya label khusus (mis. total dan puncak). */
  legendaItem?: Array<{ warna: string; label: string; nilai?: string; redup?: boolean }>;
  /** Sedang disorot, mis. kartu yang sumbernya sedang dibuka. */
  sorot?: boolean;
  /** Warna sorotan, mengikuti aksen varian bila kosong. */
  warnaSorot?: string;
  className?: string;
}

/**
 * Deret untuk sparkline KPI. Halaman kadang hanya mengirim satu angka, sehingga
 * garisnya rata. Bila ada deret kecil atau seri lain, itu yang dipakai lebih dulu.
 */
function deretSpark(spark: Array<number | null> | undefined, data: DataChart): number[] {
  const calon = [spark, data.deretKecil?.[0], data.seri?.[0]?.data].find((d) => (d?.length ?? 0) >= 2);
  return (calon ?? spark ?? data.seri?.[0]?.data ?? []).map((n) => Number(n ?? 0));
}

export const WidgetChart: React.FC<WidgetChartProps> = ({
  chartId,
  varian,
  data,
  skala = 1,
  tinggi,
  teks,
  judul,
  ikon,
  deltaTeks,
  spark,
  teksAngka,
  tautan,
  baris,
  onKlik,
  onKlikItem,
  sorot,
  warnaSorot,
  pembungkus,
  legenda,
  legendaItem,
  className,
}) => {
  const wadah = useRef<HTMLDivElement | null>(null);
  const hasil = useMemo(() => {
    const keluaran = buildOpsi(chartId, data, varian, skala);
    const mentah: any = keluaran.opsi;
    // Bentuk HTML tidak pernah disentuh panel Gaya; hanya kanvas.
    if (pembungkus && mentah?.mesin !== 'html') return { ...keluaran, opsi: pembungkus(mentah) };
    return keluaran;
  }, [chartId, data, varian, skala, pembungkus]);
  const html = (hasil.opsi as SpesifikasiHtml | null)?.mesin === 'html' ? (hasil.opsi as SpesifikasiHtml) : null;

  useEffect(() => {
    if (html) return;
    let batal = false;
    let instans: any = null;
    let pengamat: ResizeObserver | null = null;
    void loadEcharts().then((ec) => {
      if (batal || !wadah.current) return;
      instans = ec.init(wadah.current);
      instans.setOption(hasil.opsi as any, true);
      pengamat = new ResizeObserver(() => instans?.resize?.());
      pengamat.observe(wadah.current);
    });
    return () => {
      batal = true;
      pengamat?.disconnect();
      instans?.dispose?.();
    };
  }, [chartId, varian, skala, hasil, html]);

  if (html) {
    return (
      <BentukHtml
        spesifikasi={html}
        data={data}
        teks={teks}
        judul={judul}
        ikon={ikon}
        deltaTeks={deltaTeks}
        spark={spark}
        teksAngka={teksAngka}
        tautan={tautan}
        baris={baris}
        onKlik={onKlik}
        onKlikItem={onKlikItem}
        sorot={sorot}
        warnaSorot={warnaSorot}
      />
    );
  }

  const gayaTinggi = tinggi === undefined ? undefined : typeof tinggi === 'number' ? `${tinggi}px` : tinggi;
  const letakLegenda = legenda ?? letakLegendaBawaan(chartId, data);
  const palet = (hasil.opsi as any)?.gaya?.palet ?? ['#ff8a1f'];
  const warna = (hasil.opsi as any)?.gaya?.aksen ?? palet[0];
  const aksenTeks = (hasil.opsi as any)?.gaya?.teks2 ?? '#b7bdc6';
  const kanvas = (
    <div className={letakLegenda === 'tidak' ? (className ?? 'w-full h-full') : 'w-full flex-1 min-h-0'} style={letakLegenda === 'tidak' ? { height: gayaTinggi } : undefined}>
      <div ref={wadah} className="w-full h-full" />
    </div>
  );

  if (letakLegenda === 'tidak') return kanvas;

  /**
   * Warna yang benar-benar dipakai grafik untuk kategori ke-i.
   *
   * Panel Gaya bisa menimpa warna katalog (misalnya palet global), jadi legenda
   * tidak boleh menghitung warnanya sendiri: butir legenda harus sama persis
   * dengan warna batang atau potongan yang tampil.
   */
  const warnaKategoriOpsi = (i: number): string | undefined => {
    const seri: any[] = Array.isArray((hasil.opsi as any)?.series) ? (hasil.opsi as any).series : [];
    for (const satu of seri) {
      if (!satu || satu.type === 'line') continue;
      const titik = Array.isArray(satu.data) ? satu.data[i] : undefined;
      const warnaTitik = titik?.itemStyle?.color;
      if (typeof warnaTitik === 'string') return warnaTitik;
      const berhenti = warnaTitik?.colorStops?.[0]?.color;
      if (typeof berhenti === 'string') return berhenti;
    }
    const warnaOpsi = (hasil.opsi as any)?.color;
    if (Array.isArray(warnaOpsi) && warnaOpsi.length) return warnaOpsi[i % warnaOpsi.length];
    return undefined;
  };

  /**
   * Angka di legenda memakai aturan yang sama dengan tooltip: pemisah desimal
   * koma dan satuan menempel. Tanpa ini nilainya tampil mentah seperti "41.2".
   */
  const teksNilaiLegenda = (nilai: string): string => {
    const bersih = nilai.trim();
    if (bersih === '') return '';
    const angka = Number(bersih);
    if (!Number.isFinite(angka)) return bersih;
    const teks = format(angka, typeof data.desimal === 'number' ? data.desimal : undefined);
    return data.satuan === '%' ? `${teks}%` : teks;
  };

  const legendaIsi =
    legendaItem ??
    data.kategori.map((label, i) => ({
      label,
      // Ikuti warna yang benar-benar digambar, bukan satu warna aksen.
      warna: warnaKategoriOpsi(i) ?? palet[i % palet.length],
      nilai:
        data.seri.length === 1 && data.kategori.length > 1
          ? String(data.seri[0].data[i] ?? '')
          : undefined,
      redup: false,
    }));

  if (letakLegenda === 'kanan') {
    return (
      <div className={className ?? 'w-full h-full'} style={{ height: gayaTinggi }}>
        <div className="w-full h-full flex items-stretch gap-[0.4em]">
          <div className="relative flex-1 min-w-0">
            <div ref={wadah} className="w-full h-full" />
            {chartId === 'donat-tebal' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[0.95em] font-bold leading-none tabular-nums" style={{ color: aksenTeks }}>
                  {format(totalDonat(data), 0)}
                </span>
                <span className="text-[0.66em] mt-[0.1em]" style={{ color: aksenTeks, opacity: 0.75 }}>
                  Total
                </span>
              </div>
            )}
          </div>
          <ul className="flex-1 min-w-0 self-center space-y-[0.45em]">
            {legendaIsi.map((l) => (
              <li key={l.label} className="flex items-center gap-[0.4em] text-[0.72em] min-w-0">
                <span className="w-[0.5em] h-[0.5em] rounded-full shrink-0" style={{ backgroundColor: l.warna }} />
                <span className="flex-1 truncate" style={{ color: aksenTeks }}>
                  {l.label}
                </span>
                {l.nilai !== undefined && (
                  <span className="tabular-nums font-semibold shrink-0" style={{ color: aksenTeks }}>
                    {teksNilaiLegenda(l.nilai)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className={className ?? 'w-full h-full'} style={{ height: gayaTinggi }}>
      <div className="w-full h-full flex flex-col">
        <ul className="flex flex-wrap items-center gap-x-[1.15em] gap-y-[0.25em] shrink-0 mb-[0.35em]">
          {legendaIsi.map((l) => (
            <li key={l.label} className="flex items-center gap-[0.35em] text-[0.72em] min-w-0">
              <span
                className="w-[0.5em] h-[0.5em] rounded-full shrink-0"
                style={{ backgroundColor: l.warna, opacity: l.redup ? 0.55 : 1 }}
              />
              <span className="truncate" style={{ color: aksenTeks }}>
                {l.label}
              </span>
              {l.nilai !== undefined && l.nilai !== '' && (
                <span className="tabular-nums font-semibold shrink-0" style={{ color: aksenTeks }}>
                  {teksNilaiLegenda(l.nilai)}
                </span>
              )}
            </li>
          ))}
        </ul>
        <div ref={wadah} className="w-full flex-1 min-h-0" />
      </div>
    </div>
  );
};

/** Letak legenda bawaan per wajah chart. */
export const letakLegendaBawaan = (chartId: ChartId, data: DataChart): 'atas' | 'kanan' | 'tidak' => {
  const satuSeri = data.seri.length <= 1;
  const banyakTitik = data.kategori.length > 8;

  // Deret waktu: legenda per titik tidak berguna (29 tanggal) dan justru
  // memakan tinggi kanvas sampai grafiknya tidak terlihat. Sumbu X sudah
  // menyebut waktunya.
  if ((chartId === 'area-gradasi' || chartId === 'garis-tren') && (satuSeri || banyakTitik)) return 'tidak';

  // Cincin: legendanya daftar bagian, tapi jangan sampai memanjang di luar kartu.
  if (chartId === 'donat-tebal') return banyakTitik ? 'tidak' : 'kanan';

  if (chartId === 'bar-tegak' || chartId === 'bar-tegak-sorot' || chartId === 'bar-tegak-target') {
    return 'atas';
  }
  return 'tidak';
};

/** Total untuk teks tengah cincin. */
const totalDonat = (data: DataChart): number => {
  if (typeof data.total === 'number') return data.total;
  return data.seri[0]?.data.reduce<number>((a, b) => a + (typeof b === 'number' ? b : 0), 0) ?? 0;
};

/** Angka pertama yang ada, atau null. */
const angkaPertama = (data: DataChart): number | null => {
  const deret = data.seri?.[0]?.data ?? [];
  const isi = deret.find((v) => typeof v === 'number');
  return typeof isi === 'number' ? isi : null;
};

const format = (v: number | null, desimal = 0): string =>
  v === null ? '—' : v.toLocaleString('id-ID', { maximumFractionDigits: desimal });

/** Jalur sparkline 0..100 dari deret angka. Garis datar bila kurang dari dua titik. */
const jalurSpark = (deret: Array<number | null>): { garis: string; area: string } => {
  const angka = deret.map((v) => (typeof v === 'number' ? v : 0));
  if (angka.length < 2) return { garis: 'M0,62 L100,62', area: 'M0,62 L100,62 L100,100 L0,100 Z' };
  const min = Math.min(...angka);
  const maks = Math.max(...angka);
  const rentang = maks - min || 1;
  const titik = angka.map((v, i) => {
    const x = (i / (angka.length - 1)) * 100;
    const y = 92 - ((v - min) / rentang) * 78;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const garis = `M${titik.join(' L')}`;
  return { garis, area: `${garis} L100,100 L0,100 Z` };
};

interface BentukProps {
  spesifikasi: SpesifikasiHtml;
  data: DataChart;
  teks?: string;
  judul?: string;
  ikon?: React.ComponentType<{ className?: string }>;
  deltaTeks?: string;
  spark?: Array<number | null>;
  teksAngka?: string;
  tautan?: { label: string; onClick: () => void; terbuka?: boolean };
  baris?: Array<{
    ikon?: React.ComponentType<{ className?: string }>;
    judul: string;
    catatan?: string;
    nilai: string;
    arah?: boolean;
  }>;
  onKlik?: () => void;
  onKlikItem?: (indeks: number) => void;
  sorot?: boolean;
  warnaSorot?: string;
}

/**
 * Bentuk yang bukan kanvas grafik. Semua angkanya diambil dari `data`, jadi
 * dashboard sungguhan tidak pernah menampilkan angka contoh.
 */
const BentukHtml: React.FC<BentukProps> = ({
  spesifikasi,
  data,
  teks,
  judul,
  ikon: Ikon,
  deltaTeks,
  spark,
  teksAngka,
  tautan,
  baris,
  onKlik,
  onKlikItem,
  sorot,
  warnaSorot,
}) => {
  const g = spesifikasi.gaya;
  const kotak: React.CSSProperties = {
    backgroundColor: g.kartu,
    border: `1px solid ${sorot ? warnaSorot ?? g.aksen : g.garis}`,
    borderRadius: '0.9em',
    color: g.teks,
    cursor: onKlik ? 'pointer' : undefined,
  };
  const angka = angkaPertama(data);
  const satuan = data.satuan ?? '';
  const desimal = data.desimal ?? 0;

  if (spesifikasi.jenis === 'kpi-strip') {
    // Bila kategorinya lebih dari satu, wajah ini menjadi strip beberapa petak
    // angka, seperti ringkasan wilayah di halaman 3. Satu kategori tetap satu
    // petak mendatar berikon.
    if ((data.kategori?.length ?? 0) > 1) {
      const nilaiPetak = data.seri?.[0]?.data ?? [];
      const satuanPetak = data.catatan ?? [];
      return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[0.8em] h-full" style={{ color: g.teks }}>
          {data.kategori.map((label, i) => (
            <div
              key={label}
              className="rounded-xl border p-[0.95em] min-w-0"
              style={{ backgroundColor: g.kartu, borderColor: g.garis, cursor: onKlikItem ? 'pointer' : undefined }}
              onClick={onKlikItem ? () => onKlikItem(i) : undefined}
            >
              <p className="text-[0.66em] font-semibold truncate" style={{ color: g.teks3 }}>
                {label}
              </p>
              <p className="text-[1.1em] font-extrabold leading-tight truncate" style={{ color: g.teks }}>
                {ringkasWilayah(Number(nilaiPetak[i] ?? 0), satuanPetak[i] ?? '')}
                {satuanPetak[i] && satuanPetak[i] !== '%' ? (
                  <span className="text-[0.6em] font-semibold ml-1" style={{ color: g.teks2 }}>
                    {satuanPetak[i]}
                  </span>
                ) : null}
              </p>
            </div>
          ))}
        </div>
      );
    }

    // Strip KPI: mendatar, kotak ikon di kiri, tanpa sparkline.
    return (
      <div
        className="h-full flex items-center gap-[0.8em] px-[0.75em] py-[0.6em] min-w-0"
        style={kotak}
        onClick={onKlik}
        title={onKlik ? 'Klik untuk melihat sumber dokumen' : undefined}
      >
        {Ikon && (
          <span
            className="w-[2em] h-[2em] rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: g.kartu2, color: g.aksen }}
          >
            <Ikon className="w-[1em] h-[1em]" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[0.68em] font-semibold truncate" style={{ color: g.teks3 }}>
            {judul || data.kategori?.[0] || data.seri?.[0]?.nama}
          </p>
          <p className="text-[1.05em] font-extrabold leading-tight truncate" style={{ color: g.teks }}>
            {teksAngka ?? format(angka, desimal)}
            {satuan && satuan !== '%' ? (
              <span className="text-[0.62em] font-semibold ml-1" style={{ color: g.teks2 }}>
                {satuan}
              </span>
            ) : null}
          </p>
        </div>
      </div>
    );
  }

  if (spesifikasi.jenis === 'strip-os') {
    // Dipindahkan dari halaman Trafik: satu baris per sistem operasi dengan
    // penanda warna, persentase, delta, dan sparkline tipis di bawahnya.
    const nilaiOs = data.seri?.[0]?.data ?? [];
    const deltaOs = data.seri?.[1]?.data ?? [];
    return (
      <div className="h-full flex flex-col px-[0.75em] py-[0.7em] min-h-0" style={kotak}>
        <ul className="flex-1 min-h-0 flex flex-col justify-between gap-[0.28em]">
          {data.kategori.map((nama, j) => {
            const seri = data.deretKecil?.[j] ?? [];
            const jalur = seri.length >= 2 ? jalurSpark(seri) : null;
            const selisih = deltaOs[j];
            const naik = (selisih ?? 0) > 0;
            const warna = g.palet[j % g.palet.length];
            const persen = Number(nilaiOs[j] ?? 0);
            return (
              <li key={nama} className="min-w-0">
                <div className="flex items-center gap-[0.3em] text-[0.65em]">
                  <span className="w-[0.45em] h-[0.45em] rounded-full shrink-0" style={{ backgroundColor: warna }} />
                  <span className="truncate" style={{ color: g.teks2 }}>
                    {nama}
                  </span>
                  <span className="ml-auto tabular-nums font-semibold shrink-0">
                    {persen.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%
                  </span>
                  <span
                    className="tabular-nums shrink-0 text-[0.88em] font-semibold w-[2.1em] text-right"
                    style={{ color: selisih == null || selisih === 0 ? g.teks3 : naik ? g.hijau : g.merah }}
                  >
                    {selisih == null ? '' : selisih === 0 ? '—' : `${naik ? '▲' : '▼'}${Math.abs(selisih)}%`}
                  </span>
                </div>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-[1.05em] mt-[0.08em]" aria-hidden>
                  {jalur && (
                    <>
                      <defs>
                        <linearGradient id={`spark-os-${j}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={warna} stopOpacity="0.42" />
                          <stop offset="100%" stopColor={warna} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={jalur.area} fill={`url(#spark-os-${j})`} />
                      <path
                        d={jalur.garis}
                        fill="none"
                        stroke={warna}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </>
                  )}
                </svg>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (spesifikasi.jenis === 'kpi-lensa') {
    // Dipindahkan apa adanya dari halaman Analitik: ikon berbentuk kotak
    // bertinta, delta berwarna, dan sparkline bergradasi di bawah angka.
    const kosong = data.kosong === true;
    const datar = kosong || !data.delta || (spark ?? []).length < 2;
    const warnaIkon = data.warnaIkon ?? g.aksen;
    const jalur = datar
      ? { garis: 'M0,62 L100,62', area: 'M0,62 L100,62 L100,100 L0,100 Z' }
      : jalurSpark(deretSpark(spark, data));
    const warnaGaris = datar ? g.teks3 : warnaIkon;
    const idGrad = `grad-${String(judul ?? data.kategori?.[0] ?? 'kpi').replace(/\s+/g, '-')}`;

    return (
      <div className="h-full flex flex-col gap-[0.35em] p-[0.8em] min-w-0" style={kotak} onClick={onKlik}>
        <div className="flex items-start justify-between gap-[0.5em]">
          <span className="text-[0.76em] font-medium leading-tight" style={{ color: g.teks3 }}>
            {judul ?? data.kategori?.[0] ?? ''}
          </span>
          {Ikon && (
            <span
              className="shrink-0 inline-flex items-center justify-center w-[1.75em] h-[1.75em] rounded-[0.45em]"
              style={{ backgroundColor: `${warnaIkon}22`, color: warnaIkon }}
            >
              <Ikon className="w-[1em] h-[1em]" />
            </span>
          )}
        </div>

        <span
          className="text-[1.5em] font-bold leading-none tabular-nums tracking-tight"
          style={kosong ? { color: g.teks3 } : undefined}
        >
          {kosong ? '—' : teksAngka ?? format(angka, desimal)}
        </span>

        <div className="flex items-center gap-[0.35em] text-[0.72em] font-semibold">
          {kosong ? (
            <span className="font-normal" style={{ color: g.teks3 }}>
              belum ada di dokumen
            </span>
          ) : data.deltaTeks ? (
            <>
              <span style={{ color: data.delta && data.delta < 0 ? g.merah : g.hijau }}>{data.deltaTeks}</span>
              <span className="font-normal truncate" style={{ color: g.teks3 }}>
                {deltaTeks}
              </span>
            </>
          ) : (
            <span className="font-normal" style={{ color: g.teks3 }}>
              tanpa pembanding di dokumen
            </span>
          )}
        </div>

        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full flex-1 min-h-[1.4em] max-h-[2em] mt-[0.15em]" aria-hidden>
          <defs>
            <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={warnaGaris} stopOpacity={datar ? '0.18' : '0.38'} />
              <stop offset="100%" stopColor={warnaGaris} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={jalur.area} fill={`url(#${idGrad})`} />
          <path
            d={jalur.garis}
            fill="none"
            stroke={warnaGaris}
            strokeWidth="2.4"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    );
  }

  if (spesifikasi.jenis === 'kpi-nadi') {
    // Dipindahkan apa adanya dari halaman Trafik: delta berbentuk pil, warna
    // mengikuti arah yang dianggap baik, sparkline tanpa ikon.
    const naik = (data.delta ?? 0) > 0;
    const arahBaik = data.arahBaik ?? 'naik';
    const baik = arahBaik === 'naik' ? naik : !naik;
    const warnaDelta = baik ? g.hijau : g.merah;
    const deret = deretSpark(spark, data);
    const jalur = deret.length >= 2 ? jalurSpark(deret) : null;
    const idGrad = `tg-${String(judul ?? data.kategori?.[0] ?? 'kpi').replace(/\s+/g, '-')}`;

    return (
      <div className="h-full flex flex-col gap-[0.3em] p-[0.8em] min-w-0" style={kotak} onClick={onKlik}>
        <span className="text-[0.7em] font-medium leading-tight truncate" style={{ color: g.teks3 }}>
          {judul ?? data.kategori?.[0] ?? ''}
        </span>
        <div className="flex items-baseline gap-[0.35em] min-w-0">
          <span className="text-[1.35em] font-bold leading-none tabular-nums tracking-tight truncate">
            {(teksAngka ?? format(angka, desimal)) || '\u00A0'}
          </span>
          {data.deltaTeks && (
            <span
              className="inline-flex items-center gap-[0.1em] text-[0.66em] font-semibold shrink-0 rounded-full px-[0.3em] py-[0.05em]"
              style={{ color: warnaDelta, backgroundColor: `${warnaDelta}1f` }}
            >
              {naik ? <ArrowUpRight className="w-[0.95em] h-[0.95em]" /> : <ArrowDownRight className="w-[0.95em] h-[0.95em]" />}
              {naik ? '+' : '−'}
              {data.deltaTeks}
            </span>
          )}
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full flex-1 min-h-[1.3em] max-h-[1.8em]" aria-hidden>
          {jalur && (
            <>
              <defs>
                <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={warnaDelta} stopOpacity="0.34" />
                  <stop offset="100%" stopColor={warnaDelta} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={jalur.area} fill={`url(#${idGrad})`} />
              <path
                d={jalur.garis}
                fill="none"
                stroke={warnaDelta}
                strokeWidth="2.2"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>
      </div>
    );
  }

  if (spesifikasi.jenis === 'kpi-kartu') {
    const besar = true;
    const delta = data.delta;
    const datar = delta === undefined || delta === 0;
    const warna = datar ? '#6b7280' : delta! > 0 ? '#22c55e' : '#f43f5e';
    const jalur = jalurSpark(deretSpark(spark, data));
    const idGrad = `spark-${String(data.kategori?.[0] ?? 'kpi').replace(/\s+/g, '-')}`;

    return (
      <div
        className="h-full flex flex-col gap-[0.55em] p-[0.8em] min-w-0"
        style={kotak}
        onClick={onKlik}
        title={onKlik ? 'Klik untuk melihat sumber dokumen' : undefined}
      >
        <div className="flex items-start justify-between gap-[0.5em]">
          <span className="text-[0.82em] font-medium leading-tight" style={{ color: g.teks3 }}>
            {judul || data.kategori?.[0] || data.seri?.[0]?.nama || contohKartu.judul}
          </span>
          {Ikon && (
            <span
              className="shrink-0 inline-flex items-center justify-center w-[2em] h-[2em] rounded-full"
              style={{ border: `1px solid ${g.aksen}59`, backgroundColor: `${g.aksen}1a`, color: g.aksen }}
            >
              <Ikon className="w-[1em] h-[1em]" />
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-[0.35em] flex-wrap">
          <span className={`${besar ? 'text-[1.55em]' : 'text-[1.2em]'} font-bold leading-none tabular-nums tracking-tight`}>
            {teksAngka ?? format(angka, desimal)}
          </span>
          {satuan && (
            <span className="text-[0.72em] font-medium" style={{ color: g.teks3 }}>
              {satuan}
            </span>
          )}
        </div>

        {besar && delta !== undefined && !(data.dariDokumen && delta === 0) && (
          <div className="flex items-center gap-[0.4em] text-[0.76em] font-semibold">
            <span className="inline-flex items-center gap-[0.15em]" style={{ color: warna }}>
              {datar ? (
                <span className="w-[0.9em] text-center leading-none">–</span>
              ) : delta > 0 ? (
                <ArrowUpRight className="w-[1em] h-[1em]" />
              ) : (
                <ArrowDownRight className="w-[1em] h-[1em]" />
              )}
              {datar ? '0' : `${delta > 0 ? '+' : ''}${String(delta).replace('.', ',')}`}%
            </span>
            {deltaTeks && (
              <span className="font-normal truncate" style={{ color: g.teks3 }}>
                {deltaTeks}
              </span>
            )}
          </div>
        )}

        {besar && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full flex-1 min-h-[1.4em] max-h-[2em] mt-[0.15em]" aria-hidden>
            <defs>
              <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={warna} stopOpacity="0.42" />
                <stop offset="100%" stopColor={warna} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={jalur.area} fill={`url(#${idGrad})`} />
            <path
              d={jalur.garis}
              fill="none"
              stroke={warna}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    );
  }

  if (spesifikasi.jenis === 'progres-target') {
    const nilai = data.seri?.[0]?.data ?? [];
    return (
      <div className="h-full flex flex-col justify-center gap-[0.55em] px-[0.75em] py-[0.7em]" style={kotak}>
        {data.kategori.slice(0, 5).map((label, i) => {
          const v = Number(nilai[i] ?? 0);
          return (
            <div key={label} className="text-[0.74em]">
              <div className="flex items-center justify-between gap-[0.4em]">
                <span className="truncate" style={{ color: g.teks2 }}>
                  {label}
                </span>
                <span className="font-semibold tabular-nums shrink-0" style={{ color: g.teks }}>
                  {format(v, 1)}%
                </span>
              </div>
              <span
                className="block h-[0.35em] rounded-full overflow-hidden mt-[0.3em]"
                style={{ backgroundColor: g.kartu2 }}
              >
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, v))}%`,
                    // Tiap program punya warnanya sendiri supaya batang tidak seragam.
                    backgroundColor: g.palet[i % g.palet.length],
                  }}
                />
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  if (spesifikasi.jenis === 'tabel-ringkas') {
    // Tabel angka berkepala, dipakai halaman 3 untuk kinerja per wilayah.
    if (data.tabel) {
      const { kepala, baris: isiTabel, kolomSorot, ambang } = data.tabel;
      return (
        <div className="overflow-x-auto" style={{ color: g.teks }}>
          <table className="w-full text-[0.7em] border-collapse">
            <thead>
              <tr style={{ color: g.teks3 }}>
                {kepala.map((judul, i) => (
                  <th
                    key={judul}
                    className={`font-bold py-[0.3em] ${i === 0 ? 'text-left pr-[0.6em]' : 'text-right px-[0.4em]'}`}
                  >
                    {judul}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isiTabel.map((sel, r) => (
                <tr key={`baris-${r}`} style={{ borderTop: `1px solid ${g.garis}` }}>
                  {sel.map((isiSel, i) => {
                    // "1.234" dan "12,5%" sama-sama dibaca sebagai angka.
                    const angkaSel =
                      typeof isiSel === 'number'
                        ? isiSel
                        : Number(String(isiSel).replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.'));
                    const diwarnai = i === kolomSorot && typeof ambang === 'number';
                    const warnaSel = diwarnai ? (angkaSel > ambang ? g.merah : g.hijau) : undefined;
                    return (
                      <td
                        key={`sel-${r}-${i}`}
                        className={`py-[0.28em] tabular-nums ${i === 0 ? 'text-left pr-[0.6em]' : 'text-right px-[0.4em]'} ${
                          diwarnai ? 'font-bold' : ''
                        }`}
                        style={{ color: warnaSel ?? (i === 0 ? g.teks : g.teks2) }}
                      >
                        {isiSel}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    const nilai = data.seri?.[0]?.data ?? [];
    const catatan = data.catatan ?? [];
    return (
      <div className="h-full flex flex-col px-[0.75em] py-[0.7em] min-h-0" style={kotak}>
        <div className="flex items-center justify-between gap-[0.25em] mb-[0.6em] shrink-0">
          <h3 className="text-[0.98em] font-semibold truncate min-w-0">{data.kategori?.[0] || 'Ringkasan'}</h3>
          {tautan && (
            <button
              type="button"
              onClick={tautan.onClick}
              className="shrink-0 whitespace-nowrap text-[0.74em] inline-flex items-center gap-[0.15em]"
              style={{ color: g.aksen }}
            >
              {tautan.label}
              <ArrowRight className={`w-[0.95em] h-[0.95em] transition-transform ${tautan.terbuka ? 'rotate-90' : ''}`} />
            </button>
          )}
        </div>
        {baris ? (
          <ul className="space-y-[0.55em] flex-1 min-h-0 overflow-auto gulir-tema pr-[0.2em]">
            {baris.length === 0 && (
              <li className="text-[0.78em]" style={{ color: g.teks3 }}>
                Belum ada data di dokumen instansi.
              </li>
            )}
            {baris.map((b) => (
              <li key={b.judul} className="flex items-center gap-[0.6em]">
                <span
                  className="shrink-0 inline-flex items-center justify-center w-[2em] h-[2em] rounded-full"
                  style={{ backgroundColor: g.kartu2, color: b.arah === false ? '#f43f5e' : '#22c55e' }}
                >
                  {b.ikon ? <b.ikon className="w-[1em] h-[1em]" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.84em] font-medium truncate">{b.judul}</p>
                  {b.catatan && (
                    <p className="text-[0.74em] truncate" style={{ color: g.teks3 }}>
                      {b.catatan}
                    </p>
                  )}
                </div>
                <span
                  className="text-[0.8em] font-semibold tabular-nums shrink-0"
                  style={{ color: b.arah === false ? '#f43f5e' : '#22c55e' }}
                >
                  {b.nilai}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {!baris && data.kategori.slice(1).length === 0 && (
          <p className="text-[0.78em]" style={{ color: g.teks3 }}>
            Belum ada data di dokumen instansi.
          </p>
        )}
        {/* Satu deret: daftar ringkas. Dua deret atau lebih: tabel berkolom. */}
        {!baris && data.kategori.slice(1).length > 0 && data.seri.length > 1 ? (
          <div className="flex-1 min-h-0 overflow-auto gulir-tema">
            <table className="w-full text-[0.8em]">
              <thead>
                <tr style={{ color: g.teks3 }}>
                  <th className="text-left font-medium pb-[0.3em]">Keterangan</th>
                  {data.seri.map((sr) => (
                    <th key={sr.nama} className="text-right font-medium pb-[0.3em]">
                      {sr.nama}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.kategori.slice(1).map((label, i) => (
                  <tr key={`${label}-${i}`} style={{ borderTop: `1px solid ${g.garis}` }}>
                    <td className="py-[0.35em] truncate">{label}</td>
                    {data.seri.map((sr) => (
                      <td key={sr.nama} className="py-[0.35em] text-right tabular-nums">
                        {format(typeof sr.data[i] === 'number' ? (sr.data[i] as number) : null, desimal)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !baris ? (
          <ul className="space-y-[0.55em] flex-1 min-h-0 overflow-auto gulir-tema pr-[0.2em]">
            {data.kategori.slice(1).map((label, i) => (
              <li key={`${label}-${i}`} className="flex items-center gap-[0.6em]">
                <span className="min-w-0 flex-1">
                  <p className="text-[0.84em] font-medium truncate">{label}</p>
                  {catatan[i] && (
                    <p className="text-[0.74em] truncate" style={{ color: g.teks3 }}>
                      {catatan[i]}
                    </p>
                  )}
                </span>
                <span className="text-[0.8em] font-semibold tabular-nums shrink-0" style={{ color: g.teks2 }}>
                  {format(nilai[i] ?? null, desimal)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  if (spesifikasi.jenis === 'narasi-insight') {
    return (
      <div
        className="h-full flex items-center gap-[0.6em] px-[0.75em] py-[0.7em]"
        style={{ ...kotak, borderLeft: `3px solid ${g.aksen}` }}
      >
        {Ikon && (
          <span
            className="shrink-0 inline-flex items-center justify-center w-[2.2em] h-[2.2em] rounded-[0.75em]"
            style={{ background: `linear-gradient(135deg, ${g.aksen}, #ffb347)`, color: '#1a1206' }}
          >
            <Ikon className="w-[1.05em] h-[1.05em]" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[0.92em] font-semibold">{judul || data.kategori?.[0] || 'Insight'}</p>
          <p
            className="text-[0.8em] leading-relaxed"
            style={{
              color: g.teks3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {teks || contohKartu.narasi}
          </p>
        </div>
      </div>
    );
  }

  // peringkat
  const nilai = data.seri?.[0]?.data ?? [];
  const puncak = Math.max(...nilai.map((v) => Number(v ?? 0)), 1);
  return (
    <div className="h-full flex flex-col justify-center gap-[0.5em] px-[0.75em] py-[0.7em]" style={kotak}>
      {data.kategori.slice(0, 4).map((label, i) => {
        const v = Number(nilai[i] ?? 0);
        return (
          <div key={label} className="text-[0.74em]">
            <div className="flex items-center justify-between gap-[0.4em]">
              <span className="truncate" style={{ color: g.teks2 }}>
                {label}
              </span>
              <span className="tabular-nums" style={{ color: g.teks }}>
                {format(v, desimal)}
              </span>
            </div>
            <span
              className="block h-[0.28em] rounded-full overflow-hidden mt-[0.3em]"
              style={{ backgroundColor: g.kartu2 }}
            >
              <span
                className="block h-full rounded-full"
                style={{ width: `${(v / puncak) * 100}%`, backgroundColor: g.aksen }}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
};
