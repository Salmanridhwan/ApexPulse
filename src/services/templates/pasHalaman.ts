import type { WidgetSpec } from '../../types';

/**
 * TINGGI HALAMAN DECK MAKSIMAL 7 BARIS (434 px).
 *
 * Kartu KPI butuh 3 baris dan grafik 4 baris, jadi halaman paling ringkas sudah
 * 7 baris. Banyak halaman deck tumbuh sampai 8-11 baris karena kartunya ditumpuk:
 * enam KPI selebar 4 kolom pecah jadi dua baris, atau dua kartu selebar 7 kolom
 * (7 + 7 > 12) tidak muat berjejer. Fungsi ini hanya mengubah LEBAR dan TINGGI
 * kartu, tidak menghapus atau memindah urutan kartu, sehingga isi slide tetap.
 *
 * Langkah, berhenti begitu halaman muat:
 *   1. Baris-baris yang isinya hanya KPI (maksimal 6 kartu) dijadikan satu baris.
 *   2. Dua baris berurutan yang sama-sama belum penuh dijejerkan, lebarnya
 *      dibagi ulang secara proporsional menjadi 12 kolom.
 *   3. Kartu tertinggi yang bukan KPI dipendekkan satu baris (grafik/tabel
 *      minimal 3, narasi minimal 2).
 */

export const MAKS_BARIS_DECK = 7;
const KOLOM = 12;

const adalahKpi = (w: WidgetSpec) => w.type === 'kpi' || w.type === 'bullet-target';
const lebarDari = (w: WidgetSpec) => Math.max(1, Math.min(KOLOM, w.grid?.w ?? 4));
const tinggiDari = (w: WidgetSpec) => Math.max(2, w.grid?.h ?? 3);

/**
 * Jumlah baris yang dipakai browser: meniru penempatan otomatis CSS grid
 * (`grid-auto-flow: row`, tanpa `dense`) pada 12 kolom.
 */
export function barisGrid(kartu: Array<{ w: number; h: number }>): number {
  const terisi: boolean[][] = [];
  let r0 = 0;
  let c0 = 0;
  let maks = 0;
  const bebas = (r: number, c: number, w: number, h: number) => {
    if (c + w > KOLOM) return false;
    for (let y = r; y < r + h; y += 1) for (let x = c; x < c + w; x += 1) if (terisi[y]?.[x]) return false;
    return true;
  };
  for (const { w, h } of kartu) {
    let r = r0;
    let c = c0;
    for (;;) {
      if (c + w > KOLOM) {
        r += 1;
        c = 0;
        continue;
      }
      if (bebas(r, c, w, h)) break;
      c += 1;
    }
    for (let y = r; y < r + h; y += 1) {
      terisi[y] ??= [];
      for (let x = c; x < c + w; x += 1) terisi[y][x] = true;
    }
    r0 = r;
    c0 = c + w;
    maks = Math.max(maks, r + h);
  }
  return maks;
}

/** Bagi `total` kolom ke kartu sebanding bobotnya, jumlahnya tepat `total`. */
function bagiLebar(bobot: number[], total = KOLOM): number[] {
  const jumlah = bobot.reduce((a, b) => a + b, 0);
  const hasil = bobot.map((b) => Math.max(1, Math.floor((b / jumlah) * total)));
  let sisa = total - hasil.reduce((a, b) => a + b, 0);
  for (let i = 0; sisa > 0; i = (i + 1) % hasil.length, sisa -= 1) hasil[i] += 1;
  return hasil;
}

