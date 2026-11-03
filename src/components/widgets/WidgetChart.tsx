import React, { useContext, useEffect, useMemo, useRef } from 'react';
import { AlertOctagon, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, Gauge, Target } from 'lucide-react';
import { loadEcharts } from './echartsSetup';
import { buildOpsi, type ChartId } from '../../services/chart/chartDefault';
import { contohKartu } from '../../services/chart/contohData';
import { ringkasWilayah } from '../../services/templates/wilayahLayanan';
import type { DataChart, SpesifikasiHtml } from '../../services/chart/pembangunOpsi';
import { cukupTerang, type GayaVarian, type Varian } from '../../services/chart/gayaVarian';
import { KonteksGayaReplika, gayaKartuReplika } from './konteksGayaReplika';
import { gayaReplika } from '../referensi/gayaReplika';

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
  /**
   * Klik satu kategori di kanvas grafik (batang, titik, potongan). Dipakai kanvas
   * dashboard untuk seleksi lintas-chart.
   */
  onKlikKategori?: (label: string) => void;
  /** Klik area grafik yang bukan batang/titik/potongan (mis. membuka sumber dokumen). */
  onKlikKosong?: () => void;
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
  /** Pakai wajah khas replika halaman 1 Lensa/Nadi (hanya komponen replika). */
  khas?: boolean;
  /** Ganti nilai gaya varian, mis. Default versi gelap di katalog. */
  gaya?: GayaVarian;
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
  varian: varianProp,
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
  onKlikKategori,
  onKlikKosong,
  sorot,
  warnaSorot,
  pembungkus,
  legenda,
  legendaItem,
  className,
  khas = false,
  gaya: gayaProp,
}) => {
  const wadah = useRef<HTMLDivElement | null>(null);
  // Gaya Semua di dashboard dari Template Dashboard (lihat konteksGayaReplika.ts):
  // desain chart, warna kartu, palet, dan font berlaku di setiap kartu replika.
  const gayaHalaman = useContext(KonteksGayaReplika);
  const { varian, gaya } = useMemo(
    () => gayaKartuReplika(gayaHalaman, varianProp, gayaProp),
    [gayaHalaman, varianProp, gayaProp]
  );
  const hasil = useMemo(() => {
    const keluaran = buildOpsi(chartId, data, varian, skala, gaya, khas);
    const mentah: any = keluaran.opsi;
    // Bentuk HTML tidak pernah disentuh panel Gaya; hanya kanvas.
    if (pembungkus && mentah?.mesin !== 'html') return { ...keluaran, opsi: pembungkus(mentah) };
    // Halaman replika yang tidak memasang pembungkus sendiri tetap menerima palet & font.
    if (gayaHalaman && mentah && mentah.mesin !== 'html') {
      const terang = Boolean(gayaHalaman.kartu && cukupTerang(gayaHalaman.kartu));
      return { ...keluaran, opsi: gayaReplika(mentah, gayaHalaman, undefined, terang) };
    }
    return keluaran;
  }, [chartId, data, varian, skala, pembungkus, khas, gaya, gayaHalaman]);
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
      if (onKlikKosong) {
        instans.getZr().on('click', (e: any) => {
          if (!e?.target) onKlikKosong();
        });
      }
      if (onKlikKategori) {
        instans.on('click', (p: any) => {
          const label = typeof p?.name === 'string' && p.name ? p.name : data.kategori[p?.dataIndex];
          if (label) onKlikKategori(label);
        });
      }
      pengamat = new ResizeObserver(() => instans?.resize?.());
      pengamat.observe(wadah.current);
    });
    return () => {
      batal = true;
      pengamat?.disconnect();
      instans?.dispose?.();
    };
  }, [chartId, varian, skala, hasil, html, onKlikKategori, onKlikKosong, data]);

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
  const palet = (hasil.opsi as any)?.gaya?.palet ?? hasil.gaya?.palet ?? ['#ff8a1f'];
  const warna = (hasil.opsi as any)?.gaya?.aksen ?? palet[0];
  // Teks legenda ikut gaya varian (kartu terang = teks gelap), bukan abu-abu tetap.
  const aksenTeks = (hasil.opsi as any)?.gaya?.teks2 ?? hasil.gaya?.teks2 ?? '#b7bdc6';
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

/** Kuning-oranye status "Perlu Perhatian", sama di semua gaya seperti merah dan hijau. */
const WARNA_PERHATIAN = '#f08c00';

export type KelasStatus = 'kritis' | 'perhatian' | 'terkendali' | 'proses' | 'netral';

