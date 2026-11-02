import type { WidgetSpec } from '../../types';

const angkaId = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 });

/**
 * Nilai satu widget untuk tabel rekap (ekspor / cetak), ditulis jujur sesuai
 * bentuknya. KPI = angka + satuan. Grafik = titik terakhir LENGKAP dengan
 * kategorinya, karena angka mentah tanpa label ("161380") terbaca seperti
 * total padahal hanya satu titik.
 */
export function nilaiRingkas(w: WidgetSpec): string {
  if (w.kpi?.value !== undefined && w.kpi?.value !== null && w.kpi?.value !== '') {
    const v = typeof w.kpi.value === 'number' ? angkaId(w.kpi.value) : String(w.kpi.value);
    return [v, w.kpi.unit].filter(Boolean).join(' ');
  }
  const seri = w.chart?.series?.[0];
  const data = seri?.data ?? [];
  if (data.length) {
    const i = data.length - 1;
    const kategori = w.chart?.xAxis?.[i];
    const satuan = seri?.unit || w.chart?.unit || '';
    const nilai = [angkaId(Number(data[i])), satuan].filter(Boolean).join(' ');
    return kategori ? `${kategori}: ${nilai} (titik terakhir)` : `${nilai} (titik terakhir)`;
  }
  if (w.type === 'table') return 'Tabel';
  if (w.type === 'narasi') return 'Narasi';
  return '-';
}
