/**
 * Evaluasi aturan ambang batas (alert) terhadap nilai indikator dari dokumen.
 *
 * Prinsipnya jujur: aturan hanya menyala kalau nilai indikator yang benar-benar
 * ada di dokumen melanggar ambang. Kalau dokumen tidak memuat indikator tersebut,
 * aturan TIDAK dipicu dan alasannya dilaporkan — tidak ada notifikasi karangan.
 *
 * Sumber nilai saat ini: metadata chunk dokumen (`MOCK_CHUNKS`). Setelah integrasi
 * API RAG asli, ganti `nilaiIndikator()` agar membaca chunk hasil retrieval.
 */
import { AlertRule, BumdSector, NotificationItem } from '../types';
import { MOCK_CHUNKS } from './rag/mockData';

export interface NilaiIndikator {
  metric: string;
  nilai: number;
  satuan: string;
  unitKerja: string;
  docName: string;
  page: number;
}

export type HasilEvaluasi =
  | { status: 'terlampaui'; indikator: NilaiIndikator }
  | { status: 'aman'; indikator: NilaiIndikator }
  | { status: 'tanpa-data'; alasan: string };

const normal = (teks: string) => teks.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Cari nilai indikator untuk sebuah aturan dari metadata dokumen sektor terkait.
 * Pencocokan dua arah antara `metricKey`/`metricName` aturan dan `metadata.metric`
 * dokumen — supaya "npl" cocok dengan "Rasio NPL Gross".
 */
export function nilaiIndikator(sector: BumdSector, rule: AlertRule): NilaiIndikator | null {
  const kunci = [normal(rule.metricKey || ''), normal(rule.metricName || '')].filter((k) => k.length >= 3);
  if (kunci.length === 0) return null;

  const chunk = MOCK_CHUNKS.find((c) => {
    if (c.sector !== sector) return false;
    const metric = normal(c.metadata.metric);
    return kunci.some((k) => metric.includes(k) || k.includes(metric));
  });
  if (!chunk) return null;

  return {
    metric: chunk.metadata.metric,
    nilai: chunk.metadata.nilai,
    satuan: chunk.metadata.satuan,
    unitKerja: chunk.metadata.unitKerja,
    docName: chunk.docName,
    page: chunk.page,
  };
}

export function bandingkan(nilai: number, operator: AlertRule['operator'], threshold: number): boolean {
  switch (operator) {
    case '>':
      return nilai > threshold;
    case '<':
      return nilai < threshold;
    case '>=':
      return nilai >= threshold;
    case '<=':
      return nilai <= threshold;
    default:
      return false;
  }
}

export function evaluasiAturan(rule: AlertRule, sector: BumdSector): HasilEvaluasi {
  const indikator = nilaiIndikator(sector, rule);
  if (!indikator) {
    return {
      status: 'tanpa-data',
      alasan: 'Dokumen sektor ini tidak memuat indikator untuk aturan tersebut.',
    };
  }
  return bandingkan(indikator.nilai, rule.operator, rule.threshold)
    ? { status: 'terlampaui', indikator }
    : { status: 'aman', indikator };
}

/**
 * Susun notifikasi in-app untuk aturan yang terlampaui. Fungsi murni — tidak
 * menyentuh DB. `sentEmail` selalu false di sini: hanya mailer yang boleh
 * menaikkannya setelah SMTP benar-benar menerima email.
 */
export function buatNotifikasi(
  rule: AlertRule,
  tenantId: string,
  indikator: NilaiIndikator,
  waktu = new Date().toISOString()
): NotificationItem {
  return {
    id: `notif-${Date.now()}-${rule.id}`,
    tenantId,
    alertRuleId: rule.id,
    title: `${indikator.metric} melampaui ambang: ${indikator.nilai} ${indikator.satuan}`,
    message:
      `Nilai terpantau ${indikator.nilai} ${indikator.satuan} melanggar ambang ` +
      `${rule.operator} ${rule.threshold} ${rule.unit} pada ${indikator.unitKerja}. ` +
      `Sumber: ${indikator.docName} hal. ${indikator.page}.`,
    severity: rule.severity,
    timestamp: waktu,
    isRead: false,
    metricValue: indikator.nilai,
    threshold: rule.threshold,
    sentEmail: false,
  };
}
