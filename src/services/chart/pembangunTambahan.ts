/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TIGA WAJAH CHART YANG SEBELUMNYA TIDAK ADA DI TEMPLATE CHART.
 *
 * Widget bertipe `map`, `gantt`, dan `boxplot` dulu tidak punya padanan di
 * katalog, sehingga sistem membuatkan entri sementara (`kustom-…`) yang menunjuk
 * chart lain. Sekarang ketiganya punya wajah sendiri, memakai gaya yang sama
 * dengan chart lain (`GayaVarian`): warna, sudut, garis, dan tipografi mengikuti
 * gaya template — bukan warna baru di luar desain.
 *
 * Semua pembangun di sini MURNI (tanpa I/O): datanya datang lewat `DataChart`,
 * persis seperti chart katalog lainnya.
 */

import { format, labelNilai, sumbuKategori, tooltip, type DataChart, type Pembangun } from './pembangunOpsi';

/** Nama peta yang didaftarkan `petaTerdaftar.ts` (GeoJSON provinsi Indonesia). */
export const NAMA_PETA = 'indonesia';

/** Angka pertama tiap kategori dari seri ke-0. */
const deret = (d: DataChart): Array<number | null> => d.seri[0]?.data ?? [];

/**
 * PETA WILAYAH — satu nilai per provinsi, warna makin pekat makin besar.
 *
 * Nama wilayah dicocokkan dengan nama fitur GeoJSON. Wilayah yang tidak dikenal
 * tetap dihitung dalam skala warna, tetapi tidak digambar; kartunya tidak
 * berpura-pura semua wilayah punya angka.
 */
export const petaWilayah: Pembangun = (d, g, s) => {
  const daerah =
    d.peta && d.peta.length > 0
      ? d.peta
      : d.kategori.map((nama, i) => ({ nama, nilai: Number(deret(d)[i] ?? 0) }));
  const angka = daerah.map((x) => x.nilai).filter((v) => Number.isFinite(v));
  const min = angka.length > 0 ? Math.min(...angka) : 0;
  const max = angka.length > 0 ? Math.max(...angka) : 1;
  const teksNilai = (v: number) => (Number.isFinite(v) ? format(v, d) : '-');
  return {
    tooltip: {
      ...tooltip(g, s),
      trigger: 'item',
      formatter: (p: any) => {
        const v = p?.value;
        const teks = v === undefined || v === null || Number.isNaN(Number(v)) ? 'belum ada data' : labelNilai(Number(v), d);
        return `${p?.name || '-'}<br/><b>${teks}</b>`;
      },
    },
    // Legenda warna mendatar: nilai terendah di kiri, tertinggi di kanan.
    visualMap: {
      min,
      max: max === min ? min + 1 : max,
      orient: 'horizontal',
      left: 'center',
      top: 'bottom',
      padding: [6 * s, 0, 0, 0],
      // ECharts memakai `itemHeight` sebagai PANJANG batang saat orient horizontal.
      itemWidth: 8 * s,
      itemHeight: 88 * s,
      text: [teksNilai(max), teksNilai(min)],
      textGap: 6 * s,
      precision: 0,
      calculable: false,
      textStyle: { color: g.teks3, fontSize: 8.5 * s },
      inRange: { color: [g.kartu2, g.aksen] },
    },
    series: [
      {
        type: 'map',
        map: NAMA_PETA,
        roam: false,
        zoom: 1.14,
        top: 2 * s,
        bottom: 20 * s,
        label: { show: false },
        itemStyle: { areaColor: g.kartu2, borderColor: g.garis, borderWidth: 0.7 * s },
        emphasis: {
          label: { show: true, color: g.teks, fontSize: 9 * s },
          itemStyle: { areaColor: g.aksen2 },
        },
        select: { disabled: true },
        data: daerah.map((x) => ({ name: x.nama, value: x.nilai })),
      },
    ],
  };
};

/** Tanggal ISO atau milidetik jadi angka; tak terbaca → NaN (baris dilewati). */
const keWaktu = (v: string | number): number => (typeof v === 'number' ? v : Date.parse(String(v)));

/**
 * JADWAL KEGIATAN (Gantt) — satu baris per kegiatan, batang = rentang tanggal,
 * bagian pekat = progres. Dua seri supaya legendanya jujur: "Rencana" (seluruh
 * rentang) dan "Progres" (bagian yang sudah selesai, berlabel persen).
 */
