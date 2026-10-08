import type { CatalogPreset, WidgetSpec, WidgetType } from '../../types';

/**
 * SUSUN WIDGET DARI PRESET — satu tempat untuk katalog "Tambah Widget" DAN kartu
 * rekomendasi di panel Chat. Dulu logikanya hanya ada di `CatalogModal`, sehingga
 * kartu rekomendasi chat tidak bisa menyematkan apa pun dan mengirim prompt lagi
 * ke LLM (lambat + tidak pasti).
 *
 * Yang TIDAK boleh berubah: angkanya selalu dari dokumen (`/api/widgets/ambil-data`).
 * Fungsi ini tidak pernah mengarang angka; kalau dokumen tidak memuat indikatornya,
 * pemanggil mendapat `error` dan tidak menambahkan apa pun.
 */

/** Bangun WidgetSpec dari preset + respons dokumen. Judul memakai metrik yang benar-benar diambil. */
export const widgetDariPreset = (
  preset: CatalogPreset,
  tipe: WidgetType,
  sumber: Partial<WidgetSpec> & { citations?: WidgetSpec['citations'] }
): WidgetSpec => ({
  id: `w-preset-${preset.id}-${Date.now()}`,
  presetId: preset.id,
  type: (sumber.type as WidgetType) || tipe,
  // Judul dari dokumen (nama metrik nyata); preset yang dipakai dicatat di subjudul supaya
  // tidak ada widget berlabel indikator lain padahal isinya metrik berbeda.
  title: sumber.title || preset.nama,
  subtitle: `${preset.id} · ${preset.nama}`,
  category: preset.kategori,
  confidence: 'sumber',
  grid: { x: 0, y: 0, w: preset.defaultLayout.w, h: preset.defaultLayout.h },
  kpi: sumber.kpi,
  chart: sumber.chart,
  table: sumber.table,
  narasi: sumber.narasi,
  citations: sumber.citations || [],
  unitKerja: sumber.unitKerja,
  periode: sumber.periode,
  lastUpdated: new Date().toISOString(),
});

/** Ambil angka dari dokumen untuk preset+tipe, lalu susun widget. Jalur yang sama dengan katalog.
 *
 * `tenantId` WAJIB dikirim: tanpanya server memakai instansi SESI, sehingga memilih
 * instansi lain di dropdown tetap mengambil angka dari instansi sesi (sumber "ngawur").
 */
export const ambilWidgetPreset = async (
  preset: CatalogPreset,
  tipe: WidgetType,
  sector: string,
  tenantId?: string
): Promise<{ widget?: WidgetSpec; error?: string }> => {
  try {
    const res = await fetch('/api/widgets/ambil-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: preset.queryRagContoh,
        tipe,
        sector,
        presetId: preset.id,
        ...(tenantId ? { tenantId } : {}),
      }),
    });
    const isi = await res.json().catch(() => null);
    if (!res.ok || !isi?.widget) {
      return { error: isi?.error || isi?.alasan || 'Dokumen instansi ini tidak memuat indikator tersebut.' };
    }
    return { widget: widgetDariPreset(preset, tipe, isi.widget) };
  } catch {
    return { error: 'Tidak bisa menghubungi server.' };
  }
};
