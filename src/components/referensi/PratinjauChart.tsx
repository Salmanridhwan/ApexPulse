import React from 'react';
import { Droplets } from 'lucide-react';
import { WidgetChart } from '../widgets/WidgetChart';
import type { ChartId } from '../../services/chart/chartDefault';
import { contohData } from '../../services/chart/contohData';
import type { GayaVarian, Varian } from '../../services/chart/gayaVarian';

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
  /** Nilai gaya pengganti, mis. Default versi gelap. */
  gaya?: GayaVarian;
}

export const PratinjauChart: React.FC<Props> = ({ chartId, varian, tinggi = 170, gaya }) => (
  <WidgetChart
    chartId={chartId}
    varian={varian}
    data={contohData(chartId)}
    tinggi={tinggi}
    gaya={gaya}
    // Contoh ikon dan keterangan agar kartu KPI tampil lengkap seperti di dashboard.
    ikon={chartId === 'kpi-kartu' || chartId === 'kpi-strip' ? Droplets : undefined}
    deltaTeks={chartId === 'kpi-kartu' ? 'dibanding tahun lalu' : undefined}
  />
);
