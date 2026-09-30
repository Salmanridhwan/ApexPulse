import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface ChartEchartsProps {
  type: 'line' | 'area' | 'bar' | 'donut';
  xAxis: string[];
  series: Array<{
    name: string;
    data: number[];
    color?: string;
  }>;
  unit?: string;
  stacked?: boolean;
  showLegend?: boolean;
}

export const ChartEcharts: React.FC<ChartEchartsProps> = ({
  type,
  xAxis,
  series,
  unit,
  stacked = false,
  showLegend = true,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current);
    }

    const chart = chartInstanceRef.current;

    let option: echarts.EChartsOption = {};

    if (type === 'donut') {
      const pieData = xAxis.map((label, idx) => ({
        name: label,
        value: series[0]?.data[idx] || 0,
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
            name: unit || 'Nilai',
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
        color: ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'],
      };
    } else {
      const isArea = type === 'area';
      const echartsSeries = series.map((s, sIdx) => {
        const baseColor = s.color || (sIdx === 0 ? '#0284c7' : '#10b981');
        return {
          name: s.name,
          type: (isArea ? 'line' : type) as any,
          stack: stacked ? 'total' : undefined,
          smooth: 0.35,
          showSymbol: false,
          symbolSize: 6,
          data: s.data,
          itemStyle: {
            color: baseColor,
            borderRadius: type === 'bar' ? [6, 6, 0, 0] : 0,
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
          backgroundColor: '#0f172a',
          borderColor: '#1e293b',
          borderRadius: 8,
          textStyle: { color: '#f8fafc', fontSize: 11, fontFamily: 'Plus Jakarta Sans' },
          valueFormatter: (val: any) => `${val} ${unit || ''}`.trim(),
        },
        legend: showLegend && series.length > 1
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
          top: series.length > 1 && showLegend ? '15%' : '8%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: xAxis,
          axisLine: { lineStyle: { color: '#e2e8f0' } },
          axisTick: { show: false },
          axisLabel: { color: '#64748b', fontSize: 11, fontFamily: 'Plus Jakarta Sans' },
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
          axisLabel: {
            color: '#64748b',
            fontSize: 11,
            fontFamily: 'JetBrains Mono',
            formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`),
          },
        },
        series: echartsSeries,
      };
    }

    chart.setOption(option, true);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });
    resizeObserver.observe(chartRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [type, xAxis, series, unit, stacked, showLegend]);

  return <div ref={chartRef} className="w-full h-full min-h-[220px]" />;
};
