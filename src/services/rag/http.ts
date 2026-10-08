import { BumdSector, Citation } from '../../types';
import { mockRag } from './mock';
import { RAG_PROMPTS } from './prompts';
import { RagClient, RagQueryOptions, RagResult } from './types';
import { SectorDocumentChunk } from './mockData';
import { KB_CAMPUR } from './kbDefaults';
import { angkaDariTeks } from '../spec/kpiSparkline';
import { selaraskanTipe } from '../spec/tipeSelaras';

/**
 * Pilih KB pertama yang layak dari daftar kandidat (KB instansi → KB global),
 * dengan MELEWATI KB campur. KB campur (mis. `kb_chat`) berisi dokumen banyak
 * instansi sehingga retrieval-nya tidak bisa dijamin terisolasi; memakainya
 * sebagai cadangan mengembalikan bug lama "dashboard PDAM berisi laporan Bank
 * BJB". Kalau semua kandidat campur/tidak ada, hasilnya `undefined` — pemanggil
 * harus menolak permintaan, bukan memakai KB campur diam-diam.
 */
function kbAman(...kandidat: Array<string | undefined>): string | undefined {
  for (const k of kandidat) {
    const v = k?.trim();
    if (v && !KB_CAMPUR.has(v)) return v;
  }
  return undefined;
}

/** Sumber konfigurasi RAG (disimpan di systemConfig, diatur admin). */
export type RagConfigFetcher = () => {
  provider: 'mock' | 'http';
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  /** Knowledge base id layanan RAG (mis. kontrak ragjev: retrieval selalu scoped KB). */
  kbId?: string;
  /**
   * Pakai endpoint /extract untuk Jalur A (JSON terstruktur berisi angka nyata
   * dari dokumen). Default aktif.
   */
  useExtract?: boolean;
};

/** Skema ringkas yang diminta ke endpoint /extract untuk menyusun widget. */
/**
 * Skema yang diminta ke /extract: SATU dashboard utuh berupa data
 * (kpi[], grafik, tabel, narasi), bukan daftar widget bebas. Tata letak dan
 * penamaan widget diatur aplikasi supaya hasilnya rapi dan konsisten.
 */
export const SKEMA_KPI_ITEM = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    nilai: { type: 'string' },
    satuan: { type: 'string' },
    /** Angka periode sebelumnya (tahun lalu / triwulan lalu) BILA dokumen memuatnya. */
    nilaiLalu: { type: 'string' },
    deltaLabel: { type: 'string' },
    periode: { type: 'string' },
    unitKerja: { type: 'string' },
    docName: { type: 'string' },
    page: { type: 'integer' },
    chunkSnippet: { type: 'string' },
  },
  required: ['label', 'nilai', 'docName', 'chunkSnippet'],
};

const SKEMA_GRAFIK_OBJ = {
  type: 'object',
  properties: {
    judul: { type: 'string' },
    tipe: { type: 'string', enum: ['line', 'bar', 'area'] },
    satuan: { type: 'string' },
    kategori: { type: 'array', items: { type: 'string' } },
    seri: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nama: { type: 'string' },
          data: { type: 'array', items: { type: 'number' } },
        },
        required: ['nama', 'data'],
      },
    },
    docName: { type: 'string' },
    page: { type: 'integer' },
    chunkSnippet: { type: 'string' },
  },
  required: ['judul', 'kategori', 'seri', 'docName', 'chunkSnippet'],
};

const SKEMA_TABEL_OBJ = {
  type: 'object',
  properties: {
    judul: { type: 'string' },
    kolom: { type: 'array', items: { type: 'string' } },
    baris: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
    docName: { type: 'string' },
    page: { type: 'integer' },
    chunkSnippet: { type: 'string' },
  },
  required: ['judul', 'kolom', 'baris', 'docName', 'chunkSnippet'],
};

const SKEMA_NARASI_OBJ = {
  type: 'object',
  properties: {
    judul: { type: 'string' },
    teks: { type: 'string' },
    docName: { type: 'string' },
    page: { type: 'integer' },
    chunkSnippet: { type: 'string' },
  },
  required: ['judul', 'teks', 'docName', 'chunkSnippet'],
};

/**
 * Skema yang diminta ke /extract: SATU dashboard utuh berupa data
 * (kpi[], grafik, tabel, narasi), bukan daftar widget bebas.
 */
export const SKEMA_EKSTRAKSI = {
  type: 'object',
  properties: {
    dashboardTitle: { type: 'string' },
    description: { type: 'string' },
    kpi: { type: 'array', items: SKEMA_KPI_ITEM },
    grafik: SKEMA_GRAFIK_OBJ,
    tabel: SKEMA_TABEL_OBJ,
    narasi: SKEMA_NARASI_OBJ,
  },
  required: ['dashboardTitle', 'kpi'],
};

/**
 * Skema per-fokus untuk pengambilan data satu widget (katalog preset). Model tidak
 * bisa "mengisi field lain" karena skemanya memang hanya punya satu bentuk.
 */
export const SKEMA_FOKUS: Record<string, any> = {
  kpi: SKEMA_KPI_ITEM,
  grafik: SKEMA_GRAFIK_OBJ,
  tabel: SKEMA_TABEL_OBJ,
  narasi: SKEMA_NARASI_OBJ,
};


/** Ubah satu item hasil /extract menjadi Widget Spec AionesBoard (sesuai skema Zod). */
/** Batas panjang teks supaya kartu tidak penuh dan tidak terpotong CSS. */
const BATAS_TEKS = { judulDash: 64, judul: 56, label: 44, nilai: 20, satuan: 18, delta: 62, narasi: 340, deskripsi: 150 };

/** Potong teks di batas kata (tanpa memotong di tengah kata). */
export function potong(teks: unknown, maks: number): string {
  const s = String(teks ?? '').replace(/\s+/g, ' ').trim();
  if (!s || s.length <= maks) return s;
  const mentah = s.slice(0, maks - 1);
  const spasi = mentah.lastIndexOf(' ');
  const rapi = spasi > maks * 0.55 ? mentah.slice(0, spasi) : mentah;
  return rapi.replace(/[\s,;:\-\u2013\u2014]+$/, '') + '\u2026';
}

