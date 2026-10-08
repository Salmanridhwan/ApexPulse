import React, { useState } from 'react';
import { Check, Code2, Copy, ExternalLink, Globe, Lock, Pencil, Share2, X } from 'lucide-react';
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
  const [accessMode, setAccessMode] = useState<'readonly' | 'editable'>('readonly');
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isCopiedEmbed, setIsCopiedEmbed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !dashboard) return null;

  const handleGenerateShareLink = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/dashboards/${dashboard.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: accessMode }),
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

  const embedUrl = shareToken ? `${window.location.origin}/embed/${shareToken}` : '';
  const embedSnippet = embedUrl
    ? `<iframe src="${embedUrl}" width="100%" height="720" style="border:0" loading="lazy" title="Dashboard"></iframe>`
    : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullShareUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const copyEmbedSnippet = () => {
    navigator.clipboard.writeText(embedSnippet);
    setIsCopiedEmbed(true);
    setTimeout(() => setIsCopiedEmbed(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-scrim/50 backdrop-blur-xs" onClick={onClose} />

      <div role="dialog" aria-modal="true" aria-labelledby="share-modal-title" className="relative w-full max-w-md bg-surface rounded-card shadow-2xl border border-line overflow-hidden z-10 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-line flex items-center justify-between bg-surface-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-control bg-brand flex items-center justify-center text-on-brand">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 id="share-modal-title" className="text-sm font-semibold text-ink">
                Bagikan Dashboard ({accessMode === 'editable' ? 'Bisa Edit' : 'Read-Only'})
              </h2>
              <p className="text-xs text-ink-2 truncate max-w-xs">{dashboard.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-chip text-ink-3 hover:text-ink-2 hover:bg-line transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <div className="p-3.5 bg-surface-2 border border-line rounded-card text-ink space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <Globe className="w-4 h-4 text-brand" />
              <span>{accessMode === 'editable' ? 'Akses Edit Tanpa PIN' : 'Akses Tampilan Publik Aman'}</span>
            </div>
            <p className="text-[11px] text-ink leading-relaxed">
              {accessMode === 'editable'
                ? 'Penerima tautan dapat mengedit widget langsung dari halaman publik tanpa kredensial login. Setiap perubahan tersimpan permanen pada dashboard asli dan tercatat di jejak audit instansi.'
                : 'Tautan ini memungkinkan Dewan Pengawas, Kepala Daerah, atau auditor eksternal melihat dashboard tanpa perlu kredensial login atau hak akses edit.'}
            </p>
          </div>

          {/* Opsi Mode Akses */}
          <div className="space-y-2">
            <label className="block text-ink font-semibold">Tipe Akses Tautan:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAccessMode('readonly')}
                className={`p-3 rounded-card border text-left flex flex-col justify-between transition-all ${
                  accessMode === 'readonly'
                    ? 'border-brand bg-brand/10 text-brand-ink ring-1 ring-brand'
                    : 'border-line bg-surface-2 text-ink-2 hover:bg-line/50'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Read-Only</span>
                </div>
                <span className="text-[10px] text-ink-3">Hanya untuk melihat dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => setAccessMode('editable')}
                className={`p-3 rounded-card border text-left flex flex-col justify-between transition-all ${
                  accessMode === 'editable'
                    ? 'border-brand bg-brand/10 text-brand-ink ring-1 ring-brand'
                    : 'border-line bg-surface-2 text-ink-2 hover:bg-line/50'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Bisa Edit</span>
                </div>
                <span className="text-[10px] text-ink-3">Penerima tautan dapat mengedit widget</span>
              </button>
            </div>

          {/* Mode terkunci pada saat tautan dibuat — supaya tidak ada harapan
              bahwa tautan lama bisa dinaikkan jadi bisa-edit. */}
          <div className="flex items-start gap-1.5 text-[10px] text-ink-3 leading-relaxed">
            <Lock className="w-3 h-3 mt-0.5 shrink-0" />
            <span>
              Mode akses terkunci saat tautan dibuat. Tautan yang sudah beredar tidak berubah mode
              {' '}— untuk mengubahnya, buat tautan baru.
            </span>
          </div>
          </div>

          {!shareToken ? (
            <div className="text-center py-3">
              <button
                onClick={handleGenerateShareLink}
                disabled={isLoading}
                className="w-full py-2.5 bg-brand hover:bg-brand-ink text-white rounded-card font-medium shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" />
                <span>{isLoading ? 'Membuat Tautan...' : 'Buat Tautan Berbagi'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-ink-2 font-medium">
                  Tautan Publik ({accessMode === 'editable' ? 'Bisa Edit' : 'Read-Only'}):
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={fullShareUrl}
                    className="w-full px-3 py-2 border border-line rounded-control bg-surface-2 text-xs font-mono select-all focus:outline-none"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="px-3 py-2 bg-ink hover:bg-ink/90 text-surface rounded-control transition-colors shrink-0 flex items-center gap-1"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-pos" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-ink-3">
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Dilindungi Token Enkripsi
                </span>
                <a
                  href={`/share/${shareToken}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand hover:underline flex items-center gap-1"
                >
                  <span>Buka Pratinjau</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Embed untuk website instansi klien */}
              <div className="pt-3 border-t border-line space-y-2">
                <div className="flex items-center gap-1.5 text-ink-2 font-medium">
                  <Code2 className="w-3.5 h-3.5 text-ink-2" />
                  <span>Embed di website instansi</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <textarea
                    readOnly
                    value={embedSnippet}
                    rows={2}
                    className="w-full px-3 py-1.5 border border-line rounded-control bg-surface-2 text-[11px] font-mono resize-none focus:outline-none"
                  />
                  <button
                    onClick={copyEmbedSnippet}
                    className="px-3 py-2 bg-ink hover:bg-ink/90 text-surface rounded-control transition-colors shrink-0 flex items-center gap-1"
                  >
                    {isCopiedEmbed ? <Check className="w-3.5 h-3.5 text-pos" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopiedEmbed ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-surface-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-ink hover:bg-ink/90 text-surface text-xs font-medium rounded-control transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
