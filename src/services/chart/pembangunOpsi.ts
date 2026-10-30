/* eslint-disable @typescript-eslint/no-explicit-any */
import type { GayaVarian } from './gayaVarian';

/**
 * BENTUK DATA TUNGGAL UNTUK SEMUA CHART.
 *
 * Satu bentuk data dipakai semua varian. Itu inti dari "satu chart banyak
 * gaya": ganti wajah tidak boleh menuntut data yang berbeda.
 */
export interface DataChart {
  /** Label sumbu X atau label kategori. */
  kategori: string[];
  /** Satu atau lebih deret angka. `null` berarti sel kosong. */
  seri: Array<{ nama: string; data: Array<number | null> }>;
  /** Satuan angka, mis. `m³`, `%`, `miliar Rp`. Dipakai di label dan tooltip. */
  satuan?: string;
  /** Garis target atau rata-rata (satu angka) untuk bentuk yang memerlukannya. */
  target?: number;
  /** Nilai total untuk donat dan gauge. Bila kosong dihitung dari seri pertama. */
  total?: number;
  /** Batas atas gauge. */
  maks?: number;
  /** Jumlah desimal pada label. */
  desimal?: number;
  /** Perubahan dibanding periode lalu, dalam persen. Dipakai kartu KPI. */
  delta?: number;
  /** Keterangan baris kedua tiap baris tabel, sejajar `kategori`. */
  catatan?: string[];
  /** true = angka berasal dari dokumen (bukan contoh). Dipakai beberapa wajah. */
  dariDokumen?: boolean;
  /** Teks perubahan yang sudah diformat, mis. `+12,4%`. Dipakai kartu KPI Lensa dan Nadi. */
  deltaTeks?: string;
  /** true = dokumen tidak menyebut angka ini. Kartu KPI menampilkan tanda pisah. */
  kosong?: boolean;
  /** Arah yang dianggap baik. Nadi memakai ini untuk memilih hijau atau merah. */
  arahBaik?: 'naik' | 'turun';
  /** Warna ikon kartu KPI. Bila kosong dipakai warna aksen varian. */
  warnaIkon?: string;
  /** Satu deret pendek per kategori untuk sparkline di dalam daftar. */
  deretKecil?: number[][];
  /**
   * Tabel angka jadi: kepala kolom dan isi yang sudah diformat. Dipakai wajah
   * `tabel-ringkas` saat halaman membutuhkan tabel berkepala, bukan daftar.
   */
  tabel?: {
    kepala: string[];
    baris: Array<Array<string | number>>;
    /** Indeks kolom yang diwarnai menurut ambang. */
    kolomSorot?: number;
    /** Nilai ambang: di atasnya merah, di bawahnya hijau. */
    ambang?: number;
  };
}

export type Pembangun = (d: DataChart, g: GayaVarian, s: number) => any;

/** Angka pertama tiap kategori dari seri ke-0. */
const deret = (d: DataChart): Array<number | null> => d.seri[0]?.data ?? [];

/**
 * Warna untuk kategori ke-i. Satu deret dengan banyak kategori tidak
 * boleh semuanya satu warna: pembaca tidak bisa membedakan batang, dan
 * legenda jadi deretan warna kembar. Palet varian dipakai bergiliran.
 */
const warnaKategori = (g: GayaVarian, i: number): string => g.palet[i % g.palet.length];

const angkaSah = (d: DataChart): number[] =>
  deret(d).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

export const format = (v: number, d: DataChart): string => {
  const desimal = typeof d.desimal === 'number' ? d.desimal : Number.isInteger(v) ? 0 : 1;
  return v.toLocaleString('id-ID', { maximumFractionDigits: desimal });
};

export const labelNilai = (v: number, d: DataChart): string =>
  d.satuan ? `${format(v, d)} ${d.satuan}` : format(v, d);

/** Gradasi dari warna aksen ke arah yang ditentukan gaya varian. */
const gradien = (g: GayaVarian, warna: string, tebal = 1) => {
  const arah = g.gradasi === 'x' ? { x: 0, y: 0, x2: 1, y2: 0 } : { x: 0, y: 0, x2: 0, y2: 1 };
  const ujung = warna.startsWith('#')
    ? `rgba(${parseInt(warna.slice(1, 3), 16)},${parseInt(warna.slice(3, 5), 16)},${parseInt(warna.slice(5, 7), 16)},${(g.gradasiUjung * tebal).toFixed(2)})`
    : warna;
  return { type: 'linear', ...arah, colorStops: [{ offset: 0, color: warna }, { offset: 1, color: ujung }] };
};

