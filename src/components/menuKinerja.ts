/**
 * Menu grup "Kinerja & Kepatuhan" — satu sumber untuk sidebar, panel admin, dan
 * penjaga `viewMode` di App.
 *
 * `key` sengaja SAMA dengan nilai `viewMode` supaya tidak perlu peta kedua:
 *   App  -> setViewMode('pelaporan')
 *   data -> Tenant.menuSembunyi: ['pelaporan']
 *
 * Semantik penyimpanan = OPT-OUT: menu tampil kecuali key-nya ada di daftar
 * `menuSembunyi`. Tenant lama yang belum punya field ini otomatis tampil semua.
 */
export interface ItemMenuKinerja {
  key: string;
  label: string;
  ket: string;
}

export const MENU_KINERJA: ItemMenuKinerja[] = [
  { key: 'pelaporan', label: 'Pelaporan Periodik', ket: 'Kewajiban lapor instansi per periode' },
  { key: 'auditTl', label: 'Tindak Lanjut Audit', ket: 'Temuan BPK/Inspektorat/BPKP dan rekomendasinya' },
  { key: 'keuangan', label: 'Kesehatan Keuangan', ket: 'Rasio ROA/ROE/DER/likuiditas' },
  { key: 'risiko', label: 'Manajemen Risiko', ket: 'Register risiko dan heat map 5×5 (SPIP)' },
  { key: 'aset', label: 'Manajemen Aset', ket: 'Daftar aset, nilai buku, dan penyusutan' },
  { key: 'pk', label: 'Perjanjian Kinerja', ket: 'Target kinerja pejabat dan realisasinya' },
  { key: 'lkjip', label: 'LKjIP', ket: 'Laporan kinerja instansi pemerintah' },
];

export const MENU_KINERJA_KEYS: string[] = MENU_KINERJA.map((m) => m.key);

/** Menu tampil kecuali admin menyembunyikannya untuk instansi tersebut. */
export function menuTampil(sembunyi: string[] | undefined | null, key: string): boolean {
  return !(sembunyi || []).includes(key);
}
