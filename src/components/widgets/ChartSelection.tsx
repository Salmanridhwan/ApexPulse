import React, { createContext, useContext, useMemo, useState } from 'react';
import { FilterX } from 'lucide-react';

/**
 * Seleksi lintas-chart ala Tableau: satu nilai kategori yang dipilih di satu
 * chart dipakai untuk menyaring chart lain di dashboard yang sama.
 * Dipasang sebagai context supaya ChartEcharts tidak perlu dikirim lewat
 * berlapis-lapis prop (WidgetCard -> WidgetRenderer -> ChartEcharts).
 */
interface ChartSelectionCtx {
  selected: string | null;
  setSelected: (value: string | null) => void;
}

const Ctx = createContext<ChartSelectionCtx>({ selected: null, setSelected: () => {} });

export const useChartSelection = (): ChartSelectionCtx => useContext(Ctx);

export const ChartSelectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const value = useMemo(() => ({ selected, setSelected }), [selected]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

/** Chip status seleksi aktif + tombol hapus. Tampil hanya bila ada seleksi. */
export const ActiveChartFilterChip: React.FC = () => {
  const { selected, setSelected } = useChartSelection();
  if (!selected) return null;
  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap" data-testid="chart-filter-chip">
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card text-xs bg-surface-2 border border-line text-ink">
        <span className="font-medium">Terfilter:</span>
        <span className="font-bold">{selected}</span>
      </span>
      <button
        type="button"
        onClick={() => setSelected(null)}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-card text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
        title="Hapus filter kategori"
      >
        <FilterX className="w-3.5 h-3.5" />
        <span>Hapus filter</span>
      </button>
    </div>
  );
};
