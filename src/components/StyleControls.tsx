import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { WidgetStyle, WidgetType } from '../types';
import { PALET, URUTAN_PALET, FONT_TERSEDIA, adaGaya, bersihkanGaya } from './widgets/widgetStyle';
import { KARTU_PRESET, URUTAN_KARTU, temaKartu } from './widgets/widgetCardTheme';

/** Tipe yang memakai ketebalan garis / radius batang. */
const TIPE_GARIS: WidgetType[] = ['line', 'area', 'scatter', 'bubble'];
const TIPE_BATANG: WidgetType[] = ['bar', 'hbar', 'waterfall', 'bullet-target', 'kpi'];

export interface StyleControlsProps {
  style: WidgetStyle;
  onChange: (next: WidgetStyle) => void;
  /**
   * Nama tiap seri untuk label pemilih warna.
   * Kosong = sembunyikan pemilih warna per-seri (mis. di modal global, karena
   * tiap widget punya seri berbeda).
   */
  namaSeri?: string[];
  /**
   * `widget` = sembunyikan penggeser yang tak relevan dengan tipe widget ini.
   * `global` = tampilkan keduanya, karena dashboard bisa berisi aneka tipe.
   */
  mode?: 'widget' | 'global';
  /** Tipe widget aktif (hanya dipakai di mode `widget`). */
  tipeWidget?: WidgetType;
}

/**
 * Kontrol gaya tampilan widget (palet, warna per-seri, font, ukuran, bentuk).
 *
 * Dipakai bersama oleh tab "Warna & Font" di editor per-widget dan modal
 * "Gaya Semua Widget": satu sumber kontrol supaya keduanya tidak pernah
 * berbeda perilaku saat ditambah opsi baru.
 */
