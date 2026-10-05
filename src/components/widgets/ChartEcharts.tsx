import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ECharts, EChartsOption } from 'echarts';
import { Table2, BarChart3 } from 'lucide-react';
import { useChartSelection } from './ChartSelection';
import { useThemeMode } from '../../theme';

/** Palet chart per mode tema (ECharts tidak bisa membaca CSS variable). */
function chartTheme(mode: 'light' | 'dark') {
  return mode === 'dark'
    ? { series: ['#8f90e4', '#38c6e2', '#f2503a', '#ffb547', '#3fd29a', '#b58cf0'], accent: '#8f90e4', accentSoft: '#38c6e2', track: '#4d5667', tick: '#5f6a7e', muted: '#9aa4b8', strong: '#f1f4f9', text2: '#cbd2df', grid: '#4d5667', tipBg: '#1d2129', surface: '#3a4150', heatLow: '#444c5d' }
    : { series: ['#7f80d8', '#1fa6cc', '#ee4b32', '#d98a12', '#0f9d6b', '#9a6fe0'], accent: '#7f80d8', accentSoft: '#1fa6cc', track: '#d3d9e3', tick: '#bcc5d3', muted: '#667187', strong: '#232a38', text2: '#4a5468', grid: '#d3d9e3', tipBg: '#232a38', surface: '#f6f8fb', heatLow: '#d6eff7' };
}

// echarts (~1 MB) hanya dimuat saat widget chart pertama dirender —
// tidak ikut bundle awal. Promise di-cache supaya import sekali saja.
let echartsPromise: Promise<typeof import('echarts')> | null = null;
const loadEcharts = () => (echartsPromise ??= import('echarts'));

/** Mulai unduh chunk echarts lebih awal (saat dashboard dibuka),
 *  bukan menunggu chart pertama dirender. Idempoten — aman dipanggil berkali-kali. */
export const preloadEcharts = (): Promise<typeof import('echarts')> => loadEcharts();

// ─────────────────────────────────────────────────────────────────────────────
// UNIT NORMALIZATION
// Problem: RAG sometimes returns series data where some items are in "triliun"
// and others in "miliar". ECharts has no concept of units, so it compares raw
// numbers directly — causing 1.0 (triliun) to look smaller than 985.4 (miliar).
//
// Fix: detect the dominant unit from the `unit` prop, and apply a multiplier so
// ALL values are expressed in the SAME base unit (miliar) before charting.
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a unit string and return its multiplier relative to "miliar" base. */
function unitMultiplier(unit: string): number {
  const u = unit.toLowerCase();
  if (/triliun/.test(u)) return 1_000;    // 1 triliun = 1000 miliar
  if (/juta/.test(u)) return 0.001;       // 1 juta = 0.001 miliar
  if (/ribu/.test(u)) return 0.000_001;   // 1 ribu = 0.000001 miliar
  return 1; // miliar or unknown → no conversion
}

/**
 * Normalize series data so all values are expressed in miliar.
 * Reads `unit` from each series entry (falls back to the widget-level unit).
 * Returns the normalized series plus the resolved display unit label.
 */
function normalizeSeriesData(
  series: Array<{ name: string; data: number[]; color?: string; unit?: string }>,
  widgetUnit?: string
): {
  normalizedSeries: Array<{ name: string; data: number[]; color?: string }>;
  displayUnit: string;
} {
  // Determine per-series multipliers; use widget-level unit as fallback.
  const multipliers = series.map((s) => unitMultiplier(s.unit || widgetUnit || ''));

  // If all multipliers are the same (or 1), skip normalization.
  const allSame = multipliers.every((m) => m === multipliers[0]);
  if (allSame && multipliers[0] === 1) {
    return {
      normalizedSeries: series,
      displayUnit: widgetUnit || '',
    };
  }

  // Normalize everything to miliar base.
  const normalizedSeries = series.map((s, i) => ({
    ...s,
    data: s.data.map((v) => v * multipliers[i]),
  }));

  // Pick a sensible display unit:
  // If original widget unit is triliun and we normalized to miliar, say "miliar".
  const maxMultiplier = Math.max(...multipliers);
  let displayUnit = widgetUnit || '';
  if (maxMultiplier >= 1_000) {
    // Originally mixed triliun/miliar → display in miliar (already converted)
    displayUnit = displayUnit.replace(/triliun/i, 'miliar');
    if (!displayUnit) displayUnit = 'Rp miliar';
  }

  return { normalizedSeries, displayUnit };
}

