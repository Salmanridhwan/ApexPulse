import { BumdSector, KetersediaanPreset, Tenant } from '../../types';
import { WIDGET_CATALOG } from '../builder/catalog';
import { selaraskanTipe } from '../spec/tipeSelaras';

/**
 * Pemeriksa ketersediaan preset katalog untuk SATU instansi.
 *
 * Katalog "Tambah Widget" tidak boleh menawarkan preset yang mustahil diisi.
 * Sumber kebenarannya adalah panggilan yang SAMA dengan tombol Tambah
 * (`ambilDataWidget` memakai KB instansi), lalu hasilnya di-cache per
 * (tenant, KB, preset) supaya tidak diulang setiap katalog dibuka.
 *
 * Pemeriksaan berat (58 preset x 1-2 panggilan LLM), jadi: dijalankan di latar,
 * concurrency dibatasi, hasil disimpan per batch, dan payload widget yang lolos
 * ikut disimpan agar tombol Tambah jadi instan serta angkanya identik.
 */

/** TTL catatan supaya dokumen yang bertambah tetap terperiksa ulang. */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Catatan "tidak diketahui" (pemeriksaan gagal karena layanan RAG bermasalah)
 * hanya berlaku sebentar — jangan sampai galat sesaat menyembunyikan preset
 * selama berhari-hari.
 */
const TTL_TIDAK_DIKETAHUI_MS = 2 * 60 * 1000;

/** Berhenti memeriksa setelah sekian kegagalan berturut-turut (layanan tumbang). */
const BATAS_GAGAL_BERTURUT = 3;

/** Jeda sebelum mencoba lagi setelah pemeriksaan dihentikan karena galat. */
const JEDA_SETELAH_GAGAL_MS = 30 * 1000;

/** Seberapa banyak preset diperiksa serentak (jaga beban layanan RAG). */
const CONCURRENCY = 3;

/**
 * Jumlah pasangan (preset × tipe) yang diperiksa — satu preset menghasilkan satu
 * catatan per tipe yang ditawarkan katalog.
 */
const JUMLAH_PASANGAN = WIDGET_CATALOG.reduce(
  (n, p) => n + (p.tipeChart?.length ? p.tipeChart.length : 1),
  0
);

export interface RagPengambil {
  ambilDataWidget: (
    query: string,
    sector: BumdSector,
    tipe: string,
    instansi?: string,
    kbId?: string,
    opsi?: { lemparSaatGagal?: boolean }
  ) => Promise<{ data: any | null; judul?: string; deskripsi?: string; alasan?: string } | null>;
}

export interface PenyimpananKetersediaan {
  ketersediaanUntuk: (tenantId: string, kbId: string) => KetersediaanPreset[];
  simpanKetersediaan: (catatan: KetersediaanPreset) => void;
  persist: () => void;
}

export interface OpsiPemeriksa {
  ragClient: RagPengambil;
  db: PenyimpananKetersediaan;
  /** Provider RAG aktif; selain 'http' ketersediaan per dokumen tidak bisa dinilai. */
  ambilProvider: () => string;
}

/** Ringkasan satu preset untuk frontend (tanpa payload, cukup untuk kartu). */
export interface KetersediaanRingkas {
  presetId: string;
  tipe: string;
  tersedia: boolean;
  /** true bila pemeriksaan tidak bisa disimpulkan (layanan RAG bermasalah). */
  tidakDiketahui?: boolean;
  alasan?: string;
  judul?: string;
  checkedAt: string;
}

export interface HasilRingkas {
  kbId: string;
  /** true bila ketersediaan tidak bisa dinilai (RAG bukan http) → jangan saring. */
  tanpaPenyaringan: boolean;
  /** true bila instansi belum punya knowledge base sama sekali. */
  tanpaKb: boolean;
  total: number;
  selesai: number;
  /** Berapa preset yang pemeriksaannya gagal karena layanan RAG bermasalah. */
  gagalDiperiksa: number;
  memeriksa: boolean;
  items: KetersediaanRingkas[];
}

const kunci = (tenantId: string, presetId: string, tipe: string) => `${tenantId}|${presetId}|${tipe}`;

