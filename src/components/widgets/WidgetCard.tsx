import { cukupTerang, GAYA, gayaMode } from '../../services/chart/gayaVarian';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CHART_DEFAULT, type ChartId } from '../../services/chart/chartDefault';
import { chartKatalogCocok } from '../../services/chart/katalogCocok';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Check,
  Copy,
  Database,
  Edit2,
  FileSearch,
  Loader2,
  MoreVertical,
  Target,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { WidgetSpec } from '../../types';
import { WidgetRenderer } from './WidgetRenderer';
import { PagarGrafik } from './PagarGrafik';
import { punyaDataChart } from '../../services/spec/widgetTypes';
import { temaKartu, warnaKartuValid } from './widgetCardTheme';
import { useThemeMode } from '../../theme';
import { grafikKatalog, kartuBerjudulSendiri, pakaiWajahKatalog } from '../../services/chart/dataKatalogWidget';
import { PanelSumber } from './PanelSumber';
import { PETA_IKON } from './ikonWidget';
import { bingkaiKatalog, gayaKatalogWidget } from './bingkaiKatalog';


/** Render ikon kartu berdasarkan nama di data widget. Nama tak dikenal jatuh ke `Target` supaya kartu tidak kosong. */
function ikonKartu(nama: string) {
  const Ikon = PETA_IKON[nama] ?? Target;
  return <Ikon className="w-3.5 h-3.5" />;
}

interface WidgetCardProps {
  widget: WidgetSpec;
  onEdit: (widget: WidgetSpec) => void;
  /**
   * Ganti chart kartu langsung dari menu ⋯, tanpa membuka editor.
   * Kartu berubah saat itu juga, lalu disimpan ke server di latar.
   */
  onGantiChart?: (widget: WidgetSpec, chartId: string) => void;
  onManualCorrection: (widget: WidgetSpec) => void;
  onDelete: (widgetId: string) => void;
  onDuplicate: (widget: WidgetSpec) => void;
  /** Mode pratinjau (mis. galeri template): sembunyikan menu ⋯ karena widget belum nyata. */
  preview?: boolean;
  /** Posisi kartu di kanvas: dipakai menggeser hue awal grafik. */
  urutan?: number;
  /**
   * Mode padat (dashboard satu halaman): kepala kartu dipadatkan dan tinggi
   * minimum badan dilepas, supaya grafik tetap terlihat saat kartu hanya ~80px.
   */
  padat?: boolean;
}

