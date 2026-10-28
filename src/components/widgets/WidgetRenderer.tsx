import React from 'react';
import { WidgetSpec } from '../../types';
import { ChartEcharts } from './ChartEcharts';
import { DataTable } from './DataTable';
import { KpiCard } from './KpiCard';
import { NarasiCard } from './NarasiCard';
import { pasanganUntuk } from './paletPasangan';

/** Warna & keterangan status capaian target (sama seperti pratinjau template). */
const WARNA_TARGET: Record<string, string> = {
  sesuai: 'var(--color-pos)',
  mendekati: 'var(--color-brand)',
  perhatian: 'var(--color-neg)',
};
const TEKS_TARGET: Record<string, string> = {
  sesuai: 'sesuai target',
  mendekati: 'mendekati target',
  perhatian: 'perlu perhatian',
};

/**
 * Beberapa bar progres target dalam satu kartu (gaya "Progres Target" template).
 * Nilai di atas 100% dipotong untuk lebar bar, tetapi angkanya tetap ditulis apa
 * adanya supaya tidak menyesatkan.
 */
function TargetList({
  targets,
}: {
  targets: NonNullable<WidgetSpec['kpi']>['targets'];
}) {
  return (
    <div className="flex h-full min-h-0 flex-col justify-center gap-2 overflow-hidden">
      {(targets || []).map((t) => {
        const warna = WARNA_TARGET[t.status] || 'var(--color-brand)';
        return (
          <div key={t.label} className="min-w-0">
            <div className="flex items-baseline justify-between gap-1.5 mb-0.5">
              <span className="text-[10.5px] font-semibold text-ink-2 truncate leading-tight" title={t.label}>
                {t.label}
              </span>
              <span className="text-[11px] font-bold tabular-nums shrink-0 leading-tight" style={{ color: warna }}>
                {t.persen}%
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-line)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, t.persen))}%`, background: warna }}
              />
            </div>
            <span className="text-[9.5px] font-medium leading-tight" style={{ color: warna }}>
              • {TEKS_TARGET[t.status] || ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface WidgetRendererProps {
  widget: WidgetSpec;
  /** Posisi kartu di kanvas (opsional) — menggeser hue awal grafik. */
  urutan?: number;
  /** Mode padat (dashboard satu halaman) — diteruskan ke grafik & tabel. */
  padat?: boolean;
  /**
   * Mode pratinjau template. Di pratinjau, sparkline contoh boleh tampil walau
   * deretnya bukan dari dokumen (seluruh pratinjau memang berlabel "angka
   * contoh"). Di dashboard nyata aturan lama tetap: sparkline hanya untuk
   * deret dokumen (`dokumen-seri`).
   */
  preview?: boolean;
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

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({ widget, urutan, padat = false, preview = false }) => {
  if (TIPE_CHART.includes(widget.type)) {
    const seed = seedWarna(widget, urutan);
    const seri = widget.chart?.series || [];
    // Warna seri hanya diatur otomatis kalau pengguna belum memilih palet /
    // warna seri sendiri. Dua seri (mis. Target vs Realisasi) memakai pasangan
    // warna kontras yang bergiliran per kartu — dulu semuanya biru + kuning.
    const warnaOtomatis = !widget.style?.warnaSeri?.length && (!widget.style?.palette || widget.style.palette === 'default');
    const seriBerwarna =
      warnaOtomatis && seri.length >= 2
        ? seri.map((s, i) => ({ ...s, color: pasanganUntuk(seed)[i % 2] }))
        : seri;
    return (
      <ChartEcharts
        type={widget.type}
        xAxis={widget.chart?.xAxis || []}
        series={seriBerwarna}
        unit={widget.chart?.unit}
        stacked={widget.chart?.stacked}
        // Legenda disembunyikan di kanvas satu halaman KECUALI untuk cincin/loncat:
        // tanpa legenda, potongan komposisi tidak bisa diidentifikasi sama sekali.
        showLegend={
          padat
            ? (widget.type === 'donut' || widget.type === 'pie') && (widget.chart?.showLegend ?? true)
            : widget.chart?.showLegend
        }
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
        warnaSeed={seed}
        padat={padat}
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
          // Angka estimasi tidak dirender: sparkline hanya ditampilkan kalau
          // deretnya benar-benar dari dokumen (`dokumen-seri`). Bentuk
          // `turunan-nilai`/`turunan-delta` dihitung dari satu titik, jadi
          // garisnya karangan — dan "+6,4% tren indikatif" hanyalah akibat
          // garis karangan itu, bukan angka dokumen.
          delta={widget.kpi?.deltaLabel === 'tren indikatif' ? undefined : widget.kpi?.delta}
          deltaLabel={widget.kpi?.deltaLabel === 'tren indikatif' ? undefined : widget.kpi?.deltaLabel}
          target={widget.kpi?.target}
          targetLabel={widget.kpi?.targetLabel}
          tampilkanTarget
          sparkline={widget.kpi?.sparklineAsal === 'dokumen-seri' || (preview && (widget.kpi?.sparkline?.length ?? 0) > 1) ? widget.kpi?.sparkline : undefined}
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
      // Kartu "Progres Target" pada template memuat BEBERAPA target sekaligus
      // (pendapatan, efisiensi beban, laba bersih). Kalau datanya berisi daftar
      // target, tampilkan baris progres — bukan satu angka besar.
      if (widget.kpi?.targets?.length) {
        return <TargetList targets={widget.kpi.targets} />;
      }
      return (
        <KpiCard
          variant={(widget.grid?.w ?? 0) >= 6 ? 'hero' : 'compact'}
          value={widget.kpi?.value ?? '-'}
          unit={widget.kpi?.unit}
          delta={widget.kpi?.deltaLabel === 'tren indikatif' ? undefined : widget.kpi?.delta}
          deltaLabel={widget.kpi?.deltaLabel || 'Realisasi Target RKAP'}
          target={widget.kpi?.target}
          targetLabel={widget.kpi?.targetLabel}
          sparkline={widget.kpi?.sparklineAsal === 'dokumen-seri' ? widget.kpi?.sparkline : undefined}
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
