import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Brain,
  Check,
  ChevronDown,
  Database,
  FileText,
  Inbox,
  LayoutGrid,
  Pencil,
  Plus,
  Info,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  Timer,
  X,
} from 'lucide-react';
import type { ButirData, Dashboard, WidgetSpec, WidgetType } from '../types';
import { WidgetCard } from '../components/widgets/WidgetCard';
import { butirKeWidget } from '../services/analisis/butirKeWidget';
import { bentukCocok } from '../services/chart/bentukCocok';
import { cekAturanDashboard, saranTerkait } from '../services/analisis/aturanDashboard';
import { preloadEcharts } from '../components/widgets/ChartEcharts';

/**
 * HALAMAN PILIH DATA — jalur "dari permintaan pengguna".
 *
 * Dua hal penting di berkas ini:
 *
 * 1. **Menyegarkan sendiri.** Halaman memantau `/api/butir-data` tiap 12 detik
 *    (dan saat tab kembali aktif), jadi begitu dokumen selesai dianalisis dan
 *    angkanya disetujui, data muncul tanpa muat ulang manual.
 * 2. **Menjawab "kenapa kosong".** Bila belum ada butir, halaman menyebut
 *    keadaannya: analisis masih berjalan, analisis GAGAL (dengan pesan galat dan
 *    tombol ulang), atau data sudah terbaca tetapi menunggu persetujuan admin.
 */
interface Props {
  namaInstansi?: string;
  onSelesai: (dashboard: Dashboard, ringkasan: string) => void;
  /** Kembali ke daftar dashboard. */
  onKembali: () => void;
  /** Buka Kotak Inbox saat data masih menunggu persetujuan. */
  onBukaPermintaan?: () => void;
}

interface RingkasSumber {
  dokumen: number;
  selesai: number;
  berjalan: number;
  gagal: { id: string; berkasId: string; judul: string; galat: string; dibuatPada: string }[];
  menunggu: number;
  diperbaruiPada: string;
}

const JEDA_PANTAU_MS = 12_000;

function ringkasAngka(b: ButirData): string {
  const fmt = (n: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);
  if (b.nilai !== undefined && b.nilai !== null) return `${fmt(b.nilai)}${b.satuan ? ` ${b.satuan}` : ''}`;
  if (b.seri && b.seri.length > 0) {
    const titik = b.seri.reduce((n, s) => n + s.data.length, 0);
    return `${b.seri.length} deret · ${titik} titik${b.satuan ? ` (${b.satuan})` : ''}`;
  }
  if (b.tabel) return `tabel ${b.tabel.baris.length} baris`;
  return 'tanpa angka';
}

/**
 * Butir yang benar-benar punya angka untuk ditampilkan.
 *
 * Butir tanpa angka tunggal, tanpa deret yang bisa digambar, dan tanpa tabel
 * berisi disembunyikan dari daftar. Dulu butir seperti itu tetap muncul, lalu
 * pratinjaunya kosong saat diklik. Butir akan muncul sendiri begitu angkanya
 * terbaca pada analisis berikutnya.
 */
function punyaAngka(b: ButirData): boolean {
  if (b.nilai !== undefined && b.nilai !== null && Number.isFinite(Number(b.nilai))) return true;
  const barisTabel = b.tabel?.baris ?? [];
  if (barisTabel.some((r) => r.slice(1).some((sel) => sel !== '' && sel !== null && sel !== undefined))) return true;
  const w = butirKeWidget(b, 1);
  return !!w?.chart?.series?.some((s) => s.data.length > 0);
}

const WARNA_KATEGORI: Record<string, string> = {
  Keuangan: 'bg-pos/10 text-pos border-pos/25',
  SDM: 'bg-coral/10 text-coral border-coral/25',
  Pelayanan: 'bg-brand/10 text-brand-ink border-brand/25',
  Operasional: 'bg-surface-2 text-ink-2 border-line',
};

