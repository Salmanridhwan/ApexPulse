import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Info, Layers, Loader2, Plus, Search, X } from 'lucide-react';
import { WIDGET_CATALOG } from '../services/builder/catalog';
import { ambilWidgetPreset } from '../services/builder/dariPreset';
import { specPratinjau } from '../services/spec/pratinjau';
import { TIPE_VISUALISASI } from '../services/spec/widgetTypes';
import { BumdSector, CatalogPreset, WidgetSpec, WidgetType } from '../types';
import { WidgetRenderer } from './widgets/WidgetRenderer';

/** Label pendek per tipe visualisasi, untuk chip pemilih tipe di kartu. */
const LABEL_TIPE: Record<string, string> = Object.fromEntries(
  TIPE_VISUALISASI.map((t) => [t.type, t.label])
);

/**
 * Render isi kartu hanya setelah kartu mendekati viewport. Isi katalog ada puluhan
 * preset dan tiap pratinjau adalah chart sungguhan (ECharts), jadi menyalakan
 * semuanya sekaligus berat. Dengan penanda ini yang hidup hanya kartu yang terlihat.
 */
function useTerlihat<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [terlihat, setTerlihat] = useState(false);

  useEffect(() => {
    if (terlihat) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setTerlihat(true);
      return;
    }
    const pengamat = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setTerlihat(true);
          pengamat.disconnect();
        }
      },
      { rootMargin: '400px' }
    );
    pengamat.observe(el);
    return () => pengamat.disconnect();
  }, [terlihat]);

  return { ref, terlihat };
}

interface KartuPresetProps {
  preset: CatalogPreset;
  tipe: WidgetType;
  onPilihTipe: (tipe: WidgetType) => void;
  onAdd: () => void;
  isMemuat: boolean;
  isAdded: boolean;
  galat?: string;
  /** Paksa render walau kartu belum terlihat (pengisian bertahap di latar). */
  segera?: boolean;
  /** Status ketersediaan tiap tipe preset menurut dokumen instansi aktif. */
  statusTipe: (tipe: WidgetType) => 'ada' | 'tidak' | 'belum';
  /** Sedang memeriksa tipe yang baru diklik. */
  memeriksaTipe?: boolean;
}

/**
 * Kartu preset: identitas indikator + PRATINJAU ASLI (renderer yang sama dengan
 * kanvas dashboard, bukan gambar tiruan) + chip pemilih tipe + tombol Tambah.
 */
