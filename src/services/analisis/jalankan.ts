/**
 * MENJALANKAN SATU ANALISIS DOKUMEN.
 *
 * Menyambung empat bagian: kuota, panggilan model, normalisasi butir, dan
 * penyimpanan. Dipisah dari `server.ts` supaya bisa diuji dengan penyimpanan
 * palsu dan model palsu — tanpa MySQL, tanpa jaringan, tanpa token.
 *
 * Keputusan penting:
 * - Kuota diperiksa SEBELUM memanggil model. Habis kuota bukan kegagalan:
 *   barisnya dibuat dengan status `tertunda-kuota` supaya admin tahu dokumen
 *   sudah diterima dan tinggal menunggu, bukan mengunggah ulang.
 * - Hasil model disaring ke dokumen yang diminta. Layanan RAG bisa memakai
 *   potongan dari dokumen lain di basis yang sama; butir yang sitasinya bukan
 *   dokumen ini dibuang, karena laporan instansi A tidak boleh masuk ke
 *   dashboard instansi B.
 * - Analisis yang menghasilkan nol butir tetapi punya ringkasan tetap
 *   `selesai` (dokumennya memang tanpa angka). Nol butir tanpa ringkasan
 *   dianggap `gagal`, karena kemungkinan besar model tidak membaca apa pun.
 */

import type { AnalisisDokumen, ButirData, SaranTemplate } from '../../types';
import { cocokDokumen } from '../rag/http';
import {
  KUOTA_ANALISIS_BAWAAN,
  leaseBaru,
  masihAdaKuota,
  pesanKuotaHabis,
  sisaKuota,
  statusSaatKuotaHabis,
} from './antrean';
import { SKEMA_BUTIR, instruksiButir, normalisasiButir, type Ekstraktor, type KonteksEkstraksi } from './ekstrakButir';
import { kategoriTerdeteksi, saranTemplate } from './rekomendasiKategoriTemplate';

/** Bagian penyimpanan yang dipakai — sengaja sempit supaya mudah dipalsukan. */
export interface PenyimpananAnalisis {
  createAnalisisDokumen(
    data: Omit<AnalisisDokumen, 'id' | 'dibuatPada' | 'jumlahButir' | 'kategoriTerdeteksi'> & {
      jumlahButir?: number;
      kategoriTerdeteksi?: string[];
    }
  ): AnalisisDokumen;
  updateAnalisisDokumen(id: string, tenantId: string, partial: Partial<AnalisisDokumen>): AnalisisDokumen | undefined;
  simpanButirData(daftar: ButirData[]): ButirData[];
  getAnalisisDokumen(
    tenantId: string,
    filter?: { permintaanId?: string; status?: string; berkasId?: string }
  ): AnalisisDokumen[];
  hapusButirAnalisis(analisisId: string, tenantId: string): number;
  systemConfig: { kuotaAnalisisHarian?: number };
}

export interface HasilAnalisis {
  analisis: AnalisisDokumen;
  butir: ButirData[];
  rekomendasi: SaranTemplate[];
  /** Butir mentah yang dibuang karena tidak memenuhi syarat. */
  dibuang: number;
  sisaKuota: number;
}