interface ChartEchartsProps {
  type: 'line' | 'area' | 'bar' | 'donut' | 'gauge' | 'heatmap';
  xAxis: string[];
  series: Array<{
    name: string;
    data: number[];
    color?: string;
    /** Satuan per-seri (opsional). Bila diisi, normalisasi antar satuan dilakukan
     *  sebelum rendering sehingga bar triliun tidak terlihat lebih kecil dari miliar. */
    unit?: string;
  }>;
  unit?: string;
  stacked?: boolean;
  showLegend?: boolean;
  min?: number;
  max?: number;
  /** Khusus heatmap: matriks nilai [baris][kolom]. */
  heatmapData?: number[][];
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
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<ECharts | null>(null);
  const { selected, setSelected } = useChartSelection();
  const themeMode = useThemeMode();
  const [showData, setShowData] = useState(false);

  // ── Normalisasi satuan SEBELUM render ─────────────────────────────────────
  const { normalizedSeries, displayUnit } = useMemo(
    () => normalizeSeriesData(series, unit),
    [series, unit]
  );

  const isCartesian = type === 'line' || type === 'area' || type === 'bar';

  // ── Turunkan data tampilan berdasarkan seleksi (cross-filter ala Tableau) ──
  const view = useMemo(() => {
    let xView = xAxis;
    let seriesView: Array<{ name: string; data: number[]; color?: string }> = normalizedSeries;
    if (isCartesian && selected && xAxis.includes(selected)) {
      const i = xAxis.indexOf(selected);
      xView = [selected];
      seriesView = normalizedSeries.map((s) => ({ ...s, data: [s.data[i] ?? 0] }));
    }

    let donutView = xAxis.map((label, idx) => ({
      name: label,
      value: normalizedSeries[0]?.data[idx] || 0,
    }));
    if (type === 'donut' && selected) {
      const cocok = donutView.filter((d) => d.name === selected);
      if (cocok.length) donutView = cocok;
    }

    let heatCols = xAxis;
    let heatRows = normalizedSeries.map((s) => s.name);
    let heatMatriks =
      heatmapData ?? normalizedSeries.map((s) => heatCols.map((_, c) => s.data[c] ?? 0));
    if (type === 'heatmap' && selected && heatCols.includes(selected)) {
      const ci = heatCols.indexOf(selected);
      heatCols = [selected];
      heatMatriks = heatMatriks.map((r) => [r[ci] ?? 0]);
    }

    return { xView, seriesView, donutView, heatCols, heatRows, heatMatriks };
  }, [type, xAxis, normalizedSeries, heatmapData, selected, isCartesian]);

