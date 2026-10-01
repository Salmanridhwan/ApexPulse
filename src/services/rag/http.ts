import { Citation } from '../../types';
import { MockRagClient } from './mock';
import { RagClient, RagQueryOptions, RagResult } from './types';
import { SectorDocumentChunk } from './mockData';

/** Sumber konfigurasi RAG (disimpan di systemConfig, diatur admin). */
export type RagConfigFetcher = () => {
  provider: 'mock' | 'http';
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
};

const MASK = '*********';

/** Mask API key untuk UI admin: tampilkan 4 karakter pertama & terakhir saja. */
export function maskKey(key: string): string {
  if (!key) return '';
  if (key === MASK) return key;
  if (key.length <= 8) return MASK;
  return key.slice(0, 4) + MASK + key.slice(-4);
}

/** Bungkus pesan error jadi teks ramah untuk probe/log. */
export function jelaskanError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/aborted|timeout/i.test(msg)) return 'Timeout — RAG tidak merespons tepat waktu';
  if (/401|403/.test(msg)) return 'API key ditolak (401/403)';
  if (/404/.test(msg)) return 'Endpoint tidak ditemukan (404)';
  if (/ENOTFOUND|ECONNREFUSED|fetch failed|ECONNRESET/i.test(msg)) return 'Host tidak dapat dihubungi';
  return msg;
}

export class ConfigurableRagClient implements RagClient {
  private mock = new MockRagClient();
  private getRagConfig: RagConfigFetcher;

  constructor(getRagConfig: RagConfigFetcher) {
    this.getRagConfig = getRagConfig;
  }

  async query(options: RagQueryOptions): Promise<RagResult> {
    const cfg = this.getRagConfig();
    if (cfg.provider !== 'http' || !cfg.baseUrl || !cfg.apiKey) {
      return this.mock.query(options);
    }

    const start = Date.now();
    const timeoutMs = Math.max(5, cfg.timeoutMs || 60) * 1000;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          prompt: options.prompt,
          sector: options.sector,
          mode: options.mode,
        }),
        signal: ac.signal,
      });
      if (!res.ok) {
        throw new Error(`RAG HTTP ${res.status}`);
      }
      const data = await res.json();

      // Kontrak respons (fleksibel): { answer?, structuredJson?|structured?, chunks: [...] }
      const chunks: SectorDocumentChunk[] = Array.isArray(data.chunks) ? data.chunks : [];
      const structuredJson = data.structuredJson ?? data.structured ?? null;
      const mode: 'Jalur A' | 'Jalur B' = structuredJson ? 'Jalur A' : 'Jalur B';

      const citations: Citation[] = chunks.map((c, idx) => ({
        id: c.id ? `cit-${c.id}` : `cit-http-${idx}`,
        docName: c.docName || 'Dokumen Sumber',
        page: c.page || 1,
        chunkSnippet: c.snippet || '',
        confidenceScore: (c.metadata as any)?.confidenceScore ?? 0.9,
        date: c.date || '',
        unitKerja: c.metadata?.unitKerja,
        metric: c.metadata?.metric,
      }));

      return {
        provider: 'http',
        mode,
        latencyMs: Date.now() - start,
        answer: data.answer,
        structuredJson,
        chunks,
        citations,
      };
    } catch (err) {
      console.error('[RAG HTTP] Gagal, fallback ke mock:', jelaskanError(err));
      const fallback = await this.mock.query(options);
      return { ...fallback, provider: 'mock' };
    } finally {
      clearTimeout(timer);
    }
  }

  async probe(): Promise<{
    latencyMs: number;
    canOutputJson: boolean;
    hasMetadata: boolean;
    detectedMode: 'Jalur A' | 'Jalur B';
  }> {
    const cfg = this.getRagConfig();
    const start = Date.now();
    if (cfg.provider !== 'http' || !cfg.baseUrl || !cfg.apiKey) {
      return this.mock.probe();
    }
    const timeoutMs = Math.max(5, cfg.timeoutMs || 60) * 1000;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/health`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
        signal: ac.signal,
      });
      if (!res.ok) {
        throw new Error(`RAG HTTP ${res.status}`);
      }
      await res.json().catch(() => ({}));
      return {
        latencyMs: Date.now() - start,
        canOutputJson: true,
        hasMetadata: true,
        detectedMode: 'Jalur A',
      };
    } catch (err) {
      throw new Error(jelaskanError(err));
    } finally {
      clearTimeout(timer);
    }
  }
}
