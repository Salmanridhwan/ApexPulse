/**
 * EKSTRAKSI BUTIR DATA DARI DOKUMEN.
 *
 * Satu-satunya bagian Fase 2 yang memanggil model. Karena itu, semua yang bisa
 * diputuskan tanpa model diputuskan di sini — secara deterministik:
 *
 * - Kategori TIDAK ditanyakan ke model (`kategoriWidget` menurunkannya dari nama
 *   butir & nama seri). Model yang menentukan kategori akan memberi jawaban
 *   berbeda untuk butir yang sama di dua dokumen.
 * - Bentuk widget juga diturunkan dari BENTUK DATA (angka tunggal, deret, tabel),
 *   bukan dari tebakan.
 * - Butir tanpa nama atau tanpa sitasi tetap disimpan, tetapi keyakinannya
 *   diturunkan menjadi `rendah` supaya tidak lolos sebagai disetujui.
 *
 * Pemanggil model disuntikkan (`Ekstraktor`), jadi modul ini bisa diuji tanpa
 * jaringan dan tanpa token.
 */

import type { ButirData, KeyakinanButir, SeriButir, TabelButir, WidgetType } from '../../types';
import { kategoriWidget } from '../spec/kategoriWidget';

/** Batas butir per dokumen — lebih dari ini berarti dokumennya bukan laporan. */
export const BATAS_BUTIR = 60;

/**
 * Skema yang diminta ke layanan RAG. Model hanya boleh mengisi bentuk ini;
 * `kategori` dan `bentuk` sengaja TIDAK ada di sini karena diturunkan lokal.
 */
export const SKEMA_BUTIR = {
  type: 'object',
  properties: {
    ringkasan: {
      type: 'string',
      description: 'Dua sampai tiga kalimat tentang isi dokumen, tanpa angka karangan.',
    },
    butir: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nama: { type: 'string', description: 'Nama indikator, mis. "Pendapatan Usaha 2024".' },
          periode: { type: 'string', description: 'Periode angka, mis. "2024" atau "TW I 2025".' },
          satuan: { type: 'string', description: 'Satuan angka, mis. "juta rupiah", "orang", "%".' },
          nilai: { type: 'number', description: 'Angka tunggal bila indikatornya satu angka.' },
          seri: {
            type: 'array',
            description: 'Deret angka bila indikatornya punya beberapa titik waktu/kategori.',
            items: {
              type: 'object',
              properties: {
                nama: { type: 'string' },
                data: { type: 'array', items: { type: 'number' } },
                kategori: { type: 'array', items: { type: 'string' } },
              },
              required: ['nama', 'data'],
            },
          },
          tabel: {
            type: 'object',
            description: 'Tabel bila dokumen menyajikan rincian baris-kolom.',
            properties: {
              kolom: { type: 'array', items: { type: 'string' } },
              baris: { type: 'array', items: { type: 'array', items: {} } },
            },
            required: ['kolom', 'baris'],
          },
          sitasi: {
            type: 'object',
            properties: {
              dokumen: { type: 'string', description: 'Nama dokumen persis seperti di sumber.' },
              halaman: { type: 'integer' },
              kutipan: { type: 'string', description: 'Potongan kalimat asli, maksimal 200 huruf.' },
            },
            required: ['dokumen'],
          },
          keyakinan: { type: 'string', enum: ['tinggi', 'sedang', 'rendah'] },
        },
        required: ['nama', 'sitasi'],
      },
    },
  },
  required: ['butir'],
} as const;

export interface KonteksEkstraksi {
  tenantId: string;
  analisisId: string;
  berkasId: string;
  permintaanId?: string;
  judulBerkas: string;
  /** Konteks permintaan user — dipakai menyaring butir yang tidak relevan. */
  bidang?: string;
  dataDiminta?: string;
  arahDashboard?: string;
  instansi?: string;
}

/**
 * Instruksi ke model.
 *
 * Tiga hal yang dijaga: hanya dokumen ini, jangan mengarang angka, dan jangan
 * memaksakan tabel/deret pada indikator yang cuma satu angka.
 */