/** Nilai KPI: angka bersih, satuan dipisah supaya tidak tampil dobel di kartu. */
function bersihkanNilai(nilai: unknown, satuan: unknown): { value: string; unit?: string } {
  const s = potong(nilai, BATAS_TEKS.nilai);
  const u = potong(satuan, BATAS_TEKS.satuan);
  if (!s) return { value: '' };
  const dobel = u ? new RegExp(u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(s) : false;
  return { value: s, unit: u && !dobel ? u : undefined };
}

/** deltaLabel hanya dipakai kalau memuat perbandingan nyata (angka + %/vs/dibanding). */
function deltaMasukAkal(label: unknown): string | undefined {
  const s = potong(label, BATAS_TEKS.delta);
  if (!s) return undefined;
  const adaAngka = /\d/.test(s);
  const adaPembanding = /%|\bvs\b|dibanding|dari tahun|lebih (baik|tinggi|rendah)|naik|turun|menjadi/i.test(s);
  if (!adaAngka || !adaPembanding) return undefined;
  return s.replace(/;.*$/, '').trim();
}

/** Penata letak 12 kolom: kartu berurutan, dibungkus ke baris berikutnya bila penuh. */
class PenataLetak {
  private x = 0;
  private y = 0;
  private tinggiBaris = 0;
  kotak(w: number, h: number): { x: number; y: number; w: number; h: number } {
    const lebar = Math.min(12, Math.max(3, Math.round(w)));
    if (this.x > 0 && this.x + lebar > 12) {
      this.y += this.tinggiBaris;
      this.x = 0;
      this.tinggiBaris = 0;
    }
    const kotak = { x: this.x, y: this.y, w: lebar, h };
    this.x += lebar;
    this.tinggiBaris = Math.max(this.tinggiBaris, h);
    return kotak;
  }
}

/** Kutipan sumber satu widget. */
function kutipanExtract(id: string, docName: unknown, page: unknown, snippet: unknown) {
  const halaman = Number(page);
  return {
    id: `cit-extract-${id}`,
    docName: potong(docName, 90) || 'Dokumen Sumber',
    page: Number.isFinite(halaman) && halaman > 0 ? Math.round(halaman) : 1,
    chunkSnippet: potong(snippet, 600) || 'Potongan dokumen sumber.',
    confidenceScore: 0.95,
    date: '',
  };
}

/**
 * Rapikan angka ke gaya Indonesia: "221.35" jadi "221,35" dan "4,929,381" jadi
 * "4.929.381". Angka yang sudah benar dibiarkan apa adanya.
 */
export function angkaGayaIndonesia(teks: string): string {
  if (!teks) return teks;
  const ribuanInggris = /^\d{1,3}(,\d{3})+(\.\d{1,2})?$/;
  if (ribuanInggris.test(teks)) {
    const [utuh, desimal] = teks.split('.');
    return utuh.replace(/,/g, '.') + (desimal ? ',' + desimal : '');
  }
  const desimalInggris = /^\d+\.\d{1,2}$/;
  if (desimalInggris.test(teks)) return teks.replace('.', ',');
  return teks;
}

/** Judul grafik: pakai judul model hanya kalau bersih, kalau tidak susun dari serinya. */
export function judulGrafik(judul: unknown, seri: { name: string }[], kategori: string[]): string {
  const bersih = potong(judul, BATAS_TEKS.judul);
  const kotor = !bersih || /according to|\bvs\b|\bthe\b|\band\b/i.test(bersih) || /^\d{4}\b/.test(bersih);
  if (!kotor) return bersih;
  const tahun = seri.map((x) => x.name).filter((n) => /^\d{4}$/.test(n));
  const namaSeri = seri.map((x) => x.name).filter((n) => !/^\d{4}$/.test(n));
  // Kategori berupa tahun: judul dari nama seri, periode di dalam tanda kurung.
  if (kategori.length >= 2 && kategori.every((k) => /^\d{4}$/.test(k)) && namaSeri.length > 0) {
    return potong(`${namaSeri.slice(0, 2).join(' dan ')} (${kategori[0]}\u2013${kategori[kategori.length - 1]})`, BATAS_TEKS.judul);
  }
  // Kategori berupa label: judul dari rentang label, tahun dari nama seri.
  const rentang = kategori.length >= 2 ? `${kategori[0]} s.d. ${kategori[kategori.length - 1]}` : kategori[0] || 'Tren Indikator';
  const ekor = tahun.length ? `(${tahun.join(', ')})` : namaSeri.slice(0, 2).join(' dan ');
  return potong(`${rentang} ${ekor}`.trim(), BATAS_TEKS.judul);
}

/** Satuan seragam: "juta Rp" jadi "Rp juta", "jutaan Rupiah" jadi "Rp juta". */
export function satuanSeragam(teks: unknown): string | undefined {
  const s = potong(teks, BATAS_TEKS.satuan);
  if (!s) return undefined;
  // Buang kata mata uang (Rp, IDR, Rupiah) supaya skalanya terbaca apa adanya.
  const t = s
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\brp\b|\bidr\b|\brupiah\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const m = /^(ratusan\s+)?(triliunan|triliun|milyaran|miliaran|miliar|milyar|jutaan|juta|ribuan|ribu)$/.exec(t);
  if (m) {
    const dasar = m[2].replace(/^milyar.*$/, 'miliar').replace(/an$/, '');
    return 'Rp ' + dasar;
  }
  return s;
}

const WARNA_SERI = ['#38c6e2', '#2bb8a8', '#e0a020', '#8f90e4'];

/**
 * Ubah hasil /extract (satu dashboard berupa data: kpi[], grafik, tabel, narasi)
 * menjadi daftar Widget Spec dengan tata letak rapat. Widget yang datanya tidak
 * lengkap dibuang, bukan ditampilkan asal-asalan.
 */
export function payloadKeWidgetSpec(payload: any, sector: string) {
  const penata = new PenataLetak();
  const widgets: any[] = [];
  const dasar = { category: 'Keuangan', confidence: 'sumber' as const, lastUpdated: new Date().toISOString() };

  // --- KPI: 3 kartu per baris (lebar 4) atau 2 per baris (lebar 6 saat tepat 4 KPI)
  const kpis = (Array.isArray(payload?.kpi) ? payload.kpi : []).slice(0, 6);
  const lebarKpi = kpis.length === 4 ? 6 : 4;
  const judulTerpakai = new Set<string>();
  kpis.forEach((k: any, i: number) => {
    const bersih = bersihkanNilai(k?.nilai, k?.satuan);
    const value = angkaGayaIndonesia(bersih.value);
    const unit = satuanSeragam(bersih.unit);
    if (!value) return;
    let judul = potong(k?.label || `Indikator ${i + 1}`, BATAS_TEKS.label);
    if (judulTerpakai.has(judul.toLowerCase())) {
      const periode = potong(k?.periode, 10);
      judul = potong(periode ? `${judul} ${periode}` : `${judul} ${i + 1}`, BATAS_TEKS.label);
    }
    judulTerpakai.add(judul.toLowerCase());
    widgets.push({
      ...dasar,
      id: `w-kpi-${i + 1}`,
      type: 'kpi',
      title: judul,
      subtitle: potong(k?.unitKerja, 32) || undefined,
      grid: penata.kotak(lebarKpi, 3),
      // Delta (persentase perubahan) = bandingkan dengan angka periode sebelumnya bila
      // dokumen memuatnya. Kalau tidak ada, dibiarkan kosong supaya tidak mengarang angka.
      kpi: (() => {
        const kini = angkaDariTeks(value);
        const lalu = angkaDariTeks((k as any)?.nilaiLalu);
        if (kini !== null && lalu !== null && lalu !== 0) {
          const delta = Number((((kini - lalu) / lalu) * 100).toFixed(1));
          return {
            value,
            unit,
            delta,
            deltaLabel: deltaMasukAkal(k?.deltaLabel) || 'vs periode sebelumnya',
          };
        }
        return { value, unit, deltaLabel: deltaMasukAkal(k?.deltaLabel) };
      })(),
      citations: [kutipanExtract(`kpi-${i + 1}`, k?.docName, k?.page, k?.chunkSnippet)],
      unitKerja: potong(k?.unitKerja, 40) || undefined,
      periode: potong(k?.periode, 12) || '',
    });
  });

  // --- Grafik: hanya kalau kategori dan seluruh seri panjangnya sama
  const g = payload?.grafik;
  const kategori = (Array.isArray(g?.kategori) ? g.kategori : []).map((x: any) => potong(x, 24));

  // ── Normalisasi satuan grafik ──────────────────────────────────────────────
  // RAG kadang mengembalikan data lintas satuan dalam satu grafik, mis. beberapa
  // item kategori dalam "triliun" dan sisanya dalam "miliar". Normalisasi ke
  // satuan terkecil (miliar) agar bar proporsional.
  function deteksiMultiplierSatuan(teks: string): number {
    const u = (teks || '').toLowerCase();
    if (/triliun/.test(u)) return 1_000;   // 1 triliun = 1000 miliar
    if (/miliar|milyar/.test(u)) return 1;
    if (/juta/.test(u)) return 0.001;
    if (/ribu/.test(u)) return 0.000_001;
    return 1;
  }

  // Periksa apakah label xAxis/kategori mengandung satuan (mis. "Sustainable Bond (triliun)")
  // dan nilai yang dikembalikan RAG masih dalam angka aslinya.
  // Juga cek satuan header grafik (g.satuan).
  const satuanGrafik = String(g?.satuan || '');
  const multiplierGrafik = deteksiMultiplierSatuan(satuanGrafik);

  // Periksa per-seri: apakah ada metadata satuan per-seri dari RAG.
  const seriRaw = (Array.isArray(g?.seri) ? g.seri : []);
  const multiplierPerSeri = seriRaw.map((s: any) => deteksiMultiplierSatuan(String(s?.satuan || satuanGrafik)));
  const adaSatuanCampur = multiplierPerSeri.some((m: number) => m !== multiplierPerSeri[0]);
  const multiplierDasar = adaSatuanCampur ? Math.min(...multiplierPerSeri) : 1;

  const seri = seriRaw
    .map((s: any, i: number) => {
      const mult = adaSatuanCampur ? multiplierPerSeri[i] / multiplierDasar : 1;
      return {
        name: potong(s?.nama || `Seri ${i + 1}`, 28),
        data: (Array.isArray(s?.data) ? s.data : [])
          .map((n: any) => {
            const angka = Number(n);
            return Number.isFinite(angka) ? angka * mult : NaN;
          })
          .filter((n: number) => Number.isFinite(n)),
        color: WARNA_SERI[i % WARNA_SERI.length],
      };
    })
    .filter((s: any) => s.data.length >= 3);
  // ──────────────────────────────────────────────────────────────────────────

  const grafikValid = kategori.length >= 3 && kategori.length <= 6 && seri.length > 0 && seri.every((s: any) => s.data.length === kategori.length);
  if (g && grafikValid) {
    // Satuan display: kalau ada satuan campur, pakai satuan terkecil yang jadi basis.
    let unitDisplay = satuanSeragam(g?.satuan);
    if (adaSatuanCampur) {
      const satuanMin = seriRaw[multiplierPerSeri.indexOf(Math.min(...multiplierPerSeri))]?.satuan;
      unitDisplay = satuanSeragam(satuanMin) || unitDisplay;
    }
    widgets.push({
      ...dasar,
      id: 'w-grafik-1',
      type: ['line', 'bar', 'area'].includes(g?.tipe) ? g.tipe : 'bar',
      title: judulGrafik(g?.judul, seri, kategori),
      subtitle: unitDisplay,
      grid: penata.kotak(12, 4),
      chart: { xAxis: kategori, series: seri, unit: unitDisplay, showLegend: seri.length > 1 },
      citations: [kutipanExtract('grafik-1', g?.docName, g?.page, g?.chunkSnippet)],
      periode: potong(g?.periode, 12) || '',
    });
  }

  // --- Tabel: maksimal 4 kolom dan 5 baris
  const t = payload?.tabel;
  const kolom = (Array.isArray(t?.kolom) ? t.kolom : [])
    .slice(0, 4)
    .map((c: any, i: number) => ({ key: `k${i}`, label: potong(c, 26) || `Kolom ${i + 1}` }));
  const baris = (Array.isArray(t?.baris) ? t.baris : [])
    .slice(0, 5)
    .map((r: any) => (Array.isArray(r) ? r.slice(0, 4) : []))
    .filter((r: any[]) => r.length > 0);
  if (t && kolom.length >= 2 && baris.length >= 1) {
    widgets.push({
      ...dasar,
      id: 'w-tabel-1',
      type: 'table',
      title: potong(t?.judul || 'Rincian Angka', BATAS_TEKS.judul),
      subtitle: potong(t?.docName, 32) || undefined,
      grid: penata.kotak(6, 4),
      table: {
        columns: kolom,
        rows: baris.map((r: any[]) =>
          Object.fromEntries(kolom.map((c: any, i: number) => [c.key, angkaGayaIndonesia(potong(r[i], 30)) || '-']))
        ),
      },
      citations: [kutipanExtract('tabel-1', t?.docName, t?.page, t?.chunkSnippet)],
      periode: potong(t?.periode, 12) || '',
    });
  }

  // --- Narasi: ringkasan, bukan visi misi atau kebijakan internal
  const n = payload?.narasi;
  const teksNarasi = potong(n?.teks || n?.chunkSnippet, BATAS_TEKS.narasi);
  if (n && teksNarasi.length >= 40) {
    const adaTabel = widgets.some((w) => w.type === 'table');
    widgets.push({
      ...dasar,
      id: 'w-narasi-1',
      type: 'narasi',
      title: potong(n?.judul || 'Catatan Penting', BATAS_TEKS.judul),
      subtitle: potong(n?.docName, 32) || undefined,
      grid: penata.kotak(adaTabel ? 6 : 12, 4),
      narasi: { text: teksNarasi },
      citations: [kutipanExtract('narasi-1', n?.docName, n?.page, n?.chunkSnippet)],
      periode: potong(n?.periode, 12) || '',
    });
  }

  return widgets;
}


const MASK = '*********';

/** Mask API key untuk UI admin: tampilkan 4 karakter pertama & terakhir saja. */
export function maskKey(key: string): string {
  if (!key) return '';
  if (key === MASK) return key;
  if (key.length <= 8) return MASK;
  return key.slice(0, 4) + MASK + key.slice(-4);
}

/** Bungkus pesan error jadi teks ramah untuk probe/log. */
export function jelaskanError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/aborted|timeout/i.test(msg)) return 'Timeout — RAG tidak merespons tepat waktu';
  if (/401|403/.test(msg)) return 'API key ditolak (401/403)';
  if (/404/.test(msg)) return 'Endpoint tidak ditemukan (404)';
  if (/ENOTFOUND|ECONNREFUSED|fetch failed|ECONNRESET/i.test(msg)) return 'Host tidak dapat dihubungi';
  return msg;
}

