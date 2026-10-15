import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Maximize2, Minimize2, Presentation, RefreshCw, Sparkles, X } from 'lucide-react';
import type { Dashboard, SlidePresentasi, WidgetSpec } from '../types';
import { WidgetCard } from './widgets/WidgetCard';
import { ChartSelectionProvider } from './widgets/ChartSelection';
import { susunSlide, VERSI_PRESENTASI } from '../services/presentasi/slide';

interface PresentationModeProps {
  dashboard: Dashboard;
  tenantName?: string;
  onExit: () => void;
  /** Dipanggil saat dashboard berubah (mis. setelah insight/slide digenerate). */
  onUpdate: (d: Dashboard) => void;
}

/** Berapa widget per slide → kelas grid agar tiap chart tetap besar. */
function kelasGrid(n: number): string {
  if (n <= 1) return 'grid-cols-1';
  if (n === 2) return 'grid-cols-1 md:grid-cols-2';
  if (n === 3) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
  return 'grid-cols-1 md:grid-cols-2';
}

/** Tinggi baris: 1 widget = penuh; 2 = satu baris; 3-4 = dua baris. */
function kelasBaris(n: number): string {
  if (n <= 2) return 'grid-rows-1';
  return 'grid-rows-1 md:grid-rows-2';
}

export const PresentationMode: React.FC<PresentationModeProps> = ({
  dashboard,
  tenantName,
  onExit,
  onUpdate,
}) => {
  const [slides, setSlides] = useState<SlidePresentasi[]>(() => dashboard.presentasi?.slides ?? []);
  const [idx, setIdx] = useState(0);
  const [menyiapkan, setMenyiapkan] = useState(false);
  const [progres, setProgres] = useState<{ selesai: number; total: number; judul: string } | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [catatan, setCatatan] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNarasi, setShowNarasi] = useState(true);
  const mulaiRef = useRef(false);

  const petaWidget = useMemo(
    () => new Map(dashboard.widgets.map((w) => [w.id, w])),
    [dashboard.widgets]
  );

  /** Slide efektif: pakai yang tersimpan; kalau kosong, susun otomatis dari widget. */
  const slidesEfektif = useMemo(
    () => (slides.length > 0 ? slides : susunSlide(dashboard.widgets)),
    [slides, dashboard.widgets]
  );

  const slide = slidesEfektif[idx];

  const widgetSlide: WidgetSpec[] = useMemo(() => {
    if (!slide) return [];
    return slide.widgetIds
      .map((id) => petaWidget.get(id))
      .filter((w): w is WidgetSpec => !!w);
  }, [slide, petaWidget]);

  const masukFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
      }
    } catch {
      /* browser menolak (mis. bukan gestur user) — abaikan, overlay tetap tampil */
    }
  }, []);

  /**
   * Siapkan presentasi: minta server generate narasi insight lewat RAG + susun
   * slide, lalu simpan ke dashboard. Memakai SSE supaya progres per widget
   * terlihat (dashboard bisa puluhan widget → tidak instan).
   */
  const siapkan = useCallback(
    async (segarkan: boolean) => {
      setMenyiapkan(true);
      setGalat(null);
      setCatatan([]);
      setProgres(null);
      try {
        const res = await fetch(`/api/dashboards/${dashboard.id}/presentasi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segarkan }),
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error || `Gagal menyiapkan presentasi (HTTP ${res.status}).`);
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const blok = buf.split('\n\n');
          buf = blok.pop() ?? '';
          for (const b of blok) {
            const ev = /^event:\s*(.+)$/m.exec(b)?.[1]?.trim();
            const dataLine = /^data:\s*(.+)$/m.exec(b)?.[1];
            if (!ev || !dataLine) continue;
            let data: any = null;
            try {
              data = JSON.parse(dataLine);
            } catch {
              continue;
            }
            if (ev === 'mulai') setProgres({ selesai: 0, total: data.total, judul: '' });
            else if (ev === 'progres')
              setProgres({ selesai: data.selesai, total: data.total, judul: data.judul });
            else if (ev === 'selesai') {
              const dash: Dashboard = data.dashboard;
              if (dash?.presentasi?.slides) setSlides(dash.presentasi.slides);
              if (dash) onUpdate(dash);
              setCatatan(Array.isArray(data.catatan) ? data.catatan : []);
            } else if (ev === 'galat') {
              throw new Error(data.pesan || 'Gagal menyiapkan presentasi.');
            }
          }
        }
      } catch (err) {
        setGalat(err instanceof Error ? err.message : 'Gagal menyiapkan presentasi.');
      } finally {
        setMenyiapkan(false);
      }
    },
    [dashboard.id, onUpdate]
  );

  // Auto-siapkan saat masuk. Dua kondisi:
  //  (a) belum ada slide tersimpan, ATAU
  //  (b) slide tersimpan BASI (versi skema beda, atau daftar widget berubah) →
  //      susun ulang otomatis supaya pengguna tidak melihat tata letak lama.
  useEffect(() => {
    if (mulaiRef.current) return;
    mulaiRef.current = true;
    masukFullscreen();
    if (dashboard.widgets.length === 0) return;

    const tersimpan = dashboard.presentasi;
    const idTersimpan = new Set(tersimpan?.slides?.flatMap((s) => s.widgetIds) ?? []);
    const idWidget = dashboard.widgets.filter((w) => !w.dataKosong).map((w) => w.id);
    const adaYangHilang = idWidget.some((id) => !idTersimpan.has(id));
    const basi =
      !tersimpan?.slides?.length ||
      (tersimpan.versi ?? 1) < VERSI_PRESENTASI ||
      adaYangHilang;

    if (basi) void siapkan(false);
  }, [dashboard.presentasi, dashboard.widgets, masukFullscreen, siapkan]);

  // Sinkronkan status fullscreen + kunci scroll body selama presentasi.
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    const overflowLama = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.body.style.overflow = overflowLama;
    };
  }, []);

  const maju = useCallback(() => setIdx((i) => Math.min(slidesEfektif.length - 1, i + 1)), [slidesEfektif.length]);
  const mundur = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);

  // Navigasi keyboard: ←/→/spasi/Home/End, ESC keluar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        maju();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        mundur();
      } else if (e.key === 'Home') setIdx(0);
      else if (e.key === 'End') setIdx(slidesEfektif.length - 1);
      else if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [maju, mundur, onExit, slidesEfektif.length]);

  const total = slidesEfektif.length;
  const n = widgetSlide.length;

  return (
    <div className="fixed inset-0 z-[60] bg-surface-2 flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* ===== Bilah atas ===== */}
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-surface border-b border-line">
        <div className="min-w-0 flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-chip text-[11px] font-bold uppercase tracking-wider bg-brand/10 text-brand border border-brand/20">
            <Presentation className="w-3.5 h-3.5" />
            Mode Presentasi
          </span>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-extrabold text-ink truncate" title={dashboard.title}>
              {dashboard.title}
            </h1>
            {tenantName && (
              <p className="text-[11px] text-ink-3 truncate">{tenantName}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => void siapkan(true)}
            disabled={menyiapkan}
            title="Susun ulang narasi & slide dari RAG"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${menyiapkan ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Susun Ulang</span>
          </button>
          <button
            onClick={() => setShowNarasi((v) => !v)}
            title={showNarasi ? 'Sembunyikan narasi' : 'Tampilkan narasi'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Narasi</span>
          </button>
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-on-brand bg-brand hover:bg-brand-ink rounded-control transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      {/* ===== Isi slide (tanpa scroll) ===== */}
      <main className="flex-1 min-h-0 flex flex-col px-4 sm:px-6 py-4">
        {menyiapkan ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
            <p className="text-sm font-semibold text-ink">Menyusun narasi &amp; slide dari dokumen…</p>
            {progres && (
              <>
                <div className="w-full max-w-md h-1.5 rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full bg-brand transition-all"
                    style={{ width: `${progres.total ? (progres.selesai / progres.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-ink-3 max-w-md truncate">
                  {progres.selesai}/{progres.total} — {progres.judul || 'memulai…'}
                </p>
              </>
            )}
            <p className="text-[11px] text-ink-3 max-w-sm">
              Narasi insight tiap chart ditulis dari dokumen resmi instansi, lalu disimpan ke dashboard.
            </p>
          </div>
        ) : galat ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <p className="text-sm font-semibold text-neg">Gagal menyiapkan presentasi</p>
            <p className="text-xs text-ink-2 max-w-md">{galat}</p>
            <button
              onClick={() => void siapkan(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-on-brand bg-brand hover:bg-brand-ink rounded-control"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Coba lagi
            </button>
          </div>
        ) : total === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <p className="text-sm text-ink-2">Dashboard ini belum punya widget untuk dipresentasikan.</p>
          </div>
        ) : (
          <>
            {/* Judul slide */}
            <div className="shrink-0 mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg sm:text-xl font-extrabold text-ink tracking-tight truncate">
                {slide?.judul}
              </h2>
              <span className="text-[11px] font-semibold text-ink-3 shrink-0">
                {idx + 1} / {total}
              </span>
            </div>

            {/* Grid widget — tiap sel: chart (isi) + narasi insight (kaki). */}
            <ChartSelectionProvider>
              <div
                className={`flex-1 min-h-0 grid gap-3 ${kelasGrid(n)} ${kelasBaris(n)} auto-rows-fr`}
              >
                {widgetSlide.map((w) => (
                  <div key={w.id} className="min-h-0 flex flex-col gap-2">
                    <div className="flex-1 min-h-0">
                      <WidgetCard
                        widget={w}
                        preview
                        onEdit={() => {}}
                        onManualCorrection={() => {}}
                        onDelete={() => {}}
                        onDuplicate={() => {}}
                      />
                    </div>
                    {showNarasi && w.insight && (
                      <div className="shrink-0 px-3.5 py-2.5 rounded-card bg-surface border border-line">
                        <p className="text-[11px] leading-relaxed text-ink-2 line-clamp-3">
                          {w.insight}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ChartSelectionProvider>

            {/* Narasi pengantar slide (kalau ada) */}
            {showNarasi && slide?.narasi && (
              <div className="shrink-0 mt-3 px-4 py-2.5 rounded-card bg-brand/8 border border-brand/20">
                <p className="text-xs leading-relaxed text-ink">{slide.narasi}</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* ===== Bilah bawah: navigasi ===== */}
      <footer className="shrink-0 flex items-center justify-center gap-4 px-4 py-3 bg-surface border-t border-line">
        <button
          onClick={mundur}
          disabled={idx === 0}
          title="Slide sebelumnya (←)"
          className="p-2 rounded-control bg-surface-2 hover:bg-line/50 border border-line text-ink-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Titik slide — klik untuk lompat */}
        <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-[60vw]">
          {slidesEfektif.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setIdx(i)}
              title={s.judul}
              aria-label={`Slide ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === idx ? 'w-6 bg-brand' : 'w-2 bg-line-strong hover:bg-ink-3'
              }`}
            />
          ))}
        </div>

        <button
          onClick={maju}
          disabled={idx >= total - 1}
          title="Slide berikutnya (→)"
          className="p-2 rounded-control bg-surface-2 hover:bg-line/50 border border-line text-ink-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </footer>

      {catatan.length > 0 && !menyiapkan && (
        <div className="shrink-0 px-4 py-1.5 bg-warn/10 border-t border-warn/30">
          <p className="text-[10.5px] text-warn text-center">
            {catatan.length} narasi memakai ringkasan dari data (layanan RAG tidak menjawab untuk indikator itu).
          </p>
        </div>
      )}
    </div>
  );
};
