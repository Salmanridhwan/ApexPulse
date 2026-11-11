import type { ButirData } from '../../types';
import { angkaRingkas } from '../format/angkaRingkas';

/**
 * NAMA BUTIR DARI ISI DATANYA.
 *
 * Kolom spreadsheet yang tidak punya judul diberi nama seperti
 * "LOP RKA JATIM · kolom D" atau "Rinci Perbulan PLK · Kolom G". Huruf kolom
 * itu tidak menjelaskan apa pun kepada pembaca. Fungsi ini menggantinya dengan
 * keterangan dari angkanya sendiri: jenis angkanya (nilai, jumlah, persentase)
 * dan totalnya, misalnya "LOP RKA JATIM · Nilai, total 3,97 M".
 *
 * Dipanggil saat daftar dibaca, SETELAH penggabungan lintas dokumen. Huruf
 * kolom tetap dipakai sebagai identitas penggabungan di langkah sebelumnya,
 * dan data yang tersimpan tidak diubah.
 */

/** "· kolom D", "· Kolom G", atau nama yang hanya "Kolom F": judul kolomnya tidak ada. */
const POLA_TANPA_JUDUL = /(^|\s*·\s*)kolom\s+[A-Z]{1,3}\b/i;
/** "(kol Q)": judulnya ada, huruf hanya ditempel supaya namanya tidak kembar. */
const POLA_PEMBEDA = /\s*\(kol(?:om)?\s+[A-Z]{1,3}\)/i;
/** Nama deret yang hanya huruf kolom. */
const POLA_SERI_KOLOM = /^kolom\s+[A-Z]{1,3}$/i;

function semuaAngka(b: ButirData): number[] {
  const hasil: number[] = [];
  for (const s of b.seri || []) for (const v of s.data || []) if (Number.isFinite(Number(v))) hasil.push(Number(v));
  if (hasil.length === 0 && b.nilai !== undefined && b.nilai !== null && Number.isFinite(Number(b.nilai))) {
    hasil.push(Number(b.nilai));
  }
  return hasil;
}

/** Jenis angka menurut isinya. */
export function jenisAngka(b: ButirData): string {
  const angka = semuaAngka(b);
  if (/%|persen/i.test(String(b.satuan || ''))) return 'Persentase';
  if (/jumlah per bulan/i.test(String(b.nama || ''))) return 'Jumlah';
  if (angka.length === 0) return 'Angka';
  const maks = Math.max(...angka.map(Math.abs));
  const bulat = angka.every((v) => Number.isInteger(v));
  if (!bulat && maks <= 1) return 'Rasio';
  if (maks >= 100_000) return 'Nilai';
  if (bulat) return 'Jumlah';
  return 'Angka';
}

/**
 * Total seluruh angka butir (semua periode), diringkas. Deret satu periode
 * bisa nol semua, jadi yang dijumlah seluruh deretnya.
 */
function teksTotal(b: ButirData): string {
  const angka = semuaAngka(b);
  if (angka.length === 0) return '';
  const total = angka.reduce((a, v) => a + v, 0);
  if (!Number.isFinite(total)) return '';
  const periode = (b.seri?.length ?? 0) > 1 ? ` (${b.seri!.length} periode)` : '';
  return `total ${angkaRingkas(total, 2)}${periode}`;
}

function keteranganIsi(b: ButirData, dasar: string): string {
  const jenis = jenisAngka(b);
  const total = teksTotal(b);
  // "Nilai Tagihan · Nilai, …" berulang: jenis dilewati bila nama sudah memuatnya.
  const sebutJenis = !new RegExp(`\\b${jenis}\\b`, 'i').test(dasar);
  return [sebutJenis ? jenis : '', total].filter(Boolean).join(', ') || jenis;
}

export function namaiDariIsi(daftar: ButirData[]): ButirData[] {
  // Nama hanya perlu unik di dalam satu dokumen. Kembaran antardokumen
  // dibedakan dengan nama dokumennya oleh langkah sesudahnya.
  const dok = (b: ButirData) => String(b.sitasi?.dokumen || '').toLowerCase();
  const terpakai = new Set<string>();
  const perluGanti = (b: ButirData) => POLA_TANPA_JUDUL.test(b.nama || '') || POLA_PEMBEDA.test(b.nama || '');
  for (const b of daftar) if (!perluGanti(b)) terpakai.add(`${dok(b)}|${String(b.nama || '').toLowerCase()}`);

  return daftar.map((b) => {
    const seriRapi = (b.seri || []).map((s) =>
      POLA_SERI_KOLOM.test(String(s.nama || '').trim()) ? { ...s, nama: jenisAngka(b) } : s
    );
    const seriBerubah = seriRapi.some((s, i) => s !== b.seri![i]);
    if (!perluGanti(b)) return seriBerubah ? { ...b, seri: seriRapi } : b;

    const asli = String(b.nama || '');
    const tanpaJudul = POLA_TANPA_JUDUL.test(asli);
    const dasar = asli
      .replace(new RegExp(POLA_TANPA_JUDUL.source, 'gi'), '')
      .replace(new RegExp(POLA_PEMBEDA.source, 'gi'), '')
      .replace(/^[\s·]+|[\s·]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const kunci = (n: string) => `${dok(b)}|${n.toLowerCase()}`;

    let nama: string;
    if (!tanpaJudul && dasar && !terpakai.has(kunci(dasar))) {
      // Judulnya ada dan tidak kembar lagi: cukup buang huruf kolomnya.
      nama = dasar;
    } else {
      const isi = keteranganIsi(b, dasar);
      nama = dasar ? `${dasar} · ${isi}` : isi;
    }
    let akhir = nama;
    for (let n = 2; terpakai.has(kunci(akhir)); n += 1) akhir = `${nama} (${n})`;
    terpakai.add(kunci(akhir));
    return { ...b, nama: akhir, ...(seriBerubah ? { seri: seriRapi } : {}) };
  });
}
