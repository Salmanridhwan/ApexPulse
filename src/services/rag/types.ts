import { BumdSector, Citation } from '../../types';
import { SectorDocumentChunk } from './mockData';

export interface RagQueryOptions {
  prompt: string;
  sector: BumdSector;
  /**
   * Nama instansi aktif (mis. "Perumda Air Minum Tirta Kencana").
   *
   * Wajib dikirim saat membuat dashboard: satu knowledge base bisa memuat
   * dokumen banyak instansi, dan tanpa nama ini RAG menyusun dashboard dari
   * dokumen instansi mana pun (pernah terjadi: minta dashboard PDAM, yang
   * terbuat justru dashboard Bank BJB).
   */
  instansi?: string;
  /**
   * Knowledge base milik instansi untuk permintaan ini. Menimpa KB global dari
   * konfigurasi sistem. Wajib diisi saat membuat dashboard: satu layanan RAG
   * memuat banyak KB (satu per instansi), dan memakai KB global yang isinya
   * dokumen lintas instansi membuat dashboard antar-instansi tertukar.
   */
  kbId?: string;
  /** Mode yang diminta ke layanan RAG. Default Jalur A (JSON terstruktur). */
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
    /** Jumlah potongan dokumen nyata yang bisa diambil (bukan angka hardcode). */
    sampleChunksCount: number;
    detectedMode: 'Jalur A' | 'Jalur B';
    /** Base URL yang benar-benar dipakai (bisa berbeda dari yang dikonfigurasi). */
    baseDipakai?: string;
    baseDisesuaikan?: boolean;
    /** Catatan tambahan untuk panel admin (mis. health 404, KB kosong). */
    catatan?: string[];
  }>;
}
