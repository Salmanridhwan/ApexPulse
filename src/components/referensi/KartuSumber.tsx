import React, { useState, type CSSProperties } from 'react';
import type { SumberDok } from '../../services/templates/nilaiOperasional';

interface Props {
  /** Hanya bisa dibuka saat fitur sumber aktif (mode pratinjau data asli). */
  aktif?: boolean;
  judul: string;
  sumber: SumberDok[];
  className?: string;
  style?: CSSProperties;
  warnaTeks?: string;
  warnaTeks2?: string;
  warnaTeks3?: string;
  warnaPanel?: string;
  aksen?: string;
  /** Kelas tata letak isi; kartu mendatar wajib mengirim ini. */
  kelasIsi?: string;
  /** Tinggi minimum kartu saat panel terbuka, untuk kartu pendek (mis. `9em`). */
  tinggiBuka?: string;
  children: React.ReactNode;
}

/**
 * KARTU SUMBER — animasi "angkat & singkap" untuk fitur sumber data.
 *
 * ATURAN PENTING:
 * 1. Isi depan TIDAK PERNAH di-unmount: grafik ECharts memegang node DOM asli,
 *    kalau isi depan dilepas lalu dipasang lagi grafiknya rusak.
 * 2. Transisi ditulis di kelas CSS (`kartu-sumber-*`), bukan inline, karena
 *    `src/index.css` memaksa `transition-duration: 0.01ms !important` saat
 *    pengguna mematikan efek animasi OS.
 * 3. Panel selalu di DALAM kartu (`absolute inset-0`), tidak ada popup/modal.
 *    Kartu sempit (KPI) TIDAK memakai komponen ini; sumbernya tampil lewat
 *    `PitaSumber` di bawah deretan kartu, di dalam halaman.
 */
