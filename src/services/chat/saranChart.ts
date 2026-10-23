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

/**
 * Susun daftar saran tampilan untuk satu indikator.
 * `indikator` kosong → memakai sebutan umum supaya kalimatnya tetap masuk akal.
 */
export function susunSaranChart(indikator: string): SaranChart[] {
  const topik = rapikan(indikator) || 'indikator utama instansi';
  return PILIHAN.map((p) => ({
    id: `saran-${p.tipe}`,
    tipe: p.tipe,
    judul: `${topik} ${p.akhiran}`,
    alasan: p.alasan,
    kapan: p.kapan,
    indikator: topik,
  }));
}

/**
 * Widget contoh untuk PRATINJAU saja — bentuknya sama dengan kartu kanvas,
 * angkanya jelas contoh dan tidak pernah disimpan ke dashboard.
 */
export function widgetPratinjauSaran(saran: SaranChart): WidgetSpec {
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
