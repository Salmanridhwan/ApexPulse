import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ECharts, EChartsOption } from 'echarts';
import { Table2, BarChart3 } from 'lucide-react';
import { useChartSelection } from './ChartSelection';
import { RingGauge3D } from './RingGauge3D';
import { useThemeMode } from '../../theme';
import { buildChartOption, chartTheme, type ChartData } from './chartOptions';
import { WidgetType } from '../../types';

// echarts hanya dimuat saat widget chart pertama dirender — tidak ikut bundle
// awal. Modul tree-shaken (lihat echartsSetup.ts) supaya bundel tidak 1 MB.
let echartsPromise: Promise<typeof import('./echartsSetup')> | null = null;
const loadEcharts = () => (echartsPromise ??= import('./echartsSetup'));

/** Mulai unduh chunk echarts lebih awal (saat dashboard dibuka),
 *  bukan menunggu chart pertama dirender. Idempoten — aman dipanggil berkali-kali. */
export const preloadEcharts = (): Promise<unknown> => loadEcharts();

/** Cache peta Indonesia: diunduh & didaftarkan sekali untuk semua widget peta. */
let petaIndonesiaPromise: Promise<void> | null = null;
const NAMA_MAP = 'indonesia';

function pastikanPetaTerdaftar(echarts: any): Promise<void> {
  return (petaIndonesiaPromise ??= (async () => {
    if (echarts.getMap?.(NAMA_MAP)) return;
    const res = await fetch('/geo/indonesia.geojson');
    if (!res.ok) throw new Error('GeoJSON peta gagal dimuat');
    const geo = await res.json();
    echarts.registerMap(NAMA_MAP, geo);
  })().catch((err) => {
    // Reset agar percobaan berikutnya bisa mengulang (mis. jaringan pulih).
    petaIndonesiaPromise = null;
    throw err;
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIT NORMALIZATION
// RAG kadang mengembalikan data satu seri dalam "triliun" dan seri lain dalam
// "miliar". ECharts membandingkan angka mentah, jadi 1.0 (triliun) terlihat
// lebih kecil dari 985.4 (miliar). Normalisasi ke basis "miliar" sebelum render.
// ─────────────────────────────────────────────────────────────────────────────
function unitMultiplier(unit: string): number {
  const u = unit.toLowerCase();
  if (/triliun/.test(u)) return 1_000;
  if (/juta/.test(u)) return 0.001;
  if (/ribu/.test(u)) return 0.000_001;
  return 1;
}

function normalizeSeriesData(
  series: Array<{ name: string; data: number[]; color?: string; unit?: string; kind?: 'bar' | 'line'; yAxisIndex?: 0 | 1 }>,
  widgetUnit?: string
) {
  const multipliers = series.map((s) => unitMultiplier(s.unit || widgetUnit || ''));
  const allSame = multipliers.every((m) => m === multipliers[0]);
  if (allSame && multipliers[0] === 1) {
    return { normalizedSeries: series, displayUnit: widgetUnit || '' };
  }
  const normalizedSeries = series.map((s, i) => ({ ...s, data: s.data.map((v) => v * multipliers[i]) }));
  const maxMultiplier = Math.max(...multipliers);
  let displayUnit = widgetUnit || '';
  if (maxMultiplier >= 1_000) {
    displayUnit = displayUnit.replace(/triliun/i, 'miliar');
    if (!displayUnit) displayUnit = 'Rp miliar';
  }
  return { normalizedSeries, displayUnit };
}

/** Semua tipe yang dirender ECharts (bukan kpi/table/narasi/gauge/bullet-target). */
const TIPE_ECHARTS: WidgetType[] = [
  'line', 'area', 'bar', 'hbar', 'combo', 'pie', 'donut', 'treemap', 'funnel',
  'waterfall', 'sankey', 'scatter', 'bubble', 'histogram', 'boxplot', 'heatmap',
  'radar', 'map', 'gantt',
];

/** Tipe yang mendukung cross-filter klik kategori. */
const TIPE_SELEKSI: WidgetType[] = [
  'line', 'area', 'bar', 'hbar', 'combo', 'pie', 'donut', 'treemap', 'funnel',
  'waterfall', 'heatmap',
];

export interface ChartEchartsProps {
  type: WidgetType;
  xAxis: string[];
  series: Array<{
    name: string;
    data: number[];
    color?: string;
    unit?: string;
    kind?: 'bar' | 'line';
    yAxisIndex?: 0 | 1;
  }>;
  unit?: string;
  stacked?: boolean;
  showLegend?: boolean;
  min?: number;
  max?: number;
  heatmapData?: number[][];
  heatmapRows?: string[];
  heatmapCols?: string[];
  points?: Array<{ x: number; y: number; size?: number; label?: string; color?: string }>;
  links?: Array<{ source: string; target: string; value: number }>;
  waterfall?: Array<{ name: string; value: number }>;
  radarData?: { indicators: Array<{ name: string; max: number }>; series: Array<{ name: string; values: number[]; color?: string }> };
  boxRaw?: number[][];
  treemapData?: { name: string; value?: number; children?: Array<{ name: string; value: number }> };
  geoData?: { mapName?: string; regions: Array<{ name: string; value: number }>; unit?: string };
  ganttData?: { tasks: Array<{ name: string; start: string; end: string; progress?: number; color?: string }> };
}

export const ChartEcharts: React.FC<ChartEchartsProps> = ({
  type,
  xAxis,
  series,
  unit,
  stacked = false,
  showLegend = true,
  min,
  max,
  heatmapData,
  heatmapRows,
  heatmapCols,
  points,
  links,
  waterfall,
  radarData,
  boxRaw,
  treemapData,
  geoData,
  ganttData,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<ECharts | null>(null);
  const { selected, setSelected } = useChartSelection();
  const themeMode = useThemeMode();
  const [showData, setShowData] = useState(false);

  const { normalizedSeries, displayUnit } = useMemo(
    () => normalizeSeriesData(series, unit),
    [series, unit]
  );

  const isSeleksi = TIPE_SELEKSI.includes(type);

  // ── Turunkan data tampilan berdasarkan seleksi (cross-filter ala Tableau) ──
  const view = useMemo(() => {
    let xView = xAxis;
    let seriesView = normalizedSeries;
    let heatCols = heatmapCols ?? xAxis;
    let heatRows = heatmapRows ?? normalizedSeries.map((s) => s.name);
    let heatMatriks = heatmapData ?? normalizedSeries.map((s) => heatCols.map((_, c) => s.data[c] ?? 0));
    let treemapView = treemapData;
    let radarView = radarData;
    let funnelView = xView.map((label, idx) => ({ name: label, value: normalizedSeries[0]?.data[idx] || 0 }));
    let pieView = xView.map((label, idx) => ({ name: label, value: normalizedSeries[0]?.data[idx] || 0 }));

    if (selected && isSeleksi) {
      if (['line', 'area', 'bar', 'hbar', 'combo'].includes(type) && xAxis.includes(selected)) {
        const i = xAxis.indexOf(selected);
        xView = [selected];
        seriesView = normalizedSeries.map((s) => ({ ...s, data: [s.data[i] ?? 0] }));
      } else if ((type === 'pie' || type === 'donut') && pieView.some((d) => d.name === selected)) {
        pieView = pieView.filter((d) => d.name === selected);
      } else if (type === 'funnel' && funnelView.some((d) => d.name === selected)) {
        funnelView = funnelView.filter((d) => d.name === selected);
      } else if (type === 'heatmap' && heatCols.includes(selected)) {
        const ci = heatCols.indexOf(selected);
        heatCols = [selected];
        heatMatriks = heatMatriks.map((r) => [r[ci] ?? 0]);
      } else if (type === 'treemap' && treemapView?.children?.some((c) => c.name === selected)) {
        treemapView = { ...treemapView, children: treemapView.children.filter((c) => c.name === selected) };
      }
    }

    return { xView, seriesView, heatCols, heatRows, heatMatriks, treemapView, radarView, funnelView, pieView };
  }, [type, xAxis, normalizedSeries, heatmapData, heatmapRows, heatmapCols, selected, isSeleksi, treemapData, radarData]);

  useEffect(() => {
    if (!chartRef.current || !TIPE_ECHARTS.includes(type)) return;

    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    const handleResize = () => chartInstanceRef.current?.resize();
    let container: HTMLElement | null = null;
    let handleDomClick: ((ev: MouseEvent) => void) | null = null;

    loadEcharts().then(async ({ echarts }) => {
      if (disposed || !chartRef.current) return;

      // Peta: GeoJSON harus terdaftar dulu sebelum opsi dirender.
      if (type === 'map') {
        try {
          await pastikanPetaTerdaftar(echarts);
        } catch {
          // Gagal muat peta -> tetap render (peta kosong) daripada crash.
        }
        if (disposed || !chartRef.current) return;
      }

      if (!chartInstanceRef.current) {
        chartInstanceRef.current = echarts.init(chartRef.current);
      }
      const chart = chartInstanceRef.current;
      const T = chartTheme(themeMode);
      const { xView, seriesView, heatCols, heatRows, heatMatriks, treemapView, radarView, funnelView, pieView } = view;

      const chartData: ChartData = {
        xAxis: xView,
        series: seriesView,
        unit: displayUnit,
        stacked,
        showLegend,
        min,
        max,
        points,
        links,
        waterfall,
        radar: radarView,
        boxRaw,
        treemap: treemapView,
        geo: geoData,
        gantt: ganttData,
        heatmap: { rows: heatRows, columns: heatCols, data: heatMatriks, unit: displayUnit },
      };

      let option: EChartsOption;
      if (type === 'pie' || type === 'donut') {
        option = buildChartOption(type, {
          ...chartData,
          xAxis: pieView.map((d) => d.name),
          series: [{ name: seriesView[0]?.name || 'Nilai', data: pieView.map((d) => d.value) }],
        }, T);
      } else if (type === 'funnel') {
        option = buildChartOption(type, {
          ...chartData,
          xAxis: funnelView.map((d) => d.name),
          series: [{ name: seriesView[0]?.name || 'Nilai', data: funnelView.map((d) => d.value) }],
        }, T);
      } else {
        option = buildChartOption(type, chartData, T);
      }

      chart.setOption(option, true);

      // Klik area grafik → seleksi kategori lintas-chart (klik lagi = batal).
      if (isSeleksi) {
        container = chartRef.current;
        handleDomClick = (ev: MouseEvent) => {
          if (!container) return;
          const rect = container.getBoundingClientRect();
          const x = ev.clientX - rect.left;
          const y = ev.clientY - rect.top;
          let nilai: string | null = null;

          if (['pie', 'donut', 'treemap', 'funnel'].includes(type)) {
            const hover: any = (chart as any).getZr()?.handler?.findHover?.(x, y);
            const el = hover?.topTarget || hover?.target;
            const di = el?.__ecData?.dataIndex;
            nilai = typeof di === 'number' ? xAxis[di] ?? null : null;
          } else {
            let idx = -1;
            try {
              const px: any = (chart as any).convertFromPixel({ seriesIndex: 0 }, [x, y]);
              idx = Math.round(Array.isArray(px) ? px[0] : px);
            } catch {
              idx = -1;
            }
            const kolom = type === 'heatmap' ? heatCols : type === 'hbar' ? seriesView.map((s) => s.name) : xView;
            if (idx >= 0 && idx < kolom.length) nilai = kolom[idx];
          }

          if (!nilai) return;
          setSelected(selected === nilai ? null : nilai);
        };
        container.addEventListener('click', handleDomClick);
      }

      window.addEventListener('resize', handleResize);
      resizeObserver = new ResizeObserver(() => chartInstanceRef.current?.resize());
      resizeObserver.observe(chartRef.current);
    });

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      if (container && handleDomClick) container.removeEventListener('click', handleDomClick);
      resizeObserver?.disconnect();
    };
  }, [type, view, stacked, showLegend, min, max, displayUnit, selected, setSelected, themeMode, isSeleksi, points, links, waterfall, boxRaw, treemapData, geoData, ganttData]);

  // Buang instance chart saat komponen unmount permanen (widget dihapus).
  useEffect(() => {
    return () => {
      chartInstanceRef.current?.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  // ── Tabel "lihat data" dari data yang sedang tampil ───────────────────────
  const tabel = useMemo(() => {
    const { xView, seriesView, heatCols, heatRows, heatMatriks } = view;
    const u = displayUnit ? ` (${displayUnit})` : '';

    if (type === 'pie' || type === 'donut' || type === 'funnel') {
      return { kolom: ['Kategori', `Nilai${u}`], baris: xView.map((label, i) => [label, seriesView[0]?.data[i] ?? 0] as (string | number)[]) };
    }
    if (type === 'treemap') {
      const anak = treemapData?.children ?? xView.map((label, idx) => ({ name: label, value: seriesView[0]?.data[idx] ?? 0 }));
      return { kolom: ['Kategori', `Nilai${u}`], baris: anak.map((c) => [c.name, c.value] as (string | number)[]) };
    }
    if (type === 'sankey') {
      return { kolom: ['Sumber', 'Tujuan', `Nilai${u}`], baris: (links ?? []).map((l) => [l.source, l.target, l.value] as (string | number)[]) };
    }
    if (type === 'scatter' || type === 'bubble') {
      const pts = points ?? seriesView.flatMap((s) => s.data.map((y, i) => ({ x: i + 1, y, label: `${s.name} · ${xView[i] ?? i + 1}`, size: undefined as number | undefined })));
      return { kolom: ['Label', 'X', `Y${u}`, 'Ukuran'], baris: pts.map((p) => [p.label ?? '', p.x, p.y, p.size ?? ''] as (string | number)[]) };
    }
    if (type === 'boxplot') {
      const kelompok = boxRaw ?? seriesView.map((s) => s.data);
      const nama = boxRaw ? xView.slice(0, kelompok.length) : seriesView.map((s) => s.name);
      return { kolom: ['Kelompok', 'Nilai'], baris: kelompok.flatMap((g, gi) => g.map((v) => [nama[gi] ?? `Kelompok ${gi + 1}`, v] as (string | number)[])) };
    }
    if (type === 'histogram') {
      const mentah = boxRaw ? boxRaw.flat() : seriesView.flatMap((s) => s.data);
      return { kolom: ['Nilai'], baris: mentah.map((v) => [v] as (string | number)[]) };
    }
    if (type === 'waterfall') {
      const items = waterfall ?? xView.map((label, idx) => ({ name: label, value: seriesView[0]?.data[idx] ?? 0 }));
      return { kolom: ['Tahap', `Nilai${u}`], baris: items.map((i) => [i.name, i.value] as (string | number)[]) };
    }
    if (type === 'radar') {
      const ind = radarData?.indicators ?? xView.map((n) => ({ name: n, max: 100 }));
      const seri = radarData?.series ?? seriesView.map((s) => ({ name: s.name, values: s.data }));
      return { kolom: ['Indikator', ...seri.map((s) => s.name)], baris: ind.map((indikator, i) => [indikator.name, ...seri.map((s) => s.values[i] ?? '')] as (string | number)[]) };
    }
    if (type === 'map') {
      const regions = geoData?.regions ?? xView.map((label, idx) => ({ name: label, value: seriesView[0]?.data[idx] ?? 0 }));
      return { kolom: ['Wilayah', `Nilai${u}`], baris: regions.map((r) => [r.name, r.value] as (string | number)[]) };
    }
    if (type === 'gantt') {
      const tasks = ganttData?.tasks ?? [];
      return { kolom: ['Tugas', 'Mulai', 'Selesai', 'Progres'], baris: tasks.map((t) => [t.name, t.start, t.end, t.progress != null ? `${t.progress}%` : ''] as (string | number)[]) };
    }
    if (type === 'heatmap') {
      return { kolom: ['Baris', ...heatCols], baris: heatRows.map((r, ri) => [r, ...heatCols.map((_, ci) => heatMatriks[ri]?.[ci] ?? 0)] as (string | number)[]) };
    }
    if (type === 'gauge') {
      return { kolom: ['Metrik', 'Nilai'], baris: [[seriesView[0]?.name || 'Nilai', seriesView[0]?.data?.[0] ?? 0] as (string | number)[]] };
    }
    return {
      kolom: ['Kategori', ...seriesView.map((s) => s.name)],
      baris: xView.map((x, i) => [x, ...seriesView.map((s) => s.data[i] ?? '')] as (string | number)[]),
    };
  }, [view, type, displayUnit, treemapData, links, points, boxRaw, waterfall, radarData, geoData, ganttData]);

  const toggleDataButton = (
    <button
      type="button"
      onClick={() => setShowData((v) => !v)}
      data-testid="chart-toggle-data"
      className="inline-flex items-center gap-1 px-2 py-1 rounded-control text-[10px] font-medium text-ink-3 hover:text-brand-ink hover:bg-surface-2 border border-transparent hover:border-line transition-colors"
      title={showData ? 'Kembali ke grafik' : 'Lihat angka sebagai tabel'}
    >
      {showData ? <BarChart3 className="w-3 h-3" /> : <Table2 className="w-3 h-3" />}
      <span>{showData ? 'Grafik' : 'Lihat data'}</span>
    </button>
  );

  const tabelView = (
    <div className="absolute inset-0 overflow-auto" data-testid="chart-data-table">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr>
            {tabel.kolom.map((k) => (
              <th key={k} className="text-left font-semibold text-ink-2 bg-surface-2 border border-line px-2 py-1 sticky top-0">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tabel.baris.map((row, ri) => (
            <tr key={ri} className={ri % 2 ? 'bg-surface-2/50' : ''}>
              {row.map((cell, ci) => (
                <td key={ci} className="text-ink-2 border border-line px-2 py-1 font-mono">
                  {typeof cell === 'number'
                    ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(cell)
                    : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Widget gauge: pakai RingGauge3D (soft-3D) alih-alih gauge ECharts.
  if (type === 'gauge') {
    const nilai = view.seriesView[0]?.data?.[0] ?? 0;
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex justify-end mb-1">{toggleDataButton}</div>
        <div className="relative flex-1 min-h-[190px] flex items-center justify-center">
          {showData ? (
            tabelView
          ) : (
            <RingGauge3D value={nilai} max={max ?? 100} unit={displayUnit} label={view.seriesView[0]?.name} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-end mb-1">{toggleDataButton}</div>
      <div className="relative flex-1 min-h-[190px]">
        <div ref={chartRef} className={`absolute inset-0 ${showData ? 'invisible' : ''}`} />
        {showData && tabelView}
      </div>
    </div>
  );
};
