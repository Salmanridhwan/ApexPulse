import React from 'react';
import { WidgetChart } from '../widgets/WidgetChart';
import type { ChartId } from '../../services/chart/chartDefault';
import { contohData } from '../../services/chart/contohData';
import type { Varian } from '../../services/chart/gayaVarian';

/**
 * PRATINJAU SATU SEL MATRIKS (chart x varian).
 *
 * Sekarang hanya pembungkus tipis: penggambarannya diserahkan ke `WidgetChart`
 * supaya katalog dan kanvas dashboard memakai renderer yang sama.
 */

interface Props {
  chartId: ChartId;
  varian: Varian;
  tinggi?: number;
}

export const PratinjauChart: React.FC<Props> = ({ chartId, varian, tinggi = 170 }) => (
  <WidgetChart chartId={chartId} varian={varian} data={contohData(chartId)} tinggi={tinggi} />
);