export function instruksiButir(k: KonteksEkstraksi): string {
  const baris: string[] = [];
  baris.push(
    `Baca dokumen "${k.judulBerkas}"${k.instansi ? ` milik ${k.instansi}` : ''} dan ambil indikator angka yang benar-benar tertulis di dalamnya.`
  );
  baris.push('HANYA dari dokumen ini. Jangan memakai angka dari dokumen lain, jangan mengarang, jangan menaksir.');
  if (k.bidang) baris.push(`Bidang yang diminta: ${k.bidang}.`);
  if (k.dataDiminta) baris.push(`Data yang diminta pemohon: ${k.dataDiminta}`);
  if (k.arahDashboard) baris.push(`Arah dashboard yang diinginkan: ${k.arahDashboard}`);
  baris.push(
    'Untuk setiap indikator isi `nama` (ringkas, menyebut periode bila ada), `periode`, `satuan`, dan salah satu dari: `nilai` (satu angka), `seri` (beberapa titik), atau `tabel` (rincian baris-kolom).'
  );
  baris.push(
    'Setiap butir WAJIB punya `sitasi.dokumen` berisi nama dokumen seperti tertulis, dan `sitasi.kutipan` berisi potongan kalimat aslinya. Butir tanpa kutipan akan dibuang.'
  );
  baris.push(
    'Isi `keyakinan`: "tinggi" bila angka tertulis jelas, "sedang" bila perlu menjumlah/menurunkan, "rendah" bila ragu.'
  );
  baris.push('Jangan membuat butir yang sama dua kali. Bila dokumen tidak memuat angka apa pun, kembalikan `butir` kosong.');
  return baris.join('\n');
}

/** Pemanggil model — disuntikkan supaya modul ini bisa diuji tanpa jaringan. */
export type Ekstraktor = (arg: {
  prompt: string;
  skema: unknown;
  timeoutMs?: number;
}) => Promise<{ ringkasan?: string; butir?: unknown[]; metode?: 'tabel-lokal' | 'rag-extract' }>;

export interface HasilNormalisasi {
  ringkasan?: string;
  butir: ButirData[];
  /** Berapa butir mentah yang dibuang, untuk dilaporkan jujur ke admin. */
  dibuang: number;
}

function teks(v: unknown, maks: number): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\s+/g, ' ').trim().slice(0, maks);
}

/**
 * Angka dari model bisa datang sebagai "1.234,56", "Rp 1.234", atau "12%".
 * Semua dinormalkan ke number; yang tidak bisa dibaca jadi null, bukan 0 —
 * 0 adalah angka yang sah dan tidak boleh dipakai menandai "gagal baca".
 */