/** Golongkan teks status dokumen (Critical, Perlu perhatian, Terkendali, On progress, ...). */
export const kelasStatus = (teks: string): KelasStatus => {
  const t = teks.toLowerCase();
  if (/critical|kritis|tinggi|high|terlambat|delay|gagal|merah/.test(t)) return 'kritis';
  if (/perlu|perhatian|medium|sedang|pending|tertunda|kuning|waspada|cukup/.test(t)) return 'perhatian';
  if (/terkendali|selesai|done|tercapai|on schedule|sesuai|rendah|low|aman|hijau|closed|baik|berfungsi|terkelola|siap/.test(t)) return 'terkendali';
  if (/progress|proses|berjalan|ongoing/.test(t)) return 'proses';
  return 'netral';
};

const warnaStatus = (k: KelasStatus, g: SpesifikasiHtml['gaya']): { latar: string; teks: string } => {
  if (k === 'kritis') return { latar: g.merah, teks: '#ffffff' };
  if (k === 'perhatian') return { latar: WARNA_PERHATIAN, teks: '#ffffff' };
  if (k === 'terkendali') return { latar: g.hijau, teks: '#ffffff' };
  if (k === 'proses') return { latar: `${g.aksen}26`, teks: g.aksen };
  return { latar: g.kartu2, teks: g.teks2 };
};

/**
 * Baris isu untuk papan tiga status: dari tabel (kolom pertama = isu, kolom
 * terakhir = status) atau dari kategori + catatan. Status tak dikenal dianggap
 * perlu perhatian supaya tidak hilang dari papan.
 */
const barisStatus = (data: DataChart): Array<{ isu: string; kelas: KelasStatus }> => {
  const mentah = data.tabel
    ? data.tabel.baris.map((b) => ({ isu: String(b[0] ?? ''), status: String(b[b.length - 1] ?? '') }))
    : data.kategori.map((k, i) => ({ isu: k, status: data.catatan?.[i] ?? '' }));
  return mentah
    .filter((b) => b.isu.trim())
    .map((b) => {
      const k = kelasStatus(b.status);
      return { isu: b.isu, kelas: k === 'proses' || k === 'netral' ? 'perhatian' : k };
    });
};

/** Teks gelap di atas warna terang, putih di atas warna gelap. */
const tintaDi = (hex: string): string => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#ffffff';
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 165 ? '#0f1a2e' : '#ffffff';
};

