import React, { useEffect, useId, useRef, useState } from 'react';

/**
 * Latar halaman login: dokumen RAG yang mengalir menjadi dashboard.
 *
 * Empat kartu widget di sekitar kartu login memakai efek "kaca bertimbul"
 * (glass + spotlight + parallax) ala React Bits, tetapi diimplementasikan
 * sendiri supaya tidak menambah dependensi:
 *   - parallax + tilt mengikuti kursor (CSS variable, satu listener rAF),
 *   - sorot cahaya (spotlight) mengikuti posisi kursor di dalam tiap kartu,
 *   - angka KPI menghitung naik (CountUp) saat komponen dipasang,
 *   - garis tren menggambar diri + titik cahaya berjalan di sepanjang garis,
 *   - cincin donat conic-gradient berputar dengan persentase di tengah,
 *   - batang equalizer tumbuh bergantian seperti data masuk.
 *
 * Dekorasi murni: `aria-hidden` + `pointer-events: none`, jadi tidak pernah
 * mengganggu pembaca layar maupun klik pada form. Parallax hanya bergerak saat
 * kursor benar-benar bergerak (tidak ada animasi otomatis dari JS).
 */

/** Hitung naik dari 0 ke `target` dengan easing keluar. */
function useCountUp(target: number, durasi = 1500, desimal = 1): string {
  const [nilai, setNilai] = useState(0);

  useEffect(() => {
    let frame = 0;
    const mulai = performance.now();
    const langkah = (kini: number) => {
      const t = Math.min(1, (kini - mulai) / durasi);
      setNilai(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(langkah);
    };
    frame = requestAnimationFrame(langkah);
    return () => cancelAnimationFrame(frame);
  }, [target, durasi]);

  return nilai.toLocaleString('id-ID', {
    minimumFractionDigits: desimal,
    maximumFractionDigits: desimal,
  });
}

export const AuthBackdrop: React.FC = () => {
  const akar = useRef<HTMLDivElement>(null);
  const idGaris = useId().replace(/:/g, '');
  const pendapatan = useCountUp(748.2, 1600, 1);
  const porsi = useCountUp(68, 1400, 0);

  // Parallax: satu listener untuk seluruh kanvas, ditulis ke CSS variable.
  // Dibatasi satu penulisan per frame supaya tidak memicu reflow beruntun.
  useEffect(() => {
    const el = akar.current;
    if (!el) return;
    let frame = 0;
    let berikut: { x: number; y: number } | null = null;

    const tulis = () => {
      frame = 0;
      if (!berikut) return;
      el.style.setProperty('--px', berikut.x.toFixed(3));
      el.style.setProperty('--py', berikut.y.toFixed(3));
      el.style.setProperty('--mxp', `${((berikut.x + 1) / 2) * 100}%`);
      el.style.setProperty('--myp', `${((berikut.y + 1) / 2) * 100}%`);
    };

    const gerak = (e: PointerEvent) => {
      berikut = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
      if (!frame) frame = requestAnimationFrame(tulis);
    };

    window.addEventListener('pointermove', gerak, { passive: true });
    return () => {
      window.removeEventListener('pointermove', gerak);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // 12 batang: tinggi tetap (bukan acak) supaya bentuknya stabil antar render.
  const batang = [42, 68, 54, 86, 62, 96, 74, 58, 82, 66, 92, 76];

  return (
    <div className="auth-bg" aria-hidden="true" ref={akar}>
      {/* 1. Aurora: tiga bidang cahaya brand yang bergerak sangat perlahan. */}
      <div className="auth-blob auth-blob-a" />
      <div className="auth-blob auth-blob-b" />
      <div className="auth-blob auth-blob-c" />

      {/* 2. Kisi halus bergeser pelan — kesan kanvas dashboard. */}
      <div className="auth-grid" />

      {/* 3. Empat kartu widget mengapung. Posisi diikat ke TEPI kartu login
             (`max-w-4xl` = 896px), bukan persentase viewport, supaya jaraknya
             selalu 16px dari kartu di lebar layar mana pun. Hanya tampil di xl. */}

      {/* A. KPI pendapatan — kiri atas */}
      <div
        className="auth-tile hidden xl:block"
        style={{ top: '13%', right: 'calc(50% + 462px)', width: 176, '--dur': '13s', '--kedalaman': '1', '--rot': '-3deg' } as React.CSSProperties}
      >
        <div className="auth-glass p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-semibold text-ink-3 tracking-[0.08em]">PENDAPATAN</span>
            <span className="text-[9px] font-mono text-pos">▲ 7,3%</span>
          </div>
          <div className="text-base font-bold text-ink leading-none tabular-nums">
            Rp {pendapatan} M
          </div>
          <svg viewBox="0 0 100 28" className="w-full h-7 mt-2 overflow-visible" role="presentation">
            <defs>
              <linearGradient id={`${idGaris}-isi`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-pos)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--color-pos)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M2 24 L18 19 L34 21 L50 12 L66 14 L82 6 L98 3 L98 28 L2 28 Z"
              fill={`url(#${idGaris}-isi)`}
            />
            <path
              id={`${idGaris}-garis`}
              d="M2 24 L18 19 L34 21 L50 12 L66 14 L82 6 L98 3"
              fill="none"
              stroke="var(--color-pos)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="auth-line-draw"
            />
            {/* Titik cahaya berjalan sepanjang garis tren. */}
            <circle r="2.6" fill="var(--color-pos)" className="auth-spark-dot">
              <animateMotion dur="5.2s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                <mpath href={`#${idGaris}-garis`} />
              </animateMotion>
            </circle>
          </svg>
        </div>
      </div>

      {/* B. Equalizer volume air — kanan atas */}
      <div
        className="auth-tile hidden xl:block"
        style={{ top: '16%', left: 'calc(50% + 462px)', width: 164, '--dur': '15s', '--kedalaman': '1.25', '--rot': '3deg' } as React.CSSProperties}
      >
        <div className="auth-glass p-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-semibold text-ink-3 tracking-[0.08em]">VOLUME AIR</span>
            <span className="text-[9px] font-mono text-ink-3">12 bln</span>
          </div>
          <div className="flex items-end gap-[3px] h-12">
            {batang.map((h, i) => (
              <span
                key={i}
                className="auth-eq flex-1 rounded-[2px]"
                style={{
                  height: `${h}%`,
                  background: i % 3 === 0 ? 'var(--color-brand)' : 'color-mix(in srgb, var(--color-brand) 42%, var(--color-surface))',
                  '--bdur': `${2.2 + (i % 4) * 0.35}s`,
                  animationDelay: `${i * 0.11}s`,
                } as React.CSSProperties}
              />
            ))}
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-[11px] font-bold text-ink tabular-nums">12,4 jt m³</span>
            <span className="text-[8px] font-mono text-ink-3">+3,1%</span>
          </div>
        </div>
      </div>

      {/* C. Cincin komposisi biaya — kiri bawah */}
      <div
        className="auth-tile hidden xl:block"
        style={{ bottom: '15%', right: 'calc(50% + 462px)', width: 172, '--dur': '17s', '--kedalaman': '0.8', '--rot': '-2deg' } as React.CSSProperties}
      >
        <div className="auth-glass p-2.5">
          <span className="text-[9px] font-semibold text-ink-3 tracking-[0.08em] block mb-2">
            KOMPOSISI BIAYA
          </span>
          <div className="flex items-center gap-3">
            <div className="auth-ring shrink-0" style={{ '--p': '68' } as React.CSSProperties}>
              <span className="text-[12px] font-bold text-ink tabular-nums leading-none">{porsi}%</span>
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--color-brand)' }} />
                <span className="text-[9px] text-ink-2">Operasional</span>
                <span className="text-[9px] font-mono text-ink-3 ml-auto">68</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--color-violet)' }} />
                <span className="text-[9px] text-ink-2">Investasi</span>
                <span className="text-[9px] font-mono text-ink-3 ml-auto">32</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* D. Dokumen RAG — kanan bawah: inti tema (dokumen -> dashboard) */}
      <div
        className="auth-tile hidden xl:block"
        style={{ bottom: '13%', left: 'calc(50% + 462px)', width: 180, '--dur': '16s', '--kedalaman': '1.1', '--rot': '2deg' } as React.CSSProperties}
      >
        <div className="auth-glass p-2.5">
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-10 shrink-0 rounded-[4px] border border-line-strong bg-surface-2 overflow-hidden">
              <span className="absolute inset-x-1.5 top-1.5 h-[2px] rounded bg-line-strong" />
              <span className="absolute inset-x-1.5 top-3 h-[2px] rounded bg-line-strong" />
              <span className="absolute inset-x-1.5 top-[18px] h-[2px] rounded bg-line-strong" />
              <span className="absolute inset-x-1.5 top-[26px] right-3 h-[2px] rounded bg-line-strong" />
              <span
                className="auth-scanline absolute inset-x-0 h-[2px]"
                style={{ background: 'var(--color-brand)', boxShadow: '0 0 8px var(--color-brand)' }}
              />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold text-ink truncate">RKAP 2026.pdf</div>
              <div className="text-[8px] text-ink-3 font-mono">12 hal · 8.802 token</div>
              <div className="mt-1 flex items-center gap-1">
                <span className="auth-chip">tersitasi</span>
                <span className="auth-chip auth-chip--tunda">hal. 24</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
