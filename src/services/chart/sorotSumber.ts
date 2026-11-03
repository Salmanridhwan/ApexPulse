/**
 * SOROTAN ANGKA DI KUTIPAN SUMBER.
 *
 * Panel sumber kartu kanvas menampilkan potongan dokumen tempat angka kartu
 * diambil. Angka kartu (nilai KPI atau titik grafik) disorot di dalam kutipan
 * supaya pembaca langsung melihat bagian dokumen yang dipakai.
 */

import type { WidgetSpec } from '../../types';

/** Bentuk tulisan sebuah angka yang lazim di dokumen: 951640, 951.640, 951,640, 43,8. */
function bentukAngka(n: number): string[] {
  if (!Number.isFinite(n)) return [];
  const hasil = new Set<string>();
  hasil.add(n.toLocaleString('id-ID', { maximumFractionDigits: 2 }));
  hasil.add(n.toLocaleString('en-US', { maximumFractionDigits: 2 }));
  hasil.add(String(n));
  return [...hasil].filter((t) => t.replace(/\D/g, '').length >= 2);
}

/** Angka yang dipakai kartu: nilai KPI dan semua titik grafik. */
export function angkaKartu(w: WidgetSpec): string[] {
  const calon = new Set<string>();
  const nilai = String(w.kpi?.value ?? '').trim();
  if (nilai && nilai !== '-') calon.add(nilai);
  for (const s of w.chart?.series ?? []) for (const v of s.data ?? []) for (const b of bentukAngka(Number(v))) calon.add(b);
  return [...calon].slice(0, 60);
}

const lolos = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Potong teks menjadi bagian biasa dan bagian sorotan. Angka dicocokkan utuh
 * (tidak menempel ke digit lain), yang terpanjang lebih dulu.
 */
export function potongSorot(teks: string, angka: string[]): Array<{ teks: string; sorot: boolean }> {
  const bersih = angka.filter(Boolean).sort((a, b) => b.length - a.length);
  if (!teks || bersih.length === 0) return [{ teks, sorot: false }];
  const pola = new RegExp(`(?<![\\d.,])(${bersih.map(lolos).join('|')})(?![\\d]|[.,]\\d)`, 'g');
  const hasil: Array<{ teks: string; sorot: boolean }> = [];
  let akhir = 0;
  for (const m of teks.matchAll(pola)) {
    const i = m.index ?? 0;
    if (i > akhir) hasil.push({ teks: teks.slice(akhir, i), sorot: false });
    hasil.push({ teks: m[0], sorot: true });
    akhir = i + m[0].length;
  }
  if (akhir < teks.length) hasil.push({ teks: teks.slice(akhir), sorot: false });
  return hasil;
}
