import React, { useRef } from 'react';

interface TiltProps {
  children: React.ReactNode;
  className?: string;
  /** Sudut miring maksimum (derajat). Default halus. */
  max?: number;
}

/**
 * Efek miring 3D mengikuti kursor + kilau cahaya. Hanya aktif untuk pointer
 * mouse dan dimatikan otomatis bila pengguna memilih "reduce motion".
 */
export const Tilt: React.FC<TiltProps> = ({ children, className = '', max = 5 }) => {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== 'mouse') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * max * 2}deg) rotateY(${(px - 0.5) * max * 2}deg) translateY(-3px)`;
    el.style.setProperty('--gx', `${px * 100}%`);
    el.style.setProperty('--gy', `${py * 100}%`);
  };

  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = '';
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`tilt-3d ${className}`}
    >
      {children}
    </div>
  );
};
