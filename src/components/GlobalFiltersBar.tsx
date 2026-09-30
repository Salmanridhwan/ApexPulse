import React from 'react';
import { Calendar, Filter, Layers, MapPin, SlidersHorizontal } from 'lucide-react';
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
    <div className="bg-white border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap text-xs shadow-2xs">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-slate-500 font-medium shrink-0">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
          <span>Filter Global:</span>
        </div>

        {/* Periode Chip Dropdown */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
          <Calendar className="w-3.5 h-3.5 text-sky-600" />
          <span className="text-slate-500 text-[11px]">Periode:</span>
          <select
            value={filters.periode}
            onChange={(e) => onChange({ ...filters, periode: e.target.value })}
            className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
          >
            <option value="2026-Q1">Triwulan I 2026 (Aktual)</option>
            <option value="2026-Q2">Triwulan II 2026</option>
            <option value="2026-FY">Tahun Penuh 2026 (12 Bulan)</option>
            <option value="2025-FY">Tahun Buku 2025 (YoY)</option>
          </select>
        </div>

        {/* Unit Kerja Chip Dropdown */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-slate-500 text-[11px]">Unit Kerja:</span>
          <select
            value={filters.unitKerja}
            onChange={(e) => onChange({ ...filters, unitKerja: e.target.value })}
            className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
          >
            <option value="Semua">Semua Unit Kerja</option>
            <option value="Kantor Pusat">Kantor Pusat</option>
            <option value="Wilayah Barat">Wilayah Barat</option>
            <option value="Wilayah Timur">Wilayah Timur</option>
          </select>
        </div>

        {/* Kategori Filter Chip */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
          <Layers className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-slate-500 text-[11px]">Kategori:</span>
          <select
            value={filters.kategori}
            onChange={(e) => onChange({ ...filters, kategori: e.target.value })}
            className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
          >
            <option value="Semua">Semua Kategori</option>
            <option value="Keuangan">Keuangan</option>
            <option value="Operasional">Operasional</option>
            <option value="Pelayanan">Pelayanan</option>
            <option value="Kepatuhan & Risiko">Kepatuhan & Risiko</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 text-slate-400 text-[11px]">
        <span>Menampilkan <strong>{totalWidgets}</strong> widget aktif</span>
      </div>
    </div>
  );
};
