import { BumdSector, Citation, WidgetSpec } from '../../types';
import { MOCK_CHUNKS, MONTHS_12, SectorDocumentChunk } from './mockData';
import { RagClient, RagQueryOptions, RagResult } from './types';

export class MockRagClient implements RagClient {
  /** Jalur A diminta lebih dulu; generate.ts otomatis turun ke Jalur B bila JSON ditolak. */
  private readonly defaultMode: 'structured' | 'prose' = 'structured';

  /**
   * Mode mock tidak punya knowledge base nyata. Daftar dokumen dikembalikan dari
   * kumpulan data contoh supaya panel admin tetap bisa diuji tanpa layanan RAG,
   * dengan catatan jelas bahwa ini bukan dokumen instansi.
   */
  async daftarDokumen(kbId: string): Promise<{
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
  }> {
    const nama = [...new Set(MOCK_CHUNKS.filter((c) => c.sector === 'pdam').map((c) => c.docName))];
    return {
      kbId: kbId || '(mock)',
      jumlah: nama.length,
      dokumen: nama.map((n, i) => ({
        id: `mock-${i + 1}`,
        nama: n,
        status: 'contoh',
        halaman: 1,
        potongan: MOCK_CHUNKS.filter((c) => c.docName === n).length,
        token: undefined,
      })),
      catatan:
        'Provider RAG sedang mode "mock": dokumen di bawah adalah data contoh bawaan aplikasi, bukan dokumen instansi nyata.',
    };
  }

  /**
   * Uji API Key pada mode mock: tidak ada layanan nyata untuk diuji, jadi
   * dilaporkan apa adanya (jangan pura-pura valid).
   */
  async ujiApiKey(): Promise<{
    ok: boolean;
    status: 'valid' | 'invalid' | 'tidak-terhubung' | 'endpoint-tidak-ada' | 'galat-layanan';
    httpStatus?: number;
    latencyMs: number;
    baseDipakai?: string;
    pesan: string;
    kodeGalat?: string;
  }> {
    return {
      ok: false,
      status: 'galat-layanan',
      latencyMs: 0,
      pesan:
        'Provider RAG sedang mode "Mock" — tidak ada layanan nyata yang bisa diuji. Ubah Provider ke "HTTP" lalu uji lagi.',
    };
  }

  /**
   * Profil instansi dari dokumen KB. Mode mock tidak punya dokumen nyata, jadi
   * hanya jumlah dokumen contoh yang dilaporkan dan field lainnya dikosongkan.
   */
  async profilInstansi(kbId: string): Promise<{
    kbId: string;
    nama?: string;
    kota?: string;
    sektor?: BumdSector;
    jumlahDokumen: number;
    ringkasan?: string;
    catatan?: string;
  }> {
    const daftar = await this.daftarDokumen(kbId);
    return {
      kbId: kbId || '(mock)',
      jumlahDokumen: daftar.jumlah,
      ringkasan: daftar.dokumen.map((d) => d.nama).join('; '),
      catatan:
        'Provider RAG sedang mode "mock": profil instansi tidak bisa dibaca dari dokumen nyata.',
    };
  }

  async probe(): Promise<{
    latencyMs: number;
    canOutputJson: boolean;
    hasMetadata: boolean;
    sampleChunksCount: number;
    detectedMode: 'Jalur A' | 'Jalur B';
  }> {
    const start = Date.now();
    await new Promise((r) => setTimeout(r, 120));
    const latencyMs = Date.now() - start;

    // Hitung potongan dokumen nyata dari kumpulan data mock (bukan angka statis).
    const sampleChunks = MOCK_CHUNKS.filter((c) => c.sector === 'pdam');
    const isA = this.defaultMode === 'structured';
    return {
      latencyMs,
      canOutputJson: isA,
      hasMetadata: sampleChunks.length > 0,
      sampleChunksCount: sampleChunks.length,
      detectedMode: isA ? 'Jalur A' : 'Jalur B',
    };
  }

