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
   * `target` = `'semua'` atau daftar id kartu / grafik template sasaran DESAIN dan
   * PALET ("ganti beberapa saja"). Warna kartu, font, dan ukuran font selalu
   * berlaku untuk seluruh widget.
   */
  onApply: (style: WidgetStyle | undefined, target: 'semua' | string[]) => void;
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
  /** Kartu/grafik yang desain & paletnya diubah. Kosong = seluruh kartu. */
  const [terpilih, setTerpilih] = useState<string[]>([]);
  const [modePilih, setModePilih] = useState(false);
  const target: 'semua' | string[] = modePilih && terpilih.length > 0 ? terpilih : 'semua';
  /**
   * Pilihan (gaya + sasaran) yang terakhir diterapkan, mula-mula gaya saat panel
   * dibuka. Penerapan hanya terjadi bila pilihan berbeda dari ini: dulu penanda "render pertama" habis sebelum gaya awal terisi, sehingga
   * membuka panel saja sudah memunculkan "Perubahan belum disimpan".
   */
  const awalRef = useRef('');

  useEffect(() => {
    if (!isOpen) return;
    setStyle(styleAwal || {});
    setTerpilih([]);
    setModePilih(false);
    awalRef.current = JSON.stringify([styleAwal || {}, 'semua']);
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
    const kunci = JSON.stringify([style, target]);
    if (kunci === awalRef.current) return;
    const t = window.setTimeout(() => {
      awalRef.current = kunci;
      onApply(adaGaya(style) ? style : undefined, target);
    }, 180);
    return () => window.clearTimeout(t);
    // Target ikut dipantau: memilih grafik lain harus langsung menerapkan gaya ke sana.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, JSON.stringify(target), isOpen]);

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
            <label className="block text-ink-2 font-medium mb-2">Terapkan Desain &amp; Palet ke</label>
            <div className="flex gap-2" role="radiogroup">
              <button
                type="button"
                role="radio"
                aria-checked={!modePilih}
                onClick={() => setModePilih(false)}
                className={`flex-1 px-2 py-1.5 rounded-control border text-xs font-semibold ${!modePilih ? 'border-brand ring-1 ring-brand bg-surface-2' : 'border-line'}`}
              >
                Semua kartu
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={modePilih}
                onClick={() => setModePilih(true)}
                className={`flex-1 px-2 py-1.5 rounded-control border text-xs font-semibold ${modePilih ? 'border-brand ring-1 ring-brand bg-surface-2' : 'border-line'}`}
              >
                Pilih beberapa
              </button>
            </div>
            {modePilih && (
              <div className="mt-2 max-h-48 overflow-y-auto border border-line rounded-control divide-y divide-line" data-testid="pilih-kartu-gaya">
                {targetPalet.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-surface-2">
                    <input
                      type="checkbox"
                      checked={terpilih.includes(t.id)}
                      onChange={(e) =>
                        setTerpilih((p) => (e.target.checked ? [...p, t.id] : p.filter((x) => x !== t.id)))
                      }
                    />
                    <span className="truncate">{t.label}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-[10px] text-ink-3 mt-1">
              {modePilih
                ? terpilih.length > 0
                  ? `${terpilih.length} kartu dipilih. Warna kartu dan font tetap untuk semua kartu.`
                  : 'Centang kartu yang ingin diganti desain chart-nya.'
                : 'Desain chart dan palet berlaku untuk semua kartu di semua halaman.'}
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
          <span>Terapkan (belum tersimpan)</span>
        </button>
      </div>
    </div>
  );
};