export const StyleControls: React.FC<StyleControlsProps> = ({
  style,
  onChange,
  namaSeri,
  mode = 'widget',
  tipeWidget,
}) => {
  const ubah = (patch: Partial<WidgetStyle>) => onChange(bersihkanGaya({ ...style, ...patch }));

  const tampilGaris = mode === 'global' || (tipeWidget ? TIPE_GARIS.includes(tipeWidget) : false);
  const tampilBatang = mode === 'global' || (tipeWidget ? TIPE_BATANG.includes(tipeWidget) : false);

  const jumlahSeri = namaSeri?.length ?? 0;
  const warnaSeri = Array.from({ length: Math.min(jumlahSeri, 8) }, (_, i) => style.warnaSeri?.[i] || '');
  const setWarnaSeri = (i: number, warna: string) => {
    const next = [...warnaSeri];
    next[i] = warna;
    while (next.length && !next[next.length - 1]) next.pop();
    ubah({ warnaSeri: next.length ? next : undefined });
  };

  return (
    <div className="space-y-5">
      {/* Warna latar KARTU — ditaruh paling atas karena efeknya paling terlihat:
          seluruh kartu berubah warna, bukan hanya seri chartnya. */}
      <div>
        <label className="block text-ink-2 font-medium mb-2">Warna Kartu</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {URUTAN_KARTU.map((id) => {
            const p = KARTU_PRESET[id];
            const aktif = (style.kartu || '') === p.warna;
            return (
              <button
                key={id}
                type="button"
                onClick={() => ubah({ kartu: p.warna || undefined })}
                className={`p-2 rounded-card border text-left transition-all ${aktif ? 'border-brand ring-1 ring-brand' : 'border-line hover:bg-surface-2'
                  }`}
              >
                <span className="block text-[10px] font-semibold text-ink mb-1.5">{p.label}</span>
                <span
                  className="block h-4 rounded-xs border border-line"
                  style={
                    p.warna
                      ? { background: p.warna }
                      : {
                        background:
                          'linear-gradient(135deg, var(--color-surface) 0 50%, var(--color-surface-2) 50% 100%)',
                      }
                  }
                />
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-ink-3 mt-1.5">
          Mengubah warna latar kartu; warna teks & label chart menyesuaikan otomatis agar tetap terbaca.
        </p>

        {/* Warna kustom bebas + peringatan kontras */}
        <div className="flex items-center gap-2 mt-2.5">
          <input
            type="color"
            value={style.kartu || '#ffffff'}
            onChange={(e) => ubah({ kartu: e.target.value })}
            className="w-8 h-8 rounded-control border border-line cursor-pointer bg-surface p-0.5"
            title="Pilih warna kartu sendiri"
          />
          <span className="text-[11px] text-ink-2">Warna khusus</span>
          {style.kartu && (
            <button
              type="button"
              onClick={() => ubah({ kartu: undefined })}
              className="text-[10px] text-ink-3 hover:text-neg underline"
            >
              kembalikan
            </button>
          )}
        </div>

        {/* Peringatan jujur kalau warna pilihannya bikin teks sulit dibaca */}
        {style.kartu && temaKartu(style.kartu).peringatanKontras && (
          <p className="mt-2 flex items-start gap-1.5 text-[10px] text-warn">
            <AlertTriangle className="w-3 h-3 mt-px shrink-0" />
            <span>{temaKartu(style.kartu).peringatanKontras}</span>
          </p>
        )}
      </div>

      {/* Palet warna seri chart */}
      <div>
        <label className="block text-ink-2 font-medium mb-2">Palet Warna Chart</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {URUTAN_PALET.map((id) => {
            const p = PALET[id];
            const aktif = (style.palette || 'default') === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => ubah({ palette: id === 'default' ? undefined : id })}
                className={`p-2 rounded-card border text-left transition-all ${aktif ? 'border-brand ring-1 ring-brand' : 'border-line hover:bg-surface-2'
                  }`}
              >
                <span className="block text-[10px] font-semibold text-ink mb-1.5">{p.label}</span>
                <span className="flex gap-0.5 h-3">
                  {(p.warna.length ? p.warna : ['#9ca3af', '#d1d5db']).slice(0, 5).map((w, i) => (
                    <span key={i} className="flex-1 rounded-xs" style={{ background: w }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-ink-3 mt-1.5">
          Palet menimpa warna seluruh seri. "Bawaan" = warna tema aplikasi.
        </p>
      </div>

      {/* Warna kustom per-seri */}
      {jumlahSeri > 1 && (
        <div>
          <label className="block text-ink-2 font-medium mb-2">
            Warna Khusus per-Seri (menimpa palet)
          </label>
          <div className="space-y-2">
            {warnaSeri.map((w, i) => {
              const nama = namaSeri?.[i] || `Seri ${i + 1}`;
              return (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={w || '#1fa6cc'}
                    onChange={(e) => setWarnaSeri(i, e.target.value)}
                    className="w-8 h-8 rounded-control border border-line cursor-pointer bg-surface p-0.5"
                  />
                  <span className="text-[11px] text-ink-2 truncate flex-1">{nama}</span>
                  {w && (
                    <button
                      type="button"
                      onClick={() => setWarnaSeri(i, '')}
                      className="text-[10px] text-ink-3 hover:text-neg underline"
                    >
                      kosongkan
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Font & ukuran */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-ink-2 font-medium mb-1">Jenis Font</label>
          <select
            value={style.font || ''}
            onChange={(e) => ubah({ font: (e.target.value || undefined) as WidgetStyle['font'] })}
            className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="">Bawaan (Inter)</option>
            {FONT_TERSEDIA.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-ink-2 font-medium mb-1">
            Ukuran Font Label: {style.fontUkuran ?? 10} px
          </label>
          <input
            type="range"
            min={8}
            max={18}
            step={1}
            value={style.fontUkuran ?? 10}
            onChange={(e) => {
              const v = Number(e.target.value);
              ubah({ fontUkuran: v === 10 ? undefined : v });
            }}
            className="w-full accent-brand mt-2"
          />
        </div>
      </div>

      {/* Ketebalan garis */}
      {tampilGaris && (
        <div>
          <label className="block text-ink-2 font-medium mb-1">
            Ketebalan Garis: {style.garisTebal ?? 2} px
          </label>
          <input
            type="range"
            min={0.5}
            max={8}
            step={0.5}
            value={style.garisTebal ?? 2}
            onChange={(e) => {
              const v = Number(e.target.value);
              ubah({ garisTebal: v === 2 ? undefined : v });
            }}
            className="w-full accent-brand"
          />
        </div>
      )}

      {/* Sudut batang */}
      {tampilBatang && (
        <div>
          <label className="block text-ink-2 font-medium mb-1">
            Sudut Batang: {style.batangRadius ?? 4} px
          </label>
          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={style.batangRadius ?? 4}
            onChange={(e) => {
              const v = Number(e.target.value);
              ubah({ batangRadius: v === 4 ? undefined : v });
            }}
            className="w-full accent-brand"
          />
        </div>
      )}

      {/* Reset */}
      <div className="pt-3 border-t border-line">
        <button
          type="button"
          onClick={() => onChange({})}
          disabled={!adaGaya(style)}
          className="px-3 py-2 border border-line rounded-control text-ink-2 hover:bg-surface-2 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Kembalikan ke Bawaan</span>
        </button>
      </div>
    </div>
  );
};
