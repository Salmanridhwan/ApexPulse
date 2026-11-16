import React, { useMemo } from 'react';
import { Calendar, Layers, MapPin, RotateCcw, Save } from 'lucide-react';
import { GlobalFilters, WidgetSpec } from '../types';
import { kategoriEfektif, unitRingkas } from '../services/spec/kategoriWidget';
import { cocokPeriode, periodeTersedia } from '../services/filter/periode';

export { cocokPeriode, urutPeriode } from '../services/filter/periode';

interface GlobalFiltersBarProps {
  filters: GlobalFilters;
  onChange: (updatedFilters: GlobalFilters) => void;
  /** Widget pada dashboard — sumber opsi filter. */
  widgets: WidgetSpec[];
  /** Jumlah widget yang tampil (tidak lagi ditampilkan di UI, dipertahankan untuk kompatibilitas caller). */
  shownCount?: number;
  /** Jumlah kartu di halaman aktif — dipakai keterangan "x dari y kartu" saat filter aktif. */
  jumlahKartu?: number;
  /**
   * TATA LETAK BERUBAH — begitu kartu digeser atau diubah ukurannya, dua tombol
   * Simpan dan Reset muncul di ujung kanan baris filter ini. Tata letak baru
   * belum dikirim ke server sebelum Simpan ditekan.
   */
  tataLetakBerubah?: boolean;
  onSimpanTataLetak?: () => void;
  onResetTataLetak?: () => void;
  /**
   * Sisipan di ujung kanan baris filter — dipakai chip Insight AI halaman supaya
   * ikut satu baris dengan Periode / Unit Kerja / Kategori.
   *
   * Kalau `sisipan` diisi, bar tetap tampil walau dashboard tidak punya dimensi
   * filter (bar dulu mengembalikan null), karena chip itu tetap perlu terlihat.
   */
  sisipan?: React.ReactNode;
}

/**
 * Nilai unik yang benar-benar ada pada widget (bukan daftar hardcode), sudah
 * dirapikan dan diurutkan supaya pilihannya stabil antardokumen.
 */
function opsiUnik(nilai: Array<string | undefined | null>): string[] {
  const bersih = nilai
    .map((v) => (v ?? '').trim())
    .filter((v) => v !== '' && v.toLowerCase() !== 'semua');
  return Array.from(new Set(bersih)).sort((a, b) => a.localeCompare(b, 'id'));
}

/**
 * Cocokkan satu widget dengan filter yang dipilih.
 *
 * Kolom kosong berarti widget tidak terikat dimensi itu (mis. grafik yang
 * mencakup beberapa periode sekaligus). Widget seperti itu tetap tampil untuk
 * semua pilihan, bukan disembunyikan — kalau disembunyikan, memilih satu
 * periode akan mengosongkan seluruh papan.
 */
export const cocokFilter = (w: WidgetSpec, f: GlobalFilters): boolean => {
  const unit = unitRingkas(w.unitKerja);
  const kategori = kategoriEfektif(w);
  return (
    cocokPeriode(w, f.periode) &&
    (f.unitKerja === 'Semua' || !unit || unit === f.unitKerja) &&
    (f.kategori === 'Semua' || !kategori || kategori === f.kategori)
  );
};

const chipDasar =
  'inline-flex items-center gap-1.5 bg-surface hover:bg-surface-2/60 border border-line rounded-card px-3 py-1.5 transition-all shadow-sm';
const selectDasar =
  'bg-transparent font-bold text-ink focus:outline-none cursor-pointer pr-1 rounded-control';
/** Daftar pilihan bawaan browser mengikuti tema; tanpa ini tulisannya lenyap di tema gelap. */
const gayaOpsi: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-ink)',
};

