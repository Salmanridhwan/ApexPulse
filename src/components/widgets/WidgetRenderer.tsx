import React from 'react';
import { WidgetSpec } from '../../types';
import { ChartEcharts } from './ChartEcharts';
import { DataTable } from './DataTable';
import { KpiCard } from './KpiCard';
import { NarasiCard } from './NarasiCard';

interface WidgetRendererProps {
  widget: WidgetSpec;
  /** Posisi kartu di kanvas (opsional) — menggeser hue awal grafik. */
  urutan?: number;
}

/** Tipe yang dirender lewat ChartEcharts. */
const TIPE_CHART = [
  'line', 'area', 'bar', 'hbar', 'combo', 'pie', 'donut', 'treemap', 'funnel',
  'waterfall', 'sankey', 'scatter', 'bubble', 'histogram', 'boxplot', 'heatmap',
  'radar', 'map', 'gantt', 'gauge',
  // Analitik prediktif & preskriptif — dirender sebagai chart dari deret dokumen.
  'trend-line', 'forecast', 'anomaly', 'cluster', 'dekomposisi', 'skenario', 'sensitivitas',
];

/**
 * Seed warna stabil dari id + judul widget. Dipakai agar tiap grafik di dashboard
 * mulai dari hue berbeda (bukan semuanya biru), tanpa berubah antar-render.
 */
const seedWarna = (widget: WidgetSpec, urutan?: number): number => {
  // Bila posisi kartu diketahui, langkah 5 (koprima dengan 12 hue) menjamin
  // kartu bersebelahan selalu beda hue: 0,5,10,3,8,1,6,11,4,9,2,7.
  if (urutan !== undefined) return (urutan * 5) % 12;
  const teks = `${widget.id || ''}|${widget.title || ''}|${widget.type}`;
  let h = 7;
  for (let i = 0; i < teks.length; i += 1) h = (h * 31 + teks.charCodeAt(i)) % 100003;
  return h;
};

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({ widget, urutan }) => {
  if (TIPE_CHART.includes(widget.type)) {
    return (
      <ChartEcharts
        type={widget.type}
        xAxis={widget.chart?.xAxis || []}
        series={widget.chart?.series || []}
        unit={widget.chart?.unit}
        stacked={widget.chart?.stacked}
        showLegend={widget.chart?.showLegend}
        min={widget.chart?.min}
        max={widget.chart?.max}
        heatmapData={widget.heatmap?.data}
        heatmapRows={widget.heatmap?.rows}
        heatmapCols={widget.heatmap?.columns}
        points={widget.chart?.points}
        links={widget.chart?.links}
        waterfall={widget.chart?.waterfall}
        radarData={widget.chart?.radar}
        boxRaw={widget.chart?.boxRaw}
        treemapData={widget.treemap}
        geoData={widget.geo}
        ganttData={widget.gantt}
        style={widget.style}
        warnaSeed={seedWarna(widget, urutan)}
      />
    );
  }

  switch (widget.type) {
    case 'kpi':
      return (
        <KpiCard
          variant={(widget.grid?.w ?? 0) >= 6 ? 'hero' : 'compact'}
          value={widget.kpi?.value ?? '-'}
          unit={widget.kpi?.unit}
          delta={widget.kpi?.delta}
          deltaLabel={widget.kpi?.deltaLabel}
          target={widget.kpi?.target}
          targetLabel={widget.kpi?.targetLabel}
          tampilkanTarget={false}
          sparkline={widget.kpi?.sparkline}
          isCorrected={widget.manualCorrection?.isCorrected}
          title={widget.title}
          style={widget.style}
        />
      );

    case 'table':
      return (
        <DataTable
          columns={widget.table?.columns || []}
          rows={widget.table?.rows || []}
        />
      );

    case 'narasi':
      return (
        <NarasiCard
          text={widget.narasi?.text || ''}
          bulletPoints={widget.narasi?.bulletPoints}
        />
      );

    case 'bullet-target':
      return (
        <KpiCard
          variant={(widget.grid?.w ?? 0) >= 6 ? 'hero' : 'compact'}
          value={widget.kpi?.value ?? '-'}
          unit={widget.kpi?.unit}
          delta={widget.kpi?.delta}
          deltaLabel={widget.kpi?.deltaLabel || 'Realisasi Target RKAP'}
          target={widget.kpi?.target}
          targetLabel={widget.kpi?.targetLabel}
          sparkline={widget.kpi?.sparkline}
          isCorrected={widget.manualCorrection?.isCorrected}
          title={widget.title}
          style={widget.style}
        />
      );

    default:
      return (
        <div className="p-4 text-center text-xs text-ink-3">
          Tipe widget {widget.type} tidak dikenali
        </div>
      );
  }
};
