/**
 * Penyelaras tipe widget: memastikan tipe yang DIPILIH di katalog benar-benar
 * bisa dirender dari data dokumen yang tersedia.
 *
 * Latar masalah: pembuat widget (`payloadKeWidgetSpec`) hanya menghasilkan
 * kpi/bar/line/table/narasi apa pun tipe yang diminta. Akibatnya pratinjau
 * katalog (mis. Peta Sebaran Wilayah) berbeda bentuk dari kartu yang muncul di
 * kanvas (batang biasa). Modul ini menutup celah itu: tipe diminta hanya
 * diloloskan kalau bentuk datanya mendukung, dan widget dikembalikan dengan tipe
 * yang benar-benar diminta — sehingga pratinjau = kartu di kanvas.
 *
 * Satu sumber kebenaran: dipakai jalur Tambah (`ambilDataWidget`), pemeriksa
 * ketersediaan preset, dan uji.
 */
import type { WidgetSpec } from '../../types';
import { lengkapiSparklineKpi } from './kpiSparkline';

/** Tipe kartesius/serbaguna yang bisa dirender dari {xAxis, series}. */
const CHART_SERBAGUNA = ['bar', 'hbar', 'line', 'area', 'combo', 'scatter', 'bubble', 'histogram', 'boxplot'];

/** Tipe yang butuh SATU seri saja supaya tidak menyesatkan (sisanya tak terlihat). */
const CHART_SATU_SERI = ['pie', 'donut', 'treemap', 'funnel'];

/** Pola nama wilayah Indonesia untuk menilai kelayakan tipe `map`. */
const POLA_WILAYAH =
  /^(Aceh|Sumatera|Sumatra|Riau|Kepulauan Riau|Jambi|Bengkulu|Lampung|Bangka Belitung|DKI|Jakarta|Jawa|Jawa Barat|Jawa Tengah|Jawa Timur|DI Yogyakarta|Yogyakarta|Banten|Bali|Nusa Tenggara|NTB|NTT|Kalimantan|Sulawesi|Gorontalo|Maluku|Papua|Papua Barat)/i;

/** Tipe analitik (prediktif & preskriptif) yang dihitung dari satu deret angka dokumen. */
export const TIPE_ANALITIK = [
  'trend-line',
  'forecast',
  'anomaly',
  'cluster',
  'dekomposisi',
  'skenario',
  'sensitivitas',
];

/**
 * Jumlah titik data minimum per tipe analitik. WAJIB sinkron dengan syarat di
 * `services/spec/analitik.ts` — kalau tidak, chip katalog bisa bilang "tersedia"
 * padahal gambarnya cuma menampilkan pesan "data tidak cukup".
 *
 * Diekspor karena editor widget (`tipeKompatibel`) juga memakai angka yang sama.
 */
export const SYARAT_TITIK_ANALITIK: Record<string, number> = {
  'trend-line': 3,
  forecast: 4,
  anomaly: 5,
  cluster: 6,
  dekomposisi: 3,
  skenario: 2,
  sensitivitas: 1,
};

/** Nama manusiawi tiap tipe analitik untuk pesan penolakan. */
const SYARAT_LABEL: Record<string, string> = {
  'trend-line': 'Garis tren',
  forecast: 'Proyeksi',
  anomaly: 'Deteksi anomali',
  cluster: 'Pengelompokan',
  dekomposisi: 'Dekomposisi kontribusi',
  skenario: 'Analisis skenario',
  sensitivitas: 'Analisis sensitivitas',
};

export interface HasilSelaras {
  ok: boolean;
  /** Alasan singkat saat tipe tidak bisa dihormati (untuk pesan ke pengguna). */
  alasan?: string;
  /** Widget dengan tipe yang sudah diselaraskan (hanya kalau ok). */
  widget?: WidgetSpec;
}

/**
 * Donut/funnel menyembunyikan label di dalam gambarnya, jadi legenda WAJIB nyala
 * supaya kategorinya terbaca — sama seperti pratinjau di katalog.
 */
