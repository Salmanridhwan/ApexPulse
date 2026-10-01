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
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-white">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Laporan Eksekutif Resmi BUMD (Cetak & Ekspor)
              </h2>
              <p className="text-xs text-slate-500">Standar Dokumen Pertanggungjawaban Daerah</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Preview Sheet */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/70">
          <div
            ref={printAreaRef}
            className="bg-white p-8 rounded-xl shadow-xs border border-slate-200 text-slate-800 text-xs space-y-6"
          >
            {/* Kop Surat Resmi */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
              <div className="flex items-center gap-3">                  <span className="text-3xl" aria-hidden="true">{tenant?.logo || '🏛️'}</span>
                <div>
                  <h1 className="text-sm font-extrabold tracking-tight uppercase text-slate-900">
                    {tenant?.name || 'PEMERINTAH DAERAH — BADAN USAHA MILIK DAERAH'}
                  </h1>
                  <p className="text-[11px] text-slate-600 font-medium">
                    Sistem Pemantauan Kinerja & Data Terintegrasi ApexPulse • {tenant?.city || 'Indonesia'}
                  </p>
                </div>
              </div>
              <div className="text-right text-[10px] text-slate-500">
                <p>Dokumen Rahasia / Eksekutif</p>
                <p className="font-semibold text-slate-700">Kode: {tenant?.code || 'BUMD-01'}</p>
              </div>
            </div>

            {/* Title & Metadata */}
            <div>
              <h2 className="text-base font-bold text-slate-900">{dashboard.title}</h2>
              <p className="text-slate-600 mt-1 leading-relaxed">{dashboard.description}</p>
              <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                <span>Periode: <strong className="text-slate-800">{dashboard.globalFilters.periode}</strong></span>
                <span>Unit: <strong className="text-slate-800">{dashboard.globalFilters.unitKerja}</strong></span>
                <span>Kategori: <strong className="text-slate-800">{dashboard.globalFilters.kategori}</strong></span>
                <span>Tanggal Cetak: <strong className="text-slate-800">{new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</strong></span>
              </div>
            </div>

            {/* Metrics Overview Table */}
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2">
                1. Rekapitulasi Indikator Utama
              </h3>
              <table className="w-full text-left border border-slate-200">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-2">No</th>
                    <th className="p-2">Nama Indikator</th>
                    <th className="p-2">Tipe</th>
                    <th className="p-2">Nilai Capaian</th>
                    <th className="p-2">Tingkat Kepercayaan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dashboard.widgets.map((w, idx) => (
                    <tr key={w.id}>
                      <td className="p-2 text-slate-400">{idx + 1}</td>
                      <td className="p-2 font-medium">{w.title}</td>
                      <td className="p-2 uppercase text-[10px] text-slate-500">{w.type}</td>
                      <td className="p-2 font-bold text-slate-900">
                        {String(w.kpi?.value ?? w.chart?.series[0]?.data.slice(-1)[0] ?? '-')} {w.kpi?.unit || ''}
                      </td>
                      <td className="p-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                          w.manualCorrection?.isCorrected
                            ? 'bg-amber-100 text-amber-800'
                            : w.confidence === 'sumber'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}>
                          {w.manualCorrection?.isCorrected
                            ? 'Dikoreksi Manual'
                            : w.confidence === 'sumber'
                            ? 'Dokumen Resmi'
                            : 'Inferensi AI'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Citation Bibliography */}
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-sky-600" />
                <span>2. Lampiran Sitasi & Sumber Dokumen Resmi</span>
              </h3>
              <ul className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                {uniqueCitations.map((c, i) => (
                  <li key={i} className="text-[11px] text-slate-700 leading-relaxed">
                    <strong>[{i + 1}]</strong> Berkas: <span className="font-semibold text-slate-900">{c.docName}</span> (Halaman: {c.page}, Terbit: {c.date}). 
                    <span className="italic text-slate-500 block pl-4 mt-0.5">"{c.chunkSnippet}"</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Signature Block */}
            <div className="pt-6 flex justify-between text-center text-slate-700">
              <div>
                <p className="text-[11px] text-slate-500">Disiapkan Oleh:</p>
                <div className="h-12" />
                <p className="font-bold underline">Siti Rahmawati, S.E.</p>
                <p className="text-[10px] text-slate-400">Analis Data & Kinerja BUMD</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Mengetahui & Menyetujui:</p>
                <div className="h-12" />
                <p className="font-bold underline">Dewan Direksi / Pengawas</p>
                <p className="text-[10px] text-slate-400">Ketua Tim Pengarah</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={handleDownloadJson}
            className="px-3 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <Code className="w-3.5 h-3.5" />
            <span>Unduh JSON Spec</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-medium transition-colors"
            >
              Tutup
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs"
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