export function angka(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.replace(/[^\d,.\-]/g, '').trim();
  if (!s) return null;
  if (s.includes(',')) {
    // "1.234,56" — titik pemisah ribuan, koma desimal.
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.234.567" — titik pemisah ribuan gaya Indonesia, bukan desimal.
    // Tanpa aturan ini "Rp 1.234" terbaca 1,234 dan angkanya salah 1000 kali.
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalisasiKeyakinan(v: unknown): KeyakinanButir {
  const s = String(v || '').toLowerCase();
  if (s === 'tinggi') return 'tinggi';
  if (s === 'sedang') return 'sedang';
  if (s === 'rendah') return 'rendah';
  // Tidak menyebut keyakinan = tidak yakin. Jangan diberi nilai tinggi.
  return 'rendah';
}

function normalisasiSeri(v: unknown): SeriButir[] {
  if (!Array.isArray(v)) return [];
  const hasil: SeriButir[] = [];
  for (const s of v) {
    if (!s || typeof s !== 'object') continue;
    const o = s as Record<string, unknown>;
    const nama = teks(o.nama, 80) || 'Seri';
    const data = Array.isArray(o.data)
      ? o.data.map((d) => angka(d)).filter((d): d is number => d !== null)
      : [];
    if (data.length === 0) continue;
    const kategori = Array.isArray(o.kategori)
      ? o.kategori.map((x) => teks(x, 60)).filter((x) => x.length > 0)
      : undefined;
    hasil.push({ nama, data, ...(kategori && kategori.length === data.length ? { kategori } : {}) });
  }
  return hasil;
}

function normalisasiTabel(v: unknown): TabelButir | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const kolom = Array.isArray(o.kolom) ? o.kolom.map((x) => teks(x, 60)).filter((x) => x.length > 0) : [];
  const baris = Array.isArray(o.baris)
    ? o.baris
        .filter((r): r is unknown[] => Array.isArray(r))
        .map((r) =>
          r.map((sel) => {
            const n = angka(sel);
            return n !== null && typeof sel === 'number' ? n : teks(sel, 80);
          })
        )
        .filter((r) => r.length > 0)
    : [];
  if (kolom.length < 2 || baris.length === 0) return undefined;
  return { kolom, baris };
}

/**
 * Bentuk widget dari bentuk datanya — bukan dari tebakan model.
 * Deret panjang layak garis, deret pendek berlabel lebih jujur sebagai batang
 * atau donat, dan rincian baris-kolom hanya masuk akal sebagai tabel.
 */
export function bentukDari(b: { nilai?: number | null; seri?: SeriButir[]; tabel?: TabelButir }): WidgetType {
  if (b.tabel) return 'table';
  const seri = b.seri || [];
  if (seri.length > 0) {
    const panjang = Math.max(...seri.map((s) => s.data.length));
    const berlabel = seri.some((s) => (s.kategori?.length || 0) >= 3);
    if (panjang >= 5) return 'line';
    if (berlabel) return 'donut';
    return 'bar';
  }
  return 'kpi';
}

/**
 * Ubah keluaran model menjadi butir yang aman disimpan.
 *
 * Butir dibuang hanya bila benar-benar tidak bisa dipakai: tanpa nama, atau
 * tidak punya angka sama sekali. Butir tanpa sitasi TIDAK dibuang — angkanya
 * mungkin berguna — tetapi keyakinannya diturunkan dan statusnya draf.
 */
export function normalisasiButir(
  mentah: unknown,
  k: KonteksEkstraksi,
  opsi?: { batas?: number }
): HasilNormalisasi {
  const batas = opsi?.batas ?? BATAS_BUTIR;
  // Model bisa membalas array langsung, atau objek `{ ringkasan, butir }`.
  const objek: Record<string, any> = Array.isArray(mentah)
    ? { butir: mentah }
    : mentah && typeof mentah === 'object'
      ? (mentah as Record<string, any>)
      : {};
  const daftar = Array.isArray(objek.butir) ? objek.butir : [];
  const hasil: ButirData[] = [];
  const sudahAda = new Set<string>();
  let dibuang = 0;

  for (const item of daftar) {
    if (hasil.length >= batas) break;
    if (!item || typeof item !== 'object') {
      dibuang += 1;
      continue;
    }
    const o = item as Record<string, any>;
    const nama = teks(o.nama ?? o.label ?? o.judul, 120);
    if (!nama) {
      dibuang += 1;
      continue;
    }

    const nilai = angka(o.nilai);
    const seri = normalisasiSeri(o.seri);
    const tabel = normalisasiTabel(o.tabel);
    if (nilai === null && seri.length === 0 && !tabel) {
      dibuang += 1;
      continue;
    }

    const kunci = nama.toLowerCase();
    if (sudahAda.has(kunci)) {
      dibuang += 1;
      continue;
    }
    sudahAda.add(kunci);

    const dokumen = teks(o.sitasi?.dokumen ?? o.docName, 160);
    const kutipan = teks(o.sitasi?.kutipan ?? o.chunkSnippet, 200);
    const halamanMentah = angka(o.sitasi?.halaman ?? o.page);
    const halaman =
      halamanMentah !== null && halamanMentah > 0 && halamanMentah < 10000 ? Math.floor(halamanMentah) : undefined;

    const keyakinanModel = normalisasiKeyakinan(o.keyakinan);
    // Tanpa sitasi dokumen, keyakinan tidak boleh lebih dari `rendah`.
    const keyakinan: KeyakinanButir = dokumen ? keyakinanModel : 'rendah';

    hasil.push({
      id: `btr-${k.analisisId}-${hasil.length + 1}`,
      tenantId: k.tenantId,
      analisisId: k.analisisId,
      berkasId: k.berkasId,
      ...(k.permintaanId ? { permintaanId: k.permintaanId } : {}),
      nama,
      kategori: kategoriWidget(nama, seri.map((s) => s.nama)),
      ...(teks(o.periode, 40) ? { periode: teks(o.periode, 40) } : {}),
      ...(Array.isArray(o.periodeTersedia) && o.periodeTersedia.length > 1
        ? { periodeTersedia: o.periodeTersedia.map((p: unknown) => teks(p, 40)).filter(Boolean).slice(0, 24) }
        : {}),
      ...(teks(o.satuan, 40) ? { satuan: teks(o.satuan, 40) } : {}),
      ...(nilai !== null ? { nilai } : {}),
      ...(seri.length > 0 ? { seri } : {}),
      ...(tabel ? { tabel } : {}),
      bentukDisarankan: bentukDari({ nilai, seri, tabel }),
      sitasi: { dokumen: dokumen || 'Dokumen tidak disebutkan', ...(halaman ? { halaman } : {}), ...(kutipan ? { kutipan } : {}) },
      keyakinan,
      status: 'draf',
      dibuatPada: new Date().toISOString(),
    });
  }

  return { ringkasan: teks(objek.ringkasan, 600) || undefined, butir: hasil, dibuang };
}

/** Ringkasan jumlah butir per keyakinan — untuk pesan setelah analisis. */
export function hitungKeyakinan(butir: ButirData[]): { tinggi: number; sedang: number; rendah: number } {
  const h = { tinggi: 0, sedang: 0, rendah: 0 };
  for (const b of butir) h[b.keyakinan] += 1;
  return h;
}