function denganLegenda(widget: WidgetSpec): WidgetSpec {
  const chart = widget.chart;
  if (!chart || (chart.xAxis?.length ?? 0) < 2) return widget;
  if (chart.showLegend === true) return widget;
  return { ...widget, chart: { ...chart, showLegend: true } };
}

/**
 * Apakah `tipe` bisa dihormati dengan data `widget`?
 * Mengembalikan widget bertipe `tipe` bila bisa, atau alasan penolakan.
 */
export function selaraskanTipe(widget: WidgetSpec | null | undefined, tipe: string): HasilSelaras {
  if (!widget) return { ok: false, alasan: 'Data dari dokumen tidak tersedia.' };

  const chart = widget.chart;
  const jumlahSeri = chart?.series?.length ?? 0;

  // Syarat data berbeda per keluarga tipe: kartesius butuh kategori+seri, tipe sebaran
  // memakai `points`, boxplot memakai `boxRaw`. Dulu semuanya diukur dengan syarat
  // kartesius, sehingga scatter/boxplot yang datanya sah ikut ditolak.
  const dataKartesius = !!chart && (chart.xAxis?.length ?? 0) > 0 && jumlahSeri > 0;
  const adaData =
    tipe === 'scatter' || tipe === 'bubble'
      ? (chart?.points?.length ?? 0) > 0
      : tipe === 'boxplot'
        ? (chart?.boxRaw?.length ?? 0) > 0 || dataKartesius
        : tipe === 'histogram'
          ? (chart?.series?.some((s) => (s.data?.length ?? 0) > 0) ?? false)
          : dataKartesius;

  // Catatan: TIDAK ada jalan pintas "tipe sudah sama → langsung ok". Jalan pintas itu
  // membuat widget dengan tipe yang tidak didukung datanya (mis. heatmap satu seri)
  // selalu lolos, sehingga kanvas menampilkan bentuk berbeda dari Template Chart.
  // Validasi harus selalu dijalankan, termasuk saat tipe yang diminta = tipe tersimpan.

  // ── Kartu non-chart ────────────────────────────────────────────────────────
  if (tipe === 'kpi') {
    return widget.kpi
      ? { ok: true, widget: lengkapiSparklineKpi({ ...widget, type: 'kpi' }) }
      : { ok: false, alasan: 'Data dokumen untuk indikator ini bukan berbentuk angka tunggal.' };
  }
  if (tipe === 'bullet-target') {
    return widget.kpi?.target != null
      ? { ok: true, widget: lengkapiSparklineKpi({ ...widget, type: 'bullet-target' }) }
      : { ok: false, alasan: 'Dokumen tidak menyebut nilai target, jadi perbandingan aktual vs target tidak bisa dibuat.' };
  }
  if (tipe === 'table') {
    if (widget.table) return { ok: true, widget: { ...widget, type: 'table' } };
    if (!adaData) return { ok: false, alasan: 'Data dokumen tidak cukup untuk disusun menjadi tabel.' };
    // Grafik bisa disajikan jujur sebagai tabel: kategori jadi baris, seri jadi kolom.
    const kolom = [
      { key: 'kategori', label: 'Kategori' },
      ...chart!.series.map((s, i) => ({ key: `s${i}`, label: s.name || `Seri ${i + 1}` })),
    ];
    const baris = chart!.xAxis.map((label, r) => {
      const isi: Record<string, string | number> = { kategori: label };
      chart!.series.forEach((s, i) => {
        isi[`s${i}`] = s.data[r] ?? 0;
      });
      return isi;
    });
    return {
      ok: true,
      widget: { ...widget, type: 'table', table: { columns: kolom as any, rows: baris as any } },
    };
  }
  if (tipe === 'narasi') {
    return widget.narasi
      ? { ok: true, widget: { ...widget, type: 'narasi' } }
      : { ok: false, alasan: 'Dokumen tidak memuat ringkasan naratif untuk indikator ini.' };
  }

  // ── Chart ─────────────────────────────────────────────────────────────────
  // Peta/gantt/heatmap/treemap menyimpan datanya di blok SENDIRI (`geo`, `gantt`,
  // `heatmap`, `treemap`), bukan di `chart`. Dulu penjaga `!chart` di bawah ini
  // menolaknya lebih dulu, sehingga tipe itu selalu dianggap "bukan berbentuk grafik"
  // padahal datanya lengkap — dan katalog jadi tidak bisa menambahkannya.
  const punyaBlokSendiri =
    (tipe === 'heatmap' && (widget.heatmap?.data?.length ?? 0) > 0) ||
    (tipe === 'map' && (widget.geo?.regions?.length ?? 0) > 0) ||
    (tipe === 'gantt' && (widget.gantt?.tasks?.length ?? 0) > 0) ||
    (tipe === 'treemap' && !!widget.treemap);

  if (!chart && !punyaBlokSendiri) {
    return { ok: false, alasan: 'Data dokumen untuk indikator ini bukan berbentuk grafik.' };
  }

  // Combo = batang + garis. Dengan satu seri ia cuma jadi batang biasa, berbeda dari
  // pratinjau combo di Template Chart, jadi ditolak (pemanggil menurunkannya ke batang).
  if (tipe === 'combo') {
    if (!adaData) return { ok: false, alasan: 'Data dokumen tidak cukup untuk digambar sebagai grafik.' };
    if (jumlahSeri < 2) {
      return {
        ok: false,
        alasan: 'Combo menggabungkan batang dan garis dari dua seri; dokumen ini hanya menyediakan satu seri. Pilih batang atau garis.',
      };
    }
    return { ok: true, widget: { ...widget, type: 'combo' } };
  }

  if (CHART_SERBAGUNA.includes(tipe)) {
    if (!adaData) return { ok: false, alasan: 'Data dokumen tidak cukup untuk digambar sebagai grafik.' };
    // `area` digambar bertumpuk di pratinjau Template Chart; samakan di kanvas supaya
    // bentuknya identik (untuk satu seri tidak mengubah tampilan sama sekali).
    if (tipe === 'area' && widget.chart && widget.chart.stacked !== true) {
      return { ok: true, widget: { ...widget, type: 'area', chart: { ...widget.chart, stacked: true } } };
    }
    return { ok: true, widget: { ...widget, type: tipe as WidgetSpec['type'] } };
  }

  if (CHART_SATU_SERI.includes(tipe)) {
    // Treemap juga bisa datang dengan blok datanya sendiri, bukan seri.
    if (tipe === 'treemap' && widget.treemap) {
      return { ok: true, widget: { ...widget, type: 'treemap' } };
    }
    if (!adaData) return { ok: false, alasan: 'Data dokumen tidak cukup untuk digambar sebagai grafik.' };
    if (jumlahSeri > 1) {
      return {
        ok: false,
        alasan: `Tipe ini hanya menampilkan satu seri, sedangkan dokumen memuat ${jumlahSeri} seri. Pilih tipe batang/garis supaya semuanya terlihat.`,
      };
    }
    // Donut/funnel menyembunyikan label di dalam gambar, jadi legenda WAJIB nyala
    // supaya kategorinya terbaca — sama seperti pratinjau di katalog.
    return { ok: true, widget: denganLegenda({ ...widget, type: tipe as WidgetSpec['type'] }) };
  }

  if (tipe === 'radar') {
    if (!adaData) return { ok: false, alasan: 'Data dokumen tidak cukup untuk digambar sebagai radar.' };
    if (jumlahSeri > 6) {
      return { ok: false, alasan: 'Radar hanya jelas untuk maksimal 6 seri.' };
    }
    return { ok: true, widget: { ...widget, type: 'radar' } };
  }

  if (tipe === 'heatmap') {
    if (widget.heatmap?.data?.length) return { ok: true, widget: { ...widget, type: 'heatmap' } };
    if (jumlahSeri < 2) {
      return { ok: false, alasan: 'Heatmap butuh minimal dua seri (dua baris) supaya polanya terlihat.' };
    }
    return { ok: true, widget: { ...widget, type: 'heatmap' } };
  }

  if (tipe === 'waterfall') {
    return chart?.waterfall?.length
      ? { ok: true, widget: { ...widget, type: 'waterfall' } }
      : {
          ok: false,
          alasan: 'Waterfall butuh angka naik/turun bertahap; dokumen ini hanya memuat nilai akhir.',
        };
  }

  if (tipe === 'sankey') {
    return chart?.links?.length
      ? { ok: true, widget: { ...widget, type: 'sankey' } }
      : { ok: false, alasan: 'Sankey butuh data aliran antar bagian; dokumen ini tidak memuatnya.' };
  }

  if (tipe === 'gantt') {
    return widget.gantt?.tasks?.length
      ? { ok: true, widget: { ...widget, type: 'gantt' } }
      : { ok: false, alasan: 'Gantt butuh tanggal mulai dan selesai tiap kegiatan; dokumen ini tidak memuatnya.' };
  }

  if (tipe === 'map') {
    if (widget.geo?.regions?.length) return { ok: true, widget: { ...widget, type: 'map' } };
    const kategori = chart?.xAxis ?? [];
    const wilayah = kategori.filter((k) => POLA_WILAYAH.test(String(k).trim())).length;
    if (kategori.length >= 3 && wilayah === kategori.length) {
      return { ok: true, widget: { ...widget, type: 'map' } };
    }
    return {
      ok: false,
      alasan: 'Peta butuh rincian per wilayah/provinsi; dokumen ini memuat angka tingkat instansi, bukan per wilayah.',
    };
  }

  if (tipe === 'gauge') {
    const nilai = chart?.series?.[0]?.data?.[0];
    const satuan = (chart?.unit || '').trim();
    if (typeof nilai === 'number' && satuan === '%' && nilai >= 0 && nilai <= 100) {
      return { ok: true, widget: { ...widget, type: 'gauge' } };
    }
    return {
      ok: false,
      alasan: 'Gauge hanya untuk angka persentase 0-100; indikator ini bukan persentase.',
    };
  }

  // ── Analitik prediktif ("apa yang mungkin terjadi?") ──────────────────────
  // Semua tipe ini menghitung dari SATU deret angka dokumen, jadi seri ganda
  // ditolak dengan alasan yang sama seperti pie/donut (sisanya akan tak terlihat).
  if (TIPE_ANALITIK.includes(tipe)) {
    if (!adaData) {
      return { ok: false, alasan: 'Data dokumen tidak cukup untuk analisis ini.' };
    }
    if (jumlahSeri > 1) {
      return {
        ok: false,
        alasan: `Analisis ini memakai satu deret angka, sedangkan dokumen memuat ${jumlahSeri} seri. Pilih tipe batang/garis supaya semuanya terlihat.`,
      };
    }
    const deret = (chart?.series?.[0]?.data ?? []) as number[];
    const terakhir = deret[deret.length - 1];
    const perlu = SYARAT_TITIK_ANALITIK[tipe] ?? 3;
    if (deret.length < perlu) {
      return {
        ok: false,
        alasan: `${SYARAT_LABEL[tipe] ?? 'Analisis ini'} butuh minimal ${perlu} titik data; dokumen ini menyediakan ${deret.length}.`,
      };
    }
    if (tipe === 'cluster' && new Set(deret).size < 3) {
      return { ok: false, alasan: 'Pengelompokan butuh minimal 3 nilai berbeda; nilai dokumen ini seragam.' };
    }
    if ((tipe === 'dekomposisi' || tipe === 'skenario' || tipe === 'sensitivitas') && !terakhir) {
      return { ok: false, alasan: 'Nilai terakhir dokumen nol, sehingga hitungan simulasi/andil tidak bermakna.' };
    }
    return { ok: true, widget: { ...widget, type: tipe as WidgetSpec['type'] } };
  }

  return { ok: false, alasan: `Tipe ${tipe} tidak bisa dibuat dari data dokumen ini.` };
}

