import React, { useEffect, useRef, useState } from 'react';
import { MousePointer2 } from 'lucide-react';

/**
 * KURSOR AI LIVE — versi bergerak halus.
 *
 * Selama Rekomendasi AI menyusun, server menaruh kartu satu per satu dan
 * menulis id kartu terakhir ke `ai.kartuAktif`. Komponen ini mengejar kartu
 * tersebut (`[data-widget-id]`) dengan gerak berkelanjutan, bukan lompatan:
 *
 *   1. Tujuan diukur ulang (interval pendek + scroll/resize), jadi kartu baru
 *      atau tata letak yang bergeser tetap diikuti tanpa patah-patah.
 *   2. Posisi dianimasikan per frame (`requestAnimationFrame`) dengan peluruhan
 *      eksponensial, sehingga kecepatan MENYAMBUNG antar tujuan — inilah bedanya
 *      dengan transisi CSS yang terputus tiap kali target berganti.
 *   3. Ada kemiringan mengikuti arah gerak, jejak titik yang memudar, riak
 *      "klik" saat sampai, dan cincin denyut pada kartu yang baru ditaruh.
 *   4. Halaman ikut bergulir halus bila kartu tujuan di luar layar.
 *   5. `prefers-reduced-motion` mematikan gerak: kursor langsung di tempat.
 *
 * Tidak menangkap klik (`pointer-events: none`) dan tidak menggeser tata letak:
 * seluruh node kursor berada di wadah `fixed` sendiri.
 */

/** Makin besar, makin cepat menyusul tujuan (1/detik). */
const PENYUSULAN = 11;
/** Jarak (piksel) yang dianggap "sudah sampai". */
const JARAK_SAMPAI = 1.2;
/** Jumlah titik jejak di belakang panah. */
const JUMLAH_JEJAK = 5;

type Titik = { x: number; y: number };

const kartuDari = (id: string | undefined) =>
  id ? document.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(id)}"]`) : null;

