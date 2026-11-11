import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid, Plus, Sparkles } from 'lucide-react';
import { WidgetSpec } from '../types';
import { WidgetCard } from './widgets/WidgetCard';
import { hitungBarisKanvas, spanTinggi, susunTinggiGrid, tataSatuan } from '../services/tataLetak/satuHalaman';

interface DashboardCanvasProps {
  widgets: WidgetSpec[];
  onEditWidget: (widget: WidgetSpec) => void;
  /** Ganti chart kartu langsung dari menu ⋯ (tanpa membuka editor). */
  onGantiChart?: (widget: WidgetSpec, chartId: string) => void;
  onManualCorrection: (widget: WidgetSpec) => void;
  onDeleteWidget: (widgetId: string) => void;
  onDuplicateWidget: (widget: WidgetSpec) => void;
  onReorderWidgets: (orderedIds: string[]) => void;
  /** `h` hanya dikirim saat tinggi kartu diubah dari pegangan tepi bawah. */
  onResizeWidget: (widgetId: string, w: number, h?: number) => void;
  /**
   * Boleh tidaknya pemirsa menyusun dashboard (menambah/mengubah widget).
   *
   * Dipakai untuk memilih bahasa empty state: peran `pengguna` hanya membaca,
   * jadi tidak diberi ajakan menyusun yang tidak bisa ia selesaikan.
   */
  bolehMenyusun?: boolean;
  /** true = belum ada dashboard yang dibuka (bukan dashboard kosong). */
  tanpaDashboard?: boolean;
  /** Kembali ke daftar Semua Dashboard. */
  onLihatSemua?: () => void;
  /** Opsional: di halaman tautan publik tidak ada sesi instansi, jadi tidak ditampilkan. */
  onOpenChat?: () => void;
  /** Mode lihat-saja (mis. saat filter dashboard aktif): matikan drag & resize. */
  readOnly?: boolean;
  /**
   * Mode pratinjau (galeri template): render kartu persis seperti kanvas, tetapi
   * widget belum nyata — sembunyikan menu ⋯ dan matikan drag/resize.
   */
  preview?: boolean;
  /**
   * Tampilkan dashboard dalam SATU layar penuh tanpa scroll.
   *
   * Tinggi baris dihitung dari sisa tinggi layar, jadi seluruh widget selalu
   * terlihat sekaligus (grafik mengecil sendiri karena ECharts mengikuti ukuran
   * kartu). Hanya berlaku di layar lebar (≥1024px); di layar kecil kanvas tetap
   * bisa digeser karena kartu selebar layar tidak mungkin dipaksa muat.
   */
  satuHalaman?: boolean;
  /** Batas tinggi baris KPI (px). Gaya Korporat memakai kartu KPI ringkas. */
  tinggiKpiMaks?: number;
  /** Ruang (px) di bawah kanvas yang dipakai bingkai halaman (mis. kaki Korporat). */
  cadanganBawah?: number;
  /** true = tanpa latar & garis bingkai kanvas (kanvas berada di dalam bingkai lain). */
  polos?: boolean;
}

/**
 * KANVAS DASHBOARD.
 *
 * Dua aturan tata letak yang dipegang di sini:
 *
 * 1. BARIS KPI TUNGGAL — semua kartu KPI (maksimal 6) selalu berada dalam SATU
 *    baris di paling atas, selebar kanvas dibagi rata (`repeat(n, 1fr)`).
 *    Lebar `grid.w` pada kartu KPI diabaikan karena kalau dipakai, 6 kartu KPI
 *    akan pecah menjadi dua baris (4 + 2) dan mendorong grafik ke bawah.
 *    Di layar < 1024px baris ini memakai 2 kolom agar angkanya tetap terbaca.
 *
 * 2. SATU HALAMAN — saat `satuHalaman`, tinggi tiap baris = sisa tinggi layar
 *    dibagi jumlah baris, dan seluruh isi kanvas diskalakan bila baris jadi
 *    terlalu pendek. Tidak ada scroll.
 */
