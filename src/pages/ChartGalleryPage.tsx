import React, { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Lightbulb, Target, X } from 'lucide-react';
import { TIPE_VISUALISASI, GRUP_VISUALISASI } from '../services/spec/widgetTypes';
import { REKOMENDASI_TIPE, LABEL_GRUP } from '../services/spec/rekomendasiTipe';
import { PratinjauTipe } from '../components/referensi/PratinjauTipe';
import { WidgetRenderer } from '../components/widgets/WidgetRenderer';
import { WIDGET_CATALOG } from '../services/builder/catalog';
import { WidgetType } from '../types';
import { KatalogTemplateChart } from '../components/referensi/KatalogChart';
import { GAYA, type Varian } from '../services/chart/gayaVarian';
import { statusDefaultChart } from '../services/chart/status';
import { SEL_TERISI } from '../services/chart/chartTemplate';
import { kontainerPratinjau } from '../services/chart/temaPratinjau';
import { useThemeMode } from '../theme';

/**
 * UKURAN ASLI DI KANVAS.
 *
 * Pratinjau harus seukuran kartu sungguhan, kalau tidak legenda/label terpotong.
 * Angkanya diturunkan dari kanvas nyata: konten `max-w-7xl` = 1232 px, grid 12 kolom,
 * jarak antar kolom 16 px → satu kolom 88 px. Kartu 6 kolom terbukti 608 px dan badan
 * chart 190 px, jadi rumus ini cocok dengan yang dirender di dashboard.
 */
const LEBAR_KOLOM = 88;
const JARAK_KOLOM = 16;
const lebarKartu = (kolom: number) => kolom * LEBAR_KOLOM + (kolom - 1) * JARAK_KOLOM;

/**
 * TINGGI PRATINJAU SERAGAM DAN RESPONSIF.
 *
 * Semua tipe memakai satu tinggi supaya kartu di galeri sama besar dan gridnya
 * rata. Angkanya memakai `clamp` supaya ikut mengecil di layar sempit dan
 * berhenti membesar di layar lebar: kanvas ECharts membaca ukuran wadah lewat
 * ResizeObserver, jadi tidak perlu angka tetap.
 */
const TINGGI_PRATINJAU = 'clamp(150px, 14vw, 178px)';

/**
 * Jumlah tipe yang sudah punya wajah di tiap template chart. Dihitung dari
 * matriks, bukan ditulis tangan, supaya angka di badge tidak pernah basi.
 */
const jumlahTipe = (varian: Varian): number => SEL_TERISI.filter((sel) => sel.varian === varian).length;

/** Tata letak asli per tipe = `defaultLayout` yang paling sering dipakai preset katalog. */
const TATA_LETAK_ASLI: Record<string, { w: number; h: number }> = (() => {
  const hitung: Record<string, Record<string, number>> = {};
  for (const preset of WIDGET_CATALOG) {
    for (const t of preset.tipeChart) {
      const kunci = `${preset.defaultLayout.w}x${preset.defaultLayout.h}`;
      hitung[t] = hitung[t] || {};
      hitung[t][kunci] = (hitung[t][kunci] || 0) + 1;
    }
  }
  const hasil: Record<string, { w: number; h: number }> = {};
  for (const [t, sebaran] of Object.entries(hitung)) {
    const kunci = Object.entries(sebaran).sort((a, b) => b[1] - a[1])[0][0];
    const [w, h] = kunci.split('x').map(Number);
    hasil[t] = { w, h };
  }
  return hasil;
})();

/** Ukuran kartu asli (px) untuk sebuah tipe visualisasi. */
export const ukuranAsliKanvas = (type: WidgetType): { w: number; h: number; kolom: number } => {
  const tata = TATA_LETAK_ASLI[type] || { w: 8, h: 4 };
  // Tinggi badan kartu di dashboard sungguhan, bukan tinggi pratinjau galeri.
  const badan = ['kpi', 'bullet-target', 'narasi'].includes(type) ? 150 : 221;
  return { w: lebarKartu(tata.w), h: badan, kolom: tata.w };
};

interface ChartGalleryPageProps {
  /** Bila diberikan: tautan "Cari indikator di katalog" membuka katalog preset (angka nyata dari dokumen). */
}

/**
 * Halaman "Template Chart": menampilkan SEMUA tipe visualisasi yang bisa dipakai
 * dashboard, masing-masing dengan pratinjau bentuk aslinya (renderer kanvas yang
 * sama) dan rekomendasi pemakaian: menjawab apa, kapan dipakai, kapan jangan,
 * serta contoh indikator BUMD.
 *
 * Pratinjau memakai DATA CONTOH (diberi label) — angka pada dashboard tetap
 * berasal dari dokumen resmi instansi.
 */