/** Tipe pertama dari daftar yang benar-benar bisa dihormati (untuk memilih chip awal). */
export function tipePertamaYangBisa(
  widget: WidgetSpec | null | undefined,
  daftarTipe: string[]
): { tipe: string | null; status: Array<{ tipe: string; ok: boolean; alasan?: string }> } {
  const status = daftarTipe.map((t) => {
    const h = selaraskanTipe(widget, t);
    return { tipe: t, ok: h.ok, alasan: h.alasan };
  });
  const pertama = status.find((s) => s.ok);
  return { tipe: pertama ? pertama.tipe : null, status };
}

/** Perubahan tipe yang dilakukan penyelaras, untuk dilaporkan jujur ke pengguna. */
export interface CatatanSelaras {
  id: string;
  judul: string;
  dari: string;
  ke: string | null;
  alasan: string;
}

/**
 * SELARASKAN SATU DAFTAR WIDGET dari sumber mana pun (copilot Jalur A/Jalur B, snapshot demo).
 *
 * Kenapa perlu: jalur copilot menerima `type` apa adanya dari model dan hanya memvalidasi
 * BENTUKNYA (Zod), tanpa memeriksa apakah tipe itu bisa digambar dari datanya. Akibatnya
 * kanvas bisa memuat heatmap satu baris, peta tanpa rincian wilayah, atau pie multi-seri —
 * bentuknya berbeda dari pratinjau tipe yang sama di Template Chart. Katalog sudah punya
 * gerbang ini (`selaraskanTipe`); fungsi ini menyamakannya untuk semua sumber.
 *
 * Tipe yang tidak bisa dihormati DITURUNKAN (tidak dibuang) ke tipe paling setia yang bisa
 * digambar dari data yang ada, dan alasannya dikembalikan di `catatan` — bukan diam-diam
 * berubah, dan bukan pula kartu hilang.
 */