  useEffect(() => {
    if (!chartRef.current) return;

    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    const handleResize = () => chartInstanceRef.current?.resize();
    // Elemen & handler klik dipakai lintas callback (didaftarkan di then, dibuang di cleanup).
    let container: HTMLElement | null = null;
    let handleDomClick: ((ev: MouseEvent) => void) | null = null;

    loadEcharts().then((echarts) => {
      if (disposed || !chartRef.current) return;

      if (!chartInstanceRef.current) {
        chartInstanceRef.current = echarts.init(chartRef.current);
      }
      const chart = chartInstanceRef.current;
      const T = chartTheme(themeMode);
      const { xView, seriesView, donutView, heatCols, heatRows, heatMatriks } = view;

      let option: EChartsOption = {};

      if (type === 'gauge') {
        const nilai = seriesView[0]?.data?.[0] ?? 0;
        const gMin = min ?? 0;
        const gMax = max ?? 100;
        option = {
          series: [
            {
              type: 'gauge',
              startAngle: 210,
              endAngle: -30,
              min: gMin,
              max: gMax,
              radius: '92%',
              progress: {
                show: true,
                width: 14,
                itemStyle: { color: T.accent },
              },
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
                formatter: (v: number) => `${v}${displayUnit ? ' ' + displayUnit : ''}`,
              },
              data: [{ value: nilai, name: seriesView[0]?.name || '' }],
            },
          ],
        };
      } else if (type === 'heatmap') {
        const cols = heatCols;
        const rows = heatRows;
        const matriks = heatMatriks;
        const semuaNilai = matriks.flat();
        const vMin = semuaNilai.length ? Math.min(...semuaNilai) : 0;
        const vMax = semuaNilai.length ? Math.max(...semuaNilai) : 100;
        option = {
          tooltip: {
            position: 'top',
            formatter: (p: any) =>
              `${rows[p.value[1]]} · ${cols[p.value[0]]}: <b>${p.value[2]}</b>${displayUnit ? ' ' + displayUnit : ''}`,
          },
          grid: { left: 10, right: 10, top: 24, bottom: 30, containLabel: true },
          xAxis: { type: 'category', data: cols, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: T.muted, fontSize: 10 } },
          yAxis: { type: 'category', data: rows, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: T.muted, fontSize: 10 } },
          visualMap: {
            min: vMin,
            max: vMax,
            calculable: false,
            orient: 'horizontal',
            left: 'center',
            bottom: -6,
            itemHeight: 60,
            itemWidth: 10,
            textStyle: { fontSize: 9, color: T.muted },
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
      } else if (type === 'donut') {
        option = {
          tooltip: {
            trigger: 'item',
            backgroundColor: T.tipBg,
            borderColor: T.tipBg,
            borderRadius: 8,
            textStyle: { color: '#f8fafc', fontSize: 11 },
            formatter: (p: any) =>
              `${p.name}: <b>${p.value}${displayUnit ? ' ' + displayUnit : ''}</b> (${p.percent}%)`,
          },
          legend: showLegend
            ? {
              bottom: 0,
              icon: 'circle',
              textStyle: { fontSize: 11, color: T.muted },
            }
            : undefined,
          series: [
            {
              name: displayUnit || 'Nilai',
              type: 'pie',
              radius: ['45%', '72%'],
              avoidLabelOverlap: false,
              itemStyle: {
                borderRadius: 6,
                borderColor: T.surface,
                borderWidth: 2,
              },
              label: {
                show: false,
                position: 'center',
              },
              emphasis: {
                label: {
                  show: true,
                  fontSize: 14,
                  fontWeight: 'bold',
                },
              },
              data: donutView,
            },
          ],
          color: T.series,
        };
      } else {
        const isArea = type === 'area';
        const paletSoft = T.series;
        const echartsSeries = seriesView.map((s, sIdx) => {
          // Seri pertama biru muda soft (ala referensi bar chart), seri lanjutan biru tua sebagai kontras.
          const baseColor = s.color || paletSoft[sIdx % paletSoft.length];
          return {
            name: s.name,
            type: (isArea ? 'line' : type) as any,
            stack: stacked ? 'total' : undefined,
            smooth: 0.35,
            showSymbol: false,
            symbolSize: 6,
            data: s.data,
            barMaxWidth: 18,
            itemStyle: {
              color: baseColor,
              borderRadius: type === 'bar' ? [4, 4, 0, 0] : 0,
            },
            lineStyle: {
              width: 2.5,
              color: baseColor,
            },
            areaStyle: isArea
              ? {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: `${baseColor}55` },
                  { offset: 0.8, color: `${baseColor}05` },
                  { offset: 1, color: 'transparent' },
                ]),
              }
              : undefined,
          };
        });

        option = {
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'line', lineStyle: { color: T.tick, type: 'dashed' } },
            backgroundColor: T.tipBg,
            borderColor: T.tipBg,
            borderRadius: 8,
            textStyle: { color: '#f8fafc', fontSize: 11, fontFamily: 'Plus Jakarta Sans' },
            valueFormatter: (val: any) => `${val} ${displayUnit || ''}`.trim(),
          },
          legend: showLegend && seriesView.length > 1
            ? {
              top: 0,
              left: 0,
              icon: 'circle',
              itemWidth: 8,
              itemHeight: 8,
              textStyle: { fontSize: 11, color: T.text2, fontFamily: 'Plus Jakarta Sans' },
            }
            : undefined,
          grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: seriesView.length > 1 && showLegend ? '15%' : '10%',
            containLabel: true,
          },
          xAxis: {
            type: 'category',
            data: xView,
            axisLine: { lineStyle: { color: T.track } },
            axisTick: { show: false },
            axisLabel: { color: T.muted, fontSize: 11, fontFamily: 'Plus Jakarta Sans' },
          },
          yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: T.grid, type: 'dashed' } },
            axisLabel: {
              color: T.muted,
              fontSize: 11,
              fontFamily: 'JetBrains Mono',
              formatter: (v: number) => {
                // Unit-aware axis label: show T suffix for triliun-scale values
                if (/triliun/i.test(displayUnit) || v >= 1_000_000) {
                  return v >= 1_000 ? `${(v / 1_000).toFixed(1)}T` : `${v}M`;
                }
                return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`;
              },
            },
          },
          series: echartsSeries,
        };
      }

      chart.setOption(option, true);

      // Klik area grafik → seleksi kategori lintas-chart (klik lagi = batal).
      // Catatan: event 'click' level-ECharts tidak terpetakan di lingkungan ini
      // (target zrender selalu null), jadi dipakai listener DOM + convertFromPixel.
      container = chartRef.current;
      handleDomClick = (ev: MouseEvent) => {
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;
        let nilai: string | null = null;

        if (type === 'donut') {
          const hover: any = (chart as any).getZr()?.handler?.findHover?.(x, y);
          const el = hover?.topTarget || hover?.target;
          const di = el?.__ecData?.dataIndex;
          nilai = typeof di === 'number' ? xAxis[di] ?? null : null;
        } else if (type === 'gauge') {
          return;
        } else {
          let idx = -1;
          try {
            const px: any = (chart as any).convertFromPixel({ seriesIndex: 0 }, [x, y]);
            idx = Math.round(Array.isArray(px) ? px[0] : px);
          } catch {
            idx = -1;
          }
          const kolom = type === 'heatmap' ? heatCols : xView;
          if (idx >= 0 && idx < kolom.length) nilai = kolom[idx];
        }

        if (!nilai) return;
        setSelected(selected === nilai ? null : nilai);
      };
      container.addEventListener('click', handleDomClick);

      window.addEventListener('resize', handleResize);
      resizeObserver = new ResizeObserver(() => {
        chartInstanceRef.current?.resize();
      });
      resizeObserver.observe(chartRef.current);
    });

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      if (container && handleDomClick) container.removeEventListener('click', handleDomClick);
      resizeObserver?.disconnect();
    };
  }, [type, view, stacked, showLegend, min, max, displayUnit, selected, setSelected, themeMode]);

  // Buang instance chart saat komponen unmount permanen (widget dihapus).
  useEffect(() => {
    return () => {
      chartInstanceRef.current?.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  // ── Tabel "lihat data" dari data yang sedang tampil ───────────────────────
  const tabel = useMemo(() => {
    const { xView, seriesView, donutView, heatCols, heatRows, heatMatriks } = view;
    if (type === 'donut') {
      return {
        kolom: ['Kategori', `Nilai${displayUnit ? ` (${displayUnit})` : ''}`],
        baris: donutView.map((d) => [d.name, d.value] as (string | number)[]),
      };
    }
    if (type === 'heatmap') {
      return {
        kolom: ['Baris', ...heatCols],
        baris: heatRows.map((r, ri) => [r, ...heatCols.map((_, ci) => heatMatriks[ri]?.[ci] ?? 0)] as (string | number)[]),
      };
    }
    if (type === 'gauge') {
      return {
        kolom: ['Metrik', 'Nilai'],
        baris: [[seriesView[0]?.name || 'Nilai', seriesView[0]?.data?.[0] ?? 0] as (string | number)[]],
      };
    }
    return {
      kolom: ['Kategori', ...seriesView.map((s) => s.name)],
      baris: xView.map((x, i) => [x, ...seriesView.map((s) => s.data[i] ?? '')] as (string | number)[]),
    };
  }, [view, type, displayUnit]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-end mb-1">
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
      </div>

      <div className="relative flex-1 min-h-[190px]">
        <div
          ref={chartRef}
          className={`absolute inset-0 ${showData ? 'invisible' : ''}`}
        />
        {showData && (
          <div className="absolute inset-0 overflow-auto" data-testid="chart-data-table">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr>
                  {tabel.kolom.map((k) => (
                    <th
                      key={k}
                      className="text-left font-semibold text-ink-2 bg-surface-2 border border-line px-2 py-1 sticky top-0"
                    >
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
        )}
      </div>
    </div>
  );
};
