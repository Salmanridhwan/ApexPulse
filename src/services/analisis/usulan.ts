/**
 * USULAN PERUBAHAN HALAMAN — aturan murni, tanpa Express dan tanpa model.
 *
 * Semua yang berbahaya dari "chat menyunting halaman" dikumpulkan di sini supaya
 * bisa diuji: apa yang boleh diusulkan, apa yang boleh diterapkan, dan apa yang
 * harus ditolak sebelum menyentuh dashboard siapa pun.
 *
 * Tiga pagar:
 * 1. Batas 9 widget per halaman tetap berlaku untuk hasil usulan.
 * 2. Usulan yang menambah/mengubah widget WAJIB menyebut sumber (sitasi) atau
 *    berasal dari butir. Asisten tidak boleh menyelipkan angka tanpa asal.
 * 3. Usulan hanya boleh menyentuh halaman yang disebut, bukan halaman lain.
 */

import type { ButirData, Dashboard, HalamanDashboard, PerubahanHalaman, UsulanHalaman, WidgetSpec } from '../../types';

/** Batas widget per halaman — sama dengan batas kanvas. */
export const MAKS_WIDGET_HALAMAN = 9;

export interface HasilValidasi {
  sah: boolean;
  galat?: string;
  perubahan: PerubahanHalaman[];
}

function adaSumber(w: WidgetSpec | undefined): boolean {
  if (!w) return false;
  const sitasi = Array.isArray(w.citations) ? w.citations.filter((c) => String(c?.docName || '').trim()) : [];
  return sitasi.length > 0 || w.dataKosong === true;
}

function angkaMasukAkal(w: WidgetSpec | undefined): boolean {
  if (!w) return false;
  if (w.kpi) {
    const v = w.kpi.value;
    if (typeof v === 'number' && !Number.isFinite(v)) return false;
    if (v === undefined || v === null || v === '') return false;
  }
  if (w.chart) {
    if (!Array.isArray(w.chart.series) || w.chart.series.length === 0) return false;
    for (const s of w.chart.series) {
      if (!Array.isArray(s.data) || s.data.some((d) => typeof d !== 'number' || !Number.isFinite(d))) return false;
    }
  }
  if (w.table && (!Array.isArray(w.table.columns) || !Array.isArray(w.table.rows))) return false;
  return true;
}

/**
 * Validasi daftar perubahan terhadap halaman yang benar-benar ada.
 *
 * Yang dikembalikan adalah perubahan yang SUDAH dibersihkan: hanya aksi yang
 * dikenal, hanya widget yang memang ada di halaman itu, dan tanpa duplikat.
 */
export function validasiPerubahan(
  perubahan: unknown,
  halaman: HalamanDashboard
): HasilValidasi {
  if (!Array.isArray(perubahan) || perubahan.length === 0) {
    return { sah: false, galat: 'Usulan tidak berisi perubahan apa pun.', perubahan: [] };
  }

  const idAda = new Set((halaman.widgets || []).map((w) => w.id));
  const bersih: PerubahanHalaman[] = [];

  for (const item of perubahan) {
    if (!item || typeof item !== 'object') continue;
    const p = item as PerubahanHalaman;

    if (p.aksi === 'tambah') {
      if (!p.widget || !String(p.widget.title || '').trim()) {
        return { sah: false, galat: 'Kartu baru harus punya judul.', perubahan: [] };
      }
      if (!adaSumber(p.widget)) {
        return {
          sah: false,
          galat: `Kartu "${p.widget.title}" tidak menyebut sumber dokumen. Angka tanpa sumber tidak boleh masuk halaman.`,
          perubahan: [],
        };
      }
      if (!angkaMasukAkal(p.widget)) {
        return { sah: false, galat: `Kartu "${p.widget.title}" tidak berisi angka yang sah.`, perubahan: [] };
      }
      bersih.push({ aksi: 'tambah', widget: p.widget, ...(p.alasan ? { alasan: p.alasan } : {}) });
      continue;
    }

    if (p.aksi === 'ubah') {
      if (!p.widgetId || !idAda.has(p.widgetId)) {
        return { sah: false, galat: `Kartu yang mau diubah tidak ada di halaman ini (${p.widgetId || 'tanpa id'}).`, perubahan: [] };
      }
      if (!p.widget) return { sah: false, galat: 'Perubahan kartu tidak memuat kartu penggantinya.', perubahan: [] };
      if (!adaSumber(p.widget)) {
        return { sah: false, galat: `Kartu "${p.widget.title}" kehilangan sumber dokumen.`, perubahan: [] };
      }
      bersih.push({ aksi: 'ubah', widgetId: p.widgetId, widget: p.widget, ...(p.alasan ? { alasan: p.alasan } : {}) });
      continue;
    }

    if (p.aksi === 'hapus') {
      if (!p.widgetId || !idAda.has(p.widgetId)) {
        return { sah: false, galat: `Kartu yang mau dihapus tidak ada di halaman ini (${p.widgetId || 'tanpa id'}).`, perubahan: [] };
      }
      bersih.push({ aksi: 'hapus', widgetId: p.widgetId, ...(p.alasan ? { alasan: p.alasan } : {}) });
      continue;
    }

    if (p.aksi === 'urutkan') {
      const urutan = Array.isArray(p.urutan) ? p.urutan.map(String) : [];
      const asing = urutan.filter((id) => !idAda.has(id));
      if (urutan.length === 0) return { sah: false, galat: 'Urutan baru kosong.', perubahan: [] };
      if (asing.length > 0) {
        return { sah: false, galat: `Urutan menyebut kartu yang tidak ada di halaman ini: ${asing.join(', ')}.`, perubahan: [] };
      }
      bersih.push({ aksi: 'urutkan', urutan, ...(p.alasan ? { alasan: p.alasan } : {}) });
      continue;
    }

    return { sah: false, galat: `Aksi "${String((p as any).aksi)}" tidak dikenal.`, perubahan: [] };
  }

  if (bersih.length === 0) return { sah: false, galat: 'Usulan tidak berisi perubahan yang bisa diterapkan.', perubahan: [] };
  return { sah: true, perubahan: bersih };
}

