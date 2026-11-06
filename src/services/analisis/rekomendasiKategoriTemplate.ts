/**
 * REKOMENDASI TEMPLATE & SUSUNAN HALAMAN — deterministik, nol token.
 *
 * Kenapa tidak memakai model bahasa: rekomendasi yang berubah tiap kali halaman
 * dimuat akan membingungkan admin ("tadi Pijar, sekarang Kaca"). Semua di sini
 * hanya pencocokan kata kunci terhadap `fokus` template yang sudah ada, jadi
 * hasilnya sama setiap kali dan bisa diuji tanpa memanggil layanan RAG.
 *
 * Yang TIDAK dilakukan berkas ini: mengarang angka, memilih dokumen, atau
 * memutuskan butir mana yang benar. Itu tugas ekstraksi (Fase 2 bagian RAG) dan
 * keputusan admin.
 */

import type { ButirData, KeyakinanButir, SaranTemplate } from '../../types';
import { DASHBOARD_TEMPLATES } from '../templates/dashboardTemplates';

/** Kata yang tidak membedakan satu template dari yang lain. */
const KATA_ABAIKAN = new Set([
  'dan',
  'atau',
  'per',
  'di',
  'ke',
  'dari',
  'yang',
  'untuk',
  'pada',
  'dengan',
  'serta',
  'jumlah',
  'total',
  'nilai',
  'data',
  'tahun',
  'bulan',
  'bulanan',
  'tahunan',
  'unit',
  'rp',
  'juta',
  'miliar',
  'ribu',
]);

/** Pecah teks menjadi kata kunci bermakna (huruf kecil, tanpa tanda baca). */
export function kataKunci(teks: unknown): string[] {
  const bersih = String(teks ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((k) => k.length >= 3 && !KATA_ABAIKAN.has(k));
  return Array.from(new Set(bersih));
}

/** Semua teks yang mewakili satu butir, untuk dicocokkan dengan fokus template. */
function teksButir(butir: ButirData): string {
  return [butir.nama, butir.kategori, butir.periode, butir.satuan, ...(butir.seri || []).map((s) => s.nama)]
    .filter(Boolean)
    .join(' ');
}

interface NilaiTemplate {
  templateId: string;
  nama: string;
  skor: number;
  fokusCocok: string[];
}

/**
 * Skor satu template terhadap kumpulan kata butir.
 *
 * Skor = (kata fokus yang muncul ÷ total kata fokus) + bonus kategori.
 * Bonus kecil diberikan bila kategori butir disebut di fokus/deskripsi, supaya
 * "Keuangan" tidak kalah oleh template yang kebetulan memuat satu kata umum.
 */
function nilaiSatuTemplate(
  tpl: (typeof DASHBOARD_TEMPLATES)[number],
  kataButir: Set<string>,
  kategori: string
): NilaiTemplate {
  const semuaKataFokus: string[] = [];
  const fokusCocok: string[] = [];
  for (const fokus of tpl.fokus) {
    const kata = kataKunci(fokus);
    semuaKataFokus.push(...kata);
    if (kata.some((k) => kataButir.has(k))) fokusCocok.push(fokus);
  }
  const unikFokus = Array.from(new Set(semuaKataFokus));
  const cocok = unikFokus.filter((k) => kataButir.has(k)).length;
  const dasar = unikFokus.length > 0 ? cocok / unikFokus.length : 0;

  const teksTemplate = kataKunci(`${tpl.fokus.join(' ')} ${tpl.deskripsi} ${tpl.nama}`);
  const bonusKategori =
    kategori && teksTemplate.includes(kategori.toLowerCase()) ? 0.15 : 0;

  return {
    templateId: tpl.id,
    nama: tpl.nama,
    skor: Math.min(1, Number((dasar + bonusKategori).toFixed(3))),
    fokusCocok,
  };
}

/** Dua template umum saat tidak ada satu pun kata yang cocok. */
function saranUmum(): SaranTemplate[] {
  const pilihan = ['tpl-ringkasan', 'tpl-analitik'];
  const alasan = 'paling umum untuk ringkasan pimpinan';
  return pilihan
    .map((id) => DASHBOARD_TEMPLATES.find((t) => t.id === id))
    .filter((t): t is (typeof DASHBOARD_TEMPLATES)[number] => Boolean(t))
    .map((t) => ({ templateId: t.id, nama: t.nama, skor: 0.2, alasan }));
}

/** Ambang di bawah ini dianggap "tidak ada yang benar-benar cocok". */
const AMBANG_COCOK = 0.15;

/**
 * Dua template teratas untuk sekumpulan butir dalam satu kategori.
 *
 * Urutan stabil: skor tertinggi dulu, dan bila skor sama, urutan daftar template
 * yang dipakai (bukan urutan acak objek), supaya hasilnya bisa diuji.
 */
export function saranTemplate(kategori: string, butir: ButirData[]): SaranTemplate[] {
  const kategoriBersih = String(kategori || 'Umum').trim() || 'Umum';
  const kataButir = new Set<string>();
  for (const b of butir) for (const k of kataKunci(teksButir(b))) kataButir.add(k);
  for (const k of kataKunci(kategoriBersih)) kataButir.add(k);

  const nilai = DASHBOARD_TEMPLATES.map((tpl) => nilaiSatuTemplate(tpl, kataButir, kategoriBersih));
  const urut = nilai
    .map((n, i) => ({ ...n, i }))
    .sort((a, b) => (b.skor !== a.skor ? b.skor - a.skor : a.i - b.i));

  const teratas = urut.filter((n) => n.skor >= AMBANG_COCOK).slice(0, 2);

  const hasil: SaranTemplate[] = teratas.map((n) => ({
    templateId: n.templateId,
    nama: n.nama,
    skor: n.skor,
    alasan:
      n.fokusCocok.length > 0
        ? `cocok untuk ${n.fokusCocok.slice(0, 2).join(' dan ').toLowerCase()}`
        : `paling dekat dengan kategori ${kategoriBersih}`,
  }));

  // Admin harus selalu punya dua pilihan. Bila hanya satu template yang benar-
  // benar cocok (atau tidak ada), sisanya diisi saran umum — bukan dibiarkan
  // satu, karena satu pilihan terasa seperti paksaan.
  for (const cadangan of saranUmum()) {
    if (hasil.length >= 2) break;
    if (hasil.some((h) => h.templateId === cadangan.templateId)) continue;
    hasil.push(cadangan);
  }
  return hasil.slice(0, 2);
}

/**
 * Kategori yang benar-benar muncul pada butir, urut dari yang terbanyak.
 * Butir tanpa kategori dihitung sebagai "Umum" — sama seperti `kategoriWidget`.
 */
export function kategoriTerdeteksi(butir: ButirData[]): string[] {
  const hitung = new Map<string, number>();
  for (const b of butir) {
    const k = String(b.kategori || '').trim() || 'Umum';
    hitung.set(k, (hitung.get(k) || 0) + 1);
  }
  return Array.from(hitung.entries())
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0])))
    .map(([k]) => k);
}

