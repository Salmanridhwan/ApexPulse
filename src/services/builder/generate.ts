import { BumdSector, Dashboard, ProgressStep, WidgetSpec } from '../../types';
import { RagClient } from '../rag/types';
import { RagServiceError } from '../rag/http';
import { WIDGET_CATALOG } from './catalog';
import { getFallbackDemoDashboard } from './fallback';
import { buildWidgetsFromJson } from './fromJson';
import { buildWidgetsFromMetadata } from './fromMetadata';
import { selaraskanDaftarWidget } from '../spec/tipeSelaras';
import {
  PermintaanJumlahWidget,
  labelJumlahWidget,
  lengkapiWidgetDariKatalog,
  parsePermintaanJumlahWidget,
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
  | 'Jalur B (Agregasi Metadata)'
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
  onProgress?.({
    id: 'step-2',
    title: 'Menghubungi RAG API & retrieval potongan dokumen resmi',
    status: 'in_progress',
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
    });
  } catch (err) {
    const pesan =
      err instanceof RagServiceError
        ? err.message
        : `Tidak bisa menghubungi layanan RAG (${err instanceof Error ? err.message : 'kesalahan jaringan'}).`;
    logSummary.push(`[RAG Client Gagal] ${pesan}`);
    onProgress?.({
      id: 'step-2',
      title: 'Layanan RAG tidak dapat dihubungi — dashboard tidak dibuat',
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
      logSummary.push(`[Jalur A Gagal] Ditolak: ${jsonRes.errors?.join('; ')}. Beralih ke Jalur B...`);
    }
  }

  // JALUR B FALLBACK: If Jalur A was not used or failed, use metadata aggregation
  if (synthesizedWidgets.length === 0 && ragRes.chunks && ragRes.chunks.length > 0) {
    logSummary.push('[Jalur B] Menjalankan agregasi metadata deterministik...');
    const metaRes = buildWidgetsFromMetadata(ragRes.chunks, sector, userPrompt);
    if (metaRes.success && metaRes.widgets.length > 0) {
      synthesizedWidgets = metaRes.widgets;
      dashboardTitle = metaRes.dashboardTitle;
      dashboardDesc = metaRes.description;
      modeUsed = 'Jalur B (Agregasi Metadata)';
      logSummary.push(`[Jalur B Sukses] Tersusun ${synthesizedWidgets.length} widget murni dari metadata dokumen.`);
    }
  }

  // FALLBACK 3: tidak ada data sah sama sekali.
  // Snapshot contoh hanya boleh dipakai di mode demo tanpa RAG nyata. Dengan RAG
  // nyata (provider `http`) snapshot itu menampilkan angka + sitasi karangan yang
  // tampak resmi, jadi permintaan digagalkan dan dashboard TIDAK disimpan.
  let ok = true;
  let alasanGagal: string | undefined;
  if (synthesizedWidgets.length === 0) {
    if (izinkanSnapshotDemo) {
      logSummary.push('[Fallback 3] Menggunakan template dashboard tersimpan (mode demo).');
      const fb = getFallbackDemoDashboard(sector, tenantId);
      synthesizedWidgets = fb.widgets;
      dashboardTitle = fb.title;
      dashboardDesc = fb.description;
      modeUsed = 'Fallback (Template Snapshot)';
    } else {
      modeUsed = 'Gagal (Dokumen Tidak Memadai)';
      ok = false;
      alasanGagal =
        'RAG tidak mengembalikan angka yang bisa divalidasi dari dokumen instansi ini, ' +
        'jadi dashboard tidak dibuat supaya kanvas tidak menampilkan angka contoh.';
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
        const hasil = await ragClient.ambilDataWidget!(
          preset.queryRagContoh,
          sector,
          tipeDasarPreset(preset),
          instansi,
          kbId
        );
        return hasil?.data ? (hasil.data as WidgetSpec) : null;
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
