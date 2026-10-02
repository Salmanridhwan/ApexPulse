import React from 'react';
import { Calendar, Layers, MapPin } from 'lucide-react';
import { GlobalFilters } from '../types';

interface GlobalFiltersBarProps {
  filters: GlobalFilters;
  onChange: (updatedFilters: GlobalFilters) => void;
  totalWidgets: number;
}

export const GlobalFiltersBar: React.FC<GlobalFiltersBarProps> = ({
  filters,
  onChange,
  totalWidgets,
}) => {
  return (
    <div className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 flex items-center justify-between gap-4 flex-wrap text-xs shadow-2xs">
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Widget count pill */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-slate-700 bg-slate-100/90 border border-slate-200/80 rounded-xl">
          {totalWidgets} Widget
        </span>

        {/* Periode Chip Dropdown */}
        <div className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl px-3 py-1.5 transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
          <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="text-slate-500 font-medium shrink-0">Periode:</span>
          <select
            value={filters.periode}
            onChange={(e) => onChange({ ...filters, periode: e.target.value })}
            className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer pr-1"
          >
            <option value="2026-Q1">Triwulan I 2026</option>
            <option value="2026-Q2">Triwulan II 2026</option>
            <option value="2026-FY">Tahun Penuh 2026</option>
            <option value="2025-FY">Tahun 2025</option>
          </select>
        </div>

        {/* Unit Kerja Chip Dropdown */}
        <div className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl px-3 py-1.5 transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="text-slate-500 font-medium shrink-0">Unit Kerja:</span>
          <select
            value={filters.unitKerja}
            onChange={(e) => onChange({ ...filters, unitKerja: e.target.value })}
            className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer pr-1"
          >
            <option value="Semua">Semua Unit</option>
            <option value="Kantor Pusat">Kantor Pusat</option>
            <option value="Wilayah Barat">Wilayah Barat</option>
            <option value="Wilayah Timur">Wilayah Timur</option>
          </select>
        </div>

        {/* Kategori Filter Chip */}
        <div className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl px-3 py-1.5 transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
          <Layers className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="text-slate-500 font-medium shrink-0">Kategori:</span>
          <select
            value={filters.kategori}
            onChange={(e) => onChange({ ...filters, kategori: e.target.value })}
            className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer pr-1"
          >
            <option value="Semua">Semua Kategori</option>
            <option value="Keuangan">Keuangan</option>
            <option value="Operasional">Operasional</option>
            <option value="Pelayanan">Pelayanan</option>
            <option value="Kepatuhan & Risiko">Kepatuhan & Risiko</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 text-slate-400 text-xs">
        <span>{totalWidgets} widget aktif</span>
      </div>
    </div>
  );
};
