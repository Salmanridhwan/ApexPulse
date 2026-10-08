import { WidgetSpec, WidgetType } from '../../types';

/**
 * Data contoh untuk PRATINJAU BENTUK visualisasi di katalog "Tambah Widget".
 *
 * Aturan yang penting: angka di sini HANYA untuk memperlihatkan bagaimana tipe
 * grafik dirender (sumbu, legenda, satuan, bentuk). Angka ini TIDAK pernah ikut
 * tersimpan — ketika pengguna menekan "+ Tambah", angkanya diambil dari dokumen
 * resmi lewat `/api/widgets/ambil-data`. Karena itu kartu katalog wajib memberi
 * label "angka contoh", dan `citations` sengaja dikosongkan supaya tidak ada
 * dokumen yang diklaim sebagai sumber.
 */

/** Label bulan netral (bukan angka dokumen mana pun). */
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Deret contoh: pola naik-turun wajar, jelas bukan angka laporan. */
const DERET_A = [42, 48, 45, 52, 58, 55, 62, 68, 64, 72, 76, 80];
const DERET_B = [30, 34, 33, 38, 41, 44, 43, 47, 50, 52, 55, 58];

const GRID = { x: 0, y: 0, w: 4, h: 3 };

const dasar = (type: WidgetType, extra: Partial<WidgetSpec>): WidgetSpec => ({
  id: `pratinjau-${type}`,
  type,
  title: 'Contoh indikator',
  subtitle: 'Pratinjau bentuk',
  category: 'Operasional',
  confidence: 'inferensi AI',
  grid: { ...GRID },
  citations: [],
  lastUpdated: new Date().toISOString(),
  ...extra,
});

/** Dua seri kartesius (untuk combo/dual-axis, area bertumpuk, dsb). */
const chartDuaSeri = (unit = 'Rp miliar') => ({
  xAxis: BULAN,
  series: [
    { name: 'Aktual', data: DERET_A },
    { name: 'Target', data: DERET_B, kind: 'line' as const, yAxisIndex: 1 as const },
  ],
  unit,
  showLegend: true,
});

/** Satu seri kartesius sederhana. */
const chartSatuSeri = (unit = 'Rp miliar') => ({
  xAxis: BULAN,
  series: [{ name: 'Nilai', data: DERET_A }],
  unit,
  showLegend: false,
});

const PETA_CONTOH = [
  'Jawa Barat', 'Jawa Tengah', 'Jawa Timur', 'Jakarta Raya', 'Banten', 'Bali',
  'Sumatera Utara', 'Sumatera Barat', 'Sumatera Selatan', 'Riau', 'Aceh', 'Lampung',
  'Kalimantan Timur', 'Kalimantan Selatan', 'Kalimantan Barat', 'Sulawesi Selatan',
  'Sulawesi Utara', 'Papua', 'Nusa Tenggara Barat', 'Yogyakarta',
].map((name, i) => ({ name, value: 20 + ((i * 7) % 80) }));

/**
 * Spesifikasi contoh per tipe visualisasi. Semua 23 tipe di `TIPE_VISUALISASI`
 * harus ada di sini supaya kartu katalog tidak pernah menampilkan kartu kosong.
 */