export const KartuSumber: React.FC<Props> = ({
  aktif = false,
  judul,
  sumber,
  className = '',
  style,
  warnaTeks = '#f5f6f7',
  warnaTeks2 = '#b7bdc6',
  warnaTeks3 = '#8b929c',
  warnaPanel = 'rgba(12,13,16,0.98)',
  aksen = '#ff8a1f',
  kelasIsi = 'flex flex-col',
  tinggiBuka,
  children,
}) => {
  const [buka, setBuka] = useState(false);

  const isiPanel = (
    <>
      <div className="flex items-start justify-between gap-[0.6em] mb-[0.4em]">
        <p className="text-[0.72em] font-bold uppercase tracking-[0.12em]" style={{ color: aksen }}>
          Sumber data · {judul}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setBuka(false);
          }}
          className="text-[0.7em] font-semibold px-[0.6em] py-[0.25em] rounded-md shrink-0"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: warnaTeks2 }}
        >
          Tutup
        </button>
      </div>
      {sumber.length === 0 ? (
        <p className="text-[0.76em]" style={{ color: warnaTeks3 }}>
          Dokumen belum mencatat sumber untuk kartu ini.
        </p>
      ) : (
        <ul className="space-y-[0.5em]">
          {sumber.map((s, i) => (
            <li key={`${s.dokumen}-${i}`} className="text-[0.74em] leading-relaxed">
              <p className="font-bold break-words" style={{ color: warnaTeks }}>
                {s.dokumen}
              </p>
              <p className="text-[0.68em]" style={{ color: warnaTeks3 }}>
                halaman {s.halaman || '—'} · keyakinan {Math.round(s.keyakinan * 100)}%
              </p>
              {s.cuplikan && (
                <p className="mt-[0.2em] italic" style={{ color: warnaTeks2 }}>
                  “{s.cuplikan}”
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[0.64em] mt-[0.5em]" style={{ color: warnaTeks3 }}>
        Klik kartu untuk kembali.
      </p>
    </>
  );

  return (
    <div
      className={`${className} kartu-sumber-kotak${aktif ? ' relative cursor-pointer' : ''}`}
      style={{
        ...style,
        minHeight: buka && tinggiBuka ? tinggiBuka : undefined,
        transform: buka ? 'translateY(-3px) scale(1.02)' : 'none',
        transformOrigin: 'center center',
        boxShadow: buka ? '0 18px 42px -20px rgba(0,0,0,0.8)' : '0 0 0 0 rgba(0,0,0,0)',
        willChange: 'transform, box-shadow',
      }}
      onClick={() => {
        if (!aktif) return;
        setBuka((v) => !v);
      }}
      title={aktif ? 'Klik untuk melihat sumber dokumen' : undefined}
    >
      <div style={{ position: 'relative', height: '100%' }}>
        {/* Sisi depan — tetap terpasang agar grafik tidak rusak. */}
        <div
          className={`kartu-sumber-depan ${kelasIsi}`}
          style={{
            height: '100%',
            minHeight: 0,
            opacity: buka ? 0 : 1,
            transform: buka ? 'scale(1.05)' : 'none',
            filter: buka ? 'blur(4px)' : 'none',
            visibility: buka ? 'hidden' : 'visible',
          }}
        >
          {children}
        </div>

        {/* Panel sumber di dalam kartu. */}
        <div
            className="rounded-[1.1em] p-[0.95em] overflow-auto kartu-sumber-panel"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: warnaPanel,
              color: warnaTeks,
              opacity: buka ? 1 : 0,
              transform: buka ? 'scale(1)' : 'scale(0.96)',
              filter: buka ? 'blur(0)' : 'blur(6px)',
              pointerEvents: buka ? 'auto' : 'none',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {isiPanel}
        </div>
      </div>

    </div>
  );
};

interface PitaProps {
  judul: string;
  sumber: SumberDok[];
  onTutup: () => void;
  warnaTeks?: string;
  warnaTeks2?: string;
  warnaTeks3?: string;
  warnaPanel?: string;
  aksen?: string;
  border?: string;
}

/**
 * PITA SUMBER — panel sumber selebar baris, tampil di dalam halaman (bukan
 * popup, bukan modal) tepat di bawah deretan kartu KPI. Dipakai untuk kartu
 * sempit supaya teksnya terbaca mendatar, sementara bentuk panelnya tetap sama
 * dengan kartu lain: kotak berbingkai di dalam dashboard.
 */
export const PitaSumber: React.FC<PitaProps> = ({
  judul,
  sumber,
  onTutup,
  warnaTeks = '#f5f6f7',
  warnaTeks2 = '#b7bdc6',
  warnaTeks3 = '#8b929c',
  warnaPanel = 'rgba(12,13,16,0.98)',
  aksen = '#ff8a1f',
  border = '1px solid rgba(255,255,255,0.12)',
}) => (
  <div
    className="rounded-[1.1em] p-[0.95em] mt-[0.8em] kartu-sumber-panel"
    style={{ backgroundColor: warnaPanel, color: warnaTeks, border }}
  >
    <div className="flex items-start justify-between gap-[0.6em] mb-[0.4em]">
      <p className="text-[0.72em] font-bold uppercase tracking-[0.12em]" style={{ color: aksen }}>
        Sumber data · {judul}
      </p>
      <button
        type="button"
        onClick={onTutup}
        className="text-[0.7em] font-semibold px-[0.6em] py-[0.25em] rounded-md shrink-0"
        style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: warnaTeks2 }}
      >
        Tutup
      </button>
    </div>
    {sumber.length === 0 ? (
      <p className="text-[0.76em]" style={{ color: warnaTeks3 }}>
        Dokumen belum mencatat sumber untuk kartu ini.
      </p>
    ) : (
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-[1.2em] gap-y-[0.5em]">
        {sumber.map((s, i) => (
          <li key={`${s.dokumen}-${i}`} className="text-[0.74em] leading-relaxed">
            <p className="font-bold break-words" style={{ color: warnaTeks }}>
              {s.dokumen}
            </p>
            <p className="text-[0.68em]" style={{ color: warnaTeks3 }}>
              halaman {s.halaman || '—'} · keyakinan {Math.round(s.keyakinan * 100)}%
            </p>
            {s.cuplikan && (
              <p className="mt-[0.2em] italic" style={{ color: warnaTeks2 }}>
                “{s.cuplikan}”
              </p>
            )}
          </li>
        ))}
      </ul>
    )}
  </div>
);
