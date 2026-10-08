import React from 'react';

/**
 * Objek dekoratif untuk panel hero login.
 *
 * Sebelumnya memakai three.js (torus knot WebGL) yang menyeret ~531 KB ke
 * halaman login hanya untuk dekorasi. Diganti SVG + CSS: bentuk knot glossy
 * yang setara secara visual, animasi halus, tanpa dependensi runtime.
 *
 * Menghormati `prefers-reduced-motion`: animasi berhenti, bentuk tetap tampil.
 */
export const Hero3D: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`hero-knot ${className}`} aria-hidden="true">
      <svg viewBox="0 0 200 200" className="hero-knot-svg" role="presentation">
        <defs>
          {/* Gradien utama: cyan -> violet -> coral (senada palet Aiones Boards). */}
          <linearGradient id="knot-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-brand)" />
            <stop offset="52%" stopColor="var(--color-violet)" />
            <stop offset="100%" stopColor="var(--color-coral)" />
          </linearGradient>
          {/* Kilau glossy di bagian atas. */}
          <linearGradient id="knot-gloss" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <filter id="knot-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Bayangan lembut di bawah knot. */}
        <ellipse cx="100" cy="170" rx="50" ry="9" fill="var(--color-ink)" opacity="0.10" />

        {/* Denyut cahaya: lingkaran lembut yang membesar-mengecil di belakang knot. */}
        <circle
          className="hero-glow"
          cx="100"
          cy="100"
          r="74"
          fill="var(--color-brand)"
          opacity="0.4"
          style={{ filter: 'blur(26px)' }}
        />

        {/* Lingkaran orbit: partikel kecil mengelilingi knot (tema data berputar). */}
        <g className="hero-orbit">
          <circle cx="100" cy="22" r="3.4" fill="var(--color-brand)" opacity="0.9" />
          <circle cx="170" cy="140" r="2.6" fill="var(--color-violet)" opacity="0.8" />
          <circle cx="30" cy="132" r="2.2" fill="var(--color-coral)" opacity="0.8" />
        </g>

        <g filter="url(#knot-soft)">
          <g className="hero-knot-spin">
            {/* Trefoil knot: tiga lengkung saling silang. */}
            <path
              d="M100 34 C150 34 168 74 142 104 C120 130 80 130 58 104 C32 74 50 34 100 34 Z"
              fill="none"
              stroke="url(#knot-grad)"
              strokeWidth="17"
              strokeLinecap="round"
            />
            <path
              d="M142 104 C168 134 140 170 100 170 C60 170 32 134 58 104 C80 130 120 130 142 104 Z"
              fill="none"
              stroke="url(#knot-grad)"
              strokeWidth="17"
              strokeLinecap="round"
              opacity="0.92"
            />
            <path
              d="M100 34 C70 60 70 100 100 124 C130 100 130 60 100 34 Z"
              fill="none"
              stroke="url(#knot-grad)"
              strokeWidth="15"
              strokeLinecap="round"
              opacity="0.85"
            />
            {/* Kilau di atas untuk kesan bahan glossy. */}
            <path
              d="M100 34 C150 34 168 74 142 104"
              fill="none"
              stroke="url(#knot-gloss)"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </g>
        </g>
      </svg>
    </div>
  );
};