const tooltip = (g: GayaVarian, s: number) => ({
  backgroundColor: g.kartu2,
  borderColor: g.garis,
  borderWidth: 1,
  padding: [7 * s, 11 * s],
  extraCssText: `border-radius:${8 * s}px; box-shadow:0 ${6 * s}px ${18 * s}px rgba(0,0,0,0.45);`,
  textStyle: { color: g.teks, fontSize: 11 * s },
});

const sumbuKategori = (
  g: GayaVarian,
  s: number,
  kategori: string[],
  garisBawah = false,
  /** 0 = semua label tampil. 'auto' = ECharts memilih sendiri agar tidak bertumpuk. */
  jarakLabel: number | 'auto' = 0,
) => ({
  type: 'category',
  data: kategori,
  axisLine: garisBawah ? { lineStyle: { color: g.garis } } : { show: false },
  axisTick: { show: false },
  axisLabel: { color: g.teks3, fontSize: 9.5 * s, interval: jarakLabel },
});

const sumbuNilai = (g: GayaVarian, s: number, opsi: { maks?: number; satuanSumbu?: string; format?: (v: number) => string } = {}) => ({
  type: 'value',
  max: opsi.maks,
  axisLine: { show: false },
  axisTick: { show: false },
  splitLine: { lineStyle: { color: g.garis, type: 'dashed', width: 1 } },
  axisLabel: {
    color: g.teks3,
    fontSize: 9.5 * s,
    formatter: (v: number) => (opsi.format ? opsi.format(v) : opsi.satuanSumbu ? `${v}${opsi.satuanSumbu}` : String(v)),
  },
});

/* ------------------------------ BENTUK ECHARTS ------------------------------ */

/** Batang polos: gaya netral tanpa sorotan dan tanpa garis tren. */
export const barTegak: Pembangun = (d, g, s) => ({
  grid: { left: 6 * s, right: 12 * s, top: 14 * s, bottom: 4, containLabel: true },
  tooltip: { ...tooltip(g, s), trigger: 'axis' },
  xAxis: sumbuKategori(g, s, d.kategori),
  yAxis: sumbuNilai(g, s, { satuanSumbu: d.satuan ? ` ${d.satuan}` : undefined }),
  series: [
    {
      type: 'bar',
      name: d.seri[0]?.nama ?? 'Nilai',
      barMaxWidth: 26 * s,
      data: deret(d).map((v, i) => ({
        value: typeof v === 'number' ? v : null,
        itemStyle: { color: warnaKategori(g, i), borderRadius: [g.sudut * s, g.sudut * s, 0, 0] },
      })),
    },
  ],
});

/** Batang bergradasi dengan sorotan puncak, label pil, dan garis tren. */
export const barSorot: Pembangun = (d, g, s) => {
  const nilai = deret(d);
  const angka = angkaSah(d);
  const puncak = angka.length ? nilai.indexOf(Math.max(...angka)) : -1;
  return {
    grid: { left: 6 * s, right: 18 * s, top: 22 * s, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltip(g, s),
      trigger: 'axis',
      formatter: (p: any[]) => {
        const i = p[0]?.dataIndex ?? 0;
        const v = Number(nilai[i] ?? 0);
        return `<div style="font-size:${10 * s}px;color:${g.teks3}">${d.kategori[i] ?? ''}</div><b>${labelNilai(v, d)}</b>`;
      },
    },
    xAxis: sumbuKategori(g, s, d.kategori),
    yAxis: sumbuNilai(g, s, { format: (v) => format(v, d) }),
    series: [
      {
        type: 'bar',
        name: d.seri[0]?.nama ?? 'Nilai',
        barMaxWidth: 26 * s,
        barWidth: '46%',
        z: 2,
        data: nilai.map((v, i) => ({
          value: v,
          itemStyle: {
            color: gradien(g, warnaKategori(g, i), g.sorotPuncak && i === puncak ? 1 : 2.6),
            borderRadius: [g.sudut * s, g.sudut * s, 0, 0],
            shadowColor: g.sorotPuncak && i === puncak ? `${warnaKategori(g, i)}88` : `${warnaKategori(g, i)}33`,
            shadowBlur: (g.sorotPuncak && i === puncak ? 14 : 6) * s,
            shadowOffsetY: 2 * s,
          },
          label: {
            show: true,
            position: 'top',
            distance: 8 * s,
            color: g.labelPil ? (i === puncak ? g.teks : g.teks2) : g.teks3,
            fontSize: 8.8 * s,
            fontWeight: i === puncak ? 'bold' : 'normal',
            backgroundColor: g.labelPil ? 'rgba(10,10,11,0.72)' : 'transparent',
            borderRadius: g.labelPil ? 3 * s : 0,
            padding: g.labelPil ? [1 * s, 3 * s] : 0,
            formatter: () => (typeof v === 'number' ? format(v, d) : ''),
          },
        })),
      },
      ...(g.garisTren
        ? [
            {
              name: 'Tren',
              type: 'line',
              smooth: 0.2,
              symbol: 'circle',
              symbolSize: 6 * s,
              data: nilai,
              lineStyle: { width: g.tebalGaris * s, color: g.warnaTren, shadowColor: `${g.warnaTren}99`, shadowBlur: 12 * s },
              itemStyle: { color: g.warnaTren, borderColor: g.latar, borderWidth: 1.8 * s },
              tooltip: { show: false },
              z: 3,
            },
          ]
        : []),
    ],
  };
};

