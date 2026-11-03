/**
 * GAYA SEMUA — terapkan gaya dari panel Gaya ke SELURUH halaman dashboard.
 *
 * Dulu gaya hanya dipasang ke `dashboard.widgets` (proyeksi halaman aktif),
 * sehingga halaman lain tetap memakai gaya lama walau panel menulis "N kartu".
 * Fungsi ini memasang gaya ke widget di setiap halaman, lalu memproyeksikan
 * ulang halaman aktif. MURNI supaya bisa diuji.
 *
 * `target` adalah sasaran DESAIN dan PALET: `'semua'`, satu id, atau beberapa id
 * widget / kunci grafik template ("ganti beberapa saja"). Warna kartu, font, dan
 * ukuran font SELALU berlaku untuk semua widget.
 */

import type { Dashboard, WidgetSpec, WidgetStyle } from '../../types';
import { tipePunyaGaya } from '../../components/widgets/widgetStyle';
import { halamanAktif, proyeksi, tulisProyeksi } from './halaman';

export function terapkanGayaSemua(d: Dashboard, style: WidgetStyle | undefined, target: string | string[] = 'semua'): Dashboard {
  const dasar = d.gaya || {};
  const palet = style?.palette;
  const seri = style?.warnaSeri?.length ? style.warnaSeri : undefined;
  const sasaran = Array.isArray(target) ? target : target === 'semua' ? [] : [target];
  const semuaSasaran = sasaran.length === 0;

  const gaya: WidgetStyle = {
    ...dasar,
    desain: semuaSasaran ? style?.desain : dasar.desain,
    kartu: style?.kartu,
    font: style?.font,
    fontUkuran: style?.fontUkuran,
    palette: semuaSasaran ? palet : dasar.palette,
    warnaSeri: semuaSasaran ? seri : dasar.warnaSeri,
    chart: semuaSasaran ? dasar.chart : { ...(dasar.chart || {}), ...Object.fromEntries(sasaran.map((k) => [k, palet || 'default'])) },
  };

  const pasang = (w: WidgetSpec): WidgetSpec => {
    const kenaPalet = semuaSasaran || sasaran.includes(w.id);
    const gayaWidget: WidgetStyle = {
      ...(w.style || {}),
      desain: kenaPalet ? style?.desain : w.style?.desain,
      kartu: gaya.kartu,
      font: gaya.font,
      fontUkuran: gaya.fontUkuran,
      palette: kenaPalet ? palet : w.style?.palette,
      warnaSeri: kenaPalet ? seri : w.style?.warnaSeri,
    };
    // Tabel/narasi tidak menggambar chart: cukup desain dan warna kartunya.
    const gayaRingan: WidgetStyle | undefined =
      gayaWidget.desain || gaya.kartu ? { desain: gayaWidget.desain, kartu: gaya.kartu } : undefined;
    return { ...w, style: tipePunyaGaya(w.type) ? gayaWidget : gayaRingan };
  };

  const halaman = tulisProyeksi(d).map((h) => ({ ...h, widgets: (h.widgets || []).map(pasang) }));
  const hasil: Dashboard = { ...d, halaman, gaya };
  const aktif = halamanAktif(hasil);
  return aktif ? { ...hasil, ...proyeksi(aktif, hasil) } : { ...hasil, widgets: (d.widgets || []).map(pasang) };
}
