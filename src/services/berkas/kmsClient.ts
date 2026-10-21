/**
 * Klien HTTP KMS BUMD (`ragkms.aiones.app`) — repositori berkas & media.
 *
 * Kontrak layanan (dari dokumentasi OpenAPI KMS):
 *   - Autentikasi: header `X-API-Key: <kmsApiKey>` (satu key, banyak project).
 *   - `GET  /api/organizations`            → daftar project/KB
 *   - `GET  /api/documents?organizationId=<id|all>` → daftar berkas
 *   - `POST /api/documents/upload`         → multipart: file, title, category, organizationId, …
 *   - `DELETE /api/documents/{id}`         → hapus dari KMS + CDN + RAG
 *
 * Kegagalan layanan DILEMPAR (`KmsServiceError`) supaya pemanggil bisa
 * menampilkan galat jujur — jangan pernah mengembalikan daftar kosong palsu
 * yang membuat UI mengaku "tidak ada berkas" padahal layanan sedang bermasalah.
 */
import { ambilDaftarDokumen, ambilDaftarOrganisasi } from './kms';
import type { BerkasKMS, OrganisasiKMS } from '../../types';

export class KmsServiceError extends Error {
  readonly status?: number;
  readonly detail: string;
  constructor(message: string, detail = '', status?: number) {
    super(message);
    this.name = 'KmsServiceError';
    this.detail = detail;
    this.status = status;
  }
}

export interface KmsConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

/** Terjemahkan kegagalan jaringan/HTTP menjadi pesan Indonesia yang jelas. */
function jelaskanKms(err: any, status?: number): KmsServiceError {
  const kode = err?.cause?.code || err?.code;
  if (status === 401 || status === 403) {
    return new KmsServiceError('API key KMS ditolak.', 'Periksa kembali API key KMS di panel admin.', status);
  }
  if (status === 404) {
    return new KmsServiceError('Endpoint KMS tidak ditemukan.', 'Periksa Base URL KMS di panel admin.', status);
  }
  if (status === 413) {
    return new KmsServiceError('Berkas terlalu besar untuk KMS.', 'Batas satu berkas adalah 50 MB.', status);
  }
  if (kode === 'ENOTFOUND') {
    return new KmsServiceError('Alamat KMS tidak ditemukan.', 'Domain KMS salah ketik atau tidak ada.', status);
  }
  if (kode === 'ECONNREFUSED') {
    return new KmsServiceError('KMS menolak koneksi.', 'Alamat benar tetapi layanan tidak menerima koneksi.', status);
  }
  if (err?.name === 'TimeoutError' || kode === 'ABORT_ERR') {
    return new KmsServiceError('KMS tidak menjawab tepat waktu.', 'Coba lagi atau perbesar batas waktu di panel admin.', status);
  }
  return new KmsServiceError('Gagal menghubungi KMS.', String(err?.message || err || ''), status);
}

export class KmsClient {
  private cfg: KmsConfig;

  constructor(cfg: KmsConfig) {
    this.cfg = cfg;
  }

  private get base(): string {
    return (this.cfg.baseUrl || '').replace(/\/+$/, '');
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { 'X-API-Key': this.cfg.apiKey, ...extra };
  }

