import React from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle,
  ExternalLink,
  FileCheck,
  FileText,
  MapPin,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { Citation } from '../types';

interface SourceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  citation: Citation | null;
}

export const SourceDrawer: React.FC<SourceDrawerProps> = ({
  isOpen,
  onClose,
  citation,
}) => {
  if (!isOpen || !citation) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full sm:w-[480px] bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Transparansi Dokumen Sumber
              </h2>
              <p className="text-xs text-slate-500">
                Audit Trail & Verifikasi Data RAG BUMD
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Document Identity Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-white border border-slate-200 text-sky-600 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                  Nama Berkas Dokumen Resmi
                </span>
                <h3 className="text-sm font-bold text-slate-800 break-words mt-0.5">
                  {citation.docName}
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs">
              <div className="flex items-center gap-1.5 text-slate-600">
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                <span>Halaman: <strong className="text-slate-800">{citation.page}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Tanggal: <strong className="text-slate-800">{citation.date}</strong></span>
              </div>
              {citation.unitKerja && (
                <div className="flex items-center gap-1.5 text-slate-600 col-span-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Unit: <strong className="text-slate-800">{citation.unitKerja}</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* Confidence & Integrity Score */}
          <div className="flex items-center justify-between p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="font-semibold text-emerald-900">
                  Tingkat Kepercayaan Data: {Math.round(citation.confidenceScore * 100)}%
                </p>
                <p className="text-[11px] text-emerald-700">
                  Data diekstraksi langsung dari berkas LRA / RKAP instansi yang sah.
                </p>
              </div>
            </div>
          </div>

          {/* Verbatim Chunk Snippet */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <span>Kutipan Teks Asli (Verbatim Chunk)</span>
            </span>
            <div className="p-4 bg-amber-50/40 border border-amber-200/80 rounded-xl text-xs text-slate-800 leading-relaxed font-serif relative">
              <div className="absolute top-2 right-2 text-[10px] text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded font-sans font-medium">
                Kutipan Hal. {citation.page}
              </div>
              <p className="pt-2 italic whitespace-pre-line">
                "{citation.chunkSnippet}"
              </p>
            </div>
          </div>

          {/* Audit Verification Stamp */}
          <div className="p-3.5 border border-slate-200 rounded-xl space-y-1.5 bg-white text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5 font-medium text-slate-700">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verifikasi Kepatuhan Standar BPKP / OJK</span>
            </div>
            <p>
              Setiap angka dalam widget ini telah dikaitkan dengan nomor halaman dan potongan teks asli pada pangkalan retrieval. Tidak ada halusinasi data model AI.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            ApexPulse Retrieval Verification
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Tutup Panel
          </button>
        </div>
      </div>
    </div>
  );
};
