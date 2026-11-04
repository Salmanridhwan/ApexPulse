import type { Dashboard, HalamanDashboard, WidgetSpec } from '../../types';

/**
 * HALAMAN DASHBOARD.
 *
 * Satu dashboard boleh punya banyak halaman, tiap halaman berisi widget dan
 * datanya sendiri. `Dashboard` tetap menyimpan field lama (`widgets`, `replika`,
 * `tataLetak`, `globalFilters`, `presentasi`) sebagai PROYEKSI halaman yang
 * sedang dibuka, supaya kanvas, gaya, filter, dan presentasi tidak perlu diubah.
 *
 * Aturan: `halaman[]` adalah sumber kebenaran. Field lama hanya cermin halaman
 * aktif. Setiap kali berpindah halaman atau menyimpan, tulis proyeksi dulu lewat
 * `tulisProyeksi`, baru muat halaman tujuan lewat `proyeksi`.
 */

/** Id halaman pertama dashboard baru. */
export const ID_HALAMAN_PERTAMA = 'hlm-1';

/** Field dashboard yang menjadi isi satu halaman. */
const FIELD_HALAMAN = [
  'widgets',
  'replika',
  'tataLetak',
  'globalFilters',
  'presentasi',
] as const;

/**
 * Ambil isi halaman sebagai potongan field dashboard.
 * Halaman tanpa filter sendiri memakai filter dashboard (`dasar`): filter
 * kosong membuat kanvas gagal membaca periode.
 */
export function proyeksi(h: HalamanDashboard, dasar?: Partial<Dashboard>): Partial<Dashboard> {
  return {
    widgets: h.widgets || [],
    replika: h.replika,
    tataLetak: h.tataLetak,
    globalFilters: h.globalFilters ?? dasar?.globalFilters ?? { periode: 'Semua', unitKerja: 'Semua', kategori: 'Semua' },
    presentasi: h.presentasi,
  };
}

/** Daftar halaman dashboard. Dashboard lama tanpa `halaman` dianggap satu halaman. */
export function daftarHalaman(d?: Dashboard | null): HalamanDashboard[] {
  if (!d) return [];
  if (Array.isArray(d.halaman) && d.halaman.length > 0) return d.halaman;
  return [
    {
      id: ID_HALAMAN_PERTAMA,
      judul: 'Halaman 1',
      widgets: d.widgets || [],
      replika: d.replika,
      tataLetak: d.tataLetak,
      globalFilters: d.globalFilters,
      presentasi: d.presentasi,
    },
  ];
}

/** Halaman yang sedang dibuka; jatuh ke halaman pertama bila id tidak dikenal. */
export function halamanAktif(d?: Dashboard | null): HalamanDashboard | undefined {
  const semua = daftarHalaman(d);
  if (semua.length === 0) return undefined;
  return semua.find((h) => h.id === d?.halamanAktifId) || semua[0];
}

/**
 * Tulis isi dashboard sekarang ke halaman aktif, kembalikan daftar halaman baru.
 * Dipakai sebelum berpindah halaman dan sebelum menyimpan.
 */
export function tulisProyeksi(d: Dashboard): HalamanDashboard[] {
  const semua = daftarHalaman(d);
  const aktif = d.halamanAktifId || semua[0]?.id;
  return semua.map((h) => {
    if (h.id !== aktif) return h;
    const isi: HalamanDashboard = { ...h };
    for (const f of FIELD_HALAMAN) {
      (isi as any)[f] = (d as any)[f];
    }
    return isi;
  });
}

/** Halaman baru yang menyalin desain template halaman acuan (bila ada). */
export function halamanBaru(nomor: number, acuan?: HalamanDashboard): HalamanDashboard {
  const id = `hlm-${Date.now().toString(36)}-${nomor}`;
  return {
    id,
    judul: `Halaman ${nomor}`,
    widgets: [],
    // Desain template ikut, angkanya dikosongkan supaya halaman ini diisi datanya sendiri.
    replika: acuan?.replika ? { templateId: acuan.replika.templateId, nilai: {} } : undefined,
    tataLetak: acuan?.tataLetak ? { ...acuan.tataLetak } : undefined,
    globalFilters: acuan?.globalFilters ? { ...acuan.globalFilters } : undefined,
  };
}

/**
 * Widget dari SEMUA halaman (halaman aktif memakai isi terbarunya).
 * `d.widgets` hanya cermin halaman aktif, jadi hitungan, ekspor, dan statistik
 * yang membacanya langsung melewatkan halaman lain.
 */
export function semuaWidget(d?: Dashboard | null): WidgetSpec[] {
  if (!d) return [];
  return tulisProyeksi(d).flatMap((h) => h.widgets || []);
}

/**
 * Ganti kartu halaman aktif: `widgets` (proyeksi) dan halaman aktif di
 * `halaman[]` ikut sama. Dulu jalur chat hanya menulis `widgets`, sehingga
 * kartu tambahan hilang dari halaman begitu dashboard dibuka ulang.
 */
export function denganHalamanAktif(d: Dashboard, widgets: WidgetSpec[]): Pick<Dashboard, 'widgets' | 'halaman'> {
  const semua = daftarHalaman(d);
  if (semua.length === 0) return { widgets, halaman: d.halaman };
  const aktif = d.halamanAktifId || semua[0].id;
  return { widgets, halaman: semua.map((h) => (h.id === aktif ? { ...h, widgets } : h)) };
}

/**
 * Dokumen sumber dashboard bila hampir semua kartunya (≥ 80%) bersumber dari
 * SATU dokumen, mis. dashboard dari "Piutang 2026.xlsx". Dipakai chat supaya
 * "tambahkan 1 chart" tetap di dokumen yang sama.
 */
export function dokumenKonteksDashboard(d: Dashboard): string | undefined {
  const sumber = semuaWidget(d)
    .map((w) => w.citations?.[0]?.docName)
    .filter((n): n is string => !!n);
  if (sumber.length === 0) return undefined;
  const hitung = new Map<string, number>();
  for (const n of sumber) hitung.set(n, (hitung.get(n) ?? 0) + 1);
  const [nama, jumlah] = [...hitung.entries()].sort((a, b) => b[1] - a[1])[0];
  return jumlah / sumber.length >= 0.8 ? nama : undefined;
}