export function selaraskanDaftarWidget(widgets: WidgetSpec[]): {
  widgets: WidgetSpec[];
  catatan: CatatanSelaras[];
} {
  const hasil: WidgetSpec[] = [];
  const catatan: CatatanSelaras[] = [];

  for (const w of widgets) {
    const selaras = selaraskanTipe(w, w.type);
    if (selaras.ok && selaras.widget) {
      hasil.push(selaras.widget);
      continue;
    }

    // Pilih tipe pengganti paling setia menurut bentuk data yang benar-benar ada.
    const kandidat = [
      ...(w.kpi ? ['kpi'] : []),
      ...(w.chart && (w.chart.xAxis?.length ?? 0) > 0 && (w.chart.series?.length ?? 0) > 0 ? ['bar'] : []),
      ...(w.chart?.series?.length === 1 && (w.chart?.series?.[0]?.data?.length ?? 0) >= 3 ? ['line'] : []),
      ...(w.table ? ['table'] : []),
      ...(w.narasi ? ['narasi'] : []),
    ];
    let pengganti: WidgetSpec | null = null;
    let tipeBaru: string | null = null;
    for (const t of kandidat) {
      const coba = selaraskanTipe(w, t);
      if (coba.ok && coba.widget) {
        pengganti = coba.widget;
        tipeBaru = t;
        break;
      }
    }

    const alasan = selaras.alasan || `Tipe ${w.type} tidak bisa digambar dari data widget ini.`;
    if (!pengganti) {
      // Tidak ada bentuk yang jujur untuk data ini → kartu dibuang, alasannya dilaporkan.
      catatan.push({ id: w.id, judul: w.title || w.id, dari: w.type, ke: null, alasan });
      continue;
    }
    catatan.push({ id: w.id, judul: w.title || w.id, dari: w.type, ke: tipeBaru, alasan });
    hasil.push(pengganti);
  }

  return { widgets: hasil, catatan };
}
