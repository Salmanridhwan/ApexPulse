import { BumdSector, Citation } from '../../types';
import { SectorDocumentChunk } from './mockData';

export interface RagQueryOptions {
  prompt: string;
  sector: BumdSector;
  mode?: 'structured' | 'prose';
  timeoutMs?: number;
}

export interface RagResult {
  provider: 'mock' | 'http';
  mode: 'Jalur A' | 'Jalur B';
  latencyMs: number;
  answer?: string;
  structuredJson?: any;
  chunks: SectorDocumentChunk[];
  citations: Citation[];
}

export interface RagClient {
  query(options: RagQueryOptions): Promise<RagResult>;
  probe(): Promise<{
    latencyMs: number;
    canOutputJson: boolean;
    hasMetadata: boolean;
    detectedMode: 'Jalur A' | 'Jalur B';
  }>;
}