/** Bar filter dashboard: Periode / Unit Kerja / Kategori, dipakai di workspace internal & halaman publik. */
export const GlobalFiltersBar: React.FC<GlobalFiltersBarProps> = ({
  filters,
  onChange,
  widgets,
  shownCount,
  jumlahKartu,
  tataLetakBerubah = false,
  onSimpanTataLetak,
  onResetTataLetak,
  sisipan,
}) => {
  const opsiPeriode = useMemo(() => ['Semua', ...periodeTersedia(widgets)], [widgets]);
  const opsiUnit = useMemo(() => ['Semua', ...opsiUnik(widgets.map((w) => unitRingkas(w.unitKerja)))], [widgets]);
  const opsiKategori = useMemo(() => ['Semua', ...opsiUnik(widgets.map((w) => kategoriEfektif(w)))], [widgets]);
  const ada = opsiPeriode.length > 1 || opsiUnit.length > 1 || opsiKategori.length > 1;
  /** Ada filter yang sedang aktif (dipakai keterangan "x dari y kartu"). */
  const filterAda = filters.periode !== 'Semua' || filters.unitKerja !== 'Semua' || filters.kategori !== 'Semua';

  if (!ada && !sisipan) return null;

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
            style={{ colorScheme: 'inherit' }}
          >
            {opsiPeriode.map((o) => (
              <option key={o} value={o} style={gayaOpsi}>
                {o === 'Semua' ? 'Semua Periode' : o}
              </option>
            ))}
          </select>
        </div>
      )}

      {opsiUnit.length > 1 && (
        <div className={`${chipDasar} focus-within:ring-2 focus-within:ring-pos/20 focus-within:border-pos`}>
          <MapPin className="w-3.5 h-3.5 text-pos shrink-0" />
          <span className="text-ink-2 font-medium shrink-0">Unit Kerja:</span>
          <select
            value={filters.unitKerja}
            onChange={(e) => onChange({ ...filters, unitKerja: e.target.value })}
            className={selectDasar}
            style={{ colorScheme: 'inherit' }}
          >
            {opsiUnit.map((o) => (
              <option key={o} value={o} style={gayaOpsi}>
                {o === 'Semua' ? 'Semua Unit' : o}
              </option>
            ))}
          </select>
        </div>
      )}

      {opsiKategori.length > 1 && (
        <div className={`${chipDasar} focus-within:ring-2 focus-within:ring-warn/20 focus-within:border-warn`}>
          <Layers className="w-3.5 h-3.5 text-warn shrink-0" />
          <span className="text-ink-2 font-medium shrink-0">Kategori:</span>
          <select
            value={filters.kategori}
            onChange={(e) => onChange({ ...filters, kategori: e.target.value })}
            className={selectDasar}
            style={{ colorScheme: 'inherit' }}
          >
            {opsiKategori.map((o) => (
              <option key={o} value={o} style={gayaOpsi}>
                {o === 'Semua' ? 'Semua Kategori' : o}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Umpan balik jumlah: tanpa ini efek filter tidak terlihat saat kartu yang
          disembunyikan sedikit (banyak kartu memang tanpa dimensi periode). */}
      {filterAda && typeof shownCount === 'number' && typeof jumlahKartu === 'number' && (
        <span className="text-[11px] text-ink-3 tabular-nums" data-testid="filter-jumlah">
          {shownCount} dari {jumlahKartu} kartu
        </span>
      )}

      {/* Simpan / Reset tata letak — hanya tampil setelah kartu digeser atau diubah ukurannya */}
      {tataLetakBerubah && (
        <div className="ml-auto flex items-center gap-1.5" data-testid="aksi-tata-letak">
          <span className="text-[11px] font-medium text-ink-3 hidden sm:inline">Perubahan belum disimpan</span>
          {onResetTataLetak && (
            <button
              type="button"
              onClick={onResetTataLetak}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
          {onSimpanTataLetak && (
            <button
              type="button"
              onClick={onSimpanTataLetak}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-on-solid bg-solid hover:bg-solid/90 rounded-control transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Simpan
            </button>
          )}
        </div>
      )}

      {/* Sisipan pemanggil (chip Insight AI) — satu baris dengan filter. */}
      {sisipan && <div className={`shrink-0 ${tataLetakBerubah ? '' : 'ml-auto'}`}>{sisipan}</div>}
    </div>
  );
};

/** Apakah filter berada pada kondisi default (tanpa penyaringan). */
export const filterDefault = (f: GlobalFilters): boolean =>
  f.periode === 'Semua' && f.unitKerja === 'Semua' && f.kategori === 'Semua';