export type PeranButir = 'utama' | 'tren' | 'komposisi' | 'tabel';

/**
 * Peran tiap butir bila disusun menjadi satu halaman.
 *
 * Aturan tetap, bukan selera model:
 * - ada tabel → peran tabel (satu saja, yang barisnya paling banyak);
 * - deret waktu (>= 5 titik) → tren;
 * - deret pendek atau berlabel kategori → komposisi;
 * - angka tunggal → utama.
 *
 * Kartu "utama" didahulukan untuk kategori Keuangan karena itulah yang pertama
 * dicari pimpinan saat membuka halaman.
 */
export function saranSusunanHalaman(butir: ButirData[]): Array<{ butirId: string; peran: PeranButir }> {
  const hasil: Array<{ butirId: string; peran: PeranButir; urutan: number; kategori: string }> = [];
  let sudahAdaTabel = false;

  // Tabel dipilih lebih dulu: yang barisnya paling banyak dianggap paling lengkap.
  const kandidatTabel = butir
    .filter((b) => b.tabel && b.tabel.baris.length > 0)
    .sort((a, b) => (b.tabel!.baris.length || 0) - (a.tabel!.baris.length || 0));

  for (const b of butir) {
    if (b.tabel && b.tabel.baris.length > 0) {
      if (!sudahAdaTabel && kandidatTabel[0]?.id === b.id) {
        hasil.push({ butirId: b.id, peran: 'tabel', urutan: 3, kategori: b.kategori });
        sudahAdaTabel = true;
      }
      continue;
    }
    const seri = b.seri?.[0];
    if (seri && Array.isArray(seri.data)) {
      if (seri.data.length >= 5) {
        hasil.push({ butirId: b.id, peran: 'tren', urutan: 1, kategori: b.kategori });
      } else if (seri.data.length > 1 || (seri.kategori && seri.kategori.length > 0)) {
        hasil.push({ butirId: b.id, peran: 'komposisi', urutan: 2, kategori: b.kategori });
      } else {
        hasil.push({ butirId: b.id, peran: 'utama', urutan: 0, kategori: b.kategori });
      }
      continue;
    }
    hasil.push({ butirId: b.id, peran: 'utama', urutan: 0, kategori: b.kategori });
  }

  return hasil
    .sort((a, b) => {
      if (a.urutan !== b.urutan) return a.urutan - b.urutan;
      const aKeu = String(a.kategori).toLowerCase() === 'keuangan' ? 0 : 1;
      const bKeu = String(b.kategori).toLowerCase() === 'keuangan' ? 0 : 1;
      return aKeu - bKeu;
    })
    .slice(0, 9)
    .map(({ butirId, peran }) => ({ butirId, peran }));
}

/**
 * Status awal sebuah butir.
 *
 * Butir hanya boleh langsung `disetujui` bila keyakinannya tinggi DAN sitasinya
 * menyebut dokumen. Tanpa sitasi, angka yang terlihat masuk akal tetap `draf` —
 * admin yang memutuskan.
 */
export function statusButirAwal(
  keyakinan: KeyakinanButir,
  sitasi?: { dokumen?: string } | null
): 'disetujui' | 'draf' {
  const adaDokumen = Boolean(String(sitasi?.dokumen || '').trim());
  return keyakinan === 'tinggi' && adaDokumen ? 'disetujui' : 'draf';
}

/** Ringkasan satu baris untuk kartu analisis di kotak masuk admin. */
export function ringkasAnalisis(analisis: {
  jumlahButir: number;
  kategoriTerdeteksi: string[];
  status: string;
}): string {
  const bagian: string[] = [`${analisis.jumlahButir} butir`];
  if (analisis.kategoriTerdeteksi.length > 0) {
    bagian.push(analisis.kategoriTerdeteksi.slice(0, 3).join(', '));
  }
  if (analisis.status === 'tertunda-kuota') bagian.push('menunggu kuota besok');
  else if (analisis.status === 'gagal') bagian.push('gagal dibaca');
  return bagian.join(' · ');
}
