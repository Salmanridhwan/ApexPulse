import React, { useId } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, Target } from 'lucide-react';

interface KpiCardProps {
  value: string | number;
  unit?: string;
  delta?: number;
  deltaLabel?: string;
  target?: number;
  targetLabel?: string;
  sparkline?: number[];
  isCorrected?: boolean;
  /** Judul widget — dipakai mendeteksi metrik "semakin kecil semakin baik" (NRW dkk). */
  title?: string;
  /** `compact` (default) = angka lebih kecil & sparkline tipis; `hero` = angka besar. */
  variant?: 'hero' | 'compact';
}

/** Jalur SVG sparkline di ruang viewBox 0..100 × 0..100 (sumbu Y dibalik). */
function sparkPaths(vals: number[], pad = 8): { line: string; area: string } {
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const n = vals.length;
  const px = (i: number) => (i / (n - 1)) * 100;
  const py = (v: number) => 100 - pad - ((v - min) / range) * (100 - pad * 2);
  const pts = vals.map((v, i) => `${px(i).toFixed(2)},${py(v).toFixed(2)}`);
  return {
    line: `M ${pts.join(' L ')}`,
    area: `M 0,100 L ${pts.join(' L ')} L 100,100 Z`,
  };
}

export const KpiCard: React.FC<KpiCardProps> = ({
  value,
  unit,
  delta,
  deltaLabel,
  target,
  targetLabel,
  sparkline,
  isCorrected,
  title,
  variant = 'compact',
}) => {
  const gradId = useId().replace(/:/g, '');
  const hero = variant === 'hero';

  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;
  // Angka gaya Indonesia: koma sebagai pemisah desimal ("+6,9%", bukan "+6.9%").
  const fmtDelta = (d: number) => String(d).replace('.', ',');

  // Ukuran mengikuti varian: compact lebih rapat, hero menonjol.
  const angkaKelas = hero ? 'text-[2.75rem]' : 'text-[2rem]';
  const chipKelas = hero ? 'text-[11px]' : 'text-[10px]';
  const sparkTinggi = hero ? 'h-[68%]' : 'h-[52%]';
  const sparkTebal = hero ? 2 : 1.5;
  const sparkOpasitas = hero ? 0.2 : 0.14;

  // Semantik warna kontekstual (pola KPI dashboard: warna mengikuti arti metrik,
  // bukan arah panah). Metrik "semakin kecil semakin baik" (NRW, kebocoran, tunggakan)
  // menandai kenaikan sebagai buruk walau panahnya ke atas.
  const lowerIsBetter = /nrw|kebocoran|tunggakan|kehilangan|waktu tunggu|keluhan|kepadatan/i.test(
    `${title || ''} ${deltaLabel || ''}`
  );
  const deltaGood = delta === undefined ? false : lowerIsBetter ? delta < 0 : delta > 0;
  const deltaBad = delta === undefined ? false : lowerIsBetter ? delta > 0 : delta < 0;

  // Angka bisa datang terformat ("94,8%", "Rp 1,2 M") — parse utk hitung capaian target.
  const angkaValue =
    typeof value === 'number'
      ? value
      : parseFloat(String(value).replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')) || undefined;

  // Capaian target untuk bar progres & label persen.
  // Metrik "semakin kecil semakin baik" (NRW dkk): capaian = target/nilai —
  // nilai DI BAWAH target berarti tercapai (≥100%). Metrik biasa: nilai/target.
  const capaianPct =
    target !== undefined && angkaValue !== undefined && target > 0 && angkaValue > 0
      ? lowerIsBetter
        ? Math.round((target / angkaValue) * 100)
        : Math.round((angkaValue / target) * 100)
      : undefined;
  const targetTercapai =
    capaianPct !== undefined
      ? capaianPct >= 100
      : target !== undefined && angkaValue !== undefined
        ? lowerIsBetter
          ? angkaValue <= target
          : angkaValue >= target
        : false;

  // Beberapa produsen data sudah menaruh satuan di dalam `value` ("94,8%", "Rp 42,85 M").
  // Kalau `unit` ikut dirender, kartu menampilkan satuan dobel ("94,8%%", "Rp 42,85 MRupiah").
  // Aturan: sembunyikan `unit` bila nilainya sudah memuat satuan itu sendiri.
  const unitSudahAda = (() => {
    if (!unit) return true;
    const v = String(value).toLowerCase();
    const u = unit.toLowerCase();
    return (
      v.includes(u) ||
      (u.includes('rp') && v.includes('rp')) ||
      (u.startsWith('rupiah') && /rp|triliun|miliar|juta|ribu/.test(v))
    );
  })();
  const unitTampil = unitSudahAda ? undefined : unit;
  // Mata uang ditulis sebagai awalan ("Rp" sebelum angka), sisanya jadi keterangan satuan.
  const awalanRp = unitTampil && /^rp\b/i.test(unitTampil) ? 'Rp' : undefined;
  const satuanAkhir = awalanRp ? unitTampil!.replace(/^rp\.?\s*/i, '') || undefined : unitTampil;

  // Warna garis sparkline mengikuti makna tren: baik (hijau), buruk (merah), netral (biru).
  const warnaTren = deltaBad ? '#e11d48' : deltaGood ? '#059669' : '#4f46e5';
  const jalur =
    sparkline && sparkline.length > 1 ? sparkPaths(sparkline) : null;

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      {/* Sparkline sebagai LATAR — halus, tidak mengganggu keterbacaan angka. */}
      {jalur && (
        <svg
          data-testid="kpi-sparkline"
          className={`absolute inset-x-0 bottom-0 w-full pointer-events-none ${sparkTinggi}`}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`spk-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={warnaTren} stopOpacity={sparkOpasitas} />
              <stop offset="100%" stopColor={warnaTren} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={jalur.area} fill={`url(#spk-${gradId})`} className="kpi-spark-area" />
          <path
            d={jalur.line}
            fill="none"
            stroke={warnaTren}
            strokeWidth={sparkTebal}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            opacity="0.85"
            pathLength={1}
            className="kpi-spark-line"
          />
        </svg>
      )}

      {/* Konten di atas latar */}
      <div className={`relative z-10 flex flex-col justify-between h-full ${hero ? 'gap-2' : 'gap-1.5'}`}>
        <div className="flex items-baseline gap-2 flex-wrap">
          {awalanRp && (
            <span className={`${hero ? 'text-xl' : 'text-base'} font-bold text-slate-400`}>{awalanRp}</span>
          )}
          <span
            data-testid="kpi-value"
            className={`kpi-enter ${angkaKelas} leading-none font-extrabold tracking-tight tabular-nums ${
              isCorrected ? 'text-amber-800' : 'text-slate-900'
            }`}
          >
            {value}
          </span>
          {satuanAkhir && (
            <span className={`${hero ? 'text-sm' : 'text-xs'} font-semibold text-slate-400`}>{satuanAkhir}</span>
          )}
        </div>

        <div className="kpi-enter space-y-2">
          {(delta !== undefined || deltaLabel) && (
            <div className="flex items-center gap-1.5 min-w-0">
              {delta !== undefined && (
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-md ${chipKelas} font-bold tabular-nums shrink-0 ${
                    deltaGood
                      ? 'bg-emerald-50 text-emerald-700'
                      : deltaBad
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                  title={lowerIsBetter ? 'Metrik ini semakin kecil semakin baik' : undefined}
                >
                  {isPositive ? (
                    <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  ) : isNegative ? (
                    <ArrowDownRight className="w-3 h-3 mr-0.5" />
                  ) : (
                    <Minus className="w-3 h-3 mr-0.5" />
                  )}
                  {delta > 0 ? `+${fmtDelta(delta)}%` : `${fmtDelta(delta)}%`}
                </span>
              )}
              {deltaLabel && (
                <span className={`${chipKelas} font-medium text-slate-500 truncate`} title={deltaLabel}>
                  {deltaLabel}
                </span>
              )}
            </div>
          )}

          {target !== undefined && (
            <div className="space-y-1">
              <div className={`flex items-center justify-between gap-2 ${chipKelas} text-slate-500`}>
                <span className="flex items-center gap-1 min-w-0">
                  <Target className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate font-medium">
                    {targetLabel || `Target: ${target} ${unit || ''}`}
                  </span>
                </span>
                {capaianPct !== undefined ? (
                  <span
                    className={`font-bold tabular-nums shrink-0 ${
                      targetTercapai ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {capaianPct}% {targetTercapai ? '✓' : ''}
                  </span>
                ) : (
                  <span className="font-semibold text-ink shrink-0">Tercapai</span>
                )}
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    targetTercapai ? 'bg-emerald-500' : 'bg-brand'
                  }`}
                  style={{ width: `${Math.min(100, capaianPct ?? 92)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
