/**
 * Pembersih teks keluaran model untuk label yang dirender ke UI.
 *
 * Model kadang menyelipkan karakter di luar Latin (contoh nyata: label KPI
 * "Rasio air hilang网络 (NRW)" — kata Tionghoa "网络" muncul di tengah label
 * Indonesia). Label yang tercampur aksara asing terlihat rusak di dashboard,
 * jadi aksara non-Latin dan karakter kontrol dibuang sebelum widget disimpan.
 */

/** CJK + bentuk lebar penuh (fullwidth) + tanda baca CJK + kontrol. */
const KARAKTER_ASING =
  /[\u2E80-\u9FFF\uF900-\uFAFF\uFE10-\uFE4F\uFF00-\uFFEF\u3000-\u303F\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Kolom yang berisi kutipan asli dokumen — JANGAN diubah isinya. */
const KUNCI_DILEWATI = new Set(['chunkSnippet', 'docName', 'citations', 'sourceUrl']);

/** Bersihkan satu string label. */
export function bersihkanLabel(teks: string): string {
  return teks
    .replace(KARAKTER_ASING, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.:;%)}\]])/g, '$1')
    .replace(/([(\[{])\s+/g, '$1')
    .trim();
}

/**
 * Bersihkan seluruh string di dalam payload keluaran model, kecuali kolom
 * kutipan (`chunkSnippet`, `docName`, `citations`) yang harus tetap apa adanya.
 */
export function bersihkanPayload<T>(nilai: T): T {
  if (typeof nilai === 'string') return bersihkanLabel(nilai) as unknown as T;
  if (Array.isArray(nilai)) return nilai.map((x) => bersihkanPayload(x)) as unknown as T;
  if (nilai && typeof nilai === 'object') {
    const keluar: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(nilai as Record<string, unknown>)) {
      keluar[k] = KUNCI_DILEWATI.has(k) ? v : bersihkanPayload(v);
    }
    return keluar as T;
  }
  return nilai;
}