export const DashboardCanvas: React.FC<DashboardCanvasProps> = ({
  widgets,
  onEditWidget,
  onGantiChart,
  onManualCorrection,
  onDeleteWidget,
  onDuplicateWidget,
  onReorderWidgets,
  onResizeWidget,
  bolehMenyusun = true,
  tanpaDashboard = false,
  onLihatSemua,
  onOpenChat,
  readOnly = false,
  preview = false,
  satuHalaman = false,
  tinggiKpiMaks,
  cadanganBawah = 0,
  polos = false,
}) => {
  // Drag-and-drop reorder widget (HTML5 DnD native, tanpa library).
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Resize lebar widget: tarik strip di tepi kanan kartu (mouse event native).
  const [resizeId, setResizeId] = useState<string | null>(null);
  const [previewW, setPreviewW] = useState<number | null>(null);
  const resizeInfo = useRef<{ id: string; startX: number; startW: number; pxPerCol: number; arah: 1 | -1 } | null>(null);
  const previewWRef = useRef<number | null>(null);
  /** Resize tinggi: tarik strip di tepi bawah kartu, satuan = satu baris grid. */
  const [previewH, setPreviewH] = useState<number | null>(null);

  /** Panjang kolom lg (dari 12) yang dipakai kartu, konsisten dengan pemetaan colSpan. */
  const lgCols = (w: number): number => (w >= 10 ? 12 : w >= 7 ? 8 : w >= 5 ? 6 : w >= 4 ? 4 : w >= 3 ? 3 : 2);

  /**
   * Perubahan lebar jendela harus selalu memperbarui mode tata letak.
   *
   * Dulu `layarLebar` (mode satu halaman) hanya diperbarui di dalam efek yang
   * langsung berhenti bila mode satu halaman TIDAK aktif. Akibatnya jendela
   * yang dikecilkan dari desktop tetap memakai baris setinggi layar penuh:
   * kartu bertumpuk karena baris grid lebih pendek daripada tinggi kartu.
   */
  useEffect(() => {
    const ubah = () => setLayarLebar(window.innerWidth >= 1280);
    ubah();
    window.addEventListener('resize', ubah);
    return () => window.removeEventListener('resize', ubah);
  }, []);

  /** Lebar jendela — menentukan baris KPI memakai 1 baris penuh atau 2 kolom. */
  const [lebarLayar, setLebarLayar] = useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth));
  useEffect(() => {
    const ubah = () => setLebarLayar(window.innerWidth);
    window.addEventListener('resize', ubah);
    return () => window.removeEventListener('resize', ubah);
  }, []);

  // ===== Mode satu halaman =====
  /** Wadah kanvas — dipakai mengukur sisa tinggi layar. */
  const wadahRef = useRef<HTMLDivElement | null>(null);
  const [tinggiTersedia, setTinggiTersedia] = useState(0);
  const [layarLebar, setLayarLebar] = useState(false);

  /**
   * Ukur dari tepi atas kanvas sampai dasar layar. Dipakai `useLayoutEffect` supaya
   * tinggi sudah benar sebelum layar digambar (tidak ada kedipan/gulir sesaat).
   * Diukur ulang saat jendela berubah ukuran dan sekali lagi setelah 350 ms —
   * baris alat di atas kanvas (filter, tombol) kadang muncul belakangan.
   */
  useLayoutEffect(() => {
    if (!satuHalaman) return;
    const ukur = () => {
      const el = wadahRef.current;
      if (!el) return;
      /**
       * Mode satu halaman butuh grid 12 kolom, dan grid itu baru aktif di `xl`
       * (1280px). Di 1024-1279px kanvas memakai grid 6 kolom, jadi memaksa satu
       * halaman hanya menghasilkan baris setinggi nol.
       */
      setLayarLebar(window.innerWidth >= 1280);
      const atas = el.getBoundingClientRect().top;
      /**
       * Batas bawah diambil dari INDUK yang bisa digulir (mis. <main class="overflow-y-auto">),
       * bukan `window.innerHeight`. Kalau memakai jendela, tinggi yang dipakai bisa lebih besar
       * dari ruang yang benar-benar terlihat sehingga muncul gulir 10–20 px di kanan.
       */
      let induk: HTMLElement | null = el.parentElement;
      while (induk && induk !== document.body) {
        const gaya = getComputedStyle(induk);
        if (/(auto|scroll)/.test(gaya.overflowY) && induk.clientHeight > 0) break;
        induk = induk.parentElement;
      }
      /**
       * Batas bawah SELALU dasar jendela. Kalau memakai tinggi induk yang bisa digulir,
       * nilai itu ikut membesar ketika isi meluber (lingkaran setan: makin meluber makin
       * tinggi), sehingga kanvas tidak pernah mengecil. Padding bawah leluhur dikurangkan
       * di bawah supaya <main class="p-6"> tidak memunculkan gulir 24 px.
       */
      const batasBawah = window.innerHeight;
      /**
       * Padding bawah leluhur (mis. <main class="p-6">) ikut menambah tinggi isi induk,
       * jadi harus dikurangkan — kalau tidak, tetap muncul gulir setinggi padding itu.
       */
      let padBawah = 0;
      for (let n: HTMLElement | null = el.parentElement; n && n !== induk; n = n.parentElement) {
        padBawah += parseFloat(getComputedStyle(n).paddingBottom) || 0;
      }
      // 8px cadangan supaya pembulatan subpiksel tidak memunculkan gulir.
      setTinggiTersedia(
        Math.max(0, Math.round(Math.min(batasBawah, window.innerHeight) - atas - padBawah - cadanganBawah - 8))
      );
    };
    ukur();
    const tunda = window.setTimeout(ukur, 350);
    window.addEventListener('resize', ukur);
    /**
     * Tinggi di atas kanvas bisa berubah tanpa jendela diubah ukurannya (mis.
     * baris filter muncul, atau tombol alat bertambah). Pantau tinggi halaman;
     * `setState` dengan nilai sama tidak memicu render, jadi tidak ada loop.
     */
    const pengamat = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => ukur()) : null;
    pengamat?.observe(document.body);
    return () => {
      window.clearTimeout(tunda);
      window.removeEventListener('resize', ukur);
      pengamat?.disconnect();
    };
  }, [satuHalaman, widgets.length, cadanganBawah]);

  /**
   * Pisahkan KPI dari kartu lain: KPI selalu satu baris tersendiri di atas,
   * sisanya dipas-kan di grid 12 kolom seperti biasa.
   */
  /**
   * KPI maksimal 6 kartu (aturan produk) — kartu ke-7 dan seterusnya dibuang dari
   * baris KPI supaya angkanya tidak terpotong dan tetap satu baris seperti template.
   */
  const widgetsKpi = useMemo(() => widgets.filter((w) => w.type === 'kpi').slice(0, 6), [widgets]);
  const widgetsLain = useMemo(() => widgets.filter((w) => w.type !== 'kpi'), [widgets]);

  /**
   * Satuan baris kartu non-KPI: tiap kartu membentang `grid.h` satuan, dan kartu
   * dalam satu deret disamakan tingginya (lihat `susunTinggiGrid`).
   */
  // Selama tepi bawah ditarik, tinggi pratinjau ikut dihitung supaya perubahan terlihat langsung.
  const tinggiGrid = useMemo(
    () =>
      susunTinggiGrid(
        previewH === null
          ? widgetsLain
          : widgetsLain.map((w) => (w.id === resizeId ? { ...w, grid: { ...w.grid, h: previewH } } : w))
      ),
    [widgetsLain, previewH, resizeId]
  );
  const barisLain = tinggiGrid.satuan;
  const spanKartu = useMemo(() => new Map(widgetsLain.map((w, i) => [w.id, tinggiGrid.span[i]])), [widgetsLain, tinggiGrid]);

  /**
   * Jumlah baris SELURUH kanvas: 1 baris KPI (kalau ada KPI) + baris kartu lain.
   * Aturan ini ada di `satuHalaman.ts` supaya bisa diuji tanpa DOM.
   */
  const barisKanvas = useMemo(() => hitungBarisKanvas(widgets), [widgets]);

  /**
   * Kolom baris KPI: dibagi rata sebanyak jumlah KPI di layar lebar (SELALU satu
   * baris), dan 2 kolom di layar kecil supaya angka tidak terpotong.
   */
  const kolomKpi =
    widgetsKpi.length === 0
      ? 0
      : lebarLayar >= 1280
        ? widgetsKpi.length
        : lebarLayar >= 1024
          ? Math.min(3, widgetsKpi.length)
          : lebarLayar >= 640
            ? Math.min(2, widgetsKpi.length)
            : 1;

  /** Prasyarat mode satu halaman (dipakai juga untuk memilih jarak/padding). */
  const pasSatuHalamanAwal = satuHalaman && layarLebar && tinggiTersedia > 0 && barisKanvas > 0;

  /**
   * Mode satu halaman memakai jarak & padding lebih rapat (10px / 12px) supaya
   * ruang yang tersisa benar-benar dipakai kartu, bukan celah.
   */
  const JARAK = pasSatuHalamanAwal ? 10 : 16;
  const PADDING = pasSatuHalamanAwal ? 12 : 20;
  /** Tinggi satu satuan baris di luar mode satu halaman (layar kecil, pratinjau). */
  const SATUAN_BIASA = 60;

  const pasSatuHalaman = pasSatuHalamanAwal;
  const tinggiIsi = Math.max(0, tinggiTersedia - PADDING * 2);
  /**
   * Tinggi baris KPI & satuan baris dihitung murni di `satuHalaman.ts` (ada tesnya).
   * Kalau satuan minimum tidak muat, kanvas digulir — dulu grid diperkecil dengan
   * `scale`, dan isi grafik yang punya ukuran minimum terpotong oleh kartunya.
   */
  const tata = pasSatuHalaman
    ? tataSatuan(tinggiIsi, widgetsKpi.length > 0, barisLain, JARAK, tinggiKpiMaks)
    : { kpi: 0, satuan: SATUAN_BIASA, gulir: false };
  const tinggiBarisFinal = tata.satuan;
  /** Baris KPI dibatasi tingginya supaya kartu angka tidak melar setinggi layar. */
  const tinggiKpi = tata.kpi;
  const skala = 1;
  /** Tinggi total kartu non-KPI (dipakai sebagai tinggi grid utamanya). */
  const tinggiGridLain = barisLain * tinggiBarisFinal + JARAK * Math.max(0, barisLain - 1);

  /** Diskritkan lebar mentah ke bucket yang dikenali pemetaan colSpan. */
  const bucket = (w: number): number => (w >= 10 ? 12 : w >= 7 ? 8 : w >= 5 ? 6 : w >= 4 ? 4 : w >= 3 ? 3 : 2);

  /** arah: 1 = tepi kanan (geser kanan = melebar), -1 = tepi kiri (geser kiri = melebar). */
  const mulaiResize = (e: React.MouseEvent, widget: WidgetSpec, arah: 1 | -1) => {
    e.preventDefault();
    e.stopPropagation();
    const kartu = (e.currentTarget as HTMLElement).closest('[data-widget-id]') as HTMLElement | null;
    const startW = widget.grid?.w ?? 6;
    const pxPerCol = kartu ? kartu.getBoundingClientRect().width / lgCols(startW) : 100;
    resizeInfo.current = { id: widget.id, startX: e.clientX, startW, pxPerCol, arah };
    setResizeId(widget.id);
    setPreviewW(startW);
    previewWRef.current = startW;

    const pindah = (ev: MouseEvent) => {
      if (!resizeInfo.current) return;
      const delta = ((ev.clientX - resizeInfo.current.startX) / resizeInfo.current.pxPerCol) * resizeInfo.current.arah;
      const w = bucket(Math.round(resizeInfo.current.startW + delta));
      previewWRef.current = w;
      setPreviewW(w);
    };
    const selesai = () => {
      window.removeEventListener('mousemove', pindah);
      window.removeEventListener('mouseup', selesai);
      if (resizeInfo.current && previewWRef.current !== resizeInfo.current.startW) {
        onResizeWidget(resizeInfo.current.id, previewWRef.current ?? resizeInfo.current.startW);
      }
      resizeInfo.current = null;
      previewWRef.current = null;
      setResizeId(null);
      setPreviewW(null);
    };
    window.addEventListener('mousemove', pindah);
    window.addEventListener('mouseup', selesai);
  };

  /**
   * Ubah tinggi kartu (grid.h, 2-10 satuan baris) dengan menarik tepi bawah.
   * Satu satuan = tinggi baris grid + jarak. Tinggi satu deret mengikuti kartu
   * tertingginya, dan di mode satu halaman deret lain menyesuaikan sisa layar.
   */
  const mulaiResizeTinggi = (e: React.MouseEvent, widget: WidgetSpec) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = spanTinggi(widget);
    const pxPerBaris = Math.max(24, tinggiBarisFinal + JARAK);
    let h = startH;
    setResizeId(widget.id);
    setPreviewH(startH);

    const pindah = (ev: MouseEvent) => {
      h = Math.max(2, Math.min(10, startH + Math.round((ev.clientY - startY) / pxPerBaris)));
      setPreviewH(h);
    };
    const selesai = () => {
      window.removeEventListener('mousemove', pindah);
      window.removeEventListener('mouseup', selesai);
      if (h !== startH) onResizeWidget(widget.id, widget.grid?.w ?? 6, h);
      setResizeId(null);
      setPreviewH(null);
    };
    window.addEventListener('mousemove', pindah);
    window.addEventListener('mouseup', selesai);
  };

  const pindahkan = (srcId: string, dstId: string) => {
    if (!srcId || srcId === dstId) return;
    const ids = widgets.map((w) => w.id);
    const dari = ids.indexOf(srcId);
    const ke = ids.indexOf(dstId);
    if (dari === -1 || ke === -1) return;
    ids.splice(ke, 0, ids.splice(dari, 1)[0]);
    onReorderWidgets(ids);
  };

  /**
   * Satu kartu kanvas. Dipakai baris KPI maupun grid utama supaya drag & resize
   * berperilaku sama di keduanya.
   *
   * `kpi` = true: lebar kartu diatur baris KPI (bukan `grid.w`), jadi tidak ada
   * col-span dan tidak ada pegangan resize (lebarnya sudah dibagi rata).
   */
  const renderKartu = (widget: WidgetSpec, urutan: number, kpi: boolean) => {
    // Saat resize aktif, pakai lebar preview agar perubahan terlihat live.
    const wAktif = resizeId === widget.id && previewW !== null ? previewW : widget.grid?.w;
    /**
     * Grid 12 kolom baru dipakai mulai 1280px (`xl`). Antara 1024-1279px kartu
     * masih memakai grid 6 kolom: pada 12 kolom, kartu 3 kolom hanya ~225px dan
     * grafiknya tidak terbaca.
     */
    let colSpan = 'col-span-1 md:col-span-4 xl:col-span-2';
    if (wAktif >= 10) {
      colSpan = 'col-span-1 md:col-span-12 xl:col-span-12';
    } else if (wAktif >= 7) {
      colSpan = 'col-span-1 md:col-span-12 xl:col-span-8';
    } else if (wAktif >= 5) {
      colSpan = 'col-span-1 md:col-span-6 xl:col-span-6';
    } else if (wAktif >= 4) {
      colSpan = 'col-span-1 md:col-span-6 xl:col-span-4';
    } else if (wAktif >= 3) {
      colSpan = 'col-span-1 md:col-span-4 xl:col-span-3';
    }
    // Lebar mengikuti ukuran yang diatur pengguna. Aturan lama "deret dipenuhkan
    // 12 kolom" (lebarPenuhDeret) dihapus atas permintaan pemilik aplikasi: ruang
    // kosong boleh ada supaya kartu bisa ditempatkan bebas di kanvas.

    /**
     * Kartu grid membentang `span` satuan baris HANYA di layar lebar (lg, 12 kolom).
     * Di bawah itu grid memakai 1-6 kolom dan tinggi baris tetap, sehingga
     * `span` akan menghasilkan kartu sangat tinggi atau sangat pendek. Di layar
     * kecil tinggi kartu ditentukan kelas min-height responsif.
     */
    /**
     * Bentang baris hanya sah kalau baris grid memang dikendalikan mode satu
     * halaman. Di luar itu baris tumbuh mengikuti isi; memaksa `span` membuat
     * grid menghitung baris yang tidak ada hubungannya dengan tinggi kartu.
     */
    const span = kpi || !pasSatuHalaman ? undefined : spanKartu.get(widget.id) ?? 4;
    const tinggiMin = span
      ? ''
      : ['line', 'bar', 'area', 'hbar', 'combo', 'pie', 'donut', 'treemap',
          'funnel', 'waterfall', 'sankey', 'scatter', 'bubble', 'histogram', 'boxplot',
          'heatmap', 'radar', 'map', 'gantt', 'table'].includes(widget.type)
        ? 'min-h-[220px] sm:min-h-[260px] xl:min-h-[300px]'
        : 'min-h-[96px] sm:min-h-[110px]';

    return (
      <div
        key={widget.id}
        data-widget-id={widget.id}
        draggable={!readOnly && !preview}
        onDragStart={(e) => {
          setDragId(widget.id);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', widget.id);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setOverId(widget.id);
        }}
        onDrop={(e) => {
          e.preventDefault();
          pindahkan(dragId || e.dataTransfer.getData('text/plain'), widget.id);
          setDragId(null);
          setOverId(null);
        }}
        onDragEnd={() => {
          setDragId(null);
          setOverId(null);
        }}
        className={`${kpi ? '' : colSpan} ${pasSatuHalaman ? 'min-h-0 overflow-hidden' : tinggiMin} rounded-control relative transition-opacity ${dragId === widget.id ? 'opacity-40' : ''
          } ${overId === widget.id && dragId && dragId !== widget.id ? 'ring-2 ring-brand' : ''}`}
        style={span ? { gridRow: `span ${span}` } : undefined}
      >
        <WidgetCard
          widget={widget}
          urutan={urutan}
          preview={preview}
          padat={pasSatuHalaman}
          onEdit={onEditWidget}
          onGantiChart={onGantiChart}
          onManualCorrection={onManualCorrection}
          onDelete={onDeleteWidget}
          onDuplicate={onDuplicateWidget}
        />
        {/* Resize handle: strip tipis di tepi kiri & kanan — tarik untuk ubah lebar.
            Tidak ada pada kartu KPI: lebarnya sudah dibagi rata dalam satu baris. */}
        {!kpi && !readOnly && !preview && ([-1, 1] as const).map((arah) => (
          <span
            key={arah}
            data-resize={arah === -1 ? 'kiri' : 'kanan'}
            onMouseDown={(e) => mulaiResize(e, widget, arah)}
            className={`absolute top-0 h-full w-1.5 cursor-ew-resize transition-colors z-10 ${arah === -1 ? 'left-0' : 'right-0'
              } ${resizeId === widget.id && previewW !== null ? 'bg-brand/70' : 'bg-transparent hover:bg-brand/40'
              }`}
            title="Tarik untuk ubah lebar widget"
          />
        ))}
        {/* Pegangan tepi bawah: tarik untuk ubah tinggi. Hanya di mode satu halaman,
            karena di layar kecil tinggi kartu tidak memakai grid.h. */}
        {!kpi && !readOnly && !preview && span !== undefined && (
          <span
            data-resize="bawah"
            onMouseDown={(e) => mulaiResizeTinggi(e, widget)}
            className={`absolute left-0 bottom-0 w-full h-1.5 cursor-ns-resize transition-colors z-10 ${
              resizeId === widget.id && previewH !== null ? 'bg-brand/70' : 'bg-transparent hover:bg-brand/40'
            }`}
            title="Tarik untuk ubah tinggi widget"
          />
        )}
      </div>
    );
  };

  if (widgets.length === 0) {
    // Pemirsa yang tidak boleh menyusun dashboard (peran `pengguna`) tidak diberi
    // bahasa penyusun: dulu judulnya "Bangun dashboard pertama Anda" + CTA "Buat
    // via Chat", padahal hasil chat-nya hanya bisa diterapkan admin — jalan buntu.
    const bisaMenyusun = bolehMenyusun !== false;
    return (
      <div className="canvas-tegas flex-1 flex flex-col items-center justify-center p-12 text-center">
        <div className="w-14 h-14 rounded-[6px] flex items-center justify-center mb-4"
          style={{ backgroundColor: 'var(--tegas-accent)', boxShadow: '3px 3px 0 0 var(--tegas-ink)' }}>
          <LayoutGrid className="w-7 h-7 text-on-brand" />
        </div>
        {/* Bukan "dashboard pertama": instansi bisa sudah punya banyak dashboard
            (temuan uji E2E). Tanpa dashboard terbuka, arahkan ke daftar. */}
        <h3 className="text-base font-semibold text-ink">
          {tanpaDashboard ? 'Belum ada dashboard yang dibuka' : 'Dashboard ini masih kosong'}
        </h3>
        <p className="text-sm text-ink-2 max-w-md mt-1 mb-6">
          {tanpaDashboard
            ? 'Pilih dashboard dari daftar Semua Dashboard, atau buat yang baru dari sana.'
            : !bisaMenyusun
            ? 'Belum ada widget yang dibagikan di sini. Widget ditambahkan oleh Admin Instansi; Anda tetap bisa menanyakan data yang tersedia lewat Asisten.'
            : onOpenChat
              ? 'Minta dashboard dari dokumen resmi BUMD lewat chat, atau susun sendiri dari preset yang sudah tersedia.'
              : 'Dashboard ini belum memiliki widget. Tambahkan widget dari workspace Aiones Boards — halaman ini hanya mengubah widget yang sudah ada.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {onLihatSemua && (
            <button
              onClick={onLihatSemua}
              data-testid="ke-semua-dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink-2 bg-surface-2 border border-line hover:bg-line/60 rounded-control transition-colors"
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Semua Dashboard</span>
            </button>
          )}
          {onOpenChat && !tanpaDashboard && (
            <button
              onClick={onOpenChat}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-on-brand bg-brand hover:brightness-95 rounded-control shadow-sm transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>{bisaMenyusun ? 'Buat via Chat' : 'Tanya lewat Asisten'}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wadahRef}
      className={`${polos ? 'relative' : 'canvas-tegas'} ${pasSatuHalaman ? (tata.gulir ? 'overflow-y-auto gulir-tema' : 'overflow-hidden') : 'p-4 sm:p-5'}`}
      style={pasSatuHalaman ? { height: tinggiTersedia, padding: PADDING } : undefined}
    >
      <div
        style={{
          ...(skala < 1
            ? { transform: `scale(${skala})`, transformOrigin: 'top left', width: `${100 / skala}%` }
            : {}),
          /* Samakan basis huruf dengan halaman galeri (18px). Tanpa ini mode
             presentasi mewarisi 16px dari luar, sehingga ukuran kartu yang
             dihitung untuk 18px terpotong saat dipresentasikan. */
          fontSize: '18px',
        }}
      >
        {/* ===== BARIS KPI TUNGGAL (selalu satu baris, selebar kanvas dibagi rata) ===== */}
        {widgetsKpi.length > 0 && (
          <div
            data-kpi-row="1"
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${kolomKpi}, minmax(0, 1fr))`,
              gap: JARAK,
              height: pasSatuHalaman ? tinggiKpi : undefined,
              marginBottom: JARAK,
            }}
          >
            {widgetsKpi.map((widget, i) => renderKartu(widget, i, true))}
          </div>
        )}

        {/* ===== Kartu lain: grid 12 kolom ===== */}
        {widgetsLain.length > 0 && (
          <div
            className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-6 xl:grid-cols-12 auto-rows-min"
            style={
              pasSatuHalaman
                ? {
                    gridTemplateRows: `repeat(${barisLain}, minmax(0, ${tinggiBarisFinal}px))`,
                    height: tinggiGridLain,
                    rowGap: JARAK,
                    columnGap: JARAK,
                    paddingBottom: 0,
                  }
                : undefined
            }
          >
            {widgetsLain.map((widget, i) => renderKartu(widget, widgetsKpi.length + i, false))}
          </div>
        )}
      </div>
    </div>
  );
};
