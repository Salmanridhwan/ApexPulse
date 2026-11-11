/**
 * ATURAN PEMBUATAN DASHBOARD.
 *
 * Dashboard baru yang lahir dari data (Pilih Data, Rekomendasi AI) wajib:
 * 1. berisi minimal satu chart (jumlahnya bebas; aturan minimal 3 chart
 *    dihapus atas permintaan pemilik aplikasi 2026-11-11), dan
 * 2. semua chartnya saling berhubungan.
 *
 * "Berhubungan" sengaja longgar: dua chart terhubung bila sama dokumen sumber,
 * sama kategori, punya periode yang beririsan, atau berbagi kata kunci nama.
 * Hubungan boleh berantai (A-B lewat dokumen, B-C lewat periode), yang penting
 * semua chart jatuh ke SATU kelompok. Chart di luar kelompok terbesar disebut
 * tidak terkait.
 *
 * Dashboard kosong dari tombol "Dashboard Baru" tidak terkena aturan ini.
 */
import type { ButirData } from '../../types';

type InfoButir = Pick<ButirData, 'id' | 'nama' | 'kategori' | 'periode' | 'periodeTersedia' | 'sitasi'>;

/** Kata umum yang tidak menandakan topik yang sama. */
const KATA_UMUM = new Set([
  'data', 'total', 'jumlah', 'nilai', 'tahun', 'bulan', 'periode', 'tanggal', 'kolom',
  'dan', 'atau', 'yang', 'untuk', 'dari', 'per', 'tim', 'bagian', 'lainnya', 'nama', 'kode',
]);

/** Kata kunci nama: huruf kecil, minimal 4 huruf, tanpa angka dan kata umum. */
export function kataKunci(nama: string): Set<string> {
  return new Set(
    String(nama || '')
      .toLowerCase()
      .split(/[^a-zÀ-ɏ]+/)
      .filter((k) => k.length >= 4 && !KATA_UMUM.has(k))
  );
}

const periodeDari = (b: InfoButir): Set<string> =>
  new Set([b.periode, ...(b.periodeTersedia ?? [])].map((p) => String(p || '').trim().toLowerCase()).filter(Boolean));

const dokumenDari = (b: InfoButir): string => String(b.sitasi?.dokumen || '').trim().toLowerCase();

/** Dua butir berhubungan bila berbagi salah satu ciri. Butir yang sama selalu berhubungan. */
export function berhubungan(a: InfoButir, b: InfoButir): boolean {
  if (a.id === b.id) return true;
  const da = dokumenDari(a);
  if (da && da === dokumenDari(b)) return true;
  const ka = String(a.kategori || '').trim().toLowerCase();
  if (ka && ka === String(b.kategori || '').trim().toLowerCase()) return true;
  const pb = periodeDari(b);
  for (const p of periodeDari(a)) if (pb.has(p)) return true;
  const kb = kataKunci(b.nama);
  for (const k of kataKunci(a.nama)) if (kb.has(k)) return true;
  return false;
}

export interface HasilAturan {
  boleh: boolean;
  jumlah: number;
  /** Butir (unik) yang tidak tersambung ke kelompok utama. */
  tidakTerkait: InfoButir[];
  /** Kalimat siap tampil; kosong bila aturan terpenuhi. */
  pesan: string;
}

/**
 * Periksa daftar chart (satu entri per kartu, butir boleh berulang bila
 * ditampilkan dengan dua bentuk berbeda).
 */
export function cekAturanDashboard(kartu: InfoButir[]): HasilAturan {
  const jumlah = kartu.length;

  // Kelompok keterkaitan antar butir unik (union-find sederhana).
  const unik = [...new Map(kartu.map((b) => [b.id, b])).values()];
  const induk = unik.map((_, i) => i);
  const akar = (i: number): number => (induk[i] === i ? i : (induk[i] = akar(induk[i])));
  for (let i = 0; i < unik.length; i += 1)
    for (let j = i + 1; j < unik.length; j += 1)
      if (berhubungan(unik[i], unik[j])) induk[akar(i)] = akar(j);
  const ukuran = new Map<number, number>();
  unik.forEach((_, i) => ukuran.set(akar(i), (ukuran.get(akar(i)) ?? 0) + 1));
  const utama = [...ukuran.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const tidakTerkait = unik.filter((_, i) => akar(i) !== utama);

  const bagian: string[] = [];
  if (jumlah === 0) bagian.push('Tambahkan minimal satu chart.');
  if (tidakTerkait.length > 0)
    bagian.push(`Chart tidak berhubungan dengan chart lain: ${tidakTerkait.map((b) => b.nama).join(', ')}.`);
  return { boleh: bagian.length === 0, jumlah, tidakTerkait, pesan: bagian.join(' ') };
}