export function KursorAi({ kartuId, pesan }: { kartuId?: string; pesan?: string }) {
  const induk = useRef<HTMLDivElement | null>(null);
  const inti = useRef<HTMLDivElement | null>(null);
  const ikon = useRef<HTMLSpanElement | null>(null);
  const label = useRef<HTMLDivElement | null>(null);
  const jejak = useRef<Array<HTMLSpanElement | null>>([]);

  const tujuan = useRef<Titik | null>(null);
  const idTujuan = useRef<string | undefined>(undefined);
  const posisi = useRef<Titik>({ x: -120, y: -120 });
  const kecepatan = useRef<Titik>({ x: 0, y: 0 });
  const sudahBeriak = useRef<string | undefined>(undefined);
  const [tampil, setTampil] = useState(false);

  // ── 1. Ukur tujuan: kartu yang baru ditaruh AI ────────────────────────────
  useEffect(() => {
    if (!kartuId) {
      tujuan.current = null;
      idTujuan.current = undefined;
      setTampil(false);
      return;
    }
    const ukur = () => {
      const el = kartuDari(kartuId);
      if (!el) return; // kartu belum tergambar: kursor melanjutkan gerak terakhir
      const r = el.getBoundingClientRect();
      tujuan.current = { x: r.left + r.width * 0.62, y: r.top + r.height * 0.55 };
      idTujuan.current = kartuId;
      setTampil(true);
      // Bila kartu di luar layar, gulir halus supaya kursor tidak "menghilang".
      if (r.top < 96) window.scrollBy({ top: r.top - 150, behavior: 'smooth' });
      else if (r.bottom > window.innerHeight - 72)
        window.scrollBy({ top: r.bottom - window.innerHeight + 170, behavior: 'smooth' });
    };
    ukur();
    const jeda = window.setInterval(ukur, 280);
    window.addEventListener('scroll', ukur, { passive: true });
    window.addEventListener('resize', ukur);
    return () => {
      window.clearInterval(jeda);
      window.removeEventListener('scroll', ukur);
      window.removeEventListener('resize', ukur);
    };
  }, [kartuId]);

  // ── 2. Gerak berkelanjutan per frame ─────────────────────────────────────
  useEffect(() => {
    const kurangiGerak = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const riwayat: Titik[] = [];
    let bingkai = 0;
    let sebelum = performance.now();

    /** Riak "klik" di titik kursor. */
    const riak = (x: number, y: number) => {
      const wadah = induk.current;
      if (!wadah || kurangiGerak) return;
      const titik = document.createElement('span');
      titik.setAttribute('aria-hidden', 'true');
      titik.style.cssText =
        'position:absolute;left:0;top:0;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:9999px;' +
        'background:rgb(37 99 235 / 0.30);pointer-events:none';
      wadah.appendChild(titik);
      const animasi = titik.animate(
        [
          { transform: `translate3d(${x}px, ${y}px, 0) scale(0.35)`, opacity: 0.85 },
          { transform: `translate3d(${x}px, ${y}px, 0) scale(4.4)`, opacity: 0 },
        ],
        { duration: 820, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
      );
      animasi.onfinish = () => titik.remove();
    };

    /** Cincin denyut pada kartu yang baru ditaruh AI. */
    const denyut = (id: string | undefined) => {
      const el = kartuDari(id);
      if (!el || kurangiGerak) return;
      el.animate(
        [
          { boxShadow: '0 0 0 0 rgb(37 99 235 / 0.45)' },
          { boxShadow: '0 0 0 7px rgb(37 99 235 / 0.12)' },
          { boxShadow: '0 0 0 0 rgb(37 99 235 / 0)' },
        ],
        { duration: 950, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      );
    };

    const langkah = (kini: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (kini - sebelum) / 1000));
      sebelum = kini;

      const p = posisi.current;
      const t = tujuan.current;
      if (t) {
        const alpha = kurangiGerak ? 1 : 1 - Math.exp(-PENYUSULAN * dt);
        const dx = (t.x - p.x) * alpha;
        const dy = (t.y - p.y) * alpha;
        kecepatan.current = { x: dx / dt, y: dy / dt };
        p.x += dx;
        p.y += dy;
      }

      const v = kecepatan.current;
      const melesat = Math.min(1, Math.hypot(v.x, v.y) / 2600);
      // Condong mengikuti arah gerak; memudar saat kursor berhenti.
      const miring = kurangiGerak ? 0 : Math.max(-11, Math.min(11, v.x * 0.006));
      const ayun = kurangiGerak || melesat > 0.06 ? 0 : Math.sin(kini / 620) * 1.4;

      if (inti.current) {
        inti.current.style.transform = `translate3d(${p.x}px, ${p.y + ayun}px, 0)`;
      }
      if (ikon.current) {
        ikon.current.style.transform = `rotate(${miring}deg) scale(${1 + melesat * 0.06})`;
      }
      if (label.current) {
        label.current.style.transform = `translate3d(${p.x + 18}px, ${p.y + 18}px, 0)`;
        label.current.style.opacity = melesat > 0.02 ? '0.88' : '1';
      }

      // Jejak: simpan riwayat posisi, tampilkan beberapa sampel sebelumnya.
      riwayat.push({ x: p.x, y: p.y });
      if (riwayat.length > 160) riwayat.shift();
      for (let i = 0; i < JUMLAH_JEJAK; i += 1) {
        const simpul = jejak.current[i];
        if (!simpul) continue;
        const sampel = riwayat[riwayat.length - 1 - (i + 1) * 5];
        if (!sampel || kurangiGerak) {
          simpul.style.opacity = '0';
          continue;
        }
        simpul.style.transform = `translate3d(${sampel.x}px, ${sampel.y}px, 0)`;
        simpul.style.opacity = String(0.26 * (1 - i / JUMLAH_JEJAK) * (melesat > 0.02 ? 1 : 0.35));
      }

      // Sampai tujuan: riak + denyut, sekali per kartu.
      if (t && Math.hypot(t.x - p.x, t.y - p.y) <= JARAK_SAMPAI && idTujuan.current !== sudahBeriak.current) {
        sudahBeriak.current = idTujuan.current;
        riak(p.x, p.y);
        denyut(idTujuan.current);
      }

      bingkai = requestAnimationFrame(langkah);
    };

    bingkai = requestAnimationFrame(langkah);
    return () => cancelAnimationFrame(bingkai);
  }, []);

  return (
    <div ref={induk} aria-hidden data-testid="kursor-ai" className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
      {/* Jejak gerak: titik yang memudar di belakang panah. */}
      {Array.from({ length: JUMLAH_JEJAK }).map((_, i) => (
        <span
          key={`jejak-${i}`}
          ref={(el) => {
            jejak.current[i] = el;
          }}
          className="absolute left-0 top-0 -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-full bg-brand"
          style={{ opacity: 0, transition: 'opacity 120ms linear' }}
        />
      ))}

      {/* Panah kursor. */}
      <div
        ref={inti}
        className="absolute left-0 top-0 will-change-transform"
        style={{ opacity: tampil ? 1 : 0, transition: 'opacity 240ms ease-out' }}
      >
        <span ref={ikon} className="block will-change-transform">
          <MousePointer2 className="h-6 w-6 text-brand fill-brand drop-shadow-md" />
        </span>
      </div>

      {/* Label status AI, mengikuti kursor dengan jeda halus. */}
      <div
        ref={label}
        className="absolute left-0 top-0 will-change-transform"
        style={{ opacity: tampil ? 1 : 0, transition: 'opacity 240ms ease-out' }}
      >
        <span className="flex items-center gap-1.5 rounded-full bg-brand px-2.5 py-1 text-[11px] font-semibold text-on-brand shadow-md">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          AI · {pesan || 'menyusun'}
        </span>
      </div>
    </div>
  );
}
