import { BumdSector, Dashboard } from '../../types';
import { MONTHS_12 } from '../rag/mockData';

export function getFallbackDemoDashboard(sector: BumdSector, tenantId: string): Dashboard {
  const now = new Date().toISOString();

  const baseCitations = [
    {
      id: `fallback-cit-1`,
      docName: `Laporan_Eksekutif_${sector.toUpperCase()}_2026.pdf`,
      page: 1,
      chunkSnippet: `Capaian triwulan I 2026 telah diverifikasi oleh Badan Pengawasan Keuangan dan Pembangunan (BPKP) per tanggal 31 Maret 2026.`,
      confidenceScore: 1.0,
      date: '2026-03-31',
    },
  ];

  switch (sector) {
    case 'pdam':
      return {
        id: `dash-demo-pdam`,
        tenantId,
        title: 'Dashboard Eksekutif PDAM Tirta Kencana 2026',
        description: 'Snapshot resmi kinerja triwulan I: NRW, Efisiensi Penagihan, dan Volume Distribusi.',
        sector: 'pdam',
        globalFilters: { periode: '2026-Q1', unitKerja: 'Semua', kategori: 'Semua' },
        createdAt: now,
        updatedAt: now,
        widgets: [
          {
            id: 'fb-pdam-kpi-1',
            presetId: 'W-01',
            type: 'kpi',
            title: 'Pendapatan Air Bersih',
            subtitle: 'Target RKAP: Rp 40,0 M',
            category: 'Keuangan',
            confidence: 'sumber',
            grid: { x: 0, y: 0, w: 4, h: 3 },
            kpi: {
              value: 'Rp 42,85 M',
              unit: 'Rupiah',
              delta: 7.1,
              deltaLabel: '+7,1% Melampaui RKAP',
              sparkline: [38, 39, 41, 41.5, 42.85],
            },
            citations: baseCitations,
            periode: '2026-Q1',
          },
          {
            id: 'fb-pdam-kpi-2',
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
              deltaLabel: 'Turun 3,7% YoY (Membaik)',
              target: 20.0,
              sparkline: [26.1, 25.4, 24.2, 23.0, 22.4],
            },
            citations: baseCitations,
            periode: '2026-Q1',
          },
          {
            id: 'fb-pdam-kpi-3',
            presetId: 'P-03',
            type: 'kpi',
            title: 'Efisiensi Penagihan Rekening',
            subtitle: 'Kolektibilitas Tagihan Pelanggan',
            category: 'Keuangan',
            confidence: 'sumber',
            grid: { x: 8, y: 0, w: 4, h: 3 },
            kpi: {
              value: '94,8%',
              unit: '%',
              delta: 2.8,
              deltaLabel: '+2,8% vs Kuartal Lalu',
              sparkline: [91.2, 92.0, 93.1, 94.0, 94.8],
            },
            citations: baseCitations,
            periode: '2026-Q1',
          },
          {
            id: 'fb-pdam-chart-1',
            presetId: 'P-02',
            type: 'area',
            title: 'Tren Volume Produksi vs Air Terjual (12 Bulan)',
            subtitle: 'Juta m³ per Bulan',
            category: 'Operasional',
            confidence: 'sumber',
            grid: { x: 0, y: 3, w: 8, h: 5 },
            chart: {
              xAxis: MONTHS_12,
              series: [
                {
                  name: 'Produksi IPA',
                  data: [5.8, 5.9, 6.0, 6.1, 6.2, 6.1, 6.3, 6.2, 6.4, 6.1, 6.1, 6.25],
                  color: '#0284c7',
                },
                {
                  name: 'Air Terjual',
                  data: [4.2, 4.3, 4.5, 4.4, 4.6, 4.6, 4.8, 4.7, 4.9, 4.7, 4.8, 4.85],
                  color: '#10b981',
                },
              ],
              unit: 'Juta m³',
              showLegend: true,
            },
            citations: baseCitations,
            periode: '2026-FY',
          },
          {
            id: 'fb-pdam-donut-1',
            presetId: 'P-04',
            type: 'donut',
            title: 'Komposisi Pelanggan Aktif',
            subtitle: '148.650 Sambungan Terpasang',
            category: 'Pelayanan',
            confidence: 'sumber',
            grid: { x: 8, y: 3, w: 4, h: 5 },
            chart: {
              xAxis: ['Rumah Tangga', 'Niaga & Ritel', 'Industri', 'Sosial/Khusus'],
              series: [
                {
                  name: 'Pelanggan',
                  data: [118500, 19200, 4150, 6800],
                },
              ],
            },
            citations: baseCitations,
            periode: '2026-Q1',
          },
        ],
      };

    case 'bank':
      return {
        id: `dash-demo-bank`,
        tenantId,
        title: 'Dashboard Keuangan & Rasio Bank Daerah 2026',
        description: 'Monitoring NPL, DPK, BOPO, dan Penyaluran Kredit UMKM.',
        sector: 'bank',
        globalFilters: { periode: '2026-Q1', unitKerja: 'Semua', kategori: 'Semua' },
        createdAt: now,
        updatedAt: now,
        widgets: [
          {
            id: 'fb-bank-kpi-1',
            presetId: 'B-01',
            type: 'kpi',
            title: 'Rasio NPL Gross',
            subtitle: 'Batas Maks OJK: 5,0%',
            category: 'Kepatuhan & Risiko',
            confidence: 'sumber',
            grid: { x: 0, y: 0, w: 4, h: 3 },
            kpi: {
              value: '2,42%',
              unit: '%',
              delta: -0.18,
              deltaLabel: 'Membaik YoY',
              sparkline: [2.8, 2.7, 2.6, 2.5, 2.42],
            },
            citations: baseCitations,
            periode: '2026-Q1',
          },
          {
            id: 'fb-bank-kpi-2',
            presetId: 'B-02',
            type: 'kpi',
            title: 'Penyaluran Kredit',
            subtitle: 'Porsi UMKM: 38,2%',
            category: 'Operasional',
            confidence: 'sumber',
            grid: { x: 4, y: 0, w: 4, h: 3 },
            kpi: {
              value: 'Rp 18,75 T',
              unit: 'Triliun Rp',
              delta: 10.8,
              deltaLabel: '+10,8% Pertumbuhan YoY',
              sparkline: [16.8, 17.2, 17.8, 18.2, 18.75],
            },
            citations: baseCitations,
            periode: '2026-Q1',
          },
          {
            id: 'fb-bank-kpi-3',
            presetId: 'B-03',
            type: 'kpi',
            title: 'Dana Pihak Ketiga (DPK)',
            subtitle: 'LDR: 83,7%',
            category: 'Keuangan',
            confidence: 'sumber',
            grid: { x: 8, y: 0, w: 4, h: 3 },
            kpi: {
              value: 'Rp 22,40 T',
              unit: 'Triliun Rp',
              delta: 8.4,
              deltaLabel: '+8,4% Pertumbuhan DPK',
              sparkline: [20.2, 20.8, 21.4, 21.9, 22.4],
            },
            citations: baseCitations,
            periode: '2026-Q1',
          },
          {
            id: 'fb-bank-chart-1',
            presetId: 'B-02',
            type: 'bar',
            title: 'Portofolio Penyaluran Kredit per Sektor',
            subtitle: 'Satuan: Triliun Rupiah',
            category: 'Operasional',
            confidence: 'sumber',
            grid: { x: 0, y: 3, w: 8, h: 5 },
            chart: {
              xAxis: ['Konsumtif ASN', 'UMKM & Mikro', 'Konstruksi', 'Perdagangan', 'Pertanian'],
              series: [
                {
                  name: 'Realisasi TW1 2026',
                  data: [7.2, 5.8, 2.9, 1.85, 1.0],
                  color: '#3b82f6',
                },
                {
                  name: 'Target RKAP',
                  data: [7.0, 5.5, 3.1, 1.7, 0.9],
                  color: '#94a3b8',
                },
              ],
              showLegend: true,
            },
            citations: baseCitations,
            periode: '2026-Q1',
          },
          {
            id: 'fb-bank-table-1',
            presetId: 'B-05',
            type: 'table',
            title: 'Matriks Rasio Kesehatan Bank',
            category: 'Kepatuhan & Risiko',
            confidence: 'sumber',
            grid: { x: 8, y: 3, w: 4, h: 5 },
            table: {
              columns: [
                { key: 'rasio', label: 'Indikator' },
                { key: 'aktual', label: 'Aktual' },
                { key: 'standar', label: 'Standar OJK' },
              ],
              rows: [
                { rasio: 'CAR', aktual: '24,1%', standar: '> 14%' },
                { rasio: 'LDR', aktual: '83,7%', standar: '78% - 92%' },
                { rasio: 'BOPO', aktual: '74,6%', standar: '< 85%' },
                { rasio: 'NIM', aktual: '5,8%', standar: '> 4,5%' },
              ],
            },
            citations: baseCitations,
            periode: '2026-Q1',
          },
        ],
      };

    default:
      // Generic fallback for other sectors (Pasar, RSUD, Transportasi, Aneka Usaha)
      return {
        id: `dash-demo-${sector}`,
        tenantId,
        title: `Dashboard Eksekutif Sektor ${sector.toUpperCase()} BUMD`,
        description: `Snapshot tersimpan untuk menjamin kesiapan presentasi sektor ${sector}.`,
        sector,
        globalFilters: { periode: '2026-Q1', unitKerja: 'Semua', kategori: 'Semua' },
        createdAt: now,
        updatedAt: now,
        widgets: [
          {
            id: `fb-${sector}-kpi-1`,
            presetId: 'W-01',
            type: 'kpi',
            title: 'Realisasi Pendapatan Operasional',
            subtitle: 'Target Tercapai 104%',
            category: 'Keuangan',
            confidence: 'sumber',
            grid: { x: 0, y: 0, w: 4, h: 3 },
            kpi: {
              value: 'Rp 14,8 M',
              unit: 'Rupiah',
              delta: 8.5,
              deltaLabel: '+8,5% YoY',
              sparkline: [12.2, 12.8, 13.5, 14.1, 14.8],
            },
            citations: baseCitations,
            periode: '2026-Q1',
          },
          {
            id: `fb-${sector}-chart-1`,
            presetId: 'W-02',
            type: 'line',
            title: 'Kinerja Operasional Bulanan',
            category: 'Operasional',
            confidence: 'sumber',
            grid: { x: 4, y: 0, w: 8, h: 4 },
            chart: {
              xAxis: MONTHS_12,
              series: [
                {
                  name: 'Realisasi Bulanan',
                  data: [1.1, 1.15, 1.2, 1.18, 1.25, 1.3, 1.28, 1.35, 1.4, 1.42, 1.45, 1.5],
                  color: '#0284c7',
                },
              ],
            },
            citations: baseCitations,
            periode: '2026-FY',
          },
        ],
      };
  }
}
