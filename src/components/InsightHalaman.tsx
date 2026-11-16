import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Lightbulb, Loader2, RefreshCw, Sparkles, Target } from 'lucide-react';
import type { HalamanDashboard, InsightHalaman as TipeInsightHalaman } from '../types';
import { insightUsang, perluBuatInsight } from '../services/analisis/insightHalaman';

/**
 * CHIP INSIGHT AI SATU HALAMAN.
 *
 * Satu baris ringkas yang duduk SEBARIS dengan chip filter Periode / Unit /
 * Kategori di atas kanvas: ikon + "Insight AI" + cuplikan kalimat pertama.
 * Diklik untuk membuka panel berisi tafsir lengkap, Temuan, dan Saran.
 *
 * Dua aturan penting:
 *
 * 1. Dibuat OTOMATIS sekali saat halaman pertama kali dibuka, lalu hasilnya
 *    tersimpan di halaman (`halaman[].insight`). Membuka halaman yang sama lagi
 *    tidak memanggil model lagi. Penjaga `sudahDiminta` mencegah panggilan ganda
 *    saat komponen ini ter-mount ulang.
 * 2. Kalau kartu halaman berubah, insight lama ditandai "berubah" dan pengguna
 *    bisa memintanya ulang. Tidak ada teks pengganti yang mengaku AI.
 */

/**
 * Penjaga antar-mount: satu percobaan per halaman per sesi peramban.
 *
 * Tanpa ini, pindah halaman lalu kembali (atau render ulang App) akan memanggil
 * model lagi berkali-kali untuk halaman yang sama.
 */
const sudahDiminta = new Set<string>();

interface Props {
  dashboardId: string;
  halaman: HalamanDashboard;
  /** Hanya peran yang boleh menyusun dashboard yang boleh meminta insight. */
  bolehBuat: boolean;
  /** Tulis hasil ke state halaman di App (tanpa menimpa draft tata letak). */
  onInsight: (halamanId: string, insight: TipeInsightHalaman) => void;
}

const jam = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/** Kalimat pertama saja — untuk cuplikan di chip satu baris. */
export const kalimatPertama = (teks: string): string => {
  const t = String(teks || '').trim();
  const m = /^(.+?[.!?])(\s|$)/.exec(t);
  return (m ? m[1] : t).trim();
};

