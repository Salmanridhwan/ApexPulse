import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { perluMuatUlang } from '../services/ui/versi';

/**
 * PEMBERITAHUAN VERSI — memberi tahu bahwa aplikasi sudah diperbarui dan tab ini
 * masih menjalankan versi lama.
 *
 * Muncul hanya kalau versi bundel yang dilayani server berbeda dengan versi saat
 * halaman dimuat; pengguna diberi satu tombol untuk memuat ulang, bukan diminta
 * mencari sendiri tombol refresh browser.
 */
export const PemberitahuanVersi: React.FC = () => {
  const [versiBaru, setVersiBaru] = useState<string | null>(null);
  const versiSaatMuat = useRef<string | null>(null);
  const [ditutup, setDitutup] = useState(false);

  const cek = useCallback(async () => {
    try {
      const res = await fetch('/api/versi', { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const isi = (await res.json()) as { versi?: string };
      const versi = typeof isi?.versi === 'string' ? isi.versi : null;
      if (!versi) return;
      if (!versiSaatMuat.current) {
        versiSaatMuat.current = versi;
        return;
      }
      if (perluMuatUlang(versiSaatMuat.current, versi)) setVersiBaru(versi);
    } catch {
      /* jaringan putus: bukan urusan pemberitahuan ini */
    }
  }, []);

  useEffect(() => {
    void cek();
    const jeda = setInterval(() => void cek(), 60_000);
    const saatFokus = () => void cek();
    window.addEventListener('focus', saatFokus);
    document.addEventListener('visibilitychange', saatFokus);
    return () => {
      clearInterval(jeda);
      window.removeEventListener('focus', saatFokus);
      document.removeEventListener('visibilitychange', saatFokus);
    };
  }, [cek]);

  if (!versiBaru || ditutup) return null;

  return (
    <div
      className="fixed bottom-5 left-5 z-[80] max-w-xs bg-surface border border-line rounded-card shadow-pop p-3.5 pr-9"
      data-testid="pemberitahuan-versi"
      role="status"
    >
      <button
        onClick={() => setDitutup(true)}
        className="absolute top-2 right-2 p-1 rounded-control text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors"
        aria-label="Tutup pemberitahuan"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <p className="text-[11.5px] font-bold text-ink leading-snug">Aplikasi sudah diperbarui</p>
      <p className="text-[10.5px] text-ink-2 leading-relaxed mt-1">
        Halaman ini masih memakai versi lama, jadi fitur terbaru belum muncul. Muat ulang untuk
        memakainya.
      </p>
      <button
        onClick={() => window.location.reload()}
        data-testid="muat-ulang-versi"
        className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-on-brand bg-brand hover:brightness-95 rounded-control transition-colors"
      >
        <RefreshCw className="w-3 h-3" />
        Muat ulang
      </button>
    </div>
  );
};
