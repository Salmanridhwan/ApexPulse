/**
 * PRATINJAU 31 TIPE CHART DEFAULT.
 *
 * Halaman Template Chart, tab Default Chart, menampilkan semua tipe di sini.
 * Aturan desainnya satu: sederhana, terbaca, dan legenda selalu menyebut nama
 * komponen. Tidak ada label angka menumpuk, tidak ada sumbu ganda yang tidak
 * perlu, dan tidak ada warna acak — paletnya tetap satu keluarga.
 *
 * File ini SENGAJA terpisah dari `pembangunOpsi.ts` karena `pembangunOpsi`
 * melayani 20 identitas katalog (dipakai template bergaya), sedangkan file ini
 * melayani 31 tipe lama yang tampil di tab Default Chart.
 */
import type { GayaVarian } from './gayaVarian';
import { kontainerPratinjau, latarTooltip, temaPratinjau, type Mode } from './temaPratinjau';

export type OpsiPratinjau =
  | { mesin: 'echarts'; opsi: any; tinggi?: number }
  | { mesin: 'html'; jenis: 'kpi' | 'bullet' | 'tabel' | 'narasi' | 'peta' | 'gantt' | 'peringkat'; tinggi?: number };

/**
 * Seluruh penyusun dibungkus satu fungsi supaya warna bisa berbeda per mode.
 * Hasilnya di-cache per mode, jadi tidak dibangun ulang setiap render.
 */
