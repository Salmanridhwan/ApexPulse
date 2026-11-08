import React, { useEffect, useState } from 'react';
import { CHART_DEFAULT, DAFTAR_CHART, LABEL_KELOMPOK, type ChartId, type KelompokChart } from '../../services/chart/chartDefault';
import { GAYA, gayaMode, type Varian } from '../../services/chart/gayaVarian';
import { bingkaiKatalog } from '../widgets/bingkaiKatalog';
import { useThemeMode } from '../../theme';
import { PratinjauChart } from './PratinjauChart';
import type { ChartKustom } from '../../services/chart/katalogKustom';

/**
 * KATALOG CHART UNTUK SATU GAYA.
 *
 * Satu tab = satu gaya (Default, Pijar, Lensa, Nadi, Kaca). Isinya SELALU chart yang
 * sama, hanya tampilannya berbeda, karena setiap chart di katalog wajib punya
 * semua gaya (`chartTemplate.ts`). Dashboard yang dibuat dari template atau
 * asisten mengambil chart dari daftar ini.
 *
 * Halaman ini TIDAK menyusun opsi ECharts. Semua lewat `buildOpsi` di
 * `src/services/chart/chartDefault.ts`.
 */

const URUTAN_KELOMPOK: KelompokChart[] = ['ringkas', 'banding', 'tren', 'komposisi', 'sebaran', 'rapat'];

const Kartu: React.FC<{ chartId: ChartId; varian: Varian }> = ({ chartId, varian }) => {
  const entri = CHART_DEFAULT[chartId];
  // Semua gaya kecuali Kaca mengikuti tema aplikasi (terang/gelap).
  const mode = useThemeMode();
  const g = gayaMode(varian, mode);
  const gantiGaya = g !== GAYA[varian] ? g : undefined;
  const bk = bingkaiKatalog(g);
  return (
    // Seluruh kartu (kepala + isi) memakai warna gaya yang dipilih, supaya judul
    // selaras dengan latar chart. Bingkainya sama persis dengan kartu di kanvas
    // dashboard (`bingkaiKatalog`).
    <div className="rounded-card border overflow-hidden flex flex-col" style={bk.luar}>
      <div className="px-3.5 pt-3 pb-2.5 border-b" style={bk.kepala}>
        <p className="text-[13px] font-bold leading-snug truncate" style={bk.judul}>
          {entri.nama}
        </p>
        <p className="text-[11px] mt-0.5 leading-snug line-clamp-2" style={bk.sub}>
          {entri.guna}
        </p>
      </div>
      <div className="p-2.5 flex-1">
        {/* Gaya bening: chart digambar di atas kartu kaca buram, seperti di dashboard. */}
        <div className={bk.dalam ? 'rounded-[16px] border p-2' : ''} style={bk.dalam}>
          <PratinjauChart chartId={chartId} varian={varian} gaya={gantiGaya} tinggi={entri.mesin === 'html' ? 140 : 168} />
        </div>
      </div>
    </div>
  );
};


/**
 * CHART BUATAN SENDIRI (dibuat otomatis).
 *
 * Kalau bentuk data tidak cocok dengan chart bawaan mana pun, sistem membuat
 * entri Template Chart baru (`kustom-…`) dan kartu di kanvas memakai entri itu.
 * Bagian ini menampilkannya supaya admin bisa melihat chart apa yang sudah
 * ditambahkan ke Template Chart — bukan chart liar yang tidak terdaftar.
 */
const BagianKustom: React.FC<{ varian: Varian }> = ({ varian }) => {
  const [daftar, setDaftar] = useState<ChartKustom[]>([]);
  useEffect(() => {
    let hidup = true;
    fetch('/api/chart/kustom', { headers: { 'Content-Type': 'application/json' } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (hidup && Array.isArray(d)) setDaftar(d);
      })
      .catch(() => undefined);
    return () => {
      hidup = false;
    };
  }, []);
  // Hook WAJIB dipanggil sebelum `return` apa pun: urutan hook tidak boleh berubah
  // antara render pertama (daftar kosong) dan render berikutnya (daftar terisi).
  const mode = useThemeMode();
  if (daftar.length === 0) return null;
  return (
    <section data-testid="chart-kustom">
      <div className="flex items-baseline gap-2 mb-2.5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-2">Dibuat otomatis dari data</h3>
        <span className="text-[10px] text-ink-3">{daftar.length} chart</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 items-stretch">
        {daftar.map((k) => {
          const g = gayaMode(varian, mode);
          const gantiGaya = g !== GAYA[varian] ? g : undefined;
          const bk = bingkaiKatalog(g);
          return (
            <div
              key={k.id}
              data-testid={`chart-kustom-${k.id}`}
              className="rounded-card border overflow-hidden flex flex-col"
              style={bk.luar}
            >
              <div className="px-3.5 pt-3 pb-2.5 border-b" style={bk.kepala}>
                <p className="text-[13px] font-bold leading-snug truncate" style={bk.judul}>
                  {k.nama}
                </p>
                <p className="text-[11px] mt-0.5 leading-snug line-clamp-2" style={bk.sub}>
                  {k.guna}
                </p>
              </div>
              <div className="p-2.5 flex-1">
                <div className={bk.dalam ? 'rounded-[16px] border p-2' : ''} style={bk.dalam}>
                  <PratinjauChart chartId={k.dasar} varian={varian} gaya={gantiGaya} tinggi={160} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export const KatalogTemplateChart: React.FC<{ varian: Varian }> = ({ varian }) => (
  <div className="space-y-7">
    {URUTAN_KELOMPOK.map((k) => {
      const anggota = DAFTAR_CHART.filter((id) => CHART_DEFAULT[id].kelompok === k);
      if (anggota.length === 0) return null;
      return (
        <section key={k}>
          <div className="flex items-baseline gap-2 mb-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-2">{LABEL_KELOMPOK[k]}</h3>
            <span className="text-[10px] text-ink-3">{anggota.length} chart</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 items-stretch">
            {anggota.map((id) => (
              <Kartu key={id} chartId={id} varian={varian} />
            ))}
          </div>
        </section>
      );
    })}
    <BagianKustom varian={varian} />
  </div>
);
