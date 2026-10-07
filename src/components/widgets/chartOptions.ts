/**
 * Builder opsi ECharts untuk SEMUA tipe visualisasi ApexPulse.
 *
 * Dipisah dari ChartEcharts.tsx supaya komponen hanya mengurus shell (toggle
 * "lihat data", cross-filter, resize) sementara bentuk tiap chart hidup di sini.
 * Satu tempat untuk menambah/menyesuaikan tipe — komponen tidak perlu tahu
 * detail sumbu, tooltip, atau bentuk seri tiap jenis.
 *
 * Semua fungsi murni: menerima data + tema, mengembalikan EChartsOption.
 */
import type { EChartsOption } from 'echarts';

/** Palet chart per mode tema (ECharts tidak bisa membaca CSS variable). */
export function chartTheme(mode: 'light' | 'dark') {
  return mode === 'dark'
    ? { series: ['#38c6e2', '#9a9be8', '#3fd29a', '#ffb547', '#f2503a', '#7fdcf0'], accent: '#38c6e2', accentSoft: '#7fdcf0', track: '#2a2f37', tick: '#6b7280', muted: '#8b93a1', strong: '#f2f4f7', text2: '#b6bdc8', grid: '#2a2f37', tipBg: '#1f2329', tooltipInk: '#f2f4f7', surface: '#171a1f', heatLow: '#1f2329' }
    : { series: ['#1fa6cc', '#7f80d8', '#0f7a53', '#8f5e08', '#c62f22', '#0f6b85'], accent: '#1fa6cc', accentSoft: '#0f6b85', track: '#e8ecf1', tick: '#6b7280', muted: '#6b7280', strong: '#1a1d1f', text2: '#4b5563', grid: '#e8ecf1', tipBg: '#1a1d1f', tooltipInk: '#f2f4f7', surface: '#ffffff', heatLow: '#e6f6fb' };
}

export type ChartTheme = ReturnType<typeof chartTheme>;

/**
 * Peta warna seri lama (biru/sky/emerald default) -> palet Clean Grid.
 * Diterapkan saat render agar data tersimpan (MySQL/db.json) maupun respons
 * RAG lama otomatis konsisten, tanpa perlu migrasi data manual.
 */
const WARNA_LEGACY: Record<string, string> = {
  '#0284c7': '#1fa6cc', '#0ea5e9': '#1fa6cc', '#3b82f6': '#1fa6cc',
  '#1d4ed8': '#7f80d8', '#10b981': '#0f7a53', '#059669': '#0f7a53',
  '#f59e0b': '#8f5e08', '#ea580c': '#8f5e08', '#8b5cf6': '#7f80d8',
  '#7c3aed': '#7f80d8', '#e11d48': '#c62f22', '#94a3b8': '#7f80d8',
};
export const keWarnaTema = (c?: string): string | undefined =>
  c ? (WARNA_LEGACY[c.toLowerCase()] ?? c) : c;

/** Data satu seri yang sudah dinormalisasi satuan. */
export interface SeriView {
  name: string;
  data: number[];
  color?: string;
  kind?: 'bar' | 'line';
  yAxisIndex?: 0 | 1;
}

/** Semua data yang mungkin dibutuhkan tiap tipe chart. */
export interface ChartData {
  xAxis: string[];
  series: SeriView[];
  unit?: string;
  stacked?: boolean;
  showLegend?: boolean;
  min?: number;
  max?: number;
  points?: Array<{ x: number; y: number; size?: number; label?: string; color?: string }>;
  links?: Array<{ source: string; target: string; value: number }>;
  waterfall?: Array<{ name: string; value: number }>;
  radar?: { indicators: Array<{ name: string; max: number }>; series: Array<{ name: string; values: number[]; color?: string }> };
  boxRaw?: number[][];
  treemap?: { name: string; value?: number; children?: Array<{ name: string; value: number }> };
  geo?: { mapName?: string; regions: Array<{ name: string; value: number }>; unit?: string };
  gantt?: { tasks: Array<{ name: string; start: string; end: string; progress?: number; color?: string }> };
  heatmap?: { rows: string[]; columns: string[]; data: number[][]; unit?: string };
  /** Nama map ECharts yang sudah di-register (untuk type 'map'). */
  mapRegistered?: boolean;
}

