import React, { useEffect, useState } from 'react';
import { Check, Palette, X } from 'lucide-react';
import type { WidgetStyle } from '../types';
import { adaGaya } from './widgets/widgetStyle';
import { StyleControls } from './StyleControls';

interface GlobalStyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Jumlah widget yang akan terpengaruh — ditampilkan sebagai peringatan. */
  jumlahWidget: number;
  /** Gaya yang saat ini dominan dipakai widget (untuk mengisi awal kontrol). */
  styleAwal?: WidgetStyle;
  /** Terapkan gaya ke SELURUH widget dashboard. */
  onApply: (style: WidgetStyle | undefined) => void;
}

/**
 * Modal "Gaya Semua Widget".
 *
 * Ditaruh di toolbar kanvas (sebelah "Tambah Widget") karena pengaturannya
 * berlaku untuk SELURUH dashboard, bukan satu widget. Isinya memakai
 * <StyleControls/> yang sama dengan tab "Warna & Font" di editor per-widget,
 * jadi pilihan yang tersedia selalu identik.
 */
export const GlobalStyleModal: React.FC<GlobalStyleModalProps> = ({
  isOpen,
  onClose,
  jumlahWidget,
  styleAwal,
  onApply,
}) => {
  const [style, setStyle] = useState<WidgetStyle>(styleAwal || {});

  useEffect(() => {
    if (isOpen) setStyle(styleAwal || {});
    // Sengaja bergantung pada `isOpen` saja: mengisi ulang saat objek gayaAwal
    // berubah akan menimpa pilihan pengguna yang sedang mengatur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const akanMengubah = adaGaya(style);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-scrim/50 backdrop-blur-xs" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-style-title"
        className="relative w-full max-w-lg bg-surface rounded-card shadow-2xl border border-line overflow-hidden z-10 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-line flex items-center justify-between bg-surface-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-control bg-brand flex items-center justify-center text-on-brand">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h2 id="global-style-title" className="text-sm font-semibold text-ink">
                Gaya Semua Widget
              </h2>
              <p className="text-xs text-ink-2">
                Warna & font berlaku untuk seluruh widget di dashboard ini
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-chip text-ink-3 hover:text-ink-2 hover:bg-line transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 text-xs">
          {/* Peringatan jumlah widget — supaya pengguna tahu cakupan aksinya */}
          <div className="mb-4 p-3 bg-warn/15 border border-warn/30 rounded-card text-warn flex items-start gap-2">
            <Palette className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-[11px] leading-relaxed">
              Pilihan di bawah akan menimpa gaya{' '}
              <strong>{jumlahWidget} kartu</strong> di dashboard ini sekaligus. Warna kartu
              berlaku untuk semua kartu; warna khusus per-seri pada tiap widget akan digantikan.
            </p>
          </div>

          <StyleControls style={style} onChange={setStyle} mode="global" />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-surface-2 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-line rounded-control text-ink-2 hover:bg-surface-2 text-xs font-medium transition-colors"
          >
            Batal
          </button>
          <button
            onClick={() => {
              onApply(akanMengubah ? style : undefined);
              onClose();
            }}
            className="px-5 py-2 bg-brand hover:bg-brand-ink text-on-brand rounded-control text-xs font-medium transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{akanMengubah ? 'Terapkan ke Semua Widget' : 'Kembalikan Semua ke Bawaan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
