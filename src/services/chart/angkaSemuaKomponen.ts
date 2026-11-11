/**
 * ATURAN ANGKA RINGKAS UNTUK SEMUA KOMPONEN CHART.
 *
 * Pembangun opsi sudah memakai `angkaRingkas` (100 rb, 1,25 jt, 3,97 M), tetapi
 * bagian yang tidak diberi formatter jatuh ke bawaan ECharts dan menampilkan
 * angka mentah ("3966100000"). Lapisan ini menutup celah itu: tooltip, label
 * sumbu nilai, label seri, serta label garis/titik penanda yang belum punya
 * formatter ikut diringkas. Formatter yang sudah ada tidak diganti, kecuali
 * templat teks yang memuat `{c}`.
 */
import { angkaRingkas } from '../format/angkaRingkas';

const ringkasNilai = (v: unknown): string => {
  const angka = Array.isArray(v) ? v[v.length - 1] : v;
  if (typeof angka === 'number' && Number.isFinite(angka)) return angkaRingkas(angka, 2);
  if (typeof angka === 'string' && /^-?\d+(\.\d+)?$/.test(angka.trim())) return angkaRingkas(Number(angka), 2);
  return angka === undefined || angka === null ? '' : String(angka);
};

/** Templat teks ECharts ("{b}: {c}") menjadi fungsi dengan {c} yang diringkas. */
const dariTemplat = (templat: string) => (p: any) =>
  templat
    .replace(/\{a\}/g, String(p?.seriesName ?? ''))
    .replace(/\{b\}/g, String(p?.name ?? ''))
    .replace(/\{c\}/g, ringkasNilai(p?.value))
    .replace(/\{d\}/g, String(p?.percent ?? ''));

const rapikanLabel = (label: any, bawaanNilai: boolean) => {
  if (!label || typeof label !== 'object') return label;
  if (typeof label.formatter === 'string' && label.formatter.includes('{c}')) {
    return { ...label, formatter: dariTemplat(label.formatter) };
  }
  if (label.show && label.formatter === undefined && bawaanNilai) {
    return { ...label, formatter: (p: any) => ringkasNilai(p?.value) };
  }
  return label;
};

const rapikanSumbu = (sumbu: any, bawaanNilai: boolean) => {
  const satu = (s: any) => {
    if (!s || typeof s !== 'object') return s;
    const nilai = s.type === 'value' || (s.type === undefined && bawaanNilai) || s.type === 'log';
    if (!nilai || typeof s.axisLabel?.formatter === 'function') return s;
    if (typeof s.axisLabel?.formatter === 'string' && !s.axisLabel.formatter.includes('{value}')) return s;
    const templat = typeof s.axisLabel?.formatter === 'string' ? s.axisLabel.formatter : '{value}';
    return {
      ...s,
      axisLabel: {
        ...(s.axisLabel ?? {}),
        formatter: (v: number) => templat.replace('{value}', ringkasNilai(v)),
      },
    };
  };
  return Array.isArray(sumbu) ? sumbu.map(satu) : satu(sumbu);
};

export function ringkasAngkaSemuaKomponen<T>(opsi: T): T {
  if (!opsi || typeof opsi !== 'object') return opsi;
  const o: any = { ...(opsi as any) };

  if (o.tooltip && typeof o.tooltip === 'object' && !Array.isArray(o.tooltip)) {
    if (o.tooltip.formatter === undefined && o.tooltip.valueFormatter === undefined) {
      o.tooltip = { ...o.tooltip, valueFormatter: ringkasNilai };
    } else if (typeof o.tooltip.formatter === 'string' && o.tooltip.formatter.includes('{c}')) {
      o.tooltip = { ...o.tooltip, formatter: dariTemplat(o.tooltip.formatter) };
    }
  }

  // Sumbu y bawaan ECharts bertipe nilai, sumbu x bawaan bertipe kategori.
  if (o.yAxis) o.yAxis = rapikanSumbu(o.yAxis, true);
  if (o.xAxis) o.xAxis = rapikanSumbu(o.xAxis, false);
  if (o.radiusAxis) o.radiusAxis = rapikanSumbu(o.radiusAxis, true);

  const daftarSeri = Array.isArray(o.series) ? o.series : o.series ? [o.series] : [];
  const seriBaru = daftarSeri.map((s: any) => {
    if (!s || typeof s !== 'object') return s;
    // Label pie/funnel/treemap bawaannya NAMA, jadi hanya templat {c} yang disentuh.
    const bawaanNilai = !['pie', 'funnel', 'treemap', 'sunburst', 'sankey', 'graph', 'radar'].includes(s.type);
    const hasil: any = { ...s, label: rapikanLabel(s.label, bawaanNilai) };
    if (s.markLine?.label) hasil.markLine = { ...s.markLine, label: rapikanLabel({ show: true, ...s.markLine.label }, true) };
    if (s.markPoint?.label) hasil.markPoint = { ...s.markPoint, label: rapikanLabel({ show: true, ...s.markPoint.label }, true) };
    return hasil;
  });
  if (o.series) o.series = Array.isArray(o.series) ? seriBaru : seriBaru[0];
  return o as T;
}
