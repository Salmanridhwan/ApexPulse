import { BumdSector, Dashboard, ProgressStep, WidgetSpec } from '../../types';
import { RagClient } from '../rag/types';
import { RagServiceError } from '../rag/http';
import { WIDGET_CATALOG } from './catalog';
import { getFallbackDemoDashboard } from './fallback';
import { buildWidgetsFromJson } from './fromJson';
import { rapikanTataLetak } from './tataLetak';
import { selaraskanDaftarWidget } from '../spec/tipeSelaras';
import {
  PermintaanJumlahWidget,
  buangWidgetKembar,
  labelJumlahWidget,
  lengkapiWidgetDariKatalog,
  parsePermintaanJumlahWidget,
  tipeCadanganPreset,
  tipeDasarPreset,
} from './permintaanWidget';

export interface GenerateOptions {
  userPrompt: string;
  sector: BumdSector;
  tenantId: string;
  /** Nama instansi aktif — diteruskan ke RAG agar dokumen instansi lain diabaikan. */
  instansi?: string;
  /** Knowledge base milik instansi aktif (satu KB per instansi di layanan RAG). */
  kbId?: string;
  /**
   * Boleh memakai snapshot dashboard contoh (angka + sitasi karangan) saat RAG
   * tidak menghasilkan widget?
   *
   * HANYA untuk mode demo tanpa RAG nyata (provider `mock`). Saat RAG nyata
   * aktif, snapshot itu membuat dashboard tampak resmi padahal angkanya contoh
   * — jadi dilarang dan permintaan digagalkan dengan pesan jelas.
   */
  izinkanSnapshotDemo?: boolean;
  onProgress?: (step: ProgressStep) => void;
  /** Klien RAG aktif (mock atau HTTP sesuai konfigurasi admin). */
  ragClient?: RagClient;
}

/** Cara sebuah dashboard diperoleh — dipakai untuk pesan jujur ke pengguna. */
export type GenerateMode =
  | 'Jalur A (LLM JSON)'
  | 'Fallback (Template Snapshot)'
  | 'Gagal (Layanan RAG)'
  | 'Gagal (Dokumen Tidak Memadai)';

export interface GenerateResult {
  dashboard: Dashboard;
  modeUsed: GenerateMode;
  /** false = dashboard TIDAK boleh disimpan/ditampilkan (tidak ada data sah). */
  ok: boolean;
  /** Alasan kegagalan — diisi hanya saat ok=false. */
  alasanGagal?: string;
  latencyMs: number;
  citationsCount: number;
  logSummary: string[];
  /**
   * Permintaan jumlah widget yang terbaca dari kalimat pengguna, mis.
   * "dashboard dengan 15-20 widget" → { min: 15, max: 20 }. `undefined` bila
   * pengguna tidak menyebut jumlah (dashboard dibuat apa adanya).
   */
  permintaanJumlah?: PermintaanJumlahWidget;
  /** Jumlah widget yang benar-benar berhasil dibuat. */
  jumlahWidget: number;
  /**
   * true bila permintaan jumlah widget BELUM terpenuhi (dokumen tidak memuat
   * cukup indikator). Pemanggil wajib menyampaikan ini apa adanya ke pengguna.
   */
  jumlahKurang: boolean;
}

