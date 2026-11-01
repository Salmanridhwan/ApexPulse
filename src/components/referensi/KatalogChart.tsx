import React from 'react';
import { CHART_DEFAULT, DAFTAR_CHART, LABEL_KELOMPOK, type ChartId, type KelompokChart } from '../../services/chart/chartDefault';
import { GAYA, cukupTerang, gayaMode, type Varian } from '../../services/chart/gayaVarian';
import { useThemeMode } from '../../theme';
import { PratinjauChart } from './PratinjauChart';

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

const URUTAN_KELOMPOK: KelompokChart[] = ['ringkas', 'banding', 'tren', 'komposisi', 'sebaran'];

const Kartu: React.FC<{ chartId: ChartId; varian: Varian }> = ({ chartId, varian }) => {
  const entri = CHART_DEFAULT[chartId];
  // Semua gaya kecuali Kaca mengikuti tema aplikasi (terang/gelap).
  const mode = useThemeMode();
  const g = gayaMode(varian, mode);
  const gantiGaya = g !== GAYA[varian] ? g : undefined;
  // Kartu bening: pinggiran putih di latar terang (Kaca), pinggiran berpendar di latar gelap (Tirta).
  const bening = Boolean(g.kaca);
  const terang = cukupTerang(g.padanan ?? g.latar);
  const tepiBening = terang ? 'rgba(255,255,255,0.55)' : g.garis;
  return (
    // Seluruh kartu (kepala + isi) memakai warna gaya yang dipilih, supaya judul
    // selaras dengan latar chart: gaya ikut tema aplikasi, Kaca bening hangat, lainnya gelap.
    <div
      className="rounded-card border overflow-hidden flex flex-col"
      style={{
        background: g.latarCss ?? g.latar,
        borderColor: bening ? tepiBening : g.tepi?.warna ?? g.garis,
        borderWidth: g.tepi?.tebal,
        boxShadow: g.tepi && g.tepi.bayangan !== 'none' ? g.tepi.bayangan : undefined,
        borderRadius: g.sudutKartu,
        fontFamily: g.huruf,
      }}
    >
      <div
        className="px-3.5 pt-3 pb-2.5 border-b"
        style={{
          backgroundColor: bening ? (terang ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.05)') : g.kartu,
          borderColor: bening ? tepiBening : g.tepi?.warna ?? g.garis,
          borderBottomWidth: g.tepi?.tebal,
          backdropFilter: bening ? 'blur(16px)' : undefined,
          WebkitBackdropFilter: bening ? 'blur(16px)' : undefined,
        }}
      >
        <p className="text-[13px] font-bold leading-snug truncate" style={{ color: g.teks }}>
          {entri.nama}
        </p>
        <p className="text-[11px] mt-0.5 leading-snug line-clamp-2" style={{ color: g.teks3 }}>
          {entri.guna}
        </p>
      </div>
      <div className="p-2.5 flex-1">
        {/* Gaya bening: chart digambar di atas kartu kaca buram, seperti di dashboard. */}
        <div
          className={bening ? 'rounded-[16px] border p-2' : ''}
          style={
            bening
              ? { backgroundColor: g.kartu, borderColor: tepiBening, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }
              : undefined
          }
        >
          <PratinjauChart chartId={chartId} varian={varian} gaya={gantiGaya} tinggi={entri.mesin === 'html' ? 140 : 168} />
        </div>
      </div>
    </div>
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
  </div>
);
