import React from 'react';
import { FileSearch, FileText, ShieldCheck, X } from 'lucide-react';
import type { WidgetSpec } from '../../types';
import { angkaKartu, potongSorot } from '../../services/chart/sorotSumber';

export interface WarnaPanelSumber {
  panel: string;
  teks: string;
  teks2: string;
  teks3: string;
  aksen: string;
  garis: string;
}

interface Props {
  widget: WidgetSpec;
  buka: boolean;
  onTutup: () => void;
  warna: WarnaPanelSumber;
}

/**
 * PANEL SUMBER KARTU KANVAS.
 *
 * Dibuka dengan mengeklik kartu KPI, tabel, narasi, atau area kosong grafik
 * (klik batang/potongan tetap dipakai seleksi lintas-chart), atau lewat ikon
 * sumber di kepala kartu. Panel menyingkap di DALAM kartu seperti kartu sumber
 * template dashboard: nama dokumen, halaman, keyakinan, periode, dan kutipan
 * dokumen dengan angka kartu disorot. Isi kartu tetap terpasang di belakangnya
 * supaya grafik ECharts tidak rusak.
 */
export const PanelSumber: React.FC<Props> = ({ widget, buka, onTutup, warna }) => {
  const sumber = widget.citations ?? [];
  const angka = angkaKartu(widget);
  const periode = widget.periode?.trim();

  return (
    <div
      className="absolute inset-0 z-[12] p-3.5 overflow-auto kartu-sumber-panel flex flex-col gap-2.5"
      style={{
        backgroundColor: warna.panel,
        color: warna.teks,
        opacity: buka ? 1 : 0,
        transform: buka ? 'scale(1)' : 'scale(0.96)',
        filter: buka ? 'blur(0)' : 'blur(6px)',
        pointerEvents: buka ? 'auto' : 'none',
        borderRadius: 'inherit',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
      aria-hidden={!buka}
      onClick={(e) => {
        e.stopPropagation();
        onTutup();
      }}
      data-testid="panel-sumber"
    >
      <div className="flex items-start gap-2.5">
        <span
          className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full"
          style={{ backgroundColor: `${warna.aksen}22`, color: warna.aksen, boxShadow: `0 0 0 1px ${warna.aksen}44` }}
        >
          <FileSearch className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: warna.aksen }}>
            Sumber data
          </p>
          <p className="text-[13px] font-semibold leading-snug truncate" title={widget.title}>
            {widget.title}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTutup();
          }}
          className="shrink-0 p-1 rounded-full transition-colors"
          style={{ color: warna.teks2, backgroundColor: `${warna.teks}12` }}
          aria-label="Tutup sumber data"
          tabIndex={buka ? 0 : -1}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {sumber.length === 0 ? (
        <p className="text-[12px] leading-relaxed" style={{ color: warna.teks3 }}>
          Kartu ini belum mencatat dokumen sumbernya.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sumber.map((c, i) => {
            const yakin = Math.round(Math.max(0, Math.min(1, c.confidenceScore ?? 0)) * 100);
            return (
              <li
                key={`${c.id}-${i}`}
                className="rounded-xl p-2.5 kartu-sumber-panel"
                style={{
                  border: `1px solid ${warna.garis}`,
                  backgroundColor: `${warna.teks}08`,
                  // Muncul berurutan saat panel dibuka.
                  transitionDelay: buka ? `${80 + i * 70}ms` : '0ms',
                  opacity: buka ? 1 : 0,
                  transform: buka ? 'translateY(0)' : 'translateY(6px)',
                }}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg"
                    style={{ backgroundColor: `${warna.aksen}1f`, color: warna.aksen }}
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold leading-snug break-words">{c.docName || 'Dokumen instansi'}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `${warna.teks}14`, color: warna.teks2 }}
                      >
                        Hal. {c.page || '—'}
                      </span>
                      {(periode || c.date) && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: `${warna.teks}14`, color: warna.teks2 }}
                        >
                          {periode || c.date}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: warna.teks3 }}>
                        <span className="w-10 h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${warna.teks}1a` }}>
                          <span className="block h-full rounded-full" style={{ width: `${yakin}%`, backgroundColor: warna.aksen }} />
                        </span>
                        keyakinan {yakin}%
                      </span>
                    </div>
                  </div>
                </div>
                {c.chunkSnippet && (
                  <blockquote
                    className="mt-2 pl-2.5 text-[11.5px] leading-relaxed"
                    style={{ borderLeft: `2px solid ${warna.aksen}`, color: warna.teks2 }}
                  >
                    “
                    {potongSorot(c.chunkSnippet, angka).map((b, k) =>
                      b.sorot ? (
                        <mark
                          key={k}
                          className="px-0.5 rounded font-bold"
                          style={{ backgroundColor: `${warna.aksen}33`, color: warna.teks }}
                        >
                          {b.teks}
                        </mark>
                      ) : (
                        <React.Fragment key={k}>{b.teks}</React.Fragment>
                      )
                    )}
                    ”
                  </blockquote>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-auto flex items-center gap-1.5 text-[10px]" style={{ color: warna.teks3 }}>
        <ShieldCheck className="w-3 h-3 shrink-0" style={{ color: warna.aksen }} />
        Angka kartu ini diambil dari dokumen resmi instansi. Klik di mana saja untuk kembali.
      </p>
    </div>
  );
};
