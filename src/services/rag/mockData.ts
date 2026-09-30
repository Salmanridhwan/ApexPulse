import { BumdSector, Citation } from '../../types';

export interface SectorDocumentChunk {
  id: string;
  sector: BumdSector;
  docName: string;
  page: number;
  date: string;
  snippet: string;
  metadata: {
    periode: string;
    kategori: 'Keuangan' | 'Operasional' | 'Pelayanan' | 'Kepatuhan & Risiko';
    unitKerja: string;
    metric: string;
    nilai: number;
    satuan: string;
    target?: number;
  };
}

export const MOCK_CHUNKS: SectorDocumentChunk[] = [
  // ================= PDAM (Tirta Kencana) =================
  {
    id: 'pdam-c1',
    sector: 'pdam',
    docName: 'LRA_PDAM_Tirta_Kencana_TW1_2026.pdf',
    page: 12,
    date: '2026-03-31',
    snippet: 'Realisasi pendapatan penjualan air pada Triwulan I 2026 tercatat sebesar Rp 42,85 Miliar dari target RKAP TW1 sebesar Rp 40,00 Miliar (capaian 107,1%). Peningkatan didorong penyesuaian tarif blok niaga dan penambahan 3.200 Sambungan Langganan baru di Zona Timur.',
    metadata: {
      periode: '2026-Q1',
      kategori: 'Keuangan',
      unitKerja: 'Kantor Pusat & Wilayah Timur',
      metric: 'Pendapatan Air',
      nilai: 42.85,
      satuan: 'Miliar Rp',
      target: 40.0,
    },
  },
  {
    id: 'pdam-c2',
    sector: 'pdam',
    docName: 'Laporan_Teknis_Distribusi_Maret_2026.pdf',
    page: 28,
    date: '2026-03-25',
    snippet: 'Tingkat kehilangan air (Non-Revenue Water / NRW) bulan Maret 2026 berhasil ditekan menjadi 22,4% dari sebelumnya 26,1% pada Desember 2025. Penurunan signifikan terjadi berkat penggantian pipa asbes primer di DMA-04 sepanjang 4,2 km.',
    metadata: {
      periode: '2026-Q1',
      kategori: 'Operasional',
      unitKerja: 'Divisi Transmisi & Distribusi',
      metric: 'Tingkat NRW',
      nilai: 22.4,
      satuan: '%',
      target: 20.0,
    },
  },
  {
    id: 'pdam-c3',
    sector: 'pdam',
    docName: 'Evaluasi_Kinerja_BUMD_Bappeda_2026.pdf',
    page: 45,
    date: '2026-04-05',
    snippet: 'Efisiensi penagihan (Collection Efficiency) rekening air mencapai 94,8% pada akhir Maret 2026. Total sambungan aktif terlayani mencapai 148.650 SL dengan tingkat kepuasan pelanggan 84,2 poin.',
    metadata: {
      periode: '2026-Q1',
      kategori: 'Keuangan',
      unitKerja: 'Divisi Hubungan Langganan',
      metric: 'Efisiensi Penagihan',
      nilai: 94.8,
      satuan: '%',
      target: 92.0,
    },
  },
  {
    id: 'pdam-c4',
    sector: 'pdam',
    docName: 'Laporan_Produksi_IPA_2026.pdf',
    page: 8,
    date: '2026-03-30',
    snippet: 'Total volume produksi air bersih di 4 Instalasi Pengolahan Air (IPA) selama Q1 2026 adalah 18,45 juta m³, sementara volume air terdistribusi dan tertagih adalah 14,32 juta m³.',
    metadata: {
      periode: '2026-Q1',
      kategori: 'Operasional',
      unitKerja: 'Divisi Produksi IPA',
      metric: 'Volume Produksi Air',
      nilai: 18.45,
      satuan: 'Juta m³',
    },
  },

  // ================= PASAR RAKYAT (Pasar Sejahtera) =================
  {
    id: 'pasar-c1',
    sector: 'pasar',
    docName: 'Laporan_Tahunan_Perumda_Pasar_2025_2026.pdf',
    page: 19,
    date: '2026-03-20',
    snippet: 'Tingkat okupansi lapak dan kios di 14 unit pasar tradisional mencapai 86,4% dengan total 8.420 pedagang aktif. Penerimaan e-retribusi harian meningkat menjadi rata-rata Rp 48,6 Juta per hari setelah digitalisasi QRIS.',
    metadata: {
      periode: '2026-Q1',
      kategori: 'Operasional',
      unitKerja: 'Seluruh Unit Pasar',
      metric: 'Okupansi Kios',
      nilai: 86.4,
      satuan: '%',
      target: 85.0,
    },
  },
  {
    id: 'pasar-c2',
    sector: 'pasar',
    docName: 'Rekapitulasi_TPID_Pangan_Maret_2026.pdf',
    page: 4,
    date: '2026-03-28',
    snippet: 'Indeks stabilitas komoditas pangan pokok: Beras Medium stabil pada Rp 13.500/kg, Cabai Rawit Merah Rp 42.000/kg (turun 8%), dan Daging Ayam Broiler Rp 36.500/kg. Pasokan terpantau lancar dari sentra produsen daerah.',
    metadata: {
      periode: '2026-Q1',
      kategori: 'Pelayanan',
      unitKerja: 'Divisi Ketahanan Pangan Pasar',
      metric: 'Stabilitas Pangan',
      nilai: 92.5,
      satuan: 'Indeks Skor',
    },
  },
  {
    id: 'pasar-c3',
    sector: 'pasar',
    docName: 'LRA_Pendapatan_Pasar_TW1_2026.pdf',
    page: 11,
    date: '2026-04-02',
    snippet: 'Total penerimaan sewa tempat dasaran dan retribusi kebersihan mencapai Rp 6,84 Miliar pada TW1 2026, mencapai 103,6% dari target proporsional semesteran.',
    metadata: {
      periode: '2026-Q1',
      kategori: 'Keuangan',
      unitKerja: 'Bagian Keuangan & Retribusi',
      metric: 'Realisasi Retribusi',
      nilai: 6.84,
      satuan: 'Miliar Rp',
      target: 6.6,
    },
  },

  // ================= BANK DAERAH (Bank Artha Daerah) =================
  {
    id: 'bank-c1',
    sector: 'bank',
    docName: 'Laporan_Keuangan_Publikasi_BPD_TW1_2026.pdf',
    page: 3,
    date: '2026-03-31',
    snippet: 'Rasio kredit bermasalah Non-Performing Loan (NPL) Gross tercatat 2,42% (NPL Net 0,88%), berada di bawah batas ambang regulasi OJK 5,0%. Cadangan kerugian penurunan nilai (CKPN) coverage terjaga di 165%.',
    metadata: {
      periode: '2026-Q1',
      kategori: 'Kepatuhan & Risiko',
      unitKerja: 'Divisi Manajemen Risiko & Kredit',
      metric: 'Rasio NPL Gross',
      nilai: 2.42,
      satuan: '%',
      target: 2.5,
    },
  },
  {
    id: 'bank-c2',
    sector: 'bank',
    docName: 'Laporan_Kinerja_Penyaluran_Kredit_2026.pdf',
    page: 16,
    date: '2026-03-31',
    snippet: 'Total portofolio kredit mencapai Rp 18,75 Triliun (tumbuh 10,8% YoY). Penyaluran kredit produktif UMKM porsi mencapai 38,2% melampaui target minimum regulator daerah.',
    metadata: {
      periode: '2026-Q1',
      kategori: 'Operasional',
      unitKerja: 'Divisi Kredit UMKM & Ritel',
      metric: 'Penyaluran Kredit',
      nilai: 18.75,
      satuan: 'Triliun Rp',
      target: 18.2,
    },
  },
  {
    id: 'bank-c3',
    sector: 'bank',
    docName: 'Laporan_Kinerja_Publikasi_BPD_TW1_2026.pdf',
    page: 7,
    date: '2026-03-31',
    snippet: 'Dana Pihak Ketiga (DPK) terhimpun Rp 22,40 Triliun dengan rasio LDR sebesar 83,7%. Rasio BOPO berada pada level efisien 74,6% dan Rasio Kecukupan Modal (CAR) sebesar 24,1%. Laba bersih berjalan tercatat Rp 248,5 Miliar.',
    metadata: {
      periode: '2026-Q1',
      kategori: 'Keuangan',
      unitKerja: 'Divisi Tresuri & Akuntansi',
      metric: 'DPK & Laba',
      nilai: 22.4,
      satuan: 'Triliun Rp',
    },
  },

  // ================= RSUD (RSUD Sehat Madani) =================
  {
    id: 'rsud-c1',
    sector: 'rsud',
    docName: 'Laporan_Mutu_Pelayanan_RSUD_TW1_2026.pdf',
    page: 22,
    date: '2026-03-31',
    snippet: 'Tingkat keterisian tempat tidur (Bed Occupancy Rate / BOR) rawat inap sebesar 78,5% dari total 450 bed terpasang, dalam rentang standar ideal Kementerian Kesehatan (60% - 85%). Rata-rata hari rawat (ALOS) 4,2 hari.',
    metadata: {
      periode: '2026-Q1',
      kategori: 'Operasional',
      unitKerja: 'Bidang Keperawatan & Pelayanan Medik',
      metric: 'BOR Rawat Inap',
      nilai: 78.5,
      satuan: '%',
      target: 75.0,
    },
  },
  {
    id: 'rsud-c2',
    sector: 'rsud',
    docName: 'LRA_BLUD_RSUD_TW1_2026.pdf',
    page: 14,
    date: '2026-04-01',
    snippet: 'Realisasi pendapatan fungsional layanan rumah sakit BLUD mencapai Rp 54,20 Miliar. Komposisi penjamin pasien: BPJS Kesehatan 82,4%, Umum Mandiri 13,8%, dan Asuransi Swasta/Perusahaan 3,8%.',
    metadata: {
      periode: '2026-Q1',
      kategori: 'Keuangan',
      unitKerja: 'Bagian Keuangan & Klaim BPJS',
      metric: 'Pendapatan BLUD',
      nilai: 54.2,
      satuan: 'Miliar Rp',
      target: 50.0,
    },
  },
  {
    id: 'rsud-c3',
    sector: 'rsud',
    docName: 'Laporan_Waktu_Tunggu_Farmasi_Maret_2026.pdf',
    page: 6,
    date: '2026-03-29',
    snippet: 'Waktu tunggu obat racikan tercatat rata-rata 38 menit (standar < 60 menit) dan obat non-racik rata-rata 18 menit (standar < 30 menit). Kepuasan pasien rawat jalan mencapai 88,1%.',
    metadata: {
      periode: '2026-Q1',
      kategori: 'Pelayanan',
      unitKerja: 'Instalasi Farmasi',
      metric: 'Waktu Tunggu Obat',
      nilai: 18.0,
      satuan: 'Menit',
    },
  },

  // ================= TRANSPORTASI (Trans Metro Daerah) =================
  {
    id: 'trans-c1',
    sector: 'transportasi',
    docName: 'Laporan_Operasional_Trans_Metro_TW1_2026.pdf',
    page: 9,
    date: '2026-03-31',
    snippet: 'Load Factor penumpang koridor utama mencapai rata-rata 74,2% dengan tingkat On-Time Performance (OTP) 92,6%. Total keterangkutan kuartal ini menembus 2,84 juta penumpang.',
    metadata: {
      periode: '2026-Q1',
      kategori: 'Operasional',
      unitKerja: 'Divisi Operasional & Kontrol Koridor',
      metric: 'Load Factor Armada',
      nilai: 74.2,
      satuan: '%',
      target: 70.0,
    },
  },
  {
    id: 'trans-c2',
    sector: 'transportasi',
    docName: 'Realisasi_PSO_Dishub_Maret_2026.pdf',
    page: 17,
    date: '2026-04-03',
    snippet: 'Realisasi penyerapan subsidi Public Service Obligation (PSO) Pemda adalah Rp 14,80 Miliar dengan perolehan pendapatan tiket non-tunai (farebox) Rp 8,52 Miliar.',
    metadata: {
      periode: '2026-Q1',
      kategori: 'Keuangan',
      unitKerja: 'Divisi Keuangan & Tiket',
      metric: 'Pendapatan Tiket (Farebox)',
      nilai: 8.52,
      satuan: 'Miliar Rp',
    },
  },

  // ================= ANEKA USAHA (Karya Mandiri) =================
  {
    id: 'aneka-c1',
    sector: 'aneka_usaha',
    docName: 'Laporan_Konsolidasi_Unit_Bisnis_2026.pdf',
    page: 15,
    date: '2026-03-31',
    snippet: 'Pendapatan konsolidasi empat unit usaha (Percetakan Daerah, Perhotelan Graha, Pengolahan Aspal, dan Cold Storage) membukukan pendapatan Rp 18,20 Miliar dengan margin laba kotor 22,4%.',
    metadata: {
      periode: '2026-Q1',
      kategori: 'Keuangan',
      unitKerja: 'Seluruh Unit Bisnis',
      metric: 'Pendapatan Usaha',
      nilai: 18.2,
      satuan: 'Miliar Rp',
      target: 17.5,
    },
  },
];

export const MONTHS_12 = ['Apr 25', 'Mei 25', 'Jun 25', 'Jul 25', 'Agu 25', 'Sep 25', 'Okt 25', 'Nov 25', 'Des 25', 'Jan 26', 'Feb 26', 'Mar 26'];
