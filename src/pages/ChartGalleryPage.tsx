import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Lightbulb, Search, Target } from 'lucide-react';
import { TIPE_VISUALISASI, GRUP_VISUALISASI } from '../services/spec/widgetTypes';
import { REKOMENDASI_TIPE, LABEL_GRUP } from '../services/spec/rekomendasiTipe';
import { specPratinjau } from '../services/spec/pratinjau';
import { WidgetRenderer } from '../components/widgets/WidgetRenderer';
import { WIDGET_CATALOG } from '../services/builder/catalog';
import { WidgetType } from '../types';

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
 * Tinggi isi kartu per tipe. Chart: area gambar `min-h-[190px]` PLUS baris tombol
 * "Lihat data" (±31 px) = 221 px — angka ini yang membuat pratinjau tidak lagi
 * terpotong. Kartu KPI/narasi/bullet tidak punya baris itu dan lebih pendek.
 */
const tinggiBadan = (type: string) =>
  ['kpi', 'bullet-target', 'narasi'].includes(type) ? 150 : 221;

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
  return { w: lebarKartu(tata.w), h: tinggiBadan(type), kolom: tata.w };
};

interface ChartGalleryPageProps {
  /** Bila diberikan: tautan "Cari indikator di katalog" membuka katalog preset (angka nyata dari dokumen). */
  onBukaKatalog?: (type: WidgetType) => void;
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
export const ChartGalleryPage: React.FC<ChartGalleryPageProps> = ({ onBukaKatalog }) => {
  const [kueri, setKueri] = useState('');
  const [grupAktif, setGrupAktif] = useState<string>('Semua');
  // Pratinjau digambar bertahap supaya halaman tidak mengunci layar.
  const [siap, setSiap] = useState(4);

  const daftar = useMemo(() => {
    const q = kueri.trim().toLowerCase();
    return TIPE_VISUALISASI.filter((t) => {
      if (grupAktif !== 'Semua' && t.grup !== grupAktif) return false;
      if (!q) return true;
      const rek = REKOMENDASI_TIPE[t.type];
      const bahan = [t.type, t.label, t.desc, t.grup, rek?.menjawab, rek?.contoh, rek?.hindari, ...(rek?.pakai ?? [])]
        .join(' ')
        .toLowerCase();
      return bahan.includes(q);
    });
  }, [kueri, grupAktif]);

  // Isi pratinjau bertahap; mulai ulang setiap filter/kueri berubah.
  useEffect(() => {
    setSiap(4);
    let n = 4;
    const t = setInterval(() => {
      n += 4;
      setSiap(n);
      if (n >= daftar.length) clearInterval(t);
    }, 240);
    return () => clearInterval(t);
  }, [daftar.length, kueri, grupAktif]);

  let urutanKartu = -1;

  const kartu = (tipe: (typeof TIPE_VISUALISASI)[number]) => {
    urutanKartu += 1;
    const tampil = urutanKartu < siap;
    const rek = REKOMENDASI_TIPE[tipe.type];
    const ukuran = ukuranAsliKanvas(tipe.type);
    return (
      <div
        key={tipe.type}
        data-testid={`kartu-tipe-${tipe.type}`}
        className="card overflow-hidden flex flex-col"
      >
        <div className="px-3.5 pt-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-[13px] font-bold text-ink leading-snug">{tipe.label}</h3>
              <p className="text-[11px] text-ink-2 mt-0.5">{tipe.desc}</p>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-chip bg-surface-2 border border-line text-ink-3 shrink-0">
              {tipe.type}
            </span>
          </div>

          {rek && (
            <p className="text-[11px] text-brand-ink font-semibold mt-2 flex items-start gap-1.5">
              <Target className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{rek.menjawab}</span>
            </p>
          )}
        </div>

        <div className="px-3.5 pt-2.5">
          {/* Pratinjau pada UKURAN ASLINYA: lebar sesuai kolom grid di kanvas + tinggi badan kartu.
              Wadah luar bisa digeser mendatar supaya chart tidak pernah diperkecil (diperkecil =
              label & legenda terpotong, yang justru dihindari). */}
          <div className="overflow-x-auto pb-1">
            <div
              className="rounded-control border border-line bg-surface-2 overflow-hidden"
              style={{ width: ukuran.w, height: ukuran.h }}
              data-testid={`pratinjau-${tipe.type}`}
              data-ukuran={`${ukuran.w}x${ukuran.h}`}
            >
              {tampil && <WidgetRenderer widget={specPratinjau(tipe.type)} />}
            </div>
          </div>
          <p className="text-[9px] text-ink-3 mt-1">
            Ukuran asli di kanvas: {ukuran.w} × {ukuran.h} px ({ukuran.kolom} dari 12 kolom) — angka contoh,
            bukan angka dokumen
          </p>
        </div>

        {rek && (
          <div className="px-3.5 py-3 space-y-2.5 flex-1 flex flex-col">
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

            {onBukaKatalog && (
              <button
                onClick={() => onBukaKatalog(tipe.type)}
                className="mt-auto pt-1 self-start text-[10.5px] font-semibold text-brand-ink hover:underline"
                title="Buka katalog preset: angkanya diambil dari dokumen instansi"
              >
                Cari indikator untuk tipe ini di katalog →
              </button>
            )}
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
          <div className="w-10 h-10 rounded-control bg-ink flex items-center justify-center text-surface shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-ink flex items-center gap-2 flex-wrap">
              <span>Template Chart</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-line text-ink-2 font-semibold">
                {TIPE_VISUALISASI.length} tipe
              </span>
            </h2>
            <p className="text-xs text-ink-2 mt-1 leading-relaxed max-w-3xl">
              Semua bentuk chart yang bisa dipakai dashboard, lengkap dengan rekomendasi pemakaian: chart ini
              menjawab pertanyaan apa, kapan dipakai, kapan sebaiknya tidak, dan contoh indikator BUMD yang cocok.
            </p>
          </div>
        </div>

        {/* Filter & pencarian */}
        <div className="card p-3.5 sm:p-4 mb-6 space-y-3">
          <div className="relative w-full sm:w-96">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ink-3" />
            <input
              type="text"
              value={kueri}
              onChange={(e) => setKueri(e.target.value)}
              placeholder="Cari chart, kebutuhan, atau contoh indikator..."
              aria-label="Cari tipe chart"
              className="w-full text-xs text-ink bg-surface-2 border border-line rounded-control pl-8 pr-3 py-2 placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['Semua', ...GRUP_VISUALISASI] as string[]).map((g) => {
              const aktif = grupAktif === g;
              return (
                <button
                  key={g}
                  onClick={() => setGrupAktif(g)}
                  aria-pressed={aktif}
                  data-testid={`chip-grup-${g}`}
                  className={`text-[10.5px] px-2.5 py-1 rounded-chip border transition-colors ${
                    aktif
                      ? 'border-brand bg-brand text-on-brand font-semibold'
                      : 'border-line bg-surface-2 text-ink-2 hover:bg-line/60'
                  }`}
                >
                  {g === 'Semua' ? 'Semua' : LABEL_GRUP[g] || g}
                </button>
              );
            })}
          </div>
        </div>

        {/* Daftar tipe */}
        {daftar.length === 0 ? (
          <div className="bg-surface rounded-card border border-line p-12 text-center text-xs text-ink-2">
            Tidak ada chart yang cocok dengan pencarian &ldquo;{kueri}&rdquo;
            {grupAktif !== 'Semua' ? ` pada kelompok "${LABEL_GRUP[grupAktif] || grupAktif}"` : ''}.
          </div>
        ) : grupAktif === 'Semua' ? (
          grupTampil.map((g) => {
            const anggota = daftar.filter((t) => t.grup === g);
            if (anggota.length === 0) return null;
            return (
              <section key={g} className="mb-7">
                <div className="flex items-baseline gap-2 mb-2.5">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-2">
                    {LABEL_GRUP[g] || g}
                  </h3>
                  <span className="text-[10px] text-ink-3">{anggota.length} tipe</span>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {anggota.map((t) => kartu(t))}
                </div>
              </section>
            );
          })
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {daftar.map((t) => kartu(t))}
          </div>
        )}

        <p className="text-[10.5px] text-ink-3 leading-relaxed border-t border-line pt-4 mt-4">
          Pratinjau di halaman ini memakai angka contoh hanya untuk memperlihatkan bentuk chart. Angka pada
          dashboard Anda selalu diambil dari dokumen resmi instansi lewat katalog atau chat, dan tidak pernah
          ditambahkan bila dokumen tidak memuatnya.
        </p>
      </div>
    </div>
  );
};
