import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Loader2, Sparkles } from 'lucide-react';
import type { Dashboard } from '../types';

/**
 * PANEL AI SEDANG BEKERJA.
 *
 * Muncul di atas kanvas begitu tombol "Rekomendasi AI" ditekan. Isinya dibaca
 * dari dashboard yang sedang disusun (`status` + `ai`), jadi kanvas bisa
 * memperlihatkan apa yang benar-benar sedang diambil AI: berapa butir yang
 * dikirim, kategori apa saja yang tersedia, dan butir mana yang sudah dipilih.
 *
 * Panel hilang sendiri saat status berubah menjadi `siap`.
 */
/** 45 -> "45 detik", 279 -> "4 menit 39 detik", 240 -> "4 menit". */
function lamaTeks(detik: number) {
  const m = Math.floor(detik / 60);
  const s = detik % 60;
  if (m === 0) return `${s} detik`;
  return s === 0 ? `${m} menit` : `${m} menit ${s} detik`;
}

export function PanelAiMenyusun({ dashboard }: { dashboard: Dashboard }) {
  const ai = dashboard.ai;
  const gagal = dashboard.status === 'gagal';
  const [detik, setDetik] = useState(0);

  useEffect(() => {
    if (!ai?.mulai || gagal) return;
    const mulai = new Date(ai.mulai).getTime();
    const hitung = () => setDetik(Math.max(0, Math.round((Date.now() - mulai) / 1000)));
    hitung();
    const t = setInterval(hitung, 1000);
    return () => clearInterval(t);
  }, [ai?.mulai, gagal]);

  if (!ai) return null;

  if (gagal) {
    return (
      <div
        data-testid="panel-ai-gagal"
        className="mx-4 mt-4 rounded-card border border-neg/40 bg-neg/5 px-4 py-3 flex items-start gap-3"
      >
        <AlertTriangle className="w-5 h-5 text-neg shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-neg">AI tidak bisa menyusun dashboard</p>
          <p className="text-xs text-content-muted mt-1">{ai.galat || ai.pesan}</p>
          <p className="text-xs text-content-muted mt-1">
            Coba lagi dari halaman Pilih Data. Dashboard kosong ini bisa dihapus.
          </p>
        </div>
      </div>
    );
  }

  const terpilih = ai.terpilih || [];
  const tampil = terpilih.slice(0, 10);

  return (
    <div
      data-testid="panel-ai-menyusun"
      className="mx-4 mt-4 rounded-card border border-brand/30 bg-brand/5 px-4 py-3"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="relative flex w-2.5 h-2.5">
          <span className="absolute inline-flex w-full h-full rounded-full bg-brand opacity-60 animate-ping" />
          <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-brand" />
        </span>
        <Sparkles className="w-4 h-4 text-brand" />
        <p className="text-sm font-bold text-content">AI sedang menyusun dashboard</p>
        <span className="text-[11px] text-content-muted">
          {ai.pesan} · {lamaTeks(detik)}
        </span>
        <Loader2 className="w-3.5 h-3.5 text-brand animate-spin ml-auto" />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mt-2">
        <span className="text-[11px] text-content-muted">{ai.kandidat} butir dikirim ke AI</span>
        {(ai.kategori || []).slice(0, 8).map((k) => (
          <span
            key={k.nama}
            className="text-[11px] px-2 py-0.5 rounded-full bg-surface border border-line text-content-muted capitalize"
          >
            {k.nama} · {k.jumlah}
          </span>
        ))}
      </div>

      {tampil.length > 0 && (
        <div className="mt-2">
          <p className="text-[11px] font-semibold text-content-muted">Data yang sudah diambil AI</p>
          <ul className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
            {tampil.map((nama) => (
              <li key={nama} className="flex items-start gap-1.5 text-[11px] text-content">
                <Check className="w-3 h-3 text-pos shrink-0 mt-0.5" />
                <span className="truncate">{nama}</span>
              </li>
            ))}
          </ul>
          {terpilih.length > tampil.length && (
            <p className="text-[11px] text-content-muted mt-0.5">+{terpilih.length - tampil.length} data lain</p>
          )}
        </div>
      )}
    </div>
  );
}