export const jadwalGantt: Pembangun = (d, g, s) => {
  const tugas = (d.jadwal ?? []).filter(
    (t) => Number.isFinite(keWaktu(t.mulai)) && Number.isFinite(keWaktu(t.selesai))
  );
  const nama = tugas.map((t) => t.nama);
  const mulai = tugas.map((t) => keWaktu(t.mulai));
  const selesai = tugas.map((t) => keWaktu(t.selesai));
  const awal = mulai.length > 0 ? Math.min(...mulai) : Date.now();
  const akhir = selesai.length > 0 ? Math.max(...selesai) : Date.now() + 86400000;
  const fmtTanggal = (ms: number) =>
    new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  const gambar = (pekat: boolean) => (params: any, api: any) => {
    const baris = Number(api.value(0));
    const kiri = api.coord([api.value(1), baris]);
    const kanan = api.coord([api.value(2), baris]);
    const tinggiBaris = (api.size?.([0, 1]) as number[])?.[1] ?? 16 * s;
    const tinggi = Math.max(7 * s, tinggiBaris * 0.5);
    const lebar = Math.max(2 * s, kanan[0] - kiri[0]);
    const y = kiri[1] - tinggi / 2;
    const sudut = Math.min(g.sudut / 2, tinggi / 2);
    const bentuk = { x: kiri[0], y, width: lebar, height: tinggi, r: sudut };
    const anak: any[] = [
      {
        type: 'rect',
        shape: bentuk,
        style: { fill: pekat ? g.aksen : `${g.aksen}30` },
      },
    ];
    // Label persen hanya pada seri progres, di ujung kanan batang.
    if (pekat) {
      // Selalu tampilkan, termasuk 0%: menyembunyikannya membuat baris tanpa
      // angka terlihat seperti data yang hilang.
      const persen = Math.round(Number(api.value(3)) || 0);
      {
        anak.push({
          type: 'text',
          style: {
            x: kiri[0] + lebar + 5 * s,
            y: kiri[1],
            text: `${persen}%`,
            fill: g.teks3,
            fontSize: 8.5 * s,
            align: 'left',
            verticalAlign: 'middle',
          },
        });
      }
    }
    return { type: 'group', children: anak };
  };

  const dataRencana = tugas.map((t, i) => ({ value: [i, keWaktu(t.mulai), keWaktu(t.selesai), 0] }));
  const dataProgres = tugas.map((t, i) => {
    const a = keWaktu(t.mulai);
    const b = keWaktu(t.selesai);
    const p = Math.max(0, Math.min(100, Number(t.progres) || 0));
    return { value: [i, a, a + (b - a) * (p / 100), p] };
  });

  return {
    tooltip: {
      ...tooltip(g, s),
      trigger: 'item',
      formatter: (p: any) => {
        const t = tugas[Number(p?.value?.[0])];
        if (!t) return '';
        const progres = t.progres === undefined || t.progres === null ? '' : `<br/>Progres: <b>${t.progres}%</b>`;
        return `${t.nama}<br/>${fmtTanggal(keWaktu(t.mulai))} → ${fmtTanggal(keWaktu(t.selesai))}${progres}`;
      },
    },
    legend: {
      show: true,
      top: 0,
      right: 0,
      itemWidth: 9 * s,
      itemHeight: 7 * s,
      itemGap: 10 * s,
      textStyle: { color: g.teks3, fontSize: 8.5 * s },
      data: ['Rencana', 'Progres'],
    },
    grid: { left: 4 * s, right: 16 * s, top: 16 * s, bottom: 6 * s, containLabel: true },
    xAxis: {
      type: 'time',
      min: awal,
      max: akhir,
      splitNumber: 4,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: g.garis, type: 'dashed' } },
      axisLabel: {
        color: g.teks3,
        fontSize: 8.5 * s,
        hideOverlap: true,
        formatter: (v: number) => new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      },
    },
    yAxis: {
      type: 'category',
      data: nama,
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: g.teks2, fontSize: 9.5 * s, width: 92 * s, overflow: 'truncate' },
    },
    series: [
      { name: 'Rencana', type: 'custom', renderItem: gambar(false), encode: { x: [1, 2], y: 0 }, data: dataRencana, z: 2, itemStyle: { color: `${g.aksen}30` } },
      { name: 'Progres', type: 'custom', renderItem: gambar(true), encode: { x: [1, 2], y: 0 }, data: dataProgres, z: 3, itemStyle: { color: g.aksen } },
    ],
  };
};

/**
 * KOTAK SEBARAN (boxplot) — garis = rentang min–maks, kotak = kuartil 1–3,
 * garis di tengah kotak = median. Untuk melihat sebaran dan nilai menyimpang.
 */
export const kotakSebaran: Pembangun = (d, g, s) => {
  const kotak = d.kotak ?? [];
  const nama = kotak.map((k) => k.nama);
  const nilai = kotak.flatMap((k) => [k.min, k.q1, k.median, k.q3, k.maks]);
  return {
    tooltip: {
      ...tooltip(g, s),
      trigger: 'item',
      formatter: (p: any) => {
        const k = kotak[Number(p?.dataIndex)];
        if (!k) return '';
        const angka = (v: number) => labelNilai(v, d);
        return `${k.nama}<br/>Maks: <b>${angka(k.maks)}</b><br/>Q3: ${angka(k.q3)}<br/>Median: <b>${angka(k.median)}</b><br/>Q1: ${angka(k.q1)}<br/>Min: ${angka(k.min)}`;
      },
    },
    grid: { left: 6 * s, right: 10 * s, top: 10 * s, bottom: 24 * s, containLabel: true },
    xAxis: { ...sumbuKategori(g, s, nama), splitArea: { show: false } },
    yAxis: {
      type: 'value',
      min: nilai.length > 0 ? Math.min(...nilai) : undefined,
      max: nilai.length > 0 ? Math.max(...nilai) : undefined,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: g.garis, type: 'dashed' } },
      axisLabel: { color: g.teks3, fontSize: 9 * s, formatter: (v: number) => format(v, d) },
    },
    series: [
      {
        type: 'boxplot',
        data: kotak.map((k) => [k.min, k.q1, k.median, k.q3, k.maks]),
        boxWidth: [8 * s, 26 * s],
        itemStyle: { color: `${g.aksen}2e`, borderColor: g.aksen, borderWidth: 1.2 * s },
        emphasis: { itemStyle: { borderColor: g.aksen2, borderWidth: 2 * s } },
      },
    ],
  };
};
