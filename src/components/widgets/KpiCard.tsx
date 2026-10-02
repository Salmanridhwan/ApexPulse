import React from 'react';
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
}) => {
  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;

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

  return (
    <div className="flex flex-col justify-between h-full space-y-3">
      {/* Angka besar polos ala referensi: 324 / Last Update: Yesterday */}
      <div>
        <div className="flex items-baseline gap-2">
          {awalanRp && <span className="text-xl font-bold text-slate-400">{awalanRp}</span>}
          <span
            className={`text-4xl font-extrabold tracking-tight tabular-nums ${
              isCorrected ? 'text-amber-800' : 'text-slate-900'
            }`}
          >
            {value}
          </span>
          {satuanAkhir && (
            <span className="text-sm font-semibold text-slate-400">{satuanAkhir}</span>
          )}
        </div>

        {(delta !== undefined || deltaLabel) && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {delta !== undefined && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums ${
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
                {delta > 0 ? `+${delta}%` : `${delta}%`}
              </span>
            )}
            {deltaLabel && (
              <span className="text-[11px] font-medium text-slate-500 truncate" title={deltaLabel}>
                {deltaLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Target & sparkline — ringkas */}
      <div className="space-y-2">
        {target !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1 truncate">
                <Target className="w-3 h-3 text-blue-400 shrink-0" />
                <span className="truncate font-medium">{targetLabel || `Target: ${target} ${unit || ''}`}</span>
              </span>
              {capaianPct !== undefined ? (
                <span
                  className={`font-bold tabular-nums ${
                    targetTercapai ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {capaianPct}% {targetTercapai ? '✓' : ''}
                </span>
              ) : (
                <span className="font-semibold text-blue-800">Tercapai</span>
              )}
            </div>
            <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  targetTercapai ? 'bg-emerald-500' : 'bg-blue-600'
                }`}
                style={{
                  width: `${Math.min(100, capaianPct ?? 92)}%`,
                }}
              />
            </div>
          </div>
        )}

        {sparkline && sparkline.length > 1 && (
          <div className="flex items-end gap-1 h-7">
            {sparkline.map((val, i) => {
              const max = Math.max(...sparkline);
              const min = Math.min(...sparkline);
              const range = max - min || 1;
              const heightPct = Math.max(15, Math.round(((val - min) / range) * 100));
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-blue-100 hover:bg-blue-500 transition-colors cursor-help"
                  style={{ height: `${heightPct}%` }}
                  title={`Poin ${i + 1}: ${val}`}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
