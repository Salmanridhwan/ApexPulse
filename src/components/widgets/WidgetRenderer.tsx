import React, { useCallback, useMemo } from 'react';
import { WidgetSpec } from '../../types';
import { ChartEcharts } from './ChartEcharts';
import { pakaiRancangan } from '../../services/chart/rancanganRag';
import { DataTable } from './DataTable';
import { KpiCard } from './KpiCard';
import { NarasiCard } from './NarasiCard';
import { pasanganUntuk } from './paletPasangan';
import { WidgetChart } from './WidgetChart';
import { gayaKatalogWidget } from './bingkaiKatalog';
import { ikonWidget } from './ikonWidget';
import { normalizeSeriesData } from './ChartEcharts';
import { chartIdDariTipe } from '../../services/chart/petaTipe';
import { kotakDariSeri, statistikBox } from './chartOptions';
import { useChartSelection } from './ChartSelection';
import { adaGaya } from './widgetStyle';
import { gayaReplika } from '../referensi/gayaReplika';
import { grafikKatalog, propsKatalogHtml, type PropsKatalog } from '../../services/chart/dataKatalogWidget';
import type { ChartId } from '../../services/chart/chartDefault';
import type { DataChart } from '../../services/chart/pembangunOpsi';
import { useThemeMode } from '../../theme';

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
  /** Klik area kosong grafik katalog: kartu membuka panel sumber dokumen. */
  onKlikKosong?: () => void;
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
 * Chart yang BENAR-BENAR menggambar kartu.
 *
 * Widget yang memakai entri Template Chart buatan sendiri (`chartId = kustom-…`)
 * digambar oleh chart bawaan di `chartDasar`, sehingga tidak pernah kosong dan
 * tetap memakai chart dari Template Chart.
 */
const chartPenggambarWidget = (w: WidgetSpec): ChartId | undefined =>
  (w.chartDasar as ChartId) || (w.chartId as ChartId);

/**
 * Sama seperti di atas, tetapi untuk kartu berwajah HTML (KPI, tabel, narasi)
 * yang renderer-nya WAJIB menerima id chart. Widget lama tanpa `chartId` tetap
 * memakai padanan tipenya, seperti sebelumnya.
 */
const chartWajib = (w: WidgetSpec): ChartId =>
  chartPenggambarWidget(w) || chartIdDariTipe(w.type) || 'kpi-kartu';

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

/**
 * Kartu berwajah HTML dari Template Chart (KPI, tabel, narasi, progres,
 * peringkat): digambar `WidgetChart` yang sama dengan halaman Template Chart,
 * bukan komponen kanvas sendiri. Gaya Semua (desain & warna kartu) ikut berlaku.
 */
const KartuKatalogHtml: React.FC<{ widget: WidgetSpec; props: PropsKatalog }> = ({ widget, props }) => {
  const { varian, g } = gayaKatalogWidget(widget.style, useThemeMode());
  return (
    <div className="w-full h-full min-h-0 flex flex-col">
      <WidgetChart chartId={chartWajib(widget)} varian={varian} gaya={g} ikon={ikonWidget(widget.ikon)} {...props} />
    </div>
  );
};

/** Tipe yang ikut seleksi lintas-chart (klik kategori), sama seperti `ChartEcharts`. */
const SELEKSI_KATALOG = ['line', 'area', 'bar', 'hbar', 'combo', 'pie', 'donut', 'waterfall'];

/**
 * Grafik kanvas berwajah Template Chart: digambar `WidgetChart` dengan gaya
 * yang sama seperti kartu di halaman Template Chart (`gayaKatalogWidget`), jadi
 * bentuk, warna, legenda, dan label cincin tidak berbeda sedikit pun. Yang
 * ditambahkan kanvas hanya seleksi lintas-chart dan gaya pengguna di luar
 * desain (palet, huruf, ketebalan).
 */