  async query(options: RagQueryOptions): Promise<RagResult> {
    const start = Date.now();
    const mode = options.mode || this.defaultMode;
    const sector = options.sector || 'pdam';

    // Filter relevant document chunks by sector (or fallback)
    let chunks = MOCK_CHUNKS.filter((c) => c.sector === sector);
    if (chunks.length === 0) {
      chunks = MOCK_CHUNKS.slice(0, 4);
    }

    const citations: Citation[] = chunks.map((c, idx) => ({
      id: `cit-${c.id}`,
      docName: c.docName,
      page: c.page,
      chunkSnippet: c.snippet,
      confidenceScore: 0.94 + (idx % 5) * 0.01,
      date: c.date,
      unitKerja: c.metadata.unitKerja,
      metric: c.metadata.metric,
    }));

    // Simulating slight realistic retrieval latency
    await new Promise((r) => setTimeout(r, 200));
    const latencyMs = Date.now() - start;

    if (mode === 'structured') {
      // JALUR A: Returns synthesized structured JSON widgets
      const structuredJson = this.generateSectorStructuredJson(sector, options.prompt, citations, chunks);
      return {
        provider: 'mock',
        mode: 'Jalur A',
        latencyMs,
        structuredJson,
        chunks,
        citations,
      };
    } else {
      // JALUR B: Retrieval chunks + metadata with prose only
      const answer = chunks
        .map((c) => `[${c.docName} Hal. ${c.page}] ${c.snippet}`)
        .join('\n\n');

      return {
        provider: 'mock',
        mode: 'Jalur B',
        latencyMs,
        answer,
        chunks,
        citations,
      };
    }
  }

