import React, { useEffect, useRef } from 'react';
import type { ECharts, EChartsOption } from 'echarts';

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

  // ── Normalisasi satuan SEBELUM render ─────────────────────────────────────
  // Bila ada seri dengan satuan berbeda (mis. triliun vs miliar), konversi semua
  // ke satuan terkecil yang masuk akal (miliar) agar bar proporsional.
  const { normalizedSeries, displayUnit } = normalizeSeriesData(series, unit);
  // ──────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!chartRef.current) return;

    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    const handleResize = () => chartInstanceRef.current?.resize();

    loadEcharts().then((echarts) => {
      if (disposed || !chartRef.current) return;

      if (!chartInstanceRef.current) {
        chartInstanceRef.current = echarts.init(chartRef.current);
      }
      const chart = chartInstanceRef.current;

      let option: EChartsOption = {};

      if (type === 'gauge') {
        const nilai = normalizedSeries[0]?.data?.[0] ?? 0;
        const gMin = min ?? 0;
        const gMax = max ?? 100;
        const persen = Math.max(0, Math.min(1, (nilai - gMin) / (gMax - gMin || 1)));
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
                itemStyle: { color: '#1d4ed8' },
              },
              axisLine: { lineStyle: { width: 14, color: [[1, '#e2e8f0']] } },
              axisTick: { show: false },
              splitLine: { length: 6, distance: 4, lineStyle: { color: '#cbd5e1', width: 1 } },
              axisLabel: { color: '#94a3b8', fontSize: 10, distance: 18 },
              pointer: { show: false },
              anchor: { show: false },
              title: { show: false },
              detail: {
                valueAnimation: true,
                fontSize: 30,
                fontWeight: 'bold' as any,
                color: '#0f172a',
                offsetCenter: [0, '10%'],
                formatter: (v: number) => `${v}${displayUnit ? ' ' + displayUnit : ''}`,
              },
              data: [{ value: nilai, name: normalizedSeries[0]?.name || '' }],
            },
          ],
        };
      } else if (type === 'heatmap') {
        // Konvensi: xAxis = label kolom (bawah), nama seri = label baris (kiri).
        const cols = xAxis;
        const rows = normalizedSeries.map((s) => s.name);
        // Matriks [baris][kolom]: heatmapData eksplisit, atau series[r].data[kolom-c].
        const matriks = heatmapData ?? normalizedSeries.map((s) => cols.map((_, c) => s.data[c] ?? 0));
        const semuaNilai = (heatmapData ?? []).flat();
        const vMin = semuaNilai.length ? Math.min(...semuaNilai) : 0;
        const vMax = semuaNilai.length ? Math.max(...semuaNilai) : 100;
        option = {
          tooltip: {
            position: 'top',
            formatter: (p: any) => `${rows[p.value[1]]} · ${cols[p.value[0]]}: <b>${p.value[2]}</b>${displayUnit ? ' ' + displayUnit : ''}`,
          },
          grid: { left: 10, right: 10, top: 10, bottom: 30, containLabel: true },
          xAxis: { type: 'category', data: cols, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#64748b', fontSize: 10 } },
          yAxis: { type: 'category', data: rows, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#64748b', fontSize: 10 } },
          visualMap: {
            min: vMin,
            max: vMax,
            calculable: false,
            orient: 'horizontal',
            left: 'center',
            bottom: -6,
            itemHeight: 60,
            itemWidth: 10,
            textStyle: { fontSize: 9, color: '#94a3b8' },
            inRange: { color: ['#dbeafe', '#1d4ed8'] },
          },
          series: [
            {
              type: 'heatmap',
              data: matriks.flatMap((baris, rIdx) => baris.map((v, cIdx) => [cIdx, rIdx, v])),
              label: { show: true, fontSize: 10, color: '#334155', formatter: (p: any) => `${p.value[2]}` },
              itemStyle: { borderColor: '#ffffff', borderWidth: 2, borderRadius: 4 },
              emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(29,78,216,0.35)' } },
            },
          ],
        };
      } else if (type === 'donut') {
        const pieData = xAxis.map((label, idx) => ({
          name: label,
          value: normalizedSeries[0]?.data[idx] || 0,
        }));

        option = {
          tooltip: {
            trigger: 'item',
            formatter: `{b}: <b>{c}</b> {a} ({d}%)`,
          },
          legend: showLegend
            ? {
              bottom: 0,
              icon: 'circle',
              textStyle: { fontSize: 11, color: '#64748b' },
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
                borderColor: '#ffffff',
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
              data: pieData,
            },
          ],
          color: ['#1d4ed8', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'],
        };
      } else {
        const isArea = type === 'area';
        const paletSoft = ['#93c5fd', '#1d4ed8', '#7dd3fc', '#bfdbfe', '#38bdf8', '#dbeafe'];
        const echartsSeries = normalizedSeries.map((s, sIdx) => {
          // Seri pertama biru muda soft (ala referensi bar chart), seri lanjutan biru tua sebagai kontras.
          const baseColor = s.color || (sIdx === 0 ? (type === 'bar' ? '#93c5fd' : '#1d4ed8') : paletSoft[sIdx % paletSoft.length]);
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
            axisPointer: { type: 'line', lineStyle: { color: '#cbd5e1', type: 'dashed' } },
            backgroundColor: '#1e3a8a',
            borderColor: '#1e40af',
            borderRadius: 8,
            textStyle: { color: '#f8fafc', fontSize: 11, fontFamily: 'Plus Jakarta Sans' },
            valueFormatter: (val: any) => `${val} ${displayUnit || ''}`.trim(),
          },
          legend: showLegend && normalizedSeries.length > 1
            ? {
              top: 0,
              icon: 'circle',
              itemWidth: 8,
              itemHeight: 8,
              textStyle: { fontSize: 11, color: '#475569', fontFamily: 'Plus Jakarta Sans' },
            }
            : undefined,
          grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: normalizedSeries.length > 1 && showLegend ? '15%' : '10%',
            containLabel: true,
          },
          xAxis: {
            type: 'category',
            data: xAxis,
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisTick: { show: false },
            axisLabel: { color: '#94a3b8', fontSize: 11, fontFamily: 'Plus Jakarta Sans' },
          },
          yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
            axisLabel: {
              color: '#94a3b8',
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

      window.addEventListener('resize', handleResize);
      resizeObserver = new ResizeObserver(() => {
        chartInstanceRef.current?.resize();
      });
      resizeObserver.observe(chartRef.current);
    });

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
    };
  }, [type, xAxis, series, unit, stacked, showLegend, min, max, heatmapData, normalizedSeries, displayUnit]);

  // Buang instance chart saat komponen unmount permanen (widget dihapus).
  useEffect(() => {
    return () => {
      chartInstanceRef.current?.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  return <div ref={chartRef} className="w-full h-full min-h-[220px]" />;
};
