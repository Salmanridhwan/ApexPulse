/**
 * SARAN PERTANYAAN ASISTEN DARI DATA INSTANSI.
 *
 * Saran lama tertulis tetap ("pertumbuhan laba bersih", "total aset") dan sering
 * memakai istilah yang tidak ada di dokumen instansi, sehingga asisten pasti
 * menjawab "tidak menemukan". Saran kini disusun dari butir data yang sudah
 * disetujui: nama butir diambil bergiliran per kategori supaya beragam, dan
 * kalimatnya menyesuaikan bentuk data.
 */
import type { ButirData } from '../../types';

type InfoSaran = Pick<ButirData, 'nama' | 'kategori' | 'periode' | 'nilai' | 'seri' | 'tabel'>;

/** Dipakai bila instansi belum punya butir disetujui. Tanpa istilah keuangan tertentu. */
export const SARAN_UMUM = [
  'Apa saja dokumen yang sudah tersedia?',
  'Apa saja indikator kinerja utama instansi ini?',
  'Ringkas isi dokumen terbaru',
];

const MAKS_PANJANG_NAMA = 48;

/** Nama layak jadi saran: tidak kosong, tidak terlalu panjang, bukan baris total nol. */
const namaLayak = (nama: string): boolean => {
  const n = nama.trim();
  return n.length >= 3 && n.length <= MAKS_PANJANG_NAMA && !/total 0\b/i.test(n);
};

export function kalimatSaran(b: InfoSaran): string {
  const nama = b.nama.trim();
  const periode = b.periode ? ` ${b.periode.trim()}` : '';
  if (Array.isArray(b.seri) && b.seri.length > 0) return `Bagaimana tren ${nama}?`;
  if (b.nilai !== undefined && b.nilai !== null) return `Berapa ${nama}${periode}?`;
  if (b.tabel) return `Tampilkan rincian ${nama}`;
  return `Jelaskan ${nama}`;
}

export function saranPertanyaan(butir: InfoSaran[], maks = 4): string[] {
  const perKategori = new Map<string, InfoSaran[]>();
  const sudahNama = new Set<string>();
  for (const b of butir) {
    if (!b || !namaLayak(String(b.nama || ''))) continue;
    const kunciNama = b.nama.trim().toLowerCase();
    if (sudahNama.has(kunciNama)) continue;
    sudahNama.add(kunciNama);
    const k = String(b.kategori || 'Umum');
    if (!perKategori.has(k)) perKategori.set(k, []);
    perKategori.get(k)!.push(b);
  }
  if (perKategori.size === 0) return [...SARAN_UMUM];

  // Bergiliran per kategori supaya saran tidak semuanya dari satu topik.
  const antrean = [...perKategori.values()];
  const hasil: string[] = [];
  for (let i = 0; hasil.length < maks; i += 1) {
    let adaSisa = false;
    for (const daftar of antrean) {
      if (i < daftar.length) {
        adaSisa = true;
        const kalimat = kalimatSaran(daftar[i]);
        if (!hasil.includes(kalimat)) hasil.push(kalimat);
        if (hasil.length >= maks) break;
      }
    }
    if (!adaSisa) break;
  }
  return hasil;
}
