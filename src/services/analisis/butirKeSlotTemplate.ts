/**
 * BUTIR DISETUJUI → SLOT TEMPLATE.
 *
 * Template dashboard ("Pijar", "Analitik", dst.) sudah punya susunan kartu yang
 * rapi, tapi kartunya berisi angka ilustrasi. Fungsi di sini mengisi slot itu
 * dengan angka sungguhan dari butir dokumen yang disetujui admin.
 *
 * Dua aturan yang tidak boleh dilanggar:
 *
 * 1. **Slot yang tidak ada butirnya dibiarkan KOSONG dan diberi alasan.** Tidak
 *    diisi angka contoh, tidak diisi nol, tidak dihapus diam-diam. Angka ilustrasi
 *    yang lolos ke dashboard pimpinan lebih berbahaya daripada kartu kosong yang
 *    jujur.
 * 2. **Satu butir hanya dipakai satu slot.** Kalau tidak, satu angka bisa muncul
 *    di tiga kartu dan terbaca seperti tiga temuan berbeda.
 *
 * Fungsi murni: tanpa jaringan, tanpa model, tanpa database.
 */

import type { ButirData, WidgetSpec, WidgetType } from '../../types';
import type { DashboardTemplate } from '../templates/dashboardTemplates';
import { MAKS_WIDGET_PER_HALAMAN, butirKeWidget } from './butirKeWidget';

/** Keluarga tipe kartu — dipakai untuk mencocokkan butir ke slot. */
const KELUARGA: Record<string, 'tunggal' | 'deret' | 'tabel' | 'teks'> = {
  kpi: 'tunggal',
  gauge: 'tunggal',
  'bullet-target': 'tunggal',
  line: 'deret',
  area: 'deret',
  bar: 'deret',
  hbar: 'deret',
  combo: 'deret',
  pie: 'deret',
  donut: 'deret',
  treemap: 'deret',
  funnel: 'deret',
  waterfall: 'deret',
  sankey: 'deret',
  scatter: 'deret',
  bubble: 'deret',
  histogram: 'deret',
  boxplot: 'deret',
  heatmap: 'deret',
  radar: 'deret',
  map: 'deret',
  gantt: 'deret',
  table: 'tabel',
  narasi: 'teks',
};

function keluarga(tipe: string): 'tunggal' | 'deret' | 'tabel' | 'teks' {
  return KELUARGA[tipe] ?? 'deret';
}

/** Keluarga data yang dimiliki satu butir. */
function keluargaButir(butir: ButirData): 'tunggal' | 'deret' | 'tabel' | 'teks' | 'kosong' {
  if (butir.tabel && butir.tabel.baris.length > 0) return 'tabel';
  if (butir.seri && butir.seri.length > 0 && butir.seri.every((s) => s.data.length > 0)) return 'deret';
  if (butir.nilai !== undefined && butir.nilai !== null) return 'tunggal';
  return 'kosong';
}

/** Butir yang boleh dipakai menyusun halaman: hanya yang sudah disetujui admin. */
function butirSiap(butir: ButirData[]): ButirData[] {
  return butir.filter((b) => b.status === 'disetujui' && keluargaButir(b) !== 'kosong');
}

export interface SlotTemplate {
  /** Id kartu di template asal — dipakai UI untuk menandai slot mana yang kosong. */
  slotId: string;
  judulSlot: string;
  peran: WidgetType;
  grid: { x: number; y: number; w: number; h: number };
  /** `null` = slot kosong. UI menampilkan kartu kosong berlabel, bukan angka. */
  widget: WidgetSpec | null;
  butirId?: string;
  /** Kenapa kosong — kalimat yang bisa dibaca admin, bukan kode. */
  alasanKosong?: string;
}

export interface HasilIsiSlot {
  templateId: string;
  namaTemplate: string;
  slots: SlotTemplate[];
  terisi: number;
  kosong: number;
  /** Butir siap yang tidak kebagian slot (template lebih kecil dari data). */
  butirTakTerpakai: number;
  /** Satu kalimat untuk ditampilkan setelah halaman dibuat. */
  catatan: string;
}