  private generateSectorStructuredJson(
    sector: BumdSector,
    prompt: string,
    citations: Citation[],
    chunks: SectorDocumentChunk[] = []
  ): { dashboardTitle: string; description: string; sector: BumdSector; widgets: WidgetSpec[] } {
    const cit1 = citations[0] ? [citations[0]] : [];
    const cit2 = citations[1] ? [citations[1]] : cit1;
    const cit3 = citations[2] ? [citations[2]] : cit1;

    switch (sector) {
      case 'pdam':
        return {
          dashboardTitle: 'Dashboard Eksekutif Kinerja & Distribusi Air PDAM 2026',
          description: 'Sintesis otomatis dari LRA Triwulan I, Laporan Teknis Distribusi, dan Evaluasi Bappeda.',
          sector: 'pdam',
          widgets: [
            {
              id: 'w-pdam-kpi-rev',
              presetId: 'W-01',
              type: 'kpi',
              title: 'Realisasi Pendapatan Air TW1',
              subtitle: 'vs Target RKAP Rp 40,0 M',
              category: 'Keuangan',
              confidence: 'sumber',
              grid: { x: 0, y: 0, w: 4, h: 3 },
              kpi: {
                value: 'Rp 42,85 M',
                unit: 'Rupiah',
                delta: 107.1,
                deltaLabel: '107,1% dari target RKAP',
                target: 40.0,
                targetLabel: 'Target: Rp 40,0 M',
                sparkline: [36, 38, 39, 41, 42.85],
              },
              citations: cit1,
              periode: '2026-Q1',
              unitKerja: 'Kantor Pusat',
            },
            {
              id: 'w-pdam-kpi-nrw',
              presetId: 'P-01',
              type: 'kpi',
              title: 'Tingkat Kehilangan Air (NRW)',
              subtitle: 'Ambang Batas Nasional: < 25%',
              category: 'Operasional',
              confidence: 'sumber',
              grid: { x: 4, y: 0, w: 4, h: 3 },
              kpi: {
                value: '22,4%',
                unit: '%',
                delta: -3.7,
                deltaLabel: 'Turun 3,7% dibanding Des 2025',
                target: 20.0,
                targetLabel: 'Target: 20,0%',
                sparkline: [27.2, 26.5, 26.1, 24.0, 22.4],
              },
              citations: cit2,
              periode: '2026-Q1',
              unitKerja: 'Divisi Transmisi & Distribusi',
            },
            {
              id: 'w-pdam-kpi-billing',
              presetId: 'P-03',
              type: 'kpi',
              title: 'Efisiensi Penagihan Rekening',
              subtitle: 'Target Minimal: 92,0%',
              category: 'Keuangan',
              confidence: 'sumber',
              grid: { x: 8, y: 0, w: 4, h: 3 },
              kpi: {
                value: '94,8%',
                unit: '%',
                delta: 2.8,
                deltaLabel: '+2,8% vs target',
                target: 92.0,
                targetLabel: 'Target: 92,0%',
                sparkline: [91, 92.5, 93, 94.2, 94.8],
              },
              citations: cit3,
              periode: '2026-Q1',
              unitKerja: 'Divisi Hubungan Langganan',
            },
            {
              id: 'w-pdam-chart-prod',
              presetId: 'P-02',
              type: 'area',
              title: 'Tren Volume Produksi vs Air Terdistribusi (12 Bulan)',
              subtitle: 'Satuan: Juta m³ per bulan',
              category: 'Operasional',
              confidence: 'sumber',
              grid: { x: 0, y: 3, w: 8, h: 5 },
              chart: {
                xAxis: MONTHS_12,
                series: [
                  {
                    name: 'Produksi IPA',
                    data: [5.8, 5.9, 6.1, 6.0, 6.2, 6.1, 6.3, 6.2, 6.4, 6.1, 6.1, 6.25],
                    color: '#38c6e2',
                  },
                  {
                    name: 'Air Terdistribusi & Terjual',
                    data: [4.2, 4.3, 4.5, 4.4, 4.6, 4.6, 4.8, 4.7, 4.9, 4.7, 4.8, 4.85],
                    color: '#2bb8a8',
                  },
                ],
                unit: 'Juta m³',
                showLegend: true,
              },
              citations: cit1.concat(cit2),
              periode: '2026-FY',
              unitKerja: 'Divisi Produksi & Jaringan',
            },
            {
              id: 'w-pdam-donut-sl',
              presetId: 'P-04',
              type: 'donut',
              title: 'Komposisi Sambungan Langganan (SL)',
              subtitle: 'Total: 148.650 Pelanggan Aktif',
              category: 'Pelayanan',
              confidence: 'sumber',
              grid: { x: 8, y: 3, w: 4, h: 5 },
              chart: {
                xAxis: ['Rumah Tangga', 'Niaga & Usaha', 'Industri Besar', 'Sosial & Instansi'],
                series: [
                  {
                    name: 'Pelanggan',
                    data: [118500, 19200, 4150, 6800],
                    color: '#38c6e2',
                  },
                ],
                unit: 'SL',
              },
              citations: cit3,
              periode: '2026-Q1',
              unitKerja: 'Divisi Hubungan Langganan',
            },
            {
              id: 'w-pdam-narasi',
              presetId: 'W-07',
              type: 'narasi',
              title: 'Ringkasan Eksekutif & Telaah Dewan Pengawas',
              category: 'Kepatuhan & Risiko',
              confidence: 'inferensi AI',
              grid: { x: 0, y: 8, w: 12, h: 3 },
              narasi: {
                text: 'Kinerja PDAM Tirta Kencana pada Triwulan I 2026 berada pada kondisi SEHAT. Realisasi pendapatan melampaui RKAP sebesar 7,1%, dipicu penambahan 3.200 pelanggan baru di Zona Timur. Program penurunan NRW berhasil memangkas kebocoran dari 26,1% ke 22,4%. Rekomendasi: percepat penggantian pipa segmen DMA-06 dan digitalisasi billing meter di Wilayah Barat.',
                bulletPoints: [
                  'NRW 22,4% (dibawah batas ambang nasional 25%).',
                  'Efisiensi penagihan 94,8% mengamankan likuiditas operasional.',
                  'Penyelesaian pipa asbes primer DMA-04 sepanjang 4,2 km telah rampung.',
                ],
              },
              citations: citations,
              periode: '2026-Q1',
            },
          ],
        };

      case 'bank':
        return {
          dashboardTitle: 'Dashboard Kinerja Keuangan & Rasio Prudensial Bank Daerah',
          description: 'Monitoring NPL, DPK, Penyaluran Kredit UMKM, dan Likuiditas LDR Triwulan I 2026.',
          sector: 'bank',
          widgets: [
            {
              id: 'w-bank-kpi-npl',
              presetId: 'B-01',
              type: 'kpi',
              title: 'Rasio NPL Gross',
              subtitle: 'Batas Maksimum OJK: 5,0%',
              category: 'Kepatuhan & Risiko',
              confidence: 'sumber',
              grid: { x: 0, y: 0, w: 4, h: 3 },
              kpi: {
                value: '2,42%',
                unit: '%',
                delta: -0.18,
                deltaLabel: 'Membaik -0,18% YoY',
                target: 2.5,
                targetLabel: 'Plafon: < 3,0%',
                sparkline: [2.8, 2.7, 2.6, 2.55, 2.42],
              },
              citations: cit1,
              periode: '2026-Q1',
              unitKerja: 'Divisi Manajemen Risiko',
            },
            {
              id: 'w-bank-kpi-kredit',
              presetId: 'B-02',
              type: 'kpi',
              title: 'Total Portofolio Kredit',
              subtitle: 'Porsi UMKM: 38,2%',
              category: 'Operasional',
              confidence: 'sumber',
              grid: { x: 4, y: 0, w: 4, h: 3 },
              kpi: {
                value: 'Rp 18,75 T',
                unit: 'Triliun Rp',
                delta: 10.8,
                deltaLabel: '+10,8% Pertumbuhan YoY',
                target: 18.2,
                targetLabel: 'Target: Rp 18,2 T',
                sparkline: [16.8, 17.2, 17.6, 18.1, 18.75],
              },
              citations: cit2,
              periode: '2026-Q1',
              unitKerja: 'Divisi Kredit UMKM',
            },
            {
              id: 'w-bank-kpi-dpk',
              presetId: 'B-03',
              type: 'kpi',
              title: 'Dana Pihak Ketiga (DPK)',
              subtitle: 'LDR: 83,7% (Optimal)',
              category: 'Keuangan',
              confidence: 'sumber',
              grid: { x: 8, y: 0, w: 4, h: 3 },
              kpi: {
                value: 'Rp 22,40 T',
                unit: 'Triliun Rp',
                delta: 8.4,
                deltaLabel: '+8,4% Pertumbuhan DPK',
                sparkline: [20.5, 20.9, 21.3, 21.9, 22.4],
              },
              citations: cit3,
              periode: '2026-Q1',
              unitKerja: 'Divisi Tresuri & Dana',
            },
            {
              id: 'w-bank-chart-kredit',
              presetId: 'B-02',
              type: 'bar',
              title: 'Komposisi Penyaluran Kredit per Sektor Usaha',
              subtitle: 'Satuan: Triliun Rupiah',
              category: 'Operasional',
              confidence: 'sumber',
              grid: { x: 0, y: 3, w: 8, h: 5 },
              chart: {
                xAxis: ['Kredit Konsumtif ASN', 'UMKM & Mikro', 'Konstruksi & Infrastruktur', 'Perdagangan Pasar', 'Pertanian & Perikanan'],
                series: [
                  {
                    name: 'Realisasi TW1 2026',
                    data: [7.2, 5.8, 2.9, 1.85, 1.0],
                    color: '#5b9bd5',
                  },
                  {
                    name: 'Target RKAP',
                    data: [7.0, 5.5, 3.1, 1.7, 0.9],
                    color: '#8f90e4',
                  },
                ],
                unit: 'Triliun Rp',
                showLegend: true,
              },
              citations: cit2,
              periode: '2026-Q1',
              unitKerja: 'Seluruh Cabang',
            },
            {
              id: 'w-bank-ratios-table',
              presetId: 'B-05',
              type: 'table',
              title: 'Matriks Rasio Keuangan Utama (Triwulanan)',
              subtitle: 'Standar Kepatuhan OJK & BI',
              category: 'Kepatuhan & Risiko',
              confidence: 'sumber',
              grid: { x: 8, y: 3, w: 4, h: 5 },
              table: {
                columns: [
                  { key: 'rasio', label: 'Indikator Rasio' },
                  { key: 'aktual', label: 'Aktual' },
                  { key: 'standar', label: 'Batas Aman' },
                ],
                rows: [
                  { rasio: 'CAR (Kecukupan Modal)', aktual: '24,1%', standar: '> 14%' },
                  { rasio: 'LDR (Likuiditas)', aktual: '83,7%', standar: '78% - 92%' },
                  { rasio: 'BOPO (Efisiensi)', aktual: '74,6%', standar: '< 85%' },
                  { rasio: 'NIM (Marjin Bunga)', aktual: '5,8%', standar: '> 4,5%' },
                  { rasio: 'ROA (Return on Asset)', aktual: '2,6%', standar: '> 1,5%' },
                ],
              },
              citations: cit1.concat(cit3),
              periode: '2026-Q1',
            },
          ],
        };

      default:
        // Default sector synthesis (Pasar, RSUD, Transportasi, Aneka Usaha)
        return {
          dashboardTitle: `Dashboard Otomatis Sektor ${sector.toUpperCase()} BUMD`,
          description: `Disintesis langsung dari data retrieval dokumen resmi pemerintah daerah sektor ${sector}.`,
          sector,
          widgets: [
            {
              id: `w-${sector}-kpi-1`,
              presetId: 'W-01',
              type: 'kpi',
              title: 'Capaian Kinerja Utama TW1',
              subtitle: 'Indikator Utama BUMD',
              category: 'Operasional',
              confidence: 'sumber',
              grid: { x: 0, y: 0, w: 4, h: 3 },
              kpi: {
                value: chunks[0]?.metadata.nilai ? `${chunks[0].metadata.nilai} ${chunks[0].metadata.satuan}` : '88.5%',
                unit: chunks[0]?.metadata.satuan || '%',
                delta: 5.2,
                deltaLabel: '+5,2% vs Target',
                sparkline: [80, 82, 85, 87, 88.5],
              },
              citations: cit1,
              periode: '2026-Q1',
              unitKerja: 'Kantor Pusat',
            },
            {
              id: `w-${sector}-chart-trend`,
              presetId: 'W-02',
              type: 'line',
              title: 'Tren Capaian 12 Bulan Terakhir',
              subtitle: 'Evaluasi Tren Konsistensi',
              category: 'Keuangan',
              confidence: 'sumber',
              grid: { x: 4, y: 0, w: 8, h: 4 },
              chart: {
                xAxis: MONTHS_12,
                series: [
                  {
                    name: 'Realisasi Bulanan',
                    data: [42, 45, 48, 47, 50, 52, 53, 51, 55, 54, 56, 58],
                    color: '#38c6e2',
                  },
                ],
              },
              citations: cit1.concat(cit2),
              periode: '2026-FY',
            },
            {
              id: `w-${sector}-narasi`,
              presetId: 'W-07',
              type: 'narasi',
              title: 'Ringkasan RAG Eksekutif',
              category: 'Kepatuhan & Risiko',
              confidence: 'inferensi AI',
              grid: { x: 0, y: 4, w: 12, h: 3 },
              narasi: {
                text: chunks.map((c) => c.snippet).join(' '),
              },
              citations: citations,
              periode: '2026-Q1',
            },
          ],
        };
    }
  }
}

export const mockRag = new MockRagClient();
