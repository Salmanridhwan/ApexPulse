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

const PresetChartPreview: React.FC<{ preset: CatalogPreset }> = ({ preset }) => {
  const primaryType = preset.tipeChart[0] || 'bar';

  if (primaryType === 'kpi') {
    return (
      <div className="bg-shell text-shell-ink rounded-control p-2.5 flex items-center justify-between border border-shell-line my-2 shadow-inner">
        <div>
          <span className="text-[10px] text-shell-ink-2 font-medium block">Estimasi Nilai ({preset.satuan})</span>
          <div className="text-sm font-extrabold text-shell-ink tracking-tight flex items-baseline gap-1.5 mt-0.5">
            <span>128.4</span>
            <span className="text-[10px] font-semibold text-pos bg-pos/15 px-1.5 py-0.2 rounded border border-pos/30">+8.5% YoY</span>
          </div>
        </div>
        <div className="w-16 h-7 opacity-90">
          <svg viewBox="0 0 60 25" className="w-full h-full text-brand-ink">
            <path d="M0 20 Q15 5 30 15 T60 5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    );
  }

  if (primaryType === 'donut') {
    return (
      <div className="bg-shell text-shell-ink rounded-control p-2 flex items-center justify-between gap-2 border border-shell-line my-2">
        <div className="w-14 h-14 shrink-0 relative flex items-center justify-center">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="14" fill="none" stroke="#4d5667" strokeWidth="4.5" />
            <circle cx="18" cy="18" r="14" fill="none" stroke="#8f90e4" strokeWidth="4.5" strokeDasharray="45 100" />
            <circle cx="18" cy="18" r="14" fill="none" stroke="#38c6e2" strokeWidth="4.5" strokeDasharray="25 100" strokeDashoffset="-45" />
            <circle cx="18" cy="18" r="14" fill="none" stroke="#f2503a" strokeWidth="4.5" strokeDasharray="18 100" strokeDashoffset="-70" />
          </svg>
          <span className="absolute text-[8px] font-bold text-shell-ink-2">100%</span>
        </div>
        <div className="flex-1 space-y-1 text-[10px] pr-1">
          <div className="flex items-center justify-between text-shell-ink-2"><span className="flex items-center gap-1 text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-brand inline-block"/>Segmen Utama</span><span className="font-bold text-[10px]">45%</span></div>
          <div className="flex items-center justify-between text-shell-ink-2"><span className="flex items-center gap-1 text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-pos inline-block"/>Segmen Sekunder</span><span className="font-bold text-[10px]">25%</span></div>
          <div className="flex items-center justify-between text-shell-ink-2"><span className="flex items-center gap-1 text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-warn inline-block"/>Lainnya</span><span className="font-bold text-[10px]">18%</span></div>
        </div>
      </div>
    );
  }

  if (primaryType === 'line' || primaryType === 'area') {
    return (
      <div className="bg-shell text-shell-ink rounded-control p-2 border border-shell-line my-2 space-y-1">
        <div className="flex justify-between items-center text-[10px] text-ink-3 px-0.5">
          <span>Tren Historis</span>
          <span className="text-shell-ink-2 font-semibold">{preset.satuan}</span>
        </div>
        <div className="h-11 w-full pt-1">
          <svg viewBox="0 0 120 40" className="w-full h-full">
            <defs>
              <linearGradient id={`grad-${preset.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38c6e2" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#38c6e2" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d="M0 35 Q 20 10, 40 25 T 80 15 T 120 5 L 120 40 L 0 40 Z" fill={`url(#grad-${preset.id})`} />
            <path d="M0 35 Q 20 10, 40 25 T 80 15 T 120 5" fill="none" stroke="#38c6e2" strokeWidth="2" strokeLinecap="round" />
            <circle cx="120" cy="5" r="3" fill="#38c6e2" stroke="#ffffff" strokeWidth="1.5" />
          </svg>
        </div>
      </div>
    );
  }

  if (primaryType === 'gauge') {
    return (
      <div className="bg-shell text-shell-ink rounded-control p-2 flex items-center justify-between border border-shell-line my-2">
        <div className="w-16 h-11 relative flex items-center justify-center">
          <svg viewBox="0 0 40 25" className="w-full h-full">
            <path d="M 5 22 A 15 15 0 0 1 35 22" fill="none" stroke="#4d5667" strokeWidth="4" strokeLinecap="round" />
            <path d="M 5 22 A 15 15 0 0 1 28 9" fill="none" stroke="#38c6e2" strokeWidth="4" strokeLinecap="round" />
          </svg>
          <span className="absolute text-[10px] font-extrabold text-pos top-4">84%</span>
        </div>
        <div className="text-right text-[10px] pr-1">
          <span className="text-ink-3 block">Status Capaian</span>
          <span className="text-pos font-bold text-xs">Sangat Baik</span>
        </div>
      </div>
    );
  }

  // Default: Bar chart preview
  return (
    <div className="bg-shell text-shell-ink rounded-control p-2 border border-shell-line my-2 space-y-1">
      <div className="flex justify-between items-center text-[10px] text-ink-3 px-0.5">
        <span>Visualisasi Perbandingan</span>
        <span className="text-shell-ink-2 font-semibold">{preset.satuan}</span>
      </div>
      <div className="h-11 w-full flex items-end justify-between gap-1 px-1 pt-1">
        <div className="w-full bg-brand/80 rounded-t h-[40%]" />
        <div className="w-full bg-brand/80 rounded-t h-[65%]" />
        <div className="w-full bg-brand/80 rounded-t h-[50%]" />
        <div className="w-full bg-brand rounded-t h-[85%]" />
        <div className="w-full bg-brand/80 rounded-t h-[70%]" />
        <div className="w-full bg-brand rounded-t h-[95%]" />
      </div>
    </div>
  );
};

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
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[480px] bg-surface border-l border-line shadow-2xl flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-line flex items-center justify-between bg-surface-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-control bg-brand flex items-center justify-center text-white shadow-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink flex items-center gap-1.5">
              <span>Katalog Preset Widget</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-line text-ink-2 font-semibold">
                {WIDGET_CATALOG.length} Preset
              </span>
            </h2>
            <p className="text-xs text-ink-2">Preset indikator standar BUMD (PRD Bab 6)</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-chip text-ink-3 hover:text-ink-2 hover:bg-line transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-3 border-b border-line space-y-2 bg-surface">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ink-3" />
          <input
            type="text"
            placeholder="Cari preset ID, nama indikator, atau kata kunci..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand bg-surface-2"
          />
        </div>

        {/* Sector Tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-surface-2 rounded-control text-xs">
          <button
            onClick={() => setSectorTab('current')}
            className={`flex-1 py-1 px-2 rounded-chip font-medium text-center transition-all ${sectorTab === 'current'
                ? 'bg-brand text-white shadow-xs'
                : 'text-ink-2 hover:text-ink'
              }`}
          >
            Sektor {sector.toUpperCase()} & Universal
          </button>
          <button
            onClick={() => setSectorTab('universal')}
            className={`py-1 px-2.5 rounded-chip font-medium text-center transition-all ${sectorTab === 'universal'
                ? 'bg-brand text-white shadow-xs'
                : 'text-ink-2 hover:text-ink'
              }`}
          >
            Universal ({jumlahUniversal})
          </button>
          <button
            onClick={() => setSectorTab('all')}
            className={`py-1 px-2.5 rounded-chip font-medium text-center transition-all ${sectorTab === 'all'
                ? 'bg-brand text-white shadow-xs'
                : 'text-ink-2 hover:text-ink'
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
                  ? 'bg-brand text-white font-medium'
                  : 'bg-surface-2 text-ink-2 hover:bg-line'
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
          <div className="text-center py-12 text-ink-3 text-xs">
            Tidak ada preset yang cocok dengan filter.
          </div>
        ) : (
          filteredPresets.map((preset) => {
            const isAdded = addedIds[preset.id];
            const isMemuat = memuatIds[preset.id];
            return (
              <div
                key={preset.id}
                className="bg-surface border border-line rounded-card p-3.5 hover:border-line-strong hover:shadow-xs transition-all space-y-2 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-surface-2 text-brand-ink border border-line">
                      {preset.id}
                    </span>
                    <span className="text-xs font-semibold text-ink">
                      {preset.nama}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-2 text-ink-2 shrink-0">
                    {preset.kategori}
                  </span>
                </div>

                <p className="text-xs text-ink-2 leading-relaxed">
                  {preset.deskripsi}
                </p>

                {/* Live Visual Chart Preview */}
                <PresetChartPreview preset={preset} />

                <div className="flex items-center justify-between pt-2 border-t border-line text-[11px] text-ink-3">
                  <div className="flex items-center gap-2">
                    <span>Satuan: <strong className="text-ink-2">{preset.satuan}</strong></span>
                    <span>•</span>
                    <span className="capitalize">{preset.tipeChart.join(', ')}</span>
                  </div>

                  <button
                    onClick={() => handleAdd(preset)}
                    disabled={isMemuat}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-control text-xs font-medium transition-all disabled:opacity-60 ${isAdded
                        ? 'bg-pos text-white'
                        : 'bg-surface-2 text-brand-ink hover:bg-brand hover:text-white'
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
                  <p className="text-[11px] text-neg bg-neg/15 border border-neg/30 rounded-control px-2 py-1.5 leading-relaxed">
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
