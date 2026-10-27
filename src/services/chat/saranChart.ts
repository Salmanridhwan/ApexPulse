import type { SaranChart, WidgetSpec } from '../../types';

/**
 * SARAN TAMPILAN CHART — dipakai asisten saat pengguna bertanya "chart apa yang
 * cocok untuk indikator ini".
 *
 * MURNI (tanpa I/O) supaya bisa diuji tanpa server dan dipakai dua sisi:
 * server menyusun daftar saran, klien menggambar pratinjaunya.
 *
 * Aturan penting: pratinjau HANYA memperlihatkan bentuk tampilan. Angka di
 * pratinjau adalah contoh; angka sungguhan baru diambil dari dokumen instansi
 * saat pengguna menekan "Oke, tambahkan ke kanvas".
 */

/** Bulan netral untuk deret contoh pratinjau. */
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun'];

/** Kata kunci permintaan saran tampilan (bukan permintaan membuat dashboard). */
const POLA_PERMINTAAN: RegExp[] = [
  /\b(?:rekomendasi|rekomendasikan|sarankan|saran|usulkan|usul|pilihan)\b[^.?!]*\b(?:chart|grafik|visualisasi|diagram|tampilan)\b/i,
  /\b(?:chart|grafik|visualisasi|diagram)\b[^.?!]*\b(?:apa|apakah|mana)\b[^.?!]*\b(?:cocok|bagus|tepat|terbaik|pas|pakai|gunakan|pilih)\b/i,
  /\b(?:chart|grafik|visualisasi)\b[^.?!]*\b(?:rekomendasi|saran|pilihan|alternatif)\b/i,
];

/** Apakah pengguna meminta rekomendasi tampilan chart? */
export function adalahPermintaanSaran(prompt: unknown): boolean {
  const t = String(prompt || '').trim();
  if (!t) return false;
  return POLA_PERMINTAAN.some((p) => p.test(t));
}