export const ChartGalleryPage: React.FC<ChartGalleryPageProps> = () => {
  const mode = useThemeMode();
  const [tab, setTab] = useState<'default' | 'ringkasan' | 'analitik' | 'trafik'>('default');
  // Tanpa pencarian dan tanpa filter kelompok: seluruh tipe langsung tampil,
  // dikelompokkan menurut grupnya.
  const daftar = TIPE_VISUALISASI;
  // Pratinjau digambar bertahap supaya halaman tidak mengunci layar.
  const [siap, setSiap] = useState(4);
  // Hanya satu kartu yang boleh terbuka, sama seperti galeri Template Dashboard.
  const [buka, setBuka] = useState<string | null>(null);

  useEffect(() => {
    setSiap(4);
    let n = 4;
    const t = setInterval(() => {
      n += 4;
      setSiap(n);
      if (n >= daftar.length) clearInterval(t);
    }, 240);
    return () => clearInterval(t);
  }, [daftar.length]);

  let urutanKartu = -1;

  const kartu = (tipe: (typeof TIPE_VISUALISASI)[number]) => {
    urutanKartu += 1;
    const tampil = urutanKartu < siap;
    const rek = REKOMENDASI_TIPE[tipe.type];
    const ukuran = ukuranAsliKanvas(tipe.type);
    const terbuka = buka === tipe.type;
    return (
      <div
        key={tipe.type}
        data-testid={`kartu-tipe-${tipe.type}`}
        className={`card relative overflow-hidden flex flex-col transition-colors ${terbuka ? 'ring-1 ring-brand/40' : 'cursor-pointer hover:border-brand/40'}`}
        onClick={() => setBuka(terbuka ? null : tipe.type)}
        role="button"
        tabIndex={0}
        aria-expanded={terbuka}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setBuka(terbuka ? null : tipe.type);
          }
        }}
      >
        {/* Kepala kartu ini adalah bentuk JUDUL WIDGET di dashboard: judul tebal,
            subjudul satu baris, lalu pertanyaan yang dijawab chart. Kode tipe
            duduk sejajar judul sebagai penanda, bukan sebagai judul. */}
        <div className="px-3.5 pt-3 pb-2.5 border-b border-line flex flex-col justify-start min-h-[86px]">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[13px] font-bold text-ink leading-snug truncate">{tipe.label}</h3>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-chip bg-surface-2 border border-line text-ink-3 shrink-0">
              {tipe.type}
            </span>
          </div>
          <p className="text-[10.5px] text-ink-3 mt-0.5 leading-snug">{tipe.desc}</p>
          {rek && (
            <p className="text-[10.5px] text-ink-2 mt-1.5 leading-snug flex items-start gap-1.5">
              <Target className="w-3 h-3 mt-[1px] shrink-0 text-ink-3" />
              <span>{rek.menjawab}</span>
            </p>
          )}
        </div>

        <div className="px-3.5 pt-2.5 pb-3.5">
          {/* Pratinjau: tinggi mengikuti ukuran asli badan kartu, lebar menyesuaikan
              kolom galeri. Dulu lebar dipatok ukuran kanvas sehingga kartu galeri
              terpaksa satu baris penuh (satu grafik per layar); sekarang galeri bisa
              menampilkan banyak grafik sekaligus. */}
          <div
            className="rounded-control overflow-hidden w-full"
            style={{
              height: TINGGI_PRATINJAU,
              backgroundColor: kontainerPratinjau(mode).bg,
              border: `1px solid ${kontainerPratinjau(mode).garis}`,
            }}
            data-testid={`pratinjau-${tipe.type}`}
            data-ukuran={`${ukuran.w}x${ukuran.h}`}
          >
            {tampil && <PratinjauTipe type={tipe.type} />}
          </div>
        </div>

        {terbuka && rek && (
          <div
            className="absolute inset-0 z-10 bg-surface card-rise overflow-auto px-3.5 py-3 space-y-2.5 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[9px] text-ink-3">
                Tinggi asli di kanvas {ukuran.h} px · lebar {ukuran.kolom} dari 12 kolom ({ukuran.w} px) — angka
                contoh, bukan angka dokumen
              </p>
              <button
                type="button"
                aria-label="Tutup detail"
                data-testid={`tutup-detail-${tipe.type}`}
                onClick={() => setBuka(null)}
                className="shrink-0 -mt-1 -mr-1 p-1 rounded-control text-ink-3 hover:bg-surface-2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-pos flex items-center gap-1">
                <Lightbulb className="w-3 h-3" />
                Pakai untuk
              </p>
              <ul className="mt-1 space-y-1">
                {rek.pakai.map((p, i) => (
                  <li key={i} className="text-[10.5px] text-ink-2 leading-relaxed flex gap-1.5">
                    <span className="text-pos shrink-0">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-warn/10 border border-warn/25 rounded-control p-2">
              <p className="text-[10px] font-bold text-warn flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Batasnya
              </p>
              <p className="text-[10.5px] text-ink-2 leading-relaxed mt-0.5">{rek.hindari}</p>
            </div>

            <p className="text-[10.5px] text-ink-3 leading-relaxed">
              <span className="font-semibold text-ink-2">Contoh indikator: </span>
              {rek.contoh}
            </p>

          </div>
        )}
      </div>
    );
  };

  const grupTampil = GRUP_VISUALISASI.filter((g) => daftar.some((t) => t.grup === g));

  return (
    <div className="flex-1 bg-canvas min-h-screen flex flex-col">
      <div className="max-w-7xl mx-auto w-full px-6 py-8 flex-1">
        {/* Judul & keterangan */}
        <div className="bg-surface p-5 rounded-card border border-line mb-6 flex items-start gap-3">
          <div className="w-10 h-10 rounded-control bg-solid flex items-center justify-center text-on-solid shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-ink flex items-center gap-2 flex-wrap">
              <span>{tab === 'default' ? 'Default Chart' : `Template Chart · ${GAYA[tab].nama}`}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-line text-ink-2 font-semibold">
                {tab === 'default' ? `${TIPE_VISUALISASI.length} tipe` : `${jumlahTipe(tab as Varian)} tipe`}
              </span>
              {tab === 'default' && statusDefaultChart() === 'final' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold">
                  Final
                </span>
              )}
            </h2>
            <p className="text-xs text-ink-2 mt-1 leading-relaxed max-w-3xl">
              {tab === 'default'
                ? 'Semua bentuk chart netral yang bisa dipakai dashboard, lengkap dengan rekomendasi pemakaian: menjawab pertanyaan apa, kapan dipakai, kapan sebaiknya tidak.'
                : `Katalog ${GAYA[tab].nama} (${GAYA[tab].sebutan}), wajah chart untuk template dashboard ${GAYA[tab].nama}. Dipakai pratinjau template dan dashboard hasil Pakai Template Ini, jadi bentuknya tidak mungkin berbeda.`}
            </p>
          </div>
        </div>

        {/* Empat tab: default chart, lalu satu tab per template */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {(
            [
              { id: 'default', label: 'Default Chart', ket: `${TIPE_VISUALISASI.length} tipe` },
              { id: 'ringkasan', label: GAYA.ringkasan.nama, ket: `${jumlahTipe('ringkasan')} tipe` },
              { id: 'analitik', label: GAYA.analitik.nama, ket: `${jumlahTipe('analitik')} tipe` },
              { id: 'trafik', label: GAYA.trafik.nama, ket: `${jumlahTipe('trafik')} tipe` },
            ] as const
          ).map((t) => {
            const aktif = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-pressed={aktif}
                data-testid={`tab-katalog-${t.id}`}
                className={`text-[11px] px-3 py-1.5 rounded-control border transition-colors ${
                  aktif
                    ? 'border-brand bg-brand text-on-brand font-semibold'
                    : 'border-line bg-surface text-ink-2 hover:bg-line/60'
                }`}
              >
                {t.label}
                <span className={`ml-1.5 text-[9.5px] ${aktif ? 'text-on-brand/80' : 'text-ink-3'}`}>{t.ket}</span>
              </button>
            );
          })}
        </div>

        {tab === 'default' ? (
          <>
        {/* Daftar tipe, dikelompokkan menurut grupnya */}
        {grupTampil.map((g) => {
          const anggota = daftar.filter((t) => t.grup === g);
          if (anggota.length === 0) return null;
          return (
            <section key={g} className="mb-7">
              <div className="flex items-baseline gap-2 mb-2.5">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-2">{LABEL_GRUP[g] || g}</h3>
                <span className="text-[10px] text-ink-3">{anggota.length} tipe</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">
                {anggota.map((t) => kartu(t))}
              </div>
            </section>
          );
        })}

        <p className="text-[10.5px] text-ink-3 leading-relaxed border-t border-line pt-4 mt-4">
          Pratinjau di halaman ini memakai angka contoh hanya untuk memperlihatkan bentuk chart. Angka pada
          dashboard Anda selalu diambil dari dokumen resmi instansi lewat katalog atau chat, dan tidak pernah
          ditambahkan bila dokumen tidak memuatnya.
        </p>
          </>
        ) : (
          <KatalogTemplateChart
            varian={tab as Varian}
            keterangan={
              tab === 'ringkasan'
                ? 'Pijar menyorot angka yang paling penting: batang bergradasi dengan puncak disorot, cincin tebal, dan label angka berlatar pil. Wajah untuk template Ringkasan.'
                : tab === 'analitik'
                  ? 'Lensa menelusuri sebab di balik angka: batang biru bergradasi, garis tren tipis, dan cincin tebal. Wajah untuk template Analitik.'
                  : 'Nadi memantau aliran harian: gradasi mendatar, garis tren biru, dan label tanpa pil. Wajah untuk template Trafik.'
            }
          />
        )}
      </div>
    </div>
  );
};