const ALASAN: Record<string, string> = {
  tunggal: 'belum ada butir angka tunggal (KPI) yang disetujui',
  deret: 'belum ada butir deret angka yang disetujui',
  tabel: 'belum ada butir berbentuk tabel yang disetujui',
  teks: 'kartu narasi ditulis admin sendiri, tidak diisi otomatis dari angka',
};

/**
 * Cocokkan butir ke slot template.
 *
 * Urutan pencocokan: slot diisi berurutan, dan untuk tiap slot dipilih butir
 * pertama yang keluarganya cocok dan belum terpakai. Kalau tidak ada yang cocok
 * persis, butir dari keluarga yang sama tetap dipakai — lebih baik kartu berisi
 * angka sungguhan daripada kosong, karena tipenya bisa disesuaikan.
 */
export function isiSlotTemplate(template: DashboardTemplate, butir: ButirData[]): HasilIsiSlot {
  const siap = butirSiap(butir);
  const terpakai = new Set<string>();
  const slots: SlotTemplate[] = [];

  const daftarSlot = (template.widgets ?? []).slice(0, MAKS_WIDGET_PER_HALAMAN);

  for (const slot of daftarSlot) {
    const peran = slot.type;
    const kebutuh = keluarga(peran);
    const grid = { ...(slot.grid ?? { x: 0, y: 0, w: 6, h: 5 }) };

    if (kebutuh === 'teks') {
      slots.push({
        slotId: slot.id,
        judulSlot: slot.title ?? '',
        peran,
        grid,
        widget: null,
        alasanKosong: ALASAN.teks,
      });
      continue;
    }

    const calon = siap.find((b) => !terpakai.has(b.id) && keluargaButir(b) === kebutuh);
    if (!calon) {
      slots.push({
        slotId: slot.id,
        judulSlot: slot.title ?? '',
        peran,
        grid,
        widget: null,
        alasanKosong: ALASAN[kebutuh] ?? 'belum ada butir yang cocok',
      });
      continue;
    }

    const dasar = butirKeWidget(calon, slots.length + 1);
    if (!dasar) {
      slots.push({
        slotId: slot.id,
        judulSlot: slot.title ?? '',
        peran,
        grid,
        widget: null,
        alasanKosong: ALASAN[kebutuh] ?? 'butir tidak bisa dijadikan kartu',
      });
      continue;
    }

    terpakai.add(calon.id);
    // Id tetap memakai id template supaya posisi & penyuntingan di kanvas stabil;
    // ukuran grid mengikuti template, bukan ukuran bawaan butir.
    slots.push({
      slotId: slot.id,
      judulSlot: slot.title ?? '',
      peran,
      grid,
      butirId: calon.id,
      widget: { ...dasar, id: slot.id, grid },
    });
  }

  const terisi = slots.filter((s) => s.widget).length;
  const kosong = slots.length - terisi;
  const butirTakTerpakai = siap.length - terpakai.size;

  const bagian = [`${terisi} dari ${slots.length} kartu terisi dari dokumen`];
  if (kosong > 0) bagian.push(`${kosong} kartu dibiarkan kosong`);
  if (butirTakTerpakai > 0) bagian.push(`${butirTakTerpakai} butir tidak kebagian slot`);

  return {
    templateId: template.id,
    namaTemplate: template.nama,
    slots,
    terisi,
    kosong,
    butirTakTerpakai,
    catatan: bagian.join(' · '),
  };
}

/**
 * Kartu yang benar-benar dipasang di halaman.
 *
 * Slot kosong TIDAK ikut dipasang — halaman tidak boleh punya kartu tanpa angka.
 * Yang kosong tetap dilaporkan lewat `catatan` dan `slots`, supaya admin tahu apa
 * yang belum ada, bukan mengira semuanya sudah lengkap.
 */
export function widgetTerisi(hasil: HasilIsiSlot): WidgetSpec[] {
  return hasil.slots.map((s) => s.widget).filter((w): w is WidgetSpec => Boolean(w));
}

/** Daftar slot kosong beserta alasannya — untuk panel "yang belum ada". */
export function slotKosong(hasil: HasilIsiSlot): Array<{ judulSlot: string; alasan: string }> {
  return hasil.slots
    .filter((s) => !s.widget)
    .map((s) => ({ judulSlot: s.judulSlot || s.peran, alasan: s.alasanKosong ?? 'belum ada butir yang cocok' }));
}