/** Buang kata pengantar & tanda baca di ujung teks. */
function rapikan(teks: string): string {
  return teks
    .replace(/^[\s"'“”‘’(\[]+/, '')
    .replace(/[\s"'“”‘’)\].!,?;:]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Indikator/topik yang disebut pengguna, mis. "rekomendasikan chart untuk
 * pendapatan air" → "pendapatan air". Kosong bila tidak disebut.
 */
export function indikatorDariPrompt(prompt: unknown): string {
  const t = String(prompt || '').trim();
  if (!t) return '';
  const pola = [
    /\b(?:untuk|tentang|mengenai|soal|perihal|indikator)\s+(.+)$/i,
    /\b(?:chart|grafik|visualisasi|diagram)\s+(?:yang\s+)?(?:cocok|bagus|tepat|pas)\s+(?:untuk\s+)?(.+)$/i,
  ];
  for (const p of pola) {
    const m = t.match(p);
    if (m && m[1]) {
      const bersih = rapikan(m[1]);
      // Buang ekor instruksi ("... lalu tampilkan", "... dong").
      const potong = rapikan(bersih.split(/\b(?:lalu|kemudian|dong|ya|nih|sih|please)\b/i)[0]);
      if (potong.length >= 3) return potong.slice(0, 80);
    }
  }
  return '';
}

interface PilihanTipe {
  tipe: SaranChart['tipe'];
  akhiran: string;
  alasan: string;
  kapan: string;
}

/** Lima bentuk tampilan yang paling sering dipakai laporan BUMD. */
const PILIHAN: PilihanTipe[] = [
  {
    tipe: 'bar',
    akhiran: 'per kategori',
    alasan: 'Membandingkan angka antar kategori, unit kerja, atau periode sekaligus.',
    kapan: 'Cocok kalau yang ingin dilihat adalah mana yang paling tinggi dan paling rendah.',
  },
  {
    tipe: 'line',
    akhiran: 'dari waktu ke waktu',
    alasan: 'Memperlihatkan arah naik-turun dalam beberapa periode.',
    kapan: 'Cocok kalau yang penting adalah tren, bukan nilai satu titik.',
  },
  {
    tipe: 'donut',
    akhiran: 'menurut komposisi',
    alasan: 'Memperlihatkan porsi tiap bagian terhadap keseluruhan.',
    kapan: 'Cocok kalau totalnya 100% dan Anda ingin melihat bagian terbesar.',
  },
  {
    tipe: 'kpi',
    akhiran: 'angka utama',
    alasan: 'Menonjolkan satu angka penting beserta perubahannya.',
    kapan: 'Cocok untuk ringkasan pimpinan yang hanya butuh satu angka kunci.',
  },
  {
    tipe: 'table',
    akhiran: 'rincian angka',
    alasan: 'Menampilkan banyak angka sekaligus dengan satuan yang jelas.',
    kapan: 'Cocok kalau audiens perlu melihat angka detailnya.',
  },
];

/** Apakah label sumbu-x berupa deret waktu (bulan/triwulan/tahun)? */
function deretWaktu(xAxis: string[]): boolean {
  const BULAN =
    /^(jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)/i;
  const cocok = xAxis.filter(
    (x) => BULAN.test(x) || /^\d{4}$/.test(x) || /\b(triwulan|kuartal|q[1-4]|semester)\b/i.test(x)
  );
  return xAxis.length > 0 && cocok.length >= Math.ceil(xAxis.length * 0.6);
}

/**
 * Susun daftar saran tampilan untuk satu indikator.
 * `indikator` kosong → memakai sebutan umum supaya kalimatnya tetap masuk akal.
 *
 * Bila `data` diisi (hasil pengambilan dari dokumen instansi), setiap saran
 * membawa pratinjau berisi ANGKA NYATA — bukan contoh bentuk tampilan.
 */
export function susunSaranChart(indikator: string, data?: DataSaran | null): SaranChart[] {
  const topik = rapikan(indikator) || 'indikator utama instansi';
  // Donut hanya masuk akal untuk komposisi. Kalau datanya deret waktu, menawarkan
  // "menurut komposisi" justru menyesatkan — angka benar, bentuknya salah.
  const pilihan = data && deretWaktu(data.xAxis) ? PILIHAN.filter((p) => p.tipe !== 'donut') : PILIHAN;
  return pilihan.map((p) => {
    const saran: SaranChart = {
      id: `saran-${p.tipe}`,
      tipe: p.tipe,
      judul: `${topik} ${p.akhiran}`,
      alasan: p.alasan,
      kapan: p.kapan,
      indikator: topik,
    };
    if (data) {
      saran.pratinjau = widgetPratinjauDariData(saran, data);
      saran.sumber = data.sumber;
    }
    return saran;
  });
}

/** Deret angka nyata yang dipakai bersama oleh semua bentuk pratinjau. */
export interface DataSaran {
  xAxis: string[];
  series: Array<{ name: string; data: number[] }>;
  unit?: string;
  /** Nama dokumen + halaman asal angka. */
  sumber?: string;
}

/** Ringkas sumber dari sitasi widget, mis. "Laporan Tahunan PAM JAYA 2024 hlm. 12". */
function sumberDari(w: any): string | undefined {
  const c = Array.isArray(w?.citations) ? w.citations[0] : undefined;
  if (!c) return undefined;
  const nama = String(c.docName || '').trim();
  const halaman = Number(c.page) || 0;
  if (!nama) return undefined;
  return halaman > 0 ? `${nama} hlm. ${halaman}` : nama;
}

const keAngka = (v: any): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Ambil deret angka dari widget hasil RAG (grafik, tabel, atau KPI tunggal).
 * Mengembalikan null kalau tidak ada angka yang bisa dipakai — pemanggil wajib
 * jujur bahwa dokumennya belum memuat angka tersebut.
 */
export function dataDariWidget(w: any): DataSaran | null {
  if (!w) return null;

  const xAxis: string[] = Array.isArray(w.chart?.xAxis) ? w.chart.xAxis.map((x: any) => String(x)) : [];
  const series = Array.isArray(w.chart?.series)
    ? w.chart.series
        .filter((s: any) => Array.isArray(s?.data) && s.data.length > 0)
        .map((s: any) => ({ name: String(s?.name || w.title || 'Nilai'), data: s.data.map(keAngka) }))
    : [];
  if (xAxis.length > 0 && series.length > 0) {
    return { xAxis, series, unit: w.chart?.unit ? String(w.chart.unit) : undefined, sumber: sumberDari(w) };
  }

  // Tabel: kolom teks pertama jadi label, kolom angka pertama jadi nilai.
  const rows = Array.isArray(w.table?.rows) ? w.table.rows : [];
  if (rows.length > 0) {
    const kunci = Object.keys(rows[0] || {});
    const kolomTeks = kunci.find((k) => typeof rows[0][k] === 'string');
    const kolomAngka = kunci.find((k) => typeof rows[0][k] === 'number');
    if (kolomTeks && kolomAngka) {
      return {
        xAxis: rows.map((r: any) => String(r[kolomTeks])),
        series: [{ name: String(w.table?.columns?.find((c: any) => c.key === kolomAngka)?.label || 'Nilai'), data: rows.map((r: any) => keAngka(r[kolomAngka])) }],
        unit: w.chart?.unit ? String(w.chart.unit) : undefined,
        sumber: sumberDari(w),
      };
    }
  }

  // KPI tunggal: satu titik data, tetap boleh ditampilkan apa adanya.
  if (w.kpi && w.kpi.value !== undefined && w.kpi.value !== null && w.kpi.value !== '') {
    const nilai = keAngka(w.kpi.value);
    if (Number.isFinite(nilai)) {
      return {
        xAxis: ['Nilai'],
        series: [{ name: String(w.title || 'Nilai'), data: [nilai] }],
        unit: w.kpi.unit ? String(w.kpi.unit) : undefined,
        sumber: sumberDari(w),
      };
    }
  }

  return null;
}

/** Bangun pratinjau satu bentuk tampilan dari deret angka nyata. */
export function widgetPratinjauDariData(saran: SaranChart, data: DataSaran): WidgetSpec {
  const seri = data.series[0];
  const dasar: WidgetSpec = {
    id: `pratinjau-${saran.tipe}`,
    type: saran.tipe,
    title: saran.judul,
    subtitle: data.sumber ? `Angka dokumen: ${data.sumber}` : 'Angka dari dokumen instansi',
    category: 'Operasional',
    confidence: 'sumber',
    grid: { x: 0, y: 0, w: 12, h: 4 },
    citations: [],
    lastUpdated: new Date().toISOString(),
  };

  if (saran.tipe === 'kpi') {
    const akhir = seri.data[seri.data.length - 1];
    const sebelumnya = seri.data.length > 1 ? seri.data[seri.data.length - 2] : undefined;
    const delta =
      sebelumnya !== undefined && sebelumnya !== 0 ? ((akhir - sebelumnya) / Math.abs(sebelumnya)) * 100 : undefined;
    const labelSebelum = data.xAxis[data.xAxis.length - 2];
    return {
      ...dasar,
      grid: { x: 0, y: 0, w: 4, h: 3 },
      kpi: {
        value: akhir,
        unit: data.unit,
        delta: delta !== undefined ? Number(delta.toFixed(1)) : undefined,
        deltaLabel:
          delta !== undefined
            ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1).replace('.', ',')}%${labelSebelum ? ` vs ${labelSebelum}` : ''}`
            : undefined,
        sparkline: seri.data.length > 1 ? seri.data : undefined,
      },
    };
  }

  if (saran.tipe === 'table') {
    return {
      ...dasar,
      table: {
        columns: [
          { key: 'kategori', label: data.xAxis.length && data.xAxis.length === seri.data.length ? 'Kategori' : 'Periode' },
          { key: 'nilai', label: seri.name || 'Nilai', format: 'number' },
        ],
        rows: data.xAxis.map((label, i) => ({ kategori: label, nilai: seri.data[i] ?? null })),
      },
    };
  }

  if (saran.tipe === 'donut') {
    return {
      ...dasar,
      chart: { xAxis: data.xAxis, series: data.series, unit: data.unit, showLegend: true },
    };
  }

  return {
    ...dasar,
    chart: { xAxis: data.xAxis, series: data.series, unit: data.unit, showLegend: data.series.length > 1 },
  };
}

/**
 * Widget contoh untuk PRATINJAU saja — HANYA dipakai kalau angka dokumen tidak
 * tersedia. Bentuknya sama dengan kartu kanvas, angkanya jelas contoh dan tidak
 * pernah disimpan ke dashboard.
 */
export function widgetPratinjauSaran(saran: SaranChart): WidgetSpec {
  // Pratinjau berangka nyata dari dokumen selalu diutamakan.
  if (saran.pratinjau) return saran.pratinjau;

  const dasar: WidgetSpec = {
    id: `pratinjau-${saran.tipe}`,
    type: saran.tipe,
    title: saran.judul,
    subtitle: 'Contoh bentuk tampilan — angka asli diambil dari dokumen saat ditambahkan',
    category: 'Operasional',
    confidence: 'inferensi AI',
    grid: { x: 0, y: 0, w: 12, h: 4 },
    citations: [],
    lastUpdated: new Date().toISOString(),
  };

  if (saran.tipe === 'kpi') {
    return {
      ...dasar,
      grid: { x: 0, y: 0, w: 4, h: 3 },
      kpi: {
        value: '1.250',
        unit: 'Satuan',
        delta: 4.2,
        deltaLabel: '+4,2% vs periode lalu',
        sparkline: [980, 1010, 1060, 1120, 1190, 1250],
      },
    };
  }

  if (saran.tipe === 'table') {
    return {
      ...dasar,
      table: {
        columns: [
          { key: 'kategori', label: 'Kategori' },
          { key: 'nilai', label: 'Nilai', format: 'number' },
          { key: 'satuan', label: 'Satuan' },
        ],
        rows: [
          { kategori: 'Kategori A', nilai: 420, satuan: 'Satuan' },
          { kategori: 'Kategori B', nilai: 365, satuan: 'Satuan' },
          { kategori: 'Kategori C', nilai: 280, satuan: 'Satuan' },
          { kategori: 'Kategori D', nilai: 185, satuan: 'Satuan' },
        ],
      },
    };
  }

  if (saran.tipe === 'donut') {
    return {
      ...dasar,
      chart: {
        xAxis: ['Bagian A', 'Bagian B', 'Bagian C', 'Bagian D'],
        series: [{ name: saran.indikator, data: [42, 28, 19, 11] }],
        unit: '%',
        showLegend: true,
      },
    };
  }

  // bar / line / area: deret enam periode.
  return {
    ...dasar,
    chart: {
      xAxis: BULAN,
      series: [{ name: saran.indikator, data: [86, 91, 88, 95, 102, 108] }],
      unit: 'Satuan',
      showLegend: false,
    },
  };
}
