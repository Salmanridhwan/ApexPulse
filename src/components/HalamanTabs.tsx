import React from 'react';
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

  return (
    <div className="flex items-center gap-2 mb-2.5" data-testid="strip-halaman">
      <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {halaman.map((h, i) => {
          const aktif = i === indeksAktif;
          return (
            <div
              key={h.id}
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
                      className="p-1 rounded-chip hover:bg-black/10"
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
                      className="p-1 rounded-chip hover:bg-black/10"
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
                        className="p-0.5 rounded-chip hover:bg-black/10 disabled:opacity-30"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        title="Geser ke kanan"
                        disabled={i === halaman.length - 1}
                        onClick={() => onGeser(i, i + 1)}
                        className="p-0.5 rounded-chip hover:bg-black/10 disabled:opacity-30"
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

      <span className="shrink-0 text-[11px] text-ink-3 tabular-nums">
        {indeksAktif + 1}/{halaman.length}
      </span>
    </div>
  );
};
