import fs from 'node:fs';
import path from 'node:path';
import type { WidgetSpec } from '../../types';

/**
 * GUDANG PRATINJAU TEMPLATE.
 *
 * Latar belakang: dulu tombol "Pakai Template Ini" baru memanggil dokumen saat
 * diklik, sehingga pengguna menunggu 5–15 menit. Sekarang angka template disiapkan
 * LEBIH DULU (saat server hidup, saat dokumen baru masuk ke basis pengetahuan, dan
 * saat halaman template dibuka), lalu disimpan di sini. Tombol berubah menjadi
 * "Pratinjau dengan data asli": kalau sudah siap tampil seketika, kalau belum
 * halaman memberi tahu "masih loading" beserta progresnya.
 *
 * Kunci entri memuat `versiKb` — penanda kapan basis pengetahuan terakhir berubah.
 * Begitu dokumen baru masuk, versi berubah dan entri lama otomatis dianggap basi
 * (harus disiapkan ulang), jadi angka yang ditampilkan tidak pernah ketinggalan.
 */

export type StatusPratinjau = 'belum' | 'proses' | 'siap' | 'gagal';

export interface EntriPratinjau {
  tenantId: string;
  templateId: string;
  kbId: string;
  /** Penanda versi basis pengetahuan (mis. waktu sinkron terakhir). */
  versiKb: string;
  status: StatusPratinjau;
  widgets: WidgetSpec[];
  terisi: number;
  kosong: number;
  catatan: string[];
  progres: { selesai: number; total: number; judul: string };
  mulai: number;
  selesai?: number;
  galat?: string;
}

/** Hasil pengisian yang dikembalikan pekerja (bentuknya sama dengan isiTemplateDariRag). */
export interface HasilPengisian {
  widgets: WidgetSpec[];
  terisi: number;
  kosong: number;
  catatan: string[];
}

const gudang = new Map<string, EntriPratinjau>();
/** Kunci yang sedang diproses — mencegah dua pengisian berjalan bersamaan. */
const berjalan = new Map<string, Promise<EntriPratinjau>>();
let berkas: string | null = null;

/** Kunci unik satu pratinjau: instansi + template + basis pengetahuan. */
export function kunciPratinjau(tenantId: string, templateId: string, kbId: string): string {
  return `${tenantId}|${templateId}|${kbId}`;
}

/** Tentukan berkas penyimpanan lalu muat isinya (dipanggil sekali saat server hidup). */
export function aturBerkasGudang(jalur: string): void {
  berkas = jalur;
  try {
    if (!fs.existsSync(jalur)) return;
    const isi = JSON.parse(fs.readFileSync(jalur, 'utf8')) as EntriPratinjau[];
    for (const e of isi) {
      if (!e || !e.tenantId || !e.templateId) continue;
      // Entri yang terputus saat server mati tidak boleh dianggap "proses" selamanya.
      if (e.status === 'proses') e.status = 'belum';
      gudang.set(kunciPratinjau(e.tenantId, e.templateId, e.kbId), e);
    }
  } catch (err) {
    console.error('[pratinjau] gagal memuat gudang:', err instanceof Error ? err.message : err);
  }
}

function simpanKeBerkas(): void {
  if (!berkas) return;
  try {
    fs.mkdirSync(path.dirname(berkas), { recursive: true });
    fs.writeFileSync(berkas, JSON.stringify([...gudang.values()]), 'utf8');
  } catch (err) {
    console.error('[pratinjau] gagal menyimpan gudang:', err instanceof Error ? err.message : err);
  }
}

export function ambilPratinjau(tenantId: string, templateId: string, kbId: string): EntriPratinjau | null {
  return gudang.get(kunciPratinjau(tenantId, templateId, kbId)) ?? null;
}

/** Semua entri satu instansi (untuk badge status di galeri template). */
export function daftarPratinjau(tenantId: string): EntriPratinjau[] {
  return [...gudang.values()].filter((e) => e.tenantId === tenantId);
}

/**
 * Apakah entri ini masih boleh dipakai? Siap, dan versinya sama dengan versi
 * basis pengetahuan sekarang. Kalau dokumen baru sudah masuk, entri lama basi.
 */
export function masihBerlaku(e: EntriPratinjau | null | undefined, versiKb: string): boolean {
  return !!e && e.status === 'siap' && e.versiKb === versiKb && e.widgets.length > 0;
}

/** Tandai seluruh entri satu instansi basi (dipakai setelah dokumen berubah). */
export function basiikanTenant(tenantId: string): void {
  let berubah = false;
  for (const e of gudang.values()) {
    if (e.tenantId !== tenantId) continue;
    if (e.status === 'proses') continue;
    e.status = 'belum';
    berubah = true;
  }
  if (berubah) simpanKeBerkas();
}

/**
 * Siapkan (isi dari dokumen) satu pratinjau. Aman dipanggil berkali-kali:
 * kalau sudah siap & versinya sama, langsung dikembalikan; kalau sedang berjalan,
 * pemanggil menunggu pekerjaan yang sama (tidak menumpuk panggilan dokumen).
 */
export function siapkanPratinjau(opts: {
  tenantId: string;
  templateId: string;
  kbId: string;
  versiKb: string;
  total: number;
  pekerja: (onProgres: (info: { selesai: number; total: number; judul: string }) => void) => Promise<HasilPengisian>;
}): Promise<EntriPratinjau> {
  const { tenantId, templateId, kbId, versiKb, total, pekerja } = opts;
  const kunci = kunciPratinjau(tenantId, templateId, kbId);

  const ada = gudang.get(kunci);
  if (masihBerlaku(ada, versiKb)) return Promise.resolve(ada!);

  const sedang = berjalan.get(kunci);
  if (sedang) return sedang;

  const entri: EntriPratinjau = {
    tenantId,
    templateId,
    kbId,
    versiKb,
    status: 'proses',
    widgets: ada?.widgets ?? [],
    terisi: 0,
    kosong: 0,
    catatan: [],
    progres: { selesai: 0, total, judul: 'Menyiapkan permintaan ke dokumen…' },
    mulai: Date.now(),
  };
  gudang.set(kunci, entri);
  simpanKeBerkas();

  const tugas = (async () => {
    try {
      const hasil = await pekerja((info) => {
        entri.progres = info;
        entri.status = 'proses';
      });
      entri.widgets = hasil.widgets;
      entri.terisi = hasil.terisi;
      entri.kosong = hasil.kosong;
      entri.catatan = hasil.catatan;
      entri.status = 'siap';
      entri.selesai = Date.now();
      delete entri.galat;
    } catch (err) {
      entri.status = 'gagal';
      entri.galat = err instanceof Error ? err.message : 'gagal menyiapkan data';
      entri.selesai = Date.now();
    } finally {
      berjalan.delete(kunci);
      simpanKeBerkas();
    }
    return entri;
  })();

  berjalan.set(kunci, tugas);
  return tugas;
}

/** Hapus seluruh entri satu instansi (mis. instansi dihapus). */
export function hapusGudangTenant(tenantId: string): void {
  let berubah = false;
  for (const [k, e] of gudang) {
    if (e.tenantId !== tenantId) continue;
    gudang.delete(k);
    berubah = true;
  }
  if (berubah) simpanKeBerkas();
}