/** Indeks warna tetap untuk satu label, supaya ikon KPI berganti warna antarkartu. */
const indeksWarna = (label: string, n: number): number => {
  let h = 0;
  for (const c of label) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % n;
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
  // Gaya bertepi tegas (Blok, Koran) membawa tebal, warna, dan bayangan tepinya sendiri.
  const kotak: React.CSSProperties = {
    backgroundColor: g.kartu,
    border: `${g.tepi?.tebal ?? 1}px solid ${sorot ? warnaSorot ?? g.aksen : g.tepi?.warna ?? g.garis}`,
    boxShadow: g.tepi && g.tepi.bayangan !== 'none' ? g.tepi.bayangan : undefined,
    borderRadius: g.sudutKartu !== undefined ? `${Math.min(g.sudutKartu, 16) / 16}em` : '0.9em',
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
        // Tanpa h-full: di halaman layar penuh (flex kolom) strip ini harus
        // setinggi isinya, bukan setinggi induk, supaya grafik tetap kebagian ruang.
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[0.8em] shrink-0" style={{ color: g.teks }}>
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

  if (spesifikasi.jenis === 'kpi-tirta') {
    // Tirta: angka besar di atas "permukaan air". Tinggi air = capaian terhadap
    // `maks` bila dokumen menyebutnya; tanpa batas, air setengah kartu sebagai hiasan.
    const IkonKpi = Ikon ?? Gauge;
    const label = judul || data.kategori?.[0] || data.seri?.[0]?.nama || contohKartu.judul;
    const kosong = data.kosong === true;
    const delta = data.delta;
    const adaDelta = delta !== undefined && !(data.dariDokumen && delta === 0);
    const naik = (delta ?? 0) > 0;
    const datar = !delta;
    const warnaDelta = datar ? g.teks3 : naik ? g.hijau : g.merah;
    const PanahDelta = datar ? ArrowRight : naik ? ArrowUpRight : ArrowDownRight;
    const maks = typeof data.maks === 'number' && data.maks > 0 ? data.maks : null;
    const capai = maks && angka !== null && !kosong ? Math.max(0, Math.min(100, (angka / maks) * 100)) : null;
    // Permukaan air: capaian 100% = air setinggi 62% kartu, supaya label dan angka tetap terbaca.
    const muka = 100 - (12 + ((capai ?? 50) / 100) * 50);
    const idAir = `tirta-${String(label).replace(/\s+/g, '-')}`;
    const ombak = (y: number, a: number) =>
      `M0,${y} C12,${y - a} 25,${y - a} 37,${y} S62,${y + a} 75,${y} S100,${y - a} 100,${y} L100,100 L0,100 Z`;

    return (
      <div
        className="h-full relative overflow-hidden flex flex-col gap-[0.45em] p-[0.9em] min-w-0"
        style={{
          ...kotak,
          borderRadius: '1.1em',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
        onClick={onKlik}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
          <defs>
            <linearGradient id={idAir} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={g.aksen} stopOpacity="0.42" />
              <stop offset="100%" stopColor={g.palet[1] ?? g.aksen2} stopOpacity="0.12" />
            </linearGradient>
          </defs>
          <path d={ombak(muka + 4, 5)} fill={g.aksen} fillOpacity="0.12" />
          <path d={ombak(muka, 4)} fill={`url(#${idAir})`} />
        </svg>

        <div className="relative flex items-center justify-between gap-[0.5em]">
          <span className="inline-flex items-center gap-[0.45em] min-w-0">
            <span
              className="shrink-0 inline-flex items-center justify-center w-[1.8em] h-[1.8em] rounded-full"
              style={{ backgroundColor: `${g.aksen}26`, color: g.aksen, boxShadow: `0 0 0.9em ${g.aksen}40` }}
            >
              <IkonKpi className="w-[0.95em] h-[0.95em]" />
            </span>
            <span className="text-[0.76em] font-semibold truncate" style={{ color: g.teks2 }}>
              {label}
            </span>
          </span>
          {adaDelta && (
            <span
              className="inline-flex items-center gap-[0.1em] text-[0.66em] font-bold rounded-full px-[0.5em] py-[0.15em] shrink-0 border"
              style={{ color: warnaDelta, borderColor: `${warnaDelta}55`, backgroundColor: `${warnaDelta}14` }}
            >
              <PanahDelta className="w-[1em] h-[1em]" />
              {datar ? '0%' : `${naik ? '+' : ''}${String(delta).replace('.', ',')}%`}
            </span>
          )}
        </div>

        <div className="relative flex items-baseline gap-[0.3em] min-w-0">
          <span
            className="text-[1.85em] font-extrabold leading-none tabular-nums tracking-tight truncate"
            style={{ color: kosong ? g.teks3 : g.teks }}
          >
            {kosong ? '—' : teksAngka ?? format(angka, desimal)}
          </span>
          {satuan && !kosong && (
            <span className="text-[0.7em] font-semibold shrink-0" style={{ color: g.teks3 }}>
              {satuan}
            </span>
          )}
        </div>

        <div className="relative mt-auto flex items-end justify-between gap-[0.5em] text-[0.64em]">
          <span className="truncate" style={{ color: g.teks2 }}>
            {kosong ? 'belum ada di dokumen' : deltaTeks || ''}
          </span>
          {capai !== null && (
            <span className="font-bold tabular-nums shrink-0" style={{ color: g.teks }}>
              {capai.toLocaleString('id-ID', { maximumFractionDigits: 0 })}% capaian
            </span>
          )}
        </div>
      </div>
    );
  }

  if (spesifikasi.jenis === 'kpi-netral' || spesifikasi.jenis === 'kpi-pijar' || spesifikasi.jenis === 'kpi-kaca') {
    // Tiga wajah kartu KPI dengan data yang sama:
    // - netral (Default): garis aksen di atas, ikon berpetak, batang mini.
    // - pijar: kartu gelap berpendar oranye, ikon bergradasi, garis tren bercahaya.
    // - kaca: kartu bening buram, pil delta gelap, kapsul capaian terhadap maks.
    const wajah = spesifikasi.jenis;
    const IkonKpi = Ikon ?? Gauge;
    const label = judul || data.kategori?.[0] || data.seri?.[0]?.nama || contohKartu.judul;
    const kosong = data.kosong === true;
    const delta = data.delta;
    const adaDelta = delta !== undefined && !(data.dariDokumen && delta === 0);
    const naik = (delta ?? 0) > 0;
    const datar = !delta;
    const warnaDelta = datar ? g.teks3 : naik ? g.hijau : g.merah;
    const teksDelta = datar ? '0%' : `${naik ? '+' : ''}${String(delta).replace('.', ',')}%`;
    const deret = deretSpark(spark, data);
    const idGrad = `${wajah}-${String(label).replace(/\s+/g, '-')}`;
    const nilaiTampil = kosong ? '—' : teksAngka ?? format(angka, desimal);
    const PanahDelta = datar ? ArrowRight : naik ? ArrowUpRight : ArrowDownRight;

    const angkaUtama = (ukuran: string) => (
      <div className="flex items-baseline gap-[0.3em] min-w-0">
        <span
          className={`${ukuran} font-extrabold leading-none tabular-nums tracking-tight truncate`}
          style={kosong ? { color: g.teks3 } : undefined}
        >
          {nilaiTampil}
        </span>
        {satuan && !kosong && (
          <span className="text-[0.7em] font-semibold shrink-0" style={{ color: g.teks3 }}>
            {satuan}
          </span>
        )}
      </div>
    );

    if (wajah === 'kpi-netral') {
      // Batang mini: delapan titik terakhir, batang terakhir paling pekat.
      const batang = deret.slice(-8);
      const maksBatang = Math.max(...batang);
      const minBatang = Math.min(...batang);
      return (
        <div
          className="h-full relative overflow-hidden flex flex-col gap-[0.5em] p-[0.85em] pt-[1em] min-w-0"
          style={kotak}
          onClick={onKlik}
        >
          <span
            className="absolute inset-x-0 top-0 h-[0.22em]"
            style={{ background: `linear-gradient(90deg, ${g.aksen}, ${g.palet[1] ?? g.aksen2})` }}
          />
          <div className="flex items-center gap-[0.55em] min-w-0">
            <span
              className="shrink-0 inline-flex items-center justify-center w-[1.9em] h-[1.9em] rounded-[0.55em]"
              style={{ backgroundColor: `${g.aksen}1f`, color: g.aksen }}
            >
              <IkonKpi className="w-[1em] h-[1em]" />
            </span>
            <span className="text-[0.78em] font-semibold leading-tight truncate" style={{ color: g.teks2 }}>
              {label}
            </span>
          </div>
          {angkaUtama('text-[1.6em]')}
          <div className="flex items-end justify-between gap-[0.6em] mt-auto">
            {adaDelta ? (
              <span
                className="inline-flex items-center gap-[0.15em] text-[0.7em] font-bold rounded-full px-[0.55em] py-[0.15em] shrink-0"
                style={{ color: warnaDelta, backgroundColor: `${warnaDelta}1f` }}
              >
                <PanahDelta className="w-[1em] h-[1em]" />
                {teksDelta}
              </span>
            ) : (
              <span className="text-[0.68em]" style={{ color: g.teks3 }}>
                {kosong ? 'belum ada di dokumen' : 'tanpa pembanding'}
              </span>
            )}
            {batang.length >= 2 && (
              <div className="flex items-end gap-[0.18em] h-[1.9em]" aria-hidden>
                {batang.map((v, i) => (
                  <span
                    key={i}
                    className="w-[0.36em] rounded-full"
                    style={{
                      height: `${28 + ((v - minBatang) / (maksBatang - minBatang || 1)) * 72}%`,
                      backgroundColor: g.aksen,
                      opacity: i === batang.length - 1 ? 1 : 0.28 + (i / batang.length) * 0.4,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          {deltaTeks && (
            <span className="text-[0.66em] truncate -mt-[0.2em]" style={{ color: g.teks3 }}>
              {deltaTeks}
            </span>
          )}
        </div>
      );
    }

    if (wajah === 'kpi-pijar') {
      const jalur = jalurSpark(deret);
      return (
        <div
          className="h-full relative overflow-hidden flex flex-col gap-[0.45em] p-[0.85em] min-w-0"
          style={{
            ...kotak,
            background: `radial-gradient(circle at 100% 0%, ${g.aksen}38 0%, transparent 55%), ${g.kartu}`,
          }}
          onClick={onKlik}
        >
          <div className="flex items-start justify-between gap-[0.5em]">
            <div className="min-w-0">
              <p className="text-[0.62em] font-bold uppercase tracking-[0.12em] truncate" style={{ color: g.aksen2 }}>
                {label}
              </p>
              {deltaTeks && (
                <p className="text-[0.62em] truncate mt-[0.15em]" style={{ color: g.teks3 }}>
                  {deltaTeks}
                </p>
              )}
            </div>
            <span
              className="shrink-0 inline-flex items-center justify-center w-[2.1em] h-[2.1em] rounded-[0.7em] text-white"
              style={{ background: `linear-gradient(135deg, ${g.aksen2}, ${g.aksen})`, boxShadow: `0 0.4em 1.2em ${g.aksen}55` }}
            >
              <IkonKpi className="w-[1.05em] h-[1.05em]" />
            </span>
          </div>
          <div className="flex items-end justify-between gap-[0.5em]">
            {angkaUtama('text-[1.7em]')}
            {adaDelta && (
              <span className="inline-flex items-center text-[0.72em] font-bold shrink-0" style={{ color: warnaDelta }}>
                <PanahDelta className="w-[1.05em] h-[1.05em]" />
                {teksDelta}
              </span>
            )}
          </div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full flex-1 min-h-[1.4em] max-h-[2.2em]" aria-hidden>
            <defs>
              <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={g.aksen} stopOpacity="0.45" />
                <stop offset="100%" stopColor={g.aksen} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={jalur.area} fill={`url(#${idGrad})`} />
            <path
              d={jalur.garis}
              fill="none"
              stroke={g.aksen}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ filter: `drop-shadow(0 0 4px ${g.aksen})` }}
            />
          </svg>
        </div>
      );
    }

    // kpi-kaca: capaian dihitung terhadap `maks` bila dokumen menyebutnya.
    const maks = typeof data.maks === 'number' && data.maks > 0 ? data.maks : null;
    const capai = maks && angka !== null ? Math.max(0, Math.min(100, (angka / maks) * 100)) : null;
    return (
      <div
        className="h-full flex flex-col gap-[0.55em] p-[0.95em] min-w-0"
        style={{
          ...kotak,
          backgroundColor: 'rgba(255,255,255,0.42)',
          border: `1px solid ${sorot ? warnaSorot ?? g.aksen : 'rgba(255,255,255,0.65)'}`,
          borderRadius: '1.15em',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 0.6em 1.6em rgba(60,40,20,0.12), inset 0 1px 0 rgba(255,255,255,0.7)',
        }}
        onClick={onKlik}
      >
        <div className="flex items-center justify-between gap-[0.5em]">
          <span className="inline-flex items-center gap-[0.45em] min-w-0">
            <span
              className="shrink-0 inline-flex items-center justify-center w-[1.8em] h-[1.8em] rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.7)', color: g.teks }}
            >
              <IkonKpi className="w-[0.95em] h-[0.95em]" />
            </span>
            <span className="text-[0.76em] font-semibold truncate" style={{ color: g.teks2 }}>
              {label}
            </span>
          </span>
          {adaDelta && (
            <span
              className="inline-flex items-center gap-[0.1em] text-[0.66em] font-bold rounded-full px-[0.55em] py-[0.2em] shrink-0"
              style={{ backgroundColor: g.teks, color: datar ? '#ffffff' : naik ? '#7ee2b8' : '#ffb4a2' }}
            >
              <PanahDelta className="w-[1em] h-[1em]" />
              {teksDelta}
            </span>
          )}
        </div>
        {angkaUtama('text-[1.8em]')}
        <div className="mt-auto">
          {capai !== null ? (
            <>
              <div className="flex justify-between text-[0.62em] font-semibold mb-[0.3em]" style={{ color: g.teks3 }}>
                <span className="truncate">{deltaTeks || 'Capaian'}</span>
                <span className="tabular-nums" style={{ color: g.teks }}>
                  {capai.toLocaleString('id-ID', { maximumFractionDigits: 0 })}%
                </span>
              </div>
              <div className="h-[0.6em] rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.6)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${capai}%`, background: `linear-gradient(90deg, ${g.aksen}, ${g.aksen2})` }}
                />
              </div>
            </>
          ) : (
            deltaTeks && (
              <span className="text-[0.66em]" style={{ color: g.teks3 }}>
                {deltaTeks}
              </span>
            )
          )}
        </div>
      </div>
    );
  }

  if (spesifikasi.jenis === 'kpi-korporat') {
    // Deck rapat manajemen: ikon putih di lingkaran padat, label, angka besar,
    // keterangan kecil di bawahnya. Warna lingkaran bergiliran menurut label.
    const IkonKpi = Ikon ?? Gauge;
    const label = judul || data.kategori?.[0] || data.seri?.[0]?.nama || contohKartu.judul;
    const kosong = data.kosong === true;
    const delta = data.delta;
    const adaDelta = delta !== undefined && delta !== 0 && !kosong;
    const naik = (delta ?? 0) > 0;
    const warnaIkon = data.warnaIkon ?? g.palet[indeksWarna(String(label), 4) % g.palet.length];
    return (
      <div className="h-full flex items-start gap-[0.7em] p-[0.85em] min-w-0" style={kotak} onClick={onKlik}>
        <span
          className="shrink-0 inline-flex items-center justify-center w-[2.3em] h-[2.3em] rounded-full text-white"
          style={{ backgroundColor: warnaIkon, boxShadow: `0 0.35em 0.9em ${warnaIkon}40` }}
        >
          <IkonKpi className="w-[1.1em] h-[1.1em]" />
        </span>
        <div className="min-w-0 flex-1 flex flex-col gap-[0.2em]">
          <p className="text-[0.74em] font-semibold leading-tight line-clamp-2" style={{ color: g.teks2 }}>
            {label}
          </p>
          <div className="flex items-baseline gap-[0.3em] min-w-0">
            <span
              className="text-[1.55em] font-extrabold leading-none tabular-nums tracking-tight truncate"
              style={{ color: kosong ? g.teks3 : g.teks }}
            >
              {kosong ? '—' : teksAngka ?? format(angka, desimal)}
            </span>
            {satuan && !kosong && (
              <span className="text-[0.68em] font-semibold shrink-0" style={{ color: g.teks3 }}>
                {satuan}
              </span>
            )}
          </div>
          <p className="text-[0.62em] font-medium truncate" style={{ color: g.teks3 }}>
            {kosong ? (
              'belum ada di dokumen'
            ) : adaDelta ? (
              <span style={{ color: naik ? g.hijau : g.merah }}>
                {naik ? '▲' : '▼'} {String(Math.abs(delta!)).replace('.', ',')}%{' '}
                <span style={{ color: g.teks3 }}>{deltaTeks}</span>
              </span>
            ) : (
              deltaTeks || ' '
            )}
          </p>
        </div>
      </div>
    );
  }

  if (spesifikasi.jenis === 'kpi-target') {
    // Sasaran tahun depan ("≥ 95%") di atas capaian saat ini.
    const IkonKpi = Ikon ?? Target;
    const label = judul || data.kategori?.[0] || data.seri?.[0]?.nama || 'Sasaran';
    const kosong = data.kosong === true || angka === null;
    const sasaran = typeof data.target === 'number' ? data.target : null;
    const turun = data.arahBaik === 'turun';
    const teksSasaran = (v: number) => `${turun ? '≤' : '≥'} ${format(v, desimal)}${satuan === '%' ? '%' : satuan ? ` ${satuan}` : ''}`;
    const capai =
      sasaran !== null && !kosong && sasaran !== 0
        ? Math.max(0, Math.min(100, turun ? (sasaran / Math.max(angka!, 1e-9)) * 100 : (angka! / sasaran) * 100))
        : null;
    const tercapai = capai !== null && capai >= 100;
    return (
      <div className="h-full flex flex-col gap-[0.45em] p-[0.85em] min-w-0" style={kotak} onClick={onKlik}>
        <div className="flex items-center gap-[0.55em] min-w-0">
          <span
            className="shrink-0 inline-flex items-center justify-center w-[2em] h-[2em] rounded-full"
            style={{ backgroundColor: `${g.aksen}1f`, color: g.aksen, boxShadow: `inset 0 0 0 1px ${g.aksen}40` }}
          >
            <IkonKpi className="w-[1em] h-[1em]" />
          </span>
          <span className="text-[0.76em] font-semibold leading-tight line-clamp-2" style={{ color: g.teks2 }}>
            {label}
          </span>
        </div>
        <span className="text-[1.55em] font-extrabold leading-none tabular-nums tracking-tight" style={{ color: g.aksen }}>
          {sasaran !== null ? teksSasaran(sasaran) : kosong ? '—' : teksAngka ?? format(angka, desimal)}
        </span>
        <div className="mt-auto">
          <div className="flex justify-between gap-[0.5em] text-[0.62em] font-semibold mb-[0.3em]" style={{ color: g.teks3 }}>
            <span className="truncate">
              {kosong ? 'Realisasi belum ada di dokumen' : `Realisasi ${teksAngka ?? format(angka, desimal)}${satuan === '%' ? '%' : ''}`}
            </span>
            {capai !== null && (
              <span className="tabular-nums shrink-0" style={{ color: tercapai ? g.hijau : g.teks }}>
                {tercapai ? 'Tercapai' : `${capai.toLocaleString('id-ID', { maximumFractionDigits: 0 })}%`}
              </span>
            )}
          </div>
          <div className="h-[0.42em] rounded-full overflow-hidden" style={{ backgroundColor: g.kartu2 }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${capai ?? 0}%`, backgroundColor: tercapai ? g.hijau : g.aksen }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (spesifikasi.jenis === 'papan-isu') {
    // Issue board tiga kolom: Critical, Perlu Perhatian, Terkendali.
    const isu = barisStatus(data);
    const kolom: Array<{ kelas: KelasStatus; judul: string; warna: string; IkonKolom: React.ComponentType<{ className?: string }> }> = [
      { kelas: 'kritis', judul: 'Critical', warna: g.merah, IkonKolom: AlertOctagon },
      { kelas: 'perhatian', judul: 'Perlu Perhatian', warna: WARNA_PERHATIAN, IkonKolom: AlertTriangle },
      { kelas: 'terkendali', judul: 'Terkendali', warna: g.hijau, IkonKolom: CheckCircle2 },
    ];
    return (
      <div className="h-full grid grid-cols-3 gap-[0.55em] min-h-0" style={{ color: g.teks }} onClick={onKlik}>
        {kolom.map(({ kelas, judul: jdl, warna, IkonKolom }) => {
          const isi = isu.filter((b) => b.kelas === kelas);
          return (
            <div
              key={kelas}
              className="flex flex-col min-h-0 overflow-hidden"
              style={{ ...kotak, borderColor: `${warna}55`, background: `linear-gradient(180deg, ${warna}12 0%, ${g.kartu} 55%)` }}
            >
              <div
                className="flex items-center gap-[0.4em] px-[0.6em] py-[0.45em] text-white text-[0.68em] font-extrabold uppercase tracking-wide"
                style={{ backgroundColor: warna }}
              >
                <IkonKolom className="w-[1.15em] h-[1.15em] shrink-0" />
                <span className="truncate">{jdl}</span>
                <span className="ml-auto tabular-nums opacity-90">{isi.length}</span>
              </div>
              <ul className="flex-1 min-h-0 overflow-auto gulir-tema px-[0.7em] py-[0.55em] space-y-[0.35em]">
                {isi.length === 0 && (
                  <li className="text-[0.66em]" style={{ color: g.teks3 }}>
                    Tidak ada
                  </li>
                )}
                {isi.map((b, i) => (
                  <li key={`${b.isu}-${i}`} className="flex items-start gap-[0.4em] text-[0.7em] leading-snug">
                    <span className="mt-[0.45em] w-[0.38em] h-[0.38em] rounded-full shrink-0" style={{ backgroundColor: warna }} />
                    <span className="min-w-0">{b.isu}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    );
  }

  if (spesifikasi.jenis === 'tabel-status') {
    // Action plan: kepala gelap, kolom terakhir pil status berwarna.
    const tabel = data.tabel ?? { kepala: ['Keterangan', 'Status'], baris: data.kategori.map((k, i) => [k, data.catatan?.[i] ?? '-']) };
    const terang = cukupTerang(g.kartu.startsWith('#') ? g.kartu : '#ffffff');
    const latarKepala = terang ? g.teks : g.kartu2;
    const akhir = tabel.kepala.length - 1;
    return (
      <div className="h-full min-h-0 overflow-auto gulir-tema" style={{ ...kotak, padding: 0 }} onClick={onKlik}>
        <table className="w-full text-[0.68em] border-collapse">
          <thead>
            <tr style={{ backgroundColor: latarKepala, color: terang ? '#ffffff' : g.teks }}>
              <th className="font-bold py-[0.5em] pl-[0.8em] pr-[0.3em] text-left w-[2.2em]">No</th>
              {tabel.kepala.map((k, i) => (
                <th key={k} className={`font-bold py-[0.5em] px-[0.5em] ${i === akhir ? 'text-center' : 'text-left'}`}>
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabel.baris.map((sel, r) => {
              const status = String(sel[akhir] ?? '');
              const warna = warnaStatus(kelasStatus(status), g);
              return (
                <tr key={`baris-${r}`} style={{ borderTop: `1px solid ${g.garis}` }}>
                  <td className="py-[0.45em] pl-[0.8em] pr-[0.3em] tabular-nums" style={{ color: g.teks3 }}>
                    {r + 1}
                  </td>
                  {sel.map((isiSel, i) =>
                    i === akhir ? (
                      <td key={`sel-${r}-${i}`} className="py-[0.4em] px-[0.5em] text-center">
                        <span
                          className="inline-block min-w-[6.5em] px-[0.6em] py-[0.2em] rounded-[0.4em] text-[0.92em] font-bold uppercase tracking-wide"
                          style={{ backgroundColor: warna.latar, color: warna.teks }}
                        >
                          {status || '—'}
                        </span>
                      </td>
                    ) : (
                      <td
                        key={`sel-${r}-${i}`}
                        className="py-[0.45em] px-[0.5em]"
                        style={{ color: i === 0 ? g.teks : g.teks2, fontWeight: i === 0 ? 600 : 400 }}
                      >
                        {isiSel}
                      </td>
                    )
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (spesifikasi.jenis === 'alur-tahap') {
    // Pipeline bertahap: lingkaran bernomor tersambung garis, jumlah di bawah tiap tahap.
    const nilai = data.seri?.[0]?.data ?? [];
    const puncak = Math.max(1, ...nilai.map((v) => Number(v ?? 0)));
    const n = data.kategori.length;
    return (
      <div className="h-full flex flex-col justify-center gap-[0.7em] px-[0.8em] py-[0.75em] min-w-0" style={kotak} onClick={onKlik}>
        <div className="relative grid gap-[0.2em]" style={{ gridTemplateColumns: `repeat(${Math.max(n, 1)}, minmax(0, 1fr))` }}>
          <span
            className="absolute top-[1em] h-[0.18em] rounded-full"
            style={{ left: `${50 / Math.max(n, 1)}%`, right: `${50 / Math.max(n, 1)}%`, backgroundColor: `${g.aksen}40` }}
          />
          {data.kategori.map((tahap, i) => {
            const v = nilai[i];
            return (
              <div key={tahap} className="relative flex flex-col items-center gap-[0.3em] min-w-0 text-center">
                <span
                  className="w-[2em] h-[2em] rounded-full flex items-center justify-center text-[0.8em] font-extrabold"
                  style={{ backgroundColor: g.palet[i % 2 === 0 ? 0 : 3] ?? g.aksen, color: tintaDi(g.palet[i % 2 === 0 ? 0 : 3] ?? g.aksen), boxShadow: `0 0 0 0.22em ${g.kartu}` }}
                >
                  {i + 1}
                </span>
                <span className="text-[0.62em] font-bold uppercase tracking-wide leading-tight line-clamp-2" style={{ color: g.teks2 }}>
                  {tahap}
                </span>
                {typeof v === 'number' && (
                  <span className="text-[0.86em] font-extrabold tabular-nums leading-none" style={{ color: g.teks }}>
                    {format(v, desimal)}
                  </span>
                )}
                {typeof v === 'number' && (
                  <span className="block w-[80%] h-[0.28em] rounded-full overflow-hidden" style={{ backgroundColor: g.kartu2 }}>
                    <span className="block h-full rounded-full" style={{ width: `${(v / puncak) * 100}%`, backgroundColor: g.aksen2 }} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {satuan && (
          <p className="text-[0.6em] text-right" style={{ color: g.teks3 }}>
            Jumlah per tahap, satuan {satuan}
          </p>
        )}
      </div>
    );
  }

  if (spesifikasi.jenis === 'corong-pipeline') {
    // Corong: batang di tengah, makin sempit tiap tahap, angka di kanan.
    const nilai = (data.seri?.[0]?.data ?? []).map((v) => Number(v ?? 0));
    const puncak = Math.max(1, ...nilai);
    const total = nilai.reduce((a, b) => a + b, 0);
    return (
      <div className="h-full flex flex-col gap-[0.35em] px-[0.8em] py-[0.75em] min-h-0" style={kotak} onClick={onKlik}>
        <div className="flex-1 min-h-0 flex flex-col justify-center gap-[0.3em]">
          {data.kategori.map((tahap, i) => {
            const v = nilai[i] ?? 0;
            const lebar = 38 + (v / puncak) * 62;
            return (
              <div key={tahap} className="flex items-center gap-[0.5em]">
                <div className="flex-1 flex justify-center min-w-0">
                  <div
                    className="flex items-center justify-center px-[0.6em] py-[0.42em] text-[0.72em] font-bold truncate"
                    style={{
                      width: `${lebar}%`,
                      backgroundColor: g.palet[i % g.palet.length],
                      color: tintaDi(g.palet[i % g.palet.length]),
                      clipPath: 'polygon(0 0, 100% 0, 96% 100%, 4% 100%)',
                    }}
                  >
                    {tahap}
                  </div>
                </div>
                <span className="w-[3.2em] text-right text-[0.86em] font-extrabold tabular-nums shrink-0" style={{ color: g.teks }}>
                  {format(v, desimal)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[0.7em] font-bold pt-[0.35em]" style={{ borderTop: `1px solid ${g.garis}` }}>
          <span style={{ color: g.teks2 }}>Total pipeline</span>
          <span className="tabular-nums" style={{ color: g.teks }}>
            {format(total, desimal)}
            {satuan ? ` ${satuan}` : ''}
          </span>
        </div>
      </div>
    );
  }

  if (spesifikasi.jenis === 'daftar-progres') {
    // Daftar aspek dengan batang tebal dan persen di kanan; di bawah sasaran = warna kedua.
    const nilai = data.seri?.[0]?.data ?? [];
    const sasaran = typeof data.target === 'number' ? data.target : null;
    const maks = satuan === '%' ? 100 : Math.max(1, ...nilai.map((v) => Number(v ?? 0)));
    return (
      <div className="h-full flex flex-col justify-center gap-[0.5em] px-[0.8em] py-[0.75em] min-h-0" style={kotak} onClick={onKlik}>
        {data.kategori.slice(0, 8).map((label, i) => {
          const v = Number(nilai[i] ?? 0);
          const kurang = sasaran !== null && v < sasaran;
          return (
            <div key={label} className="text-[0.72em]">
              <div className="flex items-center justify-between gap-[0.5em]">
                <span className="truncate font-medium" style={{ color: g.teks2 }}>
                  {label}
                </span>
                <span className="font-extrabold tabular-nums shrink-0" style={{ color: kurang ? g.aksen2 : g.teks }}>
                  {format(v, desimal)}
                  {satuan === '%' ? '%' : ''}
                </span>
              </div>
              <span className="block h-[0.5em] rounded-full overflow-hidden mt-[0.25em]" style={{ backgroundColor: g.kartu2 }}>
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${Math.max(0, Math.min(100, (v / maks) * 100))}%`, backgroundColor: kurang ? g.aksen2 : g.aksen }}
                />
              </span>
            </div>
          );
        })}
        {sasaran !== null && (
          <p className="text-[0.6em]" style={{ color: g.teks3 }}>
            Sasaran {format(sasaran, desimal)}
            {satuan === '%' ? '%' : ''}; di bawah sasaran ditandai warna kedua.
          </p>
        )}
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
