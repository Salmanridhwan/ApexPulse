import type { BumdSector, WidgetSpec } from '../../types';
import type { DashboardTemplate } from './dashboardTemplates';

/**
 * ISI TEMPLATE DARI RAG — memakai SUSUNAN kartu template, tetapi ANGKANYA diambil
 * dari dokumen resmi instansi lewat layanan RAG.
 *
 * Aturan yang tidak boleh dilanggar: TIDAK ADA angka contoh. Untuk setiap kartu,
 * angka diambil dari dokumen. Kalau dokumen instansi tidak memuat indikator itu,
 * kartu TIDAK diisi angka karangan — kartu ditandai `dataKosong` dan kanvas
 * menampilkan penanda "belum ada di dokumen" beserta alasannya.
 */

/**
 * Jatah waktu SATU kartu (ms). Kartu yang menggantung dipotong di sini supaya
 * tidak menghabiskan anggaran kartu lain.
 */
const BATAS_KARTU_MS = 60_000;
/** Jatah percobaan ulang satu kartu setelah percobaan pertama habis waktu/gagal. */
const BATAS_ULANG_KARTU_MS = 30_000;

/** Bagian klien RAG yang dibutuhkan pengisi template (cukup satu metode). */
export interface RagPengambilData {
  ambilDataWidget(
    query: string,
    sector: BumdSector,
    tipeTarget: string,
    instansi?: string,
    kbId?: string,
    opsi?: { lemparSaatGagal?: boolean; batasMs?: number; turunkanTipe?: boolean }
  ): Promise<{ data: any | null; judul?: string; deskripsi?: string; alasan?: string } | null>;
}

export interface OpsiIsiTemplate {
  sector: BumdSector;
  /** Nama instansi aktif — diteruskan agar dokumen instansi lain diabaikan. */
  instansi?: string;
  /** Knowledge base milik instansi aktif. */
  kbId?: string;
  rag: RagPengambilData;
  /** Jumlah panggilan RAG serentak (default 8). */
  konkurensi?: number;
  /**
   * Anggaran waktu total (ms) untuk seluruh pengisian. Lewat dari ini, kartu
   * yang belum sempat diproses ditandai kosong — bukan menggantung sampai
   * proxy memutus koneksi (gejala "Failed to fetch" di browser).
   */
  batasMs?: number;
  /**
   * Jumlah putaran maksimal. Putaran 1 mengisi semua kartu; putaran berikutnya
   * mengulang HANYA kartu yang gagal karena layanan (429/timeout) sampai terisi.
   * Kartu yang dokumennya memang tidak memuat indikator itu tidak diulang.
   */
  putaranMaks?: number;
  /** Dipanggil setiap satu kartu selesai — untuk progres di UI. */
  onProgres?: (info: {
    selesai: number;
    total: number;
    judul: string;
    terisi: boolean;
    /** Jumlah kartu yang sudah berisi angka (untuk progres "X dari N terisi"). */
    terisiTotal?: number;
  }) => void;
}

export interface HasilIsiTemplate {
  widgets: WidgetSpec[];
  terisi: number;
  kosong: number;
  catatan: string[];
  /** true bila anggaran waktu habis sebelum semua kartu selesai. */
  kedaluwarsa: boolean;
}

/**
 * Kueri per kartu: minta indikator persis kartu itu, jujur bila tidak ada.
 *
 * `longgar` dipakai sebagai percobaan terakhir: TANPA subjudul dan TANPA kalimat
 * "kalau tidak ada, katakan tidak ada". Uji nyata: "Komposisi Biaya Operasional"
 * (subjudul "STRUKTUR BEBAN USAHA") dijawab "tidak ada di dokumen" pada pertanyaan
 * ketat, padahal angka beban usaha/beban umum ada di Laporan Keuangan Audited —
 * dan berhasil saat ditanya lebih longgar.
 */
