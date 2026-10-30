import type { GayaVarian } from './gayaVarian';
import { format, labelNilai, type DataChart, type Pembangun } from './pembangunOpsi';

/**
 * AREA RINGKAS (wajah Pijar untuk `area-gradasi`).
 *
 * Kartu Pijar pendek, tingginya sekitar 8em. Grafik area bawaan terlalu ramai di
 * ukuran itu: sumbu Y penuh angka, label X berdesakan, dan label titik terakhir
 * menutupi garis. Versi ini menyisakan yang penting saja:
 *
 * - sumbu Y disembunyikan, tingginya dipatok ke rentang data supaya garis tidak
 *   menempel di tepi bawah,
 * - label X dibatasi sekitar lima buah,
 * - titik terakhir diberi satu lencana angka di atasnya.
 */
export const areaRingkas: Pembangun = (d: DataChart, g: GayaVarian, s: number) => {
  const nilai = (d.seri[0]?.data ?? []).map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null));
  const sah = nilai.filter((v): v is number => v !== null);
  const atas = sah.length ? Math.max(...sah) : 1;
  const bawah = sah.length ? Math.min(...sah) : 0;
  const jeda = (atas - bawah) * 0.45 || Math.abs(atas) * 0.2 || 1;
  const akhir = nilai.length - 1;
  const lompat = Math.max(1, Math.ceil(nilai.length / 5));

  return {
    animationDuration: 700,
    animationEasing: 'cubicOut',
    grid: { left: 2 * s, right: 12 * s, top: 20 * s, bottom: 2 * s, containLabel: true },
    tooltip: {
      backgroundColor: g.kartu2,
      borderColor: g.garis,
      borderWidth: 1,
      padding: [6 * s, 9 * s],
      extraCssText: `border-radius:${7 * s}px;`,
      textStyle: { color: g.teks, fontSize: 10.5 * s },
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: `${g.aksen}55`, type: 'dashed', width: 1 } },
      formatter: (p: any[]) =>
        `<div style="font-size:${9.5 * s}px;color:${g.teks3}">${p[0]?.name ?? ''}</div>` +
        `<b style="font-size:${11.5 * s}px">${labelNilai(Number(p[0]?.value ?? 0), d)}</b>`,
    },
    xAxis: {
      type: 'category',
      data: d.kategori,
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: g.teks3, fontSize: 9 * s, interval: lompat - 1, margin: 7 * s },
    },
    yAxis: {
      type: 'value',
      show: false,
      min: bawah - jeda,
      max: atas + jeda,
    },
    series: [
      {
        type: 'line',
        smooth: 0.4,
        showSymbol: false,
        data: nilai,
        lineStyle: { width: 2.2 * s, color: g.aksen, shadowColor: `${g.aksen}55`, shadowBlur: 8 * s, shadowOffsetY: 3 * s },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${g.aksen}4d` },
              { offset: 1, color: `${g.aksen}00` },
            ],
          },
        },
        ...(akhir >= 0 && nilai[akhir] !== null
          ? {
              markPoint: {
                symbol: 'circle',
                symbolSize: 7 * s,
                itemStyle: { color: g.aksen, borderColor: g.latar, borderWidth: 2 * s },
                label: {
                  show: true,
                  position: 'top',
                  distance: 6 * s,
                  color: g.teks,
                  fontSize: 9.5 * s,
                  fontWeight: 600,
                  backgroundColor: g.kartu2,
                  borderColor: g.garis,
                  borderWidth: 1,
                  borderRadius: 5 * s,
                  padding: [3 * s, 6 * s],
                  // Hanya angkanya: satuan panjang ("Miliar Rp") bikin lencana
                  // melebar keluar kartu. Satuannya tetap muncul di tooltip.
                  formatter: () => format(Number(nilai[akhir] ?? 0), d),
                },
                data: [{ coord: [akhir, nilai[akhir]] }],
              },
            }
          : {}),
      },
    ],
  };
};
