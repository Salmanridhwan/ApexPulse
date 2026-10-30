import React from 'react';
import { CheckCircle2, CircleDashed, Clock } from 'lucide-react';
import { CHART_DEFAULT, DAFTAR_CHART, varianTersedia } from '../../services/chart/chartDefault';
import { GAYA, type Varian } from '../../services/chart/gayaVarian';
import { LABEL_STATUS, statusSel, type StatusSel } from '../../services/chart/status';
import { PratinjauChart } from './PratinjauChart';

/**
 * KATALOG CHART UNTUK SATU TEMPLATE.
 *
 * Satu tab = satu template dashboard. Isinya hanya wajah milik template itu,
 * misalnya tab Ringkasan menampilkan semua chart bergaya oranye. Chip di atas
 * menyebut berapa wajah yang sudah ada dan berapa yang masih bolong, lalu
 * daftar bolongnya ditulis terbuka supaya kelihatan sebagai utang.
 *
 * Halaman ini TIDAK menyusun opsi ECharts. Semua lewat `buildOpsi` di
 * `src/services/chart/chartDefault.ts`.
 */

const GAYA_BADGE: Record<StatusSel, { bg: string; teks: string; ikon: React.ReactNode }> = {
  draf: { bg: 'bg-amber-50 border-amber-200', teks: 'text-amber-700', ikon: <CircleDashed className="w-3 h-3" /> },
  'menunggu oke': { bg: 'bg-blue-50 border-blue-200', teks: 'text-blue-700', ikon: <Clock className="w-3 h-3" /> },
  final: { bg: 'bg-emerald-50 border-emerald-200', teks: 'text-emerald-700', ikon: <CheckCircle2 className="w-3 h-3" /> },
};

const Badge: React.FC<{ status: StatusSel | null }> = ({ status }) => {
  if (!status) {
    return (
      <span className="text-[9.5px] px-1.5 py-0.5 rounded-full border border-line bg-surface-2 text-ink-3 font-semibold">
        belum ada
      </span>
    );
  }
  const g = GAYA_BADGE[status];
  return (
    <span
      className={`text-[9.5px] px-1.5 py-0.5 rounded-full border font-semibold inline-flex items-center gap-1 ${g.bg} ${g.teks}`}
    >
      {g.ikon}
      {LABEL_STATUS[status]}
    </span>
  );
};

const Kartu: React.FC<{ chartId: keyof typeof CHART_DEFAULT; varian: Varian }> = ({ chartId, varian }) => {
  const entri = CHART_DEFAULT[chartId];
  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div
        className="px-3 py-2 flex items-start justify-between gap-2 border-b border-line"
        style={{ backgroundColor: GAYA[varian].kartu2 }}
      >
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-ink truncate">{entri.nama}</p>
          <p className="text-[10px] text-ink-3 truncate">
            <span className="font-mono">{chartId}</span> · {entri.butuh}
          </p>
        </div>
        <Badge status={statusSel(chartId, varian)} />
      </div>

      <div style={{ backgroundColor: GAYA[varian].latar }}>
        <div className="p-2">
          <PratinjauChart chartId={chartId} varian={varian} tinggi={entri.mesin === 'html' ? 132 : 158} />
        </div>
      </div>
    </div>
  );
};

export const KatalogTemplateChart: React.FC<{ varian: Varian; keterangan?: string }> = ({ varian, keterangan }) => {
  const ada = DAFTAR_CHART.filter((id) => varianTersedia(id).includes(varian));
  const belum = DAFTAR_CHART.filter((id) => !varianTersedia(id).includes(varian));
  const g = GAYA[varian];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] px-2 py-0.5 rounded-full bg-line text-ink-2 font-semibold">
          <span className="w-2.5 h-2.5 rounded-full border border-line" style={{ backgroundColor: g.aksen }} aria-hidden />
          {g.nama} · {g.sebutan}
        </span>
        <span className="text-[10.5px] text-ink-2">{ada.length} wajah siap</span>
        <span className="text-[10.5px] text-ink-3">{belum.length} belum ada</span>
      </div>

      {keterangan && <p className="text-[11px] text-ink-2 mb-3 leading-relaxed max-w-3xl">{keterangan}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">
        {ada.map((id) => (
          <Kartu key={id} chartId={id} varian={varian} />
        ))}
      </div>

      {belum.length > 0 && (
        <p className="text-[10px] text-ink-3 mt-3 leading-relaxed border-t border-line pt-3">
          Belum ada wajah {g.nama} untuk:{' '}
          {belum.map((id) => (
            <span key={id} className="font-mono mr-1.5">
              {id}
            </span>
          ))}
        </p>
      )}
    </div>
  );
};