export class ConfigurableRagClient implements RagClient {
  // Pakai instance mock bersama (mockRag) sebagai fallback bila provider HTTP
  // tidak dikonfigurasi atau gagal dihubungi.
  private mock = mockRag;
  private getRagConfig: RagConfigFetcher;
  /** Hasil penyesuaian base URL (di-cache per nilai yang dikonfigurasi). */
  private baseTerpakai: { dikonfigurasi: string; dipakai: string; disesuaikan: boolean } | null = null;

  constructor(getRagConfig: RagConfigFetcher) {
    this.getRagConfig = getRagConfig;
  }

  /**
   * Beberapa layanan RAG (mis. Multi-Tenant RAG & Jev AI Service) menaruh endpoint
   * di bawah prefix /api/v1, sehingga Base URL yang ditempel admin sering hanya
   * berisi domain. Kalau {base}/health tidak menjawab, coba {base}/api/v1/health
   * sekali, lalu pakai yang berhasil. Hasilnya di-cache supaya tidak diulang
   * setiap permintaan. Kalau tidak ada yang menjawab, pakai base apa adanya.
   */
  private async resolveBase(
    cfg: { baseUrl: string; apiKey: string; timeoutMs: number }
  ): Promise<{ dipakai: string; disesuaikan: boolean }> {
    const dikonfigurasi = cfg.baseUrl.replace(/\/+$/, '');
    if (this.baseTerpakai && this.baseTerpakai.dikonfigurasi === dikonfigurasi) {
      return this.baseTerpakai;
    }
    const kandidat = [dikonfigurasi];
    if (!/\/api\/v\d+$/.test(dikonfigurasi)) kandidat.push(`${dikonfigurasi}/api/v1`);
    for (const k of kandidat) {
      try {
        const res = await fetch(`${k}/health`, {
          headers: { Authorization: `Bearer ${cfg.apiKey}` },
          signal: AbortSignal.timeout(Math.min(Math.max(5, cfg.timeoutMs || 60) * 1000, 8000)),
        });
        if (res.ok) {
          this.baseTerpakai = { dikonfigurasi, dipakai: k, disesuaikan: k !== dikonfigurasi };
          return this.baseTerpakai;
        }
      } catch {
        // kandidat ini tidak bisa dihubungi — coba berikutnya
      }
    }
    this.baseTerpakai = { dikonfigurasi, dipakai: dikonfigurasi, disesuaikan: false };
    return this.baseTerpakai;
  }

