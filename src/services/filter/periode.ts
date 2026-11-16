/**
 * FILTER PERIODE DASHBOARD.
 *
 * Dipisah dari komponen supaya bisa diuji tanpa React. Yang diurus di sini:
 * daftar pilihan periode yang layak ditawarkan, dan aturan cocok/tidaknya satu
 * kartu terhadap periode terpilih.
 *
 * Sebab aturan ini ada (temuan dari data nyata, bukan dugaan): kartu dashboard
 * menyimpan periode di DUA tempat — kolom `periode` (satu periode per kartu) dan
 * `periodeData[]` (satu indikator dengan banyak periode, pemilihnya ada di
 * kepala kartu). Filter global dulu hanya membaca yang pertama, sehingga
 * pilihannya cuma "2026"/"Okt 2026" dari segelintir kartu, dan memilih periode
 * tidak mengubah apa pun: mayoritas kartu tidak punya periode, jadi tidak pernah
 * tersaring dan tidak pernah berganti isi.
 */
import type { WidgetSpec } from '../../types';

const BULAN_URUT = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];

/** Tahun 4 digit di dalam teks periode ("Mei 2026" -> "2026"). */
export const tahunDari = (p: string): string => (/(\d{4})/.exec(p || '') || ['', ''])[1] || '';

/** Indeks bulan (0-11) dari teks periode; -1 bila tidak terbaca. */
export const indeksBulan = (p: string): number =>
  BULAN_URUT.findIndex((b) => new RegExp(`(^|[^a-z])${b}`, 'i').test(p || ''));

/** Urut kronologis: tahun dulu, lalu bulan; "2026" (tanpa bulan) mendahului bulan-bulannya. */
export function urutPeriode(daftar: string[]): string[] {
  return [...daftar].sort((a, b) => {
    const ta = tahunDari(a) || '9999';
    const tb = tahunDari(b) || '9999';
    if (ta !== tb) return ta.localeCompare(tb);
    // -1 = periode tanpa bulan (mis. "2026"), taruh paling awal dalam tahunnya.
    const ia = indeksBulan(a);
    const ib = indeksBulan(b);
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b, 'id');
  });
}

/** Semua periode yang benar-benar ada di sekumpulan kartu (kolom + periodeData). */
export function periodeTersedia(widgets: WidgetSpec[]): string[] {
  const nilai = widgets.flatMap((w) => [
    (w.periode ?? '').trim(),
    ...(w.periodeData || []).map((p) => (p.periode ?? '').trim()),
  ]);
  const bersih = nilai.filter((v) => v !== '' && v.toLowerCase() !== 'semua');
  return urutPeriode(Array.from(new Set(bersih)));
}

/**
 * Cocokkan PERIODE satu kartu dengan pilihan filter.
 *
 * - Kartu tanpa dimensi waktu (`periode` kosong dan tanpa `periodeData`) TIDAK
 *   disembunyikan: mayoritas kartu memang begitu, dan menyembunyikannya membuat
 *   papan kosong begitu satu periode dipilih.
 * - Kartu ber-`periodeData` cocok bila memuat periode itu; kartunya lalu
 *   MENAMPILKAN periode tersebut (`periodePilihan` diteruskan ke `WidgetCard`).
 * - Kartu satu periode cocok bila tahun dan bulannya sejalan, jadi kartu
 *   bertahun saja ("2026") tetap tampil saat memilih "Mei 2026" dan sebaliknya.
 */