export const WidgetCard: React.FC<WidgetCardProps> = ({
  widget,
  onEdit,
  onGantiChart,
  onManualCorrection,
  onDelete,
  onDuplicate,
  preview = false,
  urutan,
  padat = false,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  /**
   * Menu (⋯) digambar lewat PORTAL ke `document.body` dengan posisi `fixed`, bukan
   * `absolute` di dalam kartu. Sebabnya kartu widget memakai `overflow-hidden` (perlu
   * untuk memotong isi ke sudut membulat), sehingga menu `absolute` ikut TERPOTONG di
   * dalam kartu. Dengan portal, menu melayang DI ATAS kartu seperti seharusnya.
   */
  const tombolMenuRef = useRef<HTMLButtonElement>(null);
  const [posisiMenu, setPosisiMenu] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  /**
   * Daftar bentuk chart DIBEKUKAN saat menu dibuka.
   *
   * `chartKatalogCocok` menyaring menurut tipe widget, dan tipe ikut berubah
   * setiap kali bentuk dipilih. Kalau daftar dihitung ulang tiap render, tombol
   * berpindah-pindah di bawah kursor setelah satu pilihan diklik.
   */
  const [daftarChart, setDaftarChart] = useState<ChartId[]>([]);

  /**
   * Buka menu ⋯ DI SAMPING kartu, bukan di atasnya.
   *
   * Menu ini dipakai untuk mengganti bentuk chart dan perubahannya langsung
   * terlihat. Kalau menu menumpuk kartu, pengguna tidak bisa menilai hasilnya.
   * Karena itu sisi kanan kartu dipakai lebih dulu, lalu sisi kiri, dan baru
   * menumpuk kartu kalau layar memang terlalu sempit (ponsel).
   */
  const bukaMenu = () => {
    const r = tombolMenuRef.current?.getBoundingClientRect();
    if (!r) return;
    const LEBAR_MENU = 256; // w-64
    const CELAH = 8;
    const PERKIRAAN_TINGGI = 400; // 6 tipe grafik + 4 aksi
    const lebarLayar = window.innerWidth;
    const tinggiLayar = window.innerHeight;
    const tinggiMaks = Math.max(240, tinggiLayar - 2 * CELAH);
    const kartu = tombolMenuRef.current?.closest('[data-kartu-widget]')?.getBoundingClientRect() ?? r;
    const topSamping = Math.max(CELAH, Math.min(kartu.top, tinggiLayar - PERKIRAAN_TINGGI - CELAH));

    if (lebarLayar - kartu.right - CELAH >= LEBAR_MENU) {
      // Sisi kanan kartu.
      setPosisiMenu({ left: kartu.right + CELAH, top: topSamping, maxHeight: Math.min(520, tinggiMaks) });
    } else if (kartu.left - CELAH >= LEBAR_MENU) {
      // Sisi kiri kartu.
      setPosisiMenu({ left: kartu.left - LEBAR_MENU - CELAH, top: topSamping, maxHeight: Math.min(520, tinggiMaks) });
    } else {
      // Layar sempit: taruh di bawah atau di atas kartu, bukan menutupi grafiknya.
      const muatBawah = kartu.bottom + CELAH + 320 <= tinggiLayar;
      setPosisiMenu({
        left: Math.max(CELAH, Math.min(lebarLayar - LEBAR_MENU - CELAH, kartu.right - LEBAR_MENU)),
        top: muatBawah ? kartu.bottom + CELAH : Math.max(CELAH, kartu.top - CELAH - 320),
        maxHeight: muatBawah ? tinggiLayar - kartu.bottom - 2 * CELAH : Math.max(240, kartu.top - 2 * CELAH),
      });
    }
    setDaftarChart(chartKatalogCocok(widget));
    setShowMenu(true);
  };

  // Menu posisinya dihitung sekali saat dibuka; kalau halaman digeser/diubah ukurannya,
  // lebih baik ditutup daripada melayang di tempat yang salah.
  useEffect(() => {
    if (!showMenu) return;
    const tutup = (e: Event) => {
      // Menggulir daftar chart di dalam menu bukan alasan menutup menu.
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-menu-widget]')) return;
      setShowMenu(false);
    };
    window.addEventListener('scroll', tutup, true);
    window.addEventListener('resize', tutup);
    return () => {
      window.removeEventListener('scroll', tutup, true);
      window.removeEventListener('resize', tutup);
    };
  }, [showMenu]);

  const isManual = widget.confidence === 'manual' || widget.manualCorrection?.isCorrected;
  const isSource = widget.confidence === 'sumber' && !isManual;

  /**
   * Warna latar kartu pilihan pengguna.
   *
   * Diterapkan dengan MENIMPA variabel CSS di elemen kartu, bukan dengan
   * menambahkan kelas ke tiap anak. Semua keturunan (judul, subtitle, border,
   * tombol ⋯, menu) otomatis ikut berubah, dan teksnya tetap terbaca karena
   * warna tinta dihitung dari kontras terhadap latar (`temaKartu`).
   * Saat pengguna tidak memilih warna, `vars` dikosongkan agar kartu memakai
   * token tema seperti biasa (tidak ada perubahan perilaku).
   */
  const mode = useThemeMode();
  // Desain katalog membawa warna kartunya sendiri bila pengguna belum memilih warna.
  // Desain bening (Kaca): warna kartunya rgba, jadi tinta dihitung dari warna
  // padanan yang terang, lalu latarnya diganti kaca buram.
  const gayaDesain = widget.style?.desain ? GAYA[widget.style.desain] : undefined;
  const kacaAktif = !widget.style?.kartu && Boolean(gayaDesain?.kaca);
  const kartuEfektif = widget.style?.kartu ?? (kacaAktif ? gayaDesain?.padanan ?? '#efe6dc' : gayaDesain?.kartu);
  const garisBening = kacaAktif && gayaDesain && !cukupTerang(gayaDesain.padanan ?? '#efe6dc') ? gayaDesain.garis : 'rgba(255,255,255,0.5)';
  const tema = temaKartu(kartuEfektif, mode);
  const pakaiWarnaKartu = warnaKartuValid(kartuEfektif);
  // Tema "Bersih & Tegas": satu aksen untuk semua kartu, warna lain hanya
  // untuk status data. Aksen tidak lagi bergantung pada jenis widget.
  const gayaKartu: React.CSSProperties = pakaiWarnaKartu
    ? ({
        ...tema.vars,
        ...(kacaAktif && gayaDesain
          ? {
              '--color-surface': gayaDesain.kartu,
              '--tegas-card': gayaDesain.kartu,
              '--color-line': garisBening,
              '--tegas-line': garisBening,
              backdropFilter: 'blur(18px) saturate(140%)',
              WebkitBackdropFilter: 'blur(18px) saturate(140%)',
              borderRadius: 20,
            }
          : {}),
        // Gaya bertepi tegas, bersudut khusus, atau berhuruf khusus (Blok, Bento, Koran, Neon).
        ...(gayaDesain && !widget.style?.kartu
          ? {
              ...(gayaDesain.tepi
                ? {
                    '--color-line': gayaDesain.tepi.warna,
                    '--tegas-line': gayaDesain.tepi.warna,
                    borderWidth: gayaDesain.tepi.tebal,
                    borderColor: gayaDesain.tepi.warna,
                    boxShadow: gayaDesain.tepi.bayangan !== 'none' ? gayaDesain.tepi.bayangan : undefined,
                  }
                : {}),
              ...(gayaDesain.sudutKartu !== undefined ? { borderRadius: gayaDesain.sudutKartu } : {}),
              ...(gayaDesain.huruf ? { fontFamily: gayaDesain.huruf } : {}),
            }
          : {}),
      } as React.CSSProperties)
    : {};

  // Kartu berwajah Template Chart memakai bingkai kartu halaman Template Chart
  // (`bingkaiKatalog`): latar, kepala, tepi, huruf, dan kotak kaca yang sama persis.
  const katalog = pakaiWajahKatalog(widget);
  const gKatalog = gayaKatalogWidget(widget.style, mode).g;
  const bk = katalog ? bingkaiKatalog(gKatalog) : null;
  // Kartu KPI/narasi menggambar judulnya sendiri: kepala bingkai tidak dipasang (tanpa judul dobel).
  const tanpaKepala = katalog && kartuBerjudulSendiri(widget);

  // Panel sumber dokumen: dibuka dengan mengeklik kartu (grafik: area kosong,
  // supaya klik batang tetap dipakai seleksi lintas-chart) atau ikon sumber.
  const [bukaSumber, setBukaSumber] = useState(false);

  /**
   * PEMILIH PERIODE.
   *
   * Kartu yang memuat beberapa periode (satu indikator dari beberapa dokumen)
   * menampilkan satu periode pada satu waktu. Indeks -1 = semua periode, hanya
   * ditawarkan bila semua periode punya kategori yang sama sehingga bisa
   * digambar sebagai beberapa deret.
   */
  const periodeData = widget.periodeData;
  const bolehSemua =
    !!periodeData &&
    periodeData.length > 1 &&
    // Semua periode sekaligus hanya masuk akal bila kategorinya sedikit; 36
    // kategori x 11 periode menghasilkan ratusan batang yang tidak terbaca.
    periodeData[0].xAxis.length <= 12 &&
    periodeData.every(
      (p) => p.xAxis.length === periodeData[0].xAxis.length && p.xAxis.join('|') === periodeData[0].xAxis.join('|')
    );
  /**
   * Periode terbaru yang PUNYA ANGKA. Kalau periode terakhir seluruhnya nol
   * (bulan berjalan yang belum diisi), donat dan sebagian grafik tidak
   * menggambar apa pun — jadi dipilih periode terakhir yang ada isinya.
   */
  const periodeAwal = (): number => {
    if (!periodeData || periodeData.length < 2) return 0;
    for (let i = periodeData.length - 1; i >= 0; i--) {
      if (periodeData[i].series.some((s) => s.data.some((v) => Number(v) !== 0))) return i;
    }
    return periodeData.length - 1;
  };
  const [periodeIdx, setPeriodeIdx] = useState(periodeAwal);
  useEffect(() => {
    // Data kartu berganti (mis. setelah analisis ulang): kembali ke periode berisi.
    setPeriodeIdx(periodeAwal());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.id, periodeData?.length]);

  const widgetTampil = useMemo(() => {
    if (!periodeData || periodeIdx < 0 || !periodeData[periodeIdx]) return widget;
    const p = periodeData[periodeIdx];
    return {
      ...widget,
      periodeAktif: p.periode,
      chart: { ...(widget.chart || { xAxis: [], series: [] }), xAxis: p.xAxis, series: p.series },
    };
  }, [widget, periodeData, periodeIdx]);
  const bisaSumber = !preview && !widget.dataKosong;
  const grafikKanvas = katalog && grafikKatalog(widget);
  const gPanel = bk ? gKatalog : gayaMode('default', mode);
  const warnaSumber = {
    panel: gPanel.kaca ? gPanel.padanan ?? gPanel.kartu : gPanel.kartu,
    teks: gPanel.teks,
    teks2: gPanel.teks2,
    teks3: gPanel.teks3,
    aksen: gPanel.aksen,
    garis: gPanel.garis,
  };

  return (
    <div
      data-kartu-widget={widget.id}
      className={`${bk ? 'relative flex flex-col h-full overflow-hidden group rounded-card border' : 'relative card-tegas flex flex-col h-full overflow-hidden group'} kartu-sumber-kotak`}
      style={{
        ...(bk ? bk.luar : gayaKartu),
        // Kartu terangkat sedikit saat sumbernya dibuka (umpan balik "angkat & singkap").
        transform: bukaSumber ? 'translateY(-3px) scale(1.015)' : undefined,
        boxShadow: bukaSumber ? '0 22px 48px -22px rgba(0,0,0,0.75)' : bk?.luar.boxShadow,
        zIndex: bukaSumber ? 5 : undefined,
      }}
      data-kartu-warna={pakaiWarnaKartu ? kartuEfektif : undefined}
    >
      {bisaSumber && <PanelSumber widget={widget} buka={bukaSumber} onTutup={() => setBukaSumber(false)} warna={warnaSumber} />}
      {/* Penanda aksen: blok padat 48x3px di sudut kiri atas. */}
      {!bk && <span aria-hidden="true" className="accent-bar" />}

      {/* Widget Header — pita judul terpisah dari badan kartu oleh garis 1px,
          supaya judul tidak "berenang" bersama grafiknya. */}
      <div
        className={
          tanpaKepala
            ? 'absolute top-1.5 right-1.5 z-10 rounded-chip bg-surface/90 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity'
            : bk
              ? padat
                ? 'px-2.5 py-1 flex items-center justify-between gap-1.5 border-b'
                : 'px-3.5 pt-3 pb-2.5 flex items-start justify-between gap-2 border-b'
              : padat
                ? 'px-2.5 py-1 flex items-center justify-between gap-1.5 border-b border-line'
                : 'px-5 pt-4 pb-2.5 flex items-start justify-between gap-2 border-b border-line'
        }
        style={bk && !tanpaKepala ? bk.kepala : undefined}
      >
        {!tanpaKepala && (
        <div className="min-w-0">
          {/* Ikon kartu (khusus template): kotak kecil beraksen di atas judul,
              meniru pratinjau template agar kanvas nyata terlihat sama. */}
          {widget.ikon && (
            <span
              className={
                padat
                  ? 'inline-flex items-center justify-center w-[18px] h-[18px] rounded-[5px] mb-1'
                  : 'inline-flex items-center justify-center w-6 h-6 rounded-[7px] mb-1.5'
              }
              style={{ backgroundColor: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}
              aria-hidden="true"
            >
              {ikonKartu(widget.ikon)}
            </span>
          )}
          <h3
            className={
              bk
                ? padat
                  ? 'text-[11px] font-bold leading-tight line-clamp-1'
                  : 'text-[13px] font-bold leading-snug truncate'
                : padat
                  ? 'text-[11px] font-bold text-ink leading-tight line-clamp-1'
                  : 'text-[15px] font-bold text-ink tracking-[-0.01em] leading-snug line-clamp-2 min-h-[2.5em]'
            }
            style={bk?.judul}
            title={widget.title}
          >
            {widget.title}
          </h3>
          {/* Subtitle disembunyikan untuk KPI yang punya target — badan kartu sudah
              menampilkan baris target di progress bar, jadi tidak dobel. */}
          {!padat && widget.subtitle && !(widget.type === 'kpi' && widget.kpi?.target !== undefined) && (
            <p
              className={bk ? 'text-[11px] mt-0.5 leading-snug line-clamp-2' : 'text-[10px] font-bold uppercase tracking-[0.1em] text-ink-2 truncate mt-1'}
              style={bk?.sub}
              title={widget.subtitle}
            >
              {widget.subtitle}
            </p>
          )}
        </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Pemilih periode: satu kartu memuat beberapa periode, tampil satu per satu. */}
          {!!periodeData && periodeData.length > 1 && (
            <select
              value={periodeIdx}
              onChange={(e) => setPeriodeIdx(Number(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="max-w-[136px] text-[10px] font-semibold rounded-chip border border-line bg-surface px-1.5 py-0.5 text-ink-2 cursor-pointer"
              title="Pilih periode yang ditampilkan"
              data-testid="pilih-periode-kartu"
            >
              {bolehSemua && <option value={-1}>Semua periode</option>}
              {periodeData.map((p, i) => (
                <option key={`${p.periode}-${i}`} value={i}>
                  {p.periode}
                </option>
              ))}
            </select>
          )}

          {/* Hanya penanda koreksi manual yang tersisa — tanpa label provenans AI/sumber. */}
          {isManual && (
            <span
              className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warn/15 text-warn border border-warn/30 cursor-help opacity-90 group-hover:opacity-100 transition-opacity"
              title={`Dikoreksi manual oleh ${widget.manualCorrection?.correctedBy || 'Analis'} (${widget.manualCorrection?.reason || 'Penyesuaian internal'}). Nilai asli: ${widget.manualCorrection?.originalValue}`}
            >
              <UserCheck className="w-3 h-3 text-warn" />
              <span>Koreksi Manual</span>
            </span>
          )}

          {bisaSumber && (
            <button
              type="button"
              onClick={() => setBukaSumber(true)}
              className="p-1 rounded-chip text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors"
              style={bk && !tanpaKepala ? bk.sub : undefined}
              title="Lihat sumber dokumen"
              aria-label="Lihat sumber dokumen"
              data-testid="tombol-sumber"
            >
              <FileSearch className="w-4 h-4" />
            </button>
          )}

          {/* Menu opsi (⋯) — satu-satunya tombol yang selalu tampak. Disembunyikan
              di mode pratinjau (widget template belum nyata, jadi tidak ada aksi). */}
          {!preview && (
          <div className="relative">
            <button
              ref={tombolMenuRef}
              onClick={() => (showMenu ? setShowMenu(false) : bukaMenu())}
              className="p-1.5 rounded-chip text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors"
              style={bk && !tanpaKepala ? bk.sub : undefined}
              title="Menu Opsi Widget"
              aria-label="Menu Opsi Widget"
              aria-haspopup="menu"
              aria-expanded={showMenu}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && posisiMenu && createPortal(
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div
                  data-menu-widget={widget.id}
                  className="fixed w-64 bg-surface rounded-control shadow-pop border border-line py-1 z-[45] text-xs text-ink-2 overflow-y-auto gulir-tema"
                  style={{ top: posisiMenu.top, left: posisiMenu.left, maxHeight: posisiMenu.maxHeight }}
                >
                  {punyaDataChart(widget) && (
                    <>
                      <div className="px-3 pt-1 pb-0.5 flex items-baseline justify-between gap-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-ink-3">
                          Ganti chart
                        </span>
                        <span className="text-[9px] text-ink-3">langsung berubah</span>
                      </div>
                      {/* Semua chart yang datanya tersedia di kartu ini. Klik = kartu
                          berganti saat itu juga (tanpa modal); menu dibiarkan terbuka
                          supaya beberapa bentuk bisa dicoba berturut-turut. */}
                      <div className="px-3 pb-2 grid grid-cols-2 gap-1 max-h-56 overflow-y-auto gulir-tema">
                        {daftarChart.map((id) => {
                          const aktif = widget.chartId === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => onGantiChart?.(widget, id)}
                              aria-pressed={aktif}
                              data-testid={`ganti-chart-${id}`}
                              className={`h-11 sm:h-9 text-[11px] font-semibold px-2 rounded-chip border transition-colors text-left flex items-center gap-1.5 ${
                                aktif
                                  ? 'bg-solid text-on-solid border-solid'
                                  : 'bg-surface-2 text-ink-2 border-line hover:text-ink hover:border-line-strong'
                              }`}
                              title={CHART_DEFAULT[id].guna}
                            >
                              {/* Lebar ikon dicadangkan selalu: kalau centang baru
                                  muncul saat aktif, isi tombol bergeser. */}
                              <span className="w-3 h-3 shrink-0 flex items-center justify-center">
                                {aktif && <Check className="w-3 h-3" />}
                              </span>
                              <span className="truncate">{CHART_DEFAULT[id].nama}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="border-t border-line my-1" />
                    </>
                  )}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(widget);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-surface-2 flex items-center gap-2"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-brand" />
                    <span>Atur Chart & Judul (panel kanan)</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onManualCorrection(widget);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-warn/10 flex items-center gap-2 text-warn whitespace-nowrap"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-warn shrink-0" />
                    <span>Koreksi Angka Manual (F-14)</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDuplicate(widget);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-surface-2 flex items-center gap-2"
                  >
                    <Copy className="w-3.5 h-3.5 text-brand" />
                    <span>Duplikat Widget</span>
                  </button>
                  <div className="border-t border-line my-1" />
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(widget.id);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neg/10 flex items-center gap-2 text-neg"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-neg" />
                    <span>Hapus dari Dashboard</span>
                  </button>
                </div>
              </>,
              document.body
            )}
          </div>
          )}
        </div>
      </div>

      {/* Widget Content Body — tinggi minimum hanya untuk grafik/tabel; kartu KPI & narasi mengikuti isi */}
      <div
        onClick={bisaSumber && !grafikKanvas ? () => setBukaSumber(true) : undefined}
        title={bisaSumber && !grafikKanvas ? 'Klik untuk melihat sumber dokumen' : undefined}
        style={{
          cursor: bisaSumber && !grafikKanvas ? 'pointer' : undefined,
          opacity: bukaSumber ? 0 : 1,
          filter: bukaSumber ? 'blur(4px)' : 'none',
          transform: bukaSumber ? 'scale(1.04)' : 'none',
        }}
        className={`kartu-sumber-depan flex-1 flex flex-col overflow-y-auto gulir-tema ${
          bk
            ? padat ? 'p-1.5 min-h-0' : 'p-2.5 min-h-0'
            : padat
            ? 'px-2 pb-1 pt-0.5 min-h-0'
            : `px-5 pb-4 pt-3 ${
                ['line', 'bar', 'area', 'hbar', 'combo', 'pie', 'donut', 'treemap', 'funnel',
                  'waterfall', 'sankey', 'scatter', 'bubble', 'histogram', 'boxplot', 'heatmap',
                  'radar', 'map', 'gantt', 'table'].includes(widget.type) ? 'min-h-[140px]' : 'min-h-0'
              }`
        }`}
      >
        {widget.dataKosong ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-1.5 py-3">
            {/*
              DUA SEBAB KOSONG YANG BERBEDA. `dataTertunda` = pengisian belum
              selesai (waktu/layanan habis) dan akan lanjut sendiri; tanpa tanda
              ini pengguna melihat puluhan kartu "belum ada di dokumen" padahal
              dokumennya hanya belum selesai dibaca.
            */}
            {widget.dataTertunda ? (
              <Loader2 className="w-6 h-6 text-brand/70 animate-spin" />
            ) : (
              <Database className="w-6 h-6 text-ink-3 opacity-60" />
            )}
            <p className="text-[12px] font-semibold text-ink-2">
              {widget.dataTertunda ? 'Sedang diisi dari dokumen' : 'Belum ada di dokumen'}
            </p>
            <p className="text-[10.5px] text-ink-3 leading-relaxed max-w-[34ch]">
              {widget.catatanData || 'Indikator ini tidak ditemukan di dokumen instansi.'}
            </p>
            <p className="text-[10px] text-ink-3 italic">
              {widget.dataTertunda
                ? 'Angka menyusul otomatis, tidak perlu muat ulang.'
                : 'Tidak ada angka contoh yang ditampilkan.'}
            </p>
          </div>
        ) : bk?.dalam ? (
          // Gaya bening: chart digambar di atas kotak kaca buram, seperti di Template Chart.
          <div className="rounded-[16px] border p-2 flex-1 min-h-0 flex flex-col" style={bk.dalam}>
            {/* `key` berganti saat bentuk chart berganti: mesin gambar lama dibuang
                utuh sebelum yang baru dipasang, jadi tidak ada dua mesin yang
                berebut elemen DOM yang sama (penyebab layar "Halaman gagal dimuat"). */}
            <PagarGrafik key={`${widget.chartId ?? ''}-${widget.type}`}>
              <WidgetRenderer widget={widgetTampil} urutan={urutan} padat={padat} preview={preview} onKlikKosong={bisaSumber ? () => setBukaSumber(true) : undefined} />
            </PagarGrafik>
          </div>
        ) : (
          <PagarGrafik key={`${widget.chartId ?? ''}-${widget.type}`}>
            <WidgetRenderer widget={widgetTampil} urutan={urutan} padat={padat} preview={preview} onKlikKosong={bisaSumber ? () => setBukaSumber(true) : undefined} />
          </PagarGrafik>
        )}
      </div>
    </div>
  );
};
