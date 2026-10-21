import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Clock, Code2, Copy, ExternalLink, Globe, Lock, Pencil, Share2, Trash2, X } from 'lucide-react';
import { Dashboard } from '../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  dashboard: Dashboard | null;
  /**
   * Instansi pemilik dashboard. WAJIB untuk admin: dashboard bisa milik instansi
   * yang tidak sama dengan instansi akun admin (mis. admin global + dashboard
   * bank BJB). Tanpa ini server mencari dashboard di instansi admin sendiri dan
   * membalas 404 "Dashboard tidak ditemukan."
   */
  tenantId?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  dashboard,
  tenantId,
}) => {
  const [accessMode, setAccessMode] = useState<'readonly' | 'editable'>('readonly');
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isCopiedEmbed, setIsCopiedEmbed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  /** Pesan galat saat membuat tautan — ditampilkan di UI, bukan hanya di konsol. */
  const [errorMsg, setErrorMsg] = useState('');
  /** Masa berlaku tautan baru (hari). 0 = tanpa kedaluwarsa. */
  const [expiresInDays, setExpiresInDays] = useState(30);
  /** Tautan yang masih aktif untuk dashboard ini (bisa dicabut). */
  const [daftarTautan, setDaftarTautan] = useState<
    { token: string; mode: string; createdAt: string | null; expiresAt: string | null; kedaluwarsa: boolean }[]
  >([]);
  const [memuatTautan, setMemuatTautan] = useState(false);
  const [galatTautan, setGalatTautan] = useState('');

  const muatDaftarTautan = async () => {
    if (!dashboard) return;
    setMemuatTautan(true);
    try {
      const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
      const res = await fetch(`/api/dashboards/${dashboard.id}/shares${q}`);
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data)) setDaftarTautan(data);
    } catch {
      // daftar tautan bersifat pelengkap: kegagalan memuat tidak memblokir pembuatan
    } finally {
      setMemuatTautan(false);
    }
  };

  const cabutTautan = async (token: string) => {
    setGalatTautan('');
    try {
      const res = await fetch(`/api/share/${token}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Gagal mencabut tautan (HTTP ${res.status}).`);
      if (shareToken === token) setShareToken(null);
      await muatDaftarTautan();
    } catch (err) {
      setGalatTautan(err instanceof Error ? err.message : 'Gagal mencabut tautan.');
    }
  };

  // Reset setiap kali modal dibuka untuk dashboard (lain): token & galat lama
  // tidak boleh terbawa, supaya tidak tampak "tidak bereaksi" saat dibuka ulang.
  useEffect(() => {
    if (isOpen) {
      setShareToken(null);
      setErrorMsg('');
      setGalatTautan('');
      setIsCopied(false);
      setIsCopiedEmbed(false);
      void muatDaftarTautan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dashboard?.id]);

  if (!isOpen || !dashboard) return null;

  const handleGenerateShareLink = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/dashboards/${dashboard.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // tenantId menargetkan instansi PEMILIK dashboard. Tanpa ini admin yang
        // membuka dashboard instansi lain mendapat 404.
        // expiresInDays: 0 = tautan tanpa kedaluwarsa (perpustakaan/tautan permanen).
        body: JSON.stringify({ mode: accessMode, tenantId, expiresInDays }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // 401 = sesi habis (mis. server baru di-restart): beri tahu admin agar
        // login ulang, jangan diam saja seperti sebelumnya.
        if (res.status === 401) {
          throw new Error('Sesi Anda sudah berakhir. Silakan login ulang lalu buat tautan lagi.');
        }
        throw new Error(data?.error || `Gagal membuat tautan (HTTP ${res.status}).`);
      }
      if (!data?.token) throw new Error('Server tidak mengirim token tautan.');
      setShareToken(data.token);
      await muatDaftarTautan();
    } catch (err) {
      const pesan = err instanceof Error ? err.message : 'Gagal membuat tautan berbagi.';
      console.error('Failed to create share link:', err);
      setErrorMsg(pesan);
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
    <div className="modal-layer">
      <div className="scrim" onClick={onClose} />

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

          {daftarTautan.length > 0 && (
            <div className="space-y-2">
              <label className="block text-ink font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-ink-3" />
                <span>Tautan Aktif ({daftarTautan.length})</span>
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                {daftarTautan.map((t) => (
                  <div
                    key={t.token}
                    className="flex items-center justify-between gap-2 p-2 border border-line rounded-control bg-surface-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-medium text-ink">
                        {t.mode === 'editable' ? (
                          <Pencil className="w-3 h-3 shrink-0" />
                        ) : (
                          <Globe className="w-3 h-3 shrink-0" />
                        )}
                        <span className="truncate">
                          {t.mode === 'editable' ? 'Bisa Edit' : 'Read-Only'}
                        </span>
                        <span className="font-mono text-[10px] text-ink-3 truncate">{t.token.slice(0, 14)}…</span>
                      </div>
                      <div className="text-[10px] text-ink-3">
                        {t.expiresAt
                          ? `Berlaku sampai ${new Date(t.expiresAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}`
                          : 'Tanpa kedaluwarsa'}
                        {t.createdAt
                          ? ` · dibuat ${new Date(t.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}`
                          : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void cabutTautan(t.token)}
                      title="Cabut tautan ini"
                      className="p-1.5 rounded-chip text-neg hover:bg-neg/10 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              {galatTautan && (
                <p className="text-[10px] text-neg flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>{galatTautan}</span>
                </p>
              )}
            </div>
          )}

          {!shareToken ? (
            <div className="text-center py-3 space-y-2">
              {errorMsg && (
                <div className="text-[11px] rounded-control p-2 border bg-neg/15 border-neg/30 text-neg flex items-start gap-1.5 text-left">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 text-left">
                <label htmlFor="masa-berlaku" className="text-ink-2 font-medium shrink-0">
                  Masa berlaku:
                </label>
                <select
                  id="masa-berlaku"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="flex-1 px-2 py-1.5 border border-line rounded-control bg-surface-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value={7}>7 hari</option>
                  <option value={30}>30 hari</option>
                  <option value={90}>90 hari</option>
                  <option value={365}>1 tahun</option>
                  <option value={0}>Tanpa kedaluwarsa</option>
                </select>
              </div>
              <button
                onClick={handleGenerateShareLink}
                disabled={isLoading}
                className="w-full py-2.5 bg-brand hover:brightness-95 text-on-brand rounded-card font-medium shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
                    className="px-3 py-2 bg-solid hover:bg-solid/90 text-on-solid rounded-control transition-colors shrink-0 flex items-center gap-1"
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
                    className="px-3 py-2 bg-solid hover:bg-solid/90 text-on-solid rounded-control transition-colors shrink-0 flex items-center gap-1"
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
            className="px-4 py-2 bg-solid hover:bg-solid/90 text-on-solid text-xs font-medium rounded-control transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