const KAMUS_ISTILAH: Array<{ pola: RegExp; istilah: string }> = [
  {
    pola: /biaya\s+operasional|beban\s+operasional|struktur\s+beban/i,
    istilah:
      'komposisi beban usaha (beban usaha, beban umum dan administrasi, beban non usaha, beban pajak penghasilan) pada laporan keuangan audited',
  },
  {
    pola: /efisiensi\s+penagihan|collection\s+efficiency/i,
    istilah: 'perputaran piutang dan tingkat penagihan',
  },
  {
    pola: /gangguan|pengaduan\s+teknis/i,
    istilah: 'jumlah gangguan dan waktu tanggap (SLA) per jenis gangguan',
  },
  {
    pola: /belanja\s+modal|investasi/i,
    istilah: 'belanja modal (capital expenditure) dan realisasi investasi',
  },
  {
    pola: /kehilangan\s+air|nrw/i,
    istilah: 'NRW (non revenue water) dan persentase kehilangan air',
  },
  {
    pola: /sambungan\s+langganan|jumlah\s+pelanggan/i,
    istilah: 'jumlah pelanggan dan sambungan langganan aktif',
  },
  {
    pola: /air\s+terjual|air\s+terdistribusi|produksi\s+air/i,
    istilah: 'volume air terproduksi, air terdistribusi, dan air terjual (m3)',
  },
  {
    pola: /pegawai|sdm|karyawan/i,
    istilah: 'jumlah pegawai dan rasio pegawai',
  },
  {
    pola: /laba|profitabilitas/i,
    istilah: 'laba kotor, laba usaha, laba sebelum pajak, dan laba bersih',
  },
];

/**
 * Kueri memakai ISTILAH DOKUMEN, bukan istilah kartu template.
 *
 * Uji nyata: "Komposisi Biaya Operasional" dijawab "angka tidak tersedia" tiga
 * kali dengan kalimat apa pun, tetapi langsung berisi begitu ditanya "komposisi
 * beban usaha … dari laporan keuangan audited" — dokumennya memakai istilah itu.
 * Mengembalikan null bila judul kartu tidak punya padanan di kamus.
 */
function kueriKamus(w: WidgetSpec, jenis: string): string | null {
  const teks = `${w.title} ${w.subtitle || ''}`;
  const cocok = KAMUS_ISTILAH.find((k) => k.pola.test(teks));
  if (!cocok) return null;
  return (
    `Ambil ${jenis} untuk ${cocok.istilah} dari dokumen resmi instansi ini. ` +
    `Gunakan istilah dan angka yang benar-benar tertulis di dokumen (laporan keuangan audited bila ada). ` +
    `Wajib menyertakan nama dokumen dan halaman.` +
    mintaDeret(w)
  );
}

/**
 * Tambahan permintaan bentuk data. Satu angka membuat garis KPI rata dan kartu
 * progres hanya berisi satu baris, jadi untuk jenis itu deret dan seluruh baris
 * diminta eksplisit.
 */
function mintaDeret(w: WidgetSpec): string {
  if (w.type === 'kpi' || w.type === 'gauge') {
    return (
      ' Sertakan juga deret angka per bulan (dua belas bulan terakhir) pada field sparkline ' +
      'berupa larik angka dari bulan terlama ke terbaru. Bila dokumen hanya memuat satu angka, ' +
      'biarkan sparkline kosong, jangan mengarang.'
    );
  }
  if (w.type === 'bullet-target' || w.type === 'table') {
    return (
      ' Sertakan SELURUH baris program atau indikator yang ada di dokumen, masing-masing dengan ' +
      'nama, target, realisasi, dan capaian. Jangan hanya mengambil satu baris.'
    );
  }
  return '';
}

function kueriWidget(w: WidgetSpec, gaya: 'normal' | 'longgar' | 'kamus' = 'normal'): string | null {
  const jenis =
    w.type === 'kpi' || w.type === 'bullet-target' || w.type === 'gauge'
      ? 'angka indikator'
      : w.type === 'table'
        ? 'tabel data'
        : w.type === 'narasi'
          ? 'ringkasan naratif'
          : 'data deret/grafik';
  if (gaya === 'kamus') return kueriKamus(w, jenis);
  if (gaya === 'longgar') {
    return (
      `Ambil ${jenis} untuk indikator "${w.title}" dari dokumen resmi instansi ini. ` +
      `Pakai angka TERDEKAT yang benar-benar ada di dokumen (misalnya pendapatan, beban, laba, ` +
      `jumlah pelanggan, volume air, atau rasio yang tersedia) dan sebutkan dasar angkanya singkat. ` +
      `Wajib menyertakan sumber: nama dokumen dan halaman.` +
      mintaDeret(w)
    );
  }
  const sub = w.subtitle ? ` (${w.subtitle})` : '';
  return (
    `Ambil ${jenis} untuk indikator "${w.title}"${sub} dari dokumen resmi instansi ini. ` +
    `Gunakan angka yang BENAR-BENAR ada di dokumen beserta sumbernya (nama dokumen & halaman). ` +
    `Kalau indikator ini tidak ada di dokumen, katakan tidak ada — jangan mengarang.` +
    mintaDeret(w)
  );
}

