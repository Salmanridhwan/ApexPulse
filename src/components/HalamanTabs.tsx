import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import type { HalamanDashboard } from '../types';

interface HalamanTabsProps {
  halaman: HalamanDashboard[];
  aktifId?: string;
  onPilih: (id: string) => void;
  /** Kosongkan di tampilan yang tidak boleh mengubah halaman (galeri template). */
  onTambah?: () => void;
  onGantiNama?: (id: string, judul: string) => void;
  onHapus?: (id: string) => void;
  /** Geser urutan halaman (index lama → index baru). */
  onGeser?: (dari: number, ke: number) => void;
}

/**
 * STRIP HALAMAN di atas kanvas.
 *
 * Satu dashboard boleh punya banyak halaman. Tiap tab mewakili satu halaman
 * dengan data dan kartunya sendiri. Halaman minimal satu: tombol hapus tidak
 * tampil bila hanya ada satu halaman.
 */
export const HalamanTabs: React.FC<HalamanTabsProps> = ({
  halaman,
  aktifId,
  onPilih,
  onTambah,
  onGantiNama,
  onHapus,
  onGeser,
}) => {
  const indeksAktif = Math.max(0, halaman.findIndex((h) => h.id === aktifId));
  const stripRef = useRef<HTMLDivElement>(null);
  const [bisaKiri, setBisaKiri] = useState(false);
  const [bisaKanan, setBisaKanan] = useState(false);

  /**
   * Dashboard BUMD punya 17 halaman dan strip-nya menyembunyikan scrollbar
   * (`no-scrollbar`), jadi halaman di luar layar nyaris tak bisa dijangkau.
   * Panah hanya tampil saat memang masih ada sisa gulir.
   */
  const periksaGulir = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setBisaKiri(el.scrollLeft > 4);
    setBisaKanan(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    periksaGulir();
  }, [halaman.length, periksaGulir]);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    // Lebar jendela berubah (panel ditutup, zoom) bisa memunculkan/menyembunyikan panah.
    const pengamat = new ResizeObserver(periksaGulir);
    pengamat.observe(el);
    return () => pengamat.disconnect();
  }, [periksaGulir]);

  // Tab aktif selalu digeser masuk pandangan supaya "17/17" tak pernah di luar layar.
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>('[data-aktif="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    periksaGulir();
  }, [aktifId, halaman.length, periksaGulir]);

  // Roda mouse vertikal diterjemahkan jadi gulir horizontal pada strip.
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const saatRoda = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener('wheel', saatRoda, { passive: false });
    return () => el.removeEventListener('wheel', saatRoda);
  }, []);

  const geser = (arah: -1 | 1) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: arah * Math.max(180, el.clientWidth * 0.7), behavior: 'smooth' });
  };

  const perluPanah = bisaKiri || bisaKanan;

  return (
    <div className="flex items-center gap-2 mb-2.5" data-testid="strip-halaman">
      {perluPanah && (
        <button
          type="button"
          onClick={() => geser(-1)}
          disabled={!bisaKiri}
          title="Halaman sebelumnya"
          aria-label="Geser halaman ke kiri"
          data-testid="halaman-kiri"
          className="shrink-0 p-1 rounded-control border border-line bg-surface text-ink-2 hover:bg-surface-2 disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      )}

      <div
        ref={stripRef}
        onScroll={periksaGulir}
        data-testid="strip-halaman-gulir"
        className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto no-scrollbar"
      >
        {halaman.map((h, i) => {
          const aktif = i === indeksAktif;
          return (
            <div
              key={h.id}
              data-aktif={aktif ? 'true' : 'false'}
              className={`group shrink-0 inline-flex items-center gap-1 rounded-control border transition-colors ${
                aktif
                  ? 'bg-brand text-on-brand border-brand'
                  : 'bg-surface text-ink-2 border-line hover:bg-surface-2'
              }`}
            >
              <button
                type="button"
                onClick={() => onPilih(h.id)}
                data-testid="tab-halaman"
                title={h.judul}
                className="px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap"
              >
                {h.judul}
              </button>
              {aktif && (onGantiNama || onHapus || onGeser) && (
                <span className="flex items-center">
                  {onGantiNama && (
                    <button
                      type="button"
                      title="Ganti nama halaman"
                      onClick={() => {
                        const baru = window.prompt('Nama halaman', h.judul);
                        if (baru && baru.trim() && baru.trim() !== h.judul) onGantiNama(h.id, baru.trim());
                      }}
                      className="p-1 rounded-chip hover:bg-on-brand/15"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                  {onHapus && halaman.length > 1 && (
                    <button
                      type="button"
                      title="Hapus halaman"
                      onClick={() => {
                        if (window.confirm(`Hapus "${h.judul}" beserta isinya?`)) onHapus(h.id);
                      }}
                      className="p-1 rounded-chip hover:bg-on-brand/15"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  {onGeser && halaman.length > 1 && (
                    <>
                      <button
                        type="button"
                        title="Geser ke kiri"
                        disabled={i === 0}
                        onClick={() => onGeser(i, i - 1)}
                        className="p-0.5 rounded-chip hover:bg-on-brand/15 disabled:opacity-30"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        title="Geser ke kanan"
                        disabled={i === halaman.length - 1}
                        onClick={() => onGeser(i, i + 1)}
                        className="p-0.5 rounded-chip hover:bg-on-brand/15 disabled:opacity-30"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </span>
              )}
            </div>
          );
        })}

        {onTambah && (
        <button
          type="button"
          onClick={onTambah}
          data-testid="tambah-halaman"
          title="Tambah halaman"
          className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors"
        >
          <Plus className="w-3 h-3" />
          <span className="hidden sm:inline">Halaman</span>
        </button>
        )}
      </div>

      {perluPanah && (
        <button
          type="button"
          onClick={() => geser(1)}
          disabled={!bisaKanan}
          title="Halaman berikutnya"
          aria-label="Geser halaman ke kanan"
          data-testid="halaman-kanan"
          className="shrink-0 p-1 rounded-control border border-line bg-surface text-ink-2 hover:bg-surface-2 disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}

      <span className="shrink-0 text-[11px] text-ink-3 tabular-nums">
        {indeksAktif + 1}/{halaman.length}
      </span>
    </div>
  );
};