/** Angka asli sebagai tabel — dipakai bila grafiknya tidak tergambar. */
function TabelAngka({ butir }: { butir: ButirData }) {
  const seri = (butir.seri || []).filter((s) => s.data.length > 0);
  if (seri.length === 0) {
    return <p className="text-[11px] text-ink-3">Butir ini tidak menyimpan deret angka.</p>;
  }
  const mentah = seri[0].kategori || [];
  const label =
    mentah.length === seri[0].data.length ? mentah : seri[0].data.map((_, i) => `Titik ${i + 1}`);
  const dipakai = label.slice(0, 15);

  return (
    <table className="w-full text-[11px] border-collapse">
      <thead>
        <tr className="text-ink-3">
          <th className="text-left font-semibold py-1 pr-2 border-b border-line">Kategori</th>
          {seri.map((s, j) => (
            <th key={j} className="text-right font-semibold py-1 pl-2 border-b border-line">
              {s.nama || `Seri ${j + 1}`}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {dipakai.map((kat, i) => (
          <tr key={i} className="text-ink-2">
            <td className="py-1 pr-2 border-b border-line/60 truncate max-w-[240px]">{String(kat)}</td>
            {seri.map((s, j) => (
              <td key={j} className="py-1 pl-2 border-b border-line/60 text-right tabular-nums">
                {Number(s.data[i] ?? 0).toLocaleString('id-ID')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {label.length > dipakai.length && (
        <tfoot>
          <tr>
            <td colSpan={seri.length + 1} className="pt-1 text-[10px] text-ink-3">
              {label.length - dipakai.length} baris lain tidak ditampilkan
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

/**
 * Berapa angka yang belum terisi pada sebuah butir.
 *
 * Dipakai untuk memberi tahu pengguna bahwa grafiknya tidak memuat seluruh
 * data — lebih jujur daripada menampilkan grafik rapi yang sebenarnya bolong.
 */
function titikBelumTerisi(b: ButirData): number {
  let kurang = 0;
  for (const s of b.seri || []) {
    const kat = s.kategori?.length ?? 0;
    if (kat > s.data.length) kurang += kat - s.data.length;
    kurang += s.data.filter((v) => !Number.isFinite(Number(v))).length;
  }
  return kurang;
}

/**
 * SALINAN DAFTAR DATA DI PERAMBAN.
 *
 * Disimpan di `localStorage` supaya halaman Pilih Data langsung berisi saat
 * dibuka. Kunci diberi versi agar bentuk data lama tidak terbaca setelah
 * strukturnya berubah. Salinan selalu ditimpa jawaban server terbaru, jadi
 * dokumen yang baru dianalisis ikut muncul tanpa perlu membersihkan cache.
 */
const KUNCI_CACHE = 'pilih-data-cache-v1';

function bacaCache(): { butir: ButirData[]; ringkas: RingkasSumber | null } | null {
  try {
    const mentah = window.localStorage.getItem(KUNCI_CACHE);
    if (!mentah) return null;
    const isi = JSON.parse(mentah);
    if (!Array.isArray(isi?.butir) || isi.butir.length === 0) return null;
    return { butir: (isi.butir as ButirData[]).filter(punyaAngka), ringkas: (isi.ringkas ?? null) as RingkasSumber | null };
  } catch {
    // Cache rusak atau localStorage diblokir: anggap tidak ada, ambil dari server.
    return null;
  }
}

function simpanCache(butir: ButirData[], ringkas: RingkasSumber | null): void {
  try {
    window.localStorage.setItem(KUNCI_CACHE, JSON.stringify({ butir, ringkas, pada: Date.now() }));
  } catch {
    // Kuota penuh / mode privat: tidak mengapa, server tetap sumber kebenaran.
  }
}

/**
 * KANVAS PILIH DATA: beberapa halaman, tiap halaman berisi kartu. Satu kartu =
 * satu butir + bentuk chart pilihan pengguna. Disimpan di `localStorage` supaya
 * susunan tidak hilang saat halaman dimuat ulang (kenyamanan per peramban,
 * bukan penyimpanan resmi: yang resmi adalah dashboard yang dibuat).
 */
interface KartuKanvas {
  kunci: string;
  butirId: string;
  chartId: string;
}
interface HalamanKanvas {
  id: string;
  judul: string;
  kartu: KartuKanvas[];
}
const KUNCI_KANVAS = 'pilih-data-kanvas-v1';
const kunciBaru = (awalan: string) =>
  `${awalan}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const halamanKosong = (n: number): HalamanKanvas => ({ id: kunciBaru('hal'), judul: `Halaman ${n}`, kartu: [] });

function bacaKanvas(): HalamanKanvas[] {
  try {
    const isi = JSON.parse(window.localStorage.getItem(KUNCI_KANVAS) || 'null');
    if (
      Array.isArray(isi) &&
      isi.length > 0 &&
      isi.every((h) => h && typeof h.id === 'string' && Array.isArray(h.kartu))
    ) {
      return isi as HalamanKanvas[];
    }
  } catch {
    // Salinan rusak atau penyimpanan diblokir: mulai dari kanvas kosong.
  }
  return [halamanKosong(1)];
}

function simpanKanvas(h: HalamanKanvas[]): void {
  try {
    window.localStorage.setItem(KUNCI_KANVAS, JSON.stringify(h));
  } catch {
    // Kuota penuh / mode privat: kanvas tetap jalan, hanya tidak diingat.
  }
}

/**
 * Pratinjau kartu dengan jaring pengaman.
 *
 * Kalau grafiknya tidak mengeluarkan satu goresan pun (donat yang seluruh
 * nilainya nol, sumbu yang tidak punya rentang, dsb.), kartu diganti tabel
 * angka aslinya. Jadi yang muncul selalu ada isinya: grafik, atau angkanya.
 */
const PratinjauKartu: React.FC<{ widget: WidgetSpec; butir: ButirData }> = ({ widget, butir }) => {
  const wadah = useRef<HTMLDivElement | null>(null);
  /**
   * Tinggi grafik mengikuti jumlah kategori untuk batang mendatar/tegak.
   * Dua belas label butuh ruang berbeda dengan tiga puluh enam; memaksa
   * semuanya ke 360px membuat labelnya bertumpuk.
   */
  const jumlahKategori = widget.chart?.xAxis?.length ?? 0;
  const tinggi =
    widget.type === 'hbar' || widget.type === 'bar'
      ? Math.max(360, Math.min(1600, jumlahKategori * 26 + 96))
      : widget.type === 'kpi'
        ? 170
        : 360;
  /** Deret yang seluruh nilainya nol tidak akan menghasilkan gambar apa pun. */
  const semuaNol = (widget.chart?.series || []).every((s) => s.data.every((v) => Number(v) === 0));
  /** KPI tanpa angka tunggal juga tidak menggambar apa pun. */
  const kpiTanpaAngka = widget.type === 'kpi' && (butir.nilai === undefined || butir.nilai === null);
  const [kosong, setKosong] = useState(
    kpiTanpaAngka || (semuaNol && widget.type !== 'table' && widget.type !== 'kpi')
  );

  useEffect(() => {
    if (widget.type === 'table' || widget.type === 'kpi' || !widget.chartId || semuaNol) return;
    const jam = window.setTimeout(() => {
      const kanvas = wadah.current?.querySelector('canvas') as HTMLCanvasElement | null;
      if (!kanvas) return;
      try {
        const ctx = kanvas.getContext('2d');
        if (!ctx) return;
        const lebar = kanvas.width;
        const tinggi = kanvas.height;
        if (!lebar || !tinggi) return;
        const piksel = ctx.getImageData(0, 0, lebar, tinggi).data;
        const dasar = [piksel[0], piksel[1], piksel[2]];
        let beda = 0;
        for (let i = 0; i < piksel.length; i += 4 * 13) {
          if (
            Math.abs(piksel[i] - dasar[0]) > 10 ||
            Math.abs(piksel[i + 1] - dasar[1]) > 10 ||
            Math.abs(piksel[i + 2] - dasar[2]) > 10
          ) {
            beda++;
            if (beda > 6) break;
          }
        }
        if (beda <= 6) setKosong(true);
      } catch {
        // Kanvas tidak bisa dibaca (mis. dirender di lapisan lain): biarkan.
      }
    }, 1500);
    return () => window.clearTimeout(jam);
  }, [widget, semuaNol]);

  if (kosong) {
    return (
      <div className="h-full flex flex-col gap-2 min-h-0" data-testid="pratinjau-angka">
        <p className="text-[11px] text-ink-3 shrink-0">
          {kpiTanpaAngka
            ? 'Data ini belum punya angka tunggal. Ini isi selnya:'
            : 'Grafiknya tidak tergambar untuk data ini. Ini angka aslinya:'}
        </p>
        <div className="flex-1 min-h-0 overflow-auto">
          <TabelAngka butir={butir} />
        </div>
      </div>
    );
  }

  return (
    <div ref={wadah} style={{ height: tinggi }}>
      <WidgetCard
        widget={widget}
        urutan={1}
        preview
        onEdit={() => {}}
        onManualCorrection={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
      />
    </div>
  );
};

/**
 * Spek kartu untuk kanvas mini. Bentuk grafik tanpa deret tetapi punya angka
 * tunggal ditampilkan sebagai KPI, bukan kanvas grafik kosong.
 */
function spekPratinjau(b: ButirData, chartId: string): WidgetSpec | null {
  const mentah = butirKeWidget(b, 1, chartId ? { chartId } : undefined);
  if (
    mentah &&
    mentah.type !== 'kpi' &&
    mentah.type !== 'table' &&
    !mentah.chart?.series?.some((s) => s.data.length > 0) &&
    mentah.kpi
  ) {
    return { ...mentah, type: 'kpi' as WidgetType };
  }
  return mentah;
}

/**
 * Penjaga render untuk pratinjau.
 *
 * Satu kartu yang gagal digambar tidak boleh membuat seluruh halaman kosong.
 * Batasnya ditaruh di sekitar pratinjau saja, dan pesannya menyebut butir mana
 * yang bermasalah supaya bisa ditelusuri tanpa membuka konsol.
 */
class PenjagaRender extends React.Component<{ pesan: string; children: React.ReactNode }, { galat: string }> {
  state = { galat: '' };

  static getDerivedStateFromError(e: unknown) {
    return { galat: e instanceof Error ? e.message : 'tidak bisa digambar' };
  }

  render() {
    if (this.state.galat) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-1 text-center px-6">
          <p className="text-xs font-semibold text-ink-2">Pratinjau tidak bisa ditampilkan</p>
          <p className="text-[11px] text-ink-3">{this.props.pesan}</p>
          <p className="text-[10px] text-ink-3 break-all">{this.state.galat}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export const PilihDataPage: React.FC<Props> = ({ namaInstansi, onSelesai, onBukaPermintaan }) => {
  /**
   * DAFTAR DATA DISIMPAN DI PERAMBAN.
   *
   * Halaman ini dibuka berkali-kali sehari dan daftarnya berisi ratusan butir;
   * menunggu `GET /api/butir-data` setiap kali membuat layar kosong. Salinan
   * terakhir ditampilkan lebih dulu, lalu diganti versi segar dari server —
   * jadi dokumen baru tetap masuk tanpa menekan tombol apa pun.
   */
  const cacheAwal = useMemo(() => bacaCache(), []);
  const [butir, setButir] = useState<ButirData[]>(cacheAwal?.butir ?? []);
  const [ringkas, setRingkas] = useState<RingkasSumber | null>(cacheAwal?.ringkas ?? null);
  /** True selama yang tampil masih salinan tersimpan, bukan jawaban server terbaru. */
  const [dariCache, setDariCache] = useState(!!cacheAwal);
  // Bila salinan tersimpan ada, kerangka memuat tidak perlu ditampilkan.
  const [memuat, setMemuat] = useState(!cacheAwal);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [galat, setGalat] = useState('');
  const kanvasAwal = useMemo(() => bacaKanvas(), []);
  const [halamanKanvas, setHalamanKanvas] = useState<HalamanKanvas[]>(kanvasAwal);
  const [idHalamanAktif, setIdHalamanAktif] = useState<string>(kanvasAwal[0].id);
  /**
   * DRAF KARTU. Klik kartu data membuka draf di kanvas: bentuk chart dipilih
   * dulu sambil melihat hasilnya, lalu Simpan menaruhnya di halaman aktif atau
   * Batal membuangnya. `kunciEdit` terisi saat mengubah bentuk kartu yang sudah ada.
   */
  const [draf, setDraf] = useState<{ butir: ButirData; chartId: string; kunciEdit?: string } | null>(null);
  /**
   * KANVAS MINI. Klik kartu data langsung menaruhnya di kanvas di sisi kanan
   * (tanpa kotak centang dan tanpa modal pratinjau). Di layar sempit daftar
   * data dan kanvas bergantian lewat dua tab.
   */
  const [tabMini, setTabMini] = useState<'data' | 'kanvas'>('data');
  const [cari, setCari] = useState('');
  const [kategoriAktif, setKategoriAktif] = useState('Semua');
  const [judul, setJudul] = useState('');
  const [membuat, setMembuat] = useState(false);
  /** Sedang menyusun dashboard rekomendasi (beberapa halaman sekaligus). */
  const [membuatReko, setMembuatReko] = useState(false);
  /**
   * Rasa penyusunan. Bukan sekadar label: `cepat` memangkas katalog yang dibaca
   * model, `mendalam` menambah satu putaran untuk halaman lanjutan.
   */
  const [modeReko, setModeReko] = useState<'cepat' | 'seimbang' | 'mendalam' | 'ultra'>('seimbang');
  const [bukaMode, setBukaMode] = useState(false);

  // Modal ditutup dengan Escape, seperti dialog lain di aplikasi ini.
  useEffect(() => {
    if (!bukaMode) return;
    const tutup = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBukaMode(false);
    };
    document.addEventListener('keydown', tutup);
    return () => document.removeEventListener('keydown', tutup);
  }, [bukaMode]);
  const [mengulang, setMengulang] = useState<string | null>(null);
  /** Dinaikkan saat analisis diulang supaya pantauan lebih rapat sementara waktu. */
  const [cekat, setCekat] = useState(0);
  const sidikTerakhir = useRef(cacheAwal ? JSON.stringify(cacheAwal.butir) : '');

  const muat = useCallback(async (diam = false) => {
    if (diam) setMenyegarkan(true);
    else setMemuat(true);
    try {
      const res = await fetch('/api/butir-data?status=disetujui', { credentials: 'include' });
      if (!res.ok) throw new Error('Daftar data tidak bisa dimuat.');
      const isi = await res.json();
      // Butir tanpa angka tidak ditampilkan: pratinjaunya hanya akan kosong.
      const daftar: ButirData[] = (Array.isArray(isi?.butir) ? (isi.butir as ButirData[]) : []).filter(punyaAngka);
      const sidik = JSON.stringify(daftar);
      // Ganti state hanya bila isinya berubah, supaya pemantauan tidak berkedip.
      if (sidik !== sidikTerakhir.current) {
        sidikTerakhir.current = sidik;
        setButir(daftar);
        const ada = new Set(daftar.map((b) => b.id));
        setHalamanKanvas((hs) => hs.map((h) => ({ ...h, kartu: h.kartu.filter((k) => ada.has(k.butirId)) })));
      }
      setRingkas(isi?.ringkas ?? null);
      setGalat('');
      setDariCache(false);
      simpanCache(daftar, isi?.ringkas ?? null);
    } catch (e) {
      const pesan = e instanceof Error ? e.message : 'Daftar data tidak bisa dimuat.';
      // Salinan tersimpan tetap ditampilkan; beri tahu bahwa angkanya belum segar.
      setGalat(bacaCache() ? `${pesan} Menampilkan data tersimpan.` : pesan);
    } finally {
      setMemuat(false);
      setMenyegarkan(false);
    }
  }, []);

  useEffect(() => {
    // Mesin chart (chunk echarts) mulai diunduh sekarang, bukan saat kartu
    // pratinjau pertama diklik — supaya klik pertama tidak tampak kosong.
    void preloadEcharts();
    void muat();
  }, []);

  /** Kategori yang benar-benar ada, dipakai baris chip filter. */
  const kategoriTersedia = useMemo(() => {
    const set = new Set<string>(['Semua']);
    for (const b of butir) set.add(b.kategori || 'Umum');
    return Array.from(set);
  }, [butir]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return butir.filter((b) => {
      const k = b.kategori || 'Umum';
      if (kategoriAktif !== 'Semua' && k !== kategoriAktif) return false;
      if (!q) return true;
      return (
        b.nama.toLowerCase().includes(q) ||
        k.toLowerCase().includes(q) ||
        (b.sitasi?.dokumen || '').toLowerCase().includes(q)
      );
    });
  }, [butir, cari, kategoriAktif]);

  const perKategori = useMemo(() => {
    const peta = new Map<string, ButirData[]>();
    for (const b of tersaring) {
      const k = b.kategori || 'Umum';
      peta.set(k, [...(peta.get(k) ?? []), b]);
    }
    return Array.from(peta.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tersaring]);

  // Kanvas diingat per peramban.
  useEffect(() => simpanKanvas(halamanKanvas), [halamanKanvas]);

  const halamanAktifKanvas = halamanKanvas.find((h) => h.id === idHalamanAktif) ?? halamanKanvas[0];
  /** Semua butir yang ada di kanvas (halaman mana pun), tanpa kembar. */
  const dipilih = useMemo(
    () => [...new Set(halamanKanvas.flatMap((h) => h.kartu.map((k) => k.butirId)))],
    [halamanKanvas]
  );
  const jumlahKartu = halamanKanvas.reduce((n, h) => n + h.kartu.length, 0);
  const diHalamanAktif = useMemo(
    () => new Set(halamanAktifKanvas.kartu.map((k) => k.butirId)),
    [halamanAktifKanvas]
  );
  const petaButir = useMemo(() => new Map(butir.map((b) => [b.id, b])), [butir]);
  /** Aturan dashboard baru: minimal 3 chart dan semuanya berhubungan. */
  const aturan = useMemo(
    () =>
      cekAturanDashboard(
        halamanKanvas
          .flatMap((h) => h.kartu.map((k) => petaButir.get(k.butirId)))
          .filter((b): b is ButirData => Boolean(b))
      ),
    [halamanKanvas, petaButir]
  );
  const saranAturan = useMemo(
    () =>
      saranTerkait(
        dipilih.map((id) => petaButir.get(id)).filter((b): b is ButirData => Boolean(b)),
        butir,
        aturan.kurang
      ),
    [dipilih, petaButir, butir, aturan.kurang]
  );
  const bentukAwal = (b: ButirData) => bentukCocok([b])[0]?.id || '';
  const gulirKe = (id: string) =>
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);

  const ubahHalamanAktif = (f: (k: KartuKanvas[]) => KartuKanvas[]) =>
    setHalamanKanvas((hs) => hs.map((h) => (h.id === halamanAktifKanvas.id ? { ...h, kartu: f(h.kartu) } : h)));

  /** Klik kartu data: buka draf untuk memilih bentuk chart lebih dulu. */
  const bukaDraf = (b: ButirData) => {
    setDraf({ butir: b, chartId: bentukAwal(b) });
    setTabMini('kanvas');
    gulirKe('kanvas-draf');
  };

  const simpanDraf = () => {
    if (!draf) return;
    const kunci = draf.kunciEdit ?? kunciBaru('kartu');
    if (draf.kunciEdit) {
      ubahHalamanAktif((ks) => ks.map((k) => (k.kunci === kunci ? { ...k, chartId: draf.chartId } : k)));
    } else {
      ubahHalamanAktif((ks) => [...ks, { kunci, butirId: draf.butir.id, chartId: draf.chartId }]);
    }
    setDraf(null);
    gulirKe(`kanvas-${kunci}`);
  };

  /** Dijalankan pengguna sendiri: tambahkan chart terkait sampai batas minimal. */
  const tambahChartTerkait = () =>
    ubahHalamanAktif((ks) => [
      ...ks,
      ...saranAturan.map((b) => ({ kunci: kunciBaru('kartu'), butirId: b.id, chartId: bentukAwal(b) })),
    ]);

  const keluarkanKartu = (kunci: string) => ubahHalamanAktif((ks) => ks.filter((k) => k.kunci !== kunci));

  const tambahHalaman = () => {
    const h = halamanKosong(halamanKanvas.length + 1);
    setHalamanKanvas((hs) => [...hs, h]);
    setIdHalamanAktif(h.id);
  };

  const hapusHalaman = (id: string) => {
    const sisa = halamanKanvas.filter((h) => h.id !== id);
    if (sisa.length === 0) return;
    setHalamanKanvas(sisa);
    if (id === halamanAktifKanvas.id) setIdHalamanAktif(sisa[0].id);
  };

  const ubahJudulHalaman = (judulBaru: string) =>
    setHalamanKanvas((hs) => hs.map((h) => (h.id === halamanAktifKanvas.id ? { ...h, judul: judulBaru } : h)));

  /** "Tambah semua" per kategori: langsung masuk halaman aktif dengan bentuk bawaan. */
  const alihkanKategori = (daftar: ButirData[]) => {
    const semua = daftar.every((b) => diHalamanAktif.has(b.id));
    ubahHalamanAktif((ks) =>
      semua
        ? ks.filter((k) => !daftar.some((b) => b.id === k.butirId))
        : [
            ...ks,
            ...daftar
              .filter((b) => !diHalamanAktif.has(b.id))
              .map((b) => ({ kunci: kunciBaru('kartu'), butirId: b.id, chartId: bentukAwal(b) })),
          ]
    );
  };

  const ulangAnalisis = async (id: string) => {
    setMengulang(id);
    setGalat('');
    try {
      const res = await fetch(`/api/analisis/${id}/ulang`, { method: 'POST', credentials: 'include' });
      const isi = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(isi?.error || 'Analisis gagal diulang.');
      setCekat((n) => n + 1);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Analisis gagal diulang.');
    } finally {
      setMengulang(null);
    }
  };

  const buat = async () => {
    const halamanIsi = halamanKanvas.filter((h) => h.kartu.length > 0);
    if (halamanIsi.length === 0) {
      setGalat('Simpan dulu minimal satu kartu ke kanvas.');
      return;
    }
    if (!aturan.boleh) {
      setGalat(aturan.pesan);
      return;
    }
    setMembuat(true);
    setGalat('');
    try {
      const res = await fetch('/api/dashboards/dari-butir', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          butirIds: dipilih,
          judul: judul.trim() || `Dashboard ${namaInstansi || 'Instansi'} — ${new Date().getFullYear()}`,
          halaman: halamanIsi.map((h, i) => ({
            judul: h.judul.trim() || `Halaman ${i + 1}`,
            kartu: h.kartu.map((k) => ({ butirId: k.butirId, chartId: k.chartId })),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.dashboard) throw new Error(data?.error || 'Dashboard gagal dibuat.');
      // Kanvas dikosongkan: susunannya sudah menjadi dashboard.
      const awal = halamanKosong(1);
      setHalamanKanvas([awal]);
      setIdHalamanAktif(awal.id);
      // Disimpan langsung: halaman ini segera ditutup, efek penyimpan tidak sempat jalan.
      simpanKanvas([awal]);
      onSelesai(data.dashboard as Dashboard, String(data?.ringkasan || 'Dashboard dibuat.'));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Dashboard gagal dibuat.');
    } finally {
      setMembuat(false);
    }
  };

  /**
   * REKOMENDASI AI.
   *
   * Beda dengan `buat()`: kalau tidak ada butir yang dicentang, yang dipakai
   * bukan "tidak boleh" tetapi SEMUA data yang sudah termuat. Server yang
   * memilih kartu, bentuk chart, dan menyusun halamannya, jadi pengguna tidak
   * perlu mencentang apa pun untuk mendapat dashboard lengkap.
   */
  const rekomendasi = async (mode: 'cepat' | 'seimbang' | 'mendalam' | 'ultra' = modeReko) => {
    setModeReko(mode);
    setBukaMode(false);
    setMembuatReko(true);
    setGalat('');
    try {
      const res = await fetch('/api/dashboards/rekomendasi', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          ...(dipilih.length > 0 ? { butirIds: dipilih } : {}),
          ...(judul.trim() ? { judul: judul.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.dashboard) throw new Error(data?.error || 'Dashboard rekomendasi gagal disusun.');
      onSelesai(data.dashboard as Dashboard, String(data?.ringkasan || 'Dashboard rekomendasi siap.'));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Dashboard rekomendasi gagal disusun.');
    } finally {
      setMembuatReko(false);
    }
  };

  // Kegagalan hanya ditonjolkan saat belum ada data sama sekali; bila angkanya
  // sudah ada, peringatan lama tidak perlu menutupi daftar yang bisa dipakai.
  const adaKegagalan = (ringkas?.gagal.length ?? 0) > 0 && butir.length === 0;
  const sedangBerjalan = (ringkas?.berjalan ?? 0) > 0;
  const adaMenunggu = (ringkas?.menunggu ?? 0) > 0;
  /**
   * Analisis SELESAI tetapi tidak menghasilkan butir. Ini keadaan yang paling
   * membingungkan: dokumen ada, analisis "berhasil", tetapi daftar tetap kosong —
   * jadi halaman harus menyebut kemungkinan penyebabnya, bukan diam.
   */
  const selesaiTanpaButir =
    !adaMenunggu && !adaKegagalan && !sedangBerjalan && butir.length === 0 && (ringkas?.selesai ?? 0) > 0;

  return (
    <main className="flex-1 flex flex-col min-h-0 bg-canvas" data-testid="halaman-pilih-data">
      {/* Tab mini untuk layar sempit: daftar data dan kanvas bergantian. */}
      <div className="lg:hidden flex gap-1 px-4 pt-2 border-b border-line bg-surface" data-testid="tab-mini">
        {(
          [
            { id: 'data' as const, label: 'Data' },
            { id: 'kanvas' as const, label: `Kanvas (${jumlahKartu})` },
          ]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTabMini(t.id)}
            data-testid={`tab-mini-${t.id}`}
            className={`px-3 py-1.5 text-[11px] font-semibold border-b-2 -mb-px transition-colors ${
              tabMini === t.id ? 'border-brand text-brand-ink' : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Isi: daftar data di kiri, kanvas mini di kanan. */}
      <div className="flex-1 min-h-0 flex">
      <div
        className={`${tabMini === 'data' ? 'block' : 'hidden'} lg:block flex-1 lg:flex-none lg:w-[42%] xl:w-[38%] min-w-0 min-h-0 overflow-y-auto gulir-tema px-4 sm:px-5 py-4 pb-8 lg:border-r border-line`}
        data-testid="daftar-data"
      >
        {/* Pencarian + filter kategori menempel di atas kolom data. */}
        <div className="sticky -top-4 z-10 -mx-4 sm:-mx-5 -mt-4 mb-3 px-4 sm:px-5 pt-4 pb-2.5 border-b border-line bg-canvas" data-testid="kepala-daftar-data">
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-ink-3 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari nama data, kategori, atau dokumen…"
                data-testid="pilih-data-cari"
                className="w-full pl-8 pr-3 py-2 bg-surface-2 focus:bg-surface border border-line-strong rounded-control text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:border-brand"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {kategoriTersedia.map((k) => (
                <button
                  key={k}
                  onClick={() => setKategoriAktif(k)}
                  data-testid={`filter-kategori-${k}`}
                  className={`px-2.5 py-1.5 rounded-control text-[11px] font-semibold whitespace-nowrap border transition-colors ${
                    kategoriAktif === k
                      ? 'bg-brand text-on-brand border-brand'
                      : 'bg-surface text-ink-2 border-line hover:bg-surface-2'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="w-full">
          {galat && (
            <div className="mb-3 flex items-start gap-1.5 p-2.5 rounded-control bg-neg/10 border border-neg/25 text-[11px] text-neg">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{galat}</span>
            </div>
          )}

          {/* Analisis berjalan: beri tahu bahwa data akan muncul sendiri. */}
          {sedangBerjalan && (
            <div
              className="mb-3 flex items-start gap-2 p-3 rounded-card bg-brand/5 border border-brand/25 text-[11px] text-ink-2"
              data-testid="info-analisis-berjalan"
            >
              <Loader2 className="w-4 h-4 text-brand animate-spin shrink-0 mt-0.5" />
              <span>
                {ringkas?.berjalan} dokumen sedang dianalisis. Data akan muncul di halaman ini sendiri
                begitu selesai — tidak perlu muat ulang.
              </span>
            </div>
          )}

          {/* Analisis gagal: sebut dokumen dan galatnya, sediakan tombol ulang. */}
          {adaKegagalan && (
            <div
              className="mb-3 p-3 rounded-card bg-warn/10 border border-warn/30 text-[11px] text-ink-2"
              data-testid="info-analisis-gagal"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-bold text-ink">
                    {ringkas!.gagal.length} dokumen gagal dianalisis
                    {ringkas!.selesai === 0 ? ' — itu sebabnya belum ada data di sini' : ''}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {ringkas!.gagal.slice(0, 3).map((g) => (
                      <li key={g.id} className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{g.judul}</span>
                        <span className="text-ink-3">· {g.galat}</span>
                        <button
                          onClick={() => void ulangAnalisis(g.id)}
                          disabled={mengulang === g.id}
                          data-testid={`ulang-analisis-${g.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-line bg-surface hover:bg-surface-2 font-semibold text-ink-2 disabled:opacity-60"
                        >
                          {mengulang === g.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          Analisis ulang
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {memuat && (
            <div className="py-16 text-center text-xs text-ink-3">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Memuat data dari dokumen instansi…
            </div>
          )}

          {!memuat && butir.length === 0 && (
            <div className="py-14 text-center max-w-md mx-auto" data-testid="pilih-data-kosong">
              <div className="w-12 h-12 rounded-full bg-surface-2 text-ink-3 flex items-center justify-center mx-auto mb-3">
                <Database className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-ink">
                {adaMenunggu
                  ? `${ringkas?.menunggu} data menunggu persetujuan admin`
                  : sedangBerjalan
                    ? 'Dokumen sedang dianalisis'
                    : adaKegagalan
                      ? 'Dokumen belum menghasilkan data'
                      : selesaiTanpaButir
                        ? 'Dokumen sudah dianalisis, angkanya tidak terbaca'
                        : 'Belum ada data yang disetujui'}
              </p>
              <p className="text-[11px] text-ink-2 mt-1.5 leading-relaxed">
                {adaMenunggu
                  ? 'Angka sudah terbaca dari dokumen, tetapi belum disetujui di Kotak Inbox. Setujui dulu supaya bisa dipakai di dashboard pimpinan.'
                  : sedangBerjalan
                    ? 'Halaman ini memantau sendiri; data akan muncul di sini tanpa muat ulang.'
                    : adaKegagalan
                      ? 'Analisis dokumen gagal, jadi belum ada angka yang bisa dipakai. Pesan galat dan tombol ulang ada di kotak peringatan di atas.'
                      : selesaiTanpaButir
                        ? `${ringkas?.selesai} dokumen selesai dianalisis tetapi tidak menghasilkan satu pun butir. Biasanya karena isi dokumen tidak memuat angka yang bisa dibaca (hanya gambar, grafik, atau tabel hasil pindai) atau nama indikatornya tidak dikenali. Unggah versi dokumen yang angkanya tertulis jelas, atau ajukan permintaan data supaya admin memetakan indikator yang diminta.`
                        : 'Data muncul di sini setelah dokumen instansi diunggah, dianalisis, dan hasilnya disetujui admin. Selama itu, pakai jalur Dari template dari daftar dashboard, atau tanya asisten di kanvas.'}
              </p>
              {adaMenunggu && onBukaPermintaan && (
                <button
                  onClick={onBukaPermintaan}
                  data-testid="pilih-data-kotak-masuk"
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-on-brand bg-brand hover:brightness-95 rounded-control transition-colors"
                >
                  <Inbox className="w-3.5 h-3.5" />
                  Buka Kotak Inbox
                </button>
              )}
            </div>
          )}

          {!memuat && butir.length > 0 && tersaring.length === 0 && (
            <p className="py-10 text-center text-xs text-ink-3 italic">
              Tidak ada data yang cocok dengan pencarian atau filter kategori.
            </p>
          )}

          {perKategori.map(([kategori, daftar]) => {
            const semua = daftar.every((b) => diHalamanAktif.has(b.id));
            return (
              <section key={kategori} className="mb-5" data-testid={`kategori-data-${kategori}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${
                      WARNA_KATEGORI[kategori] || 'bg-surface-2 text-ink-2 border-line'
                    }`}
                  >
                    {kategori}
                  </span>
                  <span className="text-[10px] text-ink-3">{daftar.length} data</span>
                  <span className="text-[10px] text-ink-3">
                    · {daftar.filter((b) => dipilih.includes(b.id)).length} di kanvas
                  </span>
                  <button
                    onClick={() => alihkanKategori(daftar)}
                    className="ml-auto text-[10px] font-semibold text-brand-ink hover:underline"
                  >
                    {semua ? 'Keluarkan semua dari halaman ini' : 'Tambah semua ke halaman ini'}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
                  {daftar.map((b) => {
                    const aktif = dipilih.includes(b.id);
                    return (
                      <button
                        type="button"
                        key={b.id}
                        onClick={() => bukaDraf(b)}
                        data-testid={`butir-${b.id}`}
                        title="Klik untuk memilih bentuk chart, lalu simpan ke kanvas"
                        className={`relative w-full text-left flex items-start gap-2.5 p-3 rounded-card border transition-colors ${
                            aktif
                            ? 'bg-brand/5 border-brand/40'
                            : 'bg-surface border-line hover:border-brand/30'
                        }`}
                      >
                        <span className={`min-w-0 flex-1 ${aktif ? 'pr-6' : ''}`}>
                          <span
                            className="block text-xs font-semibold text-ink leading-snug line-clamp-2"
                            title={b.nama}
                          >
                            {b.nama}
                          </span>
                          <span className="mt-1 flex items-baseline gap-2 flex-wrap">
                            <span className="text-sm font-bold text-brand-ink">{ringkasAngka(b)}</span>
                            {(b.periodeTersedia?.length ?? 0) > 1 ? (
                              <span className="text-[10px] text-ink-3">
                                {b.periodeTersedia!.length} periode ·{' '}
                                {b.periodeTersedia!.slice(0, 3).join(', ')}
                                {b.periodeTersedia!.length > 3 ? ' …' : ''}
                              </span>
                            ) : (
                              b.periode && <span className="text-[10px] text-ink-3">{b.periode}</span>
                            )}
                          </span>
                          <span className="mt-1 flex items-center gap-1 text-[10px] text-ink-3">
                            <FileText className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              {b.sitasi?.dokumen || 'dokumen instansi'}
                              {b.sitasi?.halaman ? ` · hlm ${b.sitasi.halaman}` : ''}
                            </span>
                          </span>
                        </span>
                        {aktif && (
                          <span
                            className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-brand text-on-brand flex items-center justify-center"
                            title="Sudah ada di kanvas"
                            aria-label="Di kanvas"
                            data-testid="tanda-di-kanvas"
                          >
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

        {/* KANVAS MINI: kartu yang diklik langsung tergambar di sini. */}
        <section
          className={`${tabMini === 'kanvas' ? 'block' : 'hidden'} lg:block flex-1 min-w-0 min-h-0 overflow-y-auto gulir-tema bg-canvas px-4 sm:px-5 py-4 pb-8`}
          data-testid="kanvas-mini"
        >
          <div className="flex items-center gap-2 mb-2">
            <LayoutGrid className="w-4 h-4 text-brand" />
            <h2 className="text-xs font-bold text-ink">Kanvas</h2>
            <span className="text-[11px] text-ink-3">
              {halamanKanvas.length} halaman · {jumlahKartu} kartu
            </span>
          </div>

          {/* Aksi kanvas: judul, Rekomendasi AI, dan Buat dashboard. */}
          <div className="mb-3 p-3 rounded-card border border-line bg-surface" data-testid="aksi-kanvas">
            {galat && (
              <div className="lg:hidden mb-2 flex items-start gap-1.5 p-2 rounded-control bg-neg/10 border border-neg/25 text-[11px] text-neg">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{galat}</span>
              </div>
            )}
            <div className="w-full flex flex-col 2xl:flex-row 2xl:items-end gap-2.5">
              <label className="flex-1 min-w-0">
                <span className="block text-[10px] font-semibold text-ink-3 uppercase tracking-wide mb-1">
                  Judul dashboard
                </span>
                <input
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  placeholder={`Dashboard ${namaInstansi || 'Instansi'} — ${new Date().getFullYear()}`}
                  data-testid="pilih-data-judul"
                  className="w-full px-3 py-2 bg-surface border border-line rounded-control text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:border-brand"
                />
              </label>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span className="text-[11px] text-ink-3" data-testid="pilih-data-ringkasan">
                  {butir.length} data tersedia · <strong className="text-ink">{jumlahKartu} kartu di kanvas</strong>
                  {dariCache && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px]" data-testid="status-cache">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      data tersimpan, memperbarui…
                    </span>
                  )}
                </span>
                {/* Pembuka modal pilihan mode Rekomendasi AI. */}
                <button
                  onClick={() => setBukaMode(true)}
                  disabled={membuatReko || membuat || butir.length === 0}
                  data-testid="pilih-data-rekomendasi"
                  title="Pilih cara AI menyusun dashboard"
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-brand bg-surface border border-brand/40 hover:bg-brand/10 rounded-control transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {membuatReko ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {membuatReko ? `AI menyusun… (${modeReko})` : 'Rekomendasi AI'}
                </button>

                {/**
                 * MODAL PILIHAN MODE.
                 *
                 * Dulu berbentuk dropdown kecil; diganti modal karena tiga pilihan
                 * perlu keterangan waktu dan isi yang tidak muat di menu sempit.
                 */}
                {bukaMode &&
                  createPortal(
                  <div
                    className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/55 backdrop-blur-[2px]"
                    onMouseDown={(e) => {
                      if (e.target === e.currentTarget) setBukaMode(false);
                    }}
                    data-testid="modal-mode-rekomendasi"
                  >
                    <div className="w-full max-w-md bg-surface border border-line rounded-card shadow-2xl overflow-hidden">
                      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-line">
                        <div>
                          <h3 className="text-sm font-bold text-ink">Susun dashboard dengan AI</h3>
                          <p className="text-[11px] text-ink-2 mt-0.5">
                            Pilih berapa lama AI bekerja dan seberapa banyak data yang dibaca.
                          </p>
                        </div>
                        <button
                          onClick={() => setBukaMode(false)}
                          data-testid="tutup-modal-mode"
                          className="p-1 -mt-1 -mr-1 rounded-control text-ink-3 hover:text-ink hover:bg-surface-2"
                          aria-label="Tutup"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="p-2.5 space-y-1.5">
                        {[
                          { id: 'cepat' as const, ikon: Timer, judul: 'Cepat', waktu: '30–45 detik', isi: '2–3 halaman, 40 varian teratas. Untuk melihat bentuknya lebih dulu.' },
                          { id: 'seimbang' as const, ikon: Sparkles, judul: 'Seimbang', waktu: '1–2 menit', isi: '4–5 halaman, katalog penuh sekali baca. Pilihan biasa.' },
                          { id: 'mendalam' as const, ikon: Brain, judul: 'Mendalam', waktu: '2–4 menit', isi: '6–8 halaman, dua putaran AI, lebih banyak data masuk.' },
                          { id: 'ultra' as const, ikon: Sparkles, judul: 'Ultra', waktu: '8–12 menit', isi: '10–14 halaman, tiga putaran AI. Paling lengkap; biarkan tab terbuka sampai selesai.' },
                        ].map((m) => {
                          const Ikon = m.ikon;
                          const aktif = modeReko === m.id;
                          return (
                            <button
                              key={m.id}
                              onClick={() => void rekomendasi(m.id)}
                              data-testid={`mode-rekomendasi-${m.id}`}
                              className={`w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-control border transition-colors ${
                                aktif ? 'border-brand/60 bg-brand/10' : 'border-transparent hover:bg-surface-2'
                              }`}
                            >
                              <span className="mt-0.5 w-8 h-8 shrink-0 rounded-control bg-brand/10 text-brand flex items-center justify-center">
                                <Ikon className="w-4 h-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-baseline gap-2">
                                  <span className="text-xs font-bold text-ink">{m.judul}</span>
                                  <span className="text-[10px] font-semibold text-ink-3">{m.waktu}</span>
                                  {aktif && <Check className="w-3 h-3 text-brand self-center" />}
                                </span>
                                <span className="block text-[11px] leading-snug text-ink-2 mt-0.5">{m.isi}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-line bg-surface-2/40">
                        <span className="text-[10px] text-ink-3">AI bekerja di latar; kanvas terbuka langsung.</span>
                        <button
                          onClick={() => setBukaMode(false)}
                          className="px-3 py-1.5 text-[11px] font-semibold text-ink-2 hover:text-ink border border-line rounded-control"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body,
                )}

                <button
                  onClick={() => void buat()}
                  disabled={membuat || !aturan.boleh}
                  title={aturan.boleh ? undefined : aturan.pesan}
                  data-testid="pilih-data-buat"
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-on-brand bg-brand hover:brightness-95 rounded-control transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {membuat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  {membuat ? 'Menyusun…' : 'Buat dashboard'}
                </button>
              </div>
            </div>
            {!aturan.boleh && butir.length > 0 && (
              <div
                className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-ink-2"
                data-testid="aturan-dashboard"
              >
                <span className="inline-flex items-start gap-1.5 min-w-0">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-px text-brand" />
                  <span>
                    {aturan.pesan}
                    {aturan.tidakTerkait.length > 0 && ' Keluarkan chart itu atau ganti dengan data yang berhubungan.'}
                  </span>
                </span>
                {saranAturan.length > 0 && (
                  <button
                    onClick={tambahChartTerkait}
                    data-testid="tambah-chart-terkait"
                    title={saranAturan.map((b) => b.nama).join(', ')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 font-semibold text-brand border border-brand/40 hover:bg-brand/10 rounded-control"
                  >
                    <Plus className="w-3 h-3" />
                    Tambahkan {saranAturan.length} chart terkait
                  </button>
                )}
              </div>
            )}
          </div>

          {/* HALAMAN KANVAS: tab per halaman, tambah, hapus, dan ganti judul. */}
          <div
            className="flex items-center gap-1 mb-2 overflow-x-auto gulir-tema border-b border-line"
            data-testid="halaman-kanvas"
          >
            {halamanKanvas.map((h, i) => {
              const aktif = h.id === halamanAktifKanvas.id;
              return (
                <div
                  key={h.id}
                  className={`shrink-0 inline-flex items-center gap-0.5 -mb-px border-b-2 ${
                    aktif ? 'border-brand' : 'border-transparent'
                  }`}
                >
                  <button
                    onClick={() => setIdHalamanAktif(h.id)}
                    data-testid={`halaman-kanvas-${i + 1}`}
                    className={`px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap ${
                      aktif ? 'text-brand-ink' : 'text-ink-3 hover:text-ink'
                    }`}
                  >
                    {h.judul.trim() || `Halaman ${i + 1}`}
                    <span className="ml-1 font-normal text-ink-3">({h.kartu.length})</span>
                  </button>
                  {halamanKanvas.length > 1 && (
                    <button
                      onClick={() => hapusHalaman(h.id)}
                      title="Hapus halaman ini beserta kartunya"
                      data-testid={`hapus-halaman-kanvas-${i + 1}`}
                      className="p-0.5 mr-1 rounded text-ink-3 hover:text-neg"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
            <button
              onClick={tambahHalaman}
              data-testid="tambah-halaman-kanvas"
              className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-brand-ink hover:underline"
            >
              <Plus className="w-3 h-3" />
              Halaman
            </button>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input
              value={halamanAktifKanvas.judul}
              onChange={(e) => ubahJudulHalaman(e.target.value)}
              placeholder="Judul halaman"
              data-testid="judul-halaman-kanvas"
              className="flex-1 min-w-0 px-2.5 py-1.5 bg-surface border border-line rounded-control text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:border-brand"
            />
            {halamanAktifKanvas.kartu.length > 0 && (
              <button
                onClick={() => ubahHalamanAktif(() => [])}
                data-testid="kanvas-kosongkan"
                className="shrink-0 text-[10px] font-semibold text-ink-3 hover:text-neg"
              >
                Kosongkan halaman
              </button>
            )}
          </div>

          {/* DRAF: pilih bentuk chart dulu, lalu Simpan atau Batal. */}
          {draf &&
            (() => {
              const cocok = bentukCocok([draf.butir]);
              const spek = spekPratinjau(draf.butir, draf.chartId);
              return (
                <div
                  id="kanvas-draf"
                  className="mb-3 rounded-card border-2 border-brand/50 bg-surface overflow-hidden"
                  data-testid="kanvas-draf"
                >
                  <div className="px-3 pt-2.5 pb-2 border-b border-line">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-ink">
                      {draf.kunciEdit ? 'Ubah bentuk chart' : 'Pilih bentuk chart'}
                    </p>
                    <p className="text-xs font-bold text-ink truncate" title={draf.butir.nama}>
                      {draf.butir.nama}
                    </p>
                  </div>
                  {cocok.length > 0 && (
                    <div
                      className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-line max-h-28 overflow-y-auto gulir-tema"
                      data-testid="pilih-bentuk-chart"
                    >
                      {cocok.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => setDraf({ ...draf, chartId: b.id })}
                          data-testid={`bentuk-${b.id}`}
                          title={b.label}
                          className={`px-2.5 py-1 rounded-control text-[11px] font-semibold border whitespace-nowrap transition-colors ${
                            draf.chartId === b.id
                              ? 'bg-brand text-on-brand border-brand'
                              : 'bg-surface text-ink-2 border-line hover:bg-surface-2'
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="p-2 max-h-[440px] overflow-y-auto gulir-tema">
                    {spek ? (
                      <PenjagaRender
                        key={`draf-${draf.butir.id}-${draf.chartId}`}
                        pesan={`${draf.butir.nama} · bentuk ${draf.chartId || 'bawaan'}`}
                      >
                        <PratinjauKartu widget={spek} butir={draf.butir} />
                      </PenjagaRender>
                    ) : (
                      <p className="py-10 text-center text-xs text-ink-3">Butir ini tidak punya angka yang bisa digambar.</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 px-3 py-2.5 border-t border-line bg-surface-2/40">
                    <button
                      onClick={() => setDraf(null)}
                      data-testid="draf-batal"
                      className="px-3 py-1.5 text-[11px] font-semibold text-ink-2 hover:text-ink border border-line rounded-control"
                    >
                      Batal
                    </button>
                    <button
                      onClick={simpanDraf}
                      disabled={!spek}
                      data-testid="draf-simpan"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold text-on-brand bg-brand hover:brightness-95 rounded-control disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {draf.kunciEdit
                        ? 'Simpan perubahan'
                        : `Simpan ke ${halamanAktifKanvas.judul.trim() || 'halaman ini'}`}
                    </button>
                  </div>
                </div>
              );
            })()}

          {halamanAktifKanvas.kartu.length === 0 ? (
            <div
              className={`${draf ? 'hidden' : ''} mt-6 py-14 px-6 text-center rounded-card border border-dashed border-line-strong text-ink-3`}
              data-testid="kanvas-kosong"
            >
              <LayoutGrid className="w-6 h-6 mx-auto mb-2" />
              <p className="text-xs font-semibold text-ink-2">Halaman ini masih kosong</p>
              <p className="text-[11px] mt-1">
                Klik kartu data
                <span className="hidden lg:inline"> di sebelah kiri</span>
                <span className="lg:hidden"> di tab Data</span>, pilih bentuk chartnya, lalu simpan ke halaman ini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">
              {halamanAktifKanvas.kartu.map((k) => {
                const b = petaButir.get(k.butirId);
                if (!b) return null;
                const dipakai = k.chartId;
                const labelBentuk = bentukCocok([b]).find((x) => x.id === dipakai)?.label;
                const spek = spekPratinjau(b, dipakai);
                const kurang = titikBelumTerisi(b);
                return (
                  <article
                    key={k.kunci}
                    id={`kanvas-${k.kunci}`}
                    className="rounded-card border border-line bg-surface overflow-hidden"
                    data-testid={`kanvas-kartu-${b.id}`}
                  >
                    <div className="flex items-start gap-2 px-3 pt-2.5 pb-2 border-b border-line">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-ink truncate" title={b.nama}>
                          {b.nama}
                        </p>
                        <p className="mt-0.5 text-[10px] text-ink-3 truncate">
                          {b.sitasi?.dokumen || 'dokumen instansi'}
                          {b.sitasi?.halaman ? ` · hlm ${b.sitasi.halaman}` : ''}
                          {b.periode ? ` · ${b.periode}` : ''}
                          {(b.periodeTersedia?.length ?? 0) > 1 ? ` · ${b.periodeTersedia!.length} periode` : ''}
                          {labelBentuk ? ` · ${labelBentuk}` : ''}
                        </p>
                        {kurang > 0 && (
                          <p
                            className="mt-1 text-[10px] font-semibold"
                            style={{ color: '#b45309' }}
                            data-testid="peringatan-titik-kosong"
                            title="Sebagian sel angka belum terbaca dari dokumen; grafik hanya memuat yang tersedia."
                          >
                            {kurang} titik belum terisi, grafik memuat yang ada
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setDraf({ butir: b, chartId: k.chartId, kunciEdit: k.kunci });
                          gulirKe('kanvas-draf');
                        }}
                        className="shrink-0 p-1 rounded-control text-ink-3 hover:bg-surface-2 hover:text-ink"
                        data-testid={`kanvas-ubah-${b.id}`}
                        title="Ubah bentuk chart"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => keluarkanKartu(k.kunci)}
                        className="shrink-0 p-1 rounded-control text-ink-3 hover:bg-surface-2 hover:text-ink"
                        data-testid={`kanvas-keluarkan-${b.id}`}
                        title="Keluarkan dari kanvas"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="p-2 max-h-[440px] overflow-y-auto gulir-tema">
                      {spek ? (
                        <PenjagaRender key={`${k.kunci}-${dipakai}`} pesan={`${b.nama} · bentuk ${dipakai || 'bawaan'}`}>
                          <PratinjauKartu widget={spek} butir={b} />
                        </PenjagaRender>
                      ) : (
                        <p className="py-10 text-center text-xs text-ink-3">Butir ini tidak punya angka yang bisa digambar.</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default PilihDataPage;