function awalHari(sekarang: number): number {
  const d = new Date(sekarang);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Berapa analisis RAG yang sudah dipakai instansi ini hari ini. */
export function pemakaianHariIni(
  daftar: Array<{ metode: string; dibuatPada: string; status: string }>,
  sekarang: number = Date.now()
): number {
  const mulai = awalHari(sekarang);
  return daftar.filter((a) => {
    if (a.metode !== 'rag-extract') return false;
    // Analisis yang tertunda kuota tidak dihitung: ia belum memanggil model.
    if (a.status === 'tertunda-kuota') return false;
    const t = new Date(a.dibuatPada).getTime();
    return Number.isFinite(t) && t >= mulai;
  }).length;
}

/**
 * Petakan keluaran RAG ke bentuk butir mentah.
 *
 * Layanan RAG membalas dengan kunci `kpi`, `grafik`, `tabel` — bukan `butir`.
 * Bentuknya dipetakan di sini, lalu disaring: hanya butir yang sitasinya cocok
 * dengan dokumen yang diminta yang diteruskan.
 */
export function petakanKeluaranRag(structuredJson: any, judulBerkas: string): unknown[] {
  if (!structuredJson || typeof structuredJson !== 'object') return [];
  if (Array.isArray(structuredJson.butir)) return structuredJson.butir;

  const hasil: any[] = [];
  const cocok = (nama: unknown) => (judulBerkas ? cocokDokumen(nama, judulBerkas) : true);

  for (const k of Array.isArray(structuredJson.kpi) ? structuredJson.kpi : []) {
    if (!cocok(k?.docName)) continue;
    hasil.push({
      nama: k?.label,
      nilai: k?.nilai,
      satuan: k?.satuan,
      periode: k?.periode,
      sitasi: { dokumen: k?.docName, halaman: k?.page, kutipan: k?.chunkSnippet },
      keyakinan: 'tinggi',
    });
  }

  for (const g of Array.isArray(structuredJson.grafik) ? structuredJson.grafik : []) {
    const sitasiPertama = Array.isArray(g?.data) ? g.data[0] : undefined;
    if (!cocok(sitasiPertama?.docName ?? g?.docName)) continue;
    const seri = Array.isArray(g?.series)
      ? g.series.map((s: any) => ({ nama: s?.name, data: s?.data, kategori: s?.categories ?? s?.kategori }))
      : [];
    if (seri.length === 0) continue;
    hasil.push({
      nama: g?.title,
      seri,
      sitasi: {
        dokumen: sitasiPertama?.docName ?? g?.docName,
        halaman: sitasiPertama?.page,
        kutipan: sitasiPertama?.chunkSnippet,
      },
      keyakinan: 'sedang',
    });
  }

  const t = structuredJson.tabel;
  if (t && Array.isArray(t.rows) && cocok(t.docName)) {
    hasil.push({
      nama: t?.title || 'Tabel dokumen',
      tabel: { kolom: t?.headers ?? t?.columns, baris: t.rows },
      sitasi: { dokumen: t?.docName, halaman: t?.page, kutipan: t?.chunkSnippet },
      keyakinan: 'sedang',
    });
  }

  return hasil;
}

export interface OpsiJalankan {
  penyimpanan: PenyimpananAnalisis;
  ekstraktor: Ekstraktor;
  konteks: KonteksEkstraksi;
  sekarang?: number;
  /** Paksa lewati pemeriksaan kuota (dipakai saat mengulang analisis yang tertunda). */
  abaikanKuota?: boolean;
}

/**
 * Jalankan satu analisis sampai selesai (sinkron).
 *
 * Sengaja sinkron: pemanggilnya endpoint admin yang menunggu hasil, dan analisis
 * satu dokumen biasanya di bawah satu menit. Antrean latar akan dibutuhkan saat
 * banyak dokumen diunggah sekaligus — belum sekarang.
 */
export async function jalankanAnalisis(opsi: OpsiJalankan): Promise<HasilAnalisis> {
  const { penyimpanan, ekstraktor, konteks } = opsi;
  const sekarang = opsi.sekarang ?? Date.now();
  const kuota = penyimpanan.systemConfig?.kuotaAnalisisHarian ?? KUOTA_ANALISIS_BAWAAN;

  const terpakai = pemakaianHariIni(penyimpanan.getAnalisisDokumen(konteks.tenantId), sekarang);
  const sisa = sisaKuota(terpakai, kuota);

  if (!opsi.abaikanKuota && !masihAdaKuota(terpakai, kuota)) {
    const tertunda = penyimpanan.createAnalisisDokumen({
      tenantId: konteks.tenantId,
      ...(konteks.permintaanId ? { permintaanId: konteks.permintaanId } : {}),
      berkasId: konteks.berkasId,
      judulBerkas: konteks.judulBerkas,
      status: statusSaatKuotaHabis(),
      metode: 'rag-extract',
      ringkasan: pesanKuotaHabis(kuota),
      galat: pesanKuotaHabis(kuota),
      percobaan: 0,
    });
    return { analisis: tertunda, butir: [], rekomendasi: [], dibuang: 0, sisaKuota: 0 };
  }

  // Butir lama untuk berkas yang sama dibuang lebih dulu: menganalisis ulang
  // harus MENGGANTI hasil sebelumnya, bukan menumpuknya menjadi dua set angka
  // yang berbeda untuk dokumen yang sama.
  const sebelumnya = penyimpanan.getAnalisisDokumen(konteks.tenantId, { berkasId: konteks.berkasId });
  for (const lama of sebelumnya) penyimpanan.hapusButirAnalisis(lama.id, konteks.tenantId);

  const baris = penyimpanan.createAnalisisDokumen({
    tenantId: konteks.tenantId,
    ...(konteks.permintaanId ? { permintaanId: konteks.permintaanId } : {}),
    berkasId: konteks.berkasId,
    judulBerkas: konteks.judulBerkas,
    status: 'proses',
    metode: 'rag-extract',
    percobaan: 1,
    leaseSampai: leaseBaru(sekarang),
  });

  let mentah: any;
  try {
    mentah = await ekstraktor({ prompt: instruksiButir(konteks), skema: SKEMA_BUTIR });
  } catch (err) {
    const pesan = err instanceof Error ? err.message : String(err);
    const gagal = penyimpanan.updateAnalisisDokumen(baris.id, konteks.tenantId, {
      status: 'gagal',
      galat: pesan.slice(0, 400),
      leaseSampai: undefined,
    }) as AnalisisDokumen;
    return { analisis: gagal, butir: [], rekomendasi: [], dibuang: 0, sisaKuota: sisa };
  }

  // `konteks.analisisId` dari pemanggil belum tentu ada — id baris baru inilah
  // yang mengikat butir ke analisisnya. Tanpa ini butir tersimpan dengan
  // analisisId kosong dan tidak bisa ditelusuri kembali ke dokumen asalnya.
  const bersih = normalisasiButir(mentah, { ...konteks, analisisId: baris.id });
  const butir = penyimpanan.simpanButirData(bersih.butir);
  const kategori = kategoriTerdeteksi(butir);
  const rekomendasi = saranTemplate(kategori[0] || 'Umum', butir);

  if (butir.length === 0 && !bersih.ringkasan) {
    const gagal = penyimpanan.updateAnalisisDokumen(baris.id, konteks.tenantId, {
      status: 'gagal',
      galat: 'Dokumen tidak memuat angka yang bisa dipakai. Pastikan berkasnya laporan berisi tabel atau angka, bukan gambar hasil pindai.',
      jumlahButir: 0,
      leaseSampai: undefined,
    }) as AnalisisDokumen;
    return { analisis: gagal, butir: [], rekomendasi: [], dibuang: bersih.dibuang, sisaKuota: Math.max(0, sisa - 1) };
  }

  const selesai = penyimpanan.updateAnalisisDokumen(baris.id, konteks.tenantId, {
    status: 'selesai',
    ringkasan: bersih.ringkasan,
    jumlahButir: butir.length,
    kategoriTerdeteksi: kategori,
    rekomendasiTemplate: rekomendasi,
    selesaiPada: new Date(sekarang).toISOString(),
    leaseSampai: undefined,
    galat: undefined,
  }) as AnalisisDokumen;

  return { analisis: selesai, butir, rekomendasi, dibuang: bersih.dibuang, sisaKuota: Math.max(0, sisa - 1) };
}
