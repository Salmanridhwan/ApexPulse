import React, { useCallback, useEffect, useState } from 'react';
import { Maximize2, Minimize2, Sparkles, X } from 'lucide-react';
import type { Dashboard } from '../types';
import { DashboardCanvas } from './DashboardCanvas';

interface PresentationModeProps {
  dashboard: Dashboard;
  tenantName?: string;
  /** Tidak dipakai lagi: presentasi kini satu halaman utuh, tanpa pemanggilan RAG. */
  tenantId?: string;
  onExit: () => void;
  /** Tidak dipakai lagi: tidak ada slide/narasi yang disimpan. */
  onUpdate?: (d: Dashboard) => void;
  /**
   * Pratinjau dari galeri template: angka masih contoh, jadi diberi penanda.
   * Kartu juga tidak menampilkan menu ⋯ karena widget belum nyata.
   */
  pratinjau?: boolean;
  /**
   * Isi pengganti kanvas. Dipakai galeri template yang menampilkan TAMPILAN
   * REFERENSI (bukan widget kanvas biasa): presentasi menampilkan tampilan itu
   * apa adanya di layar penuh.
   */
  konten?: React.ReactNode;
}

/**
 * MODE PRESENTASI — satu dashboard = SATU halaman utuh, tanpa slide.
 *
 * Sebelumnya presentasi memecah dashboard menjadi beberapa slide. Pengguna
 * meminta konsep itu dibuang: dashboard sudah satu kesatuan, jadi presentasi
 * hanya menampilkan SELURUH dashboard di layar penuh — persis seperti kanvas,
 * semua kartu terlihat sekaligus, tanpa navigasi slide dan tanpa scroll.
 *
 * Tata letak satu layar dikerjakan `DashboardCanvas` (`satuHalaman`), sehingga
 * aturan tingginya sama dengan tampilan dashboard biasa — tidak ada dua cara
 * menghitung yang bisa berbeda hasilnya.
 */
export const PresentationMode: React.FC<PresentationModeProps> = ({
  dashboard,
  tenantName,
  onExit,
  pratinjau = false,
  konten,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const masukFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
      }
    } catch {
      /* browser menolak (mis. bukan gestur user) — abaikan, overlay tetap tampil */
    }
  }, []);

  // Minta layar penuh sekali saat masuk, lalu ikuti perubahan dari tombol browser.
  useEffect(() => {
    void masukFullscreen();
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    const overflowLama = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.body.style.overflow = overflowLama;
    };
  }, [masukFullscreen]);

  // Esc keluar dari presentasi.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  return (
    <div className="fixed inset-0 z-[60] bg-canvas flex flex-col overflow-hidden">
      {/* ===== Bilah atas ===== */}
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 bg-surface border-b border-line">
        <div className="min-w-0 flex items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-extrabold text-ink truncate" title={dashboard.title}>
              {dashboard.title}
            </h1>
            {tenantName && <p className="text-[11px] text-ink-3 truncate">{tenantName}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {pratinjau && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-chip text-[10px] font-bold text-warn bg-warn/10 border border-warn/30">
              <Sparkles className="w-3 h-3" />
              Pratinjau template · angka contoh
            </span>
          )}
          <button
            onClick={() => (isFullscreen ? document.exitFullscreen?.() : masukFullscreen())}
            title="Layar penuh"
            className="p-2 text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onExit}
            title="Keluar presentasi (Esc)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-on-brand bg-brand hover:brightness-95 rounded-control transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      {/* ===== Seluruh dashboard dalam satu halaman ===== */}
      <main className={`flex-1 min-h-0 ${konten ? 'overflow-hidden' : 'overflow-auto'}`}>
        {konten ?? (
        <DashboardCanvas
          widgets={dashboard.widgets}
          satuHalaman
          readOnly
          preview={pratinjau}
          onEditWidget={() => {}}
          onManualCorrection={() => {}}
          onDeleteWidget={() => {}}
          onDuplicateWidget={() => {}}
          onReorderWidgets={() => {}}
          onResizeWidget={() => {}}
        />
        )}
      </main>
    </div>
  );
};
