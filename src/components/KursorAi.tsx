import React, { useEffect, useState } from 'react';
import { MousePointer2 } from 'lucide-react';

/**
 * KURSOR AI LIVE.
 *
 * Selama Rekomendasi AI menyusun, server menaruh kartu satu per satu dan
 * menulis id kartu terakhir ke `ai.kartuAktif`. Kursor ini mengejar kartu
 * tersebut (`[data-widget-id]`) dengan transisi, jadi pengguna melihat AI
 * "menaruh" kartu. Posisi diukur ulang berkala karena tata letak kanvas
 * bergeser setiap kartu baru masuk. Tidak menangkap klik.
 */
export function KursorAi({ kartuId, pesan }: { kartuId?: string; pesan?: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const ukur = () => {
      const el = kartuId
        ? document.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(kartuId)}"]`)
        : null;
      if (!el) return; // kartu belum tergambar: kursor diam di posisi terakhir
      const r = el.getBoundingClientRect();
      setPos({ x: r.left + r.width * 0.62, y: r.top + r.height * 0.55 });
    };
    ukur();
    const t = setInterval(ukur, 250);
    return () => clearInterval(t);
  }, [kartuId]);

  if (!pos) return null;

  return (
    <div
      aria-hidden
      data-testid="kursor-ai"
      className="fixed left-0 top-0 z-40 pointer-events-none"
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {/* Riak "klik" setiap kartu baru ditaruh. */}
      <span key={kartuId} className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-brand/40 animate-ping" />
      <MousePointer2 className="relative w-6 h-6 text-brand fill-brand drop-shadow" />
      <span className="absolute left-5 top-5 max-w-[240px] truncate rounded-md bg-brand px-2 py-0.5 text-[11px] font-semibold shadow">
        AI · {pesan || 'menyusun'}
      </span>
    </div>
  );
}