const satuan = (u?: string) => (u ? ' ' + u : '');

const fmtAngka = (v: number) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(v);

// ── Histogram: hitung bin dari data mentah ───────────────────────────────────
function hitungHistogram(mentah: number[], jumlahBin = 8): { labels: string[]; counts: number[] } {
  if (!mentah.length) return { labels: [], counts: [] };
  const min = Math.min(...mentah);
  const max = Math.max(...mentah);
  if (min === max) return { labels: [fmtAngka(min)], counts: [mentah.length] };
  const lebar = (max - min) / jumlahBin;
  const counts = new Array(jumlahBin).fill(0);
  for (const v of mentah) {
    let idx = Math.floor((v - min) / lebar);
    if (idx >= jumlahBin) idx = jumlahBin - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  }
  const labels = counts.map((_, i) => {
    const lo = min + i * lebar;
    const hi = lo + lebar;
    return `${fmtAngka(lo)}–${fmtAngka(hi)}`;
  });
  return { labels, counts };
}

// ── Boxplot: hitung statistik lima angka dari data mentah ────────────────────
function statistikBox(mentah: number[]): number[] {
  const s = [...mentah].sort((a, b) => a - b);
  const n = s.length;
  if (!n) return [0, 0, 0, 0, 0];
  const q = (p: number) => {
    const pos = (n - 1) * p;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
  };
  const q1 = q(0.25);
  const q2 = q(0.5);
  const q3 = q(0.75);
  const iqr = q3 - q1;
  const batasBawah = q1 - 1.5 * iqr;
  const batasAtas = q3 + 1.5 * iqr;
  const dalam = s.filter((v) => v >= batasBawah && v <= batasAtas);
  return [dalam[0] ?? s[0], q1, q2, q3, dalam[dalam.length - 1] ?? s[n - 1]];
}

// ── Waterfall: hitung nilai kumulatif untuk tumpuan ──────────────────────────
/**
 * Siapkan array tumpuan untuk waterfall.
 *
 * Konvensi: tiap item adalah DELTA (positif/negatif). Item yang merupakan
 * TOTAL kumulatif (mis. baris "Akhir"/"Total") digambar penuh dari 0 — bukan
 * ditambahkan lagi sebagai delta. Deteksi otomatis: item terakhir dianggap
 * total bila nilainya sama dengan hasil akumulasi item sebelumnya; bisa juga
 * ditandai eksplisit lewat `isTotal: true`.
 */
function siapkanWaterfall(items: Array<{ name: string; value: number; isTotal?: boolean }>) {
  const bantu: number[] = [];
  const naik: number[] = [];
  const turun: number[] = [];
  const totalFlag: boolean[] = [];
  let total = 0;

  // Hitung total kumulatif dari item yang BUKAN total eksplisit.
  const jumlahDelta = items.reduce(
    (acc, it) => (it.isTotal ? acc : acc + it.value),
    0
  );
  const toleransi = Math.abs(jumlahDelta) * 0.01 + 1e-6;

  items.forEach((it, idx) => {
    const terakhir = idx === items.length - 1;
    // Item terakhir yang nilainya == akumulasi sebelumnya -> bar total penuh.
    const sebagaiTotal = it.isTotal === true || (terakhir && Math.abs(it.value - total) <= toleransi);

    if (sebagaiTotal) {
      bantu.push(0);
      naik.push(Math.max(0, it.value));
      turun.push(Math.max(0, -it.value));
      totalFlag.push(true);
      total = it.value;
    } else if (it.value >= 0) {
      bantu.push(total);
      naik.push(it.value);
      turun.push(0);
      totalFlag.push(false);
      total += it.value;
    } else {
      bantu.push(total + it.value); // bar turun digambar dari nilai setelah turun
      naik.push(0);
      turun.push(-it.value);
      totalFlag.push(false);
      total += it.value;
    }
  });

  return { bantu, naik, turun, totalFlag, total };
}

