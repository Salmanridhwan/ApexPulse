import type { EChartsOption } from 'echarts';

/**
 * Menyesuaikan opsi ECharts dengan ukuran kartu.
 *
 * Semua 38 chart katalog digambar oleh fungsi yang sama, jadi perbaikan di sini
 * berlaku untuk seluruh dashboard — bukan menambal satu chart satu per satu.
 * Tanpa ini, kartu sempit menampilkan legenda bertumpuk, sumbu terpotong, dan
 * label potongan yang menimpa grafiknya.
 */
export const rapikanUntukUkuran = (opsi: EChartsOption, lebar: number, tinggi: number): EChartsOption => {
  const sempit = lebar < 420;
  const sedang = lebar < 620;
  const pendek = tinggi < 220;
  const o: any = { ...opsi };

  // Huruf ikut mengecil supaya label tidak memakan separuh kartu.
  o.textStyle = { ...(o.textStyle || {}), fontSize: sempit ? 9 : sedang ? 10 : (o.textStyle?.fontSize ?? 12) };

  // `containLabel` menjamin sumbu & label tetap di dalam kotak gambar.
  if (o.grid) {
    const daftar = Array.isArray(o.grid) ? o.grid : [o.grid];
    const dirapikan = daftar.map((g: any) => ({
      left: sempit ? 2 : 8,
      right: sempit ? 2 : 10,
      top: pendek ? 6 : 12,
      bottom: sempit ? 2 : 8,
      ...g,
      containLabel: true,
    }));
    o.grid = Array.isArray(o.grid) ? dirapikan : dirapikan[0];
  }

  // Legenda disembunyikan saat kartu sempit/pendek: legenda satu baris di kartu
  // 300px selalu menimpa grafik, dan informasinya tetap ada di tooltip.
  if (o.legend) {
    const daftar = Array.isArray(o.legend) ? o.legend : [o.legend];
    const dirapikan = daftar.map((l: any) => ({
      ...l,
      show: l.show === false ? false : !(sempit || pendek),
      type: 'scroll',
      itemWidth: sempit ? 8 : 12,
      itemHeight: sempit ? 6 : 8,
      itemGap: sempit ? 6 : 10,
      textStyle: { ...(l.textStyle || {}), fontSize: sempit ? 9 : 10 },
    }));
    o.legend = Array.isArray(o.legend) ? dirapikan : dirapikan[0];
  }

  const aturSumbu = (sumbu: any) => {
    if (!sumbu) return sumbu;
    const daftar = Array.isArray(sumbu) ? sumbu : [sumbu];
    const dirapikan = daftar.map((s: any) => ({
      ...s,
      // Nama sumbu memakan ruang; di kartu sempit cukup satuannya di tooltip.
      name: sempit ? '' : s.name,
      nameTextStyle: { ...(s.nameTextStyle || {}), fontSize: sempit ? 9 : 10 },
      axisLabel: {
        ...(s.axisLabel || {}),
        fontSize: sempit ? 9 : 10,
        hideOverlap: true,
        ...(sempit ? { overflow: 'truncate', width: 58 } : {}),
        ...(pendek ? { interval: 'auto' } : {}),
      },
    }));
    return Array.isArray(sumbu) ? dirapikan : dirapikan[0];
  };
  if (o.xAxis) o.xAxis = aturSumbu(o.xAxis);
  if (o.yAxis) o.yAxis = aturSumbu(o.yAxis);

  // Label di dalam grafik: hanya untuk chart bagian (donat/corong/treemap) dan
  // hanya bila kartu cukup besar. `hideOverlap` mencegah label saling menimpa.
  if (Array.isArray(o.series)) {
    /**
     * Nama kategori bisnis panjang ("PDTP USAHA FACILITY SERVICES"). Di petak
     * sempit namanya keluar dari petak dan menimpa petak sebelahnya, jadi nama
     * dipotong mengikuti lebar kartu sebelum digambar.
     */
    const maksHuruf = Math.max(8, Math.round(lebar / 9));
    const potongNama = (asal: any) => (p: any) => {
      const teks = String(p?.name ?? '');
      const pendek = teks.length > maksHuruf ? `${teks.slice(0, maksHuruf - 1)}…` : teks;
      if (typeof asal === 'function') return asal({ ...p, name: pendek });
      return pendek;
    };

    o.series = o.series.map((s: any) => {
      const bagian = /^(pie|funnel|treemap|sunburst|radar)$/.test(String(s.type));
      const petak = /^(treemap|sunburst)$/.test(String(s.type));
      if (petak) {
        return {
          ...s,
          label: {
            ...(s.label || {}),
            // Teks petak tetap tampil meski kartu pendek; yang sempit saja disembunyikan.
            show: !sempit,
            fontSize: sempit ? 9 : pendek ? 9 : 10,
            // Petak kecil tidak muat teks panjang: potong, jangan biarkan meluber.
            overflow: 'truncate',
            width: Math.max(54, Math.round(lebar / 4)),
            ellipsis: '…',
            formatter: potongNama(s.label?.formatter),
          },
          labelLayout: { hideOverlap: true, ...(s.labelLayout || {}) },
          breadcrumb: { show: false },
        };
      }
      /**
       * Cincin (pie berlubang) tidak diberi label nama potongan: legenda dan
       * warnanya sudah menjelaskan tiap bagian. Label yang memang diminta
       * pembangunnya (mis. persen dari rancangan) tetap dihormati.
       */
      const cincin =
        s.type === 'pie' && Array.isArray(s.radius) && parseFloat(String(s.radius[0] ?? 0)) > 0;
      const tampil = cincin
        ? (s.label?.show ?? false)
        : bagian
          ? !(sempit || pendek)
          : (s.label?.show ?? false);
      return {
        ...s,
        label: { ...(s.label || {}), show: tampil, fontSize: sempit ? 9 : 10 },
        labelLayout: { hideOverlap: true, ...(s.labelLayout || {}) },
        ...(s.type === 'treemap' ? { breadcrumb: { show: !sempit } } : {}),
      };
    });
  }

  /**
   * Semua kategori SELALU digambar, berapa pun lebar kartunya (permintaan pemilik
   * aplikasi: chart responsif menampilkan semua data). Dulu kartu sempit diberi
   * `dataZoom` sehingga 12 bulan terpotong di Okt. Label yang tidak muat cukup
   * dijarangkan oleh `hideOverlap` di sumbu, datanya tidak dibuang.
   */

  // Judul & teks tambahan di dalam kanvas grafik ikut mengecil.
  if (o.title) {
    const daftar = Array.isArray(o.title) ? o.title : [o.title];
    const dirapikan = daftar.map((t: any) => ({ ...t, textStyle: { ...(t.textStyle || {}), fontSize: sempit ? 10 : 12 } }));
    o.title = Array.isArray(o.title) ? dirapikan : dirapikan[0];
  }

  return o as EChartsOption;
};