function keluarga(mode: Mode) {
  const g: GayaVarian = temaPratinjau(mode);
  const tooltipBg = latarTooltip(mode);
  const kotak = kontainerPratinjau(mode);

// ── Bahan contoh (angka netral, bukan angka dokumen) ─────────────────────────
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const AKTUAL = [42, 48, 45, 52, 58, 55, 62, 68, 64, 72, 76, 80];
const TARGET = [30, 34, 33, 38, 41, 44, 43, 47, 50, 52, 55, 58];
const TAHUN_LALU = [24, 27, 26, 31, 33, 36, 35, 39, 42, 45, 47, 50];
const WILAYAH = ['Jakarta Pusat', 'Jakarta Utara', 'Jakarta Barat', 'Jakarta Selatan', 'Jakarta Timur'];
const WILAYAH_NILAI = [186, 173, 208, 196, 188];

/** Dasar semua opsi: sumbu tipis, legenda di bawah, tipografi 9,5 px. */
const dasar = (tambahan: any = {}) => ({
  animationDuration: 320,
  textStyle: { fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: 9.5, color: g.teks2 },
  grid: { left: 4, right: 10, top: 12, bottom: 30, containLabel: true },
  legend: {
    bottom: 0,
    left: 'center',
    icon: 'circle',
    itemWidth: 7,
    itemHeight: 7,
    itemGap: 10,
    textStyle: { fontSize: 9.5, color: g.teks3 },
    inactiveColor: '#cbd5e1',
  },
  tooltip: {
    backgroundColor: tooltipBg,
    borderWidth: 0,
    padding: [5, 8],
    textStyle: { color: '#fff', fontSize: 10 },
    ...tambahan.tooltip,
  },
  ...tambahan,
});

const sumbuKategori = (data: string[], putar = false) => ({
  type: 'category',
  data,
  axisLine: { show: true, lineStyle: { color: g.garis } },
  axisTick: { show: false },
  axisLabel: { fontSize: 9, color: g.teks3, interval: 0, rotate: putar ? 28 : 0, hideOverlap: true },
});

const sumbuNilai = (satuan?: string) => ({
  type: 'value',
  name: satuan,
  nameGap: 8,
  nameTextStyle: { fontSize: 8.5, color: g.teks3, align: 'left' },
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { fontSize: 9, color: g.teks3 },
  splitLine: { lineStyle: { color: g.garis, type: 'dashed' } },
});

const batang = (nama: string, data: number[], warna: string, tumpuk?: string) => ({
  name: nama,
  type: 'bar',
  data,
  stack: tumpuk,
  barMaxWidth: 18,
  barGap: '12%',
  itemStyle: { color: warna, borderRadius: [g.sudut, g.sudut, 0, 0] },
  emphasis: { focus: 'series' },
});

const garis = (nama: string, data: (number | null)[], warna: string, putus = false) => ({
  name: nama,
  type: 'line',
  data,
  smooth: 0.35,
  symbol: 'circle',
  symbolSize: 4,
  showSymbol: false,
  lineStyle: { width: g.tebalGaris, color: warna, type: putus ? 'dashed' : 'solid' },
  itemStyle: { color: warna },
  emphasis: { focus: 'series' },
});

/** Deret bergerigi untuk tipe analitik (proyeksi, anomali, klaster). */
const deretBergelombang = [41, 52, 44, 58, 49, 63, 55, 70, 60, 74, 66, 84];
const deretAnomali = [50, 52, 51, 53, 50, 54, 52, 51, 53, 120, 52, 50];

// ── Penyusun per tipe ────────────────────────────────────────────────────────

const opsiBar = (mendatar = false) =>
  mendatar
    ? dasar({
        legend: { show: true, bottom: 0, icon: 'circle', itemWidth: 7, itemHeight: 7, itemGap: 10, textStyle: { fontSize: 9.5, color: g.teks3 } },
        grid: { left: 4, right: 16, top: 8, bottom: 22, containLabel: true },
        xAxis: sumbuNilai('unit'),
        yAxis: { ...sumbuKategori(['Komponen 1', 'Komponen 2', 'Komponen 3']), inverse: true },
        series: [
          {
            name: 'Capaian',
            type: 'bar',
            data: [80, 64, 47],
            barMaxWidth: 16,
            itemStyle: { color: g.palet[0], borderRadius: [0, g.sudut, g.sudut, 0] },
            label: { show: true, position: 'right', fontSize: 9, color: g.teks2, formatter: '{c}' },
          },
        ],
      })
    : dasar({
        xAxis: sumbuKategori(BULAN),
        yAxis: sumbuNilai('Rp miliar'),
        series: [batang('Aktual', AKTUAL, g.palet[0]), batang('Target', TARGET, g.palet[2]), batang('Tahun lalu', TAHUN_LALU, g.palet[3])],
      });

const opsiGaris = (area = false) =>
  dasar({
    xAxis: sumbuKategori(BULAN),
    yAxis: sumbuNilai('Rp miliar'),
    series: [
      {
        ...garis('Aktual', AKTUAL, g.palet[0]),
        areaStyle: area ? { color: 'rgba(37,99,235,0.14)' } : undefined,
      },
      garis('Target', TARGET, g.palet[2]),
      garis('Tahun lalu', TAHUN_LALU, g.palet[3]),
    ],
  });

const opsiAreaTumpuk = () =>
  dasar({
    xAxis: sumbuKategori(BULAN),
    yAxis: sumbuNilai('Rp miliar'),
    series: [
      { ...garis('Aktual', AKTUAL, g.palet[0]), stack: 'total', areaStyle: { color: 'rgba(37,99,235,0.22)' } },
      { ...garis('Target', TARGET, g.palet[2]), stack: 'total', areaStyle: { color: 'rgba(14,165,233,0.2)' } },
      { ...garis('Tahun lalu', TAHUN_LALU, g.palet[3]), stack: 'total', areaStyle: { color: 'rgba(139,92,246,0.18)' } },
    ],
  });

const opsiCombo = () =>
  dasar({
    xAxis: sumbuKategori(BULAN),
    yAxis: [sumbuNilai('Rp miliar'), { ...sumbuNilai('%'), splitLine: { show: false }, position: 'right' }],
    series: [
      batang('Volume', AKTUAL, g.palet[0]),
      { ...garis('Capaian (%)', TARGET, g.palet[3]), yAxisIndex: 1 },
    ],
  });

const opsiDonat = () =>
  dasar({
    tooltip: { trigger: 'item', backgroundColor: tooltipBg, borderWidth: 0, textStyle: { color: '#fff', fontSize: 10 } },
    legend: { orient: 'vertical', right: 2, top: 'middle', icon: 'circle', itemWidth: 7, itemHeight: 7, itemGap: 9, textStyle: { fontSize: 9.5, color: g.teks3 } },
    series: [
      {
        name: 'Komponen',
        type: 'pie',
        radius: ['48%', '72%'],
        center: ['36%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: g.kartu, borderWidth: 2 },
        label: { show: true, position: 'center', formatter: '100%', fontSize: 13, fontWeight: 700, color: g.teks },
        labelLine: { show: false },
        emphasis: { label: { show: true, fontSize: 13 } },
        data: [
          { name: 'Komponen 1', value: 45 },
          { name: 'Komponen 2', value: 25 },
          { name: 'Komponen 3', value: 18 },
          { name: 'Komponen 4', value: 12 },
        ],
      },
    ],
  });

const opsiPie = () =>
  dasar({
    tooltip: { trigger: 'item', backgroundColor: tooltipBg, borderWidth: 0, textStyle: { color: '#fff', fontSize: 10 } },
    legend: { orient: 'vertical', right: 2, top: 'middle', icon: 'circle', itemWidth: 7, itemHeight: 7, itemGap: 9, textStyle: { fontSize: 9.5, color: g.teks3 } },
    series: [
      {
        name: 'Komponen',
        type: 'pie',
        radius: '62%',
        center: ['36%', '50%'],
        itemStyle: { borderColor: g.kartu, borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: false } },
        data: [
          { name: 'Komponen 1', value: 45 },
          { name: 'Komponen 2', value: 25 },
          { name: 'Komponen 3', value: 18 },
          { name: 'Komponen 4', value: 12 },
        ],
      },
    ],
  });

const opsiTreemap = () =>
  dasar({
    tooltip: { backgroundColor: tooltipBg, borderWidth: 0, textStyle: { color: '#fff', fontSize: 10 } },
    series: [
      {
        name: 'Komponen',
        type: 'treemap',
        top: 6,
        bottom: 22,
        left: 2,
        right: 2,
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        itemStyle: { borderColor: g.kartu, borderWidth: 2, borderRadius: 4, gapWidth: 2 },
        label: { fontSize: 9.5, color: '#fff', formatter: '{b}' },
        data: [
          { name: 'Komponen 1', value: 45 },
          { name: 'Komponen 2', value: 25 },
          { name: 'Komponen 3', value: 18 },
          { name: 'Komponen 4', value: 12 },
        ],
      },
    ],
  });

const opsiFunnel = () =>
  dasar({
    tooltip: { trigger: 'item', backgroundColor: tooltipBg, borderWidth: 0, textStyle: { color: '#fff', fontSize: 10 } },
    legend: { bottom: 0, left: 'center', icon: 'circle', itemWidth: 7, itemHeight: 7, itemGap: 12, textStyle: { fontSize: 9.5, color: g.teks3 } },
    series: [
      {
        name: 'Tahap',
        type: 'funnel',
        top: 8,
        bottom: 24,
        left: 8,
        right: 8,
        minSize: '32%',
        gap: 2,
        sort: 'descending',
        itemStyle: { borderColor: g.kartu, borderWidth: 1.5 },
        label: { show: true, position: 'inside', fontSize: 9.5, color: '#fff', formatter: '{b}' },
        data: [
          { name: 'Tahap 1', value: 100 },
          { name: 'Tahap 2', value: 72 },
          { name: 'Tahap 3', value: 45 },
          { name: 'Tahap 4', value: 26 },
        ],
      },
    ],
  });

const opsiSankey = () =>
  dasar({
    grid: undefined,
    // Sankey menamai simpulnya langsung di gambar, jadi legenda hanya akan
    // mengulang nama yang sama.
    legend: { show: false },
    tooltip: { backgroundColor: tooltipBg, borderWidth: 0, textStyle: { color: '#fff', fontSize: 10 } },
    series: [
      {
        type: 'sankey',
        top: 6,
        bottom: 8,
        left: 4,
        right: 4,
        nodeGap: 8,
        nodeWidth: 9,
        emphasis: { focus: 'adjacency' },
        label: { fontSize: 8.5, color: g.teks2 },
        lineStyle: { color: 'gradient', opacity: 0.28, curveness: 0.5 },
        itemStyle: { borderWidth: 0 },
        data: [{ name: 'Sumber A' }, { name: 'Sumber B' }, { name: 'Tahap 1' }, { name: 'Tahap 2' }, { name: 'Susut' }],
        links: [
          { source: 'Sumber A', target: 'Tahap 1', value: 60 },
          { source: 'Sumber B', target: 'Tahap 1', value: 40 },
          { source: 'Tahap 1', target: 'Tahap 2', value: 70 },
          { source: 'Tahap 1', target: 'Susut', value: 30 },
        ],
      },
    ],
  });

const opsiScatter = (bubble = false) =>
  dasar({
    xAxis: { ...sumbuNilai('indeks'), splitLine: { lineStyle: { color: g.garis, type: 'dashed' } } },
    yAxis: sumbuNilai('indeks'),
    series: [
      {
        name: bubble ? 'Unit' : 'Titik',
        type: bubble ? 'scatter' : 'scatter',
        symbolSize: bubble ? (v: number[]) => 8 + (v[2] ?? 0) / 4 : 7,
        itemStyle: { color: 'rgba(37,99,235,0.55)', borderColor: g.palet[0], borderWidth: 1 },
        emphasis: { focus: 'self' },
        data: Array.from({ length: 22 }, (_, i) => [10 + ((i * 13) % 80), 15 + ((i * 29) % 70), bubble ? 6 + ((i * 11) % 30) : 0]),
      },
    ],
  });

const opsiHistogram = () =>
  dasar({
    xAxis: sumbuKategori(['0-20', '20-40', '40-60', '60-80', '80-100']),
    yAxis: sumbuNilai('frekuensi'),
    series: [
      {
        name: 'Frekuensi',
        type: 'bar',
        barWidth: '62%',
        data: [6, 14, 22, 15, 7],
        itemStyle: { color: g.palet[0], borderRadius: [g.sudut, g.sudut, 0, 0] },
        label: { show: true, position: 'top', fontSize: 9, color: g.teks2 },
      },
    ],
  });

const opsiBoxplot = () =>
  dasar({
    xAxis: sumbuKategori(['Kelompok A', 'Kelompok B', 'Kelompok C']),
    yAxis: sumbuNilai('unit'),
    series: [
      {
        name: 'Sebaran',
        type: 'boxplot',
        boxWidth: [14, 34],
        itemStyle: { color: 'rgba(37,99,235,0.12)', borderColor: g.palet[0], borderWidth: 1.5 },
        data: [
          [12, 30, 44, 58, 72],
          [18, 34, 50, 63, 80],
          [10, 26, 40, 55, 68],
        ],
      },
    ],
  });

const opsiHeatmap = () =>
  dasar({
    grid: { left: 4, right: 12, top: 10, bottom: 26, containLabel: true },
    tooltip: { position: 'top', backgroundColor: tooltipBg, borderWidth: 0, textStyle: { color: '#fff', fontSize: 10 } },
    xAxis: { ...sumbuKategori(['TW1', 'TW2', 'TW3', 'TW4']), splitArea: { show: false } },
    yAxis: { ...sumbuKategori(['Unit A', 'Unit B', 'Unit C', 'Unit D']), splitArea: { show: false } },
    visualMap: {
      min: 40,
      max: 80,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 8,
      itemHeight: 60,
      textStyle: { fontSize: 8.5, color: g.teks3 },
      inRange: { color: [g.kartu, g.aksen2, g.aksen] },
    },
    series: [
      {
        name: 'Indeks',
        type: 'heatmap',
        label: { show: true, fontSize: 8.5, color: g.teks },
        itemStyle: { borderColor: g.kartu, borderWidth: 2, borderRadius: 3 },
        data: [
          [0, 0, 62], [1, 0, 70], [2, 0, 68], [3, 0, 78],
          [0, 1, 50], [1, 1, 58], [2, 1, 61], [3, 1, 66],
          [0, 2, 44], [1, 2, 47], [2, 2, 55], [3, 2, 60],
          [0, 3, 70], [1, 3, 72], [2, 3, 69], [3, 3, 80],
        ],
      },
    ],
  });

const opsiRadar = () =>
  dasar({
    grid: undefined,
    legend: { bottom: 0, left: 'center', icon: 'circle', itemWidth: 7, itemHeight: 7, itemGap: 12, textStyle: { fontSize: 9.5, color: g.teks3 }, data: ['Aktual', 'Target'] },
    tooltip: { backgroundColor: tooltipBg, borderWidth: 0, textStyle: { color: '#fff', fontSize: 10 } },
    radar: {
      center: ['50%', '43%'],
      radius: '62%',
      splitNumber: 3,
      axisName: { fontSize: 8.5, color: g.teks3 },
      splitLine: { lineStyle: { color: g.garis } },
      splitArea: { areaStyle: { color: [g.kartu, g.kartu2] } },
      axisLine: { lineStyle: { color: g.garis } },
      indicator: [
        { name: 'Keuangan', max: 100 },
        { name: 'Operasional', max: 100 },
        { name: 'Pelayanan', max: 100 },
        { name: 'SDM', max: 100 },
        { name: 'Kepatuhan', max: 100 },
      ],
    },
    series: [
      {
        type: 'radar',
        symbolSize: 4,
        data: [
          { name: 'Aktual', value: [82, 74, 68, 61, 88], lineStyle: { color: g.palet[0] }, itemStyle: { color: g.palet[0] }, areaStyle: { color: 'rgba(37,99,235,0.18)' } },
          { name: 'Target', value: [90, 80, 75, 70, 90], lineStyle: { color: g.palet[2] }, itemStyle: { color: g.palet[2] }, areaStyle: { color: 'rgba(14,165,233,0.1)' } },
        ],
      },
    ],
  });

const opsiWaterfall = () =>
  dasar({
    xAxis: sumbuKategori(['Awal', 'Naik A', 'Naik B', 'Turun C', 'Akhir']),
    yAxis: sumbuNilai('Rp miliar'),
    legend: { bottom: 0, left: 'center', icon: 'circle', itemWidth: 7, itemHeight: 7, itemGap: 10, textStyle: { fontSize: 9.5, color: g.teks3 }, data: ['Perubahan'] },
    series: [
      {
        name: 'Dasar',
        type: 'bar',
        stack: 'total',
        silent: true,
        data: [0, 40, 52, 60, 0],
        itemStyle: { color: 'transparent' },
      },
      {
        name: 'Perubahan',
        type: 'bar',
        stack: 'total',
        barMaxWidth: 20,
        data: [
          { value: 40, itemStyle: { color: g.palet[0], borderRadius: [g.sudut, g.sudut, 0, 0] } },
          { value: 12, itemStyle: { color: g.palet[4], borderRadius: [g.sudut, g.sudut, 0, 0] } },
          { value: 8, itemStyle: { color: g.palet[4], borderRadius: [g.sudut, g.sudut, 0, 0] } },
          { value: -14, itemStyle: { color: g.merah, borderRadius: [g.sudut, g.sudut, 0, 0] } },
          { value: 46, itemStyle: { color: g.palet[0], borderRadius: [g.sudut, g.sudut, 0, 0] } },
        ],
        label: { show: true, position: 'top', fontSize: 9, color: g.teks2, formatter: (p: any) => `${p.value > 0 ? '+' : ''}${p.value}` },
      },
    ],
  });

const opsiGauge = () =>
  dasar({
    grid: undefined,
    legend: { show: false },
    series: [
      {
        name: 'Capaian',
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        radius: '92%',
        center: ['50%', '58%'],
        progress: { show: true, width: 10, roundCap: true, itemStyle: { color: g.palet[0] } },
        axisLine: { lineStyle: { width: 10, color: [[1, '#eef2f7']] } },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: { show: true, offsetCenter: [0, '32%'], fontSize: 9, color: g.teks3, fontWeight: 600 },
        detail: { valueAnimation: true, offsetCenter: [0, '-2%'], fontSize: 22, fontWeight: 800, color: g.teks, formatter: '{value}%' },
        data: [{ value: 78, name: 'Capaian · target 90%' }],
      },
    ],
  });

const opsiForecast = () => {
  const n = deretBergelombang.length;
  const proyeksi = [...Array(n - 1).fill(null), deretBergelombang[n - 1], 88, 92, 96];
  const bawah = [...Array(n - 1).fill(null), deretBergelombang[n - 1], 82, 84, 86];
  return dasar({
    xAxis: sumbuKategori(BULAN),
    yAxis: sumbuNilai('Rp miliar'),
    legend: { bottom: 0, left: 'center', icon: 'circle', itemWidth: 7, itemHeight: 7, itemGap: 10, textStyle: { fontSize: 9.5, color: g.teks3 }, data: ['Aktual', 'Proyeksi', 'Pita keyakinan'] },
    series: [
      garis('Aktual', deretBergelombang, g.palet[0]),
      { ...garis('Proyeksi', proyeksi, g.palet[1], true), symbolSize: 5, showSymbol: true },
      {
        name: 'Batas bawah',
        type: 'line',
        data: bawah,
        lineStyle: { opacity: 0 },
        symbol: 'none',
        stack: 'pita',
        silent: true,
        tooltip: { show: false },
      },
      {
        name: 'Pita keyakinan',
        type: 'line',
        data: bawah.map((v, i) => (v === null ? null : (proyeksi[i] as number) - v)),
        lineStyle: { opacity: 0 },
        symbol: 'none',
        stack: 'pita',
        areaStyle: { color: 'rgba(37,99,235,0.12)' },
        silent: true,
      },
    ],
  });
};

const opsiAnomali = () =>
  dasar({
    xAxis: sumbuKategori(BULAN),
    yAxis: sumbuNilai('Rp miliar'),
    legend: { bottom: 0, left: 'center', icon: 'circle', itemWidth: 7, itemHeight: 7, itemGap: 10, textStyle: { fontSize: 9.5, color: g.teks3 }, data: ['Nilai', 'Batas atas'] },
    series: [
      {
        ...garis('Nilai', deretAnomali, g.palet[0]),
        markPoint: {
          symbol: 'circle',
          symbolSize: 9,
          itemStyle: { color: g.merah },
          label: { show: true, position: 'top', fontSize: 8.5, color: g.merah, formatter: 'Anomali' },
          data: [{ coord: [9, 120] }],
        },
      },
      { ...garis('Batas atas', Array(12).fill(75), g.teks3, true), symbol: 'none', tooltip: { show: false } },
    ],
  });

const opsiCluster = () =>
  dasar({
    xAxis: sumbuNilai('indeks'),
    yAxis: sumbuNilai('indeks'),
    series: [
      {
        name: 'Klaster 1',
        type: 'scatter',
        symbolSize: 8,
        itemStyle: { color: 'rgba(37,99,235,0.6)' },
        data: [[14, 16], [18, 20], [22, 18], [26, 24], [16, 26]],
      },
      {
        name: 'Klaster 2',
        type: 'scatter',
        symbolSize: 8,
        itemStyle: { color: 'rgba(14,165,233,0.6)' },
        data: [[52, 55], [58, 50], [60, 58], [55, 62], [63, 54]],
      },
      {
        name: 'Klaster 3',
        type: 'scatter',
        symbolSize: 8,
        itemStyle: { color: 'rgba(139,92,246,0.6)' },
        data: [[84, 86], [88, 80], [80, 90], [92, 84], [86, 92]],
      },
    ],
  });

const opsiDekomposisi = () =>
  dasar({
    xAxis: sumbuKategori(['Total', 'Volume', 'Harga', 'NRW', 'Efisiensi', 'Akhir']),
    yAxis: sumbuNilai('Rp miliar'),
    legend: { bottom: 0, left: 'center', icon: 'circle', itemWidth: 7, itemHeight: 7, itemGap: 10, textStyle: { fontSize: 9.5, color: g.teks3 }, data: ['Andil'] },
    series: [
      {
        name: 'Dasar',
        type: 'bar',
        stack: 'd',
        silent: true,
        data: [0, 100, 118, 112, 105, 0],
        itemStyle: { color: 'transparent' },
      },
      {
        name: 'Andil',
        type: 'bar',
        stack: 'd',
        barMaxWidth: 22,
        data: [
          { value: 100, itemStyle: { color: g.palet[0], borderRadius: [g.sudut, g.sudut, 0, 0] } },
          { value: 18, itemStyle: { color: g.palet[4], borderRadius: [g.sudut, g.sudut, 0, 0] } },
          { value: -6, itemStyle: { color: g.merah, borderRadius: [g.sudut, g.sudut, 0, 0] } },
          { value: -7, itemStyle: { color: g.merah, borderRadius: [g.sudut, g.sudut, 0, 0] } },
          { value: 98, itemStyle: { color: g.palet[0], borderRadius: [g.sudut, g.sudut, 0, 0] } },
        ],
        label: { show: true, position: 'top', fontSize: 9, color: g.teks2, formatter: (p: any) => `${p.value > 0 ? '+' : ''}${p.value}` },
      },
    ],
  });

const opsiSkenario = () =>
  dasar({
    xAxis: sumbuKategori(['TW1', 'TW2', 'TW3', 'TW4']),
    yAxis: sumbuNilai('Rp miliar'),
    series: [
      garis('Optimis', [120, 132, 146, 160], g.palet[4]),
      garis('Dasar', [110, 116, 124, 132], g.palet[0]),
      garis('Pesimis', [96, 98, 102, 106], g.merah),
    ],
  });

const opsiSensitivitas = () =>
  dasar({
    xAxis: sumbuKategori(['-10%', '-5%', '0%', '+5%', '+10%']),
    yAxis: sumbuNilai('Rp miliar'),
    series: [
      garis('Harga', [92, 101, 110, 119, 128], g.palet[0]),
      garis('Volume', [84, 97, 110, 123, 136], g.palet[2]),
      garis('Biaya', [124, 117, 110, 103, 96], g.palet[3]),
    ],
  });

const opsiTrenRegresi = () =>
  dasar({
    xAxis: sumbuKategori(BULAN),
    yAxis: sumbuNilai('Rp miliar'),
    series: [
      garis('Nilai', deretBergelombang, g.palet[0]),
      { ...garis('Garis tren', [41, 45, 49, 53, 57, 61, 65, 69, 73, 77, 81, 85], g.palet[3], true), symbol: 'none', tooltip: { show: false } },
    ],
  });

  /** Satu peta tipe -> opsi. Tipe HTML ditangani komponen (kartu, tabel, narasi). */
  const pilih = (type: string): OpsiPratinjau => {
  switch (type) {
    case 'kpi':
      return { mesin: 'html', jenis: 'kpi', tinggi: 150 };
    case 'bullet-target':
      return { mesin: 'html', jenis: 'bullet', tinggi: 150 };
    case 'table':
      return { mesin: 'html', jenis: 'tabel', tinggi: 170 };
    case 'narasi':
      return { mesin: 'html', jenis: 'narasi', tinggi: 150 };
    case 'gauge':
      return { mesin: 'echarts', opsi: opsiGauge() };
    case 'line':
      return { mesin: 'echarts', opsi: opsiGaris(false) };
    case 'area':
      return { mesin: 'echarts', opsi: opsiAreaTumpuk() };
    case 'bar':
      return { mesin: 'echarts', opsi: opsiBar(false) };
    case 'hbar':
      return { mesin: 'echarts', opsi: opsiBar(true) };
    case 'combo':
      return { mesin: 'echarts', opsi: opsiCombo() };
    case 'pie':
      return { mesin: 'echarts', opsi: opsiPie() };
    case 'donut':
      return { mesin: 'echarts', opsi: opsiDonat() };
    case 'treemap':
      return { mesin: 'echarts', opsi: opsiTreemap() };
    case 'funnel':
      return { mesin: 'echarts', opsi: opsiFunnel() };
    case 'sankey':
      return { mesin: 'echarts', opsi: opsiSankey() };
    case 'scatter':
      return { mesin: 'echarts', opsi: opsiScatter(false) };
    case 'bubble':
      return { mesin: 'echarts', opsi: opsiScatter(true) };
    case 'histogram':
      return { mesin: 'echarts', opsi: opsiHistogram() };
    case 'boxplot':
      return { mesin: 'echarts', opsi: opsiBoxplot() };
    case 'heatmap':
      return { mesin: 'echarts', opsi: opsiHeatmap() };
    case 'radar':
      return { mesin: 'echarts', opsi: opsiRadar() };
    case 'map':
      return { mesin: 'html', jenis: 'peta', tinggi: 170 };
    case 'gantt':
      return { mesin: 'html', jenis: 'gantt', tinggi: 170 };
    case 'trend-line':
      return { mesin: 'echarts', opsi: opsiTrenRegresi() };
    case 'forecast':
      return { mesin: 'echarts', opsi: opsiForecast() };
    case 'anomaly':
      return { mesin: 'echarts', opsi: opsiAnomali() };
    case 'cluster':
      return { mesin: 'echarts', opsi: opsiCluster() };
    case 'dekomposisi':
      return { mesin: 'echarts', opsi: opsiDekomposisi() };
    case 'skenario':
      return { mesin: 'echarts', opsi: opsiSkenario() };
    case 'sensitivitas':
      return { mesin: 'echarts', opsi: opsiSensitivitas() };
    case 'waterfall':
      return { mesin: 'echarts', opsi: opsiWaterfall() };
    default:
      return { mesin: 'echarts', opsi: opsiGaris(false) };
  }
  };

  return pilih;
}

const cache = new Map<Mode, (type: string) => OpsiPratinjau>();

/** Pratinjau satu tipe untuk mode terang atau gelap. */
export function opsiPratinjau(type: string, mode: Mode = 'light'): OpsiPratinjau {
  let penyusun = cache.get(mode);
  if (!penyusun) {
    penyusun = keluarga(mode);
    cache.set(mode, penyusun);
  }
  return penyusun(type);
}
