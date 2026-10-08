import React, { useMemo } from 'react';
import { Calendar, Layers, MapPin } from 'lucide-react';
import { GlobalFilters, WidgetSpec } from '../types';

interface GlobalFiltersBarProps {
  filters: GlobalFilters;
  onChange: (updatedFilters: GlobalFilters) => void;
  /** Widget pada dashboard — sumber opsi filter. */
  widgets: WidgetSpec[];
  /** Jumlah widget yang tampil (tidak lagi ditampilkan di UI, dipertahankan untuk kompatibilitas caller). */
  shownCount?: number;
}

/** Nilai unik yang benar-benar ada pada widget (bukan daftar hardcode). */
function opsiUnik(nilai: (string | undefined)[]): string[] {
  return Array.from(new Set(nilai.filter((v): v is string => !!v && v.trim() !== '')));
}

const chipDasar =
  'inline-flex items-center gap-1.5 bg-surface hover:bg-surface-2/60 border border-line rounded-card px-3 py-1.5 transition-all shadow-sm';
const selectDasar = 'bg-transparent font-bold text-ink focus:outline-none cursor-pointer pr-1';

/** Bar filter dashboard: Periode / Unit Kerja / Kategori, dipakai di workspace internal & halaman publik. */
export const GlobalFiltersBar: React.FC<GlobalFiltersBarProps> = ({
  filters,
  onChange,
  widgets,
}) => {
  const opsiPeriode = useMemo(() => ['Semua', ...opsiUnik(widgets.map((w) => w.periode))], [widgets]);
  const opsiUnit = useMemo(() => ['Semua', ...opsiUnik(widgets.map((w) => w.unitKerja))], [widgets]);
  const opsiKategori = useMemo(() => ['Semua', ...opsiUnik(widgets.map((w) => w.category))], [widgets]);
  const ada = opsiPeriode.length > 1 || opsiUnit.length > 1 || opsiKategori.length > 1;

  if (!ada) return null;

  return (
    <div className="flex items-center gap-2.5 flex-wrap text-xs" data-testid="dashboard-filter-bar">

      {opsiPeriode.length > 1 && (
        <div className={`${chipDasar} focus-within:ring-2 focus-within:ring-brand/20 focus-within:border-brand`}>
          <Calendar className="w-3.5 h-3.5 text-brand shrink-0" />
          <span className="text-ink-2 font-medium shrink-0">Periode:</span>
          <select
            value={filters.periode}
            onChange={(e) => onChange({ ...filters, periode: e.target.value })}
            className={selectDasar}
          >
            {opsiPeriode.map((o) => (
              <option key={o} value={o}>
                {o === 'Semua' ? 'Semua Periode' : o}
              </option>
            ))}
          </select>
        </div>
      )}

      {opsiUnit.length > 1 && (
        <div className={`${chipDasar} focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-pos`}>
          <MapPin className="w-3.5 h-3.5 text-pos shrink-0" />
          <span className="text-ink-2 font-medium shrink-0">Unit Kerja:</span>
          <select
            value={filters.unitKerja}
            onChange={(e) => onChange({ ...filters, unitKerja: e.target.value })}
            className={selectDasar}
          >
            {opsiUnit.map((o) => (
              <option key={o} value={o}>
                {o === 'Semua' ? 'Semua Unit' : o}
              </option>
            ))}
          </select>
        </div>
      )}

      {opsiKategori.length > 1 && (
        <div className={`${chipDasar} focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-warn`}>
          <Layers className="w-3.5 h-3.5 text-warn shrink-0" />
          <span className="text-ink-2 font-medium shrink-0">Kategori:</span>
          <select
            value={filters.kategori}
            onChange={(e) => onChange({ ...filters, kategori: e.target.value })}
            className={selectDasar}
          >
            {opsiKategori.map((o) => (
              <option key={o} value={o}>
                {o === 'Semua' ? 'Semua Kategori' : o}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

/** Apakah filter berada pada kondisi default (tanpa penyaringan). */
export const filterDefault = (f: GlobalFilters): boolean =>
  f.periode === 'Semua' && f.unitKerja === 'Semua' && f.kategori === 'Semua';
