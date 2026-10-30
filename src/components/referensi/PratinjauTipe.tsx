import React, { useEffect, useMemo, useRef } from 'react';
import { loadEcharts } from '../widgets/echartsSetup';
import { opsiPratinjau } from '../../services/chart/pratinjauTipe';
import { useThemeMode } from '../../theme';

/**
 * PRATINJAU TIPE CHART DEFAULT.
 *
 * Hanya menggambar. Bentuk dan gayanya ada di `pratinjauTipe.ts`, jadi kalau
 * tampilan melenceng, perbaikan dilakukan di sana, bukan di komponen ini.
 *
 * Untuk tipe yang bukan kanvas (kartu KPI, tabel, narasi, peta, jadwal) dipakai
 * HTML sederhana supaya tetap terbaca di kartu yang pendek.
 */
export const PratinjauTipe: React.FC<{ type: string }> = ({ type }) => {
  const wadah = useRef<HTMLDivElement | null>(null);
  const mode = useThemeMode();
  const hasil = useMemo(() => opsiPratinjau(type, mode), [type, mode]);

  useEffect(() => {
    if (hasil.mesin !== 'echarts') return;
    let batal = false;
    let instans: any = null;
    let pengamat: ResizeObserver | null = null;
    void loadEcharts().then((ec) => {
      if (batal || !wadah.current) return;
      instans = ec.init(wadah.current);
      instans.setOption(hasil.opsi, true);
      pengamat = new ResizeObserver(() => instans?.resize?.());
      pengamat.observe(wadah.current);
    });
    return () => {
      batal = true;
      pengamat?.disconnect();
      instans?.dispose?.();
    };
  }, [type, mode, hasil]);

  if (hasil.mesin === 'html') return <Html jenis={hasil.jenis} mode={mode} />;

  return (
    <div ref={wadah} className="w-full h-full" />
  );
};

const Kartu: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="h-full w-full rounded-lg bg-transparent p-2.5 flex flex-col">{children}</div>
);

