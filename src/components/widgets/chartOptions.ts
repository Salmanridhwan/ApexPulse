/**
 * Builder opsi ECharts untuk SEMUA tipe visualisasi Aiones Boards.
 *
 * Dipisah dari ChartEcharts.tsx supaya komponen hanya mengurus shell (toggle
 * "lihat data", cross-filter, resize) sementara bentuk tiap chart hidup di sini.
 * Satu tempat untuk menambah/menyesuaikan tipe — komponen tidak perlu tahu
 * detail sumbu, tooltip, atau bentuk seri tiap jenis.
 *
 * Semua fungsi murni: menerima data + tema, mengembalikan EChartsOption.
 */
import type { EChartsOption } from 'echarts';
import {
  regresiLinier,
  proyeksi,
  deteksiAnomali,
  klaster1D,
  dekomposisi,
  skenario,
  sensitivitas,
  teksPersamaan,
  angka,
} from '../../services/spec/analitik';
import { temaKartu, warnaKartuValid } from './widgetCardTheme';

/** Palet chart per mode tema (ECharts tidak bisa membaca CSS variable). */
export function chartTheme(mode: 'light' | 'dark', latarKartu?: string) {
  const dasar = mode === 'dark'
    ? { series: ['#38c6e2', '#9a9be8', '#3fd29a', '#ffb547', '#f2503a', '#7fdcf0'], accent: '#38c6e2', accentSoft: '#7fdcf0', track: '#2a2f37', tick: '#6b7280', muted: '#8b93a1', strong: '#f2f4f7', text2: '#b6bdc8', grid: '#2a2f37', tipBg: '#1f2329', tooltipInk: '#f2f4f7', surface: '#171a1f', heatLow: '#1f2329' }
    : { series: ['#1fa6cc', '#7f80d8', '#0f7a53', '#8f5e08', '#c62f22', '#0f6b85'], accent: '#1fa6cc', accentSoft: '#0f6b85', track: '#e8ecf1', tick: '#6b7280', muted: '#6b7280', strong: '#1a1d1f', text2: '#4b5563', grid: '#e8ecf1', tipBg: '#1a1d1f', tooltipInk: '#f2f4f7', surface: '#ffffff', heatLow: '#e6f6fb' };

  // Kartu berlatar pilihan pengguna: warna teks & garis chart diturunkan dari
  // latar itu, kalau tidak label sumbu/legenda jadi tak terbaca (mis. teks abu
  // tema terang di atas kartu gelap). Warna SERI sengaja tidak disentuh di sini
  // — itu urusan palet di `widgetStyle.ts`.
  if (!warnaKartuValid(latarKartu)) return dasar;
  const latar = (latarKartu as string).trim();
  const t = temaKartu(latar, mode);
  return {
    ...dasar,
    muted: t.vars['--chart-muted'],
    tick: t.vars['--chart-muted'],
    text2: t.vars['--color-ink-2'],
    strong: t.vars['--chart-ink'],
    grid: t.vars['--chart-grid'],
    track: t.vars['--chart-grid'],
    // Dipakai sebagai warna tepi potongan (mis. border putih antar irisan pai):
    // harus menyatu dengan latar kartu, bukan selalu putih.
    surface: latar,
    heatLow: t.gelap ? campurKeLatar(latar, dasar.accent, 0.12) : campurKeLatar(latar, '#ffffff', 0.55),
  };
}