export interface HasilTerap {
  berhasil: boolean;
  galat?: string;
  widgets: WidgetSpec[];
  /** Jumlah kartu setelah perubahan, untuk dilaporkan ke admin. */
  jumlahAkhir: number;
}

/**
 * Terapkan perubahan ke daftar widget halaman — murni, tidak menyimpan apa pun.
 *
 * Dijalankan berurutan. Bila salah satu langkah mustahil (mis. batas 9 widget
 * terlampaui), SELURUH usulan batal dan halaman tidak berubah setengah jalan.
 */
export function terapkanPerubahan(
  widgets: WidgetSpec[],
  perubahan: PerubahanHalaman[],
  maks: number = MAKS_WIDGET_HALAMAN
): HasilTerap {
  let hasil = [...widgets];

  for (const p of perubahan) {
    if (p.aksi === 'tambah') {
      if (!p.widget) return { berhasil: false, galat: 'Kartu baru kosong.', widgets, jumlahAkhir: widgets.length };
      if (hasil.length + 1 > maks) {
        return {
          berhasil: false,
          galat: `Halaman ini sudah berisi ${hasil.length} kartu (batas ${maks}). Hapus satu kartu dulu, atau buat halaman baru.`,
          widgets,
          jumlahAkhir: widgets.length,
        };
      }
      hasil = [...hasil, p.widget];
      continue;
    }

    if (p.aksi === 'ubah') {
      const i = hasil.findIndex((w) => w.id === p.widgetId);
      if (i === -1 || !p.widget) {
        return { berhasil: false, galat: `Kartu ${p.widgetId} tidak ditemukan.`, widgets, jumlahAkhir: widgets.length };
      }
      const salinan = [...hasil];
      // Id dipertahankan: kartu yang sama, isinya diperbarui.
      salinan[i] = { ...p.widget, id: hasil[i].id };
      hasil = salinan;
      continue;
    }

    if (p.aksi === 'hapus') {
      const sebelum = hasil.length;
      hasil = hasil.filter((w) => w.id !== p.widgetId);
      if (hasil.length === sebelum) {
        return { berhasil: false, galat: `Kartu ${p.widgetId} tidak ditemukan.`, widgets, jumlahAkhir: widgets.length };
      }
      continue;
    }

    if (p.aksi === 'urutkan') {
      const urutan = p.urutan || [];
      const peta = new Map(hasil.map((w) => [w.id, w]));
      const tersusun = urutan.map((id) => peta.get(id)).filter((w): w is WidgetSpec => !!w);
      // Kartu yang tidak disebut tetap dipertahankan di belakang — menyusun
      // ulang bukan alasan menghilangkan kartu.
      const sisa = hasil.filter((w) => !urutan.includes(w.id));
      if (tersusun.length !== urutan.length) {
        return { berhasil: false, galat: 'Ada kartu dalam urutan yang tidak dikenal.', widgets, jumlahAkhir: widgets.length };
      }
      hasil = [...tersusun, ...sisa];
      continue;
    }
  }

  return { berhasil: true, widgets: hasil, jumlahAkhir: hasil.length };
}

/** Ringkasan usulan untuk pratinjau: "2 tambah, 1 hapus" dan sejenisnya. */
export function ringkasUsulan(perubahan: PerubahanHalaman[]): string {
  const hitung = { tambah: 0, ubah: 0, hapus: 0, urutkan: 0 };
  for (const p of perubahan) hitung[p.aksi] += 1;
  const bagian: string[] = [];
  if (hitung.tambah) bagian.push(`${hitung.tambah} kartu ditambah`);
  if (hitung.ubah) bagian.push(`${hitung.ubah} kartu diubah`);
  if (hitung.hapus) bagian.push(`${hitung.hapus} kartu dihapus`);
  if (hitung.urutkan) bagian.push('urutan disusun ulang');
  return bagian.length > 0 ? bagian.join(', ') : 'tidak ada perubahan';
}

/** Cari halaman pada dashboard; dashboard lama tanpa `halaman` dianggap satu halaman. */
export function halamanDari(dashboard: Dashboard, halamanId?: string): HalamanDashboard | undefined {
  const daftar =
    dashboard.halaman && dashboard.halaman.length > 0
      ? dashboard.halaman
      : [{ id: 'hlm-1', judul: 'Ringkasan', widgets: dashboard.widgets } as HalamanDashboard];
  if (!halamanId) {
    return daftar.find((h) => h.id === dashboard.halamanAktifId) || daftar[0];
  }
  return daftar.find((h) => h.id === halamanId);
}

/**
 * Butir yang boleh dipakai asisten saat menyusun usulan: hanya yang disetujui.
 * Butir draf tidak boleh tiba-tiba muncul di halaman.
 */
export function butirSiapPakai(daftar: ButirData[]): ButirData[] {
  return daftar.filter((b) => b.status === 'disetujui');
}

/** Usulan yang masih menunggu keputusan admin untuk halaman tertentu. */
export function usulanMenunggu(daftar: UsulanHalaman[], dashboardId: string, halamanId: string): UsulanHalaman[] {
  return daftar.filter(
    (u) => u.dashboardId === dashboardId && u.halamanId === halamanId && u.status === 'menunggu'
  );
}
