import React, { useState } from 'react';
import {
  BarChart3,
  Bookmark,
  Check,
  Filter,
  Layers,
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

  const handleAdd = (preset: CatalogPreset) => {
    // Generate an authentic widget spec from this preset
    const newWidgetId = `w-preset-${preset.id}-${Date.now()}`;
    const primaryType = preset.tipeChart[0] || 'kpi';

    let kpiData;
    let chartData;
    let tableData;
    let narasiData;

    if (primaryType === 'kpi' || primaryType === 'bullet-target') {
      kpiData = {
        value: preset.satuan.includes('Rupiah') ? 'Rp 38,5 M' : preset.satuan.includes('%') ? '24,2%' : '148.650',
        unit: preset.satuan,
        delta: 6.8,
        deltaLabel: 'vs Target RKAP',
        target: 35.0,
        targetLabel: 'Target RKAP',
        sparkline: [30, 32, 34, 36, 38.5],
      };
    } else if (['line', 'area', 'bar', 'donut'].includes(primaryType)) {
      chartData = {
        xAxis: MONTHS_12,
        series: [
          {
            name: preset.nama,
            data: [42, 44, 45, 47, 49, 52, 51, 54, 56, 58, 60, 62],
            color: '#0284c7',
          },
        ],
        unit: preset.satuan,
        showLegend: true,
      };
    } else if (primaryType === 'table') {
      tableData = {
        columns: [
          { key: 'parameter', label: 'Indikator' },
          { key: 'target', label: 'Target' },
          { key: 'realisasi', label: 'Realisasi' },
          { key: 'capaian', label: 'Capaian (%)' },
        ],
        rows: [
          { parameter: 'Wilayah Pusat', target: '100', realisasi: '108', capaian: '108%' },
          { parameter: 'Wilayah Barat', target: '85', realisasi: '91', capaian: '107%' },
          { parameter: 'Wilayah Timur', target: '70', realisasi: '72', capaian: '103%' },
        ],
      };
    } else {
      narasiData = {
        text: `Ringkasan evaluasi indikator ${preset.nama}: Capaian berada pada tren positif dengan konsistensi di atas pagu perencanaan triwulanan.`,
        bulletPoints: ['Verifikasi data dokumen resmi LRA 2026', 'Telah disetujui tim evaluasi kinerja'],
      };
    }

    const widget: WidgetSpec = {
      id: newWidgetId,
      presetId: preset.id,
      type: primaryType,
      title: preset.nama,
      subtitle: preset.deskripsi,
      category: preset.kategori,
      confidence: 'sumber',
      grid: {
        x: 0,
        y: 0,
        w: preset.defaultLayout.w,
        h: preset.defaultLayout.h,
      },
      kpi: kpiData,
      chart: chartData,
      table: tableData,
      narasi: narasiData,
      citations: [
        {
          id: `cit-preset-${preset.id}`,
          docName: `Laporan_Kinerja_${preset.id}_2026.pdf`,
          page: 8,
          chunkSnippet: `Capaian metrik ${preset.nama} diverifikasi berdasarkan dokumen berkas resmi triwulan 2026.`,
          confidenceScore: 0.96,
          date: '2026-03-31',
        },
      ],
      periode: '2026-Q1',
      lastUpdated: new Date().toISOString(),
    };

    onAddWidget(widget);
    setAddedIds((prev) => ({ ...prev, [preset.id]: true }));
    setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [preset.id]: false }));
    }, 2000);
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
                40 Preset
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
            className={`flex-1 py-1 px-2 rounded-md font-medium text-center transition-all ${
              sectorTab === 'current'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sektor {sector.toUpperCase()} & Universal
          </button>
          <button
            onClick={() => setSectorTab('universal')}
            className={`py-1 px-2.5 rounded-md font-medium text-center transition-all ${
              sectorTab === 'universal'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Universal (14)
          </button>
          <button
            onClick={() => setSectorTab('all')}
            className={`py-1 px-2.5 rounded-md font-medium text-center transition-all ${
              sectorTab === 'all'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua (40)
          </button>
        </div>

        {/* Categories */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
          {['Semua', 'Keuangan', 'Operasional', 'Pelayanan', 'Kepatuhan & Risiko'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-[11px] whitespace-nowrap px-2.5 py-0.5 rounded-full transition-colors ${
                selectedCategory === cat
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
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      isAdded
                        ? 'bg-emerald-600 text-white'
                        : 'bg-sky-50 text-sky-700 hover:bg-sky-600 hover:text-white'
                    }`}
                  >
                    {isAdded ? (
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