export async function generateDashboard(options: GenerateOptions): Promise<GenerateResult> {
  const { userPrompt, sector, tenantId, instansi, kbId, izinkanSnapshotDemo, onProgress } = options;
  const start = Date.now();
  const logSummary: string[] = [];

  // Permintaan JUMLAH widget ("dashboard dengan 15-20 widget"). Dibaca di awal
  // supaya jalur mana pun tahu targetnya, dan supaya janji ke pengguna tidak
  // pernah melebihi widget yang benar-benar dibuat.
  const permintaanJumlahDibaca = parsePermintaanJumlahWidget(userPrompt);
  const permintaanJumlah: PermintaanJumlahWidget | undefined = permintaanJumlahDibaca ?? undefined;
  if (permintaanJumlah) {
    logSummary.push(
      `[Permintaan Jumlah] Pengguna meminta ${labelJumlahWidget(permintaanJumlah)} widget.`
    );
  }

  // Step 1: Menerjemahkan instruksi
  onProgress?.({
    id: 'step-1',
    title: 'Menerjemahkan instruksi & analisis sektor BUMD',
    status: 'in_progress',
  });
  await new Promise((r) => setTimeout(r, 250));
  onProgress?.({
    id: 'step-1',
    title: 'Instruksi pengguna berhasil diuraikan',
    status: 'completed',
  });
  logSummary.push(`[AionesBoard Orchestrator] Analisis query: "${userPrompt}" untuk sektor: ${sector}`);

  // Step 2: Query RAG & Retrieval Chunks
  // Estimasi waktu ditampilkan ke pengguna. Sapuan penuh (10 area) butuh 4–10
  // menit pada permintaan pertama; kalau hasilnya masih tersimpan di cache,
  // prosesnya selesai di bawah satu menit. Angka ini sengaja diberi rentang
  // supaya pengguna tidak mengira proses menggantung saat layanan lambat.
  const adaCache = options.ragClient?.adaCacheSapuan?.(kbId, sector) ?? false;
  onProgress?.({
    id: 'step-2',
    title: adaCache
      ? 'Mengambil hasil sapuan dokumen yang tersimpan (cepat)'
      : 'Membaca seluruh bagian dokumen — 10 area laporan (perkiraan 6–10 menit)',
    status: 'in_progress',
    // 600 dtk = tenggat sapuan. Uji nyata: permintaan tanpa cache selesai
    // 400–620 dtk, jadi 480 dtk terlalu optimis dan pengguna melihat estimasi
    // terlampaui padahal proses masih normal.
    estimasiDetik: adaCache ? 45 : 600,
  });

  const availablePresets = WIDGET_CATALOG.filter(
    (p) => p.sektor.includes(sector) || p.sektor.includes('universal')
  )
    .map((p) => p.id)
    .join(', ');

  // Panggil layanan RAG. Kalau layanan tidak terhubung / key ditolak, JANGAN
  // diam-diam memakai data contoh — kembalikan hasil gagal dengan pesan jujur.
  let ragRes;
  try {
    if (!options.ragClient) {
      throw new RagServiceError('Klien RAG belum tersedia di server.');
    }
    ragRes = await options.ragClient.query({
      prompt: userPrompt,
      sector,
      instansi,
      kbId,
      // Baca SELURUH isi basis dokumen (sapuan per area), bukan 8 potongan teratas.
      // Tanpa ini grafik hanya berisi 3–6 titik dan bagian laporan lain terlewat.
      sapuanPenuh: true,
    });
  } catch (err) {
    const pesan =
      err instanceof RagServiceError
        ? err.message
        : `Tidak bisa menghubungi layanan RAG (${err instanceof Error ? err.message : 'kesalahan jaringan'}).`;
    logSummary.push(`[RAG Client Gagal] ${pesan}`);
    onProgress?.({
      id: 'step-2',
      title: 'Layanan dokumen tidak dapat dihubungi — dashboard tidak dibuat',
      status: 'failed',
    });
    return {
      dashboard: {
        id: `dash-${Date.now()}`,
        tenantId,
        title: `Dashboard Kinerja ${sector.toUpperCase()} 2026`,
        description: '',
        sector,
        widgets: [],
        globalFilters: { periode: '2026-Q1', unitKerja: 'Semua', kategori: 'Semua' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      modeUsed: 'Gagal (Layanan RAG)',
      ok: false,
      alasanGagal: pesan,
      latencyMs: Date.now() - start,
      citationsCount: 0,
      logSummary,
      permintaanJumlah,
      jumlahWidget: 0,
      jumlahKurang: !!permintaanJumlah,
    };
  }

  logSummary.push(`[RAG Client] Respons diterima dalam ${ragRes.latencyMs}ms. Mode: ${ragRes.mode}`);
  onProgress?.({
    id: 'step-2',
    title: `Data dokumen berhasil diambil (${ragRes.chunks.length} potongan dokumen, ${ragRes.citations.length} sitasi)`,
    status: 'completed',
  });

  // Step 3: Validasi Schema & Sintesis Widget Spec
  onProgress?.({
    id: 'step-3',
    title: 'Validasi Zod & sintesis Widget Spec',
    status: 'in_progress',
  });

  let synthesizedWidgets: WidgetSpec[] = [];
  let dashboardTitle = `Dashboard Kinerja ${sector.toUpperCase()} 2026`;
  let dashboardDesc = `Dashboard terintegrasi otomatis dari data resmi BUMD.`;
  let modeUsed: GenerateMode = 'Jalur A (LLM JSON)';

  // JALUR A ATTEMPT: If structured JSON exists
  if (ragRes.structuredJson) {
    logSummary.push('[Jalur A] Memeriksa struktur JSON terhadap skema Zod...');
    const jsonRes = buildWidgetsFromJson(ragRes.structuredJson, sector);
    if (jsonRes.success && jsonRes.widgets.length > 0) {
      synthesizedWidgets = jsonRes.widgets;
      dashboardTitle = jsonRes.dashboardTitle;
      dashboardDesc = jsonRes.description;
      modeUsed = 'Jalur A (LLM JSON)';
      logSummary.push(`[Jalur A Sukses] Berhasil memvalidasi ${synthesizedWidgets.length} widget dengan sitasi.`);
    } else {
      logSummary.push(`[Jalur A Gagal] Ditolak: ${jsonRes.errors?.join('; ')}.`);
    }
  }

  // JALUR B DIHAPUS (permintaan user 2026-10-15): aplikasi TIDAK menyusun dashboard
  // sendiri dari metadata/chunk (modul `fromMetadata` sudah dihapus). Modul itu
  // mengisi tren & sparkline dengan angka yang di-HARDCODE di kode kita, sehingga
  // kanvas bisa menampilkan grafik yang tidak berasal dari RAG sama sekali. Sekarang
  // angka hanya boleh datang dari RAG lewat Jalur A (/extract JSON terstruktur);
  // kalau tidak ada, dashboard TIDAK dibuat.

  // FALLBACK: tidak ada data sah sama sekali.
  // Snapshot contoh hanya boleh dipakai di mode demo tanpa RAG nyata. Dengan RAG
  // nyata (provider `http`) snapshot itu menampilkan angka + sitasi karangan yang
  // tampak resmi, jadi permintaan digagalkan dan dashboard TIDAK disimpan.
  let ok = true;
  let alasanGagal: string | undefined;
  if (synthesizedWidgets.length === 0) {
    if (izinkanSnapshotDemo) {
      logSummary.push('[Fallback] Menggunakan template dashboard tersimpan (mode demo).');
      const fb = getFallbackDemoDashboard(sector, tenantId);
      synthesizedWidgets = fb.widgets;
      dashboardTitle = fb.title;
      dashboardDesc = fb.description;
      modeUsed = 'Fallback (Template Snapshot)';
    } else {
      modeUsed = 'Gagal (Dokumen Tidak Memadai)';
      ok = false;
      alasanGagal =
        'Layanan RAG tidak mengembalikan data terstruktur yang bisa divalidasi dari dokumen instansi ini, ' +
        'jadi dashboard tidak dibuat supaya kanvas tidak menampilkan angka yang bukan dari dokumen.';
      logSummary.push(`[Gagal] ${alasanGagal}`);
    }
  }

  // Selaraskan tipe SEMUA widget dengan gerbang yang sama seperti katalog ("Tambah Widget").
  // Copilot Jalur A menerima `type` apa adanya dari model dan hanya memvalidasi bentuk
  // (Zod); tanpa langkah ini tipe seperti heatmap satu seri atau peta tanpa rincian wilayah
  // lolos ke kanvas dan digambar berbeda dari pratinjau tipe itu di Template Chart.
  if (synthesizedWidgets.length > 0) {
    const selaras = selaraskanDaftarWidget(synthesizedWidgets);
    synthesizedWidgets = selaras.widgets;
    for (const c of selaras.catatan) {
      logSummary.push(
        c.ke
          ? `[Selaras Tipe] "${c.judul}" ditampilkan sebagai ${c.ke} (diminta ${c.dari}): ${c.alasan}`
          : `[Selaras Tipe] "${c.judul}" (${c.dari}) tidak ditampilkan: ${c.alasan}`
      );
    }
  }

  // Step 3b: LENGKAPI sampai jumlah widget yang diminta pengguna.
  // Dashboard utama biasanya hanya menghasilkan 2-6 widget. Kalau pengguna
  // meminta lebih ("15-20 widget"), tarik sisa widget dari KATALOG preset —
  // angkanya tetap dari dokumen instansi (bukan karangan). Best-effort: yang
  // tidak ada datanya dibuang, dan selisihnya dilaporkan jujur ke pengguna.
  if (
    ok &&
    permintaanJumlah &&
    synthesizedWidgets.length > 0 &&
    synthesizedWidgets.length < permintaanJumlah.max &&
    typeof options.ragClient?.ambilDataWidget === 'function'
  ) {
    onProgress?.({
      id: 'step-3b',
      title: `Melengkapi dashboard sampai ${labelJumlahWidget(permintaanJumlah)} widget dari dokumen...`,
      status: 'in_progress',
    });
    const ragClient = options.ragClient;
    const lengkap = await lengkapiWidgetDariKatalog({
      widgets: synthesizedWidgets,
      katalog: WIDGET_CATALOG,
      sector,
      target: permintaanJumlah,
      onCatatan: (t) => logSummary.push(`[Lengkapi] ${t}`),
      ambil: async (preset) => {
        // Coba tipe yang DIMINTAKAN preset dulu (agar variasi chart terjaga:
        // donut, radar, heatmap, gauge, …). Kalau bentuk datanya tidak mendukung,
        // `ambilDataWidget` mengembalikan null — coba tipe cadangan berikutnya
        // PADA DATA yang sudah diambil ulang, sehingga kartu tetap muncul dengan
        // bentuk paling setia yang bisa digambar, bukan hilang.
        const kandidat = [tipeDasarPreset(preset), ...tipeCadanganPreset(preset)];
        for (const tipe of kandidat) {
          try {
            const hasil = await ragClient.ambilDataWidget!(
              preset.queryRagContoh,
              sector,
              tipe,
              instansi,
              kbId
            );
            if (hasil?.data) return hasil.data as WidgetSpec;
          } catch {
            // Galat satu tipe tidak boleh menggagalkan preset ini; coba cadangan.
          }
        }
        return null;
      },
    });
    synthesizedWidgets = lengkap.widgets;
    logSummary.push(
      `[Lengkapi] Ditambahkan ${lengkap.ditambahkan} dari ${lengkap.dicoba} preset katalog ` +
        `(total ${synthesizedWidgets.length} widget).`
    );
    // Setelah melengkapi, tipe widget baru perlu diselaraskan juga supaya
    // kartunya sama dengan pratinjau katalog (mis. bar tanpa seri valid).
    if (lengkap.ditambahkan > 0) {
      const selaras2 = selaraskanDaftarWidget(synthesizedWidgets);
      synthesizedWidgets = selaras2.widgets;
    }
    onProgress?.({
      id: 'step-3b',
      title:
        synthesizedWidgets.length >= permintaanJumlah.max
          ? `Dashboard lengkap: ${synthesizedWidgets.length} widget dari dokumen instansi`
          : `Tersusun ${synthesizedWidgets.length} widget (permintaan ${labelJumlahWidget(permintaanJumlah)} belum terpenuhi penuh)`,
      status: 'completed',
    });
  }

  // Step 3c: RAPIKAN TATA LETAK.
  // Kanvas mengabaikan x/y dan menyusun dari URUTAN + lebar (grid.w). Tanpa
  // langkah ini urutan widget hasil gabungan (Jalur A + pelengkap katalog) acak
  // dan lebarnya tidak mengemas 12 kolom, sehingga kanvas penuh celah —
  // "penempatan widgetnya masih berantakan". `rapikanTataLetak` mengurutkan per
  // zona (kartu → grafik → tabel → narasi) dan menetapkan lebar yang rapat.
  if (synthesizedWidgets.length > 0) {
    synthesizedWidgets = rapikanTataLetak(synthesizedWidgets);
    logSummary.push(`[Tata Letak] ${synthesizedWidgets.length} widget disusun rapi (12 kolom tanpa celah).`);
  }

  // Step 3d: PASTIKAN ID WIDGET UNIK.
  // Sumber ID bersifat STATIS per bentuk (mis. `w-kpi-1`, `w-grafik-1` di
  // `payloadKeWidgetSpec`). Saat banyak widget digabung (Jalur A + pelengkap
  // katalog + penambahan via chat), ID yang sama terulang — React memakai `id`
  // sebagai key, sehingga duplikat membuat kanvas merender kartu yang salah atau
  // tidak muncul sama sekali ("chart tidak masuk dashboard"). Di sini ID
  // dijadikan unik tanpa mengubah urutan/isi widget.
  if (synthesizedWidgets.length > 0) {
    const terpakai = new Set<string>();
    let dinomori = 0;
    synthesizedWidgets = synthesizedWidgets.map((w) => {
      let id = String(w.id || '').trim();
      if (!id || terpakai.has(id)) {
        const dasar = id || `w-${w.type || 'widget'}`;
        let kandidat = `${dasar}-${++dinomori}`;
        while (terpakai.has(kandidat)) kandidat = `${dasar}-${++dinomori}`;
        id = kandidat;
      }
      terpakai.add(id);
      return { ...w, id };
    });
    logSummary.push('[ID Widget] Semua ID widget unik (tidak ada key duplikat di kanvas).');
  }

  // Step 3e: BUANG WIDGET YANG ISINYA KEMBAR.
  // ID unik hanya menyelesaikan masalah render. Dua widget tetap bisa
  // menanyakan hal yang sama (ID beda, judul/isi sama) karena widget Jalur A
  // tidak pernah melewati dedup yang ada di `lengkapiWidgetDariKatalog` — hasil
  // nyata: "Laba bersih 2022" muncul 3x dalam satu dashboard. Di sini daftar
  // FINAL (Jalur A + pelengkap katalog + tambahan chat) disaring sekali lagi;
  // urutan kanvas dipertahankan dan yang disisakan adalah widget paling lengkap.
  if (synthesizedWidgets.length > 0) {
    const sebelum = synthesizedWidgets.length;
    const saring = buangWidgetKembar(synthesizedWidgets);
    synthesizedWidgets = saring.widgets;
    if (saring.dibuang.length > 0) {
      logSummary.push(
        `[Isi Kembar] ${saring.dibuang.length} widget kembar dibuang (${sebelum} → ${synthesizedWidgets.length}): ` +
          saring.dibuang.map((d) => `"${d.judul}"`).join(', ')
      );
    } else {
      logSummary.push('[Isi Kembar] Tidak ada widget kembar.');
    }
  }

  onProgress?.({
    id: 'step-3',
    title: ok ? `Sintesis selesai via ${modeUsed}` : 'Dokumen instansi tidak memadai — dashboard tidak dibuat',
    status: ok ? 'completed' : 'failed',
  });

  // Step 4: Finalisasi (hanya kalau ada dashboard yang benar-benar dibuat)
  if (ok) {
    onProgress?.({
      id: 'step-4',
      title: 'Merender kanvas dashboard kustomisasi penuh',
      status: 'completed',
    });
  }

  const latencyMs = Date.now() - start;

  const totalCitations = synthesizedWidgets.reduce(
    (acc, w) => acc + (w.citations ? w.citations.length : 0),
    0
  );

  const dashboard: Dashboard = {
    id: `dash-${Date.now()}`,
    tenantId,
    title: dashboardTitle,
    description: dashboardDesc,
    sector,
    widgets: synthesizedWidgets,
    globalFilters: {
      periode: '2026-Q1',
      unitKerja: 'Semua',
      kategori: 'Semua',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    dashboard,
    modeUsed,
    ok,
    alasanGagal,
    latencyMs,
    citationsCount: totalCitations,
    logSummary,
    permintaanJumlah,
    jumlahWidget: synthesizedWidgets.length,
    jumlahKurang: !!permintaanJumlah && synthesizedWidgets.length < permintaanJumlah.max,
  };
}
