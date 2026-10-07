import { BumdSector, WidgetSpec } from '../../types';
import { WidgetSpecSchema } from '../spec/widgetSpec';
import { WIDGET_CATALOG } from './catalog';
import { bersihkanLabel, bersihkanPayload } from './teks';

export interface FromJsonResult {
  success: boolean;
  dashboardTitle: string;
  description: string;
  sector: BumdSector;
  widgets: WidgetSpec[];
  errors?: string[];
}

export function buildWidgetsFromJson(rawJson: any, sector: BumdSector): FromJsonResult {
  const errors: string[] = [];
  const widgets: WidgetSpec[] = [];

  if (!rawJson || typeof rawJson !== 'object') {
    return {
      success: false,
      dashboardTitle: `Dashboard ${sector.toUpperCase()}`,
      description: 'Gagal memproses JSON dari RAG.',
      sector,
      widgets: [],
      errors: ['Format JSON tidak valid atau kosong.'],
    };
  }

  // Buang aksara non-Latin/karakter kontrol yang kadang diselipkan model ke
  // label (mis. "Rasio air hilang网络 (NRW)") sebelum widget dirender.
  rawJson = bersihkanPayload(rawJson);

  const rawWidgets = Array.isArray(rawJson.widgets) ? rawJson.widgets : [];
  const dashboardTitle = bersihkanLabel(
    rawJson.dashboardTitle || `Dashboard Otomatis Sektor ${sector.toUpperCase()}`
  );
  const description = bersihkanLabel(
    rawJson.description || 'Dashboard disintesis otomatis dari pangkalan dokumen RAG BUMD.'
  );

  let currentX = 0;
  let currentY = 0;

  for (let i = 0; i < rawWidgets.length; i++) {
    const rawW = rawWidgets[i];
    try {
      // Ensure grid coordinates if missing
      const w = rawW.grid?.w || (rawW.type === 'kpi' ? 4 : rawW.type === 'narasi' ? 12 : 6);
      const h = rawW.grid?.h || (rawW.type === 'kpi' ? 3 : rawW.type === 'narasi' ? 3 : 4);
      const x = rawW.grid?.x !== undefined ? rawW.grid.x : currentX;
      const y = rawW.grid?.y !== undefined ? rawW.grid.y : currentY;

      // Update layout cursors
      currentX += w;
      if (currentX >= 12) {
        currentX = 0;
        currentY += h;
      }

      // Check catalog preset alignment if provided
      let presetId = rawW.presetId;
      if (presetId) {
        const found = WIDGET_CATALOG.find((p) => p.id === presetId);
        if (!found) {
          presetId = undefined;
        }
      }

      const widgetCandidate: WidgetSpec = {
        id: rawW.id || `w-${sector}-${Date.now()}-${i}`,
        presetId,
        type: rawW.type || 'kpi',
        title: rawW.title || `Widget ${i + 1}`,
        subtitle: rawW.subtitle,
        category: rawW.category || 'Operasional',
        confidence: rawW.confidence === 'sumber' ? 'sumber' : 'inferensi AI',
        grid: { x, y, w, h },
        kpi: rawW.kpi,
        chart: rawW.chart,
        table: rawW.table,
        narasi: rawW.narasi,
        citations: Array.isArray(rawW.citations) ? rawW.citations : [],
        unitKerja: rawW.unitKerja,
        periode: rawW.periode || '2026-Q1',
        lastUpdated: new Date().toISOString(),
      };

      // Validate with Zod
      const parsed = WidgetSpecSchema.safeParse(widgetCandidate);
      if (parsed.success) {
        widgets.push(parsed.data as WidgetSpec);
      } else {
        errors.push(`Widget #${i + 1} (${rawW.title}) ditolak Zod: ${parsed.error.issues.map((iss) => iss.message).join(', ')}`);
      }
    } catch (err: any) {
      errors.push(`Widget #${i + 1} error: ${err?.message || 'unknown error'}`);
    }
  }

  return {
    success: widgets.length > 0,
    dashboardTitle,
    description,
    sector,
    widgets,
    errors: errors.length > 0 ? errors : undefined,
  };
}