const KartuPreset: React.FC<KartuPresetProps> = ({
  preset,
  tipe,
  onPilihTipe,
  onAdd,
  isMemuat,
  isAdded,
  galat,
  segera = false,
  statusTipe,
  memeriksaTipe = false,
}) => {
  const { ref, terlihat } = useTerlihat<HTMLDivElement>();
  const tampilPreview = terlihat || segera;

  return (
    <div
      data-testid="kartu-preset"
      data-tipe={tipe}
      className="rounded-card border border-line bg-surface flex flex-col overflow-hidden"
    >
      {/* Identitas preset */}
      <div className="px-3.5 pt-3.5 pb-2.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[13px] font-bold text-ink leading-tight">{preset.nama}</h3>
          <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-chip bg-surface-2 border border-line text-ink-3 font-semibold">
            {preset.satuan}
          </span>
        </div>
        <p className="text-[11px] text-ink-3 mt-1 truncate">
          <span className="font-mono font-bold text-brand-ink">{preset.id}</span>
          <span className="mx-1.5">•</span>
          {preset.kategori}
        </p>
        <p className="text-[11px] text-ink-2 leading-relaxed mt-2">{preset.deskripsi}</p>
      </div>

      {/* Pratinjau asli */}
      <div ref={ref} className="px-3.5 pb-3">
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-ink-3">
            Pratinjau {LABEL_TIPE[tipe] || tipe}
          </span>
          <span className="text-[10px] text-ink-3">angka contoh</span>
        </div>
        <div
          data-testid="pratinjau-chart"
          className="h-[150px] rounded-control border border-line bg-surface-2 overflow-hidden"
        >
          {tampilPreview ? <WidgetRenderer widget={specPratinjau(tipe)} /> : null}
        </div>

        {preset.tipeChart.length > 1 && (
          <div className="flex flex-wrap items-center gap-1 mt-2">
            {preset.tipeChart.map((t) => {
              const status = statusTipe(t);
              const tidakAda = status === 'tidak';
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => !tidakAda && onPilihTipe(t)}
                  disabled={tidakAda}
                  aria-pressed={t === tipe}
                  title={
                    tidakAda
                      ? 'Dokumen instansi ini tidak memuat data untuk tipe ini'
                      : `Pratinjau ${LABEL_TIPE[t] || t}`
                  }
                  data-testid={`chip-tipe-${t}`}
                  className={`text-[10px] px-2 py-0.5 rounded-chip border transition-colors ${
                    t === tipe
                      ? 'border-brand bg-brand text-on-brand font-semibold'
                      : tidakAda
                        ? 'border-line bg-surface-2 text-ink-3 line-through cursor-not-allowed'
                        : 'border-line bg-surface-2 text-ink-2 hover:bg-line'
                  }`}
                >
                  {LABEL_TIPE[t] || t}
                  {status === 'belum' && memeriksaTipe ? ' …' : ''}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Aksi */}
      <div className="mt-auto px-3.5 py-3 border-t border-line bg-surface-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-3">
          {preset.defaultLayout.w}×{preset.defaultLayout.h} grid
        </span>
        <button
          onClick={onAdd}
          disabled={isMemuat}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-semibold transition-all disabled:opacity-60 ${
            isAdded ? 'bg-pos text-on-pos' : 'bg-brand text-on-brand hover:bg-brand-ink'
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
              <span>Ditambahkan</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah</span>
            </>
          )}
        </button>
      </div>

      {galat && (
        <div className="text-[11px] text-neg bg-neg/15 border-t border-neg/30 px-3.5 py-2 leading-relaxed">
          {galat}
        </div>
      )}
    </div>
  );
};

interface CatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  sector: BumdSector;
  onAddWidget: (widget: WidgetSpec) => void;
  /** Instansi yang sedang dibuka — katalog mengikuti dokumen instansi ini. */
  tenantId?: string;
}

/** Ringkasan ketersediaan satu pasangan (preset, tipe) dari server. */
interface KetersediaanItem {
  presetId: string;
  tipe: WidgetType;
  tersedia: boolean;
  /** Pemeriksaan tidak bisa disimpulkan (layanan RAG bermasalah). */
  tidakDiketahui?: boolean;
  alasan?: string;
  judul?: string;
  checkedAt: string;
}

interface RingkasanKetersediaan {
  kbId: string;
  tanpaPenyaringan: boolean;
  /** Instansi belum punya knowledge base sama sekali. */
  tanpaKb: boolean;
  total: number;
  selesai: number;
  /** Berapa preset yang pemeriksaannya gagal karena layanan RAG bermasalah. */
  gagalDiperiksa: number;
  memeriksa: boolean;
  items: KetersediaanItem[];
}

/**
 * Katalog "Tambah Widget" — modal LAYAR PENUH berisi preset indikator BUMD,
 * dengan pratinjau bentuk asli tiap tipe visualisasi (renderer kanvas yang sama),
 * bukan gambar tiruan SVG.
 */
export const CatalogModal: React.FC<CatalogModalProps> = ({
  isOpen,
  onClose,
  sector,
  onAddWidget,
  tenantId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [sectorTab, setSectorTab] = useState<'current' | 'universal' | 'all'>('current');
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});
  const [memuatIds, setMemuatIds] = useState<Record<string, boolean>>({});
  const [galat, setGalat] = useState<Record<string, string>>({});
  /** Tipe yang sedang dipratinjau tiap kartu (default: tipe pertama preset). */
  const [tipeTerpilih, setTipeTerpilih] = useState<Record<string, WidgetType>>({});
  /**
   * Pengisian bertahap: kartu yang terlihat dirender langsung, sisanya menyusul
   * beberapa per detak di latar. Tujuannya agar membuka katalog tetap ringan
   * (tidak 38 chart sekaligus) tetapi tidak ada kartu yang tertinggal kosong.
   */
  const [kuota, setKuota] = useState(0);

  // Esc menutup modal.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const filteredPresets = useMemo(
    () =>
      WIDGET_CATALOG.filter((preset) => {
        // Filter sektor
        if (sectorTab === 'current') {
          const isRelevant = preset.sektor.includes(sector) || preset.sektor.includes('universal');
          if (!isRelevant) return false;
        } else if (sectorTab === 'universal') {
          if (!preset.sektor.includes('universal')) return false;
        }

        // Filter kategori
        if (selectedCategory !== 'Semua' && preset.kategori !== selectedCategory) {
          return false;
        }

        // Filter pencarian
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
      }),
    [sectorTab, sector, selectedCategory, searchTerm]
  );

  const jumlahUniversal = useMemo(
    () => WIDGET_CATALOG.filter((p) => p.sektor.includes('universal')).length,
    []
  );

  // Isi pratinjau sisanya perlahan-lahan (bukan sekaligus) supaya membuka katalog
  // tetap ringan; kartu yang terlihat sudah dirender lebih dulu oleh pengamat viewport.
  useEffect(() => {
    if (!isOpen) return;
    const total = filteredPresets.length;
    let diisi = 6;
    setKuota(diisi);
    if (total <= diisi) return;
    const timer = window.setInterval(() => {
      diisi += 6;
      setKuota(diisi);
      if (diisi >= total) window.clearInterval(timer);
    }, 320);
    return () => window.clearInterval(timer);
  }, [isOpen, filteredPresets.length]);

  // ================= Ketersediaan preset untuk instansi ini =================
  // Katalog tidak boleh menawarkan preset yang dokumen instansinya tidak memuat.
  // Server menilai dengan panggilan yang sama seperti tombol Tambah, lalu di-cache;
  // di sini hasilnya diambil sambil pemeriksaan latar berjalan.
  const [ketersediaan, setKetersediaan] = useState<Record<string, KetersediaanItem>>({});
  const [ringkasan, setRingkasan] = useState<RingkasanKetersediaan | null>(null);
  const [tampilkanTersembunyi, setTampilkanTersembunyi] = useState(false);
  const [memeriksaTipe, setMemeriksaTipe] = useState<Record<string, boolean>>({});

  const kunciPair = (id: string, tipe: string) => `${id}|${tipe}`;

  useEffect(() => {
    if (!isOpen) return;
    let hidup = true;
    let timer: number | undefined;
    setKetersediaan({});
    setRingkasan(null);
    setTampilkanTersembunyi(false);

    const petakan = (data: RingkasanKetersediaan) => {
      const peta: Record<string, KetersediaanItem> = {};
      for (const it of data.items || []) peta[kunciPair(it.presetId, it.tipe)] = it;
      return peta;
    };

    const ambil = async () => {
      try {
        const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
        const res = await fetch(`/api/widgets/ketersediaan${q}`);
        if (!res.ok) return;
        const data = (await res.json()) as RingkasanKetersediaan;
        if (!hidup) return;
        setKetersediaan(petakan(data));
        setRingkasan(data);
        // Selama pemeriksaan latar jalan, tanya lagi supaya kartu bertambah sendiri.
        if (data.memeriksa) timer = window.setTimeout(ambil, 2500);
      } catch {
        if (hidup) timer = window.setTimeout(ambil, 5000);
      }
    };
    void ambil();

    return () => {
      hidup = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [isOpen, tenantId]);

  /** Periksa satu tipe yang baru dipilih pengguna pada sebuah kartu. */
  const periksaTipe = async (presetId: string, tipe: WidgetType) => {
    setMemeriksaTipe((prev) => ({ ...prev, [presetId]: true }));
    try {
      const res = await fetch(
        `/api/widgets/ketersediaan?periksa=${encodeURIComponent(`${presetId}:${tipe}`)}` +
          (tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : '')
      );
      if (!res.ok) return;
      const data = (await res.json()) as RingkasanKetersediaan;
      const peta: Record<string, KetersediaanItem> = {};
      for (const it of data.items || []) peta[kunciPair(it.presetId, it.tipe)] = it;
      setKetersediaan((prev) => ({ ...prev, ...peta }));
      setRingkasan(data);
    } catch {
      /* dibiarkan: chip tetap "belum diperiksa", Tambah tetap memvalidasi ke server */
    } finally {
      setMemeriksaTipe((prev) => ({ ...prev, [presetId]: false }));
    }
  };

  const statusTipe = (presetId: string, tipe: WidgetType): 'ada' | 'tidak' | 'belum' => {
    const it = ketersediaan[kunciPair(presetId, tipe)];
    if (!it) return 'belum';
    return it.tersedia ? 'ada' : 'tidak';
  };

  const tanpaPenyaringan = ringkasan?.tanpaPenyaringan === true;

  /** Tipe pertama yang benar-benar tersedia untuk preset ini (chip awal). */
  const tipeTersedia = (p: CatalogPreset): WidgetType | null => {
    const daftar = p.tipeChart?.length ? p.tipeChart : (['kpi'] as WidgetType[]);
    return daftar.find((t) => statusTipe(p.id, t) === 'ada') || null;
  };

  /**
   * Preset yang punya MINIMAL SATU tipe yang bisa ditambahkan untuk instansi ini.
   * Satu preset bisa punya beberapa tipe (mis. peta + tabel); yang tidak bisa
   * dibuat dari dokumen tinggal dimatikan chip-nya, bukan seluruh kartunya.
   */
  const presetTampil = useMemo(() => {
    if (tanpaPenyaringan) return filteredPresets;
    return filteredPresets.filter((p) => tipeTersedia(p) !== null);
  }, [filteredPresets, ketersediaan, tanpaPenyaringan]);

  /** Preset yang sudah diperiksa dan semua tipe yang ditawarkannya tidak bisa dibuat. */
  const presetTersembunyi = useMemo(() => {
    if (tanpaPenyaringan) return [];
    return filteredPresets.filter((p) => {
      const daftar = p.tipeChart?.length ? p.tipeChart : (['kpi'] as WidgetType[]);
      const adaCatatan = daftar.some((t) => !!ketersediaan[kunciPair(p.id, t)]);
      return adaCatatan && tipeTersedia(p) === null;
    });
  }, [filteredPresets, ketersediaan, tanpaPenyaringan]);

  const jumlahBelumDiperiksa = useMemo(() => {
    if (tanpaPenyaringan) return 0;
    return filteredPresets.filter((p) => {
      const daftar = p.tipeChart?.length ? p.tipeChart : ['kpi'];
      return !daftar.some((t) => !!ketersediaan[kunciPair(p.id, t)]);
    }).length;
  }, [filteredPresets, ketersediaan, tanpaPenyaringan]);

  /** Alasan penolakan yang paling relevan untuk satu preset. */
  const alasanPreset = (p: CatalogPreset): string => {
    const daftar = p.tipeChart?.length ? p.tipeChart : ['kpi'];
    const pertama = ketersediaan[kunciPair(p.id, daftar[0])];
    return pertama?.alasan || 'Dokumen instansi ini tidak memuat indikator tersebut.';
  };

  const daftarKartu = tampilkanTersembunyi
    ? [...presetTampil, ...presetTersembunyi]
    : presetTampil;

  /**
   * Tambah widget dari preset: definisi indikator dari katalog, ANGKANYA dari dokumen
   * resmi lewat /api/widgets/ambil-data. Kalau dokumen tidak memuat indikatornya,
   * widget tidak ditambahkan (tidak ada angka contoh atau sitasi palsu).
   */
  const handleAdd = async (preset: CatalogPreset) => {
    const tipe =
      tipeTerpilih[preset.id] || tipeTersedia(preset) || preset.tipeChart[0] || 'kpi';
    setMemuatIds((prev) => ({ ...prev, [preset.id]: true }));
    setGalat((prev) => ({ ...prev, [preset.id]: '' }));
    // Jalur yang sama dipakai kartu rekomendasi di panel Chat (services/builder/dariPreset).
    // `tenantId` ikut dikirim supaya angka diambil dari instansi yang sedang dipilih,
    // bukan instansi sesi.
    const { widget, error } = await ambilWidgetPreset(preset, tipe, sector, tenantId);
    if (!widget) {
      setGalat((prev) => ({ ...prev, [preset.id]: error || 'Gagal mengambil data dari dokumen.' }));
      setMemuatIds((prev) => ({ ...prev, [preset.id]: false }));
      return;
    }
    onAddWidget(widget);
    setAddedIds((prev) => ({ ...prev, [preset.id]: true }));
    setTimeout(() => setAddedIds((prev) => ({ ...prev, [preset.id]: false })), 2500);
    setMemuatIds((prev) => ({ ...prev, [preset.id]: false }));
  };

  if (!isOpen) return null;

  const kategori = ['Semua', 'Keuangan', 'Operasional', 'Pelayanan', 'Kepatuhan & Risiko'];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="katalog-widget-title"
      data-testid="katalog-widget-modal"
      className="fixed inset-0 z-50 bg-canvas text-ink flex flex-col"
    >
      {/* Header */}
      <div className="shrink-0 border-b border-line bg-surface px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-control bg-brand flex items-center justify-center text-on-brand shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2
              id="katalog-widget-title"
              className="text-sm font-semibold text-ink flex items-center gap-2"
            >
              <span>Katalog Preset Widget</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-line text-ink-2 font-semibold">
                {WIDGET_CATALOG.length} Preset
              </span>
            </h2>
            <p className="text-xs text-ink-2 truncate">
              Preset indikator standar BUMD (PRD Bab 6) — pratinjau memakai renderer chart asli
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          title="Tutup katalog (Esc)"
          data-testid="tutup-katalog"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-semibold text-ink-2 bg-surface-2 hover:bg-line border border-line transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
          <span>Tutup</span>
        </button>
      </div>

      {/* Filter */}
      <div className="shrink-0 border-b border-line bg-surface px-4 sm:px-6 py-3 flex flex-col lg:flex-row lg:items-center gap-2.5">
        <div className="relative lg:w-80 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ink-3" />
          <input
            type="text"
            placeholder="Cari preset ID, nama indikator, atau kata kunci..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-2 border border-line rounded-control focus:outline-none focus:ring-1 focus:ring-brand bg-surface-2"
          />
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-surface-2 rounded-control text-xs shrink-0">
          <button
            onClick={() => setSectorTab('current')}
            className={`py-1.5 px-2.5 rounded-chip font-medium transition-all ${
              sectorTab === 'current' ? 'bg-brand text-on-brand' : 'text-ink-2 hover:text-ink'
            }`}
          >
            Sektor {sector.toUpperCase()} & Universal
          </button>
          <button
            onClick={() => setSectorTab('universal')}
            className={`py-1.5 px-2.5 rounded-chip font-medium transition-all ${
              sectorTab === 'universal' ? 'bg-brand text-on-brand' : 'text-ink-2 hover:text-ink'
            }`}
          >
            Universal ({jumlahUniversal})
          </button>
          <button
            onClick={() => setSectorTab('all')}
            className={`py-1.5 px-2.5 rounded-chip font-medium transition-all ${
              sectorTab === 'all' ? 'bg-brand text-on-brand' : 'text-ink-2 hover:text-ink'
            }`}
          >
            Semua ({WIDGET_CATALOG.length})
          </button>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1">
          {kategori.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-[11px] whitespace-nowrap px-2.5 py-1 rounded-chip border transition-colors ${
                selectedCategory === cat
                  ? 'border-brand bg-brand text-on-brand font-medium'
                  : 'border-line bg-surface-2 text-ink-2 hover:bg-line'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Keterangan kejujuran data + status ketersediaan instansi ini */}
      <div className="shrink-0 px-4 sm:px-6 py-2 bg-surface-2 border-b border-line flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-ink-3 shrink-0" />
          <span className="text-[11px] text-ink-2">
            Angka pada pratinjau hanya contoh bentuk tampilan. Saat ditekan Tambah, angkanya diambil
            dari dokumen resmi instansi lewat RAG — tidak ada angka contoh yang ikut disimpan.
          </span>
        </span>

        {!tanpaPenyaringan && ringkasan && !ringkasan.tanpaKb && (
          <span
            data-testid="status-ketersediaan"
            className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-chip border border-line bg-surface text-ink-2"
          >
            {ringkasan.memeriksa && <Loader2 className="w-3 h-3 animate-spin text-ink-3" />}
            <span>
              {ringkasan.memeriksa
                ? `Memeriksa dokumen instansi… ${ringkasan.selesai}/${ringkasan.total}`
                : `${ringkasan.selesai}/${ringkasan.total} preset diperiksa`}
            </span>
          </span>
        )}

        {tanpaPenyaringan && (
          <span className="text-[11px] text-ink-3">
            Ketersediaan per dokumen belum bisa dinilai karena RAG belum aktif — semua preset ditampilkan.
          </span>
        )}

        {ringkasan?.tanpaKb && (
          <span className="text-[11px] text-warn">
            Instansi ini belum punya knowledge base, jadi ketersediaan tidak bisa diperiksa.
          </span>
        )}

        {!tanpaPenyaringan && (ringkasan?.gagalDiperiksa ?? 0) > 0 && (
          <span className="text-[11px] text-warn" data-testid="peringatan-layanan-rag">
            {ringkasan?.gagalDiperiksa} preset belum bisa dipastikan karena layanan RAG tidak menjawab
            — akan diperiksa ulang otomatis.
          </span>
        )}

        {presetTersembunyi.length > 0 && (
          <button
            onClick={() => setTampilkanTersembunyi((prev) => !prev)}
            data-testid="toggle-tersembunyi"
            className="text-[11px] px-2 py-0.5 rounded-chip border border-line bg-surface text-ink-2 hover:bg-line transition-colors"
          >
            {tampilkanTersembunyi
              ? 'Sembunyikan lagi'
              : `Tampilkan ${presetTersembunyi.length} preset yang tidak ada di dokumen`}
          </button>
        )}
      </div>

      {/* Daftar preset */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        {daftarKartu.length === 0 ? (
          <div className="text-center py-16 text-ink-3 text-xs space-y-2">
            {ringkasan?.tanpaKb ? (
              <>
                <p className="text-ink-2 font-medium">
                  Instansi ini belum punya knowledge base.
                </p>
                <p>
                  Minta admin mengatur Knowledge Base ID instansi ini di panel admin, lalu unggah
                  laporan resminya di RAG (https://rag.aiones.app/ui).
                </p>
              </>
            ) : !tanpaPenyaringan && (ringkasan?.memeriksa || jumlahBelumDiperiksa > 0) ? (
              <p className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Memeriksa dokumen instansi ini… ({ringkasan?.selesai ?? 0}/{ringkasan?.total ?? 0})
              </p>
            ) : !tanpaPenyaringan && (ringkasan?.gagalDiperiksa ?? 0) > 0 ? (
              <>
                <p className="text-ink-2 font-medium">
                  Belum ada preset yang bisa dipastikan tersedia.
                </p>
                <p>
                  Layanan RAG tidak menjawab (bukan berarti dokumennya kosong). Pemeriksaan akan
                  dicoba lagi otomatis — tutup lalu buka katalog ini beberapa saat lagi.
                </p>
              </>
            ) : filteredPresets.length === 0 ? (
              <p>Tidak ada preset yang cocok dengan filter.</p>
            ) : (
              <>
                <p className="text-ink-2 font-medium">
                  Dokumen instansi ini belum memuat indikator mana pun dari katalog.
                </p>
                <p>
                  Unggah laporan resmi instansi di RAG (https://rag.aiones.app/ui) lalu buka katalog
                  ini lagi. Tidak ada widget contoh yang dipaksakan tampil.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 items-start">
            {daftarKartu.map((preset, indeks) => {
              // Tipe awal = tipe pertama yang BENAR-BENAR tersedia, supaya pratinjau
              // di katalog sama dengan kartu yang nanti muncul di kanvas.
              const tipeKartu = tipeTerpilih[preset.id] || tipeTersedia(preset) || preset.tipeChart[0] || 'kpi';
              const dimatikan = tipeTersedia(preset) === null;
              return (
                <div
                  key={preset.id}
                  data-testid={dimatikan ? 'kartu-tersembunyi' : 'kartu-siap'}
                  data-tipe-awal={tipeKartu}
                  className={dimatikan ? 'opacity-60' : ''}
                >
                  <KartuPreset
                    preset={preset}
                    tipe={tipeKartu}
                    onPilihTipe={(t) => {
                      setTipeTerpilih((prev) => ({ ...prev, [preset.id]: t }));
                      if (statusTipe(preset.id, t) === 'belum') void periksaTipe(preset.id, t);
                    }}
                    onAdd={() => handleAdd(preset)}
                    isMemuat={!!memuatIds[preset.id]}
                    isAdded={!!addedIds[preset.id]}
                    galat={galat[preset.id]}
                    segera={indeks < kuota}
                    statusTipe={(t) => statusTipe(preset.id, t)}
                    memeriksaTipe={!!memeriksaTipe[preset.id]}
                  />
                  {dimatikan && (
                    <p className="text-[11px] text-neg mt-1.5 px-1" data-testid="alasan-tersembunyi">
                      {alasanPreset(preset)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
