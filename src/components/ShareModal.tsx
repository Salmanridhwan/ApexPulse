import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Globe, Lock, Share2, X } from 'lucide-react';
import { Dashboard } from '../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  dashboard: Dashboard | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  dashboard,
}) => {
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !dashboard) return null;

  const handleGenerateShareLink = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/dashboards/${dashboard.id}/share`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data?.token) throw new Error('Token tidak diterima dari server');
      setShareToken(data.token);
    } catch (err) {
      console.error('Failed to create share link:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fullShareUrl = shareToken
    ? `${window.location.origin}/share/${shareToken}`
    : `${window.location.origin}/share/demo-token`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullShareUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Bagikan Dashboard (Read-Only)
              </h2>
              <p className="text-xs text-slate-500 truncate max-w-xs">{dashboard.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl text-sky-900 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <Globe className="w-4 h-4 text-sky-600" />
              <span>Akses Tampilan Publik Aman</span>
            </div>
            <p className="text-[11px] text-sky-800 leading-relaxed">
              Tautan ini memungkinkan Dewan Pengawas, Kepala Daerah, atau auditor eksternal melihat dashboard tanpa perlu kredensial login atau hak akses edit.
            </p>
          </div>

          {!shareToken ? (
            <div className="text-center py-4">
              <button
                onClick={handleGenerateShareLink}
                disabled={isLoading}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-medium shadow-xs transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" />
                <span>{isLoading ? 'Membuat Tautan...' : 'Buat Tautan Berbagi Baru'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-slate-700 font-medium">Tautan Publik Read-Only:</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={fullShareUrl}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-xs font-mono select-all focus:outline-none"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors shrink-0 flex items-center gap-1"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>

              <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Dilindungi Token Enkripsi
                </span>
                <a
                  href={`/share/${shareToken}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 hover:underline flex items-center gap-1"
                >
                  <span>Buka Pratinjau</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