export function buatPemeriksaKetersediaan({ ragClient, db, ambilProvider }: OpsiPemeriksa) {
  /** tenantId -> progres pemeriksaan yang sedang jalan. */
  const berjalan = new Map<string, { mulai: number; selesai: number; total: number }>();
  /** tenantId -> waktu (ms) sebelum pemeriksaan boleh dicoba lagi. */
  const jedaSampai = new Map<string, number>();

  /**
   * Catatan masih berlaku? Yang "tidak diketahui" hanya sebentar, karena
   * penyebabnya biasanya layanan RAG yang sedang bermasalah.
   */
  const masihBerlaku = (k: KetersediaanPreset): boolean => {
    const umur = Date.now() - Date.parse(k.checkedAt);
    if (!Number.isFinite(umur)) return false;
    return umur < (k.tidakDiketahui ? TTL_TIDAK_DIKETAHUI_MS : TTL_MS);
  };

  /**
   * Fokus dasar yang selalu bisa dipenuhi pembuat widget untuk preset ini.
   * Semua tipe chart lain diambil dari payload grafik yang sama.
   */
  function tipeDasar(preset: { tipeChart?: string[] }): string {
    const t = String(preset.tipeChart?.[0] || 'kpi');
    if (['kpi', 'bullet-target', 'gauge'].includes(t)) return 'kpi';
    if (t === 'table') return 'table';
    if (t === 'narasi') return 'narasi';
    return 'bar';
  }

  /**
   * Periksa SATU preset: ambil datanya sekali, lalu nilai setiap tipe yang
   * ditawarkan katalog untuk preset itu dengan penyelaras tipe yang sama dengan
   * jalur Tambah. Jadi chip di katalog tidak pernah menjanjikan bentuk yang
   * tidak bisa dibuat, dan kartu di kanvas sama dengan pratinjaunya.
   */
  async function periksaPreset(
    tenant: Tenant,
    kbId: string,
    presetId: string
  ): Promise<KetersediaanPreset[]> {
    const preset = WIDGET_CATALOG.find((p) => p.id === presetId);
    const daftarTipe = preset?.tipeChart?.length ? preset.tipeChart : ['kpi'];
    const dasar = (tipe: string): KetersediaanPreset => ({
      id: kunci(tenant.id, presetId, tipe),
      tenantId: tenant.id,
      kbId,
      presetId,
      tipe: (tipe as KetersediaanPreset['tipe']) || 'kpi',
      tersedia: false,
      checkedAt: new Date().toISOString(),
    });
    if (!preset) return daftarTipe.map((t) => ({ ...dasar(t), alasan: 'Preset tidak dikenal.' }));

    // lemparSaatGagal: supaya "layanan RAG bermasalah" TIDAK dilaporkan sebagai
    // "dokumen tidak memuat" — dua hal berbeda, dan yang kedua menyembunyikan preset.
    // Percobaan ulang sekali: galat gerbang (502) sering lolos di percobaan kedua,
    // jadi jangan langsung menyimpulkan "tidak bisa dipastikan".
    let galatTerakhir: any = null;
    for (let percobaan = 1; percobaan <= 2; percobaan++) {
      try {
        const hasil = await ragClient.ambilDataWidget(
          preset.queryRagContoh,
          tenant.sector,
          tipeDasar(preset),
          tenant.name,
          kbId,
          { lemparSaatGagal: true }
        );
        if (!hasil || !hasil.data) {
          const alasan =
            hasil?.alasan || 'Dokumen instansi ini tidak memuat indikator tersebut.';
          return daftarTipe.map((t) => ({ ...dasar(t), alasan }));
        }
        return daftarTipe.map((t) => {
          const selaras = selaraskanTipe(hasil.data, t);
          if (selaras.ok && selaras.widget) {
            return {
              ...dasar(t),
              tersedia: true,
              widget: selaras.widget,
              judul: hasil.judul,
              deskripsi: hasil.deskripsi,
            };
          }
          return { ...dasar(t), alasan: selaras.alasan || `Tipe ${t} tidak bisa dibuat dari data dokumen ini.` };
        });
      } catch (err: any) {
        galatTerakhir = err;
        if (percobaan === 1) await new Promise((r) => setTimeout(r, 1500));
      }
    }
    return daftarTipe.map((t) => ({
      ...dasar(t),
      tidakDiketahui: true,
      alasan: `Pemeriksaan belum bisa disimpulkan: ${galatTerakhir?.message || 'kesalahan tak terduga'}`,
    }));
  }

  /**
   * Preset yang belum punya catatan berlaku untuk instansi + KB ini.
   * Catatan "tidak diketahui" (pemeriksaan gagal) cepat kedaluwarsa supaya galat
   * sesaat tidak menyembunyikan preset berhari-hari.
   */
  function belumDiperiksa(tenantId: string, kbId: string) {
    const catatan = db.ketersediaanUntuk(tenantId, kbId);
    const adaYangBaru = new Set(catatan.filter(masihBerlaku).map((k) => `${k.presetId}|${k.tipe}`));
    // Satu preset dianggap belum diperiksa hanya kalau SEMUA tipe yang ditawarkan
    // belum punya catatan (pemeriksaan per preset menghasilkan catatan per tipe).
    return WIDGET_CATALOG.filter((p) => {
      const daftar = p.tipeChart?.length ? p.tipeChart : ['kpi'];
      return !daftar.some((t) => adaYangBaru.has(`${p.id}|${t}`));
    });
  }

  /**
   * Pastikan pemeriksaan latar berjalan untuk instansi ini. Aman dipanggil
   * berulang (dipakai polling frontend) — hanya satu tugas per instansi.
   */
  function pastikanBerjalan(tenant: Tenant, kbId: string): void {
    if (berjalan.has(tenant.id)) return;
    const jeda = jedaSampai.get(tenant.id);
    if (jeda && Date.now() < jeda) return;

    const antrean = belumDiperiksa(tenant.id, kbId);
    if (antrean.length === 0) return;

    berjalan.set(tenant.id, { mulai: Date.now(), selesai: 0, total: antrean.length });
    void (async () => {
      try {
        let gagalBerturut = 0;
        for (let i = 0; i < antrean.length; i += CONCURRENCY) {
          const bagian = antrean.slice(i, i + CONCURRENCY);
          const hasil = await Promise.all(bagian.map((p) => periksaPreset(tenant, kbId, p.id)));
          const datar = hasil.flat();
          datar.forEach((h) => db.simpanKetersediaan(h));
          db.persist();
          const progres = berjalan.get(tenant.id);
          if (progres) progres.selesai += bagian.length;

          // Kalau semua percobaan di batch ini gagal karena layanan RAG, hentikan
          // (tidak ada gunanya memanggil puluhan kali) dan beri jeda sebelum coba lagi.
          if (datar.length > 0 && datar.every((h) => h.tidakDiketahui)) {
            gagalBerturut += bagian.length;
            if (gagalBerturut >= BATAS_GAGAL_BERTURUT) {
              console.warn(
                `[ketersediaan] pemeriksaan dihentikan: ${gagalBerturut} percobaan berturut-turut ` +
                  'gagal (layanan RAG kemungkinan bermasalah). Dicoba lagi dalam 1 menit.'
              );
              jedaSampai.set(tenant.id, Date.now() + JEDA_SETELAH_GAGAL_MS);
              break;
            }
          } else {
            gagalBerturut = 0;
          }
        }
      } catch (err) {
        console.error('[ketersediaan] pemeriksaan gagal:', err);
      } finally {
        berjalan.delete(tenant.id);
      }
    })();
  }

  /** Ringkasan untuk frontend + kick off pemeriksaan bila masih ada yang belum. */
  function ringkas(tenant: Tenant, kbId: string): HasilRingkas {
    const provider = ambilProvider();
    const tanpaPenyaringan = provider !== 'http';

    // Tanpa KB, dokumen instansi tidak bisa diakses sama sekali — jangan mengklaim
    // apa pun bisa ditambahkan, dan jangan pula memaksa tampil.
    if (!kbId) {
      return {
        kbId: '',
        tanpaPenyaringan,
        tanpaKb: true,
        total: JUMLAH_PASANGAN,
        selesai: 0,
        gagalDiperiksa: 0,
        memeriksa: false,
        items: [],
      };
    }

    if (!tanpaPenyaringan) pastikanBerjalan(tenant, kbId);

    const catatan = db.ketersediaanUntuk(tenant.id, kbId).filter(masihBerlaku);
    const progres = berjalan.get(tenant.id);
    return {
      kbId,
      tanpaPenyaringan,
      tanpaKb: false,
      total: JUMLAH_PASANGAN,
      selesai: Math.min(catatan.length, JUMLAH_PASANGAN),
      gagalDiperiksa: catatan.filter((k) => k.tidakDiketahui).length,
      memeriksa: !!progres,
      items: catatan.map((k) => ({
        presetId: k.presetId,
        tipe: k.tipe,
        tersedia: k.tersedia,
        tidakDiketahui: k.tidakDiketahui,
        alasan: k.alasan,
        judul: k.judul,
        checkedAt: k.checkedAt,
      })),
    };
  }

  /**
   * Ambil payload yang sudah terverifikasi untuk dipakai tombol Tambah.
   * Hanya mengembalikan bila catatannya berlaku untuk KB instansi ini.
   */
  function ambilDariCache(tenantId: string, kbId: string, presetId: string, tipe: string) {
    const catatan = db
      .ketersediaanUntuk(tenantId, kbId)
      .find((k) => k.presetId === presetId && k.tipe === (tipe as KetersediaanPreset['tipe']));
    if (!catatan?.tersedia || !catatan.widget) return null;
    // Selaraskan sekali lagi saat dibaca: perbaikan penyelaras tipe (mis. legenda
    // donut) langsung berlaku tanpa perlu memeriksa ulang seluruh katalog.
    const selaras = selaraskanTipe(catatan.widget, tipe);
    if (!selaras.ok || !selaras.widget) return null;
    return { data: selaras.widget, judul: catatan.judul, deskripsi: catatan.deskripsi };
  }

  /** Paksa periksa satu preset (dipakai saat pengguna berganti tipe chart). */
  async function periksaPasangan(tenant: Tenant, kbId: string, presetId: string) {
    const catatan = await periksaPreset(tenant, kbId, presetId);
    catatan.forEach((k) => db.simpanKetersediaan(k));
    db.persist();
    return catatan;
  }

  return { ringkas, ambilDariCache, periksaPasangan };
}
