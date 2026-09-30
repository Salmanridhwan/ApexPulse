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
}) => {
  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;

  return (
    <div className="flex flex-col justify-between h-full p-1 space-y-3">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold font-mono tracking-tight text-slate-900 tabular-nums">
            {value}
          </span>
          {unit && unit !== '%' && (
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {unit}
            </span>
          )}
        </div>

        {/* Delta Indicator */}
        {delta !== undefined && (
          <div className="flex items-center gap-1.5 mt-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums ${
                isPositive
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                  : isNegative
                  ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {isPositive ? (
                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              ) : isNegative ? (
                <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
              ) : (
                <Minus className="w-3.5 h-3.5 mr-0.5" />
              )}
              {delta > 0 ? `+${delta}%` : `${delta}%`}
            </span>
            {deltaLabel && (
              <span className="text-[11px] text-slate-500 truncate" title={deltaLabel}>
                {deltaLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Target Progress Bar & Sparkline */}
      <div className="pt-2 border-t border-slate-100/80 space-y-2">
        {target !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1 truncate">
                <Target className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{targetLabel || `Target: ${target} ${unit || ''}`}</span>
              </span>
              <span className="font-mono font-semibold text-slate-700 tabular-nums">
                {typeof value === 'number' ? `${Math.round((value / target) * 100)}%` : 'Tercapai'}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isPositive ? 'bg-emerald-500' : 'bg-sky-500'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    typeof value === 'number' ? Math.round((value / target) * 100) : 92
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {sparkline && sparkline.length > 1 && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
              Tren Historis
            </span>
            <div className="flex items-end gap-1 h-5">
              {sparkline.map((val, i) => {
                const max = Math.max(...sparkline);
                const min = Math.min(...sparkline);
                const range = max - min || 1;
                const heightPct = Math.max(15, Math.round(((val - min) / range) * 100));
                return (
                  <div
                    key={i}
                    className="w-1.5 bg-sky-300 hover:bg-sky-600 rounded-t transition-colors cursor-help"
                    style={{ height: `${heightPct}%` }}
                    title={`Poin ${i + 1}: ${val}`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