const Html: React.FC<{ jenis: 'kpi' | 'bullet' | 'tabel' | 'narasi' | 'peta' | 'gantt' | 'peringkat'; mode: 'light' | 'dark' }> = ({
  jenis,
  mode,
}) => {
  if (jenis === 'kpi') {
    // Isi dibagi rata: judul di atas, angka di tengah, delta dan garis di bawah.
    // Jarak bawah sama dengan jarak atas, bukan sisa ruang hasil pemusatan.
    return (
      <div className="h-full w-full flex flex-col justify-between rounded-lg bg-transparent px-3 py-2.5">
        <p className="text-[9.5px] font-semibold text-ink-3">Volume air terjual</p>
        <p className="text-[26px] font-extrabold text-ink leading-none mt-1">
          452,8 <span className="text-[10px] font-semibold text-ink-2">juta m³</span>
        </p>
        <div className="flex items-end gap-2">
          <span className={`text-[9.5px] font-bold ${mode === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>▲ 4,2%</span>
          <span className="text-[9.5px] text-ink-3">vs tahun lalu</span>
          {/* Garis kecil ini menyatakan arah yang sama dengan deltanya: naik 4,2%
              berarti garis menanjak. Jangan digambar menurun. */}
          <svg
            className="ml-auto shrink-0"
            width="66"
            height="20"
            viewBox="0 0 66 20"
            fill="none"
            aria-hidden="true"
            data-testid="sparkline-kpi"
          >
            <polyline
              points="1,16 9,14 17,15 25,11 33,12 41,8 49,9 57,4 65,2"
              stroke={mode === 'dark' ? '#34d399' : '#059669'}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="65" cy="2" r="2" fill={mode === 'dark' ? '#34d399' : '#059669'} />
          </svg>
        </div>
      </div>
    );
  }

  if (jenis === 'bullet') {
    const baris = [
      { label: 'NRW', nilai: 43.9, target: 41.5, satuan: '%' },
      { label: 'SLA pengaduan', nilai: 93.5, target: 92, satuan: '%' },
      { label: 'Kepuasan pelanggan', nilai: 87.1, target: 85, satuan: 'indeks' },
    ];
    return (
      <div className="h-full w-full rounded-lg bg-transparent p-2.5 flex flex-col justify-center gap-2.5">
        {baris.map((b) => (
          <div key={b.label}>
            <div className="flex items-baseline justify-between text-[9px]">
              <span className="text-ink-2 font-semibold">{b.label}</span>
              <span className="tabular-nums text-ink-3">
                {String(b.nilai).replace('.', ',')} / {String(b.target).replace('.', ',')} {b.satuan}
              </span>
            </div>
            <div className="relative h-[7px] rounded-full bg-line mt-1 overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-surface-3" style={{ width: '100%', opacity: 0.45 }} />
              <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${Math.min(100, b.nilai)}%` }} />
              <div className="absolute inset-y-0 w-[2px] bg-ink-2" style={{ left: `calc(${b.target}% - 1px)` }} />
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3 text-[8.5px] text-ink-3 mt-0.5">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-[6px] rounded-full bg-brand" /> capaian
          </span>
          <span className="flex items-center gap-1">
            <span className="w-[2px] h-2 bg-ink-2" /> target
          </span>
        </div>
      </div>
    );
  }

  if (jenis === 'tabel') {
    const baris = [
      ['Volume terjual', '452,8', '440,0'],
      ['NRW', '43,9', '41,5'],
      ['Pelanggan aktif', '1.072.400', '1.050.000'],
    ];
    return (
      <div className="h-full w-full rounded-lg bg-transparent p-2 overflow-hidden">
        <table className="w-full text-[9px]">
          <thead>
            <tr className="text-ink-3">
              <th className="text-left font-semibold pb-1">Indikator</th>
              <th className="text-right font-semibold pb-1">Aktual</th>
              <th className="text-right font-semibold pb-1">Target</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((r) => (
              <tr key={r[0]} className="border-t border-line">
                <td className="py-1.5 text-ink-2">{r[0]}</td>
                <td className="py-1.5 text-right tabular-nums font-semibold text-ink">{r[1]}</td>
                <td className="py-1.5 text-right tabular-nums text-ink-3">{r[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (jenis === 'narasi') {
    return (
      <div className="h-full w-full rounded-lg bg-transparent border-l-[3px] border-l-brand p-3 flex items-center">
        <p className="text-[10px] leading-relaxed text-ink-2">
          Volume air terjual naik 4,2% seiring bertambahnya pelanggan aktif. NRW masih di atas target, jadi
          penurunan kebocoran tetap menjadi prioritas periode berikutnya.
        </p>
      </div>
    );
  }

  if (jenis === 'peta') {
    const wilayah = [
      { nama: 'Jakarta Pusat', nilai: 82 },
      { nama: 'Jakarta Utara', nilai: 64 },
      { nama: 'Jakarta Barat', nilai: 71 },
      { nama: 'Jakarta Selatan', nilai: 55 },
      { nama: 'Jakarta Timur', nilai: 47 },
    ];
    return (
      <div className="h-full w-full rounded-lg bg-transparent p-2.5 flex flex-col justify-center gap-1.5">
        {wilayah.map((w) => (
          <div key={w.nama} className="flex items-center gap-2">
            <span className="text-[9px] text-ink-2 w-[74px] shrink-0 truncate">{w.nama}</span>
            <span className="flex-1 h-[9px] rounded-sm overflow-hidden" >
              <span className="block h-full" style={{ width: `${w.nilai}%`, backgroundColor: `rgba(37,99,235,${0.25 + w.nilai / 140})` }} />
            </span>
            <span className="text-[9px] tabular-nums text-ink-3 w-6 text-right">{w.nilai}</span>
          </div>
        ))}
      </div>
    );
  }

  if (jenis === 'gantt') {
    const tugas = [
      { nama: 'Perencanaan', mulai: 0, lebar: 22, progres: 100 },
      { nama: 'Pengadaan', mulai: 20, lebar: 34, progres: 70 },
      { nama: 'Pemasangan', mulai: 50, lebar: 32, progres: 35 },
      { nama: 'Uji fungsi', mulai: 80, lebar: 20, progres: 0 },
    ];
    return (
      <div className="h-full w-full rounded-lg bg-transparent p-2.5 flex flex-col justify-center gap-2">
        {tugas.map((t) => (
          <div key={t.nama} className="flex items-center gap-2">
            <span className="text-[9px] text-ink-2 w-[64px] shrink-0 truncate">{t.nama}</span>
            <span className="relative flex-1 h-[8px] rounded-full bg-surface-2">
              <span
                className="absolute inset-y-0 rounded-full bg-brand/25"
                style={{ left: `${t.mulai}%`, width: `${t.lebar}%` }}
              />
              <span
                className="absolute inset-y-0 rounded-full bg-brand"
                style={{ left: `${t.mulai}%`, width: `${(t.lebar * t.progres) / 100}%` }}
              />
            </span>
            <span className="text-[8.5px] tabular-nums text-ink-3 w-7 text-right">{t.progres}%</span>
          </div>
        ))}
      </div>
    );
  }

  const peringkat = [
    { nama: 'Jakarta Barat', nilai: 208 },
    { nama: 'Jakarta Selatan', nilai: 196 },
    { nama: 'Jakarta Timur', nilai: 188 },
    { nama: 'Jakarta Pusat', nilai: 186 },
    { nama: 'Jakarta Utara', nilai: 173 },
  ];
  const puncak = Math.max(...peringkat.map((p) => p.nilai));
  return (
    <div className="h-full w-full rounded-lg bg-transparent p-2.5 flex flex-col justify-center gap-1.5">
      {peringkat.map((p) => (
        <div key={p.nama} className="flex items-center gap-2">
          <span className="text-[9px] text-ink-2 w-[74px] shrink-0 truncate">{p.nama}</span>
          <span className="flex-1 h-[8px] rounded-full bg-line overflow-hidden">
            <span className="block h-full rounded-full bg-brand" style={{ width: `${(p.nilai / puncak) * 100}%` }} />
          </span>
          <span className="text-[9px] tabular-nums text-ink-3 w-7 text-right">{p.nilai}</span>
        </div>
      ))}
    </div>
  );
};
