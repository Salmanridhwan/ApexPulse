import type { WidgetSpec } from '../../types';

/**
 * GRAFIK TREN PADA KARTU KPI (`sparkline` hijau).
 *
 * Kenapa ada berkas ini: kartu KPI punya grafik tren kecil di bawah angkanya. Jalur
 * katalog ("Tambah Widget") dan jalur copilot dulu bisa menghasilkan kartu KPI TANPA
 * grafik sama sekali (permintaan satu nilai tunggal ke RAG memang hanya memuat
 * value+unit), sehingga tampilannya berbeda dari pratinjau Template Chart.
 *
 * Fungsi di sini MELENGKAPI, bukan mengarang: urutan sumbernya dari yang paling
 * terikat dokumen ke yang paling longgar, dan sumbernya dicatat di `kpi.sparklineAsal`
 * supaya bisa diaudit.
 *
 *   1. `dokumen-seri`  : memakai seri angka yang SUDAH ada di widget yang sama
 *                        (mis. metrik yang sama dengan grafiknya) — angka dokumen.
 *   2. `turunan-delta` : dibentuk dari nilai akhir + delta dokumen (delta biasanya
 *                        tahunan), jadi total pertumbuhannya angka dokumen.
 *   3. `turunan-nilai` : hanya ada nilai akhir, jadi bentuknya indikatif (mendekat ke
 *                        nilai akhir). Dipakai juga oleh jalur metadata/laporan lama.
 */

const angka = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Ambil angka pertama dari teks gaya apa pun: "748,2", "82.4 %", "1.234,5", "Rp 748,2 miliar".
 * Dipakai untuk nilai KPI MAUPUN angka periode sebelumnya, supaya aturan pembacaannya satu.
 */
export function angkaDariTeks(teks: unknown): number | null {
  if (typeof teks === 'number') return Number.isFinite(teks) ? teks : null;
  const m = String(teks ?? '').match(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const bersih = m[0].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const n = Number(bersih);
  return Number.isFinite(n) ? n : null;
}

/** Nilai utama KPI (angka pertama pada `kpi.value`). */
export function nilaiKpi(widget: WidgetSpec): number | null {
  return angkaDariTeks(widget.kpi?.value);
}

export function sparklineDariData(
  widget: WidgetSpec
): { deret: number[]; sumber: NonNullable<NonNullable<WidgetSpec['kpi']>['sparklineAsal']> } | null {
  // 1. Seri dokumen yang sudah ada di widget ini.
  const seri = (widget.chart?.series ?? []).find(
    (s) => Array.isArray(s.data) && (s.data as unknown[]).filter(angka).length >= 3
  );
  if (seri) {
    const deret = (seri.data as unknown[]).filter(angka).slice(-12) as number[];
    return { deret, sumber: 'dokumen-seri' };
  }

  // Tidak ada deret di dokumen → TIDAK ada sparkline. Dulu di sini dibentuk
  // deret "indikatif" (0,94 / 0,97 / 0,99 × nilai) yang terlihat seperti tren
  // padahal hanya satu titik dokumen; delta +6,4% pada semua kartu berasal dari
  // pola itu. Sekarang grafik tren hanya muncul kalau dokumen benar-benar
  // memuat deretnya.
  return null;
}

/**
 * Persentase perubahan untuk kartu KPI ("+6,2%" seperti di Template Chart).
 * Hanya dihitung dari angka yang ADA dasarnya — tidak dikarang bila tak ada pembanding.
 * Urutannya: deret dokumen → nilai vs target dokumen → bentuk tren yang digambar.
 */
export function persenPerubahanKpi(
  widget: WidgetSpec,
  deretTurunan?: number[] | null
): { delta: number; label: string } | null {
  const bulat = (n: number) => Number(n.toFixed(1));

  // 1. Deret angka yang benar-benar ada di widget (metrik sama dengan grafiknya).
  const seri = (widget.chart?.series ?? []).find(
    (s) => Array.isArray(s.data) && (s.data as unknown[]).filter(angka).length >= 2
  );
  if (seri) {
    const d = (seri.data as unknown[]).filter(angka) as number[];
    const awal = d[0];
    const akhir = d[d.length - 1];
    if (awal !== 0) {
      const label = widget.chart?.xAxis?.[0] ? `vs ${widget.chart.xAxis[0]}` : 'vs awal periode';
      return { delta: bulat(((akhir - awal) / awal) * 100), label };
    }
  }

  // 2. Nilai akhir vs target yang disebut dokumen.
  const nilai = nilaiKpi(widget);
  const target = widget.kpi?.target;
  if (nilai !== null && angka(target) && target !== 0) {
    return { delta: bulat(((nilai - target) / target) * 100), label: `vs target ${target}` };
  }

  // Dokumen hanya memuat satu titik → tidak ada persentase perubahan. Angka
  // "tren indikatif" tidak lagi dibuat karena dasarnya deret karangan.
  return null;
}

/** Kartu KPI selalu punya grafik tren + persentase perubahan bila datanya memungkinkan. */
export function lengkapiSparklineKpi(widget: WidgetSpec): WidgetSpec {
  if (widget.type !== 'kpi' && widget.type !== 'bullet-target') return widget;
  if (!widget.kpi) return widget;
  const kpi: NonNullable<WidgetSpec['kpi']> = { ...widget.kpi };

  const ada = kpi.sparkline;
  if (!(Array.isArray(ada) && ada.filter(angka).length >= 3)) {
    const isi = sparklineDariData(widget);
    if (isi) {
      kpi.sparkline = isi.deret;
      kpi.sparklineAsal = isi.sumber;
    }
  }

  if (kpi.delta === undefined) {
    const persen = persenPerubahanKpi(widget, kpi.sparkline);
    if (persen) {
      kpi.delta = persen.delta;
      kpi.deltaLabel = kpi.deltaLabel || persen.label;
    }
  }

  return { ...widget, kpi };
}
