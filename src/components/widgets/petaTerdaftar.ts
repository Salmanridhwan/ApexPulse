/**
 * PETA INDONESIA UNTUK CHART `peta-wilayah`.
 *
 * GeoJSON provinsi diunduh dan didaftarkan ke ECharts SEKALI untuk semua widget
 * peta (katalog Template Chart maupun kanvas dashboard). Tanpa pendaftaran ini
 * ECharts tidak punya bentuk peta dan kartu akan kosong.
 *
 * Dulu logika ini hanya ada di `ChartEcharts.tsx` (mesin lama), sehingga wajah
 * peta di Template Chart tidak bisa memakainya. Sekarang satu tempat, dipakai
 * keduanya.
 */

import { loadEcharts } from './echartsSetup';
import { NAMA_PETA } from '../../services/chart/pembangunTambahan';

export { NAMA_PETA };

let janji: Promise<void> | null = null;

/**
 * Pastikan peta Indonesia sudah terdaftar di ECharts.
 *
 * Aman dipanggil berkali-kali dan dari beberapa widget sekaligus: unduhan hanya
 * sekali. Bila gagal (jaringan putus), cache direset supaya percobaan berikutnya
 * bisa mengulang — bukan gagal selamanya.
 */
export function pastikanPetaTerdaftar(): Promise<void> {
  return (janji ??= (async () => {
    // `loadEcharts()` mengembalikan namespace ECharts; sebagian build juga
    // mengekspor namespace yang sama sebagai properti `echarts`. Ambil yang
    // benar-benar punya `registerMap` supaya tidak diam-diam gagal.
    const mod: any = await loadEcharts();
    const api: any = typeof mod?.registerMap === 'function' ? mod : mod?.echarts;
    if (!api || typeof api.registerMap !== 'function') {
      throw new Error('ECharts tanpa registerMap: peta tidak bisa didaftarkan');
    }
    if (api.getMap?.(NAMA_PETA)) return;
    const res = await fetch('/geo/indonesia.geojson');
    if (!res.ok) throw new Error('GeoJSON peta gagal dimuat');
    api.registerMap(NAMA_PETA, await res.json());
  })().catch((err) => {
    janji = null;
    throw err;
  }));
}