export function pasHalaman(kartu: WidgetSpec[], maks = MAKS_BARIS_DECK): WidgetSpec[] {
  const ukuran = kartu.map((w) => ({ w: lebarDari(w), h: tinggiDari(w) }));
  const baris = () => barisGrid(ukuran);
  const terap = () =>
    kartu.map((w, i) =>
      ukuran[i].w === lebarDari(w) && ukuran[i].h === tinggiDari(w)
        ? w
        : { ...w, grid: { ...w.grid, w: ukuran[i].w, h: ukuran[i].h } }
    );
  if (baris() <= maks) return kartu;

  /** Pecah urutan kartu menjadi baris isi (jumlah lebar ≤ 12). */
  const pecahBaris = (): number[][] => {
    const hasil: number[][] = [];
    let kini: number[] = [];
    let lebar = 0;
    ukuran.forEach((u, i) => {
      if (lebar + u.w > KOLOM && kini.length) {
        hasil.push(kini);
        kini = [];
        lebar = 0;
      }
      kini.push(i);
      lebar += u.w;
    });
    if (kini.length) hasil.push(kini);
    return hasil;
  };

  // 1. Baris KPI berurutan menjadi satu baris.
  {
    const daftar = pecahBaris();
    for (let a = 0; a < daftar.length; a += 1) {
      if (!daftar[a].every((i) => adalahKpi(kartu[i]))) continue;
      let b = a;
      while (b + 1 < daftar.length && daftar[b + 1].every((i) => adalahKpi(kartu[i]))) b += 1;
      const anggota = daftar.slice(a, b + 1).flat();
      if (b > a && anggota.length <= 6) {
        const lebar = bagiLebar(anggota.map(() => 1));
        anggota.forEach((i, k) => {
          ukuran[i].w = lebar[k];
          ukuran[i].h = 3;
        });
      }
      a = b;
    }
  }
  if (baris() <= maks) return terap();

  // 1b. KPI yang tumpah ke baris berikutnya ("funnel 8 + KPI 4 | KPI 4") ditarik
  // kembali: KPI selebar 3 kolom, kartu lain mengambil sisanya (minimal 4).
  {
    const daftar = pecahBaris();
    for (let j = 0; j + 1 < daftar.length; j += 1) {
      const atas = daftar[j];
      const bawah = daftar[j + 1];
      if (!bawah.every((i) => adalahKpi(kartu[i]))) continue;
      const lain = atas.filter((i) => !adalahKpi(kartu[i]));
      const kpiSemua = [...atas.filter((i) => adalahKpi(kartu[i])), ...bawah];
      if (lain.length !== 1 || KOLOM - 3 * kpiSemua.length < 4) continue;
      ukuran[lain[0]].w = KOLOM - 3 * kpiSemua.length;
      ukuran[lain[0]].h = Math.max(3, ukuran[lain[0]].h);
      for (const i of kpiSemua) {
        ukuran[i].w = 3;
        ukuran[i].h = ukuran[lain[0]].h;
      }
      j += 1;
    }
  }
  if (baris() <= maks) return terap();

  // 2. Dua baris berurutan yang belum penuh dijejerkan.
  for (let ulang = 0; ulang < 4 && baris() > maks; ulang += 1) {
    const daftar = pecahBaris();
    const penuh = (d: number[]) => d.reduce((s, i) => s + ukuran[i].w, 0) >= KOLOM;
    const k = daftar.findIndex((d, j) => j + 1 < daftar.length && !penuh(d) && !penuh(daftar[j + 1]) && d.length + daftar[j + 1].length <= 3);
    if (k < 0) break;
    const anggota = [...daftar[k], ...daftar[k + 1]];
    const lebar = bagiLebar(anggota.map((i) => ukuran[i].w));
    const tinggi = Math.max(...anggota.map((i) => ukuran[i].h));
    anggota.forEach((i, n) => {
      ukuran[i].w = lebar[n];
      ukuran[i].h = adalahKpi(kartu[i]) ? ukuran[i].h : tinggi;
    });
  }
  if (baris() <= maks) return terap();

  // 3. Pendekkan kartu tertinggi yang bukan KPI. Kalau tetap tidak muat,
  // pemendekan dibatalkan: grafik yang sempit tanpa hasil hanya merugikan.
  const cadangan = ukuran.map((u) => ({ ...u }));
  for (let ulang = 0; ulang < 12 && baris() > maks; ulang += 1) {
    const calon = ukuran
      .map((u, i) => ({ i, h: u.h, min: kartu[i].type === 'narasi' ? 2 : 3 }))
      .filter((c) => !adalahKpi(kartu[c.i]) && c.h > c.min)
      .sort((x, y) => y.h - x.h);
    if (calon.length === 0) break;
    ukuran[calon[0].i].h -= 1;
  }
  if (baris() > maks) cadangan.forEach((u, i) => Object.assign(ukuran[i], u));
  return terap();
}
