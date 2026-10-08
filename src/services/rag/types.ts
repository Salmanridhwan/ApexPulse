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
  /**
   * Riwayat percakapan (multi-turn) untuk mode `prose` (chatbot). Disisipkan ke
   * query supaya jawaban sadar konteks pertanyaan sebelumnya.
   */
  riwayat?: string;
  /** Persona/sistem framing untuk mode percakapan (chatbot). */
  persona?: string;
  /**
   * strict_grounding ke layanan RAG. Default true: jawaban hanya dari dokumen.
   * Set false HANYA untuk obrolan ringan (sapaan) supaya asisten bisa membalas
   * natural tanpa mengarang fakta instansi.
   */
  strictGrounding?: boolean;
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
  /**
   * true = jawaban benar-benar bersandar dokumen (grounded).
   * false = dokumen tidak memuat jawabannya.
   * undefined = layanan tidak melaporkan status grounding.
   */
  grounded?: boolean;
}

export interface RagClient {
  query(options: RagQueryOptions): Promise<RagResult>;
  /**
   * Daftar dokumen di sebuah knowledge base (untuk panel admin).
   * Dipakai supaya saat KB ID dimasukkan, admin langsung tahu ADA BERAPA dokumen
   * dan dokumen APA SAJA di dalamnya — bukan menebak dari hasil retrieval.
   */
  daftarDokumen(kbId: string): Promise<{
    kbId: string;
    jumlah: number;
    dokumen: Array<{
      id: string;
      nama: string;
      status?: string;
      halaman?: number;
      potongan?: number;
      token?: number;
      dibuat?: string;
      ringkasan?: string;
    }>;
    catatan?: string;
  }>;
  /**
   * Uji API Key RAG: benar-benar memanggil layanan dan melaporkan apakah key-nya
   * diterima. Dipakai tombol "Simpan & Uji API Key" di panel admin.
   *
   * Hasilnya dibedakan jujur: key SALAH (401/AUTH_INVALID), layanan tidak bisa
   * dihubungi (jaringan/URL salah), endpoint tidak ada (404/405), dan key BENAR.
   */
  ujiApiKey(): Promise<{
    ok: boolean;
    /** 'valid' | 'invalid' | 'tidak-terhubung' | 'endpoint-tidak-ada' | 'galat-layanan' */
    status: 'valid' | 'invalid' | 'tidak-terhubung' | 'endpoint-tidak-ada' | 'galat-layanan';
    httpStatus?: number;
    latencyMs: number;
    baseDipakai?: string;
    pesan: string;
    /** Kode galat dari layanan RAG (mis. AUTH_INVALID), bila ada. */
    kodeGalat?: string;
  }>;

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
  /**
   * Tebak profil instansi dari dokumen di sebuah KB: nama, kota, sektor, dan
   * ringkasan isi. Dipakai supaya admin cukup menempelkan KB ID dan field lain
   * (nama instansi, kota, sektor) terisi sendiri.
   *
   * Nilainya DIAMBIL DARI DOKUMEN (bukan dikarang): kalau dokumen tidak memuat,
   * field itu dibiarkan kosong supaya admin mengisinya manual.
   */
  profilInstansi(kbId: string): Promise<{
    kbId: string;
    nama?: string;
    kota?: string;
    sektor?: BumdSector;
    jumlahDokumen: number;
    ringkasan?: string;
    catatan?: string;
  }>;
}
