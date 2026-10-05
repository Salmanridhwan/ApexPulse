import React, { useId } from 'react';

interface RingGauge3DProps {
  /** Nilai 0..max yang ditampilkan di tengah. */
  value: number;
  max?: number;
  /** Teks satuan di bawah angka (mis. "mb", "%"). */
  unit?: string;
  /** Label di bawah ring (mis. "Music"). */
  label?: string;
  /** Keterangan tambahan (mis. "120 files"). */
  sublabel?: string;
  /** Warna dasar ring. Default memakai token brand. */
  color?: string;
  size?: number;
  thickness?: number;
}

/**
 * Ring gauge 3D bergaya "soft 3D" seperti referensi:
 * - arc dasar (track) gelap sebagai cekungan,
 * - arc progres dengan highlight terang di sisi dalam (bevel),
 * - inner shadow pada cincin agar tengah terlihat cekung.
 * Murni SVG/CSS agar ringan & tajam di kedua mode.
 */
export const RingGauge3D: React.FC<RingGauge3DProps> = ({
  value,
  max = 100,
  unit,
  label,
  sublabel,
  color = 'var(--color-brand)',
  size = 132,
  thickness = 13,
}) => {
  const uid = useId().replace(/:/g, '');
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const r = (size - thickness) / 2;
  const c = size / 2;
  const keliling = 2 * Math.PI * r;
  // Sisakan celah kecil di kiri-bawah seperti referensi (~6%).
  const celah = keliling * 0.06;
  const panjangIsi = Math.max(0, keliling * pct - celah);
  // Putar agar celah berada di kiri-bawah.
  const rotasi = 130;

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
          aria-label={`${label || ''} ${value}${unit || ''}`}>
          <defs>
            {/* Gradien progres: terang -> warna dasar. */}
            <linearGradient id={`rg-fill-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="45%" stopColor={color} stopOpacity="1" />
              <stop offset="100%" stopColor={color} stopOpacity="0.75" />
            </linearGradient>
            {/* Cekungan track (dalam). */}
            <radialGradient id={`rg-track-${uid}`} cx="50%" cy="42%" r="65%">
              <stop offset="55%" stopColor="#000000" stopOpacity="0" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
            </radialGradient>
            <filter id={`rg-shadow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2.5" stdDeviation="3" floodColor="#000" floodOpacity="0.35" />
            </filter>
          </defs>

          <g transform={`rotate(${rotasi} ${c} ${c})`}>
            {/* Track (rel dasar) */}
            <circle
              cx={c} cy={c} r={r}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.22"
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={`${keliling - celah} ${keliling}`}
            />
            {/* Isian progres dengan bevel + bayangan */}
            <circle
              cx={c} cy={c} r={r}
              fill="none"
              stroke={`url(#rg-fill-${uid})`}
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={`${panjangIsi} ${keliling}`}
              filter={`url(#rg-shadow-${uid})`}
              style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.22,1,0.36,1)' }}
            />
          </g>

          {/* Inner shadow pada cincin → tengah terlihat cekung */}
          <circle cx={c} cy={c} r={r} fill="none" stroke={`url(#rg-track-${uid})`} strokeWidth={thickness} />
        </svg>

        {/* Angka di tengah */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[1.6rem] leading-none font-extrabold tracking-tight text-current tabular-nums">
            {value}
          </span>
          {unit && <span className="text-[11px] font-semibold text-current/70 mt-0.5">{unit}</span>}
        </div>
      </div>

      {(label || sublabel) && (
        <div className="text-center">
          {label && <p className="text-xs font-semibold text-current">{label}</p>}
          {sublabel && <p className="text-[10px] text-current/70">{sublabel}</p>}
        </div>
      )}
    </div>
  );
};