  /**
   * JALUR A via /extract: minta layanan RAG mengembalikan angka nyata dari
   * dokumen dalam bentuk JSON terstruktur, lalu ubah jadi Widget Spec.
   * Mengembalikan null kalau endpoint tidak mendukung atau tidak ada temuan,
   * sehingga pemanggil bisa lanjut ke jalur retrieval biasa (Jalur B).
   */
  /** Panggil /extract dan kembalikan satu item payload (null kalau gagal atau kosong). */
  private async ambilPayloadExtract(
    base: string,
    cfg: { apiKey?: string; kbId?: string; timeoutMs: number },
    instruksi: string,
    skema: any = SKEMA_EKSTRAKSI,
    kbId?: string,
    opsi?: { lemparSaatGagal?: boolean }
  ): Promise<any | null> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), Math.max(5, cfg.timeoutMs || 60) * 1000);
    // KB per-instansi (kalau ada) menimpa KB global. KB campur dilewati supaya
    // tidak pernah jadi sumber (lihat kbAman).
    const kbEfektif = kbAman(kbId, cfg.kbId);
    try {
      const res = await fetch(`${base}/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          query: instruksi,
          ...(kbEfektif ? { knowledge_base_id: kbEfektif } : {}),
          top_k: 8,
          output_schema: skema,
        }),
        signal: ac.signal,
      });
      if (!res.ok) {
        console.warn(`[rag] /extract dibalas ${res.status}`);
        // Pemanggil yang butuh membedakan "dokumen tidak memuat" dari "layanan
        // bermasalah" (mis. pemeriksa ketersediaan preset) minta dilempar.
        if (opsi?.lemparSaatGagal) {
          throw new Error(`Layanan RAG membalas ${res.status}.`);
        }
        return null;
      }
      const teksRespons = await res.text();
      let raw: any = null;
      try {
        raw = JSON.parse(teksRespons);
      } catch {
        // Badan non-JSON = halaman galat (502/504 dari gerbang layanan), bukan
        // "dokumen kosong". Dibedakan supaya tidak dilaporkan sebagai "tidak ada data".
        console.warn('[rag] /extract membalas badan non-JSON');
        if (opsi?.lemparSaatGagal) {
          throw new Error('Layanan RAG membalas badan non-JSON (kemungkinan galat gerbang).');
        }
        return null;
      }
      const wadah = raw?.data && raw.success !== undefined ? raw.data : raw;
      const item = Array.isArray(wadah?.items) ? wadah.items[0] : null;
      if (!item) console.warn('[rag] /extract tidak mengembalikan item');
      return item;
    } catch (err) {
      console.warn('[rag] /extract gagal:', jelaskanError(err));
      if (opsi?.lemparSaatGagal) throw err;
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Instruksi Jalur A: satu dashboard KPI utuh dari dokumen resmi. */
  private instruksiDashboard(options: RagQueryOptions): string {
    // Isolasi utama ada di sisi knowledge base: kalau `kbId` menunjuk KB milik
    // satu instansi, dokumen instansi lain memang tidak ikut terambil. Dalam
    // kondisi itu JANGAN memaksa nama instansi tampilan ke prompt — nama demo
    // sering tidak sama dengan nama di dokumen, dan paksaan itu membuat model
    // menolak semua dokumen lalu turun ke Jalur B (dashboard jadi miskin).
    // Klausa "abaikan instansi lain" hanya dipakai saat KB tidak di-scope.
    const instansi = (options.instansi || '').trim();
    const kbTerskop = !!options.kbId?.trim();
    const sebutanInstansi = kbTerskop
      ? `Semua dokumen di knowledge base ini milik SATU instansi. Gunakan dokumen yang ada apa adanya, ` +
        `dan sebut nama instansi sesuai isi dokumen. `
      : instansi
        ? `Instansi yang diminta: "${instansi}" (sektor ${options.sector.toUpperCase()}). ` +
          `Ambil angka HANYA dari dokumen milik instansi tersebut. Kalau dokumen instansi ini tidak ` +
          `tersedia, kembalikan hasil kosong, jangan pakai instansi lain. `
        : `Konteks instansi pengguna: sektor ${options.sector.toUpperCase()}. `;
    return `Susun satu dashboard KPI dari dokumen resmi di knowledge base ini. ` +
      sebutanInstansi +
      `Permintaan pengguna: "${options.prompt}". ` +
      `Aturan keluaran: ` +
      `(1) dashboardTitle maksimal 6 kata, tanpa kata "Dashboard", sebut instansi dan tahun. ` +
      `(2) description maksimal 18 kata, tanpa catatan meta. ` +
      `(3) kpi: 4 sampai 6 indikator KINERJA UTAMA tingkat perusahaan, misalnya total aset, pendapatan, laba bersih, ` +
      `total kredit, dana pihak ketiga, jumlah nasabah, atau rasio utama seperti NPL/ROA/ROE/CAR/BOPO. ` +
      `JANGAN memilih baris rincian laporan arus kas, akun kecil, atau item administratif. ` +
      `Label maksimal 5 kata dan harus jelas (jangan dua KPI berlabel sama). ` +
      `"nilai" HANYA angka (contoh "221,35"), satuan ditulis terpisah di "satuan" dan wajib pakai salah satu bentuk ini: ` +
      `"Rp triliun", "Rp miliar", "Rp juta", "%", "unit", atau "orang". ` +
      `(4) deltaLabel hanya kalau dokumen benar-benar membandingkan dua periode (contoh "+0,63% vs 2024"). Kalau tidak ada, kosongkan. ` +
      `(5) grafik: isi hanya kalau dokumen memuat angka beberapa periode atau kategori sekaligus. kategori 3 sampai 6 label, setiap seri panjangnya sama dengan kategori, semua angka dari dokumen. ` +
      `(6) tabel: maksimal 4 kolom, maksimal 5 baris, isinya angka atau nama entitas pendek. ` +
      `(7) narasi: maksimal 45 kata berisi ringkasan kinerja dari dokumen. Jangan menyalin visi misi, syarat sandi, atau kebijakan internal. ` +
      `Angka wajib berasal dari dokumen yang benar-benar ada. Untuk setiap angka sertakan docName, page, dan chunkSnippet aslinya.`;
  }

  /**
   * JALUR A via /extract: minta layanan RAG mengembalikan angka nyata dari
   * dokumen dalam bentuk JSON terstruktur, lalu ubah jadi Widget Spec.
   * Mengembalikan null kalau endpoint tidak mendukung atau tidak ada temuan,
   * sehingga pemanggil bisa lanjut ke jalur retrieval biasa (Jalur B).
   */
  private async cobaExtractJalurA(
    base: string,
    cfg: { apiKey: string; kbId?: string; timeoutMs: number },
    options: RagQueryOptions
  ): Promise<{ structuredJson: any; citations: Citation[]; chunks: SectorDocumentChunk[] } | null> {
    const item = await this.ambilPayloadExtract(
      base,
      cfg,
      this.instruksiDashboard(options),
      SKEMA_EKSTRAKSI,
      options.kbId
    );
    if (!item) return null;

    const widgets = payloadKeWidgetSpec(item, options.sector);
    if (widgets.length === 0) {
      console.warn('[rag] /extract mengembalikan data, tetapi tidak ada widget yang lolos — lanjut ke Jalur B');
      return null;
    }
    const structuredJson = {
      dashboardTitle: potong(item.dashboardTitle, BATAS_TEKS.judulDash) || `Dashboard ${options.sector.toUpperCase()}`,
      description:
        potong(item.description, BATAS_TEKS.deskripsi) ||
        'Disintesis dari dokumen resmi lewat ekstraksi terstruktur.',
      sector: options.sector,
      widgets,
    };
    const citations: Citation[] = widgets.map((w: any) => w.citations[0]);
    const chunks: SectorDocumentChunk[] = citations.map((c, i) => ({
      id: `chunk-extract-${i + 1}`,
      docName: c.docName,
      page: c.page,
      date: c.date || '',
      snippet: c.chunkSnippet,
      sector: options.sector,
      metadata: {
        unitKerja: widgets[i]?.unitKerja,
        metric: widgets[i]?.title,
        periode: widgets[i]?.periode,
        nilai: undefined,
        satuan: undefined,
      },
    } as unknown as SectorDocumentChunk));
    return { structuredJson, citations, chunks };
  }

  /**
   * Ambil data NYATA satu indikator untuk katalog preset widget.
   * Tidak ada angka contoh: kalau dokumen tidak memuat indikator itu, hasilnya null
   * dan pemanggil harus menampilkan pesan gagal, bukan angka karangan.
   */
  async ambilDataWidget(
    query: string,
    sector: BumdSector,
    tipeTarget: string,
    instansi?: string,
    kbId?: string,
    opsi?: { lemparSaatGagal?: boolean }
  ): Promise<{ data: any | null; judul?: string; deskripsi?: string; alasan?: string } | null> {
    const cfg = this.getRagConfig();
    if (cfg.provider !== 'http' || !cfg.baseUrl || !cfg.apiKey) return null;
    const { dipakai } = await this.resolveBase(cfg);
    const fokus =
      ['kpi', 'bullet-target', 'gauge'].includes(tipeTarget)
        ? 'kpi'
        : ['line', 'area', 'bar', 'hbar', 'combo', 'pie', 'donut', 'treemap', 'funnel',
           'waterfall', 'sankey', 'scatter', 'bubble', 'histogram', 'boxplot', 'heatmap',
           'radar', 'map', 'gantt'].includes(tipeTarget)
          ? 'grafik'
          : tipeTarget === 'table'
            ? 'tabel'
            : 'narasi';
    const aturanFokus =
      fokus === 'kpi'
        ? 'Isi "nilai" hanya angka, satuan terpisah dan wajib salah satu bentuk: "Rp triliun", "Rp miliar", "Rp juta", "%", "unit", "orang". ' +
          'Kalau dokumen juga memuat angka PERIODE SEBELUMNYA untuk indikator ini (tahun lalu/triwulan lalu), isi "nilaiLalu" dengan angka itu; kalau tidak ada, kosongkan. '
        : fokus === 'grafik'
          ? 'Isi 3 sampai 6 label kategori dari dokumen, dan setiap seri panjangnya sama dengan jumlah kategori. Angka dari dokumen. '
          : fokus === 'tabel'
            ? 'Isi maksimal 4 kolom dan 5 baris dengan angka nyata dari dokumen. '
            : 'Isi maksimal 45 kata ringkasan dari dokumen, bukan visi misi atau kebijakan internal. ';
    const sebutanInstansi = kbId?.trim()
      ? `Semua dokumen di knowledge base ini milik SATU instansi; pakai dokumen yang ada apa adanya. `
      : instansi?.trim()
        ? `Instansi yang diminta: "${instansi.trim()}" (sektor ${sector.toUpperCase()}). Ambil angka HANYA dari dokumen instansi ini; abaikan dokumen instansi lain. `
        : `Konteks instansi: ${sector.toUpperCase()}. `;
    const instruksi =
      `Ambil data untuk SATU widget dashboard dari dokumen resmi di knowledge base ini. ` +
      sebutanInstansi +
      `Indikator yang diminta: "${query}". ` +
      `Kalau dokumen tidak memuat istilah persisnya (misalnya target atau pagu RKAP, laporan bulanan, ` +
      `atau istilah internal yang tidak ada), pakai angka terdekat yang BENAR-BENAR ADA di dokumen dan ` +
      `sebutkan dasar angkanya secara singkat (maksimal 8 kata). Semua angka wajib dari dokumen. ` +
      aturanFokus +
      `Wajib mengisi docName, page, dan chunkSnippet dengan isi dokumen aslinya.`;
    // Bungkus hasil fokus ke bentuk payload dashboard supaya pemetaan & pembersih
    // (potong teks, angka gaya Indonesia, satuan seragam) dipakai ulang apa adanya.
    const bungkus = (hasil: any) =>
      payloadKeWidgetSpec(
        fokus === 'kpi'
          ? { dashboardTitle: hasil?.label, kpi: [hasil] }
          : fokus === 'grafik'
            ? { dashboardTitle: hasil?.judul, grafik: hasil }
            : fokus === 'tabel'
              ? { dashboardTitle: hasil?.judul, tabel: hasil }
              : { dashboardTitle: hasil?.judul, narasi: hasil },
        sector
      );

    let item = await this.ambilPayloadExtract(dipakai, cfg, instruksi, SKEMA_FOKUS[fokus], kbId, opsi);
    if (!item) return null;
    let widgets = bungkus(item);

    // Percobaan kedua: istilah internal BUMD (RKAP, LRA, per unit kerja, bulanan)
    // sering tidak ada di dokumen yang tersedia. Ulangi dengan pertanyaan bersih
    // supaya yang diambil adalah angka terdekat yang benar-benar ada.
    if (widgets.length === 0) {
      const polos = String(query)
        .replace(/\b(vs\.?|dibandingkan|dibanding)\s+target[^?.!,]*/gi, '')
        .replace(/\b(RKAP|LRA|RBA|opex|Opex|OPEX)\b/g, '')
        .replace(/\b(tahun berjalan|triwulan(an)?|bulanan|per bulan|bulan terakhir|unit kerja|per wilayah|antar wilayah|wilayah [a-z]+)\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([?.!,])/g, '$1')
        .trim();
      console.warn(`[rag] percobaan kedua untuk preset: "${polos}"`);
      const instruksiUmum =
        `Ambil data untuk SATU widget dashboard dari dokumen resmi di knowledge base ini. ` +
        sebutanInstansi +
        `Pertanyaan: "${polos || query}". ` +
        `Pakai angka TERDEKAT yang benar-benar ada di dokumen (misalnya pendapatan, aset, laba, jumlah pelanggan, ` +
        `atau rasio yang tersedia) dan sebutkan dasar angkanya secara singkat pada label atau judul (maksimal 8 kata). ` +
        aturanFokus +
        `Semua angka wajib dari dokumen, tidak boleh dikarang. Wajib mengisi docName, page, dan chunkSnippet asli.`;
      const item2 = await this.ambilPayloadExtract(dipakai, cfg, instruksiUmum, SKEMA_FOKUS[fokus], kbId, opsi);
      if (item2) {
        item = item2;
        widgets = bungkus(item2);
      }
    }

    if (widgets.length === 0) {
      console.warn(
        '[rag] ambilDataWidget kosong: ' +
          JSON.stringify({
            fokus,
            item: JSON.stringify(item).slice(0, 300),
          }).slice(0, 500)
      );
    }
    const cocok =
      widgets.find((w: any) => w.type === tipeTarget) ||
      (['kpi', 'bullet-target', 'gauge'].includes(tipeTarget)
        ? widgets.find((w: any) => !!w.kpi)
        : undefined) ||
      (['bar', 'hbar', 'line', 'area', 'combo', 'pie', 'donut', 'treemap', 'funnel', 'radar',
        'scatter', 'bubble', 'histogram', 'boxplot', 'heatmap', 'waterfall', 'sankey', 'map',
        'gantt'].includes(tipeTarget)
        ? widgets.find((w: any) => !!w.chart || !!w.geo || !!w.gantt)
        : undefined) ||
      widgets.find((w: any) => w.type === fokus) ||
      widgets[0];
    if (!cocok) return null;

    // Tipe yang dipilih di katalog WAJIB dihormati. Kalau bentuk datanya tidak
    // mendukung (mis. peta tanpa rincian wilayah), jangan diam-diam mengembalikan
    // batang — kembalikan alasan supaya katalog jujur dan kartu di kanvas sama
    // dengan pratinjaunya.
    const selaras = selaraskanTipe(cocok, tipeTarget);
    if (!selaras.ok || !selaras.widget) {
      return {
        data: null,
        judul: item.dashboardTitle,
        deskripsi: item.description,
        alasan: selaras.alasan || `Tipe ${tipeTarget} tidak bisa dibuat dari data dokumen ini.`,
      };
    }
    return { data: selaras.widget, judul: item.dashboardTitle, deskripsi: item.description };
  }

  async query(options: RagQueryOptions): Promise<RagResult> {
    const cfg = this.getRagConfig();
    if (cfg.provider !== 'http' || !cfg.baseUrl || !cfg.apiKey) {
      return this.mock.query(options);
    }

    const start = Date.now();
    const timeoutMs = Math.max(5, cfg.timeoutMs || 60) * 1000;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const { dipakai } = await this.resolveBase(cfg);

      // JALUR A lebih dulu: /extract mengembalikan angka nyata + sumbernya.
      // Jika mode === 'prose' (tanya-jawab / chat biasa), langsung gunakan /query
      // agar dijawab oleh LLM dengan narasi teks dan kutipan sumber.
      if (options.mode !== 'prose' && cfg.useExtract !== false) {
        const hasil = await this.cobaExtractJalurA(dipakai, cfg, options);
        if (hasil) {
          return {
            provider: 'http',
            mode: 'Jalur A',
            latencyMs: Date.now() - start,
            answer: `Ekstraksi terstruktur dari ${hasil.chunks.length} indikator dokumen resmi.`,
            structuredJson: hasil.structuredJson,
            chunks: hasil.chunks,
            citations: hasil.citations,
          };
        }
      }

      const res = await fetch(`${dipakai}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          // Kontrak ragjev: field bernama `query`, retrieval selalu scoped KB.
          query: options.prompt,
          // KB per-instansi menimpa KB global — inilah yang mencegah dashboard
          // instansi A dijawab dokumen instansi B. KB campur dilewati (kbAman).
          ...(() => {
            const kb = kbAman(options.kbId, cfg.kbId);
            return kb ? { knowledge_base_id: kb } : {};
          })(),
          options: { top_k: 8, include_sources: true },
        }),
        signal: ac.signal,
      });
      if (!res.ok) {
        throw new Error(`RAG HTTP ${res.status}`);
      }
      const raw = await res.json();

      // Kontrak ragjev: { success, data: { answer, grounded, sources: [...], usage } }
      // Kontrak generik lama (tetap didukung): { answer?, structuredJson?, chunks: [...] }
      const payload = raw?.data && raw.success !== undefined ? raw.data : raw;
      const sources: any[] = Array.isArray(payload?.sources) ? payload.sources : [];
      const chunks: SectorDocumentChunk[] = Array.isArray(payload?.chunks)
        ? payload.chunks
        : sources.map((s: any, i: number) => ({
            id: s.chunk_id || s.document_id || `src-${i}`,
            docName: s.document_name || s.docName || 'Dokumen Sumber',
            page: s.page || 1,
            date: '',
            // Pakai teks potongan asal bila layanan menyediakannya. Kalau tidak ada
            // (mis. hanya metadata), pakai jawaban sebagai deskripsi sumber.
            snippet: s.text || s.chunk_text || s.content || s.snippet || payload?.answer || '',
            metadata: { confidenceScore: typeof s.score === 'number' ? s.score : undefined },
          }));
      const structuredJson = payload?.structuredJson ?? payload?.structured ?? null;
      const mode: 'Jalur A' | 'Jalur B' = structuredJson ? 'Jalur A' : 'Jalur B';

      const citations: Citation[] = chunks.map((c, idx) => ({
        id: c.id ? `cit-${c.id}` : `cit-http-${idx}`,
        docName: c.docName || 'Dokumen Sumber',
        page: c.page || 1,
        chunkSnippet: c.snippet || '',
        confidenceScore: (c.metadata as any)?.confidenceScore ?? 0.9,
        date: c.date || '',
        unitKerja: c.metadata?.unitKerja,
        metric: c.metadata?.metric,
      }));

      return {
        provider: 'http',
        mode,
        latencyMs: Date.now() - start,
        answer: payload?.answer ?? raw?.answer,
        structuredJson,
        chunks,
        citations,
      };
    } catch (err) {
      console.error('[RAG HTTP] Gagal, fallback ke mock:', jelaskanError(err));
      const fallback = await this.mock.query(options);
      return { ...fallback, provider: 'mock' };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Daftar dokumen di sebuah knowledge base — dipakai panel admin supaya saat KB ID
   * dimasukkan, langsung terlihat ADA BERAPA dokumen dan dokumen APA SAJA.
   *
   * Memakai endpoint `GET {base}/knowledge?knowledge_base_id=<kb>`. Bentuk respons
   * layanan RAG bisa berbeda-beda, jadi beberapa bentuk wadah dicoba. Kalau endpoint
   * tidak ada (404/405), mengembalikan `jumlah: 0` dengan `catatan` yang jujur —
   * JANGAN diartikan "KB kosong" tanpa membedakan galat layanan.
   */
  async daftarDokumen(kbId: string): Promise<{
    kbId: string;
    jumlah: number;
    dokumen: Array<{
      id: string;
      nama: string;
      status?: string;
      halaman?: number;
      potongan?: number;
      token?: number;
      dibuat?: string;
      ringkasan?: string;
    }>;
    catatan?: string;
  }> {
    const cfg = this.getRagConfig();
    const kb = String(kbId || '').trim();
    if (!kb) {
      return { kbId: '', jumlah: 0, dokumen: [], catatan: 'Knowledge Base ID masih kosong.' };
    }
    if (cfg.provider !== 'http' || !cfg.baseUrl || !cfg.apiKey) {
      return {
        kbId: kb,
        jumlah: 0,
        dokumen: [],
        catatan: 'Provider RAG bukan "HTTP" (mode mock) — daftar dokumen hanya tersedia untuk layanan RAG nyata.',
      };
    }
    const { dipakai } = await this.resolveBase(cfg);
    const timeoutMs = Math.min(Math.max(5, cfg.timeoutMs || 60) * 1000, 30000);
    let res: Response;
    try {
      res = await fetch(`${dipakai}/knowledge?knowledge_base_id=${encodeURIComponent(kb)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      return {
        kbId: kb,
        jumlah: 0,
        dokumen: [],
        catatan: `Tidak bisa menghubungi layanan RAG: ${err instanceof Error ? err.message : 'kesalahan jaringan'}`,
      };
    }
    if (res.status === 404 || res.status === 405) {
      return {
        kbId: kb,
        jumlah: 0,
        dokumen: [],
        catatan: 'Layanan RAG ini tidak menyediakan endpoint /knowledge, jadi daftar dokumen tidak bisa dibaca.',
      };
    }
    if (!res.ok) {
      return {
        kbId: kb,
        jumlah: 0,
        dokumen: [],
        catatan: `Layanan RAG menjawab HTTP ${res.status} — ini galat layanan, bukan berarti KB kosong.`,
      };
    }
    const mentah: any = await res.json().catch(() => null);
    // Beberapa bentuk wadah yang pernah terlihat: {data:{documents}}, {documents}, {data:[...]}, [...]
    const daftarMentah: any[] =
      (Array.isArray(mentah?.data?.documents) && mentah.data.documents) ||
      (Array.isArray(mentah?.documents) && mentah.documents) ||
      (Array.isArray(mentah?.data) && mentah.data) ||
      (Array.isArray(mentah?.data?.items) && mentah.data.items) ||
      (Array.isArray(mentah?.items) && mentah.items) ||
      (Array.isArray(mentah) && mentah) ||
      [];

    const dokumen = daftarMentah
      .map((d: any) => ({
        id: String(d?.document_id ?? d?.id ?? d?.doc_id ?? ''),
        nama: String(d?.document_name ?? d?.name ?? d?.filename ?? d?.title ?? '(tanpa nama)'),
        status: d?.status ? String(d.status) : undefined,
        halaman: Number.isFinite(Number(d?.pages)) ? Number(d.pages) : undefined,
        potongan: Number.isFinite(Number(d?.chunks)) ? Number(d.chunks) : undefined,
        token: Number.isFinite(Number(d?.tokens)) ? Number(d.tokens) : undefined,
        dibuat: d?.created_at ? String(d.created_at) : undefined,
        ringkasan: d?.summary ? String(d.summary) : undefined,
      }))
      .filter((d) => d.id || d.nama !== '(tanpa nama)');

    return {
      kbId: kb,
      jumlah: dokumen.length,
      dokumen,
      catatan:
        dokumen.length === 0
          ? 'KB ini tidak memuat dokumen (atau ID-nya salah). Pastikan dokumen sudah diunggah ke KB tersebut.'
          : undefined,
    };
  }

  /**
   * Profil instansi dari dokumen KB: nama, kota, sektor, ringkasan.
   *
   * Nama instansi dipakai apa adanya saat menyusun dashboard (nama yang tidak cocok
   * dengan dokumen membuat model menolak dokumen dan turun ke jalur miskin widget),
   * jadi field ini harus berasal dari dokumen — bukan dari tebakan.
   *
   * Nilainya diambil dari dokumen lewat /query (bukan dikarang). Kalau dokumen tidak
   * memuat, field dibiarkan kosong supaya admin mengisinya manual.
   */
  async profilInstansi(kbId: string): Promise<{
    kbId: string;
    nama?: string;
    kota?: string;
    sektor?: BumdSector;
    jumlahDokumen: number;
    ringkasan?: string;
    catatan?: string;
  }> {
    const cfg = this.getRagConfig();
    const kb = String(kbId || '').trim();
    if (!kb) return { kbId: '', jumlahDokumen: 0, catatan: 'Knowledge Base ID masih kosong.' };

    // Daftar dokumen lebih dulu: jumlahnya selalu dilaporkan, dan kalau KB kosong
    // tidak perlu memanggil LLM sama sekali.
    const daftar = await this.daftarDokumen(kb);
    if (daftar.jumlah === 0) {
      return {
        kbId: kb,
        jumlahDokumen: 0,
        catatan: daftar.catatan || 'KB ini tidak memuat dokumen.',
      };
    }

    // Ringkasan isi = daftar nama dokumen (selalu ada, tanpa memanggil LLM).
    const ringkasan = daftar.dokumen.map((d) => d.nama).join('; ');

    if (cfg.provider !== 'http' || !cfg.baseUrl || !cfg.apiKey) {
      return {
        kbId: kb,
        jumlahDokumen: daftar.jumlah,
        ringkasan,
        catatan: 'Provider RAG bukan "HTTP" (mode mock) — profil instansi tidak bisa dibaca dari dokumen.',
      };
    }

    const { dipakai } = await this.resolveBase(cfg);
    const timeoutMs = Math.min(Math.max(5, cfg.timeoutMs || 60) * 1000, 60000);
    const prompt =
      'Dari dokumen resmi instansi ini, jawab SINGKAT dalam format persis seperti ini:\n' +
      'NAMA: <nama lengkap perusahaan/instansi>\n' +
      'KOTA: <kota atau kabupaten domisili>\n' +
      'SEKTOR: <satu kata: air, bank, pasar, rsud, transportasi, atau aneka_usaha>\n' +
      'Hanya isi dari dokumen. Kalau tidak ada di dokumen, tulis "-".';

    try {
      const res = await fetch(`${dipakai}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
          query: prompt,
          knowledge_base_id: kb,
          options: { top_k: 5, include_sources: false },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        return {
          kbId: kb,
          jumlahDokumen: daftar.jumlah,
          ringkasan,
          catatan: `Layanan RAG menjawab HTTP ${res.status} saat membaca profil instansi (bukan berarti KB kosong).`,
        };
      }
      const mentah: any = await res.json().catch(() => null);
      const wadah = mentah?.data && mentah.success !== undefined ? mentah.data : mentah;
      const jawaban = String(wadah?.answer ?? wadah?.result ?? wadah?.text ?? '');

      const ambil = (label: string): string | undefined => {
        const m = jawaban.match(new RegExp(`${label}\\s*[:=]\\s*(.+)`, 'i'));
        const v = m?.[1]?.split('\n')[0]?.trim();
        // Model sering menulis "-" saat tidak ada di dokumen; itu bukan nilai.
        if (!v || /^-+$/.test(v) || /^(tidak ada|n\/a|unknown)$/i.test(v)) return undefined;
        return v.replace(/\[[0-9,\s]+\]/g, '').replace(/\s+/g, ' ').trim() || undefined;
      };

      const nama = ambil('NAMA');
      const kota = ambil('KOTA');
      const sektorMentah = (ambil('SEKTOR') || '').toLowerCase();
      // Petakan jawaban bebas ke sektor baku aplikasi (harus salah satu dari BumdSector).
      const petaSektor: Array<[RegExp, BumdSector]> = [
        [/\bair\b|pdam|perumda air|tirta|air minum/, 'pdam'],
        [/bank|bpr|kredit/, 'bank'],
        [/pasar|retribusi pasar/, 'pasar'],
        [/rsud|rumah sakit|klinik|kesehatan/, 'rsud'],
        [/transportasi|angkutan|bus|trans/, 'transportasi'],
        [/aneka|pariwisata|jasa lainnya|perdagangan/, 'aneka_usaha'],
      ];
      const sektor = petaSektor.find(([re]) => re.test(sektorMentah))?.[1];

      return {
        kbId: kb,
        nama,
        kota,
        sektor,
        jumlahDokumen: daftar.jumlah,
        ringkasan,
        catatan:
          !nama && !kota
            ? 'Dokumen tidak menyebutkan nama/kota instansi secara eksplisit — isi manual.'
            : undefined,
      };
    } catch (err) {
      return {
        kbId: kb,
        jumlahDokumen: daftar.jumlah,
        ringkasan,
        catatan: `Gagal membaca profil instansi: ${err instanceof Error ? err.message : 'kesalahan jaringan'}`,
      };
    }
  }

  /**
   * Uji API Key RAG dengan benar-benar memanggil layanan.
   *
   * Endpoint yang dipakai: GET {base}/knowledge (tanpa parameter KB). Ini endpoint
   * yang TERBUKTI memeriksa kredensial — key salah dijawab 401 `AUTH_INVALID`,
   * sedangkan `/health` selalu 200 walaupun key-nya ngawur, jadi `/health` tidak
   * bisa dipakai untuk menguji key.
   */
  async ujiApiKey(): Promise<{
   ok: boolean;
   status: 'valid' | 'invalid' | 'tidak-terhubung' | 'endpoint-tidak-ada' | 'galat-layanan';
   httpStatus?: number;
   latencyMs: number;
   baseDipakai?: string;
   pesan: string;
   kodeGalat?: string;
 }> {
   const cfg = this.getRagConfig();
   if (cfg.provider !== 'http') {
     return {
       ok: false,
       status: 'galat-layanan',
       latencyMs: 0,
       pesan:
         'Provider masih "Mock", jadi API Key tidak dipakai sama sekali. Ubah Provider ke "HTTP" lebih dulu.',
     };
   }
   if (!cfg.baseUrl) {
     return { ok: false, status: 'galat-layanan', latencyMs: 0, pesan: 'Base URL RAG masih kosong.' };
   }
   if (!cfg.apiKey) {
     return { ok: false, status: 'galat-layanan', latencyMs: 0, pesan: 'API Key masih kosong.' };
   }

   const mulai = Date.now();
   let dipakai: string;
   try {
     const r = await this.resolveBase(cfg);
     dipakai = r.dipakai;
   } catch (err) {
     return {
       ok: false,
       status: 'tidak-terhubung',
       latencyMs: Date.now() - mulai,
       pesan: `Base URL tidak bisa dipakai: ${err instanceof Error ? err.message : 'alamat tidak sah'}`,
     };
   }

   const timeoutMs = Math.min(Math.max(5, cfg.timeoutMs || 60) * 1000, 30000);
   try {
     const res = await fetch(`${dipakai}/knowledge`, {
       method: 'GET',
       headers: { Authorization: `Bearer ${cfg.apiKey}` },
       signal: AbortSignal.timeout(timeoutMs),
     });
     const latencyMs = Date.now() - mulai;

     if (res.status === 401 || res.status === 403) {
       let kodeGalat: string | undefined;
       try {
         const j: any = await res.json();
         kodeGalat = j?.error?.code || j?.code;
       } catch {
         /* balasan bukan JSON — biarkan kosong */
       }
       return {
         ok: false,
         status: 'invalid',
         httpStatus: res.status,
         latencyMs,
         baseDipakai: dipakai,
         kodeGalat,
         pesan:
           res.status === 401
             ? 'API Key DITOLAK layanan RAG (401 Unauthorized). Periksa kembali key-nya.'
             : 'API Key tidak punya izin (403 Forbidden).',
       };
     }

     if (res.status === 404 || res.status === 405) {
       return {
         ok: false,
         status: 'endpoint-tidak-ada',
         httpStatus: res.status,
         latencyMs,
         baseDipakai: dipakai,
         pesan: `Layanan menjawab HTTP ${res.status}: endpoint /knowledge tidak ada di alamat ini. Periksa Base URL.`,
       };
     }

     if (!res.ok) {
       return {
         ok: false,
         status: 'galat-layanan',
         httpStatus: res.status,
         latencyMs,
         baseDipakai: dipakai,
         pesan: `Layanan RAG menjawab HTTP ${res.status}. Ini galat layanan, bukan berarti key salah.`,
       };
     }

     // 200 = key diterima.
     let jumlahDokumen: number | undefined;
     try {
       const j: any = await res.json();
       const arr = j?.data?.documents ?? j?.documents ?? j?.data ?? j?.items;
       if (Array.isArray(arr)) jumlahDokumen = arr.length;
     } catch {
       /* balasan bukan JSON — key tetap dianggap valid karena 200 */
     }

     return {
       ok: true,
       status: 'valid',
       httpStatus: res.status,
       latencyMs,
       baseDipakai: dipakai,
       pesan: `API Key VALID — layanan menerima kredensial ini (HTTP 200, ${latencyMs} ms)${
         jumlahDokumen !== undefined
           ? `. Layanan ini memuat ${jumlahDokumen} dokumen (seluruh KB, bukan satu KB saja)`
           : ''
       }.`,
     };
   } catch (err: any) {
     const latencyMs = Date.now() - mulai;
     const kode = err?.cause?.code || '';
     // ENOTFOUND = nama domainnya tidak ada di DNS. Ini BEDA dari internet mati,
     // dan bedanya penting: user perlu tahu yang salah adalah alamatnya, bukan
     // koneksinya, supaya tidak mengecek hal yang tidak perlu.
     const pesan =
       kode === 'ENOTFOUND'
         ? `Domain "${dipakai.replace(/^https?:\/\//, '').split('/')[0]}" TIDAK ADA di DNS (ENOTFOUND). Alamatnya salah ketik atau subdomain-nya belum dibuat — periksa ejaan Base URL.`
         : kode === 'ECONNREFUSED'
           ? `Layanan di ${dipakai} menolak koneksi (ECONNREFUSED). Alamat benar tetapi tidak ada layanan yang mendengarkan di sana.`
           : kode === 'CERT_HAS_EXPIRED' || /certificate/i.test(String(err?.message))
             ? `Sertifikat HTTPS di ${dipakai} bermasalah. Hubungi penyedia layanan RAG.`
             : `Tidak bisa menghubungi layanan RAG di ${dipakai} (${kode || err?.message || 'kesalahan jaringan'}). Periksa Base URL dan koneksi internet.`;
     return {
       ok: false,
       status: 'tidak-terhubung',
       latencyMs,
       baseDipakai: dipakai,
       pesan,
     };
   }
 }

 async probe(): Promise<{
    latencyMs: number;
    canOutputJson: boolean;
    hasMetadata: boolean;
    sampleChunksCount: number;
    detectedMode: 'Jalur A' | 'Jalur B';
    baseDipakai?: string;
    baseDisesuaikan?: boolean;
    catatan?: string[];
  }> {
    const cfg = this.getRagConfig();
    const start = Date.now();
    if (cfg.provider !== 'http' || !cfg.baseUrl || !cfg.apiKey) {
      return this.mock.probe();
    }
    const timeoutMs = Math.max(5, cfg.timeoutMs || 60) * 1000;
    const catatan: string[] = [];
    const { dipakai, disesuaikan } = await this.resolveBase(cfg);
    if (disesuaikan) catatan.push(`Base URL disesuaikan otomatis menjadi ${dipakai}`);

    // Layanan RAG ini MEWAJIBKAN knowledge_base_id pada /search dan /query
    // ("retrieval is always scoped to a knowledge base") — tanpa itu dijawab 422.
    // KB global di panel boleh kosong (KB dipasang per-instansi), jadi kalau kosong
    // kita pakai KB pertama yang tersedia agar uji koneksi tetap bisa berjalan.
    let kbUji = cfg.kbId;
    if (!kbUji) {
      try {
        const kbRes = await fetch(`${dipakai}/knowledge`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${cfg.apiKey}` },
          signal: AbortSignal.timeout(Math.min(timeoutMs, 20000)),
        });
        if (kbRes.ok) {
          const j: any = await kbRes.json().catch(() => null);
          const docs = j?.data?.documents ?? j?.documents ?? [];
          const idPertama = Array.isArray(docs)
            ? docs.map((d: any) => d?.knowledge_base_id).filter(Boolean)[0]
            : undefined;
          if (idPertama) {
            kbUji = String(idPertama);
            catatan.push(
              `Knowledge Base global kosong — uji memakai KB "${kbUji}" (KB pertama yang tersedia di layanan)`
            );
          }
        }
      } catch {
        /* tidak fatal — biarkan jatuh ke pesan di bawah */
      }
    }
    if (!kbUji) {
      catatan.push(
        'Tidak ada Knowledge Base yang bisa dipakai untuk uji. Layanan ini mewajibkan knowledge_base_id, jadi uji retrieval dilewati.'
      );
    }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      // 1) Cek endpoint health — 404 TIDAK dianggap fatal, karena ada layanan
      //    yang tidak menyediakan /health tapi /query-nya jalan.
      try {
        const healthRes = await fetch(`${dipakai}/health`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${cfg.apiKey}` },
          signal: ac.signal,
        });
        await healthRes.json().catch(() => ({}));
        if (!healthRes.ok) {
          catatan.push(`Endpoint /health menjawab ${healthRes.status} (tidak fatal, lanjut uji /query)`);
        }
      } catch (err) {
        if (err instanceof Error && /aborted|timeout/i.test(err.message)) {
          throw new Error('Timeout — RAG tidak merespons tepat waktu');
        }
        catatan.push('Endpoint /health tidak dapat dihubungi (tidak fatal, lanjut uji /query)');
      }

      // 2) Ambil potongan dokumen lewat /search (retrieval saja) — cepat dan
      //    tidak menunggu generasi LLM yang bisa 30-60 detik. Kalau endpoint
      //    /search tidak ada, baru jatuh ke /query sebagai cadangan.
      let structured: any = null;
      let chunks: any[] = [];
      const cari = await fetch(`${dipakai}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          query: RAG_PROMPTS.PROBE_TEST,
          ...(kbUji ? { knowledge_base_id: kbUji } : {}),
          top_k: 5,
          options: { top_k: 5, include_sources: true },
        }),
        signal: ac.signal,
      });
      if (cari.ok) {
        const rawSearch: any = await cari.json().catch(() => null);
        const wadah = rawSearch?.data && rawSearch.success !== undefined ? rawSearch.data : rawSearch;
        const sumber = Array.isArray(wadah?.sources)
          ? wadah.sources
          : Array.isArray(wadah?.chunks)
            ? wadah.chunks
            : Array.isArray(wadah?.results)
              ? wadah.results
              : [];
        chunks = sumber;
      } else {
        catatan.push(`/search menjawab ${cari.status} — memakai /query sebagai cadangan`);
        const qRes = await fetch(`${dipakai}/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify({
            query: RAG_PROMPTS.PROBE_TEST,
            ...(kbUji ? { knowledge_base_id: kbUji } : {}),
            options: { top_k: 5, include_sources: true },
          }),
          signal: ac.signal,
        });
        if (!qRes.ok) throw new Error(`RAG HTTP ${qRes.status}`);
        const raw: any = await qRes.json().catch(() => null);
        const sample = raw?.data && raw.success !== undefined ? raw.data : raw;
        structured = sample?.structuredJson ?? sample?.structured ?? null;
        chunks = Array.isArray(sample?.chunks) ? sample.chunks : Array.isArray(sample?.sources) ? sample.sources : [];
      }

      // 3) Deteksi kemampuan Jalur A (endpoint /extract) TANPA memanggil LLM:
      //    kirim body kosong dan lihat kodenya. 422 = endpoint ada (validasi
      //    menolak), 404/405 = tidak tersedia.
      let extractTersedia = false;
      try {
        const ex = await fetch(`${dipakai}/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(8000),
        });
        extractTersedia = ex.status === 422 || ex.status === 400;
        if (extractTersedia) {
          catatan.push(
            cfg.useExtract === false
              ? 'Endpoint /extract tersedia tetapi dimatikan di konfigurasi (Jalur A nonaktif)'
              : 'Endpoint /extract tersedia — Jalur A (angka nyata + halaman sumber) dipakai lebih dulu'
          );
        }
      } catch {
        /* tidak fatal */
      }

      if (chunks.length === 0) {
        catatan.push('Retrieval tidak menemukan dokumen — cek Knowledge Base ID (KB mungkin kosong/salah)');
      }

      return {
        latencyMs: Date.now() - start,
        canOutputJson: !!structured || (extractTersedia && cfg.useExtract !== false),
        hasMetadata: chunks.length > 0,
        sampleChunksCount: chunks.length,
        detectedMode: !!structured || (extractTersedia && cfg.useExtract !== false) ? 'Jalur A' : 'Jalur B',
        baseDipakai: dipakai,
        baseDisesuaikan: disesuaikan,
        catatan,
      };
    } catch (err) {
      throw new Error(jelaskanError(err));
    } finally {
      clearTimeout(timer);
    }
  }
}
