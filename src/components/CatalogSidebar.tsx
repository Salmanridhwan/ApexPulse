import React, { useState } from 'react';
import {
  BarChart3,
  Bookmark,
  Check,
  Filter,
  Layers,
  Loader2,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { WIDGET_CATALOG } from '../services/builder/catalog';
import { MONTHS_12 } from '../services/rag/mockData';
import { BumdSector, CatalogPreset, WidgetSpec } from '../types';

interface CatalogSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sector: BumdSector;
  onAddWidget: (widget: WidgetSpec) => void;
}

export const CatalogSidebar: React.FC<CatalogSidebarProps> = ({
  isOpen,
  onClose,
  sector,
  onAddWidget,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [sectorTab, setSectorTab] = useState<'current' | 'universal' | 'all'>('current');
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});
  const [memuatIds, setMemuatIds] = useState<Record<string, boolean>>({});
  const [galat, setGalat] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const filteredPresets = WIDGET_CATALOG.filter((preset) => {
    // Sector filter
    if (sectorTab === 'current') {
      const isRelevant = preset.sektor.includes(sector) || preset.sektor.includes('universal');
      if (!isRelevant) return false;
    } else if (sectorTab === 'universal') {
      if (!preset.sektor.includes('universal')) return false;
    }

    // Category filter
    if (selectedCategory !== 'Semua' && preset.kategori !== selectedCategory) {
      return false;
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const match =
        preset.id.toLowerCase().includes(term) ||
        preset.nama.toLowerCase().includes(term) ||
        preset.deskripsi.toLowerCase().includes(term) ||
        preset.queryRagContoh.toLowerCase().includes(term);
      if (!match) return false;
    }

    return true;
  });

  const jumlahUniversal = WIDGET_CATALOG.filter((p) => p.sektor.includes('universal')).length;

  /**
   * Tambah widget dari preset: definisi indikator dari katalog, ANGKANYA dari dokumen
   * resmi lewat /api/widgets/ambil-data. Kalau dokumen tidak memuat indikatornya,
   * widget tidak ditambahkan (tidak ada angka contoh atau sitasi palsu).
   */
  const handleAdd = async (preset: CatalogPreset) => {
    const tipe = preset.tipeChart[0] || 'kpi';
    setMemuatIds((prev) => ({ ...prev, [preset.id]: true }));
    setGalat((prev) => ({ ...prev, [preset.id]: '' }));
    try {
      const res = await fetch('/api/widgets/ambil-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: preset.queryRagContoh, tipe, sector }),
      });
      const isi = await res.json().catch(() => null);
      if (!res.ok || !isi?.widget) {
        setGalat((prev) => ({ ...prev, [preset.id]: isi?.error || 'Gagal mengambil data dari dokumen.' }));
        return;
      }
      const sumber = isi.widget;
      const widget: WidgetSpec = {
        id: `w-preset-${preset.id}-${Date.now()}`,
        presetId: preset.id,
        type: sumber.type,
        // Judul memakai nama metrik yang benar-benar diambil dari dokumen, sedangkan
        // preset yang dipakai dicatat di subjudul. Jadi tidak ada widget yang diberi
        // label indikator lain padahal isinya metrik berbeda.
        title: sumber.title || preset.nama,
        subtitle: `${preset.id} · ${preset.nama}`,
        category: preset.kategori,
        confidence: 'sumber',
        grid: { x: 0, y: 0, w: preset.defaultLayout.w, h: preset.defaultLayout.h },
        kpi: sumber.kpi,
        chart: sumber.chart,
        table: sumber.table,
        narasi: sumber.narasi,
        citations: sumber.citations || [],
        unitKerja: sumber.unitKerja,
        periode: sumber.periode,
        lastUpdated: new Date().toISOString(),
      };
      onAddWidget(widget);
      setAddedIds((prev) => ({ ...prev, [preset.id]: true }));
      setTimeout(() => setAddedIds((prev) => ({ ...prev, [preset.id]: false })), 2500);
    } catch {
      setGalat((prev) => ({ ...prev, [preset.id]: 'Tidak bisa menghubungi server.' }));
    } finally {
      setMemuatIds((prev) => ({ ...prev, [preset.id]: false }));
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[480px] bg-white border-l border-slate-200 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <span>Katalog Preset Widget</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 font-semibold">
                {WIDGET_CATALOG.length} Preset
              </span>
            </h2>
            <p className="text-xs text-slate-500">Preset indikator standar BUMD (PRD Bab 6)</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-3 border-b border-slate-200 space-y-2 bg-white">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari preset ID, nama indikator, atau kata kunci..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50/50"
          />
        </div>

        {/* Sector Tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-xs">
          <button
            onClick={() => setSectorTab('current')}
            className={`flex-1 py-1 px-2 rounded-md font-medium text-center transition-all ${sectorTab === 'current'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            Sektor {sector.toUpperCase()} & Universal
          </button>
          <button
            onClick={() => setSectorTab('universal')}
            className={`py-1 px-2.5 rounded-md font-medium text-center transition-all ${sectorTab === 'universal'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            Universal ({jumlahUniversal})
          </button>
          <button
            onClick={() => setSectorTab('all')}
            className={`py-1 px-2.5 rounded-md font-medium text-center transition-all ${sectorTab === 'all'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            Semua ({WIDGET_CATALOG.length})
          </button>
        </div>

        {/* Categories */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
          {['Semua', 'Keuangan', 'Operasional', 'Pelayanan', 'Kepatuhan & Risiko'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-[11px] whitespace-nowrap px-2.5 py-0.5 rounded-full transition-colors ${selectedCategory === cat
                  ? 'bg-sky-600 text-white font-medium'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Preset List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredPresets.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            Tidak ada preset yang cocok dengan filter.
          </div>
        ) : (
          filteredPresets.map((preset) => {
            const isAdded = addedIds[preset.id];
            const isMemuat = memuatIds[preset.id];
            return (
              <div
                key={preset.id}
                className="bg-white border border-slate-200 rounded-xl p-3.5 hover:border-sky-300 hover:shadow-xs transition-all space-y-2 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                      {preset.id}
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      {preset.nama}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                    {preset.kategori}
                  </span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  {preset.deskripsi}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>Satuan: <strong className="text-slate-600">{preset.satuan}</strong></span>
                    <span>•</span>
                    <span className="capitalize">{preset.tipeChart.join(', ')}</span>
                  </div>

                  <button
                    onClick={() => handleAdd(preset)}
                    disabled={isMemuat}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-60 ${isAdded
                        ? 'bg-emerald-600 text-white'
                        : 'bg-sky-50 text-sky-700 hover:bg-sky-600 hover:text-white'
                      }`}
                  >
                    {isMemuat ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Mengambil data...</span>
                      </>
                    ) : isAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Ditambahkan!</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Tambah</span>
                      </>
                    )}
                  </button>
                </div>

                {galat[preset.id] && (
                  <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1.5 leading-relaxed">
                    {galat[preset.id]}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