const KartuKatalogGrafik: React.FC<{ widget: WidgetSpec; onKlikKosong?: () => void }> = ({ widget, onKlikKosong }) => {
  const { varian, g } = gayaKatalogWidget(widget.style, useThemeMode());
  const { selected, setSelected } = useChartSelection();
  const ikutSeleksi = SELEKSI_KATALOG.includes(widget.type);
  const data = useMemo<DataChart>(() => {
    const { normalizedSeries, displayUnit } = normalizeSeriesData(widget.chart?.series ?? [], widget.chart?.unit);
    let kategori = widget.chart?.xAxis ?? [];
    let seri = normalizedSeries.map((x) => ({ nama: x.name, data: x.data as Array<number | null> }));
    if (ikutSeleksi && selected && kategori.includes(selected)) {
      const i = kategori.indexOf(selected);
      kategori = [selected];
      seri = seri.map((x) => ({ ...x, data: [x.data[i] ?? null] }));
    }
    const dasar: DataChart = { kategori, seri, satuan: displayUnit, desimal: 1, dariDokumen: true };
    // Bentuk data khusus tiga wajah baru: peta wilayah, jadwal (gantt), kotak
    // sebaran. Tanpa ini, chart katalognya tidak punya angka untuk digambar.
    if (widget.geo?.regions?.length) {
      dasar.peta = widget.geo.regions.map((r) => ({ nama: r.name, nilai: Number(r.value) }));
    }
    if (widget.gantt?.tasks?.length) {
      dasar.jadwal = widget.gantt.tasks.map((t) => ({
        nama: t.name,
        mulai: t.start,
        selesai: t.end,
        progres: t.progress,
      }));
    }
    if (widget.chart?.boxRaw?.length) {
      const namaKelompok = kategori.length >= widget.chart.boxRaw.length ? kategori : [];
      dasar.kotak = widget.chart.boxRaw.map((sampel, i) => {
        const [min, q1, median, q3, maks] = statistikBox(sampel);
        return { nama: namaKelompok[i] || `Kelompok ${i + 1}`, min, q1, median, q3, maks };
      });
    } else if (widget.chartId === 'kotak-sebaran' || widget.type === 'boxplot') {
      // Tanpa sampel mentah, sebaran tiap seri dipakai sebagai kotaknya. Tanpa
      // cadangan ini kartu tampak kosong saat pengguna memilih Kotak sebaran.
      dasar.kotak = kotakDariSeri(seri);
    }
    return dasar;
  }, [widget.chart, widget.geo, widget.gantt, widget.chartId, widget.type, ikutSeleksi, selected]);
  // Gaya pengguna selain desain & warna kartu (keduanya sudah ada di `g`).
  const gayaLain = widget.style ? { ...widget.style, desain: undefined, kartu: undefined } : undefined;
  // gayaReplika (bukan terapkanGaya): wajah katalog mewarnai tiap batang/potongan
  // lewat itemStyle, yang harus dibuang dulu supaya palet Warna Grafik berlaku.
  const pembungkus = useMemo(
    () => (adaGaya(gayaLain) ? (opsi: any) => gayaReplika(opsi, gayaLain) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(gayaLain), g]
  );
  const klik = useCallback(
    (label: string) => setSelected(selected === label ? null : label),
    [selected, setSelected]
  );
  return (
    <div className="w-full flex-1 min-h-[120px] flex flex-col">
      <WidgetChart
        chartId={chartWajib(widget)}
        varian={varian}
        gaya={g}
        data={data}
        pembungkus={pembungkus}
        onKlikKategori={ikutSeleksi ? klik : undefined}
        onKlikKosong={onKlikKosong}
      />
    </div>
  );
};

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({ widget, urutan, padat = false, preview = false, onKlikKosong }) => {
  const katalog = widget.dataKosong ? null : propsKatalogHtml(widget);
  if (katalog) return <KartuKatalogHtml widget={widget} props={katalog} />;
  // Grafik ber-chartId: renderer yang sama dengan halaman Template Chart.
  if (!widget.dataKosong && grafikKatalog(widget)) return <KartuKatalogGrafik widget={widget} onKlikKosong={onKlikKosong} />;

  if (TIPE_CHART.includes(widget.type)) {
    const seed = seedWarna(widget, urutan);
    const seri = widget.chart?.series || [];
    // Warna seri hanya diatur otomatis kalau pengguna belum memilih palet /
    // warna seri sendiri. Dua seri (mis. Target vs Realisasi) memakai pasangan
    // warna kontras yang bergiliran per kartu — dulu semuanya biru + kuning.
    // Rancangan asisten dipakai selama pengguna belum memilih chart katalog / gaya template.
    const rancangan = pakaiRancangan(widget) ? widget.rancangan : undefined;
    const warnaOtomatis =
      !rancangan?.warna?.length && !widget.style?.warnaSeri?.length && (!widget.style?.palette || widget.style.palette === 'default');
    const warnaRancangan = rancangan?.warna;
    const seriBerwarna = warnaRancangan?.length
      ? seri.map((s, i) => ({ ...s, color: warnaRancangan[i % warnaRancangan.length] }))
      : warnaOtomatis && seri.length >= 2
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
        chartId={chartPenggambarWidget(widget)}
        rancangan={rancangan}
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