/** Batang dengan garis target atau rata-rata. */
export const barTarget: Pembangun = (d, g, s) => {
  const dasar = barSorot(d, g, s);
  const rata = typeof d.target === 'number' ? d.target : angkaSah(d).length ? angkaSah(d).reduce((a, b) => a + b, 0) / angkaSah(d).length : 0;
  dasar.series[0] = {
    ...dasar.series[0],
    markLine: {
      symbol: 'none',
      silent: true,
      lineStyle: { color: g.teks3, type: 'dashed', width: 1 },
      label: {
        formatter: d.satuan ? `target ${format(rata, d)} ${d.satuan}` : `target ${format(rata, d)}`,
        color: g.teks3,
        fontSize: 9 * s,
        position: 'insideEndTop',
      },
      data: [{ yAxis: rata }],
    },
  };
  return dasar;
};

/** Batang mendatar dengan label di ujung, untuk peringkat. */
export const barPeringkat: Pembangun = (d, g, s) => {
  const nilai = deret(d);
  const angka = angkaSah(d);
  const puncak = angka.length ? nilai.indexOf(Math.max(...angka)) : -1;
  return {
    grid: { left: 6 * s, right: 44 * s, top: 6 * s, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltip(g, s),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (p: any[]) => `<div>${d.kategori[p[0]?.dataIndex ?? 0] ?? ''}: <b>${labelNilai(Number(p[0]?.value ?? 0), d)}</b></div>`,
    },
    xAxis: sumbuNilai(g, s, { format: (v) => format(v, d) }),
    yAxis: { ...sumbuKategori(g, s, d.kategori), splitLine: { show: false } },
    series: [
      {
        type: 'bar',
        name: d.seri[0]?.nama ?? 'Nilai',
        barWidth: '54%',
        data: nilai.map((v, i) => ({
          value: v,
          itemStyle: {
            color: gradien(g, warnaKategori(g, i), g.sorotPuncak && i === puncak ? 1 : 2.4),
            borderRadius: [0, g.sudut * s, g.sudut * s, 0],
            shadowColor: `${warnaKategori(g, i)}44`,
            shadowBlur: 6 * s,
          },
          label: {
            show: true,
            position: 'right',
            distance: 6 * s,
            color: g.labelPil ? g.teks2 : g.teks3,
            fontSize: 8.8 * s,
            fontWeight: i === puncak ? 'bold' : 'normal',
            formatter: () => (typeof v === 'number' ? format(v, d) : ''),
          },
        })),
      },
    ],
  };
};

