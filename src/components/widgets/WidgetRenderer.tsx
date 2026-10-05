import React from 'react';
import { WidgetSpec } from '../../types';
import { ChartEcharts } from './ChartEcharts';
import { DataTable } from './DataTable';
import { KpiCard } from './KpiCard';
import { NarasiCard } from './NarasiCard';

interface WidgetRendererProps {
  widget: WidgetSpec;
}

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({ widget }) => {
  switch (widget.type) {
    case 'kpi':
      return (
        <KpiCard
          value={widget.kpi?.value ?? '-'}
          unit={widget.kpi?.unit}
          delta={widget.kpi?.delta}
          deltaLabel={widget.kpi?.deltaLabel}
          target={widget.kpi?.target}
          targetLabel={widget.kpi?.targetLabel}
          sparkline={widget.kpi?.sparkline}
          isCorrected={widget.manualCorrection?.isCorrected}
          title={widget.title}
        />
      );

    case 'line':
    case 'area':
    case 'bar':
    case 'donut':
    case 'gauge':
    case 'heatmap':
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
          value={widget.kpi?.value ?? '-'}
          unit={widget.kpi?.unit}
          delta={widget.kpi?.delta}
          deltaLabel={widget.kpi?.deltaLabel || 'Realisasi Target RKAP'}
          target={widget.kpi?.target}
          targetLabel={widget.kpi?.targetLabel}
          sparkline={widget.kpi?.sparkline}
          isCorrected={widget.manualCorrection?.isCorrected}
          title={widget.title}
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
