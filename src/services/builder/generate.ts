import { BumdSector, Dashboard, ProgressStep, WidgetSpec } from '../../types';
import { RagClient } from '../rag/types';
import { mockRag } from '../rag/mock';
import { WIDGET_CATALOG } from './catalog';
import { getFallbackDemoDashboard } from './fallback';
import { buildWidgetsFromJson } from './fromJson';
import { buildWidgetsFromMetadata } from './fromMetadata';

export interface GenerateOptions {
  userPrompt: string;
  sector: BumdSector;
  tenantId: string;
  onProgress?: (step: ProgressStep) => void;
  /** Klien RAG aktif (mock atau HTTP sesuai konfigurasi admin). */
  ragClient?: RagClient;
}

export interface GenerateResult {
  dashboard: Dashboard;
  modeUsed: 'Jalur A (LLM JSON)' | 'Jalur B (Agregasi Metadata)' | 'Fallback (Template Snapshot)';
  latencyMs: number;
  citationsCount: number;
  logSummary: string[];
}

export async function generateDashboard(options: GenerateOptions): Promise<GenerateResult> {
  const { userPrompt, sector, tenantId, onProgress } = options;
  const start = Date.now();
  const logSummary: string[] = [];

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

  const ragRes = await (options.ragClient || mockRag).query({
    prompt: userPrompt,
    sector,
  });

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
  let modeUsed: 'Jalur A (LLM JSON)' | 'Jalur B (Agregasi Metadata)' | 'Fallback (Template Snapshot)' = 'Jalur A (LLM JSON)';

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

  // FALLBACK 3: If both failed, use saved demo dashboard
  if (synthesizedWidgets.length === 0) {
    logSummary.push('[Fallback 3] Menggunakan template dashboard tersimpan (Jaring Pengaman Demo).');
    const fb = getFallbackDemoDashboard(sector, tenantId);
    synthesizedWidgets = fb.widgets;
    dashboardTitle = fb.title;
    dashboardDesc = fb.description;
    modeUsed = 'Fallback (Template Snapshot)';
  }

  onProgress?.({
    id: 'step-3',
    title: `Sintesis selesai via ${modeUsed}`,
    status: 'completed',
  });

  // Step 4: Finalisasi
  onProgress?.({
    id: 'step-4',
    title: 'Merender kanvas dashboard kustomisasi penuh',
    status: 'completed',
  });

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
    latencyMs,
    citationsCount: totalCitations,
    logSummary,
  };
}