/** Angka pertama pada teks gaya Indonesia; null bila tidak ada angka. */
function angkaDari(teks: unknown): number | null {
  if (typeof teks === 'number') return Number.isFinite(teks) ? teks : null;
  const m = String(teks ?? '').match(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Apakah data hasil RAG benar-benar berisi angka/isi (bukan cuma "tidak ada")?
 * Model kadang mengembalikan teks "tidak ada" sebagai nilai; itu BUKAN data dan
 * tidak boleh tampil sebagai kartu berangka.
 */
function punyaDataValid(w: WidgetSpec): boolean {
  if (w.kpi) {
    const v = w.kpi.value;
    if (v === null || v === undefined) return false;
    if (typeof v === 'string' && /^\s*(tidak ada|n\/?a|none|unknown|-+|–+)\s*$/i.test(v)) return false;
    return angkaDari(v) !== null;
  }
  if (w.chart) {
    const seri = w.chart.series || [];
    return seri.some((s) => Array.isArray(s.data) && s.data.some((n) => typeof n === 'number' && Number.isFinite(n)));
  }
  if (w.heatmap) {
    return Array.isArray(w.heatmap.data) && w.heatmap.data.some((r) => Array.isArray(r) && r.length > 0);
  }
  if (w.table) {
    return Array.isArray(w.table.rows) && w.table.rows.length > 0;
  }
  if (w.narasi) {
    const t = (w.narasi.text || '').trim();
    return t.length >= 10 && !/^\s*(tidak ada|n\/?a|none)\s*$/i.test(t);
  }
  if (w.treemap) {
    return Array.isArray(w.treemap.children) && w.treemap.children.length > 0;
  }
  return false;
}

/**
 * Kelas bentuk tampilan: seluruh jenis grafik dianggap satu kelas karena datanya
 * sama-sama deret berkategori (xAxis + series), jadi bentuk template boleh dipakai
 * apa pun jawaban dokumen (batang, garis, donat, …). Kelas berbeda hanya untuk
 * tabel, narasi, dan KPI — di situ datanya tidak bisa ditukar.
 */
function kelasBentuk(t: string): string {
  if (t === 'table') return 'tabel';
  if (t === 'narasi') return 'narasi';
  if (t === 'kpi' || t === 'bullet-target') return 'kpi';
  return 'grafik';
}

/** Bentuk yang hanya butuh SATU deret (pai/donat/treemap) tidak bisa menelan dua deret. */
const BUTUH_SATU_DERET = ['pie', 'donut', 'treemap', 'funnel', 'gauge', 'radar'];

/** Buang SELURUH muatan angka contoh dari kartu template (sisakan kerangka: id, judul, grid, tipe). */
function kerangka(w: WidgetSpec): WidgetSpec {
  const sisa: WidgetSpec = { ...w };
  delete sisa.kpi;
  delete sisa.chart;
  delete sisa.table;
  delete sisa.narasi;
  delete sisa.heatmap;
  delete sisa.geo;
  delete sisa.gantt;
  delete sisa.treemap;
  delete sisa.dataKosong;
  delete sisa.catatanData;
  return sisa;
}

/** Kosongkan data angka sebuah kartu (tanpa menghapus susunan/id/grid template). */
function kosongkan(w: WidgetSpec, alasan: string): WidgetSpec {
  return { ...kerangka(w), dataKosong: true, catatanData: alasan, citations: [] };
}

/** Penanda: panggilan dihentikan karena anggaran waktu habis. */
const LEWAT = Symbol('lewat');

/**
 * Jalankan promise dengan batas waktu. Mengembalikan LEWAT (bukan melempar)
 * supaya pemanggil bisa membedakan "tidak ada di dokumen" dari "kehabisan waktu".
 */
async function denganBatas<T>(kerja: Promise<T>, ms: number): Promise<T | typeof LEWAT> {
  if (!Number.isFinite(ms)) return kerja;
  if (ms <= 0) return LEWAT;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      kerja,
      new Promise<typeof LEWAT>((selesai) => {
        timer = setTimeout(() => selesai(LEWAT), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Jalankan tugas secara terbatas serentak, mempertahankan urutan hasil. */
async function kumpulan<T, R>(
  item: T[],
  batas: number,
  fn: (t: T, i: number) => Promise<R>
): Promise<R[]> {
  const hasil: R[] = new Array(item.length);
  let berikut = 0;
  const pekerja = Array.from({ length: Math.max(1, Math.min(batas, item.length)) }, async () => {
    for (;;) {
      const i = berikut++;
      if (i >= item.length) return;
      hasil[i] = await fn(item[i], i);
    }
  });
  await Promise.all(pekerja);
  return hasil;
}

/**
 * Isi seluruh kartu template dari dokumen RAG.
 *
 * Kartu yang berhasil diisi TETAP memakai judul, subjudul, urutan, ukuran, dan
 * bentuk tampilan dari template — hanya angkanya yang berasal dari dokumen. Dengan
 * begitu dashboard hasil "Gunakan template" tampil sama dengan pratinjau template.
 */
export async function isiTemplateDariRag(
  template: DashboardTemplate,
  opsi: OpsiIsiTemplate
): Promise<HasilIsiTemplate> {
  const { sector, instansi, kbId, rag, konkurensi = 4, onProgres } = opsi;
  const total = template.widgets.length;
  let selesai = 0;
  /** Kartu yang sudah berisi angka — dipakai progres live di UI. */
  let jumlahTerisi = 0;
  let kedaluwarsa = false;
  const catatan: string[] = [];
  const mulai = Date.now();
  const sisaMs = () =>
    typeof opsi.batasMs === 'number' && opsi.batasMs > 0
      ? opsi.batasMs - (Date.now() - mulai)
      : Number.POSITIVE_INFINITY;

  /**
   * Proses SATU kartu. Dipisah dari perulangan supaya kartu yang masih kosong
   * bisa dicoba lagi di putaran kedua tanpa menduplikasi kode pemetaan.
   */
  const prosesKartu = async (
    w: WidgetSpec,
    jatahMaks?: number,
    gaya: 'normal' | 'longgar' | 'kamus' = 'normal'
  ): Promise<{ widget: WidgetSpec; status: 'terisi' | 'tidak-ada' | 'sibuk' }> => {
    let hasil: Awaited<ReturnType<RagPengambilData['ambilDataWidget']>> = null;
    let lewat = false;
    /** Pesan galat terakhir untuk kartu ini — dipakai membedakan 'sibuk' dari 'tidak ada'. */
    let galatTerakhir: string | null = null;
    // Kueri bisa null pada gaya 'kamus' (judul kartu tidak punya padanan istilah
    // dokumen) — kartu itu tidak perlu memanggil layanan sama sekali.
    const teksKueri = kueriWidget(w, gaya);
    const sisa = sisaMs();
    if (!teksKueri) {
      // tidak ada padanan istilah: biarkan kosong tanpa panggilan
    } else if (sisa <= 0) {
      lewat = true;
      kedaluwarsa = true;
    } else {
      // Satu kartu TIDAK boleh menghabiskan anggaran bersama. Tanpa batas per
      // kartu, satu panggilan RAG yang menggantung memakan seluruh sisa waktu
      // dan semua kartu lain langsung ditandai kosong — gejalanya: seluruh
      // kanvas menampilkan "Belum ada di dokumen".
      for (let coba = 1; coba <= 2; coba += 1) {
        const batasKartu = jatahMaks ?? BATAS_KARTU_MS;
        const jatah = Math.min(
          sisaMs(),
          coba === 1 ? batasKartu : Math.max(BATAS_ULANG_KARTU_MS, batasKartu)
        );
        if (jatah <= 0) {
          lewat = true;
          kedaluwarsa = true;
          break;
        }
        try {
          const jawab = await denganBatas(
            // batasMs diteruskan supaya percobaan ulang di dalam klien RAG tahu
            // kapan harus berhenti — bukan menggantung melewati jatah kartu.
            rag.ambilDataWidget(teksKueri, sector, w.type, instansi, kbId, {
              batasMs: jatah,
              // Kartu template memilih bentuk tampilan; kalau datanya ada tetapi
              // bentuknya tidak cocok, pakai bentuk terdekat — bukan dikosongkan.
              turunkanTipe: true,
            }),
            jatah
          );
          if (jawab === LEWAT) {
            // Habis waktu: ulangi sekali dengan jatah pendek bila anggaran ada.
            if (coba === 2) {
              lewat = true;
              kedaluwarsa = true;
            }
            continue;
          }
          hasil = jawab;
          break;
        } catch (err) {
          // Kegagalan sementara (429/502) pantas dicoba ulang, tetapi alasannya
          // tetap dicatat supaya kartu kosong bisa dijelaskan ke pengguna.
          galatTerakhir = err instanceof Error ? err.message : 'gagal mengambil data';
        }
      }
      // Catat kegagalan bila kartu akhirnya tetap tanpa angka — termasuk saat
      // percobaan ulang menjawab "tidak ada di dokumen": pengguna berhak tahu
      // ada gangguan pengambilan, bukan hanya "kosong".
      if (galatTerakhir && !(hasil && hasil.data)) {
        catatan.push(`"${w.title}": ${galatTerakhir}`);
      }
    }

    selesai += 1;
    let keluar: WidgetSpec;
    const valid = !!hasil?.data && punyaDataValid(hasil.data as WidgetSpec);

    if (valid) {
      const d: any = hasil!.data;
      const kpi: any = d.kpi ? { ...d.kpi } : undefined;
      // Buang angka turunan yang TIDAK bersandar dokumen: sparkline sintetis
      // (`turunan-nilai`) membuat delta jadi konstanta yang sama untuk semua kartu
      // (mis. selalu "+6,4%") — itu angka karangan, bukan dari dokumen.
      if (kpi && kpi.sparklineAsal === 'turunan-nilai') {
        delete kpi.delta;
        delete kpi.deltaLabel;
        delete kpi.sparkline;
        delete kpi.sparklineAsal;
      }
      /**
       * KARTU HARUS TETAP SEPERTI TEMPLATE: id, urutan, lebar/tinggi (grid), judul,
       * subjudul, dan bentuk tampilan diambil dari template. Dokumen hanya menyumbang
       * ANGKA (kpi/chart/table/narasi). Bentuk dari dokumen hanya dipakai bila
       * keluarganya berbeda — kalau masih sekeluarga (batang↔garis↔area), bentuk
       * template yang menang supaya dashboard hasilnya sama dengan pratinjau.
       */
      const tipeDokumen = (d.type as WidgetSpec['type']) || w.type;
      const jumlahDeret = Array.isArray((d as any)?.chart?.series) ? (d as any).chart.series.length : 0;
      const bentukTemplateBisa =
        kelasBentuk(String(w.type)) !== 'grafik' || !BUTUH_SATU_DERET.includes(String(w.type))
          ? true
          : jumlahDeret <= 1;
      const tipeFinal =
        kelasBentuk(String(tipeDokumen)) === kelasBentuk(String(w.type)) && bentukTemplateBisa
          ? w.type
          : tipeDokumen;
      keluar = {
        ...kerangka(w),
        ...d,
        id: w.id,
        grid: w.grid,
        type: tipeFinal,
        title: w.title,
        subtitle: w.subtitle,
        kpi,
        confidence: 'sumber',
        citations: Array.isArray(d.citations) ? d.citations : [],
        dataKosong: false,
      };
    } else {
      const alasan = lewat
        ? 'Waktu pengambilan angka habis sebelum dokumen selesai dibaca. Kartu ini belum terisi.'
        : hasil?.alasan || 'Indikator ini tidak ditemukan di dokumen instansi.';
      if (lewat) catatan.push(`"${w.title}": waktu habis`);
      keluar = kosongkan(w, alasan);
    }

    // 'sibuk' = gagal karena layanan (429/timeout) → layak dicoba lagi.
    // 'tidak-ada' = dokumen memang tidak memuat indikator ini → jangan diulang.
    const status: 'terisi' | 'tidak-ada' | 'sibuk' = valid
      ? 'terisi'
      : lewat || galatTerakhir
        ? 'sibuk'
        : 'tidak-ada';
    if (status === 'terisi') jumlahTerisi += 1;
    if (status !== 'sibuk') selesai += 1;
    onProgres?.({
      selesai: Math.min(selesai, total),
      total,
      judul: w.title,
      terisi: valid,
      terisiTotal: jumlahTerisi,
    });
    return { widget: keluar, status };
  };

  const statusKartu: Array<'terisi' | 'tidak-ada' | 'sibuk'> = new Array(total).fill('tidak-ada');
  const widgets: WidgetSpec[] = new Array(total);
  await kumpulan(template.widgets, konkurensi, async (w, i) => {
    const r = await prosesKartu(w);
    widgets[i] = r.widget;
    statusKartu[i] = r.status;
  });

  /**
   * PUTARAN ULANG — kartu yang gagal karena LAYANAN dicoba terus sampai terisi.
   *
   * Uji nyata: kartu "Komposisi Biaya Operasional" kosong di jalur batch, padahal
   * saat diminta sendiri-sendiri berhasil dalam 17–38 detik — angkanya memang ada
   * di dokumen, layanan hanya membalas 429/timeout saat antrean padat. Jadi kartu
   * berstatus 'sibuk' diulang satu per satu (jeda makin panjang) sampai terisi
   * atau anggaran waktu benar-benar habis. Kartu 'tidak-ada' TIDAK diulang:
   * mengulanginya hanya memakan waktu tanpa hasil.
   */
  const putaranMaks = opsi.putaranMaks ?? 6;
  for (let putaran = 2; putaran <= putaranMaks; putaran += 1) {
    const sisaSibuk = statusKartu.map((s, i) => ({ s, i })).filter(({ s }) => s === 'sibuk');
    if (sisaSibuk.length === 0) break;
    if (sisaMs() < 20_000) break;
    // Jeda makin panjang tiap putaran: memberi jendela rate limit waktu pulih.
    await new Promise((r) => setTimeout(r, Math.min(20_000, 3_000 * (putaran - 1))));
    for (const { i } of sisaSibuk) {
      const jatah = Math.min(90_000, sisaMs());
      if (jatah < 10_000) break;
      const r = await prosesKartu(template.widgets[i], jatah);
      statusKartu[i] = r.status;
      if (r.status !== 'sibuk') widgets[i] = r.widget;
    }
  }

  /**
   * PERCOBAAN TERAKHIR untuk kartu yang dijawab "tidak ada di dokumen": tanya
   * sekali lagi dengan kalimat longgar. Banyak indikator sebenarnya ada, hanya
   * tidak cocok dengan istilah di kartu template (mis. "Komposisi Biaya
   * Operasional" vs "Beban usaha" di laporan laba rugi).
   */
  const dianggapTidakAda = statusKartu.map((s, i) => ({ s, i })).filter(({ s }) => s === 'tidak-ada');
  for (const { i } of dianggapTidakAda) {
    const jatah = Math.min(90_000, sisaMs());
    if (jatah < 15_000) break;
    const r = await prosesKartu(template.widgets[i], jatah, 'longgar');
    statusKartu[i] = r.status;
    if (r.status === 'terisi') widgets[i] = r.widget;
  }

  /**
   * PERCOBAAN KAMUS — tanya memakai istilah yang dipakai dokumen, bukan istilah
   * kartu template. Ini yang menyelamatkan kartu seperti "Komposisi Biaya
   * Operasional" (dokumen menulisnya "beban usaha").
   */
  const sisaTidakAda = statusKartu.map((s, i) => ({ s, i })).filter(({ s }) => s === 'tidak-ada');
  for (const { i } of sisaTidakAda) {
    if (!kueriWidget(template.widgets[i], 'kamus')) continue;
    const jatah = Math.min(90_000, sisaMs());
    if (jatah < 15_000) break;
    const r = await prosesKartu(template.widgets[i], jatah, 'kamus');
    statusKartu[i] = r.status;
    if (r.status === 'terisi') widgets[i] = r.widget;
  }

  kedaluwarsa = statusKartu.some((s) => s === 'sibuk');
  const terisi = widgets.filter((w) => w && !w.dataKosong).length;
  return { widgets, terisi, kosong: total - terisi, catatan, kedaluwarsa };
}