/** Campur `dasar` ke arah `target` sebesar `t` (0..1) — dipakai untuk warna heatmap. */
function campurKeLatar(dasar: string, target: string, t: number): string {
  const rgb = (hex: string) => {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = rgb(dasar);
  const [r2, g2, b2] = rgb(target);
  const campur = (a: number, b: number) => Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
  return `#${campur(r1, r2)}${campur(g1, g2)}${campur(b1, b2)}`;
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

  /** Subjudul metode: setiap grafik analitik menyebut cara angkanya dihitung. */
  const judulMetode = (sub: string): Partial<EChartsOption> => ({
    title: {
      text: '',
      subtext: sub,
      left: 6,
      top: 0,
      itemGap: 2,
      textStyle: { fontSize: 9 },
      subtextStyle: { color: T.muted, fontSize: 9 },
    },
  });

  /** Kartu yang jujur menampilkan alasan saat datanya tidak cukup. */
  const pesanKosong = (teks: string): EChartsOption => ({
    title: {
      text: teks,
      left: 'center',
      top: 'middle',
      textStyle: { color: T.muted, fontSize: 11, fontWeight: 'normal' },
    },
  });

  // ── Analitik prediktif: garis tren + regresi ───────────────────────────────
  if (type === 'trend-line') {
    const deret = seriesView[0]?.data ?? [];
    const reg = regresiLinier(deret);
    if (!reg) return pesanKosong('Butuh minimal 3 titik data untuk menghitung garis tren.');
    const garis = xView.map((_, i) => Number(reg.nilai(i).toFixed(4)));
    return {
      ...judulMetode(`${teksPersamaan(reg)} · R² ${angka(reg.r2, 3)} (1 = cocok sempurna). ${reg.metode}`),
      tooltip: { trigger: 'axis', ...tooltipDasar },
      grid: { left: '3%', right: '4%', bottom: 30, top: 34, containLabel: true },
      xAxis: {
        type: 'category', data: xView,
        axisLine: { lineStyle: { color: T.track } }, axisTick: { show: false },
        axisLabel: { color: T.muted, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: T.grid, type: 'dashed' } },
        axisLabel: { color: T.muted, fontSize: 10, fontFamily: 'JetBrains Mono' },
      },
      series: [
        {
          name: seriesView[0]?.name || 'Nilai dokumen',
          type: 'line', data: deret, symbol: 'circle', symbolSize: 5,
          lineStyle: { width: 1.5, color: T.series[0], opacity: 0.75 },
          itemStyle: { color: T.series[0], opacity: 0.75 },
          z: 2,
        },
        {
          // Digambar paling atas & lebih tebal: kalau R² mendekati 1, garis regresi
          // hampir berimpit dengan data, jadi tanpa urutan ini ia tak terlihat.
          name: 'Garis tren (regresi)',
          type: 'line', data: garis, symbol: 'none',
          lineStyle: { width: 2.5, type: 'dashed', color: T.accent },
          itemStyle: { color: T.accent },
          z: 5,
        },
      ],
      legend: { bottom: 0, icon: 'circle', textStyle: { fontSize: 11, color: T.muted } },
    };
  }

  // ── Forecast + pita prediksi ───────────────────────────────────────────────
  if (type === 'forecast') {
    const deret = seriesView[0]?.data ?? [];
    if (deret.length < 4) return pesanKosong('Butuh minimal 4 titik data untuk membuat proyeksi.');
    const proy = proyeksi(deret, 3);
    if (!proy) return pesanKosong('Data dokumen belum cukup untuk proyeksi.');
    const n = deret.length;
    const labelProy = Array.from({ length: 3 }, (_, i) => `P+${i + 1}`);
    const xAll = [...xView, ...labelProy];
    // Pita digambar TANPA nilai kosong: sebelum titik proyeksi, batas bawah = nilai
    // terakhir dan lebarnya 0. Nilai kosong (null) membuat penumpukan pita gagal
    // dirender di ECharts, jadi bagian aktual diisi angka, bukan null.
    const isiPita = (isi: number[]) => [...Array(n - 1).fill(deret[n - 1]), deret[n - 1], ...isi.slice(n)];
    const aktual = [...deret, ...Array(3).fill(null)];
    const garisProy = [...Array(n - 1).fill(null), deret[n - 1], ...proy.nilai.slice(n)];
    const batasBawah = isiPita(proy.bawah);
    const batasAtas = isiPita(proy.atas);
    const selisih = batasAtas.map((a, i) => Number((a - batasBawah[i]).toFixed(4)));
    return {
      ...judulMetode(`${proy.metode}. Titik putus-putus = proyeksi, bukan angka dokumen.`),
      tooltip: { trigger: 'axis', ...tooltipDasar },
      grid: { left: '3%', right: '4%', bottom: 30, top: 34, containLabel: true },
      xAxis: {
        type: 'category', data: xAll,
        axisLine: { lineStyle: { color: T.track } }, axisTick: { show: false },
        axisLabel: { color: T.muted, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: T.grid, type: 'dashed' } },
        axisLabel: { color: T.muted, fontSize: 10, fontFamily: 'JetBrains Mono' },
      },
      series: [
        {
          name: seriesView[0]?.name || 'Nilai dokumen',
          type: 'line', data: aktual, symbol: 'circle', symbolSize: 5,
          lineStyle: { width: 2, color: T.series[0] }, itemStyle: { color: T.series[0] },
          z: 3,
        },
        // Pita prediksi = dua seri bertumpuk: batas bawah + selisihnya. Batas bawah
        // digambar sebagai garis tepi putus-putus supaya pitanya terbaca jelas
        // walau kartunya pendek (temuan pemeriksaan visual).
        {
          name: 'Batas bawah pita', type: 'line', stack: 'pita', data: batasBawah, symbol: 'none',
          lineStyle: { width: 1, type: 'dashed', color: T.accent, opacity: 0.8 },
          areaStyle: { opacity: 0 }, silent: true, tooltip: { show: false }, z: 2,
        },
        {
          name: 'Pita prediksi 95%', type: 'line', stack: 'pita', data: selisih, symbol: 'none',
          lineStyle: { width: 1, type: 'dashed', color: T.accent, opacity: 0.8 },
          areaStyle: { color: T.accentSoft, opacity: 0.5 },
          tooltip: { show: false }, z: 1,
        },
        {
          name: 'Proyeksi', type: 'line', data: garisProy, symbol: 'circle', symbolSize: 6,
          lineStyle: { width: 2.5, type: 'dashed', color: T.accent }, itemStyle: { color: T.accent },
          z: 5,
        },
      ],
      // "Batas bawah pita" hanya alat bantu gambar, tidak perlu masuk legenda.
      legend: {
        bottom: 0, icon: 'circle', textStyle: { fontSize: 10, color: T.muted },
        data: [seriesView[0]?.name || 'Nilai dokumen', 'Pita prediksi 95%', 'Proyeksi'],
      },
    };
  }

  // ── Deteksi anomali (z-score) ──────────────────────────────────────────────
  if (type === 'anomaly') {
    const deret = seriesView[0]?.data ?? [];
    const an = deteksiAnomali(deret);
    if (!an) return pesanKosong('Butuh minimal 5 titik data untuk menilai simpangan.');
    return {
      ...judulMetode(an.metode),
      tooltip: { trigger: 'axis', ...tooltipDasar },
      grid: { left: '3%', right: '6%', bottom: 22, top: 34, containLabel: true },
      xAxis: {
        type: 'category', data: xView,
        axisLine: { lineStyle: { color: T.track } }, axisTick: { show: false },
        axisLabel: { color: T.muted, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: T.grid, type: 'dashed' } },
        axisLabel: { color: T.muted, fontSize: 10, fontFamily: 'JetBrains Mono' },
      },
      series: [
        {
          name: seriesView[0]?.name || 'Nilai dokumen',
          type: 'line', data: deret, symbol: 'circle', symbolSize: 6,
          lineStyle: { width: 2, color: T.series[0] }, itemStyle: { color: T.series[0] },
          markLine: {
            silent: true, symbol: 'none',
            data: [{ yAxis: Number(an.rata.toFixed(4)) }],
            lineStyle: { type: 'dashed', color: T.muted },
            // Label ditaruh di dalam area gambar: kalau di ujung kanan, teksnya
            // terpotong tepi kanvas (temuan pemeriksaan visual).
            label: {
              position: 'insideEndTop', formatter: `rata-rata ${angka(an.rata, 1)}`,
              color: T.muted, fontSize: 9,
            },
          },
          markPoint: {
            symbolSize: 46,
            data: an.indeks.map((i) => ({
              name: xView[i],
              coord: [xView[i], deret[i]],
              value: `z=${angka(an.z[i], 1)}`,
              itemStyle: { color: T.series[4] || '#e11d48' },
              label: { fontSize: 9, color: '#fff' },
            })),
          },
        },
      ],
    };
  }

  // ── Clustering k-means ─────────────────────────────────────────────────────
  if (type === 'cluster') {
    const deret = seriesView[0]?.data ?? [];
    const kl = klaster1D(deret, 3);
    if (!kl) return pesanKosong('Butuh minimal 6 titik data (dengan ≥3 nilai berbeda) untuk mengelompokkan.');
    const seri = kl.centroid.map((c, ci) => ({
      name: `Kelompok ${ci + 1} (≈${angka(c, 1)})`,
      type: 'scatter' as const,
      symbolSize: 15,
      // Cincin putih supaya titik tidak menyatu dengan garis centroid yang berwarna sama.
      itemStyle: {
        color: T.series[ci % T.series.length],
        borderColor: '#fff',
        borderWidth: 2,
      },
      // Nilai ditaruh apa adanya dan diisi null di luar kelompoknya. Bentuk
      // pasangan [indeks, nilai] tidak tergambar di sumbu kategori ECharts.
      data: deret.map((v, i) => (kl.label[i] === ci ? v : null)),
      tooltip: { formatter: (p: any) => `${xView[p.dataIndex]}: ${angka(p.value ?? 0, 1)}` },
    }));
    return {
      ...judulMetode(kl.metode),
      tooltip: { trigger: 'axis', ...tooltipDasar },
      grid: { left: '3%', right: '4%', bottom: 30, top: 34, containLabel: true },
      xAxis: {
        type: 'category', data: xView, boundaryGap: true,
        axisLine: { lineStyle: { color: T.track } }, axisTick: { show: false },
        axisLabel: { color: T.muted, fontSize: 9, interval: Math.ceil(xView.length / 8) },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: T.grid, type: 'dashed' } },
        axisLabel: { color: T.muted, fontSize: 10, fontFamily: 'JetBrains Mono' },
      },
      series: [
        {
          ...seri[0],
          markLine: {
            silent: true, symbol: 'none',
            data: kl.centroid.map((c, i) => ({
              yAxis: Number(c.toFixed(4)),
              lineStyle: { type: 'dashed', color: T.series[i % T.series.length], width: 1, opacity: 0.6 },
              label: { formatter: `K${i + 1}`, color: T.muted, fontSize: 9 },
            })),
          },
        },
        ...seri.slice(1),
      ],
      legend: { bottom: 0, icon: 'circle', textStyle: { fontSize: 10, color: T.muted } },
    };
  }

  // ── Dekomposisi kontribusi (preskriptif) ───────────────────────────────────
  if (type === 'dekomposisi') {
    const deret = seriesView[0]?.data ?? [];
    const dk = dekomposisi(deret);
    if (!dk) return pesanKosong('Butuh minimal 3 titik data untuk mengurai kontribusi.');
    const label = xView.slice(1);
    const nilai = dk.kontribusi.slice(1).map((v) => Number(v.toFixed(1)));
    const terbesar = dk.bagian.reduce((a, b) => (b.porsi > a.porsi ? b : a), dk.bagian[0]);
    return {
      ...judulMetode(dk.metode),
      tooltip: {
        trigger: 'axis', ...tooltipDasar, axisPointer: { type: 'shadow' },
        formatter: (ps: any) => {
          const p = Array.isArray(ps) ? ps[0] : ps;
          const i = (p?.dataIndex ?? 0) + 1;
          const dari = deret[i - 1];
          const ke = deret[i];
          const arah = ke >= dari ? 'naik' : 'turun';
          return `${label[p?.dataIndex ?? 0]}<br/>${angka(dari, 1)} → ${angka(ke, 1)} (${arah})<br/>Andil: <b>${nilai[p?.dataIndex ?? 0]}%</b> dari total gerakan`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: 26, top: 34, containLabel: true },
      xAxis: {
        type: 'category', data: label,
        axisLine: { lineStyle: { color: T.track } }, axisTick: { show: false },
        axisLabel: { color: T.muted, fontSize: 9, interval: Math.ceil(label.length / 7) },
      },
      yAxis: {
        type: 'value', name: 'andil (%)', nameTextStyle: { color: T.muted, fontSize: 9 },
        splitLine: { lineStyle: { color: T.grid, type: 'dashed' } },
        axisLabel: { color: T.muted, fontSize: 10, fontFamily: 'JetBrains Mono' },
      },
      series: [
        {
          name: 'Andil perubahan', type: 'bar', barMaxWidth: 26,
          data: nilai.map((v, i) => ({
            value: v,
            itemStyle: { color: deret[i + 1] >= deret[i] ? T.series[2] : (T.series[4] || '#e11d48') },
          })),
          label: { show: true, position: 'top', fontSize: 9, color: T.muted, formatter: '{c}%' },
        },
      ],
      // Ditulis apa adanya supaya pembaca tahu kategori penyumbang terbesar.
      graphic: [
        {
          type: 'text', left: 6, bottom: 0,
          style: {
            text: `Total ${angka(dk.total, 1)} · penyumbang terbesar: ${xView[terbesar.indeks]} (${angka(terbesar.porsi, 1)}% dari total)`,
            fill: T.muted, fontSize: 9, fontFamily: 'Plus Jakarta Sans',
          },
        },
      ],
    };
  }

  // ── Analisis skenario (preskriptif, SIMULASI) ──────────────────────────────
  if (type === 'skenario') {
    const deret = seriesView[0]?.data ?? [];
    const sk = skenario(deret);
    if (!sk) return pesanKosong('Butuh minimal 2 titik data (dan nilai ≠ 0) untuk menyusun skenario.');
    return {
      ...judulMetode(sk.metode),
      tooltip: {
        trigger: 'axis', ...tooltipDasar, axisPointer: { type: 'shadow' },
        formatter: (ps: any) => {
          const p = Array.isArray(ps) ? ps[0] : ps;
          const item = sk.daftar[p?.dataIndex ?? 0];
          return `${item?.nama}<br/>Nilai: <b>${angka(item?.nilai ?? 0, 1)}${satuan(displayUnit)}</b><br/>faktor ${angka((item?.faktor ?? 1) * 100, 1)}% dari nilai terakhir dokumen`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 34, containLabel: true },
      xAxis: {
        type: 'category', data: sk.daftar.map((s) => s.nama),
        axisLine: { lineStyle: { color: T.track } }, axisTick: { show: false },
        axisLabel: { color: T.muted, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: T.grid, type: 'dashed' } },
        axisLabel: { color: T.muted, fontSize: 10, fontFamily: 'JetBrains Mono' },
      },
      series: [
        {
          name: 'Simulasi', type: 'bar', barMaxWidth: 54,
          data: sk.daftar.map((s, i) => ({
            value: Number(s.nilai.toFixed(2)),
            itemStyle: { color: i === 0 ? (T.series[4] || '#e11d48') : i === 1 ? T.series[0] : T.series[2] },
          })),
          label: {
            show: true, position: 'top', fontSize: 9, color: T.muted,
            formatter: (p: any) => `${angka(p.value, 1)}`,
          },
          markLine: {
            silent: true, symbol: 'none',
            data: [{ yAxis: Number(sk.dasar.toFixed(2)) }],
            lineStyle: { type: 'dashed', color: T.muted },
            label: { formatter: `posisi terakhir: ${angka(sk.dasar, 1)}`, color: T.muted, fontSize: 9 },
          },
        },
      ],
    };
  }

  // ── Sensitivitas / what-if statis (preskriptif) ────────────────────────────
  if (type === 'sensitivitas') {
    const deret = seriesView[0]?.data ?? [];
    const dasar = deret[deret.length - 1];
    const sn = sensitivitas(dasar, 10);
    if (!sn) return pesanKosong('Nilai dokumen nol/kosong, sensitivitas tidak bisa dihitung.');
    return {
      ...judulMetode(sn.metode),
      tooltip: {
        trigger: 'axis', ...tooltipDasar,
        formatter: (ps: any) => {
          const p = Array.isArray(ps) ? ps[0] : ps;
          return `Perubahan ${sn.persen[p?.dataIndex ?? 0]}%<br/>Nilai: <b>${angka(p?.value ?? 0, 1)}${satuan(displayUnit)}</b>`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 34, containLabel: true },
      xAxis: {
        type: 'category', data: sn.persen.map((p) => `${p > 0 ? '+' : ''}${p}%`),
        axisLine: { lineStyle: { color: T.track } }, axisTick: { show: false },
        axisLabel: { color: T.muted, fontSize: 9 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: T.grid, type: 'dashed' } },
        axisLabel: { color: T.muted, fontSize: 10, fontFamily: 'JetBrains Mono' },
      },
      series: [
        {
          name: 'Hasil simulasi', type: 'line', data: sn.nilai.map((v) => Number(v.toFixed(2))),
          symbol: 'circle', symbolSize: 5, smooth: false,
          lineStyle: { width: 2, color: T.accent }, itemStyle: { color: T.accent },
          markLine: {
            silent: true, symbol: 'none',
            data: [{ yAxis: Number(dasar.toFixed(2)) }],
            lineStyle: { type: 'dashed', color: T.muted },
            label: { formatter: `nilai dokumen: ${angka(dasar, 1)}`, color: T.muted, fontSize: 9 },
          },
        },
      ],
    };
  }

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

    /**
     * Intensitas warna dihitung PER SEL untuk menentukan warna angkanya; warna latar sel
     * sendiri tetap dari `visualMap` yang disembunyikan (aturan ECharts).
     */
    const keRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const warnaSel = (v: number): [number, number, number] => {
      const t = vMax === vMin ? 0.5 : (v - vMin) / (vMax - vMin);
      const [r1, g1, b1] = keRgb(T.heatLow);
      const [r2, g2, b2] = keRgb(T.accent);
      const f = (x: number, y: number) => Math.round(x + (y - x) * t);
      return [f(r1, r2), f(g1, g2), f(b1, b2)];
    };
    /**
     * Warna angka ditentukan warna SEL-nya, bukan tema halaman: sel terang → angka gelap,
     * sel gelap → angka terang. Dihitung dengan luminansi relatif WCAG (bukan rata-rata
     * kanal) supaya cyna pekat tetap dapat angka gelap dan kontrasnya tetap tinggi.
     */
    const INK_GELAP = '#1a1d1f'; // = ink-1 tema terang
    const INK_TERANG = '#f2f4f7'; // = token tooltip (berlaku di kedua tema)
    const linear = (n: number) => {
      const s = n / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const luminansi = (c: [number, number, number]) => 0.2126 * linear(c[0]) + 0.7152 * linear(c[1]) + 0.0722 * linear(c[2]);
    const warnaLabel = (c: [number, number, number]) => (luminansi(c) > 0.18 ? INK_GELAP : INK_TERANG);

    return {
      tooltip: { ...tooltipDasar, position: 'top', formatter: (p: any) => `${rows[p.value[1]]} · ${cols[p.value[0]]}: <b>${p.value[2]}</b>${satuan(displayUnit)}` },
      grid: { left: 10, right: 12, top: 14, bottom: 26, containLabel: true },
      xAxis: { type: 'category', data: cols, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: T.muted, fontSize: 10 } },
      yAxis: { type: 'category', data: rows, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: T.muted, fontSize: 10 } },
      visualMap: {
        // ECharts MENOLAK heatmap tanpa visualMap ("Heatmap must use with visualMap"),
        // jadi skala warnanya tetap ada tetapi widgetnya TIDAK DIGAMBAR: `show: false`
        // menghapus bar skalanya yang dulu melintang menutupi grafik. Angka tiap sel
        // tetap tercetak, jadi intensitas warna + nilai tetap terbaca.
        show: false,
        min: vMin,
        max: vMax,
        inRange: { color: [T.heatLow, T.accent] },
      },
      series: [
        {
          type: 'heatmap',
          data: matriks.flatMap((baris, rIdx) =>
            baris.map((v, cIdx) => ({
              value: [cIdx, rIdx, v],
              label: { color: warnaLabel(warnaSel(v)) },
            }))
          ),
          label: { show: true, fontSize: 10 },
          itemStyle: { borderColor: T.surface, borderWidth: 2 },
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
          // Kalau ada legenda, diagramnya digeser ke atas + dikecilkan supaya label
          // legenda (bisa dua baris) tidak tertimpa cincin di kartu pendek.
          center: showLegend ? ['50%', '35%'] : ['50%', '50%'],
          radius: type === 'donut'
            ? (showLegend ? ['42%', '56%'] : ['45%', '72%'])
            : (showLegend ? ['0%', '56%'] : ['0%', '72%']),
          // Semua label TETAP ditampilkan — hanya digeser/diaturnya supaya tidak
          // bertumpuk. `avoidLabelOverlap` menggeser potongan kecil menjauh dan
          // memanjangkan garis penunjuknya, jadi keterangan tetap utuh dan terbaca.
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: T.surface, borderWidth: 2 },
          labelLine: type === 'pie'
            ? { show: true, length: 14, length2: 14 }
            : { show: false },
          label: type === 'pie'
            // `distance` kecil menjaga label tetap rapat ke cincin sehingga baris
            // bawahnya tidak masuk ke baris legenda di kartu yang pendek.
            ? { show: true, fontSize: 10, color: T.text2, distance: 8, formatter: '{b}\n{d}%' }
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
