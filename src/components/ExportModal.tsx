import React, { useRef } from 'react';
import {
  BookOpen,
  Code,
  Download,
  FileText,
  Printer,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Dashboard, Tenant } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dashboard: Dashboard | null;
  tenant: Tenant | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  dashboard,
  tenant,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !dashboard) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dashboard, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${dashboard.title.replace(/\s+/g, '_')}_Spec.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Compile all citations across widgets
  const allCitations = dashboard.widgets.flatMap((w) => w.citations || []);
  const uniqueCitations = Array.from(
    new Map(allCitations.map((c) => [`${c.docName}-${c.page}`, c])).values()
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-scrim/50 backdrop-blur-xs" onClick={onClose} />

      <div role="dialog" aria-modal="true" aria-labelledby="export-modal-title" className="relative w-full max-w-2xl bg-surface rounded-card shadow-2xl border border-line overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-line flex items-center justify-between bg-surface-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-control bg-ink flex items-center justify-center text-surface">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h2 id="export-modal-title" className="text-sm font-semibold text-ink">
                Laporan Eksekutif Resmi BUMD (Cetak & Ekspor)
              </h2>
              <p className="text-xs text-ink-2">Standar Dokumen Pertanggungjawaban Daerah</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-chip text-ink-3 hover:text-ink-2 hover:bg-line transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Preview Sheet */}
        <div className="flex-1 overflow-y-auto p-6 bg-surface-2/70">
          <div
            ref={printAreaRef}
            className="bg-surface p-8 rounded-card shadow-xs border border-line text-ink text-xs space-y-6"
          >
            {/* Kop Surat Resmi */}
            <div className="flex items-center justify-between border-b-2 border-ink pb-4">
              <div className="flex items-center gap-3">                  <span className="text-3xl" aria-hidden="true">{tenant?.logo || '🏛️'}</span>
                <div>
                  <h1 className="text-sm font-extrabold tracking-tight uppercase text-ink">
                    {tenant?.name || 'PEMERINTAH DAERAH, BADAN USAHA MILIK DAERAH'}
                  </h1>
                  <p className="text-[11px] text-ink-2 font-medium">
                    Sistem Pemantauan Kinerja & Data Terintegrasi Aiones Boards • {tenant?.city || 'Indonesia'}
                  </p>
                </div>
              </div>
              <div className="text-right text-[10px] text-ink-2">
                <p>Dokumen Rahasia / Eksekutif</p>
                <p className="font-semibold text-ink-2">Kode: {tenant?.code || 'BUMD-01'}</p>
              </div>
            </div>

            {/* Title & Metadata */}
            <div>
              <h2 className="text-base font-bold text-ink">{dashboard.title}</h2>
              <p className="text-ink-2 mt-1 leading-relaxed">{dashboard.description}</p>
              <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-line text-[11px] text-ink-2">
                <span>Periode: <strong className="text-ink">{dashboard.globalFilters.periode}</strong></span>
                <span>Unit: <strong className="text-ink">{dashboard.globalFilters.unitKerja}</strong></span>
                <span>Kategori: <strong className="text-ink">{dashboard.globalFilters.kategori}</strong></span>
                <span>Tanggal Cetak: <strong className="text-ink">{new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</strong></span>
              </div>
            </div>

            {/* Metrics Overview Table */}
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-ink-2 mb-2">
                1. Rekapitulasi Indikator Utama
              </h3>
              <table className="w-full text-left border border-line">
                <thead className="bg-surface-2 border-b border-line text-ink-2 font-semibold">
                  <tr>
                    <th className="p-2">No</th>
                    <th className="p-2">Nama Indikator</th>
                    <th className="p-2">Tipe</th>
                    <th className="p-2">Nilai Capaian</th>
                    <th className="p-2">Tingkat Kepercayaan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {dashboard.widgets.map((w, idx) => (
                    <tr key={w.id}>
                      <td className="p-2 text-ink-3">{idx + 1}</td>
                      <td className="p-2 font-medium">{w.title}</td>
                      <td className="p-2 uppercase text-[10px] text-ink-2">{w.type}</td>
                      <td className="p-2 font-bold text-ink">
                        {String(w.kpi?.value ?? w.chart?.series[0]?.data.slice(-1)[0] ?? '-')} {w.kpi?.unit || ''}
                      </td>
                      <td className="p-2">
                        {/* Tanpa label provenans (mis. "Inferensi AI"): hanya penanda koreksi manual. */}
                        {w.manualCorrection?.isCorrected ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-warn/15 text-warn">
                            Dikoreksi Manual
                          </span>
                        ) : w.confidence === 'sumber' ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-pos/15 text-pos">
                            Dokumen Resmi
                          </span>
                        ) : (
                          <span className="text-ink-3">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Citation Bibliography */}
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-ink-2 mb-2 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-brand" />
                <span>2. Lampiran Sitasi & Sumber Dokumen Resmi</span>
              </h3>
              <ul className="space-y-2 border border-line rounded-control p-3 bg-surface-2/50">
                {uniqueCitations.map((c, i) => (
                  <li key={i} className="text-[11px] text-ink-2 leading-relaxed">
                    <strong>[{i + 1}]</strong> Berkas: <span className="font-semibold text-ink">{c.docName}</span> (Halaman: {c.page}, Terbit: {c.date}).
                    <span className="italic text-ink-2 block pl-4 mt-0.5">"{c.chunkSnippet}"</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Signature Block */}
            <div className="pt-6 flex justify-between text-center text-ink-2">
              <div>
                <p className="text-[11px] text-ink-2">Disiapkan Oleh:</p>
                <div className="h-12" />
                <p className="font-bold underline">Siti Rahmawati, S.E.</p>
                <p className="text-[10px] text-ink-3">Analis Data & Kinerja BUMD</p>
              </div>
              <div>
                <p className="text-[11px] text-ink-2">Mengetahui & Menyetujui:</p>
                <div className="h-12" />
                <p className="font-bold underline">Dewan Direksi / Pengawas</p>
                <p className="text-[10px] text-ink-3">Ketua Tim Pengarah</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-line bg-surface-2 flex items-center justify-between">
          <button
            onClick={handleDownloadJson}
            className="px-3 py-2 border border-line rounded-control text-ink-2 hover:bg-surface-2 text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <Code className="w-3.5 h-3.5" />
            <span>Unduh JSON Spec</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-line rounded-control text-ink-2 hover:bg-surface-2 text-xs font-medium transition-colors"
            >
              Tutup
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 bg-brand hover:bg-brand-ink text-on-brand rounded-control text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / Simpan PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