/** Batang mendatar berpasangan: jalur target di belakang, capaian di depan. */
export const barTargetMendatar: Pembangun = (d, g, s) => {
  const nilai = deret(d);
  const target = d.seri[1]?.data ?? [];
  return {
    grid: { left: 6 * s, right: 24 * s, top: 8 * s, bottom: 4, containLabel: true },
    tooltip: { ...tooltip(g, s), trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { show: false },
    xAxis: sumbuNilai(g, s, { format: (v) => format(v, d) }),
    yAxis: { ...sumbuKategori(g, s, d.kategori), inverse: true, splitLine: { show: false } },
    series: [
      {
        type: 'bar',
        name: d.seri[1]?.nama ?? 'Target',
        data: target,
        barWidth: 9 * s,
        barGap: '-100%',
        z: 1,
        silent: true,
        itemStyle: { color: 'rgba(255,255,255,0.06)', borderRadius: [0, g.sudut * s, g.sudut * s, 0] },
      },
      {
        type: 'bar',
        name: d.seri[0]?.nama ?? 'Capaian',
        data: nilai.map((v, i) => ({
          value: v,
          itemStyle: { color: gradien(g, warnaKategori(g, i)), borderRadius: [0, g.sudut * s, g.sudut * s, 0] },
        })),
        barWidth: 9 * s,
        z: 2,
        label: {
          show: true,
          position: 'right',
          color: g.teks2,
          fontSize: 9 * s,
          backgroundColor: g.labelPil ? 'rgba(10,10,11,0.72)' : 'transparent',
          borderRadius: g.labelPil ? 3 * s : 0,
          padding: g.labelPil ? [1 * s, 3 * s] : 0,
          formatter: (p: any) => `${format(Number(p.value ?? 0), d)}${d.satuan ?? ''}`,
        },
      },
    ],
  };
};

/** Batang bertumpuk dari dua seri. */
export const barTumpuk: Pembangun = (d, g, s) => {
  const seri = d.seri.length > 1 ? d.seri : [...d.seri, { nama: 'Lainnya', data: (d.seri[0]?.data ?? []).map(() => 0) }];
  return {
    grid: { left: 6 * s, right: 14 * s, top: 18 * s, bottom: 4, containLabel: true },
    tooltip: { ...tooltip(g, s), trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { show: false },
    xAxis: sumbuKategori(g, s, d.kategori),
    yAxis: sumbuNilai(g, s, { format: (v) => format(v, d) }),
    series: seri.map((x, i) => ({
      type: 'bar',
      name: x.nama,
      stack: 'total',
      barWidth: '46%',
      data: x.data,
      itemStyle: { color: i === 0 ? gradien(g, g.aksen) : g.palet[(i + 1) % g.palet.length] },
    })),
  };
};

/** Area bergradasi dengan titik ujung berlabel. */
export const areaGradasi: Pembangun = (d, g, s) => {
  const nilai = deret(d);
  const akhir = nilai.length - 1;
  return {
    grid: { left: 6 * s, right: 26 * s, top: 16 * s, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltip(g, s),
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: `${g.aksen}77`, type: 'dashed', width: 1 } },
      formatter: (p: any[]) => `<div style="font-size:${10 * s}px;color:${g.teks3}">${p[0]?.name ?? ''}</div><b>${labelNilai(Number(p[0]?.value ?? 0), d)}</b>`,
    },
    xAxis: { ...sumbuKategori(g, s, d.kategori, false, 'auto'), boundaryGap: false },
    yAxis: sumbuNilai(g, s, { format: (v) => format(v, d) }),
    series: [
      {
        type: 'line',
        smooth: 0.35,
        symbol: 'circle',
        symbolSize: 6 * s,
        showSymbol: false,
        data: nilai,
        lineStyle: { width: g.tebalGaris * s, color: g.aksen, shadowColor: `${g.aksen}88`, shadowBlur: 14 * s, shadowOffsetY: 4 * s },
        itemStyle: { color: g.aksen, borderColor: g.latar, borderWidth: 2 * s },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${g.aksen}75` },
              { offset: 0.55, color: `${g.aksen}26` },
              { offset: 1, color: `${g.aksen}03` },
            ],
          },
        },
        ...(akhir >= 0
          ? {
              markPoint: {
                symbol: 'circle',
                symbolSize: 9 * s,
                itemStyle: { color: '#fff', borderColor: g.aksen, borderWidth: 3 * s, shadowBlur: 10 * s, shadowColor: `${g.aksen}ee` },
                label: {
                  show: true,
                  position: 'left',
                  distance: 8 * s,
                  color: g.teks,
                  fontSize: 9 * s,
                  fontWeight: 'bold',
                  backgroundColor: g.kartu,
                  borderRadius: 4 * s,
                  padding: [2 * s, 5 * s],
                  formatter: () => labelNilai(Number(nilai[akhir] ?? 0), d),
                },
                data: [{ coord: [akhir, nilai[akhir]] }],
              },
            }
          : {}),
      },
    ],
  };
};

/** Garis tunggal tanpa area. */
export const garisTren: Pembangun = (d, g, s) => ({
  grid: { left: 6 * s, right: 16 * s, top: 16 * s, bottom: 4, containLabel: true },
  tooltip: { ...tooltip(g, s), trigger: 'axis' },
  xAxis: { ...sumbuKategori(g, s, d.kategori), boundaryGap: false },
  yAxis: sumbuNilai(g, s, { format: (v) => format(v, d) }),
  series: [
    {
      type: 'line',
      name: d.seri[0]?.nama ?? 'Nilai',
      smooth: 0.3,
      symbol: 'circle',
      symbolSize: 6 * s,
      data: deret(d),
      lineStyle: { width: g.tebalGaris * s, color: g.aksen },
      itemStyle: { color: g.aksen, borderColor: g.latar, borderWidth: 1.5 * s },
    },
  ],
});

/** Batang pada sumbu kiri, garis pada sumbu kanan. */
export const comboBatangGaris: Pembangun = (d, g, s) => {
  const batang = deret(d);
  const garis = d.seri[1]?.data ?? [];
  return {
    grid: { left: 6 * s, right: 16 * s, top: 20 * s, bottom: 4, containLabel: true },
    tooltip: { ...tooltip(g, s), trigger: 'axis' },
    legend: { show: false },
    xAxis: sumbuKategori(g, s, d.kategori),
    yAxis: [
      sumbuNilai(g, s, { format: (v) => format(v, d) }),
      sumbuNilai(g, s, { satuanSumbu: '%' }),
    ],
    series: [
      {
        type: 'bar',
        name: d.seri[0]?.nama ?? 'Nilai',
        barWidth: '52%',
        data: batang,
        itemStyle: { color: gradien(g, g.aksen), borderRadius: [g.sudut * s, g.sudut * s, 0, 0] },
      },
      {
        type: 'line',
        name: d.seri[1]?.nama ?? 'Garis',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 7 * s,
        data: garis,
        lineStyle: { width: g.tebalGaris * s, color: g.palet[2] },
        itemStyle: { color: g.palet[2] },
      },
    ],
  };
};

/** Gelembung: kategori + dua angka, ukuran dari seri kedua. */
export const scatterGelembung: Pembangun = (d, g, s) => ({
  grid: { left: 8 * s, right: 16 * s, top: 16 * s, bottom: 4, containLabel: true },
  tooltip: { ...tooltip(g, s), trigger: 'item' },
  xAxis: sumbuNilai(g, s, { format: (v) => format(v, d) }),
  yAxis: sumbuNilai(g, s, { format: (v) => format(v, d) }),
  series: [
    {
      type: 'scatter',
      symbolSize: (v: any) => Math.max(14, Math.sqrt(Math.abs(Number(v?.[2] ?? 100))) * 2.4),
      data: (d.kategori ?? []).map((_, i) => ({
        value: [deret(d)[i] ?? 0, d.seri[1]?.data?.[i] ?? 0, Math.abs(Number(deret(d)[i] ?? 0))],
        itemStyle: { color: `${g.palet[i % g.palet.length]}cc`, borderColor: g.palet[i % g.palet.length] },
      })),
      label: {
        show: true,
        position: 'top',
        color: g.teks2,
        fontSize: 9 * s,
        formatter: (p: any) => d.kategori[p.dataIndex] ?? '',
      },
    },
  ],
});

/** Titik tunggal per kategori, label di kanan. */
export const titikBersumbu: Pembangun = (d, g, s) => ({
  grid: { left: 6 * s, right: 20 * s, top: 10 * s, bottom: 4, containLabel: true },
  tooltip: { ...tooltip(g, s), trigger: 'item' },
  xAxis: sumbuNilai(g, s, { format: (v) => format(v, d) }),
  yAxis: { ...sumbuKategori(g, s, d.kategori), splitLine: { show: false } },
  series: [
    {
      type: 'scatter',
      symbolSize: 11 * s,
      data: deret(d).map((v, i) => ({
        value: v,
        itemStyle: { color: i === 0 ? g.aksen : `${g.aksen}bb` },
      })),
      label: { show: true, position: 'right', color: g.teks3, fontSize: 9 * s, formatter: (p: any) => format(Number(p.value ?? 0), d) },
    },
  ],
});

/** Cincin. Gaya menentukan tebal, sudut, dan bayangan. */
export const donat: Pembangun = (d, g, s) => {
  const nilai = deret(d);
  const total = typeof d.total === 'number' ? d.total : angkaSah(d).reduce((a, b) => a + b, 0);
  return {
    tooltip: { ...tooltip(g, s), trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: g.donatTebal ? ['68%', '97%'] : ['54%', '80%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: {
          borderColor: g.kartu,
          borderWidth: (g.donatTebal ? 3 : 2) * s,
          borderRadius: g.donatTebal ? 6 * s : 0,
          shadowColor: g.donatTebal ? 'rgba(0,0,0,0.5)' : 'transparent',
          shadowBlur: g.donatTebal ? 8 * s : 0,
        },
        emphasis: g.donatTebal
          ? { scale: true, scaleSize: 6 * s, itemStyle: { shadowBlur: 18 * s, shadowColor: 'rgba(0,0,0,0.7)' } }
          : { scale: false },
        data: d.kategori.map((nama, i) => ({
          name: nama,
          value: nilai[i] ?? 0,
          itemStyle: { color: g.palet[i % g.palet.length] },
        })),
        ...(total
          ? {
              markPoint: { silent: true, symbol: 'circle', symbolSize: 0, label: { show: false }, data: [] },
            }
          : {}),
      },
    ],
  };
};

/** Gauge dengan penanda target. */
export const gaugeTarget: Pembangun = (d, g, s) => {
  const nilai = Number(deret(d)[0] ?? 0);
  const maks = typeof d.maks === 'number' ? d.maks : 100;
  return {
    tooltip: { show: false },
    series: [
      {
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: maks,
        radius: '96%',
        progress: { show: true, width: 10 * s, itemStyle: { color: g.aksen } },
        axisLine: { lineStyle: { width: 10 * s, color: [[1, g.garis]] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        anchor: { show: false },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '-4%'],
          fontSize: 24 * s,
          fontWeight: 800,
          color: g.teks,
          formatter: (v: number) => `${format(v, d)}${d.satuan ?? '%'}`,
        },
        // Gauge ECharts tidak mendukung markLine pada sumbu. Target ditulis di
        // judul bawah supaya tetap terbaca tanpa membuat seri gagal digambar.
        title: {
          offsetCenter: [0, typeof d.target === 'number' ? '34%' : '34%'],
          fontSize: 9.5 * s,
          color: g.teks3,
          fontWeight: 600,
          // eslint-disable-next-line no-template-curly-in-string
          formatter: typeof d.target === 'number' ? `${d.seri[0]?.nama ?? 'Nilai'} · target ${format(d.target, d)}${d.satuan ?? '%'}` : d.seri[0]?.nama ?? 'Nilai',
        },
        data: [{ value: nilai, name: d.seri[0]?.nama ?? d.kategori[0] ?? 'Nilai' }],
      },
    ],
  };
};

/* -------------------------------- BENTUK HTML -------------------------------- */

/**
 * Bentuk yang bukan kanvas ECharts. Yang dikembalikan bukan opsi grafik,
 * melainkan spesifikasi ringan yang dipakai renderer HTML di Fase 2.
 */
export interface SpesifikasiHtml {
  mesin: 'html';
  jenis: 'kpi-kartu' | 'kpi-strip' | 'kpi-lensa' | 'kpi-nadi' | 'progres-target' | 'tabel-ringkas' | 'narasi-insight' | 'peringkat' | 'strip-os';
  gaya: Pick<
    GayaVarian,
    'aksen' | 'aksen2' | 'kartu' | 'kartu2' | 'garis' | 'teks' | 'teks2' | 'teks3' | 'palet' | 'sudut' | 'hijau' | 'merah'
  >;
  jumlah?: number;
}

export const htmlBentuk = (jenis: SpesifikasiHtml['jenis']): Pembangun => (_d, g) => ({
  mesin: 'html',
  jenis,
  gaya: {
    aksen: g.aksen,
    aksen2: g.aksen2,
    kartu: g.kartu,
    kartu2: g.kartu2,
    garis: g.garis,
    teks: g.teks,
    teks2: g.teks2,
    teks3: g.teks3,
    palet: g.palet,
    sudut: g.sudut,
    hijau: g.hijau,
    merah: g.merah,
  },
});

export const kpiKartu = htmlBentuk('kpi-kartu');
export const kpiStrip = htmlBentuk('kpi-strip');
export const progresTarget = htmlBentuk('progres-target');
export const tabelRingkas = htmlBentuk('tabel-ringkas');
export const narasiInsight = htmlBentuk('narasi-insight');
export const peringkat = htmlBentuk('peringkat');