export function cocokPeriode(w: WidgetSpec, pilihan: string): boolean {
  if (!pilihan || pilihan === 'Semua') return true;

  const daftar = (w.periodeData || []).map((p) => (p.periode || '').trim()).filter(Boolean);
  if (daftar.length > 0) {
    if (daftar.includes(pilihan)) return true;
    // Pilihan hanya TAHUN: kartu bulanan tahun itu tetap tampil.
    if (/^\d{4}$/.test(pilihan)) return daftar.some((p) => tahunDari(p) === pilihan);
    return false;
  }

  const sendiri = (w.periode ?? '').trim();
  if (!sendiri) return true;

  const tPilih = tahunDari(pilihan);
  const tSendiri = tahunDari(sendiri);
  if (tPilih && tSendiri && tPilih !== tSendiri) return false;

  const bPilih = indeksBulan(pilihan);
  const bSendiri = indeksBulan(sendiri);
  if (bPilih >= 0 && bSendiri >= 0 && bPilih !== bSendiri) return false;

  return true;
}

/**
 * POTONG SUMBU PERIODE — "s.d. periode terpilih".
 *
 * Grafik yang sumbu-x-nya bulan (mis. Jan 2026 … Sep 2026) dipotong sampai
 * periode yang dipilih, inklusif: memilih "Mei 2026" menyisakan Jan–Mei.
 * Bentuknya tetap tren, bukan satu titik, sesuai pilihan pemilik aplikasi.
 *
 * Aman untuk grafik yang sumbunya BUKAN periode (nama akun, wilayah): sumbu
 * seperti itu tidak pernah dipotong. Kalau tidak ada satu pun titik yang jatuh
 * sebelum periode pilihan, grafik juga dibiarkan utuh — memotongnya akan
 * mengosongkan kartu tanpa alasan.
 */
export function potongSumbuPeriode(xAxis: string[], pilihan: string): { xAxis: string[]; dipotong: boolean } {
  const utuh = { xAxis, dipotong: false };
  if (!pilihan || pilihan === 'Semua' || xAxis.length < 2) return utuh;

  const tPilih = tahunDari(pilihan);
  const bPilih = indeksBulan(pilihan);
  if (!tPilih && bPilih < 0) return utuh;

  // Sumbu harus benar-benar berisi periode: tiap label punya bulan atau tahun.
  const berupaPeriode = xAxis.every((x) => indeksBulan(x) >= 0 || /^\d{4}$/.test(String(x).trim()));
  if (!berupaPeriode) return utuh;

  const acuanTahun = Number(tPilih) || 0;
  const peringkat = (label: string): number => {
    const t = Number(tahunDari(label)) || acuanTahun;
    const b = indeksBulan(label);
    return t * 12 + (b >= 0 ? b : 0);
  };
  // Pilihan setahun penuh ("2026") berarti sampai Desember tahun itu.
  const target = (Number(tPilih) || acuanTahun) * 12 + (bPilih >= 0 ? bPilih : 11);

  let akhir = -1;
  for (let i = 0; i < xAxis.length; i += 1) if (peringkat(xAxis[i]) <= target) akhir = i;
  if (akhir < 0) return utuh; // tidak ada titik sebelum periode pilihan
  if (akhir === xAxis.length - 1) return utuh; // semua titik sudah s.d. periode itu
  return { xAxis: xAxis.slice(0, akhir + 1), dipotong: true };
}

/**
 * Terapkan periode terpilih ke satu kartu.
 *
 * Hanya memotong sumbu grafik. Kartu ber-`periodeData` (satu indikator, banyak
 * periode) TIDAK disentuh di sini karena pemilih periode kartu itu ditangani
 * `WidgetCard` dari `periodeData[i]`, bukan dari `chart` di atas.
 */
export function terapkanPeriode(w: WidgetSpec, pilihan: string): WidgetSpec {
  if (!pilihan || pilihan === 'Semua') return w;
  if ((w.periodeData || []).length > 1) return w;
  const chart = w.chart;
  if (!chart || !Array.isArray(chart.xAxis)) return w;
  const potong = potongSumbuPeriode(chart.xAxis, pilihan);
  if (!potong.dipotong) return w;
  return {
    ...w,
    chart: {
      ...chart,
      xAxis: potong.xAxis,
      series: chart.series.map((s) => ({ ...s, data: s.data.slice(0, potong.xAxis.length) })),
    },
  };
}