export const InsightHalaman: React.FC<Props> = ({ dashboardId, halaman, bolehBuat, onInsight }) => {
  const insight = halaman.insight;
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');
  const [buka, setBuka] = useState(false);
  const wadah = useRef<HTMLDivElement | null>(null);
  const usang = useMemo(() => insightUsang(halaman), [halaman]);

  const minta = async (segarkan: boolean) => {
    setSibuk(true);
    setGalat('');
    try {
      const res = await fetch(`/api/dashboards/${dashboardId}/halaman/${halaman.id}/insight`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segarkan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.insight) {
        throw new Error(String(data?.error || 'Insight halaman belum bisa dibuat.'));
      }
      onInsight(halaman.id, data.insight as TipeInsightHalaman);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Insight halaman belum bisa dibuat.');
      setBuka(true);
    } finally {
      setSibuk(false);
    }
  };

  // Buat sekali saat halaman pertama kali dibuka (hanya peran penyusun).
  useEffect(() => {
    if (!bolehBuat || !perluBuatInsight(halaman)) return;
    const kunci = `${dashboardId}|${halaman.id}`;
    if (sudahDiminta.has(kunci)) return;
    sudahDiminta.add(kunci);
    void minta(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardId, halaman.id, bolehBuat]);

  // Klik di luar panel atau Escape menutup panel.
  useEffect(() => {
    if (!buka) return;
    const klikLuar = (e: MouseEvent) => {
      if (wadah.current && !wadah.current.contains(e.target as Node)) setBuka(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBuka(false);
    };
    document.addEventListener('mousedown', klikLuar);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', klikLuar);
      document.removeEventListener('keydown', escape);
    };
  }, [buka]);

  const cuplikan = useMemo(() => {
    if (galat) return 'belum tersedia';
    if (sibuk && !insight) return 'membaca halaman ini…';
    if (!insight) return bolehBuat ? 'belum dibuat' : '';
    return kalimatPertama(insight.ringkasan);
  }, [galat, sibuk, insight, bolehBuat]);

  // Tanpa kartu dan tanpa hasil: tidak ada yang perlu ditampilkan.
  if ((halaman.widgets || []).length === 0) return null;
  // Peran pembaca tanpa insight tersimpan: jangan tampilkan chip yang tidak bisa ia penuhi.
  if (!bolehBuat && !insight) return null;

  return (
    <div ref={wadah} className="relative" data-testid="insight-halaman">
      <button
        type="button"
        onClick={() => setBuka((v) => !v)}
        data-testid="insight-toggle"
        aria-expanded={buka}
        title={insight ? 'Lihat insight halaman ini' : 'Insight halaman ini'}
        className="inline-flex items-center gap-1.5 max-w-[24rem] bg-surface hover:bg-surface-2/60 border border-line rounded-card px-3 py-1.5 transition-all shadow-sm"
      >
        <Sparkles className="w-3.5 h-3.5 text-brand shrink-0" />
        <span className="font-bold text-ink shrink-0">Insight AI</span>
        <span className="truncate text-ink-2" data-testid="insight-ringkas">
          {cuplikan}
        </span>
        {usang && (
          <span
            data-testid="insight-usang"
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-control bg-warn/15 text-warn shrink-0"
          >
            berubah
          </span>
        )}
        {sibuk ? (
          <Loader2 className="w-3.5 h-3.5 text-brand animate-spin shrink-0" />
        ) : (
          <ChevronDown className={`w-3.5 h-3.5 text-ink-3 shrink-0 transition-transform ${buka ? 'rotate-180' : ''}`} />
        )}
      </button>

      {buka && (
        <div
          data-testid="insight-isi"
          className="absolute right-0 top-full mt-1.5 z-50 w-[min(26rem,calc(100vw-2rem))] rounded-card border border-line bg-surface shadow-xl p-3"
        >
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-ink">Insight AI halaman ini</p>
            {bolehBuat && (
              <button
                onClick={() => void minta(true)}
                disabled={sibuk}
                data-testid="insight-perbarui"
                title="Minta insight baru"
                className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-control text-[11px] font-semibold text-ink-2 hover:text-ink hover:bg-surface-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${sibuk ? 'animate-spin' : ''}`} />
                Perbarui
              </button>
            )}
          </div>

          {galat && (
            <p className="mt-1.5 text-[11px] text-neg" data-testid="insight-galat">
              {galat}
            </p>
          )}

          {!galat && sibuk && !insight && (
            <p className="mt-1.5 text-[11px] text-ink-3" data-testid="insight-memuat">
              AI sedang membaca kartu di halaman ini…
            </p>
          )}

          {!insight && !sibuk && !galat && bolehBuat && (
            <p className="mt-1.5 text-[11px] text-ink-3">Belum ada insight untuk halaman ini.</p>
          )}

          {insight && (
            <>
              <p className="mt-1.5 text-xs leading-relaxed text-ink">{insight.ringkasan}</p>

              {insight.temuan.length > 0 && (
                <div className="mt-2">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-ink-3">
                    <Lightbulb className="w-3 h-3" /> Temuan
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {insight.temuan.map((t, i) => (
                      <li key={i} className="text-[11px] leading-snug text-ink-2 flex gap-1.5">
                        <span className="text-brand">•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insight.saran.length > 0 && (
                <div className="mt-2">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-ink-3">
                    <Target className="w-3 h-3" /> Saran
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {insight.saran.map((t, i) => (
                      <li key={i} className="text-[11px] leading-snug text-ink-2 flex gap-1.5">
                        <span className="text-brand">→</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-2 text-[10px] text-ink-3">
                Ditulis AI dari angka di halaman ini · {jam(insight.dibuatPada)}
                {sibuk ? ' · memperbarui…' : ''}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
