import React from 'react';

/**
 * Latar bergerak untuk halaman login: dokumen RAG yang mengalir menjadi dashboard.
 *
 * Semuanya CSS murni (tanpa canvas/WebGL, tanpa loop requestAnimationFrame), jadi
 * tidak menambah beban CPU saat halaman diam. Setiap animasi memakai transform/
 * opacity saja agar tetap lancar, dan seluruhnya berhenti saat pengguna mengaktifkan
 * `prefers-reduced-motion` (aturan global di index.css).
 *
 * Dekorasi murni: `aria-hidden` + `pointer-events: none` supaya tidak pernah
 * mengganggu pembaca layar maupun klik pada form.
 */
export const AuthBackdrop: React.FC = () => {
  // Batang chart: tinggi bervariasi supaya terlihat seperti data nyata.
  const batang = [14, 24, 18, 32, 22, 38, 28];

  return (
    <div className="auth-bg" aria-hidden="true">
      {/* 1. Aurora: tiga bidang cahaya brand yang bergerak sangat perlahan. */}
      <div className="auth-blob auth-blob-a" />
      <div className="auth-blob auth-blob-b" />
      <div className="auth-blob auth-blob-c" />

      {/* 2. Kisi halus bergeser pelan — kesan kanvas dashboard. */}
      <div className="auth-grid" />

      {/* 3. Kartu widget mengapung: menggambarkan isi produk (KPI, tren, donat, dokumen).
             Posisi diikat ke TEPI kartu login, bukan ke persentase viewport, supaya
             jaraknya selalu tepat 16px dari kartu login di lebar layar mana pun.
             Kartu login `max-w-4xl` = 896px, jadi tepinya di `50% ± 448px`.
             - Kartu kiri  -> `right: calc(50% + 464px)` (448 + 16)
             - Kartu kanan -> `left:  calc(50% + 464px)`
             Hanya tampil di `xl` (>=1280px) karena butuh ruang ~1264px agar tidak
             berdesakan dengan kartu login. */}

      {/* Kartu KPI — kiri atas */}
      <div
        className="auth-float hidden xl:block"
        style={{ top: '14%', right: 'calc(50% + 464px)', width: 168, '--dur': '13s', '--rot': '-3deg' } as React.CSSProperties}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-semibold text-ink-3 tracking-wide">PENDAPATAN</span>
          <span className="text-[9px] font-mono text-pos">▲ 7,3%</span>
        </div>
        <div className="text-base font-bold text-ink leading-none">Rp 748,2 M</div>
        {/* Sparkline kecil yang menggambar dirinya sendiri. */}
        <svg viewBox="0 0 100 26" className="w-full h-6 mt-1.5" role="presentation">
          <polyline
            className="auth-line-draw"
            points="2,22 18,17 34,19 50,11 66,13 82,6 98,4"
            fill="none"
            stroke="var(--color-pos)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Kartu batang — kanan atas */}
      <div
        className="auth-float hidden xl:block"
        style={{ top: '17%', left: 'calc(50% + 464px)', width: 150, '--dur': '15s', '--rot': '3deg' } as React.CSSProperties}
      >
        <span className="text-[9px] font-semibold text-ink-3 tracking-wide block mb-2">
          VOLUME AIR TERJUAL
        </span>
        <div className="flex items-end gap-1.5 h-11">
          {batang.map((h, i) => (
            <span
              key={i}
              className="auth-bar flex-1 rounded-t-[2px]"
              style={{
                height: `${h}px`,
                background: i % 2 === 0 ? 'var(--color-brand)' : 'var(--color-violet)',
                '--bdur': `${3 + (i % 3) * 0.6}s`,
                animationDelay: `${i * 0.18}s`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>

      {/* Kartu donat — kiri bawah */}
      <div
        className="auth-float hidden xl:block"
        style={{ bottom: '16%', right: 'calc(50% + 464px)', width: 150, '--dur': '17s', '--rot': '-2deg' } as React.CSSProperties}
      >
        <span className="text-[9px] font-semibold text-ink-3 tracking-wide block mb-1.5">
          KOMPOSISI BIAYA
        </span>
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 60 60" className="w-11 h-11 shrink-0" role="presentation">
            <circle cx="30" cy="30" r="22" fill="none" stroke="var(--color-surface-2)" strokeWidth="9" />
            <circle
              className="auth-donut"
              cx="30" cy="30" r="22"
              fill="none"
              stroke="var(--color-brand)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray="66 94"
              transform="rotate(-90 30 30)"
            />
          </svg>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-brand)' }} />
              <span className="text-[9px] text-ink-2">Operasional</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-violet)' }} />
              <span className="text-[9px] text-ink-2">Investasi</span>
            </div>
          </div>
        </div>
      </div>

      {/* Kartu dokumen — kanan bawah: inti tema (dokumen RAG -> dashboard) */}
      <div
        className="auth-float hidden xl:block"
        style={{ bottom: '14%', left: 'calc(50% + 464px)', width: 156, '--dur': '16s', '--rot': '2deg' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <div className="relative w-7 h-9 shrink-0 rounded-[3px] border border-line bg-surface-2 overflow-hidden">
            <span className="absolute inset-x-1 top-1.5 h-[2px] rounded bg-line-strong" />
            <span className="absolute inset-x-1 top-3 h-[2px] rounded bg-line-strong" />
            <span className="absolute inset-x-1 top-[18px] h-[2px] rounded bg-line-strong" />
            {/* Garis pindai: menandakan dokumen sedang dibaca RAG. */}
            <span
              className="auth-scanline absolute inset-x-0 h-[2px]"
              style={{ background: 'var(--color-brand)', boxShadow: '0 0 6px var(--color-brand)' }}
            />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-semibold text-ink truncate">RKAP 2026.pdf</div>
            <div className="text-[8px] text-ink-3 font-mono">12 hal · 8.802 token</div>
            <div className="text-[8px] text-pos font-semibold mt-0.5 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-pos" />
              tersitasi
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
