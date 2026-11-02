/**
 * RANCANGAN CHART DARI ASISTEN (RAG).
 *
 * Asisten tidak lagi wajib memakai 30 chart katalog: untuk setiap grafik ia
 * memilih sendiri bentuk, warna, judul sumbu, tumpukan, label nilai, dan letak
 * legenda dari isi dokumennya. Kanvas menggambar rancangan itu apa adanya.
 *
 * Begitu pengguna memilih chart katalog (`chartId`) atau gaya template
 * (`style.desain`, mis. Pijar/Lensa/Nadi), rancangan diabaikan dan widget
 * tampil dengan wajah template seperti biasa. MURNI supaya bisa diuji.
 */

import type { RancanganChart, WidgetSpec } from '../../types';

const HEX = /^#[0-9a-f]{6}$/i;
const LEGENDA = ['atas', 'bawah', 'kanan', 'tidak'] as const;

const teksPendek = (t: unknown, n: number) => {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, n) : undefined;
};

/**
 * Rapikan `desain` mentah dari RAG: hanya warna heksadesimal sah (maks 8),
 * teks dipotong, nilai lain di luar pilihan dibuang. Selalu mengembalikan
 * rancangan (minimal bentuknya) supaya widget tetap ditandai buatan asisten.
 */
export function bersihkanRancangan(desain: any, bentuk: string): RancanganChart {
  const d = desain && typeof desain === 'object' ? desain : {};
  const warna = (Array.isArray(d.warna) ? d.warna : []).map((w: unknown) => String(w).trim()).filter((w: string) => HEX.test(w)).slice(0, 8);
  const legenda = LEGENDA.includes(d.legenda) ? (d.legenda as RancanganChart['legenda']) : undefined;
  const r: RancanganChart = { bentuk };
  if (warna.length) r.warna = warna;
  const sk = teksPendek(d.judulSumbuKategori, 30);
  const sn = teksPendek(d.judulSumbuNilai, 30);
  if (sk) r.judulSumbuKategori = sk;
  if (sn) r.judulSumbuNilai = sn;
  if (typeof d.tumpuk === 'boolean') r.tumpuk = d.tumpuk;
  if (typeof d.tampilkanNilai === 'boolean') r.tampilkanNilai = d.tampilkanNilai;
  if (legenda) r.legenda = legenda;
  if (typeof d.garisHalus === 'boolean') r.garisHalus = d.garisHalus;
  const alasan = teksPendek(d.alasan, 120);
  if (alasan) r.alasan = alasan;
  return r;
}

/** Rancangan asisten dipakai selama pengguna belum memilih chart katalog atau gaya template. */
export function pakaiRancangan(w: Pick<WidgetSpec, 'rancangan' | 'chartId' | 'style'>): boolean {
  return Boolean(w.rancangan) && !w.chartId && !w.style?.desain;
}

const daftar = <T,>(x: T | T[] | undefined): T[] => (Array.isArray(x) ? x : x ? [x] : []);

/**
 * Terapkan rancangan ke opsi ECharts yang sudah jadi (dari `buildChartOption`).
 * Hanya menyentuh hal yang dirancang asisten; sisanya tetap gaya dasar kanvas.
 */
export function terapkanRancangan(option: any, r: RancanganChart | undefined): any {
  if (!r || !option || typeof option !== 'object') return option;
  const o = { ...option };
  if (r.warna?.length) o.color = r.warna;

  // Judul sumbu: sumbu kategori dan sumbu nilai, apa pun orientasinya (hbar terbalik).
  const beriNama = (sumbu: any) => {
    if (!sumbu || typeof sumbu !== 'object') return sumbu;
    const nama = sumbu.type === 'category' ? r.judulSumbuKategori : r.judulSumbuNilai;
    if (!nama) return sumbu;
    return { ...sumbu, name: nama, nameLocation: 'middle', nameGap: sumbu.type === 'category' ? 26 : 42, nameTextStyle: { fontSize: 11, ...(sumbu.nameTextStyle ?? {}) } };
  };
  for (const kunci of ['xAxis', 'yAxis'] as const) {
    if (o[kunci] === undefined) continue;
    o[kunci] = Array.isArray(o[kunci]) ? o[kunci].map((s: any, i: number) => (i === 0 ? beriNama(s) : s)) : beriNama(o[kunci]);
  }
  // Ruang untuk judul sumbu supaya tidak terpotong.
  if ((r.judulSumbuKategori || r.judulSumbuNilai) && o.grid && !Array.isArray(o.grid)) {
    o.grid = { ...o.grid, containLabel: true, left: Math.max(Number(o.grid.left) || 0, 28), bottom: Math.max(Number(o.grid.bottom) || 0, 28) };
  }

  o.series = daftar(o.series).map((s: any, i: number) => {
    const seri = { ...s };
    const jenis = String(seri.type || '');
    // Warna rancangan menang atas warna bawaan (mis. batang pelangi per kategori).
    if (r.warna?.length && jenis !== 'pie') {
      seri.itemStyle = { ...(seri.itemStyle ?? {}), color: r.warna[i % r.warna.length] };
      if (jenis === 'line') seri.lineStyle = { ...(seri.lineStyle ?? {}), color: r.warna[i % r.warna.length] };
    }
    if (r.tumpuk !== undefined && (jenis === 'bar' || jenis === 'line')) seri.stack = r.tumpuk ? 'total' : undefined;
    if (r.garisHalus !== undefined && jenis === 'line') seri.smooth = r.garisHalus;
    if (r.tampilkanNilai !== undefined) {
      if (jenis === 'pie') {
        // Cincin bawaan menaruh label di tengah (untuk teks total); label nilai
        // per potongan harus di luar supaya tidak bertumpuk di tengah.
        if (r.tampilkanNilai) {
          seri.label = { ...(seri.label ?? {}), show: true, position: 'outside', formatter: '{d}%' };
          seri.labelLine = { ...(seri.labelLine ?? {}), show: true, length: 6, length2: 6 };
        }
      } else {
        const letak = jenis === 'bar' && o.yAxis && daftar(o.yAxis)[0]?.type === 'category' ? 'right' : 'top';
        seri.label = { ...(seri.label ?? {}), show: r.tampilkanNilai, position: letak };
      }
    }
    return seri;
  });

  if (r.legenda) {
    const dasar = o.legend && !Array.isArray(o.legend) ? o.legend : {};
    o.legend =
      r.legenda === 'tidak'
        ? { ...dasar, show: false }
        : r.legenda === 'kanan'
          ? { ...dasar, show: true, orient: 'vertical', right: 0, top: 'middle', left: undefined, bottom: undefined }
          : r.legenda === 'atas'
            ? { ...dasar, show: true, orient: 'horizontal', top: 0, bottom: undefined }
            : { ...dasar, show: true, orient: 'horizontal', bottom: 0, top: undefined };
  }
  // Ruang atas untuk legenda atas dan label nilai di puncak batang/titik.
  if (o.grid && !Array.isArray(o.grid) && (r.legenda === 'atas' || r.tampilkanNilai)) {
    const perlu = (r.legenda === 'atas' ? 30 : 0) + (r.tampilkanNilai ? 16 : 0);
    o.grid = { ...o.grid, top: Math.max(Number(o.grid.top) || 0, perlu) };
  }
  return o;
}
