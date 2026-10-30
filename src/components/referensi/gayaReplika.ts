import type { WidgetStyle } from '../../types';
import { PALET } from '../widgets/widgetStyle';

/**
 * MENERAPKAN GAYA GLOBAL KE OPSI ECHARTS PADA DESAIN TEMPLATE.
 *
 * Komponen replika (`DashboardReferensi`, `DashboardAnalitik`, `DashboardTrafik`)
 * menyusun opsi grafik sendiri dengan warna dan ukuran font yang ditulis tetap,
 * sehingga panel Gaya tidak berpengaruh. Fungsi ini menyetel ulang opsi itu
 * sesudah disusun: palet seri, font, ukuran font, ketebalan garis, dan sudut
 * batang — tanpa mengubah susunan, sumbu, atau bentuk grafiknya.
 */
export function gayaReplika<T>(
  opsi: T,
  gaya?: WidgetStyle,
  kunci?: string,
  kartuTerang = false
): T {
  if (!gaya || !opsi || typeof opsi !== 'object') return opsi;

  const hasil: any = menyalin(opsi);

  // Kartu terang: teks grafik ikut gelap, kalau tidak angkanya hilang di latar putih.
  if (kartuTerang) warnaTeksGelap(hasil);

  // ---- Palet seri ----
  // Palet khusus grafik ini menang atas palet umum.
  const paletKhusus = kunci ? (gaya.chart?.[kunci] as keyof typeof PALET | undefined) : undefined;
  const namaPalet = (paletKhusus || gaya.palette) as keyof typeof PALET | undefined;
  const palet = gaya.warnaSeri?.length
    ? gaya.warnaSeri
    : namaPalet && namaPalet !== 'default'
      ? PALET[namaPalet]?.warna
      : undefined;

  if (palet?.length) {
    hasil.color = palet;
    // Warna per seri yang ditulis tetap di opsi dibuang supaya palet berlaku.
    for (const s of Array.isArray(hasil.series) ? hasil.series : []) {
      if (!s || typeof s !== 'object') continue;
      // Warna eksplisit dibuang supaya palet ECharts yang dipakai.
      if (s.itemStyle) delete s.itemStyle.color;
      if (s.lineStyle) delete s.lineStyle.color;
      // Donat/pie mewarnai tiap potongan lewat data[].itemStyle.
      for (const d of Array.isArray(s.data) ? s.data : []) {
        if (d && typeof d === 'object' && d.itemStyle) delete d.itemStyle.color;
      }
    }
  }

  // ---- Font ----
  const font = gaya.font;
  if (font) {
    const keluarga = `'${font}', 'Inter', system-ui, sans-serif`;
    hasil.textStyle = { ...(hasil.textStyle || {}), fontFamily: keluarga };
    for (const kunci of ['xAxis', 'yAxis']) {
      for (const sumbu of Array.isArray(hasil[kunci]) ? hasil[kunci] : hasil[kunci] ? [hasil[kunci]] : []) {
        if (!sumbu || typeof sumbu !== 'object') continue;
        sumbu.axisLabel = { ...(sumbu.axisLabel || {}), fontFamily: keluarga };
        sumbu.nameTextStyle = { ...(sumbu.nameTextStyle || {}), fontFamily: keluarga };
      }
    }
    if (hasil.legend?.textStyle) hasil.legend.textStyle.fontFamily = keluarga;
    if (hasil.tooltip?.textStyle) hasil.tooltip.textStyle.fontFamily = keluarga;
  }

  // ---- Ukuran font: semua fontSize diskalakan dari dasar 13px ----
  if (typeof gaya.fontUkuran === 'number' && gaya.fontUkuran > 0) {
    const rasio = gaya.fontUkuran / 13;
    if (Math.abs(rasio - 1) > 0.01) skala(hasil, rasio);
  }

  // ---- Ketebalan garis & sudut batang ----
  for (const s of Array.isArray(hasil.series) ? hasil.series : []) {
    if (!s || typeof s !== 'object') continue;
    if (typeof gaya.garisTebal === 'number' && (s.type === 'line' || s.areaStyle)) {
      s.lineStyle = { ...(s.lineStyle || {}), width: gaya.garisTebal };
    }
    if (typeof gaya.batangRadius === 'number' && s.type === 'bar') {
      s.itemStyle = { ...(s.itemStyle || {}), borderRadius: gaya.batangRadius };
    }
  }

  return hasil as T;
}

/**
 * Ganti warna teks grafik menjadi gelap saat kartu berlatar terang.
 * Hanya kunci yang memang mengatur tinta yang disentuh, supaya warna seri
 * (batang/garis/donat) tidak ikut berubah.
 */
function warnaTeksGelap(node: any) {
  if (!node || typeof node !== 'object') return;
  for (const [kunci, nilai] of Object.entries(node)) {
    // Tooltip punya latar sendiri; jangan diubah agar teksnya tidak hilang.
    if (kunci === 'tooltip') continue;
    const tinta = ['color', 'borderColor', 'textBorderColor'].includes(kunci);
    if (kunci === 'axisLabel' || kunci === 'nameTextStyle' || kunci === 'textStyle') {
      if (node[kunci] && typeof node[kunci] === 'object') {
        (node[kunci] as any).color = '#1a1d1f';
      }
    }
    if (kunci === 'splitLine' || kunci === 'axisLine') {
      const bagian = node[kunci] as any;
      if (bagian?.lineStyle) bagian.lineStyle.color = 'rgba(0,0,0,0.12)';
    }
    if (tinta && typeof nilai === 'string' && terang(nilai)) {
      node[kunci] = '#1a1d1f';
    }
    warnaTeksGelap(nilai);
  }
}

/** Apakah warna hex ini terang (mendekati putih)? */
function terang(hex: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

/** Salin dalam (cukup untuk opsi ECharts yang berisi objek/array biasa). */
function menyalin<T>(nilai: T): T {
  if (Array.isArray(nilai)) return nilai.map((x) => menyalin(x)) as unknown as T;
  if (nilai && typeof nilai === 'object') {
    const keluar: any = {};
    for (const [k, v] of Object.entries(nilai as any)) keluar[k] = menyalin(v);
    return keluar;
  }
  return nilai;
}

/** Kalikan setiap `fontSize` numerik dengan rasio. */
function skala(node: any, rasio: number) {
  if (Array.isArray(node)) {
    for (const x of node) skala(x, rasio);
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if (k === 'fontSize' && typeof v === 'number') {
      node[k] = Math.max(8, Math.round(v * rasio));
    } else {
      skala(v, rasio);
    }
  }
}
