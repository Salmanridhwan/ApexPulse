import React, { useEffect, useRef, useState } from 'react';
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
  /**
   * Dipanggil setiap pilihan berubah. Perubahan langsung terlihat di kanvas,
   * tetapi baru tersimpan permanen lewat tombol Simpan di baris filter kanvas.
   *
   * `target` = `'semua'` atau id grafik/widget sasaran PALET WARNA. Font dan
   * ukuran font selalu berlaku untuk seluruh widget.
   */
  onApply: (style: WidgetStyle | undefined, target: string) => void;
  /** Pilihan sasaran palet warna: grafik template atau widget dashboard. */
  targetPalet?: Array<{ id: string; label: string }>;
}

/**
 * Panel "Gaya Widget" — sidebar kanan, bukan modal tengah.
 *
 * Bentuknya sidebar kanan yang menempel pada kanvas, menyisakan
 * ruang (halaman menyempit, bukan tertutup), dan setiap perubahan langsung
 * diterapkan ke kanvas. Penyimpanan permanen tetap lewat tombol Simpan/Reset di
 * baris filter kanvas, sama seperti menggeser kartu atau menambah widget.
 */
export const GlobalStyleModal: React.FC<GlobalStyleModalProps> = ({
  isOpen,
  onClose,
  jumlahWidget,
  styleAwal,
  onApply,
  targetPalet = [],
}) => {
  const [style, setStyle] = useState<WidgetStyle>(styleAwal || {});
  /** Grafik/widget yang palet warnanya diubah. `semua` = seluruh grafik. */
  const [target, setTarget] = useState('semua');
  /** Cegah penerapan saat panel baru dibuka dengan gaya yang sudah ada. */
  const pertamaRef = useRef(true);

  useEffect(() => {
    if (!isOpen) return;
    setStyle(styleAwal || {});
    setTarget('semua');
    pertamaRef.current = true;
    // Sengaja bergantung pada `isOpen` saja: mengisi ulang saat objek gayaAwal
    // berubah akan menimpa pilihan pengguna yang sedang mengatur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /**
   * Terapkan langsung ke kanvas dengan jeda pendek, supaya menyeret color picker
   * tidak mengirim puluhan pembaruan. Tidak ada penyimpanan ke server di sini.
   */
  useEffect(() => {
    if (!isOpen) return;
    if (pertamaRef.current) {
      pertamaRef.current = false;
      return;
    }
    const t = window.setTimeout(() => onApply(adaGaya(style) ? style : undefined, target), 180);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="global-style-title"
      data-testid="panel-gaya-widget"
      className="fixed right-0 bottom-0 top-14 z-20 w-full lg:w-[440px] bg-surface border-l border-line flex flex-col text-ink"
    >
      {/* Header */}
      <div className="p-4 border-b border-line flex items-center justify-between bg-surface-2/70">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-control bg-brand flex items-center justify-center text-on-brand shadow-xs shrink-0">
            <Palette className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 id="global-style-title" className="text-sm font-semibold text-ink">
              Gaya Widget
            </h2>
            <p className="text-xs text-ink-2 truncate">
              {jumlahWidget} kartu · perubahan langsung terlihat
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          title="Tutup (Esc)"
          className="p-1 rounded-chip text-ink-3 hover:text-ink-2 hover:bg-line/60 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 text-xs space-y-3">
        {targetPalet.length > 0 && (
          <div>
            <label className="block text-ink-2 font-medium mb-2">Terapkan Palet Warna ke</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="field-lg"
            >
              <option value="semua">Semua grafik</option>
              {targetPalet.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-ink-3 mt-1">
              Font dan ukuran font berlaku untuk semua widget.
            </p>
          </div>
        )}
        <StyleControls style={style} onChange={setStyle} mode="global" />
      </div>

      {/* Footer: perubahan sudah ada di kanvas, penyimpanan lewat baris filter */}
      <div className="p-3 border-t border-line bg-surface-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-ink-3 leading-snug">
          Tekan Simpan di baris filter kanvas untuk menyimpan permanen.
        </p>
        <button
          onClick={onClose}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:brightness-95 text-on-brand rounded-control text-xs font-semibold transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Selesai</span>
        </button>
      </div>
    </div>
  );
};