function bangun(type: WidgetType): WidgetSpec {
  switch (type) {
    case 'kpi':
      return dasar(type, {
        title: 'Contoh KPI',
        kpi: {
          value: 82.4,
          unit: '%',
          delta: 6.2,
          deltaLabel: '+6,2% YoY',
          target: 90,
          targetLabel: 'Target RKAP',
          sparkline: DERET_A,
        },
      });

    case 'bullet-target':
      return dasar(type, {
        title: 'Aktual vs Target',
        kpi: {
          value: 76,
          unit: '%',
          delta: 4.1,
          deltaLabel: 'Capaian target',
          target: 90,
          targetLabel: 'Target',
          sparkline: DERET_A,
        },
      });

    case 'gauge':
      return dasar(type, {
        title: 'Capaian terhadap target',
        chart: {
          xAxis: ['Capaian'],
          series: [{ name: 'Capaian', data: [78] }],
          unit: '%',
          min: 0,
          max: 100,
          showLegend: false,
        },
      });

    case 'table':
      return dasar(type, {
        title: 'Rekap contoh',
        table: {
          columns: [
            { key: 'uraian', label: 'Uraian' },
            { key: 'aktual', label: 'Aktual', format: 'number' },
            { key: 'target', label: 'Target', format: 'number' },
          ],
          rows: [
            { uraian: 'Indikator A', aktual: 82.4, target: 90 },
            { uraian: 'Indikator B', aktual: 64.1, target: 70 },
            { uraian: 'Indikator C', aktual: 48.7, target: 55 },
            { uraian: 'Indikator D', aktual: 91.2, target: 88 },
          ],
        },
      });

    case 'narasi':
      return dasar(type, {
        title: 'Narasi contoh',
        narasi: {
          text:
            'Ini contoh bentuk kartu narasi eksekutif. Pada widget sungguhan, teks ini ' +
            'diisi hasil sintesis dokumen resmi instansi dan disertai sitasi halaman.',
          bulletPoints: ['Poin temuan pertama', 'Poin temuan kedua', 'Poin temuan ketiga'],
        },
      });

    case 'line':
    case 'bar':
    case 'hbar':
    case 'pie':
    case 'donut':
    case 'funnel':
    case 'treemap':
      if (type === 'treemap') {
        return dasar(type, {
          title: 'Komposisi contoh',
          treemap: {
            name: 'Total',
            children: [
              { name: 'Segmen A', value: 45 },
              { name: 'Segmen B', value: 25 },
              { name: 'Segmen C', value: 18 },
              { name: 'Segmen D', value: 12 },
            ],
          },
        });
      }
      if (type === 'pie' || type === 'donut') {
        return dasar(type, {
          title: 'Komposisi contoh',
          chart: {
            xAxis: ['Segmen A', 'Segmen B', 'Segmen C', 'Segmen D'],
            series: [{ name: 'Porsi', data: [45, 25, 18, 12] }],
            unit: '%',
            showLegend: true,
          },
        });
      }
      return dasar(type, { title: 'Tren contoh', chart: chartSatuSeri() });

    case 'area':
      return dasar(type, { title: 'Tren contoh', chart: { ...chartSatuSeri(), stacked: true } });

    case 'combo':
      return dasar(type, { title: 'Dua metrik contoh', chart: chartDuaSeri() });

    case 'waterfall':
      return dasar(type, {
        title: 'Perubahan bertahap',
        chart: {
          xAxis: ['Awal', 'Naik A', 'Naik B', 'Turun C', 'Akhir'],
          series: [{ name: 'Nilai', data: [40, 12, 8, -14, 46] }],
          waterfall: [
            { name: 'Awal', value: 40 },
            { name: 'Naik A', value: 12 },
            { name: 'Naik B', value: 8 },
            { name: 'Turun C', value: -14 },
            { name: 'Akhir', value: 46 },
          ],
          unit: 'Rp miliar',
          showLegend: false,
        },
      });

    case 'sankey':
      return dasar(type, {
        title: 'Aliran contoh',
        chart: {
          xAxis: [],
          series: [],
          unit: 'unit',
          links: [
            { source: 'Sumber A', target: 'Tahap 1', value: 60 },
            { source: 'Sumber B', target: 'Tahap 1', value: 40 },
            { source: 'Tahap 1', target: 'Tahap 2', value: 70 },
            { source: 'Tahap 1', target: 'Susut', value: 30 },
          ],
        },
      });

    case 'scatter':
      return dasar(type, {
        title: 'Sebaran contoh',
        chart: {
          xAxis: [],
          series: [],
          points: Array.from({ length: 24 }, (_, i) => ({
            x: 10 + ((i * 13) % 80),
            y: 15 + ((i * 29) % 70),
          })),
          unit: 'unit',
        },
      });

    case 'bubble':
      return dasar(type, {
        title: 'Sebaran berbobot',
        chart: {
          xAxis: [],
          series: [],
          points: Array.from({ length: 18 }, (_, i) => ({
            x: 10 + ((i * 17) % 80),
            y: 20 + ((i * 23) % 60),
            size: 6 + ((i * 11) % 30),
          })),
          unit: 'unit',
        },
      });

    case 'histogram':
      return dasar(type, {
        title: 'Distribusi contoh',
        chart: {
          xAxis: BULAN,
          series: [{ name: 'Frekuensi', data: DERET_A.concat(DERET_B) }],
          unit: 'unit',
        },
      });

    case 'boxplot':
      return dasar(type, {
        title: 'Sebaran per kelompok',
        chart: {
          xAxis: ['Kelompok A', 'Kelompok B', 'Kelompok C'],
          series: [],
          boxRaw: [
            [12, 30, 44, 58, 72],
            [18, 34, 50, 63, 80],
            [10, 26, 40, 55, 68],
          ],
          unit: 'unit',
        },
      });

    case 'heatmap':
      return dasar(type, {
        title: 'Pola per periode',
        heatmap: {
          rows: ['Unit A', 'Unit B', 'Unit C', 'Unit D'],
          columns: ['TW1', 'TW2', 'TW3', 'TW4'],
          data: [
            [62, 70, 68, 78],
            [50, 58, 61, 66],
            [44, 47, 55, 60],
            [70, 72, 69, 80],
          ],
          unit: 'indeks',
        },
      });

    case 'radar':
      return dasar(type, {
        title: 'Profil multi-indikator',
        chart: {
          xAxis: [],
          series: [],
          radar: {
            indicators: [
              { name: 'Keuangan', max: 100 },
              { name: 'Operasional', max: 100 },
              { name: 'Pelayanan', max: 100 },
              { name: 'SDM', max: 100 },
              { name: 'Kepatuhan', max: 100 },
            ],
            series: [
              { name: 'Aktual', values: [82, 74, 68, 61, 88] },
              { name: 'Target', values: [90, 80, 75, 70, 90] },
            ],
          },
          unit: 'indeks',
          showLegend: true,
        },
      });

    case 'map':
      return dasar(type, {
        title: 'Sebaran per wilayah',
        geo: { mapName: 'indonesia', regions: PETA_CONTOH, unit: 'unit' },
      });

    case 'gantt':
      return dasar(type, {
        title: 'Jadwal contoh',
        gantt: {
          tasks: [
            { name: 'Perencanaan', start: '2026-01-05', end: '2026-02-10', progress: 100 },
            { name: 'Pengadaan', start: '2026-02-11', end: '2026-04-20', progress: 70 },
            { name: 'Pemasangan', start: '2026-04-21', end: '2026-07-15', progress: 35 },
            { name: 'Uji fungsi', start: '2026-07-16', end: '2026-08-30', progress: 0 },
          ],
        },
      });

    // ── Analitik prediktif & preskriptif ────────────────────────────────────
    // Angka contoh di bawah ini SENGAJA dibentuk supaya ciri khas tipe terlihat:
    // tren naik (garis tren/proyeksi/skenario), satu lonjakan (anomali), tiga
    // gugus nilai (klaster), dan naik-turun (dekomposisi andil).
    case 'trend-line':
      return dasar(type, {
        title: 'Contoh tren naik',
        chart: { xAxis: BULAN, series: [{ name: 'Nilai', data: [41, 52, 44, 58, 49, 63, 55, 70, 60, 74, 66, 84] }], unit: 'Rp miliar', showLegend: true },
      });
    case 'forecast':
      return dasar(type, {
        title: 'Contoh proyeksi 3 periode',
        chart: { xAxis: BULAN, series: [{ name: 'Nilai', data: [41, 52, 44, 58, 49, 63, 55, 70, 60, 74, 66, 84] }], unit: 'Rp miliar', showLegend: false },
      });
    case 'anomaly':
      return dasar(type, {
        title: 'Contoh satu nilai menyimpang',
        chart: { xAxis: BULAN, series: [{ name: 'Nilai', data: [50, 52, 51, 53, 50, 54, 52, 51, 53, 120, 52, 50] }], unit: 'Rp miliar', showLegend: false },
      });
    case 'cluster':
      return dasar(type, {
        title: 'Contoh pengelompokan nilai',
        chart: { xAxis: BULAN, series: [{ name: 'Nilai', data: [12, 14, 11, 15, 60, 62, 58, 61, 110, 108, 115, 112] }], unit: 'Rp miliar', showLegend: true },
      });
    case 'dekomposisi':
      return dasar(type, {
        title: 'Contoh andil perubahan',
        chart: { xAxis: BULAN, series: [{ name: 'Nilai', data: [100, 118, 112, 130, 126, 140, 135, 148, 142, 156, 150, 164] }], unit: 'Rp miliar', showLegend: false },
      });
    case 'skenario':
      return dasar(type, {
        title: 'Contoh tiga skenario',
        chart: { xAxis: BULAN, series: [{ name: 'Nilai', data: [41, 44, 47, 49, 54, 58, 61, 66, 70, 73, 79, 84] }], unit: 'Rp miliar', showLegend: false },
      });
    case 'sensitivitas':
      return dasar(type, {
        title: 'Contoh sensitivitas',
        chart: { xAxis: BULAN, series: [{ name: 'Nilai', data: [41, 44, 47, 49, 54, 58, 61, 66, 70, 73, 79, 84] }], unit: 'Rp miliar', showLegend: false },
      });

    default:
      return dasar(type, { title: 'Contoh indikator', chart: chartSatuSeri() });
  }
}

const cache = new Map<WidgetType, WidgetSpec>();

/** Spesifikasi contoh untuk satu tipe visualisasi (di-cache, dibangun sekali). */
export function specPratinjau(type: WidgetType): WidgetSpec {
  const ada = cache.get(type);
  if (ada) return ada;
  const dibuat = bangun(type);
  cache.set(type, dibuat);
  return dibuat;
}