  /** Panggil endpoint JSON KMS dan kembalikan body yang sudah di-parse. */
  private async panggil(path: string, init: RequestInit = {}, timeoutMs?: number): Promise<any> {
    const url = `${this.base}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: this.headers((init.headers as Record<string, string>) || {}),
        signal: AbortSignal.timeout(Math.max(5, timeoutMs ?? this.cfg.timeoutMs) * 1000),
      });
    } catch (err: any) {
      throw jelaskanKms(err);
    }
    const teks = await res.text().catch(() => '');
    let data: any = null;
    try {
      data = teks ? JSON.parse(teks) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const pesan = data?.error?.message || data?.message || `KMS menjawab HTTP ${res.status}.`;
      throw jelaskanKms({ message: pesan }, res.status);
    }
    return data;
  }

  /** Daftar project/organisasi KMS. */
  async daftarOrganisasi(): Promise<OrganisasiKMS[]> {
    const data = await this.panggil('/api/organizations', { method: 'GET' }, 30);
    return ambilDaftarOrganisasi(data);
  }

  /** Buat project KMS baru (KMS otomatis membuat knowledge base RAG-nya). */
  async buatOrganisasi(input: { name: string; code: string; industry: string; description?: string }): Promise<OrganisasiKMS | null> {
    const data = await this.panggil(
      '/api/organizations',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) },
      60
    );
    const org = data?.organization || data?.data?.organization || data?.data;
    return org && org.id ? (org as OrganisasiKMS) : null;
  }

  /** Daftar berkas. `organizationId='all'` untuk semua project. */
  async daftarBerkas(organizationId = 'all'): Promise<BerkasKMS[]> {
    const q = encodeURIComponent(organizationId || 'all');
    const data = await this.panggil(`/api/documents?organizationId=${q}`, { method: 'GET' }, 40);
    return ambilDaftarDokumen(data);
  }

  /**
   * Unggah satu berkas ke project KMS. `isi` adalah Buffer berkas.
   * Mengembalikan berkas yang dibuat (atau null bila bentuk balasan tak dikenal).
   */
  async unggahBerkas(input: {
    isi: Buffer;
    namaBerkas: string;
    judul: string;
    kategori: string;
    organizationId: string;
    tipeRepositori?: 'document' | 'photo';
    tahun?: number;
    departemen?: string;
    catatan?: string;
    mimeType?: string;
  }): Promise<BerkasKMS | null> {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(input.isi)], {
      type: input.mimeType || 'application/octet-stream',
    });
    form.append('file', blob, input.namaBerkas);
    form.append('title', input.judul);
    form.append('category', input.kategori);
    form.append('organizationId', input.organizationId);
    form.append('repositoryType', input.tipeRepositori || 'document');
    if (input.tahun !== undefined && Number.isFinite(input.tahun)) form.append('year', String(input.tahun));
    if (input.departemen) form.append('department', input.departemen);
    if (input.catatan) form.append('notes', input.catatan);

    // Jangan set Content-Type manual — biar fetch menambahkan boundary multipart.
    const data = await this.panggil('/api/documents/upload', { method: 'POST', body: form }, 120);
    return (data?.document as BerkasKMS) || null;
  }

  /** Hapus berkas dari KMS (sekaligus CDN & RAG). */
  async hapusBerkas(id: string): Promise<void> {
    await this.panggil(`/api/documents/${encodeURIComponent(id)}`, { method: 'DELETE' }, 60);
  }

  /**
   * Ambil isi berkas dari KMS untuk diteruskan ke browser.
   *
   * Dilakukan di SERVER (bukan tautan langsung dari browser) supaya API key KMS
   * tidak pernah ikut terkirim ke sisi klien. `mode='view'` untuk pratinjau
   * inline, `mode='download'` untuk unduhan (memaksa lampiran).
   */
  async ambilIsiBerkas(
    id: string,
    mode: 'view' | 'download'
  ): Promise<{ isi: Buffer; contentType: string; namaBerkas?: string }> {
    const url = `${this.base}/api/documents/${encodeURIComponent(id)}/${mode}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(120_000) });
    } catch (err: any) {
      throw jelaskanKms(err);
    }
    if (!res.ok) {
      const teks = await res.text().catch(() => '');
      let pesan = `KMS menjawab HTTP ${res.status} saat mengambil berkas.`;
      try {
        const j = JSON.parse(teks);
        pesan = j?.error?.message || j?.message || pesan;
      } catch {
        /* biarkan pesan bawaan */
      }
      throw jelaskanKms({ message: pesan }, res.status);
    }
    const isi = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    // Ambil nama berkas dari Content-Disposition bila layanan mengirimkannya.
    const cd = res.headers.get('content-disposition') || '';
    const cocok = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    return { isi, contentType, namaBerkas: cocok ? decodeURIComponent(cocok[1]) : undefined };
  }

  /** Uji cepat: apakah key & base URL diterima (dipakai panel admin). */
  async uji(): Promise<{ ok: boolean; jumlahProject: number; pesan: string }> {
    try {
      const orgs = await this.daftarOrganisasi();
      return { ok: true, jumlahProject: orgs.length, pesan: `Terhubung — ${orgs.length} project terbaca.` };
    } catch (err: any) {
      return { ok: false, jumlahProject: 0, pesan: err?.message || 'Gagal menghubungi KMS.' };
    }
  }
}