// ── Gantt: parse tanggal ke timestamp ────────────────────────────────────────
function tgl(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Date.now() : t;
}

/**
 * Bangun EChartsOption untuk satu tipe chart.
 * `data` sudah berisi semua bentuk data yang relevan; fungsi memilih yang perlu.
 */
export function buildChartOption(
  type: string,
  data: ChartData,
  T: ChartTheme
): EChartsOption {
  const { xAxis: xView, series: seriesView, unit, stacked, showLegend = true } = data;
  const displayUnit = unit || '';
  const isCartesian = ['line', 'area', 'bar', 'hbar', 'combo', 'scatter', 'bubble', 'histogram', 'boxplot', 'waterfall'].includes(type);

  // Tooltip dasar yang dipakai ulang.
  const tooltipDasar = {
    backgroundColor: T.tipBg,
    borderColor: T.tipBg,
    borderRadius: 8,
    textStyle: { color: T.tooltipInk, fontSize: 11, fontFamily: 'Plus Jakarta Sans' },
  };

  // ── Gauge ──────────────────────────────────────────────────────────────────
  if (type === 'gauge') {
    const nilai = seriesView[0]?.data?.[0] ?? 0;
    return {
      series: [
        {
          type: 'gauge',
          startAngle: 210,
          endAngle: -30,
          min: data.min ?? 0,
          max: data.max ?? 100,
          radius: '92%',
          progress: { show: true, width: 14, itemStyle: { color: T.accent } },
          axisLine: { lineStyle: { width: 14, color: [[1, T.track]] } },
          axisTick: { show: false },
          splitLine: { length: 6, distance: 4, lineStyle: { color: T.tick, width: 1 } },
          axisLabel: { color: T.muted, fontSize: 10, distance: 18 },
          pointer: { show: false },
          anchor: { show: false },
          title: { show: false },
          detail: {
            valueAnimation: true,
            fontSize: 30,
            fontWeight: 'bold' as any,
            color: T.strong,
            offsetCenter: [0, '10%'],
            formatter: (v: number) => `${v}${satuan(displayUnit)}`,
          },
          data: [{ value: nilai, name: seriesView[0]?.name || '' }],
        },
      ],
    };
  }

  // ── Heatmap ────────────────────────────────────────────────────────────────
  if (type === 'heatmap') {
    const cols = data.heatmap?.columns ?? xView;
    const rows = data.heatmap?.rows ?? seriesView.map((s) => s.name);
    const matriks = data.heatmap?.data ?? seriesView.map((s) => cols.map((_, c) => s.data[c] ?? 0));
    const semua = matriks.flat();
    const vMin = semua.length ? Math.min(...semua) : 0;
    const vMax = semua.length ? Math.max(...semua) : 100;
    return {
      tooltip: { ...tooltipDasar, position: 'top', formatter: (p: any) => `${rows[p.value[1]]} · ${cols[p.value[0]]}: <b>${p.value[2]}</b>${satuan(displayUnit)}` },
      grid: { left: 10, right: 10, top: 24, bottom: 30, containLabel: true },
      xAxis: { type: 'category', data: cols, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: T.muted, fontSize: 10 } },
      yAxis: { type: 'category', data: rows, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: T.muted, fontSize: 10 } },
      visualMap: {
        min: vMin, max: vMax, calculable: false, orient: 'horizontal', left: 'center', bottom: -6,
        itemHeight: 60, itemWidth: 10, textStyle: { fontSize: 9, color: T.muted },
        inRange: { color: [T.heatLow, T.accent] },
      },
      series: [
        {
          type: 'heatmap',
          data: matriks.flatMap((baris, rIdx) => baris.map((v, cIdx) => [cIdx, rIdx, v])),
          label: { show: true, fontSize: 10, color: T.strong, formatter: (p: any) => `${p.value[2]}` },
          itemStyle: { borderColor: T.surface, borderWidth: 2, borderRadius: 4 },
          emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(29,78,216,0.35)' } },
        },
      ],
    };
  }

  // ── Pie & Donut ────────────────────────────────────────────────────────────
  if (type === 'pie' || type === 'donut') {
    const donutView = xView.map((label, idx) => ({ name: label, value: seriesView[0]?.data[idx] || 0 }));
    return {
      tooltip: {
        trigger: 'item', ...tooltipDasar,
        formatter: (p: any) => `${p.name}: <b>${fmtAngka(p.value)}${satuan(displayUnit)}</b> (${p.percent}%)`,
      },
      legend: showLegend ? { bottom: 0, icon: 'circle', textStyle: { fontSize: 11, color: T.muted } } : undefined,
      series: [
        {
          name: displayUnit || 'Nilai',
          type: 'pie',
          radius: type === 'donut' ? ['45%', '72%'] : ['0%', '72%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 6, borderColor: T.surface, borderWidth: 2 },
          label: type === 'pie'
            ? { show: true, fontSize: 10, color: T.text2, formatter: '{b}\n{d}%' }
            : { show: false, position: 'center' },
          emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
          data: donutView,
        },
      ],
      color: T.series,
    };
  }

  // ── Treemap ────────────────────────────────────────────────────────────────
  if (type === 'treemap') {
    const anak = data.treemap?.children
      ?? xView.map((label, idx) => ({ name: label, value: seriesView[0]?.data[idx] || 0 }));
    // Warna eksplisit per anak supaya kotak selalu terisi (jangan bergantung
    // pada colorSaturation level, yang bisa membuat kotak tak terlihat).
    const anakBerwarna = anak.map((a, i) => ({
      ...a,
      itemStyle: { color: T.series[i % T.series.length] },
    }));
    return {
      tooltip: { ...tooltipDasar, formatter: (p: any) => `${p.name}: <b>${fmtAngka(p.value)}${satuan(displayUnit)}</b>` },
      series: [
        {
          type: 'treemap',
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          width: '100%',
          height: '100%',
          top: 2, left: 2, right: 2, bottom: 2,
          label: { show: true, fontSize: 12, color: '#ffffff', fontWeight: 'bold' },
          upperLabel: { show: false },
          itemStyle: { borderColor: T.surface, borderWidth: 2, gapWidth: 2 },
          data: anakBerwarna,
        },
      ],
    };
  }

  // ── Funnel ─────────────────────────────────────────────────────────────────
  if (type === 'funnel') {
    const funnelData = xView
      .map((label, idx) => ({ name: label, value: seriesView[0]?.data[idx] || 0 }))
      .sort((a, b) => b.value - a.value);
    return {
      tooltip: { trigger: 'item', ...tooltipDasar, formatter: (p: any) => `${p.name}: <b>${fmtAngka(p.value)}${satuan(displayUnit)}</b>` },
      legend: showLegend ? { bottom: 0, icon: 'circle', textStyle: { fontSize: 11, color: T.muted } } : undefined,
      series: [
        {
          type: 'funnel',
          left: '8%', right: '8%', top: 10, bottom: showLegend ? 30 : 10,
          minSize: '20%', maxSize: '100%', sort: 'descending', gap: 2,
          label: { show: true, fontSize: 11, color: T.text2, formatter: '{b}' },
          itemStyle: { borderColor: T.surface, borderWidth: 2, borderRadius: 4 },
          emphasis: { label: { fontSize: 12, fontWeight: 'bold' } },
          data: funnelData,
        },
      ],
      color: T.series,
    };
  }

  // ── Waterfall ──────────────────────────────────────────────────────────────
  if (type === 'waterfall') {
    const items = data.waterfall
      ?? xView.map((label, idx) => ({ name: label, value: seriesView[0]?.data[idx] ?? 0 }));
    const { bantu, naik, turun, totalFlag } = siapkanWaterfall(items);
    return {
      tooltip: {
        trigger: 'axis', ...tooltipDasar,
        axisPointer: { type: 'shadow' },
        formatter: (ps: any) => {
          const i = ps[0]?.dataIndex ?? 0;
          const it = items[i];
          const isTotal = totalFlag[i];
          const tanda = isTotal ? 'Total' : it.value >= 0 ? 'Naik' : 'Turun';
          const prefix = !isTotal && it.value >= 0 ? '+' : '';
          return `${it.name}: <b>${prefix}${fmtAngka(it.value)}${satuan(displayUnit)}</b> (${tanda})`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 10, containLabel: true },
      xAxis: { type: 'category', data: items.map((i) => i.name), axisLine: { lineStyle: { color: T.track } }, axisTick: { show: false }, axisLabel: { color: T.muted, fontSize: 10 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: T.grid, type: 'dashed' } }, axisLabel: { color: T.muted, fontSize: 10, fontFamily: 'JetBrains Mono' } },
      series: [
        { name: 'bantu', type: 'bar', stack: 'total', silent: true, itemStyle: { color: 'transparent' }, data: bantu },
        { name: 'Naik', type: 'bar', stack: 'total', itemStyle: { color: T.series[2], borderRadius: [3, 3, 0, 0] }, data: naik },
        { name: 'Turun', type: 'bar', stack: 'total', itemStyle: { color: T.series[4], borderRadius: [0, 0, 3, 3] }, data: turun },
      ],
    };
  }

  // ── Sankey ─────────────────────────────────────────────────────────────────
  if (type === 'sankey') {
    const links = data.links ?? [];
    const nodeSet = new Set<string>();
    links.forEach((l) => { nodeSet.add(l.source); nodeSet.add(l.target); });
    const nodes = [...nodeSet].map((n) => ({ name: n }));
    return {
      tooltip: { trigger: 'item', ...tooltipDasar, formatter: (p: any) =>
        p.dataType === 'edge'
          ? `${p.data.source} → ${p.data.target}: <b>${fmtAngka(p.data.value)}${satuan(displayUnit)}</b>`
          : `${p.name}` },
      series: [
        {
          type: 'sankey',
          left: 8, right: 8, top: 10, bottom: 10,
          nodeWidth: 12, nodeGap: 10, draggable: false,
          emphasis: { focus: 'adjacency' },
          label: { color: T.text2, fontSize: 10 },
          lineStyle: { color: 'gradient', opacity: 0.35, curveness: 0.5 },
          itemStyle: { borderWidth: 0 },
          data: nodes,
          links,
        },
      ],
      color: T.series,
    };
  }

  // ── Radar ──────────────────────────────────────────────────────────────────
  if (type === 'radar') {
    const ind = data.radar?.indicators ?? xView.map((n) => ({ name: n, max: 100 }));
    const seri = data.radar?.series ?? seriesView.map((s) => ({ name: s.name, values: s.data, color: s.color }));
    return {
      tooltip: { ...tooltipDasar },
      legend: showLegend && seri.length > 1 ? { bottom: 0, icon: 'circle', textStyle: { fontSize: 11, color: T.muted } } : undefined,
      radar: {
        indicator: ind,
        radius: '65%',
        center: ['50%', showLegend && seri.length > 1 ? '46%' : '50%'],
        axisName: { color: T.text2, fontSize: 10 },
        splitLine: { lineStyle: { color: T.grid } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: T.track } },
      },
      series: [
        {
          type: 'radar',
          data: seri.map((s, i) => ({
            name: s.name,
            value: s.values,
            itemStyle: { color: keWarnaTema(s.color) || T.series[i % T.series.length] },
            areaStyle: { opacity: 0.18 },
            lineStyle: { width: 2 },
          })),
        },
      ],
    };
  }

  // ── Scatter & Bubble ───────────────────────────────────────────────────────
  if (type === 'scatter' || type === 'bubble') {
    const isBubble = type === 'bubble';
    const points = data.points
      ?? seriesView.flatMap((s, si) => s.data.map((y, i) => ({ x: i + 1, y, size: undefined as number | undefined, label: `${s.name} · ${xView[i] ?? i + 1}`, color: s.color || T.series[si % T.series.length] })));
    const ukuran = points.map((p) => p.size ?? 1);
    const maxUkuran = Math.max(1, ...ukuran);
    const seri = isBubble
      ? points.map((p, i) => ({ value: [p.x, p.y, p.size ?? 1], name: p.label || `${p.x}`, itemStyle: { color: keWarnaTema(p.color) || T.series[i % T.series.length] } }))
      : points.map((p, i) => ({ value: [p.x, p.y], name: p.label || `${p.x}`, itemStyle: { color: keWarnaTema(p.color) || T.series[i % T.series.length] } }));
    return {
      tooltip: {
        ...tooltipDasar,
        formatter: (p: any) => {
          const v = p.value;
          const extra = isBubble ? `<br/>Ukuran: <b>${fmtAngka(v[2])}</b>` : '';
          return `${p.data.name}<br/>X: <b>${fmtAngka(v[0])}</b> · Y: <b>${fmtAngka(v[1])}${satuan(displayUnit)}</b>${extra}`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 16, containLabel: true },
      xAxis: { type: 'value', name: '', splitLine: { lineStyle: { color: T.grid, type: 'dashed' } }, axisLabel: { color: T.muted, fontSize: 10 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: T.grid, type: 'dashed' } }, axisLabel: { color: T.muted, fontSize: 10, fontFamily: 'JetBrains Mono' } },
      series: [
        {
          type: 'scatter',
          data: seri,
          symbolSize: isBubble
            ? (val: any) => 12 + 40 * Math.sqrt((val[2] ?? 1) / maxUkuran)
            : 12,
          itemStyle: { opacity: 0.82, borderColor: T.surface, borderWidth: 1 },
          emphasis: { itemStyle: { opacity: 1 } },
        },
      ],
    };
  }

  // ── Histogram ──────────────────────────────────────────────────────────────
  if (type === 'histogram') {
    const mentah = data.boxRaw ? data.boxRaw.flat() : seriesView.flatMap((s) => s.data);
    const { labels, counts } = hitungHistogram(mentah);
    return {
      tooltip: {
        trigger: 'axis', ...tooltipDasar, axisPointer: { type: 'shadow' },
        formatter: (ps: any) => {
          const p = ps[0];
          return `Rentang ${p.name}${satuan(displayUnit)}<br/>Frekuensi: <b>${p.value}</b>`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 16, containLabel: true },
      xAxis: { type: 'category', data: labels, axisLine: { lineStyle: { color: T.track } }, axisTick: { show: false }, axisLabel: { color: T.muted, fontSize: 9, rotate: labels.length > 6 ? 30 : 0 } },
      yAxis: { type: 'value', name: 'Frekuensi', nameTextStyle: { color: T.muted, fontSize: 10 }, splitLine: { lineStyle: { color: T.grid, type: 'dashed' } }, axisLabel: { color: T.muted, fontSize: 10, fontFamily: 'JetBrains Mono' } },
      series: [
        { type: 'bar', data: counts, barMaxWidth: 26, itemStyle: { color: T.accent, borderRadius: [3, 3, 0, 0] } },
      ],
    };
  }

  // ── Boxplot ────────────────────────────────────────────────────────────────
  if (type === 'boxplot') {
    const kelompok = data.boxRaw ?? seriesView.map((s) => s.data);
    const namaKelompok = data.boxRaw ? xView.slice(0, kelompok.length) : seriesView.map((s) => s.name);
    const stat = kelompok.map((g) => statistikBox(g));
    return {
      tooltip: {
        trigger: 'item', ...tooltipDasar,
        formatter: (p: any) => {
          const v = p.value;
          const nm = namaKelompok[p.dataIndex] ?? '';
          return `${nm}<br/>Min: <b>${fmtAngka(v[1])}</b><br/>Q1: <b>${fmtAngka(v[2])}</b><br/>Median: <b>${fmtAngka(v[3])}</b><br/>Q3: <b>${fmtAngka(v[4])}</b><br/>Max: <b>${fmtAngka(v[5])}</b>`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 16, containLabel: true },
      xAxis: { type: 'category', data: namaKelompok, axisLine: { lineStyle: { color: T.track } }, axisTick: { show: false }, axisLabel: { color: T.muted, fontSize: 10 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: T.grid, type: 'dashed' } }, axisLabel: { color: T.muted, fontSize: 10, fontFamily: 'JetBrains Mono' } },
      series: [
        {
          type: 'boxplot',
          data: stat.map((s) => [s[1], s[0], s[2], s[3], s[4]]),
          itemStyle: { color: T.surface, borderColor: T.accent, borderWidth: 1.5 },
          emphasis: { itemStyle: { borderColor: T.accentSoft, borderWidth: 2 } },
        },
      ],
    };
  }

  // ── Map / Filled Map ───────────────────────────────────────────────────────
  if (type === 'map') {
    const regions = data.geo?.regions ?? xView.map((label, idx) => ({ name: label, value: seriesView[0]?.data[idx] || 0 }));
    const nilai = regions.map((r) => r.value);
    const vMin = nilai.length ? Math.min(...nilai) : 0;
    const vMax = nilai.length ? Math.max(...nilai) : 100;
    return {
      tooltip: { ...tooltipDasar, formatter: (p: any) => `${p.name}: <b>${fmtAngka(p.value ?? 0)}${satuan(displayUnit)}</b>` },
      visualMap: {
        min: vMin, max: vMax, calculable: false, orient: 'horizontal', left: 'center', bottom: 0,
        itemHeight: 60, itemWidth: 10, textStyle: { fontSize: 9, color: T.muted },
        inRange: { color: [T.heatLow, T.accent] },
      },
      series: [
        {
          type: 'map',
          map: data.geo?.mapName || 'indonesia',
          roam: true,
          zoom: 1.1,
          label: { show: false },
          emphasis: { label: { show: true, color: T.strong, fontSize: 10 }, itemStyle: { areaColor: T.accentSoft } },
          itemStyle: { borderColor: T.surface, borderWidth: 0.6, areaColor: T.heatLow },
          select: { itemStyle: { areaColor: T.accent } },
          data: regions,
        },
      ],
    };
  }

  // ── Gantt (custom series) ──────────────────────────────────────────────────
  if (type === 'gantt') {
    const tasks = data.gantt?.tasks ?? [];
    const kategori = tasks.map((t) => t.name);
    const semuaTanggal = tasks.flatMap((t) => [tgl(t.start), tgl(t.end)]);
    const minTgl = semuaTanggal.length ? Math.min(...semuaTanggal) : Date.now();
    const maxTgl = semuaTanggal.length ? Math.max(...semuaTanggal) : Date.now() + 86400000;
    const dataGantt = tasks.map((t, i) => ({ value: [i, tgl(t.start), tgl(t.end), t.progress ?? 0], itemStyle: { color: keWarnaTema(t.color) || T.series[i % T.series.length] } }));
    return {
      tooltip: {
        ...tooltipDasar,
        formatter: (p: any) => {
          const t = tasks[p.value[0]];
          if (!t) return '';
          const f = (ms: number) => new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
          return `${t.name}<br/>${f(p.value[1])} → ${f(p.value[2])}${t.progress != null ? `<br/>Progres: <b>${t.progress}%</b>` : ''}`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 16, containLabel: true },
      xAxis: { type: 'time', min: minTgl, max: maxTgl, axisLabel: { color: T.muted, fontSize: 10, formatter: (v: number) => new Date(v).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }) }, splitLine: { lineStyle: { color: T.grid, type: 'dashed' } } },
      yAxis: { type: 'category', data: kategori, inverse: true, axisLine: { lineStyle: { color: T.track } }, axisTick: { show: false }, axisLabel: { color: T.muted, fontSize: 10 } },
      series: [
        {
          type: 'custom',
          renderItem: (params: any, api: any) => {
            const i = api.value(0);
            const start = api.coord([api.value(1), i]);
            const end = api.coord([api.value(2), i]);
            const tinggi = (api.size?.([0, 1]) as number[])?.[1] ?? 16;
            const h = Math.max(8, Math.min(20, tinggi * 0.55));
            const rect = { x: start[0], y: start[1] - h / 2, width: Math.max(2, end[0] - start[0]), height: h };
            const progres = api.value(3);
            const children: any[] = [
              { type: 'rect', shape: { ...rect, r: 3 }, style: { fill: api.style().fill, opacity: 0.32 } },
            ];
            if (progres > 0) {
              children.push({ type: 'rect', shape: { ...rect, width: Math.max(2, (rect.width * progres) / 100), r: 3 }, style: { fill: api.style().fill } });
            }
            return { type: 'group', children };
          },
          encode: { x: [1, 2], y: 0 },
          data: dataGantt,
        },
      ],
    };
  }

  // ── Kartesius: line / area / bar / hbar / combo ────────────────────────────
  const isArea = type === 'area';
  const isHbar = type === 'hbar';
  const isCombo = type === 'combo';
  const paletSoft = T.series;

  const echartsSeries = seriesView.map((s, sIdx) => {
    const baseColor = keWarnaTema(s.color) || paletSoft[sIdx % paletSoft.length];
    // 'hbar' bukan tipe seri ECharts — ia bar biasa dengan sumbu ditukar.
    const tipeSeri: any = isCombo
      ? (s.kind || (sIdx === 0 ? 'bar' : 'line'))
      : isArea
        ? 'line'
        : isHbar
          ? 'bar'
          : type;
    return {
      name: s.name,
      type: tipeSeri,
      stack: stacked && !isCombo ? 'total' : undefined,
      yAxisIndex: isCombo ? (s.yAxisIndex ?? 0) : undefined,
      smooth: 0.35,
      showSymbol: !['bar', 'hbar'].includes(tipeSeri),
      symbolSize: 6,
      data: s.data,
      barMaxWidth: 18,
      itemStyle: {
        color: baseColor,
        borderRadius: tipeSeri === 'bar' ? (isHbar ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0,
      },
      lineStyle: { width: 2.5, color: baseColor },
      areaStyle: isArea
        ? {
          opacity: 0.85,
          color: {
            type: 'linear', x: 0, y: 0, x2: isHbar ? 1 : 0, y2: isHbar ? 0 : 1,
            colorStops: [
              { offset: 0, color: `${baseColor}66` },
              { offset: 0.6, color: `${baseColor}1a` },
              { offset: 1, color: `${baseColor}00` },
            ],
          } as any,
        }
        : undefined,
    };
  });

  const axisKategori = {
    type: 'category' as const,
    data: xView,
    axisLine: { lineStyle: { color: T.track } },
    axisTick: { show: false },
    axisLabel: { color: T.muted, fontSize: 11, fontFamily: 'Plus Jakarta Sans', rotate: !isHbar && xView.length > 8 ? 30 : 0 },
  };
  const axisNilai = {
    type: 'value' as const,
    splitLine: { lineStyle: { color: T.grid, type: 'dashed' as const } },
    axisLabel: {
      color: T.muted, fontSize: 11, fontFamily: 'JetBrains Mono',
      formatter: (v: number) => {
        if (/triliun/i.test(displayUnit) || v >= 1_000_000) return v >= 1_000 ? `${(v / 1_000).toFixed(1)}T` : `${v}M`;
        return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`;
      },
    },
  };

  const adaLegend = showLegend && seriesView.length > 1;

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: T.tick, type: 'dashed' } },
      ...tooltipDasar,
      valueFormatter: (val: any) => `${val}${satuan(displayUnit)}`.trim(),
    },
    legend: adaLegend
      ? { top: 0, left: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { fontSize: 11, color: T.text2, fontFamily: 'Plus Jakarta Sans' } }
      : undefined,
    grid: { left: '3%', right: isCombo ? '4%' : '4%', bottom: '3%', top: adaLegend ? '15%' : '10%', containLabel: true },
    xAxis: isHbar ? axisNilai : axisKategori,
    yAxis: isHbar
      ? { ...axisKategori, axisLabel: { ...axisKategori.axisLabel, rotate: 0 } }
      : isCombo
        ? [axisNilai, { ...axisNilai, splitLine: { show: false } }]
        : axisNilai,
    series: echartsSeries,
  };
}
